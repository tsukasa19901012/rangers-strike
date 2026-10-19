/**
 * ザ・マスクドライダーエクスパンション ベルトコレクションBOX BK-001〜BK-019 のカード固有の効果（cardSpec BK1-001-019 の監査）。
 *
 * - `tryBk1CardEffect`: DSL の grant_keyword から呼ばれる起点（`bk1::cardId::name`。オペレーション）。
 * - `tryResolveBk1Choice` / `trySkipBk1Choice`: このモジュールが開いた選択の解決。
 * ターンの間の決まり（BK-009 ライドされずに出るビークル・BK-013 ミラーライダーの必要パワー・BK-017 加速の追加条件）は、
 * 既存の rules/bkOperationTurnRules.ts の記録を使う（判定は core/power.ts・rules/vehicleRules.ts・rules/rushDeclaration.ts・rules/effectRush.ts）。
 * 選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { KIRIGAKURE_RULE_ID, addTurnFeatureModifier, unitFeatures } from "../addedFeatures";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { requestDrawFromDeck } from "../drawFromDeck";
import { hasRiderInRush } from "../vehicleRules";
import { addAccelerateRushWaiveRule, addMirrorRiderPowerMinusRule, markVehicleBattleWithoutRide } from "../bkOperationTurnRules";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  type ChoiceOutcome,
  base,
  close,
  ctxBase,
  destroyAll,
  effectRushPicked,
  fieldUnits,
  findField,
  isUnitCard,
  logFor,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";

// ---------------------------------------------------------------------------
// 共通

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export const BK1_KEYWORD_PREFIX = "bk1::";

export function isBk1ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveBk1Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipBk1Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

const USABLE_AS_RE = /これは[「｢]([^」｣]+)[」｣]として(?:つかえる|使える)/g;

/**
 * カード名の指定に合うか。区別表記（（2nd）等）を除いた同じカード名か、「これは「○○」として使える」の名前（atwiki/page-1084 Q1・atwiki/page-1739）。
 * 括弧書き（（THE FIRST）等）はカード名に含む（grnrngr/faq-rider-2 SK-002 Q2）。
 */
function hasName(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (!def) return false;
  if (sameCardName(def.name, name)) return true;
  for (const m of (def.text ?? "").matchAll(USABLE_AS_RE)) if (m[1] && sameCardName(m[1], name)) return true;
  return false;
}

function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

function isPrintedSmallUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const d = getDefinition(state.definitions, cardId);
  return d?.type === "unit" && d.size === "S";
}

/** 自軍の場の S ユニット（いまのサイズ）。 */
function ownSmallUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  return fieldUnits(state, playerId).filter((c) => rk1IsSmallNow(state, c));
}

/** 場のユニットを書き換える。 */
function patchField(state: GameState, playerId: PlayerId, instanceId: string, f: (c: CardInstance) => CardInstance): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? f(c) : c));
    return { ...p, rush: set(p.rush), battle: set(p.battle) };
  });
}

/** 選んだ1枚を効果のラッシュで出す（after は出したあとの処理）。 */
function rushPicked(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
  fromZone: "hand" | "deck" | "command" | "operation",
  opts: { requireConditions: boolean; ignorePowerCost?: boolean },
  after?: (state: GameState) => GameState,
): GameState {
  let next = startEffectRush(close(state, pending), {
    playerId: pending.playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${pending.effectId}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone,
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: opts.requireConditions,
    ignorePowerCost: opts.ignorePowerCost,
    mandatory: true,
    forced: true,
  });
  if (after) next = after(next);
  return proceed(next, pending);
}

function draw(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, sourceCardId: string, count: number): GameState {
  if (count <= 0) return state;
  return requestDrawFromDeck(state, playerId, phasePlayerId, { count, sourceCardId }).state;
}

// ---------------------------------------------------------------------------
// 「次の効果から1つ選び発動する」のベルト（BK-001〜003・005〜010・013〜015・017・019）
//  1つ目の効果: search（自軍山札から指定のカード名のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする）、
//  rush（自分の手札から指定のカード名のカードを1枚選び、自軍ラッシュエリアに出してもよい。BK-017 は自軍山札から出してシャッフル。
//  BK-019 は本来の特徴に「魔皇力」を持つカード）。
//  手札・山札から出すのは効果のラッシュ（本文に「ただし…満たすこと」がなければ必要パワー・追加条件は問わない。BK-019 は追加条件だけ満たす。Q1）。
//  選ばなくても山札はシャッフルする（RM-001〜003 と同じ）。

type BeltSpec = { cardId: string; first: "search" | "rush"; hero?: string; second: string };

const BELTS: BeltSpec[] = [
  { cardId: "BK-001", first: "search", hero: "仮面ライダー1号", second: "add_feature" },
  { cardId: "BK-002", first: "search", hero: "仮面ライダーV3", second: "scry" },
  { cardId: "BK-003", first: "search", hero: "仮面ライダーX", second: "discard_to_deck_bottom" },
  { cardId: "BK-005", first: "search", hero: "仮面ライダーストロンガー", second: "sp_1_5" },
  { cardId: "BK-006", first: "search", hero: "スカイライダー", second: "air_battle" },
  { cardId: "BK-007", first: "search", hero: "仮面ライダースーパー1", second: "discard_to_command" },
  { cardId: "BK-008", first: "search", hero: "仮面ライダーZX", second: "command_rush" },
  { cardId: "BK-014", first: "search", hero: "仮面ライダーファイズ", second: "deck_to_command" },
  { cardId: "BK-009", first: "rush", hero: "仮面ライダーBLACK", second: "vehicle_without_ride" },
  { cardId: "BK-010", first: "rush", hero: "仮面ライダーBLACK RX", second: "draw_return" },
  { cardId: "BK-013", first: "rush", hero: "仮面ライダー龍騎", second: "mirror_cost" },
  { cardId: "BK-015", first: "rush", hero: "仮面ライダーブレイド", second: "sp_1_2" },
  { cardId: "BK-017", first: "rush", hero: "仮面ライダーカブトMF", second: "accel_waive" },
  { cardId: "BK-019", first: "rush", second: "release" },
];

const BELT_MODE_EFFECT_ID = "bk1_belt_mode";
const SEARCH_EFFECT_ID = "bk1_belt_search";
const HAND_RUSH_EFFECT_ID = "bk1_belt_hand_rush";
const DECK_RUSH_EFFECT_ID = "bk1_belt_deck_rush";
const MAOU_RUSH_EFFECT_ID = "bk1_belt_maou_rush";
const FEATURE_EFFECT_ID = "bk1_belt_add_feature";
const SCRY_EFFECT_ID = "bk1_belt_scry";
const DECK_BOTTOM_EFFECT_ID = "bk1_belt_discard_to_deck_bottom";
const SP_EFFECT_ID = "bk1_belt_sp";
const AIR_ENEMY_EFFECT_ID = "bk1_belt_air_battle_enemy";
const AIR_OWN_EFFECT_ID = "bk1_belt_air_battle_own";
const TO_COMMAND_EFFECT_ID = "bk1_belt_discard_to_command";
const COMMAND_RUSH_EFFECT_ID = "bk1_belt_command_rush";
const VEHICLE_EFFECT_ID = "bk1_belt_vehicle_without_ride";
const RETURN_EFFECT_ID = "bk1_belt_draw_return";
const RELEASE_EFFECT_ID = "bk1_belt_release";

function beltOf(cardId: string): BeltSpec | undefined {
  return BELTS.find((b) => b.cardId === cardId);
}

function applyBelt(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const belt = beltOf(cardId)!;
    return {
      state: openAfter(state, {
        ...base(ctxBase(ctx), cardId),
        effectId: BELT_MODE_EFFECT_ID,
        kind: "confirm",
        validInstanceIds: [belt.first, belt.second],
        selectCount: 1,
        optional: false,
      }),
      detail: BELT_MODE_EFFECT_ID,
    };
  };
}

/** 次の選択を開く（候補がなければ after をして終える）。 */
function next(
  state: GameState,
  pending: PendingEffectChoice,
  choice: Pick<PendingEffectChoice, "effectId" | "kind" | "validInstanceIds" | "optional"> & Partial<PendingEffectChoice>,
  after?: (state: GameState) => GameState,
): GameState {
  if (choice.validInstanceIds.length === 0) return proceed(after ? after(state) : state, pending);
  return openNext(state, pending, { ...pending, selectedInstanceIds: [], selectCount: 1, ...choice });
}

CHOICE_RESOLVERS[BELT_MODE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const belt = beltOf(pending.sourceCardId)!;
  const cleared = close(state, pending);
  const log = logFor(state, playerId, belt.cardId, `${BELT_MODE_EFFECT_ID}:${mode}`);
  const p = cleared.players[playerId];
  switch (mode) {
    case "search": {
      const ids = p.deck.filter((c) => hasName(cleared, c.cardId, belt.hero!)).map((c) => c.instanceId);
      return { state: next(cleared, pending, { effectId: SEARCH_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: true }, (s) => shuffleDeck(s, playerId)), log };
    }
    case "rush": {
      if (belt.cardId === "BK-017") {
        const ids = p.deck.filter((c) => hasName(cleared, c.cardId, belt.hero!)).map((c) => c.instanceId);
        return { state: next(cleared, pending, { effectId: DECK_RUSH_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: true }, (s) => shuffleDeck(s, playerId)), log };
      }
      if (belt.cardId === "BK-019") {
        const ids = filterEffectRushCandidates(
          cleared,
          playerId,
          "hand",
          p.hand.filter((c) => printedFeatures(cleared, c.cardId).includes("魔皇力")).map((c) => c.instanceId),
          true,
          true,
        );
        return { state: next(cleared, pending, { effectId: MAOU_RUSH_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, optional: true }), log };
      }
      const ids = filterEffectRushCandidates(cleared, playerId, "hand", p.hand.filter((c) => hasName(cleared, c.cardId, belt.hero!)).map((c) => c.instanceId), false);
      return { state: next(cleared, pending, { effectId: HAND_RUSH_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, optional: true }), log };
    }
    case "add_feature":
      return { state: next(cleared, pending, { effectId: FEATURE_EFFECT_ID, kind: "select_unit", validInstanceIds: ownSmallUnits(cleared, playerId).map((c) => c.instanceId), optional: false }), log };
    case "sp_1_5":
    case "sp_1_2":
      return { state: next(cleared, pending, { effectId: SP_EFFECT_ID, kind: "select_unit", validInstanceIds: ownSmallUnits(cleared, playerId).map((c) => c.instanceId), optional: false }), log };
    case "scry":
      return { state: next(cleared, pending, { effectId: SCRY_EFFECT_ID, kind: "confirm", validInstanceIds: p.deck.length > 0 ? ["deck_top", "deck_bottom"] : [], optional: false }), log };
    case "discard_to_deck_bottom":
      return {
        state: next(cleared, pending, { effectId: DECK_BOTTOM_EFFECT_ID, kind: "select_unit", validInstanceIds: p.discard.filter((c) => isPrintedSmallUnit(cleared, c.cardId)).map((c) => c.instanceId), optional: false }),
        log,
      };
    case "air_battle": {
      const enemyId = opponent(playerId);
      const enemies = cleared.players[enemyId].battle
        .filter((c) => {
          const d = getDefinition(cleared.definitions, c.cardId);
          return d?.type === "unit" && unitSizeOf(cleared.definitions, c) === "M" && c.sizeOverride !== "S" && unitFeatures(cleared, enemyId, c).includes("航空機") && selectableEnemy(cleared, playerId, belt.cardId, c);
        })
        .map((c) => c.instanceId);
      const own = ownSmallUnits(cleared, playerId);
      return { state: next(cleared, pending, { effectId: AIR_ENEMY_EFFECT_ID, kind: "select_unit", validInstanceIds: own.length > 0 ? enemies : [], optional: false }), log };
    }
    case "discard_to_command": {
      const ids =
        p.command.length >= COMMAND_ZONE_MAX
          ? []
          : p.discard.filter((c) => isPrintedSmallUnit(cleared, c.cardId) && printedFeatures(cleared, c.cardId).includes("改造人間")).map((c) => c.instanceId);
      return { state: next(cleared, pending, { effectId: TO_COMMAND_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: false }), log };
    }
    case "command_rush": {
      const ids = filterEffectRushCandidates(
        cleared,
        playerId,
        "command",
        p.command.filter((c) => isPrintedSmallUnit(cleared, c.cardId) && printedFeatures(cleared, c.cardId).includes("改造人間")).map((c) => c.instanceId),
        true,
      );
      return { state: next(cleared, pending, { effectId: COMMAND_RUSH_EFFECT_ID, kind: "select_command", validInstanceIds: ids, optional: false }), log };
    }
    case "deck_to_command": {
      // 「1枚ひいて」はドローではなく、山札の上のカードを直接コマンドゾーンに置く。置けない（5枚・山札0枚）なら何もしない。
      const top = p.deck[0];
      if (!top || p.command.length >= COMMAND_ZONE_MAX) return { state: proceed(cleared, pending), log };
      const moved = patchPlayer(cleared, playerId, (pl) => ({ ...pl, deck: pl.deck.slice(1), command: [...pl.command, { ...stripForZone(top), commandHeld: true }] }));
      return { state: proceed(moved, pending), log };
    }
    case "vehicle_without_ride": {
      const ids = p.rush
        .filter((c) => {
          const d = getDefinition(cleared.definitions, c.cardId);
          return d?.type === "vehicle" && unitSizeOf(cleared.definitions, c) === "S" && !hasRiderInRush(p, c.instanceId);
        })
        .map((c) => c.instanceId);
      return { state: next(cleared, pending, { effectId: VEHICLE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: false }), log };
    }
    case "draw_return": {
      const drawn = requestDrawFromDeck(cleared, playerId, pending.phasePlayerId, { count: 1, sourceCardId: belt.cardId });
      if (drawn.pending || drawn.drawn === false) return { state: proceed(drawn.state, pending), log };
      const ids = drawn.state.players[playerId].hand.map((c) => c.instanceId);
      return { state: next(drawn.state, pending, { effectId: RETURN_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, optional: false }), log };
    }
    case "mirror_cost":
      return { state: proceed(patchPlayer(cleared, playerId, (pl) => addMirrorRiderPowerMinusRule(pl, belt.cardId)), pending), log };
    case "accel_waive":
      return { state: proceed(patchPlayer(cleared, playerId, (pl) => addAccelerateRushWaiveRule(pl, belt.cardId)), pending), log };
    case "release": {
      const ids = ownSmallUnits(cleared, playerId)
        .filter((c) => c.commandHeld)
        .map((c) => c.instanceId);
      return { state: next(cleared, pending, { effectId: RELEASE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: false }), log };
    }
    default:
      return { error: "invalid_target" };
  }
};

CHOICE_RESOLVERS[SEARCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId)!;
  let n = close(state, pending);
  n = patchPlayer(n, playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  n = shuffleDeck(n, playerId);
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${SEARCH_EFFECT_ID}:reveal:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[SEARCH_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

CHOICE_RESOLVERS[HAND_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: rushPicked(state, pending, instanceId, "hand", { requireConditions: false }), log: logFor(state, playerId, pending.sourceCardId, `${HAND_RUSH_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[HAND_RUSH_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[MAOU_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: rushPicked(state, pending, instanceId, "hand", { requireConditions: true, ignorePowerCost: true }),
    log: logFor(state, playerId, pending.sourceCardId, `${MAOU_RUSH_EFFECT_ID}:rush`),
  };
};
CHOICE_SKIPPERS[MAOU_RUSH_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[DECK_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: effectRushPicked(state, pending, playerId, instanceId, "deck", (s) => shuffleDeck(s, playerId)),
    log: logFor(state, playerId, pending.sourceCardId, `${DECK_RUSH_EFFECT_ID}:rush`),
  };
};
CHOICE_SKIPPERS[DECK_RUSH_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

CHOICE_RESOLVERS[FEATURE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const n = patchPlayer(close(state, pending), playerId, (p) => addTurnFeatureModifier(p, KIRIGAKURE_RULE_ID, { instanceId, features: ["仮面ライダー"] }, pending.sourceCardId));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${FEATURE_EFFECT_ID}:${instanceId}`) };
};

CHOICE_RESOLVERS[SP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const value = pending.sourceCardId === "BK-005" ? "1/5" : "1/2";
  const n = patchField(close(state, pending), playerId, instanceId, (c) => ({ ...c, spOverride: value }));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${SP_EFFECT_ID}:${value}:${instanceId}`) };
};

CHOICE_RESOLVERS[SCRY_EFFECT_ID] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  let n = close(state, pending);
  if (where === "deck_bottom") n = patchPlayer(n, playerId, (p) => (p.deck.length > 0 ? { ...p, deck: [...p.deck.slice(1), p.deck[0]!] } : p));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${SCRY_EFFECT_ID}:${where}`) };
};

CHOICE_RESOLVERS[DECK_BOTTOM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const n = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), deck: [...p.deck, stripForZone(card)] }));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${DECK_BOTTOM_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

CHOICE_RESOLVERS[TO_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const n = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    command: [...p.command, { ...stripForZone(card), commandHeld: true }],
  }));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${TO_COMMAND_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

CHOICE_RESOLVERS[COMMAND_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: rushPicked(state, pending, instanceId, "command", { requireConditions: true }), log: logFor(state, playerId, pending.sourceCardId, `${COMMAND_RUSH_EFFECT_ID}:rush`) };
};

CHOICE_RESOLVERS[VEHICLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const n = patchPlayer(close(state, pending), playerId, (p) => markVehicleBattleWithoutRide(p, instanceId));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${VEHICLE_EFFECT_ID}:${instanceId}`) };
};

CHOICE_RESOLVERS[RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  const n = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${RETURN_EFFECT_ID}:deck_top`) };
};

CHOICE_RESOLVERS[RELEASE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const n = patchField(close(state, pending), playerId, instanceId, (c) => ({ ...c, commandHeld: false, registerHeld: undefined }));
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${RELEASE_EFFECT_ID}:${instanceId}`) };
};

// BK-006 トルネード ◎2つ目: 敵軍バトルエリアの「航空機」の M ユニット → 自軍 S ユニット → 選んだ2体でバトル（BP の低い方、同じなら両方を撃破。R-BTL-02）。
CHOICE_RESOLVERS[AIR_ENEMY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const own = ownSmallUnits(cleared, playerId).map((c) => c.instanceId);
  return {
    state: openNext(cleared, pending, { ...pending, effectId: AIR_OWN_EFFECT_ID, kind: "select_unit", validInstanceIds: own, selectedInstanceIds: [], selectCount: 1, optional: false, bk1Meta: { enemy: instanceId } }),
    log: logFor(state, playerId, pending.sourceCardId, `${AIR_ENEMY_EFFECT_ID}:${instanceId}`),
  };
};

CHOICE_RESOLVERS[AIR_OWN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const enemyInstanceId = pending.bk1Meta?.enemy;
  const cleared = close(state, pending);
  const enemy = enemyInstanceId ? cleared.players[enemyId].battle.find((c) => c.instanceId === enemyInstanceId) : undefined;
  const own = findField(cleared, playerId, instanceId);
  if (!enemy || !own) return { state: proceed(cleared, pending) };
  const bpOwn = effectiveBp(cleared, playerId, own);
  const bpEnemy = effectiveBp(cleared, enemyId, enemy);
  const losers: string[] = [];
  if (bpEnemy <= bpOwn) losers.push(enemy.instanceId);
  if (bpOwn <= bpEnemy) losers.push(own.instanceId);
  const n = destroyAll(cleared, pendingBase(pending), pending.sourceCardId, `${AIR_OWN_EFFECT_ID}_battle`, losers);
  return { state: proceed(n, pending), log: logFor(state, playerId, pending.sourceCardId, `${AIR_OWN_EFFECT_ID}:${bpOwn}vs${bpEnemy}`) };
};

// ---------------------------------------------------------------------------
// BK-004 コンドラー
// 「自軍Sユニットを1体選ぶ。このターン、選んだユニットはBP+1000される。選んだユニットが「仮面ライダーアマゾン」なら、さらにBP+4000される。」（atwiki/page-712）
// BP の増加はターンの終わりに消える補正（bpModifier）。

const CONDORER_EFFECT_ID = "bk004_condorer";

function applyCondorer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = ownSmallUnits(state, ctx.playerId).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${CONDORER_EFFECT_ID}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "BK-004"), effectId: CONDORER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: CONDORER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[CONDORER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = findField(state, playerId, instanceId);
  const amount = 1000 + (card && hasName(state, card.cardId, "仮面ライダーアマゾン") ? 4000 : 0);
  const n = patchField(close(state, pending), playerId, instanceId, (c) => ({ ...c, bpModifier: (c.bpModifier ?? 0) + amount }));
  return { state: proceed(n, pending), log: logFor(state, playerId, "BK-004", `${CONDORER_EFFECT_ID}:bp+${amount}`) };
};

// ---------------------------------------------------------------------------
// BK-011 アークル・BK-012 オルタリング・BK-018 デンオウベルト
// 「自分の手札（BK-018: 自軍山札）か、自軍常駐置き場でオモテ向きになっているカードの中から、本来の特徴に「X」を持つユニットカードを1枚選び、
//  ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、手札から選んだ場合は1枚ドローする
//  （BK-018: 山札から選んだ場合は山札をシャッフルする）。」（atwiki/page-727・page-728・page-724）
// 常駐置き場のカードは、そこからの効果のラッシュとして出す。選べるカードがあれば見送れない。

type RecruitSpec = { cardId: string; feature: string; from: "hand" | "deck" };
const RECRUITS: Record<string, RecruitSpec> = {
  "BK-011": { cardId: "BK-011", feature: "アマダム", from: "hand" },
  "BK-012": { cardId: "BK-012", feature: "賢者の石", from: "hand" },
  "BK-018": { cardId: "BK-018", feature: "DEN-O", from: "deck" },
};
const RECRUIT_EFFECT_ID = "bk1_recruit";

function originalFeatureUnit(state: Pick<GameState, "definitions">, cardId: string, feature: string): boolean {
  return isUnitCard(state, cardId) && printedFeatures(state, cardId).includes(feature);
}

function applyRecruit(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const spec = RECRUITS[cardId]!;
    const p = state.players[ctx.playerId];
    const fromCards = spec.from === "hand" ? p.hand : p.deck;
    const main = filterEffectRushCandidates(state, ctx.playerId, spec.from, fromCards.filter((c) => originalFeatureUnit(state, c.cardId, spec.feature)).map((c) => c.instanceId), true, true);
    const resident = filterEffectRushCandidates(
      state,
      ctx.playerId,
      "operation",
      p.operation.filter((c) => !c.faceDown && originalFeatureUnit(state, c.cardId, spec.feature)).map((c) => c.instanceId),
      true,
      true,
    );
    const ids = [...main, ...resident];
    if (ids.length === 0) {
      const shuffled = spec.from === "deck" ? shuffleDeck(state, ctx.playerId) : state;
      return { state: shuffled, detail: `${RECRUIT_EFFECT_ID}:no_targets` };
    }
    return {
      state: openAfter(state, {
        ...base(ctxBase(ctx), cardId),
        effectId: RECRUIT_EFFECT_ID,
        kind: spec.from === "hand" ? "select_hand" : "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: false,
      }),
      detail: RECRUIT_EFFECT_ID,
    };
  };
}

CHOICE_RESOLVERS[RECRUIT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const spec = RECRUITS[pending.sourceCardId]!;
  const p = state.players[playerId];
  const fromMain = (spec.from === "hand" ? p.hand : p.deck).some((c) => c.instanceId === instanceId);
  const zone = fromMain ? spec.from : "operation";
  const after = (s: GameState): GameState => {
    if (!fromMain) return s;
    return spec.from === "hand" ? draw(s, playerId, pending.phasePlayerId, spec.cardId, 1) : shuffleDeck(s, playerId);
  };
  return {
    state: rushPicked(state, pending, instanceId, zone, { requireConditions: true, ignorePowerCost: true }, after),
    log: logFor(state, playerId, spec.cardId, `${RECRUIT_EFFECT_ID}:${zone}`),
  };
};

// ---------------------------------------------------------------------------
// BK-016 火炎鼓装備帯
// 「特徴「猛士」を持つ自軍ユニット2体につき1枚ドローする。」（atwiki/page-729）
// 自軍エリア（ラッシュエリア・バトルエリア）のユニットのいまの特徴で数える。

function applyKaenko(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const count = fieldUnits(state, ctx.playerId).filter((c) => unitFeatures(state, ctx.playerId, c).includes("猛士")).length;
  const n = Math.floor(count / 2);
  return { state: draw(state, ctx.playerId, ctx.phasePlayerId, "BK-016", n), detail: `bk016_kaenko:draw:${n}` };
}

// ---------------------------------------------------------------------------
// 起点

const BK1_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "BK-001::typhoon": applyBelt("BK-001"),
  "BK-002::double_typhoon": applyBelt("BK-002"),
  "BK-003::ridol": applyBelt("BK-003"),
  "BK-004::condorer": applyCondorer,
  "BK-005::electrer": applyBelt("BK-005"),
  "BK-006::tornado": applyBelt("BK-006"),
  "BK-007::cyclode": applyBelt("BK-007"),
  "BK-008::zx_belt": applyBelt("BK-008"),
  "BK-009::king_stone": applyBelt("BK-009"),
  "BK-010::sunriser": applyBelt("BK-010"),
  "BK-011::arcle": applyRecruit("BK-011"),
  "BK-012::altering": applyRecruit("BK-012"),
  "BK-013::v_buckle": applyBelt("BK-013"),
  "BK-014::faiz_driver": applyBelt("BK-014"),
  "BK-015::blay_buckle": applyBelt("BK-015"),
  "BK-016::kaenko": applyKaenko,
  "BK-017::kabuto_zecter": applyBelt("BK-017"),
  "BK-018::den_o_belt": applyRecruit("BK-018"),
  "BK-019::kivat_belt": applyBelt("BK-019"),
};

export function tryBk1CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(BK1_KEYWORD_PREFIX)) return null;
  const handler = BK1_KEYWORDS[keyword.slice(BK1_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
