import type { CardDefinition, UnitSize } from "@rangers-strike/cards";
import {
  cardCategories,
  getCardById,
  hasUnnamedRule,
  printedPowerCostNumber,
  type Category,
} from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import type { SpFraction, SpValue } from "@rangers-strike/cards";
import type { ZordMaterialDestination } from "../types/actions";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { hasCommandForCardUse } from "../rules/restrictions";
import { isDslPermanentOperation } from "../dsl/dslCatalog";
import {
  cardHasGrantKeyword,
  promotedKeywordBpBonus,
  rideMountedVehicleBpBonus,
} from "../dsl/promotedKeywordBridge";
import { passiveNamedFieldBpBonus } from "../rules/fieldAuras";
import { srBigBatonBpFloor } from "../rules/srEffects";
import { rs339AddsDaCategory } from "../rules/rs/rsCatchallField";
import { legend3EnemySComboDelta } from "../rules/legend3/fieldEffects";
import { validateZordAdditionalPayment } from "../rules/mothership";
import {
  collectZordDownMaterials,
  needsZordDownPayment,
  usesZordDownZeroCost,
  validateZordDownPayment,
} from "../rules/zordDown";
import { collectZordMaterials, hasAllRequiredFusionMaterials, needsZordMaterial, requiresAllFusionPartners } from "../rules/zord";
import {
  evaluateStateGate,
  needsHoldExtraCommand,
  needsOpponentDrawCost,
  needsZordExtendedMaterial,
  needsZordStateGate,
  validateExtendedZordPayment,
  validateFieldZordMaterials,
  validateHoldExtraCommandPayment,
} from "../rules/zordExtended";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import { isShironLightRushTarget } from "../rules/shironLight";
import { getAuraPowerInstanceId, getComboNumberDelta } from "../rules/turnModifierBridge";
import { opponentInfiniteChainBlocks } from "../rules/turnModifiers";
import { heldCallLeadMatchesCategories } from "../rules/callLead";
import { heldUndeadCommandRushHoldMatches } from "../rules/undeadCommandRushHold";
import {
  blastBypassesRushAdditionalCondition,
  breakerBlocksSameNameRush,
} from "../keywords/battleKeywords";
import { effectiveRushAdditionalCondition } from "../rules/rushAdditionalCondition";
import { countHeldCommands } from "../rules/restrictions";
import { countAvailablePower, effectivePowerCost, rushEffectivePowerCost } from "./power";

export function buildDefinitionMap(
  decks: CardDefinition[][],
): Record<string, CardDefinition> {
  const map: Record<string, CardDefinition> = {};
  for (const deck of decks) {
    for (const card of deck) {
      map[card.id] = card;
    }
  }
  return map;
}

/** カード印刷の必要パワー数字（+/- サフィックス除去）。 */
export function parsePowerCost(cost: number | string | undefined): number {
  return printedPowerCostNumber(cost);
}

export function rushPowerCost(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  playerId: PlayerId,
  definition: CardDefinition,
  options?: {
    zordMaterialInstanceId?: string;
    zordMaterialInstanceIds?: string[];
  },
): number {
  if (
    usesZordDownZeroCost(
      state.definitions,
      definition.id,
      options?.zordMaterialInstanceId,
      options?.zordMaterialInstanceIds,
    )
  ) {
    return 0;
  }
  return rushEffectivePowerCost(
    state,
    playerId,
    parsePowerCost(definition.powerCost),
    definition.id,
  );
}

export function isSpFraction(sp: SpValue | undefined): sp is SpFraction {
  return typeof sp === "string" && sp.includes("/");
}

export function strikeDamage(sp: SpValue | undefined, battlePosition?: number): number {
  if (typeof sp === "number") return sp;
  if (isSpFraction(sp)) {
    if (battlePosition === undefined) return 0;
    return battlePosition === Number(sp.split("/")[1]) ? 1 : 0;
  }
  return 1;
}

export function unitBp(definition: CardDefinition | undefined): number {
  return definition?.bp ?? 0;
}

export function instanceBp(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
): number {
  return unitBp(getDefinition(definitions, instance.cardId)) + (instance.bpModifier ?? 0);
}

export function getDefinition(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): CardDefinition | undefined {
  return definitions[cardId];
}

/** ゲーム状態の定義にフィールドが欠けている場合、完全なカードカタログにフォールバック。 */
export function resolveUnitSize(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): UnitSize | undefined {
  return getDefinition(definitions, cardId)?.size ?? getCardById(cardId)?.size;
}

export function isMediumUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return resolveUnitSize(definitions, cardId) === "M";
}

export function isUnit(
  definition: CardDefinition | undefined,
): definition is CardDefinition & { type: "unit" } {
  return definition?.type === "unit";
}

export function isVehicle(definition: CardDefinition | undefined): boolean {
  return definition?.type === "vehicle";
}

/** 手札からラッシュエリアへ出せるカード（ユニット / ビークル）。 */
export function isRushable(definition: CardDefinition | undefined): boolean {
  return definition?.type === "unit" || definition?.type === "vehicle";
}

/** ラッシュエリアからバトルエリアへ進入できるカード。 */
export function canEnterBattleFromRush(
  definition: CardDefinition | undefined,
): boolean {
  return definition?.type === "unit" || definition?.type === "vehicle";
}

export function isOperation(definition: CardDefinition | undefined): boolean {
  return definition?.type === "operation";
}

export function isPermanentOperation(definition: CardDefinition | undefined): boolean {
  if (!isOperation(definition)) return false;
  const effect = getCardEffect(definition!.id);
  if (effect?.kind === "permanent") return true;
  if (definition?.tags?.includes("常駐")) return true;
  if (definition?.text?.includes("※常駐")) return true;
  return isDslPermanentOperation(definition!.id);
}

export function isCounterOperation(definition: CardDefinition | undefined): boolean {
  if (!isOperation(definition)) return false;
  const effect = getCardEffect(definition!.id);
  if (effect?.kind === "counter") return true;
  return definition?.tags?.includes("カウンター") ?? false;
}

export function cardName(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): string {
  return getDefinition(definitions, cardId)?.name ?? cardId;
}

export function hasOperationEffect(
  player: PlayerState,
  effectId: string,
  definitions: Record<string, CardDefinition>,
  context?: { state: GameState; playerId: PlayerId },
): boolean {
  const active = player.operation.some(
    (card) => getCardEffect(card.cardId)?.effectId === effectId,
  );
  if (!active) return false;
  if (context && opponentInfiniteChainBlocks(context.state, context.playerId)) {
    return false;
  }
  return true;
}

export function isSmallUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return getDefinition(definitions, cardId)?.size === "S";
}

export function isLargeUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return getDefinition(definitions, cardId)?.size === "L";
}

/** RS-015 減少 + RS-140 データ解析（敵場のコロンで自軍SのCN+1）。 */
export function effectiveComboNumber(
  state: GameState,
  playerId: PlayerId,
  rawComboNumber: number,
  cardId?: string,
): number {
  const turnDelta = getComboNumberDelta(state.players[playerId]);
  let effective =
    rawComboNumber <= 2 ? rawComboNumber : Math.max(2, rawComboNumber - turnDelta);
  if (cardId && isSmallUnit(state.definitions, cardId)) {
    effective += legend3EnemySComboDelta(state, playerId);
  }
  return effective;
}

/** 場の常駐オペレーションによるパッシブBPボーナス。 */
export function passiveBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const player = state.players[playerId];
  let bonus = 0;

  if (
    hasOperationEffect(player, "ki_power", state.definitions) &&
    state.activePlayer !== playerId &&
    isSmallUnit(state.definitions, instance.cardId)
  ) {
    const inField =
      player.rush.some((c) => c.instanceId === instance.instanceId) ||
      player.battle.some((c) => c.instanceId === instance.instanceId);
    if (inField) {
      const released = player.command.filter((c) => !c.commandHeld).length;
      bonus += released * 1000;
    }
  }

  const auraTarget = getAuraPowerInstanceId(player);
  if (
    auraTarget === instance.instanceId &&
    isSmallUnit(state.definitions, instance.cardId)
  ) {
    bonus += player.damage * 2000;
  }

  return bonus;
}

/** RS-019: Sユニット攻撃時の任意BP上昇。 */
export function superPowerAttackBonus(
  state: GameState,
  playerId: PlayerId,
  attacker: CardInstance,
): number {
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "super_power", state.definitions)) return 0;
  if (!isSmallUnit(state.definitions, attacker.cardId)) return 0;
  return countHeldCommands(player) * 1000;
}

export function effectiveBp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const base =
    instanceBp(state.definitions, instance) +
    passiveBpBonus(state, playerId, instance) +
    passiveNamedFieldBpBonus(state, playerId, instance, "general") +
    promotedKeywordBpBonus(state, playerId, instance) +
    rideMountedVehicleBpBonus(state, playerId, instance);
  const floor = srBigBatonBpFloor(state, playerId, instance);
  return floor > 0 ? Math.max(base, floor) : base;
}

export { cardCategories };

/** RS-166: 戦闘中にMAカテゴリ。 */
export function unitEffectiveCategories(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  zone: "battle" | "rush",
): Category[] {
  const def = getDefinition(state.definitions, instance.cardId);
  const cats = cardCategories(def);
  if (zone === "battle" && hasUnnamedRule(instance.cardId, "battle_adds_ma_category")) {
    return cats.includes("MA") ? cats : [...cats, "MA"];
  }
  if (
    zone === "battle" &&
    (hasUnnamedRule(instance.cardId, "category_wb_in_battle") ||
      cardHasGrantKeyword(instance.cardId, "category_wb_in_battle"))
  ) {
    return cats.includes("WB") ? cats : [...cats, "WB"];
  }
  // XG6-021/022: 自軍バトルフェイズ中はカテゴリに WB が追加される
  if (
    state.phase === "battle" &&
    state.activePlayer === playerId &&
    cardHasGrantKeyword(instance.cardId, "category_wb_battle_phase")
  ) {
    return cats.includes("WB") ? cats : [...cats, "WB"];
  }
  // RS-315: gains WB category when in battle zone
  if (zone === "battle" && instance.cardId === "RS-315") {
    return cats.includes("WB") ? cats : [...cats, "WB"];
  }
  // RS-535: gains ドラゴン feature when in battle (handled via features, not here)
  // XG7-055 through XG7-059: gain category during own turn (also in command zone)
  if (state.activePlayer === playerId) {
    let extra: Category | null = null;
    if (instance.cardId === "XG7-055") extra = "ET";
    else if (instance.cardId === "XG7-056") extra = "MA";
    else if (instance.cardId === "XG7-057") extra = "WB";
    else if (instance.cardId === "XG7-059") extra = "OT";
    if (extra !== null) {
      return cats.includes(extra) ? cats : [...cats, extra];
    }
  }
  if (rs339AddsDaCategory(state, playerId, instance.cardId)) {
    return cats.includes("DA") ? cats : [...cats, "DA"];
  }
  return cats;
}

const YOGOSTEIN_CARD_ID = "XG1-033";

function yogosteinGrantsDa(player: PlayerState): boolean {
  return (
    player.rush.some((c) => c.cardId === YOGOSTEIN_CARD_ID) ||
    player.battle.some((c) => c.cardId === YOGOSTEIN_CARD_ID)
  );
}

/** XG1-033: コマンドの実効カテゴリ（汚れた大地で DA 付与）。 */
export function effectiveCommandCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  cardId: string,
): Category[] {
  const def = getDefinition(definitions, cardId);
  const printed = cardCategories(def);
  if (!yogosteinGrantsDa(player)) return printed;
  if (printed.includes("DA")) return printed;
  if (parsePowerCost(def?.powerCost) > 3) return printed;
  return [...printed, "DA"];
}

/** コマンドゾーンに必要カテゴリがすべて揃っているか（atwiki 1559）。 */
export function allCategoriesExistInCommandZone(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;

  const present = new Set<Category>();
  for (const cmd of player.command) {
    for (const cat of effectiveCommandCategories(player, definitions, cmd.cardId)) {
      present.add(cat);
    }
  }
  return categories.every((cat) => present.has(cat));
}

export function hasHeldCommandForCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;
  if (!allCategoriesExistInCommandZone(player, definitions, categories)) return false;

  return player.command.some((cmd) => {
    if (!cmd.commandHeld || cmd.mothershipHold) return false;
    const cmdCats = effectiveCommandCategories(player, definitions, cmd.cardId);
    return categories.some((cat) => cmdCats.includes(cat));
  });
}

/** リリース状態で、指定カテゴリのいずれかに合うコマンドをホールド支払いできるか。 */
export function hasReleasedCommandForCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;
  if (!allCategoriesExistInCommandZone(player, definitions, categories)) return false;

  return player.command.some((cmd) => {
    if (cmd.commandHeld) return false;
    const cmdCats = effectiveCommandCategories(player, definitions, cmd.cardId);
    return categories.some((cat) => cmdCats.includes(cat));
  });
}

export function canRushUnit(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  unitDefinition: CardDefinition,
  rushingInstanceId: string,
  zordMaterialInstanceId?: string,
  zordMothershipHoldInstanceIds?: string[],
  zordMaterialDestination?: ZordMaterialDestination,
  powerBudget?: number,
  powerContext?: Pick<GameState, "players" | "definitions" | "activePlayer"> & {
    playerId: PlayerId;
  },
  zordMaterialInstanceIds?: string[],
  zordExtraCommandHoldInstanceIds?: string[],
): boolean {
  const unitCats = cardCategories(unitDefinition);
  if (
    unitCats.length > 0 &&
    !isShironLightRushTarget(player, rushingInstanceId) &&
    !hasHeldCommandForCategories(player, definitions, unitCats) &&
    !heldCallLeadMatchesCategories(player, definitions, "call", unitCats) &&
    !heldUndeadCommandRushHoldMatches(player, unitDefinition.id, definitions)
  ) {
    return false;
  }

  return evaluateRushPowerAndZord(
    player,
    definitions,
    unitDefinition,
    rushingInstanceId,
    zordMaterialInstanceId,
    zordMothershipHoldInstanceIds,
    zordMaterialDestination,
    powerBudget,
    powerContext,
    zordMaterialInstanceIds,
    zordExtraCommandHoldInstanceIds,
  );
}

function evaluateRushPowerAndZord(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  unitDefinition: CardDefinition,
  rushingInstanceId: string,
  zordMaterialInstanceId?: string,
  zordMothershipHoldInstanceIds?: string[],
  zordMaterialDestination?: ZordMaterialDestination,
  powerBudget?: number,
  powerContext?: Pick<GameState, "players" | "definitions" | "activePlayer"> & {
    playerId: PlayerId;
  },
  zordMaterialInstanceIds?: string[],
  zordExtraCommandHoldInstanceIds?: string[],
): boolean {
  const isZordDown = needsZordDownPayment(
    unitDefinition.id,
    unitDefinition.powerCost,
    unitDefinition,
  );
  const usedZordDown =
    isZordDown &&
    Boolean(
      zordMaterialInstanceId ||
        (zordMaterialInstanceIds?.length ?? 0) > 0 ||
        (zordMothershipHoldInstanceIds?.length ?? 0) > 0,
    );
  const rawCost = parsePowerCost(unitDefinition.powerCost);
  const cost = usedZordDown
    ? 0
    : powerContext
      ? rushEffectivePowerCost(powerContext, powerContext.playerId, rawCost, unitDefinition.id)
      : rawCost;
  const budget =
    powerBudget ??
    (powerContext
      ? countAvailablePower(powerContext, powerContext.playerId)
      : player.power.length);

  if (!usedZordDown && budget < cost) {
    return false;
  }

  if (
    isZordDown &&
    usedZordDown &&
    !validateZordDownPayment(
      player,
      definitions,
      unitDefinition.id,
      rushingInstanceId,
      zordMaterialInstanceId,
      zordMaterialDestination,
      zordMaterialInstanceIds,
    )
  ) {
    return false;
  }

  if (isZordDown) {
    return true;
  }

  const resolved = powerContext
    ? effectiveRushAdditionalCondition(
        powerContext,
        powerContext.playerId,
        unitDefinition.id,
        unitDefinition,
      )
    : resolveRushAdditionalCondition(unitDefinition.id, unitDefinition);

  if (needsZordStateGate(definitions, unitDefinition.id)) {
    if (!powerContext || !resolved) return false;
    return evaluateStateGate(powerContext, powerContext.playerId, resolved);
  }

  if (needsOpponentDrawCost(definitions, unitDefinition.id)) {
    return true;
  }

  if (needsHoldExtraCommand(definitions, unitDefinition.id)) {
    const holdIds = zordExtraCommandHoldInstanceIds ?? [];
    if (holdIds.length === 0) return false;
    return validateHoldExtraCommandPayment(
      player,
      definitions,
      unitDefinition.id,
      holdIds,
    );
  }

  if (needsZordExtendedMaterial(definitions, unitDefinition.id)) {
    const ids =
      zordMaterialInstanceIds ??
      (zordMaterialInstanceId ? [zordMaterialInstanceId] : []);
    if (ids.length === 0) return false;
    return validateExtendedZordPayment(
      player,
      definitions,
      unitDefinition.id,
      rushingInstanceId,
      ids,
    );
  }

  if (
    powerContext &&
    blastBypassesRushAdditionalCondition(powerContext, powerContext.playerId, unitDefinition.id)
  ) {
    return true;
  }

  if (breakerBlocksSameNameRush(player, definitions, unitDefinition.id)) {
    return false;
  }

  if (!needsZordMaterial(definitions, unitDefinition.id)) return true;

  if (requiresAllFusionPartners(unitDefinition.id)) {
    return hasAllRequiredFusionMaterials(
      player,
      definitions,
      unitDefinition.id,
      rushingInstanceId,
    );
  }

  const fieldIds =
    zordMaterialInstanceIds ??
    (zordMaterialInstanceId ? [zordMaterialInstanceId] : []);
  if (fieldIds.length > 0) {
    if (
      !validateFieldZordMaterials(
        player,
        definitions,
        unitDefinition.id,
        rushingInstanceId,
        fieldIds,
        zordMaterialDestination,
      )
    ) {
      return false;
    }
    return validateZordAdditionalPayment(
      player,
      definitions,
      unitDefinition.id,
      rushingInstanceId,
      fieldIds[0],
      zordMaterialDestination,
      zordMothershipHoldInstanceIds,
    );
  }

  return validateZordAdditionalPayment(
    player,
    definitions,
    unitDefinition.id,
    rushingInstanceId,
    zordMaterialInstanceId,
    zordMaterialDestination,
    zordMothershipHoldInstanceIds,
  );
}

/** カテゴリホールドを除くラッシュ合法性（パワー、ゾード支払い等は引き続き判定）。 */
export function canRushUnitExceptCommandHold(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  unitDefinition: CardDefinition,
  rushingInstanceId: string,
  zordMaterialInstanceId?: string,
  zordMothershipHoldInstanceIds?: string[],
  zordMaterialDestination?: ZordMaterialDestination,
  powerBudget?: number,
  powerContext?: Pick<GameState, "players" | "definitions" | "activePlayer"> & {
    playerId: PlayerId;
  },
  zordMaterialInstanceIds?: string[],
  zordExtraCommandHoldInstanceIds?: string[],
): boolean {
  return evaluateRushPowerAndZord(
    player,
    definitions,
    unitDefinition,
    rushingInstanceId,
    zordMaterialInstanceId,
    zordMothershipHoldInstanceIds,
    zordMaterialDestination,
    powerBudget,
    powerContext,
    zordMaterialInstanceIds,
    zordExtraCommandHoldInstanceIds,
  );
}

export function canPlayOperationExceptCommandHold(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
): boolean {
  const cost = effectivePowerCost(state, playerId, parsePowerCost(definition.powerCost));
  return countAvailablePower(state, playerId) >= cost;
}

export function canPlayOperation(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
): boolean {
  const player = state.players[playerId];
  if (!canPlayOperationExceptCommandHold(state, playerId, definition)) return false;

  const opCats = cardCategories(definition);
  return hasCommandForCardUse(player, state.definitions, opCats, "lead");
}

export { needsZordMaterial } from "../rules/zord";
export { needsHoldExtraCommand } from "../rules/zordExtended";
