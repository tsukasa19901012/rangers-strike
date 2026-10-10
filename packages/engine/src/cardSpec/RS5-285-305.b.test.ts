/**
 * カード別スペック: RS-292〜RS-298（第5弾「五龍の逆鱗」気伝武人ウォンタイガー〜バーロ兵）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-5（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか faq-card-3/card_4/card_6 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { allCardsCatalog, validateDeckEntries } from "@rangers-strike/cards";
import {
  attackTargets,
  canEnter,
  canSkip,
  canStartRush,
  canUseCard,
  choiceIds,
  confirm,
  deckCards,
  enter,
  enterHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  passEntry,
  pick,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  rushVia,
  settle,
  skip,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RS5-285-305.helpers";
import type { CardInstance, GameState } from "../types/game";

const MAN = sUnit("SPEC-MAN", { features: ["男"], bp: 2000, sp: undefined });
const MAN4 = sUnit("SPEC-MAN4", { features: ["男"], bp: 4000, sp: undefined });
const WOMAN = sUnit("SPEC-WOMAN", { features: ["女"], bp: 3000, sp: undefined });
const NOGENDER = sUnit("SPEC-NOG", { bp: 1000, sp: undefined });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", size: "M", bp: 4000 });
const WB_DA_S = sUnit("SPEC-WB-DA", { category: ["WB", "DA"], bp: 1000 } as never);
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const SPECS = [MAN, MAN4, WOMAN, NOGENDER, DA_S, DA_M, WB_DA_S, OT_S];

/** 同名カードの通常3枚制限を超えて入れてもデッキ構築エラーにならないか（R-DECK-03）。 */
function deckUnlimitedOk(id: string, name: string): void {
  const filler = allCardsCatalog.cards
    .filter((c) => c.type === "operation" && c.id.startsWith("RS-0"))
    .slice(0, 20)
    .map((c) => ({ cardId: c.id, count: 1 }));
  const ok = validateDeckEntries([{ cardId: id, count: 10 }, ...filler], allCardsCatalog, { minSize: 1 });
  expect(ok.errors.filter((e) => e.includes(name))).toEqual([]);
}

// ===========================================================================
describe("RS-292 気伝武人ウォンタイガー", () => {
  const TEXT =
    "【虎の子大秘術】これが自軍ラッシュエリアにある間、自分が手札からオペレーションカードを使用するためにホールドするコマンドは、使用するカードと同じカテゴリのコマンドでなくてもよい。";

  it("RS-292: カタログ本文・スペックが出典と一致（出典: atwiki/page-476）", () => {
    expectCatalogText("RS-292", TEXT);
    expectStats("RS-292", {
      name: "気伝武人ウォンタイガー",
      category: "MA",
      size: "M",
      bp: 6000,
      sp: 1,
      powerCost: "5+",
      features: ["獣", "人型"],
      rushCondition: "discard_named_unit",
    });
  });

  // 「追加条件：自軍「気伝獣ウォンタイガー」1体を捨札にする」「必要パワー：5+」
  function wonRush(rush: CardInstance[], power: number) {
    return st({ phase: "rush", player1: { hand: [inst("RS-292", "w")], rush, power: powerCards(power), command: releasedN(1, "TST-OP-MA") } });
  }

  it("RS-292: 追加条件 — 自軍「気伝獣ウォンタイガー」1体を捨札にし、パワー5でラッシュできる（出典: atwiki/page-476）", () => {
    const r = rushFromHand(wonRush([inst("RS-293", "k")], 5), "player1", "RS-292:w");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-292:w")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-293:k")).toBe("discard");
  });

  it("RS-292: 「気伝獣ウォンタイガー」がいない、またはパワー4ではラッシュできない（出典: atwiki/page-476・R-ADD-02）", () => {
    expect(canStartRush(wonRush([inst("TST-UNIT-0", "u")], 5), "player1", "RS-292:w")).toBe(false);
    const r = rushFromHand(wonRush([inst("RS-293", "k")], 4), "player1", "RS-292:w");
    expect(r.ok && zoneOf(r.state, "player1", "RS-292:w") === "rush").toBe(false);
  });

  /** 手札に獣奏剣（WB・必要パワー3のオペレーション）。コマンドは DA が1つ。 */
  function opState(p1: Partial<GameState["players"]["player1"]>) {
    return st({ phase: "rush", player1: { hand: [inst("RS-243", "op")], command: [released("TST-OP-DA", "da")], power: powerCards(5), ...p1 } });
  }

  // 「自分が手札からオペレーションカードを使用するためにホールドするコマンドは、使用するカードと同じカテゴリのコマンドでなくてもよい」
  it("RS-292: 【虎の子大秘術】自軍ラッシュエリアにある間、手札のオペレーション（WB）を別カテゴリ（DA）のコマンドをホールドして使用できる（出典: atwiki/page-476）", () => {
    expect(canUseCard(opState({ rush: [inst("RS-292", "w")] }), "player1", "RS-243:op")).toBe(true);
  });

  it("RS-292: 【虎の子大秘術】がなければ別カテゴリのコマンドでは使用できない（同じカテゴリなら使用できる）（出典: atwiki/page-476・一般ルール）", () => {
    expect(canUseCard(opState({}), "player1", "RS-243:op")).toBe(false);
    expect(canUseCard(opState({ command: [released("TST-OP", "wb")] }), "player1", "RS-243:op")).toBe(true);
  });

  it("RS-292: 【虎の子大秘術】バトルエリアにあるときは効果がない（出典: atwiki/page-476「自軍ラッシュエリアにある間」）", () => {
    expect(canUseCard(opState({ battle: [inst("RS-292", "w")] }), "player1", "RS-243:op")).toBe(false);
  });

  it("RS-292: 【虎の子大秘術】ユニットのラッシュには働かない（WB ユニットを DA のコマンドではラッシュできない）（出典: atwiki/page-476「オペレーションカードを使用するために」）", () => {
    const s = st({ phase: "rush", player1: { rush: [inst("RS-292", "w")], hand: [inst("TST-UNIT-0", "u")], command: [released("TST-OP-DA", "da")], power: powerCards(5) } });
    expect(canStartRush(s, "player1", "TST-UNIT-0:u")).toBe(false);
  });
});

// ===========================================================================
describe("RS-293 気伝獣ウォンタイガー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【吼新星・大咆哮】自軍ターン中、これがバトルエリアに出たとき、敵軍山札の上から3枚をオモテにしてもよい。そうしたとき、オモテにしたカードの中から「DA」のカードをすべて捨札にし、それ以外を山札の上に好きな順で戻す。";

  it("RS-293: カタログ本文・スペックが出典と一致（出典: atwiki/page-477）", () => {
    expectCatalogText("RS-293", TEXT);
    expectStats("RS-293", {
      name: "気伝獣ウォンタイガー",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      features: ["獣"],
    });
  });

  it("RS-293: ※ リリース状態の自軍コマンドがなければ出られず、1つホールドすれば出られる（出典: atwiki/page-477）", () => {
    expect(canEnter(st({ player1: { rush: [inst("RS-293", "w")] } }), "RS-293:w")).toBe(false);
    const s = enterHold(st({ player1: { rush: [inst("RS-293", "w")], command: releasedN(1) } }), "RS-293:w");
    expect(zoneOf(s, "player1", "RS-293:w")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  const enemyDeck = () => [inst("SPEC-DA-S", "d1"), inst("SPEC-OT-S", "o1"), inst("SPEC-WB-DA", "m1"), inst("TST-OP", "x")];
  function wonEnters() {
    const s = st({ player1: { rush: [inst("RS-293", "w")], command: releasedN(1) }, player2: { deck: enemyDeck() } }, SPECS);
    return enterHold(s, "RS-293:w");
  }

  // 「敵軍山札の上から3枚をオモテにしてもよい。そうしたとき、…「DA」のカードをすべて捨札にし、それ以外を山札の上に好きな順で戻す」
  // atwiki/page-477 コメント「DAのカードとはマルチカテゴリも含みますか？」「↑含みます。」
  it("RS-293: 【吼新星・大咆哮】敵軍山札の上3枚をオモテにし、DA のカード（マルチカテゴリを含む）をすべて捨札にし、それ以外を山札の上に戻す（出典: atwiki/page-477）", () => {
    let s = wonEnters();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-293");
    s = settle(confirm(s));
    for (let i = 0; i < 3 && s.pendingEffectChoice?.sourceCardId === "RS-293"; i++) s = settle(pick(s, s.pendingEffectChoice.validInstanceIds[0]!));
    expect(zoneOf(s, "player2", "SPEC-DA-S:d1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WB-DA:m1")).toBe("discard");
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["SPEC-OT-S:o1", "TST-OP:x"]);
  });

  it("RS-293: 【吼新星・大咆哮】オモテにしないことを選べる（任意）（出典: atwiki/page-477「オモテにしてもよい」）", () => {
    let s = wonEnters();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-293");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(enemyDeck().map((c) => c.instanceId));
  });

  it.todo(
    "RS-293: 【吼新星・大咆哮】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-477「自軍ターン中」）— 敵軍ターン中に M ユニットをバトルエリアに出す手段がエンジンで用意できない",
  );

  // faq-card-5 RS-293 Q1「はい、見せなければなりません。…戻すときは順番が相手にもわかるように1枚ずつ指定して下さい。」
  it.todo(
    "RS-293: 公式Q&A — 山札の上に戻す順番は相手に見せる（出典: grnrngr/faq-card-5 RS-293 Q1）— 公開情報の提示（相手への見せ方）はエンジンの状態として表現されないため検証できない",
  );
});

// ===========================================================================
describe("RS-294 キバレンジャー", () => {
  const TEXT =
    "【吼新星・乱れ山彦】敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、相手はオモテにしたカードを手札に加えるか、自分自身のパワーゾーンにダメージにして置くかを選ぶ。相手が手札に加えることを選んだとき、敵軍Sユニットがあれば1体選び撃破する。";

  it("RS-294: カタログ本文・スペックが出典と一致（出典: atwiki/page-478）", () => {
    expectCatalogText("RS-294", TEXT);
    expectStats("RS-294", {
      name: "キバレンジャー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 5,
      comboNumber: 3,
      features: ["ホワイト", "男"],
    });
  });

  function kibaAt(pos: number, enemyBattle: CardInstance[] = [inst("TST-UNIT-0", "es"), inst("SPEC-DA-M", "em")]) {
    const s = st(
      { player1: { battle: fillers(pos - 1), rush: [inst("RS-294", "k")] }, player2: { battle: enemyBattle, deck: [inst("TST-OP", "top"), inst("TST-OP", "x")] } },
      SPECS,
    );
    return enter(s, "RS-294:k");
  }

  // 「相手はオモテにしたカードを手札に加えるか…を選ぶ。相手が手札に加えることを選んだとき、敵軍Sユニットがあれば1体選び撃破する」
  it("RS-294: 【吼新星・乱れ山彦】（NC 成立）相手が手札に加えることを選んだら、敵軍 S ユニットを1体選び撃破する（出典: atwiki/page-478）", () => {
    let s = kibaAt(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-294");
    s = confirm(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = pick(s, "TST-OP:top");
    expect(zoneOf(s, "player2", "TST-OP:top")).toBe("hand");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
    s = settle(pick(s, "TST-UNIT-0:es"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("discard");
  });

  it("RS-294: 【吼新星・乱れ山彦】相手がダメージにして置くことを選んだら、ウラ向きでパワーゾーンに置き（1点）、ユニットは撃破しない（出典: atwiki/page-478）", () => {
    let s = kibaAt(3);
    s = confirm(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = settle(skip(s));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP:top")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("battle");
  });

  it("RS-294: 【吼新星・乱れ山彦】オモテにしないことを選べる（任意）（出典: atwiki/page-478「オモテにしてもよい」）", () => {
    const s = kibaAt(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-294");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-294: 【吼新星・乱れ山彦】手札に加えることを選んでも、敵軍 S ユニットがなければ撃破しない（M ユニットは選べない）（出典: atwiki/page-478「敵軍Sユニットがあれば」）", () => {
    let s = kibaAt(3, [inst("SPEC-DA-M", "em")]);
    s = confirm(s);
    s = settle(pick(s, "TST-OP:top"));
    expect(zoneOf(s, "player2", "TST-OP:top")).toBe("hand");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-DA-M:em")).toBe("battle");
  });

  it("RS-294: NC が成立していない（2番目）ときは発動しない（出典: atwiki/page-478「CN：3」・R-CN-02）", () => {
    const s = settle(passEntry(kibaAt(2)));
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-OP:top", "TST-OP:x"]);
    expect(s.players.player2.hand).toHaveLength(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-295 磁石神父", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。【磁力拳】特徴に「男」または「女」の性別を持つ敵軍ユニットを2体選んでもよい。そうしたとき、選んだ2体の性別が同じならそれぞれ持ち主の手札に戻し、違うなら選んだ2体でバトルする。";

  it("RS-295: カタログ本文・スペックが出典と一致（出典: atwiki/page-433）", () => {
    expectCatalogText("RS-295", TEXT);
    expectStats("RS-295", {
      name: "磁石神父",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 2,
      features: ["怪人", "男"],
    });
  });

  // 「※これはラッシュしたターンにバトルエリアに出られない」
  it("RS-295: ※ ラッシュしたターンはバトルエリアに出られない（前のターンからラッシュエリアにあれば出られる）（出典: atwiki/page-433）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RS-295", "new")], rush: [inst("RS-295", "old")], command: releasedN(1, "TST-OP-DA"), power: powerCards(3), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-295:new");
    expect(r.ok).toBe(true);
    s = toPhase(r.state, "player1", "battle");
    expect(canEnter(s, "RS-295:new")).toBe(false);
    expect(canEnter(s, "RS-295:old")).toBe(true);
  });

  function magnet(enemyBattle: CardInstance[], pos = 2, p1: Partial<GameState["players"]["player1"]> = {}) {
    const s = st(
      { player1: { battle: fillers(pos - 1), rush: [inst("RS-295", "j")], ...p1 }, player2: { battle: enemyBattle, deck: deckCards(3, "e") } },
      SPECS,
    );
    return enter(s, "RS-295:j");
  }
  const board = () => [inst("SPEC-MAN", "m1"), inst("SPEC-WOMAN", "w1"), inst("SPEC-MAN4", "m2"), inst("SPEC-NOG", "n")];

  // 「特徴に「男」または「女」の性別を持つ敵軍ユニットを2体選んでもよい」
  it("RS-295: 【磁力拳】（NC 成立）選べるのは性別（男・女）を持つ敵軍ユニットだけで、選ばないこともできる（出典: atwiki/page-433）", () => {
    let s = magnet(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-295");
    expect(choiceIds(s)).toEqual(["SPEC-MAN4:m2", "SPEC-MAN:m1", "SPEC-WOMAN:w1"]);
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(s.players.player2.battle).toHaveLength(4);
  });

  // 「選んだ2体の性別が同じならそれぞれ持ち主の手札に戻し」
  it("RS-295: 【磁力拳】性別が同じ2体（男・男）はそれぞれ持ち主の手札に戻す（出典: atwiki/page-433）", () => {
    let s = magnet(board());
    s = pick(s, "SPEC-MAN:m1");
    s = settle(pick(s, "SPEC-MAN4:m2"));
    expect(zoneOf(s, "player2", "SPEC-MAN:m1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-MAN4:m2")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-WOMAN:w1")).toBe("battle");
  });

  // 「違うなら選んだ2体でバトルする」
  it("RS-295: 【磁力拳】性別が違う2体（男 BP2000・女 BP3000）はバトルし、BP の低い方が撃破される（出典: atwiki/page-433）", () => {
    let s = magnet(board());
    s = pick(s, "SPEC-WOMAN:w1");
    s = settle(pick(s, "SPEC-MAN:m1"));
    expect(zoneOf(s, "player2", "SPEC-MAN:m1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WOMAN:w1")).toBe("battle");
  });

  it("RS-295: 【磁力拳】NC が成立していない（1番目）ときは発動しない（出典: atwiki/page-433「CN：2」・R-CN-02）", () => {
    const s = magnet(board(), 1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-295");
  });

  // faq-card-5 RS-295 Q1（faq-card-4 RS-203 にも同文）「「男」なおかつ「女」となったユニットと「男」を選んだ場合は「性別が違う」…「男」なおかつ「女」となったユニットを2体選んだ場合は「性別が同じ」」
  function deusThenMagnet() {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-203", "deus")],
          rush: [inst("SPEC-MAN", "mat"), inst("RS-295", "j")],
          power: powerCards(5),
          command: releasedN(1, "TST-OP-DA"),
          deck: deckCards(6),
        },
        player2: { battle: [inst("SPEC-WOMAN", "w1"), inst("SPEC-WOMAN", "w2"), inst("SPEC-MAN4", "m1")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    const r = rushVia(s, "player1", "RS-203:deus", (a) => JSON.stringify(a.zordMaterialInstanceIds ?? []) === JSON.stringify(["SPEC-MAN:mat"]));
    expect(r.ok).toBe(true);
    s = toPhase(r.state, "player1", "battle");
    s = passEntry(enter(s, "RS-203:deus"));
    return enter(s, "RS-295:j");
  }

  it("RS-295: 公式Q&A — デウス遺伝子で「男」を追加して「男」かつ「女」になった2体は性別が同じ（手札に戻す）（出典: grnrngr/faq-card-5 RS-295 Q1・faq-card-4）", () => {
    let s = deusThenMagnet();
    expect(choiceIds(s)).toEqual(["SPEC-MAN4:m1", "SPEC-WOMAN:w1", "SPEC-WOMAN:w2"]);
    s = pick(s, "SPEC-WOMAN:w1");
    s = settle(pick(s, "SPEC-WOMAN:w2"));
    expect(zoneOf(s, "player2", "SPEC-WOMAN:w1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-WOMAN:w2")).toBe("hand");
  });

  it("RS-295: 公式Q&A — 「男」かつ「女」になったユニットと「男」のユニットは性別が違う（バトルする）（出典: grnrngr/faq-card-5 RS-295 Q1・faq-card-4）", () => {
    let s = deusThenMagnet();
    s = pick(s, "SPEC-WOMAN:w1");
    s = settle(pick(s, "SPEC-MAN4:m1"));
    // 女（BP3000）と男（BP4000）がバトル → 女が撃破される
    expect(zoneOf(s, "player2", "SPEC-WOMAN:w1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MAN4:m1")).toBe("battle");
  });

  // faq-card-5 RS-256 Q2「はい、その通りです。」（磁石神父の効果で敵軍ユニット同士をバトルさせて撃破しても「敵軍ユニットを1体撃破するたび」を満たす）
  it("RS-295: 公式Q&A — 【磁力拳】で敵軍ユニット同士をバトルさせて撃破したとき、闇の戒律の「敵軍ユニットを1体撃破するたび」を満たす（出典: grnrngr/faq-card-5 RS-256 Q）", () => {
    const kairitsu = { ...inst("RS-256", "k"), stackedCards: [{ ...inst("TST-OP", "s1"), faceDown: true }, { ...inst("TST-OP", "s2"), faceDown: true }] };
    let s = magnet([inst("SPEC-WOMAN", "w1"), inst("SPEC-MAN", "m1")], 2, { operation: [kairitsu] });
    s = pick(s, "SPEC-WOMAN:w1");
    s = settle(pick(s, "SPEC-MAN:m1"));
    expect(zoneOf(s, "player2", "SPEC-MAN:m1")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.operation[0]?.stackedCards).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-296 バラクティカ", () => {
  const TEXT =
    "【編隊出撃】これが自軍ラッシュエリアにある間、次の効果を発動できる⇒自軍コマンドをホールドして特徴「航空機」を持つユニットをラッシュしたとき、ラッシュしたユニットと同じカード名のユニットカードを自分の手札から1枚選びラッシュエリアに出す。";

  it("RS-296: カタログ本文・スペックが出典と一致（出典: atwiki/page-434）", () => {
    expectCatalogText("RS-296", TEXT);
    expectStats("RS-296", {
      name: "バラクティカ",
      category: "DA",
      size: "XL",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["メカ", "母艦"],
    });
  });

  /** トリプター（OT・M・航空機・必要パワー3・追加条件なし）を手札から。 */
  function formation(p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) {
    return st({
      phase: "rush",
      player1: {
        rush: [inst("RS-296", "b")],
        hand: [inst("RS-668", "a1"), inst("RS-668", "a2"), inst("RS-666", "other")],
        command: releasedN(1, "TST-OP-OT"),
        power: powerCards(3),
        ...p1,
      },
      player2: p2,
    });
  }

  // 「自軍コマンドをホールドして特徴「航空機」を持つユニットをラッシュしたとき、…同じカード名のユニットカードを自分の手札から1枚選びラッシュエリアに出す」
  // faq-card-5 RS-296 Q1「いいえ、その必要はありません。」・RS-318 Q「その場合はコマンドをホールドする必要はありません」
  it("RS-296: 【編隊出撃】航空機をラッシュしたとき、手札の同名カードだけを選べ、コマンドのホールドも必要パワーもなしにラッシュエリアに出す（出典: atwiki/page-434・grnrngr/faq-card-5 RS-296 Q1・RS-318 Q）", () => {
    const r = rushFromHand(formation({}), "player1", "RS-668:a1");
    expect(r.ok).toBe(true);
    let s = r.state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-296");
    expect(choiceIds(s)).toEqual(["RS-668:a2"]);
    s = pick(s, "RS-668:a2");
    expect(zoneOf(s, "player1", "RS-668:a2")).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
    expect(zoneOf(s, "player1", "RS-666:other")).toBe("hand");
    expect(s.players.player1.discard).toHaveLength(0);
  });

  it("RS-296: 【編隊出撃】発動しないことを選べる（出典: atwiki/page-434「発動できる」）", () => {
    let s = rushFromHand(formation({}), "player1", "RS-668:a1").state;
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-668:a2")).toBe("hand");
  });

  it("RS-296: 【編隊出撃】効果でラッシュエリアに出したユニットでは再び発動しない（出典: atwiki/page-434「自軍コマンドをホールドして…ラッシュしたとき」・R-ADD 04-rush.md）", () => {
    let s = rushFromHand(formation({ hand: [inst("RS-668", "a1"), inst("RS-668", "a2"), inst("RS-668", "a3")] }), "player1", "RS-668:a1").state;
    s = pick(s, "RS-668:a2");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "RS-668:a3")).toBe("hand");
  });

  it("RS-296: 【編隊出撃】航空機を持たないユニットのラッシュでは発動しない（出典: atwiki/page-434）", () => {
    const s0 = formation({ hand: [inst("TST-UNIT-0", "u1"), inst("TST-UNIT-0", "u2")], command: releasedN(1) });
    const r = rushFromHand(s0, "player1", "TST-UNIT-0:u1");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:u2")).toBe("hand");
  });

  it("RS-296: 【編隊出撃】バトルエリアにあるときは発動しない（出典: atwiki/page-434「自軍ラッシュエリアにある間」）", () => {
    const r = rushFromHand(formation({ rush: [], battle: [inst("RS-296", "b")] }), "player1", "RS-668:a1");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice).toBeUndefined();
  });

  // faq-card-5 RS-296 Q2「いいえ、追加条件を満たす必要はありません。」
  it("RS-296: 公式Q&A — 追加でラッシュエリアに出すユニットは追加条件を満たさなくてよい（メラージュ戦闘機）（出典: grnrngr/faq-card-5 RS-296 Q2）", () => {
    const s0 = formation({ hand: [inst("RS-261", "m1"), inst("RS-261", "m2")], rush: [inst("RS-296", "b"), inst("TST-UNIT-0", "sm")], command: releasedN(1, "TST-OP-DA"), power: powerCards(2) });
    const r = rushFromHand(s0, "player1", "RS-261:m1", { materials: ["TST-UNIT-0:sm"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:sm")).toBe("discard");
    const s = pick(r.state, "RS-261:m2");
    expect(zoneOf(s, "player1", "RS-261:m2")).toBe("rush");
  });

  // faq-card-3 RS-170 Q・faq-card-5 RS-296 Q3「いいえ、必要パワーを満たす必要はありません。」
  it("RS-296: 公式Q&A — エージェント・アブレラで必要パワーの不足を補ってラッシュしたときも、追加のユニットは必要パワーを満たさなくてよい（出典: grnrngr/faq-card-5 RS-296 Q3・faq-card-3 RS-170）", () => {
    const s0 = formation({
      hand: [inst("RS-261", "m1"), inst("RS-261", "m2")],
      rush: [inst("RS-296", "b"), inst("RS-170", "ab"), inst("TST-UNIT-0", "sm")],
      command: releasedN(3, "TST-OP-DA"),
      power: [],
    });
    const r = rushFromHand(s0, "player1", "RS-261:m1", { materials: ["TST-UNIT-0:sm"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-261:m1")).toBe("rush");
    const s = pick(r.state, "RS-261:m2");
    expect(zoneOf(s, "player1", "RS-261:m2")).toBe("rush");
  });

  // faq-card-5 RS-296 Q4（faq-card-4 にも同文）「はい、発動することができます。」
  it.fails("RS-296: 公式Q&A — 大帝ラー・デウスを「航空機」のユニットを捨札にしてラッシュしたターンは、航空機を持たないユニットのラッシュでも発動できる（出典: grnrngr/faq-card-5 RS-296 Q4・faq-card-4）", () => {
    // 既知の不具合: CARD-RS-296 【編隊出撃】が印刷された特徴だけを見て、デウス遺伝子で追加された特徴「航空機」を考慮しない（rules/formationDeploy.ts）
    let s = formation({
      hand: [inst("RS-203", "deus"), inst("TST-UNIT-0", "u1"), inst("TST-UNIT-0", "u2")],
      rush: [inst("RS-296", "b"), inst("RS-668", "air")],
      command: [released("TST-OP-DA", "da"), released("TST-OP", "wb")],
      power: powerCards(5),
    });
    const r = rushVia(s, "player1", "RS-203:deus", (a) => JSON.stringify(a.zordMaterialInstanceIds ?? []) === JSON.stringify(["RS-668:air"]));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-668:air")).toBe("discard");
    s = r.state;
    for (let i = 0; i < 3 && s.pendingEffectChoice; i++) s = skip(s);
    const r2 = rushFromHand(s, "player1", "TST-UNIT-0:u1");
    expect(r2.ok).toBe(true);
    expect(r2.state.pendingEffectChoice?.sourceCardId).toBe("RS-296");
    expect(choiceIds(r2.state)).toEqual(["TST-UNIT-0:u2"]);
  });

  // faq-card-5 RS-296 Q5（faq-card-4 RS-223 にも同文）「はい、発動することができます。」
  it("RS-296: 公式Q&A — タックの【緊急システム発動要請】（敵軍コマンドのリリース）で航空機をラッシュしたときも発動できる（出典: grnrngr/faq-card-5 RS-296 Q5・faq-card-4 RS-223）", () => {
    const s0 = formation({ rush: [inst("RS-296", "b"), inst("RS-223", "tk")], command: [] }, { command: [held("TST-OP", "eh")] });
    const r = rushFromHand(s0, "player1", "RS-668:a1");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-668:a1")).toBe("rush");
    expect(r.state.players.player2.command[0]?.commandHeld).toBe(false);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-296");
    const s = pick(r.state, "RS-668:a2");
    expect(zoneOf(s, "player1", "RS-668:a2")).toBe("rush");
  });

  // faq-card-6 RS-353 Q「はい、できます。同時タイミングの処理になりますので、ターンプレイヤーが「RS-353 デンジファイター」の効果を先に処理してから…」
  it.todo(
    "RS-296: 公式Q&A — デンジファイターの【ファイターチェンジ】で手札に加えたデンジファイターを、ターンプレイヤーが先に処理する順を選べば【編隊出撃】で出せる（出典: grnrngr/faq-card-6 RS-353 Q）— テスト状況でデンジファイター（追加条件 send_s_unit_to_discard）をラッシュする合法手が出ず、状況を作れない",
  );
});

// ===========================================================================
describe("RS-297 タコンパス", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。【変形】自軍コマンドがすべてリリース状態なら、これは特徴「航空機」を持たないユニットにアタックされない。";

  it("RS-297: カタログ本文・スペックが出典と一致（出典: atwiki/page-435）", () => {
    expectCatalogText("RS-297", TEXT);
    expectStats("RS-297", {
      name: "タコンパス",
      category: "DA",
      size: "M",
      bp: 1500,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-297: ※ デッキに4枚以上入れてもデッキ構築エラーにならない（出典: atwiki/page-435・R-DECK-03）", () => {
    deckUnlimitedOk("RS-297", "タコンパス");
  });

  // 「追加条件：自軍Sユニットを1体捨札にする」「必要パワー：3+」
  it("RS-297: 追加条件 — 自軍 S ユニットを1体捨札にし、パワー3でラッシュできる（S ユニットがなければできない）（出典: atwiki/page-435）", () => {
    const mk = (rush: CardInstance[]) => st({ phase: "rush", player1: { hand: [inst("RS-297", "t")], rush, power: powerCards(3), command: releasedN(1, "TST-OP-DA") } }, SPECS);
    const r = rushFromHand(mk([inst("TST-UNIT-0", "s")]), "player1", "RS-297:t", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-297:t")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
    expect(canStartRush(mk([inst("SPEC-DA-M", "m")]), "player1", "RS-297:t")).toBe(false);
  });

  function attacked(ownCommand: CardInstance[]) {
    return st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-297", "t")], command: ownCommand },
        player2: { battle: [inst("TST-UNIT-0", "a"), inst("RS-668", "air")] },
      },
      SPECS,
    );
  }

  // 「自軍コマンドがすべてリリース状態なら、これは特徴「航空機」を持たないユニットにアタックされない」
  it("RS-297: 【変形】自軍コマンドがすべてリリース状態なら、航空機を持たないユニットにアタックされない（出典: atwiki/page-435）", () => {
    expect(attackTargets(attacked(releasedN(2)), "TST-UNIT-0:a", "player2")).not.toContain("RS-297:t");
  });

  it("RS-297: 【変形】航空機を持つユニットにはアタックされる（出典: atwiki/page-435）", () => {
    expect(attackTargets(attacked(releasedN(2)), "RS-668:air", "player2")).toContain("RS-297:t");
  });

  it("RS-297: 【変形】ホールド状態の自軍コマンドがあれば、航空機を持たないユニットにもアタックされる（出典: atwiki/page-435「すべてリリース状態なら」）", () => {
    expect(attackTargets(attacked([released("TST-OP", "r"), held("TST-OP", "h")]), "TST-UNIT-0:a", "player2")).toContain("RS-297:t");
  });
});

// ===========================================================================
describe("RS-298 バーロ兵", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RS-298: カタログ本文・スペックが出典と一致（出典: atwiki/page-427）", () => {
    expectCatalogText("RS-298", TEXT);
    expectStats("RS-298", {
      name: "バーロ兵",
      category: "DA",
      size: "S",
      bp: 1500,
      sp: undefined,
      powerCost: 3,
      features: ["メカ", "戦闘員"],
    });
  });

  it("RS-298: ※ デッキに4枚以上入れてもデッキ構築エラーにならない（出典: atwiki/page-427・R-DECK-03）", () => {
    deckUnlimitedOk("RS-298", "バーロ兵");
  });

  it("RS-298: 必要パワー3・DA コマンド1つのホールドでラッシュでき、パワー2ではできない（出典: atwiki/page-427）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-298", "b")], power: powerCards(n), command: releasedN(1, "TST-OP-DA") } });
    expect(canStartRush(mk(2), "player1", "RS-298:b")).toBe(false);
    const r = rushFromHand(mk(3), "player1", "RS-298:b");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-298:b")).toBe("rush");
  });
});
