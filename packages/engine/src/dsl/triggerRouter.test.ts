import { describe, expect, it } from "vitest";
import { HIGH_FREQUENCY_TRIGGER_WIRING } from "./triggerRouter";

describe("triggerRouter", () => {
  it("documents high-frequency trigger wiring", () => {
    expect(Object.keys(HIGH_FREQUENCY_TRIGGER_WIRING)).toEqual([
      "enter_battle",
      "on_rush",
      "while_in_field",
      "on_attack",
      "on_destroy",
    ]);
  });
});
