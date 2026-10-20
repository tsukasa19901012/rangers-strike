/**
 * cardSpec XG6-001〜XG6-022（クロスギャザー ザ・ギガンティックタイタン 火の山、吠える〜リンカメレオン）用ヘルパー。
 * BK1-001-019.helpers.ts（RK1〜RK16・RM1〜RM3・BK のヘルパーを含む）をそのまま再エクスポートし、
 * ダメージ・追加条件・場に出したときの盤面の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { DEFS, act, damageCards, deckCards, enter, inst, legal, p1Battle, rushBoard, rushFromHand, st } from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

/** パワーゾーン（オモテ向きのカード faceUp の後にダメージ dmg 枚）と、ダメージの点数。 */
export function withDamage(dmg: number, faceUp: CardInstance[] = []): { power: CardInstance[]; damage: number } {
  return { power: [...faceUp, ...damageCards(dmg)], damage: dmg };
}

/** 追加条件（カタログの rushAdditionalCondition）の種類と本文。 */
export function expectRushCondition(id: string, conditionId: string | undefined, text?: string): void {
  const c = (DEFS[id] as { rushAdditionalCondition?: { conditionId?: string; text?: string } } | undefined)?.rushAdditionalCondition;
  expect(c?.conditionId).toBe(conditionId);
  if (text !== undefined) expect((c?.text ?? "").normalize("NFKC").replace(/[\s。]/g, "")).toBe(text.normalize("NFKC").replace(/[\s。]/g, ""));
}

/** ユニットの印刷スペック（追加条件の種類は見ない。マルチカテゴリは配列で書く）。 */
export function expectUnit(
  id: string,
  stats: { name: string; category: string | string[]; size: string; bp: number; sp: number | string | undefined; powerCost: number | string; comboNumber?: number | string; features: string[] },
): void {
  const d = DEFS[id] as CardDefinition & { category: string | string[] };
  expect(d, `${id} の定義がない`).toBeDefined();
  expect({ name: d.name, type: d.type, category: d.category, size: d.size, bp: d.bp, sp: d.sp ?? undefined, powerCost: d.powerCost, comboNumber: d.comboNumber, features: d.features ?? [] }).toEqual({
    ...stats,
    type: "unit",
  });
}

/** カードの種類・カテゴリ（マルチカテゴリは配列）。 */
export function expectKindCategory(id: string, type: string, category: string | string[]): void {
  const d = DEFS[id] as CardDefinition & { category: string | string[] };
  expect(d.type).toBe(type);
  expect(d.category).toEqual(category);
}

/** 自軍バトルフェイズに id（自軍ラッシュエリア）をバトルエリアに出す（進入直後の選択・行動ウィンドウは残す）。 */
export function entered(
  id: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cid, suf] = id.split(":") as [string, string];
  return enter(p1Battle({ ...p1, rush: [inst(cid, suf), ...(p1.rush ?? [])] }, p2, extra), id);
}

/** 自軍ラッシュフェイズに手札の id をラッシュする（必要パワー・コマンドは p1 で与える）。結果（ok）と、ラッシュしたときの選択を開いたままの state。 */
export function rushHand(
  id: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  materials?: string[],
): { ok: boolean; state: GameState; error?: string } {
  const [cid, suf] = id.split(":") as [string, string];
  const s = rushBoard({ ...p1, hand: [inst(cid, suf), ...(p1.hand ?? [])] }, p2, extra);
  return rushFromHand(s, "player1", id, materials ? { materials } : {});
}

/** 敵軍（player2）の手番（既定はバトルフェイズ）。 */
export function enemyTurn(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  phase: GameState["phase"] = "battle",
): GameState {
  return st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 敵軍（player2）の attacker が自軍（player1）の defender にアタックする（反応ウィンドウは残す）。 */
export function enemyAttacks(s: GameState, attacker: string, defender: string): GameState {
  return act(s, { type: "battle", playerId: "player2", attackerInstanceId: attacker, defenderInstanceId: defender });
}

/** ゲームの勝者（決まっていなければ undefined）。 */
export function winnerOf(s: GameState): PlayerId | null {
  return s.winner ?? null;
}

/** 合法手に、指定の playerId の行動があるか（種類を問わない）。 */
export function anyLegalFor(s: GameState, playerId: PlayerId): boolean {
  return legal(s).some((a) => a.playerId === playerId);
}
