/**
 * docs/rules/07-keywords.md「モーフ」節（R-KW-MORPH-01〜03）のルール仕様テスト。
 * 出典: atwiki/page-1294（Q1〜Q6・本文）、grnrngr/faq-rider_2 RK-150。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { act, card, hasLegal, inst, KW, legal, powerCards, realDef, state, unitDef, where } from "./07-helpers";

const FEATURES = ["仮面ライダー", "男"];
const MORPH = unitDef("RSPEC-MORPH", { features: FEATURES, text: KW.morph, bp: 2000 });
/** 置き換え先（モーフを持たない、特徴が完全一致）。 */
const TARGET = unitDef("RSPEC-TARGET", { features: FEATURES, bp: 6000, powerCost: 5 });
const ENEMY = unitDef("RSPEC-ENEMY", { category: "WB", powerCost: 1 });

/** player1（ラッシュフェイズ）が ENEMY を手札からラッシュした直後の状態。 */
function enemyRushes(p2: Partial<GameState["players"]["player2"]>, extra: CardDefinition[] = [], rushed = ENEMY): GameState {
  let s = state([MORPH, TARGET, ENEMY, ...extra], {
    phase: "rush",
    player1: { hand: [inst(rushed.id, "e")], command: [inst("TST-OP", "c")], power: powerCards(3) },
    player2: p2,
  });
  s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: `${rushed.id}:e` });
  s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c"] });
  return s;
}

const morphCandidates = (s: GameState): string[] =>
  s.pendingEffectChoice?.effectId === "morph_replacement" ? s.pendingEffectChoice.validInstanceIds : [];
const morphOffered = (s: GameState, playerId = "player2") =>
  hasLegal(s, (a) => a.playerId === playerId && (a.type === "select_morph_unit" || a.type === "resolve_effect_choice" || a.type === "pass_morph_reaction")) &&
  (s.pendingMorph?.defenderPlayerId === playerId || s.pendingEffectChoice?.effectId === "morph_replacement");

function swap(s: GameState, targetInstanceId: string): GameState {
  return act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: targetInstanceId });
}

const m = inst(MORPH.id, "m");
const t = inst(TARGET.id, "t");

describe("R-KW-MORPH-01 規定文", () => {
  // 「敵軍ユニットがモーフ以外でラッシュされたとき…置き換えてもよい」
  it("R-KW-MORPH-01: 敵軍ユニットが手札からラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカードと置き換えられる（出典: atwiki/page-1294 規定文）", () => {
    let s = enemyRushes({ rush: [m], command: [t] });
    expect(morphCandidates(s)).toContain(t.instanceId);
    s = swap(s, t.instanceId);
    expect(where(s, "player2", t.instanceId)).toBe("rush");
    expect(where(s, "player2", m.instanceId)).toBe("command");
  });

  // 「…置き換えてもよい」（任意）
  it("R-KW-MORPH-01: モーフは任意で、使わなければ何も置き換わらない（出典: atwiki/page-1294 規定文）", () => {
    let s = enemyRushes({ rush: [m], command: [t] });
    const skip = legal(s).find((a) => a.type === "skip_effect_choice" || a.type === "pass_morph_reaction");
    expect(skip).toBeDefined();
    s = act(s, skip!);
    expect(where(s, "player2", m.instanceId)).toBe("rush");
    expect(where(s, "player2", t.instanceId)).toBe("command");
  });

  // 「敵軍ユニットが」（自軍のラッシュでは発動しない）
  it("R-KW-MORPH-01: 自軍ユニットをラッシュしても、自軍のモーフは発動しない（出典: atwiki/page-1294 規定文「敵軍ユニットが」）", () => {
    const s = state([MORPH, TARGET, ENEMY], {
      phase: "rush",
      player1: { hand: [inst(ENEMY.id, "e")], rush: [m], command: [inst("TST-OP", "c"), t], power: powerCards(3) },
    });
    let next = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: `${ENEMY.id}:e` });
    next = act(next, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c"] });
    expect(morphOffered(next, "player1")).toBe(false);
  });

  // 「判定はラッシュの手段であって、ラッシュされたカードがモーフを持つかではない」
  it("R-KW-MORPH-01: モーフを持つ敵軍ユニットが通常の手段（手札から）でラッシュされたときも、モーフは発動できる（出典: atwiki/page-1294 規定文「モーフ以外でラッシュされたとき」）", () => {
    // 既知の不具合: E16（判定がカード側の能力有無）
    const ENEMY_MORPH = unitDef("RSPEC-ENEMY-MORPH", { category: "WB", powerCost: 1, text: KW.morph, features: ["怪人"] });
    const s = enemyRushes({ rush: [m], command: [t] }, [ENEMY_MORPH], ENEMY_MORPH);
    expect(morphCandidates(s)).toContain(t.instanceId);
  });

  // 「モーフ以外で」（モーフによるラッシュでは発動しない）
  it("R-KW-MORPH-01: 相手のモーフで置き換えによりラッシュされたユニットに対しては、こちらのモーフは発動しない（出典: atwiki/page-1294 規定文）", () => {
    // player2 のラッシュに player1 がモーフで応じ、その置き換えに player2 のモーフが反応しないこと
    const p2m = inst(MORPH.id, "p2m");
    const p2t = inst(TARGET.id, "p2t");
    const p1m = inst(MORPH.id, "p1m");
    const p1t = inst(TARGET.id, "p1t");
    let s = state([MORPH, TARGET, ENEMY], {
      phase: "rush",
      activePlayer: "player2",
      player1: { rush: [p1m], command: [p1t] },
      player2: { hand: [inst(ENEMY.id, "e")], rush: [p2m], command: [inst("TST-OP", "c"), p2t], power: powerCards(3) },
    });
    s = act(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: `${ENEMY.id}:e` });
    s = act(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:c"] });
    expect(morphCandidates(s)).toContain(p1t.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: p1t.instanceId });
    expect(where(s, "player1", p1t.instanceId)).toBe("rush");
    expect(morphOffered(s, "player2")).toBe(false);
  });

  // 「「ラッシュしたとき」…効果が…モーフより先に発動します」
  it("R-KW-MORPH-01: ラッシュした側の「ラッシュしたとき」の効果（RS-046 パトアーマー）が先に解決し、その後にモーフの機会がある（出典: grnrngr/faq-rider_2 RK-150、atwiki/page-1294 Q6）", () => {
    const A = inst(MORPH.id, "A");
    const B = inst(MORPH.id, "B");
    let s = state([MORPH, realDef("RS-046")], {
      phase: "rush",
      player1: {
        hand: [inst("RS-046", "pa")],
        rush: [inst("TST-UNIT-0", "mat")],
        command: [inst("TST-OP-OT", "c")],
        power: powerCards(5),
      },
      player2: { battle: [A, B] },
    });
    s = act(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-046:pa" });
    s = act(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: "TST-UNIT-0:mat" });
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:c"] });
    // 先に【アーマーアタック】で A をパワーゾーンへ
    expect(s.pendingEffectChoice?.effectId).toBe("armor_attack");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: A.instanceId });
    expect(where(s, "player2", A.instanceId)).toBe("power");
    // その後 B のモーフで、パワーゾーンに来た A と置き換えられる
    expect(morphOffered(s)).toBe(true);
  });

  // 「敵軍ユニットが…ラッシュされたとき」（応答）
  it.fails("R-KW-MORPH-01: モーフの解決後も、ラッシュしたプレイヤーのラッシュフェイズが続く（手番が相手に移ったままにならない）（出典: atwiki/page-1294 規定文。モーフは相手のラッシュへの応答）", () => {
    // 既知の不具合: 未登録（モーフ解決後に activePlayer が置き換えた側のままになり、相手が end_phase できてしまう）
    let s = enemyRushes({ rush: [m], command: [t] });
    s = swap(s, t.instanceId);
    expect(s.activePlayer).toBe("player1");
    expect(hasLegal(s, (a) => a.type === "end_phase" && a.playerId === "player2")).toBe(false);
  });
});

describe("R-KW-MORPH-02 自軍ゾーンと状態", () => {
  // 「「自軍ゾーン」とは、「自軍コマンドゾーン」および「自軍パワーゾーン」のみ」
  it("R-KW-MORPH-02: 自軍パワーゾーンのオモテ向きのユニットカードとも置き換えられる（出典: atwiki/page-1294 A1）", () => {
    const s = enemyRushes({ rush: [m], power: [t] });
    expect(morphCandidates(s)).toContain(t.instanceId);
  });

  // 「自軍ゾーン」は…のみ→「はい、間違いありません」
  it("R-KW-MORPH-02: 手札のユニットカードは置き換え先にならない（出典: atwiki/page-1294 A1）", () => {
    // 既知の不具合: E16（手札・ラッシュも候補）
    const s = enemyRushes({ rush: [m], hand: [t] });
    expect(morphCandidates(s)).not.toContain(t.instanceId);
  });

  // 「自軍ゾーン」はコマンド・パワーのみ（ラッシュエリアのユニットは含まない）
  it("R-KW-MORPH-02: 自軍ラッシュエリアのユニットは置き換え先にならない（出典: atwiki/page-1294 A1）", () => {
    // 既知の不具合: E16（手札・ラッシュも候補）
    const s = enemyRushes({ rush: [m, t] });
    expect(morphCandidates(s)).not.toContain(t.instanceId);
  });

  // 「特徴が…完全一致するオモテ向きのユニットカード」
  it("R-KW-MORPH-02: パワーゾーンのウラ向き（ダメージ）のカードは置き換え先にならない（出典: atwiki/page-1294 規定文「オモテ向きの」）", () => {
    const s = enemyRushes({ rush: [m], power: [{ ...t, faceDown: true }] });
    expect(morphCandidates(s)).not.toContain(t.instanceId);
  });

  // 「送られるユニットはホールド…ラッシュされるカードはリリース」
  it("R-KW-MORPH-02: リリース状態のユニットとホールド状態のコマンドを置き換えると、コマンドゾーンへ行くユニットはホールド、出るカードはリリースになる（出典: atwiki/page-1294 A2）", () => {
    // 既知の不具合: 04-#23（状態・位置を引き継がない）
    let s = enemyRushes({ rush: [m], command: [{ ...t, commandHeld: true }] });
    s = swap(s, t.instanceId);
    expect(card(s, "player2", m.instanceId)?.commandHeld).toBe(true);
    expect(card(s, "player2", t.instanceId)?.commandHeld ?? false).toBe(false);
  });

  // 「送られるユニットはリリース…ラッシュされるカードはホールド」
  it("R-KW-MORPH-02: ホールド状態のユニットとリリース状態のコマンドを置き換えると、コマンドゾーンへ行くユニットはリリース、出るカードはホールドになる（出典: atwiki/page-1294 A3）", () => {
    let s = enemyRushes({ rush: [{ ...m, commandHeld: true }], command: [t] });
    s = swap(s, t.instanceId);
    expect(card(s, "player2", m.instanceId)?.commandHeld ?? false).toBe(false);
    expect(card(s, "player2", t.instanceId)?.commandHeld).toBe(true);
  });

  // 置き換えは位置を引き継ぐ（R-REPL-04）
  it("R-KW-MORPH-02: バトルエリアのユニットを置き換えると、出てくるカードは同じ並び順の位置に入る（出典: docs/rules/07 R-KW-MORPH-02、R-REPL-04）", () => {
    // 既知の不具合: 04-#23（状態・位置を引き継がない）
    const left = inst("TST-UNIT-0", "left");
    const right = inst("TST-UNIT-0", "right");
    let s = enemyRushes({ battle: [left, m, right], command: [t] });
    s = swap(s, t.instanceId);
    expect(s.players.player2.battle.map((c: CardInstance) => c.instanceId)).toEqual([left.instanceId, t.instanceId, right.instanceId]);
  });

  // 「必要パワーや追加条件を…」→「いいえ、その必要はありません」
  it("R-KW-MORPH-02: 置き換えでは必要パワーも追加条件も満たす必要がない（出典: atwiki/page-1294 A4）", () => {
    const HEAVY = unitDef("RSPEC-HEAVY", {
      features: FEATURES,
      bp: 9000,
      powerCost: "9+",
      rushAdditionalCondition: { conditionId: "send_s_unit_to_power", text: "自軍Sユニット1体をパワーゾーンに送る", unitCount: 1 } as CardDefinition["rushAdditionalCondition"],
    });
    const h = inst(HEAVY.id, "h");
    let s = enemyRushes({ rush: [m], command: [h], power: [] }, [HEAVY]);
    expect(morphCandidates(s)).toContain(h.instanceId);
    s = swap(s, h.instanceId);
    expect(where(s, "player2", h.instanceId)).toBe("rush");
  });

  // 「置き換える先のユニットがモーフを持っていなくても…はい、できます」
  it("R-KW-MORPH-02: 置き換え先のユニットカードはモーフを持っていなくてよい（出典: atwiki/page-1294 A5）", () => {
    expect(TARGET.text).toBeUndefined();
    let s = enemyRushes({ rush: [m], command: [t] });
    s = swap(s, t.instanceId);
    expect(where(s, "player2", t.instanceId)).toBe("rush");
  });

  // 「実際に処理を実行する段階になってから…選んで下さい」
  it("R-KW-MORPH-02: 同時に発動した B・C のモーフは順に実行し、B と A（パワーゾーン）を置き換えた後、C と B を置き換えられる（出典: atwiki/page-1294 Q6）", () => {
    const A = inst(MORPH.id, "A");
    const B = inst(MORPH.id, "B");
    const C = inst(MORPH.id, "C");
    let s = state([MORPH, realDef("RS-046")], {
      phase: "rush",
      player1: { hand: [inst("RS-046", "pa")], rush: [inst("TST-UNIT-0", "mat")], command: [inst("TST-OP-OT", "c")], power: powerCards(5) },
      player2: { battle: [A, B, C] },
    });
    s = act(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-046:pa" });
    s = act(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: "TST-UNIT-0:mat" });
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:c"] });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: A.instanceId });
    // B のモーフ: パワーゾーンの A と置き換え
    const selectB = legal(s).find((a) => a.type === "select_morph_unit" && a.morphUnitInstanceId === B.instanceId);
    if (selectB) s = act(s, selectB);
    expect(morphCandidates(s)).toContain(A.instanceId);
    s = swap(s, A.instanceId);
    // C のモーフ: いまパワーゾーンにある B と置き換え
    const selectC = legal(s).find((a) => a.type === "select_morph_unit" && a.morphUnitInstanceId === C.instanceId);
    if (selectC) s = act(s, selectC);
    expect(morphCandidates(s)).toContain(B.instanceId);
    s = swap(s, B.instanceId);
    expect(where(s, "player2", A.instanceId)).toBe("battle");
    expect(where(s, "player2", B.instanceId)).toBe("battle");
    expect(where(s, "player2", C.instanceId)).toBe("power");
  });
});

describe("R-KW-MORPH-03 完全一致", () => {
  // 「「完全一致」とは、持っている特徴の種類と並び順が同じであることをいう」
  it("R-KW-MORPH-03: 特徴の種類が同じでも並び順が違うユニットカードは置き換え先にならない（出典: atwiki/page-1294 本文）", () => {
    const REORDER = unitDef("RSPEC-REORDER", { features: ["男", "仮面ライダー"] });
    const r = inst(REORDER.id, "r");
    const s = enemyRushes({ rush: [m], command: [r] }, [REORDER]);
    expect(morphCandidates(s)).not.toContain(r.instanceId);
  });

  // 「持っている特徴の種類…が同じ」
  it("R-KW-MORPH-03: 特徴が1つ多い（または少ない）ユニットカードは置き換え先にならない（出典: atwiki/page-1294 本文）", () => {
    const MORE = unitDef("RSPEC-MORE", { features: ["仮面ライダー", "男", "人型"] });
    const LESS = unitDef("RSPEC-LESS", { features: ["仮面ライダー"] });
    const s = enemyRushes({ rush: [m], command: [inst(MORE.id, "more"), inst(LESS.id, "less")] }, [MORE, LESS]);
    expect(morphCandidates(s)).not.toContain(`${MORE.id}:more`);
    expect(morphCandidates(s)).not.toContain(`${LESS.id}:less`);
  });

  // 「モーフを持たないユニットが…置き換えを行うことは当然できない」
  it("R-KW-MORPH-03: モーフを持たないユニットは、モーフ持ちのカードがゾーンにあっても置き換えを行えない（出典: atwiki/page-1294 本文）", () => {
    const plain = inst(TARGET.id, "plain");
    const zoneMorph = inst(MORPH.id, "zm");
    const s = enemyRushes({ rush: [plain], command: [zoneMorph] });
    expect(morphOffered(s)).toBe(false);
  });

  // 「本来の特徴の後ろに追加されていく」
  it.todo("R-KW-MORPH-03: 効果で追加された特徴も数え、本来の特徴の後ろに付く（出典: atwiki/page-1294 本文。特徴を追加する効果を状況に組み込む公開 API がない。04-#24）");
});
