/**
 * 「選ばれない」敵軍のカードは、どのカードの効果でも選べない。
 * ユーザー報告（2026-11-25）「パトアーマーの効果で選ばれないサソードRFを選ぶことができる」（RS-046【アーマーアタック】の候補に
 * XG3-066 仮面ライダーサソードRF が入っていた）から、全カードの効果を 3 通りの盤面で確かめる（rules/pendingChoices.ts
 * withoutOpponentProtectedTargets）。
 *
 * - field: 敵軍バトルエリア・ラッシュエリアに「※これは（アタックされる以外では）相手に選ばれない。」ユニット（RK-057 BP1000・
 *   XG3-066 BP2500・XG5-051 BP3000）、コマンドゾーンにホールド状態の XG3-066。
 * - breaker: 敵軍バトルエリア・ラッシュエリアにブレイカー（XG6-035。ブレイカーを持たない敵軍ユニット・ビークルの効果に選ばれない。
 *   R-KW-BREAKER-01/03）。「相手は自分自身のユニットを1体選び」のように持ち主が選ぶときも選べない。オペレーションとブレイカー持ちの効果では選べる。
 * - shown: 敵軍のオモテ向きのパワー・捨札に XG3-066 等（相手が見て選ぶなら場以外でも効く。docs/rules/README.md §5.7 j）。
 *
 * そのカードの効果の選択が開くたびに、合法手（アタック・ストライク以外）にそれらが入っていないかを見る。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import { getLegalActions } from "../core/legalActions";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, mk, type Probe, type Tweak } from "./effectBoard";

const P = (id: string, tag: string, extra: Partial<CardInstance> = {}) => mk(id, { instanceId: `${id}~P${tag}`, ...extra });

const BOARDS: Record<string, Tweak> = {
  field: (s) => {
    const p2 = s.players.player2;
    return {
      ...s,
      players: {
        ...s.players,
        player2: {
          ...p2,
          battle: [P("RK-057", "b"), P("XG3-066", "b"), P("XG5-051", "b"), ...p2.battle],
          rush: [P("RK-057", "r"), ...p2.rush],
          command: p2.command.length < 5 ? [...p2.command, P("XG3-066", "c", { commandHeld: true })] : p2.command,
        },
      },
    };
  },
  breaker: (s) => {
    const p2 = s.players.player2;
    return { ...s, players: { ...s.players, player2: { ...p2, battle: [P("XG6-035", "b"), ...p2.battle], rush: [P("XG6-035", "r"), ...p2.rush] } } };
  },
  shown: (s) => {
    const p2 = s.players.player2;
    return {
      ...s,
      players: {
        ...s.players,
        player2: {
          ...p2,
          power: [P("XG3-066", "p", { faceDown: false }), P("RK-057", "p", { faceDown: false }), ...p2.power],
          discard: [P("XG3-066", "d"), P("XG5-051", "d"), ...p2.discard],
        },
      },
    };
  },
};

/**
 * 敵軍のユニットを「選んで」いない効果（「すべて」「好きな順に並べ替える」。候補は出す順・並べる順）。
 * rules/pendingChoices.ts の NOT_CHOOSING_EFFECT_IDS と同じ。
 */
const NOT_CHOOSING: Record<string, string> = {
  "RK-087": "敵軍ラッシュエリアにあるすべてのSユニットをバトルエリアに出す・好きな順に並べ替える",
  "RS-284": "敵軍コマンドゾーンにあるSユニットのカードをすべてラッシュエリアに出す",
  "RS-397": "敵軍バトルエリアのユニットを好きな順に並び変える",
};
/** ブレイカー持ちの効果（ブレイカーは「ブレイカーを持たない」敵軍ユニットの効果だけを防ぐ。R-KW-BREAKER-01）。 */
const onField = (s: GameState, id: string) =>
  (["player1", "player2"] as const).some((p) => [...s.players[p].rush, ...s.players[p].battle].some((c) => c.instanceId === id));
const BREAKER_SOURCES = new Set(["XG7-023"]);

describe("「選ばれない」敵軍のカードは、どのカードの効果でも選べない", () => {
  for (const [board, tweak] of Object.entries(BOARDS)) {
    it(`全カードの効果の選択に入らない（${board}）`, async () => {
      const hits = new Set<string>();
      const probe = (d: { id: string; name: string; type: string }, where: string): Probe => ({
        see: (s: GameState) => {
          if (NOT_CHOOSING[d.id]) return;
          if (board === "breaker" && (d.type === "operation" || BREAKER_SOURCES.has(d.id))) return;
          const c = s.pendingEffectChoice;
          for (const a of getLegalActions(s)) {
            if (/^(battle|attack|strike)/.test(a.type)) continue;
            // 持ち主が選ぶ（「相手は自分自身の…を選び」）のを防ぐのはブレイカーだけ
            if (a.playerId !== "player1" && board !== "breaker") continue;
            for (const id of JSON.stringify(a).match(/"[A-Z0-9]+-\d+~P[a-z]"/g) ?? []) {
              // 効果で手札に戻ったあと（RS-565 の「手札から1枚選び」等）は場のカードではない
              if (board === "breaker" && !onField(s, id.slice(1, -1))) continue;
              hits.add(`${d.id} ${d.name} (${where}, ${c?.effectId}) ${a.playerId} ${id}`);
            }
          }
        },
      });
      const targets = [...allFieldCards, ...allOperations];
      for (const [i, d] of targets.entries()) {
        if (i % 10 === 0) await new Promise((resolve) => setImmediate(resolve));
        for (const policy of ["first", "last"] as const) {
          if (d.type === "operation") {
            checkOperation(d, policy, undefined, tweak, probe(d, "op"));
            continue;
          }
          checkOnRush(d, policy, undefined, tweak, probe(d, "rush"));
          checkEnterBattle(d, policy, undefined, tweak, probe(d, "enter"));
          checkActivations(d, policy, tweak, () => probe(d, "act"));
        }
      }
      expect([...hits].sort()).toEqual([]);
    }, 600_000);
  }
});
