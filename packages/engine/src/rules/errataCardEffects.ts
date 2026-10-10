/**
 * エラッタ・公式回答（docs/rules/08-errata.md）に合わせて実装したカード固有の効果。
 *
 * - `tryErrataCardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveErrataChoice`: このモジュールが開いた選択（effectId）の解決。
 */
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../dsl/grantKeyword";
import {
  cardCategories,
  cardName,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { sameCardName } from "../core/cardNames";
import { opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import {
  applyUnitLeave,
  openEffectChoice,
  type ChoiceOutcome,
} from "./pendingChoices";

// ---------------------------------------------------------------------------
// 共通

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function fieldUnits(player: PlayerState): CardInstance[] {
  return [...player.rush, ...player.battle];
}

/** 場のユニット（ラッシュ／バトル）をホールド状態にする。 */
export function holdFieldUnit(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const owner = state.players[ownerId];
  const mark = (c: CardInstance) =>
    c.instanceId === instanceId ? { ...c, commandHeld: true } : c;
  return {
    ...state,
    ...updatePlayer(state, ownerId, {
      ...owner,
      rush: owner.rush.map(mark),
      battle: owner.battle.map(mark),
    }),
  };
}

function categoryKey(state: GameState, cardId: string): string {
  const def = getDefinition(state.definitions, cardId);
  return def ? [...cardCategories(def)].sort().join("+") : "";
}

// ---------------------------------------------------------------------------
// RK-125 仮面ライダーブレイド【ブレイラウザー】

const BLAY_SHOW = "blay_rouzer_show";
const BLAY_HOLD = "blay_rouzer_hold";
const BLAY_DESTROY = "blay_rouzer_destroy";

/**
 * ルール: R-ERR-RK125 — 自分の手札を3枚選び見せてもよい（必ず3枚。手札が3枚未満なら選べない）。
 * そうしたとき敵軍Sユニットを1体ホールド。見せたカードのカテゴリがすべて同じなら敵軍バトルエリアの S を撃破。
 */
function beginBlayRouzer(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const hand = state.players[ctx.playerId].hand;
  if (hand.length < 3) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: BLAY_SHOW,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_hand",
    validInstanceIds: hand.map((c) => c.instanceId),
    selectCount: 3,
    optional: true,
  });
}

function enemySUnitsToHold(state: GameState, playerId: PlayerId): string[] {
  const enemy = state.players[opponent(playerId)];
  return fieldUnits(enemy)
    .filter((c) => !c.commandHeld && isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

function enemyBattleSUnits(state: GameState, playerId: PlayerId): string[] {
  return state.players[opponent(playerId)].battle
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

function resolveBlayRouzer(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };

  if (pending.effectId === BLAY_SHOW) {
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    if (selected.length < (pending.selectCount ?? 3)) {
      return {
        state: {
          ...state,
          pendingEffectChoice: {
            ...pending,
            selectedInstanceIds: selected,
            validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)),
          },
        },
      };
    }
    const hand = state.players[playerId].hand;
    const keys = selected.map((id) => {
      const card = hand.find((c) => c.instanceId === id);
      return card ? categoryKey(state, card.cardId) : "";
    });
    const sameCategories = keys.every((k) => k !== "" && k === keys[0]);
    const holdTargets = enemySUnitsToHold(state, playerId);
    const shownLog = logFor(
      state,
      playerId,
      pending.sourceCardId,
      `${BLAY_SHOW}:${selected
        .map((id) => cardName(state.definitions, hand.find((c) => c.instanceId === id)?.cardId ?? id))
        .join(",")}`,
    );
    const cleared = clearPending(state, pending.phasePlayerId);
    const next = holdTargets.length
      ? openEffectChoice(cleared, {
          ...pending,
          effectId: BLAY_HOLD,
          kind: "select_unit",
          validInstanceIds: holdTargets,
          selectedInstanceIds: sameCategories ? ["same_categories"] : [],
          selectCount: 1,
          optional: false,
        })
      : sameCategories
        ? openDestroyStep(cleared, pending, playerId)
        : cleared;
    return { state: next, log: shownLog };
  }

  if (pending.effectId === BLAY_HOLD) {
    const enemyId = opponent(playerId);
    const held = holdFieldUnit(state, enemyId, instanceId);
    const sameCategories = (pending.selectedInstanceIds ?? []).includes("same_categories");
    const cleared = clearPending(held, pending.phasePlayerId);
    const next = sameCategories ? openDestroyStep(cleared, pending, playerId) : cleared;
    return { state: next, log: logFor(state, playerId, pending.sourceCardId, `${BLAY_HOLD}:${instanceId}`) };
  }

  // BLAY_DESTROY
  const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: clearPending(leave.state, pending.phasePlayerId),
    log: logFor(state, playerId, pending.sourceCardId, `${BLAY_DESTROY}:${instanceId}`),
  };
}

function openDestroyStep(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  playerId: PlayerId,
): GameState {
  const targets = enemyBattleSUnits(state, playerId);
  if (targets.length === 0) return state;
  return openEffectChoice(state, {
    ...pending,
    effectId: BLAY_DESTROY,
    kind: "select_unit",
    validInstanceIds: targets,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    unitDestination: "discard",
  });
}

// ---------------------------------------------------------------------------
// RK-142〜145 イマジン（パワーゾーンでオモテ向きの効果）と RK-168 電王CF【てんこもりだぜ！】

/** 通常: パワーゾーンのイマジンを捨札にして効果を発動する（既存 effectId を維持）。 */
export const IMAGIN_DISCARD_EFFECT = "power_faceup_sp1_grant";
/** 電王CF: 捨札にせずに発動する（1枚につき1度ずつ）。 */
const IMAGIN_TENKOMORI_EFFECT = "tenkomori_imagin";
const IMAGIN_URATAROS_SEND = "imagin_urataros_send";
const IMAGIN_RYUTAROS_DESTROY = "imagin_ryutaros_destroy";

const IMAGIN_NAMES = ["モモタロス", "ウラタロス", "キンタロス", "リュウタロス"] as const;

function imaginNameOf(state: GameState, cardId: string): (typeof IMAGIN_NAMES)[number] | null {
  const name = getDefinition(state.definitions, cardId)?.name;
  return IMAGIN_NAMES.find((n) => sameCardName(n, name)) ?? null;
}

/**
 * 特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たときのイマジン効果。
 * - 通常（各イマジン本文）: 自軍バトルフェイズ中、これを捨札にしてもよい。
 * - ルール: R-ERR-RK168 — 電王CF が自軍ターン中に出たときは、捨札にせずに1枚につき1度ずつ発動できる。
 */
export function openImaginPowerChoice(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
  phasePlayerId: PlayerId,
  powerIds: string[],
): GameState | null {
  const tenkomori = entering.cardId === "RK-168" && phasePlayerId === playerId;
  const valid = powerIds.filter((id) => {
    const card = state.players[playerId].power.find((c) => c.instanceId === id);
    return !!card && !!imaginNameOf(state, card.cardId);
  });
  if (valid.length === 0) return null;
  if (!tenkomori && !(state.phase === "battle" && phasePlayerId === playerId)) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: tenkomori ? IMAGIN_TENKOMORI_EFFECT : IMAGIN_DISCARD_EFFECT,
    sourceCardId: tenkomori ? "RK-168" : "RK-142",
    sourceInstanceId: entering.instanceId,
    phasePlayerId,
    kind: "select_power",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    selectCount: 1,
    optional: true,
  });
}

function updateEntering(
  state: GameState,
  playerId: PlayerId,
  instanceId: string | undefined,
  patch: (c: CardInstance) => CardInstance,
): GameState {
  if (!instanceId) return state;
  const player = state.players[playerId];
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle: player.battle.map((c) => (c.instanceId === instanceId ? patch(c) : c)),
    }),
  };
}

/** 電王CF の残り（まだ発動していないイマジン）があれば選択を開き直す。 */
function continueTenkomori(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  usedId: string,
): GameState {
  if (pending.effectId !== IMAGIN_TENKOMORI_EFFECT && !pending.selectedInstanceIds?.includes("tenkomori")) {
    return state;
  }
  const remaining = (pending.viewedInstanceIds ?? []).filter(
    (id) =>
      id !== usedId &&
      state.players[pending.playerId].power.some((c) => c.instanceId === id && !c.faceDown),
  );
  if (remaining.length === 0) return state;
  return openEffectChoice(state, {
    ...pending,
    effectId: IMAGIN_TENKOMORI_EFFECT,
    sourceCardId: "RK-168",
    kind: "select_power",
    validInstanceIds: remaining,
    viewedInstanceIds: remaining,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

function countDiscardFeatureUnits(state: GameState, playerId: PlayerId, feature: string): number {
  return state.players[playerId].discard.filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def?.type === "unit" && (def.features ?? []).includes(feature);
  }).length;
}

function resolveImaginPower(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const card = player.power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const name = imaginNameOf(state, card.cardId);
  const tenkomori = pending.effectId === IMAGIN_TENKOMORI_EFFECT;

  let next = state;
  if (!tenkomori) {
    next = {
      ...next,
      ...updatePlayer(next, playerId, {
        ...player,
        power: player.power.filter((c) => c.instanceId !== instanceId),
        discard: [...player.discard, card],
      }),
    };
  }
  next = clearPending(next, pending.phasePlayerId);
  const log = logFor(state, playerId, card.cardId, `${pending.effectId}:${name ?? card.cardId}`);
  const subPending = {
    ...pending,
    selectedInstanceIds: tenkomori ? ["tenkomori"] : [],
    viewedInstanceIds: (pending.viewedInstanceIds ?? []).filter((id) => id !== instanceId),
  };

  switch (name) {
    case "モモタロス":
      // このターン、そのユニットは「SP1」になる。
      next = updateEntering(next, playerId, pending.sourceInstanceId, (c) => ({ ...c, spOverride: 1 }));
      break;
    case "キンタロス":
      // そのユニットは BP+3000 される。
      next = updateEntering(next, playerId, pending.sourceInstanceId, (c) => ({
        ...c,
        bpModifier: (c.bpModifier ?? 0) + 3000,
      }));
      break;
    case "ウラタロス": {
      // 特徴「女」を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。
      const targets = fieldUnits(next.players[opponent(playerId)])
        .filter((c) => (getDefinition(next.definitions, c.cardId)?.features ?? []).includes("女"))
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        return {
          state: openEffectChoice(next, {
            ...subPending,
            effectId: IMAGIN_URATAROS_SEND,
            kind: "select_unit",
            validInstanceIds: targets,
            selectCount: 1,
            optional: false,
            unitDestination: "power",
          }),
          log,
        };
      }
      break;
    }
    case "リュウタロス": {
      // 自軍捨札の特徴「獣」を持つユニットカードの枚数以下の必要パワーを持つ敵軍ユニットを1体撃破。
      const limit = countDiscardFeatureUnits(next, playerId, "獣");
      const targets = fieldUnits(next.players[opponent(playerId)])
        .filter((c) => {
          const def = getDefinition(next.definitions, c.cardId);
          return def?.type === "unit" && parsePowerCost(def.powerCost) <= limit;
        })
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        return {
          state: openEffectChoice(next, {
            ...subPending,
            effectId: IMAGIN_RYUTAROS_DESTROY,
            kind: "select_unit",
            validInstanceIds: targets,
            selectCount: 1,
            optional: false,
            unitDestination: "discard",
          }),
          log,
        };
      }
      break;
    }
    default:
      break;
  }
  return { state: continueTenkomori(next, subPending, instanceId), log };
}

function resolveImaginSubChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const dest = pending.effectId === IMAGIN_URATAROS_SEND ? "power" : "discard";
  const leave = applyUnitLeave(state, instanceId, dest, pending.phasePlayerId);
  if ("error" in leave) return leave;
  let next = leave.state;
  if (next.pendingEffectChoice === pending) next = clearPending(next, pending.phasePlayerId);
  if (next.pendingEffectChoice || next.pendingLeave) return { state: next };
  return {
    state: continueTenkomori(next, pending, ""),
    log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:${instanceId}`),
  };
}

// ---------------------------------------------------------------------------
// 登録

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [BLAY_SHOW]: resolveBlayRouzer,
  [BLAY_HOLD]: resolveBlayRouzer,
  [BLAY_DESTROY]: resolveBlayRouzer,
  [IMAGIN_DISCARD_EFFECT]: resolveImaginPower,
  [IMAGIN_TENKOMORI_EFFECT]: resolveImaginPower,
  [IMAGIN_URATAROS_SEND]: resolveImaginSubChoice,
  [IMAGIN_RYUTAROS_DESTROY]: resolveImaginSubChoice,
};

/** このモジュールが開いた選択なら解決する。 */
export function tryResolveErrataChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  return resolver(state, playerId, instanceId);
}

export function isErrataChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** DSL grant_keyword（`cardId::effectId`）からの起点。対象外なら null。 */
export function tryErrataCardEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  _keyword: string,
): GrantKeywordResult | null {
  const id = `${ctx.sourceCardId}::${ctx.effectId}`;
  switch (id) {
    // ルール: R-ERR-RK168 — 本体の処理は進入時のイマジン効果（openImaginPowerChoice）。ここでは何もしない。
    case "RK-168::tenkomoridaze":
      return { state, detail: "tenkomoridaze" };
    case "RK-125::bureirauza": {
      const next = beginBlayRouzer(state, ctx);
      return next ? { state: next, detail: BLAY_SHOW } : { state, detail: `${BLAY_SHOW}:unmet` };
    }
    default:
      return null;
  }
}
