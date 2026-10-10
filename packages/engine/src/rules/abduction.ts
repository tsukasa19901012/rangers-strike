/**
 * RS-322 ベン・G【人身略取】の後半:
 * 「そうしたとき、相手は自分自身がそのカードの持ち主であるかのように、そのカードの追加条件を可能なら満たす。」
 *
 * ルール: R-ADD-08 — 母艦（ジャガーバルカン等）の代替手段で満たせるなら、強制の追加条件は満たさなければならない。
 *   母艦の置き換えは足りないSユニットの分だけに使える（RS-076 Q1・RS-105 Q1）。
 */
import { getZordCondition, MOTHERSHIP_CONFIG } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { collectZordMaterials, applyZordMaterial } from "./zord";
import { canUseMothershipForZordRush, collectMothershipEligibleCommands } from "./mothership";

export const ABDUCTION_MATERIAL_EFFECT_ID = "abduction_material";
export const ABDUCTION_DESTINATION_EFFECT_ID = "abduction_destination";
const MOTHERSHIP_OPTION = "mothership";

export function isAbductionChoice(effectId: string | undefined): boolean {
  return effectId === ABDUCTION_MATERIAL_EFFECT_ID || effectId === ABDUCTION_DESTINATION_EFFECT_ID;
}

type AbductionContext = {
  /** 追加条件を満たす側（ベン・G の相手）。 */
  payerId: PlayerId;
  phasePlayerId: PlayerId;
  /** 捨札にした M ユニットのカード ID。 */
  cardId: string;
  remaining: number;
};

function neededUnits(state: GameState, cardId: string): number {
  const count = getDefinition(state.definitions, cardId)?.rushAdditionalCondition?.unitCount;
  return typeof count === "number" && count > 0 ? count : 1;
}

function materialsFor(state: GameState, ctx: AbductionContext): string[] {
  return collectZordMaterials(
    state.players[ctx.payerId],
    state.definitions,
    ctx.cardId,
    "",
  ).map((c) => c.instanceId);
}

function mothershipCommands(state: GameState, ctx: AbductionContext): string[] {
  const payer = state.players[ctx.payerId];
  const kind = canUseMothershipForZordRush(state.definitions, payer, ctx.cardId);
  if (!kind) return [];
  return collectMothershipEligibleCommands(
    payer,
    state.definitions,
    MOTHERSHIP_CONFIG[kind].commandCategory,
  )
    .filter((e) => e.zone === "command")
    .map((e) => e.card.instanceId);
}

function holdCommand(player: PlayerState, instanceId: string): PlayerState {
  return {
    ...player,
    command: player.command.map((c) =>
      c.instanceId === instanceId ? { ...c, commandHeld: true, mothershipHold: true } : c,
    ),
  };
}

function decode(state: GameState): AbductionContext | null {
  const pending = state.pendingEffectChoice;
  const meta = pending?.abductionMeta;
  if (!pending || !meta) return null;
  return { ...meta, phasePlayerId: pending.phasePlayerId };
}

function openChoice(
  state: GameState,
  ctx: AbductionContext,
  effectId: string,
  validInstanceIds: string[],
  sourceInstanceId?: string,
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      playerId: ctx.payerId,
      effectId,
      sourceCardId: "RS-322",
      sourceInstanceId,
      kind: effectId === ABDUCTION_DESTINATION_EFFECT_ID ? "confirm" : "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds,
      selectedInstanceIds: [],
      optional: false,
      abductionMeta: { payerId: ctx.payerId, cardId: ctx.cardId, remaining: ctx.remaining },
    },
    activePlayer: ctx.payerId,
  };
}

function finish(state: GameState, ctx: AbductionContext): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: ctx.phasePlayerId };
}

/** 残りの追加条件を進める（選ぶ必要が無ければ自動）。 */
function proceed(state: GameState, ctx: AbductionContext): GameState {
  let next = state;
  let current = ctx;
  for (let guard = 0; guard < 8 && current.remaining > 0; guard += 1) {
    const materials = materialsFor(next, current);
    const motherships = mothershipCommands(next, current);
    if (materials.length === 0) {
      // Sユニットが足りない分は母艦で代える（可能なら満たす）。
      const commandId = motherships[0];
      if (!commandId) break;
      next = {
        ...next,
        ...updatePlayer(next, current.payerId, holdCommand(next.players[current.payerId], commandId)),
      };
      current = { ...current, remaining: current.remaining - 1 };
      continue;
    }
    const options = motherships.length > 0 ? [...materials, MOTHERSHIP_OPTION] : materials;
    return openChoice(next, current, ABDUCTION_MATERIAL_EFFECT_ID, options);
  }
  return finish(next, current);
}

/** ベン・G の効果で手札の M ユニットを捨札にした後に呼ぶ。 */
export function startAbductionCondition(
  state: GameState,
  benOwnerId: PlayerId,
  discardedCardId: string,
  phasePlayerId: PlayerId,
): GameState {
  const condition = getZordCondition(discardedCardId);
  if (!condition) return state;
  const ctx: AbductionContext = {
    payerId: opponent(benOwnerId),
    phasePlayerId,
    cardId: discardedCardId,
    remaining: neededUnits(state, discardedCardId),
  };
  const next = proceed(state, ctx);
  return next.pendingEffectChoice ? next : finish(next, ctx);
}

function applyMaterial(
  state: GameState,
  ctx: AbductionContext,
  materialId: string,
  destination: "command" | "discard",
): GameState {
  const payer = state.players[ctx.payerId];
  const applied = applyZordMaterial(payer, state.definitions, ctx.cardId, "", materialId, destination);
  if (!applied) return state;
  return { ...state, ...updatePlayer(state, ctx.payerId, applied) };
}

export function resolveAbductionChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; log?: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  const ctx = decode(state);
  if (!pending || !ctx || !isAbductionChoice(pending.effectId)) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };

  const condition = getZordCondition(ctx.cardId);
  if (pending.effectId === ABDUCTION_DESTINATION_EFFECT_ID) {
    const materialId = pending.sourceInstanceId!;
    const next = applyMaterial(state, ctx, materialId, instanceId as "command" | "discard");
    return { state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }) };
  }

  if (instanceId === MOTHERSHIP_OPTION) {
    const commandId = mothershipCommands(state, ctx)[0];
    if (!commandId) return { error: "invalid_target" };
    const next = {
      ...state,
      ...updatePlayer(state, ctx.payerId, holdCommand(state.players[ctx.payerId], commandId)),
    };
    return { state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }) };
  }

  const payer = state.players[ctx.payerId];
  if (
    condition === "send_s_unit_to_command_or_discard" &&
    payer.command.length < COMMAND_ZONE_MAX
  ) {
    return {
      state: openChoice(state, ctx, ABDUCTION_DESTINATION_EFFECT_ID, ["command", "discard"], instanceId),
    };
  }
  const next = applyMaterial(state, ctx, instanceId, "discard");
  return {
    state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }),
    log: buildLogEntry(
      playerId,
      "resolve_effect_choice",
      "RS-322",
      state.definitions,
      `abduction:${cardName(state.definitions, ctx.cardId)}`,
    ),
  };
}
