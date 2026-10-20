/**
 * RS-215 皇帝バッカスフンド【不滅のマシン帝国】:
 * これが自軍エリアにある間、特徴「メカ」を持つ自軍ユニットがアタックされたとき、自分の手札からカードを2枚選び、
 * 捨札にしてもよい。そうしたとき、バトルは行われない。
 *
 * アタック宣言後（カウンター窓の前）に、アタックされたプレイヤーへ手札2枚の選択（任意）を開く。
 * 2枚捨札にしたらバトルは行われない（アタックは消費される）。断ったらアタックの処理をそのまま続ける。
 */
import { getDefinition } from "../core/catalog";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import type { GameState, PendingBattle, PlayerId } from "../types/game";
import { playerHasFieldCard } from "./rs/rsCatchallChoices";
import { unitFeatures } from "./addedFeatures";
import { buildLogEntry } from "../log/formatLog";

export const MACHINE_EMPIRE_EFFECT_ID = "nomashin_discard_hand";
const MACHINE_EMPIRE_CARD_ID = "RS-215";
const DISCARD_COUNT = 2;

function defenderIsMecha(state: GameState, battle: PendingBattle): boolean {
  const owner = state.players[battle.defenderPlayerId];
  const found =
    findInZone(owner, "battle", battle.defenderInstanceId) ??
    findInZone(owner, "rush", battle.defenderInstanceId);
  if (!found) return false;
  const def = getDefinition(state.definitions, found.card.cardId);
  return def?.type === "unit" && (def.features ?? []).includes("メカ");
}

/** 【不滅のマシン帝国】の選択を開く。使えないなら null。 */
export function openMachineEmpireChoice(
  state: GameState,
  battle: PendingBattle,
  wingAttackFromRush: boolean,
): GameState | null {
  if (battle.machineEmpireOffered || battle.battleCancelled) return null;
  const defenderId = battle.defenderPlayerId;
  if (!playerHasFieldCard(state, defenderId, MACHINE_EMPIRE_CARD_ID)) return null;
  if (!defenderIsMecha(state, battle)) return null;
  const hand = state.players[defenderId].hand;
  if (hand.length < DISCARD_COUNT) return null;
  const source = [...state.players[defenderId].battle, ...state.players[defenderId].rush].find(
    (c) => c.cardId === MACHINE_EMPIRE_CARD_ID,
  );
  return {
    ...state,
    pendingEffectChoice: {
      playerId: defenderId,
      effectId: MACHINE_EMPIRE_EFFECT_ID,
      sourceCardId: MACHINE_EMPIRE_CARD_ID,
      sourceInstanceId: source?.instanceId,
      kind: "select_hand",
      phasePlayerId: battle.phasePlayerId,
      validInstanceIds: hand.map((c) => c.instanceId),
      selectedInstanceIds: [],
      selectCount: DISCARD_COUNT,
      optional: true,
      machineEmpireMeta: { battle: { ...battle, machineEmpireOffered: true }, wingAttackFromRush },
    },
    activePlayer: defenderId,
  };
}

/**
 * 手札を1枚選ぶ。2枚そろったら捨札にして、バトルを行わないアタックとして続ける（done）。
 */
export function resolveMachineEmpirePick(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
):
  | { error: string }
  | { state: GameState; done: false }
  | { state: GameState; done: true; battle: PendingBattle; wingAttackFromRush: boolean } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.machineEmpireMeta;
  if (!pending || !meta) return { error: "invalid_target" };
  if (pending.playerId !== playerId) return { error: "not_your_choice" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < DISCARD_COUNT) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          selectedInstanceIds: selected,
          validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)),
        },
      },
      done: false,
    };
  }
  let player = state.players[playerId];
  for (const id of selected) {
    const found = findInZone(player, "hand", id);
    if (!found) return { error: "invalid_target" };
    const [, hand] = removeAt(player.hand, found.index);
    player = { ...player, hand, discard: [...player.discard, found.card] };
  }
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, player),
    pendingEffectChoice: undefined,
    activePlayer: meta.battle.phasePlayerId,
    log: [...state.log, `${playerId}|named_effect|${MACHINE_EMPIRE_CARD_ID}|皇帝バッカスフンド|nomashin`],
  };
  return {
    state: next,
    done: true,
    battle: { ...meta.battle, battleCancelled: true },
    wingAttackFromRush: meta.wingAttackFromRush,
  };
}

/** 断ったとき: 選択を閉じ、アタックの処理を続ける。 */
export function skipMachineEmpireChoice(
  state: GameState,
  playerId: PlayerId,
): { error: string } | { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.machineEmpireMeta;
  if (!pending || !meta) return { error: "invalid_target" };
  if (pending.playerId !== playerId) return { error: "not_your_choice" };
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId },
    battle: meta.battle,
    wingAttackFromRush: meta.wingAttackFromRush,
  };
}

// ---------------------------------------------------------------------------
// RS-414 冥府神ティターン【ディオネを守る壁】
// 「これが自軍バトルエリアにある間、特徴「冥府神」を持つ自軍ユニットがアタックされたとき、自軍常駐置き場からカードを1枚選び、
//  捨札にしてもよい。そうしたとき、バトルは行われない。」
// 【不滅のマシン帝国】と同じく、アタック宣言後（カウンター窓の前）にアタックされたプレイヤーへ選択（任意）を開く。

export const DIONE_WALL_EFFECT_ID = "rs414_dione_wall";
const DIONE_WALL_CARD_ID = "RS-414";

function defenderHasFeature(state: GameState, battle: PendingBattle, feature: string): boolean {
  const owner = state.players[battle.defenderPlayerId];
  const found =
    findInZone(owner, "battle", battle.defenderInstanceId) ??
    findInZone(owner, "rush", battle.defenderInstanceId);
  if (!found) return false;
  return unitFeatures(state, battle.defenderPlayerId, found.card).includes(feature);
}

/** 【ディオネを守る壁】の選択を開く。使えないなら null。 */
export function openDioneWallChoice(
  state: GameState,
  battle: PendingBattle,
  wingAttackFromRush: boolean,
): GameState | null {
  if (battle.dioneWallOffered || battle.battleCancelled) return null;
  const defenderId = battle.defenderPlayerId;
  const titan = state.players[defenderId].battle.find((c) => c.cardId === DIONE_WALL_CARD_ID);
  if (!titan) return null;
  if (!defenderHasFeature(state, battle, "冥府神")) return null;
  const ops = state.players[defenderId].operation;
  if (ops.length === 0) return null;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: defenderId,
      effectId: DIONE_WALL_EFFECT_ID,
      sourceCardId: DIONE_WALL_CARD_ID,
      sourceInstanceId: titan.instanceId,
      kind: "select_unit",
      phasePlayerId: battle.phasePlayerId,
      validInstanceIds: ops.map((c) => c.instanceId),
      selectedInstanceIds: [],
      selectCount: 1,
      optional: true,
      machineEmpireMeta: { battle: { ...battle, dioneWallOffered: true }, wingAttackFromRush },
    },
    activePlayer: defenderId,
  };
}

/** 常駐を1枚選んで捨札にし、バトルを行わないアタックとして続ける。 */
export function resolveDioneWallPick(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { error: string } | { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.machineEmpireMeta;
  if (!pending || !meta || pending.effectId !== DIONE_WALL_EFFECT_ID) return { error: "invalid_target" };
  if (pending.playerId !== playerId) return { error: "not_your_choice" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const found = findInZone(player, "operation", instanceId);
  if (!found) return { error: "invalid_target" };
  const [, operation] = removeAt(player.operation, found.index);
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      operation,
      discard: [...player.discard, { instanceId: found.card.instanceId, cardId: found.card.cardId }],
    }),
    pendingEffectChoice: undefined,
    activePlayer: meta.battle.phasePlayerId,
    log: [...state.log, buildLogEntry(playerId, "named_effect", DIONE_WALL_CARD_ID, state.definitions, "dione_wall")],
  };
  return { state: next, battle: { ...meta.battle, battleCancelled: true }, wingAttackFromRush: meta.wingAttackFromRush };
}
