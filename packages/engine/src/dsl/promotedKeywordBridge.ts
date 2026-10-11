import { isDivingOrochi } from "../rules/errataCardEffects";
import { cardCategories } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, instanceBp, isSmallUnit, unitEffectiveCategories } from "../core/catalog";
import { findInZone, opponent } from "../core/helpers";
import { lastBattleProtectsOtherS } from "../rules/promotedNcEffects";
import { getCardDslDocument } from "./effectLookup";
import { unitFeatures } from "../rules/addedFeatures";
import { decodeFeatureKeywordSlug, featuresMatchKeywordSlug } from "./featureKeywords";

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

/**
 * E7: 常時の BP / SP 補正マーカー。promotedKeywordBpBonus / promotedKeywordSpFloor が
 * 盤面から毎回計算するため、grant_keyword 実行時は何もしない（汎用テキスト解釈に回さない）。
 */
export const CONTINUOUS_STAT_KEYWORDS = new Set([
  /** XG5-014 【マックスビクトリープロミネンス】自軍ターン中、自軍ラッシュエリアのSユニット1体につきBP+1000。 */
  "bp_per_own_rush_s_1000_own_turn",
  /** XG5-014 ※自軍捨札にSユニットのカードが1枚もなければ「SP1」。 */
  "sp1_if_no_own_discard_s_unit",
  /** XG3-005 【マックスノバ】自軍捨札6枚につき「SP+1」。 */
  "sp_plus1_per_own_discard_6",
]);

export function isEngineNativeGrantKeyword(keyword: string): boolean {
  if (ENGINE_NATIVE_KEYWORDS.has(keyword)) return true;
  if (CONTINUOUS_STAT_KEYWORDS.has(keyword)) return true;
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
  return rideBpBoostAmount(vehicle.cardId) + riddenVehicleEnemyTurnBpBonus(state, playerId, vehicle.cardId);
}

/** ターンプレイヤー（保留中の処理があればそのフェイズのプレイヤー）。 */
function currentTurnPlayer(state: GameState): PlayerId {
  return (
    state.pendingStrike?.battlePhasePlayer ??
    state.pendingBattle?.phasePlayerId ??
    state.pendingRush?.phasePlayerId ??
    state.pendingLeave?.phasePlayerId ??
    state.pendingEffectChoice?.phasePlayerId ??
    state.activePlayer
  );
}

/**
 * 「これにライドしているユニットは、敵軍ターン中、BP+○○される」（RS-581 魔導馬バリキオン（2nd）【1500万馬力】atwiki/page-1195）。
 * 文言から読み取る（DSL では ride_action の目印だけ）。
 */
function riddenVehicleEnemyTurnBpBonus(state: GameState, ownerId: PlayerId, vehicleCardId: string): number {
  const text = (getDefinition(state.definitions, vehicleCardId)?.text ?? "").normalize("NFKC").replace(/\s+/g, "");
  const m = text.match(/これにライドしているユニットは、敵軍ターン中、BP\+(\d+)される/);
  if (!m) return 0;
  return currentTurnPlayer(state) !== ownerId ? Number(m[1]) : 0;
}

function unitHasFeatureSlug(def: CardDefinition | undefined, slug: string): boolean {
  return featuresMatchKeywordSlug(def?.features, slug);
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
  // 自軍エリアのオーラ（RS-289【獣奏剣】等）はキーワードを持たないユニットにもかかる。
  if (keywords.length === 0) return fieldAuraBpBonus(state, playerId, instance);

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

    // XG5-014: 自軍ターン中、自軍ラッシュエリアのSユニット1体につき BP+1000
    if (keyword === "bp_per_own_rush_s_1000_own_turn") {
      if (state.activePlayer === playerId) {
        const sCount = state.players[playerId].rush.filter((c) =>
          isSmallUnit(state.definitions, c.cardId),
        ).length;
        bonus += sCount * 1000;
      }
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
      const allyFeatureBoost = keyword.match(/^ally_(.+)_bp_boost_(\d+)$/);
      if (allyFeatureBoost && unitHasFeatureSlug(def, allyFeatureBoost[1]!)) {
        bonus += Number(allyFeatureBoost[2]);
      }
      // RS-430（ラッシュエリアにある間）: 追加条件を持たない WB の S ユニットは
      // 必要パワーの数字2ごとに BP+1000
      if (
        keyword === "battle_position_sp_any_pos2_sp1" &&
        own.rush.some((c) => c.instanceId === source.instanceId)
      ) {
        bonus += robotoughBpBonus(def);
      }
    }
  }
  // RS-430【獣拳トレーナー】は自軍と敵軍のすべての WB の S ユニットが対象（faq-card-6 RS-430 Q3）。
  // 自軍と敵軍のラッシュエリアに合わせて複数体あれば重複する（同 Q1）。
  for (const source of state.players[opponent(playerId)].rush) {
    if (listCardGrantKeywords(source.cardId).includes("battle_position_sp_any_pos2_sp1")) {
      bonus += robotoughBpBonus(def);
    }
  }
  return bonus;
}

/** RS-430【獣拳トレーナー】: 追加条件を持たない WB の S ユニットは必要パワーの数字2ごとに BP+1000。 */
function robotoughBpBonus(def: CardDefinition): number {
  const cost =
    typeof def.powerCost === "number" ? def.powerCost : parseInt(String(def.powerCost), 10);
  if (
    def.size === "S" &&
    cardCategories(def).includes("WB") &&
    !def.rushAdditionalCondition &&
    Number.isFinite(cost)
  ) {
    return Math.floor(cost / 2) * 1000;
  }
  return 0;
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
      continue;
    }

    // XG5-014: 自軍捨札に S ユニットのカードが1枚もなければ「SP1」
    if (keyword === "sp1_if_no_own_discard_s_unit") {
      const hasSInDiscard = state.players[playerId].discard.some((c) => {
        const def = getDefinition(state.definitions, c.cardId);
        return def?.type === "unit" && def.size === "S";
      });
      if (!hasSInDiscard) floor = Math.max(floor, 1);
      continue;
    }

    // XG3-005: 自軍捨札6枚につき「SP+1」（印刷 SP に加算）
    if (keyword === "sp_plus1_per_own_discard_6") {
      const printed = getDefinition(state.definitions, instance.cardId)?.sp;
      const base = typeof printed === "number" ? printed : 0;
      const plus = Math.floor(state.players[playerId].discard.length / 6);
      if (plus > 0) floor = Math.max(floor, base + plus);
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
  const decoded = decodeFeatureKeywordSlug(slug) ?? decodeFeatureKeywordSlug(`named_${slug}`);
  if (decoded) return decoded;
  if (/^[0-9a-f]+$/.test(slug) && slug.length >= 4) {
    try {
      return Buffer.from(slug, "hex").toString("utf8");
    } catch {
      return null;
    }
  }
  return slug;
}

/**
 * 「※特徴「○○」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。」の
 * 文言（全角・半角の揺れは NFKC で吸収）。DSL で note_card 扱いになっているカード（RS-469 ギンガベリック・RS-470 ギンガット）も
 * 文言から ride_command_without_rc と同じに扱う。
 */
const RIDE_COMMAND_WITHOUT_RC_TEXT_RE =
  /^※?特徴「([^」]+)」を持つ(?:自軍)?Sユニットは、自軍コマンドを1つホールドすれば、RCを持っていなくてもこのビークルにライドできる/;

/**
 * 「※（Xを持たない）特徴「○○」を持つ（S|M|L）ユニットは、ＲＣを持っていなくてもこのビークルにライドでき（、それ以外のユニットはライドできない）」
 * の文言（RS-570 デカバイク atwiki/page-1190・RS-575 一角聖馬ユニゴルオン atwiki/page-1240・RS-581 魔導馬バリキオン（2nd） atwiki/page-1195）。
 * DSL で note_card 扱いのカードも文言から扱う。サイズ・除外カテゴリを読み取る。
 */
const RIDE_WITHOUT_RC_SIZED_TEXT_RE =
  /^※?(?:(WB|MA|OT|ET|DA)を持たない)?特徴「([^」]+)」を持つ(S|M|L)ユニットは、RCを持っていなくてもこのビークルにライドでき/;

type RideWithoutRcEffect = {
  text: string;
  feature: string | null;
  needsHold: boolean;
  /** 文言で指定されたライダーのサイズ（「Mユニットは」等）。 */
  size?: "S" | "M" | "L";
  /** 「DAを持たない」等、ライダーが持っていてはいけないカテゴリ。 */
  excludedCategory?: string;
};

function rideWithoutRcEffects(vehicleCardId: string): RideWithoutRcEffect[] {
  const doc = getCardDslDocument(vehicleCardId);
  const out: RideWithoutRcEffect[] = [];
  for (const effect of doc?.effects ?? []) {
    const text = effect.text ?? "";
    const sized = text.normalize("NFKC").replace(/\s+/g, "").match(RIDE_WITHOUT_RC_SIZED_TEXT_RE);
    if (sized) {
      out.push({
        text,
        feature: sized[2]!,
        needsHold: false,
        size: sized[3] as "S" | "M" | "L",
        ...(sized[1] ? { excludedCategory: sized[1] } : {}),
      });
      continue;
    }
    const keyword = effect.effects.find(
      (p): p is Extract<typeof p, { type: "grant_keyword" }> =>
        p.type === "grant_keyword" && /^ride_(?:command_)?without_rc_/.test(p.keyword),
    )?.keyword;
    if (keyword) {
      out.push({
        text,
        feature: text.match(/特徴「([^」]+)」/)?.[1] ?? decodeRideWithoutRcFeature(keyword),
        needsHold: keyword.startsWith("ride_command_without_rc_"),
      });
      continue;
    }
    const byText = text.normalize("NFKC").replace(/\s+/g, "").match(RIDE_COMMAND_WITHOUT_RC_TEXT_RE);
    if (byText) out.push({ text, feature: byText[1]!, needsHold: true });
  }
  return out;
}

export function listRideWithoutRcFeatures(vehicleCardId: string): string[] {
  const features = new Set<string>();
  for (const effect of rideWithoutRcEffects(vehicleCardId)) {
    if (effect.feature) features.add(effect.feature);
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
  const sizedEffects = rideWithoutRcEffects(vehicleCardId).filter((e) => e.size);
  if (sizedEffects.length > 0) {
    const riderCats = Array.isArray(riderDef.category) ? riderDef.category : riderDef.category ? [riderDef.category] : [];
    return sizedEffects.some(
      (e) =>
        riderDef.size === e.size &&
        !!e.feature &&
        riderDef.features!.includes(e.feature) &&
        !(e.excludedCategory && riderCats.includes(e.excludedCategory as never)),
    );
  }
  // 「※特徴「○○」を持つ（自軍）Sユニットは、…ライドできる」— S ユニットに限る
  // （RS-381 atwiki/page-522・RS-406 atwiki/page-563）。
  if (rideWithoutRcTexts(vehicleCardId).every((t) => /Sユニットは/.test(t)) && riderDef.size !== "S") {
    return false;
  }
  return allowedFeatures.some((feature) => riderDef.features!.includes(feature));
}

function rideWithoutRcTexts(vehicleCardId: string): string[] {
  return rideWithoutRcEffects(vehicleCardId).map((e) => e.text);
}

/**
 * 「※…Sユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる」
 * （ride_command_without_rc_*。RS-381 ガレオパルサー atwiki/page-522）— RC なしでライドするときコマンドを1つホールドする。
 */
export function vehicleRideWithoutRcNeedsHold(vehicleCardId: string): boolean {
  return rideWithoutRcEffects(vehicleCardId).some((e) => e.needsHold);
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

/**
 * ライドしているビークルの「これにライドしている(S)ユニットは次の能力を得る⇒これはSユニットにアタックされない」。
 * ライドオフしたユニット（mountedOnInstanceId なし）は得ない。
 */
function riddenVehicleGrantsNoAttackFromS(
  state: GameState,
  ownerId: PlayerId,
  rider: { cardId: string; mountedOnInstanceId?: string },
): boolean {
  if (!rider.mountedOnInstanceId) return false;
  const owner = state.players[ownerId];
  const vehicle = [...owner.battle, ...owner.rush].find((c) => c.instanceId === rider.mountedOnInstanceId);
  if (!vehicle) return false;
  const text = (getDefinition(state.definitions, vehicle.cardId)?.text ?? "").normalize("NFKC");
  const m = text.match(/これにライドしている(S)?ユニットは次の能力を得る⇒これはSユニットにアタックされない/);
  if (!m) return false;
  return !m[1] || isSmallUnit(state.definitions, rider.cardId);
}

function riddenVehicleBlocksNonPlusAttacker(
  state: GameState,
  ownerId: PlayerId,
  rider: { cardId: string; mountedOnInstanceId?: string },
  attackerCardId: string,
): boolean {
  if (!rider.mountedOnInstanceId) return false;
  const owner = state.players[ownerId];
  const vehicle = [...owner.battle, ...owner.rush].find((c) => c.instanceId === rider.mountedOnInstanceId);
  if (!vehicle) return false;
  const text = (getDefinition(state.definitions, vehicle.cardId)?.text ?? "").normalize("NFKC");
  const m = text.match(/これにライドしている(S|M|L)?ユニットは、必要パワーに「\+」を持たないユニットにアタックされない/);
  if (!m) return false;
  if (m[1] && getDefinition(state.definitions, rider.cardId)?.size !== m[1]) return false;
  const cost = getDefinition(state.definitions, attackerCardId)?.powerCost;
  return !(typeof cost === "string" && cost.normalize("NFKC").includes("+"));
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

  // RK-231 オロチ【潜水】: ホールド状態のとき敵軍ユニットにアタックされない（ルール: R-ERR-RK231）。
  if (
    isDivingOrochi(defender.card) &&
    attackerPlayerId !== defenderPlayerId
  ) {
    return true;
  }

  if (
    isSmallUnit(state.definitions, attacker.card.cardId) &&
    lastBattleProtectsOtherS(state, defenderPlayerId, defender.card.instanceId)
  ) {
    return true;
  }

  // 「これにライドしているSユニットは次の能力を得る⇒これはSユニットにアタックされない」（RS-488【滑空】atwiki/page-810）。
  if (
    isSmallUnit(state.definitions, attacker.card.cardId) &&
    riddenVehicleGrantsNoAttackFromS(state, defenderPlayerId, defender.card)
  ) {
    return true;
  }

  // 「これにライドしているLユニットは、必要パワーに「＋」を持たないユニットにアタックされない」（RS-570【ウィリー走行】atwiki/page-1190）。
  if (riddenVehicleBlocksNonPlusAttacker(state, defenderPlayerId, defender.card, attacker.card.cardId)) {
    return true;
  }

  const attackerBp = quickBpForAttackCheck(state, attackerPlayerId, attacker.card);
  const keywords = listCardGrantKeywords(defender.card.cardId);

  for (const keyword of keywords) {
    if (keyword === "enemy_cannot_attack") return true;

    if (keyword === "no_attack_from_s" && isSmallUnit(state.definitions, attacker.card.cardId)) {
      return true;
    }

    // ※これは、特徴「X」を持たないユニットにアタックされない（RS-385 / RS-481 / RS-482）。
    const noFeature = keyword.match(/^no_attack_without_(.+)$/);
    if (noFeature) {
      // 効果で追加された特徴（rules/addedFeatures.ts）も含める。
      if (!featuresMatchKeywordSlug(unitFeatures(state, attackerPlayerId, attacker.card), noFeature[1]!)) return true;
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

  }

  return false;
}
