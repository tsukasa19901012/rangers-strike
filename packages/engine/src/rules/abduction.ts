/**
 * RS-322 ベン・G【人身略取】の後半:
 * 「そうしたとき、相手は自分自身がそのカードの持ち主であるかのように、そのカードの追加条件を可能なら満たす。」
 *
 * ルール: R-ADD-08 — 母艦（ジャガーバルカン等）の代替手段で満たせるなら、強制の追加条件は満たさなければならない。
 *   母艦の置き換えは足りないSユニットの分だけに使える（RS-076 Q1・RS-105 Q1）。
 */
import { getZordCondition, MOTHERSHIP_CONFIG } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingChase, PlayerId, PlayerState } from "../types/game";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { FEATURE_KEYWORDS } from "../dsl/featureKeywords";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { buildPendingChaseFromIntent, listValidChaseVehicleIds } from "../keywords/chase";
import { applyKuugaStay, filthyAirActive, kuugaStayCandidates } from "./legend1/otherLinesNamedEffects";
import { COMMAND_ZONE_MAX } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { collectZordMaterials, applyZordMaterial } from "./zord";
import {
  applyMothershipHolds,
  canUseMothershipForZordRush,
  collectMothershipEligibleCommands,
} from "./mothership";

export const ABDUCTION_MATERIAL_EFFECT_ID = "abduction_material";
export const ABDUCTION_DESTINATION_EFFECT_ID = "abduction_destination";
/** XG2-042 仮面ライダーディケイドCF の※「その場に留まる」（捨札にするパワーの選択。任意）。 */
export const ABDUCTION_DECADE_STAY_EFFECT_ID = "abduction_decade_stay";
/** SK-004 仮面ライダークウガUF【凄まじき戦士】「その場に留める」（捨札にする重ねたカードの選択。強制）。 */
export const ABDUCTION_KUUGA_STAY_EFFECT_ID = "abduction_kuuga_stay";
const MOTHERSHIP_OPTION = "mothership";

export function isAbductionChoice(effectId: string | undefined): boolean {
  return (
    effectId === ABDUCTION_MATERIAL_EFFECT_ID ||
    effectId === ABDUCTION_DESTINATION_EFFECT_ID ||
    effectId === ABDUCTION_DECADE_STAY_EFFECT_ID ||
    effectId === ABDUCTION_KUUGA_STAY_EFFECT_ID
  );
}

type AbductionContext = {
  /** 追加条件を満たす側（ベン・G の相手）。 */
  payerId: PlayerId;
  phasePlayerId: PlayerId;
  /** 捨札にした M ユニットのカード ID。 */
  cardId: string;
  remaining: number;
};

function neededUnits(state: GameState, cardId: string): number {
  const count = getDefinition(state.definitions, cardId)?.rushAdditionalCondition?.unitCount;
  return typeof count === "number" && count > 0 ? count : 1;
}

function materialsFor(state: GameState, ctx: AbductionContext): string[] {
  return collectZordMaterials(
    state.players[ctx.payerId],
    state.definitions,
    ctx.cardId,
    "",
  ).map((c) => c.instanceId);
}

function mothershipCommands(state: GameState, ctx: AbductionContext): string[] {
  const payer = state.players[ctx.payerId];
  const kind = canUseMothershipForZordRush(state.definitions, payer, ctx.cardId);
  if (!kind) return [];
  return collectMothershipEligibleCommands(
    payer,
    state.definitions,
    kind.commandCategory,
  )
    .filter((e) => e.zone === "command")
    .map((e) => e.card.instanceId);
}

/** 【母艦】で S ユニット1体の代わりにコマンドをホールドする（RS-260 は山札の上から1枚をパワーゾーンにも置く）。 */
function holdCommand(state: GameState, ctx: AbductionContext, instanceId: string): PlayerState {
  const player = state.players[ctx.payerId];
  const ability = canUseMothershipForZordRush(state.definitions, player, ctx.cardId);
  const applied = ability ? applyMothershipHolds(player, state.definitions, [instanceId], ability) : null;
  if (applied) return applied;
  return {
    ...player,
    command: player.command.map((c) =>
      c.instanceId === instanceId ? { ...c, commandHeld: true, mothershipHold: true } : c,
    ),
  };
}

function decode(state: GameState): AbductionContext | null {
  const pending = state.pendingEffectChoice;
  const meta = pending?.abductionMeta;
  if (!pending || !meta) return null;
  return { ...meta, phasePlayerId: pending.phasePlayerId };
}

function openChoice(
  state: GameState,
  ctx: AbductionContext,
  effectId: string,
  validInstanceIds: string[],
  sourceInstanceId?: string,
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      playerId: ctx.payerId,
      effectId,
      sourceCardId: "RS-322",
      sourceInstanceId,
      kind:
        effectId === ABDUCTION_DESTINATION_EFFECT_ID
          ? "confirm"
          : effectId === ABDUCTION_DECADE_STAY_EFFECT_ID
            ? "select_power"
            : "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds,
      selectedInstanceIds: [],
      optional: effectId === ABDUCTION_DECADE_STAY_EFFECT_ID,
      abductionMeta: { payerId: ctx.payerId, cardId: ctx.cardId, remaining: ctx.remaining },
    },
    activePlayer: ctx.payerId,
  };
}

function finish(state: GameState, ctx: AbductionContext): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: ctx.phasePlayerId };
}

/** 残りの追加条件を進める（選ぶ必要が無ければ自動）。 */
function proceed(state: GameState, ctx: AbductionContext): GameState {
  let next = state;
  let current = ctx;
  for (let guard = 0; guard < 8 && current.remaining > 0; guard += 1) {
    const materials = materialsFor(next, current);
    const motherships = mothershipCommands(next, current);
    if (materials.length === 0) {
      // Sユニットが足りない分は母艦で代える（可能なら満たす）。
      const commandId = motherships[0];
      if (!commandId) break;
      next = {
        ...next,
        ...updatePlayer(next, current.payerId, holdCommand(next, current, commandId)),
      };
      current = { ...current, remaining: current.remaining - 1 };
      continue;
    }
    const options = motherships.length > 0 ? [...materials, MOTHERSHIP_OPTION] : materials;
    return openChoice(next, current, ABDUCTION_MATERIAL_EFFECT_ID, options);
  }
  return finish(next, current);
}

/** ベン・G の効果で手札の M ユニットを捨札にした後に呼ぶ。 */
export function startAbductionCondition(
  state: GameState,
  benOwnerId: PlayerId,
  discardedCardId: string,
  phasePlayerId: PlayerId,
): GameState {
  const condition = getZordCondition(discardedCardId);
  if (!condition) return state;
  const ctx: AbductionContext = {
    payerId: opponent(benOwnerId),
    phasePlayerId,
    cardId: discardedCardId,
    remaining: neededUnits(state, discardedCardId),
  };
  // 「可能なら満たす」— 追加条件をすべて満たせないなら、満たす必要はない（S ユニットも送らない）。
  // 出典: grnrngr/faq-card-5 RS-322（自軍 S ユニットが1体しかなければバイオジェット2号の条件は満たさない）。
  // 母艦（ジャガーバルカン等）で代えられるなら満たす（R-ADD-08、faq-card-5 RS-260）。
  if (mothershipCommands(state, ctx).length === 0 && materialsFor(state, ctx).length < ctx.remaining) {
    return state;
  }
  const next = proceed(state, ctx);
  return next.pendingEffectChoice ? next : finish(next, ctx);
}

function applyMaterial(
  state: GameState,
  ctx: AbductionContext,
  materialId: string,
  destination: "command" | "discard",
): GameState {
  const payer = state.players[ctx.payerId];
  const applied = applyZordMaterial(payer, state.definitions, ctx.cardId, "", materialId, destination);
  if (!applied) return state;
  return { ...state, ...updatePlayer(state, ctx.payerId, applied) };
}

/** 自軍エリアの S ユニット（追加条件の素材）の位置。 */
function locateMaterial(state: GameState, ctx: AbductionContext, materialId: string): { zone: "battle" | "rush"; card: CardInstance } | null {
  const payer = state.players[ctx.payerId];
  for (const zone of ["battle", "rush"] as const) {
    const card = payer[zone].find((c) => c.instanceId === materialId);
    if (card) return { zone, card };
  }
  return null;
}

/** XG2-042 の※で捨札にできるパワー（オモテ向きの「仮面ライダー」）。【汚い大気】の下では発動できない。 */
function decadeStayPowers(state: GameState, ctx: AbductionContext, card: CardInstance): string[] {
  if (!cardHasGrantKeyword(card.cardId, FEATURE_KEYWORDS.registerStayKamenRider)) return [];
  if (filthyAirActive(state)) return [];
  return state.players[ctx.payerId].power
    .filter((c) => !c.faceDown && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("仮面ライダー"))
    .map((c) => c.instanceId);
}

/**
 * 追加条件で S ユニットを捨札にするとき（「ユニットでなくなるとき」）の応答。その場に留まった・乗り換えたなら、まだ場にいるので
 * 追加条件は満たせるものとして続行する（atwiki/page-431 Q4〜Q6）。応答がなければ null。
 * - RM-018 等のチェイス（ライド中にユニットでなくなるとき、ビークルを捨札にして乗り換えてもよい）。
 * - XG2-042 仮面ライダーディケイドCF の※（オモテ向きの「仮面ライダー」のパワーを捨札にすれば留まる）。
 * - SK-004 仮面ライダークウガUF【凄まじき戦士】（重ねたウラ向きのカードを1枚捨札にして留める。強制）。
 */
function tryMaterialLeaveResponse(state: GameState, ctx: AbductionContext, materialId: string): GameState | null {
  const found = locateMaterial(state, ctx, materialId);
  if (!found) return null;
  const { zone, card } = found;
  if (card.mountedOnInstanceId && cardHasKeyword(state.definitions, card.cardId, "chase", { state, playerId: ctx.payerId })) {
    const chase = buildPendingChaseFromIntent(state, {
      ownerPlayerId: ctx.payerId,
      instanceId: materialId,
      fromZone: zone,
      toZone: "discard",
      leavingCardId: card.cardId,
      phasePlayerId: ctx.phasePlayerId,
      notDestruction: true,
    });
    if (chase && listValidChaseVehicleIds(state, chase).length > 0) {
      return {
        ...state,
        pendingEffectChoice: undefined,
        pendingChase: { ...chase, abductionResume: { payerId: ctx.payerId, cardId: ctx.cardId, remaining: ctx.remaining } },
        activePlayer: ctx.payerId,
      };
    }
  }
  const powers = decadeStayPowers(state, ctx, card);
  if (powers.length > 0) return openChoice(state, ctx, ABDUCTION_DECADE_STAY_EFFECT_ID, powers, materialId);
  const kuuga = kuugaStayCandidates(state, ctx.payerId, card);
  if (kuuga.length === 1) {
    return proceed(applyKuugaStay(state, ctx.payerId, materialId, kuuga[0]!), ctx);
  }
  if (kuuga.length > 1) return openChoice(state, ctx, ABDUCTION_KUUGA_STAY_EFFECT_ID, kuuga, materialId);
  return null;
}

/** チェイスの応答の後: 乗り換えたなら（まだ場にいる）同じ残り数で、見送ったなら捨札にして続行する。 */
export function resumeAbductionAfterChase(state: GameState, chase: PendingChase, passed: boolean): GameState {
  const resume = chase.abductionResume!;
  const ctx: AbductionContext = { ...resume, phasePlayerId: chase.phasePlayerId };
  const cleared: GameState = { ...state, pendingChase: undefined };
  if (!passed) return finishIfIdle(proceed(cleared, ctx), ctx);
  const next = applyMaterial(cleared, ctx, chase.chaserInstanceId, "discard");
  return finishIfIdle(proceed(next, { ...ctx, remaining: ctx.remaining - 1 }), ctx);
}

function finishIfIdle(state: GameState, ctx: AbductionContext): GameState {
  return state.pendingEffectChoice || state.pendingChase ? state : finish(state, ctx);
}

/** 任意の選択（ディケイドCF の※）を見送る: そのまま捨札にして続行する。 */
export function skipAbductionChoice(state: GameState, playerId: PlayerId): { state: GameState; log?: string } | { error: string } | null {
  const pending = state.pendingEffectChoice;
  const ctx = decode(state);
  if (!pending || !ctx || pending.effectId !== ABDUCTION_DECADE_STAY_EFFECT_ID) return null;
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  const next = applyMaterial(state, ctx, pending.sourceInstanceId!, "discard");
  return { state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }) };
}

export function resolveAbductionChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; log?: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  const ctx = decode(state);
  if (!pending || !ctx || !isAbductionChoice(pending.effectId)) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };

  const condition = getZordCondition(ctx.cardId);
  if (pending.effectId === ABDUCTION_DECADE_STAY_EFFECT_ID) {
    // パワーを捨札にして留まる（まだ場にいるので、追加条件は満たせるものとして続行する。atwiki/page-431 Q5）。
    const payer = state.players[ctx.payerId];
    const paid = payer.power.find((c) => c.instanceId === instanceId);
    if (!paid) return { error: "invalid_target" };
    const next = {
      ...state,
      ...updatePlayer(state, ctx.payerId, {
        ...payer,
        power: payer.power.filter((c) => c.instanceId !== instanceId),
        discard: [...payer.discard, { instanceId: paid.instanceId, cardId: paid.cardId }],
      }),
    };
    return { state: proceed(next, ctx) };
  }
  if (pending.effectId === ABDUCTION_KUUGA_STAY_EFFECT_ID) {
    // 【凄まじき戦士】でその場に留める（atwiki/page-431 Q6）。
    return { state: proceed(applyKuugaStay(state, ctx.payerId, pending.sourceInstanceId!, instanceId), ctx) };
  }
  if (pending.effectId === ABDUCTION_DESTINATION_EFFECT_ID) {
    const materialId = pending.sourceInstanceId!;
    const next = applyMaterial(state, ctx, materialId, instanceId as "command" | "discard");
    return { state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }) };
  }

  if (instanceId === MOTHERSHIP_OPTION) {
    const commandId = mothershipCommands(state, ctx)[0];
    if (!commandId) return { error: "invalid_target" };
    const next = {
      ...state,
      ...updatePlayer(state, ctx.payerId, holdCommand(state, ctx, commandId)),
    };
    return { state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }) };
  }

  const payer = state.players[ctx.payerId];
  if (
    condition === "send_s_unit_to_command_or_discard" &&
    payer.command.length < COMMAND_ZONE_MAX
  ) {
    return {
      state: openChoice(state, ctx, ABDUCTION_DESTINATION_EFFECT_ID, ["command", "discard"], instanceId),
    };
  }
  // 「ユニットでなくなるとき」の応答（チェイス・その場に留まる）があれば先に処理する。
  const responded = tryMaterialLeaveResponse({ ...state, pendingEffectChoice: undefined }, ctx, instanceId);
  if (responded) return { state: finishIfIdle(responded, ctx) };
  const next = applyMaterial(state, ctx, instanceId, "discard");
  return {
    state: proceed(next, { ...ctx, remaining: ctx.remaining - 1 }),
    log: buildLogEntry(
      playerId,
      "resolve_effect_choice",
      "RS-322",
      state.definitions,
      `abduction:${cardName(state.definitions, ctx.cardId)}`,
    ),
  };
}
