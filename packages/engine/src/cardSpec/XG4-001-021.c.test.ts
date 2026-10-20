/**
 * カード別スペック: XG4-015〜XG4-021（クロスギャザー ザ・ジェットアクセル 血祭ドウコク〜カラクリマント）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に XG のカードの項はない
 *     （「XG4-」とカード名で検索）。本範囲のカードページに atwiki 転載の公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG4-NNN.md。本範囲のライブ写し pages/N.txt はなし）・atwiki/page-266「ジョイントコンビネーション」
 *  3. docs/rules/*.md の一般ルール（R-CARD-04・R-DESTROY-03・R-CTR-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG4-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackersOf,
  canConfirm,
  canCounter,
  canEnter,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  DEFS,
  enemyTurn,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectOperation,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  heldCount,
  inst,
  isExiled,
  mount,
  mountAndRideOff,
  ncEnter,
  opCard,
  p1Battle,
  pick,
  released,
  releasedCat,
  releasedN,
  resolveAll,
  settle,
  skip,
  sUnit,
  useCounter,
  zoneOf,
} from "./XG4-001-021.helpers";

const SP1 = sUnit("SPEC-SP1", { category: "DA", bp: 1000, sp: 1 });
const NOSP = sUnit("SPEC-NOSP", { category: "DA", bp: 1000, sp: undefined });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { bp: 3000, size: "M" });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3, sp: undefined });
const C7 = sUnit("SPEC-C7", { bp: 1000, powerCost: 7, sp: undefined });
const C8 = sUnit("SPEC-C8", { bp: 1000, powerCost: 8, sp: undefined });
const L_OWN = sUnit("SPEC-L-OWN", { category: "OT", bp: 9000, size: "L", powerCost: "7+", sp: undefined });
const L_OWN5 = sUnit("SPEC-L-OWN5", { category: "OT", bp: 9000, size: "L", powerCost: "5+", sp: undefined });
const OP4 = opCard("SPEC-OP4", 4, { category: "DA" });
const OP2 = opCard("SPEC-OP2", 2, { category: "DA" });
const BEAST = sUnit("SPEC-BEAST", { category: "WB", bp: 1000, features: ["獣"] });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 2000 });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 2000 });
const E_C0 = sUnit("SPEC-E-C0", { bp: 1000, powerCost: 0 });
const E_C2 = sUnit("SPEC-E-C2", { bp: 1000, powerCost: 2 });
const E_C3 = sUnit("SPEC-E-C3", { bp: 1000, powerCost: 3 });
const E_C2M = sUnit("SPEC-E-C2M", { bp: 3000, powerCost: 2, size: "M" });
const MA_L = sUnit("SPEC-MA-L", { category: "MA", bp: 9000, size: "L", powerCost: "7+" });
const WB_L = sUnit("SPEC-WB-L", { category: "WB", bp: 9000, size: "L", powerCost: "7+" });
const MA_M = sUnit("SPEC-MA-M", { category: "MA", bp: 3000, size: "M" });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 1000 });
const E_ADD = sUnit("SPEC-E-ADD", { bp: 1000, rushAdditionalCondition: { conditionId: "discard_fusion_unit", text: "自軍合体ユニットを捨札にする" } } as never);
const E_PLAIN = sUnit("SPEC-E-PLAIN", { bp: 1000 });
const E_S = sUnit("SPEC-E-S", { bp: 9000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { bp: 9000, size: "M", sp: undefined });
const EXTRA = [SP1, NOSP, PLAIN_M, C3, C7, C8, L_OWN, L_OWN5, OP4, OP2, BEAST, WB_S, ET_S, E_C0, E_C2, E_C3, E_C2M, MA_L, WB_L, MA_M, MA_S, E_ADD, E_PLAIN, E_S, E_M];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const enter1 = (s: GameState, id: string) => act(s, { type: "move_to_battle", playerId: "player1", instanceId: id });
/** 進入直後の「自軍ターン中、これがバトルエリアに出たとき…してもよい」の確認型の選択が開いていれば、発動を選ぶ。 */
const yes = (s: GameState) => (s.pendingEffectChoice && canConfirm(s) && choiceIds(s).length === 0 ? confirm(s) : s);

// ===========================================================================
describe("XG4-015 血祭ドウコク", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 ※これは、自軍捨札が5枚以上なければバトルエリアに出られない。 【三途の川の御大将】自軍ターン中、これがバトルエリアに出たとき、お互いの捨札にあるSユニットのカードをすべてゲームから除外する。";

  it("XG4-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-2081）", () => {
    expectCatalogText("XG4-015", TEXT);
    expectUnit("XG4-015", { name: "血祭ドウコク", category: "DA", size: "S", bp: 7000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["妖怪", "男"] });
    expectRarityIn("XG4-015", ["N"]);
  });

  it("XG4-015: ※ — 自軍捨札が4枚以下ならバトルエリアに出られない（出典: atwiki/page-2081「自軍捨札が5枚以上なければバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG4-015", "dk")], discard: deckCards(4, "d") }), "XG4-015:dk")).toBe(false);
  });

  it("XG4-015: ※ — 自軍捨札が5枚以上ならバトルエリアに出られる（出典: atwiki/page-2081）", () => {
    expect(canEnter(battle({ rush: [inst("XG4-015", "dk")], discard: deckCards(5, "d") }), "XG4-015:dk")).toBe(true);
  });

  it("XG4-015: ※ — 敵軍ターン中に「SP1」以上のユニットとバトルすると、バトルに勝っても撃破される（出典: atwiki/page-2081「敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("XG4-015", "dk")] }, { battle: [inst("SPEC-SP1", "a")] }, EXTRA), "SPEC-SP1:a", "XG4-015:dk", "player2"));
    expect(zoneOf(s, "player2", "SPEC-SP1:a")).toBe("discard");
    expect(zoneOf(s, "player1", "XG4-015:dk")).toBe("discard");
  });

  it("XG4-015: ※ — SP を持たないユニットとのバトルなら撃破されない（出典: atwiki/page-2081「「SP1」以上のユニット」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("XG4-015", "dk")] }, { battle: [inst("SPEC-NOSP", "a")] }, EXTRA), "SPEC-NOSP:a", "XG4-015:dk", "player2"));
    expect(zoneOf(s, "player1", "XG4-015:dk")).toBe("battle");
  });

  it("XG4-015: ※ — 自軍ターン中に「SP1」以上のユニットとバトルしても撃破されない（出典: atwiki/page-2081「敵軍ターン中、」）", () => {
    let s = battle({ battle: [inst("XG4-015", "dk")], discard: deckCards(5, "d") }, { battle: [inst("SPEC-SP1", "a")] });
    s = resolveAll(attack(s, "XG4-015:dk", "SPEC-SP1:a"));
    expect(zoneOf(s, "player1", "XG4-015:dk")).toBe("battle");
  });

  it("XG4-015:【三途の川の御大将】— 自軍ターン中にバトルエリアに出ると、お互いの捨札の S ユニットのカードをすべて除外する（M ユニット・オペレーションは残る）（出典: atwiki/page-2081「お互いの捨札にあるSユニットのカードをすべてゲームから除外する」）", () => {
    const own = [inst("SPEC-NOSP", "o1"), inst("SPEC-PLAIN-M", "o2"), ...deckCards(3, "d")];
    let s = battle({ rush: [inst("XG4-015", "dk")], discard: own }, { discard: [inst("SPEC-NOSP", "e1"), inst("TST-OP", "e2")] });
    s = resolveAll(yes(enter1(s, "XG4-015:dk")));
    expect(isExiled(s, "player1", "SPEC-NOSP:o1")).toBe(true);
    expect(isExiled(s, "player2", "SPEC-NOSP:e1")).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-PLAIN-M:o2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:e2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-016 タイムファイヤー（XG4）", () => {
  const TEXT =
    "【DVディフェンダー】自軍ターン中、これがバトルエリアに出たとき、自軍Lユニットを1体選んでもよい。そうしたとき、敵軍バトルエリアから、選んだユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("XG4-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-2141）", () => {
    expectCatalogText("XG4-016", TEXT);
    expectUnit("XG4-016", { name: "タイムファイヤー", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["レッド", "男", "Vコマンダー"] });
    expectRarityIn("XG4-016", ["SR"]);
  });

  const ENEMY = { battle: [inst("SPEC-C3", "c3"), inst("SPEC-C7", "c7"), inst("SPEC-C8", "c8")], rush: [inst("SPEC-C3", "r3")] };
  const entered = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter1(battle({ rush: [inst("XG4-016", "tf"), inst("SPEC-L-OWN", "l7"), inst("SPEC-L-OWN5", "l5")], ...p1 }, { ...ENEMY, power: [] }), "XG4-016:tf");

  it("XG4-016:【DVディフェンダー】— 自軍ターン中にバトルエリアに出ると、自軍 L ユニットから1体選べる（任意）（出典: atwiki/page-2141「自軍Lユニットを1体選んでもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-016");
    expect(choiceIds(s)).toEqual(["SPEC-L-OWN5:l5", "SPEC-L-OWN:l7"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-016:【DVディフェンダー】— 選んだ L ユニットの必要パワーの数字（「7+」は7）以下の、敵軍バトルエリアのユニットから1体選ぶ（ラッシュエリア・数字が大きいものは選べない）（出典: atwiki/page-2141「敵軍バトルエリアから、選んだユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び」）", () => {
    const s = pick(entered(), "SPEC-L-OWN:l7");
    expectChoiceFrom(s, "player1", "XG4-016");
    expect(choiceIds(s)).toEqual(["SPEC-C3:c3", "SPEC-C7:c7"]);
  });

  it("XG4-016:【DVディフェンダー】— 選んだ敵軍ユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-2141「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-L-OWN:l7"), "SPEC-C7:c7"));
    expect(zoneOf(s, "player2", "SPEC-C7:c7")).toBe("power");
  });

  it("XG4-016:【DVディフェンダー】— 「5+」の L ユニットを選べば、必要パワー5以下の敵軍ユニットだけ選べる（出典: atwiki/page-2141）", () => {
    const s = pick(entered(), "SPEC-L-OWN5:l5");
    expect(choiceIds(s)).toEqual(["SPEC-C3:c3"]);
  });

  it.todo(
    "XG4-016:【DVディフェンダー】— 敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-2141「自軍ターン中、」）— 敵軍ターン中に自軍のこのユニットをバトルエリアに出す手段（割り込み等）が本範囲のカードだけでは作れないため",
  );
});

// ===========================================================================
describe("XG4-017 ガオシルバー（XG4）", () => {
  const TEXT =
    "【ガオハスラーロッド・スナイパーモード】これがバトルで敵軍ユニットを撃破したとき、これが撃破したユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍コマンドを1つ選び捨札にしてもよい。（この効果は、ライドオフしたときナンバーに関係なく発動する）";

  it("XG4-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-2133）", () => {
    expectCatalogText("XG4-017", TEXT);
    expectUnit("XG4-017", { name: "ガオシルバー", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: 3, features: ["シルバー", "男"] });
    expectRarityIn("XG4-017", ["R"]);
  });

  const ENEMY = () => ({ battle: [inst("SPEC-E-C2", "t")], command: [released("TST-OP-DA", "c1"), released("SPEC-OP2", "c2"), released("TST-OP", "c3"), released("SPEC-OP4", "c4")] });
  const ncAttack = () => {
    let s = ncEnter("XG4-017:gs", 2, {}, ENEMY(), EXTRA);
    for (let i = 0; i < 4 && s.pendingEffectChoice; i++) s = skip(s);
    return settle(attack(s, "XG4-017:gs", "SPEC-E-C2:t"));
  };

  it("XG4-017: NC — 3番目に出てバトルで敵軍ユニットを撃破すると、撃破したユニットの必要パワーの数字以下の敵軍コマンドから1つ選べる（任意）（出典: atwiki/page-2133「これが撃破したユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍コマンドを1つ選び捨札にしてもよい」）", () => {
    const s = ncAttack();
    expectChoiceFrom(s, "player1", "XG4-017");
    expect(choiceIds(s)).toEqual(["SPEC-OP2:c2", "TST-OP-DA:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-017: NC — 選んだ敵軍コマンドは捨札になる（出典: atwiki/page-2133「捨札にしてもよい」）", () => {
    const s = resolveAll(pick(ncAttack(), "SPEC-OP2:c2"));
    expect(zoneOf(s, "player2", "SPEC-OP2:c2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP-DA:c1")).toBe("command");
  });

  it("XG4-017: NC 不成立（2番目）なら、撃破しても発動しない（出典: atwiki/page-2133「CN：3」・R-CN-02）", () => {
    let s = ncEnter("XG4-017:gs", 1, {}, ENEMY(), EXTRA);
    s = settle(attack(s, "XG4-017:gs", "SPEC-E-C2:t"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-017");
    expect(s.players.player2.command).toHaveLength(4);
  });

  it("XG4-017: ライドオフしたとき — ナンバーに関係なく発動する（XG4-009 オートスライダーにライドして出てライドオフ、1番目でも撃破で発動）（出典: atwiki/page-2133「（この効果は、ライドオフしたときナンバーに関係なく発動する）」・カード評価「ライドオフすればナンバー無視で効果を発動できる」）", () => {
    let s = battle({ rush: [inst("XG4-017", "gs"), inst("XG4-009", "as")] }, ENEMY());
    expect(canMount(s, "XG4-017:gs", "XG4-009:as")).toBe(true);
    s = mountAndRideOff(s, "XG4-017:gs", "XG4-009:as");
    for (let i = 0; i < 4 && s.pendingEffectChoice; i++) s = skip(s);
    s = settle(attack(s, "XG4-017:gs", "SPEC-E-C2:t"));
    expectChoiceFrom(s, "player1", "XG4-017");
    expect(choiceIds(s)).toEqual(["SPEC-OP2:c2", "TST-OP-DA:c1"]);
  });
});

// ===========================================================================
describe("XG4-018 ウルフローダー", () => {
  const TEXT =
    "※WBを持つSユニットは、自軍コマンドを1つホールドすればRCを持っていなくてもこのビークルにライドできる。 【白銀の疾風】自軍ターン中、これがバトルエリアに出たとき、特徴「獣」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破してもよい。";

  it("XG4-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-2098）", () => {
    expectCatalogText("XG4-018", TEXT);
    expectVehicle("XG4-018", { name: "ウルフローダー", category: "WB", powerCost: 4, size: "S", features: ["獣", "車両"] });
    expectRarityIn("XG4-018", ["N"]);
  });

  it("XG4-018: ※ — WB を持つ S ユニットは、自軍コマンドを1つホールドすれば RC がなくてもライドできる（ホールドしたコマンドが1つ増える）（出典: atwiki/page-2098「自軍コマンドを1つホールドすればRCを持っていなくてもこのビークルにライドできる」）", () => {
    let s = battle({ rush: [inst("XG4-018", "wl"), inst("SPEC-WB-S", "w")], command: releasedN(1) });
    expect(canMount(s, "SPEC-WB-S:w", "XG4-018:wl")).toBe(true);
    s = mount(s, "SPEC-WB-S:w", "XG4-018:wl");
    expect(heldCount(s)).toBe(1);
  });

  it("XG4-018: ※ — WB を持たない S ユニットはライドできない。リリース状態のコマンドがなければ WB の S ユニットもライドできない（出典: atwiki/page-2098）", () => {
    const s = battle({ rush: [inst("XG4-018", "wl"), inst("SPEC-WB-S", "w"), inst("SPEC-ET-S", "e")], command: releasedN(1) });
    expect(canMount(s, "SPEC-ET-S:e", "XG4-018:wl")).toBe(false);
    const t = battle({ rush: [inst("XG4-018", "wl"), inst("SPEC-WB-S", "w")], command: [] });
    expect(canMount(t, "SPEC-WB-S:w", "XG4-018:wl")).toBe(false);
  });

  const ENEMY = { battle: [inst("SPEC-E-C0", "c0"), inst("SPEC-E-C2", "c2"), inst("SPEC-E-C2M", "m2")], rush: [inst("SPEC-E-C3", "c3")] };
  /** 特徴「獣」の自軍ユニット beasts 体（ラッシュエリア）と、ウルフローダーに乗る WB の S ユニット。 */
  const ridden = (beasts: number) => {
    let s = battle({ rush: [inst("XG4-018", "wl"), inst("SPEC-WB-S", "w"), ...Array.from({ length: beasts }, (_, i) => inst("SPEC-BEAST", `b${i}`))], command: releasedN(1) }, ENEMY);
    s = mount(s, "SPEC-WB-S:w", "XG4-018:wl");
    return s;
  };

  it("XG4-018:【白銀の疾風】— 自軍ターン中にバトルエリアに出ると、特徴「獣」の自軍ユニットの数（ビークルのこれ自身は数えない）以下の必要パワーの数字を持つ敵軍 S ユニット（エリアを問わない）から1体選べる（任意）（出典: atwiki/page-2098「特徴「獣」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破してもよい」・R-CARD-04（ビークルはユニットではない）・カード評価「エリアを問わず除去できる」）", () => {
    const s = ridden(2);
    expectChoiceFrom(s, "player1", "XG4-018");
    expect(choiceIds(s)).toEqual(["SPEC-E-C0:c0", "SPEC-E-C2:c2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-018:【白銀の疾風】— 選んだ敵軍 S ユニットは撃破される（出典: atwiki/page-2098「撃破してもよい」）", () => {
    const s = resolveAll(pick(ridden(3), "SPEC-E-C3:c3"));
    expect(zoneOf(s, "player2", "SPEC-E-C3:c3")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-019 ピタットヒトデ", () => {
  const TEXT =
    "※これはSユニットにアタックされない。 【スターライトニードロップ】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍コマンドゾーンからカードを1枚選び、持ち主の手札に戻す。";

  it("XG4-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-2089）", () => {
    expectCatalogText("XG4-019", TEXT);
    expectUnit("XG4-019", { name: "ピタットヒトデ", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 3, comboNumber: "R", features: ["メカ", "カラクリボール"] });
    expectRarityIn("XG4-019", ["N"]);
  });

  it("XG4-019: ※ — S ユニットにはアタックされない（M ユニットにはアタックされる）（出典: atwiki/page-2089「※これはSユニットにアタックされない」）", () => {
    const s = enemyTurn({ battle: [inst("XG4-019", "ph")] }, { battle: [inst("SPEC-E-S", "s"), inst("SPEC-E-M", "m")] }, EXTRA);
    expect(attackersOf(s, "XG4-019:ph")).toEqual(["SPEC-E-M:m"]);
  });

  const jc = (left: string) => enter1(battle({ battle: [inst(left, "l")], rush: [inst("XG4-019", "ph")] }, { command: [released("TST-OP", "c1"), { ...inst("TST-OP-DA", "c2"), commandHeld: true }] }), "XG4-019:ph");

  it("XG4-019:【スターライトニードロップ】— MA の L ユニットの右に出て JC が成立すると、敵軍コマンドゾーンのカード（ホールド状態を含む）から1枚選べる（出典: atwiki/page-2089「これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍コマンドゾーンからカードを1枚選び」・atwiki/page-266（「R」は右に並べる））", () => {
    const s = yes(jc("SPEC-MA-L"));
    expectChoiceFrom(s, "player1", "XG4-019");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:c2", "TST-OP:c1"]);
  });

  it("XG4-019:【スターライトニードロップ】— 選んだカードは持ち主（相手）の手札に戻る（出典: atwiki/page-2089「持ち主の手札に戻す」）", () => {
    const s = resolveAll(pick(yes(jc("SPEC-MA-L")), "TST-OP:c1"));
    expect(zoneOf(s, "player2", "TST-OP:c1")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP-DA:c2")).toBe("command");
  });

  it("XG4-019:【スターライトニードロップ】— 違うカテゴリ（WB）の L ユニットからは発動しない（出典: atwiki/page-2089「同カテゴリのLユニット」）", () => {
    const s = jc("SPEC-WB-L");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-019");
    expect(s.players.player2.command).toHaveLength(2);
  });
});

// ===========================================================================
describe("XG4-020 リボルバーマンモス", () => {
  const TEXT =
    "※これは自軍コマンドを2つホールドしなければバトルエリアに出られない。 【カラクリボール発射】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードがMAのMユニットのカードだったなら、追加条件を持たない敵軍ユニットを1体選び、持ち主の手札に戻す。その後、オモテにしたカードを手札に加える。";

  it("XG4-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-2106）", () => {
    expectCatalogText("XG4-020", TEXT);
    expectUnit("XG4-020", { name: "リボルバーマンモス", category: "MA", size: "XL", bp: 5000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["メカ", "母艦"] });
    expectRarityIn("XG4-020", ["NR"]);
  });

  it("XG4-020: ※ — リリース状態の自軍コマンドが1つしかなければバトルエリアに出られない（出典: atwiki/page-2106「自軍コマンドを2つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG4-020", "rm")], command: releasedN(1) }), "XG4-020:rm")).toBe(false);
  });

  it("XG4-020: ※ — 自軍コマンドを2つホールドしてバトルエリアに出る（出典: atwiki/page-2106）", () => {
    const s = enterHold(battle({ rush: [inst("XG4-020", "rm")], command: releasedN(3) }), "XG4-020:rm");
    expect(zoneOf(s, "player1", "XG4-020:rm")).toBe("battle");
    expect(heldCount(s)).toBe(2);
  });

  const ENEMY = { battle: [inst("SPEC-E-PLAIN", "p"), inst("SPEC-E-ADD", "a")], rush: [inst("SPEC-E-M", "m")] };
  const entered = (top: ReturnType<typeof inst>) => enterHold(battle({ rush: [inst("XG4-020", "rm")], command: releasedN(2), deck: [top, ...deckCards(3)], hand: [] }, ENEMY), "XG4-020:rm");

  it("XG4-020:【カラクリボール発射】— 自軍ターン中にバトルエリアに出ると、山札の上から1枚をオモテにするかを選べる（任意）（出典: atwiki/page-2106「自軍山札の上から1枚をオモテにしてもよい」）", () => {
    const s = entered(inst("SPEC-MA-M", "top"));
    expectChoiceFrom(s, "player1", "XG4-020");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-020:【カラクリボール発射】— オモテにしたカードが MA の M ユニットなら、追加条件を持たない敵軍ユニット（エリア・サイズを問わない）から1体選び持ち主の手札に戻し、オモテにしたカードを手札に加える（出典: atwiki/page-2106「追加条件を持たない敵軍ユニットを1体選び、持ち主の手札に戻す。その後、オモテにしたカードを手札に加える」・コメント欄「サイズ・エリアを問わない除去」）", () => {
    let s = yes(entered(inst("SPEC-MA-M", "top")));
    expectChoiceFrom(s, "player1", "XG4-020");
    expect(choiceIds(s)).toEqual(["SPEC-E-M:m", "SPEC-E-PLAIN:p"]);
    s = resolveAll(pick(s, "SPEC-E-M:m"));
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-MA-M:top")).toBe("hand");
  });

  it("XG4-020:【カラクリボール発射】— MA の M ユニットでなくても、オモテにしたカードは手札に加える（敵軍ユニットは戻さない）（出典: atwiki/page-2106「その後、オモテにしたカードを手札に加える」・コメント欄「「その後」だからできる」）", () => {
    const s = resolveAll(yes(entered(inst("SPEC-MA-S", "top"))));
    expect(zoneOf(s, "player1", "SPEC-MA-S:top")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-E-PLAIN:p")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("rush");
  });

  it("XG4-020:【カラクリボール発射】— オモテにしなければ山札はそのまま（出典: atwiki/page-2106「してもよい」）", () => {
    const s = resolveAll(skip(entered(inst("SPEC-MA-M", "top"))));
    expect(zoneOf(s, "player1", "SPEC-MA-M:top")).toBe("deck");
  });
});

// ===========================================================================
describe("XG4-021 カラクリマント", () => {
  const TEXT =
    "※カウンター 自軍Lユニットがアタックされたとき発動できる⇒アタックしてきたユニットを持ち主のパワーゾーンにダメージにして置く。このとき、バトルは行われない。";

  it("XG4-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-2054）", () => {
    expectCatalogText("XG4-021", TEXT);
    expectOperation("XG4-021", { name: "カラクリマント", category: "MA", powerCost: 5 });
    expectRarityIn("XG4-021", ["N"]);
  });

  it("XG4-021: カタログの特徴 — オペレーションだが特徴「カラクリボール」を持つ（出典: atwiki/page-2054「特徴：カラクリボール」）", () => {
    expect(DEFS["XG4-021"]?.features ?? []).toEqual(["カラクリボール"]);
  });

  const attacked = (target: string) => {
    const s = enemyTurn(
      { battle: [inst("SPEC-MA-L", "l"), inst("SPEC-MA-S", "s")], hand: [inst("XG4-021", "op")], command: releasedCat("MA", 1), power: [...Array.from({ length: 5 }, (_, i) => inst("TST-P", `pw${i}`))] },
      { battle: [inst("TST-UNIT-7", "atk")], power: [] },
      EXTRA,
    );
    return attack(s, "TST-UNIT-7:atk", target, "player2");
  };

  it("XG4-021: 自軍 L ユニットがアタックされたとき使える（S ユニットのときは使えない）（出典: atwiki/page-2054「自軍Lユニットがアタックされたとき発動できる」）", () => {
    expect(canCounter(attacked("SPEC-MA-L:l"), "XG4-021:op")).toBe(true);
    expect(canCounter(attacked("SPEC-MA-S:s"), "XG4-021:op")).toBe(false);
  });

  it("XG4-021: アタックしてきたユニットは持ち主のパワーゾーンにダメージ（ウラ向き）で置かれ、バトルは行われない（L ユニットは残る）（出典: atwiki/page-2054「アタックしてきたユニットを持ち主のパワーゾーンにダメージにして置く。このとき、バトルは行われない」）", () => {
    const s = resolveAll(useCounter(attacked("SPEC-MA-L:l"), "XG4-021:op"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-7:atk")?.faceDown).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-MA-L:l")).toBe("battle");
    expect(zoneOf(s, "player1", "XG4-021:op")).toBe("discard");
  });
});

