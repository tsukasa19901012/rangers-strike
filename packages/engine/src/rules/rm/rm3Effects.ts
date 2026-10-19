/**
 * スペシャルメタルエディション RM-043〜RM-062（鳥忍 カラス天狗〜テントリーナ）のカード固有の効果（cardSpec RM3-043-062 の監査）。
 *
 * - `tryRm3CardEffect`: DSL の grant_keyword から呼ばれる起点（`rm3::cardId::name`。ラッシュしたとき・RC・NC・JC）。
 * - `tryResolveRm3Choice` / `trySkipRm3Choice` / `tryConfirmRm3Choice`: このモジュールが開いた選択の解決。
 * - `tryCompleteRm3HoldChoice`: コマンドの支払い（effect_hold）でホールドを選び終えたときの続き（RM-045。rules/pendingChoices.ts）。
 * - `tryRm3OnEnterBattle`: RM-047・RM-053・RM-054（ライドされてバトルエリアに出たビークル。rules/combo.ts）。
 * - `rm3GunGibsonOnEntry`: RM-045 ※（ガンギブソンからコンビネーションする「メカ」の S ユニットが、ライドしたまま進んだとき（core/applyAction.ts）・ライドせずに出たとき（rules/battleEntry.ts）の RC）。
 * - `applyRm3AfterAction`: RM-059 異次元調達屋カブト（WB の自軍 S ユニットがバトルエリアに出たとき。applyAction の後処理）。
 * - `openRm3Tentrina` / `resolveRm3Tentrina` / `skipRm3Tentrina`: RM-062 テントリーナ（アタックされたとき。core/applyAction.ts）。
 * 継続効果の判定（RM-051・RM-052・RM-058）は rules/rm/rm3Fields.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, effectiveCommandCategories, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { cardNotSelectableByOpponent } from "../../keywords/effectTargetability";
import { breakerBlocksEffectTarget, cardHasBattleKeyword, prepareWingUnitReturnedToRush } from "../../keywords/battleKeywords";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { buildEffectHoldPayment } from "../commandPayment";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { riddenVehicleGrantsResist, riddenVehicleGrantsScrum } from "../legend1/set7NamedEffectsB";
import { set8BGrantsResist } from "../legend1/set8NamedEffectsB";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rk10AntlordGrantsResist } from "../rk/rk10Fields";
import {
  type BaseCtx,
  type ChoiceOutcome,
  base,
  close,
  confirmChoice,
  ctxBase,
  effectRushPicked,
  fieldCards,
  fieldUnits,
  findField,
  genericPick,
  isUnitCard,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  simpleSkip,
  skipLog,
  stripForZone,
  zoneOfField,
} from "./rm1Effects";
import { rm1GrantsScrum } from "./rm1Fields";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { rm3AreaHasName, rm3GrantsResist } from "./rm3Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
/** コマンドの支払い（effect_hold）で選ぶ選択の続き（resolve_effect_choice では答えない）。 */
const HOLD_COMPLETERS: Record<string, (state: GameState, pending: PendingEffectChoice, holdIds: string[]) => GameState> = {};

export const RM3_KEYWORD_PREFIX = "rm3::";

export function isRm3ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

export function tryResolveRm3Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipRm3Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function canConfirmRm3Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

export function tryConfirmRm3Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRm3Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** コマンドの支払いでホールドするコマンドを選び終えた（rules/pendingChoices.ts completeEffectHoldChoice）。対象外なら null。 */
export function tryCompleteRm3HoldChoice(state: GameState, playerId: PlayerId, commandInstanceIds: string[]): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const completer = HOLD_COMPLETERS[pending.effectId];
  if (!completer) return null;
  const held = holdCommands(close(state, pending), playerId, commandInstanceIds);
  return { state: completer(held, pending, commandInstanceIds), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:hold`) };
}

function holdCommands(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (ids.includes(c.instanceId) && !c.commandHeld ? { ...c, commandHeld: true } : c)) }));
}

function releasedCommands(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
}

/** ホールドするコマンドを選ぶ選択とコマンドの支払いを開く（候補がちょうど n なら選ばずにホールドして続ける）。 */
function holdThen(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], n: number, extra: Partial<PendingEffectChoice> = {}): GameState {
  const choice: PendingEffectChoice = {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "select_commands",
    validInstanceIds: ids,
    selectCount: n,
    selectedInstanceIds: [],
    optional: false,
    commandAction: "hold",
    commandFilter: "released",
    ...extra,
  };
  if (ids.length <= n) return HOLD_COMPLETERS[effectId]!(holdCommands(state, ctx.playerId, ids), choice, ids);
  const opened = openEffectChoice(state, choice);
  const payment = buildEffectHoldPayment(opened);
  return payment ? { ...opened, pendingCommandPayment: payment } : opened;
}

function ownTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

function selectOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

/** 敵軍のゾーンのカードを選べるか（オモテ向きの「相手に選ばれない」カードは選べない。ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。 */
function selectableEnemyZoneCard(cardId: string): boolean {
  return !cardNotSelectableByOpponent(cardId);
}

function hasAnyCategory(cats: readonly string[], wanted: string[]): boolean {
  return cats.some((c) => wanted.includes(c));
}

/** 場のユニットの今のカテゴリ（場にあるゾーンで判定する）。 */
function fieldCategories(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  return unitEffectiveCategories(state, ownerId, card, zoneOfField(state, ownerId, card.instanceId) ?? "battle") as string[];
}

/** 場のユニットを、その場（バトル・ラッシュエリア）でホールド状態にする。 */
function holdFieldUnit(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
}

/** バトルエリアのユニット（ライドの組は組ごと）をラッシュエリアに戻す（ラッシュではない）。 */
function returnBattleUnitToRush(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const battle = state.players[ownerId].battle;
  const unit = battle.find((c) => c.instanceId === instanceId);
  if (!unit) return state;
  const group = new Set([instanceId, ...(unit.mountedOnInstanceId ? [unit.mountedOnInstanceId] : []), ...battle.filter((c) => c.mountedOnInstanceId === instanceId).map((c) => c.instanceId)]);
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => !group.has(c.instanceId)),
    rush: [...p.rush, ...p.battle.filter((c) => group.has(c.instanceId)).map((c) => (state.phase === "battle" ? prepareWingUnitReturnedToRush(c) : c))],
  }));
}

/** 場のユニットをホールドする選択の解決。 */
function holdPick(cardId: string, effectId: string): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = holdFieldUnit(close(state, pending), opponent(playerId), instanceId);
    return { state: proceed(next, pending), log: logFor(state, playerId, cardId, `${effectId}:${instanceId}`) };
  };
}

/** 敵軍の場のユニット・ビークルを持ち主のコマンドゾーンにホールド状態で置く選択の解決（置けなければ捨札。離場の処理を通しチェイスの機会を出す。R-KW-CHASE-01）。 */
function commandPick(cardId: string, effectId: string): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "command_held");
    return { state: proceed(next, pending), log: logFor(state, playerId, cardId, `${effectId}:${instanceId}`) };
  };
}

// ---------------------------------------------------------------------------
// RM-043 鳥忍 カラス天狗【3人1組】（ラッシュしたとき）
// 「自軍エリアの「鳥忍 カラス天狗」が3体以下なら、3体になるまで、自軍パワーゾーンのオモテ向きのカードか自軍コマンドゾーンのカードから「鳥忍 カラス天狗」の
//  カードを選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-851）
// 1枚ずつ選び、効果のラッシュで出す（R-RUSH-20・22。出したカラス天狗の【3人1組】も発動するので、3体になるまで続けて選べる）。自軍エリア（バトル・
// ラッシュエリア）の同じカード名のユニットが3体（これを含む）なら選べない。

const KARASU_EFFECT_ID = "rm043_sannin_ichikumi";

function karasuChoice(state: GameState, ctx: BaseCtx): PendingEffectChoice | null {
  const name = getDefinition(state.definitions, "RM-043")?.name;
  const p = state.players[ctx.playerId];
  const count = fieldUnits(state, ctx.playerId).filter((c) => sameCardName(getDefinition(state.definitions, c.cardId)?.name, name)).length;
  if (count >= 3) return null;
  const named = (c: CardInstance) => getDefinition(state.definitions, c.cardId)?.type === "unit" && sameCardName(getDefinition(state.definitions, c.cardId)?.name, name);
  const ids = [...p.power.filter((c) => !c.faceDown && named(c)), ...p.command.filter(named)].map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return selectOne(ctx, "RM-043", KARASU_EFFECT_ID, ids, true);
}

function applyKarasu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const choice = karasuChoice(state, ctxBase(ctx));
  if (!choice) return { state, detail: "rm043:no_targets" };
  return { state: openAfter(state, choice), detail: KARASU_EFFECT_ID };
}

CHOICE_RESOLVERS[KARASU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const zone = state.players[playerId].power.some((c) => c.instanceId === instanceId) ? "power" : "command";
  return { state: effectRushPicked(state, pending, playerId, instanceId, zone), log: logFor(state, playerId, "RM-043", `${KARASU_EFFECT_ID}:${zone}`) };
};
CHOICE_SKIPPERS[KARASU_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-044 ジャンパーソン【ジャンデジック】（RC）
// 「敵軍バトルエリアにある、特徴「男」または「女」を持たないSユニットを、すべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」
// （atwiki/page-878）。選ぶ効果ではない（「相手に選ばれない」ユニットも含む）。いまの特徴・サイズで見る。並び順に置き、コマンドゾーンが5枚になったら
// 残りは捨札。

function applyJandejiku(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      if (!isUnitCard(state, c.cardId) || !rk1IsSmallNow(state, c)) return false;
      const f = unitFeatures(state, enemyId, c);
      return !f.includes("男") && !f.includes("女");
    })
    .map((c) => c.instanceId);
  // 並び順に1体ずつ離場の処理を通す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。
  const next = sendFieldCardsToCommandHeld(state, enemyId, ids, ctx.phasePlayerId);
  return { state: next, detail: `rm044:${ids.length}` };
}

// ---------------------------------------------------------------------------
// RM-045 ガンギブソン
// ※「このユニットからコンビネーションする特徴「メカ」を持つSユニットは、ライドオフしなくてもＲＣの効果を発動できる。」（atwiki/page-887）
// 【ホーミングブリッド】（RC）「敵軍Sユニットの中から1体を、相手に選ばせてもよい（相手が選ぶたび、まだ相手に選ばれてない敵軍Sユニットがあれば、その中から
//  選びなおさせてもよい。ただし、自軍コマンドを1つホールドすること）。その後、相手が最終的に選んだ1体を撃破する。」
// 相手が自分自身のユニットを選ぶので「相手に選ばれない」ユニットも選べる（カード評価）。ブレイカーを持つユニットは選べない（R-KW-BREAKER-03「選ぶのが
// 自分…でも選べない」）。エリアを問わない。
// ※はライドしたまま進んだときも、ライドせずに出たときも RC の効果を発動する（ユーザー決定 2026-10-19「ライドせずに出ても発動する」。
// RK-120 サイドバッシャーと同じ。docs/rules/README.md §5.7 m）。ライドオフして発動したら2重には発動しない（RIDE_OFF_RC_MARK）。

const HOMING_EFFECT_ID = "rm045_homing_bullet";
const HOMING_PICK_EFFECT_ID = "rm045_homing_bullet_pick";
const HOMING_REPICK_EFFECT_ID = "rm045_homing_bullet_repick";
const HOMING_HOLD_EFFECT_ID = "rm045_homing_bullet_hold";

function homingCandidates(state: GameState, playerId: PlayerId, chosen: string[]): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && !chosen.includes(c.instanceId) && !breakerBlocksEffectTarget(state.definitions, c.cardId, "RM-045"))
    .map((c) => c.instanceId);
}

function applyHomingBullet(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (homingCandidates(state, ctx.playerId, []).length === 0) return { state, detail: "rm045:no_targets" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "RM-045", HOMING_EFFECT_ID)), detail: HOMING_EFFECT_ID };
}

/** 相手（敵軍）に、まだ選んでいない S ユニットから1体を選ばせる。 */
function homingPick(state: GameState, pending: PendingEffectChoice, me: PlayerId, chosen: string[], current?: string): GameState {
  const ids = homingCandidates(state, me, chosen);
  if (ids.length === 0) return current ? homingDestroy(state, pending, current) : proceed(state, pending);
  return openNext(state, pending, {
    ...base({ playerId: opponent(me), phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RM-045"),
    effectId: HOMING_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    rm3Meta: { chosen },
  });
}

function homingDestroy(state: GameState, pending: PendingEffectChoice, instanceId: string): GameState {
  const left = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
  return proceed("error" in left ? state : left.state, pending);
}

CHOICE_RESOLVERS[HOMING_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[HOMING_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[HOMING_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: homingPick(close(state, pending), pending, playerId, []), log: logFor(state, playerId, "RM-045", `${HOMING_EFFECT_ID}:confirm`) };
};

CHOICE_RESOLVERS[HOMING_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const me = opponent(playerId);
  const chosen = [...(pending.rm3Meta?.chosen ?? []), instanceId];
  const next = close(state, pending);
  const log = logFor(state, playerId, "RM-045", `${HOMING_PICK_EFFECT_ID}:${cardName(state.definitions, findField(state, playerId, instanceId)?.cardId ?? "")}`);
  if (homingCandidates(next, me, chosen).length > 0 && releasedCommands(next, me).length > 0) {
    return {
      state: openNext(next, pending, {
        ...confirmChoice({ playerId: me, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RM-045", HOMING_REPICK_EFFECT_ID),
        rm3Meta: { chosen, current: instanceId },
      }),
      log,
    };
  }
  return { state: homingDestroy(next, pending, instanceId), log };
};

CHOICE_RESOLVERS[HOMING_REPICK_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[HOMING_REPICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const current = pending.rm3Meta?.current;
  const next = close(state, pending);
  return { state: current ? homingDestroy(next, pending, current) : proceed(next, pending), log: skipLog(state, playerId, "RM-045", HOMING_REPICK_EFFECT_ID) };
};
CHOICE_CONFIRMERS[HOMING_REPICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdThen(close(state, pending), pendingBase(pending), "RM-045", HOMING_HOLD_EFFECT_ID, releasedCommands(state, playerId), 1, {
    resumeChoice: pending.resumeChoice,
    rm3Meta: pending.rm3Meta,
  });
  return { state: next, log: logFor(state, playerId, "RM-045", `${HOMING_REPICK_EFFECT_ID}:confirm`) };
};
HOLD_COMPLETERS[HOMING_HOLD_EFFECT_ID] = (state, pending) => homingPick(state, pending, pending.playerId, pending.rm3Meta?.chosen ?? [], pending.rm3Meta?.current);

/**
 * ライドしたまま進んだユニット・ライドせずに出たユニットが、ガンギブソンからコンビネーションする「メカ」の RC の S ユニットなら RC の効果を発動する。
 * 対象外なら null（ユーザー決定 2026-10-19「ライドせずに出ても発動する」）。
 */
export function rm3GunGibsonOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const battle = state.players[playerId].battle;
  const idx = battle.findIndex((c) => c.instanceId === instanceId);
  const unit = battle[idx];
  if (!unit || getDefinition(state.definitions, unit.cardId)?.comboNumber !== "RC") return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  if (!rk1IsSmallNow(state, unit) || !unitFeatures(state, playerId, unit).includes("メカ")) return null;
  // ライドして出たユニットは [ビークル, ユニット] の順に並ぶ。その前（1つ前の組のユニット）を見る。
  const start = unit.mountedOnInstanceId && battle[idx - 1]?.instanceId === unit.mountedOnInstanceId ? idx - 1 : idx;
  const prev = battle[start - 1];
  if (!prev || !isUnitCard(state, prev.cardId) || !isSameCardIdentity(prev.cardId, "RM-045")) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
  const rc = resolveRidingComboOnRideOff(marked, playerId, marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// RM-046 アールジーコ【ジックキャノン】（JC。R ナンバー）
// 「これが特徴「メカ」と「警察」を持つSユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍バトルエリアから、自軍コマンドゾーンにないカテゴリを
//  持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-856）。パートナーの判定は rules/jointComboProcedure.ts（印刷の特徴）。
// 「自軍コマンドゾーンにないカテゴリを持つ」: 今のカテゴリのうち1つでも、自軍コマンドゾーンのカード（リリース・ホールドを問わない）のどのカテゴリにも
// ないものがあれば対象。選ぶことが発動の宣言（見送れる）。

const JICK_EFFECT_ID = "rm046_jick_cannon";

function applyJickCannon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const p = state.players[ctx.playerId];
  const commandCats = new Set(p.command.flatMap((c) => effectiveCommandCategories(p, state.definitions, c.cardId) as string[]));
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && fieldCategories(state, enemyId, c).some((cat) => !commandCats.has(cat)) && selectableEnemy(state, ctx.playerId, "RM-046", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm046:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "RM-046", JICK_EFFECT_ID, ids, true, "discard")), detail: JICK_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// ライドされてバトルエリアに出たビークル（自軍ターン中、これがバトルエリアに出たとき。rules/combo.ts）
// - RM-047 ダークジェイカー【ビッグキャノン】「敵軍バトルエリアから、ライドされていないSビークルを1体選び、持ち主のコマンドゾーンにホールド状態で置く。
//   置けなければこの効果は発動できない。」（atwiki/page-857）。強制。
// - RM-053 スタッガータンク【ドリルアタッチメント】「自軍エリアに「ビートルーダー」があれば、次の効果を発動できる⇒特徴「メカ」を持つ敵軍Mユニットを
//   1体選びホールドする。」（atwiki/page-863）。エリアを問わない。選ぶことが発動の宣言。
// - RM-054 レッドジャイロ【レッドパルサー】「敵軍バトルエリアからBP3000以下の特徴「航空機」を持つ敵軍ユニットを1体選びホールドする。」
//   （atwiki/page-864）。サイズを問わない（カード評価）。強制。
// ホールドする効果では、すでにホールド状態のユニットは選ばない（RK-118 デストワイルダーと同じ）。

const BIG_CANNON_EFFECT_ID = "rm047_big_cannon";
const DRILL_EFFECT_ID = "rm053_drill_attachment";
const PULSAR_EFFECT_ID = "rm054_red_pulsar";

function bigCannonTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  if (enemy.command.length >= COMMAND_ZONE_MAX) return [];
  return enemy.battle
    .filter((v) => {
      const d = getDefinition(state.definitions, v.cardId);
      return d?.type === "vehicle" && unitSizeOf(state.definitions, v) === "S" && !enemy.battle.some((c) => c.mountedOnInstanceId === v.instanceId) && selectableEnemy(state, playerId, "RM-047", v);
    })
    .map((c) => c.instanceId);
}

function drillTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => unitSizeOf(state.definitions, c) === "M" && !rk1IsSmallNow(state, c) && !c.commandHeld && unitFeatures(state, enemyId, c).includes("メカ") && selectableEnemy(state, playerId, "RM-053", c))
    .map((c) => c.instanceId);
}

function pulsarTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && !c.commandHeld && effectiveBp(state, enemyId, c) <= 3000 && unitFeatures(state, enemyId, c).includes("航空機") && selectableEnemy(state, playerId, "RM-054", c))
    .map((c) => c.instanceId);
}

/** ライドしたユニットと一緒にバトルエリアに出たビークルの効果（rules/combo.ts）。 */
export function tryRm3OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const vehicleId = card.mountedOnInstanceId;
  if (!vehicleId || !ownTurn(state, playerId)) return state;
  const vehicle = state.players[playerId].battle.find((c) => c.instanceId === vehicleId);
  if (!vehicle) return state;
  const ctx: BaseCtx = { playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId };
  if (isSameCardIdentity(vehicle.cardId, "RM-047")) {
    const ids = bigCannonTargets(state, playerId);
    return ids.length > 0 ? openAfter(state, selectOne(ctx, "RM-047", BIG_CANNON_EFFECT_ID, ids, false)) : state;
  }
  if (isSameCardIdentity(vehicle.cardId, "RM-053")) {
    if (!rm3AreaHasName(state, playerId, "ビートルーダー")) return state;
    const ids = drillTargets(state, playerId);
    return ids.length > 0 ? openAfter(state, selectOne(ctx, "RM-053", DRILL_EFFECT_ID, ids, true)) : state;
  }
  if (isSameCardIdentity(vehicle.cardId, "RM-054")) {
    const ids = pulsarTargets(state, playerId);
    return ids.length > 0 ? openAfter(state, selectOne(ctx, "RM-054", PULSAR_EFFECT_ID, ids, false)) : state;
  }
  return state;
}

CHOICE_RESOLVERS[BIG_CANNON_EFFECT_ID] = commandPick("RM-047", BIG_CANNON_EFFECT_ID);
CHOICE_RESOLVERS[DRILL_EFFECT_ID] = holdPick("RM-053", DRILL_EFFECT_ID);
CHOICE_SKIPPERS[DRILL_EFFECT_ID] = simpleSkip();
CHOICE_RESOLVERS[PULSAR_EFFECT_ID] = holdPick("RM-054", PULSAR_EFFECT_ID);

// ---------------------------------------------------------------------------
// ブルースワット RM-048〜RM-050（NC。「この効果は、特徴「スワット」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する」は
// rules/numberComboEffects.ts の既存の判定）
// - RM-048 隊員コード153 ショウ【フレイムスローワー】「敵軍バトルエリアから、DAまたはOTを持つSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で
//   置く。置けなければこの効果は発動できない。」（atwiki/page-886）。強制。
// - RM-049 隊員コード011 サラ【ディクテイター】「敵軍コマンドゾーンから、DAまたはOTを持つカードを1枚選び、持ち主のパワーゾーンに送る。」
//   （atwiki/page-858）。リリース状態・ホールド状態を問わない。パワーゾーンにはオモテ向き。強制。
// - RM-050 隊員コード071 シグ【ミサイルランチャー】「敵軍パワーゾーンのオモテ向きのカードにSユニットのカードが無ければ、次の効果を発動できる⇒DAまたはOTを
//   持つ敵軍Mユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-859）。エリアを問わない。

const FLAME_EFFECT_ID = "rm048_flame_thrower";
const DICTATOR_EFFECT_ID = "rm049_dictator";
const MISSILE_LAUNCHER_EFFECT_ID = "rm050_missile_launcher";
const DA_OT = ["DA", "OT"];

function applyFlameThrower(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  if (state.players[enemyId].command.length >= COMMAND_ZONE_MAX) return { state, detail: "rm048:command_full" };
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && hasAnyCategory(fieldCategories(state, enemyId, c), DA_OT) && selectableEnemy(state, ctx.playerId, "RM-048", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm048:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "RM-048", FLAME_EFFECT_ID, ids, false)), detail: FLAME_EFFECT_ID };
}
CHOICE_RESOLVERS[FLAME_EFFECT_ID] = commandPick("RM-048", FLAME_EFFECT_ID);

function applyDictator(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const ids = enemy.command
    .filter((c) => hasAnyCategory(effectiveCommandCategories(enemy, state.definitions, c.cardId) as string[], DA_OT) && selectableEnemyZoneCard(c.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm049:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "RM-049", DICTATOR_EFFECT_ID, ids, false)), detail: DICTATOR_EFFECT_ID };
}
CHOICE_RESOLVERS[DICTATOR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId), power: [...p.power, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-049", `${DICTATOR_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

function applyMissileLauncher(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const faceUpS = state.players[enemyId].power.some((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return !c.faceDown && d?.type === "unit" && unitSizeOf(state.definitions, c) === "S";
  });
  if (faceUpS) return { state, detail: "rm050:face_up_s_unit" };
  const ids = fieldUnits(state, enemyId)
    .filter((c) => unitSizeOf(state.definitions, c) === "M" && !rk1IsSmallNow(state, c) && hasAnyCategory(fieldCategories(state, enemyId, c), DA_OT) && selectableEnemy(state, ctx.playerId, "RM-050", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm050:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "RM-050", MISSILE_LAUNCHER_EFFECT_ID, ids, true)), detail: MISSILE_LAUNCHER_EFFECT_ID };
}
CHOICE_RESOLVERS[MISSILE_LAUNCHER_EFFECT_ID] = commandPick("RM-050", MISSILE_LAUNCHER_EFFECT_ID);
CHOICE_SKIPPERS[MISSILE_LAUNCHER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// ビーファイター RM-055〜RM-057（NC）
// - RM-055 ブルービート【スティンガーブレード】「「SP1」敵軍バトルエリアから、ホールド状態のユニットを1体選び撃破してもよい。」（atwiki/page-871）。
//   「SP1」は DSL の SP1。サイズを問わない（カード評価）。
// - RM-056 ジースタッグ【スティンガークロー】「ライド中の敵軍Sユニットを1体選んでもよい。そうしたとき、相手はそのSユニットか、そのSユニットがライドしている
//   ビークルのうち、どちらか1体を選び捨札にする。」（atwiki/page-865）。エリアを問わない（カード評価）。捨札にするのは撃破ではない（moveFieldUnit）。
// - RM-057 レッドル【スティンガープラズマー】「レジストを持たない敵軍Sユニットを1体選びホールドしてもよい。」（atwiki/page-866）。レジストの判定は、
//   無効になっていても持っているものとして見る（atwiki/page-2017 SX-003 Q1「無効になっているだけであり、テキスト自体を失っているわけではない」）。

const STINGER_BLADE_EFFECT_ID = "rm055_stinger_blade";
const STINGER_CLAW_EFFECT_ID = "rm056_stinger_claw";
const STINGER_CLAW_PICK_EFFECT_ID = "rm056_stinger_claw_pick";
const STINGER_PLASMA_EFFECT_ID = "rm057_stinger_plasma";

function applyStingerBlade(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && c.commandHeld && selectableEnemy(state, ctx.playerId, "RM-055", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm055:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "RM-055", STINGER_BLADE_EFFECT_ID, ids, true, "discard")), detail: STINGER_BLADE_EFFECT_ID };
}

function applyStingerClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const field = fieldCards(state, enemyId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => c.mountedOnInstanceId && field.some((v) => v.instanceId === c.mountedOnInstanceId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RM-056", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm056:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "RM-056", STINGER_CLAW_EFFECT_ID, ids, true)), detail: STINGER_CLAW_EFFECT_ID };
}
CHOICE_RESOLVERS[STINGER_CLAW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = findField(state, enemyId, instanceId);
  if (!unit?.mountedOnInstanceId) return { error: "invalid_target" };
  return {
    state: openNext(close(state, pending), pending, {
      ...pending,
      playerId: enemyId,
      effectId: STINGER_CLAW_PICK_EFFECT_ID,
      validInstanceIds: [instanceId, unit.mountedOnInstanceId],
      selectedInstanceIds: [],
      optional: false,
    }),
    log: logFor(state, playerId, "RM-056", `${STINGER_CLAW_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_SKIPPERS[STINGER_CLAW_EFFECT_ID] = simpleSkip();
CHOICE_RESOLVERS[STINGER_CLAW_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-056", `${STINGER_CLAW_PICK_EFFECT_ID}:${instanceId}`) };
};

/** 「レジストを持つ」ユニットか（本文の※レジスト・効果で得たレジスト。無効になっていても持っているものとして見る）。 */
function unitHasResist(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return (
    cardHasRegisterKeyword(state, card.cardId, ownerId) ||
    riddenVehicleGrantsResist(state, ownerId, card.instanceId) ||
    set8BGrantsResist(state, ownerId, card.instanceId) ||
    rk10AntlordGrantsResist(state, ownerId, card) ||
    rm3GrantsResist(state, ownerId, card.instanceId)
  );
}

function applyStingerPlasma(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !c.commandHeld && rk1IsSmallNow(state, c) && !unitHasResist(state, enemyId, c) && selectableEnemy(state, ctx.playerId, "RM-057", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm057:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "RM-057", STINGER_PLASMA_EFFECT_ID, ids, true)), detail: STINGER_PLASMA_EFFECT_ID };
}
CHOICE_RESOLVERS[STINGER_PLASMA_EFFECT_ID] = holdPick("RM-057", STINGER_PLASMA_EFFECT_ID);
CHOICE_SKIPPERS[STINGER_PLASMA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-059 異次元調達屋カブト【トランクの中身】
// 「これが自軍ラッシュエリアにある間、WBを持つ自軍Sユニットがバトルエリアに出たとき、常駐している自軍オペレーションに重ねたカードがあれば、その中から1枚選び、
//  自分の手札に加えてもよい（ウラ向きのカードはウラ向きのまま選ぶ）。」（atwiki/page-868）
// applyAction の後で、自軍バトルエリアに新しく出た WB（今のカテゴリ）の S ユニット1体ごと、自軍ラッシュエリアのカブト1枚ごとに発動する（ターンを問わない。
// コメント欄「重複は恐らく可能」「ターン指定無いので発動」）。重ねたカードは中身を見ないで選ぶ前提（表示は UI）。

const TRUNK_EFFECT_ID = "rm059_trunk";

function stackedResidentIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].operation.flatMap((op) => (op.stackedCards ?? []).map((c) => c.instanceId));
}

function trunkChoice(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, sourceInstanceId: string): PendingEffectChoice | null {
  if (!state.players[playerId].rush.some((c) => c.instanceId === sourceInstanceId)) return null;
  const ids = stackedResidentIds(state, playerId);
  if (ids.length === 0) return null;
  return selectOne({ playerId, phasePlayerId, sourceInstanceId }, "RM-059", TRUNK_EFFECT_ID, ids, true);
}

CHOICE_RESOLVERS[TRUNK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const op = state.players[playerId].operation.find((o) => (o.stackedCards ?? []).some((c) => c.instanceId === instanceId));
  const card = op?.stackedCards?.find((c) => c.instanceId === instanceId);
  if (!op || !card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    operation: p.operation.map((o) => (o.instanceId === op.instanceId ? { ...o, stackedCards: (o.stackedCards ?? []).filter((c) => c.instanceId !== instanceId) } : o)),
    hand: [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-059", `${TRUNK_EFFECT_ID}:hand`) };
};
CHOICE_SKIPPERS[TRUNK_EFFECT_ID] = simpleSkip();

function battleUnitIds(state: GameState, playerId: PlayerId): Set<string> {
  return new Set(fieldUnits(state, playerId).filter((c) => state.players[playerId].battle.includes(c)).map((c) => c.instanceId));
}

function hasOtherBlocking(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry ||
    state.pendingEffectRush
  );
}

/** applyAction の後処理（depth 0）: RM-059 の発動（新しくバトルエリアに出た WB の自軍 S ユニット）を記録し、開ける状態なら1つ開く。 */
export function applyRm3AfterAction(before: GameState, after: GameState): GameState {
  const queue = [...(after.rm3PendingTriggers ?? [])];
  for (const pid of ["player1", "player2"] as const) {
    const kabutos = after.players[pid].rush.filter((c) => isSameCardIdentity(c.cardId, "RM-059"));
    if (kabutos.length === 0) continue;
    const prev = battleUnitIds(before, pid);
    const now = battleUnitIds(after, pid);
    for (const unit of after.players[pid].battle) {
      if (prev.has(unit.instanceId) || !now.has(unit.instanceId)) continue;
      if (!rk1IsSmallNow(after, unit) || !(unitEffectiveCategories(after, pid, unit, "battle") as string[]).includes("WB")) continue;
      for (const k of kabutos) queue.push({ kind: "rm059", playerId: pid, sourceInstanceId: k.instanceId });
    }
  }
  if (queue.length === 0) return after.rm3PendingTriggers ? { ...after, rm3PendingTriggers: undefined } : after;
  let next: GameState = after;
  if (hasOtherBlocking(next) || next.winner) return { ...next, rm3PendingTriggers: queue };
  while (queue.length > 0) {
    const trigger = queue.shift()!;
    const existing = next.pendingEffectChoice;
    const phasePlayerId = existing?.phasePlayerId ?? next.activePlayer;
    const choice = trunkChoice(next, trigger.playerId, phasePlayerId, trigger.sourceInstanceId);
    if (!choice) continue;
    next = existing ? { ...next, pendingEffectChoice: { ...choice, resumeChoice: existing }, activePlayer: choice.playerId } : openEffectChoice(next, choice);
    break;
  }
  return { ...next, rm3PendingTriggers: queue.length > 0 ? queue : undefined };
}

// ---------------------------------------------------------------------------
// RM-061 ジャマール戦闘機【ミサイル射出】（ラッシュしたとき）
// 「次の効果を発動できる⇒敵軍バトルエリアから、スクラムを持つユニットを1体選び、ラッシュエリアに戻す。」（atwiki/page-855）。スクラムは本文・効果で得た
// もの（RS-467・RM-013）を含む。選ぶことが発動の宣言。ライドの組は組ごと戻す。

const MISSILE_SHOT_EFFECT_ID = "rm061_missile_shot";

function hasScrum(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return (
    cardHasBattleKeyword(state.definitions, card.cardId, "scrum") ||
    riddenVehicleGrantsScrum(state, ownerId, card) ||
    rm1GrantsScrum(state, ownerId, unitFeatures(state, ownerId, card))
  );
}

function applyMissileShot(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && hasScrum(state, enemyId, c) && selectableEnemy(state, ctx.playerId, "RM-061", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm061:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "RM-061", MISSILE_SHOT_EFFECT_ID, ids, true)), detail: MISSILE_SHOT_EFFECT_ID };
}
CHOICE_RESOLVERS[MISSILE_SHOT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = returnBattleUnitToRush(close(state, pending), opponent(playerId), instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-061", `${MISSILE_SHOT_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[MISSILE_SHOT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-062 テントリーナ【リーナステッキ】
// 「これが自軍エリアにある間、敵軍ターン中、自軍バトルエリアにある特徴「女」を持つユニットが、特徴「男」を持つユニットにアタックされたとき、自軍コマンドを
//  1つホールドしてもよい。そうしたとき、アタックされた自軍ユニットをラッシュエリアに戻す。このときバトルは行われない。」（atwiki/page-860）
// アタックの「アタックされたとき」（カウンター窓の前。RS-215・RK-188 と同じ場所）に、ホールドするリリース状態の自軍コマンドを選ぶ選択を開く（選ぶことが
// 発動の宣言）。今の特徴で見る。効果のバトルでは開かない。

export const TENTRINA_EFFECT_ID = "rm062_lina_stick";

export function openRm3Tentrina(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.rm3TentrinaOffered || battle.battleCancelled || battle.effectBattle) return null;
  const defenderId = battle.defenderPlayerId;
  if (battle.phasePlayerId === defenderId) return null;
  const tentrina = fieldCards(state, defenderId).find((c) => isSameCardIdentity(c.cardId, "RM-062"));
  if (!tentrina) return null;
  const defender = state.players[defenderId].battle.find((c) => c.instanceId === battle.defenderInstanceId);
  if (!defender || !isUnitCard(state, defender.cardId) || !unitFeatures(state, defenderId, defender).includes("女")) return null;
  const attacker = findField(state, battle.attackerPlayerId, battle.attackerInstanceId);
  if (!attacker || !unitFeatures(state, battle.attackerPlayerId, attacker).includes("男")) return null;
  const ids = releasedCommands(state, defenderId);
  if (ids.length === 0) return null;
  return {
    ...openEffectChoice(state, {
      ...selectOne({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: tentrina.instanceId }, "RM-062", TENTRINA_EFFECT_ID, ids, true),
      rm3Meta: { battle: { ...battle, rm3TentrinaOffered: true }, wingAttackFromRush },
    }),
    activePlayer: defenderId,
  };
}

export function isRm3TentrinaChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === TENTRINA_EFFECT_ID && !!pending.rm3Meta?.battle;
}

/** ホールドするコマンドを選んだ。アタックされたユニットをラッシュエリアに戻し、バトルを行わないアタックとして続ける。 */
export function resolveRm3Tentrina(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | { error: string } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.rm3Meta;
  if (!pending || !isRm3TentrinaChoice(pending) || !meta?.battle || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId };
  next = holdCommands(next, playerId, [instanceId]);
  next = returnBattleUnitToRush(next, playerId, meta.battle.defenderInstanceId);
  next = { ...next, log: [...next.log, logFor(state, playerId, "RM-062", `${TENTRINA_EFFECT_ID}:return`)] };
  return { state: next, battle: { ...meta.battle, battleCancelled: true }, wingAttackFromRush: !!meta.wingAttackFromRush };
}

/** テントリーナを使わなかった。そのまま続けるアタックを返す。 */
export function skipRm3Tentrina(state: GameState, playerId: PlayerId): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | null {
  const pending = state.pendingEffectChoice;
  const meta = pending?.rm3Meta;
  if (!pending || !isRm3TentrinaChoice(pending) || !meta?.battle || pending.playerId !== playerId) return null;
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId, log: [...state.log, skipLog(state, playerId, "RM-062", TENTRINA_EFFECT_ID)] },
    battle: meta.battle,
    wingAttackFromRush: !!meta.wingAttackFromRush,
  };
}

// legalActions に候補を出すために登録する（解決は core/applyAction.ts の resolveRm3Tentrina・skipRm3Tentrina）。
CHOICE_RESOLVERS[TENTRINA_EFFECT_ID] = () => ({ error: "rm062_handled_by_attack" });
CHOICE_SKIPPERS[TENTRINA_EFFECT_ID] = () => ({ error: "rm062_handled_by_attack" });

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RM3_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RM-043::sannin_ichikumi": applyKarasu,
  "RM-044::jandejiku": applyJandejiku,
  "RM-045::homing_bullet": applyHomingBullet,
  "RM-046::jick_cannon": applyJickCannon,
  "RM-048::flame_thrower": applyFlameThrower,
  "RM-049::dictator": applyDictator,
  "RM-050::missile_launcher": applyMissileLauncher,
  "RM-055::stinger_blade": applyStingerBlade,
  "RM-056::stinger_claw": applyStingerClaw,
  "RM-057::stinger_plasma": applyStingerPlasma,
  "RM-061::missile_shot": applyMissileShot,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RM-045::gun_gibson": noop("rm045:rc_without_ride_off"),
  "RM-047::big_cannon": noop("rm047:vehicle_enter"),
  "RM-051::mega_beet": noop("rm051:beet_machines"),
  "RM-053::drill_attachment": noop("rm053:vehicle_enter"),
  "RM-054::red_pulsar": noop("rm054:vehicle_enter"),
  "RM-058::insect_spirit": noop("rm058:added_feature"),
  "RM-059::trunk": noop("rm059:after_action"),
  "RM-062::lina_stick": noop("rm062:attacked"),
};

export function tryRm3CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RM3_KEYWORD_PREFIX)) return null;
  const handler = RM3_KEYWORDS[keyword.slice(RM3_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
