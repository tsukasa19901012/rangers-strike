import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { parseSharePayload } from "./share";
import { testPlatform } from "../testing/engine";

const newApp = (seed: number, platform = testPlatform()) =>
  new AppController({ platform, viewport: { width: 480, height: 272 }, cpuDelayFrames: 0, seed: () => seed });

/** Plays the opened match for a while (CPU moves and the human's first option). */
function play(app: AppController, steps: number): void {
  for (let i = 0; i < steps && app.currentScreen === "match"; i++) {
    if (!app.tick() && app.session!.humanOptions().length > 0) app.session!.chooseHuman(0);
  }
}

describe("shared board", () => {
  it("continues another match from the same state, the same options and the sharer's CPU level", () => {
    const sharer = newApp(11);
    sharer.updateSettings({ cpuLevel: 3 });
    sharer.startMatch();
    play(sharer, 60);
    const payload = sharer.sharePayload()!;
    expect(payload).not.toBeNull();
    expect("definitions" in payload.state).toBe(false);

    // It travels as JSON (a URL or the share store).
    const received = parseSharePayload(JSON.parse(JSON.stringify(payload)))!;
    const viewer = newApp(99);
    viewer.startSharedMatch(received);
    expect(viewer.currentScreen).toBe("match");
    const { definitions: _d1, ...a } = sharer.session!.state;
    const { definitions: _d2, ...b } = viewer.session!.state;
    expect(b).toEqual(a);
    expect(viewer.session!.humanOptions().map((o) => o.label)).toEqual(sharer.session!.humanOptions().map((o) => o.label));
    expect(viewer.session!.options.cpuLevel).toBe(3);
    expect(viewer.session!.log.length).toBeGreaterThan(0);
  });

  it("does not record a shared match's result", () => {
    const sharer = newApp(12);
    sharer.startMatch();
    play(sharer, 50);
    const platform = testPlatform();
    const viewer = newApp(13, platform);
    viewer.startSharedMatch(sharer.sharePayload()!);
    play(viewer, 20000);
    expect(viewer.currentScreen).toBe("result");
    expect(platform.storage.get("rs.records.v1")).toBeNull();
  });

  it("rejects payloads that are not a board", () => {
    expect(parseSharePayload(null)).toBeNull();
    expect(parseSharePayload({ v: 2, state: { players: { player1: {}, player2: {} } } })).toBeNull();
    expect(parseSharePayload({ v: 1, state: {} })).toBeNull();
    expect(parseSharePayload({ v: 1, cpuLevel: 9, state: { players: { player1: {}, player2: {} } } })?.cpuLevel).toBe(2);
  });
});
