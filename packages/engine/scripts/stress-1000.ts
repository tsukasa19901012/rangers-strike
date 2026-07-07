import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const failures: Array<{ seed: number; reason: string; detail: unknown }> = [];
for (let seed = 1; seed <= 1000; seed++) {
  const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
  const p2 = LEGEND1_STARTER_IDS[(seed + 3) % LEGEND1_STARTER_IDS.length]!;
  const initial = createHybridPromotedGame({
    rng: mulberry32(seed),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    player1Starter: p1,
    player2Starter: p2,
    swapCount: 35,
  });
  const result = playStarterMatchUntilEnd(initial, { maxSteps: 20_000 });
  if (result.reason === "winner") continue;
  const s = result.state;
  failures.push({
    seed,
    reason: result.reason,
    detail: {
      phase: s.phase,
      pending: s.pendingEffectChoice?.effectId ?? s.pendingEffectChoice?.kind,
      pendingLeave: !!s.pendingLeave,
      pendingDmg: !!s.pendingDamagePayment,
      pendingCmd: !!s.pendingCommandPayment,
      lastLog: s.log.at(-1),
    },
  });
}

console.log(`\nFailures: ${failures.length} / 1000`);
for (const f of failures) {
  console.log(`seed=${f.seed} ${f.reason}`, JSON.stringify(f.detail));
}
