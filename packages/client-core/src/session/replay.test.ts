import { describe, expect, it } from "vitest";
import * as engine from "@rangers-strike/engine";
import type { GameState } from "../engineApi";
import { AppController } from "../app/controller";
import { testEngine, testPlatform } from "../testing/engine";
import { GameSession } from "./session";
import { moveLine, moveTag, type ReplayMove } from "./replayMoves";
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
        // A card the person may not see (drawn, deck top turned into damage) is drawn face down and named by nothing.
        if (e.hidden) expect(e.cardId).toBe("?");
        else expect(session.state.definitions[e.cardId], JSON.stringify(e)).toBeDefined();
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

  it("相手の効果で動いた自分のカード（撃破・ホールド）と、相手の場に出たユニットを拾う", () => {
    const { session } = runs.find((r) => r.session.state.players.player1.battle.length + r.session.state.players.player1.rush.length > 0 && r.session.state.players.player1.command.some((c) => !c.commandHeld)) ?? runs[0]!;
    const prev = session.state;
    const me = prev.players.player1;
    const unit = me.battle[0] ?? me.rush[0]!;
    const zone = me.battle[0] ? "battle" : "rush";
    const command = me.command.find((c) => !c.commandHeld)!;
    const extra = prev.players.player2.deck[0]!;
    const next = {
      ...prev,
      players: {
        ...prev.players,
        player1: {
          ...me,
          [zone]: me[zone].filter((c) => c.instanceId !== unit.instanceId),
          discard: [...me.discard, unit],
          command: me.command.map((c) => (c === command ? { ...c, commandHeld: true } : c)),
        },
        player2: { ...prev.players.player2, deck: prev.players.player2.deck.slice(1), rush: [...prev.players.player2.rush, extra] },
      },
    } as GameState;
    const source = Object.keys(prev.definitions).find((id) => prev.definitions[id]?.type === "unit")!;
    const events = replayEvents(testEngine, prev, next, [`player2|resolve_effect_choice|${source}|${prev.definitions[source]!.name}|x`], LABELS, "player2");
    expect(events).toHaveLength(1);
    const moves = events[0]!.moves ?? [];
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ owner: "player1", cardId: unit.cardId, dest: "discard", verb: "撃破した", from: { row: `player1:${zone}`, slot: me[zone].indexOf(unit) } }),
        expect.objectContaining({ owner: "player1", cardId: command.cardId, dest: "held", verb: "ホールドした", instanceId: command.instanceId }),
        expect.objectContaining({ owner: "player2", cardId: extra.cardId, dest: "rush", verb: "山札からラッシュエリアに出した", instanceId: extra.instanceId }),
      ]),
    );
    expect(events[0]!.detail).toContain("を撃破した");
    // The person's own move, or a move whose maker is unknown, moves nothing.
    expect(replayEvents(testEngine, prev, next, [`player2|resolve_effect_choice|${source}|x|x`], LABELS, "player1")[0]?.moves).toBeUndefined();
  });

  it("対人戦: 相手のユニットが手札に戻って隠れても、増えた手札から「手札に戻した」と分かる", () => {
    const { session } = runs.find((r) => r.session.state.players.player2.rush.length > 0) ?? runs[0]!;
    const prev = session.state;
    const them = prev.players.player2;
    const unit = them.rush[0]!;
    const next = {
      ...prev,
      players: { ...prev.players, player2: { ...them, rush: them.rush.slice(1), hand: [...them.hand, { instanceId: "?77", cardId: "?" }] } },
    } as GameState;
    const events = replayEvents(testEngine, prev, next, [], LABELS, "player2");
    expect(events[0]?.moves).toEqual([expect.objectContaining({ owner: "player2", cardId: unit.cardId, dest: "hand", verb: "手札に戻した" })]);
  });

  it("モーフは入れ替わったユニットの手になる", () => {
    const { session } = runs.find((r) => r.session.state.players.player2.battle.length > 0) ?? runs[0]!;
    const prev = session.state;
    const them = prev.players.player2;
    const out = them.battle[0]!;
    const card = them.power.find((c) => !c.faceDown && prev.definitions[c.cardId]?.type === "unit") ?? them.power.find((c) => !c.faceDown)!;
    const next = {
      ...prev,
      players: { ...prev.players, player2: { ...them, battle: [card, ...them.battle.slice(1)], power: [...them.power.filter((c) => c !== card), { ...out }] } },
    } as GameState;
    const events = replayEvents(testEngine, prev, next, [`player2|morph_swap|${out.cardId}|x|${card.cardId}`], LABELS, "player2");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "morph", cardId: card.cardId, instanceId: card.instanceId, detail: expect.stringContaining("入れ替わった") });
    expect(events[0]!.moves).toEqual([expect.objectContaining({ cardId: out.cardId, verb: "モーフで入れ替わった" })]);
  });

  it("CPU 戦の効果で動いたカードは、相手の手番のものだけ（自分のドロー・チャージは出さない）", () => {
    const moves = all.flatMap((e) => (e.moves ?? []).map((m) => ({ ...m, actor: e.actor })));
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.actor).toBe("player2");
      expect(m.verb).not.toBe("");
      if (m.owner === "player1") expect(m.fromZone === "hand" ? m.dest : "discard").toBe("discard");
    }
  });

  it("相手の資源: 追加ドロー、山札からのサーチ（枚数だけ）、捨札からの回収、コマンドのリリース、裏のパワーをオモテに", () => {
    const { session } = runs.find((r) => {
      const p = r.session.state.players.player2;
      return p.discard.length > 0 && p.command.some((c) => c.commandHeld) && p.power.some((c) => c.faceDown) && p.deck.length > 2;
    })!;
    const prev = session.state;
    const them = prev.players.player2;
    const recovered = them.discard[0]!;
    const held = them.command.find((c) => c.commandHeld)!;
    const down = them.power.find((c) => c.faceDown)!;
    const searched = them.deck.slice(0, 2);
    const next = {
      ...prev,
      players: {
        ...prev.players,
        player2: {
          ...them,
          deck: them.deck.slice(2),
          discard: them.discard.slice(1),
          hand: [...them.hand, ...searched, recovered],
          command: them.command.map((c) => (c === held ? { ...c, commandHeld: false } : c)),
          power: them.power.map((c) => (c === down ? { ...c, faceDown: false } : c)),
        },
      },
    } as GameState;
    const source = Object.keys(prev.definitions).find((id) => prev.definitions[id]?.type === "unit")!;
    const events = replayEvents(testEngine, prev, next, [`player2|resolve_effect_choice|${source}|x|y`], LABELS, "player2");
    const moves = events[0]!.moves ?? [];
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hidden: true, cardId: "?", count: 2, verb: "山札から手札に2枚加えた" }),
        expect.objectContaining({ cardId: recovered.cardId, fromZone: "discard", dest: "hand" }),
        expect.objectContaining({ cardId: held.cardId, fromZone: "command", verb: "リリースした" }),
        expect.objectContaining({ cardId: down.cardId, fromZone: "power", verb: "オモテにした" }),
      ]),
    );
    // The searched cards are never named.
    for (const card of searched) expect(moves.some((m) => m.cardId === card.cardId && m.dest === "hand" && m.fromZone === "deck" && !m.hidden)).toBe(false);
    // The release at the start of the turn and the draw phase's draw are every turn's: not shown.
    const routine = replayEvents(testEngine, prev, next, ["player2|release_start_commands", "player2|draw", "player2|draw"], LABELS, "player2");
    const routineMoves = routine.flatMap((e) => e.moves ?? []);
    expect(routineMoves.some((m) => m.fromZone === "command")).toBe(false);
    expect(routineMoves.some((m) => m.hidden)).toBe(false);
    // 「相手に見せてから手札に加える」（RK-146 デネブキャンディー等）: 公開されたカードは名前を出し、残りは枚数だけ。
    const shownCard = searched[0]!;
    const withReveal = {
      ...next,
      lastReveal: { seq: (prev.lastReveal?.seq ?? 0) + 1, playerId: "player2", ownerId: "player2", sourceCardId: "RK-146", effectLabel: "デネブキャンディー", from: "deck", cards: [{ instanceId: shownCard.instanceId, cardId: shownCard.cardId, destination: "hand" }] },
    } as GameState;
    const revealedMoves = replayEvents(testEngine, prev, withReveal, [`player2|resolve_effect_choice|${source}|x|y`], LABELS, "player2")[0]!.moves ?? [];
    expect(revealedMoves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: shownCard.cardId, dest: "hand", verb: "山札から手札に加えた" }),
        expect.objectContaining({ hidden: true, cardId: "?", count: 1, verb: "山札から手札に1枚加えた" }),
      ]),
    );
    const named = revealedMoves.find((m) => m.cardId === shownCard.cardId && !m.hidden)!;
    expect(moveLine(named, (id) => `<${id}>`, LABELS)).toBe(`${LABELS.player2}の <${shownCard.cardId}> を山札から手札に加えた`);
    // 追加ドロー is a step of its own, face down.
    const bonus = replayEvents(testEngine, prev, prev, ["player2|bonus_draw"], LABELS, "player2");
    expect(bonus).toEqual([expect.objectContaining({ kind: "draw", hidden: true, cardId: "?", title: "追加ドロー" })]);
  });

  it("自分のストライクで、相手の山札の上がダメージになった（表のパワーが無い）とき、枚数だけの手になる", () => {
    const { session } = runs.find((r) => r.session.state.players.player2.deck.length > 1)!;
    const prev = session.state;
    const them = prev.players.player2;
    const next = { ...prev, players: { ...prev.players, player2: { ...them, deck: them.deck.slice(1), power: [...them.power, { instanceId: "?91", cardId: "?", faceDown: true }] } } } as GameState;
    const events = replayEvents(testEngine, prev, next, ["player1|strike|unknown|unknown|1"], LABELS, "player1");
    expect(events.filter((e) => e.kind === "flip")).toEqual([expect.objectContaining({ hidden: true, cardId: "?", title: "山札から1枚がダメージに" })]);
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

describe("moveTag", () => {
  const move = (dest: ReplayMove["dest"], fromZone?: string): ReplayMove => ({ owner: "player2", cardId: "X", dest, verb: "", fromZone });

  it("tags a card put onto the rush area from elsewhere 「ラッシュ」, as the rules call it", () => {
    for (const from of ["hand", "deck", "power", "discard", "command", undefined]) expect(moveTag(move("rush", from))).toBe("ラッシュ");
  });

  it("tags the battle area 「バトルへ」 (never 「登場」) and a move between the two rows 「移動」", () => {
    expect(moveTag(move("battle", "hand"))).toBe("バトルへ");
    expect(moveTag(move("battle", "rush"))).toBe("移動");
    expect(moveTag(move("rush", "battle"))).toBe("移動");
  });
});
