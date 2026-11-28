import mongoose, { type PipelineStage } from "mongoose";
import type { LlmFeature } from "@tasksight/shared";
import { AiLog } from "../models/AiLog";
import { ResponseCache, cacheKey } from "./cache";
import { pacificDayStart } from "./day";
import type { LlmLimiter } from "./limiter";
import { writeAiLog } from "./log";
import { estimateCost } from "./pricing";
import { sampleFor } from "./samples";
import {
  LlmError,
  type EmbedRequest,
  type EmbedResult,
  type GenerateRequest,
  type LlmErrorReason,
  type LlmProvider,
} from "./types";

export interface LlmContext {
  userId: string;
  workspaceId?: string | null;
  feature: LlmFeature;
}

export interface CachedGenerate {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface LlmGenerateOutput extends CachedGenerate {
  cacheHit: boolean;
  fromSample: boolean;
}

export interface LlmServiceOptions {
  provider: LlmProvider;
  limiter: LlmLimiter;
  cache: ResponseCache<CachedGenerate>;
  textModel: string;
  fallbackModel: string;
  embedModel: string;
  userDailyQuota: number;
  now?: () => number;
}

type FallbackReason = LlmErrorReason | "user_quota";

// Every AI call in the API goes through this class. It writes one AiLog row per call.
export class LlmService {
  private readonly opts: LlmServiceOptions;
  private readonly now: () => number;

  constructor(opts: LlmServiceOptions) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
  }

  async getUserQuota(userId: string): Promise<{ limit: number; usedToday: number }> {
    return {
      limit: this.opts.userDailyQuota,
      usedToday: await this.countUserCalls(userId),
    };
  }

  async generate(ctx: LlmContext, req: GenerateRequest): Promise<LlmGenerateOutput> {
    const started = this.now();
    const primary = req.model ?? this.opts.textModel;
    const ids = { userId: ctx.userId, workspaceId: ctx.workspaceId ?? null, feature: ctx.feature };
    const key = cacheKey({
      feature: ctx.feature,
      model: primary,
      prompt: req.prompt,
      system: req.system,
      json: req.json,
    });

    const hit = this.opts.cache.get(key);
    if (hit) {
      await writeAiLog({
        ...ids,
        model: hit.model,
        success: true,
        cacheHit: true,
        estCost: 0,
        latencyMs: this.now() - started,
      });
      return { ...hit, tokensIn: 0, tokensOut: 0, cacheHit: true, fromSample: false };
    }

    if ((await this.countUserCalls(ctx.userId)) >= this.opts.userDailyQuota) {
      return this.fallback(ctx, primary, started, "user_quota");
    }

    const candidates =
      req.model || this.opts.fallbackModel === primary
        ? [primary]
        : [primary, this.opts.fallbackModel];
    let lastReason: FallbackReason = "unavailable";

    for (const model of candidates) {
      const slot = this.opts.limiter.acquire(model);
      if (!slot.ok) {
        lastReason = slot.reason;
        continue;
      }
      try {
        const result = await this.opts.provider.generate({ ...req, model });
        const out: CachedGenerate = {
          text: result.text,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        };
        this.opts.cache.set(key, out);
        await writeAiLog({
          ...ids,
          model: out.model,
          success: true,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
          estCost: estimateCost(out.model, out.tokensIn, out.tokensOut),
          latencyMs: this.now() - started,
        });
        return { ...out, cacheHit: false, fromSample: false };
      } catch (err) {
        lastReason = err instanceof LlmError ? err.reason : "provider";
        // No key means every model would fail the same way.
        if (lastReason === "unavailable") break;
      }
    }

    return this.fallback(ctx, primary, started, lastReason);
  }

  async embed(
    ctx: { userId: string; workspaceId?: string | null },
    req: EmbedRequest,
  ): Promise<EmbedResult> {
    const started = this.now();
    const model = this.opts.embedModel;
    const ids = {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId ?? null,
      feature: "embed" as const,
      model,
    };

    const slot = this.opts.limiter.acquire(model);
    if (!slot.ok) {
      await writeAiLog({
        ...ids,
        success: false,
        errorCode: slot.reason,
        latencyMs: this.now() - started,
      });
      throw new LlmError(slot.reason, "Embedding limit reached", slot.retryAfterMs);
    }

    try {
      const result = await this.opts.provider.embed(req);
      await writeAiLog({
        ...ids,
        success: true,
        tokensIn: result.tokensIn,
        estCost: estimateCost(result.model, result.tokensIn, 0),
        latencyMs: this.now() - started,
      });
      return result;
    } catch (err) {
      const error = err instanceof LlmError ? err : new LlmError("provider", "Embedding failed");
      await writeAiLog({
        ...ids,
        success: false,
        errorCode: error.reason,
        latencyMs: this.now() - started,
      });
      throw error;
    }
  }

  // Real model calls that succeeded today (Pacific). Cache hits, samples, failures and
  // embeddings do not count against the user.
  private async countUserCalls(userId: string): Promise<number> {
    const since = pacificDayStart(this.now());
    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          feature: { $ne: "embed" },
          success: true,
          cacheHit: false,
          fromSample: false,
          createdAt: { $gte: since },
        },
      },
      { $count: "n" },
    ] as unknown as PipelineStage[];
    const rows = await AiLog.aggregate<{ n: number }>(pipeline);
    return rows[0]?.n ?? 0;
  }

  private async fallback(
    ctx: LlmContext,
    model: string,
    started: number,
    reason: FallbackReason,
  ): Promise<LlmGenerateOutput> {
    const ids = { userId: ctx.userId, workspaceId: ctx.workspaceId ?? null, feature: ctx.feature };
    const latencyMs = this.now() - started;
    const text = sampleFor(ctx.feature);

    if (text === null) {
      await writeAiLog({ ...ids, model, success: false, errorCode: reason, latencyMs });
      throw new LlmError(
        reason === "user_quota" ? "quota" : reason,
        "The AI service is not available right now",
      );
    }

    await writeAiLog({
      ...ids,
      model,
      success: false,
      fromSample: true,
      estCost: 0,
      errorCode: reason,
      latencyMs,
    });
    return { text, model: "sample", tokensIn: 0, tokensOut: 0, cacheHit: false, fromSample: true };
  }
}
