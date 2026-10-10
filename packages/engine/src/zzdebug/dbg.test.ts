import { it } from "vitest";
import { deck, inst, legal, run, st } from "../rulesSpec/06-helpers";
it("dbg", () => {
  let s = st({
    phase: "battle",
    player1: { rush: [inst("RS-100", "hy")], deck: [inst("RS-100", "hy2"), ...deck(3)] },
    player2: { battle: [inst("TST-UNIT-0", "e1")] },
  });
  s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-100:hy" });
  console.log(s.pendingEffectChoice, s.log.slice(-4), s.players.player1.unitActionsThisTurn);
  while (s.pendingEffectChoice) {
    const pick = legal(s).find((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
    if (!pick) break;
    s = run(s, pick);
  }
  console.log(s.log.slice(-4), s.players.player1.unitActionsThisTurn, s.players.player1.battle);
});
