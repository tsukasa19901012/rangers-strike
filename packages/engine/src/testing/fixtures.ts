import type { CardDefinition } from "@rangers-strike/cards";
import { legend1Catalog } from "@rangers-strike/cards";
import type { CardInstance } from "../types/game";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import type { CostWindowKind, CostWindowMetadata } from "../types/costWindow";

const TEST_DEFINITIONS: Record<string, CardDefinition> = {
  "TST-UNIT-0": {
    id: "TST-UNIT-0",
    name: "Test Striker",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
  },
  "TST-UNIT-2": {
    id: "TST-UNIT-2",
    name: "Test Unit",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 2,
    bp: 3000,
    sp: 2,
    size: "M",
  },
  "TST-UNIT-7": {
    id: "TST-UNIT-7",
    name: "Test Zord",
    type: "unit",
    category: "WB",
    rarity: "SR",
    expansion: "test",
    powerCost: "7+",
    bp: 13000,
    sp: 1,
    size: "L",
  },
  "TST-OP": {
    id: "TST-OP",
    name: "Test Operation",
    type: "operation",
    category: "WB",
    rarity: "R",
    expansion: "test",
    powerCost: 3,
  },
  "TST-OP-ET": {
    id: "TST-OP-ET",
    name: "Test ET Command",
    type: "operation",
    category: "ET",
    rarity: "R",
    expansion: "test",
    powerCost: 1,
  },
  "TST-OP-OT": {
    id: "TST-OP-OT",
    name: "Test OT Command",
    type: "operation",
    category: "OT",
    rarity: "R",
    expansion: "test",
    powerCost: 1,
  },
  "TST-OP-MA": {
    id: "TST-OP-MA",
    name: "Test MA Command",
    type: "operation",
    category: "MA",
    rarity: "R",
    expansion: "test",
    powerCost: 1,
  },
  "TST-OP-DA": {
    id: "TST-OP-DA",
    name: "Test DA Command",
    type: "operation",
    category: "DA",
    rarity: "R",
    expansion: "test",
    powerCost: 1,
  },
  "TST-P": {
    id: "TST-P",
    name: "Test Power",
    type: "operation",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
  },
  "TST-UNIT-WB-ET": {
    id: "TST-UNIT-WB-ET",
    name: "Test Multi Unit",
    type: "unit",
    category: ["WB", "ET"],
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
  },
  "TST-OP-WB-ET": {
    id: "TST-OP-WB-ET",
    name: "Test Multi Command",
    type: "operation",
    category: ["WB", "ET"],
    rarity: "R",
    expansion: "test",
    powerCost: 1,
  },
};

function legendDef(id: string): CardDefinition | undefined {
  return legend1Catalog.cards.find((card) => card.id === id);
}

const MERGED_DEFINITIONS: Record<string, CardDefinition> = {
  ...TEST_DEFINITIONS,
  ...(legendDef("RS-022") ? { "RS-022": legendDef("RS-022")! } : {}),
  ...(legendDef("RS-027") ? { "RS-027": legendDef("RS-027")! } : {}),
  ...(legendDef("RS-029") ? { "RS-029": legendDef("RS-029")! } : {}),
};

function inst(id: string, suffix: string): CardInstance {
  return { instanceId: `${id}:${suffix}`, cardId: id };
}

function emptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    exile: [],
    commander: [],
    damage: 0,
  };
}

export type TestStateOptions = {
  activePlayer?: PlayerId;
  phase?: GameState["phase"];
  turn?: number;
  definitions?: Record<string, CardDefinition>;
  player1?: Partial<PlayerState>;
  player2?: Partial<PlayerState>;
} & Partial<
  Pick<
    GameState,
    | "pendingDamagePayment"
    | "pendingStrike"
    | "pendingLeave"
    | "pendingRegister"
    | "pendingBattle"
    | "pendingRush"
    | "pendingEffectChoice"
    | "pendingBattleEntry"
  >
>;

export function createTestState(options: TestStateOptions = {}): GameState {
  const player1 = {
    ...emptyPlayer("player1"),
    deck: [inst("TST-OP", "p1-deck")],
    ...options.player1,
  };
  const player2 = {
    ...emptyPlayer("player2"),
    deck: [inst("TST-OP", "p2-deck")],
    ...options.player2,
  };

  const {
    activePlayer,
    phase,
    turn,
    definitions,
    player1: _p1,
    player2: _p2,
    ...pendingFields
  } = options;

  return {
    turn: turn ?? 1,
    activePlayer: activePlayer ?? "player1",
    firstPlayer: "player1",
    phase: phase ?? "charge",
    players: { player1, player2 },
    definitions: definitions ?? MERGED_DEFINITIONS,
    log: [],
    winner: null,
    ...pendingFields,
  };
}

export { TEST_DEFINITIONS, MERGED_DEFINITIONS, inst, WIN_DAMAGE };

/** Test helper: cost window satisfaction patch for createTestState player overrides. */
export function withCostWindow(
  kind: CostWindowKind,
  metadata?: CostWindowMetadata,
): Pick<PlayerState, "costWindows"> {
  return {
    costWindows: {
      [kind]: { kind, satisfied: true, metadata },
    },
  };
}

/** ラッシュテスト用の WB ホールドコマンド（TST-UNIT-* は WB カテゴリ）。 */
export function heldWbCommand(suffix = "cmd"): CardInstance {
  return { ...inst("TST-OP", suffix), commandHeld: true };
}

/** DA カテゴリのオペレーションテスト用 DA ホールドコマンド。 */
export function heldDaCommand(suffix = "cmd"): CardInstance {
  return { ...inst("TST-OP-DA", suffix), commandHeld: true };
}

/** ET カテゴリのオペレーションテスト用 ET ホールドコマンド。 */
export function heldEtCommand(suffix = "cmd"): CardInstance {
  return { ...inst("TST-OP-ET", suffix), commandHeld: true };
}

/** OT カテゴリのオペレーションテスト用 OT ホールドコマンド。 */
export function heldOtCommand(suffix = "cmd"): CardInstance {
  return { ...inst("TST-OP-OT", suffix), commandHeld: true };
}

/** MA カテゴリのラッシュテスト用 MA ホールドコマンド。 */
export function heldMaCommand(suffix = "cmd"): CardInstance {
  return { ...inst("TST-OP-MA", suffix), commandHeld: true };
}

/** MA カテゴリのリリース状態コマンド。 */
export function releasedMaCommand(suffix = "cmd"): CardInstance {
  return inst("TST-OP-MA", suffix);
}

/** ET カテゴリのリリース状態コマンド。 */
export function releasedEtCommand(suffix = "cmd"): CardInstance {
  return inst("TST-OP-ET", suffix);
}

/** WB カテゴリのリリース状態コマンド。 */
export function releasedWbCommand(suffix = "cmd"): CardInstance {
  return inst("TST-OP", suffix);
}
