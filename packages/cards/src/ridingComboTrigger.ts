import type { ComboNumber } from "./schema";
import type { NamedEffectTrigger } from "./effectTaxonomy";
import type { EffectTrigger } from "./dsl/types";

/** 「ライドオフしたときナンバーに関係なく発動」— NC 位置と併用する RC 相当の効果。 */
export const RIDE_OFF_UNCONDITIONAL_NC_TEXT =
  /ライドオフしたときナンバーに関係なく発動/;

export function isRideOffUnconditionalEffectText(text: string): boolean {
  return RIDE_OFF_UNCONDITIONAL_NC_TEXT.test(text);
}

export function isRidingComboComboNumber(
  comboNumber: ComboNumber | undefined,
): boolean {
  return comboNumber === "RC";
}

/** DSL / Wiki の nc トリガーを RC カードでは riding_combo として扱う。 */
export function normalizeNamedComboTrigger(
  trigger: NamedEffectTrigger,
  comboNumber: ComboNumber | undefined,
): NamedEffectTrigger {
  if (
    isRidingComboComboNumber(comboNumber) &&
    (trigger.type === "nc" || trigger.type === "nc_or_combo_from")
  ) {
    return { type: "riding_combo" };
  }
  return trigger;
}

/** DSL 効果がライドオフ時 RC として解決対象か。 */
export function dslEffectMatchesRidingComboTrigger(
  effectTrigger: EffectTrigger,
  effectText: string,
  comboNumber: ComboNumber | undefined,
): boolean {
  if (effectTrigger.type === "riding_combo") return true;
  if (effectTrigger.type !== "nc") return false;
  if (isRidingComboComboNumber(comboNumber)) return true;
  return isRideOffUnconditionalEffectText(effectText);
}
