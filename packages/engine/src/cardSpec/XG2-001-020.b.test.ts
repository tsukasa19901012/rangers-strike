/**
 * カード別スペック: XG2-008〜XG2-014（クロスギャザー ザ・ドラゴンタイガー ロケットタイガー〜鉄面臂張遼）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-XG2-014 鉄面臂張遼【気力妖力合体】の修正後テキスト）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に
 *     本範囲のカードの項はない（「XG2-008」〜「XG2-014」とカード名で検索。card_5 の「気伝武人龍星王」は RS-290 の項）。
 *     atwiki に転載された公式 Q&A（XG2-010 Q1・XG2-014 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md。XG2-014 はライブ写し pages/1754.txt もある）
 *  3. docs/rules/*.md の一般ルール（R-CN-01・R-ADD-06）・grnrngr/faq-card-5 RS-339（「DAを持つ」はマルチカテゴリを含む）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-014 Q1（MA のみ・DA のみのコマンドを1つずつホールドして撃破する）と修正後テキストは rulesSpec/08-errata.s2-atwiki.test.ts（R-ERR-XG2-014）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  attack,
  attackedInEnemyTurn,
  canCounter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageOf,
  enemyTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  inst,
  legal,
  ncEnter,
  nextPhase,
  NOSP_ATTACKER,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  sUnit,
  substitutes,
  useNinja,
  zoneOf,
} from "./XG2-001-020.helpers";

const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M" });
const DA_L = sUnit("SPEC-DA-L", { category: "DA", bp: 8000, size: "L", sp: undefined });
const MADA_S = sUnit("SPEC-MADA-S", { category: ["MA", "DA"] as never, bp: 1000 });
const NOT_DA = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const MULTI_S = sUnit("SPEC-MULTI-S", { category: ["WB", "ET"] as never, bp: 1000 });
const MULTI_M = sUnit("SPEC-MULTI-M", { category: ["WB", "ET"] as never, bp: 3000, size: "M" });
const MADA_CMD = { id: "SPEC-MADA-CMD", name: "SPEC-MADA-CMD", type: "operation", category: ["MA", "DA"], rarity: "N", expansion: "card-spec", powerCost: 1 } as never;
const EXTRA = [DA_S, DA_M, DA_L, MADA_S, NOT_DA, MULTI_S, MULTI_M, MADA_CMD, NOSP_ATTACKER];

// ===========================================================================
describe("XG2-008 ロケットタイガー", () => {
  const TEXT = "【ハンドロケット】 これがアタックするとき、相手は「アタックされたとき発動できる」と書かれたカウンターオペレーションを発動できない。";

  it("XG2-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-1752）", () => {
    expectCatalogText("XG2-008", TEXT);
    expectUnit("XG2-008", { name: "ロケットタイガー", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["メカ", "獣", "怪人"] });
    expectRarityIn("XG2-008", ["N"]);
  });

  /** 自軍バトルフェイズ、attacker が敵軍の TST-UNIT-0 にアタックする。敵軍は手札に RS-018 隠流忍術（「自軍ユニットがアタックされたとき発動できる」）。 */
  const attacked = (attacker: string) =>
    attack(
      p1Battle(
        { battle: [inst("XG2-008", "rt"), inst("TST-UNIT-0", "o")] },
        { battle: [inst("TST-UNIT-0", "e"), inst("TST-UNIT-0", "sub")], hand: [inst("RS-018", "c")], command: releasedCat("MA", 2), power: powerCards(5, "ep") },
        EXTRA,
      ),
      attacker,
      "TST-UNIT-0:e",
    );

  it("XG2-008: 対照 — ほかの自軍ユニットのアタックには、相手は RS-018 隠流忍術（「アタックされたとき発動できる」）を使える（出典: RS-018 本文）", () => {
    expect(canCounter(attacked("TST-UNIT-0:o"), "RS-018:c", "player2")).toBe(true);
  });

  it("XG2-008: 【ハンドロケット】これがアタックするとき、相手は「アタックされたとき発動できる」と書かれたカウンター（RS-018 隠流忍術）を発動できない（出典: atwiki/page-1752・カード評価「隠流忍術などを発動されずにアタックできる」）", () => {
    expect(canCounter(attacked("XG2-008:rt"), "RS-018:c", "player2")).toBe(false);
  });
});

// ===========================================================================
describe("XG2-009 コンピュータードラゴン", () => {
  const TEXT =
    "【行動予測】 これが自軍バトルエリアにある間、敵軍バトルフェイズ開始時、次の効果を発動できる⇒敵軍Sユニットを1体選び、アタックかストライクのどちらかを宣言する。選んだユニットは、そのターン、宣言した行動を行えない。";

  it("XG2-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-1753）", () => {
    expectCatalogText("XG2-009", TEXT);
    expectUnit("XG2-009", { name: "コンピュータードラゴン", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 4, features: ["メカ", "獣", "ドラゴン", "怪人"] });
    expectRarityIn("XG2-009", ["N"]);
  });

  /** 敵軍（player2）のラッシュフェイズから敵軍バトルフェイズに進める。 */
  const toEnemyBattle = (p1: Partial<GameState["players"]["player1"]>) =>
    nextPhase(enemyTurn(p1, { rush: [inst("TST-UNIT-0", "e"), inst("SPEC-DA-M", "m")] }, EXTRA, "rush"));

  it("XG2-009: 【行動予測】自軍バトルエリアにある間、敵軍バトルフェイズ開始時に発動するかを選べ、敵軍 S ユニットから1体選ぶ（M ユニットは選べない。任意）（出典: atwiki/page-1753「敵軍バトルフェイズ開始時、次の効果を発動できる⇒敵軍Sユニットを1体選び」）", () => {
    const s = toEnemyBattle({ battle: [inst("XG2-009", "cd")] });
    expectChoiceFrom(s, "player1", "XG2-009");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e"]);
  });

  it("XG2-009: 【行動予測】「アタック」を宣言すると、選んだユニットはそのターンアタックできない（ストライクはできる）（出典: atwiki/page-1753「選んだユニットは、そのターン、宣言した行動を行えない」）", () => {
    let s = resolveAll(pick(toEnemyBattle({ battle: [inst("XG2-009", "cd"), inst("TST-UNIT-0", "mine")] }), "TST-UNIT-0:e"), ["attack"]);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "TST-UNIT-0:e" });
    const acts = legal(s).filter((a) => a.playerId === "player2");
    expect(acts.some((a) => a.type === "battle")).toBe(false);
    expect(acts.some((a) => a.type === "strike")).toBe(true);
  });

  it("XG2-009: 【行動予測】ラッシュエリアにあるときは発動しない（出典: atwiki/page-1753「これが自軍バトルエリアにある間」）", () => {
    const s = toEnemyBattle({ rush: [inst("XG2-009", "cd")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-009");
  });
});

// ===========================================================================
describe("XG2-010 気伝武人龍星王", () => {
  const TEXT = "【龍星キック】「SP1」これがDAを持つ敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主の山札の上に戻してもよい。";

  it("XG2-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-1805）", () => {
    expectCatalogText("XG2-010", TEXT);
    expectUnit("XG2-010", { name: "気伝武人龍星王", category: "MA", size: "M", bp: 5000, sp: "special", powerCost: "4+", comboNumber: 3, features: ["獣", "ドラゴン", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG2-010", ["N"]);
  });

  const rushWith = (mat: string, power = 4) => {
    const [id, suf] = mat.split(":") as [string, string];
    return rushBoard({ hand: [inst("XG2-010", "h")], rush: [inst(id, suf)], power: powerCards(power), command: releasedCat("MA", 1) }, {}, EXTRA);
  };

  it("XG2-010: 追加条件 — 自軍「リュウレンジャー」（XG2-015）1体を捨札にしてパワー4でラッシュできる（出典: atwiki/page-1805「追加条件：自軍「リュウレンジャー」か「気伝獣龍星王」1体を捨札にする」）", () => {
    const r = rushFromHand(rushWith("XG2-015:m"), "player1", "XG2-010:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-010:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG2-015:m")).toBe("discard");
  });

  it("XG2-010: 追加条件 — 自軍「気伝獣龍星王」（RS-291）1体を捨札にしてもラッシュできる（出典: atwiki/page-1805「「リュウレンジャー」か「気伝獣龍星王」」）", () => {
    const r = rushFromHand(rushWith("RS-291:m"), "player1", "XG2-010:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-291:m")).toBe("discard");
  });

  it("XG2-010: 追加条件 — 「リュウレンジャー」「気伝獣龍星王」以外のユニットでは満たせない。パワー3ではラッシュできない（出典: atwiki/page-1805）", () => {
    expect(canStartRush(rushWith("TST-UNIT-0:m"), "player1", "XG2-010:h")).toBe(false);
    expect(canStartRush(rushWith("XG2-015:m", 3), "player1", "XG2-010:h")).toBe(false);
  });

  it("XG2-010: NC — CN3（バトルエリアの3番目）で「SP1」を得る（出典: atwiki/page-1805「「SP1」」・R-CN-01）", () => {
    let s = ncEnter("XG2-010:r", 2, {}, {}, EXTRA);
    if (s.pendingEffectChoice?.sourceCardId === "XG2-010") s = skip(s);
    expect(spOf(settle(s), "player1", "XG2-010:r")).toBe(1);
  });

  /** 自軍バトルフェイズ、バトルエリアの龍星王が defender にアタックする。 */
  const kicked = (defender: string) => {
    const [id, suf] = defender.split(":") as [string, string];
    return attack(p1Battle({ battle: [inst("XG2-010", "r")] }, { battle: [inst(id, suf)], deck: [inst("TST-OP", "etop")] }, EXTRA), "XG2-010:r", defender);
  };

  it("XG2-010: 【龍星キック】DA を持つ敵軍ユニット（マルチカテゴリも含む）にアタックするとき、バトルの前にバトル相手を戻すかを選べる（任意）（出典: atwiki/page-1805「DAを持つ敵軍ユニットにアタックするとき、バトルの前に…戻してもよい」・grnrngr/faq-card-5 RS-339「そのカテゴリを含むものはすべて対象」）", () => {
    for (const d of ["SPEC-DA-S:e", "SPEC-MADA-S:e"]) {
      const s = kicked(d);
      expectChoiceFrom(s, "player1", "XG2-010");
      expect(canSkip(s)).toBe(true);
    }
  });

  it("XG2-010: 【龍星キック】戻すと、バトル相手は持ち主の山札の一番上に戻り、バトルは行われない（サイズを問わない）（出典: atwiki/page-1805「バトル相手のユニットを持ち主の山札の上に戻してもよい」・カード評価「サイズを問わない」・コメント「バトルは行われない」）", () => {
    const s = resolveAll(accept(kicked("SPEC-DA-L:e")));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-DA-L:e");
    expect(zoneOf(s, "player1", "XG2-010:r")).toBe("battle");
  });

  it("XG2-010: 【龍星キック】DA を持たない敵軍ユニットへのアタックでは発動しない（出典: atwiki/page-1805「DAを持つ敵軍ユニットに」）", () => {
    const s = kicked("SPEC-WB-S:e");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-010");
  });

  it("XG2-010: 公式Q&A — DA の敵軍ユニットにアタックし、相手が RS-018 隠流忍術で DA を持たないユニットにかわりにバトルさせても、そのバトル相手を山札の上に戻せる（出典: atwiki/page-1805 Q1「「RS-018 隠流忍術」の効果で変更されたバトル相手のユニットを、持ち主の山札の上に戻すことになります」）", () => {
    let s = attack(
      p1Battle({ battle: [inst("XG2-010", "r")] }, { battle: [inst("SPEC-DA-S", "e"), inst("SPEC-WB-S", "sub")], hand: [inst("RS-018", "c")], command: releasedCat("MA", 2), power: powerCards(5, "ep"), deck: [inst("TST-OP", "etop")] }, EXTRA),
      "XG2-010:r",
      "SPEC-DA-S:e",
    );
    expect(substitutes(s, "RS-018:c")).toContain("SPEC-WB-S:sub");
    s = useNinja(s, "RS-018:c", "SPEC-WB-S:sub");
    expectChoiceFrom(s, "player1", "XG2-010");
    s = resolveAll(accept(s));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-WB-S:sub");
    expect(zoneOf(s, "player2", "SPEC-DA-S:e")).toBe("battle");
  });
});

// ===========================================================================
describe("XG2-011 気伝武人ウォンタイガー", () => {
  const TEXT =
    "【虎の子大秘術】好きなカード名1つを宣言してから、敵軍山札の上から1枚をオモテにしてもよい。オモテにしたカードが宣言したカード名と同名なら、そのカードを持ち主のパワーゾーンにダメージにして置く。それ以外なら山札の上に戻す。";

  it("XG2-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-1804）", () => {
    expectCatalogText("XG2-011", TEXT);
    expectUnit("XG2-011", { name: "気伝武人ウォンタイガー", category: "MA", size: "M", bp: 5000, sp: undefined, powerCost: "5+", comboNumber: 4, features: ["獣", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG2-011", ["N"]);
  });

  it("XG2-011: 追加条件 — 自軍「キバレンジャー」（XG2-013）か「気伝獣ウォンタイガー」（RS-293）1体を捨札にしてパワー5でラッシュできる。パワー4ではできない（出典: atwiki/page-1804）", () => {
    for (const [id, suf] of [["XG2-013", "k"], ["RS-293", "w"]] as const) {
      const b = (power: number) => rushBoard({ hand: [inst("XG2-011", "h")], rush: [inst(id, suf)], power: powerCards(power), command: releasedCat("MA", 1) }, {}, EXTRA);
      const r = rushFromHand(b(5), "player1", "XG2-011:h");
      expect(r.ok, `${id}: ${r.error}`).toBe(true);
      expect(zoneOf(r.state, "player1", `${id}:${suf}`)).toBe("discard");
      expect(canStartRush(b(4), "player1", "XG2-011:h")).toBe(false);
    }
  });

  /** CN4（バトルエリアの4番目）で出る。敵軍山札の一番上は TST-UNIT-0（カード名「Test Striker」）。 */
  const entered = () => ncEnter("XG2-011:w", 3, {}, { deck: [inst("TST-UNIT-0", "top"), inst("TST-OP", "second")] }, EXTRA);

  it("XG2-011: NC【虎の子大秘術】— カード名を宣言して敵軍山札の上から1枚をオモテにするかを選べる（任意）（出典: atwiki/page-1804「好きなカード名1つを宣言してから…オモテにしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-011");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-011: NC【虎の子大秘術】— オモテにしたカードが宣言したカード名と同名なら、持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1804「そのカードを持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(entered(), "Test Striker"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:top")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-0:top")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG2-011: NC【虎の子大秘術】— 違うカード名なら山札の上に戻す（出典: atwiki/page-1804「それ以外なら山札の上に戻す」）", () => {
    const s = resolveAll(pick(entered(), "Test Operation"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-0:top");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG2-012 牙大王", () => {
  const TEXT =
    "合体―気伝武人ウォンタイガー（または気伝獣ウォンタイガー）＋天空気殿 【飛翔剣・木端微塵】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアから、DAを持つ敵軍ユニットを1体選び撃破してもよい。そうしたとき、撃破したユニットがLユニットだったなら、捨札にするかわりに持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-1145）", () => {
    expectCatalogText("XG2-012", TEXT);
    expectUnit("XG2-012", { name: "牙大王", category: "MA", size: "L", bp: 13000, sp: 1, powerCost: "6+", features: ["人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG2-012", ["R"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 6) =>
    rushBoard({ hand: [inst("XG2-012", "h")], rush, power: powerCards(power), command: releasedCat("MA", 1) }, {}, EXTRA);

  it("XG2-012: 追加条件（合体）— 気伝武人ウォンタイガー（XG2-011）・天空気殿を捨札にしてパワー6でラッシュできる。パワー5ではできない（出典: atwiki/page-1145「合体―気伝武人ウォンタイガー（または気伝獣ウォンタイガー）＋天空気殿」「必要パワー：6+」）", () => {
    const r = rushFromHand(board([inst("XG2-011", "w"), inst("XG2-016", "t")]), "player1", "XG2-012:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-011:w")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG2-016:t")).toBe("discard");
    expect(canStartRush(board([inst("XG2-011", "w"), inst("XG2-016", "t")], 5), "player1", "XG2-012:h")).toBe(false);
  });

  it("XG2-012: 追加条件（合体）— 気伝武人ウォンタイガーのかわりに気伝獣ウォンタイガー（RS-293）でもよい（出典: atwiki/page-1145「（または気伝獣ウォンタイガー）」）", () => {
    const r = rushFromHand(board([inst("RS-293", "w"), inst("XG2-016", "t")]), "player1", "XG2-012:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-293:w")).toBe("discard");
  });

  it("XG2-012: 追加条件 — 自軍「大連王」1体を捨札にしてもラッシュできる（出典: atwiki/page-1145「追加条件：自軍合体ユニットまたは自軍「大連王」1体を捨札にする」）", () => {
    const r = rushFromHand(board([inst("XG2-017", "d")]), "player1", "XG2-012:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-017:d")).toBe("discard");
  });

  const entered = () =>
    enter(
      p1Battle({ rush: [inst("XG2-012", "k")] }, { rush: [inst("SPEC-DA-S", "s"), inst("SPEC-DA-L", "l"), inst("SPEC-MADA-S", "md"), inst("SPEC-WB-S", "wb")], battle: [inst("SPEC-DA-M", "b")] }, EXTRA),
      "XG2-012:k",
    );

  it("XG2-012: 【飛翔剣・木端微塵】自軍ターン中にバトルエリアに出たとき、敵軍ラッシュエリアの DA を持つ敵軍ユニット（サイズを問わない。マルチカテゴリも）から1体選べる。バトルエリアのユニット・DA を持たないユニットは選べない（任意）（出典: atwiki/page-1145「敵軍ラッシュエリアから、DAを持つ敵軍ユニットを1体選び撃破してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-012");
    expect(choiceIds(s)).toEqual(["SPEC-DA-L:l", "SPEC-DA-S:s", "SPEC-MADA-S:md"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-012: 【飛翔剣・木端微塵】L ユニット以外を選ぶと撃破して捨札にする（出典: atwiki/page-1145）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DA-S:s"));
    expect(zoneOf(s, "player2", "SPEC-DA-S:s")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG2-012: 【飛翔剣・木端微塵】撃破したユニットが L ユニットなら、捨札にするかわりに持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1145「捨札にするかわりに持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DA-L:l"));
    expect(zoneOf(s, "player2", "SPEC-DA-L:l")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-DA-L:l")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-013 キバレンジャー", () => {
  const TEXT = "【白虎真剣】「SP1」敵軍バトルエリアから、カテゴリを2つ以上持つSユニットを1体選び、撃破してもよい。";

  it("XG2-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-1790）", () => {
    expectCatalogText("XG2-013", TEXT);
    expectUnit("XG2-013", { name: "キバレンジャー", category: "MA", size: "S", bp: 1000, sp: "special", powerCost: 2, comboNumber: 3, features: ["ホワイト", "男"] });
    expectRarityIn("XG2-013", ["N"]);
  });

  const entered = (fillerCount = 2) =>
    ncEnter("XG2-013:k", fillerCount, {}, { battle: [inst("SPEC-MULTI-S", "b"), inst("SPEC-MULTI-M", "m"), inst("SPEC-WB-S", "w")], rush: [inst("SPEC-MULTI-S", "r")] }, EXTRA);

  it("XG2-013: NC【白虎真剣】— CN3（3番目）で「SP1」を得る（出典: atwiki/page-1790・R-CN-01）", () => {
    let s = entered();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-013") s = skip(s);
    expect(spOf(settle(s), "player1", "XG2-013:k")).toBe(1);
  });

  it("XG2-013: NC【白虎真剣】— 敵軍バトルエリアの、カテゴリを2つ以上持つ S ユニットから1体選べる（M ユニット・単色・ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-1790「敵軍バトルエリアから、カテゴリを2つ以上持つSユニットを1体選び」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-013");
    expect(choiceIds(s)).toEqual(["SPEC-MULTI-S:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-013: NC【白虎真剣】— 選んだユニットを撃破する（出典: atwiki/page-1790「撃破してもよい」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-MULTI-S:b"));
    expect(zoneOf(s, "player2", "SPEC-MULTI-S:b")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-014 鉄面臂張遼", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたとき、バトルに勝っても撃破される。 【気力妖力合体】「SP1」 MAとDAの両方を持つ自軍コマンドを1つ選びホールドするか、MAのみを持つ自軍コマンドとDAのみを持つ自軍コマンドを1つずつ選びホールドしてもよい。そうしたとき、敵軍Sユニットを1体選び撃破する。";

  it("XG2-014: カタログ本文（修正後テキスト）・スペックが出典と一致（出典: atwiki/page-1754・pages/1754.txt「修正後は以下」・docs/rules/08-errata.md R-ERR-XG2-014）", () => {
    expectCatalogText("XG2-014", TEXT);
    expectUnit("XG2-014", { name: "鉄面臂張遼", category: ["MA", "DA"], size: "S", bp: 5000, sp: "special", powerCost: 3, comboNumber: 3, features: ["ダイ族", "男"] });
    expectRarityIn("XG2-014", ["NR"]);
  });

  it("XG2-014: ※ 敵軍ターン中、SP1 のユニット（BP1000）にアタックされてバトルに勝っても撃破される（出典: atwiki/page-1754「バトルに勝っても撃破される」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-014", "t")] }, "XG2-014:t", {}, "TST-UNIT-0:atk"));
    expect(zoneOf(s, "player1", "XG2-014:t")).toBe("discard");
  });

  it("XG2-014: ※ SP を持たないユニットとのバトルに勝ったときは撃破されない（出典: atwiki/page-1754「「SP1」以上のユニットとバトルしたとき」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-014", "t")] }, "XG2-014:t", {}, "SPEC-NOSP:atk", EXTRA));
    expect(zoneOf(s, "player1", "XG2-014:t")).toBe("battle");
  });

  it("XG2-014: ※ 自軍ターン中に SP1 のユニットにアタックして勝ったときは撃破されない（出典: atwiki/page-1754「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(p1Battle({ battle: [inst("XG2-014", "t")] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA), "XG2-014:t", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player1", "XG2-014:t")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  const entered = (command: ReturnType<typeof inst>[]) =>
    ncEnter("XG2-014:t", 2, { command }, { battle: [inst("TST-UNIT-0", "x"), inst("SPEC-DA-M", "m")], rush: [inst("TST-UNIT-0", "y")] }, EXTRA);

  it("XG2-014: NC【気力妖力合体】— MA と DA の両方を持つ自軍コマンド1つをホールドすれば、敵軍 S ユニット（エリアを問わない。M ユニットは選べない）を1体選んで撃破する（出典: atwiki/page-1754 修正後テキスト・Q1「MAとDAの両方を持つ自軍コマンドを1つ選んでホールドする」・カード評価「エリアを問わない」）", () => {
    let s = entered([released("SPEC-MADA-CMD", "c"), released("TST-OP-MA", "ma")]);
    expectChoiceFrom(s, "player1", "XG2-014");
    s = pick(s, "SPEC-MADA-CMD:c");
    if (s.pendingEffectChoice?.kind === "select_commands") s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(cardIn(s, "player1", "SPEC-MADA-CMD:c")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "TST-OP-MA:ma")?.commandHeld).toBe(false);
    expectChoiceFrom(s, "player1", "XG2-014");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:x", "TST-UNIT-0:y"]);
    s = resolveAll(pick(s, "TST-UNIT-0:y"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:y")).toBe("discard");
  });

  it("XG2-014: NC【気力妖力合体】— MA のみのコマンド2つでは条件を満たさない（MA のみと DA のみを1つずつ）（出典: atwiki/page-1754 Q1・コメント「単色コマンドの場合、それぞれ１枚をホールド」）", () => {
    let s = entered([...releasedCat("MA", 2)]);
    if (s.pendingEffectChoice?.sourceCardId === "XG2-014" && s.pendingEffectChoice.validInstanceIds.length > 0) {
      s = pick(s, "TST-OP-MA:cMA0");
      if (s.pendingEffectChoice?.validInstanceIds.includes("TST-OP-MA:cMA1")) s = pick(s, "TST-OP-MA:cMA1");
    }
    s = resolveAll(s);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:y")).toBe("rush");
  });

  it("XG2-014: NC【気力妖力合体】— ホールドしなくてもよい（何も撃破しない）（出典: atwiki/page-1754「ホールドしてもよい。そうしたとき」）", () => {
    const s0 = entered([released("SPEC-MADA-CMD", "c")]);
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(cardIn(s, "player1", "SPEC-MADA-CMD:c")?.commandHeld).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("battle");
  });
});
