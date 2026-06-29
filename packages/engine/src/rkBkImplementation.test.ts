import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as cardDsl from "@rangers-strike/cards/dsl";
import { applyGrantKeyword } from "./dsl/grantKeyword";
import { wireEffectDelegateResolver } from "./dsl/effectDelegateRuntime";
import { interpretEffectPrimitives } from "./dsl/cardInterpreter";
import { createTestState, inst } from "./testing/fixtures";
import type { CardDefinition } from "@rangers-strike/cards";

wireEffectDelegateResolver(interpretEffectPrimitives);

const dslDir = join(dirname(fileURLToPath(import.meta.url)), "../../cards/src/generated/dsl-stubs");

function toDef(doc: NonNullable<ReturnType<ReturnType<typeof cardDsl.createFullPlayableRegistry>["getCard"]>>): CardDefinition {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    category: doc.category,
    rarity: doc.rarity,
    expansion: doc.expansion,
    powerCost: doc.powerCost,
    bp: doc.bp,
    sp: doc.sp,
    size: doc.size,
    text: doc.text,
    features: doc.features,
  };
}

function auditPrefix(prefix: "BK-" | "RK-") {
  const registry = cardDsl.createFullPlayableRegistry();
  let total = 0;
  let silentNoop = 0;
  let withDetail = 0;
  let withChoice = 0;
  const silentSamples: string[] = [];

  for (const file of readdirSync(dslDir).filter((f) => f.startsWith(prefix))) {
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8")) as {
      id: string;
      effects?: Array<{
        id: string;
        optional?: boolean;
        effects?: Array<{ type: string; keyword?: string }>;
      }>;
    };
    const regDoc = registry.getCard(doc.id);
    if (!regDoc) continue;

    for (const effect of doc.effects ?? []) {
      const kw = effect.effects?.find((p) => p.type === "grant_keyword")?.keyword;
      if (!kw) continue;
      total += 1;

      const battle = inst(doc.id, `u-${effect.id}`);
      const before = createTestState({
        phase: "battle",
        player1: { battle: [battle] },
      });
      before.definitions[doc.id] = toDef(regDoc);

      const result = applyGrantKeyword(
        before,
        {
          playerId: "player1",
          phasePlayerId: "player1",
          sourceCardId: doc.id,
          effectId: effect.id,
          triggerSourceInstanceId: battle.instanceId,
          optional: effect.optional ?? true,
        },
        kw,
      );

      const detail = result.detail ?? "";
      if (!detail && !result.state.pendingEffectChoice) {
        silentNoop += 1;
        if (silentSamples.length < 10) silentSamples.push(`${doc.id}/${effect.id} ${kw}`);
      } else if (result.state.pendingEffectChoice) {
        withChoice += 1;
      } else {
        withDetail += 1;
      }
    }
  }

  return { total, silentNoop, withDetail, withChoice, silentSamples };
}

describe("RK/BK runtime implementation audit", () => {
  it("BK grant_keyword has zero silent noops", () => {
    const r = auditPrefix("BK-");
    expect(r.silentNoop, JSON.stringify(r.silentSamples)).toBe(0);
    expect(r.total).toBeGreaterThan(0);
  });

  it("RK grant_keyword has zero silent noops", () => {
    const r = auditPrefix("RK-");
    expect(r.silentNoop, JSON.stringify(r.silentSamples)).toBe(0);
    expect(r.total).toBeGreaterThan(500);
  });
});

describe("BK representative handlers", () => {
  const registry = cardDsl.createFullPlayableRegistry();

  it("BK-011 resolves hand_resident_rush keyword", () => {
    const doc = registry.getCard("BK-011")!;
    const battle = inst("BK-011", "op");
    const state = createTestState({
      phase: "rush",
      player1: { hand: [], operation: [] },
    });
    state.definitions["BK-011"] = toDef(doc);
    const result = applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "BK-011",
        effectId: "akuru",
        operationInstanceId: battle.instanceId,
        optional: true,
      },
      "hand_resident_rush_amadamu",
    );
    expect(result.detail).toBe("hand_resident_rush_amadamu:no_targets");
  });
});
