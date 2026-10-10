/**
 * カード別スペック: RS-081〜RS-090（第2弾「二人の黒騎士」）
 * 出典の優先順位と方針は RS2-071-096.part1.test.ts 冒頭を参照。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attack,
  bpOf,
  canEnter,
  canStrike,
  chooseCommand,
  drainChoices,
  endTurn,
  enter,
  expectBodyText,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  playOp,
  powerCards,
  released,
  releasedN,
  settle,
  st,
  strikeDamage,
  sUnit,
  toBattle,
  tryZordRush,
  zoneOf,
} from "./RS2-071-096.helpers";
import type { CardInstance, GameState, PlayerId } from "../types/game";

function expectStats(
  id: string,
  stats: {
    name: string;
    category: string;
    size: string;
    bp: number;
    sp: number | "special" | undefined;
    powerCost: number | string;
    comboNumber?: number;
    features?: string[];
  },
) {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features ?? []);
}

function canUseCounter(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return legal(s).some(
    (a) =>
      (a.type === "initiate_command_payment" && a.playerId === playerId && a.sourceInstanceId === instanceId) ||
      (a.type === "play_counter" && a.playerId === playerId && a.instanceId === instanceId),
  );
}


function heldCount(s: GameState, playerId: PlayerId): number {
  return s.players[playerId].command.filter((c) => c.commandHeld).length;
}

/** ダメージ（ウラ向き）のパワーカード。 */
function dmg(suffix: string, cardId = "TST-P"): CardInstance {
  return { ...inst(cardId, suffix), faceDown: true };
}

const EXTRA = [
  sUnit("SPEC-S-5000", { bp: 5000, sp: undefined }),
  sUnit("SPEC-S-7000", { bp: 7000, sp: undefined }),
  sUnit("SPEC-S-9000", { bp: 9000, sp: undefined }),
  sUnit("SPEC-M-OT", { size: "M", bp: 3000, sp: undefined, category: "OT" }),
  sUnit("SPEC-L", { size: "L", bp: 3000, sp: undefined }),
];

// ===========================================================================
describe("RS-081 ティラノレンジャー", () => {
  const TEXT = "【龍撃剣】このターン、これはホールド状態の敵軍コマンド1つにつきBP＋1000される。これはBP5000以上のとき「SP1」になる。";

  it("RS-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-230）", () => {
    expectBodyText("RS-081", TEXT);
    expectStats("RS-081", {
      name: "ティラノレンジャー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 4,
      features: ["レッド", "男"],
    });
  });

  function tyranno(enemyHeld: number, battle = 3, extra: Partial<GameState["players"]["player2"]> = {}) {
    return st({
      player1: { battle: fillers(battle), rush: [inst("RS-081", "t")] },
      player2: {
        command: [...Array.from({ length: enemyHeld }, (_, i) => held("TST-OP", `h${i}`)), released("TST-OP", "r0")],
        power: powerCards(3, "e"),
        ...extra,
      },
    });
  }

  // 「ホールド状態の敵軍コマンド1つにつきBP＋1000」「BP5000以上のとき「SP1」」
  it("RS-081: 4番目に出ると、ホールド状態の敵軍コマンド2つで BP5000 になり SP1（ストライクで1点）（出典: atwiki/page-230）", () => {
    const s = enter(tyranno(2), "RS-081:t");
    expect(bpOf(s, "player1", "RS-081:t")).toBe(5000);
    expect(strikeDamage(s, "RS-081:t")).toBe(1);
  });

  it("RS-081: ホールド状態の敵軍コマンドが1つなら BP4000 で SP を得ない（リリース状態は数えない）（出典: atwiki/page-230）", () => {
    const s = enter(tyranno(1), "RS-081:t");
    expect(bpOf(s, "player1", "RS-081:t")).toBe(4000);
    expect(canStrike(s, "RS-081:t")).toBe(false);
  });

  // 「CN：4」
  it("RS-081: 4番目以外（1番目）では龍撃剣は発動しない（BP3000）（出典: atwiki/page-230「CN：4」）", () => {
    const s = enter(tyranno(3, 0), "RS-081:t");
    expect(bpOf(s, "player1", "RS-081:t")).toBe(3000);
    expect(canStrike(s, "RS-081:t")).toBe(false);
  });

  // 「このターン」
  it("RS-081: 龍撃剣は「このターン」だけ — 相手のターンには BP+ されない（出典: atwiki/page-230）", () => {
    let s = enter(tyranno(2), "RS-081:t");
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    const t = s.players.player1.battle.find((c) => c.instanceId === "RS-081:t") ?? s.players.player1.rush.find((c) => c.instanceId === "RS-081:t");
    expect(t).toBeDefined();
    expect(bpOf(s, "player1", "RS-081:t")).toBe(3000);
  });

  // faq-card-2 RS-081 Q1「…ホールドしたコマンドの分もＢＰ+1000されますか？」「はい…即座に更新されると考えてください。」
  it("RS-081: 公式Q&A — 発動後に相手がカウンターのためにホールドしたコマンドの分も BP+1000 される（出典: grnrngr/faq-card-2 RS-081 Q1）", () => {
    let s = enter(
      tyranno(1, 3, {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [inst("RS-006", "gym")],
        command: [held("TST-OP", "h0"), released("TST-OP-ET", "et")],
        power: powerCards(3, "e"),
      }),
      "RS-081:t",
    );
    expect(bpOf(s, "player1", "RS-081:t")).toBe(4000);
    s = attack(s, "RS-081:t", "TST-UNIT-0:def");
    expect(canUseCounter(s, "player2", "RS-006:gym")).toBe(true);
    s = act(s, legal(s).find(
      (a) => (a.type === "initiate_command_payment" || a.type === "play_counter") && a.playerId === "player2" &&
        ("sourceInstanceId" in a ? a.sourceInstanceId === "RS-006:gym" : "instanceId" in a && a.instanceId === "RS-006:gym"),
    )!);
    expect(heldCount(s, "player2")).toBe(2);
    expect(bpOf(s, "player1", "RS-081:t")).toBe(5000);
  });

  // faq-card-2 RS-081 Q2「…BPを上昇させる効果で一定以上になった場合も「SP１」になりますか？」「はい」
  it("RS-081: 公式Q&A — 龍撃剣が発動しているとき、ガオ・ソウルで BP5000以上になれば SP1（出典: grnrngr/faq-card-2 RS-081 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        battle: fillers(3),
        rush: [inst("RS-081", "t")],
        hand: [inst("RS-025", "soul")],
        command: [released("TST-OP", "wb")],
        power: powerCards(3),
      },
      player2: { power: powerCards(3, "e") },
    });
    const r = playOp(s, "player1", "RS-025:soul", "RS-081:t");
    expect(r.ok).toBe(true);
    s = enter(toBattle(r.state), "RS-081:t");
    expect(bpOf(s, "player1", "RS-081:t")).toBe(7000);
    expect(strikeDamage(s, "RS-081:t")).toBe(1);
  });

  // atwiki/page-230 コメント（コミュニティ回答）「ナンバーに4とあるので、4番目に並んでいないと5000以上になってもSP1にはなりません」
  it("RS-081: 4番目でなければ、ガオ・ソウルで BP5000以上でも SP1 にならない（出典: atwiki/page-230 コメント欄の回答）", () => {
    let s = st({
      phase: "rush",
      player1: {
        rush: [inst("RS-081", "t")],
        hand: [inst("RS-025", "soul")],
        command: [released("TST-OP", "wb")],
        power: powerCards(3),
      },
      player2: { power: powerCards(3, "e") },
    });
    s = enter(toBattle(playOp(s, "player1", "RS-025:soul", "RS-081:t").state), "RS-081:t");
    expect(bpOf(s, "player1", "RS-081:t")).toBe(7000);
    expect(canStrike(s, "RS-081:t")).toBe(false);
  });
});

// ===========================================================================
describe("RS-082 トリケラレンジャー", () => {
  it("RS-082: カタログ本文・スペックが出典と一致（出典: atwiki/page-231）", () => {
    expectBodyText("RS-082", "【トリケランス】敵軍コマンドを1つ選んでホールドする。");
    expectStats("RS-082", {
      name: "トリケラレンジャー",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 3,
      features: ["ブルー", "男"],
    });
  });

  function tricera(battle: number) {
    return st({
      player1: { battle: fillers(battle), rush: [inst("RS-082", "tr")] },
      player2: { command: [released("TST-OP", "c1"), released("TST-OP-ET", "c2")] },
    });
  }

  // 「敵軍コマンドを1つ選んでホールドする」
  it("RS-082: 3番目に出ると、敵軍コマンドを1つ選ぶ選択が開く（敵軍コマンドが候補）（出典: atwiki/page-231）", () => {
    const s = enter(tricera(2), "RS-082:tr");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(expect.arrayContaining(["TST-OP:c1", "TST-OP-ET:c2"]));
  });

  it("RS-082: 選んだ敵軍コマンドがホールドされる（選んだものだけ）（出典: atwiki/page-231）", () => {
    let s = enter(tricera(2), "RS-082:tr");
    s = chooseCommand(s, "player1", "TST-OP-ET:c2");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP-ET:c2")?.commandHeld).toBe(true);
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:c1")?.commandHeld ?? false).toBe(false);
  });

  it("RS-082: 「選んでホールドする」は任意ではない（スキップできない）（出典: atwiki/page-231）", () => {
    const s = enter(tricera(2), "RS-082:tr");
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(0);
  });

  it("RS-082: 3番目以外では発動しない（出典: atwiki/page-231「CN：3」）", () => {
    const s = enter(tricera(0), "RS-082:tr");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(heldCount(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RS-083 プテラレンジャー", () => {
  it("RS-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-232）", () => {
    expectBodyText("RS-083", "【プテラアロー】敵軍コマンドゾーンからホールド状態のカードを1枚選んで捨札にする。");
    expectStats("RS-083", {
      name: "プテラレンジャー",
      category: "WB",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 5,
      features: ["ピンク", "女"],
    });
  });

  function ptera(battle: number, cmds: CardInstance[]) {
    return st({
      player1: { battle: fillers(battle), rush: [inst("RS-083", "pt")] },
      player2: { command: cmds },
    });
  }

  // 「敵軍コマンドゾーンからホールド状態のカードを1枚選んで捨札にする」
  it("RS-083: 5番目に出ると、ホールド状態の敵軍コマンドを1枚選んで捨札にする（リリース状態は選べない）（出典: atwiki/page-232）", () => {
    let s = enter(ptera(4, [held("TST-OP", "h1"), held("TST-OP-ET", "h2"), released("TST-OP", "r1")]), "RS-083:pt");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(expect.arrayContaining(["TST-OP:h1", "TST-OP-ET:h2"]));
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("TST-OP:r1");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP-ET:h2" });
    expect(zoneOf(s, "player2", "TST-OP-ET:h2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:h1")).toBe("command");
  });

  it("RS-083: ホールド状態の敵軍コマンドがなければ何も捨札にならない（出典: atwiki/page-232）", () => {
    const s = settle(enter(ptera(4, [released("TST-OP", "r1")]), "RS-083:pt"));
    expect(zoneOf(s, "player2", "TST-OP:r1")).toBe("command");
  });

  it("RS-083: 5番目以外では発動しない（出典: atwiki/page-232「CN：5」）", () => {
    const s = enter(ptera(2, [held("TST-OP", "h1")]), "RS-083:pt");
    expect(zoneOf(s, "player2", "TST-OP:h1")).toBe("command");
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-084 VRVロボ", () => {
  const TEXT = "合体―Vファイヤー＋Vポリス＋Vダンプ＋Vドーザー＋Vレスキュー【必勝合体】これをラッシュしたとき、相手に2点ダメージを与える。";
  const PARTS = ["RS-085", "RS-086", "RS-087", "RS-088", "RS-089"];

  it("RS-084: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-297）", () => {
    expectBodyText("RS-084", TEXT);
    expectStats("RS-084", {
      name: "VRVロボ",
      category: "OT",
      size: "L",
      bp: 18000,
      sp: 1,
      powerCost: "8+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-084"]!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });

  function vrvState(parts: string[], power = 8) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-084", "vrv")],
        rush: parts.map((id) => inst(id, "p")),
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(power),
      },
      player2: { power: powerCards(4, "e") },
    });
  }

  // 「合体―Vファイヤー＋…」「※これは「Vファイヤー」としてつかえる」等（RS-085〜089）
  it("RS-084: ファイヤー／ポリス／ダンプ／ドーザー／レスキューファイターを捨札にしてラッシュでき、【必勝合体】で相手に2点ダメージ（出典: atwiki/page-297、page-298〜302）", () => {
    const r = tryZordRush(vrvState(PARTS), "RS-084:vrv", { materials: PARTS.map((id) => `${id}:p`) });
    expect(r.ok).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "RS-084:vrv")).toBe("rush");
    for (const id of PARTS) expect(zoneOf(s, "player1", `${id}:p`)).toBe("discard");
    expect(s.players.player2.damage).toBe(2);
    expect(s.players.player1.damage).toBe(0);
  });

  it("RS-084: 素材が1体でも欠けているとラッシュできない（出典: atwiki/page-297）", () => {
    const r = tryZordRush(vrvState(PARTS.slice(0, 4)), "RS-084:vrv", { materials: PARTS.map((id) => `${id}:p`) });
    expect(r.ok && zoneOf(r.state, "player1", "RS-084:vrv") === "rush").toBe(false);
  });

  it("RS-084: 必要パワー8+（パワー7ではラッシュできない）（出典: atwiki/page-297）", () => {
    const r = tryZordRush(vrvState(PARTS, 7), "RS-084:vrv", { materials: PARTS.map((id) => `${id}:p`) });
    expect(r.ok && zoneOf(r.state, "player1", "RS-084:vrv") === "rush").toBe(false);
  });
});

// ===========================================================================
describe("RS-085 ファイヤーファイター", () => {
  const TEXT =
    "※これは「Vファイヤー」としてつかえる。【消火作業】これをラッシュしたとき、自軍パワーゾーンからダメージになっているカードをウラ向きのまま1枚選んでオモテにしてもよい。そうしたとき、相手も同じようにしてもよい。";

  it("RS-085: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-298）", () => {
    expectBodyText("RS-085", TEXT);
    expectStats("RS-085", {
      name: "ファイヤーファイター",
      category: "OT",
      size: "M",
      bp: 4000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-085"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_power");
  });

  function fireState(own: number, enemy: number, extra: Partial<GameState["players"]["player1"]> = {}) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-085", "ff")],
        rush: [inst("TST-UNIT-0", "s")],
        command: [released("TST-OP-OT", "ot")],
        power: [...powerCards(7), ...Array.from({ length: own }, (_, i) => dmg(`d${i}`))],
        damage: own,
        ...extra,
      },
      player2: {
        power: [...powerCards(2, "e"), ...Array.from({ length: enemy }, (_, i) => dmg(`ed${i}`))],
        damage: enemy,
      },
    });
  }
  function rushFire(s: GameState) {
    const r = tryZordRush(s, "RS-085:ff", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    return r.state;
  }
  function faceDownCount(s: GameState, pid: PlayerId) {
    return s.players[pid].power.filter((c) => c.faceDown).length;
  }

  // 「追加条件：自軍Sユニットを1体パワーゾーンに送る」
  it("RS-085: 追加条件で自軍Sユニットをパワーゾーンに送ってラッシュする（出典: atwiki/page-298）", () => {
    const s = rushFire(fireState(0, 0));
    expect(zoneOf(s, "player1", "RS-085:ff")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("power");
  });

  // 「ダメージになっているカードを…1枚選んでオモテにしてもよい。そうしたとき、相手も同じようにしてもよい」
  it("RS-085: 自分がダメージ1枚をオモテにし、相手も同じようにすると、双方のダメージが1点ずつ減る（出典: atwiki/page-298）", () => {
    // 自分・相手とも選んでオモテにする（「1枚選んで」）。
    const s = drainChoices(rushFire(fireState(2, 1)));
    expect(faceDownCount(s, "player1")).toBe(1);
    expect(faceDownCount(s, "player2")).toBe(0);
    expect(s.players.player1.damage).toBe(1);
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-085: 自分はオモテにしないことを選べる（「してもよい」）（出典: atwiki/page-298）", () => {
    let s = rushFire(fireState(2, 1));
    // ラッシュ後、自分の消火作業を辞退する選択肢が提示される
    expect(legal(s).some((a) => a.playerId === "player1" && a.type === "skip_effect_choice")).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    // 辞退すると自分も相手もオモテにしない（「そうしたとき」）
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(faceDownCount(s, "player1")).toBe(2);
    expect(faceDownCount(s, "player2")).toBe(1);
  });

  it("RS-085: 自分がオモテにしたとき、相手はオモテにしないことを選べる（「相手も同じようにしてもよい」）（出典: atwiki/page-298）", () => {
    let s = rushFire(fireState(1, 1));
    // まず自分がダメージを1枚選んでオモテにする
    const own = s.pendingEffectChoice?.validInstanceIds?.[0];
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: own! });
    const p2Decline = legal(s).some((a) => a.playerId === "player2" && a.type === "skip_effect_choice");
    expect(p2Decline).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player2" });
    expect(faceDownCount(s, "player1")).toBe(0);
    expect(faceDownCount(s, "player2")).toBe(1);
  });

  // faq-card-2 RS-085 Q1「相手がダメージを受けていなくても発動できますか？」「はい…「そうしたとき」よりも後のテキストは、条件ではありません。」
  it("RS-085: 公式Q&A — 相手がダメージを受けていなくても自分のダメージをオモテにできる（出典: grnrngr/faq-card-2 RS-085 Q1）", () => {
    const s = drainChoices(rushFire(fireState(1, 0)));
    expect(s.players.player1.damage).toBe(0);
    expect(faceDownCount(s, "player1")).toBe(0);
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-085: 自分にダメージがなければ（オモテにしないので）相手もオモテにしない（出典: atwiki/page-298「そうしたとき」）", () => {
    const s = rushFire(fireState(0, 1));
    expect(s.players.player2.damage).toBe(1);
    expect(faceDownCount(s, "player2")).toBe(1);
  });

  // faq-card-2 RS-105 Q3「…「オーバーテクノロジー」のコマンドを２つホールドします。」（ファイヤーファイター＋デカベースクローラー）
  it("RS-085: 公式Q&A — Sユニットがなくデカベースクローラーで追加条件を満たすと、OT コマンドを2つホールドする（出典: grnrngr/faq-card-2 RS-105 Q3）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-085", "ff")],
        rush: [inst("RS-105", "deka")],
        command: releasedN(3, "TST-OP-OT", "o"),
        power: powerCards(7),
      },
    });
    const r = tryZordRush(s0, "RS-085:ff", { mothership: true });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-085:ff")).toBe("rush");
    expect(heldCount(r.state, "player1")).toBe(2);
  });

  // 「SP：1」
  it("RS-085: SP1（バトルエリアからストライクで1点）（出典: atwiki/page-298）", () => {
    const s = st({ player1: { battle: [inst("RS-085", "ff")] }, player2: { power: powerCards(3, "e") } });
    expect(strikeDamage(s, "RS-085:ff")).toBe(1);
  });
});

// ===========================================================================
describe("RS-086 ポリスファイター", () => {
  const TEXT =
    "※これは「Vポリス」としてつかえる。【交通整理】これが自軍バトルエリアにあるとき、相手は次の制限を受ける。バトルエリアに並べるユニットはすべて同じサイズでなければならない。";

  it("RS-086: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-299）", () => {
    expectBodyText("RS-086", TEXT);
    expectStats("RS-086", {
      name: "ポリスファイター",
      category: "OT",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-086"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_power");
  });

  function police(p2: Partial<GameState["players"]["player2"]>, policeZone: "battle" | "rush" = "battle") {
    return st({
      activePlayer: "player2",
      player1: { [policeZone]: [inst("RS-086", "pol")] },
      player2: p2,
    }, EXTRA);
  }

  // 「バトルエリアに並べるユニットはすべて同じサイズでなければならない」
  it("RS-086: 相手のバトルエリアに S ユニットがあれば、相手は M ユニットを出せず、S ユニットは出せる（出典: atwiki/page-299）", () => {
    const s = police({ battle: [inst("TST-UNIT-0", "s1")], rush: [inst("TST-UNIT-2", "m"), inst("TST-UNIT-0", "s2")] });
    expect(canEnter(s, "TST-UNIT-2:m", "player2")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:s2", "player2")).toBe(true);
  });

  it("RS-086: 相手のバトルエリアが空なら、最初のユニットはどのサイズでも出せる（出典: atwiki/page-299）", () => {
    const s = police({ rush: [inst("TST-UNIT-2", "m")] });
    expect(canEnter(s, "TST-UNIT-2:m", "player2")).toBe(true);
  });

  it("RS-086: ポリスファイターがラッシュエリアにあるときは制限しない（出典: atwiki/page-299「これが自軍バトルエリアにあるとき」）", () => {
    const s = police({ battle: [inst("TST-UNIT-0", "s1")], rush: [inst("TST-UNIT-2", "m")] }, "rush");
    expect(canEnter(s, "TST-UNIT-2:m", "player2")).toBe(true);
  });

  it("RS-086: 制限を受けるのは相手だけ（自軍は異なるサイズを並べられる）（出典: atwiki/page-299「相手は次の制限を受ける」）", () => {
    const s = st({
      player1: { battle: [inst("RS-086", "pol")], rush: [inst("TST-UNIT-0", "s")] },
    });
    expect(canEnter(s, "TST-UNIT-0:s")).toBe(true);
  });

  // faq-card-2 RS-086 Q1「…それ以降はいかなるサイズのユニットであってもバトルエリアに出すことができなくなります。」
  it.fails("RS-086: 公式Q&A — 相手のバトルエリアにすでに違うサイズのユニットが並んでいれば、以後どのサイズのユニットも出せない（出典: grnrngr/faq-card-2 RS-086 Q1）", () => {
    // 既知の不具合: CARD-RS-086 交通整理がバトルエリア1体目のサイズとだけ比べるため、既にサイズが混在していても1体目と同じサイズなら出せてしまう
    const s = police({
      battle: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-2", "m1")],
      rush: [inst("TST-UNIT-0", "s2"), inst("TST-UNIT-2", "m2")],
    });
    expect(canEnter(s, "TST-UNIT-0:s2", "player2")).toBe(false);
    expect(canEnter(s, "TST-UNIT-2:m2", "player2")).toBe(false);
  });
});

// ===========================================================================
describe("RS-087 ダンプファイター", () => {
  const TEXT = "※これは「Vダンプ」としてつかえる。【ダンプパンチ】これはアタックするときBP＋2000される。";

  it("RS-087: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-300）", () => {
    expectBodyText("RS-087", TEXT);
    expectStats("RS-087", {
      name: "ダンプファイター",
      category: "OT",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-087"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_power");
  });

  // 「これはアタックするときBP＋2000される」
  it("RS-087: アタックするとき BP8000 として BP7000 の敵軍ユニットを撃破する（出典: atwiki/page-300）", () => {
    const s0 = st({
      player1: { battle: [inst("RS-087", "dump")] },
      player2: { battle: [inst("SPEC-S-7000", "e")] },
    }, EXTRA);
    const s = settle(attack(s0, "RS-087:dump", "SPEC-S-7000:e"));
    expect(zoneOf(s, "player2", "SPEC-S-7000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-087:dump")).toBe("battle");
  });

  it("RS-087: アタックされたとき（相手ターン）は BP6000 のまま — BP7000 の敵軍ユニットに撃破される（出典: atwiki/page-300 カード評価「相手ターン時にはBPが6000」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-087", "dump")] },
      player2: { battle: [inst("SPEC-S-7000", "e")] },
    }, EXTRA);
    const s = settle(attack(s0, "SPEC-S-7000:e", "RS-087:dump", "player2"));
    expect(zoneOf(s, "player1", "RS-087:dump")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-088 ドーザーファイター", () => {
  const TEXT =
    "※これは「Vドーザー」としてつかえる。【解体作業】これをラッシュしたとき、自軍パワーゾーンからダメージになっているカードをウラ向きのまま1枚選んで手札に加えてもよい。そうしたとき、手札から1枚選んでパワーゾーンにウラ向きに置く。";

  it("RS-088: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-301）", () => {
    expectBodyText("RS-088", TEXT);
    expectStats("RS-088", {
      name: "ドーザーファイター",
      category: "OT",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-088"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_power");
  });

  function dozerState(hand: CardInstance[]) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-088", "dz"), ...hand],
        rush: [inst("TST-UNIT-0", "s")],
        command: [released("TST-OP-OT", "ot")],
        power: [...powerCards(4), dmg("x", "RS-080")],
        damage: 1,
      },
    });
  }
  function rushDozer(s: GameState) {
    const r = tryZordRush(s, "RS-088:dz", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    return r.state;
  }

  // 「ダメージになっているカードを…手札に加えてもよい。そうしたとき、手札から1枚選んでパワーゾーンにウラ向きに置く」
  it("RS-088: ダメージのカードを手札に加え、手札のカードをウラ向き（ダメージ）でパワーゾーンに置く（ダメージ数は変わらない）（出典: atwiki/page-301）", () => {
    // 手札から置くカード（TST-OP:y）を選ぶ
    const s = drainChoices(rushDozer(dozerState([inst("TST-OP", "y")])), ["TST-OP:y"]);
    expect(zoneOf(s, "player1", "RS-080:x")).toBe("hand");
    const y = s.players.player1.power.find((c) => c.instanceId === "TST-OP:y");
    expect(y?.faceDown).toBe(true);
    expect(s.players.player1.damage).toBe(1);
  });

  it("RS-088: 手札に加えないことを選べる（「してもよい」）（出典: atwiki/page-301）", () => {
    let s = rushDozer(dozerState([inst("TST-OP", "y")]));
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "RS-080:x")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP:y")).toBe("hand");
  });

  it("RS-088: パワーゾーンに置く手札のカードを選べる（「手札から1枚選んで」）（出典: atwiki/page-301）", () => {
    const s = rushDozer(dozerState([inst("TST-OP", "y"), inst("TST-OP-ET", "z")]));
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).toEqual(expect.arrayContaining(["TST-OP:y", "TST-OP-ET:z"]));
  });
});

// ===========================================================================
describe("RS-089 レスキューファイター", () => {
  const TEXT =
    "※これは「Vレスキュー」としてつかえる。【救護活動】これが自軍ラッシュエリアにあるとき、WBの自軍Mユニットは、撃破されたとき捨札にするかわりに自軍パワーゾーンに送る。";

  it("RS-089: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-302）", () => {
    expectBodyText("RS-089", TEXT);
    expectStats("RS-089", {
      name: "レスキューファイター",
      category: "OT",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-089"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_power");
  });

  /** 自軍の attacker が BP5000 の敵軍ユニットにアタックして撃破される。 */
  function rescued(attacker: CardInstance, rescueZone: "rush" | "battle" = "rush") {
    const s0 = st({
      player1: {
        battle: rescueZone === "battle" ? [inst("RS-089", "rf"), attacker] : [attacker],
        rush: rescueZone === "rush" ? [inst("RS-089", "rf")] : [],
      },
      player2: { battle: [inst("SPEC-S-5000", "e")] },
    }, EXTRA);
    return settle(attack(s0, attacker.instanceId, "SPEC-S-5000:e"));
  }

  // 「WBの自軍Mユニットは、撃破されたとき捨札にするかわりに自軍パワーゾーンに送る」
  it("RS-089: ラッシュエリアにあるとき、撃破された WB の自軍 M ユニットは捨札ではなく自軍パワーゾーン（オモテ向き）へ（出典: atwiki/page-302）", () => {
    const s = rescued(inst("TST-UNIT-2", "wbm"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:wbm")).toBe("power");
    expect(s.players.player1.power.find((c) => c.instanceId === "TST-UNIT-2:wbm")?.faceDown ?? false).toBe(false);
    expect(s.players.player1.damage).toBe(0);
  });

  it("RS-089: WB 以外の M ユニット、WB の S ユニットは通常どおり捨札（出典: atwiki/page-302）", () => {
    expect(zoneOf(rescued(inst("SPEC-M-OT", "otm")), "player1", "SPEC-M-OT:otm")).toBe("discard");
    expect(zoneOf(rescued(inst("TST-UNIT-0", "wbs")), "player1", "TST-UNIT-0:wbs")).toBe("discard");
  });

  it("RS-089: レスキューファイターがバトルエリアにあるときは適用しない（出典: atwiki/page-302「これが自軍ラッシュエリアにあるとき」）", () => {
    expect(zoneOf(rescued(inst("TST-UNIT-2", "wbm"), "battle"), "player1", "TST-UNIT-2:wbm")).toBe("discard");
  });

  // faq-card-2 RS-089 Q1「…「RS-052 爆竜トリケラトプス」自身は撃破扱いにならないためです。」
  it("RS-089: 公式Q&A — 超シールド進化でかわりに捨札にした爆竜トリケラトプスはパワーゾーンに送られない（出典: grnrngr/faq-card-2 RS-089 Q1）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("TST-UNIT-0", "wb"), inst("RS-052", "tri")],
        rush: [inst("RS-089", "rf")],
        power: powerCards(3, "e"),
      },
    });
    s = attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:wb");
    expect(legalOfType(s, "use_super_shield")).toHaveLength(1);
    s = settle(act(s, legalOfType(s, "use_super_shield")[0]!));
    expect(zoneOf(s, "player2", "RS-052:tri")).toBe("discard");
  });

  // faq-card-2 RS-089 Q2「…持ち主のパワーゾーンにオモテ向きに置かれます。」
  it("RS-089: 公式Q&A — 敵軍レスキューファイターがあるとき、ジャイアントローラーの対象とバトルして撃破された WB の敵軍 M ユニットは、ダメージにならずオモテ向きで持ち主のパワーゾーンへ（出典: grnrngr/faq-card-2 RS-089 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        battle: [inst("SPEC-S-9000", "big")],
        hand: [inst("RS-182", "roller")],
        command: [released("TST-OP-MA", "ma")],
        power: powerCards(6),
      },
      player2: { battle: [inst("TST-UNIT-2", "wbm")], rush: [inst("RS-089", "rf")], power: powerCards(2, "e") },
    }, EXTRA);
    const r = playOp(s, "player1", "RS-182:roller", "SPEC-S-9000:big");
    expect(r.ok).toBe(true);
    s = toBattle(r.state);
    s = settle(attack(s, "SPEC-S-9000:big", "TST-UNIT-2:wbm"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:wbm")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-2:wbm")?.faceDown ?? false).toBe(false);
    expect(s.players.player2.damage).toBe(0);
  });

  // faq-card-2 RS-089 Q3「…正確にはターンプレイヤーが、捨札にするかパワーゾーンに送るかを選択できます。」
  it.todo(
    "RS-089: 公式Q&A — 守護獣プテラノドンとレスキューファイターが隠流忍術で相撃ちになったとき、ターンプレイヤーが処理順（＝プテラノドンを捨札にするかパワーゾーンに送るか）を選べる（出典: grnrngr/faq-card-2 RS-089 Q3）— 同時撃破の処理順を選ぶ公開 API がない（一般ルール側の不一致として rulesSpec の R-BTL-02／R-PRI-02 が扱う）",
  );
});

// ===========================================================================
describe("RS-090 レッドレーサー", () => {
  const TEXT =
    "※これはラッシュするとき可能ならバトルエリアに置く。※これはラッシュしたターンにアタックできない。※これはラッシュしたターンにストライクできない。【フェンダーソード】「SP1」";

  it("RS-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-303）", () => {
    expectBodyText("RS-090", TEXT);
    expectStats("RS-090", {
      name: "レッドレーサー",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 2,
      comboNumber: 4,
      features: ["レッド", "男"],
    });
  });

  function rushRacer(extra: { p1?: Partial<GameState["players"]["player1"]>; p2?: Partial<GameState["players"]["player2"]> } = {}) {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-090", "rr")],
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(2),
        ...extra.p1,
      },
      player2: { power: powerCards(3, "e"), ...extra.p2 },
    }, EXTRA);
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-090:rr" });
    for (let i = 0; i < 4 && s.pendingCommandPayment; i += 1) {
      const p = s.pendingCommandPayment;
      s = act(s, { type: "resolve_command_payment", playerId: p.playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    return settle(s);
  }

  // 「※これはラッシュするとき可能ならバトルエリアに置く。」
  it("RS-090: ラッシュするとバトルエリアに置かれる（出典: atwiki/page-303）", () => {
    const s = rushRacer();
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("battle");
  });

  // 「※これはラッシュしたターンにアタックできない。」「※これはラッシュしたターンにストライクできない。」
  it("RS-090: ラッシュしたターンはアタックもストライクもできない（出典: atwiki/page-303）", () => {
    const s = toBattle(rushRacer({ p2: { battle: [inst("TST-UNIT-0", "e")] } }));
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("battle");
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-090:rr")).toBe(false);
    expect(canStrike(s, "RS-090:rr")).toBe(false);
  });

  // 「【フェンダーソード】「SP1」」「CN：4」
  it("RS-090: ラッシュしたターン以外に4番目に出るとフェンダーソードで SP1（ストライクで1点）（出典: atwiki/page-303）", () => {
    const s = enter(st({ player1: { battle: fillers(3), rush: [inst("RS-090", "rr")] }, player2: { power: powerCards(3, "e") } }), "RS-090:rr");
    expect(strikeDamage(s, "RS-090:rr")).toBe(1);
  });

  it("RS-090: 4番目以外（1番目）ではストライクできない（出典: atwiki/page-303「SP：！」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-090", "rr")] }, player2: { power: powerCards(3, "e") } }), "RS-090:rr");
    expect(canStrike(s, "RS-090:rr")).toBe(false);
  });

  // faq-card-2 RS-090 Q1（ハリケンレオン）「…コマンドを１つホールドしてバトルエリアに出さなければなりません…なければ…ラッシュエリアに置かれます。」
  it("RS-090: 公式Q&A — 敵軍ハリケンレオンがあるとき、ホールドできるコマンドがあれば1つホールドしてバトルエリアに出す（出典: grnrngr/faq-card-2 RS-090 Q1）", () => {
    const s = rushRacer({
      p1: { command: [released("TST-OP-OT", "ot"), released("TST-OP", "extra")] },
      p2: { battle: [inst("RS-097", "leon")] },
    });
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("battle");
    expect(heldCount(s, "player1")).toBe(2);
  });

  it("RS-090: 公式Q&A — 敵軍ハリケンレオンがあり、ホールドできるコマンドがなければラッシュエリアに置かれる（出典: grnrngr/faq-card-2 RS-090 Q1）", () => {
    const s = rushRacer({ p2: { battle: [inst("RS-097", "leon")] } });
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("rush");
  });

  // faq-card-2 RS-090 Q2「…ラッシュエリアに出した後で、可能であればバトルエリアに置いてください。」
  it("RS-090: 公式Q&A — ランドバルカンでコマンドゾーンからラッシュエリアに出したときも、可能ならバトルエリアに置く（出典: grnrngr/faq-card-2 RS-090 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-005", "lv")],
        command: [released("TST-OP-ET", "et"), released("RS-090", "rr")],
        power: powerCards(3),
      },
    });
    const r = playOp(s, "player1", "RS-005:lv");
    expect(r.ok).toBe(true);
    s = r.state;
    for (let i = 0; i < 4 && s.pendingEffectChoice; i += 1) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" && a.instanceId === "RS-090:rr") ??
        legal(s).find((a) => a.type === "confirm_effect_choice");
      if (!pick) break;
      s = act(s, pick);
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("battle");
  });

  // faq-card-2 RS-090 Q3「はい、発動します。」（レッドレーサーに続けて CN2 のユニットの NC）
  it("RS-090: 公式Q&A — ラッシュしてバトルエリアに置いたレッドレーサーに続けて、CN2 のユニット（アバレッド）の NC が発動する（出典: grnrngr/faq-card-2 RS-090 Q3）", () => {
    let s = rushRacer({ p1: { rush: [inst("RS-054", "abared")] } });
    s = toBattle(s);
    s = enter(s, "RS-054:abared");
    expect(canStrike(s, "RS-054:abared")).toBe(true);
  });

  // faq-card-2 RS-090 Q4「はい、出来ます…ラッシュするユニットはラッシュエリアに配置します。」
  it("RS-090: 公式Q&A — バトルエリアに置いた直後のレッドレーサーを、追加条件の自軍Sユニットとして使える（ラッシュするユニットはラッシュエリアへ）（出典: grnrngr/faq-card-2 RS-090 Q4）", () => {
    let s = rushRacer({
      p1: {
        hand: [inst("RS-090", "rr"), inst("RS-074", "cosmo")],
        command: [released("TST-OP-OT", "ot"), released("TST-OP-ET", "et")],
        power: powerCards(4),
      },
    });
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("battle");
    const r = tryZordRush(s, "RS-074:cosmo", { materials: ["RS-090:rr"], destination: "discard" });
    expect(r.ok).toBe(true);
    s = r.state;
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-074:cosmo")).toBe("rush");
  });

  // faq-card-2 RS-110 Q（RS-090 の項にも同文）「はい、その通りです。「可能なら」とありますので…ラッシュエリアに置きます。」
  it("RS-090: 公式Q&A — 相手のゼニボムでバトルエリアに出られないときはラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-090 Q5・RS-110。atwiki/page-303 の写しは逆の回答＝出典相違）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "battle",
      player1: { power: powerCards(2), command: [released("TST-OP-OT", "ot")], hand: [inst("RS-090", "rr")] },
      player2: { battle: fillers(4, "p2f"), rush: [inst("RS-110", "pink")] },
    });
    s = enter(s, "RS-110:pink", "player2");
    s = endTurn(s);
    for (let i = 0; i < 20 && !(s.activePlayer === "player1" && s.phase === "rush"); i += 1) {
      const a =
        legal(s).find((x) => x.type === "return_all_battle_to_rush") ??
        legal(s).find((x) => x.type === "release_start_commands") ??
        legal(s).find((x) => x.type === "draw") ??
        legal(s).find((x) => x.type === "skip_bonus_draw") ??
        legal(s).find((x) => x.type === "end_phase");
      if (!a) break;
      s = act(s, a);
    }
    expect(s.activePlayer).toBe("player1");
    expect(s.phase).toBe("rush");
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-090:rr" });
    for (let i = 0; i < 4 && s.pendingCommandPayment; i += 1) {
      const p = s.pendingCommandPayment;
      s = act(s, { type: "resolve_command_payment", playerId: p.playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-090:rr")).toBe("rush");
  });

  // faq-card-2 RS-121 Q（RS-090 の項にも同文）「はい、その通りです。」（遺跡発掘で出したレッドレーサーはラッシュエリアに置く）
  it("RS-090: 公式Q&A — ゴーゴードーザーの遺跡発掘で出したレッドレーサーは、バトルエリアではなくラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-090 Q6・RS-121。atwiki/page-303 の写しは逆の回答＝出典相違）", () => {
    let s = st({
      phase: "battle",
      player1: { rush: [inst("RS-121", "dozer")] },
      player2: { command: [released("RS-090", "rr")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-121:dozer" });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-090:rr" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-090:rr")).toBe("rush");
  });
});
