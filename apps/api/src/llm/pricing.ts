interface Price {
  inPer1M: number;
  outPer1M: number;
}

// USD per 1 million tokens, typed by the owner from Google's official price page.
// These are estimates at paid-tier prices (the free tier costs nothing).
// A model with no entry gives no estimate (null), never a fake 0.
// Last checked: not filled in yet.
export const PRICES: Record<string, Price> = {};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number | null {
  const price = Object.hasOwn(PRICES, model) ? PRICES[model] : undefined;
  if (!price) return null;
  return (tokensIn * price.inPer1M + tokensOut * price.outPer1M) / 1_000_000;
}
