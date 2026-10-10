/**
 * 「アタックするとき、自軍コマンドを好きな数ホールドしてもよい。ホールドした数1つにつき BP+1000」系の選択。
 *
 * - RS-019 超力（常駐）: 自軍 S ユニットがアタックするとき発動できる。アタックするユニットは、自軍コマンドを
 *   1つホールドするごとに BP+1000（期限は「アタックしてバトルが終了するまで」= R-ATK-03、grnrngr/faq-card-1 RS-019）。
 * - RK-186 仮面ライダーJ【Jパンチ】: これがアタックするとき、自軍コマンドを好きな数ホールドしてもよい。
 *   そうしたとき、このターン、これはホールドしたコマンド1つにつき BP+1000。
 *
 * アタックのたびに、アタックしたプレイヤーがリリース状態の自軍コマンドからホールドする数（0〜リリース数）を
 * 選ぶ（`declare_number` 選択、effectId `attack_hold_bonus`）。BP 上昇はこのとき新たにホールドした数だけ
 * （既にホールド状態のコマンドは数えない。atwiki/page-243「ホールドするごとに」）。
 * 複数の効果が同時に使えるとき（RK-186 が超力の下でアタック等）は効果ごとに順に選ぶ。
 * 選択が終わってからアタックの処理（カウンター窓・バトル）を続ける（core/applyAction の battle）。
 */
import { getCardEffect } from "@rangers-strike/cards";
import { isSmallUnit } from "../core/catalog";
import { findInZone, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { battleAttackerBpBonus, battleDefenderBp } from "./namedUnitEffects";
import type {
  AttackHoldSource,
  CardInstance,
  GameState,
  PendingBattle,
  PendingEffectChoice,
  PlayerId,
} from "../types/game";

export const ATTACK_HOLD_BONUS_EFFECT_ID = "attack_hold_bonus";
export const ATTACK_HOLD_BP_PER_COMMAND = 1000;

/**
 * カード自身の「これがアタックするとき…好きな数ホールド」効果（DSL の on_attack 経路では解決せず、この選択で扱う）。
 * cardId → DSL effectId。
 */
export const ATTACK_HOLD_SELF_EFFECTS: Readonly<Record<string, string>> = {
  "RK-186": "jpanchi",
};

export function isAttackHoldSelfEffect(cardId: string, effectId: string): boolean {
  return ATTACK_HOLD_SELF_EFFECTS[cardId] === effectId;
}

/** このアタックで使える「ホールドした数だけ BP+」効果（解決順）。 */
export function listAttackHoldSources(
  state: GameState,
  playerId: PlayerId,
  attacker: CardInstance,
): AttackHoldSource[] {
  const player = state.players[playerId];
  const sources: AttackHoldSource[] = [];
  if (isSmallUnit(state.definitions, attacker.cardId)) {
    for (const op of player.operation) {
      if (getCardEffect(op.cardId)?.effectId !== "super_power") continue;
      sources.push({ sourceCardId: op.cardId, sourceInstanceId: op.instanceId, scope: "battle" });
    }
  }
  if (ATTACK_HOLD_SELF_EFFECTS[attacker.cardId]) {
    sources.push({ sourceCardId: attacker.cardId, sourceInstanceId: attacker.instanceId, scope: "turn" });
  }
  return sources;
}

export function releasedCommandCount(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].command.filter((c) => !c.commandHeld).length;
}

/**
 * 次の効果のホールド数選択を開く。リリース状態のコマンドがない（ホールドできない）なら null。
 */
export function openAttackHoldChoice(
  state: GameState,
  args: {
    battle: PendingBattle;
    wingAttackFromRush: boolean;
    sources: AttackHoldSource[];
  },
): GameState | null {
  const [source, ...rest] = args.sources;
  if (!source) return null;
  const available = releasedCommandCount(state, args.battle.attackerPlayerId);
  if (available === 0) return null;
  const choice: PendingEffectChoice = {
    playerId: args.battle.attackerPlayerId,
    effectId: ATTACK_HOLD_BONUS_EFFECT_ID,
    sourceCardId: source.sourceCardId,
    sourceInstanceId: source.sourceInstanceId,
    kind: "declare_number",
    phasePlayerId: args.battle.phasePlayerId,
    validInstanceIds: Array.from({ length: available + 1 }, (_, i) => String(i)),
    selectCount: 1,
    optional: false,
    selectedInstanceIds: [],
    attackHoldMeta: {
      battle: args.battle,
      wingAttackFromRush: args.wingAttackFromRush,
      scope: source.scope,
      remainingSources: rest,
    },
  };
  return { ...state, pendingEffectChoice: choice, activePlayer: choice.playerId };
}

/**
 * ホールド数を確定する。新たにホールドした数 × 1000 を、超力ならこのバトルの BP 上昇（PendingBattle）、
 * Jパンチならこのターンの BP 修正として加える。次の効果があればその選択を開く（`next` に pending 状態）。
 */
export function resolveAttackHoldChoice(
  state: GameState,
  playerId: PlayerId,
  value: string,
):
  | { error: string }
  | { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean; done: boolean } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.attackHoldMeta;
  if (!pending || !meta || pending.effectId !== ATTACK_HOLD_BONUS_EFFECT_ID) {
    return { error: "invalid_target" };
  }
  if (pending.playerId !== playerId) return { error: "not_your_choice" };
  if (!pending.validInstanceIds.includes(value)) return { error: "invalid_target" };
  const requested = Number(value);
  const player = state.players[playerId];
  const released = player.command.filter((c) => !c.commandHeld);
  const count = Math.max(0, Math.min(requested, released.length));
  const holdIds = new Set(released.slice(0, count).map((c) => c.instanceId));
  let nextPlayer = {
    ...player,
    command: player.command.map((c) => (holdIds.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
  };
  let battle = meta.battle;
  const bonus = count * ATTACK_HOLD_BP_PER_COMMAND;
  if (bonus > 0) {
    if (meta.scope === "battle") {
      battle = { ...battle, attackerBpBonus: (battle.attackerBpBonus ?? 0) + bonus };
    } else {
      const zone = findInZone(nextPlayer, "battle", battle.attackerInstanceId)
        ? "battle"
        : findInZone(nextPlayer, "rush", battle.attackerInstanceId)
          ? "rush"
          : null;
      if (zone) {
        nextPlayer = {
          ...nextPlayer,
          [zone]: nextPlayer[zone].map((c) =>
            c.instanceId === battle.attackerInstanceId
              ? { ...c, bpModifier: (c.bpModifier ?? 0) + bonus }
              : c,
          ),
        };
      }
    }
  }
  let next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, nextPlayer),
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
    log: [
      ...state.log,
      buildLogEntry(
        playerId,
        "named_effect",
        pending.sourceCardId,
        state.definitions,
        `attack_hold:${count}`,
      ),
    ],
  };
  const opened = openAttackHoldChoice(next, {
    battle,
    wingAttackFromRush: meta.wingAttackFromRush,
    sources: meta.remainingSources,
  });
  if (opened) return { state: opened, battle, wingAttackFromRush: meta.wingAttackFromRush, done: false };
  return { state: next, battle, wingAttackFromRush: meta.wingAttackFromRush, done: true };
}

/**
 * CPU: ホールド数を選ぶ。各数でホールドしたときのアタック側 BP（マジレッド等の「リリース状態のコマンド数」
 * 依存も含めて battleAttackerBpBonus で計算）とバトル相手の BP を比べ、勝てる最小の数を選ぶ。
 * どの数でも勝てなければ 0（コマンドを温存する）。
 */
export function pickAttackHoldCount(state: GameState, playerId: PlayerId): string | null {
  const pending = state.pendingEffectChoice;
  if (!pending?.attackHoldMeta || pending.effectId !== ATTACK_HOLD_BONUS_EFFECT_ID) return null;
  const values = pending.validInstanceIds
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
  for (const n of values) {
    const preview = previewAttackHoldBp(state, playerId, String(n));
    if (preview && preview.attackerBp > preview.defenderBp) return String(n);
  }
  return values.includes(0) ? "0" : (pending.validInstanceIds[0] ?? null);
}

/**
 * その数をホールドしたときの、このバトルでのアタック側 BP とバトル相手の BP（UI の選択肢表示・CPU 用）。
 * 後に続く同種効果の分は含まない。
 */
export function previewAttackHoldBp(
  state: GameState,
  playerId: PlayerId,
  value: string,
): { attackerBp: number; defenderBp: number } | null {
  const trial = resolveAttackHoldChoice(state, playerId, value);
  if ("error" in trial) return null;
  return {
    attackerBp: battleAttackerBpBonus(trial.state, trial.battle),
    defenderBp: battleDefenderBp(trial.state, trial.battle),
  };
}
