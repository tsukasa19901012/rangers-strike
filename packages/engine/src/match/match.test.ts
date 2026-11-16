/**
 * 対人戦の対戦進行（match.ts）。部屋の作成・参加、操作の受け付けと拒否（再送・版番号のずれ・操作番でない・
 * 知らない別 ID・合法でない）、持ち時間と時間切れの自動進行、投了、保存と読み込み、エンジン更新時の再生。
 * CPU 同士で最後まで進める検査は src/verticalSlice/matchPlay.test.ts（test:sim）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pickCpuFallbackAction } from "../ai/helpers";
import { pickCpuAction } from "../ai/index";
import { applyAction } from "../core/applyAction";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { turnPlayerOf } from "../core/helpers";
import type { PlayerId } from "../types/game";
import { checkView } from "../view/viewChecks";
import {
  matchAct,
  CHOICE_TIME_MS,
  createMatch,
  deadlineOf,
  deserializeMatch,
  joinMatch,
  matchView,
  MatchError,
  MAX_TIMEOUTS,
  matchResign,
  resolveDeck,
  serializeMatch,
  matchTick,
  TIMEOUT_LOG_KIND,
  TURN_TIME_MS,
  type FirstPlayerChoice,
  type MatchDeps,
  type MatchState,
} from "./match";

const ENGINE = "test-1";

function makeDeps(start = 1_000_000) {
  let n = 0;
  let s = start >>> 0;
  const deps: MatchDeps = {
    now: start,
    newAliasBody: () => (n++).toString(36) + "x",
    randomSeed: () => {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return s;
    },
  };
  return deps;
}

function started(first: FirstPlayerChoice = "host", deps = makeDeps()): { m: MatchState; deps: MatchDeps } {
  const m = createMatch({ id: "m1", engineVersion: ENGINE, hostDeck: { starter: "abarenoh" }, firstPlayer: first, now: deps.now });
  joinMatch(m, { starter: "dekaranger" }, deps);
  return { m, deps };
}

/** 操作番のプレイヤーが、自分の表示の最初の合法手を送る。 */
function actFirst(m: MatchState, deps: MatchDeps, seq: number) {
  const actor = getActionPlayerId(m.game!);
  const view = matchView(m, actor, deps);
  return { actor, result: matchAct(m, actor, { seq, version: view.version, action: view.view!.legalActions[0] }, deps) };
}

/** 操作番のプレイヤーが、CPU（Lv1）の選ぶ手を自分の表示の別 ID で送る。 */
function actCpu(m: MatchState, deps: MatchDeps, seq: number) {
  const actor = getActionPlayerId(m.game!);
  const legal = getLegalActions(m.game!);
  const pick = pickCpuAction(m.game!, actor, 1) ?? legal[0]!;
  const index = legal.findIndex((a) => JSON.stringify(a) === JSON.stringify(pick));
  const view = matchView(m, actor, deps);
  return { actor, result: matchAct(m, actor, { seq, version: view.version, action: view.view!.legalActions[Math.max(0, index)] }, deps) };
}

describe("部屋の作成と参加", () => {
  it("スターターでも自作でも作れ、知らないカードやデッキは断る", () => {
    expect(resolveDeck({ starter: "abarenoh" })).toHaveLength(40);
    expect(resolveDeck({ cards: ["RS-001", "RS-001", "RS-002"] })).toHaveLength(3);
    expect(() => resolveDeck({ starter: "nope" })).toThrow(MatchError);
    expect(() => resolveDeck({ cards: ["RS-001", "ZZ-999"] })).toThrow(/unknown card/);
    expect(() => resolveDeck({ cards: [] })).toThrow(MatchError);
    expect(() => resolveDeck({} as never)).toThrow(MatchError);
    expect(() => createMatch({ id: "x", engineVersion: ENGINE, hostDeck: { starter: "nope" }, firstPlayer: "host", now: 0 })).toThrow(MatchError);
  });

  it("参加で対戦が始まり、先攻はホストの選んだとおり", () => {
    expect(started("host").m.game!.firstPlayer).toBe("player1");
    expect(started("guest").m.game!.firstPlayer).toBe("player2");
    const firsts = new Set<PlayerId>();
    for (let i = 0; i < 8; i++) firsts.add(started("random", makeDeps(1000 + i)).m.firstPlayer!);
    expect(firsts.size).toBe(2);
    const { m, deps } = started();
    expect(m.status).toBe("playing");
    expect(() => joinMatch(m, { starter: "abarenoh" }, deps)).toThrow(/not_waiting/);
  });

  it("待機中の部屋への操作は断る", () => {
    const deps = makeDeps();
    const m = createMatch({ id: "w", engineVersion: ENGINE, hostDeck: { starter: "abarenoh" }, firstPlayer: "host", now: deps.now });
    expect(matchAct(m, "player1", { seq: 1, version: m.version, action: { type: "end_phase", playerId: "player1" } }, deps)).toEqual({ ok: false, reason: "not_started" });
    expect(matchView(m, "player1", deps).view).toBeUndefined();
  });
});

describe("操作の受け付け", () => {
  it("正しい操作は通り、版番号が進み、操作が記録される", () => {
    const { m, deps } = started();
    const version = m.version;
    const { result } = actFirst(m, deps, 1);
    expect(result).toEqual({ ok: true });
    expect(m.version).toBe(version + 1);
    expect(m.actions).toHaveLength(1);
  });

  it("同じ操作番号の再送は適用せずに成功を返し、古い番号は断る", () => {
    const { m, deps } = started();
    const actor = getActionPlayerId(m.game!);
    const view = matchView(m, actor, deps);
    const request = { seq: 1, version: view.version, action: view.view!.legalActions[0] };
    expect(matchAct(m, actor, request, deps)).toEqual({ ok: true });
    const snapshot = serializeMatch(m);
    expect(matchAct(m, actor, request, deps)).toEqual({ ok: true, duplicate: true });
    expect(serializeMatch(m)).toBe(snapshot);
    actFirst(m, deps, 5);
    expect(matchAct(m, getActionPlayerId(m.game!), { ...request, seq: 3 }, deps)).toMatchObject({ ok: false });
  });

  it("版番号のずれ・操作番でない人・知らない別 ID・合法でない操作は、盤面を変えずに断る", () => {
    const { m, deps } = started();
    const actor = getActionPlayerId(m.game!);
    const enemy: PlayerId = actor === "player1" ? "player2" : "player1";
    const view = matchView(m, actor, deps);
    const legal = view.view!.legalActions[0]!;
    const snapshot = serializeMatch(m);
    expect(matchAct(m, actor, { seq: 1, version: view.version - 1, action: legal }, deps)).toEqual({ ok: false, reason: "stale" });
    expect(matchAct(m, enemy, { seq: 1, version: view.version, action: { ...legal, playerId: enemy } }, deps)).toEqual({ ok: false, reason: "not_your_turn" });
    expect(matchAct(m, actor, { seq: 1, version: view.version, action: { type: "charge_power", playerId: actor, instanceId: "~nope" } }, deps)).toEqual({ ok: false, reason: "unknown_card" });
    const real = m.game!.players[actor].hand[0]!.instanceId;
    expect(matchAct(m, actor, { seq: 1, version: view.version, action: { type: "charge_power", playerId: actor, instanceId: real } }, deps)).toEqual({ ok: false, reason: "unknown_card" });
    expect(matchAct(m, actor, { seq: 1, version: view.version, action: { type: "declare_winner", playerId: actor } }, deps)).toEqual({ ok: false, reason: "illegal" });
    expect(matchAct(m, actor, { seq: 0, version: view.version, action: legal }, deps)).toEqual({ ok: false, reason: "bad_request" });
    expect(matchAct(m, actor, { seq: 1.5, version: view.version, action: legal }, deps)).toEqual({ ok: false, reason: "bad_request" });
    expect(serializeMatch(m)).toBe(snapshot);
  });

  it("キーの並びが違うだけの操作も通る", () => {
    const { m, deps } = started();
    const actor = getActionPlayerId(m.game!);
    const view = matchView(m, actor, deps);
    const legal = view.view!.legalActions[0]! as unknown as Record<string, unknown>;
    const reversed = Object.fromEntries(Object.entries(legal).reverse());
    expect(matchAct(m, actor, { seq: 1, version: view.version, action: reversed }, deps)).toEqual({ ok: true });
  });

  it("相手の手番の間に送った操作は通らない（両者が同時に送っても1つだけ）", () => {
    const { m, deps } = started();
    const actor = getActionPlayerId(m.game!);
    const view = matchView(m, actor, deps);
    const action = view.view!.legalActions[0];
    expect(matchAct(m, actor, { seq: 1, version: view.version, action }, deps).ok).toBe(true);
    expect(matchAct(m, actor, { seq: 2, version: view.version, action }, deps)).toEqual({ ok: false, reason: "stale" });
  });
});

describe("表示", () => {
  it("相手の手札・山札・シード・本物の ID が入らない", () => {
    const { m, deps } = started();
    for (const p of ["player1", "player2"] as const) {
      const view = matchView(m, p, deps);
      expect(checkView(m.game!, p, view.view!, m.aliases[p])).toEqual([]);
      const json = JSON.stringify(view);
      expect(json).not.toContain(String(m.seed));
      expect(json).not.toContain("rngState");
      expect(view.format).toBe(1);
      expect(view.you).toBe(p);
    }
  });

  it("操作の後に表示を作っても対応表は変わらない（poll で保存し直さなくてよい）", () => {
    const { m, deps } = started();
    for (let seq = 1; seq <= 30 && m.status === "playing"; seq++) {
      actFirst(m, deps, seq);
      const before = JSON.stringify(m.aliases);
      matchView(m, "player1", deps);
      matchView(m, "player2", deps);
      expect(JSON.stringify(m.aliases)).toBe(before);
    }
  });
});

describe("持ち時間と時間切れ", () => {
  it("ターンプレイヤーは1ターン3分で、操作した分だけ減り、ターンが変わると戻る", () => {
    const { m, deps } = started();
    expect(deadlineOf(m.clock!)).toBe(deps.now + TURN_TIME_MS);
    const turnKey = m.clock!.turnKey;
    deps.now += 10_000;
    actFirst(m, deps, 1);
    if (m.clock!.turnKey === turnKey) expect(m.clock!.turnRemainingMs).toBe(TURN_TIME_MS - 10_000);
    let seq = 2;
    while (m.clock!.turnKey === turnKey && m.status === "playing" && seq < 200) {
      deps.now += 1000;
      actFirst(m, deps, seq++);
    }
    expect(m.clock!.turnKey).not.toBe(turnKey);
    expect(m.clock!.turnRemainingMs).toBe(TURN_TIME_MS);
  });

  it("相手ターン中の選択は30秒で、その間はターン側の残りが減らない", () => {
    const { m, deps } = started();
    let seq = 1;
    while (m.status === "playing" && seq < 2000 && getActionPlayerId(m.game!) === turnPlayerOf(m.game!)) {
      deps.now += 100;
      expect(actCpu(m, deps, seq++).result.ok).toBe(true);
    }
    expect(getActionPlayerId(m.game!)).not.toBe(turnPlayerOf(m.game!));
    const remaining = m.clock!.turnRemainingMs;
    expect(deadlineOf(m.clock!)).toBe(m.clock!.actorSince + CHOICE_TIME_MS);
    deps.now += 20_000;
    expect(actCpu(m, deps, seq++).result.ok).toBe(true);
    expect(m.clock!.turnRemainingMs).toBe(remaining);
  });

  it("時間切れになると自動でターンを終え、回数を数えてログに残す", () => {
    const { m, deps } = started();
    const turnPlayer = m.clock!.turnPlayer;
    const turnKey = m.clock!.turnKey;
    deps.now += TURN_TIME_MS - 1;
    expect(matchTick(m, deps)).toBe(false);
    deps.now += 1;
    expect(matchTick(m, deps)).toBe(true);
    expect(m.timeouts[turnPlayer]).toBe(1);
    expect(m.clock!.turnKey).not.toBe(turnKey);
    expect(m.logs.player1.some((l) => l === `${turnPlayer}|${TIMEOUT_LOG_KIND}|1`)).toBe(true);
    expect(m.autoActions.length).toBeGreaterThan(0);
    expect(m.status).toBe("playing");
  });

  it(`${MAX_TIMEOUTS}回目の時間切れで負け`, () => {
    const { m, deps } = started();
    const p = m.clock!.turnPlayer;
    let guard = 0;
    while (m.status === "playing" && guard++ < 50) {
      const actor = getActionPlayerId(m.game!);
      if (actor === p) deps.now = deadlineOf(m.clock!);
      else {
        // 相手は普通に操作する
        deps.now += 500;
        actFirst(m, deps, m.lastSeq[actor] + 1);
        continue;
      }
      matchTick(m, deps);
    }
    expect(m.status).toBe("finished");
    expect(m.timeouts[p]).toBe(MAX_TIMEOUTS);
    expect(m.result).toEqual({ winner: p === "player1" ? "player2" : "player1", reason: "timeout" });
  });

  it("両者が長く放置しても、期限の順に処理して必ず決着する（止まらない）", () => {
    const { m, deps } = started();
    deps.now += 24 * 60 * 60 * 1000;
    matchTick(m, deps);
    expect(m.status).toBe("finished");
    expect(m.result?.reason).toBe("timeout");
    expect(Math.max(m.timeouts.player1, m.timeouts.player2)).toBe(MAX_TIMEOUTS);
  });

  it("時間切れの後に期限内に操作すれば、その操作も通る", () => {
    const { m, deps } = started();
    deps.now += TURN_TIME_MS + 5;
    const r = actFirst(m, deps, 1);
    // 期限切れを先に確定するので、送った版番号は古くなっている
    expect(r.result).toEqual({ ok: false, reason: "stale" });
    expect(m.timeouts[r.actor] + m.timeouts[r.actor === "player1" ? "player2" : "player1"]).toBe(1);
    const again = actFirst(m, deps, 2);
    expect(again.result).toEqual({ ok: true });
  });
});

describe("時間切れの自動進行がループしない（回帰）", () => {
  it("合法手が「支払いを始める」だけの選択で、支払いの取り消しと行き来し続けない", () => {
    // CPU 同士の放置検査で見つかった盤面（RS-004 の効果のホールド支払い。2026-11-16）。
    // pickCpuFallbackAction は支払いを始め、支払いの中では取り消しを選ぶので、元の選択に戻り続けて無効試合になっていた。
    const deps = makeDeps(15_000_000);
    const json = readFileSync(new URL("./fixtures/timeoutPaymentLoop.json", import.meta.url), "utf8");
    const m = deserializeMatch(json, "replayed", deps);
    expect(m.status).toBe("playing");
    const game = m.game!;
    const actor = getActionPlayerId(game);
    expect(actor).not.toBe(turnPlayerOf(game));
    const legal = getLegalActions(game);
    expect(legal.map((a) => a.type)).toEqual(["initiate_command_payment"]);
    const entered = applyAction(game, legal[0]!);
    if (!entered.ok) throw new Error(entered.error);
    const back = applyAction(entered.state, pickCpuFallbackAction(entered.state, actor)!);
    if (!back.ok) throw new Error(back.error);
    expect(getLegalActions(back.state)).toEqual(legal);

    const autoBefore = m.autoActions.length;
    const timeoutsBefore = m.timeouts[actor];
    deps.now = deadlineOf(m.clock!);
    expect(matchTick(m, deps)).toBe(true);
    expect(m.result?.reason).not.toBe("void");
    expect(m.timeouts[actor]).toBe(timeoutsBefore + 1);
    const auto = m.autoActions.slice(autoBefore).map((i) => m.actions[i]!.type);
    expect(auto[0]).toBe("initiate_command_payment");
    expect(auto.filter((t) => t === "cancel_command_payment").length).toBeLessThan(2);
  });
});

describe("投了", () => {
  it("投了すると相手の勝ちで終わり、その後の操作は断る", () => {
    const { m, deps } = started();
    expect(matchResign(m, "player2", deps)).toBe(true);
    expect(m.result).toEqual({ winner: "player1", reason: "resign" });
    expect(matchResign(m, "player1", deps)).toBe(false);
    expect(matchAct(m, "player1", { seq: 1, version: m.version, action: { type: "end_phase", playerId: "player1" } }, deps)).toEqual({ ok: false, reason: "finished" });
    expect(matchView(m, "player1", deps).clock).toBeUndefined();
  });
});

describe("保存と読み込み", () => {
  it("カード定義を除いて保存し、読み込むと同じ表示になり、続きを遊べる", () => {
    const { m, deps } = started();
    for (let seq = 1; seq <= 40 && m.status === "playing"; seq++) actFirst(m, deps, seq);
    const json = serializeMatch(m);
    expect(json).not.toContain('"definitions"');
    expect(json.length).toBeLessThan(200_000);
    const loaded = deserializeMatch(json, ENGINE, deps);
    expect(loaded.version).toBe(m.version);
    for (const p of ["player1", "player2"] as const) {
      expect(JSON.stringify(matchView(loaded, p, deps))).toBe(JSON.stringify(matchView(m, p, deps)));
    }
    expect(actFirst(loaded, deps, 100).result).toEqual({ ok: true });
  });

  it("エンジンの版が変わったら、操作の記録から作り直す", () => {
    const { m, deps } = started();
    for (let seq = 1; seq <= 40 && m.status === "playing"; seq++) actFirst(m, deps, seq);
    const loaded = deserializeMatch(serializeMatch(m), "test-2", deps);
    expect(loaded.engineVersion).toBe("test-2");
    expect(loaded.status).toBe("playing");
    expect(loaded.version).toBe(m.version + 1);
    const { definitions: _a, ...a } = loaded.game!;
    const { definitions: _b, ...b } = m.game!;
    expect(a).toEqual(b);
    expect(getLegalActions(loaded.game!)).toEqual(getLegalActions(m.game!));
  });

  it("作り直せなければ無効試合にする", () => {
    const { m, deps } = started();
    for (let seq = 1; seq <= 10 && m.status === "playing"; seq++) actFirst(m, deps, seq);
    const raw = JSON.parse(serializeMatch(m));
    raw.actions[3] = { type: "charge_power", playerId: "player1", instanceId: "RS-000-999" };
    const loaded = deserializeMatch(JSON.stringify(raw), "test-2", deps);
    expect(loaded.status).toBe("finished");
    expect(loaded.result).toEqual({ winner: null, reason: "void", detail: "engine_update" });
  });

  it("保存形式の版が違うものは読まない", () => {
    const { m, deps } = started();
    const raw = JSON.parse(serializeMatch(m));
    raw.v = 99;
    expect(() => deserializeMatch(JSON.stringify(raw), ENGINE, deps)).toThrow(/bad_state_version/);
  });

  it("待機中の部屋も保存して読み込める", () => {
    const deps = makeDeps();
    const m = createMatch({ id: "w", engineVersion: ENGINE, hostDeck: { cards: ["RS-001", "RS-002"] }, firstPlayer: "random", now: deps.now });
    const loaded = deserializeMatch(serializeMatch(m), ENGINE, deps);
    expect(loaded.status).toBe("waiting");
    joinMatch(loaded, { starter: "abarenoh" }, deps);
    expect(loaded.status).toBe("playing");
  });
});
