/**
 * カード別スペック: XP-006〜XP-011（クロスギャザー プロモーションカード 侍合体〜デカレッドSWAT）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ を「XP-」とカード名で検索: 本範囲のカードの項はない。
 *     atwiki に転載された公式 Q&A: XP-006 Q1（atwiki/page-1556）・XP-008 Q1（atwiki/page-1719。RK-188 ベリー側の確認は cardSpec/RK9-169-189.c）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XP-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD 合体・ゾードダウン・R-KW-RC-01・R-KW-REG・R-CN-02）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XP-NNN …」）で残す。
 * レアリティは atwiki の「プロモーションカード」（XP-008 は「プロモーションカード（スーパーレア仕様）」）を PR として照合する。
 * 同じ本文の再録（XP-010＝RS-496・XP-011＝RS-345）は元カードの cardSpec（RS7-495-515.a・RS5-327-347.c）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  attack,
  attackUntilRegister,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enter,
  enterAfter,
  expectCatalogText,
  expectChoiceFrom,
  expectOp,
  expectUnit,
  fill,
  fillers,
  inst,
  passEntry,
  pick,
  playOp,
  powerCards,
  rcBoard,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  settle,
  skip,
  st,
  sUnit,
  targetsOf,
  zoneOf,
  zordDownTests,
} from "./XP-001-016.helpers";

const E3 = sUnit("SPEC-E3", { category: "WB", bp: 3000, powerCost: 3 });
const E2 = sUnit("SPEC-E2", { category: "WB", bp: 4000, powerCost: 2 });
const BIG4 = sUnit("SPEC-BIG4", { category: "WB", bp: 4000, powerCost: 2 });
const BP7000 = sUnit("SPEC-7000", { bp: 7000, sp: undefined });
const SWAT = sUnit("SPEC-SWAT", { bp: 4500, sp: undefined, features: ["スワット"] });
const EXTRA = [E3, E2, BIG4, BP7000, SWAT];

// ===========================================================================
describe("XP-006 侍合体", () => {
  const TEXT =
    "自分の手札から、合体が必要なLユニットのカードを1枚選び相手に見せる。見せたカードに表記された合体ユニットが、自軍エリアに3体以上（同名ユニットは1体と数える）あれば、自軍ユニットをすべて捨札にする。 このとき、見せたカードに表記された合体ユニット以外の自軍ユニットを2体捨札にするたび、相手は1枚ドローしてもよい。そして、捨札にしたユニットの本来のBPの合計が見せたカードのBP以上あれば、見せたカードを自軍ラッシュエリアに出す。";

  /** 自軍ラッシュフェイズ。手札に侍合体・ビクトリーロボ（RS-382。合体5体・BP12000）・合体のいらない L ユニット（TST-UNIT-7）。 */
  const used = (rush: CardInstance[], hand: CardInstance[] = []) => {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("XP-006", "op"), inst("RS-382", "vr"), inst("TST-UNIT-7", "l"), ...hand], rush, command: releasedCat("MA", 1), power: powerCards(7), deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    const r = playOp(s, "player1", "XP-006:op");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("XP-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-1556）", () => {
    expectCatalogText("XP-006", TEXT);
    expectOp("XP-006", { name: "侍合体", category: "MA", powerCost: 7, rarity: "PR" });
  });

  it("XP-006: 手札から、合体が必要な L ユニットのカードを1枚選ぶ（合体のいらない L ユニットは選べない）（出典: atwiki/page-1556「自分の手札から、合体が必要なLユニットのカードを1枚選び相手に見せる」）", () => {
    const s = used([inst("XG3-006", "vw"), inst("SPEC-BIG4", "b")]);
    expectChoiceFrom(s, "player1", "XP-006");
    expect(choiceIds(s)).toEqual(["RS-382:vr"]);
  });

  it("XP-006: 公式Q&A — 自軍エリアに XG3-006 ビクトリーウォーカー（「ブルースローワー＋イエローアーマー＋ピンクエイダー」として使える）と BP4000 以上のユニットがあれば、自軍ユニットをすべて捨札にしてビクトリーロボを出せる（本来の BP の合計 8000＋4000＝12000）（出典: atwiki/page-1556 Q1「はい、できます」）", () => {
    const s = resolveAll(pick(used([inst("XG3-006", "vw"), inst("SPEC-BIG4", "b")]), "RS-382:vr"));
    expect(zoneOf(s, "player1", "XG3-006:vw")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-BIG4:b")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-382:vr")).toBe("rush");
  });

  it("XP-006: 表記された合体ユニットが自軍エリアに3体未満（同名は1体と数える）なら何もしない（自軍ユニットは捨札にならない）（出典: atwiki/page-1556「3体以上（同名ユニットは1体と数える）あれば」）", () => {
    const s = resolveAll(pick(used([inst("RS-383", "rl"), inst("RS-383", "rl2"), inst("RS-384", "bs"), inst("SPEC-BIG4", "b")]), "RS-382:vr"));
    expect(zoneOf(s, "player1", "RS-383:rl")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-BIG4:b")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-382:vr")).toBe("hand");
  });

  it("XP-006: 合体ユニットが3体あっても、捨札にしたユニットの本来の BP の合計が見せたカードの BP 未満なら、捨札にするだけで出さない（出典: atwiki/page-1556「捨札にしたユニットの本来のBPの合計が見せたカードのBP以上あれば」）", () => {
    // レッドラダー4000＋ブルースローワー4000＋グリーンホバー2000＝10000 < 12000
    const s = resolveAll(pick(used([inst("RS-383", "rl"), inst("RS-384", "bs"), inst("RS-385", "gh")]), "RS-382:vr"));
    expect(zoneOf(s, "player1", "RS-383:rl")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-385:gh")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-382:vr")).toBe("hand");
  });

  it("XP-006: 合体ユニット以外の自軍ユニットを2体捨札にするたび、相手は1枚ドローしてもよい（2体で1回）（出典: atwiki/page-1556「合体ユニット以外の自軍ユニットを2体捨札にするたび、相手は1枚ドローしてもよい」）", () => {
    let s = pick(used([inst("RS-383", "rl"), inst("RS-384", "bs"), inst("RS-385", "gh"), inst("SPEC-BIG4", "b1"), inst("SPEC-BIG4", "b2")]), "RS-382:vr");
    s = settle(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canSkip(s)).toBe(true);
    const before = s.players.player2.hand.length;
    s = resolveAll(s);
    expect(s.players.player2.hand.length).toBe(before + 1);
    expect(zoneOf(s, "player1", "RS-382:vr")).toBe("rush");
  });
});

// ===========================================================================
describe("XP-007 仮面ライダーNEW電王SF", () => {
  const TEXT =
    "※これはアタックすることができない。 【カウント】数字を1つ宣言してもよい。そうしたとき、自軍山札の上から1枚をオモテにする。オモテにしたカードの必要パワーの数字が宣言した数字以上なら、宣言した数字と同じ必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。その後、オモテにしたカードは山札の下に戻す。";

  it("XP-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-1688）", () => {
    expectCatalogText("XP-007", TEXT);
    expectUnit("XP-007", {
      name: "仮面ライダーNEW電王SF",
      category: "OT",
      size: "S",
      bp: 6000,
      sp: "1/4",
      powerCost: 4,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "NEWDEN-O"],
      rarity: "PR",
    });
  });

  it("XP-007: ※ アタックすることができない（出典: atwiki/page-1688「※これはアタックすることができない」）", () => {
    const s = passEntry(enter(st({ player1: { rush: [inst("XP-007", "sf")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }), "XP-007:sf"));
    expect(targetsOf(s, "XP-007:sf")).toEqual([]);
  });

  /** RC で【カウント】を開く。山札の一番上は top（既定は必要パワー3の SPEC-E3）。 */
  const count = (top: CardInstance = inst("SPEC-E3", "top")) =>
    rcBoard("XP-007:sf", { deck: [top, ...deckCards(3)] }, { battle: [inst("SPEC-E3", "e3")], rush: [inst("SPEC-E2", "e2"), inst("TST-UNIT-7", "big")] }, EXTRA);

  it("XP-007: 【カウント】RC — 数字を1つ宣言できる（任意）（出典: atwiki/page-1688「数字を1つ宣言してもよい」）", () => {
    const s = count();
    expectChoiceFrom(s, "player1", "XP-007");
    expect(choiceIds(s)).toContain("3");
    expect(canSkip(s)).toBe(true);
  });

  it("XP-007: 【カウント】オモテにしたカードの必要パワー（3）が宣言（3）以上なら、必要パワーの数字が3の敵軍ユニットを選びパワーゾーンに送る。オモテにしたカードは山札の下に戻る（出典: atwiki/page-1688・カード評価「除去対象のサイズ・エリアを問わない」）", () => {
    let s = pick(count(), "3");
    expectChoiceFrom(s, "player1", "XP-007");
    expect(choiceIds(s)).toEqual(["SPEC-E3:e3"]);
    s = resolveAll(pick(s, "SPEC-E3:e3"));
    expect(zoneOf(s, "player2", "SPEC-E3:e3")).toBe("power");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-E3:top");
  });

  it("XP-007: 【カウント】宣言した数字（2）と同じ必要パワーの数字なら、敵軍ラッシュエリアのユニットも選べる（出典: atwiki/page-1688「敵軍ユニットを1体選び」）", () => {
    const s = pick(count(), "2");
    expect(choiceIds(s)).toEqual(["SPEC-E2:e2"]);
  });

  it("XP-007: 【カウント】オモテにしたカードの必要パワー（3）が宣言（4）より小さければ何も送らない（オモテにしたカードは山札の下）（出典: atwiki/page-1688「宣言した数字以上なら」）", () => {
    const s = resolveAll(pick(count(), "4"));
    expect(zoneOf(s, "player2", "SPEC-E3:e3")).toBe("battle");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-E3:top");
  });

  it("XP-007: 【カウント】必要パワー「7+」の敵軍ユニットは数字7として選べる（出典: atwiki/page-1688「必要パワーの数字」）", () => {
    const s = pick(count(inst("TST-UNIT-7", "top7")), "7");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:big"]);
  });
});

// ===========================================================================
describe("XP-008 仮面ライダーNEW電王VF", () => {
  const TEXT =
    "合体―仮面ライダーNEW電王SF＋デネブ ※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーNEW電王SF」のカードを1枚選び、自軍ラッシュエリアに出す。 【最初に言っておく】これをラッシュしたとき、相手に1点ダメージを与える。";

  it("XP-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-1719）", () => {
    expectCatalogText("XP-008", TEXT);
    expectUnit("XP-008", {
      name: "仮面ライダーNEW電王VF",
      category: "OT",
      size: "S",
      bp: 6500,
      sp: "1/4",
      powerCost: "10-",
      features: ["仮面ライダー", "男", "NEWDEN-O"],
      rushCondition: "zord_down_discard_fusion",
      rarity: "PR",
    });
  });

  const rushBoardOf = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({ phase: "rush", player1: { hand: [inst("XP-008", "vf")], command: releasedCat("OT", 1), power: [], deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e") } });

  it("XP-008: 追加条件 — 自軍の仮面ライダーNEW電王SF とデネブを捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-1719「合体―仮面ライダーNEW電王SF＋デネブ」「追加条件：自軍合体ユニットを捨札にすれば必要パワー0になる」）", () => {
    const r = rushVia(rushBoardOf({ rush: [inst("XP-007", "sf"), inst("RK-146", "dn")] }), "player1", "XP-008:vf", (a) => a.zordMaterialInstanceId === "XP-007:sf");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XP-008:vf")).toBe("rush");
    expect(zoneOf(s, "player1", "XP-007:sf")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-146:dn")).toBe("discard");
  });

  it("XP-008: 必要パワー「10-」— 合体ユニットがそろわなければパワー10でラッシュでき、9ではラッシュできない（出典: atwiki/page-1719・R-ADD-02）", () => {
    expect(canStartRush(rushBoardOf({ power: powerCards(9) }), "player1", "XP-008:vf")).toBe(false);
    const r = rushFromHand(rushBoardOf({ power: powerCards(10) }), "player1", "XP-008:vf");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XP-008:vf")).toBe("rush");
  });

  it("XP-008: 【最初に言っておく】ラッシュしたとき、相手に1点ダメージを与える（出典: atwiki/page-1719「これをラッシュしたとき、相手に1点ダメージを与える」）", () => {
    const r = rushFromHand(rushBoardOf({ power: powerCards(10) }), "player1", "XP-008:vf");
    const s = resolveAll(r.state);
    expect(damageOf(s, "player2")).toBe(1);
  });

  reanimateTests("XP-008", "XP-007", "仮面ライダーNEW電王SF", "atwiki/page-1719");
});

// ===========================================================================
describe("XP-009 仮面ライダークウガ", () => {
  const TEXT =
    "※レジスト 【笑顔の為に】自軍ラッシュエリアから特徴「警察」を持つSユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、このターン、これとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く。";

  it("XP-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-1700）", () => {
    expectCatalogText("XP-009", TEXT);
    expectUnit("XP-009", {
      name: "仮面ライダークウガ",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "1/3",
      powerCost: 3,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "アマダム"],
      rarity: "PR",
    });
  });

  it("XP-009: ※レジスト — 敵軍ターンにアタックされたとき、レジストを使える（出典: atwiki/page-1700「※レジスト」・R-KW-REG）", () => {
    const s = attackUntilRegister({ battle: [inst("XP-009", "kg")], command: releasedCat("MA", 1) }, "XP-009:kg");
    expect(registerOffered(s)).toBe(true);
  });

  const smile = (p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-E3", "e3")] }) =>
    rcBoard("XP-009:kg", { rush: [inst("RS-106", "pol"), inst("TST-UNIT-0", "x")], battle: [inst("RS-107", "pb")] }, p2, EXTRA);

  it("XP-009: 【笑顔の為に】RC — 自軍ラッシュエリアの特徴「警察」を持つ S ユニットから1体選べる（任意。警察でないユニット・バトルエリアのユニットは選べない）（出典: atwiki/page-1700「自軍ラッシュエリアから特徴「警察」を持つSユニットを1体選び、持ち主の手札に戻してもよい」）", () => {
    const s = smile();
    expectChoiceFrom(s, "player1", "XP-009");
    expect(choiceIds(s)).toEqual(["RS-106:pol"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XP-009: 【笑顔の為に】選んだユニットは持ち主の手札に戻る（クウガは場に残る）（出典: atwiki/page-1700）", () => {
    const s = resolveAll(pick(smile(), "RS-106:pol"));
    expect(zoneOf(s, "player1", "RS-106:pol")).toBe("hand");
    expect(zoneOf(s, "player1", "XP-009:kg")).toBe("battle");
  });

  it("XP-009: 【笑顔の為に】そうしたとき、このターンこれとバトルして撃破されたユニットは、持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-1700「これとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く」）", () => {
    const enemy = { battle: [inst("TST-UNIT-0", "weak")] };
    let s = resolveAll(pick(smile(enemy), "RS-106:pol"));
    s = resolveAll(attack(s, "XP-009:kg", "TST-UNIT-0:weak"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:weak")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:weak")?.faceDown).toBe(true);
  });

  it("XP-009: 【笑顔の為に】戻さなければ、バトルで撃破したユニットは捨札になる（出典: atwiki/page-1700「戻してもよい。そうしたとき」）", () => {
    let s = resolveAll(skip(smile({ battle: [inst("TST-UNIT-0", "weak")] })));
    s = resolveAll(attack(s, "XP-009:kg", "TST-UNIT-0:weak"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:weak")).toBe("discard");
  });
});

// ===========================================================================
describe("XP-010 デカブルーSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「デカブルー」のカードを1枚選び、自軍ラッシュエリアに出す。 ※これが自軍エリアにある間、特徴「スワット」を持つ自軍ユニットは、アタックされるときBP+3000される。 【精密射撃】敵軍パワーゾーンのダメージになっているカードを1枚選び、オモテにしてもよい。そうしたとき、敵軍パワーゾーンからオモテ向きのカードを1枚選び、ダメージにする。";

  it("XP-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-1697）", () => {
    expectCatalogText("XP-010", TEXT);
    expectUnit("XP-010", {
      name: "デカブルーSWAT",
      category: "OT",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 2,
      features: ["ブルー", "男", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
      rarity: "PR",
    });
  });

  zordDownTests("XP-010", "RS-107", "デカブルー", "atwiki/page-1697「追加条件：自軍「デカブルー」1体を捨札にすれば必要パワー0になる」", "OT");
  reanimateTests("XP-010", "RS-107", "デカブルー", "atwiki/page-1697");

  const attackedBy = (target: string, p1: Partial<GameState["players"]["player1"]>) =>
    resolveAll(
      settle(
        attack(
          st({ activePlayer: "player2", player1: { deck: deckCards(3), ...p1 }, player2: { battle: [inst("SPEC-7000", "a")], deck: deckCards(3, "e") } }, EXTRA),
          "SPEC-7000:a",
          target,
          "player2",
        ),
      ),
    );

  it("XP-010: ※ アタックされるとき、特徴「スワット」を持つ自軍ユニット（これ自身）は BP+3000 され、BP7000 のアタックに勝つ（出典: atwiki/page-1697「アタックされるときBP+3000される」）", () => {
    const s = attackedBy("XP-010:sw", { battle: [inst("XP-010", "sw")] });
    expect(zoneOf(s, "player1", "XP-010:sw")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-7000:a")).toBe("discard");
  });

  it("XP-010: ※ これがラッシュエリアにある間、別の「スワット」の自軍ユニットもアタックされるとき BP+3000 される（出典: atwiki/page-1697「これが自軍エリアにある間、特徴「スワット」を持つ自軍ユニットは」）", () => {
    const s = attackedBy("SPEC-SWAT:x", { battle: [inst("SPEC-SWAT", "x")], rush: [inst("XP-010", "sw")] });
    expect(zoneOf(s, "player1", "SPEC-SWAT:x")).toBe("battle");
  });

  it("XP-010: ※ 「スワット」を持たない自軍ユニットは BP が上がらない（出典: atwiki/page-1697）", () => {
    const s = attackedBy("RS-107:b", { battle: [inst("RS-107", "b")], rush: [inst("XP-010", "sw")] });
    expect(zoneOf(s, "player1", "RS-107:b")).toBe("discard");
  });

  /** 自軍バトルフェイズにデカブルーSWAT を2番目に出す（敵軍パワー: ダメージ ed0、オモテ ep0・ep1）。 */
  const enter2nd = (enemyPower: CardInstance[] = [...damageCards(1, "ed"), ...powerCards(2, "ep")], first = fill(1)) =>
    enter(
      st({
        player1: { battle: first, rush: [inst("XP-010", "sw")], deck: deckCards(3) },
        player2: { power: enemyPower, damage: enemyPower.filter((c) => c.faceDown).length, deck: deckCards(3, "e") },
      }),
      "XP-010:sw",
    );

  it("XP-010: 【精密射撃】2番目に出て NC が成立すると、敵軍のダメージを1枚オモテにし、敵軍のオモテ向きのカードを1枚ダメージにする（ダメージ数は変わらない）（出典: atwiki/page-1697）", () => {
    let s = enter2nd();
    expectChoiceFrom(s, "player1", "XP-010");
    expect(choiceIds(s)).toEqual(["TST-P:ed0"]);
    s = resolveAll(pick(pick(s, "TST-P:ed0"), "TST-P:ep1"));
    const power = s.players.player2.power;
    expect(power.find((c) => c.instanceId === "TST-P:ed0")?.faceDown ?? false).toBe(false);
    expect(power.find((c) => c.instanceId === "TST-P:ep1")?.faceDown).toBe(true);
    expect(power.filter((c) => c.faceDown)).toHaveLength(1);
  });

  it("XP-010: 【精密射撃】「オモテにしてもよい」— 見送れる（出典: atwiki/page-1697「オモテにしてもよい」）", () => {
    expect(canSkip(enter2nd())).toBe(true);
  });

  it("XP-010: 【精密射撃】1番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-1697「CN：2」・R-CN-02）", () => {
    expect(enter2nd(undefined, []).pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("XP-011 デカレッドSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「デカレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【Dリボルバー】敵軍ラッシュエリアから、カードに表記された本来のBPが3000以下のユニットを1体選び、撃破する。";

  it("XP-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-1698）", () => {
    expectCatalogText("XP-011", TEXT);
    expectUnit("XP-011", {
      name: "デカレッドSWAT",
      category: "OT",
      size: "S",
      bp: 3500,
      sp: 1,
      powerCost: "7-",
      comboNumber: 1,
      features: ["レッド", "男", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
      rarity: "PR",
    });
  });

  zordDownTests("XP-011", "RS-106", "デカレッド", "atwiki/page-1698", "OT");
  reanimateTests("XP-011", "RS-106", "デカレッド", "atwiki/page-1698");

  const enemy = { rush: [inst("TST-UNIT-0", "b1000"), inst("RS-106", "b3000"), inst("RS-344", "b7500")], battle: [inst("TST-UNIT-0", "inBattle")] };

  it("XP-011: 【Dリボルバー】NC（1番目）成立時、敵軍ラッシュエリアの本来の BP3000 以下のユニットを1体選び撃破する（BP3000 ちょうども対象、敵軍バトルエリアは対象外）（出典: atwiki/page-1698）", () => {
    let s = enterAfter("XP-011:sw", [], {}, enemy);
    expectChoiceFrom(s, "player1", "XP-011");
    expect(choiceIds(s)).toEqual(["RS-106:b3000", "TST-UNIT-0:b1000"]);
    s = resolveAll(pick(s, "RS-106:b3000"));
    expect(zoneOf(s, "player2", "RS-106:b3000")).toBe("discard");
  });

  it("XP-011: 【Dリボルバー】は強制（見送れない）（出典: atwiki/page-1698「1体選び、撃破する」）", () => {
    expect(canSkip(enterAfter("XP-011:sw", [], {}, enemy))).toBe(false);
  });

  it("XP-011: NC が成立していない（2番目）ときは発動しない（出典: atwiki/page-1698「CN：1」・R-CN-02）", () => {
    const s = resolveAll(enterAfter("XP-011:sw", fillers(1), {}, enemy));
    expect(s.players.player2.rush).toHaveLength(3);
  });
});

