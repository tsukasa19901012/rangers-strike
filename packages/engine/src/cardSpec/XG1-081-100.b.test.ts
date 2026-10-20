/**
 * カード別スペック: XG1-088〜XG1-094（クロスギャザー ザ・ファーストエンカウント バイクル〜ビーファイターテントウ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。atwiki に転載された公式 Q&A:
 *     XG1-092 Q1（atwiki/page-1679。【ケルベロスΔ】は CN2 で発動する）、XG1-094 Q1（atwiki/page-1645。敵軍コマンドゾーンが5枚のとき）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-WING、05-battle-strike-damage「1/N」の SP）・atwiki のカード評価・コメント
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  bpOf,
  canSkip,
  choiceIds,
  deckCards,
  deckIds,
  enemyBoard,
  enteredFromRush,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  fill,
  heldUnit,
  inst,
  isHeldCard,
  legal,
  ncAt,
  p1Battle,
  passEntry,
  pick,
  rcAt,
  resolveAll,
  spOf,
  sUnit,
  targetsOf,
  zoneOf,
} from "./XG1-081-100.helpers";

const POL = sUnit("SPEC-POL", { features: ["警察"] });
const INS = sUnit("SPEC-INS", { features: ["昆虫"] });
const EXTRA = [POL, INS];

const FULL5 = [inst("TST-OP", "c1"), inst("TST-OP", "c2"), inst("TST-OP", "c3"), inst("TST-OP", "c4"), inst("TST-OP", "c5")];

// ===========================================================================
describe("XG1-088 バイクル", () => {
  const TEXT =
    "【避難経路の確保】自軍コマンドを1つ選び、自分の手札に戻してもよい。そうしたとき、自軍山札の上から1枚引いて、自軍コマンドゾーンにホールド状態で置く。（この効果は「ファイヤー」または「ウォルター」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG1-088: カタログ本文・スペックが出典と一致（出典: atwiki/page-1578）", () => {
    expectCatalogText("XG1-088", TEXT);
    expectUnitStats("XG1-088", { name: "バイクル", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 1, comboNumber: "RC", features: ["メカ", "車両", "人型", "イエロー", "警察"] });
    expectRarityIn("XG1-088", ["N"]);
  });

  const p1 = { command: [inst("TST-OP", "c1")], deck: [inst("TST-UNIT-0", "top"), ...deckCards(3)] };

  it("XG1-088: 【避難経路の確保】RC — 自軍コマンドを1つ手札に戻すかを選べ（任意）、戻すと山札の上から1枚引いて自軍コマンドゾーンにホールド状態で置く（既知の不具合: CARD-XG1-088 選択が開かず何も起きない）（出典: atwiki/page-1578「自軍コマンドを1つ選び、自分の手札に戻してもよい。そうしたとき、自軍山札の上から1枚引いて、自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = rcAt("XG1-088:bk", p1, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-088");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(s, ["TST-OP:c1"]);
    expect(zoneOf(t, "player1", "TST-OP:c1")).toBe("hand");
    expect(zoneOf(t, "player1", "TST-UNIT-0:top")).toBe("command");
    expect(isHeldCard(t, "player1", "TST-UNIT-0:top")).toBe(true);
  });

  it("XG1-088: 「ファイヤー」（XG1-089）からコンビネーションするときは、ライドオフしなくても発動する（既知の不具合: CARD-XG1-088 発動しない）（出典: atwiki/page-1578「（この効果は「ファイヤー」または「ウォルター」からコンビネーションするときはナンバーに関係なく発動する）」）", () => {
    expectChoiceFrom(enteredFromRush("XG1-088:bk", { ...p1, battle: [inst("XG1-089", "fi")] }, {}, EXTRA), "player1", "XG1-088");
  });

  it("XG1-088: ライドせず、「ファイヤー」「ウォルター」以外のユニットの次に出たときは発動しない（出典: atwiki/page-1578・R-KW-RC-01）", () => {
    const s = enteredFromRush("XG1-088:bk", { ...p1, battle: fill(1) }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-088").toBe(false);
  });
});

// ===========================================================================
describe("XG1-089 ファイヤー", () => {
  const TEXT =
    "【警視庁特別救急警察隊】「SP1」自軍捨札から特徴「警察」を持たないSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい。置けなければ手札に加える。(この効果は「ウォルター」または「バイクル」からコンビネーションするときはナンバーに関係なく発動する)";

  it("XG1-089: カタログ本文・スペックが出典と一致（出典: atwiki/page-1664。SP は「！」）", () => {
    expectCatalogText("XG1-089", TEXT);
    expectUnitStats("XG1-089", { name: "ファイヤー", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 5, features: ["メカ", "レッド", "男", "警察"] });
    expectRarityIn("XG1-089", ["SR"]);
  });

  const discard = [inst("TST-UNIT-0", "d"), inst("SPEC-POL", "p"), inst("TST-OP", "o")];

  it("XG1-089: 【警視庁特別救急警察隊】NC5 — 5番目に出ると「SP1」になる（出典: atwiki/page-1664「「SP1」」・CN5）", () => {
    expect(spOf(ncAt("XG1-089:fi", 5, { discard }, {}, EXTRA), "player1", "XG1-089:fi")).toBe(1);
  });

  it("XG1-089: 4番目（「ウォルター」「バイクル」の次でない）では SP を持たない（出典: atwiki/page-1664 CN5・SP「！」）", () => {
    expect(spOf(ncAt("XG1-089:fi", 4, { discard }, {}, EXTRA), "player1", "XG1-089:fi")).toBe(0);
  });

  it("XG1-089: 「ウォルター」（XG1-090）からコンビネーションすると、2番目でも「SP1」になる（出典: atwiki/page-1664「(この効果は「ウォルター」または「バイクル」からコンビネーションするときはナンバーに関係なく発動する)」）", () => {
    const s = enteredFromRush("XG1-089:fi", { battle: [inst("XG1-090", "wl")], discard }, {}, EXTRA);
    expect(spOf(s, "player1", "XG1-089:fi")).toBe(1);
  });

  it("XG1-089: 自軍捨札の「警察」を持たない S ユニットのカードを選べ（任意。「警察」のユニット・オペレーションは選べない）、自軍コマンドゾーンにホールド状態で置く（既知の不具合: CARD-XG1-089 選択が開かない）（出典: atwiki/page-1664「特徴「警察」を持たないSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = ncAt("XG1-089:fi", 5, { discard }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-089");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:d"]);
    const t = resolveAll(s, ["TST-UNIT-0:d"]);
    expect(zoneOf(t, "player1", "TST-UNIT-0:d")).toBe("command");
    expect(isHeldCard(t, "player1", "TST-UNIT-0:d")).toBe(true);
  });

  it("XG1-089: 自軍コマンドゾーンが5枚で置けなければ、選んだカードを手札に加える（既知の不具合: CARD-XG1-089 選択が開かない）（出典: atwiki/page-1664「置けなければ手札に加える」）", () => {
    const s = resolveAll(ncAt("XG1-089:fi", 5, { discard, command: FULL5 }, {}, EXTRA), ["TST-UNIT-0:d"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("hand");
  });
});

// ===========================================================================
describe("XG1-090 ウォルター", () => {
  const TEXT =
    "※ウイング 【救助と安全確保】自軍捨札からSユニットのカードを1枚選び、自軍山札の上に置いてもよい。（この効果は「ファイヤー」または「バイクル」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG1-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-1579）", () => {
    expectCatalogText("XG1-090", TEXT);
    expectUnitStats("XG1-090", { name: "ウォルター", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["メカ", "航空機", "人型", "グリーン", "警察"] });
    expectRarityIn("XG1-090", ["N"]);
  });

  it("XG1-090: ※ウイング — 自軍ラッシュエリアからホールドしてアタックできる（出典: atwiki/page-1579「※ウイング」・R-KW-WING）", () => {
    const s = p1Battle({ rush: [inst("XG1-090", "wl")] }, { battle: [inst("TST-UNIT-0", "a")] }, EXTRA);
    expect(legal(s).some((a) => a.type === "hold_for_wing" && a.instanceId === "XG1-090:wl")).toBe(true);
  });

  const discard = [inst("TST-UNIT-0", "d"), inst("TST-OP", "o")];

  it("XG1-090: 【救助と安全確保】NC2 — 自軍捨札の S ユニットのカードを選び（任意。オペレーションは選べない）、自軍山札の上に置く（既知の不具合: CARD-XG1-090 選択が開かない）（出典: atwiki/page-1579「自軍捨札からSユニットのカードを1枚選び、自軍山札の上に置いてもよい」）", () => {
    const s = ncAt("XG1-090:wl", 2, { discard }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-090");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:d"]);
    expect(deckIds(resolveAll(s, ["TST-UNIT-0:d"]))[0]).toBe("TST-UNIT-0:d");
  });

  it("XG1-090: 「バイクル」（XG1-088）からコンビネーションするときは、3番目でも発動する（既知の不具合: CARD-XG1-090 発動しない）（出典: atwiki/page-1579「（この効果は「ファイヤー」または「バイクル」からコンビネーションするときはナンバーに関係なく発動する）」）", () => {
    const s = enteredFromRush("XG1-090:wl", { battle: [...fill(1), inst("XG1-088", "bk")], discard }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-090");
  });

  it("XG1-090: 3番目（「ファイヤー」「バイクル」の次でない）では発動しない（出典: atwiki/page-1579 CN2）", () => {
    const s = ncAt("XG1-090:wl", 3, { discard }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-090").toBe(false);
  });
});

// ===========================================================================
describe("XG1-091 ブライアン", () => {
  const TEXT = "【外された安全装置】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからナンバーにＲＣを持つSユニットを1体選び撃破してもよい。";

  it("XG1-091: カタログ本文・スペックが出典と一致（出典: atwiki/page-1678）", () => {
    expectCatalogText("XG1-091", TEXT);
    expectUnitStats("XG1-091", { name: "ブライアン", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["メカ", "人型", "警察"] });
    expectRarityIn("XG1-091", ["R"]);
  });

  const entered = () => enteredFromRush("XG1-091:br", {}, { battle: [inst("XG1-086", "x"), inst("TST-UNIT-0", "y")], rush: [inst("XG1-088", "r")] }, EXTRA);

  it("XG1-091: 【外された安全装置】自軍ターンにバトルエリアに出たとき、敵軍ユニットを選ぶ選択が開き、RC を持つスピルバン（XG1-086）を撃破できる（出典: atwiki/page-1678「ナンバーにＲＣを持つSユニットを1体選び撃破してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-091");
    expect(zoneOf(resolveAll(pick(s, "XG1-086:x")), "player2", "XG1-086:x")).toBe("discard");
  });

  it("XG1-091: 候補は敵軍バトルエリアの RC を持つ S ユニットだけ（RC を持たないユニット・ラッシュエリアのユニットは選べない）で、見送れる（既知の不具合: CARD-XG1-091 RC を持たないユニットも候補に入り、見送れない）（出典: atwiki/page-1678「敵軍バトルエリアからナンバーにＲＣを持つSユニット」「撃破してもよい」）", () => {
    const s = entered();
    expect(choiceIds(s)).toEqual(["XG1-086:x"]);
    expect(canSkip(s)).toBe(true);
  });
});

// ===========================================================================
describe("XG1-092 ソルブレイバー", () => {
  const TEXT =
    "【ケルベロスΔ（デルタ）】自軍ターン中、これがバトルエリアに出たとき、このターン、これは次の能力を得る⇒このターン中に自軍捨札から手札に加えたSユニットのカード1枚につきBP+2000される。";

  it("XG1-092: カタログ本文・スペックが出典と一致（出典: atwiki/page-1679）", () => {
    expectCatalogText("XG1-092", TEXT);
    expectUnitStats("XG1-092", { name: "ソルブレイバー", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 4, comboNumber: 2, features: ["メカ", "男", "警察"] });
    expectRarityIn("XG1-092", ["R"]);
  });

  /** 1番目のソルジャンヌ（XG1-093）の NC で捨札の S ユニットを手札に加えてから、ソルブレイバーを2番目に出す。 */
  const afterRecover = () => {
    const s = resolveAll(ncAt("XG1-093:sj", 1, { hand: [inst("TST-OP", "h")], discard: [inst("TST-UNIT-0", "d")], rush: [inst("XG1-092", "sb")] }, {}, EXTRA), ["TST-OP:h", "TST-UNIT-0:d"]);
    return resolveAll(act(passEntry(s), { type: "move_to_battle", playerId: "player1", instanceId: "XG1-092:sb" }));
  };

  it("XG1-092: 公式Q&A — 【ケルベロスΔ】は CN2 で発動し、このターンに捨札から手札に加えた S ユニットのカード1枚につき BP+2000（1枚で BP6000）（既知の不具合: CARD-XG1-092 BP が上がらない）（出典: atwiki/page-1679 Q1「CN2で発動するという意図でデザインしております」・カード評価「ソルジャンヌの回収能力で+2000」）", () => {
    const s = afterRecover();
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("hand");
    expect(bpOf(s, "player1", "XG1-092:sb")).toBe(6000);
  });

  it("XG1-092: このターンに捨札から手札に加えたカードがなければ BP4000 のまま（出典: atwiki/page-1679）", () => {
    expect(bpOf(ncAt("XG1-092:sb", 2, {}, {}, EXTRA), "player1", "XG1-092:sb")).toBe(4000);
  });
});

// ===========================================================================
describe("XG1-093 ソルジャンヌ", () => {
  const TEXT = "【メディカルパック】自分の手札から1枚選び捨札にしてもよい。そうしたとき、自軍捨札からSユニットのカードを1枚選び、手札に加える。";

  it("XG1-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-1610）", () => {
    expectCatalogText("XG1-093", TEXT);
    expectUnitStats("XG1-093", { name: "ソルジャンヌ", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["メカ", "女", "警察"] });
    expectRarityIn("XG1-093", ["N"]);
  });

  const nc = () => ncAt("XG1-093:sj", 1, { hand: [inst("TST-OP", "h")], discard: [inst("TST-UNIT-0", "d"), inst("TST-OP", "o")] }, {}, EXTRA);

  it("XG1-093: 【メディカルパック】NC1 — まず手札を1枚捨札にするかを選ぶ（任意）（既知の不具合: CARD-XG1-093 手札を捨てる段がなく、見送れない）（出典: atwiki/page-1610「自分の手札から1枚選び捨札にしてもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-093");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toContain("TST-OP:h");
  });

  it("XG1-093: 手札を捨札にすると、自軍捨札の S ユニットのカードを1枚手札に加える（オペレーションは選べない）（既知の不具合: CARD-XG1-093 手札を捨てずに回収する）（出典: atwiki/page-1610「そうしたとき、自軍捨札からSユニットのカードを1枚選び、手札に加える」）", () => {
    const s = resolveAll(nc(), ["TST-OP:h", "TST-UNIT-0:d"]);
    expect(zoneOf(s, "player1", "TST-OP:h")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:o")).toBe("discard");
  });

  it("XG1-093: 2番目に出たときは発動しない（出典: atwiki/page-1610 CN1）", () => {
    const s = ncAt("XG1-093:sj", 2, { hand: [inst("TST-OP", "h")], discard: [inst("TST-UNIT-0", "d")] }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-093").toBe(false);
  });
});

// ===========================================================================
describe("XG1-094 ビーファイターテントウ", () => {
  const TEXT =
    "※これはホールド状態のユニットにアタックされない。 【テントウスピアー】敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードを持ち主の山札の上に戻すか、持ち主のコマンドゾーンにホールド状態で置く。（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";

  it("XG1-094: カタログ本文・スペックが出典と一致（出典: atwiki/page-1645）", () => {
    expectCatalogText("XG1-094", TEXT);
    expectUnitStats("XG1-094", { name: "ビーファイターテントウ", category: ["WB", "ET"], size: "S", bp: 1000, sp: "1/2", powerCost: 2, comboNumber: "RC", features: ["メカ", "昆虫", "女"] });
    expectRarityIn("XG1-094", ["NR"]);
  });

  it("XG1-094: ※ ホールド状態のユニットにはアタックされない（リリース状態のユニットにはアタックされる）（出典: atwiki/page-1645「※これはホールド状態のユニットにアタックされない」・コメント「ウイングでアタックされない解釈で大丈夫です」）", () => {
    const s = enemyBoard({ battle: [inst("XG1-094", "tt"), inst("TST-UNIT-0", "o")] }, { battle: [heldUnit("TST-UNIT-7", "a"), inst("TST-UNIT-7", "b")] }, EXTRA);
    expect(targetsOf(s, "TST-UNIT-7:a", "player2")).toEqual(["TST-UNIT-0:o"]);
    expect(targetsOf(s, "TST-UNIT-7:b", "player2")).toContain("XG1-094:tt");
  });

  const enemyDeck = [inst("TST-UNIT-0", "top"), ...deckCards(3, "e")];

  it("XG1-094: 【テントウスピアー】RC — 敵軍山札の上の1枚をオモテにするかを選べ（任意）、敵軍コマンドゾーンにホールド状態で置ける（既知の不具合: CARD-XG1-094 選択が開かず何も起きない）（出典: atwiki/page-1645「オモテにしたカードを持ち主の山札の上に戻すか、持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = rcAt("XG1-094:tt", {}, { deck: enemyDeck }, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-094");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(s, ["accept", "command"]);
    expect(zoneOf(t, "player2", "TST-UNIT-0:top")).toBe("command");
    expect(isHeldCard(t, "player2", "TST-UNIT-0:top")).toBe(true);
  });

  it("XG1-094: 公式Q&A — 敵軍コマンドゾーンが5枚のときは、オモテにしたカードを必ず山札の上に戻す（捨札にはできない）（既知の不具合: CARD-XG1-094 選択が開かない）（出典: atwiki/page-1645 Q1「必ず「持ち主の山札の上に戻す」を選択することになります」）", () => {
    const s = rcAt("XG1-094:tt", {}, { deck: enemyDeck, command: FULL5 }, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-094");
    const t = resolveAll(s, ["accept", "command"]);
    expect(t.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-0:top");
    expect(zoneOf(t, "player2", "TST-UNIT-0:top")).toBe("deck");
  });

  it("XG1-094: 特徴「昆虫」を持つユニットからコンビネーションするときは、ライドオフしなくても発動する（既知の不具合: CARD-XG1-094 発動しない）（出典: atwiki/page-1645「（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」）", () => {
    expectChoiceFrom(enteredFromRush("XG1-094:tt", { battle: [inst("SPEC-INS", "i")] }, { deck: enemyDeck }, EXTRA), "player1", "XG1-094");
  });
});
