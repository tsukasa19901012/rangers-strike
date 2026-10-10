/**
 * カード別スペック: RS-502〜RS-508（第7弾「七忍の炎陣」バット・リー〜ゴーオンレッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS504 獣人メレ）、grnrngr/faq-card-7
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_7.html。RS-504 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-BA-03・R-BA-04、R-CN-02・R-CN-04、R-ZONE-09、R-KW-RIDE-05 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  passEntry,
  pick,
  released,
  resolveAll,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RS7-495-515.helpers";
import type { CardInstance, GameState } from "../types/game";

function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

function enterSeq(s: GameState, ids: string[], playerId: "player1" | "player2" = "player1"): GameState {
  let next = s;
  for (const id of ids) next = passEntry(enter(passEntry(next, playerId), id, playerId), playerId);
  return next;
}

const BP6000 = sUnit("SPEC-6000", { bp: 6000 });

/** 「※これは自軍ターン中バトルエリアに出られない」の共通テスト。 */
function noOwnTurnEntryTests(id: string, page: string) {
  it(`${id}: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/${page}「※これは自軍ターン中バトルエリアに出られない」）`, () => {
    const s = st({ player1: { rush: [inst(id, "me")], deck: deckCards(3) } });
    expect(canEnter(s, `${id}:me`)).toBe(false);
  });

  // 既知の不具合: CARD-${id} 敵軍ターン中に効果で出すときも「自軍ターン中バトルエリアに出られない」が適用され、候補に出るのに出られない
  it.fails(`${id}: ※ 敵軍ターン中なら効果（敵軍デンジピンクの NC）でバトルエリアに出られる（出典: atwiki/${page}「自軍ターン中」・R-BA-03）`, () => {
    let s = enter(
      st({ activePlayer: "player2", player1: { rush: [inst(id, "me")], deck: deckCards(3) }, player2: { rush: [inst("RS-358", "d")], deck: deckCards(3, "e") } }),
      "RS-358:d",
      "player2",
    );
    expect(choiceIds(s)).toContain(`${id}:me`);
    s = pick(s, `${id}:me`);
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("battle");
  });
}

// ===========================================================================
describe("RS-502 バット・リー", () => {
  const TEXT =
    "※これは自軍ターン中バトルエリアに出られない。 【忘我の中に修行あり】これが自軍ラッシュエリアにある間、特徴「ブルー」を持つすべてのSユニットは次の能力を得る⇒これが撃破されて捨札になるとき、かわりに自分の手札からユニットカードを1枚選び捨札にしてもよい。そうしたとき、撃破されたユニットのBPと捨札にしたユニットカードのBPを合計して、その合計と同じBPを持つ敵軍ユニットを1体選び撃破する。";
  const BLUE = "RS-107"; // デカブルー（ブルー・BP3000）

  it("RS-502: カタログ本文・スペックが出典と一致（出典: atwiki/page-777）", () => {
    expectCatalogText("RS-502", TEXT);
    expectStats("RS-502", {
      name: "バット・リー",
      category: "WB",
      size: "S",
      bp: 5000,
      sp: undefined,
      powerCost: 1,
      features: ["男", "拳聖", "激気"],
    });
  });

  noOwnTurnEntryTests("RS-502", "page-777");

  /** 敵軍ターンに自軍デカブルー（BP3000）が BP13000 にアタックされて撃破される。手札に TST-UNIT-2（BP3000）。 */
  const blueDestroyed = (rushBatLee = true) =>
    attackedInEnemyTurn(
      { battle: [inst(BLUE, "b")], rush: rushBatLee ? [inst("RS-502", "bl")] : [], hand: [inst("TST-UNIT-2", "h"), inst("TST-OP", "op")] },
      `${BLUE}:b`,
      { rush: [inst("SPEC-6000", "t6"), inst("TST-UNIT-2", "t3")] },
    );

  // 既知の不具合: CARD-RS-502 【忘我の中に修行あり】が未実装（ブルーの S ユニットが能力を得ない）
  it.fails("RS-502: 【忘我の中に修行あり】ブルーの S ユニットが撃破されて捨札になるとき、かわりに手札のユニットカードを捨札にでき、BP の合計（3000+3000=6000）と同じ BP の敵軍ユニットを1体撃破する（出典: atwiki/page-777「かわりに自分の手札からユニットカードを1枚選び捨札にしてもよい。そうしたとき、…その合計と同じBPを持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = blueDestroyed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-502");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:h"]);
    s = resolveAll(pick(s, "TST-UNIT-2:h"), ["SPEC-6000:t6"]);
    expect(zoneOf(s, "player1", "TST-UNIT-2:h")).toBe("discard");
    expect(zoneOf(s, "player1", `${BLUE}:b`)).not.toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-6000:t6")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:t3")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-502 【忘我の中に修行あり】が未実装（選択が出ず、見送りも確認できない）
  it.fails("RS-502: 【忘我の中に修行あり】「捨札にしてもよい」— 見送れば撃破されたユニットはそのまま捨札になる（出典: atwiki/page-777）", () => {
    let s = blueDestroyed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-502");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", `${BLUE}:b`)).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-2:h")).toBe("hand");
  });

  it("RS-502: 【忘我の中に修行あり】バット・リーが自軍ラッシュエリアになければ、ブルーのユニットはそのまま捨札になる（出典: atwiki/page-777「これが自軍ラッシュエリアにある間」）", () => {
    const s = resolveAll(blueDestroyed(false));
    expect(zoneOf(s, "player1", `${BLUE}:b`)).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-2:h")).toBe("hand");
  });

  it("RS-502: 【忘我の中に修行あり】「ブルー」を持たない S ユニットは能力を得ない（そのまま捨札）（出典: atwiki/page-777「特徴「ブルー」を持つすべてのSユニット」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("TST-UNIT-0", "nb")], rush: [inst("RS-502", "bl")], hand: [inst("TST-UNIT-2", "h")] }, "TST-UNIT-0:nb", {
        rush: [inst("TST-UNIT-2", "t3")],
      }),
    );
    expect(zoneOf(s, "player1", "TST-UNIT-0:nb")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-2:h")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-503 シャッキー・チェン", () => {
  const TEXT =
    "※これは自軍ターン中バトルエリアに出られない。 【シャッキーン！の中に修行あり】これが自軍ラッシュエリアにある間、特徴「レッド」を持つすべてのSユニットは次の能力を得る⇒これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。";
  const RED = "RS-340"; // ゲキレッド（レッド・BP3000）

  it("RS-503: カタログ本文・スペックが出典と一致（出典: atwiki/page-778）", () => {
    expectCatalogText("RS-503", TEXT);
    expectStats("RS-503", {
      name: "シャッキー・チェン",
      category: "WB",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 1,
      features: ["男", "拳聖", "激気"],
    });
  });

  noOwnTurnEntryTests("RS-503", "page-778");

  /** 自軍 attacker が、BP+5000（本来 BP1000 → 6000）の敵軍 TST-UNIT-0 にアタックする。 */
  const attackBuffed = (attacker: string, shakky: "rush" | "discard" | "none") =>
    resolveAll(
      settle(
        attack(
          st({
            player1: {
              battle: [inst(attacker, "a")],
              rush: shakky === "rush" ? [inst("RS-503", "sc")] : [],
              discard: shakky === "discard" ? [inst("RS-503", "sc")] : [],
              deck: deckCards(3),
            },
            player2: { battle: [{ ...inst("TST-UNIT-0", "e"), bpModifier: 5000 }], deck: deckCards(3, "e") },
          }),
          `${attacker}:a`,
          "TST-UNIT-0:e",
        ),
      ),
    );

  // 既知の不具合: CARD-RS-503 【シャッキーン！の中に修行あり】が未実装（レッドの S ユニットが敵軍の本来の BP でバトルしない）
  it.fails("RS-503: 【シャッキーン！の中に修行あり】レッドの S ユニット（ゲキレッド BP3000）がアタックするとき、敵軍ユニットは本来の BP1000 でバトルし、ゲキレッドが勝つ（出典: atwiki/page-778「敵軍ユニットのBPをカードに表記された本来の値としてバトルする」）", () => {
    const s = attackBuffed(RED, "rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", `${RED}:a`)).toBe("battle");
  });

  it("RS-503: 【シャッキーン！の中に修行あり】シャッキー・チェンが自軍ラッシュエリアになければ（捨札）修正後の BP6000 でバトルして負ける（出典: atwiki/page-778「これが自軍ラッシュエリアにある間」）", () => {
    const s = attackBuffed(RED, "discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(zoneOf(s, "player1", `${RED}:a`)).toBe("discard");
  });

  it("RS-503: 【シャッキーン！の中に修行あり】「レッド」を持たない S ユニット（TST-UNIT-2 は M・特徴なし）は能力を得ない（出典: atwiki/page-778「特徴「レッド」を持つすべてのSユニット」）", () => {
    const s = attackBuffed("RS-107", "rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-503 【シャッキーン！の中に修行あり】が未実装（敵軍のレッドも能力を得る）
  it.fails("RS-503: 【シャッキーン！の中に修行あり】「すべてのSユニット」— 敵軍のレッド（ゲキレッド）も、自軍ユニットに本来の BP でバトルする（出典: atwiki/page-778）", () => {
    const s = resolveAll(
      settle(
        attack(
          st({
            activePlayer: "player2",
            player1: { battle: [{ ...inst("TST-UNIT-0", "d"), bpModifier: 5000 }], rush: [inst("RS-503", "sc")], deck: deckCards(3) },
            player2: { battle: [inst(RED, "a")], deck: deckCards(3, "e") },
          }),
          `${RED}:a`,
          "TST-UNIT-0:d",
          "player2",
        ),
      ),
    );
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-504 獣人メレ", () => {
  // 公式の読み替え後（R-ERR-RS504）。
  const TEXT =
    "【臨獣カメレオン拳】これが自軍エリアにある間、「獣人メレ」以外の自軍ユニットがバトルエリアに出たとき、次の効果から1つ選び発動できる⇒ ◎自軍コマンドゾーンからカードを1枚選び捨札にする。 ◎自軍コマンドゾーンにカードが1枚も無ければ、自軍捨札からカードを1枚選び、自軍コマンドゾーンにリリース状態で置く。";

  it("RS-504: カタログ本文（読み替え後）・スペックが出典と一致（出典: docs/rules/08-errata.md R-ERR-RS504・grnrngr/faq-card-7 RS-504・atwiki/page-820）", () => {
    expectCatalogText("RS-504", TEXT);
    expectStats("RS-504", {
      name: "獣人メレ",
      category: "DA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      features: ["女", "臨気"],
    });
  });

  const withMere = (p1: Partial<GameState["players"]["player1"]>, entering = "TST-UNIT-0:u") =>
    enter(st({ player1: { deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e") } }), entering);

  it("RS-504: 【臨獣カメレオン拳】自軍ユニットがバトルエリアに出たとき、◎ 自軍コマンドゾーンのカードを1枚選び捨札にできる（出典: R-ERR-RS504「◎自軍コマンドゾーンからカードを1枚選び捨札にする」）", () => {
    let s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("TST-UNIT-0", "u")], command: [released("TST-OP", "c0"), released("TST-OP", "c1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-504");
    expect(choiceIds(s)).toEqual(["TST-OP:c0", "TST-OP:c1"]);
    s = resolveAll(pick(s, "TST-OP:c1"));
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:c0")).toBe("command");
  });

  it("RS-504: 【臨獣カメレオン拳】「発動できる」— 見送れる（出典: R-ERR-RS504「次の効果から1つ選び発動できる」）", () => {
    let s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("TST-UNIT-0", "u")], command: [released("TST-OP", "c0")] });
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-OP:c0")).toBe("command");
  });

  it("RS-504: 【臨獣カメレオン拳】◎ 自軍コマンドゾーンにカードが1枚もなければ、自軍捨札のカードを1枚選び自軍コマンドゾーンにリリース状態で置ける（出典: R-ERR-RS504「自軍コマンドゾーンにカードが1枚も無ければ、自軍捨札からカードを1枚選び、自軍コマンドゾーンにリリース状態で置く」）", () => {
    let s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("TST-UNIT-0", "u")], command: [], discard: [inst("TST-OP", "d0"), inst("TST-UNIT-2", "d1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-504");
    expect(choiceIds(s)).toEqual(["TST-OP:d0", "TST-UNIT-2:d1"]);
    s = resolveAll(pick(s, "TST-UNIT-2:d1"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:d1")).toBe("command");
    expect(cardIn(s, "player1", "TST-UNIT-2:d1")?.commandHeld ?? false).toBe(false);
    expect(zoneOf(s, "player1", "TST-OP:d0")).toBe("discard");
  });

  it("RS-504: 【臨獣カメレオン拳】◎ 自軍コマンドゾーンにカードがあれば、捨札から置く効果は選べない（候補はコマンドだけ）（出典: R-ERR-RS504「…カードが1枚も無ければ」）", () => {
    const s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("TST-UNIT-0", "u")], command: [released("TST-OP", "c0")], discard: [inst("TST-OP", "d0")] });
    expect(choiceIds(s)).toEqual(["TST-OP:c0"]);
  });

  it("RS-504: 【臨獣カメレオン拳】「自軍エリア」— 獣人メレが自軍ラッシュエリアにあっても発動する（出典: R-ERR-RS504「これが自軍エリアにある間」）", () => {
    const s = withMere({ rush: [inst("RS-504", "m"), inst("TST-UNIT-0", "u")], command: [released("TST-OP", "c0")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-504");
  });

  it("RS-504: 【臨獣カメレオン拳】獣人メレ自身がバトルエリアに出たときは発動しない（出典: R-ERR-RS504「「獣人メレ」以外の自軍ユニット」）", () => {
    const s = withMere({ rush: [inst("RS-504", "m")], command: [released("TST-OP", "c0")] }, "RS-504:m");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-504: 【臨獣カメレオン拳】別の「獣人メレ」がバトルエリアに出ても発動しない（出典: R-ERR-RS504「「獣人メレ」以外」・grnrngr/faq-card-7 RS-504 Q「「メレ」…は「獣人メレ」のことを指しますか？」→「はい、そのとおりです」）", () => {
    const s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("RS-504", "m2")], command: [released("TST-OP", "c0")] }, "RS-504:m2");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-504: 【臨獣カメレオン拳】「メレ」は「獣人メレ」のこと — 名前に「メレ」を含む鳳凰メレがバトルエリアに出たときは発動する（出典: grnrngr/faq-card-7 RS-504 Q「はい、そのとおりです。…以下のように読み替えます」）", () => {
    const s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("RS-662", "ho")], command: [released("TST-OP", "c0")] }, "RS-662:ho");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-504");
  });

  it("RS-504: 【臨獣カメレオン拳】敵軍ユニットがバトルエリアに出ても発動しない（出典: R-ERR-RS504「自軍ユニットがバトルエリアに出たとき」）", () => {
    const s = enter(
      st({ activePlayer: "player2", player1: { battle: [inst("RS-504", "m")], command: [released("TST-OP", "c0")], deck: deckCards(3) }, player2: { rush: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }),
      "TST-UNIT-0:e",
      "player2",
    );
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-504: 【臨獣カメレオン拳】敵軍ターン中に自軍ユニットが効果でバトルエリアに出たときも発動する（ターンの限定なし）（出典: R-ERR-RS504「自軍ユニットがバトルエリアに出たとき」）", () => {
    const s = enterBattleByEffect(
      st({ activePlayer: "player2", player1: { battle: [inst("RS-504", "m")], rush: [inst("TST-UNIT-0", "u")], command: [released("TST-OP", "c0")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }),
      "player1",
      "TST-UNIT-0:u",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-504");
  });

  // 既知の不具合: CARD-RS-504 獣人メレが2体あっても【臨獣カメレオン拳】が1回しか発動しない（R-CONT-01 は同じ効果の重複を認める）
  it.fails("RS-504: 【臨獣カメレオン拳】獣人メレが2体あれば、それぞれの効果が発動し、コマンドを2枚捨札にできる（出典: R-ERR-RS504「これが自軍エリアにある間」・R-CONT-01）", () => {
    let s = withMere({ battle: [inst("RS-504", "m")], rush: [inst("RS-504", "m2"), inst("TST-UNIT-0", "u")], command: [released("TST-OP", "c0"), released("TST-OP", "c1")] });
    s = pick(s, "TST-OP:c0");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-504");
    s = resolveAll(pick(s, "TST-OP:c1"));
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("discard");
  });
});

// ===========================================================================
/** 炎神（RS-505〜RS-507）・ゴーオンレッドの「※これは毎ターン、可能ならバトルエリアに出る。」 */
function autoEntryTests(id: string, page: string) {
  it(`${id}: ※ 毎ターン、可能ならバトルエリアに出る — 自軍ラッシュエリアにある間はバトルフェイズを終えられない（出典: atwiki/${page}「※これは毎ターン、可能ならバトルエリアに出る」・R-BA-04）`, () => {
    const s = st({ player1: { rush: [inst(id, "me"), inst("TST-UNIT-0", "o")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(false);
    expect(canEnter(s, `${id}:me`)).toBe(true);
  });

  it(`${id}: ※ バトルエリアに出た後はバトルフェイズを終えられる（出典: atwiki/${page}・R-BA-01）`, () => {
    const s = passEntry(enter(st({ player1: { rush: [inst(id, "me")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }), `${id}:me`));
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(true);
  });
}

/** 炎神の「※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。」 */
function toPowerTests(id: string, page: string) {
  it(`${id}: ※ 敵軍ターン中に撃破されて捨札になったとき、自軍パワーゾーン（オモテ向き）に置ける（出典: atwiki/${page}「自軍パワーゾーンにおいてもよい」・R-ZONE-09）`, () => {
    let s = attackedInEnemyTurn({ battle: [inst(id, "me")], power: [] }, `${id}:me`);
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    s = resolveAll(pick(s, s.pendingEffectChoice!.validInstanceIds[0]!));
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("power");
    expect(cardIn(s, "player1", `${id}:me`)?.faceDown ?? false).toBe(false);
  });

  it(`${id}: ※ 「おいてもよい」— 見送れば捨札のまま（出典: atwiki/${page}）`, () => {
    let s = attackedInEnemyTurn({ battle: [inst(id, "me")], power: [] }, `${id}:me`);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("discard");
  });

  it(`${id}: ※ 自軍ターン中に撃破されたときはパワーゾーンに置けない（出典: atwiki/${page}「敵軍ターン中」）`, () => {
    const s = resolveAll(
      settle(
        attack(st({ player1: { battle: [inst(id, "me")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") } }), `${id}:me`, "TST-UNIT-7:big"),
      ),
    );
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("discard");
  });
}

/** n 番目に出す（先に TST-UNIT-0 を n-1 体並べる）。 */
function enterAt(id: string, pos: number, p2: Partial<GameState["players"]["player2"]> = {}, extra = [BP6000]) {
  return enter(
    st({ player1: { battle: fill(pos - 1), rush: [inst(id, "me")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...p2 } }, extra),
    `${id}:me`,
  );
}

describe("RS-505 スピードル", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【滑空突撃】「SP1」このターン、これは特徴「航空機」が追加される。";

  it("RS-505: カタログ本文・スペックが出典と一致（出典: atwiki/page-756）", () => {
    expectCatalogText("RS-505", TEXT);
    expectStats("RS-505", {
      name: "スピードル",
      category: "OT",
      size: "M",
      bp: 500,
      sp: "special",
      powerCost: 0,
      comboNumber: 4,
      features: ["車両", "炎神"],
    });
  });

  autoEntryTests("RS-505", "page-756");
  toPowerTests("RS-505", "page-756");

  it("RS-505: 【滑空突撃】4番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-756「【滑空突撃】「SP1」」）", () => {
    const s = enterAt("RS-505", 4);
    expect(spOf(s, "player1", "RS-505:me")).toBe(1);
    expect(canStrike(s, "RS-505:me")).toBe(true);
  });

  it("RS-505: 【滑空突撃】1番目に出たとき（NC 不成立）は SP がない（出典: atwiki/page-756・R-STK-02）", () => {
    expect(spOf(enterAt("RS-505", 1), "player1", "RS-505:me")).toBe(0);
  });

  // 既知の不具合: CARD-RS-505 【滑空突撃】の特徴「航空機」追加が未実装（ジェットファルコンにアタックできない）
  it.fails("RS-505: 【滑空突撃】このターン特徴「航空機」が追加され、「航空機を持たないユニットにアタックされない」ジェットファルコンにアタックできる（出典: atwiki/page-756「このターン、これは特徴「航空機」が追加される」）", () => {
    const s = enterAt("RS-505", 4, { battle: [inst("RS-135", "jf")] });
    expect(attackTargets(s, "RS-505:me")).toContain("RS-135:jf");
  });

  it("RS-505: 【滑空突撃】NC 不成立（1番目）なら「航空機」を持たず、ジェットファルコンにアタックできない（出典: atwiki/page-756・RS-135 本文）", () => {
    const s = enterAt("RS-505", 1, { battle: [inst("RS-135", "jf")] });
    expect(attackTargets(s, "RS-505:me")).not.toContain("RS-135:jf");
  });
});

describe("RS-506 バスオン", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【バスオンミサイル】次の相手ターン、敵軍ユニットはライドオフできない。";

  it("RS-506: カタログ本文・スペックが出典と一致（出典: atwiki/page-757）", () => {
    expectCatalogText("RS-506", TEXT);
    expectStats("RS-506", {
      name: "バスオン",
      category: "OT",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 5,
      features: ["車両", "炎神"],
    });
  });

  autoEntryTests("RS-506", "page-757");
  toPowerTests("RS-506", "page-757");

  /** バスオンを pos 番目に出してターンを終え、次の相手（player2）のバトルフェイズでライダーをビークルにライドさせて出す。 */
  const enemyRideNextTurn = (pos: number) => {
    let s = st({
      turn: 3,
      player1: { battle: fill(pos - 1), rush: [inst("RS-506", "b")], deck: deckCards(5) },
      player2: { rush: [inst("RK-031", "r"), inst("RK-058", "z")], deck: deckCards(5, "e") },
    });
    s = passEntry(enter(s, "RS-506:b"));
    s = toPhase(s, "player2", "battle");
    return settle(act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-031:r", vehicleInstanceId: "RK-058:z" }));
  };
  const canRideOff = (s: GameState) =>
    legal(s).some((a) => a.type === "resolve_ride_off_choice" && (a as { rideOff?: boolean }).rideOff === true);

  // 既知の不具合: CARD-RS-506 【バスオンミサイル】が未実装（次の相手ターンにライドオフできる）
  it.fails("RS-506: 【バスオンミサイル】5番目に出て NC が成立すると、次の相手ターン、敵軍ユニットはライドオフできない（出典: atwiki/page-757「次の相手ターン、敵軍ユニットはライドオフできない」）", () => {
    expect(canRideOff(enemyRideNextTurn(5))).toBe(false);
  });

  it("RS-506: 【バスオンミサイル】NC 不成立（1番目）なら次の相手ターンもライドオフできる（出典: atwiki/page-757・R-KW-RIDE-05）", () => {
    expect(canRideOff(enemyRideNextTurn(1))).toBe(true);
  });
});

describe("RS-507 ベアールV", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【噛みつき】「SP1」";

  it("RS-507: カタログ本文・スペックが出典と一致（出典: atwiki/page-759）", () => {
    expectCatalogText("RS-507", TEXT);
    expectStats("RS-507", {
      name: "ベアールV",
      category: "OT",
      size: "M",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 4,
      features: ["車両", "炎神"],
    });
  });

  autoEntryTests("RS-507", "page-759");
  toPowerTests("RS-507", "page-759");

  it("RS-507: 【噛みつき】4番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-759「【噛みつき】「SP1」」）", () => {
    const s = enterAt("RS-507", 4);
    expect(spOf(s, "player1", "RS-507:me")).toBe(1);
    expect(canStrike(s, "RS-507:me")).toBe(true);
  });

  it("RS-507: 【噛みつき】3番目に出たとき（NC 不成立）は SP がない（出典: atwiki/page-759・R-STK-02）", () => {
    expect(spOf(enterAt("RS-507", 3), "player1", "RS-507:me")).toBe(0);
  });
});

// ===========================================================================
describe("RS-508 ゴーオンレッド", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※これはアタックすることができない。 【ロードサーベル】「SP1」敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、このユニットと選んだユニットでバトルする。";

  it("RS-508: カタログ本文・スペックが出典と一致（出典: atwiki/page-740）", () => {
    expectCatalogText("RS-508", TEXT);
    expectStats("RS-508", {
      name: "ゴーオンレッド",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 1,
      comboNumber: 4,
      features: ["レッド", "男"],
    });
  });

  autoEntryTests("RS-508", "page-740");

  it("RS-508: ※ アタックすることができない（敵軍ユニットがいてもアタック先がない）（出典: atwiki/page-740「※これはアタックすることができない」）", () => {
    const s = enterAt("RS-508", 1, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(attackTargets(s, "RS-508:me")).toEqual([]);
  });

  it("RS-508: 【ロードサーベル】4番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-740「【ロードサーベル】「SP1」」）", () => {
    expect(spOf(enterAt("RS-508", 4), "player1", "RS-508:me")).toBe(1);
  });

  // 既知の不具合: CARD-RS-508 「SP1」になってもストライクできない（※アタック不可がストライクまで禁じている）
  it.fails("RS-508: 【ロードサーベル】「SP1」になればストライクできる（禁止されているのはアタックだけ）（出典: atwiki/page-740「※これはアタックすることができない」・atwiki/page-740 カード評価「ストライクも同時にすることが可能」）", () => {
    expect(canStrike(enterAt("RS-508", 4), "RS-508:me")).toBe(true);
  });

  // 既知の不具合: CARD-RS-508 【ロードサーベル】の「敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき…バトルする」が未実装
  it.fails("RS-508: 【ロードサーベル】敵軍バトルエリアのユニットを1体選び、このユニットとバトルする（BP4000 対 BP1000 で選んだユニットを撃破）（出典: atwiki/page-740「敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、このユニットと選んだユニットでバトルする」）", () => {
    let s = enterAt("RS-508", 4, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "er")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-508");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-508:me")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-508 【ロードサーベル】の選択が出ないため、BP の高いユニットとのバトルで負けることも確認できない
  it.fails("RS-508: 【ロードサーベル】BP6000 のユニットを選んでバトルすると、ゴーオンレッドが撃破される（出典: atwiki/page-740「このユニットと選んだユニットでバトルする」・R-BTL-01）", () => {
    let s = enterAt("RS-508", 4, { battle: [inst("SPEC-6000", "e6")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-508");
    s = resolveAll(pick(s, "SPEC-6000:e6"));
    expect(zoneOf(s, "player1", "RS-508:me")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-6000:e6")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-508 【ロードサーベル】の選択が出ないため、見送りを確認できない
  it.fails("RS-508: 【ロードサーベル】「選んでもよい」— 見送れる（出典: atwiki/page-740）", () => {
    let s = enterAt("RS-508", 4, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-508");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-508: 【ロードサーベル】1番目に出たとき（NC 不成立）はバトルの選択も SP もない（出典: atwiki/page-740・R-CN-02）", () => {
    const s = enterAt("RS-508", 1, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(spOf(s, "player1", "RS-508:me")).toBe(0);
  });
});


