/**
 * 07-keywords ルール仕様テスト用の小さなヘルパー。
 * エンジンの公開 API（applyAction / getLegalActions）でゲーム状況を動かすための糖衣だけを置く。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import { getFullPlayableCardById } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { createTestState, inst, MERGED_DEFINITIONS, type TestStateOptions } from "../testing/fixtures";

export { inst };

/** 合成ユニット定義。 */
export function unitDef(id: string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "rules-spec",
    powerCost: 1,
    bp: 3000,
    size: "S",
    ...over,
  };
}

/** 合成ビークル定義。 */
export function vehicleDef(id: string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "vehicle",
    category: "WB",
    rarity: "N",
    expansion: "rules-spec",
    powerCost: 1,
    size: "M",
    ...over,
  };
}

/** 合成オペレーション定義。 */
export function opDef(id: string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "operation",
    category: "WB",
    rarity: "N",
    expansion: "rules-spec",
    powerCost: 0,
    ...over,
  };
}

/** 実カード定義（キーワードがカード ID 依存の DSL で付くもの用）。 */
export function realDef(id: string): CardDefinition {
  const def = getFullPlayableCardById(id);
  if (!def) throw new Error(`unknown card ${id}`);
  return def;
}

export function defsWith(...cards: CardDefinition[]): Record<string, CardDefinition> {
  const map: Record<string, CardDefinition> = { ...MERGED_DEFINITIONS };
  for (const c of cards) map[c.id] = c;
  return map;
}

export function state(
  cards: CardDefinition[],
  options: Omit<TestStateOptions, "definitions"> = {},
): GameState {
  return createTestState({ ...options, definitions: defsWith(...cards) });
}

export function powerCards(count: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

export function legal(s: GameState): GameAction[] {
  return getLegalActions(s);
}

export function hasLegal(
  s: GameState,
  pred: (a: GameAction) => boolean,
): boolean {
  return getLegalActions(s).some(pred);
}

export function tryAct(s: GameState, action: GameAction): { ok: boolean; state: GameState; error?: string } {
  const r = applyAction(s, action);
  if (!r.ok) return { ok: false, state: s, error: r.error };
  return { ok: true, state: r.state };
}

export function act(s: GameState, action: GameAction): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(`${action.type} failed: ${r.error ?? "unknown"}`);
  return r.state;
}

export function canAttack(s: GameState, attacker: string, defender: string): boolean {
  return hasLegal(
    s,
    (a) => a.type === "battle" && a.attackerInstanceId === attacker && a.defenderInstanceId === defender,
  );
}

export function canStrike(s: GameState, instanceId: string): boolean {
  return hasLegal(s, (a) => a.type === "strike" && a.instanceId === instanceId);
}

export function canRush(s: GameState, instanceId: string): boolean {
  return hasLegal(
    s,
    (a) =>
      (a.type === "rush" && a.instanceId === instanceId) ||
      (a.type === "initiate_command_payment" && a.sourceInstanceId === instanceId && a.kind === "category_use") ||
      (a.type === "begin_zord_setup" && a.zordInstanceId === instanceId),
  );
}

export function where(s: GameState, playerId: PlayerId, instanceId: string): string | null {
  const p = s.players[playerId];
  for (const zone of ["hand", "deck", "discard", "power", "command", "rush", "battle", "operation"] as const) {
    if (p[zone].some((c) => c.instanceId === instanceId)) return zone;
  }
  return null;
}

export function card(s: GameState, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  const p = s.players[playerId];
  for (const zone of ["hand", "deck", "discard", "power", "command", "rush", "battle", "operation"] as const) {
    const found = p[zone].find((c) => c.instanceId === instanceId);
    if (found) return found;
  }
  return undefined;
}

/** 反応窓（ラッシュ反応・バトル進入後の選択など）を順にパスして解消する。 */
export function passWindows(s: GameState, max = 10): GameState {
  let next = s;
  for (let i = 0; i < max; i += 1) {
    const pass = getLegalActions(next).find((a) =>
      [
        "pass_rush_reaction",
        "pass_battle_reaction",
        "pass_leave_reaction",
        "pass_strike_reaction",
        "pass_morph_reaction",
      ].includes(a.type),
    );
    if (!pass) return next;
    next = act(next, pass);
  }
  return next;
}

/** キーワード注釈文（atwiki 規定文）。 */
export const KW = {
  resist: "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）",
  wing: "※ウイング（これは自軍バトルフェイズ中にラッシュエリアでホールドして、ラッシュエリアからアタックできる。そうしたターン、これはバトルエリアに出られない）",
  blast: "※ブラスト（自分がゲームに負けるまで残りダメージ１点で、自軍Ｌユニットが１体もなければ、これの追加条件は満たさなくてもよい）",
  breaker:
    "※ブレイカー（この効果は無効化されない。本来のカード名がこれと同名の自軍ユニットまたは自軍ビークルがあるとき、これはラッシュすることができない。これが自軍エリアにある間、これは、ブレイカーを持たない、敵軍ユニットまたは敵軍ビークルの効果に選ばれない）",
  scrum: "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない）",
  chase:
    "※チェイス（これがライド中にユニットでなくなる時、代わりにこれがライドしているビークルを捨札にしてから、ライドされていない自軍ビークルにライドさせてもよい）",
  morph:
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）",
} as const;
