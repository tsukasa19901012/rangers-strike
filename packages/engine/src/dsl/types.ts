import type { GameEventType } from "../events/types";
import type { EffectTrigger } from "@rangers-strike/cards/dsl/types";

/** JSON DSL 効果定義（Phase 5 接続用スキーマ）。 */
export type DslEffectDefinition = {
  effectId: string;
  sourceCardId?: string;
  trigger: GameEventType | "manual";
  primitives: DslPrimitive[];
  /** cardInterpreter 経由で解決（Event registry 統合）。 */
  useCardInterpreter?: boolean;
  dslTriggerType?: EffectTrigger["type"];
};

export type DslPrimitive =
  | { op: "modify_bp"; delta: number; target: "self" | "enemy_battle" }
  | { op: "draw"; count: number }
  | { op: "damage"; amount: number; target: "opponent" }
  | { op: "add_turn_rule"; ruleId: string }
  | { op: "add_combo_number_delta"; delta: number }
  | { op: "set_aura_power"; targetInstanceId: string };

export type DslExecutionContext = {
  effectId: string;
  sourceCardId: string;
  playerId: import("../types/game").PlayerId;
};
