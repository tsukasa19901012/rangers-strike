/**
 * 選択（pendingEffectChoice）を伴う未消費キーワードのランタイム。
 * dsl/grantKeyword.ts のディスパッチから呼ばれる。
 */
import type { Category } from "@rangers-strike/cards";
import { cardCategories } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import type { GrantKeywordContext } from "../dsl/grantKeyword";
import { cardName, getDefinition, isSmallUnit } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { openEffectChoice, applyUnitLeave } from "./pendingChoices";

/** RS-496 / XP-010: 敵ダメージ1枚をオモテに→敵オモテ向きパワー1枚をダメージに。 */
export function beginFlipEnemyPowerDamage(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const enemyId = opponent(ctx.playerId);
  const faceDown = state.players[enemyId].power.filter((c) => c.faceDown);
  const faceUp = state.players[enemyId].power.filter((c) => !c.faceDown);
  if (faceDown.length === 0 || faceUp.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "flip_enemy_power_damage_pick",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_power",
    validInstanceIds: faceDown.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

export function resolveFlipEnemyPowerDamagePick(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  instanceId: string,
): GameState | null {
  const enemyId = opponent(pending.playerId);
  const enemy = state.players[enemyId];
  const idx = enemy.power.findIndex((c) => c.instanceId === instanceId && c.faceDown);
  if (idx < 0) return null;
  const power = enemy.power.map((c, i) => (i === idx ? { ...c, faceDown: false } : c));
  const flipped = { ...state, ...updatePlayer(state, enemyId, { ...enemy, power }) };
  const faceUp = power.filter((c) => !c.faceDown && c.instanceId !== instanceId);
  const validIds = power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (validIds.length === 0) return flipped;
  return openEffectChoice(flipped, {
    playerId: pending.playerId,
    effectId: "flip_enemy_power_damage_damage",
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    phasePlayerId: pending.phasePlayerId,
    kind: "select_power",
    validInstanceIds: validIds,
    selectCount: 1,
    optional: false,
  });
}

export function resolveFlipEnemyPowerDamageDamage(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  instanceId: string,
): GameState | null {
  const enemyId = opponent(pending.playerId);
  const enemy = state.players[enemyId];
  const idx = enemy.power.findIndex((c) => c.instanceId === instanceId && !c.faceDown);
  if (idx < 0) return null;
  const power = enemy.power.map((c, i) => (i === idx ? { ...c, faceDown: true } : c));
  return { ...state, ...updatePlayer(state, enemyId, { ...enemy, power }) };
}

/** XG1-002 / XG1-051: 敵常駐が2枚以上なら1枚選び、パワー送り or ホールドでコマンド送り。 */
export function beginEnemyResidentPick(
  state: GameState,
  ctx: GrantKeywordContext,
  destination: "power" | "command_hold",
): GameState | null {
  const enemyId = opponent(ctx.playerId);
  const ops = state.players[enemyId].operation;
  if (ops.length < 2) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId:
      destination === "power" ? "enemy_resident_pick_to_power" : "enemy_resident_pick_hold",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: ops.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

export function resolveEnemyResidentPick(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  instanceId: string,
): GameState | null {
  const enemyId = opponent(pending.playerId);
  const enemy = state.players[enemyId];
  const found = enemy.operation.find((c) => c.instanceId === instanceId);
  if (!found) return null;
  const operation = enemy.operation.filter((c) => c.instanceId !== instanceId);
  const stacked = (found.stackedCards ?? []).map((c) => ({ ...c }));
  const { stackedCards: _sc, ...card } = found;

  if (pending.effectId === "enemy_resident_pick_to_power") {
    const power = [...enemy.power, { ...card, faceDown: false }, ...stacked.map((c) => ({ ...c, faceDown: true }))];
    return { ...state, ...updatePlayer(state, enemyId, { ...enemy, operation, power }) };
  }
  // command_hold: 置けなければ捨札
  const COMMAND_MAX = 5;
  if (enemy.command.length < COMMAND_MAX) {
    const command = [...enemy.command, { ...card, commandHeld: true }];
    const discard = [...enemy.discard, ...stacked];
    return { ...state, ...updatePlayer(state, enemyId, { ...enemy, operation, command, discard }) };
  }
  const discard = [...enemy.discard, card, ...stacked];
  return { ...state, ...updatePlayer(state, enemyId, { ...enemy, operation, discard }) };
}

/** XG2-069 / XP-007: 数字宣言→山札トップ公開→条件で敵ユニットをパワー送り。 */
export function beginDeclareNumberDeckReveal(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  if (state.players[ctx.playerId].deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "declare_number_deck_reveal_destroy",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "declare_number",
    validInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

export function resolveDeclareNumberDeckReveal(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  declared: number,
): GameState {
  const player = state.players[pending.playerId];
  const [top, ...rest] = player.deck;
  if (!top) return state;
  const def = getDefinition(state.definitions, top.cardId);
  const topCost =
    typeof def?.powerCost === "number" ? def.powerCost : parseInt(String(def?.powerCost ?? ""), 10);
  // オモテにして山札の下へ
  const withBottom = {
    ...state,
    ...updatePlayer(state, pending.playerId, { ...player, deck: [...rest, top] }),
    log: [
      ...state.log,
      `${cardName(state.definitions, top.cardId)} を公開（宣言: ${declared}）`,
    ],
  };
  if (!Number.isFinite(topCost) || topCost < declared) return withBottom;
  const enemyId = opponent(pending.playerId);
  const enemy = withBottom.players[enemyId];
  const targets = [...enemy.battle, ...enemy.rush].filter((c) => {
    const d = getDefinition(withBottom.definitions, c.cardId);
    const cost = typeof d?.powerCost === "number" ? d.powerCost : NaN;
    return cost === declared;
  });
  if (targets.length === 0) return withBottom;
  return (
    openEffectChoice(withBottom, {
      playerId: pending.playerId,
      effectId: "declare_number_send_power",
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId,
      phasePlayerId: pending.phasePlayerId,
      kind: "select_unit",
      validInstanceIds: targets.map((c) => c.instanceId),
      unitDestination: "power",
      selectCount: 1,
      optional: false,
    }) ?? withBottom
  );
}

/** PK-006: 敵SビークルとライダーをまとめてBAから除去。 */
export function beginDestroyVehicleAndRider(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const enemyId = opponent(ctx.playerId);
  const vehicles = state.players[enemyId].battle.filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "vehicle" && d.size === "S";
  });
  if (vehicles.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "destroy_vehicle_and_rider",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: vehicles.map((c) => c.instanceId),
    selectCount: 1,
    optional: false,
  });
}

export function resolveDestroyVehicleAndRider(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  instanceId: string,
): GameState | null {
  const enemyId = opponent(pending.playerId);
  let nextState = state;
  const rider = state.players[enemyId].battle.find(
    (c) => c.mountedOnInstanceId === instanceId,
  );
  if (rider) {
    const left = applyUnitLeave(nextState, rider.instanceId, "discard", pending.phasePlayerId);
    if (!("error" in left)) nextState = left.state;
  }
  const left = applyUnitLeave(nextState, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return null;
  return left.state;
}

/** XG3-072: 自身をホールド→特徴「男」の敵ユニット撃破→特徴完全一致の敵オモテパワーをウラに。 */
export function beginHoldEntryDestroy(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return null;
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const targets = [...enemy.battle, ...enemy.rush].filter((c) =>
    (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("男"),
  );
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "hold_entry_destroy_male",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: selfId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: targets.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

export function resolveHoldEntryDestroy(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  instanceId: string,
): GameState | null {
  const selfId = pending.sourceInstanceId;
  const player = state.players[pending.playerId];
  const enemyId = opponent(pending.playerId);
  const target =
    state.players[enemyId].battle.find((c) => c.instanceId === instanceId) ??
    state.players[enemyId].rush.find((c) => c.instanceId === instanceId);
  if (!target || !selfId) return null;
  const targetFeatures = new Set(
    getDefinition(state.definitions, target.cardId)?.features ?? [],
  );

  // 自身をホールド
  const battle = player.battle.map((c) =>
    c.instanceId === selfId ? { ...c, commandHeld: true } : c,
  );
  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, pending.playerId, { ...player, battle }),
  };

  const left = applyUnitLeave(nextState, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return null;
  nextState = left.state;

  // 特徴完全一致の敵オモテ向きパワーを1枚ウラに（自動選択: 先頭）
  const enemy = nextState.players[enemyId];
  const matchIdx = enemy.power.findIndex((c) => {
    if (c.faceDown) return false;
    const fs = new Set(getDefinition(nextState.definitions, c.cardId)?.features ?? []);
    return fs.size === targetFeatures.size && [...fs].every((f) => targetFeatures.has(f));
  });
  if (matchIdx >= 0) {
    const power = enemy.power.map((c, i) => (i === matchIdx ? { ...c, faceDown: true } : c));
    nextState = { ...nextState, ...updatePlayer(nextState, enemyId, { ...enemy, power }) };
  }
  return nextState;
}

/** RS-623 等 翼合体: DA なし自軍 L に自身を重ね、L に ※ウイング と BP を付与。 */
export function beginStackSelfOntoL(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return null;
  const player = state.players[ctx.playerId];
  const targets = [...player.rush, ...player.battle].filter((c) => {
    if (c.instanceId === selfId) return false;
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && d.size === "L" && !cardCategories(d).includes("DA" as Category);
  });
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "stack_self_onto_l",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: selfId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: targets.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

export function resolveStackSelfOntoL(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  hostInstanceId: string,
): GameState | null {
  const selfId = pending.sourceInstanceId;
  if (!selfId) return null;
  const player = state.players[pending.playerId];
  const self =
    player.rush.find((c) => c.instanceId === selfId) ??
    player.battle.find((c) => c.instanceId === selfId);
  if (!self) return null;
  const { stackedCards: _sc, ...selfClean } = self;

  const attach = (cards: readonly (typeof self)[]) =>
    cards
      .filter((c) => c.instanceId !== selfId)
      .map((c) =>
        c.instanceId === hostInstanceId
          ? { ...c, stackedCards: [...(c.stackedCards ?? []), selfClean] }
          : c,
      );
  const cleanPlayer = {
    ...player,
    rush: attach(player.rush),
    battle: attach(player.battle),
  };
  return { ...state, ...updatePlayer(state, pending.playerId, cleanPlayer) };
}

/** XG2-025 等: ライドされていない自軍ビークルを自身の下に重ねる。 */
export function beginStackVehicleUnderSelf(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return null;
  const player = state.players[ctx.playerId];
  const ridden = new Set(
    player.rush.concat(player.battle).map((c) => c.mountedOnInstanceId).filter(Boolean),
  );
  const vehicles = player.rush.filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "vehicle" && !ridden.has(c.instanceId);
  });
  if (vehicles.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "stack_vehicle_under_self",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: selfId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: vehicles.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

export function resolveStackVehicleUnderSelf(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  vehicleInstanceId: string,
): GameState | null {
  const selfId = pending.sourceInstanceId;
  if (!selfId) return null;
  const player = state.players[pending.playerId];
  const vehicle = player.rush.find((c) => c.instanceId === vehicleInstanceId);
  if (!vehicle) return null;
  const rush = player.rush
    .filter((c) => c.instanceId !== vehicleInstanceId)
    .map((c) =>
      c.instanceId === selfId
        ? { ...c, stackedCards: [...(c.stackedCards ?? []), vehicle] }
        : c,
    );
  const battle = player.battle.map((c) =>
    c.instanceId === selfId
      ? { ...c, stackedCards: [...(c.stackedCards ?? []), vehicle] }
      : c,
  );
  return { ...state, ...updatePlayer(state, pending.playerId, { ...player, rush, battle }) };
}
