import { describe, expect, it } from "vitest";
import { ListCursor } from "./actions";

describe("ListCursor", () => {
  it("wraps around and scrolls the visible window", () => {
    const c = new ListCursor(10, 3);
    c.move(-1);
    expect(c.index).toBe(9);
    expect(c.offset).toBe(7);
    c.move(1);
    expect(c.index).toBe(0);
    expect(c.offset).toBe(0);
    c.move(4);
    expect(c.offset).toBe(2);
    expect(c.rowToIndex(0)).toBe(2);
    expect(c.rowToIndex(5)).toBe(-1);
  });

  it("pages and clamps", () => {
    const c = new ListCursor(10, 4);
    c.page(1);
    expect(c.index).toBe(4);
    c.page(1);
    c.page(1);
    expect(c.index).toBe(9);
    c.resize(3, 4);
    expect(c.index).toBe(2);
    expect(c.offset).toBe(0);
  });
});
