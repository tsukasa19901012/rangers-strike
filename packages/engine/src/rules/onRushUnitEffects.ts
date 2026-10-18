import { openRk8JaguarOnEnemyRush } from "./rk/rk8UnitEffects";
import { rk1IsSmallNow } from "./rk/rk1Features";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { openProphecyOnEnemyRush } from "./legend1/set7NamedEffectsC";
import { openRk3OnEnemyRush } from "./rk/rk3UnitEffects";
import { trySet9COnUnitRushed } from "./legend1/set9NamedEffectsC";
import { applyGuardianApostleProviso } from "./legend1/set8NamedEffectsB";
import type { GameState, PlayerId } from "../types/game";
import { applySet7AOnRush } from "./legend1/set7NamedEffectsA";
import { openBioParticleOnEnemyRush } from "./legend1/set8NamedEffectsA";
import { findInZone } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { requestDrawFromDeck } from "./drawFromDeck";
import { getOnRushNamedEffect } from "@rangers-strike/cards";
import { resolveNamedOnRushEffects } from "./namedUnitEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import {
  applySuperRadarOnRush,
  resolveLegend3UnnamedRushEffects,
  superRadarAppliesOnRush,
} from "./legend3/rushEffects";
import { ON_RUSH_EFFECTS } from "./rushEffects";
import {
  resolveNoteOtherOnRushEffects,
  applyMotoSharianPowerTrigger,
} from "./noteOtherRushEffects";
import { tryFormationDeployOnRush } from "./formationDeploy";
import { tryDispatchOrderOnEnemyRush } from "./dispatchOrder";
import {
  applyBandoraHeldCommandDiscard,
  tryZubazubanOnAllyRush,
} from "./batch06FieldEffects";
import { tryOnAllyRushNamedReturnSelfToHand } from "./batch07FieldEffects";
import { tryRsCatchallOnEnemyRush } from "./rs/rsCatchallRuntime";
import { openEffectChoice, startSelectUnitChoice } from "./pendingChoices";
import { tryRideRaptorOnRush } from "./legend1/set4NamedEffects";
import { applyVrvMasterOnRush } from "./legend1/set5NamedEffectsA";

function applyDrawOnRush(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const result = requestDrawFromDeck(state, playerId, phasePlayerId, {
    count: 1,
    sourceCardId: cardId,
  });
  if (!result.pending && !result.drawn) {
    return { state: result.state, logs: [] };
  }
  return {
    state: result.state,
    logs: [
      buildLogEntry(playerId, "rush_effect", cardId, state.definitions, "draw_1"),
    ],
  };
}

export const HEAD_HELD_HIGH_EFFECT_ID = "rk154_head_held_high";

/**
 * RK-154 ジーク【頭が高い！】: これをラッシュしたとき、敵軍 S ユニットか M ユニットを1体選んでもよい（エリアを問わない。atwiki/page-679）。
 * S ユニットはこのターン BP500 になり、それより高い BP になる効果はすべて無効（R-BP-01: 指定値が最優先）。
 * M ユニットはこのターン S ユニットになる（CardInstance.sizeOverride。rules/rk/rk1Features.ts rk1IsSmallNow が見る）。解決は rules/pendingChoices.ts。
 */
function startHeadHeldHighChoice(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId: PlayerId = playerId === "player1" ? "player2" : "player1";
  const enemy = state.players[enemyId];
  const targets = [...enemy.rush, ...enemy.battle]
    .filter((c) => {
      const def = state.definitions[c.cardId];
      if (def?.type !== "unit") return false;
      if (!rk1IsSmallNow(state, c) && def.size !== "M") return false;
      return isSelectableByOpponentEffect(state, playerId, c.instanceId, "RK-154", playerId);
    })
    .map((c) => c.instanceId);
  return startSelectUnitChoice(state, {
    playerId,
    effectId: HEAD_HELD_HIGH_EFFECT_ID,
    sourceCardId: "RK-154",
    sourceInstanceId,
    phasePlayerId,
    validInstanceIds: targets,
    unitDestination: undefined,
    optional: true,
  });
}

/**
 * ユニットがフィールドに出たときの on_rush 効果。
 * 通常ラッシュとモーフ置換（wiki p1413: 置き換えでエリアに出ることはラッシュに含まれる）で共用。
 */
export function applyOnRushUnitEffects(
  state: GameState,
  ownerPlayerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
  zone: "rush" | "battle" = "rush",
  options: {
    suppressSelfEffects?: boolean;
    viaEffect?: boolean;
    /** RS-124 超電子レーダーと自身の「ラッシュしたとき」の処理順（ターンプレイヤーが選んだ結果）。 */
    rushTriggerOrder?: "super_radar_first" | "self_first";
    /** 「ラッシュされたとき」の誘発（RS-318）もここで処理する（「ラッシュされたとき」の窓を開かない置き換え用）。 */
    includePassiveRushTriggers?: boolean;
  } = {},
): { state: GameState; logs: string[] } {
  // ルール: R-RUSH-24 — 「このとき出したユニットの効果は発動しない」は、そのユニット自身の
  // 「ラッシュしたとき」の効果だけを止める（他のカードの「ラッシュしたとき」は発動する）。
  const suppressSelf = options.suppressSelfEffects === true;
  const owner = state.players[ownerPlayerId];
  const found = findInZone(owner, zone, instanceId);
  if (!found) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  // faq-card-2 RS-092 Q1 — 自身の「ラッシュしたとき」の効果と超電子レーダーが同時に発動したら、
  // ターンプレイヤーが望む順で処理する（R-SIM-01）。
  const radarApplies = superRadarAppliesOnRush(state, ownerPlayerId, instanceId);
  if (
    radarApplies &&
    !suppressSelf &&
    options.rushTriggerOrder === undefined &&
    getOnRushNamedEffect(found.card.cardId) &&
    !state.pendingEffectChoice
  ) {
    return {
      state: openEffectChoice(state, {
        playerId: phasePlayerId,
        effectId: "rush_trigger_order",
        sourceCardId: found.card.cardId,
        sourceInstanceId: instanceId,
        kind: "simultaneous_order",
        phasePlayerId,
        validInstanceIds: ["super_radar", instanceId],
        optional: false,
        rushTriggerOrderMeta: { ownerPlayerId, instanceId, zone, viaEffect: options.viaEffect },
      }),
      logs: [],
    };
  }
  if (options.rushTriggerOrder === "super_radar_first") {
    // 自身の効果を続けて処理するので、ここでは選択を開かない（先頭のオモテ向きカードを戻す）。
    const radarFirst = applySuperRadarOnRush(nextState, ownerPlayerId, instanceId, phasePlayerId, {
      allowChoice: false,
    });
    nextState = radarFirst.state;
    logs.push(...radarFirst.logs);
  }

  const onRush = suppressSelf ? undefined : ON_RUSH_EFFECTS[found.card.cardId];
  if (onRush === "draw_1") {
    const result = applyDrawOnRush(
      nextState,
      ownerPlayerId,
      found.card.cardId,
      phasePlayerId,
    );
    nextState = result.state;
    logs.push(...result.logs);
  }

  if (!suppressSelf) {
    const unnamedLegend3 = resolveLegend3UnnamedRushEffects(
      nextState,
      ownerPlayerId,
      instanceId,
    );
    nextState = unnamedLegend3.state;
    logs.push(...unnamedLegend3.logs);
  }

  // RS-124 超電子レーダーは applySuperRadarOnRush（下）で1回だけ処理する
  // （residentOps.applyRadarOnRush と二重に適用されてパワーが2枚戻っていた）。

  const dslRush = suppressSelf
    ? { state: nextState, logs: [] as string[], handled: true }
    : tryResolveDslTriggeredEffects({
        state: nextState,
        cardId: found.card.cardId,
        instanceId,
        playerId: ownerPlayerId,
        phasePlayerId,
        triggerType: "on_rush",
        logAction: "named_effect",
      });
  nextState = dslRush.state;
  logs.push(...dslRush.logs);
  // RS-547【守護獣の使徒】ただし書き: 「ラッシュしたとき」の効果を発動したら、そのユニットをホールドする
  // （rules/legend1/set8NamedEffectsB.ts）。
  if (!suppressSelf && zone === "rush") {
    nextState = applyGuardianApostleProviso(nextState, ownerPlayerId, instanceId, dslRush.handled && dslRush.logs.length > 0);
  }

  if (found.card.cardId === "RK-154" && !nextState.pendingEffectChoice) {
    const withChoice = startHeadHeldHighChoice(nextState, ownerPlayerId, instanceId, phasePlayerId);
    if (withChoice) nextState = withChoice;
  }

  if (!dslRush.handled) {
    const namedRush = resolveNamedOnRushEffects(
      nextState,
      ownerPlayerId,
      instanceId,
      phasePlayerId,
    );
    nextState = namedRush.state;
    logs.push(...namedRush.logs);
  }

  if (!nextState.pendingEffectChoice) {
    const allyReturn = tryOnAllyRushNamedReturnSelfToHand(
      nextState,
      ownerPlayerId,
      found.card.cardId,
      instanceId,
      phasePlayerId,
    );
    nextState = allyReturn.state;
    logs.push(...allyReturn.logs);
  }

  // RS-296 編隊出撃は「自軍コマンドをホールドして」ラッシュしたときだけ（効果ラッシュでは発動しない）。
  if (!nextState.pendingEffectChoice && !options.viaEffect) {
    const formation = tryFormationDeployOnRush(
      nextState,
      ownerPlayerId,
      instanceId,
      phasePlayerId,
    );
    nextState = formation.state;
    logs.push(...formation.logs);
  }
  // RS-180 ライドラプター（自軍コマンドをホールドして S ユニットをラッシュしたとき）。
  if (!nextState.pendingEffectChoice && !options.viaEffect) {
    nextState = tryRideRaptorOnRush(nextState, ownerPlayerId, instanceId, phasePlayerId);
  }
  // RS-299 VRVマスター【乗ってみないか？】: 自分が S ユニットをラッシュするたび。
  nextState = applyVrvMasterOnRush(nextState, ownerPlayerId, instanceId);

  const noteOther = resolveNoteOtherOnRushEffects(
    nextState,
    ownerPlayerId,
    instanceId,
    phasePlayerId,
    found.card.cardId,
  );
  nextState = noteOther.state;
  logs.push(...noteOther.logs);

  const motoSharian = applyMotoSharianPowerTrigger(
    nextState,
    ownerPlayerId,
    found.card.cardId,
  );
  nextState = motoSharian.state;
  logs.push(...motoSharian.logs);

  if (!nextState.pendingEffectChoice) {
    nextState = applyBandoraHeldCommandDiscard(
      nextState,
      ownerPlayerId,
      found.card.cardId,
      instanceId,
    );
  }
  if (!nextState.pendingEffectChoice) {
    nextState = tryZubazubanOnAllyRush(
      nextState,
      ownerPlayerId,
      instanceId,
      phasePlayerId,
    );
  }

  // 第7弾 RS-433 ネコマル（※常駐）等（rules/legend1/set7NamedEffectsA.ts）。
  if (!nextState.pendingEffectChoice) {
    nextState = applySet7AOnRush(nextState, ownerPlayerId, instanceId, phasePlayerId);
  }

  // RS-124 超電子レーダー（「ラッシュしたとき」。戻すパワーを持ち主が選ぶ選択を開くことがあるので最後に処理する）。
  if (options.rushTriggerOrder !== "super_radar_first") {
    const radar = applySuperRadarOnRush(nextState, ownerPlayerId, instanceId, phasePlayerId);
    nextState = radar.state;
    logs.push(...radar.logs);
  }

  // 「ラッシュされたとき」の誘発（RS-281 の撃破・RS-318 ドギー・クルーガー【出動指令】）。
  // ルール: R-TIME-01 — 「ラッシュされたとき」は「ラッシュしたとき」の効果（選択を含む）をすべて解決してから。
  // 通常のラッシュ・効果ラッシュでは「ラッシュされたとき」の窓を開くとき（events/emitUnitRushed.ts
  // openRushReactionWindows → applyPassiveRushTriggers）に処理する。ここで処理するのは窓を経由しない置き換え（モーフ）だけ。
  if (options.includePassiveRushTriggers && !nextState.pendingEffectChoice) {
    const passive = applyPassiveRushTriggers(nextState, ownerPlayerId, instanceId, phasePlayerId);
    nextState = passive.state;
    logs.push(...passive.logs);
  }

  return { state: nextState, logs };
}

/**
 * 「ラッシュされたとき」の誘発（R-TIME-01: 「ラッシュしたとき」の効果をすべて解決したあと）。
 * RS-281（ラッシュされたユニットを撃破する規則）→ RS-318【出動指令】（選択を開くことがある）。
 */
export function applyPassiveRushTriggers(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  // RS-656【オールスターアルティメットバスター】: 自軍ユニットをラッシュしたとき（rules/legend1/set9NamedEffectsC.ts）。
  state = trySet9COnUnitRushed(state, rusherPlayerId, rushedInstanceId, phasePlayerId);
  const rsEnemyRush = tryRsCatchallOnEnemyRush(state, rusherPlayerId, rushedInstanceId, phasePlayerId);
  let next = tryDispatchOrderOnEnemyRush(rsEnemyRush.state, rusherPlayerId, rushedInstanceId, phasePlayerId);
  // RS-490 三の槍マンマルバ幼体【予言】（rules/legend1/set7NamedEffectsC.ts）。
  next = openProphecyOnEnemyRush(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
  // RS-528 バイオハンター・シルバ（2nd）【バイオ粒子反応アリ！】（rules/legend1/set8NamedEffectsA.ts）。
  next = openBioParticleOnEnemyRush(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
  // RK-053 仮面ライダーガタックMF【ガタックバルカン】（rules/rk/rk3UnitEffects.ts）。
  next = openRk3OnEnemyRush(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
  // RK-160 シザーズジャガー【ナノロボット散布実験】（rules/rk/rk8UnitEffects.ts）。
  next = openRk8JaguarOnEnemyRush(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
  return { state: next, logs: rsEnemyRush.logs };
}
