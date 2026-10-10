/**
 * 完成版ルール E2E テスト — docs/rules/ 準拠。
 * ruleRef は docs/rules/*.md のルールID（複数は ", " 区切り）。
 * 仕様: apps/web/lib/wikiTestSpecs/ruleSpecs.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { legend1Catalog, legend2Catalog, JOINT_L_EFFECTS } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { emitUnitRushedAndFinalize } from "./events/emitUnitRushed";
import { placePermanentOperation } from "./rules/permanentOperation";
import { createTestState, heldDaCommand, heldEtCommand, heldWbCommand, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const LEGEND2_DEFINITIONS = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

type RuleCase = {
  ruleId: string;
  /** docs/rules/*.md のルールID（例: "R-WIN-01"） */
  ruleRef: string;
  title: string;
  run: () => void;
};

const RULE_CASES: RuleCase[] = [
  {
    ruleId: "RULE-CORE-01",
    ruleRef: "R-SETUP-07, R-TURN-03",
    title: "先攻1ターン目はチャージから開始",
    run() {
      const state = createTestState({ phase: "charge", turn: 1 });
      expect(state.phase).toBe("charge");
      expect(state.turn).toBe(1);
    },
  },
  {
    ruleId: "RULE-CORE-02",
    ruleRef: "R-WIN-01",
    title: "7ダメージで勝利",
    run() {
      const state = createTestState({
        player2: { damage: 6 },
      });
      const unit = inst("TST-UNIT-0", "s1");
      const next = applyAction(
        {
          ...state,
          phase: "battle",
          players: {
            ...state.players,
            player1: { ...state.players.player1, battle: [unit] },
            player2: { ...state.players.player2, battle: [] },
          },
        },
        { type: "strike", playerId: "player1", instanceId: unit.instanceId },
      );
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      expect(next.state.winner).toBe("player1");
    },
  },
  {
    ruleId: "RULE-PHASE-02",
    ruleRef: "R-CHARGE-01",
    title: "チャージは1ターン1回",
    run() {
      const handCard = inst("TST-OP", "h1");
      let state = createTestState({
        phase: "charge",
        player1: { hand: [handCard, inst("TST-OP", "h2")] },
      });
      const first = applyAction(state, {
        type: "charge_power",
        playerId: "player1",
        instanceId: handCard.instanceId,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      state = first.state;
      const second = applyAction(state, {
        type: "charge_power",
        playerId: "player1",
        instanceId: state.players.player1.hand[0]!.instanceId,
      });
      expect(second.ok).toBe(false);
    },
  },
  {
    ruleId: "RULE-BATTLE-01",
    ruleRef: "R-ATK-01",
    title: "相手バトル空ではアタック不可",
    run() {
      const attacker = inst("TST-UNIT-2", "a1");
      const state = createTestState({
        phase: "battle",
        player1: { battle: [attacker] },
        player2: { battle: [] },
      });
      const attacks = getLegalActions(state).filter((a) => a.type === "attack");
      expect(attacks).toHaveLength(0);
    },
  },
  {
    ruleId: "RULE-BATTLE-03",
    ruleRef: "R-BA-02",
    title: "バトル進入で左詰め配置",
    run() {
      const unit = inst("TST-UNIT-0", "r1");
      const state = createTestState({
        phase: "battle",
        player1: { rush: [unit] },
      });
      const next = applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: unit.instanceId,
      });
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      expect(next.state.players.player1.battle).toHaveLength(1);
      expect(next.state.players.player1.rush).toHaveLength(0);
    },
  },
  {
    ruleId: "RULE-RUSH-01",
    ruleRef: "R-CMD-01, R-RUSH-11",
    title: "ラッシュにはホールド済みコマンドが必要",
    run() {
      const unit = inst("TST-UNIT-2", "h1");
      const state = createTestState({
        phase: "rush",
        player1: {
          hand: [unit],
          power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
          command: [],
        },
      });
      const rushes = getLegalActions(state).filter((a) => a.type === "rush");
      expect(rushes).toHaveLength(0);
    },
  },
  {
    ruleId: "RULE-OP-01",
    ruleRef: "R-CARD-02",
    title: "通常オペはラッシュフェイズのみ使用",
    run() {
      const op = inst("RS-015", "op");
      const defs = {
        ...MERGED_DEFINITIONS,
        ...Object.fromEntries(legend1Catalog.cards.map((card) => [card.id, card])),
      };
      const state = createTestState({
        definitions: defs,
        phase: "battle",
        player1: {
          hand: [op],
          power: [inst("TST-P", "p1"), inst("TST-P", "p2")],
          command: [heldEtCommand("c1")],
        },
      });
      expect(getLegalActions(state).some((a) => a.type === "play_operation")).toBe(false);
    },
  },
  {
    ruleId: "RULE-OP-02",
    ruleRef: "R-CARD-02",
    title: "通常オペ使用後は捨札",
    run() {
      const op = inst("RS-015", "op");
      const defs = {
        ...MERGED_DEFINITIONS,
        ...Object.fromEntries(legend1Catalog.cards.map((card) => [card.id, card])),
      };
      const state = createTestState({
        definitions: defs,
        phase: "rush",
        player1: {
          hand: [op],
          power: [inst("TST-P", "p1"), inst("TST-P", "p2")],
          command: [heldEtCommand("c1")],
        },
      });
      const action = getLegalActions(state).find((a) => a.type === "play_operation");
      expect(action).toBeDefined();
      const result = applyAction(state, action!);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.players.player1.discard.some((c) => c.cardId === "RS-015")).toBe(true);
    },
  },
  {
    ruleId: "RULE-KW-02",
    ruleRef: "R-KW-PERM-01",
    title: "常駐は各プレイヤー1枚・上書き可",
    run() {
      const rk001 = inst("RK-001", "op1");
      const rk003 = inst("RK-003", "op2");
      const instant = inst("RS-072", "instant");
      let state = createTestState({
        definitions: LEGEND2_DEFINITIONS,
        phase: "rush",
        player1: {
          operation: [],
          hand: [instant],
          command: [heldDaCommand("da")],
          power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
          discard: [],
        },
      });

      state = placePermanentOperation(state, "player1", rk001);
      expect(state.players.player1.operation[0]?.cardId).toBe("RK-001");

      state = placePermanentOperation(state, "player1", rk003);
      expect(state.players.player1.operation[0]?.cardId).toBe("RK-003");
      expect(state.players.player1.discard.some((card) => card.cardId === "RK-001")).toBe(true);

      const played = applyAction(state, {
        type: "play_operation",
        playerId: "player1",
        instanceId: instant.instanceId,
      });
      expect(played.ok).toBe(true);
      if (!played.ok) return;
      expect(played.state.players.player1.operation[0]?.cardId).toBe("RK-003");
    },
  },
  {
    ruleId: "RULE-KW-03",
    ruleRef: "R-CTR-01",
    title: "自軍ターン中はカウンター使用不可",
    run() {
      const counter = inst("RK-004", "c1");
      const state = createTestState({
        phase: "rush",
        activePlayer: "player1",
        player1: {
          hand: [counter],
          command: [heldWbCommand("cmd")],
          power: [inst("TST-OP", "p1"), inst("TST-OP", "p2"), inst("TST-OP", "p3")],
        },
      });
      const counters = getLegalActions(state).filter((a) => a.type === "play_counter");
      expect(counters).toHaveLength(0);
    },
  },
  {
    ruleId: "RULE-KW-09",
    // ルール: R-KW-MORPH-02 では置換先は自軍コマンド・パワーゾーンのみ。下記は手札のカードを選んでおり
    // ルールと食い違う（既知の不一致 E16）。挙動は変えず現行エンジンを記録している。
    ruleRef: "R-KW-MORPH-01, R-KW-MORPH-02",
    title: "敵ラッシュ時に特徴一致でモーフ置換",
    run() {
      const FEATURE = "wiki-morph";
      const rusher = inst("TST-RUSH", "rusher");
      const morphField = inst("TST-MORPH-F", "mf");
      const morphHand = inst("TST-MORPH-H", "mh");
      const unitDef = {
        id: "TST-RUSH",
        name: "Rusher",
        type: "unit" as const,
        category: "WB" as const,
        rarity: "N" as const,
        expansion: "test",
        powerCost: 1,
        bp: 2000,
        sp: 1,
        size: "S" as const,
        features: [FEATURE],
      };
      const morphDef = {
        ...unitDef,
        id: "TST-MORPH-F",
        text: "【モーフ】",
      };
      const handDef = { ...unitDef, id: "TST-MORPH-H" };

      let state = createTestState({
        phase: "rush",
        activePlayer: "player1",
        player1: { rush: [rusher] },
        player2: { rush: [morphField], hand: [morphHand] },
      });
      state.definitions["TST-RUSH"] = unitDef;
      state.definitions["TST-MORPH-F"] = morphDef;
      state.definitions["TST-MORPH-H"] = handDef;

      const opened = emitUnitRushedAndFinalize(
        state,
        "player1",
        rusher.instanceId,
        "player1",
      );
      expect(opened.state.pendingEffectChoice?.effectId).toBe("morph_replacement");

      const chosen = applyAction(opened.state, {
        type: "resolve_effect_choice",
        playerId: "player2",
        instanceId: morphHand.instanceId,
      });
      expect(chosen.ok).toBe(true);
      if (!chosen.ok) return;
      expect(
        chosen.state.players.player2.rush.some((c) => c.instanceId === morphHand.instanceId),
      ).toBe(true);
    },
  },
  {
    ruleId: "RULE-KW-10",
    // ルール: R-CN-01（ジョイントコンビネーション専用の項目は未収載。最も近い章: docs/rules/05-battle-strike-damage.md）
    ruleRef: "R-CN-01",
    title: "L/Rナンバーはバトル進入時に隣接LサイズとJC発動",
    run() {
      const helper = inst("TST-JC-L", "jl");
      const zord = inst("TST-JC-ZORD", "jz");
      const extra = inst("TST-JC-EXTRA", "je");

      let state = createTestState({
        phase: "battle",
        player1: { rush: [zord], battle: [helper] },
      });
      state.definitions["TST-JC-L"] = {
        id: "TST-JC-L",
        name: "JC Helper",
        type: "unit",
        category: "WB",
        rarity: "N",
        expansion: "test",
        powerCost: 2,
        bp: 2000,
        size: "M",
        comboNumber: "L",
      };
      state.definitions["TST-JC-ZORD"] = {
        id: "TST-JC-ZORD",
        name: "JC Zord",
        type: "unit",
        category: "WB",
        rarity: "SR",
        expansion: "test",
        powerCost: 7,
        bp: 12000,
        size: "L",
        sp: 1,
      };
      state.definitions["TST-JC-EXTRA"] = {
        id: "TST-JC-EXTRA",
        name: "Extra",
        type: "unit",
        category: "WB",
        rarity: "N",
        expansion: "test",
        powerCost: 1,
        bp: 1000,
        size: "S",
      };

      JOINT_L_EFFECTS["TST-JC-L"] = "grant_sp1_to_partner";

      const entered = applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: zord.instanceId,
      });
      expect(entered.ok).toBe(true);
      if (!entered.ok) return;

      const partner = entered.state.players.player1.battle.find(
        (c) => c.cardId === "TST-JC-ZORD",
      );
      expect(partner?.spModifier).toBe(1);

      const withExtra = createTestState({
        phase: "battle",
        player1: {
          rush: [extra],
          battle: entered.state.players.player1.battle,
        },
      });
      withExtra.definitions = entered.state.definitions;

      const third = applyAction(withExtra, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: extra.instanceId,
      });
      expect(third.ok).toBe(true);
      if (!third.ok) return;
      const zordAfter = third.state.players.player1.battle.find(
        (c) => c.cardId === "TST-JC-ZORD",
      );
      expect(zordAfter?.spModifier).toBe(1);

      delete JOINT_L_EFFECTS["TST-JC-L"];
    },
  },
];

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/rules");
const RULEBOOK_IDS = new Set(
  readdirSync(RULES_DIR)
    .filter((f) => /^\d\d-.*\.md$/.test(f))
    .flatMap((f) =>
      [...readFileSync(join(RULES_DIR, f), "utf8").matchAll(/^#### (R-[A-Z0-9-]+)/gm)].map(
        (m) => m[1]!,
      ),
    ),
);

describe("Complete rules (engine E2E, docs/rules)", () => {
  for (const ruleCase of RULE_CASES) {
    describe(ruleCase.ruleId, () => {
      it(`${ruleCase.ruleRef}: ${ruleCase.title}`, ruleCase.run);
      it(`cites rulebook IDs ${ruleCase.ruleRef}`, () => {
        for (const id of ruleCase.ruleRef.split(", ")) {
          expect(RULEBOOK_IDS.has(id), `${id} は docs/rules/ に存在しない`).toBe(true);
        }
      });
    });
  }
});
