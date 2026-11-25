/**
 * カードの「Sユニット」「Mユニット」「Lユニット」はユニットだけで、同じ大きさのビークルは含まない。
 * 報告（2026-11-25）: RK-058 マシンゼクトロン（Sビークル）で RK-147 デンライナーイスルギの追加条件を満たせた（rules/zordSVehicle.test.ts）。
 * 同じ判定（大きさだけを見る）は追加条件以外の効果にもあったので、共通の判定と、大きさを直接比べている箇所をまとめて直した。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { isLargeUnit, isMediumUnit, isSmallUnit, unitOnlySize, unitSizeOf } from "../core/catalog";
import { st } from "../cardSpec/RK1-001-021.helpers";
import { inst } from "../testing/fixtures";
import { applyVrvMasterOnRush } from "./legend1/set5NamedEffectsA";

describe("S/M/L ユニットの判定にビークルを含めない", () => {
  it("全カード: ビークルは isSmallUnit / isMediumUnit / isLargeUnit にならず、ユニットは大きさどおり", () => {
    const s = st();
    const cards = Object.values(s.definitions).filter((d) => d.size && (d.type === "unit" || d.type === "vehicle"));
    const vehicles = cards.filter((d) => d.type === "vehicle");
    expect(vehicles.length).toBeGreaterThan(50);
    const wrong: string[] = [];
    for (const d of cards) {
      const c = inst(d.id, "x");
      const isV = d.type === "vehicle";
      const got = [isSmallUnit(s.definitions, c), isMediumUnit(s.definitions, c), isLargeUnit(s.definitions, c)];
      const want = isV ? [false, false, false] : [d.size === "S", d.size === "M", d.size === "L"];
      if (got.some((g, i) => g !== want[i])) wrong.push(`${d.id}:${d.type}:${d.size}`);
      if (unitOnlySize(s.definitions, c) !== (isV ? undefined : d.size)) wrong.push(`${d.id}:unitOnlySize`);
      // Sビークル等を含める判定（SX-006「SユニットとSビークル」）のための unitSizeOf は大きさを返したまま。
      if (unitSizeOf(s.definitions, c) !== d.size) wrong.push(`${d.id}:unitSizeOf`);
    }
    expect(wrong).toEqual([]);
  });

  it("RS-299 VRVマスター【乗ってみないか？】: Sビークル（RK-058）のラッシュでは山札をオモテにしない／Sユニットなら する", () => {
    const board = (rushed: string) =>
      st({
        phase: "rush",
        player1: { rush: [inst("RS-299", "vrv"), inst(rushed, "r")], deck: [inst("TST-OP", "top")] },
      });
    const vehicle = board("RK-058");
    expect(applyVrvMasterOnRush(vehicle, "player1", "RK-058:r")).toBe(vehicle);
    const unit = board("TST-UNIT-0");
    expect(applyVrvMasterOnRush(unit, "player1", "TST-UNIT-0:r")).not.toBe(unit);
  });

  /**
   * 大きさを直接比べる書き方（`unitSizeOf(..) === "S"`・`def.size === "S"` など）はビークルを含めてしまう。
   * 新しく書くときは isSmallUnit 等か unitOnlySize を使う。ビークルも含めるのが正しい箇所・大きさを計算する関数だけここに載せる。
   */
  const ALLOWED = [
    "keywords/ride.ts", // ライドするユニット（ライダー）の大きさ
    "rules/legend1/set6NamedEffectsB.ts", // 大きさの計算（zubaanIsLarge 等）
    "rules/legend1/set7NamedEffectsB.ts", // 大きさの計算
    "rules/jointComboProcedure.ts", // ジョイントコンボの並びの L
  ];
  const UNIT_ONLY_SIZE_HELPERS = ["rules/xg6/xg6Fields.ts", "rules/xg4/xg4bEffects.ts"];
  it("ソース: 大きさを直接比べる箇所は、ユニットかビークルかを同じ所で見ている", () => {
    const root = join(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (!["cardSpec", "sweep", "testing", "rulesSpec"].includes(name)) walk(p);
        } else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) files.push(p);
      }
    };
    walk(root);
    const direct = /(?:\bsize|[sS]ize\w*\([^)]*\)\)?) [!=]== "[SML]"/;
    const typed = /type [!=]== "unit"|isUnit\w*\(|"vehicle"|ビークル|isVehicle|unitOnlySize/;
    const found: string[] = [];
    for (const p of files) {
      const rel = relative(root, p).replace(/\\/g, "/");
      if (ALLOWED.some((a) => a === rel)) continue;
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!direct.test(line)) return;
        if (/unitOnlySize\(/.test(line)) return;
        // ビークルを除いた大きさを返す局所の関数（xg6Fields の sizeOf・xg4bEffects の sizeNow）。
        if (UNIT_ONLY_SIZE_HELPERS.includes(rel) && /\b(sizeOf|sizeNow)\(/.test(line)) return;
        const ctx = lines.slice(Math.max(0, i - 6), i + 3).join("\n");
        if (typed.test(ctx)) return;
        found.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(found).toEqual([]);
  });
});
