import { describe, expect, it } from "vitest";
import { P0_EFFECT_IDS, p0EffectToPrimitives } from "./p0Patterns";

describe("p0Patterns", () => {
  it("covers all P0 effect ids from effect_catalog", () => {
    expect(P0_EFFECT_IDS).toHaveLength(6);
  });

  it("maps grant_sp to SP1 keyword", () => {
    const primitives = p0EffectToPrimitives("grant_sp");
    expect(primitives[0]).toEqual({
      type: "grant_keyword",
      keyword: "SP1",
      duration: "turn",
    });
  });

  it("maps bp_boost to modify_bp", () => {
    const primitives = p0EffectToPrimitives("bp_boost", { bpDelta: 4000 });
    expect(primitives[0]).toMatchObject({ type: "modify_bp", amount: 4000 });
  });

  it("maps move_enemy_to_command_hold to choose + hold_command", () => {
    const primitives = p0EffectToPrimitives("move_enemy_to_command_hold", { bpDelta: 3000 });
    expect(primitives[0]?.type).toBe("choose");
    if (primitives[0]?.type === "choose") {
      expect(primitives[0].then[0]?.type).toBe("hold_command");
    }
  });
});
