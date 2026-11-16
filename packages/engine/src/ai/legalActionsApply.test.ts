import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allCardsCatalog, expandDeck, type DeckDefinition } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { createGameForDecks } from "../core/createGame";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import type { GameState } from "../types/game";
import { isCpuTurn, pickCpuAction, pickCpuFallbackAction } from "./index";

/** arena-decks/<id>.json があればそのデッキ、なければスターター。 */
function deckSide(id: string) {
  try {
    const deck = JSON.parse(readFileSync(resolve(__dirname, "../../arena-decks", `${id}.json`), "utf8")) as DeckDefinition;
    return { starter: "abarenoh", deck: expandDeck(deck, allCardsCatalog) };
  } catch {
    return { starter: id, deck: undefined };
  }
}

/**
 * Lv1 同士で指し進め、局面ごとに合法手（getLegalActions）を全部 applyAction に通す。合法手に出るのにエンジンが断る手が
 * あると、画面ではボタンを押してもエラーになり、CPU は指せずに対局が止まる（RS-255 巨大化爆弾の窓）。
 * 断られた手を「手の種類|フェイズ|エラー」で返す。
 */
function playChecked(a: string, b: string, seed: number): { state: GameState; rejected: string[] } {
  const p1 = deckSide(a);
  const p2 = deckSide(b);
  let state = createStarterGame({ player1Starter: p1.starter, player2Starter: p2.starter, player1Deck: p1.deck, player2Deck: p2.deck, seed } as Parameters<typeof createStarterGame>[0]);
  const rejected = new Set<string>();
  for (let step = 0; step < 4000 && !state.winner; step++) {
    const legal = getLegalActions(state);
    if (legal.length === 0) {
      rejected.add(`no_legal_actions|${state.phase}`);
      break;
    }
    for (const action of legal) {
      const r = applyAction(state, action);
      if (!r.ok) rejected.add(`${action.type}|${state.phase}|${JSON.stringify(r.error)}`);
    }
    const actor = isCpuTurn(state, "player2") ? "player2" : getActionPlayerId(state);
    let action = pickCpuAction(state, actor, 1) ?? pickCpuFallbackAction(state, actor);
    let result = action ? applyAction(state, action) : null;
    if (!result?.ok) {
      action = pickCpuFallbackAction(state, actor);
      result = action ? applyAction(state, action) : null;
    }
    if (!result?.ok) {
      rejected.add(`cpu_stuck|${state.phase}`);
      break;
    }
    state = result.state;
  }
  return { state, rejected: [...rejected] };
}

// 2026-10-26 の見直しで、全 182 デッキの CPU 同士の対戦で見つかった局面（デッキの組・seed はそのときの再現）。
describe("合法手に出る手は、エンジンがすべて受け付ける", () => {
  it.each([
    // RS-255 巨大化爆弾の窓が、相手のバトル進入中（XG2-037【スーパーシンケンマル】で RS-494 を撃破）に開き、見送りも使用も断られて止まった。
    ["wiki-1728", "seven-ninja-c", 2],
    ["wiki-1727", "w-impact-c", 4],
    // XG4-037 牛折神（ラッシュするとき可能ならバトルエリアに置く）: ラッシュフェイズのバトル進入にアタックの手が出ていた。
    ["blog-jimdo-shinken", "blog-tocage-1241455357", 4],
    ["wiki-1803", "blog-jimdo-shinken", 2],
    // XG1-097【ブルームキャノン】: 1体も選んでいないのに確定の手が出ていた。
    ["w-impact-c", "blog-rabbit-14610577", 4],
    // XG6-056（※リードET）でホールドして RK-012（カウンター）を使う支払いが、支払いの候補に出るのに断られていた。
    ["wiki-2030", "wiki-2365", 4],
    // RS-049【ピットインダイブ】: 敵軍ラッシュエリアの S のビークル（RK-043 ライドシューター）も出す候補に出て、選ぶと断られていた。
    ["roaring-wings", "rider-exp-1-b", 1],
  ] as const)("%s 対 %s（seed %i）", (a, b, seed) => {
    const { state, rejected } = playChecked(a, b, seed);
    expect(rejected).toEqual([]);
    expect(state.winner).toBeDefined();
  }, 120_000);
});

// RK-264 アクロバッター（ライドされてバトルエリアに出たときの効果）で敵軍のバトルエリアの XG1-083（チェイス）を山札の下に送ると、
// チェイスの窓（pendingChase）とライドオフの選択（pendingRideOffChoice）が同時に開く。合法手・手番はチェイスを先に出すのに、
// applyAction はライドオフの選択待ちで断り、対局が止まっていた（2026-11-16、wiki-1730 対 blog-rabbit-14610577、seed 970 の 466 手目）。
// チェイスは進入効果の処理（離場）への反応なので、ライドオフの選択より先に解決する。
describe("チェイスの窓とライドオフの選択が同時に開いたとき、チェイスを先に解決する", () => {
  const arenaDeck = (id: string) =>
    expandDeck(JSON.parse(readFileSync(resolve(__dirname, "../../arena-decks", `${id}.json`), "utf8")) as DeckDefinition, allCardsCatalog);

  /** Lv1 同士で、チェイスの窓とライドオフの選択が両方開いた局面まで指し進める。 */
  function reachBothWindows(): GameState {
    let state = createGameForDecks(arenaDeck("wiki-1730"), arenaDeck("blog-rabbit-14610577"), { seed: 970 });
    for (let step = 0; step < 2000 && !state.winner; step++) {
      if (state.pendingChase && state.pendingRideOffChoice) return state;
      const actor = getActionPlayerId(state);
      const action = pickCpuAction(state, actor, 1) ?? pickCpuFallbackAction(state, actor);
      const result = action ? applyAction(state, action) : null;
      if (!result?.ok) throw new Error(`stuck at ${step}: ${JSON.stringify(action)} ${JSON.stringify(result?.error)}`);
      state = result.state;
    }
    throw new Error("チェイスの窓とライドオフの選択が同時に開く局面に届かなかった");
  }

  it("局面: 敵軍（player2）のチェイスとライドオフの選択（player1）が同時に開き、手番・合法手はチェイスのもの", () => {
    const s = reachBothWindows();
    expect(s.pendingChase).toMatchObject({ chaserPlayerId: "player2", chaserInstanceId: "XG1-083-46", mode: "rider_leave" });
    expect(s.pendingRideOffChoice).toMatchObject({ playerId: "player1", vehicleInstanceId: "RK-264-35" });
    expect(getActionPlayerId(s)).toBe("player2");
    expect(getLegalActions(s).map((a) => a.type).sort()).toEqual(["pass_chase", "resolve_chase"]);
    // ライドオフの選択は、チェイスを解決するまで受け付けない（合法手と同じ）。
    expect(applyAction(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true }).ok).toBe(false);
  }, 120_000);

  it("合法手はすべて受け付けられる", () => {
    const s = reachBothWindows();
    for (const action of getLegalActions(s)) {
      const r = applyAction(s, action);
      expect(r.ok, `${JSON.stringify(action)} → ${JSON.stringify(r.ok ? null : r.error)}`).toBe(true);
    }
  }, 120_000);

  it("チェイスする: XG1-083 は RK-300 にライドしてラッシュエリアに戻り、そのあとライドオフの選択（player1）に進める", () => {
    const s = reachBothWindows();
    const r = applyAction(s, { type: "resolve_chase", playerId: "player2", newVehicleInstanceId: "RK-300-72" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.state;
    expect(after.pendingChase).toBeUndefined();
    expect(after.players.player2.rush.find((c) => c.instanceId === "XG1-083-46")?.mountedOnInstanceId).toBe("RK-300-72");
    expect(after.players.player2.discard.some((c) => c.instanceId === "RK-300-71")).toBe(true);
    expect(after.pendingRideOffChoice).toMatchObject({ playerId: "player1", vehicleInstanceId: "RK-264-35" });
    expect(getActionPlayerId(after)).toBe("player1");
    for (const rideOff of [true, false]) {
      expect(applyAction(after, { type: "resolve_ride_off_choice", playerId: "player1", rideOff }).ok).toBe(true);
    }
  }, 120_000);

  it("チェイスしない: XG1-083 は山札の下に送られ、そのあとライドオフの選択（player1）に進める", () => {
    const s = reachBothWindows();
    const r = applyAction(s, { type: "pass_chase", playerId: "player2" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.state;
    expect(after.pendingChase).toBeUndefined();
    expect(after.players.player2.deck.at(-1)?.instanceId).toBe("XG1-083-46");
    expect(after.pendingRideOffChoice).toMatchObject({ playerId: "player1", vehicleInstanceId: "RK-264-35" });
    expect(getActionPlayerId(after)).toBe("player1");
    for (const rideOff of [true, false]) {
      expect(applyAction(after, { type: "resolve_ride_off_choice", playerId: "player1", rideOff }).ok).toBe(true);
    }
  }, 120_000);

  it("この組・seed の対局は、合法手が断られずに最後まで進む", () => {
    let state = createGameForDecks(arenaDeck("wiki-1730"), arenaDeck("blog-rabbit-14610577"), { seed: 970 });
    const rejected: string[] = [];
    for (let step = 0; step < 4000 && !state.winner; step++) {
      for (const action of getLegalActions(state)) {
        const r = applyAction(state, action);
        if (!r.ok) rejected.push(`${step}|${action.type}|${JSON.stringify(r.error)}`);
      }
      const actor = getActionPlayerId(state);
      const action = pickCpuAction(state, actor, 1) ?? pickCpuFallbackAction(state, actor);
      const result = action ? applyAction(state, action) : null;
      if (!result?.ok) {
        rejected.push(`cpu_stuck|${step}`);
        break;
      }
      state = result.state;
    }
    expect(rejected).toEqual([]);
    expect(state.winner).toBeDefined();
  }, 300_000);
});
