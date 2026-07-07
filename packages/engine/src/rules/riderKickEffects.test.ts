import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { applyGrantKeyword } from "../dsl/grantKeyword";
import { createTestState, inst } from "../testing/fixtures";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));

function baseState(overrides: Parameters<typeof createTestState>[0]["player1"]) {
  return createTestState({
    phase: "battle",
    definitions: { ...createTestState().definitions, ...defs },
    player1: overrides,
  });
}

function ctx(sourceCardId: string, effectId: string, selfId?: string) {
  return {
    playerId: "player1" as const,
    phasePlayerId: "player1" as const,
    sourceCardId,
    effectId,
    triggerSourceInstanceId: selfId,
    optional: true,
  };
}

describe("報告カードの能動効果ランタイム", () => {
  it("XG3-066 ライダースラッシュ: 条件を満たす敵 S を選んで撃破するバナーが出る", () => {
    const self = inst("XG3-066", "self");
    // ナンバー1 の敵 S ユニット（XG3-066 自身が number:1 の S）を的にする
    const enemy = inst("XG3-066", "target");
    const state = baseState({ battle: [self] });
    state.players.player2 = { ...state.players.player2, battle: [enemy] };

    const { state: opened } = applyGrantKeyword(
      state,
      ctx("XG3-066", "raidasurashu", self.instanceId),
      "effect_card::XG3-066::raidasurashu",
    );
    expect(opened.pendingEffectChoice?.effectId).toBe("rider_slash_destroy");
    expect(opened.pendingEffectChoice?.validInstanceIds).toContain(enemy.instanceId);

    const r = applyAction(opened, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: enemy.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.player2.battle.some((c) => c.instanceId === enemy.instanceId)).toBe(
      false,
    );
    expect(r.state.players.player2.discard.some((c) => c.instanceId === enemy.instanceId)).toBe(
      true,
    );
  });

  it("XG2-066 ライダーキック: パワー1/2/3 が揃うと1枚捨てて自身が SP1", () => {
    const self = inst("XG2-066", "self");
    const p1 = inst("XG3-066", "p1"); // powerCost 7- → digit 7, 使わない
    const state = baseState({
      battle: [self],
      power: [
        { ...inst("RK-135", "pw1") }, // powerCost 1
        { ...inst("XG3-062", "pw2") }, // 後述、powerCost 2 相当を用意できない場合は下で調整
      ],
    });
    // powerCost 1/2/3 を確実に用意（catalog 依存を避け、定義を直接注入）
    state.definitions = {
      ...state.definitions,
      "TST-PW1": { ...defs["RK-135"], id: "TST-PW1", powerCost: 1 },
      "TST-PW2": { ...defs["RK-135"], id: "TST-PW2", powerCost: 2 },
      "TST-PW3": { ...defs["RK-135"], id: "TST-PW3", powerCost: 3 },
    } as typeof state.definitions;
    state.players.player1 = {
      ...state.players.player1,
      power: [inst("TST-PW1", "pw1"), inst("TST-PW2", "pw2"), inst("TST-PW3", "pw3")],
    };

    const { state: opened } = applyGrantKeyword(
      state,
      ctx("XG2-066", "raidakiku", self.instanceId),
      "effect_card::XG2-066::raidakiku",
    );
    expect(opened.pendingEffectChoice?.effectId).toBe("rider_kick_discard_power_sp1");

    const pick = opened.pendingEffectChoice!.validInstanceIds[0]!;
    const r = applyAction(opened, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: pick,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const selfAfter = r.state.players.player1.battle.find((c) => c.instanceId === self.instanceId);
    expect(selfAfter?.spOverride).toBe(1);
    expect(r.state.players.player1.power.length).toBe(2);
  });

  it("XG3-062 ライダーキック: パワー1/2/3 が揃うと敵 S をパワー送り（自軍は対象外）", () => {
    const self = inst("XG3-062", "self");
    const enemy = inst("XG3-066", "enemyS");
    const ally = inst("XG3-066", "allyS");
    const state = baseState({ battle: [self, ally] });
    state.definitions = {
      ...state.definitions,
      "TST-PW1": { ...defs["RK-135"], id: "TST-PW1", powerCost: 1 },
      "TST-PW2": { ...defs["RK-135"], id: "TST-PW2", powerCost: 2 },
      "TST-PW3": { ...defs["RK-135"], id: "TST-PW3", powerCost: 3 },
    } as typeof state.definitions;
    state.players.player1 = {
      ...state.players.player1,
      power: [inst("TST-PW1", "pw1"), inst("TST-PW2", "pw2"), inst("TST-PW3", "pw3")],
    };
    state.players.player2 = { ...state.players.player2, battle: [enemy] };

    const { state: opened } = applyGrantKeyword(
      state,
      ctx("XG3-062", "raidakiku", self.instanceId),
      "effect_card::XG3-062::raidakiku",
    );
    expect(opened.pendingEffectChoice?.effectId).toBe("rider_kick_send_power");
    // 自軍ユニットは選択肢に含まれない
    expect(opened.pendingEffectChoice?.validInstanceIds).toContain(enemy.instanceId);
    expect(opened.pendingEffectChoice?.validInstanceIds).not.toContain(ally.instanceId);

    const r = applyAction(opened, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: enemy.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.player2.power.some((c) => c.instanceId === enemy.instanceId)).toBe(true);
  });

  it("RK-135 潜行捜索: 数字宣言で山札下を公開し、一致すると手札へ", () => {
    const self = inst("RK-135", "self");
    // 山札の下（末尾）に powerCost 1 のカードを置く
    const bottom = inst("RK-135", "bottom"); // powerCost 1
    const state = baseState({
      battle: [self],
      deck: [inst("XG3-066", "d0"), bottom],
    });

    const { state: opened } = applyGrantKeyword(
      state,
      ctx("RK-135", "fx_unknown_e6bd9c", self.instanceId),
      "rk_fx::RK-135::fx_unknown_e6bd9c",
    );
    expect(opened.pendingEffectChoice?.kind).toBe("declare_number");
    expect(opened.pendingEffectChoice?.effectId).toBe("senko_sosa_declare");

    const r = applyAction(opened, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: "1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.player1.hand.some((c) => c.instanceId === bottom.instanceId)).toBe(true);
  });

  it("RK-135 潜行捜索: 不一致なら山札の下へ戻る", () => {
    const self = inst("RK-135", "self");
    const bottom = inst("RK-135", "bottom"); // powerCost 1
    const state = baseState({
      battle: [self],
      deck: [inst("XG3-066", "d0"), bottom],
    });
    const { state: opened } = applyGrantKeyword(
      state,
      ctx("RK-135", "fx_unknown_e6bd9c", self.instanceId),
      "rk_fx::RK-135::fx_unknown_e6bd9c",
    );
    const r = applyAction(opened, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: "5",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.player1.hand.some((c) => c.instanceId === bottom.instanceId)).toBe(false);
    expect(r.state.players.player1.deck[0]?.instanceId).toBe(bottom.instanceId);
  });

  it("RK-301 エクステンドライダー落とし: カブトエクステンダーがあると本来BP8000以下の敵をパワー送り", () => {
    const self = inst("RK-301", "self");
    const partner = inst("RK-300", "partner"); // カブトエクステンダー
    const weakEnemy = inst("RK-135", "weak"); // bp 1000
    const state = baseState({ battle: [self, partner] });
    state.players.player2 = { ...state.players.player2, battle: [weakEnemy] };

    const { state: opened } = applyGrantKeyword(
      state,
      ctx("RK-301", "ekusutendoraidatoshi", self.instanceId),
      "rk_fx::RK-301::ekusutendoraidatoshi",
    );
    expect(opened.pendingEffectChoice?.effectId).toBe("extend_rider_drop");
    expect(opened.pendingEffectChoice?.validInstanceIds).toContain(weakEnemy.instanceId);

    const r = applyAction(opened, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: weakEnemy.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.player2.power.some((c) => c.instanceId === weakEnemy.instanceId)).toBe(
      true,
    );
  });

  it("RK-301: カブトエクステンダーが無ければ発動しない", () => {
    const self = inst("RK-301", "self");
    const weakEnemy = inst("RK-135", "weak");
    const state = baseState({ battle: [self] });
    state.players.player2 = { ...state.players.player2, battle: [weakEnemy] };
    const { state: opened } = applyGrantKeyword(
      state,
      ctx("RK-301", "ekusutendoraidatoshi", self.instanceId),
      "rk_fx::RK-301::ekusutendoraidatoshi",
    );
    expect(opened.pendingEffectChoice).toBeUndefined();
  });

  it("RK-065 ライダーキック: OTコマンド3ホールドで自身が SP1（effect_hold 経路）", () => {
    const self = inst("RK-065", "self");
    const state = baseState({
      battle: [self],
      command: [
        inst("TST-OP-OT", "c1"),
        inst("TST-OP-OT", "c2"),
        inst("TST-OP-OT", "c3"),
      ],
    });

    const { state: opened } = applyGrantKeyword(
      state,
      ctx("RK-065", "raidakiku", self.instanceId),
      "hold_3_ot_commands_then_sp1",
    );
    expect(opened.pendingEffectChoice?.effectId).toBe("hold_ot_commands_then_sp");
    expect(opened.pendingEffectChoice?.commandAction).toBe("hold");
    expect(opened.pendingEffectChoice?.selectCount).toBe(3);

    let r = applyAction(opened, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "effect_hold",
      sourceInstanceId: self.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    r = applyAction(r.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: ["TST-OP-OT:c1", "TST-OP-OT:c2", "TST-OP-OT:c3"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const selfAfter = r.state.players.player1.battle.find((c) => c.instanceId === self.instanceId);
    expect(selfAfter?.spOverride).toBe(1);
    expect(r.state.players.player1.command.filter((c) => c.commandHeld).length).toBe(3);
  });

  it("RK-142 最初からクライマックスだぜ: 味方仮面ライダー進入時にパワーの常駐を捨てて SP1", () => {
    const rider = inst("XG3-066", "rider"); // 特徴「仮面ライダー」
    const momotaros = inst("RK-142", "momo"); // パワーゾーンでオモテ向き
    const state = createTestState({
      phase: "battle",
      definitions: { ...createTestState().definitions, ...defs },
      player1: {
        rush: [rider],
        power: [{ ...momotaros, faceDown: false }],
      },
    });

    const r = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: rider.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingEffectChoice?.effectId).toBe("power_faceup_sp1_grant");

    const r2 = applyAction(r.state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: momotaros.instanceId,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const riderAfter = r2.state.players.player1.battle.find((c) => c.instanceId === rider.instanceId);
    expect(riderAfter?.spOverride).toBe(1);
    expect(r2.state.players.player1.power.some((c) => c.instanceId === momotaros.instanceId)).toBe(
      false,
    );
    expect(r2.state.players.player1.discard.some((c) => c.instanceId === momotaros.instanceId)).toBe(
      true,
    );
  });

  it("XG3-069 カメンライド: ラッシュフェイズに起動でき、パワーの仮面ライダーをラッシュ展開", () => {
    const diend = inst("XG3-069", "diend");
    // powerCost/追加条件なしの仮面ライダーユニットをパワーに用意
    const state = createTestState({
      phase: "rush",
      definitions: { ...createTestState().definitions, ...defs },
      player1: {
        rush: [diend],
        power: [{ ...inst("RK-135", "pw1"), faceDown: false }],
      },
    });

    const legal = getLegalActions(state);
    const activate = legal.find(
      (a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === diend.instanceId,
    );
    expect(activate, "起動アクションが列挙される").toBeDefined();

    const r = applyAction(state, activate!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingEffectChoice?.effectId).toBe("kamen_ride_deploy");

    // 1枚選んでスキップ → 1枚だけ展開
    const pick = r.state.pendingEffectChoice!.validInstanceIds[0]!;
    const r2 = applyAction(r.state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: pick,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // selectCount 1（対象1枚）なので即確定
    const deployed = r2.state.players.player1.rush.find((c) => c.instanceId === pick);
    expect(deployed).toBeDefined();
    expect(deployed?.tempDiscardAtTurnEnd).toBe(true);
    expect(deployed?.battleActed).toBe(true);
    // 同ラッシュフェイズ中は再起動できない
    expect(
      getLegalActions(r2.state).some(
        (a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === diend.instanceId,
      ),
    ).toBe(false);
  });
});
