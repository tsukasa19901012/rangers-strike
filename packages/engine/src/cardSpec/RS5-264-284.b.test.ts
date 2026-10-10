/**
 * カード別スペック: RS-272〜RS-277（第5弾「五龍の逆鱗」ファイブレッド〜ガロア艦長）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）ほか card_3 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canSkip,
  canStrike,
  choiceIds,
  damageCards,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  released,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS5-264-284.helpers";
import type { GameState } from "../types/game";

const SP_NONE = sUnit("SPEC-SPNONE", { sp: undefined, bp: 1000 });
const RED_S = sUnit("SPEC-RED", { features: ["レッド"] });
const M_UNIT = sUnit("SPEC-M", { size: "M", bp: 4000 });
const SPECS = [SP_NONE, RED_S, M_UNIT];

// ===========================================================================
describe("RS-272 ファイブレッド", () => {
  it("RS-272: カタログ本文・スペックが出典と一致（出典: atwiki/page-461）", () => {
    expectCatalogText("RS-272", "【Vソード】「SP1」");
    expectStats("RS-272", {
      name: "ファイブレッド",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 1,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  it("RS-272: 【Vソード】5番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-461「CN：5」「【Vソード】「SP1」」）", () => {
    const s = enter(st({ player1: { battle: fillers(4), rush: [inst("RS-272", "x")] } }), "RS-272:x");
    expect(spOf(s, "player1", "RS-272:x")).toBe(1);
    expect(canStrike(s, "RS-272:x")).toBe(true);
  });

  it("RS-272: NC 不成立（4番目）では SP！のまま（ストライクできない）（出典: atwiki/page-461「SP：！」・R-CN-02）", () => {
    const s = enter(st({ player1: { battle: fillers(3), rush: [inst("RS-272", "x")] } }), "RS-272:x");
    expect(spOf(s, "player1", "RS-272:x")).toBe(0);
    expect(canStrike(s, "RS-272:x")).toBe(false);
  });
});

// ===========================================================================
// ファイブマン共通:「これがアタックしなかったとき、このユニットの次にコンビネーションするSユニットのBPは、このユニットのBPを「＋」した値になる。」
type FiveId = "RS-273" | "RS-274" | "RS-275" | "RS-276";

/** ファイブを CN の位置に出し、アタックせず（パス）次の S ユニットを出す。 */
function fiveThen(id: FiveId, cn: number, opts: { pos?: number; attackFirst?: boolean; nextId?: string; between?: boolean } = {}) {
  const pos = opts.pos ?? cn;
  let s = st(
    {
      turn: 3,
      player1: {
        battle: fillers(pos - 1),
        rush: [inst(id, "f"), ...(opts.between ? [inst("TST-UNIT-0", "mid")] : []), inst(opts.nextId ?? "TST-UNIT-0", "nx")],
        deck: deckCards(5),
      },
      player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(5, "e") },
    },
    SPECS,
  );
  s = enter(s, `${id}:f`);
  if (opts.attackFirst) {
    s = attack(s, `${id}:f`, "TST-UNIT-0:d");
    s = settle(s);
  } else {
    s = passEntry(s);
  }
  if (opts.between) s = passEntry(enter(s, "TST-UNIT-0:mid"));
  return enter(s, `${opts.nextId ?? "TST-UNIT-0"}:nx`);
}

function fiveTests(id: FiveId, name: string, effect: string, bp: number, cn: number, cost: number, features: string[], page: string) {
  const TEXT = `【${effect}】これがアタックしなかったとき、このユニットの次にコンビネーションするSユニットのBPは、このユニットのBPを「＋」した値になる。`;
  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, TEXT);
    expectStats(id, { name, category: "ET", size: "S", bp, sp: undefined, powerCost: cost, comboNumber: cn, features });
  });

  it.fails(`${id}: 【${effect}】NC 成立・アタックしなかったとき、次にコンビネーションする S ユニットの BP は +${bp}（出典: ${page}【${effect}】）`, () => {
    // 既知の不具合: CARD-${id} 【${effect}】が実装されておらず、次の S ユニットの BP が増えない
    const s = fiveThen(id, cn);
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(1000 + bp);
  });

  it(`${id}: 【${effect}】これがアタックしたときは次の S ユニットの BP は増えない（出典: ${page}「これがアタックしなかったとき」）`, () => {
    const s = fiveThen(id, cn, { attackFirst: true });
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(1000);
  });

  it(`${id}: 【${effect}】NC 不成立（${cn === 1 ? 2 : cn - 1}番目）では次の S ユニットの BP は増えない（出典: ${page}「CN：${cn}」・R-CN-02）`, () => {
    const s = fiveThen(id, cn, { pos: cn === 1 ? 2 : cn - 1 });
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(1000);
  });

  it(`${id}: 【${effect}】「次にコンビネーションする」1体だけ。その次のユニットの BP は増えない（出典: ${page}「このユニットの次にコンビネーションするSユニット」）`, () => {
    const s = fiveThen(id, cn, { between: true });
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(1000);
  });
}

describe("RS-273 ファイブブルー", () => {
  fiveTests("RS-273", "ファイブブルー", "ツインアレイ", 3000, 4, 1, ["ブルー", "男"], "atwiki/page-462");

  // faq-card-5 RS-273 Q1「自軍ターンが終わるまで有効です。」
  it.fails("RS-273: 公式Q&A — 効果は自軍ターンが終わるまで有効（ターン中は＋され、敵軍ターンには元の BP）（出典: grnrngr/faq-card-5 RS-273 Q1）", () => {
    // 既知の不具合: CARD-RS-273 【ツインアレイ】が実装されていない
    let s = fiveThen("RS-273", 4);
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(4000);
    s = passEntry(s);
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(1000);
  });

  // faq-card-5 RS-273 Q2「はい、「＋」されます。」
  it.fails("RS-273: 公式Q&A — ＋された S ユニットをバトルダンスでラッシュエリアに戻し、入れ替わりに出た別の S ユニットも BP を＋される（出典: grnrngr/faq-card-5 RS-273 Q2）", () => {
    // 既知の不具合: CARD-RS-273 【ツインアレイ】が実装されていない
    let s = st(
      {
        turn: 3,
        player1: {
          battle: fillers(3),
          rush: [inst("RS-273", "f"), inst("TST-UNIT-0", "nx"), inst("TST-UNIT-0", "alt")],
          operation: [inst("RS-003", "bd")],
          command: [released("TST-OP", "c1"), released("TST-OP", "c2")],
          deck: deckCards(5),
        },
        player2: { battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-0", "d2")], deck: deckCards(5, "e") },
      },
      SPECS,
    );
    s = passEntry(enter(s, "RS-273:f"));
    s = enter(s, "TST-UNIT-0:nx");
    expect(bpOf(s, "player1", "TST-UNIT-0:nx")).toBe(4000);
    s = settle(attack(s, "TST-UNIT-0:nx", "TST-UNIT-0:d"));
    const retreat = legal(s).find((a) => a.type === "battle_dance_retreat" && a.battleInstanceId === "TST-UNIT-0:nx");
    expect(retreat).toBeDefined();
    s = act(s, retreat!);
    expect(zoneOf(s, "player1", "TST-UNIT-0:nx")).toBe("rush");
    s = enter(s, "TST-UNIT-0:alt");
    expect(bpOf(s, "player1", "TST-UNIT-0:alt")).toBe(4000);
  });
});

describe("RS-274 ファイブブラック", () => {
  fiveTests("RS-274", "ファイブブラック", "パワーカッター", 2000, 3, 0, ["ブラック", "男"], "atwiki/page-463");
});

describe("RS-275 ファイブピンク", () => {
  fiveTests("RS-275", "ファイブピンク", "キューティーサークル", 2000, 2, 1, ["ピンク", "女"], "atwiki/page-464");
});

describe("RS-276 ファイブイエロー", () => {
  fiveTests("RS-276", "ファイブイエロー", "メロディータクト", 1000, 1, 0, ["イエロー", "女"], "atwiki/page-465");
});

// ===========================================================================
describe("RS-277 ガロア艦長", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【古傷の因縁】自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドゾーンか、敵軍パワーゾーンのダメージ以外のカードに特徴「レッド」を持つユニットカードがあれば1枚選び、敵軍ラッシュエリアに出してもよい。";

  it("RS-277: カタログ本文・スペックが出典と一致（出典: atwiki/page-438）", () => {
    expectCatalogText("RS-277", TEXT);
    expectStats("RS-277", {
      name: "ガロア艦長",
      category: "DA",
      size: "S",
      bp: 7000,
      sp: undefined,
      powerCost: 5,
      comboNumber: undefined,
      features: ["艦長", "男"],
    });
  });

  /** 敵軍（player2）ターンに attackerId で galoa をアタックする。 */
  function enemyAttacks(attackerId: string) {
    let s = st(
      {
        turn: 2,
        activePlayer: "player2",
        player1: { battle: [inst("RS-277", "g")], deck: deckCards(3) },
        player2: { rush: [inst(attackerId, "a")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    s = enter(s, `${attackerId}:a`, "player2");
    s = attack(s, `${attackerId}:a`, "RS-277:g", "player2");
    return settle(s);
  }

  it("RS-277: ※ 敵軍ターン中、「SP1」のユニットとバトルするとバトルに勝っても撃破される（出典: atwiki/page-438「※これは敵軍ターン中…撃破される」）", () => {
    const s = enemyAttacks("TST-UNIT-0");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-277:g")).toBe("discard");
  });

  it("RS-277: ※ SP が空欄のユニットとのバトルに勝っても撃破されない（出典: atwiki/page-438「「SP1」以上のユニット」）", () => {
    const s = enemyAttacks("SPEC-SPNONE");
    expect(zoneOf(s, "player2", "SPEC-SPNONE:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-277:g")).toBe("battle");
  });

  it("RS-277: ※ 自軍ターン中に「SP1」のユニットとバトルして勝っても撃破されない（出典: atwiki/page-438「敵軍ターン中」）", () => {
    let s = st(
      { turn: 3, player1: { rush: [inst("RS-277", "g")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") } },
      SPECS,
    );
    s = enter(s, "RS-277:g");
    if (s.pendingEffectChoice) s = skip(s);
    s = settle(attack(s, "RS-277:g", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-277:g")).toBe("battle");
  });

  /** 自軍ターンにガロア艦長をバトルエリアに出す。 */
  function galoaEnter(p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) {
    const s = st({ turn: 3, player1: { rush: [inst("RS-277", "g")], deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, SPECS);
    return enter(s, "RS-277:g");
  }

  it("RS-277: 【古傷の因縁】敵軍コマンドゾーン・敵軍パワーゾーン（ダメージ以外）の特徴「レッド」のユニットカードから1枚選び、敵軍ラッシュエリアに出す（出典: atwiki/page-438【古傷の因縁】）", () => {
    let s = galoaEnter({
      command: [held("RS-280", "rh"), released("TST-UNIT-0", "nored")],
      power: [inst("SPEC-RED", "pr"), { ...inst("RS-272", "dm"), faceDown: true }, inst("TST-P", "op")],
    });
    expect(choiceIds(s)).toEqual(["RS-280:rh", "SPEC-RED:pr"]);
    s = pick(s, "SPEC-RED:pr");
    expect(zoneOf(s, "player2", "SPEC-RED:pr")).toBe("rush");
  });

  it("RS-277: 【古傷の因縁】「出してもよい」ので見送れる（出典: atwiki/page-438「出してもよい」）", () => {
    let s = galoaEnter({ command: [held("RS-280", "rh")] });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "RS-280:rh")).toBe("command");
  });

  it("RS-277: 【古傷の因縁】対象となる特徴「レッド」のユニットカードがなければ何も起きない（出典: atwiki/page-438「…があれば」）", () => {
    const s = galoaEnter({ command: [held("TST-UNIT-0", "u")], power: [{ ...inst("RS-280", "dm"), faceDown: true }] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-277");
  });

  it.todo(
    "RS-277: 【古傷の因縁】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-438「自軍ターン中」）— 敵軍ターン中にこのユニットを自軍バトルエリアへ出す手段が公開 API にないため",
  );

  // faq-card-5 RS-277 Q1 / faq-card-3 RS-124「はい、その通りです。」
  it("RS-277: 公式Q&A — 超電子レーダーが配置されていると、古傷の因縁で敵軍ラッシュエリアに出した相手は、パワーゾーンのダメージ以外のカードを1枚手札に戻す（出典: grnrngr/faq-card-5 RS-277 Q1・faq-card-3 RS-124）", () => {
    let s = galoaEnter(
      { command: [held("RS-280", "rh")], power: [...powerCards(2, "q"), ...damageCards(1, "qd")] },
      { operation: [inst("RS-124", "rad")] },
    );
    s = pick(s, "RS-280:rh");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-124");
    expect(choiceIds(s)).toEqual(["TST-P:q0", "TST-P:q1"]);
    s = pick(s, "TST-P:q0");
    expect(zoneOf(s, "player2", "TST-P:q0")).toBe("hand");
  });
});
