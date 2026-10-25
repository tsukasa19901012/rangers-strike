/**
 * 弾ごとのフック（BP の補正・applyAction の後処理。rules/xg1〜xg7）を、その弾のカードが対局に無いときは呼ばない。
 *
 * フックはどれも、自分の弾のカード（と、そのファイルが名指しする他の弾のカード）が対局にあるときだけ働く。ところが BP を
 * 計算するたび・アクションのたびに全部の弾のフックが場をなめていて、CPU の探索の思考時間の 1 割ほどになっていた。
 * 対局に無いカードが途中から加わることはない（カードはゾーンの間を移るだけ）ので、状態のどこかにあるカード ID を集め、
 * フックの弾のカード（再録・プロモの同一カードを含む）が 1 枚も無ければ呼ばない。
 *
 * CPU の探索の間（core/searchCache.ts）だけ絞る。探索の外（画面・テスト）では今までどおり全部呼ぶ。
 * RS_HOOK_GATE_CHECK=1 のときは探索の外でも判定し、呼ばないことにしたフックも呼んで、何もしないことを確かめる
 * （setHookGates.test.ts でテスト全体をこのモードで回す）。
 */
import { reprintSiblingIds } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import { activeSearchCache } from "../core/searchCache";

export type SetHookGate = "XG1" | "XG2" | "XG3" | "XG4" | "XG5" | "XG6" | "XG7";

/**
 * 弾のフックのファイル（rules/xg1〜xg7）が名指しする、他の弾のカード。これらが対局にあるときもフックを呼ぶ。
 * setHookGates.test.ts がファイルの中のカード ID と突き合わせるので、フックに他の弾のカードを足したらここにも足す。
 */
export const SET_HOOK_EXTRA_IDS: Record<SetHookGate, readonly string[]> = {
  XG1: ["RK-065", "RK-066", "RK-175", "RK-221", "RS-167", "RS-182", "RS-621", "XG3-084", "XG7-032", "XP-012", "XP-028"],
  XG2: ["RS-018", "XP-005", "XP-009", "XG7-042", "XG7-012", "XG3-045", "XG1-034", "RS-675", "RS-572", "RK-280", "RK-250", "RK-245", "RK-224", "RK-024", "RK-019", "RK-017"],
  XG3: ["RK-050", "XG7-042", "XG4-056", "XG2-074", "RS-524", "RS-326", "RS-106", "RK-324", "RK-173", "BK-006"],
  XG4: ["XG3-069", "XG2-025", "RS-572", "RS-167", "RM-062", "RM-038", "RM-009", "RK-324", "RK-286", "RK-247", "RK-128", "BP-500"],
  XG5: ["SX-009", "RS-584", "RS-167", "RM-017", "RM-009", "RK-269", "RK-129", "RK-011"],
  XG6: ["RK-189", "RK-179", "RK-104", "XG2-019", "RM-045", "RK-017"],
  XG7: ["RS-508", "RS-426", "RS-284", "RS-249", "RS-196", "RM-062", "RK-208", "RK-175"],
};

const checkMode = typeof process !== "undefined" && process.env?.RS_HOOK_GATE_CHECK === "1";

type CardPool = { ids: Set<string>; prefixes: Set<string> };

const POOL_KEY = "setHookGates:cardPool";

/** 状態のどこか（両プレイヤーの全ゾーン・重ねたカード・保留中の処理等）にあるカード ID と、その再録・プロモの同一カードの ID。 */
function cardPool(state: GameState): CardPool {
  // 探索の間は同じ対局の状態しか出てこず、カードの顔ぶれは変わらないので、定義表ごとに 1 度だけ集める（毎回集めると、
  // フックを呼ぶより重かった）。
  const cache = activeSearchCache()?.perObject;
  const byKey = cache?.get(state.definitions);
  const hit = byKey?.get(POOL_KEY) as CardPool | undefined;
  if (hit) return hit;
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) visit(v);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k === "cardId" && typeof v === "string") ids.add(v);
        else if (v && typeof v === "object") visit(v);
      }
    }
  };
  // 解決中のカードなどがゾーンの外（保留中の処理の中）に置かれることもあるので、定義表とログ以外を全部見る。
  for (const [k, v] of Object.entries(state)) if (k !== "definitions" && k !== "log" && v && typeof v === "object") visit(v);
  for (const id of [...ids]) for (const sibling of reprintSiblingIds(id)) ids.add(sibling);
  const prefixes = new Set<string>();
  for (const id of ids) prefixes.add(id.slice(0, id.indexOf("-")));
  const pool = { ids, prefixes };
  // 探索の外（RS_HOOK_GATE_CHECK=1 のテスト等）では、状態を書き換えてカードを足すことがあるので覚えない。
  if (cache) {
    if (byKey) byKey.set(POOL_KEY, pool);
    else cache.set(state.definitions, new Map([[POOL_KEY, pool]]));
  }
  return pool;
}

function gateOpen(pool: CardPool, gate: SetHookGate, extraCardId?: string): boolean {
  if (pool.prefixes.has(gate)) return true;
  if (extraCardId !== undefined) {
    if (extraCardId.startsWith(`${gate}-`)) return true;
    for (const sibling of reprintSiblingIds(extraCardId)) if (sibling.startsWith(`${gate}-`)) return true;
  }
  return SET_HOOK_EXTRA_IDS[gate].some((id) => pool.ids.has(id));
}

/** この状態で弾 gate のフックを呼ぶか（探索の外では常に呼ぶ）。extraCardId: BP を求めるカード等、状態の外から来るかもしれない ID。 */
function shouldRun(state: GameState, gate: SetHookGate, extraCardId?: string): boolean {
  if (!activeSearchCache() && !checkMode) return true;
  return gateOpen(cardPool(state), gate, extraCardId);
}

/** 弾 gate の BP の補正。呼ばないときは 0。 */
export function gatedBpBonus(state: GameState, gate: SetHookGate, cardId: string, compute: () => number): number {
  if (shouldRun(state, gate, cardId)) return compute();
  if (checkMode) {
    const actual = compute();
    if (actual !== 0) throw new Error(`setHookGates: ${gate} BP hook returned ${actual} for ${cardId} without ${gate} cards`);
  }
  return 0;
}

/** 弾 gate の applyAction の後処理。呼ばないときは状態をそのまま返す。 */
export function gatedAfterAction(before: GameState, after: GameState, gate: SetHookGate, compute: () => GameState): GameState {
  if (shouldRun(before, gate) || shouldRun(after, gate)) return compute();
  if (checkMode) {
    const actual = compute();
    if (actual !== after && JSON.stringify(actual) !== JSON.stringify(after)) {
      throw new Error(`setHookGates: ${gate} after-action hook changed the state without ${gate} cards`);
    }
  }
  return after;
}
