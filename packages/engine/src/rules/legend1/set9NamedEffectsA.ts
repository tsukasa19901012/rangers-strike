/**
 * 第9弾「蒼九の翼」（legend1）RS-605〜RS-626 のカード固有の名前付き効果と継続効果（cardSpec RS9-605-626 の監査）。
 *
 * - `trySet9ACardEffect`: DSL の grant_keyword（`set9a::cardId::name`）から呼ばれる起点。
 * - `tryResolveSet9AChoice` / `trySkipSet9AChoice` / `tryConfirmSet9AChoice`: このモジュールが開いた選択の解決。
 * - 継続効果（SP・BP・アタックの可否・タクス／コール）と、常駐オペレーション・場のユニットの起動、
 *   applyAction の後処理（RS-607 の続き・RS-613 のホールド待ち・RS-623 の重ねたカード）。
 * 構成は rules/legend1/set8NamedEffectsC.ts と同じ。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, cardName, effectiveBp, effectiveCommandCategories, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { shuffleCards } from "../../core/deckShuffle";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { stackedEquipmentGrantsWing } from "../../dsl/promotedKeywordBridge";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { addTurnFeatureModifier, KIRIGAKURE_RULE_ID, unitFeatures } from "../addedFeatures";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { isResidentActivatedThisRush, markResidentActivatedThisRush } from "../permanentOperation";
import { isSmallUnitNow, turnPlayerOf } from "./set6NamedEffectsB";
import { getNumberComboEffect } from "@rangers-strike/cards";
import { applyNumberComboEffect } from "../numberComboEffects";
import { zordMaterialFeatures, zordRuleContextState } from "../zordFeatureContext";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
type ChoiceConfirmer = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceConfirmer> = {};
const CHOICE_CAN_CONFIRM: Record<string, (state: GameState, pending: PendingEffectChoice) => boolean> = {};

/** 「選び終える」を表す選択肢（好きな数を1つずつ選ぶ選択で、2つ目以降の先頭に置く）。 */
export const SET9A_DONE = "__set9a_done__";

export function isSet9AChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 複数選んで確定する選択で、いま確定できるか（合法手 confirm_effect_choice）。 */
export function canConfirmSet9AChoice(state: GameState, pending: PendingEffectChoice): boolean {
  const check = CHOICE_CAN_CONFIRM[pending.effectId];
  return !!check && check(state, pending);
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet9AChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet9AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!CHOICE_RESOLVERS[pending.effectId]) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 複数選んだ選択を確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet9AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!CHOICE_RESOLVERS[pending.effectId]) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer || !canConfirmSet9AChoice(state, pending)) return { error: "not_confirmable" };
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

/** 選択を開く。すでに選択が開いていれば、その解決後に開く（R-TIME-04）。 */
function openAfter(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  return openEffectChoice(state, choice);
}

/** 選択を閉じた state（続きの処理はまだしない）。 */
function close(state: GameState, pending: PendingEffectChoice): GameState {
  return state.pendingEffectChoice === pending
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
}

/** 閉じたあとの続き: 割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入を続ける。 */
function proceed(state: GameState, pending: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) {
    return pending.resumeChoice
      ? { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, pending.resumeChoice) }
      : state;
  }
  if (state.pendingLeave || state.pendingDamagePayment || state.pendingEffectRush) return state;
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

function finish(state: GameState, pending: PendingEffectChoice): GameState {
  return proceed(close(state, pending), pending);
}

function simpleSkip(): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  };
}

function base(
  ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string },
): Pick<PendingEffectChoice, "playerId" | "phasePlayerId" | "sourceCardId" | "sourceInstanceId" | "selectedInstanceIds"> {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    selectedInstanceIds: [],
  };
}

function strip(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/** カードとしてウイングを持つユニットカード（山札・捨札のカード）。 */
function isWingUnitCard(state: GameState, cardId: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  return def?.type === "unit" && cardHasKeyword(state.definitions, cardId, "wing");
}

/** 場のユニットがウイングを持つか（効果で得たウイング・翼合体を含む）。 */
function unitHasWing(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return cardHasKeyword(state.definitions, card.cardId, "wing", { state, playerId }) || stackedEquipmentGrantsWing(card);
}

function printedBp(state: GameState, cardId: string): number {
  return getDefinition(state.definitions, cardId)?.bp ?? 0;
}

/** 場のユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く。 */
function placeAsDamage(state: GameState, ids: string[], phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const id of ids) {
    const found = findCardInField(next, id);
    if (!found) continue;
    const moved = applyUnitLeave(next, id, "power", phasePlayerId);
    if ("error" in moved) continue;
    next = patchPlayer(moved.state, found.playerId, (p) => {
      if (!p.power.some((c) => c.instanceId === id && !c.faceDown)) return p;
      return {
        ...p,
        power: p.power.map((c) => (c.instanceId === id ? { ...c, faceDown: true } : c)),
        damage: p.damage + 1,
      };
    });
  }
  return next;
}

/** 場のユニットを持ち主のコマンドゾーンにホールド状態で置く／捨札にする（重ねたカードは捨札）。 */
function placeUnitsInCommand(state: GameState, ownerId: PlayerId, toCommand: string[], toDiscard: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const all = [...p.battle, ...p.rush];
    const moving = (c: CardInstance) => toCommand.includes(c.instanceId) || toDiscard.includes(c.instanceId);
    const stacked = all.filter(moving).flatMap((c) => (c.stackedCards ?? []).map(strip));
    const pick = (ids: string[]) =>
      ids.map((id) => all.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c).map(strip);
    const unmount = (cards: CardInstance[]) =>
      cards.map((c) => {
        if (!c.mountedOnInstanceId || !toCommand.concat(toDiscard).includes(c.mountedOnInstanceId)) return c;
        const { mountedOnInstanceId: _m, ...rest } = c;
        return rest as CardInstance;
      });
    return {
      ...p,
      battle: unmount(p.battle.filter((c) => !moving(c))),
      rush: unmount(p.rush.filter((c) => !moving(c))),
      command: [...p.command, ...pick(toCommand).map((c) => ({ ...c, commandHeld: true }))],
      discard: [...p.discard, ...pick(toDiscard), ...stacked],
    };
  });
}

/**
 * 「…をすべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」
 * 一部しか置けないとき、捨札にするユニットはターンプレイヤーが選ぶ（faq-card-5 RS-282 Q1 と同じ）。
 */
const COMMAND_OVERFLOW_EFFECT_ID = "rs9a_command_overflow";

function placeAllInCommand(
  state: GameState,
  ownerId: PlayerId,
  targets: string[],
  ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string },
): GameState {
  if (targets.length === 0) return state;
  const space = Math.max(0, COMMAND_ZONE_MAX - state.players[ownerId].command.length);
  if (targets.length <= space) return placeUnitsInCommand(state, ownerId, targets, []);
  if (space === 0) return placeUnitsInCommand(state, ownerId, [], targets);
  const turnPlayer = turnPlayerOf(state);
  return openAfter(state, {
    ...base({ ...ctx, playerId: turnPlayer }),
    effectId: COMMAND_OVERFLOW_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: targets,
    viewedInstanceIds: targets,
    selectCount: targets.length - space,
    optional: false,
    set9aMeta: { ownerId, selected: [] },
  });
}

CHOICE_RESOLVERS[COMMAND_OVERFLOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const meta = pending.set9aMeta ?? {};
  const selected = [...(meta.selected ?? []), instanceId];
  if (selected.length < (pending.selectCount ?? 1)) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          selectedInstanceIds: selected,
          validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
          set9aMeta: { ...meta, selected },
        },
      },
    };
  }
  const all = pending.viewedInstanceIds ?? [];
  const ownerId = meta.ownerId ?? opponent(playerId);
  const next = placeUnitsInCommand(close(state, pending), ownerId, all.filter((id) => !selected.includes(id)), selected);
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${COMMAND_OVERFLOW_EFFECT_ID}:${selected.length}`) };
};

// ---------------------------------------------------------------------------
// RS-605 異次元からの翼（オペレーション）
// 「自軍山札を見て、ウイングを持つユニットカードを1枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。
//  その後、山札をシャッフルする。」（atwiki/page-1448）
// - 必要パワーは満たさなくてよい。「－」の追加条件は実行しなくてよい（同 Q2）。追加条件を満たせないカードは選べない。
// - 強制（出せるカードがあれば選ばなければならない）。追加条件の実行にデンジ犬アイシー【最後の手段】を使える（同 Q1。rules/effectRush.ts）。

export const WING_FROM_DECK_EFFECT_ID = "rs605_wing_from_deck";

function openWingFromDeck(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const deck = state.players[pid].deck;
  const wings = deck.filter((c) => isWingUnitCard(state, c.cardId)).map((c) => c.instanceId);
  const valid = filterEffectRushCandidates(state, pid, "deck", wings, true, true);
  if (valid.length === 0) {
    const shuffled = patchPlayer(state, pid, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
    return { state: shuffled, detail: `${WING_FROM_DECK_EFFECT_ID}:no_targets` };
  }
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId }),
      effectId: WING_FROM_DECK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: valid,
      viewedInstanceIds: deck.map((c) => c.instanceId),
      optional: false,
    }),
    detail: WING_FROM_DECK_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[WING_FROM_DECK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${WING_FROM_DECK_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : instanceId}`);
  // 「その後、山札をシャッフルする」— 出すカードは山札から出ていくので、先にシャッフルしても結果は同じ
  // （シャッフルされたかの判定は applyAction の前後で行う。core/deckShuffle.ts）。
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  next = startEffectRush(next, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: WING_FROM_DECK_EFFECT_ID,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "deck",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: true,
    ignorePowerCost: true,
    mandatory: true,
    forced: true,
  });
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// RS-606 雷鳴剣ヒカリマル（オペレーション）
// 「ウイングを持つ自軍ユニットを1枚選びリリースしてもよい。そうしたとき、リリースしたユニットのBPを見て、そのBP以下のBPを持つ
//  ユニットを敵軍バトルエリアから1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1447）
// - リリースできるのはホールド状態のウイングを持つ自軍ユニット（場のユニット。コマンドゾーンのカードはユニットではない）。

export const HIKARIMARU_RELEASE_EFFECT_ID = "rs606_hikarimaru_release";
export const HIKARIMARU_TARGET_EFFECT_ID = "rs606_hikarimaru_target";

function openHikarimaru(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const ids = fieldUnits(state, pid)
    .filter((c) => c.commandHeld && unitHasWing(state, pid, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${HIKARIMARU_RELEASE_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId }),
      effectId: HIKARIMARU_RELEASE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      optional: true,
    }),
    detail: HIKARIMARU_RELEASE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[HIKARIMARU_RELEASE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const released = patchPlayer(close(state, pending), playerId, (p) => {
    const release = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false, mothershipHold: false } : c));
    return { ...p, battle: release(p.battle), rush: release(p.rush) };
  });
  const unit = fieldUnits(released, playerId).find((c) => c.instanceId === instanceId);
  const bp = unit ? effectiveBp(released, playerId, unit) : 0;
  const enemyId = opponent(playerId);
  const targets = released.players[enemyId].battle
    .filter((c) => effectiveBp(released, enemyId, c) <= bp)
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${HIKARIMARU_RELEASE_EFFECT_ID}:${unit ? cardName(state.definitions, unit.cardId) : instanceId}:${bp}`);
  if (targets.length === 0) return { state: proceed(released, pending), log };
  return {
    state: openEffectChoice(released, {
      ...pending,
      effectId: HIKARIMARU_TARGET_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: targets,
      selectedInstanceIds: [],
      optional: false,
      maxBp: bp,
      unitDestination: "power",
      placeAsDamage: true,
    }),
    log,
  };
};
CHOICE_SKIPPERS[HIKARIMARU_RELEASE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[HIKARIMARU_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  const next = placeAsDamage(close(state, pending), [instanceId], pending.phasePlayerId);
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${HIKARIMARU_TARGET_EFFECT_ID}:${found ? cardName(state.definitions, found.card.cardId) : instanceId}`),
  };
};

// ---------------------------------------------------------------------------
// RS-607 ファルコンサモナー（オペレーション）
// 「次の効果を、敵軍ダメージの点数と同じ数まで好きな回数実行する⇒自軍山札の上からカードを1枚オモテにする。
//  オモテにしたカードが特徴「獣」を持つユニットカードかビークルカードだったなら、それを自軍ラッシュエリアに出す。
//  ただし、追加条件は満たすこと。出せなかったなら、オモテにしたカードを手札に加えた後、自分の手札からカードを1枚選び捨札にする。」
// （atwiki/page-1449）
// - 1回目は実行し、2回目以降は続けるかを選ぶ。必要パワー・カテゴリは無視でき、「－」の追加条件は実行しなくてよい
//   （同カード評価・コメント）。捨札にするカードは加えたカードを含む手札から選ぶ。
// - 出す処理（追加条件の素材の選択・「ラッシュしたとき」の効果）が終わってから次の実行に進む（settleSet9AAfterAction）。

export const FALCON_ASK_EFFECT_ID = "rs607_falcon_continue";
export const FALCON_DISCARD_EFFECT_ID = "rs607_falcon_discard";

function setFalcon(state: GameState, falcon: NonNullable<GameState["set9aState"]>["falcon"]): GameState {
  return { ...state, set9aState: { ...(state.set9aState ?? {}), falcon } };
}

/** 1回実行する（山札の上をオモテにする）。 */
function runFalconOnce(state: GameState): GameState {
  const falcon = state.set9aState?.falcon;
  if (!falcon) return state;
  const pid = falcon.playerId;
  const top = state.players[pid].deck[0];
  if (!top || falcon.remaining <= 0) return setFalcon(state, undefined);
  const after = setFalcon(state, { ...falcon, remaining: falcon.remaining - 1, revealedInstanceId: top.instanceId });
  const def = getDefinition(state.definitions, top.cardId);
  const eligible = !!def && ((def.type === "unit" && (def.features ?? []).includes("獣")) || def.type === "vehicle");
  const revealLog = buildLogEntry(pid, "named_effect", "RS-607", state.definitions, `falcon_reveal:${cardName(state.definitions, top.cardId)}`);
  if (eligible && filterEffectRushCandidates(after, pid, "deck", [top.instanceId], true, true).length > 0) {
    const rushed = startEffectRush(after, {
      playerId: pid,
      phasePlayerId: falcon.phasePlayerId,
      effectId: FALCON_ASK_EFFECT_ID,
      sourceCardId: "RS-607",
      sourceInstanceId: falcon.sourceInstanceId,
      fromZone: "deck",
      candidates: [top.instanceId],
      maxCount: 1,
      requireConditions: true,
      ignorePowerCost: true,
      mandatory: true,
      forced: true,
    });
    return { ...rushed, log: [...rushed.log, revealLog] };
  }
  return { ...falconFailed(after), log: [...after.log, revealLog] };
}

/** 出せなかった: オモテにしたカードを手札に加え、手札から1枚選び捨札にする。 */
function falconFailed(state: GameState): GameState {
  const falcon = state.set9aState?.falcon;
  if (!falcon?.revealedInstanceId) return state;
  const pid = falcon.playerId;
  const revealedId = falcon.revealedInstanceId;
  const added = patchPlayer(state, pid, (p) => {
    const card = p.deck.find((c) => c.instanceId === revealedId);
    if (!card) return p;
    return { ...p, deck: p.deck.filter((c) => c.instanceId !== revealedId), hand: [...p.hand, strip(card)] };
  });
  const withFalcon = setFalcon(added, { ...falcon, revealedInstanceId: undefined });
  const hand = withFalcon.players[pid].hand.map((c) => c.instanceId);
  if (hand.length === 0) return withFalcon;
  return openAfter(withFalcon, {
    ...base({ playerId: pid, phasePlayerId: falcon.phasePlayerId, sourceCardId: "RS-607", sourceInstanceId: falcon.sourceInstanceId }),
    effectId: FALCON_DISCARD_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: hand,
    optional: false,
  });
}

/** 続けるか（2回目以降）を尋ねる。続けられなければ終える。 */
function askFalcon(state: GameState): GameState {
  const falcon = state.set9aState?.falcon;
  if (!falcon) return state;
  if (falcon.remaining <= 0 || state.players[falcon.playerId].deck.length === 0) return setFalcon(state, undefined);
  const id = falcon.sourceInstanceId ?? FALCON_ASK_EFFECT_ID;
  return openAfter(state, {
    ...base({ playerId: falcon.playerId, phasePlayerId: falcon.phasePlayerId, sourceCardId: "RS-607", sourceInstanceId: falcon.sourceInstanceId }),
    effectId: FALCON_ASK_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: [id],
    optional: true,
  });
}

function startFalcon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const remaining = state.players[opponent(ctx.playerId)].damage;
  if (remaining <= 0) return { state, detail: "rs607_falcon:no_damage" };
  const started = setFalcon(state, {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    remaining,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
  });
  return { state: continueFalcon(runFalconOnce(started)), detail: "rs607_falcon" };
}

/** 1回の実行が終わっていれば（選択・効果ラッシュの処理中でなければ）次を尋ねる。 */
function continueFalcon(state: GameState): GameState {
  const falcon = state.set9aState?.falcon;
  if (!falcon || falconBusy(state)) return state;
  if (falcon.revealedInstanceId) {
    // 効果ラッシュで出せなかった（出す前に止まった）: オモテにしたカードがまだ山札にあれば手札に加える。
    if (state.players[falcon.playerId].deck.some((c) => c.instanceId === falcon.revealedInstanceId)) return falconFailed(state);
    return askFalcon(setFalcon(state, { ...falcon, revealedInstanceId: undefined }));
  }
  return askFalcon(state);
}

function falconBusy(state: GameState): boolean {
  return !!(
    state.pendingEffectChoice ||
    state.pendingEffectRush ||
    state.effectRushTriggerQueue?.length ||
    state.pendingLeave ||
    state.pendingCommandPayment ||
    state.pendingRush ||
    state.pendingDamagePayment ||
    state.pendingRegister ||
    state.pendingChase
  );
}

CHOICE_RESOLVERS[FALCON_ASK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = continueFalcon(runFalconOnce(close(state, pending)));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-607", "rs607_falcon:again") };
};
CHOICE_SKIPPERS[FALCON_ASK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finish(setFalcon(state, undefined), pending), log: skipLog(state, playerId, "RS-607", FALCON_ASK_EFFECT_ID) };
};

CHOICE_RESOLVERS[FALCON_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const discarded = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, strip(card)] };
  });
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  return {
    state: proceed(continueFalcon(discarded), pending),
    log: logFor(state, playerId, "RS-607", `${FALCON_DISCARD_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : instanceId}`),
  };
};

// ---------------------------------------------------------------------------
// RS-608 五色の戦士（※常駐 ※タッグ）
// 「自軍ラッシュフェイズごとに1度だけ『WBを持つ自軍コマンドを1つホールドする』を実行してもよい。そうしたとき、自軍Sユニットを
//  1体選び、特徴「レッド」「イエロー」「ブルー」「ブラック」「ホワイト」のうちどれか1つを宣言する。このターン、宣言した特徴を
//  選んだユニットに追加する。」（atwiki/page-1495）

const GOSHOKU_CARD_ID = "RS-608";
export const GOSHOKU_HOLD_EFFECT_ID = "rs608_goshoku_hold";
export const GOSHOKU_UNIT_EFFECT_ID = "rs608_goshoku_unit";
export const GOSHOKU_FEATURE_EFFECT_ID = "rs608_goshoku_feature";
const GOSHOKU_FEATURES = ["レッド", "イエロー", "ブルー", "ブラック", "ホワイト"];

function releasedWbCommands(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => !c.commandHeld && effectiveCommandCategories(player, state.definitions, c.cardId).includes("WB"))
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[GOSHOKU_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const held = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  const units = fieldUnits(held, playerId).filter((c) => isSmallUnitNow(held, playerId, c)).map((c) => c.instanceId);
  const log = logFor(state, playerId, GOSHOKU_CARD_ID, `${GOSHOKU_HOLD_EFFECT_ID}:hold`);
  if (units.length === 0) return { state: proceed(held, pending), log };
  return {
    state: openEffectChoice(held, { ...pending, effectId: GOSHOKU_UNIT_EFFECT_ID, kind: "select_unit", validInstanceIds: units, optional: false }),
    log,
  };
};

CHOICE_RESOLVERS[GOSHOKU_UNIT_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: openEffectChoice(close(state, pending), {
      ...pending,
      effectId: GOSHOKU_FEATURE_EFFECT_ID,
      kind: "declare_number",
      validInstanceIds: [...GOSHOKU_FEATURES],
      optional: false,
      set9aMeta: { first: instanceId },
    }),
  };
};

CHOICE_RESOLVERS[GOSHOKU_FEATURE_EFFECT_ID] = (state, playerId, feature) => {
  const pending = state.pendingEffectChoice!;
  const unitId = pending.set9aMeta?.first;
  let next = close(state, pending);
  if (unitId) {
    next = patchPlayer(next, playerId, (p) =>
      addTurnFeatureModifier(p, KIRIGAKURE_RULE_ID, { instanceId: unitId, features: [feature] }, GOSHOKU_CARD_ID),
    );
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, GOSHOKU_CARD_ID, `${GOSHOKU_FEATURE_EFFECT_ID}:${feature}`) };
};

// ---------------------------------------------------------------------------
// RS-609 戦士の魂（※常駐 ※タッグ）
// 「自軍バトルフェイズごとに１度だけ、『自軍ラッシュエリアのSユニットを１体コマンドゾーンに送るか捨札にする』を実行してもよい。
//  そうしたとき、ナンバーに数字を持ちカテゴリにDAを持たない自軍Sユニットを、バトルエリアとラッシュエリアから１体ずつ選ぶ。
//  このターン、このカードの効果でラッシュエリアから選んだユニットがＮＣを発動するとき、そのユニットの本来のNCの効果を発動する
//  かわりに、このカードの効果でバトルエリアから選んだユニットのNCの効果を発動してもよい。」（atwiki/page-1496）

const SOUL_CARD_ID = "RS-609";
const SOUL_USED_RULE_ID = "rs609_soul_used";
const SOUL_PAIR_RULE_ID = "rs609_soul_pair";
export const SOUL_COST_EFFECT_ID = "rs609_soul_cost";
export const SOUL_COST_DEST_EFFECT_ID = "rs609_soul_cost_destination";
export const SOUL_BATTLE_EFFECT_ID = "rs609_soul_battle";
export const SOUL_RUSH_EFFECT_ID = "rs609_soul_rush";
export const SOUL_NC_EFFECT_ID = "rs609_soul_nc";

type SoulPair = { rushId: string; battleId: string; battleCardId: string };

function soulEligible(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit" || typeof def.comboNumber !== "number") return false;
  if (cardCategories(def).includes("DA")) return false;
  return isSmallUnitNow(state, playerId, card);
}

function soulCostIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].rush.filter((c) => isSmallUnitNow(state, playerId, c)).map((c) => c.instanceId);
}

function soulUsedThisTurn(player: PlayerState, operationInstanceId: string): boolean {
  return getPlayerModifiers(player).some(
    (m) => m.kind === "rule" && m.ruleId === SOUL_USED_RULE_ID && (m as { payload?: unknown }).payload === operationInstanceId,
  );
}

function continueSoulAfterCost(state: GameState, pending: PendingEffectChoice): GameState {
  const pid = pending.playerId;
  const battle = state.players[pid].battle.filter((c) => soulEligible(state, pid, c)).map((c) => c.instanceId);
  const rush = state.players[pid].rush.filter((c) => soulEligible(state, pid, c)).map((c) => c.instanceId);
  if (battle.length === 0 || rush.length === 0) return proceed(state, pending);
  return openEffectChoice(state, { ...pending, effectId: SOUL_BATTLE_EFFECT_ID, kind: "select_unit", validInstanceIds: battle, optional: false, set9aMeta: {} });
}

function moveSoulCost(state: GameState, playerId: PlayerId, instanceId: string, dest: "command" | "discard"): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.rush.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const stacked = (card.stackedCards ?? []).map(strip);
    const toCommand = dest === "command" && p.command.length < COMMAND_ZONE_MAX;
    return {
      ...p,
      rush: p.rush.filter((c) => c.instanceId !== instanceId),
      command: toCommand ? [...p.command, strip(card)] : p.command,
      discard: toCommand ? [...p.discard, ...stacked] : [...p.discard, strip(card), ...stacked],
    };
  });
}

CHOICE_RESOLVERS[SOUL_COST_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (state.players[playerId].command.length >= COMMAND_ZONE_MAX) {
    const moved = moveSoulCost(close(state, pending), playerId, instanceId, "discard");
    return { state: continueSoulAfterCost(moved, pending), log: logFor(state, playerId, SOUL_CARD_ID, `${SOUL_COST_EFFECT_ID}:discard`) };
  }
  return {
    state: openEffectChoice(close(state, pending), {
      ...pending,
      effectId: SOUL_COST_DEST_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: ["command", "discard"],
      optional: false,
      set9aMeta: { first: instanceId },
    }),
  };
};

CHOICE_RESOLVERS[SOUL_COST_DEST_EFFECT_ID] = (state, playerId, dest) => {
  const pending = state.pendingEffectChoice!;
  const costId = pending.set9aMeta?.first;
  if (!costId || (dest !== "command" && dest !== "discard")) return { error: "invalid_target" };
  const moved = moveSoulCost(close(state, pending), playerId, costId, dest);
  return { state: continueSoulAfterCost(moved, pending), log: logFor(state, playerId, SOUL_CARD_ID, `${SOUL_COST_EFFECT_ID}:${dest}`) };
};

CHOICE_RESOLVERS[SOUL_BATTLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const rush = state.players[playerId].rush.filter((c) => soulEligible(state, playerId, c)).map((c) => c.instanceId);
  return {
    state: openEffectChoice(close(state, pending), {
      ...pending,
      effectId: SOUL_RUSH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: rush,
      optional: false,
      set9aMeta: { first: instanceId },
    }),
  };
};

CHOICE_RESOLVERS[SOUL_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const battleId = pending.set9aMeta?.first;
  const battleCard = battleId ? state.players[playerId].battle.find((c) => c.instanceId === battleId) : undefined;
  let next = close(state, pending);
  if (battleCard) {
    const pair: SoulPair = { rushId: instanceId, battleId: battleCard.instanceId, battleCardId: battleCard.cardId };
    next = patchPlayer(next, playerId, (p) => addTurnRuleModifier(p, SOUL_PAIR_RULE_ID, { sourceCardId: SOUL_CARD_ID, payload: pair }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, SOUL_CARD_ID, `${SOUL_RUSH_EFFECT_ID}:pair`) };
};

function soulPairFor(state: GameState, playerId: PlayerId, instanceId: string): SoulPair | undefined {
  for (const m of getPlayerModifiers(state.players[playerId])) {
    if (m.kind !== "rule" || m.ruleId !== SOUL_PAIR_RULE_ID || m.scope !== "turn") continue;
    const pair = (m as { payload?: unknown }).payload as SoulPair | undefined;
    if (pair?.rushId === instanceId) return pair;
  }
  return undefined;
}

/**
 * NC を発動するとき（rules/combo.ts）: 【戦士の魂】でラッシュエリアから選んだユニットなら、本来の NC の効果か、
 * バトルエリアから選んだユニットの NC の効果かを選ぶ。選択を開いたら state、対象外なら null。
 */
export function openWarriorSoulNcChoice(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  ncEffect: string | undefined,
): GameState | null {
  if (state.pendingEffectChoice) return null;
  const pair = soulPairFor(state, playerId, card.instanceId);
  if (!pair || pair.battleId === card.instanceId) return null;
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceCardId: SOUL_CARD_ID, sourceInstanceId: card.instanceId }),
    effectId: SOUL_NC_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [card.instanceId, pair.battleId],
    optional: false,
    set9aMeta: { first: pair.battleCardId, stage: ncEffect },
  });
}

CHOICE_RESOLVERS[SOUL_NC_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const self = selfId ? fieldUnits(state, playerId).find((c) => c.instanceId === selfId) : undefined;
  const borrowedCardId = pending.set9aMeta?.first;
  const cleared = close(state, pending);
  if (!self) return { state: proceed(cleared, pending) };
  const replace = instanceId !== selfId && !!borrowedCardId;
  const card: CardInstance = replace ? { ...self, cardId: borrowedCardId! } : self;
  const effectId = (replace ? getNumberComboEffect(borrowedCardId!) : (pending.set9aMeta?.stage as ReturnType<typeof getNumberComboEffect>));
  const outcome = applyNumberComboEffect(cleared, playerId, card, effectId);
  const next = { ...outcome.state, log: [...outcome.state.log, ...outcome.logs] };
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, SOUL_CARD_ID, `${SOUL_NC_EFFECT_ID}:${replace ? cardName(state.definitions, borrowedCardId!) : "own"}`),
  };
};

// ---------------------------------------------------------------------------
// 常駐オペレーションの起動（RS-608 は自軍ラッシュフェイズ、RS-609 は自軍バトルフェイズ）

export function isSet9AResidentCard(cardId: string): boolean {
  return cardId === GOSHOKU_CARD_ID || cardId === SOUL_CARD_ID;
}

export function canActivateSet9AResident(state: GameState, playerId: PlayerId, operationInstanceId: string): boolean {
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup || state.pendingEffectRush) return false;
  if (state.activePlayer !== playerId || turnPlayerOf(state) !== playerId) return false;
  const player = state.players[playerId];
  const op = player.operation.find((c) => c.instanceId === operationInstanceId);
  if (!op) return false;
  if (op.cardId === GOSHOKU_CARD_ID) {
    if (state.phase !== "rush" || isResidentActivatedThisRush(op)) return false;
    return releasedWbCommands(state, playerId).length > 0;
  }
  if (op.cardId === SOUL_CARD_ID) {
    if (state.phase !== "battle" || soulUsedThisTurn(player, operationInstanceId)) return false;
    return soulCostIds(state, playerId).length > 0;
  }
  return false;
}

export function activateSet9AResident(state: GameState, playerId: PlayerId, operationInstanceId: string): GameState | null {
  if (!canActivateSet9AResident(state, playerId, operationInstanceId)) return null;
  const op = state.players[playerId].operation.find((c) => c.instanceId === operationInstanceId)!;
  const ctx = { playerId, phasePlayerId: playerId, sourceCardId: op.cardId, sourceInstanceId: operationInstanceId };
  if (op.cardId === GOSHOKU_CARD_ID) {
    const marked = patchPlayer(state, playerId, (p) => markResidentActivatedThisRush(p, operationInstanceId));
    return openEffectChoice(marked, {
      ...base(ctx),
      effectId: GOSHOKU_HOLD_EFFECT_ID,
      // ホールドはこの選択の解決で行う（effect_hold の支払いにしない）。
      kind: "select_command",
      validInstanceIds: releasedWbCommands(state, playerId),
      optional: false,
    });
  }
  const marked = patchPlayer(state, playerId, (p) => addTurnRuleModifier(p, SOUL_USED_RULE_ID, { sourceCardId: SOUL_CARD_ID, payload: operationInstanceId }));
  return openEffectChoice(marked, {
    ...base(ctx),
    effectId: SOUL_COST_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: soulCostIds(state, playerId),
    optional: false,
  });
}

/** 合法手: 起動できる常駐オペレーション（RS-609 は自軍バトルフェイズ）。 */
export function listSet9AResidentActivations(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].operation
    .filter((c) => isSet9AResidentCard(c.cardId) && canActivateSet9AResident(state, playerId, c.instanceId))
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RS-610 秘伝ディスク（※常駐）
// 「特徴「侍」を持つユニットは、次の能力を得る⇒タクスMA、コールMA」（atwiki/page-1440）— 自軍・敵軍のユニットとも。

const SECRET_DISK_CARD_ID = "RS-610";

function secretDiskActive(state: Pick<GameState, "players"> | null, fallback?: PlayerState): boolean {
  if (state) return state.players.player1.operation.some((c) => c.cardId === SECRET_DISK_CARD_ID) || state.players.player2.operation.some((c) => c.cardId === SECRET_DISK_CARD_ID);
  return !!fallback?.operation.some((c) => c.cardId === SECRET_DISK_CARD_ID);
}

/** タクス: 左隣のユニットが【秘伝ディスク】で得たタクスMA（rules/../keywords/battleKeywords.ts taxisSpFloor から呼ぶ）。 */
export function set9ATaxisCategory(state: GameState, playerId: PlayerId, left: CardInstance): "MA" | null {
  if (!secretDiskActive(state)) return null;
  return unitFeatures(state, playerId, left).includes("侍") ? "MA" : null;
}

/** コール: 【秘伝ディスク】で得たコールMA（rules/callLead.ts から呼ぶ）。 */
export function set9AGrantsCallLead(
  player: PlayerState,
  definitions: GameState["definitions"],
  card: CardInstance,
  kind: "call" | "lead",
  category: string,
): boolean {
  if (kind !== "call" || category !== "MA") return false;
  const context = zordRuleContextState();
  if (!secretDiskActive(context, player)) return false;
  return zordMaterialFeatures(getDefinition(definitions, card.cardId), card).includes("侍");
}

// ---------------------------------------------------------------------------
// RS-612 スカイエース【スカイコンテナ】
// 「これをラッシュしたとき、自軍コマンドを好きな数選び捨札にしてもよい。そうしたとき、自軍山札を見て、特徴「メカ」を持つSユニットの
//  カードを、捨札にしたコマンドの数まで好きな枚数選び、自軍コマンドゾーンにホールド状態で置く。その後、山札をシャッフルする。」
// （atwiki/page-1451）

export const SKY_COMMAND_EFFECT_ID = "rs612_sky_container_command";
export const SKY_DECK_EFFECT_ID = "rs612_sky_container_deck";

function openSkyContainer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${SKY_COMMAND_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: SKY_COMMAND_EFFECT_ID,
      kind: "select_command",
      commandAction: "discard",
      commandFilter: "any",
      validInstanceIds: ids,
      optional: true,
      set9aMeta: { selected: [] },
    }),
    detail: SKY_COMMAND_EFFECT_ID,
  };
}

function mechaSDeckIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S" && (def.features ?? []).includes("メカ");
    })
    .map((c) => c.instanceId);
}

function finishSkyCommands(state: GameState, playerId: PlayerId, selected: string[]): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "RS-612", `${SKY_COMMAND_EFFECT_ID}:${selected.length}`);
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => !selected.includes(c.instanceId)),
    discard: [...p.discard, ...p.command.filter((c) => selected.includes(c.instanceId)).map(strip)],
  }));
  const room = Math.max(0, COMMAND_ZONE_MAX - next.players[playerId].command.length);
  const max = Math.min(selected.length, room);
  const ids = mechaSDeckIds(next, playerId);
  if (max <= 0 || ids.length === 0) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
    return { state: proceed(next, pending), log };
  }
  return {
    state: openEffectChoice(next, {
      ...pending,
      effectId: SKY_DECK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      viewedInstanceIds: next.players[playerId].deck.map((c) => c.instanceId),
      selectedInstanceIds: [],
      optional: true,
      set9aMeta: { selected: [], remaining: max },
    }),
    log,
  };
}

function pickMore(
  state: GameState,
  pending: PendingEffectChoice,
  selected: string[],
  rest: string[],
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      ...pending,
      selectedInstanceIds: selected,
      validInstanceIds: [SET9A_DONE, ...rest],
      optional: false,
      set9aMeta: { ...(pending.set9aMeta ?? {}), selected },
    },
  };
}

CHOICE_RESOLVERS[SKY_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.set9aMeta?.selected ?? [];
  if (instanceId === SET9A_DONE) return finishSkyCommands(state, playerId, selected);
  const next = [...selected, instanceId];
  const rest = state.players[playerId].command.map((c) => c.instanceId).filter((id) => !next.includes(id));
  if (rest.length === 0) return finishSkyCommands(state, playerId, next);
  return { state: pickMore(state, pending, next, rest) };
};
CHOICE_SKIPPERS[SKY_COMMAND_EFFECT_ID] = simpleSkip();
CHOICE_CAN_CONFIRM[SKY_COMMAND_EFFECT_ID] = (_s, pending) => (pending.set9aMeta?.selected?.length ?? 0) > 0;
CHOICE_CONFIRMERS[SKY_COMMAND_EFFECT_ID] = (state, playerId) =>
  finishSkyCommands(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);

function finishSkyDeck(state: GameState, playerId: PlayerId, selected: string[]): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const picked = p.deck.filter((c) => selected.includes(c.instanceId));
    return {
      ...p,
      deck: shuffleCards(p.deck.filter((c) => !selected.includes(c.instanceId))),
      command: [...p.command, ...picked.map((c) => ({ ...strip(c), commandHeld: true }))],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-612", `${SKY_DECK_EFFECT_ID}:${selected.length}`) };
}

CHOICE_RESOLVERS[SKY_DECK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const meta = pending.set9aMeta ?? {};
  const selected = meta.selected ?? [];
  if (instanceId === SET9A_DONE) return finishSkyDeck(state, playerId, selected);
  const next = [...selected, instanceId];
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId && id !== SET9A_DONE);
  if (next.length >= (meta.remaining ?? 1) || rest.length === 0) return finishSkyDeck(state, playerId, next);
  return { state: pickMore(state, pending, next, rest) };
};
CHOICE_SKIPPERS[SKY_DECK_EFFECT_ID] = (state, playerId) => finishSkyDeck(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);
CHOICE_CAN_CONFIRM[SKY_DECK_EFFECT_ID] = () => true;
CHOICE_CONFIRMERS[SKY_DECK_EFFECT_ID] = (state, playerId) =>
  finishSkyDeck(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);

// ---------------------------------------------------------------------------
// RS-613 ダイヤジャック【ダイヤソード】（NC）
// 「このターン、次に自軍バトルエリアのユニットがホールド状態になったとき、ホールドしたユニットのBP以下のBPを持つ敵軍ユニットを
//  1体選び撃破してもよい。」（atwiki/page-1452）— 自分をホールドして BP7000 になったレイなら BP7000 以下（同 Q1）、
//  【潜水】でホールドされたオロチでも発動できる（同 Q2）。発動はホールドした処理が終わってから（settleSet9AAfterAction）。

export const DIAMOND_SWORD_EFFECT_ID = "rs613_diamond_sword";

function startDiamondSword(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const sourceInstanceId = ctx.triggerSourceInstanceId;
  if (!sourceInstanceId) return { state, detail: `${DIAMOND_SWORD_EFFECT_ID}:no_source` };
  const watchers = [
    ...(state.set9aState?.diamondSword ?? []),
    { playerId: ctx.playerId, sourceInstanceId, turn: state.turn, known: heldInstanceIds(state, ctx.playerId) },
  ];
  return { state: { ...state, set9aState: { ...(state.set9aState ?? {}), diamondSword: watchers } }, detail: `${DIAMOND_SWORD_EFFECT_ID}:armed` };
}

function heldInstanceIds(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId).filter((c) => c.commandHeld).map((c) => c.instanceId);
}

/**
 * 待っている【ダイヤソード】のプレイヤーの場のユニットのうち、前に調べたとき（発動時・前回）からホールド状態になった
 * バトルエリアのユニットを記録する。applyAction の後処理とターンを終える処理（ホールドがターンを終えるときに起きる
 * 【潜水】等）から呼ぶ。前のターンの発動は消す。
 */
function scanDiamondSword(state: GameState): GameState {
  const watchers = state.set9aState?.diamondSword;
  if (!watchers?.length) return state;
  let changed = false;
  const next = watchers
    .filter((w) => {
      if (w.turn === state.turn) return true;
      changed = true;
      return false;
    })
    .map((w) => {
      const heldNow = heldInstanceIds(state, w.playerId);
      if (w.firedBy) return w;
      const known = new Set(w.known ?? []);
      const became = state.players[w.playerId].battle.find((c) => c.commandHeld && !known.has(c.instanceId));
      const sameKnown = heldNow.length === known.size && heldNow.every((id) => known.has(id));
      if (!became && sameKnown) return w;
      changed = true;
      if (!became) return { ...w, known: heldNow };
      return { ...w, known: heldNow, firedBy: became.instanceId, firedBp: effectiveBp(state, w.playerId, became) };
    });
  return changed ? { ...state, set9aState: { ...(state.set9aState ?? {}), diamondSword: next } } : state;
}

/** ターンを終える処理の最後（rules/../core/applyAction.ts finalizeTurnEnd）: ホールドで発動した【ダイヤソード】を開く。 */
export function settleSet9ATurnEnd(state: GameState): GameState {
  const scanned = scanDiamondSword(state);
  if (scanned.set9aState?.diamondSword?.some((w) => w.firedBy) && !blocking(scanned)) return openFiredDiamondSword(scanned);
  return scanned;
}

function openFiredDiamondSword(state: GameState): GameState {
  const watchers = state.set9aState?.diamondSword ?? [];
  const fired = watchers.find((w) => w.firedBy);
  if (!fired) return state;
  const rest = watchers.filter((w) => w !== fired);
  const cleared: GameState = { ...state, set9aState: { ...(state.set9aState ?? {}), diamondSword: rest } };
  const unit = fieldUnits(state, fired.playerId).find((c) => c.instanceId === fired.firedBy);
  const bp = unit ? effectiveBp(state, fired.playerId, unit) : (fired.firedBp ?? 0);
  const enemyId = opponent(fired.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= bp)
    .map((c) => c.instanceId);
  if (ids.length === 0) return cleared;
  return openEffectChoice(cleared, {
    ...base({ playerId: fired.playerId, phasePlayerId: turnPlayerOf(state), sourceCardId: "RS-613", sourceInstanceId: fired.sourceInstanceId }),
    effectId: DIAMOND_SWORD_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    optional: true,
    maxBp: bp,
    unitDestination: "discard",
  });
}

CHOICE_RESOLVERS[DIAMOND_SWORD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  const moved = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in moved) return moved;
  return {
    state: proceed(moved.state, pending),
    log: logFor(state, playerId, "RS-613", `${DIAMOND_SWORD_EFFECT_ID}:${found ? cardName(state.definitions, found.card.cardId) : instanceId}`),
  };
};
CHOICE_SKIPPERS[DIAMOND_SWORD_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-614 クローバーキング【クラブメガトン】（NC）
// 「BP4000の敵軍Sユニットをすべて持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。」（atwiki/page-1453）
// 置くかどうかを1度だけ選ぶ（対象のユニットを選ぶと、すべてを置く）。

export const CLUB_MEGATON_EFFECT_ID = "rs614_club_megaton";

function clubMegatonTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => isSmallUnitNow(state, enemyId, c) && effectiveBp(state, enemyId, c) === 4000)
    .map((c) => c.instanceId);
}

function openClubMegaton(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = clubMegatonTargets(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: `${CLUB_MEGATON_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: CLUB_MEGATON_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      viewedInstanceIds: ids,
      optional: true,
    }),
    detail: CLUB_MEGATON_EFFECT_ID,
  };
}

function acceptClubMegaton(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const targets = clubMegatonTargets(cleared, playerId);
  const next = placeAllInCommand(cleared, opponent(playerId), targets, pending);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-614", `${CLUB_MEGATON_EFFECT_ID}:${targets.length}`) };
}

CHOICE_RESOLVERS[CLUB_MEGATON_EFFECT_ID] = (state, playerId) => acceptClubMegaton(state, playerId);
CHOICE_SKIPPERS[CLUB_MEGATON_EFFECT_ID] = simpleSkip();
CHOICE_CAN_CONFIRM[CLUB_MEGATON_EFFECT_ID] = () => true;
CHOICE_CONFIRMERS[CLUB_MEGATON_EFFECT_ID] = (state, playerId) => acceptClubMegaton(state, playerId);

// ---------------------------------------------------------------------------
// RS-615 ハートクイン【ジャッカーコバック】（NC）
// 「自軍バトルエリアから、特徴「ブルー」「レッド」「グリーン」を持つSユニットをそれぞれ1体ずつ好きな順にホールドして、次の効果を
//  発動できる⇒このターン、これはSP1になり、ホールド状態の敵軍コマンドをすべて捨札にする。」（atwiki/page-1454）
// 1体ずつ選んでホールドする（ホールドした順は【ダイヤソード】等の「ホールド状態になったとき」に関わる）。最後の1体まで
// 選べる組み合わせのユニットだけを候補にする。

export const KOBACK_EFFECT_ID = "rs615_jakka_koback";
const KOBACK_SP_RULE_ID = "rs615_koback_sp1";
const KOBACK_COLORS = ["ブルー", "レッド", "グリーン"];

function kobackPool(state: GameState, playerId: PlayerId): CardInstance[] {
  return state.players[playerId].battle.filter((c) => !c.commandHeld && isSmallUnitNow(state, playerId, c));
}

/** chosen（色を割り当て済み）を含めて3色をそろえられるか。 */
function kobackFeasible(state: GameState, playerId: PlayerId, chosen: CardInstance[], pool: CardInstance[]): boolean {
  const features = (c: CardInstance) => unitFeatures(state, playerId, c);
  const assign = (units: CardInstance[], colors: string[]): boolean => {
    if (units.length === 0) {
      // 残りの色を、プールの別々のユニットでそろえる。
      const fill = (left: string[], used: Set<string>): boolean => {
        if (left.length === 0) return true;
        const [color, ...rest] = left;
        return pool.some((u) => !used.has(u.instanceId) && features(u).includes(color!) && fill(rest, new Set([...used, u.instanceId])));
      };
      return fill(colors, new Set(chosen.map((c) => c.instanceId)));
    }
    const [head, ...tail] = units;
    return colors.some((color) => features(head!).includes(color) && assign(tail, colors.filter((c) => c !== color)));
  };
  return chosen.length <= KOBACK_COLORS.length && assign(chosen, KOBACK_COLORS);
}

function kobackCandidates(state: GameState, playerId: PlayerId, selected: string[]): string[] {
  const all = state.players[playerId].battle;
  const chosen = selected.map((id) => all.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
  const pool = kobackPool(state, playerId);
  return pool
    .filter((u) => !selected.includes(u.instanceId) && kobackFeasible(state, playerId, [...chosen, u], pool))
    .map((u) => u.instanceId);
}

function openKoback(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = kobackCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: `${KOBACK_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: KOBACK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      optional: true,
      set9aMeta: { selected: [] },
    }),
    detail: KOBACK_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[KOBACK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set9aMeta?.selected ?? []), instanceId];
  const held = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  if (selected.length < KOBACK_COLORS.length) {
    const ids = kobackCandidates(held, playerId, selected);
    return {
      state: {
        ...held,
        pendingEffectChoice: { ...pending, validInstanceIds: ids, optional: false, selectedInstanceIds: selected, set9aMeta: { selected } },
      },
    };
  }
  const enemyId = opponent(playerId);
  let next = close(held, pending);
  const selfId = pending.sourceInstanceId;
  if (selfId) next = patchPlayer(next, playerId, (p) => addTurnRuleModifier(p, KOBACK_SP_RULE_ID, { sourceCardId: "RS-615", payload: selfId }));
  next = patchPlayer(next, enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => !c.commandHeld),
    discard: [...p.discard, ...p.command.filter((c) => c.commandHeld).map(strip)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-615", `${KOBACK_EFFECT_ID}:activated`) };
};
CHOICE_SKIPPERS[KOBACK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-620 ジェットガルーダ【ガルーダクロー】
// 「これをラッシュしたとき、敵軍パワーゾーンからダメージ以外のカードを1枚選び、持ち主の山札の上に戻してもよい。」（atwiki/page-1458）

export const GARUDA_CLAW_EFFECT_ID = "rs620_garuda_claw";

function openGarudaClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${GARUDA_CLAW_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: GARUDA_CLAW_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: ids,
      optional: true,
    }),
    detail: GARUDA_CLAW_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GARUDA_CLAW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    deck: card ? [strip(card), ...p.deck] : p.deck,
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-620", `${GARUDA_CLAW_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : instanceId}`) };
};
CHOICE_SKIPPERS[GARUDA_CLAW_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-621 バードガルーダ【ダイヤブリザード】
// 「これをラッシュしたとき、敵軍ユニットを本来のBPが8000以下になるように好きな数選び、持ち主のパワーゾーンに送ってもよい。」
// （atwiki/page-1459）— 本来の BP の合計が8000以下。1体ずつ選び、選び終えたら送る。

export const DIAMOND_BLIZZARD_EFFECT_ID = "rs621_diamond_blizzard";
const BLIZZARD_BUDGET = 8000;

function blizzardCandidates(state: GameState, playerId: PlayerId, selected: string[]): string[] {
  const enemyId = opponent(playerId);
  const all = fieldUnits(state, enemyId);
  const used = selected.reduce((sum, id) => sum + printedBp(state, all.find((c) => c.instanceId === id)?.cardId ?? ""), 0);
  return all
    .filter((c) => !selected.includes(c.instanceId) && used + printedBp(state, c.cardId) <= BLIZZARD_BUDGET)
    .map((c) => c.instanceId);
}

function openBlizzard(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = blizzardCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: `${DIAMOND_BLIZZARD_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: DIAMOND_BLIZZARD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      optional: true,
      bpBudget: BLIZZARD_BUDGET,
      set9aMeta: { selected: [] },
    }),
    detail: DIAMOND_BLIZZARD_EFFECT_ID,
  };
}

function finishBlizzard(state: GameState, playerId: PlayerId, selected: string[]): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  for (const id of selected) {
    const moved = applyUnitLeave(next, id, "power", pending.phasePlayerId);
    if (!("error" in moved)) next = moved.state;
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-621", `${DIAMOND_BLIZZARD_EFFECT_ID}:${selected.length}`) };
}

CHOICE_RESOLVERS[DIAMOND_BLIZZARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set9aMeta?.selected ?? []), instanceId];
  const ids = blizzardCandidates(state, playerId, selected);
  if (ids.length === 0) return finishBlizzard(state, playerId, selected);
  return {
    state: {
      ...state,
      pendingEffectChoice: { ...pending, validInstanceIds: ids, selectedInstanceIds: selected, set9aMeta: { selected } },
    },
  };
};
CHOICE_SKIPPERS[DIAMOND_BLIZZARD_EFFECT_ID] = (state, playerId) =>
  finishBlizzard(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);
CHOICE_CAN_CONFIRM[DIAMOND_BLIZZARD_EFFECT_ID] = (_s, pending) => (pending.set9aMeta?.selected?.length ?? 0) > 0;
CHOICE_CONFIRMERS[DIAMOND_BLIZZARD_EFFECT_ID] = (state, playerId) =>
  finishBlizzard(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);

// ---------------------------------------------------------------------------
// RS-623 ツバサマル【翼合体】は同じ文言の RS-647【ソウルバード】・RS-650 等と共通の処理（rules/stackOntoLargeUnit.ts）。

// ---------------------------------------------------------------------------
// RS-624 メガウインガー・ファイターモード【ウインガーキャノン】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアのユニットが4体なら、次の効果を発動できる⇒敵軍バトルエリアの
//  追加条件を持たないユニットをすべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1491）

export const WINGER_CANNON_EFFECT_ID = "rs624_winger_cannon";

function hasAdditionalCondition(state: GameState, cardId: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (!def) return false;
  if (def.rushAdditionalCondition) return true;
  return typeof def.powerCost === "string" && /[+\-－＋]/.test(def.powerCost);
}

function openWingerCannon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self || turnPlayerOf(state) !== ctx.playerId) return { state, detail: `${WINGER_CANNON_EFFECT_ID}:not_own_turn` };
  if (state.players[opponent(ctx.playerId)].battle.length !== 4) return { state, detail: `${WINGER_CANNON_EFFECT_ID}:not_four` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: self }),
      effectId: WINGER_CANNON_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [self],
      optional: true,
    }),
    detail: WINGER_CANNON_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[WINGER_CANNON_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cleared = close(state, pending);
  const targets = cleared.players[enemyId].battle.filter((c) => !hasAdditionalCondition(cleared, c.cardId)).map((c) => c.instanceId);
  const next = placeAllInCommand(cleared, enemyId, targets, pending);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-624", `${WINGER_CANNON_EFFECT_ID}:${targets.length}`) };
};
CHOICE_SKIPPERS[WINGER_CANNON_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-625 メガウインガー・フライヤーモード【シルバー専用機】
// 「これをラッシュしたとき、この追加条件で捨札にしたカードを見て、SPが空欄でなかったなら、このターン、これは次の能力を得る⇒
//  BP+2000、「SP1」」（atwiki/page-1461）— SP「！」も空欄ではない。

const SILVER_CUSTOM_RULE_ID = "rs625_silver_custom";

function applySilverCustom(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  const card = self ? fieldUnits(state, ctx.playerId).find((c) => c.instanceId === self) : undefined;
  const material = card?.zordMaterialCardId;
  if (!card || !material) return { state, detail: "rs625_silver_custom:no_material" };
  const def = getDefinition(state.definitions, material);
  if (def?.sp === undefined || def.sp === null) return { state, detail: "rs625_silver_custom:blank_sp" };
  return {
    state: patchPlayer(state, ctx.playerId, (p) => addTurnRuleModifier(p, SILVER_CUSTOM_RULE_ID, { sourceCardId: "RS-625", payload: card.instanceId })),
    detail: "rs625_silver_custom",
  };
}

// ---------------------------------------------------------------------------
// RS-626 ギャラクシーメガ【メガシールド】
// 「敵軍ターン中、これが撃破されたとき、次の効果から1つ選び発動できる⇒ ◎敵軍ユニットを1体選び撃破する。
//  ◎自軍捨札からウイングを持つSユニットのカードを5枚まで選び、自軍ラッシュエリアに出す。」（atwiki/page-1525）
// 最初の選択で、敵軍ユニットを選べば前者、捨札のカードを選べば後者（続けて5枚まで選ぶ）。段階 2「撃破されたとき」の誘発。

export const MEGA_SHIELD_EFFECT_ID = "rs626_mega_shield";
export const MEGA_SHIELD_DEPLOY_EFFECT_ID = "rs626_mega_shield_deploy";
const MEGA_SHIELD_MAX = 5;

function megaShieldDiscardIds(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  return state.players[playerId].discard
    .filter((c) => {
      if (exclude.includes(c.instanceId)) return false;
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S" && isWingUnitCard(state, c.cardId);
    })
    .map((c) => c.instanceId);
}

/** 「これが撃破されたとき」（rules/leaveEffects.ts resolveDestroyedFactEffects から呼ぶ）。 */
export function openSet9ADestroyedEffects(state: GameState, ownerId: PlayerId, cardId: string): GameState {
  if (cardId !== "RS-626") return state;
  const turnPlayer = turnPlayerOf(state);
  if (turnPlayer === ownerId) return state;
  const enemyIds = fieldUnits(state, opponent(ownerId)).map((c) => c.instanceId);
  const discardIds = megaShieldDiscardIds(state, ownerId, []);
  if (enemyIds.length + discardIds.length === 0) return state;
  return openAfter(state, {
    ...base({ playerId: ownerId, phasePlayerId: turnPlayer, sourceCardId: "RS-626" }),
    effectId: MEGA_SHIELD_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [...enemyIds, ...discardIds],
    optional: true,
  });
}

function finishMegaShieldDeploy(state: GameState, playerId: PlayerId, selected: string[]): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  next = startEffectRush(next, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: MEGA_SHIELD_DEPLOY_EFFECT_ID,
    sourceCardId: "RS-626",
    fromZone: "discard",
    candidates: selected,
    maxCount: selected.length,
    requireConditions: false,
    mandatory: true,
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-626", `${MEGA_SHIELD_DEPLOY_EFFECT_ID}:${selected.length}`) };
}

CHOICE_RESOLVERS[MEGA_SHIELD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemy = findCardInField(state, instanceId);
  if (enemy && enemy.playerId !== playerId) {
    const moved = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
    if ("error" in moved) return moved;
    return { state: proceed(moved.state, pending), log: logFor(state, playerId, "RS-626", `${MEGA_SHIELD_EFFECT_ID}:destroy:${cardName(state.definitions, enemy.card.cardId)}`) };
  }
  const selected = [instanceId];
  const rest = megaShieldDiscardIds(state, playerId, selected);
  if (rest.length === 0) return finishMegaShieldDeploy(state, playerId, selected);
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: MEGA_SHIELD_DEPLOY_EFFECT_ID,
        validInstanceIds: rest,
        selectedInstanceIds: selected,
        optional: true,
        set9aMeta: { selected },
      },
    },
  };
};
CHOICE_SKIPPERS[MEGA_SHIELD_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[MEGA_SHIELD_DEPLOY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set9aMeta?.selected ?? []), instanceId];
  const rest = megaShieldDiscardIds(state, playerId, selected);
  if (selected.length >= MEGA_SHIELD_MAX || rest.length === 0) return finishMegaShieldDeploy(state, playerId, selected);
  return {
    state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: rest, selectedInstanceIds: selected, set9aMeta: { selected } } },
  };
};
// 2枚目以降を選ばない（見送る・確定する）: 選んだカードを出す。
CHOICE_SKIPPERS[MEGA_SHIELD_DEPLOY_EFFECT_ID] = (state, playerId) =>
  finishMegaShieldDeploy(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);
CHOICE_CAN_CONFIRM[MEGA_SHIELD_DEPLOY_EFFECT_ID] = () => true;
CHOICE_CONFIRMERS[MEGA_SHIELD_DEPLOY_EFFECT_ID] = (state, playerId) =>
  finishMegaShieldDeploy(state, playerId, state.pendingEffectChoice!.set9aMeta?.selected ?? []);

// ---------------------------------------------------------------------------
// RK-322 仮面ライダーレイ【ブリザードクロー・エクスキュージョン】（RS-613【ダイヤソード】Q1 の前提）
// 「自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、このターン、これはBP+4000される。」
// （atwiki/page-1452 Q1 が前提とする処理: 自分をホールドして BP7000 になる）

export const BLIZZARD_CLAW_EFFECT_ID = "rk322_blizzard_claw_execution";

function openBlizzardClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  const unit = self ? state.players[ctx.playerId].battle.find((c) => c.instanceId === self) : undefined;
  if (!unit || unit.commandHeld || turnPlayerOf(state) !== ctx.playerId) return { state, detail: `${BLIZZARD_CLAW_EFFECT_ID}:skip` };
  return {
    state: openAfter(state, {
      ...base({ ...ctx, sourceInstanceId: self }),
      effectId: BLIZZARD_CLAW_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [self!],
      optional: true,
    }),
    detail: BLIZZARD_CLAW_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BLIZZARD_CLAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) =>
      c.instanceId === selfId && !c.commandHeld ? { ...c, commandHeld: true, bpModifier: (c.bpModifier ?? 0) + 4000 } : c,
    ),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-322", `${BLIZZARD_CLAW_EFFECT_ID}:hold`) };
};
CHOICE_SKIPPERS[BLIZZARD_CLAW_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 継続効果

function turnRulePayloads(player: PlayerState, ruleId: string): unknown[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload);
}

function ownWingUnitCardsInDiscard(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].discard.filter((c) => isWingUnitCard(state, c.cardId)).length;
}

/** SP（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。 */
export function set9AEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  let next = sp;
  // RS-617【バードメーザー】: 自軍捨札にウイングを持つユニットカードが5枚以上あれば「SP2」。
  if (instance.cardId === "RS-617" && ownWingUnitCardsInDiscard(state, playerId) >= 5) next = Math.max(next, 2);
  // RS-615【ジャッカーコバック】: このターン、これは SP1 になる。
  if (turnRulePayloads(state.players[playerId], KOBACK_SP_RULE_ID).includes(instance.instanceId)) next = Math.max(next, 1);
  // RS-625【シルバー専用機】: このターン「SP1」。
  if (turnRulePayloads(state.players[playerId], SILVER_CUSTOM_RULE_ID).includes(instance.instanceId)) next = Math.max(next, 1);
  return next;
}

/** BP（rules/fieldAuras.ts から呼ぶ）。 */
export function set9AFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  // RS-618【ジェットランサー】: 自軍捨札にあるウイングを持つユニットカード1体につき BP+1000。
  if (instance.cardId === "RS-618") return 1000 * ownWingUnitCardsInDiscard(state, playerId);
  // RS-625【シルバー専用機】: このターン BP+2000。
  if (turnRulePayloads(state.players[playerId], SILVER_CUSTOM_RULE_ID).includes(instance.instanceId)) return 2000;
  return 0;
}

/**
 * RS-619 ジェットマシン【航空戦力の奇襲】: これが自軍エリアにある間、ウイングを持つユニット（自軍・敵軍とも）は、
 * 特徴「航空機」を持たないユニットにアタックされない（atwiki/page-1457）。
 */
export function set9ADefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const machine = (["player1", "player2"] as const).some((pid) => fieldUnits(state, pid).some((c) => c.cardId === "RS-619"));
  if (!machine) return false;
  const defender = fieldUnits(state, defenderPlayerId).find((c) => c.instanceId === defenderInstanceId);
  if (!defender || !unitHasWing(state, defenderPlayerId, defender)) return false;
  return !unitFeatures(state, attackerPlayerId, attacker).includes("航空機");
}

/** RS-622 グリフォーザー【グリフォカリバー4世】: このユニットは、敵軍ラッシュエリアのユニットにアタックできる。 */
export function set9AAttackerCanAttackRush(_state: GameState, _playerId: PlayerId, attacker: CardInstance): boolean {
  return attacker.cardId === "RS-622";
}

// ---------------------------------------------------------------------------
// applyAction の後処理

/** applyAction の後処理（入れ子でない呼び出しのとき）。 */
export function settleSet9AAfterAction(_before: GameState, after: GameState): GameState {
  let next = scanDiamondSword(after);
  if (next.winner) return next;
  if (next.set9aState?.falcon && !falconBusy(next) && !blocking(next)) next = continueFalcon(next);
  if (next.set9aState?.diamondSword?.some((w) => w.firedBy) && !blocking(next) && !falconBusy(next)) next = openFiredDiamondSword(next);
  return next;
}

function blocking(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry ||
    state.deferredDestroyTriggers?.length
  );
}

// ---------------------------------------------------------------------------
// DSL の grant_keyword（`set9a::cardId::name`）

const SET9A_KEYWORD_PREFIX = "set9a::";

const SET9A_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RS-605::wing_from_deck": openWingFromDeck,
  "RS-606::hikarimaru": openHikarimaru,
  "RS-607::falcon_summoner": startFalcon,
  "RS-612::sky_container": openSkyContainer,
  "RS-613::diamond_sword": startDiamondSword,
  "RS-614::club_megaton": openClubMegaton,
  "RS-615::jakka_koback": openKoback,
  "RS-620::garuda_claw": openGarudaClaw,
  "RS-621::diamond_blizzard": openBlizzard,
  "RS-624::winger_cannon": openWingerCannon,
  "RS-625::silver_custom": applySilverCustom,
  "RK-322::blizzard_claw": openBlizzardClaw,
};

export function trySet9ACardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET9A_KEYWORD_PREFIX)) return null;
  const handler = SET9A_KEYWORDS[keyword.slice(SET9A_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールの選択の CPU の手（対象外なら null）。 */
export function pickSet9ACpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const confirm = actions.find((a) => a.type === "confirm_effect_choice");
  const picks = actions.filter(
    (a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice",
  );
  const done = picks.find((a) => a.instanceId === SET9A_DONE);
  const cards = picks.filter((a) => a.instanceId !== SET9A_DONE);
  const me = pending.playerId;
  const enemyId = opponent(me);
  const enemyBp = (id: string): number => {
    const card = fieldUnits(state, enemyId).find((c) => c.instanceId === id);
    return card ? effectiveBp(state, enemyId, card) : -1;
  };
  const strongestEnemy = () => [...cards].sort((a, b) => enemyBp(b.instanceId) - enemyBp(a.instanceId))[0];
  switch (pending.effectId) {
    case SKY_COMMAND_EFFECT_ID:
      // コマンドを減らしてまで山札から置くことはしない。
      return skip ?? done ?? confirm ?? cards[0] ?? null;
    case SOUL_NC_EFFECT_ID:
      return cards.find((a) => a.instanceId !== pending.sourceInstanceId) ?? cards[0] ?? null;
    case MEGA_SHIELD_EFFECT_ID:
    case DIAMOND_SWORD_EFFECT_ID:
    case HIKARIMARU_TARGET_EFFECT_ID: {
      const best = strongestEnemy();
      if (best && enemyBp(best.instanceId) >= 0) return best;
      return cards[0] ?? skip ?? null;
    }
    case DIAMOND_BLIZZARD_EFFECT_ID: {
      const best = strongestEnemy();
      return best ?? confirm ?? skip ?? null;
    }
    default:
      return cards[0] ?? done ?? confirm ?? skip ?? null;
  }
}
