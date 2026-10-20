import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run the real engine from TypeScript sources (same aliases as
// packages/engine/vitest.config.ts); the core itself only imports engine types.
const cards = (p: string) => path.resolve(__dirname, "../cards/src", p);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@rangers-strike\/engine$/, replacement: path.resolve(__dirname, "../engine/src/index.ts") },
      { find: /^@rangers-strike\/cards\/dsl\/registry$/, replacement: cards("dsl/registry.ts") },
      { find: /^@rangers-strike\/cards\/dsl\/loader$/, replacement: cards("dsl/loader.ts") },
      { find: /^@rangers-strike\/cards\/dsl\/types$/, replacement: cards("dsl/types.ts") },
      { find: /^@rangers-strike\/cards\/dsl$/, replacement: cards("dsl/index.ts") },
      { find: /^@rangers-strike\/cards\/pipeline\/extractEffects$/, replacement: cards("pipeline/extractEffects.ts") },
      { find: /^@rangers-strike\/cards\/pipeline\/hashGrantKeywords$/, replacement: cards("pipeline/hashGrantKeywords.ts") },
      { find: /^@rangers-strike\/cards\/pipeline\/implementedGrantKeywords$/, replacement: cards("pipeline/implementedGrantKeywords.ts") },
      { find: /^@rangers-strike\/cards\/pipeline\/rkClassify$/, replacement: cards("pipeline/rkClassify.ts") },
      { find: /^@rangers-strike\/cards\/pipeline$/, replacement: cards("pipeline/index.ts") },
      { find: /^@rangers-strike\/cards$/, replacement: cards("index.ts") },
    ],
  },
  test: {
    environment: "node",
    testTimeout: 60_000,
  },
});
