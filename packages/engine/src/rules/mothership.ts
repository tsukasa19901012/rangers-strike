import {
  cardHasCategory,
  jaguarMothershipAllowedWithMaterial,
  MOTHERSHIP_CONFIG,
  mothershipHoldsRequiredForRush,
  mothershipHoldCountForRush,
  mothershipKindForZordRush,
  parseMothershipText,
  zordSlotsFilledByMaterial,
  type MothershipKind,
  type MothershipTextAbility,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { Category } from "@rangers-strike/cards";
import { getZordCondition, isSendSUnitZordCondition } from "@rangers-strike/cards";
import type { ZordMaterialDestination } from "../types/actions";
import type { CardInstance, PlayerState } from "../types/game";
import { getDefinition, isMediumUnit, isOperation } from "../core/catalog";
import { findZordMaterial } from "./zord";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  evaluateStateGate,
  listExtendedZordRushVariants,
  listFieldZordRushVariants,
  listHoldExtraCommandVariants,
  validateFieldZordMaterials,
} from "./zordExtended";
import { collectZordMaterials, requiresAllFusionPartners } from "./zord";

export type MothershipHoldZone = "command" | "rush";

export type ActiveMothership = MothershipTextAbility & { sourceCardId: string };

/**
 * 自軍ラッシュエリアの【母艦】のうち、このMユニットのラッシュに使えるもの。
 * 本文の文言（parseMothershipText）で判断する（RS-076・RS-105・RS-260 等。カード ID の一覧には頼らない）。
 */
export function mothershipAbilityForZordRush(
  definitions: Record<string, CardDefinition>,
  player: PlayerState,
  rushingCardId: string,
): ActiveMothership | null {
  if (!isMediumUnit(definitions, rushingCardId)) return null;
  const rushingDef = getDefinition(definitions, rushingCardId);
  const condition = getZordCondition(rushingCardId);
  for (const card of player.rush) {
    const def = getDefinition(definitions, card.cardId);
    const ability = parseMothershipText(def?.text);
    if (!ability) continue;
    if (!mothershipSubstitutesConditionText(ability, condition)) continue;
    if (ability.requiredFeature && !(rushingDef?.features ?? []).includes(ability.requiredFeature)) continue;
    if (ability.requiredCategory && !(rushingDef && cardHasCategory(rushingDef, ability.requiredCategory))) {
      continue;
    }
    return { ...ability, sourceCardId: card.cardId };
  }
  // 本文を持たない定義（テスト用など）は従来の効果 ID 登録で判断する。
  const legacy = mothershipKindForZordRush(rushingCardId, player.rush.map((c) => c.cardId));
  if (!legacy) return null;
  const config = MOTHERSHIP_CONFIG[legacy];
  return {
    kind: legacy,
    commandCategory: config.commandCategory,
    substitutesCondition: config.substitutesCondition,
    topDeckToPower: false,
    sourceCardId: config.cardId,
  };
}

function mothershipCategoryOf(kind: ActiveMothership | MothershipKind): Category {
  return typeof kind === "string" ? MOTHERSHIP_CONFIG[kind].commandCategory : kind.commandCategory;
}

function mothershipSubstitutesConditionText(
  ability: MothershipTextAbility,
  condition: ReturnType<typeof getZordCondition>,
): boolean {
  return condition !== undefined && condition === ability.substitutesCondition;
}

export function canUseMothershipForZordRush(
  definitions: Record<string, CardDefinition>,
  player: PlayerState,
  rushingCardId: string,
): ActiveMothership | null {
  return mothershipAbilityForZordRush(definitions, player, rushingCardId);
}

/** この M ユニットのラッシュで【母艦】がホールドさせるコマンドのカテゴリ。 */
export function mothershipCommandCategory(
  definitions: Record<string, CardDefinition>,
  player: PlayerState,
  rushingCardId: string,
): Category | null {
  return mothershipAbilityForZordRush(definitions, player, rushingCardId)?.commandCategory ?? null;
}

export function isMothershipEligibleCommand(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
  category: Category,
  zone: MothershipHoldZone = "rush",
): boolean {
  if (card.commandHeld) return false;
  const def = getDefinition(definitions, card.cardId);
  if (def === undefined || !cardHasCategory(def, category)) return false;
  // コマンドゾーンのカードはユニットでもコマンド（RS-075 Q2: 1体目として送った S ユニットをホールドできる）。
  return zone === "command" || isOperation(def);
}

/**
 * 【母艦】ホールドの候補にできる「コマンドゾーンに送る追加条件の素材」（faq-card-2 RS-075 Q2:
 * 1体目としてコマンドゾーンに送ったコマンドを、2体目の代わりとしてホールドできる）。
 */
export function mothershipSelfHoldMaterialIds(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  kind: ActiveMothership | MothershipKind,
  materialIds: readonly string[],
  materialDestination: ZordMaterialDestination | undefined,
): string[] {
  if (materialDestination !== "command") return [];
  const category = mothershipCategoryOf(kind);
  return materialIds.filter((id) => {
    const card = [...player.rush, ...player.battle].find((c) => c.instanceId === id);
    const def = card ? getDefinition(definitions, card.cardId) : undefined;
    return def !== undefined && cardHasCategory(def, category);
  });
}

/** 未ホールドのカテゴリコマンド（コマンドまたはラッシュ内）（Q3: コマンドがラッシュへ移動）。 */
export function collectMothershipEligibleCommands(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  category: Category,
): Array<{ zone: MothershipHoldZone; card: CardInstance }> {
  const results: Array<{ zone: MothershipHoldZone; card: CardInstance }> = [];

  for (const card of player.command) {
    if (isMothershipEligibleCommand(definitions, card, category, "command")) {
      results.push({ zone: "command", card });
    }
  }
  for (const card of player.rush) {
    if (isMothershipEligibleCommand(definitions, card, category)) {
      results.push({ zone: "rush", card });
    }
  }

  return results;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  if (size === 1) return items.map((item) => [item]);

  const sets: T[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    const head = items[i]!;
    for (const tail of combinations(items.slice(i + 1), size - 1)) {
      sets.push([head, ...tail]);
    }
  }
  return sets;
}

/** 合法ラッシュアクション用の指定枚数の異なるホールドセット。 */
export function listMothershipHoldSets(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  kind: ActiveMothership | MothershipKind,
  holdsRequired: number,
): string[][] {
  if (holdsRequired <= 0) return [[]];

  const category = mothershipCategoryOf(kind);
  const eligible = collectMothershipEligibleCommands(player, definitions, category);
  if (eligible.length < holdsRequired) return [];

  return combinations(eligible, holdsRequired).map((entries) =>
    entries.map((entry) => entry.card.instanceId),
  );
}

export function applyMothershipHolds(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  holdInstanceIds: string[],
  kind: ActiveMothership | MothershipKind,
): PlayerState | null {
  const category = mothershipCategoryOf(kind);
  if (holdInstanceIds.length === 0) return player;

  let nextPlayer = player;
  const used = new Set<string>();
  let newlyHeld = 0;

  for (const instanceId of holdInstanceIds) {
    if (used.has(instanceId)) return null;
    used.add(instanceId);

    const commandIndex = nextPlayer.command.findIndex((c) => c.instanceId === instanceId);
    if (commandIndex >= 0) {
      const card = nextPlayer.command[commandIndex]!;
      if (card.mothershipHold) {
        continue;
      }
      if (!isMothershipEligibleCommand(definitions, card, category, "command")) return null;
      const command = [...nextPlayer.command];
      command[commandIndex] = { ...card, commandHeld: true, mothershipHold: true };
      nextPlayer = { ...nextPlayer, command };
      newlyHeld += 1;
      continue;
    }

    const rushIndex = nextPlayer.rush.findIndex((c) => c.instanceId === instanceId);
    if (rushIndex >= 0) {
      const card = nextPlayer.rush[rushIndex]!;
      if (card.mothershipHold) {
        continue;
      }
      if (!isMothershipEligibleCommand(definitions, card, category)) return null;
      const rush = [...nextPlayer.rush];
      rush[rushIndex] = { ...card, commandHeld: true, mothershipHold: true };
      nextPlayer = { ...nextPlayer, rush };
      newlyHeld += 1;
      continue;
    }

    return null;
  }

  // RS-260 バイオドラゴン【母艦】「…ホールドし、自軍山札の上から1枚を自軍パワーゾーンに置く」（代用1回につき1枚）。
  if (typeof kind !== "string" && kind.topDeckToPower && newlyHeld > 0) {
    const moved = nextPlayer.deck.slice(0, newlyHeld);
    nextPlayer = {
      ...nextPlayer,
      deck: nextPlayer.deck.slice(moved.length),
      power: [...nextPlayer.power, ...moved.map((c) => ({ ...c, faceDown: false }))],
    };
  }

  return nextPlayer;
}

export function validateMothershipHolds(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  kind: ActiveMothership | MothershipKind,
  holdInstanceIds: string[],
  holdsRequired: number,
): boolean {
  if (holdInstanceIds.length !== holdsRequired) return false;
  if (holdsRequired === 0) return holdInstanceIds.length === 0;

  const allowed = listMothershipHoldSets(
    player,
    definitions,
    rushingCardId,
    kind,
    holdsRequired,
  );
  const key = [...holdInstanceIds].sort().join(",");
  return allowed.some((set) => [...set].sort().join(",") === key);
}

/** コマンド支払い中に既に適用された母艦ホールド（ラッシュ解決前）。 */
export function mothershipHoldsSatisfiedOnPlayer(
  player: PlayerState,
  holdInstanceIds: string[],
  holdsRequired: number,
): boolean {
  if (holdInstanceIds.length !== holdsRequired) return false;
  return holdInstanceIds.every((instanceId) => {
    const card =
      player.command.find((c) => c.instanceId === instanceId) ??
      player.rush.find((c) => c.instanceId === instanceId);
    return card?.mothershipHold === true && card.commandHeld === true;
  });
}

export function validateZordAdditionalPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId?: string,
  materialDestination?: ZordMaterialDestination,
  mothershipHoldInstanceIds?: string[],
  materialInstanceIds?: string[],
): boolean {
  // 状態で変わった追加条件（「※このカードの追加条件は、…のとき、次のように変更される」。RS-440。
  // rules/rushAdditionalCondition.ts withEffectiveRushConditionDefinitions）は、変更後の条件の素材だけで判定する（母艦ホールドでは代えられない）。
  const override = (getDefinition(definitions, rushingCardId) as { rushAdditionalConditionOverride?: unknown } | undefined)
    ?.rushAdditionalConditionOverride;
  if (override) {
    if ((mothershipHoldInstanceIds ?? []).length > 0) return false;
    const ids = materialInstanceIds ?? (materialInstanceId ? [materialInstanceId] : []);
    if (ids.length === 0) return false;
    return validateFieldZordMaterials(player, definitions, rushingCardId, rushingInstanceId, ids, materialDestination);
  }
  const condition = getZordCondition(rushingCardId);
  if (!condition) return true;
  if (
    condition === "state_gate" ||
    condition === "hold_extra_command" ||
    condition === "opponent_draw"
  ) {
    return true;
  }

  const unitSlots = mothershipHoldCountForRush(rushingCardId);
  const kind = canUseMothershipForZordRush(definitions, player, rushingCardId);
  const materialIds =
    materialInstanceIds ?? (materialInstanceId ? [materialInstanceId] : []);
  const hasMaterial = materialIds.length > 0;
  const holdIds = mothershipHoldInstanceIds ?? [];

  if (hasMaterial) {
    if (
      !validateFieldZordMaterials(
        player,
        definitions,
        rushingCardId,
        rushingInstanceId,
        materialIds,
        materialDestination,
        kind !== null && holdIds.length > 0,
      )
    ) {
      return false;
    }
  }

  const slotsFilled =
    hasMaterial && condition && isSendSUnitZordCondition(condition)
      ? materialIds.length
      : zordSlotsFilledByMaterial(rushingCardId, hasMaterial, materialDestination === "hold" ? "discard" : materialDestination); // XG1-013 hold は捨札のかわり

  if (
    kind?.kind === "jaguar" &&
    hasMaterial &&
    materialDestination === "discard"
  ) {
    if (holdIds.length > 0) return false;
    return slotsFilled >= unitSlots;
  }

  const holdsRequired =
    kind && hasMaterial && !jaguarMothershipAllowedWithMaterial(rushingCardId, materialDestination === "hold" ? "discard" : materialDestination)
      ? 0
      : kind
        ? mothershipHoldsRequiredForRush(rushingCardId, slotsFilled)
        : 0;

  if (holdsRequired > 0) {
    if (!kind) return false;
    // faq-card-2 RS-075 Q2 — コマンドゾーンに送る素材そのものを残りの母艦ホールドにできる。
    const selfHolds = mothershipSelfHoldMaterialIds(
      player,
      definitions,
      kind,
      materialIds,
      materialDestination,
    ).filter((id) => holdIds.includes(id));
    const otherHolds = holdIds.filter((id) => !selfHolds.includes(id));
    const othersRequired = holdsRequired - selfHolds.length;
    if (othersRequired < 0) return false;
    if (mothershipHoldsSatisfiedOnPlayer(player, otherHolds, othersRequired)) {
      return true;
    }
    return validateMothershipHolds(
      player,
      definitions,
      rushingCardId,
      kind,
      otherHolds,
      othersRequired,
    );
  }

  if (holdIds.length > 0) return false;

  if (slotsFilled >= unitSlots) return true;

  if (!hasMaterial && kind) {
    return canPayZordWithMothership(player, definitions, rushingCardId);
  }

  return false;
}

export function canPayZordWithMothership(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): boolean {
  const kind = canUseMothershipForZordRush(definitions, player, rushingCardId);
  if (!kind) return false;
  const required = mothershipHoldsRequiredForRush(rushingCardId, 0);
  return (
    listMothershipHoldSets(player, definitions, rushingCardId, kind, required).length > 0
  );
}

export type ZordRushPaymentVariant = {
  zordMaterialInstanceId?: string;
  zordMaterialInstanceIds?: string[];
  zordMaterialDestination?: ZordMaterialDestination;
  zordMothershipHoldInstanceIds?: string[];
  zordExtraCommandHoldInstanceIds?: string[];
};

/** 1回のラッシュに対する合法なゾード素材 / 母艦の全組み合わせ。 */
export function listZordRushPaymentVariants(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materials: CardInstance[],
  commandZoneHasSpace: boolean,
): ZordRushPaymentVariant[] {
  const variants: ZordRushPaymentVariant[] = [];
  const condition = getZordCondition(rushingCardId);
  const kind = canUseMothershipForZordRush(definitions, player, rushingCardId);

  const pushIfValid = (variant: ZordRushPaymentVariant) => {
    const materialIds =
      variant.zordMaterialInstanceIds ??
      (variant.zordMaterialInstanceId ? [variant.zordMaterialInstanceId] : []);
    if (
      validateZordAdditionalPayment(
        player,
        definitions,
        rushingCardId,
        rushingInstanceId,
        variant.zordMaterialInstanceId ?? materialIds[0],
        variant.zordMaterialDestination,
        variant.zordMothershipHoldInstanceIds,
        materialIds.length > 0 ? materialIds : undefined,
      )
    ) {
      variants.push(variant);
    }
  };

  const fieldVariants = listFieldZordRushVariants(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    commandZoneHasSpace,
  );

  for (const fieldVariant of fieldVariants) {
    const materialId =
      fieldVariant.zordMaterialInstanceId ?? fieldVariant.zordMaterialInstanceIds?.[0];
    const slotsFilled = materialId ? 1 : 0;
    const holdsRequired = kind
      ? mothershipHoldsRequiredForRush(rushingCardId, slotsFilled)
      : 0;

    if (kind && holdsRequired > 0) {
      for (const holdIds of listMothershipHoldSets(
        player,
        definitions,
        rushingCardId,
        kind,
        holdsRequired,
      )) {
        pushIfValid({
          ...fieldVariant,
          zordMothershipHoldInstanceIds: holdIds.length > 0 ? holdIds : undefined,
        });
      }
    } else {
      pushIfValid(fieldVariant);
    }
  }

  if (kind) {
    for (const holdIds of listMothershipHoldSets(
      player,
      definitions,
      rushingCardId,
      kind,
      mothershipHoldsRequiredForRush(rushingCardId, 0),
    )) {
      pushIfValid({
        zordMothershipHoldInstanceIds: holdIds.length > 0 ? holdIds : undefined,
      });
    }
  }

  return variants;
}

/** ゾードアップの全支払いパターン（state_gate / 拡張素材 / ホールド / フィールド素材）。 */
export function listZordUpRushPaymentVariants(
  state: GameState,
  playerId: PlayerId,
  rushingCardId: string,
  rushingInstanceId: string,
): ZordRushPaymentVariant[] {
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, rushingCardId);
  const condition = resolveRushAdditionalCondition(rushingCardId, def);
  if (!condition) return [];

  if (requiresAllFusionPartners(rushingCardId)) {
    return [{}];
  }

  if (condition.conditionId === "state_gate") {
    return evaluateStateGate(state, playerId, condition) ? [{}] : [];
  }

  if (condition.conditionId === "opponent_draw") {
    return [{}];
  }

  if (condition.conditionId === "hold_extra_command") {
    return listHoldExtraCommandVariants(player, state.definitions, rushingCardId);
  }

  if (
    condition.conditionId === "return_named_to_hand" ||
    condition.conditionId === "discard_operation_cards" ||
    condition.conditionId === "discard_category_l_unit" ||
    condition.conditionId === "discard_command_card" ||
    condition.conditionId === "discard_all_hand" ||
    condition.conditionId === "discard_hand_card" ||
    condition.conditionId === "discard_generic_unit" ||
    condition.conditionId === "discard_all_face_up_power"
  ) {
    return listExtendedZordRushVariants(
      player,
      state.definitions,
      rushingCardId,
      rushingInstanceId,
    );
  }

  const materials = collectZordMaterials(
    player,
    state.definitions,
    rushingCardId,
    rushingInstanceId,
  );
  return listZordRushPaymentVariants(
    player,
    state.definitions,
    rushingCardId,
    rushingInstanceId,
    materials,
    player.command.length < COMMAND_ZONE_MAX,
  );
}
