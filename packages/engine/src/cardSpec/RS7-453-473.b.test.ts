/**
 * カード別スペック: RS-460〜RS-465（第7弾「七忍の炎陣」花忍者ラン〜ドロドロ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7（該当カードの Q なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。
 *     Q&A 欄は RS-460 Q1。コメント欄の質疑も参考に引用）
 *  3. docs/rules/*.md の一般ルール（R-KW-SCRUM-01 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import {
  attackTargets,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  inst,
  ncEnter,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  st,
  toPhase,
  zoneOf,
} from "./RS7-453-473.helpers";
import type { CardInstance } from "../types/game";

/** 敵軍（player2）のバトルフェイズで、player1 のバトルエリアが battle のとき、player2 の L ユニット（BP13000）がアタックできる相手。 */
function enemyTargets(battle: CardInstance[]): string[] {
  const s = st({ activePlayer: "player2", player1: { battle }, player2: { battle: [inst("TST-UNIT-7", "atk")] } });
  return attackTargets(s, "TST-UNIT-7:atk", "player2").sort();
}

/** スクラムの共通テスト（CN が1多いユニットが次に並んでいる間、アタックされない）。 */
function scrumTests(id: string, cn: number, nextId: string, otherId: string, page: string) {
  it(`${id}: ※スクラム — CN${cn + 1} のユニット（${nextId}）が次に並んでいる間はアタックされない（出典: atwiki/${page}「※スクラム」・R-KW-SCRUM-01）`, () => {
    expect(enemyTargets([inst(id, "me"), inst(nextId, "nx")])).toEqual([`${nextId}:nx`]);
  });

  it(`${id}: ※スクラム — 次に並ぶユニットの CN が ${cn + 1} でなければ（${otherId}）アタックされる（出典: atwiki/${page}「これのＣＮより1多いＣＮを持つユニットが」）`, () => {
    expect(enemyTargets([inst(id, "me"), inst(otherId, "nx")])).toEqual([`${id}:me`, `${otherId}:nx`].sort());
  });

  it(`${id}: ※スクラム — CN${cn + 1} のユニットが「次」ではなく前に並んでいるならアタックされる（出典: atwiki/${page}「これの次に並んでいる間」）`, () => {
    expect(enemyTargets([inst(nextId, "nx"), inst(id, "me")])).toContain(`${id}:me`);
  });
}

// ===========================================================================
describe("RS-460 花忍者ラン", () => {
  const TEXT =
    "※スクラム （これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【忍法花爆弾】数字を1つ宣言してもよい。そうしたとき、このターン、すべての敵軍Sユニットの必要パワーは宣言した数字になる。";

  it("RS-460: カタログ本文・スペックが出典と一致（出典: atwiki/page-823）", () => {
    expectCatalogText("RS-460", TEXT);
    expectStats("RS-460", { name: "花忍者ラン", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: 1, features: ["女", "忍者"] });
  });

  scrumTests("RS-460", 1, "RS-461", "RS-462", "page-823");

  it("RS-460: 【忍法花爆弾】1番目に出て NC が成立すると数字を宣言でき、宣言しないこともできる（出典: atwiki/page-823「数字を1つ宣言してもよい」）", () => {
    const s = ncEnter("RS-460", 1);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-460");
    expect(s.pendingEffectChoice?.kind).toBe("declare_number");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-460: 【忍法花爆弾】NC 不成立（2番目）なら宣言できない（出典: atwiki/page-823「CN：1」・R-CN-02）", () => {
    const s = ncEnter("RS-460", 2);
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // atwiki/page-823 Q1「「10」や「100」等を宣言する事は可能ですか？」→ A1「いいえ、2桁以上であっても宣言できます。」
  it("RS-460: atwiki Q&A — 2桁の数字（10）も宣言できる（出典: atwiki/page-823 Q1/A1「2桁以上であっても宣言できます」）", () => {
    const s = ncEnter("RS-460", 1);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("10");
  });

  it("RS-460: atwiki Q&A — 3桁の数字（100）も宣言できる（出典: atwiki/page-823 Q1/A1「「10」や「100」等を…2桁以上であっても宣言できます」）", () => {
    const s = ncEnter("RS-460", 1);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("100");
  });

  /**
   * 1番目にラン（NC1）で n を宣言し、続けて TST-UNIT-0 ×2、4番目にニンジャホワイト（NC4【忍法折鶴之舞】:
   * 必要パワーの数字が敵軍パワーゾーンの枚数（3）より大きい敵軍ユニットを選ぶ）を出す。
   * 敵軍: バトル [S・必要パワー0]、ラッシュ [L・必要パワー7+]。
   */
  const bombThenWhite = (declared: string) => {
    let s = st({
      player1: { rush: [inst("RS-460", "ra"), inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("RS-458", "nw")], deck: deckCards(5) },
      player2: { power: powerCards(3, "ep"), battle: [inst("TST-UNIT-0", "s0")], rush: [inst("TST-UNIT-7", "l7")], deck: deckCards(5, "e") },
    });
    s = pick(enter(s, "RS-460:ra"), declared);
    s = passEntry(enter(passEntry(s), "TST-UNIT-0:f1"));
    s = passEntry(enter(s, "TST-UNIT-0:f2"));
    return enter(s, "RS-458:nw");
  };

  it("RS-460: 【忍法花爆弾】このターン、敵軍 S ユニットの必要パワーは宣言した数字になる — 0 を宣言すると必要パワー0扱いの S ユニットはホワイトで選べず、L ユニット（7+）は元のまま選べる（出典: atwiki/page-823「すべての敵軍Sユニットの必要パワーは宣言した数字になる」）", () => {
    const s = bombThenWhite("0");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:l7"]);
  });

  it("RS-460: 【忍法花爆弾】9 を宣言すると本来の必要パワー0の敵軍 S ユニットも「必要パワー9」としてホワイトで選べる（S ユニット以外は変わらない）（出典: atwiki/page-823）", () => {
    const s = bombThenWhite("9");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s0", "TST-UNIT-7:l7"]);
    // 宣言 0 のときと結果が違うこと（宣言が効いていること）も合わせて確認する。
    expect(choiceIds(bombThenWhite("0"))).toEqual(["TST-UNIT-7:l7"]);
  });
});

// ===========================================================================
describe("RS-461 花忍者スイレン", () => {
  const TEXT =
    "※スクラム （これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【忍法花夢幻】敵軍Sユニットを1体選び、特徴を1つ宣言してもよい。そうしたとき、このターン、宣言した特徴を選んだユニットに追加する。";

  it("RS-461: カタログ本文・スペックが出典と一致（出典: atwiki/page-824）", () => {
    expectCatalogText("RS-461", TEXT);
    expectStats("RS-461", { name: "花忍者スイレン", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: 2, features: ["女", "忍者"] });
  });

  scrumTests("RS-461", 2, "RS-462", "RS-460", "page-824");

  it("RS-461: 【忍法花夢幻】2番目に出て NC が成立すると、敵軍 S ユニット（バトル・ラッシュ。M ユニットは不可）を1体選べる（出典: atwiki/page-824「敵軍Sユニットを1体選び」）", () => {
    const s = ncEnter("RS-461", 2, {}, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-0", "e3")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-461");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e3"]);
  });

  it("RS-461: 【忍法花夢幻】「宣言してもよい」— 発動しないことを選べる（出典: atwiki/page-824「宣言してもよい」）", () => {
    const s = ncEnter("RS-461", 2, {}, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-461");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.pendingEffectChoice).toBeUndefined();
  });

  it("RS-461: 【忍法花夢幻】NC 不成立（1番目）なら発動しない（出典: atwiki/page-824「CN：2」・R-CN-02）", () => {
    const s = ncEnter("RS-461", 1, {}, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it.todo("RS-461: 【忍法花夢幻】宣言した特徴が、このターン、選んだユニットに追加される（出典: atwiki/page-824「このターン、宣言した特徴を選んだユニットに追加する」）— 特徴を宣言する選択（宣言の種類）がエンジンの公開 API にない");
  it.todo("RS-461: atwiki Q — 特徴「怪人」を追加して撃破したユニットは「怪人」が撃破された扱いで巨大化爆弾を使える（出典: atwiki/page-824 コメント「条件を満たしているので、使用することができます。」）— 特徴を宣言する API がなく【忍法花夢幻】も未実装");
});

// ===========================================================================
describe("RS-462 花忍者サクラ", () => {
  const TEXT =
    "※スクラム （これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【くノ一ミサイル】自分の手札からカードを1枚選び、相手に見せてもよい。そうしたとき、見せたカードの特徴と同じ特徴を2つ以上持つ敵軍ユニットがあれば、相手はその中から1体選び撃破するか、1点ダメージを受けるかを選ぶ。";

  it("RS-462: カタログ本文・スペックが出典と一致（出典: atwiki/page-825）", () => {
    expectCatalogText("RS-462", TEXT);
    expectStats("RS-462", { name: "花忍者サクラ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: 3, features: ["女", "忍者"] });
  });

  scrumTests("RS-462", 3, "RS-463", "RS-461", "page-825");

  /** 3番目に出す。自軍手札: 花忍者アヤメ（女／忍者）。敵軍: 花忍者スイレン（女／忍者）・TST-UNIT-0（特徴なし）。 */
  const missile = (hand: CardInstance[] = [inst("RS-463", "h1")], p2battle: CardInstance[] = [inst("RS-461", "w"), inst("TST-UNIT-0", "e2")]) =>
    ncEnter("RS-462", 3, { hand }, { battle: p2battle, deck: deckCards(5, "e") });

  it("RS-462: 【くノ一ミサイル】「見せてもよい」— 手札のカードを選ぶ（見せない選択もできる）（出典: atwiki/page-825「自分の手札からカードを1枚選び、相手に見せてもよい」）", () => {
    const s = missile();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-462");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-462: 【くノ一ミサイル】見せなければ何も起きない（相手はダメージを受けない）（出典: atwiki/page-825「見せてもよい。そうしたとき」）", () => {
    let s = missile();
    if (s.pendingEffectChoice?.sourceCardId === "RS-462") s = skip(s);
    s = resolveAll(s);
    expect(s.players.player2.damage ?? 0).toBe(0);
    expect(zoneOf(s, "player2", "RS-461:w")).toBe("battle");
  });

  it("RS-462: 【くノ一ミサイル】見せたカードと同じ特徴を2つ以上持つ敵軍ユニットがあれば、相手がその中から撃破する1体か1点ダメージかを選ぶ（出典: atwiki/page-825「相手はその中から1体選び撃破するか、1点ダメージを受けるかを選ぶ」）", () => {
    let s = missile();
    s = pick(s, "RS-463:h1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toContain("RS-461:w");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:e2");
    s = resolveAll(pick(s, "RS-461:w"));
    expect(zoneOf(s, "player2", "RS-461:w")).toBe("discard");
    expect(s.players.player2.damage ?? 0).toBe(0);
  });

  it("RS-462: 【くノ一ミサイル】同じ特徴を2つ以上持つ敵軍ユニットがなければ何も起きない（出典: atwiki/page-825「…敵軍ユニットがあれば」）", () => {
    let s = missile([inst("RS-463", "h1")], [inst("TST-UNIT-0", "e2")]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-462") s = pick(s, "RS-463:h1");
    s = resolveAll(s);
    expect(s.players.player2.damage ?? 0).toBe(0);
  });

  it("RS-462: 【くノ一ミサイル】自分の手札がなければ見せられず、何も起きない（出典: atwiki/page-825「自分の手札からカードを1枚選び」）", () => {
    const s = resolveAll(missile([]));
    expect(s.players.player2.damage ?? 0).toBe(0);
  });

  it("RS-462: 【くノ一ミサイル】NC 不成立（1番目）なら何も起きない（出典: atwiki/page-825「CN：3」・R-CN-02）", () => {
    const s = resolveAll(ncEnter("RS-462", 1, { hand: [inst("RS-463", "h1")] }, { battle: [inst("RS-461", "w")] }));
    expect(s.players.player2.damage ?? 0).toBe(0);
    expect(zoneOf(s, "player2", "RS-461:w")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-463 花忍者アヤメ", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【絡め取る縄】自分の手札からカードを1枚選び、相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ユニットがあれば、相手はその中から1体選び撃破するか、自分自身の手札を1枚選び捨札にするかを選ぶ。";

  it("RS-463: カタログ本文・スペックが出典と一致（出典: atwiki/page-747）", () => {
    expectCatalogText("RS-463", TEXT);
    expectStats("RS-463", { name: "花忍者アヤメ", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: 4, features: ["女", "忍者"] });
  });

  scrumTests("RS-463", 4, "RS-464", "RS-462", "page-747");

  /** 4番目に出す。自軍手札: TST-UNIT-2（必要パワー2）。敵軍: バトル [TST-UNIT-2（2）, TST-UNIT-0（0）]、手札1枚。 */
  const nawa = (p2battle: CardInstance[] = [inst("TST-UNIT-2", "c2"), inst("TST-UNIT-0", "c0")]) =>
    ncEnter("RS-463", 4, { hand: [inst("TST-UNIT-2", "h2")] }, { battle: p2battle, hand: [inst("TST-OP", "eh")], deck: deckCards(5, "e") });

  it("RS-463: 【絡め取る縄】「見せてもよい」— 手札のカードを選ぶ（見せない選択もできる）（出典: atwiki/page-747「自分の手札からカードを1枚選び、相手に見せてもよい」）", () => {
    const s = nawa();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-463");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:h2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-463: 【絡め取る縄】見せたカードと同じ必要パワーの数字の敵軍ユニットがあれば、相手がその中から撃破する1体か、手札1枚を捨札にするかを選ぶ（出典: atwiki/page-747「相手はその中から1体選び撃破するか、自分自身の手札を1枚選び捨札にするかを選ぶ」）", () => {
    let s = pick(nawa(), "TST-UNIT-2:h2");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toContain("TST-UNIT-2:c2");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:c0");
    s = resolveAll(pick(s, "TST-UNIT-2:c2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("hand");
  });

  it("RS-463: 【絡め取る縄】同じ必要パワーの数字の敵軍ユニットがなければ何も起きない（出典: atwiki/page-747「…敵軍ユニットがあれば」）", () => {
    let s = nawa([inst("TST-UNIT-0", "c0")]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-463") s = pick(s, "TST-UNIT-2:h2");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:c0")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("hand");
  });

  it("RS-463: 【絡め取る縄】NC 不成立（3番目）なら何も起きない（出典: atwiki/page-747「CN：4」・R-CN-02）", () => {
    const s = resolveAll(ncEnter("RS-463", 3, { hand: [inst("TST-UNIT-2", "h2")] }, { battle: [inst("TST-UNIT-2", "c2")], hand: [inst("TST-OP", "eh")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-464 花忍者ユリ", () => {
  const TEXT = "【斬撃の回避】次の相手ターン、相手はこのユニットを選べない。";

  it("RS-464: カタログ本文・スペックが出典と一致（atwiki で「次のターン」から「次の相手ターン」に修正済み）（出典: atwiki/page-826 本文・コメント「効果のテキストが間違っていたので修正しました」）", () => {
    expectCatalogText("RS-464", TEXT);
    expectStats("RS-464", { name: "花忍者ユリ", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 3, comboNumber: 5, features: ["女", "忍者"] });
  });

  /**
   * player1 のバトルフェイズにユリを position 番目に出してターンを終え、次の相手（player2）のバトルフェイズで
   * 敵軍ニンジャホワイト（NC4: 必要パワーの数字が player1 のパワーゾーン枚数 0 より大きいユニットを選ぶ）を出す。
   */
  const nextEnemyWhite = (position: number, otherCandidates: CardInstance[] = []) => {
    let s = st({
      player1: {
        battle: [],
        rush: [inst("RS-464", "yu"), ...Array.from({ length: position - 1 }, (_, i) => inst("TST-UNIT-0", `f${i}`)), ...otherCandidates],
        deck: deckCards(8),
      },
      player2: { rush: [inst("TST-UNIT-0", "a1"), inst("TST-UNIT-0", "a2"), inst("TST-UNIT-0", "a3"), inst("RS-458", "w")], deck: deckCards(8, "e") },
    });
    for (let i = 0; i < position - 1; i++) s = passEntry(enter(s, `TST-UNIT-0:f${i}`));
    s = resolveAll(enter(s, "RS-464:yu"));
    s = toPhase(endTurn(s), "player2", "battle");
    for (const id of ["TST-UNIT-0:a1", "TST-UNIT-0:a2", "TST-UNIT-0:a3"]) s = passEntry(enter(s, id, "player2"), "player2");
    return enter(s, "RS-458:w", "player2");
  };

  // 【忍法折鶴之舞】の候補が開くように、ユリ以外にも候補（必要パワー2の TST-UNIT-2）を置く（ユリだけだと候補がなく選択自体が開かない）。
  it("RS-464: 【斬撃の回避】5番目に出て NC が成立すると、次の相手ターン、相手の効果（ニンジャホワイト）でこのユニットを選べない（出典: atwiki/page-826「次の相手ターン、相手はこのユニットを選べない」）", () => {
    const s = nextEnemyWhite(5, [inst("TST-UNIT-2", "m2")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-458");
    expect(choiceIds(s)).toContain("TST-UNIT-2:m2");
    expect(choiceIds(s)).not.toContain("RS-464:yu");
  });

  it("RS-464: 【斬撃の回避】NC 不成立（1番目）なら次の相手ターンに相手の効果で選べる（出典: atwiki/page-826「CN：5」・R-CN-02）", () => {
    const s = nextEnemyWhite(1);
    expect(choiceIds(s)).toContain("RS-464:yu");
  });
});

// ===========================================================================
describe("RS-465 ドロドロ", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RS-465: カタログ本文・スペックが出典と一致（出典: atwiki/page-827）", () => {
    expectCatalogText("RS-465", TEXT);
    expectStats("RS-465", { name: "ドロドロ", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["妖怪", "戦闘員"] });
  });

  it("RS-465: ※ デッキに好きな枚数（40枚すべて）入れてもよい（出典: atwiki/page-827「デッキに好きな枚数入れてもよい」・R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-465", count: 40 }]);
    expect(r.errors).toEqual([]);
  });

  it("RS-465: 必要パワー1・DA コマンド1つのホールドでラッシュでき、パワー0ではラッシュできない（出典: atwiki/page-827「必要パワー：1」）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-465", "d")], command: releasedCat("DA", 1), power: powerCards(n), deck: deckCards(3) } });
    expect(canStartRush(mk(0), "player1", "RS-465:d")).toBe(false);
    const r = rushFromHand(mk(1), "player1", "RS-465:d");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-465:d")).toBe("rush");
  });
});
