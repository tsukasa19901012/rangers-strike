import type { CardDefinition } from "@rangers-strike/cards";
import { falconBreakTriggers } from "./rs4NcEffects";
import {
  findNcNamedEffect,
  getNumberComboEffect,
  getOnAttackNamedEffect,
  IMPLEMENTED_NC_EFFECT_IDS,
} from "@rangers-strike/cards";
import {
  comboFromNamedPartner,
  isNcGatedOnAttackEffect,
  ncColumnEffectIdsEstablished,
} from "./ncGatedEffects";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  cardName,
  effectiveComboNumber,
  getDefinition,
  unitEffectiveCategories,
} from "../core/catalog";
import { crossReducedNumber, crossReductionFor } from "../keywords/battleKeywords";
import { attackerPodNumber } from "./legend1/set6NamedEffectsB";
import { gravityComboNumber, set7DBlocksNc } from "./legend1/set7NamedEffectsD";
import { markMissionBurningNoStrike, missionBurningForcesNc } from "./legend1/set8NamedEffectsD";
import { set8BComboNumberBonus } from "./legend1/set8NamedEffectsB";
import { applySuperBrainDraw } from "../effects/drawEffects";
import { buildLogEntry } from "../log/formatLog";
import { startRuinSurvey } from "./ruinSurvey";
import {
  tryStartBlowKnuckle,
  grantBpBoostToBattleUnit,
  grantSp1ToBattleUnit,
  markBattleNcEffect,
  tryStartGreenGroundChoice,
  tryStartMossBreakerChoice,
  tryStartPinkStormChoice,
  tryStartPitInDiveChoice,
  tryStartRadialHammerChoice,
} from "./namedUnitEffects";
import {
  findBattleUnit,
  grantBpBoostOnPlayer,
  grantSp1OnPlayer,
  patchPlayer,
} from "./playerPatches";
import { applyLegend2NcEffect, isLegend2NcEffect } from "./legend2/ncEffects";
import { applyLegend3NcEffect, isLegend3NcEffect } from "./legend3/ncEffects";
import { isDslInterpretableEffect, shouldUseDslTriggeredEffect } from "../dsl/dslCatalog";
import { listDslEffectsForTrigger } from "../dsl/effectLookup";
import { tryResolveDslNcEffects } from "../dsl/triggerResolver";
import { applyPromotedNcEffect, getPromotedNcEffectId } from "./promotedNcEffects";
import { tryApplyHoldToActivateNc } from "./holdToActivate";
import { isSet7ANcCard, trySet7ANumberCombo } from "./legend1/set7NamedEffectsA";
import { isSet8ANcCard, trySet8ANumberCombo } from "./legend1/set8NamedEffectsA";
import { set8NumberDelta } from "./legend1/set8TurnGrants";
import { trySet7BNcEffect } from "./legend1/set7NamedEffectsB";
import type { ComboOutcome } from "./comboTypes";

function ncLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "number_combo", cardId, definitions, detail);
}

/** NC 判定用のナンバー: ターン効果等で補正したうえで、左側のクロスで減らす（R-KW-CROSS-01）。 */
export function ncEffectiveNumber(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
): number {
  if (typeof definition.comboNumber !== "number") return -1;
  // RS-495【宇宙忍法・重力無秩序】: SP が空欄のユニットのナンバーは必要パワーの数字になる（rules/legend1/set7NamedEffectsD.ts）。
  // RS-522 ボウケンスピリッツ「このターン、選んだユニットのナンバーの数字は1増える。」（rules/legend1/set8TurnGrants.ts）。
  // RS-548 ※「このユニットのナンバーの数字は、ホールド状態のユニット1体につき1増える」（rules/legend1/set8NamedEffectsB.ts）。
  const printedNumber =
    (gravityComboNumber(state, card, definition) ?? definition.comboNumber) +
    set8NumberDelta(state.players[playerId], card) +
    set8BComboNumberBonus(state, definition);
  return crossReducedNumber(
    // RS-393 コマンドアタッカー【アタッカーポッド】: ライドされたままのコマンドアタッカーからコンビネーションする S ユニットは −3（最低2）。
    attackerPodNumber(
      state,
      playerId,
      card,
      effectiveComboNumber(state, playerId, printedNumber, card.cardId),
    ),
    crossReductionFor(state.players[playerId].battle, card.instanceId),
  );
}

/**
 * RS-263【弾幕タンクコマンドミサイル】: これが自軍ラッシュエリアにある間、リリース状態の自軍コマンドに
 * ナンバーを持つユニットカードがあれば、本来のナンバーがそれと同じ S ユニットは NC の効果を発動できない。
 * ルール: R-CN-05 — 参照するのは「カードに表記された本来のナンバー」（コロン等の補正は無関係。faq-card-1 RS-015 Q1）。
 */
function tankCommandBlocksNc(
  state: GameState,
  card: CardInstance,
  definition: CardDefinition,
): boolean {
  if (definition.size !== "S" || typeof definition.comboNumber !== "number") return false;
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    if (!player.rush.some((c) => c.cardId === "RS-263")) continue;
    const blocked = player.command.some((c) => {
      if (c.commandHeld) return false;
      const def = state.definitions[c.cardId];
      return def?.type === "unit" && def.comboNumber === definition.comboNumber;
    });
    if (blocked) return true;
  }
  return false;
}

/** 直前のユニット（左隣。バトルエリア）のカテゴリ（バトルエリアで追加されるカテゴリを含む）。 */
function neighborCategories(
  state: GameState,
  playerId: PlayerId,
  leftNeighbor: CardInstance | undefined,
): string[] | undefined {
  return leftNeighbor ? unitEffectiveCategories(state, playerId, leftNeighbor, "battle") : undefined;
}

export function numberComboTriggers(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): boolean {
  if (tankCommandBlocksNc(state, card, definition)) return false;
  // RS-495 でナンバー0になった・RS-497【変身の妨害】で効果名を持つテキストが無効（rules/legend1/set7NamedEffectsD.ts）。
  if (set7DBlocksNc(state, playerId, card, definition)) return false;
  // RS-600【ミッション1 バーニング】（rules/legend1/set8NamedEffectsD.ts）。
  if (missionBurningForcesNc(state, playerId, card, definition, battleBeforeEnter)) return true;
  // RS-204 レッドファルコン【ファルコンブレイク】: BP が一番低ければナンバーに関係なく発動する。
  if (falconBreakTriggers(state, playerId, card)) return true;
  const effectiveNumber = ncEffectiveNumber(state, playerId, card, definition);
  const position = battlePosition;

  if (
    findNcNamedEffect(
      card.cardId,
      position,
      effectiveNumber,
      battleBeforeEnter,
      card.instanceId,
    )
  ) {
    return true;
  }

  if (typeof definition.comboNumber === "number" && effectiveNumber === position) {
    if (getPromotedNcEffectId(card.cardId)) return true;
    if (ncEffectUsesDsl(card.cardId)) return true;
    // 第7弾 RS-441〜RS-449 の NC（rules/legend1/set7NamedEffectsA.ts）。
    if (isSet7ANcCard(card.cardId)) return true;
    // 第8弾 RS-530〜RS-537 の NC（rules/legend1/set8NamedEffectsA.ts）。
    if (isSet8ANcCard(card.cardId)) return true;
  }

  // 「（この効果は特徴「○○」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」の
  // DSL の NC 効果（RS-258 アオレンジャー【ブルーチェリー】等）: 直前のユニット（左隣）が指定どおりなら成立
  // （ルール: R-CN-05）。「特徴「獣」を持つユニットからコンビネーションするとき、…」のような条件文は対象外。
  if (
    ncEffectUsesDsl(card.cardId) &&
    (listDslEffectsForTrigger(card.cardId, "nc")[0]?.text ?? "").includes("ナンバーに関係なく")
  ) {
    const leftNeighbor = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
    if (
      ncColumnEffectIdsEstablished(state, card.cardId, false, leftNeighbor?.cardId, neighborCategories(state, playerId, leftNeighbor))
        .length > 0
    ) {
      return true;
    }
  }

  return false;
}

export function resolveNamedNcEffectId(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): ReturnType<typeof getNumberComboEffect> {
  const effectiveNumber = ncEffectiveNumber(state, playerId, card, definition);
  const named = findNcNamedEffect(
    card.cardId,
    battlePosition,
    effectiveNumber,
    battleBeforeEnter,
    card.instanceId,
  );
  if (named && getNumberComboEffect(card.cardId) === named.effectId) {
    return named.effectId as ReturnType<typeof getNumberComboEffect>;
  }
  return getNumberComboEffect(card.cardId);
}

/**
 * 「アタックするとき」の NC 効果（「…からコンビネーションするときは、ナンバーに関係なく発動する」— RS-032/RS-033 等）が
 * このバトルエリアへの進入で成立したかを判定し、成立したら activatedNcEffects に記録する。
 * ルール: R-CN-02（ナンバーと並び順の一致）、R-CN-05（直前のユニットからのコンビネーション）。
 */
export function markOnAttackNcEffectOnEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): GameState {
  let nextState = state;
  const named = getOnAttackNamedEffect(card.cardId);
  if (
    named &&
    isNcGatedOnAttackEffect(named, card.cardId) &&
    !tankCommandBlocksNc(state, card, definition) &&
    !set7DBlocksNc(state, playerId, card, definition)
  ) {
    const fromPosition = ncEffectiveNumber(state, playerId, card, definition) === battlePosition;
    const leftNeighbor = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
    const fromPartner = comboFromNamedPartner(state, named, leftNeighbor?.cardId, neighborCategories(state, playerId, leftNeighbor));
    if (fromPosition || fromPartner) {
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, named.effectId);
    }
  }
  return markNcColumnEffectsOnEnter(nextState, playerId, card, definition, battlePosition, battleBeforeEnter);
}

/**
 * バトルエリアに出たときに NC が成立したら、そのカードのナンバーの欄の効果をすべて activatedNcEffects に記録する。
 * 記録された効果だけが、後から参照される場面（BP 補正・撃破時・ターン終了時等）で有効になる
 * （ncGatedEffects.activeNamedEffect / namedEffectActive）。ルール: R-CN-02 / R-CN-03 / R-CN-05。
 */
export function markNcColumnEffectsOnEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (tankCommandBlocksNc(state, card, definition)) return state;
  if (set7DBlocksNc(state, playerId, card, definition)) return state;
  // RS-600【ミッション1 バーニング】: シルバーの次の CN4 の S ユニットは NC を発動し、このターンはストライクできない。
  const missionBurning = missionBurningForcesNc(state, playerId, card, definition, battleBeforeEnter);
  const numberMatches =
    missionBurning ||
    (typeof definition.comboNumber === "number" &&
      ncEffectiveNumber(state, playerId, card, definition) === battlePosition);
  const leftNeighbor = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  let nextState = missionBurning ? markMissionBurningNoStrike(state, playerId, card.instanceId) : state;
  for (const effectId of ncColumnEffectIdsEstablished(
    state,
    card.cardId,
    numberMatches,
    leftNeighbor?.cardId,
    neighborCategories(state, playerId, leftNeighbor),
  )) {
    nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
  }
  return nextState;
}

/**
 * NC の欄の効果か（※ で始まる名前のない常時の能力は、DSL で trigger が nc と付いていても NC の効果ではない。
 * 例: RS-454 ニンジャマン「※…オモテ向きのカード1枚につきBP+1000」と【ニンジャソード】「SP1」）。
 */
function isNcColumnDslEffect(effect: { name?: string; text?: string }): boolean {
  return !(effect.name === undefined && (effect.text ?? "").trimStart().startsWith("※"));
}

function ncEffectUsesDsl(cardId: string): boolean {
  const effects = listDslEffectsForTrigger(cardId, "nc").filter(isNcColumnDslEffect);
  if (effects.length !== 1) return false;
  const effect = effects[0]!;
  return shouldUseDslTriggeredEffect(cardId, effect, "nc");
}

/** NC 効果のうち DSL interpreter 未対応の選択 UX。 */
const LEGACY_NC_EFFECT_IDS = new Set<string>(IMPLEMENTED_NC_EFFECT_IDS);

export function applyNumberComboEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: ReturnType<typeof getNumberComboEffect>,
): ComboOutcome {
  // 第7弾 RS-441〜RS-449 の NC（rules/legend1/set7NamedEffectsA.ts）。
  const set7 = trySet7ANumberCombo(state, playerId, card);
  if (set7) return set7;
  // 第8弾 RS-530〜RS-537 の NC（rules/legend1/set8NamedEffectsA.ts）。
  const set8a = trySet8ANumberCombo(state, playerId, card);
  if (set8a) return set8a;
  // 第7弾 RS-453〜RS-473 のカード固有の NC 効果（rules/legend1/set7NamedEffectsB.ts）。
  const set7b = trySet7BNcEffect(state, playerId, card);
  if (set7b) return set7b;

  if (getPromotedNcEffectId(card.cardId)) {
    return applyPromotedNcEffect(state, playerId, card);
  }

  // 「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒…」は任意の起動（rules/holdToActivate.ts）。
  const holdActivate = tryApplyHoldToActivateNc(state, playerId, card);
  if (holdActivate) return holdActivate;

  if (ncEffectUsesDsl(card.cardId)) {
    const dslNc = tryResolveDslNcEffects({
      state,
      cardId: card.cardId,
      instanceId: card.instanceId,
      playerId,
      phasePlayerId: playerId,
      effectFilter: isNcColumnDslEffect,
    });
    if (dslNc.handled) {
      return { state: dslNc.state, logs: dslNc.logs };
    }
  }

  if (!effectId) return { state, logs: [] };

  // NC が成立した効果を記録する（「アタックするとき BP＋」等、後で判定する NC 効果の成立条件。R-CN-02）。
  const marked = markBattleNcEffect(state, playerId, card.instanceId, effectId);
  return applyLegacyNumberComboEffect(marked, playerId, card, effectId);
}

/** NC 効果のレガシー switch 本体（runtime 委譲用）。 */
export function applyLegacyNumberComboEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: NonNullable<ReturnType<typeof getNumberComboEffect>>,
): ComboOutcome {
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "grant_sp1": {
      nextState = patchPlayer(nextState, playerId, (player) =>
        grantSp1OnPlayer(player, card.instanceId, nextState.definitions),
      );
      logs.push(ncLog(playerId, card.cardId, state.definitions, "sp1"));
      break;
    }
    case "eagle_diving": {
      nextState = patchPlayer(nextState, playerId, (player) =>
        grantBpBoostOnPlayer(
          grantSp1OnPlayer(player, card.instanceId, nextState.definitions),
          card.instanceId,
          2000,
        ),
      );
      logs.push(ncLog(playerId, card.cardId, state.definitions, "eagle_diving"));
      break;
    }
    case "moss_breaker": {
      const withChoice = tryStartMossBreakerChoice(
        nextState,
        playerId,
        card.cardId,
        playerId,
      );
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "moss_breaker"));
      break;
    }
    case "ruin_survey": {
      const withPending = startRuinSurvey(nextState, playerId, card.cardId);
      if (withPending) {
        nextState = withPending;
        const top = nextState.players[playerId].deck[0]!;
        logs.push(
          ncLog(
            playerId,
            card.cardId,
            state.definitions,
            `ruin_survey:${cardName(state.definitions, top.cardId)}`,
          ),
        );
      }
      break;
    }
    case "pit_in_dive": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartPitInDiveChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "pit_in_dive"));
      break;
    }
    case "red_fire":
    case "bouken_javelin": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "focused_breakthrough": {
      // ルール: R-ERR-RS065 — 【一点突破】は NC 成立時だけ有効。撃破時の判定は resolveFocusedBreakthroughDamage。
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "yellow_thunder": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "future_sight": {
      const beforeDeck = nextState.players[playerId].deck;
      // ルール: R-START-04 — 効果による「ドロー」にも超電子頭脳が適用される（faq-card-1 RS-008 Q1）。
      const drawResult = applySuperBrainDraw(nextState, playerId, nextState.players[playerId], playerId);
      nextState = drawResult.state;
      const afterHand = nextState.players[playerId].hand;
      const drawnCard = afterHand[afterHand.length - 1];
      const drawnName =
        !drawResult.pending &&
        drawnCard &&
        beforeDeck.some((c) => c.instanceId === drawnCard.instanceId)
          ? cardName(state.definitions, drawnCard.cardId)
          : undefined;
      logs.push(
        ncLog(
          playerId,
          card.cardId,
          state.definitions,
          drawnName ? `future_sight:${drawnName}` : "future_sight",
        ),
      );
      break;
    }
    case "pink_storm": {
      const withChoice = tryStartPinkStormChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "pink_storm"));
      break;
    }
    case "green_ground": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartGreenGroundChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "green_ground"));
      break;
    }
    case "radial_hammer": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartRadialHammerChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "radial_hammer"));
      break;
    }
    case "blow_knuckle": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartBlowKnuckle(nextState, playerId, card.cardId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "blow_knuckle"));
      break;
    }
    case "magical_dragon_shoot": {
      nextState = grantBpBoostToBattleUnit(nextState, playerId, card.instanceId, 4000);
      logs.push(
        ncLog(playerId, card.cardId, state.definitions, "magical_dragon_shoot"),
      );
      break;
    }
    default: {
      if (effectId && isLegend3NcEffect(effectId)) {
        const legend3 = applyLegend3NcEffect(nextState, playerId, card, effectId);
        nextState = legend3.state;
        logs.push(...legend3.logs);
      } else if (effectId && isLegend2NcEffect(effectId)) {
        const legend2 = applyLegend2NcEffect(nextState, playerId, card, effectId);
        nextState = legend2.state;
        logs.push(...legend2.logs);
      }
      break;
    }
  }

  return { state: nextState, logs };
}

/** NC後の戦闘ユニットを読み取り（テストアサーション用）。 */
export function battleUnitAfterNc(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): CardInstance | undefined {
  return findBattleUnit(state.players[playerId], instanceId);
}
