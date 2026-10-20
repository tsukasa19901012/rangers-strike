/**
 * カード別スペック: RS-446〜RS-452（第7弾「七忍の炎陣」ダイジュピター〜テトラボーイ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS446 ダイジュピターの読み替え）、grnrngr/faq-card-7（該当カードの Q なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ダイジュピターはライブ写し pages/785.txt も同文）
 *  3. docs/rules/*.md の一般ルール（R-KW-SCRUM-01、R-CN-02〜R-CN-06、R-BTL-02/03、R-ZONE-08 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  canSkip,
  choiceIds,
  confirm,
  deckCards,
  enterAt,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  NOSP_ATTACKER,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  settle,
  skip,
  spOf,
  sUnit,
  st,
  stackedOn,
  zoneOf,
} from "./RS7-432-452.helpers";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState } from "../types/game";

type P = Partial<GameState["players"]["player1"]>;

/** BP6000 / BP5000 の S ユニット（敵軍がバトルエリアに出す役）。 */
const BP6000 = sUnit("SPEC-BP6000", { name: "BP6000", bp: 6000 });
const BP5000 = sUnit("SPEC-BP5000", { name: "BP5000", bp: 5000 });
const BP4000 = sUnit("SPEC-BP4000", { name: "BP4000", bp: 4000 });
/** M ユニット（SP1）。 */
const M_UNIT = sUnit("SPEC-M", { name: "Mユニット", size: "M" });
/** CN4 / CN5 の S ユニット（スクラム確認用）。 */
const CN4 = sUnit("SPEC-CN4", { name: "CN4", comboNumber: 4 });
const CN5 = sUnit("SPEC-CN5", { name: "CN5", comboNumber: 5 });
/** ET の L ユニット（追加条件なし）。 */
const ET_L = sUnit("SPEC-ETL", { name: "ET L", category: "ET", size: "L", bp: 6000 });
const SPECS = [BP6000, BP5000, BP4000, M_UNIT, CN4, CN5, ET_L, NOSP_ATTACKER];

function stx(o: Parameters<typeof st>[0] = {}) {
  return st(o, SPECS);
}
function at(id: string, pos: number, p1: P = {}, p2: P = {}, before: CardInstance[] = fillers(pos - 1)) {
  return enterAt(id, pos, p1, p2, before, SPECS);
}

// ===========================================================================
describe("RS-446 ダイジュピター", () => {
  const TEXT =
    "【スクランブル】自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒自軍コマンドゾーンから、必要パワーを満たしているETを持つMユニットのカードを3枚まで選び、選んだカードを自軍ラッシュエリアに出す。ただし、この効果でカードを選ぶとき、同じカード名のユニットカードを2枚以上選ぶことはできない。";

  it("RS-446: カタログ本文（公式の読み替え後）・スペックが出典と一致（XL・SP－）（出典: docs/rules/08-errata.md R-ERR-RS446・atwiki/page-785 Q1）", () => {
    expectCatalogText("RS-446", TEXT);
    expectStats("RS-446", { name: "ダイジュピター", category: "ET", size: "XL", bp: 3000, sp: undefined, powerCost: 6, features: ["メカ", "母艦"] });
  });

  const scrambleActions = (s: GameState, id = "RS-446:dj") =>
    legal(s).filter((a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === id);
  const rushPhase = (p1: P) =>
    stx({ phase: "rush", player1: { power: powerCards(6), deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e") } });
  const cmds = () => [
    released("RS-118", "dump"), // ゴーゴーダンプ M ET 5+
    released("RS-121", "doz1"), // ゴーゴードーザー M ET 4+
    released("RS-121", "doz2"),
    released("RS-383", "lad"), // レッドラダー M ET 7+（パワー6では満たさない）
    released("TST-UNIT-2", "wbm"), // WB の M
  ];

  it("RS-446: 【スクランブル】自軍ラッシュフェイズ中、ラッシュエリアのこれを捨札にして発動でき、必要パワーを満たす ET の M ユニットのカードだけを選べる（出典: atwiki/page-785）", () => {
    let s = rushPhase({ rush: [inst("RS-446", "dj")], command: cmds() });
    const a = scrambleActions(s);
    expect(a).toHaveLength(1);
    s = act(s, a[0]!);
    expect(zoneOf(s, "player1", "RS-446:dj")).toBe("discard");
    expect(choiceIds(s)).toEqual(["RS-118:dump", "RS-121:doz1", "RS-121:doz2"]);
  });

  it("RS-446: 【スクランブル】選んだカードは自軍ラッシュエリアに出る（出典: atwiki/page-785「選んだカードを自軍ラッシュエリアに出す」）", () => {
    const base = rushPhase({ rush: [inst("RS-446", "dj")], command: cmds() });
    let s = act(base, scrambleActions(base)[0]!);
    s = pick(s, "RS-118:dump");
    s = pick(s, "RS-121:doz1");
    if (s.pendingEffectChoice) s = confirm(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RS-118:dump")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-121:doz1")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-121:doz2")).toBe("command");
  });

  it("RS-446: 【スクランブル】同じカード名のユニットカードを2枚以上は選べない（出典: atwiki/page-785「同じカード名のユニットカードを2枚以上選ぶことはできない」）", () => {
    const base = rushPhase({ rush: [inst("RS-446", "dj")], command: cmds() });
    let s = act(base, scrambleActions(base)[0]!);
    s = pick(s, "RS-121:doz1");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("RS-121:doz2");
    s = resolveAll(s, ["RS-118:dump"]);
    expect(zoneOf(s, "player1", "RS-121:doz2")).toBe("command");
  });

  it("RS-446: 【スクランブル】「3枚まで」— 1枚だけ選んで終えられる（出典: atwiki/page-785「3枚まで選び」）", () => {
    const base = rushPhase({ rush: [inst("RS-446", "dj")], command: cmds() });
    let s = pick(act(base, scrambleActions(base)[0]!), "RS-118:dump");
    if (s.pendingEffectChoice) s = confirm(s);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "RS-118:dump")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-121:doz1")).toBe("command");
  });

  it("RS-446: 【スクランブル】選べるのは3枚まで（4種類あっても4枚目は出せない）（出典: atwiki/page-785「3枚まで選び」）", () => {
    const base = rushPhase({
      rush: [inst("RS-446", "dj")],
      command: [released("RS-118", "a"), released("RS-121", "b"), released("RS-122", "c"), released("RS-074", "d")],
    });
    let s = act(base, scrambleActions(base)[0]!);
    for (const id of ["RS-118:a", "RS-121:b", "RS-122:c", "RS-074:d"]) {
      if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
    }
    if (s.pendingEffectChoice) s = confirm(s);
    s = resolveAll(s);
    expect(s.players.player1.rush).toHaveLength(3);
    expect(s.players.player1.command).toHaveLength(1);
  });

  it("RS-446: 【スクランブル】バトルフェイズ中は発動できない（出典: atwiki/page-785「自軍ラッシュフェイズ中」）", () => {
    const s = stx({ phase: "battle", player1: { rush: [inst("RS-446", "dj")], command: cmds(), power: powerCards(6), deck: deckCards(5) } });
    expect(scrambleActions(s)).toHaveLength(0);
  });

  it("RS-446: 【スクランブル】このカードが自軍コマンドゾーンや手札にあるときは発動できない（出典: atwiki/page-785 Q1「いいえ、それはできません」）", () => {
    const s = rushPhase({ hand: [inst("RS-446", "dj")], command: [released("RS-446", "dj2"), ...cmds()] });
    expect(scrambleActions(s, "RS-446:dj")).toHaveLength(0);
    expect(scrambleActions(s, "RS-446:dj2")).toHaveLength(0);
    expect(legal(s).some((a) => (a as { unitInstanceId?: string }).unitInstanceId?.startsWith("RS-446"))).toBe(false);
  });

  it("RS-446: 【スクランブル】は「発動できる」— 発動しなければラッシュエリアに残る（出典: atwiki/page-785「次の効果を発動できる」）", () => {
    const s = rushPhase({ rush: [inst("RS-446", "dj")], command: cmds() });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(true);
    expect(zoneOf(s, "player1", "RS-446:dj")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-447 ダイナブラック", () => {
  const TEXT =
    "※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、自軍捨札の枚数がこれの必要パワーの数字以上なら、これを自軍ラッシュエリアに出してもよい。 【忍術の備え】「SP1」 自軍捨札からカテゴリにMAを持つオペレーションカードを1枚選び手札に加えてもよい。";

  it("RS-447: カタログ本文・スペックが出典と一致（S・SP！・CN5）（出典: atwiki/page-786）", () => {
    expectCatalogText("RS-447", TEXT);
    expectStats("RS-447", { name: "ダイナブラック", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 5, comboNumber: 5, features: ["ブラック", "男", "忍者"] });
  });

  const selfRush = (s: GameState) =>
    legal(s).filter((a): a is Extract<GameAction, { type: "self_rush_from_zone" }> => a.type === "self_rush_from_zone" && a.instanceId === "RS-447:db");
  const cmdState = (discardN: number, card: CardInstance = released("RS-447", "db"), phase: GameState["phase"] = "rush") =>
    stx({
      phase,
      player1: { command: [card], discard: Array.from({ length: discardN }, (_, i) => inst("TST-OP", `d${i}`)), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });

  it("RS-447: ※自軍コマンドゾーンにある間、自軍ラッシュフェイズ中に自軍捨札が5枚（必要パワーの数字）以上なら、自軍ラッシュエリアに出せる（出典: atwiki/page-786）", () => {
    const s = cmdState(5);
    const a = selfRush(s);
    expect(a).toHaveLength(1);
    const t = act(s, a[0]!);
    expect(zoneOf(t, "player1", "RS-447:db")).toBe("rush");
  });

  it("RS-447: ※自軍捨札が4枚ならコマンドゾーンから出せない（出典: atwiki/page-786「必要パワーの数字以上なら」）", () => {
    expect(selfRush(cmdState(4))).toHaveLength(0);
  });

  it("RS-447: ※ラッシュフェイズ以外（バトルフェイズ）では出せない（出典: atwiki/page-786「自軍ラッシュフェイズ中」）", () => {
    expect(selfRush(cmdState(6, released("RS-447", "db"), "battle"))).toHaveLength(0);
  });

  it("RS-447: ※ホールド状態でも自軍コマンドゾーンにあれば出せる（出典: atwiki/page-786「これが自軍コマンドゾーンにある間」— リリース状態の条件はない）", () => {
    expect(selfRush(cmdState(5, { ...inst("RS-447", "db"), commandHeld: true }))).toHaveLength(1);
  });

  const ninja = (pos = 5, discard: CardInstance[] = [inst("RS-432", "maop"), inst("TST-OP", "wbop"), inst("RS-449", "maunit"), inst("TST-OP-MA", "maop2")]) =>
    at("RS-447", pos, { discard });

  it("RS-447: 【忍術の備え】5番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-786「「SP1」」）", () => {
    expect(spOf(ninja(), "player1", "RS-447:x")).toBe(1);
  });

  it("RS-447: 【忍術の備え】自軍捨札から MA のオペレーションカードだけを選べる（WB のオペ・MA のユニットは不可）（出典: atwiki/page-786「カテゴリにMAを持つオペレーションカードを1枚選び」）", () => {
    const s = ninja();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-447");
    expect(choiceIds(s)).toEqual(["RS-432:maop", "TST-OP-MA:maop2"]);
  });

  it("RS-447: 【忍術の備え】選んだ MA のオペレーションカードは手札に加わる（出典: atwiki/page-786「手札に加えてもよい」）", () => {
    const s = resolveAll(pick(ninja(), "RS-432:maop"));
    expect(zoneOf(s, "player1", "RS-432:maop")).toBe("hand");
  });

  it("RS-447: 【忍術の備え】は「加えてもよい」— 加えなければ捨札はそのまま（出典: atwiki/page-786「手札に加えてもよい」）", () => {
    let s = ninja();
    if (s.pendingEffectChoice?.sourceCardId === "RS-447") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(s.players.player1.discard).toHaveLength(4);
  });

  it("RS-447: NC が成立していない（4番目）ときは SP！のまま（SP0）で、捨札から加える選択も出ない（出典: atwiki/page-786「CN：5」・R-CN-02）", () => {
    const s = ninja(4);
    expect(spOf(s, "player1", "RS-447:x")).toBe(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-447");
  });
});

// ===========================================================================
describe("RS-448 ダイナイエロー", () => {
  const TEXT =
    "【イエロービッグボール】自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（置けなければこの効果は発動できない）。そうしたとき、置いたカードの必要パワーの数字と同じ数字を持つ敵軍ユニットを1体選び撃破する。";

  it("RS-448: カタログ本文・スペックが出典と一致（S・SP－・CN4）（出典: atwiki/page-787）", () => {
    expectCatalogText("RS-448", TEXT);
    expectStats("RS-448", { name: "ダイナイエロー", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 4, features: ["イエロー", "男"] });
  });

  /** 自軍山札の一番上は必要パワー2の TST-UNIT-2。敵軍: 必要パワー2（TST-UNIT-2）と0（TST-UNIT-0）。 */
  const yellow = (p1: P = {}, pos = 4) =>
    at(
      "RS-448",
      pos,
      { deck: [inst("TST-UNIT-2", "top"), ...deckCards(4)], ...p1 },
      { battle: [inst("TST-UNIT-2", "e2"), inst("TST-UNIT-0", "e0")], rush: [inst("TST-UNIT-2", "e2r")] },
    );

  /** 「置いてもよい」の確認があれば置く方を選ぶ。 */
  const accept = (s: GameState) => {
    let t = s;
    for (let i = 0; i < 2 && t.pendingEffectChoice?.sourceCardId === "RS-448" && t.pendingEffectChoice.playerId === "player1"; i++) {
      const ids = t.pendingEffectChoice.validInstanceIds;
      if (ids.includes("TST-UNIT-2:top")) t = pick(t, "TST-UNIT-2:top");
      else break;
    }
    return t;
  };

  it("RS-448: 【イエロービッグボール】山札の上から1枚ひいて、自軍コマンドゾーンにホールド状態で置ける（出典: atwiki/page-787）", () => {
    const s = accept(yellow());
    const c = s.players.player1.command.find((x) => x.instanceId === "TST-UNIT-2:top");
    expect(c).toBeDefined();
    expect(c?.commandHeld).toBe(true);
  });

  it("RS-448: 【イエロービッグボール】置いたカードの必要パワーの数字（2）と同じ数字を持つ敵軍ユニット（ラッシュエリアを含む）だけを選び撃破する（出典: atwiki/page-787「同じ数字を持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = accept(yellow());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-448");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:e2", "TST-UNIT-2:e2r"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-2:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("battle");
  });

  it("RS-448: 【イエロービッグボール】は「置いてもよい」— 置かなければ山札は減らず、何も撃破しない（出典: atwiki/page-787「置いてもよい」）", () => {
    let s = yellow();
    if (s.pendingEffectChoice?.sourceCardId === "RS-448") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(s.players.player1.deck).toHaveLength(5);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("battle");
  });

  it("RS-448: 【イエロービッグボール】自軍コマンドゾーンが5枚で置けなければ発動できない（山札は減らない）（出典: atwiki/page-787「置けなければこの効果は発動できない」・R-ZONE-08）", () => {
    const s = resolveAll(yellow({ command: releasedCat("ET", 5) }), ["TST-UNIT-2:top"]);
    expect(s.players.player1.command).toHaveLength(5);
    expect(s.players.player1.deck).toHaveLength(5);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("battle");
  });

  it("RS-448: NC が成立していない（3番目）ときは発動しない（出典: atwiki/page-787「CN：4」・R-CN-02）", () => {
    const s = resolveAll(yellow({}, 3), ["TST-UNIT-2:top"]);
    expect(s.players.player1.deck).toHaveLength(5);
    expect(s.players.player1.command).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-449 イエローマスク", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【マスキーローター】「SP1」常駐しているオペレーションを1枚選んでもよい。そうしたとき、選んだオペレーションの上に重ねたカードがあれば、重ねたカードをすべて持ち主の山札に戻してシャッフルする。";

  it("RS-449: カタログ本文・スペックが出典と一致（S・SP！・CN3）（出典: atwiki/page-797）", () => {
    expectCatalogText("RS-449", TEXT);
    expectStats("RS-449", { name: "イエローマスク", category: "MA", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 3, features: ["イエロー", "女", "忍者"] });
  });

  const scrum = (next?: string) =>
    stx({
      activePlayer: "player2",
      player1: { battle: [inst("RS-449", "ym"), ...(next ? [inst(next, "nx")] : [])], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });

  it("RS-449: ※スクラム — CN4 のユニットが次に並んでいる間はアタックされない（出典: atwiki/page-797・R-KW-SCRUM-01）", () => {
    const t = attackTargets(scrum("SPEC-CN4"), "TST-UNIT-7:atk", "player2");
    expect(t).not.toContain("RS-449:ym");
    expect(t).toContain("SPEC-CN4:nx");
  });

  it("RS-449: ※スクラム — 次に並ぶのが CN5 ならアタックされる（出典: atwiki/page-797「1多いＣＮ」）", () => {
    expect(attackTargets(scrum("SPEC-CN5"), "TST-UNIT-7:atk", "player2")).toContain("RS-449:ym");
  });

  it("RS-449: ※スクラム — 次に並ぶユニットがいなければアタックされる（出典: atwiki/page-797「次に並んでいる間」）", () => {
    expect(attackTargets(scrum(), "TST-UNIT-7:atk", "player2")).toContain("RS-449:ym");
  });

  const law = (owner: string): CardInstance => ({
    ...inst("RS-256", owner),
    stackedCards: [
      { ...inst("TST-OP", `${owner}s1`), faceDown: true },
      { ...inst("TST-OP", `${owner}s2`), faceDown: true },
    ],
  });
  const mask = (pos = 3) => at("RS-449", pos, { operation: [law("own")] }, { operation: [law("en")] });

  it("RS-449: 【マスキーローター】3番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-797「「SP1」」）", () => {
    expect(spOf(mask(), "player1", "RS-449:x")).toBe(1);
  });

  it("RS-449: 【マスキーローター】常駐しているオペレーション（敵軍のものも）を選べ、重ねたカードはすべて持ち主の山札に戻る（出典: atwiki/page-797「重ねたカードをすべて持ち主の山札に戻してシャッフルする」）", () => {
    let s = mask();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-449");
    expect(choiceIds(s)).toEqual(["RS-256:en", "RS-256:own"]);
    s = resolveAll(pick(s, "RS-256:en"));
    expect(stackedOn(s, "player2", "RS-256:en")).toHaveLength(0);
    expect(zoneOf(s, "player2", "TST-OP:ens1")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-OP:ens2")).toBe("deck");
    expect(s.players.player2.deck).toHaveLength(5 + 2);
    expect(stackedOn(s, "player1", "RS-256:own")).toHaveLength(2);
    expect(zoneOf(s, "player2", "RS-256:en")).toBe("operation");
  });

  it("RS-449: 【マスキーローター】は「選んでもよい」— 選ばなければ重ねたカードはそのまま（出典: atwiki/page-797「1枚選んでもよい」）", () => {
    let s = mask();
    if (s.pendingEffectChoice?.sourceCardId === "RS-449") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(stackedOn(s, "player2", "RS-256:en")).toHaveLength(2);
    expect(stackedOn(s, "player1", "RS-256:own")).toHaveLength(2);
  });

  it("RS-449: NC が成立していない（2番目）ときは SP！のまま（SP0）で、選択も出ない（出典: atwiki/page-797「CN：3」・R-CN-02）", () => {
    const s = mask(2);
    expect(spOf(s, "player1", "RS-449:x")).toBe(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-449");
  });
});

// ===========================================================================
describe("RS-450 地帝忍オヨブー", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【皇帝への忠義】これが敵軍ユニットとバトルして、お互いに撃破されて捨札になったとき、自軍エリアに特徴「皇帝」を持つユニットがあれば、これとバトルした敵軍ユニットのカードを、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RS-450: カタログ本文・スペックが出典と一致（S・SP－・CN なし）（出典: atwiki/page-821）", () => {
    expectCatalogText("RS-450", TEXT);
    expectStats("RS-450", { name: "地帝忍オヨブー", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 2, features: ["ブヨン族", "男", "忍者"] });
  });

  const attacked = (p1: P = {}, attacker = "TST-UNIT-0:atk") =>
    attackedInEnemyTurn({ battle: [inst("RS-450", "oy")], ...p1 }, "RS-450:oy", {}, attacker, SPECS);

  it("RS-450: ※敵軍ターン中、SP1 以上のユニット（BP1000）とバトルすると、勝っても撃破される（相手も撃破される）（出典: atwiki/page-821・R-BTL-03）", () => {
    const s = resolveAll(attacked(), ["__none__"]);
    expect(zoneOf(s, "player1", "RS-450:oy")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
  });

  it("RS-450: ※SP を持たないユニットとのバトルに勝てば撃破されない（出典: atwiki/page-821「SP1以上のユニットと」）", () => {
    const s = resolveAll(attacked({}, "SPEC-NOSP:atk"), ["__none__"]);
    expect(zoneOf(s, "player1", "RS-450:oy")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-NOSP:atk")).toBe("discard");
  });

  it("RS-450: ※自軍ターン中に SP1 のユニットとバトルして勝っても撃破されない（出典: atwiki/page-821「敵軍ターン中、」）", () => {
    let s = stx({
      player1: { battle: [inst("RS-450", "oy")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
    });
    s = resolveAll(attack(s, "RS-450:oy", "TST-UNIT-0:e"), ["__none__"]);
    expect(zoneOf(s, "player1", "RS-450:oy")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  it("RS-450: 【皇帝への忠義】お互いに撃破されて捨札になったとき、自軍エリアに「皇帝」がいれば、バトルした敵軍ユニットのカードを持ち主のパワーゾーンにダメージ（ウラ向き）で置ける（出典: atwiki/page-821）", () => {
    let s = attacked({ rush: [inst("RS-210", "emp")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-450");
    s = resolveAll(s, ["TST-UNIT-0:atk"]);
    const c = s.players.player2.power.find((x) => x.instanceId === "TST-UNIT-0:atk");
    expect(c?.faceDown).toBe(true);
  });

  it("RS-450: 【皇帝への忠義】自軍エリアに「皇帝」がいなければ、敵軍ユニットは捨札のまま（出典: atwiki/page-821「特徴「皇帝」を持つユニットがあれば」）", () => {
    const s = resolveAll(attacked(), ["TST-UNIT-0:atk"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-450: 【皇帝への忠義】は「置いてもよい」— 置かなければ敵軍ユニットは捨札のまま（出典: atwiki/page-821「置いてもよい」）", () => {
    let s = attacked({ rush: [inst("RS-210", "emp")] });
    if (s.pendingEffectChoice?.sourceCardId === "RS-450") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
  });

  it("RS-450: 【皇帝への忠義】これだけが撃破された（相手が残った）ときは発動しない（出典: atwiki/page-821「お互いに撃破されて」）", () => {
    const s = resolveAll(attacked({ rush: [inst("RS-210", "emp")] }, "TST-UNIT-7:atk"), ["TST-UNIT-7:atk"]);
    expect(zoneOf(s, "player1", "RS-450:oy")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("battle");
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-450: 【皇帝への忠義】自軍ターンの相打ち（BP4000 同士）でも発動する（出典: atwiki/page-821「これが敵軍ユニットとバトルして、お互いに撃破されて」・R-BTL-02）", () => {
    let s = stx({
      player1: { battle: [inst("RS-450", "oy")], rush: [inst("RS-210", "emp")], deck: deckCards(3) },
      player2: { battle: [inst("SPEC-BP4000", "e")], deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "RS-450:oy", "SPEC-BP4000:e"));
    expect(zoneOf(s, "player1", "RS-450:oy")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-450");
  });
});

// ===========================================================================
describe("RS-451 シノビドグラー", () => {
  const TEXT = "【シノビボールの争奪戦】これが自軍バトルエリアにある間、敵軍ターン中、敵軍Sユニットは、バトルエリアに出たとき、可能ならこのユニットにアタックする。";

  it("RS-451: カタログ本文・スペックが出典と一致（S・SP－・CN なし）（出典: atwiki/page-822）", () => {
    expectCatalogText("RS-451", TEXT);
    expectStats("RS-451", { name: "シノビドグラー", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 4, features: ["怪人", "男", "忍者"] });
  });

  const enemyEnters = (unit: string, where: "battle" | "rush" = "battle") => {
    const s = stx({
      activePlayer: "player2",
      player1:
        where === "battle"
          ? { battle: [inst("RS-451", "dg"), inst("TST-UNIT-0", "other")], deck: deckCards(3) }
          : { rush: [inst("RS-451", "dg")], battle: [inst("TST-UNIT-0", "other")], deck: deckCards(3) },
      player2: { rush: [inst(unit, "e")], deck: deckCards(3, "e") },
    });
    return act(s, { type: "move_to_battle", playerId: "player2", instanceId: `${unit}:e` });
  };
  const actionsOf = (s: GameState, id: string) =>
    legal(s).filter((a) => a.playerId === "player2" && ((a as { attackerInstanceId?: string }).attackerInstanceId === id || (a.type === "strike" && a.instanceId === id)));

  it("RS-451: 【シノビボールの争奪戦】敵軍ターン中、バトルエリアに出た敵軍 S ユニットはこのユニットにアタックしなければならない（他へのアタック・ストライクは不可）（出典: atwiki/page-822「可能ならこのユニットにアタックする」）", () => {
    const s = enemyEnters("TST-UNIT-0");
    const acts = actionsOf(s, "TST-UNIT-0:e");
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.every((a) => a.type === "battle" && a.defenderInstanceId === "RS-451:dg")).toBe(true);
  });

  it("RS-451: 敵軍の M ユニットは自由に行動できる（他のユニットへのアタックやストライクも可）（出典: atwiki/page-822「敵軍Sユニットは」）", () => {
    const s = enemyEnters("SPEC-M");
    expect(attackTargets(s, "SPEC-M:e", "player2")).toContain("TST-UNIT-0:other");
  });

  it("RS-451: これがラッシュエリアにあるときは効果がない（出典: atwiki/page-822「これが自軍バトルエリアにある間」）", () => {
    const s = enemyEnters("TST-UNIT-0", "rush");
    expect(attackTargets(s, "TST-UNIT-0:e", "player2")).toContain("TST-UNIT-0:other");
  });
});

// ===========================================================================
describe("RS-452 テトラボーイ", () => {
  const TEXT =
    "※これが自軍バトルエリアにある間、BP6000以上の敵軍ユニットがバトルエリアに出たとき、これをラッシュエリアに戻してもよい。 【テトラバスター】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒追加条件に「自軍合体ユニットを捨札にする」と表記されていない敵軍Lユニットを1体選び、撃破する。";

  it("RS-452: カタログ本文・スペックが出典と一致（M・SP－・CN「R」）（出典: atwiki/page-788）", () => {
    expectCatalogText("RS-452", TEXT);
    expectStats("RS-452", { name: "テトラボーイ", category: "ET", size: "M", bp: 4000, sp: undefined, powerCost: 5, comboNumber: "R" as unknown as number, features: ["メカ", "人型"] });
  });

  const enemyEnters = (unit: string, where: "battle" | "rush" = "battle") => {
    const s = stx({
      activePlayer: "player2",
      player1: { [where]: [inst("RS-452", "tb")], deck: deckCards(3) },
      player2: { rush: [inst(unit, "e")], deck: deckCards(3, "e") },
    });
    return act(s, { type: "move_to_battle", playerId: "player2", instanceId: `${unit}:e` });
  };

  it("RS-452: ※自軍バトルエリアにある間、BP6000 の敵軍ユニットがバトルエリアに出たとき、これをラッシュエリアに戻せる（出典: atwiki/page-788）", () => {
    let s = enemyEnters("SPEC-BP6000");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-452");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = resolveAll(s, ["RS-452:tb"]);
    expect(zoneOf(s, "player1", "RS-452:tb")).toBe("rush");
  });

  it("RS-452: ※は「戻してもよい」— 戻さないことを選べる（出典: atwiki/page-788「戻してもよい」）", () => {
    const s = enemyEnters("TST-UNIT-7");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-452");
    expect(canSkip(s)).toBe(true);
    expect(zoneOf(skip(s), "player1", "RS-452:tb")).toBe("battle");
  });

  it("RS-452: ※BP5000 の敵軍ユニットが出ても戻れない（出典: atwiki/page-788「BP6000以上の敵軍ユニット」）", () => {
    const s = enemyEnters("SPEC-BP5000");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-452");
    expect(zoneOf(resolveAll(s, ["__none__"]), "player1", "RS-452:tb")).toBe("battle");
  });

  it("RS-452: ※これがラッシュエリアにあるときは発動しない（出典: atwiki/page-788「これが自軍バトルエリアにある間」）", () => {
    const s = enemyEnters("TST-UNIT-7", "rush");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-452");
  });

  /** 自軍バトルフェイズ、左隣に leftL を置いてテトラボーイを出す（R ナンバー → ジョイントコンビネーション）。 */
  const buster = (leftL: string) =>
    at(
      "RS-452",
      2,
      {},
      { battle: [inst("TST-UNIT-7", "l7"), inst("RS-226", "ko")], rush: [inst("RS-216", "ex"), inst("TST-UNIT-0", "es")] },
      [inst(leftL, "left")],
    );

  it("RS-452: 【テトラバスター】同カテゴリ（ET）の L ユニットからコンビネーションするとき、追加条件に「自軍合体ユニットを捨札にする」のない敵軍 L ユニット（ラッシュエリアを含む）だけを選べる（出典: atwiki/page-788）", () => {
    const s = buster("SPEC-ETL");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-452");
    expect(choiceIds(s)).toEqual(["RS-216:ex", "TST-UNIT-7:l7"]);
  });

  it("RS-452: 【テトラバスター】選んだ敵軍 L ユニットを撃破する（出典: atwiki/page-788「1体選び、撃破する」）", () => {
    const s = resolveAll(pick(buster("SPEC-ETL"), "TST-UNIT-7:l7"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:l7")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-226:ko")).toBe("battle");
  });

  it("RS-452: 【テトラバスター】は「発動できる」— 発動しないことを選べる（出典: atwiki/page-788「次の効果を発動できる」）", () => {
    const s = buster("SPEC-ETL");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-452");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-452: 【テトラバスター】カテゴリの違う L ユニット（WB）からではコンビネーションしても発動しない（出典: atwiki/page-788「同カテゴリのLユニットから」）", () => {
    const s = resolveAll(buster("TST-UNIT-7"), ["TST-UNIT-7:l7"]);
    expect(zoneOf(s, "player2", "TST-UNIT-7:l7")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-216:ex")).toBe("rush");
  });

  it("RS-452: 【テトラバスター】S ユニットの次に出ても発動しない（出典: atwiki/page-788「Lユニットからコンビネーションするとき」）", () => {
    const s = resolveAll(buster("TST-UNIT-0"), ["TST-UNIT-7:l7"]);
    expect(zoneOf(s, "player2", "TST-UNIT-7:l7")).toBe("battle");
  });
});

