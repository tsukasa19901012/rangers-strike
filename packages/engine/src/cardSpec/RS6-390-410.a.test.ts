/**
 * カード別スペック: RS-390〜RS-396（第6弾「紅き六戦士の帰還」ゴーグリーン〜タイムジェットγ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html: RS-393 Q1、RS-394 Q1/Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *     atwiki 転載 Q&A（RS-393 Q2、RS-394 Q3 / RS-395 Q1 / RS-396 Q1）
 *  3. docs/rules/*.md の一般ルール（R-ZONE-08 コマンドゾーン上限5枚、R-ADD-06 合体、R-KW-RIDE-04/05 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  DEFS,
  bpOf,
  endTurn,
} from "./RS6-390-410.helpers";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";

const AIR = sUnit("SPEC-AIR", { name: "航空機ユニット", features: ["航空機"], category: "ET" });
const RCU = sUnit("SPEC-RC", { name: "RCユニット", comboNumber: "RC" as unknown as number, category: "ET" });
const ETPLAIN = sUnit("SPEC-ET", { name: "ETユニット", category: "ET", comboNumber: 3 });
const WBPLAIN = sUnit("SPEC-WB", { name: "WBユニット", category: "WB", comboNumber: 3 });
const ETM = sUnit("SPEC-ETM", { name: "ET Mユニット", category: "ET", size: "M", comboNumber: 3 });
const SPECS: CardDefinition[] = [AIR, RCU, ETPLAIN, WBPLAIN, ETM];

type P = Partial<GameState["players"]["player1"]>;

/** player1 のバトルフェイズに、ラッシュエリアの id を pos 番目に出す（前 pos-1 体は fillers）。 */
function enterAt(id: string, pos: number, p1: P = {}, p2: P = {}, before = fillers(pos - 1)) {
  const s = st(
    {
      player1: { battle: before, rush: [inst(id, "x")], deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    SPECS,
  );
  return enter(s, `${id}:x`);
}

const jets = () => ["RS-397", "RS-398", "RS-399", "RS-400", "RS-401"].map((id) => inst(id, "j"));

// ===========================================================================
describe("RS-390 ゴーグリーン", () => {
  const TEXT =
    "【ファイブレイザー】「SP1」敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ敵軍コマンドを1つ選び、捨札にしてから置く。（この効果は特徴「航空機」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";

  it("RS-390: カタログ本文・スペックが出典と一致（出典: atwiki/page-534）", () => {
    expectCatalogText("RS-390", TEXT);
    expectStats("RS-390", {
      name: "ゴーグリーン",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 5,
      features: ["グリーン", "男"],
    });
  });

  const enemyDiscard = () => [inst("TST-OP", "edop"), inst("TST-UNIT-0", "edun")];

  it("RS-390: 【ファイブレイザー】5番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-534「CN：5」「「SP1」」・R-CN-02）", () => {
    const s = enterAt("RS-390", 5, {}, { discard: enemyDiscard() });
    expect(spOf(s, "player1", "RS-390:x")).toBe(1);
  });

  // 「敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置いてもよい」
  it("RS-390: 【ファイブレイザー】NC 成立時、敵軍捨札のカード（種類を問わない）から1枚選べる（出典: atwiki/page-534「敵軍捨札からカードを1枚選び」）", () => {
    const s = enterAt("RS-390", 5, { discard: [inst("TST-UNIT-0", "own")] }, { discard: enemyDiscard() });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-390");
    expect(choiceIds(s)).toEqual(["TST-OP:edop", "TST-UNIT-0:edun"]);
  });

  it("RS-390: 選んだ敵軍捨札のカードは持ち主（相手）のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-534「持ち主のコマンドゾーンにホールド状態で置いて」）", () => {
    let s = enterAt("RS-390", 5, {}, { discard: enemyDiscard(), command: [released("TST-OP", "e1")] });
    s = pick(s, "TST-UNIT-0:edun");
    expect(zoneOf(s, "player2", "TST-UNIT-0:edun")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-UNIT-0:edun")?.commandHeld).toBe(true);
    expect(s.players.player1.command).toHaveLength(0);
  });

  it("RS-390: 任意 — 置かないことを選べる（出典: atwiki/page-534「置いてもよい」）", () => {
    let s = enterAt("RS-390", 5, {}, { discard: enemyDiscard() });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player2.discard).toHaveLength(2);
  });

  it("RS-390: 置けなければ（敵軍コマンドゾーンが5枚）敵軍コマンドを1つ選んで捨札にしてから置く（出典: atwiki/page-534「置けなければ敵軍コマンドを1つ選び、捨札にしてから置く」・R-ZONE-08 上限5枚）", () => {
    const full = [released("TST-OP", "e0"), released("TST-OP", "e1"), held("TST-OP", "e2"), held("TST-OP", "e3"), released("TST-OP", "e4")];
    let s = enterAt("RS-390", 5, {}, { discard: enemyDiscard(), command: full });
    s = pick(s, "TST-UNIT-0:edun");
    expect(choiceIds(s)).toEqual(full.map((c) => c.instanceId).sort());
    s = resolveAll(pick(s, "TST-OP:e2"));
    expect(zoneOf(s, "player2", "TST-OP:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:edun")).toBe("command");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-390: NC が成立していない（4番目）ときは SP！のままで、敵軍捨札の選択も出ない（出典: atwiki/page-534「CN：5」・R-CN-02）", () => {
    const s = enterAt("RS-390", 4, {}, { discard: enemyDiscard() });
    expect(spOf(s, "player1", "RS-390:x")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.discard).toHaveLength(2);
  });

  // 「（この効果は特徴「航空機」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」
  it("RS-390: 特徴「航空機」を持つユニットからコンビネーションするとき（2番目）はナンバーに関係なく発動し「SP1」になる（出典: atwiki/page-534「ナンバーに関係なく発動する」）", () => {
    const s = enterAt("RS-390", 2, {}, { discard: enemyDiscard() }, [inst("SPEC-AIR", "air")]);
    expect(spOf(s, "player1", "RS-390:x")).toBe(1);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-390");
  });

  it("RS-390: 航空機を持たないユニットからのコンビネーション（2番目）では発動しない（出典: atwiki/page-534「特徴「航空機」を持つユニットから」）", () => {
    const s = enterAt("RS-390", 2, {}, { discard: enemyDiscard() }, [inst("TST-UNIT-0", "f")]);
    expect(spOf(s, "player1", "RS-390:x")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-390: 航空機ユニットが隣（直前）にいないとき（航空機→他→ゴーグリーンの3番目）は発動しない（出典: atwiki/page-534「…からコンビネーションするとき」）", () => {
    const s = enterAt("RS-390", 3, {}, { discard: enemyDiscard() }, [inst("SPEC-AIR", "air"), inst("TST-UNIT-0", "f")]);
    expect(spOf(s, "player1", "RS-390:x")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-391 ゴーイエロー", () => {
  const TEXT =
    "【番田流牛乳竜巻落とし】「SP1」敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RS-391: カタログ本文・スペックが出典と一致（出典: atwiki/page-535）", () => {
    expectCatalogText("RS-391", TEXT);
    expectStats("RS-391", {
      name: "ゴーイエロー",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 5,
      features: ["イエロー", "男", "警察"],
    });
  });

  const enemy = (command: GameState["players"]["player2"]["command"] = []): P => ({
    battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em")],
    rush: [inst("TST-UNIT-0", "er")],
    command,
  });

  it("RS-391: 【番田流牛乳竜巻落とし】5番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-535「CN：5」「「SP1」」）", () => {
    const s = enterAt("RS-391", 5, {}, enemy());
    expect(spOf(s, "player1", "RS-391:x")).toBe(1);
  });

  it("RS-391: NC 成立時、敵軍バトルエリアの S ユニットだけから選ぶ（M ユニット・ラッシュエリアは不可）（出典: atwiki/page-535「敵軍バトルエリアからSユニットを1体選び」）", () => {
    const s = enterAt("RS-391", 5, {}, enemy());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-391");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
  });

  it("RS-391: 選んだユニットは持ち主（相手）のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-535「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(enterAt("RS-391", 5, {}, enemy()), ["TST-UNIT-0:es"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-UNIT-0:es")?.commandHeld).toBe(true);
  });

  it("RS-391: 強制 — 選ばないことはできない（出典: atwiki/page-535「選び、…置く」（「てもよい」がない））", () => {
    const s = enterAt("RS-391", 5, {}, enemy());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-391");
    expect(canSkip(s)).toBe(false);
  });

  it("RS-391: 置けなければ（相手のコマンドゾーンが5枚）選んだユニットは捨札になる（出典: atwiki/page-535「置けなければ捨札にする」・R-ZONE-08）", () => {
    const full = [0, 1, 2, 3, 4].map((i) => released("TST-OP", `e${i}`));
    const s = resolveAll(enterAt("RS-391", 5, {}, enemy(full)), ["TST-UNIT-0:es"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-391: NC が成立していない（4番目）ときは SP！のままで、敵軍ユニットはそのまま（出典: atwiki/page-535・R-CN-02）", () => {
    const s = enterAt("RS-391", 4, {}, enemy());
    expect(spOf(s, "player1", "RS-391:x")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-392 ゴーピンク", () => {
  const TEXT =
    "【救急医療】敵軍捨札からSユニットのカードを1枚選んでもよい。そうしたとき、自軍捨札からSユニットのカードを相手に1枚選ばせる。その後、選ばれたカードはそれぞれ持ち主の手札に加える。";

  it("RS-392: カタログ本文・スペックが出典と一致（出典: atwiki/page-536）", () => {
    expectCatalogText("RS-392", TEXT);
    expectStats("RS-392", {
      name: "ゴーピンク",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 2,
      features: ["ピンク", "女"],
    });
  });

  const own = (): P => ({ discard: [inst("TST-UNIT-0", "os1"), inst("TST-UNIT-0", "os2"), inst("TST-OP", "oop")] });
  const foe = (): P => ({ discard: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em"), inst("TST-OP", "eop")] });

  it("RS-392: 【救急医療】NC 成立時、自分は敵軍捨札の S ユニットのカードだけから選ぶ（自軍捨札・M ユニット・オペレーションは不可）（出典: atwiki/page-536「敵軍捨札からSユニットのカードを1枚選んでもよい」）", () => {
    const s = enterAt("RS-392", 2, own(), foe());
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
  });

  it("RS-392: 任意 — 敵軍捨札から選ばないこともでき、そのときは相手も選ばない（出典: atwiki/page-536「選んでもよい。そうしたとき」）", () => {
    let s = enterAt("RS-392", 2, own(), foe());
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RS-392: そうしたとき、相手が自軍（ゴーピンク側）捨札の S ユニットのカードを1枚選ぶ（出典: atwiki/page-536「自軍捨札からSユニットのカードを相手に1枚選ばせる」）", () => {
    let s = enterAt("RS-392", 2, own(), foe());
    s = pick(s, "TST-UNIT-0:es");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:os1", "TST-UNIT-0:os2"]);
  });

  it("RS-392: 選ばれたカードはそれぞれ持ち主の手札に加わる（敵軍捨札のカード→相手の手札、自軍捨札のカード→自分の手札）（出典: atwiki/page-536「それぞれ持ち主の手札に加える」）", () => {
    let s = enterAt("RS-392", 2, own(), foe());
    s = pick(s, "TST-UNIT-0:es");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-UNIT-0:os2" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:os2")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:os1")).toBe("discard");
  });

  it("RS-392: NC が成立していない（3番目）ときは選択が出ない（出典: atwiki/page-536「CN：2」・R-CN-02）", () => {
    const s = enterAt("RS-392", 3, own(), foe());
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(spOf(s, "player1", "RS-392:x")).toBe(0);
  });
});

// ===========================================================================
describe("RS-393 コマンドアタッカー", () => {
  const TEXT =
    "※ETのSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。【アタッカーポッド】これがライドされたままなら、このビークルからコンビネーションするSユニットは、次の能力を得る⇒自軍ターン中、ナンバーは3少なくなる。ただし、2より少なくならない。";

  it("RS-393: カタログ本文・スペックが出典と一致（S ビークル・ET・必要パワー5・メカ／車両）（出典: atwiki/page-539）", () => {
    expectCatalogText("RS-393", TEXT);
    const d = DEFS["RS-393"]!;
    expect(d.name).toBe("コマンドアタッカー");
    expect(d.type).toBe("vehicle");
    expect(d.category).toBe("ET");
    expect(d.size).toBe("S");
    expect(d.powerCost).toBe(5);
    expect(d.features).toEqual(["メカ", "車両"]);
  });

  const canMount = (s: GameState, rider: string) =>
    legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === "RS-393:v");
  const rideState = (riders: string[]) =>
    st({ player1: { rush: [inst("RS-393", "v"), ...riders.map((r) => inst(r, "r"))], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, SPECS);

  it("RS-393: ※ RC を持たない ET の S ユニットもライドできる（出典: atwiki/page-539「ETのSユニットは、ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    expect(canMount(rideState(["SPEC-ET"]), "SPEC-ET:r")).toBe(true);
  });

  it("RS-393: ※ RC を持たない ET 以外（WB）の S ユニットはライドできない（出典: atwiki/page-539「ETのSユニットは」・R-KW-RIDE-02）", () => {
    expect(canMount(rideState(["SPEC-WB"]), "SPEC-WB:r")).toBe(false);
  });

  it("RS-393: ※ RC を持たない ET の M ユニットはライドできない（出典: atwiki/page-539「ETのSユニット」・R-KW-RIDE-02）", () => {
    expect(canMount(rideState(["SPEC-ETM"]), "SPEC-ETM:r")).toBe(false);
  });

  it("RS-393: RC を持つユニットはライドできる（出典: R-KW-RIDE-02「RC を持つユニットか…」）", () => {
    expect(canMount(rideState(["SPEC-RC"]), "SPEC-RC:r")).toBe(true);
  });

  /** RC ユニットをライドさせたままのコマンドアタッカーを1番目に置き、次にラッシュエリアの next を出す。 */
  function afterRiddenAttacker(next: string, rideOff = false) {
    let s = st(
      { player1: { rush: [inst("RS-393", "v"), inst("SPEC-RC", "r"), inst(next, "n")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } },
      SPECS,
    );
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "SPEC-RC:r", vehicleInstanceId: "RS-393:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff });
    s = passEntry(s);
    return enter(s, `${next}:n`);
  }

  // 「これがライドされたままなら、このビークルからコンビネーションするSユニットは…ナンバーは3少なくなる」
  it("RS-393: 【アタッカーポッド】ライドされたまま1番目にあるとき、2番目に出た CN5 のゴーグリーンはナンバーが2になり NC が成立する（出典: atwiki/page-539・atwiki 転載 Q2「5以下…並び順が確定することで…」）", () => {
    const s = afterRiddenAttacker("RS-390");
    expect(spOf(s, "player1", "RS-390:n")).toBe(1);
  });

  it("RS-393: 「ただし、2より少なくならない」— CN2 のガオレッド（2nd）は2のまま2番目で NC が成立する（出典: atwiki/page-539「2より少なくならない」）", () => {
    const s = afterRiddenAttacker("RS-402");
    expect(spOf(s, "player1", "RS-402:n")).toBe(1);
  });

  it("RS-393: 「ただし、2より少なくならない」— CN4 のブルーレーサー・CN3 のハリケンレッドは 1・0 にならず2になり、2番目で NC が成立する（出典: atwiki/page-539「2より少なくならない」）", () => {
    expect(spOf(afterRiddenAttacker("RS-048"), "player1", "RS-048:n")).toBe(1);
    expect(spOf(afterRiddenAttacker("RS-099"), "player1", "RS-099:n")).toBe(1);
    // 対照: コマンドアタッカーがなければ2番目では NC が成立しない。
    expect(spOf(enterAt("RS-048", 2), "player1", "RS-048:x")).toBe(0);
    // CN5 のゴーイエローも 5−3＝2 で、2番目で成立する。
    expect(spOf(afterRiddenAttacker("RS-391"), "player1", "RS-391:n")).toBe(1);
  });

  it("RS-393: ライドされていない（ライドオフした）ときは、続くユニットのナンバーは減らない（出典: atwiki/page-539「これがライドされたままなら」・R-KW-RIDE-05）", () => {
    // ライドオフで RC ユニットが2番目に並ぶので、ゴーグリーンは3番目（CN5 のまま → NC 不成立）。
    const s = afterRiddenAttacker("RS-390", true);
    expect(spOf(s, "player1", "RS-390:n")).toBe(0);
  });

  it("RS-393: コマンドアタッカーがないときは CN5 のゴーグリーンは2番目で NC が成立しない（対照）（出典: atwiki/page-534「CN：5」）", () => {
    const s = enterAt("RS-390", 2);
    expect(spOf(s, "player1", "RS-390:x")).toBe(0);
  });

  it.todo(
    "RS-393: 「自軍ターン中」だけナンバーが減る（敵軍ターンにナンバーの数字を参照する効果での確認）— 敵軍ターン中にナンバーを参照する公開 API 経路もないため保留（出典: atwiki/page-539「自軍ターン中」）",
  );

  // grnrngr/faq-card-6 RS-393 Q1:「はい、その通りです。」
  it("RS-393: 公式Q&A — コマンドアタッカーにライドしたレッドホーク（1番目）がターン終了時に手札に戻っても、コマンドアタッカーはバトルエリアに残る（出典: grnrngr/faq-card-6 RS-393 Q1）", () => {
    // RS-280 は ET の S ユニット（RC なし）。※のライド可否とは独立に、ライドした状態を直接置いて確認する。
    let s = st({
      player1: { battle: [inst("RS-393", "v"), { ...inst("RS-280", "hawk"), mountedOnInstanceId: "RS-393:v" }], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    s = resolveAll(endTurn(s));
    expect(zoneOf(s, "player1", "RS-280:hawk")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-393:v")).toBe("battle");
  });

  // atwiki 転載 Q2:「5以下のユニットです。…「RS- 393 コマンドアタッカー」によるナンバーの数字の減少は起こっていないとして扱います。」
  it.todo(
    "RS-393: Q&A — スーパー戦隊魂（RS-521）の効果でラッシュできるのは、出たユニットの本来のナンバー5以下（並び順確定前なのでアタッカーポッドの減少は未適用）— アタッカーポッドの減少自体が未実装のため差が観測できず、RS-521 側（範囲外）のテストで扱う（出典: atwiki/page-539 Q2）",
  );
});

// ===========================================================================
/** タイムロボα/β/タイムジェットγ共通: 5体合体の追加条件。 */
function fusionTests(id: string, cost: number, page: string) {
  const mk = (power: number, rush = jets()) =>
    st({ phase: "rush", player1: { hand: [inst(id, "r")], rush, command: releasedCat("OT", 1), power: powerCards(power), deck: deckCards(3) } });

  it(`${id}: 追加条件 合体 — タイムジェット1〜5がすべて自軍エリアにあれば、それらを捨札にしてラッシュできる（出典: ${page}「合体―タイムジェット1+…+タイムジェット5」・R-ADD-06）`, () => {
    const r = rushFromHand(mk(cost), "player1", `${id}:r`);
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", `${id}:r`)).toBe("rush");
    for (const j of ["RS-397", "RS-398", "RS-399", "RS-400", "RS-401"]) expect(zoneOf(s, "player1", `${j}:j`)).toBe("discard");
  });

  it(`${id}: 追加条件 合体 — タイムジェットが1体でも欠けていればラッシュできない（出典: ${page}・R-ADD-06「すべて自軍エリアから捨札にする」）`, () => {
    expect(canStartRush(mk(cost, jets().slice(0, 4)), "player1", `${id}:r`)).toBe(false);
  });

  it(`${id}: 必要パワー${cost}+ — パワー${cost - 1}ではラッシュできない（出典: ${page}「必要パワー：${cost}+」）`, () => {
    expect(canStartRush(mk(cost - 1), "player1", `${id}:r`)).toBe(false);
  });

  // atwiki 転載 Q:「いいえ、そのようにはなりません。【死神のパーティータイムだ】はA〜Z（またはa〜z）の26文字を対象とします。」
  it(`${id}: Q&A — 仮面ライダーエターナル（XG6-041）【死神のパーティータイムだ】で BP−1000 されない（α・β・γ はアルファベットではない）（出典: ${page} Q&A）`, () => {
    const s = st({ player1: { battle: [inst(id, "r")], deck: deckCards(3) }, player2: { rush: [inst("XG6-041", "et")], deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", `${id}:r`)).toBe(DEFS[id]!.bp);
  });
}

/** α⇔β の【チェンジフォーメーション】共通。 */
function changeFormationTests(id: string, otherId: string, otherName: string, page: string) {
  const startState = (power: GameState["players"]["player1"]["power"]) =>
    st({ phase: "start", player1: { battle: [inst(id, "r")], power, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  it(`${id}: 【チェンジフォーメーション】バトルエリアからラッシュエリアに戻るとき、ダメージ以外の自軍パワーの「${otherName}」を選べる（ダメージ（ウラ向き）は不可）（出典: ${page}「ダメージ以外の自軍パワーから「${otherName}」のカードを1枚選び」）`, () => {
    let s = startState([inst(otherId, "p"), { ...inst(otherId, "dmg"), faceDown: true }, inst("TST-P", "x")]);
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    expect(choiceIds(s)).toEqual([`${otherId}:p`]);
  });

  it(`${id}: 置き換えると「${otherName}」がラッシュエリアに、これがパワーゾーンに置かれる（出典: ${page}「これと置き換えてもよい」）`, () => {
    let s = startState([inst(otherId, "p")]);
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
    s = pick(s, `${otherId}:p`);
    expect(zoneOf(s, "player1", `${otherId}:p`)).toBe("rush");
    expect(zoneOf(s, "player1", `${id}:r`)).toBe("power");
    expect(s.players.player1.power).toHaveLength(1);
  });

  it(`${id}: 任意 — 置き換えなければこれはそのままラッシュエリアに戻る（出典: ${page}「置き換えてもよい」）`, () => {
    let s = startState([inst(otherId, "p")]);
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
    if (s.pendingEffectChoice) s = skip(s);
    expect(zoneOf(s, "player1", `${id}:r`)).toBe("rush");
    expect(zoneOf(s, "player1", `${otherId}:p`)).toBe("power");
  });

  it(`${id}: パワーに「${otherName}」がなければ何も起きずに戻る（出典: ${page}）`, () => {
    let s = startState([inst("TST-P", "x")]);
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", `${id}:r`)).toBe("rush");
  });
}

describe("RS-394 タイムロボα", () => {
  const TEXT =
    "合体―タイムジェット1+タイムジェット2+タイムジェット3+タイムジェット4+タイムジェット5【チェンジフォーメーション】これがバトルエリアからラッシュエリアに戻るとき、ダメージ以外の自軍パワーから「タイムロボβ」のカードを1枚選び、これと置き換えてもよい。";

  it("RS-394: カタログ本文・スペックが出典と一致（カード名は公式 FAQ 表記「タイムロボα」）（出典: atwiki/page-518・grnrngr/faq-card-6 RS-394）", () => {
    expectCatalogText("RS-394", TEXT);
    expectStats("RS-394", {
      name: "タイムロボα",
      category: "OT",
      size: "L",
      bp: 22000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  fusionTests("RS-394", 6, "atwiki/page-518");
  changeFormationTests("RS-394", "RS-395", "タイムロボβ", "atwiki/page-518");

  // grnrngr/faq-card-6 RS-394 Q1:「はい、捨札にならずに済むことになります。」
  it.todo(
    "RS-394: 公式Q&A — 魔法猫スモーキー（RS-326）で出したβを、がんがんじい（RK-026）で戻すときにαと置き換えれば、αはスモーキーの効果で出したユニットとして扱われず、ターン終了時に捨札にならない — RS-203 ラー・デウスの特徴追加・RS-326・RK-026 の連鎖が必要なため保留（置き換え自体はスタートフェイズの戻しで実装済み）（出典: grnrngr/faq-card-6 RS-394 Q1）",
  );

  // grnrngr/faq-card-6 RS-394 Q2:「…戻したユニットとしては扱わず、再びバトルエリアに出ることができます。」
  it.todo(
    "RS-394: 公式Q&A — がんがんじいで戻すときに置き換えた相手（β）は「戻したユニット」として扱わず、同じターンに再びバトルエリアに出られる — ラー・デウスで特徴「仮面ライダー」を追加する連鎖が必要なため保留（置き換え自体はスタートフェイズの戻しで実装済み）（出典: grnrngr/faq-card-6 RS-394 Q2）",
  );
});

describe("RS-395 タイムロボβ", () => {
  const TEXT =
    "合体―タイムジェット1+タイムジェット2+タイムジェット3+タイムジェット4+タイムジェット5【チェンジフォーメーション】これがバトルエリアからラッシュエリアに戻るとき、ダメージ以外の自軍パワーから｢タイムロボα｣のカードを1枚選び、これと置き換えてもよい。";

  it("RS-395: カタログ本文・スペックが出典と一致（出典: atwiki/page-553）", () => {
    expectCatalogText("RS-395", TEXT);
    expectStats("RS-395", {
      name: "タイムロボβ",
      category: "OT",
      size: "L",
      bp: 8000,
      sp: 3,
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  fusionTests("RS-395", 6, "atwiki/page-553");
  changeFormationTests("RS-395", "RS-394", "タイムロボα", "atwiki/page-553");
});

describe("RS-396 タイムジェットγ", () => {
  const TEXT =
    "合体―タイムジェット1+タイムジェット2+タイムジェット3+タイムジェット4+タイムジェット5【ガンマトルネード】これをラッシュしたとき、本来のBPが5000以下の敵軍Sユニットをすべて持ち主のパワーゾーンに送る。その後、ダメージ以外の自軍パワーから｢タイムロボα｣または｢タイムロボβ｣のカードを1枚選び、これと置き換えてもよい。";

  it("RS-396: カタログ本文・スペックが出典と一致（出典: atwiki/page-554）", () => {
    expectCatalogText("RS-396", TEXT);
    expectStats("RS-396", {
      name: "タイムジェットγ",
      category: "OT",
      size: "L",
      bp: 17000,
      sp: undefined,
      powerCost: "8+",
      features: ["メカ", "航空機"],
      rushCondition: "discard_fusion_unit",
    });
  });

  fusionTests("RS-396", 8, "atwiki/page-554");

  const BIG = sUnit("SPEC-S6000", { bp: 6000 });
  const FIVE = sUnit("SPEC-S5000", { bp: 5000 });
  const gamma = (power: GameState["players"]["player1"]["power"] = powerCards(8)) => {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-396", "r")], rush: jets(), command: releasedCat("OT", 1), power, deck: deckCards(3) },
        player2: {
          battle: [inst("TST-UNIT-0", "b1"), inst("SPEC-S6000", "big"), inst("TST-UNIT-2", "m")],
          rush: [inst("SPEC-S5000", "r5")],
          deck: deckCards(3, "e"),
        },
      },
      [BIG, FIVE],
    );
    return rushFromHand(s, "player1", "RS-396:r");
  };

  it("RS-396: 【ガンマトルネード】ラッシュしたとき、本来の BP が5000以下の敵軍 S ユニットをすべて（バトル・ラッシュエリアとも）持ち主のパワーゾーンに送る（出典: atwiki/page-554「本来のBPが5000以下の敵軍Sユニットをすべて持ち主のパワーゾーンに送る」）", () => {
    const r = gamma();
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player2", "TST-UNIT-0:b1")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-S5000:r5")).toBe("power");
  });

  it("RS-396: 【ガンマトルネード】BP6000 の S ユニット・M ユニットは送られない（出典: atwiki/page-554「5000以下の敵軍Sユニット」）", () => {
    const s = resolveAll(gamma().state);
    expect(zoneOf(s, "player2", "SPEC-S6000:big")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("battle");
  });

  it("RS-396: その後、ダメージ以外の自軍パワーから「タイムロボα」または「タイムロボβ」を選んで置き換えられる（出典: atwiki/page-554「その後、…｢タイムロボα｣または｢タイムロボβ｣のカードを1枚選び、これと置き換えてもよい」）", () => {
    const power = [...powerCards(6), inst("RS-394", "pa"), inst("RS-395", "pb"), { ...inst("RS-394", "dmg"), faceDown: true }];
    let s = gamma(power).state;
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== "RS-396"; i++) s = resolveAll(s);
    expect(choiceIds(s)).toEqual(["RS-394:pa", "RS-395:pb"]);
    s = pick(s, "RS-395:pb");
    expect(zoneOf(s, "player1", "RS-395:pb")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-396:r")).toBe("power");
  });

  it("RS-396: 置き換えは任意 — 置き換えなければγはラッシュエリアに残る（出典: atwiki/page-554「置き換えてもよい」）", () => {
    const power = [...powerCards(7), inst("RS-394", "pa")];
    let s = gamma(power).state;
    for (let i = 0; i < 6 && s.pendingEffectChoice; i++) s = canSkip(s) ? skip(s) : resolveAll(s);
    expect(zoneOf(s, "player1", "RS-396:r")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-394:pa")).toBe("power");
  });
});
