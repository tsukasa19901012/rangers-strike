import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import { emitUnitRushedAndFinalize } from "../events/emitUnitRushed";
import { featuresExactlyMatch } from "../keywords/morph";
import {
  getMorphReactionActorId,
  morphOrderChooserPlayerId,
  morphUnitCanReact,
  rushMethodBlocksMorphReaction,
  shouldMorphOrderChooserAct,
} from "./morphProcedure";
import { applyMorphSwap, passMorphReaction } from "../keywords/morphReaction";
import { createTestState, inst } from "../testing/fixtures";

const FEATURE = "テスト特徴";

function morphUnitDef(id: string, morph = false): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 1,
    bp: 2000,
    sp: 1,
    size: "S",
    features: [FEATURE],
    // ルール: R-KW-00 — キーワードは「※モーフ」表記で持つ
    text: morph
      ? "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）"
      : undefined,
  };
}

describe("morphProcedure", () => {
  it("matches features in order", () => {
    expect(featuresExactlyMatch(["A", "B"], ["A", "B"])).toBe(true);
    expect(featuresExactlyMatch(["A", "B"], ["B", "A"])).toBe(false);
    expect(featuresExactlyMatch(["A"], ["A", "B"])).toBe(false);
  });

  it("R-KW-MORPH-01: モーフ以外の手段のラッシュにだけ反応する（判定はラッシュの手段）", () => {
    expect(rushMethodBlocksMorphReaction("morph")).toBe(true);
    expect(rushMethodBlocksMorphReaction("normal")).toBe(false);
    expect(rushMethodBlocksMorphReaction("effect")).toBe(false);
  });

  it("R-KW-MORPH-01: モーフ持ちのユニットが通常ラッシュされてもモーフで反応できる", () => {
    const rusher = inst("ENEMY-MORPH", "enemy");
    const morphField = inst("MORPH-FIELD-1", "morph-field-1");
    const replacement = inst("MORPH-CMD", "morph-cmd");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: { rush: [morphField], command: [replacement] },
    });
    state.definitions["ENEMY-MORPH"] = morphUnitDef("ENEMY-MORPH", true);
    state.definitions["MORPH-FIELD-1"] = morphUnitDef("MORPH-FIELD-1", true);
    state.definitions["MORPH-CMD"] = morphUnitDef("MORPH-CMD");

    expect(morphUnitCanReact(state, "player2", morphField, "normal")).toBe(true);
    expect(morphUnitCanReact(state, "player2", morphField, "morph")).toBe(false);
    const result = emitUnitRushedAndFinalize(state, "player1", rusher.instanceId, "player1");
    expect(result.state.pendingEffectChoice?.effectId).toBe("morph_replacement");
  });

  it("R-KW-MORPH-02: 置き換え先は自軍コマンドゾーンとパワーゾーンだけ（手札・ラッシュエリアは不可）", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField = inst("MORPH-FIELD-1", "morph-field-1");
    const inHand = inst("MORPH-HAND-1", "morph-hand-1");
    const inRush = inst("MORPH-RUSH-1", "morph-rush-1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: { rush: [morphField, inRush], hand: [inHand] },
    });
    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD-1"] = morphUnitDef("MORPH-FIELD-1", true);
    state.definitions["MORPH-HAND-1"] = morphUnitDef("MORPH-HAND-1");
    state.definitions["MORPH-RUSH-1"] = morphUnitDef("MORPH-RUSH-1");

    expect(morphUnitCanReact(state, "player2", morphField)).toBe(false);
    const result = emitUnitRushedAndFinalize(state, "player1", rusher.instanceId, "player1");
    expect(result.state.pendingMorph).toBeUndefined();
    expect(result.state.pendingEffectChoice?.effectId).not.toBe("morph_replacement");

    const withPower = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: { rush: [morphField], power: [inHand] },
    });
    withPower.definitions = state.definitions;
    expect(morphUnitCanReact(withPower, "player2", morphField)).toBe(true);
  });

  it("assigns turn player as order chooser when multiple morph units react", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField1 = inst("MORPH-FIELD-1", "morph-field-1");
    const morphField2 = inst("MORPH-FIELD-2", "morph-field-2");
    const morphHand1 = inst("MORPH-HAND-1", "morph-hand-1");
    const morphHand2 = inst("MORPH-HAND-2", "morph-hand-2");

    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: {
        rush: [morphField1, morphField2],
        command: [morphHand1, morphHand2],
      },
    });
    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD-1"] = morphUnitDef("MORPH-FIELD-1", true);
    state.definitions["MORPH-FIELD-2"] = morphUnitDef("MORPH-FIELD-2", true);
    state.definitions["MORPH-HAND-1"] = morphUnitDef("MORPH-HAND-1");
    state.definitions["MORPH-HAND-2"] = morphUnitDef("MORPH-HAND-2");

    const result = emitUnitRushedAndFinalize(
      state,
      "player1",
      rusher.instanceId,
      "player1",
    );
    const pending = result.state.pendingMorph;
    expect(pending).toBeDefined();
    if (!pending) return;

    expect(shouldMorphOrderChooserAct(pending)).toBe(true);
    expect(morphOrderChooserPlayerId(pending)).toBe("player1");
    expect(getMorphReactionActorId(result.state, pending)).toBe("player1");
    expect(
      morphUnitCanReact(result.state, "player2", morphField1),
    ).toBe(true);
  });

  it("lets defender pass morph while turn player chooses order", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField1 = inst("MORPH-FIELD-1", "morph-field-1");
    const morphField2 = inst("MORPH-FIELD-2", "morph-field-2");
    const morphHand1 = inst("MORPH-HAND-1", "morph-hand-1");
    const morphHand2 = inst("MORPH-HAND-2", "morph-hand-2");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: {
        rush: [morphField1, morphField2],
        command: [morphHand1, morphHand2],
      },
    });
    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD-1"] = morphUnitDef("MORPH-FIELD-1", true);
    state.definitions["MORPH-FIELD-2"] = morphUnitDef("MORPH-FIELD-2", true);
    state.definitions["MORPH-HAND-1"] = morphUnitDef("MORPH-HAND-1");
    state.definitions["MORPH-HAND-2"] = morphUnitDef("MORPH-HAND-2");

    state = emitUnitRushedAndFinalize(state, "player1", rusher.instanceId, "player1").state;
    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "pass_morph_reaction" && a.playerId === "player2")).toBe(
      true,
    );

    const passed = applyAction(state, { type: "pass_morph_reaction", playerId: "player2" });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.state.pendingMorph).toBeUndefined();
  });

  it("R-KW-MORPH-02: リリースのユニット⇔ホールドのコマンド — コマンドへ行くユニットはホールド、出るカードはリリース。位置も引き継ぐ", () => {
    const left = inst("FILLER", "left");
    const morphField = inst("MORPH-FIELD", "morph-field");
    const right = inst("FILLER", "right");
    const cmdBefore = inst("FILLER", "cmd-before");
    const heldCommand = { ...inst("MORPH-CMD", "morph-cmd"), commandHeld: true };
    const cmdAfter = inst("FILLER", "cmd-after");

    const state = createTestState({
      player2: {
        battle: [left, morphField, right],
        command: [cmdBefore, heldCommand, cmdAfter],
        hand: [],
        power: [],
      },
    });
    state.definitions["FILLER"] = morphUnitDef("FILLER");
    state.definitions["FILLER"].features = ["別特徴"];
    state.definitions["MORPH-FIELD"] = morphUnitDef("MORPH-FIELD", true);
    state.definitions["MORPH-CMD"] = morphUnitDef("MORPH-CMD");

    const swapped = applyMorphSwap(
      state,
      "player2",
      morphField.instanceId,
      heldCommand.instanceId,
    );
    expect("error" in swapped).toBe(false);
    if ("error" in swapped) return;

    const p2 = swapped.state.players.player2;
    expect(p2.battle.map((c) => c.instanceId)).toEqual([
      left.instanceId,
      heldCommand.instanceId,
      right.instanceId,
    ]);
    expect(p2.battle[1]!.commandHeld).toBeFalsy();
    expect(p2.command.map((c) => c.instanceId)).toEqual([
      cmdBefore.instanceId,
      morphField.instanceId,
      cmdAfter.instanceId,
    ]);
    expect(p2.command[1]!.commandHeld).toBe(true);
    expect(passMorphReaction(swapped.state, "player2")).toBeNull();
  });

  it("R-KW-MORPH-02: 手札のカードとは置き換えられない", () => {
    const morphField = inst("MORPH-FIELD", "morph-field");
    const morphHand = inst("MORPH-HAND", "morph-hand");
    const state = createTestState({
      player2: { rush: [morphField], hand: [morphHand] },
    });
    state.definitions["MORPH-FIELD"] = morphUnitDef("MORPH-FIELD", true);
    state.definitions["MORPH-HAND"] = morphUnitDef("MORPH-HAND");
    const swapped = applyMorphSwap(state, "player2", morphField.instanceId, morphHand.instanceId);
    expect("error" in swapped).toBe(true);
  });
});
