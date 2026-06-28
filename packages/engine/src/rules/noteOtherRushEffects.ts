import type { GameState, PlayerId } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { applyDamageToPlayer } from "./damagePayment";
import { startSelectCommandChoice, startSelectUnitChoice } from "./pendingChoices";
import type { NamedEffectOutcome } from "./namedUnitEffects";

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
      if (def?.type === "unit" && def.size === "S" && c.commandHeld) {
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
    const player = nextState.players[rusherPlayerId];
    let changed = false;
    const newCommand = player.command.map((c) => {
      const def = getDefinition(nextState.definitions, c.cardId);
      if (def?.type === "unit" && def.size === "S" && c.commandHeld) {
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

  // XG3-096 (ミミーナ): on rush → select 1 released own S-unit (not ミミーナ) and hold it
  if (cardId === "XG3-096") {
    const player = nextState.players[rusherPlayerId];
    const validIds = player.command
      .filter((c) => {
        if (c.commandHeld) return false;
        const def = getDefinition(nextState.definitions, c.cardId);
        return (
          def?.type === "unit" &&
          def.size === "S" &&
          cardName(nextState.definitions, c.cardId) !== "ミミーナ"
        );
      })
      .map((c) => c.instanceId);
    if (validIds.length > 0) {
      const withChoice = startSelectCommandChoice(nextState, {
        playerId: rusherPlayerId,
        effectId: "mimina_hold",
        sourceCardId: cardId,
        phasePlayerId,
        commandFilter: "released",
        commandAction: "hold",
        validInstanceIds: validIds,
        optional: false,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "mimina_hold"));
      }
    }
  }

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

  // RK-185 (レッドドラス): on rush → send 1 enemy 仮面ライダー S-unit to deck bottom
  if (cardId === "RK-185") {
    const enemyId = opponent(rusherPlayerId);
    const enemy = nextState.players[enemyId];
    const targets = [...enemy.rush, ...enemy.battle].filter((c) => {
      const def = getDefinition(nextState.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S" && def.features?.includes("仮面ライダー");
    });
    if (targets.length > 0) {
      // Auto-pick first target and send to deck bottom
      const target = targets[0]!;
      const fromZone = enemy.rush.some((c) => c.instanceId === target.instanceId)
        ? "rush"
        : "battle";
      const [, newZone] = removeAt(
        fromZone === "rush" ? enemy.rush : enemy.battle,
        (fromZone === "rush" ? enemy.rush : enemy.battle).findIndex(
          (c) => c.instanceId === target.instanceId,
        ),
      );
      const updatedEnemy =
        fromZone === "rush"
          ? { ...enemy, rush: newZone, deck: [target, ...enemy.deck] }
          : { ...enemy, battle: newZone, deck: [target, ...enemy.deck] };
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, enemyId, updatedEnemy),
      };
      logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, nextState.definitions, "red_dorace_deck_bottom"));
    }
  }

  return { state: nextState, logs };
}
