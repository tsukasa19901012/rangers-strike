/**
 * ザ・マスクドライダーEXP vol.1・vol.2 RK-064〜RK-084（仮面ライダーファイズ〜トリックベント）のカード固有の効果（cardSpec RK4-064-084 の監査）。
 *
 * - `tryRk4CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk4::cardId::name`。RC・NC・オペレーション）。
 * - `tryResolveRk4Choice` / `trySkipRk4Choice`: このモジュールが開いた選択の解決。撃破・パワーゾーンに置く・敵軍バトルエリアに出す選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - コンビネーション（RK-064・RK-067・RK-068・RK-069）・ウラ返すとき（RK-066）・バトルに勝ったとき（RK-069）・ラッシュエリアに戻るとき
 *   （RK-074）・スタートフェイズを終えるとき（RK-080・RK-082）は、それぞれの処理の場所から呼ぶ。
 * - RK-075〜RK-078 は RK-016〜RK-018・RK-021 の再録（同名・同文）で、rules/rk/rk1NamedEffects.ts・rules/residentOps.ts が同じカードとして扱う。
 * 構成は rules/rk/rk3UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, DamagePaymentResume, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { canEffectPutRushUnitIntoBattle, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { openOptionalEffectConfirm, registerOptionalEffect } from "../optionalEffects";
import { addBakiBakiExtraAttack } from "../turnModifierBridge";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { rk1IsSmallNow } from "./rk1Features";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export const RK4_KEYWORD_PREFIX = "rk4::";

export function isRk4ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk4Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function fieldUnits(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => isUnitCard(state, c.cardId));
}

function turnPayloads<T>(playerState: GameState["players"][PlayerId], ruleId: string): T[] {
  return getPlayerModifiers(playerState)
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

function hasInstancePayload(state: GameState, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return turnPayloads<{ instanceId: string }>(state.players[playerId], ruleId).some((p) => p.instanceId === instanceId);
}

/** 敵軍の効果で選べる敵軍ユニット（「相手に選ばれない」・ミラーワールド等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

/** コンビネーションの相手（直前に出たユニット。ビークルは飛ばす。R-CN-04/05）。 */
function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// RK-064 仮面ライダーファイズ【ファイズエッジ】（RC）
// 「敵軍バトルエリアから、BPの下三桁が500の敵軍Sユニットを1体選び撃破する。（この効果は「オートバジンBM」からコンビネーションするときは
//  ナンバーに関係なく発動する）」（atwiki/page-207）
// - BP は今の BP（オートバジンBM【バスターホイール】で下三桁が 500 になったユニットも撃破できる。grnrngr/faq-rider-1 RK-046 Q3）。強制。
// - 「オートバジンBM」からコンビネーションしたときはライドオフしなくても発動する（tryRk4OnEnterBattle）。そのときは同じ進入で
//   ライドオフしても2回目は発動しない（grnrngr/faq-rider-1 RK-017 Q3「RCやNCを発動した時点で…タイミングは終了」）。

export const FAIZ_EDGE_EFFECT_ID = "rk064_faiz_edge";
const FAIZ_EDGE_DONE_RULE = "rk064_faiz_edge_done";
const AUTOVAJIN_BM_NAME = "オートバジンBM";

function openFaizEdge(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, sourceInstanceId: string | undefined): GameState {
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        rk1IsSmallNow(state, c) &&
        effectiveBp(state, enemyId, c) % 1000 === 500 &&
        selectableEnemy(state, playerId, "RK-064", c),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId, sourceInstanceId }, "RK-064"),
    effectId: FAIZ_EDGE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    unitDestination: "discard",
  });
}

function applyFaizEdge(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (id && hasInstancePayload(state, ctx.playerId, FAIZ_EDGE_DONE_RULE, id)) return { state, detail: "rk064:already" };
  const marked = id ? addTurnPayload(state, ctx.playerId, FAIZ_EDGE_DONE_RULE, "RK-064", { instanceId: id }) : state;
  return { state: openFaizEdge(marked, ctx.playerId, ctx.phasePlayerId, id), detail: FAIZ_EDGE_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RK-066 仮面ライダー電王SF【俺の必殺技！】（RC）
// 「これがストライクして相手がパワーゾーンのカードをウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選び撃破する。」
// （atwiki/page-169）。RC の効果なので、ライドオフしたターンだけ有効（R-KW-RC-01）。ウラ返す前に解決する（R-TIME-01。RS-199
// 【ブレイクアクション】と同じ）。対象は敵軍のラッシュ・バトルエリアのユニット（サイズの指定なし）。強制。

export const ORE_NO_HISSATSU_EFFECT_ID = "rk066_ore_no_hissatsu";
const ORE_NO_HISSATSU_RULE = "rk066_ore_no_hissatsu_active";

function applyOreNoHissatsu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "rk066:no_unit" };
  return { state: addTurnPayload(state, ctx.playerId, ORE_NO_HISSATSU_RULE, "RK-066", { instanceId: id }), detail: "rk066:active" };
}

/**
 * 「ウラ返すとき」（rules/damagePayment.ts flipPowerForDamage から呼ぶ）。state はウラ返す前、flipIds はこれからウラ返すパワーのカード。
 * 発動すれば選択を開いた state、しなければ null。
 */
export function openRk4BeforeFlip(state: GameState, damagedPlayerId: PlayerId, flipIds: string[], resume: DamagePaymentResume): GameState | null {
  if (flipIds.length === 0 || resume.kind !== "strike" || state.pendingEffectChoice) return null;
  const strikerId = opponent(damagedPlayerId);
  if (resume.pending.strikerPlayerId !== strikerId) return null;
  const striker = state.players[strikerId].battle.find((c) => c.instanceId === resume.pending.strikerInstanceId);
  if (!striker || !isSameCardIdentity(striker.cardId, "RK-066")) return null;
  if (!hasInstancePayload(state, strikerId, ORE_NO_HISSATSU_RULE, striker.instanceId)) return null;
  const costs = new Set(
    state.players[damagedPlayerId].power
      .filter((c) => flipIds.includes(c.instanceId))
      .map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)),
  );
  const ids = fieldUnits(state, damagedPlayerId)
    .filter((c) => costs.has(parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)) && selectableEnemy(state, strikerId, "RK-066", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    ...base({ playerId: strikerId, phasePlayerId: resume.pending.battlePhasePlayer, sourceInstanceId: striker.instanceId }, striker.cardId),
    effectId: ORE_NO_HISSATSU_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    unitDestination: "discard",
  });
}

// ---------------------------------------------------------------------------
// RK-067 仮面ライダーナイト【飛翔斬】
// 「「ダークウイング」からコンビネーションしたとき発動できる⇒これは敵軍ユニットのBPをカードに表記された本来の値としてバトルする」
// （atwiki/page-188）。発動するかを確認する（任意）。発動したターン、これがアタックするバトルで敵軍ユニットの BP を本来の値にする。

export const HISHOUZAN_EFFECT_ID = "rk067_hishouzan";
const HISHOUZAN_RULE = "rk067_hishouzan_active";

registerOptionalEffect(HISHOUZAN_EFFECT_ID, {
  apply: (state, pending) =>
    pending.sourceInstanceId ? addTurnPayload(state, pending.playerId, HISHOUZAN_RULE, "RK-067", { instanceId: pending.sourceInstanceId }) : state,
});

/** 【飛翔斬】: アタックするとき、敵軍ユニットの BP を本来の値としてバトルする（rules/namedUnitEffects.ts battleDefenderBp）。 */
export function rk4UsePrintedDefenderBp(state: GameState, pending: PendingBattle): boolean {
  return hasInstancePayload(state, pending.attackerPlayerId, HISHOUZAN_RULE, pending.attackerInstanceId);
}

// ---------------------------------------------------------------------------
// RK-068 仮面ライダー王蛇【ベノクラッシュ】
// 「「ベノスネーカー」からコンビネーションしたとき発動できる⇒敵軍コマンドゾーンから、ユニットカードを1枚選び捨札にしてもよい。ただし、
//  必要パワーの数字が敵軍ダメージの点数以下のカードしか選べない。」（atwiki/page-189）。コマンドの状態は問わない。任意。

export const VENO_CRASH_EFFECT_ID = "rk068_veno_crash";

function venoCrashTargets(state: GameState, playerId: PlayerId): string[] {
  const enemy = state.players[opponent(playerId)];
  return enemy.command
    .filter((c) => {
      if (!isUnitCard(state, c.cardId)) return false;
      const cost = parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost);
      return Number.isFinite(cost) && cost <= enemy.damage;
    })
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[VENO_CRASH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-068", `${VENO_CRASH_EFFECT_ID}:${card.cardId}`) };
};
CHOICE_SKIPPERS[VENO_CRASH_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-069 仮面ライダーファム【ミスティースラッシュ】
// 「「ブランウイング」からコンビネーションしたとき発動できる⇒特徴「ミラーモンスター」を持つユニットにアタックしてバトルに勝つたび、
//  追加でアタックできる（ストライクはできない）。」（atwiki/page-53）
// 追加でアタックするかどうかは後で選べるので、発動の確認は省いて有効にする（発動しないことと結果が変わらない）。
// 追加アタックは RS-167【バキバキパンチ】と同じ「追加でアタックできる（ストライク不可）」の記録を使う。

const MISTY_SLASH_RULE = "rk069_misty_slash_active";

/** アタックしてバトルに勝ったとき（rules/operationCounters.ts のバトルの解決から呼ぶ）。defender は撃破前のユニット。 */
export function rk4OnAttackWin(state: GameState, attackerId: PlayerId, attackerInstanceId: string, defender: CardInstance, defenderOwner: PlayerId): GameState {
  if (!hasInstancePayload(state, attackerId, MISTY_SLASH_RULE, attackerInstanceId)) return state;
  if (!unitFeatures(state, defenderOwner, defender).includes("ミラーモンスター")) return state;
  return patchPlayer(state, attackerId, (p) => addBakiBakiExtraAttack(p, attackerInstanceId));
}

// ---------------------------------------------------------------------------
// コンビネーション（rules/combo.ts の進入効果から呼ぶ）。自軍バトルフェイズに出たときだけ（R-CN-04・R-CN-05）。

export function tryRk4OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const partner = comboPartner(state, battleBeforeEnter);
  if (!partner) return state;
  const partnerName = cardName(state.definitions, partner.cardId);
  if (isSameCardIdentity(card.cardId, "RK-064") && partnerName === AUTOVAJIN_BM_NAME) {
    if (hasInstancePayload(state, playerId, FAIZ_EDGE_DONE_RULE, card.instanceId)) return state;
    const marked = addTurnPayload(state, playerId, FAIZ_EDGE_DONE_RULE, "RK-064", { instanceId: card.instanceId });
    return openFaizEdge(marked, playerId, playerId, card.instanceId);
  }
  if (isSameCardIdentity(card.cardId, "RK-067") && partnerName === "ダークウイング") {
    if (state.pendingEffectChoice) return state;
    return openOptionalEffectConfirm(state, {
      playerId,
      effectId: HISHOUZAN_EFFECT_ID,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      phasePlayerId: playerId,
    });
  }
  if (isSameCardIdentity(card.cardId, "RK-068") && partnerName === "ベノスネーカー") {
    const ids = venoCrashTargets(state, playerId);
    if (ids.length === 0) return state;
    return openOrQueue(state, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, card.cardId),
      effectId: VENO_CRASH_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    });
  }
  if (isSameCardIdentity(card.cardId, "RK-069") && partnerName === "ブランウイング") {
    return addTurnPayload(state, playerId, MISTY_SLASH_RULE, "RK-069", { instanceId: card.instanceId });
  }
  return state;
}

// ---------------------------------------------------------------------------
// RK-070 仮面ライダーカブトMF【アバランチブレイク】（RC）
// 「敵軍Sユニットの数が自軍Sユニットの数より5体以上多いとき、自軍Sユニットと同じ数になるまで敵軍Sユニットを選び、選んだユニットを
//  持ち主のパワーゾーンに送る」（atwiki/page-164）。数えるのはラッシュ・バトルエリアの S ユニット（RS-219 タイムブルーと同じ）。
// 1体ずつ選び、選び終えてからまとめて送る（RS-219 Q1 と同じ手順）。強制。

export const AVALANCHE_EFFECT_ID = "rk070_avalanche_break";

function smallFieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  return fieldUnits(state, playerId).filter((c) => rk1IsSmallNow(state, c));
}

function applyAvalancheBreak(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const own = smallFieldUnits(state, ctx.playerId).length;
  const enemy = smallFieldUnits(state, enemyId);
  if (enemy.length - own < 5) return { state, detail: "rk070:not_enough" };
  const ids = enemy.filter((c) => selectableEnemy(state, ctx.playerId, "RK-070", c)).map((c) => c.instanceId);
  const need = Math.min(enemy.length - own, ids.length);
  if (need <= 0) return { state, detail: "rk070:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-070"),
      effectId: AVALANCHE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: need,
      optional: false,
      rk3Meta: { need },
    }),
    detail: AVALANCHE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[AVALANCHE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const need = pending.rk3Meta?.need ?? 1;
  const log = logFor(state, playerId, "RK-070", `${AVALANCHE_EFFECT_ID}:${instanceId}`);
  if (selected.length < need) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId), selectedInstanceIds: selected } },
      log,
    };
  }
  const enemyId = opponent(playerId);
  const moving = new Set(selected);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const take = (cards: CardInstance[]) => cards.filter((c) => moving.has(c.instanceId));
    // ライドしているユニットはビークルから降りてパワーゾーンに置かれ、ビークルはその場に残る。
    return {
      ...p,
      battle: p.battle.filter((c) => !moving.has(c.instanceId)),
      rush: p.rush.filter((c) => !moving.has(c.instanceId)),
      power: [...p.power, ...[...take(p.battle), ...take(p.rush)].map((c) => stripForZone(c))],
      discard: [...p.discard, ...[...take(p.battle), ...take(p.rush)].flatMap((c) => (c.stackedCards ?? []).map((s) => stripForZone(s)))],
    };
  });
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// RK-071 仮面ライダーキックホッパー【ライダーキック】（NC）
// 「敵軍ラッシュエリアのSユニットの数を数えて、その数と同じ必要パワーの数字を持つ敵軍Sユニットがあれば1体選び、持ち主のパワーゾーンに送る。」
// （atwiki/page-165）。選ぶ敵軍 S ユニットのエリアの限定はない（ラッシュ・バトルの両方。R-TGT-01）。強制。

export const KICK_HOPPER_EFFECT_ID = "rk071_rider_kick";

function applyKickHopper(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const count = state.players[enemyId].rush.filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c)).length;
  const ids = smallFieldUnits(state, enemyId)
    .filter((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost) === count && selectableEnemy(state, ctx.playerId, "RK-071", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk071:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-071"),
      effectId: KICK_HOPPER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "power",
    }),
    detail: KICK_HOPPER_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-074 ライダーマン【カギ爪アーム】
// 「これが自軍バトルエリアからラッシュエリアに戻るとき、敵軍ラッシュエリアからSユニットを1体選び、可能ならバトルエリアに出してもよい。」
// （atwiki/page-131）。バトルエリアに出られない（※の出場制限を満たせない）ユニットは選ばない（RS 系の【ファルコンクロー】と同じ）。
// スタートフェイズにラッシュエリアに戻すとき（rules/startPhase.ts）に発動する。

export const KAGIZUME_EFFECT_ID = "rk074_kagizume_arm";

export function isRk4BattleToRushTrigger(card: CardInstance): boolean {
  return isSameCardIdentity(card.cardId, "RK-074");
}

export function tryRk4BattleToRush(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  if (!isRk4BattleToRushTrigger(card) || state.pendingEffectChoice) return state;
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].rush
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        rk1IsSmallNow(state, c) &&
        selectableEnemy(state, playerId, card.cardId, c) &&
        canEffectPutRushUnitIntoBattle(state, enemyId, c.instanceId),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId, sourceInstanceId: card.instanceId }, card.cardId),
    effectId: KAGIZUME_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    unitDestination: "enemy_battle",
  });
}

// ---------------------------------------------------------------------------
// RK-079 仮面ライダーの称号（オペレーション）
// 「ナンバーに数字を持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。
//  このカードに重ねたユニットのナンバーはＲＣになり、特徴「仮面ライダー」が追加される。重ねたユニットがユニットでなくなるとき、
//  このカードは捨札になる。」（atwiki/page-661）
// RK-013 Jパワーと同じく、このカードはユニットの下に重ねる（ユニットの stackedCards）。ナンバーが RC になったユニットは RC のユニットとして
// ライドでき、ライドオフでナンバーの欄の効果が発動し、ナンバーの数字の位置に出ても NC は成立しない（R-KW-RC-01）。
// 「本来のナンバー」を参照する効果（RS-280 の手札に戻る効果等）は変わらない（grnrngr/faq-rider-2 RK-079 Q）。
// 特徴の追加は rules/rk/rk1Features.ts、ユニットでなくなったときの捨札は rules/rk/rk1NamedEffects.ts settleJPowerStacks。

export const KAMEN_TITLE_EFFECT_ID = "rk079_kamen_rider_title";

function applyKamenTitle(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => rk1IsSmallNow(state, c) && typeof getDefinition(state.definitions, c.cardId)?.comboNumber === "number")
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${KAMEN_TITLE_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, ctx.sourceCardId),
      effectId: KAMEN_TITLE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: KAMEN_TITLE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[KAMEN_TITLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${pending.sourceCardId}:op`, cardId: pending.sourceCardId };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${KAMEN_TITLE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-080 超変身・RK-082 オルタフォース（※常駐）— スタートフェイズを終えるとき
// 「自軍スタートフェイズを終えるとき、一度だけ自分の手札から特徴「アマダム」（「賢者の石」）を持つユニットカードを好きな枚数選び、相手に
//  見せてからこれに重ねて置いてもよい。そうしたとき、手札から置いた枚数をドローする。」（atwiki/page-684・page-621）
// 「一度だけ」は毎ターン1回ずつ（grnrngr/faq-rider-2 RK-080 Q）。1枚ずつ選び「決定」で置く（0枚なら skip）。重ねたカードはオモテ向き。
// 置き換えの部分は rules/errataCardEffects.ts のライダーパス（RK-022）と同じ処理（特徴だけが違う）。

export const STACK_FROM_HAND_EFFECT_ID = "rk080_stack_from_hand";

/** 置き換えの常駐（重ねたカードと、本来の特徴に X を持つ自軍ユニットを置き換える）と、その特徴 X。 */
const SWAP_RESIDENT_FEATURES: Record<string, string> = { "RK-022": "DEN-O", "RK-080": "アマダム", "RK-082": "賢者の石" };

/** 重ねたカードと自軍ユニットを置き換える常駐の特徴（対象外なら undefined）。 */
export function swapResidentFeature(cardId: string): string | undefined {
  for (const [id, feature] of Object.entries(SWAP_RESIDENT_FEATURES)) {
    if (isSameCardIdentity(cardId, id)) return feature;
  }
  return undefined;
}

function handStackIds(state: GameState, playerId: PlayerId, feature: string): string[] {
  return state.players[playerId].hand
    .filter((c) => isUnitCard(state, c.cardId) && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes(feature))
    .map((c) => c.instanceId);
}

function openStackFromHand(state: GameState, playerId: PlayerId, op: CardInstance, feature: string): GameState {
  const ids = handStackIds(state, playerId, feature);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: op.instanceId }, op.cardId),
    effectId: STACK_FROM_HAND_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: ids.length,
    optional: true,
  });
}

/** スタートフェイズを終えるとき（rules/startPhase.ts transitionStartToChargePhase から呼ぶ）。 */
export function applyRk4StartPhaseEnd(state: GameState, playerId: PlayerId): GameState {
  let next = state;
  for (const op of state.players[playerId].operation) {
    if (!isSameCardIdentity(op.cardId, "RK-080") && !isSameCardIdentity(op.cardId, "RK-082")) continue;
    const feature = swapResidentFeature(op.cardId);
    if (feature) next = openStackFromHand(next, playerId, op, feature);
  }
  return next;
}

CHOICE_RESOLVERS[STACK_FROM_HAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
        selectedInstanceIds: [...(pending.selectedInstanceIds ?? []), instanceId],
        // 1枚以上選んだら「決定」できる（rules/rk/rk4UnitEffects.ts canConfirmRk4Choice）。
      },
    },
    log: logFor(state, playerId, pending.sourceCardId, `${STACK_FROM_HAND_EFFECT_ID}:pick:${instanceId}`),
  };
};
CHOICE_SKIPPERS[STACK_FROM_HAND_EFFECT_ID] = simpleSkip();

/** 選んだところで確定できる選択か。 */
export function canConfirmRk4Choice(pending: PendingEffectChoice): boolean {
  return pending.effectId === STACK_FROM_HAND_EFFECT_ID && (pending.selectedInstanceIds?.length ?? 0) > 0;
}

/** 選んだところで確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || pending.effectId !== STACK_FROM_HAND_EFFECT_ID) return null;
  const picked = new Set(pending.selectedInstanceIds ?? []);
  if (picked.size === 0) return { error: "no_selection" };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const moving = p.hand.filter((c) => picked.has(c.instanceId)).map((c) => stripForZone(c));
    const draws = p.deck.slice(0, moving.length).map((c) => stripForZone(c));
    return {
      ...p,
      hand: [...p.hand.filter((c) => !picked.has(c.instanceId)), ...draws],
      deck: p.deck.slice(draws.length),
      operation: p.operation.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), ...moving] } : c)),
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${STACK_FROM_HAND_EFFECT_ID}:${picked.size}`) };
}

// ---------------------------------------------------------------------------
// RK-084 トリックベント（オペレーション）
// 「自軍山札の上から3枚をオモテにする。その中から特徴「ミラーライダー」を持つユニットカードをすべて自軍ラッシュエリアに出す。ただし、
//  追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、それ以外のオモテにしたカードはすべて捨札になる。」（atwiki/page-642）
// 出すのは効果のラッシュ（必要パワーを無視し、追加条件は満たす。RS-249 と同じ）。追加条件を満たせないミラーライダーは「それ以外」として
// 捨札になる（atwiki/page-642 カード評価のオーディンの例）。出し終えてから、残ったオモテのカードを捨札にする。

export const TRICK_VENT_EFFECT_ID = "rk084_trick_vent";

function discardRevealed(state: GameState, playerId: PlayerId, revealed: string[]): GameState {
  const ids = new Set(revealed);
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: p.deck.filter((c) => !ids.has(c.instanceId)),
    discard: [...p.discard, ...p.deck.filter((c) => ids.has(c.instanceId)).map((c) => stripForZone(c))],
  }));
}

function applyTrickVent(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const revealed = state.players[pid].deck.slice(0, 3);
  if (revealed.length === 0) return { state, detail: `${TRICK_VENT_EFFECT_ID}:empty` };
  const mirrors = revealed
    .filter((c) => isUnitCard(state, c.cardId) && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("ミラーライダー"))
    .map((c) => c.instanceId);
  const rushable = filterEffectRushCandidates(state, pid, "deck", mirrors, true, true);
  let next = state;
  if (rushable.length > 0) {
    next = startEffectRush(state, {
      playerId: pid,
      phasePlayerId: ctx.phasePlayerId,
      effectId: TRICK_VENT_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.operationInstanceId,
      fromZone: "deck",
      candidates: rushable,
      maxCount: rushable.length,
      requireConditions: true,
      ignorePowerCost: true,
      mandatory: true,
      forced: true,
    });
  }
  // 出し終えたら（追加条件の素材を選ぶ選択が残っていても）、出さなかったオモテのカードを捨札にする。
  const stillRushing = new Set(next.pendingEffectRush?.queue ?? []);
  return {
    state: discardRevealed(next, pid, revealed.map((c) => c.instanceId).filter((id) => !stillRushing.has(id))),
    detail: `${TRICK_VENT_EFFECT_ID}:${rushable.length}`,
  };
}

// ---------------------------------------------------------------------------
// 起点

const RK4_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-064::faiz_edge": applyFaizEdge,
  "RK-066::ore_no_hissatsu": applyOreNoHissatsu,
  "RK-070::avalanche_break": applyAvalancheBreak,
  "RK-071::rider_kick": applyKickHopper,
  "RK-079::kamen_rider_title": applyKamenTitle,
  "RK-084::trick_vent": applyTrickVent,
  // RK-067【飛翔斬】・RK-068【ベノクラッシュ】・RK-069【ミスティースラッシュ】はコンビネーション（tryRk4OnEnterBattle）、
  // RK-074【カギ爪アーム】はラッシュエリアに戻るとき（tryRk4BattleToRush）に処理する。DSL からは何もしない。
  "RK-067::hishouzan": (s) => ({ state: s, detail: "rk067:on_enter" }),
  "RK-068::veno_crash": (s) => ({ state: s, detail: "rk068:on_enter" }),
  "RK-069::misty_slash": (s) => ({ state: s, detail: "rk069:on_enter" }),
  "RK-074::kagizume_arm": (s) => ({ state: s, detail: "rk074:on_return" }),
};

export function tryRk4CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK4_KEYWORD_PREFIX)) return null;
  const handler = RK4_KEYWORDS[keyword.slice(RK4_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
