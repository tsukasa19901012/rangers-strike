import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { testPlatform } from "../testing/engine";
import { measureText } from "../text/wrap";

describe("AppController", () => {
  it("drives title -> match -> result with logical input only", () => {
    const logs: string[] = [];
    const app = new AppController({ platform: testPlatform(logs), viewport: { width: 480, height: 272 }, cpuDelayFrames: 0, seed: () => 5 });
    let view = app.view();
    expect(view.screen).toBe("title");
    expect(view.rows).toHaveLength(4);
    // Change the CPU deck with pageNext, then start.
    app.dispatch(input.next);
    const before = app.view().rows[1]!.text;
    app.dispatch(input.pageNext);
    expect(app.view().rows[1]!.text).not.toBe(before);
    app.dispatch(input.select(3, true));
    expect(app.view().screen).toBe("match");

    for (let frame = 0; frame < 20000 && app.currentScreen === "match"; frame++) {
      if (!app.tick()) {
        view = app.view();
        if (view.rows.length > 0) app.dispatch(input.confirm);
      }
    }
    view = app.view();
    expect(view.screen).toBe("result");
    expect(view.footer).toMatch(/CPU思考/);
    expect(logs.some((l) => l.startsWith("cpu move="))).toBe(true);
  });

  it("keeps every rendered line inside its pane width", () => {
    const app = new AppController({ platform: testPlatform(), viewport: { width: 480, height: 272 }, cpuDelayFrames: 0, seed: () => 9 });
    app.dispatch(input.select(3, true));
    for (let i = 0; i < 40; i++) {
      if (!app.tick()) app.dispatch(input.confirm);
      const view = app.view();
      const { layout } = view;
      for (const tab of [0, 1, 2, 3]) {
        app.dispatch(input.selectTab(tab));
        for (const line of app.view().infoLines) {
          expect(measureText(line, layout.fontPx)).toBeLessThanOrEqual(layout.infoTextWidth + 0.01);
        }
        expect(app.view().infoLines.length).toBeLessThanOrEqual(layout.infoLines - 1);
      }
      for (const row of view.rows) expect(measureText(row.text, layout.fontPx)).toBeLessThanOrEqual(layout.sideTextWidth + 0.01);
      expect(view.promptLines.length + 1 + view.rows.length).toBeLessThanOrEqual(layout.sideLines);
    }
  });

  it("re-lays out for a portrait phone viewport", () => {
    const app = new AppController({ platform: testPlatform(), viewport: { width: 480, height: 272 } });
    app.setViewport({ width: 390, height: 844 });
    expect(app.view().layout.orientation).toBe("portrait");
  });
});
