import type { GameState, PlayerId } from "../types/game";
import { cardName, getDefinition, unitSizeOf } from "../core/catalog";
import { opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { applyDamageToPlayer } from "./damagePayment";
import { startSelectPowerChoice, startSelectUnitChoice } from "./pendingChoices";
import { releaseHeldSUnitCommands } from "./batch03RushEffects";
import type { NamedEffectOutcome } from "./namedUnitEffects";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";

/** on_rush note_other_* カードの個別効果実装。 */
export function resolveNoteOtherOnRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  cardId: string,
): NamedEffectOutcome {
  let nextState = state;
  const logs: string[] = [];

  // XG1-040 (虎折神): on rush → release all non-MA command cards
  if (cardId === "XG1-040") {
    const player = nextState.players[rusherPlayerId];
    let changed = false;
    const newCommand = player.command.map((c) => {
      const def = getDefinition(nextState.definitions, c.cardId);
      const cats = Array.isArray(def?.category)
        ? def.category
        : def?.category
          ? [def.category]
          : [];
      if (cats.includes("MA")) return c;
      if (c.commandHeld) {
        changed = true;
        return { ...c, commandHeld: false };
      }
      return c;
    });
    if (changed) {
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, rusherPlayerId, { ...player, command: newCommand }),
      };
      logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "release_non_ma_commands"));
    }
  }

  // XG1-036 (舵木折神): on rush → release all S-unit command cards
  if (cardId === "XG1-036") {
    const player = nextState.players[rusherPlayerId];
    let changed = false;
    const newCommand = player.command.map((c) => {
      const def = getDefinition(nextState.definitions, c.cardId);
      if (def?.type === "unit" && unitSizeOf(nextState.definitions, c) === "S" && c.commandHeld) {
        changed = true;
        return { ...c, commandHeld: false };
      }
      return c;
    });
    if (changed) {
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, rusherPlayerId, { ...player, command: newCommand }),
      };
      logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "release_s_units"));
    }
  }

  // RS-576 (マジフェニックス): on rush → may release all held S-unit commands (auto-yes)
  if (cardId === "RS-576") {
    nextState = releaseHeldSUnitCommands(nextState, rusherPlayerId);
    if (nextState !== state) {
      logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "release_held_s_units"));
    }
  }

  // XG1-026 (ヤミマル): on rush → if own damage ≤ 3, take 1 damage
  if (cardId === "XG1-026") {
    const player = nextState.players[rusherPlayerId];
    const damageCount = player.power.filter((c) => c.faceDown).length;
    if (damageCount <= 3) {
      nextState = applyDamageToPlayer(nextState, rusherPlayerId, 1, {
        kind: "none",
        activePlayer: nextState.activePlayer,
      });
      logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "yamimaru_self_damage"));
    }
  }

  // XG3-096 (ミミーナ) の※は rules/xg3/xg3eEffects.ts（xg3:: キーワード）。

  // XG6-044 (仮面ライダーNEW電王SF): on rush → may bring テディ from power to rush (auto-yes)
  if (cardId === "XG6-044") {
    const player = nextState.players[rusherPlayerId];
    const teddyInPower = player.power.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "テディ",
    );
    if (teddyInPower.length > 0) {
      const target = teddyInPower[0]!;
      const newPower = player.power.filter((c) => c.instanceId !== target.instanceId);
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, rusherPlayerId, {
          ...player,
          power: newPower,
          rush: [...player.rush, target],
        }),
      };
      logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "teddy_rush"));
    }
  }

  // RK-185 レッドドラス の※（ラッシュしたとき、特徴「仮面ライダー」の敵軍 S ユニットを選んで山札の下へ）は rules/rk/rk9UnitEffects.ts（rk9:: キーワード）。

  // RS-188 (アチャとコチャ): on rush → if power ≥ 7, discard face-up cards until 6 remain
  if (cardId === "RS-188") {
    const player = nextState.players[rusherPlayerId];
    const faceUpCount = player.power.filter((c) => !c.faceDown).length;
    const toDiscard = Math.min(faceUpCount, Math.max(0, player.power.length - 6));
    if (toDiscard > 0) {
      const withChoice = startSelectPowerChoice(nextState, {
        playerId: rusherPlayerId,
        effectId: "acha_kocha_power_discard",
        sourceCardId: cardId,
        sourceInstanceId: rushedInstanceId,
        phasePlayerId,
        selectCount: toDiscard,
        optional: false,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "acha_kocha_power_discard"));
      }
    }
  }

  // Gokai series: on rush → may swap with a matching face-up power S-unit (no rushAdditionalCondition)
  const gokaiFeatureMap: Record<string, string[]> = {
    "XG7-001": ["ピンク", "ホワイト"],
    "XG7-002": ["グリーン", "ブラック"],
    "XG7-003": ["レッド"],
    "XG7-004": ["ブルー"],
    "XG7-005": ["イエロー"],
  };
  if (gokaiFeatureMap[cardId]) {
    const features = gokaiFeatureMap[cardId]!;
    const selfName = cardName(nextState.definitions, cardId);
    const player = nextState.players[rusherPlayerId];
    const candidates = player.power.filter((c) => {
      if (c.faceDown) return false;
      if (cardName(nextState.definitions, c.cardId) === selfName) return false;
      const def = getDefinition(nextState.definitions, c.cardId);
      if (!def || def.type !== "unit" || unitSizeOf(nextState.definitions, c) !== "S") return false;
      if (resolveRushAdditionalCondition(c.cardId, def)) return false;
      return features.some((f) => def.features?.includes(f));
    });
    if (candidates.length > 0) {
      const target = candidates[0]!;
      const gokaiInstance = player.rush.find((c) => c.instanceId === rushedInstanceId);
      if (gokaiInstance) {
        const newPower = player.power
          .filter((c) => c.instanceId !== target.instanceId)
          .concat({ ...gokaiInstance, faceDown: false });
        const newRush = player.rush
          .filter((c) => c.instanceId !== rushedInstanceId)
          .concat(target);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, rusherPlayerId, {
            ...player,
            power: newPower,
            rush: newRush,
          }),
        };
        logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "gokai_swap"));
      }
    }
  }

  return { state: nextState, logs };
}

/** RM-028 (モトシャリアン): when 宇宙刑事 unit is rushed, may bring RM-028 from power to rush. */
export function applyMotoSharianPowerTrigger(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedCardId: string,
): { state: GameState; logs: string[] } {
  if (rushedCardId === "RM-028") return { state, logs: [] };

  const player = state.players[rusherPlayerId];
  const def = getDefinition(state.definitions, rushedCardId);
  if (!def?.features?.includes("宇宙刑事")) return { state, logs: [] };

  const motoInPower = player.power.find(
    (c) => c.cardId === "RM-028" && !c.faceDown,
  );
  if (!motoInPower) return { state, logs: [] };

  const newPower = player.power.filter((c) => c.instanceId !== motoInPower.instanceId);
  const nextState = {
    ...state,
    ...updatePlayer(state, rusherPlayerId, {
      ...player,
      power: newPower,
      rush: [...player.rush, motoInPower],
    }),
  };
  return {
    state: nextState,
    logs: [buildLogEntry(rusherPlayerId, "rush_effect", "RM-028", nextState.definitions, "moto_sharian_auto_rush")],
  };
}
