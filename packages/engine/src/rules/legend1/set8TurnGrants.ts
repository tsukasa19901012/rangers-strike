/**
 * 第8弾の常駐の太字部分で、このターン選んだユニット1体に付く補正（rules/legend1/set8NamedEffectsA.ts から付け、
 * core/catalog.ts unitEffectiveCategories・rules/numberComboEffects.ts ncEffectiveNumber が読む）。
 * - RS-522 ボウケンスピリッツ「このターン、選んだユニットのナンバーの数字は1増える。」（atwiki/page-1152）
 * - RS-524 呉越同舟「このターン、宣言したカテゴリを選んだユニットに追加する。」（atwiki/page-1151）
 * 依存の循環を避けるため、このモジュールは型と scopedModifiers だけに依存する。
 */
import type { Category } from "@rangers-strike/cards";
import type { CardInstance, PlayerState } from "../../types/game";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";

export const SET8_NUMBER_DELTA_RULE = "rs522_number_plus";
export const SET8_ADDED_CATEGORY_RULE = "rs524_added_category";

type NumberDeltaPayload = { instanceId: string; delta: number };
type AddedCategoryPayload = { instanceId: string; category: Category };

function payloads<T>(player: PlayerState, ruleId: string): T[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m.kind === "rule" ? (m.payload as T) : (undefined as never)))
    .filter((p): p is T => !!p);
}

export function addSet8NumberDelta(player: PlayerState, instanceId: string, delta: number, sourceCardId: string): PlayerState {
  return addTurnRuleModifier(player, SET8_NUMBER_DELTA_RULE, { sourceCardId, payload: { instanceId, delta } satisfies NumberDeltaPayload });
}

export function set8NumberDelta(player: PlayerState, instance: Pick<CardInstance, "instanceId">): number {
  return payloads<NumberDeltaPayload>(player, SET8_NUMBER_DELTA_RULE)
    .filter((p) => p.instanceId === instance.instanceId)
    .reduce((sum, p) => sum + p.delta, 0);
}

export function addSet8Category(player: PlayerState, instanceId: string, category: Category, sourceCardId: string): PlayerState {
  return addTurnRuleModifier(player, SET8_ADDED_CATEGORY_RULE, { sourceCardId, payload: { instanceId, category } satisfies AddedCategoryPayload });
}

export function set8AddedCategories(player: PlayerState, instance: Pick<CardInstance, "instanceId">): Category[] {
  return payloads<AddedCategoryPayload>(player, SET8_ADDED_CATEGORY_RULE)
    .filter((p) => p.instanceId === instance.instanceId)
    .map((p) => p.category);
}
