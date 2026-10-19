/**
 * 効果で「選んだユニットを1体ずつラッシュエリアに出す」処理（ランドバルカン・空輸搬送・パーツキャリアー等）。
 *
 * ルール: R-RUSH-20 — 効果によるラッシュでは、指定がない限り必要パワー・追加条件・コマンドのホールドは不要。
 * ルール: R-RUSH-21 — 「ただし、ラッシュするための必要パワーと追加条件は満たすこと」とあれば、
 *   「必要パワー確認 → 追加条件の実行 → 出す」の順で処理する（コマンドのホールドは不要。「－」は任意）。
 * ルール: R-RUSH-23 — 「2枚まで選び…出してもよい」は先に選んでから、選んだ1枚ごとに出す。
 *   1枚出すごとに「ラッシュしたとき」誘発と「ラッシュされたとき」窓を処理し（R-RUSH-22, R-RUSH-30）、
 *   窓が閉じてから次の1枚に進む。
 */
import { rk12PlacesHeldOnRush } from "./rk/rk12Fields";
import { shuffleCards as shuffleDeckCards } from "../core/deckShuffle";
import type { CardDefinition } from "@rangers-strike/cards";
import { cardHasCategory, getZordCondition, isZordUpCost, MOTHERSHIP_CONFIG, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type {
  CardInstance,
  EffectRushSourceZone,
  GameState,
  PendingEffectChoice,
  PendingEffectRush,
  PlayerId,
  PlayerState,
} from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  getDefinition,
  isRushable,
  parsePowerCost,
  rushPowerCost,
  unitSizeOf,
} from "../core/catalog";
import { countAvailablePower, effectivePowerCost, findInZone, updatePlayer } from "../core/helpers";
import { redRacerPowerCostBonus } from "../core/power";
import {
  finalizeEffectRush,
  hasPendingPromptBlockingEffectRush,
} from "../events/emitUnitRushed";
import { rushAdditionalConditionApplies } from "./bkOperationTurnRules";
import { promoteDeferredBattleEntry } from "./battleEntry";
import { suppressesDeployedUnitEffects } from "./pendingChoices";
import { resolveZordFusionPartnerSlots, resolveZordFusionSlotAlternatives } from "../dsl/zordBridge";
import {
  applyAllZordFusionMaterials,
  collectZordMaterials,
  fieldCardMatchesPartner,
  hasAllRequiredFusionMaterials,
  isValidZordUpMaterial,
  needsZordMaterial,
  requiresAllFusionPartners,
} from "./zord";
import {
  applyMultipleZordDownMaterials,
  collectZordDownMaterials,
  needsZordDownPayment,
} from "./zordDown";
import {
  applyExtendedZordPayment,
  applyMultipleFieldZordMaterials,
  applyOpponentDrawCost,
  collectExtendedZordMaterials,
  collectHoldExtraCommandCandidates,
  evaluateStateGate,
  needsHoldExtraCommand,
  needsOpponentDrawCost,
  needsZordExtendedMaterial,
} from "./zordExtended";
import { canUseMothershipForZordRush } from "./mothership";
import { buildEffectHoldPayment } from "./commandPayment";
import { markBattleBlocked } from "./turnModifiers";

export const EFFECT_RUSH_PICK = "effect_rush_pick";
export const EFFECT_RUSH_MATERIAL = "effect_rush_material";
export const EFFECT_RUSH_DESTINATION = "effect_rush_destination";
/** 母艦（ジャガーバルカン等）: S ユニットを送るかわりにコマンドをホールドする。 */
export const EFFECT_RUSH_MOTHERSHIP = "effect_rush_mothership";
/** RS-359 デンジ犬アイシー【最後の手段】: 山札から追加条件に必要なユニットのカードを選ぶ。 */
export const EFFECT_RUSH_ICY_DECK = "effect_rush_icy_deck";

const EFFECT_RUSH_CHOICE_IDS = new Set([
  EFFECT_RUSH_PICK,
  EFFECT_RUSH_MATERIAL,
  EFFECT_RUSH_DESTINATION,
  EFFECT_RUSH_MOTHERSHIP,
  EFFECT_RUSH_ICY_DECK,
]);

/**
 * RS-359 デンジ犬アイシー【最後の手段】
 * 「これが自軍ラッシュエリアにある間、自分がOTのLユニットをラッシュするとき、これを捨札にして次の効果を発動できる⇒
 *  自軍山札から、そのLユニットの追加条件を満たすために必要なユニットのカードを1枚選び捨札にすれば、
 *  必要なユニットの1体を捨札にしたことにできる。その後、山札をシャッフルする。」
 * RS-249 Vコマンダーで山札から出す Vレックスロボにも使える（grnrngr/faq-card-6 RS-359 Q）。2体あればそれぞれ使える（同 Q）。
 */
const DENJI_ICY_CARD_ID = "RS-359";

function icyApplies(state: GameState, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  return !!def && def.type === "unit" && unitSizeOf(state.definitions, card) === "L" && cardHasCategory(def, "OT");
}

/** 使えるデンジ犬アイシー（自軍ラッシュエリア）。 */
function icyIds(state: GameState, playerId: PlayerId, card: CardInstance): string[] {
  if (!icyApplies(state, card)) return [];
  return state.players[playerId].rush
    .filter((c) => c.cardId === DENJI_ICY_CARD_ID && c.instanceId !== card.instanceId)
    .map((c) => c.instanceId);
}

/** 山札にある、追加条件に必要なユニットのカード。 */
function icyDeckMaterialIds(state: GameState, playerId: PlayerId, card: CardInstance): string[] {
  return state.players[playerId].deck
    .filter((c) => c.instanceId !== card.instanceId)
    .filter((c) => isValidZordUpMaterial(state.definitions, card.cardId, card.instanceId, c))
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// 合体（「合体―A＋B＋…」）の追加条件をデンジ犬アイシーで補う（RS-605 異次元からの翼でセイクウオーを出す。atwiki/page-1489 Q1）。
// 合体ユニットの枠（resolveZordFusionPartnerSlots）ごとに別々のカードを割り当てられるかで判定する（同じ枠のカードを山札から
// 選んでも足りない枠は補えない。grnrngr/faq-card-6 RS-359 Q2）。「（または、A＋B）」の枠を持つカードは対象外。

function fusionSlots(cardId: string): string[][] | null {
  const slots = resolveZordFusionPartnerSlots(cardId);
  if (slots.length === 0 || resolveZordFusionSlotAlternatives(cardId).size > 0) return null;
  return slots;
}

/** cards をそれぞれ別の枠に割り当てられるか（used の枠は使えない）。 */
function assignFusionSlots(
  definitions: GameState["definitions"],
  slots: string[][],
  cards: CardInstance[],
  used: Set<number> = new Set(),
): Set<number> | null {
  if (cards.length === 0) return used;
  const [head, ...rest] = cards;
  for (let i = 0; i < slots.length; i += 1) {
    if (used.has(i)) continue;
    if (!slots[i]!.some((id) => fieldCardMatchesPartner(definitions, head!, id))) continue;
    const done = assignFusionSlots(definitions, slots, rest, new Set([...used, i]));
    if (done) return done;
  }
  return null;
}

/**
 * chosen（割り当て済み）に、場の残りの候補 field と、アイシー icyLeft 体ぶんの山札のカード deck を加えて、
 * すべての枠をそろえられるか。
 */
function fusionCompletable(
  definitions: GameState["definitions"],
  slots: string[][],
  chosen: CardInstance[],
  field: CardInstance[],
  deck: CardInstance[],
  icyLeft: number,
): boolean {
  if (!assignFusionSlots(definitions, slots, chosen)) return false;
  if (chosen.length >= slots.length) return true;
  for (const card of field) {
    if (fusionCompletable(definitions, slots, [...chosen, card], field.filter((c) => c !== card), deck, icyLeft)) return true;
  }
  if (icyLeft > 0) {
    const seen = new Set<string>();
    for (const card of deck) {
      if (seen.has(card.cardId)) continue;
      seen.add(card.cardId);
      if (fusionCompletable(definitions, slots, [...chosen, card], field, deck.filter((c) => c !== card), icyLeft - 1)) return true;
    }
  }
  return false;
}

function fusionFieldCandidates(state: GameState, playerId: PlayerId, card: CardInstance): CardInstance[] {
  return collectZordMaterials(state.players[playerId], state.definitions, card.cardId, card.instanceId);
}

function fusionDeckCandidates(state: GameState, playerId: PlayerId, card: CardInstance): CardInstance[] {
  return state.players[playerId].deck.filter(
    (c) => c.instanceId !== card.instanceId && isValidZordUpMaterial(state.definitions, card.cardId, card.instanceId, c),
  );
}

function findCards(state: GameState, playerId: PlayerId, ids: string[]): CardInstance[] {
  const p = state.players[playerId];
  const all = [...p.rush, ...p.battle, ...p.deck, ...p.discard];
  return ids.map((id) => all.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
}

/** デンジ犬アイシーで補える素材の数（アイシーの数と山札の候補の少ない方）。 */
function icySupplyCount(state: GameState, playerId: PlayerId, card: CardInstance): number {
  const icy = icyIds(state, playerId, card);
  if (icy.length === 0) return 0;
  return Math.min(icy.length, icyDeckMaterialIds(state, playerId, card).length);
}

export function isEffectRushChoice(pending: PendingEffectChoice | undefined): boolean {
  return !!pending && EFFECT_RUSH_CHOICE_IDS.has(pending.effectId);
}

type EffectRushPlan =
  /** opponentDraw: 追加条件「相手は1枚ドローする」を実行してから出す。 */
  | { kind: "none"; opponentDraw?: boolean }
  | { kind: "fusion" }
  /** 追加条件「追加で自軍コマンドをNつホールドする」: ホールドするコマンドを選んでから出す。 */
  | { kind: "hold"; holdIds: string[]; needed: number }
  /** 追加条件「手札を1枚捨札にする」等（場以外のカードも使う追加条件）: 素材を選んで実行してから出す。 */
  | { kind: "extended"; materials: string[]; needed: number }
  | {
      kind: "up" | "down";
      materials: string[];
      needed: number;
      /** 「コマンドゾーンに送るか捨札にする」で送り先を選べる。 */
      destinationChoice: boolean;
      /** 母艦の代替でホールドできるコマンド（必要数以上あるときだけ）。 */
      mothershipHoldIds?: string[];
    };

/**
 * ルール: R-HOLD-04, R-RUSH-21 — 効果で「追加条件を満たして」出すときも、母艦（RS-076 ジャガーバルカン等）の
 * 「S ユニットを送るかわりに『アーステクノロジー』の自軍コマンドを1つホールドする」を使える。選んだ時点で
 * 適正な対象なら、出すカード自身（コマンドゾーンのダイナマッハ）をホールドしてもよい（faq-card-2 RS-076 Q3）。
 */
function effectRushMothershipHoldIds(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  needed: number,
): string[] | undefined {
  const player = state.players[playerId];
  const kind = canUseMothershipForZordRush(state.definitions, player, card.cardId);
  if (!kind) return undefined;
  const category = kind.commandCategory;
  const ids = player.command
    .filter((c) => {
      if (c.commandHeld) return false;
      const def = getDefinition(state.definitions, c.cardId);
      return !!def && cardHasCategory(def, category);
    })
    .map((c) => c.instanceId);
  return ids.length >= needed ? ids : undefined;
}

function additionalUnitCount(def: CardDefinition): number {
  const count = def.rushAdditionalCondition?.unitCount;
  return typeof count === "number" && count > 0 ? count : 1;
}

/**
 * 効果でラッシュエリアに出せるか、出すときに実行する追加条件。出せなければ null。
 * requireConditions が false なら条件なし（R-RUSH-20）。
 */
export function planEffectRush(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  requireConditions: boolean,
  ignorePowerCost = false,
): EffectRushPlan | null {
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || !isRushable(def)) return null;
  if (!requireConditions) return { kind: "none" };

  const player = state.players[playerId];
  const power = countAvailablePower(state, playerId);
  const cost = effectivePowerCost(state, playerId, parsePowerCost(def.powerCost) + redRacerPowerCostBonus(state, playerId, card.cardId));

  if (needsZordDownPayment(card.cardId, def.powerCost, def)) {
    // 「－」は任意。必要パワーを満たしていれば追加条件なしで出す。
    if (ignorePowerCost || power >= cost) return { kind: "none" };
    const materials = collectZordDownMaterials(
      player,
      state.definitions,
      card.cardId,
      card.instanceId,
    ).map((c) => c.instanceId);
    const needed = additionalUnitCount(def);
    if (materials.length < needed) return null;
    const reduced = rushPowerCost(state, playerId, def, {
      zordMaterialInstanceIds: materials.slice(0, needed),
      zordMaterialInstanceId: materials[0],
    });
    if (!ignorePowerCost && power < reduced) return null;
    return { kind: "down", materials, needed, destinationChoice: false };
  }

  // 必要パワーの確認が先（追加条件の実行で満たすことはできない）。
  if (!ignorePowerCost && power < cost) return null;

  if (
    !isZordUpCost(def.powerCost) ||
    !rushAdditionalConditionApplies(state, playerId, card.cardId)
  ) {
    return { kind: "none" };
  }

  if (requiresAllFusionPartners(card.cardId)) {
    if (hasAllRequiredFusionMaterials(player, state.definitions, card.cardId, card.instanceId)) return { kind: "fusion" };
    // デンジ犬アイシー【最後の手段】で、足りない合体ユニットを山札のカードで補う。
    const slots = fusionSlots(card.cardId);
    const icy = icyIds(state, playerId, card).length;
    if (!slots || icy === 0) return null;
    const field = fusionFieldCandidates(state, playerId, card);
    if (!fusionCompletable(state.definitions, slots, [], field, fusionDeckCandidates(state, playerId, card), icy)) return null;
    return { kind: "up", materials: field.map((c) => c.instanceId), needed: slots.length, destinationChoice: false };
  }

  if (needsZordMaterial(state.definitions, card.cardId)) {
    const materials = collectZordMaterials(
      player,
      state.definitions,
      card.cardId,
      card.instanceId,
    ).map((c) => c.instanceId);
    const needed = additionalUnitCount(def);
    const mothershipHoldIds = effectRushMothershipHoldIds(state, playerId, card, needed);
    const icySupply = icySupplyCount(state, playerId, card);
    if (materials.length + icySupply < needed && !mothershipHoldIds) return null;
    return {
      kind: "up",
      materials,
      needed,
      destinationChoice: getZordCondition(card.cardId) === "send_s_unit_to_command_or_discard",
      mothershipHoldIds,
    };
  }

  // ルール: R-RUSH-21 — 「追加条件は満たすこと」は、素材を使う追加条件以外も満たす（実行する）。
  const condition = resolveRushAdditionalCondition(card.cardId, def);
  if (condition?.conditionId === "state_gate") {
    // 「特徴「母艦」を持つ自軍ユニットがある」等の状態: 満たしていなければ出せない（RS-641【スクランブル】等）。
    return evaluateStateGate(state, playerId, condition) ? { kind: "none" } : null;
  }
  if (needsOpponentDrawCost(state.definitions, card.cardId)) return { kind: "none", opponentDraw: true };
  if (needsHoldExtraCommand(state.definitions, card.cardId)) {
    const needed = condition?.unitCount ?? 1;
    const holdIds = collectHoldExtraCommandCandidates(player, state.definitions).map((c) => c.instanceId);
    return holdIds.length >= needed ? { kind: "hold", holdIds, needed } : null;
  }
  if (needsZordExtendedMaterial(state.definitions, card.cardId)) {
    const materials = collectExtendedZordMaterials(player, state.definitions, card.cardId, card.instanceId).map((m) => m.card.instanceId);
    const all = condition?.conditionId === "discard_all_hand" || condition?.conditionId === "discard_all_face_up_power";
    const needed = all ? materials.length : (condition?.unitCount ?? 1);
    if (needed <= 0 || materials.length < needed) return null;
    return { kind: "extended", materials, needed };
  }
  return { kind: "none" };
}

/** 自軍コマンドゾーンのリリース状態の、指定サイズのユニットカード。 */
export function releasedCommandUnitIds(
  state: GameState,
  playerId: PlayerId,
  size: "S" | "M" | "L",
): string[] {
  return state.players[playerId].command
    .filter((c) => {
      if (c.commandHeld) return false;
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && unitSizeOf(state.definitions, c) === size;
    })
    .map((c) => c.instanceId);
}

/** 効果ラッシュの候補のうち、実際に出せるもの。 */
export function filterEffectRushCandidates(
  state: GameState,
  playerId: PlayerId,
  fromZone: EffectRushSourceZone,
  candidateIds: string[],
  requireConditions: boolean,
  ignorePowerCost = false,
): string[] {
  const player = state.players[playerId];
  return candidateIds.filter((id) => {
    const found = findInZone(player, fromZone, id);
    if (!found) return false;
    return planEffectRush(state, playerId, found.card, requireConditions, ignorePowerCost) !== null;
  });
}

export type StartEffectRushInput = {
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  effectId: string;
  sourceCardId: string;
  sourceInstanceId?: string;
  fromZone: EffectRushSourceZone;
  candidates: string[];
  /** 選べる上限。 */
  maxCount: number;
  requireConditions: boolean;
  /** 追加条件は満たすが必要パワーは満たさなくてよい（RS-249）。 */
  ignorePowerCost?: boolean;
  /**
   * 候補が上限以下でもプレイヤーに選ばせる（「1枚選び…出してもよい」）。
   * 既定で選ばせる（効果ラッシュの文言は「出してもよい」で任意 — RS-005 atwiki/page-249、
   * grnrngr/faq-card-1 RS-005 Q1）。`mandatory: true` のときだけ候補全員を自動で出す。
   */
  alwaysAsk?: boolean;
  /** 「出す」（任意でない）効果ラッシュ。候補が上限以下なら選択なしで全員を出す。 */
  mandatory?: boolean;
  /** 出したユニットは、このターン、バトルエリアに出られない。 */
  blockBattleEntryThisTurn?: boolean;
  /** 「1枚選び、…出す」（任意でない）: 選択・追加条件の素材の選択を見送れない（RS-605）。 */
  forced?: boolean;
};

/**
 * 効果ラッシュを開始する。プレイヤーが上限まで選ぶ（任意）。`mandatory` で候補が上限以下なら全員を出す順に積む。
 * 出せる候補が無ければ state をそのまま返す。
 */
export function startEffectRush(state: GameState, input: StartEffectRushInput): GameState {
  const candidates = filterEffectRushCandidates(
    state,
    input.playerId,
    input.fromZone,
    input.candidates,
    input.requireConditions,
    input.ignorePowerCost,
  );
  if (candidates.length === 0 || input.maxCount <= 0) return state;

  const base: PendingEffectRush = {
    playerId: input.playerId,
    phasePlayerId: input.phasePlayerId,
    effectId: input.effectId,
    sourceCardId: input.sourceCardId,
    sourceInstanceId: input.sourceInstanceId,
    fromZone: input.fromZone,
    requireConditions: input.requireConditions,
    ignorePowerCost: input.ignorePowerCost,
    blockBattleEntryThisTurn: input.blockBattleEntryThisTurn,
    ...(input.forced ? { forced: true } : {}),
    queue: [],
  };

  if (input.mandatory && candidates.length <= input.maxCount && !input.alwaysAsk) {
    return continuePendingEffectRush({
      ...state,
      pendingEffectRush: { ...base, queue: candidates },
    });
  }

  return openPickChoice(
    { ...state, pendingEffectRush: { ...base, picking: { candidates, remaining: input.maxCount } } },
  );
}

function openChoice(state: GameState, choice: Omit<PendingEffectChoice, "phasePlayerId" | "playerId">): GameState {
  const pending = state.pendingEffectRush!;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: pending.playerId,
      phasePlayerId: pending.phasePlayerId,
      selectedInstanceIds: [],
      ...choice,
    },
    activePlayer: pending.playerId,
  };
}

function openPickChoice(state: GameState): GameState {
  const pending = state.pendingEffectRush!;
  return openChoice(state, {
    effectId: EFFECT_RUSH_PICK,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    kind: "select_unit",
    validInstanceIds: pending.picking!.candidates,
    optional: !pending.forced,
  });
}

function closeChoice(state: GameState): GameState {
  const pending = state.pendingEffectRush;
  return {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: pending?.phasePlayerId ?? state.activePlayer,
  };
}

function withPending(state: GameState, pending: PendingEffectRush | undefined): GameState {
  return { ...state, pendingEffectRush: pending };
}

function stripCommandFlags(card: CardInstance): CardInstance {
  const { commandHeld: _held, mothershipHold: _mothership, faceDown: _faceDown, ...rest } = card;
  return rest;
}

/** 1体をラッシュエリアに出し、誘発とカウンター窓を処理する。 */
function placeUnit(state: GameState, instanceId: string): GameState {
  const pending = state.pendingEffectRush!;
  const owner = state.players[pending.playerId];
  const found = findInZone(owner, pending.fromZone, instanceId);
  if (!found) return state;
  const zoneCards = owner[pending.fromZone].filter((c) => c.instanceId !== instanceId);
  let nextOwner: PlayerState = {
    ...owner,
    [pending.fromZone]: zoneCards,
    // RK-245 等「※これはラッシュするとき、可能ならホールド状態で置く。」— 効果のラッシュでも（atwiki/page-876 Q2）。
    rush: [...owner.rush, rk12PlacesHeldOnRush(state, found.card.cardId) ? { ...stripCommandFlags(found.card), commandHeld: true } : stripCommandFlags(found.card)],
  };
  if (pending.blockBattleEntryThisTurn) nextOwner = markBattleBlocked(nextOwner, instanceId);
  const placed = { ...state, ...updatePlayer(state, pending.playerId, nextOwner) };
  // ルール: R-RUSH-24 — 「このとき出したユニットの効果は発動しない」（RS-371【マスキーリボン】等）なら自身の効果を止める。
  const result = finalizeEffectRush(placed, pending.playerId, [instanceId], pending.phasePlayerId, {
    silent: suppressesDeployedUnitEffects(pending),
  });
  return {
    ...result.state,
    log: result.logs.length > 0 ? [...result.state.log, ...result.logs] : result.state.log,
  };
}

/** 選んだ素材で追加条件を実行して出す。 */
function executeConditionAndPlace(state: GameState): GameState {
  const pending = state.pendingEffectRush!;
  const current = pending.current!;
  const owner = state.players[pending.playerId];
  const found = findInZone(owner, pending.fromZone, current.instanceId);
  let next: GameState = withPending(state, { ...pending, current: undefined });
  if (!found) return continuePendingEffectRush(next);
  if (current.chosen.length === 0) {
    // デンジ犬アイシーですべての素材を「捨札にしたことにした」。
    return continueAfterPlacement(placeUnit(next, current.instanceId));
  }
  const applied =
    current.direction === "extended"
      ? applyExtendedZordPayment(owner, state.definitions, found.card.cardId, found.card.instanceId, current.chosen)
      : current.direction === "down"
      ? applyMultipleZordDownMaterials(
          owner,
          state.definitions,
          found.card.cardId,
          found.card.instanceId,
          current.chosen,
          current.destination ?? "discard",
        )
      : applyMultipleFieldZordMaterials(
          owner,
          state.definitions,
          found.card.cardId,
          found.card.instanceId,
          current.chosen,
          current.destination ?? "discard",
        );
  if (!applied) return continuePendingEffectRush(next);
  next = { ...next, ...updatePlayer(next, pending.playerId, applied) };
  return continueAfterPlacement(placeUnit(next, current.instanceId));
}

function continueAfterPlacement(state: GameState): GameState {
  if (hasPendingPromptBlockingEffectRush(state)) return state;
  return continuePendingEffectRush(state);
}

/** 素材の選択の種類（手札・パワー・コマンドのカードを使う追加条件では、そのゾーンのカードを選ぶ）。 */
function materialChoiceKind(state: GameState, materials: string[]): PendingEffectChoice["kind"] {
  const owner = state.players[state.pendingEffectRush!.playerId];
  const inZone = (zone: "hand" | "power" | "command") => materials.every((id) => owner[zone].some((c) => c.instanceId === id));
  if (materials.length > 0 && inZone("hand")) return "select_hand";
  if (materials.length > 0 && inZone("power")) return "select_power";
  if (materials.length > 0 && inZone("command")) return "select_command";
  return "select_unit";
}

function openMaterialChoice(state: GameState, materials: string[]): GameState {
  const pending = state.pendingEffectRush!;
  return openChoice(state, {
    effectId: EFFECT_RUSH_MATERIAL,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.current?.instanceId,
    kind: materialChoiceKind(state, materials),
    validInstanceIds: materials,
    optional: !pending.forced,
  });
}

function currentMaterials(state: GameState): string[] {
  const pending = state.pendingEffectRush!;
  const current = pending.current!;
  const owner = state.players[pending.playerId];
  const found = findInZone(owner, pending.fromZone, current.instanceId);
  if (!found) return [];
  if (current.direction === "extended") {
    return collectExtendedZordMaterials(owner, state.definitions, found.card.cardId, found.card.instanceId)
      .map((m) => m.card.instanceId)
      .filter((id) => !current.chosen.includes(id));
  }
  const all =
    current.direction === "down"
      ? collectZordDownMaterials(owner, state.definitions, found.card.cardId, found.card.instanceId)
      : collectZordMaterials(owner, state.definitions, found.card.cardId, found.card.instanceId);
  const rest = all.filter((c) => !current.chosen.includes(c.instanceId));
  const slots = requiresAllFusionPartners(found.card.cardId) ? fusionSlots(found.card.cardId) : null;
  if (!slots) return rest.map((c) => c.instanceId);
  // 合体: 選ぶと残りの枠をそろえられなくなるカードは候補にしない。
  const chosen = findCards(state, pending.playerId, [...current.chosen, ...(current.icyChosen ?? [])]);
  const deck = fusionDeckCandidates(state, pending.playerId, found.card);
  const icyLeft = icyIds(state, pending.playerId, found.card).length;
  return rest
    .filter((c) => fusionCompletable(state.definitions, slots, [...chosen, c], rest.filter((x) => x !== c), deck, icyLeft))
    .map((c) => c.instanceId);
}

/** 合体: アイシーで山札から選べるカード（足りない枠を補えるものだけ）。 */
function fusionIcyDeckIds(state: GameState, card: CardInstance): string[] | null {
  const pending = state.pendingEffectRush!;
  const current = pending.current!;
  const slots = requiresAllFusionPartners(card.cardId) ? fusionSlots(card.cardId) : null;
  if (!slots) return null;
  const chosen = findCards(state, pending.playerId, [...current.chosen, ...(current.icyChosen ?? [])]);
  const field = fusionFieldCandidates(state, pending.playerId, card).filter((c) => !current.chosen.includes(c.instanceId));
  const deck = fusionDeckCandidates(state, pending.playerId, card);
  const icyLeft = icyIds(state, pending.playerId, card).length;
  return deck
    .filter((c) => fusionCompletable(state.definitions, slots, [...chosen, c], field, deck.filter((x) => x !== c), Math.max(0, icyLeft - 1)))
    .map((c) => c.instanceId);
}

/** 今のユニットに使えるデンジ犬アイシー（山札に素材の候補があるときだけ）。 */
function currentIcyIds(state: GameState): string[] {
  const pending = state.pendingEffectRush!;
  const current = pending.current!;
  const owner = state.players[pending.playerId];
  const found = findInZone(owner, pending.fromZone, current.instanceId);
  if (!found) return [];
  const fusionDeck = fusionIcyDeckIds(state, found.card);
  if ((fusionDeck ?? icyDeckMaterialIds(state, pending.playerId, found.card)).length === 0) return [];
  return icyIds(state, pending.playerId, found.card);
}

/** デンジ犬アイシーを捨札にして、山札から素材のカードを選ぶ。 */
function activateIcy(state: GameState, icyInstanceId: string): GameState {
  const pending = state.pendingEffectRush!;
  const current = pending.current!;
  const owner = state.players[pending.playerId];
  const found = findInZone(owner, pending.fromZone, current.instanceId);
  const icy = findInZone(owner, "rush", icyInstanceId);
  if (!found || !icy) return proceedMaterials(state);
  const deckIds = fusionIcyDeckIds(state, found.card) ?? icyDeckMaterialIds(state, pending.playerId, found.card);
  const discarded: GameState = {
    ...state,
    ...updatePlayer(state, pending.playerId, {
      ...owner,
      rush: owner.rush.filter((c) => c.instanceId !== icyInstanceId),
      discard: [...owner.discard, icy.card],
    }),
  };
  const withIcy = withPending(discarded, {
    ...pending,
    current: { ...current, icyPending: icyInstanceId },
  });
  return openChoice(withIcy, {
    effectId: EFFECT_RUSH_ICY_DECK,
    sourceCardId: DENJI_ICY_CARD_ID,
    sourceInstanceId: icyInstanceId,
    kind: "select_unit",
    validInstanceIds: deckIds,
    optional: true,
  });
}

function shuffledDeck(cards: CardInstance[]): CardInstance[] {
  return shuffleDeckCards(cards);
}

/** 山札から選んだ素材のカードを捨札にし（捨札にしたことにする）、山札をシャッフルする。 */
function resolveIcyDeckPick(state: GameState, deckInstanceId: string | undefined): GameState {
  const pending = state.pendingEffectRush!;
  const current = pending.current!;
  const owner = state.players[pending.playerId];
  let nextOwner: PlayerState = owner;
  let icyCount = current.icyCount ?? 0;
  let icyChosen = current.icyChosen ?? [];
  if (deckInstanceId) {
    const found = findInZone(owner, "deck", deckInstanceId);
    if (found) {
      nextOwner = {
        ...owner,
        deck: owner.deck.filter((c) => c.instanceId !== deckInstanceId),
        discard: [...owner.discard, { ...found.card, faceDown: false }],
      };
      icyCount += 1;
      icyChosen = [...icyChosen, deckInstanceId];
    }
  }
  nextOwner = { ...nextOwner, deck: shuffledDeck(nextOwner.deck) };
  const next = withPending(
    closeChoice({ ...state, ...updatePlayer(state, pending.playerId, nextOwner) }),
    { ...pending, current: { ...current, icyPending: undefined, icyCount, icyChosen } },
  );
  return proceedMaterials(next);
}

/** 追加条件の素材選択（選択肢が必要数ちょうどなら自動）。 */
function proceedMaterials(state: GameState): GameState {
  const current = state.pendingEffectRush!.current!;
  const remainingNeeded = current.needed - current.chosen.length - (current.icyCount ?? 0);
  if (remainingNeeded <= 0) return executeConditionAndPlace(state);
  const fieldMaterials = currentMaterials(state);
  const icy = current.direction === "up" ? currentIcyIds(state) : [];
  if (icy.length > 0 && fieldMaterials.length + icy.length >= remainingNeeded) {
    // デンジ犬アイシーを使うかどうかはプレイヤーが選ぶ（「発動できる」）。
    return openMaterialChoice(state, [...fieldMaterials, ...icy]);
  }
  const materials = fieldMaterials;
  if (materials.length < remainingNeeded) {
    // 満たせなくなった: このユニットは出さない。
    return continuePendingEffectRush(
      withPending(state, { ...state.pendingEffectRush!, current: undefined }),
    );
  }
  if (materials.length === remainingNeeded) {
    return executeConditionAndPlace(
      withPending(state, {
        ...state.pendingEffectRush!,
        current: { ...current, chosen: [...current.chosen, ...materials] },
      }),
    );
  }
  return openMaterialChoice(state, materials);
}

/**
 * 積まれた効果ラッシュを、操作待ちが無い間だけ1体ずつ進める。
 */
export function continuePendingEffectRush(state: GameState): GameState {
  let next = state;
  for (let guard = 0; guard < 16; guard += 1) {
    const pending = next.pendingEffectRush;
    if (!pending) return next;
    if (pending.picking || pending.current) return next;
    if (hasPendingPromptBlockingEffectRush(next)) return next;
    if (pending.queue.length === 0) {
      // 「バトルエリアに出たとき」の効果（パーツキャリアー等）から来た場合、保留していた
      // アタック／ストライク選択を再開する。
      return promoteDeferredBattleEntry(withPending(next, undefined));
    }
    const [head, ...rest] = pending.queue;
    next = withPending(next, { ...pending, queue: rest });
    const owner = next.players[pending.playerId];
    const found = findInZone(owner, pending.fromZone, head!);
    if (!found) continue;
    const plan = planEffectRush(next, pending.playerId, found.card, pending.requireConditions, pending.ignorePowerCost);
    if (!plan) continue;

    if (plan.kind === "none") {
      // 追加条件「相手は1枚ドローする」を実行してから出す。
      if (plan.opponentDraw) next = applyOpponentDrawCost(next, pending.playerId);
      next = placeUnit(next, head!);
      continue;
    }
    if (plan.kind === "hold") {
      // 追加条件「追加で自軍コマンドをNつホールドする」: ホールドするコマンドを選ぶ（母艦の代替と同じ手続き）。
      const withHold = withPending(next, {
        ...next.pendingEffectRush!,
        current: { instanceId: head!, direction: "up", needed: plan.needed, chosen: [] },
      });
      return openMothershipHold(withHold, plan.holdIds, plan.needed);
    }
    if (plan.kind === "fusion") {
      const applied = applyAllZordFusionMaterials(
        owner,
        next.definitions,
        found.card.cardId,
        found.card.instanceId,
      );
      if (!applied) continue;
      next = placeUnit({ ...next, ...updatePlayer(next, pending.playerId, applied) }, head!);
      continue;
    }

    const withCurrent = withPending(next, {
      ...next.pendingEffectRush!,
      current: {
        instanceId: head!,
        direction: plan.kind,
        needed: plan.needed,
        chosen: [],
      },
    });
    if (plan.kind === "extended") return proceedMaterials(withCurrent);
    const materialsAvailable = plan.materials.length >= plan.needed;
    if (plan.mothershipHoldIds && !materialsAvailable) {
      return openMothershipHold(withCurrent, plan.mothershipHoldIds, plan.needed);
    }
    if (plan.destinationChoice) {
      // ルール: R-ADD-04 — 空きがあっても捨札を選べる。空きが無ければ捨札（RS-120 Q1）。
      // 判定は出すユニットがまだ元の場所にある時点（RS-197 Q4）。
      if (owner.command.length >= COMMAND_ZONE_MAX) {
        return proceedMaterials(
          withPending(withCurrent, {
            ...withCurrent.pendingEffectRush!,
            current: { ...withCurrent.pendingEffectRush!.current!, destination: "discard" },
          }),
        );
      }
      return openChoice(withCurrent, {
        effectId: EFFECT_RUSH_DESTINATION,
        sourceCardId: pending.sourceCardId,
        sourceInstanceId: head,
        kind: "confirm",
        validInstanceIds: plan.mothershipHoldIds ? ["command", "discard", "mothership"] : ["command", "discard"],
        optional: !pending.forced,
      });
    }
    return proceedMaterials(withCurrent);
  }
  return next;
}

/** 効果ラッシュの選択を解決する（applyEffectChoiceSelect から呼ぶ）。 */
export function resolveEffectRushChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState } | { error: string } {
  const choice = state.pendingEffectChoice;
  const pending = state.pendingEffectRush;
  if (!choice || !pending || !isEffectRushChoice(choice)) return { error: "no_pending_choice" };
  if (choice.playerId !== playerId) return { error: "wrong_player" };
  if (!choice.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };

  if (choice.effectId === EFFECT_RUSH_PICK) {
    const picking = pending.picking!;
    const queue = [...pending.queue, instanceId];
    const candidates = picking.candidates.filter((id) => id !== instanceId);
    const remaining = picking.remaining - 1;
    if (remaining > 0 && candidates.length > 0) {
      return {
        state: openPickChoice(
          withPending(state, { ...pending, queue, picking: { candidates, remaining } }),
        ),
      };
    }
    return {
      state: continuePendingEffectRush(
        closeChoice(withPending(state, { ...pending, queue, picking: undefined })),
      ),
    };
  }

  if (choice.effectId === EFFECT_RUSH_DESTINATION && instanceId === "mothership") {
    const current = pending.current!;
    const owner = state.players[pending.playerId];
    const found = findInZone(owner, pending.fromZone, current.instanceId);
    const holdIds = found
      ? effectRushMothershipHoldIds(state, pending.playerId, found.card, current.needed)
      : undefined;
    if (!holdIds) return { error: "invalid_target" };
    return { state: openMothershipHold(closeChoice(state), holdIds, current.needed) };
  }

  if (choice.effectId === EFFECT_RUSH_MOTHERSHIP) {
    // 直接選択（1枚ずつ）。通常は effect_hold の支払い（resolve_command_payment）で解決される。
    const selected = [...(choice.selectedInstanceIds ?? []), instanceId];
    const needed = choice.selectCount ?? 1;
    if (selected.length < needed) {
      return {
        state: {
          ...state,
          pendingEffectChoice: {
            ...choice,
            selectedInstanceIds: selected,
            validInstanceIds: choice.validInstanceIds.filter((id) => id !== instanceId),
          },
        },
      };
    }
    const owner = state.players[pending.playerId];
    const held: GameState = {
      ...state,
      ...updatePlayer(state, pending.playerId, {
        ...owner,
        command: owner.command.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: true } : c)),
      }),
    };
    return { state: continueEffectRushAfterMothershipHold(held) };
  }

  if (choice.effectId === EFFECT_RUSH_DESTINATION) {
    if (instanceId !== "command" && instanceId !== "discard") return { error: "invalid_target" };
    const next = closeChoice(
      withPending(state, { ...pending, current: { ...pending.current!, destination: instanceId } }),
    );
    return { state: proceedMaterials(next) };
  }

  if (choice.effectId === EFFECT_RUSH_ICY_DECK) {
    return { state: resolveIcyDeckPick(state, instanceId) };
  }

  // 素材選択
  const current = pending.current!;
  if (
    choice.effectId === EFFECT_RUSH_MATERIAL &&
    state.players[pending.playerId].rush.some((c) => c.instanceId === instanceId && c.cardId === DENJI_ICY_CARD_ID) &&
    !currentMaterials(state).includes(instanceId)
  ) {
    return { state: activateIcy(closeChoice(state), instanceId) };
  }
  const next = closeChoice(
    withPending(state, { ...pending, current: { ...current, chosen: [...current.chosen, instanceId] } }),
  );
  return { state: proceedMaterials(next) };
}

/** 効果ラッシュの選択をスキップする（「出してもよい」を出さない）。 */
export function skipEffectRushChoice(
  state: GameState,
  playerId: PlayerId,
): { state: GameState } | { error: string } {
  const choice = state.pendingEffectChoice;
  const pending = state.pendingEffectRush;
  if (!choice || !pending || !isEffectRushChoice(choice)) return { error: "no_pending_choice" };
  if (choice.playerId !== playerId) return { error: "wrong_player" };
  if (choice.effectId === EFFECT_RUSH_PICK) {
    return {
      state: continuePendingEffectRush(
        closeChoice(withPending(state, { ...pending, picking: undefined })),
      ),
    };
  }
  // 追加条件の途中: このユニットは出さず、次のユニットへ。
  return {
    state: continuePendingEffectRush(
      closeChoice(withPending(state, { ...pending, current: undefined })),
    ),
  };
}

/**
 * 母艦の代替: ホールドするコマンドを選ぶ（effect_hold の支払いを開いた状態にする）。
 * ルール: R-HOLD-04 — 選んだ時点で適正な対象なら、その後ホールドしても出せる（RS-076 Q3）。
 */
function openMothershipHold(state: GameState, holdIds: string[], needed: number): GameState {
  const pending = state.pendingEffectRush!;
  const withChoice = openChoice(state, {
    effectId: EFFECT_RUSH_MOTHERSHIP,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.current?.instanceId,
    kind: "select_command",
    commandAction: "hold",
    commandFilter: "released",
    selectCount: needed,
    validInstanceIds: holdIds,
    optional: true,
  });
  const payment = buildEffectHoldPayment(withChoice);
  return payment ? { ...withChoice, pendingCommandPayment: payment } : withChoice;
}

/** 母艦の代替でコマンドをホールドしたあと、追加条件を満たしたものとして出す。 */
export function continueEffectRushAfterMothershipHold(state: GameState): GameState {
  const pending = state.pendingEffectRush;
  const current = pending?.current;
  const cleared = closeChoice(state);
  if (!pending || !current) return cleared;
  const next = withPending(cleared, { ...pending, current: undefined });
  return continueAfterPlacement(placeUnit(next, current.instanceId));
}
