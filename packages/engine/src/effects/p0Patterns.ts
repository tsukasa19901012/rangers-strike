import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";

/** effect_catalog.md P0 共通パターン → DSL primitives マッピング。 */
export type P0EffectId =
  | "grant_sp"
  | "bp_boost"
  | "require_command_hold_entry"
  | "move_enemy_to_command_hold"
  | "deal_damage"
  | "alias_fusion_material";

export function p0EffectToPrimitives(
  effectId: P0EffectId,
  params?: { amount?: number; bpDelta?: number; spLevel?: 1 | 2 | 3 },
): EffectPrimitive[] {
  switch (effectId) {
    case "grant_sp": {
      const level = params?.spLevel ?? 1;
      const keyword = level === 3 ? "SP3" : level === 2 ? "SP2" : "SP1";
      return [{ type: "grant_keyword", keyword, duration: "turn" }];
    }
    case "bp_boost":
      return [
        {
          type: "modify_bp",
          target: { type: "trigger_source" },
          amount: params?.bpDelta ?? 1000,
          duration: "turn",
        },
      ];
    case "require_command_hold_entry":
      return [
        {
          type: "grant_keyword",
          keyword: "require_command_hold_entry",
          duration: "turn",
        },
      ];
    case "move_enemy_to_command_hold":
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: {
            type: "zone",
            zone: "battle",
            owner: "opponent",
            filter: params?.bpDelta ? { maxBp: params.bpDelta } : undefined,
          },
          count: 1,
          then: [
            {
              type: "hold_command",
              target: { type: "trigger_source" },
            },
          ],
        },
      ];
    case "deal_damage":
      return [
        {
          type: "deal_damage",
          amount: params?.amount ?? 1,
          target: "controller",
        },
      ];
    case "alias_fusion_material":
      return [
        {
          type: "grant_keyword",
          keyword: "fusion_material_alias",
          duration: "permanent",
        },
      ];
    default:
      return [];
  }
}

export const P0_EFFECT_IDS: P0EffectId[] = [
  "grant_sp",
  "bp_boost",
  "require_command_hold_entry",
  "move_enemy_to_command_hold",
  "deal_damage",
  "alias_fusion_material",
];
