import { LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";
import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { getLegalActions } from "../src/core/legalActions";
import {
  canBonusDraw,
  canReleaseStartCommands,
  canReturnBattleAtStart,
  hasCompletedStartPhaseSteps,
  shouldAutoAdvanceFromStartPhase,
} from "../src/rules/startPhase";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";

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

for (let seed = 1; seed <= 50; seed += 1) {
  const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
  const p2 = LEGEND1_STARTER_IDS[(seed + 1) % LEGEND1_STARTER_IDS.length]!;
  const initial = createHybridPromotedGame({
    rng: mulberry32(seed),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    player1Starter: p1,
    player2Starter: p2,
    swapCount: 35,
  });
  const result = playStarterMatchUntilEnd(initial, { maxSteps: 15_000 });
  if (result.reason !== "no_legal_actions") continue;
  const s = result.state;
  console.log("seed", seed, {
    phase: s.phase,
    activePlayer: s.activePlayer,
    pending: {
      morph: !!s.pendingMorph,
      effect: s.pendingEffectChoice?.effectId,
      payment: !!s.pendingCommandPayment,
      scry: !!s.pendingScry,
      battleEntry: !!s.pendingBattleEntry,
      register: !!s.pendingRegister,
      zord: !!s.pendingZordSetup,
    },
    start: {
      drawn: s.players[s.activePlayer].hasDrawnThisStart,
      release: s.players[s.activePlayer].hasReleasedCommandsThisStart,
      returned: s.players[s.activePlayer].hasReturnedBattleThisStart,
      battle: s.players[s.activePlayer].battle.length,
      held: s.players[s.activePlayer].command.filter((c) => c.commandHeld).length,
      completed: hasCompletedStartPhaseSteps(s.players[s.activePlayer]),
      auto: shouldAutoAdvanceFromStartPhase(s, s.activePlayer),
      canRelease: canReleaseStartCommands(s, s.activePlayer),
      canReturn: canReturnBattleAtStart(s, s.activePlayer),
      canBonus: canBonusDraw(s, s.activePlayer),
    },
    legal: getLegalActions(s).map((a) => a.type),
    lastLog: s.log.at(-1),
  });
}
