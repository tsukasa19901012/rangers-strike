import {
  findNamedEffectByEffectId,
  getOnAttackNamedEffect,
  getOnRushNamedEffect,
  hasDestroySelfDamageNote,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  unitBp,
} from "../core/catalog";
import { attackedBpBoostAmount, listCardGrantKeywords } from "../dsl/promotedKeywordBridge";
import { getDslEffectById } from "../dsl/effectLookup";
import { passiveNamedFieldBpBonus } from "./fieldAuras";
import { legend2FieldBpBonus } from "./legend2/fieldEffects";
import {
  legend2AttackerBpBonus,
  legend2BlocksDefenderCounters,
  legend2UsePrintedDefenderBp,
  tryStartLegend2ConditionalChoice,
} from "./legend2/battleEffects";
import { resolveLegend2OnRushEffects } from "./legend2/rushEffects";
import {
  isLegend3OnRushEffect,
  resolveLegend3OnRushEffects,
} from "./legend3/rushEffects";
import { magiRedBoltAttackBpBonus } from "./legend1/coreGapEffects";
import { MURPHY_CHASE_EFFECT_ID, startMurphyChaseChoice } from "./murphyChase";
import {
  canAttackRushWithMoonlightSonic,
  legend3AttackerBpBonus,
  legend3UsePrintedDefenderBp,
  tryStartLegend3ConditionalChoice,
} from "./legend3/battleEffects";
import { legend2EffectiveSp } from "./legend2/fieldEffects";
import { legend3FieldBpBonus } from "./legend3/fieldEffects";
import { canAttackEnemyRushS } from "./legend3/restrictions";
import { findBattleAttacker, findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { applyDamageToPlayer } from "./damagePayment";
import { buildLogEntry } from "../log/formatLog";
import { patchPlayer } from "./playerPatches";
import {
  collectAnyFieldUnitIds,
  collectCommandIds,
  collectFieldUnitIds,
  openEffectChoice,
  startMultiCommandChoice,
  startPitInDiveOrderChoice,
  startRadialHammerChoice,
  startSelectCommandChoice,
  startSelectHandChoice,
  startSelectPowerChoice,
  startSelectUnitChoice,
  startSuperDrillRushChoice,
  startTyrannoSonicChoice,
} from "./pendingChoices";
import { tryLeaveField } from "./operationCounters";

export type NamedEffectOutcome = {
  state: GameState;
  logs: string[];
};

export function battleAttackerBpBonus(
  state: GameState,
  pending: PendingBattle,
): number {
  const attackerCard = findBattleAttacker(
    state.players[pending.attackerPlayerId],
    pending.attackerInstanceId,
  );
  if (!attackerCard) return 0;
  const attacker = { card: attackerCard };

  const mirageOverride = pending.mirageBeamBpOverride;
  let total =
    (mirageOverride !== undefined
      ? mirageOverride + (attacker.card.bpModifier ?? 0)
      : effectiveBp(state, pending.attackerPlayerId, attacker.card)) +
    (pending.attackerBpBonus ?? 0);

  if (pending.attackerPlayerId === state.activePlayer) {
    for (const kw of listCardGrantKeywords(attacker.card.cardId)) {
      const m = kw.match(/^bp_plus_on_battle_own_turn_(\d+)$/);
      if (m) total += Number(m[1]);
    }
  }

  total += passiveNamedFieldBpBonus(
    state,
    pending.attackerPlayerId,
    attacker.card,
    "attacking",
  );
  total += legend2FieldBpBonus(
    state,
    pending.attackerPlayerId,
    attacker.card,
    "attacking",
  );
  total += legend2AttackerBpBonus(state, pending);
  total += legend3AttackerBpBonus(state, pending);

  if (findNamedEffectByEffectId(attacker.card.cardId, "bouken_javelin")) {
    const defenderZone = findInZone(
      state.players[pending.defenderPlayerId],
      "battle",
      pending.defenderInstanceId,
    )
      ? "battle"
      : "rush";
    const defender = findInZone(
      state.players[pending.defenderPlayerId],
      defenderZone,
      pending.defenderInstanceId,
    );
    if (defender) {
      const features = getDefinition(state.definitions, defender.card.cardId)?.features ?? [];
      if (features.includes("メカ")) total += 4000;
    }
  }

  if (findNamedEffectByEffectId(attacker.card.cardId, "red_fire")) {
    const released = state.players[pending.attackerPlayerId].command.filter(
      (c) => !c.commandHeld,
    ).length;
    total += released * 1000;
  }

  total += magiRedBoltAttackBpBonus(state, pending.attackerPlayerId, attacker.card);

  // XG4-090 / XG4-066: vehicle gives rider a BP bonus when attacking
  if (attacker.card.mountedOnInstanceId) {
    const rusher = state.players[pending.attackerPlayerId];
    const vehicle = rusher.rush.find(
      (c) => c.instanceId === attacker.card.mountedOnInstanceId,
    );
    if (vehicle?.cardId === "XG4-090") total += 2000;
    else if (vehicle?.cardId === "XG4-066") total += 1500;
  }

  return total;
}

export function battleDefenderBp(
  state: GameState,
  pending: PendingBattle,
): number {
  const defenderOwner = pending.substituteInstanceId
    ? findSubstituteOwner(state, pending)
    : pending.defenderPlayerId;
  const defenderZone: "rush" | "battle" = pending.substituteInstanceId
    ? findSubstituteZone(state, pending)
    : findInZone(state.players[pending.defenderPlayerId], "rush", pending.defenderInstanceId)
      ? "rush"
      : "battle";
  const defenderPlayer = state.players[defenderOwner];
  const defenderFound = findInZone(
    defenderPlayer,
    defenderZone,
    pending.substituteInstanceId ?? pending.defenderInstanceId,
  );
  if (!defenderFound) return 0;

  const attackerCard = findBattleAttacker(
    state.players[pending.attackerPlayerId],
    pending.attackerInstanceId,
  );
  const usePrintedBp =
    attackerCard &&
    (hasBattleNcEffect(attackerCard, "shark_jaws") ||
      hasBattleNcEffect(attackerCard, "super_cutter") ||
      getOnAttackNamedEffect(attackerCard.cardId)?.effectId === "shark_jaws" ||
      getOnAttackNamedEffect(attackerCard.cardId)?.effectId === "super_cutter" ||
      legend2UsePrintedDefenderBp(state, pending) ||
      legend3UsePrintedDefenderBp(state, pending));

  const base = usePrintedBp
    ? unitBp(getDefinition(state.definitions, defenderFound.card.cardId))
    : effectiveBp(state, defenderOwner, defenderFound.card);

  return (
    base +
    passiveNamedFieldBpBonus(state, defenderOwner, defenderFound.card, "defending") +
    attackedBpBoostAmount(defenderFound.card.cardId)
  );
}

function findSubstituteOwner(state: GameState, pending: PendingBattle): PlayerId {
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    if (
      findInZone(player, "battle", pending.substituteInstanceId!) ||
      findInZone(player, "rush", pending.substituteInstanceId!)
    ) {
      return pid;
    }
  }
  return pending.defenderPlayerId;
}

function findSubstituteZone(
  state: GameState,
  pending: PendingBattle,
): "rush" | "battle" {
  for (const pid of ["player1", "player2"] as const) {
    if (findInZone(state.players[pid], "battle", pending.substituteInstanceId!)) {
      return "battle";
    }
  }
  return "rush";
}

export function attackerBlocksDefenderCounters(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  const attacker = findInZone(
    state.players[attackerPlayerId],
    "battle",
    attackerInstanceId,
  );
  if (!attacker) return legend2BlocksDefenderCounters(state, attackerPlayerId, attackerInstanceId);
  return (
    hasBattleNcEffect(attacker.card, "panther_claw") ||
    getOnAttackNamedEffect(attacker.card.cardId)?.effectId === "panther_claw" ||
    legend2BlocksDefenderCounters(state, attackerPlayerId, attackerInstanceId)
  );
}

export function canAttackRushWithYellowThunder(
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

  const yellowThunderActive = hasBattleNcEffect(attacker.card, "yellow_thunder");
  const attackRushZoneActive =
    hasBattleNcEffect(attacker.card, "attack_rush_zone") ||
    hasBattleNcEffect(attacker.card, "magi_yellow_bolt");

  return (
    yellowThunderActive ||
    attackRushZoneActive ||
    canAttackRushWithMoonlightSonic(state, attackerPlayerId, attackerInstanceId) ||
    canAttackEnemyRushS(state, attackerPlayerId, attackerInstanceId)
  );
}

function sendUnitToPower(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  zone: "rush" | "battle",
  phasePlayerId: PlayerId,
): NamedEffectOutcome {
  const owner = state.players[ownerId];
  const found = findInZone(owner, zone, instanceId);
  if (!found) return { state, logs: [] };

  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: ownerId,
    instanceId,
    fromZone: zone,
    toZone: "power",
    leavingCardId: found.card.cardId,
    phasePlayerId,
  });

  return {
    state: leaveResult.state,
    logs: leaveResult.deferred
      ? []
      : [
          buildLogEntry(
            ownerId,
            "named_effect",
            found.card.cardId,
            state.definitions,
            "to_power",
          ),
        ],
  };
}

function destroyUnitInZone(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  zone: "rush" | "battle",
  phasePlayerId: PlayerId,
): NamedEffectOutcome {
  const owner = state.players[ownerId];
  const found = findInZone(owner, zone, instanceId);
  if (!found) return { state, logs: [] };

  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: ownerId,
    instanceId,
    fromZone: zone,
    toZone: "discard",
    leavingCardId: found.card.cardId,
    phasePlayerId,
  });

  return {
    state: leaveResult.state,
    logs: leaveResult.deferred
      ? []
      : [
          buildLogEntry(
            ownerId,
            "named_effect",
            found.card.cardId,
            state.definitions,
            "destroy",
          ),
        ],
  };
}

function pickWeakestUnit(
  state: GameState,
  playerId: PlayerId,
  zone: "rush" | "battle",
  maxBp: number,
): { instanceId: string; cardId: string } | undefined {
  const player = state.players[playerId];
  let best: { instanceId: string; cardId: string; bp: number } | undefined;

  for (const card of player[zone]) {
    const bp = effectiveBp(state, playerId, card);
    if (bp > maxBp) continue;
    if (!best || bp < best.bp) {
      best = { instanceId: card.instanceId, cardId: card.cardId, bp };
    }
  }

  return best;
}

/** ラッシュ時の固有名効果 — 対象がある場合プレイヤー選択を開く。 */
export function resolveNamedOnRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): NamedEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return { state, logs: [] };

  const named = getOnRushNamedEffect(found.card.cardId);
  if (!named) return { state, logs: [] };

  const enemyId = opponent(rusherPlayerId);
  let nextState = state;
  const logs: string[] = [];

  switch (named.effectId) {
    case "armor_attack": {
      const targets = collectFieldUnitIds(nextState, enemyId, 8000, ["battle"]);
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: rusherPlayerId,
        effectId: "armor_attack",
        sourceCardId: found.card.cardId,
        phasePlayerId,
        validInstanceIds: targets,
        unitDestination: "power",
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case "tyranno_sonic": {
      const withChoice = startTyrannoSonicChoice(
        nextState,
        rusherPlayerId,
        found.card.cardId,
        phasePlayerId,
      );
      if (withChoice) nextState = withChoice;
      break;
    }
    case "moss_blizzard": {
      const withChoice = startMultiCommandChoice(nextState, {
        playerId: enemyId,
        effectId: "moss_blizzard",
        sourceCardId: found.card.cardId,
        phasePlayerId,
        selectCount: 2,
        commandFilter: "released",
        commandAction: "hold",
        optional: true,
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case "ptera_beam": {
      const withChoice = startSelectCommandChoice(nextState, {
        playerId: enemyId,
        effectId: "ptera_beam",
        sourceCardId: found.card.cardId,
        phasePlayerId,
        commandFilter: "held",
        commandAction: "discard",
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case MURPHY_CHASE_EFFECT_ID: {
      const withChoice = startMurphyChaseChoice(nextState, {
        playerId: rusherPlayerId,
        phasePlayerId,
        sourceCardId: found.card.cardId,
        effectId: MURPHY_CHASE_EFFECT_ID,
        triggerSourceInstanceId: rushedInstanceId,
        optional: true,
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    default: {
      if (isLegend3OnRushEffect(named.effectId)) {
        const legend3 = resolveLegend3OnRushEffects(
          nextState,
          rusherPlayerId,
          rushedInstanceId,
          phasePlayerId,
          found.card.cardId,
          named.effectId,
        );
        nextState = legend3.state;
        logs.push(...legend3.logs);
      } else {
        const legend2 = resolveLegend2OnRushEffects(
          nextState,
          rusherPlayerId,
          rushedInstanceId,
          phasePlayerId,
          found.card.cardId,
          named.effectId,
        );
        nextState = legend2.state;
        logs.push(...legend2.logs);
      }
      break;
    }
  }

  if (nextState.pendingEffectChoice && nextState !== state) {
    logs.push(
      buildLogEntry(
        rusherPlayerId,
        "named_effect",
        found.card.cardId,
        state.definitions,
        `choice:${named.effectId}`,
      ),
    );
  }

  return { state: nextState, logs };
}

/** RS-070 天空魔法斬り — 戦闘進入時。 */
export function resolveSkyMagicSlash(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): NamedEffectOutcome {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const command = enemy.command.map((c) => ({ ...c, commandHeld: true }));
  return {
    state: { ...state, ...updatePlayer(state, enemyId, { ...enemy, command }) },
    logs: [
      buildLogEntry(playerId, "enter_battle", cardId, state.definitions, "sky_magic_slash"),
    ],
  };
}

const OWN_TURN_BATTLE_ENTRY_EFFECTS = new Set([
  "super_drill",
  "judgment_sword",
  "justice_flasher",
]);

/** RS-051 / RS-043 / RS-042 — 自軍ターンのバトルフェイズ中にバトル進入したときのみ。 */
export function canRunEnterBattleConditionalEffect(
  state: GameState,
  ownerId: PlayerId,
  effectId: string,
): boolean {
  if (OWN_TURN_BATTLE_ENTRY_EFFECTS.has(effectId)) {
    return state.phase === "battle" && state.activePlayer === ownerId;
  }
  return true;
}

/** 撃破対象が RS-065 一点突破の条件（SP1+ または SP!）を満たすか。 */
export function unitQualifiesForFocusedBreakthrough(
  state: GameState,
  ownerId: PlayerId,
  unit: CardInstance,
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || def.type !== "unit") return false;
  if (def.sp === "special") return true;
  return legend2EffectiveSp(state, ownerId, unit) >= 1;
}

/** 戦闘進入時の任意 may 効果 — 合法な場合選択UIを開く。 */
export function tryStartConditionalChoice(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  if (!canRunEnterBattleConditionalEffect(state, playerId, effectId)) {
    return null;
  }
  if (effectId === "judgment_sword") {
    return startSelectPowerChoice(state, {
      playerId,
      effectId,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      phasePlayerId,
      selectCount: 2,
      optional: true,
    });
  }
  if (effectId === "justice_flasher") {
    return startSelectPowerChoice(state, {
      playerId,
      effectId,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      phasePlayerId,
      selectCount: 5,
      optional: true,
    });
  }
  if (effectId === "super_drill") {
    const effect = getDslEffectById(card.cardId, effectId);
    const text = effect?.text ?? "";
    if (/ラッシュエリアから特徴「/.test(text)) {
      const feature = text.match(/特徴「([^」]+)」/)?.[1] ?? "恐竜";
      return startSuperDrillRushChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId,
        feature,
      });
    }
    return startSelectHandChoice(state, {
      playerId,
      effectId,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      phasePlayerId,
      cardId: card.cardId,
      optional: true,
    });
  }
  const legend3 = tryStartLegend3ConditionalChoice(state, playerId, card, effectId, phasePlayerId);
  if (legend3) return legend3;

  const legend2 = tryStartLegend2ConditionalChoice(state, playerId, card, effectId, phasePlayerId);
  if (legend2) return legend2;
  return null;
}

/** @deprecated tryStartConditionalChoice を使用 */
export function resolveConditionalOnEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
): NamedEffectOutcome {
  const withChoice = tryStartConditionalChoice(state, playerId, card, effectId, playerId);
  if (!withChoice) return { state, logs: [] };
  return {
    state: withChoice,
    logs: [
      buildLogEntry(playerId, "named_effect", card.cardId, state.definitions, `choice:${effectId}`),
    ],
  };
}

export function resolveFocusedBreakthroughDamage(
  state: GameState,
  strikerPlayerId: PlayerId,
  strikerInstanceId: string,
  defenderOwner: PlayerId,
  defender: CardInstance,
): NamedEffectOutcome {
  const striker = state.players[strikerPlayerId];
  const strikerCard = striker.battle.find((c) => c.instanceId === strikerInstanceId);
  if (!strikerCard || strikerCard.cardId !== "RS-065") return { state, logs: [] };
  if (!unitQualifiesForFocusedBreakthrough(state, defenderOwner, defender)) {
    return { state, logs: [] };
  }

  const enemyId = opponent(strikerPlayerId);
  const nextState = applyDamageToPlayer(state, enemyId, 1, {
    kind: "none",
    activePlayer: state.activePlayer,
  });
  return {
    state: nextState,
    logs: [
      buildLogEntry(
        strikerPlayerId,
        "named_effect",
        "RS-065",
        state.definitions,
        "focused_breakthrough",
      ),
    ],
  };
}

export function bpLastThreeDigits(bp: number): number {
  const normalized = ((bp % 1000) + 1000) % 1000;
  return normalized;
}

function unitHasPrintedSp(def: ReturnType<typeof getDefinition>): boolean {
  if (!def || def.type !== "unit") return false;
  return def.sp != null;
}

/** RS-625 シルバー専用機: 追加条件で捨てたカードにSPがあれば BP+2000 / SP1。 */
export function applyShirubaOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): NamedEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const rushed = findInZone(rusher, "rush", rushedInstanceId);
  if (!rushed || rushed.card.cardId !== "RS-625") return { state, logs: [] };

  const materialCardId = rushed.card.zordMaterialCardId;
  if (!materialCardId) return { state, logs: [] };
  const materialDef = getDefinition(state.definitions, materialCardId);
  if (!unitHasPrintedSp(materialDef)) return { state, logs: [] };

  const nextState = patchPlayer(state, rusherPlayerId, (player) => {
    const rush = [...player.rush];
    const index = rush.findIndex((c) => c.instanceId === rushedInstanceId);
    if (index < 0) return player;
    rush[index] = {
      ...rush[index]!,
      spModifier: (rush[index]!.spModifier ?? 0) + 1,
      bpModifier: (rush[index]!.bpModifier ?? 0) + 2000,
    };
    return { ...player, rush };
  });
  return {
    state: nextState,
    logs: [
      buildLogEntry(
        rusherPlayerId,
        "named_effect",
        "RS-625",
        state.definitions,
        "shiruba",
      ),
    ],
  };
}

export function collectBpLastThree500UnitIds(
  state: GameState,
  targetPlayerId: PlayerId,
  options: { size?: "S" | "M" | "L"; zones?: Array<"rush" | "battle"> } = {},
): string[] {
  const zones = options.zones ?? ["battle", "rush"];
  const player = state.players[targetPlayerId];
  const ids: string[] = [];

  for (const zone of zones) {
    for (const card of player[zone]) {
      const def = getDefinition(state.definitions, card.cardId);
      if (!def || def.type !== "unit") continue;
      if (options.size && def.size !== options.size) continue;
      if (bpLastThreeDigits(effectiveBp(state, targetPlayerId, card)) !== 500) continue;
      ids.push(card.instanceId);
    }
  }

  return ids;
}

export function tryStartBringerSwordChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId = opponent(playerId);
  const targets = collectBpLastThree500UnitIds(state, enemyId, { size: "S" });
  if (targets.length === 0) return null;

  return startSelectUnitChoice(state, {
    playerId,
    effectId: "buringasodo",
    sourceCardId,
    sourceInstanceId,
    phasePlayerId,
    validInstanceIds: targets,
    unitDestination: "discard",
  });
}

/** RS-685: 自軍ターン中、BP下三桁500の敵を撃破したとき相手に1ダメージ。 */
export function resolveBlackCondorDestroyDamage(
  state: GameState,
  strikerPlayerId: PlayerId,
  strikerInstanceId: string,
  defenderOwner: PlayerId,
  defender: CardInstance,
): NamedEffectOutcome {
  if (state.activePlayer !== strikerPlayerId) return { state, logs: [] };

  const striker = state.players[strikerPlayerId];
  const strikerCard = striker.battle.find((c) => c.instanceId === strikerInstanceId);
  if (!strikerCard || strikerCard.cardId !== "RS-685") return { state, logs: [] };

  const defenderBp = effectiveBp(state, defenderOwner, defender);
  if (bpLastThreeDigits(defenderBp) !== 500) return { state, logs: [] };

  const enemyId = opponent(strikerPlayerId);
  const nextState = applyDamageToPlayer(state, enemyId, 1, {
    kind: "none",
    activePlayer: state.activePlayer,
  });
  return {
    state: nextState,
    logs: [
      buildLogEntry(
        strikerPlayerId,
        "named_effect",
        "RS-685",
        state.definitions,
        "black_condor_destroy_damage",
      ),
    ],
  };
}

export function resolveAbaRedDestroyDamage(
  state: GameState,
  ownerId: PlayerId,
  cardId: string,
): NamedEffectOutcome {
  if (!hasDestroySelfDamageNote(cardId)) return { state, logs: [] };
  const nextState = applyDamageToPlayer(state, ownerId, 1, {
    kind: "none",
    activePlayer: state.activePlayer,
  });
  return {
    state: nextState,
    logs: [
      buildLogEntry(ownerId, "named_effect", cardId, state.definitions, "self_damage"),
    ],
  };
}

export function tryStartPinkStormChoice(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): GameState | null {
  const targets = collectAnyFieldUnitIds(state, 3000);
  return startSelectUnitChoice(state, {
    playerId,
    effectId: "pink_storm",
    sourceCardId: "RS-060",
    sourceInstanceId,
    phasePlayerId: playerId,
    validInstanceIds: targets,
    unitDestination: "deck_top",
    optional: true,
  });
}

export function tryStartGreenGroundChoice(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): GameState | null {
  const enemyId = opponent(playerId);
  const targets = collectCommandIds(state, enemyId, "any");
  if (targets.length === 0) return null;
  return startSelectCommandChoice(state, {
    playerId,
    effectId: "green_ground",
    sourceCardId: "RS-061",
    sourceInstanceId,
    phasePlayerId: playerId,
    commandFilter: "any",
    commandAction: "return_hand",
    optional: true,
    validInstanceIds: targets,
  });
}

export function tryStartRadialHammerChoice(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): GameState | null {
  return startRadialHammerChoice(state, playerId, "RS-063", sourceInstanceId);
}

export function tryStartPitInDiveChoice(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): GameState | null {
  return startPitInDiveOrderChoice(state, playerId, "RS-049", sourceInstanceId);
}

export function tryStartDestroyEnemyChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  maxBp: number,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId = opponent(playerId);
  const targets = collectFieldUnitIds(state, enemyId, maxBp, ["battle"]);
  return startSelectUnitChoice(state, {
    playerId,
    effectId: "destroy_enemy_bp4000",
    sourceCardId,
    phasePlayerId,
    validInstanceIds: targets,
    unitDestination: "discard",
  });
}

export function tryStartMossBreakerChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId = opponent(playerId);
  return startSelectCommandChoice(state, {
    playerId: enemyId,
    effectId: "moss_breaker",
    sourceCardId,
    phasePlayerId,
    commandFilter: "released",
    commandAction: "hold",
    optional: true,
  });
}

export function blowKnuckleReturnReleasedCommands(state: GameState): NamedEffectOutcome {
  let nextState = state;
  const logs: string[] = [];

  for (const pid of ["player1", "player2"] as const) {
    const player = nextState.players[pid];
    const released = player.command.filter((c) => !c.commandHeld);
    const held = player.command.filter((c) => c.commandHeld);
    if (released.length === 0) continue;
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, pid, {
        ...player,
        command: held,
        hand: [...player.hand, ...released],
      }),
    };
    logs.push(
      buildLogEntry(pid, "named_effect", "RS-064", state.definitions, "blow_knuckle"),
    );
  }

  return { state: nextState, logs };
}

export function grantSp1ToBattleUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const battle = player.battle.map((c) =>
    c.instanceId === instanceId
      ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
      : c,
  );
  return { ...state, ...updatePlayer(state, playerId, { ...player, battle }) };
}

export function markBattleNcEffect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  effectId: string,
): GameState {
  const player = state.players[playerId];
  const battle = player.battle.map((c) => {
    if (c.instanceId !== instanceId) return c;
    const activated = c.activatedNcEffects ?? [];
    if (activated.includes(effectId)) return c;
    return { ...c, activatedNcEffects: [...activated, effectId] };
  });
  return { ...state, ...updatePlayer(state, playerId, { ...player, battle }) };
}

export function hasBattleNcEffect(card: CardInstance, effectId: string): boolean {
  return card.activatedNcEffects?.includes(effectId) ?? false;
}

export function grantBpBoostToBattleUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  amount: number,
): GameState {
  const player = state.players[playerId];
  const battle = player.battle.map((c) =>
    c.instanceId === instanceId
      ? { ...c, bpModifier: (c.bpModifier ?? 0) + amount }
      : c,
  );
  return { ...state, ...updatePlayer(state, playerId, { ...player, battle }) };
}
