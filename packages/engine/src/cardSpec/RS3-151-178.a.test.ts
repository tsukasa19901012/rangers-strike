/**
 * カード別スペック: RS-151〜RS-159（第3弾「三界の獅子」ガオレンジャーのパワーアニマル）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-3（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_3.html）
 *     ほか card_1/card_2/card_4/card_8 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  passEntry,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  substitutes,
  toPhase,
  tryAct,
  useNinja,
  zoneOf,
} from "./RS3-151-178.helpers";
import type { GameState } from "../types/game";

const ET_M = sUnit("SPEC-ET-M", { size: "M", category: "ET", bp: 3000 });
const ET_L = sUnit("SPEC-ET-L", { size: "L", category: "ET", bp: 13000, powerCost: "7+" });

/** ダメージ n 点（ウラ向きパワー n 枚）の状態。 */
function damaged(n: number) {
  return {
    damage: n,
    power: Array.from({ length: n }, (_, i) => ({ ...inst("TST-P", `dmg${i}`), faceDown: true })),
  };
}

// ===========================================================================
describe("RS-151 ガオキング", () => {
  // atwiki/page-17「【怒涛裂断シャークショット】（SC版：【天地轟鳴アニマルハート】）このユニットは、自軍バトルエリアにある「WB」のMユニット1体につきBP＋2000される。」
  it("RS-151: カタログ本文・スペックが出典と一致（出典: atwiki/page-17）", () => {
    expectCatalogText(
      "RS-151",
      "合体―ガオライオン＋ガオイーグル＋ガオシャーク＋ガオバイソン＋ガオタイガー【怒涛裂断シャークショット】このユニットは、自軍バトルエリアにある「WB」のMユニット1体につきBP＋2000される。",
    );
    expectStats("RS-151", {
      name: "ガオキング",
      category: "WB",
      size: "L",
      bp: 14000,
      sp: 1,
      powerCost: "6+",
      features: ["獣", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「合体―ガオライオン＋ガオイーグル＋ガオシャーク＋ガオバイソン＋ガオタイガー」「追加条件：自軍合体ユニットを捨札にする」
  it("RS-151: 合体ユニット5体をすべて捨札にしてラッシュでき、4体では満たせない（出典: atwiki/page-17・R-ADD-06）", () => {
    const five = ["RS-152", "RS-153", "RS-154", "RS-155", "RS-156"].map((id) => inst(id, "m"));
    const mk = (rush: ReturnType<typeof inst>[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-151", "k")], rush, command: releasedN(2), power: powerCards(6) } });
    expect(canStartRush(mk(five.slice(0, 4)), "player1", "RS-151:k")).toBe(false);
    const r = rushFromHand(mk(five), "player1", "RS-151:k");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-151:k")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("RS-151: 必要パワー6+ — パワー5枚ではラッシュできない（出典: atwiki/page-17）", () => {
    const five = ["RS-152", "RS-153", "RS-154", "RS-155", "RS-156"].map((id) => inst(id, "m"));
    const s = st({ phase: "rush", player1: { hand: [inst("RS-151", "k")], rush: five, command: releasedN(2), power: powerCards(5) } });
    expect(rushFromHand(s, "player1", "RS-151:k").ok).toBe(false);
  });

  // 「自軍バトルエリアにある「WB」のMユニット1体につきBP＋2000」
  it("RS-151: 自軍バトルエリアの WB の M ユニット1体につき BP+2000（2体で18000）（出典: atwiki/page-17）", () => {
    const s = st({ player1: { battle: [inst("RS-151", "k"), inst("RS-153", "e"), inst("RS-156", "t")] } });
    expect(bpOf(s, "player1", "RS-151:k")).toBe(18000);
  });

  it("RS-151: ラッシュエリアの M・敵軍の M・WB 以外の M・S ユニットは数えない（出典: atwiki/page-17「自軍バトルエリアにある「WB」のMユニット」）", () => {
    const s = st(
      {
        player1: {
          battle: [inst("RS-151", "k"), inst("SPEC-ET-M", "etm"), inst("TST-UNIT-0", "s")],
          rush: [inst("RS-153", "rushM")],
        },
        player2: { battle: [inst("RS-156", "enemyM")] },
      },
      [ET_M],
    );
    expect(bpOf(s, "player1", "RS-151:k")).toBe(14000);
  });

  it("RS-151: ターンの指定がないので敵軍ターン中も BP が上がる（出典: atwiki/page-17）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("RS-151", "k"), inst("RS-153", "e")] } });
    expect(bpOf(s, "player1", "RS-151:k")).toBe(16000);
  });
});

// ===========================================================================
describe("RS-152 ガオライオン", () => {
  const ROAR =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【灼熱の咆哮】このユニットが場にある間、「WB」の自軍Mユニットは、自軍捨札に同じ名前のカードがあれば「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれていても、そのテキストは無効になる。";

  it("RS-152: カタログ本文・スペックが出典と一致（出典: atwiki/page-86）", () => {
    expectCatalogText("RS-152", ROAR);
    expectStats("RS-152", {
      name: "ガオライオン",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      features: ["獣"],
    });
  });

  // 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」
  it("RS-152: ※ コマンドを1つホールドしなければ出られない（ホールドすれば出られる）（出典: atwiki/page-86）", () => {
    const none = st({ player1: { rush: [inst("RS-152", "l")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-152:l")).toBe(false);
    let s = st({ player1: { rush: [inst("RS-152", "l")], command: [released("TST-OP", "c")] } });
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-152:l" }).ok).toBe(false);
    s = enterWithHold(s, "RS-152:l", ["TST-OP:c"]);
    expect(zoneOf(s, "player1", "RS-152:l")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // 「「WB」の自軍Mユニットは、自軍捨札に同じ名前のカードがあれば…そのテキストは無効になる」
  it("RS-152: ライオンがラッシュエリアにあり、捨札に同名カードがある WB の M ユニット（ガオイーグル）はホールドせずに出られる（出典: atwiki/page-86）", () => {
    let s = st({ player1: { rush: [inst("RS-152", "l"), inst("RS-153", "e")], discard: [inst("RS-153", "d")], command: [] } });
    expect(canEnter(s, "RS-153:e")).toBe(true);
    s = enter(s, "RS-153:e");
    expect(zoneOf(s, "player1", "RS-153:e")).toBe("battle");
  });

  it("RS-152: 捨札に同名カードがなければホールドが必要なまま（出典: atwiki/page-86「自軍捨札に同じ名前のカードがあれば」）", () => {
    const s = st({ player1: { rush: [inst("RS-152", "l"), inst("RS-153", "e")], discard: [inst("RS-156", "d")], command: [] } });
    expect(canEnter(s, "RS-153:e")).toBe(false);
  });

  it("RS-152: 敵軍の捨札にある同名カードでは無効にならない（出典: atwiki/page-86「自軍捨札」）", () => {
    const s = st({
      player1: { rush: [inst("RS-152", "l"), inst("RS-153", "e")], command: [] },
      player2: { discard: [inst("RS-153", "d")] },
    });
    expect(canEnter(s, "RS-153:e")).toBe(false);
  });

  it("RS-152: ガオライオン自身も WB の M ユニットなので、捨札に同名カードがあればホールドせずに出られる（出典: atwiki/page-86）", () => {
    const s = st({ player1: { rush: [inst("RS-152", "l")], discard: [inst("RS-152", "d")], command: [] } });
    expect(canEnter(s, "RS-152:l")).toBe(true);
  });

  it("RS-152: ライオンがバトルエリアにあるときも有効（出典: atwiki/page-86「このユニットが場にある間」）", () => {
    const s = st({ player1: { battle: [inst("RS-152", "l")], rush: [inst("RS-156", "t")], discard: [inst("RS-156", "d")], command: [] } });
    expect(canEnter(s, "RS-156:t")).toBe(true);
  });

  it("RS-152: WB 以外の M ユニット（MA の気伝獣ウォンタイガー）・WB の S ユニット（ドラグレッダー）には及ばない（出典: atwiki/page-86「「WB」の自軍Mユニット」）", () => {
    const s = st({
      player1: {
        rush: [inst("RS-152", "l"), inst("RS-293", "won"), inst("RK-034", "drag")],
        discard: [inst("RS-293", "d1"), inst("RK-034", "d2")],
        command: [],
      },
    });
    expect(canEnter(s, "RS-293:won")).toBe(false);
    expect(canEnter(s, "RK-034:drag")).toBe(false);
  });

  it("RS-152: 敵軍のガオライオンでは無効にならない（出典: atwiki/page-86「「WB」の自軍Mユニット」）", () => {
    const s = st({
      player1: { rush: [inst("RS-153", "e")], discard: [inst("RS-153", "d")], command: [] },
      player2: { rush: [inst("RS-152", "l")] },
    });
    expect(canEnter(s, "RS-153:e")).toBe(false);
  });

  // faq-card-3 RS-152 Q1「「ユニット」と表現されているときは、そのカードがユニットとして扱われている（ラッシュされている）ことが条件となります」
  it("RS-152: 公式Q&A — コマンドゾーン・パワーゾーンにあるガオライオンのカードでは発動しない（出典: grnrngr/faq-card-3 RS-152 Q1）", () => {
    const inCommand = st({
      player1: { rush: [inst("RS-153", "e")], discard: [inst("RS-153", "d")], command: [held("RS-152", "cmdLion")] },
    });
    expect(canEnter(inCommand, "RS-153:e")).toBe(false);
    const inPower = st({
      player1: { rush: [inst("RS-153", "e")], discard: [inst("RS-153", "d")], power: [inst("RS-152", "pwLion")], command: [] },
    });
    expect(canEnter(inPower, "RS-153:e")).toBe(false);
  });
});

// ===========================================================================
describe("RS-153 ガオイーグル", () => {
  it("RS-153: カタログ本文・スペックが出典と一致（出典: atwiki/page-87）", () => {
    expectCatalogText("RS-153", "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【フェザーボム】「SP1」");
    expectStats("RS-153", {
      name: "ガオイーグル",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: "special",
      powerCost: 4,
      comboNumber: 2,
      features: ["獣"],
    });
  });

  it("RS-153: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-87）", () => {
    const none = st({ player1: { rush: [inst("RS-153", "e")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-153:e")).toBe(false);
    const s = enterWithHold(st({ player1: { rush: [inst("RS-153", "e")], command: [released("TST-OP", "c")] } }), "RS-153:e", ["TST-OP:c"]);
    expect(zoneOf(s, "player1", "RS-153:e")).toBe("battle");
  });

  // CN2「【フェザーボム】「SP1」」
  it("RS-153: CN2 — 2番目に出ると「SP1」になりストライクで1点与える（出典: atwiki/page-87）", () => {
    let s = st({
      player1: { battle: fillers(1), rush: [inst("RS-153", "e")], command: [released("TST-OP", "c")] },
      player2: { power: powerCards(3, "e"), deck: deckCards(3, "e") },
    });
    s = enterWithHold(s, "RS-153:e", ["TST-OP:c"]);
    expect(canStrike(s, "RS-153:e")).toBe(true);
    s = settle(strike(s, "RS-153:e"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-153: 1番目に出たときは「SP！」のままでストライクできない（出典: atwiki/page-87・R-CN-02）", () => {
    let s = st({ player1: { rush: [inst("RS-153", "e")], command: [released("TST-OP", "c")] } });
    s = enterWithHold(s, "RS-153:e", ["TST-OP:c"]);
    expect(canStrike(s, "RS-153:e")).toBe(false);
  });
});

// ===========================================================================
describe("RS-154 ガオシャーク", () => {
  it("RS-154: カタログ本文・スペックが出典と一致（出典: atwiki/page-89）", () => {
    expectCatalogText(
      "RS-154",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。※これは敵軍バトルエリアのSユニットにアタックできない。※これは敵軍ラッシュエリアのSユニットにアタックできる。",
    );
    expectStats("RS-154", {
      name: "ガオシャーク",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 4,
      features: ["獣"],
    });
  });

  it("RS-154: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-89）", () => {
    const none = st({ player1: { rush: [inst("RS-154", "sh")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-154:sh")).toBe(false);
    const s = enterWithHold(st({ player1: { rush: [inst("RS-154", "sh")], command: [released("TST-OP", "c")] } }), "RS-154:sh", ["TST-OP:c"]);
    expect(zoneOf(s, "player1", "RS-154:sh")).toBe("battle");
  });

  // 「※これは敵軍バトルエリアのSユニットにアタックできない。※これは敵軍ラッシュエリアのSユニットにアタックできる。」
  it("RS-154: ※ 敵軍バトルエリアの S にはアタックできず、敵軍ラッシュエリアの S にはアタックできる（出典: atwiki/page-89）", () => {
    const s = st({
      player1: { battle: [inst("RS-154", "sh")] },
      player2: { battle: [inst("TST-UNIT-0", "bs")], rush: [inst("TST-UNIT-0", "rs")] },
    });
    const targets = attackTargets(s, "RS-154:sh");
    expect(targets).not.toContain("TST-UNIT-0:bs");
    expect(targets).toContain("TST-UNIT-0:rs");
  });

  it("RS-154: ラッシュエリアの S にアタックして勝てば撃破できる（出典: atwiki/page-89）", () => {
    let s = st({ player1: { battle: [inst("RS-154", "sh")] }, player2: { rush: [inst("TST-UNIT-0", "rs")], battle: [inst("TST-UNIT-0", "bs")] } });
    s = settle(attack(s, "RS-154:sh", "TST-UNIT-0:rs"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:rs")).toBe("discard");
  });

  it.fails("RS-154: 敵軍ラッシュエリアの M ユニットにはアタックできない（出典: atwiki/page-89「ラッシュエリアのSユニット」）", () => {
    // 既知の不具合: CARD-RS-154 ラッシュエリアへのアタック許可がサイズを問わず、敵軍ラッシュエリアの M ユニットにもアタックできてしまう
    const s = st({ player1: { battle: [inst("RS-154", "sh")] }, player2: { rush: [inst("TST-UNIT-2", "rm")] } });
    expect(attackTargets(s, "RS-154:sh")).not.toContain("TST-UNIT-2:rm");
  });

  // faq-card-3 RS-154 Q1「はい、アタックできます。」
  it("RS-154: 公式Q&A — バトルエリアの S 以外（M・L）のユニットにはアタックできる（出典: grnrngr/faq-card-3 RS-154 Q1）", () => {
    const s = st({ player1: { battle: [inst("RS-154", "sh")] }, player2: { battle: [inst("TST-UNIT-2", "m"), inst("TST-UNIT-7", "l")] } });
    const targets = attackTargets(s, "RS-154:sh");
    expect(targets).toContain("TST-UNIT-2:m");
    expect(targets).toContain("TST-UNIT-7:l");
  });

  // faq-card-3 RS-154 Q2「はい、できます。」
  it("RS-154: 公式Q&A — ラッシュエリアの S へのアタックに隠流忍術を使い、バトルエリアの S をかわりにバトルさせられる（出典: grnrngr/faq-card-3 RS-154 Q2）", () => {
    let s = st({
      player1: { battle: [inst("RS-154", "sh")] },
      player2: {
        rush: [inst("TST-UNIT-0", "rs")],
        battle: [inst("TST-UNIT-0", "bs")],
        hand: [inst("RS-018", "n")],
        command: releasedN(2, "TST-OP-MA", "ma"),
        power: powerCards(5, "e"),
      },
    });
    s = attack(s, "RS-154:sh", "TST-UNIT-0:rs");
    expect(substitutes(s, "RS-018:n")).toContain("TST-UNIT-0:bs");
    s = settle(useNinja(s, "RS-018:n", "TST-UNIT-0:bs"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:bs")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:rs")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-155 ガオバイソン", () => {
  it("RS-155: カタログ本文・スペックが出典と一致（出典: atwiki/page-90）", () => {
    expectCatalogText(
      "RS-155",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【鋼の角】これがバトルエリアに出たとき、敵軍ユニットを1体選んで撃破してもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない。",
    );
    expectStats("RS-155", {
      name: "ガオバイソン",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 6,
      features: ["獣"],
    });
  });

  it("RS-155: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-90）", () => {
    const none = st({ player1: { rush: [inst("RS-155", "b")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-155:b")).toBe(false);
  });

  const L6 = sUnit("SPEC-L6", { size: "L", bp: 12000, powerCost: "6+" });
  function bisonEnters(enemyDamage: number) {
    const s = st({
      player1: { rush: [inst("RS-155", "b")], command: [released("TST-OP", "c")] },
      player2: {
        ...damaged(enemyDamage),
        battle: [inst("TST-UNIT-2", "m2"), inst("SPEC-L6", "l6")],
        rush: [inst("TST-UNIT-0", "s0"), inst("RS-152", "m4")],
      },
    }, [L6]);
    return enterWithHold(s, "RS-155:b", ["TST-OP:c"]);
  }

  // 「敵軍ユニットを1体選んで撃破してもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない」
  it("RS-155: 出たとき、必要パワーの数字が敵軍ダメージ（3点）以下の敵軍ユニット（バトル・ラッシュエリア）だけを選べる（出典: atwiki/page-90）", () => {
    const s = bisonEnters(3);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s0", "TST-UNIT-2:m2"]);
  });

  it("RS-155: 選んだユニットを撃破する（出典: atwiki/page-90）", () => {
    let s = bisonEnters(3);
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-2:m2" }));
    expect(zoneOf(s, "player2", "TST-UNIT-2:m2")).toBe("discard");
  });

  it("RS-155: 撃破しないことを選べる（任意）（出典: atwiki/page-90「撃破してもよい」）", () => {
    let s = bisonEnters(3);
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "TST-UNIT-2:m2")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s0")).toBe("rush");
  });

  it("RS-155: 敵軍ダメージが6点なら必要パワー「6+」の L ユニットも選べる（必要パワーの数字で比べる）（出典: atwiki/page-90「必要パワーの数字」）", () => {
    const s = bisonEnters(6);
    expect(choiceIds(s)).toContain("SPEC-L6:l6");
    expect(choiceIds(s)).toContain("RS-152:m4");
  });
});

// ===========================================================================
describe("RS-156 ガオタイガー", () => {
  it("RS-156: カタログ本文・スペックが出典と一致（出典: atwiki/page-88）", () => {
    expectCatalogText("RS-156", "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【鋭い爪】「SP1」");
    expectStats("RS-156", {
      name: "ガオタイガー",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: "special",
      powerCost: 5,
      comboNumber: 2,
      features: ["獣"],
    });
  });

  it("RS-156: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-88）", () => {
    const none = st({ player1: { rush: [inst("RS-156", "t")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-156:t")).toBe(false);
  });

  it("RS-156: CN2 — 2番目に出ると「SP1」になりストライクで1点与える（出典: atwiki/page-88）", () => {
    let s = st({
      player1: { battle: fillers(1), rush: [inst("RS-156", "t")], command: [released("TST-OP", "c")] },
      player2: { power: powerCards(3, "e"), deck: deckCards(3, "e") },
    });
    s = enterWithHold(s, "RS-156:t", ["TST-OP:c"]);
    expect(canStrike(s, "RS-156:t")).toBe(true);
    s = settle(strike(s, "RS-156:t"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-156: 3番目に出たときは「SP！」のままでストライクできない（出典: atwiki/page-88・R-CN-02）", () => {
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-156", "t")], command: [released("TST-OP", "c")] } });
    s = enterWithHold(s, "RS-156:t", ["TST-OP:c"]);
    expect(canStrike(s, "RS-156:t")).toBe(false);
  });
});

// ===========================================================================
describe("RS-157 ガオジュラフ", () => {
  it("RS-157: カタログ本文・スペックが出典と一致（出典: atwiki/page-91）", () => {
    expectCatalogText(
      "RS-157",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【悪鬼貫徹ネックスラスト】このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒自軍ターン中、BP+4000され、BP20000以上のとき「SP2」になる。",
    );
    expectStats("RS-157", {
      name: "ガオジュラフ",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      comboNumber: "L" as never,
      features: ["獣"],
    });
  });

  it("RS-157: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-91）", () => {
    const none = st({ player1: { rush: [inst("RS-157", "g")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-157:g")).toBe(false);
  });

  /** ジュラフ（左）→ L ユニット（右）の順に出す（atwiki/page-266「「L」は左…に並べる」）。 */
  function giraffeThen(lId: string, extra: CardDef[] = [], p2: Partial<GameState["players"]["player2"]> = {}) {
    let s = st(
      {
        player1: { rush: [inst("RS-157", "g"), inst(lId, "L")], command: [released("TST-OP", "c")], deck: deckCards(5) },
        player2: { power: powerCards(3, "e"), deck: deckCards(5, "e"), ...p2 },
      },
      extra,
    );
    s = passEntry(enterWithHold(s, "RS-157:g", ["TST-OP:c"]));
    s = enter(s, `${lId}:L`);
    return s;
  }

  // 「このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒自軍ターン中、BP+4000され」
  it("RS-157: ジュラフからコンビネーションした同カテゴリ（WB）の L ユニットは自軍ターン中 BP+4000（出典: atwiki/page-91・atwiki/page-266）", () => {
    const s = giraffeThen("TST-UNIT-7");
    expect(bpOf(s, "player1", "TST-UNIT-7:L")).toBe(17000);
  });

  it("RS-157: 敵軍ターン中は BP+4000 されない（出典: atwiki/page-91「自軍ターン中」）", () => {
    let s = giraffeThen("TST-UNIT-7");
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "TST-UNIT-7:L")).toBe("battle");
    expect(bpOf(s, "player1", "TST-UNIT-7:L")).toBe(13000);
  });

  it("RS-157: カテゴリが違う（ET）L ユニットは能力を得ない（出典: atwiki/page-91「同カテゴリのLユニット」）", () => {
    const s = giraffeThen("SPEC-ET-L", [ET_L]);
    expect(bpOf(s, "player1", "SPEC-ET-L:L")).toBe(13000);
  });

  it("RS-157: L ユニットを先に出してからジュラフを右に出しても成立しない（出典: atwiki/page-266「「L」は左…に並べる」）", () => {
    let s = st({ player1: { rush: [inst("RS-157", "g"), inst("TST-UNIT-7", "L")], command: [released("TST-OP", "c")] } });
    s = passEntry(enter(s, "TST-UNIT-7:L"));
    s = passEntry(enterWithHold(s, "RS-157:g", ["TST-OP:c"]));
    expect(bpOf(s, "player1", "TST-UNIT-7:L")).toBe(13000);
  });

  // 「BP20000以上のとき「SP2」になる」— ガオキング 14000＋ジュラフ（WB の M）2000＋4000＝20000（atwiki/page-17 カード評価）
  it("RS-157: BP20000 以上なら「SP2」になり、ストライクで2点与える（ガオキング＝20000）（出典: atwiki/page-91・atwiki/page-17）", () => {
    let s = giraffeThen("RS-151");
    expect(bpOf(s, "player1", "RS-151:L")).toBe(20000);
    s = settle(strike(s, "RS-151:L"));
    expect(s.players.player2.damage).toBe(2);
  });

  it("RS-157: BP20000 未満（17000）なら「SP2」にならず、本来の「SP1」で1点（出典: atwiki/page-91「BP20000以上のとき」）", () => {
    let s = giraffeThen("TST-UNIT-7");
    s = settle(strike(s, "TST-UNIT-7:L"));
    expect(s.players.player2.damage).toBe(1);
  });

  // R-CN-06・faq-card-3 RS-167 Q1「一度発動すれば…撃破されても有効のままになります。コンビネーションの成立中にのみ効果を得られる場合は「このコンビネーションが成立している間」と表記します」
  it("RS-157: 得た能力はジュラフが場を離れても有効のまま（隠流忍術でジュラフとバトルさせて撃破）（出典: grnrngr/faq-card-3 RS-167 Q1・R-CN-06）", () => {
    let s = giraffeThen("TST-UNIT-7", [], {
      battle: [inst("TST-UNIT-0", "def")],
      hand: [inst("RS-018", "n")],
      command: releasedN(2, "TST-OP-MA", "ma"),
      power: powerCards(5, "e"),
    });
    s = attack(s, "TST-UNIT-7:L", "TST-UNIT-0:def");
    s = settle(useNinja(s, "RS-018:n", "RS-157:g"));
    expect(zoneOf(s, "player1", "RS-157:g")).toBe("discard");
    expect(bpOf(s, "player1", "TST-UNIT-7:L")).toBe(17000);
  });

  it("RS-157: L ユニットはアタックしたとき BP17000 として BP15000 のユニットに勝つ（出典: atwiki/page-91）", () => {
    const BIG = sUnit("SPEC-BIG15", { size: "L", bp: 15000 });
    let s = giraffeThen("TST-UNIT-7", [BIG], { battle: [inst("SPEC-BIG15", "big")] });
    s = settle(attack(s, "TST-UNIT-7:L", "SPEC-BIG15:big"));
    expect(zoneOf(s, "player2", "SPEC-BIG15:big")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-7:L")).toBe("battle");
  });
});

type CardDef = ReturnType<typeof sUnit>;

// ===========================================================================
describe("RS-158 ガオエレファント", () => {
  it("RS-158: カタログ本文・スペックが出典と一致（出典: atwiki/page-92）", () => {
    expectCatalogText(
      "RS-158",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【エレファントシールド】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒このコンビネーションが成立している間、敵軍ユニットはこれ以外のユニットにアタックできない。",
    );
    expectStats("RS-158", {
      name: "ガオエレファント",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      comboNumber: "R" as never,
      features: ["獣"],
    });
  });

  it("RS-158: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-92）", () => {
    const none = st({ player1: { rush: [inst("RS-158", "el")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-158:el")).toBe(false);
  });

  /** L ユニット（左）→ エレファント（右）の順に出す。accept=false なら任意効果を発動しない。 */
  function lThenElephant(lId: string, accept: boolean, extra: CardDef[] = []) {
    let s = st(
      {
        player1: { battle: [inst(lId, "L")], rush: [inst("RS-158", "el")], command: [released("TST-OP", "c")], deck: deckCards(5) },
        player2: { rush: [inst("TST-UNIT-0", "atk")], deck: deckCards(5, "e"), power: powerCards(3, "e") },
      },
      extra,
    );
    s = enterWithHold(s, "RS-158:el", ["TST-OP:c"]);
    const choice = s.pendingEffectChoice;
    if (choice?.playerId === "player1" && choice.effectId === "elephant_shield") {
      s = accept
        ? act(s, choice.validInstanceIds[0] ? { type: "resolve_effect_choice", playerId: "player1", instanceId: choice.validInstanceIds[0] } : { type: "confirm_effect_choice", playerId: "player1" })
        : act(s, { type: "skip_effect_choice", playerId: "player1" });
    }
    s = passEntry(s);
    s = endTurn(s);
    s = toPhase(s, "player2", "battle");
    s = enter(s, "TST-UNIT-0:atk", "player2");
    return s;
  }

  // 「このコンビネーションが成立している間、敵軍ユニットはこれ以外のユニットにアタックできない」
  it("RS-158: 同カテゴリの L ユニットからコンビネーションすると、敵軍ユニットはエレファント以外にアタックできない（出典: atwiki/page-92）", () => {
    const s = lThenElephant("TST-UNIT-7", true);
    expect(attackTargets(s, "TST-UNIT-0:atk", "player2")).toEqual(["RS-158:el"]);
  });

  it("RS-158: 同カテゴリの L ユニットの右に出ると、【エレファントシールド】を発動するかの確認が提示され、見送れる（出典: atwiki/page-92「次の効果を発動できる」）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "L")], rush: [inst("RS-158", "el")], command: [released("TST-OP", "c")] },
    });
    s = enterWithHold(s, "RS-158:el", ["TST-OP:c"]);
    expect(s.pendingEffectChoice?.effectId).toBe("elephant_shield");
    expect(legal(s).some((a) => a.type === "skip_effect_choice")).toBe(true);
  });

  it("RS-158: 発動後、L ユニットが場を離れてコンビネーションが成立しなくなれば、アタック先の制限はなくなる（出典: atwiki/page-92「このコンビネーションが成立している間」・R-CN-06）", () => {
    let s = lThenElephant("TST-UNIT-7", true);
    expect(attackTargets(s, "TST-UNIT-0:atk", "player2")).toEqual(["RS-158:el"]);
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, battle: s.players.player1.battle.filter((c) => c.instanceId !== "TST-UNIT-7:L") } } };
    expect(attackTargets(s, "TST-UNIT-0:atk", "player2")).toContain("RS-158:el");
    expect(zoneOf(s, "player1", "RS-158:el")).toBe("battle");
  });

  it("RS-158: 効果を発動しない（任意）こともでき、その場合は L ユニットにもアタックできる（出典: atwiki/page-92「次の効果を発動できる」）", () => {
    const s = lThenElephant("TST-UNIT-7", false);
    expect(attackTargets(s, "TST-UNIT-0:atk", "player2")).toContain("TST-UNIT-7:L");
  });

  it("RS-158: カテゴリが違う（ET）L ユニットの右に出しても成立しない（出典: atwiki/page-92「同カテゴリのLユニット」）", () => {
    const s = lThenElephant("SPEC-ET-L", true, [ET_L]);
    expect(attackTargets(s, "TST-UNIT-0:atk", "player2")).toContain("SPEC-ET-L:L");
  });

  it("RS-158: 左隣が L ユニットでなければ（S ユニット）成立しない（出典: atwiki/page-92「Lユニットからコンビネーションする」）", () => {
    const s = lThenElephant("TST-UNIT-0", true);
    expect(attackTargets(s, "TST-UNIT-0:atk", "player2")).toContain("TST-UNIT-0:L");
  });

  // faq-card-3 RS-158 Q1「ジョイントコンビネーションしていても…すべて「RS-018 隠流忍術」の対象とすることができます」
  it("RS-158: 公式Q&A — JC した L ユニットのアタックに対し、隠流忍術でそのエレファントを選べる（出典: grnrngr/faq-card-3 RS-158 Q1）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "L")], rush: [inst("RS-158", "el")], command: [released("TST-OP", "c")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [inst("RS-018", "n")],
        command: releasedN(2, "TST-OP-MA", "ma"),
        power: powerCards(5, "e"),
      },
    });
    s = enterWithHold(s, "RS-158:el", ["TST-OP:c"]);
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = passEntry(s);
    s = attack(s, "TST-UNIT-7:L", "TST-UNIT-0:def");
    expect(substitutes(s, "RS-018:n")).toContain("RS-158:el");
  });

  it("RS-158: 公式Q&A — JC したエレファントのアタックに対し、隠流忍術でその L ユニットを選べる（出典: grnrngr/faq-card-3 RS-158 Q1）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "L")], rush: [inst("RS-158", "el")], command: [released("TST-OP", "c")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [inst("RS-018", "n")],
        command: releasedN(2, "TST-OP-MA", "ma"),
        power: powerCards(5, "e"),
      },
    });
    s = enterWithHold(s, "RS-158:el", ["TST-OP:c"]);
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = attack(s, "RS-158:el", "TST-UNIT-0:def");
    expect(substitutes(s, "RS-018:n")).toContain("TST-UNIT-7:L");
  });
});

// ===========================================================================
describe("RS-159 ガオコング", () => {
  it("RS-159: カタログ本文・スペックが出典と一致（出典: atwiki/page-93）", () => {
    expectCatalogText(
      "RS-159",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【ファイヤーダンス】これがバトルエリアに出たとき、敵軍コマンドを敵軍ダメージの数まで選んでホールドする。",
    );
    expectStats("RS-159", {
      name: "ガオコング",
      category: "WB",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: 5,
      features: ["獣"],
    });
  });

  it("RS-159: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-93）", () => {
    const none = st({ player1: { rush: [inst("RS-159", "k")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-159:k")).toBe(false);
  });

  function kongEnters(enemyDamage: number) {
    const s = st({
      player1: { rush: [inst("RS-159", "k")], command: [released("TST-OP", "c")] },
      player2: { ...damaged(enemyDamage), command: releasedN(4, "TST-OP", "e") },
    });
    return enterWithHold(s, "RS-159:k", ["TST-OP:c"]);
  }

  /** ファイヤーダンスの選択を（選ぶプレイヤーが誰であっても）合法手の先頭で進め、ホールドを確定させる。 */
  function resolveDance(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 10 && (s.pendingEffectChoice || s.pendingCommandPayment); i++) {
      const a = legal(s).find((x) => x.type !== "pass_battle_entry");
      if (!a) break;
      s = act(s, a);
    }
    return s;
  }

  // 「敵軍コマンドを敵軍ダメージの数まで選んでホールドする」
  it("RS-159: 出たとき、敵軍ダメージ（2点）の数だけ敵軍コマンドがホールドされる（出典: atwiki/page-93）", () => {
    const s = resolveDance(kongEnters(2));
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it.fails("RS-159: ホールドする敵軍コマンドを選ぶのはガオコングの持ち主（自分）（出典: atwiki/page-93「敵軍コマンドを…選んでホールドする」）", () => {
    // 既知の不具合: CARD-RS-159 【ファイヤーダンス】の選択が相手（player2）に渡される
    const s = kongEnters(2);
    expect(s.pendingEffectChoice?.effectId).toBe("fire_dance");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
  });

  it.fails("RS-159: 「数まで」なので敵軍ダメージの数より少なく選んでもよい（出典: atwiki/page-93「敵軍ダメージの数まで選んで」）", () => {
    // 既知の不具合: CARD-RS-159 選ぶ数が敵軍ダメージの数ちょうどに固定され（selectCount・optional=false）、少なく選べない
    const s = kongEnters(2);
    expect(s.pendingEffectChoice?.optional === true || legalOfType(s, "confirm_effect_choice").length > 0).toBe(true);
  });

  it("RS-159: 敵軍ダメージが0点ならホールドしない（出典: atwiki/page-93）", () => {
    const s = resolveDance(kongEnters(0));
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(0);
  });
});
