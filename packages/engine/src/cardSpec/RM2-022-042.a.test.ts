/**
 * カード別スペック: RM-022〜RM-028（スペシャルメタルエディション サイバリアン〜モトシャリアン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜3・rider.html）は
 *     「RM-022」〜「RM-028」とカード名で検索して、card_8 の RS-558 ガンマジン Q3 に RM-023 スクーパーが出てくるだけ。
 *     本範囲のカードページに atwiki 転載の公式 Q&A はない（各ページの「Q&A」節なし）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-CHASE-01・R-KW-RC-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマルレア／ノーマル」を SR／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - チェイスそのもの（R-KW-CHASE-01・02）は rulesSpec/07-chase.test.ts。
 *  - RM-026 の「S ユニットにアタックできない」の汎用の判定は rsCoreEffects.unnamedRules.test.ts（cannot_attack_s）。ここではカードとして確かめる。
 *  - RM-002 赤射で山札から出す「宇宙刑事シャリバン」（RM-025）は RM1-001-021.a で照合済み。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  attack,
  bpOf,
  canMount,
  canSkip,
  canStartRush,
  cardIn,
  chaseTargets,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  inst,
  mount,
  pick,
  powerCards,
  rcUnit,
  releasedCat,
  resolveAll,
  rideOff,
  rideOffOffered,
  ridingPair,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  vehicleCard,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM2-022-042.helpers";

const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const E3000B = sUnit("SPEC-E3000B", { bp: 3000 });
const EM3000 = sUnit("SPEC-EM3000", { bp: 3000, size: "M" });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const ES = sUnit("SPEC-ES", { bp: 1000 });
const RC_OT = rcUnit("SPEC-RC", { category: "OT" });
const CAR_S = sUnit("SPEC-CAR-S", { category: "OT", bp: 1000, features: ["メカ", "車両"] });
const CAR_M = sUnit("SPEC-CAR-M", { category: "OT", bp: 3000, size: "M", features: ["メカ", "車両"] });
const NOT_CAR = sUnit("SPEC-NOT-CAR", { category: "OT", bp: 1000, features: ["メカ"] });
const VEHICLE2 = vehicleCard("SPEC-VEHICLE2");
const NOT_COP = sUnit("SPEC-NOT-COP", { category: "OT", bp: 1000, powerCost: 3, features: ["メカ", "男"] });
const EXTRA = [E4000, E3000, E3000B, EM3000, EM, ES, RC_OT, CAR_S, CAR_M, NOT_CAR, VEHICLE2, NOT_COP, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battleBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RM-022 サイバリアン", () => {
  const TEXT =
    "【サイバリアンレーザースピード】自軍ターン中、これがバトルエリアに出たとき、OTを持つ自軍コマンドを2つホールドしてもよい。そうしたとき、これにライドしているユニットは、このターン、ライドオフしなくてもＲＣの効果を発動できる。";

  /** 自軍バトルフェイズ、宇宙刑事ギャバン（RC【ギャバンダイナミック】）がサイバリアンにライドしてバトルエリアに出る（ビークルの効果の選択まで）。 */
  const mounted = (command = [...releasedCat("OT", 2), ...releasedCat("WB", 1)]) =>
    mount(battleBoard({ rush: [inst("RM-018", "g"), inst("RM-022", "v"), inst("SPEC-EM", "m")], command }, { rush: [inst("SPEC-E4000", "e")] }), "RM-018:g", "RM-022:v");

  it("RM-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-837）", () => {
    expectCatalogText("RM-022", TEXT);
    expectVehicleStats("RM-022", { name: "サイバリアン", category: "OT", powerCost: 4, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RM-022", ["N"]);
  });

  it("RM-022: 自軍ターン中、ライドされてバトルエリアに出たとき、OT の自軍コマンドを2つホールドするかを選べる（任意）（出典: atwiki/page-837「自軍ターン中、これがバトルエリアに出たとき、OTを持つ自軍コマンドを2つホールドしてもよい」）", () => {
    const s = mounted();
    expectChoiceFrom(s, "player1", "RM-022");
    expect(canSkip(s)).toBe(true);
  });

  it("RM-022: ホールドすると OT の自軍コマンドが2つホールド状態になる（ほかのカテゴリのコマンドはそのまま）（出典: atwiki/page-837）", () => {
    const s = accept(mounted());
    const command = s.players.player1.command;
    expect(command.filter((c) => c.cardId === "TST-OP-OT").every((c) => c.commandHeld)).toBe(true);
    expect(command.filter((c) => c.cardId === "TST-OP").every((c) => !c.commandHeld)).toBe(true);
  });

  it("RM-022: ホールドしたら、ライドしているユニットはライドオフしないで進んでも RC の効果を発動する（出典: atwiki/page-837「これにライドしているユニットは、このターン、ライドオフしなくてもＲＣの効果を発動できる」・カード評価「ライドオフせずとも能力が使える」）", () => {
    let s = accept(mounted());
    expect(rideOffOffered(s)).toBe(true);
    s = rideOff(s, false);
    expectChoiceFrom(s, "player1", "RM-018");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:e"]);
    expect(cardIn(s, "player1", "RM-018:g")?.mountedOnInstanceId).toBe("RM-022:v");
  });

  it("RM-022: ホールドしなければ、ライドオフしないで進んでも RC の効果は発動しない（出典: atwiki/page-837「そうしたとき」・R-KW-RC-01）", () => {
    const s = rideOff(skip(mounted()), false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-018");
  });

  it("RM-022: OT の自軍コマンドが2つなければホールドできない（選択は出ない）（出典: atwiki/page-837「OTを持つ自軍コマンドを2つホールドしてもよい」）", () => {
    const s = mounted([...releasedCat("OT", 1), ...releasedCat("WB", 2)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-022");
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });
});

// ===========================================================================
describe("RM-023 スクーパー", () => {
  const TEXT =
    "※これは、チェイスを持つ自軍ユニットがあるか、ライドされている間、Sビークルとして扱う。 【地中潜行】これをラッシュしたとき、敵軍パワーゾーンのオモテ向きのカードから1枚選び、捨札にしてもよい。そうしたとき、敵軍捨札からカードを1枚選び敵軍パワーゾーンにオモテ向きで置く。";

  it("RM-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-838）", () => {
    expectCatalogText("RM-023", TEXT);
    expectStats("RM-023", { name: "スクーパー", category: "OT", size: "S", bp: 4000, sp: undefined, powerCost: "3+", comboNumber: undefined, features: ["メカ", "車両"], rushCondition: "state_gate" });
    expectRarityIn("RM-023", ["N"]);
  });

  const ENEMY_POWER = [faceUp("TST-OP", "up1"), faceUp("TST-OP-OT", "up2"), faceDown("TST-P", "dn")];
  /** 自軍ラッシュフェイズ、手札のスクーパーをラッシュする（rush は自軍ラッシュエリアのカード）。 */
  const rushScooper = (rush = [inst("RM-024", "gv")], p2: Partial<GameState["players"]["player2"]> = { power: ENEMY_POWER, discard: [inst("SPEC-ES", "d1")] }) =>
    rushFromHand(board({ hand: [inst("RM-023", "h")], rush, command: releasedCat("OT", 1), power: powerCards(3) }, p2), "player1", "RM-023:h");

  it("RM-023: 追加条件 — 自軍エリアに高次元戦闘車ギャビオンがなければラッシュできない（出典: atwiki/page-838「自軍エリアに「高次元戦闘車ギャビオン」がある」）", () => {
    const s = board({ hand: [inst("RM-023", "h")], command: releasedCat("OT", 1), power: powerCards(3) });
    expect(canStartRush(s, "player1", "RM-023:h")).toBe(false);
  });

  it("RM-023: 追加条件 — 自軍ラッシュエリアに高次元戦闘車ギャビオンがあればラッシュできる（ギャビオンは場に残る）（出典: atwiki/page-838）", () => {
    const r = rushScooper();
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RM-023:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RM-024:gv")).toBe("rush");
  });

  it("RM-023: 公式Q&A — スクーパーをラッシュしても RS-558 ガンマジンの効果でドローできない（追加条件は場の状況を参照するだけ）（出典: grnrngr/faq-card-8 RS-558 Q3「「RM-023 スクーパー」などの追加条件のテキストが「～がある」のような…ドローすることはできません」）", () => {
    const r = rushScooper([inst("RM-024", "gv"), inst("RS-558", "gm")]);
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    if (s.pendingEffectChoice?.sourceCardId === "RM-023") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RM-023:h")).toBe("rush");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RM-023:【地中潜行】— ラッシュしたとき、敵軍パワーゾーンのオモテ向きのカードから1枚選べる（ウラ向きのダメージは選べない。任意）（出典: atwiki/page-838「敵軍パワーゾーンのオモテ向きのカードから1枚選び、捨札にしてもよい」）", () => {
    const s = rushScooper().state;
    expectChoiceFrom(s, "player1", "RM-023");
    expect(choiceIds(s)).toEqual(["TST-OP-OT:up2", "TST-OP:up1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-023:【地中潜行】— 選んだカードは敵軍捨札になり、続けて敵軍捨札からカードを1枚選ぶ（見送れない）（出典: atwiki/page-838「そうしたとき、敵軍捨札からカードを1枚選び」）", () => {
    const s = pick(rushScooper().state, "TST-OP:up1");
    expect(zoneOf(s, "player2", "TST-OP:up1")).toBe("discard");
    expectChoiceFrom(s, "player1", "RM-023");
    expect(choiceIds(s)).toContain("SPEC-ES:d1");
    expect(canSkip(s)).toBe(false);
  });

  it("RM-023:【地中潜行】— 敵軍捨札から選んだカードは敵軍パワーゾーンにオモテ向きで置かれる（パワーの枚数は変わらない）（出典: atwiki/page-838「敵軍パワーゾーンにオモテ向きで置く」）", () => {
    const s = resolveAll(pick(pick(rushScooper().state, "TST-OP:up1"), "SPEC-ES:d1"));
    expect(zoneOf(s, "player2", "SPEC-ES:d1")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-ES:d1")?.faceDown ?? false).toBe(false);
    expect(s.players.player2.power).toHaveLength(ENEMY_POWER.length);
  });

  it("RM-023:【地中潜行】— 見送れば敵軍のパワーゾーン・捨札は変わらない（出典: atwiki/page-838「捨札にしてもよい」）", () => {
    const s = resolveAll(skip(rushScooper().state));
    expect(zoneOf(s, "player2", "TST-OP:up1")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-ES:d1")).toBe("discard");
  });

  it("RM-023: ※ — チェイスを持つ自軍ユニット（宇宙刑事ギャバン）があれば S ビークルとして扱い、RC のユニットがライドできる（出典: atwiki/page-838「チェイスを持つ自軍ユニットがあるか…Sビークルとして扱う」）", () => {
    const s = battleBoard({ rush: [inst("RM-018", "g"), inst("SPEC-RC", "r"), inst("RM-023", "sc")] });
    expect(canMount(s, "SPEC-RC:r", "RM-023:sc")).toBe(true);
  });

  it("RM-023: ※ — チェイスを持つ自軍ユニットがなければビークルではない（ライドできない）（出典: atwiki/page-838・カード評価「チェイス持ちがいるとＳビークルになるユニット」）", () => {
    const s = battleBoard({ rush: [inst("SPEC-RC", "r"), inst("RM-023", "sc")] });
    expect(canMount(s, "SPEC-RC:r", "RM-023:sc")).toBe(false);
  });

  it("RM-023: ※ — チェイスの乗り換え先に選べる（ライドしているビークルを捨札にして、ライドされていないスクーパーにライドする）（出典: atwiki/page-838・カード評価「チェイス持ちが出ればビークルとなってチェイスを発動しやすくする」・R-KW-CHASE-01）", () => {
    // 自軍バトルフェイズ、player2 の宇宙刑事ギャバン（SPEC-VEHICLE にライド中）を BP13000 でアタックして撃破する。
    let s = st(
      {
        player1: { rush: [inst("TST-UNIT-7", "a")], deck: deckCards(3) },
        player2: { battle: ridingPair("RM-018", "g", "SPEC-VEHICLE", "v"), rush: [inst("RM-023", "sc")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = attack(enter(s, "TST-UNIT-7:a"), "TST-UNIT-7:a", "RM-018:g");
    expect(chaseTargets(s, "player2")).toEqual(["RM-023:sc"]);
  });
});

// ===========================================================================
describe("RM-024 高次元戦闘車ギャビオン", () => {
  const TEXT =
    "【搭載】これをラッシュしたとき、次の効果を発動できる⇒自軍山札を見て、特徴「車両」を持つSユニットのカードを1枚選び、相手に見せる。その後、山札をシャッフルし、選んだカードを山札の上に戻す。";

  const DECK = [inst("TST-OP", "x0"), inst("SPEC-CAR-M", "cm"), inst("RM-022", "vc"), inst("SPEC-NOT-CAR", "nc"), inst("SPEC-CAR-S", "cs"), inst("RM-023", "sc"), inst("TST-OP", "x1")];
  const rushed = () => {
    const r = rushFromHand(board({ hand: [inst("RM-024", "h")], command: releasedCat("OT", 1), power: powerCards(3), deck: DECK }), "player1", "RM-024:h");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RM-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-839）", () => {
    expectCatalogText("RM-024", TEXT);
    expectVehicleStats("RM-024", { name: "高次元戦闘車ギャビオン", category: "OT", powerCost: 3, size: "M", features: ["メカ", "車両", "航空機"] });
    expectRarityIn("RM-024", ["N"]);
  });

  it("RM-024:【搭載】— ラッシュしたとき、自軍山札の、特徴「車両」を持つ S ユニットのカードから1枚選べる（M ユニット・ビークルのカード・「車両」を持たないカードは選べない。任意）（出典: atwiki/page-839「特徴「車両」を持つSユニットのカードを1枚選び」「次の効果を発動できる」・カード評価「サーチ出来るユニットは今のところスクーパー、バイクル、サブマシーン」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "RM-024");
    expect(choiceIds(s)).toEqual(["RM-023:sc", "SPEC-CAR-S:cs"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-024:【搭載】— 選んだカードは山札をシャッフルした後で山札の上に戻る（山札の枚数は変わらない）（出典: atwiki/page-839「その後、山札をシャッフルし、選んだカードを山札の上に戻す」）", () => {
    const s = resolveAll(pick(rushed(), "RM-023:sc"));
    expect(s.players.player1.deck[0]?.instanceId).toBe("RM-023:sc");
    expect(s.players.player1.deck).toHaveLength(DECK.length);
    expect(zoneOf(s, "player1", "RM-024:h")).toBe("rush");
  });
});

// ===========================================================================
describe("RM-025 宇宙刑事シャリバン", () => {
  const TEXT =
    "※チェイス （これがライド中にユニットでなくなる時、かわりにこれがライドしているビークルを捨札にしてから、ライドされていない自軍ビークルにライドさせてもよい） 【シャリバンクラッシュ】本来のBPが3000の敵軍ユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("RM-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-894）", () => {
    expectCatalogText("RM-025", TEXT);
    expectStats("RM-025", { name: "宇宙刑事シャリバン", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 3, comboNumber: "RC", features: ["宇宙刑事", "メカ", "男", "警察"] });
    expectRarityIn("RM-025", ["SR"]);
  });

  it("RM-025: ※チェイス — ライド中にバトルで撃破されるとき、ライドされていない自軍ビークルに乗り換えられる（出典: atwiki/page-894 ※チェイス・R-KW-CHASE-01）", () => {
    let s = st(
      {
        player1: { rush: [inst("TST-UNIT-7", "a")], deck: deckCards(3) },
        player2: { battle: ridingPair("RM-025", "c", "SPEC-VEHICLE", "v"), rush: [inst("SPEC-VEHICLE2", "v2")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = attack(enter(s, "TST-UNIT-7:a"), "TST-UNIT-7:a", "RM-025:c");
    expect(chaseTargets(s, "player2")).toEqual(["SPEC-VEHICLE2:v2"]);
  });

  /** 自軍バトルフェイズ、シャリバンが SPEC-VEHICLE にライドして出てライドオフする（RC の選択まで）。 */
  const rc = () =>
    rideOff(
      mount(
        battleBoard(
          { rush: [inst("RM-025", "c"), inst("SPEC-VEHICLE", "v")] },
          {
            rush: [inst("SPEC-E3000", "a"), { ...inst("SPEC-E3000B", "b"), bpModifier: 1000 }, { ...inst("SPEC-E4000", "c"), bpModifier: -1000 }],
            battle: [inst("SPEC-EM3000", "m"), inst("SPEC-ES", "s")],
          },
        ),
        "RM-025:c",
        "SPEC-VEHICLE:v",
      ),
      true,
    );

  it("RM-025: RC【シャリバンクラッシュ】— 本来の BP が3000の敵軍ユニット（エリア・サイズを問わない。いまの BP ではなく本来の BP で見る）から1体選べる（任意）（出典: atwiki/page-894「本来のBPが3000の敵軍ユニットを1体選び、持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RM-025");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:a", "SPEC-E3000B:b", "SPEC-EM3000:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-025: RC【シャリバンクラッシュ】— 選んだユニットは持ち主のパワーゾーンにオモテ向きで送られる（ダメージではない）（出典: atwiki/page-894）", () => {
    const s = resolveAll(pick(rc(), "SPEC-EM3000:m"));
    expect(zoneOf(s, "player2", "SPEC-EM3000:m")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-EM3000:m")?.faceDown ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RM-026 超次元戦闘母艦グランドバース", () => {
  const TEXT =
    "※これはSユニットにアタックすることができない。 【収容】自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアからビークルを1体選んでもよい。そうしたとき、選んだビークルにライドしているユニットがあれば、そのユニットをパワーゾーンに送る。その後、選んだビークルをパワーゾーンに送る。";

  it("RM-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-840）", () => {
    expectCatalogText("RM-026", TEXT);
    expectStats("RM-026", { name: "超次元戦闘母艦グランドバース", category: "OT", size: "XL", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["メカ", "母艦"] });
    expectRarityIn("RM-026", ["N"]);
  });

  it("RM-026: ※ — S ユニットにはアタックできない（M ユニットにはアタックできる）（出典: atwiki/page-840「これはSユニットにアタックすることができない」）", () => {
    const s = enter(battleBoard({ rush: [inst("RM-026", "gb")] }, { battle: [inst("SPEC-ES", "s"), inst("SPEC-EM", "m")] }), "RM-026:gb");
    expect(targetsOf(s, "RM-026:gb")).toEqual(["SPEC-EM:m"]);
  });

  /** 自軍バトルフェイズ、バトルエリアに SPEC-RC（SPEC-VEHICLE にライド中）がいるところでグランドバースを出す。 */
  const entered = () =>
    enter(battleBoard({ battle: ridingPair("SPEC-RC", "r", "SPEC-VEHICLE", "v"), rush: [inst("RM-026", "gb"), inst("SPEC-VEHICLE2", "v2")] }), "RM-026:gb");

  it("RM-026:【収容】— 自軍ターン中にバトルエリアに出たとき、自軍バトルエリアのビークルから1体選べる（ラッシュエリアのビークルは選べない。任意）（出典: atwiki/page-840「自軍バトルエリアからビークルを1体選んでもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-026");
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:v"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-026:【収容】— 選んだビークルにライドしているユニットと、そのビークルが自軍パワーゾーンに送られる（出典: atwiki/page-840「そのユニットをパワーゾーンに送る。その後、選んだビークルをパワーゾーンに送る」・カード評価「【収容】はパワー加速に使える」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-VEHICLE:v"));
    expect(zoneOf(s, "player1", "SPEC-RC:r")).toBe("power");
    expect(zoneOf(s, "player1", "SPEC-VEHICLE:v")).toBe("power");
    expect(cardIn(s, "player1", "SPEC-RC:r")?.faceDown ?? false).toBe(false);
    expect(s.players.player1.power).toHaveLength(2);
  });

  it("RM-026:【収容】— 見送れば何も起きない（出典: atwiki/page-840「選んでもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player1", "SPEC-RC:r")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-VEHICLE:v")).toBe("battle");
  });

  it("RM-026:【収容】— チェイスを持つユニット（宇宙刑事ギャバン）がライドしているビークルを選ぶと、チェイスでラッシュエリアのビークルに乗り換えられる（出典: atwiki/page-840 カード評価「ギャバンがライドしているビークルを選べばチェイスが発動できる。ラッシュエリアのビークルに乗れば再度バトルエリアに出られる」・R-KW-CHASE-01）", () => {
    let s = enter(battleBoard({ battle: ridingPair("RM-018", "g", "SPEC-VEHICLE", "v"), rush: [inst("RM-026", "gb"), inst("SPEC-VEHICLE2", "v2")] }), "RM-026:gb");
    s = settle(pick(s, "SPEC-VEHICLE:v"));
    expect(chaseTargets(s, "player1")).toEqual(["SPEC-VEHICLE2:v2"]);
  });
});

// ===========================================================================
describe("RM-027 バトルバースフォーメーション", () => {
  const TEXT =
    "※自分が「超次元戦闘母艦グランドバース」をラッシュしたとき、自軍エリアに「バトルバースフォーメーション」があれば1体選んで手札に戻す。 【プラズマカノン】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからオモテ向きのカードから1枚選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」「BP+3000」";

  it("RM-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-841）", () => {
    expectCatalogText("RM-027", TEXT);
    expectStats("RM-027", { name: "バトルバースフォーメーション", category: "OT", size: "XL", bp: 7000, sp: "special", powerCost: "5+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "return_named_to_hand" });
    expectRarityIn("RM-027", ["NR"]);
  });

  it("RM-027: 追加条件 — 自軍の超次元戦闘母艦グランドバースを1体手札に戻してラッシュする（出典: atwiki/page-841「自軍「超次元戦闘母艦グランドバース」１体を手札に戻す」）", () => {
    const r = rushVia(board({ hand: [inst("RM-027", "h")], rush: [inst("RM-026", "gb")], command: releasedCat("OT", 1), power: powerCards(5) }), "player1", "RM-027:h", (a) =>
      JSON.stringify(a.zordMaterialInstanceIds ?? a.zordMaterialInstanceId ?? "").includes("RM-026:gb"),
    );
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RM-027:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-026:gb")).toBe("hand");
  });

  it("RM-027: ※ — 自分が超次元戦闘母艦グランドバースをラッシュしたとき、自軍エリアのバトルバースフォーメーションを手札に戻す（出典: atwiki/page-841「自軍エリアに「バトルバースフォーメーション」があれば1体選んで手札に戻す」）", () => {
    const r = rushFromHand(board({ hand: [inst("RM-026", "h")], rush: [inst("RM-027", "bb")], command: releasedCat("OT", 1), power: powerCards(4) }), "player1", "RM-026:h");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state, ["RM-027:bb"]);
    expect(zoneOf(s, "player1", "RM-026:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-027:bb")).toBe("hand");
  });

  const POWER = [faceUp("TST-P", "u1"), faceUp("TST-OP", "u2"), faceDown("TST-P", "d1")];
  const entered = () => enter(battleBoard({ rush: [inst("RM-027", "bb")], power: POWER }), "RM-027:bb");

  it("RM-027:【プラズマカノン】— 自軍ターン中にバトルエリアに出たとき、自軍パワーゾーンのオモテ向きのカードから1枚選べる（ウラ向きは選べない。任意）（出典: atwiki/page-841「自軍パワーゾーンからオモテ向きのカードから1枚選び捨札にしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-027");
    expect(choiceIds(s)).toEqual(["TST-OP:u2", "TST-P:u1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-027:【プラズマカノン】— 選んだカードを捨札にすると、このターン「SP1」「BP+3000」を得る（BP10000）（出典: atwiki/page-841「このターン、これは次の能力を得る⇒「SP1」「BP+3000」」）", () => {
    const s = settle(pick(entered(), "TST-P:u1"));
    expect(zoneOf(s, "player1", "TST-P:u1")).toBe("discard");
    expect(bpOf(s, "player1", "RM-027:bb")).toBe(10000);
    expect(spOf(s, "player1", "RM-027:bb")).toBe(1);
  });

  it("RM-027:【プラズマカノン】— 見送れば能力を得ない（BP7000 のまま）（出典: atwiki/page-841「そうしたとき」）", () => {
    const s = settle(skip(entered()));
    expect(bpOf(s, "player1", "RM-027:bb")).toBe(7000);
    expect(s.players.player1.power).toHaveLength(POWER.length);
  });
});

// ===========================================================================
describe("RM-028 モトシャリアン", () => {
  const TEXT =
    "※これにライドしているユニットはBP+500される。 ※これが自軍パワーゾーンでオモテ向きになっている間、特徴「宇宙刑事」を持つ自軍ユニットをラッシュしたとき、これを自軍ラッシュエリアに出してもよい。";

  it("RM-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-842）", () => {
    expectCatalogText("RM-028", TEXT);
    expectVehicleStats("RM-028", { name: "モトシャリアン", category: "OT", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RM-028", ["N"]);
  });

  it("RM-028: ※ — これにライドしているユニットは BP+500（出典: atwiki/page-842「これにライドしているユニットはBP+500される」）", () => {
    const s = battleBoard({ battle: ridingPair("SPEC-RC", "r", "RM-028", "ms") });
    expect(bpOf(s, "player1", "SPEC-RC:r")).toBe(1500);
  });

  /** 自軍ラッシュフェイズ、手札の id（必要パワー3）をラッシュする。パワーゾーンには power と TST-P。 */
  const rushWith = (id: string, power = [faceUp("RM-028", "ms")]) => {
    const r = rushFromHand(board({ hand: [inst(id, "h")], command: releasedCat("OT", 1), power: [...power, ...powerCards(3)] }), "player1", `${id}:h`);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RM-028: ※ — 自軍パワーゾーンでオモテ向きの間、特徴「宇宙刑事」を持つ自軍ユニット（宇宙刑事シャリバン）をラッシュしたとき、これを自軍ラッシュエリアに出すかを選べる（任意）（出典: atwiki/page-842「これを自軍ラッシュエリアに出してもよい」）", () => {
    const s = rushWith("RM-025");
    expectChoiceFrom(s, "player1", "RM-028");
    expect(canSkip(s)).toBe(true);
  });

  it("RM-028: ※ — 出すことを選ぶと、パワーゾーンから自軍ラッシュエリアに出る（出典: atwiki/page-842）", () => {
    const s = resolveAll(accept(rushWith("RM-025")));
    expect(zoneOf(s, "player1", "RM-028:ms")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-025:h")).toBe("rush");
  });

  it("RM-028: ※ — 出さなければパワーゾーンに残る（出典: atwiki/page-842「出してもよい」）", () => {
    const s = resolveAll(skip(rushWith("RM-025")));
    expect(zoneOf(s, "player1", "RM-028:ms")).toBe("power");
  });

  it("RM-028: ※ — ウラ向き（ダメージ）のときは出せない（出典: atwiki/page-842「自軍パワーゾーンでオモテ向きになっている間」）", () => {
    const s = resolveAll(rushWith("RM-025", [faceDown("RM-028", "ms")]));
    expect(zoneOf(s, "player1", "RM-028:ms")).toBe("power");
  });

  it("RM-028: ※ —「宇宙刑事」を持たないユニットをラッシュしても出せない（出典: atwiki/page-842「特徴「宇宙刑事」を持つ自軍ユニットをラッシュしたとき」）", () => {
    const s = rushWith("SPEC-NOT-COP");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-028");
    expect(zoneOf(resolveAll(s), "player1", "RM-028:ms")).toBe("power");
  });
});
