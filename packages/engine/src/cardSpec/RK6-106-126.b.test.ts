/**
 * カード別スペック: RK-113〜RK-119（ザ・マスクドライダーEXP vol.2 サイコローグ〜ギガゼール）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2（本範囲のカードの Q&A なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02、R-ADD-07、R-KW-REG、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア」を N／NR／R として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-119 のロック中のバトル進入の支払い — rkBattleEntryLockPayment.test.ts
 *  - RK-012 Q5（【エンドオブワールド】の処理途中に宏のオルゴール時計を使う）— cardSpec/RK1-001-021.b.test.ts（it.todo のまま）
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  legal,
  damageCards,
  act,
  PLAIN_VEHICLE,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  deckWithTen,
  enter,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  heldCount,
  heldUnit,
  inst,
  mount,
  mountedOn,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  rcUnit,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
} from "./RK6-106-126.helpers";
import { useHoldEffect } from "./RS6-369-389.helpers";

const RC2000 = rcUnit("SPEC-RC2000", { category: "WB", bp: 2000 });
const E1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const EM = sUnit("SPEC-EM", { bp: 5000, powerCost: 3, size: "M" });
const OWN = sUnit("SPEC-OWN", { bp: 1000 });
/** M サイズのビークル。 */
const M_VEHICLE = { ...PLAIN_VEHICLE, id: "SPEC-MVEH", name: "SPEC-MVEH", size: "M" } as unknown as CardDefinition;
const EXTRA = [RC2000, E1, EM, OWN, M_VEHICLE, PLAIN_VEHICLE];
/** RK-116 の照合で使う敵軍の並び（CN なしの S ユニット）。 */
const FILL2 = sUnit("SPEC-FILL2", { bp: 1000, sp: undefined });
const HOLD_EXTRA = [FILL2];
const fill2 = (n: number): CardInstance[] => Array.from({ length: n }, (_, i) => inst("SPEC-FILL2", `ef${i}`));
const attackAs2 = (s: GameState, attacker: string, defender: string) => act(s, { type: "battle", playerId: "player2", attackerInstanceId: attacker, defenderInstanceId: defender });

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
const riding = (vehicle: CardInstance, rider: CardInstance): CardInstance[] => [vehicle, { ...rider, mountedOnInstanceId: vehicle.instanceId }];

// ===========================================================================
describe("RK-113 サイコローグ", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【散弾】これをラッシュしたとき、ライド中の敵軍Sユニットを1体選び、ライドオフさせてもよい。";

  it("RK-113: カタログ本文・スペックが出典と一致（出典: atwiki/page-629）", () => {
    expectCatalogText("RK-113", TEXT);
    expectStats("RK-113", { name: "サイコローグ", category: "WB", size: "S", bp: 500, sp: "1/2", powerCost: 1, features: ["ミラーモンスター", "昆虫"] });
    expectRarityIn("RK-113", ["N"]);
  });

  it("RK-113: ※ 自軍コマンドを1つホールドしてバトルエリアに出る。リリース状態のコマンドがなければ出られない（出典: atwiki/page-629「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」・R-ADD-07）", () => {
    const s = enterWithHold(board({ rush: [inst("RK-113", "pr")], command: releasedCat("WB", 1) }), "RK-113:pr", ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", "RK-113:pr")).toBe("battle");
    expect(heldCount(s)).toBe(1);
    expect(canEnter(board({ rush: [inst("RK-113", "pr")] }), "RK-113:pr")).toBe(false);
  });

  /** 自軍ラッシュフェイズに手札からサイコローグをラッシュする（相手のラッシュの反応はパス）。 */
  const rushed = (p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({ phase: "rush", player1: { hand: [inst("RK-113", "pr")], command: releasedCat("WB", 1), power: powerCards(1), deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA);
    const r = rushFromHand(s, "player1", "RK-113:pr");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  const enemy = {
    battle: [...riding(inst("SPEC-VEHICLE", "v1"), inst("SPEC-RC2000", "rb")), inst("SPEC-E1", "un")],
    rush: riding(inst("SPEC-VEHICLE", "v2"), inst("SPEC-RC2000", "rr")),
  };

  it("RK-113: ラッシュしたとき、ライド中の敵軍 S ユニット（バトルエリア・ラッシュエリアを問わない）を1体選べる（任意）（出典: atwiki/page-629「ライド中の敵軍Sユニットを1体選び、ライドオフさせてもよい」・atwiki/page-616 カード評価「エリアを問わず、サイコローグの能力でライドオフさせられる」）", () => {
    const s = rushed(enemy);
    expectChoiceFrom(s, "player1", "RK-113");
    expect(choiceIds(s)).toEqual(["SPEC-RC2000:rb", "SPEC-RC2000:rr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-113: 選んだユニットはライドオフする（ユニットもビークルもその場に残る）（出典: atwiki/page-629「ライドオフさせてもよい」）", () => {
    const s = settle(pick(rushed(enemy), "SPEC-RC2000:rb"));
    expect(mountedOn(s, "player2", "SPEC-RC2000:rb")).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-RC2000:rb")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v1")).toBe("battle");
    expect(mountedOn(s, "player2", "SPEC-RC2000:rr")).toBe("SPEC-VEHICLE:v2");
  });

  it("RK-113: 選ばなければライドしたまま（出典: atwiki/page-629「ライドオフさせてもよい」）", () => {
    const s = settle(skip(rushed(enemy)));
    expect(mountedOn(s, "player2", "SPEC-RC2000:rb")).toBe("SPEC-VEHICLE:v1");
  });
});

// ===========================================================================
describe("RK-114 サイコローダー", () => {
  const TEXT = "【デッドエンド】自軍ターン中、これがバトルエリアに出たとき、ライドされていない敵軍Sビークルを1体選び、捨札にしてもよい。";

  it("RK-114: カタログ本文・スペックが出典と一致（出典: atwiki/page-616）", () => {
    expectCatalogText("RK-114", TEXT);
    expectVehicleStats("RK-114", { name: "サイコローダー", category: "WB", powerCost: "3+", size: "S", features: ["ミラーモンスター", "車両", "昆虫"] });
    expect((DEFS["RK-114"] as { rushAdditionalCondition?: { partnerName?: string } }).rushAdditionalCondition?.partnerName).toBe("サイコローグ");
    expectRarityIn("RK-114", ["N"]);
  });

  it("RK-114: 追加条件 — 自軍「サイコローグ」1体を捨札にして、必要パワー3でラッシュできる（出典: atwiki/page-616「必要パワー：3+」「追加条件：自軍「サイコローグ」1体を捨札にする。」・R-ADD-02）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RK-114", "pd")], rush: [inst("RK-113", "pr")], command: releasedCat("WB", 1), power: powerCards(3), deck: deckCards(3) } }, EXTRA);
    const r = rushFromHand(s, "player1", "RK-114:pd", { materials: ["RK-113:pr"] });
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RK-114:pd")).toBe("rush");
    expect(zoneOf(t, "player1", "RK-113:pr")).toBe("discard");
  });

  it("RK-114: 追加条件 — 「サイコローグ」がいなければ、パワーが足りていてもラッシュできない（出典: atwiki/page-616「3+」・R-ADD-02）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RK-114", "pd")], command: releasedCat("WB", 1), power: powerCards(6), deck: deckCards(3) } }, EXTRA);
    expect(canStartRush(s, "player1", "RK-114:pd")).toBe(false);
  });

  /** 自軍バトルフェイズに、RC のユニットがサイコローダーにライドしてバトルエリアに出る。 */
  const deadEnd = (p2: Partial<GameState["players"]["player2"]>) =>
    mount(board({ rush: [inst("SPEC-RC2000", "r"), inst("RK-114", "pd")] }, p2), "SPEC-RC2000:r", "RK-114:pd");
  const enemy = {
    battle: [inst("SPEC-VEHICLE", "v1"), ...riding(inst("SPEC-VEHICLE", "v3"), inst("SPEC-RC2000", "er")), inst("SPEC-MVEH", "mv")],
    rush: [inst("SPEC-VEHICLE", "v2")],
  };

  it("RK-114: 自軍ターン中にバトルエリアに出たとき、ライドされていない敵軍 S ビークル（エリアを問わない）を1体選べる（ライドされているもの・M ビークルは選べない）（任意）（出典: atwiki/page-616「ライドされていない敵軍Sビークルを1体選び、捨札にしてもよい」）", () => {
    const s = deadEnd(enemy);
    expectChoiceFrom(s, "player1", "RK-114");
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:v1", "SPEC-VEHICLE:v2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-114: 選んだビークルは捨札になる（出典: atwiki/page-616「捨札にしてもよい」）", () => {
    const s = settle(pick(deadEnd(enemy), "SPEC-VEHICLE:v2"));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v1")).toBe("battle");
  });

  it("RK-114: 選ばなければ何も捨札にしない（出典: atwiki/page-616「捨札にしてもよい」）", () => {
    const s = settle(skip(deadEnd(enemy)));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v1")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v2")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-115 仮面ライダーゾルダ", () => {
  const TEXT =
    "【エンドオブワールド】｢マグナギガ｣からコンビネーションしたとき発動できる⇒ホールド状態のSユニットをすべて撃破する。その後、Sユニットをすべてホールドする。";

  it("RK-115: カタログ本文・スペックが出典と一致（出典: atwiki/page-627）", () => {
    expectCatalogText("RK-115", TEXT);
    expectStats("RK-115", { name: "仮面ライダーゾルダ", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 6, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-115", ["R"]);
  });

  const enemy = {
    battle: [heldUnit("SPEC-E1", "eh"), inst("SPEC-E1", "er"), heldUnit("SPEC-EM", "ehm")],
    rush: [heldUnit("SPEC-E1", "erh"), inst("SPEC-E1", "err")],
  };
  /** マグナギガ（自軍バトルエリアの最後）からゾルダがコンビネーションする。 */
  const fromMagnagiga = () =>
    enter(board({ battle: [inst("RK-116", "mg")], rush: [inst("RK-115", "zo"), heldUnit("SPEC-OWN", "oh")] }, enemy), "RK-115:zo");

  it("RK-115: 「マグナギガ」からコンビネーションしたとき、発動するかを選べる（任意）（出典: atwiki/page-627「｢マグナギガ｣からコンビネーションしたとき発動できる」）", () => {
    const s = fromMagnagiga();
    expectChoiceFrom(s, "player1", "RK-115");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-115: 発動すると、ホールド状態の S ユニットを敵味方・エリアを問わずすべて撃破する（M ユニットは撃破しない）（出典: atwiki/page-627「ホールド状態のSユニットをすべて撃破する」・カード評価「効果は敵味方構わず」）", () => {
    const s = settle(confirm(fromMagnagiga()));
    expect(zoneOf(s, "player2", "SPEC-E1:eh")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E1:erh")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-OWN:oh")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-EM:ehm")).toBe("battle");
  });

  it("RK-115: その後、残った S ユニットをゾルダ自身を含めて敵味方・エリアを問わずすべてホールドする（出典: atwiki/page-627「その後、Sユニットをすべてホールドする」・カード評価「自身も対象に入っている」）", () => {
    const s = settle(confirm(fromMagnagiga()));
    for (const [pid, id] of [["player1", "RK-115:zo"], ["player1", "RK-116:mg"], ["player2", "SPEC-E1:er"], ["player2", "SPEC-E1:err"]] as const) {
      expect(cardIn(s, pid, id)?.commandHeld, id).toBe(true);
    }
  });

  it("RK-115: 発動しなければ何も起きない（出典: atwiki/page-627「発動できる」）", () => {
    const s = settle(skip(fromMagnagiga()));
    expect(zoneOf(s, "player2", "SPEC-E1:eh")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-E1:er")?.commandHeld ?? false).toBe(false);
  });

  it("RK-115: 「マグナギガ」以外のユニットからコンビネーションしたときは発動しない（マグナギガが直前でなければ発動しない）（出典: atwiki/page-627「｢マグナギガ｣からコンビネーションしたとき」）", () => {
    const s = enter(board({ battle: [inst("RK-116", "mg"), inst("SPEC-OWN", "x")], rush: [inst("RK-115", "zo")] }, enemy), "RK-115:zo");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-115");
  });

  it.todo(
    "RK-115: コミュニティQ&A — 撃破する対象は発動を解決し始めたときに決まり、解決中にホールド状態になったユニット（ダイノガッツ・仮面ライダーキバのホールド状態でのラッシュ）は撃破されない（出典: atwiki/page-627 コメント欄）— 【エンドオブワールド】の撃破の処理途中に、撃破されたユニットの効果でホールド状態のユニットを場に出す手順を公開 API で組めないため",
  );
});

// ===========================================================================
describe("RK-116 マグナギガ", () => {
  const TEXT =
    "※これはアタックすることができない。 ※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【そびえる巨体】これが自軍バトルエリアにある間、自軍コマンドゾーンのカードは敵軍ユニットの効果によってホールドされない。";

  it("RK-116: カタログ本文・スペックが出典と一致（出典: atwiki/page-645）", () => {
    expectCatalogText("RK-116", TEXT);
    expectStats("RK-116", { name: "マグナギガ", category: "WB", size: "S", bp: 6000, sp: undefined, powerCost: 4, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("RK-116", ["NR"]);
  });

  it("RK-116: ※ アタックできない（出典: atwiki/page-645「※これはアタックすることができない」）", () => {
    const s = board({ battle: [inst("RK-116", "mg")] }, { battle: [inst("SPEC-E1", "e")] });
    expect(attackTargets(s, "RK-116:mg")).toEqual([]);
  });

  it("RK-116: ※ 自軍コマンドを1つホールドしてバトルエリアに出る。リリース状態のコマンドがなければ出られない（出典: atwiki/page-645「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」）", () => {
    const s = enterWithHold(board({ rush: [inst("RK-116", "mg")], command: releasedCat("WB", 1) }), "RK-116:mg", ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", "RK-116:mg")).toBe("battle");
    expect(heldCount(s)).toBe(1);
    expect(canEnter(board({ rush: [inst("RK-116", "mg")] }), "RK-116:mg")).toBe(false);
  });

  /** 敵軍（player2）がガオパンダ（RS-305【バンブーハリケーン】「これをラッシュしたとき、敵軍コマンドをすべてホールドする」）をラッシュする。 */
  const panda = (p1: Partial<GameState["players"]["player1"]>) => {
    const s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { command: releasedCat("WB", 2), deck: deckCards(3), ...p1 },
        player2: { hand: [inst("RS-305", "gp")], command: releasedCat("WB", 1, "e"), power: powerCards(5, "epw"), deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    const r = rushFromHand(s, "player2", "RS-305:gp");
    expect(r.ok, r.error).toBe(true);
    return settle(r.state);
  };

  it("RK-116: 自軍バトルエリアにある間、自軍コマンドは敵軍ユニットの効果（ガオパンダ【バンブーハリケーン】）でホールドされない（出典: atwiki/page-645「自軍コマンドゾーンのカードは敵軍ユニットの効果によってホールドされない」・カード評価「ガオパンダ…たちの能力の防止」）", () => {
    expect(heldCount(panda({ battle: [inst("RK-116", "mg")] }))).toBe(0);
  });

  it("RK-116: マグナギガがいなければ（比較）、ガオパンダで自軍コマンドがすべてホールドされる（出典: atwiki/page-645・RS-305 本文）", () => {
    expect(heldCount(panda({}))).toBe(2);
  });

  // ---- 個別に実装された「敵軍コマンドをホールドする」効果（RK-127〜147 の照合で整理）----
  // atwiki/page-645 カード評価「ガオパンダやギンガピンク、トリケラレンジャーたちの能力の防止」。敵軍（player2）のターンに、敵軍のユニットの効果で
  // 自軍（player1）コマンドをホールドしようとする。mg = true なら自軍バトルエリアにマグナギガがいる。
  const p2Turn = (mg: boolean, p2: Partial<GameState["players"]["player2"]>, phase: GameState["phase"] = "battle", p1: Partial<GameState["players"]["player1"]> = {}) =>
    st(
      {
        phase,
        activePlayer: "player2",
        player1: { battle: mg ? [inst("RK-116", "mg")] : [], command: releasedCat("WB", 3), deck: deckCards(5), ...p1 },
        player2: { deck: deckCards(5, "e"), ...p2 },
      },
      [...EXTRA, ...HOLD_EXTRA],
    );
  const p2Enter = (s: GameState, id: string) => act(s, { type: "move_to_battle", playerId: "player2", instanceId: id });
  const p1Held = (s: GameState) => heldCount(s, "player1");

  it("RK-116: トリケラレンジャー（RS-082【トリケランス】NC）でも自軍コマンドはホールドされない。いなければ1つホールドされる（出典: atwiki/page-645 カード評価「トリケラレンジャー…の能力の防止」・RS-082 本文「敵軍コマンドを1つ選んでホールドする」）", () => {
    const run = (mg: boolean) => resolveAll(p2Enter(p2Turn(mg, { battle: fill2(2), rush: [inst("RS-082", "tr")] }), "RS-082:tr"));
    expect(p1Held(run(true))).toBe(0);
    expect(p1Held(run(false))).toBe(1);
  });

  it("RK-116: ギンガピンク（RS-380【花弁の爪】「敵軍コマンドをすべてホールドする」）でも自軍コマンドはホールドされない（コストの MA はホールドされる）（出典: atwiki/page-645 カード評価「ギンガピンク…の能力の防止」）", () => {
    const run = (mg: boolean) => {
      const s = p2Enter(p2Turn(mg, { battle: fill2(1), rush: [inst("RS-380", "gp")], command: releasedCat("MA", 1, "eMA") }), "RS-380:gp");
      return resolveAll(useHoldEffect(s, "player2", "RS-380:gp", ["TST-OP-MA:eMA0"]));
    };
    const blocked = run(true);
    expect(blocked.players.player2.command[0]?.commandHeld).toBe(true);
    expect(p1Held(blocked)).toBe(0);
    expect(p1Held(run(false))).toBe(3);
  });

  it("RK-116: ガオコング（RS-159【ファイヤーダンス】「敵軍コマンドを敵軍ダメージの数まで選んでホールドする」）でも自軍コマンドはホールドされない（出典: atwiki/page-645「敵軍ユニットの効果によってホールドされない」・RS-159 本文）", () => {
    const run = (mg: boolean) =>
      resolveAll(
        enterWithHold(p2Turn(mg, { rush: [inst("RS-159", "gk")], command: releasedCat("WB", 1, "e") }, "battle", { power: damageCards(2) }), "RS-159:gk", ["TST-OP:e0"], "player2"),
      );
    expect(p1Held(run(true))).toBe(0);
    expect(p1Held(run(false))).toBe(2);
  });

  it("RK-116: マジキング（RS-070【天空魔法斬り】「敵軍コマンドをすべてホールドしてもよい」）でも自軍コマンドはホールドされない（RS-111 も同じ処理）（出典: atwiki/page-645・RS-070 本文）", () => {
    const blocked = p2Enter(p2Turn(true, { rush: [inst("RS-070", "mk")] }), "RS-070:mk");
    expect(blocked.pendingEffectChoice?.sourceCardId).not.toBe("RS-070");
    expect(p1Held(resolveAll(blocked))).toBe(0);
    const open = p2Enter(p2Turn(false, { rush: [inst("RS-070", "mk")] }), "RS-070:mk");
    expect(open.pendingEffectChoice?.sourceCardId).toBe("RS-070");
    expect(p1Held(confirm(open))).toBe(3);
  });

  it("RK-116: ゲキトージャ（RS-422【大頑頑拳】アタックしてバトルに勝つたび敵軍コマンドを1つホールドしてもよい）でも自軍コマンドはホールドされず、追加のアタックも得ない（出典: atwiki/page-645・RS-422 本文「ホールドしてもよい。そうしたとき、これは追加でアタックできる」）", () => {
    const run = (mg: boolean) => settle(attackAs2(p2Turn(mg, { battle: [inst("RS-422", "gt")] }, "battle", { battle: [...(mg ? [inst("RK-116", "mg")] : []), inst("SPEC-OWN", "d")] }), "RS-422:gt", "SPEC-OWN:d"));
    expect(run(true).pendingEffectChoice?.sourceCardId).not.toBe("RS-422");
    expect(run(false).pendingEffectChoice?.sourceCardId).toBe("RS-422");
  });

  it("RK-116: 守護獣ジュウマンモス（RS-036【モスブリザード】「相手は可能ならコマンドを2つ選んでホールドする」）でも自軍コマンドはホールドしない（出典: atwiki/page-645「敵軍ユニットの効果によってホールドされない」・RS-036 本文「可能なら」）", () => {
    const run = (mg: boolean) => {
      const s = p2Turn(mg, { hand: [inst("RS-036", "jm")], command: releasedCat("WB", 1, "e"), power: powerCards(5, "ep") }, "rush");
      const r = rushFromHand(s, "player2", "RS-036:jm");
      expect(r.ok, r.error).toBe(true);
      let next = settle(r.state);
      // 相手（自軍）がコマンドを選んでホールドする（effect_hold の支払いで2つ選ぶ）。
      const hold = legal(next).find((a) => a.type === "initiate_command_payment" && a.kind === "effect_hold" && a.playerId === "player1");
      if (hold) next = act(next, hold);
      return settle(next);
    };
    expect(p1Held(run(true))).toBe(0);
    expect(p1Held(run(false))).toBe(2);
  });

  it("RK-116: マンモスレンジャー（RS-040【モスブレイカー】NC「相手は可能ならコマンドを1つ選んでホールドする」）でも自軍コマンドはホールドしない（出典: atwiki/page-645・RS-040 本文「可能なら」）", () => {
    const run = (mg: boolean) => p2Enter(p2Turn(mg, { battle: fill2(1), rush: [inst("RS-040", "mr")] }), "RS-040:mr");
    expect(run(true).pendingEffectChoice?.sourceCardId).not.toBe("RS-040");
    expect(run(false).pendingEffectChoice?.sourceCardId).toBe("RS-040");
  });

  it("RK-116: 自軍ラッシュエリアにあるときは防げない（出典: atwiki/page-645「これが自軍バトルエリアにある間」）", () => {
    expect(heldCount(panda({ rush: [inst("RK-116", "mg")] }))).toBe(2);
  });

  it("RK-116: 自軍の効果（ギガゼールの※）で自軍コマンドをホールドすることは妨げない（出典: atwiki/page-645「敵軍ユニットの効果によって」）", () => {
    const s = enterWithHold(board({ battle: [inst("RK-116", "mg")], rush: [inst("RK-119", "gz")], command: releasedCat("WB", 1) }), "RK-119:gz", ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", "RK-119:gz")).toBe("battle");
    expect(heldCount(s)).toBe(1);
  });

  it.todo(
    "RK-116: コミュニティQ&A — 敵軍の効果で自軍コマンドゾーンにカードを「ホールド状態で置く」ときも防ぐか（出典: atwiki/page-645 コメント欄）— 問い（関係なく発動するか）と答え（これ以上ホールドさせない効果だからその解釈でよい）が噛み合わず、どちらの扱いか出典で決まらないため",
  );
});

// ===========================================================================
describe("RK-117 仮面ライダータイガ", () => {
  const TEXT =
    "※これはホールド状態の敵軍ユニット1体につきBP+1000される。 【クリスタルブレイク】｢デストワイルダー｣からコンビネーションしたとき発動できる⇒敵軍バトルエリアから、ホールド状態のSユニットを1体選び撃破してもよい。";

  it("RK-117: カタログ本文・スペックが出典と一致（出典: atwiki/page-635）", () => {
    expectCatalogText("RK-117", TEXT);
    expectStats("RK-117", { name: "仮面ライダータイガ", category: "WB", size: "S", bp: 1000, sp: "1/2", powerCost: 3, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-117", ["R"]);
  });

  it("RK-117: ※ ホールド状態の敵軍ユニット（エリア・サイズを問わない）1体につき BP+1000。ホールド状態の敵軍コマンド・自軍ユニットは数えない（出典: atwiki/page-635「ホールド状態の敵軍ユニット1体につきBP+1000される」・コメント欄「ホールド状態のユニットならエリア関係無い」）", () => {
    const s = board(
      { battle: [inst("RK-117", "tg")], rush: [heldUnit("SPEC-OWN", "own")] },
      {
        battle: [heldUnit("SPEC-E1", "h1"), inst("SPEC-E1", "r")],
        rush: [heldUnit("SPEC-E1", "h2"), heldUnit("SPEC-EM", "hm")],
        command: [heldUnit("TST-OP", "hc1"), heldUnit("TST-OP", "hc2")],
      },
    );
    expect(bpOf(s, "player1", "RK-117:tg")).toBe(4000);
  });

  const enemy = { battle: [heldUnit("SPEC-E1", "h"), inst("SPEC-E1", "r"), heldUnit("SPEC-EM", "hm")], rush: [heldUnit("SPEC-E1", "rh")] };
  const fromDest = () => enter(board({ battle: [inst("RK-118", "dw")], rush: [inst("RK-117", "tg")] }, enemy), "RK-117:tg");

  it("RK-117: 「デストワイルダー」からコンビネーションしたとき、敵軍バトルエリアのホールド状態の S ユニットだけを選べる（任意）（出典: atwiki/page-635「敵軍バトルエリアから、ホールド状態のSユニットを1体選び撃破してもよい」）", () => {
    const s = fromDest();
    expectChoiceFrom(s, "player1", "RK-117");
    expect(choiceIds(s)).toEqual(["SPEC-E1:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-117: 選んだユニットを撃破する（出典: atwiki/page-635）", () => {
    const s = resolveAll(pick(fromDest(), "SPEC-E1:h"));
    expect(zoneOf(s, "player2", "SPEC-E1:h")).toBe("discard");
  });

  it("RK-117: 選ばなければ何も撃破しない（出典: atwiki/page-635「撃破してもよい」）", () => {
    const s = settle(skip(fromDest()));
    expect(zoneOf(s, "player2", "SPEC-E1:h")).toBe("battle");
  });

  it("RK-117: 「デストワイルダー」以外からコンビネーションしたときは発動しない（出典: atwiki/page-635「｢デストワイルダー｣からコンビネーションしたとき」）", () => {
    const s = enter(board({ battle: [inst("SPEC-OWN", "x")], rush: [inst("RK-117", "tg")] }, enemy), "RK-117:tg");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-117");
  });

  it("RK-117: デストワイルダー【クロー】でホールドした敵軍ユニットを、続けて出たタイガで撃破できる（出典: atwiki/page-630 カード評価「契約主である仮面ライダータイガ…とのコンボが強力」）", () => {
    let s = enterWithHold(board({ rush: [inst("RK-118", "dw"), inst("RK-117", "tg")], command: releasedCat("WB", 1) }, { battle: [inst("SPEC-E1", "e")] }), "RK-118:dw", ["TST-OP:cWB0"]);
    s = settle(pick(s, "SPEC-E1:e"));
    s = enter(passEntry(s), "RK-117:tg");
    expect(choiceIds(s)).toEqual(["SPEC-E1:e"]);
    s = resolveAll(pick(s, "SPEC-E1:e"));
    expect(zoneOf(s, "player2", "SPEC-E1:e")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-118 デストワイルダー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【クロー】自軍ターン中、これがバトルエリアに出たとき、レジストを持たない敵軍Sユニットを1体選びホールドしてもよい。";

  it("RK-118: カタログ本文・スペックが出典と一致（出典: atwiki/page-630）", () => {
    expectCatalogText("RK-118", TEXT);
    expectStats("RK-118", { name: "デストワイルダー", category: "WB", size: "S", bp: 4000, sp: undefined, powerCost: 2, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("RK-118", ["N"]);
  });

  it("RK-118: ※ 自軍コマンドを1つホールドしてバトルエリアに出る。リリース状態のコマンドがなければ出られない（出典: atwiki/page-630）", () => {
    const s = enterWithHold(board({ rush: [inst("RK-118", "dw")], command: releasedCat("WB", 1) }), "RK-118:dw", ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", "RK-118:dw")).toBe("battle");
    expect(canEnter(board({ rush: [inst("RK-118", "dw")] }), "RK-118:dw")).toBe(false);
  });

  const claw = (p2: Partial<GameState["players"]["player2"]>) =>
    enterWithHold(board({ rush: [inst("RK-118", "dw")], command: releasedCat("WB", 1) }, p2), "RK-118:dw", ["TST-OP:cWB0"]);
  const enemy = { battle: [inst("SPEC-E1", "b"), heldUnit("SPEC-E1", "h"), inst("SPEC-EM", "m"), inst("RK-108", "reg")], rush: [inst("SPEC-E1", "r")] };

  it("RK-118: 自軍ターン中にバトルエリアに出たとき、レジストを持たない敵軍 S ユニット（エリアを問わない）を1体選べる（レジストを持つもの・M ユニット・既にホールド状態のものは選べない）（任意）（出典: atwiki/page-630「レジストを持たない敵軍Sユニットを1体選びホールドしてもよい」）", () => {
    const s = claw(enemy);
    expectChoiceFrom(s, "player1", "RK-118");
    expect(choiceIds(s)).toEqual(["SPEC-E1:b", "SPEC-E1:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-118: 選んだユニットはホールド状態になる（出典: atwiki/page-630）", () => {
    const s = settle(pick(claw(enemy), "SPEC-E1:r"));
    expect(cardIn(s, "player2", "SPEC-E1:r")?.commandHeld).toBe(true);
  });

  it("RK-118: 選ばなければ何もホールドしない（出典: atwiki/page-630「ホールドしてもよい」）", () => {
    const s = settle(skip(claw(enemy)));
    expect(cardIn(s, "player2", "SPEC-E1:r")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("RK-119 ギガゼール", () => {
  const TEXT = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※このカードはデッキに好きな枚数入れてもよい。";

  it("RK-119: カタログ本文・スペックが出典と一致（出典: atwiki/page-628）", () => {
    expectCatalogText("RK-119", TEXT);
    expectStats("RK-119", { name: "ギガゼール", category: "WB", size: "S", bp: 500, sp: "1/2", powerCost: 0, features: ["ミラーモンスター", "獣", "レイヨウ型"] });
    expectRarityIn("RK-119", ["N"]);
  });

  it("RK-119: ※ デッキに好きな枚数（10枚）入れてもよい（出典: atwiki/page-628「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("RK-119", "ギガゼール")).toBe(true);
  });

  it("RK-119: ※ 自軍コマンドを1つホールドしてバトルエリアに出る。リリース状態のコマンドがなければ出られない（出典: atwiki/page-628）", () => {
    const s = enterWithHold(board({ rush: [inst("RK-119", "gz")], command: releasedCat("WB", 1) }), "RK-119:gz", ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", "RK-119:gz")).toBe("battle");
    expect(heldCount(s)).toBe(1);
    expect(canEnter(board({ rush: [inst("RK-119", "gz")] }), "RK-119:gz")).toBe(false);
  });
});
