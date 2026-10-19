/**
 * RK-016 ミラーワールド（※常駐）「これに重ねたカードと同じカード名の自軍ユニットは、次の能力を得る⇒相手は自分自身のコマンドを1つ
 * ホールドしなければ、このユニットを選べない。…」（atwiki/page-176）を、効果の選択（pendingEffectChoice）全体に当てはめる。
 *
 * ユーザー決定 2026-10-19（docs/rules/README.md §5.7 q）: 相手がこのユニットを「選ぶ」効果はすべて、選ぶ側が自分自身のコマンドを
 * ホールドしなければ選べない。ホールドできなければ候補にならない。
 * - 候補: 選ぶプレイヤーのリリース状態のコマンドが、能力の数（同じカード名のカードを重ねた枚数。能力は重複する: grnrngr/faq-rider-1
 *   RK-016 Q3）より少なければ候補から外す（rules/pendingChoices.ts isValidEffectChoiceTarget → core/legalActions.ts）。
 * - 支払い: 選んだとき、その数だけ選ぶプレイヤーのリリース状態のコマンドをホールドする（core/applyAction.ts の resolve_effect_choice）。
 * - 元から自前で払っている RK-019 音撃・RS-288【ドラゴンハーレー】の選択は対象外（二重に払わない）。アタックのホールド
 *   （rules/rk/rk1NamedEffects.ts rk1DefenderBlocksAttack）はそのまま。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../types/game";

const MIRROR_WORLD_CARD_ID = "RK-016";

/** 自前でミラーワールドのホールドを払う選択（RK-019 音撃 rules/rk/rk1NamedEffects.ts・RS-288 rules/errataCardEffects.ts）。 */
const SELF_PAYING_EFFECT_IDS = new Set(["rk019_ongeki", "dragon_harley"]);

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

/** ownerId のユニット unit が持つミラーワールドの能力の数（重ねたカードのうち同じカード名の枚数）。 */
function mirrorWorldCount(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, unit: Pick<CardInstance, "cardId">): number {
  const operation = state.players[ownerId].operation;
  if (operation.length === 0) return 0;
  let copies = 0;
  let name: string | undefined;
  for (const op of operation) {
    if (!isSameCardIdentity(op.cardId, MIRROR_WORLD_CARD_ID)) continue;
    name ??= state.definitions[unit.cardId]?.name;
    if (!name) return 0;
    for (const st of op.stackedCards ?? []) {
      if (state.definitions[st.cardId]?.name === name) copies += 1;
    }
  }
  return copies;
}

/** 選ぶプレイヤー chooserId から見た相手の場のユニット instanceId を選ぶのに、ホールドしなければならないコマンドの数（0 なら制限なし）。 */
export function mirrorWorldSelectionCost(state: Pick<GameState, "players" | "definitions">, chooserId: PlayerId, instanceId: string): number {
  const ownerId = opponentOf(chooserId);
  const owner = state.players[ownerId];
  if (owner.operation.length === 0) return 0;
  const unit = owner.battle.find((c) => c.instanceId === instanceId) ?? owner.rush.find((c) => c.instanceId === instanceId);
  if (!unit || state.definitions[unit.cardId]?.type !== "unit") return 0;
  return mirrorWorldCount(state, ownerId, unit);
}

function releasedCommandCount(state: Pick<GameState, "players">, playerId: PlayerId): number {
  return state.players[playerId].command.filter((c) => !c.commandHeld).length;
}

/** この選択でミラーワールドの制限を見るか（自前で払う選択・すでに選んだもの（選び直し）は見ない）。 */
function appliesTo(pending: PendingEffectChoice, instanceId: string): boolean {
  if (SELF_PAYING_EFFECT_IDS.has(pending.effectId)) return false;
  return !(pending.selectedInstanceIds ?? []).includes(instanceId);
}

/** 候補: ミラーワールドの能力を持つ相手のユニットを、いま払えるか（払えなければ選べない）。 */
export function mirrorWorldChoiceAffordable(state: GameState, pending: PendingEffectChoice, instanceId: string): boolean {
  if (!appliesTo(pending, instanceId)) return true;
  const cost = mirrorWorldSelectionCost(state, pending.playerId, instanceId);
  return cost === 0 || releasedCommandCount(state, pending.playerId) >= cost;
}

/**
 * 選んだとき: 選ぶプレイヤーのリリース状態のコマンドを、能力の数だけ（並び順に）ホールドする。払えなければ null（選べない）。
 * 制限がなければ state をそのまま返す。
 */
export function payMirrorWorldSelection(state: GameState, chooserId: PlayerId, instanceId: string): GameState | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== chooserId || !appliesTo(pending, instanceId)) return state;
  if (!pending.validInstanceIds.includes(instanceId)) return state;
  const cost = mirrorWorldSelectionCost(state, chooserId, instanceId);
  if (cost === 0) return state;
  if (releasedCommandCount(state, chooserId) < cost) return null;
  let remaining = cost;
  const player = state.players[chooserId];
  const command = player.command.map((c) => {
    if (remaining === 0 || c.commandHeld) return c;
    remaining -= 1;
    return { ...c, commandHeld: true };
  });
  return { ...state, players: { ...state.players, [chooserId]: { ...player, command } } };
}
