import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SET_HOOK_EXTRA_IDS, type SetHookGate } from "./setHookGates";

// 弾のフックのファイルが名指しする他の弾のカードは、SET_HOOK_EXTRA_IDS に無いと、そのカードだけの対局で探索中にフックが呼ばれない。
// （呼ばないことにしたフックが本当に何もしないかは、RS_HOOK_GATE_CHECK=1 でテスト全体を回して確かめる。packages/engine/README.md）
describe("setHookGates", () => {
  for (const gate of Object.keys(SET_HOOK_EXTRA_IDS) as SetHookGate[]) {
    it(`${gate}: rules/${gate.toLowerCase()} が名指しする他の弾のカードを含む`, () => {
      const dir = join(__dirname, gate.toLowerCase());
      const found = new Set<string>();
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
        for (const m of readFileSync(join(dir, file), "utf8").matchAll(/\b[A-Z]{1,5}[0-9]?-[0-9]{3}\b/g)) {
          if (!m[0].startsWith(`${gate}-`)) found.add(m[0]);
        }
      }
      expect([...found].filter((id) => !SET_HOOK_EXTRA_IDS[gate].includes(id))).toEqual([]);
    });
  }
});
