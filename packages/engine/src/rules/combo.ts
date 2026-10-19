import { tryRm3OnEnterBattle } from "./rm/rm3Effects";
import { tryXg3OnEnterBattle } from "./xg3/xg3Effects";
import { tryRm2OnEnterBattle } from "./rm/rm2Effects";
import type { CardDefinition } from "@rangers-strike/cards";
import { tryRk9OnEnterBattle } from "./rk/rk9UnitEffects";
import { tryRk10OnEnterBattle } from "./rk/rk10UnitEffects";
import { rk12MarkHeldEntry, tryRk12OnEnterBattle } from "./rk/rk12UnitEffects";
import { checkRk13SplashBeforeNc, clearRk13NcNegation, tryRk13OnEnterBattle } from "./rk/rk13UnitEffects";
import { tryRk14OnEnterBattle } from "./rk/rk14UnitEffects";
import { tryRk15OnEnterBattle } from "./rk/rk15UnitEffects";
import { tryRk16OnEnterBattle } from "./rk/rk16UnitEffects";
import { openWarriorSoulNcChoice } from "./legend1/set9NamedEffectsA";
import { tryResidentRushOnAllyEnterBattle } from "./residentAllyEnterRush";
import { listNcColumnNamedEffects, getNumberComboEffect } from "@rangers-strike/cards";
import { registerBattleCommandHooks, tryOpenBattleCommand } from "./battleCommand";
import { applyGorengerHurricaneOnEnter } from "./legend3/gorengerHurricane";
import {
  getEnterBattleEffect,
  getEnterBattleNamedEffect,
  hasUnnamedRule,
} from "@rangers-strike/cards";
import { getConditionalNamedEffect } from "@rangers-strike/cards";
import type { CardInstance, EnterBattleResumeFrom, GameState, PendingBattleEntry, PlayerId } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  isUnit,
  isVehicle,
  unitBp,
} from "../core/catalog";
import { opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { applyCourageMagicRelease } from "./strikeReactions";
import { sComboFinisherSetValues } from "./turnModifierBridge";
import { isSOnlyComboLine } from "./turnModifiers";
import {
  canRunEnterBattleConditionalEffect,
  tryStartConditionalChoice,
  tryStartDestroyEnemyChoice,
  resolveSkyMagicSlash,
  applyWingPentactOnCombo,
} from "./namedUnitEffects";
import { resolveLegend2EnterBattle, applyLegend2ConditionalModifiers } from "./legend2/battleEffects";
import {
  isLegend3EnterBattleEffect,
  resolveLegend3EnterBattle,
  shouldRunConditionalOnEnter,
} from "./legend3/battleEffects";
import { resolveJointCombosOnEnter } from "./jointComboProcedure";
import { ncGateAllows } from "./ncGatedEffects";
import { patchPlayer } from "./playerPatches";
import { applyDestroyOnEnterBattle } from "./destroyOnEnterBattle";
import { tryStartOpponentDrawOnEnter } from "./legend2/destroyEffects";
import { tryMereChameleonOnAllyEnterBattle } from "./batch04FieldEffects";
import { tryPowerFaceupRaidaOnAllyEnter } from "./riderKickEffects";
import { applyBeastSwordHoldOnEnter } from "./errataCardEffects";
import { countLogicalBattleSlots } from "./battleLine";
import { applyBaseAttackOnEnter } from "./legend3/enterBattleEffects";
import { applyVCommanderHoldOnEnter, cannotAttackOrStrikeThisTurn, countHeldCommands } from "./restrictions";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  rideOffBlocksStrike,
  wingTurnBlocksStrike,
} from "../keywords/battleKeywords";
import type { ComboOutcome } from "./comboTypes";
import {
  applyNumberComboEffect,
  markOnAttackNcEffectOnEnter,
  ncEffectiveNumber,
  numberComboTriggers,
  resolveNamedNcEffectId,
} from "./numberComboEffects";
import { resolveRidingComboOnRideOff } from "./ridingComboEffects";
import { legend3EffectiveSp, shovelDefenseBlocksStrike } from "./legend3/fieldEffects";
import { hasBakiBakiExtraAttackOnly } from "./legend3/destroyEffects";
import { tryStartDslConditionalChoice } from "../dsl/conditionalEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { wingAllowsEmptyBattleStrike } from "../keywords";
import { canStrikeWithHelloMirage } from "./helloMirage";
import { applyFivemanOnCombo, trySet5AOnComboEnter } from "./legend1/set5NamedEffectsA";
import {
  checkFlameGlare,
  clearFlameGlareDecision,
  negateNcOnUnit,
  set6BBlocksStrike,
  trySet6BOnComboEnter,
} from "./legend1/set6NamedEffectsB";
import { trySet7AOnEnterBattle } from "./legend1/set7NamedEffectsA";
import { set9CBlocksStrike, trySet9COnComboEnter } from "./legend1/set9NamedEffectsC";
import { tryRk1OnEnterBattle } from "./rk/rk1NamedEffects";
import { tryRk2OnEnterBattle } from "./rk/rk2UnitEffects";
import { tryRk4OnEnterBattle } from "./rk/rk4UnitEffects";
import { tryRk5OnEnterBattle } from "./rk/rk5UnitEffects";
import { tryRk6OnEnterBattle } from "./rk/rk6UnitEffects";
import { set8ABlocksStrike, trySet8AOnEnterBattle } from "./legend1/set8NamedEffectsA";
import { clearWolfRoarDecision, openWolfRoarBeforeNc } from "./legend1/set7NamedEffectsC";
import { emitUnitEnteredBattleEffects } from "../events/emitUnitEnteredBattle";
import { registerEnterBattleEffectsImpl } from "../events/listeners/unitEnteredBattleListener";

export type { ComboOutcome } from "./comboTypes";

/**
 * RS-001/RS-002 等の S コンビネーション・フィニッシャー。BP/SP は `sComboFinisherSetValues`
 * （effectiveBp / SP 計算）で常に現在の並びから求めるため、ここではカードを書き換えない。
 * 進入時に条件を満たしたかどうか（ログ用）だけを返す。
 */
function sComboFinisherApplies(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): boolean {
  return sComboFinisherSetValues(state, playerId, card) !== null;
}

function destroyWeakestEnemy(
  state: GameState,
  playerId: PlayerId,
  maxBp: number,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  let targetIndex = -1;
  let targetBp = -1;

  for (let i = 0; i < enemy.battle.length; i++) {
    const card = enemy.battle[i]!;
    const bp = effectiveBp(state, enemyId, card);
    if (bp <= maxBp && bp > targetBp) {
      targetBp = bp;
      targetIndex = i;
    }
  }

  if (targetIndex < 0) {
    return { state, logs: [] };
  }

  const [destroyed, battle] = removeAt(enemy.battle, targetIndex);
  const nextEnemy = {
    ...enemy,
    battle,
    discard: [...enemy.discard, destroyed],
  };

  const log = buildLogEntry(
    playerId,
    "enter_battle",
    destroyed.cardId,
    state.definitions,
    `destroy:${cardName(state.definitions, destroyed.cardId)}`,
  );

  return {
    state: { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
    logs: [log],
  };
}

/**
 * ルール: R-CN-04 — コンビネーション（NC）の効果を発動できるのは、そのユニットの持ち主自身のバトルフェイズに
 * バトルエリアへ出たときだけ。敵軍のバトルフェイズに効果で自軍ユニットが出されても NC は成立しない。
 */
export function isOwnBattlePhase(state: GameState, playerId: PlayerId): boolean {
  return state.phase === "battle" && state.activePlayer === playerId;
}

function shouldRunEnterStep(
  resumeFrom: EnterBattleResumeFrom | undefined,
  step: EnterBattleResumeFrom,
): boolean {
  if (!resumeFrom) return true;
  const order: EnterBattleResumeFrom[] = ["conditional", "nc", "tail"];
  const from = resumeFrom.startsWith("conditional") ? "conditional" : resumeFrom;
  return order.indexOf(step) >= order.indexOf(from);
}

/** 条件の効果（conditional）のどの区切りから処理するか（"conditional:<n>" なら n、それ以外は先頭）。 */
function conditionalResumeIndex(resumeFrom: EnterBattleResumeFrom | undefined): number {
  const m = resumeFrom ? /^conditional:(\d+)/.exec(resumeFrom) : null;
  return m ? Number(m[1]) : 0;
}

/** 再開時、DSL の「出たとき」の効果を処理済み（handled）だったか（区切り 0 で記録したもの）。 */
function conditionalResumeDslHandled(resumeFrom: EnterBattleResumeFrom | undefined): boolean {
  return !!resumeFrom && /^conditional:\d+:dsl$/.test(resumeFrom);
}

/**
 * 条件の効果の途中で選択が開いたときの再開位置。以前は "nc" で再開していたため、選択を開いた効果より後ろの
 * 「出たとき」の効果（RK-274 ビートチェイサー【ニューマシンの性能】等）が、先に別の選択が開くと発動の機会ごと失われていた。
 */
function conditionalResumeMarker(next: number, dslHandled: boolean): EnterBattleResumeFrom {
  return dslHandled ? `conditional:${next}:dsl` : `conditional:${next}`;
}

/** Event Listener から呼ばれる進入効果の実装本体。 */
export function resolveEnterBattleEffectsImpl(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
  options?: {
    battleBeforeEnter?: CardInstance[];
    rideOff?: boolean;
    resumeFrom?: EnterBattleResumeFrom;
  },
): ComboOutcome {
  const definition = getDefinition(state.definitions, card.cardId);
  const logs: string[] = [];
  let nextState = state;
  const resumeFrom = options?.resumeFrom;
  const battleBeforeEnter =
    options?.battleBeforeEnter ??
    state.players[playerId].battle.filter((c) => c.instanceId !== card.instanceId);

  let battleCard = card;
  if (!resumeFrom && card.jointComboGrants) {
    // バトルエリアに出直したユニットは、前に得た JC の能力を持たない（R-CN-06）。
    const { jointComboGrants: _stale, ...fresh } = card;
    battleCard = fresh;
    nextState = patchPlayer(nextState, playerId, (player) => ({
      ...player,
      battle: player.battle.map((c) => (c.instanceId === card.instanceId ? fresh : c)),
    }));
  }
  if (!resumeFrom) {
    if (sComboFinisherApplies(nextState, playerId, card)) {
      {
        logs.push(
          buildLogEntry(
            playerId,
            "s_combo_finisher",
            card.cardId,
            state.definitions,
            String(battlePosition),
          ),
        );
      }
    }
    // RS-234【ウイングペンタクト】: アバレキラーからコンビネーションする「WB」の M ユニット。
    nextState = applyWingPentactOnCombo(nextState, playerId, card, battleBeforeEnter);
    // RS-273〜276 ファイブマン（NC）: アタックしなかったファイブマンの次にコンビネーションする S ユニット。
    nextState = applyFivemanOnCombo(nextState, playerId, card, battleBeforeEnter);
    // RK-239 ウエイクアップ！: ホールド状態で出たかを、出たときに記録する（rules/rk/rk12UnitEffects.ts）。
    nextState = rk12MarkHeldEntry(nextState, playerId, card);
  }

  if (shouldRunEnterStep(resumeFrom, "conditional")) {
    // 条件の効果は区切りごとに再開できる（先に開いた選択を解決したあと、残りの「出たとき」の効果を落とさない）。
    const condFrom = conditionalResumeIndex(resumeFrom);
    let dslHandled = conditionalResumeDslHandled(resumeFrom);
    const enterEffect = getEnterBattleEffect(card.cardId);
    const namedEnter = getEnterBattleNamedEffect(card.cardId);
    const conditional = getConditionalNamedEffect(card.cardId);
    const resumeAt = (next: number): EnterBattleResumeFrom => conditionalResumeMarker(next, dslHandled);
    switch (condFrom) {
      case 0: {
        // NC の成立（ナンバーの欄の効果の有効化）は、出たときの並び順で先に判定しておく。ナンバーの欄の効果のうち
        // 出たときに処理する効果（RS-141【紐拳】等）も、成立していなければ発動しない（R-CN-02 / R-CN-04）。
        if (isOwnBattlePhase(nextState, playerId) && definition) {
          nextState = markOnAttackNcEffectOnEnter(
            nextState,
            playerId,
            card,
            definition,
            battlePosition,
            battleBeforeEnter,
          );
          battleCard =
            nextState.players[playerId].battle.find((c) => c.instanceId === card.instanceId) ?? battleCard;
        }

        const dslEnter = tryResolveDslTriggeredEffects({
          state: nextState,
          cardId: card.cardId,
          instanceId: card.instanceId,
          playerId,
          phasePlayerId: playerId,
          triggerType: "enter_battle",
          logAction: "enter_battle",
        });
        nextState = dslEnter.state;
        logs.push(...dslEnter.logs);
        dslHandled = dslEnter.handled;
        // RS-291【大火炎】: 「レッド」を持つユニットからコンビネーションするとき。
        nextState = trySet5AOnComboEnter(nextState, playerId, battleCard, battleBeforeEnter);
        // RM-022 サイバリアン（ライドして一緒に出たビークルの【サイバリアンレーザースピード】。ほかの選択があればその後に開く。rules/rm/rm2Effects.ts）。
        nextState = tryRm2OnEnterBattle(nextState, playerId, battleCard);
        // RM-047 ダークジェイカー・RM-053 スタッガータンク・RM-054 レッドジャイロ（ライドされて一緒に出たビークルの効果。rules/rm/rm3Effects.ts）。
        nextState = tryRm3OnEnterBattle(nextState, playerId, battleCard);
        // クロスギャザー ザ・Wインパクト XG3 の「バトルエリアに出たとき」「〜からコンビネーションするとき」（rules/xg3/xg3Effects.ts）。
        nextState = tryXg3OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(1) };
        }
      }
      // falls through
      case 1: {
        // RS-419【ゴールデンクラッシュ】: DA 以外のユニットからコンビネーションするとき（rules/legend1/set6NamedEffectsB.ts）。
        nextState = trySet6BOnComboEnter(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(2) };
        }
      }
      // falls through
      case 2: {
        // RS-452 テトラボーイ【テトラバスター】・※（敵軍の BP6000 以上が出たとき）（rules/legend1/set7NamedEffectsA.ts）。
        nextState = trySet7AOnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(3) };
        }
      }
      // falls through
      case 3: {
        // 第9弾 RS-653【後輩戦士への叱咤】・RS-654【先輩戦士の教え】・RS-669【アイスエイジエクスプレス】（rules/legend1/set9NamedEffectsC.ts）。
        nextState = trySet9COnComboEnter(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(4) };
        }
      }
      // falls through
      case 4: {
        // RK-020 ダブルライダーキック: 選んだ2体が自軍バトルエリアで隣り合ったとき（rules/rk/rk1NamedEffects.ts）。
        nextState = tryRk1OnEnterBattle(nextState, playerId, battleCard);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(5) };
        }
      }
      // falls through
      case 5: {
        // RK-024/RK-028/RK-030 ライドして一緒に出たビークルの進入効果・RK-033/RK-038 のコンビネーション（rules/rk/rk2UnitEffects.ts）。
        nextState = tryRk2OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(6) };
        }
      }
      // falls through
      case 6: {
        // RK-064/RK-067/RK-068/RK-069 のコンビネーション（rules/rk/rk4UnitEffects.ts）。
        nextState = tryRk4OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(7) };
        }
      }
      // falls through
      case 7: {
        // RK-103【ブラストペガサス】のコンビネーション（rules/rk/rk5UnitEffects.ts）。
        nextState = tryRk5OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        // RK-109【自己修復能力】・RK-114【デッドエンド】・RK-115/RK-117 のコンビネーション（rules/rk/rk6UnitEffects.ts）。
        const beforeRk6Choice = nextState.pendingEffectChoice;
        nextState = tryRk6OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk6Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(8) };
        }
      }
      // falls through
      case 8: {
        // RK-175【ライダーキック】の次のユニットの BP・RK-179/RK-189（ライドして出たビークル）（rules/rk/rk9UnitEffects.ts）。
        const beforeRk9Choice = nextState.pendingEffectChoice;
        nextState = tryRk9OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk9Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(9) };
        }
      }
      // falls through
      case 9: {
        // RK-198【ドライブディバイダー】（「レイヨウ型」からのコンビネーション。rules/rk/rk10UnitEffects.ts）。
        const beforeRk10Choice = nextState.pendingEffectChoice;
        nextState = tryRk10OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk10Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(10) };
        }
      }
      // falls through
      case 10: {
        // RK-239 ウエイクアップ！・RK-243【ドラゴンライダーキック】（rules/rk/rk12UnitEffects.ts）。
        const beforeRk12Choice = nextState.pendingEffectChoice;
        nextState = tryRk12OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk12Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(11) };
        }
      }
      // falls through
      case 11: {
        // RK-256・RK-264・RK-265（ライドして一緒に出たビークル）（rules/rk/rk13UnitEffects.ts）。
        const beforeRk13Choice = nextState.pendingEffectChoice;
        nextState = tryRk13OnEnterBattle(nextState, playerId, battleCard);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk13Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(12) };
        }
      }
      // falls through
      case 12: {
        // RK-274・RK-289（ライドして一緒に出たビークル）・RK-275/276/290/291（出たとき）・RK-278/284（コンビネーション）・RK-294（NC）
        // （rules/rk/rk14UnitEffects.ts）。
        const beforeRk14Choice = nextState.pendingEffectChoice;
        nextState = tryRk14OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter, battlePosition);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk14Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(13) };
        }
      }
      // falls through
      case 13: {
        // RK-298・RK-299・RK-306・RK-314（自軍ターン中に出たとき）・RK-301（カブトエクステンダーからのコンビネーション）（rules/rk/rk15UnitEffects.ts）。
        const beforeRk15Choice = nextState.pendingEffectChoice;
        nextState = tryRk15OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk15Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(14) };
        }
      }
      // falls through
      case 14: {
        // RK-318・RK-321・RK-329・RK-331（自軍ターン中に出たとき）・RK-325（ライドして一緒に出たビークル）・RK-332（「ドラゴン」からのコンビネーション）
        // （rules/rk/rk16UnitEffects.ts）。
        const beforeRk16Choice = nextState.pendingEffectChoice;
        nextState = tryRk16OnEnterBattle(nextState, playerId, battleCard, battleBeforeEnter);
        if (nextState.pendingEffectChoice && nextState.pendingEffectChoice !== beforeRk16Choice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(15) };
        }
      }
      // falls through
      case 15: {
        // RS-523 臨気で得た能力・RS-521 スーパー戦隊魂（レッドが出たとき）（rules/legend1/set8NamedEffectsA.ts）。
        nextState = trySet8AOnEnterBattle(nextState, playerId, battleCard, isOwnBattlePhase(nextState, playerId));
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(16) };
        }
      }
      // falls through
      case 16: {

        nextState = applyBeastSwordHoldOnEnter(nextState, playerId, battleCard);
        nextState = applyVCommanderHoldOnEnter(nextState, playerId, battleCard);
        nextState = tryMereChameleonOnAllyEnterBattle(
          nextState,
          playerId,
          battleCard,
          playerId,
        );
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(17) };
        }
      }
      // falls through
      case 17: {

        nextState = tryPowerFaceupRaidaOnAllyEnter(
          nextState,
          playerId,
          battleCard,
          playerId,
        );
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(18) };
        }
      }
      // falls through
      case 18: {

        // RS-436 激気等の常駐: 特徴「X」を持つ自軍 S ユニットが出たとき、手札から WB の M ユニットを出せる（任意）。
        nextState = tryResidentRushOnAllyEnterBattle(nextState, playerId, battleCard);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: resumeAt(19) };
        }
      }
      // falls through
      case 19: {

        if (!dslHandled && enterEffect === "destroy_enemy_bp4000") {
          const withChoice = tryStartDestroyEnemyChoice(
            nextState,
            playerId,
            card.cardId,
            4000,
            playerId,
          );
          if (withChoice) {
            nextState = withChoice;
            logs.push(
              buildLogEntry(playerId, "enter_battle", card.cardId, state.definitions, "destroy_choice"),
            );
            return { state: nextState, logs, enterResumeFrom: resumeAt(20) };
          }
        }
      }
      // falls through
      case 20: {
        if (!dslHandled && enterEffect === "sky_magic_slash") {
          const slash = resolveSkyMagicSlash(nextState, playerId, card.cardId, card.instanceId);
          nextState = slash.state;
          logs.push(...slash.logs);
          if (nextState.pendingEffectChoice) {
            return { state: nextState, logs, enterResumeFrom: resumeAt(21) };
          }
        }
      }
      // falls through
      case 21: {
        if (
          !dslHandled &&
          (enterEffect === "mane_hurricane" || enterEffect === "ruin_excavation")
        ) {
          const legend2 = resolveLegend2EnterBattle(nextState, playerId, card.cardId, enterEffect);
          nextState = legend2.state;
          logs.push(...legend2.logs);
          if (nextState.pendingEffectChoice) {
            return { state: nextState, logs, enterResumeFrom: resumeAt(22) };
          }
        }
      }
      // falls through
      case 22: {

        if (
          !dslHandled &&
          namedEnter &&
          isLegend3EnterBattleEffect(namedEnter.effectId)
        ) {
          const legend3 = resolveLegend3EnterBattle(
            nextState,
            playerId,
            card.cardId,
            namedEnter.effectId,
          );
          nextState = legend3.state;
          logs.push(...legend3.logs);
          if (nextState.pendingEffectChoice) {
            return { state: nextState, logs, enterResumeFrom: resumeAt(23) };
          }
        }
      }
      // falls through
      case 23: {

        nextState = tryStartOpponentDrawOnEnter(
          nextState,
          playerId,
          card.cardId,
          playerId,
        );
        if (nextState.pendingEffectChoice) {
          logs.push(
            buildLogEntry(
              playerId,
              "enter_battle",
              card.cardId,
              state.definitions,
              "opponent_may_draw",
            ),
          );
          return { state: nextState, logs, enterResumeFrom: resumeAt(24) };
        }
      }
      // falls through
      case 24: {

        const dslConditional = tryStartDslConditionalChoice(
          nextState,
          playerId,
          battleCard,
          playerId,
        );
        if (dslConditional) {
          nextState = dslConditional;
          logs.push(
            buildLogEntry(
              playerId,
              "named_effect",
              card.cardId,
              state.definitions,
              "choice:dsl_conditional",
            ),
          );
          // 次の区切り（getConditionalNamedEffect）は同じ効果の従来の実装なので、二重に開かないよう飛ばす。
          return { state: nextState, logs, enterResumeFrom: "nc" };
        }
      }
      // falls through
      case 25: {

        if (
          conditional &&
          ncGateAllows(battleCard, conditional.effectId) &&
          shouldRunConditionalOnEnter(conditional.effectId) &&
          canRunEnterBattleConditionalEffect(nextState, playerId, conditional.effectId)
        ) {
          const modified = applyLegend2ConditionalModifiers(nextState, playerId, battleCard, conditional.effectId);
          if (modified !== battleCard) {
            battleCard = modified;
            const player = nextState.players[playerId];
            nextState = {
              ...nextState,
              ...updatePlayer(nextState, playerId, {
                ...player,
                battle: player.battle.map((c) =>
                  c.instanceId === card.instanceId ? modified : c,
                ),
              }),
            };
          }
          const withChoice = tryStartConditionalChoice(
            nextState,
            playerId,
            battleCard,
            conditional.effectId,
            playerId,
          );
          if (withChoice) {
            nextState = withChoice;
            logs.push(
              buildLogEntry(
                playerId,
                "named_effect",
                card.cardId,
                state.definitions,
                `choice:${conditional.effectId}`,
              ),
            );
            return { state: nextState, logs, enterResumeFrom: "nc" };
          }
        }
      }
    }


    if (nextState.pendingEffectChoice) {
      return { state: nextState, logs, enterResumeFrom: "nc" };
    }
  }

  if (shouldRunEnterStep(resumeFrom, "nc")) {
    // ルール: R-CN-04 — コンビネーションは自軍バトルフェイズにバトルエリアへ出たときだけ（ラッシュフェイズに
    // 置かれたレッドレーサー等は並び順が CN と一致しても NC を発動しない）。
    if (isOwnBattlePhase(nextState, playerId) && definition) {
      nextState = markOnAttackNcEffectOnEnter(
        nextState,
        playerId,
        card,
        definition,
        battlePosition,
        battleBeforeEnter,
      );
    }
    if (
      isOwnBattlePhase(nextState, playerId) &&
      definition &&
      numberComboTriggers(
        nextState,
        playerId,
        card,
        definition,
        battlePosition,
        battleBeforeEnter,
      )
    ) {
      // RK-272【ライジングスプラッシュドラゴン】: 敵軍のクウガRD の持ち主が NC の効果を無効にするか（rules/rk/rk13UnitEffects.ts）。
      const splash = checkRk13SplashBeforeNc(nextState, playerId, card);
      if (splash.decision === "open") {
        return { state: splash.state, logs, enterResumeFrom: "nc" };
      }
      // RS-418【炎の眼光】: 敵軍のイフリートが NC の効果を無効にするか（rules/legend1/set6NamedEffectsB.ts）。
      const glare: ReturnType<typeof checkFlameGlare> = splash.decision === "negate" ? { decision: "negate" } : checkFlameGlare(nextState, playerId, card);
      if (glare.decision === "open") {
        return { state: glare.state, logs, enterResumeFrom: "nc" };
      }
      nextState = clearRk13NcNegation(nextState);
      if (glare.decision === "negate") {
        nextState = clearFlameGlareDecision(nextState);
        nextState = negateNcOnUnit(nextState, playerId, card.instanceId);
      } else {
        // RS-477 ガオウルフ【威圧する咆哮】: 敵軍の NC の効果を発動する前に発動できる（rules/legend1/set7NamedEffectsC.ts）。
        const wolfRoar = openWolfRoarBeforeNc(nextState, playerId, card);
        if (wolfRoar) return { state: wolfRoar, logs, enterResumeFrom: "nc" };
        nextState = clearWolfRoarDecision(clearFlameGlareDecision(nextState));
        const ncEffect = resolveNamedNcEffectId(
          nextState,
          playerId,
          card,
          definition,
          battlePosition,
          battleBeforeEnter,
        );
        // RS-609【戦士の魂】: 本来の NC の効果のかわりに、選んだユニットの NC の効果を発動するか（rules/legend1/set9NamedEffectsA.ts）。
        const warriorSoul = openWarriorSoulNcChoice(nextState, playerId, card, ncEffect);
        if (warriorSoul) return { state: warriorSoul, logs, enterResumeFrom: "tail" };
        const ncResult = applyNumberComboEffect(nextState, playerId, card, ncEffect);
        nextState = ncResult.state;
        logs.push(...ncResult.logs);
        if (nextState.pendingEffectChoice) {
          return { state: nextState, logs, enterResumeFrom: "tail" };
        }
      }
    }
    // RS-222 タイムピンク【戦闘指揮】: ナンバーに関係なく NC を発動するか（敵軍コマンドをリリース）。
    if (definition) {
      const withConfirm = tryOpenBattleCommand(
        nextState,
        playerId,
        card,
        definition,
        battlePosition,
        battleBeforeEnter,
      );
      if (withConfirm?.pendingEffectChoice) return { state: withConfirm, logs, enterResumeFrom: "tail" };
      if (withConfirm) nextState = withConfirm;
    }
  }

  if (shouldRunEnterStep(resumeFrom, "tail")) {
    const jointResult = resolveJointCombosOnEnter(nextState, playerId, card.instanceId);
    nextState = jointResult.state;
    logs.push(...jointResult.logs);

    if (options?.rideOff) {
      const rcResult = resolveRidingComboOnRideOff(nextState, playerId, card);
      nextState = rcResult.state;
      logs.push(...rcResult.logs);
    }

    const baseAttack = applyBaseAttackOnEnter(
      nextState,
      playerId,
      battleCard,
      battleBeforeEnter,
    );
    nextState = baseAttack.state;
    logs.push(...baseAttack.logs);

    const destroyOnEnter = applyDestroyOnEnterBattle(
      nextState,
      playerId,
      battleCard.instanceId,
      playerId,
    );
    nextState = destroyOnEnter.state;
    logs.push(...destroyOnEnter.logs);

    // RS-259【ゴレンジャーハリケーン】（モモレンジャーから順にコンビネーションしたアカレンジャー）。
    const hurricane = applyGorengerHurricaneOnEnter(nextState, playerId, battleCard.instanceId);
    nextState = hurricane.state;
    logs.push(...hurricane.logs);

    // RS-029【勇気の魔法】は任意（選択を開く）ため、進入処理の最後に置く（後続の処理を再開しなくてよい）。
    const courage = applyCourageMagicRelease(nextState, playerId, card.cardId);
    nextState = courage.state;
    if (courage.log) logs.push(courage.log);
  }

  return { state: nextState, logs };
}

registerEnterBattleEffectsImpl(resolveEnterBattleEffectsImpl);

/** `UnitEnteredBattle` イベント経由で進入効果を解決する（後方互換 API）。 */
export function resolveEnterBattleEffects(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
  options?: {
    battleBeforeEnter?: CardInstance[];
    rideOff?: boolean;
    resumeFrom?: EnterBattleResumeFrom;
  },
): ComboOutcome {
  return emitUnitEnteredBattleEffects(state, playerId, card, battlePosition, options);
}

/** コンボ選択後に戦闘進入解決を再開（攻撃/ストライクプロンプトの前）。 */
export function continueEnterBattleEffects(
  state: GameState,
  entry: PendingBattleEntry,
): ComboOutcome {
  if (!entry.resumeEnterBattle) return { state, logs: [] };

  const player = state.players[entry.playerId];
  const card = player.battle.find((c) => c.instanceId === entry.instanceId);
  if (!card) return { state, logs: [] };

  const battleBeforeEnter = entry.resumeEnterBattle.battleBeforeEnterInstanceIds
    .map((id) => player.battle.find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c);

  return resolveEnterBattleEffects(state, entry.playerId, card, entry.resumeEnterBattle.battlePosition, {
    battleBeforeEnter,
    rideOff: entry.resumeEnterBattle.rideOff,
    resumeFrom: entry.resumeEnterBattle.from,
  });
}

export function battlePositionAfterMove(currentBattle: CardInstance[]): number {
  return countLogicalBattleSlots(currentBattle) + 1;
}

export function canStrikeUnit(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
  state?: GameState,
  playerId?: PlayerId,
): boolean {
  if (isVehicle(getDefinition(definitions, instance.cardId))) return false;
  // ルール: R-HOLD-03 — ホールド中のストライク可否は [未確定]。従来どおり不可。
  if (instance.registerHeld) return false;
  // XG1-028 アバレンオージ: ※これはホールド状態のときストライクできない（出典: atwiki/page-1665）。
  if (instance.cardId === "XG1-028" && instance.commandHeld) return false;
  if (state && playerId) {
    if (hasBakiBakiExtraAttackOnly(state, playerId, instance.instanceId)) {
      return false;
    }
    // RS-172【ショベルディフェンス】: コンビネーションが成立している間、敵軍ユニットはストライクできない。
    if (shovelDefenseBlocksStrike(state, playerId)) {
      return false;
    }
    if (cannotAttackOrStrikeThisTurn(state.players[playerId], instance)) {
      return false;
    }
    if (
      // 「※ホールド状態のコマンドがあるとき」— 自軍・敵軍を問わない（RS-636〜RS-638。atwiki/page-1488・page-1463 カード評価）。
      cardHasGrantKeyword(instance.cardId, "no_strike_with_held_command") &&
      (countHeldCommands(state.players[playerId]) > 0 || countHeldCommands(state.players[opponent(playerId)]) > 0)
    ) {
      return false;
    }
    if (
      (cardHasGrantKeyword(instance.cardId, "no_strike_if_enemy_battle") ||
        hasUnnamedRule(instance.cardId, "no_strike_if_enemy_battle")) &&
      state.players[opponent(playerId)].battle.some((c) =>
        isUnit(getDefinition(state.definitions, c.cardId)),
      )
    ) {
      return false;
    }
    if (wingTurnBlocksStrike(state.players[playerId], instance.instanceId)) {
      return false;
    }
    // RS-661 幻獣王リオ ※「これはラッシュしたターン、ストライクできない。」（rules/legend1/set9NamedEffectsC.ts）。
    if (set9CBlocksStrike(state, playerId, instance)) return false;
    if (rideOffBlocksStrike(state.players[playerId], instance.instanceId)) {
      return false;
    }
    // 第6弾 RS-431 ※「自軍コマンドが１つ以上あるときストライクできない」等（rules/legend1/set6NamedEffectsB.ts）。
    if (set6BBlocksStrike(state, playerId, instance)) {
      return false;
    }
    // RS-523 臨気「ただし、ストライクすることはできない。」（rules/legend1/set8NamedEffectsA.ts）。
    if (set8ABlocksStrike(state, playerId, instance)) {
      return false;
    }
    if (instance.activatedNcEffects?.includes("souru_no_strike")) {
      return false;
    }
    if (!canStrikeWithHelloMirage(state, playerId, instance)) {
      return false;
    }
    // RS-370 ブラックマスク: ※特徴「女」を持つ敵軍ユニットがあるときストライクできない
    // （この制限は自軍ダメージが4点以上あれば無効になる）（atwiki/page-566）。
    const ownDamage = Math.max(
      state.players[playerId].damage,
      state.players[playerId].power.filter((c) => c.faceDown).length,
    );
    if (instance.cardId === "RS-370" && ownDamage < 4) {
      const enemy = state.players[opponent(playerId)];
      const enemyHasFemale = [...enemy.rush, ...enemy.battle].some((c) =>
        (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("女"),
      );
      if (enemyHasFemale) return false;
    }
    // XG2-101: can't strike if enemy has any メカ unit
    if (instance.cardId === "XG2-101") {
      const enemyId = opponent(playerId);
      const enemyHasMecha = [...state.players[enemyId].rush, ...state.players[enemyId].battle].some(
        (c) => {
          const d = getDefinition(state.definitions, c.cardId);
          return d?.features?.includes("メカ");
        },
      );
      if (enemyHasMecha) return false;
    }
    // RM-018: can't strike if other own S-units are present
    if (instance.cardId === "RM-018") {
      const player = state.players[playerId];
      const otherSUnits = [...player.rush, ...player.battle].filter(
        (c) => c.instanceId !== instance.instanceId && isSmallUnit(state.definitions, c),
      );
      if (otherSUnits.length > 0) return false;
    }
    if (wingAllowsEmptyBattleStrike(state, playerId, instance)) {
      return legend3EffectiveSp(state, playerId, instance) >= 1;
    }
    return legend3EffectiveSp(state, playerId, instance) >= 1;
  }

  const def = getDefinition(definitions, instance.cardId);
  const sp = def?.sp;
  const modifier = instance.spModifier ?? 0;
  if (typeof sp === "number") return sp + modifier >= 1;
  if (sp === "special") return modifier >= 1;
  return modifier >= 1;
}

export function strikeDamageFor(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
  state?: GameState,
  playerId?: PlayerId,
): number {
  if (state && playerId) {
    return legend3EffectiveSp(state, playerId, instance);
  }

  const def = getDefinition(definitions, instance.cardId);
  const modifier = instance.spModifier ?? 0;
  const printed = instance.spOverride ?? def?.sp;
  if (printed === "special") return modifier;
  if (typeof printed === "number") return printed + modifier;
  if (typeof printed === "string" && printed.includes("/")) return modifier;
  return modifier;
}

registerBattleCommandHooks({
  ncEffectiveNumber,
  hasNcEffect: (card) =>
    listNcColumnNamedEffects(card.cardId).length > 0 || getNumberComboEffect(card.cardId) !== undefined,
  establishNc: (state, playerId, card, number) => {
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition) return { state, logs: [] };
    const before = state.players[playerId].battle.filter((c) => c.instanceId !== card.instanceId);
    let next = markOnAttackNcEffectOnEnter(state, playerId, card, definition, number, before);
    if (!numberComboTriggers(next, playerId, card, definition, number, before)) return { state: next, logs: [] };
    const ncEffect = resolveNamedNcEffectId(next, playerId, card, definition, number, before);
    const result = applyNumberComboEffect(next, playerId, card, ncEffect);
    next = result.state;
    return { state: next, logs: result.logs };
  },
});
