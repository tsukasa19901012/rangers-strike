import { describe, expect, it } from "vitest";
import { describeAction, humanizeLogEntry, isPantherClawLoopStop, revealSummary } from "./labels";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { testEngine } from "../testing/engine";

describe("describeAction", () => {
  const state = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
  const handCard = state.players.player1.hand[0]!;
  const name = state.definitions[handCard.cardId]!.name;

  it("labels actions in Japanese with card names", () => {
    expect(describeAction(state, { type: "charge_power", playerId: "player1", instanceId: handCard.instanceId })).toBe(
      `パワーにチャージ: ${name}`,
    );
    expect(describeAction(state, { type: "end_phase", playerId: "player1" })).toMatch(/フェイズ終了$/);
  });

  it("puts card names before other fields", () => {
    const label = describeAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: handCard.instanceId,
      prismSubstitute: false,
    } as never);
    expect(label).toBe(`コマンドを支払って使う: ${name}（種類:カテゴリ）`);
  });

  it("says what each answer of the ride-off choice does", () => {
    expect(describeAction(state, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true })).toBe("ライドオフする（ビークルから降りる）");
    expect(describeAction(state, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false })).toBe("ライドしたまま進む");
  });

  it("rewrites structured log entries and hides internal markers", () => {
    expect(humanizeLogEntry("phase:battle->end", state)).toBe("── エンドフェイズ ──");
    expect(humanizeLogEntry("player2|pass_battle_entry", state)).toBe("CPU: 進入を終える");
    expect(humanizeLogEntry("player1|command_payment_pending", state)).toBeNull();
    expect(humanizeLogEntry("あなたが1枚ドローした", state)).toBe("あなたが1枚ドローした");
  });

  it("対人戦では相手を「相手」と呼び、時間切れの自動進行を何回目か書く", () => {
    const labels = { player1: "あなた", player2: "相手" } as const;
    expect(humanizeLogEntry("player2|pass_battle_entry", state, labels)).toBe("相手: 進入を終える");
    expect(humanizeLogEntry("player2|match_timeout_auto|2", state, labels)).toBe("相手の時間切れ（2回目／3回で負け）。自動で進めました");
    expect(humanizeLogEntry("player1|match_timeout_auto|1", state, labels)).toBe("あなたの時間切れ（1回目／3回で負け）。自動で進めました");
  });

  it("writes every engine log kind in Japanese, never its raw name (command_payment_cancel etc.)", () => {
    // Every kind the engine logs with buildSimpleLogEntry / buildLogEntry, read from its sources
    // (the first argument may be a call such as opponent(playerId); kinds may hold digits: xg7055_…).
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../../engine/src");
    const kinds = new Set<string>();
    const cardKinds = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
          const source = readFileSync(path, "utf8");
          for (const m of source.matchAll(/buildSimpleLogEntry\(\s*[^,()]+(?:\([^()]*\))?,\s*"([a-z0-9_]+)"/g)) kinds.add(m[1]!);
          for (const m of source.matchAll(/buildLogEntry\(\s*[^,()]+(?:\([^()]*\))?,\s*"([a-z0-9_]+)"/g)) cardKinds.add(m[1]!);
        }
      }
    };
    walk(root);
    expect(kinds.size).toBeGreaterThan(50);
    expect(kinds.has("xg7055_cyclone_gale_choice")).toBe(true);
    expect(cardKinds.size).toBeGreaterThan(30);
    const instance = state.players.player1.hand[0]!;
    const raw = [...kinds]
      .map((kind) => humanizeLogEntry(testEngine.formatGameLog(`player1|${kind}`, state.definitions), state))
      .filter((text) => text !== null && /[a-z]+_[a-z_]+|player[12]/.test(text));
    expect(raw).toEqual([]);
    // Card logs: with an internal marker as the detail (an effect id, "cancelled") nothing English shows either.
    const card = instance.cardId;
    // (strike's detail is the damage and plasma_energy's the unit's name: no marker goes there.)
    const cardRaw = [...cardKinds].filter((kind) => kind !== "strike" && kind !== "plasma_energy").flatMap((kind) =>
      ["", "|some_effect_id", "|cancelled", ...(kind === "battle" ? [] : ["|choice:some_effect"])].map((detail) =>
        humanizeLogEntry(testEngine.formatGameLog(`player1|${kind}|${card}|${name}${detail}`, state.definitions), state),
      ),
    ).filter((text) => text !== null && /[a-z]+_[a-z_]+|player[12]|\(\w+\)/.test(text));
    expect(cardRaw).toEqual([]);
    expect(humanizeLogEntry("player1|command_payment_cancel", state)).toBe("あなた: コマンドの支払いをやめた");
    expect(humanizeLogEntry("player1|turn_ending_effects", state)).toBe("あなた: ターン終了時の効果を処理");
    expect(humanizeLogEntry("player1|damage_payment|done", state)).toBe("あなた: ダメージを支払った");
    expect(humanizeLogEntry(`player1|hold_for_wing|${instance.instanceId}`, state)).toBe(`あなた: ウイングのためホールド 「${name}」`);
  });

  it("falls back to the raw type for unknown actions", () => {
    expect(describeAction(state, { type: "future_action", playerId: "player1" } as never)).toBe("future_action");
  });
});

describe("describeAction option tokens", () => {
  it("labels option tokens the engine passes in instanceId", () => {
    const state = { players: {}, definitions: {} } as unknown as Parameters<typeof describeAction>[0];
    const action = { type: "resolve_effect_choice", playerId: "player1", instanceId: "deck_top" } as unknown as Parameters<typeof describeAction>[1];
    expect(describeAction(state, action, new Map())).toBe("選ぶ: 山札の上");
  });

  it("labels the reaction windows of the simultaneous order choice", () => {
    const state = { players: {}, definitions: {}, pendingEffectChoice: { effectId: "simultaneous_order" } } as unknown as Parameters<typeof describeAction>[0];
    const pick = (instanceId: string) =>
      describeAction(state, { type: "resolve_effect_choice", playerId: "player1", instanceId } as never, new Map());
    expect(pick("pendingLeave")).toBe("選ぶ: 場を離れたユニットへの反応を先に処理");
    expect(pick("pendingStrike")).toBe("選ぶ: ストライクへの反応を先に処理");
  });

  it("labels card-specific branches and lone confirmations", () => {
    const choice = (effectId: string) => ({ players: {}, definitions: {}, pendingEffectChoice: { effectId } }) as unknown as Parameters<typeof describeAction>[0];
    const pick = (effectId: string, instanceId: string) =>
      describeAction(choice(effectId), { type: "resolve_effect_choice", playerId: "player1", instanceId } as never, new Map());
    expect(pick("xg1_076_decadriver", "mode_1")).toBe("選ぶ: 「仮面ライダーディケイド」をラッシュ");
    expect(pick("bk1_belt_mode", "release")).toBe("選ぶ: Sユニットを1体リリース");
    expect(pick("xg5_007_gogo_change", "release")).toBe("選ぶ: リリース状態で置く");
    expect(pick("rs384_water_discharge", "rs384_water_discharge")).toBe("選ぶ: 使う");
    expect(pick("rs485_hamster_destroy_draw", "draw:2")).toBe("選ぶ: 2枚ドロー");
    expect(pick("rs566_ultima_storm_order", "commands_first")).toBe("選ぶ: コマンドから先に山札に戻す");
    expect(pick("rs566_ultima_storm_order", "units_first")).toBe("選ぶ: ユニットから先に山札に戻す");
  });
});

describe("describeAction panther claw loop", () => {
  // RS-363【パンサークロー】×敵軍 RS-238【プロジェットカノン】のループ（faq-card-6 RS-363 Q2）。
  const choice = (valid: string[]) =>
    ({
      players: {},
      definitions: {},
      pendingEffectChoice: { effectId: "rs363_panther_claw", sourceInstanceId: "pan", validInstanceIds: valid },
    }) as unknown as Parameters<typeof describeAction>[0];
  const act = (type: string, instanceId?: string) => ({ type, playerId: "player1", instanceId }) as never;

  it("names the source-unit pick as stopping the loop, and the skip as giving Projet Canon priority", () => {
    const state = choice(["held", "pan"]);
    expect(isPantherClawLoopStop(state, act("resolve_effect_choice", "pan"))).toBe(true);
    expect(isPantherClawLoopStop(state, act("resolve_effect_choice", "held"))).toBe(false);
    expect(describeAction(state, act("resolve_effect_choice", "pan"), new Map())).toBe(
      "パンサークローを優先してループを止める（捨札にして、プロジェットカノンは発動しない）",
    );
    expect(describeAction(state, act("skip_effect_choice"), new Map())).toBe("捨札にしない（プロジェットカノンを優先）");
  });

  it("keeps the plain labels when there is no loop", () => {
    const state = choice(["held"]);
    expect(describeAction(state, act("skip_effect_choice"), new Map())).toBe("選ばない");
  });
});

describe("describeAction XG5-085 warp", () => {
  it("says whether the confirm and skip buttons warp", () => {
    const state = { players: {}, definitions: {}, pendingEffectChoice: { effectId: "xg5_085_warp", validInstanceIds: [] } } as unknown as Parameters<typeof describeAction>[0];
    const act = (type: string) => ({ type, playerId: "player1" }) as never;
    expect(describeAction(state, act("confirm_effect_choice"), new Map())).toBe("ワープする（ラッシュエリアに出して、山札の次の1枚をかわりに対象にする）");
    expect(describeAction(state, act("skip_effect_choice"), new Map())).toBe("ワープしない（このカードを効果の対象にする）");
  });
});

describe("describeAction magi ticket counter", () => {
  it("marks a command-zone counter used through the magi ticket", () => {
    const state = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
    const card = state.players.player1.hand[0]!;
    const name = state.definitions[card.cardId]!.name;
    expect(describeAction(state, { type: "use_magi_ticket", playerId: "player1", instanceId: card.instanceId, counter: true } as never)).toBe(
      `マジチケット: ${name}（カウンターとして）`,
    );
  });
});

describe("log lines of real games", () => {
  // A 352-game scan (2026-11-16) found lines the per-kind check above cannot see: effect ids as details
  // (「self_damageを発動」), instance ids as names, markers such as cancelled. A few CPU games guard them.
  it("never shows an internal name in a played game's log", () => {
    const e = testEngine as unknown as {
      createStarterGame: (o: object) => GameStateLike;
      isCpuTurn: (s: GameStateLike, p: string) => boolean;
      getActionPlayerId: (s: GameStateLike) => string;
      pickCpuAction: (s: GameStateLike, p: string, level: number) => unknown;
      pickCpuFallbackAction: (s: GameStateLike, p: string) => unknown;
      applyAction: (s: GameStateLike, a: unknown) => { ok: boolean; state: GameStateLike };
    };
    const starters = Object.keys(testEngine.starterDecks);
    const english: string[] = [];
    for (let i = 0; i < 12; i++) {
      let state = e.createStarterGame({ player1Starter: starters[(i * 5) % starters.length], player2Starter: starters[(i * 11 + 3) % starters.length], seed: i + 1 });
      for (let step = 0; step < 3000 && !state.winner; step++) {
        const actor = e.isCpuTurn(state, "player2") ? "player2" : e.getActionPlayerId(state);
        const action = e.pickCpuAction(state, actor, 1) ?? e.pickCpuFallbackAction(state, actor);
        const result = action ? e.applyAction(state, action) : null;
        if (!result?.ok) break;
        state = result.state;
      }
      for (const raw of state.log) {
        const text = humanizeLogEntry(testEngine.formatGameLog(raw, state.definitions), state as never);
        if (text && /[a-z]+_[a-z_]+|player[12]|\b[a-z]{4,}\b/.test(text)) english.push(`${raw} => ${text}`);
      }
    }
    expect([...new Set(english)]).toEqual([]);
  }, 300_000);
});

type GameStateLike = { winner?: string; log: string[]; definitions: Record<string, { name: string }> };

describe("revealSummary", () => {
  const state = { definitions: {} } as unknown as Parameters<typeof revealSummary>[0];
  const base = { seq: 1, playerId: "player2", ownerId: "player2", sourceCardId: "RK-146", effectLabel: "デネブキャンディー", cards: [{ instanceId: "x", cardId: "TST-OP", destination: "hand" }] } as const;

  it("山札から選んで見せた（「相手に見せてから手札に加える」、2026-11-21）", () => {
    expect(revealSummary(state, { ...base, from: "deck" }, { player1: "あなた", player2: "相手" })).toBe("相手が山札から1枚選んで見せた（デネブキャンディー）");
  });

  it("山札の上からオモテにした", () => {
    expect(revealSummary(state, { ...base, from: "deck_top" }, { player1: "あなた", player2: "相手" })).toBe("相手が山札の上から1枚オモテにした（デネブキャンディー）");
  });
});
