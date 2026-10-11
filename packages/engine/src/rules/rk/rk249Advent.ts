/**
 * RK-249 アドベント
 * 「※常駐 自軍ラッシュフェイズごとに1度だけ、特徴「ミラーライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、
 *  選んだユニットは次の能力を得る⇒※コールWB（このユニットはWBのユニットをラッシュするためのコマンドとしてホールドできる）」
 *
 * 「⇒※コールWB」は選んだユニットが得る能力で、アドベント（オペレーション）自身の能力ではない。
 * 起動は activate_resident_operation（rules/permanentOperation.ts）。得たコールは rules/callLead.ts が読む。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../../types/game";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { updatePlayer } from "../../core/helpers";
import { getDefinition } from "../../core/catalog";
import { unitFeatures } from "../addedFeatures";
import { openEffectChoice } from "../pendingChoices";

export const ADVENT_CARD_ID = "RK-249";
export const ADVENT_EFFECT_ID = "rk249_advent";
const ADVENT_CALL_RULE = "rk249_advent_call_wb";

function mirrorRiderUnits(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return [...p.rush, ...p.battle]
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && unitFeatures(state, playerId, c).includes("ミラーライダー"))
    .map((c) => c.instanceId);
}

/** 起動できるか（自軍ラッシュフェイズ中、このラッシュフェイズでまだ使っておらず、選べるユニットがある）。 */
export function canActivateAdvent(state: GameState, playerId: PlayerId, op: CardInstance): boolean {
  if (op.cardId !== ADVENT_CARD_ID) return false;
  if (state.phase !== "rush") return false;
  return mirrorRiderUnits(state, playerId).length > 0;
}

/** 特徴「ミラーライダー」を持つ自軍ユニットを選ぶ（「選んでもよい」）。 */
export function beginAdvent(state: GameState, playerId: PlayerId, op: CardInstance): GameState {
  const ids = mirrorRiderUnits(state, playerId);
  if (ids.length === 0) return state;
  const choice: PendingEffectChoice = {
    playerId,
    effectId: ADVENT_EFFECT_ID,
    sourceCardId: ADVENT_CARD_ID,
    sourceInstanceId: op.instanceId,
    phasePlayerId: playerId,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  };
  return openEffectChoice(state, choice);
}

/** 選んだユニットは、このターン ※コールWB を得る。 */
export function resolveAdvent(state: GameState, pending: PendingEffectChoice, instanceId: string): GameState | null {
  if (!mirrorRiderUnits(state, pending.playerId).includes(instanceId)) return null;
  const player = state.players[pending.playerId];
  const next = addTurnRuleModifier(player, ADVENT_CALL_RULE, { sourceCardId: ADVENT_CARD_ID, payload: { instanceId } });
  return { ...state, ...updatePlayer(state, pending.playerId, next) };
}

/** アドベントで、このターン ※コールWB を得たユニットか（rules/callLead.ts から呼ぶ）。 */
export function adventGrantsCall(player: PlayerState, card: Pick<CardInstance, "instanceId">, kind: "call" | "lead", category: string): boolean {
  if (kind !== "call" || category !== "WB") return false;
  return getPlayerModifiers(player).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === ADVENT_CALL_RULE &&
      m.scope === "turn" &&
      (m.payload as { instanceId?: string } | undefined)?.instanceId === card.instanceId,
  );
}
