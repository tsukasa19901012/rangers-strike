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

  // 「２枚常駐させていても…太字部分の効果は１度だけ」
  it.todo("R-KW-TAG-01: 同名のタッグを2枚常駐させても、1度のラッシュフェイズに太字部分の効果は1度だけ（出典: grnrngr/faq-rider_3 RK-240。RK-242/PK-011 の太字部分を起動するアクションが合法手に出ず検証できない）");

  // 「これは2つのオペレーションがどちらもタッグを持っていなければ有効にならない」
  it.todo("R-KW-TAG-01: 太字部分の入れ替えは2枚ともタッグを持つときだけ有効（出典: atwiki/page-1297 本文。入れ替え自体が未実装 04-#31 で API がない）");
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
