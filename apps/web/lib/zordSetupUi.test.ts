import { describe, expect, it } from "vitest";
import type { PendingZordSetup } from "@rangers-strike/engine";
import { zordSetupHint, zordSetupTitle } from "./zordSetupUi";

const baseSetup: PendingZordSetup = {
  playerId: "player1",
  zordInstanceId: "RS-075:z1",
  zordCardId: "RS-075",
  step: "material",
  validInstanceIds: ["s1"],
};

describe("zordSetupUi", () => {
  it("formats title as 追加条件 — cardNameをラッシュ", () => {
    expect(zordSetupTitle(baseSetup)).toBe("追加条件 — ブルバルカンをラッシュ");
  });

  it("shows destination hint on destination step", () => {
    expect(
      zordSetupHint({ ...baseSetup, step: "destination" }),
    ).toContain("コマンドゾーン");
  });

  it("shows material hint when destination is command", () => {
    expect(
      zordSetupHint({
        ...baseSetup,
        materialDestination: "command",
      }),
    ).toContain("コマンドゾーンに置く");
  });
});
