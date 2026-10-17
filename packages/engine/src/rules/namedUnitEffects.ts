import {
  findNamedEffectByEffectId,
  getOnRushNamedEffect,
  hasDestroySelfDamageNote,
} from "@rangers-strike/cards";
import { activeOnAttackNamedEffect, namedEffectActive } from "./ncGatedEffects";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../types/game";
import {
  bpSetValueOf,
  cardCategories,
  cardName,
  effectiveBp,
  getDefinition,
  unitBp,
} from "../core/catalog";
import { withSpBecomes } from "./fractionalSp";
import { set7DUsePrintedDefenderBp } from "./legend1/set7NamedEffectsD";
import {
  attackedBpBoostAmount,
  listCardGrantKeywords,
  rideAttackBpBoostAmount,
} from "../dsl/promotedKeywordBridge";
import { findMountedVehicle } from "../keywords/ride";
import { cardNotSelectableByOpponent } from "../keywords/effectTargetability";
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
import { set5AttackerBpBonus } from "./legend1/set5NamedEffects";
import { openOptionalEffectConfirm, registerOptionalEffect } from "./optionalEffects";
import { afterCommandCardsLeft } from "./commandLeaveRefill";
import { attackerSuppressesAttackedCounters } from "./keywordGapRuntime";
import { allyAttackedAuraBpBonus } from "../dsl/promotedKeywordBridge";

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

  // RS-062【ボウケンジャベリン】・RS-241【デュアルクラッシャー・ドリルヘッド】（CN5）:
  // 特徴「メカ」を持つユニットにアタックするとき BP+4000（NC の効果は成立しているときだけ。R-CN-02）。
  if (
    namedEffectActive(attacker.card, "bouken_javelin") ||
    namedEffectActive(attacker.card, "deyuarukurashadoriruhedo")
  ) {
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

  // RS-342【ゲキロッド】・RS-344【ブレイジングストームスラッシュ】（rules/legend1/set5NamedEffects.ts）。
  total += set5AttackerBpBonus(
    state,
    pending.attackerPlayerId,
    attacker.card,
    pending.defenderPlayerId,
    pending.defenderInstanceId,
    namedEffectActive,
  );

  // RS-232【アバレウィング】（CN3）: これがアタックするとき、これは BP+1000 される。
  if (namedEffectActive(attacker.card, "abareuingu")) total += 1000;

  if (namedEffectActive(attacker.card, "red_fire")) {
    const released = state.players[pending.attackerPlayerId].command.filter(
      (c) => !c.commandHeld,
    ).length;
    total += released * 1000;
  }

  total += magiRedBoltAttackBpBonus(state, pending.attackerPlayerId, attacker.card);

  const mountedVehicle = findMountedVehicle(
    state,
    pending.attackerPlayerId,
    attacker.card,
  );
  if (mountedVehicle) {
    total += rideAttackBpBoostAmount(mountedVehicle.cardId);
  }

  // ルール: R-BP-01 — 「指定の値になる」（ミラージュビーム・頭が高い！）が最も優先され、増減の計算は行わない。
  if (mirageOverride !== undefined) return mirageOverride;
  const attackerSet = bpSetValueOf(state, pending.attackerPlayerId, attacker.card);
  if (attackerSet !== undefined) return attackerSet;

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
  // ルール: R-BP-01 — 「BP○○になる」が最優先で、本来の値・増減の計算は行わない。
  const defenderSet = bpSetValueOf(state, defenderOwner, defenderFound.card);
  if (defenderSet !== undefined) return defenderSet;

  const attackerCard = findBattleAttacker(
    state.players[pending.attackerPlayerId],
    pending.attackerInstanceId,
  );
  const usePrintedBp =
    attackerCard &&
    (hasBattleNcEffect(attackerCard, "shark_jaws") ||
      hasBattleNcEffect(attackerCard, "super_cutter") ||
      hasBattleNcEffect(attackerCard, "use_printed_bp_in_battle") ||
      namedEffectActive(attackerCard, "abareuingu") ||
      activeOnAttackNamedEffect(attackerCard)?.effectId === "shark_jaws" ||
      activeOnAttackNamedEffect(attackerCard)?.effectId === "super_cutter" ||
      activeOnAttackNamedEffect(attackerCard)?.effectId === "raidakiku" ||
      legend2UsePrintedDefenderBp(state, pending) ||
      legend3UsePrintedDefenderBp(state, pending) ||
      // RS-503【シャッキーン！の中に修行あり】（rules/legend1/set7NamedEffectsD.ts）。
      set7DUsePrintedDefenderBp(state, pending));

  const mirageOverride = pending.substituteInstanceId ? undefined : pending.mirageBeamDefenderBpOverride;
  const base =
    mirageOverride !== undefined
      ? mirageOverride + (defenderFound.card.bpModifier ?? 0)
      : usePrintedBp
        ? unitBp(getDefinition(state.definitions, defenderFound.card.cardId))
        : effectiveBp(state, defenderOwner, defenderFound.card);

  if (usePrintedBp) {
    return base;
  }

  return (
    base +
    passiveNamedFieldBpBonus(state, defenderOwner, defenderFound.card, "defending") +
    attackedBpBoostAmount(defenderFound.card.cardId) +
    allyAttackedAuraBpBonus(state, defenderOwner, defenderFound.card) +
    // RK-004 ギギの腕輪・RK-009 二人の世紀王: 「このバトルの間、アタックされたユニットは BP+…」（かわりにバトルするユニットには付かない）。
    (pending.substituteInstanceId ? 0 : (pending.defenderBpBonus ?? 0))
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
    hasBattleNcEffect(attacker.card, "cannot_counter_on_attack") ||
    activeOnAttackNamedEffect(attacker.card)?.effectId === "panther_claw" ||
    // 「これがアタックするとき、相手はカウンターを発動できない」（RS-190【ミドメラン】等）— 文言で判定し、
    // NC の効果なら NC が成立しているときだけ（activeOnAttackNamedEffect が NC ゲートを見る。R-CN-02）。
    /これがアタックするとき、相手はカウンターを(?:発動|使用)できない/.test(
      activeOnAttackNamedEffect(attacker.card)?.text ?? "",
    ) ||
    attackerSuppressesAttackedCounters(attacker.card.cardId) ||
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

  // ルール: R-ERR-RS575 — ユニゴルオンにライドしているユニットは敵軍ラッシュエリアのユニットにアタックできる。
  const mountedId = attacker.card.mountedOnInstanceId;
  const ridesUnigoruon =
    !!mountedId &&
    [...state.players[attackerPlayerId].battle, ...state.players[attackerPlayerId].rush].some(
      (c) => c.instanceId === mountedId && c.cardId === "RS-575",
    );

  return (
    yellowThunderActive ||
    attackRushZoneActive ||
    ridesUnigoruon ||
    canAttackRushWithMoonlightSonic(state, attackerPlayerId, attackerInstanceId)
    // RS-154 等「※これは敵軍ラッシュエリアのSユニットにアタックできる」は S ユニットだけが対象なので、
    // ここ（ラッシュエリアのユニットすべてにアタックできる効果）には含めない。サイズの判定は
    // legend3/restrictions.ts の can_attack_enemy_rush_s で行う（atwiki/page-89）。
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
        // ルール: R-ERR-RS036 — リリース状態のコマンドを2つ（1つしかなければ1つ）必ずホールドする。
        selectCount: 2,
        commandFilter: "released",
        commandAction: "hold",
        optional: false,
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case "ptera_beam": {
      // ルール: R-RES-01 — テキストに指定がなければ、効果の持ち主（ラッシュしたプレイヤー）が選ぶ。
      const withChoice = startSelectCommandChoice(nextState, {
        playerId: rusherPlayerId,
        effectId: "ptera_beam",
        sourceCardId: found.card.cardId,
        phasePlayerId,
        commandFilter: "held",
        commandAction: "discard",
        // 「相手に選ばれない」ユニットカード（ガタックRF 等）はホールド状態でも選べない（atwiki/page-81 Q2）。
        validInstanceIds: collectCommandIds(nextState, enemyId, "held").filter((id) => {
          const cmd = nextState.players[enemyId].command.find((c) => c.instanceId === id);
          return !cmd || !cardNotSelectableByOpponent(cmd.cardId);
        }),
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

function holdAllEnemyCommands(state: GameState, playerId: PlayerId): GameState {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const command = enemy.command.map((c) => ({ ...c, commandHeld: true }));
  return { ...state, ...updatePlayer(state, enemyId, { ...enemy, command }) };
}

/**
 * RS-070【天空魔法斬り】／RS-111【ファントムイリュージョン】— 「これがバトルエリアに出たとき、
 * 敵軍コマンドをすべてホールドしてもよい」。任意なので行うかどうかの確認を開く（出典: atwiki/page-24）。
 * リリース状態の敵軍コマンドが無ければ何も変わらないので確認しない。
 */
export function resolveSkyMagicSlash(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  sourceInstanceId?: string,
): NamedEffectOutcome {
  const enemy = state.players[opponent(playerId)];
  if (!enemy.command.some((c) => !c.commandHeld)) return { state, logs: [] };
  return {
    state: openOptionalEffectConfirm(state, {
      playerId,
      effectId: "sky_magic_slash",
      sourceCardId: cardId,
      sourceInstanceId,
      phasePlayerId: state.activePlayer,
    }),
    logs: [
      buildLogEntry(playerId, "enter_battle", cardId, state.definitions, "choice:sky_magic_slash"),
    ],
  };
}

registerOptionalEffect("sky_magic_slash", {
  apply: (state, pending) => {
    const next = holdAllEnemyCommands(state, pending.playerId);
    return {
      ...next,
      log: [
        ...next.log,
        buildLogEntry(pending.playerId, "enter_battle", pending.sourceCardId, state.definitions, "sky_magic_slash"),
      ],
    };
  },
});

const OWN_TURN_BATTLE_ENTRY_EFFECTS = new Set(["justice_flasher"]);

/**
 * エラッタで「自軍ターン中、これがバトルエリアに出たとき」に限定された効果。
 * ルール: R-ERR-RS043（【ジャッジメントソード】）、R-ERR-RS051（【超ドリル進化】）
 */
const ERRATA_OWN_TURN_ENTER_EFFECTS = new Set(["super_drill", "judgment_sword"]);

/**
 * RS-042 — 自軍ターンのバトルフェイズ中にバトル進入したときのみ。
 * RS-051 / RS-043 — エラッタ後テキストどおり自軍ターン中にバトルエリアに出たときのみ。
 */
export function canRunEnterBattleConditionalEffect(
  state: GameState,
  ownerId: PlayerId,
  effectId: string,
): boolean {
  if (ERRATA_OWN_TURN_ENTER_EFFECTS.has(effectId)) {
    return state.activePlayer === ownerId;
  }
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
  /** 撃破前（並びにある間）に判定した結果。省略時はこの state で判定する。 */
  qualifiesBeforeLeave?: boolean,
): NamedEffectOutcome {
  const striker = state.players[strikerPlayerId];
  const strikerCard = striker.battle.find((c) => c.instanceId === strikerInstanceId);
  if (!strikerCard || strikerCard.cardId !== "RS-065") return { state, logs: [] };
  // ルール: R-ERR-RS065 — 【一点突破】は NC（CN3）が成立しているときだけ有効。
  if (!hasBattleNcEffect(strikerCard, "focused_breakthrough")) return { state, logs: [] };
  const qualifies =
    qualifiesBeforeLeave ?? unitQualifiesForFocusedBreakthrough(state, defenderOwner, defender);
  if (!qualifies) {
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
    // 「次の能力を得る⇒BP+2000、「SP1」」— SP は加算ではなく SP1 になる。
    const withSp = withSpBecomes(state.definitions, undefined, rush[index]!, 1);
    rush[index] = {
      ...withSp,
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
  const leftCounts: Array<[PlayerId, number]> = [];

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
    leftCounts.push([pid, released.length]);
    logs.push(
      buildLogEntry(pid, "named_effect", "RS-064", state.definitions, "blow_knuckle"),
    );
  }

  // コマンドゾーンを離れたときの誘発（RS-238【プロジェットカノン】等。離れた枚数だけ — RS-064 Q1）。
  for (const [pid, count] of leftCounts) {
    nextState = afterCommandCardsLeft(nextState, pid, count);
    if (nextState.pendingEffectChoice) break;
  }

  return { state: nextState, logs };
}

/**
 * RS-064【ブロウナックル】「リリース状態の自軍コマンドをすべて手札に戻してもよい。そうしたとき、相手も同じようにする」。
 * 任意なので確認を開く（atwiki/page-268）。自軍のリリース状態コマンドが0枚なら発動できない
 * （grnrngr/faq-card-1 RS-064 Q3「いいえ、できません」）。
 */
export function tryStartBlowKnuckle(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  if (!state.players[playerId].command.some((c) => !c.commandHeld)) return null;
  return openOptionalEffectConfirm(state, {
    playerId,
    effectId: "blow_knuckle",
    sourceCardId,
    sourceInstanceId,
    phasePlayerId: state.activePlayer,
  });
}

registerOptionalEffect("blow_knuckle", {
  apply: (state, pending) => {
    const blow = blowKnuckleReturnReleasedCommands(state);
    return { ...blow.state, log: [...blow.state.log, ...blow.logs] };
  },
  // 相手の方がリリース状態のコマンドを多く失うときだけ行う。
  cpuAccepts: (state, pending) => {
    const count = (pid: PlayerId) => state.players[pid].command.filter((c) => !c.commandHeld).length;
    return count(opponent(pending.playerId)) > count(pending.playerId);
  },
});

export function grantSp1ToBattleUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const battle = player.battle.map((c) =>
    // 「SP1」を得る＝SP1 になる（加算ではなく置き換え。rules/fractionalSp の withSpBecomes）。
    c.instanceId === instanceId ? withSpBecomes(state.definitions, player.battle, c, 1) : c,
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

/** RS-234 アバレキラー【ウイングペンタクト】の NC 記録名。 */
export const WING_PENTACT_NC = "uingupentakuto";
/** 【ウイングペンタクト】でアバレキラーからコンビネーションした「WB」の M ユニットの印（ターン終了時に撃破）。 */
export const WING_PENTACT_COMBO_MARK = "wing_pentact_combo";

/**
 * RS-234 アバレキラー【ウイングペンタクト】（NC）: 自軍ターン中、このユニットからコンビネーションする「WB」の
 * M ユニットは BP+3000 され、BP8000 以上のとき「SP1」になる。
 * ルール: R-CN-05 — コンビネーションは直前に出たユニット（左隣）との間で成立する。
 */
export function applyWingPentactOnCombo(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || !hasBattleNcEffect(left, WING_PENTACT_NC)) return state;
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit" || def.size !== "M" || !cardCategories(def).includes("WB")) return state;
  let next = grantBpBoostToBattleUnit(state, playerId, card.instanceId, 3000);
  next = markBattleNcEffect(next, playerId, card.instanceId, WING_PENTACT_COMBO_MARK);
  const entered = next.players[playerId].battle.find((c) => c.instanceId === card.instanceId);
  if (entered && effectiveBp(next, playerId, entered) >= 8000) {
    next = grantSp1ToBattleUnit(next, playerId, card.instanceId);
  }
  return {
    ...next,
    log: [...next.log, buildLogEntry(playerId, "named_effect", left.cardId, state.definitions, "wing_pentact")],
  };
}

/** 【ウイングペンタクト】自分がターンを終えるとき、アバレキラーからコンビネーションした「WB」の M ユニットは撃破される。 */
export function wingPentactUnitsToDestroy(state: GameState, endingPlayerId: PlayerId): string[] {
  return state.players[endingPlayerId].battle
    .filter((c) => hasBattleNcEffect(c, WING_PENTACT_COMBO_MARK))
    .map((c) => c.instanceId);
}
