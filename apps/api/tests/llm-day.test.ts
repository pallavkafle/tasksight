import { describe, expect, it } from "vitest";
import { pacificDayStart } from "../src/llm/day";

describe("pacificDayStart", () => {
  it("is 08:00 UTC in winter and 07:00 UTC in summer", () => {
    expect(pacificDayStart(Date.UTC(2026, 0, 15, 12)).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(pacificDayStart(Date.UTC(2026, 6, 15, 12)).toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("is correct on the days the clocks change", () => {
    expect(pacificDayStart(Date.UTC(2026, 2, 8, 20)).toISOString()).toBe(
      "2026-03-08T08:00:00.000Z",
    );
    expect(pacificDayStart(Date.UTC(2026, 10, 1, 20)).toISOString()).toBe(
      "2026-11-01T07:00:00.000Z",
    );
  });

  it("returns the previous Pacific day just after midnight UTC", () => {
    expect(pacificDayStart(Date.UTC(2026, 0, 15, 0, 30)).toISOString()).toBe(
      "2026-01-14T08:00:00.000Z",
    );
  });
});
