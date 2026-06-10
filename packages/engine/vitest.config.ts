import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@rangers-strike/cards": path.resolve(__dirname, "../cards/src/index.ts"),
      "@rangers-strike/cards/pipeline": path.resolve(
        __dirname,
        "../cards/src/pipeline/index.ts",
      ),
      "@rangers-strike/cards/dsl/types": path.resolve(
        __dirname,
        "../cards/src/dsl/types.ts",
      ),
    },
  },
  test: {
    environment: "node",
  },
});
