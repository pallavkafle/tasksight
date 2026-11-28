import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const apiSrc = join(here, "..", "src");
const sharedSrc = join(here, "..", "..", "..", "packages", "shared", "src");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

const outsideLlm = [
  ...walk(apiSrc).filter((f) => !relative(apiSrc, f).startsWith(`llm${sep}`)),
  ...walk(sharedSrc),
];

describe("only src/llm talks to the AI provider", () => {
  it("finds files to scan", () => {
    expect(outsideLlm.length).toBeGreaterThan(10);
  });

  it("no code outside src/llm names the provider host, SDK or key header", () => {
    const banned = [
      "generativelanguage.googleapis.com",
      "@google/genai",
      "@google/generative-ai",
      "x-goog-api-key",
    ];
    const offenders = outsideLlm.filter((f) => {
      const text = readFileSync(f, "utf8");
      return banned.some((b) => text.includes(b));
    });
    expect(offenders.map((f) => relative(apiSrc, f))).toEqual([]);
  });

  it("the API key is only read in config/env.ts and src/llm", () => {
    const offenders = outsideLlm
      .filter((f) => readFileSync(f, "utf8").includes("GEMINI_API_KEY"))
      .map((f) => relative(apiSrc, f));
    expect(offenders).toEqual([`config${sep}env.ts`]);
  });
});
