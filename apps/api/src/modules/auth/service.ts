import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  User as UserResponse,
} from "@tasksight/shared";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logger } from "../../logger";
import { User, type UserDoc } from "../../models/User";
import { Workspace } from "../../models/Workspace";
import { WorkspaceMember } from "../../models/WorkspaceMember";
import { hashPassword, verifyPassword } from "./argon";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "./tokens";

export interface RefreshCookie {
  value: string;
  expiresAt: Date;
}

export interface AuthResult {
  body: AuthResponse;
  refreshCookie: RefreshCookie;
}

const MAX_REFRESH_TOKENS = 10;

function toUser(doc: UserDoc): UserResponse {
  return { id: doc.id, name: doc.name, email: doc.email };
}

function activeRefreshTokens(tokens: UserDoc["refreshTokens"], now: Date) {
  return tokens
    .filter((token) => token.expiresAt.getTime() > now.getTime())
    .map((token) => ({
      tokenHash: token.tokenHash,
      familyId: token.familyId,
      expiresAt: token.expiresAt,
      previousTokenHash: token.previousTokenHash ?? null,
      previousUsedAt: token.previousUsedAt ?? null,
    }))
    .slice(-MAX_REFRESH_TOKENS);
}

async function rollbackRegistration(userId: string): Promise<void> {
  const results = await Promise.allSettled([
    WorkspaceMember.deleteMany({ userId }),
    Workspace.deleteMany({ ownerId: userId }),
    User.deleteOne({ _id: userId }),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error({ err: result.reason, userId }, "Failed to roll back registration");
    }
  }
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw new AppError("CONFLICT", "Email already registered");

  const passwordHash = await hashPassword(input.password);
  const pair = generateRefreshToken();

  let doc: UserDoc;
  try {
    doc = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      refreshTokens: [
        {
          tokenHash: pair.hash,
          familyId: pair.familyId,
          expiresAt: pair.expiresAt,
          previousTokenHash: null,
          previousUsedAt: null,
        },
      ],
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError("CONFLICT", "Email already registered");
    }
    throw err;
  }

  try {
    const workspace = await Workspace.create({ name: "My Workspace", ownerId: doc.id });
    await WorkspaceMember.create({ workspaceId: workspace._id, userId: doc.id, role: "owner" });

    const accessToken = await signAccessToken(doc.id);
    return {
      body: { accessToken, user: toUser(doc) },
      refreshCookie: { value: pair.raw, expiresAt: pair.expiresAt },
    };
  } catch (err) {
    await rollbackRegistration(doc.id);
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const doc = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!doc?.passwordHash) throw new AppError("UNAUTHORIZED", "Invalid credentials");

  const ok = await verifyPassword(doc.passwordHash, input.password);
  if (!ok) throw new AppError("UNAUTHORIZED", "Invalid credentials");

  const pair = generateRefreshToken();
  const now = new Date();
  const nextTokens = [
    ...activeRefreshTokens(doc.refreshTokens, now),
    {
      tokenHash: pair.hash,
      familyId: pair.familyId,
      expiresAt: pair.expiresAt,
      previousTokenHash: null,
      previousUsedAt: null,
    },
  ].slice(-MAX_REFRESH_TOKENS);
  doc.set("refreshTokens", nextTokens);
  await doc.save();

  const accessToken = await signAccessToken(doc.id);
  return {
    body: { accessToken, user: toUser(doc) },
    refreshCookie: { value: pair.raw, expiresAt: pair.expiresAt },
  };
}

// Two requests with the same cookie can race, and the second save then fails with a Mongoose
// VersionError. Retrying lets it take the grace-window path instead of returning a 500.
export async function refresh(rawFromCookie: string): Promise<AuthResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await refreshOnce(rawFromCookie);
    } catch (err) {
      const isVersionConflict = err instanceof Error && err.name === "VersionError";
      if (!isVersionConflict || attempt >= 3) throw err;
    }
  }
}

async function refreshOnce(rawFromCookie: string): Promise<AuthResult> {
  const hash = hashRefreshToken(rawFromCookie);
  const now = new Date();

  const doc =
    (await User.findOne({ "refreshTokens.tokenHash": hash })) ??
    (await User.findOne({ "refreshTokens.previousTokenHash": hash }));
  if (!doc) throw new AppError("UNAUTHORIZED", "Invalid refresh token");

  const current = doc.refreshTokens.find((t) => t.tokenHash === hash);
  if (current) {
    if (current.expiresAt.getTime() <= now.getTime()) {
      doc.set("refreshTokens", activeRefreshTokens(doc.refreshTokens, now));
      await doc.save();
      throw new AppError("UNAUTHORIZED", "Refresh token expired");
    }
    const pair = generateRefreshToken();
    const nextTokens = [
      ...activeRefreshTokens(doc.refreshTokens, now).filter((t) => t.tokenHash !== hash),
      {
        tokenHash: pair.hash,
        familyId: current.familyId,
        expiresAt: pair.expiresAt,
        previousTokenHash: hash,
        previousUsedAt: now,
      },
    ].slice(-MAX_REFRESH_TOKENS);
    doc.set("refreshTokens", nextTokens);
    await doc.save();
    const accessToken = await signAccessToken(doc.id);
    return {
      body: { accessToken, user: toUser(doc) },
      refreshCookie: { value: pair.raw, expiresAt: pair.expiresAt },
    };
  }

  const prevMatches = doc.refreshTokens.filter((t) => t.previousTokenHash === hash);
  if (prevMatches.length === 0) throw new AppError("UNAUTHORIZED", "Invalid refresh token");

  const graceMs = env.REFRESH_GRACE_SECONDS * 1000;
  const expired = prevMatches.some(
    (t) => !t.previousUsedAt || now.getTime() - t.previousUsedAt.getTime() > graceMs,
  );
  if (expired) {
    const familyIds = new Set(prevMatches.map((t) => t.familyId));
    doc.set(
      "refreshTokens",
      activeRefreshTokens(doc.refreshTokens, now).filter((t) => !familyIds.has(t.familyId)),
    );
    await doc.save();
    throw new AppError("UNAUTHORIZED", "Refresh token reuse detected");
  }

  const familyId = prevMatches[0]!.familyId;
  const pair = generateRefreshToken();
  const nextTokens = [
    ...activeRefreshTokens(doc.refreshTokens, now),
    {
      tokenHash: pair.hash,
      familyId,
      expiresAt: pair.expiresAt,
      previousTokenHash: hash,
      previousUsedAt: now,
    },
  ].slice(-MAX_REFRESH_TOKENS);
  doc.set("refreshTokens", nextTokens);
  await doc.save();

  const accessToken = await signAccessToken(doc.id);
  return {
    body: { accessToken, user: toUser(doc) },
    refreshCookie: { value: pair.raw, expiresAt: pair.expiresAt },
  };
}

export async function logout(rawFromCookie: string): Promise<void> {
  const hash = hashRefreshToken(rawFromCookie);
  const doc = await User.findOne({ "refreshTokens.tokenHash": hash });
  if (!doc) return;
  const entry = doc.refreshTokens.find((t) => t.tokenHash === hash);
  if (!entry) return;
  doc.set(
    "refreshTokens",
    activeRefreshTokens(doc.refreshTokens, new Date()).filter((t) => t.familyId !== entry.familyId),
  );
  await doc.save();
}
