// バトルフェイズでユニットを出す順番の計画（ナンバーコンビネーション＝NC を狙う）。
//
// 勝つにはストライクで 7 点のダメージを与える必要があるが、SP が空欄のユニットが多く、
// SP や効果の多くは NC（出たときの並び順がナンバーと一致する）で得る（docs/rules/05 R-CN-01〜08）。
// 1 手ずつ選ぶ探索は「今 NC になる手」も半分ほどしか選ばず（2026-10-20 計測: 263 回中 118 回）、
// 「先にナンバーのないユニットを出して、次の位置で NC を成立させる」並べ方はまったく見えない。
// ここでは出せるユニットの並べ方を短く読み、成立する NC が最も多い順番の最初の 1 体を返す。
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { numberComboTriggers } from "../rules/numberComboEffects";

type Move = Extract<GameAction, { type: "move_to_battle" }>;

const MAX_DEPTH = 5;
const MAX_NODES = 600;

export type ComboPlan = { move: Move; triggersNow: boolean; total: number };

export function planComboEntry(state: GameState, playerId: PlayerId, actions: GameAction[]): ComboPlan | null {
  const player = state.players[playerId];
  // 乗り物・降車の指定がない基本の進入だけを並べる（同じユニットの進入は 1 つにまとめる）。
  const moves = new Map<string, Move>();
  for (const a of actions) {
    if (a.type !== "move_to_battle" || a.playerId !== playerId || a.vehicleInstanceId || a.rideOff) continue;
    if (!moves.has(a.instanceId)) moves.set(a.instanceId, a);
  }
  const units = [...moves.keys()]
    .map((id) => player.rush.find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c);
  if (units.length === 0) return null;

  let nodes = 0;
  const triggers = (card: CardInstance, battle: CardInstance[]): boolean => {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || def.type !== "unit") return false;
    try {
      return numberComboTriggers(state, playerId, card, def, battle.length + 1, battle);
    } catch {
      return false;
    }
  };

  // 残りのユニットで成立させられる NC の数（深さ・ノード数の上限まで）。
  const best = (battle: CardInstance[], remaining: CardInstance[], depth: number): number => {
    if (depth >= MAX_DEPTH || remaining.length === 0 || nodes > MAX_NODES) return 0;
    let top = 0;
    for (let i = 0; i < remaining.length; i++) {
      nodes++;
      const card = remaining[i]!;
      const gain = triggers(card, battle) ? 1 : 0;
      const rest = remaining.filter((_, j) => j !== i);
      top = Math.max(top, gain + best([...battle, card], rest, depth + 1));
    }
    return top;
  };

  let plan: ComboPlan | null = null;
  for (let i = 0; i < units.length; i++) {
    const card = units[i]!;
    const now = triggers(card, player.battle);
    const total = (now ? 1 : 0) + best([...player.battle, card], units.filter((_, j) => j !== i), 1);
    // 同じ数なら今成立する手を先に。
    if (!plan || total > plan.total || (total === plan.total && now && !plan.triggersNow)) {
      plan = { move: moves.get(card.instanceId)!, triggersNow: now, total };
    }
  }
  return plan && plan.total > 0 ? plan : null;
}

