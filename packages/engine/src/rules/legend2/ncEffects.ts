import type { NumberComboEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import {
  effectiveBp,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
  unitBp,
} from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  applyConfirmEffectChoice,
  applyUnitLeave,
  collectCommandIds,
  openEffectChoice,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import {
  markBattleNcEffect,
  grantSp1ToBattleUnit,
} from "../namedUnitEffects";
import { addNextTurnRuleModifier, addTurnRuleModifier } from "../../core/scopedModifiers";
import { canBeDeployedToBattleByEffect } from "../restrictions";
import { TURN_RULE_IDS } from "../../types/scopedModifiers";
import type { ComboOutcome } from "../comboTypes";
import { recordReveal } from "../revealNotice";

function ncLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "number_combo", cardId, definitions, detail);
}

function powerCostNumber(definitions: GameState["definitions"], cardId: string): number {
  const def = getDefinition(definitions, cardId);
  const cost = def?.powerCost;
  return typeof cost === "number" ? cost : parsePowerCost(cost ?? 0);
}

function applyCompetition(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const p1 = state.players[playerId];
  const p2 = state.players[enemyId];
  if (p1.deck.length === 0 || p2.deck.length === 0) {
    return { state, logs: [ncLog(playerId, card.cardId, state.definitions, "competition:none")] };
  }

  const [c1, d1] = removeAt(p1.deck, 0);
  const [c2, d2] = removeAt(p2.deck, 0);
  const n1 = powerCostNumber(state.definitions, c1!.cardId);
  const n2 = powerCostNumber(state.definitions, c2!.cardId);

  let nextP1 = p1;
  let nextP2 = p2;
  if (n1 > n2) {
    nextP1 = { ...p1, deck: d1, hand: [...p1.hand, c1!] };
    nextP2 = { ...p2, deck: [...d2, c2!] };
  } else if (n2 > n1) {
    nextP2 = { ...p2, deck: d2, hand: [...p2.hand, c2!] };
    nextP1 = { ...p1, deck: [...d1, c1!] };
  } else {
    nextP1 = { ...p1, deck: [c1!, ...d1] };
    nextP2 = { ...p2, deck: [c2!, ...d2] };
  }

  // お互いにオモテにした1枚ずつは公開情報。大きい方は手札、小さい方は山札の下、同じなら山札の上。
  const dest = (mine: number, theirs: number) =>
    mine > theirs ? "hand" : mine < theirs ? "deck_bottom" : "deck_top";
  const revealedState = recordReveal(
    { ...state, players: { ...state.players, [playerId]: nextP1, [enemyId]: nextP2 } },
    {
      playerId,
      ownerId: playerId,
      sourceCardId: card.cardId,
      effectLabel: "競争",
      from: "deck_top",
      cards: [
        { instanceId: c1!.instanceId, cardId: c1!.cardId, destination: dest(n1, n2), ownerId: playerId },
        { instanceId: c2!.instanceId, cardId: c2!.cardId, destination: dest(n2, n1), ownerId: enemyId },
      ],
    },
  );
  return {
    state: revealedState,
    logs: [ncLog(playerId, card.cardId, state.definitions, "competition")],
  };
}

function applyRyuuGekiKen(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  // ルール: R-RES-05 — BP+1000×（ホールド状態の敵軍コマンド数）と「BP5000以上で SP1」は
  // 固定値ではなく常に再計算する（legend2FieldBpBonus / legend2EffectiveSp で参照）。
  return {
    state: markBattleNcEffect(state, playerId, card.instanceId, "ryuu_geki_ken"),
    logs: [ncLog(playerId, card.cardId, state.definitions, "ryuu_geki_ken")],
  };
}

function destroyAllEnemyAtBp(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  maxBp: number,
  effectId: string,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const destroyIds = new Set<string>();
  for (const zone of ["rush", "battle"] as const) {
    for (const unit of enemy[zone]) {
      if (unitBp(getDefinition(state.definitions, unit.cardId)) <= maxBp) {
        destroyIds.add(unit.instanceId);
      }
    }
  }
  if (destroyIds.size === 0) {
    return { state, logs: [ncLog(playerId, card.cardId, state.definitions, `${effectId}:none`)] };
  }

  // 撃破は離場パイプライン（applyUnitLeave）を通す。直接捨札に移すと「撃破されたとき」の効果
  // （RS-116 マンドラ坊や【鳴き声】等）が誘発しない（ルール: R-DESTROY-01、R-TIME-04）。
  // 複数体の撃破・離場反応での中断／再開は select_units_bp_budget の確定処理を共用する。
  if (state.pendingEffectChoice) {
    // 別の選択が開いているときは、残りを順に撃破する（中断・再開の仕組みは使えない）。
    let next = state;
    for (const id of destroyIds) {
      const leave = applyUnitLeave(next, id, "discard", playerId);
      if (!("error" in leave)) next = leave.state;
    }
    return { state: next, logs: [ncLog(playerId, card.cardId, state.definitions, effectId)] };
  }
  const opened = openEffectChoice(state, {
    playerId,
    effectId,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId: playerId,
    kind: "select_units_bp_budget",
    validInstanceIds: [...destroyIds],
    selectedInstanceIds: [...destroyIds],
    optional: false,
  });
  const confirmed = applyConfirmEffectChoice(opened, playerId);
  if ("error" in confirmed) {
    return { state, logs: [ncLog(playerId, card.cardId, state.definitions, `${effectId}:none`)] };
  }
  return {
    state: confirmed.state,
    logs: [ncLog(playerId, card.cardId, state.definitions, effectId)],
  };
}

/** RS-108【グリーンクラッシュ】で出せる敵軍ラッシュエリアの S ユニット。 */
export function greenCrushTargets(state: GameState, enemyId: PlayerId): string[] {
  return state.players[enemyId].rush
    .filter((c) => isSmallUnit(state.definitions, c))
    .filter((c) => canBeDeployedToBattleByEffect(state, enemyId, c))
    .map((c) => c.instanceId);
}

export function applyLegend2NcEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: NumberComboEffectId,
): ComboOutcome {
  const enemyId = opponent(playerId);

  switch (effectId) {
    case "competition":
      return applyCompetition(state, playerId, card);
    case "ryuu_geki_ken":
      return applyRyuuGekiKen(state, playerId, card);
    case "tricera_lance": {
      const targets = collectCommandIds(state, enemyId, "released");
      const withChoice = startSelectCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        commandFilter: "released",
        commandAction: "hold",
        validInstanceIds: targets,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "tricera_lance")],
      };
    }
    case "ptera_arrow": {
      const targets = collectCommandIds(state, enemyId, "held");
      const withChoice = startSelectCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        commandFilter: "held",
        commandAction: "discard",
        validInstanceIds: targets,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "ptera_arrow")],
      };
    }
    case "life_rescue": {
      const targets = state.players[playerId].discard
        .filter((c) => isSmallUnit(state.definitions, c))
        .map((c) => c.instanceId);
      const withChoice = startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "hand_from_discard",
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "life_rescue")],
      };
    }
    case "super_ninpo_water_transform": {
      // 出典: atwiki/page-319 — 「Sユニットを1体選んで手札に戻す」。バトルエリアに出られるかは関係しない
      // （マンドラ坊やなど出られない S ユニットも戻す対象）。
      const targets = state.players[enemyId].rush
        .filter((c) => isSmallUnit(state.definitions, c))
        .map((c) => c.instanceId);
      const withChoice = startSelectUnitChoice(state, {
        playerId: enemyId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "hand",
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "super_ninpo_water_transform")],
      };
    }
    case "dark_dual_blade": {
      const enemy = state.players[enemyId];
      const powerTargets = enemy.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
      const commandTargets = collectCommandIds(state, enemyId, "any");
      // 公式Q&A（faq-card-2 RS-102 Q1）: どちらか一方のゾーンにしか選べるカードが無ければ発動できない
      // （「そうしたとき、選んだ2枚を捨札にする」— 2枚とも選べたときだけ捨札にする）。
      if (powerTargets.length === 0 || commandTargets.length === 0) {
        return { state, logs: [ncLog(playerId, card.cardId, state.definitions, "dark_dual_blade:none")] };
      }
      const withChoice = startSelectCommandChoice(state, {
        playerId,
        effectId: "dark_dual_blade",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        commandFilter: "any",
        commandAction: "discard",
        validInstanceIds: powerTargets,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "dark_dual_blade")],
      };
    }
    case "space_ninpo_rope_skull":
      return destroyAllEnemyAtBp(state, playerId, card, 3000, "space_ninpo_rope_skull");
    case "green_crush": {
      // 出典: atwiki/page-307「Sユニットを2体まで選んで…（出す順番は自分が選ぶ）」— 候補は敵軍ラッシュエリアの
      // S ユニットすべて。1体ずつ選んで出し、2体目は rules/pendingChoices.ts（continueGreenCrush）で続けて選ぶ。
      const targets = greenCrushTargets(state, enemyId);
      const withChoice = startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "enemy_battle",
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "green_crush")],
      };
    }
    case "backup_request": {
      let nextState = grantSp1ToBattleUnit(state, playerId, card.instanceId);
      const targets = nextState.players[playerId].power
        .filter((c) => !c.faceDown && isSmallUnit(state.definitions, c))
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId,
          effectId,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          phasePlayerId: playerId,
          validInstanceIds: targets,
          unitDestination: "hand_from_power",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      return {
        state: nextState,
        logs: [ncLog(playerId, card.cardId, state.definitions, "backup_request")],
      };
    }
    case "zenibomb": {
      // ルール: R-RES-07 — 「次の相手ターン」の効果。デカピンクが撃破されても有効。
      // 「次の相手ターン、新しくラッシュエリアに出たユニットは…バトルエリアに出られない」。
      // レッドレーサーの「ラッシュするとき可能ならバトルエリアに置く」は直接バトルエリアへのラッシュで対象外
      // （atwiki/page-308 Q2「（2010/10/25修正）」。rules/restrictions.ts の zenibombBlocksBattleEntry）。
      const enemy = addNextTurnRuleModifier(state.players[enemyId], TURN_RULE_IDS.ZENIBOMB, {
        sourceCardId: card.cardId,
      });
      return {
        state: { ...state, ...updatePlayer(state, enemyId, enemy) },
        logs: [ncLog(playerId, card.cardId, state.definitions, "zenibomb")],
      };
    }
    case "deace_sniper": {
      const enemy = addTurnRuleModifier(state.players[enemyId], TURN_RULE_IDS.DEACE_SNIPER, {
        sourceCardId: card.cardId,
      });
      return {
        state: { ...state, ...updatePlayer(state, enemyId, enemy) },
        logs: [ncLog(playerId, card.cardId, state.definitions, "deace_sniper")],
      };
    }
    case "super_ninpo_lion_dance": {
      // ルール: R-ATK-05 — 「アタックするかわりに」発動する効果。CN を満たしてバトルエリアに出ても自動では
      // 発動せず、発動できる状態になるだけ。バトルフェイズにプレイヤーが選ぶ
      // （use_juu_kun_do アクション、rules/juuKunDo.ts の applyLionDance）。
      const owner = state.players[playerId];
      const battle = owner.battle.map((c) =>
        c.instanceId === card.instanceId
          ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), "super_ninpo_lion_dance"] }
          : c,
      );
      return {
        state: { ...state, ...updatePlayer(state, playerId, { ...owner, battle }) },
        logs: [ncLog(playerId, card.cardId, state.definitions, "super_ninpo_lion_dance:available")],
      };
    }
    default:
      return { state, logs: [] };
  }
}

export function isLegend2NcEffect(effectId: string): boolean {
  return [
    "competition",
    "ryuu_geki_ken",
    "tricera_lance",
    "ptera_arrow",
    "life_rescue",
    "super_ninpo_lion_dance",
    "super_ninpo_water_transform",
    "dark_dual_blade",
    "space_ninpo_rope_skull",
    "deace_sniper",
    "green_crush",
    "backup_request",
    "zenibomb",
  ].includes(effectId);
}
