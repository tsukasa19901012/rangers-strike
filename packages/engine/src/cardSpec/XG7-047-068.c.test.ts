/**
 * カード別スペック: XG7-062〜XG7-068（クロスギャザー ザ・ベストパートナー シャークラー〜宇宙刑事シャリバン×ギャバン×シャイダー）
 *
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. 公式 FAQ・エラッタ・公式 Q&A — grnrngr の FAQ・08-errata.md には載っていない（本範囲の atwiki ページにも Q&A の転記はない）。
 *  2. atwiki のカードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）の本文。
 *  3. 一般ルール（docs/rules/*.md）、atwiki のカード評価・コメント。
 *
 * エンジンが出典と違う／効果が無いところは、出典どおりの期待値のまま it.fails（既知の不具合: CARD-XG7-NNN）にしている。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  actionsMentioning,
  attack,
  bpOf,
  breakerTests,
  canActivate,
  canMount,
  canSelfRush,
  canSkip,
  canStartRush,
  cardIn,
  chaseTargets,
  choiceFromCard,
  choiceIds,
  deckCards,
  enemyTurnOf,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  inst,
  legal,
  ncBoard,
  passEntry,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  ridingPair,
  rushFromHand,
  rushPhaseOf,
  rushVia,
  scrumTests,
  settle,
  spOf,
  st,
  strike,
  sUnit,
  vehicleCard,
  zoneOf,
} from "./XG7-047-068.helpers";

const V = vehicleCard("SPEC-V", { features: ["メカ"] });
const V2 = vehicleCard("SPEC-V2", { features: ["メカ"] });
const MECHA_V3 = vehicleCard("SPEC-MECHA-V3", { features: ["メカ"], powerCost: 3 } as never);
const PLAIN_V3 = vehicleCard("SPEC-PLAIN-V3", { features: ["車両"], powerCost: 3 } as never);
const MECHA = sUnit("SPEC-MECHA", { category: "ET", bp: 1000, features: ["メカ"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000 });
const POLICE = sUnit("SPEC-POLICE", { category: "ET", bp: 1000, features: ["警察"] });
const E2000 = sUnit("SPEC-E2000", { category: "WB", bp: 2000, sp: undefined });
const E2500 = sUnit("SPEC-E2500", { category: "WB", bp: 2500, sp: undefined });
const EC1 = sUnit("SPEC-EC1", { category: "WB", bp: 1000, powerCost: 1, sp: undefined });
const EC2 = sUnit("SPEC-EC2", { category: "WB", bp: 1000, powerCost: 2, sp: undefined });
const EC3 = sUnit("SPEC-EC3", { category: "WB", bp: 1000, powerCost: 3, sp: undefined });
const BIG = sUnit("SPEC-BIG", { category: "WB", bp: 9000 });
const STRIKER = sUnit("SPEC-STRIKER", { category: "WB", bp: 1000, sp: 1 } as never);
const FRAC4 = sUnit("SPEC-XFRAC4", { category: "WB", bp: 1000, sp: "1/4" } as never);
const SPACE_COP = sUnit("SPEC-SPACE-COP", { category: "OT", bp: 1000, features: ["宇宙刑事"] });
const EXTRA = [V, V2, MECHA_V3, PLAIN_V3, MECHA, PLAIN, POLICE, E2000, E2500, EC1, EC2, EC3, BIG, STRIKER, FRAC4, SPACE_COP];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncBoard(id, fillers, p1, p2, EXTRA);
const offeredBy = (s: GameState, cardId: string, instanceId: string) => choiceFromCard(s, cardId) || actionsMentioning(s, instanceId).length > 0;

// ===========================================================================
describe("XG7-062 シャークラー", () => {
  const TEXT =
    "【シャーブラシ】これをラッシュしたとき、ホールド状態の自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、自軍山札の上から1枚ひいて、そのカードが特徴「メカ」を持つならリリース状態で、持たないならホールド状態で自軍コマンドゾーンに置く。";

  it("XG7-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-2381）", () => {
    expectCatalogText("XG7-062", TEXT);
    expectUnitStats("XG7-062", { name: "シャークラー", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["メカ"] });
    expectRarityIn("XG7-062", ["N"]);
  });

  /** ラッシュの支払いで ET のコマンド（TST-OP-ET:c0）がホールドされる。もう1つホールド状態のコマンド（h0）がある。 */
  const brush = (top: CardInstance) =>
    rushFromHand(rushPhaseOf({ hand: [inst("XG7-062", "sk")], command: [...releasedCat("ET", 1, "c"), { ...inst("TST-OP", "h0"), commandHeld: true }], deck: [top, ...deckCards(3)] }, {}, EXTRA), "player1", "XG7-062:sk").state;

  it("XG7-062: 【シャーブラシ】ラッシュしたとき、ホールド状態の自軍コマンドから1つ選べる（任意）（出典: atwiki/page-2381「ホールド状態の自軍コマンドを1つ選び捨札にしてもよい」）", () => {
    const s = brush(inst("SPEC-MECHA", "top"));
    expectChoiceFrom(s, "player1", "XG7-062");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:c0", "TST-OP:h0"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-062: 【シャーブラシ】捨札にしたとき、山札の上の1枚が特徴「メカ」を持つならリリース状態でコマンドゾーンに置く（出典: atwiki/page-2381「特徴「メカ」を持つならリリース状態で」） — 既知の不具合: CARD-XG7-062 【シャーブラシ】が本文と違う（選んだコマンドを捨札にせず、山札の上のカードもコマンドゾーンに置かない）", () => {
    const s = resolveAll(brush(inst("SPEC-MECHA", "top")), ["TST-OP:h0"]);
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-MECHA:top")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-MECHA:top")?.commandHeld).not.toBe(true);
  });

  it.fails("XG7-062: 【シャーブラシ】山札の上の1枚が「メカ」を持たないならホールド状態で置く（出典: atwiki/page-2381「持たないならホールド状態で自軍コマンドゾーンに置く」） — 既知の不具合: CARD-XG7-062 【シャーブラシ】が本文と違う（選んだコマンドを捨札にせず、山札の上のカードもコマンドゾーンに置かない）", () => {
    const s = resolveAll(brush(inst("SPEC-PLAIN", "top")), ["TST-OP:h0"]);
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-PLAIN:top")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG7-063 シャークラーSM", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「シャークラー」のカードを1枚選び、自軍ラッシュエリアに出す。 【コブンザメ】自軍ラッシュフェイズ中、このユニットをホールドしてもよい。そうしたとき、BP2000以下の敵軍ユニットを1体選び撃破する。";

  it("XG7-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-2382）", () => {
    expectCatalogText("XG7-063", TEXT);
    expectUnitStats("XG7-063", { name: "シャークラーSM", category: "ET", size: "S", bp: 5500, sp: "1/5", powerCost: "7-", comboNumber: undefined, features: ["メカ", "人型", "スーパーモード"], rushCondition: "zord_down_send_to_command_or_discard" });
    expectRarityIn("XG7-063", ["N"]);
  });

  const zord = (destination: "command" | "discard") => {
    const r = rushVia(rushPhaseOf({ hand: [inst("XG7-063", "sm")], rush: [inst("XG7-062", "sk")], command: releasedCat("ET", 1), power: [] }, {}, EXTRA), "player1", "XG7-063:sm", (a) => a.zordMaterialInstanceId === "XG7-062:sk" && a.zordMaterialDestination === destination);
    return { ...r, state: resolveAll(r.state) };
  };

  it("XG7-063: 追加条件 — 自軍「シャークラー」1体をコマンドゾーンに送れば必要パワー0でラッシュできる（出典: atwiki/page-2382「自軍「シャークラー」1体をコマンドゾーンに送るか捨札にすれば必要パワー0になる」）", () => {
    const r = zord("command");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-063:sm")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG7-062:sk")).toBe("command");
  });

  it("XG7-063: 追加条件 — 捨札にしても必要パワー0でラッシュできる（出典: atwiki/page-2382）", () => {
    const r = zord("discard");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-062:sk")).toBe("discard");
  });

  it("XG7-063: 必要パワー7- —「シャークラー」がいなければパワー7が要る（6ではラッシュできない）（出典: atwiki/page-2382「必要パワー：7-」）", () => {
    expect(canStartRush(rushPhaseOf({ hand: [inst("XG7-063", "sm")], command: releasedCat("ET", 1), power: powerCards(6) }, {}, EXTRA), "player1", "XG7-063:sm")).toBe(false);
  });

  it("XG7-063: ※ 撃破されて捨札になったとき、自軍捨札の「シャークラー」を自軍ラッシュエリアに出す（出典: atwiki/page-2382「自軍コマンドゾーンか自軍捨札から「シャークラー」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s0 = attack(enemyTurnOf({ battle: [inst("XG7-063", "sm")], discard: [inst("XG7-062", "sk")] }, { battle: [inst("SPEC-BIG", "atk")] }, EXTRA), "SPEC-BIG:atk", "XG7-063:sm", "player2");
    const s = resolveAll(settle(s0), ["XG7-062:sk"]);
    expect(zoneOf(s, "player1", "XG7-063:sm")).toBe("discard");
    expect(zoneOf(s, "player1", "XG7-062:sk")).toBe("rush");
  });

  it("XG7-063: ※ 自軍コマンドゾーンの「シャークラー」も選べる（出典: atwiki/page-2382「自軍コマンドゾーンか自軍捨札から」）", () => {
    const s0 = attack(enemyTurnOf({ battle: [inst("XG7-063", "sm")], command: [released("XG7-062", "sk")] }, { battle: [inst("SPEC-BIG", "atk")] }, EXTRA), "SPEC-BIG:atk", "XG7-063:sm", "player2");
    const s = resolveAll(settle(s0), ["XG7-062:sk"]);
    expect(zoneOf(s, "player1", "XG7-062:sk")).toBe("rush");
  });

  const kobun = () => rushPhaseOf({ rush: [inst("XG7-063", "sm")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E2500", "b")], rush: [inst("SPEC-EC1", "c")] }, EXTRA);

  it.fails("XG7-063: 【コブンザメ】自軍ラッシュフェイズ中、これをホールドして起動できる（出典: atwiki/page-2382「自軍ラッシュフェイズ中、このユニットをホールドしてもよい」） — 既知の不具合: CARD-XG7-063 【コブンザメ】（ホールドして BP2000 以下の敵軍ユニットを撃破）の起動が未実装", () => {
    expect(canActivate(kobun(), "XG7-063:sm")).toBe(true);
  });

  it.fails("XG7-063: 【コブンザメ】ホールドしたとき、BP2000 以下の敵軍ユニット（エリアを問わない）を1体選び撃破する（BP2500 は選べない）（出典: atwiki/page-2382「BP2000以下の敵軍ユニットを1体選び撃破する」） — 既知の不具合: CARD-XG7-063 【コブンザメ】（ホールドして BP2000 以下の敵軍ユニットを撃破）の起動が未実装", () => {
    let s = kobun();
    const a = legal(s).find((x) => x.type === "activate_field_unit_ability" && x.playerId === "player1" && JSON.stringify(x).includes("XG7-063:sm"));
    expect(a).toBeDefined();
    s = act(s, a!);
    expectChoiceFrom(s, "player1", "XG7-063");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a", "SPEC-EC1:c"]);
    s = resolveAll(pick(s, "SPEC-E2000:a"));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("discard");
    expect(cardIn(s, "player1", "XG7-063:sm")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG7-064 ドラフトレッダー", () => {
  const TEXT =
    "※スクラム 【リボルバックG-3】特徴「警察」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。";

  it("XG7-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-2442）", () => {
    expectCatalogText("XG7-064", TEXT);
    expectUnitStats("XG7-064", { name: "ドラフトレッダー", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: 1, features: ["メカ", "レッド", "男", "警察", "スワット"] });
    expectRarityIn("XG7-064", ["R"]);
  });

  scrumTests("XG7-064", 1, "atwiki/page-2442");

  /** 1番目に出る。自軍の「警察」はこれと SPEC-POLICE（ラッシュエリア）の2体。 */
  const revolver = (p2Command: CardInstance[] = []) =>
    nc("XG7-064:dr", 0, { rush: [inst("SPEC-POLICE", "pl")] }, { battle: [inst("SPEC-EC1", "e1"), inst("SPEC-EC2", "e2")], rush: [inst("SPEC-EC3", "e3")], command: p2Command });

  it.fails("XG7-064: 【リボルバックG-3】NC（1番目）— 「警察」を持つ自軍ユニットの数（2）以下の必要パワーの敵軍ユニット（エリアを問わない）から1体選べる（任意）（出典: atwiki/page-2442「その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、…置いてもよい」） — 既知の不具合: CARD-XG7-064 【リボルバックG-3】の選択を見送れない（本文は「置いてもよい」）", () => {
    const s = revolver();
    expectChoiceFrom(s, "player1", "XG7-064");
    expect(choiceIds(s)).toEqual(["SPEC-EC1:e1", "SPEC-EC2:e2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-064: 【リボルバックG-3】選んだユニットを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-2442「持ち主のコマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = resolveAll(revolver(), ["SPEC-EC2:e2"]);
    expect(zoneOf(s, "player2", "SPEC-EC2:e2")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-EC2:e2")?.commandHeld).toBe(true);
  });

  it("XG7-064: 【リボルバックG-3】持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-2442「置けなければ捨札にする」）", () => {
    const s = resolveAll(revolver(releasedCat("WB", 5, "full")), ["SPEC-EC2:e2"]);
    expect(zoneOf(s, "player2", "SPEC-EC2:e2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG7-065 ドラフトブルース", () => {
  const TEXT = "※スクラム 【トライキャノン】自軍ラッシュエリアから、特徴「メカ」を持つビークルを1体選んでもよい。そうしたとき、このターン、これは選んだビークルの必要パワーの数字1ごとにBP+1000される。";

  it("XG7-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-2380）", () => {
    expectCatalogText("XG7-065", TEXT);
    expectUnitStats("XG7-065", { name: "ドラフトブルース", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["メカ", "ブルー", "男", "警察"] });
    expectRarityIn("XG7-065", ["N"]);
  });

  scrumTests("XG7-065", 2, "atwiki/page-2380");

  const cannon = () => nc("XG7-065:db", 1, { rush: [inst("SPEC-MECHA-V3", "mv"), inst("SPEC-PLAIN-V3", "pv")] });

  it.fails("XG7-065: 【トライキャノン】NC（2番目）— 自軍ラッシュエリアの特徴「メカ」を持つビークルから1体選べる（任意）（出典: atwiki/page-2380「自軍ラッシュエリアから、特徴「メカ」を持つビークルを1体選んでもよい」） — 既知の不具合: CARD-XG7-065 【トライキャノン】（メカのビークルの必要パワーで BP+1000 ずつ）が未実装", () => {
    const s = cannon();
    expectChoiceFrom(s, "player1", "XG7-065");
    expect(choiceIds(s)).toEqual(["SPEC-MECHA-V3:mv"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-065: 【トライキャノン】選んだビークルの必要パワーの数字（3）1ごとに BP+1000（5000）（出典: atwiki/page-2380「選んだビークルの必要パワーの数字1ごとにBP+1000される」） — 既知の不具合: CARD-XG7-065 【トライキャノン】（メカのビークルの必要パワーで BP+1000 ずつ）が未実装", () => {
    const s = resolveAll(cannon(), ["SPEC-MECHA-V3:mv"]);
    expect(bpOf(s, "player1", "XG7-065:db")).toBe(5000);
    expect(zoneOf(s, "player1", "SPEC-MECHA-V3:mv")).toBe("rush");
  });
});

// ===========================================================================
describe("XG7-066 ドラフトキース", () => {
  const TEXT = "※レジスト 【ハイドランダー】自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにリリース状態で置く。";

  it("XG7-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-2424）", () => {
    expectCatalogText("XG7-066", TEXT);
    expectUnitStats("XG7-066", { name: "ドラフトキース", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: 3, features: ["メカ", "イエロー", "男", "警察"] });
    expectRarityIn("XG7-066", ["N"]);
  });

  it("XG7-066: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-2424「※レジスト」）", () => {
    let s = attack(enemyTurnOf({ battle: [inst("XG7-066", "dk")] }, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA), "TST-UNIT-7:atk", "XG7-066:dk", "player2");
    for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) s = settle(s, 1);
    expect(legal(s).some((a) => a.type === "use_register" && a.playerId === "player1")).toBe(true);
  });

  const hydra = () => nc("XG7-066:dk", 2, { command: [{ ...inst("TST-OP", "h0"), commandHeld: true }, released("TST-OP", "r0")], deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)] });

  it.fails("XG7-066: 【ハイドランダー】NC（3番目）— 自軍コマンド（ホールド・リリースを問わない）から1つ選べる（任意）（出典: atwiki/page-2424「自軍コマンドを1つ選び捨札にしてもよい」） — 既知の不具合: CARD-XG7-066 【ハイドランダー】（コマンドの入れ替え）が未実装", () => {
    const s = hydra();
    expectChoiceFrom(s, "player1", "XG7-066");
    expect(choiceIds(s)).toEqual(["TST-OP:h0", "TST-OP:r0"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-066: 【ハイドランダー】捨札にしたとき、山札の上の1枚をリリース状態でコマンドゾーンに置く（出典: atwiki/page-2424「自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにリリース状態で置く」） — 既知の不具合: CARD-XG7-066 【ハイドランダー】（コマンドの入れ替え）が未実装", () => {
    const s = resolveAll(hydra(), ["TST-OP:h0"]);
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-PLAIN:top")?.commandHeld).not.toBe(true);
  });
});

// ===========================================================================
describe("XG7-067 シンクレッダー", () => {
  const TEXT =
    "※レジスト ※これがリリース状態で自軍コマンドゾーンにある間、相手にストライクされたとき、これを捨札にしてそのストライクを無効にしてもよい。 【ヘビーサイクロン】SP1 （この効果は「ドラフトブルース」または「ドラフトキース」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG7-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-2448「SP：！」）", () => {
    expectCatalogText("XG7-067", TEXT);
    expectUnitStats("XG7-067", { name: "シンクレッダー", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: 5, features: ["メカ", "レッド", "男", "警察", "スワット"] });
    expectRarityIn("XG7-067", ["SR"]);
  });

  it("XG7-067: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-2448「※レジスト」）", () => {
    let s = attack(enemyTurnOf({ battle: [inst("XG7-067", "sr")] }, { battle: [inst("SPEC-BIG", "atk")] }, EXTRA), "SPEC-BIG:atk", "XG7-067:sr", "player2");
    for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) s = settle(s, 1);
    expect(legal(s).some((a) => a.type === "use_register" && a.playerId === "player1")).toBe(true);
  });

  it.fails("XG7-067: 【ヘビーサイクロン】NC（5番目）— SP1（出典: atwiki/page-2448「【ヘビーサイクロン】SP1」） — 既知の不具合: CARD-XG7-067 【ヘビーサイクロン】（SP1・ブルース／キースからの発動）が未実装", () => {
    expect(spOf(resolveAll(nc("XG7-067:sr", 4)), "player1", "XG7-067:sr")).toBe(1);
  });

  it.fails("XG7-067: 【ヘビーサイクロン】XG7-065 ドラフトブルースからコンビネーションするとき（2番目）はナンバーに関係なく SP1（出典: atwiki/page-2448「「ドラフトブルース」または「ドラフトキース」からコンビネーションするときはナンバーに関係なく発動する」） — 既知の不具合: CARD-XG7-067 【ヘビーサイクロン】（SP1・ブルース／キースからの発動）が未実装", () => {
    let s = resolveAll(enter(p1Battle({ rush: [inst("XG7-065", "db"), inst("XG7-067", "sr")] }, {}, EXTRA), "XG7-065:db"), ["__none__"]);
    s = resolveAll(enter(passEntry(s), "XG7-067:sr"));
    expect(spOf(s, "player1", "XG7-067:sr")).toBe(1);
  });

  it("XG7-067: 【ヘビーサイクロン】ほかのユニットの次（2番目）では SP1 にならない（出典: atwiki/page-2448「CN：5」）", () => {
    let s = enter(p1Battle({ rush: [inst("SPEC-PLAIN", "p"), inst("XG7-067", "sr")] }, {}, EXTRA), "SPEC-PLAIN:p");
    s = resolveAll(enter(passEntry(resolveAll(s)), "XG7-067:sr"));
    expect(spOf(s, "player1", "XG7-067:sr")).not.toBe(1);
  });

  const struck = (cmd: CardInstance) => {
    const s = st({ activePlayer: "player2", player1: { command: [cmd], deck: deckCards(5) }, player2: { battle: [inst("SPEC-STRIKER", "s")], deck: deckCards(5, "e") } }, EXTRA);
    return strike(s, "SPEC-STRIKER:s", "player2");
  };

  it.fails("XG7-067: ※ リリース状態で自軍コマンドゾーンにある間、相手にストライクされたとき、これを捨札にしてストライクを無効にできる（出典: atwiki/page-2448「これを捨札にしてそのストライクを無効にしてもよい」） — 既知の不具合: CARD-XG7-067 コマンドゾーンからストライクを無効にする※が未実装", () => {
    expect(offeredBy(struck(released("XG7-067", "sr")), "XG7-067", "XG7-067:sr")).toBe(true);
  });

  it("XG7-067: ※ ホールド状態なら使えない（出典: atwiki/page-2448「これがリリース状態で」）", () => {
    expect(offeredBy(struck({ ...inst("XG7-067", "sr"), commandHeld: true }), "XG7-067", "XG7-067:sr")).toBe(false);
  });
});

// ===========================================================================
describe("XG7-068 宇宙刑事シャリバン×ギャバン×シャイダー", () => {
  const TEXT =
    "※ブレイカー ※クロス2 ※チェイス ※これはビークルにライドできる。 【蒸着・赤射・焼結】これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、特徴「宇宙刑事」を持つ自軍ユニットがなければ、自軍コマンドゾーンからオペレーションカードを3枚選びホールドしてもよい。そうしたとき、これを自軍ラッシュエリアに出す。";

  it("XG7-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-2433）", () => {
    expectCatalogText("XG7-068", TEXT);
    expectUnitStats("XG7-068", { name: "宇宙刑事シャリバン×ギャバン×シャイダー", category: "OT", size: "S", bp: 7000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["宇宙刑事", "メカ", "男", "警察"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-068", ["SR"]);
  });

  it.fails("XG7-068: 追加条件 — コマンドを追加で2つホールドしてラッシュする（ホールドしたコマンドは合わせて3つ）（出典: atwiki/page-2433「追加条件：追加で自軍コマンドを2つホールドする」） — 既知の不具合: CARD-XG7-068 カタログ: 追加条件の unitCount が 1（本文は「追加で自軍コマンドを2つホールドする」）で、追加のホールドが1つで済んでしまう", () => {
    const r = rushFromHand(rushPhaseOf({ hand: [inst("XG7-068", "h")], command: releasedCat("OT", 3, "x"), power: powerCards(6) }, {}, EXTRA), "player1", "XG7-068:h");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.players.player1.command.filter((c) => c.commandHeld).length).toBe(3);
  });

  it.fails("XG7-068: 追加条件 — リリース状態の自軍コマンドが2つだけならラッシュできない（出典: atwiki/page-2433「追加で自軍コマンドを2つホールドする」） — 既知の不具合: CARD-XG7-068 カタログ: 追加条件の unitCount が 1（本文は「追加で自軍コマンドを2つホールドする」）で、追加のホールドが1つで済んでしまう", () => {
    expect(canStartRush(rushPhaseOf({ hand: [inst("XG7-068", "h")], command: releasedCat("OT", 2, "x"), power: powerCards(6) }, {}, EXTRA), "player1", "XG7-068:h")).toBe(false);
  });

  breakerTests("XG7-068", "atwiki/page-2433", EXTRA, { breaker_name: "※ブレイカーの同名ラッシュ制限が効かない" });

  it.fails("XG7-068: ※クロス2 — これが自軍バトルエリアにある間、右に並ぶ SP1/4 のユニットは2番目で SP1 になる（分母が2少なくなる）（出典: atwiki/page-2433「※クロス2」・atwiki/page-2393 規定文） — 既知の不具合: CARD-XG7-068 ※クロス2（分母・CN を2減らす）が効かない", () => {
    const s = enter(p1Battle({ battle: [inst("XG7-068", "x")], rush: [inst("SPEC-XFRAC4", "f")] }, {}, EXTRA), "SPEC-XFRAC4:f");
    expect(spOf(s, "player1", "SPEC-XFRAC4:f")).toBe(1);
  });

  it("XG7-068: ※ビークルにライドできる（出典: atwiki/page-2433「※これはビークルにライドできる」）", () => {
    expect(canMount(p1Battle({ rush: [inst("XG7-068", "x"), inst("SPEC-V", "v")] }, {}, EXTRA), "XG7-068:x", "SPEC-V:v")).toBe(true);
  });

  it("XG7-068: ※チェイス — ライド中に撃破されるとき、ライドしているビークルを捨札にしてラッシュエリアのビークルに乗り換えられる（出典: atwiki/page-2433「※チェイス」・rules/07-keywords R-KW-CHASE-01）", () => {
    let s = st({ player1: { rush: [inst("SPEC-BIG", "a")], deck: deckCards(3) }, player2: { battle: ridingPair("XG7-068", "x", "SPEC-V", "v"), rush: [inst("SPEC-V2", "v2")], deck: deckCards(3, "e") } }, EXTRA);
    s = attack(enter(s, "SPEC-BIG:a"), "SPEC-BIG:a", "XG7-068:x");
    for (let i = 0; i < 4 && chaseTargets(s, "player2").length === 0; i++) s = settle(s, 1);
    expect(chaseTargets(s, "player2")).toEqual(["SPEC-V2:v2"]);
  });

  const steam = (rush: CardInstance[] = [], command: CardInstance[] = [released("TST-OP", "o0"), released("TST-OP", "o1"), released("TST-OP", "o2")]) =>
    rushPhaseOf({ power: [{ ...inst("XG7-068", "pw"), faceDown: false }, ...powerCards(1)], command, rush }, {}, EXTRA);

  it.fails("XG7-068: 【蒸着・赤射・焼結】自軍パワーゾーンでオモテ向きの間、自軍ラッシュフェイズ中、「宇宙刑事」の自軍ユニットがいなければ、コマンドゾーンのオペレーションカード3枚をホールドしてラッシュエリアに出せる（出典: atwiki/page-2433「自軍コマンドゾーンからオペレーションカードを3枚選びホールドしてもよい。そうしたとき、これを自軍ラッシュエリアに出す」） — 既知の不具合: CARD-XG7-068 【蒸着・赤射・焼結】（パワーゾーンから出る）が未実装", () => {
    expect(canSelfRush(steam(), "power", "XG7-068:pw") || offeredBy(steam(), "XG7-068", "XG7-068:pw")).toBe(true);
  });

  it("XG7-068: 【蒸着・赤射・焼結】「宇宙刑事」を持つ自軍ユニットがいれば出せない（出典: atwiki/page-2433「特徴「宇宙刑事」を持つ自軍ユニットがなければ」）", () => {
    const s = steam([inst("SPEC-SPACE-COP", "sc")]);
    expect(canSelfRush(s, "power", "XG7-068:pw")).toBe(false);
  });

  it("XG7-068: 【蒸着・赤射・焼結】コマンドゾーンのオペレーションカードが2枚（とユニットカード1枚）なら出せない（出典: atwiki/page-2433「オペレーションカードを3枚選び」）", () => {
    const s = steam([], [released("TST-OP", "o0"), released("TST-OP", "o1"), released("SPEC-PLAIN", "u")]);
    expect(canSelfRush(s, "power", "XG7-068:pw")).toBe(false);
  });
});
