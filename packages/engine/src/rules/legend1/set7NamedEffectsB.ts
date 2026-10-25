/**
 * 第7弾「七忍の炎陣」（legend1）RS-453〜RS-473 のカード固有の名前付き効果（set-7 監査で未実装・誤実装だったもの）。
 *
 * - `trySet7BNcEffect`: NC の効果の起点（rules/numberComboEffects.ts applyNumberComboEffect から呼ぶ）。
 * - `tryResolveSet7BChoice` / `trySkipSet7BChoice` / `tryConfirmSet7BChoice`: このモジュールが開いた選択の解決。
 * - 継続効果・誘発の参照関数（ビークルが与える能力、SP、選べない、チャージフェイズの置き換え等）。
 * 構成は rules/legend1/set6NamedEffectsB.ts と同じ。文言で判定できる効果は文言で判定する（カード ID に依存しない）。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, getDefinition, parsePowerCost, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { addNextTurnRuleModifier, addTurnRuleModifier, getPlayerModifiers, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { addTurnFeatureModifier, KIRIGAKURE_RULE_ID, unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { bounceToHandAuto } from "../bounce";
import { flowerBombPowerCostOverride } from "./coreGapEffects";
import { isSmallUnitNow, turnPlayerOf, zubaanIsLarge } from "./set6NamedEffectsB";
import { strikeDamageFor } from "../combo";
import { beginDestroyTriggerHold, releaseDestroyTriggerHold } from "../destroyTriggerQueue";
import { tryLeaveField } from "../operationCounters";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { registerOptionalEffect, openOptionalEffectConfirm } from "../optionalEffects";
import type { ComboOutcome } from "../comboTypes";
import { TURN_RULE_IDS } from "../../types/scopedModifiers";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
type ChoiceConfirmer = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceConfirmer> = {};

export function isSet7BChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 1つずつ選び、確定（confirm_effect_choice）で終えられる選択か（rules/../core/legalActions.ts）。 */
export function isSet7BConfirmableChoice(pending: PendingEffectChoice): boolean {
  return pending.effectId in CHOICE_CONFIRMERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet7BChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet7BChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet7BChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  return confirmer ? confirmer(state, playerId) : null;
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
  if (cleared.pendingLeave || cleared.pendingEffectChoice || cleared.pendingDamagePayment) return cleared;
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

function simpleSkip(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, cardId, pending.effectId) };
  };
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function isUnitCard(state: GameState, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function normText(text: string | undefined): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, "");
}

/** 効果を発動したプレイヤーから見て選べる敵軍ユニット（バトル・ラッシュエリア）。 */
function selectableEnemyUnits(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  pick: (c: CardInstance, ownerId: PlayerId) => boolean = () => true,
): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => isUnitCard(state, c.cardId))
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId, sourceCardId, playerId))
    .filter((c) => pick(c, enemyId))
    .map((c) => c.instanceId);
}

/** 効果で撃破する（撃破された側の誘発は R-TIME-01 の順に、この効果の処理のあとで解決する）。 */
function destroyByEffect(state: GameState, instanceId: string, phasePlayerId: PlayerId): GameState {
  const hadHold = !!state.destroyTriggerHold;
  const left = applyUnitLeave(beginDestroyTriggerHold(state), instanceId, "discard", phasePlayerId);
  if ("error" in left) return state;
  return releaseDestroyTriggerHold(left.state, hadHold);
}

/** ユニットの現在のサイズ（「Lユニットになる」RS-420・RS-454 を含む）。 */
function currentUnitSize(state: GameState, card: CardInstance): CardDefinition["size"] | undefined {
  const size = unitSizeOf(state.definitions, card);
  if (size !== "L" && zubaanIsLarge(state, card)) return "L";
  return size;
}

/**
 * ユニットの「必要パワーの数字」。RS-460 花忍者ラン【忍法花爆弾】で宣言した数字になっている S ユニットはその数字
 * （atwiki/page-823「すべての敵軍Sユニットの必要パワーは宣言した数字になる」）。
 */
export function unitPowerCostNumber(state: GameState, ownerId: PlayerId, card: Pick<CardInstance, "cardId">): number {
  const override = flowerBombPowerCostOverride(state, ownerId, card.cardId);
  if (override !== null) return override;
  return parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost);
}

/** 本文の「SP」欄が空欄か（印刷「－」）。効果で SP を得ていれば空欄ではない（atwiki/page-800 コメント）。 */
function spIsBlank(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  const sp = getDefinition(state.definitions, card.cardId)?.sp;
  if (sp !== undefined && sp !== null) return false;
  return strikeDamageFor(state.definitions, card, state, ownerId) <= 0;
}

// ---------------------------------------------------------------------------
// ビークルが与える能力・効果（「これにライドしている（した）ユニットがある間」）

/** このビークルにライドしているユニットがあるか（自軍のバトル・ラッシュエリア）。 */
function vehicleIsRidden(state: GameState, ownerId: PlayerId, vehicle: CardInstance): boolean {
  return fieldUnits(state, ownerId).some((c) => c.mountedOnInstanceId === vehicle.instanceId);
}

/** ライドされているビークルのうち、本文が re に一致するもの（持ち主ごと）。 */
function riddenVehiclesMatching(state: GameState, ownerId: PlayerId, re: RegExp): Array<{ vehicle: CardInstance; m: RegExpMatchArray }> {
  const out: Array<{ vehicle: CardInstance; m: RegExpMatchArray }> = [];
  for (const c of fieldUnits(state, ownerId)) {
    const def = getDefinition(state.definitions, c.cardId);
    if (def?.type !== "vehicle") continue;
    const m = normText(def.text).match(re);
    if (!m) continue;
    if (!vehicleIsRidden(state, ownerId, c)) continue;
    out.push({ vehicle: c, m });
  }
  return out;
}

/**
 * RS-466 ギンガレオン【炎の星獣】「これにライドしているSユニットは次の能力を得る⇒※レジスト」。
 * バトルで撃破されるユニットが、この文言のビークルにライドしている S ユニットならレジストを持つ（R-KW-RESIST-01）。
 */
const RIDER_RESIST_RE = /これにライドしているSユニットは次の能力を得る⇒※?レジスト/;

export function riddenVehicleGrantsResist(state: GameState, ownerId: PlayerId, instanceId: string): boolean {
  const unit = fieldUnits(state, ownerId).find((c) => c.instanceId === instanceId);
  if (!unit?.mountedOnInstanceId) return false;
  if (!isSmallUnitNow(state, ownerId, unit)) return false;
  const vehicle = fieldUnits(state, ownerId).find((c) => c.instanceId === unit.mountedOnInstanceId);
  if (!vehicle) return false;
  return RIDER_RESIST_RE.test(normText(getDefinition(state.definitions, vehicle.cardId)?.text));
}

/**
 * RS-467 ギンガルコン【風の星獣】「これにライドしたユニットがある間、WBの自軍Sユニットは次の能力を得る⇒スクラム」。
 * 自軍のライドされているこの文言のビークルがあれば、指定カテゴリの自軍 S ユニットはスクラムを持つ（R-KW-SCRUM-01）。
 */
const RIDDEN_SCRUM_RE = /これにライドしたユニットがある間、(WB|OT|ET|MA|DA)の自軍Sユニットは次の能力を得る⇒スクラム/;

export function riddenVehicleGrantsScrum(state: GameState, ownerId: PlayerId, unit: CardInstance): boolean {
  if (!isSmallUnitNow(state, ownerId, unit)) return false;
  const def = getDefinition(state.definitions, unit.cardId);
  const categories = Array.isArray(def?.category) ? (def!.category as string[]) : def?.category ? [def.category as string] : [];
  return riddenVehiclesMatching(state, ownerId, RIDDEN_SCRUM_RE).some(({ m }) => categories.includes(m[1]!));
}

/**
 * RS-468 ギンガリラ【水の星獣】「これにライドしたユニットがある間、次の効果を発動する⇒特徴「車両」を持つユニットは
 * 「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれているかのように扱う。」
 * どちらのプレイヤーのビークルでも、指定の特徴を持つユニット（自軍・敵軍）に効く（R-ADD-07）。
 */
const RIDDEN_ENTRY_HOLD_RE =
  /これにライドしたユニットがある間、次の効果を発動する⇒特徴「([^」]+)」を持つユニットは「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれているかのように扱う/;

export function riddenVehicleGrantsEntryHold(state: GameState, ownerId: PlayerId, unit: CardInstance): boolean {
  const features = unitFeatures(state, ownerId, unit);
  for (const pid of ["player1", "player2"] as const) {
    if (riddenVehiclesMatching(state, pid, RIDDEN_ENTRY_HOLD_RE).some(({ m }) => features.includes(m[1]!))) return true;
  }
  return false;
}

/**
 * RS-469 ギンガベリック【雷の星獣】「これにライドしたユニットがある間、次の効果を発動する⇒自軍バトルフェイズ中、MAの自軍コマンドを
 * 1つホールドするかわりに、敵軍コマンドを1つ選びホールドしてもよい。」（R-REPL-03）
 * 自軍バトルフェイズ中に「MA」の自軍コマンドをホールドする処理（rules/holdToActivate.ts）で、かわりに選べる敵軍コマンド。
 */
const RIDDEN_ENEMY_COMMAND_SUBSTITUTE_RE =
  /これにライドしたユニットがある間、次の効果を発動する⇒自軍バトルフェイズ中、(WB|OT|ET|MA|DA)の自軍コマンドを1つホールドするかわりに、敵軍コマンドを1つ選びホールドしてもよい/;

export function enemyCommandHoldSubstitutes(state: GameState, playerId: PlayerId, category: string): string[] {
  if (state.phase !== "battle" || turnPlayerOf(state) !== playerId) return [];
  const allowed = riddenVehiclesMatching(state, playerId, RIDDEN_ENEMY_COMMAND_SUBSTITUTE_RE).some(({ m }) => m[1] === category);
  if (!allowed) return [];
  return state.players[opponent(playerId)].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
}

/**
 * RS-470 ギンガット【花の星獣】「これにライドしたユニットがある間、次の効果を発動する⇒自分がバトルフェイズを行うとき、
 * かわりにチャージフェイズを行ってもよい。」
 * ラッシュフェイズを終えてバトルフェイズに入るとき、行うかを確認する。行うならそのバトルフェイズのかわりにチャージフェイズを行い、
 * その後はエンドフェイズに進む（core/createGame.ts advancePhase）。
 */
const RIDDEN_CHARGE_INSTEAD_RE =
  /これにライドしたユニットがある間、次の効果を発動する⇒自分がバトルフェイズを行うとき、かわりにチャージフェイズを行ってもよい/;
export const FLOWER_BEAST_EFFECT_ID = "rs470_charge_instead_of_battle";
/** このターン、バトルフェイズのかわりにチャージフェイズを行っている（チャージフェイズの次はエンドフェイズ）。 */
export const CHARGE_INSTEAD_OF_BATTLE_RULE = TURN_RULE_IDS.CHARGE_INSTEAD_OF_BATTLE;

export function openChargeInsteadOfBattle(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId || state.pendingEffectChoice) return state;
  const sources = riddenVehiclesMatching(state, playerId, RIDDEN_CHARGE_INSTEAD_RE);
  if (sources.length === 0) return state;
  return openOptionalEffectConfirm(state, {
    playerId,
    effectId: FLOWER_BEAST_EFFECT_ID,
    sourceCardId: sources[0]!.vehicle.cardId,
    sourceInstanceId: sources[0]!.vehicle.instanceId,
    phasePlayerId: playerId,
  });
}

registerOptionalEffect(FLOWER_BEAST_EFFECT_ID, {
  apply: (state, pending) => {
    const playerId = pending.playerId;
    const next = patchPlayer(state, playerId, (p) => ({
      ...addTurnRuleModifier(p, CHARGE_INSTEAD_OF_BATTLE_RULE, { sourceCardId: pending.sourceCardId }),
      hasChargedThisTurn: false,
    }));
    return {
      ...next,
      phase: "charge",
      activePlayer: playerId,
      log: [...next.log, `phase:battle->charge`, buildLogEntry(playerId, "named_effect", pending.sourceCardId, state.definitions, FLOWER_BEAST_EFFECT_ID)],
    };
  },
  // CPU はバトルフェイズを行う（アタック・ストライクを優先）。
  cpuAccepts: () => false,
});

/** バトルフェイズのかわりのチャージフェイズを行っているか（core/createGame.ts advancePhase）。 */
export function chargeReplacesBattle(state: GameState): boolean {
  return state.phase === "charge" && hasTurnRuleModifier(state.players[state.activePlayer], CHARGE_INSTEAD_OF_BATTLE_RULE);
}

// ---------------------------------------------------------------------------
// SP の継続効果

/**
 * 「これは自軍コマンドゾーンに特徴「○○」を持つ[SML]ユニットのカードがN枚あれば「SP1」になる。」
 * （RS-471 グランドライナー【グランドストーム】atwiki/page-789）。
 */
const COMMAND_FEATURE_SP1_RE = /これは自軍コマンドゾーンに特徴「([^」]+)」を持つ([SML])ユニットのカードが(\d+)枚(?:以上)?あれば「SP1」になる/;

/** 効果文ごとの COMMAND_FEATURE_SP1_RE の一致（文字列だけで決まる。SP の計算のたびに効果文を正規化していた）。 */
const commandFeatureSp1Cache = new Map<string, RegExpMatchArray | null>();

function commandFeatureSp1Match(text: string | undefined): RegExpMatchArray | null {
  const key = text ?? "";
  let hit = commandFeatureSp1Cache.get(key);
  if (hit === undefined) {
    hit = normText(key).match(COMMAND_FEATURE_SP1_RE);
    commandFeatureSp1Cache.set(key, hit);
  }
  return hit;
}

export function set7BEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  const def = getDefinition(state.definitions, instance.cardId);
  const m = commandFeatureSp1Match(def?.text);
  if (!m) return sp;
  const [, feature, size, countText] = m;
  const count = state.players[playerId].command.filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && unitSizeOf(state.definitions, c) === size && (d.features ?? []).includes(feature!);
  }).length;
  return count >= Number(countText) ? Math.max(sp, 1) : sp;
}

// ---------------------------------------------------------------------------
// RS-464 花忍者ユリ【斬撃の回避】「次の相手ターン、相手はこのユニットを選べない。」

const ZANGEKI_RULE_ID = "rs464_not_selectable_next_turn";

/** 相手の効果でこのユニットを選べないか（keywords/effectTargetability.ts）。 */
export function set7BNotSelectable(state: GameState, ownerId: PlayerId, instanceId: string): boolean {
  return getPlayerModifiers(state.players[ownerId]).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === ZANGEKI_RULE_ID &&
      m.scope === "turn" &&
      m.fromNextTurn === true &&
      (m.payload as { instanceId?: string } | undefined)?.instanceId === instanceId,
  );
}

// ---------------------------------------------------------------------------
// RS-453 サムライマン【激怒斬り】
// 「これが自軍ラッシュエリアにある間、敵軍ターン中、「サムライマン」以外の自軍ユニットがユニットサイズの違うユニットとバトルして
//  撃破された時、敵軍ユニットを1体選び撃破してもよい。」（atwiki/page-798）
// 撃破された側の段階 2「撃破された時」（R-TIME-01）。バトルの相手のサイズは撃破の時点（rules/leaveEffects.ts）で判定する。

const GEKIDO_RE = /これが自軍ラッシュエリアにある間、敵軍ターン中、「([^」]+)」以外の自軍ユニットがユニットサイズの違うユニットとバトルして撃破された時、敵軍ユニットを1体選び撃破してもよい/;
export const GEKIDO_EFFECT_ID = "rs453_gekido_zan";

function findAnywhere(state: GameState, instanceId: string): CardInstance | undefined {
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    for (const zone of ["battle", "rush", "discard", "power", "command", "hand", "deck"] as const) {
      const c = p[zone].find((x) => x.instanceId === instanceId);
      if (c) return c;
    }
  }
  return undefined;
}

/**
 * 撃破されたユニット（instanceId）について、【激怒斬り】を発動するカードの instanceId（自軍ラッシュエリアにある、文言の一致する
 * カード）。バトルの相手（離場の battleOpponentInstanceId）とユニットサイズが違うときだけ。敵軍ターン中だけ。
 */
export function gekidoSourcesForDestroyed(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; instanceId: string; cardId: string; phasePlayerId: PlayerId; battleOpponentInstanceId?: string },
): string[] {
  if (ctx.phasePlayerId === ctx.ownerPlayerId) return [];
  const otherId = ctx.battleOpponentInstanceId;
  if (!otherId) return [];
  const other = findAnywhere(state, otherId);
  if (!other) return [];
  const victim = { instanceId: ctx.instanceId, cardId: ctx.cardId } as CardInstance;
  if (currentUnitSize(state, victim) === currentUnitSize(state, other)) return [];
  const victimName = cardName(state.definitions, ctx.cardId);
  return state.players[ctx.ownerPlayerId].rush
    .filter((c) => {
      const m = normText(getDefinition(state.definitions, c.cardId)?.text).match(GEKIDO_RE);
      return !!m && !sameCardName(victimName, m[1]);
    })
    .map((c) => c.instanceId);
}

/** 【激怒斬り】の選択を開く（段階 2。sources は撃破の時点で判定した発動元）。 */
export function openGekidoZan(state: GameState, ownerId: PlayerId, sources: string[], phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const sourceInstanceId of sources) {
    const source = state.players[ownerId].rush.find((c) => c.instanceId === sourceInstanceId);
    if (!source) continue;
    const valid = selectableEnemyUnits(next, ownerId, source.cardId);
    if (valid.length === 0) continue;
    const choice: PendingEffectChoice = {
      playerId: ownerId,
      effectId: GEKIDO_EFFECT_ID,
      sourceCardId: source.cardId,
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId,
      validInstanceIds: valid,
      selectCount: 1,
      optional: true,
      unitDestination: "discard",
      destroyTriggerTiming: "destroyed",
    };
    next = next.pendingEffectChoice
      ? { ...next, pendingEffectChoice: { ...next.pendingEffectChoice, resumeChoice: next.pendingEffectChoice.resumeChoice ?? choice } }
      : openEffectChoice(next, choice);
  }
  return next;
}

CHOICE_RESOLVERS[GEKIDO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const target = findAnywhere(state, instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${GEKIDO_EFFECT_ID}:${target ? cardName(state.definitions, target.cardId) : instanceId}`);
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const destroyed = destroyByEffect(cleared, instanceId, pending.phasePlayerId);
  return { state: finish(destroyed, { ...pending }), log };
};
CHOICE_SKIPPERS[GEKIDO_EFFECT_ID] = simpleSkip("RS-453");

// ---------------------------------------------------------------------------
// NC の効果の起点

type NcHandler = (state: GameState, playerId: PlayerId, card: CardInstance) => GameState;

const NC_HANDLERS: Record<string, { effectId: string; apply: NcHandler }> = {};

/**
 * NC が成立したときの処理（rules/numberComboEffects.ts applyNumberComboEffect の先頭から呼ぶ）。対象外なら null。
 */
export function trySet7BNcEffect(state: GameState, playerId: PlayerId, card: CardInstance): ComboOutcome | null {
  const handler = NC_HANDLERS[card.cardId];
  if (!handler) return null;
  let next = markBattleNcEffect(state, playerId, card.instanceId, handler.effectId);
  next = handler.apply(next, playerId, card);
  const detail = next.pendingEffectChoice ? `choice:${handler.effectId}` : handler.effectId;
  return { state: next, logs: [buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, detail)] };
}

// ---------------------------------------------------------------------------
// RS-455 ニンジャブラック【岩地獄の術】
// 「SPが空欄ではない敵軍Sユニットを自分の手札の枚数と同じ数まで選び、持ち主の山札の下に好きな順で戻してもよい。」（atwiki/page-800）
// 1体ずつ選び（選んだ順に山札の下へ）、手札の枚数まで選んだか確定で終える。

const IWA_JIGOKU = "rs455_iwa_jigoku";

NC_HANDLERS["RS-455"] = {
  effectId: "no_e5b2a9",
  apply: (state, playerId, card) => {
    const handCount = state.players[playerId].hand.length;
    if (handCount === 0) return state;
    const valid = selectableEnemyUnits(state, playerId, card.cardId, (c, ownerId) =>
      isSmallUnitNow(state, ownerId, c) && !spIsBlank(state, ownerId, c),
    );
    if (valid.length === 0) return state;
    return openEffectChoice(state, {
      playerId,
      effectId: IWA_JIGOKU,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: Math.min(handCount, valid.length),
      selectedInstanceIds: [],
      optional: true,
    });
  },
};

function finishIwaJigoku(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  let next = state;
  for (const id of selected) {
    for (const pid of ["player1", "player2"] as const) {
      const owner = next.players[pid];
      const card = [...owner.battle, ...owner.rush].find((c) => c.instanceId === id);
      if (!card) continue;
      const clean: CardInstance = { instanceId: card.instanceId, cardId: card.cardId };
      const unmount = (c: CardInstance) => {
        if (c.mountedOnInstanceId !== id) return c;
        const { mountedOnInstanceId: _m, ...rest } = c;
        return rest as CardInstance;
      };
      next = patchPlayer(next, pid, (p) => ({
        ...p,
        battle: p.battle.filter((c) => c.instanceId !== id).map(unmount),
        rush: p.rush.filter((c) => c.instanceId !== id).map(unmount),
        deck: [...p.deck, clean],
      }));
    }
  }
  const log = logFor(state, playerId, pending.sourceCardId, `${IWA_JIGOKU}:${selected.length}`);
  return { state: finish(next, pending), log };
}

CHOICE_RESOLVERS[IWA_JIGOKU] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (!pending.validInstanceIds.includes(instanceId) || selected.includes(instanceId)) return { error: "invalid_target" };
  const nextSelected = [...selected, instanceId];
  const withSelected: GameState = { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: nextSelected } };
  if (nextSelected.length >= (pending.selectCount ?? 1)) return finishIwaJigoku(withSelected, playerId);
  return { state: withSelected };
};
CHOICE_CONFIRMERS[IWA_JIGOKU] = (state, playerId) => finishIwaJigoku(state, playerId);
CHOICE_SKIPPERS[IWA_JIGOKU] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  if ((pending.selectedInstanceIds ?? []).length > 0) return finishIwaJigoku(state, playerId);
  return simpleSkip("RS-455")(state, playerId);
};

// ---------------------------------------------------------------------------
// RS-457 ニンジャレッド【火炎つむじの術】
// 「「SP1」 敵軍ユニットの数と同じ枚数、敵軍山札の上からオモテにしてもよい。そうしたとき、オモテにしたカードと同じカード名の
//  敵軍ユニットをすべて撃破する。そして相手はオモテにしたカードの中から、撃破されたユニットの数と同じ枚数まで好きな枚数選び
//  手札に加えた後、それ以外を山札の下に好きな順で戻す。」（atwiki/page-802）
// 山札が足りなければオモテにできず、処理は実行されない（grnrngr/faq-card-7 RS-457 Q1）。

const KAEN_REVEAL = "rs457_kaen_tsumuji";
const KAEN_PICK = "rs457_kaen_tsumuji_pick";

function enemyUnitCount(state: GameState, enemyId: PlayerId): number {
  return fieldUnits(state, enemyId).filter((c) => isUnitCard(state, c.cardId)).length;
}

NC_HANDLERS["RS-457"] = {
  effectId: "hi_honoo_tsumujino",
  apply: (state, playerId, card) => {
    const next = grantSp1ToBattleUnit(state, playerId, card.instanceId);
    const enemyId = opponent(playerId);
    const count = enemyUnitCount(next, enemyId);
    if (count === 0 || next.players[enemyId].deck.length < count) return next;
    return openOptionalEffectConfirm(next, {
      playerId,
      effectId: KAEN_REVEAL,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      phasePlayerId: playerId,
    });
  },
};

registerOptionalEffect(KAEN_REVEAL, {
  apply: (state, pending) => {
    const playerId = pending.playerId;
    const enemyId = opponent(playerId);
    const count = enemyUnitCount(state, enemyId);
    const deck = state.players[enemyId].deck;
    if (count === 0 || deck.length < count) return state;
    const revealed = deck.slice(0, count);
    const names = revealed.map((c) => cardName(state.definitions, c.cardId));
    const targets = fieldUnits(state, enemyId).filter(
      (c) => isUnitCard(state, c.cardId) && names.some((n) => sameCardName(n, cardName(state.definitions, c.cardId))),
    );
    const hadHold = !!state.destroyTriggerHold;
    let next = beginDestroyTriggerHold({
      ...state,
      log: [...state.log, buildLogEntry(playerId, "named_effect", pending.sourceCardId, state.definitions, `${KAEN_REVEAL}:${names.join("、")}`)],
    });
    let destroyed = 0;
    for (const t of targets) {
      if (next.pendingLeave) break;
      const zone = next.players[enemyId].battle.some((c) => c.instanceId === t.instanceId) ? "battle" : "rush";
      if (!next.players[enemyId][zone].some((c) => c.instanceId === t.instanceId)) continue;
      next = tryLeaveField(next, {
        ownerPlayerId: enemyId,
        instanceId: t.instanceId,
        fromZone: zone,
        toZone: "discard",
        leavingCardId: t.cardId,
        phasePlayerId: pending.phasePlayerId,
      }).state;
      destroyed += 1;
    }
    const revealedIds = revealed.map((c) => c.instanceId);
    if (destroyed === 0) {
      next = moveRevealedToBottom(next, enemyId, revealedIds);
    } else {
      next = openEffectChoice(next, {
        playerId: enemyId,
        effectId: KAEN_PICK,
        sourceCardId: pending.sourceCardId,
        sourceInstanceId: pending.sourceInstanceId,
        kind: "scry_keep_one",
        phasePlayerId: pending.phasePlayerId,
        validInstanceIds: revealedIds,
        viewedInstanceIds: revealedIds,
        selectCount: Math.min(destroyed, revealedIds.length),
        selectedInstanceIds: [],
        optional: true,
      });
    }
    return releaseDestroyTriggerHold(next, hadHold);
  },
});

/** オモテにしたカード（山札の上にある）のうち手札に加えなかったものを、山札の下に（オモテにした順で）戻す。 */
function moveRevealedToBottom(state: GameState, ownerId: PlayerId, revealedIds: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const rest = p.deck.filter((c) => revealedIds.includes(c.instanceId));
    return { ...p, deck: [...p.deck.filter((c) => !revealedIds.includes(c.instanceId)), ...rest] };
  });
}

function finishKaenPick(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const revealed = pending.viewedInstanceIds ?? [];
  let next = patchPlayer(state, playerId, (p) => {
    const taken = p.deck.filter((c) => selected.includes(c.instanceId));
    return { ...p, deck: p.deck.filter((c) => !selected.includes(c.instanceId)), hand: [...p.hand, ...taken] };
  });
  next = moveRevealedToBottom(next, playerId, revealed.filter((id) => !selected.includes(id)));
  return { state: finish(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${KAEN_PICK}:${selected.length}`) };
}

CHOICE_RESOLVERS[KAEN_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (!pending.validInstanceIds.includes(instanceId) || selected.includes(instanceId)) return { error: "invalid_target" };
  const nextSelected = [...selected, instanceId];
  const withSelected: GameState = {
    ...state,
    pendingEffectChoice: {
      ...pending,
      selectedInstanceIds: nextSelected,
      validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
    },
  };
  if (nextSelected.length >= (pending.selectCount ?? 1)) return finishKaenPick(withSelected, playerId);
  return { state: withSelected };
};
CHOICE_CONFIRMERS[KAEN_PICK] = (state, playerId) => finishKaenPick(state, playerId);
CHOICE_SKIPPERS[KAEN_PICK] = (state, playerId) => finishKaenPick(state, playerId);

// ---------------------------------------------------------------------------
// RS-458 ニンジャホワイト【忍法折鶴之舞】
// 「敵軍パワーゾーンのカード枚数を見て、その枚数よりも必要パワーの数字が大きい敵軍ユニットを1枚選び、持ち主の手札に戻してもよい。」
// （atwiki/page-803。バトル・ラッシュエリアの敵軍ユニット）

const ORIZURU = "rs458_orizuru";

NC_HANDLERS["RS-458"] = {
  effectId: "ninpo_e5bf8d",
  apply: (state, playerId, card) => {
    const enemyId = opponent(playerId);
    const threshold = state.players[enemyId].power.length;
    const valid = selectableEnemyUnits(state, playerId, card.cardId, (c, ownerId) => unitPowerCostNumber(state, ownerId, c) > threshold);
    if (valid.length === 0) return state;
    return openEffectChoice(state, {
      playerId,
      effectId: ORIZURU,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: 1,
      optional: true,
      unitDestination: "hand",
    });
  },
};

CHOICE_RESOLVERS[ORIZURU] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const target = findAnywhere(state, instanceId);
  const bounced = bounceToHandAuto(state, opponent(playerId), instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${ORIZURU}:${target ? cardName(state.definitions, target.cardId) : instanceId}`);
  return { state: finish(bounced.state, pending), log };
};
CHOICE_SKIPPERS[ORIZURU] = simpleSkip("RS-458");

// ---------------------------------------------------------------------------
// RS-461 花忍者スイレン【忍法花夢幻】
// 「敵軍Sユニットを1体選び、特徴を1つ宣言してもよい。そうしたとき、このターン、宣言した特徴を選んだユニットに追加する。」
// （atwiki/page-824）1体選んだら、宣言する特徴を選ぶ（カードに存在する特徴の一覧から）。

const HANA_MUGEN = "rs461_hana_mugen";
const HANA_MUGEN_DECLARE = "rs461_hana_mugen_declare";

NC_HANDLERS["RS-461"] = {
  effectId: "ninpo_hana_e5bf8d",
  apply: (state, playerId, card) => {
    const valid = selectableEnemyUnits(state, playerId, card.cardId, (c, ownerId) => isSmallUnitNow(state, ownerId, c));
    if (valid.length === 0) return state;
    return openEffectChoice(state, {
      playerId,
      effectId: HANA_MUGEN,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: 1,
      optional: true,
    });
  },
};

function declarableFeatures(state: GameState): string[] {
  const set = new Set<string>();
  for (const def of Object.values(state.definitions)) {
    for (const f of def.features ?? []) set.add(f);
  }
  return [...set].sort();
}

CHOICE_RESOLVERS[HANA_MUGEN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const features = declarableFeatures(state);
  if (features.length === 0) return { state: finish(state, pending) };
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: HANA_MUGEN_DECLARE,
        kind: "declare_number",
        validInstanceIds: features,
        selectedInstanceIds: [instanceId],
        optional: false,
      },
    },
    log: logFor(state, playerId, pending.sourceCardId, `${HANA_MUGEN}:${instanceId}`),
  };
};
CHOICE_SKIPPERS[HANA_MUGEN] = simpleSkip("RS-461");

CHOICE_RESOLVERS[HANA_MUGEN_DECLARE] = (state, playerId, feature) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(feature)) return { error: "invalid_target" };
  const target = pending.selectedInstanceIds?.[0];
  if (!target) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) =>
    addTurnFeatureModifier(p, KIRIGAKURE_RULE_ID, { instanceId: target, features: [feature] }, pending.sourceCardId),
  );
  return { state: finish(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${HANA_MUGEN_DECLARE}:${feature}`) };
};

// ---------------------------------------------------------------------------
// RS-462 花忍者サクラ【くノ一ミサイル】・RS-463 花忍者アヤメ【絡め取る縄】
// 「自分の手札からカードを1枚選び、相手に見せてもよい。そうしたとき、見せたカードの＜条件＞敵軍ユニットがあれば、相手はその中から
//  1体選び撃破するか、＜代わりの処理＞かを選ぶ。」（atwiki/page-825・page-747）
// - RS-462: 見せたカードの特徴と同じ特徴を2つ以上持つ敵軍ユニット／1点ダメージを受ける
// - RS-463: 見せたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ユニット／自分自身の手札を1枚選び捨札にする

const SHOW_HAND = "rs462_show_hand";
const OPPONENT_PICK = "rs462_opponent_destroy_or_penalty";
const OPPONENT_DISCARD = "rs463_opponent_discard_hand";
/** 相手の選択肢: 撃破のかわりに 1点ダメージを受ける（RS-462）。 */
export const TAKE_DAMAGE_OPTION = "take_damage";
/** 相手の選択肢: 撃破のかわりに自分自身の手札を1枚捨札にする（RS-463）。 */
export const DISCARD_HAND_OPTION = "discard_hand";

type ShowVariant = { effectId: string; matches: (state: GameState, shown: CardDefinition | undefined, ownerId: PlayerId, unit: CardInstance) => boolean; penalty: string };

const SHOW_VARIANTS: Record<string, ShowVariant> = {
  "RS-462": {
    effectId: "kunomisairu",
    matches: (state, shown, ownerId, unit) => {
      const shownFeatures = new Set(shown?.features ?? []);
      return unitFeatures(state, ownerId, unit).filter((f) => shownFeatures.has(f)).length >= 2;
    },
    penalty: TAKE_DAMAGE_OPTION,
  },
  "RS-463": {
    effectId: "meru",
    matches: (state, shown, ownerId, unit) =>
      shown !== undefined && parsePowerCost(shown.powerCost) === unitPowerCostNumber(state, ownerId, unit),
    penalty: DISCARD_HAND_OPTION,
  },
};

for (const [cardId, variant] of Object.entries(SHOW_VARIANTS)) {
  NC_HANDLERS[cardId] = {
    effectId: variant.effectId,
    apply: (state, playerId, card) => {
      const hand = state.players[playerId].hand.map((c) => c.instanceId);
      if (hand.length === 0) return state;
      return openEffectChoice(state, {
        playerId,
        effectId: SHOW_HAND,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        kind: "select_hand",
        phasePlayerId: playerId,
        validInstanceIds: hand,
        selectCount: 1,
        optional: true,
      });
    },
  };
}

CHOICE_RESOLVERS[SHOW_HAND] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const shownCard = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!shownCard) return { error: "invalid_target" };
  const variant = SHOW_VARIANTS[pending.sourceCardId];
  if (!variant) return { error: "invalid_target" };
  const shown = getDefinition(state.definitions, shownCard.cardId);
  const log = logFor(state, playerId, pending.sourceCardId, `${SHOW_HAND}:${cardName(state.definitions, shownCard.cardId)}`);
  const enemyId = opponent(playerId);
  const candidates = fieldUnits(state, enemyId)
    .filter((c) => isUnitCard(state, c.cardId) && variant.matches(state, shown, enemyId, c))
    .map((c) => c.instanceId);
  if (candidates.length === 0) return { state: finish(state, pending), log };
  const options = [...candidates];
  if (variant.penalty === TAKE_DAMAGE_OPTION || state.players[enemyId].hand.length > 0) options.push(variant.penalty);
  return {
    state: openEffectChoice(
      { ...state, pendingEffectChoice: undefined },
      {
        playerId: enemyId,
        effectId: OPPONENT_PICK,
        sourceCardId: pending.sourceCardId,
        sourceInstanceId: pending.sourceInstanceId,
        kind: "select_unit",
        phasePlayerId: pending.phasePlayerId,
        validInstanceIds: options,
        selectCount: 1,
        optional: false,
        resumeChoice: pending.resumeChoice,
      },
    ),
    log,
  };
};
CHOICE_SKIPPERS[SHOW_HAND] = (state, playerId) => simpleSkip(state.pendingEffectChoice!.sourceCardId)(state, playerId);

CHOICE_RESOLVERS[OPPONENT_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  if (instanceId === TAKE_DAMAGE_OPTION) {
    const damaged = applyDamageToPlayer(cleared, playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
    return { state: finish(damaged, pending), log: logFor(state, playerId, pending.sourceCardId, `${OPPONENT_PICK}:damage`) };
  }
  if (instanceId === DISCARD_HAND_OPTION) {
    const hand = state.players[playerId].hand.map((c) => c.instanceId);
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, effectId: OPPONENT_DISCARD, kind: "select_hand", validInstanceIds: hand },
        activePlayer: playerId,
      },
      log: logFor(state, playerId, pending.sourceCardId, `${OPPONENT_PICK}:discard_hand`),
    };
  }
  const target = findAnywhere(state, instanceId);
  const destroyed = destroyByEffect(cleared, instanceId, pending.phasePlayerId);
  return {
    state: finish(destroyed, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${OPPONENT_PICK}:${target ? cardName(state.definitions, target.cardId) : instanceId}`),
  };
};

CHOICE_RESOLVERS[OPPONENT_DISCARD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, card],
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${OPPONENT_DISCARD}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RS-464 花忍者ユリ【斬撃の回避】（NC）

NC_HANDLERS["RS-464"] = {
  effectId: "zan_geki_no",
  apply: (state, playerId, card) =>
    patchPlayer(state, playerId, (p) =>
      addNextTurnRuleModifier(p, ZANGEKI_RULE_ID, { sourceCardId: card.cardId, payload: { instanceId: card.instanceId } }),
    ),
};

// ---------------------------------------------------------------------------
// RS-471 グランドライナー ※
// 「敵軍ターン中、これが撃破されて捨札になったとき、自軍コマンドゾーンに特徴「メカ」を持つMユニットのカードがあれば、その中から
//  好きな枚数選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-789。必要パワー等を無視して出せる — 同コメント）
// 1枚ずつ選び、確定で終える（rules/leaveEffects.ts から開く）。

export const GRAND_LINER_RUSH = "grand_liner_mecha_rush";

export function openGrandLinerRush(state: GameState, ownerId: PlayerId, sourceCardId: string, phasePlayerId: PlayerId): GameState | null {
  const valid = state.players[ownerId].command
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && unitSizeOf(state.definitions, c) === "M" && (def.features ?? []).includes("メカ");
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ownerId,
    effectId: GRAND_LINER_RUSH,
    sourceCardId,
    kind: "select_commands",
    phasePlayerId,
    validInstanceIds: valid,
    selectCount: valid.length,
    selectedInstanceIds: [],
    commandFilter: "any",
    commandAction: "rush",
    optional: true,
  });
}

function finishGrandLiner(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = (pending.selectedInstanceIds ?? []).filter((id) => state.players[playerId].command.some((c) => c.instanceId === id));
  let next = patchPlayer(state, playerId, (p) => {
    const moved = p.command
      .filter((c) => selected.includes(c.instanceId))
      .map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }) as CardInstance);
    return { ...p, command: p.command.filter((c) => !selected.includes(c.instanceId)), rush: [...p.rush, ...moved] };
  });
  const log = logFor(state, playerId, pending.sourceCardId, `${GRAND_LINER_RUSH}:${selected.length}`);
  next = { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  if (selected.length > 0) next = finalizeEffectRush(next, playerId, selected, pending.phasePlayerId).state;
  return { state: finish(next, { ...pending }), log };
}

CHOICE_RESOLVERS[GRAND_LINER_RUSH] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (!pending.validInstanceIds.includes(instanceId) || selected.includes(instanceId)) return { error: "invalid_target" };
  const nextSelected = [...selected, instanceId];
  const withSelected: GameState = {
    ...state,
    pendingEffectChoice: {
      ...pending,
      selectedInstanceIds: nextSelected,
      validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
    },
  };
  if (nextSelected.length >= (pending.selectCount ?? 1)) return finishGrandLiner(withSelected, playerId);
  return { state: withSelected };
};
CHOICE_CONFIRMERS[GRAND_LINER_RUSH] = (state, playerId) => finishGrandLiner(state, playerId);
CHOICE_SKIPPERS[GRAND_LINER_RUSH] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  if ((pending.selectedInstanceIds ?? []).length > 0) return finishGrandLiner(state, playerId);
  return simpleSkip(pending.sourceCardId)(state, playerId);
};

// ---------------------------------------------------------------------------
// RS-473 タイムシャドウ【ブルームーンスラッシュ】
// 「これが自軍バトルエリアにある間、敵軍ターン中、相手がパワーゾーンにカードを置かずにチャージフェイズを終えたとき、
//  敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が2以下のカードを1枚選び、ダメージにしてもよい。」（atwiki/page-791）
// チャージフェイズの終わり（core/applyAction.ts）で、パワーゾーンに置かなかったときに呼ぶ。

const BLUE_MOON_RE = /これが自軍バトルエリアにある間、敵軍ターン中、相手がパワーゾーンにカードを置かずにチャージフェイズを終えたとき、敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が(\d+)以下のカードを1枚選び、ダメージにしてもよい/;
const BLUE_MOON = "rs473_blue_moon_slash";

export function openBlueMoonSlash(state: GameState, chargingPlayerId: PlayerId): GameState {
  const ownerId = opponent(chargingPlayerId);
  let next = state;
  for (const source of state.players[ownerId].battle) {
    const m = normText(getDefinition(state.definitions, source.cardId)?.text).match(BLUE_MOON_RE);
    if (!m) continue;
    const max = Number(m[1]);
    const valid = next.players[chargingPlayerId].power
      .filter((c) => !c.faceDown && parsePowerCost(getDefinition(next.definitions, c.cardId)?.powerCost) <= max)
      .map((c) => c.instanceId);
    if (valid.length === 0) continue;
    const choice: PendingEffectChoice = {
      playerId: ownerId,
      effectId: BLUE_MOON,
      sourceCardId: source.cardId,
      sourceInstanceId: source.instanceId,
      kind: "select_power",
      phasePlayerId: chargingPlayerId,
      validInstanceIds: valid,
      selectCount: 1,
      optional: true,
    };
    next = next.pendingEffectChoice
      ? { ...next, pendingEffectChoice: { ...next.pendingEffectChoice, resumeChoice: next.pendingEffectChoice.resumeChoice ?? choice } }
      : openEffectChoice(next, choice);
  }
  return next;
}

CHOICE_RESOLVERS[BLUE_MOON] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, enemyId, (p) => {
    const power = p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c));
    return { ...p, power, damage: Math.max(p.damage + 1, power.filter((c) => c.faceDown).length) };
  });
  return { state: finish(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${BLUE_MOON}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[BLUE_MOON] = simpleSkip("RS-473");
