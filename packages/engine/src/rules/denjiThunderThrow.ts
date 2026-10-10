/**
 * RS-358 デンジピンク【デンジサンダー投げ】（NC）: 相手は自分自身のラッシュエリアからSユニットを1体選び、
 * 可能ならバトルエリアに出す。
 *
 * 出るために「自軍ラッシュエリアのSユニットを1体捨札にしなければ出られない」ユニット（RS-242 創造王リュウオーン等）を
 * 選んだときは、ほかの S ユニットを捨札にできるなら1体捨札にして出す。できなければラッシュエリアに留まる
 * （faq-card-4 RS-242 Q2）。
 */
import { getDefinition } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import type { GameState, PlayerId } from "../types/game";
import { needsBattleEntryRushDiscard } from "./legend3/restrictions";
import { autoHoldForBattleEntry, canMoveUnitToBattle, clearEffectBattleEntryWindows } from "./restrictions";

export const DENJI_THUNDER_THROW_EFFECT_ID = "denjisandage";
export const DENJI_THUNDER_THROW_DISCARD_EFFECT_ID = "denjisandage_entry_discard";

function rushSIds(state: GameState, playerId: PlayerId, exclude?: string): string[] {
  return state.players[playerId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.size === "S" && c.instanceId !== exclude)
    .map((c) => c.instanceId);
}

/** NC 成立時: 相手に自分のラッシュエリアの S ユニットを1体選ばせる。 */
export function startDenjiThunderThrow(state: GameState, playerId: PlayerId, sourceInstanceId: string): GameState {
  if (state.pendingEffectChoice) return state;
  const enemyId = opponent(playerId);
  const valid = rushSIds(state, enemyId);
  if (valid.length === 0) return state;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: enemyId,
      effectId: DENJI_THUNDER_THROW_EFFECT_ID,
      sourceCardId: "RS-358",
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
    },
    activePlayer: enemyId,
  };
}

/** ラッシュエリアのユニットを（効果で）バトルエリアに出す。出られなければ null。 */
function putIntoBattle(state: GameState, ownerId: PlayerId, instanceId: string): GameState | null {
  const owner = state.players[ownerId];
  const found = findInZone(owner, "rush", instanceId);
  if (!found) return null;
  const ready = autoHoldForBattleEntry(state, ownerId, found.card);
  if (!ready) return null;
  const readyState = { ...state, ...updatePlayer(state, ownerId, ready) };
  if (!canMoveUnitToBattle(readyState, ownerId, found.card, "rush")) return null;
  const index = ready.rush.findIndex((c) => c.instanceId === instanceId);
  const [, rush] = removeAt(ready.rush, index);
  const nextOwner = clearEffectBattleEntryWindows({
    ...ready,
    rush,
    battle: [...ready.battle, { ...found.card, battleActed: false }],
  });
  return { ...readyState, ...updatePlayer(readyState, ownerId, nextOwner) };
}

/**
 * 選ばれた S ユニットを可能ならバトルエリアに出す。捨札にする S ユニットの選択が要るなら、その選択を開いた状態を返す。
 * 何も起こらない（出られない）ときは元の状態を返す。
 */
export function resolveDenjiThunderThrowPick(state: GameState, instanceId: string): GameState | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== DENJI_THUNDER_THROW_EFFECT_ID) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return null;
  const ownerId = pending.playerId;
  const found = findInZone(state.players[ownerId], "rush", instanceId);
  if (!found) return null;
  if (needsBattleEntryRushDiscard(found.card.cardId)) {
    const targets = rushSIds(state, ownerId, instanceId);
    if (targets.length === 0) return state;
    return {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: DENJI_THUNDER_THROW_DISCARD_EFFECT_ID,
        validInstanceIds: targets,
        selectedInstanceIds: [],
        processedInstanceIds: [instanceId],
        optional: false,
      },
    };
  }
  return putIntoBattle(state, ownerId, instanceId) ?? state;
}

/** 捨札にする S ユニットを選んだ: 捨札にしてから、選ばれていたユニットをバトルエリアに出す。 */
export function resolveDenjiThunderThrowDiscard(state: GameState, instanceId: string): GameState | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== DENJI_THUNDER_THROW_DISCARD_EFFECT_ID) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return null;
  const ownerId = pending.playerId;
  const enteringId = pending.processedInstanceIds?.[0];
  const owner = state.players[ownerId];
  const found = findInZone(owner, "rush", instanceId);
  if (!found || !enteringId) return null;
  const [, rush] = removeAt(owner.rush, found.index);
  const discarded: GameState = {
    ...state,
    ...updatePlayer(state, ownerId, { ...owner, rush, discard: [...owner.discard, found.card] }),
  };
  const entering = findInZone(discarded.players[ownerId], "rush", enteringId);
  if (!entering) return discarded;
  // 捨札にする条件は満たしたので、ホールド等の残りの条件だけ確認して出す。
  const ready = autoHoldForBattleEntry(discarded, ownerId, entering.card);
  if (!ready) return discarded;
  const index = ready.rush.findIndex((c) => c.instanceId === enteringId);
  const [, rest] = removeAt(ready.rush, index);
  const nextOwner = clearEffectBattleEntryWindows({
    ...ready,
    rush: rest,
    battle: [...ready.battle, { ...entering.card, battleActed: false }],
  });
  return { ...discarded, ...updatePlayer(discarded, ownerId, nextOwner) };
}
