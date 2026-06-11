/**
 * カード DSL 型定義（schema/*.schema.json と同期）
 */

export type Category = "ET" | "WB" | "OT" | "MA" | "DA";
export type UnitSize = "S" | "M" | "L" | "XL" | "SC";
export type CardType = "unit" | "operation" | "vehicle" | "commander";
export type Rarity = "N" | "R" | "SR" | "NR" | "SC" | "PR";
export type ZoneName =
  | "deck"
  | "hand"
  | "discard"
  | "power"
  | "command"
  | "rush"
  | "battle"
  | "operation"
  | "exile"
  | "commander";

export type TriggerType =
  | "nc"
  | "nc_or_combo_from"
  | "enter_battle"
  | "on_rush"
  | "on_attack"
  | "on_strike"
  | "on_destroy"
  | "on_leave"
  | "on_turn_end"
  | "on_damage"
  | "joint_combo_l"
  | "joint_combo_r"
  | "riding_combo"
  | "while_in_field"
  | "operation"
  | "conditional";

export type OperationTiming = "rush" | "battle" | "counter" | "resident";

export type EffectTrigger =
  | { type: "nc" }
  | { type: "nc_or_combo_from"; partnerCardIds: string[] }
  | { type: "enter_battle" }
  | { type: "on_rush" }
  | { type: "on_attack"; comboPartnerCardIds?: string[] }
  | { type: "on_strike" }
  | { type: "on_destroy" }
  | { type: "on_leave" }
  | { type: "on_turn_end" }
  | { type: "on_damage" }
  | { type: "joint_combo_l" }
  | { type: "joint_combo_r" }
  | { type: "riding_combo" }
  | { type: "while_in_field" }
  | { type: "operation"; timing: OperationTiming }
  | { type: "conditional" };

export type PlayerRef = "controller" | "opponent" | "phase_player" | "player1" | "player2";

export type TargetSelector =
  | { type: "self" }
  | { type: "controller" }
  | { type: "opponent" }
  | { type: "trigger_source" }
  | { type: "instance"; instanceId: string }
  | { type: "card_id"; cardId: string }
  | {
      type: "zone";
      zone: ZoneName;
      owner: "self" | "opponent" | "any";
      filter?: {
        size?: UnitSize;
        category?: string;
        faceDown?: boolean;
        commandHeld?: boolean;
        maxBp?: number;
        minBp?: number;
      };
    }
  | {
      type: "zones";
      zones: Array<{
        zone: ZoneName;
        owner: "self" | "opponent" | "any";
        filter?: {
          size?: UnitSize;
          category?: string;
          faceDown?: boolean;
          commandHeld?: boolean;
          maxBp?: number;
          minBp?: number;
        };
      }>;
    };

export type EffectCondition =
  | { type: "always" }
  | { type: "has_target"; target: TargetSelector }
  | { type: "bp_compare"; target: TargetSelector; op: "<" | "<=" | ">" | ">="; value: number }
  | { type: "zone_count"; zone: ZoneName; owner: "self" | "opponent"; op: ">=" | "=="; count: number }
  | { type: "controller_is_phase_player" }
  | { type: "and"; conditions: EffectCondition[] }
  | { type: "not"; condition: EffectCondition };

export type EffectChoiceKind =
  | "deck_top_or_bottom"
  | "seabed_draw"
  | "optional_deck_draw"
  | "select_unit"
  | "select_command"
  | "select_power"
  | "select_hand"
  | "scry_keep_one"
  | "end_turn_menu"
  | "simultaneous_order"
  | "confirm";

export type EffectPrimitive =
  | { type: "draw"; amount: number; player?: PlayerRef }
  | { type: "move"; target: TargetSelector; to: ZoneName; position?: "left" | "right" }
  | { type: "discard"; target: TargetSelector }
  | { type: "flip_power"; target: TargetSelector; faceDown: boolean }
  | { type: "modify_bp"; target: TargetSelector; amount: number; duration: "turn" | "permanent" }
  | { type: "modify_sp"; target: TargetSelector; amount: number; duration: "turn" | "permanent" }
  | { type: "set_bp"; target: TargetSelector; value: number; duration: "turn" | "permanent" }
  | { type: "deal_damage"; amount: number; target: PlayerRef }
  | { type: "cancel_damage" }
  | { type: "prevent_battle" }
  | { type: "hold_command"; target: TargetSelector }
  | { type: "release_command"; target: TargetSelector }
  | { type: "block_battle_entry"; target: TargetSelector; duration: "turn" | "permanent" }
  | { type: "grant_keyword"; keyword: string; duration: "turn" | "permanent" }
  | {
      type: "choose";
      kind: EffectChoiceKind;
      valid: TargetSelector;
      count: number;
      then: EffectPrimitive[];
    }
  | { type: "open_reaction"; window: "rush" | "battle" | "strike" | "leave" }
  | { type: "enqueue_trigger"; effectId: string }
  | { type: "interpret_effect" }
  | { type: "fallback_handler"; effectId: string };

export type EffectDefinition = {
  id: string;
  name?: string;
  trigger: EffectTrigger;
  condition?: EffectCondition;
  optional?: boolean;
  text?: string;
  effects: EffectPrimitive[];
};

export type UnnamedRuleEntry = {
  kind: "note" | "zord" | "fusion";
  text: string;
  rule?: string;
  holdCount?: number;
  damage?: number;
  discardCount?: number;
  partnerCardIds?: string[];
};

export type ZordConditionId =
  | "discard_fusion_unit"
  | "send_s_unit_to_power"
  | "send_s_unit_to_discard"
  | "send_s_unit_to_command_or_discard";

export type RushAdditionalCondition = {
  conditionId: ZordConditionId;
  text: string;
  unitCount?: number;
};

export type ImplementationMeta = {
  source: "dsl" | "legacy_unit_effects" | "legacy_operation" | "hybrid";
  handler: "interpreter" | "typescript" | "unimplemented";
  testGenerated?: boolean;
};

/** 統合カードドキュメント（card.schema.json） */
export type CardDocument = {
  $schema?: string;
  id: string;
  name: string;
  type: CardType;
  category: Category | Category[];
  rarity: Rarity;
  expansion: string;
  powerCost: number | string;
  bp?: number;
  sp?: number | "special" | `${number}/${number}` | null;
  size?: UnitSize;
  comboNumber?: number | "L" | "R" | "RC" | null;
  text?: string;
  rawText?: string;
  effectId?: string;
  tags?: string[];
  features?: string[];
  imageUrl?: string;
  imageSourceUrl?: string;
  rushAdditionalCondition?: RushAdditionalCondition;
  unnamedRules?: UnnamedRuleEntry[];
  effects?: EffectDefinition[];
  implementation?: ImplementationMeta;
};

export type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export const CARD_ID_PATTERN = /^[A-Z]{2,3}\d?-\d{3}$/;
export const EFFECT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
/** ゾードアップ/ダウン可能な必要パワー（例: 7+, 7-） */
export const ZORD_POWER_COST_PATTERN = /^\d+[+-]$/;
