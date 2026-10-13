/**
 * 第7弾「七忍の炎陣」（legend1）RS-432〜RS-452 のカード固有の効果（cardSpec RS7-432-452 の既知の不具合の修正）。
 *
 * - NC の効果: `trySet7ANumberCombo`（rules/numberComboEffects.ts applyNumberComboEffect から呼ぶ）
 * - バトルエリアに出たとき: `trySet7AOnEnterBattle`（rules/combo.ts の進入処理から呼ぶ）
 * - 継続効果: `set7AFieldBpBonus` / `set7AEffectiveSp`
 * - バトルエリアからラッシュエリアに戻ったとき（RS-441【コサックダンス】）: `afterUnitsReturnedToRush`
 * - 選択の解決: `tryResolveSet7AChoice` / `trySkipSet7AChoice` / `tryConfirmSet7AChoice`
 * 構成は rules/legend1/set6NamedEffectsB.ts と同じ。
 */
import { fieldCardMatchesPartner } from "../zord";
import { resolveZordFusionPartnerSlots } from "../../dsl/zordBridge";
import type {
  CardInstance,
  GameState,
  PendingEffectChoice,
  PendingLeave,
  PendingStrike,
  PlayerId,
  PlayerState,
} from "../../types/game";
import { finalizeLeaveReaction, tryLeaveField } from "../operationCounters";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isSmallUnit, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, requestDrawFromDeck, type ChoiceOutcome } from "../pendingChoices";
import { buildEffectHoldPayment } from "../commandPayment";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { markBattleBlocked } from "../turnModifiers";
import { shuffleCards } from "../errataCardEffects";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import type { ComboOutcome } from "../comboTypes";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { resolvePlayableCard, resolveRushAdditionalCondition } from "@rangers-strike/cards";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export function isSet7AChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 1枚ずつ選び、confirm_effect_choice で（少なくても）確定できる選択か。 */
export function isSet7AConfirmableChoice(pending: PendingEffectChoice): boolean {
  return pending.effectId in CHOICE_CONFIRMERS;
}

export function tryResolveSet7AChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipSet7AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function tryConfirmSet7AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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
  if (cleared.pendingLeave || cleared.pendingEffectChoice) {
    // 解決の途中で別の選択が開いたら、割り込まれていた選択はその後に再開する。
    if (pending.resumeChoice && cleared.pendingEffectChoice && cleared.pendingEffectChoice !== pending) {
      return {
        ...cleared,
        pendingEffectChoice: { ...cleared.pendingEffectChoice, resumeChoice: cleared.pendingEffectChoice.resumeChoice ?? pending.resumeChoice },
      };
    }
    return cleared;
  }
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

function simpleSkip(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, cardId, pending.effectId) };
  };
}

/** 次の選択を開く（元の選択の resumeChoice を引き継ぐ）。 */
function reopen(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return openEffectChoice(
    { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    { ...next, resumeChoice: pending.resumeChoice },
  );
}

function strip(card: CardInstance): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function categoriesOf(state: GameState, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category as unknown;
  return Array.isArray(c) ? (c as string[]) : typeof c === "string" ? [c] : [];
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function hasFeature(state: GameState, playerId: PlayerId, card: CardInstance, feature: string): boolean {
  return unitFeatures(state, playerId, card).includes(feature);
}

function ncLog(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "number_combo", cardId, state.definitions, detail);
}

// ---------------------------------------------------------------------------
// NC の効果（rules/numberComboEffects.ts applyNumberComboEffect から）

/** NC が成立したことをこのターンの間記録する（発動元が場を離れても効果は続く。R-CN-06）。 */
export const NC_ESTABLISHED_RULE = "nc_effect_established";

export function recordNcEstablishedThisTurn(state: GameState, playerId: PlayerId, card: CardInstance, effectId: string): GameState {
  return patchPlayer(state, playerId, (p) =>
    addTurnRuleModifier(p, `${NC_ESTABLISHED_RULE}:${effectId}`, { sourceCardId: card.cardId, payload: { effectId, instanceId: card.instanceId } }),
  );
}

export function ncEstablishedThisTurn(state: GameState, playerId: PlayerId, effectId: string): boolean {
  return getPlayerModifiers(state.players[playerId]).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === `${NC_ESTABLISHED_RULE}:${effectId}` &&
      m.scope === "turn",
  );
}

function establishNc(state: GameState, playerId: PlayerId, card: CardInstance, effectId: string, sp1: boolean): GameState {
  let next = sp1 ? grantSp1ToBattleUnit(state, playerId, card.instanceId) : state;
  next = markBattleNcEffect(next, playerId, card.instanceId, effectId);
  return recordNcEstablishedThisTurn(next, playerId, card, effectId);
}

const SET7A_NC_CARDS = new Set(["RS-441", "RS-442", "RS-443", "RS-444", "RS-447", "RS-448", "RS-449"]);

/** このモジュールが NC の効果を処理するカード。 */
export function isSet7ANcCard(cardId: string): boolean {
  return SET7A_NC_CARDS.has(cardId);
}

export function trySet7ANumberCombo(state: GameState, playerId: PlayerId, card: CardInstance): ComboOutcome | null {
  switch (card.cardId) {
    case "RS-441":
      return ncResult(state, playerId, card, "kosakudansu", false, (s) => s);
    case "RS-442":
      return ncResult(state, playerId, card, "supanishudansu", false, (s) => s);
    case "RS-443":
      return ncResult(state, playerId, card, "kanfudansu", false, (s) => openKungFuDance(s, playerId, card));
    case "RS-444":
      return ncResult(state, playerId, card, "toropikarudansu", false, (s) => openTropicalDance(s, playerId, card));
    case "RS-447":
      return ncResult(state, playerId, card, "noe_e5bf8d", true, (s) => openNinjutsuPrep(s, playerId, card));
    case "RS-448":
      return ncResult(state, playerId, card, "ierobiguboru", false, (s) => openYellowBigBall(s, playerId, card));
    case "RS-449":
      return ncResult(state, playerId, card, "masukirota", true, (s) => openMaskyRotor(s, playerId, card));
    case "RS-452":
      // 【テトラバスター】は「同カテゴリのLユニットからコンビネーションするとき」（trySet7AOnEnterBattle）。
      return { state, logs: [] };
    default:
      return null;
  }
}

function ncResult(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
  sp1: boolean,
  open: (state: GameState) => GameState,
): ComboOutcome {
  const established = establishNc(state, playerId, card, effectId, sp1);
  return { state: open(established), logs: [ncLog(state, playerId, card.cardId, effectId)] };
}

// ---------------------------------------------------------------------------
// RS-447 ダイナブラック【忍術の備え】
// 「「SP1」 自軍捨札からカテゴリにMAを持つオペレーションカードを1枚選び手札に加えてもよい。」（atwiki/page-786）

export const NINJUTSU_PREP_EFFECT_ID = "rs447_ninjutsu_prep";

function openNinjutsuPrep(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ids = state.players[playerId].discard
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "operation" && categoriesOf(state, c.cardId).includes("MA"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: NINJUTSU_PREP_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function moveDiscardToHand(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, strip(card)] };
  });
}

CHOICE_RESOLVERS[NINJUTSU_PREP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = moveDiscardToHand(state, playerId, instanceId);
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-447", `${NINJUTSU_PREP_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[NINJUTSU_PREP_EFFECT_ID] = simpleSkip("RS-447");

// ---------------------------------------------------------------------------
// RS-448 ダイナイエロー【イエロービッグボール】
// 「自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（置けなければこの効果は発動できない）。
//  そうしたとき、置いたカードの必要パワーの数字と同じ数字を持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-787）

export const YELLOW_BIG_BALL_EFFECT_ID = "rs448_yellow_big_ball";
export const YELLOW_BIG_BALL_DESTROY_EFFECT_ID = "rs448_yellow_big_ball_destroy";

function openYellowBigBall(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const player = state.players[playerId];
  const top = player.deck[0];
  // 置けなければ（コマンドゾーンが5枚・山札がない）発動できない（R-ZONE-08）。
  if (!top || player.command.length >= COMMAND_ZONE_MAX) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: YELLOW_BIG_BALL_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "confirm",
    mayConfirm: true,
    phasePlayerId: playerId,
    validInstanceIds: [top.instanceId],
    selectedInstanceIds: [],
    optional: true,
  });
}

function placeTopAsHeldCommand(state: GameState, pending: PendingEffectChoice): ChoiceOutcome {
  const playerId = pending.playerId;
  const player = state.players[playerId];
  const top = player.deck[0];
  if (!top || player.command.length >= COMMAND_ZONE_MAX) return { state: finish(state, pending) };
  const placed = patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: p.deck.slice(1),
    command: [...p.command, { ...strip(top), commandHeld: true }],
  }));
  const number = parsePowerCost(getDefinition(state.definitions, top.cardId)?.powerCost);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(placed, enemyId)
    .filter((c) => parsePowerCost(getDefinition(placed.definitions, c.cardId)?.powerCost) === number)
    .filter((c) => isSelectableByOpponentEffect(placed, playerId, c.instanceId, "RS-448"))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RS-448", `${YELLOW_BIG_BALL_EFFECT_ID}:${cardName(state.definitions, top.cardId)}`);
  if (ids.length === 0) return { state: finish(placed, pending), log };
  return {
    state: reopen(placed, pending, {
      playerId,
      effectId: YELLOW_BIG_BALL_DESTROY_EFFECT_ID,
      sourceCardId: "RS-448",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    log,
  };
}

CHOICE_RESOLVERS[YELLOW_BIG_BALL_EFFECT_ID] = (state) => placeTopAsHeldCommand(state, state.pendingEffectChoice!);
CHOICE_CONFIRMERS[YELLOW_BIG_BALL_EFFECT_ID] = (state) => placeTopAsHeldCommand(state, state.pendingEffectChoice!);
CHOICE_SKIPPERS[YELLOW_BIG_BALL_EFFECT_ID] = simpleSkip("RS-448");

CHOICE_RESOLVERS[YELLOW_BIG_BALL_DESTROY_EFFECT_ID] = (state, playerId, instanceId) =>
  destroyChosen(state, playerId, instanceId, "RS-448");

/** 選んだユニットを撃破する（離場の処理を通す）。 */
function destroyChosen(state: GameState, playerId: PlayerId, instanceId: string, cardId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  const log = logFor(state, playerId, cardId, `${pending.effectId}:${cardName(state.definitions, found.card.cardId)}`);
  return { state: finish(leave.state, { ...pending }), log };
}

// ---------------------------------------------------------------------------
// RS-449 イエローマスク【マスキーローター】
// 「「SP1」常駐しているオペレーションを1枚選んでもよい。そうしたとき、選んだオペレーションの上に重ねたカードがあれば、
//  重ねたカードをすべて持ち主の山札に戻してシャッフルする。」（atwiki/page-797）

export const MASKY_ROTOR_EFFECT_ID = "rs449_masky_rotor";

function openMaskyRotor(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ids = (["player1", "player2"] as const).flatMap((pid) => state.players[pid].operation.map((c) => c.instanceId));
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: MASKY_ROTOR_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[MASKY_ROTOR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = (["player1", "player2"] as const).find((pid) =>
    state.players[pid].operation.some((c) => c.instanceId === instanceId),
  );
  if (!ownerId) return { error: "invalid_target" };
  const op = state.players[ownerId].operation.find((c) => c.instanceId === instanceId)!;
  const stacked = op.stackedCards ?? [];
  const next =
    stacked.length === 0
      ? state
      : patchPlayer(state, ownerId, (p) => ({
          ...p,
          operation: p.operation.map((c) => {
            if (c.instanceId !== instanceId) return c;
            const { stackedCards: _s, ...rest } = c;
            return rest as CardInstance;
          }),
          deck: shuffleCards([...p.deck, ...stacked.map(strip)]),
        }));
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, "RS-449", `${MASKY_ROTOR_EFFECT_ID}:${cardName(state.definitions, op.cardId)}:${stacked.length}`),
  };
};
CHOICE_SKIPPERS[MASKY_ROTOR_EFFECT_ID] = simpleSkip("RS-449");

// ---------------------------------------------------------------------------
// RS-443 バトルジャパン【カンフーダンス】
// 「自軍ラッシュエリアのSユニットを2体まで選び、自軍コマンドゾーンにリリース状態で置いてもよい。
//  (コマンドゾーンに置けるカードは通常5枚まで)」（atwiki/page-754）

export const KUNG_FU_DANCE_EFFECT_ID = "rs443_kung_fu_dance";

function kungFuTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].rush
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

function openKungFuDance(state: GameState, playerId: PlayerId, card: CardInstance, remaining = 2, base?: PendingEffectChoice): GameState {
  const room = COMMAND_ZONE_MAX - state.players[playerId].command.length;
  const ids = kungFuTargets(state, playerId);
  if (remaining <= 0 || room <= 0 || ids.length === 0) return state;
  const choice: PendingEffectChoice = {
    playerId,
    effectId: KUNG_FU_DANCE_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: base?.phasePlayerId ?? playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    set7aMeta: { remaining },
  };
  return base ? reopen(state, base, choice) : openEffectChoice(state, choice);
}

CHOICE_RESOLVERS[KUNG_FU_DANCE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
  if (!card || state.players[playerId].command.length >= COMMAND_ZONE_MAX) return { error: "invalid_target" };
  const moved = patchPlayer(state, playerId, (p) => ({
    ...p,
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    command: [...p.command, { ...strip(card), commandHeld: false }],
  }));
  const log = logFor(state, playerId, "RS-443", `${KUNG_FU_DANCE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const remaining = (pending.set7aMeta?.remaining ?? 1) - 1;
  const source = { instanceId: pending.sourceInstanceId ?? "", cardId: pending.sourceCardId };
  const reopened = openKungFuDance(moved, playerId, source, remaining, pending);
  if (reopened !== moved) return { state: reopened, log };
  return { state: finish(moved, pending), log };
};
CHOICE_SKIPPERS[KUNG_FU_DANCE_EFFECT_ID] = simpleSkip("RS-443");

// ---------------------------------------------------------------------------
// RS-444 バトルケニア【トロピカルダンス】
// 「特徴「獣」を持つ自軍ユニットを3体まで選び、ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、
//  再びバトルエリアに出ることはできない。」（atwiki/page-783）

export const TROPICAL_DANCE_EFFECT_ID = "rs444_tropical_dance";

function openTropicalDance(state: GameState, playerId: PlayerId, card: CardInstance, remaining = 3, base?: PendingEffectChoice): GameState {
  const ids = state.players[playerId].battle
    .filter((c) => hasFeature(state, playerId, c, "獣"))
    .map((c) => c.instanceId);
  if (remaining <= 0 || ids.length === 0) return state;
  const choice: PendingEffectChoice = {
    playerId,
    effectId: TROPICAL_DANCE_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: base?.phasePlayerId ?? playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    set7aMeta: { remaining, queue: base?.set7aMeta?.queue ?? [] },
  };
  return base ? reopen(state, base, choice) : openEffectChoice(state, choice);
}

CHOICE_RESOLVERS[TROPICAL_DANCE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let moved = patchPlayer(state, playerId, (p) =>
    markBattleBlocked(
      { ...p, battle: p.battle.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, card] },
      instanceId,
    ),
  );
  const returned = [...(pending.set7aMeta?.queue ?? []), instanceId];
  moved = { ...moved, pendingEffectChoice: { ...pending, set7aMeta: { ...pending.set7aMeta, queue: returned } } };
  const log = logFor(state, playerId, "RS-444", `${TROPICAL_DANCE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const remaining = (pending.set7aMeta?.remaining ?? 1) - 1;
  const source = { instanceId: pending.sourceInstanceId ?? "", cardId: pending.sourceCardId };
  const withQueue = moved.pendingEffectChoice!;
  const reopened = openTropicalDance(moved, playerId, source, remaining, withQueue);
  if (reopened !== moved) return { state: reopened, log };
  return { state: finishTropicalDance(moved, withQueue), log };
};

/** 選び終えたら、戻したユニットの「ラッシュエリアに戻るたび」（RS-441【コサックダンス】）を処理する。 */
function finishTropicalDance(state: GameState, pending: PendingEffectChoice): GameState {
  const returned = pending.set7aMeta?.queue ?? [];
  const finished = finish(state, pending);
  return afterUnitsReturnedToRush(finished, pending.playerId, returned, pending.phasePlayerId);
}

CHOICE_SKIPPERS[TROPICAL_DANCE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finishTropicalDance(state, pending), log: skipLog(state, playerId, "RS-444", pending.effectId) };
};

// ---------------------------------------------------------------------------
// RS-441 バトルコサック【コサックダンス】
// 「このターン、自軍ユニットがバトルエリアからラッシュエリアに戻るたび、そのユニットを自分の手札に戻してもよい。
//  そうしたとき、自軍コマンドを1つホールドして、手札に戻したユニットカードと同じカード名のユニットカードを
//  自分の手札から1枚選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-782・faq-card-7 RS-441 Q）

export const COSSACK_RETURN_EFFECT_ID = "rs441_cossack_return";
export const COSSACK_DEPLOY_EFFECT_ID = "rs441_cossack_deploy";

/**
 * 自軍ユニットがバトルエリアからラッシュエリアに戻ったあとの誘発（RS-441【コサックダンス】）。
 * 選択が開いていればその後に処理する（戻ったユニットの順に1体ずつ）。
 */
export function afterUnitsReturnedToRush(
  state: GameState,
  playerId: PlayerId,
  returnedInstanceIds: string[],
  phasePlayerId: PlayerId,
): GameState {
  if (returnedInstanceIds.length === 0) return state;
  if (!ncEstablishedThisTurn(state, playerId, "kosakudansu")) return state;
  if (state.activePlayer !== playerId && phasePlayerId !== playerId) return state;
  const queue = returnedInstanceIds.filter((id) => state.players[playerId].rush.some((c) => c.instanceId === id));
  if (queue.length === 0) return state;
  const choice = cossackReturnChoice(state, playerId, queue, phasePlayerId);
  if (!choice) return state;
  if (state.pendingEffectChoice) {
    // 開いている選択の後に処理する。
    return { ...state, pendingEffectChoice: { ...state.pendingEffectChoice, resumeChoice: choice } };
  }
  return openEffectChoice(state, choice);
}

function cossackReturnChoice(
  state: GameState,
  playerId: PlayerId,
  queue: string[],
  phasePlayerId: PlayerId,
): PendingEffectChoice | undefined {
  const [first, ...rest] = queue.filter((id) => state.players[playerId].rush.some((c) => c.instanceId === id));
  if (!first) return undefined;
  const source = getPlayerModifiers(state.players[playerId]).find(
    (m) => m.kind === "rule" && m.ruleId === `${NC_ESTABLISHED_RULE}:kosakudansu`,
  );
  return {
    playerId,
    effectId: COSSACK_RETURN_EFFECT_ID,
    sourceCardId: "RS-441",
    sourceInstanceId: (source?.kind === "rule" ? (source.payload as { instanceId?: string })?.instanceId : undefined),
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: [first],
    selectCount: 1,
    optional: true,
    set7aMeta: { queue: rest },
  };
}

function continueCossackQueue(state: GameState, pending: PendingEffectChoice): GameState {
  const queue = pending.set7aMeta?.queue ?? [];
  const next = queue.length > 0 ? cossackReturnChoice(state, pending.playerId, queue, pending.phasePlayerId) : undefined;
  if (next) return reopen(state, pending, next);
  return finish(state, pending);
}

CHOICE_RESOLVERS[COSSACK_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
  if (!card) return { state: continueCossackQueue(state, pending) };
  const returned = patchPlayer(state, playerId, (p) => ({
    ...p,
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, strip(card)],
  }));
  const log = logFor(state, playerId, "RS-441", `${COSSACK_RETURN_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const player = returned.players[playerId];
  const name = cardName(state.definitions, card.cardId);
  const ids = player.hand
    .filter((c) => getDefinition(returned.definitions, c.cardId)?.type === "unit" && cardName(returned.definitions, c.cardId) === name)
    .map((c) => c.instanceId);
  const canHold = player.command.some((c) => !c.commandHeld);
  if (!canHold || ids.length === 0) return { state: continueCossackQueue(returned, pending), log };
  return {
    state: reopen(returned, pending, {
      playerId,
      effectId: COSSACK_DEPLOY_EFFECT_ID,
      sourceCardId: "RS-441",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      set7aMeta: { queue: pending.set7aMeta?.queue ?? [] },
    }),
    log,
  };
};
CHOICE_SKIPPERS[COSSACK_RETURN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: continueCossackQueue(state, pending), log: skipLog(state, playerId, "RS-441", pending.effectId) };
};

CHOICE_RESOLVERS[COSSACK_DEPLOY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === instanceId);
  const released = player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (!card || released.length === 0) return { error: "invalid_target" };
  if (released.length === 1) return deployCossack(state, playerId, pending, instanceId, released[0]!);
  // ホールドする自軍コマンドを選ぶ（コマンドの支払い effect_hold。選び終えたら tryCompleteSet7AHoldChoice）。
  const opened = reopen(state, pending, {
    playerId,
    effectId: COSSACK_HOLD_EFFECT_ID,
    sourceCardId: "RS-441",
    sourceInstanceId: pending.sourceInstanceId,
    kind: "select_command",
    phasePlayerId: pending.phasePlayerId,
    validInstanceIds: released,
    selectCount: 1,
    selectedInstanceIds: [],
    optional: false,
    commandAction: "hold",
    commandFilter: "released",
    set7aMeta: { queue: pending.set7aMeta?.queue ?? [], handInstanceId: instanceId },
  });
  const payment = buildEffectHoldPayment(opened);
  return { state: payment ? { ...opened, pendingCommandPayment: payment } : opened };
};

export const COSSACK_HOLD_EFFECT_ID = "rs441_cossack_hold";

/** 自軍コマンドを1つ（holdId）ホールドして、選んだユニットカード（handId）を自軍ラッシュエリアに出す（効果で出す。R-RUSH-22）。 */
function deployCossack(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, handId: string, holdId: string): ChoiceOutcome {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === handId);
  const hold = player.command.find((c) => c.instanceId === holdId);
  if (!card || !hold) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === holdId ? { ...c, commandHeld: true } : c)),
    hand: p.hand.filter((c) => c.instanceId !== handId),
    rush: [...p.rush, strip(card)],
  }));
  const queue = pending.set7aMeta?.queue ?? [];
  const cleared: GameState = { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = finalizeEffectRush(cleared, playerId, [handId], pending.phasePlayerId).state;
  const log = logFor(state, playerId, "RS-441", `${COSSACK_DEPLOY_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const follow = queue.length > 0 ? cossackReturnChoice(next, playerId, queue, pending.phasePlayerId) : undefined;
  if (follow) {
    if (next.pendingEffectChoice) {
      return { state: { ...next, pendingEffectChoice: { ...next.pendingEffectChoice, resumeChoice: follow } }, log };
    }
    return { state: openEffectChoice(next, { ...follow, resumeChoice: pending.resumeChoice }), log };
  }
  if (next.pendingEffectChoice) return { state: next, log };
  return { state: finish(next, { ...pending, resumeChoice: pending.resumeChoice }), log };
}
CHOICE_SKIPPERS[COSSACK_DEPLOY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: continueCossackQueue(state, pending), log: skipLog(state, playerId, "RS-441", pending.effectId) };
};

// ---------------------------------------------------------------------------
// RS-442 バトルフランス【スパニッシュダンス】
// 「このターン、これは、特徴「女」を持つユニット1体につきBP+1000される。また、これがBP5000以上のとき、
//  これの次に並ぶ特徴「女」を持つ自軍SユニットはSP1になる。」（atwiki/page-751）

function spanishDanceActive(card: CardInstance): boolean {
  return card.cardId === "RS-442" && (card.activatedNcEffects ?? []).includes("supanishudansu");
}

function femaleUnitCount(state: GameState): number {
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    count += fieldUnits(state, pid).filter((c) => hasFeature(state, pid, c, "女")).length;
  }
  return count;
}

/** 効果による BP の継続修正（rules/fieldAuras.ts から呼ぶ）。 */
export function set7AFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  switch (instance.cardId) {
    case "RS-442":
      return spanishDanceActive(instance) ? 1000 * femaleUnitCount(state) : 0;
    case "RS-440":
      return battleFeverLrBonus(state, playerId, instance);
    default:
      return 0;
  }
}

/** 「SP1」になる継続効果（rules/legend3/fieldEffects.ts から呼ぶ）。 */
export function set7AEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (sp >= 1) return sp;
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === instance.instanceId);
  if (index <= 0) return sp;
  const prev = battle[index - 1]!;
  if (
    spanishDanceActive(prev) &&
    isSmallUnit(state.definitions, instance.cardId) &&
    hasFeature(state, playerId, instance, "女") &&
    effectiveBp(state, playerId, prev) >= 5000
  ) {
    return 1;
  }
  return sp;
}

// ---------------------------------------------------------------------------
// RS-440 バトルフィーバーロボ（2nd）※「これはナンバーに「L」または「R」を持つ自軍ユニット1体につきBP+1000される。」

function hasLrNumber(state: GameState, cardId: string): boolean {
  const n = getDefinition(state.definitions, cardId)?.comboNumber as unknown;
  return n === "L" || n === "R";
}

function battleFeverLrBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (!fieldUnits(state, playerId).some((c) => c.instanceId === instance.instanceId)) return 0;
  return 1000 * fieldUnits(state, playerId).filter((c) => hasLrNumber(state, c.cardId)).length;
}

// ---------------------------------------------------------------------------
// バトルエリアに出たとき（rules/combo.ts）

export const TETRA_BUSTER_EFFECT_ID = "rs452_tetra_buster";
export const TETRA_BOY_RETURN_EFFECT_ID = "rs452_tetra_boy_return";

/**
 * - RS-452 テトラボーイ【テトラバスター】: 同カテゴリの L ユニットからコンビネーションするとき（R ナンバー）。
 * - RS-452 テトラボーイ ※: 自軍バトルエリアにある間、BP6000 以上の敵軍ユニットがバトルエリアに出たとき。
 */
export function trySet7AOnEnterBattle(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (state.pendingEffectChoice) return state;
  if (card.cardId === "RS-452") {
    const buster = openTetraBuster(state, playerId, card, battleBeforeEnter);
    if (buster !== state) return buster;
  }
  return openTetraBoyReturn(state, playerId, card);
}

function openTetraBuster(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const from = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!from) return state;
  const fromDef = getDefinition(state.definitions, from.cardId);
  if (fromDef?.type !== "unit" || fromDef.size !== "L") return state;
  const own = categoriesOf(state, card.cardId);
  if (!categoriesOf(state, from.cardId).some((c) => own.includes(c))) return state;
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "L") return false;
      return !(def.rushAdditionalCondition?.text ?? "").includes("自軍合体ユニットを捨札にする");
    })
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId, card.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: TETRA_BUSTER_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[TETRA_BUSTER_EFFECT_ID] = (state, playerId, instanceId) => destroyChosen(state, playerId, instanceId, "RS-452");
CHOICE_SKIPPERS[TETRA_BUSTER_EFFECT_ID] = simpleSkip("RS-452");

function openTetraBoyReturn(state: GameState, enteringPlayerId: PlayerId, entered: CardInstance): GameState {
  const ownerId = opponent(enteringPlayerId);
  const boys = state.players[ownerId].battle.filter((c) => c.cardId === "RS-452");
  if (boys.length === 0) return state;
  if (!state.players[enteringPlayerId].battle.some((c) => c.instanceId === entered.instanceId)) return state;
  if (effectiveBp(state, enteringPlayerId, entered) < 6000) return state;
  return openEffectChoice(state, {
    playerId: ownerId,
    effectId: TETRA_BOY_RETURN_EFFECT_ID,
    sourceCardId: "RS-452",
    sourceInstanceId: boys[0]!.instanceId,
    kind: "select_unit",
    phasePlayerId: enteringPlayerId,
    validInstanceIds: boys.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[TETRA_BOY_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, card],
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-452", `${TETRA_BOY_RETURN_EFFECT_ID}:return`) };
};
CHOICE_SKIPPERS[TETRA_BOY_RETURN_EFFECT_ID] = simpleSkip("RS-452");

// ---------------------------------------------------------------------------
// RS-450 地帝忍オヨブー【皇帝への忠義】
// 「これが敵軍ユニットとバトルして、お互いに撃破されて捨札になったとき、自軍エリアに特徴「皇帝」を持つユニットがあれば、
//  これとバトルした敵軍ユニットのカードを、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-821）

export const LOYALTY_TO_EMPEROR_EFFECT_ID = "rs450_loyalty_to_emperor";

export function openLoyaltyToEmperor(
  state: GameState,
  ctx: { attackerPlayerId: PlayerId; attackerInstanceId: string; attackerCardId: string; defenderOwner: PlayerId; defenderCard: CardInstance },
): GameState {
  let ownId: PlayerId;
  let selfId: string;
  let enemyOwner: PlayerId;
  let enemyId: string;
  if (ctx.attackerCardId === "RS-450") {
    [ownId, selfId, enemyOwner, enemyId] = [ctx.attackerPlayerId, ctx.attackerInstanceId, ctx.defenderOwner, ctx.defenderCard.instanceId];
  } else if (ctx.defenderCard.cardId === "RS-450") {
    [ownId, selfId, enemyOwner, enemyId] = [ctx.defenderOwner, ctx.defenderCard.instanceId, ctx.attackerPlayerId, ctx.attackerInstanceId];
  } else {
    return state;
  }
  if (ownId === enemyOwner) return state;
  const inDiscard = (pid: PlayerId, id: string) => state.players[pid].discard.some((c) => c.instanceId === id);
  if (!inDiscard(ownId, selfId) || !inDiscard(enemyOwner, enemyId)) return state;
  if (!fieldUnits(state, ownId).some((c) => hasFeature(state, ownId, c, "皇帝"))) return state;
  const choice: PendingEffectChoice = {
    playerId: ownId,
    effectId: LOYALTY_TO_EMPEROR_EFFECT_ID,
    sourceCardId: "RS-450",
    sourceInstanceId: selfId,
    kind: "select_unit",
    phasePlayerId: state.pendingEffectChoice?.phasePlayerId ?? state.activePlayer,
    validInstanceIds: [enemyId],
    selectCount: 1,
    optional: true,
    set7aMeta: { enemyInstanceId: enemyId },
  };
  if (state.pendingEffectChoice) {
    return { ...state, pendingEffectChoice: { ...state.pendingEffectChoice, resumeChoice: state.pendingEffectChoice.resumeChoice ?? choice } };
  }
  return openEffectChoice(state, choice);
}

CHOICE_RESOLVERS[LOYALTY_TO_EMPEROR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyOwner = opponent(playerId);
  const card = state.players[enemyOwner].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { state: finish(state, pending) };
  const next = patchPlayer(state, enemyOwner, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    power: [...p.power, { ...strip(card), faceDown: true }],
    damage: p.damage + 1,
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-450", `${LOYALTY_TO_EMPEROR_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[LOYALTY_TO_EMPEROR_EFFECT_ID] = simpleSkip("RS-450");

// ---------------------------------------------------------------------------
// RS-439 バトルシャーク【万能戦艦】
// 「これをラッシュしたとき、次の効果を発動できる⇒自軍山札から、Lユニットのカードを1枚か、ナンバーに「L」または「R」を持つ
//  ユニットカードを2枚まで選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。」（atwiki/page-781）
// 山札にある間は印刷どおりのサイズで判定する（ガンマジンは S ユニットのカード。atwiki/page-781 Q1）。

export const ALL_PURPOSE_SHIP_EFFECT_ID = "rs439_all_purpose_battleship";

function isLargeUnitCard(state: GameState, cardId: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  return def?.type === "unit" && def.size === "L";
}

function isLrNumberUnitCard(state: GameState, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit" && hasLrNumber(state, cardId);
}

function openAllPurposeShip(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const playerId = ctx.playerId;
  const ids = state.players[playerId].deck
    .filter((c) => isLargeUnitCard(state, c.cardId) || isLrNumberUnitCard(state, c.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${ALL_PURPOSE_SHIP_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId,
      effectId: ALL_PURPOSE_SHIP_EFFECT_ID,
      sourceCardId: "RS-439",
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      viewedInstanceIds: ids,
      selectCount: 1,
      optional: true,
      set7aMeta: { remaining: 2 },
    }),
    detail: ALL_PURPOSE_SHIP_EFFECT_ID,
  };
}

function shuffleDeck(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
}

CHOICE_RESOLVERS[ALL_PURPOSE_SHIP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const first = (pending.selectedInstanceIds ?? []).length === 0;
  const takenAsL = first && isLargeUnitCard(state, card.cardId) && !isLrNumberUnitCard(state, card.cardId);
  const moved = patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: p.deck.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, strip(card)],
  }));
  const log = logFor(state, playerId, "RS-439", `${ALL_PURPOSE_SHIP_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const remaining = (pending.set7aMeta?.remaining ?? 1) - 1;
  // 「Lユニットのカードを1枚か」— L ユニットのカードを選んだら1枚だけ。L／R ナンバーのカードなら2枚まで。
  const more = takenAsL
    ? []
    : moved.players[playerId].deck.filter((c) => isLrNumberUnitCard(moved, c.cardId)).map((c) => c.instanceId);
  if (remaining > 0 && more.length > 0) {
    return {
      state: {
        ...moved,
        pendingEffectChoice: {
          ...pending,
          validInstanceIds: more,
          viewedInstanceIds: more,
          selectedInstanceIds: [...(pending.selectedInstanceIds ?? []), instanceId],
          set7aMeta: { remaining },
        },
      },
      log,
    };
  }
  return { state: finish(shuffleDeck(moved, playerId), pending), log };
};
CHOICE_SKIPPERS[ALL_PURPOSE_SHIP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  // 1枚選んだあとの見送りは「その後、山札をシャッフルする」まで行う。
  const picked = (pending.selectedInstanceIds ?? []).length > 0;
  const next = picked ? shuffleDeck(state, playerId) : state;
  return { state: finish(next, pending), log: skipLog(state, playerId, "RS-439", pending.effectId) };
};

// ---------------------------------------------------------------------------
// RS-440 バトルフィーバーロボ（2nd）【武器換装】
// 「これが自軍バトルエリアにある間、自軍バトルフェイズ中、自軍コマンドを3つホールドしてもよい。そうしたとき、
//  これをラッシュエリアに戻す。」（atwiki/page-780）— 起動効果（rules/fieldActivatedAbilities.ts）。文言で判定する。
// 戻した後にコマンドがリリースされれば、再び出して使える（faq-card-7 RS-440 Q）。

const HOLD_RETURN_SELF_RE = /これが自軍バトルエリアにある間、自軍バトルフェイズ中、自軍コマンドを(\d+)つホールドしてもよい。そうしたとき、これをラッシュエリアに戻す/;

/** 「自軍コマンドをNつホールドしてもよい。そうしたとき、これをラッシュエリアに戻す」の N（なければ 0）。 */
export function holdReturnSelfCount(cardId: string, definitions?: GameState["definitions"]): number {
  const text = (definitions?.[cardId]?.text ?? getDslCardText(cardId) ?? "").normalize("NFKC");
  const m = text.match(HOLD_RETURN_SELF_RE);
  return m ? Number(m[1]) : 0;
}

export function canActivateHoldReturnSelf(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const n = holdReturnSelfCount(card.cardId, state.definitions);
  if (n <= 0) return false;
  if (!state.players[playerId].battle.some((c) => c.instanceId === card.instanceId)) return false;
  return state.players[playerId].command.filter((c) => !c.commandHeld).length >= n;
}

export const WEAPON_CHANGE_HOLD_EFFECT_ID = "rs440_weapon_change_hold";

/**
 * 【武器換装】を起動する。リリース状態の自軍コマンドが N より多ければ、ホールドする N つをプレイヤーが選ぶ
 * （コマンドの支払い。rules/commandPayment.ts effect_hold）。ちょうど N つなら選ぶ余地がないのでそれをホールドする。
 */
export function activateHoldReturnSelf(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const n = holdReturnSelfCount(card.cardId, state.definitions);
  const released = state.players[playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (released.length > n) {
    const opened = openEffectChoice(state, {
      playerId,
      effectId: WEAPON_CHANGE_HOLD_EFFECT_ID,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      kind: "select_commands",
      phasePlayerId: playerId,
      validInstanceIds: released,
      selectCount: n,
      selectedInstanceIds: [],
      optional: true,
      commandAction: "hold",
      commandFilter: "released",
    });
    const payment = buildEffectHoldPayment(opened);
    return payment ? { ...opened, pendingCommandPayment: payment } : opened;
  }
  return completeHoldReturnSelf(state, playerId, card.instanceId, released.slice(0, n));
}

/** 選んだ自軍コマンドをホールドし（支払いで既にホールドしていればそのまま）、これをラッシュエリアに戻す。 */
function completeHoldReturnSelf(state: GameState, playerId: PlayerId, instanceId: string, holdIds: string[]): GameState {
  const card = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (holdIds.includes(c.instanceId) && !c.commandHeld ? { ...c, commandHeld: true } : c)),
    ...(card ? { battle: p.battle.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, card] } : {}),
  }));
  if (!card) return next;
  if (next.pendingBattleEntry?.instanceId === card.instanceId) next = { ...next, pendingBattleEntry: undefined };
  next = {
    ...next,
    log: [...next.log, buildLogEntry(playerId, "named_effect", card.cardId, state.definitions, "hold_commands_return_self")],
  };
  return afterUnitsReturnedToRush(next, playerId, [card.instanceId], playerId);
}

CHOICE_SKIPPERS[WEAPON_CHANGE_HOLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
};

/**
 * 自軍コマンドをホールドする選択（コマンドの支払い effect_hold）を終えたあとの続き（rules/pendingChoices.ts
 * completeEffectHoldChoice から呼ぶ）。このモジュールの選択でなければ null。
 */
export function tryCompleteSet7AHoldChoice(
  state: GameState,
  playerId: PlayerId,
  commandInstanceIds: string[],
): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (pending.effectId === WEAPON_CHANGE_HOLD_EFFECT_ID) {
    const closed: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
    const next = completeHoldReturnSelf(closed, playerId, pending.sourceInstanceId ?? "", commandInstanceIds);
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }
  if (pending.effectId === COSSACK_HOLD_EFFECT_ID) {
    const handId = pending.set7aMeta?.handInstanceId;
    if (!handId) return { error: "invalid_choice" };
    return deployCossack(state, playerId, pending, handId, commandInstanceIds[0]!);
  }
  return null;
}

function getDslCardText(cardId: string): string | undefined {
  return resolvePlayableCard(cardId)?.text;
}

// ---------------------------------------------------------------------------
// RS-438 炎神ソウル
// 「このカードを自軍パワーゾーンに置く。その後、自軍パワーゾーンのオモテ向きのカードからユニットカードを1枚選び、
//  手札に加えてもよい。」（atwiki/page-755）

export const ENGINE_SOUL_EFFECT_ID = "rs438_engine_soul";

const POWER_UNIT_TO_HAND_RE = /このカードを自軍パワーゾーンに置く。その後、自軍パワーゾーンのオモテ向きのカードからユニットカードを1枚選び、手札に加えてもよい/;

/**
 * 「このカードを自軍パワーゾーンに置く。その後、自軍パワーゾーンのオモテ向きのカードからユニットカードを1枚選び、
 * 手札に加えてもよい。」— パワーゾーンに置いたあとの選択（core/applyAction.ts の place_in_power から呼ぶ）。文言で判定する。
 */
export function openPowerUnitToHandAfterPlace(state: GameState, playerId: PlayerId, operation: CardInstance): GameState {
  const text = (getDefinition(state.definitions, operation.cardId)?.text ?? "").normalize("NFKC").replace(/\s+/g, "");
  if (!POWER_UNIT_TO_HAND_RE.test(text)) return state;
  const ids = state.players[playerId].power
    .filter((c) => !c.faceDown && getDefinition(state.definitions, c.cardId)?.type === "unit")
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: ENGINE_SOUL_EFFECT_ID,
    sourceCardId: operation.cardId,
    sourceInstanceId: operation.instanceId,
    kind: "select_power",
    phasePlayerId: state.activePlayer,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[ENGINE_SOUL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, strip(card)],
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-438", `${ENGINE_SOUL_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[ENGINE_SOUL_EFFECT_ID] = simpleSkip("RS-438");

// ---------------------------------------------------------------------------
// RS-432 隠流マキビシ（※カウンター）
// 「ストライクされたとき発動できる⇒相手がバトルフェイズを終えるとき、そのバトルフェイズ中に自分の受けたダメージが
//  2点以上なら、敵軍バトルエリアのSユニットをすべて撃破する。」（atwiki/page-736・R-CTR-01）
// 発動したことをこのターンの間記録し、相手がバトルフェイズを終えるとき（core/createGame.ts advancePhase）に判定する。

const MAKIBISHI_TEXT_RE = /ストライクされたとき発動できる⇒相手がバトルフェイズを終えるとき、そのバトルフェイズ中に自分の受けたダメージが(\d+)点以上なら、敵軍バトルエリアのSユニットをすべて撃破する/;
export const MAKIBISHI_RULE = "rs432_makibishi";

function cardTextOf(state: GameState, cardId: string): string {
  return (getDefinition(state.definitions, cardId)?.text ?? resolvePlayableCard(cardId)?.text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "");
}

function makibishiThreshold(state: GameState, cardId: string): number | null {
  const m = cardTextOf(state, cardId).match(MAKIBISHI_TEXT_RE);
  return m ? Number(m[1]) : null;
}

function receivedDamage(state: GameState, playerId: PlayerId): number {
  const p = state.players[playerId];
  return Math.max(p.damage, p.power.filter((c) => c.faceDown).length);
}

/** ストライクの反応窓で使える set-7 のカウンター（手札）。 */
export function set7AStrikeCounterIds(
  state: GameState,
  defenderId: PlayerId,
  pending: PendingStrike,
  canPlay: (state: GameState, playerId: PlayerId, instanceId: string) => boolean,
): string[] {
  // ※カウンター — 敵軍ターン中のみ。
  if (pending.battlePhasePlayer === defenderId) return [];
  return state.players[defenderId].hand
    .filter((c) => makibishiThreshold(state, c.cardId) !== null && canPlay(state, defenderId, c.instanceId))
    .map((c) => c.instanceId);
}

/** カウンターを使う（捨札にし、相手がバトルフェイズを終えるときの判定を予約する）。 */
export function applySet7AStrikeCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
): { state: GameState; log: string } {
  const card = state.players[defenderId].hand.find((c) => c.instanceId === counterInstanceId);
  if (!card) return { state, log: buildLogEntry(defenderId, "play_counter", "unknown", state.definitions, "none") };
  const threshold = makibishiThreshold(state, card.cardId) ?? 2;
  const base = state.players[defenderId].damageAtBattlePhaseStart ?? receivedDamage(state, defenderId);
  const next = patchPlayer(state, defenderId, (p) => ({
    ...addRuleModifierAlways(p, MAKIBISHI_RULE, card.cardId, { threshold, base }),
    hand: p.hand.filter((c) => c.instanceId !== counterInstanceId),
    discard: [...p.discard, strip(card)],
  }));
  return { state: next, log: buildLogEntry(defenderId, "play_counter", card.cardId, state.definitions, MAKIBISHI_RULE) };
}

function addRuleModifierAlways(p: PlayerState, ruleId: string, sourceCardId: string, payload: unknown): PlayerState {
  return {
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  };
}

/**
 * 相手（endingPlayerId）がバトルフェイズを終えるとき（core/createGame.ts advancePhase から呼ぶ）。
 * 隠流マキビシを使っていれば、そのバトルフェイズ中に受けたダメージを判定して敵軍バトルエリアの S ユニットをすべて撃破する。
 */
export function applySet7ABattlePhaseEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  const defenderId = opponent(endingPlayerId);
  const entries = getPlayerModifiers(state.players[defenderId]).filter(
    (m) => m.kind === "rule" && m.ruleId === MAKIBISHI_RULE,
  );
  if (entries.length === 0) return state;
  let next = patchPlayer(state, defenderId, (p) => ({
    ...p,
    modifiers: getPlayerModifiers(p).filter((m) => !(m.kind === "rule" && m.ruleId === MAKIBISHI_RULE)),
  }));
  const received = receivedDamage(next, defenderId);
  const fires = entries.some((m) => {
    const payload = (m.kind === "rule" ? m.payload : undefined) as { threshold?: number; base?: number } | undefined;
    return received - (payload?.base ?? 0) >= (payload?.threshold ?? 2);
  });
  if (!fires) return next;
  const targets = next.players[endingPlayerId].battle
    .filter((c) => isSmallUnit(next.definitions, c.cardId))
    .map((c) => c.instanceId);
  for (const id of targets) {
    if (!next.players[endingPlayerId].battle.some((c) => c.instanceId === id)) continue;
    const leave = applyUnitLeave(next, id, "discard", endingPlayerId);
    if ("error" in leave) continue;
    next = leave.state;
  }
  return {
    ...next,
    log: [...next.log, buildLogEntry(defenderId, "named_effect", "RS-432", next.definitions, `${MAKIBISHI_RULE}:${targets.length}`)],
  };
}

// ---------------------------------------------------------------------------
// RS-433 ネコマル（※常駐）
// 「自軍ラッシュフェイズ中、自分が特徴「忍者」を持つユニットをラッシュしたとき、自分の手札からカードを好きな枚数選び、
//  自軍山札の下に好きな順で戻してもよい。そうしたとき、戻した枚数と同じ枚数をドローする。」（atwiki/page-737）
// 選んだ順に山札の下へ置く（1枚ずつ選び、確定で戻した枚数だけドロー）。

const NEKOMARU_RE = /自軍ラッシュフェイズ中、自分が特徴「([^」]+)」を持つユニットをラッシュしたとき、自分の手札からカードを好きな枚数選び、自軍山札の下に好きな順で戻してもよい。そうしたとき、戻した枚数と同じ枚数をドローする/;
export const NEKOMARU_EFFECT_ID = "rs433_nekomaru";

/** 「ラッシュしたとき」（rules/onRushUnitEffects.ts から呼ぶ）。 */
export function applySet7AOnRush(
  state: GameState,
  ownerPlayerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.pendingEffectChoice) return state;
  // RS-437 白熱する実況（自動処理）→ RS-433 ネコマル（任意の選択）。
  const stacked = applyLiveCommentaryOnRush(state, ownerPlayerId, instanceId);
  return openNekomaru(stacked, ownerPlayerId, instanceId, phasePlayerId);
}

function openNekomaru(state: GameState, ownerPlayerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  if (state.phase !== "rush" || state.activePlayer !== ownerPlayerId) return state;
  const unit = fieldUnits(state, ownerPlayerId).find((c) => c.instanceId === instanceId);
  if (!unit) return state;
  const op = state.players[ownerPlayerId].operation.find((c) => {
    const m = cardTextOf(state, c.cardId).match(NEKOMARU_RE);
    return !!m && hasFeature(state, ownerPlayerId, unit, m[1]!);
  });
  if (!op) return state;
  const ids = state.players[ownerPlayerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: ownerPlayerId,
    effectId: NEKOMARU_EFFECT_ID,
    sourceCardId: op.cardId,
    sourceInstanceId: op.instanceId,
    kind: "select_hand",
    phasePlayerId,
    validInstanceIds: ids,
    selectedInstanceIds: [],
    optional: true,
  });
}

function finishNekomaru(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const chosen = pending.selectedInstanceIds ?? [];
  if (chosen.length === 0) {
    return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  }
  let next = patchPlayer(state, playerId, (p) => {
    const cards = chosen.map((id) => p.hand.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
    return { ...p, hand: p.hand.filter((c) => !chosen.includes(c.instanceId)), deck: [...p.deck, ...cards.map(strip)] };
  });
  next = { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = requestDrawFromDeck(next, playerId, pending.phasePlayerId, { count: chosen.length }).state;
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${NEKOMARU_EFFECT_ID}:${chosen.length}`),
  };
}

CHOICE_RESOLVERS[NEKOMARU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  const updated: GameState = {
    ...state,
    pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
  };
  if (remaining.length === 0) return finishNekomaru(updated, playerId);
  return { state: updated };
};
CHOICE_CONFIRMERS[NEKOMARU_EFFECT_ID] = finishNekomaru;
CHOICE_SKIPPERS[NEKOMARU_EFFECT_ID] = (state, playerId) => {
  // 選び始めたあとの見送りは、選んだ分で確定する。
  const pending = state.pendingEffectChoice!;
  if ((pending.selectedInstanceIds ?? []).length > 0) return finishNekomaru(state, playerId);
  return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
};

// ---------------------------------------------------------------------------
// RS-434 ライフバード（※常駐）
// 「カテゴリにETを持つ自軍ユニットがストライクしてダメージを与えたとき、自軍捨札からSユニットのカードを相手に1枚選ばせてもよい。
//  そうしたとき、相手の選んだユニットカードを自分の手札に加える。」（atwiki/page-746）

const LIFE_BIRD_RE = /カテゴリに(WB|OT|ET|MA|DA)を持つ自軍ユニットがストライクしてダメージを与えたとき、自軍捨札からSユニットのカードを相手に1枚選ばせてもよい。そうしたとき、相手の選んだユニットカードを自分の手札に加える/;
export const LIFE_BIRD_EFFECT_ID = "rs434_life_bird";
export const LIFE_BIRD_PICK_EFFECT_ID = "rs434_life_bird_pick";

function discardSUnitIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].discard
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

/** ストライクのダメージを与えたあと（core/applyAction.ts finishStrikeResolution から呼ぶ）。 */
export function applySet7AStrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  if (state.pendingEffectChoice || state.pendingDamagePayment) return state;
  const ownerId = pending.strikerPlayerId;
  const striker = state.players[ownerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!striker) return state;
  const cats = categoriesOf(state, striker.cardId);
  const op = state.players[ownerId].operation.find((c) => {
    const m = cardTextOf(state, c.cardId).match(LIFE_BIRD_RE);
    return !!m && cats.includes(m[1]!);
  });
  if (!op || discardSUnitIds(state, ownerId).length === 0) return state;
  return openEffectChoice(state, {
    playerId: ownerId,
    effectId: LIFE_BIRD_EFFECT_ID,
    sourceCardId: op.cardId,
    sourceInstanceId: op.instanceId,
    kind: "confirm",
    mayConfirm: true,
    phasePlayerId: pending.battlePhasePlayer,
    validInstanceIds: [],
    selectedInstanceIds: [],
    optional: true,
  });
}

function openLifeBirdPick(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const ids = discardSUnitIds(state, playerId);
  if (ids.length === 0) return { state: finish(state, pending) };
  return {
    state: reopen(state, pending, {
      playerId: opponent(playerId),
      effectId: LIFE_BIRD_PICK_EFFECT_ID,
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    log: logFor(state, playerId, pending.sourceCardId, `${LIFE_BIRD_EFFECT_ID}:accept`),
  };
}

CHOICE_RESOLVERS[LIFE_BIRD_EFFECT_ID] = (state, playerId) => openLifeBirdPick(state, playerId);
CHOICE_CONFIRMERS[LIFE_BIRD_EFFECT_ID] = (state, playerId) => openLifeBirdPick(state, playerId);
CHOICE_SKIPPERS[LIFE_BIRD_EFFECT_ID] = simpleSkip("RS-434");

CHOICE_RESOLVERS[LIFE_BIRD_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = opponent(playerId);
  const card = state.players[ownerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = moveDiscardToHand(state, ownerId, instanceId);
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${LIFE_BIRD_PICK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-435 アレ（※常駐）
// 「敵軍ターン中、特徴「忍者」を持つ自軍ユニットが撃破されて捨札になったとき、そのユニットカードをこれに重ねてもよい。
//  自軍ラッシュフェイズ中、自分のユニットカードの必要パワーの数字は、これに重ねたカード1枚につき1少なくなる。
//  これが常駐置き場を離れるとき、重ねたカードはすべて捨札になり、重ねた枚数と同じ数だけ自軍ユニットを選び撃破する。」
// （atwiki/page-753）必要パワーの軽減は core/power.ts（residentStackPowerCostReduction）。

const ARE_STACK_RE = /敵軍ターン中、特徴「([^」]+)」を持つ自軍ユニットが撃破されて捨札になったとき、そのユニットカードをこれに重ねてもよい/;
const ARE_LEAVE_RE = /これが常駐置き場を離れるとき、重ねたカードはすべて捨札になり、重ねた枚数と同じ数だけ自軍ユニットを選び撃破する/;
export const ARE_STACK_EFFECT_ID = "rs435_are_stack";
export const ARE_LEAVE_EFFECT_ID = "rs435_are_leave_destroy";

/** 「撃破されて捨札になったとき」（rules/leaveEffects.ts resolveAfterDiscardDestroyEffects から呼ぶ）。 */
export function applySet7AAfterDiscard(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; instanceId: string; cardId: string; phasePlayerId: PlayerId; destroyed?: boolean },
): GameState {
  if (ctx.destroyed === false) return state;
  if (ctx.phasePlayerId === ctx.ownerPlayerId) return state;
  const owner = state.players[ctx.ownerPlayerId];
  if (!owner.discard.some((c) => c.instanceId === ctx.instanceId)) return state;
  const features = getDefinition(state.definitions, ctx.cardId)?.features ?? [];
  const op = owner.operation.find((c) => {
    const m = cardTextOf(state, c.cardId).match(ARE_STACK_RE);
    return !!m && features.includes(m[1]!);
  });
  if (!op) return state;
  const choice: PendingEffectChoice = {
    playerId: ctx.ownerPlayerId,
    effectId: ARE_STACK_EFFECT_ID,
    sourceCardId: op.cardId,
    sourceInstanceId: op.instanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [ctx.instanceId],
    selectCount: 1,
    optional: true,
  };
  if (state.pendingEffectChoice) {
    return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  }
  return openEffectChoice(state, choice);
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return choice.resumeChoice
    ? { ...choice, resumeChoice: appendResume(choice.resumeChoice, next) }
    : { ...choice, resumeChoice: next };
}

CHOICE_RESOLVERS[ARE_STACK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  const op = state.players[playerId].operation.find((c) => c.instanceId === pending.sourceInstanceId);
  if (!card || !op) return { state: finish(state, pending) };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    operation: p.operation.map((c) =>
      c.instanceId === op.instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), strip(card)] } : c,
    ),
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, op.cardId, `${ARE_STACK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[ARE_STACK_EFFECT_ID] = simpleSkip("RS-435");

/**
 * 常駐置き場を離れたオペレーション（rules/permanentOperation.ts placePermanentOperation から呼ぶ）。
 * 重ねたカードはすでに捨札になっている（operationCardsToDiscardWithStack）。
 * - RS-435 アレ: 重ねた枚数と同じ数だけ自軍ユニットを選び撃破する。
 * - RS-437 白熱する実況: 自軍 L ユニットの下にウラ向きに重ねたカードをすべて捨札にする。
 */
export function afterResidentOperationsLeft(state: GameState, playerId: PlayerId, removed: CardInstance[]): GameState {
  let next = state;
  for (const op of removed) {
    const text = cardTextOf(next, op.cardId);
    if (LIVE_COMMENTARY_LEAVE_RE.test(text)) next = discardFaceDownUnderLargeUnits(next, playerId);
    const count = (op.stackedCards ?? []).length;
    if (count > 0 && ARE_LEAVE_RE.test(text)) next = openAreLeaveDestroy(next, playerId, op, count);
  }
  return next;
}

function openAreLeaveDestroy(state: GameState, playerId: PlayerId, op: CardInstance, count: number): GameState {
  const ids = fieldUnits(state, playerId).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  const choice: PendingEffectChoice = {
    playerId,
    effectId: ARE_LEAVE_EFFECT_ID,
    sourceCardId: op.cardId,
    sourceInstanceId: op.instanceId,
    kind: "select_unit",
    phasePlayerId: state.pendingEffectChoice?.phasePlayerId ?? state.activePlayer,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    set7aMeta: { remaining: count },
  };
  if (state.pendingEffectChoice) {
    return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  }
  return openEffectChoice(state, choice);
}

CHOICE_RESOLVERS[ARE_LEAVE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  if (!found || found.playerId !== playerId) return { error: "invalid_target" };
  const remaining = (pending.set7aMeta?.remaining ?? 1) - 1;
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  let next = leave.state;
  const log = logFor(state, playerId, pending.sourceCardId, `${ARE_LEAVE_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`);
  const ids = fieldUnits(next, playerId).map((c) => c.instanceId);
  if (remaining > 0 && ids.length > 0) {
    const follow: PendingEffectChoice = { ...pending, validInstanceIds: ids, set7aMeta: { remaining } };
    if (next.pendingEffectChoice) {
      next = { ...next, pendingEffectChoice: appendResume(next.pendingEffectChoice, follow) };
      return { state: next, log };
    }
    return { state: openEffectChoice(next, follow), log };
  }
  return { state: finish(next, { ...pending, resumeChoice: pending.resumeChoice }), log };
};

// ---------------------------------------------------------------------------
// RS-437 白熱する実況（※常駐）
// 「自分がLユニットをラッシュしたとき、その追加条件で捨札にした合体ユニットのカードがあれば、すべてウラ向きにして
//  そのLユニットの下に重ねる。そのLユニットは、ユニットでなくなるとき下に重ねたウラ向きのカードを1枚捨札にすれば、
//  その場に留まる。 これが常駐置き場を離れるとき、自軍Lユニットの下にウラ向きに重ねたカードがあれば、すべて捨札にする。」
// （atwiki/page-764）

const LIVE_COMMENTARY_RUSH_RE = /自分がLユニットをラッシュしたとき、その追加条件で捨札にした合体ユニットのカードがあれば、すべてウラ向きにしてそのLユニットの下に重ねる/;
const LIVE_COMMENTARY_STAY_RE = /そのLユニットは、ユニットでなくなるとき下に重ねたウラ向きのカードを1枚捨札にすれば、その場に留まる/;
const LIVE_COMMENTARY_LEAVE_RE = /これが常駐置き場を離れるとき、自軍Lユニットの下にウラ向きに重ねたカードがあれば、すべて捨札にする/;
export const LIVE_COMMENTARY_STAY_EFFECT_ID = "rs437_live_commentary_stay";

function hasResidentText(state: GameState, playerId: PlayerId, re: RegExp): CardInstance | undefined {
  return state.players[playerId].operation.find((c) => re.test(cardTextOf(state, c.cardId)));
}

function isLargeFieldUnit(state: GameState, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  return def?.type === "unit" && def.size === "L";
}

/** L ユニットをラッシュしたとき: 追加条件で捨札にした合体ユニットのカードをウラ向きで下に重ねる。 */
export function applyLiveCommentaryOnRush(state: GameState, ownerPlayerId: PlayerId, instanceId: string): GameState {
  if (!hasResidentText(state, ownerPlayerId, LIVE_COMMENTARY_RUSH_RE)) return state;
  const owner = state.players[ownerPlayerId];
  const unit = owner.rush.find((c) => c.instanceId === instanceId);
  if (!unit || !isLargeFieldUnit(state, unit)) return state;
  const record = owner.lastZordDiscard;
  if (!record || record.rushedInstanceId !== instanceId) return state;
  const def = getDefinition(state.definitions, unit.cardId);
  if (resolveRushAdditionalCondition(unit.cardId, def)?.conditionId !== "discard_fusion_unit") return state;
  // 「その追加条件で捨札にした合体ユニットのカード」— 条件つきの別名（XG6-018「※自軍Lユニットがなければ…としてつかえる」）は、
  // L ユニットをラッシュした後は満たせないので合体ユニットとして扱わない（atwiki/page-764 Q1・page-2334 Q3）。
  const partnerIds = resolveZordFusionPartnerSlots(unit.cardId).flat();
  const cards = owner.discard.filter(
    (c) =>
      record.instanceIds.includes(c.instanceId) &&
      getDefinition(state.definitions, c.cardId)?.type === "unit" &&
      (partnerIds.length === 0 || partnerIds.some((id) => fieldCardMatchesPartner(state.definitions, c, id, owner))),
  );
  if (cards.length === 0) return state;
  const ids = new Set(cards.map((c) => c.instanceId));
  return patchPlayer(state, ownerPlayerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => !ids.has(c.instanceId)),
    rush: p.rush.map((c) =>
      c.instanceId === instanceId
        ? { ...c, stackedCards: [...(c.stackedCards ?? []), ...cards.map((x) => ({ ...strip(x), faceDown: true }))] }
        : c,
    ),
    lastZordDiscard: undefined,
  }));
}

function discardFaceDownUnderLargeUnits(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => {
    const moved: CardInstance[] = [];
    const strip2 = (cards: CardInstance[]) =>
      cards.map((c) => {
        if (!isLargeFieldUnit(state, c) || !(c.stackedCards ?? []).some((s) => s.faceDown)) return c;
        moved.push(...(c.stackedCards ?? []).filter((s) => s.faceDown).map(strip));
        const rest = (c.stackedCards ?? []).filter((s) => !s.faceDown);
        if (rest.length > 0) return { ...c, stackedCards: rest };
        const { stackedCards: _s, ...without } = c;
        return without as CardInstance;
      });
    const battle = strip2(p.battle);
    const rush = strip2(p.rush);
    if (moved.length === 0) return p;
    return { ...p, battle, rush, discard: [...p.discard, ...moved] };
  });
}

/**
 * 「ユニットでなくなるとき下に重ねたウラ向きのカードを1枚捨札にすれば、その場に留まる」（rules/operationCounters.ts
 * tryLeaveField から呼ぶ）。選択を開いたら、その state。
 */
export function openLiveCommentaryStay(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.liveCommentaryDeclined || intent.toZone === "battle") return null;
  if (state.pendingEffectChoice) return null;
  const owner = state.players[intent.ownerPlayerId];
  const unit = owner[intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || !isLargeFieldUnit(state, unit)) return null;
  const op = hasResidentText(state, intent.ownerPlayerId, LIVE_COMMENTARY_STAY_RE);
  if (!op) return null;
  const faceDown = (unit.stackedCards ?? []).filter((c) => c.faceDown).map((c) => c.instanceId);
  if (faceDown.length === 0) return null;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: intent.ownerPlayerId,
      effectId: LIVE_COMMENTARY_STAY_EFFECT_ID,
      sourceCardId: op.cardId,
      sourceInstanceId: op.instanceId,
      kind: "select_unit",
      phasePlayerId: intent.phasePlayerId,
      validInstanceIds: faceDown,
      selectCount: 1,
      optional: true,
      set7aMeta: { leave: intent },
    },
    activePlayer: intent.ownerPlayerId,
  };
}

CHOICE_RESOLVERS[LIVE_COMMENTARY_STAY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.set7aMeta?.leave;
  if (!intent) return { error: "invalid_choice" };
  let next: GameState = patchPlayer(
    { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    playerId,
    (p) => {
      const take = (cards: CardInstance[]) =>
        cards.map((c) => {
          if (c.instanceId !== intent.instanceId) return c;
          const rest = (c.stackedCards ?? []).filter((s) => s.instanceId !== instanceId);
          if (rest.length > 0) return { ...c, stackedCards: rest };
          const { stackedCards: _s, ...without } = c;
          return without as CardInstance;
        });
      const stacked = [...p.battle, ...p.rush]
        .find((c) => c.instanceId === intent.instanceId)
        ?.stackedCards?.find((s) => s.instanceId === instanceId);
      return {
        ...p,
        battle: take(p.battle),
        rush: take(p.rush),
        discard: stacked ? [...p.discard, strip(stacked)] : p.discard,
      };
    },
  );
  // その場に留まる（「ユニットでなくなる」ことは起きない。撃破された事実は残る。R-DESTROY-02）。
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  const follow = intent.followUpAttackerLeave;
  if (follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) {
    next = tryLeaveField(next, { ...follow }).state;
  }
  const settled = next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
  return { state: settled, log: logFor(state, playerId, pending.sourceCardId, `${LIVE_COMMENTARY_STAY_EFFECT_ID}:stay`) };
};
CHOICE_SKIPPERS[LIVE_COMMENTARY_STAY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.set7aMeta?.leave;
  if (!intent) return { error: "invalid_choice" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = tryLeaveField(cleared, { ...intent, liveCommentaryDeclined: true });
  let next = leave.state;
  const follow = intent.followUpAttackerLeave;
  if (!leave.deferred && follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) {
    next = tryLeaveField(next, { ...follow }).state;
  }
  const settled = next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
  return { state: settled, log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
};

// ---------------------------------------------------------------------------
// DSL grant_keyword（`set7a::cardId::name`）からの起点

export const SET7A_KEYWORD_PREFIX = "set7a::";

export function trySet7ACardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET7A_KEYWORD_PREFIX)) return null;
  switch (keyword) {
    case "set7a::RS-439::bannou_senkan":
      return openAllPurposeShip(state, ctx);
    default:
      return { state, detail: keyword };
  }
}
