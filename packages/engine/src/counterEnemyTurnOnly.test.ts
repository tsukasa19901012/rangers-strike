/**
 * ルール: R-CTR-01 — ※カウンターは敵軍ターン中にのみ使用できる（atwiki/page-1295 規定文
 * 「これは敵軍ターン中にのみ使用できる」）。カード本文で注釈が省略されているもの（XG7-027 雷撃ディスク等）も同じ。
 */
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { isCounterOperation } from "./core/catalog";
import { explainOperationPlayBlock } from "./rules/operationProcedure";
import { cardDef, specState } from "./cardSpec/RS1-001-023.helpers";

const COUNTER_CARD_IDS = fullPlayableCatalog.cards
  .filter(
    (c) =>
      c.type === "operation" &&
      (/※カウンター/.test(c.text ?? "") || (c.tags ?? []).includes("カウンター")),
  )
  .map((c) => c.id);

describe("R-CTR-01 ※カウンターは敵軍ターン中にのみ使用できる（出典: atwiki/page-1295）", () => {
  it("カタログに ※カウンター のカードがある（注釈を省略した XG7-027 を含む）", () => {
    expect(COUNTER_CARD_IDS).toContain("XG7-027");
    expect(COUNTER_CARD_IDS.length).toBeGreaterThan(10);
  });

  it.each(COUNTER_CARD_IDS)("%s はカウンターとして扱われ、自軍ターンには使えない", (id) => {
    const def = cardDef(id);
    expect(def, id).toBeDefined();
    expect(isCounterOperation(def)).toBe(true);
    for (const phase of ["rush", "battle"] as const) {
      const s = specState([id], { phase, activePlayer: "player1" });
      expect(explainOperationPlayBlock(s, "player1", id)).toBe("counter_in_own_turn");
    }
  });
});
