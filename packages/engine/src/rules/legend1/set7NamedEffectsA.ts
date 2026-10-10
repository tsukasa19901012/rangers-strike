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
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isSmallUnit, parsePowerCost } from "../../core/catalog";
import { opponent, updatePlayer } from "../../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { markBattleBlocked } from "../turnModifiers";
import { shuffleCards } from "../errataCardEffects";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import type { ComboOutcome } from "../comboTypes";

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
  const holdIndex = player.command.findIndex((c) => !c.commandHeld);
  if (!card || holdIndex < 0) return { error: "invalid_target" };
  // 自軍コマンドを1つホールドして、選んだユニットカードを自軍ラッシュエリアに出す（効果で出す。R-RUSH-22）。
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c, i) => (i === holdIndex ? { ...c, commandHeld: true } : c)),
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, strip(card)],
  }));
  const queue = pending.set7aMeta?.queue ?? [];
  const cleared: GameState = { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = finalizeEffectRush(cleared, playerId, [instanceId], pending.phasePlayerId).state;
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
};
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
  if (!state.players[enteringPlayerId].battle.some((c) => c.instanceId === entered.instanceId)) return state;
  if (effectiveBp(state, enteringPlayerId, entered) < 6000) return state;
  const boys = state.players[ownerId].battle.filter((c) => c.cardId === "RS-452");
  if (boys.length === 0) return state;
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
// 参照用

export function set7AHasTurnRule(state: GameState, playerId: PlayerId, ruleId: string): boolean {
  return hasTurnRuleModifier(state.players[playerId], ruleId);
}

export { updatePlayer as _set7UpdatePlayer };
