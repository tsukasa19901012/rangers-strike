/**
 * RS-284 ホワイトスワン【スワンウィング】（NC）:
 * 敵軍コマンドゾーンにある S ユニットのカードをすべてラッシュエリアに出してもよい。
 *
 * - 出したユニットは持ち主（相手）のラッシュエリアに出て「ラッシュされた」扱い。ラッシュしたときの効果や
 *   「敵軍ユニットがラッシュされたとき」の効果（RS-279 グリーンサイ【サイカッター】等）は発動する
 *   （atwiki/page-472 コメント、faq rider_1 RS-284 の問）。
 * - 必要パワー・追加条件は問わない（「出す」効果）。
 * 簡略化: 出したユニットごとの疾風流超忍法等のラッシュ反応窓は開かない。
 */
import { getDefinition } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { applyOnRushUnitEffects } from "./onRushUnitEffects";
import { markRushedThisTurn } from "./turnModifiers";
import { openEffectChoice } from "./pendingChoices";

export const SWAN_WING_EFFECT_ID = "swan_wing_deploy_enemy_command_s";

export function listSwanWingTargets(state: GameState, playerId: PlayerId): CardInstance[] {
  const enemy = state.players[opponent(playerId)];
  return enemy.command.filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def?.type === "unit" && def.size === "S";
  });
}

/** 「出してもよい」— 使うかどうかを選ぶ（使わないときは skip）。対象がなければ何もしない。 */
export function startSwanWingChoice(
  state: GameState,
  args: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string },
): GameState | null {
  if (listSwanWingTargets(state, args.playerId).length === 0) return null;
  return openEffectChoice(state, {
    playerId: args.playerId,
    effectId: SWAN_WING_EFFECT_ID,
    sourceCardId: args.sourceCardId,
    sourceInstanceId: args.sourceInstanceId,
    kind: "confirm",
    phasePlayerId: args.phasePlayerId,
    validInstanceIds: [SWAN_WING_EFFECT_ID],
    optional: true,
  });
}

export function applySwanWing(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId): GameState {
  const enemyId = opponent(playerId);
  const targets = listSwanWingTargets(state, playerId);
  if (targets.length === 0) return state;
  const ids = new Set(targets.map((c) => c.instanceId));
  const enemy = state.players[enemyId];
  let nextEnemy = {
    ...enemy,
    command: enemy.command.filter((c) => !ids.has(c.instanceId)),
    rush: [
      ...enemy.rush,
      ...targets.map((c) => ({ ...c, commandHeld: undefined, faceDown: undefined })),
    ],
  };
  for (const c of targets) nextEnemy = markRushedThisTurn(nextEnemy, c.instanceId);
  let next: GameState = {
    ...state,
    ...updatePlayer(state, enemyId, nextEnemy),
    log: [
      ...state.log,
      buildLogEntry(playerId, "named_effect", "RS-284", state.definitions, `swan_wing:${targets.length}`),
    ],
  };
  for (const c of targets) {
    if (next.pendingEffectChoice || next.winner) break;
    const fx = applyOnRushUnitEffects(next, enemyId, c.instanceId, phasePlayerId, "rush", { viaEffect: true });
    next = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
  }
  return next;
}
