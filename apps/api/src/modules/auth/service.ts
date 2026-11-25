import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  User as UserResponse,
} from "@tasksight/shared";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
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

function toUser(doc: UserDoc): UserResponse {
  return { id: doc.id, name: doc.name, email: doc.email };
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

  // Every new user gets a personal workspace so their UI has somewhere to land.
  const workspace = await Workspace.create({ name: "My Workspace", ownerId: doc.id });
  await WorkspaceMember.create({ workspaceId: workspace._id, userId: doc.id, role: "owner" });

  const accessToken = await signAccessToken(doc.id);
  return {
    body: { accessToken, user: toUser(doc) },
    refreshCookie: { value: pair.raw, expiresAt: pair.expiresAt },
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const doc = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!doc?.passwordHash) throw new AppError("UNAUTHORIZED", "Invalid credentials");

  const ok = await verifyPassword(doc.passwordHash, input.password);
  if (!ok) throw new AppError("UNAUTHORIZED", "Invalid credentials");

  const pair = generateRefreshToken();
  const nextTokens = [
    ...doc.refreshTokens,
    {
      tokenHash: pair.hash,
      familyId: pair.familyId,
      expiresAt: pair.expiresAt,
      previousTokenHash: null,
      previousUsedAt: null,
    },
  ];
  doc.set("refreshTokens", nextTokens);
  await doc.save();

  const accessToken = await signAccessToken(doc.id);
  return {
    body: { accessToken, user: toUser(doc) },
    refreshCookie: { value: pair.raw, expiresAt: pair.expiresAt },
  };
}

export async function refresh(rawFromCookie: string): Promise<AuthResult> {
  const hash = hashRefreshToken(rawFromCookie);
  const now = new Date();

  const doc =
    (await User.findOne({ "refreshTokens.tokenHash": hash })) ??
    (await User.findOne({ "refreshTokens.previousTokenHash": hash }));
  if (!doc) throw new AppError("UNAUTHORIZED", "Invalid refresh token");

  const current = doc.refreshTokens.find((t) => t.tokenHash === hash);
  if (current) {
    if (current.expiresAt.getTime() <= now.getTime()) {
      doc.set(
        "refreshTokens",
        doc.refreshTokens.filter((t) => t.tokenHash !== hash),
      );
      await doc.save();
      throw new AppError("UNAUTHORIZED", "Refresh token expired");
    }
    const pair = generateRefreshToken();
    const nextTokens = [
      ...doc.refreshTokens
        .filter((t) => t.tokenHash !== hash)
        .map((t) => ({
          tokenHash: t.tokenHash,
          familyId: t.familyId,
          expiresAt: t.expiresAt,
          previousTokenHash: t.previousTokenHash ?? null,
          previousUsedAt: t.previousUsedAt ?? null,
        })),
      {
        tokenHash: pair.hash,
        familyId: current.familyId,
        expiresAt: pair.expiresAt,
        previousTokenHash: hash,
        previousUsedAt: now,
      },
    ];
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
      doc.refreshTokens.filter((t) => !familyIds.has(t.familyId)),
    );
    await doc.save();
    throw new AppError("UNAUTHORIZED", "Refresh token reuse detected");
  }

  const familyId = prevMatches[0]!.familyId;
  const pair = generateRefreshToken();
  const nextTokens = [
    ...doc.refreshTokens.map((t) => ({
      tokenHash: t.tokenHash,
      familyId: t.familyId,
      expiresAt: t.expiresAt,
      previousTokenHash: t.previousTokenHash ?? null,
      previousUsedAt: t.previousUsedAt ?? null,
    })),
    {
      tokenHash: pair.hash,
      familyId,
      expiresAt: pair.expiresAt,
      previousTokenHash: hash,
      previousUsedAt: now,
    },
  ];
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
    doc.refreshTokens.filter((t) => t.familyId !== entry.familyId),
  );
  await doc.save();
}
