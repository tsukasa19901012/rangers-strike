/**
 * プロモーションカード（rules/promo/*）の入口。カードのモジュールを読み込んで登録し、登録先の関数を再エクスポートする。
 */
import "./xpEffects";
import "./pkEffects";

export { isPromoAttackedChoice, openPromoAttacked, resolvePromoAttacked, skipPromoAttacked } from "./xpEffects";

export {
  PROMO_KEYWORD_PREFIX,
  applyPromoAfterAction,
  canConfirmPromoChoice,
  isPromoChoiceEffect,
  tryConfirmPromoChoice,
  tryPromoCardEffect,
  tryResolvePromoChoice,
  trySkipPromoChoice,
} from "./promoRegistry";
