/**
 * クロスギャザー XG2 のカード固有の効果の入口（central のファイルはここを読み込む）。
 * カードごとの効果を読み込んで登録し、rules/xg2/xg2Core.ts の API を出す。
 */
import "./xg2aEffects";
import "./xg2bEffects";
import "./xg2cEffects";
import "./xg2dEffects";

export {
  activateXg2Resident,
  applyXg2AfterAction,
  applyXg2AfterUnitLeft,
  applyXg2BattlePhaseEnd,
  applyXg2BattleToRush,
  applyXg2StartPhaseEnd,
  applyXg2TurnEnd,
  openXg2LeaveStay,
  applyXg2OnUnitLeftZone,
  applyXg2OnComboEnter,
  applyXg2OnUnitRushed,
  applyXg2ResidentPlaced,
  isXg2SelfHoldPayment,
  tryCompleteXg2HoldChoice,
  applyXg2StrikeDamageTriggers,
  canActivateXg2Resident,
  canConfirmXg2Choice,
  isXg2ActivatableResident,
  isXg2ChoiceEffect,
  openXg2OnBattlePhaseStart,
  tryConfirmXg2Choice,
  tryOpenXg2BattleChoice,
  tryResolveXg2Choice,
  trySkipXg2Choice,
  tryXg2CardEffect,
} from "./xg2Core";
export {
  activateXg2FieldAbility,
  canActivateXg2FieldAbility,
  isXg2FieldAbilityCard,
  xg2MorphStackCandidates,
  xg2MorphSwapFromStack,
} from "./xg2dEffects";
export { applyXg2BattleCounter, isXg2BattleCounterCard, isXg2BattleToRushTrigger, xg2BattleCounterConditionMet, xg2CanDeployFromDiscard, xg2DeployFromDiscard, xg2RejectsOperationTarget } from "./xg2cEffects";
