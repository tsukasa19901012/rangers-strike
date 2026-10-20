/**
 * カード別スペック: XG4-008〜XG4-014（クロスギャザー ザ・ジェットアクセル メガシルバー（XG4）〜ギンガピンク（XG4））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に XG のカードの項はない
 *     （「XG4-」とカード名で検索。card_6 にあるのは RS-377 ギンガグリーンの項だけで、XG4-013 とは本文が違う）。
 *     atwiki に転載された公式 Q&A（XG4-008 Q1・Q2、XG4-009 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG4-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-CARD-04・R-KW-RC-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG4-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackersOf,
  bpOf,
  canConfirm,
  canMount,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  choicePlayer,
  confirm,
  deckCards,
  enemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  fill,
  heldN,
  heldUnit,
  inst,
  isExiled,
  mount,
  mountedOn,
  ncEnter,
  nextPhase,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rideOffOffered,
  ridingPair,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  sUnit,
  vehicleCard,
  zoneOf,
  zordDownMultiTests,
} from "./XG4-001-021.helpers";

const SILVER = sUnit("SPEC-SILVER", { category: "ET", bp: 2000, features: ["シルバー"] });
const NOSILVER = sUnit("SPEC-NOSILVER", { category: "ET", bp: 2000, features: ["男"] });
const SILVER_M = sUnit("SPEC-SILVER-M", { category: "ET", bp: 3000, size: "M", features: ["シルバー"] });
const CMD_S5 = sUnit("SPEC-CMD-S5", { category: "ET", bp: 2000, powerCost: 5 });
const CMD_S4 = sUnit("SPEC-CMD-S4", { category: "ET", bp: 2000, powerCost: 4 });
const CMD_M = sUnit("SPEC-CMD-M", { category: "ET", bp: 3000, size: "M", powerCost: 2 });
const E_WEAK = sUnit("SPEC-E-WEAK", { bp: 500, sp: undefined });
const E_STRONG = sUnit("SPEC-E-STRONG", { bp: 9000, sp: undefined });
const GINGA = sUnit("SPEC-GINGA", { category: "WB", bp: 1000, features: ["ギンガの光"] });
const E_MECHA = sUnit("SPEC-E-MECHA", { bp: 1000, features: ["メカ"] });
const E_MECHA_M = sUnit("SPEC-E-MECHA-M", { bp: 3000, size: "M", features: ["メカ"] });
const E_PLAIN = sUnit("SPEC-E-PLAIN", { bp: 1000 });
const E_4000 = sUnit("SPEC-E-4000", { bp: 4000 });
const E_4500 = sUnit("SPEC-E-4500", { bp: 4500 });
const E_4000_M = sUnit("SPEC-E-4000-M", { bp: 4000, size: "M" });
const OWN_V = vehicleCard("SPEC-OWN-V", { category: "WB" });
const WING_E = sUnit("SPEC-WING-E", { bp: 9000, keywords: ["wing"] } as never);
const EXTRA = [SILVER, NOSILVER, SILVER_M, CMD_S5, CMD_S4, CMD_M, E_WEAK, E_STRONG, GINGA, E_MECHA, E_MECHA_M, E_PLAIN, E_4000, E_4500, E_4000_M, OWN_V, WING_E];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-008 メガシルバー（XG4）", () => {
  const TEXT =
    "※これはライドしている間、「SP1」になる。 【I.N.E.T.特別開発班チーフ】これが自軍エリアにある間、特徴「メカ」をもつETのLユニットをラッシュするとき、自軍Lユニットが1体もなければ次の効果を発動できる⇒ETの自軍コマンドを1つホールドしてから、自分の手札からそのLユニットの追加条件を満たすために必要なユニットのカードを1枚選び捨札にすれば、必要なユニットの1体を捨札にしたことにできる。";

  it("XG4-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-2137）", () => {
    expectCatalogText("XG4-008", TEXT);
    expectUnit("XG4-008", { name: "メガシルバー", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 6, comboNumber: undefined, features: ["シルバー", "男"] });
    expectRarityIn("XG4-008", ["R"]);
  });

  it("XG4-008: ※ — ライドしていなければ SP を持たない（SP「！」で CN なし）（出典: atwiki/page-2137「SP：！」「CN：なし」）", () => {
    const s = settle(act(battle({ rush: [inst("XG4-008", "ms")] }), { type: "move_to_battle", playerId: "player1", instanceId: "XG4-008:ms" }));
    expect(spOf(s, "player1", "XG4-008:ms")).toBe(0);
  });

  it("XG4-008: ※ — ライドしている間は「SP1」になる（XG4-009 オートスライダーにライドして出る）（出典: atwiki/page-2137「※これはライドしている間、「SP1」になる」・atwiki/page-2083「特徴「シルバー」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    const s = settle(mount(battle({ rush: [inst("XG4-008", "ms"), inst("XG4-009", "as")] }), "XG4-008:ms", "XG4-009:as"));
    expect(mountedOn(s, "player1", "XG4-008:ms")).toBe("XG4-009:as");
    expect(spOf(s, "player1", "XG4-008:ms")).toBe(1);
  });

  /** RS-624 メガウインガー・ファイターモード（ET・L・特徴「メカ」。追加条件「自軍「メガウインガー・フライヤーモード」1体を捨札にする」）を手札からラッシュする盤面。 */
  const lBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    board({ hand: [inst("RS-624", "fm"), inst("RS-625", "fly")], command: releasedCat("ET", 2), power: powerCards(6), rush: [inst("XG4-008", "ms")], ...p1 });

  it("XG4-008:【I.N.E.T.特別開発班チーフ】— 自軍エリアにこれがあり自軍 L ユニットがなければ、ET のコマンドを1つホールドし、手札の「メガウインガー・フライヤーモード」を捨札にして、追加条件を満たしたことにしてラッシュできる（出典: atwiki/page-2137【I.N.E.T.特別開発班チーフ】・カード評価「通常では出しにくいユニットも格段にラッシュしやすくなる」）", () => {
    const s = lBoard();
    expect(canStartRush(s, "player1", "RS-624:fm")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-624:fm", { materials: ["RS-625:fly"] });
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-624:fm")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-625:fly")).toBe("discard");
    expect(t.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("XG4-008:【I.N.E.T.特別開発班チーフ】— 自軍エリアにこれがなければ、手札のカードで追加条件は満たせない（出典: atwiki/page-2137「これが自軍エリアにある間」）", () => {
    expect(canStartRush(lBoard({ rush: [] }), "player1", "RS-624:fm")).toBe(false);
  });

  it("XG4-008:【I.N.E.T.特別開発班チーフ】— 自軍 L ユニットがあれば発動できない（出典: atwiki/page-2137「自軍Lユニットが1体もなければ」）", () => {
    expect(canStartRush(lBoard({ rush: [inst("XG4-008", "ms"), inst("TST-UNIT-7", "l")] }), "player1", "RS-624:fm")).toBe(false);
  });

  it.todo(
    "XG4-008: 公式Q&A — 1回のラッシュに対して【I.N.E.T.特別開発班チーフ】を複数回発動できる（合体を必要とするLユニットで、必要なユニット2体を手札から捨札にする）（出典: atwiki/page-2137 Q2）— 本範囲の ET・L・「メカ」のユニットに、追加条件で同じ種類のユニットを2体以上捨札にするもの（合体以外）がなく、合体ユニットを手札で代える公開アクションの形も決まっていないため",
  );
});

// ===========================================================================
describe("XG4-009 オートスライダー", () => {
  const TEXT =
    "※特徴「シルバー」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。 ※これにライドしているユニットはBP+1000される。 【緊急出動】これをラッシュしたとき、次の効果を発動できる⇒ 自軍コマンドゾーンからリリース状態のSユニットのカードを1枚選び、これの上に重ねて自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。";

  it("XG4-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-2083）", () => {
    expectCatalogText("XG4-009", TEXT);
    expectVehicle("XG4-009", { name: "オートスライダー", category: "ET", powerCost: 4, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG4-009", ["N"]);
  });

  it("XG4-009: ※ — 特徴「シルバー」を持つ S ユニットは RC がなくてもライドできる（「シルバー」を持たないユニット・M ユニットはライドできない）（出典: atwiki/page-2083「特徴「シルバー」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    const s = battle({ rush: [inst("XG4-009", "as"), inst("SPEC-SILVER", "sv"), inst("SPEC-NOSILVER", "ns"), inst("SPEC-SILVER-M", "sm")] });
    expect(canMount(s, "SPEC-SILVER:sv", "XG4-009:as")).toBe(true);
    expect(canMount(s, "SPEC-NOSILVER:ns", "XG4-009:as")).toBe(false);
    expect(canMount(s, "SPEC-SILVER-M:sm", "XG4-009:as")).toBe(false);
  });

  it("XG4-009: ※ — これにライドしているユニットは BP+1000（出典: atwiki/page-2083「※これにライドしているユニットはBP+1000される」）", () => {
    const s = settle(mount(battle({ rush: [inst("XG4-009", "as"), inst("SPEC-SILVER", "sv")] }), "SPEC-SILVER:sv", "XG4-009:as"));
    expect(bpOf(s, "player1", "SPEC-SILVER:sv")).toBe(3000);
  });

  const CMD = () => [released("SPEC-CMD-S4", "c4"), released("SPEC-CMD-S5", "c5"), heldUnit("SPEC-CMD-S4", "h4"), released("SPEC-CMD-M", "cm"), released("TST-OP-ET", "op")];
  const rushed = (cmd = CMD()) => {
    const r = rushFromHand(board({ hand: [inst("XG4-009", "as")], command: [released("TST-OP-ET", "pay"), ...cmd], power: powerCards(4) }), "player1", "XG4-009:as");
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    if (s.pendingEffectChoice?.sourceCardId === "XG4-009" && canConfirm(s) && choiceIds(s).length === 0) s = confirm(s);
    return s;
  };

  it("XG4-009:【緊急出動】— ラッシュしたとき、自軍コマンドゾーンのリリース状態の S ユニットのカードのうち、必要パワーを満たすものから選べる（ホールド状態・M ユニット・オペレーション・必要パワーが足りないものは選べない。任意）（出典: atwiki/page-2083「自軍コマンドゾーンからリリース状態のSユニットのカードを1枚選び…ただし、必要パワーと追加条件は満たすこと」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG4-009");
    expect(choiceIds(s)).toEqual(["SPEC-CMD-S4:c4"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-009:【緊急出動】— 選んだカードはこれにライドした状態で自軍ラッシュエリアに出る（ライドしているので BP+1000）（出典: atwiki/page-2083「これの上に重ねて自軍ラッシュエリアに出してもよい」・カード評価「これにライドした状態でラッシュされる」）", () => {
    const s = resolveAll(pick(rushed(), "SPEC-CMD-S4:c4"));
    expect(zoneOf(s, "player1", "SPEC-CMD-S4:c4")).toBe("rush");
    expect(mountedOn(s, "player1", "SPEC-CMD-S4:c4")).toBe("XG4-009:as");
    expect(bpOf(s, "player1", "SPEC-CMD-S4:c4")).toBe(3000);
  });

  it("XG4-009: 公式Q&A —【緊急出動】で XG2-025 ギンガレッドを重ねても、ギンガレッドの「ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい」でビークルを重ねることはできない（出典: atwiki/page-2083 Q1）", () => {
    let s = rushed([released("XG2-025", "gr")]);
    s = pick(s, "XG2-025:gr");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-025");
  });
});

// ===========================================================================
describe("XG4-010 獣装光ギンガブルー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ギンガブルー」のカードを1枚選び、自軍ラッシュエリアに出す。 【閃光星獣剣】「SP1」これが敵軍ユニットをバトルで撃破したとき、撃破したユニットを捨札にする代わりにゲームから除外してもよい。そうしたとき、自分は1枚ドローする。";

  it("XG4-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-2103）", () => {
    expectCatalogText("XG4-010", TEXT);
    expectUnit("XG4-010", { name: "獣装光ギンガブルー", category: ["WB", "MA"], size: "S", bp: 5500, sp: "special", powerCost: "7-", comboNumber: 2, features: ["ブルー", "男", "ギンガの光"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG4-010", ["NR"]);
  });

  zordDownMultiTests("XG4-010", "XG2-026", "ギンガブルー", "atwiki/page-2103", ["WB", "MA"]);
  reanimateTests("XG4-010", "RS-378", "ギンガブルー", "atwiki/page-2103");

  const nc = (p1: Partial<GameState["players"]["player1"]> = {}) => resolveAllKeep(ncEnter("XG4-010:gb", 1, p1, { battle: [inst("SPEC-E-WEAK", "e")], deck: deckCards(5, "e") }, EXTRA));

  it("XG4-010: NC【閃光星獣剣】— 2番目に出ると「SP1」を得る（出典: atwiki/page-2103「「SP1」」）", () => {
    expect(spOf(nc(), "player1", "XG4-010:gb")).toBe(1);
  });

  it("XG4-010: NC — 敵軍ユニットをバトルで撃破したとき、捨札にするかわりにゲームから除外するかを選べ、除外すれば1枚ドローする（出典: atwiki/page-2103「撃破したユニットを捨札にする代わりにゲームから除外してもよい。そうしたとき、自分は1枚ドローする」）", () => {
    let s = attack(nc(), "XG4-010:gb", "SPEC-E-WEAK:e");
    s = settleUntilChoice(s, "XG4-010");
    expectChoiceFrom(s, "player1", "XG4-010");
    expect(canSkip(s)).toBe(true);
    const hand = s.players.player1.hand.length;
    s = resolveAll(s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : pick(s, s.pendingEffectChoice!.validInstanceIds[0]!));
    expect(isExiled(s, "player2", "SPEC-E-WEAK:e")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E-WEAK:e")).toBe(null);
    expect(s.players.player1.hand).toHaveLength(hand + 1);
  });

  it("XG4-010: NC — 除外しなければ撃破したユニットは捨札になり、ドローしない（出典: atwiki/page-2103「してもよい」）", () => {
    let s = attack(nc(), "XG4-010:gb", "SPEC-E-WEAK:e");
    s = settleUntilChoice(s, "XG4-010");
    const hand = s.players.player1.hand.length;
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-E-WEAK:e")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(hand);
  });

  it("XG4-010: NC 不成立（3番目）なら SP を持たず、撃破しても除外は選べない（出典: atwiki/page-2103「CN：2」・R-CN-02）", () => {
    let s = resolveAllKeep(ncEnter("XG4-010:gb", 2, {}, { battle: [inst("SPEC-E-WEAK", "e")] }, EXTRA));
    expect(spOf(s, "player1", "XG4-010:gb")).toBe(0);
    s = resolveAll(attack(s, "XG4-010:gb", "SPEC-E-WEAK:e"));
    expect(zoneOf(s, "player2", "SPEC-E-WEAK:e")).toBe("discard");
  });
});

/** NC などの選択を解決するが、進入直後の行動ウィンドウ（アタック・ストライク）は残す。 */
function resolveAllKeep(s: GameState): GameState {
  let n = s;
  for (let i = 0; i < 8 && n.pendingEffectChoice; i++) {
    const p = n.pendingEffectChoice;
    n = p.kind === "confirm" ? confirm(n) : p.validInstanceIds[0] ? pick(n, p.validInstanceIds[0]) : skip(n);
  }
  return n;
}
/** sourceCardId の選択が開くまで反応ウィンドウをパスする。 */
function settleUntilChoice(s: GameState, sourceCardId: string): GameState {
  let n = s;
  for (let i = 0; i < 6 && n.pendingEffectChoice?.sourceCardId !== sourceCardId; i++) {
    const before = n;
    n = settle(n, 1);
    if (n === before) break;
  }
  return n;
}

// ===========================================================================
describe("XG4-011 獣装光ギンガグリーン", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ギンガグリーン」のカードを1枚選び、自軍ラッシュエリアに出す。 【銀河の戦光】本来の特徴に「ギンガの光」を持つユニットが5体以上あれば、敵軍バトルエリアのユニットをすべてゲームから除外する。";

  it("XG4-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-2099）", () => {
    expectCatalogText("XG4-011", TEXT);
    expectUnit("XG4-011", { name: "獣装光ギンガグリーン", category: ["WB", "MA"], size: "S", bp: 3500, sp: "1/3", powerCost: "7-", comboNumber: 5, features: ["グリーン", "男", "ギンガの光"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG4-011", ["N"]);
  });

  zordDownMultiTests("XG4-011", "RS-377", "ギンガグリーン", "atwiki/page-2099", ["WB", "MA"]);
  reanimateTests("XG4-011", "XG4-013", "ギンガグリーン", "atwiki/page-2099");

  const ENEMY = { battle: [inst("SPEC-E-PLAIN", "b1"), inst("SPEC-E-MECHA-M", "b2")], rush: [inst("SPEC-E-PLAIN", "r1")] };
  const nc = (ginga: number, p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(
      ncEnter(
        "XG4-011:gg",
        0,
        { battle: [...Array.from({ length: Math.min(ginga, 4) }, (_, i) => inst("SPEC-GINGA", `g${i}`)), ...fill(4 - Math.min(ginga, 4))], rush: Array.from({ length: Math.max(0, ginga - 4) }, (_, i) => inst("SPEC-GINGA", `rg${i}`)) },
        { ...ENEMY, ...p2 },
        EXTRA,
      ),
    );

  it("XG4-011: NC【銀河の戦光】— 5番目に出て、本来の特徴に「ギンガの光」を持つユニットがこれを含め5体以上あれば、敵軍バトルエリアのユニットをすべて除外する（ラッシュエリアのユニットは残る）（出典: atwiki/page-2099「本来の特徴に「ギンガの光」を持つユニットが5体以上あれば、敵軍バトルエリアのユニットをすべてゲームから除外する」）", () => {
    const s = nc(4);
    expect(isExiled(s, "player2", "SPEC-E-PLAIN:b1")).toBe(true);
    expect(isExiled(s, "player2", "SPEC-E-MECHA-M:b2")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E-PLAIN:r1")).toBe("rush");
  });

  it("XG4-011: NC — 「ギンガの光」のユニットが4体以下なら何もしない（出典: atwiki/page-2099「5体以上あれば」）", () => {
    const s = nc(3);
    expect(zoneOf(s, "player2", "SPEC-E-PLAIN:b1")).toBe("battle");
  });

  it("XG4-011: NC — 敵軍の「ギンガの光」のユニットも数える（自軍の限定がない）（出典: atwiki/page-2099「本来の特徴に「ギンガの光」を持つユニット」・コメント欄「相手の場にいるやつでもおk」）", () => {
    const s = nc(3, { rush: [inst("SPEC-E-PLAIN", "r1"), inst("SPEC-GINGA", "eg")] });
    expect(isExiled(s, "player2", "SPEC-E-PLAIN:b1")).toBe(true);
  });
});

// ===========================================================================
describe("XG4-012 獣装光ギンガイエロー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ギンガイエロー」のカードを1枚選び、自軍ラッシュエリアに出す。 【閃光星獣剣】「SP1」自軍捨札を1枚選びゲームから除外してもよい。そうしたとき、敵軍バトルエリアから、特徴「メカ」を持つホールド状態のユニットを1体選び、ゲームから除外する。";

  it("XG4-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-2097）", () => {
    expectCatalogText("XG4-012", TEXT);
    expectUnit("XG4-012", { name: "獣装光ギンガイエロー", category: ["WB", "MA"], size: "S", bp: 3500, sp: "special", powerCost: "7-", comboNumber: 3, features: ["イエロー", "男", "ギンガの光"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG4-012", ["N"]);
  });

  zordDownMultiTests("XG4-012", "RS-379", "ギンガイエロー", "atwiki/page-2097", ["WB", "MA"]);
  reanimateTests("XG4-012", "XG2-027", "ギンガイエロー", "atwiki/page-2097");

  const ENEMY = { battle: [heldUnit("SPEC-E-MECHA", "hm"), heldUnit("SPEC-E-MECHA-M", "hmm"), inst("SPEC-E-MECHA", "rm"), heldUnit("SPEC-E-PLAIN", "hp")], rush: [heldUnit("SPEC-E-MECHA", "rush")] };
  const DISCARD = () => [inst("TST-OP", "d1"), inst("TST-UNIT-0", "d2")];
  const nc = () => ncEnter("XG4-012:gy", 2, { discard: DISCARD() }, ENEMY, EXTRA);

  it("XG4-012: NC【閃光星獣剣】— 3番目に出ると「SP1」を得る（出典: atwiki/page-2097「「SP1」」）", () => {
    let s = nc();
    if (s.pendingEffectChoice?.sourceCardId === "XG4-012") s = skip(s);
    expect(spOf(settle(s), "player1", "XG4-012:gy")).toBe(1);
  });

  it("XG4-012: NC — 自軍捨札のカードを1枚選んで除外してもよい（任意）（出典: atwiki/page-2097「自軍捨札を1枚選びゲームから除外してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-012");
    expect(choiceIds(s)).toEqual(["TST-OP:d1", "TST-UNIT-0:d2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-012: NC — 除外したとき、敵軍バトルエリアの特徴「メカ」を持つホールド状態のユニット（サイズを問わない）から1体選び除外する（リリース状態・「メカ」なし・ラッシュエリアは選べない）（出典: atwiki/page-2097「敵軍バトルエリアから、特徴「メカ」を持つホールド状態のユニットを1体選び、ゲームから除外する」・カード評価「サイズを問わない」）", () => {
    let s = pick(nc(), "TST-OP:d1");
    expect(isExiled(s, "player1", "TST-OP:d1")).toBe(true);
    expectChoiceFrom(s, "player1", "XG4-012");
    expect(choiceIds(s)).toEqual(["SPEC-E-MECHA-M:hmm", "SPEC-E-MECHA:hm"]);
    s = resolveAll(pick(s, "SPEC-E-MECHA-M:hmm"));
    expect(isExiled(s, "player2", "SPEC-E-MECHA-M:hmm")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E-MECHA:hm")).toBe("battle");
  });

  it("XG4-012: NC — 自軍捨札を除外しなければ、敵軍ユニットは除外しない（出典: atwiki/page-2097「そうしたとき」）", () => {
    const s = resolveAll(skip(nc()));
    expect(zoneOf(s, "player1", "TST-OP:d1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-MECHA:hm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E-MECHA-M:hmm")).toBe("battle");
  });
});

// ===========================================================================
/** 「※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。」の共通テスト。 */
function stackVehicleTests(id: string, cost: number, page: string) {
  const rushed = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    const r = rushFromHand(
      board({ hand: [inst(id, "u")], command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], power: powerCards(cost), rush: [inst("SPEC-OWN-V", "v1"), ...ridingPair("SPEC-SILVER", "rd", "XG4-009", "as")], ...p1 }, { rush: [inst("SPEC-OWN-V", "ev")] }),
      "player1",
      `${id}:u`,
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it(`${id}: ※ — ラッシュしたとき、ライドされていない自軍ビークルから1体選べる（ライドされているビークル・敵軍のビークルは選べない。任意）（出典: ${page}「ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい」）`, () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["SPEC-OWN-V:v1"]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ※ — 選んだビークルはこれの下に重なり、これはそのビークルにライドした状態になる（バトルエリアに出るときライドオフを選べる）（出典: ${page}「これの下に重ねてもよい」・atwiki/page-1233 XG2-025 Q1「「ライド」ではなく「重ねる」」・同カード評価「ビークルを重ねることでライドすることができる。そこからライドオフして」・atwiki/page-2083 Q1）`, () => {
    let s = resolveAll(pick(rushed(), "SPEC-OWN-V:v1"));
    expect(zoneOf(s, "player1", "SPEC-OWN-V:v1")).not.toBe("discard");
    s = act(nextPhase(s), { type: "move_to_battle", playerId: "player1", instanceId: `${id}:u` });
    expect(rideOffOffered(s)).toBe(true);
  });

  it(`${id}: ※ — 見送ればビークルは重ならない（ラッシュエリアに残る）（出典: ${page}「してもよい」）`, () => {
    const s = resolveAll(skip(rushed()));
    expect(zoneOf(s, "player1", "SPEC-OWN-V:v1")).toBe("rush");
    expect(mountedOn(s, "player1", `${id}:u`)).toBeUndefined();
  });
}

describe("XG4-013 ギンガグリーン（XG4）", () => {
  const TEXT =
    "※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。 ※これはライド中、ウイングを持たないユニットにアタックされない。 【疾風一陣】相手は自分自身の山札の上から1枚を捨札にするか、自分自身のコマンドを2つ選び手札に戻すかを選ぶ。";

  it("XG4-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-2092）", () => {
    expectCatalogText("XG4-013", TEXT);
    expectUnit("XG4-013", { name: "ギンガグリーン", category: ["WB", "MA"], size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: 5, features: ["グリーン", "男"] });
    expectRarityIn("XG4-013", ["N"]);
  });

  stackVehicleTests("XG4-013", 3, "atwiki/page-2092");

  it("XG4-013: ※ — ライド中は、ウイングを持たないユニットにアタックされない（出典: atwiki/page-2092「※これはライド中、ウイングを持たないユニットにアタックされない」）", () => {
    const s = enemyTurn({ battle: [...ridingPair("XG4-013", "gg", "SPEC-OWN-V", "v")] }, { battle: [inst("SPEC-E-STRONG", "a")] }, EXTRA);
    expect(attackersOf(s, "XG4-013:gg")).toEqual([]);
  });

  it("XG4-013: ※ — ライドしていなければアタックされる（出典: atwiki/page-2092「ライド中」）", () => {
    const s = enemyTurn({ battle: [inst("XG4-013", "gg")] }, { battle: [inst("SPEC-E-STRONG", "a")] }, EXTRA);
    expect(attackersOf(s, "XG4-013:gg")).toEqual(["SPEC-E-STRONG:a"]);
  });

  const ENEMY = () => ({ deck: [inst("TST-OP", "top"), ...deckCards(4, "e")], command: [released("TST-OP", "c1"), released("TST-OP-DA", "c2"), heldN(1, "TST-OP", "eh")[0]!] });
  const nc = (p2 = ENEMY()) => ncEnter("XG4-013:gg", 4, {}, p2, EXTRA);

  it("XG4-013: NC【疾風一陣】— 5番目に出ると、相手が「山札の上から1枚を捨札」か「コマンドを2つ手札に戻す」かを選ぶ（出典: atwiki/page-2092「相手は…を選ぶ」）", () => {
    const s = nc();
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG4-013");
    expect(canSkip(s)).toBe(false);
  });

  it("XG4-013: NC — 相手が山札を選べば、相手の山札の一番上が捨札になる（出典: atwiki/page-2092「自分自身の山札の上から1枚を捨札にする」）", () => {
    let s = nc();
    const deckOpt = choiceIds(s).find((x) => /deck|mill|top/.test(x)) ?? choiceIds(s)[0]!;
    s = resolveAll(pickAs(s, "player2", deckOpt));
    expect(zoneOf(s, "player2", "TST-OP:top")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(3);
  });

  it("XG4-013: NC — 相手がコマンドを選べば、相手は自分のコマンドを2つ選び手札に戻す（ホールド状態のコマンドも選べる）（出典: atwiki/page-2092「自分自身のコマンドを2つ選び手札に戻す」）", () => {
    let s = nc();
    const cmdOpt = choiceIds(s).find((x) => /command|cmd/.test(x));
    expect(cmdOpt).toBeDefined();
    s = pickAs(s, "player2", cmdOpt!);
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:c2", "TST-OP:c1", "TST-OP:eh0"]);
    s = resolveAll(pickAs(pickAs(s, "player2", "TST-OP:c1"), "player2", "TST-OP:eh0"));
    expect(zoneOf(s, "player2", "TST-OP:c1")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:eh0")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP-DA:c2")).toBe("command");
    expect(zoneOf(s, "player2", "TST-OP:top")).toBe("deck");
  });
});

// ===========================================================================
describe("XG4-014 ギンガピンク（XG4）", () => {
  const TEXT =
    "※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。 【キバアロー】BP4000以下の敵軍ユニットを1体選んでもよい。そうしたとき、相手はそのユニットをホールドするか自分自身の山札の上に戻すかを選ぶ。";

  it("XG4-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-2091）", () => {
    expectCatalogText("XG4-014", TEXT);
    expectUnit("XG4-014", { name: "ギンガピンク", category: ["WB", "MA"], size: "S", bp: 500, sp: "1/2", powerCost: 0, comboNumber: 4, features: ["ピンク", "女"] });
    expectRarityIn("XG4-014", ["N"]);
  });

  stackVehicleTests("XG4-014", 0, "atwiki/page-2091");

  const ENEMY = { battle: [inst("SPEC-E-4000", "a"), inst("SPEC-E-4500", "b")], rush: [inst("SPEC-E-4000-M", "m")] };
  const nc = () => ncEnter("XG4-014:gp", 3, {}, { ...ENEMY, deck: deckCards(4, "e") }, EXTRA);

  it("XG4-014: NC【キバアロー】— 4番目に出ると、BP4000 以下の敵軍ユニット（エリア・サイズを問わない）から1体選べる（任意）（出典: atwiki/page-2091「BP4000以下の敵軍ユニットを1体選んでもよい」・コメント欄「効果対象のサイズ指定が無い」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-014");
    expect(choiceIds(s)).toEqual(["SPEC-E-4000-M:m", "SPEC-E-4000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-014: NC — 選ぶと、相手がホールドか山札の上に戻すかを選ぶ。山札の上を選べば、そのユニットは持ち主の山札の一番上に戻る（出典: atwiki/page-2091「相手はそのユニットをホールドするか自分自身の山札の上に戻すかを選ぶ」）", () => {
    let s = pick(nc(), "SPEC-E-4000:a");
    expect(choicePlayer(s)).toBe("player2");
    const top = choiceIds(s).find((x) => /deck|top/.test(x));
    expect(top).toBeDefined();
    s = resolveAll(pickAs(s, "player2", top!));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-E-4000:a");
  });

  it("XG4-014: NC — 相手がホールドを選べば、そのユニットはホールド状態でその場に残る（出典: atwiki/page-2091「ホールドする」）", () => {
    let s = pick(nc(), "SPEC-E-4000:a");
    const hold = choiceIds(s).find((x) => /hold/.test(x));
    expect(hold).toBeDefined();
    s = resolveAll(pickAs(s, "player2", hold!));
    expect(zoneOf(s, "player2", "SPEC-E-4000:a")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-E-4000:a")?.commandHeld).toBe(true);
  });
});

