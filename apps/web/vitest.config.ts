import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@rangers-strike/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
      "@rangers-strike/cards": path.resolve(__dirname, "../../packages/cards/src/index.ts"),
    },
  },
});
