import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/*/test/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
  },
});
