import { hasUnnamedRule } from "@rangers-strike/cards";
import { hellSaturnGrantCount } from "../hellSaturn";
import { activeNamedEffect, namedEffectActive } from "../ncGatedEffects";
import { countJointLGrant, jointLGrantSpPlus, jointRGrantActive } from "../jointComboGrants";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import {
  effectiveBp,
  getDefinition,
  isMediumUnit,
  isSmallUnit,
  unitEffectiveCategories,
  spSetValueOf,
} from "../../core/catalog";
import { countReleasedCommands } from "../restrictions";
import { opponent } from "../../core/helpers";
import { promotedKeywordSpFloor } from "../../dsl/promotedKeywordBridge";
import { legend2EffectiveSp } from "../legend2/fieldEffects";
import { sameCardName } from "../../core/cardNames";
import { set5AEffectiveSp } from "../legend1/set5NamedEffectsA";
import { set6BEffectiveSp, turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { set7BEffectiveSp } from "../legend1/set7NamedEffectsB";
import { set7DEffectiveSp } from "../legend1/set7NamedEffectsD";
import {
  sr003DiscardDinoBpBonus,
  sr003SpFloor,
  srBigBatonSpFloor,
} from "../srEffects";

export function legend3FieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  let bonus = 0;
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def) return 0;

  if (activeNamedEffect(instance, "furious_shark_shot") ||
      activeNamedEffect(instance, "heaven_earth_animal_heart")) {
    const wbMCount = state.players[playerId].battle.filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.category === "WB" && isMediumUnit(state.definitions, c.cardId);
    }).length;
    bonus += wbMCount * 2000;
  }

  // 自軍ターン中の常時の BP 補正は "general"（effectiveBp）でだけ数える（アタック時に重ねて数えない）。
  // NC の効果は NC が成立していなければ有効にならない（R-CN-02、ncGatedEffects.namedEffectActive）。
  if (role === "general") {
    if (namedEffectActive(instance, "star_raiser") && state.activePlayer === playerId) {
      bonus += countReleasedCommands(state.players[playerId]) * 2000;
    }
    if (
      (instance.cardId === "SR-003" ||
        activeNamedEffect(instance, "ryu_geki_ken_ken")) &&
      state.activePlayer === playerId
    ) {
      bonus += sr003DiscardDinoBpBonus(state, playerId);
    }
    // RS-280 レッドホーク【ウィングガントレット】「SP1」自軍ターン中、これはBP＋2000される（NC。atwiki/page-468）。
    if (
      instance.cardId === "RS-280" &&
      instance.activatedNcEffects?.includes("uingugantoreto") &&
      state.activePlayer === playerId
    ) {
      bonus += 2000;
    }
    if (namedEffectActive(instance, "iron_broken") && state.activePlayer === playerId) {
      bonus += 3000;
    }
    if (namedEffectActive(instance, "blazing_fire") && state.activePlayer === playerId) {
      bonus += 2000;
    }
    // JC で得た能力「自軍ターン中、BP+4000され」（RS-157【悪鬼貫徹ネックスラスト】、RS-171【マキシマムペネトレーション】）。
    if (state.activePlayer === playerId) {
      bonus +=
        4000 *
        (countJointLGrant(instance, "oni_neck_last") + countJointLGrant(instance, "maximum_penetration"));
    }
  }

  if (role === "general" && state.activePlayer !== playerId) {
    const hasMoaLoader = state.players[playerId].rush.some(
      (c) => activeNamedEffect(c, "super_moa_cannon"),
    );
    if (
      hasMoaLoader &&
      instance.cardId !== "RS-147" &&
      isMediumUnit(state.definitions, instance.cardId) &&
      unitEffectiveCategories(state, playerId, instance, "battle").includes("MA")
    ) {
      bonus += 1000;
    }
  }

  return bonus;
}

export function isStealthUnit(state: GameState, instanceId: string): boolean {
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const zone of ["battle", "rush"] as const) {
      const found = player[zone].find((c) => c.instanceId === instanceId);
      if (found && activeNamedEffect(found, "stealth")) {
        return true;
      }
    }
  }
  return false;
}

function hasScorchingRoarOnField(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    if (
      player[zone].some((c) =>
        activeNamedEffect(c, "scorching_roar"),
      )
    ) {
      return true;
    }
  }
  return false;
}

/** RS-152 灼熱の咆哮: 場のガオライオンが WB M の※ホールド進入を無効化（捨札に同名あり）。 */
export function scorchingRoarBypassesHold(
  cardId: string,
  state: GameState,
  playerId: PlayerId,
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.category !== "WB" || !isMediumUnit(state.definitions, cardId)) return false;
  if (!hasScorchingRoarOnField(state, playerId)) return false;
  const unitName = def.name;
  return state.players[playerId].discard.some(
    (c) => sameCardName(getDefinition(state.definitions, c.cardId)?.name, unitName),
  );
}

export function legend3EnemySComboDelta(state: GameState, playerId: PlayerId): number {
  let delta = 0;
  const enemyId = playerId === "player1" ? "player2" : "player1";
  for (const card of state.players[enemyId].battle) {
    if (activeNamedEffect(card, "data_analysis")) {
      delta += 1;
    }
  }
  for (const card of state.players[enemyId].rush) {
    if (activeNamedEffect(card, "data_analysis")) {
      delta += 1;
    }
  }
  return delta;
}

/**
 * RS-158【エレファントシールド】: 発動していて、コンビネーションが成立している間（相手の L ユニットが左隣）、
 * 敵軍ユニットはこれ以外のユニットにアタックできない。アタックできるユニットの instanceId（なければ null）。
 */
export function elephantShieldMustTarget(
  state: GameState,
  defenderPlayerId: PlayerId,
): string | null {
  const player = state.players[defenderPlayerId];
  for (const card of player.battle) {
    if (jointRGrantActive(state, defenderPlayerId, card, "elephant_shield")) return card.instanceId;
  }
  return null;
}

/** RS-172【ショベルディフェンス】: 発動していてコンビネーションが成立している間、敵軍ユニットはストライクできない。 */
export function shovelDefenseBlocksStrike(state: GameState, strikerPlayerId: PlayerId): boolean {
  const enemyId = opponent(strikerPlayerId);
  return state.players[enemyId].battle.some((card) =>
    jointRGrantActive(state, enemyId, card, "shovel_defense"),
  );
}

export function cannotEnterBattleOwnTurn(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  // 反応（ファイブテクター等）の間は activePlayer が防御側に移るので、ターンプレイヤーで判定する（RS-429/RS-430）。
  if (turnPlayerOf(state) !== playerId) return false;
  return (
    hasUnnamedRule(cardId, "cannot_enter_battle_own_turn") ||
    hasUnnamedRule(cardId, "no_enter_battle_own_turn")
  );
}

/** RS-188【地球征服宣告書】の対象か（アチャとコチャが自軍エリアにあり、自軍パワーゾーン12枚以上、「メカ」の自軍 S ユニット）。 */
export function earthConquestDeclarationActive(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): boolean {
  const player = state.players[playerId];
  if (player.power.length < 12) return false;
  if (![...player.rush, ...player.battle].some((c) => c.cardId === "RS-188")) return false;
  if (!isSmallUnit(state.definitions, instance.cardId)) return false;
  return getDefinition(state.definitions, instance.cardId)?.features?.includes("メカ") ?? false;
}

/** RS-157 oni_neck_last: BP20000+ で自ターンにSP2付与。 */
export function legend3EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  let sp = legend2EffectiveSp(state, playerId, instance);
  // JC で得た能力「SP+N」（RS-224【ロックドバスター】）。
  sp += jointLGrantSpPlus(instance);
  // RS-188 アチャとコチャ【地球征服宣告書】: これが自軍エリアにある間、自軍パワーゾーンが12枚以上なら、
  // 特徴「メカ」を持つすべての自軍 S ユニットは「SP1」になる（atwiki/page-121）。
  if (earthConquestDeclarationActive(state, playerId, instance)) sp = Math.max(sp, 1);
  // RS-310 ゴウライビートル【カラクリ忍法・角変化】: BP8000以上のとき「SP1」になる（atwiki/page-480）。
  if (instance.cardId === "RS-310" && effectiveBp(state, playerId, instance) >= 8000) sp = Math.max(sp, 1);
  // RS-364 ヘルサターン総統【黒き太陽神への忠誠】: 効果を得た S ユニットは BP8000以上のとき「SP1」になる（faq-card-6 RS-364 Q1）。
  if (hellSaturnGrantCount(state, playerId, instance) > 0 && effectiveBp(state, playerId, instance) >= 8000) {
    sp = Math.max(sp, 1);
  }
  sp = set5AEffectiveSp(state, playerId, instance, sp);
  sp = set6BEffectiveSp(state, playerId, instance, sp);
  sp = set7BEffectiveSp(state, playerId, instance, sp);
  // 第7弾 RS-500【サイブレードカッター】等（rules/legend1/set7NamedEffectsD.ts）。
  sp = set7DEffectiveSp(state, playerId, instance, sp);
  if (state.activePlayer !== playerId) return sp;

  // JC で得た能力「自軍ターン中、…BP20000以上のとき「SP2」になる」（RS-157）。
  if (countJointLGrant(instance, "oni_neck_last") > 0) {
    const bp = effectiveBp(state, playerId, instance);
    if (bp >= 20000) {
      sp = Math.max(sp, 2);
    }
  }

  const promotedFloor = promotedKeywordSpFloor(state, playerId, instance);
  if (promotedFloor > 0) {
    sp = Math.max(sp, promotedFloor);
  }

  sp = Math.max(sp, sr003SpFloor(state, playerId, instance));
  sp = Math.max(sp, srBigBatonSpFloor(state, playerId, instance));

  // RS-382 ビクトリーロボ【人の命は地球の未来】: このターン自軍捨札から手札に加えた S ユニットのカード1枚につき SP+1。
  // ナンバーを持たないカードの効果で、NC の成立とは関係しない（atwiki/page-541）。
  if (instance.cardId === "RS-382") {
    sp += state.players[playerId].sUnitsRecoveredFromDiscardThisTurn ?? 0;
  }
  // RS-388 ゴーレッド（2nd）【ブイランサー】「SP1」（この効果は、このターン自軍捨札から S ユニットのカードを手札に加えていれば、
  // ナンバーに関係なく発動する）（atwiki/page-537）。
  if (instance.cardId === "RS-388" && (state.players[playerId].sUnitsRecoveredFromDiscardThisTurn ?? 0) > 0) {
    sp = Math.max(sp, 1);
  }

  // XG7-008: SP1 when in battle position 2 or 3 and own MA command present
  if (instance.cardId === "XG7-008") {
    const player = state.players[playerId];
    const battleIndex = player.battle.findIndex((c) => c.instanceId === instance.instanceId);
    if (battleIndex === 1 || battleIndex === 2) {
      const hasMACommand = player.command.some((c) => {
        const d = getDefinition(state.definitions, c.cardId);
        const cats = Array.isArray(d?.category) ? d.category : d?.category ? [d.category] : [];
        return cats.includes("MA");
      });
      if (hasMACommand) sp = Math.max(sp, 1);
    }
  }

  // RS-281: SP1 if own rush has 2+ 女-featured units
  // 【俺に惚れろ！】は CN：3 の NC の効果。NC が成立していなければ発動しない（atwiki/page-469・R-CN-02）。
  if (instance.cardId === "RS-281" && instance.activatedNcEffects?.includes("nirero")) {
    const femaleCount = state.players[playerId].rush.filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("女");
    }).length;
    if (femaleCount >= 2) sp = Math.max(sp, 1);
  }

  // RS-612: SP1 if own メカ command cards ≥ 4
  if (instance.cardId === "RS-612") {
    const mechaCommandCount = state.players[playerId].command.filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("メカ");
    }).length;
    if (mechaCommandCount >= 4) sp = Math.max(sp, 1);
  }

  // RK-184: SP1 when in held state (commandHeld=true in battle zone)
  if (instance.cardId === "RK-184" && instance.commandHeld) {
    sp = Math.max(sp, 1);
  }

  // RK-329: SP1 if all enemy units are S-units (no M or L)
  if (instance.cardId === "RK-329") {
    const enemyId = opponent(playerId);
    const enemyUnits = [...state.players[enemyId].rush, ...state.players[enemyId].battle];
    const allEnemyAreS = enemyUnits.length > 0 && enemyUnits.every((c) =>
      isSmallUnit(state.definitions, c.cardId),
    );
    if (allEnemyAreS) sp = Math.max(sp, 1);
  }

  // XG4-008: SP1 while riding (mountedOnInstanceId is set)
  if (instance.cardId === "XG4-008" && instance.mountedOnInstanceId) {
    sp = Math.max(sp, 1);
  }

  // 「SP○になる」（RS-001/RS-002 等）は加算・下限より優先して指定値にする。
  const setSp = spSetValueOf(state, playerId, instance);
  if (setSp !== undefined) return setSp;

  return sp;
}
