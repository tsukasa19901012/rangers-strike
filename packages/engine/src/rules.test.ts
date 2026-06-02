import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { createTestState, heldEtCommand, heldMaCommand, heldOtCommand, heldWbCommand, inst } from "./testing/fixtures";

describe("zord-up rush", () => {
  const abarenohDef = {
    id: "RS-050",
    name: "Abarenoh",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "SR" as const,
    expansion: "test",
    powerCost: "7+" as const,
    bp: 13000,
    size: "L" as const,
    sp: 1 as const,
  };

  const fusionDef = (id: string, name: string) => ({
    id,
    name,
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 3,
    bp: 4000,
    size: "M" as const,
  });

  it("requires all AbarenOh fusion partners to rush RS-050", () => {
    const zord = inst("RS-050", "z1");
    const tyranno = inst("RS-051", "f1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 7 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldWbCommand("c1")],
        rush: [tyranno],
      },
    });

    state.definitions["RS-050"] = abarenohDef;
    state.definitions["RS-051"] = fusionDef("RS-051", "Tyranno");

    const rushes = getLegalActions(state).filter(
      (a) => a.type === "rush" && a.instanceId === zord.instanceId,
    );
    expect(rushes).toHaveLength(0);
  });

  it("discards all three fusion units when rushing RS-050", () => {
    const zord = inst("RS-050", "z1");
    const tyranno = inst("RS-051", "f1");
    const tricera = inst("RS-052", "f2");
    const ptera = inst("RS-053", "f3");
    let state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 7 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldWbCommand("c1")],
        rush: [tyranno, tricera, ptera],
      },
    });

    state.definitions["RS-050"] = abarenohDef;
    state.definitions["RS-051"] = fusionDef("RS-051", "Tyranno");
    state.definitions["RS-052"] = fusionDef("RS-052", "Tricera");
    state.definitions["RS-053"] = fusionDef("RS-053", "Ptera");

    const action = getLegalActions(state).find(
      (a) => a.type === "rush" && a.instanceId === zord.instanceId,
    );
    expect(action).toBeDefined();
    expect(action?.type === "rush" && action.zordMaterialInstanceId).toBeUndefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const player = result.state.players.player1;
    expect(player.rush.some((c) => c.cardId === "RS-050")).toBe(true);
    expect(player.rush.some((c) => c.cardId === "RS-051")).toBe(false);
    expect(player.rush.some((c) => c.cardId === "RS-052")).toBe(false);
    expect(player.rush.some((c) => c.cardId === "RS-053")).toBe(false);
    expect(player.discard.some((c) => c.cardId === "RS-051")).toBe(true);
    expect(player.discard.some((c) => c.cardId === "RS-052")).toBe(true);
    expect(player.discard.some((c) => c.cardId === "RS-053")).toBe(true);
    expect(player.power).toHaveLength(7);
  });

  it("discards all five dekaranger parts when rushing RS-042", () => {
    const zord = inst("RS-042", "z1");
    const partners = ["RS-043", "RS-044", "RS-045", "RS-046", "RS-047"].map(
      (id, index) => inst(id, `f${index}`),
    );
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 8 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldOtCommand("c1")],
        rush: partners,
      },
    });

    state.definitions["RS-042"] = {
      id: "RS-042",
      name: "Dekaranger Robo",
      type: "unit",
      category: "OT",
      rarity: "SR",
      expansion: "test",
      powerCost: "8+",
      bp: 19000,
      size: "L",
      sp: 2,
    };
    for (const id of ["RS-043", "RS-044", "RS-045", "RS-046", "RS-047"] as const) {
      state.definitions[id] = fusionDef(id, id);
    }

    const action = getLegalActions(state).find(
      (a) => a.type === "rush" && a.instanceId === zord.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const player = result.state.players.player1;
    expect(player.rush.some((c) => c.cardId === "RS-042")).toBe(true);
    for (const id of ["RS-043", "RS-044", "RS-045", "RS-046", "RS-047"] as const) {
      expect(player.rush.some((c) => c.cardId === id)).toBe(false);
      expect(player.discard.some((c) => c.cardId === id)).toBe(true);
    }
  });

  it("discards all five magiranger parts when rushing RS-070", () => {
    const zord = inst("RS-070", "z1");
    const partners = ["RS-057", "RS-058", "RS-059", "RS-060", "RS-061"].map(
      (id, index) => inst(id, `f${index}`),
    );
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 7 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldMaCommand("c1")],
        rush: partners,
      },
    });

    state.definitions["RS-070"] = {
      id: "RS-070",
      name: "Magiking",
      type: "unit",
      category: "MA",
      rarity: "SR",
      expansion: "test",
      powerCost: "7+",
      bp: 16000,
      size: "L",
      sp: 1,
    };
    for (const id of ["RS-057", "RS-058", "RS-059", "RS-060", "RS-061"] as const) {
      state.definitions[id] = fusionDef(id, id);
    }

    const action = getLegalActions(state).find(
      (a) => a.type === "rush" && a.instanceId === zord.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const player = result.state.players.player1;
    expect(player.rush.some((c) => c.cardId === "RS-070")).toBe(true);
    for (const id of ["RS-057", "RS-058", "RS-059", "RS-060", "RS-061"] as const) {
      expect(player.rush.some((c) => c.cardId === id)).toBe(false);
      expect(player.discard.some((c) => c.cardId === id)).toBe(true);
    }
  });

  it("still accepts single S-unit material for zords without partner list", () => {
    const zord = inst("RS-075", "z1");
    const sUnit = inst("RS-080", "s1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
        rush: [sUnit],
      },
    });

    state.definitions["RS-075"] = {
      id: "RS-075",
      name: "Blue Vulcan",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: "5+",
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-080"] = {
      ...fusionDef("RS-080", "S Unit"),
      size: "S",
      bp: 2000,
    };

    const withMaterial = getLegalActions(state).filter(
      (a) =>
        a.type === "rush" &&
        a.instanceId === zord.instanceId &&
        a.zordMaterialInstanceId === sUnit.instanceId,
    );
    expect(withMaterial).toHaveLength(2);
    expect(
      withMaterial.map((a) => a.type === "rush" && a.zordMaterialDestination),
    ).toEqual(expect.arrayContaining(["command", "discard"]));
  });

  it("RS-075 zord material can go to command zone", () => {
    const zord = inst("RS-075", "z1");
    const sUnit = inst("RS-080", "s1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
        rush: [sUnit],
      },
    });

    state.definitions["RS-075"] = {
      id: "RS-075",
      name: "Blue Vulcan",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: "5+",
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-080"] = {
      ...fusionDef("RS-080", "S Unit"),
      size: "S",
      bp: 2000,
    };

    const result = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: zord.instanceId,
      zordMaterialInstanceId: sUnit.instanceId,
      zordMaterialDestination: "command",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.player1.command.some((c) => c.instanceId === sUnit.instanceId)).toBe(
      true,
    );
    expect(result.state.players.player1.rush.some((c) => c.cardId === "RS-075")).toBe(true);
  });

  it("does not accept zord materials from hand", () => {
    const zord = inst("RS-075", "z1");
    const sUnit = inst("RS-080", "s1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord, sUnit],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
        rush: [],
      },
    });

    state.definitions["RS-075"] = {
      id: "RS-075",
      name: "Blue Vulcan",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: "5+",
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-080"] = {
      ...fusionDef("RS-080", "S Unit"),
      size: "S",
      bp: 2000,
    };

    const withHandMaterial = getLegalActions(state).filter(
      (a) =>
        a.type === "rush" &&
        a.instanceId === zord.instanceId &&
        a.zordMaterialInstanceId === sUnit.instanceId,
    );
    expect(withHandMaterial).toHaveLength(0);
  });

  it.each(["RS-051", "RS-052", "RS-053"] as const)(
    "accepts %s as part of AbarenOh zord material set",
    (materialId) => {
      const zord = inst("RS-050", "z1");
      const partners = ["RS-051", "RS-052", "RS-053"].map((id, index) =>
        inst(id, `f${index}`),
      );
      const state = createTestState({
        phase: "rush",
        player1: {
          hand: [zord],
          power: Array.from({ length: 7 }, (_, i) => inst("TST-OP", `p${i}`)),
          command: [heldWbCommand("c1")],
          rush: partners,
        },
      });
      state.definitions["RS-050"] = abarenohDef;
      for (const id of ["RS-051", "RS-052", "RS-053"] as const) {
        state.definitions[id] = fusionDef(id, id);
      }

      const actions = getLegalActions(state).filter(
        (a) => a.type === "rush" && a.instanceId === zord.instanceId,
      );
      expect(actions).toHaveLength(1);
      expect(materialId).toBeTruthy();
    },
  );

  it("rejects non-AbarenOh fusion units for AbarenOh zord-up", () => {
    const zord = inst("RS-050", "z1");
    const wrongFusion = inst("RS-043", "f1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        power: Array.from({ length: 7 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldWbCommand("c1")],
        rush: [wrongFusion],
      },
    });
    state.definitions["RS-050"] = abarenohDef;
    state.definitions["RS-043"] = {
      id: "RS-043",
      name: "Pat Striker",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };

    const actions = getLegalActions(state).filter(
      (a) =>
        a.type === "rush" &&
        a.instanceId === zord.instanceId &&
        a.zordMaterialInstanceId === wrongFusion.instanceId,
    );
    expect(actions).toHaveLength(0);
  });
});

describe("prism power", () => {
  it("allows rush with two held commands of any category", () => {
    const unit = inst("TST-UNIT-2", "u1");
    const op = inst("RS-010", "op1");
    const cmd1 = { ...inst("TST-OP-ET", "c1"), commandHeld: true };
    const cmd2 = { ...inst("TST-OP-ET", "c2"), commandHeld: true };

    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2"), inst("TST-OP", "p3")],
        command: [cmd1, cmd2],
        operation: [op],
      },
    });
    state.definitions["RS-010"] = {
      id: "RS-010",
      name: "Prism",
      type: "operation",
      category: "OT",
      rarity: "R",
      expansion: "test",
      powerCost: 2,
      tags: ["常駐"],
    };

    const rushes = getLegalActions(state).filter((a) => a.type === "rush");
    expect(rushes).toHaveLength(1);
  });
});

describe("number combo", () => {
  it("grants SP when combo position matches", () => {
    const unit = inst("RS-048", "u1");
    const filler1 = inst("TST-UNIT-0", "f1");
    const filler2 = inst("TST-UNIT-0", "f2");
    const filler3 = inst("TST-UNIT-0", "f3");

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [unit],
        battle: [filler1, filler2, filler3],
      },
    });

    state.definitions["RS-048"] = {
      id: "RS-048",
      name: "Blue Racer",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
      sp: "special",
      comboNumber: 4,
    };

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: unit.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const moved = result.state.players.player1.battle.find((c) => c.cardId === "RS-048");
    expect(moved?.spModifier).toBe(1);
  });

  it("RS-031 eagle diving grants SP1 and BP+2000 at NC position", () => {
    const eagle = inst("RS-031", "e1");
    const fillers = Array.from({ length: 4 }, (_, i) => inst("TST-UNIT-0", `f${i}`));

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [eagle],
        battle: fillers,
      },
    });

    state.definitions["RS-031"] = {
      id: "RS-031",
      name: "Eagle",
      type: "unit",
      category: "ET",
      rarity: "SR",
      expansion: "test",
      powerCost: 4,
      bp: 3000,
      size: "S",
      sp: "special",
      comboNumber: 5,
    };

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: eagle.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const moved = result.state.players.player1.battle.find((c) => c.cardId === "RS-031");
    expect(moved?.spModifier).toBe(1);
    expect(moved?.bpModifier).toBe(2000);
  });

  it("RS-031 eagle diving triggers from shark combo without matching NC (alt trigger)", () => {
    const eagle = inst("RS-031", "e1");
    const shark = inst("RS-032", "s1");

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [eagle],
        battle: [shark],
      },
    });

    state.definitions["RS-031"] = {
      id: "RS-031",
      name: "Eagle",
      type: "unit",
      category: "ET",
      rarity: "SR",
      expansion: "test",
      powerCost: 4,
      bp: 3000,
      size: "S",
      sp: "special",
      comboNumber: 5,
    };
    state.definitions["RS-032"] = {
      id: "RS-032",
      name: "Shark",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: 1,
      bp: 2000,
      size: "S",
      comboNumber: 5,
    };

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: eagle.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const moved = result.state.players.player1.battle.find((c) => c.cardId === "RS-031");
    expect(moved?.spModifier).toBe(1);
    expect(moved?.bpModifier).toBe(2000);
  });
});

describe("lightning gravity", () => {
  it("blocks M unit from battle without held command", () => {
    const mUnit = inst("RS-043", "m1");
    const op = inst("RS-069", "op1");
    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [op],
        command: [inst("TST-OP-ET", "c1")],
      },
    });
    state.definitions["RS-043"] = {
      id: "RS-043",
      name: "Pat Striker",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 5,
      bp: 6000,
      size: "M",
    };
    state.definitions["RS-069"] = {
      id: "RS-069",
      name: "Lightning",
      type: "operation",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: 4,
      tags: ["常駐"],
    };

    const moves = getLegalActions(state).filter((a) => a.type === "move_to_battle");
    expect(moves).toHaveLength(0);
  });

  it("requires held commands equal to both players' lightning gravity count (Q2)", () => {
    const mUnit = inst("RS-043", "m1");
    const op1 = inst("RS-069", "op1");
    const op2 = inst("RS-069", "op2");
    const held = { ...inst("TST-OP-ET", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [op1],
        command: [held],
      },
      player2: {
        operation: [op2],
      },
    });
    state.definitions["RS-043"] = {
      id: "RS-043",
      name: "Pat Striker",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 5,
      bp: 6000,
      size: "M",
    };
    for (const id of ["RS-069", "TST-OP-ET"] as const) {
      state.definitions[id === "RS-069" ? "RS-069" : "TST-OP-ET"] =
        id === "RS-069"
          ? {
              id: "RS-069",
              name: "Lightning",
              type: "operation",
              category: "ET",
              rarity: "N",
              expansion: "test",
              powerCost: 4,
              tags: ["常駐"],
            }
          : {
              id: "TST-OP-ET",
              name: "ET Cmd",
              type: "command",
              category: "ET",
              rarity: "N",
              expansion: "test",
            };
    }

    const moves = getLegalActions(state).filter((a) => a.type === "move_to_battle");
    expect(moves).toHaveLength(0);
  });

  it("stacks RS-051 battle entry hold with lightning gravity (Q3)", () => {
    const fusion = inst("RS-051", "f1");
    const op = inst("RS-069", "op1");
    const held = { ...heldWbCommand("c1"), commandHeld: true };
    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [fusion],
        operation: [op],
        command: [held],
      },
    });
    state.definitions["RS-051"] = {
      id: "RS-051",
      name: "Tyranno",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 4,
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-069"] = {
      id: "RS-069",
      name: "Lightning",
      type: "operation",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: 4,
      tags: ["常駐"],
    };

    const moves = getLegalActions(state).filter((a) => a.type === "move_to_battle");
    expect(moves).toHaveLength(0);
  });
});

describe("mandatory battle entry", () => {
  const abaredDef = {
    id: "RS-054",
    name: "アバレッド",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    size: "S" as const,
    sp: "special" as const,
    comboNumber: 2,
  };

  it("does not auto-enter battle when rush phase ends", () => {
    const abared = inst("RS-054", "a1");
    let state = createTestState({
      phase: "rush",
      player1: { rush: [abared] },
    });
    state.definitions["RS-054"] = abaredDef;

    const next = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;

    expect(next.state.phase).toBe("battle");
    expect(next.state.players.player1.rush).toHaveLength(1);
    expect(next.state.players.player1.battle).toHaveLength(0);
  });

  it("blocks battle phase end while mandatory unit can enter", () => {
    const abared = inst("RS-054", "a1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [abared] },
    });
    state.definitions["RS-054"] = abaredDef;

    const endActions = getLegalActions(state).filter((a) => a.type === "end_phase");
    expect(endActions).toHaveLength(0);

    const blocked = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toBe("must_enter_battle");
  });

  it("allows battle phase end after mandatory unit enters", () => {
    const abared = inst("RS-054", "a1");
    let state = createTestState({
      phase: "battle",
      player1: { rush: [abared] },
    });
    state.definitions["RS-054"] = abaredDef;

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: abared.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    const passed = applyAction(state, {
      type: "pass_battle_entry",
      playerId: "player1",
    });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    state = passed.state;

    const endActions = getLegalActions(state).filter((a) => a.type === "end_phase");
    expect(endActions).toHaveLength(1);

    const ended = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.phase).toBe("end");
  });
});
