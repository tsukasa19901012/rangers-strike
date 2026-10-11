/**
 * 第9弾「蒼九の翼」（legend1）RS-670〜RS-690 のカード固有の名前付き効果と継続効果（cardSpec RS9-670-690 の監査）。
 *
 * - `trySet9DCardEffect`: DSL の grant_keyword から呼ばれる起点（`set9d::cardId::name`）。
 * - `tryResolveSet9DChoice` / `trySkipSet9DChoice`: このモジュールが開いた選択の解決。
 * - 継続効果・誘発（BP、敵軍ラッシュエリアへのアタック、撃破されて捨札になったとき、チャージフェイズにパワーへ置いたとき）。
 * 構成は rules/legend1/set8NamedEffectsD.ts と同じ。
 */
import type { CardInstance, DeferredDestroyTrigger, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice, requestDrawFromDeck } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { shuffleCards } from "../errataCardEffects";
import { startGenericEnemyUnitChoice } from "../rs/rsCatchallChoices";
import { isSmallUnitNow } from "./set6NamedEffectsB";
import { namedTextNegated } from "./set6NamedEffects348";
import { riddenVehicleGrantsResist } from "./set7NamedEffectsB";
import { set8BGrantsResist } from "./set8NamedEffectsB";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet9DChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet9DChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet9DChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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
    sourceInstanceId: ctx.triggerSourceInstanceId,
    selectedInstanceIds: [] as string[],
  };
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function isUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function findField(state: GameState, playerId: PlayerId, instanceId: string): { zone: "battle" | "rush"; card: CardInstance } | undefined {
  for (const zone of ["battle", "rush"] as const) {
    const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

/** 効果名を持つテキストが、いま有効か（RS-603 等で無効になっていない）。 */
function namedTextLive(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return !namedTextNegated(state, ownerId, card);
}

/** 「レジストを持つ」ユニットか（本文の※レジスト・効果で得たレジストを含む）。 */
function unitHasResist(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  if (cardHasRegisterKeyword(state, card.cardId, ownerId)) return true;
  if (riddenVehicleGrantsResist(state, ownerId, card.instanceId)) return true;
  return set8BGrantsResist(state, ownerId, card.instanceId);
}

function unitHasWing(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return cardHasKeyword(state.definitions, card.cardId, "wing", { state, playerId: ownerId });
}

/** 「すべて〜してもよい」の「行う」を1つの選択肢にした確認（選択肢の値は effectId。UI は「効果を使う」と表示する）。 */
function openDoAllConfirm(state: GameState, ctx: GrantKeywordContext, sourceCardId: string, effectId: string): GameState {
  return openEffectChoice(state, {
    ...choiceBase(ctx, sourceCardId),
    effectId,
    kind: "confirm",
    validInstanceIds: [effectId],
    selectCount: 1,
    optional: true,
  });
}

// ---------------------------------------------------------------------------
// RS-672 ゴローダーGT【ゴローダーアタック！】（ジョイントコンビネーション R）
// 「これがカード名に「ゴーオン」または「エンジンオー」を含むユニットからコンビネーションするとき、次の効果を発動できる⇒
//  コンビネーションしたユニットのBP以下のBPを持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに置く。」（atwiki/page-1521）
// 相手の条件は cards/src/jointComboPartner.ts（name_contains）。発動しないこと（見送り）ができる。候補は敵軍のバトル・ラッシュエリア（R-TGT-01）。

export const GORODER_ATTACK_EFFECT_ID = "rs672_goroder_attack";

function applyGoroderAttack(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const battle = state.players[ctx.playerId].battle;
  const index = selfId ? battle.findIndex((c) => c.instanceId === selfId) : -1;
  const partner = index > 0 ? battle[index - 1] : undefined;
  if (!partner) return { state, detail: `${GORODER_ATTACK_EFFECT_ID}:no_partner` };
  const maxBp = effectiveBp(state, ctx.playerId, partner);
  const opened = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: GORODER_ATTACK_EFFECT_ID,
    sourceCardId: "RS-672",
    sourceInstanceId: selfId,
    phasePlayerId: ctx.phasePlayerId,
    filter: { zone: "both", maxBp },
    destination: "power",
    optional: true,
  });
  if (!opened) return { state, detail: `${GORODER_ATTACK_EFFECT_ID}:no_targets` };
  return { state: opened, detail: GORODER_ATTACK_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RS-673 ボンパー【炎神キャスト転送】
// 「これが自軍エリアにある間、自軍チャージフェイズ中、自軍パワーゾーンにカードを置いたとき、置いたカード以外のオモテ向きの自軍パワーから、
//  特徴「炎神」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-1443）
// core/applyAction.ts の charge_power（チャージフェイズにパワーへ置いた）から呼ぶ。ボンパーが複数あればそれぞれ発動する。

export const CAST_TRANSFER_EFFECT_ID = "rs673_cast_transfer";

function castTransferCandidates(state: GameState, playerId: PlayerId, placedInstanceId: string): string[] {
  return state.players[playerId].power
    .filter((c) => !c.faceDown && c.instanceId !== placedInstanceId)
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "M" && (def.features ?? []).includes("炎神");
    })
    .map((c) => c.instanceId);
}

function castTransferSources(state: GameState, playerId: PlayerId, done: string[]): CardInstance[] {
  return fieldUnits(state, playerId).filter(
    (c) => c.cardId === "RS-673" && !done.includes(c.instanceId) && namedTextLive(state, playerId, c),
  );
}

function castTransferChoice(
  state: GameState,
  playerId: PlayerId,
  placedInstanceId: string,
  done: string[],
): PendingEffectChoice | undefined {
  const source = castTransferSources(state, playerId, done)[0];
  if (!source) return undefined;
  const ids = castTransferCandidates(state, playerId, placedInstanceId);
  if (ids.length === 0) return undefined;
  return {
    playerId,
    phasePlayerId: playerId,
    sourceCardId: "RS-673",
    sourceInstanceId: source.instanceId,
    effectId: CAST_TRANSFER_EFFECT_ID,
    kind: "select_power",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
    // 置いたカード（候補から除く）と、発動済みのボンパー。
    processedInstanceIds: [placedInstanceId, ...done, source.instanceId],
  };
}

/** 自軍チャージフェイズにパワーゾーンへカードを置いたとき（core/applyAction.ts charge_power から呼ぶ）。 */
export function openCastTransferOnCharge(state: GameState, playerId: PlayerId, placedInstanceId: string): GameState {
  const choice = castTransferChoice(state, playerId, placedInstanceId, []);
  return choice ? openOrQueue(state, choice) : state;
}

function continueCastTransfer(state: GameState, pending: PendingEffectChoice): GameState {
  const [placed, ...done] = pending.processedInstanceIds ?? [];
  const next = placed ? castTransferChoice(state, pending.playerId, placed, done) : undefined;
  if (!next) return proceed(state, pending);
  return openEffectChoice(state, { ...next, resumeChoice: pending.resumeChoice });
}

CHOICE_RESOLVERS[CAST_TRANSFER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const moved = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  const rushed = finalizeEffectRush(moved, playerId, [instanceId], pending.phasePlayerId);
  const next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  const log = logFor(state, playerId, "RS-673", `${CAST_TRANSFER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (next.pendingEffectChoice) return { state: proceed(next, pending), log };
  return { state: continueCastTransfer(next, pending), log };
};
CHOICE_SKIPPERS[CAST_TRANSFER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: continueCastTransfer(close(state, pending), pending), log: skipLog(state, playerId, "RS-673", CAST_TRANSFER_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RS-674 シンケンレッド【烈火大斬刀】「SP1」「DAを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-1421）
// 「SP1」は DSL の SP1。候補は敵軍のバトル・ラッシュエリア（R-TGT-01）。強制。

export const REKKA_DAIZANTO_EFFECT_ID = "rs674_rekka_daizanto";

function applyRekkaDaizanto(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const opened = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: REKKA_DAIZANTO_EFFECT_ID,
    sourceCardId: "RS-674",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter: { zone: "both", size: "S", category: "DA" },
    destination: "discard",
    optional: false,
  });
  if (!opened) return { state, detail: `${REKKA_DAIZANTO_EFFECT_ID}:no_targets` };
  return { state: opened, detail: REKKA_DAIZANTO_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RS-675 シンケンブルー【ウォーターアロー】（NC）「これは敵軍ラッシュエリアのユニットにアタックできる。」（atwiki/page-1425）
// NC が成立したときだけ（R-CN-02）。成立したユニットに印を付け、rules/legend3/restrictions.ts から参照する。

const WATER_ARROW_MARK = "rs675_water_arrow";

function applyWaterArrow(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: `${WATER_ARROW_MARK}:no_source` };
  const next = patchPlayer(state, ctx.playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) =>
      c.instanceId === id && !(c.activatedNcEffects ?? []).includes(WATER_ARROW_MARK)
        ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), WATER_ARROW_MARK] }
        : c,
    ),
  }));
  return { state: next, detail: WATER_ARROW_MARK };
}

/** 敵軍ラッシュエリアのユニットにアタックできるか（rules/legend3/restrictions.ts から呼ぶ）。 */
export function set9DAllowsRushAttack(state: GameState, attackerPlayerId: PlayerId, attacker: CardInstance, defenderPlayerId: PlayerId): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  if (attacker.cardId !== "RS-675") return false;
  if (!(attacker.activatedNcEffects ?? []).includes(WATER_ARROW_MARK)) return false;
  return namedTextLive(state, attackerPlayerId, attacker);
}

// ---------------------------------------------------------------------------
// RS-676 シンケンピンク【ヘブンファン】「SP1」「自分も相手も1枚ドローする。」（atwiki/page-1428）

function applyHeavenFan(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const own = requestDrawFromDeck(state, ctx.playerId, ctx.phasePlayerId, { sourceCardId: "RS-676" });
  const enemy = requestDrawFromDeck(own.state, opponent(ctx.playerId), ctx.phasePlayerId, { sourceCardId: "RS-676" });
  return { state: enemy.state, detail: "rs676_heaven_fan" };
}

// ---------------------------------------------------------------------------
// RS-678 シンケンイエロー【ランドスライサー】（NC）
// 「このターン、次に自軍Sユニットが撃破されて捨札になったとき、そのカードを手札に戻してもよい。」（atwiki/page-1427）
// Q1: 1回だけ（次に撃破されて捨札になった1体）。戻すかどうかに関わらず、そこで使い終わる。
// rules/leaveEffects.ts resolveAfterDiscardDestroyEffects（段階 4「撃破されて捨札になったとき」）から呼ぶ。

const LAND_SLICER_RULE = "rs678_land_slicer";
export const LAND_SLICER_EFFECT_ID = "rs678_land_slicer";

function applyLandSlicer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const next = patchPlayer(state, ctx.playerId, (p) =>
    addTurnRuleModifier(p, LAND_SLICER_RULE, { sourceCardId: "RS-678", payload: { sourceInstanceId: ctx.triggerSourceInstanceId } }),
  );
  return { state: next, detail: LAND_SLICER_RULE };
}

export function applySet9DAfterDiscard(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; instanceId: string; cardId: string; phasePlayerId: PlayerId; destroyed?: boolean },
): GameState {
  if (ctx.destroyed === false) return state;
  const owner = state.players[ctx.ownerPlayerId];
  const pending = getPlayerModifiers(owner).filter((m) => m.kind === "rule" && m.ruleId === LAND_SLICER_RULE && m.scope === "turn");
  if (pending.length === 0) return state;
  if (!owner.discard.some((c) => c.instanceId === ctx.instanceId)) return state;
  const def = getDefinition(state.definitions, ctx.cardId);
  if (def?.type !== "unit" || def.size !== "S") return state;
  // 「次に」— この1回で使い終わる（戻すかどうかを問わない。atwiki/page-1427 Q&A A1）。
  const consumed = patchPlayer(state, ctx.ownerPlayerId, (p) => ({
    ...p,
    modifiers: getPlayerModifiers(p).filter((m) => !(m.kind === "rule" && m.ruleId === LAND_SLICER_RULE && m.scope === "turn")),
  }));
  const choice: PendingEffectChoice = {
    playerId: ctx.ownerPlayerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: "RS-678",
    effectId: LAND_SLICER_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [ctx.instanceId],
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  };
  return openOrQueue(consumed, choice);
}

CHOICE_RESOLVERS[LAND_SLICER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "RS-678", `${LAND_SLICER_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : instanceId}`);
  if (!card) return { state: proceed(cleared, pending), log };
  const moved = patchPlayer(cleared, playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(moved, pending), log };
};
CHOICE_SKIPPERS[LAND_SLICER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-679 シンケンオー【ダイシンケン】
// 「自軍ターン中、これがバトルエリアに出たとき、相手は自分自身のバトルエリアからユニットを1体選び、自分自身のパワーゾーンにダメージにして置く。」
// （atwiki/page-1485）— 選ぶのは相手。強制。ダメージにして置くのは汎用の placeAsDamage（rules/pendingChoices.ts）。

export const DAISHINKEN_EFFECT_ID = "rs679_daishinken";

function applyDaishinken(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${DAISHINKEN_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle.filter((c) => isUnit(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${DAISHINKEN_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RS-679"),
      playerId: enemyId,
      effectId: DAISHINKEN_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "power",
      placeAsDamage: true,
    }),
    detail: DAISHINKEN_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RS-681 龍折神【押し寄せる水流】（NC）
// 「敵軍ラッシュエリアのホールド状態のユニットをすべて持ち主の山札に戻してシャッフルしてもよい。」（atwiki/page-1481）

export const SURGING_WATER_EFFECT_ID = "rs681_surging_water";

function surgingWaterTargets(state: GameState, playerId: PlayerId): CardInstance[] {
  return state.players[opponent(playerId)].rush.filter((c) => c.commandHeld && isUnit(state, c.cardId));
}

function applySurgingWater(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (surgingWaterTargets(state, ctx.playerId).length === 0) return { state, detail: `${SURGING_WATER_EFFECT_ID}:no_targets` };
  return { state: openDoAllConfirm(state, ctx, "RS-681", SURGING_WATER_EFFECT_ID), detail: SURGING_WATER_EFFECT_ID };
}

CHOICE_RESOLVERS[SURGING_WATER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const targets = surgingWaterTargets(state, playerId);
  const ids = new Set(targets.map((c) => c.instanceId));
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    rush: p.rush.filter((c) => !ids.has(c.instanceId)),
    deck: shuffleCards([...p.deck, ...targets.map(stripForZone)]),
    discard: [...p.discard, ...targets.flatMap((c) => c.stackedCards ?? []).map(stripForZone)],
  }));
  for (const card of targets) {
    const left = emitUnitLeftZoneAndResolve(next, {
      ownerPlayerId: enemyId,
      instanceId: card.instanceId,
      cardId: card.cardId,
      fromZone: "rush",
      toZone: "deck",
      phasePlayerId: pending.phasePlayerId,
      destroyed: false,
    });
    next = { ...left.state, log: [...left.state.log, ...left.logs] };
  }
  const log = logFor(state, playerId, "RS-681", `${SURGING_WATER_EFFECT_ID}:${targets.map((c) => cardName(state.definitions, c.cardId)).join("、")}`);
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[SURGING_WATER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-682 亀折神【堅牢なる甲羅】（NC）「レジストを持つ自軍Mユニットを1体選び、リリースしてもよい。」（atwiki/page-1482）

export const STURDY_SHELL_EFFECT_ID = "rs682_sturdy_shell";

function applySturdyShell(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => getDefinition(state.definitions, c.cardId)?.size === "M" && isUnit(state, c.cardId))
    .filter((c) => unitHasResist(state, ctx.playerId, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${STURDY_SHELL_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RS-682"),
      effectId: STURDY_SHELL_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: STURDY_SHELL_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[STURDY_SHELL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findField(state, playerId, instanceId);
  if (!found) return { error: "invalid_target" };
  const released = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)),
  }));
  return { state: proceed(released, pending), log: logFor(state, playerId, "RS-682", `${STURDY_SHELL_EFFECT_ID}:release:${cardName(state.definitions, found.card.cardId)}`) };
};
CHOICE_SKIPPERS[STURDY_SHELL_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-684 猿折神【軽業】（NC）
// 「敵軍Sユニットが6体以上あれば、BPの一番低い敵軍ユニットを1体選び、持ち主の山札の上に戻してもよい。」（atwiki/page-1484）
// 数えるのも選ぶのも敵軍のバトル・ラッシュエリア（R-TGT-01）。BP は効果を含めた値。

export const ACROBATICS_EFFECT_ID = "rs684_acrobatics";

function applyAcrobatics(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const units = fieldUnits(state, enemyId).filter((c) => isUnit(state, c.cardId));
  const sCount = units.filter((c) => isSmallUnitNow(state, enemyId, c)).length;
  if (sCount < 6) return { state, detail: `${ACROBATICS_EFFECT_ID}:s_units_${sCount}` };
  if (units.length === 0) return { state, detail: `${ACROBATICS_EFFECT_ID}:no_targets` };
  const lowest = Math.min(...units.map((c) => effectiveBp(state, enemyId, c)));
  const ids = units
    .filter((c) => effectiveBp(state, enemyId, c) === lowest)
    .filter((c) => isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${ACROBATICS_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RS-684"),
      effectId: ACROBATICS_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "deck_top",
    }),
    detail: ACROBATICS_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RS-687 ギンガイオー【ガルコンボーガン】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する。」（atwiki/page-1433）

export const GARCON_BOWGUN_EFFECT_ID = "rs687_garcon_bowgun";

function applyGarconBowgun(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${GARCON_BOWGUN_EFFECT_ID}:not_own_turn` };
  const opened = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: GARCON_BOWGUN_EFFECT_ID,
    sourceCardId: "RS-687",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter: { zone: "rush", maxBp: 4000 },
    destination: "discard",
    optional: false,
  });
  if (!opened) return { state, detail: `${GARCON_BOWGUN_EFFECT_ID}:no_targets` };
  return { state: opened, detail: GARCON_BOWGUN_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RS-688 ギガフェニックス【ギガニックブーメラン】
// 「これをラッシュしたとき、レジストまたはウイングを持つ敵軍ユニットをすべてホールドしてもよい。」（atwiki/page-1498）

export const GIGANIC_BOOMERANG_EFFECT_ID = "rs688_giganic_boomerang";

function boomerangTargets(state: GameState, playerId: PlayerId): { zone: "battle" | "rush"; card: CardInstance }[] {
  const enemyId = opponent(playerId);
  const out: { zone: "battle" | "rush"; card: CardInstance }[] = [];
  for (const zone of ["battle", "rush"] as const) {
    for (const card of state.players[enemyId][zone]) {
      if (card.commandHeld || !isUnit(state, card.cardId)) continue;
      if (unitHasResist(state, enemyId, card) || unitHasWing(state, enemyId, card)) out.push({ zone, card });
    }
  }
  return out;
}

function applyGiganicBoomerang(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (boomerangTargets(state, ctx.playerId).length === 0) return { state, detail: `${GIGANIC_BOOMERANG_EFFECT_ID}:no_targets` };
  return { state: openDoAllConfirm(state, ctx, "RS-688", GIGANIC_BOOMERANG_EFFECT_ID), detail: GIGANIC_BOOMERANG_EFFECT_ID };
}

CHOICE_RESOLVERS[GIGANIC_BOOMERANG_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const targets = boomerangTargets(state, playerId);
  const ids = new Set(targets.map((t) => t.card.instanceId));
  const held = patchPlayer(close(state, pending), opponent(playerId), (p) => ({
    ...p,
    battle: p.battle.map((c) => (ids.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
    rush: p.rush.map((c) => (ids.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
  }));
  const log = logFor(state, playerId, "RS-688", `${GIGANIC_BOOMERANG_EFFECT_ID}:${targets.map((t) => cardName(state.definitions, t.card.cardId)).join("、")}`);
  return { state: proceed(held, pending), log };
};
CHOICE_SKIPPERS[GIGANIC_BOOMERANG_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-689 レッドホーク（2nd）【バードブラスター】（NC）
// 「このターン、ホールド状態の敵軍SユニットはBP-2500される。（BP0以下になったユニットは撃破される）」（atwiki/page-1531）
// ターンの間の継続効果（NC の後でホールドされたユニットも対象。評価欄）。BP0 以下の撃破はルール（R-BP-02。core/applyAction.ts）。

const BIRD_BLASTER_RULE = "rs689_bird_blaster";

function applyBirdBlaster(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const next = patchPlayer(state, ctx.playerId, (p) => addTurnRuleModifier(p, BIRD_BLASTER_RULE, { sourceCardId: "RS-689" }));
  return { state: next, detail: BIRD_BLASTER_RULE };
}

/** BP の継続効果（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ）。 */
export function set9DFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (!instance.commandHeld) return 0;
  const enemy = state.players[opponent(playerId)];
  const blasters = getPlayerModifiers(enemy).filter((m) => m.kind === "rule" && m.ruleId === BIRD_BLASTER_RULE && m.scope === "turn").length;
  if (blasters === 0) return 0;
  if (!fieldUnits(state, playerId).some((c) => c.instanceId === instance.instanceId)) return 0;
  if (!isSmallUnitNow(state, playerId, instance)) return 0;
  return -2500 * blasters;
}

// ---------------------------------------------------------------------------
// RS-690 スペードエース【スペードアーツ】（NC）
// 「敵軍バトルエリアと敵軍ラッシュエリアから、同じBPを持つSユニットを1体ずつ選んでもよい。そうしたとき、選んだユニットを持ち主の
//  コマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1490）
// 1体目（バトルエリア）を選んだら、2体目（ラッシュエリア）は同じ BP のものから必ず選ぶ。置けなければ捨札（R-ZONE-08。撃破ではない）。

export const SPADE_ARTS_EFFECT_ID = "rs690_spade_arts";
export const SPADE_ARTS_RUSH_EFFECT_ID = "rs690_spade_arts_rush";

function spadeSUnits(state: GameState, actorId: PlayerId, zone: "battle" | "rush"): CardInstance[] {
  const enemyId = opponent(actorId);
  return state.players[enemyId][zone].filter(
    (c) => isUnit(state, c.cardId) && isSmallUnitNow(state, enemyId, c) && isSelectableByOpponentEffect(state, actorId, c.instanceId),
  );
}

function spadeRushMates(state: GameState, actorId: PlayerId, battleCard: CardInstance): string[] {
  const enemyId = opponent(actorId);
  const bp = effectiveBp(state, enemyId, battleCard);
  return spadeSUnits(state, actorId, "rush")
    .filter((c) => effectiveBp(state, enemyId, c) === bp)
    .map((c) => c.instanceId);
}

function applySpadeArts(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = spadeSUnits(state, ctx.playerId, "battle")
    .filter((c) => spadeRushMates(state, ctx.playerId, c).length > 0)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${SPADE_ARTS_EFFECT_ID}:no_pairs` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase(ctx, "RS-690"),
      effectId: SPADE_ARTS_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: SPADE_ARTS_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SPADE_ARTS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findField(state, opponent(playerId), instanceId);
  if (!found) return { error: "invalid_target" };
  const mates = spadeRushMates(state, playerId, found.card);
  if (mates.length === 0) return { error: "invalid_target" };
  const next = openEffectChoice(close(state, pending), {
    ...pending,
    effectId: SPADE_ARTS_RUSH_EFFECT_ID,
    validInstanceIds: mates,
    selectedInstanceIds: [instanceId],
    optional: false,
  });
  return { state: next, log: logFor(state, playerId, "RS-690", `${SPADE_ARTS_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`) };
};
CHOICE_SKIPPERS[SPADE_ARTS_EFFECT_ID] = simpleSkip();

/** 敵軍のユニットを持ち主のコマンドゾーンにホールド状態で置く（置けなければ捨札）。 */
function placeInOwnerCommand(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const found = findField(state, ownerId, instanceId);
  if (!found) return state;
  const owner = state.players[ownerId];
  const toCommand = owner.command.length < COMMAND_ZONE_MAX;
  const moved = patchPlayer(state, ownerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].filter((c) => c.instanceId !== instanceId),
    command: toCommand ? [...p.command, { ...stripForZone(found.card), commandHeld: true }] : p.command,
    discard: [...p.discard, ...(toCommand ? [] : [stripForZone(found.card)]), ...(found.card.stackedCards ?? []).map(stripForZone)],
  }));
  const left = emitUnitLeftZoneAndResolve(moved, {
    ownerPlayerId: ownerId,
    instanceId,
    cardId: found.card.cardId,
    fromZone: found.zone,
    toZone: toCommand ? "command" : "discard",
    phasePlayerId,
    destroyed: false,
  });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

CHOICE_RESOLVERS[SPADE_ARTS_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const first = pending.selectedInstanceIds?.[0];
  let next = close(state, pending);
  const names: string[] = [];
  for (const id of [first, instanceId]) {
    if (!id) continue;
    const found = findField(next, enemyId, id);
    if (!found) continue;
    names.push(cardName(state.definitions, found.card.cardId));
    next = placeInOwnerCommand(next, enemyId, id, pending.phasePlayerId);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-690", `${SPADE_ARTS_EFFECT_ID}:${names.join("、")}`) };
};

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const SET9D_KEYWORD_PREFIX = "set9d::";

const SET9D_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RS-672::goroder_attack": applyGoroderAttack,
  // 継続（誘発）効果は core/applyAction.ts の charge_power で扱う（ここでは何もしない）。
  "RS-673::cast_transfer": (state) => ({ state, detail: CAST_TRANSFER_EFFECT_ID }),
  "RS-674::rekka_daizanto": applyRekkaDaizanto,
  "RS-675::water_arrow": applyWaterArrow,
  "RS-676::heaven_fan": applyHeavenFan,
  "RS-678::land_slicer": applyLandSlicer,
  "RS-679::daishinken": applyDaishinken,
  "RS-681::surging_water": applySurgingWater,
  "RS-682::sturdy_shell": applySturdyShell,
  "RS-684::acrobatics": applyAcrobatics,
  "RS-687::garcon_bowgun": applyGarconBowgun,
  "RS-688::giganic_boomerang": applyGiganicBoomerang,
  "RS-689::bird_blaster": applyBirdBlaster,
  "RS-690::spade_arts": applySpadeArts,
};

export function trySet9DCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET9D_KEYWORD_PREFIX)) return null;
  const handler = SET9D_KEYWORDS[keyword.slice(SET9D_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールが開いた選択（汎用の解決に任せるものを含む）の CPU の手。対象外なら null。 */
export function pickSet9DCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  const own = pending.effectId in CHOICE_RESOLVERS;
  const generic = [GORODER_ATTACK_EFFECT_ID, REKKA_DAIZANTO_EFFECT_ID, DAISHINKEN_EFFECT_ID, ACROBATICS_EFFECT_ID, GARCON_BOWGUN_EFFECT_ID].includes(
    pending.effectId,
  );
  if (!own && !generic) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const picks = actions.filter((a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice");
  if (picks.length === 0) return skip ?? null;
  const me = pending.playerId;
  const bpOf = (id: string): number => {
    for (const pid of ["player1", "player2"] as const) {
      const card = fieldUnits(state, pid).find((c) => c.instanceId === id);
      if (card) return effectiveBp(state, pid, card);
      const other = [...state.players[pid].power, ...state.players[pid].discard].find((c) => c.instanceId === id);
      if (other) return getDefinition(state.definitions, other.cardId)?.bp ?? 0;
    }
    return 0;
  };
  const lowest = () => [...picks].sort((a, b) => bpOf(a.instanceId) - bpOf(b.instanceId))[0]!;
  const highest = () => [...picks].sort((a, b) => bpOf(b.instanceId) - bpOf(a.instanceId))[0]!;
  switch (pending.effectId) {
    case DAISHINKEN_EFFECT_ID:
      // 自分のユニットを失う側: BP の一番低いユニット。
      return lowest();
    case STURDY_SHELL_EFFECT_ID: {
      // ホールド中のユニットをリリースする（リリース状態のものを選んでも意味がない）。
      const heldPick = picks.find((a) => fieldUnits(state, me).some((c) => c.instanceId === a.instanceId && c.commandHeld));
      return heldPick ?? skip ?? null;
    }
    case SPADE_ARTS_EFFECT_ID:
    case SPADE_ARTS_RUSH_EFFECT_ID:
    case GORODER_ATTACK_EFFECT_ID:
    case REKKA_DAIZANTO_EFFECT_ID:
    case GARCON_BOWGUN_EFFECT_ID:
    case CAST_TRANSFER_EFFECT_ID:
      // 敵軍ユニットを除く・自軍に出す: 一番強いもの。
      return highest();
    case ACROBATICS_EFFECT_ID:
      return picks[0]!;
    default:
      // 手札に戻す・すべて戻す・すべてホールドする: 行って損のない効果は行う。
      return picks[0] ?? skip ?? null;
  }
}

