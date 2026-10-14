// Headless QuickJS smoke test: the same AppController + pruned engine bundle
// the Vita guest runs, driven by logical input only (scripted human = confirm
// the highlighted option). Prints per-match metrics; `qjs -d` adds QuickJS's
// own memory dump at exit. Built by scripts/smoke-qjs.mjs.
import {
  AppController,
  MemoryKeyValueStore,
  input,
  type MemoryProbe,
  type Platform,
} from "../../../packages/client-core/src/index";
import { engine } from "../src/engine";

declare const print: (...args: unknown[]) => void;
declare const scriptArgs: string[] | undefined;

const loadStart = Date.now();
const matches = Number((typeof scriptArgs !== "undefined" && scriptArgs[1]) || 3);
const thinks: number[] = [];
const memory: MemoryProbe = {
  // QuickJS exposes no heap statistics to JS; serialized-state size as estimate.
  sample: (state) => {
    const bytes = JSON.stringify(state).length * 2;
    return { bytes, kind: "estimate", label: `state≈${Math.round(bytes / 1024)}KB` };
  },
};
const platform: Platform = {
  name: "qjs",
  clock: () => Date.now(),
  log: (line) => {
    const m = /think=([\d.]+)ms/.exec(line);
    if (m) thinks.push(Number(m[1]));
    if (!line.startsWith("cpu move=")) print(`[smoke] ${line}`);
  },
  memory,
  storage: new MemoryKeyValueStore(),
  assets: {
    loadMatchData: () => engine,
    chunks: () => [],
    cardImage: () => null,
    fontStrategy: "baked-atlas",
  },
};

let seed = 100;
const app = new AppController({
  platform,
  viewport: { width: 480, height: 272 },
  fontPx: 12,
  cpuDelayFrames: 0,
  seed: () => seed++,
});
print(`[smoke] engine+core ready in ${Date.now() - loadStart} ms (decks: ${engine.ALL_STARTER_DECK_IDS.length})`);

const decks = engine.ALL_STARTER_DECK_IDS;
let failures = 0;
for (let m = 0; m < matches; m++) {
  // Title: pick decks by cycling rows with pageNext (logical input only).
  for (let i = 0; i < m * 3; i++) app.dispatch(input.pageNext);
  app.dispatch(input.select(3, true));
  const started = Date.now();
  let frames = 0;
  let humanMoves = 0;
  while (app.currentScreen === "match" && frames < 200_000) {
    frames++;
    if (!app.tick()) {
      const view = app.view();
      if (view.rows.length > 0) {
        app.dispatch(input.confirm);
        humanMoves++;
      }
    }
  }
  const session = app.session!;
  const ok = app.currentScreen === "result";
  if (!ok) failures++;
  const sorted = [...thinks].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  print(
    `[smoke] match ${m + 1}: ${ok ? "OK" : "STUCK"} ${session.options.humanDeck} vs ${session.options.cpuDeck} ` +
      `winner=${session.winner} turns=${session.state.turn} humanMoves=${humanMoves} cpuMoves=${session.metrics.moves} ` +
      `think avg=${session.metrics.avgThinkMs.toFixed(2)}ms p95=${p95}ms max=${session.metrics.maxThinkMs}ms ` +
      `wall=${Date.now() - started}ms ${session.metrics.memory?.label ?? ""}`,
  );
  thinks.length = 0;
  app.dispatch(input.confirm); // result -> title
  void decks;
}
print(`[smoke] done: ${matches - failures}/${matches} matches reached a result`);
if (failures > 0) throw new Error("smoke failed");
