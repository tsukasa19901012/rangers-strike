import type {
  NamedEffectTrigger,
  NamedUnitEffect,
  UnitEffectBlock,
  UnnamedUnitRule,
  UnnamedUnitText,
} from "./effectTaxonomy";
import legend1UnitEffectsJson from "./legend1/unitEffects.json";
import legend2UnitEffectsJson from "./legend2/unitEffects.json";
import legend3UnitEffectsJson from "./legend3/unitEffects.json";

export type {
  NamedEffectTrigger,
  NamedUnitEffect,
  UnitEffectBlock,
  UnnamedUnitRule,
  UnnamedUnitText,
};
export type { NamedEffectTrigger as EffectTrigger } from "./effectTaxonomy";

const UNIT_EFFECTS = {
  ...(legend1UnitEffectsJson as Record<string, UnitEffectBlock>),
  ...(legend2UnitEffectsJson as Record<string, UnitEffectBlock>),
  ...(legend3UnitEffectsJson as Record<string, UnitEffectBlock>),
};

export function getUnitEffectBlock(cardId: string): UnitEffectBlock | undefined {
  return UNIT_EFFECTS[cardId];
}

export function listUnnamedRules(cardId: string): UnnamedUnitRule[] {
  const block = UNIT_EFFECTS[cardId];
  if (!block) return [];
  return block.unnamedText
    .map((u) => u.rule)
    .filter((rule): rule is UnnamedUnitRule => rule !== undefined);
}

export function hasUnnamedRule(cardId: string, rule: UnnamedUnitRule): boolean {
  return listUnnamedRules(cardId).includes(rule);
}

function sumUnnamedRuleParam(
  cardId: string,
  rule: UnnamedUnitRule,
  param: "holdCount" | "damage" | "discardCount",
  defaultValue: number,
): number {
  const block = UNIT_EFFECTS[cardId];
  if (!block) return 0;
  return block.unnamedText
    .filter((u) => u.rule === rule)
    .reduce((sum, u) => sum + (u[param] ?? defaultValue), 0);
}

/** このゾードの 合体― 行に載る合体ユニット（zord-up 素材）。 */
export function listZordFusionPartnerIds(zordCardId: string): string[] {
  const block = UNIT_EFFECTS[zordCardId];
  if (!block) return [];
  const zord = block.unnamedText.find((entry) => entry.kind === "zord");
  return zord?.partnerCardIds ?? [];
}

/** unitEffects.json 全体で 合体― パートナーとして参照されるカード id 一覧。 */
export function buildFusionPartnerIdSet(): Set<string> {
  const ids = new Set<string>();
  for (const block of Object.values(UNIT_EFFECTS)) {
    for (const entry of block.unnamedText) {
      if (entry.kind !== "zord") continue;
      for (const partnerId of entry.partnerCardIds ?? []) {
        ids.add(partnerId);
      }
    }
  }
  return ids;
}

function battleHasPartner(
  battle: Array<{ instanceId: string; cardId: string }>,
  partnerCardIds: string[],
  excludeInstanceId: string,
): boolean {
  return battle.some(
    (c) => c.instanceId !== excludeInstanceId && partnerCardIds.includes(c.cardId),
  );
}

/** バトル投入時に発火すべき NC 効果名（CN/NC または文面上書き）。 */
export function findNcNamedEffect(
  cardId: string,
  battlePosition: number,
  effectiveComboNumber: number,
  battleBeforeEnter: Array<{ instanceId: string; cardId: string }>,
  excludeInstanceId: string,
): NamedUnitEffect | undefined {
  const block = UNIT_EFFECTS[cardId];
  if (!block) return undefined;

  for (const named of block.namedEffects) {
    if (named.trigger.type === "nc_or_combo_from") {
      const fromPartners = battleHasPartner(
        battleBeforeEnter,
        named.trigger.partnerCardIds,
        excludeInstanceId,
      );
      const fromPosition = effectiveComboNumber === battlePosition;
      if (fromPartners || fromPosition) return named;
      continue;
    }
    if (named.trigger.type === "nc" && effectiveComboNumber === battlePosition) {
      return named;
    }
  }

  return undefined;
}

export function getEnterBattleNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "enter_battle",
  );
}

/** エンジンハンドラ用 NC 効果マップ（実装済み id のみ）。 */
export function listNcNamedEffects(): Array<{ cardId: string; effectId: string }> {
  const results: Array<{ cardId: string; effectId: string }> = [];
  for (const [cardId, block] of Object.entries(UNIT_EFFECTS)) {
    for (const named of block.namedEffects) {
      if (named.trigger.type === "nc" || named.trigger.type === "nc_or_combo_from") {
        results.push({ cardId, effectId: named.effectId });
      }
    }
  }
  return results;
}

export function listAltNcPartnerIds(cardId: string): string[] {
  const block = UNIT_EFFECTS[cardId];
  if (!block) return [];
  for (const named of block.namedEffects) {
    if (named.trigger.type === "nc_or_combo_from") {
      return named.trigger.partnerCardIds;
    }
  }
  return [];
}

export function getOnRushNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "on_rush",
  );
}

export function getOnAttackNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "on_attack",
  );
}

export function getConditionalNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "conditional",
  );
}

export function getJointLNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "joint_combo_l",
  );
}

export function getJointRNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "joint_combo_r",
  );
}

export function getRidingComboNamedEffect(cardId: string): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.trigger.type === "riding_combo",
  );
}

function listNamedEffectsByTrigger(
  triggerType: NamedEffectTrigger["type"],
): Array<{ cardId: string; effectId: string }> {
  const results: Array<{ cardId: string; effectId: string }> = [];
  for (const [cardId, block] of Object.entries(UNIT_EFFECTS)) {
    for (const named of block.namedEffects) {
      if (named.trigger.type === triggerType) {
        results.push({ cardId, effectId: named.effectId });
      }
    }
  }
  return results;
}

export function listJointLNamedEffects(): Array<{ cardId: string; effectId: string }> {
  return listNamedEffectsByTrigger("joint_combo_l");
}

export function listJointRNamedEffects(): Array<{ cardId: string; effectId: string }> {
  return listNamedEffectsByTrigger("joint_combo_r");
}

export function listRidingComboNamedEffects(): Array<{ cardId: string; effectId: string }> {
  return listNamedEffectsByTrigger("riding_combo");
}

export function getBattleEntryHoldCount(cardId: string): number {
  return sumUnnamedRuleParam(cardId, "battle_entry_hold", "holdCount", 1);
}

export function hasBattleEntryHoldNote(cardId: string): boolean {
  return getBattleEntryHoldCount(cardId) > 0;
}

/** ※ バトル投入ホールド注記のあるユニット（レジェンド1 ゾード合体パートナー等）。 */
export function listBattleEntryHoldCardIds(): string[] {
  return Object.keys(UNIT_EFFECTS)
    .filter(hasBattleEntryHoldNote)
    .sort();
}

export function hasAutoBattleEntryNote(cardId: string): boolean {
  return (
    hasUnnamedRule(cardId, "auto_battle_entry_each_turn") ||
    hasUnnamedRule(cardId, "auto_battle_entry_on_rush")
  );
}

export function hasDestroySelfDamageNote(cardId: string): boolean {
  return hasUnnamedRule(cardId, "destroy_self_damage");
}

export function getBattleEntryComboFromPartnerIds(cardId: string): string[] {
  const block = UNIT_EFFECTS[cardId];
  if (!block) return [];
  const note = block.unnamedText.find((entry) => entry.rule === "battle_entry_combo_from");
  return note?.partnerCardIds ?? [];
}

export function needsBattleEntryComboFrom(cardId: string): boolean {
  return getBattleEntryComboFromPartnerIds(cardId).length > 0;
}

export function getBattleEntryHandDiscardCount(cardId: string): number {
  return sumUnnamedRuleParam(cardId, "battle_entry_discard_from_hand", "discardCount", 2);
}

export function needsBattleEntryHandDiscard(cardId: string): boolean {
  return getBattleEntryHandDiscardCount(cardId) > 0;
}

export function battleHasComboPartner(
  battle: Array<{ instanceId: string; cardId: string }>,
  partnerCardIds: string[],
  excludeInstanceId: string,
): boolean {
  return battleHasPartner(battle, partnerCardIds, excludeInstanceId);
}

export function findNamedEffectByEffectId(
  cardId: string,
  effectId: string,
): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.effectId === effectId,
  );
}
