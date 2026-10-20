/**
 * カード別スペック: XG6-001〜XG6-008（クロスギャザー ザ・ギガンティックタイタン 火の山、吠える〜炎神剣）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない（同名の RS-574 セイントカイザー等の項だけ）。atwiki に転載された公式 Q&A: XG6-001 Q1・XG6-002 Q1・XG6-005 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06・R-KW-WING・R-KW-BLAST・R-KW-BREAKER・R-POW-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 * 判断の記録: docs/verification/unverified/XG6-judgments.md、不具合の一覧: docs/verification/unverified/XG6-gaps.md。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  accept,
  beltUsed,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  deckOrder,
  destroyedInEnemyBattle,
  enemyAttacks,
  enemyTurn,
  entered,
  expectCatalogText,
  expectChoiceFrom,
  expectKindCategory,
  expectOpStats,
  expectRarityIn,
  expectRushCondition,
  expectStats,
  faceUpResident,
  inst,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushHand,
  settle,
  skip,
  sUnit,
  attack,
  toTurnEnd,
  wingTests,
  withDamage,
  zoneOf,
  type Cat,
} from "./XG6-001-022.helpers";

const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const WB_M5 = sUnit("SPEC-WB-M5", { category: "WB", bp: 5000, size: "M", powerCost: 5 });
const WB_M7 = sUnit("SPEC-WB-M7", { category: "WB", bp: 5000, size: "M", powerCost: 7 });
const ET_M3 = sUnit("SPEC-ET-M3", { category: "ET", bp: 3000, size: "M", powerCost: 3 });
const HUM = sUnit("SPEC-HUM", { category: "WB", bp: 1000, features: ["人型"] });
const NOHUM = sUnit("SPEC-NOHUM", { category: "WB", bp: 1000, features: ["男"] });
const MAG = sUnit("SPEC-MAG", { category: "MA", bp: 1000, features: ["魔法"] });
const NOMAG = sUnit("SPEC-NOMAG", { category: "MA", bp: 1000 });
const E3 = sUnit("SPEC-E3", { bp: 1000, powerCost: 3 });
const E5 = sUnit("SPEC-E5", { bp: 1000, powerCost: 5 });
const E7 = sUnit("SPEC-E7", { bp: 1000, powerCost: 7 });
const E14K = sUnit("SPEC-E14K", { bp: 14000, size: "L" });
const E15K = sUnit("SPEC-E15K", { bp: 15000, size: "L" });
const OT_L = sUnit("SPEC-OT-L", { category: "OT", bp: 10000, size: "L" });
const EXTRA = [WB_S, WB_M5, WB_M7, ET_M3, HUM, NOHUM, MAG, NOMAG, E3, E5, E7, E14K, E15K, OT_L];

const used = (id: string, cat: Cat, cost: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  beltUsed(id, cat, cost, p1, p2, EXTRA);

// ===========================================================================
describe("XG6-001 火の山、吠える", () => {
  const TEXT =
    "※常駐 敵軍ターン中、自軍ユニットが撃破されて捨札になるたび、次の効果を発動できる⇒ 自軍ダメージの数まで、自軍山札の上をオモテにして、その中から撃破されたユニットと同じカテゴリを持つ、Sユニット以外のカードを１枚まで選び自軍ラッシュエリアに出す。ただし、自軍ダメージの数だけ必要パワーを少なくした上で、必要パワーと追加条件は満たすこと。その後、残りのカードを山札の下に好きな順番で戻す。";
  const PAGE = "atwiki/page-2332";

  it(`XG6-001: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-001", TEXT);
    expectOpStats("XG6-001", { name: "火の山、吠える", category: "WB", powerCost: 5 });
    expectRarityIn("XG6-001", ["R"]);
  });

  it(`XG6-001: ※常駐 — 使うと自軍常駐置き場に置かれる（出典: ${PAGE}「※常駐」）`, () => {
    const s = resolveAll(used("XG6-001", "WB", 5));
    expect(zoneOf(s, "player1", "XG6-001:op")).toBe("operation");
  });

  /**
   * 敵軍ターン、常駐の火の山、吠える・自軍ダメージ dmg 点（オモテ向きのパワー faceUp 枚）で、自軍の WB の S ユニット（SPEC-WB-S）が
   * BP13000 の敵軍ユニットにアタックされて撃破され、離場の反応ウィンドウが開いたところ。山札は deck。
   */
  const fireMountain = (deck: CardInstance[], dmg = 2, faceUp = 1) =>
    destroyedInEnemyBattle(
      inst("SPEC-WB-S", "v"),
      { operation: [faceUpResident("XG6-001", "op")], ...withDamage(dmg, powerCards(faceUp)), deck: [...deck, ...deckCards(3)] },
      {},
      EXTRA,
    );

  it(
    `XG6-001: 敵軍ターン中に自軍ユニットが撃破されて捨札になると、発動するかを選べる（任意）。山札の上から自軍ダメージの数（2枚）をオモテにし、撃破されたユニットと同じカテゴリ（WB）の S ユニット以外のカードで、必要パワーを自軍ダメージの数だけ少なくして満たせるものから選べる（オペレーション・3枚目のカードは選べない）（出典: ${PAGE}「次の効果を発動できる」「自軍ダメージの数まで、自軍山札の上をオモテにして」・Q1「オペレーションカードは選べますか？」「いいえ」）`,
    () => {
      const s = fireMountain([inst("SPEC-WB-M5", "m"), inst("TST-OP", "op2"), inst("SPEC-WB-M5", "third")]);
      expectChoiceFrom(s, "player1", "XG6-001");
      expect(canSkip(s)).toBe(true);
      const t = s.pendingEffectChoice?.validInstanceIds.includes("SPEC-WB-M5:m") ? s : accept(s);
      expect(choiceIds(t)).toEqual(["SPEC-WB-M5:m"]);
    },
  );

  it(
    `XG6-001: 選んだカードは自軍ラッシュエリアに出て、残りのオモテにしたカードは山札の下に戻る（出典: ${PAGE}「自軍ラッシュエリアに出す」「残りのカードを山札の下に好きな順番で戻す」）`,
    () => {
      let s = fireMountain([inst("SPEC-WB-M5", "m"), inst("TST-OP", "op2")]);
      if (!s.pendingEffectChoice?.validInstanceIds.includes("SPEC-WB-M5:m")) s = accept(s);
      s = resolveAll(pick(s, "SPEC-WB-M5:m"));
      expect(zoneOf(s, "player1", "SPEC-WB-M5:m")).toBe("rush");
      expect(deckOrder(s).at(-1)).toBe("TST-OP:op2");
    },
  );

  it(
    `XG6-001: カテゴリが違うカード・S ユニット・軽くしても必要パワーを満たせないカード・追加条件を満たせないカードは選べない。選べるカードがなければ、オモテにしたカードはすべて山札の下に戻る（出典: ${PAGE}「同じカテゴリを持つ、Sユニット以外のカード」「必要パワーと追加条件は満たすこと」）`,
    () => {
      // ダメージ3点・オモテ向きのパワー0枚（パワー3）: ET の M（3）・WB の S・WB の M（7-3=4 > 3）・RS-050 アバレンオー（7+−3=4 > 3。合体ユニットもない）。
      let s = fireMountain([inst("SPEC-ET-M3", "et"), inst("SPEC-WB-S", "s"), inst("SPEC-WB-M7", "m7")], 3, 0);
      expectChoiceFrom(s, "player1", "XG6-001");
      s = resolveAll(accept(s));
      expect(s.players.player1.rush).toHaveLength(0);
      expect(deckOrder(s).slice(-3).sort()).toEqual(["SPEC-ET-M3:et", "SPEC-WB-M7:m7", "SPEC-WB-S:s"]);
    },
  );

  it(`XG6-001: 自軍ターン中に自軍ユニットが撃破されても発動しない（出典: ${PAGE}「敵軍ターン中、」）`, () => {
    let s = p1Battle(
      { battle: [inst("SPEC-WB-S", "v")], operation: [faceUpResident("XG6-001", "op")], ...withDamage(2, powerCards(1)), deck: [inst("SPEC-WB-M5", "m"), ...deckCards(3)] },
      { battle: [inst("TST-UNIT-7", "big")] },
      EXTRA,
    );
    s = settle(attack(s, "SPEC-WB-S:v", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-WB-S:v")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-001");
    expect(zoneOf(s, "player1", "SPEC-WB-M5:m")).toBe("deck");
  });
});

// ===========================================================================
describe("XG6-002 銀河超越・三神合体", () => {
  const TEXT =
    "自分の手札から合体を必要とするユニットカードを1枚選び相手に見せる。その後、自分の手札から特徴「人型」を持つユニットカードを3枚選び捨札にする。ただし、見せたカードの合体に必要なユニットのカードを1枚以上含むように捨札にすること。そうしたとき、見せたカードを自軍ラッシュエリアに出す。";
  const PAGE = "atwiki/page-2283";
  // XG6-020 アルティメットダイボウケン（合体―ダイボウケン＋ダイタンケン）。XG6-006 ダイタンケン（メカ／人型）は合体に必要なユニット。
  const hand = (): CardInstance[] => [inst("XG6-020", "u"), inst("XG6-006", "dt"), inst("SPEC-HUM", "h1"), inst("SPEC-HUM", "h2"), inst("SPEC-NOHUM", "n")];
  const usedWith = (h: CardInstance[] = hand()) => used("XG6-002", "MA", 8, { hand: h });

  it(`XG6-002: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-002", TEXT);
    expectOpStats("XG6-002", { name: "銀河超越・三神合体", category: "MA", powerCost: 8 });
    expectRarityIn("XG6-002", ["N"]);
  });

  it(
    `XG6-002: まず手札の、合体を必要とするユニットカードから1枚選んで見せる（合体を必要としないユニットカードは選べない）（出典: ${PAGE}「自分の手札から合体を必要とするユニットカードを1枚選び相手に見せる」）`,
    () => {
      const s = usedWith();
      expectChoiceFrom(s, "player1", "XG6-002");
      expect(choiceIds(s)).toEqual(["XG6-020:u"]);
    },
  );

  it(
    `XG6-002: 次に手札の特徴「人型」を持つユニットカードから3枚選ぶ。見せたカードは選べない（出典: ${PAGE}「特徴「人型」を持つユニットカードを3枚選び捨札にする」・Q1「見せたカードは、処理中のカードとして手札とは別に扱われる」）`,
    () => {
      const s = pick(usedWith(), "XG6-020:u");
      expectChoiceFrom(s, "player1", "XG6-002");
      expect(choiceIds(s)).toEqual(["SPEC-HUM:h1", "SPEC-HUM:h2", "XG6-006:dt"]);
    },
  );

  it(
    `XG6-002: 合体に必要なユニットのカード（ダイタンケン）を含む3枚を捨札にすれば、見せたカードを自軍ラッシュエリアに出す（必要パワー・追加条件は問わない）（出典: ${PAGE}「そうしたとき、見せたカードを自軍ラッシュエリアに出す」・カード評価「コストさえ用意できれば必要パワーもカテゴリの制限も無視できる」）`,
    () => {
      let s = pick(usedWith(), "XG6-020:u");
      for (const id of ["XG6-006:dt", "SPEC-HUM:h1", "SPEC-HUM:h2"]) if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
      s = resolveAll(s);
      expect(zoneOf(s, "player1", "XG6-020:u")).toBe("rush");
      for (const id of ["XG6-006:dt", "SPEC-HUM:h1", "SPEC-HUM:h2"]) expect(zoneOf(s, "player1", id)).toBe("discard");
      expect(zoneOf(s, "player1", "SPEC-NOHUM:n")).toBe("hand");
    },
  );

  it(`XG6-002: 合体に必要なユニットのカードを含めて3枚捨札にできなければ、見せたカードは出ない（手札のまま）（出典: ${PAGE}「ただし、見せたカードの合体に必要なユニットのカードを1枚以上含むように捨札にすること。そうしたとき」）`, () => {
    const s = resolveAll(usedWith([inst("XG6-020", "u"), inst("SPEC-HUM", "h1"), inst("SPEC-HUM", "h2"), inst("SPEC-HUM", "h3")]));
    expect(zoneOf(s, "player1", "XG6-020:u")).toBe("hand");
    expect(s.players.player1.rush).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG6-003 キラーアバレンオー", () => {
  const TEXT =
    "合体―アバレンオー（または爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン）+キラーオー（または爆竜トップゲイラー+爆竜ステゴスライドン） ※ブレイカー ※ウイング 【爆竜マルチコンバイン】自軍ターン中、これがバトルエリアに出たとき、自分の手札から ナンバーに「L」または「R」を持つカードを1枚選び、相手に見せてもよい。そうしたとき、これが見せたカードのJCの対象として適切なら、これとコンビネーションしたかのように、そのJCの効果を発動する。";
  const PAGE = "atwiki/page-2335";

  it(`XG6-003: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-003", TEXT);
    expectStats("XG6-003", { name: "キラーアバレンオー", category: "WB", size: "L", bp: 16000, sp: 2, powerCost: "7+", features: ["恐竜", "人型"] , rushCondition: "discard_fusion_unit" });
    expectRushCondition("XG6-003", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-003", ["SR"]);
  });

  const rushWith = (rush: CardInstance[]) => rushHand("XG6-003:k", { rush, command: releasedCat("WB", 1), power: powerCards(7) });

  it(`XG6-003: 追加条件 — 自軍のアバレンオーとキラーオーを捨札にしてラッシュできる。どちらかが欠ければラッシュできない（出典: ${PAGE}「合体―アバレンオー…+キラーオー…」・R-ADD-06）`, () => {
    const r = rushWith([inst("RS-050", "a"), inst("RS-226", "k")]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-003:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-050:a")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-226:k")).toBe("discard");
    expect(rushWith([inst("RS-050", "a")]).ok).toBe(false);
  });

  it(
    `XG6-003: 追加条件 — アバレンオーのかわりに爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン、キラーオーのかわりに爆竜トップゲイラー＋爆竜ステゴスライドンを捨札にしてもよい（出典: ${PAGE}「アバレンオー（または爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン）+キラーオー（または爆竜トップゲイラー+爆竜ステゴスライドン）」）`,
    () => {
      expect(rushWith([inst("RS-051", "t"), inst("RS-052", "c"), inst("RS-053", "p"), inst("RS-226", "k")]).ok).toBe(true);
      expect(rushWith([inst("RS-050", "a"), inst("RS-227", "tg"), inst("RS-228", "sg")]).ok).toBe(true);
    },
  );

  it(
    `XG6-003: 追加条件 — 自軍 L ユニットがなければ、XG6-018 アバレキラーを「爆竜トップゲイラー＋爆竜ステゴスライドン」として捨札にできる（出典: ${PAGE}・atwiki/page-2334 XG6-018「※自軍Lユニットがなければ…としてつかえる」）`,
    () => {
      const r = rushWith([inst("RS-051", "t"), inst("RS-052", "c"), inst("RS-053", "p"), inst("XG6-018", "ak")]);
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "XG6-018:ak")).toBe("discard");
    },
  );

  it(`XG6-003: 追加条件 — 自軍に L ユニット（アバレンオー）があるときは、アバレキラーを「爆竜トップゲイラー＋爆竜ステゴスライドン」として使えない（出典: atwiki/page-2334「※自軍Lユニットがなければ」・同 Q3（L ユニットがあれば合体ユニットとして扱えない））`, () => {
    expect(rushWith([inst("RS-050", "a"), inst("XG6-018", "ak")]).ok).toBe(false);
  });

  wingTests("XG6-003", PAGE);

  /** 自軍バトルフェイズに、手札 hand を持ってキラーアバレンオーをバトルエリアに出す。敵軍の手札・オモテ向きのパワーは 1枚ずつ。 */
  const multiCombine = (hand: CardInstance[]) =>
    entered("XG6-003:k", { hand }, { hand: [inst("TST-OP", "eh")], power: [inst("TST-P", "ep")] }, EXTRA);

  it(
    `XG6-003: 【爆竜マルチコンバイン】自軍ターン中にバトルエリアに出たとき、手札のナンバーに「L」か「R」を持つカードから1枚選んで見せるかを選べる（任意。ナンバーのないカードは選べない）（出典: ${PAGE}「自分の手札から ナンバーに「L」または「R」を持つカードを1枚選び、相手に見せてもよい」）`,
    () => {
      const s = multiCombine([inst("XG6-015", "pr"), inst("XG6-016", "an"), inst("TST-OP", "x")]);
      expectChoiceFrom(s, "player1", "XG6-003");
      expect(choiceIds(s)).toEqual(["XG6-015:pr", "XG6-016:an"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-003: 【爆竜マルチコンバイン】見せたカード（XG6-015 爆竜パラサロッキル。WB の R）の JC の対象として適切なら、コンビネーションしたかのように JC の効果を発動する（相手が手札かオモテ向きのゾーンのカードを1枚捨札にする）。見せたカードは手札に残る（出典: ${PAGE}「これとコンビネーションしたかのように、そのJCの効果を発動する」・atwiki/page-2298 XG6-015）`,
    () => {
      let s = pick(multiCombine([inst("XG6-015", "pr")]), "XG6-015:pr");
      expectChoiceFrom(s, "player2", "XG6-015");
      s = resolveAll(s);
      expect(s.players.player2.discard).toHaveLength(1);
      expect(zoneOf(s, "player1", "XG6-015:pr")).toBe("hand");
    },
  );
});

// ===========================================================================
describe("XG6-004 フルブラスト・アクション", () => {
  const TEXT =
    "自軍パワーゾーンのオモテ向きのカードを好きな枚数選びウラ向きにしてもよい。 ただし、自分がゲームに負ける点数以上ウラ向きにすることはできない。その後、自分の手札にあるBP16000以下のLユニットのカードは、このターン、ブラストを得る。";
  const PAGE = "atwiki/page-2331";

  it(`XG6-004: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-004", TEXT);
    expectOpStats("XG6-004", { name: "フルブラスト・アクション", category: "OT", powerCost: 8 });
    expectRarityIn("XG6-004", ["R"]);
  });

  it(
    `XG6-004: 自軍パワーゾーンのオモテ向きのカードから好きな枚数を選んでウラ向き（ダメージ）にできる（任意）（出典: ${PAGE}「オモテ向きのカードを好きな枚数選びウラ向きにしてもよい」）`,
    () => {
      let s = used("XG6-004", "OT", 8, { power: powerCards(8) });
      expectChoiceFrom(s, "player1", "XG6-004");
      expect(canSkip(s)).toBe(true);
      expect(choiceIds(s)).toEqual(powerCards(8).map((c) => c.instanceId).sort());
      s = resolveAll(pick(pick(s, "TST-P:pw0"), "TST-P:pw1"), ["TST-P:pw0", "TST-P:pw1"]);
      expect(cardIn(s, "player1", "TST-P:pw0")?.faceDown).toBe(true);
      expect(cardIn(s, "player1", "TST-P:pw1")?.faceDown).toBe(true);
      expect(s.players.player1.damage).toBe(2);
    },
  );

  it(
    `XG6-004: 自分がゲームに負ける点数（7点）以上にはウラ向きにできない（ダメージ4点なら2枚まで。ゲームに負けない）（出典: ${PAGE}「ただし、自分がゲームに負ける点数以上ウラ向きにすることはできない」）`,
    () => {
      let s = used("XG6-004", "OT", 8, withDamage(4, powerCards(4)));
      expectChoiceFrom(s, "player1", "XG6-004");
      for (let i = 0; i < 6 && s.pendingEffectChoice?.sourceCardId === "XG6-004" && choiceIds(s).length > 0; i++) s = pick(s, choiceIds(s)[0]!);
      s = resolveAll(s);
      expect(s.players.player1.damage).toBe(6);
      expect(s.winner ?? null).toBeNull();
    },
  );

  it(
    `XG6-004: その後、このターン、手札の BP16000 以下の L ユニットのカードはブラストを得る（残りダメージ1点・自軍 L ユニットなしなら追加条件なしでラッシュできる）（出典: ${PAGE}「自分の手札にあるBP16000以下のLユニットのカードは、このターン、ブラストを得る」・R-KW-BLAST-01）`,
    () => {
      let s = used("XG6-004", "OT", 8, { hand: [inst("XG6-003", "k")], command: releasedCat("WB", 1), ...withDamage(6, powerCards(2)) });
      if (s.pendingEffectChoice?.sourceCardId === "XG6-004") s = skip(s);
      s = resolveAll(s);
      const r = rushFromHand(s, "player1", "XG6-003:k");
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "XG6-003:k")).toBe("rush");
    },
  );

  it(`XG6-004: 使わなければ、手札の L ユニットはブラストを持たない（残りダメージ1点でも追加条件が要る）（出典: ${PAGE}・R-KW-BLAST-01）`, () => {
    const r = rushHand("XG6-003:k", { command: releasedCat("WB", 1), ...withDamage(6, powerCards(2)) });
    expect(r.ok).toBe(false);
  });
});

// ===========================================================================
describe("XG6-005 セイントカイザー", () => {
  const TEXT =
    "合体―マジフェニックス＋一角聖馬ユニゴルオン ※これをラッシュしたとき、自分は1枚ドローする。 【マジカルショータイム】これが自分の手札にある間、敵軍ターン中、特徴「魔法」を持つ自軍ユニットがアタックされたとき、アタックされたユニットとこれを置き換えてもよい。そうしたとき、アタックされたユニットのかわりにこのユニットがバトルする。そのターン終了時に、このユニットを捨札にするか山札の下に戻す。";
  const PAGE = "atwiki/page-2330";

  it(`XG6-005: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-005", TEXT);
    expectStats("XG6-005", { name: "セイントカイザー", category: "MA", size: "L", bp: 6000, sp: 1, powerCost: "4+", features: ["魔法", "人型"], rushCondition: "discard_fusion_unit" });
    expectRushCondition("XG6-005", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-005", ["SR"]);
  });

  it(`XG6-005: 追加条件 — 自軍のマジフェニックスと一角聖馬ユニゴルオン（合体ユニットとして使えるビークル）を捨札にしてラッシュし、ラッシュしたとき1枚ドローする（出典: ${PAGE}「合体―マジフェニックス＋一角聖馬ユニゴルオン」「※これをラッシュしたとき、自分は1枚ドローする」・atwiki RS-575「※このビークルは合体ユニットとしてつかえる」）`, () => {
    const r = rushHand("XG6-005:k", { rush: [inst("RS-576", "mp"), inst("RS-575", "un")], command: releasedCat("MA", 1), power: powerCards(4), deck: [inst("TST-OP", "top"), ...deckCards(3)] });
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG6-005:k")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-576:mp")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-575:un")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
  });

  /** 敵軍ターン、手札にセイントカイザー、自軍バトルエリアに defender。敵軍の TST-UNIT-0（BP1000）が defender にアタックしたところ。 */
  const showTime = (defender: CardInstance) =>
    enemyAttacks(enemyTurn({ hand: [inst("XG6-005", "sk")], battle: [defender], deck: [inst("TST-OP", "top"), ...deckCards(3)] }, { battle: [inst("TST-UNIT-0", "atk")] }, EXTRA), "TST-UNIT-0:atk", defender.instanceId);

  it(
    `XG6-005: 【マジカルショータイム】敵軍ターン中、特徴「魔法」を持つ自軍ユニットがアタックされたとき、手札のこれと置き換えるかを選べる（任意）（出典: ${PAGE}「アタックされたユニットとこれを置き換えてもよい」）`,
    () => {
      const s = showTime(inst("SPEC-MAG", "m"));
      expectChoiceFrom(s, "player1", "XG6-005");
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-005: 置き換えると、アタックされたユニットは手札に戻り、かわりにこれがバトルする（BP6000 で BP1000 のアタックしたユニットを撃破する）。置き換えもラッシュとして扱い、1枚ドローする（出典: ${PAGE}「アタックされたユニットのかわりにこのユニットがバトルする」・Q1「ラッシュしたときの効果で1枚ドローしてから」・カード評価「置き換えもラッシュ扱いのためドロー効果が発動する」「特徴「魔法」持ちの自軍ユニットを手札に戻しながら」）`,
    () => {
      const s = resolveAll(accept(showTime(inst("SPEC-MAG", "m"))));
      expect(zoneOf(s, "player1", "SPEC-MAG:m")).toBe("hand");
      expect(zoneOf(s, "player1", "XG6-005:sk")).toBe("battle");
      expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
      expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
    },
  );

  it(
    `XG6-005: 置き換えて出たこれは、そのターン終了時に捨札にするか山札の下に戻すかを選ぶ（出典: ${PAGE}「そのターン終了時に、このユニットを捨札にするか山札の下に戻す」）`,
    () => {
      let s = resolveAll(accept(showTime(inst("SPEC-MAG", "m"))));
      s = toTurnEnd(s, "XG6-005");
      expectChoiceFrom(s, "player1", "XG6-005");
      expect(canSkip(s)).toBe(false);
    },
  );

  it(`XG6-005: 特徴「魔法」を持たない自軍ユニットがアタックされても置き換えられない（出典: ${PAGE}「特徴「魔法」を持つ自軍ユニットがアタックされたとき」）`, () => {
    const s = showTime(inst("SPEC-NOMAG", "m"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-005");
    expect(zoneOf(s, "player1", "XG6-005:sk")).toBe("hand");
  });
});

// ===========================================================================
describe("XG6-006 ダイタンケン", () => {
  const TEXT =
    "※ウイング 【ボウケンフラッシュ】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンからナンバーに「L」または「R」を持つユニットカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。";
  const PAGE = "atwiki/page-2329";

  it(`XG6-006: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-006", TEXT);
    expectStats("XG6-006", { name: "ダイタンケン", category: "ET", size: "L", bp: 8000, sp: undefined, powerCost: "5+", features: ["メカ", "人型"], rushCondition: "discard_feature_unit" });
    expectRushCondition("XG6-006", "discard_feature_unit", "特徴「レッド」を持つ自軍ユニット1体を捨札にする");
    expectRarityIn("XG6-006", ["R"]);
  });

  it(`XG6-006: 追加条件 — 特徴「レッド」を持つ自軍ユニット1体を捨札にしてラッシュできる。「レッド」のユニットがなければラッシュできない（出典: ${PAGE}「追加条件：特徴「レッド」を持つ自軍ユニット1体を捨札にする」）`, () => {
    const r = rushHand("XG6-006:k", { rush: [inst("RS-340", "red")], command: releasedCat("ET", 1), power: powerCards(5) });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-340:red")).toBe("discard");
    expect(rushHand("XG6-006:k", { rush: [inst("TST-UNIT-0", "x")], command: releasedCat("ET", 1), power: powerCards(5) }).ok).toBe(false);
  });

  wingTests("XG6-006", PAGE);

  const flash = (command: CardInstance[]) =>
    entered("XG6-006:dt", { command }, { battle: [inst("SPEC-E3", "e3"), inst("SPEC-E5", "e5"), inst("SPEC-E7", "e7")] }, EXTRA);

  it(
    `XG6-006: 【ボウケンフラッシュ】バトルエリアに出たとき、まず自軍コマンドゾーンの、ナンバーに「L」か「R」を持つユニットカードから1枚選んで捨札にするかを選ぶ（任意。オペレーション・ナンバーのないユニットカードは選べない）（出典: ${PAGE}「自軍コマンドゾーンからナンバーに「L」または「R」を持つユニットカードを1枚選び捨札にしてもよい」）`,
    () => {
      const s = flash([inst("XG6-016", "an"), released("TST-OP", "c"), inst("TST-UNIT-0", "u")]);
      expectChoiceFrom(s, "player1", "XG6-006");
      expect(choiceIds(s)).toEqual(["XG6-016:an"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-006: 捨札にしたら、その必要パワーの数字（XG6-016 は6）以下の必要パワーの数字を持つ敵軍ユニットを1体選んで撃破する（必要パワー7のユニットは選べない）（出典: ${PAGE}「捨札にしたカードの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する」）`,
    () => {
      let s = flash([inst("XG6-016", "an")]);
      if (choiceIds(s).includes("XG6-016:an")) s = pick(s, "XG6-016:an");
      expect(zoneOf(s, "player1", "XG6-016:an")).toBe("discard");
      expect(choiceIds(s)).toEqual(["SPEC-E3:e3", "SPEC-E5:e5"]);
      s = resolveAll(pick(s, "SPEC-E5:e5"));
      expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
    },
  );

  it(
    `XG6-006: 自軍コマンドゾーンにナンバー「L」「R」のユニットカードがなければ、敵軍ユニットは撃破できない（出典: ${PAGE}「捨札にしてもよい。そうしたとき」）`,
    () => {
      const s = resolveAll(flash([released("TST-OP", "c")]));
      expect(s.players.player2.battle).toHaveLength(3);
    },
  );
});

// ===========================================================================
describe("XG6-007 ゲキリントージャ", () => {
  const TEXT =
    "合体―ゲキレッドまたはゲキタイガー＋ゲキブルーまたはゲキジャガー＋ゲキイエローまたはゲキチーター＋黒獅子リオまたはリンライオン＋獣人メレまたはリンカメレオン ※このカードの合体ユニットは、自軍捨札が7枚以上のとき、次のように変更される⇒合体―ゲキレッド＋黒獅子リオ 【激激臨臨斬】自軍ターン中、これがバトルエリアに出たとき、WBのみを持つ自軍捨札とDAのみを持つ自軍捨札を1枚ずつ選びゲームから除外するか、WBとDAの両方を持つ自軍捨札を1枚選んでもよい。そうしたとき、このユニットのBP以下のBPを持つ敵軍ユニットを1体選びゲームから除外する。";
  const PAGE = "atwiki/page-2352";

  it(`XG6-007: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-007", TEXT);
    expectKindCategory("XG6-007", "unit", ["WB", "DA"]);
    const d = DEFS["XG6-007"]!;
    expect([d.name, d.size, d.bp, d.sp, d.powerCost]).toEqual(["ゲキリントージャ", "L", 14000, 1, "5+"]);
    expect(d.features).toEqual(["激気", "臨気", "人型"]);
    expectRushCondition("XG6-007", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-007", ["SR"]);
  });

  const cmd = () => [...releasedCat("WB", 1), ...releasedCat("DA", 1)];
  const rushWith = (rush: CardInstance[], discard: CardInstance[] = []) => rushHand("XG6-007:k", { rush, discard, command: cmd(), power: powerCards(5) });

  it(`XG6-007: 追加条件 — 5体の合体ユニット（ゲキレッド・ゲキブルー・ゲキイエロー・黒獅子リオ・獣人メレ）を捨札にしてラッシュできる（出典: ${PAGE}「合体―ゲキレッドまたはゲキタイガー＋…＋獣人メレまたはリンカメレオン」・R-ADD-06）`, () => {
    const parts = [inst("RS-343", "a"), inst("RS-341", "b"), inst("RS-342", "c"), inst("RS-431", "d"), inst("RS-504", "e")];
    const r = rushWith(parts);
    expect(r.ok).toBe(true);
    for (const p of parts) expect(zoneOf(r.state, "player1", p.instanceId)).toBe("discard");
  });

  it(
    `XG6-007: ※ 自軍捨札が7枚以上なら、合体ユニットは「ゲキレッド＋黒獅子リオ」になる（2体を捨札にしてラッシュできる）（出典: ${PAGE}「自軍捨札が7枚以上のとき、次のように変更される⇒合体―ゲキレッド＋黒獅子リオ」）`,
    () => {
      const r = rushWith([inst("RS-343", "a"), inst("RS-431", "d")], deckCards(7, "dd"));
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "XG6-007:k")).toBe("rush");
    },
  );

  it(`XG6-007: ※ 自軍捨札が6枚なら、ゲキレッド＋黒獅子リオだけではラッシュできない（出典: ${PAGE}「自軍捨札が7枚以上のとき」）`, () => {
    expect(rushWith([inst("RS-343", "a"), inst("RS-431", "d")], deckCards(6, "dd")).ok).toBe(false);
  });

  /** 自軍捨札 discard を持ってゲキリントージャをバトルエリアに出す。敵軍バトルエリアに BP14000・15000 のユニット。 */
  const zan = (discard: CardInstance[]) =>
    entered("XG6-007:gk", { discard }, { battle: [inst("SPEC-E14K", "a"), inst("SPEC-E15K", "b")] }, EXTRA);
  // RS-343 ゲキレッド（WB のみ）・RS-431 黒獅子リオ（DA のみ）・XG6-048 仮面ライダーリュウガ（WB／DA）。
  const discard = () => [inst("RS-343", "wb"), inst("RS-431", "da"), inst("XG6-048", "both")];

  it(
    `XG6-007: 【激激臨臨斬】バトルエリアに出たとき、自軍捨札の WB のみのカードと DA のみのカードを1枚ずつゲームから除外できる（任意）。そうしたとき、これの BP（14000）以下の BP を持つ敵軍ユニットを1体選んでゲームから除外する（出典: ${PAGE}「WBのみを持つ自軍捨札とDAのみを持つ自軍捨札を1枚ずつ選びゲームから除外するか…そうしたとき、このユニットのBP以下のBPを持つ敵軍ユニットを1体選びゲームから除外する」）`,
    () => {
      let s = zan(discard());
      expectChoiceFrom(s, "player1", "XG6-007");
      expect(canSkip(s)).toBe(true);
      s = resolveAll(s, ["RS-343:wb", "RS-431:da", "SPEC-E14K:a"]);
      expect((s.players.player1.exile ?? []).map((c) => c.instanceId).sort()).toEqual(["RS-343:wb", "RS-431:da"]);
      expect((s.players.player2.exile ?? []).map((c) => c.instanceId)).toEqual(["SPEC-E14K:a"]);
      expect(zoneOf(s, "player2", "SPEC-E15K:b")).toBe("battle");
    },
  );

  it(
    `XG6-007: 【激激臨臨斬】かわりに WB と DA の両方を持つ自軍捨札1枚を選んでもよい（選んだカードもゲームから除外する）（出典: ${PAGE}「WBとDAの両方を持つ自軍捨札を1枚選んでもよい」）`,
    () => {
      let s = zan([inst("XG6-048", "both")]);
      expectChoiceFrom(s, "player1", "XG6-007");
      s = resolveAll(s, ["XG6-048:both", "SPEC-E14K:a"]);
      expect((s.players.player1.exile ?? []).map((c) => c.instanceId)).toEqual(["XG6-048:both"]);
      expect((s.players.player2.exile ?? []).map((c) => c.instanceId)).toEqual(["SPEC-E14K:a"]);
    },
  );
});

// ===========================================================================
describe("XG6-008 炎神剣", () => {
  const TEXT =
    "お互いに山札の上から１枚をオモテにし、必要パワーの数字を比べる勝負を２回繰り返す。数字の大きい方を勝ちとして、自分が２回連続で勝ったなら、敵軍ユニットを１体選び撃破する。２回連続で負けたなら、相手に自軍ユニットを１体選ばせて、選ばれたユニットを撃破する。その後、オモテにしたカードは、好きな順番で持ち主の山札の下に戻す。（これが自軍コマンドゾーンにある間、OTを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する）";
  const PAGE = "atwiki/page-2345";

  it(`XG6-008: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-008", TEXT);
    expectOpStats("XG6-008", { name: "炎神剣", category: "OT", powerCost: 3 });
    expectRarityIn("XG6-008", ["R"]);
  });

  it(`XG6-008: カタログの特徴が出典と一致（特徴「武器」）（出典: ${PAGE}「特徴：武器」）`, () => {
    expect(DEFS["XG6-008"]?.features ?? []).toEqual(["武器"]);
  });

  // 自軍の山札の上: XG6-020（10+）×2 → 2回とも勝つ。TST-UNIT-0（0）×2 → 2回とも負ける。敵軍の山札の上は TST-OP（3）。
  const sword = (deck: CardInstance[]) =>
    used("XG6-008", "OT", 3, { deck: [...deck, ...deckCards(3)], battle: [inst("SPEC-WB-S", "mine")] }, { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "ed") });

  it(
    `XG6-008: 2回連続で勝てば（必要パワーの数字が大きい）、敵軍ユニットを1体選んで撃破する。オモテにしたカードは持ち主の山札の下に戻る（出典: ${PAGE}「自分が２回連続で勝ったなら、敵軍ユニットを１体選び撃破する」「オモテにしたカードは、好きな順番で持ち主の山札の下に戻す」）`,
    () => {
      let s = sword([inst("XG6-020", "d1"), inst("XG6-020", "d2")]);
      expectChoiceFrom(s, "player1", "XG6-008");
      s = resolveAll(pick(s, "TST-UNIT-0:e"), ["TST-UNIT-0:e"]);
      expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
      expect(deckOrder(s).slice(-2).sort()).toEqual(["XG6-020:d1", "XG6-020:d2"]);
      expect(deckOrder(s, "player2").slice(-2).sort()).toEqual(["TST-OP:ed0", "TST-OP:ed1"]);
    },
  );

  it(
    `XG6-008: 2回連続で負ければ、相手が自軍ユニットを1体選び、そのユニットが撃破される（出典: ${PAGE}「２回連続で負けたなら、相手に自軍ユニットを１体選ばせて、選ばれたユニットを撃破する」）`,
    () => {
      let s = sword([inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")]);
      expectChoiceFrom(s, "player2", "XG6-008");
      s = resolveAll(s);
      expect(zoneOf(s, "player1", "SPEC-WB-S:mine")).toBe("discard");
      expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    },
  );

  it(`XG6-008: 1勝1敗なら何も撃破しない（出典: ${PAGE}「２回連続で」）`, () => {
    const s = resolveAll(sword([inst("XG6-020", "d1"), inst("TST-UNIT-0", "d2")]));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-WB-S:mine")).toBe("battle");
  });

  it(
    `XG6-008: （）内 — これが自軍コマンドゾーンにある間、OT を持つ自軍 L ユニットがバトルエリアに出たとき、これをホールドして効果を発動するかを選べる（任意）（出典: ${PAGE}「これが自軍コマンドゾーンにある間、OTを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する」）`,
    () => {
      const s = entered("SPEC-OT-L:l", { command: [released("XG6-008", "cmd")], deck: [inst("XG6-020", "d1"), inst("XG6-020", "d2"), ...deckCards(3)] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-008");
      expect(canSkip(s)).toBe(true);
    },
  );
});
