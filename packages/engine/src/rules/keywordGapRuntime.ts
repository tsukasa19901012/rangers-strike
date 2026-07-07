/**
 * 監査で検出された「付与のみで未消費」キーワードのランタイム実装。
 *
 * 各キーワードの意味は wiki カードテキスト準拠（docs/wiki/cards/*.md）。
 */
import type { GameState, PlayerId } from "../types/game";
import { getDefinition, isSmallUnit } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { cardHasGrantKeyword, listCardGrantKeywords } from "../dsl/promotedKeywordBridge";
import { applyUnitLeave, openEffectChoice } from "./pendingChoices";
import { countLogicalBattleSlots } from "./battleLine";
import { buildLogEntry } from "../log/formatLog";
import { bounceToHand } from "./bounce";

/**
 * ターン終了時のキーワード効果:
 * - discard_on_end_turn_battle: バトルエリアにあれば捨札（XG2-087 / XG6-048）
 * - self_destroy_low_damage_remaining: 残りライフ3点以下なら自壊（RS-289 / XP-023）
 * - end_turn_return_hand_wrong_number: バトルの並び順が本来のナンバーと違えば手札へ（RS-280〜284）
 */
export function applyKeywordTurnEndEffects(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  let nextState = state;
  const logs: string[] = [];
  const player = () => nextState.players[endingPlayerId];

  // discard_on_end_turn_battle
  for (const card of [...player().battle]) {
    if (!cardHasGrantKeyword(card.cardId, "discard_on_end_turn_battle")) continue;
    const left = applyUnitLeave(nextState, card.instanceId, "discard", endingPlayerId);
    if (!("error" in left)) {
      nextState = left.state;
      logs.push(
        buildLogEntry(endingPlayerId, "named_effect", card.cardId, state.definitions, "ターン終了時に捨札"),
      );
    }
  }

  // self_destroy_low_damage_remaining（負けるまで残り3点以下 = ダメージ4点以上）
  if (player().damage >= 4) {
    for (const zone of ["battle", "rush"] as const) {
      for (const card of [...player()[zone]]) {
        if (!cardHasGrantKeyword(card.cardId, "self_destroy_low_damage_remaining")) continue;
        const left = applyUnitLeave(nextState, card.instanceId, "discard", endingPlayerId);
        if (!("error" in left)) {
          nextState = left.state;
          logs.push(
            buildLogEntry(endingPlayerId, "named_effect", card.cardId, state.definitions, "残りライフ3点以下のため撃破"),
          );
        }
      }
    }
  }

  // end_turn_return_hand_wrong_number
  for (const card of [...player().battle]) {
    if (!cardHasGrantKeyword(card.cardId, "end_turn_return_hand_wrong_number")) continue;
    const def = getDefinition(nextState.definitions, card.cardId);
    const printed = typeof def?.comboNumber === "number" ? def.comboNumber : null;
    if (printed === null) continue;
    const battle = player().battle;
    const index = battle.findIndex((c) => c.instanceId === card.instanceId);
    if (index < 0) continue;
    const position = countLogicalBattleSlots(battle.slice(0, index)) + 1;
    if (position === printed) continue;
    const bounced = bounceToHand(nextState, {
      playerId: endingPlayerId,
      instanceId: card.instanceId,
      fromZone: "battle",
    });
    if (bounced.bounced) {
      nextState = bounced.state;
      logs.push(
        buildLogEntry(endingPlayerId, "named_effect", card.cardId, state.definitions, "並び順がナンバーと違うため手札へ"),
      );
    }
  }

  return { state: nextState, logs };
}

/**
 * damage_gate_battle_entry（RS-289 / XP-023）:
 * 「ダメージを受けた敵軍ターンの次の自軍ターンにしかバトルエリアに出られない」
 * PlayerState.damagedOnEnemyTurn フラグは被ダメージ時に立て、自軍ターン終了時に消す。
 */
export function damageGateBlocksEntry(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!cardHasGrantKeyword(cardId, "damage_gate_battle_entry")) return false;
  return !state.players[playerId].damagedOnEnemyTurn;
}

export function markEnemyTurnDamage(
  state: GameState,
  damagedPlayerId: PlayerId,
): GameState {
  if (state.activePlayer === damagedPlayerId) return state;
  const player = state.players[damagedPlayerId];
  if (player.damagedOnEnemyTurn) return state;
  return {
    ...state,
    ...updatePlayer(state, damagedPlayerId, { ...player, damagedOnEnemyTurn: true }),
  };
}

export function clearEnemyTurnDamageFlag(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const player = state.players[endingPlayerId];
  if (!player.damagedOnEnemyTurn) return state;
  return {
    ...state,
    ...updatePlayer(state, endingPlayerId, { ...player, damagedOnEnemyTurn: undefined }),
  };
}

/** attack_held_rush_units / attack_rush_if_more_units: 敵軍ラッシュへのアタック許可。 */
export function keywordAllowsAttackIntoRush(
  state: GameState,
  attackerCardId: string,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const enemy = state.players[defenderPlayerId];
  const defender = enemy.rush.find((c) => c.instanceId === defenderInstanceId);
  if (!defender) return false;

  if (
    cardHasGrantKeyword(attackerCardId, "attack_held_rush_units") &&
    defender.commandHeld
  ) {
    return true;
  }
  if (
    cardHasGrantKeyword(attackerCardId, "attack_rush_if_more_units") &&
    enemy.rush.length > enemy.battle.length
  ) {
    return true;
  }
  return false;
}

/** XG2-008: これがアタックするとき「アタックされたとき発動できる」カウンターを封じる。 */
export function attackerSuppressesAttackedCounters(attackerCardId: string): boolean {
  return cardHasGrantKeyword(attackerCardId, "cannot_named_counter_on_attack");
}

/** rush_from_discard_count_command / _power: コマンド/パワーからの自己ラッシュ条件。 */
export function canSelfRushFromZone(
  state: GameState,
  playerId: PlayerId,
  zone: "command" | "power",
  instanceId: string,
): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  const player = state.players[playerId];
  const card = player[zone].find((c) => c.instanceId === instanceId);
  if (!card) return false;
  if (zone === "power" && card.faceDown) return false;
  if (zone === "command" && card.commandHeld) return false;
  const keyword =
    zone === "command" ? "rush_from_discard_count_command" : "rush_from_discard_count_power";
  if (!cardHasGrantKeyword(card.cardId, keyword)) return false;
  const def = getDefinition(state.definitions, card.cardId);
  const cost = typeof def?.powerCost === "number" ? def.powerCost : parseInt(String(def?.powerCost), 10);
  if (!Number.isFinite(cost)) return false;
  return player.discard.length >= cost;
}

/** 上記条件を満たす自己ラッシュの実行。 */
export function applySelfRushFromZone(
  state: GameState,
  playerId: PlayerId,
  zone: "command" | "power",
  instanceId: string,
): GameState | null {
  if (!canSelfRushFromZone(state, playerId, zone, instanceId)) return null;
  const player = state.players[playerId];
  const card = player[zone].find((c) => c.instanceId === instanceId);
  if (!card) return null;
  const { faceDown: _fd, commandHeld: _ch, ...clean } = card;
  const nextPlayer = {
    ...player,
    [zone]: player[zone].filter((c) => c.instanceId !== instanceId),
    rush: [...player.rush, { ...clean, rushedThisTurn: true }],
  };
  return { ...state, ...updatePlayer(state, playerId, nextPlayer) };
}


/* --- attack_and_strike_once（PR-013 / RS-236 / XG5-063） --- */

import type { PlayerState } from "../types/game";

/**
 * battleActed 済みでも「アタックとストライクを1度ずつ」持ちなら
 * まだ行っていない側の行動を許可する。
 */
export function battleActBlocked(
  player: PlayerState,
  card: { cardId: string; instanceId: string; battleActed?: boolean },
  action: "attack" | "strike",
): boolean {
  if (!card.battleActed) return false;
  if (!cardHasGrantKeyword(card.cardId, "attack_and_strike_once")) return true;
  const rec = player.unitActionsThisTurn?.[card.instanceId];
  return action === "attack" ? !!rec?.attacked : !!rec?.struck;
}

export function markUnitBattleAction(
  player: PlayerState,
  instanceId: string,
  action: "attack" | "strike",
): PlayerState {
  const prev = player.unitActionsThisTurn ?? {};
  return {
    ...player,
    unitActionsThisTurn: {
      ...prev,
      [instanceId]: { ...prev[instanceId], [action === "attack" ? "attacked" : "struck"]: true },
    },
  };
}

/**
 * alias_* / chase_or_ridden_*_alias キーワードは「〜としてつかえる」テキストを
 * fusionMaterialAliasNames / 各名寄せ経路（ゾード素材・キャストオフ）で解釈済み。
 * ここでの認識は監査（audit-hollow-keywords）用のマーカー。
 */
export function isAliasKeyword(keyword: string): boolean {
  return (
    /^alias_/.test(keyword) ||
    /^dual_name_alias::/.test(keyword) ||
    /^chase_or_ridden_[sl]_vehicle_alias$/.test(keyword)
  );
}

/* --- turn_start_swap_hand_named（XG4-049/050/051） --- */

/**
 * 自軍ターン開始時: 手札の指定名カードとフィールドのこれを置き換えてもよい。
 * release_start_commands 適用時に選択を開く。
 */
export function beginTurnStartSwaps(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      const keyword = listCardGrantKeywords(card.cardId).find((k) =>
        k.startsWith("turn_start_swap_hand_named::"),
      );
      if (!keyword) continue;
      const names = keyword.split("::")[1]?.split("_") ?? [];
      const handTargets = player.hand.filter((h) => {
        const def = getDefinition(state.definitions, h.cardId);
        return names.some((n) => (def?.name ?? "").includes(n));
      });
      if (handTargets.length === 0) continue;
      const opened = openEffectChoice(state, {
        playerId,
        effectId: "turn_start_swap_hand_named",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        kind: "select_hand",
        validInstanceIds: handTargets.map((h) => h.instanceId),
        selectCount: 1,
        optional: true,
      });
      if (opened) return opened;
    }
  }
  return state;
}

export function resolveTurnStartSwap(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  handInstanceId: string,
): GameState | null {
  const player = state.players[pending.playerId];
  const handCard = player.hand.find((c) => c.instanceId === handInstanceId);
  const fieldId = pending.sourceInstanceId;
  if (!handCard || !fieldId) return null;
  const zone = player.rush.some((c) => c.instanceId === fieldId)
    ? "rush"
    : player.battle.some((c) => c.instanceId === fieldId)
      ? "battle"
      : null;
  if (!zone) return null;
  const fieldCard = player[zone].find((c) => c.instanceId === fieldId)!;
  const { commandHeld: _ch, battleActed: _ba, mountedOnInstanceId: _m, stackedCards: stacked, ...fieldClean } = fieldCard;
  const nextPlayer = {
    ...player,
    hand: [...player.hand.filter((c) => c.instanceId !== handInstanceId), fieldClean],
    [zone]: [
      ...player[zone].filter((c) => c.instanceId !== fieldId),
      { ...handCard, ...(stacked ? { stackedCards: stacked } : {}) },
    ],
  };
  return { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
}

