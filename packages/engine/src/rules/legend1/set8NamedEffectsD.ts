/**
 * 第8弾「究極の八神」（legend1）RS-582〜RS-604 のカード固有の名前付き効果と継続効果（cardSpec RS8-582-604 の監査）。
 *
 * - `trySet8DCardEffect`: DSL の grant_keyword から呼ばれる起点（`set8d::cardId::name`）。
 * - `tryResolveSet8DChoice` / `trySkipSet8DChoice`: このモジュールが開いた選択の解決。
 * - 継続効果（SP・BP・アタックの制限・効果名を持つテキストの無効・「可能ならバトルエリアに出る」の無効）。
 * 構成は rules/legend1/set7NamedEffectsD.ts と同じ。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice } from "../pendingChoices";
import { unitFeatures } from "../addedFeatures";
import { rs603BlocksVehicle } from "../rs/rsCatchallField";
import { namedTextNegated } from "./set6NamedEffects348";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet8DChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet8DChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet8DChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

/** 選択を閉じる。割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入を続ける。 */
function finish(state: GameState, pending: PendingEffectChoice): GameState {
  const stillOpen = state.pendingEffectChoice === pending;
  const cleared: GameState = stillOpen
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
  if (cleared.pendingLeave || cleared.pendingEffectChoice) return cleared;
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

function simpleSkip(): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  };
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function ownFieldHas(state: Pick<GameState, "players">, playerId: PlayerId, cardId: string): CardInstance | undefined {
  return fieldUnits(state, playerId).find((c) => c.cardId === cardId);
}

function definitionCategories(def: CardDefinition | undefined): string[] {
  if (!def?.category) return [];
  return Array.isArray(def.category) ? [...def.category] : [def.category];
}

function hasCategory(state: Pick<GameState, "definitions">, cardId: string, category: string): boolean {
  return definitionCategories(getDefinition(state.definitions, cardId)).includes(category);
}

// ---------------------------------------------------------------------------
// RS-603 蛮機獣ボンベバンキ【超有毒液化ガス】（公式の読み替え後。R-ERR-RS603）
// 「これが自軍エリアにある間、本来の特徴に「車両」を持つユニットはアタックもストライクもできず、効果名を持つテキストは
//  無効になり、発動もできない。」（atwiki/page-1208・grnrngr/faq-card-8 RS-603 Q1）
// アタック・ストライクの制限は rules/rs/rsCatchallField.ts rs603BlocksVehicle。ここでは「効果名を持つテキスト」の無効を扱う
// （rules/legend1/set6NamedEffects348.ts namedTextNegated・set7NamedEffectsD.ts set7DBlocksNc から呼ぶ）。

/** 第8弾の効果で、このユニットの効果名を持つテキストが無効か。 */
export function set8DNamedTextNegated(
  state: Pick<GameState, "players" | "definitions">,
  card: Pick<CardInstance, "cardId">,
): boolean {
  if (getDefinition(state.definitions, card.cardId)?.type !== "unit") return false;
  return rs603BlocksVehicle(state as GameState, "player1", card.cardId);
}

/** 効果名を持つテキスト（このモジュールの名前付き効果）が、いま有効か。 */
function namedTextLive(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return !namedTextNegated(state, ownerId, card);
}

// ---------------------------------------------------------------------------
// ※「これはBP3000以下のユニットにアタックされない。」（RS-587 怒りの鬼神　ガイ・RS-588 大いなる獣　レイ ほか、
//  「BP○○以上のユニットにアタックされない」も同じ文言の型）。文言で判定し、アタックするユニットの BP は効果を含めた値。

const BP_LIMIT_ATTACKED_RE = /これはBP(\d+)(以下|以上)のユニットにアタックされない/;

/** アタックされない制限（rules/legend3/restrictions.ts canAttackDefender から呼ぶ）。 */
export function set8DDefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defender: CardInstance,
): boolean {
  const text = (getDefinition(state.definitions, defender.cardId)?.text ?? "").normalize("NFKC");
  const m = text.match(BP_LIMIT_ATTACKED_RE);
  if (!m) return false;
  const limit = Number(m[1]);
  const bp = effectiveBp(state, attackerPlayerId, attacker);
  return m[2] === "以下" ? bp <= limit : bp >= limit;
}

// ---------------------------------------------------------------------------
// RS-584 ボウケンブラックAT【闇を振り払う心】
// 「自軍パワーのオモテ向きのカードと自軍コマンドゾーンのカードにDA持つカードが1枚もなければ、これは「SP1」になる。
//  また、DAを持つ敵軍ユニットがあれば、これはBP＋3000される。」（atwiki/page-1212）

function darknessDispelActive(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  if (instance.cardId !== "RS-584") return false;
  if (!fieldUnits(state, playerId).some((c) => c.instanceId === instance.instanceId)) return false;
  return namedTextLive(state, playerId, instance);
}

/** SP の継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。 */
export function set8DEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  let next = sp;
  if (darknessDispelActive(state, playerId, instance)) {
    const player = state.players[playerId];
    const daCard = [...player.power.filter((c) => !c.faceDown), ...player.command].some((c) => hasCategory(state, c.cardId, "DA"));
    if (!daCard) next = Math.max(next, 1);
  }
  return next;
}

/** BP の継続効果（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ）。 */
export function set8DFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  if (darknessDispelActive(state, playerId, instance)) {
    const enemyId = opponent(playerId);
    if (fieldUnits(state, enemyId).some((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && hasCategory(state, c.cardId, "DA"))) {
      bonus += 3000;
    }
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// RS-595 キャリゲーター【頼もしい背中】
// 「これが自軍エリアにある間、特徴「炎神」を持つ自軍ユニットは｢これは毎ターン、可能ならバトルエリアに出る｣と書かれていても、
//  そのテキストは無効になる。」（atwiki/page-1204）— 無効になるのはそのユニット自身のテキストだけ（他の効果で出なければならない場合は別）。

/** このユニット自身の「これは毎ターン、可能ならバトルエリアに出る」が無効か（rules/restrictions.ts findMandatoryBattleEntries から呼ぶ）。 */
export function ownAutoBattleEntryNegated(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const carrier = fieldUnits(state, playerId).filter((c) => c.cardId === "RS-595");
  if (!carrier.some((c) => namedTextLive(state, playerId, c))) return false;
  return unitFeatures(state, playerId, card).includes("炎神");
}

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const SET8D_KEYWORD_PREFIX = "set8d::";

const SET8D_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  // 継続効果はそれぞれの参照箇所で扱う（ここでは何もしない）。
  "RS-584::darkness_dispel": (state) => ({ state, detail: "rs584_darkness_dispel" }),
  "RS-595::reliable_back": (state) => ({ state, detail: "rs595_reliable_back" }),
};

export function trySet8DCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET8D_KEYWORD_PREFIX)) return null;
  const handler = SET8D_KEYWORDS[keyword.slice(SET8D_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールの選択の CPU の手（対象外なら null）。 */
export function pickSet8DCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const picks = actions.filter((a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice");
  if (picks.length === 0) return skip ?? null;
  void state;
  switch (pending.effectId) {
    default:
      return picks[0] ?? skip ?? null;
  }
}

void ownFieldHas;
