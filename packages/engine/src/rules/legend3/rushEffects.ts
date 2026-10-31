import { openDeckLook } from "../deckLook";
import { getUnitEffectBlock, hasUnnamedRule } from "@rangers-strike/cards";
import type { GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit, unitSizeOf } from "../../core/catalog";
import { crossReductionFor } from "../../keywords/battleKeywords";
import {
  battlePositionOneBased,
  printedSpBase,
  resolveInstanceSpValue,
} from "../fractionalSp";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  openEffectChoice,
  startDeckJointComboSearch,
  startSelectPowerChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { NamedEffectOutcome } from "../namedUnitEffects";
import { closeWithDeckOrder, deckOrderChoice, openDeckOrderAfter } from "../deckOrder";

function rushPowerDiscardCount(cardId: string): number {
  const block = getUnitEffectBlock(cardId);
  const note = block?.unnamedText.find((u) => u.rule === "rush_power_to_discard");
  return note?.discardCount ?? 1;
}

function applyRushPowerToDiscard(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  rushedInstanceId: string,
  discardCount: number,
): NamedEffectOutcome {
  const player = state.players[playerId];
  const faceUp = player.power.filter((c) => !c.faceDown);
  if (faceUp.length === 0) return { state, logs: [] };

  const withChoice = startSelectPowerChoice(state, {
    playerId,
    effectId: "rush_power_to_discard",
    sourceCardId: cardId,
    sourceInstanceId: rushedInstanceId,
    phasePlayerId: playerId,
    selectCount: Math.min(discardCount, faceUp.length),
    optional: false,
  });
  if (!withChoice) return { state, logs: [] };

  return {
    state: withChoice,
    logs: [
      buildLogEntry(playerId, "rush_effect", cardId, state.definitions, "power_to_discard"),
    ],
  };
}

export function resolveLegend3UnnamedRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): NamedEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found || !hasUnnamedRule(found.card.cardId, "rush_power_to_discard")) {
    return { state, logs: [] };
  }
  return applyRushPowerToDiscard(
    state,
    rusherPlayerId,
    found.card.cardId,
    rushedInstanceId,
    rushPowerDiscardCount(found.card.cardId),
  );
}

export function isSuperRadarActive(state: GameState): boolean {
  return ["player1", "player2"].some((pid) =>
    state.players[pid as PlayerId].operation.some((c) => c.cardId === "RS-124"),
  );
}

/** RS-124: Sラッシュ → 所有者がダメージ以外のパワーカード1枚を手札へ戻す。 */
/** RS-124 超電子レーダーがこのラッシュで実際に処理されるか（S ユニットで、ダメージ以外のパワーがある）。 */
export function superRadarAppliesOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): boolean {
  if (!isSuperRadarActive(state)) return false;
  const rusher = state.players[rusherPlayerId];
  const found = findRushedUnit(rusher, rushedInstanceId);
  if (!found || !isSmallUnit(state.definitions, found.card)) return false;
  return rusher.power.some((c) => !c.faceDown);
}

/**
 * ラッシュしたユニット（ラッシュエリア、またはラッシュエリアを経ずに直接バトルエリアに出たもの）。
 * faq-card-3 RS-124 Q1/Q3 — 捨札・敵軍コマンドゾーンから直接バトルエリアに出した S ユニットもラッシュに含む。
 */
function findRushedUnit(player: GameState["players"][PlayerId], instanceId: string) {
  return findInZone(player, "rush", instanceId) ?? findInZone(player, "battle", instanceId);
}

export const SUBMERGE_EFFECT_ID = "submerge";

/** RS-137【潜航】: 選んだ捨札のユニットを山札の下に置き、3枚未満なら続けて選ばせる。 */
export function resolveSubmergePick(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | null {
  const player = state.players[pending.playerId];
  const found = findInZone(player, "discard", instanceId);
  if (!found) return null;
  const [card, discard] = removeAt(player.discard, found.index);
  const next: GameState = {
    ...state,
    ...updatePlayer(state, pending.playerId, { ...player, discard, deck: [...player.deck, card!] }),
  };
  const processed = [...(pending.processedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter(
    (id) => id !== instanceId && next.players[pending.playerId].discard.some((c) => c.instanceId === id),
  );
  if (processed.length >= 3 || remaining.length === 0) return closeWithDeckOrder(next, pending, processed);
  return {
    ...next,
    pendingEffectChoice: { ...pending, validInstanceIds: remaining, processedInstanceIds: processed },
  };
}

export const SUPER_RADAR_RETURN_EFFECT_ID = "super_radar_return";

export function applySuperRadarOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId = state.activePlayer,
  options: { allowChoice?: boolean } = {},
): NamedEffectOutcome {
  if (!isSuperRadarActive(state)) return { state, logs: [] };

  const rusher = state.players[rusherPlayerId];
  const found = findRushedUnit(rusher, rushedInstanceId);
  if (!found || !isSmallUnit(state.definitions, found.card)) {
    return { state, logs: [] };
  }

  const faceUpIndex = rusher.power.findIndex((c) => !c.faceDown);
  if (faceUpIndex < 0) return { state, logs: [] };

  // atwiki/page-362「1枚選んで手札に戻す」— 選ぶのはユニットの持ち主。
  // 候補が2枚以上あり、ほかの選択が開いていなければ選ばせる（開いていれば先頭を戻す）。
  const faceUpIds = rusher.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (faceUpIds.length > 1 && options.allowChoice !== false && !state.pendingEffectChoice) {
    const withChoice = startSelectUnitChoice(state, {
      playerId: rusherPlayerId,
      effectId: SUPER_RADAR_RETURN_EFFECT_ID,
      sourceCardId: "RS-124",
      phasePlayerId,
      validInstanceIds: faceUpIds,
      unitDestination: "hand_from_power",
      optional: false,
    });
    if (withChoice) {
      return {
        state: withChoice,
        logs: [
          buildLogEntry(
            rusherPlayerId,
            "rush_effect",
            "RS-124",
            state.definitions,
            "super_radar_power_to_hand",
          ),
        ],
      };
    }
  }

  const [card, restPower] = removeAt(rusher.power, faceUpIndex);
  const nextPlayer = {
    ...rusher,
    power: restPower,
    hand: [...rusher.hand, card!],
  };

  return {
    state: { ...state, ...updatePlayer(state, rusherPlayerId, nextPlayer) },
    logs: [
      buildLogEntry(
        rusherPlayerId,
        "rush_effect",
        "RS-124",
        state.definitions,
        "super_radar_power_to_hand",
      ),
    ],
  };
}

export function resolveLegend3OnRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  cardId: string,
  effectId: string,
): NamedEffectOutcome {
  const enemyId = opponent(rusherPlayerId);
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "great_assault": {
      // 「敵軍Lユニット」— バトルエリア・ラッシュエリアの L ユニット（atwiki/page-342）。
      const targets = collectFieldUnitIds(nextState, enemyId, Number.MAX_SAFE_INTEGER, [
        "battle",
        "rush",
      ]).filter((id) => {
        const inst =
          nextState.players[enemyId].battle.find((c) => c.instanceId === id) ??
          nextState.players[enemyId].rush.find((c) => c.instanceId === id);
        if (!inst) return false;
        return unitSizeOf(nextState.definitions, inst) === "L";
      });
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "discard",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    case "airlift": {
      const withChoice = startDeckJointComboSearch(nextState, {
        playerId: rusherPlayerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId,
        optional: true,
      });
      // 選べるカードがなくても山札を見る窓を開く（rules/deckLook.ts）。
      nextState = withChoice ?? openDeckLook(nextState, { playerId: rusherPlayerId, phasePlayerId }, cardId);
      break;
    }
    case "assault": {
      const targets = collectFieldUnitIds(nextState, enemyId, 8000, ["battle"]);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "enemy_command",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    case "submerge": {
      const rusher = nextState.players[rusherPlayerId];
      // 「ユニットのカードを3枚まで選んで、山札の下に好きな順で戻してもよい」（atwiki/page-352）。
      // 1枚ずつ選んで山札の下へ置き、選び終えたら（見送ったときも）2枚以上なら番号を付けて順を選ぶ（rules/deckOrder.ts）。
      const units = rusher.discard
        .filter((c) => getDefinition(nextState.definitions, c.cardId)?.type === "unit")
        .map((c) => c.instanceId);
      if (units.length > 0 && !nextState.pendingEffectChoice) {
        nextState = openEffectChoice(nextState, {
          playerId: rusherPlayerId,
          effectId: SUBMERGE_EFFECT_ID,
          sourceCardId: cardId,
          sourceInstanceId: rushedInstanceId,
          kind: "select_unit",
          phasePlayerId,
          validInstanceIds: units,
          selectCount: 1,
          processedInstanceIds: [],
          optional: true,
          pickThenDeckOrder: "bottom",
        });
      }
      break;
    }
    case "taurus_dive": {
      const enemy = nextState.players[enemyId];
      const toReturn = [...enemy.battle, ...enemy.rush].filter((c) => {
        if (!isSmallUnit(nextState.definitions, c)) return false;
        const def = getDefinition(nextState.definitions, c.cardId);
        const spValue = resolveInstanceSpValue(def, c);
        const inBattle = enemy.battle.some((u) => u.instanceId === c.instanceId);
        // 「SP！」はラッシュエリアでも戻す（atwiki/page-369「敵軍Sユニット」）。
        if (spValue === "special") return true;
        if (!inBattle) {
          // ラッシュエリアでは「SP1」以上の整数表記だけ（分数表記はラッシュエリアにある間は SP を得ない。faq-card-3 RS-144 Q1）。
          return typeof spValue === "number" && spValue + (c.spModifier ?? 0) >= 1;
        }
        const position = battlePositionOneBased(enemy.battle, c.instanceId);
        const sp =
          (c.spModifier ?? 0) +
          printedSpBase(spValue, position, crossReductionFor(enemy.battle, c.instanceId));
        return sp >= 1;
      });
      if (toReturn.length > 0) {
        const returnIds = new Set(toReturn.map((c) => c.instanceId));
        const nextEnemy = {
          ...enemy,
          battle: enemy.battle.filter((c) => !returnIds.has(c.instanceId)),
          rush: enemy.rush.filter((c) => !returnIds.has(c.instanceId)),
          hand: [...enemy.hand, ...toReturn],
        };
        nextState = { ...nextState, ...updatePlayer(nextState, enemyId, nextEnemy) };
      }
      break;
    }
    case "earth_resource_absorb": {
      const rusher = nextState.players[rusherPlayerId];
      const released = rusher.command.filter((c) => !c.commandHeld);
      if (released.length > 0) {
        const nextPlayer = {
          ...rusher,
          command: rusher.command.filter((c) => c.commandHeld),
          deck: [...released.reverse(), ...rusher.deck],
        };
        nextState = { ...nextState, ...updatePlayer(nextState, rusherPlayerId, nextPlayer) };
        // 「好きな順で」: 2枚以上なら番号を付けて山札の上の順を選ぶ（rules/deckOrder.ts。1番が一番上）。
        nextState = openDeckOrderAfter(
          nextState,
          deckOrderChoice(
            nextState,
            { playerId: rusherPlayerId, phasePlayerId, sourceCardId: cardId, sourceInstanceId: rushedInstanceId },
            released.map((c) => c.instanceId),
            "top",
          ),
        );
      }
      break;
    }
    case "nature_big_bang_final": {
      const targets = collectFieldUnitIds(nextState, enemyId, 20000, ["battle", "rush"]);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "discard",
          // 「1体選んで撃破する」— 対象がいれば強制（atwiki/page-348）。
          optional: false,
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    default:
      break;
  }

  if (nextState.pendingEffectChoice && nextState !== state && logs.length === 0) {
    logs.push(
      buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, `choice:${effectId}`),
    );
  } else if (nextState !== state && logs.length === 0) {
    logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, state.definitions, effectId));
  }

  return { state: nextState, logs };
}

export function isLegend3OnRushEffect(effectId: string): boolean {
  return [
    "great_assault",
    "airlift",
    "assault",
    "submerge",
    "taurus_dive",
    "earth_resource_absorb",
    "nature_big_bang_final",
  ].includes(effectId);
}
