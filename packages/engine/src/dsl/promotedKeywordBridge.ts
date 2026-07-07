import { cardCategories } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, instanceBp, isSmallUnit, unitEffectiveCategories } from "../core/catalog";
import { findInZone, opponent } from "../core/helpers";
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
  "cross1",
  "blast",
  "breaker",
  "scrum",
  "ride_bp_boost_500",
  "ride_bp_boost_1000",
]);

const ENGINE_NATIVE_KEYWORD_PATTERNS = [
  /^ride_bp_boost_\d+$/,
  /^ride_attack_bp_boost_\d+$/,
  /^attacked_bp_boost_\d+$/,
] as const;

const ENGINE_NATIVE_PREFIXES = [
  "ride_without_rc_",
  "ride_command_without_rc_",
] as const;

export function isEngineNativeGrantKeyword(keyword: string): boolean {
  if (ENGINE_NATIVE_KEYWORDS.has(keyword)) return true;
  if (/^(call|lead|taxis)_(MA|ET|DA|WB|OT)$/.test(keyword)) return true;
  if (/^cross\d+$/.test(keyword)) return true;
  if (keyword.startsWith("attacked_bp_boost_")) return true;
  if (ENGINE_NATIVE_KEYWORD_PATTERNS.some((re) => re.test(keyword))) return true;
  return ENGINE_NATIVE_PREFIXES.some((prefix) => keyword.startsWith(prefix));
}

export function attackedBpBoostAmount(cardId: string): number {
  for (const keyword of listCardGrantKeywords(cardId)) {
    const match = keyword.match(/^attacked_bp_boost_(\d+)$/);
    if (match) return Number(match[1]);
  }
  return 0;
}

export function rideBpBoostAmount(vehicleCardId: string): number {
  let total = 0;
  for (const keyword of listCardGrantKeywords(vehicleCardId)) {
    const match = keyword.match(/^ride_bp_boost_(\d+)$/);
    if (match) total += Number(match[1]);
  }
  return total;
}

export function rideAttackBpBoostAmount(vehicleCardId: string): number {
  let total = 0;
  for (const keyword of listCardGrantKeywords(vehicleCardId)) {
    const match = keyword.match(/^ride_attack_bp_boost_(\d+)$/);
    if (match) total += Number(match[1]);
  }
  return total;
}

/** ライド中ユニットが乗るビークルの常時 BP ボーナス（effectiveBp）。 */
export function rideMountedVehicleBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const vehicleInstanceId = instance.mountedOnInstanceId;
  if (!vehicleInstanceId) return 0;
  const player = state.players[playerId];
  const vehicle =
    player.battle.find((c) => c.instanceId === vehicleInstanceId) ??
    player.rush.find((c) => c.instanceId === vehicleInstanceId);
  if (!vehicle) return 0;
  return rideBpBoostAmount(vehicle.cardId);
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
    // PR-008: 敵軍コマンドゾーンの OT コマンド1つにつき BP+1000
    if (
      keyword === "bp_per_enemy_command_ot_1000" ||
      keyword === "bp_per_enemy_command_obatekunoroji_1000"
    ) {
      const enemyId = playerId === "player1" ? "player2" : "player1";
      const count = state.players[enemyId].command.filter((cmd) => {
        const def = state.definitions[cmd.cardId];
        return def ? cardCategories(def).includes("OT") : false;
      }).length;
      bonus += count * 1000;
      continue;
    }

    // XG5-069/070: リードMA を持つ自軍ユニットがあれば BP+1000
    if (keyword === "lead_ma_bp_boost_1000") {
      const own = state.players[playerId];
      const hasLeadMa = [...own.rush, ...own.battle].some((c) =>
        listCardGrantKeywords(c.cardId).includes("lead_MA"),
      );
      if (hasLeadMa) bonus += 1000;
      continue;
    }

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

  bonus += fieldAuraBpBonus(state, playerId, instance);
  bonus += stackedEquipmentBpBonus(instance);

  return bonus;
}

/** 翼合体（RS-623 等）: 重ねられた装備カードによる BP ボーナス。 */
export function stackedEquipmentBpBonus(instance: CardInstance): number {
  let bonus = 0;
  for (const stacked of instance.stackedCards ?? []) {
    if (listCardGrantKeywords(stacked.cardId).includes("stack_da_less_l_on_rush")) {
      bonus += 2000;
    }
  }
  return bonus;
}

/** 翼合体: 重ねられた装備がウイングを付与しているか。 */
export function stackedEquipmentGrantsWing(instance: CardInstance): boolean {
  return (instance.stackedCards ?? []).some((stacked) =>
    listCardGrantKeywords(stacked.cardId).includes("stack_da_less_l_on_rush"),
  );
}

/** 自軍エリアのカードが放つ BP オーラ（RS-289/XP-023 恐竜 +1000 / RS-430 WB S 等）。 */
function fieldAuraBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = state.definitions[instance.cardId];
  if (!def) return 0;
  const own = state.players[playerId];
  let bonus = 0;
  const sources = [...own.rush, ...own.battle];
  for (const source of sources) {
    if (source.instanceId === instance.instanceId) {
      // 自分自身にもかかるオーラ（「すべての自軍ユニット」）は除外しない
    }
    for (const keyword of listCardGrantKeywords(source.cardId)) {
      // RS-289 / XP-023: 特徴「恐竜」を持つすべての自軍ユニットは BP+1000
      if (keyword === "ally_fx_unknown_bp_boost_1000") {
        if ((def.features ?? []).includes("恐竜")) bonus += 1000;
      }
      // RS-430（ラッシュエリアにある間）: 追加条件を持たない WB の S ユニットは
      // 必要パワーの数字2ごとに BP+1000
      if (
        keyword === "battle_position_sp_any_pos2_sp1" &&
        own.rush.some((c) => c.instanceId === source.instanceId)
      ) {
        const cost =
          typeof def.powerCost === "number"
            ? def.powerCost
            : parseInt(String(def.powerCost), 10);
        if (
          def.size === "S" &&
          cardCategories(def).includes("WB") &&
          !def.rushAdditionalCondition &&
          Number.isFinite(cost)
        ) {
          bonus += Math.floor(cost / 2) * 1000;
        }
      }
    }
  }
  return bonus;
}

/** 被アタック時オーラ: RS-496/XP-010 スワット +3000。 */
export function allyAttackedAuraBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = state.definitions[instance.cardId];
  if (!def) return 0;
  const own = state.players[playerId];
  let bonus = 0;
  for (const source of [...own.rush, ...own.battle]) {
    for (const keyword of listCardGrantKeywords(source.cardId)) {
      if (
        keyword === "ally_suwato_attacked_bp_3000" &&
        (def.features ?? []).includes("スワット")
      ) {
        bonus += 3000;
      }
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
  const doc = getCardDslDocument(vehicleCardId);
  if (!doc?.effects) return [];

  const features = new Set<string>();
  for (const effect of doc.effects) {
    for (const primitive of effect.effects) {
      if (primitive.type !== "grant_keyword") continue;
      const keyword = primitive.keyword;
      if (!/^ride_(?:command_)?without_rc_/.test(keyword)) continue;

      const fromText = effect.text?.match(/特徴「([^」]+)」/)?.[1];
      if (fromText) {
        features.add(fromText);
        continue;
      }
      const decoded = decodeRideWithoutRcFeature(keyword);
      if (decoded) features.add(decoded);
    }
  }
  return [...features];
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

    if (keyword === "no_attack_from_s" && isSmallUnit(state.definitions, attacker.card.cardId)) {
      return true;
    }

    if (
      keyword === "no_attack_from_enemy_s" &&
      attackerPlayerId !== defenderPlayerId &&
      isSmallUnit(state.definitions, attacker.card.cardId)
    ) {
      return true;
    }

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

  const defenderZone = findInZone(state.players[defenderPlayerId], "battle", defenderInstanceId)
    ? "battle"
    : "rush";
  const defenderCats = unitEffectiveCategories(
    state,
    defenderPlayerId,
    defender.card,
    defenderZone,
  );

  for (const keyword of keywords) {
    const lowBp = keyword.match(/^cannot_attack_bp(\d+)_or_less$/);
    if (lowBp && defenderBp <= Number(lowBp[1])) return true;

    if (keyword === "cannot_attack_non_da" && !defenderCats.includes("DA")) return true;

    if (keyword === "cannot_attack_s" && isSmallUnit(state.definitions, defender.card.cardId)) {
      return true;
    }

    if (keyword === "cannot_attack_enemy_battle" && defenderZone === "battle") return true;

    const noFeature = keyword.match(/^no_attack_without_(.+)$/);
    if (noFeature) {
      const def = getDefinition(state.definitions, defender.card.cardId);
      if (!unitHasFeatureSlug(def, noFeature[1]!)) return true;
    }
  }

  return false;
}
