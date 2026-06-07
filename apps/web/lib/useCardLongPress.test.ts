import { describe, expect, it } from "vitest";
import {
  CARD_LONG_PRESS_MS,
  CARD_LONG_PRESS_MOVE_TOLERANCE_PX,
  shouldCancelCardLongPress,
} from "./cardGesture";

describe("card long press gesture", () => {
  it("defines hold duration and move tolerance", () => {
    expect(CARD_LONG_PRESS_MS).toBe(450);
    expect(CARD_LONG_PRESS_MOVE_TOLERANCE_PX).toBe(10);
  });

  it("cancels long press when pointer moves beyond tolerance", () => {
    expect(shouldCancelCardLongPress(0, 0)).toBe(false);
    expect(shouldCancelCardLongPress(CARD_LONG_PRESS_MOVE_TOLERANCE_PX, 0)).toBe(false);
    expect(shouldCancelCardLongPress(CARD_LONG_PRESS_MOVE_TOLERANCE_PX + 1, 0)).toBe(true);
  });
});
