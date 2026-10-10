/**
 * RS-085【消火作業】・RS-088【解体作業】（ダメージになっているカードを扱う「～してもよい」効果）。
 *
 * - 消火作業: 自軍パワーゾーンのダメージ（ウラ向き）を1枚選んでオモテにしてもよい。そうしたとき、相手も同じようにしてもよい。
 *   自分の選択（skip で行わない）→ 行ったときだけ相手の選択（skip で行わない）。
 *   出典: atwiki/page-298、grnrngr/faq-card-2 RS-085 Q1（「そうしたとき」以降は条件ではない）。
 * - 解体作業: ダメージをウラ向きのまま1枚選んで手札に加えてもよい。そうしたとき、手札から1枚選んでパワーゾーンにウラ向きに置く。
 *   ウラ向きのまま選ぶので、どのダメージを加えるかに情報上の違いはない（先頭のダメージを加える）。
 *   手札から置くカードの選択（skip で行わない）にまとめる。加えたダメージのカード自身も選べる。
 *   出典: atwiki/page-301。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { opponent, updatePlayer } from "../../core/helpers";
import { openEffectChoice } from "../pendingChoices";

export const FIREFIGHTING_EFFECT_ID = "firefighting";
export const FIREFIGHTING_OPPONENT_EFFECT_ID = "firefighting_opponent";
export const DISMANTLING_EFFECT_ID = "dismantling";

function faceDownDamageIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
}

function openFlipChoice(
  state: GameState,
  playerId: PlayerId,
  effectId: string,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const targets = faceDownDamageIds(state, playerId);
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId,
    sourceCardId,
    kind: "select_power",
    phasePlayerId,
    validInstanceIds: targets,
    selectCount: 1,
    optional: true,
  });
}

/** 【消火作業】自分のダメージをオモテにするかの選択を開く（ダメージがなければ何もしない）。 */
export function startFirefighting(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState {
  return openFlipChoice(state, playerId, FIREFIGHTING_EFFECT_ID, sourceCardId, phasePlayerId) ?? state;
}

export function isFirefightingChoice(pending: PendingEffectChoice): boolean {
  return (
    pending.effectId === FIREFIGHTING_EFFECT_ID ||
    pending.effectId === FIREFIGHTING_OPPONENT_EFFECT_ID
  );
}

/**
 * 選んだダメージをオモテにする。自分の分のあとは相手に同じ選択を開く。
 * 戻り値の state に pendingEffectChoice があれば続きの選択。なければ解決済み（選択は呼び出し側で閉じる）。
 */
export function resolveFirefightingPick(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | null {
  const player = state.players[pending.playerId];
  const idx = player.power.findIndex((c) => c.instanceId === instanceId && c.faceDown);
  if (idx < 0) return null;
  const power = [...player.power];
  power[idx] = { ...power[idx]!, faceDown: false };
  const flipped: GameState = {
    ...state,
    ...updatePlayer(state, pending.playerId, { ...player, power }),
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
  };
  if (pending.effectId !== FIREFIGHTING_EFFECT_ID) return flipped;
  return (
    openFlipChoice(
      flipped,
      opponent(pending.playerId),
      FIREFIGHTING_OPPONENT_EFFECT_ID,
      pending.sourceCardId,
      pending.phasePlayerId,
    ) ?? flipped
  );
}

/** 【解体作業】ダメージがあれば、パワーゾーンに置く手札を選ぶ（行わないなら skip）選択を開く。 */
export function startDismantling(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState {
  const damage = faceDownDamageIds(state, playerId)[0];
  if (damage === undefined) return state;
  const handIds = state.players[playerId].hand.map((c) => c.instanceId);
  return openEffectChoice(state, {
    playerId,
    effectId: DISMANTLING_EFFECT_ID,
    sourceCardId,
    kind: "select_hand",
    phasePlayerId,
    validInstanceIds: [...handIds, damage],
    selectCount: 1,
    optional: true,
  });
}

/** ダメージを手札に加え、選んだ手札のカードをウラ向きでパワーゾーンに置く。 */
export function resolveDismantlingPick(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | null {
  const player = state.players[pending.playerId];
  const damageIdx = player.power.findIndex((c) => c.faceDown);
  if (damageIdx < 0) return null;
  const damage = player.power[damageIdx]!;
  if (instanceId === damage.instanceId) return state;
  const handIdx = player.hand.findIndex((c) => c.instanceId === instanceId);
  if (handIdx < 0) return null;
  const toPower = player.hand[handIdx]!;
  const power = [...player.power];
  power.splice(damageIdx, 1);
  const hand = player.hand.filter((_, i) => i !== handIdx);
  return {
    ...state,
    ...updatePlayer(state, pending.playerId, {
      ...player,
      power: [...power, { ...toPower, faceDown: true }],
      hand: [...hand, { ...damage, faceDown: false }],
    }),
  };
}
