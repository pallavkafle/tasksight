import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";

const encoder = new TextEncoder();

function accessSecret(): Uint8Array {
  if (!env.JWT_ACCESS_SECRET) {
    throw new AppError("INTERNAL", "JWT_ACCESS_SECRET is not configured");
  }
  return encoder.encode(env.JWT_ACCESS_SECRET);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    if (typeof payload.sub !== "string") throw new Error("missing sub");
    return payload.sub;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid or expired token");
  }
}

export interface RefreshTokenPair {
  raw: string;
  hash: string;
  familyId: string;
  expiresAt: Date;
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken(): RefreshTokenPair {
  const raw = randomBytes(32).toString("hex");
  const familyId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash: hashRefreshToken(raw), familyId, expiresAt };
}
