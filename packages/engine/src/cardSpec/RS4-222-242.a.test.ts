/**
 * カード別スペック: RS-222〜RS-229（第4弾「四雄の覚醒」タイムピンク〜爆竜ブラキオサウルス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS227）、grnrngr/faq-card-4（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）
 *     ほか card_1/card_2/card_3/card_5/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  confirm,
  deckCards,
  drain,
  endTurn,
  enter,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  raw,
  released,
  releasedN,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  tryAct,
  useCard,
  zoneOf,
} from "./RS4-222-242.helpers";
import type { GameState } from "../types/game";

const MA_L = sUnit("SPEC-MA-L", { size: "L", category: "MA", bp: 13000, sp: 1, powerCost: "6+" });
const WB_L = sUnit("SPEC-WB-L", { size: "L", category: "WB", bp: 13000, sp: 1, powerCost: "6+" });
const MA_M = sUnit("SPEC-MA-M", { size: "M", category: "MA", bp: 4000, sp: 1 });
const MA_S = sUnit("SPEC-MA-S", { size: "S", category: "MA", bp: 2000, sp: 1 });
const WB_M = sUnit("SPEC-WB-M", { size: "M", category: "WB", bp: 4000, powerCost: 2 });
const ET_M = sUnit("SPEC-ET-M", { size: "M", category: "ET", bp: 4000, powerCost: 2 });
const SPECS = [MA_L, WB_L, MA_M, MA_S, WB_M, ET_M];

// ===========================================================================
describe("RS-222 タイムピンク", () => {
  const TEXT =
    "【戦闘指揮】「SP1」自軍ターン中、Sユニットがこのユニットからコンビネーションするとき、そのユニットのＮＣの効果は、ナンバーに関係なく発動できる。ただし、そのユニットのナンバーと同じ数だけ敵軍コマンドをリリースしなければならない。";

  it("RS-222: カタログ本文・スペックが出典と一致（出典: atwiki/page-414）", () => {
    expectCatalogText("RS-222", TEXT);
    expectStats("RS-222", {
      name: "タイムピンク",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 4,
      features: ["ピンク", "女", "警察", "加速"],
    });
  });

  /** タイムピンクを pinkPos 番目に出し、続けて next を出す。敵軍コマンドは heldCount 枚ホールド状態。 */
  function pinkThen(nextId: string, opts: { pinkPos?: number; heldCount?: number; p2?: Partial<GameState["players"]["player2"]> } = {}) {
    const pinkPos = opts.pinkPos ?? 4;
    let s = st({
      player1: { battle: fillers(pinkPos - 1), rush: [inst("RS-222", "tp"), inst(nextId, "nx")], deck: deckCards(5) },
      player2: {
        command: Array.from({ length: opts.heldCount ?? 3 }, (_, i) => held("TST-OP", `h${i}`)),
        ...opts.p2,
      },
    });
    s = passEntry(enter(s, "RS-222:tp"));
    return enter(s, `${nextId}:nx`);
  }
  const releasedEnemy = (s: GameState) => s.players.player2.command.filter((c) => !c.commandHeld).length;

  // 「「SP1」」（CN4）
  it("RS-222: 4番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-414「CN：4」「【戦闘指揮】「SP1」」）", () => {
    const s = enter(st({ player1: { battle: fillers(3), rush: [inst("RS-222", "tp")] } }), "RS-222:tp");
    expect(spOf(s, "player1", "RS-222:tp")).toBe(1);
    expect(canStrike(s, "RS-222:tp")).toBe(true);
  });

  it("RS-222: 4番目以外に出たときは SP！のまま（ストライクできない）（出典: atwiki/page-414「SP：！」）", () => {
    const s = enter(st({ player1: { battle: fillers(1), rush: [inst("RS-222", "tp")] } }), "RS-222:tp");
    expect(spOf(s, "player1", "RS-222:tp")).toBe(0);
    expect(canStrike(s, "RS-222:tp")).toBe(false);
  });

  // 「Sユニットがこのユニットからコンビネーションするとき…ナンバーに関係なく発動できる。ただし…リリースしなければならない」
  it("RS-222: タイムピンク（NC 成立）の次に出た S ユニットの NC をナンバーに関係なく発動でき、ナンバー（2）と同じ数の敵軍コマンドをリリースする（出典: atwiki/page-414）", () => {
    let s = pinkThen("RS-139");
    expect(s.pendingEffectChoice?.effectId).toBe("battle_command");
    s = confirm(s);
    expect(releasedEnemy(s)).toBe(2);
    // ブルードルフィン【ドルフィンアロー】が発動している（ホールド状態の敵軍コマンドを選べる）
    expect(s.pendingEffectChoice?.effectId).toBe("dolphin_arrow");
  });

  it("RS-222: 発動しないことを選べる（任意。敵軍コマンドはリリースされず NC も発動しない）（出典: atwiki/page-414「発動できる」）", () => {
    let s = pinkThen("RS-139");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(releasedEnemy(s)).toBe(0);
    expect(s.pendingEffectChoice?.effectId).not.toBe("dolphin_arrow");
  });

  it("RS-222: リリースできる敵軍コマンドがナンバーより少なければ発動できない（出典: atwiki/page-414「ナンバーと同じ数だけ敵軍コマンドをリリースしなければならない」）", () => {
    const s = pinkThen("RS-139", { heldCount: 1 });
    expect(s.pendingEffectChoice?.effectId).not.toBe("battle_command");
    expect(releasedEnemy(s)).toBe(0);
  });

  it("RS-222: 並び順とナンバーが一致する S ユニット（ボウケンレッド CN5 を5番目）は通常どおり NC が成立し、敵軍コマンドをリリースしない（出典: atwiki/page-414・R-CN-02）", () => {
    const s = pinkThen("RS-062");
    expect(s.pendingEffectChoice?.effectId).not.toBe("battle_command");
    expect(releasedEnemy(s)).toBe(0);
    expect(spOf(s, "player1", "RS-062:nx")).toBe(1);
  });

  // NC（CN4）の効果なので、タイムピンクの NC が成立していなければ【戦闘指揮】は働かない。
  it("RS-222: タイムピンクの NC が成立していない（2番目に出た）ときは、次の S ユニットに【戦闘指揮】は働かない（出典: atwiki/page-414「CN：4」・R-CN-02）", () => {
    const s = pinkThen("RS-139", { pinkPos: 2 });
    expect(s.pendingEffectChoice?.effectId).not.toBe("battle_command");
    expect(releasedEnemy(s)).toBe(0);
  });

  it("RS-222: タイムピンクから直接コンビネーションしていない（間に別のユニットがある）S ユニットには働かない（出典: atwiki/page-414「このユニットからコンビネーションするとき」・R-CN-05）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-222", "tp"), inst("TST-UNIT-0", "mid"), inst("RS-139", "nx")] },
      player2: { command: [held("TST-OP", "h0"), held("TST-OP", "h1")] },
    });
    s = passEntry(enter(s, "RS-222:tp"));
    s = passEntry(enter(s, "TST-UNIT-0:mid"));
    s = enter(s, "RS-139:nx");
    expect(s.pendingEffectChoice?.effectId).not.toBe("battle_command");
    expect(releasedEnemy(s)).toBe(0);
  });

  // faq-card-4 RS-222 Q1「はい、その通りです。」（バードニックウェーブで次のユニットのナンバーも1少なくなる）
  it("RS-222: 公式Q&A — バードニックウェーブ使用中は、タイムピンク（CN4→3）は3番目で NC が成立し、次のアバレイエロー（CN3→2）の NC はナンバー2と同じ2枚のリリースで発動する（出典: grnrngr/faq-card-4 RS-222 Q1・faq-card-1 RS-015）", () => {
    let s = st({
      phase: "rush",
      player1: {
        rush: [inst("TST-UNIT-0", "f0"), inst("TST-UNIT-0", "f1"), inst("RS-222", "tp"), inst("RS-104", "y")],
        hand: [inst("RS-015", "bw")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(3),
        deck: deckCards(5),
      },
      player2: { command: [held("TST-OP", "h0"), held("TST-OP", "h1"), held("TST-OP", "h2")], deck: deckCards(5, "e") },
    });
    s = useCard(s, "player1", "RS-015:bw");
    s = toPhase(s, "player1", "battle");
    s = passEntry(enter(s, "TST-UNIT-0:f0"));
    s = passEntry(enter(s, "TST-UNIT-0:f1"));
    s = enter(s, "RS-222:tp");
    expect(spOf(s, "player1", "RS-222:tp")).toBe(1);
    s = enter(passEntry(s), "RS-104:y");
    expect(s.pendingEffectChoice?.effectId).toBe("battle_command");
    s = confirm(s);
    expect(releasedEnemy(s)).toBe(2);
  });

  // faq-card-4 RS-222 Q2「「RS-106 デカレッド」は「RS-140 コロン」の効果でコンビネーションナンバーが２になっていますので、２枚の敵軍コマンドをリリースすれば…」
  it("RS-222: 公式Q&A — 敵軍ラッシュエリアにコロンがあると、タイムピンクからコンビネーションしたデカレッド（CN1→2）の【ジュウクンドー】は敵軍コマンド2枚のリリースで発動できる（出典: grnrngr/faq-card-4 RS-222 Q2・faq-card-2/3）", () => {
    // コロンがあるとタイムピンク自身も CN4→5 になるので、【戦闘指揮】（CN の効果）が有効になるよう5番目に出す（R-CN-02）。
    let s = pinkThen("RS-106", { pinkPos: 5, heldCount: 2, p2: { rush: [inst("RS-140", "colon")], battle: [inst("TST-UNIT-0", "eb")] } });
    const use = legal(s).find((a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === "RS-106:nx");
    expect(use).toBeDefined();
    s = act(s, use!);
    expect(releasedEnemy(s)).toBe(2);
  });

  it("RS-222: 公式Q&A — 同条件で敵軍コマンドが1枚しかリリースできなければ【ジュウクンドー】は発動できない（出典: grnrngr/faq-card-4 RS-222 Q2）", () => {
    const s = pinkThen("RS-106", { pinkPos: 5, heldCount: 1, p2: { rush: [inst("RS-140", "colon")], battle: [inst("TST-UNIT-0", "eb")] } });
    expect(legal(s).some((a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === "RS-106:nx")).toBe(false);
  });
});

// ===========================================================================
describe("RS-223 タック", () => {
  const TEXT =
    "※これはバトルエリアに出られない。【緊急システム発動要請】これが自軍ラッシュエリアにある間、自軍ラッシュフェイズ中、自分がMユニットをラッシュするとき、敵軍コマンドを1つリリースしてもよい。そうしたとき、そのユニットのラッシュに必要な自軍コマンドを1つホールドしたことにできる。";

  it("RS-223: カタログ本文・スペックが出典と一致（出典: atwiki/page-406）", () => {
    expectCatalogText("RS-223", TEXT);
    expectStats("RS-223", {
      name: "タック",
      category: "OT",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 2,
      features: ["メカ"],
    });
  });

  // 「※これはバトルエリアに出られない。」
  it("RS-223: ※ バトルエリアに出られない（ふつうの S ユニットは出られる状況）（出典: atwiki/page-406）", () => {
    const s = st({ player1: { rush: [inst("RS-223", "tk"), inst("TST-UNIT-0", "u")], command: releasedN(2) } });
    expect(canEnter(s, "RS-223:tk")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:u")).toBe(true);
  });

  function tuckRush(own: ReturnType<typeof inst>[], enemyHeld: number, hand = inst("SPEC-WB-M", "m")) {
    return st(
      {
        phase: "rush",
        player1: { rush: [inst("RS-223", "tk")], hand: [hand], power: powerCards(4), command: own },
        player2: { command: Array.from({ length: enemyHeld }, (_, i) => held("TST-OP", `eh${i}`)) },
      },
      SPECS,
    );
  }

  // 「自分がMユニットをラッシュするとき、敵軍コマンドを1つリリースしてもよい。そうしたとき…自軍コマンドを1つホールドしたことにできる」
  it("RS-223: 自軍コマンドがなくても、敵軍コマンドを1つリリースして M ユニットをラッシュできる（出典: atwiki/page-406）", () => {
    const s = tuckRush([], 1);
    expect(canStartRush(s, "player1", "SPEC-WB-M:m")).toBe(true);
    const r = rushFromHand(s, "player1", "SPEC-WB-M:m");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-WB-M:m")).toBe("rush");
    expect(r.state.players.player2.command[0]?.commandHeld).toBe(false);
  });

  it("RS-223: 敵軍コマンドをリリースしない（使わない）ことも選べる — 自軍コマンドでふつうにラッシュでき、敵軍コマンドはホールドのまま（出典: atwiki/page-406「リリースしてもよい」）", () => {
    const s = tuckRush([released("TST-OP", "own")], 1);
    const r = rushFromHand(s, "player1", "SPEC-WB-M:m");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-WB-M:m")).toBe("rush");
    expect(r.state.players.player1.command[0]?.commandHeld).toBe(true);
    expect(r.state.players.player2.command[0]?.commandHeld).toBe(true);
  });

  it("RS-223: S ユニットのラッシュには使えない（自軍コマンドがなければラッシュできない）（出典: atwiki/page-406「Mユニットをラッシュするとき」）", () => {
    const s = tuckRush([], 1, inst("TST-UNIT-0", "s"));
    expect(canStartRush(s, "player1", "TST-UNIT-0:s")).toBe(false);
  });

  it("RS-223: タックが自軍ラッシュエリアになければ、自軍コマンドなしで M ユニットはラッシュできない（出典: atwiki/page-406「これが自軍ラッシュエリアにある間」）", () => {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("SPEC-WB-M", "m")], power: powerCards(4), command: [] },
        player2: { command: [held("TST-OP", "eh0")] },
      },
      SPECS,
    );
    expect(canStartRush(s, "player1", "SPEC-WB-M:m")).toBe(false);
  });

  // faq-card-4 RS-223 Q3「はい、できます。」（M ユニットとリリースする敵軍コマンドのカテゴリが違ってもよい）
  it("RS-223: 公式Q&A — ラッシュする M ユニット（ET）とリリースする敵軍コマンド（WB）のカテゴリが違ってもラッシュできる（出典: grnrngr/faq-card-4 RS-223 Q3）", () => {
    const s = tuckRush([], 1, inst("SPEC-ET-M", "m"));
    const r = rushFromHand(s, "player1", "SPEC-ET-M:m");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-ET-M:m")).toBe("rush");
  });

  // faq-card-5 RS-296「はい、発動することができます。」
  it("RS-223: 公式Q&A — 緊急システム発動要請で特徴「航空機」のユニットをラッシュしても、バラクティカの【編隊出撃】を発動できる（出典: grnrngr/faq-card-4 RS-223 Q1・faq-card-5 RS-296）", () => {
    const AIR_M = sUnit("SPEC-AIR-M", { size: "M", category: "OT", bp: 4000, powerCost: 2, features: ["航空機"] });
    const s = st(
      {
        phase: "rush",
        player1: {
          rush: [inst("RS-223", "tk"), inst("RS-296", "bal")],
          hand: [inst("SPEC-AIR-M", "a1"), inst("SPEC-AIR-M", "a2")],
          power: powerCards(4),
          command: [],
        },
        player2: { command: [held("TST-OP", "eh0")] },
      },
      [AIR_M],
    );
    const r = rushFromHand(s, "player1", "SPEC-AIR-M:a1");
    expect(r.ok).toBe(true);
    expect(r.state.players.player2.command[0]?.commandHeld).toBe(false);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-296");
    const after = pick(r.state, "SPEC-AIR-M:a2");
    expect(zoneOf(after, "player1", "SPEC-AIR-M:a2")).toBe("rush");
  });

  it.todo(
    "RS-223: 公式Q&A — ジャガーバルカン／デカベースクローラーで追加条件のかわりにホールドするコマンドは「ラッシュに必要なコマンド」ではなく、敵軍コマンドのリリースで代替できない（出典: grnrngr/faq-card-4 RS-223 Q2）— XL ユニット（母艦）の追加条件のかわりのホールドを、通常の支払いと分けて公開 API で組み立てられなかった",
  );

  // faq-card-6 RS-374「いいえ、捨札にはなりません。」
  it("RS-223: 公式Q&A — 魔女バンドーラがあるとき、緊急システム発動要請で恐竜をラッシュしても、リリースした敵軍コマンドは捨札にならない（出典: grnrngr/faq-card-6 RS-374）", () => {
    const DINO_M = sUnit("SPEC-DINO-M", { size: "M", category: "WB", bp: 4000, powerCost: 2, features: ["恐竜"] });
    const s = st(
      {
        phase: "rush",
        player1: { rush: [inst("RS-223", "tk")], hand: [inst("SPEC-DINO-M", "d")], power: powerCards(4), command: [] },
        player2: { rush: [inst("RS-374", "bandora")], command: [held("TST-OP", "eh0")] },
      },
      [DINO_M],
    );
    const r = rushFromHand(s, "player1", "SPEC-DINO-M:d");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-DINO-M:d")).toBe("rush");
    expect(zoneOf(r.state, "player2", "TST-OP:eh0")).toBe("command");
    expect(r.state.players.player2.command[0]?.commandHeld).toBe(false);
  });

  // faq-card-6 RS-358「はい、できます。」（デンジサンダー投げでタックを選び、結果として出さずに済ませる）
  it("RS-223: 公式Q&A（相互参照）— 敵軍デンジピンク【デンジサンダー投げ】でタックを選ぶと、出られないのでラッシュエリアに残る（出典: grnrngr/faq-card-6 RS-358）", () => {
    let s = st({
      player1: { battle: [], rush: [inst("RS-358", "dp")] },
      player2: { rush: [inst("RS-223", "tk"), inst("TST-UNIT-0", "u")] },
    });
    s = enter(s, "RS-358:dp");
    if (s.pendingEffectChoice?.playerId === "player2") {
      expect(choiceIds(s)).toContain("RS-223:tk");
      s = pick(s, "RS-223:tk");
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-223:tk")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:u")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-224 トータスハンマー", () => {
  const TEXT = "※これはSユニットにアタックされない。【ロックドバスター】このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒「SP+1」";

  it("RS-224: カタログ本文・スペックが出典と一致（出典: atwiki/page-380）", () => {
    expectCatalogText("RS-224", TEXT);
    expectStats("RS-224", {
      name: "トータスハンマー",
      category: "MA",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: "L" as never,
      features: ["メカ", "カラクリボール"],
    });
  });

  // 「※これはSユニットにアタックされない。」
  it("RS-224: ※ 敵軍 S ユニットはアタックできず、M ユニットはアタックできる（出典: atwiki/page-380）", () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-224", "th")] },
        player2: { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-2", "m")] },
      },
      SPECS,
    );
    expect(attackTargets(s, "TST-UNIT-0:s", "player2")).not.toContain("RS-224:th");
    expect(attackTargets(s, "TST-UNIT-2:m", "player2")).toContain("RS-224:th");
  });

  function tortoiseThen(nextId: string) {
    let s = st({ player1: { rush: [inst("RS-224", "th"), inst(nextId, "nx")] } }, SPECS);
    s = passEntry(enter(s, "RS-224:th"));
    return enter(s, `${nextId}:nx`);
  }

  // 「このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒「SP+1」」
  it("RS-224: トータスハンマーから JC した MA の L ユニットは SP+1（SP1→SP2）（出典: atwiki/page-380）", () => {
    const s = tortoiseThen("SPEC-MA-L");
    expect(spOf(s, "player1", "SPEC-MA-L:nx")).toBe(2);
  });

  it("RS-224: カテゴリが違う（WB）L ユニットは SP+1 を得ない（出典: atwiki/page-380「同カテゴリのLユニット」）", () => {
    const s = tortoiseThen("SPEC-WB-L");
    expect(spOf(s, "player1", "SPEC-WB-L:nx")).toBe(1);
  });

  it("RS-224: L ユニットでない（MA の M・S ユニット）なら SP+1 を得ない（出典: atwiki/page-380「Lユニット」）", () => {
    expect(spOf(tortoiseThen("SPEC-MA-M"), "player1", "SPEC-MA-M:nx")).toBe(1);
    expect(spOf(tortoiseThen("SPEC-MA-S"), "player1", "SPEC-MA-S:nx")).toBe(1);
  });

  it("RS-224: トータスハンマーの直後に出ていない（間に別ユニット）L ユニットは SP+1 を得ない（出典: atwiki/page-380「このユニットからコンビネーションする」）", () => {
    let s = st({ player1: { rush: [inst("RS-224", "th"), inst("TST-UNIT-0", "mid"), inst("SPEC-MA-L", "nx")] } }, SPECS);
    s = passEntry(enter(s, "RS-224:th"));
    s = passEntry(enter(s, "TST-UNIT-0:mid"));
    s = enter(s, "SPEC-MA-L:nx");
    expect(spOf(s, "player1", "SPEC-MA-L:nx")).toBe(1);
  });

  // faq-card-4 RS-224 Q1「はい、「ＳＰ１」になります。」
  it("RS-224: 公式Q&A — ガインガイン（SP なし、バトルエリアで MA が追加される）はトータスハンマーから JC すると「SP1」になる（出典: grnrngr/faq-card-4 RS-224 Q1）", () => {
    const s = tortoiseThen("RS-166");
    expect(spOf(s, "player1", "RS-166:nx")).toBe(1);
    expect(canStrike(s, "RS-166:nx")).toBe(true);
  });

  // atwiki/page-380 Q2「「RS-224 トータスハンマー」がいつバトルエリアに出たかに関わらず…コンビネーションしたユニットはSP＋1されます」
  it("RS-224: 公式Q&A — 前のターンからバトルエリアに残っていたトータスハンマーからでも、JC した MA の L ユニットは SP+1 される（出典: atwiki/page-380 Q2）", () => {
    let s = st({ player1: { battle: [inst("RS-224", "th")], rush: [inst("SPEC-MA-L", "nx")] } }, SPECS);
    s = enter(s, "SPEC-MA-L:nx");
    expect(spOf(s, "player1", "SPEC-MA-L:nx")).toBe(2);
  });

  it.todo(
    "RS-224: 公式Q&A（相互参照）— Jパワーで L ユニットになった CN3 で SP1 になる MA の S ユニットが、トータスハンマーから JC して3番目に並ぶと SP2 になる（出典: grnrngr/faq-rider-1 RK-013）— Jパワー（RK-013）で重ねたユニットを L ユニットとしてバトルエリアに出す手順を公開 API で確認できなかった",
  );
});

// ===========================================================================
describe("RS-225 ガトリングレオ", () => {
  const TEXT = "※これはSユニットにアタックされない。【大回転獅子爆裂弾】このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-225: カタログ本文・スペックが出典と一致（出典: atwiki/page-381）", () => {
    expectCatalogText("RS-225", TEXT);
    expectStats("RS-225", {
      name: "ガトリングレオ",
      category: "MA",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: "L" as never,
      features: ["メカ", "カラクリボール"],
    });
  });

  it("RS-225: ※ 敵軍 S ユニットはアタックできず、M ユニットはアタックできる（出典: atwiki/page-381）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-225", "gl")] },
      player2: { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-2", "m")] },
    });
    expect(attackTargets(s, "TST-UNIT-0:s", "player2")).not.toContain("RS-225:gl");
    expect(attackTargets(s, "TST-UNIT-2:m", "player2")).toContain("RS-225:gl");
  });

  function leoThen(nextId: string) {
    let s = st(
      {
        player1: { rush: [inst("RS-225", "gl"), inst(nextId, "nx")] },
        player2: { rush: [inst("TST-UNIT-0", "er")], battle: [inst("TST-UNIT-0", "eb")] },
      },
      SPECS,
    );
    s = passEntry(enter(s, "RS-225:gl"));
    return enter(s, `${nextId}:nx`);
  }

  // 「このユニットからコンビネーションする同カテゴリのLユニットは…敵軍ラッシュエリアのユニットにアタックできる」
  it("RS-225: ガトリングレオから JC した MA の L ユニットは敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-381）", () => {
    const s = leoThen("SPEC-MA-L");
    expect(attackTargets(s, "SPEC-MA-L:nx")).toEqual(expect.arrayContaining(["TST-UNIT-0:er", "TST-UNIT-0:eb"]));
  });

  it("RS-225: カテゴリが違う（WB）L ユニットは敵軍ラッシュエリアにアタックできない（出典: atwiki/page-381「同カテゴリのLユニット」）", () => {
    const s = leoThen("SPEC-WB-L");
    expect(attackTargets(s, "SPEC-WB-L:nx")).not.toContain("TST-UNIT-0:er");
    expect(attackTargets(s, "SPEC-WB-L:nx")).toContain("TST-UNIT-0:eb");
  });

  it("RS-225: L ユニットでない（MA の M ユニット）なら敵軍ラッシュエリアにアタックできない（出典: atwiki/page-381「Lユニット」）", () => {
    const s = leoThen("SPEC-MA-M");
    expect(attackTargets(s, "SPEC-MA-M:nx")).not.toContain("TST-UNIT-0:er");
  });

  it("RS-225: ガトリングレオがいなければ MA の L ユニットは敵軍ラッシュエリアにアタックできない（出典: atwiki/page-381）", () => {
    let s = st({ player1: { rush: [inst("SPEC-MA-L", "nx")] }, player2: { rush: [inst("TST-UNIT-0", "er")], battle: [inst("TST-UNIT-0", "eb")] } }, SPECS);
    s = enter(s, "SPEC-MA-L:nx");
    expect(attackTargets(s, "SPEC-MA-L:nx")).toEqual(["TST-UNIT-0:eb"]);
  });
});

// ===========================================================================
describe("RS-226 キラーオー", () => {
  const TEXT =
    "合体―爆竜トップゲイラー＋爆竜ステゴスライドン【爆竜必殺デススティンガー】自軍ターン中、これがバトルでユニットを撃破したとき、これがバトルで撃破したユニットよりBPの低いユニットを、相手は自分自身のユニットの中から1体選び撃破する。";

  it("RS-226: カタログ本文・スペックが出典と一致（出典: atwiki/page-376）", () => {
    expectCatalogText("RS-226", TEXT);
    expectStats("RS-226", {
      name: "キラーオー",
      category: "WB",
      size: "L",
      bp: 8000,
      sp: 1,
      powerCost: "6+",
      features: ["恐竜", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「合体―爆竜トップゲイラー＋爆竜ステゴスライドン」「追加条件：自軍合体ユニットを捨札にする」
  it("RS-226: 合体ユニット（トップゲイラー＋ステゴスライドン）を捨札にしてラッシュでき、片方だけでは満たせない（出典: atwiki/page-376・R-ADD-06）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-226", "k")], rush, command: releasedN(2), power: powerCards(6) } });
    expect(canStartRush(mk([inst("RS-227", "g")]), "player1", "RS-226:k")).toBe(false);
    const r = rushFromHand(mk([inst("RS-227", "g"), inst("RS-228", "sg")]), "player1", "RS-226:k");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-226:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-227:g")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-228:sg")).toBe("discard");
  });

  it("RS-226: 必要パワー6+ — パワー5枚ではラッシュできない（出典: atwiki/page-376）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-226", "k")], rush: [inst("RS-227", "g"), inst("RS-228", "sg")], command: releasedN(2), power: powerCards(5) },
    });
    expect(rushFromHand(s, "player1", "RS-226:k").ok).toBe(false);
  });

  const E5 = sUnit("SPEC-E5", { bp: 5000 });
  const E4 = sUnit("SPEC-E4", { bp: 4000 });
  const E3 = sUnit("SPEC-E3", { bp: 3000 });
  const KS = [E5, E4, E3];

  function killerAttack(p2: Partial<GameState["players"]["player2"]>, target = "SPEC-E5:t", extra: ReturnType<typeof sUnit>[] = []) {
    let s = st({ player1: { battle: [inst("RS-226", "k")] }, player2: p2 }, [...KS, ...extra]);
    s = attack(s, "RS-226:k", target);
    return settle(s);
  }

  // 「これがバトルで撃破したユニットよりBPの低いユニットを、相手は自分自身のユニットの中から1体選び撃破する」
  it("RS-226: バトルで撃破したとき、相手は撃破されたユニットより BP の低い自分のユニット（バトルエリア・ラッシュエリア）から1体選んで撃破する（出典: atwiki/page-376）", () => {
    let s = killerAttack({
      battle: [inst("SPEC-E5", "t"), inst("SPEC-E4", "b4")],
      rush: [inst("SPEC-E3", "r3"), inst("SPEC-E5", "r5")],
    });
    expect(zoneOf(s, "player2", "SPEC-E5:t")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-E3:r3", "SPEC-E4:b4"]);
    expect(canSkip(s)).toBe(false);
    s = settle(pick(s, "SPEC-E3:r3"));
    expect(zoneOf(s, "player2", "SPEC-E3:r3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E4:b4")).toBe("battle");
  });

  it("RS-226: BP の低いユニットがいなければ何も撃破しない（出典: atwiki/page-376）", () => {
    const s = killerAttack({ battle: [inst("SPEC-E5", "t")], rush: [inst("SPEC-E5", "r5")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-E5:r5")).toBe("rush");
  });

  it("RS-226: 敵軍ターン中、アタックしてきたユニットをバトルで撃破しても発動しない（出典: atwiki/page-376「自軍ターン中」）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-226", "k")] },
        player2: { battle: [inst("SPEC-E5", "t")], rush: [inst("SPEC-E3", "r3")] },
      },
      KS,
    );
    s = attack(s, "SPEC-E5:t", "RS-226:k", "player2");
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-E5:t")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-E3:r3")).toBe("rush");
  });

  // atwiki/page-376 Q4「いいえ、選ぶことはできません。「〜より低い」は同じ値を含みません。」
  it("RS-226: 公式Q&A — 撃破したユニットと同じ BP のユニットは選べない（出典: atwiki/page-376 Q4）", () => {
    const s = killerAttack({ battle: [inst("SPEC-E5", "t")], rush: [inst("SPEC-E5", "same"), inst("SPEC-E4", "low")] });
    expect(choiceIds(s)).toEqual(["SPEC-E4:low"]);
  });

  const M4 = sUnit("SPEC-M4", { size: "M", bp: 4000 });
  const M5 = sUnit("SPEC-M5", { size: "M", bp: 5000 });
  const M6 = sUnit("SPEC-M6", { size: "M", bp: 6000 });

  // faq-card-4 RS-226 Q2「その場合は、バトルの時点でのＢＰを元に選んでください。」
  it("RS-226: 公式Q&A — 撃破したユニットの BP は、気力等で上がっていればバトルの時点の BP（3000+2000=5000）を参照する（出典: grnrngr/faq-card-4 RS-226 Q2）", () => {
    // 敵軍の気力（RS-017）: 敵軍から見た「敵軍ターン中」（＝自軍ターン）に、リリース状態のコマンド2つで S ユニット BP+2000
    const s = killerAttack(
      {
        battle: [inst("SPEC-E3", "t")],
        rush: [inst("SPEC-M4", "m4"), inst("SPEC-M5", "m5")],
        operation: [inst("RS-017", "kiryoku")],
        command: releasedN(2, "TST-OP", "ec"),
      },
      "SPEC-E3:t",
      [M4, M5],
    );
    expect(zoneOf(s, "player2", "SPEC-E3:t")).toBe("discard");
    expect(choiceIds(s)).toEqual(["SPEC-M4:m4"]);
  });

  // faq-card-4 RS-226 Q3「その場合は、バトルの時点でのＢＰを参照しますので、ＢＰ５０００より低いＢＰのユニットが対象になります。」
  it("RS-226: 公式Q&A — アタックされるとき BP が上がるユニット（ザビーMF：1000+5000）を撃破したら、上がった BP（6000）より低いユニットが対象（出典: grnrngr/faq-card-4 RS-226 Q3・atwiki/page-376 Q3）", () => {
    const s = killerAttack({ battle: [inst("RK-056", "t")], rush: [inst("SPEC-M5", "m5"), inst("SPEC-M6", "m6")] }, "RK-056:t", [M5, M6]);
    expect(zoneOf(s, "player2", "RK-056:t")).toBe("discard");
    expect(choiceIds(s)).toEqual(["SPEC-M5:m5"]);
  });

  // atwiki/page-376 Q5「『BP5000よりBPの低いユニット』です。【分析能力】は…BPの変動自体を無効にする能力ではない」
  it("RS-226: 公式Q&A — デスガロン【分析能力】下でガタックMF（2000、アタックされるとき+3000）を撃破したとき、選ぶのは「BP5000 より低い」ユニット（出典: atwiki/page-376 Q5）", () => {
    const s = killerAttack(
      { battle: [inst("RK-268", "dg"), inst("RK-053", "t")], rush: [inst("SPEC-M4", "m4"), inst("SPEC-M5", "m5")] },
      "RK-053:t",
      [M4, M5],
    );
    expect(zoneOf(s, "player2", "RK-053:t")).toBe("discard");
    expect(choiceIds(s)).toEqual(["RK-268:dg", "SPEC-M4:m4"]);
  });

  // faq-card-4 RS-226 Q1「「RS-054 アバレッド」を選ぶことはできません…先に「RS-226 キラーオー」の効果の対象を選択してください」
  it("RS-226: 公式Q&A — 撃破したアバレッドAM の効果で捨札から出るアバレッドは選べない（キラーオーの選択が先）（出典: grnrngr/faq-card-4 RS-226 Q1）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-226", "k")] },
        player2: { battle: [inst("RS-230", "am")], rush: [inst("SPEC-E4", "low")], discard: [inst("RS-054", "red")] },
      },
      KS,
    );
    s = attack(s, "RS-226:k", "RS-230:am");
    s = settle(s);
    // R-TIME-01（ユーザー決定 2026-10-11）: 「撃破したとき」（段階 1）が「撃破されて捨札になったとき」（段階 4）より先。
    // 処理順の選択（simultaneous_order）は開かず、最初にキラーオーの対象を相手が選ぶ。
    expect(s.pendingEffectChoice?.kind).toBe("select_unit");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-226");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-E4:low"]);
  });

  // faq-card-4 RS-226 Q1 / R-TIME-01（ユーザー決定 2026-10-11）— 処理順は固定。キラーオーの効果のあとでアバレッドAM の効果を解決する。
  it("RS-226: 公式Q&A — アバレッドAM を撃破したとき、処理順の選択はなく キラーオー → アバレッドAM の順に解決する（出典: grnrngr/faq-card-4 RS-226 Q1、R-TIME-01）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-226", "k")] },
        player2: { battle: [inst("RS-230", "am")], rush: [inst("SPEC-E4", "low")], discard: [inst("RS-054", "red")] },
      },
      KS,
    );
    s = settle(attack(s, "RS-226:k", "RS-230:am"));
    expect(s.pendingEffectChoice?.kind).not.toBe("simultaneous_order");
    expect(s.pendingEffectChoice?.battleDestroyOrderMeta).toBeUndefined();
    expect(s.pendingEffectChoice?.destroyTriggerTiming).toBe("destroyer");
    expect(s.pendingEffectChoice?.resumeChoice?.sourceCardId).toBe("RS-230");
    s = settle(pick(s, "SPEC-E4:low"));
    expect(zoneOf(s, "player2", "SPEC-E4:low")).toBe("discard");
    // つづいてアバレッドAM の「撃破されて捨札になったとき」— 捨札のアバレッドを出す。
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-230");
    expect(choiceIds(s)).toEqual(["RS-054:red"]);
    s = settle(pick(s, "RS-054:red"));
    expect(zoneOf(s, "player2", "RS-054:red")).toBe("rush");
  });

  // faq-card-5 RS-289「はい、選ぶことができます。」
  it("RS-226: 公式Q&A（相互参照）— ドラゴンレンジャー（BP6000）を撃破したとき、【獣奏剣】で BP6000 になっていた本来 BP5000 の恐竜ユニットを選べる（出典: grnrngr/faq-card-5 RS-289）", () => {
    const DINO5 = sUnit("SPEC-DINO5", { bp: 5000, features: ["恐竜"] });
    const s = killerAttack({ battle: [inst("RS-289", "t")], rush: [inst("SPEC-DINO5", "d")] }, "RS-289:t", [DINO5]);
    expect(zoneOf(s, "player2", "RS-289:t")).toBe("discard");
    expect(choiceIds(s)).toEqual(["SPEC-DINO5:d"]);
  });
});

// ===========================================================================
describe("RS-227 爆竜トップゲイラー", () => {
  // 08-errata R-ERR-RS227（読み替え推奨）後の本文
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【トップウインド】自軍ターン中、これがバトルエリアに出たとき、相手は次のようにする⇒自分自身のコマンドを、自分自身のコマンドゾーンのカテゴリの数まで可能な限り選びホールドする。";

  it("RS-227: カタログ本文（読み替え後）・スペックが出典と一致（出典: docs/rules/08-errata.md R-ERR-RS227・atwiki/page-96）", () => {
    expectCatalogText("RS-227", TEXT);
    expectStats("RS-227", {
      name: "爆竜トップゲイラー",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["恐竜"],
    });
  });

  it("RS-227: ※ 自軍コマンドを1つホールドしなければ出られない（ホールドすれば出られる）（出典: atwiki/page-96）", () => {
    const none = st({ player1: { rush: [inst("RS-227", "g")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-227:g")).toBe(false);
    let s = st({ player1: { rush: [inst("RS-227", "g")], command: [released("TST-OP", "c")] } });
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-227:g" }).ok).toBe(false);
    s = enterWithHold(s, "RS-227:g", ["TST-OP:c"]);
    expect(zoneOf(s, "player1", "RS-227:g")).toBe("battle");
  });

  function gailer(enemyCommand: ReturnType<typeof inst>[]) {
    const s = st({
      player1: { rush: [inst("RS-227", "g")], command: [released("TST-OP", "c")] },
      player2: { command: enemyCommand },
    });
    return enterWithHold(s, "RS-227:g", ["TST-OP:c"]);
  }
  /** 相手（player2）が【トップウインド】でホールドするコマンドを選ぶ手順を開始する。 */
  function beginOpponentHold(s: GameState): GameState {
    const a = legal(s).find((x) => x.type === "initiate_command_payment" && x.playerId === "player2" && x.kind === "effect_hold");
    if (!a) throw new Error(`no effect_hold; legal=${legal(s).map((x) => x.type).join(",")}`);
    return raw(s, a);
  }
  const heldEnemy = (s: GameState) => s.players.player2.command.filter((c) => c.commandHeld).map((c) => c.instanceId).sort();

  // 「相手は次のようにする⇒自分自身のコマンドを、自分自身のコマンドゾーンのカテゴリの数まで可能な限り選びホールドする」
  it("RS-227: 相手は自分のコマンドゾーンのカテゴリの数（WB・ET の2）だけ、自分で選んだコマンドをホールドする（出典: R-ERR-RS227・atwiki/page-96）", () => {
    let s = beginOpponentHold(gailer([released("TST-OP", "w1"), released("TST-OP", "w2"), released("TST-OP-ET", "e1")]));
    expect(s.pendingCommandPayment?.playerId).toBe("player2");
    expect(s.pendingCommandPayment?.totalNeeded).toBe(2);
    s = raw(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:w2", "TST-OP-ET:e1"] });
    expect(heldEnemy(s)).toEqual(["TST-OP-ET:e1", "TST-OP:w2"]);
  });

  // atwiki/page-96 Q1「いいえ、それはできません。」（0〜1枚は選べない）
  it("RS-227: 公式Q&A — リリース状態のコマンド2枚・カテゴリ2つのとき、相手は1枚だけ（0〜1枚）を選ぶことはできない（出典: atwiki/page-96 Q1・R-ERR-RS227）", () => {
    const s = gailer([released("TST-OP", "w1"), released("TST-OP-ET", "e1")]);
    expect(legal(s).every((a) => a.type !== "pass_battle_entry" || a.playerId !== "player2")).toBe(true);
    const begun = beginOpponentHold(s);
    expect(tryAct(begun, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:w1"] }).ok).toBe(false);
    expect(tryAct(begun, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: [] }).ok).toBe(false);
    const done = raw(begun, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:w1", "TST-OP-ET:e1"] });
    expect(heldEnemy(done)).toHaveLength(2);
  });

  it("RS-227: リリース状態のコマンドがカテゴリの数（3）より少なければ、可能な限り（リリース状態の1枚）ホールドする（出典: R-ERR-RS227「可能な限り」）", () => {
    let s = gailer([released("TST-OP", "w1"), held("TST-OP-ET", "e1"), held("TST-OP-MA", "m1")]);
    s = beginOpponentHold(s);
    expect(s.pendingCommandPayment?.totalNeeded).toBe(1);
    s = raw(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:w1"] });
    expect(heldEnemy(s)).toHaveLength(3);
  });

  it.todo(
    "RS-227: 敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-96「自軍ターン中」）— 敵軍ターン中に M ユニットのトップゲイラーをバトルエリアに出す効果（デンジピンク等は S ユニットのみ）を公開 API で用意できない",
  );
});

// ===========================================================================
describe("RS-228 爆竜ステゴスライドン", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【超スライダー進化】自軍ターン中、これがバトルエリアに出たとき、「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれている自軍ユニットを1体選んでもよい。そうしたとき、このターン、そのテキストを無効にする。";

  it("RS-228: カタログ本文・スペックが出典と一致（出典: atwiki/page-1285）", () => {
    expectCatalogText("RS-228", TEXT);
    expectStats("RS-228", {
      name: "爆竜ステゴスライドン",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      features: ["恐竜"],
    });
  });

  it("RS-228: ※ 自軍コマンドを1つホールドしなければ出られない（出典: atwiki/page-1285）", () => {
    const none = st({ player1: { rush: [inst("RS-228", "sg")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-228:sg")).toBe(false);
    const s = enterWithHold(st({ player1: { rush: [inst("RS-228", "sg")], command: [released("TST-OP", "c")] } }), "RS-228:sg", ["TST-OP:c"]);
    expect(zoneOf(s, "player1", "RS-228:sg")).toBe("battle");
  });

  function stego(rush: ReturnType<typeof inst>[]) {
    const s = st({ player1: { rush: [inst("RS-228", "sg"), ...rush], command: [released("TST-OP", "c")] } });
    return enterWithHold(s, "RS-228:sg", ["TST-OP:c"]);
  }

  // 「…と書かれている自軍ユニットを1体選んでもよい。そうしたとき、このターン、そのテキストを無効にする」
  it("RS-228: 「コマンドを1つホールドしなければ出られない」自軍ユニット（トップゲイラー）を選ぶと、このターン、ホールドせずに出られる（出典: atwiki/page-1285）", () => {
    let s = stego([inst("RS-227", "g")]);
    expect(choiceIds(s)).toContain("RS-227:g");
    s = passEntry(pick(s, "RS-227:g"));
    expect(canEnter(s, "RS-227:g")).toBe(true);
    s = enter(s, "RS-227:g");
    expect(zoneOf(s, "player1", "RS-227:g")).toBe("battle");
  });

  it("RS-228: 選ばないこともできる（任意。選ばなければホールドが必要なまま）（出典: atwiki/page-1285「選んでもよい」）", () => {
    let s = stego([inst("RS-227", "g")]);
    expect(canSkip(s)).toBe(true);
    s = passEntry(skip(s));
    expect(canEnter(s, "RS-227:g")).toBe(false);
  });

  it("RS-228: 「2つホールドしなければ」と書かれたユニット（ブラキオサウルス）は選べない（出典: atwiki/page-1285「コマンドを1つホールドしなければ」）", () => {
    const s = stego([inst("RS-229", "br"), inst("RS-227", "g")]);
    expect(choiceIds(s)).not.toContain("RS-229:br");
  });

  it("RS-228: 無効になるのは「このターン」だけ（次の自軍ターンにはホールドが必要）（出典: atwiki/page-1285「このターン」）", () => {
    let s = stego([inst("RS-227", "g")]);
    s = passEntry(pick(s, "RS-227:g"));
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, deck: deckCards(6), command: [held("TST-OP", "c")] } } };
    s = endTurn(s);
    s = endTurn(toPhase(s, "player2", "battle"));
    s = toPhase(s, "player1", "battle");
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, command: [held("TST-OP", "c")] } } };
    expect(canEnter(s, "RS-227:g")).toBe(false);
  });
});

// ===========================================================================
describe("RS-229 爆竜ブラキオサウルス", () => {
  const TEXT =
    "※これは自軍コマンドを2つホールドしなければバトルエリアに出られない。【超ハンガー進化】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。オモテにしたカードが「WB」のMユニットのカードならラッシュエリアに出し、それ以外なら捨札にする。そうしたとき、これはアタックすることができない。";

  it("RS-229: カタログ本文・スペックが出典と一致（出典: atwiki/page-98）", () => {
    expectCatalogText("RS-229", TEXT);
    expectStats("RS-229", {
      name: "爆竜ブラキオサウルス",
      category: "WB",
      size: "XL",
      bp: 6000,
      sp: undefined,
      powerCost: 4,
      features: ["恐竜", "母艦"],
    });
  });

  it("RS-229: ※ 自軍コマンドを2つホールドしなければ出られない（1つでは出られない）（出典: atwiki/page-98）", () => {
    const one = st({ player1: { rush: [inst("RS-229", "br")], command: [released("TST-OP", "c0")] } });
    expect(canEnter(one, "RS-229:br")).toBe(false);
    const s = enterWithHold(st({ player1: { rush: [inst("RS-229", "br")], command: releasedN(2) } }), "RS-229:br", ["TST-OP:rc0", "TST-OP:rc1"]);
    expect(zoneOf(s, "player1", "RS-229:br")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  function brachio(top: ReturnType<typeof inst>) {
    const s = st(
      {
        player1: { rush: [inst("RS-229", "br")], command: releasedN(2), deck: [top, ...deckCards(3)] },
        player2: { battle: [inst("TST-UNIT-0", "e")] },
      },
      SPECS,
    );
    return enterWithHold(s, "RS-229:br", ["TST-OP:rc0", "TST-OP:rc1"]);
  }

  // 「オモテにしたカードが「WB」のMユニットのカードならラッシュエリアに出し…そうしたとき、これはアタックすることができない」
  it("RS-229: 山札の上が WB の M ユニットならラッシュエリアに出し、ブラキオサウルスはアタックできない（出典: atwiki/page-98）", () => {
    let s = brachio(inst("SPEC-WB-M", "top"));
    expect(s.pendingEffectChoice).toBeDefined();
    s = pick(s, "draw");
    expect(zoneOf(s, "player1", "SPEC-WB-M:top")).toBe("rush");
    expect(attackTargets(s, "RS-229:br")).toEqual([]);
  });

  it("RS-229: 山札の上が WB 以外の M ユニット（ET）なら捨札にし、ブラキオサウルスはアタックできない（出典: atwiki/page-98「それ以外なら捨札にする。そうしたとき」）", () => {
    let s = brachio(inst("SPEC-ET-M", "top"));
    s = pick(s, "draw");
    expect(zoneOf(s, "player1", "SPEC-ET-M:top")).toBe("discard");
    expect(attackTargets(s, "RS-229:br")).toEqual([]);
  });

  it("RS-229: 山札の上が WB の S ユニットなら捨札にする（出典: atwiki/page-98「「WB」のMユニットのカードなら」）", () => {
    let s = brachio(inst("TST-UNIT-0", "top"));
    s = pick(s, "draw");
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("discard");
  });

  it("RS-229: オモテにしないことを選べる（任意）— 山札はそのままでブラキオサウルスはアタックできる（出典: atwiki/page-98「オモテにしてもよい」）", () => {
    let s = brachio(inst("SPEC-WB-M", "top"));
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-WB-M:top");
    expect(attackTargets(s, "RS-229:br")).toEqual(["TST-UNIT-0:e"]);
  });
});
