import type { LlmFeature } from "@tasksight/shared";
import { logger } from "../logger";
import { AiLog } from "../models/AiLog";

export interface AiLogEntry {
  userId: string;
  workspaceId?: string | null;
  feature: LlmFeature;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  estCost?: number | null;
  success: boolean;
  cacheHit?: boolean;
  fromSample?: boolean;
  errorCode?: string | null;
}

export async function writeAiLog(entry: AiLogEntry): Promise<void> {
  try {
    await AiLog.create({ ...entry, workspaceId: entry.workspaceId ?? null });
  } catch (err) {
    logger.warn({ err }, "failed to write AiLog");
  }
}
