import type { CardInstance, GameState, PlayerId, TurnEndProgress } from "../types/game";
import { applySet6TurnEnd } from "./legend1/set6AuditFixes";
import { collectSet6BTurnEndQueue, openSet6BTurnEndEntry } from "./legend1/set6NamedEffectsB";
import { collectSet7CTurnEndQueue, openSet7CTurnEndEntry } from "./legend1/set7NamedEffectsC";
import { applyDarkLawTurnEnd } from "./legend1/set5NamedEffectsA";
import { applyChangePowerTurnEnd, hedrianBeautyCount, openHedrianBeautyChoice } from "./legend1/set6NamedEffects348";
import { activeNamedEffect } from "./ncGatedEffects";
import { effectiveBp, getDefinition } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { bounceToHand } from "./bounce";
import { applyOnTurnEndBattleEffects } from "./legend2/destroyEffects";
import { hasEndPhaseBlockingPending } from "./legend3/endTurnEffects";
import { collectTurnEndResidentQueue, resolveTurnEndResident } from "./residentOperation";
import { applyRocketBoosterEndTurnRushReturn } from "./rocketBooster";
import { applyKeywordTurnEndEffects, clearEnemyTurnDamageFlag } from "./keywordGapRuntime";
import { applyGegeruTurnEnd } from "./residentOps";
import { applyTempDiscardAtTurnEnd } from "./riderKickEffects";
import {
  applyDragonHarleyTurnEnd,
  applyElectroBeamTurnEnd,
  applyOrochiTurnEnd,
} from "./errataCardEffects";
import { applyUnitLeave } from "./pendingChoices";
import { wingPentactUnitsToDestroy } from "./namedUnitEffects";

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function findUnitInField(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { zone: "rush" | "battle"; index: number; card: CardInstance } | null {
  const player = state.players[playerId];
  const inRush = findInZone(player, "rush", instanceId);
  if (inRush) return { zone: "rush", index: inRush.index, card: inRush.card };
  const inBattle = findInZone(player, "battle", instanceId);
  if (inBattle) return { zone: "battle", index: inBattle.index, card: inBattle.card };
  return null;
}

function returnUnitToDeckShuffle(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const found = findUnitInField(state, playerId, instanceId);
  if (!found) return state;
  const player = state.players[playerId];
  const [, zoneAfter] = removeAt(player[found.zone], found.index);
  const newDeck = shuffleDeck([...player.deck, found.card]);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      [found.zone]: zoneAfter,
      deck: newDeck,
    }),
  };
}

function destroyUnitToDiscard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const found = findUnitInField(state, playerId, instanceId);
  if (!found) return state;
  const player = state.players[playerId];
  const [, zoneAfter] = removeAt(player[found.zone], found.index);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      [found.zone]: zoneAfter,
      discard: [...player.discard, found.card],
    }),
  };
}

function isVehicleUnit(state: GameState, cardId: string): boolean {
  return !!getDefinition(state.definitions, cardId)?.features?.includes("車両");
}

/** RS-216 エグゾスの※: 自分がターンを終えるとき、特徴「車両」を持つ自軍ユニットがなければ山札に戻してシャッフルする。 */
function applyExodusTurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  let nextState = state;
  const units = () => [...nextState.players[endingPlayerId].rush, ...nextState.players[endingPlayerId].battle];
  for (const card of units()) {
    if (card.cardId !== "RS-216") continue;
    if (!findUnitInField(nextState, endingPlayerId, card.instanceId)) continue;
    const hasVehicleUnit = units().some(
      (c) => c.instanceId !== card.instanceId && isVehicleUnit(nextState, c.cardId),
    );
    if (!hasVehicleUnit) {
      nextState = returnUnitToDeckShuffle(nextState, endingPlayerId, card.instanceId);
    }
  }
  return nextState;
}

/** RS-310【カラクリ忍法・角変化】でこのターン終了時に撃破されるユニットか。 */
function kakuhengeWillDestroy(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return !!activeNamedEffect(card, "karakuri_ninpo_tsuno") && effectiveBp(state, playerId, card) >= 8000;
}

export const TURN_END_EXODUS_ORDER_EFFECT_ID = "turn_end_exodus_order";

/**
 * ルール: R-SIM-01 / faq-card-5 RS-310 — エグゾスの※とゴウライビートルの撃破は同時に発動するので、処理順はターンプレイヤーが選ぶ。
 * 順番で結果が変わる（撃破される車両しか残っていない）ときだけ選択を開く。
 */
function exodusOrderChoice(state: GameState, endingPlayerId: PlayerId): GameState | null {
  const player = state.players[endingPlayerId];
  const units = [...player.rush, ...player.battle];
  const exodus = units.find((c) => c.cardId === "RS-216");
  if (!exodus) return null;
  const vehicles = units.filter((c) => c.instanceId !== exodus.instanceId && isVehicleUnit(state, c.cardId));
  if (vehicles.length === 0) return null;
  const surviving = vehicles.filter((c) => !kakuhengeWillDestroy(state, endingPlayerId, c));
  if (surviving.length > 0) return null;
  const beetle = vehicles[0]!;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: endingPlayerId,
      effectId: TURN_END_EXODUS_ORDER_EFFECT_ID,
      sourceCardId: "engine",
      kind: "select_unit",
      phasePlayerId: endingPlayerId,
      validInstanceIds: [exodus.instanceId, beetle.instanceId],
      selectedInstanceIds: [],
      optional: false,
    },
    activePlayer: endingPlayerId,
  };
}

/** 処理順の選択を確定する（先に処理するユニットを選ぶ）。 */
export function resolveTurnEndExodusOrder(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const pending = state.pendingEffectChoice;
  const progress = state.turnEndProgress;
  if (!pending || pending.effectId !== TURN_END_EXODUS_ORDER_EFFECT_ID || !progress) return null;
  if (pending.playerId !== playerId || !pending.validInstanceIds.includes(instanceId)) return null;
  const chosen = findUnitInField(state, playerId, instanceId);
  return {
    ...state,
    pendingEffectChoice: undefined,
    turnEndProgress: { ...progress, exodusFirst: chosen?.card.cardId === "RS-216" },
  };
}

/** note_other_* nc ターン終了時効果を適用する。 */
function applyNoteOtherNcTurnEndEffects(
  state: GameState,
  endingPlayerId: PlayerId,
  skipExodus = false,
): GameState {
  let nextState = state;
  const player = () => nextState.players[endingPlayerId];
  const enemyId = opponent(endingPlayerId);

  const allUnits = () => [...player().rush, ...player().battle];

  for (const card of [...allUnits()]) {
    // Check card still in field each iteration (previous effects may have moved cards)
    if (!findUnitInField(nextState, endingPlayerId, card.instanceId)) continue;

    // RS-216: if no own 車両-featured unit, return to deck and shuffle
    if (card.cardId === "RS-216" && !skipExodus) {
      nextState = applyExodusTurnEnd(nextState, endingPlayerId);
    }

    // RS-281: if no own 女-featured unit, return to hand
    if (card.cardId === "RS-281") {
      const hasFemalUnit = allUnits().some((c) => {
        if (c.instanceId === card.instanceId) return false;
        const d = getDefinition(nextState.definitions, c.cardId);
        return d?.features?.includes("女");
      });
      if (!hasFemalUnit) {
        const bounced = bounceToHand(nextState, {
          playerId: endingPlayerId,
          instanceId: card.instanceId,
          fromZone: findUnitInField(nextState, endingPlayerId, card.instanceId)?.zone ?? "rush",
        });
        if (bounced.bounced) nextState = bounced.state;
      }
    }

    // XG2-101: if released → hold; if held → return to deck and shuffle
    if (card.cardId === "XG2-101") {
      if (card.commandHeld) {
        nextState = returnUnitToDeckShuffle(nextState, endingPlayerId, card.instanceId);
      } else {
        const loc = findUnitInField(nextState, endingPlayerId, card.instanceId);
        if (loc) {
          const p = nextState.players[endingPlayerId];
          const zone = [...p[loc.zone]];
          zone[loc.index] = { ...zone[loc.index]!, commandHeld: true };
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, endingPlayerId, { ...p, [loc.zone]: zone }),
          };
        }
      }
    }

    // XG4-007: if own discard ≥ 5, destroy this
    if (card.cardId === "XG4-007") {
      const p = nextState.players[endingPlayerId];
      if (p.discard.length >= 5) {
        nextState = destroyUnitToDiscard(nextState, endingPlayerId, card.instanceId);
      }
    }
  }

  return nextState;
}

/**
 * RS-310 ゴウライビートル【カラクリ忍法・角変化】: 自分か相手がターンを終えるとき BP8000 以上なら撃破。
 * ルール: R-END-01 — 「ターンを終えるとき」はまだターン中なので「このターン」の修正込みで判定する（faq-card-5 RS-310 Q1）。
 */
function applyKakuhengeTurnEndDestroy(state: GameState): GameState {
  let nextState = state;
  for (const pid of ["player1", "player2"] as const) {
    const units = [...nextState.players[pid].rush, ...nextState.players[pid].battle];
    for (const card of units) {
      if (!activeNamedEffect(card, "karakuri_ninpo_tsuno")) continue;
      if (effectiveBp(nextState, pid, card) < 8000) continue;
      nextState = destroyUnitToDiscard(nextState, pid, card.instanceId);
    }
  }
  return nextState;
}

function turnEndBlocked(state: GameState): boolean {
  return !!state.winner || hasEndPhaseBlockingPending(state);
}

/**
 * TurnEnding リスナー本体: 「ターンを終えるとき」の常駐・バトル効果。
 * ルール: R-END-01 — まだ終えるプレイヤーのターン中に処理する。選択が開いたら進捗を
 * `turnEndProgress` に残して止まり、選択の解決後に同じ関数で再開する。
 */
export function resolveTurnEndingEffectsImpl(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  let progress: TurnEndProgress =
    state.turnEndProgress?.endingPlayerId === endingPlayerId
      ? state.turnEndProgress
      : {
          endingPlayerId,
          residentQueue: collectTurnEndResidentQueue(state, endingPlayerId),
          restDone: false,
        };
  let nextState = state;
  const save = (s: GameState, logs: string[] = []) => ({
    state: { ...s, turnEndProgress: progress },
    logs,
  });

  while (progress.residentQueue.length > 0) {
    if (turnEndBlocked(nextState)) return save(nextState);
    const [entry, ...rest] = progress.residentQueue;
    progress = { ...progress, residentQueue: rest };
    nextState = resolveTurnEndResident(nextState, entry!, endingPlayerId);
  }
  if (turnEndBlocked(nextState) || progress.restDone) return save(nextState);
  // RS-398【時間漂流者の送還】・RS-413【もの言わぬ石と化せ】（rules/legend1/set6NamedEffectsB.ts）。
  if (!progress.set6bQueue) progress = { ...progress, set6bQueue: collectSet6BTurnEndQueue(nextState, endingPlayerId) };
  while ((progress.set6bQueue ?? []).length > 0) {
    const [entry, ...rest] = progress.set6bQueue!;
    progress = { ...progress, set6bQueue: rest };
    nextState = openSet6BTurnEndEntry(nextState, endingPlayerId, entry!);
    if (turnEndBlocked(nextState)) return save(nextState);
  }
  // RS-484【ハリーアップ！】（rules/legend1/set7NamedEffectsC.ts）。
  if (!progress.set7cQueue) progress = { ...progress, set7cQueue: collectSet7CTurnEndQueue(nextState, endingPlayerId) };
  while ((progress.set7cQueue ?? []).length > 0) {
    const [entry, ...rest] = progress.set7cQueue!;
    progress = { ...progress, set7cQueue: rest };
    nextState = openSet7CTurnEndEntry(nextState, endingPlayerId, entry!);
    if (turnEndBlocked(nextState)) return save(nextState);
  }
  if (!progress.exodusOrderAsked) {
    progress = { ...progress, exodusOrderAsked: true };
    const ask = exodusOrderChoice(nextState, endingPlayerId);
    if (ask) return save(ask);
  }
  // RS-360 ヘドリアン女王【宇宙で一番美しいのは誰？】: 敵軍ラッシュエリアの女王1体につき「女」の自軍ユニットを1体選び撃破する。
  if (progress.hedrianLeft === undefined) progress = { ...progress, hedrianLeft: hedrianBeautyCount(nextState, endingPlayerId) };
  while ((progress.hedrianLeft ?? 0) > 0) {
    progress = { ...progress, hedrianLeft: (progress.hedrianLeft ?? 0) - 1 };
    const ask = openHedrianBeautyChoice(nextState, endingPlayerId);
    if (ask) return save(ask);
  }
  progress = { ...progress, restDone: true };

  const exodusFirst = progress.exodusFirst === true;
  if (exodusFirst) nextState = applyExodusTurnEnd(nextState, endingPlayerId);
  nextState = applyOnTurnEndBattleEffects(nextState, endingPlayerId);
  nextState = applyKakuhengeTurnEndDestroy(nextState);
  // RS-372 X1マスク【チェンジパワー】: 自分がターンを終えるとき BP8000 以上なら撃破される。
  nextState = applyChangePowerTurnEnd(nextState, endingPlayerId);
  nextState = applyRocketBoosterEndTurnRushReturn(nextState, endingPlayerId);
  nextState = applyNoteOtherNcTurnEndEffects(nextState, endingPlayerId, exodusFirst);
  nextState = applyGegeruTurnEnd(nextState, endingPlayerId);
  // RS-256 闇の戒律: 重ねたカードが3枚あれば自軍ユニットをすべて撃破し、これを捨札にする。
  nextState = applyDarkLawTurnEnd(nextState, endingPlayerId);
  nextState = applyTempDiscardAtTurnEnd(nextState, endingPlayerId);
  nextState = applyElectroBeamTurnEnd(nextState, endingPlayerId);
  nextState = applyOrochiTurnEnd(nextState, endingPlayerId);
  nextState = applyDragonHarleyTurnEnd(nextState, endingPlayerId);
  // RS-234【ウイングペンタクト】: アバレキラーからコンビネーションした「WB」の M ユニットは撃破される。
  for (const id of wingPentactUnitsToDestroy(nextState, endingPlayerId)) {
    const leave = applyUnitLeave(nextState, id, "discard", endingPlayerId);
    if (!("error" in leave)) nextState = leave.state;
  }
  const keywordEnd = applyKeywordTurnEndEffects(nextState, endingPlayerId);
  nextState = clearEnemyTurnDamageFlag(keywordEnd.state, endingPlayerId);
  // RS-371【マスキーリボン】の後半（相手が手札のユニットカードをラッシュエリアに出す。rules/legend1/set6AuditFixes.ts）。
  nextState = applySet6TurnEnd(nextState, endingPlayerId);
  return save(nextState, keywordEnd.logs);
}
