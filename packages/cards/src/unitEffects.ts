import type {
  NamedEffectTrigger,
  NamedUnitEffect,
  UnitEffectBlock,
  UnnamedUnitText,
} from "./effectTaxonomy";
import legend1UnitEffectsJson from "./legend1/unitEffects.json";
import legend2UnitEffectsJson from "./legend2/unitEffects.json";

export type { NamedEffectTrigger, NamedUnitEffect, UnitEffectBlock, UnnamedUnitText };
export type { NamedEffectTrigger as EffectTrigger } from "./effectTaxonomy";

const UNIT_EFFECTS = {
  ...(legend1UnitEffectsJson as Record<string, UnitEffectBlock>),
  ...(legend2UnitEffectsJson as Record<string, UnitEffectBlock>),
};

/** Match card text in unnamed ※ / rules lines. */
export function hasUnitEffectNote(cardId: string, fragment: string): boolean {
  const block = UNIT_EFFECTS[cardId];
  if (!block) return false;
  return block.unnamedText.some((u) => u.text.includes(fragment));
}

export function getUnitEffectBlock(cardId: string): UnitEffectBlock | undefined {
  return UNIT_EFFECTS[cardId];
}

/** Fusion units listed on this zord's 合体― line (zord-up material). */
export function listZordFusionPartnerIds(zordCardId: string): string[] {
  const block = UNIT_EFFECTS[zordCardId];
  if (!block) return [];
  const zord = block.unnamedText.find((entry) => entry.kind === "zord");
  return zord?.partnerCardIds ?? [];
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

/** Named NC effect that should fire on battle entry (CN/NC or text override). */
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

/** Build NC effect map for engine handlers (implemented ids only). */
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

export const BATTLE_ENTRY_HOLD_NOTE =
  "自軍コマンドを1つホールドしなければバトルエリアに出られない";

export function hasBattleEntryHoldNote(cardId: string): boolean {
  return hasUnitEffectNote(cardId, BATTLE_ENTRY_HOLD_NOTE);
}

/** Units with ※ battle-entry hold note (Legend 1 zord fusion partners, etc.). */
export function listBattleEntryHoldCardIds(): string[] {
  return Object.keys(UNIT_EFFECTS)
    .filter(hasBattleEntryHoldNote)
    .sort();
}

export function hasAutoBattleEntryNote(cardId: string): boolean {
  return (
    hasUnitEffectNote(cardId, "毎ターン、可能ならバトルエリアに出る") ||
    hasUnitEffectNote(cardId, "ラッシュするとき可能ならバトルエリアに置く")
  );
}

export function hasDestroySelfDamageNote(cardId: string): boolean {
  return hasUnitEffectNote(cardId, "撃破されたとき、1点ダメージ");
}

export function findNamedEffectByEffectId(
  cardId: string,
  effectId: string,
): NamedUnitEffect | undefined {
  return UNIT_EFFECTS[cardId]?.namedEffects.find(
    (named) => named.effectId === effectId,
  );
}
