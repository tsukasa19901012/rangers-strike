/**
 * カード別スペック: RK-225〜RK-231（ザ・マスクドライダーEXP vol.3 仮面ライダー朱鬼〜オロチ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RK-231 のテキスト修正。R-ERR-RK231）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない
 *     （rider_1〜4・rider.html を検索）。atwiki に転載された公式 Q&A（RK-231 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-SCRUM-01、R-KW-RESIST、R-CN-02 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-231【潜水】（ターンを終えるときのリリース／ホールド・ホールド状態のときの制限）— rulesSpec/08-errata.s2-atwiki.test.ts R-ERR-RK231、
 *    errataCardEffects.test.ts
 *  - RK-231 Q1（ダイヤジャック【ダイヤソード】と【潜水】でホールドしたオロチ）— cardSpec/RS9-605-626.b.test.ts RS-613（atwiki/page-1452 Q2 と同じ問い）
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  NOSP_ATTACKER,
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  inst,
  legal,
  ncEnter,
  nextPhase,
  p1Battle,
  pick,
  powerCards,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushed,
  scrumTests,
  settle,
  st,
  sUnit,
  zoneOf,
} from "./RK11-211-231.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const DA1 = sUnit("SPEC-DA1", { category: "DA", bp: 1000, powerCost: 1 });
const ATK_S = sUnit("SPEC-ATK-S", { bp: 2500 });
const KAMEN_MAN = sUnit("SPEC-KAMEN-MAN", { bp: 1000, features: ["仮面ライダー", "男"] });
const KAMEN_MAN_TAKESHI = sUnit("SPEC-KAMEN-MAN-T", { bp: 1000, features: ["仮面ライダー", "男", "猛士"] });
const KAMEN_ONLY = sUnit("SPEC-KAMEN-ONLY", { bp: 1000, features: ["仮面ライダー"] });
const EXTRA = [PLAIN_VEHICLE, NOSP_ATTACKER, C1, C3, C5, M2, DA1, ATK_S, KAMEN_MAN, KAMEN_MAN_TAKESHI, KAMEN_ONLY];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const faceUp = (cardId: string, suf: string): CardInstance => ({ ...inst(cardId, suf), faceDown: false });
const faceDown = (cardId: string, suf: string): CardInstance => ({ ...inst(cardId, suf), faceDown: true });

// ===========================================================================
describe("RK-225 仮面ライダー朱鬼", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。 【陰陽術】これが自軍エリアにある間（これをラッシュしたときも含む）、自分も相手もカウンターを持つオペレーションカードを使用するとき、その必要パワーの数字は3少なくなる（この効果は重複しない）。";

  it("RK-225: カタログ本文・スペックが出典と一致（出典: atwiki/page-901）", () => {
    expectCatalogText("RK-225", TEXT);
    expectStats("RK-225", { name: "仮面ライダー朱鬼", category: "MA", size: "S", bp: 500, sp: "1/3", powerCost: 1, features: ["仮面ライダー", "女", "猛士"] });
    expectRarityIn("RK-225", ["NR"]);
  });

  it("RK-225: ※ ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-901「※これはラッシュしたターンにバトルエリアに出られない」）", () => {
    let s = rushed(rushPhase({ hand: [inst("RK-225", "sk")], command: releasedCat("MA", 1), power: powerCards(1) }), "RK-225:sk");
    s = nextPhase(settle(s));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RK-225:sk")).toBe(false);
  });

  /** 敵軍（player2）ターン、player2 の S ユニット（BP2500）が自軍の TST-UNIT-0 にアタックした（カウンターの窓が開いている）。 */
  const attacked = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    attack(
      enemyTurn({ battle: [inst("TST-UNIT-0", "d")], command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], ...p1 }, { battle: [inst("SPEC-ATK-S", "a")], ...p2 }),
      "SPEC-ATK-S:a",
      "TST-UNIT-0:d",
      "player2",
    );
  const canCounter = (s: GameState, id: string) =>
    legal(s).some((a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === id) || (a.type === "play_counter" && a.instanceId === id));

  it("RK-225: 【陰陽術】自軍エリアにある間、自分がカウンターを持つオペレーション（RK-004 ギギの腕輪・必要パワー3）を使うとき必要パワーが3少なくなり、パワー0でも使える（出典: atwiki/page-901「その必要パワーの数字は3少なくなる」）", () => {
    expect(canCounter(attacked({ hand: [inst("RK-004", "g")], power: [], rush: [inst("RK-225", "sk")] }), "RK-004:g")).toBe(true);
  });

  it("RK-225: 朱鬼が場になければ、パワー0では使えない（出典: atwiki/page-901「これが自軍エリアにある間」）", () => {
    expect(canCounter(attacked({ hand: [inst("RK-004", "g")], power: [] }), "RK-004:g")).toBe(false);
  });

  it("RK-225: 「自分も相手も」— 敵軍の朱鬼でも、自分のカウンターの必要パワーが3少なくなる（出典: atwiki/page-901「自分も相手もカウンターを持つオペレーションカードを使用するとき」）", () => {
    expect(canCounter(attacked({ hand: [inst("RK-004", "g")], power: [] }, { rush: [inst("RK-225", "sk")] }), "RK-004:g")).toBe(true);
  });

  it("RK-225: 重複しない — 朱鬼が2体あっても3少なくなるだけ（RK-009 Kの石・必要パワー5は、パワー1では使えず、パワー2なら使える）（出典: atwiki/page-901「（この効果は重複しない）」）", () => {
    const two = [inst("RK-225", "sk"), inst("RK-225", "sk2")];
    expect(canCounter(attacked({ hand: [inst("RK-009", "k")], power: powerCards(1), rush: two }), "RK-009:k")).toBe(false);
    expect(canCounter(attacked({ hand: [inst("RK-009", "k")], power: powerCards(2), rush: two }), "RK-009:k")).toBe(true);
  });

  it.todo(
    "RK-225: 「（これをラッシュしたときも含む）」— 朱鬼がラッシュされたときに使うカウンターにも効く（出典: atwiki/page-901）— 朱鬼のラッシュに反応して使えるカウンターの組み合わせを本範囲のカードで組めない",
  );
});

// ===========================================================================
describe("RK-226 仮面ライダー歌舞鬼", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【音撃打・業火絢爛】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアからDAを持つ自軍ユニットを1体選び捨札にしてもよい。そうしたとき、自分は1枚ドローする。";

  it("RK-226: カタログ本文・スペックが出典と一致（出典: atwiki/page-935）", () => {
    expectCatalogText("RK-226", TEXT);
    expectStats("RK-226", { name: "仮面ライダー歌舞鬼", category: "MA", size: "S", bp: 1000, sp: undefined, powerCost: 2, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-226", ["N"]);
  });

  it("RK-226: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-935「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-226", "kb")] }, "RK-226:kb"))).toBe(true);
  });

  const entered = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(board({ rush: [inst("RK-226", "kb"), inst("SPEC-DA1", "d1"), inst("SPEC-C1", "c")], battle: [inst("SPEC-DA1", "db")], hand: [], deck: deckCards(3), ...p1 }), "RK-226:kb");

  it("RK-226: 【音撃打・業火絢爛】自軍ターン中、バトルエリアに出たとき、自軍ラッシュエリアの DA を持つ自軍ユニットから1体選んで捨札にできる（任意。バトルエリア・DA 以外は対象外）（出典: atwiki/page-935「自軍ラッシュエリアからDAを持つ自軍ユニットを1体選び捨札にしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-226");
    expect(choiceIds(s)).toEqual(["SPEC-DA1:d1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-226: 捨札にすると、自分は1枚ドローする（出典: atwiki/page-935「そうしたとき、自分は1枚ドローする」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DA1:d1"));
    expect(zoneOf(s, "player1", "SPEC-DA1:d1")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(1);
  });

  it("RK-226: 自軍ラッシュエリアに DA のユニットがなければ発動しない（出典: atwiki/page-935）", () => {
    const s = entered({ rush: [inst("RK-226", "kb"), inst("SPEC-C1", "c")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-226");
  });

  it("RK-226: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-935「自軍ターン中、」）", () => {
    let s = enemyTurn({ rush: [inst("RK-226", "kb"), inst("SPEC-DA1", "d1")] }, { rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] });
    s = act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-139:af", vehicleInstanceId: "SPEC-VEHICLE:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player2", rideOff: true });
    s = pick(s, "RK-226:kb");
    expect(zoneOf(s, "player1", "RK-226:kb")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-226");
  });
});

// ===========================================================================
describe("RK-227 仮面ライダー凍鬼", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【音撃殴・一撃怒涛】自軍と敵軍の常駐置き場にあるカードの枚数を数えて、その枚数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-227: カタログ本文・スペックが出典と一致（出典: atwiki/page-936）", () => {
    expectCatalogText("RK-227", TEXT);
    expectStats("RK-227", { name: "仮面ライダー凍鬼", category: "MA", size: "S", bp: 4000, sp: undefined, powerCost: 5, comboNumber: 7, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-227", ["N"]);
  });

  it("RK-227: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-936「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-227", "tk")] }, "RK-227:tk"))).toBe(true);
  });

  // 自軍の常駐置き場: 常駐1枚＋重ねたカード2枚、敵軍の常駐置き場: 常駐1枚 → 4枚。
  const OWN_RESIDENT = [{ ...inst("TST-OP", "res"), stackedCards: [inst("TST-OP", "st1"), inst("TST-OP", "st2")] }];
  const enemy = (operation: CardInstance[] = [inst("TST-OP", "eres")]) => ({
    battle: [inst("SPEC-C1", "a"), inst("SPEC-C5", "f"), inst("SPEC-M2", "m"), inst("TST-UNIT-0", "z")],
    rush: [inst("SPEC-C3", "r")],
    operation,
  });
  const nc = (own: CardInstance[] = OWN_RESIDENT, p2: Partial<GameState["players"]["player2"]> = enemy()) =>
    ncEnter("RK-227:tk", 6, { operation: own }, p2, EXTRA);

  it("RK-227: 【音撃殴・一撃怒涛】NC — 自軍と敵軍の常駐置き場のカードの枚数（重ねたカードを含めて4）以下の必要パワーの数字を持つ敵軍ユニット（サイズ・エリアを問わない）から1体選べる（任意）（出典: atwiki/page-936「その枚数以下の必要パワーの数字を持つ敵軍ユニットを1体選び」・コメント欄「ライドブッカーで４枚+相手の常駐以下」「場所・サイズも問わない」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-227");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C3:r", "SPEC-M2:m", "TST-UNIT-0:z"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-227: 選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-936「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(pick(nc(), "SPEC-C3:r"));
    expect(zoneOf(s, "player2", "SPEC-C3:r")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C3:r")?.faceDown).toBe(true);
  });

  it("RK-227: 常駐置き場が空なら0と数え、必要パワー0のユニットだけが候補（出典: atwiki/page-936「その枚数以下」）", () => {
    const s = nc([], enemy([]));
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:z"]);
  });
});

// ===========================================================================
describe("RK-228 仮面ライダー羽撃鬼", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【音撃奏・旋風一閃】自分の手札より相手の手札の枚数が多ければ、相手の手札を見ないで1枚選んでもよい。 そうしたとき、選んだカードを持ち主の山札の上に戻す。";

  it("RK-228: カタログ本文・スペックが出典と一致（出典: atwiki/page-937）", () => {
    expectCatalogText("RK-228", TEXT);
    expectStats("RK-228", { name: "仮面ライダー羽撃鬼", category: "MA", size: "S", bp: 500, sp: "1/3", powerCost: 2, comboNumber: 4, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-228", ["N"]);
  });

  scrumTests("RK-228", 4, "atwiki/page-937");

  const nc = (myHand: CardInstance[], oppHand: CardInstance[]) => ncEnter("RK-228:hb", 3, { hand: myHand }, { hand: oppHand, deck: deckCards(3, "e") }, EXTRA);
  const OPP = [inst("TST-OP", "o1"), inst("SPEC-C1", "o2")];

  it("RK-228: 【音撃奏・旋風一閃】NC — 自分の手札（0枚）より相手の手札（2枚）が多ければ、相手の手札から1枚選べる（任意）（出典: atwiki/page-937「自分の手札より相手の手札の枚数が多ければ、相手の手札を見ないで1枚選んでもよい」）", () => {
    const s = nc([], OPP);
    expectChoiceFrom(s, "player1", "RK-228");
    expect(choiceIds(s)).toEqual(["SPEC-C1:o2", "TST-OP:o1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-228: 選んだカードを持ち主の山札の上に戻す（出典: atwiki/page-937「選んだカードを持ち主の山札の上に戻す」）", () => {
    const s = resolveAll(pick(nc([], OPP), "SPEC-C1:o2"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-C1:o2");
    expect(s.players.player2.hand.map((c) => c.instanceId)).toEqual(["TST-OP:o1"]);
  });

  it("RK-228: 手札の枚数が同じなら発動しない（出典: atwiki/page-937「相手の手札の枚数が多ければ」）", () => {
    const s = nc([inst("TST-OP", "m1"), inst("TST-OP", "m2")], OPP);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-228");
  });
});

// ===========================================================================
describe("RK-229 仮面ライダー煌鬼", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【音撃拍・軽佻訃爆】敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、敵軍パワーゾーンのオモテ向きのカードから、選んだユニットの持つ特徴をすべて持つユニットカードを1枚選び、ウラ向きにしてダメージにする。";

  it("RK-229: カタログ本文・スペックが出典と一致（出典: atwiki/page-938）", () => {
    expectCatalogText("RK-229", TEXT);
    expectStats("RK-229", { name: "仮面ライダー煌鬼", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: 6, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-229", ["N"]);
  });

  scrumTests("RK-229", 6, "atwiki/page-938");

  const enemy = {
    battle: [inst("SPEC-KAMEN-MAN", "k"), inst("SPEC-M2", "m")],
    rush: [inst("SPEC-KAMEN-MAN", "kr")],
    power: [faceUp("SPEC-KAMEN-MAN-T", "p1"), faceUp("SPEC-KAMEN-ONLY", "p2"), faceDown("SPEC-KAMEN-MAN", "p3"), faceUp("TST-OP", "p4")],
  };
  const nc = () => ncEnter("RK-229:kr", 5, {}, enemy, EXTRA);

  it("RK-229: 【音撃拍・軽佻訃爆】NC — 敵軍バトルエリアのユニット（サイズを問わない。ラッシュエリアは対象外）から1体選べる（任意）（出典: atwiki/page-938「敵軍バトルエリアからユニットを1体選んでもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-229");
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN-MAN:k", "SPEC-M2:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-229: 選ぶと、敵軍パワーゾーンのオモテ向きのカードから、選んだユニットの特徴（仮面ライダー・男）をすべて持つユニットカードを1枚選ぶ（ウラ向き・特徴が足りないもの・オペレーションは対象外）（出典: atwiki/page-938「敵軍パワーゾーンのオモテ向きのカードから、選んだユニットの持つ特徴をすべて持つユニットカードを1枚選び」）", () => {
    const s = pick(nc(), "SPEC-KAMEN-MAN:k");
    expectChoiceFrom(s, "player1", "RK-229");
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN-MAN-T:p1"]);
  });

  it("RK-229: 選んだカードをウラ向きにしてダメージにする（もとのウラ向き1枚と合わせて2点）。選んだユニットは場に残る（出典: atwiki/page-938「ウラ向きにしてダメージにする」・コメント欄「ユニットは除去しない」・R-DMG-01）", () => {
    const s = resolveAll(pick(pick(nc(), "SPEC-KAMEN-MAN:k"), "SPEC-KAMEN-MAN-T:p1"));
    expect(cardIn(s, "player2", "SPEC-KAMEN-MAN-T:p1")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(2);
    expect(zoneOf(s, "player2", "SPEC-KAMEN-MAN:k")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-230 仮面ライダー西鬼", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない） 【音撃響・偉羅射威】敵軍ユニットの下にオモテ向きで重ねたオペレーションカードを1体選んでもよい。そうしたとき、選んだカードを持ち主の山札に戻してシャッフルする。";

  it("RK-230: カタログ本文・スペックが出典と一致（出典: atwiki/page-939）", () => {
    expectCatalogText("RK-230", TEXT);
    expectStats("RK-230", { name: "仮面ライダー西鬼", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 3, comboNumber: 5, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-230", ["N"]);
  });

  scrumTests("RK-230", 5, "atwiki/page-939");

  const enemy = {
    battle: [
      { ...inst("SPEC-C1", "a"), stackedCards: [faceUp("TST-OP", "s1"), faceDown("TST-OP", "s2")] },
      { ...inst("SPEC-M2", "m"), stackedCards: [faceUp("TST-OP-MA", "s3")] },
    ],
    rush: [{ ...inst("SPEC-C3", "r"), stackedCards: [faceUp("TST-OP", "s4")] }],
    deck: deckCards(3, "e"),
  };
  const nc = () => ncEnter("RK-230:ns", 4, { rush: [{ ...inst("SPEC-C1", "own"), stackedCards: [faceUp("TST-OP", "mine")] }] }, enemy, EXTRA);

  it("RK-230: 【音撃響・偉羅射威】NC — 敵軍ユニット（サイズ・エリアを問わない）の下にオモテ向きで重ねたオペレーションカードから1枚選べる（任意。ウラ向き・自軍ユニットのものは対象外）（出典: atwiki/page-939「敵軍ユニットの下にオモテ向きで重ねたオペレーションカードを1体選んでもよい」・カード評価「サイズを問わない」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-230");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:s3", "TST-OP:s1", "TST-OP:s4"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-230: 選んだカードを持ち主の山札に戻す（重ねていたユニットは場に残る）（出典: atwiki/page-939「選んだカードを持ち主の山札に戻してシャッフルする」）", () => {
    const s = resolveAll(pick(nc(), "TST-OP-MA:s3"));
    expect(zoneOf(s, "player2", "TST-OP-MA:s3")).toBe("deck");
    expect(s.players.player2.deck).toHaveLength(4);
    expect(zoneOf(s, "player2", "SPEC-M2:m")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-M2:m")?.stackedCards ?? []).toHaveLength(0);
  });
});

// ===========================================================================
describe("RK-231 オロチ", () => {
  // エラッタ後のテキスト（atwiki/page-948「修正後は以下」。docs/rules/08-errata.md R-ERR-RK231）
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【潜水】自分がターンを終えるとき、このユニットをリリースするか、ホールドしてもよい。 これはホールド状態のとき、アタックもストライクもすることができず、敵軍ユニットにアタックされない。";

  it("RK-231: カタログ本文（エラッタ後）・スペックが出典と一致（出典: atwiki/page-948「修正後は以下」）", () => {
    expectCatalogText("RK-231", TEXT);
    expectStats("RK-231", { name: "オロチ", category: "DA", size: "M", bp: 6000, sp: 1, powerCost: "4+", features: ["魔化魍"], rushCondition: "discard_feature_unit" });
    expectRarityIn("RK-231", ["N"]);
  });

  it("RK-231: 追加条件 — 特徴「女」を持つ自軍ユニット（RK-212 仮面ライダーラルク）を1体捨札にして、パワー4でラッシュできる（出典: atwiki/page-948「必要パワー：4+」「追加条件：特徴「女」を持つ自軍ユニットを1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-231", "or")], rush: [inst("RK-212", "lk"), inst("SPEC-C1", "c")], command: releasedCat("DA", 1), power: powerCards(4) }), "player1", "RK-231:or", { materials: ["RK-212:lk"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-231:or")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-212:lk")).toBe("discard");
  });

  it("RK-231: ※ 敵軍ターン中、SP1 の敵軍ユニットにアタックされてバトルに勝っても撃破される（出典: atwiki/page-948「※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-231", "or")] }, { battle: [inst("TST-UNIT-0", "a")] }), "TST-UNIT-0:a", "RK-231:or", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-231:or")).toBe("discard");
  });

  it("RK-231: ※ SP「－」の敵軍ユニットとのバトルに勝ったときは残る（出典: atwiki/page-948「SP1以上のユニットと」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-231", "or")] }, { battle: [inst("SPEC-NOSP", "a")] }), "SPEC-NOSP:a", "RK-231:or", "player2"));
    expect(zoneOf(s, "player1", "RK-231:or")).toBe("battle");
  });

  it("RK-231: ※ 自軍ターン中に SP1 の敵軍ユニットにアタックして勝ったときは残る（出典: atwiki/page-948「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-231", "or")] }, { battle: [inst("TST-UNIT-0", "e")] }), "RK-231:or", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-231:or")).toBe("battle");
  });
});
