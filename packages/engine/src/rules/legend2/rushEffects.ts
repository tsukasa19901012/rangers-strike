import { releasedCommandUnitIds, startEffectRush } from "../effectRush";
import type { GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { applyDamageToPlayer } from "../damagePayment";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { NamedEffectOutcome } from "../namedUnitEffects";
import { startDismantling, startFirefighting } from "./damageCardEffects";

/** Legend2 ラッシュ時効果ハンドラ。 */
export function resolveLegend2OnRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  cardId: string,
  effectId: string,
): NamedEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return { state, logs: [] };

  const enemyId = opponent(rusherPlayerId);
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "rescue_activity": {
      const targets = rusher.discard
        .filter((c) => getDefinition(state.definitions, c.cardId)?.features?.includes("メカ"))
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "hand_from_discard",
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    case "sure_win_combination": {
      nextState = applyDamageToPlayer(state, enemyId, 2, {
        kind: "none",
        activePlayer: rusherPlayerId,
      });
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "firefighting": {
      // ルール: R-RES-02 — テキストの順に「自分がダメージ1枚をオモテにしてもよい」→「そうしたとき、相手も同じようにしてもよい」。
      // ルール: R-RES-06 — 「そうしたとき」以降は条件ではないので、相手にダメージがなくても自分の分は行える。
      // 自分・相手とも「してもよい」なので、それぞれ選択（skip で行わない）にする（rules/legend2/damageCardEffects.ts）。
      nextState = startFirefighting(nextState, rusherPlayerId, cardId, phasePlayerId);
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "dismantling": {
      // 「手札に加えてもよい。そうしたとき、手札から1枚選んで…ウラ向きに置く」（rules/legend2/damageCardEffects.ts）。
      nextState = startDismantling(nextState, rusherPlayerId, cardId, phasePlayerId);
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "heavenly_disaster": {
      for (const pid of [rusherPlayerId, enemyId] as const) {
        const player = nextState.players[pid];
        const toDiscard = player.power.filter((c) => !c.faceDown);
        const faceDown = player.power.filter((c) => c.faceDown);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pid, {
            ...player,
            // 「手札をすべてパワーゾーンに置く」— ダメージ（ウラ向き）ではなくオモテ向きのパワー（R-ZONE-07）。
            power: [...faceDown, ...player.hand.map((c) => ({ ...c, faceDown: false }))],
            discard: [...player.discard, ...toDiscard],
            hand: [],
          }),
        };
      }
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "karakuri_great_tsunami": {
      const targets = collectFieldUnitIds(nextState, enemyId, 3000, ["rush", "battle"]);
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: rusherPlayerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId,
        validInstanceIds: targets,
        unitDestination: "hand",
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case "air_transport": {
      // ルール: R-RUSH-21 — 「ただしラッシュのための必要パワーと追加条件は満たすこと」。
      // ルール: R-RUSH-22 — 出したMユニットにも「ラッシュしたとき」誘発と窓がある。
      nextState = startEffectRush(nextState, {
        playerId: rusherPlayerId,
        phasePlayerId,
        effectId,
        sourceCardId: cardId,
        fromZone: "command",
        candidates: releasedCommandUnitIds(nextState, rusherPlayerId, "M"),
        maxCount: 1,
        requireConditions: true,
        alwaysAsk: true,
      });
      break;
    }
  }

  if (nextState.pendingEffectChoice && nextState !== state && logs.length === 0) {
    logs.push(
      buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, `choice:${effectId}`),
    );
  }

  return { state: nextState, logs };
}
