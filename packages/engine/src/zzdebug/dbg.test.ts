import { it } from "vitest";
import { attack, battleState, inst, legal, playCounter, powerCards, releasedCommands } from "../rulesSpec/05-helpers";
it("dbg", () => {
  let s = battleState({
    player1: { battle: [inst("TST-UNIT-2", "a")] },
    player2: {
      battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-7", "sub1"), inst("TST-UNIT-7", "sub2")],
      hand: [inst("RS-018", "n1"), inst("RS-018", "n2")],
      command: releasedCommands(2, "TST-OP-MA", "ma"),
      power: powerCards(4),
    },
  });
  s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d");
  s = playCounter(s, "player2", "RS-018:n1", ["TST-OP-MA:ma0"], "TST-UNIT-7:sub1");
  console.log(JSON.stringify({ pb: s.pendingBattle, ap: s.activePlayer, cmd: s.players.player2.command, legal: legal(s), log: s.log.slice(-5) }, null, 1));
});
