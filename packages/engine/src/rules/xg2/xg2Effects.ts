/**
 * クロスギャザー XG2 のカード固有の効果の入口（central のファイルはここを読み込む）。
 * カードごとの効果を読み込んで登録し、rules/xg2/xg2Core.ts の API を出す。
 */
import "./xg2aEffects";

export {
  activateXg2Resident,
  applyXg2AfterAction,
  applyXg2OnComboEnter,
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
