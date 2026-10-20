/**
 * カード別スペック: XG1-095〜XG1-100（クロスギャザー ザ・ファーストエンカウント ビーファイターカブト〜ロボコン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。atwiki に転載された公式 Q&A:
 *     XG1-096 Q1・Q2（atwiki/page-1661。ウイングでのアタック・効果を無効にされた RC）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-RESIST、R-HOLD-02）・atwiki のカード評価・コメント
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: XG1-001-020.a（XG1-096 Q1。バルイーグルのウイングでのアタック）。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackSettled,
  attackUntilRegister,
  canActivateField,
  canSkip,
  choiceIds,
  deckCards,
  endTurn,
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
  p1Battle,
  pick,
  rcAt,
  registerOffered,
  resolveAll,
  returnedAtStart,
  skip,
  sUnit,
  targetsOf,
  zoneOf,
} from "./XG1-081-100.helpers";

const INS = sUnit("SPEC-INS", { features: ["昆虫"] });
const MAN = sUnit("SPEC-MAN", { features: ["男"] });
const WOM = sUnit("SPEC-WOM", { features: ["女"] });
const MEC = sUnit("SPEC-MEC", { features: ["メカ"] });
const B2 = sUnit("SPEC-B2", { bp: 2000 });
const B3 = sUnit("SPEC-B3", { bp: 3000 });
const B45 = sUnit("SPEC-B45", { bp: 4500 });
const C6 = sUnit("SPEC-C6", { powerCost: 6 });
const EXTRA = [INS, MAN, WOM, MEC, B2, B3, B45, C6];

const BF = ["メカ", "昆虫"];

// ===========================================================================
describe("XG1-095 ビーファイターカブト", () => {
  const TEXT =
    "※レジスト 【カブトランサー】これがバトルで敵軍ユニットを撃破したとき、これが撃破したユニットと同じ特徴を1つ以上持つ敵軍コマンドを1つ選び捨札にしてもよい。（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";

  it("XG1-095: カタログ本文・スペックが出典と一致（出典: atwiki/page-1523）", () => {
    expectCatalogText("XG1-095", TEXT);
    expectUnitStats("XG1-095", { name: "ビーファイターカブト", category: ["WB", "ET"], size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: "RC", features: [...BF, "男"] });
    expectRarityIn("XG1-095", ["SR"]);
  });

  it("XG1-095: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1523「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-095", "kb")] }, "XG1-095:kb"))).toBe(true);
  });

  const p2 = { battle: [inst("SPEC-MAN", "m")], command: [inst("SPEC-MAN", "cm"), inst("SPEC-WOM", "cw"), inst("TST-OP", "co")] };

  it("XG1-095: 【カブトランサー】RC — ライドオフしたターンにバトルで敵軍ユニット（特徴「男」）を撃破すると、「男」を持つ敵軍コマンドを1つ選び捨札にできる（任意。同じ特徴を持たないコマンドは選べない）（既知の不具合: CARD-XG1-095 選択が開かない）（出典: atwiki/page-1523「これが撃破したユニットと同じ特徴を1つ以上持つ敵軍コマンドを1つ選び捨札にしてもよい」・カード評価「リリース状態のコマンドも除去できる」）", () => {
    const s = attackSettled(resolveAll(rcAt("XG1-095:kb", {}, p2, EXTRA)), "XG1-095:kb", "SPEC-MAN:m");
    expect(zoneOf(s, "player2", "SPEC-MAN:m")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG1-095");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-MAN:cm"]);
    expect(zoneOf(resolveAll(pick(s, "SPEC-MAN:cm")), "player2", "SPEC-MAN:cm")).toBe("discard");
  });

  it("XG1-095: 特徴「昆虫」を持つユニットからコンビネーションしたときも、ライドせずに発動する（既知の不具合: CARD-XG1-095 発動しない）（出典: atwiki/page-1523「（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」）", () => {
    const s = attackSettled(enteredFromRush("XG1-095:kb", { battle: [inst("SPEC-INS", "i")] }, p2, EXTRA), "XG1-095:kb", "SPEC-MAN:m");
    expectChoiceFrom(s, "player1", "XG1-095");
  });
});

// ===========================================================================
describe("XG1-096 ビーファイタークワガー", () => {
  const TEXT =
    "※これはＮＣもＲＣも発動していないSユニットにアタックされない。 【クワガーチョッパー】敵軍バトルエリアからリリース状態のSユニットを2体選んでもよい。そうしたとき、相手は次のようにする⇒その2体をホールドするか、どちらか1体選び撃破する。（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";

  it("XG1-096: カタログ本文・スペックが出典と一致（出典: atwiki/page-1661）", () => {
    expectCatalogText("XG1-096", TEXT);
    expectUnitStats("XG1-096", { name: "ビーファイタークワガー", category: ["WB", "ET"], size: "S", bp: 2000, sp: "1/5", powerCost: 0, comboNumber: "RC", features: [...BF, "男"] });
    expectRarityIn("XG1-096", ["R"]);
  });

  it("XG1-096: ※ NC も RC も発動していない S ユニットにはアタックされない（S でないユニットにはアタックされる）（出典: atwiki/page-1661「※これはＮＣもＲＣも発動していないSユニットにアタックされない」・コメント「発動してないからアタックされない」）", () => {
    const s = enemyBoard({ battle: [inst("XG1-096", "kw"), inst("TST-UNIT-0", "o")] }, { battle: [inst("SPEC-B45", "a"), inst("TST-UNIT-7", "z")] }, EXTRA);
    expect(targetsOf(s, "SPEC-B45:a", "player2")).toEqual(["TST-UNIT-0:o"]);
    expect(targetsOf(s, "TST-UNIT-7:z", "player2")).toContain("XG1-096:kw");
  });

  it("XG1-096: NC を発動した S ユニット（5番目に出て NC5 で SP1 になったファイヤー XG1-089）はアタックできる（出典: atwiki/page-1661「ＮＣもＲＣも発動していない」・Q2「RCを発動しているとみなします」）", () => {
    let s = enemyBoard({ battle: [inst("XG1-096", "kw"), inst("TST-UNIT-0", "o")] }, { battle: fill(4), rush: [inst("XG1-089", "fi")] }, EXTRA);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "XG1-089:fi" });
    s = resolveAll(s);
    expect(targetsOf(s, "XG1-089:fi", "player2")).toContain("XG1-096:kw");
  });

  it("XG1-096: NC を満たして並べば、「してもよい」の効果を見送っても NC を発動したとみなし、アタックできる（1番目に出て【アタックライド】を見送ったディケイド 響鬼 XG1-069）（出典: 利用者の決定 2026-10-20・questions-all.md U-12）", () => {
    let s = enemyBoard({ battle: [inst("XG1-096", "kw"), inst("TST-UNIT-0", "o")] }, { rush: [inst("XG1-069", "hb")], hand: [inst("TST-OP", "op")] }, EXTRA);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "XG1-069:hb" });
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-OP:op")).toBe("hand");
    expect(targetsOf(s, "XG1-069:hb", "player2")).toContain("XG1-096:kw");
  });

  it("XG1-096: ナンバーを満たさずに並んだ（2番目に出た CN1 の XG1-069）ユニットはアタックできない（出典: atwiki/page-1661・利用者の決定 2026-10-20・questions-all.md U-12）", () => {
    let s = enemyBoard({ battle: [inst("XG1-096", "kw"), inst("TST-UNIT-0", "o")] }, { battle: [inst("TST-UNIT-7", "z")], rush: [inst("XG1-069", "hb")], hand: [inst("TST-OP", "op")] }, EXTRA);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "XG1-069:hb" });
    s = resolveAll(s);
    expect(targetsOf(s, "XG1-069:hb", "player2")).not.toContain("XG1-096:kw");
  });

  const rc = () => rcAt("XG1-096:kw", {}, { battle: [inst("SPEC-B3", "a"), inst("SPEC-B45", "b"), heldUnit("TST-UNIT-0", "h")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);

  it("XG1-096: 【クワガーチョッパー】RC — 敵軍バトルエリアのリリース状態の S ユニットを2体選べる（任意。ホールド状態・ラッシュエリアのユニットは選べない）（既知の不具合: CARD-XG1-096 選択が開かない）（出典: atwiki/page-1661「敵軍バトルエリアからリリース状態のSユニットを2体選んでもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-096");
    expect(canSkip(s)).toBe(true);
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-B3:a", "SPEC-B45:b"]);
  });

  it("XG1-096: 2体を選ぶと、相手が「2体ともホールドする」か「どちらか1体を撃破する」かを選ぶ（既知の不具合: CARD-XG1-096）（出典: atwiki/page-1661「相手は次のようにする⇒その2体をホールドするか、どちらか1体選び撃破する」）", () => {
    const s = pick(pick(rc(), "SPEC-B3:a"), "SPEC-B45:b");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    const t = resolveAll(s, ["hold"]);
    expect(isHeldCard(t, "player2", "SPEC-B3:a")).toBe(true);
    expect(isHeldCard(t, "player2", "SPEC-B45:b")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-097 ビーファイターアゲハ", () => {
  const TEXT =
    "【ブルームキャノン】敵軍ユニットをBPの合計が5000以下になるように選び撃破してもよい。ただし選べるユニットの数は、これ以外の特徴「昆虫」を持つ自軍バトルエリアのユニットの数までとする。";

  it("XG1-097: カタログ本文・スペックが出典と一致（出典: atwiki/page-1577）", () => {
    expectCatalogText("XG1-097", TEXT);
    expectUnitStats("XG1-097", { name: "ビーファイターアゲハ", category: ["WB", "ET"], size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: 4, features: [...BF, "女"] });
    expectRarityIn("XG1-097", ["N"]);
  });

  const nc = (own: ReturnType<typeof inst>[], p2: { battle: ReturnType<typeof inst>[]; rush?: ReturnType<typeof inst>[] }) =>
    enteredFromRush("XG1-097:ag", { battle: own }, p2, EXTRA);

  it("XG1-097: 【ブルームキャノン】NC4 — ほかに「昆虫」の自軍ユニットが1体なら、BP5000 以下の敵軍ユニットを1体選び撃破できる（任意）（出典: atwiki/page-1577「敵軍ユニットをBPの合計が5000以下になるように選び撃破してもよい」）", () => {
    const s = nc([inst("SPEC-INS", "i1"), inst("TST-UNIT-0", "f"), inst("TST-UNIT-0", "g")], { battle: [inst("SPEC-B3", "a"), inst("SPEC-B2", "b")] });
    expectChoiceFrom(s, "player1", "XG1-097");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(pick(s, "SPEC-B2:b"));
    expect(zoneOf(t, "player2", "SPEC-B2:b")).toBe("discard");
    expect(zoneOf(t, "player2", "SPEC-B3:a")).toBe("battle");
  });

  it("XG1-097: ほかに「昆虫」の自軍ユニットが2体なら、BP の合計が5000 以下の2体（BP3000＋2000）を撃破できる（既知の不具合: CARD-XG1-097 1体しか選べない）（出典: atwiki/page-1577「選べるユニットの数は、これ以外の特徴「昆虫」を持つ自軍バトルエリアのユニットの数まで」）", () => {
    const s = resolveAll(pick(nc([inst("SPEC-INS", "i1"), inst("SPEC-INS", "i2"), inst("TST-UNIT-0", "f")], { battle: [inst("SPEC-B3", "a"), inst("SPEC-B2", "b"), inst("SPEC-B45", "c")] }), "SPEC-B3:a"), ["SPEC-B2:b"]);
    expect(zoneOf(s, "player2", "SPEC-B3:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B2:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B45:c")).toBe("battle");
  });

  it("XG1-097: ほかに「昆虫」の自軍ユニットがいなければ、1体も選べない（既知の不具合: CARD-XG1-097 選択が開き撃破できる）（出典: atwiki/page-1577「これ以外の特徴「昆虫」を持つ自軍バトルエリアのユニットの数までとする」）", () => {
    const s = nc(fill(3), { battle: [inst("SPEC-B3", "a")] });
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-097").toBe(false);
  });

  it("XG1-097: 敵軍ラッシュエリアのユニットも選べる（既知の不具合: CARD-XG1-097 敵軍バトルエリアのユニットしか候補にならない）（出典: atwiki/page-1577「敵軍ユニット」・カード評価「エリアとサイズを問わない除去効果」）", () => {
    const s = nc([inst("SPEC-INS", "i1"), inst("TST-UNIT-0", "f"), inst("TST-UNIT-0", "g")], { battle: [inst("SPEC-B3", "a")], rush: [inst("SPEC-B2", "r")] });
    expect(choiceIds(s)).toContain("SPEC-B2:r");
  });
});

// ===========================================================================
describe("XG1-098 猛毒鎧将デスコーピオン", () => {
  const TEXT =
    "【ポイズンアンカー】これが自軍エリアにある間、自分も相手も次のようにする⇒自分自身のターンを終えるとき、特徴「男」または「女」または「獣」または「恐竜」を持つホールド状態のユニットを1体選び撃破する。";

  it("XG1-098: カタログ本文・スペックが出典と一致（出典: atwiki/page-1562）", () => {
    expectCatalogText("XG1-098", TEXT);
    expectUnitStats("XG1-098", { name: "猛毒鎧将デスコーピオン", category: ["WB", "DA"], size: "S", bp: 4000, sp: undefined, powerCost: 4, features: ["昆虫", "人型"] });
    expectRarityIn("XG1-098", ["N"]);
  });

  it("XG1-098: 【ポイズンアンカー】自分がターンを終えるとき、「男」「女」等を持つホールド状態のユニット（自軍・敵軍とも。「メカ」だけのユニットは除く）を1体選び撃破する（見送れない）（既知の不具合: CARD-XG1-098 選択が開かない）（出典: atwiki/page-1562「ホールド状態のユニットを1体選び撃破する」・カード評価「お互いに相手のユニットを選べる」「エリア・サイズを問わず撃破できる」）", () => {
    const s = endTurn(p1Battle({ battle: [inst("XG1-098", "ds"), heldUnit("SPEC-MAN", "own"), heldUnit("SPEC-MEC", "mec")] }, { rush: [heldUnit("SPEC-WOM", "w")] }, EXTRA));
    expectChoiceFrom(s, "player1", "XG1-098");
    expect(canSkip(s)).toBe(false);
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-MAN:own", "SPEC-WOM:w"]);
    expect(zoneOf(resolveAll(pick(s, "SPEC-WOM:w")), "player2", "SPEC-WOM:w")).toBe("discard");
  });

  it("XG1-098: 相手も自分自身のターンを終えるとき、同じように1体選び撃破する（既知の不具合: CARD-XG1-098 選択が開かない）（出典: atwiki/page-1562「自分も相手も次のようにする」）", () => {
    const s = endTurn(enemyBoard({ battle: [inst("XG1-098", "ds"), heldUnit("SPEC-MAN", "own")] }, { battle: [inst("TST-UNIT-0", "x")] }, EXTRA));
    expectChoiceFrom(s, "player2", "XG1-098");
  });
});

// ===========================================================================
describe("XG1-099 ガンツ先生", () => {
  const TEXT =
    "※これは自軍ターン中、バトルエリアに出られない。 【採点】これが自軍エリアにある間、自軍バトルフェイズ中、次の効果を発動できる⇒Sユニットを1体選んでから、自軍コマンドを1つホールドする。このターン、選んだユニットの必要パワーの数字は、ホールドした自軍コマンドの必要パワーの数字になる。";

  it("XG1-099: カタログ本文・スペックが出典と一致（出典: atwiki/page-1590）", () => {
    expectCatalogText("XG1-099", TEXT);
    expectUnitStats("XG1-099", { name: "ガンツ先生", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 2, features: ["メカ", "人型"] });
    expectRarityIn("XG1-099", ["NR"]);
  });

  const board = () => p1Battle({ rush: [inst("XG1-099", "gz"), inst("TST-UNIT-0", "u")], command: [inst("SPEC-C6", "c6")] }, {}, EXTRA);

  it("XG1-099: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-1590「※これは自軍ターン中、バトルエリアに出られない」）", () => {
    const s = board();
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG1-099:gz")).toBe(false);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "TST-UNIT-0:u")).toBe(true);
  });

  it("XG1-099: 【採点】自軍バトルフェイズ中、自軍エリアにあれば起動できる（既知の不具合: CARD-XG1-099 起動の手がない）（出典: atwiki/page-1590「自軍バトルフェイズ中、次の効果を発動できる」）", () => {
    expect(canActivateField(board(), "XG1-099:gz")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-100 ロボコン", () => {
  const TEXT =
    "※レジスト 【お手伝いロボット】これが自軍バトルエリアからラッシュエリアに戻るとき、自軍山札の上から1枚引いて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい。置けなければこの効果は発動できない。";

  it("XG1-100: カタログ本文・スペックが出典と一致（出典: atwiki/page-1669）", () => {
    expectCatalogText("XG1-100", TEXT);
    expectUnitStats("XG1-100", { name: "ロボコン", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 0, features: ["メカ", "人型"] });
    expectRarityIn("XG1-100", ["R"]);
  });

  it("XG1-100: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1669「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-100", "rb")] }, "XG1-100:rb"))).toBe(true);
  });

  it("XG1-100: 【お手伝いロボット】自軍スタートフェイズにバトルエリアからラッシュエリアに戻るとき、山札の上の1枚を自軍コマンドゾーンにホールド状態で置くかを選べる（任意）（既知の不具合: CARD-XG1-100 選択が開かない）（出典: atwiki/page-1669「自軍山札の上から1枚引いて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい」・カード評価「開始直後ならばほぼ確実にコマンド加速」）", () => {
    const s = returnedAtStart({ battle: [inst("XG1-100", "rb")], deck: [inst("TST-OP", "top"), ...deckCards(3)] }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-100");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(s, ["accept"]);
    expect(zoneOf(t, "player1", "TST-OP:top")).toBe("command");
    expect(isHeldCard(t, "player1", "TST-OP:top")).toBe(true);
  });

  it("XG1-100: 自軍コマンドゾーンが5枚で置けなければ発動しない（出典: atwiki/page-1669「置けなければこの効果は発動できない」）", () => {
    const command = [inst("TST-OP", "c1"), inst("TST-OP", "c2"), inst("TST-OP", "c3"), inst("TST-OP", "c4"), inst("TST-OP", "c5")];
    const s = returnedAtStart({ battle: [inst("XG1-100", "rb")], command, deck: [inst("TST-OP", "top"), ...deckCards(3)] }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-100").toBe(false);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("deck");
  });
});
