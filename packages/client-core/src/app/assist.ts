// Moves the GUI makes for the human on its own, so a turn does not ask for
// clicks that have only one answer. It never picks between real choices:
// - autoStep: the only legal move is bookkeeping (draw, end a phase with
//   nothing left to do, pass a battle entry with no attacker);
// - autoStart: the start phase's rule steps (release, return battle units,
//   draw), unless a start-phase ability or a return order can be chosen;
// - autoPay: a payment that can be made only one way is confirmed.
// endTurnMove plays the "end turn" button: it ends phases and passes battle
// entries until the turn is over or a real choice comes up.
import type { GameState } from "../engineApi";
import { HUMAN } from "../engineApi";
import type { ActionOption } from "../session/session";

export type AssistSettings = {
  autoStep: boolean;
  autoStart: boolean;
  autoPay: boolean;
};

export const DEFAULT_ASSIST: AssistSettings = { autoStep: true, autoStart: true, autoPay: true };

/** Single legal moves that carry no decision. */
const AUTO_SINGLE = new Set(["draw", "end_phase", "pass_battle_entry", "release_start_commands", "return_all_battle_to_rush", "resolve_damage_payment"]);
const START_STEPS: string[] = ["release_start_commands", "return_all_battle_to_rush", "draw"];

/** Index (into `options`) of the move to make for the human, or null when the human must choose. */
export function assistMove(state: GameState, options: readonly ActionOption[], settings: AssistSettings): number | null {
  if (options.length === 0 || state.winner) return null;
  const types: string[] = options.map((o) => o.action.type);
  if (settings.autoStep && options.length === 1) {
    const type = types[0]!;
    if (AUTO_SINGLE.has(type) || /^pass_/.test(type)) return 0;
  }
  if (settings.autoStart && state.phase === "start" && state.activePlayer === HUMAN) {
    // A return with an instanceId means the order can be chosen (R-START-01): leave it to the player.
    const plain = options.every((o) => START_STEPS.includes(o.action.type) && !("instanceId" in o.action && o.action.instanceId));
    if (plain) {
      for (const step of START_STEPS) {
        const index = types.indexOf(step);
        if (index >= 0) return index;
      }
    }
  }
  if (settings.autoPay) {
    const pay = types.filter((t) => t === "resolve_command_payment").length;
    const rest = types.filter((t) => t !== "resolve_command_payment" && t !== "cancel_command_payment").length;
    if (pay === 1 && rest === 0) return types.indexOf("resolve_command_payment");
  }
  return null;
}

/** The next move of the "end turn" button, or null when it must stop (a real choice, or the turn is over). */
export function endTurnMove(state: GameState, options: readonly ActionOption[]): number | null {
  if (state.winner || state.activePlayer !== HUMAN) return null;
  const types: string[] = options.map((o) => o.action.type);
  for (const type of ["end_phase", "pass_battle_entry"]) {
    const index = types.indexOf(type);
    if (index >= 0) return index;
  }
  return assistMove(state, options, DEFAULT_ASSIST);
}
