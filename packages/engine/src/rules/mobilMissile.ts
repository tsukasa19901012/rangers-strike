/**
 * RS-196 ダイナモビル【迎撃モビルミサイル】（atwiki/page-398）:
 * 「これが自軍ラッシュエリアにある間、相手にストライクされたとき次の効果を発動できる⇒ストライクしてきたユニットの
 * サイズを見て、Lユニットなら4つ、Mユニットなら3つ、Sユニットなら2つ、ETの自軍コマンドをホールドする。
 * そうしたとき、敵軍のストライクは無効になる。」
 *
 * - ストライクの宣言直後に、ダイナモビルの持ち主が発動するかを選ぶ（任意。選ばなければストライクは通常どおり）。
 * - リリース状態の ET の自軍コマンドが必要な数に足りなければ発動できない。
 * - 必要な数のコマンドを1つずつ選び、選び終えたらホールドしてストライクを無効にする（ダメージ0）。
 */
import type { GameState, PendingEffectChoice, PendingStrike, PlayerId } from "../types/game";
import { cardCategories, getDefinition, isLargeUnit, isMediumUnit } from "../core/catalog";
import { findInZone, opponent, updatePlayer } from "../core/helpers";

export const MOBIL_MISSILE_EFFECT_ID = "geki_mobirumisairu";

function holdCountFor(state: GameState, pending: PendingStrike): number {
  const striker = findInZone(state.players[pending.strikerPlayerId], "battle", pending.strikerInstanceId);
  if (!striker) return 0;
  const cardId = striker.card.cardId;
  if (isLargeUnit(state.definitions, cardId)) return 4;
  if (isMediumUnit(state.definitions, cardId)) return 3;
  return 2;
}

function releasedEtCommandIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command
    .filter((c) => !c.commandHeld && cardCategories(getDefinition(state.definitions, c.cardId)).includes("ET"))
    .map((c) => c.instanceId);
}

/** ストライクされたとき、発動できるなら選択を開く（開かなければ null）。 */
export function openMobilMissileChoice(state: GameState, pending: PendingStrike): GameState | null {
  const defenderId = opponent(pending.strikerPlayerId);
  const source = state.players[defenderId].rush.find((c) => c.cardId === "RS-196");
  if (!source) return null;
  const need = holdCountFor(state, pending);
  if (need <= 0) return null;
  const valid = releasedEtCommandIds(state, defenderId);
  if (valid.length < need) return null;
  const choice: PendingEffectChoice = {
    playerId: defenderId,
    effectId: MOBIL_MISSILE_EFFECT_ID,
    sourceCardId: "RS-196",
    sourceInstanceId: source.instanceId,
    kind: "select_commands",
    phasePlayerId: pending.battlePhasePlayer,
    validInstanceIds: valid,
    selectCount: need,
    selectedInstanceIds: [],
    optional: true,
    mobilMissileStrike: pending,
  };
  return { ...state, pendingEffectChoice: choice, activePlayer: defenderId };
}

/**
 * コマンドを1つ選ぶ。必要な数に達したら、ホールドしてストライクを無効にした PendingStrike を返す（done）。
 */
export function selectMobilMissileCommand(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { error: string } | { state: GameState; done: false } | { state: GameState; done: true; strike: PendingStrike } {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== MOBIL_MISSILE_EFFECT_ID || !pending.mobilMissileStrike) {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (selected.length < (pending.selectCount ?? 1)) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } },
      done: false,
    };
  }
  const player = state.players[playerId];
  const command = player.command.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: true } : c));
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, { ...player, command }),
    pendingEffectChoice: undefined,
  };
  return { state: next, done: true, strike: { ...pending.mobilMissileStrike, damageCancelled: true } };
}
