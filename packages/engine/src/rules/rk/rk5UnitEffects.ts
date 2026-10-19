/**
 * ザ・マスクドライダーEXP vol.2 RK-085〜RK-105（ガードベント〜仮面ライダーアギトSF）のカード固有の効果（cardSpec RK5-085-105 の監査）。
 *
 * - `tryRk5CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk5::cardId::name`。RC・NC・オペレーション・ビークルの進入）。
 * - `tryResolveRk5Choice` / `trySkipRk5Choice` / `tryConfirmRk5Choice`: このモジュールが開いた選択の解決。撃破・手札に戻す選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - RK-085 のカウンターは core/applyAction.ts（アタックされたときの窓）、RK-101 はアタックの宣言（core/applyAction.ts）、
 *   RK-103【ブラストペガサス】はコンビネーション（rules/combo.ts）、RK-094・RK-095・RK-103 の※は「ターンを終えるとき」
 *   （rules/turnEndingEffects.ts）から呼ぶ。
 * - BP・SP・カテゴリ・アタック先・イマジンの撃破テキストの継続効果は rules/rk/rk5Fields.ts。
 * 構成は rules/rk/rk4UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { autoHoldForBattleEntry, canMoveUnitToBattle, clearEffectBattleEntryWindows } from "../restrictions";
import { startEffectRush } from "../effectRush";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { rk1IsSmallNow } from "./rk1Features";
import { APOLLO_SP_RULE, BLAST_PEGASUS_RULE } from "./rk5Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK5_KEYWORD_PREFIX = "rk5::";

export function isRk5ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk5Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk5Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 選んだところで確定できる選択か（「行う」の確認・好きな数選ぶ選択）。 */
export function canConfirmRk5Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  if (pending.kind === "confirm") return true;
  return (pending.selectedInstanceIds?.length ?? 0) > 0;
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk5Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk5Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
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
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
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

/** 「行う／行わない」の確認（kind "confirm"）。 */
function confirmChoice(ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string }, sourceCardId: string, effectId: string, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "confirm",
    validInstanceIds: [],
    optional: true,
    mayConfirm: true,
    ...extra,
  };
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function fieldUnits(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => isUnitCard(state, c.cardId));
}

function costOf(state: Pick<GameState, "definitions">, cardId: string): number {
  return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost);
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

/** 敵軍の効果で選べる敵軍ユニット（「相手に選ばれない」・ミラーワールド等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

/** 場のユニットを場から取り除き、重ねたカードを持ち主の捨札にする（ビークルはその場に残る）。取り除いたカードを返す。 */
function takeFromField(state: GameState, ownerId: PlayerId, instanceId: string): { state: GameState; card?: CardInstance } {
  const owner = state.players[ownerId];
  const card = [...owner.battle, ...owner.rush].find((c) => c.instanceId === instanceId);
  if (!card) return { state };
  const next = patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, ...(card.stackedCards ?? []).map((s) => stripForZone(s))],
  }));
  return { state: next, card };
}

// ---------------------------------------------------------------------------
// RK-085 ガードベント（※カウンター）
// 「特徴「ミラーライダー」を持つ自軍ユニットがアタックされたとき発動できる⇒そのバトルは行われない。そして、アタックされたユニットの
//  必要パワーの数字を見て、その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-643）
// - 撃破する敵軍ユニットはエリア・サイズを問わない（atwiki/page-643 カード評価）。強制。「4+」は 4 として比べる。
// - 使ったら（バトルは行われないので）同じアタックに続けて使えるカウンターの窓は閉じる。

export const GUARD_VENT_CARD_ID = "RK-085";
export const GUARD_VENT_EFFECT_ID = "rk085_guard_vent";

export function isRk5BattleCounterCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, GUARD_VENT_CARD_ID);
}

type BattleRef = Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId" | "defenderInstanceId"> & {
  effectBattle?: boolean;
  battleCancelled?: boolean;
};

/** 「特徴「ミラーライダー」を持つ自軍ユニットがアタックされたとき」が成り立っているか（コストは別に判定する）。 */
export function rk5BattleCounterConditionMet(state: GameState, defenderId: PlayerId, cardId: string, battle: BattleRef): boolean {
  if (!isRk5BattleCounterCard(cardId)) return false;
  if (battle.defenderPlayerId !== defenderId || battle.effectBattle || battle.battleCancelled) return false;
  const defender = fieldUnits(state, defenderId).find((c) => c.instanceId === battle.defenderInstanceId);
  if (!defender) return false;
  return unitFeatures(state, defenderId, defender).includes("ミラーライダー");
}

/** アタックされたユニットの必要パワーの数字（バトルを行わない前に見る）。 */
export function rk5GuardVentCost(state: GameState, battle: BattleRef): number {
  const defender = fieldUnits(state, battle.defenderPlayerId).find((c) => c.instanceId === battle.defenderInstanceId);
  return defender ? costOf(state, defender.cardId) : Number.NaN;
}

/** バトルを行わなかったあと、撃破する敵軍ユニットの選択を開く（候補がなければ何もしない）。 */
export function openRk5GuardVent(state: GameState, defenderId: PlayerId, battle: BattleRef & { phasePlayerId: PlayerId }, cost: number): GameState {
  if (!Number.isFinite(cost)) return state;
  const enemyId = opponent(defenderId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costOf(state, c.cardId);
      return Number.isFinite(n) && n <= cost && selectableEnemy(state, defenderId, GUARD_VENT_CARD_ID, c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId: defenderId, phasePlayerId: battle.phasePlayerId }, GUARD_VENT_CARD_ID),
    effectId: GUARD_VENT_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    unitDestination: "discard",
  });
}

// ---------------------------------------------------------------------------
// RK-087 ゼクトマイザー（オペレーション）
// 「敵軍ラッシュエリアにあるすべてのSユニットをバトルエリアに出してもよい（出す順番は自分が選ぶ）。その後、敵軍バトルエリアのユニットを、
//  好きな順に並べ替える。」（atwiki/page-666）
// - 出すかを確認する（任意）。出すなら、出せる S ユニット（否定文で出られないもの・出るための条件を満たせないものを除く。
//   grnrngr/faq-rider-2 RK-087 Q1・Q2）を1体ずつ選んで出す（最後の1体は選ばずに出す）。選ぶ効果ではないので「相手に選ばれない」ユニットも出す
//   （atwiki/page-666 コメント欄）。
// - その後、出さなかったときも、敵軍バトルエリアのユニットを並べ替える（atwiki/page-666 コメント欄）。先に選んだユニットから順に並べ、
//   ライドしているユニットのビークルはそのユニットの前に置く。

export const ZECTMIZER_CONFIRM_EFFECT_ID = "rk087_zectmizer";
export const ZECTMIZER_ENTER_EFFECT_ID = "rk087_zectmizer_enter";
export const ZECTMIZER_ORDER_EFFECT_ID = "rk087_zectmizer_order";

function zectEnterable(state: GameState, enemyId: PlayerId): string[] {
  return state.players[enemyId].rush
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && canPutEnemyRushIntoBattle(state, enemyId, c))
    .map((c) => c.instanceId);
}

function canPutEnemyRushIntoBattle(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  const ready = autoHoldForBattleEntry(state, ownerId, card);
  if (!ready) return false;
  return canMoveUnitToBattle({ ...state, players: { ...state.players, [ownerId]: ready } }, ownerId, card, "rush");
}

/** 敵軍ラッシュエリアのユニットをバトルエリアに出す（出られなければ何もしない）。 */
function putEnemyRushIntoBattle(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const card = state.players[ownerId].rush.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  const ready = autoHoldForBattleEntry(state, ownerId, card);
  if (!ready) return state;
  const prepared: GameState = { ...state, players: { ...state.players, [ownerId]: ready } };
  if (!canMoveUnitToBattle(prepared, ownerId, card, "rush")) return state;
  const moved = clearEffectBattleEntryWindows({
    ...ready,
    rush: ready.rush.filter((c) => c.instanceId !== instanceId),
    battle: [...ready.battle, card],
  });
  return { ...prepared, players: { ...prepared.players, [ownerId]: moved } };
}

function zectOrderTargets(state: GameState, enemyId: PlayerId): string[] {
  return state.players[enemyId].battle.filter((c) => isUnitCard(state, c.cardId)).map((c) => c.instanceId);
}

/** 並べ替えの選択を開く（ユニットが2体以上のとき）。終わったらオペレーションの処理を終える。 */
function openZectOrder(state: GameState, pending: PendingEffectChoice): GameState {
  const enemyId = opponent(pending.playerId);
  const ids = zectOrderTargets(state, enemyId);
  if (ids.length < 2) return proceed(state, pending);
  return openEffectChoice(state, {
    ...pending,
    effectId: ZECTMIZER_ORDER_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    mayConfirm: undefined,
  });
}

/** 出すユニットの選択（2体以上なら選ぶ。1体なら選ばずに出す）。 */
function continueZectEnter(state: GameState, pending: PendingEffectChoice): GameState {
  const enemyId = opponent(pending.playerId);
  let next = state;
  for (;;) {
    const ids = zectEnterable(next, enemyId);
    if (ids.length === 0) return openZectOrder(next, pending);
    if (ids.length === 1) {
      next = putEnemyRushIntoBattle(next, enemyId, ids[0]!);
      continue;
    }
    return openEffectChoice(next, {
      ...pending,
      effectId: ZECTMIZER_ENTER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      mayConfirm: undefined,
    });
  }
}

function applyZectmizer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const choice = confirmChoice(
    { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId },
    ctx.sourceCardId,
    ZECTMIZER_CONFIRM_EFFECT_ID,
  );
  const enemyId = opponent(ctx.playerId);
  if (zectEnterable(state, enemyId).length === 0) {
    // 出せるユニットがなければ並べ替えだけを行う。
    return { state: openZectOrder(state, { ...choice, effectId: ZECTMIZER_ORDER_EFFECT_ID }), detail: "rk087:order_only" };
  }
  return { state: openOrQueue(state, choice), detail: ZECTMIZER_CONFIRM_EFFECT_ID };
}

CHOICE_RESOLVERS[ZECTMIZER_CONFIRM_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[ZECTMIZER_CONFIRM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: continueZectEnter(close(state, pending), pending), log: logFor(state, playerId, pending.sourceCardId, `${ZECTMIZER_CONFIRM_EFFECT_ID}:accept`) };
};
CHOICE_SKIPPERS[ZECTMIZER_CONFIRM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: openZectOrder(close(state, pending), pending), log: skipLog(state, playerId, pending.sourceCardId, ZECTMIZER_CONFIRM_EFFECT_ID) };
};

CHOICE_RESOLVERS[ZECTMIZER_ENTER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = putEnemyRushIntoBattle(close(state, pending), enemyId, instanceId);
  return { state: continueZectEnter(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${ZECTMIZER_ENTER_EFFECT_ID}:${cardName(state.definitions, state.players[enemyId].rush.find((c) => c.instanceId === instanceId)?.cardId ?? "")}`) };
};

/** 選んだ順（ordered）にユニットを並べ、ライドしているユニットのビークルはその前に置く。残りのカードは元の順で後ろに置く。 */
function reorderBattle(battle: CardInstance[], ordered: string[]): CardInstance[] {
  const byId = new Map(battle.map((c) => [c.instanceId, c]));
  const used = new Set<string>();
  const out: CardInstance[] = [];
  for (const id of ordered) {
    const unit = byId.get(id);
    if (!unit || used.has(id)) continue;
    const vehicleId = unit.mountedOnInstanceId;
    const vehicle = vehicleId ? byId.get(vehicleId) : undefined;
    if (vehicle && !used.has(vehicle.instanceId)) {
      out.push(vehicle);
      used.add(vehicle.instanceId);
    }
    out.push(unit);
    used.add(id);
  }
  for (const c of battle) if (!used.has(c.instanceId)) out.push(c);
  return out;
}

CHOICE_RESOLVERS[ZECTMIZER_ORDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const ordered = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${ZECTMIZER_ORDER_EFFECT_ID}:${instanceId}`);
  if (rest.length >= 2) {
    return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: rest, selectedInstanceIds: ordered } }, log };
  }
  const finalOrder = [...ordered, ...rest];
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, battle: reorderBattle(p.battle, finalOrder) }));
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// RK-088 イマジンとの契約（オペレーション）
// 「特徴「イマジン」を持たない自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。…」
// （atwiki/page-710）。RK-013 Jパワーと同じく、このカードは選んだユニットの下に重ねる（ユニットの stackedCards。grnrngr/faq-rider-2 RK-088 Q）。
// 選ぶユニットのエリアの限定はない（ラッシュ・バトル）。強制。イマジンの撃破テキストの無効は rules/rk/rk5Fields.ts、
// ユニットでなくなったときの捨札は rules/rk/rk1NamedEffects.ts settleJPowerStacks。

export const IMAGIN_CONTRACT_EFFECT_ID = "rk088_imagin_contract";

function applyImaginContract(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = fieldUnits(state, pid)
    .filter((c) => rk1IsSmallNow(state, c) && !unitFeatures(state, pid, c).includes("イマジン"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${IMAGIN_CONTRACT_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...base({ playerId: pid, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, ctx.sourceCardId),
      effectId: IMAGIN_CONTRACT_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: IMAGIN_CONTRACT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[IMAGIN_CONTRACT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${pending.sourceCardId}:op`, cardId: pending.sourceCardId };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    // 使ったオペレーションは捨札ではなくユニットの下に置く（使用の処理で捨札に置かれていれば取り除く）。
    return { ...p, rush: put(p.rush), battle: put(p.battle), discard: p.discard.filter((c) => c.instanceId !== opCard.instanceId) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${IMAGIN_CONTRACT_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-089 乗車拒否（オペレーション）
// 「次の効果を、相手、自分の順に行う。 自分自身の山札の上から3枚をオモテにして相手に見せる。その中から特徴「車両」を持つMユニットのカードを
//  すべて自分自身のパワーゾーンに置き、それ以外は好きな順で自分自身の山札の下に戻す。」（atwiki/page-667）
// - オモテにしたカードは戻すまで山札の上に置いたままにする。パワーゾーンにはオモテ向きで1枚ずつ置く（grnrngr/faq-rider-2 RK-089 Q2）。
// - 戻す順番は、そのカードの持ち主が1枚ずつ選ぶ（先に選んだカードから山札の下に置く。最後の1枚は選ばずに置く）。

export const BOARDING_REFUSAL_EFFECT_ID = "rk089_boarding_refusal_order";

function deckTopToBottom(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), stripForZone(card)] };
  });
}

/** owner の分を行う。並べる選択が開けばその state、終われば次（rest の先頭）へ進む。 */
function runBoardingRefusal(state: GameState, owners: PlayerId[], template: PendingEffectChoice): GameState {
  let next = state;
  for (let i = 0; i < owners.length; i++) {
    const owner = owners[i]!;
    const revealed = next.players[owner].deck.slice(0, 3);
    const trains = revealed.filter((c) => {
      const def = getDefinition(next.definitions, c.cardId);
      return def?.type === "unit" && unitSizeOf(next.definitions, c) === "M" && (def.features ?? []).includes("車両");
    });
    const trainIds = new Set(trains.map((c) => c.instanceId));
    next = patchPlayer(next, owner, (p) => ({
      ...p,
      deck: p.deck.filter((c) => !trainIds.has(c.instanceId)),
      power: [...p.power, ...trains.map((c) => stripForZone(c))],
    }));
    const others = revealed.filter((c) => !trainIds.has(c.instanceId)).map((c) => c.instanceId);
    if (others.length === 1) next = deckTopToBottom(next, owner, others[0]!);
    if (others.length >= 2) {
      return openEffectChoice(next, {
        ...template,
        playerId: owner,
        effectId: BOARDING_REFUSAL_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: others,
        selectedInstanceIds: [],
        selectCount: 1,
        optional: false,
        rk5Meta: { owners: owners.slice(i + 1) },
      });
    }
  }
  return proceed(next, template);
}

function applyBoardingRefusal(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const template: PendingEffectChoice = {
    ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, ctx.sourceCardId),
    effectId: BOARDING_REFUSAL_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [],
    optional: false,
  };
  return { state: runBoardingRefusal(state, [opponent(ctx.playerId), ctx.playerId], template), detail: "rk089" };
}

CHOICE_RESOLVERS[BOARDING_REFUSAL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, pending.sourceCardId, `${BOARDING_REFUSAL_EFFECT_ID}:${instanceId}`);
  let next = deckTopToBottom(state, playerId, instanceId);
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (rest.length >= 2) return { state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: rest } }, log };
  if (rest.length === 1) next = deckTopToBottom(next, playerId, rest[0]!);
  const cleared = close({ ...next, pendingEffectChoice: pending }, pending);
  // 続きは使ったプレイヤーの手番に戻して行う。
  const template: PendingEffectChoice = { ...pending, playerId: pending.phasePlayerId === playerId ? playerId : opponent(playerId) };
  return { state: runBoardingRefusal(cleared, pending.rk5Meta?.owners ?? [], template), log };
};

// ---------------------------------------------------------------------------
// RK-093 蜘蛛男【要人の暗殺】（NC）
// 「「これはバトルエリアに出られない」または「これは自軍ターン中、バトルエリアに出られない」と書かれた敵軍ユニットを1体選び撃破してもよい。」
// （atwiki/page-625）。ウイングは省略表記の「…そうしたターン、これはバトルエリアに出られない」を含むので選べる（atwiki/page-625 Q1）。
// 本文に文字どおりその文が含まれるか（「これは」と「バトルエリアに出られない」の間に別の文があるものは含まない。atwiki/page-625 コメント欄）。
// エリア・サイズの限定はない。任意。

export const SPIDER_EFFECT_ID = "rk093_assassination";

function writtenCannotEnter(state: GameState, cardId: string): boolean {
  const text = (getDefinition(state.definitions, cardId)?.text ?? "").normalize("NFKC");
  if (text.includes("これはバトルエリアに出られない") || text.includes("これは自軍ターン中、バトルエリアに出られない")) return true;
  return cardHasKeyword(state.definitions, cardId, "wing");
}

function applySpider(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => writtenCannotEnter(state, c.cardId) && selectableEnemy(state, ctx.playerId, "RK-093", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk093:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-093"),
      effectId: SPIDER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "discard",
    }),
    detail: SPIDER_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-096 ハサミジャガー【切断溶解】（NC）「レジストを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-696）。エリアの限定はない。強制。

export const SCISSORS_EFFECT_ID = "rk096_cut_melt";

function applyScissors(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && cardHasRegisterKeyword(state, c.cardId, enemyId) && selectableEnemy(state, ctx.playerId, "RK-096", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk096:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-096"),
      effectId: SCISSORS_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "discard",
    }),
    detail: SCISSORS_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-097 仮面ライダーX【ライドルスティック】（RC）
// 「自軍コマンドゾーンから、ホールド状態のＲＣを持つユニットカードを1枚選び、手札に戻してもよい。そうしたとき、戻したカードのRCの効果を、
//  このユニットの効果として発動する。」（atwiki/page-615）
// RC を持つ＝ナンバーが RC のユニットカード。戻したカードの RC の効果は、このユニットを発生源として発動する（RS-590 の借りた RC と同じ処理）。
// 戻した仮面ライダーX の【ライドルスティック】で別の仮面ライダーX を戻せる（grnrngr/faq-rider-2 RK-097 Q）。任意。

export const RIDOL_STICK_EFFECT_ID = "rk097_ridol_stick";

function ridolTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command
    .filter((c) => c.commandHeld && isUnitCard(state, c.cardId) && getDefinition(state.definitions, c.cardId)?.comboNumber === "RC")
    .map((c) => c.instanceId);
}

function openRidolStick(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, selfId: string | undefined, sourceCardId: string): GameState {
  const ids = ridolTargets(state, playerId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId, sourceInstanceId: selfId }, sourceCardId),
    effectId: RIDOL_STICK_EFFECT_ID,
    kind: "select_command",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function applyRidolStick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: openRidolStick(state, ctx.playerId, ctx.phasePlayerId, ctx.triggerSourceInstanceId, ctx.sourceCardId), detail: RIDOL_STICK_EFFECT_ID };
}

CHOICE_RESOLVERS[RIDOL_STICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const log = logFor(state, playerId, pending.sourceCardId, `${RIDOL_STICK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const returned = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  const selfId = pending.sourceInstanceId;
  const self = selfId ? [...returned.players[playerId].battle, ...returned.players[playerId].rush].find((c) => c.instanceId === selfId) : undefined;
  if (!self) return { state: proceed(returned, pending), log };
  // 戻したカードの RC の効果を、このユニットの効果として発動する。
  const outcome = resolveRidingComboOnRideOff(returned, playerId, { ...self, cardId: card.cardId });
  const next = { ...outcome.state, log: [...outcome.state.log, ...outcome.logs] };
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[RIDOL_STICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-098 クルーザー【水中走行】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒ 自軍山札の下から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で
//  置いてもよい（コマンドゾーンに置けるカードは通常5枚まで）。そうしたとき、相手も同じようにしてもよい。」（atwiki/page-659）
// 置けない（コマンドゾーンが5枚・山札がない）ときは発動しない。自分が置いたときだけ、相手が置くかを確認する。

export const CRUISER_EFFECT_ID = "rk098_underwater";
export const CRUISER_ENEMY_EFFECT_ID = "rk098_underwater_enemy";
const COMMAND_LIMIT = 5;

function canPlaceBottom(state: GameState, playerId: PlayerId): boolean {
  const p = state.players[playerId];
  return p.deck.length > 0 && p.command.length < COMMAND_LIMIT;
}

function placeBottomHeld(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.deck[p.deck.length - 1];
    if (!card || p.command.length >= COMMAND_LIMIT) return p;
    return { ...p, deck: p.deck.slice(0, -1), command: [...p.command, { ...stripForZone(card), commandHeld: true }] };
  });
}

function applyCruiser(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId && ctx.phasePlayerId !== ctx.playerId) return { state, detail: "rk098:not_own_turn" };
  if (!canPlaceBottom(state, ctx.playerId)) return { state, detail: "rk098:cannot_place" };
  return {
    state: openOrQueue(state, confirmChoice({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-098", CRUISER_EFFECT_ID)),
    detail: CRUISER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[CRUISER_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[CRUISER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "RK-098", `${CRUISER_EFFECT_ID}:accept`);
  const placed = placeBottomHeld(close(state, pending), playerId);
  const enemyId = opponent(playerId);
  if (!canPlaceBottom(placed, enemyId)) return { state: proceed(placed, pending), log };
  return {
    state: openEffectChoice(placed, { ...pending, ...confirmChoice({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-098", CRUISER_ENEMY_EFFECT_ID), resumeChoice: pending.resumeChoice }),
    log,
  };
};
CHOICE_SKIPPERS[CRUISER_EFFECT_ID] = simpleSkip();
CHOICE_RESOLVERS[CRUISER_ENEMY_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[CRUISER_ENEMY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(placeBottomHeld(close(state, pending), playerId), pending), log: logFor(state, playerId, "RK-098", `${CRUISER_ENEMY_EFFECT_ID}:accept`) };
};
CHOICE_SKIPPERS[CRUISER_ENEMY_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-099 アポロガイスト【怪人の監視権限】の後半
// 「また、自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「怪人」を持つユニットを1体選び、捨札にしてもよい。そうしたとき、
//  このターン、これは「SP1」になる。」（atwiki/page-698）。BP+1000 の部分は rules/rk/rk5Fields.ts。任意。

export const APOLLO_EFFECT_ID = "rk099_kaijin_watch";

function applyApollo(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId && ctx.phasePlayerId !== ctx.playerId) return { state, detail: "rk099:not_own_turn" };
  const ids = state.players[ctx.playerId].rush
    .filter((c) => isUnitCard(state, c.cardId) && unitFeatures(state, ctx.playerId, c).includes("怪人"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk099:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-099"),
      effectId: APOLLO_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: APOLLO_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[APOLLO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const taken = takeFromField(close(state, pending), playerId, instanceId);
  if (!taken.card) return { error: "invalid_target" };
  let next = patchPlayer(taken.state, playerId, (p) => ({ ...p, discard: [...p.discard, stripForZone(taken.card!)] }));
  if (pending.sourceInstanceId) next = addTurnPayload(next, playerId, APOLLO_SP_RULE, "RK-099", { instanceId: pending.sourceInstanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-099", `${APOLLO_EFFECT_ID}:${cardName(state.definitions, taken.card.cardId)}`) };
};
CHOICE_SKIPPERS[APOLLO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-100 仮面ライダーZX【虚像投影装置】（RC）
// 「自軍コマンドゾーンのリリース状態のカードから、特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、
//  必要パワーと追加条件は満たすこと。」（atwiki/page-654）。効果のラッシュ（R-RUSH-21）。出したユニットはリリース状態
//  （grnrngr/faq-rider-2 RK-166 Q）。任意。

export const ZX_EFFECT_ID = "rk100_projector";

function applyZx(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = state.players[pid].command
    .filter((c) => {
      if (c.commandHeld) return false;
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && unitSizeOf(state.definitions, c) === "S" && (def.features ?? []).includes("改造人間");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk100:no_targets" };
  return {
    state: startEffectRush(state, {
      playerId: pid,
      phasePlayerId: ctx.phasePlayerId,
      effectId: ZX_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      fromZone: "command",
      candidates: ids,
      maxCount: 1,
      requireConditions: true,
      alwaysAsk: true,
    }),
    detail: ZX_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-101 タイガーロイド【タイガーボンバー】
// 「これが自軍バトルエリアにある間、敵軍ターン中、敵軍バトルエリアの特徴「忍者」を持たないユニットは、アタックするとき、バトルの前にBP-3000される。
//  （BP0以下になったユニットは撃破される）この効果は重複しない。」（atwiki/page-641）
// アタックの宣言のとき（core/applyAction.ts）、このバトルの間の BP-3000 として扱う。ラッシュエリアからアタックするウイングは対象外
// （atwiki/page-641 カード評価）。BP0 以下になったら撃破し、バトルは行わない。

/** アタックするユニットの BP の減少（0 なら対象外）。 */
export function rk5TigerBomberPenalty(state: GameState, battle: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId">): number {
  const tigerOwner = battle.defenderPlayerId;
  if (state.activePlayer !== battle.attackerPlayerId) return 0;
  if (!state.players[tigerOwner].battle.some((c) => isSameCardIdentity(c.cardId, "RK-101"))) return 0;
  const attacker = state.players[battle.attackerPlayerId].battle.find((c) => c.instanceId === battle.attackerInstanceId);
  if (!attacker || !isUnitCard(state, attacker.cardId)) return 0;
  if (unitFeatures(state, battle.attackerPlayerId, attacker).includes("忍者")) return 0;
  return 3000;
}

/** タイガーボンバーで BP0 以下になるか。 */
export function rk5TigerBomberDestroys(state: GameState, battle: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId">, bonus: number): boolean {
  const penalty = rk5TigerBomberPenalty(state, battle);
  if (penalty === 0) return false;
  const attacker = state.players[battle.attackerPlayerId].battle.find((c) => c.instanceId === battle.attackerInstanceId);
  if (!attacker) return false;
  return effectiveBp(state, battle.attackerPlayerId, attacker) + bonus - penalty <= 0;
}

/** BP0 以下になったアタックしたユニットを撃破する。 */
export function rk5TigerBomberDestroy(state: GameState, battle: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "phasePlayerId">): GameState {
  const left = applyUnitLeave(state, battle.attackerInstanceId, "discard", battle.phasePlayerId);
  return "error" in left ? state : left.state;
}

// ---------------------------------------------------------------------------
// RK-102 仮面ライダークウガDF【スプラッシュドラゴン】（RC）
// 「敵軍常駐置き場のカード枚数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主の手札に戻してもよい（敵軍常駐置き場にカードが1枚も
//  無ければ0と数える）。」（atwiki/page-688）。常駐に重ねたカードも常駐置き場のカードとして数える（atwiki/page-688 カード評価のライダーパスの例）。
// エリア・サイズの限定はない。任意。

export const SPLASH_DRAGON_EFFECT_ID = "rk102_splash_dragon";

function residentCardCount(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].operation.reduce((n, c) => n + 1 + (c.stackedCards?.length ?? 0), 0);
}

function applySplashDragon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const limit = residentCardCount(state, enemyId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costOf(state, c.cardId);
      return Number.isFinite(n) && n <= limit && selectableEnemy(state, ctx.playerId, "RK-102", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk102:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, ctx.sourceCardId),
      effectId: SPLASH_DRAGON_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "hand",
    }),
    detail: SPLASH_DRAGON_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-103 仮面ライダークウガPF【ブラストペガサス】（コンビネーション。rules/combo.ts から呼ぶ）
// 「これは、特徴「警察」を持つ自軍ユニットからコンビネーションするときBP+3000され、敵軍ラッシュエリアのユニットにアタックできる。」（atwiki/page-689）
// 直前に出たユニット（ビークルは飛ばす）が今の特徴に「警察」を持てば、このターン有効にする（BP・アタック先は rules/rk/rk5Fields.ts）。

function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

export function tryRk5OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  // RK-098 クルーザー: ライドしたユニットと一緒にバトルエリアに出たとき（自軍ターン中）。
  const vehicle = card.mountedOnInstanceId ? state.players[playerId].battle.find((c) => c.instanceId === card.mountedOnInstanceId) : undefined;
  if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-098") && state.activePlayer === playerId) {
    return applyCruiser(state, { playerId, phasePlayerId: playerId, sourceCardId: vehicle.cardId, effectId: CRUISER_EFFECT_ID, triggerSourceInstanceId: vehicle.instanceId }).state;
  }
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  if (!isSameCardIdentity(card.cardId, "RK-103")) return state;
  const partner = comboPartner(state, battleBeforeEnter);
  if (!partner || !unitFeatures(state, playerId, partner).includes("警察")) return state;
  return addTurnPayload(state, playerId, BLAST_PEGASUS_RULE, "RK-103", { instanceId: card.instanceId });
}

// ---------------------------------------------------------------------------
// RK-105 仮面ライダーアギトSF【ハルバードスピン】（RC）
// 「敵軍ユニットを、必要パワーの数字の合計が3になるまで好きな数選び、持ち主の山札に戻してシャッフルしてもよい。」（atwiki/page-690）
// 合計が3を超えるユニットは選べない。3に足りなくても選び終えられる（grnrngr/faq-rider-2 RK-105 Q）。選び終えたら（「決定」か、選べるユニットが
// なくなったら）持ち主の山札に戻してシャッフルする。エリア・サイズの限定はない。任意（1体も選ばずに見送れる）。

export const HALBERD_EFFECT_ID = "rk105_halberd_spin";
const HALBERD_LIMIT = 3;

function halberdTargets(state: GameState, playerId: PlayerId, selected: string[], remaining: number): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => {
      if (selected.includes(c.instanceId)) return false;
      const n = costOf(state, c.cardId);
      return Number.isFinite(n) && n <= remaining && selectableEnemy(state, playerId, "RK-105", c);
    })
    .map((c) => c.instanceId);
}

function applyHalberd(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = halberdTargets(state, ctx.playerId, [], HALBERD_LIMIT);
  if (ids.length === 0) return { state, detail: "rk105:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, ctx.sourceCardId),
      effectId: HALBERD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: ids.length,
      optional: true,
    }),
    detail: HALBERD_EFFECT_ID,
  };
}

function finishHalberd(state: GameState, pending: PendingEffectChoice, selected: string[]): GameState {
  let next = close(state, pending);
  const touched = new Set<PlayerId>();
  for (const id of selected) {
    for (const pid of ["player1", "player2"] as const) {
      const taken = takeFromField(next, pid, id);
      if (!taken.card) continue;
      next = patchPlayer(taken.state, pid, (p) => ({ ...p, deck: [...p.deck, stripForZone(taken.card!)] }));
      touched.add(pid);
    }
  }
  for (const pid of touched) next = patchPlayer(next, pid, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return proceed(next, pending);
}

CHOICE_RESOLVERS[HALBERD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const used = selected.reduce((n, id) => {
    const card = fieldUnits(state, opponent(playerId)).find((c) => c.instanceId === id);
    return n + (card ? costOf(state, card.cardId) : 0);
  }, 0);
  const ids = halberdTargets(state, playerId, selected, HALBERD_LIMIT - used);
  const log = logFor(state, playerId, pending.sourceCardId, `${HALBERD_EFFECT_ID}:pick:${instanceId}`);
  if (ids.length === 0) return { state: finishHalberd(state, pending, selected), log };
  // 1体以上選んだら「決定」で選び終える（見送りはできない）。
  return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: ids, selectedInstanceIds: selected, optional: false } }, log };
};
CHOICE_SKIPPERS[HALBERD_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[HALBERD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  return { state: finishHalberd(state, pending, selected), log: logFor(state, playerId, pending.sourceCardId, `${HALBERD_EFFECT_ID}:${selected.length}`) };
};

// ---------------------------------------------------------------------------
// 「ターンを終えるとき」（rules/turnEndingEffects.ts から呼ぶ。R-END-01）
// - RK-094 ショッカー戦闘員バイク部隊「※これは、自分がターンを終えるとき、ビークルにライドしていなければ撃破される。」（atwiki/page-701）
//   エリアの限定はない（ラッシュエリアでも撃破される）。
// - RK-095 ハリケーン【ハリケーンダッシュ】「自分がターンを終えるとき、このビークルがバトルエリアでライドされていれば、このビークルにライドしている
//   ユニットをラッシュエリアに戻してもよい。（ライドオフしない限り、ユニットとビークルは重ねたまま扱う）」（atwiki/page-658）
// - RK-103 仮面ライダークウガPF「※自分がターンを終えるとき、自軍常駐置き場に配置されている「超変身」の上に、このユニットを重ねて置いてもよい。」
//   （atwiki/page-689）。重ねたカードはオモテ向き（RK-080 で重ねるカードと同じ）。

export const HURRICANE_EFFECT_ID = "rk095_hurricane_dash";
export const PEGASUS_STACK_EFFECT_ID = "rk103_stack_on_chouhenshin";

/** 撃破される RK-094（バイク部隊）を撃破する。 */
export function applyRk5TurnEndDestroy(state: GameState, endingPlayerId: PlayerId): GameState {
  let next = state;
  const targets = fieldUnits(next, endingPlayerId).filter((c) => isSameCardIdentity(c.cardId, "RK-094") && !c.mountedOnInstanceId);
  for (const card of targets) {
    if (!fieldUnits(next, endingPlayerId).some((c) => c.instanceId === card.instanceId)) continue;
    const left = applyUnitLeave(next, card.instanceId, "discard", endingPlayerId);
    if (!("error" in left)) next = left.state;
  }
  return next;
}

/** 選択を伴う「ターンを終えるとき」の発生源（instanceId）。 */
export function collectRk5TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const p = state.players[endingPlayerId];
  const hurricanes = p.battle
    .filter((c) => isSameCardIdentity(c.cardId, "RK-095") && p.battle.some((u) => u.mountedOnInstanceId === c.instanceId))
    .map((c) => c.instanceId);
  const pegasus = fieldUnits(state, endingPlayerId).filter((c) => isSameCardIdentity(c.cardId, "RK-103")).map((c) => c.instanceId);
  return [...hurricanes, ...pegasus];
}

function chouhenshinResident(state: GameState, playerId: PlayerId): CardInstance | undefined {
  return state.players[playerId].operation.find((c) => isSameCardIdentity(c.cardId, "RK-080"));
}

export function openRk5TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const p = state.players[endingPlayerId];
  const ctx = { playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: entry };
  const vehicle = p.battle.find((c) => c.instanceId === entry && isSameCardIdentity(c.cardId, "RK-095"));
  if (vehicle) {
    if (!p.battle.some((u) => u.mountedOnInstanceId === entry)) return state;
    return openEffectChoice(state, confirmChoice(ctx, vehicle.cardId, HURRICANE_EFFECT_ID));
  }
  const pegasus = fieldUnits(state, endingPlayerId).find((c) => c.instanceId === entry && isSameCardIdentity(c.cardId, "RK-103"));
  if (pegasus && chouhenshinResident(state, endingPlayerId)) return openEffectChoice(state, confirmChoice(ctx, pegasus.cardId, PEGASUS_STACK_EFFECT_ID));
  return state;
}

CHOICE_RESOLVERS[HURRICANE_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[HURRICANE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const vehicleId = pending.sourceInstanceId;
  const riders = new Set(state.players[playerId].battle.filter((c) => c.mountedOnInstanceId === vehicleId).map((c) => c.instanceId));
  const group = new Set([...(vehicleId ? [vehicleId] : []), ...riders]);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => !group.has(c.instanceId)),
    rush: [...p.rush, ...p.battle.filter((c) => group.has(c.instanceId))],
  }));
  return { state: next, log: logFor(state, playerId, "RK-095", `${HURRICANE_EFFECT_ID}:accept`) };
};
CHOICE_SKIPPERS[HURRICANE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-095", HURRICANE_EFFECT_ID) };
};

CHOICE_RESOLVERS[PEGASUS_STACK_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[PEGASUS_STACK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const resident = chouhenshinResident(state, playerId);
  const selfId = pending.sourceInstanceId;
  if (!resident || !selfId) return { state: close(state, pending) };
  const taken = takeFromField(close(state, pending), playerId, selfId);
  if (!taken.card) return { state: close(state, pending) };
  const next = patchPlayer(taken.state, playerId, (p) => ({
    ...p,
    operation: p.operation.map((c) => (c.instanceId === resident.instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), stripForZone(taken.card!)] } : c)),
  }));
  return { state: next, log: logFor(state, playerId, "RK-103", `${PEGASUS_STACK_EFFECT_ID}:accept`) };
};
CHOICE_SKIPPERS[PEGASUS_STACK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-103", PEGASUS_STACK_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK5_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-087::zectmizer": applyZectmizer,
  "RK-088::imagin_contract": applyImaginContract,
  "RK-089::boarding_refusal": applyBoardingRefusal,
  "RK-093::assassination": applySpider,
  "RK-096::cut_melt": applyScissors,
  "RK-097::ridol_stick": applyRidolStick,
  "RK-098::underwater": applyCruiser,
  "RK-099::kaijin_watch": applyApollo,
  "RK-100::projector": applyZx,
  "RK-102::splash_dragon": applySplashDragon,
  "RK-105::halberd_spin": applyHalberd,
  // 継続効果・カウンター・ターン終了時の効果は、それぞれの処理の場所から呼ぶ。DSL からは何もしない。
  "RK-085::guard_vent": noop("rk085:counter"),
  "RK-091::grunt_command": noop("rk091:continuous"),
  "RK-092::wolf_operation": noop("rk092:continuous"),
  "RK-094::bike_unit": noop("rk094:turn_end"),
  "RK-095::hurricane_dash": noop("rk095:turn_end"),
  "RK-101::tiger_bomber": noop("rk101:on_attack"),
  "RK-103::stack_on_chouhenshin": noop("rk103:turn_end"),
  "RK-103::blast_pegasus": noop("rk103:on_enter"),
};

export function tryRk5CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK5_KEYWORD_PREFIX)) return null;
  const handler = RK5_KEYWORDS[keyword.slice(RK5_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
