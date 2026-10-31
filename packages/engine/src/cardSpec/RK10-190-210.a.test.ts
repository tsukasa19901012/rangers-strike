/**
 * カード別スペック: RK-190〜RK-196（ザ・マスクドライダーEXP vol.3 フォッグマザー〜クイーンアントロード）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない（rider_1〜4・rider.html を検索）。
 *     atwiki に転載された公式 Q&A（RK-190 Q1・RK-193 Q1・RK-194 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-HOLD-03、R-KW-RC-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { KW } from "../rulesSpec/07-helpers";
import {
  KW_MORPH,
  NOSP_ATTACKER,
  PLAIN_VEHICLE,
  accept,
  act,
  attackUntilRegister,
  boardOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceUp,
  fill,
  heldUnit,
  inst,
  passEntry,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushVia,
  rushed,
  settle,
  skip,
  spOf,
  strike,
  sUnit,
  toPhase,
  zoneOf,
} from "./RK10-190-210.helpers";

const DA3 = sUnit("SPEC-DA3", { category: "DA", bp: 1000, powerCost: 3 });
const DA2 = sUnit("SPEC-DA2", { category: "DA", bp: 1000, powerCost: 2 });
const WB3 = sUnit("SPEC-WB3", { category: "WB", bp: 1000, powerCost: 3 });
const OPDA3 = { id: "SPEC-OPDA3", name: "SPEC-OPDA3", type: "operation", category: "DA", rarity: "N", expansion: "card-spec", powerCost: 3 } as never;
const RESIST1 = sUnit("SPEC-RESIST1", { bp: 1000, powerCost: 1, text: KW.resist } as never);
const RESIST_M = sUnit("SPEC-RESIST-M", { bp: 1000, powerCost: 1, size: "M", text: KW.resist } as never);
const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, powerCost: 3 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, powerCost: 3 });
const L3000 = sUnit("SPEC-L3000", { bp: 3000, powerCost: "7+" as never, size: "L" });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const M1 = sUnit("SPEC-M1", { bp: 1000, powerCost: 1, size: "M" });
const MORPH = sUnit("SPEC-MORPH", { bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const MORPH_T = sUnit("SPEC-MORPH-T", { bp: 6000, powerCost: 5, features: ["仮面ライダー", "男"] });
const EXTRA = [PLAIN_VEHICLE, NOSP_ATTACKER, DA3, DA2, WB3, OPDA3, RESIST1, RESIST_M, E2000, E3000, E3500, L3000, C1, C3, M1, MORPH, MORPH_T];

const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("rush", "player1", p1, p2, EXTRA);
const battlePhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("battle", "player1", p1, p2, EXTRA);

// ===========================================================================
describe("RK-190 フォッグマザー", () => {
  const TEXT =
    "【孵化を迎える厄災】これをラッシュしたとき、次の効果を発動できる⇒自軍山札をシャッフルした後、その上から2枚をオモテにする。そして自軍山札を見て、ユニットカードを1枚選びラッシュエリアに出してもよい。ただし選べるカードは、カテゴリがオモテにした1枚目と同じで、必要パワーの数字がオモテにした2枚目と同じカードとする。その後、オモテにしたカードは山札に戻してシャッフルする。";

  it("RK-190: カタログ本文・スペックが出典と一致（出典: atwiki/page-911）", () => {
    expectCatalogText("RK-190", TEXT);
    expectStats("RK-190", { name: "フォッグマザー", category: "DA", size: "L", bp: 7000, sp: 1, powerCost: "5+", features: ["メカ", "獣", "母艦"], rushCondition: "return_named_to_hand" });
    expectRarityIn("RK-190", ["N"]);
  });

  const MATS = [inst("RK-191", "ga"), inst("RK-192", "ag"), inst("RK-193", "zu")];
  /** 追加条件の支払い（3体を手札に戻す）の合法手。 */
  const allThree = (a: Record<string, unknown>) => {
    const ids = (a.zordMaterialInstanceIds as string[] | undefined) ?? [];
    return ["RK-191:ga", "RK-192:ag", "RK-193:zu"].every((id) => ids.includes(id));
  };
  const rushBoard = (rush = MATS, deck = deckCards(5), power = 5) =>
    rushPhase({ hand: [inst("RK-190", "fm")], rush, command: releasedCat("DA", 1), power: powerCards(power), deck });

  it("RK-190: 追加条件 — 自軍「ガライ」「アギト」「ズー」をそれぞれ1体ずつ手札に戻し、パワー5でラッシュできる（出典: atwiki/page-911「追加条件：自軍「ガライ」「アギト」「ズー」をそれぞれ1体ずつ自分の手札に戻す」「必要パワー：5+」）", () => {
    const r = rushVia(rushBoard(), "player1", "RK-190:fm", allThree);
    expect(r.ok, r.error).toBe(true);
    const s = r.state;
    expect(zoneOf(s, "player1", "RK-190:fm")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-191:ga")).toBe("hand");
    expect(zoneOf(s, "player1", "RK-192:ag")).toBe("hand");
    expect(zoneOf(s, "player1", "RK-193:zu")).toBe("hand");
  });

  it("RK-190: 3体のうち1体でも欠けていればラッシュできない（出典: atwiki/page-911「それぞれ1体ずつ」）", () => {
    expect(canStartRush(rushBoard([inst("RK-191", "ga"), inst("RK-192", "ag")]), "player1", "RK-190:fm")).toBe(false);
  });

  it("RK-190: 必要パワー5+ — パワー4ではラッシュできない（出典: atwiki/page-911「必要パワー：5+」）", () => {
    expect(canStartRush(rushBoard(MATS, deckCards(5), 4), "player1", "RK-190:fm")).toBe(false);
  });

  /** 追加条件を満たしてラッシュした直後（【孵化を迎える厄災】の確認が開いている）。 */
  const afterRush = (deck: ReturnType<typeof inst>[]) => {
    const r = rushVia(rushBoard(MATS, deck), "player1", "RK-190:fm", allThree);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  const revealed = (s: GameState) => s.pendingEffectChoice?.viewedInstanceIds ?? [];
  const catOf = (s: GameState, id: string) => [s.definitions[id.split(":")[0]!]?.category].flat().join("+");
  const costNum = (s: GameState, id: string) => String(s.definitions[id.split(":")[0]!]?.powerCost ?? "").replace(/[+-]/g, "");

  it("RK-190: 【孵化を迎える厄災】ラッシュしたとき、発動するかを選べる（任意）（出典: atwiki/page-911「次の効果を発動できる」）", () => {
    const s = afterRush([inst("SPEC-DA3", "d0"), inst("SPEC-DA3", "d1"), inst("SPEC-DA3", "d2")]);
    expectChoiceFrom(s, "player1", "RK-190");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-190: 山札の上から2枚をオモテにし、山札から「カテゴリが1枚目と同じ・必要パワーの数字が2枚目と同じ」ユニットカードを選べる（オモテにした2枚は選べない。任意）（出典: atwiki/page-911・カード評価「効果でオモテにしたカードは効果でラッシュするユニットに選択できない」・コメント欄「山札に戻すのはラッシュ後だから不可」）", () => {
    const deck = [inst("SPEC-DA3", "a0"), inst("SPEC-DA3", "a1"), inst("SPEC-WB3", "w0"), inst("SPEC-WB3", "w1"), inst("SPEC-DA2", "b0"), inst("SPEC-DA2", "b1")];
    const s = accept(afterRush(deck));
    const shown = revealed(s);
    expect(shown).toHaveLength(2);
    const expected = deck
      .map((c) => c.instanceId)
      .filter((id) => !shown.includes(id) && catOf(s, id) === catOf(s, shown[0]!) && costNum(s, id) === costNum(s, shown[1]!))
      .sort();
    if (expected.length === 0) {
      expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-190");
    } else {
      expectChoiceFrom(s, "player1", "RK-190");
      expect(choiceIds(s)).toEqual(expected);
      expect(canSkip(s)).toBe(true);
    }
  });

  it("RK-190: 選んだユニットカードはラッシュエリアに出て、オモテにしたカードは山札に戻る（出典: atwiki/page-911「ラッシュエリアに出してもよい」「その後、オモテにしたカードは山札に戻してシャッフルする」）", () => {
    const deck = [inst("SPEC-DA3", "d0"), inst("SPEC-DA3", "d1"), inst("SPEC-DA3", "d2"), inst("SPEC-DA3", "d3")];
    let s = accept(afterRush(deck));
    const shown = revealed(s);
    expect(choiceIds(s)).toHaveLength(2);
    const chosen = choiceIds(s)[0]!;
    s = resolveAll(pick(s, chosen));
    expect(zoneOf(s, "player1", chosen)).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(3);
    for (const id of shown) expect(zoneOf(s, "player1", id)).toBe("deck");
  });

  it("RK-190: オペレーションのカードは選べない（出典: atwiki/page-911「ユニットカードを1枚選び」）", () => {
    const deck = [inst("SPEC-OPDA3", "o0"), inst("SPEC-OPDA3", "o1"), inst("SPEC-OPDA3", "o2"), inst("SPEC-OPDA3", "o3")];
    // 選べるカードがないので、山札を見るだけの窓が開く（rules/deckLook.ts）。閉じれば効果は終わる。
    const looked = settle(accept(afterRush(deck)));
    expect(looked.pendingEffectChoice?.effectId).toBe("deck_look");
    expect(choiceIds(looked)).toEqual([]);
    const s = settle(skip(looked));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-190");
    expect(s.players.player1.deck).toHaveLength(4);
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual(["RK-190:fm"]);
  });

  it("RK-190: 発動しなければ山札は変わらない（出典: atwiki/page-911「発動できる」）", () => {
    const deck = [inst("SPEC-DA3", "d0"), inst("SPEC-DA3", "d1"), inst("SPEC-DA3", "d2")];
    let s = afterRush(deck);
    if (s.pendingEffectChoice?.sourceCardId === "RK-190") s = skip(s);
    s = settle(s);
    expect(s.players.player1.deck).toHaveLength(3);
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual(["RK-190:fm"]);
  });

  // atwiki/page-911 Q1「はい、発動できます。効果によってユニットカードがラッシュエリア（またはバトルエリア）に出る場合も、ラッシュしたときの効果を発動することができます。」
  it("RK-190: 公式Q&A — 効果で山札から出した2体目のフォッグマザーも【孵化を迎える厄災】を発動できる（出典: atwiki/page-911 Q1）", () => {
    const deck = [inst("RK-190", "d0"), inst("RK-190", "d1"), inst("RK-190", "d2"), inst("RK-190", "d3")];
    let s = accept(afterRush(deck));
    expect(choiceIds(s)).toHaveLength(2);
    const second = choiceIds(s)[0]!;
    s = settle(pick(s, second));
    expect(zoneOf(s, "player1", second)).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-190");
    expect(s.pendingEffectChoice?.sourceInstanceId).toBe(second);
  });

  it.todo(
    "RK-190: 1枚目がマルチカテゴリのとき、どのカテゴリのカードを選べるか（出典: atwiki/page-911 コメント欄）— コメント欄で「同じマルチカテゴリだけ」「どちらかを持てばよい」の両案があり、公式の回答がない",
  );
});

// ===========================================================================
describe("RK-191 ガライ", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ガライソード】これをラッシュしたとき、これをホールドしてもよい。そうしたとき、このターン、これはSP1になる。";

  it("RK-191: カタログ本文・スペックが出典と一致（出典: atwiki/page-917）", () => {
    expectCatalogText("RK-191", TEXT);
    expectStats("RK-191", { name: "ガライ", category: "DA", size: "S", bp: 5000, sp: "special", powerCost: 5, features: ["男", "獣"] });
    expectRarityIn("RK-191", ["N"]);
  });

  it("RK-191: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-917「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-191", "ga")] }, "RK-191:ga"))).toBe(true);
  });

  const afterRush = () => rushed(rushPhase({ hand: [inst("RK-191", "ga")], command: releasedCat("DA", 1), power: powerCards(5) }), "RK-191:ga");

  it("RK-191: 【ガライソード】ラッシュしたとき、これをホールドするかを選べる（任意）（出典: atwiki/page-917「これをホールドしてもよい」）", () => {
    const s = afterRush();
    expectChoiceFrom(s, "player1", "RK-191");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-191: ホールドすると、このターン SP1 になり、ホールド状態のままバトルエリアに出てストライクできる（出典: atwiki/page-917「そうしたとき、このターン、これはSP1になる」・カード評価「ラッシュしたターンのみだがSP1になれる」・R-HOLD-03）", () => {
    let s = settle(accept(afterRush()));
    expect(cardIn(s, "player1", "RK-191:ga")?.commandHeld).toBe(true);
    s = toPhase(s, "player1", "battle");
    s = enter(s, "RK-191:ga");
    expect(spOf(s, "player1", "RK-191:ga")).toBe(1);
    s = settle(strike(s, "RK-191:ga"));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-191: ホールドしなければ SP は「！」のまま（ナンバーコンビネーションしなければストライクのダメージは0）（出典: atwiki/page-917「SP：！」・カード評価「能力を使う場合はレジストが使えなくなる」）", () => {
    let s = afterRush();
    if (s.pendingEffectChoice?.sourceCardId === "RK-191") s = skip(s);
    s = toPhase(settle(s), "player1", "battle");
    s = enter(s, "RK-191:ga");
    expect(cardIn(s, "player1", "RK-191:ga")?.commandHeld ?? false).toBe(false);
    expect(spOf(s, "player1", "RK-191:ga")).toBe(0);
  });

  it("RK-191: SP1 になるのはそのターンだけ（次の自軍ターンには「！」に戻る）（出典: atwiki/page-917「このターン」・カード評価「ラッシュしたターンしかストライクできない」）", () => {
    let s = settle(accept(afterRush()));
    s = toPhase(s, "player1", "battle");
    s = passEntry(enter(s, "RK-191:ga"));
    s = endTurn(endTurn(s));
    s = toPhase(s, "player1", "battle");
    s = enter(s, "RK-191:ga");
    expect(spOf(s, "player1", "RK-191:ga")).toBe(0);
  });
});

// ===========================================================================
describe("RK-192 アギト", () => {
  const TEXT = "【アギトファング】これをラッシュしたとき、レジストを持つ敵軍Sユニットを1体選んでもよい。そうしたとき、そのユニットとこのユニットでバトルする。";

  it("RK-192: カタログ本文・スペックが出典と一致（出典: atwiki/page-918）", () => {
    expectCatalogText("RK-192", TEXT);
    expectStats("RK-192", { name: "アギト", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 3, features: ["男", "獣"] });
    expectRarityIn("RK-192", ["N"]);
  });

  const afterRush = (p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushed(rushPhase({ hand: [inst("RK-192", "ag")], command: releasedCat("DA", 1), power: powerCards(3), ...p1 }, p2), "RK-192:ag");

  it("RK-192: 【アギトファング】レジストを持つ敵軍 S ユニットだけから1体選べる（ラッシュエリアも含む。レジストを持たない・M・自軍のユニットは対象外。任意）（出典: atwiki/page-918「レジストを持つ敵軍Sユニットを1体選んでもよい」）", () => {
    const s = afterRush(
      { battle: [inst("RK-194", "g3"), inst("TST-UNIT-0", "plain"), inst("SPEC-RESIST-M", "m")], rush: [inst("RK-191", "ga")] },
      { rush: [inst("SPEC-RESIST1", "mine")] },
    );
    expectChoiceFrom(s, "player1", "RK-192");
    expect(choiceIds(s)).toEqual(["RK-191:ga", "RK-194:g3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-192: 選んだユニットとバトルする — BP の高い相手（ガライ BP5000）に負ければアギトが撃破される（出典: atwiki/page-918「そのユニットとこのユニットでバトルする」）", () => {
    const s = resolveAll(pick(afterRush({ rush: [inst("RK-191", "ga")] }), "RK-191:ga"));
    expect(zoneOf(s, "player1", "RK-192:ag")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-191:ga")).toBe("rush");
  });

  it("RK-192: BP の低い相手（G3-X BP2000）とのバトルに勝てば、相手は撃破される（出典: atwiki/page-918・カード評価「ラッシュ時にレジスト持ちとバトルする」）", () => {
    const s = resolveAll(pick(afterRush({ battle: [inst("RK-194", "g3")] }), "RK-194:g3"));
    expect(zoneOf(s, "player1", "RK-192:ag")).toBe("rush");
    expect(cardIn(s, "player2", "RK-194:g3")?.commandHeld || zoneOf(s, "player2", "RK-194:g3") === "discard").toBe(true);
  });

  it("RK-192: レジストを持つ敵軍 S ユニットがいなければ選択は開かない（出典: atwiki/page-918）", () => {
    const s = settle(afterRush({ battle: [inst("TST-UNIT-0", "plain")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-192");
  });

  it.todo(
    "RK-192: 効果のバトルで負けたレジスト持ちのユニットがレジストを使えるか（出典: docs/rules/07-keywords.md R-KW-RESIST-02）— アタックを経ない効果のバトルでのレジストの可否が未確定（docs/rules/README.md §5.5 30）",
  );
});

// ===========================================================================
describe("RK-193 ズー", () => {
  const TEXT = "【バームニードル】これをラッシュしたとき、カード1枚につきBP1000として、相手の手札の枚数分のBPを計算し、そのBP以下の敵軍ユニットを1体選び撃破してもよい。";

  it("RK-193: カタログ本文・スペックが出典と一致（出典: atwiki/page-919）", () => {
    expectCatalogText("RK-193", TEXT);
    expectStats("RK-193", { name: "ズー", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 4, features: ["女", "昆虫"] });
    expectRarityIn("RK-193", ["N"]);
  });

  const enemyHand = (n: number) => fill(n, "eh");
  const afterRush = (p2: Partial<GameState["players"]["player2"]>) =>
    rushed(rushPhase({ hand: [inst("RK-193", "zu")], command: releasedCat("DA", 1), power: powerCards(4) }, p2), "RK-193:zu");

  it("RK-193: 【バームニードル】相手の手札3枚なら BP3000 以下の敵軍ユニットから1体選べる（サイズ・エリアを問わない。任意）（出典: atwiki/page-919「相手の手札の枚数分のBPを計算し、そのBP以下の敵軍ユニットを1体選び撃破してもよい」・コメント欄「サイズもエリアも関係なしに」）", () => {
    const s = afterRush({ hand: enemyHand(3), battle: [inst("SPEC-E3000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-L3000", "l")], rush: [inst("SPEC-E2000", "r")] });
    expectChoiceFrom(s, "player1", "RK-193");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:r", "SPEC-E3000:a", "SPEC-L3000:l"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-193: 選んだユニットを撃破する（出典: atwiki/page-919「撃破してもよい」）", () => {
    const s = resolveAll(pick(afterRush({ hand: enemyHand(3), battle: [inst("SPEC-L3000", "l")] }), "SPEC-L3000:l"));
    expect(zoneOf(s, "player2", "SPEC-L3000:l")).toBe("discard");
  });

  it("RK-193: 相手の手札が0枚なら選べるユニットはない（出典: atwiki/page-919「相手の手札の枚数分のBP」）", () => {
    const s = settle(afterRush({ hand: [], battle: [inst("SPEC-E2000", "a")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-193");
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
  });

  // atwiki/page-919 Q1「いいえ。「ラッシュしたとき」とある「RK-193 ズー」の【パームニードル】の効果が先に発動し、「RK-305 仮面ライダー電王SF」は「ラッシュされたとき」とある「モーフ」が発動する前に撃破され捨札になります。」
  it("RK-193: 公式Q&A — 【バームニードル】は相手のモーフより先に発動し、モーフを持つユニットはモーフの前に撃破される（出典: atwiki/page-919 Q1・atwiki/page-1275 Q）", () => {
    let s = afterRush({ hand: enemyHand(3), rush: [inst("SPEC-MORPH", "m")], power: [...powerCards(3, "ep"), faceUp("SPEC-MORPH-T", "t")] });
    expectChoiceFrom(s, "player1", "RK-193");
    s = resolveAll(pick(s, "SPEC-MORPH:m"));
    expect(zoneOf(s, "player2", "SPEC-MORPH:m")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MORPH-T:t")).toBe("power");
  });
});

// ===========================================================================
describe("RK-194 仮面ライダーG3-X", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨て札にするかわりにこれをホールドしてその場に留めてもよい） ※これが自軍エリアにある間、自軍ラッシュエリアのSPが空欄のユニットは相手に選ばれない。 【GX-05】ホールド状態の自軍ユニットの数を数えて、その数以下の必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければこの効果は発動できない。";

  it("RK-194: カタログ本文・スペックが出典と一致（出典: atwiki/page-999）", () => {
    expectCatalogText("RK-194", TEXT);
    expectStats("RK-194", { name: "仮面ライダーG3-X", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "メカ", "男", "警察"] });
    expectRarityIn("RK-194", ["SR"]);
  });

  it("RK-194: ※レジスト（出典: atwiki/page-999「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-194", "g3")] }, "RK-194:g3"))).toBe(true);
  });

  /** 敵軍（player2）のターン、player2 がギンガイオー（RS-687【ガルコンボーガン】敵軍ラッシュエリアから BP4000 以下のユニットを1体選び撃破する）をバトルエリアに出す。 */
  const gingaioh = (p1: Partial<GameState["players"]["player1"]>) => {
    const s = boardOf("battle", "player2", p1, { rush: [inst("RS-687", "gg")] }, EXTRA);
    return act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-687:gg" });
  };

  it("RK-194: ※ 自軍エリアにある間、自軍ラッシュエリアの SP が空欄のユニットは相手の効果で選ばれない（SP のあるユニットは選ばれる）（出典: atwiki/page-999「自軍ラッシュエリアのSPが空欄のユニットは相手に選ばれない」・カード評価「あくまで「選ばれない」だけ」）", () => {
    const s = gingaioh({ battle: [inst("RK-194", "g3")], rush: [inst("SPEC-NOSP", "n"), inst("TST-UNIT-0", "u")] });
    expectChoiceFrom(s, "player2", "RS-687");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
  });

  it("RK-194: ※ G3-X がなければ SP が空欄のユニットも選ばれる（出典: atwiki/page-999「これが自軍エリアにある間」）", () => {
    const s = gingaioh({ rush: [inst("SPEC-NOSP", "n"), inst("TST-UNIT-0", "u")] });
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:n", "TST-UNIT-0:u"]);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-C3", "b"), inst("SPEC-M1", "m")], rush: [inst("SPEC-C1", "r")] };
  const rc = (held: number, p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(battlePhase({ rush: [inst("RK-194", "g3"), inst("SPEC-VEHICLE", "v"), ...Array.from({ length: held }, (_, i) => heldUnit("TST-UNIT-0", `h${i}`))] }, p2), "RK-194:g3", "SPEC-VEHICLE:v");

  it("RK-194: RC【GX-05】ホールド状態の自軍ユニットの数（2）以下の必要パワーを持つ、敵軍バトルエリアの S ユニットから1体選ぶ（ラッシュエリア・M は対象外）（出典: atwiki/page-999「その数以下の必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び」）", () => {
    const s = rc(2, { battle: [inst("SPEC-C1", "a"), inst("SPEC-E2000", "two"), inst("SPEC-C3", "b"), inst("SPEC-M1", "m")], rush: [inst("SPEC-C1", "r")] });
    expectChoiceFrom(s, "player1", "RK-194");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-E2000:two"]);
  });

  it("RK-194: RC【GX-05】選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-999「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(rc(1), "SPEC-C1:a"));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-C1:a")?.commandHeld).toBe(true);
  });

  it("RK-194: RC【GX-05】ホールド状態の自軍ユニットがなければ選べるユニットはない（出典: atwiki/page-999「ホールド状態の自軍ユニットの数を数えて」）", () => {
    const s = settle(rc(0));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-194");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-194: RC【GX-05】敵軍コマンドゾーンが満杯で置けなければ発動できない（出典: atwiki/page-999「置けなければこの効果は発動できない」）", () => {
    const full = Array.from({ length: COMMAND_ZONE_MAX }, (_, i) => released("TST-OP", `ec${i}`));
    const s = settle(rc(2, { ...enemy, command: full }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-194");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it.todo(
    "RK-194: 公式Q&A — 敵軍バトルエリアに G3-X と凱聖クールギン（RM-035）があるとき、特徴「メカ」の S ユニットは G3-X にアタック・ストライクできる（出典: atwiki/page-999 Q1）— Q の前提（バトルエリアのクールギンが G3-X の効果で選べない）が本文「自軍ラッシュエリアの」と合わず、どの効果で選べないのかを決められない",
  );
});

// ===========================================================================
describe("RK-195 仮面ライダーG4", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【再起動と暴走】これが自軍エリアにある間、これがホールド状態からリリース状態になったとき、これ以外の自軍Sユニットを1体選びホールドしても良い。そうしたとき、敵軍Sユニットを1体選び撃破する。";

  it("RK-195: カタログ本文・スペックが出典と一致（出典: atwiki/page-957）", () => {
    expectCatalogText("RK-195", TEXT);
    expectStats("RK-195", { name: "仮面ライダーG4", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 4, features: ["仮面ライダー", "メカ", "男"] });
    expectRarityIn("RK-195", ["R"]);
  });

  it("RK-195: ※レジスト（出典: atwiki/page-957「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-195", "g4")] }, "RK-195:g4"))).toBe(true);
  });

  /** ホールド状態の G4 がいる状態で、マジフェニックス（RS-576「※これをラッシュしたとき、ホールド状態の自軍Sユニットをすべてリリースしてもよい」）をラッシュしてリリースする。 */
  const released4 = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-E3000", "a"), inst("TST-UNIT-7", "big")], rush: [inst("SPEC-E2000", "r")] }) => {
    let s = rushed(rushPhase({ hand: [inst("RS-576", "mp")], rush: [heldUnit("RK-195", "g4"), inst("TST-UNIT-0", "mine"), inst("TST-UNIT-2", "mineM")], command: releasedCat("MA", 1), power: powerCards(7), ...p1 }, p2), "RS-576:mp");
    expectChoiceFrom(s, "player1", "RS-576");
    s = accept(s);
    return settle(s);
  };

  it("RK-195: 【再起動と暴走】ホールド状態からリリース状態になったとき、これ以外の自軍 S ユニットを1体選びホールドするかを選べる（M・G4 自身は対象外。任意）（出典: atwiki/page-957「これ以外の自軍Sユニットを1体選びホールドしても良い」）", () => {
    const s = released4();
    expect(cardIn(s, "player1", "RK-195:g4")?.commandHeld ?? false).toBe(false);
    expectChoiceFrom(s, "player1", "RK-195");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:mine"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-195: ホールドしたとき、敵軍 S ユニットを1体選び撃破する（エリアを問わない。M・L は対象外）（出典: atwiki/page-957「そうしたとき、敵軍Sユニットを1体選び撃破する」・カード評価「エリアを選ばずSユニットならば特に条件もなく除去できる」）", () => {
    let s = pick(released4(), "TST-UNIT-0:mine");
    expect(cardIn(s, "player1", "TST-UNIT-0:mine")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-195");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:r", "SPEC-E3000:a"]);
    s = resolveAll(pick(s, "SPEC-E2000:r"));
    expect(zoneOf(s, "player2", "SPEC-E2000:r")).toBe("discard");
  });

  it("RK-195: ホールドしなければ何も撃破しない（出典: atwiki/page-957「そうしたとき」）", () => {
    let s = released4();
    if (s.pendingEffectChoice?.sourceCardId === "RK-195") s = skip(s);
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-E3000:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E2000:r")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-196 クイーンアントロード", () => {
  const TEXT =
    "※レジストを持つ敵軍ユニットがなければ、これはバトルエリアに出られない。 【黄泉の鐙】自軍ターン中、これがバトルエリアに出たとき、レジストを持つユニットを1体選んでもよい。そうしたとき、相手は選ばれたユニットを撃破するか、1点ダメージを受けるか選ぶ。";

  it("RK-196: カタログ本文・スペックが出典と一致（出典: atwiki/page-920）", () => {
    expectCatalogText("RK-196", TEXT);
    expectStats("RK-196", { name: "クイーンアントロード", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 5, features: ["アンノウン", "女王", "女", "昆虫"] });
    expectRarityIn("RK-196", ["NR"]);
  });

  it("RK-196: レジストは持たない（「※レジストを持つ敵軍ユニットがなければ…」はレジストの表記ではない）（出典: atwiki/page-920 本文・docs/rules/07-keywords.md R-KW-00）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-196", "q")] }, "RK-196:q"))).toBe(false);
  });

  it("RK-196: ※ レジストを持つ敵軍ユニットがなければバトルエリアに出られない（自軍のレジスト持ちは数えない）（出典: atwiki/page-920「レジストを持つ敵軍ユニットがなければ、これはバトルエリアに出られない」）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-196", "q"), inst("SPEC-RESIST1", "mine")] }, { battle: [inst("TST-UNIT-0", "e")] }), "RK-196:q")).toBe(false);
  });

  it("RK-196: ※ レジストを持つ敵軍ユニット（ラッシュエリアでもよい）があれば出られる（出典: atwiki/page-920）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-196", "q")] }, { rush: [inst("SPEC-RESIST1", "e")] }), "RK-196:q")).toBe(true);
  });

  const entered = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-RESIST1", "e"), inst("TST-UNIT-0", "plain")] }) =>
    enter(battlePhase({ rush: [inst("RK-196", "q")], ...p1 }, p2), "RK-196:q");

  it("RK-196: 【黄泉の鐙】自軍ターン中、バトルエリアに出たとき、レジストを持つユニット（自軍・敵軍とも）を1体選べる（任意）（出典: atwiki/page-920「レジストを持つユニットを1体選んでもよい」）", () => {
    const s = entered({ rush: [inst("RK-196", "q"), inst("SPEC-RESIST1", "mine")] });
    expectChoiceFrom(s, "player1", "RK-196");
    expect(choiceIds(s)).toEqual(["SPEC-RESIST1:e", "SPEC-RESIST1:mine"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-196: 選ぶと、相手が「選ばれたユニットを撃破する」か「1点ダメージを受ける」かを選ぶ（出典: atwiki/page-920「相手は選ばれたユニットを撃破するか、1点ダメージを受けるか選ぶ」）", () => {
    const s = pick(entered(), "SPEC-RESIST1:e");
    expectChoiceFrom(s, "player2", "RK-196");
    expect(choiceIds(s)).toEqual(["SPEC-RESIST1:e", "damage"].sort());
    expect(canSkip(s)).toBe(false);
  });

  it("RK-196: 相手が撃破を選べば、選ばれたユニットは撃破される（出典: atwiki/page-920）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-RESIST1:e"), "SPEC-RESIST1:e"));
    expect(zoneOf(s, "player2", "SPEC-RESIST1:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-196: 相手がダメージを選べば、相手は1点ダメージを受け、ユニットは残る（出典: atwiki/page-920）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-RESIST1:e"), "damage"));
    expect(zoneOf(s, "player2", "SPEC-RESIST1:e")).toBe("battle");
    expect(damageOf(s, "player2")).toBe(1);
  });
});
