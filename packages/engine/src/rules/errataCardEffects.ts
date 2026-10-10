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
import { isZordUpCost } from "@rangers-strike/cards";
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
// XG1-048 仮面ライダースーパー1・EH【エレキ光線】

const ELECTRO_BEAM_PICK = "ereki_hikari_pick";

/**
 * ルール: R-ERR-XG1-048 — 敵軍Sユニットを1体選んでもよい。次の相手のターン、選んだユニットがバトルエリアに
 * あるとき、選んだユニットと隣り合っているユニットは、そのターンを終えるとき撃破される。
 */
function beginElectroBeam(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const enemy = state.players[opponent(ctx.playerId)];
  const targets = fieldUnits(enemy)
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ELECTRO_BEAM_PICK,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: targets,
    selectCount: 1,
    optional: true,
  });
}

function resolveElectroBeam(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  // 「次の相手のターン」= 次のターン（ターン番号はプレイヤーごとに進む）。
  const mark = (c: CardInstance) =>
    c.instanceId === instanceId ? { ...c, electroBeamTurn: state.turn + 1 } : c;
  const next = {
    ...state,
    ...updatePlayer(state, enemyId, {
      ...enemy,
      rush: enemy.rush.map(mark),
      battle: enemy.battle.map(mark),
    }),
  };
  return {
    state: clearPending(next, pending.phasePlayerId),
    log: logFor(state, playerId, pending.sourceCardId, `${ELECTRO_BEAM_PICK}:${instanceId}`),
  };
}

/** ターンを終えるとき: 選ばれたユニットがバトルエリアにあれば、隣り合っているユニットを撃破する。 */
export function applyElectroBeamTurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  const battle = state.players[endingPlayerId].battle;
  const adjacent = new Set<string>();
  battle.forEach((c, i) => {
    if (c.electroBeamTurn !== state.turn) return;
    if (i > 0) adjacent.add(battle[i - 1]!.instanceId);
    if (i + 1 < battle.length) adjacent.add(battle[i + 1]!.instanceId);
  });
  let next = state;
  for (const id of adjacent) {
    const leave = applyUnitLeave(next, id, "discard", endingPlayerId);
    if (!("error" in leave)) next = leave.state;
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG4-023 シュリケンジャーFM【超忍法・秘打千本ノック】

const SENBON_RETURN = "senbon_knock_return";
const SENBON_BOTTOM = "senbon_knock_bottom";

/** 自軍コマンドを好きな数選び手札に戻してもよい（選び終えたら確定）。 */
function beginSenbonKnock(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const command = state.players[ctx.playerId].command;
  if (command.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: SENBON_RETURN,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_commands",
    validInstanceIds: command.map((c) => c.instanceId),
    selectCount: command.length,
    commandFilter: "any",
    commandAction: "return_hand",
    optional: true,
  });
}

function enemyRushSUnits(state: GameState, enemyId: PlayerId): string[] {
  return state.players[enemyId].rush
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

/**
 * ルール: R-ERR-XG4-023 — そうしたとき、相手は戻した数と同じ数まで「可能な限り」自分自身のラッシュエリアの
 * Sユニットを選び、持ち主の山札の下に好きな順番で戻す（選んだ順に山札の下へ）。
 */
function finishSenbonReturn(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  selected: string[],
): ChoiceOutcome {
  const playerId = pending.playerId;
  let next = clearPending(state, pending.phasePlayerId);
  if (selected.length === 0) return { state: next };
  const player = next.players[playerId];
  const returned = player.command
    .filter((c) => selected.includes(c.instanceId))
    .map((c) => ({ ...c, commandHeld: false, mothershipHold: false }));
  next = {
    ...next,
    ...updatePlayer(next, playerId, {
      ...player,
      command: player.command.filter((c) => !selected.includes(c.instanceId)),
      hand: [...player.hand, ...returned],
    }),
  };
  const log = logFor(state, playerId, pending.sourceCardId, `${SENBON_RETURN}:${returned.length}`);
  const enemyId = opponent(playerId);
  const targets = enemyRushSUnits(next, enemyId);
  const count = Math.min(returned.length, targets.length);
  if (count === 0) return { state: next, log };
  return {
    state: openEffectChoice(next, {
      playerId: enemyId,
      effectId: SENBON_BOTTOM,
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId,
      phasePlayerId: pending.phasePlayerId,
      kind: "select_unit",
      validInstanceIds: targets,
      selectCount: count,
      selectedInstanceIds: [],
      optional: false,
      unitDestination: "deck_top",
    }),
    log,
  };
}

function resolveSenbonKnock(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];

  if (pending.effectId === SENBON_RETURN) {
    if (selected.length < (pending.selectCount ?? 1)) {
      return {
        state: {
          ...state,
          pendingEffectChoice: {
            ...pending,
            selectedInstanceIds: selected,
            validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
          },
        },
      };
    }
    return finishSenbonReturn(state, pending, selected);
  }

  // SENBON_BOTTOM: 選んだ順に持ち主の山札の下へ。
  const owner = state.players[playerId];
  const card = owner.rush.find((c) => c.instanceId === instanceId)!;
  const { commandHeld: _h, mountedOnInstanceId: _m, ...clean } = card;
  let next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...owner,
      rush: owner.rush.filter((c) => c.instanceId !== instanceId),
      deck: [...owner.deck, clean as CardInstance],
    }),
  };
  if (selected.length < (pending.selectCount ?? 1)) {
    const remaining = enemyRushSUnits(next, playerId);
    if (remaining.length > 0) {
      return {
        state: {
          ...next,
          pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
        },
      };
    }
  }
  next = clearPending(next, pending.phasePlayerId);
  return { state: next, log: logFor(state, playerId, pending.sourceCardId, `${SENBON_BOTTOM}:${selected.length}`) };
}

// ---------------------------------------------------------------------------
// XG6-044 仮面ライダーNEW電王SF【カウンターストライク】

const COUNTER_STRIKE = "counter_strike_reveal";

function beginCounterStrike(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (state.players[ctx.playerId].deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: COUNTER_STRIKE,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "confirm",
    validInstanceIds: ["reveal"],
    optional: true,
  });
}

/** 場から直接捨札へ（撃破ではない「捨札にする」）。乗っているユニットのライドは外す。 */
function moveFieldCardToDiscard(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const owner = state.players[ownerId];
  const card = [...owner.rush, ...owner.battle].find((c) => c.instanceId === instanceId);
  if (!card) return state;
  const unmount = (c: CardInstance) => {
    if (c.mountedOnInstanceId !== instanceId) return c;
    const { mountedOnInstanceId: _m, ...rest } = c;
    return rest as CardInstance;
  };
  const { commandHeld: _h, mountedOnInstanceId: _r, ...clean } = card;
  return {
    ...state,
    ...updatePlayer(state, ownerId, {
      ...owner,
      rush: owner.rush.filter((c) => c.instanceId !== instanceId).map(unmount),
      battle: owner.battle.filter((c) => c.instanceId !== instanceId).map(unmount),
      discard: [...owner.discard, clean as CardInstance],
    }),
  };
}

/**
 * ルール: R-ERR-XG6-044 — 山札の上を1枚オモテにし、その必要パワーの数字と同じ並びにある敵軍Sユニット
 * （またはライドされていない敵軍Sビークル）を捨札にする。その後、オモテにしたカードは山札の下に戻す。
 */
function resolveCounterStrike(state: GameState, playerId: PlayerId, _instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const player = state.players[playerId];
  const top = player.deck[0];
  let next = clearPending(state, pending.phasePlayerId);
  if (!top) return { state: next };
  const def = getDefinition(state.definitions, top.cardId);
  const position = parsePowerCost(def?.powerCost);
  const enemyId = opponent(playerId);
  const enemyBattle = next.players[enemyId].battle;
  const target = position >= 1 ? enemyBattle[position - 1] : undefined;
  const targetDef = target ? getDefinition(state.definitions, target.cardId) : undefined;
  const ridden = (id: string) =>
    [...next.players[enemyId].battle, ...next.players[enemyId].rush].some(
      (c) => c.mountedOnInstanceId === id,
    );
  const valid =
    !!target &&
    !!targetDef &&
    targetDef.size === "S" &&
    (targetDef.type === "unit" || (targetDef.type === "vehicle" && !ridden(target.instanceId)));
  if (valid) next = moveFieldCardToDiscard(next, enemyId, target!.instanceId);
  // その後、オモテにしたカードは山札の下に戻す（atwiki/page-2322 Q2）。
  const after = next.players[playerId];
  next = {
    ...next,
    ...updatePlayer(next, playerId, {
      ...after,
      deck: [...after.deck.filter((c) => c.instanceId !== top.instanceId), top],
    }),
  };
  return {
    state: next,
    log: logFor(
      state,
      playerId,
      pending.sourceCardId,
      `${COUNTER_STRIKE}:${cardName(state.definitions, top.cardId)}:${valid ? target!.instanceId : "none"}`,
    ),
  };
}

// ---------------------------------------------------------------------------
// 山札サーチ共通

export function shuffleCards<T>(cards: T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** 山札の1枚を手札に加え、山札をシャッフルする。 */
function deckCardToHandShuffle(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const player = state.players[playerId];
  const card = player.deck.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck: shuffleCards(player.deck.filter((c) => c.instanceId !== instanceId)),
      hand: [...player.hand, card],
    }),
  };
}

// ---------------------------------------------------------------------------
// RS-349 スーパー戦隊アドレスブック

const ADDRESS_BOOK = "address_book_search";

/**
 * ルール: R-ERR-RS349 — 自軍山札を見て、追加条件を持たず DA を持たない（マルチカテゴリも不可）
 * Sユニットのカードを1枚選び、手札に加えてもよい。その後、山札をシャッフルする。
 */
function beginAddressBook(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const valid = state.players[ctx.playerId].deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def || def.type !== "unit" || def.size !== "S") return false;
      if (cardCategories(def).includes("DA")) return false;
      return !def.rushAdditionalCondition && !isZordUpCost(def.powerCost);
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ADDRESS_BOOK,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    selectCount: 1,
    optional: true,
  });
}

function resolveAddressBook(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = deckCardToHandShuffle(clearPending(state, pending.phasePlayerId), playerId, instanceId);
  return { state: next, log: logFor(state, playerId, pending.sourceCardId, `${ADDRESS_BOOK}:${instanceId}`) };
}

// ---------------------------------------------------------------------------
// RK-146 デネブ【デネブキャンディー】

const DENEB_CANDY = "deneb_candy";

/**
 * ルール: R-ERR-RK146 — 相手、自分の順に「自分自身の山札を見てもよい。そうしたとき、その中から
 * オペレーションカードを1枚選び手札に加える。その後、山札をシャッフルする。」
 * selectedInstanceIds[0] に残りの手番（"self"）を持たせる。
 */
function openDenebCandyFor(
  state: GameState,
  base: { sourceCardId: string; sourceInstanceId?: string; phasePlayerId: PlayerId },
  order: PlayerId[],
): GameState {
  let next = state;
  for (let i = 0; i < order.length; i += 1) {
    const pid = order[i]!;
    const ops = next.players[pid].deck
      .filter((c) => getDefinition(next.definitions, c.cardId)?.type === "operation")
      .map((c) => c.instanceId);
    if (ops.length === 0) continue;
    return openEffectChoice(next, {
      playerId: pid,
      effectId: DENEB_CANDY,
      sourceCardId: base.sourceCardId,
      sourceInstanceId: base.sourceInstanceId,
      phasePlayerId: base.phasePlayerId,
      kind: "scry_keep_one",
      validInstanceIds: ops,
      viewedInstanceIds: ops,
      selectedInstanceIds: order.slice(i + 1),
      selectCount: 1,
      optional: true,
    });
  }
  return next;
}

function continueDenebCandy(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): GameState {
  const rest = (pending.selectedInstanceIds ?? []).filter(
    (p): p is PlayerId => p === "player1" || p === "player2",
  );
  return openDenebCandyFor(clearPending(state, pending.phasePlayerId), pending, rest);
}

function resolveDenebCandy(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = deckCardToHandShuffle(state, playerId, instanceId);
  return {
    state: continueDenebCandy(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${DENEB_CANDY}:${instanceId}`),
  };
}

// ---------------------------------------------------------------------------
// RK-231 オロチ【潜水】

const OROCHI_DIVE = "orochi_dive";

/** ホールド状態で【潜水】の制限を受けるオロチか。 */
export function isDivingOrochi(card: CardInstance): boolean {
  return card.cardId === "RK-231" && card.commandHeld === true;
}

function openOrochiDive(
  state: GameState,
  playerId: PlayerId,
  candidates: string[],
): GameState {
  const [first, ...rest] = candidates;
  if (!first) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: OROCHI_DIVE,
    sourceCardId: "RK-231",
    sourceInstanceId: first,
    phasePlayerId: playerId,
    kind: "confirm",
    validInstanceIds: [first],
    viewedInstanceIds: rest,
    optional: true,
  });
}

/**
 * ルール: R-ERR-RK231 — 自分がターンを終えるとき、このユニットをリリースするか、ホールドしてもよい。
 * resolve（instanceId）で状態を切り替え、skip でそのまま。
 */
export function applyOrochiTurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  if (state.pendingEffectChoice) return state;
  const ids = fieldUnits(state.players[endingPlayerId])
    .filter((c) => c.cardId === "RK-231")
    .map((c) => c.instanceId);
  return openOrochiDive(state, endingPlayerId, ids);
}

function resolveOrochiDive(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const toggle = (c: CardInstance) =>
    c.instanceId === instanceId ? { ...c, commandHeld: !c.commandHeld } : c;
  const toggled = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      rush: player.rush.map(toggle),
      battle: player.battle.map(toggle),
    }),
  };
  const next = openOrochiDive(clearPending(toggled, pending.phasePlayerId), playerId, pending.viewedInstanceIds ?? []);
  return { state: next, log: logFor(state, playerId, "RK-231", `${OROCHI_DIVE}:${instanceId}`) };
}

// ---------------------------------------------------------------------------
// XG4-004 副長ゼルモダ【ワンパーの壺】

const WANPA_POT = "wanpa_pot";

/**
 * ルール: R-ERR-XG4-004 — 自軍山札を見て特徴「戦闘員」を持つカードを2枚まで選び、自軍ラッシュエリアに
 * 出してもよい。その後、山札をシャッフルする（戦闘員がなければ0枚として続行: atwiki/page-2069 Q1）。
 */
function beginWanpaPot(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const valid = state.players[ctx.playerId].deck
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("戦闘員"))
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: WANPA_POT,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    selectCount: Math.min(2, valid.length),
    optional: true,
  });
}

function finishWanpaPot(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  selected: string[],
): ChoiceOutcome {
  const playerId = pending.playerId;
  const player = state.players[playerId];
  const chosen = player.deck.filter((c) => selected.includes(c.instanceId));
  const next = {
    ...clearPending(state, pending.phasePlayerId),
    ...updatePlayer(state, playerId, {
      ...player,
      deck: shuffleCards(player.deck.filter((c) => !selected.includes(c.instanceId))),
      rush: [...player.rush, ...chosen],
    }),
  };
  return {
    state: { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    log: logFor(state, playerId, pending.sourceCardId, `${WANPA_POT}:${chosen.length}`),
  };
}

function resolveWanpaPot(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < (pending.selectCount ?? 1)) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          selectedInstanceIds: selected,
          validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
        },
      },
    };
  }
  return finishWanpaPot(state, pending, selected);
}

// ---------------------------------------------------------------------------
// XG2-014 鉄面臂張遼【気力妖力合体】

const KIRYOKU_HOLD = "kiryoku_youryoku_hold";
const KIRYOKU_DESTROY = "kiryoku_youryoku_destroy";

type MaDaKind = "both" | "ma" | "da" | null;

function maDaKind(state: GameState, cardId: string): MaDaKind {
  const def = getDefinition(state.definitions, cardId);
  const cats = def ? cardCategories(def) : [];
  const ma = cats.includes("MA");
  const da = cats.includes("DA");
  if (ma && da) return "both";
  if (ma && cats.length === 1) return "ma";
  if (da && cats.length === 1) return "da";
  return null;
}

function releasedOfKind(state: GameState, playerId: PlayerId, kinds: MaDaKind[]): string[] {
  return state.players[playerId].command
    .filter((c) => !c.commandHeld && kinds.includes(maDaKind(state, c.cardId)))
    .map((c) => c.instanceId);
}

/**
 * ルール: R-ERR-XG2-014 — MAとDAの両方を持つ自軍コマンドを1つ、または MAのみ・DAのみのコマンドを1つずつ
 * 選びホールドしてもよい。そうしたとき、敵軍Sユニットを1体選び撃破する。
 */
function beginKiryoku(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const both = releasedOfKind(state, ctx.playerId, ["both"]);
  const ma = releasedOfKind(state, ctx.playerId, ["ma"]);
  const da = releasedOfKind(state, ctx.playerId, ["da"]);
  const valid = [...both, ...(ma.length && da.length ? [...ma, ...da] : [])];
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: KIRYOKU_HOLD,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_commands",
    validInstanceIds: valid,
    selectCount: 2,
    commandFilter: "released",
    // commandAction: "hold" にすると effect_hold 支払い UI に回るため、ホールドはこのモジュールで行う。
    optional: true,
  });
}

function resolveKiryoku(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };

  if (pending.effectId === KIRYOKU_DESTROY) {
    const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
    if ("error" in leave) return leave;
    let next = leave.state;
    if (next.pendingEffectChoice === pending) next = clearPending(next, pending.phasePlayerId);
    return { state: next, log: logFor(state, playerId, pending.sourceCardId, `${KIRYOKU_DESTROY}:${instanceId}`) };
  }

  const player = state.players[playerId];
  const held = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      command: player.command.map((c) =>
        c.instanceId === instanceId ? { ...c, commandHeld: true, mothershipHold: false } : c,
      ),
    }),
  };
  const card = player.command.find((c) => c.instanceId === instanceId)!;
  const kind = maDaKind(state, card.cardId);
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (kind !== "both" && selected.length < 2) {
    // MAのみを選んだら DAのみ、DAのみを選んだら MAのみをもう1つ。
    const partner = releasedOfKind(held, playerId, [kind === "ma" ? "da" : "ma"]);
    return {
      state: {
        ...held,
        pendingEffectChoice: {
          ...pending,
          selectedInstanceIds: selected,
          validInstanceIds: partner,
          optional: false,
        },
      },
    };
  }
  const targets = fieldUnits(held.players[opponent(playerId)])
    .filter((c) => isSmallUnit(held.definitions, c.cardId))
    .map((c) => c.instanceId);
  const cleared = clearPending(held, pending.phasePlayerId);
  const log = logFor(state, playerId, pending.sourceCardId, `${KIRYOKU_HOLD}:${selected.length}`);
  if (targets.length === 0) return { state: cleared, log };
  return {
    state: openEffectChoice(cleared, {
      ...pending,
      effectId: KIRYOKU_DESTROY,
      kind: "select_unit",
      validInstanceIds: targets,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      unitDestination: "discard",
    }),
    log,
  };
}

// ---------------------------------------------------------------------------
// 登録

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [BLAY_SHOW]: resolveBlayRouzer,
  [BLAY_HOLD]: resolveBlayRouzer,
  [BLAY_DESTROY]: resolveBlayRouzer,
  [ELECTRO_BEAM_PICK]: resolveElectroBeam,
  [KIRYOKU_HOLD]: resolveKiryoku,
  [KIRYOKU_DESTROY]: resolveKiryoku,
  [WANPA_POT]: resolveWanpaPot,
  [OROCHI_DIVE]: resolveOrochiDive,
  [ADDRESS_BOOK]: resolveAddressBook,
  [DENEB_CANDY]: resolveDenebCandy,
  [COUNTER_STRIKE]: resolveCounterStrike,
  [SENBON_RETURN]: resolveSenbonKnock,
  [SENBON_BOTTOM]: resolveSenbonKnock,
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

/** 「好きな数」選んで確定できる選択（confirm_effect_choice を出す）。 */
const CONFIRMABLE_CHOICES = new Set([SENBON_RETURN, WANPA_POT]);

export function isErrataConfirmableChoice(effectId: string): boolean {
  return CONFIRMABLE_CHOICES.has(effectId);
}

/** 任意の選択をしない（skip_effect_choice）。続きのある効果だけ扱う。 */
export function trySkipErrataChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || !pending.optional) return null;
  if (pending.effectId === DENEB_CANDY) {
    return { state: continueDenebCandy(state, pending) };
  }
  if (pending.effectId === OROCHI_DIVE) {
    return {
      state: openOrochiDive(
        clearPending(state, pending.phasePlayerId),
        playerId,
        pending.viewedInstanceIds ?? [],
      ),
    };
  }
  return null;
}

/** 確定（confirm_effect_choice）。 */
export function tryConfirmErrataChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (pending.effectId === SENBON_RETURN) {
    return finishSenbonReturn(state, pending, pending.selectedInstanceIds ?? []);
  }
  if (pending.effectId === WANPA_POT) {
    return finishWanpaPot(state, pending, pending.selectedInstanceIds ?? []);
  }
  return null;
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
    case "XG1-048::ereki_hikari": {
      const next = beginElectroBeam(state, ctx);
      return next ? { state: next, detail: ELECTRO_BEAM_PICK } : { state, detail: `${ELECTRO_BEAM_PICK}:no_targets` };
    }
    case "XG4-023::choninpo_noku": {
      const next = beginSenbonKnock(state, ctx);
      return next ? { state: next, detail: SENBON_RETURN } : { state, detail: `${SENBON_RETURN}:no_commands` };
    }
    case "XG6-044::kauntasutoraiku": {
      const next = beginCounterStrike(state, ctx);
      return next ? { state: next, detail: COUNTER_STRIKE } : { state, detail: `${COUNTER_STRIKE}:no_deck` };
    }
    case "RS-349::deck_to_hand": {
      const next = beginAddressBook(state, ctx);
      return next ? { state: next, detail: ADDRESS_BOOK } : { state, detail: `${ADDRESS_BOOK}:no_targets` };
    }
    case "RK-146::denebukyandei": {
      const next = openDenebCandyFor(
        state,
        {
          sourceCardId: ctx.sourceCardId,
          sourceInstanceId: ctx.triggerSourceInstanceId,
          phasePlayerId: ctx.phasePlayerId,
        },
        [opponent(ctx.playerId), ctx.playerId],
      );
      return { state: next, detail: DENEB_CANDY };
    }
    case "XG4-004::wanpano": {
      const next = beginWanpaPot(state, ctx);
      return next ? { state: next, detail: WANPA_POT } : { state, detail: `${WANPA_POT}:none` };
    }
    case "XG2-014::chikara_chikara": {
      const next = beginKiryoku(state, ctx);
      return next ? { state: next, detail: KIRYOKU_HOLD } : { state, detail: `${KIRYOKU_HOLD}:no_commands` };
    }
    case "RK-125::bureirauza": {
      const next = beginBlayRouzer(state, ctx);
      return next ? { state: next, detail: BLAY_SHOW } : { state, detail: `${BLAY_SHOW}:unmet` };
    }
    default:
      return null;
  }
}
