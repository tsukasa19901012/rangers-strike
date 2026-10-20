/**
 * docs/rules/07-keywords.md「常駐 / タッグ」「その他の用語」節
 * （R-KW-PERM-01、R-KW-TAG-01、R-KW-WRECKER-01、R-KW-TERMS-01）のルール仕様テスト。
 * 出典: atwiki/page-1296（常駐 Q1〜Q3）、page-1297（タッグ）、grnrngr/faq-rider_3 RK-240、
 *       atwiki/page-1740（レッカー）、page-1742・1536・1535（用語）。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import { battleFillers } from "../testing/battleEntry";
import { act, canStrike, hasLegal, inst, powerCards, realDef, state, unitDef, where } from "./07-helpers";

/** 全カテゴリのホールド済みコマンド（オペレーション使用の前提を満たす）。 */
const heldCommands = (): CardInstance[] =>
  ["TST-OP", "TST-OP-ET", "TST-OP-OT", "TST-OP-MA", "TST-OP-DA"].map((id, i) => ({ ...inst(id, `held${i}`), commandHeld: true }));

const KAIZOG = realDef("RK-003"); // ※常駐（ET 2）
const CURRY = realDef("RS-179"); // ※常駐（WB 2）
const CLIMAX = realDef("RK-242"); // ※常駐 ※タッグ「クライマックス刑事」
const CLIMAX_PK = realDef("PK-011"); // 同名「クライマックス刑事」※タッグ
const G4 = realDef("RK-170"); // ※常駐 ※タッグ「プロジェクトG4」

function rushPhase(hand: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  return state([KAIZOG, CURRY, CLIMAX, CLIMAX_PK, G4], {
    phase: "rush",
    player1: { hand, command: heldCommands(), power: powerCards(9), ...p1 },
    player2: p2,
  });
}

const play = (s: GameState, instanceId: string, playerId: "player1" | "player2" = "player1") =>
  act(s, { type: "play_operation", playerId, instanceId });

describe("R-KW-PERM-01 常駐", () => {
  // 「場に配置して、離れるまで効果が有効になる」
  it("R-KW-PERM-01: 常駐オペレーションは使用後も常駐置き場に配置される（出典: atwiki/page-1296 規定文）", () => {
    const s = play(rushPhase([inst(KAIZOG.id, "k")]), `${KAIZOG.id}:k`);
    expect(where(s, "player1", `${KAIZOG.id}:k`)).toBe("operation");
  });

  // 「元々あったものを捨札にしてから配置します」
  it("R-KW-PERM-01: 常駐オペレーションは各プレイヤー1枚まで。新しく配置すると元の常駐は捨札になる（出典: atwiki/page-1296 A2）", () => {
    let s = rushPhase([inst(KAIZOG.id, "k"), inst(CURRY.id, "c")]);
    s = play(s, `${KAIZOG.id}:k`);
    s = play(s, `${CURRY.id}:c`);
    expect(where(s, "player1", `${KAIZOG.id}:k`)).toBe("discard");
    expect(where(s, "player1", `${CURRY.id}:c`)).toBe("operation");
    expect(s.players.player1.operation).toHaveLength(1);
  });

  // 「同名のカードを…上書きして配置」→「はい、できます」
  it("R-KW-PERM-01: 配置中の常駐と同名のカードも上書きして配置できる（出典: atwiki/page-1296 A1）", () => {
    let s = rushPhase([inst(KAIZOG.id, "k1"), inst(KAIZOG.id, "k2")]);
    s = play(s, `${KAIZOG.id}:k1`);
    expect(hasLegal(s, (a) => a.type === "play_operation" && a.instanceId === `${KAIZOG.id}:k2`)).toBe(true);
    s = play(s, `${KAIZOG.id}:k2`);
    expect(where(s, "player1", `${KAIZOG.id}:k1`)).toBe("discard");
    expect(where(s, "player1", `${KAIZOG.id}:k2`)).toBe("operation");
  });

  // 「常駐ではないオペレーションを使用しても…」→「いいえ」
  it("R-KW-PERM-01: 常駐ではないオペレーションを使っても、配置中の常駐は捨札にならない（出典: atwiki/page-1296 A2）", () => {
    let s = rushPhase([inst(KAIZOG.id, "k"), inst("TST-OP-OT", "plain")]);
    s = play(s, `${KAIZOG.id}:k`);
    s = play(s, "TST-OP-OT:plain");
    expect(where(s, "player1", `${KAIZOG.id}:k`)).toBe("operation");
  });

  // 「各プレイヤーごとに1枚だけ配置できます」（相手の常駐は関係ない）
  it("R-KW-PERM-01: 1枚の制限はプレイヤーごとで、自分が常駐を配置しても相手の常駐は捨札にならない（出典: atwiki/page-1296 A2）", () => {
    let s = rushPhase([inst(KAIZOG.id, "k")], {}, { operation: [inst(CURRY.id, "enemy")] });
    s = play(s, `${KAIZOG.id}:k`);
    expect(where(s, "player2", `${CURRY.id}:enemy`)).toBe("operation");
    expect(where(s, "player1", `${KAIZOG.id}:k`)).toBe("operation");
  });

  // 「重ねた後に…重ねている順番を持ち主が並べ替えることはできますか？」→「いいえ」
  it.todo("R-KW-PERM-01: 常駐オペレーションに重ねたカードは並べ替えられない（出典: atwiki/page-1296 A3。重ねたカードの並べ替え操作がエンジン API に存在しないため、禁止の検証対象がない）");
});

describe("R-KW-TAG-01 タッグ", () => {
  // 「これは他の自軍常駐と合わせて2枚まで配置でき」
  it("R-KW-TAG-01: タッグは他の自軍常駐と合わせて2枚まで配置でき、通常の常駐の後に置いても元の常駐は捨札にならない（出典: atwiki/page-1297 規定文・本文「通常の常駐オペレーションとの併用も可能」）", () => {
    let s = rushPhase([inst(KAIZOG.id, "k"), inst(CLIMAX.id, "t")]);
    s = play(s, `${KAIZOG.id}:k`);
    s = play(s, `${CLIMAX.id}:t`);
    expect(where(s, "player1", `${KAIZOG.id}:k`)).toBe("operation");
    expect(where(s, "player1", `${CLIMAX.id}:t`)).toBe("operation");
  });

  // 「同名のタッグオペレーションカードを１人で２枚同時に常駐させることは可能です」
  it("R-KW-TAG-01: 同名のタッグオペレーション（RK-242 と PK-011 クライマックス刑事）を1人で2枚同時に常駐させられる（出典: grnrngr/faq-rider_3 RK-240）", () => {
    let s = rushPhase([inst(CLIMAX.id, "a"), inst(CLIMAX_PK.id, "b")]);
    s = play(s, `${CLIMAX.id}:a`);
    s = play(s, `${CLIMAX_PK.id}:b`);
    expect(s.players.player1.operation.map((c) => c.instanceId).sort()).toEqual([`${CLIMAX.id}:a`, `${CLIMAX_PK.id}:b`].sort());
  });

  // 「2枚まで配置でき」（3枚目は置けない）
  it("R-KW-TAG-01: タッグを含めても常駐は2枚までで、3枚目を配置すると常駐置き場は2枚のまま（出典: atwiki/page-1297 規定文）", () => {
    let s = rushPhase([inst(CLIMAX.id, "a"), inst(CLIMAX_PK.id, "b"), inst(G4.id, "g")]);
    s = play(s, `${CLIMAX.id}:a`);
    s = play(s, `${CLIMAX_PK.id}:b`);
    s = play(s, `${G4.id}:g`);
    expect(s.players.player1.operation.length).toBeLessThanOrEqual(2);
    expect(where(s, "player1", `${G4.id}:g`)).toBe("operation");
  });

  // RS-522 ボウケンスピリッツ『自軍コマンドを1つ選び山札の上に戻す』／RS-524 呉越同舟『自分の手札を1枚選び相手に見せる』（どちらも ※タッグ）。
  const BOUKEN = realDef("RS-522");
  const GOETSU = realDef("RS-524");
  const NUMBERED = unitDef("RSPEC-CN2", { comboNumber: 2 });
  const tagBoard = (operation: CardInstance[], extra: Partial<GameState["players"]["player1"]> = {}) =>
    state([BOUKEN, GOETSU, CURRY, CLIMAX, NUMBERED], {
      phase: "rush",
      turn: 3,
      player1: {
        operation,
        rush: [inst(NUMBERED.id, "u")],
        command: [inst("TST-OP", "c1"), inst("TST-OP", "c2")],
        hand: [inst("TST-UNIT-0", "h")],
        deck: [inst("TST-UNIT-0", "d0")],
        ...extra,
      },
    });
  const canActivate = (s: GameState, opId: string) =>
    hasLegal(s, (a) => a.type === "activate_resident_operation" && a.operationInstanceId === opId);
  const activate = (s: GameState, opId: string) => act(s, { type: "activate_resident_operation", playerId: "player1", operationInstanceId: opId });
  const choose = (s: GameState, id: string) => act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });

  // ユーザー決定（2026-10-19）「両方の効果をそれぞれ発動することができる」— atwiki/page-762 RK-242 Q1 の後日修正（2010/10/25修正）を採り、
  // grnrngr/faq-rider_3 RK-240「１度だけしか発動することはできません」は採らない（README §1.2 例外2・§5.7 i）。RS のタッグにも同じく当てはめる。
  it("R-KW-TAG-01: 同名のタッグ（ボウケンスピリッツ2枚）を常駐させていれば、1度のラッシュフェイズに両方の太字部分の効果をそれぞれ1度ずつ発動できる（出典: ユーザー決定 2026-10-19「両方の効果をそれぞれ発動することができる」・atwiki/page-762 RK-242 Q1（2010/10/25修正））", () => {
    let s = tagBoard([inst(BOUKEN.id, "a"), inst(BOUKEN.id, "b")]);
    expect(canActivate(s, `${BOUKEN.id}:a`)).toBe(true);
    expect(canActivate(s, `${BOUKEN.id}:b`)).toBe(true);
    s = activate(s, `${BOUKEN.id}:a`);
    // 同名どうしでも、入れ替えて実行する太字部分は選べる（どちらを選んでも太字部分は同じ）。
    if (s.pendingEffectChoice?.effectId === "tag_bold_pick") s = choose(s, `${BOUKEN.id}:a`);
    s = choose(s, "TST-OP:c1");
    s = choose(s, `${NUMBERED.id}:u`);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(canActivate(s, `${BOUKEN.id}:a`)).toBe(false);
    // 同名の別の1枚（b）はまだ使っていないので、同じラッシュフェイズに実行できる。
    expect(canActivate(s, `${BOUKEN.id}:b`)).toBe(true);
    s = activate(s, `${BOUKEN.id}:b`);
    if (s.pendingEffectChoice?.effectId === "tag_bold_pick") s = choose(s, `${BOUKEN.id}:b`);
    s = choose(s, "TST-OP:c2");
    s = choose(s, `${NUMBERED.id}:u`);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(canActivate(s, `${BOUKEN.id}:a`)).toBe(false);
    expect(canActivate(s, `${BOUKEN.id}:b`)).toBe(false);
  });

  it("R-KW-TAG-01: 同名のタッグを2枚常駐させても、1枚ごとの「1度だけ」は変わらない — 同じ常駐を同じラッシュフェイズに2回は実行できない（出典: atwiki/page-1152「自軍ラッシュフェイズ中に1度だけ」・ユーザー決定 2026-10-19）", () => {
    let s = tagBoard([inst(BOUKEN.id, "a"), inst(BOUKEN.id, "b")]);
    s = activate(s, `${BOUKEN.id}:a`);
    if (s.pendingEffectChoice?.effectId === "tag_bold_pick") s = choose(s, `${BOUKEN.id}:a`);
    s = choose(s, "TST-OP:c1");
    s = choose(s, `${NUMBERED.id}:u`);
    expect(hasLegal(s, (a) => a.type === "activate_resident_operation" && a.operationInstanceId === `${BOUKEN.id}:a`)).toBe(false);
  });

  // 「これは2つのオペレーションがどちらもタッグを持っていなければ有効にならない」
  it("R-KW-TAG-01: 太字部分の入れ替えは2枚ともタッグを持つときだけ有効 — タッグでない常駐（恐竜やのカレー）とは入れ替えず、自分の太字部分を実行する（出典: atwiki/page-1297 本文）", () => {
    let s = tagBoard([inst(BOUKEN.id, "a"), inst(CURRY.id, "curry")]);
    s = activate(s, `${BOUKEN.id}:a`);
    expect(s.pendingEffectChoice?.effectId).toBe("rs522_bouken_command");
  });

  it("R-KW-TAG-01: 2枚ともタッグなら、太字部分を実行するかわりに他の自軍常駐の太字部分を実行できる（どちらを実行するか選ぶ）（出典: atwiki/page-1297 規定文「太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる」）", () => {
    let s = tagBoard([inst(BOUKEN.id, "a"), inst(GOETSU.id, "g")]);
    s = activate(s, `${BOUKEN.id}:a`);
    expect(s.pendingEffectChoice?.effectId).toBe("tag_bold_pick");
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual([`${BOUKEN.id}:a`, `${GOETSU.id}:g`].sort());
    // 呉越同舟の太字部分『自分の手札を1枚選び相手に見せる』を実行して、ボウケンスピリッツの「そうしたとき」以降を実行する。
    s = choose(s, `${GOETSU.id}:g`);
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["TST-UNIT-0:h"]);
    s = choose(s, "TST-UNIT-0:h");
    expect(s.pendingEffectChoice?.effectId).toBe("rs522_bouken_unit");
    s = choose(s, `${NUMBERED.id}:u`);
    // コマンドは山札に戻っていない（ボウケンスピリッツ自身の太字部分は実行していない）。
    expect(where(s, "player1", "TST-OP:c1")).toBe("command");
    expect(where(s, "player1", "TST-UNIT-0:h")).toBe("hand");
  });

  it("R-KW-TAG-01: 自分の太字部分を実行できなくても、他の自軍のタッグの常駐の太字部分を代わりに実行できる（クライマックス刑事『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』）（出典: atwiki/page-1297 規定文）", () => {
    let s = tagBoard([inst(BOUKEN.id, "a"), inst(CLIMAX.id, "cl")], { command: [], power: [inst("TST-UNIT-0", "pw")] });
    expect(canActivate(s, `${BOUKEN.id}:a`)).toBe(true);
    s = activate(s, `${BOUKEN.id}:a`);
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual([`${CLIMAX.id}:cl`]);
    s = choose(s, `${CLIMAX.id}:cl`);
    s = choose(s, "TST-UNIT-0:pw");
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-UNIT-0:pw");
    expect(s.pendingEffectChoice?.effectId).toBe("rs522_bouken_unit");
  });

  it("R-KW-TAG-01: タッグでない常駐しかなく、自分の太字部分も実行できなければ使えない（出典: atwiki/page-1297 本文）", () => {
    const s = tagBoard([inst(BOUKEN.id, "a"), inst(CURRY.id, "curry")], { command: [] });
    expect(canActivate(s, `${BOUKEN.id}:a`)).toBe(false);
  });
  // 入れ替えの手順は公式 Q&A なし
  it.todo("R-KW-TAG-01: [未確定] 太字部分の入れ替えの詳細手順（公式 Q&A なし）");
});

describe("R-KW-WRECKER-01 レッカー（総称）", () => {
  const GREEN = realDef("RS-108"); // 【グリーンクラッシュ】敵軍ラッシュエリアの S ユニットをバトルエリアに出す

  function wreckerEnters(enemyRush: CardInstance[], extraDefs = [] as ReturnType<typeof unitDef>[], p2: Partial<GameState["players"]["player2"]> = {}): GameState {
    const s = state([GREEN, ...extraDefs], {
      phase: "battle",
      player1: { rush: [inst(GREEN.id, "g")], battle: battleFillers(2) },
      player2: { rush: enemyRush, ...p2 },
    });
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${GREEN.id}:g` });
  }

  // 「ラッシュエリアにいる敵軍ユニットをバトルエリアに引きずり出す効果」
  it("R-KW-WRECKER-01: レッカー（RS-108 デカグリーン）で敵軍ラッシュエリアのユニットをバトルエリアに出せる（出典: atwiki/page-1740 本文）", () => {
    const x = inst("TST-UNIT-0", "x");
    let s = wreckerEnters([x]);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(x.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: x.instanceId });
    expect(where(s, "player2", x.instanceId)).toBe("battle");
  });

  // 「「バトルエリアに出られない」効果を持つユニットはレッカーできない」
  it("R-KW-WRECKER-01: 「バトルエリアに出られない」ユニットはレッカーで出せない（出典: atwiki/page-1740 本文）", () => {
    const NO_ENTRY = unitDef("RSPEC-NO-ENTRY", { text: "※これはバトルエリアに出られない。" });
    const n = inst(NO_ENTRY.id, "n");
    const s = wreckerEnters([n], [NO_ENTRY]);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain(n.instanceId);
  });

  // 「～しなければ…出られない」…強制的に満たさせた上でレッカー可能
  it("R-KW-WRECKER-01: 「自軍コマンドを1つホールドしなければ出られない」ユニット（RK-040）は、相手にホールドさせて出せる（出典: atwiki/page-1740 本文）", () => {
    const VENO = realDef("RK-040");
    const bv = inst(VENO.id, "bv");
    const cmd = inst("TST-OP", "c");
    let s = wreckerEnters([bv], [VENO as ReturnType<typeof unitDef>], { command: [cmd] });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(bv.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: bv.instanceId });
    expect(where(s, "player2", bv.instanceId)).toBe("battle");
    expect(s.players.player2.command.find((c) => c.instanceId === cmd.instanceId)?.commandHeld).toBe(true);
  });

  // 「相手が条件を満たせるならば」（満たせなければ出せない）
  it("R-KW-WRECKER-01: 相手が条件（コマンドのホールド）を満たせないなら、そのユニットはレッカーで出せない（出典: atwiki/page-1740 本文）", () => {
    const VENO = realDef("RK-040");
    const bv = inst(VENO.id, "bv");
    const s = wreckerEnters([bv], [VENO as ReturnType<typeof unitDef>]);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain(bv.instanceId);
  });

  // 「ラッシュエリアからバトルエリアへ移動する際に一端場から離れていると扱われる」
  it.todo("R-KW-WRECKER-01: レッカーで移動したユニットは場を離れた扱いで「場を離れるとき」の効果（ダイノガッツ等）が発動する（出典: atwiki/page-1740 本文。該当カードの起動経路がない）");
});

describe("R-KW-TERMS-01 ルール効果のない用語", () => {
  // 「クロスギャザー（シリーズ名）」はルール効果を持たない
  it("R-KW-TERMS-01: 「クロスギャザー」の語を含むだけのユニットはクロスの効果を持たない（右のユニットの数字は減らない）（出典: atwiki/page-1535）", () => {
    const XG = unitDef("RSPEC-XGATHER", { text: "クロスギャザー ザ・ベストパートナー収録。" });
    const x = inst("XG1-007", "x"); // CN3【チェンジソード】「SP1」
    const s0 = state([XG, realDef("XG1-007")], {
      phase: "battle",
      player1: { rush: [x], battle: [inst(XG.id, "xg")] },
      player2: { battle: [inst("TST-UNIT-2", "enemy")] },
    });
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: x.instanceId });
    expect(canStrike(s, x.instanceId)).toBe(false);
  });

  // 用語説明のみでゲーム上のルールはない
  it.todo("R-KW-TERMS-01: 「バウンス」「タッチ」は用語説明のみでゲーム上のルールはない（出典: atwiki/page-1742・1536。ルール効果がないことを観測できるエンジン上の対象がない）");
});
