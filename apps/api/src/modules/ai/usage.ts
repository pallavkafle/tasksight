import mongoose from "mongoose";
import {
  LLM_FEATURES,
  type AiUsageMetrics,
  type AiUsageResponse,
  type LlmFeature,
} from "@tasksight/shared";
import { AiLog } from "../../models/AiLog";

const DAY_MS = 24 * 60 * 60 * 1000;

type AiUsageLog = {
  feature: string;
  success: boolean;
  cacheHit?: boolean;
  fromSample?: boolean;
  tokensIn?: number;
  tokensOut?: number;
  estCost?: number | null;
  latencyMs?: number;
  errorCode?: string | null;
};

function emptyMetrics(): AiUsageMetrics {
  return {
    calls: 0,
    failures: 0,
    cacheHits: 0,
    samples: 0,
    tokensIn: 0,
    tokensOut: 0,
    estCost: null,
    p95LatencyMs: null,
  };
}

function isLlmFeature(value: string): value is LlmFeature {
  return LLM_FEATURES.some((feature) => feature === value);
}

function nearestRankP95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null;
}

export async function getAiUsage(
  userId: string,
  days: number,
  now = Date.now(),
): Promise<Pick<AiUsageResponse, "days" | "byFeature" | "total">> {
  const end = new Date(now);
  const start = new Date(now - days * DAY_MS);
  const logs = await AiLog.aggregate<AiUsageLog>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $project: {
        feature: 1,
        success: 1,
        cacheHit: 1,
        fromSample: 1,
        tokensIn: 1,
        tokensOut: 1,
        estCost: 1,
        latencyMs: 1,
        errorCode: 1,
      },
    },
  ]);

  const byFeature: AiUsageResponse["byFeature"] = {
    parse_task: emptyMetrics(),
    subtasks: emptyMetrics(),
    ask: emptyMetrics(),
    agent: emptyMetrics(),
    embed: emptyMetrics(),
  };
  const total = emptyMetrics();
  const latencyByFeature: Record<LlmFeature, number[]> = {
    parse_task: [],
    subtasks: [],
    ask: [],
    agent: [],
    embed: [],
  };
  const totalLatencies: number[] = [];

  for (const log of logs) {
    if (!isLlmFeature(log.feature)) {
      throw new Error(`Unexpected AiLog feature: ${log.feature}`);
    }

    const metrics = [byFeature[log.feature], total];
    for (const metric of metrics) {
      metric.calls += 1;
      if (!log.success) metric.failures += 1;
      if (log.cacheHit) metric.cacheHits += 1;
      if (log.fromSample) metric.samples += 1;
      metric.tokensIn += log.tokensIn ?? 0;
      metric.tokensOut += log.tokensOut ?? 0;
      if (log.estCost !== null && log.estCost !== undefined) {
        metric.estCost = (metric.estCost ?? 0) + log.estCost;
      }
    }

    const isRealModelAttempt =
      !log.cacheHit &&
      !log.fromSample &&
      log.errorCode !== "user_quota" &&
      log.errorCode !== "rate_limited" &&
      log.errorCode !== "unavailable";

    if (isRealModelAttempt) {
      latencyByFeature[log.feature].push(log.latencyMs ?? 0);
      totalLatencies.push(log.latencyMs ?? 0);
    }
  }

  for (const feature of LLM_FEATURES) {
    byFeature[feature].p95LatencyMs = nearestRankP95(latencyByFeature[feature]);
  }
  total.p95LatencyMs = nearestRankP95(totalLatencies);

  return { days, byFeature, total };
}
