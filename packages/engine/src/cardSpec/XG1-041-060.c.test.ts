/**
 * カード別スペック: XG1-055〜XG1-060（クロスギャザー ザ・ファーストエンカウント マンティスロード〜コーカサスビートルアンデッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。
 *     atwiki へ転載された公式 Q&A: page-1546 Q1・Q2（XG1-059）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-RIDE）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: BK1-001-019.c.test.ts（XG1-059 を手札の「ブレイド」として使う）。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackedInEnemyTurn,
  bpOf,
  canSkip,
  choiceIds,
  deckCards,
  enemyBoard,
  enemyRushes,
  endTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  expectVehicleStats,
  heldUnit,
  inst,
  isHeldCard,
  lastBattleBps,
  mount,
  p1Battle,
  pick,
  powerCards,
  rcAt,
  rcUnit,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  settle,
  stepPrefer,
  sUnit,
  zoneOf,
} from "./XG1-041-060.helpers";

const PLUS = sUnit("SPEC-PLUS", { powerCost: "0+" });
const MAS = sUnit("SPEC-MAS", { category: "MA" });
const MAM = sUnit("SPEC-MAM", { category: "MA", size: "M" });
const MAN = sUnit("SPEC-MAN", { bp: 1000, features: ["男"] });
const THING = sUnit("SPEC-THING", { bp: 6000, features: ["メカ"] });
const S0 = sUnit("SPEC-S0", { bp: 2000, sp: undefined });
const L8 = sUnit("SPEC-L8", { bp: 8000, size: "L" });
const L9 = sUnit("SPEC-L9", { bp: 9000, size: "L" });
const RCU = rcUnit("SPEC-RCU");
const EXTRA = [PLAIN_VEHICLE, PLUS, MAS, MAM, MAN, THING, S0, L8, L9, RCU];

// ===========================================================================
describe("XG1-055 マンティスロード", () => {
  const TEXT =
    "【血に飢えた予言者】これが自分の手札にある間、必要パワーに「＋」を持つ敵軍Sユニットがラッシュされたとき、DAを持つ自軍コマンドを1つホールドしてからこれを自軍ラッシュエリアに出してもよい。そうしたとき、ラッシュされた敵軍ユニットを撃破する。";

  it("XG1-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-1572）", () => {
    expectCatalogText("XG1-055", TEXT);
    expectUnitStats("XG1-055", { name: "マンティスロード", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 0, features: ["アンノウン", "昆虫"] });
    expectRarityIn("XG1-055", ["N"]);
  });

  const rushed = (rusher: string) => enemyRushes({ hand: [inst("XG1-055", "ml")], command: releasedCat("DA", 1) }, rusher, EXTRA);

  it("XG1-055: 【血に飢えた予言者】必要パワーに「＋」を持つ敵軍 S ユニットがラッシュされたとき、手札のこれを出すかを選べる（任意）（既知の不具合: CARD-XG1-055 反応の機会がない）（出典: atwiki/page-1572「…ラッシュされたとき、DAを持つ自軍コマンドを1つホールドしてからこれを自軍ラッシュエリアに出してもよい」）", () => {
    const s = rushed("SPEC-PLUS:p");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-055");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-055: 出すと、DA の自軍コマンドが1つホールドされ、これは自軍ラッシュエリアに出て、ラッシュされた敵軍ユニットは撃破される（既知の不具合: CARD-XG1-055）（出典: atwiki/page-1572「そうしたとき、ラッシュされた敵軍ユニットを撃破する」・カード評価「カウンターのように使える除去」）", () => {
    const s = resolveAll(rushed("SPEC-PLUS:p"), ["accept", "XG1-055:ml", "TST-OP-DA:cDA0"]);
    expect(isHeldCard(s, "player1", "TST-OP-DA:cDA0")).toBe(true);
    expect(zoneOf(s, "player1", "XG1-055:ml")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-PLUS:p")).toBe("discard");
  });

  it("XG1-055: 必要パワーに「＋」を持たない S ユニットがラッシュされても発動しない（出典: atwiki/page-1572「必要パワーに「＋」を持つ敵軍Sユニット」）", () => {
    const s = resolveAll(rushed("TST-UNIT-0:x"));
    expect(zoneOf(s, "player1", "XG1-055:ml")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("rush");
  });
});

// ===========================================================================
describe("XG1-056 水のエル", () => {
  const TEXT = "【アギトの殲滅】これをラッシュしたとき、カテゴリにMAを持つ敵軍Sユニットを1体選び撃破してもよい。";

  it("XG1-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-1573）", () => {
    expectCatalogText("XG1-056", TEXT);
    expectUnitStats("XG1-056", { name: "水のエル", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 4, features: ["アンノウン", "エルロード", "獣"] });
    expectRarityIn("XG1-056", ["N"]);
  });

  const rushed = () => {
    const s = rushPhaseBoard(
      { hand: [inst("XG1-056", "el")], command: releasedCat("DA", 1), power: powerCards(4) },
      { battle: [inst("SPEC-MAS", "m"), inst("TST-UNIT-0", "w")], rush: [inst("SPEC-MAS", "mr"), inst("SPEC-MAM", "mm")] },
      EXTRA,
    );
    const r = rushFromHand(s, "player1", "XG1-056:el");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("XG1-056: 【アギトの殲滅】ラッシュしたとき、MA を持つ敵軍 S ユニットを選ぶ選択が開き（任意）、選んだユニットは撃破される（出典: atwiki/page-1573「カテゴリにMAを持つ敵軍Sユニットを1体選び撃破してもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG1-056");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:w");
    expect(zoneOf(resolveAll(s, ["SPEC-MAS:mr"]), "player2", "SPEC-MAS:mr")).toBe("discard");
  });

  it("XG1-056: 候補は MA を持つ敵軍の S ユニットで、バトルエリアのものも選べ、M ユニットは選べない（既知の不具合: CARD-XG1-056 ラッシュエリアのユニットしか候補にならず、M ユニットも候補になる）（出典: atwiki/page-1573「カテゴリにMAを持つ敵軍Sユニット」にエリアの限定がない・カード評価「いるだけで厄介なMAのSユニットを撃破できる」）", () => {
    expect([...choiceIds(rushed())].sort()).toEqual(["SPEC-MAS:m", "SPEC-MAS:mr"]);
  });
});

// ===========================================================================
describe("XG1-057 ブラックファング", () => {
  const TEXT = "【衝撃波】これがライドされている間、敵軍Sユニットは次の制限を受ける⇒ライドしてバトルエリアに出たとき、ホールド状態になる。";

  it("XG1-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-1564）", () => {
    expectCatalogText("XG1-057", TEXT);
    expectVehicleStats("XG1-057", { name: "ブラックファング", category: "DA", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG1-057", ["N"]);
  });

  /** 自軍（player1）が SPEC-RCU をビークルにライドさせてバトルエリアに出す。敵軍（player2）のラッシュエリアには enemyRush。 */
  const ride = (enemyRush: CardInstance[]) =>
    mount(p1Battle({ rush: [inst("SPEC-VEHICLE", "v"), inst("SPEC-RCU", "u")] }, { rush: enemyRush }, EXTRA), "SPEC-RCU:u", "SPEC-VEHICLE:v");

  it("XG1-057: 【衝撃波】敵軍のこれがライドされている間、ライドしてバトルエリアに出た S ユニットはホールド状態になる（既知の不具合: CARD-XG1-057 ホールドされない）（出典: atwiki/page-1564「ライドしてバトルエリアに出たとき、ホールド状態になる」）", () => {
    const s = ride([inst("XG1-057", "bf"), { ...inst("TST-UNIT-0", "r"), mountedOnInstanceId: "XG1-057:bf" }]);
    expect(isHeldCard(s, "player1", "SPEC-RCU:u")).toBe(true);
  });

  it("XG1-057: ライドされていないブラックファングでは制限はかからない（出典: atwiki/page-1564「これがライドされている間」）", () => {
    expect(isHeldCard(ride([inst("XG1-057", "bf")]), "player1", "SPEC-RCU:u")).toBe(false);
  });

  it("XG1-057: 自軍のユニットがこれにライドして出ても、ホールド状態にならない（出典: atwiki/page-1564「敵軍Sユニットは」）", () => {
    const s = mount(p1Battle({ rush: [inst("XG1-057", "bf"), inst("XG1-058", "w")] }, {}, EXTRA), "XG1-058:w", "XG1-057:bf");
    expect(isHeldCard(s, "player1", "XG1-058:w")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-058 ウルフアンデッド", () => {
  const TEXT = "※これはライド中、BP+1000される。 【ワーウルフ化】ホールド状態のSユニットを2体選んでもよい。そうしたとき、選んだ2体でバトルさせる。ただし、特徴「男」を持つユニットを必ず1体選ぶこと。";

  it("XG1-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-1565）", () => {
    expectCatalogText("XG1-058", TEXT);
    expectUnitStats("XG1-058", { name: "ウルフアンデッド", category: "DA", size: "S", bp: 2500, sp: undefined, powerCost: 2, comboNumber: "RC", features: ["アンデッド", "獣"] });
    expectRarityIn("XG1-058", ["N"]);
  });

  it("XG1-058: ※ ライド中は BP+1000（3500）（既知の不具合: CARD-XG1-058 BP2500 のまま）（出典: atwiki/page-1565「※これはライド中、BP+1000される」）", () => {
    const s = p1Battle({ rush: [inst("SPEC-VEHICLE", "v"), { ...inst("XG1-058", "w"), mountedOnInstanceId: "SPEC-VEHICLE:v" }] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG1-058:w")).toBe(3500);
  });

  it("XG1-058: ライドしていなければ BP2500（出典: atwiki/page-1565「ライド中」）", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG1-058", "w")] }), "player1", "XG1-058:w")).toBe(2500);
  });

  const rc = () =>
    rcAt("XG1-058:w", { rush: [heldUnit("SPEC-MAN", "own")] }, { rush: [heldUnit("SPEC-THING", "big"), inst("TST-UNIT-0", "rel")], battle: [heldUnit("SPEC-MAN", "em")] }, EXTRA);

  it("XG1-058: 【ワーウルフ化】RC — ホールド状態の S ユニット（自軍・敵軍、エリアを問わない）を選ぶ選択が開く（リリース状態は選べない。任意）（既知の不具合: CARD-XG1-058 選択が開かない）（出典: atwiki/page-1565「ホールド状態のSユニットを2体選んでもよい」・カード評価「エリア、自軍か敵軍かを問わない」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-058");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:rel");
    expect(choiceIds(s)).toContain("SPEC-MAN:own");
    expect(choiceIds(s)).toContain("SPEC-THING:big");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-058: 選んだ2体（「男」の敵軍ユニットと BP6000 の敵軍ユニット）でバトルさせ、負けたほうが撃破される（既知の不具合: CARD-XG1-058）（出典: atwiki/page-1565「選んだ2体でバトルさせる。ただし、特徴「男」を持つユニットを必ず1体選ぶこと」）", () => {
    const s = resolveAll(rc(), ["SPEC-MAN:em", "SPEC-THING:big"]);
    expect(zoneOf(s, "player2", "SPEC-MAN:em")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-THING:big")).toBe("rush");
  });
});

// ===========================================================================
describe("XG1-059 仮面ライダーブレイドKF", () => {
  const TEXT =
    "【ロイヤルストレートフラッシュ】自軍ターン中、これがバトルエリアに出たとき、自分の手札を5枚選び、相手に見せてもよい。そうしたとき、本来のBPが8000以下の敵軍ユニットを1体選び撃破できる。その後、見せたカードのカテゴリがすべて同じなら、敵軍捨札からカードを1枚選び、ゲームから除外してもよい。";

  it("XG1-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-1546）", () => {
    expectCatalogText("XG1-059", TEXT);
    expectUnitStats("XG1-059", { name: "仮面ライダーブレイドKF", category: "WB", size: "S", bp: 6000, sp: 1, powerCost: "6+", features: ["アンデッド", "仮面ライダー", "男"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG1-059", ["SR"]);
  });

  it("XG1-059: 追加条件 — 自軍「仮面ライダーブレイド」（RK-125）1体を捨札にしてパワー6でラッシュできる（出典: atwiki/page-1546「追加条件：自軍「仮面ライダーブレイド」1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhaseBoard({ hand: [inst("XG1-059", "kf")], rush: [inst("RK-125", "bl")], command: releasedCat("WB", 1), power: powerCards(6) }), "player1", "XG1-059:kf");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-059:kf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-125:bl")).toBe("discard");
  });

  const hand = (cards: CardInstance[] = ["a", "b", "c", "d", "e"].map((x) => inst("TST-OP", x))) => cards;
  const entered = (h: CardInstance[] = hand()) =>
    act(
      p1Battle({ rush: [inst("XG1-059", "kf")], hand: h }, { battle: [inst("SPEC-L8", "l8"), inst("SPEC-L9", "l9")], discard: [inst("TST-OP", "ed"), inst("RK-057", "zb")] }, EXTRA),
      { type: "move_to_battle", playerId: "player1", instanceId: "XG1-059:kf" },
    );

  it("XG1-059: 【ロイヤルストレートフラッシュ】自軍ターンにバトルエリアに出たとき、手札を5枚見せるかを選べる（任意）（既知の不具合: CARD-XG1-059 選択が開かない）（出典: atwiki/page-1546「自分の手札を5枚選び、相手に見せてもよい」）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-059");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-059: 見せたとき、本来の BP8000 以下の敵軍ユニットを1体撃破できる（BP9000 は選べない）（既知の不具合: CARD-XG1-059）（出典: atwiki/page-1546「本来のBPが8000以下の敵軍ユニットを1体選び撃破できる」）", () => {
    // 撃破した L8 も敵軍捨札のカードとして除外の候補になるので、除外の選択では TST-OP:ed を先に選ぶ（XG1-judgments.md）。
    const s = resolveAll(entered(), ["accept", "TST-OP:a", "TST-OP:b", "TST-OP:c", "TST-OP:d", "TST-OP:e", "TST-OP:ed", "SPEC-L8:l8"]);
    expect(zoneOf(s, "player2", "SPEC-L8:l8")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-L9:l9")).toBe("battle");
  });

  it("XG1-059: 見せた5枚のカテゴリがすべて同じなら、敵軍捨札のカードを1枚ゲームから除外できる（既知の不具合: CARD-XG1-059）（出典: atwiki/page-1546「見せたカードのカテゴリがすべて同じなら、敵軍捨札からカードを1枚選び、ゲームから除外してもよい」）", () => {
    // 撃破した L8 も敵軍捨札のカードとして除外の候補になるので、除外の選択では TST-OP:ed を先に選ぶ（XG1-judgments.md）。
    const s = resolveAll(entered(), ["accept", "TST-OP:a", "TST-OP:b", "TST-OP:c", "TST-OP:d", "TST-OP:e", "TST-OP:ed", "SPEC-L8:l8"]);
    expect(zoneOf(s, "player2", "TST-OP:ed")).toBeNull();
  });

  it("XG1-059: Q&A — 除外するカードに、敵軍捨札の「アタックされる以外では相手に選ばれない」仮面ライダーザビーRF（RK-057）は選べない（既知の不具合: CARD-XG1-059）（出典: atwiki/page-1546 Q1「敵軍プレイヤーは「RK-057 仮面ライダーザビーRF」を選ぶことは出来ません」）", () => {
    // resolveAll は除外の選択まで答えてしまうので、1つずつ選んで除外の選択の候補を見る（XG1-judgments.md）。
    let s = pick(entered(), "accept");
    for (let i = 0; i < 8 && s.pendingEffectChoice?.sourceCardId === "XG1-059" && !choiceIds(s).includes("TST-OP:ed"); i += 1) {
      const ids = choiceIds(s);
      s = pick(s, ids.includes("SPEC-L8:l8") ? "SPEC-L8:l8" : ids[0]!);
    }
    expect(choiceIds(s)).toContain("TST-OP:ed");
    expect(choiceIds(s)).not.toContain("RK-057:zb");
  });

  it("XG1-059: Q&A — 見せたカードにマルチカテゴリ（WB／MA の仮面ライダーアマゾン XG1-041）が含まれていても、同じカテゴリ（WB）を含んでいれば「すべて同じ」として除外できる（既知の不具合: CARD-XG1-059）（出典: atwiki/page-1546 Q2「同じカテゴリを1つ以上含んでいれば、それは同じカテゴリのカードとして扱われます」）", () => {
    const h = [inst("TST-OP", "a"), inst("TST-OP", "b"), inst("TST-OP", "c"), inst("TST-OP", "d"), inst("XG1-041", "am")];
    // 撃破した L8 も敵軍捨札のカードとして除外の候補になるので、除外の選択では TST-OP:ed を先に選ぶ（XG1-judgments.md）。
    const s = resolveAll(entered(h), ["accept", "TST-OP:a", "TST-OP:b", "TST-OP:c", "TST-OP:d", "XG1-041:am", "TST-OP:ed", "SPEC-L8:l8"]);
    expect(zoneOf(s, "player2", "TST-OP:ed")).toBeNull();
  });
});

// ===========================================================================
describe("XG1-060 コーカサスビートルアンデッド", () => {
  const TEXT =
    "※これはアタックされるときBP+2000される。 【カード強奪】これがバトルエリアからラッシュエリアに戻るとき、相手の手札を見ないで1枚選んでもよい。そうしたとき、選んだカードを持ち主の山札に戻してシャッフルした後で、相手は1枚ドローする。";

  it("XG1-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-1580）", () => {
    expectCatalogText("XG1-060", TEXT);
    expectUnitStats("XG1-060", { name: "コーカサスビートルアンデッド", category: "DA", size: "S", bp: 4500, sp: undefined, powerCost: 5, features: ["アンデッド", "昆虫"] });
    expectRarityIn("XG1-060", ["N"]);
  });

  it("XG1-060: ※ アタックされるときは BP+2000（6500）でバトルする（出典: atwiki/page-1580「※これはアタックされるときBP+2000される」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG1-060", "cb")] }, "XG1-060:cb", {}, "SPEC-S0:atk", EXTRA);
    expect(lastBattleBps(s)?.defender).toBe(6500);
  });

  it("XG1-060: ※ 自分がアタックするときは BP4500 のまま（出典: atwiki/page-1580「アタックされるとき」）", () => {
    const s = settle(attack(p1Battle({ battle: [inst("XG1-060", "cb")] }, { battle: [inst("SPEC-S0", "e")] }, EXTRA), "XG1-060:cb", "SPEC-S0:e"));
    expect(lastBattleBps(s)?.attacker).toBe(4500);
  });

  /** 敵軍ターンの終わりから自軍スタートフェイズに入り、バトルエリアのユニットをラッシュエリアに戻す。敵軍の手札は2枚。 */
  const returned = () => {
    const s = endTurn(enemyBoard({ battle: [inst("XG1-060", "cb")] }, { hand: [inst("TST-OP", "h1"), inst("TST-UNIT-0", "h2")], deck: deckCards(3, "e") }, EXTRA));
    return stepPrefer(s, "player1", ["return_all_battle_to_rush"]) ?? s;
  };

  it("XG1-060: 【カード強奪】バトルエリアからラッシュエリアに戻るとき、相手の手札を見ないで1枚選ぶかを選べる（任意）（既知の不具合: CARD-XG1-060 選択が開かない）（出典: atwiki/page-1580「これがバトルエリアからラッシュエリアに戻るとき、相手の手札を見ないで1枚選んでもよい」）", () => {
    const s = returned();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-060");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-060: 選んだカードは持ち主の山札に戻ってシャッフルされ、相手は1枚ドローする（手札の枚数は変わらない）（既知の不具合: CARD-XG1-060）（出典: atwiki/page-1580「選んだカードを持ち主の山札に戻してシャッフルした後で、相手は1枚ドローする」）", () => {
    const s = resolveAll(returned(), ["accept", "TST-OP:h1"]);
    expect(s.players.player2.hand).toHaveLength(2);
    expect(s.players.player2.deck).toHaveLength(3);
    expect(s.log.some((l) => l.includes("XG1-060"))).toBe(true);
  });
});
