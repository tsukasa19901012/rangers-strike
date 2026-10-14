import { describe, expect, it } from "vitest";
import { ButtonRepeater, TapRecognizer, hitTest } from "./devices";
import { input } from "./actions";
import { AppController } from "../app/controller";
import { testPlatform } from "../testing/engine";

describe("ButtonRepeater", () => {
  it("emits on press and auto-repeats only repeatable bindings", () => {
    const r = new ButtonRepeater(
      [
        { mask: 1, input: input.next, repeat: true },
        { mask: 2, input: input.confirm },
      ],
      3,
      2,
    );
    expect(r.frame(3)).toEqual([input.next, input.confirm]);
    expect(r.frame(3)).toEqual([]);
    expect(r.frame(3)).toEqual([]);
    expect(r.frame(3)).toEqual([input.next]);
    expect(r.frame(3)).toEqual([]);
    expect(r.frame(3)).toEqual([input.next]);
    expect(r.frame(0)).toEqual([]);
    expect(r.frame(2)).toEqual([input.confirm]);
  });
});

describe("TapRecognizer", () => {
  it("reports a tap on release and ignores drags", () => {
    const t = new TapRecognizer(5);
    expect(t.frame({ x: 10, y: 10 })).toBeNull();
    expect(t.frame({ x: 12, y: 11 })).toBeNull();
    expect(t.frame(null)).toEqual({ x: 12, y: 11 });
    t.frame({ x: 10, y: 10 });
    t.frame({ x: 40, y: 10 });
    expect(t.frame(null)).toBeNull();
  });
});

describe("hitTest", () => {
  it("maps taps to tabs and action rows using the layout", () => {
    const app = new AppController({ platform: testPlatform(), viewport: { width: 480, height: 272 } });
    const view = app.view();
    const { layout } = view;
    const rowY = layout.side.y + layout.padding + (view.promptLines.length + 1 + 2) * layout.lineHeight + 1;
    expect(hitTest(view, { x: layout.side.x + 10, y: rowY })).toEqual({ type: "select", row: 2, confirm: true });
    expect(hitTest(view, { x: layout.info.x + layout.info.w - 1, y: layout.info.y + 1 })).toEqual({
      type: "selectTab",
      tab: view.tabs.length - 1,
    });
  });
});
