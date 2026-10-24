import { canonicalCardName, getJointLNamedEffect } from "@rangers-strike/cards";
import { openOptionalEffectConfirm, registerOptionalEffect } from "../optionalEffects";
import { activeOnAttackNamedEffect } from "../ncGatedEffects";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { cardCategories, commandCategoriesOf, getDefinition, isSmallUnit, parsePowerCost } from "../../core/catalog";
import { getCostWindowMetadata } from "../../core/costWindow";
import { hasTurnRuleModifier } from "../../core/scopedModifiers";
import { findBattleAttacker, findInZone, opponent, updatePlayer } from "../../core/helpers";
import { TURN_RULE_IDS } from "../../types/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  startMultiCommandChoice,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { ComboOutcome } from "../comboTypes";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";

export function legend3AttackerBpBonus(
  state: GameState,
  pending: PendingBattle,
): number {
  const attackerCard = findBattleAttacker(
    state.players[pending.attackerPlayerId],
    pending.attackerInstanceId,
  );
  if (!attackerCard) return 0;
  const attacker = { card: attackerCard };

  const effect = activeOnAttackNamedEffect(attacker.card);
  let bonus = 0;
  if (effect?.effectId === "super_live_crush") bonus += 4000;
  if (effect?.effectId === "surging_chopper" && state.activePlayer === pending.attackerPlayerId) {
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
    if (defender && isSmallUnit(state.definitions, defender.card)) {
      bonus += 5000;
    }
  }

  // JC で得た BP+4000（RS-157 / RS-171）は常時の補正として legend3FieldBpBonus（effectiveBp）で数える。
  return bonus;
}

export function canAttackRushWithMoonlightSonic(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  const attacker = findInZone(
    state.players[attackerPlayerId],
    "battle",
    attackerInstanceId,
  );
  return (attacker ? activeOnAttackNamedEffect(attacker.card) : undefined)?.effectId === "moonlight_sonic";
}

export function legend3UsePrintedDefenderBp(
  state: GameState,
  pending: PendingBattle,
): boolean {
  const attacker = findInZone(
    state.players[pending.attackerPlayerId],
    "battle",
    pending.attackerInstanceId,
  );
  if (!attacker || !isSmallUnit(state.definitions, attacker.card)) return false;
  return hasTurnRuleModifier(
    state.players[pending.attackerPlayerId],
    TURN_RULE_IDS.SUPER_DYNAMITE,
  );
}

export function resolveLegend3EnterBattle(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  effectId: string,
  sourceInstanceId?: string,
): ComboOutcome {
  const enemyId = opponent(playerId);

  switch (effectId) {
    case "anti_bio_cannon": {
      const discarded =
        getCostWindowMetadata(state.players[playerId], "battle_entry_rush_discard")
          ?.discardedCardId;
      // 「捨札にしたのが「バイオハンター・シルバ」なら」— カード名で判定（PR-008 等の同名カードも含む。atwiki/page-40）。
      const discardedDef = discarded ? getDefinition(state.definitions, discarded) : undefined;
      if (!discardedDef || canonicalCardName(discardedDef.name) !== "バイオハンター・シルバ") {
        return { state, logs: [] };
      }
      const player = state.players[playerId];
      const battle = player.battle.map((c) =>
        c.cardId === cardId
          ? {
              ...c,
              spModifier: (c.spModifier ?? 0) + 1,
              bpModifier: (c.bpModifier ?? 0) + 5000,
            }
          : c,
      );
      return {
        state: { ...state, ...updatePlayer(state, playerId, { ...player, battle }) },
        logs: [
          buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId),
        ],
      };
    }
    case "fire_dance": {
      const damage = state.players[enemyId].power.filter((c) => c.faceDown).length;
      if (damage === 0) return { state, logs: [] };
      const held = collectCommandIds(state, enemyId, "released");
      if (held.length === 0) return { state, logs: [] };
      // 「敵軍コマンドを敵軍ダメージの数まで選んでホールドする」— 選ぶのはガオコングの持ち主で、
      // 「数まで」なので少なく選んで確定（confirm_effect_choice）してもよい（atwiki/page-93）。
      const withChoice = startMultiCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId: playerId,
        selectCount: Math.min(damage, held.length),
        commandFilter: "released",
        commandAction: "hold",
        validInstanceIds: held,
        optional: false,
      });
      return {
        state: withChoice ?? state,
        logs: withChoice
          ? [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)]
          : [],
      };
    }
    case "crown_final_crush": {
      // 「自軍コマンドをすべてリリース状態に戻してもよい」（atwiki/page-368）— 行うかを選ぶ。
      if (!state.players[playerId].command.some((c) => c.commandHeld)) return { state, logs: [] };
      const opened = openOptionalEffectConfirm(state, {
        playerId,
        effectId: CROWN_FINAL_CRUSH_EFFECT_ID,
        sourceCardId: cardId,
        sourceInstanceId,
        phasePlayerId: playerId,
      });
      return {
        state: { ...opened, pendingEffectChoice: { ...opened.pendingEffectChoice!, validInstanceIds: ["accept"] } },
        logs: [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)],
      };
    }
    case "hyper_civilization_guard": {
      if (state.activePlayer !== playerId) return { state, logs: [] };
      const player = state.players[playerId];
      const nextPlayer = {
        ...player,
        command: player.command.map((c) => ({ ...c, commandHeld: false })),
      };
      return {
        state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        logs: [
          buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId),
        ],
      };
    }
    case "steel_horn": {
      const maxBp = state.players[enemyId].power.filter((c) => c.faceDown).length;
      const targets = [
        ...state.players[enemyId].battle,
        ...state.players[enemyId].rush,
      ]
        .filter((c) => {
          const cost = getDefinition(state.definitions, c.cardId)?.powerCost ?? 99;
          const n = typeof cost === "number" ? cost : parsePowerCost(cost);
          return n <= maxBp;
        })
        .map((c) => c.instanceId)
        // ブレイカー・「相手に選ばれない」（XG7-009【受け継いだもの】等）の敵軍ユニットは選べない。
        .filter((id) => isSelectableByOpponentEffect(state, playerId, id, cardId));
      if (targets.length === 0) return { state, logs: [] };
      const withChoice = startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "discard",
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: withChoice
          ? [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)]
          : [],
      };
    }
    case "bio_particle_slash": {
      // RS-127 / PR-015【バイオ粒子斬り】自軍ターン中、これがバトルエリアに出るとき、「OT」の自軍コマンドを
      // 2つ選んでパワーゾーンに送ってもよい。そうしたとき、このターン、これは「SP2」「BP＋3000」。
      if (state.activePlayer !== playerId) return { state, logs: [] };
      // ピンクフラッシュ【プリズムブーツ】で「OT」になったホールド状態のコマンドも数える（faq-card-3 RS-127 Q1）。
      const otCommands = state.players[playerId].command
        .filter((c) => commandCategoriesNow(state, c).includes("OT"))
        .map((c) => c.instanceId);
      if (otCommands.length < 2) return { state, logs: [] };
      const withChoice = startMultiCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: cardId,
        sourceInstanceId,
        phasePlayerId: playerId,
        selectCount: 2,
        commandFilter: "any",
        commandAction: "power",
        validInstanceIds: otCommands,
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: withChoice
          ? [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)]
          : [],
      };
    }
    default:
      return { state, logs: [] };
  }
}

function collectCommandIds(
  state: GameState,
  playerId: PlayerId,
  filter: "held" | "released" | "any",
): string[] {
  return state.players[playerId].command
    .filter((c) => {
      if (filter === "held") return c.commandHeld;
      if (filter === "released") return !c.commandHeld;
      return true;
    })
    .map((c) => c.instanceId);
}

export function shouldRunConditionalOnEnter(effectId: string): boolean {
  return !["red_boot", "jet_skateboard", "falcon_claw", "sagas_sniper", "dark_deal"].includes(
    effectId,
  );
}

export function tryStartLegend3ConditionalChoice(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId = opponent(playerId);

  switch (effectId) {
    case "string_fist": {
      const targets = state.players[enemyId].battle.map((c) => c.instanceId);
      if (targets.length === 0) return null;
      return {
        ...state,
        pendingEffectChoice: {
          playerId,
          effectId,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          kind: "select_unit_step",
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "rush",
          step: "own",
          optional: true,
          selectCount: 1,
        },
        activePlayer: playerId,
      };
    }
    default:
      return null;
  }
}

export function isLegend3EnterBattleEffect(effectId: string): boolean {
  return [
    "fire_dance",
    "crown_final_crush",
    "hyper_civilization_guard",
    "steel_horn",
    "bio_particle_slash",
    "anti_bio_cannon",
  ].includes(effectId);
}

/**
 * コマンドゾーンのカードの現在のカテゴリ。RS-270 ピンクフラッシュ【プリズムブーツ】
 * 「このターン、自分と相手のコマンドゾーンにあるホールド状態のコマンドのカテゴリは、すべて「OT」になる」を反映する。
 */
export function commandCategoriesNow(state: GameState, card: CardInstance): string[] {
  const owner = (["player1", "player2"] as const).find((pid) => state.players[pid].command.some((c) => c.instanceId === card.instanceId));
  const def = getDefinition(state.definitions, card.cardId);
  // XG7-055〜XG7-059 の※など、コマンドゾーンで増えたカテゴリを含む（core/catalog.ts commandCategoriesOf）。
  const printed: string[] = owner ? commandCategoriesOf(state, owner, card.cardId) : def ? cardCategories(def) : [];
  if (!card.commandHeld) return printed;
  for (const pid of ["player1", "player2"] as const) {
    for (const category of ["OT", "ET", "MA", "WB", "DA"]) {
      if (hasTurnRuleModifier(state.players[pid], `rs_category_modify_all_held::${category}`)) {
        return [category];
      }
    }
  }
  return printed;
}

const CROWN_FINAL_CRUSH_EFFECT_ID = "crown_final_crush";

registerOptionalEffect(CROWN_FINAL_CRUSH_EFFECT_ID, {
  apply: (state, pending) => {
    const player = state.players[pending.playerId];
    return {
      ...state,
      ...updatePlayer(state, pending.playerId, {
        ...player,
        command: player.command.map((c) => ({ ...c, commandHeld: false })),
      }),
    };
  },
});
