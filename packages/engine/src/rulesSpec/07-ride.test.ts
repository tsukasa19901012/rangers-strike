/**
 * docs/rules/07-keywords.md「ライド / ライドオフ / RC」節（R-KW-RIDE-01〜05、R-KW-RC-01）のルール仕様テスト。
 * 出典: atwiki/page-156・594・228・141、grnrngr/faq-rider（ライド・ライドオフ・ビークル・ＲＣ）、
 *       grnrngr/faq-card-2 RS-108、grnrngr/faq-rider_1 RK-046。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { markBattleBlocked } from "../rules/turnModifiers";
import { battleFillers } from "../testing/battleEntry";
import { act, canRush, canStrike, card, hasLegal, inst, legal, powerCards, realDef, state, unitDef, vehicleDef, where } from "./07-helpers";

const V = vehicleDef("RSPEC-V", { name: "テストビークル" });
const RC = unitDef("RSPEC-RC", { name: "RCユニット", comboNumber: "RC", bp: 3000 });
const PLAIN = unitDef("RSPEC-PLAIN", { name: "RCなしユニット", comboNumber: 2, bp: 3000 });
const ENEMY = unitDef("RSPEC-ENEMY", { bp: 2000 });
const STRONG = unitDef("RSPEC-STRONG", { bp: 9000 });
/** RS-406 マシンボクサー: 「特徴「警察」を持つ自軍Sユニットは、ＲＣを持っていなくてもこのビークルにライドできる」 */
const BOXER = realDef("RS-406");
const POLICE = unitDef("RSPEC-POLICE", { name: "警察ユニット", comboNumber: 3, features: ["警察", "男"], bp: 3000 });

const v = inst(V.id, "v");
const r = inst(RC.id, "r");
const e = inst(ENEMY.id, "e");

const canMount = (s: GameState, rider: string, vehicle?: string) =>
  hasLegal(
    s,
    (a) => a.type === "mount_ride" && a.riderInstanceId === rider && (vehicle === undefined || a.vehicleInstanceId === vehicle),
  );
const rideOffOffered = (s: GameState, playerId = "player1") =>
  hasLegal(s, (a) => a.type === "resolve_ride_off_choice" && a.playerId === playerId && a.rideOff === true);

function battlePhase(p1Rush: GameState["players"]["player1"]["rush"], extra = [] as ReturnType<typeof unitDef>[]): GameState {
  return state([V, RC, PLAIN, ENEMY, STRONG, BOXER, POLICE, ...extra], {
    phase: "battle",
    player1: { rush: p1Rush },
    player2: { battle: [e] },
  });
}

describe("R-KW-RIDE-01 ライドの時期", () => {
  // 「ライドできるのは、バトルフェイズにバトルエリアに出すときだけです」
  it("R-KW-RIDE-01: ライドはバトルエリアに出る行為と一体で、ライドしたユニットはビークルと一緒にバトルエリアに出る（出典: atwiki/page-156 Q1、grnrngr/faq-rider ライド Q1）", () => {
    let s = battlePhase([v, r]);
    expect(canMount(s, r.instanceId, v.instanceId)).toBe(true);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: r.instanceId, vehicleInstanceId: v.instanceId });
    expect(where(s, "player1", r.instanceId)).toBe("battle");
    expect(where(s, "player1", v.instanceId)).toBe("battle");
    expect(card(s, "player1", r.instanceId)?.mountedOnInstanceId).toBe(v.instanceId);
  });

  // 「自軍バトルフェイズにユニットがバトルエリアに出るときだけです」
  it("R-KW-RIDE-01: 自軍ラッシュフェイズにはライドできない（出典: grnrngr/faq-card-2 RS-108 Q1）", () => {
    const s = state([V, RC], { phase: "rush", player1: { rush: [v, r] } });
    expect(hasLegal(s, (a) => a.type === "mount_ride")).toBe(false);
  });

  // 「相手の効果でバトルエリアに出されるときはライドできない」
  it("R-KW-RIDE-01: 相手の効果（RS-108 デカグリーン）でバトルエリアに出されたユニットはビークルにライドしない（出典: grnrngr/faq-card-2 RS-108、atwiki/page-156 Q1）", () => {
    const enemyRc = inst(RC.id, "enemy-rc");
    let s = state([V, RC, realDef("RS-108")], {
      phase: "battle",
      player1: { rush: [inst("RS-108", "g")], battle: battleFillers(2) },
      player2: { rush: [inst(V.id, "ev"), enemyRc] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-108:g" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(enemyRc.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: enemyRc.instanceId });
    expect(where(s, "player2", enemyRc.instanceId)).toBe("battle");
    expect(card(s, "player2", enemyRc.instanceId)?.mountedOnInstanceId).toBeUndefined();
    expect(where(s, "player2", "RSPEC-V:ev")).toBe("rush");
  });

  // 「出られない場合、ライドは巻き戻されて無効になる」
  it("R-KW-RIDE-01: バトルエリアに出られないユニットはライドもできず、ライドしていない状態のまま残る（出典: atwiki/page-156 本文）", () => {
    const s0 = battlePhase([v, r]);
    const s: GameState = { ...s0, players: { ...s0.players, player1: markBattleBlocked(s0.players.player1, r.instanceId) } };
    expect(canMount(s, r.instanceId)).toBe(false);
    expect(card(s, "player1", r.instanceId)?.mountedOnInstanceId).toBeUndefined();
  });

  // 「チェイスなどの効果によって…ライドが発生」
  it.todo("R-KW-RIDE-01: チェイス等の効果によるライドは時期の例外（チェイス側のテスト 07-chase で扱う）");
});

describe("R-KW-RIDE-02 ライドできるユニット", () => {
  // 「ライド出来るのは、ＲＣを持つか、ビークル側のテキストで指定されたユニット」
  it("R-KW-RIDE-02: RC を持たず、ビークルにも指定されていないユニットはライドできない（出典: atwiki/page-156 本文）", () => {
    const p = inst(PLAIN.id, "p");
    const s = battlePhase([v, p]);
    expect(canMount(s, p.instanceId)).toBe(false);
  });

  // 「ビークル側のテキストで指定されたユニット」
  it("R-KW-RIDE-02: RC がなくても、ビークル（RS-406 マシンボクサー）が指定する特徴「警察」の S ユニットはライドできる（出典: atwiki/page-156 本文）", () => {
    const p = inst(POLICE.id, "p");
    const s = battlePhase([inst(BOXER.id, "bx"), p]);
    expect(canMount(s, p.instanceId, `${BOXER.id}:bx`)).toBe(true);
  });

  // 「それ以外のユニットはライドできない」→RC持ちも不可
  it.fails("R-KW-RIDE-02: ビークルに「それ以外のユニットはライドできない」とあれば、RC を持つユニットでも条件外ならライドできない（出典: atwiki/page-156 本文）", () => {
    // 既知の不具合: 04-#28（RC があれば排他条件を見ない）
    const EXCLUSIVE = {
      ...BOXER,
      text: "※特徴「警察」を持つ自軍Sユニットは、ＲＣを持っていなくてもこのビークルにライドできる。それ以外のユニットはライドできない。",
    };
    const s = state([EXCLUSIVE, RC, ENEMY], {
      phase: "battle",
      player1: { rush: [inst(EXCLUSIVE.id, "bx"), r] },
      player2: { battle: [e] },
    });
    expect(canMount(s, r.instanceId, `${EXCLUSIVE.id}:bx`)).toBe(false);
  });
});

describe("R-KW-RIDE-03 1台1体", () => {
  // 「1体のビークルにライドできるユニットは1体まで」
  it("R-KW-RIDE-03: 1台のビークルにライドできるのは1体だけ（出典: atwiki/page-156 本文、grnrngr/faq-rider ライド）", () => {
    const r2 = inst(RC.id, "r2");
    let s = battlePhase([v, r, r2]);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: r.instanceId, vehicleInstanceId: v.instanceId });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    expect(canMount(s, r2.instanceId, v.instanceId)).toBe(false);
  });

  // 「すでにライドしているユニットは…別のビークルに」→「いいえ」
  it.fails("R-KW-RIDE-03: すでにライドしているユニットは、ライドされていない別のビークルにライドできない（出典: atwiki/page-156 Q2、grnrngr/faq-rider ライド Q2）", () => {
    // 既知の不具合: 未登録（ラッシュエリアでライド中のユニットに別ビークルへの mount_ride が合法手として出る）
    const v2 = inst(V.id, "v2");
    const s = battlePhase([v, v2, { ...r, mountedOnInstanceId: v.instanceId }]);
    expect(canMount(s, r.instanceId, v2.instanceId)).toBe(false);
  });
});

describe("R-KW-RIDE-04 ライド状態の継続", () => {
  // 「はい、ライドしたままの状態になります」
  it("R-KW-RIDE-04: 自軍スタートフェイズにバトルエリアからラッシュエリアへ戻っても、ライドしたまま（出典: atwiki/page-141 Q1、grnrngr/faq-rider ビークル Q1）", () => {
    let s = state([V, RC], {
      phase: "start",
      player1: { battle: [v, { ...r, mountedOnInstanceId: v.instanceId }] },
    });
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
    expect(where(s, "player1", r.instanceId)).toBe("rush");
    expect(where(s, "player1", v.instanceId)).toBe("rush");
    expect(card(s, "player1", r.instanceId)?.mountedOnInstanceId).toBe(v.instanceId);
  });

  // 「ライドしているユニットが撃破されて捨札になったとき…いいえ、その場に残ります」
  it("R-KW-RIDE-04: ライド中のユニットがバトルで撃破されて捨札になっても、ビークルはその場に残る（出典: atwiki/page-141 Q7、grnrngr/faq-rider ビークル Q7）", () => {
    const ev = inst(V.id, "ev");
    const er = { ...inst(RC.id, "er"), mountedOnInstanceId: ev.instanceId };
    let s = state([V, RC, STRONG], {
      phase: "battle",
      player1: { rush: [inst(STRONG.id, "a")] },
      player2: { battle: [ev, er] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${STRONG.id}:a` });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: `${STRONG.id}:a`, defenderInstanceId: er.instanceId });
    expect(where(s, "player2", er.instanceId)).toBe("discard");
    expect(where(s, "player2", ev.instanceId)).toBe("battle");
  });

  // 「パワーゾーンやコマンドゾーンに移されるとき…いいえ、その場に残ります」
  it("R-KW-RIDE-04: ライド中のユニットが効果でパワーゾーンに送られても、ビークルはその場に残る（出典: atwiki/page-141 Q8、grnrngr/faq-rider ビークル Q8）", () => {
    // RS-046 パトアーマー「これをラッシュしたとき…敵軍バトルエリアからBP8000以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る」
    const ev = inst(V.id, "ev");
    const er = { ...inst(RC.id, "er"), mountedOnInstanceId: ev.instanceId };
    let s = state([V, RC, realDef("RS-046")], {
      phase: "rush",
      player1: {
        hand: [inst("RS-046", "pa")],
        rush: [inst("TST-UNIT-0", "m")],
        command: [inst("TST-OP-OT", "c")],
        power: powerCards(5),
      },
      player2: { battle: [ev, er] },
    });
    s = act(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-046:pa" });
    s = act(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: "TST-UNIT-0:m" });
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:c"] });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(er.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: er.instanceId });
    expect(where(s, "player2", er.instanceId)).toBe("power");
    expect(where(s, "player2", ev.instanceId)).toBe("battle");
  });

  // 「強制前進効果はない」
  it("R-KW-RIDE-04: ラッシュエリアでライドしたままのユニットを、次の自ターンにバトルエリアへ出す義務はない（出典: page-1974 Q&A「強制前進効果はない」）", () => {
    let s = battlePhase([v, { ...r, mountedOnInstanceId: v.instanceId }]);
    expect(hasLegal(s, (a) => a.type === "end_phase" && a.playerId === "player1")).toBe(true);
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(where(s, "player1", r.instanceId)).toBe("rush");
    expect(card(s, "player1", r.instanceId)?.mountedOnInstanceId).toBe(v.instanceId);
  });
});

describe("R-KW-RIDE-05 ライドオフ", () => {
  // 「スタートフェイズに…戻したとき、ライドオフ…いいえ、できません」
  it("R-KW-RIDE-05: スタートフェイズにバトルエリアからラッシュエリアへ戻すときはライドオフできない（出典: atwiki/page-594 Q1、grnrngr/faq-rider ライドオフ Q1）", () => {
    let s = state([V, RC], {
      phase: "start",
      player1: { battle: [v, { ...r, mountedOnInstanceId: v.instanceId }] },
    });
    expect(rideOffOffered(s)).toBe(false);
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
    expect(rideOffOffered(s)).toBe(false);
    expect(card(s, "player1", r.instanceId)?.mountedOnInstanceId).toBe(v.instanceId);
  });

  // 「相手によってバトルエリアに出されたとき」→「いいえ」
  it("R-KW-RIDE-05: ライド中のユニットが相手の効果でバトルエリアに出されたとき、持ち主はライドオフできない（出典: atwiki/page-594 Q2、grnrngr/faq-rider ライドオフ Q2）", () => {
    const ev = inst(V.id, "ev");
    const er = { ...inst(RC.id, "er"), mountedOnInstanceId: ev.instanceId };
    let s = state([V, RC, realDef("RS-108")], {
      phase: "battle",
      player1: { rush: [inst("RS-108", "g")], battle: battleFillers(2) },
      player2: { rush: [ev, er] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-108:g" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: er.instanceId });
    expect(rideOffOffered(s, "player2")).toBe(false);
    expect(card(s, "player2", er.instanceId)?.mountedOnInstanceId).toBe(ev.instanceId);
  });

  // 「「RC」の表記がなくてもライドオフすることができますか？」→「はい、できます」
  it("R-KW-RIDE-05: RC を持たないユニットもライドオフできる（出典: atwiki/page-594 Q3、grnrngr/faq-rider ライドオフ Q3）", () => {
    const p = inst(POLICE.id, "p");
    let s = battlePhase([inst(BOXER.id, "bx"), p]);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: p.instanceId, vehicleInstanceId: `${BOXER.id}:bx` });
    expect(rideOffOffered(s)).toBe(true);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    expect(card(s, "player1", p.instanceId)?.mountedOnInstanceId).toBeUndefined();
  });

  // 「ライドしていたビークルの次に並び、コンビネーション」
  it("R-KW-RIDE-05: ライドオフしたユニットはビークルの次に並ぶ（出典: atwiki/page-594 本文）", () => {
    const fill = battleFillers(1);
    let s = state([V, RC, ENEMY], {
      phase: "battle",
      player1: { rush: [v, r], battle: fill },
      player2: { battle: [e] },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: r.instanceId, vehicleInstanceId: v.instanceId });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    const ids = s.players.player1.battle.map((c) => c.instanceId);
    expect(ids.indexOf(r.instanceId)).toBe(ids.indexOf(v.instanceId) + 1);
  });

  // 「アタックやストライクを行う直前にしかできません」
  it("R-KW-RIDE-05: ライドオフの機会はバトルエリアに出た直後（アタック・ストライク前）で、アタック後にはない（出典: atwiki/page-594 A1）", () => {
    let s = battlePhase([v, r]);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: r.instanceId, vehicleInstanceId: v.instanceId });
    expect(rideOffOffered(s)).toBe(true);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: r.instanceId, defenderInstanceId: e.instanceId });
    expect(rideOffOffered(s)).toBe(false);
  });
});

describe("R-KW-RC-01 ライディングコンビネーション", () => {
  // XG2-043 仮面ライダーW・CJ（RC、SP1/5）【ジョーカーエクストリーム】「SP1」
  const W = realDef("XG2-043");
  const w = inst(W.id, "w");

  // 「バトルフェイズにバトルエリアでライドオフした時に発動」
  it("R-KW-RC-01: 自軍バトルフェイズにバトルエリアでライドオフすると RC が発動する（XG2-043 が SP1 になりストライクできる）（出典: atwiki/page-594 本文、grnrngr/faq-rider ＲＣ）", () => {
    let s = state([V, W, ENEMY], { phase: "battle", player1: { rush: [v, w] }, player2: { battle: [e] } });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: w.instanceId, vehicleInstanceId: v.instanceId });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    expect(canStrike(s, w.instanceId)).toBe(true);
  });

  // 「乗りっぱなしだとＲＣを発動できない」
  it("R-KW-RC-01: ライドしたままアタック・ストライクに進むと RC は発動しない（出典: atwiki/page-141 本文、page-228 本文）", () => {
    let s = state([V, W, ENEMY], { phase: "battle", player1: { rush: [v, w] }, player2: { battle: [e] } });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: w.instanceId, vehicleInstanceId: v.instanceId });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    expect(canStrike(s, w.instanceId)).toBe(false);
  });

  // 「RCの効果は…ライドオフしたときにのみ発動します」
  it.fails("R-KW-RC-01: RK-046 の追加条件で RK-045 オートバジンVM を送ると、ライドしていたユニットはライドオフするが RC は発動しない（出典: grnrngr/faq-rider_1 RK-046）", () => {
    // 既知の不具合: 未登録（RK-045 オートバジンVM（ビークル）を RK-046 の追加条件「自軍「オートバジンVM」1体」に使えずラッシュできない）
    const s = state([realDef("RK-045"), realDef("RK-046"), W], {
      phase: "rush",
      player1: {
        hand: [inst("RK-046", "bm")],
        rush: [inst("RK-045", "vm"), { ...w, mountedOnInstanceId: "RK-045:vm" }],
        command: [inst("TST-OP-ET", "c")],
        power: powerCards(6),
      },
    });
    expect(canRush(s, "RK-046:bm")).toBe(true);
    const zord = legal(s).find((a) => a.type === "begin_zord_setup" || a.type === "initiate_command_payment");
    let next = act(s, zord!);
    for (let i = 0; i < 4 && (next.pendingZordSetup || next.pendingCommandPayment); i += 1) {
      const step = legal(next).find((a) => a.type === "resolve_zord_setup" || a.type === "resolve_command_payment");
      if (!step) break;
      next = act(next, step);
    }
    expect(card(next, "player1", w.instanceId)?.mountedOnInstanceId).toBeUndefined();
    expect(next.log.some((l) => l.includes("riding_combo"))).toBe(false);
  });

  // 「「RC」は数字ではありません」
  it.todo("R-KW-RC-01: RC はナンバーを持つ扱いだが数字ではなく「ナンバーの数字」参照の対象外（出典: atwiki/page-228 Q1。ナンバーの数字を参照する効果の起動経路がない）");

  // 「別のものとして扱います」
  it.todo("R-KW-RC-01: 「NC の効果」を対象にした効果と「RC の効果」を対象にした効果は別物（出典: atwiki/page-228 Q2。NC/RC 効果を名指しする効果の起動経路がない）");

  // 「効果によるライドオフでは発動しない」
  it.todo("R-KW-RC-01: 効果によるライドオフでは RC は発動しない（出典: atwiki/page-594 本文。効果でライドオフさせるカードの起動経路がない）");
});
