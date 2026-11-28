import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      JWT_ACCESS_SECRET: "test-access-secret",

      MONGODB_URI: "mongodb://placeholder-for-env-check",
      RATE_LIMIT_ENABLED: "true",
      AUTH_RATE_LIMIT_MAX: "100",
      AUTH_RATE_LIMIT_WINDOW_MS: "900000",
      AUTH_BRUTE_LIMIT_MAX: "20",
      AUTH_BRUTE_LIMIT_WINDOW_MS: "900000",
    },
  },
});
