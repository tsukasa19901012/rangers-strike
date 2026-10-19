/**
 * カード別スペック: PR-006〜PR-010（プロモーションカード デカレッド〜ゴレンジャーストーム）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS106 デカレッドの読み替え）。grnrngr/faq-card-plomo（RR-006 デカレッドは「RS-106 デカレッド」の項を参照、
 *     PR-007 アカレンジャーの Q「レッドビュートはバトルで撃破したときに1度だけ」）。元カードの公式Q&A（faq-card-1/2/3 の RS-001・RS-079・RS-106・RS-126）も同じく当てはめる。
 *     PR-006 の印刷文は読み替え前の「アタックするかわりに」。テストは RS-106 の読み替え（「アタックできるとき」「そうしたとき、アタックできない」）で書く
 *     （docs/verification/unverified/PR-judgments.md・PR-questions.md）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PR-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-06・R-ATK-05・R-BP-01）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PR-NNN …」）で残す。
 * 元カードの cardSpec（RS2-097-122.b・RS3-123-150.a・RS2-071-096.part1・RS1-001-023.part1）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { GameState, PlayerId } from "../types/game";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  canUseCard,
  choiceIds,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectOp,
  expectUnit,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  rushFromHand,
  rushPhase,
  settle,
  spOf,
  st,
  strikeDmg,
  sUnit,
  toPhase,
  tryAct,
  useCard,
  zoneOf,
} from "./PR-001-014.helpers";

const E1K = sUnit("SPEC-E1K", { bp: 1000 });
const E2K = sUnit("SPEC-E2K", { bp: 2000 });
const E3K = sUnit("SPEC-E3K", { bp: 3000 });
const E4K = sUnit("SPEC-E4K", { bp: 4000 });
const S_SP2 = sUnit("SPEC-S-SP2", { bp: 1000, sp: 2 });
const S_NOSP = sUnit("SPEC-S-NOSP", { bp: 1000, sp: undefined });
const M_UNIT = sUnit("SPEC-M", { size: "M", bp: 1000 } as never);
const EXTRA = [E1K, E2K, E3K, E4K, S_SP2, S_NOSP, M_UNIT];

// ===========================================================================
describe("PR-006 デカレッド", () => {
  it("PR-006: カタログ本文（印刷文）・スペックが出典と一致（出典: atwiki/page-1004）", () => {
    expectCatalogText(
      "PR-006",
      "※これはラッシュしたターンにバトルエリアに出られない。 【ジュウクンドー】これはアタックするかわりに次の効果を発動できる。敵軍ラッシュエリアにあるユニットを、カードに表記された本来のBPの合計が3000以下になるように好きな数選んで撃破する。",
    );
    expectUnit("PR-006", { name: "デカレッド", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: 1, features: ["レッド", "男", "警察"], rarity: "PR" });
  });

  it("PR-006: ※ ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-1004）", () => {
    const r = rushFromHand(st({ phase: "rush", player1: { hand: [inst("PR-006", "dr")], command: [released("TST-OP-OT", "ot")], power: powerCards(3) } }), "player1", "PR-006:dr");
    expect(r.ok, r.error).toBe(true);
    const s = act(r.state, { type: "end_phase", playerId: "player1" });
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "PR-006:dr")).toBe(false);
  });

  const canJuu = (s: GameState, id = "PR-006:dr") => legal(s).some((a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === id);
  function redFirst(enemy: { battle?: ReturnType<typeof inst>[]; rush?: ReturnType<typeof inst>[] }, before = 0) {
    const s = st({ player1: { battle: fillers(before), rush: [inst("PR-006", "dr")] }, player2: { battle: enemy.battle ?? [inst("TST-UNIT-0", "wall")], rush: enemy.rush ?? [] } }, EXTRA);
    return enter(s, "PR-006:dr");
  }
  function juu(s: GameState, picks: string[]): GameState {
    let next = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "PR-006:dr" });
    for (const id of picks) next = act(next, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    if (next.pendingEffectChoice?.playerId === "player1") next = act(next, { type: "confirm_effect_choice", playerId: "player1" });
    return settle(next);
  }

  it("PR-006: 【ジュウクンドー】1番目に出ると、本来の BP の合計 3000 以下になるよう敵軍ラッシュエリアのユニットを好きな数選んで撃破する（出典: atwiki/page-1004）", () => {
    let s = redFirst({ rush: [inst("SPEC-E1K", "a"), inst("SPEC-E2K", "b"), inst("SPEC-E4K", "c")] });
    expect(canJuu(s)).toBe(true);
    s = juu(s, ["SPEC-E1K:a", "SPEC-E2K:b"]);
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2K:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E4K:c")).toBe("rush");
  });

  it("PR-006: 【ジュウクンドー】合計が 3000 を超えるユニットは選べない（出典: atwiki/page-1004「合計が3000以下になるように」）", () => {
    let s = redFirst({ rush: [inst("SPEC-E2K", "a"), inst("SPEC-E4K", "c")] });
    expect(canJuu(s)).toBe(true);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "PR-006:dr" });
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E4K:c" }).ok).toBe(false);
  });

  it("PR-006: 【ジュウクンドー】合計は「本来の BP」で数える（BP が下がっていても本来値で計算）（出典: atwiki/page-1004「カードに表記された本来のBP」）", () => {
    let s = redFirst({ rush: [{ ...inst("SPEC-E4K", "c"), bpModifier: -3000 }, inst("SPEC-E1K", "a")] });
    expect(canJuu(s)).toBe(true);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "PR-006:dr" });
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E4K:c" }).ok).toBe(false);
  });

  it("PR-006: 【ジュウクンドー】1体以上撃破したらアタックできない（「アタックするかわりに」）（出典: atwiki/page-1004・08-errata R-ERR-RS106）", () => {
    const s = redFirst({ rush: [inst("SPEC-E1K", "a")] });
    expect(canJuu(s)).toBe(true);
    const done = juu(s, ["SPEC-E1K:a"]);
    expect(legal(done).some((a) => a.type === "battle" && a.attackerInstanceId === "PR-006:dr")).toBe(false);
  });

  it("PR-006: 【ジュウクンドー】1体も撃破しなければアタックできる（RS-106 の読み替え「そうしたとき、これはアタックすることができない」を当てはめる）（出典: 08-errata R-ERR-RS106・grnrngr/faq-card-plomo RR-006 →RS-106）", () => {
    const s = redFirst({ rush: [inst("SPEC-E1K", "a")] });
    expect(canJuu(s)).toBe(true);
    const none = juu(s, []);
    expect(legal(none).some((a) => a.type === "battle" && a.attackerInstanceId === "PR-006:dr")).toBe(true);
  });

  it("PR-006: 【ジュウクンドー】敵軍バトルエリアにユニットがいない（アタックできない）ときは発動できない（RS-106 の読み替えを当てはめる）（出典: 08-errata R-ERR-RS106・grnrngr/faq-card-2 RS-106 Q6）", () => {
    expect(canJuu(redFirst({ battle: [], rush: [inst("SPEC-E1K", "a")] }))).toBe(false);
  });

  it("PR-006: 【ジュウクンドー】1番目以外で出たとき（NC 不成立）は発動できない（出典: atwiki/page-1004「CN：1」・R-CN-02）", () => {
    expect(canJuu(redFirst({ rush: [inst("SPEC-E1K", "a")] }, 1))).toBe(false);
  });

  it("PR-006: 公式Q&A — 撃破対象はすべて先に選び、確定後にまとめて撃破する（出典: grnrngr/faq-card-plomo RR-006 →faq-card-2 RS-106 Q1）", () => {
    let s = redFirst({ rush: [inst("SPEC-E1K", "a"), inst("SPEC-E2K", "b")] });
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "PR-006:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1K:a" });
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("rush");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E2K:b" });
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(settle(s).players.player2.rush).toHaveLength(0);
  });

  it("PR-006: 公式Q&A — 敵軍ラッシュエリアにコロンがあると CN が2になり、2番目に出て発動できる（1番目では発動しない）（出典: grnrngr/faq-card-plomo RR-006 →faq-card-2 RS-106 Q2）", () => {
    expect(canJuu(redFirst({ rush: [inst("RS-140", "colon"), inst("SPEC-E1K", "a")] }, 1))).toBe(true);
    expect(canJuu(redFirst({ rush: [inst("RS-140", "colon"), inst("SPEC-E1K", "a")] }, 0))).toBe(false);
  });

  it("PR-006: 公式Q&A — 敵軍バトルエリアがジェットファルコンだけなら発動できない（出典: grnrngr/faq-card-plomo RR-006 →faq-card-2 RS-106 Q3）", () => {
    expect(canJuu(redFirst({ battle: [inst("RS-135", "jf")], rush: [inst("SPEC-E1K", "a")] }))).toBe(false);
  });

  it("PR-006: 公式Q&A — ジュウクンドーはアタックではないので、相手は隠流忍術を使えない（出典: grnrngr/faq-card-plomo RR-006 →faq-card-2 RS-106 Q4）", () => {
    let s = st(
      {
        player1: { rush: [inst("PR-006", "dr")] },
        player2: { battle: [inst("TST-UNIT-0", "wall")], rush: [inst("SPEC-E1K", "a"), inst("TST-UNIT-0", "sub")], hand: [inst("RS-018", "n1")], command: [released("TST-OP-MA", "m1")], power: powerCards(5) },
      },
      EXTRA,
    );
    s = enter(s, "PR-006:dr");
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "PR-006:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1K:a" });
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(canUseCard(s, "player2", "RS-018:n1")).toBe(false);
  });

  it("PR-006: 公式Q&A — ダイノガッツで場に留まった対象を、もう一度選んで撃破することはできない（出典: grnrngr/faq-card-plomo RR-006 →faq-card-2 RS-106 Q5）", () => {
    let s = st(
      {
        player1: { rush: [inst("PR-006", "dr")] },
        player2: { battle: [inst("TST-UNIT-0", "wall")], rush: [inst("SPEC-E1K", "a")], hand: [inst("RS-027", "dg")], command: [released("TST-OP", "c")], deck: deckCards(5, "e"), power: powerCards(5) },
      },
      EXTRA,
    );
    s = enter(s, "PR-006:dr");
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "PR-006:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1K:a" });
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(canUseCard(s, "player2", "RS-027:dg")).toBe(true);
    s = settle(useCard(s, "player2", "RS-027:dg"));
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("rush");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1"; i++) s = settle(act(s, { type: "confirm_effect_choice", playerId: "player1" }));
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("rush");
  });

  it("PR-006: 公式Q&A — 相手が前のターンにラッシュしたデカレッドを、自分のデカグリーンでバトルエリアに出させられる（出典: grnrngr/faq-card-plomo RR-006 →faq-card-2 RS-106 Q7）", () => {
    let s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { rush: [inst("RS-108", "g"), ...fillers(2)], deck: deckCards(5) },
      player2: { hand: [inst("PR-006", "dr")], command: [released("TST-OP-OT", "ot")], power: powerCards(3), deck: deckCards(5, "e") },
    });
    const r = rushFromHand(s, "player2", "PR-006:dr");
    expect(r.ok, r.error).toBe(true);
    s = toPhase(endTurn(r.state), "player1", "battle");
    s = passEntry(enter(s, "TST-UNIT-0:fill0"));
    s = passEntry(enter(s, "TST-UNIT-0:fill1"));
    s = enter(s, "RS-108:g");
    expect(choiceIds(s)).toContain("PR-006:dr");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "PR-006:dr" });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "PR-006:dr")).toBe("battle");
  });
});

// ===========================================================================
describe("PR-007 アカレンジャー", () => {
  it("PR-007: カタログ本文・スペックが出典と一致（レアリティはスーパーレア）（出典: atwiki/page-1005）", () => {
    expectCatalogText("PR-007", "【レッドビュート】「SP1」 自軍ターン中、これが敵軍ユニットを撃破したとき、敵軍ラッシュエリアからBP2000以下のユニットを1体選んで撃破する。");
    expectUnit("PR-007", { name: "アカレンジャー", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 6, comboNumber: 5, features: ["レッド", "男"], rarity: "SR" });
  });

  function fifth(n = 4, rush = [inst("SPEC-E2K", "r2"), inst("SPEC-E3K", "r3")]): GameState {
    const s = st({ player1: { battle: fillers(n), rush: [inst("PR-007", "aka")] }, player2: { battle: [inst("TST-UNIT-0", "def")], rush } }, EXTRA);
    return enter(s, "PR-007:aka");
  }

  it("PR-007: 5番目に出ると「SP1」になりストライクできる／5番目以外ではできない（出典: atwiki/page-1005「CN：5」）", () => {
    expect(canStrike(fifth(), "PR-007:aka")).toBe(true);
    expect(canStrike(fifth(1), "PR-007:aka")).toBe(false);
  });

  it.fails("PR-007: NC 成立後、バトルで敵軍ユニットを撃破すると敵軍ラッシュエリアの BP2000 以下を1体選んで撃破する（BP3000 は対象外。強制）（出典: atwiki/page-1005） — 既知の不具合: CARD-PR-007 再録（RS-126）の【レッドビュート】の撃破が発動しない（「SP1」は働く）", () => {
    let s = settle(attack(fifth(), "PR-007:aka", "TST-UNIT-0:def"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-007");
    expect(choiceIds(s)).toEqual(["SPEC-E2K:r2"]);
    expect(canSkip(s)).toBe(false);
    s = settle(pick(s, "SPEC-E2K:r2"));
    expect(zoneOf(s, "player2", "SPEC-E2K:r2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3K:r3")).toBe("rush");
  });

  it.fails("PR-007: 公式Q&A — 【レッドビュート】で撃破しても、もう一度【レッドビュート】は発動しない（バトルで撃破したときに1度だけ）（出典: grnrngr/faq-card-plomo PR-007 Q） — 既知の不具合: CARD-PR-007 再録（RS-126）の【レッドビュート】の撃破が発動しない（「SP1」は働く）", () => {
    let s = settle(attack(fifth(4, [inst("SPEC-E1K", "a"), inst("SPEC-E2K", "b")]), "PR-007:aka", "TST-UNIT-0:def"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-007");
    s = settle(pick(s, "SPEC-E1K:a"));
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-E2K:b")).toBe("rush");
  });

  it("PR-007: NC 不成立（5番目以外）なら撃破しても【レッドビュート】は発動しない（出典: atwiki/page-1005「CN：5」・R-CN-02）", () => {
    const s = settle(attack(fifth(1), "PR-007:aka", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("discard");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-E2K:r2")).toBe("rush");
  });

  it("PR-007: 敵軍ターン中（アタックされて撃破した場合）は発動しない（出典: atwiki/page-1005「自軍ターン中」）", () => {
    let s = st(
      { activePlayer: "player2", player1: { battle: [{ ...inst("PR-007", "aka"), activatedNcEffects: ["red_boot"] }] }, player2: { battle: [inst("TST-UNIT-0", "atk")], rush: [inst("SPEC-E2K", "r2")] } },
      EXTRA,
    );
    s = settle(attack(s, "TST-UNIT-0:atk", "PR-007:aka", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-E2K:r2")).toBe("rush");
  });

  it("PR-007: 公式Q&A（RS-126 と同じカード名）— ゴレンジャーハリケーンを発動させたアカレンジャーは、【レッドビュート】が発動しなくても SP2 でストライクできる（出典: grnrngr/faq-card-3 RS-126 Q1）", () => {
    let s = st({
      player1: { rush: [inst("RS-259", "momo"), inst("RS-189", "ki"), inst("RS-190", "mido"), inst("RS-258", "ao"), inst("PR-007", "aka")] },
      player2: { rush: [inst("RS-263", "tank")], command: [released("RS-062", "cn5"), held("TST-OP", "h")], battle: [inst("TST-UNIT-0", "def")], deck: deckCards(5, "ed") },
    });
    for (const id of ["RS-259:momo", "RS-189:ki", "RS-190:mido", "RS-258:ao", "PR-007:aka"]) {
      s = settle(drain(enter(s, id), "player1", ["TST-OP:h"]));
      const pass = legal(s).find((a) => a.type === "pass_battle_entry");
      if (id !== "PR-007:aka" && pass) s = act(s, pass);
    }
    expect(canStrike(s, "PR-007:aka")).toBe(true);
    s = settle(act(s, { type: "strike", playerId: "player1", instanceId: "PR-007:aka" }));
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(2);
  });
});

// ===========================================================================
describe("PR-008 バイオハンター・シルバ", () => {
  it("PR-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-1006）", () => {
    expectCatalogText("PR-008", "【バイバスター】これは敵軍コマンドゾーンにある「OT」のコマンド1つにつきBP+1000される。これはBP5000以上のとき「SP1」になる。");
    expectUnit("PR-008", { name: "バイオハンター・シルバ", category: "DA", size: "S", bp: 3000, sp: "special", powerCost: 2, features: ["メカ", "人型"], rarity: "PR" });
  });

  const silva = (enemyCommand: ReturnType<typeof inst>[], active: PlayerId = "player1") =>
    st({ activePlayer: active, player1: { battle: [inst("PR-008", "sv")] }, player2: { command: enemyCommand, power: powerCards(3, "e") } });

  it("PR-008: 敵軍コマンドゾーンの OT コマンド（リリース状態）1つにつき BP+1000、OT 以外は数えない（出典: atwiki/page-1006）", () => {
    expect(bpOf(silva([]), "player1", "PR-008:sv")).toBe(3000);
    expect(bpOf(silva([released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2"), released("TST-OP-ET", "x")]), "player1", "PR-008:sv")).toBe(5000);
  });

  it("PR-008: ホールド状態の OT コマンドも1つにつき +1000（1つで BP4000）（出典: atwiki/page-1006）", () => {
    expect(bpOf(silva([held("TST-OP-OT", "o1"), held("TST-OP-ET", "x")]), "player1", "PR-008:sv")).toBe(4000);
  });

  it("PR-008: BP5000 以上なら「SP1」（ストライクで1点）、BP4000 ならストライクできない（出典: atwiki/page-1006）", () => {
    expect(strikeDmg(silva([held("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")]), "PR-008:sv")).toBe(1);
    expect(canStrike(silva([held("TST-OP-OT", "o1")]), "PR-008:sv")).toBe(false);
  });

  it("PR-008: 公式Q&A（RS-079 と同じ本文）— バイバスターは相手のターンも有効（出典: grnrngr/faq-card-2 RS-079 Q1）", () => {
    expect(bpOf(silva([released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")], "player2"), "player1", "PR-008:sv")).toBe(5000);
  });

  it("PR-008: 公式Q&A（RS-079 と同じ本文）— ガオ・ソウル（BP+4000）で BP5000 以上になった場合も SP1（出典: grnrngr/faq-card-2 RS-079 Q2）", () => {
    const s = st({ phase: "rush", player1: { battle: [inst("PR-008", "sv")], hand: [inst("RS-025", "soul")], command: [released("TST-OP", "wb")], power: powerCards(2) }, player2: { power: powerCards(3, "e") } });
    expect(canStrike(toPhase(s, "player1", "battle"), "PR-008:sv")).toBe(false);
    const r = playOp(s, "player1", "RS-025:soul", "PR-008:sv");
    expect(r.ok, r.error).toBe(true);
    const b = toPhase(r.state, "player1", "battle");
    expect(bpOf(b, "player1", "PR-008:sv")).toBe(7000);
    expect(strikeDmg(b, "PR-008:sv")).toBe(1);
  });
});

// ===========================================================================
describe("PR-009 サンバルカンロボ", () => {
  it("PR-009: カタログ本文・スペックが出典と一致（能力名は【オーロラプラズマ返し】）（出典: atwiki/page-1007）", () => {
    expectCatalogText("PR-009", "合体―コスモバルカン＋ブルバルカン 【オーロラプラズマ返し】自軍ダメージが6点のとき、このユニットは次の能力を得る。⇒SP2");
    expectUnit("PR-009", { name: "サンバルカンロボ", category: "ET", size: "L", bp: 9000, sp: 1, powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit", rarity: "PR" });
  });

  const mk = (rush: ReturnType<typeof inst>[]) => st({ phase: "rush", player1: { hand: [inst("PR-009", "robo")], rush, command: [released("TST-OP-ET", "et")], power: powerCards(6) } });

  it("PR-009: 自軍のコスモバルカンとブルバルカンを捨札にしてラッシュする（出典: atwiki/page-1007「合体─」・R-ADD-06）", () => {
    const r = rushFromHand(mk([inst("RS-074", "cosmo"), inst("RS-075", "bull")]), "player1", "PR-009:robo");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PR-009:robo")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-074:cosmo")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-075:bull")).toBe("discard");
  });

  it("PR-009: 合体素材の片方（ブルバルカン）がなければラッシュできない（出典: atwiki/page-1007）", () => {
    expect(canStartRush(mk([inst("RS-074", "cosmo")]), "player1", "PR-009:robo")).toBe(false);
  });

  const roboStrike = (damage: number, ops: ReturnType<typeof inst>[] = []) =>
    strikeDmg(st({ player1: { battle: [inst("PR-009", "robo")], damage, operation: ops, power: powerCards(8) }, player2: { power: powerCards(5, "e") } }), "PR-009:robo");

  it("PR-009: 自軍ダメージが6点でなければ SP1（ストライクで1点）（出典: atwiki/page-1007「SP：1」）", () => {
    expect(roboStrike(5)).toBe(1);
    expect(roboStrike(0)).toBe(1);
  });

  it.fails("PR-009: 【オーロラプラズマ返し】自軍ダメージがちょうど6点のとき SP2（ストライクで2点）（出典: atwiki/page-1007） — 既知の不具合: CARD-PR-009 再録（RS-073）の【オーロラプラズマ返し】（自軍ダメージ6点で「SP2」）が未実装", () => {
    expect(roboStrike(6)).toBe(2);
  });

  it("PR-009: 命の泉で負けずに自軍ダメージ7点のときは SP2 にならない（SP1）（出典: atwiki/page-1007「自軍ダメージが6点のとき」・RS-073 のカード評価）", () => {
    expect(roboStrike(7, [inst("RS-244", "izumi")])).toBe(1);
  });
});

// ===========================================================================
describe("PR-010 ゴレンジャーストーム", () => {
  it("PR-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-1008）", () => {
    expectCatalogText("PR-010", "このターン、Sユニットだけでコンビネーションするとき、5番目のユニットは「SP1」「BP12000」になる。");
    expectOp("PR-010", { name: "ゴレンジャーストーム", category: "ET", powerCost: 8, rarity: "PR" });
  });

  it("PR-010: 必要パワー8 — パワー7では使用できない（出典: atwiki/page-1008「必要パワー：8」）", () => {
    const s = rushPhase({ hand: [inst("PR-010", "op")], command: releasedCat("ET", 1), power: powerCards(7) });
    expect(canUseCard(s, "player1", "PR-010:op")).toBe(false);
  });

  /** ラッシュフェイズに PR-010 を使い、バトルフェイズに進んで ids の順に出す。 */
  function storm(ids: string[], p2: Partial<GameState["players"]["player2"]> = {}) {
    const units = ids.map((id, i) => inst(id, `u${i}`));
    const r = playOp(st({ phase: "rush", player1: { hand: [inst("PR-010", "op")], power: powerCards(8), command: releasedCat("ET", 1), rush: units, deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA), "player1", "PR-010:op");
    if (!r.ok) throw new Error(`storm: ${r.error}`);
    let s = toPhase(settle(r.state), "player1", "battle");
    units.forEach((u, i) => {
      s = enter(s, u.instanceId);
      if (i < units.length - 1) s = passEntry(s);
    });
    return { s, units };
  }

  it("PR-010: S ユニットだけのコンビネーションで5番目が BP12000・「SP1」になる（4番目は変わらない）（出典: atwiki/page-1008）", () => {
    const { s, units } = storm(["TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0", "SPEC-S-NOSP"]);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(12000);
    expect(bpOf(s, "player1", units[3]!.instanceId)).toBe(1000);
    expect(spOf(s, "player1", units[4]!.instanceId)).toBe(1);
  });

  it("PR-010: 5番目は「SP1」に“なる”（元の SP が2でも SP1）（出典: atwiki/page-1008「「SP1」…になる」）", () => {
    const { s, units } = storm(["TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0", "SPEC-S-SP2"]);
    expect(spOf(s, "player1", units[4]!.instanceId)).toBe(1);
  });

  it("PR-010: M ユニットを含むコンビネーションでは5番目は変わらない（出典: atwiki/page-1008「Sユニットだけで」）", () => {
    const { s, units } = storm(["TST-UNIT-0", "SPEC-M", "TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0"]);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(1000);
  });

  it("PR-010: 公式Q&A（RS-001 と同じ本文）— コロンでコンビネーションナンバーが増えても5番目なら効果を得る（出典: grnrngr/faq-card-1 RS-001 Q1）", () => {
    const { s, units } = storm(["TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0", "TST-UNIT-0"], { rush: [inst("RS-140", "colon")] });
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(12000);
  });

  it("PR-010: 効果は「このターン」だけ — 使わなかった次の自軍ターンに5体並べても5番目は変わらない（出典: atwiki/page-1008「このターン、」）", () => {
    const units = ["a", "b", "c", "d", "e"].map((x) => inst("TST-UNIT-0", x));
    const r = playOp(st({ phase: "rush", player1: { hand: [inst("PR-010", "op")], power: powerCards(8), command: releasedCat("ET", 1), rush: units, deck: deckCards(8) }, player2: { deck: deckCards(8, "e") } }, EXTRA), "player1", "PR-010:op");
    expect(r.ok, r.error).toBe(true);
    let s = endTurn(settle(r.state));
    s = toPhase(endTurn(s), "player1", "battle");
    units.forEach((u, i) => {
      s = enter(s, u.instanceId);
      if (i < units.length - 1) s = passEntry(s);
    });
    expect(bpOf(s, "player1", "TST-UNIT-0:e")).toBe(1000);
  });
});
