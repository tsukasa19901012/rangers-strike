/**
 * カード別スペック: RS-516〜RS-526（第8弾「究極の八神」オペレーション）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-516〜RS-526 は該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-523・RS-524 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）。
 *     RS-519 Q1・RS-521 Q1 は atwiki の転載のみ（公式ページの取得分に該当 Q なし）。
 *  3. docs/rules/*.md の一般ルール（R-KW-CALL-01、R-KW-TAG-01、R-KW-SCRUM-01、02-zones-cards のコマンドゾーン上限 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  activateResident,
  attackTargets,
  bpOf,
  canActivateResident,
  canSkip,
  canStartRush,
  canUseCard,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  enterBattleByEffect,
  enterSeq,
  expectCatalogText,
  expectOpStats,
  fill,
  held,
  inst,
  legal,
  nextPhase,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
  canStrike,
} from "./RS8-516-537.helpers";
import type { GameState } from "../types/game";

/** 自軍ラッシュフェイズに手札のオペレーションを使う。 */
function useOpInRush(
  p1: Partial<GameState["players"]["player1"]>,
  op: string,
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: Parameters<typeof st>[1] = [],
  target?: string,
) {
  const s = st({ phase: "rush", turn: 3, player1: { deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, extra);
  return playOp(s, "player1", op, target);
}

// ===========================================================================
describe("RS-516 アースフォース", () => {
  const TEXT =
    "※常駐 MAを持つSPが空欄のSユニットは、次の能力を得る⇒コールET（このユニットはETのユニットをラッシュするためのコマンドとしてホールドできる）";
  const ET_S = sUnit("SPEC-ET-S", { category: "ET", powerCost: 0 });
  const MA_SP1 = sUnit("SPEC-MA-SP1", { category: "MA", sp: 1 });
  const MA_M = sUnit("SPEC-MA-M", { category: "MA", sp: undefined, size: "M" });
  const WB_BLANK = sUnit("SPEC-WB-BLANK", { category: "WB", sp: undefined });
  const MERMAID = "RS-537"; // チェンジマーメイド（MA・S・SP「－」）

  /** 自軍ラッシュフェイズ: ET の S ユニットを手札に、caller を自軍ラッシュエリアに置く（コマンドは WB 1つだけ）。 */
  const rushState = (caller: string, ops: { p1?: boolean; p2?: boolean } = { p1: true }, callerOwner: "player1" | "player2" = "player1") =>
    st(
      {
        phase: "rush",
        turn: 3,
        player1: {
          hand: [inst("SPEC-ET-S", "e")],
          command: releasedCat("WB", 1),
          operation: ops.p1 ? [inst("RS-516", "ef")] : [],
          rush: callerOwner === "player1" ? [inst(caller, "c")] : [],
          deck: deckCards(3),
        },
        player2: {
          operation: ops.p2 ? [inst("RS-516", "ef2")] : [],
          rush: callerOwner === "player2" ? [inst(caller, "c")] : [],
          deck: deckCards(3, "e"),
        },
      },
      [ET_S, MA_SP1, MA_M, WB_BLANK],
    );

  it("RS-516: カタログ本文・スペックが出典と一致（出典: atwiki/page-1149）", () => {
    expectCatalogText("RS-516", TEXT);
    expectOpStats("RS-516", { name: "アースフォース", category: "MA", powerCost: 3 });
  });

  it("RS-516: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（出典: atwiki/page-1149「※常駐」）", () => {
    const r = useOpInRush({ hand: [inst("RS-516", "ef")], command: releasedCat("MA", 1), power: powerCards(3) }, "RS-516:ef");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-516:ef")).toBe("operation");
  });

  it("RS-516: 必要パワー3 — パワー2枚では使えない（出典: atwiki/page-1149「必要パワー：3」）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-516", "ef")], command: releasedCat("MA", 1), power: powerCards(2) } });
    expect(canUseCard(s, "player1", "RS-516:ef")).toBe(false);
  });

  it("RS-516: 対照 — アースフォースがなければ、ET のコマンドがないので ET の S ユニットはラッシュできない（出典: R-KW-CALL-01）", () => {
    expect(canStartRush(rushState(MERMAID, {}), "player1", "SPEC-ET-S:e")).toBe(false);
  });

  it("RS-516: MA を持つ SP 空欄の S ユニット（チェンジマーメイド）がコールET を得て、それをホールドして ET の S ユニットをラッシュできる（出典: atwiki/page-1149「MAを持つSPが空欄のSユニットは、次の能力を得る⇒コールET」・R-KW-CALL-01）", () => {
    const s = rushState(MERMAID);
    expect(canStartRush(s, "player1", "SPEC-ET-S:e")).toBe(true);
    const r = rushFromHand(s, "player1", "SPEC-ET-S:e");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-ET-S:e")).toBe("rush");
    expect(cardIn(r.state, "player1", `${MERMAID}:c`)?.commandHeld).toBe(true);
  });

  it("RS-516: SP が空欄でない（SP1）MA の S ユニットはコールET を得ない（出典: atwiki/page-1149「SPが空欄の」）", () => {
    expect(canStartRush(rushState("SPEC-MA-SP1"), "player1", "SPEC-ET-S:e")).toBe(false);
  });

  it("RS-516: SP 空欄でも M ユニットはコールET を得ない（出典: atwiki/page-1149「Sユニット」）", () => {
    expect(canStartRush(rushState("SPEC-MA-M"), "player1", "SPEC-ET-S:e")).toBe(false);
  });

  it("RS-516: SP 空欄の S ユニットでも MA を持たなければコールET を得ない（出典: atwiki/page-1149「MAを持つ」）", () => {
    expect(canStartRush(rushState("SPEC-WB-BLANK"), "player1", "SPEC-ET-S:e")).toBe(false);
  });

  it("RS-516: 「自軍」の指定がない — 敵軍のアースフォースでも自軍のチェンジマーメイドはコールET を得る（出典: atwiki/page-1149 本文・コメント「敵軍にも適用されます」）", () => {
    expect(canStartRush(rushState(MERMAID, { p2: true }), "player1", "SPEC-ET-S:e")).toBe(true);
  });

  it("RS-516: 敵軍のチェンジマーメイドをホールドして自軍の ET ユニットをラッシュすることはできない（出典: atwiki/page-1149 コメント「後者については不可能です」・R-KW-CALL-01「このユニットは」）", () => {
    expect(canStartRush(rushState(MERMAID, { p1: true }, "player2"), "player1", "SPEC-ET-S:e")).toBe(false);
  });
});

// ===========================================================================
describe("RS-517 バードニック反応炉", () => {
  const TEXT =
    "※常駐 自軍コマンドゾーンにスクラムを持つユニットカードがあれば、そのカードと同じＣＮを持つBP2000以下の自軍Sユニットは次の能力を得る⇒これはアタックされない。";
  const CN1_2000 = sUnit("SPEC-CN1-2000", { comboNumber: 1, bp: 2000, sp: undefined });
  const CN1_2500 = sUnit("SPEC-CN1-2500", { comboNumber: 1, bp: 2500, sp: undefined });
  const CN2_1000 = sUnit("SPEC-CN2-1000", { comboNumber: 2, bp: 1000, sp: undefined });
  const CN1_M = sUnit("SPEC-CN1-M", { comboNumber: 1, bp: 1000, size: "M", sp: undefined });
  const EXTRA = [CN1_2000, CN1_2500, CN2_1000, CN1_M];

  /** 敵軍（player2）のバトルフェイズ。player1 のバトルエリアに target。 */
  const enemyTurn = (target: string, p1: Partial<GameState["players"]["player1"]> = {}) =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: [inst(target, "t")], operation: [inst("RS-517", "br")], command: [released("RS-533", "scrum")], deck: deckCards(3), ...p1 },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
  const targetable = (s: GameState, id: string) => attackTargets(s, "TST-UNIT-7:atk", "player2").includes(id);

  it("RS-517: カタログ本文・スペックが出典と一致（出典: atwiki/page-1234）", () => {
    expectCatalogText("RS-517", TEXT);
    expectOpStats("RS-517", { name: "バードニック反応炉", category: "ET", powerCost: 1 });
  });

  it("RS-517: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（出典: atwiki/page-1234「※常駐」）", () => {
    const r = useOpInRush({ hand: [inst("RS-517", "br")], command: releasedCat("ET", 1), power: powerCards(1) }, "RS-517:br");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-517:br")).toBe("operation");
  });

  it("RS-517: 対照 — 反応炉がなければ CN1・BP2000 の自軍 S ユニットはアタックされうる（出典: atwiki/page-1234）", () => {
    const s = enemyTurn("SPEC-CN1-2000", { operation: [] });
    expect(targetable(s, "SPEC-CN1-2000:t")).toBe(true);
  });

  it("RS-517: 自軍コマンドゾーンにスクラムを持つチェンジフェニックス（CN1）があれば、CN1・BP2000 の自軍 S ユニットはアタックされない（BP2000 ちょうども対象）（出典: atwiki/page-1234「そのカードと同じＣＮを持つBP2000以下の自軍Sユニットは…これはアタックされない」）", () => {
    expect(targetable(enemyTurn("SPEC-CN1-2000"), "SPEC-CN1-2000:t")).toBe(false);
  });

  it("RS-517: BP2500（BP2000 を超える）のユニットはアタックされうる（出典: atwiki/page-1234「BP2000以下」）", () => {
    expect(targetable(enemyTurn("SPEC-CN1-2500"), "SPEC-CN1-2500:t")).toBe(true);
  });

  it("RS-517: CN が異なる（CN2）ユニットはアタックされうる（出典: atwiki/page-1234「そのカードと同じＣＮを持つ」）", () => {
    expect(targetable(enemyTurn("SPEC-CN2-1000"), "SPEC-CN2-1000:t")).toBe(true);
  });

  it("RS-517: M ユニットはアタックされうる（出典: atwiki/page-1234「自軍Sユニット」）", () => {
    expect(targetable(enemyTurn("SPEC-CN1-M"), "SPEC-CN1-M:t")).toBe(true);
  });

  it("RS-517: 自軍コマンドゾーンにスクラムを持つユニットカードがなければ（スクラムなしの CN1 カードのみ）アタックされうる（出典: atwiki/page-1234「スクラムを持つユニットカードがあれば」）", () => {
    const s = enemyTurn("SPEC-CN1-2000", { command: [released("SPEC-CN1-2500", "noscrum")] });
    expect(targetable(s, "SPEC-CN1-2000:t")).toBe(true);
  });

  it("RS-517: 敵軍の S ユニットは対象外 — 自軍の反応炉があっても、自軍ターンに敵軍の CN1・BP2000 ユニットにアタックできる（出典: atwiki/page-1234「自軍Sユニット」）", () => {
    const s = st(
      {
        player1: { battle: [inst("TST-UNIT-7", "a1")], operation: [inst("RS-517", "br")], command: [released("RS-533", "scrum")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-CN1-2000", "et")], command: [released("RS-533", "escrum")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    expect(attackTargets(s, "TST-UNIT-7:a1")).toContain("SPEC-CN1-2000:et");
  });
});

// ===========================================================================
describe("RS-518 獣撃棒", () => {
  const TEXT = "敵軍Sユニットを1体選ぶ。選んだユニットがホールド状態なら撃破し、リリース状態ならホールドする。";

  const p2 = (): Partial<GameState["players"]["player2"]> => ({
    rush: [inst("TST-UNIT-0", "er"), held("TST-UNIT-0", "eh"), inst("TST-UNIT-2", "em")],
    battle: [inst("TST-UNIT-0", "eb")],
    command: [released("TST-UNIT-0", "ec")],
  });
  const use = () =>
    useOpInRush({ hand: [inst("RS-518", "o")], command: releasedCat("WB", 1), power: powerCards(3), rush: [inst("TST-UNIT-0", "own")] }, "RS-518:o", p2());

  it("RS-518: カタログ本文・スペックが出典と一致（出典: atwiki/page-1147）", () => {
    expectCatalogText("RS-518", TEXT);
    expectOpStats("RS-518", { name: "獣撃棒", category: "WB", powerCost: 3 });
  });

  it("RS-518: 使用者が敵軍 S ユニット（ラッシュエリア・バトルエリア、ホールド／リリース問わず）から1体選ぶ。M ユニット・コマンドゾーンのカード・自軍ユニットは選べない（出典: atwiki/page-1147「敵軍Sユニットを1体選ぶ」）", () => {
    const r = use();
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(r.state)).toEqual(["TST-UNIT-0:eb", "TST-UNIT-0:eh", "TST-UNIT-0:er"]);
  });

  it("RS-518: 選んだユニットがリリース状態ならホールドする（その場に留まる）（出典: atwiki/page-1147「リリース状態ならホールドする」）", () => {
    const s = resolveAll(pick(use().state, "TST-UNIT-0:er"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("rush");
    expect(cardIn(s, "player2", "TST-UNIT-0:er")?.commandHeld).toBe(true);
  });

  it("RS-518: 選んだユニットがホールド状態なら撃破する（捨札になる）（出典: atwiki/page-1147「ホールド状態なら撃破し」）", () => {
    const s = resolveAll(pick(use().state, "TST-UNIT-0:eh"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eh")).toBe("discard");
  });

  it("RS-518: 敵軍コマンドゾーンの S ユニットカードは「ユニット」ではないのでホールド・撃破されない（出典: atwiki/page-1147「敵軍Sユニット」・R-ADD-03）", () => {
    let s = use().state;
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:ec")) s = pick(s, "TST-UNIT-0:ec");
    s = resolveAll(s, ["TST-UNIT-0:eb"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:ec")).toBe("command");
    expect(cardIn(s, "player2", "TST-UNIT-0:ec")?.commandHeld).not.toBe(true);
  });
});

// ===========================================================================
describe("RS-519 インフェルシアの花嫁", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズ中に1度だけ、『特徴「男」を持つ自軍Sユニットと特徴「女」を持つ自軍Sユニットをそれぞれ1体ずつ選び捨札にする』を実行してもよい。そうしたとき、自軍山札を見て、特徴「戦闘員」を持つユニットカードを3枚まで選び、自軍ラッシュエリアに出す。その後、山札をシャッフルする。";
  const MALE = sUnit("SPEC-MALE", { features: ["男"] });
  const FEMALE = sUnit("SPEC-FEMALE", { features: ["女"] });
  const GRUNT = sUnit("SPEC-GRUNT", { category: "DA", features: ["戦闘員"] });
  const EXTRA = [MALE, FEMALE, GRUNT];

  const rushPhase = (rush = [inst("SPEC-MALE", "m"), inst("SPEC-FEMALE", "f")], phase: GameState["phase"] = "rush") =>
    st(
      {
        phase,
        turn: 3,
        player1: {
          operation: [inst("RS-519", "hb")],
          rush,
          deck: [inst("SPEC-GRUNT", "g0"), inst("TST-OP", "x0"), inst("SPEC-GRUNT", "g1"), inst("SPEC-GRUNT", "g2"), inst("SPEC-GRUNT", "g3")],
        },
        player2: { deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("RS-519: カタログ本文・スペックが出典と一致（出典: atwiki/page-1155）", () => {
    expectCatalogText("RS-519", TEXT);
    expectOpStats("RS-519", { name: "インフェルシアの花嫁", category: "DA", powerCost: 4 });
  });

  it("RS-519: ※常駐 ※タッグ — 他の自軍常駐（恐竜やのカレー）が配置されていても、合わせて2枚目として配置できる（出典: atwiki/page-1155「他の自軍常駐と合わせて2枚まで配置でき」・R-KW-TAG-01）", () => {
    const r = useOpInRush(
      { hand: [inst("RS-519", "hb")], operation: [inst("RS-179", "curry")], command: releasedCat("DA", 1), power: powerCards(4) },
      "RS-519:hb",
    );
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-519:hb")).toBe("operation");
    expect(zoneOf(r.state, "player1", "RS-179:curry")).toBe("operation");
  });

  it("RS-519: 自軍ラッシュフェイズに『男・女の自軍 S ユニットを1体ずつ捨札』を実行すると、山札の「戦闘員」のユニットカードを3枚まで自軍ラッシュエリアに出す（出典: atwiki/page-1155）", () => {
    let s = rushPhase();
    expect(canActivateResident(s, "player1", "RS-519:hb")).toBe(true);
    s = resolveAll(activateResident(s, "player1", "RS-519:hb"), ["SPEC-MALE:m", "SPEC-FEMALE:f", "SPEC-GRUNT:g0", "SPEC-GRUNT:g1", "SPEC-GRUNT:g2"]);
    expect(zoneOf(s, "player1", "SPEC-MALE:m")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-FEMALE:f")).toBe("discard");
    const grunts = s.players.player1.rush.filter((c) => c.cardId === "SPEC-GRUNT");
    expect(grunts).toHaveLength(3);
    expect(zoneOf(s, "player1", "TST-OP:x0")).toBe("deck");
  });

  it("RS-519: 「1度だけ」— 同じラッシュフェイズ中に2度目は実行できない（出典: atwiki/page-1155「自軍ラッシュフェイズ中に1度だけ」・R-KW-TAG-01）", () => {
    let s = rushPhase([inst("SPEC-MALE", "m"), inst("SPEC-FEMALE", "f"), inst("SPEC-MALE", "m2"), inst("SPEC-FEMALE", "f2")]);
    s = resolveAll(activateResident(s, "player1", "RS-519:hb"), ["SPEC-MALE:m", "SPEC-FEMALE:f"]);
    expect(canActivateResident(s, "player1", "RS-519:hb")).toBe(false);
  });

  it("RS-519: 特徴「女」の自軍 S ユニットがいなければ太字部分を実行できない（出典: atwiki/page-1155「それぞれ1体ずつ選び捨札にする」）", () => {
    expect(canActivateResident(rushPhase([inst("SPEC-MALE", "m"), inst("SPEC-MALE", "m2")]), "player1", "RS-519:hb")).toBe(false);
  });

  it("RS-519: 「自軍ラッシュフェイズ中」— バトルフェイズには実行できない（出典: atwiki/page-1155）", () => {
    expect(canActivateResident(rushPhase(undefined, "battle"), "player1", "RS-519:hb")).toBe(false);
  });

  it("RS-519: 「実行してもよい」— 実行しなければ何も起きない（出典: atwiki/page-1155「実行してもよい」）", () => {
    const s = settle(nextPhase(rushPhase()));
    expect(zoneOf(s, "player1", "SPEC-MALE:m")).not.toBe("discard");
    expect(s.players.player1.rush.filter((c) => c.cardId === "SPEC-GRUNT")).toHaveLength(0);
  });

  it.todo(
    "RS-519: 呉越同舟等と太字部分を読み替えて仮面ライダーキバ（XG5-074）をホールドした場合、出した戦闘員は【ファンガイアの王】の対象にならない（出典: atwiki/page-1155 Q1）— タッグの太字部分の入れ替えがエンジンに無く（R-KW-TAG-01 / rulesSpec 07 todo）、RK-239 との組み合わせを公開 API で組み立てられない",
  );
});

// ===========================================================================
describe("RS-520 スコープショット", () => {
  const TEXT = "自軍山札から1枚ひいて、そのカードを自軍コマンドゾーンに置く。置けなければ手札に加える。";

  it("RS-520: カタログ本文・スペックが出典と一致（出典: atwiki/page-1148）", () => {
    expectCatalogText("RS-520", TEXT);
    expectOpStats("RS-520", { name: "スコープショット", category: "ET", powerCost: 0 });
  });

  it("RS-520: 山札の上のカードを自軍コマンドゾーンにリリース状態で置く（手札には加えない）（出典: atwiki/page-1148「自軍山札から1枚ひいて、そのカードを自軍コマンドゾーンに置く」・R-ADD-04 と同じくリリース状態）", () => {
    const r = useOpInRush({ hand: [inst("RS-520", "o")], command: releasedCat("ET", 1), deck: [inst("TST-UNIT-0", "top"), ...deckCards(3)] }, "RS-520:o");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("command");
    expect(cardIn(s, "player1", "TST-UNIT-0:top")?.commandHeld).not.toBe(true);
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.command).toHaveLength(2);
  });

  it("RS-520: コマンドゾーンが5枚で置けなければ、ひいたカードを手札に加える（出典: atwiki/page-1148「置けなければ手札に加える」・02-zones-cards「置けるのは5枚まで」）", () => {
    const r = useOpInRush({ hand: [inst("RS-520", "o")], command: releasedCat("ET", 5), deck: [inst("TST-UNIT-0", "top"), ...deckCards(3)] }, "RS-520:o");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("hand");
    expect(s.players.player1.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("RS-521 スーパー戦隊魂", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍バトルフェイズ中、特徴「レッド」を持つ自軍ユニットがバトルエリアに出たとき、『特徴｢レッド｣を持つ自軍ユニットを1体選びホールドする』を実行してもよい。そうしたとき、バトルエリアに出たユニットのナンバーの数字を見て、その数字以下のナンバーの数字を持つSユニットを自分の手札から1枚選び、自軍ラッシュエリアに出してもよい。";
  const RED3 = "RS-535"; // チェンジドラゴン（レッド・CN3）
  const CN3 = sUnit("SPEC-CN3", { comboNumber: 3, powerCost: 6 });
  const CN4 = sUnit("SPEC-CN4", { comboNumber: 4 });
  const NOCN = sUnit("SPEC-NOCN", {});
  const CN2M = sUnit("SPEC-CN2-M", { comboNumber: 2, size: "M" });
  const BLUE = sUnit("SPEC-BLUE2", { comboNumber: 2, features: ["ブルー"] });
  const EXTRA = [CN3, CN4, NOCN, CN2M, BLUE];

  const battle = (rush: string[] = [RED3], activePlayer: "player1" | "player2" = "player1") =>
    st(
      {
        activePlayer,
        player1: {
          operation: [inst("RS-521", "tm")],
          rush: rush.map((id, i) => inst(id, `r${i}`)),
          hand: [inst("SPEC-CN3", "h3"), inst("SPEC-CN4", "h4"), inst("SPEC-NOCN", "hn"), inst("SPEC-CN2-M", "hm")],
          deck: deckCards(3),
        },
        player2: { deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("RS-521: カタログ本文・スペックが出典と一致（出典: atwiki/page-1154）", () => {
    expectCatalogText("RS-521", TEXT);
    expectOpStats("RS-521", { name: "スーパー戦隊魂", category: "MA", powerCost: 4 });
  });

  it("RS-521: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（出典: atwiki/page-1154「※常駐」）", () => {
    const r = useOpInRush({ hand: [inst("RS-521", "tm")], command: releasedCat("MA", 1), power: powerCards(4) }, "RS-521:tm");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-521:tm")).toBe("operation");
  });

  it("RS-521: 自軍バトルフェイズにレッド（CN3）が出たとき、レッドを1体ホールドすれば、手札の CN3 以下の S ユニットを自軍ラッシュエリアに出せる（出典: atwiki/page-1154）", () => {
    let s = enter(battle(), `${RED3}:r0`);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-521");
    expect(choiceIds(s)).toEqual([`${RED3}:r0`]);
    s = pick(s, `${RED3}:r0`);
    expect(cardIn(s, "player1", `${RED3}:r0`)?.commandHeld).toBe(true);
    // ナンバー3以下の S ユニット（CN3）だけ。CN4・ナンバーなし・M ユニットは選べない。
    expect(choiceIds(s)).toEqual(["SPEC-CN3:h3"]);
    s = resolveAll(pick(s, "SPEC-CN3:h3"));
    expect(zoneOf(s, "player1", "SPEC-CN3:h3")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-CN4:h4")).toBe("hand");
  });

  it("RS-521: 「実行してもよい」— 太字部分は見送れる（出典: atwiki/page-1154「実行してもよい」）", () => {
    const s = enter(battle(), `${RED3}:r0`);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-521");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-521: レッドでないユニットが出ても何も起きない（出典: atwiki/page-1154「特徴「レッド」を持つ自軍ユニットがバトルエリアに出たとき」）", () => {
    const s = enter(battle(["SPEC-BLUE2"]), "SPEC-BLUE2:r0");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-521");
    expect(resolveAll(s).players.player1.hand).toHaveLength(4);
  });

  it("RS-521: 「自軍バトルフェイズ中」— 敵軍ターン中にレッドがバトルエリアに出ても何も起きない（出典: atwiki/page-1154）", () => {
    const s = enterBattleByEffect(battle([RED3], "player2"), "player1", `${RED3}:r0`);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-521");
    expect(resolveAll(s).players.player1.hand).toHaveLength(4);
  });

  it.todo(
    "RS-521: バトルエリアに出たユニットのナンバーは、並び順確定前（コマンドアタッカーによるナンバー減少の前）の数字で見る（出典: atwiki/page-1154 Q1「5以下のユニットです」）— 本効果そのものが未実装（上の it.fails）で、RS-393 のライドとナンバー減少を組み合わせた検証ができない",
  );
});

// ===========================================================================
describe("RS-522 ボウケンスピリッツ", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズ中に1度だけ、『自軍コマンドを1つ選び山札の上に戻す』を実行してもよい。そうしたとき、ナンバーに数字を持つ自軍Sユニットを1体選ぶ。このターン、選んだユニットのナンバーの数字は1増える。";
  const GAO = "RS-163"; // ガオブラック（CN4。NC【アイアンブロークン】自軍ターン中 BP+3000）

  const rushPhase = () =>
    st({
      phase: "rush",
      turn: 3,
      player1: {
        operation: [inst("RS-522", "bs")],
        command: [released("TST-OP-ET", "cmd")],
        rush: [inst(GAO, "g"), ...fill(4)],
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });

  it("RS-522: カタログ本文・スペックが出典と一致（出典: atwiki/page-1152）", () => {
    expectCatalogText("RS-522", TEXT);
    expectOpStats("RS-522", { name: "ボウケンスピリッツ", category: "ET", powerCost: 6 });
  });

  it("RS-522: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（必要パワー6）（出典: atwiki/page-1152）", () => {
    const r = useOpInRush({ hand: [inst("RS-522", "bs")], command: releasedCat("ET", 1), power: powerCards(6) }, "RS-522:bs");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-522:bs")).toBe("operation");
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-522", "bs")], command: releasedCat("ET", 1), power: powerCards(5) } });
    expect(canUseCard(s, "player1", "RS-522:bs")).toBe(false);
  });

  it("RS-522: 自軍コマンドを1つ山札の上に戻すと、選んだ自軍 S ユニット（ガオブラック CN4）のナンバーがこのターン5になり、5番目で NC が成立する（出典: atwiki/page-1152「このターン、選んだユニットのナンバーの数字は1増える」）", () => {
    let s = rushPhase();
    expect(canActivateResident(s, "player1", "RS-522:bs")).toBe(true);
    s = resolveAll(activateResident(s, "player1", "RS-522:bs"), ["TST-OP-ET:cmd", `${GAO}:g`]);
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP-ET:cmd");
    s = nextPhase(s);
    s = enterSeq(s, ["TST-UNIT-0:f0", "TST-UNIT-0:f1", "TST-UNIT-0:f2", "TST-UNIT-0:f3", `${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(6000);
  });

  it("RS-522: 対照 — 実行しなければガオブラックは CN4 のままで、5番目では NC が成立しない（出典: atwiki/page-1152「実行してもよい」・R-CN-02）", () => {
    let s = nextPhase(rushPhase());
    s = enterSeq(s, ["TST-UNIT-0:f0", "TST-UNIT-0:f1", "TST-UNIT-0:f2", "TST-UNIT-0:f3", `${GAO}:g`]);
    expect(bpOf(s, "player1", `${GAO}:g`)).toBe(3000);
    expect(zoneOf(s, "player1", "TST-OP-ET:cmd")).toBe("command");
  });

  it("RS-522: 自軍コマンドがなければ太字部分を実行できない（出典: atwiki/page-1152『自軍コマンドを1つ選び山札の上に戻す』）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { operation: [inst("RS-522", "bs")], rush: [inst(GAO, "g")], deck: deckCards(3) } });
    expect(canActivateResident(s, "player1", "RS-522:bs")).toBe(false);
  });
});

// ===========================================================================
describe("RS-523 臨気", () => {
  const TEXT =
    "本来のSPが1以上のDAを持つ自軍ユニットを1体選ぶ。このターンのバトルフェイズ中、選んだユニットは次の能力を得る⇒バトルエリアに出たとき、相手に1点ダメージを与える。ただし、ストライクすることはできない。";
  const DA1 = sUnit("SPEC-DA-SP1", { category: "DA", sp: 1, bp: 1000 });
  const DA_BLANK = sUnit("SPEC-DA-BLANK", { category: "DA", sp: undefined });
  const WB1 = sUnit("SPEC-WB-SP1", { category: "WB", sp: 1 });
  const DA_M2 = sUnit("SPEC-DA-M2", { category: "DA", sp: 2, size: "M" });
  const EXTRA = [DA1, DA_BLANK, WB1, DA_M2];

  const use = (target: string | null = "SPEC-DA-SP1:u") =>
    useOpInRush(
      {
        hand: [inst("RS-523", "rk")],
        command: releasedCat("DA", 1),
        power: powerCards(4),
        rush: [inst("SPEC-DA-SP1", "u"), inst("SPEC-DA-BLANK", "b"), inst("SPEC-WB-SP1", "w"), inst("SPEC-DA-M2", "m")],
      },
      "RS-523:rk",
      {},
      EXTRA,
      target ?? undefined,
    );

  it("RS-523: カタログ本文・スペックが出典と一致（出典: atwiki/page-1150）", () => {
    expectCatalogText("RS-523", TEXT);
    expectOpStats("RS-523", { name: "臨気", category: "DA", powerCost: 4 });
  });

  it("RS-523: 使っただけでは相手にダメージを与えない（ダメージはバトルエリアに出たとき）（出典: atwiki/page-1150「このターンのバトルフェイズ中、選んだユニットは次の能力を得る⇒バトルエリアに出たとき」）", () => {
    const r = use();
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state, ["SPEC-DA-SP1:u"]);
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-523: 選べるのは本来の SP が1以上の DA の自軍ユニット（サイズ不問）。SP 空欄の DA・SP1 の WB は選べない（出典: atwiki/page-1150「本来のSPが1以上のDAを持つ自軍ユニット」）", () => {
    const r = use(null);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-523");
    expect(choiceIds(r.state)).toEqual(["SPEC-DA-M2:m", "SPEC-DA-SP1:u"]);
  });

  it("RS-523: このターンのバトルフェイズに選んだユニットがバトルエリアに出たとき、相手に1点ダメージを与える（出典: atwiki/page-1150）", () => {
    let s = resolveAll(use().state, ["SPEC-DA-SP1:u"]);
    const before = s.players.player2.damage;
    s = nextPhase(s);
    expect(s.phase).toBe("battle");
    s = resolveAll(enter(s, "SPEC-DA-SP1:u"));
    expect(s.players.player2.damage).toBe(before + 1);
  });

  it("RS-523: 選んだユニットはこのターンのバトルフェイズ中ストライクできない（出典: atwiki/page-1150「ただし、ストライクすることはできない」）", () => {
    let s = resolveAll(use().state, ["SPEC-DA-SP1:u"]);
    s = resolveAll(enter(nextPhase(s), "SPEC-DA-SP1:u"));
    expect(zoneOf(s, "player1", "SPEC-DA-SP1:u")).toBe("battle");
    expect(canStrike(s, "SPEC-DA-SP1:u")).toBe(false);
  });

  it("RS-523: 選ばれていないユニットはストライクできる（制限は選んだユニットだけ）（出典: atwiki/page-1150「選んだユニットは」）", () => {
    let s = resolveAll(use().state, ["SPEC-DA-SP1:u"]);
    s = settle(nextPhase(s));
    s = resolveAll(enter(s, "SPEC-WB-SP1:w"));
    expect(canStrike(s, "SPEC-WB-SP1:w")).toBe(true);
  });

  it.todo(
    "RS-523: 「本来の」はSPだけにかかり、効果で DA が追加された（本来は DA でない）ユニットも選べる（出典: grnrngr/faq-card-8 RS-523 Q「「本来の」が指すのは「SP」だけです」）— 対象選択自体が未実装（上の it.fails）で、カテゴリ追加（呉越同舟等）も未実装のため組み立てられない",
  );
});

// ===========================================================================
describe("RS-524 呉越同舟", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍バトルフェイズ中に1度だけ、『自分の手札を1枚選び相手に見せる』を実行してもよい。そうしたとき、自軍ユニットを1体選び、カテゴリを1つ宣言する。このターン、宣言したカテゴリを選んだユニットに追加する。";

  const field = (phase: GameState["phase"], hand = [inst("TST-OP", "h")]) =>
    st({ phase, turn: 3, player1: { operation: [inst("RS-524", "gd")], hand, rush: [inst("TST-UNIT-0", "u")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
  const anyActivation = (s: GameState) => legal(s).some((a) => a.type === "activate_resident_operation" && a.playerId === "player1");

  it("RS-524: カタログ本文・スペックが出典と一致（出典: atwiki/page-1151）", () => {
    expectCatalogText("RS-524", TEXT);
    expectOpStats("RS-524", { name: "呉越同舟", category: "WB", powerCost: 3 });
  });

  it("RS-524: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（出典: atwiki/page-1151「※常駐」）", () => {
    const r = useOpInRush({ hand: [inst("RS-524", "gd")], command: releasedCat("WB", 1), power: powerCards(3) }, "RS-524:gd");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-524:gd")).toBe("operation");
  });

  it("RS-524: 自軍バトルフェイズ中、手札が1枚以上あれば太字部分を実行できる（出典: atwiki/page-1151「自軍バトルフェイズ中に1度だけ…実行してもよい」）", () => {
    expect(anyActivation(field("battle"))).toBe(true);
  });

  it("RS-524: 「自軍バトルフェイズ中」— ラッシュフェイズには実行できない（出典: atwiki/page-1151）", () => {
    expect(anyActivation(field("rush"))).toBe(false);
  });

  it("RS-524: 手札がなければ実行できない（出典: atwiki/page-1151『自分の手札を1枚選び相手に見せる』）", () => {
    expect(anyActivation(field("battle", []))).toBe(false);
  });

  it.todo(
    "RS-524: 呉越同舟で ET を追加した L ユニットからゴーゴーショベルがコンビネーションした場合、追加カテゴリが失われてもコンビネーションは成立したまま（出典: grnrngr/faq-card-8 RS-524 Q1「はい」）— カテゴリ追加の起動が未実装（上の it.fails）",
  );
  it.todo(
    "RS-524: 頼もしい相棒の太字部分を呉越同舟の太字部分に読み替えるとき、頼もしい相棒で見せた L ユニットのカードを見せるカードに選べる（出典: grnrngr/faq-card-8 RS-524 Q2「はい、できます」）— タッグの太字部分の入れ替えが未実装（R-KW-TAG-01）",
  );
});

// ===========================================================================
describe("RS-525 頼もしい相棒", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズ中に1度だけ、自分の手札から合体を必要とするLユニットのカードを1枚選び、相手に見せてから『オモテ向きの自軍パワーを2枚選び捨札にする』を実行してもよい。そうしたとき、自軍山札を見て、その合体に必要なMユニットのカードを1枚選び、相手に見せてから自分の手札に加えてもよい。その後、山札をシャッフルする。";

  const rushPhase = (hand = [inst("RS-529", "robo")], power = powerCards(2)) =>
    st({
      phase: "rush",
      turn: 3,
      player1: { operation: [inst("RS-525", "ta")], hand, power, deck: [inst("TST-OP", "d0"), inst("RS-530", "jet"), inst("RS-533", "s")] },
      player2: { deck: deckCards(3, "e") },
    });

  it("RS-525: カタログ本文・スペックが出典と一致（出典: atwiki/page-1153）", () => {
    expectCatalogText("RS-525", TEXT);
    expectOpStats("RS-525", { name: "頼もしい相棒", category: "OT", powerCost: 2 });
  });

  it("RS-525: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（出典: atwiki/page-1153「※常駐」）", () => {
    const r = useOpInRush({ hand: [inst("RS-525", "ta")], command: releasedCat("OT", 1), power: powerCards(2) }, "RS-525:ta");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-525:ta")).toBe("operation");
  });

  it("RS-525: 手札のチェンジロボを見せてオモテ向きのパワー2枚を捨札にすると、山札から合体に必要な M ユニット（ジェットチェンジャー1）を手札に加えられる（出典: atwiki/page-1153）", () => {
    let s = rushPhase();
    expect(canActivateResident(s, "player1", "RS-525:ta")).toBe(true);
    s = resolveAll(activateResident(s, "player1", "RS-525:ta"), ["RS-529:robo", "TST-P:pw0", "TST-P:pw1", "RS-530:jet"]);
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:pw1")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-530:jet")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-533:s")).toBe("deck");
  });

  it("RS-525: オモテ向きのパワーが1枚しかなければ実行できない（出典: atwiki/page-1153『オモテ向きの自軍パワーを2枚選び捨札にする』）", () => {
    const power = [inst("TST-P", "up"), { ...inst("TST-P", "dn"), faceDown: true }];
    expect(canActivateResident(rushPhase(undefined, power), "player1", "RS-525:ta")).toBe(false);
  });

  it("RS-525: 手札に合体を必要とする L ユニットのカードがなければ実行できない（出典: atwiki/page-1153「自分の手札から合体を必要とするLユニットのカードを1枚選び」）", () => {
    expect(canActivateResident(rushPhase([inst("TST-UNIT-7", "l")]), "player1", "RS-525:ta")).toBe(false);
  });
});

// ===========================================================================
describe("RS-526 スーパーハイウェイバスター", () => {
  const TEXT =
    "自軍山札を見て、特徴「炎神」を持つMユニットのカードを1枚選び、自軍パワーゾーンに置いてもよい。そうしたとき、山札をシャッフルした後で、置いたユニットカードのBP以下の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。";
  const ENGINE_M = sUnit("SPEC-ENGINE-M", { category: "OT", size: "M", bp: 3000, features: ["炎神"] });
  const ENGINE_S = sUnit("SPEC-ENGINE-S", { category: "OT", size: "S", bp: 3000, features: ["炎神"] });
  const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "OT", size: "M", bp: 9000 });
  const S3000 = sUnit("SPEC-S3000", { bp: 3000 });
  const S3500 = sUnit("SPEC-S3500", { bp: 3500 });
  const EXTRA = [ENGINE_M, ENGINE_S, PLAIN_M, S3000, S3500];

  const use = () =>
    useOpInRush(
      {
        hand: [inst("RS-526", "hb")],
        command: releasedCat("OT", 1),
        power: powerCards(2),
        deck: [inst("TST-OP", "d0"), inst("SPEC-ENGINE-M", "en"), inst("SPEC-ENGINE-S", "es"), inst("SPEC-PLAIN-M", "pm")],
      },
      "RS-526:hb",
      { rush: [inst("SPEC-S3000", "e3")], battle: [inst("SPEC-S3500", "e35"), inst("TST-UNIT-2", "em")] },
      EXTRA,
    );

  it("RS-526: カタログ本文・スペックが出典と一致（出典: atwiki/page-1142）", () => {
    expectCatalogText("RS-526", TEXT);
    expectOpStats("RS-526", { name: "スーパーハイウェイバスター", category: "OT", powerCost: 2 });
  });

  it("RS-526: 山札から選べるのは特徴「炎神」を持つ M ユニットのカードだけ（炎神の S・炎神でない M は不可）（出典: atwiki/page-1142「特徴「炎神」を持つMユニットのカードを1枚選び」）", () => {
    const r = use();
    expect(r.ok).toBe(true);
    expect(choiceIds(r.state)).toEqual(["SPEC-ENGINE-M:en"]);
  });

  it("RS-526: 炎神の M ユニットを自軍パワーゾーンに置くと、その BP（3000）以下の敵軍 S ユニット（ラッシュエリアも可）を1体選び持ち主のパワーゾーンに送る（出典: atwiki/page-1142「置いたユニットカードのBP以下の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る」）", () => {
    let s = pick(use().state, "SPEC-ENGINE-M:en");
    expect(zoneOf(s, "player1", "SPEC-ENGINE-M:en")).toBe("power");
    // BP3000 ちょうどの S は可。BP3500 の S・M ユニットは不可。
    expect(choiceIds(s)).toEqual(["SPEC-S3000:e3"]);
    s = resolveAll(pick(s, "SPEC-S3000:e3"));
    expect(zoneOf(s, "player2", "SPEC-S3000:e3")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-S3000:e3")?.faceDown).not.toBe(true);
    expect(zoneOf(s, "player2", "SPEC-S3500:e35")).toBe("battle");
  });

  it("RS-526: 「置いてもよい」— 置かなければ敵軍ユニットは送られない（出典: atwiki/page-1142「置いてもよい。そうしたとき」）", () => {
    let s = use().state;
    if (s.pendingEffectChoice && canSkip(s)) s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "SPEC-ENGINE-M:en")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-S3000:e3")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-S3500:e35")).toBe("battle");
  });
});
