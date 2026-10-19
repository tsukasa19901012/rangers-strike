import { xg6BlocksAttack, xg6DefenderBlocksAttack } from "../xg6/xg6Fields";
import { set6LowDefenderBlocksAttack } from "../legend1/set6NamedEffects348";
import { rk5AttackerCanAttackRush } from "../rk/rk5Fields";
import { rk11AttackerCanAttackRush, rk11EntryDiscardFeature } from "../rk/rk11Fields";
import { rk10UnitHasResist } from "../rk/rk10Fields";
import { rk6SnakeBlocksSelection } from "../rk/rk6Fields";
import { set9AAttackerCanAttackRush, set9ADefenderBlocksAttack } from "../legend1/set9NamedEffectsA";
import { set7DDefenderBlocksAttack } from "../legend1/set7NamedEffectsD";
import { set8ADefenderBlocksAttack } from "../legend1/set8NamedEffectsA";
import { set8DDefenderBlocksAttack } from "../legend1/set8NamedEffectsD";
import { rk1DefenderBlocksAttack } from "../rk/rk1NamedEffects";
import { rk2DefenderBlocksAttack, rk2KamenRiderRushDiscardable, rk2NeedsKamenRiderRushDiscard } from "../rk/rk2UnitEffects";
import { set9DAllowsRushAttack } from "../legend1/set9NamedEffectsD";
import { set8CAllowsRushAttack, set8CDefenderBlocksAttack } from "../legend1/set8NamedEffectsC";
import { set8BDefenderBlocksAttack } from "../legend1/set8NamedEffectsB";
import { chikaraBatonAllowsAttack, lionBlastAllowsRushAttack } from "../legend1/set4NamedEffects";
import { set5ADefenderBlocksAttack } from "../legend1/set5NamedEffectsA";
import { kibaGakureBlocksAttack, magiMergeAllowsRushAttack } from "../legend1/set5NamedEffects";
import {
  getBattleEntryHandDiscardCount,
  hasUnnamedRule,
  needsBattleEntryHandDiscard,
} from "@rangers-strike/cards";
import { elephantShieldMustTarget } from "./fieldEffects";
import { activeNamedEffect } from "../ncGatedEffects";
import { unitFeatures } from "../addedFeatures";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { isCostWindowSatisfied } from "../../core/costWindow";
import {
  cardCategories,
  getDefinition,
  isSmallUnit,
  isVehicle,
  parsePowerCost,
} from "../../core/catalog";
import {
  cardHasGrantKeyword,
  promotedAttackerCannotTarget,
  promotedDefenderBlocksAttack,
} from "../../dsl/promotedKeywordBridge";
import { scrumBlocksAttack } from "../../keywords";
import { canWingAttackFromRush } from "../../keywords/battleKeywords";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { countAvailablePower, effectivePowerCost } from "../../core/power";
import { findInZone, opponent } from "../../core/helpers";
import { countReleasedCommands } from "../restrictions";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { getBattleEntryPowerDiscardCount } from "../batch07FieldEffects";
import {
  canEffectPutRushUnitIntoBattle,
  collectFieldUnitIds,
  startSelectUnitChoice,
} from "../pendingChoices";
import { keywordAllowsAttackIntoRush } from "../keywordGapRuntime";
import { rk13AttackerCanAttackRush, rk13DefenderBlocksAttack } from "../rk/rk13Fields";
import { rk15DefenderBlocksAttack } from "../rk/rk15Fields";
import { rk16DefenderBlocksAttack } from "../rk/rk16Fields";

export function hasDarkDealInRush(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].rush.some(
    (c) => activeNamedEffect(c, "dark_deal"),
  );
}

export function darkDealRushPowerBudget(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
): number {
  let budget = countAvailablePower(state, playerId);
  const cost = effectivePowerCost(state, playerId, parsePowerCost(unitDefinition.powerCost));
  if (budget >= cost) return budget;
  if (!hasDarkDealInRush(state, playerId)) return budget;
  const cats = cardCategories(unitDefinition);
  if (!cats.includes("DA")) return budget;
  return budget + countReleasedCommands(player);
}

export function applyDarkDealRushHolds(
  player: PlayerState,
  shortage: number,
): PlayerState | null {
  if (shortage <= 0) return player;
  let remaining = shortage;
  const command = [...player.command];
  for (let i = 0; i < command.length && remaining > 0; i++) {
    const card = command[i]!;
    if (card.commandHeld) continue;
    command[i] = { ...card, commandHeld: true, mothershipHold: false };
    remaining -= 1;
  }
  if (remaining > 0) return null;
  return { ...player, command };
}

export function needsBattleEntryRushDiscard(cardId: string): boolean {
  return (
    hasUnnamedRule(cardId, "battle_entry_discard_s_from_rush") ||
    // RS-242 / RS-416: ※自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない
    cardHasGrantKeyword(cardId, "require_discard_rush_s_entry") ||
    // RK-032 アナザーアギト: ※自軍ラッシュエリアの特徴「仮面ライダー」を持つユニットを1体捨札にしなければバトルエリアに出られない
    rk2NeedsKamenRiderRushDiscard(cardId) ||
    // RK-220 アルビノジョーカー: ※自軍ラッシュエリアの特徴「アンデッド」を持つユニットを1体捨札にしなければバトルエリアに出られない
    rk11EntryDiscardFeature(cardId) !== undefined
  );
}

/** 進入するユニット（enteringCardId）の※で捨札にできる自軍ラッシュエリアのユニットか。 */
function isBattleEntryRushDiscardable(
  definitions: GameState["definitions"],
  cardId: string,
  enteringCardId: string | undefined,
): boolean {
  // RK-032: 「特徴「仮面ライダー」を持つユニット」（サイズを問わない。rules/rk/rk2UnitEffects.ts）。
  if (enteringCardId && rk2NeedsKamenRiderRushDiscard(enteringCardId)) {
    return rk2KamenRiderRushDiscardable(definitions, cardId);
  }
  // RK-220: 「特徴「アンデッド」を持つユニット」（サイズを問わない。rules/rk/rk11Fields.ts）。
  const feature = enteringCardId ? rk11EntryDiscardFeature(enteringCardId) : undefined;
  if (feature) {
    const def = getDefinition(definitions, cardId);
    return def?.type === "unit" && (def.features ?? []).includes(feature);
  }
  return isSmallUnit(definitions, cardId);
}

export function canPayBattleEntryRushDiscard(
  player: PlayerState,
  definitions: GameState["definitions"],
  enteringCardId?: string,
): boolean {
  return player.rush.some((c) => isBattleEntryRushDiscardable(definitions, c.cardId, enteringCardId));
}

/** 戦闘進入時に捨てる別の自軍S（進入ユニット自身は不可）。 */
export function hasBattleEntryRushDiscardTarget(
  player: PlayerState,
  definitions: GameState["definitions"],
  enteringInstanceId: string,
): boolean {
  const enteringCardId = player.rush.find((c) => c.instanceId === enteringInstanceId)?.cardId;
  return player.rush.some(
    (c) => isBattleEntryRushDiscardable(definitions, c.cardId, enteringCardId) && c.instanceId !== enteringInstanceId,
  );
}

export function battleEntryRushDiscardSatisfied(player: PlayerState, cardId: string): boolean {
  if (!needsBattleEntryRushDiscard(cardId)) return true;
  return isCostWindowSatisfied(player, "battle_entry_rush_discard");
}

export function canPayBattleEntryHandDiscard(
  player: PlayerState,
  cardId: string,
): boolean {
  const count = getBattleEntryHandDiscardCount(cardId);
  return count <= 0 || player.hand.length >= count;
}

export function battleEntryHandDiscardSatisfied(
  player: PlayerState,
  cardId: string,
): boolean {
  if (!needsBattleEntryHandDiscard(cardId)) return true;
  return isCostWindowSatisfied(player, "battle_entry_hand_discard");
}

export function needsBattleEntryPowerDiscard(cardId: string): boolean {
  return getBattleEntryPowerDiscardCount(cardId) > 0;
}

export function canPayBattleEntryPowerDiscard(
  player: PlayerState,
  cardId: string,
): boolean {
  const count = getBattleEntryPowerDiscardCount(cardId);
  if (count <= 0) return true;
  const nonDamage = player.power.filter((c) => !c.faceDown).length;
  return nonDamage >= count;
}

export function battleEntryPowerDiscardSatisfied(
  player: PlayerState,
  cardId: string,
): boolean {
  if (!needsBattleEntryPowerDiscard(cardId)) return true;
  return isCostWindowSatisfied(player, "battle_entry_power_discard");
}

export function tryStartBattleEntryPowerDiscard(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState | null {
  const count = getBattleEntryPowerDiscardCount(entering.cardId);
  if (count <= 0) return null;
  const player = state.players[playerId];
  const valid = player.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (valid.length < count) return null;

  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: "battle_entry_power_discard",
      sourceCardId: entering.cardId,
      sourceInstanceId: entering.instanceId,
      kind: "select_power",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: count,
      optional: false,
    },
    activePlayer: playerId,
  };
}

export function tryStartBattleEntryHandDiscard(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState | null {
  const count = getBattleEntryHandDiscardCount(entering.cardId);
  if (count <= 0) return null;
  const player = state.players[playerId];
  const valid = player.hand.map((c) => c.instanceId);
  if (valid.length < count) return null;

  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: "battle_entry_hand_discard",
      sourceCardId: entering.cardId,
      sourceInstanceId: entering.instanceId,
      kind: "select_hand",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: count,
      optional: false,
    },
    activePlayer: playerId,
  };
}

export function tryStartBattleEntryRushDiscard(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState | null {
  const player = state.players[playerId];
  // 捨札にするのは出るユニット以外の自軍 S ユニット（RS-242 ※「自軍ラッシュエリアのSユニットを1体」）。
  const targets = player.rush
    .filter((c) => isBattleEntryRushDiscardable(state.definitions, c.cardId, entering.cardId) && c.instanceId !== entering.instanceId)
    .map((c) => c.instanceId);
  if (targets.length === 0) return null;

  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: "battle_entry_discard",
      sourceCardId: entering.cardId,
      sourceInstanceId: entering.instanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: targets,
      unitDestination: "discard",
      optional: false,
      selectCount: 1,
    },
    activePlayer: playerId,
  };
}

export function canAttackEnemyRushS(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  const attacker = findInZone(
    state.players[attackerPlayerId],
    "battle",
    attackerInstanceId,
  );
  if (!attacker) return false;
  return hasUnnamedRule(attacker.card.cardId, "can_attack_enemy_rush_s");
}

export function cannotAttackEnemyBattleS(attackerCardId: string): boolean {
  return hasUnnamedRule(attackerCardId, "cannot_attack_enemy_battle_s");
}

export function defenderRequiresAircraftAttacker(defenderCardId: string): boolean {
  return hasUnnamedRule(defenderCardId, "requires_aircraft_attacker");
}

export function attackerHasAircraftFeature(
  definitions: GameState["definitions"],
  attackerCardId: string,
): boolean {
  return (getDefinition(definitions, attackerCardId)?.features ?? []).includes("航空機");
}

/** Returns true if a note_other_* nc restriction blocks this attacker→defender pairing. */
function noteOtherNcAttackRestriction(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerCard: CardInstance,
  defenderPlayerId: PlayerId,
  defenderCard: CardInstance,
): boolean {
  const atkId = attackerCard.cardId;
  const defId = defenderCard.cardId;
  const atkDef = getDefinition(state.definitions, atkId);
  const defDef = getDefinition(state.definitions, defId);
  const atkFeatures = atkDef?.features ?? [];
  const defFeatures = defDef?.features ?? [];
  const atkPlayer = state.players[attackerPlayerId];
  const defPlayer = state.players[defenderPlayerId];

  // RK-067: can't attack 男/女 units without own 女 in discard
  if (atkId === "RK-067") {
    const hasFemaleInDiscard = atkPlayer.discard.some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.features?.includes("女");
    });
    if (!hasFemaleInDiscard && (defFeatures.includes("男") || defFeatures.includes("女"))) {
      return true;
    }
  }

  // RK-198: if defender is RK-198 and defender's owner has レイヨウ型 in battle, S-units can't attack
  if (defId === "RK-198") {
    const hasReiyo = defPlayer.battle.some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("レイヨウ型");
    });
    if (hasReiyo && atkDef?.type === "unit" && atkDef.size === "S") {
      return true;
    }
  }

  // RK-255: if defender is RK-255 and defender's owner has 仮面ライダー in battle, S-units can't attack
  if (defId === "RK-255") {
    const hasRider = defPlayer.battle.some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("仮面ライダー");
    });
    if (hasRider && atkDef?.type === "unit" && atkDef.size === "S") {
      return true;
    }
  }

  // RK-287: can only attack 仮面ライダー units
  if (atkId === "RK-287") {
    if (!defFeatures.includes("仮面ライダー")) return true;
  }

  // RK-308: can't attack 獣 units
  if (atkId === "RK-308") {
    if (defFeatures.includes("獣")) return true;
  }

  // RK-311: can't attack if own unit count > enemy unit count（ビークルはユニットに数えない。atwiki/page-1281「自軍ユニットの数」）
  if (atkId === "RK-311") {
    const units = (cards: CardInstance[]) => cards.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit").length;
    const ownCount = units([...atkPlayer.rush, ...atkPlayer.battle]);
    const enemyCount = units([...defPlayer.rush, ...defPlayer.battle]);
    if (ownCount > enemyCount) return true;
  }

  // RM-044: can't attack 男 or 女 units
  if (atkId === "RM-044") {
    if (defFeatures.includes("男") || defFeatures.includes("女")) return true;
  }

  // RS-442: can't be attacked by 女 units
  if (defId === "RS-442") {
    if (atkFeatures.includes("女")) return true;
  }

  // RS-544: can't be attacked by units with 3+ features
  if (defId === "RS-544") {
    if (atkFeatures.length >= 3) return true;
  }

  // XG1-014: can't attack held units (commandHeld: true)
  if (atkId === "XG1-014") {
    if (defenderCard.commandHeld) return true;
  }

  // XG1-049: can't be attacked by non-wing units
  if (defId === "XG1-049") {
    const attackerHasWing = cardHasKeyword(state.definitions, atkId, "wing", {
      state,
      playerId: attackerPlayerId,
    });
    if (!attackerHasWing) return true;
  }

  // XG1-077: can't attack released units (commandHeld: false or undefined)
  if (atkId === "XG1-077") {
    if (!defenderCard.commandHeld) return true;
  }

  // XG1-094: can't be attacked by held units (commandHeld: true)
  if (defId === "XG1-094") {
    if (attackerCard.commandHeld) return true;
  }

  // XG3-030: can only attack SP1+ units (sp is defined and not 0)
  if (atkId === "XG3-030") {
    const sp = defDef?.sp;
    if (sp === undefined || sp === 0) return true;
  }

  // RS-419 (聖剣ズバーン): cannot attack at all
  if (atkId === "RS-419") return true;

  return false;
}

function timeJetRearGuardBlocksAttack(
  state: GameState,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const battle = state.players[defenderPlayerId].battle;
  if (battle.at(-1)?.cardId !== "RS-401") return false;
  const defender = battle.find((c) => c.instanceId === defenderInstanceId);
  if (!defender) return false;
  return unitFeatures(state, defenderPlayerId, defender).includes("航空機");
}

export function canAttackDefender(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
  canAttackRushFn: (
    state: GameState,
    attackerPlayerId: PlayerId,
    attackerInstanceId: string,
  ) => boolean,
): boolean {
  const attackerPlayer = state.players[attackerPlayerId];
  const attacker =
    findInZone(attackerPlayer, "battle", attackerInstanceId) ??
    findInZone(attackerPlayer, "rush", attackerInstanceId);
  if (!attacker) return false;

  if (isVehicle(getDefinition(state.definitions, attacker.card.cardId))) return false;
  // XG6-012 フラッシュタイタンの※（自軍「タイタンボーイ」があるときアタックできない。rules/xg6/xg6Fields.ts）。
  if (xg6BlocksAttack(state, attackerPlayerId, attacker.card.cardId)) return false;
  // XG6-030【唯一の弱点】（自軍コマンドがすべてホールド状態なら敵軍 S ユニットにアタックされない。rules/xg6/xg6Fields.ts）。
  if (xg6DefenderBlocksAttack(state, attacker.card, defenderPlayerId, defenderInstanceId)) return false;

  // RS-158【エレファントシールド】: コンビネーションが成立している間、敵軍ユニットはこれ以外にアタックできない。
  const mustTarget = elephantShieldMustTarget(state, defenderPlayerId);
  if (mustTarget && mustTarget !== defenderInstanceId) return false;
  // RS-297【変形】: 自軍コマンドがすべてリリース状態なら、「航空機」を持たないユニットにアタックされない。
  if (set5ADefenderBlocksAttack(state, attacker.card, defenderPlayerId, defenderInstanceId)) return false;
  // RS-401 タイムジェット5【最後尾からの警戒】: これが自軍バトルエリアの最後に並んでいる間、自軍バトルエリアの
  // 特徴「航空機」を持つユニットは敵軍ユニットにアタックされない（atwiki/page-559）。
  if (timeJetRearGuardBlocksAttack(state, defenderPlayerId, defenderInstanceId)) return false;
  // RS-619 ジェットマシン【航空戦力の奇襲】（rules/legend1/set9NamedEffectsA.ts）。
  if (set9ADefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderPlayerId, defenderInstanceId)) return false;

  const attackerInRush = findInZone(attackerPlayer, "rush", attackerInstanceId);
  if (
    attackerInRush &&
    !canWingAttackFromRush(state, attackerPlayerId, attackerInRush.card)
  ) {
    return false;
  }

  const enemy = state.players[defenderPlayerId];
  const inBattle = findInZone(enemy, "battle", defenderInstanceId);
  const inRush = findInZone(enemy, "rush", defenderInstanceId);

  // RS-311【カラクリ忍法・牙がくれ】（rules/legend1/set5NamedEffects.ts）。
  const defenderCard = (inBattle ?? inRush)?.card;
  if (defenderCard && kibaGakureBlocksAttack(state, attackerPlayerId, attackerInstanceId, defenderCard)) return false;
  // RS-350 暗黒の鎧（「SP1」以上のユニット以外にはアタックされない）・RS-385 グリーンホバーの※（rules/legend1/set6NamedEffects348.ts）。
  if (defenderCard && set6LowDefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderCard)) return false;
  // XG1-096 ビーファイタークワガー ※（NC も RC も発動していない S ユニットにアタックされない。rules/legend1/set7NamedEffectsD.ts）。
  if (defenderCard && set7DDefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderCard)) return false;
  // RS-517 バードニック反応炉（スクラムのユニットカードと同じ CN の BP2000 以下の S ユニット。rules/legend1/set8NamedEffectsA.ts）。
  if (defenderCard && set8ADefenderBlocksAttack(state, defenderPlayerId, defenderCard)) return false;
  // ※「これはBP3000以下のユニットにアタックされない。」（RS-587・RS-588 等。rules/legend1/set8NamedEffectsD.ts）。
  if (defenderCard && set8DDefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderCard)) return false;
  // RS-578 レジェンドマジグリーンRA【岩の装甲】（rules/legend1/set8NamedEffectsC.ts）。
  if (defenderCard && set8CDefenderBlocksAttack(state, attackerPlayerId, defenderPlayerId, defenderCard)) return false;
  // RS-553 ゴッドサルダー ※（自軍バトルエリアにこれ以外の同名ユニットがあればアタックされない。rules/legend1/set8NamedEffectsB.ts）。
  if (defenderCard && set8BDefenderBlocksAttack(state, defenderPlayerId, defenderCard)) return false;
  // RK-006 セイリングジャンプ・RK-014 共同戦線・RK-016 ミラーワールド（rules/rk/rk1NamedEffects.ts）。
  if (defenderCard && rk1DefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderPlayerId, defenderCard)) return false;
  // RK-029 ※・RK-037【グライディング】（rules/rk/rk2UnitEffects.ts）。
  if (defenderCard && rk2DefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderPlayerId, defenderCard)) return false;
  // RK-257 テントロー【高性能レーダー】・RK-263 バイオライダー【液化】（rules/rk/rk13Fields.ts）。
  if (defenderCard && rk13DefenderBlocksAttack(state, attackerPlayerId, defenderPlayerId, defenderCard)) return false;
  // RK-124 スネークオルフェノク【人を守る決意】（rules/rk/rk6Fields.ts）。
  if (defenderCard && rk6SnakeBlocksSelection(state, attackerPlayerId, defenderPlayerId, defenderCard, unitFeatures)) return false;
  // RK-300 カブトエクステンダー【クロックアップ】（rules/rk/rk15Fields.ts）。
  if (defenderCard && rk15DefenderBlocksAttack(state, attackerPlayerId, attacker.card, defenderPlayerId, defenderCard, unitFeatures)) return false;
  // RK-327 の※（ホールド状態のとき敵軍ユニットにアタックされない。rules/rk/rk16Fields.ts）。
  if (defenderCard && rk16DefenderBlocksAttack(defenderCard)) return false;

  if (inRush) {
    if (isVehicle(getDefinition(state.definitions, inRush.card.cardId))) return false;
    if (
      promotedDefenderBlocksAttack(
        state,
        attackerPlayerId,
        attackerInstanceId,
        defenderPlayerId,
        defenderInstanceId,
      ) ||
      promotedAttackerCannotTarget(
        state,
        attackerPlayerId,
        attackerInstanceId,
        defenderPlayerId,
        defenderInstanceId,
      )
    ) {
      return false;
    }
    if (noteOtherNcAttackRestriction(state, attackerPlayerId, attacker.card, defenderPlayerId, inRush.card)) {
      return false;
    }
    if (cardHasGrantKeyword(attacker.card.cardId, "wing_attack_enemy_rush")) {
      return true;
    }
    // RS-622 グリフォーザー【グリフォカリバー4世】（rules/legend1/set9NamedEffectsA.ts）。
    if (set9AAttackerCanAttackRush(state, attackerPlayerId, attacker.card)) return true;
    // RK-262 ロボライダー【ボルティックシューター】（RC を発動したターン。rules/rk/rk13Fields.ts）。
    if (rk13AttackerCanAttackRush(state, attackerPlayerId, attacker.card)) return true;
    // RK-103 仮面ライダークウガPF【ブラストペガサス】（rules/rk/rk5Fields.ts）。
    if (rk5AttackerCanAttackRush(state, attackerPlayerId, attacker.card)) return true;
    // RK-217 イーグルアンデッド【滑空攻撃】（敵軍ラッシュエリアのレジストを持つユニット。rules/rk/rk11Fields.ts）。
    if (rk11AttackerCanAttackRush(attacker.card, () => rk10UnitHasResist(state, defenderPlayerId, inRush.card))) return true;
    // RS-213【炸裂超力バトン】（相手が選んだユニット）・RS-225【大回転獅子爆裂弾】で得た能力。
    if (
      chikaraBatonAllowsAttack(state, attackerPlayerId, attackerInstanceId, defenderInstanceId) ||
      lionBlastAllowsRushAttack(attacker.card) ||
      magiMergeAllowsRushAttack(state, attackerPlayerId, attackerInstanceId) ||
      // RS-562 ガオソーシャークの※・RS-573【バリランサー】（rules/legend1/set8NamedEffectsC.ts）。
      set8CAllowsRushAttack(state, attackerPlayerId, attacker.card, defenderPlayerId, inRush.card) ||
      // RS-675【ウォーターアロー】（NC。rules/legend1/set9NamedEffectsD.ts）。
      set9DAllowsRushAttack(state, attackerPlayerId, attacker.card, defenderPlayerId)
    ) {
      return true;
    }
    if (
      keywordAllowsAttackIntoRush(
        state,
        attacker.card.cardId,
        defenderPlayerId,
        defenderInstanceId,
        attacker.card,
      )
    ) {
      return true;
    }
    if (
      hasUnnamedRule(attacker.card.cardId, "can_attack_enemy_rush_s") &&
      isSmallUnit(state.definitions, inRush.card)
    ) {
      return true;
    }
    return canAttackRushFn(state, attackerPlayerId, attackerInstanceId);
  }

  if (!inBattle) return false;

  if (isVehicle(getDefinition(state.definitions, inBattle.card.cardId))) return false;

  if (scrumBlocksAttack(state, defenderPlayerId, defenderInstanceId)) {
    return false;
  }

  if (
    promotedDefenderBlocksAttack(
      state,
      attackerPlayerId,
      attackerInstanceId,
      defenderPlayerId,
      defenderInstanceId,
    )
  ) {
    return false;
  }

  if (
    promotedAttackerCannotTarget(
      state,
      attackerPlayerId,
      attackerInstanceId,
      defenderPlayerId,
      defenderInstanceId,
    )
  ) {
    return false;
  }

  if (noteOtherNcAttackRestriction(state, attackerPlayerId, attacker.card, defenderPlayerId, inBattle.card)) {
    return false;
  }

  if (
    cannotAttackEnemyBattleS(attacker.card.cardId) &&
    isSmallUnit(state.definitions, inBattle.card)
  ) {
    return false;
  }

  if (
    defenderRequiresAircraftAttacker(inBattle.card.cardId) &&
    // 効果で追加された特徴（RS-505【滑空突撃】の「航空機」等）も含める。
    !unitFeatures(state, attackerPlayerId, attacker.card).includes("航空機")
  ) {
    return false;
  }

  return true;
}

export function tryLegend3BattleToRush(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  phasePlayerId: PlayerId,
): GameState {
  if (!activeNamedEffect(card, "falcon_claw")) return state;

  const enemyId = opponent(playerId);
  // バトルエリアに出られない（※の出場制限を満たせない）ユニットは選べない。
  const targets = collectFieldUnitIds(state, enemyId, Number.MAX_SAFE_INTEGER, ["rush"]).filter((id) =>
    canEffectPutRushUnitIntoBattle(state, enemyId, id),
  );
  if (targets.length === 0) return state;

  const withChoice = startSelectUnitChoice(state, {
    playerId,
    effectId: "falcon_claw",
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId,
    validInstanceIds: targets,
    unitDestination: "enemy_battle",
    optional: true,
  });
  return withChoice ?? state;
}

/**
 * 敵軍バトルエリアのユニットを持ち主のコマンドゾーンにホールド状態で置く（置けなければ捨札。unitDestination "enemy_command"）。
 * 離場の処理を通す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。
 */
export function applyAssaultToCommandHold(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (!findInZone(state.players[ownerId], "battle", instanceId)) return state;
  return sendFieldCardsToCommandHeld(state, ownerId, [instanceId], phasePlayerId);
}
