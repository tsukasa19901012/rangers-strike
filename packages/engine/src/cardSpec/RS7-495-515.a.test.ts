/**
 * カード別スペック: RS-495〜RS-501（第7弾「七忍の炎陣」重力忍者オモ・カル〜エレハン・キンポー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-495〜RS-501 は該当なし）、grnrngr/faq-card-7
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_7.html。RS-495 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）。
 *     RS-497 の Q&A（Q1・Q2）は atwiki/page-819 の転載（公式ページの取得分に該当 Q なし）。
 *  3. docs/rules/*.md の一般ルール（R-CN-01〜R-CN-04、R-KW-RESIST-01〜05、R-BA-01〜04 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { resolvePlayableCard } from "@rangers-strike/cards";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  norm,
  reanimateTests,
  zordDownTests,
} from "./RS7-495-515.helpers";
import type { CardInstance, GameState } from "../types/game";

/** 自軍バトルフェイズに、ids を順にバトルエリアへ出す（各進入後の行動ウィンドウはパス）。 */
function enterSeq(s: GameState, ids: string[], playerId: "player1" | "player2" = "player1"): GameState {
  let next = s;
  for (const id of ids) next = passEntry(enter(passEntry(next, playerId), id, playerId), playerId);
  return next;
}

/** TST-UNIT-0（CN なし・SP1）を n 体。 */
function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

const FEMALE = sUnit("SPEC-FEMALE", { bp: 1000, features: ["女"] });
const MALE = sUnit("SPEC-MALE", { bp: 1000, features: ["男"] });
const BP7000 = sUnit("SPEC-7000", { bp: 7000 });
const SWAT = sUnit("SPEC-SWAT", { bp: 4500, features: ["スワット"] });

// ===========================================================================
describe("RS-495 重力忍者オモ・カル", () => {
  const TEXT =
    "【宇宙忍法・重力無秩序】これが自軍エリアにある間、SPが空欄で、ナンバーに数字を持つすべてのユニットは、次の効果を受ける⇒そのユニットのナンバーの数字は、そのユニットの必要パワーの数字になる。（ナンバー0になったユニットは、ＮＣ効果を発動できない）";
  const GAO = "RS-163"; // ガオブラック（SP 空欄・CN4・必要パワー1。NC【アイアンブロークン】自軍ターン中 BP+3000）
  const DENJI_PINK = "RS-358"; // デンジピンク（SP 空欄・CN1・必要パワー0。NC で相手がラッシュエリアの S ユニットを出す）
  const CHEETAH = "RS-424"; // ゲキチーター（SP「！」・CN2・必要パワー0+）

  it("RS-495: カタログ本文・スペックが出典と一致（出典: atwiki/page-818）", () => {
    expectCatalogText("RS-495", TEXT);
    expectStats("RS-495", {
      name: "重力忍者オモ・カル",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      features: ["怪人", "男", "忍者"],
    });
  });

  it("RS-495: 対照 — オモ・カルがいなければ、CN4 のガオブラックは1番目に出ても NC が成立しない（BP3000）（出典: R-CN-02）", () => {
    const s = enterSeq(st({ player1: { rush: [inst(GAO, "g")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(3000);
  });

  // 既知の不具合: CARD-RS-495 【宇宙忍法・重力無秩序】が未実装（ナンバーが必要パワーの数字にならない）
  it.fails("RS-495: 【宇宙忍法・重力無秩序】自軍ラッシュエリアにある間、SP 空欄のガオブラック（必要パワー1）はナンバー1になり、1番目に出ると NC（BP+3000）が成立する（出典: atwiki/page-818「そのユニットのナンバーの数字は、そのユニットの必要パワーの数字になる」）", () => {
    const s = enterSeq(st({ player1: { rush: [inst(GAO, "g"), inst("RS-495", "o")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(6000);
  });

  // 既知の不具合: CARD-RS-495 【宇宙忍法・重力無秩序】が未実装（本来の CN4 のまま4番目で NC が成立する）
  it.fails("RS-495: 【宇宙忍法・重力無秩序】ナンバーが1になったガオブラックは4番目に出ても NC が成立しない（出典: atwiki/page-818）", () => {
    const s = enterSeq(st({ player1: { battle: fill(3), rush: [inst(GAO, "g"), inst("RS-495", "o")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(3000);
  });

  // 既知の不具合: CARD-RS-495 【宇宙忍法・重力無秩序】が未実装（自軍バトルエリアにある場合も効果がない）
  it.fails("RS-495: 【宇宙忍法・重力無秩序】「自軍エリア」— 自軍バトルエリアにあっても有効で、ナンバー1になったガオブラックは4番目で NC が成立しない（出典: atwiki/page-818「これが自軍エリアにある間」）", () => {
    // オモ・カルを1番目に置き、ガオブラックを4番目に出す。ナンバーは1になるので NC は成立しない。
    const s = enterSeq(st({ player1: { battle: [inst("RS-495", "o"), ...fill(2)], rush: [inst(GAO, "g")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(3000);
  });

  it("RS-495: 【宇宙忍法・重力無秩序】オモ・カルが自軍エリアになければ（捨札）効果はなく、ガオブラックは4番目で NC が成立する（出典: atwiki/page-818「これが自軍エリアにある間」）", () => {
    const s = enterSeq(st({ player1: { battle: fill(3), rush: [inst(GAO, "g")], discard: [inst("RS-495", "o")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(6000);
  });

  it("RS-495: 対照 — オモ・カルがいなければ、CN1 のデンジピンクは1番目で NC が成立し、相手が S ユニットを選ぶ（出典: R-CN-02）", () => {
    const s = enterSeq(
      st({ player1: { rush: [inst(DENJI_PINK, "d")], deck: deckCards(3) }, player2: { rush: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }),
      [`${DENJI_PINK}:d`],
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe(DENJI_PINK);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
  });

  // 既知の不具合: CARD-RS-495 【宇宙忍法・重力無秩序】が未実装（必要パワー0のユニットがナンバー0にならず NC が発動する）
  it.fails("RS-495: 【宇宙忍法・重力無秩序】必要パワー0のデンジピンクはナンバー0になり、NC 効果を発動できない（出典: atwiki/page-818「（ナンバー0になったユニットは、ＮＣ効果を発動できない）」・R-CN-01）", () => {
    const s = enterSeq(
      st({ player1: { rush: [inst(DENJI_PINK, "d"), inst("RS-495", "o")], deck: deckCards(3) }, player2: { rush: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }),
      [`${DENJI_PINK}:d`],
    );
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("rush");
  });

  it("RS-495: 【宇宙忍法・重力無秩序】SP が空欄でない（SP「！」）ゲキチーターは対象外で、本来の CN2 のまま2番目で NC（SP1）が成立する（出典: atwiki/page-818「SPが空欄で」）", () => {
    const s = enterSeq(st({ player1: { battle: fill(1), rush: [inst(CHEETAH, "c"), inst("RS-495", "o")], deck: deckCards(3) } }), [`${CHEETAH}:c`]);
    expect(spOf(s, "player1", `${CHEETAH}:c`)).toBe(1);
  });

  // 既知の不具合: CARD-RS-495 【宇宙忍法・重力無秩序】が未実装（敵軍ユニットのナンバーも変わらない）
  it.fails("RS-495: 【宇宙忍法・重力無秩序】「すべてのユニット」— 敵軍のガオブラックもナンバー1になり、敵軍バトルフェイズに1番目で NC が成立する（出典: atwiki/page-818「すべてのユニットは、次の効果を受ける」）", () => {
    const s = enterSeq(
      st({ activePlayer: "player2", player1: { rush: [inst("RS-495", "o")], deck: deckCards(3) }, player2: { rush: [inst(GAO, "g")], deck: deckCards(3, "e") } }),
      [`${GAO}:g`],
      "player2",
    );
    expect(bpOf(s, "player2", `${GAO}:g`)).toBe(6000);
  });

  it("RS-495: SP1 を得たユニットは対象外 — SP1 になっているガオブラックは本来の CN4 のまま4番目で NC が成立する（出典: grnrngr/faq-card-7 RS-495 Q「…SP1や分数SPを得た場合、【宇宙忍法・重力無秩序】の対象から外れますか？」→「はい、その通りです」）", () => {
    const gao: CardInstance = { ...inst(GAO, "g"), spOverride: 1 };
    const s = enterSeq(st({ player1: { battle: fill(3), rush: [gao, inst("RS-495", "o")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(6000);
  });
});

// ===========================================================================
describe("RS-496 デカブルーSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「デカブルー」のカードを1枚選び、自軍ラッシュエリアに出す。 ※これが自軍エリアにある間、特徴「スワット」を持つ自軍ユニットは、アタックされるときBP+3000される。 【精密射撃】敵軍パワーゾーンのダメージになっているカードを1枚選び、オモテにしてもよい。そうしたとき、敵軍パワーゾーンからオモテ向きのカードを1枚選び、ダメージにする。";

  it("RS-496: カタログ本文・スペックが出典と一致（出典: atwiki/page-793）", () => {
    expectCatalogText("RS-496", TEXT);
    expectStats("RS-496", {
      name: "デカブルーSWAT",
      category: "OT",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 2,
      features: ["ブルー", "男", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-496: 同名カード XP-010 デカブルーSWAT は同じ本文（resolvePlayableCard）（出典: atwiki/page-793 本文）", () => {
    expect(norm(resolvePlayableCard("XP-010")?.text)).toBe(norm(TEXT));
    expect(resolvePlayableCard("XP-010")?.name).toBe("デカブルーSWAT");
  });

  zordDownTests("RS-496", "RS-107", "デカブルー", "atwiki/page-793「追加条件：自軍「デカブルー」1体を捨札にすれば必要パワー0になる」", "OT");
  reanimateTests("RS-496", "RS-107", "デカブルー", "atwiki/page-793");

  it("RS-496: ※ 自軍ターン中に撃破されて捨札になったときも「デカブルー」を出す（ターンの限定なし）（出典: atwiki/page-793「※これが撃破されて捨札になったとき」）", () => {
    const s = resolveAll(
      settle(
        attack(
          st({ player1: { battle: [inst("RS-496", "sw")], discard: [inst("RS-107", "p")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") } }),
          "RS-496:sw",
          "TST-UNIT-7:big",
        ),
      ),
      ["RS-107:p"],
    );
    expect(zoneOf(s, "player1", "RS-496:sw")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-107:p")).toBe("rush");
  });

  const attackedBy = (attacker: string, target: string, p1: Partial<GameState["players"]["player1"]>) =>
    resolveAll(
      settle(
        attack(
          st(
            { activePlayer: "player2", player1: { deck: deckCards(3), ...p1 }, player2: { battle: [inst(attacker, "a")], deck: deckCards(3, "e") } },
            [BP7000, SWAT],
          ),
          `${attacker}:a`,
          target,
          "player2",
        ),
      ),
    );

  it("RS-496: ※ アタックされるとき、特徴「スワット」を持つ自軍ユニット（これ自身）は BP+3000 され、BP7000 のアタックに勝つ（出典: atwiki/page-793「アタックされるときBP+3000される」）", () => {
    const s = attackedBy("SPEC-7000", "RS-496:sw", { battle: [inst("RS-496", "sw")] });
    expect(zoneOf(s, "player1", "RS-496:sw")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-7000:a")).toBe("discard");
  });

  it("RS-496: ※ これが自軍エリア（ラッシュエリア）にある間、別の「スワット」の自軍ユニット（BP4500）もアタックされるとき BP+3000 され、BP7000 のアタックに勝つ（出典: atwiki/page-793「特徴「スワット」を持つ自軍ユニットは」）", () => {
    const s = attackedBy("SPEC-7000", "SPEC-SWAT:x", { battle: [inst("SPEC-SWAT", "x")], rush: [inst("RS-496", "sw")] });
    expect(zoneOf(s, "player1", "SPEC-SWAT:x")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-7000:a")).toBe("discard");
  });

  it("RS-496: ※ 「スワット」を持たない自軍ユニットは BP が上がらない（出典: atwiki/page-793「特徴「スワット」を持つ自軍ユニット」）", () => {
    const s = attackedBy("SPEC-7000", "RS-107:b", { battle: [inst("RS-107", "b")], rush: [inst("RS-496", "sw")] });
    expect(zoneOf(s, "player1", "RS-107:b")).toBe("discard");
  });

  it("RS-496: ※ アタックするとき（自軍ターン）は BP が上がらず、BP7000 に負ける（出典: atwiki/page-793「アタックされるとき」）", () => {
    const s = resolveAll(
      settle(
        attack(
          st({ player1: { battle: [inst("RS-496", "sw")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-7000", "d")], deck: deckCards(3, "e") } }, [BP7000]),
          "RS-496:sw",
          "SPEC-7000:d",
        ),
      ),
    );
    expect(zoneOf(s, "player1", "RS-496:sw")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-7000:d")).toBe("battle");
  });

  /** 自軍バトルフェイズにデカブルーSWAT を2番目に出す（敵軍パワー: ダメージ ed0、オモテ ep0・ep1）。 */
  const enterSwat2nd = (enemyPower: CardInstance[] = [...damageCards(1, "ed"), ...powerCards(2, "ep")], first = fill(1)) =>
    enter(
      st({
        player1: { battle: first, rush: [inst("RS-496", "sw")], deck: deckCards(3) },
        player2: { power: enemyPower, damage: enemyPower.filter((c) => c.faceDown).length, deck: deckCards(3, "e") },
      }),
      "RS-496:sw",
    );

  it("RS-496: 【精密射撃】2番目に出て NC が成立すると、選べるのは敵軍パワーゾーンのダメージ（ウラ向き）のカードだけ（出典: atwiki/page-793「敵軍パワーゾーンのダメージになっているカードを1枚選び」）", () => {
    const s = enterSwat2nd();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-496");
    expect(choiceIds(s)).toEqual(["TST-P:ed0"]);
  });

  it("RS-496: 【精密射撃】ダメージ1枚をオモテにし、そうしたとき敵軍のオモテ向きのカードを1枚ダメージにする（ダメージ数は変わらない）（出典: atwiki/page-793「オモテにしてもよい。そうしたとき、…ダメージにする」・R-RES-06）", () => {
    let s = pick(enterSwat2nd(), "TST-P:ed0");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-496");
    expect(choiceIds(s)).toContain("TST-P:ep1");
    s = resolveAll(pick(s, "TST-P:ep1"));
    const power = s.players.player2.power;
    expect(power.find((c) => c.instanceId === "TST-P:ed0")?.faceDown ?? false).toBe(false);
    expect(power.find((c) => c.instanceId === "TST-P:ep1")?.faceDown).toBe(true);
    expect(power.find((c) => c.instanceId === "TST-P:ep0")?.faceDown ?? false).toBe(false);
    expect(power.filter((c) => c.faceDown)).toHaveLength(1);
  });

  it("RS-496: 【精密射撃】「オモテにしてもよい」— 見送れて、敵軍パワーゾーンは変わらない（出典: atwiki/page-793「オモテにしてもよい」）", () => {
    const s0 = enterSwat2nd();
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(s.players.player2.power.map((c) => !!c.faceDown)).toEqual([true, false, false]);
  });

  it("RS-496: 【精密射撃】敵軍にダメージがなければ何も起きない（出典: atwiki/page-793）", () => {
    const s = enterSwat2nd(powerCards(2, "ep"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.power.every((c) => !c.faceDown)).toBe(true);
  });

  it("RS-496: 【精密射撃】1番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-793・R-CN-02）", () => {
    const s = enterSwat2nd(undefined, []);
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-497 冥獣人ニンジャキリカゲ", () => {
  const TEXT =
    "※これは敵軍ターン中、特徴「女」を持つユニットとバトルしたときバトルに勝っても撃破される。 【変身の妨害】これが自軍バトルエリアにある間、カテゴリにDAを持たず、本来の特徴に｢男｣または「女」を持つSユニットは、次の制限を受ける⇒効果名を持つテキストは無効になり、発動もできない。";
  const GAO = "RS-163"; // ガオブラック（WB・男・CN4【アイアンブロークン】）

  it("RS-497: カタログ本文・スペックが出典と一致（出典: atwiki/page-819）", () => {
    expectCatalogText("RS-497", TEXT);
    expectStats("RS-497", {
      name: "冥獣人ニンジャキリカゲ",
      category: "DA",
      size: "S",
      bp: 5000,
      sp: undefined,
      powerCost: 3,
      features: ["怪人", "男", "忍者"],
    });
  });

  const enemyAttacks = (attacker: string) =>
    resolveAll(
      settle(
        attack(
          st(
            { activePlayer: "player2", player1: { battle: [inst("RS-497", "k")], deck: deckCards(3) }, player2: { battle: [inst(attacker, "a")], deck: deckCards(3, "e") } },
            [FEMALE, MALE],
          ),
          `${attacker}:a`,
          "RS-497:k",
          "player2",
        ),
      ),
    );

  it("RS-497: ※ 敵軍ターン中、特徴「女」を持つユニットとバトルすると、バトルに勝っても撃破される（出典: atwiki/page-819「バトルに勝っても撃破される」）", () => {
    const s = enemyAttacks("SPEC-FEMALE");
    expect(zoneOf(s, "player1", "RS-497:k")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-FEMALE:a")).toBe("discard");
  });

  it("RS-497: ※ 「女」を持たないユニットとのバトルに勝てば撃破されない（出典: atwiki/page-819「特徴「女」を持つユニットとバトルしたとき」）", () => {
    const s = enemyAttacks("SPEC-MALE");
    expect(zoneOf(s, "player1", "RS-497:k")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-MALE:a")).toBe("discard");
  });

  it("RS-497: ※ 自軍ターン中に「女」のユニットとバトルして勝っても撃破されない（出典: atwiki/page-819「敵軍ターン中」）", () => {
    const s = resolveAll(
      settle(
        attack(
          st({ player1: { battle: [inst("RS-497", "k")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-FEMALE", "d")], deck: deckCards(3, "e") } }, [FEMALE]),
          "RS-497:k",
          "SPEC-FEMALE:d",
        ),
      ),
    );
    expect(zoneOf(s, "player1", "RS-497:k")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-FEMALE:d")).toBe("discard");
  });

  it("RS-497: 対照 — キリカゲが自軍ラッシュエリアにあるだけなら、ガオブラック（WB・男）は4番目で【アイアンブロークン】が発動する（BP6000）（出典: atwiki/page-819「これが自軍バトルエリアにある間」）", () => {
    const s = enterSeq(st({ player1: { battle: fill(3), rush: [inst(GAO, "g"), inst("RS-497", "k")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(6000);
  });

  // 既知の不具合: CARD-RS-497 【変身の妨害】が未実装（DA を持たない男・女の S ユニットの効果名テキストが無効にならない）
  it.fails("RS-497: 【変身の妨害】キリカゲが自軍バトルエリアにある間、DA を持たず本来の特徴に「男」を持つ S ユニット（ガオブラック）の【アイアンブロークン】は無効（BP3000 のまま）（出典: atwiki/page-819「効果名を持つテキストは無効になり、発動もできない」）", () => {
    const s = enterSeq(st({ player1: { battle: [inst("RS-497", "k"), ...fill(2)], rush: [inst(GAO, "g")], deck: deckCards(3) } }), [`${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(3000);
  });

  // 既知の不具合: CARD-RS-497 【変身の妨害】が未実装（「女」の S ユニットの NC も発動する）
  it.fails("RS-497: 【変身の妨害】「女」の S ユニット（マジブルー）の【未来予知】も発動できない（ドローしない）（出典: atwiki/page-819「本来の特徴に｢男｣または「女」を持つSユニット」）", () => {
    const s = enterSeq(st({ player1: { battle: [inst("RS-497", "k")], rush: [inst("RS-059", "mb")], deck: deckCards(5) } }), ["RS-059:mb"]);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-497: 【変身の妨害】カテゴリに DA を持つ S ユニット（紐男爵）は制限を受けず、NC【紐拳】が発動する（出典: atwiki/page-819「カテゴリにDAを持たず」）", () => {
    const s = enterSeq(
      st({ player1: { battle: [inst("RS-497", "k"), ...fill(1)], rush: [inst("RS-141", "hm")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "e2")], deck: deckCards(3, "e") } }),
      ["RS-141:hm"],
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-141");
  });

  it.todo(
    "RS-497: コピーベントで敵軍ユニット自身が【変身の妨害】の対象になるループは、ターンプレイヤーが優先順を選ぶ（出典: atwiki/page-819 Q1「ターンプレイヤーが効果の優先順を選択して処理してください」）— 【変身の妨害】が未実装で、XG1-078 コピーベントの効果名の入れ替えとループの優先順選択を公開 API で作れないため",
  );

  it("RS-497: キリカゲで効果名テキストが無効でもナンバーは消えないので、RC を持つユニットはライドオフしてビーファイタークワガーにアタックできる（出典: atwiki/page-819 Q2「はい、できます。…ナンバーは消えていないので、RCを持つユニットはライドオフすることでRCを発動しているとみなします」）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("RK-031", "r"), inst("RK-058", "z")], deck: deckCards(3) },
      player2: { battle: [inst("RS-497", "k"), inst("XG1-096", "q")], deck: deckCards(3, "e") },
    });
    s = settle(act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:r", vehicleInstanceId: "RK-058:z" }));
    s = settle(act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true }));
    expect(attackTargets(s, "RK-031:r")).toContain("XG1-096:q");
  });
});

// ===========================================================================
/** 「特徴「激気」と「<色>」を持つ自軍ユニット1体を捨札にする」の共通テスト。 */
function gekiMConditionTests(id: string, color: string, ok: string, okName: string, ngColorOnly: string, ngGekiOnly: string, cost: number, page: string) {
  const VIOLET_ONLY = sUnit("SPEC-VIOLET", { features: ["バイオレット", "男"] });
  const mk = (material: string) =>
    st({ phase: "rush", player1: { hand: [inst(id, "me")], rush: [inst(material, "m")], command: releasedCat("WB", 1), power: powerCards(cost), deck: deckCards(3) } }, [VIOLET_ONLY]);

  it(`${id}: 追加条件 — 特徴「激気」と「${color}」を持つ自軍ユニット（${okName}）を捨札にしてラッシュできる（出典: atwiki/${page}「追加条件：特徴「激気」と「${color}」を持つ自軍ユニット1体を捨札にする」）`, () => {
    const r = rushFromHand(mk(ok), "player1", `${id}:me`);
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:me`)).toBe("rush");
    expect(zoneOf(t, "player1", `${ok}:m`)).toBe("discard");
  });

  it(`${id}: 追加条件 — 「${color}」だけで「激気」を持たないユニットでは満たせない（出典: atwiki/${page}）`, () => {
    expect(canStartRush(mk(ngColorOnly), "player1", `${id}:me`)).toBe(false);
  });

  it(`${id}: 追加条件 — 「激気」だけで「${color}」を持たないユニット（${ngGekiOnly}）では満たせない（出典: atwiki/${page}）`, () => {
    expect(canStartRush(mk(ngGekiOnly), "player1", `${id}:me`)).toBe(false);
  });

  it(`${id}: 追加条件 — 必要パワー${cost}（＋）を満たしていても素材がなければラッシュできない（出典: atwiki/${page}・R-ADD-02）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "me")], command: releasedCat("WB", 1), power: powerCards(cost + 3), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", `${id}:me`)).toBe(false);
  });
}

describe("RS-498 ゲキウルフ", () => {
  const TEXT =
    "【狼狼弾】これをラッシュしたとき、BPの合計が5000以下になるように敵軍ユニットを選び撃破してもよい。ただし選べるユニットの数は、WBの自軍Mユニットの数までとする。";

  it("RS-498: カタログ本文・スペックが出典と一致（出典: atwiki/page-774）", () => {
    expectCatalogText("RS-498", TEXT);
    expectStats("RS-498", {
      name: "ゲキウルフ",
      category: "WB",
      size: "M",
      bp: 6500,
      sp: undefined,
      powerCost: "3+",
      features: ["激気"],
      rushCondition: "discard_named_unit",
    });
  });

  gekiMConditionTests("RS-498", "バイオレット", "RS-499", "ゲキバイオレット", "SPEC-VIOLET", "RS-426", 3, "page-774");

  /** ゲキバイオレットを捨札にしてゲキウルフをラッシュする（自軍ラッシュエリアに WB の M ユニット TST-UNIT-2 を extraM 体）。 */
  const rushWolf = (extraM: number, p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-498", "w")],
        rush: [inst("RS-499", "v"), ...Array.from({ length: extraM }, (_, i) => inst("TST-UNIT-2", `wbm${i}`))],
        command: releasedCat("WB", 1),
        power: powerCards(3),
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e"), ...p2 },
    }, [sUnit("SPEC-6000", { bp: 6000 }), sUnit("SPEC-2000", { bp: 2000 })]);
    const r = rushFromHand(s, "player1", "RS-498:w");
    expect(r.ok).toBe(true);
    return r.state;
  };

  // 既知の不具合: CARD-RS-498 追加条件を満たせずラッシュできないため【狼狼弾】に到達しない
  it.fails("RS-498: 【狼狼弾】ラッシュしたとき、BP5000 以下の敵軍ユニット（バトルエリア・ラッシュエリア）を選んで撃破できる（WB の M はゲキウルフ自身の1体）（出典: atwiki/page-774「BPの合計が5000以下になるように敵軍ユニットを選び撃破してもよい」）", () => {
    let s = rushWolf(0, { battle: [inst("TST-UNIT-2", "e1")], rush: [inst("TST-UNIT-0", "e2"), inst("SPEC-6000", "big")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-498");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e2", "TST-UNIT-2:e1"]);
    s = resolveAll(s, ["TST-UNIT-0:e2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e1")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-498 追加条件を満たせずラッシュできないため【狼狼弾】に到達しない
  it.fails("RS-498: 【狼狼弾】選べる数は WB の自軍 M ユニットの数まで — 2体なら BP2000+3000 の2体を撃破できる（出典: atwiki/page-774「選べるユニットの数は、WBの自軍Mユニットの数までとする」）", () => {
    // ゲキウルフ＋TST-UNIT-2（WB の M）で2体。
    let s = rushWolf(1, { battle: [inst("TST-UNIT-2", "e1"), inst("SPEC-2000", "e2")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-498");
    s = resolveAll(s, ["TST-UNIT-2:e1", "SPEC-2000:e2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-2000:e2")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-498 追加条件を満たせずラッシュできないため【狼狼弾】に到達しない
  it.fails("RS-498: 【狼狼弾】WB の M ユニットがゲキウルフだけなら1体までしか撃破できない（出典: atwiki/page-774）", () => {
    const s = resolveAll(rushWolf(0, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] }), ["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    const destroyed = ["TST-UNIT-0:e1", "TST-UNIT-0:e2"].filter((x) => zoneOf(s, "player2", x) === "discard");
    expect(destroyed).toHaveLength(1);
  });

  // 既知の不具合: CARD-RS-498 追加条件を満たせずラッシュできないため【狼狼弾】に到達しない
  it.fails("RS-498: 【狼狼弾】BP の合計は5000以下 — BP3000＋BP3000 の2体は選べない（M が2体でも）（出典: atwiki/page-774「BPの合計が5000以下になるように」）", () => {
    const s = resolveAll(rushWolf(1, { battle: [inst("TST-UNIT-2", "e1"), inst("TST-UNIT-2", "e2")] }), ["TST-UNIT-2:e1", "TST-UNIT-2:e2"]);
    const destroyed = ["TST-UNIT-2:e1", "TST-UNIT-2:e2"].filter((x) => zoneOf(s, "player2", x) === "discard");
    expect(destroyed).toHaveLength(1);
  });

  // 既知の不具合: CARD-RS-498 追加条件を満たせずラッシュできないため【狼狼弾】の任意性も確認できない
  it.fails("RS-498: 【狼狼弾】「撃破してもよい」— 見送れる（出典: atwiki/page-774）", () => {
    let s = rushWolf(0, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-498");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-498: 【狼狼弾】「ラッシュしたとき」— ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-774「これをラッシュしたとき」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-498", "w")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } }), "RS-498:w");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });
});

// ===========================================================================
/** ※レジスト の共通テスト（敵軍ターンに BP13000 にアタックされて負ける）。 */
function registerTests(id: string, page: string) {
  it(`${id}: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/${page}「※レジスト(…ホールドしてその場に留めてもよい)」・R-KW-RESIST-01）`, () => {
    let s = attack(
      st({ activePlayer: "player2", player1: { battle: [inst(id, "me")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "a")], deck: deckCards(3, "e") } }),
      "TST-UNIT-7:a",
      `${id}:me`,
      "player2",
    );
    s = settle(s, 0);
    for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(legal(s).some((a) => a.type === "use_register")).toBe(true);
    s = resolveAll(act(s, { type: "use_register", playerId: "player1" }));
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("battle");
    expect(cardIn(s, "player1", `${id}:me`)?.commandHeld).toBe(true);
  });

  it(`${id}: ※レジスト — 任意（使わなければ捨札になる）（出典: atwiki/${page}「…留めてもよい」）`, () => {
    const s = resolveAll(
      attack(
        st({ activePlayer: "player2", player1: { battle: [inst(id, "me")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "a")], deck: deckCards(3, "e") } }),
        "TST-UNIT-7:a",
        `${id}:me`,
        "player2",
      ),
    );
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("discard");
  });
}

describe("RS-499 ゲキバイオレット", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) ※このユニットは、自軍ラッシュフェイズ中、特徴に「レッド」「ブルー」「イエロー」を追加される。 【狼狼蹴】「SP1」このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアのユニットを必要パワーの数字の合計が2になるまで好きな数選び、撃破する。";

  it("RS-499: カタログ本文・スペックが出典と一致（出典: atwiki/page-775）", () => {
    expectCatalogText("RS-499", TEXT);
    expectStats("RS-499", {
      name: "ゲキバイオレット",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["バイオレット", "男", "激気"],
    });
  });

  registerTests("RS-499", "page-775");

  // 既知の不具合: CARD-RS-499 自軍ラッシュフェイズ中の特徴「レッド」追加が未実装（RS-423 の追加条件の判定もカード名「激気」による）
  it.fails("RS-499: ※ 自軍ラッシュフェイズ中は「レッド」を持つので、ゲキタイガーの追加条件（特徴「激気」と「レッド」を持つ自軍ユニット）の素材にできる（出典: atwiki/page-775「自軍ラッシュフェイズ中、特徴に「レッド」「ブルー」「イエロー」を追加される」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-423", "tg")], rush: [inst("RS-499", "v")], command: releasedCat("WB", 1), power: powerCards(3), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-423:tg");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-499:v")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-499 自軍ラッシュフェイズ中の特徴「ブルー」追加が未実装
  it.fails("RS-499: ※ 自軍ラッシュフェイズ中は「ブルー」も持つので、ゲキジャガー（激気＋ブルー）の追加条件の素材にできる（出典: atwiki/page-775）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-425", "jg")], rush: [inst("RS-499", "v")], command: releasedCat("WB", 1), power: powerCards(2), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-425:jg");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-499:v")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-499 自軍ラッシュフェイズ中の特徴「イエロー」追加が未実装
  it.fails("RS-499: ※ 自軍ラッシュフェイズ中は「イエロー」も持つので、ゲキチーター（激気＋イエロー）の追加条件の素材にできる（出典: atwiki/page-775）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-424", "ch")], rush: [inst("RS-499", "v")], command: releasedCat("WB", 1), power: powerCards(0), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-424:ch");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-499:v")).toBe("discard");
  });

  it("RS-499: ※ 自軍バトルフェイズ中は「レッド」を持たない — シャッキー・チェンの能力（レッドの S ユニットは敵軍の本来の BP でバトル）を得ない（出典: atwiki/page-775「自軍ラッシュフェイズ中」・atwiki/page-778）", () => {
    // 敵軍 TST-UNIT-0（本来 BP1000）は BP+5000 で 6000。ゲキバイオレット（BP2000）は本来の値で比べないので負ける。
    const s = resolveAll(
      settle(
        attack(
          st({ player1: { battle: [inst("RS-499", "v")], rush: [inst("RS-503", "sc")], deck: deckCards(3) }, player2: { battle: [{ ...inst("TST-UNIT-0", "e"), bpModifier: 5000 }], deck: deckCards(3, "e") } }),
          "RS-499:v",
          "TST-UNIT-0:e",
        ),
      ),
    );
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  const enterViolet = (first: CardInstance[], enemyBattle: CardInstance[], enemyRush: CardInstance[] = []) =>
    enter(
      st(
        { player1: { battle: first, rush: [inst("RS-499", "v")], deck: deckCards(3) }, player2: { battle: enemyBattle, rush: enemyRush, deck: deckCards(3, "e") } },
        [sUnit("SPEC-C3", { powerCost: 3, bp: 1000 }), sUnit("SPEC-C1", { powerCost: 1, bp: 1000 })],
      ),
      "RS-499:v",
    );

  it("RS-499: 【狼狼蹴】2番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-775「【狼狼蹴】「SP1」」・R-CN-02）", () => {
    const s = enterViolet(fill(1), []);
    expect(spOf(s, "player1", "RS-499:v")).toBe(1);
  });

  it("RS-499: 【狼狼蹴】1番目に出たとき（NC 不成立）は SP がない（出典: atwiki/page-775・R-STK-02）", () => {
    const s = enterViolet([], []);
    expect(spOf(s, "player1", "RS-499:v")).toBe(0);
  });

  // 既知の不具合: CARD-RS-499 【狼狼蹴】の「ホールドしてもよい。そうしたとき…撃破する」が未実装（選択が出ない）
  it.fails("RS-499: 【狼狼蹴】ホールドすると、敵軍バトルエリアのユニットを必要パワーの合計が2になるまで選んで撃破する（必要パワー3は選べず、ラッシュエリアも対象外）（出典: atwiki/page-775「このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアのユニットを必要パワーの数字の合計が2になるまで好きな数選び、撃破する」）", () => {
    let s = enterViolet(fill(1), [inst("SPEC-C1", "c1a"), inst("SPEC-C1", "c1b"), inst("TST-UNIT-0", "c0"), inst("SPEC-C3", "c3")], [inst("TST-UNIT-0", "r0")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-499");
    s = resolveAll(s, ["RS-499:v", "SPEC-C1:c1a", "SPEC-C1:c1b", "TST-UNIT-0:c0"]);
    expect(cardIn(s, "player1", "RS-499:v")?.commandHeld).toBe(true);
    for (const x of ["SPEC-C1:c1a", "SPEC-C1:c1b", "TST-UNIT-0:c0"]) expect(zoneOf(s, "player2", x)).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r0")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-499 【狼狼蹴】の選択が出ないため、見送り（ホールドしない）を選べない
  it.fails("RS-499: 【狼狼蹴】「ホールドしてもよい」— 見送れば何も撃破されず、ゲキバイオレットはリリース状態のまま（出典: atwiki/page-775）", () => {
    let s = enterViolet(fill(1), [inst("TST-UNIT-0", "c0")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-499");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:c0")).toBe("battle");
    expect(cardIn(s, "player1", "RS-499:v")?.commandHeld ?? false).toBe(false);
  });

  it("RS-499: 【狼狼蹴】1番目に出たとき（NC 不成立）は敵軍ユニットを撃破しない（出典: atwiki/page-775・R-CN-02）", () => {
    const s = resolveAll(enterViolet([], [inst("TST-UNIT-0", "c0")]));
    expect(zoneOf(s, "player2", "TST-UNIT-0:c0")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-500 ゲキチョッパー", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【サイブレードカッター】自分の手札から特徴「激気」を持つユニットカードを1枚選び、相手に見せてもよい。そうしたとき、このターン、このユニットのBPは、見せたカードのBPを「＋」した値になり、BP5000以上のとき「SP1」になる。";

  it("RS-500: カタログ本文・スペックが出典と一致（出典: atwiki/page-776）", () => {
    expectCatalogText("RS-500", TEXT);
    expectStats("RS-500", {
      name: "ゲキチョッパー",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 4,
      features: ["ホワイト", "男", "激気"],
    });
  });

  registerTests("RS-500", "page-776");

  /** 4番目に出す（手札: ゲキウルフ BP6500、ゲキバイオレット BP2000、TST-UNIT-2（激気なし））。 */
  const enterChopper = (first = fill(3), hand: CardInstance[] = [inst("RS-498", "w"), inst("RS-499", "v"), inst("TST-UNIT-2", "x")]) =>
    enter(st({ player1: { battle: first, rush: [inst("RS-500", "c")], hand, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }), "RS-500:c");

  // 既知の不具合: CARD-RS-500 【サイブレードカッター】の候補に「激気」を持たないユニットカードも入る
  it.fails("RS-500: 【サイブレードカッター】4番目に出て NC が成立すると、手札の特徴「激気」を持つユニットカードだけを選べる（出典: atwiki/page-776「自分の手札から特徴「激気」を持つユニットカードを1枚選び」）", () => {
    const s = enterChopper();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-500");
    expect(choiceIds(s)).toEqual(["RS-498:w", "RS-499:v"]);
  });

  it("RS-500: 【サイブレードカッター】「見せてもよい」— 見送れる（出典: atwiki/page-776「相手に見せてもよい」）", () => {
    const s = enterChopper();
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-500 【サイブレードカッター】で見せても BP が加算されず「SP1」にならない
  it.fails("RS-500: 【サイブレードカッター】ゲキウルフ（BP6500）を見せると BP2000+6500=8500 になり、BP5000 以上なので「SP1」になる（出典: atwiki/page-776「見せたカードのBPを「＋」した値になり、BP5000以上のとき「SP1」になる」）", () => {
    const s = resolveAll(pick(enterChopper(), "RS-498:w"));
    expect(bpOf(s, "player1", "RS-500:c")).toBe(8500);
    expect(spOf(s, "player1", "RS-500:c")).toBe(1);
  });

  // 既知の不具合: CARD-RS-500 【サイブレードカッター】で見せても BP が加算されない
  it.fails("RS-500: 【サイブレードカッター】ゲキバイオレット（BP2000）を見せると BP4000 で、5000 未満なので SP はない（出典: atwiki/page-776「BP5000以上のとき」）", () => {
    const s = resolveAll(pick(enterChopper(), "RS-499:v"));
    expect(bpOf(s, "player1", "RS-500:c")).toBe(4000);
    expect(spOf(s, "player1", "RS-500:c")).toBe(0);
  });

  it("RS-500: 【サイブレードカッター】見せたカードは手札に残る（出典: atwiki/page-776「相手に見せてもよい」）", () => {
    const s = resolveAll(pick(enterChopper(), "RS-498:w"));
    expect(zoneOf(s, "player1", "RS-498:w")).toBe("hand");
  });

  it("RS-500: 【サイブレードカッター】1番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-776・R-CN-02）", () => {
    const s = enterChopper([]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(spOf(s, "player1", "RS-500:c")).toBe(0);
  });
});

// ===========================================================================
describe("RS-501 エレハン・キンポー", () => {
  const TEXT =
    "※これは自軍ターン中バトルエリアに出られない。 ※これは特徴「女」を持つユニット1体につきBP＋1000される。 【遊びの中に修行あり】これが自軍ラッシュエリアにある間、特徴「イエロー」を持つすべてのSユニットは次の能力を得る⇒バトルエリアで2番目に並んだとき「SP1」になる。";

  it("RS-501: カタログ本文が出典と一致（出典: atwiki/page-742）", () => {
    expectCatalogText("RS-501", TEXT);
  });

  // 既知の不具合: CARD-RS-501 カタログの BP が 0（atwiki は BP3000）
  it.fails("RS-501: スペックが出典と一致（BP3000）（出典: atwiki/page-742「BP:3000」「SP:なし」「必要パワー：2」）", () => {
    expectStats("RS-501", {
      name: "エレハン・キンポー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      features: ["男", "拳聖", "激気"],
    });
  });

  it("RS-501: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-742「※これは自軍ターン中バトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-501", "k")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-501:k")).toBe(false);
  });

  it("RS-501: ※ 敵軍ターン中なら効果（敵軍デンジピンクの NC）でバトルエリアに出られる（出典: atwiki/page-742「自軍ターン中」・R-BA-03）", () => {
    let s = enter(
      st({ activePlayer: "player2", player1: { rush: [inst("RS-501", "k")], deck: deckCards(3) }, player2: { rush: [inst("RS-358", "d")], deck: deckCards(3, "e") } }),
      "RS-358:d",
      "player2",
    );
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toContain("RS-501:k");
    s = pick(s, "RS-501:k");
    expect(zoneOf(s, "player1", "RS-501:k")).toBe("battle");
  });

  const withUnits = (p1Extra: CardInstance[], p2: CardInstance[] = []) =>
    st({ player1: { rush: [inst("RS-501", "k"), ...p1Extra], deck: deckCards(3) }, player2: { battle: p2, deck: deckCards(3, "e") } }, [FEMALE]);

  it("RS-501: ※ 自軍の特徴「女」を持つユニット1体につき BP+1000（2体で+2000）（出典: atwiki/page-742「特徴「女」を持つユニット1体につきBP＋1000される」）", () => {
    const base = bpOf(withUnits([]), "player1", "RS-501:k");
    expect(bpOf(withUnits([inst("SPEC-FEMALE", "f1")]), "player1", "RS-501:k")).toBe(base + 1000);
    expect(bpOf(withUnits([inst("SPEC-FEMALE", "f1"), inst("SPEC-FEMALE", "f2")]), "player1", "RS-501:k")).toBe(base + 2000);
  });

  // 既知の不具合: CARD-RS-501 ※の BP+1000 が自軍の「女」のユニットしか数えない
  it.fails("RS-501: ※ 敵軍の「女」のユニットも数える（「ユニット1体につき」に自軍・敵軍の限定はない）（出典: atwiki/page-742「特徴「女」を持つユニット1体につき」）", () => {
    const base = bpOf(withUnits([]), "player1", "RS-501:k");
    expect(bpOf(withUnits([], [inst("SPEC-FEMALE", "e1")]), "player1", "RS-501:k")).toBe(base + 1000);
  });

  // 既知の不具合: CARD-RS-501 カタログの BP が 0 のため、「女」が1体のときの BP が 4000 にならない
  it.fails("RS-501: ※ 「女」1体で BP3000+1000=4000（出典: atwiki/page-742「BP:3000」）", () => {
    expect(bpOf(withUnits([inst("SPEC-FEMALE", "f1")]), "player1", "RS-501:k")).toBe(4000);
  });

  /** RS-501 を自軍ラッシュエリアに置き、TST-UNIT-0 → ゲキイエロー（イエロー・SP 空欄）の順に出す。 */
  const yellowAt = (pos: number, where: "rush" | "discard" = "rush", yellow = "RS-342") => {
    const s = st({
      player1: {
        battle: fill(pos - 1),
        rush: [inst(yellow, "y"), ...(where === "rush" ? [inst("RS-501", "k")] : [])],
        discard: where === "discard" ? [inst("RS-501", "k")] : [],
        deck: deckCards(3),
      },
    });
    return enterSeq(s, [`${yellow}:y`]);
  };

  // 既知の不具合: CARD-RS-501 【遊びの中に修行あり】が未実装（2番目のイエローが「SP1」にならない）
  it.fails("RS-501: 【遊びの中に修行あり】自軍ラッシュエリアにある間、特徴「イエロー」の S ユニット（ゲキイエロー）がバトルエリアで2番目に並ぶと「SP1」（出典: atwiki/page-742「バトルエリアで2番目に並んだとき「SP1」になる」）", () => {
    expect(spOf(yellowAt(2), "player1", "RS-342:y")).toBe(1);
  });

  it("RS-501: 【遊びの中に修行あり】3番目に並んだイエローは「SP1」にならない（出典: atwiki/page-742「2番目に並んだとき」）", () => {
    expect(spOf(yellowAt(3), "player1", "RS-342:y")).toBe(0);
  });

  it("RS-501: 【遊びの中に修行あり】エレハン・キンポーが自軍ラッシュエリアになければ（捨札）2番目でも「SP1」にならない（出典: atwiki/page-742「これが自軍ラッシュエリアにある間」）", () => {
    expect(spOf(yellowAt(2, "discard"), "player1", "RS-342:y")).toBe(0);
  });

  it("RS-501: 【遊びの中に修行あり】「イエロー」を持たない S ユニット（ガオブラック）は2番目でも「SP1」にならない（出典: atwiki/page-742「特徴「イエロー」を持つすべてのSユニット」）", () => {
    expect(spOf(yellowAt(2, "rush", "RS-163"), "player1", "RS-163:y")).toBe(0);
  });

  // 既知の不具合: CARD-RS-501 【遊びの中に修行あり】が未実装（敵軍のイエローも対象）
  it.fails("RS-501: 【遊びの中に修行あり】「すべてのSユニット」— 敵軍のイエロー（ゲキイエロー）も敵軍バトルエリアの2番目で「SP1」になる（出典: atwiki/page-742「特徴「イエロー」を持つすべてのSユニット」）", () => {
    const s = enterSeq(
      st({ activePlayer: "player2", player1: { rush: [inst("RS-501", "k")], deck: deckCards(3) }, player2: { battle: fill(1, "e"), rush: [inst("RS-342", "y")], deck: deckCards(3, "e") } }),
      ["RS-342:y"],
      "player2",
    );
    expect(spOf(s, "player2", "RS-342:y")).toBe(1);
  });
});
