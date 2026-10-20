/**
 * カード別スペック: XG2-015〜XG2-020（クロスギャザー ザ・ドラゴンタイガー リュウレンジャー〜合身獣士・ブルタウラス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-015」〜「XG2-020」とカード名で検索。card_4・rider_1 の「リュウレンジャー」は RS-205 の項）。
 *     atwiki に転載された公式 Q&A（XG2-017 Q1・XG2-019 Q1〜Q4）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-01・R-KW-CALL-01・R-KW-RESIST-01・R-ADD-06）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  activateResident,
  attackUntilRegister,
  bpOf,
  canActivateResident,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  enter,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnit,
  heldCount,
  inst,
  legal,
  ncEnter,
  p1Battle,
  pick,
  pickAll,
  powerCards,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  strike,
  sUnit,
  withStacked,
  zoneOf,
} from "./XG2-001-020.helpers";

const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_L = sUnit("SPEC-DA-L", { category: "DA", bp: 8000, size: "L", sp: undefined });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 1000, powerCost: 1 });
const RED_S = sUnit("SPEC-RED-S", { category: "WB", bp: 1000, features: ["レッド"] });
const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const HUMANOID_M = sUnit("SPEC-HUMANOID-M", { category: "MA", bp: 3000, size: "M", sp: 1, features: ["人型"] });
const EXTRA = [DA_S, DA_L, WB_S, MA_S, RED_S, ES, EM, HUMANOID_M];

const fighter = () => ({ instanceId: "RS-285:m", cardId: "RS-285" });

// ===========================================================================
describe("XG2-015 リュウレンジャー", () => {
  const TEXT =
    "※コールMA 【赤龍双竜剣】「SP1」敵軍バトルエリアから、効果名を持たないテキストに「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれた敵軍ユニットを1体選び、撃破してもよい。";

  it("XG2-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-1791）", () => {
    expectCatalogText("XG2-015", TEXT);
    expectUnit("XG2-015", { name: "リュウレンジャー", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 4, comboNumber: 3, features: ["レッド", "男"] });
    expectRarityIn("XG2-015", ["NR"]);
  });

  it("XG2-015: ※コールMA — 自軍ラッシュエリアのこれを、MA のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-1791「※コールMA」・R-KW-CALL-01）", () => {
    let s = rushBoard({ hand: [inst("SPEC-MA-S", "u")], rush: [inst("XG2-015", "c")], power: powerCards(1) }, {}, EXTRA);
    const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "SPEC-MA-S:u");
    expect(pay).toBeDefined();
    s = act(s, pay!);
    expect(zoneOf(s, "player1", "SPEC-MA-S:u")).toBe("rush");
    expect(cardIn(s, "player1", "XG2-015:c")?.commandHeld).toBe(true);
  });

  /** CN3（3番目）で出る。敵軍バトルエリアに ※ を持つユニット（S・M）・効果名つきのテキストにだけ書かれたユニット・書かれていないユニット、ラッシュエリアに ※ のユニット。 */
  const entered = (fillerCount = 2) =>
    ncEnter(
      "XG2-015:r",
      fillerCount,
      {},
      { battle: [inst("RS-339", "y"), fighter(), inst("XG2-014", "t"), inst("RK-224", "k"), inst("SPEC-ES", "p")], rush: [inst("RS-092", "z")] },
      EXTRA,
    );

  it("XG2-015: NC【赤龍双竜剣】— CN3（3番目）で「SP1」を得る（出典: atwiki/page-1791・R-CN-01）", () => {
    let s = entered();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-015") s = skip(s);
    expect(spOf(settle(s), "player1", "XG2-015:r")).toBe(1);
  });

  it("XG2-015: NC【赤龍双竜剣】— 敵軍バトルエリアの、効果名を持たないテキスト（※）にその文が書かれたユニット（サイズを問わない。「「SP1」」の表記ゆれも同じ）から1体選べる。効果名つきのテキスト（RK-224【サポート】）にだけ書かれたユニット・ラッシュエリアのユニットは選べない。任意（出典: atwiki/page-1791・カード評価「サイズに制限がないため、冥府神ドレイクなども対象」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-015");
    expect(choiceIds(s)).toEqual(["RS-285:m", "RS-339:y", "XG2-014:t"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-015: NC【赤龍双竜剣】— 選んだユニットを撃破する（出典: atwiki/page-1791「撃破してもよい」）", () => {
    const s = resolveAll(pick(entered(), "RS-285:m"));
    expect(zoneOf(s, "player2", "RS-285:m")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-016 天空気殿", () => {
  const TEXT =
    "※このカードの追加条件は、カード名に「気伝武人」を含む自軍ユニットがあるとき、次のように変更される⇒追加で自軍コマンドを2つホールドする 【天空大風車】このユニットからコンビネーションする、特徴「人型」を持つMユニットは、次の能力を得る⇒これがストライクしてダメージを与えたとき、DAを持つ敵軍ユニットを1体選び撃破してもよい。";

  it("XG2-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-1792）", () => {
    expectCatalogText("XG2-016", TEXT);
    expectUnit("XG2-016", { name: "天空気殿", category: "MA", size: "L", bp: 9000, sp: undefined, powerCost: "5+", comboNumber: "L", features: ["獣"], rushCondition: "send_s_unit_to_discard" });
    expectRarityIn("XG2-016", ["N"]);
  });

  const board = (rush: ReturnType<typeof inst>[], cmds = 1, power = 5) =>
    rushBoard({ hand: [inst("XG2-016", "h")], rush, power: powerCards(power), command: releasedCat("MA", cmds) }, {}, EXTRA);
  const sUnits = (n: number) => Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `s${i}`));

  it("XG2-016: 追加条件 — 自軍 S ユニット4体を捨札にしてパワー5でラッシュできる。3体ではできない（出典: atwiki/page-1792「追加条件：自軍Sユニット4体を捨て札にする」）", () => {
    const r = rushFromHand(board(sUnits(4)), "player1", "XG2-016:h");
    expect(r.ok, r.error).toBe(true);
    for (let i = 0; i < 4; i++) expect(zoneOf(r.state, "player1", `TST-UNIT-0:s${i}`)).toBe("discard");
    expect(canStartRush(board(sUnits(3)), "player1", "XG2-016:h")).toBe(false);
  });

  it("XG2-016: ※ カード名に「気伝武人」を含む自軍ユニットがあれば、追加条件は「追加で自軍コマンドを2つホールドする」に変わる（S ユニットを捨札にせず、コマンドを計3つホールドしてラッシュ）（出典: atwiki/page-1792「次のように変更される⇒追加で自軍コマンドを2つホールドする」）", () => {
    const r = rushFromHand(board([inst("XG2-010", "kb")], 3), "player1", "XG2-016:h");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG2-016:h")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-010:kb")).toBe("rush");
    expect(heldCount(s)).toBe(3);
  });

  it("XG2-016: ※ 変更後は、追加でホールドするコマンドが2つなければラッシュできない（出典: atwiki/page-1792）", () => {
    expect(canStartRush(board([inst("XG2-010", "kb")], 2), "player1", "XG2-016:h")).toBe(false);
  });

  /** 自軍バトルフェイズ、バトルエリアの天空気殿の次に next を出し、ストライクする。敵軍に DA のユニット。 */
  const struck = (next: string) => {
    const [id, suf] = next.split(":") as [string, string];
    let s = p1Battle({ battle: [inst("XG2-016", "t")], rush: [inst(id, suf)] }, { rush: [inst("SPEC-DA-S", "d")], battle: [inst("SPEC-DA-L", "l"), inst("SPEC-WB-S", "w")], power: powerCards(3, "ep") }, EXTRA);
    s = enter(s, next);
    if (s.pendingEffectChoice) s = resolveAll(s.pendingEffectChoice.optional ? skip(s) : s);
    return settle(strike(s, next));
  };

  it("XG2-016: 【天空大風車】これからコンビネーションする「人型」の M ユニット（SP1）は、ストライクしてダメージを与えたとき DA を持つ敵軍ユニット（エリア・サイズを問わない）を1体選び撃破できる（任意）（出典: atwiki/page-1792）", () => {
    const s = struck("SPEC-HUMANOID-M:h");
    expect(damageOf(s, "player2")).toBeGreaterThan(0);
    expectChoiceFrom(s, "player1", "XG2-016");
    expect(choiceIds(s)).toEqual(["SPEC-DA-L:l", "SPEC-DA-S:d"]);
    expect(canSkip(s)).toBe(true);
    expect(zoneOf(resolveAll(pick(s, "SPEC-DA-L:l")), "player2", "SPEC-DA-L:l")).toBe("discard");
  });

  it("XG2-016: 【天空大風車】S ユニットがコンビネーションしても得ない（出典: atwiki/page-1792「特徴「人型」を持つMユニットは」・コメント「サイズはSユニットのままだから使えない」）", () => {
    const s = struck("TST-UNIT-0:s");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-016");
  });
});

// ===========================================================================
describe("XG2-017 大連王", () => {
  const TEXT =
    "合体―気伝武人龍星王（または気伝獣龍星王）＋天空気殿 【大王剣・疾風怒濤】自軍ターン中、これが自軍バトルエリアに出たとき、敵軍バトルエリアからDAを持つ敵軍ユニットを1体選び撃破してもよい。そうしたとき、撃破したユニットがLユニットなら、捨札にするかわりに持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-1824）", () => {
    expectCatalogText("XG2-017", TEXT);
    expectUnit("XG2-017", { name: "大連王", category: "MA", size: "L", bp: 12000, sp: 1, powerCost: "5+", features: ["人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG2-017", ["SR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 5) =>
    rushBoard({ hand: [inst("XG2-017", "h")], rush, power: powerCards(power), command: releasedCat("MA", 1) }, {}, EXTRA);

  it("XG2-017: 追加条件（合体）— 気伝武人龍星王（XG2-010）・天空気殿を捨札にしてパワー5でラッシュできる。パワー4ではできない（出典: atwiki/page-1824「合体―気伝武人龍星王（または気伝獣龍星王）＋天空気殿」）", () => {
    const r = rushFromHand(board([inst("XG2-010", "r"), inst("XG2-016", "t")]), "player1", "XG2-017:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-010:r")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG2-016:t")).toBe("discard");
    expect(canStartRush(board([inst("XG2-010", "r"), inst("XG2-016", "t")], 4), "player1", "XG2-017:h")).toBe(false);
  });

  it("XG2-017: 追加条件（合体）— 気伝武人龍星王のかわりに気伝獣龍星王（RS-291）でもよい（出典: atwiki/page-1824「（または気伝獣龍星王）」）", () => {
    const r = rushFromHand(board([inst("RS-291", "r"), inst("XG2-016", "t")]), "player1", "XG2-017:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-291:r")).toBe("discard");
  });

  it("XG2-017: 追加条件 — 自軍「牙大王」1体を捨札にしてもラッシュできる（出典: atwiki/page-1824「自軍合体ユニットまたは自軍「牙大王」1体を捨て札にする」）", () => {
    const r = rushFromHand(board([inst("XG2-012", "k")]), "player1", "XG2-017:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-012:k")).toBe("discard");
  });

  const entered = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(p1Battle({ rush: [inst("XG2-017", "d")] }, { battle: [inst("SPEC-DA-S", "s"), inst("SPEC-DA-L", "l"), inst("SPEC-WB-S", "w")], rush: [inst("SPEC-DA-S", "r")], ...p2 }, EXTRA), "XG2-017:d");

  it("XG2-017: 【大王剣・疾風怒濤】自軍ターン中に自軍バトルエリアに出たとき、敵軍バトルエリアの DA を持つ敵軍ユニット（サイズを問わない）から1体選べる。ラッシュエリアのユニット・DA を持たないユニットは選べない（任意）（出典: atwiki/page-1824「敵軍バトルエリアからDAを持つ敵軍ユニットを1体選び撃破してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-017");
    expect(choiceIds(s)).toEqual(["SPEC-DA-L:l", "SPEC-DA-S:s"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-017: 【大王剣・疾風怒濤】L ユニット以外は撃破して捨札にする（出典: atwiki/page-1824）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DA-S:s"));
    expect(zoneOf(s, "player2", "SPEC-DA-S:s")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG2-017: 【大王剣・疾風怒濤】撃破したユニットが L ユニットなら、捨札にするかわりに持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1824「捨札にするかわりに持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DA-L:l"));
    expect(zoneOf(s, "player2", "SPEC-DA-L:l")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-DA-L:l")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG2-017: 公式Q&A — 撃破した DA の L ユニットが RS-437 白熱する実況でその場に留まったときは、捨札にならないのでダメージにもならない（出典: atwiki/page-1824 Q1「その場に留まった場合は…発動しません」）", () => {
    const l = withStacked(inst("SPEC-DA-L", "l"), [{ ...inst("TST-UNIT-0", "under"), faceDown: true }]);
    const s = resolveAll(pick(entered({ battle: [inst("SPEC-DA-S", "s"), l], operation: [resident("RS-437", "jk")] }), "SPEC-DA-L:l"));
    expect(zoneOf(s, "player2", "SPEC-DA-L:l")).toBe("battle");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG2-018 ゲキタイガー", () => {
  const TEXT = "【来来獣】これをラッシュしたとき、特徴「レッド」を持つ自軍ユニットを1体選びホールドしてもよい。そうしたとき、このターン、これはBP＋3000される。";

  it("XG2-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-1793）", () => {
    expectCatalogText("XG2-018", TEXT);
    expectUnit("XG2-018", { name: "ゲキタイガー", category: ["WB", "MA"], size: "M", bp: 4000, sp: "1/2", powerCost: "3+", features: ["激気"], rushCondition: "state_gate" });
    expectRarityIn("XG2-018", ["N"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 3) =>
    rushBoard({ hand: [inst("XG2-018", "g")], rush, power: powerCards(power), command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)] }, {}, EXTRA);

  it("XG2-018: 追加条件 — 特徴「レッド」を持つ自軍ユニットがあればパワー3でラッシュできる。なければラッシュできない（出典: atwiki/page-1793「追加条件：特徴「レッド」を持つ自軍ユニットがある」）", () => {
    expect(canStartRush(board([inst("SPEC-RED-S", "red")]), "player1", "XG2-018:g")).toBe(true);
    expect(canStartRush(board([inst("SPEC-WB-S", "w")]), "player1", "XG2-018:g")).toBe(false);
    expect(canStartRush(board([inst("SPEC-RED-S", "red")], 2), "player1", "XG2-018:g")).toBe(false);
  });

  const rushed = () => {
    const r = rushFromHand(board([inst("SPEC-RED-S", "red"), inst("SPEC-WB-S", "w")]), "player1", "XG2-018:g");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG2-018: 【来来獣】ラッシュしたとき、「レッド」を持つ自軍ユニットから1体選んでホールドするかを選べる（任意）（出典: atwiki/page-1793「特徴「レッド」を持つ自軍ユニットを1体選びホールドしてもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG2-018");
    expect(choiceIds(s)).toEqual(["SPEC-RED-S:red"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-018: 【来来獣】ホールドすると、このターン BP+3000（4000→7000）（出典: atwiki/page-1793「そうしたとき、このターン、これはBP＋3000される」）", () => {
    const s = resolveAll(pick(rushed(), "SPEC-RED-S:red"));
    expect(cardIn(s, "player1", "SPEC-RED-S:red")?.commandHeld).toBe(true);
    expect(bpOf(s, "player1", "XG2-018:g")).toBe(7000);
  });

  it("XG2-018: 【来来獣】ホールドしなければ BP は上がらない（出典: atwiki/page-1793「ホールドしてもよい。そうしたとき」）", () => {
    const s0 = rushed();
    const s = resolveAll(s0.pendingEffectChoice?.sourceCardId === "XG2-018" ? skip(s0) : s0);
    expect(cardIn(s, "player1", "SPEC-RED-S:red")?.commandHeld ?? false).toBe(false);
    expect(bpOf(s, "player1", "XG2-018:g")).toBe(4000);
  });
});

// ===========================================================================
describe("XG2-019 知恵の樹モーク", () => {
  const TEXT =
    "※常駐 自軍バトルフェイズ中、自軍ラッシュエリアから、ライドされていない特徴「獣」を持つMビークルを1体選んでもよい。そうしたとき、選んだビークルは、このターン、テキストを持たないMユニットとして扱い、次の情報が追加される⇒「BP3000」「SP空欄」";

  it("XG2-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-1751）", () => {
    expectCatalogText("XG2-019", TEXT);
    expectOpStats("XG2-019", { name: "知恵の樹モーク", category: "WB", powerCost: 3 });
    expectRarityIn("XG2-019", ["N"]);
  });

  /** 自軍バトルフェイズ、モークを常駐。ラッシュエリアに「獣」の M ビークル（ギンガレオン・ギンガリラ）と、ライドされたギンガルコン。 */
  const board = (phase: "battle" | "rush" = "battle") => {
    const p1 = {
      operation: [resident("XG2-019", "mk")],
      rush: [inst("RS-466", "leo"), inst("RS-468", "gor"), inst("RS-467", "rid"), { ...inst("TST-UNIT-0", "rider"), mountedOnInstanceId: "RS-467:rid" }],
    };
    return phase === "battle" ? p1Battle(p1, {}, EXTRA) : rushBoard(p1, {}, EXTRA);
  };

  it("XG2-019: ※常駐 — 自軍バトルフェイズ中に起動でき、ライドされていない「獣」の M ビークルから1体選べる（ライドされたビークルは選べない。任意）（出典: atwiki/page-1751）", () => {
    const s0 = board();
    expect(canActivateResident(s0, "XG2-019:mk")).toBe(true);
    const s = activateResident(s0, "XG2-019:mk");
    expectChoiceFrom(s, "player1", "XG2-019");
    expect(choiceIds(s)).toEqual(["RS-466:leo", "RS-468:gor"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-019: 選んだビークルは、このターン、BP3000・SP 空欄の M ユニットとして扱い、バトルエリアに出られる（出典: atwiki/page-1751「テキストを持たないMユニットとして扱い…「BP3000」「SP空欄」」・カード評価「星獣たちをアタッカーとして運用」）", () => {
    const s = resolveAll(pick(activateResident(board(), "XG2-019:mk"), "RS-466:leo"));
    expect(bpOf(s, "player1", "RS-466:leo")).toBe(3000);
    expect(canEnter(s, "RS-466:leo")).toBe(true);
    const t = enterSeq(s, ["RS-466:leo"]);
    expect(zoneOf(t, "player1", "RS-466:leo")).toBe("battle");
    expect(spOf(t, "player1", "RS-466:leo")).toBe(0);
  });

  it("XG2-019: 自軍ラッシュフェイズには起動できない（出典: atwiki/page-1751「自軍バトルフェイズ中」）", () => {
    expect(canActivateResident(board("rush"), "XG2-019:mk")).toBe(false);
  });

  it("XG2-019: 公式Q&A — ユニットとして扱われても「ラッシュされた」ことにはならない（相手は RS-026 疾風流超忍法などを使えない）（出典: atwiki/page-1751 Q1・Q2「ラッシュされたことにはなりませんので」）", () => {
    const s = resolveAll(pick(activateResident(board(), "XG2-019:mk"), "RS-466:leo"));
    expect(s.pendingRush).toBeUndefined();
    expect(legal(s).some((a) => a.type === "pass_rush_reaction")).toBe(false);
  });

  it("XG2-019: 1ターンに何度でも使える — 同じターンに2回起動し、ギンガレオンとギンガリラの両方をテキストを持たない M ユニットとして扱う（出典: 利用者の決定 2026-10-20・questions-all.md U-14）", () => {
    const s1 = resolveAll(pick(activateResident(board(), "XG2-019:mk"), "RS-466:leo"));
    expect(canActivateResident(s1, "XG2-019:mk")).toBe(true);
    const s2 = activateResident(s1, "XG2-019:mk");
    expectChoiceFrom(s2, "player1", "XG2-019");
    expect(choiceIds(s2)).toEqual(["RS-468:gor"]);
    const s = resolveAll(pick(s2, "RS-468:gor"));
    for (const id of ["RS-466:leo", "RS-468:gor"]) {
      const def = s.definitions[cardIn(s, "player1", id)!.cardId];
      expect(def?.type).toBe("unit");
      expect(def?.text).toBe("");
      expect(bpOf(s, "player1", id)).toBe(3000);
      expect(canEnter(s, id)).toBe(true);
    }
  });

  it("XG2-019: すでに M ユニットとして扱っているビークルは、もう選べない（候補がなくなれば起動できない）（出典: 利用者の決定 2026-10-20・questions-all.md U-14）", () => {
    const s1 = resolveAll(pick(activateResident(board(), "XG2-019:mk"), "RS-466:leo"));
    expect(choiceIds(activateResident(s1, "XG2-019:mk"))).not.toContain("RS-466:leo");
    const s = resolveAll(pick(activateResident(s1, "XG2-019:mk"), "RS-468:gor"));
    expect(canActivateResident(s, "XG2-019:mk")).toBe(false);
  });

  it.todo(
    "XG2-019: 公式Q&A — 本来の BP を3000として扱い、BP を「＋」「－」する効果を受ける（Q3）・RS-234 アバレキラーからコンビネーションさせると、ターンを終えるときに【ウイングペンタクト】で撃破される（Q4）（出典: atwiki/page-1751 Q3・Q4）— モークの起動そのものが合法手にない（gaps.md CARD-XG2-019）ので、BP 修正・ターン終了時の撃破を確かめる盤面に進めない",
  );
});

// ===========================================================================
describe("XG2-020 合身獣士・ブルタウラス", () => {
  const TEXT =
    "合体―重騎士＋重星獣・ゴウタウラス ※レジスト 【野牛鋭断】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアのSユニットを好きな数選び撃破してもよい。ただし選べるユニットの数は、敵軍ダメージの点数と同じ数までとする。";

  it("XG2-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-1823）", () => {
    expectCatalogText("XG2-020", TEXT);
    expectUnit("XG2-020", { name: "合身獣士・ブルタウラス", category: "WB", size: "L", bp: 9000, sp: 1, powerCost: "6+", features: ["獣", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG2-020", ["SR"]);
  });

  it("XG2-020: 追加条件（合体）— 重騎士・重星獣・ゴウタウラスを捨札にしてパワー6でラッシュできる。パワー5ではできない（出典: atwiki/page-1823「合体―重騎士＋重星獣・ゴウタウラス」「必要パワー：6+」）", () => {
    const b = (power: number) => rushBoard({ hand: [inst("XG2-020", "b")], rush: [inst("XG2-021", "k"), inst("XG2-022", "g")], power: powerCards(power), command: releasedCat("WB", 1) }, {}, EXTRA);
    const r = rushFromHand(b(6), "player1", "XG2-020:b");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-021:k")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG2-022:g")).toBe("discard");
    expect(canStartRush(b(5), "player1", "XG2-020:b")).toBe(false);
  });

  it("XG2-020: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-1823 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-020", "b")] }, "XG2-020:b"))).toBe(true);
  });

  const entered = (damage: number) =>
    enter(
      p1Battle(
        { rush: [inst("XG2-020", "b")] },
        { battle: [inst("SPEC-ES", "e1"), inst("SPEC-ES", "e2"), inst("SPEC-ES", "e3"), inst("SPEC-EM", "m")], rush: [inst("SPEC-ES", "r")], power: damageCards(damage), damage },
        EXTRA,
      ),
      "XG2-020:b",
    );

  it("XG2-020: 【野牛鋭断】自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの S ユニットから選べる（M ユニット・ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-1823「敵軍バトルエリアのSユニットを好きな数選び撃破してもよい」）", () => {
    const s = entered(2);
    expectChoiceFrom(s, "player1", "XG2-020");
    expect(choiceIds(s)).toEqual(["SPEC-ES:e1", "SPEC-ES:e2", "SPEC-ES:e3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-020: 【野牛鋭断】敵軍ダメージが2点なら2体まで選んで撃破できる（出典: atwiki/page-1823「選べるユニットの数は、敵軍ダメージの点数と同じ数までとする」）", () => {
    let s = pickAll(entered(2), ["SPEC-ES:e1", "SPEC-ES:e2"]);
    if (s.pendingEffectChoice?.sourceCardId === "XG2-020" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = accept(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-ES:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:e3")).toBe("battle");
  });

  it("XG2-020: 【野牛鋭断】敵軍ダメージが0点なら1体も選べない（出典: atwiki/page-1823「敵軍ダメージの点数と同じ数まで」）", () => {
    const s = entered(0);
    if (s.pendingEffectChoice?.sourceCardId === "XG2-020") expect(choiceIds(s)).toEqual([]);
  });
});
