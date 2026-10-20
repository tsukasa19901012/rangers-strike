import type { CardDefinition } from "@rangers-strike/cards";
import { xg2NamedPowerPartner, xg2PowerPartnerFeature } from "./xg2/xg2Fields";
import {
  canonicalCardName,
  fusionMaterialAliasNames,
  fusionMaterialAliasRequiresNoOwnL,
  getZordCondition,
  isExtendedZordMaterialCondition,
  isSendSUnitZordCondition,
  isValidZordFusionMaterial,
  isZordUpCost,
  resolveRushAdditionalCondition,
} from "@rangers-strike/cards";
import {
  resolveZordFusionPartnerIds,
  resolveZordFusionPartnerSlots,
  resolveZordFusionSlotAlternatives,
} from "../dsl/zordBridge";
import type { ZordMaterialDestination } from "../types/actions";
import type { CardInstance, PlayerState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { getDefinition, isSmallUnit, unitSizeOf } from "../core/catalog";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { findInZone, removeAt } from "../core/helpers";
import { hasTurnRuleModifier } from "../core/scopedModifiers";
import { actionContextState, zordMaterialAlteredName, zordMaterialFeatures } from "./zordFeatureContext";
import { rk11IsHandSubstitute } from "./rk/rk11Fields";
import { xg1HoldSubstituteAvailable } from "./xg1/xg1Fields";
import { xg4FusionSlotWaived, xg4HoldForHandSubstitute, xg4IsHandSubstituteMaterial } from "./xg4/xg4Fields";

/** ゾードアップ素材を取れるゾーン（フィールドのみ、手札不可）。 */
export type ZordMaterialZone = "rush" | "battle" | "hand";

const ZORD_MATERIAL_ZONES: ZordMaterialZone[] = ["rush", "battle"];

/**
 * RK-217 イーグルアンデッド・RK-218 ピーコックアンデッドの※「これが自分の手札にある間、自分が「X JF」をラッシュするとき、これを捨札にすれば、
 * 自軍「X」1体を捨札にしたことにできる。」— 「自軍「X」1体を捨札にする」の追加条件の素材として、手札のこれを選べる（rules/rk/rk11Fields.ts）。
 */
function isHandSubstituteMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  card: CardInstance,
): boolean {
  return (
    (resolveZordUpCondition(definitions, rushingCardId)?.conditionId === "discard_named_unit" && rk11IsHandSubstitute({ definitions }, player.hand, card, rushingCardId)) ||
    // XG4-008【I.N.E.T.特別開発班チーフ】（rules/xg4/xg4Fields.ts）。
    xg4IsHandSubstituteMaterial(player, definitions, rushingCardId, card, (c) => isValidZordUpMaterial(definitions, rushingCardId, "", c))
  );
}

const NON_FIELD_ZORD_UP_CONDITIONS = new Set([
  "state_gate",
  "hold_extra_command",
  "opponent_draw",
]);

export function needsZordMaterial(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!def || !isZordUpCost(def.powerCost)) return false;
  const resolved = resolveRushAdditionalCondition(cardId, def);
  const conditionId = resolved?.conditionId ?? getZordCondition(cardId);
  if (!conditionId || conditionId.startsWith("zord_down_")) return false;
  if (NON_FIELD_ZORD_UP_CONDITIONS.has(conditionId)) return false;
  if (isExtendedZordMaterialCondition(conditionId)) return false;
  return true;
}

/** 合体―行があるゾードは、列挙された全パートナーがフィールド上に必要。 */
export function requiresAllFusionPartners(rushingCardId: string): boolean {
  // 「※このカードの追加条件は、…のとき、次のように変更される」で合体以外の追加条件に変わっていれば、合体の素材は要らない
  // （RS-663・RS-664「本来の特徴に「炎神」を持つ自軍Lユニット1体を捨札にする」。rules/rushAdditionalCondition.ts）。
  const override = (
    actionContextState()?.definitions[rushingCardId] as { rushAdditionalConditionOverride?: { conditionId: string } } | undefined
  )?.rushAdditionalConditionOverride;
  if (override && override.conditionId !== "discard_fusion_unit") return false;
  return resolveZordFusionPartnerIds(rushingCardId).length > 0;
}

function partnerNamesForId(
  definitions: Record<string, CardDefinition>,
  partnerCardId: string,
): Set<string> {
  const def = getDefinition(definitions, partnerCardId);
  const names = new Set<string>();
  if (!def) return names;
  names.add(canonicalCardName(def.name));
  for (const alias of fusionMaterialAliasNames(def.text)) {
    names.add(alias);
  }
  return names;
}

/**
 * 「※自軍Lユニットがなければ、これは…としてつかえる」（XG6-018 アバレキラー）の別名が、いま使えるか。
 * player を渡さないときは（場の状態を見ない呼び出し）使えるものとする。
 */
export function fusionAliasUsable(
  definitions: Record<string, CardDefinition>,
  fieldCardId: string,
  player?: Pick<PlayerState, "battle" | "rush">,
): boolean {
  if (!player) return true;
  if (!fusionMaterialAliasRequiresNoOwnL(getDefinition(definitions, fieldCardId)?.text)) return true;
  return ![...player.battle, ...player.rush].some((c) => {
    const def = getDefinition(definitions, c.cardId);
    return def?.type === "unit" && unitSizeOf(definitions, c) === "L";
  });
}

export function fieldCardMatchesPartner(
  definitions: Record<string, CardDefinition>,
  fieldCard: CardInstance,
  partnerCardId: string,
  player?: Pick<PlayerState, "battle" | "rush">,
): boolean {
  // RS-602【汚染された水】でカード名が変わったユニットは、名前では合体の素材にならない（テキストの「…としてつかえる」は変わらない。
  // faq-card-8 RS-602 Q2）。
  const alteredName = zordMaterialAlteredName(fieldCard);
  if (!alteredName && fieldCard.cardId === partnerCardId) return true;
  const fieldDef = getDefinition(definitions, fieldCard.cardId);
  if (!fieldDef) return false;
  const partnerNames = partnerNamesForId(definitions, partnerCardId);
  const fieldNames = new Set<string>([canonicalCardName(alteredName ?? fieldDef.name)]);
  if (fusionAliasUsable(definitions, fieldCard.cardId, player)) {
    for (const alias of fusionMaterialAliasNames(fieldDef.text)) {
      fieldNames.add(alias);
    }
  }
  for (const fieldName of fieldNames) {
    if (partnerNames.has(fieldName)) return true;
  }
  return false;
}

/**
 * RS-347 スーパーフォーメーション: 「このターン、5体以上の合体ユニットを必要とする特徴「メカ」を持つユニットのカードを
 * ラッシュするとき、…自軍コマンドゾーンのリリース状態のカードから、合体ユニットに足りない分のユニットと同じ名前のカードを
 * 捨札にする」。使ったターン（プレイヤーのターン限定のルール）だけ、コマンドゾーンのリリース状態のカードも素材にできる。
 */
export const SUPER_FORMATION_RULE = "rs347_super_formation";

function superFormationApplies(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  slotCount: number,
): boolean {
  if (slotCount < 5) return false;
  if (!hasTurnRuleModifier(player, SUPER_FORMATION_RULE)) return false;
  return (getDefinition(definitions, rushingCardId)?.features ?? []).includes("メカ");
}

type PartnerZone = ZordMaterialZone | "command";

function findPartnerInstance(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  partnerCardId: string,
  rushingInstanceId: string,
  usedInstanceIds: Set<string> = new Set(),
  includeCommand = false,
): { zone: PartnerZone; index: number; card: CardInstance } | null {
  const zones: PartnerZone[] = includeCommand ? [...ZORD_MATERIAL_ZONES, "command"] : ZORD_MATERIAL_ZONES;
  for (const zone of zones) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId || usedInstanceIds.has(card.instanceId)) continue;
      if (zone === "command" && card.commandHeld) continue;
      if (fieldCardMatchesPartner(definitions, card, partnerCardId, player)) {
        return { zone, index, card };
      }
    }
  }
  return null;
}

type FusionMaterialFound = { zone: PartnerZone; index: number; card: CardInstance };

/** 「※これは「A＋B＋C」としてつかえる」（XG3-006 ビクトリーウォーカー）の A・B・C。1枚で複数の合体ユニットとして数える。 */
function multiFusionAliasNames(def: CardDefinition | undefined): string[] {
  for (const alias of fusionMaterialAliasNames(def?.text)) {
    const parts = alias.split(/[＋+]/).map((p) => canonicalCardName(p)).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  return [];
}

const DISCARD_THRESHOLD_CONDITION_RE =
  /このカードの追加条件は、?自軍捨札が(\d+)枚以上のとき、?次のように変更される⇒自軍[「｢]([^」｣]+)[」｣]1体を捨札にする/;

/**
 * 「※このカードの追加条件は、自軍捨札がN枚以上のとき、次のように変更される⇒自軍「X」1体を捨札にする。」
 * （RS-514 ゲキトージャウルフ。atwiki/page-779）— 条件を満たせば、合体ユニットのかわりに「X」1体だけを素材にする。
 * 条件を満たしていれば undefined 以外（素材が見つからなければ null）を返す。
 */
function discardThresholdFusionMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): FusionMaterialFound[] | null | undefined {
  const text = getDefinition(definitions, rushingCardId)?.text;
  const m = text?.match(DISCARD_THRESHOLD_CONDITION_RE);
  if (!m || player.discard.length < Number(m[1])) return undefined;
  const name = canonicalCardName(m[2]!);
  for (const zone of ZORD_MATERIAL_ZONES) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId) continue;
      const def = getDefinition(definitions, card.cardId);
      if (def?.type === "unit" && canonicalCardName(def.name) === name) return [{ zone, index, card }];
    }
  }
  return null;
}

const NAMED_OR_FUSION_RE = /^自軍[「｢]([^」｣]+)[」｣]1体または自軍合体ユニットを捨札にする$/;

function namedOrFusionMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): FusionMaterialFound[] | null {
  const m = getDefinition(definitions, rushingCardId)?.rushAdditionalCondition?.text?.match(NAMED_OR_FUSION_RE);
  if (!m) return null;
  const name = canonicalCardName(m[1]!);
  for (const zone of ZORD_MATERIAL_ZONES) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId) continue;
      const def = getDefinition(definitions, card.cardId);
      if (def?.type === "unit" && canonicalCardName(def.name) === name) return [{ zone, index, card }];
    }
  }
  return null;
}

const DISCARD_THRESHOLD_FUSION_RE = /このカードの合体ユニットは、?自軍捨札が(\d+)枚以上のとき、?次のように変更される(?:⇒|→)\s*合体[―─-]([^\s【]+)/;

/**
 * 「※このカードの合体ユニットは、自軍捨札がN枚以上のとき、次のように変更される⇒合体―A＋B」（XG6-007 ゲキリントージャ。atwiki/page-2352）
 * — 条件を満たせば、合体ユニットは A・B（カード名）だけになる。条件を満たしていれば undefined 以外（素材がそろわなければ null）を返す。
 */
function discardThresholdFusionChange(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): FusionMaterialFound[] | null | undefined {
  const m = getDefinition(definitions, rushingCardId)?.text?.match(DISCARD_THRESHOLD_FUSION_RE);
  if (!m || player.discard.length < Number(m[1])) return undefined;
  const names = m[2]!.split(/[＋+]/).map((n) => canonicalCardName(n)).filter(Boolean);
  const found: FusionMaterialFound[] = [];
  const used = new Set<string>();
  for (const name of names) {
    let hit: FusionMaterialFound | null = null;
    for (const zone of ZORD_MATERIAL_ZONES) {
      for (let index = 0; index < player[zone].length && !hit; index++) {
        const card = player[zone][index]!;
        if (card.instanceId === rushingInstanceId || used.has(card.instanceId)) continue;
        const def = getDefinition(definitions, card.cardId);
        if (def?.type === "unit" && canonicalCardName(def.name) === name) hit = { zone, index, card };
      }
      if (hit) break;
    }
    if (!hit) return null;
    used.add(hit.card.instanceId);
    found.push(hit);
  }
  return found;
}

/** ゾードカードに列挙された全合体パートナー（例: RS-050 → 051/052/053）。 */
export function collectRequiredFusionMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): FusionMaterialFound[] | null {
  const threshold = discardThresholdFusionMaterial(player, definitions, rushingCardId, rushingInstanceId);
  if (threshold !== undefined) return threshold;
  const changed = discardThresholdFusionChange(player, definitions, rushingCardId, rushingInstanceId);
  if (changed !== undefined) return changed;
  const plain = collectRequiredFusionMaterialsWith(player, definitions, rushingCardId, rushingInstanceId, null);
  if (plain) return plain;
  // 「自軍「X」1体または自軍合体ユニットを捨札にする」（XG1-039 テンクウシンケンオー。atwiki/page-1589）— 合体の素材のかわりに「X」1体。
  const namedOr = namedOrFusionMaterial(player, definitions, rushingCardId, rushingInstanceId);
  if (namedOr) return namedOr;
  // 1枚で複数の合体ユニットとしてつかえるカード（XG3-006「ブルースローワー＋イエローアーマー＋ピンクエイダー」。
  // atwiki/page-388 Q1）で、その名前の枠をまとめて満たす。
  const slots = resolveZordFusionPartnerSlots(rushingCardId);
  // RS-347 スーパーフォーメーションを使ったターンは、コマンドゾーンのリリース状態のカードでもよい（atwiki/page-388 Q1）。
  const aliasZones: PartnerZone[] = superFormationApplies(player, definitions, rushingCardId, slots.length)
    ? [...ZORD_MATERIAL_ZONES, "command"]
    : ZORD_MATERIAL_ZONES;
  for (const zone of aliasZones) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId) continue;
      if (zone === "command" && card.commandHeld) continue;
      const names = multiFusionAliasNames(getDefinition(definitions, card.cardId));
      if (names.length === 0) continue;
      if (!fusionAliasUsable(definitions, card.cardId, player)) continue;
      const covered = new Set<number>();
      for (const name of names) {
        const slotIndex = slots.findIndex(
          (slot, i) => !covered.has(i) && slot.some((id) => partnerNamesForId(definitions, id).has(name)),
        );
        if (slotIndex < 0) break;
        covered.add(slotIndex);
      }
      if (covered.size !== names.length) continue;
      const rest = collectRequiredFusionMaterialsWith(player, definitions, rushingCardId, rushingInstanceId, {
        slots: covered,
        material: { zone, index, card },
      });
      if (rest) return rest;
    }
  }
  // 「X（または、A＋B＋…）」の A・B…の枠を、1枚で複数の合体ユニットとしてつかえるカードでまとめて満たす（XG3-005 マックスビクトリーロボの
  // 「レッドラダー＋ブルースローワー＋…」をビクトリーウォーカーで。atwiki/page-1888 カード評価「3体分の合体パーツになる」）。
  const alternatives = resolveZordFusionSlotAlternatives(rushingCardId);
  if (alternatives.size === 0) return null;
  const altIndexes = [...alternatives.keys()];
  for (let mask = 1; mask < 1 << altIndexes.length; mask++) {
    const flat = slots.flatMap((slot, i) => {
      const bit = altIndexes.indexOf(i);
      return bit >= 0 && (mask >> bit) & 1 ? alternatives.get(i)! : [slot];
    });
    for (const zone of aliasZones) {
      for (let index = 0; index < player[zone].length; index++) {
        const card = player[zone][index]!;
        if (card.instanceId === rushingInstanceId) continue;
        if (zone === "command" && card.commandHeld) continue;
        const names = multiFusionAliasNames(getDefinition(definitions, card.cardId));
        if (names.length === 0 || !fusionAliasUsable(definitions, card.cardId, player)) continue;
        const covered = new Set<number>();
        for (const name of names) {
          const slotIndex = flat.findIndex((slot, i) => !covered.has(i) && slot.some((id) => partnerNamesForId(definitions, id).has(name)));
          if (slotIndex < 0) break;
          covered.add(slotIndex);
        }
        if (covered.size !== names.length) continue;
        const rest = matchFusionCombination(player, definitions, rushingInstanceId, flat, new Map(), new Set(), false, {
          slots: covered,
          material: { zone, index, card },
        });
        if (rest) return rest;
      }
    }
  }
  return null;
}

function collectRequiredFusionMaterialsWith(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  preassigned: { slots: Set<number>; material: FusionMaterialFound } | null,
): FusionMaterialFound[] | null {
  const slots = resolveZordFusionPartnerSlots(rushingCardId);
  if (slots.length === 0) return null;
  const alternatives = resolveZordFusionSlotAlternatives(rushingCardId);
  // 「X（または、A＋B＋…）」の枠ごとに、X と A・B…のどちらでそろえるか（組み合わせ）を決める。
  const altSlotIndexes = [...alternatives.keys()].filter((i) => !preassigned?.slots.has(i));
  const masks = Array.from({ length: 1 << altSlotIndexes.length }, (_, m) => m).sort(
    (a, b) => popcount(a) - popcount(b) || a - b,
  );
  // RS-347 スーパーフォーメーション: 「5体以上の合体ユニットを必要とする」かは選んだ組み合わせの合体ユニットの数で決まる
  // （grnrngr/faq-card-8 RS-565 Q1「5体合体以上の組み合わせを選択すれば…対象にすることは可能」「3体合体としかみなされません」、
  //  RS-569 Q1・Q2）。場のユニットだけでそろうなら、それを優先する。
  for (const includeCommand of [false, true]) {
    for (const mask of masks) {
      const useAlt = new Set(altSlotIndexes.filter((_, bit) => (mask >> bit) & 1));
      if (includeCommand) {
        const unitCount = slots.reduce(
          (sum, _slot, i) => sum + (useAlt.has(i) ? alternatives.get(i)!.length : 1),
          0,
        );
        if (!superFormationApplies(player, definitions, rushingCardId, unitCount)) continue;
      }
      const found = matchFusionCombination(
        player,
        definitions,
        rushingInstanceId,
        slots,
        alternatives,
        useAlt,
        includeCommand,
        preassigned,
      );
      if (found) return found;
    }
  }
  return null;
}

function popcount(n: number): number {
  let c = 0;
  for (let x = n; x > 0; x >>= 1) c += x & 1;
  return c;
}

function matchFusionCombination(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingInstanceId: string,
  slots: string[][],
  alternatives: Map<number, string[][]>,
  useAlt: Set<number>,
  includeCommand: boolean,
  preassigned: { slots: Set<number>; material: FusionMaterialFound } | null,
): FusionMaterialFound[] | null {
  type Found = FusionMaterialFound;
  const found: Found[] = preassigned ? [preassigned.material] : [];
  const usedInstanceIds = new Set<string>(preassigned ? [preassigned.material.card.instanceId] : []);

  const matchSlot = (slot: string[]): Found | null => {
    // 場のユニットを優先し、足りない分だけコマンドゾーンのカードを使う（RS-347）。
    for (const fromCommand of includeCommand ? [false, true] : [false]) {
      for (const partnerId of slot) {
        const candidate = findPartnerInstance(
          player,
          definitions,
          partnerId,
          rushingInstanceId,
          usedInstanceIds,
          fromCommand,
        );
        if (candidate && (fromCommand || candidate.zone !== "command")) return candidate;
      }
    }
    return null;
  };

  for (const [slotIndex, slot] of slots.entries()) {
    if (preassigned?.slots.has(slotIndex)) continue;
    // 「X（または、A＋B＋…）」— X のかわりに A・B…をすべてそろえてもよい（RS-236）。
    const parts = useAlt.has(slotIndex) ? alternatives.get(slotIndex)! : [slot];
    // 「※これは「A＋B」としてつかえる」カード（XG6-018 アバレキラー）1枚で、A・B の枠（XG6-003 の「キラーオー（または A＋B）」）をまとめて満たす。
    if (useAlt.has(slotIndex)) {
      const alias = findMultiAliasForParts(player, definitions, parts, rushingInstanceId, usedInstanceIds);
      if (alias) {
        usedInstanceIds.add(alias.card.instanceId);
        found.push(alias);
        continue;
      }
    }
    for (const part of parts) {
      const match = matchSlot(part);
      // XG4-039 の※（自軍捨札に同名のカードがあれば、その素材は捨札にしなくてよい。rules/xg4/xg4Fields.ts）。
      if (!match && xg4FusionSlotWaived(player, rushingInstanceId, part, (c, id) => fieldCardMatchesPartner(definitions, c, id))) continue;
      if (!match) return null;
      usedInstanceIds.add(match.card.instanceId);
      found.push(match);
    }
  }

  return found;
}

/** parts（「A＋B＋…」の枠）の名前をすべて「※これは「A＋B＋…」としてつかえる」で持つ場のカード。 */
function findMultiAliasForParts(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  parts: string[][],
  rushingInstanceId: string,
  usedInstanceIds: Set<string>,
): FusionMaterialFound | null {
  for (const zone of ZORD_MATERIAL_ZONES) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId || usedInstanceIds.has(card.instanceId)) continue;
      const names = multiFusionAliasNames(getDefinition(definitions, card.cardId));
      if (names.length !== parts.length || !fusionAliasUsable(definitions, card.cardId, player)) continue;
      const covered = new Set<number>();
      for (const name of names) {
        const i = parts.findIndex((part, k) => !covered.has(k) && part.some((id) => partnerNamesForId(definitions, id).has(name)));
        if (i < 0) break;
        covered.add(i);
      }
      if (covered.size === parts.length) return { zone, index, card };
    }
  }
  return null;
}

export function hasAllRequiredFusionMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): boolean {
  return (
    collectRequiredFusionMaterials(
      player,
      definitions,
      rushingCardId,
      rushingInstanceId,
    ) !== null
  );
}

export function applyAllZordFusionMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): PlayerState | null {
  const materials = collectRequiredFusionMaterials(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
  );
  if (!materials) return null;

  let nextPlayer = player;
  const toDiscard: CardInstance[] = [];
  const toPower = fusionMaterialsGoToPower(definitions, rushingCardId);

  for (const material of materials) {
    const zoneCards = [...nextPlayer[material.zone]];
    const removeIndex = zoneCards.findIndex(
      (c) => c.instanceId === material.card.instanceId,
    );
    if (removeIndex < 0) return null;
    const [, remaining] = removeAt(zoneCards, removeIndex);
    toDiscard.push(material.card);
    nextPlayer = { ...nextPlayer, [material.zone]: remaining };
  }

  if (toPower) {
    // 「追加条件：自軍合体ユニットをパワーゾーンに送る」— 素材はパワーゾーンにオモテ向きで置く。
    const cleaned = toDiscard.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }));
    return { ...nextPlayer, power: [...nextPlayer.power, ...cleaned] };
  }
  return {
    ...nextPlayer,
    discard: [...nextPlayer.discard, ...toDiscard],
  };
}

/**
 * 追加条件の文言が「自軍合体ユニットをパワーゾーンに送る」なら true（RS-569 スーパーデカレンジャーロボ atwiki/page-1230・
 * RS-592 エンジンオーG6。grnrngr/faq-card-8 RS-569 Q1「合体ユニットをパワー送りにする」）。文言で判定する。
 */
export function fusionMaterialsGoToPower(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): boolean {
  const text = getDefinition(definitions, rushingCardId)?.rushAdditionalCondition?.text ?? "";
  // XG6-010 グレートタイタン「自軍「フラッシュタイタン」1体と「タイタンボーイ」1体をパワーゾーンに送る」も、合体の枠の素材をパワーゾーンに送る。
  return /(?:合体ユニット|自軍「[^」]+」1体と「[^」]+」1体)を(?:自軍)?パワーゾーンに送る/.test(text.normalize("NFKC"));
}

export function isValidFusionMaterial(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  card: CardInstance,
  rushingInstanceId: string,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  return isValidZordFusionMaterial(rushingCardId, card.cardId, definitions);
}

function normalizeName(value: string): string {
  return value.replace(/\s/g, "");
}

function matchesPartnerName(def: CardDefinition | undefined, partnerName: string): boolean {
  if (!def) return false;
  return normalizeName(def.name).includes(normalizeName(partnerName));
}

function resolveZordUpCondition(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
) {
  const def = getDefinition(definitions, rushingCardId);
  return resolveRushAdditionalCondition(rushingCardId, def);
}

/**
 * 「自軍「X」1体を捨札にする」の X。「自軍「A」、または自軍「B」1体を捨札にする」のように本文に複数あれば全部
 * （取り込みデータの partnerName は最後の1つだけのことがある）。
 */
function namedUnitPartnerNames(condition: { text?: string; partnerName?: string }): string[] {
  const text = (condition.text ?? "").normalize("NFKC");
  const names = /、または/.test(text)
    ? [...text.matchAll(/自軍[「｢]([^」｣]+)[」｣]/g)].map((m) => m[1]!)
    : // 「自軍「A」または「B」1体」（XG5-043〜045 atwiki/page-2242 等）。
      /自軍[「｢][^」｣]+[」｣]または[「｢]/.test(text)
      ? [...text.matchAll(/(?:自軍|または)[「｢]([^」｣]+)[」｣]/g)].map((m) => m[1]!)
    : // 「自軍「A」か「B」1体を…」（XG2-010・XG2-011）。
      /^自軍[「｢][^」｣]+[」｣]か[「｢]/.test(text)
      ? [...text.matchAll(/[「｢]([^」｣]+)[」｣]/g)].map((m) => m[1]!)
      : [];
  if (condition.partnerName && !names.includes(condition.partnerName)) names.push(condition.partnerName);
  return names;
}

/** 「自軍「X」1体をパワーゾーンに送る」の X（名前が1つだけのとき）。 */
const singleNamedPowerPartnerCache = new Map<string, string | undefined>();

function singleNamedPowerPartner(text: string | undefined): string | undefined {
  const key = text ?? "";
  if (singleNamedPowerPartnerCache.has(key)) return singleNamedPowerPartnerCache.get(key);
  const m = /^自軍[「｢]([^」｣]+)[」｣]1体をパワーゾーンに送る。?$/.exec(key.normalize("NFKC").trim());
  singleNamedPowerPartnerCache.set(key, m?.[1]);
  return m?.[1];
}

function singleFeaturedPowerPartner(text: string | undefined): string | undefined {
  const m = /^特徴[「｢]([^」｣]+)[」｣]を持つ自軍Sユニット(?:を1体|1体を)パワーゾーンに送る。?$/.exec((text ?? "").normalize("NFKC").trim());
  return m?.[1];
}

export function isValidZordUpMaterial(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  card: CardInstance,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  const condition = resolveZordUpCondition(definitions, rushingCardId);
  if (!condition || condition.conditionId.startsWith("zord_down_")) {
    const legacy = getZordCondition(rushingCardId);
    if (legacy === "discard_fusion_unit") {
      return isValidFusionMaterial(definitions, rushingCardId, card, rushingInstanceId);
    }
    if (legacy && isSendSUnitZordCondition(legacy)) {
      return isValidPowerMaterial(definitions, card, rushingInstanceId);
    }
    return false;
  }

  const def = getDefinition(definitions, card.cardId);
  if (!def) return false;

  switch (condition.conditionId) {
    case "discard_fusion_unit":
      return isValidFusionMaterial(definitions, rushingCardId, card, rushingInstanceId);
    case "discard_fusion_vehicle":
      return (
        def.type === "vehicle" &&
        isValidZordFusionMaterial(rushingCardId, card.cardId, definitions)
      );
    case "discard_vehicle_unit":
      return def.type === "vehicle";
    case "discard_named_unit":
      // 「自軍「X」1体」はカード名で指定するので、その名前のビークルも満たす（RK-046 の「オートバジンVM」）。
      return (
        (def.type === "unit" || def.type === "vehicle") &&
        // 「ホールド状態の自軍「X」1体」はホールド状態のものだけ（XG5-049 atwiki/page-2271）。
        (!/^ホールド状態の/.test((condition.text ?? "").normalize("NFKC")) || card.commandHeld === true) &&
        // 「自軍「A」、または自軍「B」1体を捨札にする」はどちらの名前でもよい（RS-655・RS-656 atwiki/page-1528・1474）。
        namedUnitPartnerNames(condition).some(
          (name) =>
            // RS-602【汚染された水】で変わったカード名で判定する。
            normalizeName(zordMaterialAlteredName(card) ?? def.name).includes(normalizeName(name)) ||
            // 「※これは「X」としてつかえる」（XG1-067 等。atwiki/page-1668 Q1「全ての場にあるとき常に有効」）。
            fusionMaterialAliasNames(def.text).some((n) => normalizeName(n).includes(normalizeName(name))),
        )
      );
    case "discard_feature_unit": {
      // 効果・フェイズで追加された特徴も含める（RS-499 ゲキバイオレット。rules/zordFeatureContext.ts）。
      const features = zordMaterialFeatures(def, card);
      return (
        def.type === "unit" &&
        !!condition.requiredFeature &&
        (anyOfFeatures(condition)?.some((f) => features.includes(f)) ?? features.includes(condition.requiredFeature)) &&
        (condition.requiredFeatures ?? []).every((f) => features.includes(f)) &&
        (!condition.requiredSize || def.size === condition.requiredSize)
      );
    }
    case "discard_name_contains_unit":
      return (
        def.type === "unit" &&
        !!condition.nameContains &&
        normalizeName(def.name).includes(normalizeName(condition.nameContains))
      );
    case "discard_generic_unit":
      return def.type === "unit";
    case "send_s_units_to_zones":
      return isValidPowerMaterial(definitions, card, rushingInstanceId);
    default:
      if (isSendSUnitZordCondition(condition.conditionId)) {
        // 「リードを持つ自軍Sユニット1体を捨札にする」（XP-028 ワンダーゴセイグレート atwiki/page-2369）— リード（どのカテゴリでも）を持つ S ユニットだけ。
        if (/^リードを持つ/.test(condition.text)) {
          return (
            isValidPowerMaterial(definitions, card, rushingInstanceId) &&
            (["MA", "ET", "OT", "WB", "DA"] as const).some((cat) => cardHasGrantKeyword(card.cardId, `lead_${cat}`))
          );
        }
        // 「自軍「X」1体をパワーゾーンに送る」はその名前の S ユニットだけ（RK-054「仮面ライダーガタックMF」・RK-057「仮面ライダーザビーMF」
        // atwiki/page-171・161）。
        const named = condition.conditionId === "send_s_unit_to_power" ? (singleNamedPowerPartner(condition.text) ?? xg2NamedPowerPartner(condition.text)) : undefined;
        // 「特徴「X」を持つ自軍ユニット1体をパワーゾーンに送る」（XG2-042・XP-005。rules/xg2/xg2Fields.ts）。
        const feature = condition.conditionId === "send_s_unit_to_power" ? xg2PowerPartnerFeature(condition.text) : undefined;
        if (feature) return card.instanceId !== rushingInstanceId && def.type === "unit" && (def.features ?? []).includes(feature);
        if (named) {
          // 名前で指定されたユニットは大きさを問わない（XG2-032「自軍「デカマシン」（SC）1体をパワーゾーンに送る」atwiki/page-1800）。
          return (
            card.instanceId !== rushingInstanceId &&
            def.type === "unit" &&
            normalizeName(zordMaterialAlteredName(card) ?? def.name).includes(normalizeName(named))
          );
        }
        // 「特徴「X」を持つ自軍Sユニットを1体パワーゾーンに送る」はその特徴を持つ S ユニットだけ（XG1-018 サイレンダーPM atwiki/page-1585）。
        const featured = condition.conditionId === "send_s_unit_to_power" ? singleFeaturedPowerPartner(condition.text) : undefined;
        if (featured) return isValidPowerMaterial(definitions, card, rushingInstanceId) && zordMaterialFeatures(def, card).includes(featured);
        return isValidPowerMaterial(definitions, card, rushingInstanceId);
      }
      return false;
  }
}

/**
 * 「自軍「X」1体をコマンドゾーンに送るか捨札にする」のように、捨札にする型の追加条件で行き先（コマンドゾーンか捨札）を選べるか
 * （RK-046 オートバジンBM「自軍「オートバジンVM」1体をコマンドゾーンに送るか捨札にする」atwiki/page-206 等）。
 */
/** 「特徴「A」か「B」を持つ…」のどれか1つでよい特徴（@rangers-strike/cards parseFeatureDiscardCondition。XP-029・XP-032）。 */
function anyOfFeatures(condition: object): string[] | undefined {
  return (condition as { anyOfFeatures?: string[] }).anyOfFeatures;
}

export function zordOffersCommandOrDiscard(zordCardId: string, conditionId: string | undefined): boolean {
  if (conditionId === "send_s_unit_to_command_or_discard") return true;
  // XG2-005〜007「自軍Sユニット…を自軍ゾーンに送る」— 「ゾーン」はパワーゾーンとコマンドゾーンの総称（atwiki/page-1517 Q1）。
  // 行き先の "command" はコマンドゾーン（リリース状態）、"discard" はパワーゾーン（applyZordMaterial の既定の行き先）。
  if (conditionId === "send_s_units_to_zones") return true;
  if (conditionId !== "discard_named_unit" && conditionId !== "discard_feature_unit" && conditionId !== "discard_vehicle_unit") return false;
  return /コマンドゾーンに送るか捨札にする/.test((resolveRushAdditionalCondition(zordCardId)?.text ?? "").normalize("NFKC"));
}

export function isValidPowerMaterial(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
  rushingInstanceId: string,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  return isSmallUnit(definitions, card);
}

export function collectZordMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): CardInstance[] {
  const resolved = resolveZordUpCondition(definitions, rushingCardId);
  const legacy = getZordCondition(rushingCardId);
  if (!resolved && !legacy) return [];

  const candidates: CardInstance[] = [];

  for (const zone of ZORD_MATERIAL_ZONES) {
    for (const card of player[zone]) {
      if (isValidZordUpMaterial(definitions, rushingCardId, rushingInstanceId, card)) {
        candidates.push(card);
      }
    }
  }
  for (const card of player.hand) {
    if (card.instanceId !== rushingInstanceId && isHandSubstituteMaterial(player, definitions, rushingCardId, card)) candidates.push(card);
  }

  return candidates;
}

export function findZordMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
): { zone: ZordMaterialZone; index: number; card: CardInstance } | null {
  if (!resolveZordUpCondition(definitions, rushingCardId) && !getZordCondition(rushingCardId)) {
    return null;
  }

  for (const zone of ZORD_MATERIAL_ZONES) {
    const found = findInZone(player, zone, materialInstanceId);
    if (!found) continue;
    if (
      !isValidZordUpMaterial(
        definitions,
        rushingCardId,
        rushingInstanceId,
        found.card,
      )
    ) {
      continue;
    }
    return { zone, index: found.index, card: found.card };
  }
  const inHand = findInZone(player, "hand", materialInstanceId);
  if (inHand && materialInstanceId !== rushingInstanceId && isHandSubstituteMaterial(player, definitions, rushingCardId, inHand.card)) {
    return { zone: "hand", index: inHand.index, card: inHand.card };
  }

  return null;
}

export function applyZordMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
  destination?: ZordMaterialDestination,
): PlayerState | null {
  const material = findZordMaterial(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    materialInstanceId,
  );
  if (!material) return null;

  const resolved = resolveZordUpCondition(definitions, rushingCardId);
  const conditionId = resolved?.conditionId ?? getZordCondition(rushingCardId);
  if (!conditionId) return null;

  if (destination === "hold") {
    // XG1-013【巨大要塞】「自軍Sユニットを1体捨札にするかわりに、自軍Sユニットを1体ホールドする」（rules/xg1/xg1Fields.ts）。
    if (conditionId !== "send_s_unit_to_discard" || !xg1HoldSubstituteAvailable(player, definitions, rushingCardId) || (material.zone !== "rush" && material.zone !== "battle") || material.card.commandHeld) return null;
    const cards = [...player[material.zone]];
    cards[material.index] = { ...material.card, commandHeld: true };
    return { ...player, [material.zone]: cards };
  }

  const [, zoneCards] = removeAt(player[material.zone], material.index);
  let nextPlayer: PlayerState = { ...player, [material.zone]: zoneCards };
  // XG4-008【I.N.E.T.特別開発班チーフ】で手札のカードを素材にしたときは、ET の自軍コマンドを1つホールドする（rules/xg4/xg4Fields.ts）。
  if (material.zone === "hand" && !rk11IsHandSubstitute({ definitions }, player.hand, material.card, rushingCardId)) {
    nextPlayer = xg4HoldForHandSubstitute(nextPlayer, definitions);
  }

  if (conditionId === "discard_fusion_unit" && fusionMaterialsGoToPower(definitions, rushingCardId)) {
    // 「自軍合体ユニットをパワーゾーンに送る」（RS-592 エンジンオーG6。faq-card-8 RS-569 Q1「合体ユニットをパワー送りにする」）。
    nextPlayer = {
      ...nextPlayer,
      power: [...nextPlayer.power, { instanceId: material.card.instanceId, cardId: material.card.cardId }],
    };
  } else if (destination === "command" && conditionId !== "send_s_unit_to_command_or_discard" && zordOffersCommandOrDiscard(rushingCardId, conditionId)) {
    // 「…をコマンドゾーンに送るか捨札にする」でコマンドゾーンを選んだ（RK-046 等）。
    if (nextPlayer.command.length >= COMMAND_ZONE_MAX) return null;
    nextPlayer = {
      ...nextPlayer,
      command: [...nextPlayer.command, { instanceId: material.card.instanceId, cardId: material.card.cardId, commandHeld: false }],
    };
  } else if (
    conditionId === "discard_fusion_unit" ||
    conditionId === "discard_named_unit" ||
    conditionId === "discard_feature_unit" ||
    conditionId === "discard_vehicle_unit" ||
    conditionId === "discard_fusion_vehicle" ||
    conditionId === "discard_name_contains_unit"
  ) {
    nextPlayer = {
      ...nextPlayer,
      discard: [...nextPlayer.discard, material.card],
    };
  } else if (
    conditionId === "send_s_unit_to_discard" ||
    (conditionId === "send_s_unit_to_command_or_discard" && destination === "discard")
  ) {
    nextPlayer = {
      ...nextPlayer,
      discard: [...nextPlayer.discard, material.card],
    };
  } else if (conditionId === "send_s_unit_to_command_or_discard") {
    if (destination === "command") {
      if (nextPlayer.command.length >= COMMAND_ZONE_MAX) return null;
      nextPlayer = {
        ...nextPlayer,
        command: [
          ...nextPlayer.command,
          { ...material.card, commandHeld: false },
        ],
      };
    } else {
      return null;
    }
  } else {
    nextPlayer = {
      ...nextPlayer,
      power: [...nextPlayer.power, { ...material.card, faceDown: false }],
    };
  }

  return nextPlayer;
}
