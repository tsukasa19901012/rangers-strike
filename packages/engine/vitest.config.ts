import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@rangers-strike/cards": path.resolve(__dirname, "../cards/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
