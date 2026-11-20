import { describe, expect, it } from "vitest";
import * as engine from "@rangers-strike/engine";
import type { GameState } from "../engineApi";
import { AppController } from "../app/controller";
import { testEngine, testPlatform } from "../testing/engine";
import { GameSession } from "./session";
import { REPLAY_FRAMES, ReplayPlayer, replayEvents, opponentPayingDamage, type ReplayEvent } from "./replay";

const LABELS = { player1: "あなた", player2: "CPU" } as const;

/** A whole CPU-vs-CPU match through GameSession, collecting the replay steps of every move. */
function playMatch(g: number): { session: GameSession; events: ReplayEvent[] } {
  const ids = engine.ALL_STARTER_DECK_IDS as readonly string[];
  let t = 0;
  const session = new GameSession({
    engine: testEngine,
    humanDeck: ids[(g * 7) % ids.length]!,
    cpuDeck: ids[(g * 13 + 3) % ids.length]!,
    seed: 100 + g,
    cpuLevel: 2,
    humanLevel: 2,
    clock: () => t++,
  });
  const events: ReplayEvent[] = [];
  for (let i = 0; i < 3000 && !session.over; i++) {
    if (!session.cpuStep().ok) break;
    events.push(...session.takeReplay());
  }
  return { session, events };
}

describe("replayEvents: 相手の操作を1手ずつ", () => {
  const runs = [0, 1, 2, 3, 4, 5].map(playMatch);
  const all = runs.flatMap((r) => r.events);

  it("ラッシュ・NC・アタック・ストライク・オペレーション・ダメージの裏返しが拾える", () => {
    const kinds = new Set(all.map((e) => e.kind));
    for (const kind of ["rush", "nc", "attack", "strike", "operation", "flip"] as const) expect(kinds, kind).toContain(kind);
  });

  it("どの手もカードと文が付き、自分の手はアタックとストライクだけ（トーストなし）", () => {
    for (const { session, events } of runs) {
      for (const e of events) {
        expect(session.state.definitions[e.cardId], JSON.stringify(e)).toBeDefined();
        expect(e.title).not.toBe("");
        if (e.actor === "player1") {
          expect(e.own).toBe(true);
          expect(["attack", "strike"]).toContain(e.kind);
        } else expect(e.own).toBeUndefined();
      }
    }
  });

  it("アタックは相手のユニット、ストライクはダメージを受ける側を指す", () => {
    const attacks = all.filter((e) => e.kind === "attack");
    expect(attacks.filter((e) => e.targetId && e.targetCardId).length).toBeGreaterThan(attacks.length * 0.8);
    for (const e of all.filter((x) => x.kind === "strike")) {
      expect(e.targetPlayer).toBe(e.actor === "player1" ? "player2" : "player1");
      expect(e.damage).toBeGreaterThanOrEqual(0);
    }
    // A unit the battle destroyed is still drawn: where it stood before is kept.
    expect(attacks.every((e) => e.from || e.instanceId)).toBe(true);
  });

  it("対人戦: 裏向きのパワーに新しい ID が付いても、表から消えたカードを裏返したカードとして拾う", () => {
    const { session } = runs[0]!;
    const prev = session.state;
    const power = prev.players.player2.power;
    const up = power.findIndex((c) => !c.faceDown);
    expect(up).toBeGreaterThanOrEqual(0);
    // The server hides a face-down card of the other side: a new hidden id and no card number.
    const nextPower = power.map((c, i) => (i === up ? { instanceId: "?9", cardId: "?", faceDown: true } : c));
    const next = { ...prev, players: { ...prev.players, player2: { ...prev.players.player2, power: nextPower } } } as GameState;
    const events = replayEvents(testEngine, prev, next, [], LABELS);
    expect(events).toEqual([expect.objectContaining({ kind: "flip", actor: "player2", cardId: power[up]!.cardId })]);
  });

  it("ストライクの行がユニットを「unknown」と書いても、待っていたストライクからユニットが分かる", () => {
    const { session } = runs.find((r) => r.session.state.players.player2.battle.length > 0) ?? runs[0]!;
    const prev = session.state;
    const unit = prev.players.player2.battle[0] ?? prev.players.player2.rush[0]!;
    const pending = { ...prev, pendingStrike: { strikerPlayerId: "player2", strikerInstanceId: unit.instanceId, damage: 1, battlePhasePlayer: "player2" } } as GameState;
    const events = replayEvents(testEngine, pending, prev, ["player2|strike|unknown|unknown|1"], LABELS);
    expect(events[0]).toMatchObject({ kind: "strike", cardId: unit.cardId, instanceId: unit.instanceId, damage: 1 });
    const cancelled = replayEvents(testEngine, pending, prev, ["player2|strike|unknown|unknown|0"], LABELS);
    expect(cancelled[0]).toMatchObject({ damage: 0, detail: expect.stringContaining("無効") });
  });

  it("ストライクは、ダメージで裏返すパワーを選ぶ前に見せる（あとで重ねて出さない）", () => {
    const ids = engine.ALL_STARTER_DECK_IDS as readonly string[];
    let t = 0;
    const session = new GameSession({ engine: testEngine, humanDeck: ids[0]!, cpuDeck: ids[3]!, seed: 100, cpuLevel: 2, humanLevel: 2, clock: () => t++ });
    let opened = 0;
    for (let i = 0; i < 3000 && !session.over; i++) {
      const wasPaying = session.state.pendingDamagePayment;
      if (!session.cpuStep().ok) break;
      const events = session.takeReplay();
      const pay = session.state.pendingDamagePayment;
      if (pay && !wasPaying && pay.resume.kind === "strike") {
        // The strike is in the same step that asks for the power cards.
        const striker = pay.resume.pending.strikerPlayerId;
        expect(events.filter((e) => e.kind === "strike" && e.actor === striker)).toHaveLength(1);
        opened++;
      }
      if (wasPaying?.resume.kind === "strike" && !pay) {
        expect(events.filter((e) => e.kind === "strike")).toHaveLength(0);
      }
    }
    expect(opened).toBeGreaterThan(0);
  });

  it("カウンターは使ったカードを大きく見せる手になる", () => {
    const { session } = runs[0]!;
    const card = Object.values(session.state.definitions).find((d) => /アタックされたとき発動できる/.test(d.text ?? ""))!;
    const events = replayEvents(testEngine, session.state, session.state, [`player2|play_counter|${card.id}|${card.name}`], LABELS);
    expect(events[0]).toMatchObject({ kind: "counter", actor: "player2", cardId: card.id, title: `カウンター：${card.name}` });
  });

  it("相手が裏返すパワーを選ぶ間だけ opponentPayingDamage", () => {
    const { session } = runs[0]!;
    const state = session.state;
    const paying = (playerId: "player1" | "player2", choosingPlayerId?: "player1" | "player2") =>
      ({ ...state, pendingDamagePayment: { playerId, choosingPlayerId, remainingFlips: 1, deckDraws: 0, totalDamage: 1, selectedFlipIds: [], resume: { kind: "none" } } }) as unknown as GameState;
    expect(opponentPayingDamage(paying("player2"))).toBe(true);
    expect(opponentPayingDamage(paying("player1"))).toBe(false);
    expect(opponentPayingDamage(paying("player2", "player1"))).toBe(false);
    expect(opponentPayingDamage({ ...state, pendingDamagePayment: undefined })).toBe(false);
  });
});

describe("ReplayPlayer", () => {
  const step = (kind: ReplayEvent["kind"], own = false): ReplayEvent => ({ kind, actor: own ? "player1" : "player2", cardId: "RS-001", title: kind, detail: "", ...(own ? { own } : {}) });

  it("1手ずつ順に、決まった長さだけ見せる", () => {
    const player = new ReplayPlayer();
    player.push([step("rush"), step("attack")]);
    const seen: string[] = [];
    let frames = 0;
    while (player.busy && frames < 1000) {
      player.frame();
      const v = player.view();
      if (v.event && seen[seen.length - 1] !== v.event.kind) seen.push(v.event.kind);
      frames++;
    }
    expect(seen).toEqual(["rush", "attack"]);
    expect(frames).toBeGreaterThanOrEqual(REPLAY_FRAMES.rush + REPLAY_FRAMES.attack);
    expect(frames).toBeLessThan(REPLAY_FRAMES.rush + REPLAY_FRAMES.attack + 10);
  });

  it("自分のアタックは短い。たまりすぎたら古い手を捨て、早送りで追いつく", () => {
    const own = new ReplayPlayer();
    own.push([step("attack", true)]);
    let frames = 0;
    while (own.busy) (own.frame(), frames++);
    expect(frames).toBeLessThan(REPLAY_FRAMES.attack);

    const many = new ReplayPlayer();
    many.push(Array.from({ length: 20 }, () => step("effect")));
    many.frame();
    expect(many.view().queued).toBe(7);
    let total = 0;
    while (many.busy) (many.frame(), total++);
    expect(total).toBeLessThan(8 * REPLAY_FRAMES.effect);
  });
});

describe("AppController (replay)", () => {
  it("CPU の次の手は、前の手を見せ終わるまで待つ", () => {
    const app = new AppController({ platform: testPlatform(), viewport: { width: 960, height: 544 }, cpuDelayFrames: 0, seed: () => 11, gui: true, replay: true });
    app.startMatch();
    let waited = 0;
    let shown = 0;
    for (let frame = 0; frame < 40000 && app.currentScreen === "match" && shown < 30; frame++) {
      const session = app.session!;
      if (session.turnOwner() === "human") {
        const options = session.humanOptions();
        session.chooseHuman(Math.max(0, options.findIndex((o) => /バトルエリア|アタック|ストライク/.test(o.label))));
      }
      const before = session.version;
      const playing = app.replayView()?.event;
      app.tick();
      if (playing && !playing.own && session.turnOwner() === "cpu") {
        // While the CPU's last move is still shown, its next one waits.
        if (app.replayView()?.event) {
          expect(session.version).toBe(before);
          waited++;
        }
      }
      if (playing && app.replayView()?.event !== playing) shown++;
    }
    expect(shown).toBeGreaterThan(5);
    expect(waited).toBeGreaterThan(100);
  }, 120_000);

  it("replay を付けないシェル（Vita）では何も待たない", () => {
    const app = new AppController({ platform: testPlatform(), viewport: { width: 960, height: 544 }, cpuDelayFrames: 0, seed: () => 11, gui: true });
    app.startMatch();
    expect(app.replayView()).toBeNull();
  });
});
