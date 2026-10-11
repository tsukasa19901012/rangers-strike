/**
 * 第7弾「七忍の炎陣」（legend1）RS-495〜RS-515 のカード固有の名前付き効果と継続効果（cardSpec RS7-495-515 の監査）。
 *
 * - `trySet7DCardEffect`: DSL の grant_keyword から呼ばれる起点（`set7d::cardId::name`、または effect_card の
 *   キーワードを汎用の catchall より先に受ける）。
 * - `tryResolveSet7DChoice` / `trySkipSet7DChoice`: このモジュールが開いた選択の解決。
 * - 継続効果（ナンバー・NC・SP・BP の参照、アタック・ライドオフの制限、撃破の置換、ストライクのダメージの誘発）。
 * 構成は rules/legend1/set6NamedEffectsB.ts と同じ。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, DeferredDestroyTrigger, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isSmallUnit, parsePowerCost, unitBp } from "../../core/catalog";
import { opponent, updatePlayer } from "../../core/helpers";
import { addNextTurnRuleModifier, hasTurnRuleModifier } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { addTurnFeatureModifier, KIRIGAKURE_RULE_ID, unitFeatures } from "../addedFeatures";
import { grantBpBoostToBattleUnit, grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { spBecomesInZone } from "../fractionalSp";
import { shuffleCards } from "../errataCardEffects";
import { finalizeLeaveReaction, resolveBattlePending, tryLeaveField } from "../operationCounters";
import { turnPlayerOf } from "./set6NamedEffectsB";
import { set8DNamedTextNegated } from "./set8NamedEffectsD";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet7DChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet7DChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet7DChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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

/** 選択を開く（resumeChoice を引き継ぐ）。 */
function openChoice(
  state: GameState,
  ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string },
  choice: Omit<PendingEffectChoice, "playerId" | "phasePlayerId" | "sourceCardId" | "sourceInstanceId"> &
    Partial<Pick<PendingEffectChoice, "playerId">>,
): GameState {
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    selectedInstanceIds: [],
    ...choice,
  });
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function anyFieldHas(state: Pick<GameState, "players">, cardId: string, zones: ("battle" | "rush")[] = ["battle", "rush"]): boolean {
  return (["player1", "player2"] as const).some((pid) =>
    zones.some((z) => state.players[pid][z].some((c) => c.cardId === cardId)),
  );
}

function definitionCategories(def: CardDefinition | undefined): string[] {
  if (!def?.category) return [];
  return Array.isArray(def.category) ? [...def.category] : [def.category];
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

// ---------------------------------------------------------------------------
// RS-495 重力忍者オモ・カル【宇宙忍法・重力無秩序】
// 「これが自軍エリアにある間、SPが空欄で、ナンバーに数字を持つすべてのユニットは、次の効果を受ける⇒そのユニットのナンバーの数字は、
//  そのユニットの必要パワーの数字になる。（ナンバー0になったユニットは、ＮＣ効果を発動できない）」（atwiki/page-818）
// SP1 や分数 SP を得たユニットは対象から外れる（grnrngr/faq-card-7 RS-495 Q）。

/** 【宇宙忍法・重力無秩序】で置きかわったナンバー（対象外なら undefined）。 */
export function gravityComboNumber(
  state: Pick<GameState, "players">,
  card: Pick<CardInstance, "spOverride" | "spModifier">,
  definition: CardDefinition,
): number | undefined {
  if (typeof definition.comboNumber !== "number") return undefined;
  if (definition.sp !== undefined && definition.sp !== null) return undefined;
  if (card.spOverride !== undefined || (card.spModifier ?? 0) > 0) return undefined;
  if (!anyFieldHas(state, "RS-495")) return undefined;
  return parsePowerCost(definition.powerCost);
}

/**
 * NC の効果を発動できないか:
 * - RS-495【宇宙忍法・重力無秩序】でナンバー0になったユニット。
 * - RS-497【変身の妨害】等で効果名を持つテキストが無効になったユニット（NC の効果は効果名を持つテキスト）。
 */
export function set7DBlocksNc(state: GameState, playerId: PlayerId, card: CardInstance, definition: CardDefinition): boolean {
  if (gravityComboNumber(state, card, definition) === 0) return true;
  // RS-603【超有毒液化ガス】: 本来の特徴に「車両」を持つユニットの効果名を持つテキスト（rules/legend1/set8NamedEffectsD.ts）。
  if (set8DNamedTextNegated(state, card)) return true;
  return transformationHindranceNegates(state, card);
}

// ---------------------------------------------------------------------------
// RS-497 冥獣人ニンジャキリカゲ【変身の妨害】
// 「これが自軍バトルエリアにある間、カテゴリにDAを持たず、本来の特徴に｢男｣または「女」を持つSユニットは、次の制限を受ける⇒
//  効果名を持つテキストは無効になり、発動もできない。」（atwiki/page-819）
// 自軍・敵軍の限定はない。ナンバーは消えない（同 Q2）。

/** 【変身の妨害】で、このユニットの効果名を持つテキストが無効か。 */
export function transformationHindranceNegates(
  state: Pick<GameState, "players" | "definitions">,
  card: Pick<CardInstance, "cardId">,
): boolean {
  if (!anyFieldHas(state, "RS-497", ["battle"])) return false;
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit" || def.size !== "S") return false;
  if (definitionCategories(def).includes("DA")) return false;
  const features = def.features ?? [];
  return features.includes("男") || features.includes("女");
}

// ---------------------------------------------------------------------------
// 1体ずつ選んで撃破する（合計の上限・数の上限つき。途中でやめられる）
// RS-498【狼狼弾】（BP の合計5000以下・WB の自軍 M ユニットの数まで）、RS-499【狼狼蹴】（必要パワーの数字の合計2まで）。
// 選び終えたら（数・合計の上限に達したか、候補がなくなったか、やめたら）選んだユニットをまとめて撃破する
// （複数体の撃破は select_units_bp_budget の確定処理を共用する）。

export const MULTI_DESTROY_EFFECT_ID = "set7d_multi_destroy";

function measureOf(state: GameState, ownerId: PlayerId, card: CardInstance, measure: "bp" | "power_cost"): number {
  if (measure === "bp") return effectiveBp(state, ownerId, card);
  return parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost);
}

function multiDestroyCandidates(state: GameState, pending: PendingEffectChoice): string[] {
  const meta = pending.set7dMeta ?? {};
  const selected = meta.selected ?? [];
  if (meta.maxCount !== undefined && selected.length >= meta.maxCount) return [];
  const enemyId = opponent(pending.playerId);
  const enemy = state.players[enemyId];
  const measure = meta.measure ?? "bp";
  const all = (meta.zones ?? ["battle", "rush"]).flatMap((z) => enemy[z]);
  const used = all
    .filter((c) => selected.includes(c.instanceId))
    .reduce((sum, c) => sum + measureOf(state, enemyId, c, measure), 0);
  const budget = meta.budget ?? Number.MAX_SAFE_INTEGER;
  return all
    .filter((c) => !selected.includes(c.instanceId))
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .filter((c) => used + measureOf(state, enemyId, c, measure) <= budget)
    .map((c) => c.instanceId);
}

function openMultiDestroy(
  state: GameState,
  ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string },
  meta: NonNullable<PendingEffectChoice["set7dMeta"]>,
  resumeChoice?: PendingEffectChoice,
): GameState {
  const draft: PendingEffectChoice = {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    effectId: MULTI_DESTROY_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [],
    selectedInstanceIds: [],
    optional: true,
    set7dMeta: { ...meta, selected: meta.selected ?? [] },
    resumeChoice,
  };
  const candidates = multiDestroyCandidates(state, draft);
  if (candidates.length === 0) return resumeChoice ? openEffectChoice(state, resumeChoice) : state;
  return openEffectChoice(state, { ...draft, validInstanceIds: candidates });
}

/** 選んだユニットをまとめて撃破する。 */
function destroySelected(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  if (selected.length === 0) {
    return { state: finish(state, pending), log: skipLog(state, pending.playerId, pending.sourceCardId, pending.effectId) };
  }
  const names = selected
    .map((id) => {
      const card = fieldUnits(state, opponent(pending.playerId)).find((c) => c.instanceId === id);
      return card ? cardName(state.definitions, card.cardId) : id;
    })
    .join("、");
  const confirmPending: PendingEffectChoice = {
    ...pending,
    kind: "select_units_bp_budget",
    validInstanceIds: selected,
    selectedInstanceIds: selected,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
    set7dMeta: undefined,
  };
  const confirmed = applyConfirmEffectChoice({ ...state, pendingEffectChoice: confirmPending }, pending.playerId);
  if ("error" in confirmed) return confirmed;
  return { state: confirmed.state, log: logFor(state, pending.playerId, pending.sourceCardId, `destroy:${names}`) };
}

CHOICE_RESOLVERS[MULTI_DESTROY_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set7dMeta?.selected ?? []), instanceId];
  const next: PendingEffectChoice = { ...pending, set7dMeta: { ...pending.set7dMeta, selected }, selectedInstanceIds: selected };
  const candidates = multiDestroyCandidates(state, next);
  if (candidates.length === 0) return destroySelected(state, next, selected);
  return { state: { ...state, pendingEffectChoice: { ...next, validInstanceIds: candidates, optional: true } } };
};
CHOICE_SKIPPERS[MULTI_DESTROY_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return destroySelected(state, pending, pending.set7dMeta?.selected ?? []);
};

// ---------------------------------------------------------------------------
// RS-498 ゲキウルフ【狼狼弾】
// 「これをラッシュしたとき、BPの合計が5000以下になるように敵軍ユニットを選び撃破してもよい。
//  ただし選べるユニットの数は、WBの自軍Mユニットの数までとする。」（atwiki/page-774）

function wbMUnitCount(state: GameState, playerId: PlayerId): number {
  return fieldUnits(state, playerId).filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def?.type === "unit" && def.size === "M" && definitionCategories(def).includes("WB");
  }).length;
}

function applyRourouDan(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const maxCount = wbMUnitCount(state, ctx.playerId);
  if (maxCount === 0) return { state, detail: "rs498_rourou_dan:no_m" };
  const opened = openMultiDestroy(
    state,
    { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceCardId: "RS-498", sourceInstanceId: ctx.triggerSourceInstanceId },
    { maxCount, budget: 5000, measure: "bp", zones: ["battle", "rush"] },
  );
  return { state: opened, detail: opened.pendingEffectChoice ? "rs498_rourou_dan" : "rs498_rourou_dan:no_targets" };
}

// ---------------------------------------------------------------------------
// RS-499 ゲキバイオレット
// ※「このユニットは、自軍ラッシュフェイズ中、特徴に「レッド」「ブルー」「イエロー」を追加される。」は文言から読む
//   （rules/addedFeatures.ts phaseAddedFeatures）。
// 【狼狼蹴】「SP1」「このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアのユニットを必要パワーの数字の合計が2になるまで
//  好きな数選び、撃破する。」（atwiki/page-775）

export const ROUROU_KICK_EFFECT_ID = "rs499_rourou_kick";

function applyRourouKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = state.players[ctx.playerId].battle.find((c) => c.instanceId === ctx.triggerSourceInstanceId);
  if (!self || self.commandHeld) return { state, detail: `${ROUROU_KICK_EFFECT_ID}:cannot_hold` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-499", sourceInstanceId: self.instanceId }, {
      effectId: ROUROU_KICK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [self.instanceId],
      optional: true,
    }),
    detail: ROUROU_KICK_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ROUROU_KICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const held = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  const cleared: GameState = { ...held, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const opened = openMultiDestroy(
    cleared,
    { playerId, phasePlayerId: pending.phasePlayerId, sourceCardId: "RS-499", sourceInstanceId: instanceId },
    { budget: 2, measure: "power_cost", zones: ["battle"] },
    pending.resumeChoice,
  );
  return {
    state: opened.pendingEffectChoice ? opened : promoteDeferredBattleEntry(opened),
    log: logFor(state, playerId, "RS-499", `${ROUROU_KICK_EFFECT_ID}:hold`),
  };
};
CHOICE_SKIPPERS[ROUROU_KICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-500 ゲキチョッパー【サイブレードカッター】
// 「自分の手札から特徴「激気」を持つユニットカードを1枚選び、相手に見せてもよい。そうしたとき、このターン、このユニットのBPは、
//  見せたカードのBPを「＋」した値になり、BP5000以上のとき「SP1」になる。」（atwiki/page-776）
// BP の加算はこのターンの修正。「BP5000以上のとき」は効果を含む BP で判定し続ける（rules/legend3/fieldEffects.ts の SP 計算）。

export const CYBLADE_EFFECT_ID = "rs500_cyblade_cutter";
const CYBLADE_MARK = "rs500_cyblade_cutter_shown";

function applyCybladeCutter(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && (def.features ?? []).includes("激気");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: `${CYBLADE_EFFECT_ID}:no_targets` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-500", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: CYBLADE_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: CYBLADE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[CYBLADE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const shown = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const self = pending.sourceInstanceId;
  if (!shown || !self) return { error: "invalid_target" };
  const bp = unitBp(getDefinition(state.definitions, shown.cardId));
  let next = grantBpBoostToBattleUnit(state, playerId, self, bp);
  next = markBattleNcEffect(next, playerId, self, CYBLADE_MARK);
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-500", `${CYBLADE_EFFECT_ID}:${cardName(state.definitions, shown.cardId)}`) };
};
CHOICE_SKIPPERS[CYBLADE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// SP の継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）
// - RS-500【サイブレードカッター】: 見せたあと、BP5000以上のとき「SP1」。
// - RS-509【ガレージランチャー】: 手札に加えたとき、このターン「SP1」（grantSp1ToBattleUnit で付ける）。

export function set7DEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (instance.activatedNcEffects?.includes(CYBLADE_MARK) && effectiveBp(state, playerId, instance) >= 5000) {
    return Math.max(sp, 1);
  }
  return sp;
}

// ---------------------------------------------------------------------------
// RS-501 エレハン・キンポー ※「これは特徴「女」を持つユニット1体につきBP＋1000される。」（atwiki/page-742）
// 自軍・敵軍の限定はない（rules/fieldAuras.ts から呼ぶ）。

export function femaleUnitCountBothSides(state: GameState): number {
  return (["player1", "player2"] as const).reduce(
    (sum, pid) => sum + fieldUnits(state, pid).filter((c) => unitFeatures(state, pid, c).includes("女")).length,
    0,
  );
}

// ---------------------------------------------------------------------------
// RS-502 バット・リー【忘我の中に修行あり】
// 「これが自軍ラッシュエリアにある間、特徴「ブルー」を持つすべてのSユニットは次の能力を得る⇒これが撃破されて捨札になるとき、
//  かわりに自分の手札からユニットカードを1枚選び捨札にしてもよい。そうしたとき、撃破されたユニットのBPと捨札にしたユニットカードの
//  BPを合計して、その合計と同じBPを持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-777）
// 撃破の置換（rules/operationCounters.ts tryLeaveField から呼ぶ）。置換したユニットは場に留まる（撃破された事実は残る）。

export const BAT_LEE_EFFECT_ID = "rs502_bat_lee";
export const BAT_LEE_DESTROY_EFFECT_ID = "rs502_bat_lee_destroy";

export function openBatLeeChoice(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.batLeeDeclined || intent.notDestruction || intent.toZone !== "discard") return null;
  if (intent.resumePendingStrike || state.pendingEffectChoice) return null;
  if (!anyFieldHas(state, "RS-502", ["rush"])) return null;
  const owner = state.players[intent.ownerPlayerId];
  const leaving = owner[intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!leaving || !isSmallUnit(state.definitions, leaving.cardId)) return null;
  if (!unitFeatures(state, intent.ownerPlayerId, leaving).includes("ブルー")) return null;
  const candidates = owner.hand
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .map((c) => c.instanceId);
  if (candidates.length === 0) return null;
  const source = (["player1", "player2"] as const)
    .flatMap((pid) => state.players[pid].rush)
    .find((c) => c.cardId === "RS-502");
  return {
    ...state,
    pendingEffectChoice: {
      playerId: intent.ownerPlayerId,
      effectId: BAT_LEE_EFFECT_ID,
      sourceCardId: "RS-502",
      sourceInstanceId: source?.instanceId,
      kind: "select_hand",
      phasePlayerId: intent.phasePlayerId,
      validInstanceIds: candidates,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: true,
      set7dMeta: { intent, destroyedBp: effectiveBp(state, intent.ownerPlayerId, leaving) },
    },
    activePlayer: intent.ownerPlayerId,
  };
}

function settled(state: GameState): GameState {
  return state.pendingEffectChoice || state.pendingLeave ? state : promoteDeferredBattleEntry(state);
}

function continueFollowUp(state: GameState, intent: PendingLeave): GameState {
  if (!intent.followUpAttackerLeave || state.pendingLeave || state.pendingEffectChoice || state.pendingRegister) return state;
  return tryLeaveField(state, { ...intent.followUpAttackerLeave }).state;
}

CHOICE_RESOLVERS[BAT_LEE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.set7dMeta?.intent;
  if (!intent) return { error: "invalid_choice" };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const sum = (pending.set7dMeta?.destroyedBp ?? 0) + unitBp(getDefinition(state.definitions, card.cardId));
  let next: GameState = patchPlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  next = { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  // かわりに手札のカードを捨札にした: 撃破されたユニットは場に留まる（撃破された事実は残る。R-DESTROY-02）。
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  const enemyId = opponent(playerId);
  const targets = fieldUnits(next, enemyId)
    .filter((c) => getDefinition(next.definitions, c.cardId)?.type === "unit")
    .filter((c) => effectiveBp(next, enemyId, c) === sum)
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RS-502", `${BAT_LEE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}:${sum}`);
  if (targets.length > 0 && !next.pendingEffectChoice && !next.pendingLeave) {
    next = openEffectChoice(next, {
      playerId,
      effectId: BAT_LEE_DESTROY_EFFECT_ID,
      sourceCardId: "RS-502",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: targets,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      set7dMeta: { intent },
    });
    return { state: next, log };
  }
  return { state: settled(continueFollowUp(next, intent)), log };
};
CHOICE_SKIPPERS[BAT_LEE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.set7dMeta?.intent;
  if (!intent) return { error: "invalid_choice" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = tryLeaveField(cleared, { ...intent, batLeeDeclined: true });
  let next = leave.state;
  if (!leave.deferred) next = continueFollowUp(next, intent);
  return { state: settled(next), log: skipLog(state, playerId, "RS-502", BAT_LEE_EFFECT_ID) };
};
CHOICE_RESOLVERS[BAT_LEE_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.set7dMeta?.intent;
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  let next = leave.state;
  if (intent) next = continueFollowUp(next, intent);
  return { state: settled(next), log: logFor(state, playerId, "RS-502", `${BAT_LEE_DESTROY_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RS-503 シャッキー・チェン【シャッキーン！の中に修行あり】
// 「これが自軍ラッシュエリアにある間、特徴「レッド」を持つすべてのSユニットは次の能力を得る⇒これがアタックするとき、
//  敵軍ユニットのBPをカードに表記された本来の値としてバトルする。」（atwiki/page-778）

/** アタックされたユニットの BP を本来の値としてバトルするか（rules/namedUnitEffects.ts battleDefenderBp から呼ぶ）。 */
export function set7DUsePrintedDefenderBp(state: GameState, pending: PendingBattle): boolean {
  if (!anyFieldHas(state, "RS-503", ["rush"])) return false;
  const attacker = fieldUnits(state, pending.attackerPlayerId).find((c) => c.instanceId === pending.attackerInstanceId);
  if (!attacker || !isSmallUnit(state.definitions, attacker.cardId)) return false;
  return unitFeatures(state, pending.attackerPlayerId, attacker).includes("レッド");
}

// ---------------------------------------------------------------------------
// RS-505 スピードル【滑空突撃】「SP1」「このターン、これは特徴「航空機」が追加される。」（atwiki/page-756）

function applyGlideAssault(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state };
  const player = addTurnFeatureModifier(state.players[ctx.playerId], KIRIGAKURE_RULE_ID, { instanceId: id, features: ["航空機"] }, "RS-505");
  return { state: { ...state, ...updatePlayer(state, ctx.playerId, player) }, detail: "rs505_glide_assault" };
}

// ---------------------------------------------------------------------------
// RS-506 バスオン【バスオンミサイル】「次の相手ターン、敵軍ユニットはライドオフできない。」（atwiki/page-757）

const BUS_ON_MISSILE_RULE = "rs506_bus_on_missile";

function applyBusOnMissile(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const enemy = addNextTurnRuleModifier(state.players[enemyId], BUS_ON_MISSILE_RULE, { sourceCardId: "RS-506" });
  return { state: { ...state, ...updatePlayer(state, enemyId, enemy) }, detail: "rs506_bus_on_missile" };
}

/** このプレイヤーのユニットはライドオフできないか（RS-506【バスオンミサイル】）。 */
export function rideOffBlockedBySet7D(state: GameState, playerId: PlayerId): boolean {
  return hasTurnRuleModifier(state.players[playerId], BUS_ON_MISSILE_RULE);
}

// ---------------------------------------------------------------------------
// RS-508 ゴーオンレッド【ロードサーベル】「SP1」
// 「敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、このユニットと選んだユニットでバトルする。」（atwiki/page-740）
// アタックではないバトル: BP を比べ、低い方（同じなら両方）が撃破される（R-BTL-01・R-BTL-02）。バトルの誘発（勝ったとき等）も処理する。

export const ROAD_SABER_EFFECT_ID = "rs508_road_saber";

function applyRoadSaber(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].battle
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: `${ROAD_SABER_EFFECT_ID}:no_targets` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-508", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: ROAD_SABER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: ROAD_SABER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ROAD_SABER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const self = state.players[playerId].battle.find((c) => c.instanceId === pending.sourceInstanceId);
  const target = state.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  if (!target) return { error: "invalid_target" };
  if (!self) return { state: finish(state, pending) };
  const ownBp = effectiveBp(state, playerId, self);
  const enemyBp = effectiveBp(state, enemyId, target);
  const log = logFor(state, playerId, "RS-508", `${ROAD_SABER_EFFECT_ID}:${cardName(state.definitions, target.cardId)}:${ownBp}vs${enemyBp}`);
  // アタックではないバトル（effectBattle）としてバトルの処理を通す: BP の比較・撃破（レジスト・場を離れるときの応答）、
  // バトルに勝ったとき／撃破したとき／バトルして撃破されたとき等の誘発はアタックのバトルと同じ（rules/operationCounters.ts）。
  const battle: PendingBattle = {
    attackerPlayerId: playerId,
    attackerInstanceId: self.instanceId,
    defenderPlayerId: enemyId,
    defenderInstanceId: target.instanceId,
    phasePlayerId: pending.phasePlayerId,
    onAttackResolved: true,
    effectBattle: true,
  };
  const closed: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const battled = resolveBattlePending(closed, battle).state;
  if (battled.pendingEffectChoice || battled.pendingLeave || battled.pendingRegister) return { state: battled, log };
  return { state: finish({ ...battled, pendingEffectChoice: pending }, pending), log };
};
CHOICE_SKIPPERS[ROAD_SABER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-509 ゴーオンブルー【ガレージランチャー】
// 「自軍パワーゾーンのオモテ向きのカードからオペレーションカードを1枚選び、自分の手札に加えても良い。そうしたとき、このターン、
//  これは「SP1」になる。」（atwiki/page-758）

export const GARAGE_LAUNCHER_EFFECT_ID = "rs509_garage_launcher";

function applyGarageLauncher(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].power
    .filter((c) => !c.faceDown && getDefinition(state.definitions, c.cardId)?.type === "operation")
    .map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: `${GARAGE_LAUNCHER_EFFECT_ID}:no_targets` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-509", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: GARAGE_LAUNCHER_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: GARAGE_LAUNCHER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GARAGE_LAUNCHER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  if (pending.sourceInstanceId) next = grantSp1ToBattleUnit(next, playerId, pending.sourceInstanceId);
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-509", `${GARAGE_LAUNCHER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[GARAGE_LAUNCHER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-510 ゴーオンイエロー【レーシングバレット】
// 「自分の手札から、特徴「車両」を持つユニットカードを1枚選び、自軍パワーゾーンに置いてもよい。そうした時、相手は置いたカードの
//  必要パワーの数字と同じ必要パワーの数字を持つ自分自身のSユニットを1体選び、自分自身のパワーゾーンに送る。」（atwiki/page-794）

export const RACING_BULLET_EFFECT_ID = "rs510_racing_bullet";
export const RACING_BULLET_SEND_EFFECT_ID = "rs510_racing_bullet_send";

function applyRacingBullet(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && (def.features ?? []).includes("車両");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${RACING_BULLET_EFFECT_ID}:no_targets` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-510", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: RACING_BULLET_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: RACING_BULLET_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[RACING_BULLET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const cost = parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost);
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    power: [...p.power, stripForZone(card)],
  }));
  const log = logFor(state, playerId, "RS-510", `${RACING_BULLET_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const enemyId = opponent(playerId);
  const targets = fieldUnits(next, enemyId)
    .filter((c) => {
      const def = getDefinition(next.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S" && parsePowerCost(def.powerCost) === cost;
    })
    .map((c) => c.instanceId);
  if (targets.length === 0) return { state: finish(next, pending), log };
  next = {
    ...next,
    pendingEffectChoice: {
      ...pending,
      playerId: enemyId,
      effectId: RACING_BULLET_SEND_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: targets,
      selectedInstanceIds: [],
      optional: false,
    },
    activePlayer: enemyId,
  };
  return { state: next, log };
};
CHOICE_SKIPPERS[RACING_BULLET_EFFECT_ID] = simpleSkip();
CHOICE_RESOLVERS[RACING_BULLET_SEND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = applyUnitLeave(cleared, instanceId, "power", pending.phasePlayerId);
  if ("error" in leave) return leave;
  const next = leave.state;
  const done = next.pendingEffectChoice || next.pendingLeave ? next : pending.resumeChoice ? openEffectChoice(next, pending.resumeChoice) : promoteDeferredBattleEntry(next);
  return { state: done, log: logFor(state, playerId, "RS-510", `${RACING_BULLET_SEND_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RS-511 ゴーオングリーン【マンタンガン・ロッドモード】
// 「自軍パワーゾーンのカード枚数が、敵軍パワーゾ－ンのカード枚数より少なければ、自軍山札の上から1枚ひいて、
//  自軍パワーゾーンに置いてもよい。」（atwiki/page-795）

export const ROD_MODE_EFFECT_ID = "rs511_rod_mode";

function applyRodMode(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const own = state.players[ctx.playerId];
  const enemy = state.players[opponent(ctx.playerId)];
  if (own.power.length >= enemy.power.length || own.deck.length === 0 || !ctx.triggerSourceInstanceId) {
    return { state, detail: `${ROD_MODE_EFFECT_ID}:no_effect` };
  }
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-511", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: ROD_MODE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [ctx.triggerSourceInstanceId],
      optional: true,
    }),
    detail: ROD_MODE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ROD_MODE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const top = state.players[playerId].deck[0];
  if (!top) return { state: finish(state, pending) };
  const next = patchPlayer(state, playerId, (p) => ({ ...p, deck: p.deck.slice(1), power: [...p.power, stripForZone(top)] }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-511", `${ROD_MODE_EFFECT_ID}:draw_to_power`) };
};
CHOICE_SKIPPERS[ROD_MODE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-512 ゴーオンブラック【マンタンガン】
// 「敵軍パワーゾーンのオモテ向きのカードから1枚選んでもよい。そうしたとき、選んだカードをウラ返してダメージにする。」（atwiki/page-796）

export const MANTANGAN_EFFECT_ID = "rs512_mantangan";

function applyMantangan(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${MANTANGAN_EFFECT_ID}:no_targets` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-512", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: MANTANGAN_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: MANTANGAN_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[MANTANGAN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  if (!state.players[enemyId].power.some((c) => c.instanceId === instanceId && !c.faceDown)) return { error: "invalid_target" };
  const next = patchPlayer(state, enemyId, (p) => {
    const power = p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c));
    return { ...p, power, damage: Math.max(p.damage + 1, power.filter((c) => c.faceDown).length) };
  });
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-512", `${MANTANGAN_EFFECT_ID}:flip`) };
};
CHOICE_SKIPPERS[MANTANGAN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-513 無敵将軍【将軍花吹雪】
// 「これをラッシュしたとき、敵軍ユニットの下に重ねたカード（ユニットやビークルとして扱われているものも含む）をすべて持ち主の
//  山札に戻してシャッフルする。」（atwiki/page-812）— 敵軍ユニット自身は場に残る。

function applyShogunFubuki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const returned: CardInstance[] = [];
  const strip = (cards: CardInstance[]) =>
    cards.map((c) => {
      if (!c.stackedCards || c.stackedCards.length === 0) return c;
      returned.push(...c.stackedCards.map(stripForZone));
      return { ...c, stackedCards: [] };
    });
  const battle = strip(enemy.battle);
  const rush = strip(enemy.rush);
  if (returned.length === 0) return { state, detail: "rs513_shogun_fubuki:none" };
  const next = { ...state, ...updatePlayer(state, enemyId, { ...enemy, battle, rush, deck: shuffleCards([...enemy.deck, ...returned]) }) };
  return { state: next, detail: `rs513_shogun_fubuki:${returned.length}` };
}

// ---------------------------------------------------------------------------
// RS-514 ゲキトージャウルフ【大狼狼蹴】
// 「これがストライクして、相手が山札の上からひいたカードをダメージにしたとき、相手は自分自身のユニットを1体選び撃破する。」
// （atwiki/page-779）— core/applyAction.ts finishStrikeResolution から、ストライクのダメージで相手の山札が減ったときに呼ぶ。
// ※追加条件の変更（自軍捨札7枚以上）は rules/zord.ts の文言による処理。

export const DAI_ROUROU_KICK_EFFECT_ID = "rs514_dai_rourou_kick";

export function applySet7DStrikeDamageTriggers(state: GameState, pending: PendingStrike, deckDraws: number): GameState {
  if (state.winner || pending.damageCancelled || deckDraws <= 0) return state;
  if (state.pendingEffectChoice || state.pendingDamagePayment) return state;
  const striker = state.players[pending.strikerPlayerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!striker || striker.cardId !== "RS-514") return state;
  const enemyId = opponent(pending.strikerPlayerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: enemyId,
    effectId: DAI_ROUROU_KICK_EFFECT_ID,
    sourceCardId: "RS-514",
    sourceInstanceId: striker.instanceId,
    kind: "select_unit",
    phasePlayerId: pending.battlePhasePlayer,
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
  });
}

CHOICE_RESOLVERS[DAI_ROUROU_KICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return { state: settled(leave.state), log: logFor(state, playerId, "RS-514", `${DAI_ROUROU_KICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RS-515 エンジンオー【ゴーオンソード】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる。お互いに山札の上から1枚をオモテにし、必要パワーの数字を
//  比べる勝負を2回繰り返す。数字の大きい方を勝ちとして、自分が2回連続で勝ったなら、このターン、これは「SP3」になる。
//  2回連続で負けたなら、これは撃破される。その後、オモテにしたカードは、好きな順番で持ち主の山札の下に戻す。」
// （atwiki/page-760。コメント欄の修正後「次の効果を発動できる」）
// 山札の下に戻す順番は、カードが2枚ならどちらを先に山札の下に置くかを選ぶ（持ち主ごと。効果を使ったプレイヤーが選ぶ）。

export const GO_ON_SWORD_EFFECT_ID = "rs515_go_on_sword";

function applyGoOnSword(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayerOf(state) !== ctx.playerId || !ctx.triggerSourceInstanceId) return { state, detail: `${GO_ON_SWORD_EFFECT_ID}:not_own_turn` };
  return {
    state: openChoice(state, { ...ctx, sourceCardId: "RS-515", sourceInstanceId: ctx.triggerSourceInstanceId }, {
      effectId: GO_ON_SWORD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [ctx.triggerSourceInstanceId],
      optional: true,
    }),
    detail: GO_ON_SWORD_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GO_ON_SWORD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  // オモテにしたカードは、戻すまで持ち主の山札の上に置いたままにする（順番を選ぶ選択で山札の上から選ぶ）。
  const ownDeck = state.players[playerId].deck;
  const enemyDeck = state.players[enemyId].deck;
  const ownRevealed: CardInstance[] = [];
  const enemyRevealed: CardInstance[] = [];
  const results: ("win" | "lose" | "draw")[] = [];
  for (let round = 0; round < 2; round += 1) {
    const own = ownDeck[round];
    const enemy = enemyDeck[round];
    if (own) ownRevealed.push(own);
    if (enemy) enemyRevealed.push(enemy);
    if (!own || !enemy) break;
    const a = parsePowerCost(getDefinition(state.definitions, own.cardId)?.powerCost);
    const b = parsePowerCost(getDefinition(state.definitions, enemy.cardId)?.powerCost);
    results.push(a > b ? "win" : a < b ? "lose" : "draw");
  }
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const detail = `${GO_ON_SWORD_EFFECT_ID}:${results.join(",")}`;
  const log = logFor(state, playerId, "RS-515", detail);
  if (results.length === 2 && results.every((r) => r === "win")) {
    if (next.players[playerId].battle.some((c) => c.instanceId === instanceId)) {
      next = spBecomesInZone(next, playerId, "battle", instanceId, 3);
    }
  } else if (results.length === 2 && results.every((r) => r === "lose")) {
    const leave = applyUnitLeave(next, instanceId, "discard", pending.phasePlayerId);
    if (!("error" in leave)) next = leave.state;
  }
  // その後、オモテにしたカードは、好きな順番で持ち主の山札の下に戻す（2枚あれば順番を選ぶ。効果を使ったプレイヤーが選ぶ）。
  const groups = [
    { playerId, instanceIds: ownRevealed.map((c) => c.instanceId) },
    { playerId: enemyId, instanceIds: enemyRevealed.map((c) => c.instanceId) },
  ].filter((g) => g.instanceIds.length > 0);
  const ordered = continueGoOnSwordOrder(next, { ...pending, effectId: GO_ON_SWORD_ORDER_EFFECT_ID }, groups);
  next = ordered.state;
  if (ordered.choice) {
    if (next.pendingEffectChoice || next.pendingLeave || next.pendingRegister || next.pendingDamagePayment) {
      // 撃破の誘発・応答が割り込んだ: それらの解決後に順番を選ぶ（rules/destroyTriggerQueue.ts）。
      const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: ordered.choice };
      return { state: { ...next, deferredDestroyTriggers: [...(next.deferredDestroyTriggers ?? []), frame] }, log };
    }
    return { state: openEffectChoice(next, ordered.choice), log };
  }
  if (next.pendingEffectChoice || next.pendingLeave) return { state: next, log };
  const done = pending.resumeChoice ? openEffectChoice(next, pending.resumeChoice) : promoteDeferredBattleEntry(next);
  return { state: done, log };
};

export const GO_ON_SWORD_ORDER_EFFECT_ID = "rs515_go_on_sword_order";

/** 持ち主の山札の上にあるオモテにしたカードを、山札の下へ移す。 */
function revealedToDeckBottom(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), stripForZone(card)] };
  });
}

/**
 * オモテにしたカードを持ち主ごとに山札の下へ戻す。1枚ならそのまま戻し、2枚以上なら先に山札の下に置くカードを選ぶ選択を返す。
 */
function continueGoOnSwordOrder(
  state: GameState,
  base: PendingEffectChoice,
  groups: { playerId: PlayerId; instanceIds: string[] }[],
): { state: GameState; choice?: PendingEffectChoice } {
  let next = state;
  const queue = [...groups];
  while (queue.length > 0) {
    const group = queue.shift()!;
    const ids = group.instanceIds.filter((id) => next.players[group.playerId].deck.some((c) => c.instanceId === id));
    if (ids.length >= 2) {
      const choice: PendingEffectChoice = {
        playerId: base.playerId,
        effectId: GO_ON_SWORD_ORDER_EFFECT_ID,
        sourceCardId: "RS-515",
        sourceInstanceId: base.sourceInstanceId,
        kind: "select_unit",
        phasePlayerId: base.phasePlayerId,
        validInstanceIds: ids,
        selectCount: 1,
        selectedInstanceIds: [],
        optional: false,
        resumeChoice: base.resumeChoice,
        set7dMeta: { orderOwner: group.playerId, orderGroups: queue },
      };
      return { state: next, choice };
    }
    for (const id of ids) next = revealedToDeckBottom(next, group.playerId, id);
  }
  return { state: next };
}

CHOICE_RESOLVERS[GO_ON_SWORD_ORDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.set7dMeta?.orderOwner;
  if (!owner) return { error: "invalid_choice" };
  let next = revealedToDeckBottom(state, owner, instanceId);
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  const log = logFor(state, playerId, "RS-515", `${GO_ON_SWORD_ORDER_EFFECT_ID}:${cardName(state.definitions, findDeckCardId(state, owner, instanceId))}`);
  const groups = [...(rest.length > 0 ? [{ playerId: owner, instanceIds: rest }] : []), ...(pending.set7dMeta?.orderGroups ?? [])];
  const ordered = continueGoOnSwordOrder({ ...next, pendingEffectChoice: undefined }, pending, groups);
  next = ordered.state;
  if (ordered.choice) return { state: { ...next, pendingEffectChoice: ordered.choice }, log };
  return { state: finish({ ...next, pendingEffectChoice: pending }, pending), log };
};

function findDeckCardId(state: GameState, ownerId: PlayerId, instanceId: string): string {
  return state.players[ownerId].deck.find((c) => c.instanceId === instanceId)?.cardId ?? instanceId;
}
CHOICE_SKIPPERS[GO_ON_SWORD_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-096 ビーファイタークワガー ※「これはＮＣもＲＣも発動していないSユニットにアタックされない。」（atwiki/page-1661）
// 文言で判定する。NC を発動している＝バトルエリアに出たときに NC が成立した（activatedNcEffects がある）。
// RC はライドオフで発動したとみなす（atwiki/page-819 RS-497 Q2「RCを持つユニットはライドオフすることでRCを発動しているとみなします」）。
// ライドオフしたユニットには activatedNcEffects に RIDE_OFF_RC_MARK を付ける。

const NO_NC_RC_ATTACK_RE = /NCもRCも発動していないSユニットにアタックされない/;

/** ライドオフした（RC を発動したとみなす）ユニットの activatedNcEffects の印（core/applyAction.ts resolve_ride_off_choice）。 */
export const RIDE_OFF_RC_MARK = "rc_activated_by_ride_off";

function unitHasNcOrRcActive(unit: CardInstance): boolean {
  return (unit.activatedNcEffects ?? []).length > 0;
}

/** アタックされない制限（rules/legend3/restrictions.ts canAttackDefender から呼ぶ）。 */
export function set7DDefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defender: CardInstance,
): boolean {
  const text = (getDefinition(state.definitions, defender.cardId)?.text ?? "").normalize("NFKC");
  if (NO_NC_RC_ATTACK_RE.test(text)) {
    if (isSmallUnit(state.definitions, attacker.cardId) && !unitHasNcOrRcActive(attacker)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const SET7D_KEYWORD_PREFIX = "set7d::";

const EFFECT_CARD_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  // 継続効果はそれぞれの参照箇所で扱う（ここでは何もしない）。
  "effect_card::RS-495::ninpochikara": (state) => ({ state, detail: "rs495_gravity_disorder" }),
  "effect_card::RS-497::noe5a489": (state) => ({ state, detail: "rs497_transformation_hindrance" }),
  "effect_card::RS-498::dane78bbc": applyRourouDan,
  "effect_card::RS-500::saiburedokata": applyCybladeCutter,
  "effect_card::RS-502::noniari": (state) => ({ state, detail: "rs502_bat_lee" }),
  "effect_card::RS-503::shakinnoniari": (state) => ({ state, detail: "rs503_shakkin" }),
  "effect_card::RS-506::basuonmisairu": applyBusOnMissile,
  "effect_card::RS-509::garejirancha": applyGarageLauncher,
  "effect_card::RS-510::reshingubareto": applyRacingBullet,
  "effect_card::RS-511::mantanganrodomodo": applyRodMode,
  "effect_card::RS-512::mantangan": applyMantangan,
  "effect_card::RS-513::hana": applyShogunFubuki,
  "effect_card::RS-514::fxunknowne5a4a7": (state) => ({ state, detail: "rs514_dai_rourou_kick" }),
};

const SET7D_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RS-499::rourou_kick": applyRourouKick,
  "RS-505::glide_assault": applyGlideAssault,
  "RS-508::road_saber": applyRoadSaber,
  "RS-515::go_on_sword": applyGoOnSword,
};

export function trySet7DCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  const effectCard = EFFECT_CARD_KEYWORDS[keyword];
  if (effectCard) return effectCard(state, ctx);
  if (!keyword.startsWith(SET7D_KEYWORD_PREFIX)) return null;
  const handler = SET7D_KEYWORDS[keyword.slice(SET7D_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

function pickById(actions: Action[], id: string | undefined): Action | undefined {
  return id === undefined
    ? undefined
    : actions.find((a) => a.type === "resolve_effect_choice" && a.instanceId === id);
}

/** このモジュールの選択の CPU の手（対象外なら null）。 */
export function pickSet7DCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const picks = actions.filter((a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice");
  if (picks.length === 0) return skip ?? null;
  const me = pending.playerId;
  const bpOf = (id: string): number => {
    for (const pid of ["player1", "player2"] as const) {
      const card = fieldUnits(state, pid).find((c) => c.instanceId === id);
      if (card) return effectiveBp(state, pid, card);
    }
    const inHand = state.players[me].hand.find((c) => c.instanceId === id);
    return inHand ? unitBp(getDefinition(state.definitions, inHand.cardId)) : 0;
  };
  switch (pending.effectId) {
    case GO_ON_SWORD_EFFECT_ID:
      // 勝負の結果は分からない。負けると撃破されるので、自軍の山札の上が重いときだけ発動する……ことはできない（山札は非公開）。
      // 期待値は五分なので発動しない。
      return skip ?? picks[0]!;
    case RACING_BULLET_SEND_EFFECT_ID:
    case DAI_ROUROU_KICK_EFFECT_ID: {
      // 自分のユニットを失う側: BP の一番低いユニット。
      return [...picks].sort((a, b) => bpOf(a.instanceId) - bpOf(b.instanceId))[0]!;
    }
    case ROAD_SABER_EFFECT_ID: {
      const self = state.players[me].battle.find((c) => c.instanceId === pending.sourceInstanceId);
      const ownBp = self ? effectiveBp(state, me, self) : 0;
      const winnable = picks.filter((a) => bpOf(a.instanceId) < ownBp).sort((a, b) => bpOf(b.instanceId) - bpOf(a.instanceId));
      return winnable[0] ?? skip ?? null;
    }
    case MULTI_DESTROY_EFFECT_ID:
    case BAT_LEE_DESTROY_EFFECT_ID:
    case MANTANGAN_EFFECT_ID:
    case GARAGE_LAUNCHER_EFFECT_ID:
    case ROD_MODE_EFFECT_ID:
    case ROUROU_KICK_EFFECT_ID:
      // 敵軍ユニットの撃破・敵軍のダメージ・自軍の手札やパワーが増える効果: 一番強い対象を選ぶ。
      return [...picks].sort((a, b) => bpOf(b.instanceId) - bpOf(a.instanceId))[0]!;
    case CYBLADE_EFFECT_ID:
      return [...picks].sort((a, b) => bpOf(b.instanceId) - bpOf(a.instanceId))[0]!;
    case BAT_LEE_EFFECT_ID: {
      // かわりに捨札にすると撃破されずに済むので、BP の一番低い手札のユニットカードを使う。
      return [...picks].sort((a, b) => bpOf(a.instanceId) - bpOf(b.instanceId))[0]!;
    }
    case RACING_BULLET_EFFECT_ID: {
      // 相手に同じ必要パワーの S ユニットがあるカードを優先する。
      const enemyCosts = new Set(
        fieldUnits(state, opponent(me))
          .filter((c) => isSmallUnit(state.definitions, c.cardId))
          .map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)),
      );
      const hit = picks.find((a) => {
        const card = state.players[me].hand.find((c) => c.instanceId === a.instanceId);
        return card && enemyCosts.has(parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost));
      });
      return hit ?? skip ?? null;
    }
    default:
      return pickById(actions, pending.validInstanceIds[0]) ?? skip ?? null;
  }
}
