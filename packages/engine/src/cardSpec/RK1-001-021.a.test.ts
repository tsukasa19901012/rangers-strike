/**
 * カード別スペック: RK-001〜RK-007（ザ・マスクドライダーEXP vol.1 改造人間〜メンテナンス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-003・RK-004・RK-005 の Q&A）、
 *     grnrngr/faq-rider-2（rider_2.html。RK-005 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01、R-CTR-01、R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「メモリアルレア／ノーマル／レア」を MR／N／R として照合する（パック版とスターター版で違うものはどちらか）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackersOf,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  endTurn,
  expectCatalogText,
  expectOpStats,
  expectRarityIn,
  held,
  inst,
  legal,
  nextPhase,

  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  settle,
  skip,
  st,
  sUnit,
  toPhase,
  zoneIds,
  zoneOf,
} from "./RK1-001-021.helpers";

const MALE = sUnit("SPEC-MALE", { category: "ET", bp: 2000, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { category: "ET", bp: 2000, features: ["女"] });
const MECHA = sUnit("SPEC-MECHA", { category: "ET", bp: 2000, features: ["メカ"] });
const MALE_M = sUnit("SPEC-MALE-M", { category: "ET", size: "M", bp: 3000, features: ["男"] });
const KAIZO = sUnit("SPEC-KAIZO", { category: "ET", bp: 3000, features: ["男", "改造人間"] });
const KAIZO_M = sUnit("SPEC-KAIZO-M", { category: "ET", size: "M", bp: 3000, features: ["男", "改造人間"] });
const EXTRA = [MALE, FEMALE, MECHA, MALE_M, KAIZO, KAIZO_M];

/** 自軍（player1）ラッシュフェイズ。 */
const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

const played = (s: GameState, id: string, playerId: "player1" | "player2" = "player1") => {
  const r = playOp(s, playerId, id);
  expect(r.ok, r.error).toBe(true);
  return r.state;
};

// ===========================================================================
describe("RK-001 改造人間", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） すべての自軍ユニットと、自軍山札、自軍手札、自軍パワーゾーン、自軍コマンドゾーン、自軍捨札にあるユニットカードは、特徴「男」または「女」を持っていれば、その特徴に「改造人間」を追加する。";

  it("RK-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-190）", () => {
    expectCatalogText("RK-001", TEXT);
    expectOpStats("RK-001", { name: "改造人間", category: "ET", powerCost: 0 });
    expectRarityIn("RK-001", ["MR"]);
  });

  it("RK-001: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-190・R-KW-PERM-01）", () => {
    const s = played(rushBoard({ hand: [inst("RK-001", "op")], command: releasedCat("ET", 1) }), "RK-001:op");
    expect(zoneOf(resolveAll(s), "player1", "RK-001:op")).toBe("operation");
  });

  /** 超電子ダイナモ（RK-005「特徴「改造人間」を持つ自軍Sユニットを1体選ぶ」）の候補で「改造人間」の追加を確かめる。 */
  const dynamoTargets = (withKaizo: boolean, rush: ReturnType<typeof inst>[]) =>
    choiceIds(
      played(
        rushBoard({
          hand: [inst("RK-005", "dy")],
          operation: withKaizo ? [inst("RK-001", "k")] : [],
          rush,
          command: releasedCat("ET", 1),
        }),
        "RK-005:dy",
      ),
    );

  it("RK-001: 特徴「男」を持つ自軍ユニットに「改造人間」が追加される（超電子ダイナモの対象になる）（出典: atwiki/page-190・grnrngr/faq-rider-1 RK-005 Q「「RK-001 改造人間」の効果を得るための特徴「男」も特徴「女」も持たない」）", () => {
    expect(dynamoTargets(true, [inst("SPEC-MALE", "m"), inst("SPEC-MECHA", "x")])).toEqual(["SPEC-MALE:m"]);
  });

  it("RK-001: 特徴「女」を持つ自軍ユニットにも追加される（出典: atwiki/page-190「「男」または「女」を持っていれば」）", () => {
    expect(dynamoTargets(true, [inst("SPEC-FEMALE", "f")])).toEqual(["SPEC-FEMALE:f"]);
  });

  it("RK-001: 配置していなければ「男」だけのユニットは「改造人間」を持たない（出典: atwiki/page-190 カード評価「このカード単品では意味を成さない」）", () => {
    expect(dynamoTargets(false, [inst("SPEC-MALE", "m"), inst("SPEC-KAIZO", "k")])).toEqual(["SPEC-KAIZO:k"]);
  });

  it("RK-001: 「男」「女」を持たないユニットには追加されない（出典: grnrngr/faq-rider-1 RK-005 Q（オートバジンBM は「男」も「女」も持たないため成立しない））", () => {
    expect(dynamoTargets(true, [inst("SPEC-MECHA", "x")])).toEqual([]);
  });

  it("RK-001: 敵軍のユニットには追加されない（出典: atwiki/page-190「すべての自軍ユニットと…」）", () => {
    // 敵軍（player2）が自軍ターンに超電子ダイナモを使う。player1 の改造人間は player2 のユニットに効かない。
    let s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { operation: [inst("RK-001", "k")], deck: deckCards(5) },
        player2: { hand: [inst("RK-005", "dy")], rush: [inst("SPEC-MALE", "em")], command: releasedCat("ET", 1, "e"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = played(s, "RK-005:dy", "player2");
    expect(choiceIds(s)).toEqual([]);
  });

  it("RK-001: 自軍コマンドゾーンのユニットカードにも追加される（メカニック忍者で「改造人間」のカードとして出せる）（出典: atwiki/page-190「自軍コマンドゾーン…にあるユニットカード」・atwiki/page-196 カード評価「改造人間を使用して対象を増やす」）", () => {
    // 敵軍ターン、自軍 S ユニットがアタックされたときのメカニック忍者（RK-008）。
    const s = st(
      {
        activePlayer: "player2",
        player1: {
          operation: [inst("RK-001", "k")],
          battle: [inst("TST-UNIT-0", "d")],
          hand: [inst("RK-008", "nin")],
          command: [released("SPEC-MALE", "cm"), ...releasedCat("ET", 1)],
          power: powerCards(4),
          deck: deckCards(5),
        },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    const t = attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:d", "player2");
    const subs = legal(t)
      .filter((a) => (a.type === "initiate_command_payment" || a.type === "play_counter") && "substituteInstanceId" in a)
      .map((a) => (a as { substituteInstanceId?: string }).substituteInstanceId);
    expect(subs).toContain("SPEC-MALE:cm");
  });

  it("RK-001: 自軍捨札のユニットカードにも追加される（メンテナンスで「改造人間」のカードとして選べる）（出典: atwiki/page-190「自軍捨札にあるユニットカード」・atwiki/page-195）", () => {
    let s = played(
      rushBoard({
        hand: [inst("RK-007", "mt")],
        operation: [inst("RK-001", "k")],
        command: [released("TST-UNIT-0", "cu"), ...releasedCat("ET", 1)],
        power: powerCards(2),
        discard: [inst("SPEC-MALE", "dm"), inst("SPEC-MECHA", "dx")],
      }),
      "RK-007:mt",
    );
    s = resolveAll(s, ["TST-UNIT-0:cu"]);
    expect(zoneOf(s, "player1", "SPEC-MALE:dm")).toBe("command");
    expect(zoneOf(s, "player1", "SPEC-MECHA:dx")).toBe("discard");
  });

  it.todo(
    "RK-001: 追加した「改造人間」は既存の特徴の後ろに並ぶ（モーフの特徴の並び順に影響する）（出典: grnrngr/faq-rider-1 RK-013 Q7 の「追加される特徴は、既存の特徴の後ろに順番に追加されていきます」の類推）— 本カードを名指しした裁定がなく、並び順を公開 API で観測する手段もないため",
  );
  it.todo(
    "RK-001: atwiki カード評価 — 「ユニットカード」に追加するので、影響下でもモーフやシュードランは問題なく使える（出典: atwiki/page-190 カード評価）— 公式回答ではなく、RK-013 Q7（特徴の追加でモーフ不可）との関係が出典で確定しないため",
  );
});

// ===========================================================================
describe("RK-002 V3ホッパー", () => {
  const TEXT = "自軍山札の上から3枚を見て、そのカードを山札の上か下にそれぞれ好きな順で戻す。";
  const board = (deck = deckCards(5)) =>
    rushBoard({ hand: [inst("RK-002", "op")], command: releasedCat("ET", 1), deck });

  /** 見ているカードを1枚選び、山札の上（deck_top）か下（deck_bottom）に戻す。 */
  const place = (s: GameState, instanceId: string, where: "deck_top" | "deck_bottom") => pick(pick(s, instanceId), where);

  it("RK-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-191）", () => {
    expectCatalogText("RK-002", TEXT);
    expectOpStats("RK-002", { name: "V3ホッパー", category: "ET", powerCost: 0 });
    expectRarityIn("RK-002", ["MR", "N"]);
  });

  it("RK-002: 自軍山札の上から3枚を見る（選べるのはその3枚だけ・見送れない）（出典: atwiki/page-191「自軍山札の上から3枚を見て」）", () => {
    const s = played(board(), "RK-002:op");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-002");
    expect(choiceIds(s)).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-002: 1枚ずつ、山札の上か下を選んで戻す（上に戻したカードは後から戻したものほど上になる）（出典: atwiki/page-191「山札の上か下にそれぞれ好きな順で戻す」）", () => {
    let s = played(board(), "RK-002:op");
    s = place(s, "TST-OP:dk0", "deck_top");
    s = place(s, "TST-OP:dk1", "deck_bottom");
    s = place(s, "TST-OP:dk2", "deck_top");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk2", "TST-OP:dk0", "TST-OP:dk3", "TST-OP:dk4", "TST-OP:dk1"]);
  });

  it("RK-002: 3枚とも山札の下に戻してもよい（出典: atwiki/page-191「それぞれ」）", () => {
    let s = played(board(), "RK-002:op");
    s = place(s, "TST-OP:dk2", "deck_bottom");
    s = place(s, "TST-OP:dk0", "deck_bottom");
    s = place(s, "TST-OP:dk1", "deck_bottom");
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk3", "TST-OP:dk4", "TST-OP:dk2", "TST-OP:dk0", "TST-OP:dk1"]);
  });

  it("RK-002: 山札が3枚未満なら、あるカードだけを見る（出典: atwiki/page-191・R-TGT-01（できる限り実行する））", () => {
    const s = played(board(deckCards(2)), "RK-002:op");
    expect(choiceIds(s)).toEqual(["TST-OP:dk0", "TST-OP:dk1"]);
  });

  it("RK-002: 使ったカードは捨札になる（出典: atwiki/page-191（常駐ではない））", () => {
    let s = played(board(), "RK-002:op");
    for (const id of ["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2"]) s = place(s, id, "deck_top");
    expect(zoneOf(s, "player1", "RK-002:op")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-003 カイゾーグ", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 敵軍ターン中、自軍Sユニットが撃破されて捨札になったとき、自軍コマンドを1つホールドして次の効果を発動できる⇒そのユニットカードを自軍山札の下に戻す。";

  /** 敵軍（player2）ターン、自軍 S ユニット（target）が BP13000 のユニットにアタックされて撃破される。 */
  const destroyed = (p1: Partial<GameState["players"]["player1"]>, target: string) => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { operation: [inst("RK-003", "kz")], command: releasedCat("ET", 1), deck: deckCards(3), ...p1 },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    return settle(attack(s, "TST-UNIT-7:atk", target, "player2"));
  };

  it("RK-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-192）", () => {
    expectCatalogText("RK-003", TEXT);
    expectOpStats("RK-003", { name: "カイゾーグ", category: "ET", powerCost: 2 });
    expectRarityIn("RK-003", ["MR"]);
  });

  it("RK-003: 敵軍ターン中に自軍 S ユニットが撃破されて捨札になったとき、発動するかを選べる（任意）（出典: atwiki/page-192「発動できる」）", () => {
    const s = destroyed({ battle: [inst("TST-UNIT-0", "u")] }, "TST-UNIT-0:u");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-003");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-003: 発動すると自軍コマンドを1つホールドし、そのユニットカードを自軍山札の下に戻す（出典: atwiki/page-192「自軍コマンドを1つホールドして…自軍山札の下に戻す」）", () => {
    const s = resolveAll(destroyed({ battle: [inst("TST-UNIT-0", "u")] }, "TST-UNIT-0:u"), ["TST-UNIT-0:u"]);
    const deck = zoneIds(s, "player1", "deck");
    expect(deck[deck.length - 1]).toBe("TST-UNIT-0:u");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("deck");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RK-003: 発動しなければ捨札に残る（出典: atwiki/page-192「発動できる」）", () => {
    const s = settle(skip(destroyed({ battle: [inst("TST-UNIT-0", "u")] }, "TST-UNIT-0:u")));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
    expect(s.players.player1.command.some((c) => !c.commandHeld)).toBe(true);
  });

  it("RK-003: ホールドできるリリース状態の自軍コマンドがなければ発動できない（出典: atwiki/page-192「自軍コマンドを1つホールドして」）", () => {
    const s = destroyed({ battle: [inst("TST-UNIT-0", "u")], command: [held("TST-OP-ET", "h")] }, "TST-UNIT-0:u");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-003");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
  });

  it("RK-003: M ユニットが撃破されたときは発動しない（出典: atwiki/page-192「自軍Sユニットが」）", () => {
    const s = destroyed({ battle: [inst("SPEC-MALE-M", "m")] }, "SPEC-MALE-M:m");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-003");
    expect(zoneOf(s, "player1", "SPEC-MALE-M:m")).toBe("discard");
  });

  it("RK-003: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-192「敵軍ターン中、」）", () => {
    let s = st(
      {
        phase: "battle",
        player1: { operation: [inst("RK-003", "kz")], battle: [inst("TST-UNIT-0", "u")], command: releasedCat("ET", 1), deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = settle(attack(s, "TST-UNIT-0:u", "TST-UNIT-7:big"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-003");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
  });

  it("RK-003: 敵軍の S ユニットが撃破されたときは発動しない（出典: atwiki/page-192「自軍Sユニットが」）", () => {
    // 敵軍（player2）ターン。player2 の S ユニットが player1 の BP13000 ユニットにアタックして撃破される。
    let s = st(
      {
        activePlayer: "player2",
        player1: { operation: [inst("RK-003", "kz")], battle: [inst("TST-UNIT-7", "big")], command: releasedCat("ET", 1), deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = settle(attack(s, "TST-UNIT-0:e", "TST-UNIT-7:big", "player2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-003");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  // faq-rider-1 RK-003「はい、戻します。」
  it("RK-003: 公式Q&A — ボウケンレッドAT を山札の下に戻しても、捨札のボウケンレッドはラッシュエリアに戻す（出典: grnrngr/faq-rider-1 RK-003・atwiki/page-192 Q1）", () => {
    const s = resolveAll(
      destroyed({ battle: [inst("RS-241", "at")], discard: [inst("RS-062", "red")] }, "RS-241:at"),
      ["RS-241:at", "RS-062:red"],
    );
    expect(zoneOf(s, "player1", "RS-241:at")).toBe("deck");
    expect(zoneOf(s, "player1", "RS-062:red")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-004 ギギの腕輪", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 自軍Sユニットが敵軍Sユニットにアタックされたとき発動できる⇒そのバトルの間、アタックされたユニットはBP+2000される。";
  const ATK_S = sUnit("SPEC-ATK-S", { bp: 2500 });
  const ATK_S4 = sUnit("SPEC-ATK-S4", { bp: 4500 });
  const ATK_M = sUnit("SPEC-ATK-M", { bp: 2500, size: "M" });

  /** 敵軍（player2）ターン、player2 の attacker が自軍の defender にアタックする（反応ウィンドウは開いたまま）。 */
  const attacked = (defender: string, attacker = "SPEC-ATK-S:a", hand = [inst("RK-004", "g")]) => {
    const [did, dsuf] = defender.split(":") as [string, string];
    const [aid, asuf] = attacker.split(":") as [string, string];
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst(did, dsuf)], hand, command: releasedCat("WB", 2), power: powerCards(3), deck: deckCards(5) },
        player2: { battle: [inst(aid, asuf)], deck: deckCards(5, "e") },
      },
      [...EXTRA, ATK_S, ATK_S4, ATK_M],
    );
    return attack(s, attacker, defender, "player2");
  };
  const useCounter = (s: GameState, id = "RK-004:g") => {
    const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === id);
    let next = pay ? act(s, pay) : s;
    const play = legal(next).find((a) => a.type === "play_counter" && a.instanceId === id);
    if (play) next = act(next, play);
    return next;
  };
  const canCounter = (s: GameState, id = "RK-004:g") =>
    legal(s).some(
      (a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === id) || (a.type === "play_counter" && a.instanceId === id),
    );

  it("RK-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-175）", () => {
    expectCatalogText("RK-004", TEXT);
    expectOpStats("RK-004", { name: "ギギの腕輪", category: "WB", powerCost: 3 });
    expectRarityIn("RK-004", ["MR", "N"]);
  });

  it("RK-004: 自軍 S ユニットが敵軍 S ユニットにアタックされたとき使える（出典: atwiki/page-175）", () => {
    expect(canCounter(attacked("TST-UNIT-0:d"))).toBe(true);
  });

  it("RK-004: そのバトルの間、アタックされたユニットは BP+2000 され、BP2500 の S ユニットに勝つ（出典: atwiki/page-175「そのバトルの間、アタックされたユニットはBP+2000される」）", () => {
    const s = settle(useCounter(attacked("TST-UNIT-0:d")));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ATK-S:a")).toBe("discard");
  });

  // atwiki/page-175 Q2「「そのバトルの間」とありますので、アタックされて発生したそのバトルが終了するまで」
  it("RK-004: Q&A — 効果はそのバトルが終わるまで（バトル後は BP が戻る）（出典: grnrngr/faq-rider-1 RK-004・atwiki/page-175 Q2）", () => {
    const s = settle(useCounter(attacked("TST-UNIT-0:d")));
    expect(cardIn(s, "player1", "TST-UNIT-0:d")?.bpModifier ?? 0).toBe(0);
  });

  // atwiki/page-175 Q1「はい、できます。」
  it("RK-004: Q&A — 1回のアタックに2枚使えば BP+4000 になり、BP4500 の S ユニットに勝つ（出典: grnrngr/faq-rider-1 RK-004・atwiki/page-175 Q1・R-CTR-02）", () => {
    let s = attacked("TST-UNIT-0:d", "SPEC-ATK-S4:a", [inst("RK-004", "g"), inst("RK-004", "g2")]);
    s = useCounter(s, "RK-004:g");
    expect(canCounter(s, "RK-004:g2")).toBe(true);
    s = settle(useCounter(s, "RK-004:g2"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ATK-S4:a")).toBe("discard");
  });

  it("RK-004: 敵軍の M ユニットにアタックされたときは使えない（出典: atwiki/page-175「敵軍Sユニットにアタックされたとき」）", () => {
    expect(canCounter(attacked("TST-UNIT-0:d", "SPEC-ATK-M:a"))).toBe(false);
  });

  it("RK-004: 自軍の M ユニットがアタックされたときは使えない（出典: atwiki/page-175「自軍Sユニットが」）", () => {
    expect(canCounter(attacked("SPEC-MALE-M:d"))).toBe(false);
  });

  it("RK-004: ※カウンター — 自軍ターン中は使えない（出典: atwiki/page-175「これは敵軍ターン中にのみ使用できる」・R-CTR-01）", () => {
    const s = st(
      {
        phase: "battle",
        player1: { battle: [inst("TST-UNIT-0", "u")], hand: [inst("RK-004", "g")], command: releasedCat("WB", 2), power: powerCards(3), deck: deckCards(5) },
        player2: { battle: [inst("SPEC-ATK-S", "e")], deck: deckCards(5, "e") },
      },
      [ATK_S],
    );
    expect(canCounter(attack(s, "TST-UNIT-0:u", "SPEC-ATK-S:e"))).toBe(false);
  });
});

// ===========================================================================
describe("RK-005 超電子ダイナモ", () => {
  const TEXT =
    "特徴「改造人間」を持つ自軍Sユニットを1体選ぶ。そうしたとき、このターン、選んだユニットは次の能力を得る⇒SPが空欄ではないユニットを撃破したとき、相手に1点ダメージを与える。";
  const NOSP = sUnit("SPEC-NOSP-E", { bp: 1000, sp: undefined });

  /** 自軍ラッシュフェイズに改造人間（SPEC-KAIZO・BP3000）へ超電子ダイナモを copies 枚使い、バトルフェイズに進める。 */
  const dynamo = (enemy: ReturnType<typeof inst>[], copies = 1) => {
    const hand = Array.from({ length: copies }, (_, i) => inst("RK-005", `dy${i}`));
    let s = rushBoard(
      { hand, rush: [inst("SPEC-KAIZO", "k")], command: releasedCat("ET", copies) },
      { battle: enemy, power: powerCards(3, "epw") },
    );
    s = { ...s, definitions: { ...s.definitions, [NOSP.id]: NOSP } };
    for (let i = 0; i < copies; i++) s = resolveAll(played(s, `RK-005:dy${i}`), ["SPEC-KAIZO:k"]);
    s = nextPhase(s);
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-KAIZO:k" });
  };
  const battleWith = (s: GameState, defender: string) =>
    resolveAll(act(s, { type: "battle", playerId: "player1", attackerInstanceId: "SPEC-KAIZO:k", defenderInstanceId: defender }));

  it("RK-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-193）", () => {
    expectCatalogText("RK-005", TEXT);
    expectOpStats("RK-005", { name: "超電子ダイナモ", category: "ET", powerCost: 0 });
    expectRarityIn("RK-005", ["MR"]);
  });

  it("RK-005: 選べるのは特徴「改造人間」を持つ自軍 S ユニットだけ（M ユニット・改造人間でないユニットは選べない）（出典: atwiki/page-193「特徴「改造人間」を持つ自軍Sユニットを1体選ぶ」）", () => {
    const s = played(
      rushBoard({ hand: [inst("RK-005", "dy")], rush: [inst("SPEC-KAIZO", "k"), inst("SPEC-KAIZO-M", "km"), inst("SPEC-MALE", "m")], command: releasedCat("ET", 1) }, { rush: [inst("SPEC-KAIZO", "ek")] }),
      "RK-005:dy",
    );
    expect(choiceIds(s)).toEqual(["SPEC-KAIZO:k"]);
  });

  it("RK-005: 使っただけではダメージを与えない（出典: atwiki/page-193「…撃破したとき、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(
      played(rushBoard({ hand: [inst("RK-005", "dy")], rush: [inst("SPEC-KAIZO", "k")], command: releasedCat("ET", 1) }, { power: powerCards(3, "epw") }), "RK-005:dy"),
      ["SPEC-KAIZO:k"],
    );
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-005: このターン、選んだユニットが SP が空欄ではないユニットをバトルで撃破すると、相手に1点ダメージ（出典: atwiki/page-193・grnrngr/faq-rider-1 RK-005 Q「バトルによる撃破を行ったユニット」）", () => {
    const s = battleWith(dynamo([inst("TST-UNIT-0", "e")]), "TST-UNIT-0:e");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-005: SP が空欄のユニットを撃破してもダメージは与えない（出典: atwiki/page-193「SPが空欄ではないユニットを撃破したとき」）", () => {
    const s = battleWith(dynamo([inst("SPEC-NOSP-E", "e")]), "SPEC-NOSP-E:e");
    expect(zoneOf(s, "player2", "SPEC-NOSP-E:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  // faq-rider-1 RK-005「はい、その通りです。」（2枚使えば2点）
  it("RK-005: 公式Q&A — 1体に2枚使うと、撃破したとき相手に与えるダメージは2点（出典: grnrngr/faq-rider-1 RK-005・atwiki/page-193 Q4）", () => {
    const s = battleWith(dynamo([inst("TST-UNIT-0", "e")], 2), "TST-UNIT-0:e");
    expect(damageOf(s, "player2")).toBe(2);
  });

  it("RK-005: 撃破できなかったときはダメージを与えない（出典: atwiki/page-193「撃破したとき」）", () => {
    const s = battleWith(dynamo([inst("TST-UNIT-7", "big")]), "TST-UNIT-7:big");
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("battle");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-005: 次のターンには能力は残らない（出典: atwiki/page-193「このターン、」）", () => {
    // 自軍ターンに使い、次の敵軍ターンに敵軍 SP1 のユニットにアタックされてバトルで撃破しても、ダメージは与えない。
    let s = resolveAll(
      played(rushBoard({ hand: [inst("RK-005", "dy")], battle: [inst("SPEC-KAIZO", "k")], command: releasedCat("ET", 1) }, { rush: [inst("TST-UNIT-0", "e")], power: powerCards(3, "epw") }), "RK-005:dy"),
      ["SPEC-KAIZO:k"],
    );
    s = toPhase(endTurn(s), "player2", "battle");
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "TST-UNIT-0:e" });
    s = resolveAll(attack(s, "TST-UNIT-0:e", "SPEC-KAIZO:k", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  // atwiki/page-193 Q1（RK-183 側の atwiki/page-1000 Q1 と同じ公式回答）「いいえ、それはできません。」
  it.fails("RK-005: 公式Q&A — 超電子ダイナモを使った RK-183 仮面ライダーZO が【ZOキック】で SP のあるユニットを4体撃破して4点与えたあと、BP0 になって撃破されても、それを「撃破した」とみなして5点目を与えることはない（出典: atwiki/page-193 Q1・atwiki/page-1000 Q1）", () => {
    const VEH = { id: "SPEC-VEHICLE", name: "SPEC-VEHICLE", type: "vehicle", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 0, size: "S", features: ["メカ"] } as never;
    const enemy = Array.from({ length: 4 }, (_, i) => inst("TST-UNIT-0", `e${i}`));
    let s = rushBoard(
      { hand: [inst("RK-005", "dy")], rush: [inst("RK-183", "zo"), inst("SPEC-VEHICLE", "v")], command: releasedCat("ET", 1) },
      { battle: enemy, power: powerCards(6, "epw") },
    );
    s = { ...s, definitions: { ...s.definitions, "SPEC-VEHICLE": VEH } };
    s = resolveAll(played(s, "RK-005:dy"), ["RK-183:zo"]);
    s = nextPhase(s);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-183:zo", vehicleInstanceId: "SPEC-VEHICLE:v" });
    s = settle(act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true }));
    for (const e of enemy) s = resolveAll(attack(s, "RK-183:zo", e.instanceId));
    expect(zoneOf(s, "player1", "RK-183:zo")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(4);
  });
  it.todo(
    "RK-005: 公式Q&A — 撃破する効果を持つユニット（デカマスター【ディーソードベガ】・グリーンサイ【サイカッター】・モモレンジャー【ゴレンジャーハリケーン】）に使えば、効果で撃破したユニット1体につき1点（出典: grnrngr/faq-rider-1 RK-005 Q3〜Q6・grnrngr/faq-rider-2 RK-061 Q）— 撃破効果の持ち主の記録が RS-259/RS-279/RS-319 側の範囲で、それらのカードは特徴「改造人間」を持たないため（RS5-243-263.c・RS5-264-284.c の todo と同じ）",
  );
});

// ===========================================================================
describe("RK-006 セイリングジャンプ", () => {
  const TEXT = "※常駐（場に配置して、離れるまで効果が有効になる） ライドしていない自軍Sユニットは、ライド中のユニットにアタックされない。";
  const VEHICLE = { id: "SPEC-VEHICLE", name: "SPEC-VEHICLE", type: "vehicle", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 0, size: "S", features: ["メカ"] } as const;
  const RIDER = sUnit("SPEC-RIDER", { bp: 13000, comboNumber: "RC" });

  /** 敵軍（player2）バトルフェイズ。player2 のライド中のユニット（rd、ビークル v）と、ライドしていないユニット（nr）。 */
  const board = (p1: Partial<GameState["players"]["player1"]>, withOp = true) =>
    st(
      {
        activePlayer: "player2",
        player1: { operation: withOp ? [inst("RK-006", "sj")] : [], deck: deckCards(5), ...p1 },
        player2: {
          battle: [inst("SPEC-VEHICLE", "v"), { ...inst("SPEC-RIDER", "rd"), mountedOnInstanceId: "SPEC-VEHICLE:v" }, inst("TST-UNIT-7", "nr")],
          deck: deckCards(5, "e"),
        },
      },
      [...EXTRA, VEHICLE as never, RIDER],
    );

  it("RK-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-194）", () => {
    expectCatalogText("RK-006", TEXT);
    expectOpStats("RK-006", { name: "セイリングジャンプ", category: "ET", powerCost: 3 });
    expectRarityIn("RK-006", ["MR"]);
  });

  it("RK-006: ライドしていない自軍 S ユニットは、ライド中のユニットにアタックされない（出典: atwiki/page-194）", () => {
    const s = board({ battle: [inst("TST-UNIT-0", "s")] });
    expect(attackersOf(s, "TST-UNIT-0:s")).not.toContain("SPEC-RIDER:rd");
  });

  it("RK-006: ライドしていないユニットからはアタックされる（出典: atwiki/page-194「ライド中のユニットに」）", () => {
    const s = board({ battle: [inst("TST-UNIT-0", "s")] });
    expect(attackersOf(s, "TST-UNIT-0:s")).toContain("TST-UNIT-7:nr");
  });

  it("RK-006: 自軍 M ユニットはライド中のユニットにアタックされる（出典: atwiki/page-194「自軍Sユニットは」）", () => {
    const s = board({ battle: [inst("SPEC-MALE-M", "m")] });
    expect(attackersOf(s, "SPEC-MALE-M:m")).toContain("SPEC-RIDER:rd");
  });

  it("RK-006: 配置していなければライド中のユニットにアタックされる（出典: atwiki/page-194・R-KW-PERM-01）", () => {
    const s = board({ battle: [inst("TST-UNIT-0", "s")] }, false);
    expect(attackersOf(s, "TST-UNIT-0:s")).toContain("SPEC-RIDER:rd");
  });

  it.todo(
    "RK-006: ライド中の自軍 S ユニットはライド中のユニットにアタックされる（出典: atwiki/page-194「ライドしていない自軍Sユニットは」）— 自軍のライド中のユニットはビークルと一体で扱われ、守られる側の判定（ユニット・ビークルのどちらを見るか）が出典で確定しないため",
  );
});

// ===========================================================================
describe("RK-007 メンテナンス", () => {
  const TEXT =
    "自軍コマンドゾーンからリリース状態のSユニットのカードを1枚選び手札に戻す。その後、自軍捨札に特徴「改造人間」を持つSユニットのカードがあれば1枚選び、自軍コマンドゾーンにホールド状態で置く。";
  const board = (p1: Partial<GameState["players"]["player1"]>) =>
    rushBoard({ hand: [inst("RK-007", "mt")], power: powerCards(2), ...p1 });

  it("RK-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-195）", () => {
    expectCatalogText("RK-007", TEXT);
    expectOpStats("RK-007", { name: "メンテナンス", category: "ET", powerCost: 2 });
    expectRarityIn("RK-007", ["MR", "N"]);
  });

  it("RK-007: 選べるのはリリース状態の S ユニットのカードだけ（ホールド状態・M ユニット・オペレーションは選べない）（出典: atwiki/page-195「リリース状態のSユニットのカードを1枚選び」）", () => {
    const s = played(
      board({
        command: [released("TST-UNIT-0", "cu"), held("SPEC-MALE", "hm"), released("SPEC-MALE-M", "cm"), ...releasedCat("ET", 1)],
      }),
      "RK-007:mt",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-007");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:cu"]);
  });

  it("RK-007: 選んだカードを手札に戻す（出典: atwiki/page-195「手札に戻す」）", () => {
    const s = resolveAll(played(board({ command: [released("TST-UNIT-0", "cu"), ...releasedCat("ET", 1)] }), "RK-007:mt"), ["TST-UNIT-0:cu"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:cu")).toBe("hand");
  });

  it("RK-007: その後、自軍捨札の「改造人間」の S ユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-195「その後、…自軍コマンドゾーンにホールド状態で置く」）", () => {
    let s = played(
      board({ command: [released("TST-UNIT-0", "cu"), ...releasedCat("ET", 1)], discard: [inst("SPEC-KAIZO", "dk"), inst("SPEC-KAIZO-M", "dkm"), inst("SPEC-MALE", "dm")] }),
      "RK-007:mt",
    );
    s = pick(s, "TST-UNIT-0:cu");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-007");
    expect(choiceIds(s)).toEqual(["SPEC-KAIZO:dk"]);
    s = resolveAll(pick(s, "SPEC-KAIZO:dk"));
    expect(zoneOf(s, "player1", "SPEC-KAIZO:dk")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-KAIZO:dk")?.commandHeld).toBe(true);
  });

  it("RK-007: 自軍捨札に「改造人間」の S ユニットのカードがなければ、手札に戻すだけ（出典: atwiki/page-195「…があれば」）", () => {
    const s = resolveAll(
      played(board({ command: [released("TST-UNIT-0", "cu"), ...releasedCat("ET", 1)], discard: [inst("SPEC-MALE", "dm")] }), "RK-007:mt"),
      ["TST-UNIT-0:cu"],
    );
    expect(zoneOf(s, "player1", "TST-UNIT-0:cu")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-MALE:dm")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RK-007: 「その後」— 手札に戻せるカードがなくても、捨札の「改造人間」のカードをコマンドゾーンに置く（出典: atwiki/page-195「その後、」・grnrngr/faq-rider-1 RK-017 Q2「「その後」というテキストで続けられている処理は、その直前の操作が実行できたかどうかに関わらず、実行する」）", () => {
    const s = resolveAll(played(board({ command: releasedCat("ET", 1), discard: [inst("SPEC-KAIZO", "dk")] }), "RK-007:mt"), ["SPEC-KAIZO:dk"]);
    expect(zoneOf(s, "player1", "SPEC-KAIZO:dk")).toBe("command");
  });

  it("RK-007: 使ったカードは捨札になる（出典: atwiki/page-195（常駐ではない））", () => {
    const s = resolveAll(played(board({ command: [released("TST-UNIT-0", "cu"), ...releasedCat("ET", 1)] }), "RK-007:mt"), ["TST-UNIT-0:cu"]);
    expect(zoneOf(s, "player1", "RK-007:mt")).toBe("discard");
  });
});

