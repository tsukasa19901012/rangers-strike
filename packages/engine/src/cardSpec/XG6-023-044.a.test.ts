/**
 * カード別スペック: XG6-023〜XG6-029（クロスギャザー ザ・ギガンティックタイタン データスハイパー〜強化スカイライダー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: なし
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02・R-ADD-06・R-KW-WING・R-KW-TAKUS-01・R-KW-RESIST-01・R-KW-READ-01・R-STK-03）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import {
  accept,
  beltUsed,
  bpOf,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  destroyedInEnemyBattle,
  enemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  inst,
  legal,
  mountAndRideOff,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resistTest,
  resolveAll,
  rushBoard,
  rushFromHand,
  skip,
  spOf,
  strike,
  sUnit,
  takusMaTests,
  leadTests,
  vehicleCard,
  wingTests,
  zordDownTests,
  zoneOf,
} from "./XG6-023-044.helpers";

const L10 = sUnit("SPEC-L10", { bp: 10000, size: "L" });
const M3 = sUnit("SPEC-M3", { bp: 3000, size: "M" });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const OT_M = sUnit("SPEC-OT-M", { category: "OT", bp: 3000, size: "M" });
const BEAST = sUnit("SPEC-BEAST", { category: "WB", bp: 1000, features: ["獣"] });
const VEH = vehicleCard("SPEC-VEH");
const EXTRA = [L10, M3, OT_S, ET_S, DA_S, WB_S, OT_M, BEAST, VEH];

// ===========================================================================
describe("XG6-023 データスハイパー", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札から「データス」のカードを1枚選び、自軍ラッシュエリアに出す。 【ハイパーパンチ】敵軍Lユニットがあれば、これはBP+5000される。";
  const PAGE = "atwiki/page-2293";

  it(`XG6-023: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-023", TEXT);
    expectUnit("XG6-023", { name: "データスハイパー", category: "MA", size: "L", bp: 3500, sp: "1/3", powerCost: "7-", features: ["人型"] });
    expectRushCondition("XG6-023", "zord_down_discard_named", "自軍「データス」1体を捨札にすれば必要パワー0になる");
    expectRarityIn("XG6-023", ["N"]);
  });

  zordDownTests("XG6-023", "XG5-046", "データス", PAGE, "MA");

  it(`XG6-023: ※ 撃破されて捨札になったとき、自軍捨札の「データス」から1枚選んで自軍ラッシュエリアに出す（ほかのカードは選べない。出さない選び方はない）（出典: ${PAGE}「自軍捨札から「データス」のカードを1枚選び、自軍ラッシュエリアに出す」）`, () => {
    let s = destroyedInEnemyBattle(inst("XG6-023", "h"), { discard: [inst("XG5-046", "d1"), inst("XG5-046", "d2"), inst("TST-UNIT-0", "x")] }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG6-023");
    expect(choiceIds(s)).toEqual(["XG5-046:d1", "XG5-046:d2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "XG5-046:d2"));
    expect(zoneOf(s, "player1", "XG5-046:d2")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-046:d1")).toBe("discard");
    expect(zoneOf(s, "player1", "XG6-023:h")).toBe("discard");
  });

  it(`XG6-023: ※ 自軍捨札に「データス」がなければ何も出さない（出典: ${PAGE}）`, () => {
    const s = resolveAll(destroyedInEnemyBattle(inst("XG6-023", "h"), { discard: [inst("TST-UNIT-0", "x")] }, { discard: [inst("XG5-046", "ed")] }, EXTRA));
    expect(s.players.player1.rush).toHaveLength(0);
    expect(zoneOf(s, "player2", "XG5-046:ed")).toBe("discard");
  });

  it.fails(
    `XG6-023: 【ハイパーパンチ】敵軍 L ユニットがあれば BP+5000（BP8500）（出典: ${PAGE}「敵軍Lユニットがあれば、これはBP+5000される」）— 既知の不具合: CARD-XG6-023 BP が上がらない`,
    () => {
      expect(bpOf(p1Battle({ battle: [inst("XG6-023", "h")] }, { rush: [inst("SPEC-L10", "l")] }, EXTRA), "player1", "XG6-023:h")).toBe(8500);
    },
  );

  it(`XG6-023: 【ハイパーパンチ】敵軍 L ユニットがなければ（M ユニットだけ）BP3500 のまま（出典: ${PAGE}）`, () => {
    expect(bpOf(p1Battle({ battle: [inst("XG6-023", "h")] }, { battle: [inst("SPEC-M3", "m")] }, EXTRA), "player1", "XG6-023:h")).toBe(3500);
  });
});

// ===========================================================================
describe("XG6-024 ゴセイナイト", () => {
  const TEXT =
    "※ウイング ※タクスMA ※レジスト ※これは「グランディオン」としてつかえる。 【ナイトダイナミック】「SP1」OTまたはETまたはDAを持つ敵軍Sユニットを1体選び撃破する。その後、自分の手札が1枚以下なら、これをリリースする。";
  const PAGE = "atwiki/page-2348";

  it(`XG6-024: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-024", TEXT);
    expectUnit("XG6-024", { name: "ゴセイナイト", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 4, comboNumber: 3, features: ["魔法", "獣", "人型"] });
    expectRushCondition("XG6-024", undefined);
    expectRarityIn("XG6-024", ["SR"]);
  });

  wingTests("XG6-024", PAGE);
  takusMaTests("XG6-024", PAGE);
  resistTest("XG6-024", PAGE);

  it(`XG6-024: ※ 「グランディオン」として XG6-025 ゴセイグランドの合体に使える（出典: ${PAGE}「これは「グランディオン」としてつかえる」・atwiki/page-2349 合体ユニット「グランディオンorゴセイナイト」）`, () => {
    const s = rushBoard({ hand: [inst("XG6-025", "g")], rush: [inst("XG6-024", "k"), inst("XG6-027", "s"), inst("XG6-028", "a")], command: releasedCat("MA", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG6-025:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-024:k")).toBe("discard");
  });

  const nc = () => ncEnter("XG6-024:k", 2, { hand: [] }, { battle: [inst("SPEC-OT-S", "o"), inst("SPEC-WB-S", "w"), inst("SPEC-OT-M", "om")], rush: [inst("SPEC-DA-S", "d"), inst("SPEC-ET-S", "e")] }, EXTRA);

  it(`XG6-024: NC【ナイトダイナミック】3番目に並ぶと「SP1」になる（出典: ${PAGE}「「SP1」」）`, () => {
    expect(spOf(nc(), "player1", "XG6-024:k")).toBe(1);
  });

  it(`XG6-024: NC が成立しなければ（2番目）SP を持たない（出典: ${PAGE}「SP：！」）`, () => {
    expect(spOf(ncEnter("XG6-024:k", 1, {}, {}, EXTRA), "player1", "XG6-024:k")).toBe(0);
  });

  it.fails(
    `XG6-024: NC【ナイトダイナミック】OT・ET・DA のどれかを持つ敵軍 S ユニット（エリアを問わない）から1体選んで撃破する（WB だけの S ユニット・M ユニットは選べない。選ばない選び方はない）（出典: ${PAGE}「OTまたはETまたはDAを持つ敵軍Sユニットを1体選び撃破する」・カード評価「エリアを問わず」）— 既知の不具合: CARD-XG6-024 撃破の選択が開かない`,
    () => {
      let s = nc();
      expectChoiceFrom(s, "player1", "XG6-024");
      expect(choiceIds(s)).toEqual(["SPEC-DA-S:d", "SPEC-ET-S:e", "SPEC-OT-S:o"]);
      expect(canSkip(s)).toBe(false);
      s = resolveAll(pick(s, "SPEC-DA-S:d"));
      expect(zoneOf(s, "player2", "SPEC-DA-S:d")).toBe("discard");
    },
  );

  it.todo(
    "XG6-024: 【ナイトダイナミック】その後、自分の手札が1枚以下ならこれをリリースする — ホールド状態のこれがバトルエリアに出て NC が成立する手順を、公開 API の通常の手順で用意できない",
  );
});

// ===========================================================================
describe("XG6-025 ゴセイグランド", () => {
  const TEXT =
    "合体―グランディオン＋シーレオン＋スカイオン ※リードMA 【ここからは私のターンだ】これが自軍バトルエリアにある間、敵軍バトルフェイズ中、自分がダメージを受けたとき、自分の手札が1枚以上あればすべて捨札にしてもよい。そうしたとき、そのバトルフェイズを終了する。";
  const PAGE = "atwiki/page-2349";

  it(`XG6-025: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-025", TEXT);
    expectUnit("XG6-025", { name: "ゴセイグランド", category: "MA", size: "L", bp: 9000, sp: 1, powerCost: "5+", features: ["魔法", "獣", "人型"] });
    expectRushCondition("XG6-025", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-025", ["SR"]);
  });

  it(`XG6-025: 追加条件 — 自軍のグランディオン・シーレオン・スカイオンを捨札にしてラッシュできる（出典: ${PAGE}「合体―グランディオン＋シーレオン＋スカイオン」・R-ADD-06）`, () => {
    const s = rushBoard({ hand: [inst("XG6-025", "g")], rush: [inst("XG6-026", "gd"), inst("XG6-027", "s")], battle: [inst("XG6-028", "a")], command: releasedCat("MA", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG6-025:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-025:g")).toBe("rush");
    for (const id of ["XG6-026:gd", "XG6-027:s", "XG6-028:a"]) expect(zoneOf(r.state, "player1", id)).toBe("discard");
  });

  it(`XG6-025: 追加条件 — 合体ユニットが1体でも足りなければ（スカイオンがない）ラッシュできない（出典: ${PAGE}・R-ADD-06）`, () => {
    const s = rushBoard({ hand: [inst("XG6-025", "g")], rush: [inst("XG6-026", "gd"), inst("XG6-027", "s")], command: releasedCat("MA", 1), power: powerCards(5) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "XG6-025:g")).toBe(false);
  });

  leadTests("XG6-025", "MA", PAGE);

  /** 敵軍バトルフェイズ。自軍バトルエリアにゴセイグランド、自軍手札 hand 枚。敵軍 TST-UNIT-7 2体がストライクできる。 */
  const struck = (hand: number) => {
    const s = enemyTurn(
      { battle: [inst("XG6-025", "g")], hand: Array.from({ length: hand }, (_, i) => inst("TST-OP", `h${i}`)) },
      { battle: [inst("TST-UNIT-7", "a"), inst("TST-UNIT-7", "b")] },
      EXTRA,
    );
    return strike(s, "TST-UNIT-7:a", "player2");
  };

  it.fails(
    `XG6-025: 【ここからは私のターンだ】敵軍バトルフェイズにダメージを受けたとき、手札が1枚以上あれば、全部捨札にしてそのバトルフェイズを終了させられる（出典: ${PAGE}「自分の手札が1枚以上あればすべて捨札にしてもよい。そうしたとき、そのバトルフェイズを終了する」）— 既知の不具合: CARD-XG6-025 ダメージを受けても選択が開かない`,
    () => {
      let s = struck(2);
      expectChoiceFrom(s, "player1", "XG6-025");
      expect(canSkip(s)).toBe(true);
      s = resolveAll(accept(s));
      expect(s.players.player1.hand).toHaveLength(0);
      expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("discard");
      expect(s.phase).not.toBe("battle");
    },
  );

  it(`XG6-025: 【ここからは私のターンだ】手札が0枚なら何も起きず、敵軍はバトルフェイズを続けられる（出典: ${PAGE}「自分の手札が1枚以上あれば」）`, () => {
    const s = struck(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-025");
    expect(s.phase).toBe("battle");
    expect(legal(s).some((a) => a.type === "strike" && a.playerId === "player2")).toBe(true);
  });
});

// ===========================================================================
describe("XG6-026 グランディオン", () => {
  const TEXT = "※レジスト ※リードMA 【グランディオンイレイザー】自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く。";
  const PAGE = "atwiki/page-2350";

  it(`XG6-026: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-026", TEXT);
    expectUnit("XG6-026", { name: "グランディオン", category: "MA", size: "M", bp: 5500, sp: undefined, powerCost: "7-", comboNumber: 3, features: ["魔法", "獣"] });
    expectRushCondition("XG6-026", "zord_down_discard_named", "自軍「ゴセイナイト」1体を捨札にすれば必要パワー0になる");
    expectRarityIn("XG6-026", ["R"]);
  });

  zordDownTests("XG6-026", "XG6-024", "ゴセイナイト", PAGE, "MA");
  resistTest("XG6-026", PAGE);
  leadTests("XG6-026", "MA", PAGE);

  const nc = (pos = 3) => ncEnter("XG6-026:g", pos - 1, { command: [released("TST-OP", "mc"), released("TST-OP-ET", "mc2")] }, { command: [released("TST-OP", "ec"), { ...inst("TST-OP-DA", "eh"), commandHeld: true }] }, EXTRA);

  it.fails(
    `XG6-026: NC【グランディオンイレイザー】自軍コマンドを1つ選んで捨札にしてもよい（出典: ${PAGE}「自軍コマンドを1つ選び捨札にしてもよい」）— 既知の不具合: CARD-XG6-026 3番目に出て NC が成立しても選択が開かない（ログだけ出る）`,
    () => {
      const s = nc();
      expectChoiceFrom(s, "player1", "XG6-026");
      expect(choiceIds(s)).toEqual(["TST-OP-ET:mc2", "TST-OP:mc"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it.fails(
    `XG6-026: NC — 自軍コマンドを捨札にしたとき、敵軍コマンド（ホールド状態も）を1つ選んで持ち主のパワーゾーンにダメージとして置く（出典: ${PAGE}「敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く」）— 既知の不具合: CARD-XG6-026 NC が何もしない`,
    () => {
      let s = pick(nc(), "TST-OP:mc");
      expect(zoneOf(s, "player1", "TST-OP:mc")).toBe("discard");
      expectChoiceFrom(s, "player1", "XG6-026");
      expect(choiceIds(s)).toEqual(["TST-OP-DA:eh", "TST-OP:ec"]);
      s = resolveAll(pick(s, "TST-OP-DA:eh"));
      expect(zoneOf(s, "player2", "TST-OP-DA:eh")).toBe("power");
      expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP-DA:eh")?.faceDown).toBe(true);
      expect(s.players.player2.damage).toBe(1);
    },
  );

  it(`XG6-026: NC が成立しなければ（2番目）コマンドは動かない（出典: ${PAGE}・R-NC）`, () => {
    const s = resolveAll(nc(2));
    expect(zoneOf(s, "player1", "TST-OP:mc")).toBe("command");
    expect(zoneOf(s, "player2", "TST-OP:ec")).toBe("command");
  });
});

// ===========================================================================
describe("XG6-027 シーレオン", () => {
  const TEXT =
    "※タクスMA 【青き海の獅子】これをラッシュしたとき、自軍山札の下から1枚をオモテにする。オモテにしたカードが「シーレオン」以外の特徴「獣」を持つユニットカードなら、手札に加える。それ以外なら、オモテにしたカードを山札に戻してシャッフルする。";
  const PAGE = "atwiki/page-2286";

  it(`XG6-027: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-027", TEXT);
    expectUnit("XG6-027", { name: "シーレオン", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 3, features: ["魔法", "獣"] });
    expectRushCondition("XG6-027", undefined);
    expectRarityIn("XG6-027", ["N"]);
  });

  takusMaTests("XG6-027", PAGE);

  const rushed = (deck: ReturnType<typeof inst>[]) =>
    resolveAll(rushFromHand(rushBoard({ hand: [inst("XG6-027", "s")], command: releasedCat("MA", 1), power: powerCards(3), deck }, {}, EXTRA), "player1", "XG6-027:s").state);

  it.fails(
    `XG6-027: 【青き海の獅子】山札の一番下が「シーレオン」以外の特徴「獣」のユニットカードなら手札に加える（出典: ${PAGE}「自軍山札の下から1枚をオモテにする…手札に加える」・カード評価「山札の下を参照する」）— 既知の不具合: CARD-XG6-027 山札の上のカードを選ばせ、手札に加えない`,
    () => {
      const s = rushed([inst("TST-UNIT-0", "t"), ...deckCards(2), inst("SPEC-BEAST", "b")]);
      expect(zoneOf(s, "player1", "SPEC-BEAST:b")).toBe("hand");
      expect(zoneOf(s, "player1", "TST-UNIT-0:t")).toBe("deck");
    },
  );

  it(`XG6-027: 【青き海の獅子】一番下が「シーレオン」なら手札に加えず、山札に残る（出典: ${PAGE}「「シーレオン」以外の」「それ以外なら…山札に戻してシャッフルする」）`, () => {
    const s = rushed([inst("TST-UNIT-0", "t"), ...deckCards(2), inst("XG6-027", "b")]);
    expect(zoneOf(s, "player1", "XG6-027:b")).toBe("deck");
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG6-028 スカイオン", () => {
  const TEXT =
    "※ウイング 【赤き空の獅子】これをラッシュしたとき、自軍山札の上から1枚をオモテにする。オモテにしたカードが「スカイオン」以外の特徴「獣」を持つユニットカードなら、手札に加える。それ以外なら、オモテにしたカードを山札に戻してシャッフルする。";
  const PAGE = "atwiki/page-2285";

  it(`XG6-028: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-028", TEXT);
    expectUnit("XG6-028", { name: "スカイオン", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 4, features: ["魔法", "獣"] });
    expectRushCondition("XG6-028", undefined);
    expectRarityIn("XG6-028", ["N"]);
  });

  wingTests("XG6-028", PAGE);

  const rushed = (deck: ReturnType<typeof inst>[]) =>
    resolveAll(rushFromHand(rushBoard({ hand: [inst("XG6-028", "s")], command: releasedCat("MA", 1), power: powerCards(4), deck }, {}, EXTRA), "player1", "XG6-028:s").state);

  it.fails(
    `XG6-028: 【赤き空の獅子】山札の一番上が「スカイオン」以外の特徴「獣」のユニットカード（XG6-027 シーレオン）なら手札に加える（出典: ${PAGE}「自軍山札の上から1枚をオモテにする…手札に加える」）— 既知の不具合: CARD-XG6-028 山札の上のカードを選ばせるだけで手札に加えない`,
    () => {
      const s = rushed([inst("XG6-027", "t"), ...deckCards(3)]);
      expect(zoneOf(s, "player1", "XG6-027:t")).toBe("hand");
    },
  );

  it(`XG6-028: 【赤き空の獅子】一番上が「スカイオン」・獣でないカードなら手札に加えず、山札に残る（出典: ${PAGE}「それ以外なら…山札に戻してシャッフルする」）`, () => {
    for (const top of ["XG6-028", "TST-UNIT-0"]) {
      const s = rushed([inst(top, "t"), ...deckCards(3)]);
      expect(zoneOf(s, "player1", `${top}:t`)).toBe("deck");
      expect(s.players.player1.hand).toHaveLength(0);
    }
  });
});

// ===========================================================================
describe("XG6-029 強化スカイライダー", () => {
  const TEXT =
    "※ウイング ※これは「スカイライダー」としてつかえる。 ※これは特徴「仮面ライダー」を持つ自軍コマンド1つにつきBP+500される。 【大反転スカイキック】これをラッシュエリアに戻してもよい。そうしたとき、敵軍バトルエリアからユニットを1体選び、これとバトルさせてもよい。その後、このターン、これはバトルエリアに出られない。";
  const PAGE = "atwiki/page-2323";

  it(`XG6-029: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-029", TEXT);
    expectUnit("XG6-029", { name: "強化スカイライダー", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRushCondition("XG6-029", undefined);
    expectRarityIn("XG6-029", ["R"]);
  });

  wingTests("XG6-029", PAGE);

  it(`XG6-029: ※ 「スカイライダー」として BK-006 トルネードで山札から選べる（出典: ${PAGE}「これは「スカイライダー」としてつかえる」・atwiki/page-719）`, () => {
    const s = pick(beltUsed("BK-006", "ET", 4, { deck: [inst("XG6-029", "h"), inst("TST-UNIT-0", "x"), ...deckCards(3)] }, {}, EXTRA), "search");
    expectChoiceFrom(s, "player1", "BK-006");
    expect(choiceIds(s)).toContain("XG6-029:h");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:x");
  });

  it.fails(
    `XG6-029: ※ 特徴「仮面ライダー」を持つ自軍コマンド1つにつき BP+500（2つで BP4000。TST-OP は数えない）（出典: ${PAGE}「特徴「仮面ライダー」を持つ自軍コマンド1つにつきBP+500される」）— 既知の不具合: CARD-XG6-029 BP が上がらない`,
    () => {
      const s = p1Battle({ battle: [inst("XG6-029", "s")], command: [released("XG4-087", "c1"), released("XG1-049", "c2"), released("TST-OP", "c3")] }, {}, EXTRA);
      expect(bpOf(s, "player1", "XG6-029:s")).toBe(4000);
    },
  );

  const rc = () =>
    mountAndRideOff(
      p1Battle({ rush: [inst("XG6-029", "s"), inst("SPEC-VEH", "v")] }, { battle: [inst("TST-UNIT-0", "e1"), inst("SPEC-M3", "e2")], rush: [inst("SPEC-WB-S", "er")] }, EXTRA),
      "XG6-029:s",
      "SPEC-VEH:v",
    );

  it.fails(
    `XG6-029: RC【大反転スカイキック】これをラッシュエリアに戻すかを選べる（任意）（出典: ${PAGE}「これをラッシュエリアに戻してもよい」）— 既知の不具合: CARD-XG6-029 RC が何もしない（ログだけ出る）`,
    () => {
      const s = rc();
      expectChoiceFrom(s, "player1", "XG6-029");
      expect(canSkip(s)).toBe(true);
    },
  );

  it.fails(
    `XG6-029: RC — 戻したとき、敵軍バトルエリアのユニット（サイズを問わない。ラッシュエリアは選べない）を1体選んでバトルし、このターンはバトルエリアに出られない（出典: ${PAGE}「敵軍バトルエリアからユニットを1体選び、これとバトルさせてもよい。その後、このターン、これはバトルエリアに出られない」）— 既知の不具合: CARD-XG6-029 RC が何もしない`,
    () => {
      let s = accept(rc());
      expect(zoneOf(s, "player1", "XG6-029:s")).toBe("rush");
      expectChoiceFrom(s, "player1", "XG6-029");
      expect(choiceIds(s)).toEqual(["SPEC-M3:e2", "TST-UNIT-0:e1"]);
      s = resolveAll(pick(s, "TST-UNIT-0:e1"));
      expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
      expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG6-029:s")).toBe(false);
    },
  );

  it(`XG6-029: RC — 戻さなければバトルエリアに残る（出典: ${PAGE}「戻してもよい」）`, () => {
    let s = rc();
    if (s.pendingEffectChoice?.sourceCardId === "XG6-029") s = skip(s);
    expect(zoneOf(resolveAll(s), "player1", "XG6-029:s")).toBe("battle");
  });
});
