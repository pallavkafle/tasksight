import { pacificDayKey } from "./limiter";

// The UTC instant when the current US Pacific day began (the provider's quota day).
export function pacificDayStart(ms: number): Date {
  const key = pacificDayKey(ms);
  const [y, m, d] = key.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error("bad day key");
  for (const hour of [7, 8]) {
    const candidate = Date.UTC(y, m - 1, d, hour);
    if (pacificDayKey(candidate) === key && pacificDayKey(candidate - 1) !== key) {
      return new Date(candidate);
    }
  }
  throw new Error("could not find the start of the Pacific day");
}
