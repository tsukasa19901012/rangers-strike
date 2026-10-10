/**
 * docs/rules/05-battle-strike-damage.md §1 バトルエリアへ出る / §2 アタックとバトル
 * 期待値はルールブックと docs/rules/sources/web/ の公式・atwiki ページに従う（現エンジンの挙動ではない）。
 * §3〜§5 は 05-bp-strike-damage.test.ts、§6〜§7 は 05-combination-counter.test.ts。
 */
import { describe, expect, it } from "vitest";
import { rushWithCategoryHold } from "../testing/rushPayment";
import { effectiveBp } from "../core/catalog";
import {
  act,
  attack,
  attackTargets,
  battleState,
  canApply,
  canStartCounter,
  canStrike,
  deckCards,
  endTurn,
  enter,
  enterWithHold,
  fillers,
  heldCommands,
  ids,
  inst,
  legal,
  legalOfType,
  ncLogged,
  passEntry,
  playCounter,
  powerCards,
  releasedCommands,
  settle,
  strike,
  zoneOf,
} from "./05-helpers";
import type { GameState } from "../types/game";

/** RS-100 の「アタックするかわりに」効果を起動するアクション（battle/strike/pass 以外で RS-100 を参照するもの）。 */
function insteadOfAttackActions(state: GameState, instanceId: string) {
  return legal(state).filter((a) => {
    if (["battle", "strike", "pass_battle_entry", "end_phase", "move_to_battle"].includes(a.type)) {
      return false;
    }
    return JSON.stringify(a).includes(instanceId);
  });
}

// ---------------------------------------------------------------------------
// §1 バトルエリアへ出る
// ---------------------------------------------------------------------------

describe("R-BA-01 出る時期と義務", () => {
  // 「移動させなくてもかまいません」（公式ルール バトルフェイズ）
  it("R-BA-01: バトルフェイズにユニットを出さずにフェイズを終えられる（出典: grnrngr/rule_phase4）", () => {
    const s = battleState({ player1: { rush: [inst("TST-UNIT-0", "a")] } });
    expect(legalOfType(s, "move_to_battle").map((a) => a.instanceId)).toContain("TST-UNIT-0:a");
    expect(legalOfType(s, "end_phase")).toHaveLength(1);
    const next = act(s, { type: "end_phase", playerId: "player1" });
    expect(zoneOf(next, "player1", "TST-UNIT-0:a")).toBe("rush");
  });

  // 「「なにもしない」を選ぶこともできます」（page-457 Q2）
  it("R-BA-01: 出たユニットはアタックもストライクもせず「なにもしない」を選べる（出典: atwiki/page-457 Q2・公式FAQ リファレンス「バトルエリア」）", () => {
    let s = battleState({
      player1: { rush: [inst("TST-UNIT-0", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "TST-UNIT-0:a");
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
    s = passEntry(s);
    expect(ids(s.players.player1.battle)).toEqual(["TST-UNIT-0:a"]);
    expect(ids(s.players.player2.battle)).toEqual(["TST-UNIT-0:d"]);
    expect(s.players.player2.damage).toBe(0);
  });

  // 「自軍バトルフェイズにラッシュエリアからバトルエリアに出られる」
  it("R-BA-01: 自軍ラッシュフェイズや相手プレイヤーは move_to_battle できない（出典: atwiki/page-593）", () => {
    const rush = battleState({ phase: "rush", player1: { rush: [inst("TST-UNIT-0", "a")] } });
    expect(canApply(rush, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-0:a" })).toBe(false);
    const enemy = battleState({ player2: { rush: [inst("TST-UNIT-0", "e")] } });
    expect(canApply(enemy, { type: "move_to_battle", playerId: "player2", instanceId: "TST-UNIT-0:e" })).toBe(false);
  });
});

describe("R-BA-02 並び順と配置位置", () => {
  // 「カードはバトルエリアの左から順に詰めておきます」
  it("R-BA-02: 新しく出たユニットはバトルエリアの一番右に置かれる（出典: grnrngr/rule_phase4・atwiki/page-141 Q10）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("TST-UNIT-2", "new")] },
    });
    s = enter(s, "TST-UNIT-2:new");
    expect(ids(s.players.player1.battle)).toEqual(["TST-UNIT-0:fill0", "TST-UNIT-0:fill1", "TST-UNIT-2:new"]);
  });

  // 「4番目にバトルエリアに出し、ライドオフ…5番目に並ぶ」
  it("R-BA-02: 4番目にライドして出た RK-023 はライドオフで5番目に並び、ビークルは4番目に残る（出典: grnrngr/faq-rider-1 RK-023 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(3), rush: [inst("RK-023", "rider"), inst("RK-024", "bike")] },
      player2: { power: powerCards(5) },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-023:rider", vehicleInstanceId: "RK-024:bike" });
    s = settle(s);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    s = settle(s);
    const order = ids(s.players.player1.battle);
    expect(order.indexOf("RK-024:bike")).toBe(3);
    expect(order.indexOf("RK-023:rider")).toBe(4);
  });

  // 「「SP1」になる効果は、どれだけ重複しても「SP1」です」
  it("R-BA-02: RC の「SP1」と5番目の分数 SP1 は重複せず RK-023 のストライクは1点（出典: grnrngr/faq-rider-1 RK-023 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(3), rush: [inst("RK-023", "rider"), inst("RK-024", "bike")] },
      player2: { power: powerCards(5) },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-023:rider", vehicleInstanceId: "RK-024:bike" });
    s = settle(s);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    s = settle(s);
    s = strike(s, "RK-023:rider");
    s = settle(s);
    expect(s.players.player2.damage).toBe(1);
  });

  // 「バトルエリアにある場合、ユニットと同様に並び順の個数に数えられる」
  it("R-BA-02: ライドオフ後にバトルエリアに残ったビークルも並び順に数える（出典: atwiki/page-141）", () => {
    // [ビークル(1), ライダー(2)] の次に出る CN3 のマジイエローは3番目 → NC 発動
    let s = battleState({
      player1: { rush: [inst("RK-031", "rider"), inst("RK-058", "zect"), inst("RS-058", "yellow")] },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:rider", vehicleInstanceId: "RK-058:zect" });
    s = settle(s);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    s = settle(s);
    if (s.pendingEffectChoice) s = act(s, { type: "skip_effect_choice", playerId: "player1" } as never);
    if (s.pendingBattleEntry) s = passEntry(s);
    s = enter(s, "RS-058:yellow");
    expect(ids(s.players.player1.battle).indexOf("RS-058:yellow")).toBe(2);
    expect(ncLogged(s, "RS-058")).toBe(true);
  });

  // 「ライドしたまま（ライドオフ前）のペアは1枠」
  it("R-BA-02: ライドしたままのユニットとビークルは合わせて1つの並び順を占める（出典: grnrngr/faq-rider-1 RK-023・faq-card-4 RS-187）", () => {
    // [フィラー(1), ライドペア(2)] の次に出る CN3 のマジイエローは3番目 → NC 発動
    let s = battleState({
      player1: {
        battle: fillers(1),
        rush: [inst("RK-031", "rider"), inst("RK-058", "zect"), inst("RS-058", "yellow")],
      },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:rider", vehicleInstanceId: "RK-058:zect" });
    s = settle(s);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    s = settle(s);
    if (s.pendingBattleEntry) s = passEntry(s);
    s = enter(s, "RS-058:yellow");
    expect(ncLogged(s, "RS-058")).toBe(true);
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-058:yellow")?.spModifier).toBe(1);
  });

  // 「並び順が確定するのは、「ライドオフするかしないか」を選択した後」
  it("R-BA-02: ゴーマ宮下でもライドオフして2番目に並んだ S ユニットはアタックを強制されない（出典: grnrngr/faq-card-4 RS-187 Q1）", () => {
    let s = battleState({
      player1: {
        operation: [inst("RS-187", "goma")],
        rush: [inst("RK-031", "rider"), inst("RK-058", "zect")],
      },
      player2: { battle: [inst("TST-UNIT-2", "d")] },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:rider", vehicleInstanceId: "RK-058:zect" });
    s = settle(s);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    s = settle(s);
    if (s.pendingEffectChoice) s = act(s, { type: "skip_effect_choice", playerId: "player1" } as never);
    expect(ids(s.players.player1.battle).indexOf("RK-031:rider")).toBe(1);
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
  });

  // 「最初にバトルエリアに出るユニットがMユニットなら…制限を受けずに済みますか？」「はい」
  it("R-BA-02: ゴーマ宮下で1番目が M ユニットなら2番目の S ユニットは強制アタックを受けない（出典: grnrngr/faq-card-4 RS-187 Q2）", () => {
    let s = battleState({
      player1: {
        operation: [inst("RS-187", "goma")],
        battle: [inst("TST-UNIT-2", "m")],
        rush: [inst("TST-UNIT-0", "s")],
      },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "TST-UNIT-0:s");
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
    expect(canStrike(s, "TST-UNIT-0:s")).toBe(true);
  });

  // 「置き換えません。…新たに右端に置いてください」
  it("R-BA-02: 紐拳で戻した敵軍ユニットを再びバトルエリアに出すと、元の位置ではなく右端に置かれる（出典: grnrngr/faq-card-3 RS-141 Q2・Q3）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-141", "himo")] },
      player2: { battle: [inst("TST-UNIT-2", "left"), inst("TST-UNIT-0", "right")] },
    });
    s = enter(s, "RS-141:himo");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-2:left" } as never);
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      const again = legal(s).find(
        (a) => a.type === "resolve_effect_choice" && JSON.stringify(a).includes("TST-UNIT-2:left"),
      );
      const ok = legal(s).find((a) => a.type === "confirm_effect_choice");
      s = act(s, (again ?? ok)!);
    }
    expect(ids(s.players.player2.battle)).toEqual(["TST-UNIT-0:right", "TST-UNIT-2:left"]);
  });

  it.todo(
    "R-BA-02: 敵軍ターン中にライドオフさせられたユニットはバトルエリアの一番右に置く（出典: atwiki/page-141 Q10）— 敵軍ターン中に強制ライドオフさせる効果をエンジン API で起こせないため",
  );
  it.todo(
    "R-BA-02: 敵軍ターン中のライドオフで置き直したユニットはラッシュされたことにならない（出典: atwiki/page-141 Q11）— 同上",
  );
});

describe("R-BA-03 出る制限は直前に判定", () => {
  // 「バトルエリアに出る直前にその制限を満たさなければならない」
  it("R-BA-03: 「コマンドを1つホールドしなければ出られない」ユニットはリリース状態のコマンドが無ければ出られない（出典: atwiki/page-457）", () => {
    const s = battleState({
      player1: { rush: [inst("RS-035", "tyra")], command: heldCommands(2) },
    });
    expect(legalOfType(s, "move_to_battle").map((a) => a.instanceId)).not.toContain("RS-035:tyra");
    expect(canApply(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-035:tyra" })).toBe(false);
  });

  // 「バトルエリアに出る直前にその制限を満たさなければならない」
  it("R-BA-03: 制限を満たせば（コマンドを1つホールドして）出られる（出典: atwiki/page-457）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-035", "tyra")], command: releasedCommands(1) },
    });
    s = enterWithHold(s, "RS-035:tyra", ["TST-OP:cmd0"]);
    expect(zoneOf(s, "player1", "RS-035:tyra")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // 「自軍ターン中、バトルエリアに出られない」（RS-140 コロン）
  it("R-BA-03: 「自軍ターン中バトルエリアに出られない」ユニットは自軍バトルフェイズに出られない（出典: atwiki/page-457）", () => {
    const s = battleState({ player1: { rush: [inst("RS-140", "colon")] } });
    expect(canApply(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-140:colon" })).toBe(false);
  });
  // 「コマンドを１つホールドしなければなりませんか？」「はい、その通りです」
  it("R-BA-03: 敵軍ハリケンレオン下でファイブテクターにより SP1 のユニットを出すときもコマンドを1つホールドする（出典: grnrngr/faq-card-1 RS-014 Q2・faq-card-2 RS-097 Q7）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-097", "leon"), inst("TST-UNIT-2", "atk")] },
      player2: {
        operation: [inst("RS-014", "ft")],
        rush: [inst("TST-UNIT-0", "sp1")],
        command: releasedCommands(1, "TST-OP", "p2c"),
        power: powerCards(4),
      },
    });
    s = strike(s, "TST-UNIT-2:atk");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "TST-UNIT-0:sp1" });
    if (s.pendingCommandPayment) {
      s = act(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:p2c0"] });
    }
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });

  // 「バトルエリアに出す…ためにホールドするコマンドが無い」→ 出られない
  it("R-BA-03: 敵軍ハリケンレオン下でホールドできるコマンドが無ければ、ファイブテクターで SP1 のユニットを出せない（出典: grnrngr/faq-card-1 RS-014 Q2・faq-card-2 RS-097 Q2）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-097", "leon"), inst("TST-UNIT-2", "atk")] },
      player2: {
        operation: [inst("RS-014", "ft")],
        rush: [inst("TST-UNIT-0", "sp1")],
        command: [],
        power: powerCards(4),
      },
    });
    s = strike(s, "TST-UNIT-2:atk");
    expect(legalOfType(s, "five_tech_intercept").map((a) => a.interceptInstanceId)).not.toContain("TST-UNIT-0:sp1");
  });
});

describe("R-BA-04 「可能なら出る」の判定", () => {
  // 「コマンドをホールドすればバトルエリアに出られる」ので「出さなければならない」
  it("R-BA-04: アースの力が常駐中、ホールドできるコマンドがあればホールド制限ユニットも出さなければならない（出典: grnrngr/faq-card-1 RS-022 Q1）", () => {
    const s = battleState({
      player1: {
        operation: [inst("RS-022", "earth")],
        rush: [inst("RS-035", "tyra")],
        command: releasedCommands(1),
      },
    });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
  });

  // 「ホールドできるコマンドが無いのでバトルエリアに出られない」
  it("R-BA-04: アースの力が常駐中でもホールドできるコマンドが無ければ出なくてよい（出典: grnrngr/faq-card-1 RS-022 Q2）", () => {
    let s = battleState({
      player1: {
        operation: [inst("RS-022", "earth")],
        rush: [inst("RS-035", "tyra")],
        command: heldCommands(1),
      },
    });
    expect(legalOfType(s, "end_phase")).toHaveLength(1);
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(zoneOf(s, "player1", "RS-035:tyra")).toBe("rush");
  });

  // 「ホールドできるコマンドがあれば…出さなければなりません」
  it("R-BA-04: 敵軍ハリケンレオン下、タイガーレンジャーはホールドできるコマンドがあれば出なければならない（出典: grnrngr/faq-card-2 RS-097 Q5）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-041", "tiger")], command: releasedCommands(1) },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
    s = enterWithHold(s, "RS-041:tiger", ["TST-OP:cmd0"]);
    expect(zoneOf(s, "player1", "RS-041:tiger")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // 「ホールドできるコマンドが無ければ…ラッシュエリアに留まります」
  it("R-BA-04: 敵軍ハリケンレオン下、ホールドできるコマンドが無ければタイガーレンジャーはラッシュエリアに留まる（出典: grnrngr/faq-card-2 RS-097 Q5）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-041", "tiger")], command: heldCommands(1) },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    expect(canApply(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-041:tiger" })).toBe(false);
    expect(legalOfType(s, "end_phase")).toHaveLength(1);
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(zoneOf(s, "player1", "RS-041:tiger")).toBe("rush");
  });

  // 「ハリケンレオンが２体あるとき…ホールドしなければならないコマンドは２つ」
  it("R-BA-04: ハリケンレオン2体ならリリース状態のコマンドが1つしか無い SP1 ユニットは出られない（出典: grnrngr/faq-card-2 RS-097 Q8）", () => {
    const s = battleState({
      player1: { rush: [inst("TST-UNIT-0", "a")], command: releasedCommands(1) },
      player2: { battle: [inst("RS-097", "leon1"), inst("RS-097", "leon2")] },
    });
    expect(legalOfType(s, "move_to_battle").map((a) => a.instanceId)).not.toContain("TST-UNIT-0:a");
    expect(
      legal(s).some(
        (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "TST-UNIT-0:a",
      ),
    ).toBe(false);
  });

  // 「ホールドできる自軍コマンドがあれば…ホールドしてバトルエリアに出さなければ」
  it("R-BA-04: 敵軍ハリケンレオン下でレッドレーサーをラッシュすると、ホールドできるコマンドがあればバトルエリアに置く（出典: grnrngr/faq-card-2 RS-090 Q1・RS-097 Q3）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RS-090", "red")],
        power: powerCards(2),
        command: releasedCommands(2, "TST-OP-OT", "ot"),
      },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    const r = rushWithCategoryHold(s, "player1", "RS-090:red", "TST-OP-OT:ot0");
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
    if (s.pendingCommandPayment) {
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:ot1"] });
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-090:red")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  // 「ホールドできる自軍コマンドがなければ…ラッシュエリアに置かれます」
  it("R-BA-04: 敵軍ハリケンレオン下でホールドできるコマンドが無ければレッドレーサーはラッシュエリアに置かれる（出典: grnrngr/faq-card-2 RS-090 Q1・RS-097 Q3）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RS-090", "red")],
        power: powerCards(2),
        command: releasedCommands(1, "TST-OP-OT", "ot"),
      },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    const r = rushWithCategoryHold(s, "player1", "RS-090:red", "TST-OP-OT:ot0");
    expect(r.ok).toBe(true);
    s = settle(r.ok ? r.state : s);
    expect(zoneOf(s, "player1", "RS-090:red")).toBe("rush");
  });

  // 「手札を２枚捨てればバトルエリアに出ることは可能である」
  it("R-BA-04: 敵軍デカグリーンに引き出される狼鬼は、手札が2枚以上なら2枚捨ててバトルエリアに出る（出典: grnrngr/faq-card-2 RS-108 Q2）", () => {
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: fillers(2, "e"), rush: [inst("RS-108", "green")] },
      player1: { rush: [inst("RS-165", "rouki")], hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")] },
    });
    s = enter(s, "RS-108:green", "player2");
    expect(s.pendingEffectChoice?.effectId).toBeDefined();
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-165:rouki" } as never);
    if (s.pendingEffectChoice?.playerId === "player2") {
      s = act(s, { type: "confirm_effect_choice", playerId: "player2" } as never);
    }
    s = settle(s);
    // 手札の捨札選択がプレイヤー1に求められる場合はそれを解決する
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" && a.playerId === "player1");
      if (!pick) break;
      s = act(s, pick);
    }
    expect(zoneOf(s, "player1", "RS-165:rouki")).toBe("battle");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // 「手札が１枚以下であれば、「RS-165 狼鬼」はラッシュエリアに留まります」
  it("R-BA-04: 敵軍デカグリーンに選ばれても手札が1枚以下の狼鬼はラッシュエリアに留まる（出典: grnrngr/faq-card-2 RS-108 Q2）", () => {
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: fillers(2, "e"), rush: [inst("RS-108", "green")] },
      player1: { rush: [inst("RS-165", "rouki")], hand: [inst("TST-OP", "h1")] },
    });
    s = enter(s, "RS-108:green", "player2");
    const canPick = legal(s).some(
      (a) => a.type === "resolve_effect_choice" && JSON.stringify(a).includes("RS-165:rouki"),
    );
    // 選択自体が拒否される（cannot_enter_battle）か、選んでもバトルエリアに出ないこと
    const picked = canPick
      ? canApply(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-165:rouki" } as never)
      : false;
    if (picked) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-165:rouki" } as never);
      if (s.pendingEffectChoice?.playerId === "player2") {
        s = act(s, { type: "confirm_effect_choice", playerId: "player2" } as never);
      }
    } else if (s.pendingEffectChoice) {
      s = act(s, { type: "skip_effect_choice", playerId: "player2" } as never);
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-165:rouki")).toBe("rush");
    expect(s.players.player1.hand).toHaveLength(1);
  });

  // 「「バトルエリアに出られない」と判断して、ラッシュエリアに置きます」
  it("R-BA-04: ゼニボムで出られないターンはレッドレーサーの「可能なら」はラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-090 Q5・RS-110 Q2）", () => {
    // player2 の自軍バトルフェイズにデカピンクを5番目に出してゼニボムを発動 → 次の player1 ターンにレッドレーサーをラッシュ
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: fillers(4, "e"), rush: [inst("RS-110", "pink")], deck: deckCards(5, "e") },
      player1: {
        hand: [inst("RS-090", "red")],
        power: powerCards(2),
        command: releasedCommands(2, "TST-OP-OT", "ot"),
        deck: deckCards(5),
      },
    });
    s = enter(s, "RS-110:pink", "player2");
    expect(ncLogged(s, "RS-110")).toBe(true);
    s = passEntry(s, "player2");
    s = endTurn(s);
    // player1 のスタート→チャージ→ラッシュ
    for (let i = 0; i < 6 && s.phase !== "rush"; i++) {
      const next =
        legal(s).find((a) => a.type === "draw") ??
        legal(s).find((a) => a.type === "return_all_battle_to_rush") ??
        legal(s).find((a) => a.type === "end_phase");
      if (!next) break;
      s = act(s, next);
    }
    expect(s.phase).toBe("rush");
    const r = rushWithCategoryHold(s, "player1", "RS-090:red", "TST-OP-OT:ot0");
    expect(r.ok).toBe(true);
    s = settle(r.ok ? r.state : s);
    expect(zoneOf(s, "player1", "RS-090:red")).toBe("rush");
  });
});

describe("R-BA-05 1ターンに出られる数", () => {
  it.todo("R-BA-05: [未確定] 1ターンにバトルエリアへ出られるユニット数の上限（資料に記載なし）");
  it.todo("R-BA-05: [未確定] 同じユニットが同一ターンに再びバトルエリアへ出られるか（資料に記載なし）");
  it.todo(
    "R-BA-05: 効果でラッシュエリアに戻ったユニットはウイングで再アタックできる — 07章 R-KW-WING-04 のテストで検証する",
  );
});

// ---------------------------------------------------------------------------
// §2 アタックとバトル
// ---------------------------------------------------------------------------

describe("R-ATK-01 アタック", () => {
  // 「バトルエリアのユニットが相手のバトルエリアのユニットに対して行える」
  it("R-ATK-01: アタック対象は敵軍バトルエリアのユニットだけで、敵軍ラッシュエリアのユニットは選べない（出典: atwiki/page-138）", () => {
    const s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "b")], rush: [inst("TST-UNIT-0", "r")] },
    });
    expect(attackTargets(s, "TST-UNIT-2:a")).toEqual(["TST-UNIT-0:b"]);
    expect(
      canApply(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:a", defenderInstanceId: "TST-UNIT-0:r" }),
    ).toBe(false);
  });

  // 「相手のバトルエリアにユニットがない場合、アタックを宣言できません」
  it("R-ATK-01: 敵軍バトルエリアにユニットがなければアタックを宣言できない（出典: grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { rush: [inst("TST-UNIT-2", "a")] },
      player2: { rush: [inst("TST-UNIT-0", "r")] },
    });
    s = enter(s, "TST-UNIT-2:a");
    expect(legalOfType(s, "battle")).toHaveLength(0);
  });

  // 「アタックを宣言するときに同時に指定します」
  it("R-ATK-01: アタック宣言で指定した敵軍ユニットとだけバトルする（出典: grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-0", "b2")] },
    });
    expect(attackTargets(s, "TST-UNIT-2:a").sort()).toEqual(["TST-UNIT-0:b1", "TST-UNIT-0:b2"]);
    s = settle(attack(s, "TST-UNIT-2:a", "TST-UNIT-0:b2"));
    expect(ids(s.players.player2.battle)).toEqual(["TST-UNIT-0:b1"]);
    expect(ids(s.players.player2.discard)).toEqual(["TST-UNIT-0:b2"]);
  });

  // 「ビークルにユニットでアタックできますか？」「いいえ、できません」
  it("R-ATK-01: ビークルはアタック対象にならない（出典: atwiki/page-141 Q4）", () => {
    const rider = { ...inst("RK-031", "rider"), mountedOnInstanceId: "RK-058:zect" };
    const s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: { battle: [inst("RK-058", "zect"), rider] },
    });
    expect(attackTargets(s, "TST-UNIT-2:a")).not.toContain("RK-058:zect");
  });

  // 「「イエローサンダー」の効果は、敵軍バトルエリアにユニットが１体も無くても発動」
  it("R-ATK-01: マジイエローは敵軍バトルエリアが空でも NC を発動し、敵軍ラッシュエリアのユニットにアタックできる（出典: grnrngr/faq-card-1 RS-058 Q1・atwiki/page-138）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-058", "y")] },
      player2: { rush: [inst("TST-UNIT-0", "r")] },
    });
    s = enter(s, "RS-058:y");
    expect(ncLogged(s, "RS-058")).toBe(true);
    expect(attackTargets(s, "RS-058:y")).toEqual(["TST-UNIT-0:r"]);
  });
});

describe("R-ATK-02 1体1行動", () => {
  // 「アタックかストライクのどちらかを行った時点で…行動は終了」
  it("R-ATK-02: マジイエローがラッシュエリアのユニットにアタックした後は、ストライクもアタックもできない（出典: grnrngr/faq-card-1 RS-058 Q2）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-058", "y")] },
      player2: { rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2")], power: powerCards(3) },
    });
    s = enter(s, "RS-058:y");
    s = settle(attack(s, "RS-058:y", "TST-UNIT-0:r1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:r1")).toBe("discard");
    expect(canStrike(s, "RS-058:y")).toBe(false);
    expect(attackTargets(s, "RS-058:y")).toEqual([]);
  });

  // 「ストライクを行うか、アタックを行うか選ぶ事が出来る」
  it("R-ATK-02: SP1 以上のユニットはアタックとストライクの両方を選択肢に持つ（出典: atwiki/page-138）", () => {
    let s = battleState({
      player1: { rush: [inst("TST-UNIT-0", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "TST-UNIT-0:a");
    expect(canStrike(s, "TST-UNIT-0:a")).toBe(true);
    expect(attackTargets(s, "TST-UNIT-0:a")).toEqual(["TST-UNIT-0:d"]);
  });

  // 「アタックかストライクのどちらかを行った時点で…行動は終了」
  it("R-ATK-02: ストライクしたユニットはそのターンにアタックできない（出典: grnrngr/faq-card-1 RS-058 Q2）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "d")], power: powerCards(3) },
    });
    s = settle(strike(s, "TST-UNIT-0:a"));
    expect(s.players.player2.damage).toBe(1);
    expect(attackTargets(s, "TST-UNIT-0:a")).toEqual([]);
    expect(canStrike(s, "TST-UNIT-0:a")).toBe(false);
  });

  // 「アタックかストライクのどちらかを行った時点で…行動は終了」
  it("R-ATK-02: アタックしたユニットは生き残ってもストライクできない（出典: grnrngr/faq-card-1 RS-058 Q2）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "d")], power: powerCards(3) },
    });
    s = settle(attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:a")).toBe("battle");
    expect(canStrike(s, "TST-UNIT-2:a")).toBe(false);
  });

  // 「自軍ユニットはストライクを選んで行うことができますか？」「はい」
  it("R-ATK-02: 敵軍がジェットファルコンだけでアタックできなくても SP1 ユニットはストライクを選べる（出典: grnrngr/faq-card-3 RS-135 Q2）", () => {
    let s = battleState({
      player1: { rush: [inst("TST-UNIT-0", "a")] },
      player2: { battle: [inst("RS-135", "jet")] },
    });
    s = enter(s, "TST-UNIT-0:a");
    expect(attackTargets(s, "TST-UNIT-0:a")).toEqual([]);
    expect(canStrike(s, "TST-UNIT-0:a")).toBe(true);
  });
});

describe("R-ATK-03 アタック時の効果の期間", () => {
  // 「「アタックしてバトルが終了するまで」を期限とする」
  it("R-ATK-03: 超力の BP 上昇はそのバトル中に適用され、バトル終了後は残らない（出典: grnrngr/faq-card-1 RS-019 Q1）", () => {
    let s = battleState({
      player1: {
        operation: [inst("RS-019", "chouriki")],
        battle: [inst("TST-UNIT-0", "a")],
        // 超力はアタックするときに新たにホールドしたコマンドを数える（atwiki/page-243）ので、リリース状態で用意する。
        command: releasedCommands(3),
      },
      player2: { battle: [inst("TST-UNIT-2", "d")] },
    });
    s = settle(holdForAttack(attack(s, "TST-UNIT-0:a", "TST-UNIT-2:d"), 3));
    // BP1000 + アタック時にホールドした3枚×1000 = 4000 > 3000
    expect(zoneOf(s, "player2", "TST-UNIT-2:d")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("battle");
    const a = s.players.player1.battle.find((c) => c.instanceId === "TST-UNIT-0:a")!;
    expect(effectiveBp(s, "player1", a)).toBe(1000);
  });

  // 「バトルが終了してアタックの処理が終了した時点で効果が終了する」
  it("R-ATK-03: マジレッドの「アタックするとき BP＋」は次の相手ターンにアタックされたときには適用されない（出典: atwiki/page-138）", () => {
    let s = battleState({
      player1: {
        battle: fillers(2),
        rush: [inst("RS-057", "red")],
        command: releasedCommands(2),
        deck: deckCards(5),
      },
      player2: {
        battle: [inst("TST-UNIT-2", "d1")],
        rush: [inst("TST-UNIT-2", "d2")],
        deck: deckCards(5, "e"),
      },
    });
    s = enter(s, "RS-057:red");
    // BP2000 + リリース2枚×1000 = 4000 > 3000
    s = settle(attack(s, "RS-057:red", "TST-UNIT-2:d1"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:d1")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("battle");
    s = endTurn(s);
    // player2 のターン: バトルフェイズまで進めて BP3000 でマジレッド（BP2000）にアタック
    for (let i = 0; i < 6 && s.phase !== "battle"; i++) {
      const next = legal(s).find((a) => a.type === "draw") ?? legal(s).find((a) => a.type === "end_phase");
      if (!next) break;
      s = act(s, next);
    }
    s = enter(s, "TST-UNIT-2:d2", "player2");
    s = settle(attack(s, "TST-UNIT-2:d2", "RS-057:red", "player2"));
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:d2")).toBe("battle");
  });
});

describe("R-ATK-04 アタック対象とバトル対象は別", () => {
  // 「「隠流忍術」で変更されるのはバトルの対象のみです」
  it("R-ATK-04: 隠流忍術でバトル相手が非メカに変わっても、メカ（レスキューファイター）にアタックしたボウケンレッドの BP＋4000 は残る（出典: grnrngr/faq-card-1 RS-018 Q11）", () => {
    let s = battleState({
      player1: { battle: fillers(4), rush: [inst("RS-062", "red")] },
      player2: {
        battle: [inst("RS-089", "rescue"), inst("RS-165", "rouki")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = enter(s, "RS-062:red");
    expect(ncLogged(s, "RS-062")).toBe(true);
    s = attack(s, "RS-062:red", "RS-089:rescue");
    s = playCounter(s, "player2", "RS-018:ninjutsu", ["TST-OP-MA:ma0"], "RS-165:rouki");
    s = settle(s);
    // BP4000+4000=8000 vs 狼鬼 BP5000
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-062:red")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-089:rescue")).toBe("battle");
  });
});

describe("R-ATK-05 「アタックするかわりに」", () => {
  // 「アタックする対象がいない）状態でも…効果を発動することができる」
  it("R-ATK-05: 敵軍バトルエリアが空でもハリケンイエローは「超忍法・舞獅子」を発動できる（出典: atwiki/page-318 Q2 公式コラムvol44・ユーザー決定）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-100", "hy")], deck: [inst("RS-100", "deckhy"), ...deckCards(2)] },
      player2: { rush: [inst("TST-UNIT-0", "r")] },
    });
    s = enter(s, "RS-100:hy");
    expect(insteadOfAttackActions(s, "RS-100:hy").length).toBeGreaterThan(0);
  });

  // 「Ａを行う権利を失うかわりに、Ｂを行うことができる」
  it("R-ATK-05: アタックできる状態のハリケンイエローも、アタックのかわりに「超忍法・舞獅子」を選べる（出典: atwiki/page-318 Q2）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-100", "hy")], deck: [inst("RS-100", "deckhy"), ...deckCards(2)] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "RS-100:hy");
    expect(attackTargets(s, "RS-100:hy")).toEqual(["TST-UNIT-0:d"]);
    expect(insteadOfAttackActions(s, "RS-100:hy").length).toBeGreaterThan(0);
  });

  // 「「ハリケンイエロー」が１枚もないと判明…でも発動できますか？」「はい」
  it("R-ATK-05: 山札にハリケンイエローが無くても「超忍法・舞獅子」は発動できる（出典: grnrngr/faq-card-2 RS-100 Q1・atwiki/page-318 Q1）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-100", "hy")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "RS-100:hy");
    expect(insteadOfAttackActions(s, "RS-100:hy").length).toBeGreaterThan(0);
  });

  // 「アタックとみなして「RS-018 隠流忍術」を発動できますか？」「いいえ」
  it("R-ATK-05: ジュウクンドーはアタックではないので相手は隠流忍術を使えない（出典: grnrngr/faq-card-2 RS-106 Q4）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-106", "deka")] },
      player2: {
        battle: [inst("TST-UNIT-2", "d")],
        rush: [inst("TST-UNIT-0", "r")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(1);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:deka" });
    expect(s.pendingBattle).toBeUndefined();
    expect(canStartCounter(s, "player2", "RS-018:ninjutsu")).toBe(false);
  });

  // 「「アタックするかわりに」を発動条件とする「ジュウクンドー」の効果は発動できない」
  it("R-ATK-05: 敵軍がジェットファルコンだけでデカレッドがアタックできないならジュウクンドーは発動できない（出典: grnrngr/faq-card-2 RS-106 Q3・faq-card-3 RS-135 Q7）", () => {
    const s = battleState({
      player1: { battle: [inst("RS-106", "deka")] },
      player2: { battle: [inst("RS-135", "jet")], rush: [inst("TST-UNIT-0", "r")] },
    });
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(0);
  });

  // RS-106 はエラッタで「アタックできるとき」が条件（R-ERR-RS106）
  it("R-ATK-05: デカレッドはエラッタにより、敵軍バトルエリアにユニットがいなければジュウクンドーを発動できない（出典: grnrngr/faq-card-2 RS-106 Q6・wikiwiki/エラッタ）", () => {
    const s = battleState({
      player1: { battle: [inst("RS-106", "deka")] },
      player2: { rush: [inst("TST-UNIT-0", "r")] },
    });
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(0);
  });

  // 「アタックしてもよいタイミング（…まだしていない）であれば」
  it("R-ATK-05: アタック済みのデカレッドはジュウクンドーを発動できない（出典: atwiki/page-318 注釈）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-106", "deka")] },
      player2: { battle: [inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")], rush: [inst("TST-UNIT-0", "r")] },
    });
    s = settle(attack(s, "RS-106:deka", "TST-UNIT-0:d1"));
    expect(zoneOf(s, "player1", "RS-106:deka")).toBe("battle");
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(0);
  });

  // 「アタックする権利を失う代わりに効果を発動」
  it("R-ATK-05: ジュウクンドーを発動したデカレッドはそのターンにアタックできない（出典: atwiki/page-318 注釈）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-106", "deka")] },
      player2: { battle: [inst("TST-UNIT-0", "d")], rush: [inst("TST-UNIT-0", "r")] },
    });
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:deka" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:r" } as never);
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" } as never);
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("discard");
    s = settle(s);
    expect(attackTargets(s, "RS-106:deka")).toEqual([]);
  });

  // 「アタックできる状態であれば、アタックしなければなりません」
  it("R-ATK-05: ゴーマ宮下で1番目に並んだデカレッドは、アタックできるならジュウクンドーを使えない（出典: grnrngr/faq-card-4 RS-187 Q3）", () => {
    let s = battleState({
      player1: { operation: [inst("RS-187", "goma")], rush: [inst("RS-106", "deka")] },
      player2: { battle: [inst("TST-UNIT-0", "d")], rush: [inst("TST-UNIT-0", "r")] },
    });
    s = enter(s, "RS-106:deka");
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(0);
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(0);
    expect(attackTargets(s, "RS-106:deka")).toEqual(["TST-UNIT-0:d"]);
  });

  it.todo("R-ATK-05: [未確定] 公式コラム vol44 原文の確認（page-318 の抜粋のみ取得済み）");
});

describe("R-BTL-01 バトル", () => {
  // 「数値の低い方（同じなら両方）が撃破され、捨札になる」
  it("R-BTL-01: BP の低い方が撃破されて捨札になる（出典: atwiki/page-592・grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = settle(attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-2:a")).toBe("battle");
  });

  // 「アタックする側かされる側かの区別はない」
  it("R-BTL-01: アタックした側の BP が低ければアタックした側が撃破される（出典: atwiki/page-592）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "a")] },
      player2: { battle: [inst("TST-UNIT-2", "d")] },
    });
    s = settle(attack(s, "TST-UNIT-0:a", "TST-UNIT-2:d"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:d")).toBe("battle");
  });

  // 「BPが同じ値の時はお互いに撃破扱いになります」
  it("R-BTL-01: BP が同じなら両方撃破される（出典: grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: { battle: [inst("TST-UNIT-2", "d")] },
    });
    s = settle(attack(s, "TST-UNIT-2:a", "TST-UNIT-2:d"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:d")).toBe("discard");
  });

  // 「「バトルの対象を変更する」と解釈してください」
  it("R-BTL-01: 隠流忍術で「航空機」以外のアタッカーとジェットファルコンをバトルさせられる（出典: grnrngr/faq-card-1 RS-018 Q9・faq-card-3 RS-135 Q6）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d"), inst("RS-135", "jet")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d");
    s = playCounter(s, "player2", "RS-018:ninjutsu", ["TST-OP-MA:ma0"], "RS-135:jet");
    s = settle(s);
    // BP3000 vs ジェットファルコン BP1000
    expect(zoneOf(s, "player2", "RS-135:jet")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("battle");
  });
});

describe("R-BTL-02 相打ち", () => {
  // 「２つのユニットは同時に撃破された扱いになる」
  it("R-BTL-02: 相打ちでは両ユニットが同じバトルの結果として捨札になる（出典: atwiki/page-1826）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "a2")] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = settle(attack(s, "TST-UNIT-0:a", "TST-UNIT-0:d"));
    expect(ids(s.players.player1.discard)).toEqual(["TST-UNIT-0:a"]);
    expect(ids(s.players.player2.discard)).toEqual(["TST-UNIT-0:d"]);
    expect(ids(s.players.player1.battle)).toEqual(["TST-UNIT-0:a2"]);
  });

  // 「相打ちなら…敵軍ユニットを撃破したし…撃破した事になる」
  it("R-BTL-02: 相打ちでも一点突破のボウケンイエローは SP1 の敵軍ユニットを撃破したことになり1点ダメージを与える（出典: atwiki/page-1974・grnrngr/faq-card-1 RS-065）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-065", "by")] },
      player2: { battle: [inst("TST-UNIT-0", "d")], power: powerCards(3) },
    });
    s = enter(s, "RS-065:by");
    s = settle(attack(s, "RS-065:by", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player1", "RS-065:by")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  // 「ターンプレイヤーが、捨札にするかパワーゾーンに送るかを選択できます」
  it("R-BTL-02: プテラノドンとレスキューファイターの相打ちでは、ターンプレイヤーがプテラノドンをパワーゾーンに送る順を選べる（出典: grnrngr/faq-card-1 RS-018 Q12）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-039", "ptera")], rush: [inst("RS-089", "rescue")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = attack(s, "RS-039:ptera", "TST-UNIT-0:d");
    s = playCounter(s, "player2", "RS-018:ninjutsu", ["TST-OP-MA:ma0"], "RS-089:rescue");
    // ターンプレイヤー（player1）に処理順の選択が求められ、プテラノドンを先に処理するとパワーゾーンへ送れる
    for (let i = 0; i < 10; i++) {
      const choice = legal(s).find(
        (a) => a.playerId === "player1" && JSON.stringify(a).includes("RS-039:ptera") && a.type !== "battle",
      );
      if (choice) {
        s = act(s, choice);
        continue;
      }
      const passes = legal(s).find((a) => a.type.startsWith("pass_"));
      if (!passes) break;
      s = act(s, passes);
    }
    expect(zoneOf(s, "player1", "RS-039:ptera")).toBe("power");
  });

  // 「相打ちになり撃破されました…レジストの効果を発動…できますか？」「はい」
  it("R-BTL-02: アタックして相打ちになったレジスト持ちユニットはレジストを発動できる（出典: atwiki/page-1289 Q1・公式FAQ リファレンス「レジスト」）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-548", "tyranno")] },
      player2: { battle: [inst("TST-UNIT-2", "d")] },
    });
    s = attack(s, "RS-548:tyranno", "TST-UNIT-2:d");
    for (let i = 0; i < 5 && !legal(s).some((a) => a.type === "use_register"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(legalOfType(s, "use_register").length).toBeGreaterThan(0);
    s = act(s, legalOfType(s, "use_register")[0]!);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-548:tyranno")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-2:d")).toBe("discard");
  });
});

describe("R-BTL-03 「勝っても撃破される」は撃破されたユニット自身の効果", () => {
  // 「バトルに勝っても撃破される」（RS-339 闇のヤイバ）
  it("R-BTL-03: 敵軍ターン中に SP1 ユニットとバトルした闇のヤイバはバトルに勝っても撃破される（出典: atwiki/page-1974・page-1289 Q3）", () => {
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: [inst("TST-UNIT-0", "sp1")] },
      player1: { battle: [inst("RS-339", "yaiba")] },
    });
    s = settle(attack(s, "TST-UNIT-0:sp1", "RS-339:yaiba", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:sp1")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-339:yaiba")).toBe("discard");
  });

  // 「ゴーオンゴールドが敵軍ユニットを撃破したことにはならない」
  it("R-BTL-03: 「勝っても撃破される」で自壊した帝王アトンは、バトル相手のアカレンジャーに撃破されたことにならない（レッドビュート不発）（出典: atwiki/page-1974）", () => {
    // player1 ターン = アトン（player2）にとって敵軍ターン。アカレンジャーは5番目で NC「SP1」
    let s = battleState({
      player1: { battle: fillers(4), rush: [inst("RS-126", "aka")] },
      player2: { battle: [inst("RS-198", "aton")], rush: [inst("TST-UNIT-0", "small")] },
    });
    s = enter(s, "RS-126:aka");
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-126:aka")?.spModifier).toBe(1);
    s = settle(attack(s, "RS-126:aka", "RS-198:aton"));
    for (let i = 0; i < 3 && s.pendingEffectChoice; i++) {
      s = act(s, { type: "skip_effect_choice", playerId: s.pendingEffectChoice.playerId } as never);
    }
    expect(zoneOf(s, "player1", "RS-126:aka")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-198:aton")).toBe("discard");
    // アカレンジャーは「バトルで敵軍ユニットを撃破した」ことにならないので、ラッシュエリアの BP2000 以下は残る
    expect(zoneOf(s, "player2", "TST-UNIT-0:small")).toBe("rush");
  });

  // 「「バトルに勝っても撃破される」の効果で撃破された場合は、レジストを発動することはできません」
  it.todo(
    "R-BTL-03: 「勝っても撃破される」とレジストを併せ持つユニットはその撃破でレジストできない（出典: atwiki/page-1289 Q3）— 両方を持つカードが収録カードに無く、エンジン API で状況を作れないため",
  );

  // 「オペレーションやユニットの効果で…「撃破」…レジストは発動できません」
  it("R-BTL-03: 効果（ジュウクンドー）で撃破されたレジスト持ちユニットはレジストを発動できない（出典: atwiki/page-1289 Q2）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-106", "deka")] },
      player2: { battle: [inst("TST-UNIT-0", "d")], rush: [inst("RS-548", "tyranno")] },
    });
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:deka" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-548:tyranno" } as never);
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" } as never);
    expect(legalOfType(s, "use_register")).toHaveLength(0);
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-548:tyranno")).toBe("discard");
  });

  // 「負けて撃破された場合は…レジストを発動することができます」
  it("R-BTL-03: SP1 以上の相手にバトルで負けて撃破された場合はレジストできる（出典: atwiki/page-1289 Q3 補足）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-7", "big")] },
      player2: { battle: [inst("RS-548", "tyranno")] },
    });
    s = attack(s, "TST-UNIT-7:big", "RS-548:tyranno");
    for (let i = 0; i < 5 && !legal(s).some((a) => a.type === "use_register"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(legalOfType(s, "use_register").map((a) => a.playerId)).toContain("player2");
  });
});

/** RS-019 超力: アタック時に開くホールド数の選択（0〜リリース数）で n を選ぶ。 */
function holdForAttack(s: GameState, n: number): GameState {
  expect(s.pendingEffectChoice?.effectId).toBe("attack_hold_bonus");
  return act(s, { type: "resolve_effect_choice", playerId: s.pendingEffectChoice!.playerId, instanceId: String(n) });
}
