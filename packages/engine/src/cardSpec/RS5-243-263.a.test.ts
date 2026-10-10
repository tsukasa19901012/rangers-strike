/**
 * カード別スペック: RS-243〜RS-248（第5弾「五龍の逆鱗」獣奏剣〜プリズムパワー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか card_1/card_3/card_4/card_6/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *     再録カード（気力・疾風流超忍法・プリズムパワー）の atwiki ページには元カード（RS-017/RS-026/RS-010）の Q&A が載っている。
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canSkip,
  canUse,
  choiceIds,
  choiceOptions,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectOpStats,
  fillers,
  heldCount,
  held,
  inst,
  legal,
  nextPhase,
  payAndUse,
  pick,
  powerCards,
  released,
  releasedN,
  settle,
  strike,
  st,
  sUnit,
  tryAct,
  tryPayAndUse,
  zoneOf,
  CMD,
} from "./RS5-243-263.helpers";
import type { GameState, PlayerId } from "../types/game";

/** バトル進入にホールドが要るか（要らなければ 0、要れば必要数、出られなければ null）。 */
function entryHolds(s: GameState, instanceId: string, playerId: PlayerId = "player1"): number | null {
  const direct = tryAct(s, { type: "move_to_battle", playerId, instanceId });
  if (direct.ok) return 0;
  const pay = tryAct(s, { type: "initiate_command_payment", playerId, kind: "battle_entry", sourceInstanceId: instanceId });
  if (pay.ok && pay.state.pendingCommandPayment) return pay.state.pendingCommandPayment.totalNeeded;
  return null;
}

// ===========================================================================
describe("RS-243 獣奏剣", () => {
  const TEXT =
    "このターン、すべての自軍ユニットは、「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれていても、そのテキストは無効になる。";

  /** 守護獣サーベルタイガー（※1つホールドしなければ出られない）2体をラッシュエリアに置き、獣奏剣を使って（または使わずに）バトルフェイズへ。 */
  function sabers(useSword: boolean): GameState {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-243", "sw")],
        rush: [inst("RS-038", "t1"), inst("RS-038", "t2")],
        command: [released(CMD.WB, "pay"), released(CMD.WB, "c1"), released(CMD.WB, "c2")],
        power: powerCards(3),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    if (useSword) s = payAndUse(s, "player1", "RS-243:sw");
    return nextPhase(s);
  }

  it("RS-243: カタログ本文・スペックが出典と一致（出典: atwiki/page-418）", () => {
    expectCatalogText("RS-243", TEXT);
    expectOpStats("RS-243", { name: "獣奏剣", category: "WB", powerCost: 3 });
  });

  it("RS-243: 使用すると捨札になる（常駐ではない）（出典: atwiki/page-418）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-243", "sw")], command: [released(CMD.WB, "pay")], power: powerCards(3) },
    });
    s = payAndUse(s, "player1", "RS-243:sw");
    expect(zoneOf(s, "player1", "RS-243:sw")).toBe("discard");
  });

  it("RS-243: 必要パワー3 — パワー2では使用できない（出典: atwiki/page-418「必要パワー：3」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-243", "sw")], command: [released(CMD.WB, "pay")], power: powerCards(2) },
    });
    expect(canUse(s, "player1", "RS-243:sw")).toBe(false);
  });

  it("RS-243: 使わなければ守護獣サーベルタイガーはコマンドを1つホールドしないとバトルエリアに出られない（対照）（出典: atwiki/page-82・page-418）", () => {
    expect(entryHolds(sabers(false), "RS-038:t1")).toBe(1);
  });

  // 「このターン、すべての自軍ユニットは…そのテキストは無効になる」
  it("RS-243: 使用したターン、「1つホールドしなければ出られない」自軍ユニットはホールドせずにバトルエリアに出られる（出典: atwiki/page-418）", () => {
    const s = sabers(true);
    expect(entryHolds(s, "RS-038:t1")).toBe(0);
    const after = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-038:t1" });
    expect(after.players.player1.command.filter((c) => !c.commandHeld)).toHaveLength(2);
  });

  it("RS-243: 「すべての自軍ユニット」— 2体目もホールドせずに出られる（出典: atwiki/page-418「すべての自軍ユニットは」）", () => {
    let s = sabers(true);
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-038:t1" });
    const pass = legal(s).find((a) => a.type === "pass_battle_entry");
    if (pass) s = act(s, pass);
    expect(entryHolds(s, "RS-038:t2")).toBe(0);
  });

  it("RS-243: 効果は「このターン」だけ — 使用したターンはホールド不要、次の自軍ターンは再びホールドが要る（出典: atwiki/page-418「このターン、」）", () => {
    let s = sabers(true);
    expect(entryHolds(s, "RS-038:t1")).toBe(0);
    s = nextPhase(s);
    for (let i = 0; i < 30 && !(s.activePlayer === "player1" && s.phase === "battle"); i += 1) {
      const a =
        legal(s).find((x) => x.type === "return_all_battle_to_rush") ??
        legal(s).find((x) => x.type === "draw") ??
        legal(s).find((x) => x.type === "release_start_commands") ??
        legal(s).find((x) => x.type === "end_phase");
      if (!a) break;
      s = act(s, a);
    }
    expect(entryHolds(s, "RS-038:t1")).toBe(1);
  });

  // faq-card-6 RS-364 Q「はい、できます。」（ヘルサターン総統で得た「…と書かれているかのように扱い」も獣奏剣で無効にできる）
  const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 2000, sp: 1 });
  function hellSaturn(useSword: boolean): GameState {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-243", "sw")],
          rush: [inst("RS-364", "hs"), inst("SPEC-DA-S", "da")],
          command: [released(CMD.WB, "pay"), released(CMD.DA, "c1")],
          power: powerCards(3),
          deck: deckCards(5),
        },
      },
      [DA_S],
    );
    if (useSword) s = payAndUse(s, "player1", "RS-243:sw");
    return nextPhase(s);
  }

  // 既知の不具合: CARD-RS-364（範囲外）【黒き太陽神への忠誠】のホールド要件自体が付与されない（獣奏剣なしでもホールド不要）。獣奏剣側の無効化は実装済み
  it.fails("RS-243: 公式Q&A — ヘルサターン総統の効果で得た「…ホールドしなければバトルエリアに出られない」も獣奏剣で無効にできる（獣奏剣なしならホールドが要る）（出典: grnrngr/faq-card-6 RS-364 Q）", () => {
    // 「はい、できます。」
    expect(entryHolds(hellSaturn(false), "SPEC-DA-S:da")).toBe(1);
    expect(entryHolds(hellSaturn(true), "SPEC-DA-S:da")).toBe(0);
  });
});

// ===========================================================================
describe("RS-244 命の泉", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分も相手も、ダメージが9点になるまでゲームに負けない。ただし、自分自身の山札からカードを引くべきときに引けなければゲームに負ける。";

  /** player1 が1点ストライクし、player2 のダメージが before+1 になる。 */
  function strikeOnce(before: number, p1Ops: string[], p2Ops: string[]): GameState {
    let s = st({
      player1: {
        battle: [inst("TST-UNIT-0", "st")],
        operation: p1Ops.map((id, i) => inst(id, `o${i}`)),
        deck: deckCards(3),
      },
      player2: {
        power: damageCards(before, "d"),
        damage: before,
        operation: p2Ops.map((id, i) => inst(id, `eo${i}`)),
        deck: deckCards(3, "e"),
      },
    });
    s = settle(strike(s, "TST-UNIT-0:st"));
    expect(s.players.player2.damage).toBe(before + 1);
    return s;
  }

  it("RS-244: カタログ本文・スペックが出典と一致（出典: atwiki/page-419）", () => {
    expectCatalogText("RS-244", TEXT);
    expectOpStats("RS-244", { name: "命の泉", category: "WB", powerCost: 5, keyword: "常駐" });
  });

  it("RS-244: 使用すると常駐置き場に配置される（出典: atwiki/page-419「※常駐」）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-244", "iz")], command: [released(CMD.WB, "pay")], power: powerCards(5) },
    });
    s = payAndUse(s, "player1", "RS-244:iz");
    expect(zoneOf(s, "player1", "RS-244:iz")).toBe("operation");
  });

  it("RS-244: 命の泉がなければダメージ7点で負ける（対照）（出典: R-WIN-01）", () => {
    expect(strikeOnce(6, [], []).winner).toBe("player1");
  });

  it("RS-244: 配置したプレイヤー自身はダメージ7点・8点では負けない（出典: atwiki/page-419「ダメージが9点になるまでゲームに負けない」）", () => {
    expect(strikeOnce(6, [], ["RS-244"]).winner).toBeNull();
    expect(strikeOnce(7, [], ["RS-244"]).winner).toBeNull();
  });

  it("RS-244: 相手（配置していないプレイヤー）もダメージ7点・8点では負けない（出典: atwiki/page-419「自分も相手も」）", () => {
    expect(strikeOnce(6, ["RS-244"], []).winner).toBeNull();
    expect(strikeOnce(7, ["RS-244"], []).winner).toBeNull();
  });

  it("RS-244: ダメージ9点になれば負ける（出典: atwiki/page-419「9点になるまで」）", () => {
    expect(strikeOnce(8, [], ["RS-244"]).winner).toBe("player1");
    expect(strikeOnce(8, ["RS-244"], []).winner).toBe("player1");
  });

  it("RS-244: 命の泉があっても、山札から引くべきときに引けなければ負ける（出典: atwiki/page-419「ただし…引けなければゲームに負ける」・R-WIN-03）", () => {
    const s = st({ phase: "start", player1: { deck: [], hand: [], operation: [inst("RS-244", "iz")] } });
    const r = tryAct(s, { type: "draw", playerId: "player1" });
    expect(r.ok).toBe(true);
    expect(r.state.winner).toBe("player2");
  });

  // faq-card-5 RS-244 Q1／faq-card-3 RS-130 Q2「ターンプレイヤーの勝利となります。」
  it("RS-244: 公式Q&A — 互いにダメージ7点以上のとき、レッドワンで命の泉をパワーゾーンに送るとターンプレイヤーの勝利（出典: grnrngr/faq-card-5 RS-244 Q1・faq-card-3 RS-130 Q2）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-130", "r1")], operation: [inst("RS-244", "izumi")], power: damageCards(7, "d1"), damage: 7 },
      player2: { power: damageCards(7, "d2"), damage: 7 },
    });
    s = enter(s, "RS-130:r1");
    s = pick(s, "RS-244:izumi");
    s = settle(s);
    expect(s.winner).toBe("player1");
  });

  // faq-card-6 RS-348 Q「自分はダメージが１４点になるまでゲームに負けず、相手はダメージが９点になるまでゲームに負けないことになります。」
  it("RS-244: 公式Q&A — 自分がメディテーション、相手が命の泉を配置しているとき、自分は14点まで、相手は9点まで負けない（出典: grnrngr/faq-card-6 RS-348 Q）", () => {
    // 相手（命の泉配置）: 8点 → 9点で負ける
    expect(strikeOnce(8, ["RS-348"], ["RS-244"]).winner).toBe("player1");
    // 相手: 7点 → 8点では負けない
    expect(strikeOnce(7, ["RS-348"], ["RS-244"]).winner).toBeNull();
    // 自分（メディテーション配置）: 10点で、相手のストライク1点＋追加1点で12点になっても負けない
    let s = st({
      activePlayer: "player2",
      player1: { power: damageCards(10, "d"), damage: 10, operation: [inst("RS-348", "med")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "st")], operation: [inst("RS-244", "iz")], deck: deckCards(3, "e") },
    });
    s = settle(strike(s, "TST-UNIT-0:st", "player2"));
    expect(s.players.player1.damage).toBe(12);
    expect(s.winner).toBeNull();
  });
});

// ===========================================================================
describe("RS-245 ガオメインバスター", () => {
  const TEXT = "敵軍Sユニットを1体選び撃破する。";

  function gao(p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) {
    return st({
      phase: "rush",
      player1: { hand: [inst("RS-245", "gb")], command: [released(CMD.WB, "pay")], power: powerCards(5), deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
  }

  it("RS-245: カタログ本文・スペックが出典と一致（出典: atwiki/page-420）", () => {
    expectCatalogText("RS-245", TEXT);
    expectOpStats("RS-245", { name: "ガオメインバスター", category: "WB", powerCost: 5 });
  });

  it("RS-245: 敵軍バトルエリアの S ユニットを1体選んで撃破し、使ったカードは捨札になる（出典: atwiki/page-420）", () => {
    let s = gao({ battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-0", "es2")] });
    s = payAndUse(s, "player1", "RS-245:gb");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "TST-UNIT-0:es");
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:es2")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-245:gb")).toBe("discard");
  });

  it("RS-245: M ユニット・自軍ユニットは選べない（出典: atwiki/page-420「敵軍Sユニットを」）", () => {
    let s = gao({ battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em")] }, { rush: [inst("TST-UNIT-0", "own")] });
    s = payAndUse(s, "player1", "RS-245:gb");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
  });

  it("RS-245: 撃破は強制（選択を見送れない）（出典: atwiki/page-420「選び撃破する」）", () => {
    let s = gao({ battle: [inst("TST-UNIT-0", "es")] });
    s = payAndUse(s, "player1", "RS-245:gb");
    expect(canSkip(s)).toBe(false);
  });

  it("RS-245: 必要パワー5 — パワー4では使用できない（出典: atwiki/page-420「必要パワー：5」）", () => {
    const s = gao({ battle: [inst("TST-UNIT-0", "es")] }, { power: powerCards(4) });
    expect(canUse(s, "player1", "RS-245:gb")).toBe(false);
  });

  // 「ユニット」はラッシュエリア・バトルエリアにあるもの（R-TGT-01）
  // 既知の不具合: CARD-RS-245 選べるのが敵軍バトルエリアだけで、敵軍ラッシュエリアの S ユニットを選べない
  it.fails("RS-245: 敵軍ラッシュエリアの S ユニットも選べる（出典: atwiki/page-420・R-TGT-01「ユニット」はラッシュエリア・バトルエリア）", () => {
    let s = gao({ battle: [inst("TST-UNIT-0", "es")], rush: [inst("TST-UNIT-0", "er")] });
    s = payAndUse(s, "player1", "RS-245:gb");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:er", "TST-UNIT-0:es"]);
    s = pick(s, "TST-UNIT-0:er");
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("discard");
  });

  // 「撃破する」なので「撃破されて捨札になったとき」の効果が誘発する（ファイズAF: 捨札からファイズをラッシュエリアに出す）
  it("RS-245: 撃破なので、撃破されたユニットの「撃破されて捨札になったとき」の効果が働く（出典: atwiki/page-420「撃破する」・RK-203 本文）", () => {
    let s = gao({ battle: [inst("RK-203", "af")], discard: [inst("RK-064", "faiz")] });
    s = payAndUse(s, "player1", "RS-245:gb");
    s = pick(s, "RK-203:af");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player2"; i += 1) {
      s = pick(s, s.pendingEffectChoice.validInstanceIds.includes("RK-064:faiz") ? "RK-064:faiz" : s.pendingEffectChoice.validInstanceIds[0]!);
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "RK-203:af")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-064:faiz")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-246 気力", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）すべての自軍Sユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP＋1000される。";

  function kiState(opts: { active: PlayerId; releasedN: number; heldN?: number; kiCount?: number }) {
    return st({
      activePlayer: opts.active,
      player1: {
        operation: Array.from({ length: opts.kiCount ?? 1 }, (_, i) => inst("RS-246", `ki${i}`)),
        battle: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-2", "m")],
        rush: [inst("TST-UNIT-0", "s2")],
        command: [
          ...Array.from({ length: opts.releasedN }, (_, i) => released(CMD.MA, `r${i}`)),
          ...Array.from({ length: opts.heldN ?? 0 }, (_, i) => held(CMD.MA, `h${i}`)),
        ],
      },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
  }

  it("RS-246: カタログ本文・スペックが出典と一致（出典: atwiki/page-27）", () => {
    expectCatalogText("RS-246", TEXT);
    expectOpStats("RS-246", { name: "気力", category: "MA", powerCost: 2, keyword: "常駐" });
  });

  it("RS-246: 使用すると常駐置き場に配置される（出典: atwiki/page-27「※常駐」）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RS-246", "ki")], command: [released(CMD.MA, "pay")], power: powerCards(2) } });
    s = payAndUse(s, "player1", "RS-246:ki");
    expect(zoneOf(s, "player1", "RS-246:ki")).toBe("operation");
  });

  it("RS-246: 敵軍ターン中、自軍 S ユニット（バトルエリア・ラッシュエリア）はリリース状態の自軍コマンド1つにつき BP+1000（ホールド状態は数えない）（出典: atwiki/page-27）", () => {
    const s = kiState({ active: "player2", releasedN: 3, heldN: 2 });
    expect(bpOf(s, "player1", "TST-UNIT-0:s1")).toBe(4000);
    expect(bpOf(s, "player1", "TST-UNIT-0:s2")).toBe(4000);
  });

  it("RS-246: 自軍ターン中は上がらない（出典: atwiki/page-27「敵軍ターン中」）", () => {
    expect(bpOf(kiState({ active: "player1", releasedN: 3 }), "player1", "TST-UNIT-0:s1")).toBe(1000);
  });

  it("RS-246: M ユニット・敵軍ユニットは上がらない（出典: atwiki/page-27「すべての自軍Sユニットは」）", () => {
    const s = kiState({ active: "player2", releasedN: 3 });
    expect(bpOf(s, "player1", "TST-UNIT-2:m")).toBe(3000);
    expect(bpOf(s, "player2", "TST-UNIT-0:e")).toBe(1000);
  });

  it("RS-246: 2枚配置すれば効果は重複する（出典: atwiki/page-27・R-CONT-01）", () => {
    expect(bpOf(kiState({ active: "player2", releasedN: 2, kiCount: 2 }), "player1", "TST-UNIT-0:s1")).toBe(5000);
  });

  it("RS-246: 元の気力（RS-017）と重複する（同名の別カード）（出典: atwiki/page-27 再録・R-CONT-01）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { operation: [inst("RS-246", "a"), inst("RS-017", "b")], battle: [inst("TST-UNIT-0", "s")], command: releasedN(1, CMD.MA) },
    });
    expect(bpOf(s, "player1", "TST-UNIT-0:s")).toBe(3000);
  });

  // faq-card-4 RS-226 Q2「その場合は、バトルの時点でのＢＰを元に選んでください。」（RS-246 気力を名指し）
  it("RS-246: 公式Q&A — キラーオーがバトルで撃破したユニットが気力で BP が上がっていたら、バトルの時点の BP（3000+2000）より低いユニットを選ぶ（出典: grnrngr/faq-card-4 RS-226 Q2）", () => {
    const E3 = sUnit("SPEC-E3", { bp: 3000 });
    const M4 = sUnit("SPEC-M4", { size: "M", bp: 4000 });
    const M5 = sUnit("SPEC-M5", { size: "M", bp: 5000 });
    let s = st(
      {
        player1: { battle: [inst("RS-226", "k")] },
        player2: {
          battle: [inst("SPEC-E3", "t")],
          rush: [inst("SPEC-M4", "m4"), inst("SPEC-M5", "m5")],
          operation: [inst("RS-246", "kiryoku")],
          command: releasedN(2, "TST-OP", "ec"),
        },
      },
      [E3, M4, M5],
    );
    expect(bpOf(s, "player2", "SPEC-E3:t")).toBe(5000);
    s = settle(attack(s, "RS-226:k", "SPEC-E3:t"));
    expect(zoneOf(s, "player2", "SPEC-E3:t")).toBe("discard");
    expect(choiceIds(s)).toEqual(["SPEC-M4:m4"]);
  });
});

// ===========================================================================
describe("RS-247 疾風流超忍法", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる）BP8000以下のユニットがラッシュされたとき発動できる⇒そのユニットを持ち主の山札の上に戻す。";
  const S8 = sUnit("SPEC-S-8000", { bp: 8000 });
  const S9 = sUnit("SPEC-S-9000", { bp: 9000 });
  const S1 = sUnit("SPEC-S-1000", { bp: 1000 });
  const S5 = sUnit("SPEC-S-5000", { bp: 5000 });
  const SPECS = [S8, S9, S1, S5];

  /** player1 が手札の unitCardId をラッシュし、player2 が疾風流超忍法を構える。 */
  function setup(
    unitCardId: string,
    p1: Partial<GameState["players"]["player1"]> = {},
    p2: Partial<GameState["players"]["player2"]> = {},
  ) {
    return st(
      {
        phase: "rush",
        player1: {
          hand: [inst(unitCardId, "u")],
          command: [released(CMD.WB, "c"), released(CMD.OT, "co")],
          power: powerCards(8, "p1pw"),
          deck: deckCards(3, "p1d"),
          ...p1,
        },
        player2: {
          hand: [inst("RS-247", "ctr")],
          command: [released(CMD.MA, "m")],
          power: powerCards(3, "p2pw"),
          deck: deckCards(3, "p2d"),
          ...p2,
        },
      },
      SPECS,
    );
  }
  const rushU = (s: GameState, id = "u") => payAndUse(s, "player1", `${s.players.player1.hand.find((c) => c.instanceId.endsWith(`:${id}`))!.instanceId}`);

  it("RS-247: カタログ本文・スペックが出典と一致（出典: atwiki/page-424）", () => {
    expectCatalogText("RS-247", TEXT);
    expectOpStats("RS-247", { name: "疾風流超忍法", category: "MA", powerCost: 3, keyword: "カウンター" });
  });

  it("RS-247: BP8000 のユニットがラッシュされたとき使用でき、持ち主の山札の上に戻す（使ったカードは捨札）（出典: atwiki/page-424）", () => {
    let s = rushU(setup("SPEC-S-8000"));
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
    s = payAndUse(s, "player2", "RS-247:ctr");
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-S-8000:u");
    expect(zoneOf(s, "player2", "RS-247:ctr")).toBe("discard");
  });

  it("RS-247: 使わないこともできる（任意。パスすればユニットはラッシュエリアに残る）（出典: atwiki/page-424「発動できる」）", () => {
    let s = rushU(setup("SPEC-S-8000"));
    s = act(s, { type: "pass_rush_reaction", playerId: "player2" });
    expect(zoneOf(s, "player1", "SPEC-S-8000:u")).toBe("rush");
    expect(zoneOf(s, "player2", "RS-247:ctr")).toBe("hand");
  });

  it("RS-247: BP9000 のユニットのラッシュには使用できない（出典: atwiki/page-424「BP8000以下」）", () => {
    expect(canUse(rushU(setup("SPEC-S-9000")), "player2", "RS-247:ctr")).toBe(false);
  });

  it("RS-247: 自軍ターン中（自分のラッシュ）には使用できない（出典: atwiki/page-424「敵軍ターン中にのみ使用できる」）", () => {
    let s = st(
      {
        phase: "rush",
        player1: { hand: [inst("SPEC-S-1000", "own"), inst("RS-247", "ctr")], command: [released(CMD.WB, "c"), released(CMD.MA, "m")], power: powerCards(3) },
      },
      SPECS,
    );
    s = payAndUse(s, "player1", "SPEC-S-1000:own");
    expect(canUse(s, "player1", "RS-247:ctr")).toBe(false);
  });

  it("RS-247: 必要パワー3に足りない（パワー2）と使用できない（出典: atwiki/page-424「必要パワー：3」）", () => {
    expect(canUse(rushU(setup("SPEC-S-1000", {}, { power: powerCards(2, "p2pw") })), "player2", "RS-247:ctr")).toBe(false);
  });

  // atwiki/page-424 Q1「はい、対象になります。」
  it("RS-247: Q&A — 「アタックされる以外では相手に選ばれない」ユニット（ガタック）にも使用できる（出典: atwiki/page-424 Q1・grnrngr/faq-card-1 RS-026 Q1）", () => {
    const s = st({
      phase: "rush",
      pendingRush: { rusherPlayerId: "player1", rushedInstanceId: "RK-054:g", phasePlayerId: "player1" },
      player1: { rush: [inst("RK-054", "g")] },
      player2: { hand: [inst("RS-247", "ctr")], command: [released(CMD.MA, "m")], power: powerCards(3) },
    } as Parameters<typeof st>[0]);
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
  });

  // atwiki/page-424 Q2「はい、使用することができます」
  it("RS-247: Q&A — 敵軍ターン中に相手によって自軍ユニットがラッシュされたとき、その自軍ユニットに使用でき、自軍山札の上に戻る（出典: atwiki/page-424 Q2）", () => {
    let s = st(
      {
        phase: "rush",
        pendingRush: { rusherPlayerId: "player1", rushedInstanceId: "SPEC-S-1000:mine", phasePlayerId: "player1" },
        player2: { rush: [inst("SPEC-S-1000", "mine")], hand: [inst("RS-247", "ctr")], command: [released(CMD.MA, "m")], power: powerCards(3), deck: deckCards(2, "p2d") },
      } as Parameters<typeof st>[0],
      SPECS,
    );
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
    s = payAndUse(s, "player2", "RS-247:ctr");
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-S-1000:mine");
  });

  // atwiki/page-424 Q3「はい、使用することができます。」
  it("RS-247: Q&A — 相手がラッシュしたバイオジェット2号（【ステルス】）にも使用できる（出典: atwiki/page-424 Q3）", () => {
    const s = st({
      phase: "rush",
      pendingRush: { rusherPlayerId: "player1", rushedInstanceId: "RS-129:jet", phasePlayerId: "player1" },
      player1: { rush: [inst("RS-129", "jet")] },
      player2: { hand: [inst("RS-247", "ctr")], command: [released(CMD.MA, "m")], power: powerCards(3) },
    } as Parameters<typeof st>[0]);
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
  });

  // atwiki/page-424 Q4「はい、捨札にできます。」
  it.todo(
    "RS-247: Q&A — ジェットシーカーをラッシュ→疾風流超忍法で山札に戻されても【ラウンドレーダー】で敵軍パワーを2枚まで捨札にできる（出典: atwiki/page-424 Q4・grnrngr/faq-card-5 RS-265）— 山札に戻ったジェットシーカー（ラッシュエリアにない）の誘発を公開 API で観測する手順が確認できない（追加条件2体パワー送りのラッシュ＋カウンター使用＋誘発窓の組み立てが必要）",
  );

  // atwiki/page-424 Q5「はい、発動します。」
  it.todo(
    "RS-247: Q&A — ラッシュしたゴーマ16世を山札の上に戻されても【大地動転の玉】は発動する（出典: atwiki/page-424 Q5）— 継続効果が「発動した」ことの観測点が出典にない（どの時点の何に適用されたかが特定できない）",
  );

  // atwiki/page-424 Q6「は い、できます。…ラッシュに誘発した処理…をすべて完了させてから…実行してください。」
  it("RS-247: Q&A — 超電子レーダーの処理（パワーを1枚手札に戻す）を終えてから使用できる（出典: atwiki/page-424 Q6）", () => {
    let s = rushU(setup("SPEC-S-1000", { operation: [inst("RS-124", "radar")] }));
    for (let i = 0; i < 3 && s.pendingEffectChoice; i += 1) {
      const opts = choiceOptions(s, "player1");
      if (opts.length === 0) break;
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: opts[0]! });
    }
    expect(s.players.player1.hand.some((c) => c.cardId === "TST-P")).toBe(true);
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
    s = payAndUse(s, "player2", "RS-247:ctr");
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-S-1000:u");
  });

  // atwiki/page-424 Q7「い いえ、その場合は発動できません。」
  it("RS-247: Q&A — リリース状態のコマンド4つ以上で BP9000 以上になったファイヤーカイザーには使用できない（出典: atwiki/page-424 Q7）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-113", "fk")],
        rush: [inst("RS-576", "phoenix"), inst("RS-114", "barikion")],
        power: powerCards(6),
        command: [released(CMD.MA, "a"), released(CMD.MA, "b"), released(CMD.MA, "c"), released(CMD.MA, "d"), released(CMD.MA, "e")],
      },
      player2: { hand: [inst("RS-247", "ctr")], command: [released(CMD.MA, "m")], power: powerCards(3) },
    });
    let r = tryAct(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-113:fk" });
    for (let i = 0; i < 12 && r.ok && r.state.pendingZordSetup; i += 1) {
      const setupState = r.state.pendingZordSetup;
      if (setupState.step === "destination") r = tryAct(r.state, { type: "resolve_zord_setup", playerId: "player1", destination: "discard" });
      else if (setupState.step === "material") r = tryAct(r.state, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: setupState.validInstanceIds[0]! });
      else r = tryAct(r.state, { type: "resolve_zord_setup", playerId: "player1" });
    }
    for (let i = 0; i < 4 && r.ok && r.state.pendingCommandPayment?.playerId === "player1"; i += 1) {
      const p = r.state.pendingCommandPayment;
      r = tryAct(r.state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    expect(r.ok).toBe(true);
    s = r.state;
    expect(zoneOf(s, "player1", "RS-113:fk")).toBe("rush");
    expect(bpOf(s, "player1", "RS-113:fk")).toBeGreaterThanOrEqual(9000);
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(false);
  });

  // atwiki/page-424 Q8「相手が次の宣言を行うまでの間です。」
  it("RS-247: Q&A — 「ラッシュされたとき」は相手が次の宣言を行うまで。パスして次へ進んだ後は使用できない（出典: atwiki/page-424 Q8）", () => {
    let s = rushU(setup("SPEC-S-1000"));
    expect(legal(s).some((a) => a.playerId === "player1")).toBe(false);
    s = act(s, { type: "pass_rush_reaction", playerId: "player2" });
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(false);
  });

  // atwiki/page-424 Q9「はい、ウラ向きに置きます。」
  it("RS-247: Q&A — 山札の上に戻すカードはウラ向きに置く（出典: atwiki/page-424 Q9）", () => {
    let s = rushU(setup("SPEC-S-1000"));
    s = payAndUse(s, "player2", "RS-247:ctr");
    const top = s.players.player1.deck[0]!;
    expect(top.instanceId).toBe("SPEC-S-1000:u");
    expect(top.faceDown).not.toBe(false);
  });

  // atwiki/page-424 Q10「まずユニットのラッシュしたときの効果を適用してから」
  it("RS-247: Q&A — ラッシュしたときの効果（プテラノドンの【プテラビーム】）を先に適用してから使用できる（出典: atwiki/page-424 Q10）", () => {
    let s = rushU(setup("RS-039", { command: [released(CMD.WB, "c")] }, { command: [released(CMD.MA, "m"), held(CMD.ET, "heldEt")] }));
    expect(s.pendingEffectChoice?.playerId ?? "player1").toBe("player1");
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(false);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP-ET:heldEt" });
    expect(zoneOf(s, "player2", "TST-OP-ET:heldEt")).toBe("discard");
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
  });

  // atwiki/page-424 Q11（ダイカイオーヒガシ）
  it.todo(
    "RS-247: Q&A — ラッシュ時に BP8000 以下ならその後 BP が上がったダイカイオーヒガシも山札の上に戻る（出典: atwiki/page-424 Q11）— XG3-036 がカタログ未収録で再現できない",
  );

  // faq-card-5 RS-247 Q1（atwiki Q12）「はい、できます。」
  it("RS-247: 公式Q&A — 1体のラッシュに対し、1枚目の解決後に2枚目の疾風流超忍法を続けて使用できる（出典: grnrngr/faq-card-5 RS-247 Q1・atwiki/page-424 Q12）", () => {
    let s = rushU(
      setup("SPEC-S-1000", {}, { hand: [inst("RS-247", "ctr"), inst("RS-247", "ctr2")], command: [released(CMD.MA, "m1"), released(CMD.MA, "m2")] }),
    );
    s = payAndUse(s, "player2", "RS-247:ctr");
    expect(canUse(s, "player2", "RS-247:ctr2")).toBe(true);
  });

  // faq-card-5 RS-247 Q2（atwiki Q13）「いいえ、使用できません。…必要な自軍コマンドを全てホールドされてしまうからです。」
  it("RS-247: 公式Q&A — ガオパンダのラッシュで自軍コマンドがすべてホールドされると使用できない（出典: grnrngr/faq-card-5 RS-247 Q2・atwiki/page-424 Q13）", () => {
    const s = rushU(setup("RS-305", { command: [released(CMD.WB, "c")] }));
    expect(heldCount(s, "player2")).toBe(1);
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(false);
  });

  // faq-card-5 RS-247 Q3（atwiki Q14）「はい、できます。」
  it.todo(
    "RS-247: 公式Q&A — 第三の目で無効にされた後、2枚目の疾風流超忍法を改めて使用できる（出典: grnrngr/faq-card-5 RS-247 Q3・atwiki/page-424 Q14）— RK-011 第三の目でカウンターを無効にする公開アクション手順が確認できず再現できない",
  );

  // faq-card-5 RS-247 Q4（atwiki Q15）「はい、できます。」
  it("RS-247: 公式Q&A — BP4000以上8000以下の S ユニットのラッシュに、宏のオルゴール時計と両方を使用できる（出典: grnrngr/faq-card-5 RS-247 Q4・atwiki/page-424 Q15）", () => {
    let s = rushU(
      setup("SPEC-S-5000", {}, {
        hand: [inst("RS-247", "ctr"), inst("RK-012", "music")],
        command: [released(CMD.MA, "m"), released(CMD.ET, "e")],
        power: powerCards(4, "p2pw"),
      }),
    );
    expect(canUse(s, "player2", "RK-012:music")).toBe(true);
    s = payAndUse(s, "player2", "RK-012:music");
    expect(canUse(s, "player2", "RS-247:ctr")).toBe(true);
    s = payAndUse(s, "player2", "RS-247:ctr");
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-S-5000:u");
  });
});

// ===========================================================================
describe("RS-248 プリズムパワー", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分がカードを使用するとき発動できる。自軍コマンドを2つホールドすることで、使用するカードに必要なカテゴリのコマンドを1つホールドしたことにできる。";

  /** OT のカード（超電子頭脳 RS-008）を使う状況。OT コマンドは別のカードの支払いで使用済み。 */
  function prismState(withPrism: boolean, releasedEt = 2) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-008", "brain")],
        operation: withPrism ? [inst("RS-248", "prism")] : [],
        power: powerCards(3),
        command: [
          { ...held(CMD.OT, "ot"), paymentHeld: true },
          ...Array.from({ length: releasedEt }, (_, i) => released(CMD.ET, `e${i}`)),
        ],
      },
    });
  }
  const prismPay = (s: GameState, source: string) =>
    legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === source && a.prismSubstitute === true);

  it("RS-248: カタログ本文・スペックが出典と一致（出典: atwiki/page-276）", () => {
    expectCatalogText("RS-248", TEXT);
    expectOpStats("RS-248", { name: "プリズムパワー", category: "OT", powerCost: 2, keyword: "常駐" });
  });

  it("RS-248: 使用すると常駐置き場に配置される（出典: atwiki/page-276「※常駐」）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RS-248", "pp")], command: [released(CMD.OT, "pay")], power: powerCards(2) } });
    s = payAndUse(s, "player1", "RS-248:pp");
    expect(zoneOf(s, "player1", "RS-248:pp")).toBe("operation");
  });

  it("RS-248: 他カテゴリのコマンド2つをホールドして、必要カテゴリのコマンド1つのホールドに代えてカードを使用できる（出典: atwiki/page-276）", () => {
    const s0 = prismState(true);
    const pay = prismPay(s0, "RS-008:brain");
    expect(pay).toBeDefined();
    const s = act(s0, pay!);
    expect(zoneOf(s, "player1", "RS-008:brain")).toBe("operation");
    expect(s.players.player1.command.filter((c) => c.cardId === CMD.ET && c.commandHeld)).toHaveLength(2);
  });

  it("RS-248: 「発動できる」— 必要カテゴリのコマンドがあれば代用せず通常どおり支払える（出典: atwiki/page-276「発動できる」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-008", "brain")], operation: [inst("RS-248", "prism")], power: powerCards(3), command: [released(CMD.OT, "ot"), released(CMD.ET, "e0"), released(CMD.ET, "e1")] },
    });
    const normal = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-008:brain" && !a.prismSubstitute);
    expect(normal).toBeDefined();
    const after = act(s, normal!);
    expect(after.players.player1.command.filter((c) => c.commandHeld).map((c) => c.cardId)).toEqual([CMD.OT]);
  });

  it("RS-248: プリズムパワーがなければ同じ状況で使用できない（対照）（出典: atwiki/page-276）", () => {
    expect(canUse(prismState(false), "player1", "RS-008:brain")).toBe(false);
  });

  it("RS-248: ホールドできるリリース状態のコマンドが1つでは代用できない（出典: atwiki/page-276「自軍コマンドを2つホールドする」）", () => {
    expect(canUse(prismState(true, 1), "player1", "RS-008:brain")).toBe(false);
  });

  it("RS-248: ユニットのラッシュ（カードの使用）にも使える（出典: atwiki/page-276「自分がカードを使用するとき」）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("TST-UNIT-0", "wb")],
        operation: [inst("RS-248", "prism")],
        command: [{ ...held(CMD.WB, "wbc"), paymentHeld: true }, released(CMD.ET, "e1"), released(CMD.ET, "e2")],
      },
    });
    const pay = prismPay(s, "TST-UNIT-0:wb");
    expect(pay).toBeDefined();
    s = act(s, pay!);
    if (zoneOf(s, "player1", "TST-UNIT-0:wb") !== "rush") {
      const r = legal(s).find((a) => a.type === "rush" && a.instanceId === "TST-UNIT-0:wb");
      if (r) s = act(s, r);
    }
    expect(zoneOf(s, "player1", "TST-UNIT-0:wb")).toBe("rush");
  });

  // atwiki/page-276 Q1（grnrngr/faq-card-1 RS-010 Q1）「い いえ、それはできません。…本来はコマンドのホールドを必要としていないので…代用することはできません。」
  it("RS-248: Q&A — ジャガーバルカンの【母艦】で追加条件の代わりにホールドする ET コマンドは、プリズムパワーで代用できない（出典: atwiki/page-276 Q1）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        operation: [inst("RS-248", "prism")],
        rush: [inst("RS-076", "jaguar")],
        power: powerCards(4),
        command: [{ ...held(CMD.ET, "et"), paymentHeld: true }, released(CMD.WB, "w1"), released(CMD.WB, "w2"), released(CMD.WB, "w3"), released(CMD.WB, "w4")],
      },
    });
    let r = tryAct(s0, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-074:cosmo" });
    if (r.ok) r = tryAct(r.state, { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" });
    if (r.ok && r.state.pendingZordSetup) r = tryAct(r.state, { type: "resolve_zord_setup", playerId: "player1" });
    const queue = ["TST-OP:w1", "TST-OP:w2", "TST-OP:w3", "TST-OP:w4"];
    for (let i = 0; r.ok && i < 4 && r.state.pendingCommandPayment; i += 1) {
      const need = r.state.pendingCommandPayment.totalNeeded;
      r = tryAct(r.state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: queue.splice(0, need) });
    }
    expect(!r.ok || zoneOf(r.state, "player1", "RS-074:cosmo") !== "rush").toBe(true);
  });

  // atwiki/page-276 Q2（grnrngr/faq-card-1 RS-010 Q2）「いいえ、そのようにはなりません。…プリズムパワーの効果を得る為にホールドされたもの」
  it("RS-248: Q&A — プリズムパワーのためにホールドしたキバ2枚では【ファンガイアの王】は誘発しない（出典: atwiki/page-276 Q2）", () => {
    const DA = sUnit("SPEC-DA", { category: "DA", bp: 2000, sp: undefined });
    const s0 = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("SPEC-DA", "da")],
          operation: [inst("RS-248", "prism")],
          command: [{ ...held(CMD.DA, "dac"), paymentHeld: true }, released("XG5-074", "k1"), released("XG5-074", "k2")],
        },
      },
      [DA],
    );
    const pay = prismPay(s0, "SPEC-DA:da");
    expect(pay).toBeDefined();
    let s = act(s0, pay!);
    expect(s.players.player1.command.filter((c) => c.cardId === "XG5-074" && c.commandHeld)).toHaveLength(2);
    if (zoneOf(s, "player1", "SPEC-DA:da") !== "rush") {
      const r = legal(s).find((a) => a.type === "rush" && a.instanceId === "SPEC-DA:da");
      if (r) s = act(s, r);
    }
    expect(zoneOf(s, "player1", "SPEC-DA:da")).toBe("rush");
    expect(bpOf(s, "player1", "SPEC-DA:da")).toBe(2000);
  });
});

void tryPayAndUse;
