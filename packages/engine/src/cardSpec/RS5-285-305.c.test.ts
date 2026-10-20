/**
 * カード別スペック: RS-299〜RS-305（第5弾「五龍の逆鱗」VRVマスター〜ガオパンダ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-5（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか faq-card-6/card-8/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { allCardsCatalog, validateDeckEntries } from "@rangers-strike/cards";
import {
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  canUseCard,
  choiceIds,
  damageCards,
  deckCards,
  drain,
  enter,
  enterHold,
  expectCatalogText,
  expectStats,
  held,
  inst,
  pick,
  powerCards,
  raw,
  released,
  releasedN,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  useCard,
  zoneOf,
} from "./RS5-285-305.helpers";
import type { CardInstance, GameState } from "../types/game";

const MECHA_M = sUnit("SPEC-MECHA-M", { size: "M", category: "OT", bp: 4000, sp: undefined, features: ["メカ"], powerCost: 9 });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { size: "M", category: "OT", bp: 4000, sp: undefined, powerCost: 9 });
const MECHA_S = sUnit("SPEC-MECHA-S", { size: "S", category: "OT", bp: 1000, features: ["メカ"], powerCost: 9 });
const OT_M = sUnit("SPEC-OT-M", { size: "M", category: "OT", bp: 4000, sp: undefined, powerCost: 0 });
const S2000 = sUnit("SPEC-S2000", { bp: 2000, sp: undefined });
const DA_S2 = sUnit("SPEC-DA-S2", { category: "DA", bp: 1000, powerCost: 2 });
const DA_M2 = sUnit("SPEC-DA-M2", { category: "DA", size: "M", bp: 4000, powerCost: 2 });
const WB_S2 = sUnit("SPEC-WB-S2", { category: "WB", bp: 1000, powerCost: 2 });
const BIG = sUnit("SPEC-BIG", { bp: 13000, sp: 1, size: "L" });
const SPECS = [MECHA_M, PLAIN_M, MECHA_S, OT_M, S2000, DA_S2, DA_M2, WB_S2, BIG];

function deckUnlimitedOk(id: string, name: string): void {
  const filler = allCardsCatalog.cards
    .filter((c) => c.type === "operation" && c.id.startsWith("RS-0"))
    .slice(0, 20)
    .map((c) => ({ cardId: c.id, count: 1 }));
  const ok = validateDeckEntries([{ cardId: id, count: 10 }, ...filler], allCardsCatalog, { minSize: 1 });
  expect(ok.errors.filter((e) => e.includes(name))).toEqual([]);
}

// ===========================================================================
describe("RS-299 VRVマスター", () => {
  const TEXT =
    "【乗ってみないか？】これが自軍ラッシュエリアにある間、自分がSユニットをラッシュするたび、自軍山札の上から1枚をオモテにする。オモテにしたカードが特徴「メカ」を持つMユニットのカードなら手札に加え、それ以外は山札の上に戻す。";

  it("RS-299: カタログ本文・スペックが出典と一致（出典: atwiki/page-446）", () => {
    expectCatalogText("RS-299", TEXT);
    expectStats("RS-299", {
      name: "VRVマスター",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 2,
      features: ["男"],
    });
  });

  function vrv(hand: CardInstance[], deck: CardInstance[], zone: "rush" | "battle" = "rush") {
    return st(
      { phase: "rush", player1: { [zone]: [inst("RS-299", "v")], hand, command: [...releasedN(2), ...releasedN(1, "TST-OP-OT", "ot")], power: powerCards(2), deck } },
      SPECS,
    );
  }

  // 「自分がSユニットをラッシュするたび、自軍山札の上から1枚をオモテにする。…特徴「メカ」を持つMユニットのカードなら手札に加え」
  it("RS-299: 【乗ってみないか？】S ユニットをラッシュしたとき、山札の上が「メカ」を持つ M ユニットのカードなら手札に加える（出典: atwiki/page-446）", () => {
    const r = rushFromHand(vrv([inst("TST-UNIT-0", "s")], [inst("SPEC-MECHA-M", "top"), inst("TST-OP", "x")]), "player1", "TST-UNIT-0:s");
    expect(r.ok).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "SPEC-MECHA-M:top")).toBe("hand");
  });

  it("RS-299: 【乗ってみないか？】S ユニットをラッシュする「たび」— 2回ラッシュすれば2回オモテにする（出典: atwiki/page-446「ラッシュするたび」）", () => {
    const deck = [inst("SPEC-MECHA-M", "t1"), inst("SPEC-MECHA-M", "t2"), inst("TST-OP", "x")];
    let r = rushFromHand(vrv([inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2")], deck), "player1", "TST-UNIT-0:s1");
    r = rushFromHand(settle(r.state), "player1", "TST-UNIT-0:s2");
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "SPEC-MECHA-M:t1")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-MECHA-M:t2")).toBe("hand");
  });

  it("RS-299: 【乗ってみないか？】オモテにしたカードが「メカ」を持たない M ユニットや「メカ」の S ユニットなら山札の上に戻す（出典: atwiki/page-446「それ以外は山札の上に戻す」）", () => {
    for (const top of ["SPEC-PLAIN-M", "SPEC-MECHA-S"]) {
      const r = rushFromHand(vrv([inst("TST-UNIT-0", "s")], [inst(top, "top"), inst("TST-OP", "x")]), "player1", "TST-UNIT-0:s");
      const s = settle(r.state);
      expect(s.players.player1.deck[0]?.instanceId).toBe(`${top}:top`);
      expect(s.players.player1.hand).toHaveLength(0);
    }
  });

  it("RS-299: 【乗ってみないか？】M ユニットのラッシュでは発動しない（出典: atwiki/page-446「Sユニットをラッシュするたび」）", () => {
    const r = rushFromHand(vrv([inst("SPEC-OT-M", "m")], [inst("SPEC-MECHA-M", "top")]), "player1", "SPEC-OT-M:m");
    expect(r.ok).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "SPEC-MECHA-M:top")).toBe("deck");
  });

  it("RS-299: 【乗ってみないか？】バトルエリアにあるときは発動しない（出典: atwiki/page-446「自軍ラッシュエリアにある間」）", () => {
    const r = rushFromHand(vrv([inst("TST-UNIT-0", "s")], [inst("SPEC-MECHA-M", "top")], "battle"), "player1", "TST-UNIT-0:s");
    expect(zoneOf(settle(r.state), "player1", "SPEC-MECHA-M:top")).toBe("deck");
  });

  // faq-rider-1 RK-022 Q「はい、発動します。ユニットカードが、ラッシュエリアやバトルエリアに置かれて「ユニット」になったとき、すべて「ラッシュ」として扱います。」
  it.todo(
    "RS-299: 公式Q&A — ライダーパスで DEN-O のユニットと置き換えたときも【乗ってみないか？】は発動する（出典: grnrngr/faq-rider-1 RK-022 Q）— ライダーパス（RK-022）の置き換えは実装済み（RS5-audit-crossref）だが、RS-299【乗ってみないか？】本体が未実装",
  );
});

// ===========================================================================
describe("RS-300 ワンパー", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RS-300: カタログ本文・スペックが出典と一致（出典: atwiki/page-22）", () => {
    expectCatalogText("RS-300", TEXT);
    expectStats("RS-300", {
      name: "ワンパー",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 3,
      features: ["ブルー", "グリーン", "ピンク", "ホワイト", "戦闘員"],
    });
  });

  it("RS-300: ※ デッキに4枚以上入れてもデッキ構築エラーにならない（出典: atwiki/page-22・R-DECK-03）", () => {
    deckUnlimitedOk("RS-300", "ワンパー");
  });

  it("RS-300: 必要パワー3・DA コマンド1つのホールドでラッシュでき、パワー2ではできない（出典: atwiki/page-22）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-300", "w")], power: powerCards(n), command: releasedN(1, "TST-OP-DA") } });
    expect(canStartRush(mk(2), "player1", "RS-300:w")).toBe(false);
    const r = rushFromHand(mk(3), "player1", "RS-300:w");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-300:w")).toBe("rush");
  });
});

// ===========================================================================
/** ※「Vコマンダー」の共通テスト（RS-301 / RS-302）。 */
function vCommanderTests(id: string, page: string) {
  // 「※これは、特徴「Vコマンダー」を持つ自軍ユニットがないとき、自軍コマンドゾーンの「Vコマンダー」をホールドしなければバトルエリアに出られない」
  it(`${id}: ※ 特徴「Vコマンダー」を持つ自軍ユニットも「Vコマンダー」のコマンドもなければ出られない（ふつうのコマンドでは代わりにならない）（出典: ${page}）`, () => {
    const s = st({ player1: { rush: [inst(id, "v")], command: releasedN(2, "TST-OP-OT") } });
    expect(canEnter(s, `${id}:v`)).toBe(false);
  });

  it(`${id}: ※ 特徴「Vコマンダー」を持つ自軍ユニット（タイムファイヤー）がラッシュエリアにあれば出られる（出典: ${page}）`, () => {
    const s = enter(st({ player1: { rush: [inst(id, "v"), inst("RS-303", "tf")] } }), `${id}:v`);
    expect(zoneOf(s, "player1", `${id}:v`)).toBe("battle");
  });

  it(`${id}: ※ 自軍コマンドゾーンのリリース状態の「Vコマンダー」をホールドして出られる（出典: ${page}）`, () => {
    const s0 = st({ player1: { rush: [inst(id, "v")], command: [released("RS-249", "vc")] } });
    expect(canEnter(s0, `${id}:v`)).toBe(true);
    const s = enter(s0, `${id}:v`);
    expect(zoneOf(s, "player1", `${id}:v`)).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it(`${id}: ※ すでにホールド状態の「Vコマンダー」では満たせない（出典: ${page}・R-ADD-07）`, () => {
    const s = st({ player1: { rush: [inst(id, "v")], command: [held("RS-249", "vc")] } });
    expect(canEnter(s, `${id}:v`)).toBe(false);
  });
}

describe("RS-301 Vレックスロボ", () => {
  const TEXT =
    "※これは、特徴「Vコマンダー」を持つ自軍ユニットがないとき、自軍コマンドゾーンの「Vコマンダー」をホールドしなければバトルエリアに出られない。【リボルバーミサイル】これがバトルエリアに出たとき、敵軍ユニットを1体選び、敵軍パワーゾーンからカードを1枚選ぶ。そうしたとき、相手はどちらかを選び捨札にする。";

  it("RS-301: カタログ本文・スペックが出典と一致（出典: atwiki/page-445）", () => {
    expectCatalogText("RS-301", TEXT);
    expectStats("RS-301", {
      name: "Vレックスロボ",
      category: "OT",
      size: "L",
      bp: 7000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ", "恐竜", "人型"],
      rushCondition: "discard_named_unit",
    });
  });

  // 「追加条件：自軍「Vレックス」1体を捨札にする」「必要パワー：6+」
  it("RS-301: 追加条件 — 自軍「Vレックス」1体を捨札にし、パワー6でラッシュできる（いなければ・パワー5ではできない）（出典: atwiki/page-445）", () => {
    const mk = (rush: CardInstance[], n: number) => st({ phase: "rush", player1: { hand: [inst("RS-301", "r")], rush, power: powerCards(n), command: releasedN(1, "TST-OP-OT") } });
    const r = rushFromHand(mk([inst("RS-302", "x")], 6), "player1", "RS-301:r");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-301:r")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-302:x")).toBe("discard");
    expect(canStartRush(mk([inst("TST-UNIT-0", "u")], 6), "player1", "RS-301:r")).toBe(false);
    const low = rushFromHand(mk([inst("RS-302", "x")], 5), "player1", "RS-301:r");
    expect(low.ok && zoneOf(low.state, "player1", "RS-301:r") === "rush").toBe(false);
  });

  vCommanderTests("RS-301", "atwiki/page-445");

  function roboEnters(p2: Partial<GameState["players"]["player2"]>) {
    const s = st({ player1: { rush: [inst("RS-301", "r"), inst("RS-303", "tf")] }, player2: { deck: deckCards(3, "e"), ...p2 } }, SPECS);
    return enter(s, "RS-301:r");
  }

  // 「敵軍ユニットを1体選び、敵軍パワーゾーンからカードを1枚選ぶ。そうしたとき、相手はどちらかを選び捨札にする」
  it("RS-301: 【リボルバーミサイル】敵軍ユニット1体と敵軍パワーゾーンのカード1枚を選び、相手がどちらかを捨札にする（出典: atwiki/page-445）", () => {
    let s = roboEnters({ battle: [inst("TST-UNIT-0", "e")], power: powerCards(2, "ep") });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-301");
    expect(canSkip(s)).toBe(false);
    s = pick(s, "TST-UNIT-0:e");
    s = pick(s, "TST-P:ep0");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = settle(pick(s, "TST-P:ep0"));
    expect(zoneOf(s, "player2", "TST-P:ep0")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  // faq-card-5 RS-301 Q1「はい、できます。」
  it("RS-301: 公式Q&A — 敵軍パワーゾーンのダメージになっているカードも選べる（出典: grnrngr/faq-card-5 RS-301 Q1）", () => {
    let s = roboEnters({ battle: [inst("TST-UNIT-0", "e")], power: damageCards(1, "dm"), damage: 1 });
    s = pick(s, "TST-UNIT-0:e");
    expect(choiceIds(s)).toContain("TST-P:dm0");
  });

  // faq-card-5 RS-301 Q2「いいえ、できません。…選ぶことが出来ない場合は、その効果を発動できません。」
  it("RS-301: 公式Q&A — 敵軍ユニットが1体もなければ、パワーゾーンのカードだけを選んで捨札にさせることはできない（出典: grnrngr/faq-card-5 RS-301 Q2）", () => {
    const s = settle(roboEnters({ power: powerCards(2, "ep") }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.power).toHaveLength(2);
    expect(s.players.player2.discard).toHaveLength(0);
  });

  it("RS-301: 【リボルバーミサイル】敵軍パワーゾーンにカードがなければ、ユニットだけを捨札にさせることもない（出典: atwiki/page-445・faq-card-5 RS-301 Q2 の趣旨）", () => {
    const s = settle(roboEnters({ battle: [inst("TST-UNIT-0", "e")] }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  // atwiki/page-445 Q3「いいえ、パワーゾーンからカードが離れる処理を含むため、発動できません。」（XG-034 = XG1-034 害気大臣キタネイダス）
  it("RS-301: Q&A — 害気大臣キタネイダスが自軍エリアにある間（バトルフェイズ中）は、パワーゾーンからカードが離れる処理を含むため発動できない（出典: atwiki/page-445 Q3）", () => {
    let s = st(
      { player1: { rush: [inst("RS-301", "r"), inst("RS-303", "tf"), inst("XG1-034", "kita")] }, player2: { battle: [inst("TST-UNIT-0", "e")], power: powerCards(2, "ep"), deck: deckCards(3, "e") } },
      SPECS,
    );
    s = settle(enter(s, "RS-301:r"));
    expect(zoneOf(s, "player1", "RS-301:r")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-301");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(s.players.player2.power).toHaveLength(2);
  });

  // faq-card-6 RS-359 Q「はい、できます。」（Vコマンダーで山札から出す Vレックスロボの追加条件を、デンジ犬アイシーで山札の Vレックスを捨札にして満たす）
  it("RS-301: 公式Q&A — Vコマンダーで山札から出すとき、デンジ犬アイシーで山札の「Vレックス」を捨札にして追加条件を満たせる（出典: grnrngr/faq-card-6 RS-359 Q）", () => {
    let s = st({
      phase: "rush",
      player1: {
        rush: [inst("RS-359", "icy")],
        hand: [inst("RS-249", "vc")],
        command: releasedN(2, "TST-OP-OT"),
        power: powerCards(5),
        deck: [inst("RS-301", "robo"), inst("RS-302", "rex"), inst("TST-OP", "x")],
      },
    });
    s = useCard(s, "player1", "RS-249:vc");
    for (let i = 0; i < 4 && s.pendingEffectChoice; i++) s = drain(s, "player1", ["RS-301:robo", "RS-302:rex", "RS-359:icy"]);
    expect(zoneOf(s, "player1", "RS-301:robo")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-302:rex")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-302 Vレックス", () => {
  const TEXT =
    "※これは、特徴「Vコマンダー」を持つ自軍ユニットがないとき、自軍コマンドゾーンの「Vコマンダー」をホールドしなければバトルエリアに出られない。【レックスレーザー】これをラッシュしたとき、カードに表記された本来のBPが3000のユニットをすべて持ち主のパワーゾーンに送る。";

  it("RS-302: カタログ本文・スペックが出典と一致（出典: atwiki/page-444）", () => {
    expectCatalogText("RS-302", TEXT);
    expectStats("RS-302", {
      name: "Vレックス",
      category: "OT",
      size: "L",
      bp: 6000,
      sp: undefined,
      powerCost: 5,
      features: ["メカ", "恐竜"],
    });
  });

  vCommanderTests("RS-302", "atwiki/page-444");

  // 「これをラッシュしたとき、カードに表記された本来のBPが3000のユニットをすべて持ち主のパワーゾーンに送る」
  it("RS-302: 【レックスレーザー】ラッシュしたとき、どちらの軍でも（バトル・ラッシュとも）本来の BP が3000 のユニットをすべて持ち主のパワーゾーンに送る（出典: atwiki/page-444）", () => {
    const s0 = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-302", "v")], rush: [inst("RS-031", "own3")], battle: [inst("SPEC-S2000", "own2")], command: releasedN(1, "TST-OP-OT"), power: powerCards(5) },
        player2: { battle: [inst("RS-162", "e3"), inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-2", "e3m")] },
      },
      SPECS,
    );
    const r = rushFromHand(s0, "player1", "RS-302:v");
    expect(r.ok).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "RS-031:own3")).toBe("power");
    expect(zoneOf(s, "player2", "RS-162:e3")).toBe("power");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e3m")).toBe("power");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-S2000:own2")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-302:v")).toBe("rush");
  });

  it("RS-302: 【レックスレーザー】「本来の」BP で判定する — 効果で BP が3000 になったユニットは送らず、本来3000 で BP が上がっているユニットは送る（出典: atwiki/page-444「カードに表記された本来のBP」）", () => {
    // 大獣神【守護獣の神】で WB は BP+2000: TST-UNIT-0（本来1000→3000）は送らない、RS-162 ガオブルー（本来3000→5000）は送る。
    const s0 = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-302", "v")], command: releasedN(1, "TST-OP-OT"), power: powerCards(5) },
        player2: { battle: [inst("RS-286", "god"), inst("TST-UNIT-0", "e1"), inst("RS-162", "e3")] },
      },
      SPECS,
    );
    expect(bpOf(s0, "player2", "TST-UNIT-0:e1")).toBe(3000);
    const s = settle(rushFromHand(s0, "player1", "RS-302:v").state);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-162:e3")).toBe("power");
  });

  // faq-card-8 RS-374 Q「はい、捨札になります。」（ゴーオンシルバーのコールOTで Vレックスをラッシュ → 魔女バンドーラの効果）
  it("RS-302: 公式Q&A — 敵軍に魔女バンドーラがいるとき、ゴーオンシルバーのコールOTで（恐竜の）Vレックスをラッシュすると、ゴーオンシルバーは捨札になる（出典: grnrngr/faq-card-8 RS-374 Q）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-302", "v")], rush: [inst("RS-600", "silver")], command: [], power: powerCards(5) },
      player2: { rush: [inst("RS-374", "b")] },
    });
    const r = rushFromHand(s0, "player1", "RS-302:v");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-302:v")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-600:silver")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-303 タイムファイヤー", () => {
  const TEXT =
    "【シティガーディアンズ隊長】これは自軍バトルエリアの特徴「戦闘員」を持つユニット1体につきBP＋1000され、BP5000以上のとき「SP1」になる。これが撃破されたとき、特徴「戦闘員」を持つ自軍ユニットを2体選び、かわりに捨札にしてもよい。";

  it("RS-303: カタログ本文・スペックが出典と一致（出典: atwiki/page-443）", () => {
    expectCatalogText("RS-303", TEXT);
    expectStats("RS-303", {
      name: "タイムファイヤー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 4,
      features: ["レッド", "男", "Vコマンダー"],
    });
  });

  // 「これは自軍バトルエリアの特徴「戦闘員」を持つユニット1体につきBP＋1000され」
  it("RS-303: 【シティガーディアンズ隊長】自軍バトルエリアの「戦闘員」1体につき BP＋1000（出典: atwiki/page-443）", () => {
    const s = st({ player1: { battle: [inst("RS-303", "tf"), inst("RS-298", "a"), inst("RS-300", "b")] } });
    expect(bpOf(s, "player1", "RS-303:tf")).toBe(4000);
  });

  it("RS-303: 【シティガーディアンズ隊長】ラッシュエリアの「戦闘員」や敵軍の「戦闘員」は数えない（出典: atwiki/page-443「自軍バトルエリアの」）", () => {
    const s = st({ player1: { battle: [inst("RS-303", "tf")], rush: [inst("RS-298", "a")] }, player2: { battle: [inst("RS-300", "b")] } });
    expect(bpOf(s, "player1", "RS-303:tf")).toBe(2000);
  });

  // 「BP5000以上のとき「SP1」になる」
  it("RS-303: 【シティガーディアンズ隊長】「戦闘員」3体で BP5000 になり「SP1」（ストライクできる）（出典: atwiki/page-443）", () => {
    const s = st({ player1: { battle: [inst("RS-298", "a"), inst("RS-300", "b"), inst("RS-304", "c"), inst("RS-303", "tf")] } });
    expect(bpOf(s, "player1", "RS-303:tf")).toBe(5000);
    expect(spOf(s, "player1", "RS-303:tf")).toBe(1);
    expect(canStrike(s, "RS-303:tf")).toBe(true);
  });

  it("RS-303: 【シティガーディアンズ隊長】BP5000 未満（「戦闘員」2体）なら SP！のまま（ストライクできない）（出典: atwiki/page-443「BP5000以上のとき」）", () => {
    const s = st({ player1: { battle: [inst("RS-298", "a"), inst("RS-300", "b"), inst("RS-303", "tf")] } });
    expect(spOf(s, "player1", "RS-303:tf")).toBe(0);
    expect(canStrike(s, "RS-303:tf")).toBe(false);
  });

  function tfAttacked(own: CardInstance[]) {
    const s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-303", "tf"), ...own], deck: deckCards(4) }, player2: { battle: [inst("SPEC-BIG", "big")], deck: deckCards(4, "e") } },
      SPECS,
    );
    return settle(attack(s, "SPEC-BIG:big", "RS-303:tf", "player2"));
  }

  // 「これが撃破されたとき、特徴「戦闘員」を持つ自軍ユニットを2体選び、かわりに捨札にしてもよい」
  it("RS-303: 【シティガーディアンズ隊長】撃破されたとき、自軍の「戦闘員」2体をかわりに捨札にして場に残れる（出典: atwiki/page-443）", () => {
    let s = tfAttacked([inst("RS-298", "a"), inst("RS-300", "b"), inst("RS-304", "c")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-303");
    expect(canSkip(s)).toBe(true);
    s = pick(s, "RS-298:a");
    s = settle(pick(s, "RS-300:b"));
    expect(zoneOf(s, "player1", "RS-303:tf")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-298:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-300:b")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-304:c")).toBe("battle");
  });

  it("RS-303: 【シティガーディアンズ隊長】かわりに捨札にしないことを選べば撃破される（「戦闘員」は残る）（出典: atwiki/page-443「捨札にしてもよい」）", () => {
    let s = tfAttacked([inst("RS-298", "a"), inst("RS-300", "b")]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-303") s = settle(skip(s));
    expect(zoneOf(s, "player1", "RS-303:tf")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-298:a")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-300:b")).toBe("battle");
  });

  it("RS-303: 【シティガーディアンズ隊長】「戦闘員」が1体しかなければかわりにできず撃破される（出典: atwiki/page-443「2体選び」）", () => {
    const s = tfAttacked([inst("RS-298", "a")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-303");
    expect(zoneOf(s, "player1", "RS-303:tf")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-298:a")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-304 シティガーディアンズ隊員", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。【治安維持】これが自軍バトルエリアにある間、相手が手札からDAのSユニットのカードをラッシュするとき、そのカードの必要パワーの数字は1増える。";

  it("RS-304: カタログ本文・スペックが出典と一致（出典: atwiki/page-35）", () => {
    expectCatalogText("RS-304", TEXT);
    expectStats("RS-304", {
      name: "シティガーディアンズ隊員",
      category: "OT",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 2,
      features: ["男", "戦闘員"],
    });
  });

  it("RS-304: ※ デッキに4枚以上入れてもデッキ構築エラーにならない（出典: atwiki/page-35・R-DECK-03）", () => {
    deckUnlimitedOk("RS-304", "シティガーディアンズ隊員");
  });

  /** player2 のラッシュフェイズ。player1 側に隊員。 */
  function enemyRush(cardId: string, power: number, p1: Partial<GameState["players"]["player1"]> = { battle: [inst("RS-304", "cg")] }) {
    return st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: p1,
        player2: { hand: [inst(cardId, "h")], command: [released("TST-OP-DA", "da"), released("TST-OP", "wb")], power: powerCards(power) },
      },
      SPECS,
    );
  }

  // 「相手が手札からDAのSユニットのカードをラッシュするとき、そのカードの必要パワーの数字は1増える」
  it("RS-304: 【治安維持】相手が手札から DA の S ユニット（必要パワー2）をラッシュするには、パワー3が必要（出典: atwiki/page-35）", () => {
    expect(canStartRush(enemyRush("SPEC-DA-S2", 2), "player2", "SPEC-DA-S2:h")).toBe(false);
    const r = rushFromHand(enemyRush("SPEC-DA-S2", 3), "player2", "SPEC-DA-S2:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player2", "SPEC-DA-S2:h")).toBe("rush");
  });

  it("RS-304: 【治安維持】DA の M ユニットや DA 以外の S ユニットには働かない（出典: atwiki/page-35「DAのSユニット」）", () => {
    expect(canStartRush(enemyRush("SPEC-DA-M2", 2), "player2", "SPEC-DA-M2:h")).toBe(true);
    expect(canStartRush(enemyRush("SPEC-WB-S2", 2), "player2", "SPEC-WB-S2:h")).toBe(true);
  });

  it("RS-304: 【治安維持】ラッシュエリアにあるときは働かない（出典: atwiki/page-35「自軍バトルエリアにある間」）", () => {
    expect(canStartRush(enemyRush("SPEC-DA-S2", 2, { rush: [inst("RS-304", "cg")] }), "player2", "SPEC-DA-S2:h")).toBe(true);
  });

  it("RS-304: 【治安維持】自分が DA の S ユニットをラッシュするときは働かない（出典: atwiki/page-35「相手が」）", () => {
    const s = st(
      { phase: "rush", player1: { battle: [inst("RS-304", "cg")], hand: [inst("SPEC-DA-S2", "h")], command: [released("TST-OP-DA", "da")], power: powerCards(2) } },
      SPECS,
    );
    expect(canStartRush(s, "player1", "SPEC-DA-S2:h")).toBe(true);
  });
});

// ===========================================================================
describe("RS-305 ガオパンダ", () => {
  const TEXT = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【バンブーハリケーン】これをラッシュしたとき、敵軍コマンドをすべてホールドする。";

  it("RS-305: カタログ本文・スペックが出典と一致（出典: atwiki/page-100）", () => {
    expectCatalogText("RS-305", TEXT);
    expectStats("RS-305", {
      name: "ガオパンダ",
      category: "WB",
      size: "M",
      bp: 1000,
      sp: undefined,
      powerCost: 5,
      features: ["獣"],
    });
  });

  it("RS-305: ※ リリース状態の自軍コマンドがなければバトルエリアに出られない（出典: atwiki/page-100）", () => {
    expect(canEnter(st({ player1: { rush: [inst("RS-305", "p")], command: [held("TST-OP", "h")] } }), "RS-305:p")).toBe(false);
  });

  // faq-card-5 RS-316 Q「いいえ、カテゴリの指定はありませんので、ホールドするコマンドはどのカテゴリのコマンドでも構いません。」
  it("RS-305: 公式Q&A — ※のホールドはどのカテゴリのコマンドでもよい（DA のコマンドをホールドして出られる）（出典: grnrngr/faq-card-5 RS-316 Q）", () => {
    const s = enterHold(st({ player1: { rush: [inst("RS-305", "p")], command: [released("TST-OP-DA", "da")] } }), "RS-305:p");
    expect(zoneOf(s, "player1", "RS-305:p")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  function pandaRush(p2Command: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-305", "p")], command: releasedN(1), power: powerCards(5) },
      player2: { command: p2Command, ...p2 },
    });
    return rushFromHand(s, "player1", "RS-305:p");
  }

  // 「これをラッシュしたとき、敵軍コマンドをすべてホールドする」
  it("RS-305: 【バンブーハリケーン】ラッシュしたとき、敵軍コマンドをすべてホールドする（自軍コマンドには影響しない）（出典: atwiki/page-100）", () => {
    const r = pandaRush([...releasedN(3, "TST-OP", "e"), held("TST-OP", "eh")]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-305:p")).toBe("rush");
    expect(r.state.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(r.state.players.player2.command).toHaveLength(4);
  });

  // faq-card-5 RS-247 Q2「いいえ、使用できません。「RS-305 ガオパンダ」のラッシュしたときの効果で、…自軍コマンドを全てホールドされてしまうからです。」
  /** ラッシュの宣言と支払いだけを行い、相手のラッシュ反応の機会で止める。 */
  function rushToReaction(s: GameState, id: string): GameState {
    let n = raw(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: id });
    const p = n.pendingCommandPayment;
    if (p) n = raw(n, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    return n;
  }
  const ninpoState = (hand: CardInstance) =>
    st({
      phase: "rush",
      player1: { hand: [hand], command: releasedN(1), power: powerCards(5) },
      player2: { hand: [inst("RS-247", "ninpo")], command: releasedN(2, "TST-OP-MA", "ma"), power: powerCards(5, "ep") },
    });

  // faq-card-5 RS-247 Q2「いいえ、使用できません。「RS-305 ガオパンダ」のラッシュしたときの効果で、…自軍コマンドを全てホールドされてしまうからです。」
  it("RS-305: 公式Q&A — 相手は【バンブーハリケーン】でコマンドをすべてホールドされるので、ガオパンダのラッシュに疾風流超忍法で対応できない（出典: grnrngr/faq-card-5 RS-247 Q2）", () => {
    const s = rushToReaction(ninpoState(inst("RS-305", "p")), "RS-305:p");
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(canUseCard(s, "player2", "RS-247:ninpo")).toBe(false);
    // 対照: ふつうのユニット（BP8000以下）のラッシュには対応できる
    const ctrl = rushToReaction(ninpoState(inst("TST-UNIT-0", "u")), "TST-UNIT-0:u");
    expect(canUseCard(ctrl, "player2", "RS-247:ninpo")).toBe(true);
  });
});
