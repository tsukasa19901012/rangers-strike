/**
 * 第8弾「究極の八神」（legend1）RS-538〜RS-559 のカード固有の名前付き効果と継続効果（cardSpec RS8-538-559 の監査）。
 *
 * - `trySet8BCardEffect`: DSL の grant_keyword から呼ばれる起点（`set8b::cardId::name`、または effect_card の
 *   キーワードを汎用の catchall より先に受ける）。
 * - `tryResolveSet8BChoice` / `trySkipSet8BChoice`: このモジュールが開いた選択の解決。
 * - 継続効果（L ユニット化、レジストの付与、ナンバーの増加、アタックされない制限、バトルエリアへの進入の強制・禁止）。
 * 判定はできるだけカードの文言（正規化した本文）で行う。構成は rules/legend1/set7NamedEffectsD.ts と同じ。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isLargeUnit, parsePowerCost, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { countAvailablePower } from "../../core/power";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { listDslEffectsForTrigger } from "../../dsl/effectLookup";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { appendResumeChoice, applyConfirmEffectChoice, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { deckOrderChoice } from "../deckOrder";
import { unitFeatures } from "../addedFeatures";
import { blockRushAreaEntry } from "./set5NamedEffects";
import { isSmallUnitNow, turnPlayerOf } from "./set6NamedEffectsB";
import { openMultiDestroy } from "./set7NamedEffectsD";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet8BChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet8BChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet8BChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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

/** 選択を開く。別の選択が開いていれば、その後に開く（resumeChoice の末尾に足す）。 */
function openOrQueue(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) {
    return { ...state, pendingEffectChoice: appendResumeChoice(state.pendingEffectChoice, choice) };
  }
  return openEffectChoice(state, choice);
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

const normalizedTextCache = new Map<string, string>();

function textOf(state: Pick<GameState, "definitions">, cardId: string): string {
  const raw = getDefinition(state.definitions, cardId)?.text ?? "";
  let text = normalizedTextCache.get(raw);
  if (text === undefined) {
    text = raw.normalize("NFKC").replace(/\s+/g, "");
    normalizedTextCache.set(raw, text);
  }
  return text;
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function ownerOf(state: Pick<GameState, "players">, instanceId: string): PlayerId | null {
  for (const pid of ["player1", "player2"] as const) {
    if (fieldUnits(state, pid).some((c) => c.instanceId === instanceId)) return pid;
  }
  return null;
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

/** 「必要パワーに「＋」を持つ」か（例: 6+、8+）。 */
function powerCostHasPlus(def: CardDefinition | undefined): boolean {
  return typeof def?.powerCost === "string" && /[+＋]/.test(def.powerCost);
}

/** 敵軍のバトル・ラッシュエリアの、相手の効果で選べるユニット。 */
function selectableEnemyUnits(
  state: GameState,
  actorId: PlayerId,
  pred: (c: CardInstance, ownerId: PlayerId) => boolean,
  sourceCardId?: string,
): string[] {
  const enemyId = opponent(actorId);
  return fieldUnits(state, enemyId)
    .filter((c) => isUnitCard(state, c.cardId))
    .filter((c) => isSelectableByOpponentEffect(state, actorId, c.instanceId, sourceCardId))
    .filter((c) => pred(c, enemyId))
    .map((c) => c.instanceId);
}

/** 複数体を同時に撃破する（select_units_bp_budget の確定処理を共用。撃破の誘発による中断・再開もそちらが扱う）。 */
function destroySimultaneously(
  state: GameState,
  ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string; effectId: string },
  ids: string[],
  resumeChoice?: PendingEffectChoice,
): GameState {
  if (ids.length === 0) return resumeChoice ? openOrQueue(state, resumeChoice) : state;
  if (state.pendingEffectChoice) {
    // 別の選択が開いているとき: その後で撃破する選択として積む（確定済みの選択として開く）。
    return {
      ...state,
      pendingEffectChoice: appendResumeChoice(state.pendingEffectChoice, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.sourceInstanceId,
        kind: "select_units_bp_budget",
        phasePlayerId: ctx.phasePlayerId,
        validInstanceIds: ids,
        selectedInstanceIds: ids,
        bpBudget: Number.MAX_SAFE_INTEGER,
        optional: false,
        resumeChoice,
      }),
    };
  }
  const opened = openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    kind: "select_units_bp_budget",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectedInstanceIds: ids,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
    resumeChoice,
  });
  const confirmed = applyConfirmEffectChoice(opened, ctx.playerId);
  if ("error" in confirmed) return state;
  return confirmed.state;
}

// ---------------------------------------------------------------------------
// RS-538 ユイ・イブキ【頼れる指揮官】
// 「これが自軍ラッシュエリアにある間、敵軍ターン中、「ユイ・イブキ」以外のホールド状態の自軍ユニットが撃破されて捨札になったとき、
//  敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない。」（atwiki/page-1213）
// 発動後に敵軍ラッシュエリアに置かれたユニットにも及ぶ（grnrngr/faq-card-8 RS-538 Q1）— RS-320 と同じターンの規則で扱う。

const RELIABLE_COMMANDER_RE =
  /これが自軍ラッシュエリアにある間、敵軍ターン中、「([^」]+)」以外のホールド状態の自軍ユニットが撃破されて捨札になったとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない/;

/** ユニットが場を離れたあと（rules/operationCounters.ts finalizeLeavePending から呼ぶ）。 */
export function applySet8BAfterUnitLeft(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; card: CardInstance; toZone: string; destroyed: boolean },
): GameState {
  if (!ctx.destroyed || ctx.toZone !== "discard" || !ctx.card.commandHeld) return state;
  if (turnPlayerOf(state) === ctx.ownerPlayerId) return state;
  const owner = state.players[ctx.ownerPlayerId];
  if (!owner.discard.some((c) => c.instanceId === ctx.card.instanceId)) return state;
  if (!isUnitCard(state, ctx.card.cardId)) return state;
  const destroyedName = cardName(state.definitions, ctx.card.cardId);
  const source = owner.rush.find((c) => {
    const m = textOf(state, c.cardId).match(RELIABLE_COMMANDER_RE);
    return !!m && m[1] !== destroyedName;
  });
  if (!source) return state;
  return blockRushAreaEntry(state, opponent(ctx.ownerPlayerId), source.cardId);
}

// ---------------------------------------------------------------------------
// L ユニットになる継続効果
// - RS-539 ギョダーイ【再生巨大化能力】「これが自軍エリアにある間、本来の特徴に「怪人」を持つ自軍ユニットは、自軍捨札に
//   同じカード名のユニットカードがあれば、「Lユニット」になる。」（atwiki/page-1164）
// - RS-558 ガンマジン ※「自分か相手のLユニットがあれば、これはLユニットになり、BP+4000される。」（atwiki/page-1186）
//   「自分か相手のLユニット」には、同じ種類の能力（ほかの L ユニットがあれば L ユニットになる）で L になったユニットを数えない
//   （互いに支え合うと循環する。atwiki/page-1186 Q6 はターンプレイヤーが止める — 未実装）。

const REGEN_GIANT_RE =
  /これが自軍エリアにある間、本来の特徴に「([^」]+)」を持つ自軍ユニットは、自軍捨札に同じカード名のユニットカードがあれば、「?Lユニット」?になる/;
const BECOMES_L_IF_ANY_L_RE = /自分か相手のLユニットがあれば、これはLユニットにな/;

/** 【再生巨大化能力】等で L ユニットになっているか。 */
export function regenGiantLarge(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return false;
  const owner = state.players[ownerId];
  const name = cardName(state.definitions, card.cardId);
  return fieldUnits(state, ownerId).some((src) => {
    const m = textOf(state, src.cardId).match(REGEN_GIANT_RE);
    if (!m || !(def.features ?? []).includes(m[1]!)) return false;
    return owner.discard.some((d) => isUnitCard(state, d.cardId) && cardName(state.definitions, d.cardId) === name);
  });
}

/** 「ほかの L ユニットがあれば L ユニットになる」能力を文言で持つか（RS-558 等）。 */
export function hasBecomesLIfAnyLText(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return BECOMES_L_IF_ANY_L_RE.test(textOf(state, cardId));
}

/** 条件つきの能力に頼らずに L ユニットであるか（印刷サイズ L、または【再生巨大化能力】）。 */
export function baseLargeNow(state: Pick<GameState, "players" | "definitions">, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return false;
  // RK-013 Jパワー・RS-255 巨大化爆弾を重ねたユニットも L（core/catalog.ts unitSizeOf）。
  if (isLargeUnit(state.definitions, card)) return true;
  const ownerId = ownerOf(state, card.instanceId);
  return ownerId !== null && regenGiantLarge(state, ownerId, card);
}

/** これ以外に（自分か相手の）L ユニットがあるか。条件つきで L になっているユニットは数えない。 */
export function anyOtherBaseLargeUnit(state: Pick<GameState, "players" | "definitions">, instance: CardInstance): boolean {
  return (["player1", "player2"] as const).some((pid) =>
    fieldUnits(state, pid).some((c) => c.instanceId !== instance.instanceId && baseLargeNow(state, c)),
  );
}

// ---------------------------------------------------------------------------
// RS-545 究極大獣神【グランバニッシャー】
// 「これをラッシュしたとき、敵軍ユニットをBPの合計が20000以下になるように選び撃破してもよい。」（atwiki/page-1210）
// 1体ずつ選び、合計が上限を超えるユニットは候補から外れる。選び終えたら（やめたら）まとめて撃破する（set7NamedEffectsD の共用処理）。

function applyGrandBanisher(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const budget = Number(textOf(state, ctx.sourceCardId).match(/BPの合計が(\d+)以下/)?.[1] ?? 20000);
  const opened = openMultiDestroy(
    state,
    { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceCardId: ctx.sourceCardId, sourceInstanceId: ctx.triggerSourceInstanceId },
    { budget, measure: "bp", zones: ["battle", "rush"] },
  );
  return { state: opened, detail: opened.pendingEffectChoice ? "rs545_grand_banisher" : "rs545_grand_banisher:no_targets" };
}

// ---------------------------------------------------------------------------
// RS-546 獣帝大獣神【エンパイアアタック】
// 「自軍ターン中、これがバトルエリアに出たとき、バトルエリアにあるWBを持たないユニットをすべて撃破する。」（atwiki/page-1170）
// 自軍・敵軍の両方のバトルエリアが対象（強制）。

export const EMPIRE_ATTACK_EFFECT_ID = "rs546_empire_attack";

function applyEmpireAttack(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayerOf(state) !== ctx.playerId) return { state, detail: `${EMPIRE_ATTACK_EFFECT_ID}:not_own_turn` };
  const ids = (["player1", "player2"] as const).flatMap((pid) =>
    state.players[pid].battle
      .filter((c) => isUnitCard(state, c.cardId))
      .filter((c) => !unitEffectiveCategories(state, pid, c, "battle").includes("WB"))
      .map((c) => c.instanceId),
  );
  if (ids.length === 0) return { state, detail: `${EMPIRE_ATTACK_EFFECT_ID}:none` };
  const next = destroySimultaneously(
    state,
    { ...ctx, sourceInstanceId: ctx.triggerSourceInstanceId, effectId: EMPIRE_ATTACK_EFFECT_ID },
    ids,
  );
  return { state: next, detail: `${EMPIRE_ATTACK_EFFECT_ID}:${ids.length}` };
}

// ---------------------------------------------------------------------------
// RS-547 獣騎神キングブラキオン【守護獣の使徒】
// 「これが自軍エリアにある間、WBを持つ自軍Mユニットは、『※レジスト（…）』を得る。ただし、そのユニットが持つ「ラッシュしたとき」の
//  効果を発動したときは、そのユニットをホールドする。」（atwiki/page-1171）

const GUARDIAN_APOSTLE_RE = /これが自軍エリアにある間、(WB|MA|OT|ET|DA)を持つ自軍([SML])ユニットは、『※レジスト/;
const GUARDIAN_APOSTLE_HOLD_RE = /ただし、そのユニットが持つ「ラッシュしたとき」の効果を発動したときは、そのユニットをホールドする/;

function guardianApostleSource(state: GameState, ownerId: PlayerId, card: CardInstance, requireHoldClause: boolean): CardInstance | undefined {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return undefined;
  return fieldUnits(state, ownerId).find((src) => {
    if (src.instanceId === card.instanceId) return false;
    const text = textOf(state, src.cardId);
    const m = text.match(GUARDIAN_APOSTLE_RE);
    if (!m) return false;
    if (requireHoldClause && !GUARDIAN_APOSTLE_HOLD_RE.test(text)) return false;
    if (unitSizeOf(state.definitions, card) !== m[2]) return false;
    const zone = state.players[ownerId].battle.some((c) => c.instanceId === card.instanceId) ? "battle" : "rush";
    return unitEffectiveCategories(state, ownerId, card, zone).includes(m[1] as never);
  });
}

/** 【守護獣の使徒】でレジストを得ているか（rules/resist.ts canOfferRegister から呼ぶ）。 */
export function set8BGrantsResist(state: GameState, ownerId: PlayerId, instanceId: string): boolean {
  const card = state.players[ownerId].battle.find((c) => c.instanceId === instanceId);
  return !!card && !!guardianApostleSource(state, ownerId, card, false);
}

/**
 * 【守護獣の使徒】ただし書き: そのユニットの「ラッシュしたとき」の効果を発動したら、そのユニットをホールドする
 * （rules/onRushUnitEffects.ts から、DSL の「ラッシュしたとき」の効果を解決した直後に呼ぶ）。
 * 任意の効果で選択が開いたときは、解決で発動したら（見送らなかったら）ホールドする（印をつけて core/applyAction.ts の後処理で判定）。
 */
const APOSTLE_PENDING_MARK = "rs547_hold_if_rush_effect_activated";

export function applyGuardianApostleProviso(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  activated: boolean,
): GameState {
  if (!activated) return state;
  const card = state.players[ownerId].rush.find((c) => c.instanceId === instanceId);
  if (!card || card.commandHeld) return state;
  if (listDslEffectsForTrigger(card.cardId, "on_rush").length === 0) return state;
  if (!guardianApostleSource(state, ownerId, card, true)) return state;
  const pending = state.pendingEffectChoice;
  if (pending && pending.sourceInstanceId === instanceId && pending.optional) {
    return patchPlayer(state, ownerId, (p) => ({
      ...p,
      rush: p.rush.map((c) =>
        c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), APOSTLE_PENDING_MARK] } : c,
      ),
    }));
  }
  return holdRushUnit(state, ownerId, instanceId);
}

function holdRushUnit(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    rush: p.rush.map((c) =>
      c.instanceId === instanceId
        ? { ...c, commandHeld: true, activatedNcEffects: (c.activatedNcEffects ?? []).filter((m) => m !== APOSTLE_PENDING_MARK) }
        : c,
    ),
  }));
}

/** 任意の「ラッシュしたとき」の選択が閉じたあと、発動していればホールドする（core/applyAction.ts の後処理）。 */
export function settleGuardianApostleProviso(state: GameState, action: { type: string }): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    for (const card of next.players[pid].rush) {
      if (!card.activatedNcEffects?.includes(APOSTLE_PENDING_MARK)) continue;
      if (next.pendingEffectChoice?.sourceInstanceId === card.instanceId) continue;
      if (action.type === "skip_effect_choice") {
        next = patchPlayer(next, pid, (p) => ({
          ...p,
          rush: p.rush.map((c) =>
            c.instanceId === card.instanceId
              ? { ...c, activatedNcEffects: (c.activatedNcEffects ?? []).filter((m) => m !== APOSTLE_PENDING_MARK) }
              : c,
          ),
        }));
      } else {
        next = holdRushUnit(next, pid, card.instanceId);
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-548 ティラノレンジャー（2nd）※「このユニットのナンバーの数字は、ホールド状態のユニット1体につき1増える。」（atwiki/page-1225）
// 自軍・敵軍の限定はない（バトル・ラッシュエリアのホールド状態のユニット）。

const NUMBER_PER_HELD_RE = /このユニットのナンバーの数字は、ホールド状態のユニット1体につき(\d+)増える/;

/** ナンバーの増加分（rules/numberComboEffects.ts ncEffectiveNumber から呼ぶ）。 */
export function set8BComboNumberBonus(state: GameState, definition: CardDefinition): number {
  const m = (definition.text ?? "").normalize("NFKC").replace(/\s+/g, "").match(NUMBER_PER_HELD_RE);
  if (!m) return 0;
  const held = (["player1", "player2"] as const).reduce(
    (sum, pid) => sum + fieldUnits(state, pid).filter((c) => c.commandHeld && isUnitCard(state, c.cardId)).length,
    0,
  );
  return held * Number(m[1]);
}

// ---------------------------------------------------------------------------
// RS-549 トリケラレンジャー（2nd）【トリケランス】「SP1」
// 「敵軍バトルエリアのSユニットを、必要パワーの数字の合計が敵軍ダメージの点数と同じ数になるまで好きな数選び、ホールドする。」
// （atwiki/page-1172）— 1体ずつ選び、合計が敵軍ダメージを超えるユニットは候補から外れる。好きな数なので途中でやめられる。
// ホールドするので、選べるのはリリース状態のユニット。

export const TRICERA_LANCE_EFFECT_ID = "rs549_tricera_lance";

function enemyDamagePoints(state: GameState, enemyId: PlayerId): number {
  const p = state.players[enemyId];
  return Math.max(p.damage ?? 0, p.power.filter((c) => c.faceDown).length);
}

function triceraCandidates(state: GameState, pending: PendingEffectChoice): string[] {
  const meta = pending.set8bMeta ?? {};
  const selected = meta.selected ?? [];
  const enemyId = opponent(pending.playerId);
  const used = state.players[enemyId].battle
    .filter((c) => selected.includes(c.instanceId))
    .reduce((sum, c) => sum + parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost), 0);
  const budget = meta.budget ?? 0;
  return state.players[enemyId].battle
    .filter((c) => !selected.includes(c.instanceId) && !c.commandHeld)
    .filter((c) => isUnitCard(state, c.cardId) && isSmallUnitNow(state, enemyId, c))
    .filter((c) => isSelectableByOpponentEffect(state, pending.playerId, c.instanceId, pending.sourceCardId))
    .filter((c) => used + parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost) <= budget)
    .map((c) => c.instanceId);
}

function applyTriceraLance(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const draft: PendingEffectChoice = {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    effectId: TRICERA_LANCE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [],
    selectedInstanceIds: [],
    optional: true,
    set8bMeta: { selected: [], budget: enemyDamagePoints(state, enemyId) },
  };
  const candidates = triceraCandidates(state, draft);
  if (candidates.length === 0) return { state, detail: `${TRICERA_LANCE_EFFECT_ID}:no_targets` };
  return { state: openEffectChoice(state, { ...draft, validInstanceIds: candidates }), detail: TRICERA_LANCE_EFFECT_ID };
}

function holdSelected(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  const enemyId = opponent(pending.playerId);
  const next = patchPlayer(state, enemyId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: true } : c)),
  }));
  const names = selected
    .map((id) => {
      const c = state.players[enemyId].battle.find((x) => x.instanceId === id);
      return c ? cardName(state.definitions, c.cardId) : id;
    })
    .join("、");
  return { state: finish(next, pending), log: logFor(state, pending.playerId, pending.sourceCardId, `${TRICERA_LANCE_EFFECT_ID}:hold:${names}`) };
}

CHOICE_RESOLVERS[TRICERA_LANCE_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set8bMeta?.selected ?? []), instanceId];
  const next: PendingEffectChoice = { ...pending, set8bMeta: { ...pending.set8bMeta, selected }, selectedInstanceIds: selected };
  const candidates = triceraCandidates(state, next);
  // finish は開いている選択と同じものを閉じるので、選び終えた next を開いた状態にしてから渡す
  // （元の選択のまま渡すと閉じずに残り、同じ選択が何度でも開いていた）。
  if (candidates.length === 0) return holdSelected({ ...state, pendingEffectChoice: next }, next, selected);
  return { state: { ...state, pendingEffectChoice: { ...next, validInstanceIds: candidates } } };
};
CHOICE_SKIPPERS[TRICERA_LANCE_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.set8bMeta?.selected ?? [];
  if (selected.length === 0) return simpleSkip()(state, pending.playerId);
  return holdSelected(state, pending, selected);
};

// ---------------------------------------------------------------------------
// 敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く／撃破する（候補の条件をカードごとに文言で）
// - RS-550 隠大将軍【鉄拳ゴッドフィニッシュ】「自軍ターン中、これがバトルエリアに出たとき、必要パワーに「＋」を持たない敵軍ユニットを
//   1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1217）
// - RS-554 ゴッドカーク【フライングビーム】「敵軍パワーゾーンのカード枚数を見て、その枚数よりも必要パワーの数字が大きい敵軍ユニットを
//   1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1176）
// - RS-559 ガオゴッド【パワーアロー】「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動出来る⇒BP8000以下の敵軍ユニットを
//   1体選び撃破する。」（atwiki/page-1227）
// いずれも敵軍のバトル・ラッシュエリアのユニットが候補で、見送れる。

function openEnemyUnitChoice(
  state: GameState,
  ctx: GrantKeywordContext,
  effectId: string,
  ids: string[],
  destination: "power" | "discard",
): GrantKeywordResult {
  if (ids.length === 0) return { state, detail: `${effectId}:no_targets` };
  const opened = openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectedInstanceIds: [],
    unitDestination: destination,
    placeAsDamage: destination === "power",
    selectCount: 1,
    optional: true,
  });
  return { state: opened, detail: effectId };
}

function applyGodFinish(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayerOf(state) !== ctx.playerId) return { state, detail: "rs550_god_finish:not_own_turn" };
  const ids = selectableEnemyUnits(state, ctx.playerId, (c) => !powerCostHasPlus(getDefinition(state.definitions, c.cardId)), ctx.sourceCardId);
  return openEnemyUnitChoice(state, ctx, "rs550_god_finish", ids, "power");
}

function applyFlyingBeam(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const count = state.players[opponent(ctx.playerId)].power.length;
  const ids = selectableEnemyUnits(
    state,
    ctx.playerId,
    (c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost) > count,
    ctx.sourceCardId,
  );
  return openEnemyUnitChoice(state, ctx, "rs554_flying_beam", ids, "power");
}

const POWER_ARROW_EFFECT_ID = "rs559_power_arrow";

function powerArrowTargets(state: GameState, playerId: PlayerId, sourceCardId: string): string[] {
  const maxBp = Number(textOf(state, sourceCardId).match(/BP(\d+)以下の敵軍ユニット/)?.[1] ?? 8000);
  return selectableEnemyUnits(state, playerId, (c, ownerId) => effectiveBp(state, ownerId, c) <= maxBp, sourceCardId);
}

function applyPowerArrow(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayerOf(state) !== ctx.playerId) return { state, detail: `${POWER_ARROW_EFFECT_ID}:not_own_turn` };
  return openEnemyUnitChoice(state, ctx, POWER_ARROW_EFFECT_ID, powerArrowTargets(state, ctx.playerId, ctx.sourceCardId), "discard");
}

// RS-559 （）内「この効果は、自軍ラッシュフェイズ中、自軍パワーが8以上あれば、自分の手札からこのカードを捨札にして発動できる」
// 合法手は activate_field_unit_ability（unitInstanceId = 手札のこのカード）。

const HAND_ACTIVATION_RE = /この効果は、自軍ラッシュフェイズ中、自軍パワーが(\d+)以上あれば、自分の手札からこのカードを捨札にして発動できる/;

const HAND_ACTIVATED_EFFECTS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RS-559": (state, ctx) =>
    openEnemyUnitChoice(state, ctx, POWER_ARROW_EFFECT_ID, powerArrowTargets(state, ctx.playerId, ctx.sourceCardId), "discard"),
};

function handActivationAvailable(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!HAND_ACTIVATED_EFFECTS[card.cardId]) return false;
  const m = textOf(state, card.cardId).match(HAND_ACTIVATION_RE);
  if (!m) return false;
  if (state.phase !== "rush" || state.activePlayer !== playerId || turnPlayerOf(state) !== playerId) return false;
  if (state.pendingEffectChoice || state.pendingRush || state.pendingLeave || state.pendingZordSetup || state.pendingCommandPayment) {
    return false;
  }
  return countAvailablePower(state, playerId) >= Number(m[1]);
}

/** 手札から捨札にして発動できるカード（core/legalActions.ts appendActivateFieldUnitAbilityActions から呼ぶ）。 */
export function listSet8BHandActivations(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand.filter((c) => handActivationAvailable(state, playerId, c)).map((c) => c.instanceId);
}

/** 手札のこのカードを捨札にして効果を発動する（core/applyAction.ts activate_field_unit_ability から呼ぶ）。対象外なら null。 */
export function activateSet8BHandEffect(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card || !handActivationAvailable(state, playerId, card)) return null;
  const discarded = patchPlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  const handler = HAND_ACTIVATED_EFFECTS[card.cardId]!;
  return handler(discarded, {
    playerId,
    phasePlayerId: playerId,
    sourceCardId: card.cardId,
    effectId: "hand_activation",
    triggerSourceInstanceId: instanceId,
  }).state;
}

// ---------------------------------------------------------------------------
// RS-551 ゴッドガンマー【ガンマーダイナマイト】
// 「相手は、特徴「怪人」を持つ自分自身のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1173）
// 選ぶのは相手（強制）。候補は相手のバトル・ラッシュエリアのユニット。

function applyGammaDynamite(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const feature = textOf(state, ctx.sourceCardId).match(/相手は、特徴「([^」]+)」を持つ自分自身のユニット/)?.[1] ?? "怪人";
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnitCard(state, c.cardId) && unitFeatures(state, enemyId, c).includes(feature))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rs551_gamma_dynamite:no_targets" };
  const choice: PendingEffectChoice = {
    playerId: enemyId,
    effectId: "rs551_gamma_dynamite",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectedInstanceIds: [],
    unitDestination: "power",
    placeAsDamage: true,
    selectCount: 1,
    optional: false,
  };
  return { state: openEffectChoice(state, choice), detail: "rs551_gamma_dynamite" };
}

// ---------------------------------------------------------------------------
// RS-553 ゴッドサルダー ※「自軍バトルエリアにこれ以外の「ゴッドサルダー」があれば、これはアタックされない。」（atwiki/page-1175）

const NOT_ATTACKED_IF_OTHER_NAMED_RE = /自軍バトルエリアにこれ以外の「([^」]+)」があれば、これはアタックされない/;

/** アタックされない制限（rules/legend3/restrictions.ts canAttackDefender から呼ぶ）。 */
export function set8BDefenderBlocksAttack(state: GameState, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  const m = textOf(state, defender.cardId).match(NOT_ATTACKED_IF_OTHER_NAMED_RE);
  if (!m) return false;
  return state.players[defenderPlayerId].battle.some(
    (c) => c.instanceId !== defender.instanceId && cardName(state.definitions, c.cardId) === m[1],
  );
}

// ---------------------------------------------------------------------------
// RS-556 バトルサルダー【サルダークロー】「SP1」
// 「敵軍ユニットの数と同じ枚数、敵軍山札の上からオモテにしてもよい。そうしたとき、オモテにしたカードと同じカード名の敵軍ユニットを
//  全て撃破する。そして相手はオモテにしたカードを山札の下に好きな順で戻す。」（atwiki/page-1178）
// オモテにしたカードは、戻すまで山札の上に置いたままにする。戻す順番は相手が番号を付けて選ぶ（rules/deckOrder.ts。1番が上）。

export const SALDA_CLAW_EFFECT_ID = "rs556_salda_claw";

function applySaldaClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const count = fieldUnits(state, enemyId).filter((c) => isUnitCard(state, c.cardId)).length;
  if (count === 0 || state.players[enemyId].deck.length === 0 || !ctx.triggerSourceInstanceId) {
    return { state, detail: `${SALDA_CLAW_EFFECT_ID}:no_effect` };
  }
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: SALDA_CLAW_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: [ctx.triggerSourceInstanceId],
      selectedInstanceIds: [],
      optional: true,
    }),
    detail: SALDA_CLAW_EFFECT_ID,
  };
}

function deckTopToBottom(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), stripForZone(card)] };
  });
}

CHOICE_RESOLVERS[SALDA_CLAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const count = fieldUnits(state, enemyId).filter((c) => isUnitCard(state, c.cardId)).length;
  const revealed = state.players[enemyId].deck.slice(0, count);
  const names = new Set(revealed.map((c) => cardName(state.definitions, c.cardId)));
  const targets = fieldUnits(state, enemyId)
    .filter((c) => isUnitCard(state, c.cardId) && names.has(cardName(state.definitions, c.cardId)))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${SALDA_CLAW_EFFECT_ID}:${[...names].join("、")}:${targets.length}`);
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const revealedIds = revealed.map((c) => c.instanceId);
  // そして相手はオモテにしたカードを山札の下に好きな順で戻す（1枚なら選択なしで戻す）。
  let after: PendingEffectChoice | undefined;
  let base = cleared;
  if (revealedIds.length >= 2) {
    after = deckOrderChoice(
      base,
      { playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceCardId: pending.sourceCardId, sourceInstanceId: pending.sourceInstanceId, resumeChoice: pending.resumeChoice },
      revealedIds,
      "bottom",
    );
  }
  else if (revealedIds.length === 1) base = deckTopToBottom(base, enemyId, revealedIds[0]!);
  const resume = after ?? pending.resumeChoice;
  const destroyed = destroySimultaneously(
    base,
    { playerId, phasePlayerId: pending.phasePlayerId, sourceCardId: pending.sourceCardId, sourceInstanceId: pending.sourceInstanceId, effectId: SALDA_CLAW_EFFECT_ID },
    targets,
    resume,
  );
  const next = destroyed.pendingEffectChoice || destroyed.pendingLeave ? destroyed : promoteDeferredBattleEntry(destroyed);
  return { state: next, log };
};
CHOICE_SKIPPERS[SALDA_CLAW_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-557 ビンボーガミ【札束の誘惑】
// 「これが自軍エリアにある間、自分も相手も次の制限を受ける⇒相手の手札が1枚以上あれば、その枚数と同じＣＮの数字を持つ
//  自分自身のSユニットは、毎ターン、可能ならバトルエリアに出る。」（atwiki/page-1179）

const MONEY_TEMPTATION_RE =
  /自分も相手も次の制限を受ける⇒相手の手札が1枚以上あれば、その枚数と同じCNの数字を持つ自分自身のSユニットは、毎ターン、可能ならバトルエリアに出る/;

/** 可能ならバトルエリアに出なければならないか（rules/restrictions.ts findMandatoryBattleEntries から呼ぶ）。 */
export function set8BRequiresBattleEntry(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit" || unitSizeOf(state.definitions, card) !== "S" || typeof def.comboNumber !== "number") return false;
  const active = (["player1", "player2"] as const).some((pid) =>
    fieldUnits(state, pid).some((c) => MONEY_TEMPTATION_RE.test(textOf(state, c.cardId))),
  );
  if (!active) return false;
  const oppHand = state.players[opponent(playerId)].hand.length;
  return oppHand >= 1 && def.comboNumber === oppHand;
}

// ---------------------------------------------------------------------------
// RS-558 ガンマジン【鍵の持ち主の願い】
// 「これが自軍エリアにある間、自分も相手も次のようにする⇒必要パワーに「＋」を持つユニットカードの追加条件を実行して満たしたとき、
//  そのカードの持ち主は1枚ドローしてもよい。」（atwiki/page-1186）
// 追加条件を「実行して」満たした＝追加条件で合体ユニット等を捨札にした（場の状況を参照するだけの追加条件は対象外。
// grnrngr/faq-card-8 RS-558 Q3）。core/applyAction.ts の手札からのラッシュから呼ぶ。

const KEY_HOLDER_WISH_RE = /自分も相手も次のようにする⇒必要パワーに「[+＋]」を持つユニットカードの追加条件を実行して満たしたとき、そのカードの持ち主は1枚ドローしてもよい/;
export const KEY_HOLDER_WISH_EFFECT_ID = "rs558_key_holder_wish";

export function openKeyHolderWishDraw(state: GameState, ownerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  const owner = state.players[ownerId];
  if (owner.lastZordDiscard?.rushedInstanceId !== rushedInstanceId || owner.lastZordDiscard.instanceIds.length === 0) return state;
  // RS-359【最後の手段】で山札のカードを捨札にして満たした（「捨札にしたことにできる」）のは追加条件の実行ではない
  // （grnrngr/faq-card-8 RS-558 Q2）。
  const usedReplacement = owner.discard.some(
    (c) => owner.lastZordDiscard!.instanceIds.includes(c.instanceId) && c.icyPhantomDeckIndex !== undefined,
  );
  if (usedReplacement) return state;
  const rushed = fieldUnits(state, ownerId).find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || !powerCostHasPlus(getDefinition(state.definitions, rushed.cardId))) return state;
  let source: CardInstance | undefined;
  for (const pid of ["player1", "player2"] as const) {
    source ??= fieldUnits(state, pid).find((c) => KEY_HOLDER_WISH_RE.test(textOf(state, c.cardId)));
  }
  if (!source || owner.deck.length === 0) return state;
  return openOrQueue(state, {
    playerId: ownerId,
    effectId: KEY_HOLDER_WISH_EFFECT_ID,
    sourceCardId: source.cardId,
    sourceInstanceId: source.instanceId,
    kind: "optional_deck_draw",
    phasePlayerId,
    validInstanceIds: ["draw"],
    selectedInstanceIds: [],
    optional: true,
  });
}

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const SET8B_KEYWORD_PREFIX = "set8b::";

const EFFECT_CARD_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  // 継続効果・誘発はそれぞれの参照箇所で扱う（ここでは何もしない）。
  "effect_card::RS-538::reru": (state) => ({ state, detail: "rs538_reliable_commander" }),
  "effect_card::RS-539::chikara": (state) => ({ state, detail: "rs539_regen_giant" }),
  "effect_card::RS-547::mamorugono": (state) => ({ state, detail: "rs547_guardian_apostle" }),
  "effect_card::RS-557::noe69cad": (state) => ({ state, detail: "rs557_money_temptation" }),
  "effect_card::RS-558::nochinoi": (state) => ({ state, detail: "rs558_key_holder_wish" }),
  "effect_card::RS-545::guranbanisha": applyGrandBanisher,
  "effect_card::RS-546::enpaiaataku": applyEmpireAttack,
  "effect_card::RS-550::kengodofuinishu": applyGodFinish,
  "effect_card::RS-551::ganmadainamaito": applyGammaDynamite,
  "effect_card::RS-554::furaingubimu": applyFlyingBeam,
  "effect_card::RS-559::pawaaro": applyPowerArrow,
};

const SET8B_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RS-549::tricera_lance": applyTriceraLance,
  "RS-556::salda_claw": applySaldaClaw,
};

export function trySet8BCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  const effectCard = EFFECT_CARD_KEYWORDS[keyword];
  if (effectCard) return effectCard(state, ctx);
  if (!keyword.startsWith(SET8B_KEYWORD_PREFIX)) return null;
  const handler = SET8B_KEYWORDS[keyword.slice(SET8B_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールの選択の CPU の手（対象外なら null）。 */
export function pickSet8BCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const picks = actions.filter((a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice");
  if (picks.length === 0) return skip ?? null;
  const costOf = (id: string): number => {
    const c = fieldUnits(state, opponent(pending.playerId)).find((x) => x.instanceId === id);
    return c ? parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost) : 0;
  };
  switch (pending.effectId) {
    case TRICERA_LANCE_EFFECT_ID:
      // 敵軍ユニットをホールドする: 必要パワーの大きいユニットから選ぶ。
      return [...picks].sort((a, b) => costOf(b.instanceId) - costOf(a.instanceId))[0]!;
    case SALDA_CLAW_EFFECT_ID: {
      // オモテにする山札の枚数は敵軍ユニットの数。結果は非公開の山札次第で、自軍に不利はないので発動する。
      return picks[0]!;
    }
    default:
      return picks[0]!;
  }
}
