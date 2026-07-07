import { applyAction, createGame, getLegalActions } from "../src/index";
import { buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, buildStarterDeck } from "@rangers-strike/cards";

const DECK_BUILDERS = [
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
  () => buildStarterDeck("roaring-wings"),
  () => buildStarterDeck("silver-adventurer"),
] as const;

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

for (const seed of [3, 4, 14, 18, 19]) {
  const rng = mulberry32(seed);
  const deckA = DECK_BUILDERS[seed % DECK_BUILDERS.length]!();
  const deckB = DECK_BUILDERS[(seed + 1) % DECK_BUILDERS.length]!();
  let state = createGame({ player1Deck: deckA, player2Deck: deckB, firstPlayer: seed % 2 === 0 ? "player1" : "player2", rng });
  
  let failed = false;
  for (let step = 0; step < 12000; step++) {
    if (state.winner) break;
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const action = actions[Math.floor(rng() * actions.length)]!;
    const result = applyAction(state, action);
    if (!result.ok) {
      console.log(`\nseed=${seed} step=${step} error=${result.error} phase=${state.phase}`);
      console.log("action:", JSON.stringify(action).slice(0, 300));
      console.log("lastLog:", state.log.slice(-5).join(" | "));
      const p = state.activePlayer;
      if (state.phase === "start") {
        const pl = state.players[p];
        console.log("startState:", { released: pl.hasReleasedCommandsThisStart, returned: pl.hasReturnedBattleThisStart, drawn: pl.hasDrawnThisStart, heldCmds: pl.command.filter(c => c.commandHeld).length, battle: pl.battle.length });
      }
      failed = true;
      break;
    }
    state = result.state;
  }
  if (!failed) console.log(`seed=${seed}: no error`);
}
