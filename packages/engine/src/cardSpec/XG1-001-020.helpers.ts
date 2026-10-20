/**
 * cardSpec XG1-001〜XG1-020（クロスギャザー ザ・ファーストエンカウント バトルジャパン〜ターボロボ）用ヘルパー。
 * BK1-001-019.helpers.ts（RM1〜RM3・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、XG のユニットの NC・ウイング・ゾーンの確認の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { expect } from "vitest";
import { DEFS, act, attack, cardIn, deckCards, inst, legal, ncEnter, settle, st, tryAct } from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

/** 自軍（player1）バトルフェイズに、CN cn の位置（フィラー cn-1 体の後）へ id を出す（NC の選択・進入ウィンドウは残す）。 */
export function ncAt(
  id: string,
  cn: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return ncEnter(id, cn - 1, p1, p2, extra);
}

/** カード（場・コマンドゾーン）がホールド状態か。 */
export function isHeldCard(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return cardIn(s, playerId, instanceId)?.commandHeld === true;
}

/** パワーゾーンのカードがウラ向き（ダメージ）か。 */
export function isDamageCard(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  const c = s.players[playerId].power.find((x) => x.instanceId === instanceId);
  return c?.faceDown === true;
}

/** 自軍（player1）バトルフェイズに、ラッシュエリアの id でウイングを発動してホールドし、target にアタックする（反応・選択は残す）。 */
export function wingAttack(s: GameState, id: string, target: string, playerId: PlayerId = "player1"): GameState {
  return attack(act(s, { type: "hold_for_wing", playerId, instanceId: id }), id, target, playerId);
}

/** 自軍（player1）ラッシュフェイズの盤面（RM1 の rushBoard と同じ。山札の既定を明示したもの）。 */
export function rushPhaseBoard(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 自軍（player1）バトルフェイズに attacker で defender にアタックし、反応をパスして終える。 */
export function attackSettled(s: GameState, attacker: string, defender: string, playerId: PlayerId = "player1"): GameState {
  return settle(attack(s, attacker, defender, playerId));
}

/** n 枚のコマンド（リリース状態の TST-OP。コマンドゾーンを埋める用）。 */
export function fullCommand(n: number, prefix = "fc"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({ ...inst("TST-OP", `${prefix}${i}`), commandHeld: false }));
}

/**
 * ユニットの印刷スペック（RK2 の expectStats と同じ項目。マルチカテゴリ〈["MA","ET"] 等〉も書けるようにカテゴリは toEqual で比べる）。
 */
export function expectUnitStats(
  id: string,
  stats: {
    name: string;
    category: string | string[];
    size: string;
    bp: number;
    sp: number | string | undefined;
    powerCost: number | string;
    comboNumber?: number | string;
    features: string[];
    rushCondition?: string;
  },
): void {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(d.category).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber ?? undefined).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/**
 * instanceId のラッシュ（手札から）を、合法手を順にたどって最後まで進めた結果をすべて集める（追加条件の素材・母艦・コマンドの支払いの
 * 選び方をすべて試す。cancel・end_phase はたどらない。相手のラッシュの反応はパス）。「…してもよい」の置きかえが選べるかを、
 * 公開アクションの形に頼らずに確かめるための手順。
 */
export function rushResults(s: GameState, playerId: PlayerId, instanceId: string, maxDepth = 8): GameState[] {
  const results: GameState[] = [];
  const starts = legal(s).filter(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "begin_zord_setup" && a.zordInstanceId === instanceId) ||
        (a.type === "initiate_command_payment" && a.kind === "category_use" && a.sourceInstanceId === instanceId) ||
        (a.type === "rush" && a.instanceId === instanceId)),
  );
  const walk = (state: GameState, depth: number) => {
    let next = state;
    for (let i = 0; i < 4 && next.pendingRush; i += 1) {
      const defender: PlayerId = next.pendingRush.rusherPlayerId === "player1" ? "player2" : "player1";
      const pass = tryAct(next, { type: "pass_rush_reaction", playerId: defender });
      if (!pass.ok) break;
      next = pass.state;
    }
    if (!next.pendingZordSetup && !next.pendingCommandPayment) {
      results.push(next);
      return;
    }
    if (depth >= maxDepth) return;
    for (const a of legal(next)) {
      if (a.playerId !== playerId) continue;
      if (a.type !== "resolve_zord_setup" && a.type !== "resolve_command_payment") continue;
      const r = tryAct(next, a);
      if (r.ok) walk(r.state, depth + 1);
    }
  };
  for (const a of starts) {
    const r = tryAct(s, a);
    if (r.ok) walk(r.state, 1);
  }
  return results;
}
