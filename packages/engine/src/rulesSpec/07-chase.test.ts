/**
 * docs/rules/07-keywords.md「チェイス」節（R-KW-CHASE-01〜02）のルール仕様テスト。
 * 出典: atwiki/page-1292（規定文・本文）、atwiki/page-156、atwiki/page-1845。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { act, card, hasLegal, inst, KW, powerCards, realDef, state, unitDef, vehicleDef, where } from "./07-helpers";

const V = vehicleDef("RSPEC-V");
const STRONG = unitDef("RSPEC-STRONG", { bp: 9000 });
const WEAK = unitDef("RSPEC-WEAK", { bp: 1000 });
/** RC を持つチェイス持ち。 */
const CHASER = unitDef("RSPEC-CHASER", { comboNumber: "RC", text: KW.chase, bp: 2000 });
/** RC を持たないチェイス持ち。 */
const CHASER_NO_RC = unitDef("RSPEC-CHASER-NORC", { comboNumber: 2, text: KW.chase, bp: 2000 });

const v1 = inst(V.id, "v1");
const v2 = inst(V.id, "v2");

const chaseOffered = (s: GameState, playerId = "player2") =>
  hasLegal(s, (a) => a.type === "resolve_chase" && a.playerId === playerId);

/** player2 のライド中チェイス持ちを、player1 のバトルフェイズに BP9000 でアタックして撃破する。 */
function destroyRiderInBattle(chaserDef = CHASER): { s: GameState; c: string } {
  const c = { ...inst(chaserDef.id, "c"), mountedOnInstanceId: v1.instanceId };
  let s = state([V, STRONG, CHASER, CHASER_NO_RC], {
    phase: "battle",
    player1: { rush: [inst(STRONG.id, "a")] },
    player2: { battle: [v1, c], rush: [v2] },
  });
  s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${STRONG.id}:a` });
  s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: `${STRONG.id}:a`, defenderInstanceId: c.instanceId });
  return { s, c: c.instanceId };
}

describe("R-KW-CHASE-01 規定文", () => {
  // 「ビークルを捨札にしてから…自軍ビークルにライドさせてもよい」
  it("R-KW-CHASE-01: ライド中にバトルで撃破されるとき、かわりにライド中のビークルを捨札にし、ライドされていない自軍ビークルに乗り換えられる（出典: atwiki/page-1292 規定文）", () => {
    let { s, c } = destroyRiderInBattle();
    expect(chaseOffered(s)).toBe(true);
    s = act(s, { type: "resolve_chase", playerId: "player2", newVehicleInstanceId: v2.instanceId });
    expect(where(s, "player2", v1.instanceId)).toBe("discard");
    expect(where(s, "player2", c)).not.toBe("discard");
    expect(card(s, "player2", c)?.mountedOnInstanceId).toBe(v2.instanceId);
  });

  // 「…ライドさせてもよい」（任意）
  it("R-KW-CHASE-01: チェイスは任意で、使わなければユニットは捨札になりビークルは残る（出典: atwiki/page-1292 規定文）", () => {
    let { s, c } = destroyRiderInBattle();
    s = act(s, { type: "pass_chase", playerId: "player2" });
    expect(where(s, "player2", c)).toBe("discard");
    expect(where(s, "player2", v1.instanceId)).toBe("battle");
  });

  // 「バトルでの撃破のみならず、パワー送りやコマンド送りなどにも対応できる」
  it.fails("R-KW-CHASE-01: 効果でパワーゾーンに送られるとき（ユニットでなくなるとき）もチェイスできる（出典: atwiki/page-1292 本文）", () => {
    // 既知の不具合: 未登録（効果によるパワーゾーン送りではチェイスの機会が出ず、そのまま送られる）
    const c = { ...inst(CHASER.id, "c"), mountedOnInstanceId: v1.instanceId };
    // RS-046 パトアーマー「これをラッシュしたとき…敵軍バトルエリアからBP8000以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る」
    let s = state([V, CHASER, realDef("RS-046")], {
      phase: "rush",
      player1: {
        hand: [inst("RS-046", "pa")],
        rush: [inst("TST-UNIT-0", "m")],
        command: [inst("TST-OP-OT", "c")],
        power: powerCards(5),
      },
      player2: { battle: [v1, c], rush: [v2] },
    });
    s = act(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-046:pa" });
    s = act(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: "TST-UNIT-0:m" });
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:c"] });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: c.instanceId });
    expect(chaseOffered(s)).toBe(true);
    s = act(s, { type: "resolve_chase", playerId: "player2", newVehicleInstanceId: v2.instanceId });
    expect(where(s, "player2", c.instanceId)).toBe("rush");
    expect(where(s, "player2", v1.instanceId)).toBe("discard");
  });

  // 「ライドされていないビークルが無ければ当然使えない」
  it("R-KW-CHASE-01: ライドされていない自軍ビークルがなければチェイスは使えない（出典: atwiki/page-1292 本文）", () => {
    const c = { ...inst(CHASER.id, "c"), mountedOnInstanceId: v1.instanceId };
    let s = state([V, STRONG, CHASER], {
      phase: "battle",
      player1: { rush: [inst(STRONG.id, "a")] },
      player2: { battle: [v1, c] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${STRONG.id}:a` });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: `${STRONG.id}:a`, defenderInstanceId: c.instanceId });
    expect(chaseOffered(s)).toBe(false);
    expect(where(s, "player2", c.instanceId)).toBe("discard");
  });

  // 「「撃破された」事実は変わらない」
  it.todo("R-KW-CHASE-01: チェイスで捨札を免れても「撃破された」事実は残る（撃破されたとき効果との組み合わせを起動できる実装カードがない）");

  // 「先にチェイスなど…を解決すると…以降の効果は解決されない」
  it.todo("R-KW-CHASE-01: 「ユニットでなくなるとき」に同時に起動する効果は、先にチェイスを解決するとそのタイミングが終わる（出典: atwiki/page-1845。イマジンの契約等の起動経路がない）");
});

describe("R-KW-CHASE-02 乗り換え先", () => {
  // 「ラッシュエリアのビークルに直接ライドし、そのままラッシュエリアで待機」
  it("R-KW-CHASE-02: ラッシュエリアのビークルに乗り換えたユニットは、そのままラッシュエリアで待機する（出典: atwiki/page-1292 本文）", () => {
    let { s, c } = destroyRiderInBattle();
    s = act(s, { type: "resolve_chase", playerId: "player2", newVehicleInstanceId: v2.instanceId });
    expect(where(s, "player2", c)).toBe("rush");
    expect(where(s, "player2", v2.instanceId)).toBe("rush");
  });

  // 「自軍ターン中ならば、そこから再度バトルエリアに出ることも可能」
  it("R-KW-CHASE-02: 自軍ターン中にチェイスでラッシュエリアのビークルに乗り換えたら、そこから再度バトルエリアに出られる（出典: atwiki/page-1292 本文）", () => {
    const c = inst(CHASER.id, "c");
    const enemy = inst(STRONG.id, "e");
    let s = state([V, STRONG, CHASER], {
      phase: "battle",
      player1: { rush: [v1, c, v2] },
      player2: { battle: [enemy] },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: c.instanceId, vehicleInstanceId: v1.instanceId });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: c.instanceId, defenderInstanceId: enemy.instanceId });
    expect(chaseOffered(s, "player1")).toBe(true);
    s = act(s, { type: "resolve_chase", playerId: "player1", newVehicleInstanceId: v2.instanceId });
    expect(where(s, "player1", c.instanceId)).toBe("rush");
    expect(
      hasLegal(
        s,
        (a) =>
          (a.type === "move_to_battle" && a.instanceId === c.instanceId) ||
          (a.type === "mount_ride" && a.riderInstanceId === c.instanceId),
      ),
    ).toBe(true);
  });

  // 「この能力自体にはユニットをライド可能とする効果はない」
  it("R-KW-CHASE-02: RC を持たず、乗り換え先のビークルにもライドできないユニットはチェイスできない（出典: atwiki/page-1292 本文）", () => {
    const { s, c } = destroyRiderInBattle(CHASER_NO_RC);
    expect(chaseOffered(s)).toBe(false);
    const after = hasLegal(s, (a) => a.type === "pass_chase") ? act(s, { type: "pass_chase", playerId: "player2" }) : s;
    expect(where(after, "player2", c)).toBe("discard");
  });

  // 「バトルエリアにあるビークルにライドできることもある」
  it.todo("R-KW-CHASE-02: [未確定] チェイスでバトルエリアにあるビークルに乗り換えられるか、その場合の並び順（page-156「対象として適切ならば…ライドできることもある」）");
});
