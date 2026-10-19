/**
 * ザ・マスクドライダーEXP vol.1 RK-043〜RK-063（ライオトルーパー〜仮面ライダー龍騎）のカード固有の効果（cardSpec RK3-043-063 の監査）。
 *
 * - `tryRk3CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk3::cardId::name`。NC・RC・「ラッシュしたとき」・「撃破されて捨札になったとき」等）。
 * - `tryResolveRk3Choice` / `trySkipRk3Choice` / `tryConfirmRk3Choice`: このモジュールが開いた選択の解決。撃破・パワーゾーンに置く選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - 常時の効果（バトルの BP・バトルエリアに出られない・敵軍のラッシュ・裁鬼のバトルの数字）は、それぞれの処理の場所から呼ぶ。
 * 構成は rules/rk/rk2UnitEffects.ts と同じ。
 */
import { hasAutoBattleEntryOnRushNote } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addTurnRestrictionModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect, cardNotSelectableByOpponent } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { grantSp1OnPlayer, patchPlayer } from "../playerPatches";
import { markBattleBlocked } from "../turnModifiers";
import { battlePositionOneBased } from "../fractionalSp";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "./rk1Features";
import { rk1OngekiMarked } from "./rk1NamedEffects";
import { rk11KyosukeTreatsAsWritten } from "./rk11Fields";
import { rk2KamenRiderRushDiscardable, rk2NeedsKamenRiderRushDiscard } from "./rk2UnitEffects";
import { beginChikaraBaton } from "../legend1/set4NamedEffects";
import { NO_ATTACK_THIS_TURN_RESTRICTION } from "../legend1/set5AuditFixes";
import { noEntryOnRushTurn, unconditionalNoEntryText } from "../restrictions";
import { resolveBattlePending } from "../operationCounters";
import { errataBattleEntryBlocked } from "../errataCardEffects";
import { applyDestroyOnEnterBattle } from "../destroyOnEnterBattle";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK3_KEYWORD_PREFIX = "rk3::";

export function isRk3ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 選んだところで確定できる選択（RK-055「好きな数選び」）か。 */
export function canConfirmRk3Choice(pending: PendingEffectChoice): boolean {
  return pending.effectId in CHOICE_CONFIRMERS && (pending.selectedInstanceIds?.length ?? 0) > 0;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk3Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk3Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 選んだところで確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk3Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
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

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function findField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): { zone: "battle" | "rush"; card: CardInstance } | undefined {
  for (const zone of ["battle", "rush"] as const) {
    const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

function featuresOf(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  return unitFeatures(state, ownerId, card);
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

/** 敵軍の効果で選べる敵軍ユニット（「相手に選ばれない」等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

/** 撃破する（場を離れるときの応答・撃破の誘発は applyUnitLeave に任せる）。 */
function destroy(state: GameState, instanceId: string, phasePlayerId: PlayerId): GameState {
  const leave = applyUnitLeave(state, instanceId, "discard", phasePlayerId);
  return "error" in leave ? state : leave.state;
}

// ---------------------------------------------------------------------------
// RK-044 ライオトルーパー【1万人ライダー部隊】
// 「敵軍ターン中、これが撃破されて捨札になったとき、自軍捨札に「ライオトルーパー」のユニットカードが10枚以上あれば、それをすべて手札に加える。」
// （atwiki/page-204）。撃破されて捨札になった時点で数えるので、これ自身も数に入る。撃破ではない捨札（イエローオウル）では発動しない
// （grnrngr/faq-rider-1 RK-044 Q1）。DSL の on_destroy（rules/leaveEffects.ts resolveAfterDiscardDestroyEffects）から呼ばれる。

const LIO_TROOPER_NAME = "ライオトルーパー";
const LIO_TROOPER_COUNT = 10;

function applyTenThousandRiders(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId === ctx.playerId) return { state, detail: "rk044:own_turn" };
  const p = state.players[ctx.playerId];
  const ids = p.discard
    .filter((c) => isUnitCard(state, c.cardId) && cardName(state.definitions, c.cardId) === LIO_TROOPER_NAME)
    .map((c) => c.instanceId);
  if (ids.length < LIO_TROOPER_COUNT) return { state, detail: "rk044:not_enough" };
  const moving = new Set(ids);
  const next = patchPlayer(state, ctx.playerId, (pl) => ({
    ...pl,
    discard: pl.discard.filter((c) => !moving.has(c.instanceId)),
    hand: [...pl.hand, ...pl.discard.filter((c) => moving.has(c.instanceId)).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
  return { state: next, detail: `rk044:to_hand:${ids.length}` };
}

// ---------------------------------------------------------------------------
// RK-047 仮面ライダー轟鬼【音撃斬・雷電激震】（NC）
// 「敵軍バトルエリアからユニットを1体選ぶ。そして、選んだユニットの必要パワーの数字より1つ多い数だけ自軍コマンドをホールドしてもよい。
//  そうしたとき、選んだユニットを撃破する。このとき、これはアタックすることができない。」（atwiki/page-219）
// RK-048 斬鬼（rules/legend1/set5AuditFixes.ts）と同じ手順で、リリースのかわりにリリース状態のコマンドを1枚ずつ選んでホールドする。
// ホールドしなかったときは撃破せず、アタックの制限もない（「このとき」は撃破したときの意）。

export const TODOROKI_TARGET_EFFECT_ID = "rk047_raiden_target";
export const TODOROKI_HOLD_EFFECT_ID = "rk047_raiden_hold";

function applyTodoroki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].battle
    .filter((c) => isUnitCard(state, c.cardId) && selectableEnemy(state, ctx.playerId, "RK-047", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk047:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-047"),
      effectId: TODOROKI_TARGET_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: TODOROKI_TARGET_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[TODOROKI_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const target = state.players[opponent(playerId)].battle.find((c) => c.instanceId === instanceId);
  if (!target) return { error: "invalid_target" };
  const need = parsePowerCost(getDefinition(state.definitions, target.cardId)?.powerCost) + 1;
  const released = state.players[playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-047", `${TODOROKI_TARGET_EFFECT_ID}:${target.cardId}`);
  if (!Number.isFinite(need) || released.length < need) return { state: proceed(close(state, pending), pending), log };
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: TODOROKI_HOLD_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: released,
        selectedInstanceIds: [],
        selectCount: need,
        optional: true,
        rk3Meta: { target: instanceId, need },
      },
    },
    log,
  };
};

CHOICE_RESOLVERS[TODOROKI_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const need = pending.rk3Meta?.need ?? 1;
  const log = logFor(state, playerId, "RK-047", `${TODOROKI_HOLD_EFFECT_ID}:${instanceId}`);
  if (selected.length < need) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId), selectedInstanceIds: selected },
      },
      log,
    };
  }
  const ids = new Set(selected);
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (ids.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
  }));
  if (pending.sourceInstanceId) {
    next = patchPlayer(next, playerId, (p) => addTurnRestrictionModifier(p, pending.sourceInstanceId!, NO_ATTACK_THIS_TURN_RESTRICTION));
  }
  next = close(next, pending);
  const targetId = pending.rk3Meta?.target;
  if (targetId) next = destroy(next, targetId, pending.phasePlayerId);
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[TODOROKI_HOLD_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-049 仮面ライダー勝鬼【風牙】（NC）
// 「「SP1」相手は自分自身のラッシュエリアからユニットを1体選ぶ。このターン、このユニットは、相手の選んだユニットにアタックできる。」
// （atwiki/page-221）。「SP1」のあとの部分は RS-213 オーイエロー【炸裂超力バトン】と同じ文言なので同じ処理（set4NamedEffects.ts）を使う。
// 相手が自分のユニットを選ぶので「相手に選ばれない」は妨げない（grnrngr/faq-rider-1 RK-057 Q）。

function applyFuga(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !state.players[ctx.playerId].battle.some((c) => c.instanceId === id)) return { state, detail: "rk049:no_unit" };
  const withSp = patchPlayer(state, ctx.playerId, (p) => grantSp1OnPlayer(p, id, state.definitions));
  const opened = beginChikaraBaton(withSp, ctx);
  return { state: opened ?? withSp, detail: opened ? "rk049:fuga" : "rk049:sp1_only" };
}

// ---------------------------------------------------------------------------
// RK-050 仮面ライダー裁鬼【音撃斬・閻魔裁き】（NC）
// 「「SP1」これがアタックするとき、「BP」「必要パワーの数字」「ナンバーの数字」のうちどれか1つを選び、お互いにその数字でバトルする。
//  ただし、ナンバーの数字は相手のユニットがナンバーに数字を持っていなければ選べない。」（atwiki/page-222）
// NC が成立したターン、このユニットがアタックしたバトルの解決の直前（カウンター等の応答のあと。faq-card-1 RS-018 Q3 の順）に数字を選ぶ。
// 「必要パワーの数字」は「4+」「7-」等の記号を除いた数字（RK-038 と同じ）。

export const SABAKI_EFFECT_ID = "rk050_enma_sabaki";
const SABAKI_RULE = "rk050_enma_sabaki_active";
type SabakiMode = NonNullable<PendingBattle["rk050Mode"]>;
const SABAKI_MODES: readonly SabakiMode[] = ["bp", "power_cost", "number"];

function applySabaki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !state.players[ctx.playerId].battle.some((c) => c.instanceId === id)) return { state, detail: "rk050:no_unit" };
  const withSp = patchPlayer(state, ctx.playerId, (p) => grantSp1OnPlayer(p, id, state.definitions));
  return { state: addTurnPayload(withSp, ctx.playerId, SABAKI_RULE, "RK-050", { instanceId: id }), detail: "rk050:active" };
}

function numericNumber(state: GameState, cardId: string): number | undefined {
  const cn = getDefinition(state.definitions, cardId)?.comboNumber;
  return typeof cn === "number" && Number.isFinite(cn) ? cn : undefined;
}

function battleDefender(state: GameState, pending: PendingBattle): CardInstance | undefined {
  const id = pending.substituteInstanceId ?? pending.defenderInstanceId;
  for (const pid of ["player1", "player2"] as const) {
    const found = findField(state, pid, id);
    if (found) return found.card;
  }
  return undefined;
}

/**
 * バトルの解決の直前（rules/operationCounters.ts resolveBattlePendingCore）: 裁鬼のアタックなら数字の選択を開く。
 * 開いたら選択を開いた state を返す（バトルは選択のあとに解決する）。対象外なら null。
 */
export function tryOpenRk3BattleChoice(state: GameState, pending: PendingBattle): GameState | null {
  if (pending.rk050Mode || pending.effectBattle) return null;
  const attackerOwner = pending.attackerPlayerId;
  const attacker = state.players[attackerOwner].battle.find((c) => c.instanceId === pending.attackerInstanceId);
  if (!attacker || attacker.cardId !== "RK-050") return null;
  if (!turnPayloads<{ instanceId: string }>(state.players[attackerOwner], SABAKI_RULE).some((p) => p.instanceId === attacker.instanceId)) return null;
  const defender = battleDefender(state, pending);
  if (!defender) return null;
  const modes = SABAKI_MODES.filter((m) => m !== "number" || numericNumber(state, defender.cardId) !== undefined);
  return openEffectChoice(
    { ...state, pendingBattle: undefined },
    {
      ...base({ playerId: attackerOwner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: attacker.instanceId }, "RK-050"),
      effectId: SABAKI_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [...modes],
      selectCount: 1,
      optional: false,
      rk3Meta: { battle: pending },
    },
  );
}

CHOICE_RESOLVERS[SABAKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const battle = pending.rk3Meta?.battle;
  if (!battle) return { error: "invalid_choice" };
  const closed = close(state, pending);
  const resolved = resolveBattlePending(closed, { ...battle, rk050Mode: instanceId as SabakiMode });
  return { state: proceed(resolved.state, pending), log: logFor(state, playerId, "RK-050", `${SABAKI_EFFECT_ID}:${instanceId}`) };
};

/** 裁鬼の数字でバトルするときの両者の値（rules/operationCounters.ts）。「BP」を選んだとき・対象外なら null。 */
export function rk3BattleValues(state: GameState, pending: PendingBattle): { attacker: number; defender: number } | null {
  const mode = pending.rk050Mode;
  if (!mode || mode === "bp") return null;
  const attacker = state.players[pending.attackerPlayerId].battle.find((c) => c.instanceId === pending.attackerInstanceId);
  const defender = battleDefender(state, pending);
  if (!attacker || !defender) return null;
  if (mode === "number") {
    const a = numericNumber(state, attacker.cardId);
    const d = numericNumber(state, defender.cardId);
    if (a === undefined || d === undefined) return null;
    return { attacker: a, defender: d };
  }
  const a = parsePowerCost(getDefinition(state.definitions, attacker.cardId)?.powerCost);
  const d = parsePowerCost(getDefinition(state.definitions, defender.cardId)?.powerCost);
  return { attacker: Number.isFinite(a) ? a : 0, defender: Number.isFinite(d) ? d : 0 };
}

// ---------------------------------------------------------------------------
// RK-051 仮面ライダー鋭鬼【音撃打・必殺必中】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに
//  勝っても撃破される」と書かれた敵軍ユニットを1体選び撃破する。」（atwiki/page-223）
// テキストのどこかにその文言があれば対象（能力の説明文の中でもよい。grnrngr/faq-rider-1 RK-051 Q1 の鋭鬼・サンジェル）。
// RK-019 音撃・RK-224 京介変身体【サポート】で「…と書かれているかのように扱う」ユニットも対象にする（RK-224 はユーザー決定 2026-10-19 の
// RM-008 と同じ扱い。docs/rules/README.md §5.7 o）。

export const EIKI_EFFECT_ID = "rk051_hissatsu_hicchu";
const WIN_BUT_DESTROYED_PHRASE = "これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される";

function normPhrase(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").replace(/「(SP\d+)」/g, "$1");
}

function hasWinButDestroyedText(state: GameState, cardId: string): boolean {
  return normPhrase(getDefinition(state.definitions, cardId)?.text ?? "").includes(normPhrase(WIN_BUT_DESTROYED_PHRASE));
}

function applyEiki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "rk051:enemy_turn" };
  const ids = state.players[opponent(ctx.playerId)].battle
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        (hasWinButDestroyedText(state, c.cardId) ||
          rk1OngekiMarked(state, ctx.playerId, c.instanceId) ||
          rk11KyosukeTreatsAsWritten(state, opponent(ctx.playerId), c.instanceId)) &&
        selectableEnemy(state, ctx.playerId, "RK-051", c),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk051:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-051"),
      effectId: EIKI_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "discard",
    }),
    detail: EIKI_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-053 仮面ライダーガタックMF【ガタックバルカン】
// 「これが自軍バトルエリアにある間、敵軍Sユニットがラッシュされたとき、自軍パワーゾーンのダメージ以外のカードを1枚選び捨札にしてもよい。
//  そうしたとき、そのユニットは、ターンが終わるまでバトルエリアに出られない。」（atwiki/page-170）
// ラッシュが成立したあとの誘発なので、直接バトルエリアに置かれたユニット（RS-090）はそのまま（Q1）。置き換わったユニットには効かない（Q2）。

export const GATACK_VULCAN_EFFECT_ID = "rk053_gatack_vulcan";

/**
 * 「ラッシュされたとき」（rules/onRushUnitEffects.ts applyPassiveRushTriggers・直接バトルエリアに出たとき）。
 * 「ラッシュするとき可能ならバトルエリアに置く」ユニットは、バトルエリアに置いたあと（core/applyAction.ts applyAutoBattleEntryOnRush から
 * afterAutoEntry=true で）発動する（Q1「この時点で…すでにバトルエリアに置かれている」）。
 */
export function openRk3OnEnemyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  afterAutoEntry = false,
): GameState {
  const defenderId = opponent(rusherPlayerId);
  if (!state.players[defenderId].battle.some((c) => c.cardId === "RK-053")) return state;
  const found = findField(state, rusherPlayerId, rushedInstanceId);
  const rushed = found?.card;
  if (!rushed || !isUnitCard(state, rushed.cardId) || !rk1IsSmallNow(state, rushed)) return state;
  if (!afterAutoEntry && found.zone === "rush" && hasAutoBattleEntryOnRushNote(rushed.cardId)) return state;
  const power = state.players[defenderId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (power.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId: defenderId, phasePlayerId, sourceInstanceId: rushedInstanceId }, "RK-053"),
    effectId: GATACK_VULCAN_EFFECT_ID,
    kind: "select_power",
    validInstanceIds: power,
    selectCount: 1,
    optional: true,
    rk3Meta: { target: rushedInstanceId },
  });
}

CHOICE_RESOLVERS[GATACK_VULCAN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, { instanceId: card.instanceId, cardId: card.cardId }],
  }));
  const target = pending.rk3Meta?.target;
  if (target) next = patchPlayer(next, opponent(playerId), (p) => markBattleBlocked(p, target));
  return { state: proceed(close(next, pending), pending), log: logFor(state, playerId, "RK-053", `${GATACK_VULCAN_EFFECT_ID}:${card.cardId}`) };
};
CHOICE_SKIPPERS[GATACK_VULCAN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-054 仮面ライダーガタックRF【ライダーカッティング】
// 「これをラッシュしたとき、敵軍バトルエリアから、BPの合計が6000になるように隣り合う2体のSユニットを選び撃破する。」（atwiki/page-171）
// 隣り合うのはバトルエリアの並び（RK-034・RK-037 と同じくビークルも1枠に数える）。BP は今の BP。1体目に選べるのは相手のいるユニットだけ。

export const RIDER_CUTTING_FIRST_EFFECT_ID = "rk054_rider_cutting_first";
export const RIDER_CUTTING_SECOND_EFFECT_ID = "rk054_rider_cutting_second";
const RIDER_CUTTING_SUM = 6000;

function cuttingPairs(state: GameState, playerId: PlayerId): Array<[string, string]> {
  const enemyId = opponent(playerId);
  const battle = state.players[enemyId].battle;
  const ok = (c: CardInstance | undefined): c is CardInstance =>
    !!c && isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "RK-054", c);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i + 1 < battle.length; i++) {
    const a = battle[i];
    const b = battle[i + 1];
    if (!ok(a) || !ok(b)) continue;
    if (effectiveBp(state, enemyId, a) + effectiveBp(state, enemyId, b) === RIDER_CUTTING_SUM) pairs.push([a.instanceId, b.instanceId]);
  }
  return pairs;
}

function applyRiderCutting(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pairs = cuttingPairs(state, ctx.playerId);
  if (pairs.length === 0) return { state, detail: "rk054:no_targets" };
  const ids = [...new Set(pairs.flat())];
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-054"),
      effectId: RIDER_CUTTING_FIRST_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: RIDER_CUTTING_FIRST_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[RIDER_CUTTING_FIRST_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const partners = cuttingPairs(state, playerId)
    .filter((p) => p.includes(instanceId))
    .map((p) => (p[0] === instanceId ? p[1] : p[0]));
  const log = logFor(state, playerId, "RK-054", `${RIDER_CUTTING_FIRST_EFFECT_ID}:${instanceId}`);
  if (partners.length === 0) return { state: proceed(close(state, pending), pending), log };
  return {
    state: { ...state, pendingEffectChoice: { ...pending, effectId: RIDER_CUTTING_SECOND_EFFECT_ID, validInstanceIds: partners, rk3Meta: { target: instanceId } } },
    log,
  };
};

CHOICE_RESOLVERS[RIDER_CUTTING_SECOND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const first = pending.rk3Meta?.target;
  let next = close(state, pending);
  if (first) next = destroy(next, first, pending.phasePlayerId);
  if (findField(next, opponent(playerId), instanceId)) next = destroy(next, instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-054", `${RIDER_CUTTING_SECOND_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-055 仮面ライダーパンチホッパー【ライダーパンチ】（NC）
// 「敵軍バトルエリアからSユニットを好きな数選び、ラッシュエリアに戻してもよい。」（atwiki/page-172）
// 1体ずつ選び、選んだところで確定する（0体なら skip）。ライドしているユニットはライドしたまま戻る（grnrngr/faq-rider-1 RK-026 Q と同じ）。

export const RIDER_PUNCH_EFFECT_ID = "rk055_rider_punch";

function applyRiderPunch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-055", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk055:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-055"),
      effectId: RIDER_PUNCH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: ids.length,
      optional: true,
    }),
    detail: RIDER_PUNCH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[RIDER_PUNCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
        selectedInstanceIds: [...(pending.selectedInstanceIds ?? []), instanceId],
      },
    },
    log: logFor(state, playerId, "RK-055", `${RIDER_PUNCH_EFFECT_ID}:pick:${instanceId}`),
  };
};
CHOICE_SKIPPERS[RIDER_PUNCH_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[RIDER_PUNCH_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const picked = pending.selectedInstanceIds ?? [];
  if (picked.length === 0) return { error: "no_selection" };
  const enemyId = opponent(playerId);
  const moving = new Set<string>();
  for (const id of picked) {
    const unit = state.players[enemyId].battle.find((c) => c.instanceId === id);
    if (!unit) continue;
    moving.add(id);
    if (unit.mountedOnInstanceId) moving.add(unit.mountedOnInstanceId);
  }
  const moved = patchPlayer(state, enemyId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => !moving.has(c.instanceId)),
    rush: [...p.rush, ...p.battle.filter((c) => moving.has(c.instanceId))],
  }));
  return { state: proceed(close(moved, pending), pending), log: logFor(state, playerId, "RK-055", `${RIDER_PUNCH_EFFECT_ID}:${picked.length}`) };
};

// ---------------------------------------------------------------------------
// RK-057 仮面ライダーザビーRF【ライダースティング】
// 「これをラッシュしたとき、敵軍バトルエリアからBP4000以上のSユニットを1体選び持ち主のパワーゾーンに置く。」（atwiki/page-161）。強制。

export const RIDER_STING_EFFECT_ID = "rk057_rider_sting";

function applyRiderSting(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        rk1IsSmallNow(state, c) &&
        effectiveBp(state, enemyId, c) >= 4000 &&
        selectableEnemy(state, ctx.playerId, "RK-057", c),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk057:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-057"),
      effectId: RIDER_STING_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "power",
    }),
    detail: RIDER_STING_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-056 仮面ライダーザビーMF【ZECT隊長】
// 「これが自軍バトルエリアにある間、自軍ターン中、特徴「戦闘員」を持つ自軍ユニットは、バトルエリアで4番目に並んだとき「SP1」になる。」
// （atwiki/page-160）。並び順は分数 SP と同じ数え方（rules/fractionalSp.ts battlePositionOneBased）。

/** SP の下限（rules/legend2/fieldEffects.ts legend2EffectiveSp から呼ぶ）。 */
export function rk3SpFloor(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (state.activePlayer !== playerId) return 0;
  const battle = state.players[playerId].battle;
  if (!battle.some((c) => c.cardId === "RK-056")) return 0;
  if (!isUnitCard(state, instance.cardId) || battlePositionOneBased(battle, instance.instanceId) !== 4) return 0;
  return featuresOf(state, playerId, instance).includes("戦闘員") ? 1 : 0;
}

// ---------------------------------------------------------------------------
// RK-059 ゼクトルーパー【フォーメーションα】
// 「これが自軍バトルエリアにある間、敵軍ターン中、カードに表記された本来のナンバーが自軍バトルエリアの「ゼクトルーパー」の数と同じ
//  敵軍Sユニットは、バトルエリアに出られない。」（atwiki/page-159）

/** バトルエリアに出られないか（rules/restrictions.ts canMoveUnitToBattle から呼ぶ）。 */
export function rk3BattleEntryBlocked(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  if (state.activePlayer !== playerId) return false;
  const enemyBattle = state.players[opponent(playerId)].battle;
  const troopers = enemyBattle.filter((c) => isUnitCard(state, c.cardId) && cardName(state.definitions, c.cardId) === "ゼクトルーパー").length;
  if (troopers === 0) return false;
  if (!isUnitCard(state, unit.cardId) || !rk1IsSmallNow(state, unit)) return false;
  return numericNumber(state, unit.cardId) === troopers;
}

// ---------------------------------------------------------------------------
// RK-061 仮面ライダー電王RF【一本釣り】（RC）
// 「敵軍パワーゾーンのダメージ以外のカードから、Sユニットのカードを1枚選び、敵軍バトルエリアに出してもよい。このとき出したユニットの
//  効果は発動しない。」（atwiki/page-166）
// 正しく処理できないカード（「ラッシュしたターンにバトルエリアに出られない」等）は選べない（Q1）。アナザーアギトは相手のラッシュエリアに
// 「仮面ライダー」がいるときだけ選べ、相手がそれを1体捨札にしてから出る（Q2）。オモテ向きの「相手に選ばれない」カードは選べない（エンジンの現状どおり）。

export const IPPON_ZURI_EFFECT_ID = "rk061_ippon_zuri";
export const IPPON_ZURI_DISCARD_EFFECT_ID = "rk061_ippon_zuri_discard";

function kamenRushIds(state: GameState, ownerId: PlayerId): string[] {
  return state.players[ownerId].rush.filter((c) => rk2KamenRiderRushDiscardable(state.definitions, c.cardId)).map((c) => c.instanceId);
}

function ipponZuriCandidates(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].power
    .filter((c) => {
      if (c.faceDown) return false;
      const def = getDefinition(state.definitions, c.cardId);
      if (!def || def.type !== "unit" || unitSizeOf(state.definitions, c) !== "S") return false;
      if (cardNotSelectableByOpponent(c.cardId)) return false;
      if (noEntryOnRushTurn(c.cardId) || unconditionalNoEntryText(def)) return false;
      // RK-140 電王LF の※（必要パワーの数字が2以下のユニットはバトルエリアに出られない）があれば選べない（grnrngr/faq-rider-2 RK-140 Q）。
      if (errataBattleEntryBlocked(state, enemyId, c)) return false;
      if (rk2NeedsKamenRiderRushDiscard(c.cardId) && kamenRushIds(state, enemyId).length === 0) return false;
      return true;
    })
    .map((c) => c.instanceId);
}

function applyIpponZuri(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = ipponZuriCandidates(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "rk061:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RK-061"),
      effectId: IPPON_ZURI_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: IPPON_ZURI_EFFECT_ID,
  };
}

/** 敵軍パワーゾーンのカードを、効果を発動させずに敵軍バトルエリアに置く。 */
function placeFromPower(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const card = state.players[ownerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    battle: [...p.battle, { instanceId: card.instanceId, cardId: card.cardId }],
  }));
}

CHOICE_RESOLVERS[IPPON_ZURI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const log = logFor(state, playerId, "RK-061", `${IPPON_ZURI_EFFECT_ID}:${card.cardId}`);
  if (rk2NeedsKamenRiderRushDiscard(card.cardId)) {
    const ids = kamenRushIds(state, enemyId);
    if (ids.length === 0) return { state: proceed(close(state, pending), pending), log };
    return {
      state: {
        ...state,
        activePlayer: enemyId,
        pendingEffectChoice: {
          ...pending,
          playerId: enemyId,
          effectId: IPPON_ZURI_DISCARD_EFFECT_ID,
          kind: "select_unit",
          validInstanceIds: ids,
          optional: false,
          rk3Meta: { target: instanceId },
        },
      },
      log,
    };
  }
  // 出したユニットの効果は発動しないが、「※これはバトルエリアに出たとき撃破される」（RK-142 モモタロス等）では撃破される
  // （grnrngr/faq-rider-2 RK-142 Q1「その「RK-142 モモタロス」は、自身の持つ効果…により撃破されます」・Q2）。
  let next = placeFromPower(close(state, pending), enemyId, instanceId);
  next = applyDestroyOnEnterBattle(next, enemyId, instanceId, pending.phasePlayerId).state;
  return { state: proceed(next, pending), log };
};

CHOICE_SKIPPERS[IPPON_ZURI_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[IPPON_ZURI_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unit = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, { instanceId: unit.instanceId, cardId: unit.cardId }],
  }));
  const target = pending.rk3Meta?.target;
  if (target) next = placeFromPower(next, playerId, target);
  return { state: proceed(close(next, pending), pending), log: logFor(state, playerId, "RK-061", `${IPPON_ZURI_DISCARD_EFFECT_ID}:${unit.cardId}`) };
};

// ---------------------------------------------------------------------------
// ユニットがバトルエリアに出たとき（rules/combo.ts の進入効果から呼ぶ）
// RK-063 仮面ライダー龍騎（スターター版）は RK-033 と同じテキスト「【ドラゴンライダーキック】特徴「ドラゴン」を持つユニットから
// コンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」」（atwiki/page-178）。rules/rk/rk2UnitEffects.ts で RK-033 と同じに扱う。

// ---------------------------------------------------------------------------
// バトルの BP（rules/namedUnitEffects.ts battleAttackerBpBonus・battleDefenderBp から呼ぶ）
// - RK-052 仮面ライダー弾鬼【音撃打・破砕細石】「敵軍バトルエリアに特徴「メカ」を持つユニットがなければ、これはBP4000以上のSユニットと
//   バトルするとき、BP+5000される」（atwiki/page-224）。相手の BP は今の BP（ライドで 4000 以上でもよい。grnrngr/faq-rider-1 RK-052 Q1）。
//   ビークルはユニットではないので「メカ」に数えない。
// RK-060 デンライナーゴウカ【戦闘モード】（「必要パワーの数字に「－」のあるユニットにアタックするときBP+5000」）は
// rules/legend2/battleEffects.ts legend2AttackerBpBonus が効果名で処理する（DSL はそれと重ならないよう rk3 キーワードにした）。

function dankiBonus(state: GameState, ownerId: PlayerId, self: CardInstance, opponentOwner: PlayerId, other: CardInstance): number {
  if (self.cardId !== "RK-052") return 0;
  const enemyBattle = state.players[opponent(ownerId)].battle;
  if (enemyBattle.some((c) => isUnitCard(state, c.cardId) && featuresOf(state, opponent(ownerId), c).includes("メカ"))) return 0;
  if (!isUnitCard(state, other.cardId) || !rk1IsSmallNow(state, other)) return 0;
  return effectiveBp(state, opponentOwner, other) >= 4000 ? 5000 : 0;
}

/** アタックしたユニットの BP に加える値。 */
export function rk3AttackerBattleBonus(state: GameState, pending: PendingBattle): number {
  const attacker = findField(state, pending.attackerPlayerId, pending.attackerInstanceId)?.card;
  const defender = battleDefender(state, pending);
  if (!attacker || !defender) return 0;
  const defenderOwner = findField(state, pending.defenderPlayerId, defender.instanceId) ? pending.defenderPlayerId : pending.attackerPlayerId;
  return dankiBonus(state, pending.attackerPlayerId, attacker, defenderOwner, defender);
}

/** アタックされたユニット（かわりにバトルするユニットを含む）の BP に加える値。 */
export function rk3DefenderBattleBonus(state: GameState, pending: PendingBattle, defenderOwner: PlayerId, defender: CardInstance): number {
  const attacker = findField(state, pending.attackerPlayerId, pending.attackerInstanceId)?.card;
  if (!attacker) return 0;
  return dankiBonus(state, defenderOwner, defender, pending.attackerPlayerId, attacker);
}

// ---------------------------------------------------------------------------
// 起点

const RK3_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-044::ichiman_rider_butai": applyTenThousandRiders,
  "RK-047::raiden_gekishin": applyTodoroki,
  "RK-049::fuga": applyFuga,
  "RK-050::enma_sabaki": applySabaki,
  "RK-051::hissatsu_hicchu": applyEiki,
  "RK-054::rider_cutting": applyRiderCutting,
  "RK-055::rider_punch": applyRiderPunch,
  "RK-057::rider_sting": applyRiderSting,
  "RK-061::ippon_zuri": applyIpponZuri,
  // RK-052【音撃打・破砕細石】はバトルの BP（rk3AttackerBattleBonus・rk3DefenderBattleBonus）、RK-060【戦闘モード】は legend2AttackerBpBonus、
  // RK-053【ガタックバルカン】は敵軍のラッシュ（openRk3OnEnemyRush）、RK-059【フォーメーションα】は進入制限（rk3BattleEntryBlocked）で処理する。
  "RK-052::hasai_sazare": (s) => ({ state: s, detail: "rk052:passive" }),
  "RK-053::gatack_vulcan": (s) => ({ state: s, detail: "rk053:passive" }),
  "RK-059::formation_alpha": (s) => ({ state: s, detail: "rk059:passive" }),
  "RK-060::sentou_mode": (s) => ({ state: s, detail: "rk060:passive" }),
};

export function tryRk3CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK3_KEYWORD_PREFIX)) return null;
  const handler = RK3_KEYWORDS[keyword.slice(RK3_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
