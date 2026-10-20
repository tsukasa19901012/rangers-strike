/**
 * RS-259 モモレンジャー【ゴレンジャーハリケーン】
 * 「このターン、このユニットから「キレンジャー，ミドレンジャー，アオレンジャー，アカレンジャー」の順に
 * コンビネーションしたとき、BP8000以下の敵軍ユニットをすべて撃破する。このとき、その「アカレンジャー」は「SP2」になる。」
 *
 * アカレンジャーがバトルエリアに出たとき、バトルエリアの並び（出た順）がモモレンジャーから
 * キレンジャー→ミドレンジャー→アオレンジャー→アカレンジャーと続いていれば成立する。
 * アカレンジャー自身の NC（【レッドビュート】）とは関係なく「SP2」になる（faq-card-3 RS-126 Q1）。
 *
 * 出典: atwiki（RS-259）、grnrngr/faq-card-3 RS-126 Q1。
 */
import { canonicalCardName } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition } from "../../core/catalog";
import { opponent, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";

export const GORENGER_HURRICANE_EFFECT_ID = "gorenger_hurricane";

const CHAIN = ["キレンジャー", "ミドレンジャー", "アオレンジャー", "アカレンジャー"];

function nameOf(state: GameState, card: CardInstance): string {
  const def = getDefinition(state.definitions, card.cardId);
  return def ? canonicalCardName(def.name) : "";
}

function hasHurricane(state: GameState, card: CardInstance): boolean {
  return (getDefinition(state.definitions, card.cardId)?.text ?? "").includes("【ゴレンジャーハリケーン】");
}

/** 出たアカレンジャーで【ゴレンジャーハリケーン】が成立するか（並びの末尾がこのアカレンジャー）。 */
export function gorengerHurricaneApplies(
  state: GameState,
  playerId: PlayerId,
  enteredInstanceId: string,
): boolean {
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === enteredInstanceId);
  if (index < CHAIN.length) return false;
  const momo = battle[index - CHAIN.length]!;
  if (!hasHurricane(state, momo)) return false;
  return CHAIN.every((name, i) => nameOf(state, battle[index - CHAIN.length + 1 + i]!) === name);
}

/** 成立していれば、アカレンジャーを「SP2」にして BP8000 以下の敵軍ユニットをすべて撃破する。 */
export function applyGorengerHurricaneOnEnter(
  state: GameState,
  playerId: PlayerId,
  enteredInstanceId: string,
): { state: GameState; logs: string[] } {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return { state, logs: [] };
  if (!gorengerHurricaneApplies(state, playerId, enteredInstanceId)) return { state, logs: [] };

  const player = state.players[playerId];
  const battle = player.battle;
  const momo = battle[battle.findIndex((c) => c.instanceId === enteredInstanceId) - CHAIN.length]!;
  let next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle: battle.map((c) => (c.instanceId === enteredInstanceId ? { ...c, spOverride: 2 } : c)),
    }),
  };
  const logs = [
    buildLogEntry(playerId, "named_effect", momo.cardId, state.definitions, GORENGER_HURRICANE_EFFECT_ID),
  ];

  const enemyId = opponent(playerId);
  const enemy = next.players[enemyId];
  const targets = [...enemy.rush, ...enemy.battle]
    .filter((c) => getDefinition(next.definitions, c.cardId)?.type === "unit")
    .filter((c) => effectiveBp(next, enemyId, c) <= 8000)
    .map((c) => c.instanceId);
  if (targets.length === 0) return { state: next, logs };

  // 撃破は離場パイプラインを通す（複数体の撃破・離場反応での中断／再開は select_units_bp_budget の確定処理を共用）。
  if (next.pendingEffectChoice) {
    for (const id of targets) {
      const leave = applyUnitLeave(next, id, "discard", playerId);
      if (!("error" in leave)) next = leave.state;
    }
    return { state: next, logs };
  }
  const opened = openEffectChoice(next, {
    playerId,
    effectId: GORENGER_HURRICANE_EFFECT_ID,
    sourceCardId: momo.cardId,
    sourceInstanceId: momo.instanceId,
    phasePlayerId: playerId,
    kind: "select_units_bp_budget",
    validInstanceIds: targets,
    selectedInstanceIds: targets,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
  });
  const confirmed = applyConfirmEffectChoice(opened, playerId);
  if ("error" in confirmed) return { state: next, logs };
  return { state: confirmed.state, logs };
}
