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

const MAX_DEPTH = 7;
/** 最初の 1 体ごとの読みの上限。 */
const MAX_NODES = 500;

export type ComboPlan = { move: Move; triggersNow: boolean; total: number; spare?: boolean };

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

  // そのユニットのナンバーがこれから来る位置にあるか（あればそのナンバー、なければ 0）。
  const futureNumber = (card: CardInstance, position: number): number => {
    const def = getDefinition(state.definitions, card.cardId);
    const n = def && def.type === "unit" && typeof def.comboNumber === "number" ? def.comboNumber : 0;
    return n > position ? n : 0;
  };

  // 残りのユニットで成立させられる NC の数（深さ・ノード数の上限まで）。
  // 同じカードは 1 枚だけ試し、この先 NC を狙えないユニット（埋め草）は 1 体だけ試す。以前はすべての
  // 並べ方を試していたため、ラッシュエリアに 7 体以上並ぶとノード数の上限で最初の 1 体の読みしかできず、
  // 並べ方が実質ランダムになっていた（XG4 スターターB で 10 体以上並ぶ、2026-10-21）。
  const best = (battle: CardInstance[], remaining: CardInstance[], depth: number): number => {
    if (depth >= MAX_DEPTH || remaining.length === 0 || nodes > MAX_NODES) return 0;
    let top = 0;
    const tried = new Set<string>();
    const others: number[] = [];
    let filler = -1;
    for (let i = 0; i < remaining.length; i++) {
      const card = remaining[i]!;
      if (tried.has(card.cardId)) continue;
      tried.add(card.cardId);
      nodes++;
      if (!triggers(card, battle)) {
        // この先の位置で NC を狙えないユニットなら、どれを置いても同じなので 1 体だけ試す。
        if (futureNumber(card, battle.length + 1) === 0) filler = filler < 0 ? i : filler;
        else others.push(i);
        continue;
      }
      const rest = remaining.filter((_, j) => j !== i);
      top = Math.max(top, 1 + best([...battle, card], rest, depth + 1));
    }
    for (const i of filler >= 0 ? [filler] : others) {
      const rest = remaining.filter((_, j) => j !== i);
      top = Math.max(top, best([...battle, remaining[i]!], rest, depth + 1));
    }
    return top;
  };

  let plan: ComboPlan | null = null;
  const triedFirst = new Set<string>();
  for (let i = 0; i < units.length; i++) {
    const card = units[i]!;
    if (triedFirst.has(card.cardId)) continue;
    triedFirst.add(card.cardId);
    nodes = 0;
    const now = triggers(card, player.battle);
    const total = (now ? 1 : 0) + best([...player.battle, card], units.filter((_, j) => j !== i), 1);
    // 同じ数なら今成立する手を先に。
    // 同じ数で、どちらも今は成立しないなら、この先 NC を狙えないユニットを先に（埋め草）。
    const pos = player.battle.length + 1;
    const spare = !now && futureNumber(card, pos) === 0;
    if (
      !plan ||
      total > plan.total ||
      (total === plan.total && now && !plan.triggersNow) ||
      (total === plan.total && spare && !plan.triggersNow && !plan.spare)
    ) {
      plan = { move: moves.get(card.instanceId)!, triggersNow: now, total, spare };
    }
  }
  return plan && plan.total > 0 ? plan : null;
}

