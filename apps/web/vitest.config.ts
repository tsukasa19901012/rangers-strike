import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@rangers-strike/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
      "@rangers-strike/cards/dsl/registry": path.resolve(
        __dirname,
        "../../packages/cards/src/dsl/registry.ts",
      ),
      "@rangers-strike/cards/dsl/types": path.resolve(
        __dirname,
        "../../packages/cards/src/dsl/types.ts",
      ),
      "@rangers-strike/cards/dsl/loader": path.resolve(
        __dirname,
        "../../packages/cards/src/dsl/loader.ts",
      ),
      "@rangers-strike/cards/pipeline/extractEffects": path.resolve(
        __dirname,
        "../../packages/cards/src/pipeline/extractEffects.ts",
      ),
      "@rangers-strike/cards/pipeline/hashGrantKeywords": path.resolve(
        __dirname,
        "../../packages/cards/src/pipeline/hashGrantKeywords.ts",
      ),
      "@rangers-strike/cards/pipeline/implementedGrantKeywords": path.resolve(
        __dirname,
        "../../packages/cards/src/pipeline/implementedGrantKeywords.ts",
      ),
      "@rangers-strike/cards/pipeline/rkClassify": path.resolve(
        __dirname,
        "../../packages/cards/src/pipeline/rkClassify.ts",
      ),
      "@rangers-strike/cards/pipeline": path.resolve(
        __dirname,
        "../../packages/cards/src/pipeline/index.ts",
      ),
      "@rangers-strike/cards/dsl": path.resolve(
        __dirname,
        "../../packages/cards/src/dsl/index.ts",
      ),
      "@rangers-strike/cards": path.resolve(__dirname, "../../packages/cards/src/index.ts"),
    },
  },
});
