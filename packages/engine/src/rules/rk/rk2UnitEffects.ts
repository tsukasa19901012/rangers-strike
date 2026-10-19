/**
 * ザ・マスクドライダーEXP vol.1 RK-022〜RK-042（ライダーパス・ユニット・ビークル）のカード固有の効果（cardSpec RK2-022-042 の監査）。
 *
 * - `tryRk2CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk2::cardId::name`。RC・「バトルエリアに出たとき」）。
 * - `tryResolveRk2Choice` / `trySkipRk2Choice`: このモジュールが開いた選択の解決。撃破・パワーゾーン・手札に送る選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - 常時の効果（BP・アタックの制限・特徴・カウンター・スタートフェイズ等）は、それぞれの処理の場所から呼ぶ。
 * 構成は rules/rk/rk1NamedEffects.ts と同じ。
 */
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import { rk9ContractCovers } from "./rk9Fields";
import type {
  CardInstance,
  DeferredDestroyTrigger,
  GameState,
  PendingBattle,
  PendingEffectChoice,
  PendingStrike,
  PlayerId,
  PlayerState,
} from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice } from "../pendingChoices";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { grantSp1OnPlayer, patchPlayer } from "../playerPatches";
import { markBattleBlocked } from "../turnModifiers";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "./rk1Features";
import { tryLeaveField } from "../operationCounters";
import { destroyStriker } from "../strikeReactions";
import { recordReveal, revealedCards } from "../revealNotice";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export const RK2_KEYWORD_PREFIX = "rk2::";

export function isRk2ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk2Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk2Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

/** 選択を開く。既に別の選択が開いていればその後に開く。 */
function openOrQueue(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  return openEffectChoice(state, choice);
}

/** 選択を閉じた state（resumeChoice はまだ開かない）。 */
function close(state: GameState, pending: PendingEffectChoice): GameState {
  return state.pendingEffectChoice === pending
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
}

/** 効果の処理を終える（割り込みがなければ resumeChoice を開くかバトル進入を続ける）。 */
function proceed(state: GameState, pending: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) {
    return pending.resumeChoice ? { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, pending.resumeChoice) } : state;
  }
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    if (!pending.resumeChoice) return state;
    const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
  }
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

function simpleSkip(): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  };
}

function base(ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string }, sourceCardId: string) {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    selectedInstanceIds: [] as string[],
  };
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function fieldUnits(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => isUnitCard(state, c.cardId));
}

function findField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): { zone: "battle" | "rush"; card: CardInstance } | undefined {
  for (const zone of ["battle", "rush"] as const) {
    const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function turnPayloads<T>(player: PlayerState, ruleId: string): T[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => p !== undefined && p !== null);
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

function featuresOf(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  return unitFeatures(state, ownerId, card);
}

// ---------------------------------------------------------------------------
// RK-022 ライダーパス（※常駐）— 配置するとき
// 「これを配置するとき、自軍山札から特徴「DEN-O」を持つユニットカードを4枚まで選び、相手に見せてからこれに重ねて置いた後、
//  山札をシャッフルする。」（atwiki/page-128）。重ねたカードはオモテ向き（grnrngr/faq-rider-1 RK-022 Q7）。
// 1枚ずつ選び（4枚まで）、選ぶのをやめる（skip）か4枚選ぶか候補がなくなったら山札をシャッフルする。
// 置き換え（自軍ラッシュフェイズ）は rules/errataCardEffects.ts、離れるときの捨札は rules/operationProcedure.ts の共通処理。

export const RIDER_PASS_SEARCH_EFFECT_ID = "rk022_pass_search";
const RIDER_PASS_MAX = 4;

function riderPassSearchIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].deck
    .filter((c) => isUnitCard(state, c.cardId) && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("DEN-O"))
    .map((c) => c.instanceId);
}

/** ライダーパスを常駐置き場に配置したとき（rules/residentOps.ts の applyResidentOpOnPlace から呼ぶ）。 */
export function applyRk2ResidentPlaced(state: GameState, ownerId: PlayerId, opInstanceId: string, cardId: string): GameState {
  if (cardId !== "RK-022") return state;
  const ids = riderPassSearchIds(state, ownerId);
  if (ids.length === 0) return patchPlayer(state, ownerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return openOrQueue(state, {
    ...base({ playerId: ownerId, phasePlayerId: state.activePlayer, sourceInstanceId: opInstanceId }, "RK-022"),
    effectId: RIDER_PASS_SEARCH_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function finishRiderPassSearch(state: GameState, pending: PendingEffectChoice): GameState {
  const shuffled = patchPlayer(state, pending.playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return proceed(close(shuffled, pending), pending);
}

CHOICE_RESOLVERS[RIDER_PASS_SEARCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const opId = pending.sourceInstanceId;
  const placed = patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: p.deck.filter((c) => c.instanceId !== instanceId),
    operation: p.operation.map((c) =>
      c.instanceId === opId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { ...stripForZone(card), faceDown: false }] } : c,
    ),
  }));
  const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "RK-022", `${RIDER_PASS_SEARCH_EFFECT_ID}:${card.cardId}`);
  const rest = riderPassSearchIds(placed, playerId);
  if (picked.length >= RIDER_PASS_MAX || rest.length === 0) {
    return { state: finishRiderPassSearch({ ...placed, pendingEffectChoice: pending }, pending), log };
  }
  return { state: { ...placed, pendingEffectChoice: { ...pending, validInstanceIds: rest, selectedInstanceIds: picked } }, log };
};
CHOICE_SKIPPERS[RIDER_PASS_SEARCH_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finishRiderPassSearch(state, pending), log: skipLog(state, playerId, "RK-022", RIDER_PASS_SEARCH_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-023 仮面ライダー1号（RC）
// 「【技の1号】「SP1」これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルし、自分が次の行動の宣言を
//  するまで相手はカウンターを発動できない。」（atwiki/page-106）。効果の内容は「SP1」を含むテキスト全体（grnrngr/faq-rider-2 SK-002 Q1）。
// RC を発動したターン、このユニットは「SP1」（重複しても SP1。grnrngr/faq-rider-1 RK-023 Q1）になり、アタックするときの2つの効果を持つ。

const WAZA_RULE = "rk023_waza_no_ichigo";

function applyWaza(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !state.players[ctx.playerId].battle.some((c) => c.instanceId === id)) return { state, detail: "rk023:no_unit" };
  const withSp = patchPlayer(state, ctx.playerId, (p) => grantSp1OnPlayer(p, id, state.definitions));
  return { state: addTurnPayload(withSp, ctx.playerId, WAZA_RULE, "RK-023", { instanceId: id }), detail: "rk023:waza" };
}

function hasWaza(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return turnPayloads<{ instanceId: string }>(state.players[playerId], WAZA_RULE).some((p) => p.instanceId === instanceId);
}

/** 【技の1号】: アタックするとき、敵軍ユニットの BP を本来の値としてバトルする（rules/namedUnitEffects.ts battleDefenderBp）。 */
export function rk2UsePrintedDefenderBp(state: GameState, pending: PendingBattle): boolean {
  return hasWaza(state, pending.attackerPlayerId, pending.attackerInstanceId);
}

/** 【技の1号】: アタックするとき相手はカウンターを発動できない（rules/namedUnitEffects.ts attackerBlocksDefenderCounters）。 */
export function rk2BlocksDefenderCounters(state: GameState, attackerPlayerId: PlayerId, attackerInstanceId: string): boolean {
  return hasWaza(state, attackerPlayerId, attackerInstanceId);
}

// ---------------------------------------------------------------------------
// RK-024 サイクロン号・RK-028 バトルホッパー・RK-030 トライチェイサー（ビークル）の「これがバトルエリアに出たとき」
// ライドしたユニットと一緒に出たときは、ユニットの進入効果のところ（tryRk2OnEnterBattle）からビークルの効果として発動する。
// ビークルだけで出たとき（RK-028 ※）は、ビークル自身の DSL（rk2:: キーワード）から発動する。

/** ビークルにライドしているユニット（同じエリア）。 */
function riderOf(state: GameState, playerId: PlayerId, vehicleInstanceId: string): CardInstance | undefined {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].find((c) => c.mountedOnInstanceId === vehicleInstanceId);
}

export const CYCLONE_EFFECT_ID = "rk024_cyclone_crusher";

// 「自軍ターン中、これがバトルエリアに出たとき、追加条件を持たないBP4000以上の敵軍Sユニットを1体選び、持ち主のコマンドゾーンに
//  ホールド状態で置く。置けなければ捨札にする。」（atwiki/page-50）。エリアは問わない（カード評価「エリアを問わずに除去できる」）。
//  参照する BP は今の値（カード評価「参照するBPは本来の値ではない」）。選ぶのは強制。
function cycloneTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def || !rk1IsSmallNow(state, c)) return false;
      if (resolveRushAdditionalCondition(c.cardId, def as never)) return false;
      return effectiveBp(state, enemyId, c) >= 4000;
    })
    .map((c) => c.instanceId);
}

function openCyclone(state: GameState, playerId: PlayerId, vehicleInstanceId: string): GameState {
  if (state.activePlayer !== playerId) return state;
  const ids = cycloneTargets(state, playerId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicleInstanceId }, "RK-024"),
    effectId: CYCLONE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

CHOICE_RESOLVERS[CYCLONE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = [...state.players[enemyId].battle, ...state.players[enemyId].rush].find((c) => c.instanceId === instanceId);
  if (!target) return { error: "invalid_target" };
  // 離場の処理を通す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。
  const placed = sendFieldCardsToCommandHeld(close(state, pending), enemyId, [instanceId], pending.phasePlayerId);
  return { state: proceed(placed, pending), log: logFor(state, playerId, "RK-024", `${CYCLONE_EFFECT_ID}:${target.cardId}`) };
};

export const SMASH_EFFECT_ID = "rk028_dynamic_smash";

// 「自軍ターン中、これがバトルエリアに出たとき、これにライドしているユニットの本来のBP以下のBPを持つSユニットを敵軍バトルエリアから
//  1体選び、持ち主の手札に戻す。」（atwiki/page-216）。ライドされずに出たときは比べる BP がないので何もしない。強制。
function openSmash(state: GameState, playerId: PlayerId, vehicleInstanceId: string): GameState {
  if (state.activePlayer !== playerId) return state;
  const rider = riderOf(state, playerId, vehicleInstanceId);
  if (!rider) return state;
  const limit = getDefinition(state.definitions, rider.cardId)?.bp ?? 0;
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && effectiveBp(state, enemyId, c) <= limit)
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicleInstanceId }, "RK-028"),
    effectId: SMASH_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    unitDestination: "hand",
  });
}

export const RADIO_LOOK_EFFECT_ID = "rk030_radio_look";
export const RADIO_PLACE_EFFECT_ID = "rk030_radio_place";
export const RADIO_DECK_TOP = "deck_top";
export const RADIO_DECK_BOTTOM = "deck_bottom";

// 「自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚を見てもよい。そうしたとき、それを元に戻すか、山札の下に戻すかを
//  選択する。」（atwiki/page-202）。見る（任意）→ 上（deck_top）か下（deck_bottom）を選ぶ。
function openRadio(state: GameState, playerId: PlayerId, vehicleInstanceId: string): GameState {
  if (state.activePlayer !== playerId) return state;
  const top = state.players[playerId].deck[0];
  if (!top) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicleInstanceId }, "RK-030"),
    effectId: RADIO_LOOK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [top.instanceId],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[RADIO_LOOK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: RADIO_PLACE_EFFECT_ID,
        kind: "confirm",
        validInstanceIds: [RADIO_DECK_TOP, RADIO_DECK_BOTTOM],
        viewedInstanceIds: [instanceId],
        optional: false,
        rk2Meta: { picked: instanceId },
      },
    },
    log: logFor(state, playerId, "RK-030", `${RADIO_LOOK_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_SKIPPERS[RADIO_LOOK_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[RADIO_PLACE_EFFECT_ID] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  const pickedId = pending.rk2Meta?.picked;
  const card = state.players[playerId].deck.find((c) => c.instanceId === pickedId);
  if (!card) return { error: "invalid_target" };
  const placed =
    where === RADIO_DECK_BOTTOM
      ? patchPlayer(state, playerId, (p) => ({ ...p, deck: [...p.deck.filter((c) => c.instanceId !== pickedId), card] }))
      : state;
  return { state: proceed(close(placed, pending), pending), log: logFor(state, playerId, "RK-030", `${RADIO_PLACE_EFFECT_ID}:${where}`) };
};

function applyVehicleEnter(state: GameState, ctx: GrantKeywordContext, cardId: string): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state };
  const open = cardId === "RK-024" ? openCyclone : cardId === "RK-028" ? openSmash : openRadio;
  return { state: open(state, ctx.playerId, id), detail: `${cardId}:enter` };
}

const VEHICLE_ENTER: Record<string, (state: GameState, playerId: PlayerId, vehicleInstanceId: string) => GameState> = {
  "RK-024": openCyclone,
  "RK-028": openSmash,
  "RK-030": openRadio,
};

// ---------------------------------------------------------------------------
// RK-025 電波人間タックル（RC）
// 「敵軍山札の上から2枚をオモテにする。オモテにしたカードの中から、特徴「男」を持つユニットカードを持ち主のコマンドゾーンに
//  ホールド状態で置く。置けなかったカードと、それ以外のカードは、相手が好きな順で山札の上に戻す。」（atwiki/page-200）。強制。
// 戻すカードが2枚以上なら、相手が上に置くカードから1枚ずつ選ぶ。

export const DENPA_ORDER_EFFECT_ID = "rk025_denpa_order";

function applyDenpaNage(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const revealed = state.players[enemyId].deck.slice(0, 2);
  if (revealed.length === 0) return { state, detail: "rk025:empty" };
  let next = state;
  const back: CardInstance[] = [];
  for (const card of revealed) {
    const def = getDefinition(next.definitions, card.cardId);
    const male = def?.type === "unit" && (def.features ?? []).includes("男");
    if (male && next.players[enemyId].command.length < COMMAND_ZONE_MAX) {
      next = patchPlayer(next, enemyId, (p) => ({
        ...p,
        deck: p.deck.filter((c) => c.instanceId !== card.instanceId),
        command: [...p.command, { ...stripForZone(card), commandHeld: true }],
      }));
    } else {
      back.push(card);
    }
  }
  const backIds = new Set(back.map((c) => c.instanceId));
  next = recordReveal(next, {
    playerId: ctx.playerId,
    ownerId: enemyId,
    sourceCardId: ctx.sourceCardId,
    effectLabel: "電波投げ",
    from: "deck_top",
    cards: revealedCards(revealed, (c) => (backIds.has(c.instanceId) ? "deck_top" : "command")),
  });
  if (back.length < 2) return { state: next, detail: "rk025:denpa_nage" };
  return {
    state: openOrQueue(next, {
      ...base({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-025"),
      effectId: DENPA_ORDER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: back.map((c) => c.instanceId).sort(),
      viewedInstanceIds: back.map((c) => c.instanceId),
      selectCount: 1,
      optional: false,
    }),
    detail: "rk025:denpa_nage",
  };
}

CHOICE_RESOLVERS[DENPA_ORDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const placedIds = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  const log = logFor(state, playerId, "RK-025", `${DENPA_ORDER_EFFECT_ID}:${instanceId}`);
  if (rest.length > 1) {
    return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: rest, selectedInstanceIds: placedIds } }, log };
  }
  // 選んだ順に上から並べる（最後の1枚はその下）。
  const order = [...placedIds, ...rest];
  const reordered = patchPlayer(state, playerId, (p) => {
    const cards = order.map((id) => p.deck.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
    const others = p.deck.filter((c) => !order.includes(c.instanceId));
    return { ...p, deck: [...cards, ...others] };
  });
  return { state: proceed(close(reordered, pending), pending), log };
};

// ---------------------------------------------------------------------------
// RK-026 がんがんじい
// 「【日本一の正義の味方】自軍ターン中、これがバトルエリアに出たとき、特徴「仮面ライダー」を持つ自軍ユニットを1体選び、ラッシュエリアに
//  戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。」（atwiki/page-201）
// 「ラッシュエリアに戻す」のでバトルエリアのユニットから選ぶ。ライドしているユニットはライドしたまま戻る（ビークルも一緒。Q1）。

export const SEIGI_EFFECT_ID = "rk026_seigi_no_mikata";

function applySeigi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state };
  const ids = state.players[ctx.playerId].battle
    .filter((c) => c.instanceId !== ctx.triggerSourceInstanceId && isUnitCard(state, c.cardId) && featuresOf(state, ctx.playerId, c).includes("仮面ライダー"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk026:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-026"),
      effectId: SEIGI_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: SEIGI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SEIGI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unit = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  const vehicleId = unit.mountedOnInstanceId;
  const moving = new Set([instanceId, ...(vehicleId ? [vehicleId] : [])]);
  const moved = patchPlayer(state, playerId, (p) => {
    const cards = p.battle.filter((c) => moving.has(c.instanceId));
    return markBattleBlocked({ ...p, battle: p.battle.filter((c) => !moving.has(c.instanceId)), rush: [...p.rush, ...cards] }, instanceId);
  });
  return { state: proceed(close(moved, pending), pending), log: logFor(state, playerId, "RK-026", `${SEIGI_EFFECT_ID}:${unit.cardId}`) };
};
CHOICE_SKIPPERS[SEIGI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-027 仮面ライダーBLACK
// 「※これはライド中、BP+1000される。」— rk2FieldBpBonus。
// 「【ライダーキック】自軍も敵軍もSユニットが1体しかいなければ、敵軍Sユニットを1体選び持ち主のパワーゾーンにダメージにして置く。」（RC。atwiki/page-215）
// S ユニットはラッシュエリア・バトルエリアの両方で数え、選ぶ敵軍 S ユニットのエリアも問わない（カード評価「エリアを問わない能力」）。

export const RIDER_KICK_EFFECT_ID = "rk027_rider_kick";

function smallUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  return fieldUnits(state, playerId).filter((c) => rk1IsSmallNow(state, c));
}

function applyRiderKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const enemyS = smallUnits(state, enemyId);
  if (smallUnits(state, ctx.playerId).length !== 1 || enemyS.length !== 1) return { state, detail: "rk027:condition_not_met" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-027"),
      effectId: RIDER_KICK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: enemyS.map((c) => c.instanceId),
      selectCount: 1,
      optional: false,
      unitDestination: "power",
      placeAsDamage: true,
    }),
    detail: RIDER_KICK_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-029 仮面ライダークウガMF
// 「※これはライド中、ライドしていない敵軍Sユニットにアタックされない。」— rk2DefenderBlocksAttack。
// 「【マイティキック】自軍ターン中、これは自軍バトルエリアにある特徴「警察」を持つユニット1体につきBP+1000される。」（RC。atwiki/page-217）
// RC を発動したターン、自軍ターン中の BP を rk2FieldBpBonus で数える。

const MIGHTY_KICK_RULE = "rk029_mighty_kick";

function applyMightyKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state };
  return { state: addTurnPayload(state, ctx.playerId, MIGHTY_KICK_RULE, "RK-029", { instanceId: id }), detail: "rk029:mighty_kick" };
}

// ---------------------------------------------------------------------------
// RK-031 仮面ライダーG3MILD（RC）
// 「【バッテリー交換】自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（置けなければこの効果は
//  発動できない）。」（atwiki/page-203）。発動するかを選び（任意）、発動すれば山札の上の1枚をホールド状態で置く。

export const BATTERY_EFFECT_ID = "rk031_battery";
const BATTERY_USE = "use";

function applyBattery(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const p = state.players[ctx.playerId];
  if (p.command.length >= COMMAND_ZONE_MAX || p.deck.length === 0) return { state, detail: "rk031:cannot" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-031"),
      effectId: BATTERY_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [BATTERY_USE],
      selectCount: 1,
      optional: true,
    }),
    detail: BATTERY_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BATTERY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const top = state.players[playerId].deck[0];
  if (!top || state.players[playerId].command.length >= COMMAND_ZONE_MAX) return { state: proceed(close(state, pending), pending) };
  const placed = patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: p.deck.slice(1),
    command: [...p.command, { ...stripForZone(top), commandHeld: true }],
  }));
  return { state: proceed(close(placed, pending), pending), log: logFor(state, playerId, "RK-031", `${BATTERY_EFFECT_ID}:${top.cardId}`) };
};
CHOICE_SKIPPERS[BATTERY_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-032 アナザーアギト
// 「※これは自軍ラッシュエリアの特徴「仮面ライダー」を持つユニットを1体捨札にしなければバトルエリアに出られない。」— rules/legend3/restrictions.ts。
// 「【アナザーパンチ】敵軍バトルエリアから、特徴「仮面ライダー」を持つSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（RC。atwiki/page-218）

export const ANOTHER_PUNCH_EFFECT_ID = "rk032_another_punch";

function applyAnotherPunch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && featuresOf(state, enemyId, c).includes("仮面ライダー"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk032:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-032"),
      effectId: ANOTHER_PUNCH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "power",
      placeAsDamage: true,
    }),
    detail: ANOTHER_PUNCH_EFFECT_ID,
  };
}

/** RK-032 の※（「自軍ラッシュエリアの特徴「仮面ライダー」を持つユニットを1体捨札にしなければバトルエリアに出られない」）を持つか。 */
export function rk2NeedsKamenRiderRushDiscard(cardId: string): boolean {
  return cardId === "RK-032";
}

/** 「自軍ラッシュエリアの特徴「仮面ライダー」を持つユニット」（RK-032 ※の捨札にできるユニット）か。 */
export function rk2KamenRiderRushDiscardable(definitions: GameState["definitions"], cardId: string): boolean {
  const def = getDefinition(definitions, cardId);
  return def?.type === "unit" && (def.features ?? []).includes("仮面ライダー");
}

// ---------------------------------------------------------------------------
// RK-033 仮面ライダー龍騎・RK-038 仮面ライダーガイ（コンビネーション）
// RK-033「【ドラゴンライダーキック】特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」」（atwiki/page-178）
// RK-038「【ヘビープレッシャー】「メタルゲラス」からコンビネーションしたとき発動できる⇒敵軍ユニットを1体選び撃破してもよい。ただし、
//  必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない。」（atwiki/page-51）
// コンビネーションは直前に出たユニット（左隣）との間に成立し、自軍バトルフェイズに出たときだけ（R-CN-04・R-CN-05）。

export const HEAVY_PRESSURE_EFFECT_ID = "rk038_heavy_pressure";

function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

function heavyPressureTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  const damage = state.players[enemyId].damage;
  return fieldUnits(state, enemyId)
    .filter((c) => {
      const cost = parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost);
      return Number.isFinite(cost) && cost <= damage;
    })
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RK-039 メタルゲラス
// 「【突進】自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍Sユニットを１体選び、ライドオフさせる。」（atwiki/page-183）。強制。
// ライドオフさせたユニットはその場（ビークルの次）に残る。効果によるライドオフで RC が発動するかの出典はないので発動させない。

export const CHARGE_EFFECT_ID = "rk039_charge";

function applyCharge(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !!c.mountedOnInstanceId && rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk039:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-039"),
      effectId: CHARGE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: CHARGE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[CHARGE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const found = findField(state, enemyId, instanceId);
  if (!found) return { error: "invalid_target" };
  const off = patchPlayer(state, enemyId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => {
      if (c.instanceId !== instanceId) return c;
      const { mountedOnInstanceId: _m, ...rest } = c;
      return rest;
    }),
  }));
  return { state: proceed(close(off, pending), pending), log: logFor(state, playerId, "RK-039", `${CHARGE_EFFECT_ID}:${found.card.cardId}`) };
};

// ---------------------------------------------------------------------------
// ユニットがバトルエリアに出たとき（rules/combo.ts の進入効果から呼ぶ）

export function tryRk2OnEnterBattle(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  let next = state;
  // ライドしたユニットと一緒に出たビークルの「これがバトルエリアに出たとき」。
  const vehicleId = card.mountedOnInstanceId;
  if (vehicleId) {
    const vehicle = next.players[playerId].battle.find((c) => c.instanceId === vehicleId);
    const open = vehicle ? VEHICLE_ENTER[vehicle.cardId] : undefined;
    if (vehicle && open) next = open(next, playerId, vehicle.instanceId);
  }
  const ownBattlePhase = next.phase === "battle" && next.activePlayer === playerId;
  if (!ownBattlePhase) return next;
  const partner = comboPartner(next, battleBeforeEnter);
  // RK-063（スターター版）も同じテキスト（atwiki/page-178）。
  // RK-171 コントラクトで選ばれていれば、本来の特徴に「ミラーモンスター」を持つユニットからでもよい（rules/rk/rk9Fields.ts）。
  if ((card.cardId === "RK-033" || card.cardId === "RK-063") && partner && (featuresOf(next, playerId, partner).includes("ドラゴン") || rk9ContractCovers(next, playerId, card, partner))) {
    next = patchPlayer(next, playerId, (p) => grantSp1OnPlayer(p, card.instanceId, next.definitions));
  }
  if (card.cardId === "RK-038" && partner && (cardName(next.definitions, partner.cardId) === "メタルゲラス" || rk9ContractCovers(next, playerId, card, partner))) {
    const ids = heavyPressureTargets(next, playerId);
    if (ids.length > 0) {
      next = openOrQueue(next, {
        ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "RK-038"),
        effectId: HEAVY_PRESSURE_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
        unitDestination: "discard",
      });
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// 常時の効果

function adjacentBattleCardIds(state: GameState, playerId: PlayerId, instanceId: string): string[] {
  const battle = state.players[playerId].battle;
  const i = battle.findIndex((c) => c.instanceId === instanceId);
  if (i < 0) return [];
  return [battle[i - 1], battle[i + 1]].filter((c): c is CardInstance => !!c).map((c) => c.cardId);
}

function isMirrorRiderS(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return rk1IsSmallNow(state, card) && featuresOf(state, playerId, card).includes("ミラーライダー");
}

/**
 * BP の増減（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ）。
 * - RK-027「※これはライド中、BP+1000される。」
 * - RK-029【マイティキック】（RC を発動したターンの自軍ターン中、自軍バトルエリアの「警察」1体につき BP+1000）
 * - RK-034【ドラグブレス】「このユニットと隣り合う特徴「ミラーライダー」を持つSユニットは、バトルするときBP+2000される。」
 *   隣り合うのはバトルエリアの並び順だけ（grnrngr/faq-rider-1 RK-034 Q1）。両隣のドラグレッダーの分は重複する。
 */
export function rk2FieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  let bonus = 0;
  if (role === "general") {
    if (instance.cardId === "RK-027" && instance.mountedOnInstanceId) bonus += 1000;
    if (
      instance.cardId === "RK-029" &&
      state.activePlayer === playerId &&
      turnPayloads<{ instanceId: string }>(state.players[playerId], MIGHTY_KICK_RULE).some((p) => p.instanceId === instance.instanceId)
    ) {
      bonus += 1000 * state.players[playerId].battle.filter((c) => isUnitCard(state, c.cardId) && featuresOf(state, playerId, c).includes("警察")).length;
    }
    return bonus;
  }
  if (isMirrorRiderS(state, playerId, instance)) {
    bonus += 2000 * adjacentBattleCardIds(state, playerId, instance.instanceId).filter((id) => id === "RK-034").length;
  }
  return bonus;
}

/**
 * アタックできない組み合わせか（rules/legend3/restrictions.ts の canAttackDefender から呼ぶ）。
 * - RK-029「※これはライド中、ライドしていない敵軍Sユニットにアタックされない。」
 * - RK-037【グライディング】「このユニットと隣り合う特徴「ミラーライダー」を持つSユニットは、敵軍ユニットにアタックされない。」
 *   隣り合うのはバトルエリアの並び順だけ（grnrngr/faq-rider-1 RK-037 Q1）。
 */
export function rk2DefenderBlocksAttack(
  state: GameState,
  _attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  if (defender.cardId === "RK-029" && defender.mountedOnInstanceId && !attacker.mountedOnInstanceId && rk1IsSmallNow(state, attacker)) {
    return true;
  }
  if (
    isMirrorRiderS(state, defenderPlayerId, defender) &&
    adjacentBattleCardIds(state, defenderPlayerId, defender.instanceId).includes("RK-037")
  ) {
    return true;
  }
  return false;
}

/**
 * RK-040 ベノスネーカー【毒液】「敵軍ターン中、これとバトルしたユニットは、特徴「男」または「女」を持つとき、バトルに勝っても撃破される。」
 * （atwiki/page-184）。unit がベノスネーカーとバトルしていて（ベノスネーカーの持ち主から見て敵軍ターン）、「男」か「女」を持つなら true。
 */
export function rk2VenomDestroys(
  state: GameState,
  unitOwner: PlayerId,
  unit: CardInstance,
  opponentCard: CardInstance,
): boolean {
  if (opponentCard.cardId !== "RK-040") return false;
  const snakeOwner = opponent(unitOwner);
  if (state.activePlayer === snakeOwner) return false;
  const features = featuresOf(state, unitOwner, unit);
  return features.includes("男") || features.includes("女");
}

/**
 * RK-041 ジェノサイダー【ドゥームズデイ】「これが自軍バトルエリアにある間、敵軍Sユニットはストライクしてダメージを与えたとき撃破される。」
 * （atwiki/page-185）。ストライクのダメージを与えたあと（core/applyAction.ts finishStrikeResolution）に、撃破するユニットを返す。
 */
function rk2DoomsdayStriker(state: GameState, pending: PendingStrike): CardInstance | null {
  if (pending.damageCancelled || pending.damage <= 0) return null;
  const enemyId = opponent(pending.strikerPlayerId);
  if (!state.players[enemyId].battle.some((c) => c.cardId === "RK-041")) return null;
  const striker = state.players[pending.strikerPlayerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!striker || !rk1IsSmallNow(state, striker)) return null;
  return striker;
}

/** ストライクのダメージを与えたあと: 【ドゥームズデイ】でストライクしたユニットを撃破する（撃破の置換・反応は tryLeaveField に任せる）。 */
export function applyRk2StrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || state.pendingEffectChoice || state.pendingDamagePayment || state.pendingLeave) return state;
  const striker = rk2DoomsdayStriker(state, pending);
  if (!striker) return state;
  const leave = tryLeaveField(state, {
    ownerPlayerId: pending.strikerPlayerId,
    instanceId: striker.instanceId,
    fromZone: "battle",
    toZone: "discard",
    leavingCardId: striker.cardId,
    phasePlayerId: pending.battlePhasePlayer,
  });
  if (leave.deferred) return leave.state;
  return destroyStriker(state, pending.strikerPlayerId, striker.instanceId);
}

// ---------------------------------------------------------------------------
// RK-036 仮面ライダーライア【運命への反抗】
// 「これが自軍バトルエリアにある間、自分は自軍コマンドをホールドせずにカウンターのオペレーションを使用できる。ただし、使用するオペレーションと
//  同じカテゴリのカードを自軍コマンドゾーンから1枚選び、捨札にしなければ使用できない。」（atwiki/page-181）
// 対価の「同カテゴリのコマンドをホールドする」の代わりになるだけ（grnrngr/faq-rider-1 RK-036 Q1）。コマンドの状態（ホールド・リリース）は問わない。

/** ライアの支払いで捨札にできる自軍コマンドゾーンのカード（ライアがいなければ空）。 */
export function rk2RaiaDiscardCandidates(p: PlayerState, definitions: GameState["definitions"], categories: readonly string[]): string[] {
  if (!p.battle.some((c) => c.cardId === "RK-036")) return [];
  if (categories.length === 0) return [];
  return p.command
    .filter((c) => {
      const def = getDefinition(definitions, c.cardId);
      if (!def) return false;
      const cats = cardCategories(def) as readonly string[];
      return categories.every((cat) => cats.includes(cat));
    })
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RK-042 ブランウイング【閃光の翼】
// 「これが自軍バトルエリアにある間、相手は次の制限を受ける⇒スタートフェイズにリリースするコマンドが2つ以上あれば、スタートフェイズを
//  終えるとき、自分自身のコマンドを1つ選びホールドする。」（atwiki/page-186）。体数分重複し（Q1）、1体につき1つ（Q2）。

export const FLASH_WING_EFFECT_ID = "rk042_flash_wing_hold";
const START_RELEASE_RULE = "rk042_start_released";

/** スタートフェイズのリリース（core/applyAction.ts release_start_commands）で、リリースする枚数を記録する（ブランウイングがあるときだけ）。 */
export function rk2RecordStartRelease(state: GameState, playerId: PlayerId, releasedCount: number): GameState {
  if (!state.players[opponent(playerId)].battle.some((c) => c.cardId === "RK-042")) return state;
  return addTurnPayload(state, playerId, START_RELEASE_RULE, "RK-042", { count: releasedCount });
}

function openFlashWingHold(state: GameState, playerId: PlayerId, remaining: number): GameState {
  const ids = state.players[playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (remaining <= 0 || ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId }, "RK-042"),
    effectId: FLASH_WING_EFFECT_ID,
    kind: "select_command",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    rk2Meta: { remaining },
  });
}

/** スタートフェイズを終えるとき（rules/startPhase.ts transitionStartToChargePhase から呼ぶ）。 */
export function applyRk2StartPhaseEnd(state: GameState, playerId: PlayerId): GameState {
  const released = turnPayloads<{ count: number }>(state.players[playerId], START_RELEASE_RULE).reduce((n, p) => n + p.count, 0);
  if (released < 2) return state;
  const wings = state.players[opponent(playerId)].battle.filter((c) => c.cardId === "RK-042").length;
  return openFlashWingHold(state, playerId, wings);
}

CHOICE_RESOLVERS[FLASH_WING_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const held = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  const remaining = (pending.rk2Meta?.remaining ?? 1) - 1;
  const closed = close(held, pending);
  const reopened = openFlashWingHold(closed, playerId, remaining);
  return {
    state: reopened.pendingEffectChoice ? reopened : proceed(reopened, pending),
    log: logFor(state, playerId, "RK-042", `${FLASH_WING_EFFECT_ID}:${instanceId}`),
  };
};

// ---------------------------------------------------------------------------
// 起点

const RK2_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-023::waza_no_ichigo": applyWaza,
  "RK-024::cyclone_crusher": (s, c) => applyVehicleEnter(s, c, "RK-024"),
  "RK-025::denpa_nage": applyDenpaNage,
  "RK-026::seigi_no_mikata": applySeigi,
  "RK-027::rider_kick": applyRiderKick,
  "RK-028::dynamic_smash": (s, c) => applyVehicleEnter(s, c, "RK-028"),
  "RK-030::musen_tsushin": (s, c) => applyVehicleEnter(s, c, "RK-030"),
  "RK-031::battery_koukan": applyBattery,
  "RK-032::another_punch": applyAnotherPunch,
  "RK-039::tosshin": applyCharge,
  // RK-038【ヘビープレッシャー】は「メタルゲラス」からのコンビネーションで発動する（tryRk2OnEnterBattle）。DSL の nc からは何もしない。
  "RK-038::heavy_pressure": (s) => ({ state: s, detail: "rk038:on_enter" }),
};

/** 生成 DSL のキーワードのまま、このモジュールで処理するもの（他のテストが生成キーワードを参照するため置きかえない）。 */
const RK2_LEGACY_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  // RK-029【マイティキック】（featureKeywords.test.ts が per_ally_<警察>_bp_1000 を参照する）。
  "RK-029::per_ally_feat_e8ada6e5af9f_bp_1000": applyMightyKick,
};

export function tryRk2CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (keyword.startsWith(RK2_KEYWORD_PREFIX)) {
    const handler = RK2_KEYWORDS[keyword.slice(RK2_KEYWORD_PREFIX.length)];
    return handler ? handler(state, ctx) : { state, detail: keyword };
  }
  const legacy = RK2_LEGACY_KEYWORDS[`${ctx.sourceCardId}::${keyword}`];
  return legacy ? legacy(state, ctx) : null;
}
