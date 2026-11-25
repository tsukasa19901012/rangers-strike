/**
 * 「※これは（アタックされる以外では）相手に選ばれない。」敵軍のカードは、どのカードの効果でも選べない。
 * ユーザー報告（2026-11-25）「パトアーマーの効果で選ばれないサソードRFを選ぶことができる」（RS-046【アーマーアタック】の候補に
 * XG3-066 仮面ライダーサソードRF が入っていた）から、全カードの効果を同じ盤面で確かめる。
 *
 * 盤面は effectBoard.ts に、敵軍バトルエリア・ラッシュエリアの「相手に選ばれない」ユニット（RK-057 BP1000・XG3-066 BP2500・
 * XG5-051 BP3000）と、敵軍コマンドゾーンのホールド状態の XG3-066 を足したもの。そのカードの効果の選択が開くたびに、
 * player1 の合法手（アタック・ストライク以外）にそれらが入っていないかを見る。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { getLegalActions } from "../core/legalActions";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, mk, type Probe, type Tweak } from "./effectBoard";

const PROTECTED = /"(?:RK-057|XG3-066|XG5-051)~P[brc]"/g;
const addProtected: Tweak = (s) => {
  const p2 = s.players.player2;
  return {
    ...s,
    players: {
      ...s.players,
      player2: {
        ...p2,
        battle: [
          mk("RK-057", { instanceId: "RK-057~Pb" }),
          mk("XG3-066", { instanceId: "XG3-066~Pb" }),
          mk("XG5-051", { instanceId: "XG5-051~Pb" }),
          ...p2.battle,
        ],
        rush: [mk("RK-057", { instanceId: "RK-057~Pr" }), ...p2.rush],
        command: p2.command.length < 5 ? [...p2.command, mk("XG3-066", { instanceId: "XG3-066~Pc", commandHeld: true })] : p2.command,
      },
    },
  };
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

describe("「相手に選ばれない」敵軍のカードは、どのカードの効果でも選べない", () => {
  it("全カードの効果の選択に入らない", async () => {
    const hits = new Set<string>();
    const probe = (d: { id: string; name: string }, where: string): Probe => ({
      see: (s: GameState) => {
        if (NOT_CHOOSING[d.id]) return;
        const c = s.pendingEffectChoice;
        for (const a of getLegalActions(s)) {
          if (a.playerId !== "player1" || /^(battle|attack|strike)/.test(a.type)) continue;
          for (const id of JSON.stringify(a).match(PROTECTED) ?? []) hits.add(`${d.id} ${d.name} (${where}, ${c?.effectId}) ${id}`);
        }
      },
    });
    const targets = [...allFieldCards, ...allOperations];
    for (const [i, d] of targets.entries()) {
      if (i % 10 === 0) await new Promise((resolve) => setImmediate(resolve));
      for (const policy of ["first", "last"] as const) {
        if (d.type === "operation") {
          checkOperation(d, policy, undefined, addProtected, probe(d, "op"));
          continue;
        }
        checkOnRush(d, policy, undefined, addProtected, probe(d, "rush"));
        checkEnterBattle(d, policy, undefined, addProtected, probe(d, "enter"));
        checkActivations(d, policy, addProtected, () => probe(d, "act"));
      }
    }
    expect([...hits].sort()).toEqual([]);
  }, 600_000);
});
