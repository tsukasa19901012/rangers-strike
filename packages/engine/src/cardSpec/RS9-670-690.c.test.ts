/**
 * カード別スペック: RS-685〜RS-690（第9弾「蒼九の翼」ブラックコンドル（2nd）〜スペードエース）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-card-9「ウイング」「ブラスト」
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。RS-686 は公式 Q&A の転記あり）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-TGT-01、R-KW-WING-*、R-KW-BLAST-01、R-KW-TAKUS-01、R-ZONE-08 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enterBattleByEffect,
  enterKeep,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  heldN,
  heldUnit,
  inst,
  ncEnter,
  p1Battle,
  pick,
  playOp,
  powerCards,
  rarityOf,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  wingTests,
  zoneOf,
} from "./RS9-670-690.helpers";

const E1500 = sUnit("SPEC-E1500", { bp: 1500, sp: undefined });
const E500 = sUnit("SPEC-E500", { bp: 500, sp: undefined });
const E1000 = sUnit("SPEC-E1000", { bp: 1000, sp: undefined });
const M1500 = sUnit("SPEC-M1500", { bp: 1500, sp: undefined, size: "M" });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: undefined });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, sp: undefined });
const M3000 = sUnit("SPEC-M3000", { bp: 3000, sp: undefined, size: "M" });
const E4000 = sUnit("SPEC-E4000", { bp: 4000, sp: undefined });
const E4500 = sUnit("SPEC-E4500", { bp: 4500, sp: undefined });
const ALL = [E1500, E500, E1000, M1500, E2000, E3000, M3000, E4000, E4500];

// ===========================================================================
describe("RS-685 ブラックコンドル（2nd）", () => {
  const TEXT =
    "※ウイング ※自軍ターン中、これがBPの下三桁が500の敵軍ユニットを撃破したとき、相手に1点ダメージを与える。 【ブリンガーソード】「SP1」BPの下三桁が500の敵軍Sユニットを1体選び撃破する。（この効果は「レッドホーク」からコンビネーションするときはナンバーに関係なく発動する)";
  const PAGE = "atwiki/page-1530";

  it("RS-685: カタログ本文・スペックが出典と一致（出典: atwiki/page-1530）", () => {
    expectCatalogText("RS-685", TEXT);
    expectStats("RS-685", { name: "ブラックコンドル", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 4, comboNumber: 5, features: ["ブラック", "男", "2nd"] });
  });

  it("RS-685: レアリティはスーパーレア（出典: atwiki/page-1530「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-685")).toBe("SR");
  });

  wingTests("RS-685", PAGE);

  /** ブラックコンドルを1番目（NC 不成立）に出し、敵 target にアタックする。 */
  const attackOwnTurn = (target: string) => {
    const [cid, suf] = target.split(":") as [string, string];
    const s = p1Battle({ rush: [inst("RS-685", "c")] }, { battle: [inst(cid, suf)] }, ALL);
    return resolveAll(settle(attack(enterKeep(s, ["RS-685:c"]), "RS-685:c", target)));
  };

  it("RS-685: ※ 自軍ターン中、アタックで BP の下三桁が500の敵軍ユニット（BP1500）を撃破すると相手に1点ダメージ（出典: atwiki/page-1530）", () => {
    const s = attackOwnTurn("SPEC-E1500:t");
    expect(zoneOf(s, "player2", "SPEC-E1500:t")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RS-685: ※ 下三桁が500の M ユニットでも対象（「敵軍ユニット」）（出典: atwiki/page-1530「BPの下三桁が500の敵軍ユニット」）", () => {
    const s = attackOwnTurn("SPEC-M1500:t");
    expect(zoneOf(s, "player2", "SPEC-M1500:t")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RS-685: ※ 下三桁が500でない敵軍ユニット（BP1000）を撃破してもダメージはない（出典: atwiki/page-1530「BPの下三桁が500の」）", () => {
    const s = attackOwnTurn("SPEC-E1000:t");
    expect(zoneOf(s, "player2", "SPEC-E1000:t")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RS-685: ※ 敵軍ターン中に BP1500 の敵にアタックされて撃破してもダメージはない（出典: atwiki/page-1530「自軍ターン中、」）", () => {
    let s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-685", "c")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E1500", "atk")], deck: deckCards(3, "e") } },
      ALL,
    );
    s = resolveAll(settle(attack(s, "SPEC-E1500:atk", "RS-685:c", "player2")));
    expect(zoneOf(s, "player2", "SPEC-E1500:atk")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  const board = (fillers: number) =>
    ncEnter(
      "RS-685:c",
      fillers,
      {},
      { battle: [inst("SPEC-E1500", "b1500"), inst("SPEC-E1000", "b1000")], rush: [inst("SPEC-E500", "r500"), inst("SPEC-M1500", "m1500")] },
      ALL,
    );

  it("RS-685: 【ブリンガーソード】NC（5番目）— 選べるのは BP の下三桁が500の敵軍 S ユニット（ラッシュエリアを含む）だけ（出典: atwiki/page-1530・R-TGT-01）", () => {
    const s = board(4);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-685");
    expect(choiceIds(s)).toEqual(["SPEC-E1500:b1500", "SPEC-E500:r500"]);
  });

  it("RS-685: 【ブリンガーソード】強制 — 選ばないことはできず、選んだユニットは撃破され、※により相手に1点ダメージ（出典: atwiki/page-1530「1体選び撃破する」・※「これが…撃破したとき」）", () => {
    let s = board(4);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E500:r500"));
    expect(zoneOf(s, "player2", "SPEC-E500:r500")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RS-685: 【ブリンガーソード】「SP1」— NC が成立すると SP1 になりストライクできる（出典: atwiki/page-1530）", () => {
    const s = resolveAll(board(4), ["SPEC-E1500:b1500"]);
    expect(spOf(s, "player1", "RS-685:c")).toBe(1);
    expect(canStrike(s, "RS-685:c")).toBe(true);
  });

  it("RS-685: 【ブリンガーソード】NC が成立しない（4番目）と撃破も SP1 もない（出典: R-CN-02）", () => {
    const s = board(3);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-685");
    const t = resolveAll(s);
    expect(zoneOf(t, "player2", "SPEC-E1500:b1500")).toBe("battle");
    expect(spOf(t, "player1", "RS-685:c")).toBe(0);
  });

  const fromHawk = (hawk: string) => {
    const [hid, hsuf] = hawk.split(":") as [string, string];
    const s = p1Battle({ rush: [inst(hid, hsuf), inst("RS-685", "c")] }, { battle: [inst("SPEC-E1500", "b1500")] }, ALL);
    return enterKeep(s, [hawk, "RS-685:c"]);
  };

  it("RS-685: 【ブリンガーソード】「レッドホーク（2nd）」からコンビネーションするとき（2番目）はナンバーに関係なく発動する（出典: atwiki/page-1530「「レッドホーク」からコンビネーションするときはナンバーに関係なく発動する」）", () => {
    let s = fromHawk("RS-689:rh");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-685");
    s = resolveAll(pick(s, "SPEC-E1500:b1500"));
    expect(zoneOf(s, "player2", "SPEC-E1500:b1500")).toBe("discard");
    expect(spOf(s, "player1", "RS-685:c")).toBe(1);
  });

  it("RS-685: 【ブリンガーソード】「レッドホーク」（RS-280）からコンビネーションするときも発動する（出典: atwiki/page-1530・関連カード「レッドホーク（1st）」）", () => {
    const s = fromHawk("RS-280:rh1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-685");
  });

  it("RS-685: 【ブリンガーソード】レッドホーク以外のユニットからの2番目では発動しない（出典: atwiki/page-1530）", () => {
    const s = fromHawk("TST-UNIT-0:x");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-685");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-E1500:b1500")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-686 セイクウオー", () => {
  const TEXT =
    "合体―トリプター＋ジェットラス＋ジャン・ボエール ※ウイング 【セイクウインパルス】これがストライクしてダメージを与えたとき、敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が3以下のユニットカードを1枚選び捨札にしてもよい。";
  const PAGE = "atwiki/page-1489";
  const PARTS = ["RS-668", "RS-666", "RS-667"];

  it("RS-686: カタログ本文・スペックが出典と一致（出典: atwiki/page-1489）", () => {
    expectCatalogText("RS-686", TEXT);
    expectStats("RS-686", { name: "セイクウオー", category: "OT", size: "L", bp: 9000, sp: 1, powerCost: "6+", features: ["人型", "航空機", "炎神"], rushCondition: "discard_fusion_unit" });
  });

  it("RS-686: レアリティはレア（出典: atwiki/page-1489「レアリティ：レア」）", () => {
    expect(rarityOf("RS-686")).toBe("R");
  });

  const rushBoard = (parts: string[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-686", "s")], rush: parts.map((p, i) => inst(p, `p${i}`)), command: releasedCat("OT", 1), power: powerCards(6), deck: deckCards(3) } });

  it("RS-686: 合体 — トリプター・ジェットラス・ジャン・ボエールを捨札にしてラッシュできる（出典: atwiki/page-1489「合体―トリプター＋ジェットラス＋ジャン・ボエール」）", () => {
    const r = rushFromHand(rushBoard(PARTS), "player1", "RS-686:s");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-686:s")).toBe("rush");
    for (let i = 0; i < PARTS.length; i++) expect(zoneOf(s, "player1", `${PARTS[i]}:p${i}`)).toBe("discard");
  });

  it("RS-686: 合体 — 素材が1体（ジャン・ボエール）欠けるとラッシュできない（出典: atwiki/page-1489）", () => {
    expect(canStartRush(rushBoard(PARTS.slice(0, 2)), "player1", "RS-686:s")).toBe(false);
  });

  wingTests("RS-686", PAGE);

  /** セイクウオーをバトルエリアに出してストライクし、相手は先頭の TST-P をダメージにする。 */
  const strikeBoard = () => {
    let s = p1Battle(
      { rush: [inst("RS-686", "s")], command: releasedCat("OT", 3) },
      { power: [inst("TST-P", "pp"), inst("RS-670", "c2"), inst("RS-674", "c3"), inst("RS-673", "c4"), inst("TST-OP", "op"), { ...inst("RS-671", "fd"), faceDown: true }] },
    );
    s = enterKeep(s, ["RS-686:s"]);
    return settle(act(s, { type: "strike", playerId: "player1", instanceId: "RS-686:s" }));
  };

  it("RS-686: 【セイクウインパルス】ストライクしてダメージを与えたとき、敵軍パワーのオモテ向きで必要パワー3以下のユニットカードだけを選べ、任意（出典: atwiki/page-1489）", () => {
    const s = strikeBoard();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-686");
    expect(choiceIds(s)).toEqual(["RS-670:c2", "RS-674:c3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-686: 【セイクウインパルス】選んだカードは捨札になる（出典: atwiki/page-1489「1枚選び捨札にしてもよい」）", () => {
    const s = resolveAll(pick(strikeBoard(), "RS-674:c3"));
    expect(zoneOf(s, "player2", "RS-674:c3")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-670:c2")).toBe("power");
  });

  it("RS-686: 【セイクウインパルス】選ばなければ何も捨札にならない（出典: atwiki/page-1489「してもよい」）", () => {
    const s = resolveAll(skip(strikeBoard()));
    expect(zoneOf(s, "player2", "RS-674:c3")).toBe("power");
    expect(zoneOf(s, "player2", "RS-670:c2")).toBe("power");
  });

  it("RS-686: Q1 — 異次元からの翼でセイクウオーを出すとき、デンジ犬アイシーの【最後の手段】で山札のジャン・ボエールを捨札にして追加条件を満たせる（出典: atwiki/page-1489 Q&A A1「はい、できます」）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-605", "op")],
        rush: [inst("RS-359", "icy"), inst("RS-668", "p0"), inst("RS-666", "p1")],
        command: releasedCat("OT", 2),
        power: powerCards(6),
        deck: [inst("RS-686", "s"), inst("RS-667", "jb"), ...deckCards(3)],
      },
    });
    const r = playOp(s, "player1", "RS-605:op");
    expect(r.ok).toBe(true);
    s = resolveAll(r.state, ["RS-686:s", "RS-667:jb"]);
    expect(zoneOf(s, "player1", "RS-686:s")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-359:icy")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-667:jb")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-668:p0")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-666:p1")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-687 ギンガイオー", () => {
  const TEXT =
    "合体―ギンガレオン＋ギンガルコン＋ギンガリラ＋ギンガベリック＋ギンガット ※ブラスト 【ガルコンボーガン】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する。";
  const PAGE = "atwiki/page-1433";
  const PARTS = ["RS-466", "RS-467", "RS-468", "RS-469", "RS-470"];

  it("RS-687: カタログ本文・スペックが出典と一致（出典: atwiki/page-1433）", () => {
    expectCatalogText("RS-687", TEXT);
    expectStats("RS-687", { name: "ギンガイオー", category: "WB", size: "L", bp: 12000, sp: 1, powerCost: "5+", features: ["獣", "人型"], rushCondition: "discard_fusion_vehicle" });
  });

  it("RS-687: レアリティはスーパーレア（出典: atwiki/page-1433「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-687")).toBe("SR");
  });

  const rushBoard = (parts: string[], power = powerCards(5), damage = 0, extraRush: ReturnType<typeof inst>[] = []) =>
    st({ phase: "rush", player1: { hand: [inst("RS-687", "g")], rush: [...parts.map((p, i) => inst(p, `v${i}`)), ...extraRush], command: releasedCat("WB", 1), power, damage, deck: deckCards(3) } });

  it("RS-687: 合体 — 自軍の5台の星獣ビークルを捨札にしてラッシュできる（出典: atwiki/page-1433「追加条件：自軍合体ビークルを捨札にする」）", () => {
    const r = rushFromHand(rushBoard(PARTS), "player1", "RS-687:g");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-687:g")).toBe("rush");
    for (let i = 0; i < PARTS.length; i++) expect(zoneOf(s, "player1", `${PARTS[i]}:v${i}`)).toBe("discard");
  });

  it("RS-687: 合体 — ビークルが1台（ギンガット）欠けるとラッシュできない（出典: atwiki/page-1433）", () => {
    expect(canStartRush(rushBoard(PARTS.slice(0, 4)), "player1", "RS-687:g")).toBe(false);
  });

  it("RS-687: ※ブラスト — ダメージ6点で自軍 L ユニットがなければビークルなしでラッシュできる（出典: grnrngr/faq-card-9 ブラスト・atwiki/page-1433 評価「ブラストを持っているので、最悪ビークル無しでもラッシュは可能」）", () => {
    const r = rushFromHand(rushBoard([], damageCards(6), 6), "player1", "RS-687:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-687:g")).toBe("rush");
  });

  it("RS-687: ※ブラスト — 自軍 L ユニットがあれば使えない（出典: grnrngr/faq-card-9 ブラスト「自軍Ｌユニットが１体もなければ」）", () => {
    expect(canStartRush(rushBoard([], damageCards(6), 6, [inst("TST-UNIT-7", "L")]), "player1", "RS-687:g")).toBe(false);
  });

  const enterGingaioh = () =>
    act(
      p1Battle(
        { rush: [inst("RS-687", "g")], command: releasedCat("WB", 3) },
        { rush: [inst("SPEC-E4000", "r4000"), inst("SPEC-M3000", "rm3000"), inst("SPEC-E4500", "r4500")], battle: [inst("SPEC-E1000", "b1000")] },
        ALL,
      ),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-687:g" },
    );

  it("RS-687: 【ガルコンボーガン】自軍ターン中にバトルエリアに出たとき、敵軍ラッシュエリアの BP4000 以下のユニット（M も含む）を選べ、バトルエリアのユニットは候補外（出典: atwiki/page-1433「敵軍ラッシュエリアからBP4000以下のユニットを1体選び」）", () => {
    const s = enterGingaioh();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-687");
    expect(choiceIds(s)).toContain("SPEC-E4000:r4000");
    expect(choiceIds(s)).toContain("SPEC-M3000:rm3000");
    expect(choiceIds(s)).not.toContain("SPEC-E1000:b1000");
  });

  it("RS-687: 【ガルコンボーガン】BP4000 を超えるユニット（BP4500）は選べない（出典: atwiki/page-1433「BP4000以下」）", () => {
    const s = enterGingaioh();
    expect(choiceIds(s)).toEqual(["SPEC-E4000:r4000", "SPEC-M3000:rm3000"]);
  });

  it("RS-687: 【ガルコンボーガン】強制 — 選ばないことはできず、選んだユニットは撃破される（出典: atwiki/page-1433「1体選び撃破する」）", () => {
    let s = enterGingaioh();
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E4000:r4000"));
    expect(zoneOf(s, "player2", "SPEC-E4000:r4000")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-M3000:rm3000")).toBe("rush");
  });

  it("RS-687: 【ガルコンボーガン】敵軍ターン中に効果でバトルエリアに出ても発動しない（出典: atwiki/page-1433「自軍ターン中、」）", () => {
    const s0 = st(
      { activePlayer: "player2", player1: { rush: [inst("RS-687", "g")], deck: deckCards(3) }, player2: { rush: [inst("SPEC-E4000", "r4000")], deck: deckCards(3, "e") } },
      ALL,
    );
    const s = enterBattleByEffect(s0, "player1", "RS-687:g");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-687");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-E4000:r4000")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-688 ギガフェニックス", () => {
  const TEXT = "※ウイング 【ギガニックブーメラン】これをラッシュしたとき、レジストまたはウイングを持つ敵軍ユニットをすべてホールドしてもよい。";
  const PAGE = "atwiki/page-1498";

  it("RS-688: カタログ本文・スペックが出典と一致（出典: atwiki/page-1498「追加条件：自軍「分身獣ギガウイング」1体を捨札にする」）", () => {
    expectCatalogText("RS-688", TEXT);
    expectStats("RS-688", { name: "ギガフェニックス", category: "WB", size: "L", bp: 6000, sp: 1, powerCost: "5+", features: ["メカ", "獣", "人型"], rushCondition: "discard_named_unit" });
  });

  it("RS-688: レアリティはレア（出典: atwiki/page-1498「レアリティ：レア」）", () => {
    expect(rarityOf("RS-688")).toBe("R");
  });

  const rushBoard = (own: ReturnType<typeof inst>[], enemy: Partial<Parameters<typeof p1Battle>[1]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-688", "g")], rush: own, command: releasedCat("WB", 1), power: powerCards(5), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e"), ...enemy },
    });

  it("RS-688: 追加条件 — 自軍「分身獣ギガウイング」1体を捨札にしてラッシュできる（出典: atwiki/page-1498）", () => {
    const r = rushFromHand(rushBoard([inst("RS-644", "gw")]), "player1", "RS-688:g");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-688:g")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-644:gw")).toBe("discard");
  });

  it("RS-688: 追加条件 — 分身獣ギガウイングがいなければラッシュできない（出典: atwiki/page-1498）", () => {
    expect(canStartRush(rushBoard([inst("TST-UNIT-0", "x")]), "player1", "RS-688:g")).toBe(false);
  });

  wingTests("RS-688", PAGE);

  const boomerang = () =>
    rushFromHand(
      rushBoard([inst("RS-644", "gw"), inst("RS-674", "ownres")], {
        rush: [inst("RS-674", "res"), inst("TST-UNIT-0", "plain")],
        battle: [inst("RS-685", "wing"), inst("RS-689", "both")],
      }),
      "player1",
      "RS-688:g",
    ).state;

  it("RS-688: 【ギガニックブーメラン】ラッシュしたとき、任意（ホールドしないことも選べる）（出典: atwiki/page-1498「すべてホールドしてもよい」）", () => {
    let s = boomerang();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-688");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(cardIn(s, "player2", "RS-674:res")?.commandHeld ?? false).toBe(false);
    expect(cardIn(s, "player2", "RS-685:wing")?.commandHeld ?? false).toBe(false);
  });

  it("RS-688: 【ギガニックブーメラン】レジストまたはウイングを持つ敵軍ユニットをすべて（ラッシュエリアを含む）ホールドする。持たないユニット・自軍のユニットはそのまま（出典: atwiki/page-1498・R-TGT-01）", () => {
    const s = resolveAll(boomerang(), ["RS-674:res", "RS-685:wing", "RS-689:both"]);
    expect(cardIn(s, "player2", "RS-674:res")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "RS-685:wing")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "RS-689:both")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "TST-UNIT-0:plain")?.commandHeld ?? false).toBe(false);
    expect(cardIn(s, "player1", "RS-674:ownres")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("RS-689 レッドホーク（2nd）", () => {
  const TEXT = "※レジスト ※ウイング 【バードブラスター】このターン、ホールド状態の敵軍SユニットはBP-2500される。（BP0以下になったユニットは撃破される）";
  const PAGE = "atwiki/page-1531";

  it("RS-689: カタログ本文・スペックが出典と一致（出典: atwiki/page-1531）", () => {
    expectCatalogText("RS-689", TEXT);
    expectStats("RS-689", { name: "レッドホーク", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: 1, features: ["レッド", "男", "2nd"] });
  });

  it("RS-689: レアリティはスーパーレア（出典: atwiki/page-1531「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-689")).toBe("SR");
  });

  it("RS-689: ※レジスト — 敵軍ターン中にバトルで撃破されるときレジストできる（出典: atwiki/page-1531「※レジスト」）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-689", "h")] }, "RS-689:h");
    expect(registerOffered(s)).toBe(true);
  });

  wingTests("RS-689", PAGE);

  const board = (fillers: number) =>
    ncEnter(
      "RS-689:h",
      fillers,
      {},
      {
        battle: [heldUnit("SPEC-E2000", "h2000"), heldUnit("SPEC-E3000", "h3000"), inst("SPEC-E3000", "rel3000")],
        rush: [heldUnit("SPEC-E3000", "rh3000"), heldUnit("SPEC-M3000", "hm3000")],
      },
      ALL,
    );

  it("RS-689: 【バードブラスター】NC（1番目）— このターン、ホールド状態の敵軍 S ユニットは BP-2500（ラッシュエリアも含む）（出典: atwiki/page-1531・R-TGT-01）", () => {
    const s = resolveAll(board(0));
    expect(bpOf(s, "player2", "SPEC-E3000:h3000")).toBe(500);
    expect(bpOf(s, "player2", "SPEC-E3000:rh3000")).toBe(500);
  });

  it("RS-689: 【バードブラスター】BP0 以下になったユニット（ホールド中の BP2000）は撃破される（出典: atwiki/page-1531「（BP0以下になったユニットは撃破される）」）", () => {
    const s = resolveAll(board(0));
    expect(zoneOf(s, "player2", "SPEC-E2000:h2000")).toBe("discard");
  });

  it("RS-689: 【バードブラスター】リリース状態の敵軍ユニット・ホールド中の M ユニットの BP は変わらない（出典: atwiki/page-1531「ホールド状態の敵軍Sユニット」）", () => {
    const s = resolveAll(board(0));
    expect(bpOf(s, "player2", "SPEC-E3000:rel3000")).toBe(3000);
    expect(bpOf(s, "player2", "SPEC-M3000:hm3000")).toBe(3000);
  });

  it("RS-689: 【バードブラスター】NC が成立しない（2番目）と BP は変わらない（出典: R-CN-02）", () => {
    const s = resolveAll(board(1));
    expect(bpOf(s, "player2", "SPEC-E3000:h3000")).toBe(3000);
    expect(zoneOf(s, "player2", "SPEC-E2000:h2000")).toBe("battle");
  });

  it.todo(
    "RS-689: 【バードブラスター】NC の後で同じターンにホールドされた敵軍 S ユニットも BP-2500（出典: atwiki/page-1531「このターン、ホールド状態の」・評価「ＮＣ発動後にホールドしても対象に入る」）— 自軍バトルフェイズ中に敵軍ユニットをホールドする本範囲のカード（RS-688 はラッシュ時）がなく、組めないため保留",
  );
});

// ===========================================================================
describe("RS-690 スペードエース", () => {
  const TEXT =
    "※タクスET 【スペードアーツ】敵軍バトルエリアと敵軍ラッシュエリアから、同じBPを持つSユニットを1体ずつ選んでもよい。そうしたとき、選んだユニットを持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";
  const PAGE = "atwiki/page-1490";
  const ET_NOSP = sUnit("SPEC-ET-NOSP", { bp: 1000, sp: undefined, category: "ET" });
  const ET_NOSP_M = sUnit("SPEC-ET-NOSP-M", { bp: 1000, sp: undefined, category: "ET", size: "M" });
  const WB_NOSP = sUnit("SPEC-WB-NOSP", { bp: 1000, sp: undefined, category: "WB" });

  it("RS-690: カタログ本文・スペックが出典と一致（出典: atwiki/page-1490）", () => {
    expectCatalogText("RS-690", TEXT);
    expectStats("RS-690", { name: "スペードエース", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: 2, features: ["メカ", "レッド", "男"] });
  });

  it("RS-690: レアリティはレア（出典: atwiki/page-1490「レアリティ：レア」）", () => {
    expect(rarityOf("RS-690")).toBe("R");
  });

  /** スペードエースを pos 番目に出し、その次に next を出す。 */
  const taxis = (pos: number, next: string) => {
    const [nid, nsuf] = next.split(":") as [string, string];
    const s = p1Battle({ rush: [inst("RS-690", "a"), inst(nid, nsuf)], battle: fill(pos - 1) }, {}, [ET_NOSP, ET_NOSP_M, WB_NOSP]);
    return resolveAll(enterKeep(enterSeq(s, ["RS-690:a"]), [next]));
  };

  it("RS-690: ※タクスET — バトルエリアの4番目にある間、次に並ぶ ET の S ユニットは SP1 を得る（出典: atwiki/page-1490「※タクスET」・R-KW-TAKUS-01）", () => {
    const s = taxis(4, "SPEC-ET-NOSP:n");
    expect(spOf(s, "player1", "SPEC-ET-NOSP:n")).toBe(1);
    expect(canStrike(s, "SPEC-ET-NOSP:n")).toBe(true);
  });

  it("RS-690: ※タクスET — 次に並ぶのが ET 以外のユニットなら SP1 を得ない（出典: R-KW-TAKUS-01「○○を持つSユニット」）", () => {
    const s = taxis(4, "SPEC-WB-NOSP:n");
    expect(spOf(s, "player1", "SPEC-WB-NOSP:n")).toBe(0);
  });

  it("RS-690: ※タクスET — 次に並ぶのが ET の M ユニットなら SP1 を得ない（出典: R-KW-TAKUS-01「Sユニットは「SP1」を得る」）", () => {
    const s = taxis(4, "SPEC-ET-NOSP-M:n");
    expect(spOf(s, "player1", "SPEC-ET-NOSP-M:n")).toBe(0);
  });

  it("RS-690: ※タクスET — 3番目にあるときは次の ET の S ユニットも SP1 を得ない（出典: R-KW-TAKUS-01 番号 ET=4）", () => {
    const s = taxis(3, "SPEC-ET-NOSP:n");
    expect(spOf(s, "player1", "SPEC-ET-NOSP:n")).toBe(0);
  });

  const arts = (fillers: number, p1Command = 0, p2: Partial<Parameters<typeof p1Battle>[1]> = {}) =>
    ncEnter(
      "RS-690:a",
      fillers,
      {},
      {
        battle: [inst("SPEC-E3000", "b3000"), inst("SPEC-E2000", "b2000"), inst("SPEC-M3000", "bm3000")],
        rush: [inst("SPEC-E3000", "r3000"), inst("SPEC-E1000", "r1000")],
        command: heldN(p1Command, "TST-OP", "ec"),
        ...p2,
      },
      ALL,
    );

  it("RS-690: 【スペードアーツ】NC（2番目）— 任意（選ばないことも選べ、何も動かない）（出典: atwiki/page-1490「1体ずつ選んでもよい」）", () => {
    let s = arts(1);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-690");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-E3000:b3000")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E3000:r3000")).toBe("rush");
  });

  it("RS-690: 【スペードアーツ】バトルエリアとラッシュエリアの同じ BP の S ユニット（BP3000 同士）を1体ずつ選び、持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1490）", () => {
    let s = arts(1);
    expect(choiceIds(s)).toContain("SPEC-E3000:b3000");
    s = pick(s, "SPEC-E3000:b3000");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:r3000"]);
    s = resolveAll(pick(s, "SPEC-E3000:r3000"));
    expect(zoneOf(s, "player2", "SPEC-E3000:b3000")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-E3000:r3000")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-E3000:b3000")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-E3000:r3000")?.commandHeld).toBe(true);
  });

  it("RS-690: 【スペードアーツ】ラッシュエリアに同じ BP の S ユニットがいないもの（BP2000）・M ユニットは選べない（出典: atwiki/page-1490「同じBPを持つSユニットを1体ずつ」）", () => {
    const s = arts(1);
    expect(choiceIds(s)).toEqual(["SPEC-E3000:b3000"]);
  });

  it("RS-690: 【スペードアーツ】相手のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-1490「置けなければ捨札にする」・R-ZONE-08）", () => {
    let s = arts(1, 5);
    s = pick(s, "SPEC-E3000:b3000");
    s = resolveAll(pick(s, "SPEC-E3000:r3000"));
    expect(zoneOf(s, "player2", "SPEC-E3000:b3000")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3000:r3000")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-690: 【スペードアーツ】NC が成立しない（3番目）と発動しない（出典: R-CN-02）", () => {
    const s = arts(2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-690");
    const t = resolveAll(s);
    expect(zoneOf(t, "player2", "SPEC-E3000:b3000")).toBe("battle");
  });
});
