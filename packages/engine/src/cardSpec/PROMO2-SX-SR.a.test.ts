/**
 * カード別スペック: SX-001〜SX-005（クロスギャザーのシークレットレア 仮面ライダー電王超CF〜仮面ライダーW・CJX）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「SX-」とカード名で検索:
 *     SX の項はない（XG 以降のカードは公式 FAQ がない）。atwiki に転載された公式 Q&A: atwiki/page-2017 SX-003 Q1・Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-SX-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-RESIST・R-KW-MORPH・R-ADD-02 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-SX-NNN …」）で残す。
 * レアリティは atwiki の「シークレットレア」を SC として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - SX-002 を BK-011 アークルで手札から出す（追加条件を実行する）— cardSpec/BK1-001-019.b.test.ts BK-011
 *  - SX-003 Q1（W・FJ で無効になったレジストを持つユニットを「レジストを持たない」として RM-057 で選べない）— cardSpec/RM3-043-062.c.test.ts RM-057 の it.todo
 *  - SX-005 の追加条件で「コマンドゾーンに送る」も選べる — docs/verification/rk-judgments.md RK-046 の行（照合済み）。ここでも確かめる
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackTargets,
  attackUntilRegister,
  battleBoard,
  bpOf,
  canMount,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  enemyBattle,
  enter,
  enterSeq,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  faceDown,
  faceUp,
  fill,
  inst,
  lastBattleBps,
  legal,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  registerOfferedTo,
  releasedCat,
  resolveAll,
  rushBoardWith,
  rushFromHand,
  settle,
  skip,
  spOf,
  sUnit,
  wingTests,
  zoneOf,
} from "./PROMO2-SX-SR.helpers";

const KAMEN = sUnit("SPEC-KAMEN", { category: "OT", bp: 2000, sp: 1, features: ["仮面ライダー", "男"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "OT", bp: 2000, sp: 1, features: ["男"] });
const E5000 = sUnit("SPEC-E5000", { bp: 5000 });
const E1000 = sUnit("SPEC-E1000", { bp: 1000 });
const E9000 = sUnit("SPEC-E9000", { bp: 9000, sp: 1 });
const BEAST = sUnit("SPEC-BEAST", { category: "DA", bp: 1000, features: ["獣"] });
const DINO = sUnit("SPEC-DINO", { category: "DA", bp: 1000, features: ["恐竜"] });
const RIDER = sUnit("SPEC-RIDER", { bp: 1000, comboNumber: "RC" });
const VEH_L = { ...PLAIN_VEHICLE, id: "SPEC-VEH-L", name: "SPEC-VEH-L", size: "L" } as unknown as CardDefinition;
/** 特徴「車両」だけを持つ効果なしの S ビークル（RK-030 トライチェイサーは自身の出たときの効果を持つので、ライドオフの確認にはこちらを使う）。 */
const CAR = { ...PLAIN_VEHICLE, id: "SPEC-CAR", name: "SPEC-CAR", features: ["車両"] } as unknown as CardDefinition;
const EXTRA: CardDefinition[] = [PLAIN_VEHICLE, KAMEN, PLAIN, E5000, E1000, E9000, BEAST, DINO, RIDER, VEH_L, CAR];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => battleBoard(EXTRA, p1, p2);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBattle(EXTRA, p1, p2);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoardWith(EXTRA, p1, p2);

// ===========================================================================
describe("SX-001 仮面ライダー電王超CF", () => {
  const TEXT =
    "※ウイング 【超ボイスターズキック】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンから、オモテ向きのカードとウラ向きのカードをそれぞれ1枚ずつ選び捨札にしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("SX-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-1681）", () => {
    expectCatalogText("SX-001", TEXT);
    expectUnitStats("SX-001", { name: "仮面ライダー電王超CF", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: "5+", features: ["仮面ライダー", "男", "DEN-O"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("SX-001", ["SC"]);
  });

  it("SX-001: 追加条件 — 自軍「仮面ライダー電王SF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-1681「自軍「仮面ライダー電王SF」1体をパワーゾーンに送る」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("SX-001", "cf")], rush: [inst("RK-066", "sf")], power: powerCards(5), command: releasedCat("OT", 1) }), "player1", "SX-001:cf");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-001:cf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-066:sf")).toBe("power");
  });

  it("SX-001: 追加条件 — 「仮面ライダー電王SF」でない S ユニットしかなければラッシュできない（出典: atwiki/page-1681・docs/verification/rk-judgments.md RK-054・057 の行）", () => {
    expect(canStartRush(rushPhase({ hand: [inst("SX-001", "cf")], rush: [inst("SPEC-KAMEN", "k")], power: powerCards(5), command: releasedCat("OT", 1) }), "player1", "SX-001:cf")).toBe(false);
  });

  wingTests("SX-001", "atwiki/page-1681「※ウイング」");

  /** 自軍パワーゾーン: オモテ向き2枚・ウラ向き1枚。電王超CF を1番目に出す（SP1/4 なので本来 SP を持たない）。 */
  const kick = (power: CardInstance[] = [faceUp("TST-P", "u1"), faceUp("TST-P", "u2"), faceDown("TST-P", "d1")]) =>
    enter(board({ rush: [inst("SX-001", "cf")], power }), "SX-001:cf");

  it("SX-001: 【超ボイスターズキック】自軍ターン中にバトルエリアに出たとき、自軍パワーゾーンのオモテ向きとウラ向きのカードを1枚ずつ選んで捨札にするかを選べる（任意）（出典: atwiki/page-1681「オモテ向きのカードとウラ向きのカードをそれぞれ1枚ずつ選び捨札にしてもよい」）", () => {
    const s = kick();
    expectChoiceFrom(s, "player1", "SX-001");
    expect(canSkip(s)).toBe(true);
  });

  it("SX-001: 【超ボイスターズキック】1枚ずつ捨札にすると、このターン「SP1」になる（1番目でもストライクで1点）（出典: atwiki/page-1681「そうしたとき、このターン、これは「SP1」になる」・カード評価「ストライクとダメージ回復を同時に行える」）", () => {
    let s = kick();
    for (const id of ["TST-P:u1", "TST-P:d1"]) if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-P:u1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:d1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:u2")).toBe("power");
    expect(spOf(s, "player1", "SX-001:cf")).toBe(1);
  });

  it("SX-001: 【超ボイスターズキック】捨札にしなければ SP は変わらない（1番目の SP1/4 はストライクできない）（出典: atwiki/page-1681「捨札にしてもよい。そうしたとき」）", () => {
    let s = kick();
    if (s.pendingEffectChoice?.sourceCardId === "SX-001") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-P:d1")).toBe("power");
    expect(canStrike(s, "SX-001:cf")).toBe(false);
  });

  it("SX-001: 【超ボイスターズキック】ウラ向きのカード（ダメージ）がなければ、オモテ向きのカードだけを捨札にして SP1 にはできない（出典: atwiki/page-1681「それぞれ1枚ずつ」）", () => {
    let s = kick([faceUp("TST-P", "u1"), faceUp("TST-P", "u2")]);
    if (s.pendingEffectChoice?.sourceCardId === "SX-001" && s.pendingEffectChoice.validInstanceIds.includes("TST-P:u1")) s = pick(s, "TST-P:u1");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-P:u1")).toBe("power");
    expect(spOf(s, "player1", "SX-001:cf")).toBe(0);
  });

  it("SX-001: 【超ボイスターズキック】敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1681「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("SX-001:cf", { power: [faceUp("TST-P", "u1"), faceDown("TST-P", "d1")] }, { battle: [inst("SPEC-E1000", "a")] }, EXTRA);
    expect(zoneOf(s, "player1", "SX-001:cf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("SX-001");
  });
});

// ===========================================================================
describe("SX-002 仮面ライダークウガRU", () => {
  const TEXT = "※レジスト 【黒い瞳に映るもの】これが自軍バトルエリアにある間、特徴「仮面ライダー」を持つユニットは、アタックかストライクを選ぶとき、可能ならアタックを選ぶ。";

  it("SX-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-1831）", () => {
    expectCatalogText("SX-002", TEXT);
    expectUnitStats("SX-002", { name: "仮面ライダークウガRU", category: ["MA", "DA"], size: "S", bp: 7000, sp: 1, powerCost: "7+", features: ["仮面ライダー", "男", "アマダム", "ライジング"], rushCondition: "discard_name_contains_unit" });
    expectRarityIn("SX-002", ["SC"]);
  });

  it("SX-002: 追加条件 — カード名に「クウガ」を含む自軍ユニット（XG2-073）1体を捨札にしてラッシュできる。含まないユニットでは満たせない（出典: atwiki/page-1831「カード名に「クウガ」を含む自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("SX-002", "ru")], rush: [inst("XG2-073", "kg")], power: powerCards(7), command: [...releasedCat("MA", 1), ...releasedCat("DA", 1)] }), "player1", "SX-002:ru");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-002:ru")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG2-073:kg")).toBe("discard");
    expect(canStartRush(rushPhase({ hand: [inst("SX-002", "ru")], rush: [inst("SPEC-KAMEN", "k")], power: powerCards(7), command: [...releasedCat("MA", 1), ...releasedCat("DA", 1)] }), "player1", "SX-002:ru")).toBe(false);
  });

  it("SX-002: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1831「※レジスト」・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("SX-002", "ru")] }, "SX-002:ru", { battle: [{ instanceId: "TST-UNIT-7:atk", cardId: "TST-UNIT-7", bpModifier: 1000 }] }))).toBe(true);
  });

  it("SX-002: 【黒い瞳に映るもの】自軍バトルエリアにあれば、特徴「仮面ライダー」を持つ自軍ユニットはアタックできるときストライクを選べない（出典: atwiki/page-1831「可能ならアタックを選ぶ」・カード評価「仮面ライダー限定でストライクを強制的にアタックに変更する」）", () => {
    const s = enter(board({ battle: [inst("SX-002", "ru")], rush: [inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-KAMEN:k");
    expect(attackTargets(s, "SPEC-KAMEN:k")).toContain("SPEC-E1000:e");
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(false);
  });

  it("SX-002: 【黒い瞳に映るもの】アタックかストライクを選ぶとき — 何もしない（パスする）ことはできる（出典: atwiki/page-1831 カード評価「「何もしない（＝アタックもストライクも行わない）」という選択が可能」）", () => {
    const s = enter(board({ battle: [inst("SX-002", "ru")], rush: [inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-KAMEN:k");
    expect(legal(s).some((a) => a.type === "pass_battle_entry" && a.playerId === "player1")).toBe(true);
  });

  it("SX-002: 【黒い瞳に映るもの】特徴「仮面ライダー」を持たないユニットはストライクを選べる（出典: atwiki/page-1831「特徴「仮面ライダー」を持つユニットは」）", () => {
    const s = enter(board({ battle: [inst("SX-002", "ru")], rush: [inst("SPEC-PLAIN", "p")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-PLAIN:p");
    expect(canStrike(s, "SPEC-PLAIN:p")).toBe(true);
  });

  it("SX-002: 【黒い瞳に映るもの】アタックできる敵軍ユニットがいなければ、仮面ライダーもストライクできる（出典: atwiki/page-1831「可能なら」）", () => {
    const s = enter(board({ battle: [inst("SX-002", "ru")], rush: [inst("SPEC-KAMEN", "k")] }), "SPEC-KAMEN:k");
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(true);
  });

  it("SX-002: 【黒い瞳に映るもの】敵軍の仮面ライダーにも効く（敵軍ターン中、敵軍の仮面ライダーは自軍ユニットにアタックできるときストライクを選べない）（出典: atwiki/page-1831「特徴「仮面ライダー」を持つユニットは」（自軍・敵軍の限定がない））", () => {
    const s = enter(enemyTurn({ battle: [inst("SX-002", "ru")] }, { rush: [inst("SPEC-KAMEN", "k")] }), "SPEC-KAMEN:k", "player2");
    expect(attackTargets(s, "SPEC-KAMEN:k", "player2")).toContain("SX-002:ru");
    expect(canStrike(s, "SPEC-KAMEN:k", "player2")).toBe(false);
  });

  it("SX-002: 【黒い瞳に映るもの】自軍ラッシュエリアにあるときは効かない（出典: atwiki/page-1831「これが自軍バトルエリアにある間」）", () => {
    const s = enter(board({ rush: [inst("SX-002", "ru"), inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-KAMEN:k");
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(true);
  });
});

// ===========================================================================
describe("SX-003 仮面ライダーW・FJ", () => {
  const TEXT =
    "※モーフ ※自軍ターン中、これが自軍バトルエリアにある間、敵軍バトルエリアにあるユニットの効果名を持たないテキストは無効になり、発動もできない。 【アーム・ファング】これはバトルするとき、BP+3000される。";

  it("SX-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-2017）", () => {
    expectCatalogText("SX-003", TEXT);
    expectUnitStats("SX-003", { name: "仮面ライダーW・FJ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: "4+", features: ["仮面ライダー", "男", "ダブルドライバー"], rushCondition: "state_gate" });
    expectRarityIn("SX-003", ["SC"]);
  });

  it.fails("SX-003: 追加条件 — 特徴「獣」または「恐竜」を持つ自軍コマンドがあればラッシュでき、なければラッシュできない（出典: atwiki/page-2017「特徴「獣」または「恐竜」を持つ自軍コマンドがある」）— 既知の不具合: CARD-SX-003 追加条件の「自軍コマンド」をオペレーションのカードに限って数えるので、ユニットのコマンドでは満たせない", () => {
    const mk = (command: CardInstance[]) => rushPhase({ hand: [inst("SX-003", "fj")], power: powerCards(4), command });
    const r = rushFromHand(mk([...releasedCat("DA", 1), inst("SPEC-DINO", "cmd")]), "player1", "SX-003:fj");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-003:fj")).toBe("rush");
    expect(canStartRush(mk([...releasedCat("DA", 2)]), "player1", "SX-003:fj")).toBe(false);
  });

  it("SX-003: ※ 自軍ターン中、敵軍バトルエリアのユニットの効果名を持たないテキスト（RK-074 ライダーマンの「敵軍Sユニットにアタックされない」）は無効になる（出典: atwiki/page-2017・カード評価「レジストやスクラム、各種MF・RFの能力…まで無力化する」）", () => {
    const enemy = { battle: [inst("RK-074", "rm"), inst("SPEC-KAMEN", "k")] };
    const without = enter(board({ rush: [inst("SPEC-E5000", "a")] }, enemy), "SPEC-E5000:a");
    expect(attackTargets(without, "SPEC-E5000:a")).not.toContain("RK-074:rm");
    const withFj = enter(board({ battle: [inst("SX-003", "fj")], rush: [inst("SPEC-E5000", "a")] }, enemy), "SPEC-E5000:a");
    expect(attackTargets(withFj, "SPEC-E5000:a")).toContain("RK-074:rm");
  });

  it("SX-003: ※ 自軍ターン中、敵軍バトルエリアのユニットの※レジストは無効になり、バトルで撃破されてもレジストできない（出典: atwiki/page-2017・Q1「敵軍バトルエリアのレジストは無効になっています」）", () => {
    let s = board({ battle: [inst("SX-003", "fj"), inst("SPEC-E9000", "a")] }, { battle: [inst("SK-002", "v3")] });
    s = attack(s, "SPEC-E9000:a", "SK-002:v3");
    for (let i = 0; i < 4 && !registerOfferedTo(s, "player2"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(registerOfferedTo(s, "player2")).toBe(false);
    expect(zoneOf(resolveAll(s), "player2", "SK-002:v3")).toBe("discard");
  });

  it("SX-003: ※ 効果名を持つテキスト（SR-001 ガオキング【天地轟鳴アニマルハート】）は無効にならない（出典: atwiki/page-2017「効果名を持たないテキストは」）", () => {
    const s = board({ battle: [inst("SX-003", "fj")] }, { battle: [inst("SR-001", "gk"), inst("RS-153", "m")] });
    expect(bpOf(s, "player2", "SR-001:gk")).toBe(16000);
  });

  it("SX-003: ※ 敵軍ターン中は無効にしない（敵軍ターンの敵軍 RK-074 ライダーマンの※は、自軍ユニットへの効き目に関係しないので、敵軍のレジストで確かめる）（出典: atwiki/page-2017「自軍ターン中、」）", () => {
    // 敵軍（player2）ターン、敵軍の V3（レジスト）が自軍の BP9000 にアタックして負ける。
    let s = enemyTurn({ battle: [inst("SX-003", "fj"), inst("SPEC-E9000", "d")] }, { battle: [inst("SK-002", "v3")] });
    s = attack(s, "SK-002:v3", "SPEC-E9000:d", "player2");
    for (let i = 0; i < 4 && !registerOfferedTo(s, "player2"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(registerOfferedTo(s, "player2")).toBe(true);
  });

  it("SX-003: 【アーム・ファング】アタックしてバトルするとき BP+3000（6000対5000で勝つ）（出典: atwiki/page-2017「これはバトルするとき、BP+3000される」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("SX-003", "fj")] }, { battle: [inst("SPEC-E5000", "e")] }), "SX-003:fj", "SPEC-E5000:e"));
    expect(lastBattleBps(s)?.attacker).toBe(6000);
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "SX-003:fj")).toBe("battle");
  });

  it("SX-003: 【アーム・ファング】アタックされてバトルするときも BP+3000（出典: atwiki/page-2017「バトルするとき」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("SX-003", "fj")] }, { battle: [inst("SPEC-E5000", "e")] }), "SPEC-E5000:e", "SX-003:fj", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(6000);
    expect(zoneOf(s, "player1", "SX-003:fj")).toBe("battle");
  });

  it("SX-003: 【アーム・ファング】バトルしていないときの BP は 3000 のまま（出典: atwiki/page-2017「バトルするとき」・カード評価「素のBP3000」）", () => {
    expect(bpOf(board({ battle: [inst("SX-003", "fj")] }), "player1", "SX-003:fj")).toBe(3000);
  });
});

// ===========================================================================
describe("SX-004 ハイパーゴーオンレッド", () => {
  const TEXT =
    "※これは特徴「車両」を持つビークルにライドできる。 【音速の赤き侍】「SP1」 敵軍バトルエリアから、ライドされている敵軍ビークルを1体選び、持ち主のパワーゾーンに送る。 （この効果は、ライドオフしたときナンバーに関係なく発動する）";

  it("SX-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-2157）", () => {
    expectCatalogText("SX-004", TEXT);
    expectUnitStats("SX-004", { name: "ハイパーゴーオンレッド", category: ["MA", "OT"], size: "S", bp: 4000, sp: "special", powerCost: "4+", comboNumber: 4, features: ["レッド", "男", "侍"], rushCondition: "state_gate" });
    expectRarityIn("SX-004", ["SC"]);
  });

  it("SX-004: 追加条件 — 特徴「侍」を持つ自軍ユニットがあればラッシュでき、なければラッシュできない（出典: atwiki/page-2157「特徴「侍」を持つ自軍ユニットがある」）", () => {
    const mk = (rush: CardInstance[]) => rushPhase({ hand: [inst("SX-004", "hr")], rush, power: powerCards(4), command: [...releasedCat("MA", 1), ...releasedCat("OT", 1)] });
    const r = rushFromHand(mk([inst("RS-674", "sk")]), "player1", "SX-004:hr");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-004:hr")).toBe("rush");
    expect(canStartRush(mk([inst("SPEC-PLAIN", "p")]), "player1", "SX-004:hr")).toBe(false);
  });

  it("SX-004: ※ 特徴「車両」を持つビークル（RK-030 トライチェイサー）にライドでき、「車両」を持たないビークルにはライドできない（出典: atwiki/page-2157「※これは特徴「車両」を持つビークルにライドできる」）", () => {
    const s = board({ rush: [inst("SX-004", "hr"), inst("RK-030", "tc"), inst("SPEC-VEHICLE", "v")] });
    expect(canMount(s, "SX-004:hr", "RK-030:tc")).toBe(true);
    expect(canMount(s, "SX-004:hr", "SPEC-VEHICLE:v")).toBe(false);
  });

  /** 敵軍バトルエリア: ライドされた S ビークル（v1）・ライドされた L ビークル（vl）・ライドされていない S ビークル（v2）。 */
  const enemy = (): Partial<GameState["players"]["player2"]> => ({
    battle: [
      inst("SPEC-VEHICLE", "v1"),
      { ...inst("SPEC-RIDER", "r1"), mountedOnInstanceId: "SPEC-VEHICLE:v1" },
      inst("SPEC-VEH-L", "vl"),
      { ...inst("SPEC-RIDER", "r2"), mountedOnInstanceId: "SPEC-VEH-L:vl" },
      inst("SPEC-VEHICLE", "v2"),
    ],
  });
  const rideOffed = () => settle(rcRideOff(board({ rush: [inst("SX-004", "hr"), inst("SPEC-CAR", "car")] }, enemy()), "SX-004:hr", "SPEC-CAR:car"));

  it("SX-004: 【音速の赤き侍】ライドオフしたとき（ナンバーに関係なく）、敵軍バトルエリアのライドされている敵軍ビークル（サイズを問わない）から1体選ぶ（出典: atwiki/page-2157「（この効果は、ライドオフしたときナンバーに関係なく発動する）」・カード評価「対象となるビークルのサイズは問わない」）", () => {
    const s = rideOffed();
    expectChoiceFrom(s, "player1", "SX-004");
    expect(choiceIds(s)).toEqual(["SPEC-VEH-L:vl", "SPEC-VEHICLE:v1"]);
  });

  it("SX-004: 【音速の赤き侍】選んだビークルは持ち主（敵軍）のパワーゾーンに送られ、これは「SP1」を得る（出典: atwiki/page-2157「持ち主のパワーゾーンに送る」「「SP1」」）", () => {
    const s = resolveAll(pick(rideOffed(), "SPEC-VEH-L:vl"));
    expect(zoneOf(s, "player2", "SPEC-VEH-L:vl")).toBe("power");
    expect(spOf(s, "player1", "SX-004:hr")).toBe(1);
  });

  it("SX-004: 【音速の赤き侍】ナンバーコンビネーション（4番目に出たとき）でも発動し「SP1」を得る（出典: atwiki/page-2157「CN：4」）", () => {
    let s = board({ rush: [inst("SX-004", "hr"), ...fill(3)] }, enemy());
    s = enterSeq(s, fill(3).map((c) => c.instanceId));
    s = enter(s, "SX-004:hr");
    expectChoiceFrom(s, "player1", "SX-004");
    s = resolveAll(pick(s, "SPEC-VEHICLE:v1"));
    expect(spOf(s, "player1", "SX-004:hr")).toBe(1);
  });

  it("SX-004: ライドせず2番目に出たとき（ナンバーが合わない）は発動せず、「SP！」のままストライクできない（出典: atwiki/page-2157「SP：！」「CN：4」）", () => {
    let s = board({ rush: [inst("SX-004", "hr"), ...fill(1)] }, enemy());
    s = enterSeq(s, ["TST-UNIT-0:f0"]);
    s = enter(s, "SX-004:hr");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("SX-004");
    expect(canStrike(s, "SX-004:hr")).toBe(false);
  });
});

// ===========================================================================
describe("SX-005 仮面ライダーW・CJX", () => {
  const TEXT =
    "【ビッカーファイナリュージョン】このユニットは自軍コマンドゾーンにあるカードのカテゴリごとに次の能力を得る⇒WBがあればレジストを得る。MAがあれば、これが敵軍ユニットをバトルで撃破したとき、撃破したユニットを捨札にするかわりに持ち主のパワーゾーンにダメージにして置いてもよい。ETがあればBP+3000される。DAがあれば「SP1」になる。";

  it("SX-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-2267）", () => {
    expectCatalogText("SX-005", TEXT);
    expectUnitStats("SX-005", { name: "仮面ライダーW・CJX", category: ["ET", "DA"], size: "S", bp: 4000, sp: "special", powerCost: "5+", features: ["仮面ライダー", "男", "ダブルドライバー"], rushCondition: "discard_feature_unit" });
    expectRarityIn("SX-005", ["SC"]);
  });

  it("SX-005: 追加条件 — 特徴「ダブルドライバー」を持つ自軍ユニット（XG2-043 W・CJ）1体をコマンドゾーンに送ってラッシュできる（出典: atwiki/page-2267「コマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("SX-005", "x")], rush: [inst("XG2-043", "cj")], power: powerCards(5), command: [...releasedCat("ET", 1), ...releasedCat("DA", 1)] }), "player1", "SX-005:x", { destination: "command" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-005:x")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG2-043:cj")).toBe("command");
  });

  const field = (command: CardInstance[]) => board({ battle: [inst("SX-005", "x")], command });

  it("SX-005: 自軍コマンドゾーンに ET（WB・MA・DA なし）だけなら BP+3000（7000）で、SP はない（出典: atwiki/page-2267「ETがあればBP+3000される」「SP：！」）", () => {
    const s = field(releasedCat("ET", 1));
    expect(bpOf(s, "player1", "SX-005:x")).toBe(7000);
    expect(spOf(s, "player1", "SX-005:x")).toBe(0);
  });

  it("SX-005: ET がなければ BP は 4000 のまま（OT だけ）（出典: atwiki/page-2267）", () => {
    expect(bpOf(field(releasedCat("OT", 1)), "player1", "SX-005:x")).toBe(4000);
  });

  it("SX-005: 自軍コマンドゾーンに DA があれば「SP1」になる（出典: atwiki/page-2267「DAがあれば「SP1」になる」）", () => {
    expect(spOf(field(releasedCat("DA", 1)), "player1", "SX-005:x")).toBe(1);
  });

  it("SX-005: 自軍コマンドゾーンに WB があればレジストを得る（バトルで撃破されたときホールドして留められる）（出典: atwiki/page-2267「WBがあればレジストを得る」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("SX-005", "x")], command: releasedCat("WB", 1) }, "SX-005:x"))).toBe(true);
    expect(registerOffered(attackUntilRegister({ battle: [inst("SX-005", "x")], command: releasedCat("OT", 1) }, "SX-005:x"))).toBe(false);
  });

  it("SX-005: 自軍コマンドゾーンに MA があれば、敵軍ユニットをバトルで撃破したとき、捨札にするかわりに持ち主のパワーゾーンにダメージとして置ける（任意）（出典: atwiki/page-2267「MAがあれば、…持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    let s = attack(board({ battle: [inst("SX-005", "x")], command: [...releasedCat("MA", 1), ...releasedCat("ET", 1)] }, { battle: [inst("SPEC-E5000", "e")] }), "SX-005:x", "SPEC-E5000:e");
    s = settle(s);
    expectChoiceFrom(s, "player1", "SX-005");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s, ["SPEC-E5000:e"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E5000:e")?.faceDown).toBe(true);
  });

  it("SX-005: マルチカテゴリのコマンド1枚（ET と DA を持つ XG2-043）で ET と DA の両方の能力を得る（出典: atwiki/page-2267「自軍コマンドゾーンにあるカードのカテゴリごとに」）", () => {
    const s = field([inst("XG2-043", "cmd")]);
    expect(bpOf(s, "player1", "SX-005:x")).toBe(7000);
    expect(spOf(s, "player1", "SX-005:x")).toBe(1);
  });
});
