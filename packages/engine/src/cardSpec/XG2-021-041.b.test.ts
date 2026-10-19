/**
 * カード別スペック: XG2-028〜XG2-034（クロスギャザー ザ・ドラゴンタイガー サラマンデスドラゴン〜ブラストバギー。XG2-030 は指揮官でカタログにない）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-028」〜「XG2-034」とカード名で検索。「デカレンジャーロボ」は RS の同名カードの項）。atwiki に転載された公式 Q&A（XG2-029 Q1・Q2、XG2-032 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-01・R-ADD-02・R-KW-BLAST-01〜02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-034 ブラストバギー【奇襲】の細かい場合分け（敵軍にも適用・自軍 L ユニットがいるとき・メディテーションとの組み合わせ）は rulesSpec/07-blast.test.ts（R-KW-BLAST-02）。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  attack,
  attackedInEnemyTurn,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  enemyNcEnter,
  enemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  inst,
  NOSP_ATTACKER,
  nextPhase,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  strike,
  sUnit,
  substitutes,
  useNinja,
  withStacked,
  zordDownTests,
  zoneOf,
} from "./XG2-021-041.helpers";

const POLICE_S = sUnit("SPEC-POLICE-S", { bp: 1000, features: ["警察"] });
const BIG_L = sUnit("SPEC-BIG-L", { category: "DA", bp: 20000, size: "L" });
const EXTRA = [POLICE_S, BIG_L];

const faceDown = (cardId: string, suf: string): CardInstance => ({ ...inst(cardId, suf), faceDown: true });

// ===========================================================================
describe("XG2-028 サラマンデスドラゴン", () => {
  const TEXT =
    "【マイナスエネルギー吸収】これが自軍ラッシュエリアにある間、自軍バトルフェイズを終えるときに1度だけ、自軍捨札から必要パワーに「－」を持つカードを1枚選び、これの下にウラ向きで重ねてもよい。これは下に重なっているウラ向きのカード1枚につき「SP+1」される。これがユニットでなくなるとき、この下に重ねたウラ向きのカードをすべて捨札にする。";

  it("XG2-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-1797）", () => {
    expectCatalogText("XG2-028", TEXT);
    expectUnit("XG2-028", { name: "サラマンデスドラゴン", category: "DA", size: "L", bp: 8000, sp: 1, powerCost: "9+", features: ["災魔一族", "男", "獣", "ドラゴン"], rushCondition: "discard_name_contains_unit" });
    expectRarityIn("XG2-028", ["NR"]);
  });

  const board = (rush: CardInstance[], power = 9) => rushBoard({ hand: [inst("XG2-028", "h")], rush, power: powerCards(power), command: releasedCat("DA", 1) });

  it("XG2-028: 追加条件 — カード名に「サラマンデス」を含む自軍ユニット（RS-094 龍冥王サラマンデス・XG2-029 幽魔王サラマンデス）1体を捨札にしてパワー9でラッシュできる（出典: atwiki/page-1797「追加条件：カード名に「サラマンデス」を含む自軍ユニット1体を捨札にする」「必要パワー：9+」）", () => {
    for (const id of ["RS-094", "XG2-029"]) {
      const r = rushFromHand(board([inst(id, "m")]), "player1", "XG2-028:h");
      expect(r.ok, r.error).toBe(true);
      expect(zoneOf(r.state, "player1", `${id}:m`)).toBe("discard");
    }
  });

  it("XG2-028: 追加条件 — パワー8ではラッシュできない。「サラマンデス」を含まないユニットでは満たさない（出典: atwiki/page-1797）", () => {
    expect(canStartRush(board([inst("RS-094", "m")], 8), "player1", "XG2-028:h")).toBe(false);
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-028:h")).toBe(false);
  });

  const endBattle = (where: "rush" | "battle") =>
    settle(nextPhase(p1Battle({ [where]: [inst("XG2-028", "d")], discard: [inst("XG2-029", "minus"), inst("XG2-036", "minus2"), inst("RS-674", "plain"), inst("RS-679", "plus")] })));

  it.fails("XG2-028: 【マイナスエネルギー吸収】自軍ラッシュエリアにある間、自軍バトルフェイズを終えるとき、自軍捨札の必要パワーに「－」を持つカード（「7-」「14-」）から1枚選べる。「－」のない必要パワー（3・5+）のカードは選べない。任意（出典: atwiki/page-1797「自軍捨札から必要パワーに「－」を持つカードを1枚選び、これの下にウラ向きで重ねてもよい」） 既知の不具合: CARD-XG2-028 【マイナスエネルギー吸収】の選択が開かない", () => {
    const s = endBattle("rush");
    expectChoiceFrom(s, "player1", "XG2-028");
    expect(choiceIds(s)).toEqual(["XG2-029:minus", "XG2-036:minus2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-028: 【マイナスエネルギー吸収】選んだカードをこれの下にウラ向きで重ね、これは「SP+1」される（SP2）（出典: atwiki/page-1797「これは下に重なっているウラ向きのカード1枚につき「SP+1」される」） 既知の不具合: CARD-XG2-028 【マイナスエネルギー吸収】がなく、捨札のカードを重ねられない", () => {
    const s = settle(pick(endBattle("rush"), "XG2-029:minus"));
    expect(zoneOf(s, "player1", "XG2-029:minus")).toBeNull();
    const d = cardIn(s, "player1", "XG2-028:d");
    expect(d?.stackedCards?.map((c) => c.instanceId)).toEqual(["XG2-029:minus"]);
    expect(spOf(s, "player1", "XG2-028:d")).toBe(2);
  });

  it("XG2-028: 【マイナスエネルギー吸収】バトルエリアにあるときは発動しない（出典: atwiki/page-1797「これが自軍ラッシュエリアにある間」）", () => {
    const s = endBattle("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-028");
    expect(zoneOf(s, "player1", "XG2-029:minus")).toBe("discard");
  });

  it.fails("XG2-028: 【マイナスエネルギー吸収】下にウラ向きのカードが2枚あれば SP3 になる（出典: atwiki/page-1797・カード評価「5枚下に重ねれば…SP7になることも可能」） 既知の不具合: CARD-XG2-028 下に重なったウラ向きのカードで SP が上がらない", () => {
    const s = p1Battle({ battle: [withStacked(inst("XG2-028", "d"), [faceDown("XG2-029", "s1"), faceDown("XG2-036", "s2")])] });
    expect(spOf(s, "player1", "XG2-028:d")).toBe(3);
  });

  it.fails("XG2-028: 【マイナスエネルギー吸収】撃破されてユニットでなくなるとき、下に重ねたウラ向きのカードをすべて捨札にする（出典: atwiki/page-1797「これがユニットでなくなるとき、この下に重ねたウラ向きのカードをすべて捨札にする」） 既知の不具合: CARD-XG2-028 撃破されても下に重ねたカードが捨札にならない", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [withStacked(inst("XG2-028", "d"), [faceDown("XG2-029", "s1"), faceDown("XG2-036", "s2")])] }, "XG2-028:d"));
    expect(zoneOf(s, "player1", "XG2-028:d")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-029:s1")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-036:s2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-029 幽魔王サラマンデス", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【災魔ツリー】これが自軍エリアにある間、敵軍ユニットが撃破されたとき、自軍山札の上から1枚ひいて、これの下にウラ向きで重ねてもよい。これは下に重なっているウラ向きのカード1枚につきBP+500され、BP8000以上のとき、LユニットになりSP1を得る。これがユニットでなくなるとき、この下に重ねたウラ向きのカードから、ウラ向きのまま1枚選び手札に加えて、残りを捨札にする。";

  it("XG2-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-1798）", () => {
    expectCatalogText("XG2-029", TEXT);
    expectUnit("XG2-029", { name: "幽魔王サラマンデス", category: "DA", size: "S", bp: 6500, sp: "special", powerCost: "7-", features: ["災魔一族", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-029", ["NR"]);
  });

  zordDownTests("XG2-029", "RS-094", "龍冥王サラマンデス", "atwiki/page-1798", "DA");

  it("XG2-029: ※ 敵軍ターン中、SP1 以上のユニット（BP1000 の TST-UNIT-0）とバトルしたときは、バトルに勝っても撃破される（出典: atwiki/page-1798 ※）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-029", "y")] }, "XG2-029:y", {}, "TST-UNIT-0:atk"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-029:y")).toBe("discard");
  });

  it("XG2-029: ※ SP を持たないユニットとのバトルでは、勝てば残る（出典: atwiki/page-1798「SP1以上のユニットとバトルしたとき」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-029", "y")] }, "XG2-029:y", {}, "SPEC-NOSP:atk", [NOSP_ATTACKER]));
    expect(zoneOf(s, "player1", "XG2-029:y")).toBe("battle");
  });

  const killEnemy = () =>
    settle(attack(p1Battle({ battle: [inst("TST-UNIT-7", "big")], rush: [inst("XG2-029", "y")], deck: [inst("TST-OP", "top"), inst("TST-OP", "next")] }, { battle: [inst("TST-UNIT-0", "e")] }), "TST-UNIT-7:big", "TST-UNIT-0:e"));

  it.fails("XG2-029: 【災魔ツリー】自軍エリア（ラッシュエリア）にある間、敵軍ユニットが撃破されたとき、自軍山札の上から1枚をこれの下にウラ向きで重ねるかを選べる（任意）（出典: atwiki/page-1798「敵軍ユニットが撃破されたとき、自軍山札の上から1枚ひいて、これの下にウラ向きで重ねてもよい」） 既知の不具合: CARD-XG2-029 【災魔ツリー】の選択が開かない", () => {
    const s = killEnemy();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG2-029");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-029: 【災魔ツリー】重ねると、山札の一番上のカードがこれの下にウラ向きで重なり、BP+500（7000）される（出典: atwiki/page-1798「下に重なっているウラ向きのカード1枚につきBP+500され」） 既知の不具合: CARD-XG2-029 【災魔ツリー】がなく、山札のカードを重ねられない", () => {
    const s = settle(accept(killEnemy()));
    expect(cardIn(s, "player1", "XG2-029:y")?.stackedCards?.map((c) => c.instanceId)).toEqual(["TST-OP:top"]);
    expect(bpOf(s, "player1", "XG2-029:y")).toBe(7000);
  });

  it.fails("XG2-029: 【災魔ツリー】下にウラ向きのカードが1枚なら BP7000、3枚なら BP8000 になり、SP1 を得る（出典: atwiki/page-1798「BP8000以上のとき、LユニットになりSP1を得る」） 既知の不具合: CARD-XG2-029 下に重なったウラ向きのカードで BP が上がらず、SP1 も得ない", () => {
    const one = p1Battle({ battle: [withStacked(inst("XG2-029", "y"), [faceDown("TST-OP", "s0")])] });
    expect(bpOf(one, "player1", "XG2-029:y")).toBe(7000);
    expect(spOf(one, "player1", "XG2-029:y")).toBe(0);
    const three = p1Battle({ battle: [withStacked(inst("XG2-029", "y"), [faceDown("TST-OP", "s0"), faceDown("TST-OP", "s1"), faceDown("TST-OP", "s2")])] });
    expect(bpOf(three, "player1", "XG2-029:y")).toBe(8000);
    expect(spOf(three, "player1", "XG2-029:y")).toBe(1);
  });

  it.todo("XG2-029: 公式Q&A Q1（【災魔ツリー】以外の効果で BP8000 以上になっても L ユニットになり SP1 を得る）・Q2（RS-364 ヘルサターン総統とのループはターンプレイヤーが優先する効果を選ぶ）— 【災魔ツリー】の L ユニット化・SP1 がエンジンになく（上の it.fails）、効果の優先順を選ぶ合法手もないため、盤面を進められない（出典: atwiki/page-1798 Q1・Q2）");

  it.fails("XG2-029: 【災魔ツリー】撃破されてユニットでなくなるとき、下のウラ向きのカードから1枚選び（ウラ向きのまま）手札に加え、残りを捨札にする（出典: atwiki/page-1798「この下に重ねたウラ向きのカードから、ウラ向きのまま1枚選び手札に加えて、残りを捨札にする」） 既知の不具合: CARD-XG2-029 撃破されても下に重ねたカードを手札に加える選択がない", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [withStacked(inst("XG2-029", "y"), [faceDown("XG2-036", "s1"), faceDown("RS-674", "s2")])] }, "XG2-029:y"), ["RS-674:s2"]);
    expect(zoneOf(s, "player1", "XG2-029:y")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-674:s2")).toBe("hand");
    expect(zoneOf(s, "player1", "XG2-036:s1")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-031 デカマシン", () => {
  const TEXT = "【宇宙警察のバックアップ】これが自軍エリアにある間、特徴「警察」を持つユニットはBP+1000される。";

  it("XG2-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-1799）", () => {
    expectCatalogText("XG2-031", TEXT);
    expectUnit("XG2-031", { name: "デカマシン", category: "OT", size: "SC", bp: 6000, sp: undefined, powerCost: "6+", features: ["メカ", "車両", "航空機"], rushCondition: "send_s_unit_to_discard" });
    expectRarityIn("XG2-031", ["NR"]);
  });

  const board = (n: number, power = 6) =>
    rushBoard({ hand: [inst("XG2-031", "h")], rush: Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `u${i}`)), power: powerCards(power), command: releasedCat("OT", 1) });

  it("XG2-031: 追加条件 — 自軍 S ユニット5体を捨札にしてパワー6でラッシュできる（出典: atwiki/page-1799「追加条件：自軍Sユニット5体を捨札にする」「必要パワー：6+」）", () => {
    const r = rushFromHand(board(5), "player1", "XG2-031:h");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.players.player1.discard).toHaveLength(5);
    expect(zoneOf(r.state, "player1", "XG2-031:h")).toBe("rush");
  });

  it("XG2-031: 追加条件 — S ユニットが4体ではラッシュできない。パワー5でもできない（出典: atwiki/page-1799）", () => {
    expect(canStartRush(board(4), "player1", "XG2-031:h")).toBe(false);
    expect(canStartRush(board(5, 5), "player1", "XG2-031:h")).toBe(false);
  });

  const backup = () =>
    p1Battle({ rush: [inst("XG2-031", "dm")], battle: [inst("SPEC-POLICE-S", "p"), inst("TST-UNIT-0", "n")] }, { battle: [inst("SPEC-POLICE-S", "ep"), inst("XG2-033", "edb")] }, EXTRA);

  it.fails("XG2-031: 【宇宙警察のバックアップ】自軍エリア（ラッシュエリア）にある間、特徴「警察」を持つ自軍ユニットは BP+1000 される（出典: atwiki/page-1799） 既知の不具合: CARD-XG2-031 【宇宙警察のバックアップ】がなく、「警察」のユニットの BP が上がらない", () => {
    expect(bpOf(backup(), "player1", "SPEC-POLICE-S:p")).toBe(2000);
  });

  it.fails("XG2-031: 【宇宙警察のバックアップ】「自軍ユニット」の限定がないので、特徴「警察」を持つ敵軍ユニット（XG2-033 デカブライト等）も BP+1000 される（出典: atwiki/page-1799・カード評価「自軍敵軍の区別がないため、敵軍ユニットまでパンプしてしまう」・コメント「敵軍の特徴：警察持ちユニットにも適応される」） 既知の不具合: CARD-XG2-031 【宇宙警察のバックアップ】がなく、「警察」のユニットの BP が上がらない", () => {
    const s = backup();
    expect(bpOf(s, "player2", "SPEC-POLICE-S:ep")).toBe(2000);
    expect(bpOf(s, "player2", "XG2-033:edb")).toBe(3000);
  });

  it("XG2-031: 【宇宙警察のバックアップ】「警察」を持たないユニットの BP は変わらない（出典: atwiki/page-1799「特徴「警察」を持つユニットは」）", () => {
    expect(bpOf(backup(), "player1", "TST-UNIT-0:n")).toBe(1000);
  });
});

// ===========================================================================
describe("XG2-032 デカレンジャーロボ", () => {
  const TEXT = "【ジャイロワッパー】これが敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のパワーゾーンに送ってもよい。";

  it("XG2-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-1800）", () => {
    expectCatalogText("XG2-032", TEXT);
    expectUnit("XG2-032", { name: "デカレンジャーロボ", category: "OT", size: "L", bp: 17000, sp: 1, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG2-032", ["NR"]);
  });

  const board = (rush: CardInstance[], power = 7) => rushBoard({ hand: [inst("XG2-032", "h")], rush, power: powerCards(power), command: releasedCat("OT", 1) });

  it.fails("XG2-032: 追加条件 — 自軍「デカマシン」（XG2-031。SC ユニット）1体をパワーゾーンに送ってパワー7でラッシュできる（出典: atwiki/page-1800「追加条件：自軍「デカマシン」1体をパワーゾーンに送る」・カード評価「合体パーツがSCユニット１種で済む」） 既知の不具合: CARD-XG2-032 追加条件の「デカマシン」を素材に選べず、ラッシュできない", () => {
    const r = rushFromHand(board([inst("XG2-031", "dm")]), "player1", "XG2-032:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-031:dm")).toBe("power");
    expect(zoneOf(r.state, "player1", "XG2-032:h")).toBe("rush");
  });

  it("XG2-032: 追加条件 — 「デカマシン」でない S ユニットでは満たさない（出典: atwiki/page-1800）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-032:h")).toBe(false);
  });

  const attacking = (defender = "SPEC-BIG-L:e") =>
    attack(p1Battle({ battle: [inst("XG2-032", "r")] }, { battle: [inst("SPEC-BIG-L", "e"), inst("TST-UNIT-0", "e2")] }, EXTRA), "XG2-032:r", defender);

  it.fails("XG2-032: 【ジャイロワッパー】敵軍ユニットにアタックするとき、バトルの前にバトル相手を持ち主のパワーゾーンに送るかを選べる（任意）（出典: atwiki/page-1800「バトルの前にバトル相手のユニットを持ち主のパワーゾーンに送ってもよい」） 既知の不具合: CARD-XG2-032 【ジャイロワッパー】の選択がこれ自身を候補にし、見送れない", () => {
    const s = attacking();
    expectChoiceFrom(s, "player1", "XG2-032");
    expect(choiceIds(s)).toEqual(["SPEC-BIG-L:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-032: 【ジャイロワッパー】送ると、バトル相手（BP20000 の L ユニットでも）は持ち主のパワーゾーンにオモテ向きで置かれ、これはバトルエリアに残る（出典: atwiki/page-1800・カード評価「敵軍ユニットへのアタックにおいては絶対に敗北しない」） 既知の不具合: CARD-XG2-032 【ジャイロワッパー】でバトル相手をパワーゾーンに送れない", () => {
    const s = resolveAll(pick(attacking(), "SPEC-BIG-L:e"));
    expect(zoneOf(s, "player2", "SPEC-BIG-L:e")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-BIG-L:e")?.faceDown ?? false).toBe(false);
    expect(zoneOf(s, "player1", "XG2-032:r")).toBe("battle");
  });

  it.fails("XG2-032: 【ジャイロワッパー】送らなければ通常のバトルをする（BP1000 の相手は撃破される）（出典: atwiki/page-1800「送ってもよい」・Q1「通常のバトルを選択することは可能です」） 既知の不具合: CARD-XG2-032 【ジャイロワッパー】を見送れない", () => {
    const s = resolveAll(skip(attacking("TST-UNIT-0:e2")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("discard");
  });

  it.fails("XG2-032: 公式Q&A — 相手が RS-018 隠流忍術でバトル相手を変えたときは、変わったバトル相手をパワーゾーンに送る（出典: atwiki/page-1800 Q1「「RS-018 隠流忍術」の効果で変更されたバトル相手のユニットを、パワーゾーンに送ることになります」） 既知の不具合: CARD-XG2-032 【ジャイロワッパー】の選択がアタックしたときにこれ自身を候補にして開き、見送れず、変わったバトル相手も送れない", () => {
    let s = attack(
      p1Battle({ battle: [inst("XG2-032", "r")] }, { battle: [inst("SPEC-BIG-L", "e"), inst("TST-UNIT-0", "sub")], hand: [inst("RS-018", "c")], command: releasedCat("MA", 2), power: powerCards(5, "ep") }, EXTRA),
      "XG2-032:r",
      "SPEC-BIG-L:e",
    );
    if (s.pendingEffectChoice?.sourceCardId === "XG2-032") s = skip(s);
    expect(substitutes(s, "RS-018:c")).toContain("TST-UNIT-0:sub");
    s = useNinja(s, "RS-018:c", "TST-UNIT-0:sub");
    expectChoiceFrom(s, "player1", "XG2-032");
    s = resolveAll(pick(s, "TST-UNIT-0:sub"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:sub")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-BIG-L:e")).toBe("battle");
  });
});

// ===========================================================================
describe("XG2-033 デカブライト", () => {
  const TEXT =
    "※これが自軍パワーゾーンにある間、「デカブライト」以外の自軍パワーゾーンのカードは相手に選ばれない。 【防御拳バリアーフィスト】このユニットが自軍ラッシュエリアにある間、敵軍ターン中、自分がダメージを受けたとき、このユニットを ホールドしてもよい。そうしたとき、そのターン中、敵軍Sユニットはストライクすることができない。";

  it("XG2-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-133）", () => {
    expectCatalogText("XG2-033", TEXT);
    expectUnit("XG2-033", { name: "デカブライト", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 4, features: ["女", "警察", "特キョウ"] });
    expectRarityIn("XG2-033", ["R"]);
  });

  /** 敵軍（player2）が RS-102 五の槍サーガイン（CN5【暗黒二刀流・巌流剣】敵軍パワーゾーンからダメージになっていないカードを1枚選ぶ）を5番目に出す。 */
  const saagain = (power: CardInstance[]) => enemyNcEnter("RS-102:sg", 4, {}, { power, command: releasedCat("WB", 1) });

  it("XG2-033: 対照 — デカブライトがパワーゾーンになければ、相手の RS-102 五の槍サーガインはダメージになっていない自軍パワーゾーンのカードを選べる（出典: RS-102 本文）", () => {
    const s = saagain(powerCards(2));
    expectChoiceFrom(s, "player2", "RS-102");
    expect(choiceIds(s)).toEqual(["TST-P:pw0", "TST-P:pw1"]);
  });

  it.fails("XG2-033: ※ 自軍パワーゾーンにある間、「デカブライト」以外の自軍パワーゾーンのカードは相手に選ばれない（デカブライト自身は選ばれる）（出典: atwiki/page-133 ※・コメント「モモタロスなどのパワーゾーンにあってナンボのカードをシャイダーやゴーオンブラックから保護できる」） 既知の不具合: CARD-XG2-033 ※ がなく、相手の効果で「デカブライト」以外の自軍パワーゾーンのカードも選ばれる", () => {
    const s = saagain([inst("XG2-033", "db"), ...powerCards(2)]);
    expectChoiceFrom(s, "player2", "RS-102");
    expect(choiceIds(s)).toEqual(["XG2-033:db"]);
  });

  const damaged = () => settle(strike(enemyTurn({ rush: [inst("XG2-033", "b")], power: powerCards(3) }, { battle: [inst("TST-UNIT-0", "e"), inst("TST-UNIT-0", "e2")] }), "TST-UNIT-0:e", "player2"));

  it.fails("XG2-033: 【防御拳バリアーフィスト】自軍ラッシュエリアにある間、敵軍ターン中に自分がダメージを受けたとき、これをホールドするかを選べる（任意）（出典: atwiki/page-133「自分がダメージを受けたとき、このユニットを ホールドしてもよい」） 既知の不具合: CARD-XG2-033 【防御拳バリアーフィスト】の選択が開かない", () => {
    const s = damaged();
    expectChoiceFrom(s, "player1", "XG2-033");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-033: 【防御拳バリアーフィスト】ホールドすると、そのターン中、敵軍 S ユニットはストライクできない（出典: atwiki/page-133「そうしたとき、そのターン中、敵軍Sユニットはストライクすることができない」） 既知の不具合: CARD-XG2-033 【防御拳バリアーフィスト】がなく、ホールドできず、敵軍 S ユニットのストライクも止まらない", () => {
    const s = settle(accept(damaged()));
    expect(cardIn(s, "player1", "XG2-033:b")?.commandHeld).toBe(true);
    expect(canStrike(s, "TST-UNIT-0:e2", "player2")).toBe(false);
  });

  it("XG2-033: 【防御拳バリアーフィスト】ホールドしなければ、敵軍 S ユニットはストライクできる（出典: atwiki/page-133「してもよい。そうしたとき」）", () => {
    let s = damaged();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-033") s = settle(skip(s));
    expect(canStrike(passEntry(s, "player2"), "TST-UNIT-0:e2", "player2")).toBe(true);
  });
});

// ===========================================================================
describe("XG2-034 ブラストバギー", () => {
  const TEXT =
    "【奇襲】これが自軍エリアにある間、ブラストの効果は次のルールに変更される⇒自分がゲームに負けるまで残りダメージ1点または2点で、自軍Lユニットが1体もなければ、これの追加条件は満たさなくてもよい。";

  it("XG2-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-1801）", () => {
    expectCatalogText("XG2-034", TEXT);
    expectUnit("XG2-034", { name: "ブラストバギー", category: "OT", size: "M", bp: 3000, sp: undefined, powerCost: "2+", features: ["メカ", "車両"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG2-034", ["N"]);
  });

  const board = (power = 2) => rushBoard({ hand: [inst("XG2-034", "h")], rush: [inst("TST-UNIT-0", "u")], power: powerCards(power), command: releasedCat("OT", 1) });

  it("XG2-034: 追加条件 — 自軍 S ユニット1体をパワーゾーンに送ってパワー2でラッシュできる。パワー1ではできない（出典: atwiki/page-1801「追加条件：自軍Sユニット1体をパワーゾーンに送る」「必要パワー：2+」・カード評価「序盤のパワー加速にも利用可能」）", () => {
    const r = rushFromHand(board(), "player1", "XG2-034:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:u")).toBe("power");
    expect(canStartRush(board(1), "player1", "XG2-034:h")).toBe(false);
  });

  const blast = (rush: CardInstance[]) =>
    rushBoard({ hand: [inst("XG2-035", "fc")], rush, power: [...damageCards(5), ...powerCards(4)], damage: 5, command: releasedCat("OT", 1) });

  it("XG2-034: 【奇襲】自軍エリアにある間、残りダメージ2点（ダメージ5点）で自軍 L ユニットがなければ、ブラストを持つ XG2-035 デカレンジャーロボFC を追加条件なしでラッシュできる。なければできない（出典: atwiki/page-1801・R-KW-BLAST-02）", () => {
    expect(canStartRush(blast([inst("XG2-034", "bg")]), "player1", "XG2-035:fc")).toBe(true);
    expect(canStartRush(blast([inst("TST-UNIT-0", "u")]), "player1", "XG2-035:fc")).toBe(false);
  });
});

