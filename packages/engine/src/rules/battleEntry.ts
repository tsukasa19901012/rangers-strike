import { getRidingComboEffect } from "@rangers-strike/cards";
import type { GameState, PendingBattleEntry, PlayerId } from "../types/game";
import { continueEnterBattleEffects } from "./combo";
import { hasScopedRestriction } from "../core/scopedModifiers";
import { rideOffBlockedBySet7D } from "./legend1/set7NamedEffectsD";
import { rk1MissionMemoryOnEntry } from "./rk/rk1NamedEffects";
import { rk6SideBasherOnEntry } from "./rk/rk6UnitEffects";
import { rk8KaiserBmOnEntry } from "./rk/rk8UnitEffects";
import { rk9NewNigoOnEntry } from "./rk/rk9UnitEffects";
import { rk11IbukiOnEntry } from "./rk/rk11UnitEffects";
import { rm3GunGibsonOnEntry } from "./rm/rm3Effects";

export function riderHasRidingComboOnRideOff(cardId: string): boolean {
  return !!getRidingComboEffect(cardId);
}

/** ライド中ならバトル進入後にライドオフ選択を挟む（RC なしでも可 — atwiki p594 Q3）。 */
export function shouldPromptRideOffChoice(
  state: GameState,
  entry: PendingBattleEntry,
): boolean {
  const unit = state.players[entry.playerId].battle.find(
    (c) => c.instanceId === entry.instanceId,
  );
  if (!unit?.mountedOnInstanceId) return false;
  // XG7-017【マッハ全開！】: このターン、これはライドオフできない（rules/xg7/xg7aEffects.ts）。
  if (unit.xg7Turn?.noRideOff) return false;
  // RS-506【バスオンミサイル】: 次の相手ターン、敵軍ユニットはライドオフできない（ライドしたまま進む）。
  return !rideOffBlockedBySet7D(state, entry.playerId);
}

export function createBattleEntryPrompt(
  playerId: PlayerId,
  instanceId: string,
  resumeEnterBattle?: PendingBattleEntry["resumeEnterBattle"],
): PendingBattleEntry {
  return {
    playerId,
    instanceId,
    phasePlayerId: playerId,
    resumeEnterBattle,
  };
}

/** move_to_battle + 進入効果の後: アクションプロンプトを開くか、効果選択を経由して延期。 */
export function afterEnterBattle(state: GameState, entry: PendingBattleEntry): GameState {
  if (state.pendingEffectChoice) {
    return { ...state, deferredBattleEntry: entry };
  }
  // RS-326【究極奥義・猫だまし】で出したユニットはアタックもストライクもできない（atwiki/page-487）—
  // 出た直後の行動の機会（アタック／ストライク）を開かない。
  if (
    hasScopedRestriction(state.players[entry.playerId], entry.instanceId, "neko_damashi_no_attack_strike", "turn")
  ) {
    return { ...state, activePlayer: entry.phasePlayerId };
  }
  return {
    ...state,
    pendingBattleEntry: entry,
    activePlayer: entry.playerId,
  };
}

/** 進入効果完了後: ライドオフ選択またはバトルアクションプロンプトへ。 */
export function openBattleEntryOrRideOffChoice(
  state: GameState,
  entry: PendingBattleEntry,
): GameState {
  if (state.pendingEffectChoice) {
    return { ...state, deferredBattleEntry: entry };
  }
  // 進入ユニットが進入効果（※バトルエリアに出たとき撃破される 等）で
  // 既に場を離れている場合は、幽霊のバトル進入プロンプトを出さない。
  const stillInBattle = state.players[entry.playerId].battle.some(
    (c) => c.instanceId === entry.instanceId,
  );
  if (!stillInBattle) {
    return restorePhaseActivePlayerUnlessBlocked(state, entry.phasePlayerId);
  }
  // RK-017 ミッションメモリー: ライドしないで出ても、RC の効果を発動する（rules/rk/rk1NamedEffects.ts）。
  const entered = state.players[entry.playerId].battle.find((c) => c.instanceId === entry.instanceId);
  if (entered && !entered.mountedOnInstanceId) {
    // RK-120 サイドバッシャーVM【ニーラーシャトル】: ライドされたままのこれからコンビネーションした RC のユニット（rules/rk/rk6UnitEffects.ts）。
    // RK-167 仮面ライダーカイザ: サイドバッシャーBM からコンビネーションしたときはナンバーに関係なく【カイザブレイガン】（rules/rk/rk8UnitEffects.ts）。
    const rc =
      rk1MissionMemoryOnEntry(state, entry.playerId, entry.instanceId) ??
      rk6SideBasherOnEntry(state, entry.playerId, entry.instanceId) ??
      rk8KaiserBmOnEntry(state, entry.playerId, entry.instanceId) ??
      // RK-176 仮面ライダー新2号: 「仮面ライダー1号」からコンビネーションしたときはナンバーに関係なく【ライダーキック】（rules/rk/rk9UnitEffects.ts）。
      rk9NewNigoOnEntry(state, entry.playerId, entry.instanceId) ??
      // RK-223 仮面ライダー威吹鬼: 特徴「猛士」を持つユニットからコンビネーションしたときはナンバーに関係なく【音撃射・疾風一閃】（rules/rk/rk11UnitEffects.ts）。
      rk11IbukiOnEntry(state, entry.playerId, entry.instanceId) ??
      // RM-045 ガンギブソン ※: これからコンビネーションする「メカ」の RC の S ユニットは、ライドせずに出ても RC の効果を発動する
      // （ユーザー決定 2026-10-19。rules/rm/rm3Effects.ts）。
      rm3GunGibsonOnEntry(state, entry.playerId, entry.instanceId);
    if (rc) return afterEnterBattle(rc, entry);
  }
  if (shouldPromptRideOffChoice(state, entry)) {
    const unit = state.players[entry.playerId].battle.find(
      (c) => c.instanceId === entry.instanceId,
    )!;
    return {
      ...state,
      pendingRideOffChoice: {
        playerId: entry.playerId,
        instanceId: entry.instanceId,
        phasePlayerId: entry.phasePlayerId,
        vehicleInstanceId: unit.mountedOnInstanceId!,
        battleEntry: entry,
      },
      activePlayer: entry.playerId,
    };
  }
  return afterEnterBattle(state, entry);
}

export function promoteDeferredBattleEntry(state: GameState): GameState {
  if (!state.deferredBattleEntry || state.pendingEffectChoice) return state;

  const entry = state.deferredBattleEntry;
  let nextState: GameState = { ...state, deferredBattleEntry: undefined };

  if (entry.resumeEnterBattle) {
    const continued = continueEnterBattleEffects(nextState, entry);
    nextState = {
      ...continued.state,
      log: [...continued.state.log, ...continued.logs],
    };
    if (nextState.pendingEffectChoice && continued.enterResumeFrom) {
      return afterEnterBattle(nextState, {
        playerId: entry.playerId,
        instanceId: entry.instanceId,
        phasePlayerId: entry.phasePlayerId,
        resumeEnterBattle: {
          ...entry.resumeEnterBattle,
          from: continued.enterResumeFrom,
        },
      });
    }
  }

  return openBattleEntryOrRideOffChoice(nextState, {
    playerId: entry.playerId,
    instanceId: entry.instanceId,
    phasePlayerId: entry.phasePlayerId,
    // 中断していた進入処理は上で再開済み（最後の任意効果の選択が開いていても、もう一度再開しない）。
    resumeEnterBattle: undefined,
    requiredDefenderInstanceId: entry.requiredDefenderInstanceId,
  });
}

export function hasBlockingPendingInteraction(state: GameState): boolean {
  return !!(
    state.pendingDamagePayment ||
    state.pendingLeave ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingRideOffChoice ||
    state.pendingChase
  );
}

/** ダメージ支払いなど別プレイヤーへの操作委譲中は activePlayer を上書きしない。 */
export function restorePhaseActivePlayerUnlessBlocked(
  state: GameState,
  phasePlayerId: PlayerId,
): GameState {
  if (hasBlockingPendingInteraction(state)) {
    return state;
  }
  return { ...state, activePlayer: phasePlayerId };
}

export function finishBattleEntryIf(state: GameState, instanceId: string): GameState {
  const entry = state.pendingBattleEntry;
  if (!entry || entry.instanceId !== instanceId) return state;
  const cleared: GameState = { ...state, pendingBattleEntry: undefined };
  return restorePhaseActivePlayerUnlessBlocked(cleared, entry.phasePlayerId);
}

export function hasPendingBattleEntry(state: GameState): boolean {
  return !!state.pendingBattleEntry;
}
