import { describe, expect, it } from "vitest";
import { listImplementedOperations } from "@rangers-strike/cards";
import type { PendingEffectChoice } from "@rangers-strike/engine";
import {
  assertAllImplementedOperationsCovered,
  assertCatalogMatchesMechanisms,
  isKnownEffectChoice,
  listOperationCoverageGaps,
  OPERATION_UI_MECHANISMS,
  summarizeOperationCoverage,
} from "./webUiEffectCoverage";
import { resolveOperationDropRoute } from "./webUiOperationRouting";
import { effectChoiceTitle } from "./effectChoiceHint";

function stubPending(
  overrides: Partial<PendingEffectChoice>,
): PendingEffectChoice {
  return {
    playerId: "player1",
    effectId: "unknown_effect",
    sourceCardId: "BK-001",
    kind: "confirm",
    phasePlayerId: "player1",
    validInstanceIds: [],
    ...overrides,
  };
}

describe("isKnownEffectChoice", () => {
  it("returns true for wired L1–3 effect choices", () => {
    expect(
      isKnownEffectChoice(
        stubPending({ effectId: "armor_attack", kind: "select_unit" }),
      ),
    ).toBe(true);
  });

  it("returns true for DSL-ready promoted cards with generic choice kinds", () => {
    expect(
      isKnownEffectChoice(
        stubPending({ effectId: "dsl_unknown_xyz", kind: "select_unit" }),
      ),
    ).toBe(true);
  });

  it("returns false for unknown effect ids on non-DSL cards", () => {
    expect(
      isKnownEffectChoice(
        stubPending({
          effectId: "dsl_unknown_xyz",
          kind: "confirm",
          sourceCardId: "UNKNOWN-999",
        }),
      ),
    ).toBe(false);
  });

  it("仮面ライダー系 能動効果は既知（汎用フォールバック=物理名表示にしない）", () => {
    const cases: Array<[string, PendingEffectChoice["kind"]]> = [
      ["rider_slash_destroy", "select_unit"],
      ["rider_kick_send_power", "select_unit"],
      ["rider_kick_discard_power_sp1", "select_power"],
      ["hold_ot_commands_then_sp", "select_command"],
      ["senko_sosa_declare", "declare_number"],
      ["extend_rider_drop", "select_unit"],
      ["kamen_ride_deploy", "select_unit"],
      ["power_faceup_sp1_grant", "select_power"],
    ];
    for (const [effectId, kind] of cases) {
      expect(
        isKnownEffectChoice(stubPending({ effectId, kind, sourceCardId: "UNKNOWN-999" })),
        `${effectId} は既知の choice であるべき`,
      ).toBe(true);
    }
  });
});

describe("バナーの効果名（日本語）表示", () => {
  it("仮面ライダー系 effectId は日本語の効果名を表示（物理名を出さない）", () => {
    const expected: Record<string, string> = {
      rider_slash_destroy: "ライダースラッシュ",
      rider_kick_send_power: "ライダーキック",
      rider_kick_discard_power_sp1: "ライダーキック",
      hold_ot_commands_then_sp: "ライダーキック",
      senko_sosa_declare: "潜行捜索",
      extend_rider_drop: "エクステンドライダー落とし",
      kamen_ride_deploy: "カメンライド",
      power_faceup_sp1_grant: "最初からクライマックスだぜ",
    };
    for (const [effectId, label] of Object.entries(expected)) {
      const title = effectChoiceTitle(stubPending({ effectId }));
      expect(title, `${effectId} のタイトル`).toBe(`【${label}】`);
      // 物理名（effectId）がそのまま出ていないこと
      expect(title).not.toContain(effectId);
    }
  });
});

describe("Web UI operation effect coverage", () => {
  it("maps every implemented operation to a UI mechanism", () => {
    expect(listOperationCoverageGaps()).toEqual([]);
    assertAllImplementedOperationsCovered();
    assertCatalogMatchesMechanisms();
  });

  it("covers at least 35 operation cards", () => {
    const summary = summarizeOperationCoverage();
    expect(summary.total).toBeGreaterThanOrEqual(35);
    expect(summary.instant).toBeGreaterThanOrEqual(15);
    expect(summary.permanent).toBeGreaterThanOrEqual(12);
    expect(summary.counter).toBeGreaterThanOrEqual(5);
  });

  it("routes instant operations to the correct drop handler", () => {
    for (const op of listImplementedOperations()) {
      if (op.kind !== "instant") continue;
      const route = resolveOperationDropRoute(op.cardId);
      const mechanisms = OPERATION_UI_MECHANISMS[op.effectId] ?? [];

      if (op.effectId === "cyber_s_rider") {
        expect(route.kind).toBe("cyber_s_rider_modal");
        expect(mechanisms).toContain("operation_cyber_s_rider_modal");
        continue;
      }

      if (mechanisms.includes("operation_drag_target_modal")) {
        expect(route.kind).toBe("target_modal");
        continue;
      }

      if (mechanisms.includes("operation_drag_direct")) {
        expect(route.kind).toBe("direct_play");
      }
    }
  });
});
