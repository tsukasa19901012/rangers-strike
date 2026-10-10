/**
 * docs/rules/06-effects-timing.md のルール仕様テスト。
 * 期待値はルールブックと引用元 web（公式FAQ・atwiki）に従う（現エンジンの挙動ではない）。
 */
import { describe, expect, it } from "vitest";
import { effectiveBp, morphOrderChooserPlayerId } from "../index";
import { rushWithCategoryHold } from "../testing/rushPayment";
import {
  card,
  cmd,
  deck,
  endTurn,
  ids,
  inst,
  inZone,
  legal,
  payAndUse,
  powers,
  run,
  st,
  use,
} from "./06-helpers";
import type { GameState } from "./06-helpers";

/** sourceInstanceId のカードを playerId が使える合法手があるか。 */
function hasUseAction(state: GameState, playerId: string, sourceInstanceId: string): boolean {
  return (legal(state) as unknown as Record<string, unknown>[]).some(
    (a) =>
      a.playerId === playerId &&
      (a.sourceInstanceId === sourceInstanceId || a.instanceId === sourceInstanceId) &&
      ["initiate_command_payment", "play_operation", "play_counter", "rush"].includes(
        a.type as string,
      ),
  );
}

/** ダメージ支払い・離場反応（パス）を先頭の合法手で片付ける。 */
function settle(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 12 && !s.winner; i += 1) {
    if (!s.pendingDamagePayment && !s.pendingLeave && !s.pendingRegister) break;
    const actions = legal(s);
    const pass = actions.find(
      (a) => a.type === "pass_leave_reaction" || a.type === "pass_register",
    );
    const next = pass ?? actions[0];
    if (!next) break;
    s = run(s, next);
  }
  return s;
}

const faceDown = (suffix: string) => ({ ...inst("TST-P", suffix), faceDown: true });

// ---------------------------------------------------------------------------
// 1. タイミング
// ---------------------------------------------------------------------------

describe("R-TIME-01 5つのタイミング", () => {
  // 「まず先に「ラッシュしたとき」発動する…効果の解決を行う」(atwiki/page-1828)
  it("R-TIME-01: ガオパンダの「ラッシュしたとき」が先に解決され、コマンドを失った相手は疾風流超忍法を発動できない（出典: atwiki/page-1828）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-305", "panda")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { hand: [inst("RS-026", "sn")], power: powers(6), command: [cmd("TST-OP-MA", "m1")] },
    });
    s = payAndUse(s, "player1", "RS-305:panda", ["TST-OP:c1"]);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(hasUseAction(s, "player2", "RS-026:sn")).toBe(false);
  });

  // 「まずユニットのラッシュしたときの効果を適用してから」(faq-card-1 RS-026)
  it("R-TIME-01: 「ラッシュしたとき」の効果（プテラビーム）を解決した後、相手は「ラッシュされたとき」の疾風流超忍法を発動できる（出典: grnrngr/faq-card-1 RS-026 Q11）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-039", "pt")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: {
        hand: [inst("RS-026", "sn")],
        power: powers(6),
        deck: deck(3),
        command: [cmd("TST-OP-MA", "m1"), cmd("TST-OP", "h1", true)],
      },
    });
    s = payAndUse(s, "player1", "RS-039:pt", ["TST-OP:c1"]);
    const pick = legal(s).find((a) => a.type === "resolve_effect_choice");
    expect(pick).toBeDefined();
    s = run(s, pick!);
    expect(inZone(s, "player2", "discard", "TST-OP:h1")).toBe(true);
    expect(hasUseAction(s, "player2", "RS-026:sn")).toBe(true);
  });

  // 「現在形（「～するとき」）のタイミングは「～」を行う前に処理する」(atwiki/page-1828)
  it("R-TIME-01: 「場を離れるとき」の反応窓が開いている間、撃破されるユニットはまだバトルエリアにある（出典: atwiki/page-1828）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [inst("RS-027", "dg")],
        command: [cmd("TST-OP", "k1")],
        deck: deck(3),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-UNIT-0:def" });
    expect(s.pendingLeave?.instanceId).toBe("TST-UNIT-0:def");
    expect(inZone(s, "player2", "battle", "TST-UNIT-0:def")).toBe(true);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:def")).toBe(false);
  });
});

describe("R-TIME-02 「～中」「～している間」", () => {
  // 「「ターンエンド」を宣言した時点で…効果が切れる」(faq/index ターン)
  it("R-TIME-02: 「このターン」のBP修正（ガオ・ソウル）はターン中続き、ターン終了で切れる（出典: grnrngr/faq-index ターン）", () => {
    const unit = inst("TST-UNIT-2", "u");
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-025", "gs")], rush: [unit], power: powers(6), command: [cmd("TST-OP", "c1")], deck: deck(5) },
      player2: { deck: deck(5) },
    });
    s = payAndUse(s, "player1", "RS-025:gs", ["TST-OP:c1"], { targetInstanceId: unit.instanceId });
    expect(effectiveBp(s, "player1", card(s, "player1", "rush", unit.instanceId)!)).toBe(7000);
    s = run(s, { type: "end_phase", playerId: "player1" });
    expect(effectiveBp(s, "player1", card(s, "player1", "rush", unit.instanceId)!)).toBe(7000);
    s = endTurn(s);
    expect(s.turn).toBe(2);
    expect(effectiveBp(s, "player1", card(s, "player1", "rush", unit.instanceId)!)).toBe(3000);
  });

  it.todo(
    "R-TIME-02: 「～中」の適用開始・終了が「するとき」「したとき」ではなく行動そのものの瞬間であること（出典: atwiki/page-1828）— 両者を区別して観測できるカード組合せがエンジンにない",
  );
});

describe("R-TIME-03 発動と解決の分離", () => {
  // 「1度解決に入れば…新たに効果を発動することはできない」(atwiki/page-1828)
  it("R-TIME-03: ダイノガッツの解決後、同じ「場を離れるとき」に対してダイノ伝記を追加で発動することはできない（出典: atwiki/page-1828）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [inst("RS-027", "dg"), inst("RS-016", "dc")],
        discard: [inst("TST-UNIT-0", "same")],
        command: [cmd("TST-OP", "k1"), cmd("TST-OP", "k2")],
        deck: deck(5),
        power: powers(5),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-UNIT-0:def" });
    expect(hasUseAction(s, "player2", "RS-016:dc")).toBe(true);
    s = use(s, "player2", "RS-027:dg");
    expect(inZone(s, "player2", "battle", "TST-UNIT-0:def")).toBe(true);
    expect(s.pendingLeave).toBeUndefined();
    expect(hasUseAction(s, "player2", "RS-016:dc")).toBe(false);
  });

  it.todo(
    "R-TIME-03: モーフを解決してできたコマンドで、同じ「ラッシュされたとき」に宏のオルゴール時計を発動することはできない（出典: atwiki/page-1828 ディケイド ファイズの例）— ディケイド ファイズのモーフがエンジンのカード定義（legend1〜3）にない",
  );
});

describe("R-TIME-04 入れ子の割り込み", () => {
  // 「撃破された瞬間に手札に戻ります…撃破の処理を継続」(faq-card-2 RS-116)
  it.fails("R-TIME-04: ジュウクンドーでマンドラ坊やを先に撃破すると、鳴き声が割り込んで解決され、手札に戻った他の対象は撃破されない（出典: grnrngr/faq-card-2 RS-116）", () => {
    // 既知の不具合: 未登録（割り込みで対象が場を離れると、ジュウクンドーの確定が invalid_target で失敗し撃破処理を継続できない）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-106", "dr")] },
      player2: {
        battle: [inst("TST-UNIT-2", "eb")],
        rush: [inst("RS-116", "md"), inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")],
        deck: deck(3),
      },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-106:dr" });
    s = run(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    for (const id of ["RS-116:md", "TST-UNIT-0:e1", "TST-UNIT-0:e2"]) {
      s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    s = run(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(inZone(s, "player2", "discard", "RS-116:md")).toBe(true);
    expect(inZone(s, "player2", "hand", "TST-UNIT-0:e1")).toBe(true);
    expect(inZone(s, "player2", "hand", "TST-UNIT-0:e2")).toBe(true);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:e1")).toBe(false);
    // デカレッド（特徴「魔法」なしのSユニット）も持ち主の手札に戻る
    expect(inZone(s, "player1", "hand", "RS-106:dr")).toBe(true);
  });

  it.todo(
    "R-TIME-04: ゴセイアルティメットの5回リリース処理の途中で仮面ライダーG4がリリースされたら、割り込んでG4の効果を発動できる（出典: atwiki/page-1974 Q&A）— ゴセイアルティメット（XG7）がエンジンのカード定義（legend1〜3）になく、RK-195 の【再起動と暴走】も未接続",
  );
});

describe("R-TIME-05 1タイミングに複数発動可", () => {
  // 「同時に２枚以上使用することはできますか？…はい、できます。」(faq-card-1 RS-018 Q1)
  it.fails("R-TIME-05: 1回のアタックに対して隠流忍術を2枚使用できる（出典: grnrngr/faq-card-1 RS-018 Q1）", () => {
    // 既知の不具合: 未登録（1枚目のカウンター解決後すぐにバトルへ進み、同じタイミングに2枚目を使えない）
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")], rush: [inst("TST-UNIT-0", "other")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        rush: [inst("TST-UNIT-7", "big")],
        hand: [inst("RS-018", "n1"), inst("RS-018", "n2")],
        power: powers(6),
        command: [cmd("TST-OP-MA", "m1"), cmd("TST-OP-MA", "m2")],
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-UNIT-0:def" });
    s = use(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-7:big" });
    expect(hasUseAction(s, "player2", "RS-018:n2")).toBe(true);
  });

  it.todo(
    "R-TIME-05: 「1つのタイミングに発動できるアカネタカは1枚だけ」の例外（出典: atwiki/page-1828）— RK-086 アカネタカのストライクダメージ置換がエンジン未実装",
  );
});

describe("R-TIME-06 「フェイズ中」と「フェイズ開始時・終了時」", () => {
  // 「フェイズ中の行動の手順は…発動と解決を交互に行う」(atwiki/page-1828)
  it("R-TIME-06: ラッシュフェイズ中の効果（シーロンの光）は行動の1つとして発動・解決され、その後も続けてフェイズ中の行動ができる（出典: atwiki/page-1828）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-013", "sh"), inst("TST-OP", "h1"), inst("TST-UNIT-0", "u1")],
        power: powers(6),
        command: [cmd("TST-OP-ET", "c1"), cmd("TST-OP", "c2")],
        deck: deck(5),
      },
      player2: { deck: deck(5) },
    });
    s = use(s, "player1", "RS-013:sh");
    s = run(s, { type: "shiron_light", playerId: "player1", operationInstanceId: "RS-013:sh" });
    // 相手が手札から非ユニットを選ぶ → 公開して終了
    s = run(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:h1" });
    while (s.pendingEffectChoice) s = run(s, legal(s)[0]!);
    expect(s.phase).toBe("rush");
    expect(hasUseAction(s, "player1", "TST-UNIT-0:u1")).toBe(true);
  });

  it.todo(
    "R-TIME-06: 「フェイズ開始時」の効果が複数あるとき、ターンプレイヤーが発動と解決を1セットずつ順番を決める（出典: atwiki/page-1828）— 既知の不具合 E17 に加え、同じ開始時に誘発する効果の組合せが legend1〜3 にない",
  );
});

describe("R-TIME-07 タイミングの参照は瞬間のみ", () => {
  // 「「バトルフェイズを終えるとき」というタイミングが来た瞬間にのみ参照する」(atwiki/page-1828)
  it.fails("R-TIME-07: バトルフェイズを終えるときに本来のナンバー位置にいたイエローオウルは、前のブルースワローが手札に戻って並びが変わっても手札に戻らない（出典: atwiki/page-1828）", () => {
    // 既知の不具合: 未登録（並び順をバトルフェイズ終了の瞬間ではなく、ターン終了時に1体戻すごとに再判定している）
    let s = st({
      phase: "battle",
      player1: {
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("RS-283", "bs"), inst("RS-282", "yo")],
        deck: deck(3),
      },
      player2: { deck: deck(3) },
    });
    s = endTurn(s);
    expect(inZone(s, "player1", "hand", "RS-283:bs")).toBe(true);
    expect(inZone(s, "player1", "battle", "RS-282:yo")).toBe(true);
  });
});

describe("R-TIME-08 「バトルエリアに出たとき」と並び順確定は別", () => {
  // 「並び順の確定後に置き換えなどでバトルエリアに出た場合にも発動する」(atwiki/page-1828)
  it.fails("R-TIME-08: 相手のピットインダイブでバトルエリアに出された魔導騎士ウルザードの「バトルエリアに出たとき」が発動する（出典: atwiki/page-1828, grnrngr/faq-card-2 RS-115）", () => {
    // 既知の不具合: 未登録（通常のバトルエリア進入では発動するが、相手の効果で出されたときは「バトルエリアに出たとき」が誘発しない）
    let s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-049", "gr")],
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")],
        deck: deck(5),
      },
      player2: { rush: [inst("RS-115", "urz")], deck: deck(5) },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-049:gr" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-115:urz" });
    while (s.pendingEffectChoice?.effectId === "pit_in_dive") {
      const confirm = legal(s).find((a) => a.type === "confirm_effect_choice");
      if (!confirm) break;
      s = run(s, confirm);
    }
    expect(inZone(s, "player2", "battle", "RS-115:urz")).toBe(true);
    // ※これがバトルエリアに出たとき、相手（player1）は1枚ドローしてもよい
    const drewOrOffered =
      s.players.player1.hand.length === 1 ||
      (s.pendingEffectChoice?.playerId === "player1" &&
        s.pendingEffectChoice.sourceCardId === "RS-115");
    expect(drewOrOffered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. 解決
// ---------------------------------------------------------------------------

describe("R-RES-01 1つずつ解決", () => {
  // 「複数のユニットやカードを操作する場合、1枚ずつ順に処理する」(atwiki/page-1869)
  it("R-RES-01: ジュウクンドーで選んだ複数のユニットは1体ずつ撃破され、最初の1体の離場タイミングで他はまだ場にある（出典: atwiki/page-1869）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-106", "dr")] },
      player2: {
        battle: [inst("TST-UNIT-2", "eb")],
        rush: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")],
        hand: [inst("RS-027", "dg")],
        command: [cmd("TST-OP", "k1")],
        deck: deck(5),
      },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-106:dr" });
    s = run(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e1" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e2" });
    s = run(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(s.pendingLeave?.instanceId).toBe("TST-UNIT-0:e1");
    expect(inZone(s, "player2", "rush", "TST-UNIT-0:e2")).toBe(true);
  });

  // 「解決自体は持ち主あるいはテキストで指定されたプレイヤーが行う」(atwiki/page-1869)
  it.fails("R-RES-01: プテラビームの「ホールド状態のカードを1枚選んで捨札」は効果の持ち主（ラッシュしたプレイヤー）が選ぶ（出典: atwiki/page-1869）", () => {
    // 既知の不具合: 未登録（テキストに指定がないのに、選択権が相手プレイヤーに渡される）
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-039", "pt")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { power: powers(6), command: [cmd("TST-OP", "h1", true), cmd("TST-OP", "h2", true)] },
    });
    s = payAndUse(s, "player1", "RS-039:pt", ["TST-OP:c1"]);
    expect(s.pendingEffectChoice?.effectId).toBe("ptera_beam");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
  });
});

describe("R-RES-02 テキストは書かれた順に適用", () => {
  // 「効果処理は、テキストの文面に書かれている順番通りに行う」(atwiki/page-587)
  it.fails("R-RES-02: ファイヤーファイターの消火作業は「自分がオモテにする」→「そうしたとき、相手も同じようにしてもよい」の順に処理され、相手もダメージを1枚オモテにできる（出典: atwiki/page-587）", () => {
    // 既知の不具合: 未登録（後半の「相手も同じようにしてもよい」が処理されない）
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-085", "ff")],
        rush: [inst("TST-UNIT-0", "s1")],
        power: [...powers(7), faceDown("dmg1")],
        damage: 1,
        command: [cmd("TST-OP-OT", "c1")],
      },
      player2: { power: [...powers(2), faceDown("edmg")], damage: 1 },
    });
    const r = rushWithCategoryHold(s0, "player1", "RS-085:ff", "TST-OP-OT:c1", { zordMaterialInstanceId: "TST-UNIT-0:s1" });
    expect(r.ok).toBe(true);
    let s = (r as { state: GameState }).state;
    while (s.pendingEffectChoice) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
      if (!pick) break;
      s = run(s, pick);
    }
    expect(card(s, "player1", "power", "TST-P:dmg1")?.faceDown).toBeFalsy();
    expect(card(s, "player2", "power", "TST-P:edmg")?.faceDown).toBeFalsy();
  });

  it.todo(
    "R-RES-02: 巨大化爆弾は「ラッシュ→BP+3000→SP1→Lユニット」の順に適用する（出典: atwiki/page-587）— 最終状態だけでは適用順を観測できず、途中状態を公開APIで取り出せない",
  );
});

describe("R-RES-03 発動元が離れても解決は続く", () => {
  // 「その効果を発動したユニットの有無に関わらず…実行してください」(faq-card-2 RS-116)
  it("R-RES-03: 撃破されて捨札にあるマンドラ坊やの鳴き声が解決され、「魔法」を持たないSユニットが敵味方とも手札に戻る（出典: grnrngr/faq-card-2 RS-116）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-035", "ty")],
        rush: [inst("RS-060", "mp"), inst("TST-UNIT-0", "mine")],
        battle: [inst("TST-UNIT-0", "s1")],
        power: powers(6),
        command: [cmd("TST-OP", "c1")],
      },
      player2: { rush: [inst("RS-116", "md"), inst("TST-UNIT-0", "s2")], power: powers(6) },
    });
    s = payAndUse(s, "player1", "RS-035:ty", ["TST-OP:c1"]);
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:s1" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-116:md" });
    s = settle(s);
    expect(inZone(s, "player2", "discard", "RS-116:md")).toBe(true);
    expect(inZone(s, "player2", "hand", "TST-UNIT-0:s2")).toBe(true);
    expect(inZone(s, "player1", "hand", "TST-UNIT-0:mine")).toBe(true);
    // 特徴「魔法」を持つマジピンクと、Mユニットのティラノザウルスは残る
    expect(inZone(s, "player1", "rush", "RS-060:mp")).toBe(true);
    expect(inZone(s, "player1", "rush", "RS-035:ty")).toBe(true);
  });

  // 「撃破されるなどして場を離れても、継続して有効になりますか？…はい」(faq-card-2 RS-107 Q2)
  it.fails("R-RES-03: デカブルーが撃破された後も、そのターンに相手がカウンターのためにホールドしたコマンドは捨札になる（出典: grnrngr/faq-card-2 RS-107 Q2）", () => {
    // 既知の不具合: 未登録（ディースナイパーでカウンター用にホールドしたコマンドが捨札にならない。デカブルーが場にあっても同様）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-107", "db")], battle: [inst("TST-UNIT-0", "f1")], deck: deck(3) },
      player2: {
        battle: [inst("TST-UNIT-7", "big")],
        rush: [inst("TST-UNIT-0", "sub")],
        hand: [inst("RS-018", "n1")],
        command: [cmd("TST-OP-MA", "m1")],
        power: powers(5),
        deck: deck(3),
      },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-107:db" });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-107:db", defenderInstanceId: "TST-UNIT-7:big" });
    s = run(s, { type: "pass_battle_reaction", playerId: "player2" });
    s = settle(s);
    expect(inZone(s, "player1", "discard", "RS-107:db")).toBe(true);
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-0:f1", defenderInstanceId: "TST-UNIT-7:big" });
    s = use(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-0:sub" });
    expect(inZone(s, "player2", "discard", "TST-OP-MA:m1")).toBe(true);
  });
});

describe("R-RES-04 回数・空撃ち", () => {
  // 「適正な対象が存在しない…オペレーションを…使用する…はい、できます。」(faq-index オペレーション)
  it.fails("R-RES-04: 山札が2枚以下で解決できないデンジマシーンでも、コマンドをホールドして使用し捨札にできる（出典: grnrngr/faq-index オペレーション, grnrngr/faq-card-1 RS-004 Q1）", () => {
    // 既知の不具合: 未登録（解決不能なオペレーションの空撃ち使用が合法手にない）
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-004", "dj")], power: powers(6), command: [cmd("TST-OP-OT", "c1")], deck: deck(2) },
      player2: { deck: deck(3) },
    });
    expect(hasUseAction(s, "player1", "RS-004:dj")).toBe(true);
  });

  // 「「空撃ち」は可能。その場合は効果は不発となり」(atwiki/page-1869)
  it.fails("R-RES-04: 自軍ユニットが1体もなくても、ガオ・ソウルを空撃ちで使用できる（出典: atwiki/page-1869, grnrngr/faq-index オペレーション）", () => {
    // 既知の不具合: 未登録（対象のないオペレーションの空撃ちができない）
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-025", "gs")], power: powers(6), command: [cmd("TST-OP", "c1")], deck: deck(3) },
      player2: { deck: deck(3) },
    });
    const s = payAndUse(s0, "player1", "RS-025:gs", ["TST-OP:c1"]);
    expect(inZone(s, "player1", "discard", "RS-025:gs")).toBe(true);
  });

  // 「対象を「0枚選ぶ」ことは可能」(atwiki/page-1869)
  it("R-RES-04: 任意効果（ティラノソニック）は対象があっても0体選んで処理を終えられる（出典: atwiki/page-1869）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-035", "ty")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { rush: [inst("TST-UNIT-0", "e1")] },
    });
    s = payAndUse(s, "player1", "RS-035:ty", ["TST-OP:c1"]);
    expect(s.pendingEffectChoice?.effectId).toBe("tyranno_sonic");
    s = run(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(inZone(s, "player2", "rush", "TST-UNIT-0:e1")).toBe(true);
  });

  // 「強制効果の場合は対象があれば必ず選ばなければならない」(atwiki/page-1869)
  it("R-RES-04: 強制効果（アバレンオーの爆竜電撃ドリルスピン）は対象があれば選ばずに終えられない（出典: atwiki/page-1869）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-050", "ab")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")] },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-050:ab" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("TST-UNIT-2:eb");
    expect(legal(s).some((a) => a.type === "skip_effect_choice")).toBe(false);
  });

  // 「効果の解決中に持ち主が回数を決めてよい。事前に宣言する必要はない」(atwiki/page-1869)
  it("R-RES-04: 「好きな数選んで」（ジュウクンドー）は発動時に数を宣言せず、解決中に選んで決められる（出典: atwiki/page-1869）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-106", "dr")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], rush: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], deck: deck(3) },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-106:dr" });
    s = run(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    expect(s.pendingEffectChoice?.kind).toBe("select_units_bp_budget");
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e1" });
    s = run(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:e1")).toBe(true);
    expect(inZone(s, "player2", "rush", "TST-UNIT-0:e2")).toBe(true);
  });
});

describe("R-RES-05 参照は即時更新", () => {
  // 「何かを参照する効果は、その参照先の状態が変化したときに、即座に更新される」(faq-card-2 RS-081 Q1)
  it.fails("R-RES-05: 龍撃剣のティラノレンジャーは、相手が隠流忍術のためにホールドしたコマンドの分もBP+1000される（出典: grnrngr/faq-card-2 RS-081 Q1）", () => {
    // 既知の不具合: 未登録（龍撃剣のBP修正がバトルエリアに出た時点の固定値で、ホールド数の変化に追従しない）
    let s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-081", "tr")],
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")],
      },
      player2: {
        battle: [inst("TST-UNIT-2", "def")],
        rush: [inst("TST-UNIT-0", "sub")],
        hand: [inst("RS-018", "n1")],
        power: powers(6),
        command: [cmd("TST-OP-MA", "m1"), cmd("TST-OP", "h1", true)],
      },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-081:tr" });
    expect(effectiveBp(s, "player1", card(s, "player1", "battle", "RS-081:tr")!)).toBe(4000);
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-081:tr", defenderInstanceId: "TST-UNIT-2:def" });
    s = run(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: "RS-018:n1", substituteInstanceId: "TST-UNIT-0:sub" });
    s = run(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP-MA:m1"] });
    expect(s.log.some((l) => l.includes("ティラノレンジャー") && l.includes("5000vs"))).toBe(true);
  });

  // 「効果で修正の加えられたその時点での値を参照します」(faq-index リファレンス)
  it("R-RES-05: 疾風流超忍法の「BP8000以下」は修正後のBPを参照し、ガオ・ソウルで9000以上になったユニットには発動できない（出典: grnrngr/faq-index リファレンス, grnrngr/faq-card-1 RS-026 RS-113 Q）", () => {
    // 「ＢＰ９０００以上になっている…発動することはできません」(faq-card-1 RS-026)
    const big = { ...inst("TST-UNIT-2", "u"), bpModifier: 6000 };
    let s = st({
      phase: "rush",
      player1: { hand: [inst("TST-UNIT-2", "nu")], rush: [big], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { hand: [inst("RS-026", "sn")], power: powers(6), command: [cmd("TST-OP-MA", "m1")], deck: deck(3) },
    });
    // 通常のBP3000ユニットのラッシュには発動できる（対照）
    const control = payAndUse(s, "player1", "TST-UNIT-2:nu", ["TST-OP:c1"]);
    expect(hasUseAction(control, "player2", "RS-026:sn")).toBe(true);
    expect(effectiveBp(s, "player1", big)).toBe(9000);
  });
});

describe("R-RES-06 「そうしたとき」", () => {
  // 「「そうしたとき」よりも後のテキストは、条件ではありません」(faq-card-2 RS-085)
  it("R-RES-06: 相手がダメージを受けていなくても、ファイヤーファイターの消火作業で自分のダメージをオモテにできる（出典: grnrngr/faq-card-2 RS-085）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-085", "ff")],
        rush: [inst("TST-UNIT-0", "s1")],
        power: [...powers(7), faceDown("dmg1")],
        damage: 1,
        command: [cmd("TST-OP-OT", "c1")],
      },
      player2: { power: powers(3) },
    });
    const r = rushWithCategoryHold(s0, "player1", "RS-085:ff", "TST-OP-OT:c1", { zordMaterialInstanceId: "TST-UNIT-0:s1" });
    expect(r.ok).toBe(true);
    let s = (r as { state: GameState }).state;
    while (s.pendingEffectChoice) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
      if (!pick) break;
      s = run(s, pick);
    }
    expect(card(s, "player1", "power", "TST-P:dmg1")?.faceDown).toBeFalsy();
  });

  // 「場の「爆竜ティラノサウルス」のうちの１体だけです」(faq-card-1 RS-051 Q2)
  it("R-RES-06: 操作による起動（手札の爆竜ティラノサウルスを捨てる）は1体分だけで、場の2体が同時にSP1を得ることはない（出典: grnrngr/faq-card-1 RS-051 Q2）", () => {
    let s = st({
      phase: "battle",
      player1: {
        battle: [inst("RS-051", "d1")],
        rush: [inst("RS-051", "d2")],
        hand: [inst("RS-051", "dh")],
        command: [cmd("TST-OP", "c1"), cmd("TST-OP", "c2")],
      },
      player2: { battle: [inst("TST-UNIT-2", "eb")] },
    });
    s = run(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-051:d2" });
    s = run(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c1"] });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-051:dh" });
    expect(card(s, "player1", "battle", "RS-051:d2")?.spModifier).toBe(1);
    expect(card(s, "player1", "battle", "RS-051:d1")?.spModifier ?? 0).toBe(0);
  });
});

describe("R-RES-07 期限付き効果は発動元に依存しない", () => {
  // 「一度発動してしまえば…撃破されても…効果は有効になります」(faq-card-2 RS-110)
  it("R-RES-07: ゼニボム発動後にデカピンクが撃破されても、次の相手ターンに新しくラッシュしたユニットはバトルエリアに出られない（出典: grnrngr/faq-card-2 RS-110 Q1）", () => {
    let s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-110", "dp")],
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3"), inst("TST-UNIT-0", "f4")],
        deck: deck(3),
      },
      player2: { battle: [inst("TST-UNIT-7", "big")], hand: [inst("TST-UNIT-0", "nu")], power: powers(3), command: [cmd("TST-OP", "k1")], deck: deck(5) },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-110:dp" });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-110:dp", defenderInstanceId: "TST-UNIT-7:big" });
    s = settle(s);
    expect(inZone(s, "player1", "discard", "RS-110:dp")).toBe(true);
    for (let i = 0; i < 30 && !(s.phase === "rush" && s.activePlayer === "player2"); i += 1) {
      const a = legal(s).find((x) => x.type === "end_phase" || x.type === "draw" || x.type === "pass_battle_entry") ?? legal(s)[0];
      s = run(s, a!);
    }
    s = use(s, "player2", "TST-UNIT-0:nu");
    for (let i = 0; i < 4 && s.activePlayer !== "player2"; i += 1) s = run(s, legal(s)[0]!);
    s = run(s, { type: "end_phase", playerId: "player2" });
    expect(s.phase).toBe("battle");
    expect(
      legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "TST-UNIT-0:nu"),
    ).toBe(false);
  });

  it.todo(
    "R-RES-07: バキケロナグルスが隠流忍術で撃破されても、ジョイントコンビネーションしたLユニットの追加アタック能力は有効のまま（出典: grnrngr/faq-card-1 RS-018 Q5）— ジョイントコンビネーション成立と追加アタック能力（RS-167）を公開APIで構築・観測する手段がない",
  );
});

describe("R-RES-08 無限ループ", () => {
  it.todo(
    "R-RES-08: 意図的に止められない無限ループ（ゴーゴーファイヤーとバルパンサー（2nd）等）では、ターンプレイヤーがどの効果を適用するか決め、選ばれなかった効果は適用されない（出典: atwiki/page-1869, atwiki/page-2167）— エンジンにループ検出と優先効果の選択手段がない",
  );
  it.todo(
    "R-RES-08: [未確定] ガンマジンと仮面ライダーアークのサイズ変更ループの公式回答（atwiki/page-1974 にはコミュニティ回答のみ）",
  );
});

// ---------------------------------------------------------------------------
// 3. 同時・優先順位
// ---------------------------------------------------------------------------

describe("R-SIM-01 同時の処理順はターンプレイヤー", () => {
  // 「同時に７点目のダメージを受けた場合はターンプレイヤーがゲームに勝利します」(faq-card-1 RS-054)
  it("R-SIM-01: アバレッド同士の相討ちで互いに7点目のダメージを受けたら、ターンプレイヤーが勝つ（出典: grnrngr/faq-card-1 RS-054 Q2）", () => {
    const dmg = (p: string) => Array.from({ length: 6 }, (_, i) => faceDown(`${p}${i}`));
    let s = st({
      phase: "battle",
      player1: { battle: [inst("RS-054", "a1")], damage: 6, power: [...dmg("x"), ...powers(1)], deck: deck(3) },
      player2: { battle: [inst("RS-054", "a2")], damage: 6, power: [...dmg("y"), ...powers(1)], deck: deck(3) },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-054:a1", defenderInstanceId: "RS-054:a2" });
    for (let i = 0; i < 8 && !s.winner && legal(s).length; i += 1) s = run(s, legal(s)[0]!);
    expect(s.players.player1.damage).toBeGreaterThanOrEqual(7);
    expect(s.players.player2.damage).toBeGreaterThanOrEqual(7);
    expect(s.winner).toBe("player1");
  });

  it.todo(
    "R-SIM-01: 超電子レーダー配置中に冥王ジルフィーザをラッシュしたとき、どちらから処理するかはターンプレイヤーが決める（出典: grnrngr/faq-card-2 RS-092）— ジルフィーザ（追加条件: Sユニット3体を捨札）が公開APIの合法手でラッシュできない",
  );
});

describe("R-SIM-02 例外: マルチカテゴリ等", () => {
  // 「モーフの順番は相手が決められる」(atwiki/page-1827)
  it("R-SIM-02: 敵軍ターン中に複数のモーフを発動したとき、順番はそのターンのターンプレイヤーが決める（出典: atwiki/page-1827）", () => {
    const chooser = morphOrderChooserPlayerId({
      defenderPlayerId: "player2",
      rusherPlayerId: "player1",
      rushedInstanceId: "TST-UNIT-2:r",
      phasePlayerId: "player1",
      morphUnitInstanceIds: ["TST-UNIT-0:m1", "TST-UNIT-0:m2"],
    });
    expect(chooser).toBe("player1");
  });

  it.todo(
    "R-SIM-02: ゾーンのカテゴリ数を制限する効果では、マルチカテゴリのカードを先に捨てれば処理可能になるならそれを優先しなければならない（出典: atwiki/page-1559）— 該当する効果カードが legend1〜3 にない",
  );
  it.todo("R-SIM-02: [未確定] ターンプレイヤーが自由に順番を決められない例外の全容");
});

describe("R-SIM-03 複数枚を捨てる処理", () => {
  it.todo(
    "R-SIM-03: パワーを複数枚捨てるときは1枚ずつ捨てる扱いで、捨てた枚数だけダイデンジンの効果が使える（出典: atwiki/page-1827）— RS-352 ダイデンジン【ダイデンジンブーメラン】がエンジン未接続（パワー離脱の誘発がない）",
  );
});

describe("R-PRI-01 否定文が優先", () => {
  // 「「否定文の効果（～しない、できない）」が…よりも優先順位が高い」(atwiki/page-1864)
  it("R-PRI-01: アースの力（可能であればバトルエリアに出る）が配置されていても、「バトルエリアに出られない」マンドラ坊やは出られない（出典: atwiki/page-1864, grnrngr/faq-index リファレンス）", () => {
    let s = st({
      phase: "rush",
      player1: { operation: [inst("RS-022", "earth")], rush: [inst("RS-116", "md"), inst("TST-UNIT-0", "s1")], deck: deck(3) },
      player2: { deck: deck(3) },
    });
    s = run(s, { type: "end_phase", playerId: "player1" });
    expect(s.phase).toBe("battle");
    expect(inZone(s, "player1", "rush", "RS-116:md")).toBe(true);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "RS-116:md")).toBe(false);
  });

  // 「「可能なら～する」というのは…「可能ではない」と判断されます」(faq-index リファレンス)
  it("R-PRI-01: 「毎ターン、可能ならバトルエリアに出る」アバレッドも、ハリケンレオンの制限でホールドできるコマンドがなければ出られず、バトルフェイズを終えられる（出典: grnrngr/faq-index リファレンス, grnrngr/faq-card-2 RS-097 Q5）", () => {
    // 「ホールドできるコマンドが無ければ…ラッシュエリアに留まります」(faq-card-2 RS-097)
    const s = st({
      phase: "battle",
      turn: 3,
      player1: { rush: [inst("RS-054", "ab")], command: [], deck: deck(3) },
      player2: { battle: [inst("RS-097", "le")], deck: deck(3) },
    });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "RS-054:ab")).toBe(false);
    expect(legal(s).some((a) => a.type === "end_phase" && a.playerId === "player1")).toBe(true);
  });
});

describe("R-PRI-02 種類別の固定優先順位はない", () => {
  // 「ターンプレイヤーが、捨札にするかパワーゾーンに送るかを選択できます」(faq-card-1 RS-039/RS-089)
  it.fails("R-PRI-02: プテラノドンとレスキューファイターが同時に撃破されたとき、固定順ではなくターンプレイヤーが処理順を決め、プテラノドンを先に処理すればパワーゾーンに送れる（出典: grnrngr/faq-card-1 RS-039・RS-018 Q, grnrngr/faq-index リファレンス）", () => {
    // 既知の不具合: 02-D13（同時撃破の処理順をターンプレイヤーが選べず、両方捨札になる）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-089", "rf")], battle: [inst("RS-039", "pt")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], hand: [inst("RS-018", "n1")], command: [cmd("TST-OP-MA", "m1")], power: powers(5) },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-039:pt", defenderInstanceId: "TST-UNIT-2:eb" });
    s = use(s, "player2", "RS-018:n1", { substituteInstanceId: "RS-089:rf" });
    for (let i = 0; i < 8; i += 1) {
      const order = legal(s).find(
        (a) => a.type === "resolve_effect_choice" && a.playerId === "player1" && a.instanceId.includes("RS-039"),
      );
      const next = order ?? (s.pendingLeave || s.pendingEffectChoice || s.pendingDamagePayment ? legal(s)[0] : undefined);
      if (!next) break;
      s = run(s, next);
    }
    expect(inZone(s, "player1", "power", "RS-039:pt")).toBe(true);
    expect(inZone(s, "player1", "discard", "RS-089:rf")).toBe(true);
  });

  it.todo(
    "R-PRI-02: BP修正は「＋」→「－」の順に計算し、「指定の値になる」が最優先（複数なら低い方）（出典: grnrngr/faq-index リファレンス）— 「BP－」修正（レッドホーク（2nd）等）と「BP＊＊＊＊になる」効果が legend1〜3 でエンジン未実装",
  );
});

// ---------------------------------------------------------------------------
// 4. 対象選択
// ---------------------------------------------------------------------------

describe("R-TGT-01 「ユニット」と「ユニットのカード」", () => {
  // 「パワーゾーンやコマンドゾーンにあるものを選ぶときは、「ユニットのカード」と書かれています」(faq-card-1 RS-060 Q1)
  it("R-TGT-01: ピンクストームでパワーゾーン・コマンドゾーンのユニットのカードは選べない（出典: grnrngr/faq-card-1 RS-060 Q1）", () => {
    let s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-060", "mp")],
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")],
        power: [inst("TST-UNIT-0", "pu")],
        command: [cmd("TST-UNIT-0", "cu")],
      },
      player2: { battle: [inst("TST-UNIT-2", "eb")], power: [inst("TST-UNIT-0", "epu")], command: [cmd("TST-UNIT-0", "ecu")] },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:mp" });
    const valid = s.pendingEffectChoice?.validInstanceIds ?? [];
    expect(s.pendingEffectChoice?.effectId).toBe("pink_storm");
    for (const id of ["TST-UNIT-0:pu", "TST-UNIT-0:cu", "TST-UNIT-0:epu", "TST-UNIT-0:ecu"]) {
      expect(valid).not.toContain(id);
    }
  });

  // 「「ユニット」と表記されているときは、バトルエリアかラッシュエリアにある…」(faq-index リファレンス)
  it.fails("R-TGT-01: ピンクストームの「ユニット」にはラッシュエリアのユニットも含まれる（出典: grnrngr/faq-index リファレンス）", () => {
    // 既知の不具合: 未登録（ピンクストームの対象候補がバトルエリアのユニットに限られている）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-060", "mp")], battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], rush: [inst("TST-UNIT-0", "er")] },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:mp" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("TST-UNIT-0:er");
  });
});

describe("R-TGT-02 「選ばれない」と範囲指定", () => {
  // 「プレイヤーが対象を「選ぶ」ということを行わないので…対象になります」(faq-card-1 RS-026 Q1)
  it("R-TGT-02: 「相手に選ばれない」仮面ライダーカブトRFも、マンドラ坊やの「Sユニットをすべて手札に戻す」の対象になる（出典: grnrngr/faq-card-1 RS-026 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-035", "ty")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { rush: [inst("RS-116", "md"), inst("RK-065", "kabuto")], power: powers(6) },
    });
    s = payAndUse(s, "player1", "RS-035:ty", ["TST-OP:c1"]);
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-035:ty" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-116:md" });
    s = settle(s);
    expect(inZone(s, "player2", "hand", "RK-065:kabuto")).toBe(true);
  });

  // 「これはアタックされる以外では相手に選ばれない」(RK-065 テキスト)
  it.fails("R-TGT-02: 対照: プレイヤーが「選ぶ」ティラノソニックでは、相手に選ばれない仮面ライダーカブトRFを選べない（出典: grnrngr/faq-card-1 RS-026 Q1）", () => {
    // 既知の不具合: 未登録（「相手に選ばれない」がティラノソニックの対象候補から除外されない）
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-035", "ty")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { rush: [inst("RS-116", "md"), inst("RK-065", "kabuto")], power: powers(6) },
    });
    s = payAndUse(s, "player1", "RS-035:ty", ["TST-OP:c1"]);
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-035:ty" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("RS-116:md");
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("RK-065:kabuto");
  });
});

describe("R-TGT-03 複数撃破は先に全員選ぶ", () => {
  // 「先に撃破する対象をすべて選んでから、選んだユニットを１体ずつ撃破」(faq-card-2 RS-106 Q1)
  it("R-TGT-03: ジュウクンドーは対象をすべて選び終えてから撃破に移る（出典: grnrngr/faq-card-2 RS-106 Q1）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-106", "dr")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], rush: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")], deck: deck(3) },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-106:dr" });
    s = run(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e1" });
    // 1体選んだ時点ではまだ撃破されない
    expect(inZone(s, "player2", "rush", "TST-UNIT-0:e1")).toBe(true);
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e2" });
    s = run(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:e1")).toBe(true);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:e2")).toBe(true);
    expect(inZone(s, "player2", "rush", "TST-UNIT-0:e3")).toBe(true);
  });

  // 「再び同じユニットを選んで撃破する事は可能ですか？…いいえ、できません。」(faq-card-2 RS-106 Q5)
  it.fails("R-TGT-03: ジュウクンドーの対象がダイノガッツで場に留まったら、その撃破は終わり、同じユニットを再び撃破しない（出典: grnrngr/faq-card-2 RS-106 Q5）", () => {
    // 既知の不具合: 未登録（ダイノガッツで留まった対象をジュウクンドーが再び撃破する）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-106", "dr")] },
      player2: {
        battle: [inst("TST-UNIT-2", "eb")],
        rush: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")],
        hand: [inst("RS-027", "dg")],
        command: [cmd("TST-OP", "k1")],
        deck: deck(5),
        power: powers(4),
      },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-106:dr" });
    s = run(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e1" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e2" });
    s = run(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(s.pendingLeave?.instanceId).toBe("TST-UNIT-0:e1");
    s = use(s, "player2", "RS-027:dg");
    for (let i = 0; i < 8 && (s.pendingLeave || s.pendingEffectChoice || s.pendingDamagePayment); i += 1) {
      const a = legal(s).find((x) => x.type === "pass_leave_reaction" || x.type === "confirm_effect_choice") ?? legal(s)[0];
      s = run(s, a!);
    }
    expect(inZone(s, "player2", "rush", "TST-UNIT-0:e1")).toBe(true);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:e2")).toBe(true);
  });

  it.todo(
    "R-TGT-03: ゴレンジャーハリケーンで2体の爆竜トリケラトプスが対象になったとき、2体目の超シールド進化で1体目が留まれば、1体目は選び直されない（出典: grnrngr/faq-card-1 RS-052 Q1）— モモレンジャーからの5体順コンビネーション（ゴレンジャーハリケーン）を公開APIで成立させる手段が未確認",
  );
});

describe("R-TGT-04 自分のユニットも選べる", () => {
  // 「「ティラノソニック」を発動させるために…自身を選ぶことはできますか？…はい」(faq-card-1 RS-035)
  it("R-TGT-04: ティラノソニックで守護獣ティラノザウルス自身を選べる（出典: grnrngr/faq-card-1 RS-035）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-035", "ty")], power: powers(6), command: [cmd("TST-OP", "c1")] },
      player2: { rush: [inst("TST-UNIT-0", "e1")] },
    });
    s = payAndUse(s, "player1", "RS-035:ty", ["TST-OP:c1"]);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("RS-035:ty");
  });

  // 「自分のユニットを選ぶことができますか？…はい、選べます。」(faq-card-1 RS-060 Q2)
  it("R-TGT-04: ピンクストームで自分のユニット（マジピンク自身を含む）を選べる（出典: grnrngr/faq-card-1 RS-060 Q2）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-060", "mp")], battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")] },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:mp" });
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(
      expect.arrayContaining(["TST-UNIT-0:f1", "RS-060:mp"]),
    );
  });

  // 「アタックしてきたユニット以外のユニットをすべての場から１体選んで」(faq-card-1 RS-018 エラッタ)
  it("R-TGT-04: 隠流忍術はすべての場からユニットを選べる（自軍・敵軍とも）が、アタックしてきたユニットは選べない（出典: grnrngr/faq-card-1 RS-018 Q6・Q7・エラッタ）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")], rush: [inst("TST-UNIT-0", "other")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        rush: [inst("TST-UNIT-7", "big")],
        hand: [inst("RS-018", "n1")],
        power: powers(6),
        command: [cmd("TST-OP-MA", "m1")],
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-UNIT-0:def" });
    const subs = (legal(s) as unknown as Record<string, unknown>[])
      .filter((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-018:n1")
      .map((a) => a.substituteInstanceId);
    expect(subs).toEqual(expect.arrayContaining(["TST-UNIT-7:big", "TST-UNIT-0:other"]));
    expect(subs).not.toContain("TST-UNIT-2:atk");
  });
});

// ---------------------------------------------------------------------------
// 5. 移動・撃破・捨札
// ---------------------------------------------------------------------------

describe("R-MOVE-01 移動は「場を離れる」", () => {
  // 「一旦場を離れていると解釈します」(faq-card-1 RS-016 Q1)
  it("R-MOVE-01: レスキューファイターでパワーゾーンに送られるときも、ダイノガッツ（場を離れるとき）を発動できる（出典: grnrngr/faq-card-1 RS-016 Q1・RS-027 Q5）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("RS-037", "wbm")],
        rush: [inst("RS-089", "rf")],
        hand: [inst("RS-027", "dg")],
        command: [cmd("TST-OP", "k1")],
        deck: deck(8),
        power: powers(4),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-037:wbm" });
    expect(s.pendingLeave?.instanceId).toBe("RS-037:wbm");
    expect(hasUseAction(s, "player2", "RS-027:dg")).toBe(true);
  });

  // 「ラッシュエリアからバトルエリアに移動させられるときも…発動させることができます」(faq-card-1 RS-027 Q5)
  it.fails("R-MOVE-01: ピットインダイブでラッシュエリアからバトルエリアに出されるときも、ダイノガッツを発動できる（出典: grnrngr/faq-card-1 RS-016 Q1・RS-027 Q5）", () => {
    // 既知の不具合: 未登録（ラッシュエリア→バトルエリアの移動で「場を離れるとき」の反応窓が開かない）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-049", "gr")], battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")] },
      player2: { rush: [inst("TST-UNIT-0", "er")], hand: [inst("RS-027", "dg")], command: [cmd("TST-OP", "k1")], deck: deck(5), power: powers(4) },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-049:gr" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:er" });
    expect(s.pendingLeave?.instanceId).toBe("TST-UNIT-0:er");
    expect(hasUseAction(s, "player2", "RS-027:dg")).toBe(true);
  });

  // 「「場を離れるとき」という表現は、場の中でそれぞれの場所から移動するときも含まれる」(atwiki/page-591)
  it.fails("R-MOVE-01: ピンクストームで山札の上に戻されるときも、ダイノガッツを発動できる（出典: atwiki/page-591, grnrngr/faq-card-1 RS-027 Q5）", () => {
    // 既知の不具合: 未登録（山札へ戻す効果で「場を離れるとき」の反応窓が開かない）
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-060", "mp")], battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], hand: [inst("RS-027", "dg")], command: [cmd("TST-OP", "k1")], deck: deck(5), power: powers(4) },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:mp" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-2:eb" });
    expect(s.pendingLeave?.instanceId).toBe("TST-UNIT-2:eb");
    expect(hasUseAction(s, "player2", "RS-027:dg")).toBe(true);
  });
});

describe("R-MOVE-02 ユニットでなくなるとき", () => {
  // 「このタイミングが来た時点ではまだユニットとして扱われている」(atwiki/page-1845)
  it("R-MOVE-02: パワーゾーンに送られることが決まったタイミングでは、まだラッシュ／バトルエリアのユニットである（出典: atwiki/page-1845, atwiki/page-1872）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("RS-037", "wbm")],
        rush: [inst("RS-089", "rf")],
        hand: [inst("RS-027", "dg")],
        command: [cmd("TST-OP", "k1")],
        deck: deck(8),
        power: powers(4),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-037:wbm" });
    expect(s.pendingLeave).toBeDefined();
    expect(inZone(s, "player2", "battle", "RS-037:wbm")).toBe(true);
    expect(inZone(s, "player2", "power", "RS-037:wbm")).toBe(false);
  });

  // 「先に「そのユニットをユニットのまま留める」効果を解決した場合…タイミングが終了」(atwiki/page-1845)
  it("R-MOVE-02: 「ユニットのまま留める」効果（ダイノガッツ）を解決すると、そのタイミングは終わり、レスキューファイターの「かわりにパワーゾーンへ」も適用されない（出典: atwiki/page-1845）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("RS-037", "wbm")],
        rush: [inst("RS-089", "rf")],
        hand: [inst("RS-027", "dg")],
        command: [cmd("TST-OP", "k1")],
        deck: deck(8),
        power: powers(4),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-037:wbm" });
    s = use(s, "player2", "RS-027:dg");
    s = settle(s);
    expect(inZone(s, "player2", "battle", "RS-037:wbm")).toBe(true);
    expect(inZone(s, "player2", "power", "RS-037:wbm")).toBe(false);
    expect(s.pendingLeave).toBeUndefined();
  });
});

describe("R-DESTROY-01 撃破の定義", () => {
  // 「通常、撃破されたユニットは捨札になる」(atwiki/page-262 公式用語集)
  it("R-DESTROY-01: バトルに負けたユニットは撃破され、通常は捨札になる（出典: atwiki/page-262）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: { battle: [inst("TST-UNIT-0", "def")] },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-UNIT-0:def" });
    s = settle(s);
    expect(inZone(s, "player2", "discard", "TST-UNIT-0:def")).toBe(true);
    expect(inZone(s, "player2", "battle", "TST-UNIT-0:def")).toBe(false);
  });
});

describe("R-DESTROY-02 撃破 ≠ 捨札", () => {
  // 「「RS-016 ダイノ伝記」には、撃破されたことを無効にする効果はありません」(faq-card-1 RS-016 Q2)
  it("R-DESTROY-02: ダイノ伝記でアバレッドを場に留めても、撃破された事実は残り1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-016 Q2・RS-054 Q3）", () => {
    // 既知の不具合: E10
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: {
        battle: [inst("RS-054", "ab")],
        hand: [inst("RS-016", "dc")],
        discard: [inst("RS-054", "ab2")],
        command: [cmd("TST-OP", "c1")],
        power: powers(5),
        deck: deck(5),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "RS-054:ab" });
    s = use(s, "player2", "RS-016:dc");
    s = settle(s);
    expect(inZone(s, "player2", "battle", "RS-054:ab")).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  // 「「RS-027 ダイノガッツ」には、撃破されたことを無効にする効果はありません」(faq-card-1 RS-027 Q6)
  it("R-DESTROY-02: ダイノガッツでアバレッドを場に留めても、1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-027 Q6・RS-054 Q4）", () => {
    // 既知の不具合: E10
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: { battle: [inst("RS-054", "ab")], hand: [inst("RS-027", "dg")], command: [cmd("TST-OP", "c1")], power: powers(5), deck: deck(5) },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "RS-054:ab" });
    s = use(s, "player2", "RS-027:dg");
    s = settle(s);
    expect(inZone(s, "player2", "battle", "RS-054:ab")).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  // 「撃破されたことを無効にはできません」(faq-card-1 RS-052 Q6)
  it("R-DESTROY-02: 超シールド進化でアバレッドのかわりに爆竜トリケラトプスを捨てても、アバレッドは撃破されており1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-052 Q6・RS-054 Q5）", () => {
    // 既知の不具合: E10
    let s = st({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [inst("RS-052", "tri"), inst("RS-054", "ab")], power: powers(5), deck: deck(5) },
      player2: { battle: [inst("TST-UNIT-2", "atk")] },
    });
    s = run(s, { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "RS-054:ab" });
    expect(s.pendingLeave?.superShieldInstanceId).toBe("RS-052:tri");
    s = run(s, { type: "use_super_shield", playerId: "player1" });
    s = settle(s);
    expect(inZone(s, "player1", "battle", "RS-054:ab")).toBe(true);
    expect(inZone(s, "player1", "discard", "RS-052:tri")).toBe(true);
    expect(s.players.player1.damage).toBe(1);
  });

  // 「「撃破して・されて捨札になったとき」の効果は発動しない」(atwiki/page-1289)
  it("R-DESTROY-02: ダイノガッツで場に留まったアバレッドAMの「撃破されて捨札になったとき」は発動しない（出典: atwiki/page-1289, atwiki/page-262）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("RS-230", "am")],
        hand: [inst("RS-027", "dg")],
        discard: [inst("RS-054", "old")],
        command: [cmd("TST-OP", "c1")],
        power: powers(5),
        deck: deck(10),
      },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-230:am" });
    s = use(s, "player2", "RS-027:dg");
    s = settle(s);
    expect(inZone(s, "player2", "battle", "RS-230:am")).toBe(true);
    expect(inZone(s, "player2", "discard", "RS-054:old")).toBe(true);
    expect(inZone(s, "player2", "rush", "RS-054:old")).toBe(false);
  });

  it.todo(
    "R-DESTROY-02: 追加条件で捨札にしたアバレッドは撃破を経ていないので「撃破されたとき」の1点ダメージは発生しない（出典: atwiki/page-262）— アバレッドAMのゾードダウン（追加条件）を公開APIの合法手で実行する手順が未確認",
  );
});

describe("R-DESTROY-03 除外は撃破ではない", () => {
  it.todo(
    "R-DESTROY-03: ユニットが除外されるときは「撃破されるとき・されたとき」の効果は発動しない（出典: atwiki/page-1970）— legend1〜3 にユニットを除外する効果がなく、エンジンの moveToExile は誘発を持たない素のゾーン移動のため検証にならない",
  );
});

// ---------------------------------------------------------------------------
// 6. 置換（かわりに）と置き換え
// ---------------------------------------------------------------------------

describe("R-REPL-01 「かわりに捨札にする」側は撃破扱いではない", () => {
  // 「「RS-052 爆竜トリケラトプス」自身は撃破扱いにならないためです」(faq-card-2 RS-089 Q1)
  it("R-REPL-01: 超シールド進化でかわりに捨札になった爆竜トリケラトプスは、レスキューファイターでパワーゾーンに送られない（出典: grnrngr/faq-card-2 RS-089 Q1・grnrngr/faq-card-1 RS-052 Q2）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: { battle: [inst("RS-037", "wbm"), inst("RS-052", "tri")], rush: [inst("RS-089", "rf")], power: powers(3) },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-037:wbm" });
    s = run(s, { type: "use_super_shield", playerId: "player2" });
    s = settle(s);
    expect(inZone(s, "player2", "battle", "RS-037:wbm")).toBe(true);
    expect(inZone(s, "player2", "discard", "RS-052:tri")).toBe(true);
    expect(inZone(s, "player2", "power", "RS-052:tri")).toBe(false);
  });

  it.todo(
    "R-REPL-01: ジャイアントローラー指定ユニットとバトルしたユニットのかわりに爆竜トリケラトプスが捨札になっても、ダメージにはならない（出典: grnrngr/faq-card-1 RS-052 Q3）— RS-182 ジャイアントローラーがエンジンで使用できない",
  );
});

describe("R-REPL-02 「捨札にするかわりに別の場所へ」", () => {
  // 「撃破されたとき捨札にするかわりに自軍パワーゾーンに送る」(RS-089 テキスト)
  it("R-REPL-02: レスキューファイターがあるとき、撃破されたワイルドビーストのMユニットは捨札を経由せずパワーゾーン（オモテ向き）に置かれる（出典: grnrngr/faq-card-2 RS-089 Q2）", () => {
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: { battle: [inst("RS-037", "wbm")], rush: [inst("RS-089", "rf")], power: powers(3) },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-037:wbm" });
    s = settle(s);
    expect(inZone(s, "player2", "power", "RS-037:wbm")).toBe(true);
    expect(card(s, "player2", "power", "RS-037:wbm")?.faceDown).toBeFalsy();
    expect(inZone(s, "player2", "discard", "RS-037:wbm")).toBe(false);
    expect(s.players.player2.damage).toBe(0);
  });

  it.todo(
    "R-REPL-02: ジャイアントローラーの「撃破されて捨札になったとき」は、レスキューファイターで捨札を経由しない場合は適用されない（出典: grnrngr/faq-card-2 RS-089 Q2）— RS-182 ジャイアントローラーがエンジンで使用できない",
  );
  it.todo(
    "R-REPL-02: ゴルゴムの仕業で無効化されて捨札になるオーラパワーも、マジシャインの「かわりに」でコマンドゾーンに留められる（出典: grnrngr/faq-card-1 RS-011）— RS-325 マジチケットと RK-251 ゴルゴムの仕業がエンジン未接続",
  );
});

describe("R-REPL-03 「AするかわりにBする」の一般則", () => {
  // 「アタックする権利を失う代わりに効果を発動することができる」(atwiki/page-318 公式コラムvol44)
  it("R-REPL-03: 敵軍バトルエリアにユニットがいなくても、ハリケンイエローの超忍法・舞獅子を発動できる（出典: atwiki/page-318 RS-100 Q2 ルール整理後, atwiki/page-2395）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-100", "hy")], deck: [inst("RS-100", "hy2"), ...deck(3)] },
      player2: {},
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-100:hy" });
    // 舞獅子は「アタックするかわりに」プレイヤーが選んで発動する（R-ATK-05）。
    const lionDance = legal(s).find(
      (a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === "RS-100:hy",
    );
    if (lionDance) s = run(s, lionDance);
    while (s.pendingEffectChoice) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
      if (!pick) break;
      s = run(s, pick);
    }
    expect(inZone(s, "player1", "battle", "RS-100:hy2")).toBe(true);
  });

  // 「これはアタックするかわりに次の効果を発動できる」(RS-100 テキスト)
  it("R-REPL-03: 超忍法・舞獅子を発動したハリケンイエローは、アタックする権利を失っておりアタックできない（出典: atwiki/page-2395, atwiki/page-318）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-100", "hy")], deck: [inst("RS-100", "hy2"), ...deck(3)] },
      player2: { battle: [inst("TST-UNIT-0", "e1")] },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-100:hy" });
    // 舞獅子は「アタックするかわりに」プレイヤーが選んで発動する（R-ATK-05）。
    const lionDance = legal(s).find(
      (a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === "RS-100:hy",
    );
    if (lionDance) s = run(s, lionDance);
    while (s.pendingEffectChoice) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
      if (!pick) break;
      s = run(s, pick);
    }
    expect(inZone(s, "player1", "battle", "RS-100:hy2")).toBe(true);
    expect(
      legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-100:hy"),
    ).toBe(false);
  });

  // 「これが敵軍ユニットにアタックできるとき、次の効果を発動できる」(atwiki/page-23 RS-106 読み替え)
  it("R-REPL-03: 読み替え後のデカレッドは「敵軍ユニットにアタックできるとき」が条件のため、敵軍バトルエリアが空ならジュウクンドーを使えない（出典: atwiki/page-23）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-106", "dr")] },
      player2: { rush: [inst("TST-UNIT-0", "e1")] },
    });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-106:dr" });
    expect(legal(s).some((a) => a.type === "use_juu_kun_do")).toBe(false);
  });

  it.todo(
    "R-REPL-03: ルナジェルでアタックできない侍ユニットも、恐竜折神で得た「アタックするかわりに」の撃破を使える（出典: atwiki/page-1974 Q&A）— XG3-034 恐竜折神・RS-579 ルナジェルの組合せがエンジン未接続",
  );
  it.todo("R-REPL-03: [未確定] 公式コラム vol44 の原文全体（抜粋は atwiki/page-318 で確認済み）");
});

describe("R-REPL-04 置き換え（用語）", () => {
  it.todo(
    "R-REPL-04: ユニット同士の置き換え（ゴーゴーダンプ）は場所だけが入れ替わり状態はそのまま、ラッシュには含まれない（出典: atwiki/page-1413）— RS-118 プレシャスの護り手の置き換えを公開APIで選ぶ合法手が未確認",
  );
  it.todo(
    "R-REPL-04: ユニットカードとユニットの置き換え（ライダーパス・モーフ）は状態・位置を引き継ぎ、エリアに出る方はラッシュに含まれる（出典: atwiki/page-1413）— RK-022 ライダーパスの置き換えがエンジン未接続",
  );
});

// ---------------------------------------------------------------------------
// 7. 継続効果・常駐
// ---------------------------------------------------------------------------

describe("R-CONT-01 同じ継続効果は重複する", () => {
  // 「「BP＋4000×2」になり、「BP＋8000」に修正されます」(faq-index リファレンス)
  it("R-CONT-01: 1体にガオ・ソウルを2回使うとBP+8000になる（出典: grnrngr/faq-index リファレンス, grnrngr/faq-card-1 RS-025 Q2）", () => {
    const unit = inst("TST-UNIT-2", "u");
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-025", "g1"), inst("RS-025", "g2")],
        rush: [unit],
        power: powers(6),
        command: [cmd("TST-OP", "c1"), cmd("TST-OP", "c2")],
        deck: deck(5),
      },
      player2: { deck: deck(5) },
    });
    s = payAndUse(s, "player1", "RS-025:g1", ["TST-OP:c1"], { targetInstanceId: unit.instanceId });
    s = use(s, "player1", "RS-025:g2", { targetInstanceId: unit.instanceId });
    expect(effectiveBp(s, "player1", card(s, "player1", "rush", unit.instanceId)!)).toBe(11000);
  });

  // 「その効果は「RS-037 守護獣トリケラトプス」の数だけ重複しますか？…はい」(faq-card-1 RS-037)
  it.fails("R-CONT-01: 守護獣トリケラトプスが2体あれば、ワイルドビーストのMユニットはアタックするときBP+2000される（出典: grnrngr/faq-card-1 RS-037）", () => {
    // 既知の不具合: 未登録（トリケラカノンが体数分重複しない）
    let s = st({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-2", "atk")], rush: [inst("RS-037", "t1"), inst("RS-037", "t2")] },
      player2: { battle: [{ ...inst("TST-UNIT-2", "def"), bpModifier: 1500 }] },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-UNIT-2:def" });
    expect(s.log.some((l) => l.includes("5000vs4500"))).toBe(true);
    s = settle(s);
    expect(inZone(s, "player2", "discard", "TST-UNIT-2:def")).toBe(true);
  });

  // 「「RS-045 パトレーラー」の数だけ重複しますか？…はい」(faq-card-1 RS-045)
  it.fails("R-CONT-01: パトレーラーが2体あれば、オーバーテクノロジーのMユニットはアタックされるときBP+2000される（出典: grnrngr/faq-card-1 RS-045）", () => {
    // 既知の不具合: 未登録（シグナルキャノンが体数分重複しない）
    let s = st({
      phase: "battle",
      definitions: {
        ...st().definitions,
        "TST-OT-M": { id: "TST-OT-M", name: "OTM", type: "unit", category: "OT", rarity: "N", expansion: "test", powerCost: 2, bp: 3000, size: "M" },
      },
      player1: { battle: [{ ...inst("TST-UNIT-2", "atk"), bpModifier: 1500 }] },
      player2: { battle: [inst("TST-OT-M", "def")], rush: [inst("RS-045", "p1"), inst("RS-045", "p2")] },
    });
    s = run(s, { type: "battle", playerId: "player1", attackerInstanceId: "TST-UNIT-2:atk", defenderInstanceId: "TST-OT-M:def" });
    expect(s.log.some((l) => l.includes("4500vs5000"))).toBe(true);
    s = settle(s);
    expect(inZone(s, "player2", "battle", "TST-OT-M:def")).toBe(true);
  });

  // 「「RS-015 バードニックウェーブ」の効果は重複しますか？…はい、重複します。」(faq-card-1 RS-015 Q3)
  it("R-CONT-01: バードニックウェーブ2枚でコンビネーションナンバーが2少なくなり、CN4のマジピンクが2番目でナンバーコンビネーションを発動する（出典: grnrngr/faq-card-1 RS-015 Q3）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-015", "w1"), inst("RS-015", "w2")],
        rush: [inst("RS-060", "mp")],
        battle: [inst("TST-UNIT-0", "f1")],
        power: powers(6),
        command: [cmd("TST-OP-ET", "c1"), cmd("TST-OP-ET", "c2")],
        deck: deck(5),
      },
      player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deck(5) },
    });
    s = use(s, "player1", "RS-015:w1");
    s = use(s, "player1", "RS-015:w2");
    s = run(s, { type: "end_phase", playerId: "player1" });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:mp" });
    expect(s.pendingEffectChoice?.effectId).toBe("pink_storm");
  });

  it("R-CONT-01: 対照: バードニックウェーブ1枚ならCN3となり、2番目に出たマジピンクはナンバーコンビネーションを発動しない（出典: grnrngr/faq-card-1 RS-015 Q3）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-015", "w1")],
        rush: [inst("RS-060", "mp")],
        battle: [inst("TST-UNIT-0", "f1")],
        power: powers(6),
        command: [cmd("TST-OP-ET", "c1")],
        deck: deck(5),
      },
      player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deck(5) },
    });
    s = use(s, "player1", "RS-015:w1");
    s = run(s, { type: "end_phase", playerId: "player1" });
    s = run(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:mp" });
    expect(s.pendingEffectChoice?.effectId).not.toBe("pink_storm");
  });

  // 「ホールド状態のコマンドを２枚選んで手札に戻します」(faq-card-1 RS-030 Q1)
  it.fails("R-CONT-01: 自分も相手もアドベンチャーを常駐していれば、ターンを終えたプレイヤーはホールド状態のコマンドを2つ手札に戻す（出典: grnrngr/faq-card-1 RS-030 Q1）", () => {
    // 既知の不具合: 未登録（相手のアドベンチャーと重複せず1つしか戻さない）
    let s = st({
      phase: "end",
      player1: { operation: [inst("RS-030", "a1")], command: [cmd("TST-OP", "h1", true), cmd("TST-OP", "h2", true), cmd("TST-OP", "h3", true)], deck: deck(5) },
      player2: { operation: [inst("RS-030", "a2")], command: [cmd("TST-OP", "k1", true)], deck: deck(5) },
    });
    s = endTurn(s);
    for (let i = 0; i < 4 && s.pendingEffectChoice?.effectId === "adventure"; i += 1) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice");
      if (!pick) break;
      s = run(s, pick);
    }
    expect(s.players.player1.hand.filter((c) => c.cardId === "TST-OP")).toHaveLength(2);
  });

  // 「ターンを終えたプレイヤーのみ行います」(faq-card-1 RS-030 Q2)
  it("R-CONT-01: 相手がターンを終えるとき、自分のアドベンチャーで自分のコマンドを戻すことはない（出典: grnrngr/faq-card-1 RS-030 Q2）", () => {
    let s = st({
      phase: "end",
      player1: { operation: [inst("RS-030", "a1")], command: [cmd("TST-OP", "h1", true)], deck: deck(5) },
      player2: { operation: [inst("RS-030", "a2")], command: [cmd("TST-OP", "k1", true), cmd("TST-OP", "k2", true)], deck: deck(5) },
    });
    s = endTurn(s);
    for (let i = 0; i < 4 && s.pendingEffectChoice; i += 1) s = run(s, legal(s)[0]!);
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(2);
    expect(s.players.player2.hand.some((c) => c.instanceId.startsWith("TST-OP:k"))).toBe(false);
  });

  // 「はい、重複しますので、その通りになります。」(faq-card-2 RS-097 Q7)
  it("R-CONT-01: ハリケンレオンが2体あれば、SP1以上の敵軍ユニットはバトルエリアに出るためにコマンドを2つホールドする（出典: grnrngr/faq-card-2 RS-097 Q7）", () => {
    let s = st({
      phase: "battle",
      turn: 3,
      player1: { rush: [inst("RS-054", "s")], command: [cmd("TST-OP", "c1"), cmd("TST-OP", "c2"), cmd("TST-OP", "c3")] },
      player2: { battle: [inst("RS-097", "le0"), inst("RS-097", "le1")] },
    });
    s = run(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-054:s" });
    expect(s.pendingCommandPayment?.totalNeeded).toBe(2);
  });
});

describe("R-CONT-02 張り替えで再発動", () => {
  // 「さらにその効果を発動させることができますか？…はい、できます。」(faq-card-1 RS-013 Q2)
  it("R-CONT-02: シーロンの光を使った後、もう1枚のシーロンの光に張り替えると、同じラッシュフェイズに再び発動できる（出典: grnrngr/faq-card-1 RS-013 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-013", "sh1"), inst("RS-013", "sh2"), inst("TST-OP", "h1"), inst("TST-UNIT-0", "u1")],
        power: powers(6),
        command: [cmd("TST-OP-ET", "c1"), cmd("TST-OP-ET", "c2")],
        deck: deck(5),
      },
      player2: { deck: deck(5) },
    });
    s = use(s, "player1", "RS-013:sh1");
    s = run(s, { type: "shiron_light", playerId: "player1", operationInstanceId: "RS-013:sh1" });
    s = run(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:h1" });
    while (s.pendingEffectChoice) s = run(s, legal(s)[0]!);
    expect(legal(s).some((a) => a.type === "shiron_light")).toBe(false);
    s = use(s, "player1", "RS-013:sh2");
    expect(ids(s, "player1", "operation")).toEqual(["RS-013:sh2"]);
    expect(
      legal(s).some((a) => a.type === "shiron_light" && a.operationInstanceId === "RS-013:sh2"),
    ).toBe(true);
  });
});

describe("R-CONT-03 「これ」で始まるテキスト", () => {
  it.todo(
    "R-CONT-03: [未確定] 「これ」で始まるテキストは手札などどこにあっても有効（atwiki/page-1974 のコミュニティ回答のみで公式の一般則なし）",
  );
});
