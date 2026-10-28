/**
 * 「山札の上から…をオモテにしてもよい（見てもよい）」「次の効果を発動できる⇒山札の上から…」の効果は、発動するかを選ぶ前に
 * 山札のカードを見せない（rules/revealGate.ts）。ユーザー報告（2026-10-28）「XG7-042 で効果の発動を選ぶ前に山札の上のカードを
 * 見ることができてしまう」から、同じ形の本文のカードを全部確かめる。
 *
 * 見ること: 効果の最初の選択で見送れる（発動しないを選べる）のに、選択の候補・見ているカード（client-core viewedCardIds が出すもの）に
 * 山札のカードがあれば、発動の確認（revealGate）が付いていること。
 * 盤面は effectBoard.ts（ラッシュしたとき・出たとき・オペレーション・起動効果）と、NC（cardSpec の ncBoard）。
 * 山札全体から探す効果（「自軍山札を見て…」）は、探した後に山札をシャッフルするか、見ても選ばないことが発動の一部なので対象外。
 */
import { describe, expect, it } from "vitest";
import { getLegalActions } from "../core/legalActions";
import type { GameState } from "../types/game";
import { ncBoard } from "../cardSpec/XG7-001-023.helpers";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, type DriveResult } from "./effectBoard";

/** 「…てもよい。そうしたとき、山札の上から…」「発動できる⇒山札の上から…」「山札の上から…を見て（オモテにして）もよい」。 */
const OPTIONAL_TOP = /(発動できる⇒|てもよい。そうしたとき、|てもよい⇒)[^「」]{0,90}?山札の上から[^。]{0,6}枚(を見|をオモテ|見)|山札の上から[^。]{0,24}(を見て|オモテにして)もよい/;

/** client-core view/board.ts の VIEWED_META_KEYS と同じ（選択の付加情報のうち、見ている山札のカード）。 */
const VIEWED_META_KEYS = new Set(["top", "topId", "topInstanceId", "revealedId", "revealedInstanceIds", "picked", "remainingIds", "target", "ids"]);

/** 発動の確認が無いのに、見送れる最初の選択で山札のカードが見えていれば、その説明。 */
function leak(s: GameState | undefined, cardId: string): string | null {
  const c = s?.pendingEffectChoice;
  if (!s || !c || c.sourceCardId !== cardId || c.revealGate) return null;
  if (!getLegalActions(s).some((a) => a.type === "skip_effect_choice")) return null;
  const deck = new Set([...s.players.player1.deck, ...s.players.player2.deck].map((x) => x.instanceId));
  const ids: unknown[] = [...c.validInstanceIds, ...(c.viewedInstanceIds ?? [])];
  for (const [k, v] of Object.entries(c)) {
    if (!k.endsWith("Meta") || !v || typeof v !== "object") continue;
    for (const [f, x] of Object.entries(v)) if (VIEWED_META_KEYS.has(f)) ids.push(...(Array.isArray(x) ? x : [x]));
  }
  const shown = ids.filter((i): i is string => typeof i === "string" && deck.has(i));
  return shown.length > 0 ? `${c.effectId}: ${shown.join(",")}` : null;
}

const prompt = (o: DriveResult) => o.promptState;

/** NC（コンビネーション）の効果: 前に 0〜5 体並べて、そのカードの選択が出た盤面。 */
function ncPrompt(cardId: string): GameState | undefined {
  for (let n = 0; n < 6; n++) {
    try {
      const s = ncBoard(`${cardId}:x`, n);
      if (s.pendingEffectChoice?.sourceCardId === cardId) return s;
    } catch {
      // この並びでは出せない
    }
  }
  return undefined;
}

const targets = [...allFieldCards, ...allOperations].filter((d) => OPTIONAL_TOP.test((d.text ?? "").normalize("NFKC")));

describe("山札の上を見る任意の効果は、発動を選ぶ前に山札のカードを見せない", () => {
  it("対象のカードを読めている", () => {
    expect(targets.map((d) => d.id)).toEqual(expect.arrayContaining(["XG7-042", "XG7-001", "XG2-084", "XG1-077", "RS-063", "RS-066", "RS-257", "RS-353", "RK-030", "RK-274"]));
  });

  it("どのカードも、見送れる最初の選択で山札のカードが見えていない", async () => {
    const leaks: string[] = [];
    for (const [i, d] of targets.entries()) {
      if (i % 10 === 0) await new Promise((resolve) => setImmediate(resolve));
      const states: Array<[string, GameState | undefined]> =
        d.type === "operation"
          ? [["op", prompt(checkOperation(d, "first"))]]
          : [
              ["rush", prompt(checkOnRush(d, "first"))],
              ["enter", prompt(checkEnterBattle(d, "first"))],
              ["nc", ncPrompt(d.id)],
              ...checkActivations(d, "first").map((a): [string, GameState | undefined] => [a.where, prompt(a.outcome)]),
            ];
      for (const [where, s] of states) {
        const why = leak(s, d.id);
        if (why) leaks.push(`${d.id} ${d.name} (${where}) ${why}`);
      }
    }
    expect(leaks).toEqual([]);
  }, 120_000);
});
