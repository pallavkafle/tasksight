import { hash, verify } from "@node-rs/argon2";
import { AppError } from "../../errors/AppError";

// Explicit params: node-argon2 defaults to 64 MiB per hash, too much for a 512 MB container.
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const MAX_CONCURRENT = 2;

let running = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return;
  }
  await new Promise<void>((res) => waiters.push(res));
}

function release(): void {
  const next = waiters.shift();
  if (next) next();
  else running--;
}

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function hashPassword(password: string): Promise<string> {
  return withLimit(async () => {
    try {
      return await hash(password, ARGON_OPTS);
    } catch {
      throw new AppError("INTERNAL", "Failed to hash password");
    }
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return withLimit(async () => {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  });
}
