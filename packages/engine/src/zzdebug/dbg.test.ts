import { it } from "vitest";
import { cmd, card, inst, powers, run, st } from "../rulesSpec/06-helpers";
import { effectiveBp } from "../index";
it("dbg", () => {
  let s = st({
    phase: "battle",
    player1: {
      rush: [inst("RS-081", "tr")],
      battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")],
    },
    player2: {
      battle: [inst("TST-UNIT-2", "def")],
      rush: [inst("TST-UNIT-0", "sub")],
      hand: [inst("RS-018", "n1")],
      power: powers(6),
      command: [cmd("TST-OP-MA", "m1"), cmd("TST-OP", "h1", true)],
    },
  });
  s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-081:tr" });
  console.log(effectiveBp(s, "player1", card(s, "player1", "battle", "RS-081:tr")!));
  s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-081:tr", defenderInstanceId: "TST-UNIT-2:def" });
  s = run(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: "RS-018:n1", substituteInstanceId: "TST-UNIT-0:sub" });
  s = run(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP-MA:m1"] });
  console.log(s.log.slice(-6), s.pendingBattle, s.players.player2.command);
});
