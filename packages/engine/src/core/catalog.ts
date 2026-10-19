import { rm1DorugiranWaivesCondition } from "../rules/rm/rm1Fields";
import { isAccelerateRushWaived } from "../rules/bkOperationTurnRules";
import { isCostWindowSatisfied } from "./costWindow";
import { set8AddedCategories } from "../rules/legend1/set8TurnGrants";
import { operationPaymentCategories } from "../rules/legend1/set5NamedEffectsA";
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
import { unitFeatures } from "../rules/addedFeatures";
import { rk5AddedCategories, rk5BpSetValue } from "../rules/rk/rk5Fields";
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
import { getAuraPowerInstanceId, getComboNumberDelta, sComboFinisherSetValues } from "../rules/turnModifierBridge";
import { opponentInfiniteChainBlocks } from "../rules/turnModifiers";
import { heldCallLeadMatchesCategories } from "../rules/callLead";
import { heldUndeadCommandRushHoldMatches } from "../rules/undeadCommandRushHold";
import {
  blastBypassesRushAdditionalCondition,
  breakerBlocksSameNameRush,
} from "../keywords/battleKeywords";
import { effectiveRushAdditionalCondition } from "../rules/rushAdditionalCondition";
import { set5PassiveBpBonus } from "../rules/legend1/set5NamedEffects";
import { countAvailablePower, effectivePowerCost, rushEffectivePowerCost } from "./power";
import { rk11CounterCostReduction } from "../rules/rk/rk11Fields";
import { rk12ResidentsNegated } from "../rules/rk/rk12Fields";
import { memoizePerCardInSearch } from "./searchCache";

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

/**
 * サイズを判定するカード: カード ID（定義のサイズ）か、場のカードのインスタンス（効果で変わったサイズを含む）。
 * 場のユニットは、インスタンスを渡すと次の効果を反映する（文字列の ID を渡すと定義のサイズのまま）。
 * - RK-013 Jパワー・RS-255 巨大化爆弾を重ねたユニットは「Lユニット」（重ねたカードは stackedCards。atwiki/page-211・page-300）。
 *   J パワーはエンジン全体で L 扱い（ユーザー決定 2026-10-19、docs/rules/README.md §5.7 p）。
 * - RK-154【頭が高い！】で、このターン S ユニットになった M ユニット（sizeOverride）。
 */
export type SizedCard = string | (Pick<CardInstance, "cardId"> & Partial<Pick<CardInstance, "stackedCards" | "sizeOverride">>);

/** 重ねたユニットを「Lユニット」にするカード（RK-013 Jパワー・RS-255 巨大化爆弾）。 */
// XG5-012 ゴレムカード「このカードに重ねたユニットはLユニットになる」（atwiki/page-2192）。
const LARGE_STACK_CARD_IDS = ["RK-013", "RS-255", "XG5-012"];

/** インスタンスの効果によるサイズ（なければ undefined）。サイズの判定のたびに呼ばれるので、重ねたカードがなければすぐ返す。 */
function instanceSizeOverride(card: SizedCard): UnitSize | undefined {
  if (typeof card === "string") return undefined;
  if (card.sizeOverride) return card.sizeOverride;
  const stacked = card.stackedCards;
  if (stacked === undefined || stacked.length === 0) return undefined;
  for (const c of stacked) if (LARGE_STACK_CARD_IDS.includes(c.cardId)) return "L";
  return undefined;
}

function sizedCardId(card: SizedCard): string {
  return typeof card === "string" ? card : card.cardId;
}

/** いまのサイズ（場のインスタンスなら効果で変わったサイズ。SizedCard を参照）。 */
export function unitSizeOf(definitions: Record<string, CardDefinition>, card: SizedCard): UnitSize | undefined {
  return instanceSizeOverride(card) ?? getDefinition(definitions, sizedCardId(card))?.size;
}

/** ゲーム状態の定義にフィールドが欠けている場合、完全なカードカタログにフォールバック。 */
export function resolveUnitSize(
  definitions: Record<string, CardDefinition>,
  card: SizedCard,
): UnitSize | undefined {
  const cardId = sizedCardId(card);
  return instanceSizeOverride(card) ?? getDefinition(definitions, cardId)?.size ?? getCardById(cardId)?.size;
}

export function isMediumUnit(
  definitions: Record<string, CardDefinition>,
  card: SizedCard,
): boolean {
  return resolveUnitSize(definitions, card) === "M";
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
  // RK-248 パラダイス・ロスト: このターン、相手の常駐オペレーションは無効（rules/rk/rk12Fields.ts）。
  if (context && rk12ResidentsNegated(context.state, context.playerId)) return false;
  return true;
}

export function isSmallUnit(
  definitions: Record<string, CardDefinition>,
  card: SizedCard,
): boolean {
  return unitSizeOf(definitions, card) === "S";
}

export function isLargeUnit(
  definitions: Record<string, CardDefinition>,
  card: SizedCard,
): boolean {
  return unitSizeOf(definitions, card) === "L";
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
/**
 * XG2-052 ユナイトベント「ターゲットは、ウラ向きに重ねたカード1枚につきBP+2000され…」— ユナイトベント（オモテ向き）を下に重ねた
 * ターゲット。ウラ向きのカードには白熱する実況（RS-437）で重ねたカードも含む（atwiki/page-1761 Q4）。
 */
export function uniteVentBpBonus(instance: Pick<CardInstance, "stackedCards">): number {
  const stacked = instance.stackedCards ?? [];
  if (!stacked.some((c) => c.cardId === "XG2-052" && !c.faceDown)) return 0;
  return 2000 * stacked.filter((c) => c.faceDown).length;
}

export function passiveBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const player = state.players[playerId];
  // RS-340/343【ゲキヌンチャク】（rules/legend1/set5NamedEffects.ts）。
  let bonus = set5PassiveBpBonus(state, playerId, instance);

  const inField =
    player.rush.some((c) => c.instanceId === instance.instanceId) ||
    player.battle.some((c) => c.instanceId === instance.instanceId);
  if (inField && isSmallUnit(state.definitions, instance.cardId)) {
    // RS-203【デウス遺伝子】・RS-206【天幻星・霧隠れ】で追加された特徴も含める（rules/addedFeatures.ts）。
    // 特徴は、特徴で決まるオーラの常駐オペレーションがあるときだけ求める。
    let features: string[] | undefined;
    for (const op of player.operation) {
      const aura = permanentSUnitBpAura(state.definitions, op.cardId);
      if (!aura) continue;
      // RS-017／RS-246 気力（常駐）: 敵軍ターン中、リリース状態の自軍コマンド1つにつき BP＋（枚数分重複、R-CONT-01）。
      if (aura.kind === "per_released_command_enemy_turn") {
        if (state.activePlayer === playerId) continue;
        const released = player.command.filter((c) => !c.commandHeld).length;
        bonus += released * aura.amount;
      } else if ((features ??= unitFeatures(state, playerId, instance)).includes(aura.feature)) {
        // RS-179 恐竜やのカレー（常駐）: 特徴「イエロー」を持つ自軍SユニットはBP＋2000（枚数分重複、R-CONT-01）。
        // ルール: R-RUSH-05 — 適用中の継続効果はラッシュの瞬間から反映される（最初から修正済みの状態でラッシュされた扱い）。
        bonus += aura.amount;
      }
    }
  }

  bonus += uniteVentBpBonus(instance);

  const auraTarget = getAuraPowerInstanceId(player);
  if (
    auraTarget === instance.instanceId &&
    isSmallUnit(state.definitions, instance.cardId)
  ) {
    bonus += player.damage * 2000;
  }

  return bonus;
}

/**
 * ルール: R-BP-01 — 「BP○○になる」で指定された値（あれば）。増減の計算より優先される。
 * カードに書き込まれた値（bpSetValue）と、並び順で決まる継続効果（RS-001/RS-002 等）の両方を見る。
 */
export function bpSetValueOf(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  instance: CardInstance,
): number | undefined {
  const current = instance.bpSetValue !== undefined ? instance.bpSetValue : sComboFinisherSetValues(state, playerId, instance)?.bp;
  // RK-091 ゾル大佐【戦闘員の統率】（rules/rk/rk5Fields.ts）。R-BP-01 — 「～になる」が複数あれば低い方を適用する。
  const zol = rk5BpSetValue(state, playerId, instance);
  if (zol === undefined) return current;
  return current === undefined ? zol : Math.min(current, zol);
}

/** 「SP○になる」で指定された値（あれば）。加算ではなく上書き（RS-001/RS-002「「SP1」…になる」）。 */
export function spSetValueOf(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  instance: CardInstance,
): number | undefined {
  return sComboFinisherSetValues(state, playerId, instance)?.sp;
}

type PermanentSUnitBpAura =
  | { kind: "per_released_command_enemy_turn"; amount: number }
  | { kind: "feature"; feature: string; amount: number };

const permanentAuraCache = new Map<string, PermanentSUnitBpAura | null>();

/**
 * 常駐オペレーションの「自軍Sユニットは BP＋される」効果を本文から読む（カード ID ではなく文言で判定。
 * RS-017 と RS-246 の「気力」のように同じ本文のカードは同じ扱い）。
 * - 「すべての自軍Sユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP＋n される」
 * - 「特徴「X」を持つ自軍SユニットはBP＋n される」
 */
export function permanentSUnitBpAura(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): PermanentSUnitBpAura | null {
  const cached = permanentAuraCache.get(cardId);
  if (cached !== undefined) return cached;
  const def = getDefinition(definitions, cardId);
  let aura: PermanentSUnitBpAura | null = null;
  if (def?.type === "operation") {
    const text = (def.text ?? "").replace(/^※常駐（[^）]*）\s*/, "").trim();
    const ki = text.match(/^すべての自軍Sユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP[+＋](\d+)される/);
    const feature = text.match(/^特徴「([^」]+)」を持つ自軍SユニットはBP[+＋](\d+)される。?$/);
    if (ki) aura = { kind: "per_released_command_enemy_turn", amount: Number(ki[1]) };
    else if (feature) aura = { kind: "feature", feature: feature[1]!, amount: Number(feature[2]) };
  }
  permanentAuraCache.set(cardId, aura);
  return aura;
}

const BP_PLUS_INVERT_RE = /ナンバーを持つすべてのSユニットは、BPが「[+＋]」されるかわりにBPが「[-－]」される/;
const bpInvertSourceCache = new Map<string, boolean>();

function isBpPlusInvertSource(definitions: Record<string, CardDefinition>, cardId: string): boolean {
  const cached = bpInvertSourceCache.get(cardId);
  if (cached !== undefined) return cached;
  const result = BP_PLUS_INVERT_RE.test(getDefinition(definitions, cardId)?.text ?? "");
  bpInvertSourceCache.set(cardId, result);
  return result;
}

/**
 * 「これが自軍エリアにある間、ナンバーを持つすべてのSユニットは、BPが「＋」されるかわりにBPが「－」される」
 * （RS-210 ゴーマ16世【大地動転の玉】）が、このユニットに及んでいるか。
 * どちらのプレイヤーのエリア（ラッシュ・バトル）にあっても、敵味方を問わずナンバーを持つ S ユニットすべてに及ぶ。
 * 出典: atwiki/page-107、grnrngr/faq-card-3 RS-179 Q1。
 */
export function bpPlusInvertedFor(
  state: Pick<GameState, "players" | "definitions">,
  instance: CardInstance,
): boolean {
  const def = getDefinition(state.definitions, instance.cardId);
  if (def?.type !== "unit" || def.comboNumber == null) return false;
  if (!isSmallUnit(state.definitions, instance.cardId)) return false;
  for (const p of Object.values(state.players)) {
    for (const c of [...p.rush, ...p.battle]) {
      if (isBpPlusInvertSource(state.definitions, c.cardId)) return true;
    }
  }
  return false;
}

export function effectiveBp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  // CPU の探索の間は、同じ状態・同じカードの BP を使い回す（盤面評価・BP0 の撃破判定・候補の並べ替えで何度も調べる。
  // core/searchCache.ts）。
  return memoizePerCardInSearch(state, "bp", playerId, instance, () => effectiveBpUncached(state, playerId, instance));
}

function effectiveBpUncached(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  // ルール: R-BP-01 — 「BP○○になる」が最優先で、増減は計算しない。
  const setValue = bpSetValueOf(state, playerId, instance);
  if (setValue !== undefined) return setValue;
  // 「BPが「＋」されるかわりにBPが「－」される」（RS-210【大地動転の玉】等）の下では、BP の増加分を減少として数える。
  const invert = bpPlusInvertedFor(state, instance);
  const signed = (delta: number) => (invert && delta > 0 ? -delta : delta);
  const base =
    unitBp(getDefinition(state.definitions, instance.cardId)) +
    signed(instance.bpModifier ?? 0) +
    signed(passiveBpBonus(state, playerId, instance)) +
    signed(passiveNamedFieldBpBonus(state, playerId, instance, "general")) +
    signed(promotedKeywordBpBonus(state, playerId, instance)) +
    signed(rideMountedVehicleBpBonus(state, playerId, instance));
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
  const base = unitEffectiveCategoriesBase(state, playerId, instance, zone);
  // RS-524 呉越同舟「このターン、宣言したカテゴリを選んだユニットに追加する。」（rules/legend1/set8TurnGrants.ts）。
  const declared = set8AddedCategories(state.players[playerId], instance).filter((c) => !base.includes(c));
  const withDeclared = declared.length > 0 ? [...base, ...declared] : base;
  // RK-092 狼男【狼作戦】（rules/rk/rk5Fields.ts）。既に持っているカテゴリは重ねて追加しない。
  const wolf = rk5AddedCategories(state, playerId, instance).filter((c) => !withDeclared.includes(c));
  return wolf.length > 0 ? [...withDeclared, ...wolf] : withDeclared;
}

function unitEffectiveCategoriesBase(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  zone: "battle" | "rush",
): Category[] {
  // RS-350 暗黒の鎧を重ねたユニットは、カテゴリが DA になる（追加ではなく置きかえ）。
  if ((instance.stackedCards ?? []).some((c) => c.cardId === "RS-350")) return ["DA"];
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

  // RM-019 超次元高速機ドルギラン: 自軍捨札にあれば、電子星獣ドル・ギラン円盤は追加条件を満たさなくてよい（rules/rm/rm1Fields.ts）。
  if (powerContext && rm1DorugiranWaivesCondition(powerContext, powerContext.playerId, unitDefinition.id)) return true;
  // BK-017 カブトゼクター◎2つ目: このターン、「加速」の BP2000 以下の S ユニットのカードは追加条件を満たさなくてよい（rules/bkOperationTurnRules.ts）。
  if (powerContext && isAccelerateRushWaived(powerContext, powerContext.playerId, unitDefinition.id)) return true;

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

  if (breakerBlocksSameNameRush(player, definitions, unitDefinition.id)) {
    return false;
  }

  // ブラストが免除するのは追加条件だけ（ブレイカーの同名禁止は免除しない）。ルール: R-KW-BLAST-01
  if (
    powerContext &&
    blastBypassesRushAdditionalCondition(powerContext, powerContext.playerId, unitDefinition.id)
  ) {
    return true;
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
        (zordMothershipHoldInstanceIds?.length ?? 0) > 0,
      )
    ) {
      return false;
    }
    // ルール: R-ADD-04 — 「2体をそれぞれ」は選んだ素材すべてで検証する（先頭1体だけではない）。
    return validateZordAdditionalPayment(
      player,
      definitions,
      unitDefinition.id,
      rushingInstanceId,
      fieldIds[0],
      zordMaterialDestination,
      zordMothershipHoldInstanceIds,
      fieldIds,
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
  // RK-225 仮面ライダー朱鬼【陰陽術】: カウンターを持つオペレーションの必要パワーの数字は3少なくなる（rules/rk/rk11Fields.ts）。
  const printed = Math.max(0, parsePowerCost(definition.powerCost) - rk11CounterCostReduction(state, definition));
  const cost = effectivePowerCost(state, playerId, printed);
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
  if (opCats.length === 0) return true;
  if (isCostWindowSatisfied(player, "operation_category")) {
    // RS-292【虎の子大秘術】: どのカテゴリのコマンドのホールドでも使用できる。
    return hasCommandForCardUse(player, state.definitions, operationPaymentCategories(state, playerId, definition), "lead");
  }
  // ルール: R-CMD-01 — 使用のたびにリリース状態のコマンドをホールドする。別のカードの使用のために
  // 支払いでホールドしたコマンド（paymentHeld）は、このオペレーションの支払いに再利用できない。
  const unspent = { ...player, command: player.command.filter((c) => !(c.paymentHeld && c.commandHeld)) };
  return hasCommandForCardUse(unspent, state.definitions, opCats, "lead");
}

export { needsZordMaterial } from "../rules/zord";
export { needsHoldExtraCommand } from "../rules/zordExtended";
