/**
 * カード別スペック: XG6-009〜XG6-015（クロスギャザー ザ・ギガンティックタイタン キョウリュウシンケンオー〜爆竜パラサロッキル）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG6-010 Q1・Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-01・R-ADD-06・R-KW-BLAST・R-KW-BREAKER・R-POW-01・R-CAT-02・R-ADD-07）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  accept,
  act,
  bpOf,
  attackTargets,
  canEnter,
  canSkip,
  canUseCard,
  cardIn,
  choiceIds,
  deckCards,
  endTurnKeep,
  enemyTurn,
  enter,
  enterHold,
  entered,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  faceDown,
  faceUp,
  heldN,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushHand,
  rushOffered,
  skip,
  sUnit,
  withDamage,
  zoneOf,
} from "./XG6-001-022.helpers";

const DA8 = sUnit("SPEC-DA8", { category: "DA", bp: 8000 });
const DA9 = sUnit("SPEC-DA9", { category: "DA", bp: 9000 });
const DA8M = sUnit("SPEC-DA8M", { category: "DA", bp: 8000, size: "M" });
const WB8 = sUnit("SPEC-WB8", { category: "WB", bp: 8000 });
const E4K = sUnit("SPEC-E4K", { bp: 4000 });
const E5K = sUnit("SPEC-E5K", { bp: 5000 });
const E3 = sUnit("SPEC-E3", { bp: 1000, powerCost: 3 });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { category: "WB", bp: 1000, powerCost: 4 });
const ET_L = sUnit("SPEC-ET-L", { category: "ET", bp: 10000, size: "L" });
const EXTRA = [DA8, DA9, DA8M, WB8, E4K, E5K, E3, OT_S, C3, C4, ET_L];

// ===========================================================================
describe("XG6-009 キョウリュウシンケンオー", () => {
  const TEXT =
    "合体─シンケンオー（または獅子折神+龍折神+亀折神+熊折神+猿折神）+恐竜折神 ※ブラスト 【キョウリュウマル天地一閃】これをラッシュしたとき、次の効果を発動できる→DAを持つBP8000以下の敵軍ユニットをすべて撃破する。（この効果は自軍ラッシュフェイズ中、自軍パワーが6以上あれば、自分の手札からこのカードを捨札にして発動できる）";
  const PAGE = "atwiki/page-2302";

  it(`XG6-009: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-009", TEXT);
    expectUnit("XG6-009", { name: "キョウリュウシンケンオー", category: "MA", size: "L", bp: 18000, sp: 1, powerCost: "6+", features: ["侍", "恐竜", "人型"] });
    expectRushCondition("XG6-009", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-009", ["N"]);
  });

  const enemy = () => ({ battle: [inst("SPEC-DA8", "d8"), inst("SPEC-DA9", "d9"), inst("SPEC-WB8", "w8")], rush: [inst("SPEC-DA8M", "d8m")] });
  const rushWithParts = () =>
    rushHand("XG6-009:k", { rush: [inst("RS-679", "so"), inst("XG3-034", "ky")], command: releasedCat("MA", 1), power: powerCards(6) }, enemy(), EXTRA);

  it(`XG6-009: 追加条件 — 自軍のシンケンオーと恐竜折神を捨札にしてラッシュできる（出典: ${PAGE}「合体─シンケンオー（または…）+恐竜折神」・R-ADD-06）`, () => {
    const r = rushWithParts();
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-679:so")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG3-034:ky")).toBe("discard");
  });

  it(`XG6-009: ※ブラスト — 残りダメージ1点（6点）で自軍 L ユニットがなければ、合体ユニットなしでラッシュできる（出典: ${PAGE}「※ブラスト」・R-KW-BLAST-01）`, () => {
    const r = rushHand("XG6-009:k", { command: releasedCat("MA", 1), ...withDamage(6) }, {}, EXTRA);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-009:k")).toBe("rush");
  });

  it.fails(
    `XG6-009: 【キョウリュウマル天地一閃】ラッシュしたとき、DA を持つ BP8000 以下の敵軍ユニットをすべて撃破する（ラッシュエリア・M ユニットも。BP9000・DA を持たないユニットは残る）（出典: ${PAGE}「DAを持つBP8000以下の敵軍ユニットをすべて撃破する」）— 既知の不具合: CARD-XG6-009 ラッシュしたときに何も撃破しない`,
    () => {
      let s = rushWithParts().state;
      if (s.pendingEffectChoice?.sourceCardId === "XG6-009") s = accept(s);
      s = resolveAll(s);
      expect(zoneOf(s, "player2", "SPEC-DA8:d8")).toBe("discard");
      expect(zoneOf(s, "player2", "SPEC-DA8M:d8m")).toBe("discard");
      expect(zoneOf(s, "player2", "SPEC-DA9:d9")).toBe("battle");
      expect(zoneOf(s, "player2", "SPEC-WB8:w8")).toBe("battle");
    },
  );

  it.fails(
    `XG6-009: （）内 — 自軍ラッシュフェイズ中、自軍パワーが6以上なら、手札のこれを捨札にして【キョウリュウマル天地一閃】を発動できる（出典: ${PAGE}「自軍パワーが6以上あれば、自分の手札からこのカードを捨札にして発動できる」）— 既知の不具合: CARD-XG6-009 手札から捨札にして発動する手段がない`,
    () => {
      const s = rushBoard({ hand: [inst("XG6-009", "k")], power: powerCards(6) }, enemy(), EXTRA);
      const a = legal(s).find((x) => x.playerId === "player1" && x.type !== "end_phase");
      expect(a).toBeDefined();
      let t = act(s, a!);
      if (t.pendingEffectChoice?.sourceCardId === "XG6-009") t = accept(t);
      t = resolveAll(t);
      expect(zoneOf(t, "player1", "XG6-009:k")).toBe("discard");
      expect(zoneOf(t, "player2", "SPEC-DA8:d8")).toBe("discard");
    },
  );

  it(`XG6-009: （）内 — 自軍パワーが5なら手札から発動できない（ラッシュフェイズの行動はフェイズ終了だけ）（出典: ${PAGE}「自軍パワーが6以上あれば」）`, () => {
    const s = rushBoard({ hand: [inst("XG6-009", "k")], power: powerCards(5) }, enemy(), EXTRA);
    expect(legal(s).filter((a) => a.playerId === "player1").map((a) => a.type)).toEqual(["end_phase"]);
  });
});

// ===========================================================================
describe("XG6-010 グレートタイタン", () => {
  const TEXT =
    "※ブレイカー 【タイタンノバ】自軍ターン中、これがバトルエリアに出たとき、カード名に「タイタン」を含む自軍コマンドか追加条件を持つオモテ向きの自軍パワーを、2枚まで選び捨札にしてもよい。そうしたとき、捨札にした枚数と同じ数だけ、相手にダメージを与える。";
  const PAGE = "atwiki/page-2313";

  it(`XG6-010: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-010", TEXT);
    expectUnit("XG6-010", { name: "グレートタイタン", category: "OT", size: "XL", bp: 16000, sp: undefined, powerCost: "6+", features: ["メカ", "人型"] });
    expectRushCondition("XG6-010", DEFS["XG6-010"]?.rushAdditionalCondition?.conditionId, "自軍「フラッシュタイタン」１体と「タイタンボーイ」１体をパワーゾーンに送る");
    expectRarityIn("XG6-010", ["R"]);
  });

  it.fails(
    `XG6-010: 追加条件 — 自軍のフラッシュタイタン1体とタイタンボーイ1体をパワーゾーンに送ってラッシュできる（出典: ${PAGE}「追加条件：自軍「フラッシュタイタン」１体と「タイタンボーイ」１体をパワーゾーンに送る」）— 既知の不具合: CARD-XG6-010 追加条件が「自軍Sユニット1体をパワーゾーンに送る」として扱われ、ラッシュできない`,
    () => {
      const r = rushHand("XG6-010:g", { rush: [inst("XG6-012", "ft"), inst("XG6-011", "tb")], command: releasedCat("OT", 1), power: powerCards(6) });
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "XG6-012:ft")).toBe("power");
      expect(zoneOf(r.state, "player1", "XG6-011:tb")).toBe("power");
    },
  );

  it.fails(`XG6-010: 追加条件 — フラッシュタイタンと S ユニットだけ（タイタンボーイがない）ならラッシュできない（出典: ${PAGE}「１体と「タイタンボーイ」１体を」）— 既知の不具合: CARD-XG6-010 追加条件が「自軍Sユニット1体をパワーゾーンに送る」として扱われ、S ユニットを送ればラッシュできてしまう`, () => {
    expect(rushHand("XG6-010:g", { rush: [inst("XG6-012", "ft"), inst("SPEC-OT-S", "s")], command: releasedCat("OT", 1), power: powerCards(6) }, {}, EXTRA).ok).toBe(false);
  });

  it(`XG6-010: ※ブレイカー — ブレイカーを持たない敵軍ユニットの効果（XG6-006 ダイタンケン【ボウケンフラッシュ】）には選ばれない（出典: ${PAGE}「※ブレイカー」・R-KW-BREAKER-01）`, () => {
    let s = enemyTurn(
      { battle: [inst("XG6-010", "g"), inst("SPEC-E3", "e3")] },
      { rush: [inst("XG6-006", "dt")], command: [inst("XG6-016", "an")] },
      EXTRA,
    );
    s = enter(s, "XG6-006:dt", "player2");
    for (let i = 0; i < 2 && s.pendingEffectChoice?.sourceCardId === "XG6-006" && choiceIds(s).includes("XG6-016:an"); i++) s = pick(s, "XG6-016:an");
    expectChoiceFrom(s, "player2", "XG6-006");
    expect(choiceIds(s)).toContain("SPEC-E3:e3");
    expect(choiceIds(s)).not.toContain("XG6-010:g");
  });

  /** グレートタイタンをバトルエリアに出す。コマンドに XG6-011 タイタンボーイ・RK-104 仮面ライダークウガTF（ルビ「タイタン」）・TST-OP、パワーに XG6-003（追加条件あり）・TST-P。 */
  const nova = () =>
    entered("XG6-010:g", {
      command: [released("XG6-011", "tb"), released("RK-104", "kw"), released("TST-OP", "c")],
      power: [faceUp("XG6-003", "p3"), faceUp("TST-P", "pp"), faceDown("XG6-020", "dmg")],
      damage: 1,
    });

  it.fails(
    `XG6-010: 【タイタンノバ】バトルエリアに出たとき、カード名に「タイタン」を含む自軍コマンド（ルビの RK-104 クウガTF も）と、追加条件を持つオモテ向きの自軍パワー（カード名は問わない）から2枚まで選んで捨札にできる（任意）（出典: ${PAGE}「2枚まで選び捨札にしてもよい」・Q1「はい、できます」・Q2「追加条件を持つ自軍パワーゾーンのオモテ向きのカード（カード名は問わない）」）— 既知の不具合: CARD-XG6-010 【タイタンノバ】が発動しない`,
    () => {
      const s = nova();
      expectChoiceFrom(s, "player1", "XG6-010");
      expect(choiceIds(s)).toEqual(["RK-104:kw", "XG6-003:p3", "XG6-011:tb"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it.fails(
    `XG6-010: 【タイタンノバ】2枚捨札にすれば、相手に2点ダメージを与える（出典: ${PAGE}「捨札にした枚数と同じ数だけ、相手にダメージを与える」）— 既知の不具合: CARD-XG6-010 【タイタンノバ】が発動しない`,
    () => {
      let s = nova();
      expectChoiceFrom(s, "player1", "XG6-010");
      s = resolveAll(s, ["XG6-011:tb", "XG6-003:p3"]);
      expect(zoneOf(s, "player1", "XG6-011:tb")).toBe("discard");
      expect(zoneOf(s, "player1", "XG6-003:p3")).toBe("discard");
      expect(s.players.player2.damage).toBe(2);
    },
  );
});

// ===========================================================================
describe("XG6-011 タイタンボーイ", () => {
  const TEXT =
    "【ラジアルボンバー】これが自軍バトルエリアにある間、自分がターンを終えるとき、これを自軍パワーゾーンに送ってもよい。そうしたとき、BP4000以下の敵軍ユニットを1体選び持ち主のパワーゾーンに送る。";
  const PAGE = "atwiki/page-2346";

  it(`XG6-011: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-011", TEXT);
    expectUnit("XG6-011", { name: "タイタンボーイ", category: "OT", size: "L", bp: 8000, sp: "1/4", powerCost: "5+", features: ["メカ", "人型"] });
    expectRushCondition("XG6-011", "state_gate", "自軍「フラッシュタイタン」がある");
    expectRarityIn("XG6-011", ["R"]);
  });

  it(`XG6-011: 追加条件 — 自軍にフラッシュタイタンがあればラッシュでき（フラッシュタイタンは場に残る）、なければラッシュできない（出典: ${PAGE}「追加条件：自軍「フラッシュタイタン」がある」）`, () => {
    const r = rushHand("XG6-011:tb", { rush: [inst("XG6-012", "ft")], command: releasedCat("OT", 1), power: powerCards(5) });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-012:ft")).toBe("rush");
    expect(rushHand("XG6-011:tb", { command: releasedCat("OT", 1), power: powerCards(5) }).ok).toBe(false);
  });

  const ending = (area: "battle" | "rush" = "battle") =>
    endTurnKeep(p1Battle({ [area]: [inst("XG6-011", "tb")] }, { battle: [inst("SPEC-E4K", "e4"), inst("SPEC-E5K", "e5")] }, EXTRA));

  it.fails(
    `XG6-011: 【ラジアルボンバー】自軍バトルエリアにある間、自分がターンを終えるとき、これを自軍パワーゾーンに送るかを選べる（任意）（出典: ${PAGE}「これを自軍パワーゾーンに送ってもよい」）— 既知の不具合: CARD-XG6-011 【ラジアルボンバー】が発動しない`,
    () => {
      const s = ending();
      expectChoiceFrom(s, "player1", "XG6-011");
      expect(canSkip(s)).toBe(true);
    },
  );

  it.fails(
    `XG6-011: 【ラジアルボンバー】送ったら、BP4000 以下の敵軍ユニットを1体選んで持ち主のパワーゾーンに送る（BP5000 のユニットは選べない）（出典: ${PAGE}「BP4000以下の敵軍ユニットを1体選び持ち主のパワーゾーンに送る」）— 既知の不具合: CARD-XG6-011 【ラジアルボンバー】が発動しない`,
    () => {
      let s = accept(ending());
      expect(zoneOf(s, "player1", "XG6-011:tb")).toBe("power");
      expectChoiceFrom(s, "player1", "XG6-011");
      expect(choiceIds(s)).toEqual(["SPEC-E4K:e4"]);
      s = resolveAll(pick(s, "SPEC-E4K:e4"));
      expect(zoneOf(s, "player2", "SPEC-E4K:e4")).toBe("power");
    },
  );

  it(`XG6-011: 【ラジアルボンバー】ラッシュエリアにあるときは発動しない（出典: ${PAGE}「これが自軍バトルエリアにある間」）`, () => {
    const s = ending("rush");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-011");
    expect(zoneOf(s, "player1", "XG6-011:tb")).toBe("rush");
  });
});

// ===========================================================================
describe("XG6-012 フラッシュタイタン", () => {
  const TEXT =
    "※自軍「タイタンボーイ」があるとき、これはアタックすることができない。 【フラッシュターン】これをラッシュしたとき、ウラ向きの自軍パワーを1枚選び、オモテにしてもよい。このとき、オモテにしたカードが「タイタンボーイ」以外ならウラ向きに戻す。その後、オモテ向きの自軍パワーから「タイタンボーイ」のカードを1枚選び、ラッシュエリアに出してもよい。";
  const PAGE = "atwiki/page-2284";

  it(`XG6-012: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-012", TEXT);
    expectUnit("XG6-012", { name: "フラッシュタイタン", category: "OT", size: "XL", bp: 6000, sp: undefined, powerCost: "4+", features: ["メカ", "車両", "航空機"] });
    expectRushCondition("XG6-012", "send_s_unit_to_power", "自軍Sユニット1体をパワーゾーンに送る");
    expectRarityIn("XG6-012", ["N"]);
  });

  it(`XG6-012: 追加条件 — 自軍 S ユニット1体をパワーゾーンに送ってラッシュできる（出典: ${PAGE}「追加条件：自軍Sユニット1体をパワーゾーンに送る」）`, () => {
    const r = rushHand("XG6-012:ft", { rush: [inst("SPEC-OT-S", "s")], command: releasedCat("OT", 1), power: powerCards(4) }, {}, EXTRA);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-OT-S:s")).toBe("power");
  });

  it.fails(`XG6-012: ※ 自軍にタイタンボーイがあるとき、これはアタックできない（いなければアタックできる）（出典: ${PAGE}「※自軍「タイタンボーイ」があるとき、これはアタックすることができない」）— 既知の不具合: CARD-XG6-012 タイタンボーイがあってもアタックできる`, () => {
    const board = (rush: CardInstance[]) => enter(p1Battle({ rush: [inst("XG6-012", "ft"), ...rush] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG6-012:ft");
    expect(attackTargets(board([inst("XG6-011", "tb")]), "XG6-012:ft")).toEqual([]);
    expect(attackTargets(board([]), "XG6-012:ft")).toEqual(["TST-UNIT-0:e"]);
  });

  /** フラッシュタイタンをラッシュする（S ユニットをパワーゾーンに送る）。パワーゾーンは power、ダメージは damage。 */
  const flashTurn = (power: CardInstance[], damage: number) =>
    rushHand("XG6-012:ft", { rush: [inst("SPEC-OT-S", "s")], command: releasedCat("OT", 1), power, damage }, {}, EXTRA).state;

  it.fails(
    `XG6-012: 【フラッシュターン】ラッシュしたとき、ウラ向きの自軍パワーから1枚選んでオモテにできる（任意。山札・オモテ向きのパワーは選べない）（出典: ${PAGE}「ウラ向きの自軍パワーを1枚選び、オモテにしてもよい」）— 既知の不具合: CARD-XG6-012 ウラ向きのパワーのかわりに山札の上のカードを選ばせる`,
    () => {
      const s = flashTurn([...powerCards(3), faceDown("XG6-011", "tbd"), faceDown("TST-OP", "od")], 2);
      expectChoiceFrom(s, "player1", "XG6-012");
      expect(choiceIds(s)).toEqual(["TST-OP:od", "XG6-011:tbd"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it.fails(
    `XG6-012: 【フラッシュターン】オモテにしたカードがタイタンボーイならオモテ向きのまま（ダメージが1点減る）。タイタンボーイ以外ならウラ向きに戻す（出典: ${PAGE}「オモテにしたカードが「タイタンボーイ」以外ならウラ向きに戻す」・カード評価「ラッシュ時にダメージ回復が狙える」）— 既知の不具合: CARD-XG6-012 ウラ向きのパワーのかわりに山札の上のカードを選ばせる`,
    () => {
      let s = flashTurn([...powerCards(3), faceDown("XG6-011", "tbd"), faceDown("TST-OP", "od")], 2);
      s = pick(s, "XG6-011:tbd");
      expect(cardIn(s, "player1", "XG6-011:tbd")?.faceDown ?? false).toBe(false);
      expect(s.players.player1.damage).toBe(1);
      let t = flashTurn([...powerCards(3), faceDown("XG6-011", "tbd"), faceDown("TST-OP", "od")], 2);
      t = pick(t, "TST-OP:od");
      expect(cardIn(t, "player1", "TST-OP:od")?.faceDown).toBe(true);
      expect(t.players.player1.damage).toBe(2);
    },
  );

  it.fails(
    `XG6-012: 【フラッシュターン】その後、オモテ向きの自軍パワーからタイタンボーイを1枚選んでラッシュエリアに出せる（オモテにしなかったときも）（出典: ${PAGE}「その後、オモテ向きの自軍パワーから「タイタンボーイ」のカードを1枚選び、ラッシュエリアに出してもよい」・カード評価「ウラ向きのカードがなかった場合でも、タイタンボーイをラッシュすることができる」）— 既知の不具合: CARD-XG6-012 ウラ向きのパワーのかわりに山札の上のカードを選ばせる`,
    () => {
      let s = flashTurn([...powerCards(3), faceUp("XG6-011", "tbu")], 0);
      expectChoiceFrom(s, "player1", "XG6-012");
      expect(choiceIds(s)).toEqual(["XG6-011:tbu"]);
      s = resolveAll(pick(s, "XG6-011:tbu"));
      expect(zoneOf(s, "player1", "XG6-011:tbu")).toBe("rush");
    },
  );
});

// ===========================================================================
describe("XG6-013 英雄タイタン", () => {
  const TEXT =
    "※これは、「OT」以外のカテゴリを持つコマンド1つにつきBP-1000される。 【未来の戦士達へ】これが自軍コマンドゾーンにある間、このカードはカテゴリにWB、MA、ETが追加され、敵軍パワーは追加で2増える。";
  const PAGE = "atwiki/page-2326";

  it(`XG6-013: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-013", TEXT);
    expectUnit("XG6-013", { name: "英雄タイタン", category: "OT", size: "S", bp: 5000, sp: undefined, powerCost: 0, features: ["男"] });
    expectRarityIn("XG6-013", ["R"]);
  });

  it.fails(
    `XG6-013: ※ OT 以外のカテゴリを持つコマンド1つにつき BP-1000（自軍 MA・敵軍 ET の2つで BP3000。OT のコマンドは数えない）（出典: ${PAGE}「「OT」以外のカテゴリを持つコマンド1つにつきBP-1000される」・カード評価「相手がOTでない限り終盤での活躍は難しい」）— 既知の不具合: CARD-XG6-013 BP が下がらない`,
    () => {
      const s = p1Battle({ battle: [inst("XG6-013", "h")], command: [released("TST-OP-MA", "c1"), released("TST-OP-OT", "c2")] }, { command: [released("TST-OP-ET", "c3")] });
      expect(bpOf(s, "player1", "XG6-013:h")).toBe(3000);
    },
  );

  it(`XG6-013: ※ OT のコマンドだけなら BP5000 のまま（出典: ${PAGE}「「OT」以外の」）`, () => {
    const s = p1Battle({ battle: [inst("XG6-013", "h")], command: [released("TST-OP-OT", "c2")] });
    expect(bpOf(s, "player1", "XG6-013:h")).toBe(5000);
  });

  it.fails(
    `XG6-013: 【未来の戦士達へ】自軍コマンドゾーンにある間、敵軍パワーは追加で2増える（マルチカテゴリのコマンド1枚分と合わせて3。パワーゾーンが0枚の相手が必要パワー3のユニットをラッシュでき、4はできない）（出典: ${PAGE}「敵軍パワーは追加で2増える」・カード評価「マルチカテゴリのルールにより相手のパワーは3増える」・R-POW-01）— 既知の不具合: CARD-XG6-013 コマンドゾーンでカテゴリも敵軍パワーも増えない`,
    () => {
      const s = enemyTurn({ command: [released("XG6-013", "h")] }, { hand: [inst("SPEC-C3", "u3"), inst("SPEC-C4", "u4")], command: releasedCat("WB", 1), power: [] }, EXTRA, "rush");
      expect(rushOffered(s, "SPEC-C3:u3", "player2")).toBe(true);
      expect(rushOffered(s, "SPEC-C4:u4", "player2")).toBe(false);
    },
  );

  it.fails(
    `XG6-013: 【未来の戦士達へ】自軍コマンドゾーンにある間、このカードは WB・MA・ET も持つ（WB のオペレーションの支払いに使える）（出典: ${PAGE}「このカードはカテゴリにWB、MA、ETが追加され」）— 既知の不具合: CARD-XG6-013 コマンドゾーンでカテゴリも敵軍パワーも増えない`,
    () => {
      const s = rushBoard({ hand: [inst("TST-OP", "op")], command: [released("XG6-013", "h")], power: powerCards(3) });
      expect(canUseCard(s, "player1", "TST-OP:op")).toBe(true);
    },
  );
});

// ===========================================================================
describe("XG6-014 レー・バラキ", () => {
  const TEXT =
    "【英雄の遺産】自軍パワーゾーンのオモテ向きのカードがこれだけなら、自軍ラッシュフェイズ中、次の効果を発動できる→自軍山札を見て、OTを持ち合体を必要としない、 Sユニット以外のユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーは満たすこと。その後、山札をシャッフルし、これを捨札にする。";
  const PAGE = "atwiki/page-2304";

  it(`XG6-014: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-014", TEXT);
    expectUnit("XG6-014", { name: "レー・バラキ", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["男"] });
    expectRarityIn("XG6-014", ["N"]);
  });

  // パワー4（レー・バラキ＋ダメージ3）。山札: XG6-012（OT・XL・4+）・XG6-010（OT・XL・6+）・XG6-020（ET の合体）・SPEC-OT-S（S）・XG6-005（MA の合体）。
  const deck = () => [inst("XG6-012", "ft"), inst("XG6-010", "gt"), inst("XG6-020", "u"), inst("SPEC-OT-S", "s"), ...deckCards(3)];
  const heritage = (power: CardInstance[] = [inst("XG6-014", "rb"), ...faceDownN(3)]) =>
    rushBoard({ power, damage: power.filter((c) => c.faceDown).length, deck: deck() }, {}, EXTRA);
  function faceDownN(n: number): CardInstance[] {
    return Array.from({ length: n }, (_, i) => faceDown("TST-P", `d${i}`));
  }

  it.fails(
    `XG6-014: 【英雄の遺産】自軍パワーゾーンのオモテ向きのカードがこれだけなら、自軍ラッシュフェイズ中に発動でき、山札の OT を持ち合体を必要としない S ユニット以外のユニットカードのうち、必要パワーを満たすものから1枚選べる（任意）（出典: ${PAGE}「OTを持ち合体を必要としない、 Sユニット以外のユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーは満たすこと」）— 既知の不具合: CARD-XG6-014 【英雄の遺産】を発動する手段がない`,
    () => {
      const s = heritage();
      const a = legal(s).find((x) => x.playerId === "player1" && x.type !== "end_phase");
      expect(a).toBeDefined();
      const t = act(s, a!);
      expectChoiceFrom(t, "player1", "XG6-014");
      expect(choiceIds(t)).toEqual(["XG6-012:ft"]);
      expect(canSkip(t)).toBe(true);
    },
  );

  it(`XG6-014: 【英雄の遺産】ほかにオモテ向きの自軍パワーがあれば発動できない（ラッシュフェイズの行動はフェイズ終了だけ）（出典: ${PAGE}「自軍パワーゾーンのオモテ向きのカードがこれだけなら」）`, () => {
    const s = heritage([inst("XG6-014", "rb"), inst("TST-P", "up"), ...faceDownN(2)]);
    expect(legal(s).filter((a) => a.playerId === "player1").map((a) => a.type)).toEqual(["end_phase"]);
  });
});

// ===========================================================================
describe("XG6-015 爆竜パラサロッキル", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【爆竜必殺チョキチョキシザース】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒相手は可能なら、自分自身のゾーンのオモテ向きのカードか手札を1枚選び捨札にする。";
  const PAGE = "atwiki/page-2298";

  it(`XG6-015: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-015", TEXT);
    expectUnit("XG6-015", { name: "爆竜パラサロッキル", category: "WB", size: "M", bp: 3000, sp: undefined, powerCost: 5, comboNumber: "R", features: ["恐竜"] });
    expectRarityIn("XG6-015", ["N"]);
  });

  it(`XG6-015: ※ リリース状態の自軍コマンドがなければバトルエリアに出られない（あればホールドして出る）（出典: ${PAGE}「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」・R-ADD-07）`, () => {
    expect(canEnter(p1Battle({ rush: [inst("XG6-015", "pr")], command: heldN(1) }), "XG6-015:pr")).toBe(false);
    const s = enterHold(p1Battle({ rush: [inst("XG6-015", "pr")], command: [released("TST-OP", "c")] }), "XG6-015:pr");
    expect(zoneOf(s, "player1", "XG6-015:pr")).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:c")?.commandHeld).toBe(true);
  });

  /** 自軍バトルエリアに L ユニット l、その次にパラサロッキルを出す（コマンドを1つホールド）。敵軍の手札1枚・オモテ向きのパワー・コマンド・ダメージ。 */
  const scissors = (l = inst("TST-UNIT-7", "L"), p2: Partial<GameState["players"]["player2"]> = { hand: [inst("TST-OP", "eh")], power: [faceUp("TST-P", "ep"), faceDown("TST-P", "ed")], damage: 1, command: [released("TST-OP-ET", "ec")] }) =>
    enterHold(p1Battle({ battle: [l], rush: [inst("XG6-015", "pr")], command: [released("TST-OP", "c")] }, p2, EXTRA), "XG6-015:pr");

  it(`XG6-015: 【爆竜必殺チョキチョキシザース】同カテゴリ（WB）の L ユニットからコンビネーションするとき、相手が自分の手札かオモテ向きのゾーンのカード（パワー・コマンド）から1枚選ぶ（ダメージは選べない。見送れない）（出典: ${PAGE}「相手は可能なら、自分自身のゾーンのオモテ向きのカードか手札を1枚選び捨札にする」）`, () => {
    const s = scissors();
    expectChoiceFrom(s, "player2", "XG6-015");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:ec", "TST-OP:eh", "TST-P:ep"]);
    expect(canSkip(s)).toBe(false);
  });

  it(`XG6-015: 【爆竜必殺チョキチョキシザース】選んだカードは捨札になる（出典: ${PAGE}「捨札にする」）`, () => {
    const s = resolveAll(pick(scissors(), "TST-P:ep"));
    expect(zoneOf(s, "player2", "TST-P:ep")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("hand");
  });

  it(`XG6-015: 【爆竜必殺チョキチョキシザース】相手に手札もオモテ向きのゾーンのカードもなければ何もしない（出典: ${PAGE}「相手は可能なら」）`, () => {
    const s = scissors(undefined, { hand: [], power: [faceDown("TST-P", "ed")], damage: 1 });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-015");
    expect(zoneOf(s, "player2", "TST-P:ed")).toBe("power");
  });

  it(`XG6-015: 【爆竜必殺チョキチョキシザース】カテゴリが違う（ET）L ユニットの次に出ても発動しない（出典: ${PAGE}「同カテゴリのLユニットから」）`, () => {
    const s = scissors(inst("SPEC-ET-L", "L"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-015");
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("hand");
  });
});
