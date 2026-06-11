import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, instanceBp, isSmallUnit } from "../core/catalog";
import { findInZone } from "../core/helpers";
import { lastBattleProtectsOtherS } from "../rules/promotedNcEffects";
import { getCardDslDocument } from "./effectLookup";

/** rematch 不可の D/E 区分キーワード（grant_keyword マーカー）。 */
export const ENGINE_NATIVE_KEYWORDS = new Set([
  "morph",
  "resident",
  "wing",
  "chase",
  "register",
  "commander",
  "mothership",
  "ride_bp_boost_500",
  "ride_bp_boost_1000",
]);

const ENGINE_NATIVE_PREFIXES = [
  "ride_without_rc_",
  "ride_command_without_rc_",
] as const;

export function isEngineNativeGrantKeyword(keyword: string): boolean {
  if (ENGINE_NATIVE_KEYWORDS.has(keyword)) return true;
  return ENGINE_NATIVE_PREFIXES.some((prefix) => keyword.startsWith(prefix));
}

function featureSlug(feature: string): string {
  const ascii = feature
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return ascii;
  return `named_${Buffer.from(feature, "utf8").toString("hex").slice(0, 12)}`;
}

function unitHasFeatureSlug(def: CardDefinition | undefined, slug: string): boolean {
  if (!def?.features) return false;
  return def.features.some((f) => featureSlug(f) === slug);
}

export function listCardGrantKeywords(cardId: string): string[] {
  const doc = getCardDslDocument(cardId);
  if (!doc?.effects) return [];
  const keywords = new Set<string>();
  for (const effect of doc.effects) {
    for (const primitive of effect.effects) {
      if (primitive.type === "grant_keyword") {
        keywords.add(primitive.keyword);
      }
    }
  }
  return [...keywords];
}

export function cardHasGrantKeyword(cardId: string, keyword: string): boolean {
  return listCardGrantKeywords(cardId).includes(keyword);
}

function quickBpForAttackCheck(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  return (
    instanceBp(state.definitions, instance) +
    (instance.bpModifier ?? 0) +
    promotedKeywordBpBonus(state, playerId, instance)
  );
}

function countFaceUpPowerCards(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].power.filter((c) => !c.faceDown).length;
}

function countFaceUpPowerUnitsWithFeatureSlug(
  state: GameState,
  playerId: PlayerId,
  featureSlugValue: string,
): number {
  return state.players[playerId].power.filter((card) => {
    if (card.faceDown) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit" && unitHasFeatureSlug(def, featureSlugValue);
  }).length;
}

/** 昇格 DSL grant_keyword による BP ボーナス（パワーゾーン連動等）。 */
export function promotedKeywordBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const keywords = listCardGrantKeywords(instance.cardId);
  if (keywords.length === 0) return 0;

  let bonus = 0;
  const faceUpPower = countFaceUpPowerCards(state, playerId);

  for (const keyword of keywords) {
    const perCard = keyword.match(/^power_faceup_bp_per_(\d+)$/);
    if (perCard) {
      bonus += faceUpPower * Number(perCard[1]);
      continue;
    }

    const featureBp = keyword.match(
      /^power_feature_bp_sp_(.+)_(\d+)_(\d+)_sp(\d+)$/,
    );
    if (featureBp) {
      const [, slug, bpPer] = featureBp;
      const count = countFaceUpPowerUnitsWithFeatureSlug(state, playerId, slug!);
      bonus += count * Number(bpPer);
    }
  }

  return bonus;
}

/** BP 閾値で SP レベル底上げ（sp_at_bp* / power_feature_bp_sp*）。 */
export function promotedKeywordSpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const keywords = listCardGrantKeywords(instance.cardId);
  if (keywords.length === 0) return 0;

  const bp =
    instanceBp(state.definitions, instance) +
    (instance.bpModifier ?? 0) +
    promotedKeywordBpBonus(state, playerId, instance);

  let floor = 0;
  for (const keyword of keywords) {
    const threshold = keyword.match(/^sp_at_bp(\d+)_sp(\d+)$/);
    if (threshold && bp >= Number(threshold[1])) {
      floor = Math.max(floor, Number(threshold[2]));
      continue;
    }

    const featureSp = keyword.match(/^power_feature_bp_sp_.+_\d+_(\d+)_sp(\d+)$/);
    if (featureSp && bp >= Number(featureSp[1])) {
      floor = Math.max(floor, Number(featureSp[2]));
    }
  }

  return floor;
}

/** while_in_field / passive grant_keyword のフィールド検索用。 */
export function cardHasDslGrantKeyword(cardId: string, keyword: string): boolean {
  return cardHasGrantKeyword(cardId, keyword);
}

/** ride_without_rc_* キーワードから特徴名を復元（hex slug または named_* 形式）。 */
export function decodeRideWithoutRcFeature(keyword: string): string | null {
  const match = keyword.match(/^ride_(?:command_)?without_rc_(?:named_)?(.+)$/);
  if (!match) return null;
  const slug = match[1]!;
  if (/^[0-9a-f]+$/.test(slug) && slug.length >= 4) {
    try {
      return Buffer.from(slug, "hex").toString("utf8");
    } catch {
      return null;
    }
  }
  return slug;
}

export function listRideWithoutRcFeatures(vehicleCardId: string): string[] {
  return listCardGrantKeywords(vehicleCardId)
    .map(decodeRideWithoutRcFeature)
    .filter((feature): feature is string => feature !== null);
}

/** ビークルが RC 不要ライドを許可する特徴を rider が持つか。 */
export function riderMatchesVehicleRideWithoutRc(
  definitions: Record<string, CardDefinition>,
  vehicleCardId: string,
  riderCardId: string,
): boolean {
  const allowedFeatures = listRideWithoutRcFeatures(vehicleCardId);
  if (allowedFeatures.length === 0) return false;
  const riderDef = definitions[riderCardId];
  if (!riderDef?.features?.length) return false;
  return allowedFeatures.some((feature) => riderDef.features!.includes(feature));
}

export function cardHasEngineNativeKeyword(cardId: string, keyword: string): boolean {
  return cardHasGrantKeyword(cardId, keyword);
}

function playerHasAllyWithFeatureInBattle(
  state: GameState,
  playerId: PlayerId,
  featureSlugValue: string,
  excludeInstanceId: string,
): boolean {
  const player = state.players[playerId];
  return player.battle.some((card) => {
    if (card.instanceId === excludeInstanceId) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit" && unitHasFeatureSlug(def, featureSlugValue);
  });
}

/** 守備側の昇格キーワードでアタック不可なら true。 */
export function promotedDefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const attacker = findInZone(state.players[attackerPlayerId], "battle", attackerInstanceId);
  const defender =
    findInZone(state.players[defenderPlayerId], "battle", defenderInstanceId) ??
    findInZone(state.players[defenderPlayerId], "rush", defenderInstanceId);
  if (!attacker || !defender) return false;

  if (
    isSmallUnit(state.definitions, attacker.card.cardId) &&
    lastBattleProtectsOtherS(state, defenderPlayerId, defender.card.instanceId)
  ) {
    return true;
  }

  const attackerBp = quickBpForAttackCheck(state, attackerPlayerId, attacker.card);
  const keywords = listCardGrantKeywords(defender.card.cardId);

  for (const keyword of keywords) {
    if (keyword === "enemy_cannot_attack") return true;

    const enemySBp = keyword.match(/^no_attack_from_enemy_s_bp(\d+)$/);
    if (
      enemySBp &&
      isSmallUnit(state.definitions, attacker.card.cardId) &&
      attackerBp >= Number(enemySBp[1])
    ) {
      return true;
    }

    const allyProtect = keyword.match(/^ally_(.+)_protects_from_enemy_s$/);
    if (
      allyProtect &&
      isSmallUnit(state.definitions, attacker.card.cardId) &&
      playerHasAllyWithFeatureInBattle(
        state,
        defenderPlayerId,
        allyProtect[1]!,
        defender.card.instanceId,
      )
    ) {
      return true;
    }
  }

  return false;
}

/** 攻撃側の昇格キーワードで対象不可なら true。 */
export function promotedAttackerCannotTarget(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const attacker = findInZone(state.players[attackerPlayerId], "battle", attackerInstanceId);
  const defender =
    findInZone(state.players[defenderPlayerId], "battle", defenderInstanceId) ??
    findInZone(state.players[defenderPlayerId], "rush", defenderInstanceId);
  if (!attacker || !defender) return false;

  const defenderBp = quickBpForAttackCheck(state, defenderPlayerId, defender.card);
  const keywords = listCardGrantKeywords(attacker.card.cardId);

  for (const keyword of keywords) {
    const lowBp = keyword.match(/^cannot_attack_bp(\d+)_or_less$/);
    if (lowBp && defenderBp <= Number(lowBp[1])) return true;

    const noFeature = keyword.match(/^no_attack_without_(.+)$/);
    if (noFeature) {
      const def = getDefinition(state.definitions, defender.card.cardId);
      if (!unitHasFeatureSlug(def, noFeature[1]!)) return true;
    }
  }

  return false;
}
