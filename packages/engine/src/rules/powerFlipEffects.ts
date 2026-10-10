/**
 * パワーゾーンのカードを「ウラ返してダメージにする」ときの効果（第4弾）。
 *
 * - RS-199 グリーンツー【ブレイクアクション】（NC）: これがストライクして相手がパワーゾーンのカードをウラ返すとき、
 *   ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破してもよい（atwiki/page-407）。
 *   メディテーションで2枚ウラ返したときは2枚とも対象（grnrngr/faq-card-6）。
 * - RS-202 ピンクファイブ【ピンクバリヤー】（NC）: 次の相手ターン、自軍パワーゾーンのカードをウラ返してダメージに
 *   するとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破する（atwiki/page-410）。
 *   発動後にピンクファイブが場を離れても有効（grnrngr/faq-card-4 RS-202 Q1）。
 * - RS-200 ブルースリー【超電子イヤー】（NC）: 自軍ダメージの数を数えてから、ダメージになっているカードをすべて
 *   オモテにしてもよい。そうしたとき、元のダメージの数と同じになるまで、自軍パワーゾーンのカードを選び
 *   ダメージにする（atwiki/page-408）。
 */
import type { DamagePaymentResume, GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { getDefinition, parsePowerCost } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { addNextTurnRuleModifier, hasTurnRuleModifier } from "../core/scopedModifiers";
import { applyUnitLeave } from "./pendingChoices";
import { openOptionalEffectConfirm, registerOptionalEffect } from "./optionalEffects";

export const BREAK_ACTION_EFFECT_ID = "bureikuakushon";
export const PINK_BARRIER_RULE_ID = "pink_barrier";
export const SUPER_ELECTRON_EAR_EFFECT_ID = "iya";
export const SUPER_ELECTRON_EAR_PICK_EFFECT_ID = "iya_pick_damage";

/** 「ダメージにする」で新しくウラ向きになった（それまでオモテだった）パワーのカード。 */
function flippedPowerIds(before: GameState, after: GameState, playerId: PlayerId): string[] {
  const wasFaceUp = new Set(
    before.players[playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId),
  );
  return after.players[playerId].power
    .filter((c) => c.faceDown && wasFaceUp.has(c.instanceId))
    .map((c) => c.instanceId);
}

/** ウラ返したカードと必要パワーの数字が同じ、owner のユニット（ラッシュ・バトルエリア）。 */
function unitsMatchingFlippedCost(
  state: GameState,
  flipperId: PlayerId,
  flippedIds: string[],
  ownerId: PlayerId,
): string[] {
  const costs = new Set(
    state.players[flipperId].power
      .filter((c) => flippedIds.includes(c.instanceId))
      .map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)),
  );
  if (costs.size === 0) return [];
  const owner = state.players[ownerId];
  return [...owner.battle, ...owner.rush]
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return !!def && costs.has(parsePowerCost(def.powerCost));
    })
    .map((c) => c.instanceId);
}

function destroyAll(state: GameState, ids: string[], phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const id of ids) {
    const leave = applyUnitLeave(next, id, "discard", phasePlayerId);
    if ("error" in leave) continue;
    next = leave.state;
    // 離場反応（ダイノガッツ等）で止まったら、残りはその処理のあとに持ち越さない（同時撃破の簡略化）。
    if (next.pendingLeave || next.pendingRegister) break;
  }
  return next;
}

/** RS-202【ピンクバリヤー】の発動（次の相手ターンに有効な目印を付ける）。 */
export function registerPinkBarrier(state: GameState, playerId: PlayerId, sourceCardId: string): GameState {
  const player = addNextTurnRuleModifier(state.players[playerId], PINK_BARRIER_RULE_ID, { sourceCardId });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

/**
 * 「ウラ返してダメージにするとき」（R-TIME-01: 現在形は行動の前）の効果。カードをウラ返す処理を決めたあと、
 * ダメージになった（ダメージを受けたとき・ダメージが6点になったとき等の誘発）より前に解決する。
 * before はウラ返す前、flipped はウラ返したパワーを反映した（ダメージの誘発をまだ解決していない）状態。
 * - RS-202【ピンクバリヤー】（強制。目印は次の相手ターンだけ有効）。
 */
export function applyPowerFlipBeforeDamage(
  before: GameState,
  flipped: GameState,
  damagedPlayerId: PlayerId,
  resume: DamagePaymentResume,
): GameState {
  if (!hasTurnRuleModifier(flipped.players[damagedPlayerId], PINK_BARRIER_RULE_ID)) return flipped;
  const ids = flippedPowerIds(before, flipped, damagedPlayerId);
  if (ids.length === 0) return flipped;
  const phasePlayerId = resume.kind === "strike" ? resume.pending.battlePhasePlayer : resume.activePlayer;
  const targets = unitsMatchingFlippedCost(flipped, damagedPlayerId, ids, opponent(damagedPlayerId));
  return targets.length > 0 ? destroyAll(flipped, targets, phasePlayerId) : flipped;
}

/**
 * ダメージの適用（パワーのウラ返し）後の誘発。before はウラ返す前、after はウラ返した後の状態。
 */
export function applyPowerFlipTriggers(
  before: GameState,
  after: GameState,
  damagedPlayerId: PlayerId,
  resume: DamagePaymentResume,
): GameState {
  const flipped = flippedPowerIds(before, after, damagedPlayerId);
  if (flipped.length === 0) return after;
  let next = after;
  const enemyId = opponent(damagedPlayerId);
  const phasePlayerId = resume.kind === "strike" ? resume.pending.battlePhasePlayer : next.activePlayer;

  // RS-199【ブレイクアクション】（任意）。
  if (resume.kind === "strike" && resume.pending.strikerPlayerId === enemyId && !next.pendingEffectChoice) {
    const striker = next.players[enemyId].battle.find((c) => c.instanceId === resume.pending.strikerInstanceId);
    if (striker?.cardId === "RS-199" && striker.activatedNcEffects?.includes(BREAK_ACTION_EFFECT_ID)) {
      const targets = unitsMatchingFlippedCost(next, damagedPlayerId, flipped, damagedPlayerId);
      if (targets.length > 0) {
        const opened = openOptionalEffectConfirm(next, {
          playerId: enemyId,
          effectId: BREAK_ACTION_EFFECT_ID,
          sourceCardId: "RS-199",
          sourceInstanceId: striker.instanceId,
          phasePlayerId,
        });
        next = { ...opened, pendingEffectChoice: { ...opened.pendingEffectChoice!, selectedInstanceIds: targets } };
      }
    }
  }
  return next;
}

registerOptionalEffect(BREAK_ACTION_EFFECT_ID, {
  apply: (state, pending) => destroyAll(state, pending.selectedInstanceIds ?? [], pending.phasePlayerId),
});

/** RS-200【超電子イヤー】: NC 成立時、ダメージがあれば「オモテにするか」の確認を開く。 */
export function openSuperElectronEar(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const damage = state.players[playerId].power.filter((c) => c.faceDown).length;
  if (damage === 0 || state.pendingEffectChoice) return state;
  return openOptionalEffectConfirm(state, {
    playerId,
    effectId: SUPER_ELECTRON_EAR_EFFECT_ID,
    sourceCardId: "RS-200",
    sourceInstanceId,
    phasePlayerId,
  });
}

registerOptionalEffect(SUPER_ELECTRON_EAR_EFFECT_ID, {
  apply: (state, pending) => {
    const playerId = pending.playerId;
    const player = state.players[playerId];
    const damage = player.power.filter((c) => c.faceDown).length;
    if (damage === 0) return state;
    // ダメージの数を数えてから、すべてオモテにする。
    const power = player.power.map((c) => (c.faceDown ? { ...c, faceDown: false } : c));
    const next: GameState = {
      ...state,
      ...updatePlayer(state, playerId, { ...player, power, damage: 0 }),
    };
    const choice: PendingEffectChoice = {
      playerId,
      effectId: SUPER_ELECTRON_EAR_PICK_EFFECT_ID,
      sourceCardId: "RS-200",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_power",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: power.map((c) => c.instanceId),
      selectCount: Math.min(damage, power.length),
      selectedInstanceIds: [],
      optional: false,
    };
    return { ...next, pendingEffectChoice: choice, activePlayer: playerId };
  },
  cpuAccepts: () => false,
});

/** 【超電子イヤー】でダメージにするカードを1枚ずつ選ぶ。選び終えたら null を返さず選択を閉じた状態を返す。 */
export function pickSuperElectronEarDamage(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | null {
  if (!pending.validInstanceIds.includes(instanceId)) return null;
  const playerId = pending.playerId;
  const player = state.players[playerId];
  const power = player.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c));
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, { ...player, power, damage: player.damage + 1 }),
  };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
    return { ...next, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } };
  }
  return { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
}
