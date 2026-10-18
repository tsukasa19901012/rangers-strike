/**
 * カード別スペック: RM-050〜RM-056（スペシャルメタルエディション 隊員コード071 シグ〜ジースタッグ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「RM-050」〜「RM-056」とカード名で検索）。本範囲のカードページに atwiki 転載の公式 Q&A はない（ほかのカードのページの Q&A にも出てこない）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-CN-01・R-CN-05・R-ADD-07・R-START-01/02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマルレア／ノーマル」を SR／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  attackUntilRegister,
  bpOf,
  canEnter,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  deckCards,
  endTurnKeep,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  heldN,
  heldUnit,
  inst,
  mount,
  ncEnter,
  pick,
  pickAs,
  registerOffered,
  releasedCat,
  resolveAll,
  ridingPair,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  vehicleCard,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM3-043-062.helpers";

const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M" });
const OT_M = sUnit("SPEC-OT-M", { category: "OT", bp: 3000, size: "M" });
const MECHA = sUnit("SPEC-MECHA", { category: "ET", bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { category: "ET", bp: 3000, size: "M", features: ["メカ"] });
const INSECT = sUnit("SPEC-INSECT", { category: "WB", bp: 1000, sp: undefined, features: ["昆虫"] });
const NOINSECT = sUnit("SPEC-NOINSECT", { category: "WB", bp: 1000, sp: undefined, features: ["男"] });
const AIR = sUnit("SPEC-AIR", { category: "DA", bp: 1000, features: ["航空機"] });
const AIR_M = sUnit("SPEC-AIR-M", { category: "DA", bp: 3000, size: "M", features: ["航空機"] });
const AIR_HI = sUnit("SPEC-AIR-HI", { category: "DA", bp: 3500, features: ["航空機"] });
const M_VEHICLE = vehicleCard("SPEC-MV", { size: "M" });
const EXTRA = [ES, EM, DA_S, DA_M, OT_M, MECHA, MECHA_M, INSECT, NOINSECT, AIR, AIR_M, AIR_HI, M_VEHICLE, PLAIN_VEHICLE];

const battleBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RM-050 隊員コード071 シグ", () => {
  const TEXT =
    "【ミサイルランチャー】敵軍パワーゾーンのオモテ向きのカードにSユニットのカードが無ければ、次の効果を発動できる⇒DAまたはOTを持つ敵軍Mユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。（この効果は、特徴「スワット」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する）";

  it("RM-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-859）", () => {
    expectCatalogText("RM-050", TEXT);
    expectStats("RM-050", { name: "隊員コード071 シグ", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 1, comboNumber: 3, features: ["男", "警察", "スワット"] });
    expectRarityIn("RM-050", ["N"]);
  });

  const ENEMY = { battle: [inst("SPEC-DA-M", "dm"), inst("SPEC-OT-M", "om"), inst("SPEC-EM", "wm"), inst("SPEC-DA-S", "ds")], rush: [inst("SPEC-DA-M", "rm")] };
  const nc = (fillerCount: number, p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) =>
    ncEnter("RM-050:sg", fillerCount, p1, { ...ENEMY, ...p2 }, EXTRA);

  it("RM-050: NC【ミサイルランチャー】— 敵軍パワーゾーンのオモテ向きのカードに S ユニットのカードがなければ、DA か OT を持つ敵軍 M ユニット（エリアを問わない）から1体選べる（WB・S ユニットは選べない。任意）（出典: atwiki/page-859「敵軍パワーゾーンのオモテ向きのカードにSユニットのカードが無ければ、次の効果を発動できる⇒DAまたはOTを持つ敵軍Mユニットを1体選び」）", () => {
    const s = nc(2, { power: [faceUp("TST-OP", "op"), faceDown("SPEC-DA-S", "fd")] });
    expectChoiceFrom(s, "player1", "RM-050");
    expect(choiceIds(s)).toEqual(["SPEC-DA-M:dm", "SPEC-DA-M:rm", "SPEC-OT-M:om"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-050: NC — 敵軍パワーゾーンのオモテ向きのカードに S ユニットのカードがあれば発動しない（出典: atwiki/page-859「Sユニットのカードが無ければ」）", () => {
    const s = nc(2, { power: [faceUp("SPEC-DA-S", "fu")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-050");
  });

  it("RM-050: NC — 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-859「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(nc(2), "SPEC-DA-M:dm"));
    expect(zoneOf(s, "player2", "SPEC-DA-M:dm")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-DA-M:dm")?.commandHeld).toBe(true);
  });

  it("RM-050: NC — 置けなければ（敵軍コマンドゾーンが5枚）捨札にする（出典: atwiki/page-859「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(nc(2, { command: heldN(5) }), "SPEC-DA-M:dm"));
    expect(zoneOf(s, "player2", "SPEC-DA-M:dm")).toBe("discard");
  });

  it("RM-050: NC — 特徴「スワット」を持つユニット（隊員コード153 ショウ）からコンビネーションするときは、ナンバーに関係なく発動する（出典: atwiki/page-859「ナンバーに関係なく発動する」・R-CN-05）", () => {
    const s = nc(0, {}, { battle: [inst("RM-048", "sh")] });
    expectChoiceFrom(s, "player1", "RM-050");
  });

  it("RM-050: NC — バトルエリアの3番目でなければ発動しない（出典: atwiki/page-859 CN3・R-CN-01）", () => {
    const s = nc(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-050");
  });
});

// ===========================================================================
describe("RM-051 メガヘラクレス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【メガビートフォーメーション】これは、自軍エリアに「ビートルーダー」があれば「SP1」になり、「スタッガータンク」があればBP+3000され、「レッドジャイロ」があればレジストを得る。";

  it("RM-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-861）", () => {
    expectCatalogText("RM-051", TEXT);
    expectStats("RM-051", { name: "メガヘラクレス", category: "WB", size: "L", bp: 6000, sp: "special", powerCost: 5, comboNumber: undefined, features: ["メカ", "昆虫"] });
    expectRarityIn("RM-051", ["NR"]);
  });

  it("RM-051: ※ — 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-861「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」・R-ADD-07）", () => {
    expect(canEnter(battleBoard({ rush: [inst("RM-051", "mh")] }), "RM-051:mh")).toBe(false);
    const s = enterHold(battleBoard({ rush: [inst("RM-051", "mh")], command: releasedCat("WB", 1) }), "RM-051:mh");
    expect(zoneOf(s, "player1", "RM-051:mh")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  const withMachines = (machines: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}, command: CardInstance[] = []) =>
    battleBoard({ battle: [inst("RM-051", "mh")], rush: machines, command }, p2);

  it("RM-051:【メガビートフォーメーション】— 自軍エリアに「ビートルーダー」があれば「SP1」になる（なければ SP！のまま）（出典: atwiki/page-861「自軍エリアに「ビートルーダー」があれば「SP1」になり」）", () => {
    expect(spOf(withMachines([inst("RM-052", "bt")]), "player1", "RM-051:mh")).toBe(1);
    expect(spOf(withMachines([]), "player1", "RM-051:mh")).toBe(0);
  });

  it("RM-051:【メガビートフォーメーション】— 自軍エリアに「スタッガータンク」があれば BP+3000（2台あっても BP9000）（出典: atwiki/page-861「「スタッガータンク」があればBP+3000され」・カード評価「スタッガータンクが2枚以上いてもBPは9000」）", () => {
    expect(bpOf(withMachines([inst("RM-053", "st")]), "player1", "RM-051:mh")).toBe(9000);
    expect(bpOf(withMachines([inst("RM-053", "st"), inst("RM-053", "st2")]), "player1", "RM-051:mh")).toBe(9000);
    expect(bpOf(withMachines([]), "player1", "RM-051:mh")).toBe(6000);
  });

  it("RM-051:【メガビートフォーメーション】— 自軍エリアに「レッドジャイロ」があればレジストを得る（バトルで撃破されたときホールドして留められる）（出典: atwiki/page-861「「レッドジャイロ」があればレジストを得る」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-051", "mh")], rush: [inst("RM-054", "rg")] }, "RM-051:mh"))).toBe(true);
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-051", "mh")] }, "RM-051:mh"))).toBe(false);
  });

  it("RM-051:【メガビートフォーメーション】— ラッシュエリアにあるときも効く（「これは」の継続効果）（出典: atwiki/page-861・コメント欄「「これは〜」とあるので…常時BPは＋3000されます」）", () => {
    const s = battleBoard({ rush: [inst("RM-051", "mh"), inst("RM-053", "st")] });
    expect(bpOf(s, "player1", "RM-051:mh")).toBe(9000);
  });

  it("RM-051:【メガビートフォーメーション】— 敵軍エリアのビートマシン・自軍コマンドゾーンのビートマシンは数えない（出典: atwiki/page-861「自軍エリアに」・コメント欄「コマンドゾーンやパワーゾーンのそれらのカードは｢エリア｣に置かれていないので、効果の範囲外」）", () => {
    const s = withMachines([], { rush: [inst("RM-052", "ebt"), inst("RM-053", "est")] }, [{ ...inst("RM-053", "cst"), commandHeld: false }]);
    expect(spOf(s, "player1", "RM-051:mh")).toBe(0);
    expect(bpOf(s, "player1", "RM-051:mh")).toBe(6000);
  });
});

// ===========================================================================
describe("RM-052 ビートルーダー", () => {
  const TEXT =
    "※特徴「昆虫」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【マグネアタッチメント】これがライドされている間、自軍エリアに「スタッガータンク」があれば、相手はスタートフェイズ中に自分自身のバトルエリアのユニットをラッシュエリアに戻すとき、特徴「メカ」を持つホールド状態のユニットは戻せない。";

  it("RM-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-862）", () => {
    expectCatalogText("RM-052", TEXT);
    expectVehicleStats("RM-052", { name: "ビートルーダー", category: "WB", powerCost: 3, size: "M", features: ["メカ", "車両"] });
    expectRarityIn("RM-052", ["N"]);
  });

  it("RM-052: ※ — 特徴「昆虫」を持つ S ユニットは、自軍コマンドを1つホールドすれば RC を持っていなくてもライドできる（ホールドできるコマンドがなければ・「昆虫」を持たなければライドできない）（出典: atwiki/page-862「特徴「昆虫」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    const s = battleBoard({ rush: [inst("SPEC-INSECT", "i"), inst("SPEC-NOINSECT", "n"), inst("RM-052", "bt")], command: releasedCat("WB", 1) });
    expect(canMount(s, "SPEC-INSECT:i", "RM-052:bt")).toBe(true);
    expect(canMount(s, "SPEC-NOINSECT:n", "RM-052:bt")).toBe(false);
    expect(canMount(battleBoard({ rush: [inst("SPEC-INSECT", "i"), inst("RM-052", "bt")] }), "SPEC-INSECT:i", "RM-052:bt")).toBe(false);
    const m = mount(s, "SPEC-INSECT:i", "RM-052:bt");
    expect(zoneOf(m, "player1", "RM-052:bt")).toBe("battle");
    expect(m.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  const ENEMY = { battle: [heldUnit("SPEC-MECHA", "hm"), heldUnit("SPEC-ES", "hn"), inst("SPEC-MECHA", "um")] };
  /** 自軍ターンを終え、相手のスタートフェイズのバトルエリアの戻しを終えたところ。 */
  const afterEnemyStart = (p1: Partial<GameState["players"]["player1"]>) => toPhase(endTurnKeep(settle(battleBoard(p1, ENEMY))), "player2", "rush");

  it("RM-052:【マグネアタッチメント】— これがライドされている間、自軍エリアに「スタッガータンク」があれば、相手はスタートフェイズに「メカ」のホールド状態のユニットをラッシュエリアに戻せない（ほかのユニットは戻す）（出典: atwiki/page-862「相手はスタートフェイズ中に自分自身のバトルエリアのユニットをラッシュエリアに戻すとき、特徴「メカ」を持つホールド状態のユニットは戻せない」・カード評価「バトルエリアに釘付け」）", () => {
    const s = afterEnemyStart({ battle: ridingPair("SPEC-INSECT", "r", "RM-052", "bt"), rush: [inst("RM-053", "st")] });
    expect(zoneOf(s, "player2", "SPEC-MECHA:hm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ES:hn")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-MECHA:um")).toBe("rush");
  });

  it("RM-052:【マグネアタッチメント】— 自軍エリアに「スタッガータンク」がなければ、ふつうに戻る（出典: atwiki/page-862「自軍エリアに「スタッガータンク」があれば」）", () => {
    const s = afterEnemyStart({ battle: ridingPair("SPEC-INSECT", "r", "RM-052", "bt") });
    expect(zoneOf(s, "player2", "SPEC-MECHA:hm")).toBe("rush");
  });

  it("RM-052:【マグネアタッチメント】— ライドされていなければ、ふつうに戻る（出典: atwiki/page-862「これがライドされている間」）", () => {
    const s = afterEnemyStart({ rush: [inst("RM-052", "bt"), inst("RM-053", "st")] });
    expect(zoneOf(s, "player2", "SPEC-MECHA:hm")).toBe("rush");
  });
});

// ===========================================================================
describe("RM-053 スタッガータンク", () => {
  const TEXT =
    "※特徴「昆虫」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【ドリルアタッチメント】自軍ターン中、これがバトルエリアに出たとき、自軍エリアに「ビートルーダー」があれば、次の効果を発動できる⇒特徴「メカ」を持つ敵軍Mユニットを1体選びホールドする。";

  it("RM-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-863）", () => {
    expectCatalogText("RM-053", TEXT);
    expectVehicleStats("RM-053", { name: "スタッガータンク", category: "WB", powerCost: 4, size: "M", features: ["メカ", "車両"] });
    expectRarityIn("RM-053", ["N"]);
  });

  it("RM-053: ※ — 特徴「昆虫」を持つ S ユニットは、自軍コマンドを1つホールドすれば RC を持っていなくてもライドできる（出典: atwiki/page-863 ※）", () => {
    const s = battleBoard({ rush: [inst("SPEC-INSECT", "i"), inst("SPEC-NOINSECT", "n"), inst("RM-053", "st")], command: releasedCat("WB", 1) });
    expect(canMount(s, "SPEC-INSECT:i", "RM-053:st")).toBe(true);
    expect(canMount(s, "SPEC-NOINSECT:n", "RM-053:st")).toBe(false);
  });

  const ENEMY = { battle: [inst("SPEC-MECHA-M", "a"), inst("SPEC-EM", "nm"), inst("SPEC-MECHA", "s")], rush: [inst("SPEC-MECHA-M", "b")] };
  /** 自軍バトルフェイズ、「昆虫」の S ユニットがスタッガータンクにライドしてバトルエリアに出る（ビークルの効果の選択まで）。 */
  const entered = (rush: CardInstance[]) =>
    mount(battleBoard({ rush: [inst("SPEC-INSECT", "i"), inst("RM-053", "st"), ...rush], command: releasedCat("WB", 1) }, ENEMY), "SPEC-INSECT:i", "RM-053:st");

  it("RM-053:【ドリルアタッチメント】— 自軍ターン中、バトルエリアに出たとき、自軍エリアに「ビートルーダー」があれば、特徴「メカ」を持つ敵軍 M ユニット（エリアを問わない）から1体選べる（任意）（出典: atwiki/page-863「自軍エリアに「ビートルーダー」があれば、次の効果を発動できる⇒特徴「メカ」を持つ敵軍Mユニットを1体選びホールドする」）", () => {
    const s = entered([inst("RM-052", "bt")]);
    expectChoiceFrom(s, "player1", "RM-053");
    expect(choiceIds(s)).toEqual(["SPEC-MECHA-M:a", "SPEC-MECHA-M:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-053:【ドリルアタッチメント】— 選んだユニットをホールドする（その場に留まる）（出典: atwiki/page-863「1体選びホールドする」）", () => {
    const s = resolveAll(pick(entered([inst("RM-052", "bt")]), "SPEC-MECHA-M:a"));
    expect(zoneOf(s, "player2", "SPEC-MECHA-M:a")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-MECHA-M:a")?.commandHeld).toBe(true);
  });

  it("RM-053:【ドリルアタッチメント】— 自軍エリアに「ビートルーダー」がなければ発動しない（出典: atwiki/page-863「自軍エリアに「ビートルーダー」があれば」）", () => {
    const s = entered([]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-053");
  });
});

// ===========================================================================
describe("RM-054 レッドジャイロ", () => {
  const TEXT =
    "※特徴「昆虫」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【レッドパルサー】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP3000以下の特徴「航空機」を持つ敵軍ユニットを1体選びホールドする。";

  it("RM-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-864）", () => {
    expectCatalogText("RM-054", TEXT);
    expectVehicleStats("RM-054", { name: "レッドジャイロ", category: "WB", powerCost: 2, size: "M", features: ["メカ", "航空機"] });
    expectRarityIn("RM-054", ["N"]);
  });

  it("RM-054: ※ — 特徴「昆虫」を持つ S ユニットは、自軍コマンドを1つホールドすれば RC を持っていなくてもライドできる（出典: atwiki/page-864 ※）", () => {
    const s = battleBoard({ rush: [inst("SPEC-INSECT", "i"), inst("RM-054", "rg")], command: releasedCat("WB", 1) });
    expect(canMount(s, "SPEC-INSECT:i", "RM-054:rg")).toBe(true);
  });

  const ENEMY = { battle: [inst("SPEC-AIR", "a"), inst("SPEC-AIR-M", "m"), inst("SPEC-AIR-HI", "hi"), inst("SPEC-ES", "n"), heldUnit("SPEC-AIR", "h")], rush: [inst("SPEC-AIR", "r")] };
  const entered = () => mount(battleBoard({ rush: [inst("SPEC-INSECT", "i"), inst("RM-054", "rg")], command: releasedCat("WB", 1) }, ENEMY), "SPEC-INSECT:i", "RM-054:rg");

  it("RM-054:【レッドパルサー】— 自軍ターン中、バトルエリアに出たとき、敵軍バトルエリアの BP3000 以下の「航空機」のユニット（サイズを問わない）から1体選ぶ（BP3500・「航空機」を持たない・ラッシュエリアのユニットは選べない。すでにホールド状態のユニットは選ばない。見送れない）（出典: atwiki/page-864「敵軍バトルエリアからBP3000以下の特徴「航空機」を持つ敵軍ユニットを1体選びホールドする」・カード評価「効果にサイズ制限はない」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-054");
    expect(choiceIds(s)).toEqual(["SPEC-AIR-M:m", "SPEC-AIR:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RM-054:【レッドパルサー】— 選んだユニットをホールドする（出典: atwiki/page-864「1体選びホールドする」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-AIR:a"));
    expect(zoneOf(s, "player2", "SPEC-AIR:a")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-AIR:a")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("RM-055 ブルービート", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【スティンガーブレード】「SP1」敵軍バトルエリアから、ホールド状態のユニットを1体選び撃破してもよい。";

  it("RM-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-871）", () => {
    expectCatalogText("RM-055", TEXT);
    expectStats("RM-055", { name: "ブルービート", category: "WB", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 2, features: ["メカ", "昆虫", "ブルー", "男"] });
    expectRarityIn("RM-055", ["SR"]);
  });

  it("RM-055: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-871 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-055", "bb")] }, "RM-055:bb"))).toBe(true);
  });

  const ENEMY = { battle: [heldUnit("SPEC-ES", "h"), heldUnit("SPEC-EM", "hm"), inst("SPEC-ES", "u")], rush: [heldUnit("SPEC-ES", "hr")] };
  const nc = (fillerCount: number) => ncEnter("RM-055:bb", fillerCount, {}, ENEMY, EXTRA);

  it("RM-055: NC【スティンガーブレード】— ナンバーコンビネーションで「SP1」を得る（出典: atwiki/page-871「「SP1」」・カード評価「ストライクも出来る」）", () => {
    let s = nc(1);
    if (s.pendingEffectChoice?.sourceCardId === "RM-055") s = skip(s);
    expect(spOf(settle(s), "player1", "RM-055:bb")).toBe(1);
  });

  it("RM-055: NC【スティンガーブレード】— 敵軍バトルエリアのホールド状態のユニット（サイズを問わない）から1体選べる（リリース状態・ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-871「敵軍バトルエリアから、ホールド状態のユニットを1体選び撃破してもよい」・カード評価「ホールドされていればサイズに影響されずに撃破できる」）", () => {
    const s = nc(1);
    expectChoiceFrom(s, "player1", "RM-055");
    expect(choiceIds(s)).toEqual(["SPEC-EM:hm", "SPEC-ES:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-055: NC【スティンガーブレード】— 選んだユニットを撃破する（出典: atwiki/page-871「撃破してもよい」）", () => {
    const s = resolveAll(pick(nc(1), "SPEC-EM:hm"));
    expect(zoneOf(s, "player2", "SPEC-EM:hm")).toBe("discard");
  });

  it("RM-055: NC — ナンバーコンビネーションしなければ（バトルエリアの1番目）発動しない（出典: atwiki/page-871 CN2・R-CN-01）", () => {
    const s = nc(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-055");
    expect(spOf(settle(s), "player1", "RM-055:bb")).toBe(0);
  });
});

// ===========================================================================
describe("RM-056 ジースタッグ", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【スティンガークロー】ライド中の敵軍Sユニットを1体選んでもよい。そうしたとき、相手はそのSユニットか、そのSユニットがライドしているビークルのうち、どちらか1体を選び捨札にする。";

  it("RM-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-865）", () => {
    expectCatalogText("RM-056", TEXT);
    expectStats("RM-056", { name: "ジースタッグ", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 4, comboNumber: 3, features: ["メカ", "昆虫", "グリーン", "男"] });
    expectRarityIn("RM-056", ["N"]);
  });

  it("RM-056: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-865 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-056", "gs")] }, "RM-056:gs"))).toBe(true);
  });

  const ENEMY = {
    battle: [...ridingPair("SPEC-ES", "r", "SPEC-VEHICLE", "v"), inst("SPEC-ES", "solo")],
    rush: [...ridingPair("SPEC-ES", "rr", "SPEC-MV", "mv")],
  };
  const nc = () => ncEnter("RM-056:gs", 2, {}, ENEMY, EXTRA);

  it("RM-056: NC【スティンガークロー】— ライド中の敵軍 S ユニット（エリアを問わない）から1体選べる（任意）（出典: atwiki/page-865「ライド中の敵軍Sユニットを1体選んでもよい」・カード評価「地味にエリアを問わない」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RM-056");
    expect(choiceIds(s)).toEqual(["SPEC-ES:r", "SPEC-ES:rr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-056: NC — 選ぶと、相手がそのユニットかそのユニットがライドしているビークルのどちらかを選ぶ（見送れない）（出典: atwiki/page-865「相手はそのSユニットか、そのSユニットがライドしているビークルのうち、どちらか1体を選び捨札にする」）", () => {
    const s = pick(nc(), "SPEC-ES:r");
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RM-056");
    expect(choiceIds(s)).toEqual(["SPEC-ES:r", "SPEC-VEHICLE:v"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RM-056: NC — 相手がビークルを選べば、ビークルが捨札になる（出典: atwiki/page-865「どちらか1体を選び捨札にする」・カード評価「Mビークル・Lビークルを除去できる」）", () => {
    const s = resolveAll(pickAs(pick(nc(), "SPEC-ES:rr"), "player2", "SPEC-MV:mv"));
    expect(zoneOf(s, "player2", "SPEC-MV:mv")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:rr")).not.toBe("discard");
  });

  it("RM-056: NC — 相手がユニットを選べば、ユニットが捨札になる（出典: atwiki/page-865「どちらか1体を選び捨札にする」）", () => {
    const s = resolveAll(pickAs(pick(nc(), "SPEC-ES:r"), "player2", "SPEC-ES:r"));
    expect(zoneOf(s, "player2", "SPEC-ES:r")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v")).not.toBe("discard");
  });
});
