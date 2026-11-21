/**
 * 「山札から（山札を見て）…を1枚選び、相手に見せてから手札に加える」効果は、選んだカードを公開してから手札に加える。
 * ユーザー報告（2026-11-21）「デネブの効果でデッキからオペレーションカードを選択する場合、選択したカードを互いに公開していない」
 * から、本文にこの文言があるカードを全部確かめる。
 *
 * 見せ方は公開の記録（GameState.lastReveal。client-core の公開の窓、対人戦の viewFor の revealedCards）。選ぶ窓は選ぶ本人にしか
 * 見えないので、選ぶ窓では見せたことにならない。
 * 見ること: 効果で選ぶ本人の山札から手札に加わったカードが、すべて公開の記録にあること。
 * 盤面は effectBoard.ts（ラッシュしたとき・出たとき・オペレーション・起動効果。候補の最初を選ぶ）。撃破したとき・戻るとき・
 * 常駐などから起きる効果は、それぞれの cardSpec の盤面で確かめる（rules/deckSearchReveal.ts の一覧）。
 */
import { describe, expect, it } from "vitest";
import { DECK_SEARCH_REVEALS, OPEN_SHOW_REVEALS, PICK_SHOW_REVEALS } from "../rules/deckSearchReveal";
import { visibleInstanceIds } from "../view/viewFor";
import { revealNotices } from "../rules/revealNotice";
import type { GameState, PlayerId } from "../types/game";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, type DriveResult } from "./effectBoard";

const SHOW = /山札(から|を見て|を見てもよい。そうしたとき、その中から|を見て、)[^。]*?選び、相手に見せてから(自分の)?手札に加え/;
const targets = [...allFieldCards, ...allOperations].filter((d) => SHOW.test((d.text ?? "").normalize("NFKC")));

/** カード自身の処理で公開を記録しているもの（rules/deckSearchReveal.ts の一覧に載せない）。 */
const SELF_RECORDED = ["XG7-009", "XG7-045", "XP-015"];

function noticesSince(start: GameState, end: GameState): Set<string> {
  const from = start.lastReveal?.seq ?? 0;
  return new Set(revealNotices(end).filter((n) => n.seq > from).flatMap((n) => n.cards.map((c) => c.instanceId)));
}

/** 山札から手札に加わったカード（お互い）。 */
function deckToHand(start: GameState, end: GameState): string[] {
  return (["player1", "player2"] as PlayerId[]).flatMap((p) => {
    const deck = new Set(start.players[p].deck.map((c) => c.instanceId));
    const hand = new Set(start.players[p].hand.map((c) => c.instanceId));
    return end.players[p].hand.filter((c) => deck.has(c.instanceId) && !hand.has(c.instanceId)).map((c) => c.instanceId);
  });
}

function runs(cardId: string): Array<{ where: string; o: DriveResult }> {
  const d = targets.find((x) => x.id === cardId)!;
  if (d.type === "operation") return [{ where: "op", o: checkOperation(d, "first") }];
  return [
    { where: "rush", o: checkOnRush(d, "first") },
    { where: "enter", o: checkEnterBattle(d, "first") },
    ...checkActivations(d, "first").map((a) => ({ where: `act ${a.where}`, o: a.outcome })),
  ];
}

describe("山札から選び、相手に見せてから手札に加える効果は、選んだカードを公開する", () => {
  it("対象のカードはすべて公開の一覧（rules/deckSearchReveal.ts）か、自身で記録するカードに載っている", () => {
    const ids = targets.map((d) => d.id).sort();
    expect(ids).toEqual(expect.arrayContaining(["RK-146", "RS-349", "BK-001", "RM-010", "XG5-094"]));
    const missing = ids.filter((id) => !(id in DECK_SEARCH_REVEALS) && !SELF_RECORDED.includes(id));
    expect(missing).toEqual([]);
    expect(ids).toEqual(Object.keys({ ...DECK_SEARCH_REVEALS, ...Object.fromEntries(SELF_RECORDED.map((id) => [id, 1])) }).sort());
  });

  it("効果で山札から手札に加わったカードは、公開の記録にある", async () => {
    const hidden: string[] = [];
    const checked = new Set<string>();
    for (const [i, d] of targets.entries()) {
      if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
      for (const { where, o } of runs(d.id)) {
        if (!o.start || !o.state) continue;
        const moved = deckToHand(o.start, o.state);
        if (moved.length === 0) continue;
        checked.add(d.id);
        const shown = noticesSince(o.start, o.state);
        const unseen = moved.filter((id) => !shown.has(id));
        if (unseen.length > 0) hidden.push(`${d.id} ${d.name} (${where}): ${unseen.join(",")}`);
      }
    }
    expect(hidden).toEqual([]);
    expect([...checked]).toEqual(expect.arrayContaining(["RK-146", "RS-349", "RS-439"]));
  }, 300_000);
});

/**
 * 2026-11-22 総点検: 「自分の手札から…選び、相手に見せる」カードは、選び終えたカードを公開する。一覧（PICK_SHOW_REVEALS）に
 * 載せるか、カード自身の処理で記録する・見せる窓を相手にも出す・見せたカードが場に出るカードとして下に載せる。
 */
const HAND_SHOW = /手札(から|を)[^。]*?(選び|選ばせ)、?(相手に)?見せ|手札をすべて相手に見せ/;
const HAND_SHOW_ELSEWHERE: Record<string, string> = {
  "RK-080": "重ねたカードは常駐置き場でオモテ（公開）",
  "RK-082": "重ねたカードは常駐置き場でオモテ（公開）",
  "RS-013": "シロンの光の窓を相手にも出す（rules/shironLight.ts）",
  "RS-365": "rules/empireDominion.ts で手札すべてを記録",
  "SR-006": "見せたカードは効果の対象として場に出る",
  "XG2-059": "rules/xg2/xg2cEffects.ts で手札すべてを記録",
  "XG3-100": "見せた2枚はラッシュエリアに出る",
  "XG6-002": "rules/xg6/xg6aEffects.ts で記録",
  "XG6-003": "rules/xg6/xg6aEffects.ts で記録",
  "XG6-050": "rules/xg6/xg6cEffects.ts で記録",
  "XP-006": "rules/promo/xpEffects.ts で記録",
  "XP-027": "rules/promo/xp2Effects.ts で記録",
};

describe("手札から選んで相手に見せる効果・山札の上をオモテにしてから選ぶ効果は、相手にも見せる", () => {
  it("「手札から…選び、相手に見せる」カードは、すべて公開の一覧か、ほかの見せ方に載っている", () => {
    const ids = [...allFieldCards, ...allOperations].filter((d) => HAND_SHOW.test((d.text ?? "").normalize("NFKC"))).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["RK-125", "XG1-059", "XG7-038", "RS-462"]));
    expect(ids.filter((id) => !(id in PICK_SHOW_REVEALS) && !(id in HAND_SHOW_ELSEWHERE))).toEqual([]);
  });

  it("山札の上をオモテにしてから選ぶ・並べる窓は、窓に出ている山札のカードを両プレイヤーに見せている", async () => {
    const hidden: string[] = [];
    const opened = new Set<string>();
    const defs = [...allFieldCards, ...allOperations].filter((d) => OPEN_SHOW_REVEALS.has(d.id));
    for (const [i, d] of defs.entries()) {
      if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
      // 1 枚ずつ続けてオモテにする効果（RS-353）は公開の記録が古いものから押し出されるので、効果の間に一度でも見えたかで見る。
      const shownAll = new Set<string>();
      const seenBy: Record<PlayerId, Set<string>> = { player1: new Set(), player2: new Set() };
      const see = (s: GameState) => {
        const c = s.pendingEffectChoice;
        if (!c || c.sourceCardId !== d.id || c.revealGate) return;
        const deckIds = new Set((["player1", "player2"] as PlayerId[]).flatMap((p) => s.players[p].deck.map((x) => x.instanceId)));
        const shown = [...c.validInstanceIds, ...(c.viewedInstanceIds ?? [])].filter((id) => deckIds.has(id));
        if (shown.length === 0) return;
        opened.add(d.id);
        shown.forEach((id) => shownAll.add(id));
        for (const p of ["player1", "player2"] as PlayerId[]) visibleInstanceIds(s, p, []).forEach((id) => seenBy[p].add(id));
      };
      if (d.type === "operation") checkOperation(d, "first", undefined, undefined, { see });
      else {
        checkOnRush(d, "first", undefined, undefined, { see });
        checkEnterBattle(d, "first", undefined, undefined, { see });
        checkActivations(d, "first", undefined, () => ({ see }));
      }
      for (const p of ["player1", "player2"] as PlayerId[]) for (const id of shownAll) if (!seenBy[p].has(id)) hidden.push(`${d.id} ${d.name}: ${id} → ${p}`);
    }
    expect(hidden).toEqual([]);
    expect([...opened]).toEqual(expect.arrayContaining(["RS-353"]));
  }, 300_000);
});
