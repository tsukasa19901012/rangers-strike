/**
 * ターンが入れ替わらないことの回帰テスト（2026-11-12 報告「CPU がモーフしたらターンが入れ替わってる？」の横展開）。
 * scripts/turn-owner-sweep.ts で見つかった試合（--seed 7 の試合番号）を、そのまま指し直して確かめる。
 * - 12: RS-572 デカマスター【ディーソード・ベガ】の選択のあとダメージの支払いが挟まり、中断したバトル進入が再開されず次のターンへ残った。
 * - 135: 前のターンに残った中断中のバトル進入が、相手のターンの RM-017 の選択のあとで再開され、相手側がフェイズを終えた。
 * - 84: レジスターのあとのダメージの支払いの再開先（resume.activePlayer）が守る側になっていた。
 * - 486: ターン終了時に撃破された RS-093 童鬼ドロップ【かんしゃく】のダメージの再開先が持ち主（ターンプレイヤーでない）になっていた。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allCardsCatalog, expandDeck, type DeckDefinition } from "@rangers-strike/cards";
import { turnPlayerOf } from "../core/helpers";
import { playTurnOwnerGame, sweepRng } from "../testing/turnOwnerGame";
import type { GameState } from "../types/game";

function arenaDeck(id: string) {
  const file = resolve(__dirname, "../../arena-decks", `${id}.json`);
  return expandDeck(JSON.parse(readFileSync(file, "utf8")) as DeckDefinition, allCardsCatalog);
}

const SEED = 7;
const GAMES: Array<[number, string, string]> = [
  [12, "blog-livedoor-letsrenst-259463", "wiki-1716"],
  [84, "blog-livedoor-letsrenst-1889828", "blog-livedoor-letsrenst-2841804"],
  [135, "blog-livedoor-letsrenst-3933562", "octgn-rsxg-13"],
  [486, "blog-rabbit-10171998", "blog-livedoor-letsrenst-5480354-4"],
];

describe("ターンの持ち主（turn-owner-sweep で見つかった試合）", () => {
  for (const [game, d1, d2] of GAMES) {
    it(`試合 ${game}（${d1} vs ${d2}）: ターンの持ち主以外がフェイズを終えず、中断したバトル進入を次のターンへ持ち越さない`, () => {
      const rand = sweepRng(SEED * 1_000_003 + game);
      // スクリプトと同じく、デッキを 2 つ選ぶのに乱数を 2 回使う。
      rand();
      rand();
      const r = playTurnOwnerGame({ deck1Id: d1, deck2Id: d2, deck1: arenaDeck(d1), deck2: arenaDeck(d2), seed: SEED + game, rand, explore: 0.3 });
      expect(r.violation, JSON.stringify(r.violation)).toBeNull();
      expect(r.stale, JSON.stringify(r.stale)).toEqual([]);
    }, 120_000);
  }
});

describe("turnPlayerOf", () => {
  const base = { activePlayer: "player2" } as Pick<GameState, "activePlayer">;

  it("待ちがなければ activePlayer", () => {
    expect(turnPlayerOf(base as GameState)).toBe("player2");
  });

  it("反応窓・選択・ストライクの間は、activePlayer が守る側に移っていても待ちの phasePlayerId（ターンプレイヤー）", () => {
    expect(turnPlayerOf({ ...base, pendingRush: { phasePlayerId: "player1" } } as unknown as GameState)).toBe("player1");
    expect(turnPlayerOf({ ...base, pendingMorph: { phasePlayerId: "player1" } } as unknown as GameState)).toBe("player1");
    expect(turnPlayerOf({ ...base, pendingEffectChoice: { phasePlayerId: "player1" } } as unknown as GameState)).toBe("player1");
    expect(turnPlayerOf({ ...base, pendingStrike: { battlePhasePlayer: "player1" } } as unknown as GameState)).toBe("player1");
    expect(turnPlayerOf({ ...base, pendingRegister: { phasePlayerId: "player1" } } as unknown as GameState)).toBe("player1");
  });
});
