/**
 * ザ・マスクドライダーEXP vol.1 RK-001〜RK-021（オペレーション）のカード固有の効果（cardSpec RK1-001-021 の監査）。
 *
 * - `tryRk1CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk1::cardId::name`。通常のオペレーション）。
 * - `tryResolveRk1Choice` / `trySkipRk1Choice`: このモジュールが開いた選択の解決。
 * - カウンター（RK-004・RK-009・RK-015）と常駐（RK-001・RK-003・RK-006・RK-010・RK-011・RK-014・RK-016）は、
 *   それぞれの処理の場所（operationCounters・restrictions・addedFeatures・fieldAuras・leaveEffects 等）から呼ぶ。
 * 構成は rules/legend1/set9NamedEffectsD.ts と同じ。
 */
import type { Category } from "@rangers-strike/cards";
import type {
  CardInstance,
  DeferredDestroyTrigger,
  GameState,
  PendingBattle,
  PendingEffectChoice,
  PendingLeave,
  PlayerId,
  PlayerState,
} from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { applyDamageToPlayer } from "../damagePayment";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { J_POWER_CARD_ID, hasJPower, rk1AddedUnitFeatures, rk1IsSmallNow, rk1ZoneCardFeatures } from "./rk1Features";
import { rk2FeaturesStripped } from "./rk2Features";

export { J_POWER_CARD_ID, hasJPower, rk1AddedUnitFeatures, rk1IsSmallNow, rk1ZoneCardFeatures };

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export const RK1_KEYWORD_PREFIX = "rk1::";

export function isRk1ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk1Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk1Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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

function choiceBase(ctx: GrantKeywordContext, sourceCardId: string) {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    selectedInstanceIds: [] as string[],
  };
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
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

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function hasResident(state: Pick<GameState, "players">, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].operation.some((c) => c.cardId === cardId);
}

/** SP が空欄ではないか（印刷の SP 欄）。 */
function spNotBlank(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const sp = getDefinition(state.definitions, cardId)?.sp;
  return sp !== undefined && sp !== null && String(sp) !== "" && String(sp) !== "-" && String(sp) !== "－";
}

function turnPayloads<T>(player: PlayerState, ruleId: string): T[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => p !== undefined && p !== null);
}

/** このターンだけの記録を足す（同じ規則 ID でも重ねて記録する。addTurnRuleModifier は同じ ID を1つにまとめるので使わない）。 */
function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

// ---------------------------------------------------------------------------
// RK-001 改造人間（※常駐）・RK-013 Jパワー の特徴の追加と、J パワーによるサイズの変更

function unitFeaturesOf(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  // RK-035 ダークウイング【ソニックブレイカー】（rules/rk/rk2Features.ts）。
  if (rk2FeaturesStripped(state, ownerId, card)) return [];
  const base = getDefinition(state.definitions, card.cardId)?.features ?? [];
  const extra = rk1AddedUnitFeatures(state, ownerId, card, base).filter((f) => !base.includes(f));
  return [...base, ...extra];
}

/**
 * applyAction の後処理: 重ねたユニットがユニットでなくなったら J パワーは捨札になる（atwiki/page-211
 * 「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）。ユニットの下の J パワーを持ち主の捨札に出す。
 */
function settleJPowerStacks(state: GameState): GameState {
  let next = state;
  // J パワーが場のユニットの下か場以外のカードの下にあるときだけ（ほとんどのアクションでは何もしない）。
  const anyStacked = (["player1", "player2"] as const).some((pid) =>
    (["power", "discard", "hand", "deck", "command"] as const).some((z) => state.players[pid][z].some((c) => c.stackedCards !== undefined)),
  );
  if (!anyStacked) return state;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    const zones = ["power", "discard", "hand", "deck", "command"] as const;
    const freed: CardInstance[] = [];
    const patched: Partial<PlayerState> = {};
    for (const zone of zones) {
      const cards = player[zone];
      if (!cards.some((c) => hasJPower(c))) continue;
      patched[zone] = cards.map((c) => {
        if (!hasJPower(c)) return c;
        const stacked = c.stackedCards ?? [];
        freed.push(...stacked.filter((s) => s.cardId === J_POWER_CARD_ID).map((s) => stripForZone(s)));
        const rest = stacked.filter((s) => s.cardId !== J_POWER_CARD_ID);
        if (rest.length > 0) return { ...c, stackedCards: rest };
        const { stackedCards: _s, ...without } = c;
        return without;
      });
    }
    if (freed.length === 0) continue;
    next = { ...next, ...{ players: { ...next.players, [pid]: { ...player, ...patched, discard: [...(patched.discard ?? player.discard), ...freed] } } } };
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-002 V3ホッパー（オペレーション）
// 「自軍山札の上から3枚を見て、そのカードを山札の上か下にそれぞれ好きな順で戻す。」（atwiki/page-191）
// 1枚ずつ選び、山札の上（deck_top）か下（deck_bottom）に戻す。上に戻したカードは後から戻したものほど上、
// 下に戻したカードは後から戻したものほど下になる（1枚ずつ戻す手順）。見送れない。

export const V3_PICK_EFFECT_ID = "rk002_v3_pick";
export const V3_PLACE_EFFECT_ID = "rk002_v3_place";
export const V3_DECK_TOP = "deck_top";
export const V3_DECK_BOTTOM = "deck_bottom";

function openV3Pick(state: GameState, base: Omit<PendingEffectChoice, "effectId" | "kind" | "validInstanceIds">, remaining: string[]): GameState {
  return openEffectChoice(state, {
    ...base,
    effectId: V3_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: remaining,
    viewedInstanceIds: remaining,
    selectCount: 1,
    optional: false,
    rk1Meta: { remainingIds: remaining },
  });
}

function applyV3Hopper(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const prepared = takeHybridRevealedToHand(state, pid);
  const seen = prepared.players[pid].deck.slice(0, 3).map((c) => c.instanceId);
  if (seen.length === 0) return { state: prepared, detail: `${V3_PICK_EFFECT_ID}:empty` };
  // 見たカードは山札に置いたまま、1枚ずつ上か下へ移す（全部を移し終えると「上か下にそれぞれ好きな順で戻した」並びになる）。
  const opened = openV3Pick(prepared, { ...choiceBase(ctx, "RK-002"), optional: false }, seen);
  return { state: opened, detail: V3_PICK_EFFECT_ID };
}

CHOICE_RESOLVERS[V3_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: V3_PLACE_EFFECT_ID,
        kind: "confirm",
        validInstanceIds: [V3_DECK_TOP, V3_DECK_BOTTOM],
        rk1Meta: { ...pending.rk1Meta, picked: instanceId },
      },
    },
    log: logFor(state, playerId, "RK-002", `${V3_PICK_EFFECT_ID}:${instanceId}`),
  };
};

CHOICE_RESOLVERS[V3_PLACE_EFFECT_ID] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  const remaining = pending.rk1Meta?.remainingIds ?? [];
  const pickedId = pending.rk1Meta?.picked;
  const card = state.players[playerId].deck.find((c) => c.instanceId === pickedId);
  if (!card || !pickedId) return { error: "invalid_target" };
  const placed = patchPlayer(state, playerId, (p) => {
    const rest = p.deck.filter((c) => c.instanceId !== pickedId);
    return { ...p, deck: where === V3_DECK_TOP ? [card, ...rest] : [...rest, card] };
  });
  const rest = remaining.filter((id) => id !== pickedId);
  const log = logFor(state, playerId, "RK-002", `${V3_PLACE_EFFECT_ID}:${where}`);
  if (rest.length > 0) {
    const { effectId: _e, kind: _k, validInstanceIds: _v, rk1Meta: _m, ...base } = pending;
    return { state: openV3Pick({ ...placed, pendingEffectChoice: undefined }, base, rest), log };
  }
  return { state: proceed(close(placed, pending), pending), log };
};

// ---------------------------------------------------------------------------
// RK-003 カイゾーグ（※常駐）
// 「敵軍ターン中、自軍Sユニットが撃破されて捨札になったとき、自軍コマンドを1つホールドして次の効果を発動できる⇒
//  そのユニットカードを自軍山札の下に戻す。」（atwiki/page-192）
// ホールドするのはリリース状態の自軍コマンドの先頭（RS-288【ドラゴンハーレー】のミラーワールドと同じ扱い）。

export const KAIZORG_EFFECT_ID = "rk003_kaizorg";

/** 撃破されて捨札になったとき（rules/leaveEffects.ts の after_discard から呼ぶ）。 */
export function applyRk1AfterDiscard(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; instanceId: string; cardId: string; phasePlayerId: PlayerId; destroyed?: boolean },
): GameState {
  if (ctx.destroyed === false) return state;
  const ownerId = ctx.ownerPlayerId;
  // 「敵軍ターン中、」— 撃破が起きたフェイズのプレイヤーが持ち主でないとき。
  if (ctx.phasePlayerId === ownerId) return state;
  const op = state.players[ownerId].operation.find((c) => c.cardId === "RK-003");
  if (!op) return state;
  const def = getDefinition(state.definitions, ctx.cardId);
  if (def?.type !== "unit" || def.size !== "S") return state;
  if (!state.players[ownerId].discard.some((c) => c.instanceId === ctx.instanceId)) return state;
  if (!state.players[ownerId].command.some((c) => !c.commandHeld)) return state;
  return openOrQueue(state, {
    playerId: ownerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: "RK-003",
    sourceInstanceId: op.instanceId,
    effectId: KAIZORG_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [ctx.instanceId],
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

/** リリース状態の自軍コマンドを先頭から n 個ホールドする。足りなければ null。 */
function holdReleasedCommands(state: GameState, playerId: PlayerId, n: number): GameState | null {
  if (n <= 0) return state;
  const player = state.players[playerId];
  const released = player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId).slice(0, n);
  if (released.length < n) return null;
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (released.includes(c.instanceId) ? { ...c, commandHeld: true, mothershipHold: false } : c)),
  }));
}

CHOICE_RESOLVERS[KAIZORG_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const card = cleared.players[playerId].discard.find((c) => c.instanceId === instanceId);
  const log = logFor(state, playerId, "RK-003", `${KAIZORG_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : instanceId}`);
  const held = card ? holdReleasedCommands(cleared, playerId, 1) : null;
  if (!card || !held) return { state: proceed(cleared, pending), log };
  // 山札の状態が変わる前に、ハイブリッドエネルギーでオモテにしたカードを手札に加える（RK-010）。
  const prepared = takeHybridRevealedToHand(held, playerId);
  const moved = patchPlayer(prepared, playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    deck: [...p.deck, stripForZone(card)],
  }));
  return { state: proceed(moved, pending), log };
};
CHOICE_SKIPPERS[KAIZORG_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-004 ギギの腕輪・RK-009 二人の世紀王（※カウンター。自軍Sユニットが敵軍Sユニットにアタックされたとき）

export const GIGI_CARD_ID = "RK-004";
export const SEIKIOU_CARD_ID = "RK-009";

export function isRk1BattleCounterCard(cardId: string): boolean {
  return cardId === GIGI_CARD_ID || cardId === SEIKIOU_CARD_ID;
}

function battleUnits(state: GameState, pending: PendingBattle): { attacker?: CardInstance; defender?: CardInstance } {
  return {
    attacker: findField(state, pending.attackerPlayerId, pending.attackerInstanceId)?.card,
    defender: findField(state, pending.defenderPlayerId, pending.defenderInstanceId)?.card,
  };
}

/** 「自軍Sユニットが敵軍Sユニットにアタックされたとき」が成り立っているか（カウンターの条件。コストは別に判定する）。 */
export function rk1BattleCounterConditionMet(state: GameState, defenderId: PlayerId, cardId: string, pending: PendingBattle): boolean {
  if (!isRk1BattleCounterCard(cardId)) return false;
  if (pending.defenderPlayerId !== defenderId || pending.effectBattle) return false;
  const { attacker, defender } = battleUnits(state, pending);
  if (!attacker || !defender) return false;
  return rk1IsSmallNow(state, attacker) && rk1IsSmallNow(state, defender);
}

/** RK-004 / RK-009 の効果（使ったカードを捨札にするのは呼び出し側）。BP の修正はこのバトルの間だけ（PendingBattle に持つ）。 */
export function applyRk1BattleCounterEffect(
  state: GameState,
  defenderId: PlayerId,
  cardId: string,
  pending: PendingBattle,
): { state: GameState; pending: PendingBattle; detail: string } {
  if (cardId === GIGI_CARD_ID) {
    // 「そのバトルの間、アタックされたユニットはBP+2000される。」（atwiki/page-175。Q2「そのバトルが終了するまで」）
    return { state, pending: { ...pending, defenderBpBonus: (pending.defenderBpBonus ?? 0) + 2000 }, detail: "gigi_bracelet" };
  }
  // RK-009「自分も相手も、バトルを行うユニット以外のSユニットをすべて手札に戻す。このときバトルを行うお互いのユニットは、
  //  このバトルの間、戻した自分自身のユニット1体につきそれぞれBP+1000される。」（atwiki/page-209）
  const keep = new Set([pending.attackerInstanceId, pending.defenderInstanceId]);
  let next = state;
  const returned: Record<PlayerId, number> = { player1: 0, player2: 0 };
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    const back: CardInstance[] = [];
    const isReturned = (c: CardInstance) => !keep.has(c.instanceId) && isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c);
    for (const zone of ["battle", "rush"] as const) {
      for (const c of player[zone]) if (isReturned(c)) back.push(c);
    }
    returned[pid] = back.length;
    if (back.length === 0) continue;
    const ids = new Set(back.map((c) => c.instanceId));
    next = patchPlayer(next, pid, (p) => ({
      ...p,
      // 手札に戻したユニットが乗っていたビークルは、ライドされていない状態でその場に残る。
      battle: p.battle.filter((c) => !ids.has(c.instanceId)),
      rush: p.rush.filter((c) => !ids.has(c.instanceId)),
      hand: [...p.hand, ...back.map((c) => stripForZone(c))],
      discard: [...p.discard, ...back.flatMap((c) => (c.stackedCards ?? []).map((s) => stripForZone(s)))],
    }));
  }
  const attackerBonus = 1000 * returned[pending.attackerPlayerId];
  const defenderBonus = 1000 * returned[defenderId];
  return {
    state: next,
    pending: {
      ...pending,
      attackerBpBonus: (pending.attackerBpBonus ?? 0) + attackerBonus,
      defenderBpBonus: (pending.defenderBpBonus ?? 0) + defenderBonus,
    },
    detail: `two_century_kings:${returned.player1}+${returned.player2}`,
  };
}

// ---------------------------------------------------------------------------
// RK-005 超電子ダイナモ（オペレーション）
// 「特徴「改造人間」を持つ自軍Sユニットを1体選ぶ。そうしたとき、このターン、選んだユニットは次の能力を得る⇒
//  SPが空欄ではないユニットを撃破したとき、相手に1点ダメージを与える。」（atwiki/page-193）
// - 2枚使えば2点（Q4）。能力は選んだユニット（instance）がこのターンに持つ。
// - 撃破は「バトルによる撃破を行ったユニット」（grnrngr/faq-rider-1 RK-005 Q3）。効果で撃破したときの扱いは未対応（cardSpec の todo）。

export const DYNAMO_EFFECT_ID = "rk005_dynamo";
const DYNAMO_RULE = "rk005_dynamo_grant";

function applyDynamo(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = fieldUnits(state, pid)
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && unitFeaturesOf(state, pid, c).includes("改造人間"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${DYNAMO_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RK-005"),
      effectId: DYNAMO_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: DYNAMO_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[DYNAMO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = addTurnPayload(close(state, pending), playerId, DYNAMO_RULE, "RK-005", { instanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-005", `${DYNAMO_EFFECT_ID}:${instanceId}`) };
};

/** バトルで撃破したユニットが超電子ダイナモの能力を持っていれば、相手にダメージ（rules/operationCounters.ts から呼ぶ）。 */
export function applyRk1DestroyerDamage(
  state: GameState,
  killerOwner: PlayerId,
  killerInstanceId: string,
  destroyedCardId: string,
): { state: GameState; logs: string[] } {
  const copies = turnPayloads<{ instanceId: string }>(state.players[killerOwner], DYNAMO_RULE).filter(
    (p) => p.instanceId === killerInstanceId,
  ).length;
  if (copies === 0 || !spNotBlank(state, destroyedCardId)) return { state, logs: [] };
  const next = applyDamageToPlayer(state, opponent(killerOwner), copies, { kind: "none", activePlayer: state.activePlayer });
  return { state: next, logs: [buildLogEntry(killerOwner, "named_effect", "RK-005", state.definitions, `dynamo_damage_${copies}`)] };
}

// ---------------------------------------------------------------------------
// RK-006 セイリングジャンプ・RK-014 共同戦線・RK-016 ミラーワールド（アタックの制限）

/** RK-016 ミラーワールド: このユニットと同じカード名のカードを重ねた枚数（能力は重複する。grnrngr/faq-rider-1 RK-016 Q3）。 */
export function mirrorWorldCopies(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, unit: Pick<CardInstance, "cardId">): number {
  const name = getDefinition(state.definitions, unit.cardId)?.name;
  if (!name) return 0;
  let copies = 0;
  for (const op of state.players[ownerId].operation) {
    if (op.cardId !== "RK-016") continue;
    for (const st of op.stackedCards ?? []) {
      if (getDefinition(state.definitions, st.cardId)?.name === name) copies += 1;
    }
  }
  return copies;
}

/** RK-016: アタックするのにホールドしなければならない自分自身のコマンドの数（選ぶ1つ＋さらに2つ、の重ねた枚数倍）。 */
export function rk1AttackCommandCost(state: GameState, defenderPlayerId: PlayerId, defender: Pick<CardInstance, "cardId">): number {
  return 3 * mirrorWorldCopies(state, defenderPlayerId, defender);
}

/** アタックできない組み合わせか（rules/legend3/restrictions.ts の canAttackDefender から呼ぶ）。 */
export function rk1DefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  // RK-006「ライドしていない自軍Sユニットは、ライド中のユニットにアタックされない。」（atwiki/page-194）
  if (
    hasResident(state, defenderPlayerId, "RK-006") &&
    attacker.mountedOnInstanceId &&
    !defender.mountedOnInstanceId &&
    rk1IsSmallNow(state, defender)
  ) {
    return true;
  }
  // RK-014「自軍バトルエリアに特徴「警察」を持つユニットがある間、特徴「仮面ライダー」を持つ自軍ユニットは、敵軍Sユニットにアタックされない。」
  if (
    hasResident(state, defenderPlayerId, "RK-014") &&
    rk1IsSmallNow(state, attacker) &&
    state.players[defenderPlayerId].battle.some((c) => unitFeaturesOf(state, defenderPlayerId, c).includes("警察")) &&
    unitFeaturesOf(state, defenderPlayerId, defender).includes("仮面ライダー")
  ) {
    return true;
  }
  // RK-016「アタックするには、さらに2つホールドしなければならない」— ホールドできるリリース状態の自分自身のコマンドが足りなければアタックできない
  // （6つ必要ならアタックを選択すること自体ができない。atwiki/page-176 Q5）。
  const cost = rk1AttackCommandCost(state, defenderPlayerId, defender);
  if (cost > 0) {
    const released = state.players[attackerPlayerId].command.filter((c) => !c.commandHeld).length;
    if (released < cost) return true;
  }
  return false;
}

/** アタックの宣言で、ミラーワールドの能力のためにアタックする側のコマンドをホールドする（core/applyAction.ts の battle）。 */
export function rk1PayAttackCommandCost(state: GameState, attackerPlayerId: PlayerId, defenderPlayerId: PlayerId, defenderInstanceId: string): GameState {
  const defender = findField(state, defenderPlayerId, defenderInstanceId)?.card;
  if (!defender) return state;
  const cost = rk1AttackCommandCost(state, defenderPlayerId, defender);
  if (cost === 0) return state;
  return holdReleasedCommands(state, attackerPlayerId, cost) ?? state;
}

// ---------------------------------------------------------------------------
// RK-007 メンテナンス（オペレーション）
// 「自軍コマンドゾーンからリリース状態のSユニットのカードを1枚選び手札に戻す。その後、自軍捨札に特徴「改造人間」を持つSユニットのカードが
//  あれば1枚選び、自軍コマンドゾーンにホールド状態で置く。」（atwiki/page-195）
// 「その後」なので、手札に戻せるカードがなくても後半を行う（grnrngr/faq-rider-1 RK-017 Q2）。

export const MAINTENANCE_RETURN_EFFECT_ID = "rk007_maintenance_return";
export const MAINTENANCE_PLACE_EFFECT_ID = "rk007_maintenance_place";

function maintenanceReturnIds(state: GameState, pid: PlayerId): string[] {
  return state.players[pid].command
    .filter((c) => !c.commandHeld && isUnitCard(state, c.cardId) && getDefinition(state.definitions, c.cardId)?.size === "S")
    .map((c) => c.instanceId);
}

function maintenancePlaceIds(state: GameState, pid: PlayerId): string[] {
  return state.players[pid].discard
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        getDefinition(state.definitions, c.cardId)?.size === "S" &&
        rk1ZoneCardFeatures(state, pid, c.cardId).includes("改造人間"),
    )
    .map((c) => c.instanceId);
}

function openMaintenancePlace(state: GameState, base: Omit<PendingEffectChoice, "effectId" | "kind" | "validInstanceIds">): GameState | null {
  const pid = base.playerId;
  if (state.players[pid].command.length >= COMMAND_ZONE_MAX) return null;
  const ids = maintenancePlaceIds(state, pid);
  if (ids.length === 0) return null;
  return openEffectChoice(state, { ...base, effectId: MAINTENANCE_PLACE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
}

function applyMaintenance(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const base = choiceBase(ctx, "RK-007");
  const ids = maintenanceReturnIds(state, ctx.playerId);
  if (ids.length > 0) {
    return {
      state: openEffectChoice(state, { ...base, effectId: MAINTENANCE_RETURN_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: false }),
      detail: MAINTENANCE_RETURN_EFFECT_ID,
    };
  }
  const placed = openMaintenancePlace(state, base);
  return { state: placed ?? state, detail: placed ? MAINTENANCE_PLACE_EFFECT_ID : `${MAINTENANCE_RETURN_EFFECT_ID}:no_targets` };
}

CHOICE_RESOLVERS[MAINTENANCE_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const moved = patchPlayer({ ...state, pendingEffectChoice: undefined }, playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  const { effectId: _e, kind: _k, validInstanceIds: _v, ...base } = pending;
  const log = logFor(state, playerId, "RK-007", `${MAINTENANCE_RETURN_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const next = openMaintenancePlace(moved, base);
  if (next) return { state: next, log };
  return { state: proceed({ ...moved, activePlayer: pending.phasePlayerId }, pending), log };
};

CHOICE_RESOLVERS[MAINTENANCE_PLACE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const moved = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    command: [...p.command, { ...stripForZone(card), commandHeld: true }],
  }));
  return { state: proceed(moved, pending), log: logFor(state, playerId, "RK-007", `${MAINTENANCE_PLACE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-010 ハイブリッドエネルギー（※常駐）
// 「自分がターンを終えるとき、自軍山札の上から1枚をオモテにする。オモテにしたカードが山札の上にある間、そのカードと同じカテゴリの
//  自軍SユニットはBP+1000される。オモテにしたカードがドローされる以外で自軍山札の状態が変更される操作をするとき、
//  オモテにしたカードを手札に加えてから操作する。」（atwiki/page-210）
// - ドロー（スタートフェイズの1枚等）ではそのカードをドローする（Q2）。人類の進化の「ひく」はドローではない（Q1）。
// - 山札を操作する効果のうち、このモジュールのカード（V3ホッパー・カイゾーグ・人類の進化・クロックアップ）は操作の前に手札に加える。
//   それ以外の操作でオモテのカードが山札の上から動いたら、操作の後で手札に加える（settleRk1AfterAction）。

export const HYBRID_CARD_ID = "RK-010";

/** 自分がターンを終えるとき（rules/residentOperation.ts の resolveTurnEndResident から呼ぶ）。 */
export function applyRk1TurnEndResident(state: GameState, ownerId: PlayerId, opCardId: string, endingPlayerId: PlayerId): GameState | null {
  if (opCardId !== HYBRID_CARD_ID) return null;
  if (ownerId !== endingPlayerId) return state;
  const top = state.players[ownerId].deck[0];
  if (!top || top.hybridRevealed) return state;
  return patchPlayer(state, ownerId, (p) => ({ ...p, deck: [{ ...top, hybridRevealed: true }, ...p.deck.slice(1)] }));
}

function hybridRevealedTop(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance | undefined {
  const top = state.players[playerId].deck[0];
  return top?.hybridRevealed ? top : undefined;
}

/** 山札を操作する前に、オモテにしたカードを手札に加える。 */
export function takeHybridRevealedToHand(state: GameState, playerId: PlayerId): GameState {
  const top = hybridRevealedTop(state, playerId);
  if (!top) return state;
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: p.deck.slice(1), hand: [...p.hand, stripForZone(top)] }));
}

function categoriesOf(state: Pick<GameState, "definitions">, cardId: string): Category[] {
  const def = getDefinition(state.definitions, cardId);
  return def ? cardCategories(def) : [];
}

/** BP の継続効果（rules/fieldAuras.ts から呼ぶ）。 */
export function rk1FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (!hasResident(state, playerId, HYBRID_CARD_ID)) return 0;
  const top = hybridRevealedTop(state, playerId);
  if (!top) return 0;
  if (!findField(state, playerId, instance.instanceId)) return 0;
  if (!isUnitCard(state, instance.cardId) || !rk1IsSmallNow(state, instance)) return 0;
  const topCats = categoriesOf(state, top.cardId);
  return categoriesOf(state, instance.cardId).some((c) => topCats.includes(c)) ? 1000 : 0;
}

/** 操作の後: オモテにしたカードが山札の上から動いていたら手札に加え、山札以外にあれば印を消す。 */
function settleHybridRevealed(state: GameState): GameState {
  // オモテにするのはハイブリッドエネルギーだけなので、どちらにも配置されていなければ（山札の上の印を除き）何もしない。
  const relevant = (["player1", "player2"] as const).some(
    (pid) => hasResident(state, pid, HYBRID_CARD_ID) || !!state.players[pid].deck[0]?.hybridRevealed,
  );
  if (!relevant) return state;
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    // ハイブリッドエネルギーが常駐置き場を離れたら、オモテにしたカードはもう効果の対象ではない。
    if (player.deck[0]?.hybridRevealed && !hasResident(next, pid, HYBRID_CARD_ID)) {
      const { hybridRevealed: _h, ...top } = player.deck[0];
      next = patchPlayer(next, pid, (p) => ({ ...p, deck: [top, ...p.deck.slice(1)] }));
    }
    const strayDeck = next.players[pid].deck.slice(1).filter((c) => c.hybridRevealed);
    const strayElsewhere = (["hand", "discard", "power", "command", "rush", "battle"] as const).some((z) => player[z].some((c) => c.hybridRevealed));
    if (strayDeck.length === 0 && !strayElsewhere) continue;
    next = patchPlayer(next, pid, (p) => {
      const clean = (cards: CardInstance[]) =>
        cards.map((c) => {
          if (!c.hybridRevealed) return c;
          const { hybridRevealed: _h, ...rest } = c;
          return rest;
        });
      const strayIds = new Set(strayDeck.map((c) => c.instanceId));
      return {
        ...p,
        deck: [...p.deck.slice(0, 1), ...p.deck.slice(1).filter((c) => !strayIds.has(c.instanceId))],
        hand: clean([...p.hand, ...strayDeck.map((c) => stripForZone(c))]),
        discard: clean(p.discard),
        power: clean(p.power),
        command: clean(p.command),
        rush: clean(p.rush),
        battle: clean(p.battle),
      };
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-011 第三の眼（※常駐）
// 「相手がカウンターを発動したとき、そのカウンターの必要パワーの数字を見て、それ以上の必要パワーの数字を持つカードを自分の手札から
//  １枚選び捨札にしてもよい。そうしたとき、そのカウンターの効果は無効になる。」（atwiki/page-44）
// - 手札から使ったカウンター（play_counter）の効果を解決する前に、第三の眼の持ち主が選ぶ（任意）。
// - 無効にしたカウンターは捨札になり、反応のウィンドウはそのまま（2枚目を改めて使える。Q1）。
// - 無効にしなければ、カウンターの使用をそのまま処理し直す（core/applyAction.ts の rk1CounterReplay）。

export const THIRD_EYE_EFFECT_ID = "rk011_third_eye";

function powerNumber(state: Pick<GameState, "definitions">, cardId: string): number | null {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  if (cost === undefined || cost === null || String(cost).trim() === "") return null;
  const n = parsePowerCost(cost);
  return Number.isFinite(n) ? n : null;
}

/** 相手が手札のカウンターを発動したとき（core/applyAction.ts の play_counter から呼ぶ）。開いたら選択の state。 */
export function rk1ThirdEyeIntercept(
  state: GameState,
  counterUserId: PlayerId,
  action: { type: "play_counter"; instanceId: string },
): GameState | null {
  if (state.rk1ThirdEyeChecked === action.instanceId) return null;
  const eyeOwner = opponent(counterUserId);
  const eye = state.players[eyeOwner].operation.find((c) => c.cardId === "RK-011");
  if (!eye) return null;
  const counter = state.players[counterUserId].hand.find((c) => c.instanceId === action.instanceId);
  if (!counter) return null;
  const need = powerNumber(state, counter.cardId) ?? 0;
  const ids = state.players[eyeOwner].hand
    .filter((c) => {
      const n = powerNumber(state, c.cardId);
      return n !== null && n >= need;
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  const stashed = {
    pendingBattle: state.pendingBattle,
    pendingRush: state.pendingRush,
    pendingLeave: state.pendingLeave,
    pendingStrike: state.pendingStrike,
    pendingGiantBomb: state.pendingGiantBomb,
  };
  const withoutWindows: GameState = {
    ...state,
    pendingBattle: undefined,
    pendingRush: undefined,
    pendingLeave: undefined,
    pendingStrike: undefined,
    pendingGiantBomb: undefined,
  };
  return openEffectChoice(withoutWindows, {
    playerId: eyeOwner,
    phasePlayerId: counterUserId,
    sourceCardId: "RK-011",
    sourceInstanceId: eye.instanceId,
    effectId: THIRD_EYE_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
    rk1Meta: { counterUserId, counterAction: action, stashed },
  });
}

function restoreWindows(state: GameState, pending: PendingEffectChoice): GameState {
  const stashed = pending.rk1Meta?.stashed ?? {};
  return {
    ...state,
    pendingEffectChoice: undefined,
    ...stashed,
    activePlayer: pending.rk1Meta?.counterUserId ?? pending.phasePlayerId,
  };
}

CHOICE_RESOLVERS[THIRD_EYE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const userId = pending.rk1Meta?.counterUserId ?? opponent(playerId);
  const counterId = (pending.rk1Meta?.counterAction as { instanceId?: string } | undefined)?.instanceId;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = restoreWindows(state, pending);
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  // 無効になったカウンターも、使ったカードとして捨札になる（R-CARD-03）。
  const counter = counterId ? next.players[userId].hand.find((c) => c.instanceId === counterId) : undefined;
  if (counter) {
    next = patchPlayer(next, userId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== counterId),
      discard: [...p.discard, stripForZone(counter)],
    }));
  }
  return {
    state: next,
    log: logFor(state, playerId, "RK-011", `${THIRD_EYE_EFFECT_ID}:${counter ? cardName(state.definitions, counter.cardId) : "?"}`),
  };
};

CHOICE_SKIPPERS[THIRD_EYE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = restoreWindows(state, pending);
  const counterId = (pending.rk1Meta?.counterAction as { instanceId?: string } | undefined)?.instanceId;
  return {
    state: { ...next, rk1CounterReplay: pending.rk1Meta?.counterAction, rk1ThirdEyeChecked: counterId },
    log: skipLog(state, playerId, "RK-011", THIRD_EYE_EFFECT_ID),
  };
};

// ---------------------------------------------------------------------------
// RK-013 Jパワー（オペレーション）
// 「自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは
//  特徴「人型」を追加されて「Lユニット」になる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」（atwiki/page-211）
// - J パワーは選んだユニットの下に重ねる（ユニットの stackedCards。grnrngr/faq-rider-2 RK-088 Q）。ラッシュではない（Q4）。
// - サイズ・特徴の変更は rk1IsSmallNow・rk1AddedUnitFeatures、捨札は settleJPowerStacks。

export const J_POWER_EFFECT_ID = "rk013_j_power";

function applyJPower(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = fieldUnits(state, pid)
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${J_POWER_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, J_POWER_CARD_ID),
      effectId: J_POWER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: J_POWER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[J_POWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opId = pending.sourceInstanceId;
  const opCard: CardInstance = { instanceId: opId ?? `${J_POWER_CARD_ID}:op`, cardId: J_POWER_CARD_ID };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle) };
  });
  const placed = next.players[playerId];
  const ok = [...placed.rush, ...placed.battle].some((c) => c.instanceId === instanceId);
  return {
    state: proceed(ok ? next : close(state, pending), pending),
    log: logFor(state, playerId, J_POWER_CARD_ID, `${J_POWER_EFFECT_ID}:${instanceId}`),
  };
};

// ---------------------------------------------------------------------------
// RK-015 人類の進化（※カウンター）
// 「特徴「男」または「女」を持つ自軍ユニットが撃破されて捨札になったとき発動できる⇒自軍山札の上からカードを1枚ひく。そのカードが
//  特徴「仮面ライダー」を持つユニットカードなら自軍ラッシュエリアに出してもよい。ただし必要パワーと追加条件は満たすこと。
//  そうしないとき、ひいたカードは手札に加える。」（atwiki/page-213）

export const HUMAN_EVOLUTION_CARD_ID = "RK-015";
export const HUMAN_EVOLUTION_EFFECT_ID = "rk015_human_evolution";

export function isRk1LeaveCounterCard(cardId: string): boolean {
  return cardId === HUMAN_EVOLUTION_CARD_ID;
}

/** 離場の応答で人類の進化を使える離場か（カウンターのコストは別に判定する）。 */
export function rk1LeaveCounterConditionMet(
  state: GameState,
  ownerId: PlayerId,
  intent: Pick<PendingLeave, "toZone" | "notDestruction" | "leavingCardId" | "instanceId" | "fromZone" | "phasePlayerId">,
): boolean {
  if (intent.toZone !== "discard" || intent.notDestruction) return false;
  // ※カウンター（敵軍ターン中にのみ使用できる）: 撃破が起きたフェイズのプレイヤーが持ち主でないとき。
  if (intent.phasePlayerId === ownerId) return false;
  const leaving = findField(state, ownerId, intent.instanceId)?.card ?? { instanceId: intent.instanceId, cardId: intent.leavingCardId };
  const features = unitFeaturesOf(state, ownerId, leaving);
  return features.includes("男") || features.includes("女");
}

/** 人類の進化の効果（離場を終えた後に呼ぶ。使ったカードを捨札にするのは呼び出し側）。 */
export function applyRk1HumanEvolution(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId): GameState {
  // 「ひく」はドローではない（RK-010 Q1）— オモテにしたカードを先に手札に加える。
  const prepared = takeHybridRevealedToHand(state, ownerId);
  const top = prepared.players[ownerId].deck[0];
  if (!top) return prepared;
  // ひいたカードはいったん手札に置き、出すかを選ぶ（出さなければそのまま手札に加えたことになる）。
  const drawn = patchPlayer(prepared, ownerId, (p) => ({ ...p, deck: p.deck.slice(1), hand: [...p.hand, stripForZone(top)] }));
  const isRider = isUnitCard(drawn, top.cardId) && rk1ZoneCardFeatures(drawn, ownerId, top.cardId).includes("仮面ライダー");
  if (!isRider) return drawn;
  const rushable = filterEffectRushCandidates(drawn, ownerId, "hand", [top.instanceId], true, false);
  if (rushable.length === 0) return drawn;
  return openOrQueue(drawn, {
    playerId: ownerId,
    phasePlayerId,
    sourceCardId: HUMAN_EVOLUTION_CARD_ID,
    effectId: HUMAN_EVOLUTION_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [top.instanceId],
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[HUMAN_EVOLUTION_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const next = startEffectRush(cleared, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: HUMAN_EVOLUTION_EFFECT_ID,
    sourceCardId: HUMAN_EVOLUTION_CARD_ID,
    fromZone: "hand",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: true,
    ignorePowerCost: false,
    mandatory: true,
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, HUMAN_EVOLUTION_CARD_ID, `${HUMAN_EVOLUTION_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[HUMAN_EVOLUTION_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-016 ミラーワールド（※常駐）
// 「自軍ラッシュフェイズに自軍Sユニットをこれにオモテ向きに重ねてもよい。これが常駐置き場を離れるとき、重ねたカードはすべて手札に加える。
//  これに重ねたカードと同じカード名の自軍ユニットは、次の能力を得る⇒相手は自分自身のコマンドを1つホールドしなければ、このユニットを
//  選べない。アタックするには、さらに2つホールドしなければならない。」（atwiki/page-176）
// - 重ねるのは場の自軍 S ユニット（手札からは重ねられない。atwiki カード評価）。ラッシュフェイズ中なら何度でも。
// - アタックの制限は rk1DefenderBlocksAttack・rk1PayAttackCommandCost。効果で選ぶときのホールドは本モジュールの選択（RK-019）と
//   RS-288【ドラゴンハーレー】（rules/errataCardEffects.ts）で扱う。

export const MIRROR_WORLD_CARD_ID = "RK-016";
export const MIRROR_WORLD_STACK_EFFECT_ID = "rk016_mirror_world_stack";

function mirrorStackIds(state: GameState, pid: PlayerId): string[] {
  return fieldUnits(state, pid)
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
}

/** 常駐の起動ができるか（RK-016 以外は null）。 */
export function canActivateRk1Resident(state: GameState, playerId: PlayerId, op: CardInstance): boolean | null {
  if (op.cardId !== MIRROR_WORLD_CARD_ID) return null;
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup || state.pendingEffectRush || state.pendingRush) {
    return false;
  }
  return mirrorStackIds(state, playerId).length > 0;
}

export function isRk1ActivatableResident(cardId: string): boolean {
  return cardId === MIRROR_WORLD_CARD_ID;
}

export function activateRk1Resident(state: GameState, playerId: PlayerId, op: CardInstance): GameState {
  return openEffectChoice(state, {
    playerId,
    phasePlayerId: playerId,
    sourceCardId: MIRROR_WORLD_CARD_ID,
    sourceInstanceId: op.instanceId,
    effectId: MIRROR_WORLD_STACK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: mirrorStackIds(state, playerId),
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[MIRROR_WORLD_STACK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findField(state, playerId, instanceId);
  if (!found) return { error: "invalid_target" };
  const opId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, ...(found.card.stackedCards ?? []).map((s) => stripForZone(s))],
    operation: p.operation.map((c) =>
      c.instanceId === opId ? { ...c, stackedCards: [...(c.stackedCards ?? []), stripForZone(found.card)] } : c,
    ),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, MIRROR_WORLD_CARD_ID, `${MIRROR_WORLD_STACK_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`) };
};
CHOICE_SKIPPERS[MIRROR_WORLD_STACK_EFFECT_ID] = simpleSkip();

/** 常駐置き場を離れる常駐の行き先（ミラーワールドの重ねたカードは手札、それ以外は捨札）。 */
export function rk1ResidentLeaving(card: CardInstance): { toDiscard: CardInstance[]; toHand: CardInstance[] } | null {
  if (card.cardId !== MIRROR_WORLD_CARD_ID) return null;
  const { stackedCards: stacked = [], ...base } = card;
  return { toDiscard: [base], toHand: stacked.map((s) => stripForZone(s)) };
}

// ---------------------------------------------------------------------------
// RK-017 ミッションメモリー（オペレーション）
// 「ＲＣを持つ自軍Sユニットを1体選ぶ。選んだユニットは、このターン、バトルエリアに出たとき、ライドオフしなくてもその効果を発動できる。
//  その後、このカードを自軍コマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-197）
// - 選べなくても使え、コマンドゾーンに置く（Q2・Q6）。ビークルにライドしないで出ても発動する（Q5）。
// - ライドしたまま発動したら、その後ライドオフして2重に発動することはできない（Q3・Q4）。

export const MISSION_MEMORY_CARD_ID = "RK-017";
export const MISSION_MEMORY_EFFECT_ID = "rk017_mission_memory";
const MISSION_MEMORY_RULE = "rk017_mission_memory_grant";

function placeMissionMemory(state: GameState, playerId: PlayerId, opInstanceId: string | undefined): GameState {
  const opCard: CardInstance = { instanceId: opInstanceId ?? `${MISSION_MEMORY_CARD_ID}:op`, cardId: MISSION_MEMORY_CARD_ID };
  return patchPlayer(state, playerId, (p) =>
    p.command.length < COMMAND_ZONE_MAX
      ? { ...p, command: [...p.command, { ...opCard, commandHeld: true }] }
      : { ...p, discard: [...p.discard, opCard] },
  );
}

function applyMissionMemory(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = fieldUnits(state, pid)
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && getDefinition(state.definitions, c.cardId)?.comboNumber === "RC")
    .map((c) => c.instanceId);
  if (ids.length === 0) {
    return { state: placeMissionMemory(state, pid, ctx.operationInstanceId), detail: `${MISSION_MEMORY_EFFECT_ID}:no_targets` };
  }
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, MISSION_MEMORY_CARD_ID),
      effectId: MISSION_MEMORY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: MISSION_MEMORY_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[MISSION_MEMORY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = addTurnPayload(close(state, pending), playerId, MISSION_MEMORY_RULE, MISSION_MEMORY_CARD_ID, { instanceId });
  next = placeMissionMemory(next, playerId, pending.sourceInstanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, MISSION_MEMORY_CARD_ID, `${MISSION_MEMORY_EFFECT_ID}:${instanceId}`) };
};

/** このターン、ライドオフしなくても RC の効果を発動できるユニットか。 */
export function rk1RcWithoutRideOff(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): boolean {
  return turnPayloads<{ instanceId: string }>(state.players[playerId], MISSION_MEMORY_RULE).some((p) => p.instanceId === instanceId);
}

/**
 * バトルエリアに出たユニットが、ライドオフしないで RC の効果を発動する（ミッションメモリーで選んだユニット）。
 * ライドしないで出たとき（rules/battleEntry.ts）と、ライドしたまま進むことを選んだとき（core/applyAction.ts）に呼ぶ。
 * 対象外なら null。1度発動したら同じ進入で2重には発動しない（Q3・Q4）。
 */
export function rk1MissionMemoryOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  if (!rk1RcWithoutRideOff(state, playerId, instanceId)) return null;
  const unit = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit || getDefinition(state.definitions, unit.cardId)?.comboNumber !== "RC") return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) =>
      c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c,
    ),
  }));
  const markedUnit = marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!;
  const rc = resolveRidingComboOnRideOff(marked, playerId, markedUnit);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// RK-018 ラウズカード（オペレーション）
// 「自軍ラッシュエリアからSユニットを1体選ぶ。そして自軍捨札からSユニットのカードを1枚選ぶ。そうしたとき、このターン、ラッシュエリアから
//  選んだSユニットのBPに、捨札から選んだユニットカードのBPを「＋」する。」（atwiki/page-177）

export const ROUSE_RUSH_EFFECT_ID = "rk018_rouse_rush";
export const ROUSE_DISCARD_EFFECT_ID = "rk018_rouse_discard";

function rouseDiscardIds(state: GameState, pid: PlayerId): string[] {
  return state.players[pid].discard
    .filter((c) => isUnitCard(state, c.cardId) && getDefinition(state.definitions, c.cardId)?.size === "S")
    .map((c) => c.instanceId);
}

function applyRouseCard(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = state.players[pid].rush.filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${ROUSE_RUSH_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RK-018"),
      effectId: ROUSE_RUSH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: ROUSE_RUSH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ROUSE_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ids = rouseDiscardIds(state, playerId);
  const log = logFor(state, playerId, "RK-018", `${ROUSE_RUSH_EFFECT_ID}:${instanceId}`);
  // 「そうしたとき」— 捨札から選べなければ BP は変わらない。
  if (ids.length === 0) return { state: proceed(close(state, pending), pending), log };
  return {
    state: { ...state, pendingEffectChoice: { ...pending, effectId: ROUSE_DISCARD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, rk1Meta: { first: instanceId } } },
    log,
  };
};

CHOICE_RESOLVERS[ROUSE_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const targetId = pending.rk1Meta?.first;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card || !targetId) return { error: "invalid_target" };
  const bp = Number(getDefinition(state.definitions, card.cardId)?.bp ?? 0) || 0;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const add = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === targetId ? { ...c, bpModifier: (c.bpModifier ?? 0) + bp } : c));
    return { ...p, rush: add(p.rush), battle: add(p.battle) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-018", `${ROUSE_DISCARD_EFFECT_ID}:+${bp}`) };
};

// ---------------------------------------------------------------------------
// RK-019 音撃（オペレーション）
// 「特徴「メカ」を持たない敵軍ユニットを1体選ぶ。そうしたとき、このターン、選んだユニットは「これは敵軍ターン中、SP1以上のユニットと
//  バトルしたときバトルに勝っても撃破される」と書かれているかのように扱う。」（atwiki/page-214）
// - 選んだユニットにとっての「敵軍ターン中」は使ったプレイヤーのターン（rules/operationCounters.ts のバトルの解決から rk1WinButDestroyed を見る）。
// - ミラーワールドの能力を得た敵軍ユニットを選ぶには、自分自身のコマンドを（重ねた枚数だけ）ホールドする（RK-016）。

export const ONGEKI_EFFECT_ID = "rk019_ongeki";
const ONGEKI_RULE = "rk019_ongeki_mark";

function ongekiIds(state: GameState, pid: PlayerId): string[] {
  const enemyId = opponent(pid);
  const released = state.players[pid].command.filter((c) => !c.commandHeld).length;
  return fieldUnits(state, enemyId)
    .filter((c) => isUnitCard(state, c.cardId) && !unitFeaturesOf(state, enemyId, c).includes("メカ"))
    .filter((c) => mirrorWorldCopies(state, enemyId, c) <= released)
    .map((c) => c.instanceId);
}

function applyOngeki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = ongekiIds(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: `${ONGEKI_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RK-019"),
      effectId: ONGEKI_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: ONGEKI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ONGEKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = findField(state, enemyId, instanceId)?.card;
  if (!target) return { error: "invalid_target" };
  let next = close(state, pending);
  const copies = mirrorWorldCopies(next, enemyId, target);
  const held = holdReleasedCommands(next, playerId, copies);
  if (!held) return { error: "invalid_target" };
  next = addTurnPayload(held, playerId, ONGEKI_RULE, "RK-019", { instanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-019", `${ONGEKI_EFFECT_ID}:${cardName(state.definitions, target.cardId)}`) };
};

/** 「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれているかのように扱うユニットか。 */
export function rk1WinButDestroyed(state: GameState, ownerId: PlayerId, instanceId: string): boolean {
  const enemyId = opponent(ownerId);
  if (state.activePlayer !== enemyId) return false;
  return turnPayloads<{ instanceId: string }>(state.players[enemyId], ONGEKI_RULE).some((p) => p.instanceId === instanceId);
}

// ---------------------------------------------------------------------------
// RK-020 ダブルライダーキック（オペレーション）
// 「自軍ラッシュエリアから特徴「仮面ライダー」を持つ自軍ユニットを2体選ぶ。このターン、選んだ2体のユニットが自軍バトルエリアで
//  隣り合ったとき、敵軍バトルエリアからBP8000以下の敵軍ユニットを1体選び撃破する。」（atwiki/page-199）

export const DOUBLE_KICK_PICK_EFFECT_ID = "rk020_double_kick_pick";
export const DOUBLE_KICK_DESTROY_EFFECT_ID = "rk020_double_kick_destroy";
const DOUBLE_KICK_RULE = "rk020_double_kick_pair";

function doubleKickIds(state: GameState, pid: PlayerId, exclude?: string): string[] {
  return state.players[pid].rush
    .filter((c) => c.instanceId !== exclude && isUnitCard(state, c.cardId) && unitFeaturesOf(state, pid, c).includes("仮面ライダー"))
    .map((c) => c.instanceId);
}

function applyDoubleKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = doubleKickIds(state, ctx.playerId);
  if (ids.length < 2) return { state, detail: `${DOUBLE_KICK_PICK_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RK-020"),
      effectId: DOUBLE_KICK_PICK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: DOUBLE_KICK_PICK_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[DOUBLE_KICK_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const first = pending.rk1Meta?.first;
  if (!first) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: doubleKickIds(state, playerId, instanceId), selectedInstanceIds: [instanceId], rk1Meta: { first: instanceId } } },
      log: logFor(state, playerId, "RK-020", `${DOUBLE_KICK_PICK_EFFECT_ID}:${instanceId}`),
    };
  }
  const next = addTurnPayload(close(state, pending), playerId, DOUBLE_KICK_RULE, "RK-020", { ids: [first, instanceId] });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-020", `${DOUBLE_KICK_PICK_EFFECT_ID}:${first}+${instanceId}`) };
};

function doubleKickTargets(state: GameState, pid: PlayerId): string[] {
  const enemyId = opponent(pid);
  return state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && effectiveBp(state, enemyId, c) <= 8000)
    .map((c) => c.instanceId);
}

/**
 * ユニットがバトルエリアに出たとき（rules/combo.ts の進入効果から呼ぶ）: 選んだ2体が自軍バトルエリアで隣り合ったら、
 * 敵軍バトルエリアの BP8000 以下のユニットを1体選び撃破する（強制）。
 */
export function tryRk1OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const pairs = turnPayloads<{ ids: [string, string] }>(state.players[playerId], DOUBLE_KICK_RULE);
  if (pairs.length === 0) return state;
  const battle = state.players[playerId].battle;
  const pos = (id: string) => battle.findIndex((c) => c.instanceId === id);
  let next = state;
  for (const pair of pairs) {
    if (!pair.ids.includes(card.instanceId)) continue;
    const [a, b] = pair.ids.map(pos);
    if (a === undefined || b === undefined || a < 0 || b < 0 || Math.abs(a - b) !== 1) continue;
    const ids = doubleKickTargets(next, playerId);
    if (ids.length === 0) continue;
    next = openOrQueue(next, {
      playerId,
      phasePlayerId: playerId,
      sourceCardId: "RK-020",
      sourceInstanceId: card.instanceId,
      effectId: DOUBLE_KICK_DESTROY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      unitDestination: "discard",
    });
  }
  return next;
}

/** 撃破の選択は汎用の撃破（unitDestination: "discard"）で解決する（rules/pendingChoices.ts）。 */
export function isRk1GenericDestroyChoice(effectId: string): boolean {
  return effectId === DOUBLE_KICK_DESTROY_EFFECT_ID;
}

// ---------------------------------------------------------------------------
// 後処理と起点

/** applyAction の後処理（J パワーの捨札・ハイブリッドエネルギーのオモテのカード）。 */
export function settleRk1AfterAction(state: GameState): GameState {
  return settleHybridRevealed(settleJPowerStacks(state));
}

const RK1_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-002::v3_hopper": applyV3Hopper,
  "RK-005::dynamo": applyDynamo,
  "RK-007::maintenance": applyMaintenance,
  "RK-013::j_power": applyJPower,
  "RK-017::mission_memory": applyMissionMemory,
  "RK-018::rouse_card": applyRouseCard,
  "RK-019::ongeki": applyOngeki,
  "RK-020::double_rider_kick": applyDoubleKick,
};

export function tryRk1CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK1_KEYWORD_PREFIX)) return null;
  const handler = RK1_KEYWORDS[keyword.slice(RK1_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
