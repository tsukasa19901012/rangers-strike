/**
 * 第4弾「四雄の覚醒」RS-201〜RS-208 の NC 効果ほか（cardSpec RS4-201-221）。
 *
 * - RS-201 イエローフォー【超電子ホログラフィー】（atwiki/page-409）
 * - RS-203 大帝ラー・デウス【デウス遺伝子】（atwiki/page-383、rules/addedFeatures.ts）
 * - RS-204 レッドファルコン【ファルコンブレイク】（atwiki/page-401、grnrngr/faq-card-4 RS-204 Q1/Q2）
 * - RS-205 リュウレンジャー【天火星・稲妻炎上破】（atwiki/page-116、grnrngr/faq-card-4 RS-205 Q1〜Q3）
 * - RS-206 シシレンジャー【天幻星・霧隠れ】（atwiki/page-117）
 * - RS-207 テンマレンジャー【天重星・天馬回転蹴り】（atwiki/page-118、grnrngr/faq-card-4 RS-207 Q1）
 * - RS-208 キリンレンジャー【天時星・時間返し】（atwiki/page-119、grnrngr/faq-card-4 RS-208 Q1/Q5〜Q8）
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../types/game";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  unitEffectiveCategories,
} from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { bounceToHand } from "./bounce";
import { applyUnitLeave } from "./pendingChoices";
import { openOptionalEffectConfirm, registerOptionalEffect } from "./optionalEffects";
import { addTurnFeatureModifier, DEUS_GENE_RULE_ID, KIRIGAKURE_RULE_ID, unitFeatures } from "./addedFeatures";

export const HOLOGRAPHY_EFFECT_ID = "horogurafui";
export const INAZUMA_HOLD_EFFECT_ID = "hi_honoo_ha";
export const INAZUMA_DESTROY_EFFECT_ID = "hi_honoo_ha_destroy";
export const KIRIGAKURE_EFFECT_ID = "re_e5a4a9";
export const TENMA_EFFECT_ID = "ri_e5a4a9";
export const TENMA_RETURN_EFFECT_ID = "ri_e5a4a9_return";
export const TIME_RETURN_EFFECT_ID = "shi";
export const MAGNET_FIST_EFFECT_ID = "chikara_ken";

/** このモジュールが resolve_effect_choice / confirm / skip を受け持つ選択か。 */
export function isRs4NcChoice(pending: PendingEffectChoice | undefined): boolean {
  if (!pending || pending.mayConfirm) return false;
  return (
    (pending.effectId === HOLOGRAPHY_EFFECT_ID && pending.sourceCardId === "RS-201") ||
    (pending.effectId === INAZUMA_HOLD_EFFECT_ID && pending.sourceCardId === "RS-205") ||
    (pending.effectId === INAZUMA_DESTROY_EFFECT_ID && pending.sourceCardId === "RS-205") ||
    (pending.effectId === KIRIGAKURE_EFFECT_ID && pending.sourceCardId === "RS-206") ||
    (pending.effectId === TENMA_RETURN_EFFECT_ID && pending.sourceCardId === "RS-207") ||
    (pending.effectId === MAGNET_FIST_EFFECT_ID && pending.sourceCardId === "RS-295")
  );
}

function shuffle<T>(cards: T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function fieldUnits(state: GameState, playerId: PlayerId): Array<{ card: CardInstance; zone: "rush" | "battle" }> {
  const p = state.players[playerId];
  return [
    ...p.battle.map((card) => ({ card, zone: "battle" as const })),
    ...p.rush.map((card) => ({ card, zone: "rush" as const })),
  ];
}

function countS(state: GameState, playerId: PlayerId): number {
  return fieldUnits(state, playerId).filter((u) => isSmallUnit(state.definitions, u.card.cardId)).length;
}

// ---------------------------------------------------------------------------
// RS-201【超電子ホログラフィー】

/** 山札を見て、オペレーションのカードがあれば1枚選ぶ（無ければシャッフルだけ）。 */
export function openHolography(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId?: string,
): GameState {
  const player = state.players[playerId];
  const ops = player.deck.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "operation");
  if (ops.length === 0) {
    return { ...state, ...updatePlayer(state, playerId, { ...player, deck: shuffle(player.deck) }) };
  }
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: HOLOGRAPHY_EFFECT_ID,
      sourceCardId: "RS-201",
      sourceInstanceId,
      kind: "scry_keep_one",
      phasePlayerId,
      validInstanceIds: ops.map((c) => c.instanceId),
      selectCount: 1,
      selectedInstanceIds: [],
      optional: false,
    },
    activePlayer: playerId,
  };
}

// ---------------------------------------------------------------------------
// RS-204【ファルコンブレイク】

/** 敵軍ユニットが1体以上あり、このユニットの BP がすべての敵軍ユニット以下（同着でもよい）なら、ナンバーに関係なく発動する。 */
export function falconBreakTriggers(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (card.cardId !== "RS-204") return false;
  const enemyId = opponent(playerId);
  const enemies = fieldUnits(state, enemyId);
  if (enemies.length === 0) return false;
  const own = effectiveBp(state, playerId, card);
  return enemies.every((u) => own <= effectiveBp(state, enemyId, u.card));
}

// ---------------------------------------------------------------------------
// RS-205【天火星・稲妻炎上破】

function daEnemySUnitIds(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter(
      (u) =>
        isSmallUnit(state.definitions, u.card.cardId) &&
        unitEffectiveCategories(state, enemyId, u.card, u.zone).includes("DA") &&
        isSelectableByOpponentEffect(state, playerId, u.card.instanceId, "RS-205", playerId),
    )
    .map((u) => u.card.instanceId);
}

function releasedMaCommandIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command
    .filter((c) => !c.commandHeld && cardCategories(getDefinition(state.definitions, c.cardId)).includes("MA"))
    .map((c) => c.instanceId);
}

export function openInazumaEnjouha(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId?: string,
): GameState {
  const targets = daEnemySUnitIds(state, playerId);
  const commands = releasedMaCommandIds(state, playerId);
  const limit = Math.min(targets.length, commands.length);
  if (limit <= 0) return state;
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: INAZUMA_HOLD_EFFECT_ID,
      sourceCardId: "RS-205",
      sourceInstanceId,
      kind: "select_commands",
      phasePlayerId,
      validInstanceIds: commands,
      selectCount: limit,
      selectedInstanceIds: [],
      optional: true,
    },
    activePlayer: playerId,
  };
}

function finishInazumaHold(state: GameState, pending: PendingEffectChoice): GameState {
  const selected = pending.selectedInstanceIds ?? [];
  const playerId = pending.playerId;
  if (selected.length === 0) {
    return { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  }
  const player = state.players[playerId];
  const command = player.command.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: true } : c));
  const held: GameState = { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
  // 「ホールドした数だけ」撃破する。対象は持ち主（リュウレンジャーの持ち主）が先にすべて選ぶ（faq-card-4 RS-205 Q1/Q2）。
  const targets = daEnemySUnitIds(held, playerId);
  if (targets.length === 0) return { ...held, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  return {
    ...held,
    pendingEffectChoice: {
      ...pending,
      effectId: INAZUMA_DESTROY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: targets,
      selectCount: Math.min(selected.length, targets.length),
      selectedInstanceIds: [],
      optional: false,
    },
  };
}

function destroySelected(state: GameState, pending: PendingEffectChoice, ids: string[]): GameState {
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  for (const id of ids) {
    const leave = applyUnitLeave(next, id, "discard", pending.phasePlayerId);
    if ("error" in leave) continue;
    next = leave.state;
    if (next.pendingLeave || next.pendingRegister) break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-206【天幻星・霧隠れ】

export function openKirigakure(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId: string,
): GameState {
  const candidates = [...fieldUnits(state, playerId), ...fieldUnits(state, opponent(playerId))]
    .filter((u) => u.card.instanceId !== sourceInstanceId)
    .filter((u) => isSelectableByOpponentEffect(state, playerId, u.card.instanceId, "RS-206", playerId))
    .map((u) => u.card.instanceId);
  if (candidates.length === 0) return state;
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: KIRIGAKURE_EFFECT_ID,
      sourceCardId: "RS-206",
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId,
      validInstanceIds: candidates,
      selectCount: 1,
      selectedInstanceIds: [],
      optional: true,
    },
    activePlayer: playerId,
  };
}

// ---------------------------------------------------------------------------
// RS-207【天重星・天馬回転蹴り】

export function openTenmaKick(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId?: string,
): GameState {
  const enemyId = opponent(playerId);
  if (countS(state, enemyId) - countS(state, playerId) < 4) return state;
  return openOptionalEffectConfirm(state, {
    playerId,
    effectId: TENMA_EFFECT_ID,
    sourceCardId: "RS-207",
    sourceInstanceId,
    phasePlayerId,
  });
}

function openTenmaReturn(state: GameState, pending: PendingEffectChoice): GameState {
  const ownerId = pending.playerId;
  const enemyId = opponent(ownerId);
  const surplus = countS(state, enemyId) - countS(state, ownerId);
  if (surplus <= 0) return state;
  const ids = fieldUnits(state, enemyId)
    .filter((u) => isSmallUnit(state.definitions, u.card.cardId))
    .map((u) => u.card.instanceId);
  return {
    ...state,
    pendingEffectChoice: {
      playerId: enemyId,
      effectId: TENMA_RETURN_EFFECT_ID,
      sourceCardId: "RS-207",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ids,
      selectCount: surplus,
      selectedInstanceIds: [],
      // 途中で止められない（faq-card-4 RS-207 Q1）。
      optional: false,
    },
    activePlayer: enemyId,
  };
}

registerOptionalEffect(TENMA_EFFECT_ID, { apply: (state, pending) => openTenmaReturn(state, pending) });

// ---------------------------------------------------------------------------
// RS-208【天時星・時間返し】

export function openTimeReturn(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId?: string,
): GameState {
  return openOptionalEffectConfirm(state, {
    playerId,
    effectId: TIME_RETURN_EFFECT_ID,
    sourceCardId: "RS-208",
    sourceInstanceId,
    phasePlayerId,
  });
}

registerOptionalEffect(TIME_RETURN_EFFECT_ID, {
  apply: (state, pending) => {
    const playerId = pending.playerId;
    // BP2000 以下の自軍ユニットをすべて手札に戻す（補正後の BP。faq-card-4 RS-208 Q5）。
    const targets = fieldUnits(state, playerId)
      .filter((u) => effectiveBp(state, playerId, u.card) <= 2000)
      .map((u) => ({ id: u.card.instanceId, zone: u.zone }));
    let next = state;
    for (const t of targets) {
      next = bounceToHand(next, { playerId, instanceId: t.id, fromZone: t.zone }).state;
    }
    // 時間返しを発動したキリンレンジャーは、このターン、アタックもストライクもできない（faq-card-4 RS-208 Q1）。
    if (pending.sourceInstanceId) {
      const player = next.players[playerId];
      const mark = (cards: CardInstance[]) =>
        cards.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, battleActed: true } : c));
      next = { ...next, ...updatePlayer(next, playerId, { ...player, battle: mark(player.battle), rush: mark(player.rush) }) };
    }
    // もう一度自軍ラッシュフェイズからやり直す（ホールド・ダメージ等の結果はそのまま。Q6/Q8）。
    return {
      ...next,
      phase: "rush",
      activePlayer: playerId,
      pendingBattleEntry: undefined,
      deferredBattleEntry: undefined,
    };
  },
  cpuAccepts: () => false,
});

// ---------------------------------------------------------------------------
// 選択の解決（applyEffectChoiceSelect / applyConfirmEffectChoice / skipEffectChoice から呼ぶ）

export function selectRs4NcChoice(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | { error: string } {
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const playerId = pending.playerId;
  switch (pending.effectId) {
    case HOLOGRAPHY_EFFECT_ID: {
      const player = state.players[playerId];
      const index = player.deck.findIndex((c) => c.instanceId === instanceId);
      if (index < 0) return { error: "invalid_target" };
      const [card, deck] = removeAt(player.deck, index);
      return {
        ...state,
        ...updatePlayer(state, playerId, {
          ...player,
          deck: shuffle(deck),
          power: [...player.power, { ...card, faceDown: false }],
        }),
        pendingEffectChoice: undefined,
        activePlayer: pending.phasePlayerId,
      };
    }
    case INAZUMA_HOLD_EFFECT_ID: {
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
      const next: PendingEffectChoice = { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining };
      if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
        return { ...state, pendingEffectChoice: next };
      }
      return finishInazumaHold(state, next);
    }
    case INAZUMA_DESTROY_EFFECT_ID:
    case TENMA_RETURN_EFFECT_ID: {
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
      if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
        return {
          ...state,
          pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
        };
      }
      if (pending.effectId === INAZUMA_DESTROY_EFFECT_ID) return destroySelected(state, pending, selected);
      let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
      for (const id of selected) {
        const zone = findInZone(next.players[playerId], "battle", id) ? "battle" : "rush";
        next = bounceToHand(next, { playerId, instanceId: id, fromZone: zone }).state;
      }
      return next;
    }
    case MAGNET_FIST_EFFECT_ID: {
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
      if (selected.length < 2) {
        return {
          ...state,
          pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
        };
      }
      return resolveMagnetFist({ ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }, pending, selected);
    }
    case KIRIGAKURE_EFFECT_ID: {
      const source = pending.sourceInstanceId;
      const located = [...fieldUnits(state, "player1").map((u) => ({ ...u, pid: "player1" as const })), ...fieldUnits(state, "player2").map((u) => ({ ...u, pid: "player2" as const }))].find(
        (u) => u.card.instanceId === instanceId,
      );
      if (!located || !source) return { error: "invalid_target" };
      const features = unitFeatures(state, located.pid, located.card);
      const player = addTurnFeatureModifier(
        state.players[playerId],
        KIRIGAKURE_RULE_ID,
        { instanceId: source, features },
        "RS-206",
      );
      return {
        ...state,
        ...updatePlayer(state, playerId, player),
        pendingEffectChoice: undefined,
        activePlayer: pending.phasePlayerId,
      };
    }
    default:
      return { error: "invalid_choice_kind" };
  }
}

/** 「好きな数」の選択を、少ない数で確定する（RS-205 のホールド）。 */
export function confirmRs4NcChoice(state: GameState, pending: PendingEffectChoice): GameState | null {
  if (pending.effectId === INAZUMA_HOLD_EFFECT_ID && (pending.selectedInstanceIds?.length ?? 0) > 0) {
    return finishInazumaHold(state, pending);
  }
  return null;
}

// ---------------------------------------------------------------------------
// RS-203【デウス遺伝子】

/** ラー・デウスをラッシュしたとき、追加条件で捨札にしたユニットのカードの特徴を記録する。 */
export function applyDeusGeneOnRush(
  state: GameState,
  playerId: PlayerId,
  rushedCardId: string,
  discardedMaterialCardIds: string[],
): GameState {
  if (rushedCardId !== "RS-203") return state;
  const features = [
    ...new Set(discardedMaterialCardIds.flatMap((id) => getDefinition(state.definitions, id)?.features ?? [])),
  ];
  if (features.length === 0) return state;
  const player = addTurnFeatureModifier(state.players[playerId], DEUS_GENE_RULE_ID, { features }, "RS-203");
  return { ...state, ...updatePlayer(state, playerId, player) };
}

// ---------------------------------------------------------------------------
// RS-295 磁石神父【磁力拳】（atwiki/page-433、grnrngr/faq-card-4・faq-card-5 RS-295）

const GENDERS = ["男", "女"] as const;

function genderKey(state: GameState, ownerId: PlayerId, card: CardInstance): string {
  const features = unitFeatures(state, ownerId, card);
  return GENDERS.filter((g) => features.includes(g)).join("+");
}

/**
 * 特徴に「男」または「女」の性別を持つ敵軍ユニット（ラッシュエリアのユニットも選べる — atwiki/page-433 カード評価）を
 * 2体選んでもよい。
 */
export function openMagnetFist(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId?: string,
): GameState {
  const enemyId = opponent(playerId);
  const candidates = fieldUnits(state, enemyId)
    .filter((u) => genderKey(state, enemyId, u.card) !== "")
    .filter((u) => isSelectableByOpponentEffect(state, playerId, u.card.instanceId, "RS-295", playerId))
    .map((u) => u.card.instanceId);
  if (candidates.length < 2) return state;
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: MAGNET_FIST_EFFECT_ID,
      sourceCardId: "RS-295",
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId,
      validInstanceIds: candidates,
      selectCount: 2,
      selectedInstanceIds: [],
      optional: true,
    },
    activePlayer: playerId,
  };
}

/**
 * 選んだ2体の性別が同じならそれぞれ持ち主の手札に戻し、違うなら選んだ2体でバトルする。
 * 「男」と「女」の両方を持つユニットは、両方を持つユニットとだけ「同じ」（faq-card-4 RS-295/RS-203 Q3）。
 * バトルは BP をくらべ、低いほうを撃破する（同じなら両方。R-BTL-01/02）。
 */
function resolveMagnetFist(state: GameState, pending: PendingEffectChoice, selected: string[]): GameState {
  const enemyId = opponent(pending.playerId);
  const units = selected
    .map((id) => fieldUnits(state, enemyId).find((u) => u.card.instanceId === id))
    .filter((u): u is { card: CardInstance; zone: "rush" | "battle" } => !!u);
  if (units.length < 2) return state;
  const a = units[0]!;
  const b = units[1]!;
  if (genderKey(state, enemyId, a.card) === genderKey(state, enemyId, b.card)) {
    let next = bounceToHand(state, { playerId: enemyId, instanceId: a.card.instanceId, fromZone: a.zone }).state;
    next = bounceToHand(next, { playerId: enemyId, instanceId: b.card.instanceId, fromZone: b.zone }).state;
    return next;
  }
  const bpA = effectiveBp(state, enemyId, a.card);
  const bpB = effectiveBp(state, enemyId, b.card);
  const losers = bpA === bpB ? [a.card.instanceId, b.card.instanceId] : [bpA < bpB ? a.card.instanceId : b.card.instanceId];
  return destroySelected(state, pending, losers);
}
