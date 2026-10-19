/**
 * カード別スペック: XG2-069〜XG2-074（クロスギャザー ザ・ドラゴンタイガー 仮面ライダーNEW電王SF〜クウガゴウラム）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-069」〜「XG2-074」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-070 Q1・Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01・R-KW-RESIST-01・R-KW-MORPH-01〜03・R-CAT-02・R-ZONE-08「コマンドゾーンは5枚まで」）・
 *     atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-074 クウガゴウラムの追加条件の合法手は rules/zordExtended.test.ts（「仮面ライダークウガ」を手札に戻す形の合法手が出ること）。
 *  - XG2-069 と同じ本文の XP-007 は cardSpec/XP-001-016.b.test.ts。
 */
import { describe, expect, it } from "vitest";
import {
  attack,
  attackTargets,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  inst,
  isDamageIn,
  isHeld,
  morphCandidates,
  morphRush,
  mount,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  pickAs,
  PLAIN_VEHICLE,
  playOp,
  powerCards,
  rcBoard,
  registerOffered,
  releasedCat,
  releasedN,
  resident,
  resolveAll,
  rideOff,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  st,
  stackedOn,
  sUnit,
  zoneOf,
} from "./XG2-062-081.helpers";

const E2 = sUnit("SPEC-E2", { bp: 1000, powerCost: 2 });
const E3 = sUnit("SPEC-E3", { bp: 1000, powerCost: 3 });
const B8000 = sUnit("SPEC-B8000", { bp: 8000 });
const B9000 = sUnit("SPEC-B9000", { bp: 9000 });
const B4000 = sUnit("SPEC-B4000", { bp: 4000 });
const B3000 = sUnit("SPEC-B3000", { bp: 3000 });
const RIDER = sUnit("SPEC-RIDER", { bp: 2000, comboNumber: "RC" });
const POLICE = sUnit("SPEC-POLICE", { bp: 1000, features: ["警察"] });
const EXTRA = [E2, E3, B8000, B9000, B4000, B3000, RIDER, POLICE, PLAIN_VEHICLE];

// ===========================================================================
describe("XG2-069 仮面ライダーNEW電王SF", () => {
  const TEXT =
    "※これはアタックすることができない。 【カウント】数字を1つ宣言してもよい。そうしたとき、自軍山札の上から1枚をオモテにする。オモテにしたカードの必要パワーの数字が宣言した数字以上なら、宣言した数字と同じ必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。その後、オモテにしたカードは山札の下に戻す。";

  it("XG2-069: カタログ本文・スペックが出典と一致（出典: atwiki/page-1723）", () => {
    expectCatalogText("XG2-069", TEXT);
    expectUnit("XG2-069", { name: "仮面ライダーNEW電王SF", category: "OT", size: "S", bp: 6000, sp: "1/4", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "NEWDEN-O"] });
    expectRarityIn("XG2-069", ["SR"]);
  });

  it("XG2-069: ※ アタックすることができない（出典: atwiki/page-1723「※これはアタックすることができない」）", () => {
    const s = passEntry(enter(st({ player1: { rush: [inst("XG2-069", "sf")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }), "XG2-069:sf"));
    expect(attackTargets(s, "XG2-069:sf")).toEqual([]);
  });

  const count = (top = inst("SPEC-E3", "top")) =>
    rcBoard("XG2-069:sf", { deck: [top, ...deckCards(3)] }, { battle: [inst("SPEC-E3", "e3")], rush: [inst("SPEC-E2", "e2"), inst("TST-UNIT-7", "big")] }, EXTRA);

  it("XG2-069: 【カウント】RC — 数字を1つ宣言できる（任意）（出典: atwiki/page-1723「数字を1つ宣言してもよい」）", () => {
    const s = count();
    expectChoiceFrom(s, "player1", "XG2-069");
    expect(choiceIds(s)).toContain("3");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-069: 【カウント】オモテにしたカードの必要パワー（3）が宣言（3）以上なら、必要パワーの数字が3の敵軍ユニットを選びパワーゾーンに送る。オモテにしたカードは山札の下に戻る（出典: atwiki/page-1723・カード評価「除去対象のサイズ・エリアを問わない」）", () => {
    let s = pick(count(), "3");
    expect(choiceIds(s)).toEqual(["SPEC-E3:e3"]);
    s = resolveAll(pick(s, "SPEC-E3:e3"));
    expect(zoneOf(s, "player2", "SPEC-E3:e3")).toBe("power");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-E3:top");
  });

  it("XG2-069: 【カウント】宣言（2）と同じ必要パワーの数字なら、敵軍ラッシュエリアのユニットも選べる（出典: atwiki/page-1723「敵軍ユニットを1体選び」）", () => {
    expect(choiceIds(pick(count(), "2"))).toEqual(["SPEC-E2:e2"]);
  });

  it("XG2-069: 【カウント】オモテにしたカードの必要パワー（3）が宣言（4）より小さければ何も送らない（オモテにしたカードは山札の下）（出典: atwiki/page-1723「宣言した数字以上なら」）", () => {
    const s = resolveAll(pick(count(), "4"));
    expect(zoneOf(s, "player2", "SPEC-E3:e3")).toBe("battle");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-E3:top");
  });

  it.fails("XG2-069: 【カウント】必要パワー「7+」の敵軍ユニットは数字7として選べる（オモテにしたカードも「7+」）（出典: atwiki/page-1723「必要パワーの数字」・カード評価「高めのパワーのカードを積んでいれば、Lユニットなども除去してくれる」） 既知の不具合: CARD-XG2-069 必要パワー「7+」を数字7として扱わず、7を宣言しても候補が出ない", () => {
    expect(choiceIds(pick(count(inst("TST-UNIT-7", "top7")), "7"))).toEqual(["TST-UNIT-7:big"]);
  });
});

// ===========================================================================
describe("XG2-070 ライドブッカー・ブックモード", () => {
  const TEXT =
    "※常駐 これを配置するとき、自軍山札からモーフを持つユニットカードを3枚まで選び、相手に見せてからこれに重ねて置いた後、山札をシャッフルする。これが自軍常駐置き場にある間、モーフの効果で自軍コマンドゾーンか自軍パワーゾーンのオモテ向きのカードからユニットカードを選ぶとき、かわりにこれに重ねたカードから選んでもよい。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  it("XG2-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-1774）", () => {
    expectCatalogText("XG2-070", TEXT);
    expectOpStats("XG2-070", { name: "ライドブッカー・ブックモード", category: "OT", powerCost: 4 });
    expectRarityIn("XG2-070", ["N"]);
  });

  /** 自軍山札: モーフを持つユニットカード4枚（XG2-043・044・045・077）と、モーフを持たない XG2-066。 */
  const placed = () => {
    const s = st({ phase: "rush", player1: { hand: [inst("XG2-070", "rb")], command: releasedCat("OT", 1), power: powerCards(4), deck: [inst("XG2-043", "m1"), inst("XG2-044", "m2"), inst("XG2-045", "m3"), inst("XG2-077", "m4"), inst("XG2-066", "nm"), ...deckCards(2)] }, player2: { deck: deckCards(3, "e") } });
    const r = playOp(s, "player1", "XG2-070:rb");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG2-070: ※常駐 — 使うと自軍常駐置き場に配置される（出典: atwiki/page-1774「※常駐」）", () => {
    expect(zoneOf(resolveAll(placed()), "player1", "XG2-070:rb")).toBe("operation");
  });

  it.fails("XG2-070: 配置するとき、自軍山札のモーフを持つユニットカードから選べる（モーフを持たない XG2-066 は選べない）（出典: atwiki/page-1774「自軍山札からモーフを持つユニットカードを3枚まで選び」・カード評価「モーフ対象を一気にサーチ」） 既知の不具合: CARD-XG2-070 配置するときの選択が開かず、山札のカードを重ねられない", () => {
    const s = placed();
    expectChoiceFrom(s, "player1", "XG2-070");
    expect(choiceIds(s).sort()).toEqual(["XG2-043:m1", "XG2-044:m2", "XG2-045:m3", "XG2-077:m4"]);
  });

  it.fails("XG2-070: 選んだカード（3枚まで）はこれに重ねて置かれ、山札から抜ける（出典: atwiki/page-1774「これに重ねて置いた後、山札をシャッフルする」） 既知の不具合: CARD-XG2-070 配置するときの選択が開かず、山札のカードを重ねられない", () => {
    const s = resolveAll(placed(), ["XG2-043:m1", "XG2-044:m2", "XG2-045:m3"]);
    expect(stackedOn(s, "player1", "XG2-070:rb").sort()).toEqual(["XG2-043:m1", "XG2-044:m2", "XG2-045:m3"]);
    expect(zoneOf(s, "player1", "XG2-077:m4")).toBe("deck");
  });

  const morphed = () => morphRush({ battle: [inst("XG2-043", "me")], operation: [resident("XG2-070", "rb", [inst("XG2-049", "st0"), inst("XG2-045", "st1"), inst("XG2-044", "st2")])] });

  it.fails("XG2-070: これが常駐置き場にある間、モーフの置き換え先を、これに重ねたカード（特徴が完全一致する XG2-045）から選べる（出典: atwiki/page-1774「かわりにこれに重ねたカードから選んでもよい」・R-KW-MORPH-03） 既知の不具合: CARD-XG2-070 モーフの置き換え先に、これに重ねたカードが出ない", () => {
    expect(morphCandidates(morphed())).toEqual(["XG2-045:st1"]);
  });

  it.fails("XG2-070: 公式Q&A — 重ねたカードとモーフすると、そのカードがバトルエリアに出て、モーフしたユニットは常駐置き場の同じ位置（上から2番目）に重なる（出典: atwiki/page-1774 Q1「ユニットは常駐置き場に置かれ、常駐置き場のカードがラッシュされます」・Q2「置き換えたカードと同じ位置…に置いてください」） 既知の不具合: CARD-XG2-070 モーフの置き換え先に、これに重ねたカードが出ない", () => {
    const s = settle(pickAs(morphed(), "player1", "XG2-045:st1"));
    expect(zoneOf(s, "player1", "XG2-045:st1")).toBe("battle");
    expect(stackedOn(s, "player1", "XG2-070:rb")).toEqual(["XG2-049:st0", "XG2-043:me", "XG2-044:st2"]);
  });

  it.todo("XG2-070: これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる — 常駐オペレーションを常駐置き場から離す手順（相手の除去効果など）を、重ねたカードがある状態で公開 API だけでは用意できていない（出典: atwiki/page-1774「これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる」）");
});

// ===========================================================================
describe("XG2-071 仮面ライダーディエンド", () => {
  const TEXT =
    "※これは敵軍Sユニットにアタックされない。 【ディメンションシュート】自軍ターン中、これがバトルエリアに出たとき、これ以外の特徴「仮面ライダー」を持つ自軍ユニットを2体選び、パワーゾーンに送ってもよい。そうしたとき、本来のBPが8000以下の敵軍ユニットを1体選び撃破する。";

  it("XG2-071: カタログ本文・スペックが出典と一致（出典: atwiki/page-1819）", () => {
    expectCatalogText("XG2-071", TEXT);
    expectUnit("XG2-071", { name: "仮面ライダーディエンド", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 3, features: ["仮面ライダー", "男", "ディエンドライバー"] });
    expectRarityIn("XG2-071", ["SR"]);
  });

  it("XG2-071: ※ 敵軍 S ユニットにはアタックされない。M ユニットにはアタックされる（出典: atwiki/page-1819「これは敵軍Sユニットにアタックされない」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG2-071", "de")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-2", "m")], deck: deckCards(3, "e") } });
    expect(attackTargets(s, "TST-UNIT-0:s", "player2")).toEqual([]);
    expect(attackTargets(s, "TST-UNIT-2:m", "player2")).toEqual(["XG2-071:de"]);
  });

  /** 自軍: バトルエリアに XG2-063 響鬼、ラッシュエリアに XG2-073 クウガと「仮面ライダー」を持たない TST-UNIT-0。敵軍: 本来の BP8000・9000（バトル）、8000（ラッシュ）。 */
  const shoot = (p1Riders = true) =>
    ncEnter(
      "XG2-071:de",
      0,
      p1Riders ? { battle: [inst("XG2-063", "k1")], rush: [inst("XG2-073", "k2"), inst("TST-UNIT-0", "nr")] } : {},
      { battle: [inst("SPEC-B8000", "b8"), inst("SPEC-B9000", "b9")], rush: [inst("SPEC-B8000", "r8")] },
      EXTRA,
    );

  it.fails("XG2-071: 【ディメンションシュート】まず、これ以外の特徴「仮面ライダー」を持つ自軍ユニット（エリアを問わない）を2体選ぶ（任意。「仮面ライダー」を持たないユニットは選べない）（出典: atwiki/page-1819「これ以外の特徴「仮面ライダー」を持つ自軍ユニットを2体選び、パワーゾーンに送ってもよい」・カード評価「コストでパワーゾーンに送るユニットの居る場所は問わない」） 既知の不具合: CARD-XG2-071 自軍ユニットを2体パワーゾーンに送る手順がなく、すぐに敵軍ユニットを選ばせる", () => {
    const s = shoot();
    expectChoiceFrom(s, "player1", "XG2-071");
    expect(choiceIds(s).sort()).toEqual(["XG2-063:k1", "XG2-073:k2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-071: 【ディメンションシュート】2体をパワーゾーンに送ったら、本来の BP が8000以下の敵軍ユニット（ラッシュエリアも）を1体選び撃破する。BP9000 は選べない（出典: atwiki/page-1819「そうしたとき、本来のBPが8000以下の敵軍ユニットを1体選び撃破する」・カード評価「サイズ・エリアを問わず本来のBPが8000以下のユニットを除去できる」） 既知の不具合: CARD-XG2-071 自軍ユニットを2体パワーゾーンに送る手順がなく、敵軍バトルエリアのユニットだけを、本来の BP を見ずに候補にする", () => {
    let s = resolveAll(shoot(), ["XG2-063:k1", "XG2-073:k2"]);
    expect(zoneOf(s, "player1", "XG2-063:k1")).toBe("power");
    expect(zoneOf(s, "player1", "XG2-073:k2")).toBe("power");
    s = shoot();
    s = pick(pick(s, "XG2-063:k1"), "XG2-073:k2");
    expect(choiceIds(s).sort()).toEqual(["SPEC-B8000:b8", "SPEC-B8000:r8"]);
    s = resolveAll(pick(s, "SPEC-B8000:r8"));
    expect(zoneOf(s, "player2", "SPEC-B8000:r8")).toBe("discard");
  });

  it.fails("XG2-071: 【ディメンションシュート】送らないことを選んだとき・「仮面ライダー」を持つ自軍ユニットが2体いないときは、敵軍ユニットを撃破しない（出典: atwiki/page-1819「そうしたとき、」） 既知の不具合: CARD-XG2-071 自軍ユニットを送らなくても敵軍ユニットを撃破できる", () => {
    const s = resolveAll(shoot(false), ["SPEC-B8000:b8"]);
    expect(zoneOf(s, "player2", "SPEC-B8000:b8")).toBe("battle");
  });

  it("XG2-071: 【ディメンションシュート】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1819「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG2-071:de", { battle: [inst("XG2-063", "k1"), inst("XG2-073", "k2")] }, { battle: [inst("SPEC-B8000", "e8")] }, EXTRA);
    expect(zoneOf(s, "player1", "XG2-071:de")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-071");
  });
});

// ===========================================================================
describe("XG2-072 トライゴウラム", () => {
  const TEXT =
    "※これにライドしているユニットはBP+1500される。 【トライゴウラムアタック】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ、持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-072: カタログ本文・スペックが出典と一致（出典: atwiki/page-1810）", () => {
    expectCatalogText("XG2-072", TEXT);
    expectVehicle("XG2-072", { name: "トライゴウラム", category: ["ET", "MA"], powerCost: "3+", size: "S", features: ["メカ", "車両", "昆虫"], rushCondition: "discard_vehicle_unit" });
    expectRarityIn("XG2-072", ["NR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], command = [...releasedCat("ET", 1), ...releasedCat("MA", 1)]) =>
    rushBoard({ hand: [inst("XG2-072", "tg")], rush, power: powerCards(3), command });

  it("XG2-072: 追加条件 — 自軍ビークル（RS-466 ギンガレオン）1体を捨札にするか、コマンドゾーンに送ってラッシュできる（出典: atwiki/page-1810「追加条件：自軍ビークル1体をコマンドゾーンに送るか捨札にする」・カード評価「素材ビークルは何でもよく」）", () => {
    const d = rushFromHand(board([inst("RS-466", "v")]), "player1", "XG2-072:tg", { destination: "discard" });
    expect(d.ok, d.error).toBe(true);
    expect(zoneOf(resolveAll(d.state), "player1", "RS-466:v")).toBe("discard");
    const c = rushFromHand(board([inst("RS-466", "v")]), "player1", "XG2-072:tg", { destination: "command" });
    expect(c.ok, c.error).toBe(true);
    expect(zoneOf(resolveAll(c.state), "player1", "RS-466:v")).toBe("command");
    expect(zoneOf(resolveAll(c.state), "player1", "XG2-072:tg")).toBe("rush");
  });

  it("XG2-072: 追加条件 — 自軍ビークルがなければラッシュできない。マルチカテゴリなので ET と MA の両方のコマンドが要る（出典: atwiki/page-1810・R-CAT-02）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-072:tg")).toBe(false);
    expect(canStartRush(board([inst("RS-466", "v")], releasedCat("ET", 2)), "player1", "XG2-072:tg")).toBe(false);
  });

  /** RC を持つ SPEC-RIDER（BP2000）がこれにライドしてバトルエリアに出る（ライドオフの選択は残す）。 */
  const mounted = (p2: Parameters<typeof p1Battle>[1] = { battle: [inst("TST-UNIT-0", "e"), inst("TST-UNIT-2", "m")] }) =>
    mount(p1Battle({ rush: [inst("SPEC-RIDER", "r"), inst("XG2-072", "tg")] }, p2, EXTRA), "SPEC-RIDER:r", "XG2-072:tg");

  it("XG2-072: ※ これにライドしているユニットは BP+1500（2000→3500）（出典: atwiki/page-1810「これにライドしているユニットはBP+1500される」）", () => {
    expect(bpOf(rideOff(mounted(), false), "player1", "SPEC-RIDER:r")).toBe(3500);
  });

  it.fails("XG2-072: 【トライゴウラムアタック】自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの S ユニットを選ぶ（必ず。M ユニットは選べない）（出典: atwiki/page-1810「敵軍バトルエリアからSユニットを1体選び」） 既知の不具合: CARD-XG2-072 【トライゴウラムアタック】がなく、バトルエリアに出ても選択が開かない", () => {
    const s = rideOff(mounted(), false);
    expectChoiceFrom(s, "player1", "XG2-072");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG2-072: 【トライゴウラムアタック】選んだユニットを持ち主のコマンドゾーンにホールド状態で置く（ライドオフしたときも、これはバトルエリアに出ている）（出典: atwiki/page-1810「持ち主のコマンドゾーンにホールド状態で置く」・カード評価「RCを発動しても乗せっぱなしでも強い」） 既知の不具合: CARD-XG2-072 【トライゴウラムアタック】がなく、バトルエリアに出ても選択が開かない", () => {
    const s = resolveAll(rideOff(mounted(), true), ["TST-UNIT-0:e"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("command");
    expect(isHeld(s, "player2", "TST-UNIT-0:e")).toBe(true);
  });

  it.fails("XG2-072: 【トライゴウラムアタック】敵軍コマンドゾーンが5枚で置けなければ、持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1810「置けなければ、持ち主のパワーゾーンにダメージにして置く」・R-ZONE-08） 既知の不具合: CARD-XG2-072 【トライゴウラムアタック】がなく、バトルエリアに出ても選択が開かない", () => {
    const s = resolveAll(rideOff(mounted({ battle: [inst("TST-UNIT-0", "e")], command: releasedN(5, "TST-OP", "ec") }), false), ["TST-UNIT-0:e"]);
    expect(isDamageIn(s, "player2", "TST-UNIT-0:e")).toBe(true);
  });
});

// ===========================================================================
describe("XG2-073 仮面ライダークウガ", () => {
  const TEXT =
    "※レジスト 【笑顔の為に】自軍ラッシュエリアから特徴「警察」を持つSユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、このターン、これとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-073: カタログ本文・スペックが出典と一致（出典: atwiki/page-1743）", () => {
    expectCatalogText("XG2-073", TEXT);
    expectUnit("XG2-073", { name: "仮面ライダークウガ", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "アマダム"] });
    expectRarityIn("XG2-073", ["N"]);
  });

  it("XG2-073: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-1743「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-073", "u")] }, "XG2-073:u"))).toBe(true);
  });

  const smile = () => rcBoard("XG2-073:kg", { rush: [inst("SPEC-POLICE", "pol"), inst("TST-UNIT-0", "np")] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA);

  it.fails("XG2-073: 【笑顔の為に】RC — 自軍ラッシュエリアの特徴「警察」を持つ S ユニットから選べる（任意。「警察」を持たないユニットは選べない）（出典: atwiki/page-1743「自軍ラッシュエリアから特徴「警察」を持つSユニットを1体選び、持ち主の手札に戻してもよい」） 既知の不具合: CARD-XG2-073 特徴「警察」を見ず、自軍ラッシュエリアのどの S ユニットでも選べる", () => {
    const s = smile();
    expectChoiceFrom(s, "player1", "XG2-073");
    expect(choiceIds(s)).toEqual(["SPEC-POLICE:pol"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-073: 【笑顔の為に】選んだユニットは持ち主の手札に戻る（出典: atwiki/page-1743）", () => {
    const s = resolveAll(pick(smile(), "SPEC-POLICE:pol"));
    expect(zoneOf(s, "player1", "SPEC-POLICE:pol")).toBe("hand");
  });

  it.fails("XG2-073: 【笑顔の為に】戻したターン、これとバトルして撃破され捨札になったユニットは、持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-1743「このターン、これとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く」） 既知の不具合: CARD-XG2-073 【笑顔の為に】の後半がなく、これとバトルして撃破されたユニットは捨札のまま", () => {
    let s = resolveAll(pick(smile(), "SPEC-POLICE:pol"));
    s = resolveAll(settle(attack(s, "XG2-073:kg", "TST-UNIT-0:e")));
    expect(isDamageIn(s, "player2", "TST-UNIT-0:e")).toBe(true);
  });

  it("XG2-073: 【笑顔の為に】戻さなかったときは、これとバトルして撃破されたユニットは捨札になる（出典: atwiki/page-1743「そうしたとき、」）", () => {
    let s = resolveAll(skip(smile()));
    s = resolveAll(settle(attack(s, "XG2-073:kg", "TST-UNIT-0:e")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-074 クウガゴウラム", () => {
  const TEXT =
    "※自分が「仮面ライダークウガ」をラッシュしたとき、自軍エリアに「クウガゴウラム」があれば1体選んで手札に戻す。 ※これは、自軍「仮面ライダーディケイド」があれば、ライドされていなくてもバトルエリアに出ることができる。 【ファイナルアタックライド 】自軍ターン中、これがバトルエリアに出たとき、BP4000以上の敵軍Sユニットを1体選び撃破してもよい。";

  it("XG2-074: カタログ本文・スペックが出典と一致（出典: atwiki/page-1775）", () => {
    expectCatalogText("XG2-074", TEXT);
    expectVehicle("XG2-074", { name: "クウガゴウラム", category: "MA", powerCost: "5+", size: "S", features: ["昆虫", "アマダム", "FFR"], rushCondition: "return_named_to_hand" });
    expectRarityIn("XG2-074", ["NR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 5) => rushBoard({ hand: [inst("XG2-074", "kg")], rush, power: powerCards(power), command: releasedCat("MA", 1) });

  it.fails("XG2-074: 追加条件 — 自軍「仮面ライダークウガ」（XG2-073）1体を手札に戻し、パワー5でラッシュできる（出典: atwiki/page-1775「必要パワー：5+」「追加条件：自軍「仮面ライダークウガ」1体を手札に戻す」・カード評価「本編を再現して、仮面ライダーからゾードアップする珍しいビークル」） 既知の不具合: CARD-XG2-074 「仮面ライダークウガ」がいても、これをラッシュする手がない", () => {
    const r = rushFromHand(board([inst("XG2-073", "ku")]), "player1", "XG2-074:kg");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG2-074:kg")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-073:ku")).toBe("hand");
  });

  it("XG2-074: 追加条件 — 「仮面ライダークウガ」がいなければ、パワーが足りてもラッシュできない（出典: atwiki/page-1775）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-074:kg")).toBe(false);
  });

  it("XG2-074: ※1つ目 — 自分が「仮面ライダークウガ」をラッシュしたとき、自軍エリアの「クウガゴウラム」を1体選んで手札に戻す（必ず）（出典: atwiki/page-1775「自軍エリアに「クウガゴウラム」があれば1体選んで手札に戻す」・カード評価「変形前の姿に戻ることもできる」）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG2-073", "ku")], rush: [inst("XG2-074", "kg")], power: powerCards(3), command: releasedCat("MA", 1) }), "player1", "XG2-073:ku");
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG2-074");
    expect(canSkip(r.state)).toBe(false);
    expect(zoneOf(resolveAll(r.state), "player1", "XG2-074:kg")).toBe("hand");
  });

  it.fails("XG2-074: ※2つ目 — 自軍に「仮面ライダーディケイド」（XG2-077）があれば、ライドされていなくてもバトルエリアに出られる（出典: atwiki/page-1775「自軍「仮面ライダーディケイド」があれば、ライドされていなくてもバトルエリアに出ることができる」・コメント欄「『仮面ライダーディケイド』が自軍ラッシュエリアにいて…クウガゴウラムだけで出られる」） 既知の不具合: CARD-XG2-074 自軍に「仮面ライダーディケイド」があっても、ライドされずにバトルエリアに出られない", () => {
    expect(canEnter(p1Battle({ rush: [inst("XG2-074", "kg"), inst("XG2-077", "dc")] }), "XG2-074:kg")).toBe(true);
  });

  it("XG2-074: ※2つ目 — 「仮面ライダーディケイド」がなければ、ライドされずにバトルエリアに出られない（出典: atwiki/page-1775）", () => {
    expect(canEnter(p1Battle({ rush: [inst("XG2-074", "kg")] }), "XG2-074:kg")).toBe(false);
  });

  const far = () =>
    rideOff(mount(p1Battle({ rush: [inst("SPEC-RIDER", "r"), inst("XG2-074", "kg")] }, { battle: [inst("SPEC-B4000", "b4"), inst("SPEC-B3000", "b3"), inst("TST-UNIT-2", "m")] }, EXTRA), "SPEC-RIDER:r", "XG2-074:kg"), false);

  it.fails("XG2-074: 【ファイナルアタックライド】自軍ターン中にバトルエリアに出たとき、BP4000 以上の敵軍 S ユニットを1体選べる（任意。BP3000・M ユニットは選べない）（出典: atwiki/page-1775「BP4000以上の敵軍Sユニットを1体選び撃破してもよい」） 既知の不具合: CARD-XG2-074 【ファイナルアタックライド】がなく、バトルエリアに出ても選択が開かない", () => {
    const s = far();
    expectChoiceFrom(s, "player1", "XG2-074");
    expect(choiceIds(s)).toEqual(["SPEC-B4000:b4"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-074: 【ファイナルアタックライド】選んだユニットを撃破する（出典: atwiki/page-1775） 既知の不具合: CARD-XG2-074 【ファイナルアタックライド】がなく、バトルエリアに出ても選択が開かない", () => {
    const s = resolveAll(far(), ["SPEC-B4000:b4"]);
    expect(zoneOf(s, "player2", "SPEC-B4000:b4")).toBe("discard");
  });
});
