/**
 * docs/rules/07-keywords.md「レジスト」節（R-KW-RESIST-01〜05）のルール仕様テスト。
 * 出典: atwiki/page-1289（Q1〜Q3・本文）、grnrngr/faq-card-1 RS-018、grnrngr/faq-rider_2 RK-166。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { act, card, hasLegal, inst, KW, legal, powerCards, realDef, state, unitDef, vehicleDef, where } from "./07-helpers";

const RES = unitDef("RSPEC-RES", { bp: 3000, text: KW.resist });
const ATK = unitDef("RSPEC-ATK", { bp: 5000 });
const EQ = unitDef("RSPEC-EQ", { bp: 3000 });

const offered = (s: GameState, playerId = "player2") =>
  hasLegal(s, (a) => a.type === "use_register" && a.playerId === playerId);

/** player1 のバトルフェイズに attacker でアタックした直後の状態。 */
function attackInto(
  s: GameState,
  attacker: string,
  defender: string,
): GameState {
  let next = act(s, { type: "move_to_battle", playerId: "player1", instanceId: attacker });
  next = act(next, { type: "battle", playerId: "player1", attackerInstanceId: attacker, defenderInstanceId: defender });
  return next;
}

describe("R-KW-RESIST-01 規定文", () => {
  const r = inst(RES.id, "r");
  const a = inst(ATK.id, "a");
  const base = () =>
    state([RES, ATK], { phase: "battle", player1: { rush: [a] }, player2: { battle: [r] } });

  // 「捨札にするかわりにこれをホールドしてその場に留めてもよい」
  it("R-KW-RESIST-01: バトルで撃破されたとき、レジストを選ぶとホールドしてその場（バトルエリア）に留まる（出典: atwiki/page-1289 規定文）", () => {
    let s = attackInto(base(), a.instanceId, r.instanceId);
    expect(offered(s)).toBe(true);
    s = act(s, { type: "use_register", playerId: "player2" });
    expect(where(s, "player2", r.instanceId)).toBe("battle");
    expect(card(s, "player2", r.instanceId)?.commandHeld).toBe(true);
  });

  // 「…留めてもよい」（任意）
  it("R-KW-RESIST-01: レジストは任意で、使わなければ通常どおり捨札になる（出典: atwiki/page-1289 規定文・本文「任意で選択できる」）", () => {
    let s = attackInto(base(), a.instanceId, r.instanceId);
    expect(hasLegal(s, (x) => x.type === "pass_register" && x.playerId === "player2")).toBe(true);
    s = act(s, { type: "pass_register", playerId: "player2" });
    expect(where(s, "player2", r.instanceId)).toBe("discard");
  });
});

describe("R-KW-RESIST-02 「バトル」の意味", () => {
  // 「相打ちになり撃破されました…」→「はい、できます」
  it("R-KW-RESIST-02: 自軍バトルフェイズにアタックしたレジスト持ちが相打ちで撃破されてもレジストできる（出典: atwiki/page-1289 Q1）", () => {
    const r = inst(RES.id, "r");
    const d = inst(EQ.id, "d");
    let s = state([RES, EQ], { phase: "battle", player1: { rush: [r] }, player2: { battle: [d] } });
    s = attackInto(s, r.instanceId, d.instanceId);
    // 防御側（レジストなし）の処理を進め、攻撃側のレジスト選択まで到達させる
    for (let i = 0; i < 5 && !offered(s, "player1"); i += 1) {
      const step = legal(s).find((x) => x.type === "pass_register" || x.type.startsWith("pass_"));
      if (!step) break;
      s = act(s, step);
    }
    expect(offered(s, "player1")).toBe(true);
    s = act(s, { type: "use_register", playerId: "player1" });
    expect(where(s, "player1", r.instanceId)).toBe("battle");
    expect(card(s, "player1", r.instanceId)?.commandHeld).toBe(true);
  });

  // 「効果で結果として「撃破」…レジストは発動できません」
  it("R-KW-RESIST-02: バトルフェイズ中でもユニットの効果で撃破されたときはレジストできない（出典: atwiki/page-1289 Q2）", () => {
    const r = inst(RES.id, "r");
    const z = inst("RS-050", "z");
    // RS-050 アバレンオー「バトルエリアに出たとき、敵軍バトルエリアからBP4000以下のユニットを1体選んで撃破する」
    let s = state([RES, realDef("RS-050")], { phase: "battle", player1: { rush: [z] }, player2: { battle: [r] } });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: z.instanceId });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: r.instanceId });
    expect(offered(s)).toBe(false);
    expect(where(s, "player2", r.instanceId)).toBe("discard");
  });

  // 「隠流忍術…バトルで撃破された…はい、できます」
  it("R-KW-RESIST-02: 隠流忍術でバトル対象になったレジスト持ちがバトルで撃破されたときもレジストできる（出典: grnrngr/faq-card-1 RS-018）", () => {
    const r = inst(RES.id, "r");
    const x = inst("TST-UNIT-0", "x");
    const a = inst(ATK.id, "a");
    let s = state([RES, ATK, realDef("RS-018")], {
      phase: "battle",
      player1: { rush: [a] },
      player2: {
        battle: [x, r],
        hand: [inst("RS-018", "n")],
        command: [inst("TST-OP-MA", "c")],
        power: powerCards(5),
      },
    });
    s = attackInto(s, a.instanceId, x.instanceId);
    const counter = legal(s).find(
      (x2) => x2.type === "initiate_command_payment" && x2.substituteInstanceId === r.instanceId,
    );
    expect(counter).toBeDefined();
    s = act(s, counter!);
    s = act(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP-MA:c"] });
    for (let i = 0; i < 5 && !offered(s); i += 1) {
      const pass = legal(s).find((x2) => x2.type.startsWith("pass_") && x2.type !== "pass_register");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(offered(s)).toBe(true);
  });

  // 「隠流忍術やゴーオンレッドなどの効果で」
  it.todo("R-KW-RESIST-02: [未確定] アタックを経ない効果バトル（ゴーオンレッド等）で撃破されたときにレジストできるか（page-592 は可、A2 の字面とずれる）");
  // 「バトルで撃破されたとき」（ラッシュエリア）
  it.todo("R-KW-RESIST-02: [未確定] ラッシュエリアにいてバトルで撃破された場合にレジストできるか（03-D5）");
});

describe("R-KW-RESIST-03 「勝っても撃破」では不可", () => {
  // RK-231 は DSL で「敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」を持つ
  const WINDIE = unitDef("RK-231", {
    name: "勝っても撃破レジスト",
    bp: 6000,
    text: `※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 ${KW.resist}`,
  });
  const SP1_WEAK = unitDef("RSPEC-SP1-WEAK", { bp: 1000, sp: 1 });
  const SP1_STRONG = unitDef("RSPEC-SP1-STRONG", { bp: 9000, sp: 1 });

  // 「「バトルに勝っても撃破される」の効果で撃破された場合は…できません」
  it.fails("R-KW-RESIST-03: バトルに勝ったのに「バトルに勝っても撃破される」で撃破されたときはレジストできない（出典: atwiki/page-1289 Q3）", () => {
    // 既知の不具合: E9（防御側の分岐で除外していない）
    const r = inst(WINDIE.id, "r");
    const a = inst(SP1_WEAK.id, "a");
    let s = state([WINDIE, SP1_WEAK], { phase: "battle", player1: { rush: [a] }, player2: { battle: [r] } });
    s = attackInto(s, a.instanceId, r.instanceId);
    // 前提: BP6000 対 BP1000 でバトルには勝っている（ログに BP 比較が残る）
    expect(s.log.some((l) => l.includes("1000vs6000"))).toBe(true);
    expect(offered(s)).toBe(false);
    expect(where(s, "player2", r.instanceId)).toBe("discard");
  });

  // 「バトルに負けて撃破された場合は…レジストを発動することができます」
  it("R-KW-RESIST-03: 同じユニットでもバトルに負けて撃破されたときはレジストできる（出典: atwiki/page-1289 A3 補足）", () => {
    const r = inst(WINDIE.id, "r");
    const a = inst(SP1_STRONG.id, "a");
    let s = state([WINDIE, SP1_STRONG], { phase: "battle", player1: { rush: [a] }, player2: { battle: [r] } });
    s = attackInto(s, a.instanceId, r.instanceId);
    expect(offered(s)).toBe(true);
  });
});

describe("R-KW-RESIST-04 リリース状態が必要／ホールドは続く", () => {
  const r = inst(RES.id, "r");
  const a1 = inst(ATK.id, "a1");
  const a2 = inst(ATK.id, "a2");

  function resistedOnce(): GameState {
    let s = state([RES, ATK], { phase: "battle", player1: { rush: [a1, a2] }, player2: { battle: [r] } });
    s = attackInto(s, a1.instanceId, r.instanceId);
    return act(s, { type: "use_register", playerId: "player2" });
  }

  // 「リリース状態でなければ使えない」
  it.fails("R-KW-RESIST-04: レジストでホールドされたユニットが同じターンに再びバトルで撃破されても、リリース状態でないのでレジストできない（出典: atwiki/page-1289 本文）", () => {
    // 既知の不具合: E8（再レジスト可）／04-#15（リリース状態を確認していない）
    let s = resistedOnce();
    expect(card(s, "player2", r.instanceId)?.commandHeld).toBe(true);
    s = attackInto(s, a2.instanceId, r.instanceId);
    expect(offered(s)).toBe(false);
    expect(where(s, "player2", r.instanceId)).toBe("discard");
  });

  // 「もちろんリリース状態でなければ使えない」（効果でホールドされたユニット）
  it.fails("R-KW-RESIST-04: 効果でホールドされているレジスト持ちはバトルで撃破されてもレジストできない（出典: atwiki/page-1289 本文）", () => {
    // 既知の不具合: 04-#15（リリース状態を確認していない）
    const held = { ...inst(RES.id, "held"), commandHeld: true };
    let s = state([RES, ATK], { phase: "battle", player1: { rush: [a1] }, player2: { battle: [held] } });
    s = attackInto(s, a1.instanceId, held.instanceId);
    expect(offered(s)).toBe(false);
  });

  // 「リリースする効果のカードが無ければ…ずっとホールド状態のまま」
  it.fails("R-KW-RESIST-04: レジストでホールドしたユニットは、持ち主のスタートフェイズにラッシュエリアへ戻ってもホールドのまま（出典: atwiki/page-1289 本文、R-HOLD-02）", () => {
    // 既知の不具合: E8（スタートで解除）
    let s = resistedOnce();
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(s.activePlayer).toBe("player2");
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player2" });
    expect(where(s, "player2", r.instanceId)).toBe("rush");
    expect(card(s, "player2", r.instanceId)?.commandHeld).toBe(true);
  });

  // 「こちらのターンが始まればラッシュエリアに戻る」
  it("R-KW-RESIST-04: レジストでホールドしたユニットも次の自ターンのスタートフェイズにはラッシュエリアに戻る（出典: atwiki/page-1289 本文、R-HOLD-03）", () => {
    let s = resistedOnce();
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player2" });
    expect(where(s, "player2", r.instanceId)).toBe("rush");
  });

  // 「自分からライドオフするまではビークルにライドしたままになります」
  it("R-KW-RESIST-04: ライド中の RK-166 がレジストでホールドされても、ライドしたままになる（出典: grnrngr/faq-rider_2 RK-166）", () => {
    const g3 = inst("RK-166", "g3");
    const v = inst("RSPEC-V", "v");
    const V = vehicleDef("RSPEC-V", { category: "ET" });
    const strong = unitDef("RSPEC-STRONG", { bp: 9000 });
    const s0 = state([realDef("RK-166"), V, strong], {
      phase: "battle",
      player1: { rush: [inst(strong.id, "a")] },
      player2: { battle: [v, { ...g3, mountedOnInstanceId: v.instanceId }] },
    });
    let s = attackInto(s0, `${strong.id}:a`, g3.instanceId);
    expect(offered(s)).toBe(true);
    s = act(s, { type: "use_register", playerId: "player2" });
    expect(card(s, "player2", g3.instanceId)?.commandHeld).toBe(true);
    expect(card(s, "player2", g3.instanceId)?.mountedOnInstanceId).toBe(v.instanceId);
    expect(where(s, "player2", v.instanceId)).toBe("battle");
  });
});

describe("R-KW-RESIST-05 撃破の事実は残る", () => {
  // 「「撃破して・されて捨札になったとき」の効果は発動しない」
  it("R-KW-RESIST-05: レジストで留まったとき「撃破されて捨札になったとき」の効果は発動しない（出典: atwiki/page-1289 本文）", () => {
    // PK-012 は DSL で「撃破されて捨札になったとき、自軍捨札から「仮面ライダー龍騎」を1体選び、自軍ラッシュエリアに出す」を持つ
    const SURVIVE = unitDef("PK-012", {
      name: "仮面ライダー龍騎サバイブ",
      bp: 3000,
      text: `※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダー龍騎」を1体選び、自軍ラッシュエリアに出す。 ${KW.resist}`,
    });
    const RYUKI = unitDef("RSPEC-RYUKI", { name: "仮面ライダー龍騎" });
    const r = inst(SURVIVE.id, "r");
    const ry = inst(RYUKI.id, "ry");
    const a = inst(ATK.id, "a");
    let s = state([SURVIVE, RYUKI, ATK], {
      phase: "battle",
      player1: { rush: [a] },
      player2: { battle: [r], discard: [ry] },
    });
    s = attackInto(s, a.instanceId, r.instanceId);
    s = act(s, { type: "use_register", playerId: "player2" });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(where(s, "player2", ry.instanceId)).toBe("discard");
  });

  // 「「撃破した・されたとき」の効果は発動する」
  it.todo("R-KW-RESIST-05: 「撃破した／されたとき」の効果はレジストしても発動し、「撃破したとき」を先に処理する（両方を持つ実装済みカードの組み合わせがなく、エンジン API で発動順を観測できない）");
});
