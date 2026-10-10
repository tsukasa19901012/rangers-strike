/**
 * カード別スペック: RS-236〜RS-242（第4弾「四雄の覚醒」スーパーダイボウケン〜創造王リュウオーン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）
 *     ほか card_1/card_2/card_5/card_6/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  pick,
  powerCards,
  raw,
  released,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  tryAct,
  zoneOf,
} from "./RS4-222-242.helpers";
import type { CardInstance, GameState } from "../types/game";

const E9 = sUnit("SPEC-E9", { bp: 9000 });
const MECHA_S = sUnit("SPEC-MECHA", { bp: 7000, features: ["メカ"] });
const PLAIN_S = sUnit("SPEC-PLAIN", { bp: 7000 });
const SENTOUIN = sUnit("SPEC-SENTOUIN", { category: "DA", bp: 1000, powerCost: 2, features: ["戦闘員"] });
const SENTOUIN_P4 = sUnit("SPEC-SENTOUIN-P4", { category: "DA", bp: 1000, powerCost: 4, features: ["戦闘員"] });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000, powerCost: 2 });
const SPECS = [E9, MECHA_S, PLAIN_S, SENTOUIN, SENTOUIN_P4, DA_S];

// ===========================================================================
describe("RS-236 スーパーダイボウケン", () => {
  const TEXT =
    "合体―ダイボウケン（または、ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン）＋ゴーゴードリル＋ゴーゴーショベル＋ゴーゴーミキサー＋ゴーゴークレーン【ダブルアームクラッシュ】これはアタックとストライクを1度ずつ行ってもよい。";

  it("RS-236: カタログ本文・スペックが出典と一致（出典: atwiki/page-400）", () => {
    expectCatalogText("RS-236", TEXT);
    expectStats("RS-236", {
      name: "スーパーダイボウケン",
      category: "ET",
      size: "L",
      bp: 23000,
      sp: 3,
      powerCost: "7+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const FOUR = ["RS-171", "RS-172", "RS-173", "RS-174"];
  function sdbRush(rush: CardInstance[], power = 7) {
    return st({ phase: "rush", player1: { hand: [inst("RS-236", "sdb")], rush, command: [released("TST-OP-ET", "et")], power: powerCards(power) } });
  }

  // 「合体―ダイボウケン（または…）＋ゴーゴードリル＋ゴーゴーショベル＋ゴーゴーミキサー＋ゴーゴークレーン」
  it("RS-236: ダイボウケン＋ドリル・ショベル・ミキサー・クレーンを捨札にしてラッシュできる（出典: atwiki/page-400・R-ADD-06）", () => {
    const r = rushFromHand(sdbRush([inst("RS-117", "db"), ...FOUR.map((id) => inst(id, "m"))]), "player1", "RS-236:sdb");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-236:sdb")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("RS-236: ダイボウケンのかわりにダンプ・フォーミュラ・ジャイロ・ドーザー・マリンの5体でもラッシュできる（出典: atwiki/page-400「（または、…）」）", () => {
    const five = ["RS-118", "RS-119", "RS-120", "RS-121", "RS-122"].map((id) => inst(id, "v"));
    const r = rushFromHand(sdbRush([...five, ...FOUR.map((id) => inst(id, "m"))]), "player1", "RS-236:sdb");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-236:sdb")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(9);
  });

  it("RS-236: 合体ユニットが1体でも欠けて（クレーンがない）いればラッシュできない（出典: atwiki/page-400）", () => {
    const s = sdbRush([inst("RS-117", "db"), ...FOUR.slice(0, 3).map((id) => inst(id, "m"))]);
    expect(canStartRush(s, "player1", "RS-236:sdb")).toBe(false);
  });

  it("RS-236: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-400）", () => {
    const s = sdbRush([inst("RS-117", "db"), ...FOUR.map((id) => inst(id, "m"))], 6);
    expect(rushFromHand(s, "player1", "RS-236:sdb").ok).toBe(false);
  });

  // 「これはアタックとストライクを1度ずつ行ってもよい。」
  it("RS-236: アタックした後にストライクもできる（出典: atwiki/page-400）", () => {
    let s = st({ player1: { rush: [inst("RS-236", "sdb")] }, player2: { battle: [inst("TST-UNIT-0", "e")], power: powerCards(5, "ep") } });
    s = enter(s, "RS-236:sdb");
    s = settle(attack(s, "RS-236:sdb", "TST-UNIT-0:e"));
    expect(canStrike(s, "RS-236:sdb")).toBe(true);
    s = settle(strike(s, "RS-236:sdb"));
    expect(s.players.player2.damage).toBe(3);
    expect(canStrike(s, "RS-236:sdb")).toBe(false);
  });

  it("RS-236: ストライクした後にアタックもできる（出典: atwiki/page-400）", () => {
    let s = st({ player1: { rush: [inst("RS-236", "sdb")] }, player2: { battle: [inst("TST-UNIT-0", "e")], power: powerCards(5, "ep") } });
    s = enter(s, "RS-236:sdb");
    s = settle(strike(s, "RS-236:sdb"));
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-236:sdb")).toBe(true);
  });

  it("RS-236: ほかの L ユニットはアタックした後にストライクできない（出典: atwiki/page-400・R-ATK 一般則）", () => {
    let s = st({ player1: { rush: [inst("TST-UNIT-7", "L")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    s = enter(s, "TST-UNIT-7:L");
    s = settle(attack(s, "TST-UNIT-7:L", "TST-UNIT-0:e"));
    expect(canStrike(s, "TST-UNIT-7:L")).toBe(false);
  });

  it.todo(
    "RS-236: 公式Q&A — 魔法猫スモーキーで出したダイボウケンを、キリンレンジャーの時間返しの後に合体ユニットとして捨札にしてラッシュしたスーパーダイボウケンは、ターンを終えるとき捨札にならない（出典: grnrngr/faq-card-4 RS-236 Q1・faq-card-2/5）— スモーキー（RS-326）の効果→キリンレンジャー（RS-208）の時間返しでラッシュフェイズに戻る流れを公開 API で組み立てられなかった",
  );
});

// ===========================================================================
describe("RS-237 サイレンビルダー", () => {
  const TEXT =
    "合体―ゴーゴーファイヤー＋ゴーゴーポリス＋ゴーゴーエイダー【トリプルリキッドボンバー】自軍ターン中、これがバトルエリアに出たとき、敵軍山札の上から3枚をオモテにしてもよい。そうしたとき、相手はオモテにしたカードの中から好きな数選び手札に加える。このとき相手が手札に加えたカード1枚につき、これは「SP+1」される。その後、残りのカードは捨札にする。";

  it("RS-237: カタログ本文・スペックが出典と一致（出典: atwiki/page-402）", () => {
    expectCatalogText("RS-237", TEXT);
    expectStats("RS-237", {
      name: "サイレンビルダー",
      category: "ET",
      size: "L",
      bp: 9000,
      sp: "special",
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-237: 合体ユニット（ファイヤー＋ポリス＋エイダー）を捨札にしてラッシュでき、2体では満たせない（出典: atwiki/page-402・R-ADD-06）", () => {
    const mk = (rush: CardInstance[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-237", "sb")], rush, command: [released("TST-OP-ET", "et")], power: powerCards(6) } });
    expect(canStartRush(mk([inst("RS-238", "f"), inst("RS-239", "p")]), "player1", "RS-237:sb")).toBe(false);
    const r = rushFromHand(mk([inst("RS-238", "f"), inst("RS-239", "p"), inst("RS-240", "a")]), "player1", "RS-237:sb");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-237:sb")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(3);
  });

  function siren(enemyDeck: CardInstance[]) {
    const s = st({ player1: { rush: [inst("RS-237", "sb")] }, player2: { deck: enemyDeck, power: powerCards(5, "ep") } });
    return enter(s, "RS-237:sb");
  }
  const top3 = () => [inst("TST-OP", "t0"), inst("TST-OP", "t1"), inst("TST-OP", "t2"), inst("TST-OP", "t3")];

  /** 相手（player2）が ids を手札に加えるよう選んで確定する。 */
  function opponentTakes(s: GameState, ids: string[]): GameState {
    let n = s;
    for (const id of ids) n = act(n, { type: "resolve_effect_choice", playerId: "player2", instanceId: id });
    if (n.pendingEffectChoice?.playerId === "player2") {
      const c = tryAct(n, { type: "confirm_effect_choice", playerId: "player2" });
      n = c.ok ? c.state : act(n, { type: "skip_effect_choice", playerId: "player2" });
    }
    return n;
  }

  // 「敵軍山札の上から3枚をオモテにしてもよい。そうしたとき、相手は…好きな数選び手札に加える。…1枚につき、これは「SP+1」される。その後、残りのカードは捨札にする」
  it("RS-237: 敵軍山札の上から3枚をオモテにし、相手が2枚を手札に加えると「SP2」になり、残り1枚は捨札（出典: atwiki/page-402）", () => {
    let s = siren(top3());
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP:t0", "TST-OP:t1", "TST-OP:t2"]);
    s = opponentTakes(s, ["TST-OP:t0", "TST-OP:t2"]);
    expect(s.players.player2.hand.map((c) => c.instanceId).sort()).toEqual(["TST-OP:t0", "TST-OP:t2"]);
    expect(zoneOf(s, "player2", "TST-OP:t1")).toBe("discard");
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-OP:t3"]);
    expect(spOf(s, "player1", "RS-237:sb")).toBe(2);
    expect(canStrike(s, "RS-237:sb")).toBe(true);
  });

  it("RS-237: 相手が1枚も手札に加えなければ SP！のまま（ストライクできない）で、3枚とも捨札（出典: atwiki/page-402「好きな数」）", () => {
    let s = siren(top3());
    s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = opponentTakes(s, []);
    expect(s.players.player2.hand).toHaveLength(0);
    expect(s.players.player2.discard).toHaveLength(3);
    expect(canStrike(s, "RS-237:sb")).toBe(false);
  });

  it("RS-237: オモテにしないことを選べる（任意）（出典: atwiki/page-402「オモテにしてもよい」）", () => {
    let s = siren(top3());
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player2.deck).toHaveLength(4);
    expect(s.players.player2.hand).toHaveLength(0);
    expect(canStrike(s, "RS-237:sb")).toBe(false);
  });

  // faq-card-4 RS-237 Q1「「３枚オモテにする」ことが発動の条件ですので、敵軍山札が２枚以下のときは、その効果は発動できません。」
  it("RS-237: 公式Q&A — 敵軍山札が2枚以下なら発動できない（出典: grnrngr/faq-card-4 RS-237 Q1）", () => {
    const s = siren([inst("TST-OP", "t0"), inst("TST-OP", "t1")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-237");
    expect(s.players.player2.deck).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-238 ゴーゴーファイヤー", () => {
  const TEXT =
    "【プロジェットカノン】これが自軍ラッシュエリアにある間、敵軍ターン中、自軍コマンドゾーンのカードがコマンドゾーンを離れたとき、自軍捨札からカードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい。";

  it("RS-238: カタログ本文・スペックが出典と一致（出典: atwiki/page-403）", () => {
    expectCatalogText("RS-238", TEXT);
    expectStats("RS-238", {
      name: "ゴーゴーファイヤー",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  // 「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」
  it("RS-238: 追加条件 — 自軍 S ユニットを1体コマンドゾーンに送ってラッシュできる（出典: atwiki/page-403）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-238", "f")], rush: [inst("TST-UNIT-0", "s")], command: [released("TST-OP-ET", "et")], power: powerCards(3) } });
    const r = rushFromHand(s, "player1", "RS-238:f", { destination: "command" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-238:f")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("command");
  });

  it("RS-238: 追加条件 — 自軍 S ユニットを1体捨札にしてもラッシュでき、S ユニットがいなければラッシュできない（出典: atwiki/page-403）", () => {
    const mk = (rush: CardInstance[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-238", "f")], rush, command: [released("TST-OP-ET", "et")], power: powerCards(3) } });
    expect(canStartRush(mk([]), "player1", "RS-238:f")).toBe(false);
    const r = rushFromHand(mk([inst("TST-UNIT-0", "s")]), "player1", "RS-238:f", { destination: "discard" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  /**
   * 敵軍（player2）のターン、player2 のボウケンブルー（CN5）が5番目に出て【ブロウナックル】を使う。
   * player1（ゴーゴーファイヤーの持ち主）のリリース状態のコマンドも手札に戻る。
   */
  function blowKnuckle(p1: Partial<GameState["players"]["player1"]>) {
    let s = st({
      activePlayer: "player2",
      player1: { deck: deckCards(3), ...p1 },
      player2: { battle: fillers(4, "ef"), rush: [inst("RS-064", "bb")], command: [released("TST-OP", "e0")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-064:bb", "player2");
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const c = tryAct(s, { type: "confirm_effect_choice", playerId: "player2" });
      s = c.ok ? c.state : pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    return s;
  }

  // 「敵軍ターン中、自軍コマンドゾーンのカードがコマンドゾーンを離れたとき、自軍捨札からカードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい」
  it("RS-238: 敵軍ターン中、自軍コマンドがコマンドゾーンを離れたとき、自軍捨札のカードを1枚ホールド状態でコマンドゾーンに置ける（出典: atwiki/page-403）", () => {
    let s = blowKnuckle({ rush: [inst("RS-238", "f")], command: [released("TST-OP", "c0")], discard: [inst("TST-UNIT-0", "d0")] });
    expect(zoneOf(s, "player1", "TST-OP:c0")).toBe("hand");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "TST-UNIT-0:d0");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d0")).toBe("command");
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-UNIT-0:d0")?.commandHeld).toBe(true);
  });

  it("RS-238: 置かないことを選べる（任意）（出典: atwiki/page-403「置いてもよい」）", () => {
    let s = blowKnuckle({ rush: [inst("RS-238", "f")], command: [released("TST-OP", "c0")], discard: [inst("TST-UNIT-0", "d0")] });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:d0")).toBe("discard");
  });

  it("RS-238: ゴーゴーファイヤーが自軍ラッシュエリアになければ（バトルエリアにある）置けない（出典: atwiki/page-403「これが自軍ラッシュエリアにある間」）", () => {
    const s = blowKnuckle({ battle: [inst("RS-238", "f")], command: [released("TST-OP", "c0")], discard: [inst("TST-UNIT-0", "d0")] });
    expect(zoneOf(s, "player1", "TST-OP:c0")).toBe("hand");
    expect(s.pendingEffectChoice?.playerId).not.toBe("player1");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d0")).toBe("discard");
  });

  // faq-card-4 RS-238 Q6「コマンドからカードが離れるたびに捨札からコマンドゾーンに置くことができますので、結果的に離れたのと同じ枚数を置くことができます」
  it("RS-238: 公式Q&A — ブロウナックルで複数枚（2枚）が離れたら、同じ枚数（2枚）を捨札から置ける（出典: grnrngr/faq-card-4 RS-238 Q6・faq-card-1 RS-064）", () => {
    let s = blowKnuckle({
      rush: [inst("RS-238", "f")],
      command: [released("TST-OP", "c0"), released("TST-OP", "c1")],
      discard: [inst("TST-UNIT-0", "d0"), inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")],
    });
    s = pick(s, "TST-UNIT-0:d0");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "TST-UNIT-0:d1");
    expect(s.players.player1.command.map((c) => c.instanceId).sort()).toEqual(["TST-UNIT-0:d0", "TST-UNIT-0:d1"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:d2")).toBe("discard");
  });

  // faq-card-4 RS-238 Q3「はい、その通りです。」（2体いれば1枚離れるごとに2枚置く）
  it("RS-238: 公式Q&A — ゴーゴーファイヤーが自軍ラッシュエリアに2体あれば、1枚離れたとき捨札から2枚置ける（出典: grnrngr/faq-card-4 RS-238 Q3）", () => {
    let s = blowKnuckle({
      rush: [inst("RS-238", "f"), inst("RS-238", "f2")],
      command: [released("TST-OP", "c0")],
      discard: [inst("TST-UNIT-0", "d0"), inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")],
    });
    s = pick(s, "TST-UNIT-0:d0");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "TST-UNIT-0:d1");
    expect(s.players.player1.command).toHaveLength(2);
  });

  // faq-card-4 RS-238 Q2「はい、できます。「RS-102 サーガイン」で捨札になった場合も同様で、パワーゾーンから捨札になったカードも、コマンドゾーンに置くことができます。」
  it("RS-238: 公式Q&A — 敵軍サーガインで自軍コマンドとパワーが捨札になったとき、そのコマンドのカードも、捨札になったパワーのカードも選んで置ける（出典: grnrngr/faq-card-4 RS-238 Q2）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-238", "f")], command: [released("TST-OP", "c0")], power: [inst("TST-P", "pw")], deck: deckCards(3) },
      player2: { battle: fillers(4, "ef"), rush: [inst("RS-102", "sg")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-102:sg", "player2");
    s = drain(drain(s, "player2", ["TST-P:pw", "TST-OP:c0"]), "player2", ["TST-OP:c0"]);
    expect(zoneOf(s, "player1", "TST-OP:c0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:pw")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-OP:c0", "TST-P:pw"]);
  });

  // faq-card-4 RS-238 Q4「「ターンを終えるとき」はまだ自分のターンですので、「敵軍ターン中」とある…効果は適用されません。」
  it("RS-238: 公式Q&A — アドベンチャーで自分のターンを終えるときにコマンドが手札に戻っても置けない（自軍ターン中）（出典: grnrngr/faq-card-4 RS-238 Q4）", () => {
    let s = st({
      player1: {
        rush: [inst("RS-238", "f")],
        command: [held("TST-OP", "c0")],
        operation: [inst("RS-030", "adv")],
        discard: [inst("TST-UNIT-0", "d0")],
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });
    s = endTurn(s);
    s = drain(s, "player1", ["TST-OP:c0"]);
    expect(zoneOf(s, "player1", "TST-OP:c0")).toBe("hand");
    expect(s.pendingEffectChoice?.effectId).not.toBe("command_leave_refill_from_discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d0")).toBe("discard");
  });

  it.todo(
    "RS-238: 公式Q&A — 天雷旋風神【アルティマストーム】でコマンドから先に山札に戻すなら【プロジェットカノン】を使える（ユニットから先ならダイノガッツを使える）（出典: grnrngr/faq-card-4 RS-238 Q1）— 天雷旋風神（RS-566）の戻す順番を公開 API で選べない",
  );

  it.todo(
    "RS-238: 公式Q&A（相互参照）— メカニック忍者でコマンドゾーンのカードがラッシュエリアに出たときも【プロジェットカノン】を発動でき、その後アタックされたユニットをコマンドゾーンに置ける（ライア併用時は2回）（出典: grnrngr/faq-rider-1 RK-008・RK-036）— メカニック忍者（RK-008）の処理途中に割り込む順番は RK 系の担当範囲で、公開 API での組み立てを確認できなかった",
  );

  it.todo(
    "RS-238: 公式Q&A（相互参照）— バルパンサー（2nd）の NC 中にゴーゴーファイヤーで置いたユニットカードを捨札にでき、繰り返しはターンプレイヤーが処理順を選ぶ（出典: grnrngr/faq-card-6 RS-363）— バルパンサー（2nd）側の挙動は RS-363 の担当範囲",
  );
});

// ===========================================================================
describe("RS-239 ゴーゴーポリス", () => {
  it("RS-239: カタログ本文（なし）・スペックが出典と一致（出典: atwiki/page-404）", () => {
    expectCatalogText("RS-239", "なし");
    expectStats("RS-239", {
      name: "ゴーゴーポリス",
      category: "ET",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: "L" as never,
      features: ["メカ", "車両"],
    });
  });

  it("RS-239: 必要パワー3・追加条件なし — パワー3でラッシュでき、2ではできない（出典: atwiki/page-404）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-239", "p")], command: [released("TST-OP-ET", "et")], power: powerCards(n) } });
    expect(canStartRush(mk(2), "player1", "RS-239:p")).toBe(false);
    const r = rushFromHand(mk(3), "player1", "RS-239:p");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-239:p")).toBe("rush");
  });

  it("RS-239: SP がないのでストライクできない（アタックはできる）（出典: atwiki/page-404「SP：－」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-239", "p")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } }), "RS-239:p");
    expect(canStrike(s, "RS-239:p")).toBe(false);
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-239:p")).toBe(true);
  });
});

// ===========================================================================
describe("RS-240 ゴーゴーエイダー", () => {
  it("RS-240: カタログ本文（なし）・スペックが出典と一致（出典: atwiki/page-405）", () => {
    expectCatalogText("RS-240", "なし");
    expectStats("RS-240", {
      name: "ゴーゴーエイダー",
      category: "ET",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: "R" as never,
      features: ["メカ", "車両"],
    });
  });

  it("RS-240: 必要パワー3・追加条件なし — パワー3でラッシュでき、2ではできない（出典: atwiki/page-405）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-240", "a")], command: [released("TST-OP-ET", "et")], power: powerCards(n) } });
    expect(canStartRush(mk(2), "player1", "RS-240:a")).toBe(false);
    const r = rushFromHand(mk(3), "player1", "RS-240:a");
    expect(r.ok).toBe(true);
  });

  it("RS-240: SP がないのでストライクできない（出典: atwiki/page-405「SP：－」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-240", "a")] } }), "RS-240:a");
    expect(canStrike(s, "RS-240:a")).toBe(false);
  });
});

// ===========================================================================
describe("RS-241 ボウケンレッドAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「ボウケンレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【デュアルクラッシャー・ドリルヘッド】これは特徴「メカ」を持つユニットにアタックするときBP＋4000される。";

  it("RS-241: カタログ本文・スペックが出典と一致（出典: atwiki/page-29）", () => {
    expectCatalogText("RS-241", TEXT);
    expectStats("RS-241", {
      name: "ボウケンレッドAT",
      category: "ET",
      size: "S",
      bp: 4500,
      sp: 1,
      powerCost: "7-",
      comboNumber: 5,
      features: ["レッド", "男", "アクセルテクター"],
      rushCondition: "zord_down_discard_named",
    });
  });

  function attackedInEnemyTurn(p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-241", "at")], deck: deckCards(5), ...p1 },
        player2: { battle: [inst("SPEC-E9", "atk")], deck: deckCards(5, "e"), ...p2 },
      },
      SPECS,
    );
    return settle(attack(s, "SPEC-E9:atk", "RS-241:at", "player2"));
  }
  function resolveAll(s0: GameState, prefer: string[] = []) {
    let s = s0;
    for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player1", prefer), "player2"));
    return s;
  }

  // 「※これが撃破されて捨札になったとき、自軍捨札に「ボウケンレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。」
  it("RS-241: ※ 撃破されて捨札になったとき、自軍捨札のボウケンレッドを1枚選び自軍ラッシュエリアに出す（出典: atwiki/page-29）", () => {
    const s = resolveAll(attackedInEnemyTurn({ discard: [inst("TST-UNIT-0", "other"), inst("RS-062", "bk")] }), ["RS-062:bk"]);
    expect(zoneOf(s, "player1", "RS-241:at")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-062:bk")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  it("RS-241: ※ 選べるのはボウケンレッドのカードだけで、出さないことは選べない（出典: atwiki/page-29「「ボウケンレッド」のカード」「出す」）", () => {
    let s = attackedInEnemyTurn({ discard: [inst("TST-UNIT-0", "other"), inst("RS-062", "bk")] });
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== "RS-241"; i++) s = settle(drain(drain(s, "player2"), "player1"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-241");
    expect(choiceIds(s)).toEqual(["RS-062:bk"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-241: ※ 自軍捨札にボウケンレッドがなければ何も出さない（出典: atwiki/page-29「カードがあれば」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ discard: [inst("TST-UNIT-0", "other")] }));
    expect(zoneOf(s, "player1", "RS-241:at")).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it("RS-241: 追加条件 — 自軍「ボウケンレッド」1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-29）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-241", "at")], rush: [inst("RS-062", "bk")], command: [released("TST-OP-ET", "et")], power: [] } });
    const r = rushVia(s, "player1", "RS-241:at", (a) => a.zordMaterialInstanceId === "RS-062:bk");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-241:at")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-062:bk")).toBe("discard");
  });

  it("RS-241: 必要パワー7- — ボウケンレッドがいなければパワー7でラッシュでき、6ではできない（出典: atwiki/page-29）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-241", "at")], command: [released("TST-OP-ET", "et")], power: powerCards(n) } });
    expect(canStartRush(mk(6), "player1", "RS-241:at")).toBe(false);
    expect(rushFromHand(mk(7), "player1", "RS-241:at").ok).toBe(true);
  });

  it("RS-241: SP1（印刷値）— どの並び順でもストライクできる（出典: atwiki/page-29「SP：1」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-241", "at")] } }), "RS-241:at");
    expect(spOf(s, "player1", "RS-241:at")).toBe(1);
    expect(canStrike(s, "RS-241:at")).toBe(true);
  });

  /** AT を pos 番目に出して BP7000 の敵軍 S ユニット（メカ／メカでない）にアタックする。 */
  function drillAttack(pos: number, target: "SPEC-MECHA" | "SPEC-PLAIN") {
    let s = st({ player1: { battle: fillers(pos - 1), rush: [inst("RS-241", "at")] }, player2: { battle: [inst(target, "d")] } }, SPECS);
    s = enter(s, "RS-241:at");
    return settle(attack(s, "RS-241:at", `${target}:d`));
  }

  // 「【デュアルクラッシャー・ドリルヘッド】これは特徴「メカ」を持つユニットにアタックするときBP＋4000される」（CN5）
  // 既知の不具合: CARD-RS-241【デュアルクラッシャー・ドリルヘッド】が働かない（メカへのアタックで BP+4000 されない）
  it.fails("RS-241: 5番目に出て NC が成立していれば、特徴「メカ」を持つユニットにアタックするとき BP8500 になり BP7000 に勝つ（出典: atwiki/page-29）", () => {
    const s = drillAttack(5, "SPEC-MECHA");
    expect(zoneOf(s, "player2", "SPEC-MECHA:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-241:at")).toBe("battle");
  });

  it("RS-241: 特徴「メカ」を持たないユニットへのアタックでは BP+4000 されない（BP4500 で負ける）（出典: atwiki/page-29「特徴「メカ」を持つユニットに」）", () => {
    const s = drillAttack(5, "SPEC-PLAIN");
    expect(zoneOf(s, "player1", "RS-241:at")).toBe("discard");
  });

  // CN5 の欄の効果なので NC が成立していなければ働かない（R-CN-02）。
  // 注: 効果本体が未実装のため現状は空振りで通る（本体は上の it.fails を参照）。
  it("RS-241: 5番目以外（1番目）に出たときは働かず、メカの BP7000 に負ける（出典: atwiki/page-29「CN：5」・R-CN-02）", () => {
    const s = drillAttack(1, "SPEC-MECHA");
    expect(zoneOf(s, "player1", "RS-241:at")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MECHA:d")).toBe("battle");
  });

  it("RS-241: BP+4000 はアタックするときだけ（場にいるだけでは BP4500）（出典: atwiki/page-29「アタックするとき」）", () => {
    const s = enter(st({ player1: { battle: fillers(4), rush: [inst("RS-241", "at")] } }), "RS-241:at");
    expect(bpOf(s, "player1", "RS-241:at")).toBe(4500);
  });

  // faq-card-4 RS-241 Q1「はい、その通りです。」
  it("RS-241: 公式Q&A — 超電子レーダーがあるとき、捨札から出したボウケンレッドについて持ち主はパワーゾーンの表向きのパワーを1枚手札に加える（出典: grnrngr/faq-card-4 RS-241 Q1）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ discard: [inst("RS-062", "bk")], power: powerCards(2, "own") }, { operation: [inst("RS-124", "radar")] }),
      ["RS-062:bk"],
    );
    expect(zoneOf(s, "player1", "RS-062:bk")).toBe("rush");
    expect(s.players.player1.hand.filter((c) => c.cardId === "TST-P")).toHaveLength(1);
    expect(s.players.player1.power).toHaveLength(1);
  });

  it.todo(
    "RS-241: 公式Q&A — 自軍コマンドゾーンのボウケンレッドとボウケンレッドAT をランドバルカンで出すとき、ボウケンレッドを出した後それを捨札にして AT を出せる（出典: grnrngr/faq-card-4 RS-241 Q2）— ランドバルカン（RS-005）で出すユニットの追加条件（ゾードダウン）を1体ずつ満たす手順を公開 API で確認できなかった（RS-005 の担当範囲）",
  );

  // faq-rider-1 RK-003「はい、戻します。」
  it.todo(
    "RS-241: 公式Q&A（相互参照）— カイゾーグで撃破されて捨札になった AT を山札の下に戻しても、捨札のボウケンレッドはラッシュエリアに戻す（出典: grnrngr/faq-rider-1 RK-003）— カイゾーグ（RK-003）の発動手順は RK 系の担当範囲で、公開 API での組み立てを確認できなかった",
  );
});

// ===========================================================================
describe("RS-242 創造王リュウオーン", () => {
  const TEXT =
    "※これは自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない。【ジャリュウ一族の侵攻】これが自軍ラッシュエリアにある間、自分が特徴「戦闘員」を持つユニットのカードをラッシュするとき、コマンドをホールドせずにラッシュしてもよい。ただしラッシュのための必要パワーと追加条件は満たすこと。";

  it("RS-242: カタログ本文・スペックが出典と一致（出典: atwiki/page-56）", () => {
    expectCatalogText("RS-242", TEXT);
    expectStats("RS-242", {
      name: "創造王リュウオーン",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: 5,
      features: ["ジャリュウ一族", "男"],
    });
  });

  // 「※これは自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない。」
  it("RS-242: ※ 自軍ラッシュエリアの S ユニットを1体捨札にしてバトルエリアに出る（出典: atwiki/page-56）", () => {
    let s = st({ player1: { rush: [inst("RS-242", "ryu"), inst("TST-UNIT-0", "s"), inst("TST-UNIT-2", "m")] } });
    expect(canEnter(s, "RS-242:ryu")).toBe(true);
    s = raw(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-242:ryu" });
    if (s.pendingEffectChoice?.playerId === "player1") {
      expect(choiceIds(s)).toEqual(["TST-UNIT-0:s"]);
      s = pick(s, "TST-UNIT-0:s");
    }
    if (zoneOf(s, "player1", "RS-242:ryu") === "rush") s = raw(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-242:ryu" });
    expect(zoneOf(s, "player1", "RS-242:ryu")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-2:m")).toBe("rush");
  });

  it("RS-242: ※ 自軍ラッシュエリアにほかの S ユニットがなければ（M ユニットだけ）出られない（出典: atwiki/page-56）", () => {
    const s = st({ player1: { rush: [inst("RS-242", "ryu"), inst("TST-UNIT-2", "m")], battle: [inst("TST-UNIT-0", "b")] } });
    expect(canEnter(s, "RS-242:ryu")).toBe(false);
  });

  function jaryuRush(hand: CardInstance[], opts: { command?: CardInstance[]; power?: number; withRyu?: boolean } = {}) {
    return st(
      {
        phase: "rush",
        player1: {
          rush: opts.withRyu === false ? [] : [inst("RS-242", "ryu")],
          hand,
          command: opts.command ?? [],
          power: powerCards(opts.power ?? 3),
        },
      },
      SPECS,
    );
  }

  // 「自分が特徴「戦闘員」を持つユニットのカードをラッシュするとき、コマンドをホールドせずにラッシュしてもよい」
  it("RS-242: 自軍コマンドがなくても、特徴「戦闘員」を持つユニット（ジャリュウ兵）をコマンドをホールドせずにラッシュできる（出典: atwiki/page-56）", () => {
    const s = jaryuRush([inst("RS-338", "j")]);
    expect(canStartRush(s, "player1", "RS-338:j")).toBe(true);
    const r = legal(s).find((a) => (a.type === "rush" && a.instanceId === "RS-338:j") || (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-338:j"));
    const next = act(s, r!);
    expect(zoneOf(next, "player1", "RS-338:j")).toBe("rush");
  });

  it("RS-242: 「戦闘員」を持たない DA の S ユニットは、コマンドがなければラッシュできない（出典: atwiki/page-56「特徴「戦闘員」を持つユニット」）", () => {
    const s = jaryuRush([inst("SPEC-DA-S", "d")]);
    expect(canStartRush(s, "player1", "SPEC-DA-S:d")).toBe(false);
  });

  it("RS-242: リュウオーンが自軍ラッシュエリアになければ、戦闘員もコマンドなしではラッシュできない（出典: atwiki/page-56「これが自軍ラッシュエリアにある間」）", () => {
    const s = jaryuRush([inst("SPEC-SENTOUIN", "j")], { withRyu: false });
    expect(canStartRush(s, "player1", "SPEC-SENTOUIN:j")).toBe(false);
  });

  it("RS-242: 必要パワーは満たす必要がある（パワー3で必要パワー4の戦闘員はラッシュできない）（出典: atwiki/page-56「ただしラッシュのための必要パワー…は満たすこと」）", () => {
    const s = jaryuRush([inst("SPEC-SENTOUIN-P4", "j")]);
    expect(canStartRush(s, "player1", "SPEC-SENTOUIN-P4:j")).toBe(false);
  });

  it("RS-242: コマンドをホールドして（ふつうに）ラッシュすることもできる（出典: atwiki/page-56「ホールドせずにラッシュしてもよい」）", () => {
    const s = jaryuRush([inst("SPEC-SENTOUIN", "j")], { command: [released("TST-OP-DA", "da")] });
    const r = rushFromHand(s, "player1", "SPEC-SENTOUIN:j");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-SENTOUIN:j")).toBe("rush");
    expect(r.state.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // faq-card-4 RS-242 Q1「手札にあれば何体でもラッシュすることができます。」
  it("RS-242: 公式Q&A — 手札の戦闘員を何体でも（3体）コマンドをホールドせずにラッシュできる（出典: grnrngr/faq-card-4 RS-242 Q1）", () => {
    let s = jaryuRush([inst("RS-338", "j0"), inst("RS-338", "j1"), inst("RS-338", "j2")]);
    for (const id of ["RS-338:j0", "RS-338:j1", "RS-338:j2"]) {
      const a = legal(s).find((x) => (x.type === "rush" && x.instanceId === id) || (x.type === "initiate_command_payment" && x.sourceInstanceId === id));
      s = act(s, a!);
    }
    expect(s.players.player1.rush.filter((c) => c.cardId === "RS-338")).toHaveLength(3);
  });

  /** player1 のデンジピンク（CN1）【デンジサンダー投げ】で、player2 は自分のラッシュエリアの S ユニットを1体選びバトルエリアに出す。 */
  function thunderThrow(p2rush: CardInstance[]) {
    let s = st({ player1: { rush: [inst("RS-358", "dp")] }, player2: { rush: p2rush } });
    s = enter(s, "RS-358:dp");
    return s;
  }

  // faq-card-4 RS-242 Q2「ラッシュエリアに「RS-242 創造王リュウオーン」１体しかいない…ラッシュエリアに留まることになります」
  it("RS-242: 公式Q&A — 自軍ラッシュエリアのユニットがリュウオーン1体だけのとき、相手の効果でバトルエリアに出ることになってもラッシュエリアに留まる（捨札にならない）（出典: grnrngr/faq-card-4 RS-242 Q2）", () => {
    let s = thunderThrow([inst("RS-242", "ryu")]);
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const p = s.pendingEffectChoice;
      s = p.validInstanceIds.includes("RS-242:ryu") ? pick(s, "RS-242:ryu") : skip(s);
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-242:ryu")).toBe("rush");
  });

  // 同 Q2 後段「２体いるときは、１体を捨札にすることでもう１体がバトルエリアに出られるようになると考えますので、１体を捨札にして、もう１体をバトルエリアに出します。」
  it("RS-242: 公式Q&A — リュウオーンが2体いれば、1体を捨札にしてもう1体をバトルエリアに出す（出典: grnrngr/faq-card-4 RS-242 Q2 後段）", () => {
    let s = thunderThrow([inst("RS-242", "r1"), inst("RS-242", "r2")]);
    for (let i = 0; i < 6 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const p = s.pendingEffectChoice;
      s = p.validInstanceIds.includes("RS-242:r1") ? pick(s, "RS-242:r1") : pick(s, p.validInstanceIds[0]!);
    }
    s = settle(s);
    const zones = [zoneOf(s, "player2", "RS-242:r1"), zoneOf(s, "player2", "RS-242:r2")].sort();
    expect(zones).toEqual(["battle", "discard"]);
  });

  it.todo(
    "RS-242: 公式Q&A — 大帝ラー・デウス【デウス遺伝子】で「戦闘員」が追加されても、手札のカードはユニットではないので【ジャリュウ一族の侵攻】でラッシュできない（出典: grnrngr/faq-card-4 RS-242 Q3）— 【ジャリュウ一族の侵攻】自体が未実装（上の it.fails）のため、否定側だけを確認しても意味がない",
  );
});
