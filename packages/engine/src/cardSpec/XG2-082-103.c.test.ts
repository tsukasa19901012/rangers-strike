/**
 * カード別スペック: XG2-098〜XG2-103（クロスギャザー ザ・ドラゴンタイガー カメロック〜サイドマシーン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-098」〜「XG2-103」とカード名で検索）。atwiki に転載された公式 Q&A も本範囲にはない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-KW-RC-01・R-ADD-02・R-CN-02・R-ZONE-08）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの: なし（XG2-101 のターン終了時の処理・ストライク禁止はエンジン側の個別実装を、ここで初めてカード本文と照合する）。
 */
import { describe, expect, it } from "vitest";
import {
  attackTargets,
  attackUntilRegister,
  attackedInEnemyTurn,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  held,
  heldUnit,
  inst,
  isHeld,
  mount,
  ncEnter,
  p1Battle,
  passEntry,
  toPhase,
  pick,
  playOp,
  powerCards,
  rcBoard,
  registerOffered,
  released,
  releasedCat,
  releasedN,
  resident,
  resolveAll,
  rideOff,
  rushBoard,
  rushVia,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./XG2-082-103.helpers";
import type { GameState } from "../types/game";

const RIDER = sUnit("SPEC-RIDER", { bp: 2000, comboNumber: "RC" });
const EXTRA = [RIDER];

// ===========================================================================
describe("XG2-098 カメロック", () => {
  it("XG2-098: カタログ本文・スペックが出典と一致（出典: atwiki/page-1784）", () => {
    expectCatalogText("XG2-098", "※レジスト");
    expectUnit("XG2-098", { name: "カメロック", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 0, features: ["メカ"] });
    expectRarityIn("XG2-098", ["N"]);
  });

  it("XG2-098: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-1784「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-098", "u")] }, "XG2-098:u"))).toBe(true);
  });
});

// ===========================================================================
describe("XG2-099 カメロックSM", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「カメロック」のカードを1枚選び、自軍ラッシュエリアに出す。 【カメラズーカ】 「SP1」敵軍コマンドゾーンから、Sユニットのカードを1枚選んでもよい。そうしたとき、次の相手のターン、選んだカードはリリースできない。";

  it("XG2-099: カタログ本文・スペックが出典と一致（出典: atwiki/page-1785）", () => {
    expectCatalogText("XG2-099", TEXT);
    expectUnit("XG2-099", { name: "カメロックSM", category: "ET", size: "S", bp: 3500, sp: "special", powerCost: "7-", comboNumber: 5, features: ["メカ", "人型", "スペシャルモード"], rushCondition: "zord_down_send_to_command_or_discard" });
    expectRarityIn("XG2-099", ["N"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power: number) => rushBoard({ hand: [inst("XG2-099", "sm")], rush, power: powerCards(power), command: releasedCat("ET", 1) });

  it("XG2-099: 追加条件 — 自軍「カメロック」1体をコマンドゾーンに送るか捨札にすれば、必要パワー0でラッシュできる（出典: atwiki/page-1785「自軍「カメロック」1体をコマンドゾーンに送るか捨札にすれば必要パワー0になる」）", () => {
    for (const dst of ["command", "discard"] as const) {
      const r = rushVia(board([inst("XG2-098", "km")], 0), "player1", "XG2-099:sm", (a) => a.zordMaterialDestination === dst);
      expect(r.ok, r.error).toBe(true);
      const s = resolveAll(r.state);
      expect(zoneOf(s, "player1", "XG2-099:sm")).toBe("rush");
      expect(zoneOf(s, "player1", "XG2-098:km")).toBe(dst);
    }
  });

  it("XG2-099: 必要パワー7- — 「カメロック」がいなければパワー7でラッシュでき、6ではできない（出典: atwiki/page-1785「必要パワー：7-」・R-ADD-02）", () => {
    expect(canStartRush(board([], 7), "player1", "XG2-099:sm")).toBe(true);
    expect(canStartRush(board([], 6), "player1", "XG2-099:sm")).toBe(false);
  });

  it("XG2-099: ※ 撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札の「カメロック」のカードを1枚選ぶ（必ず。どちらのゾーンからでも選べる）（出典: atwiki/page-1785「自軍コマンドゾーンか自軍捨札から「カメロック」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG2-099", "sm")], command: [released("XG2-098", "kc")], discard: [inst("XG2-098", "kd"), inst("TST-UNIT-0", "x")] }, "XG2-099:sm");
    expectChoiceFrom(s, "player1", "XG2-099");
    expect(choiceIds(s).sort()).toEqual(["XG2-098:kc", "XG2-098:kd"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG2-099: ※ 自軍コマンドゾーンの「カメロック」が自軍ラッシュエリアに出る（出典: atwiki/page-1785「自軍コマンドゾーンか自軍捨札から」）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("XG2-099", "sm")], command: [released("XG2-098", "kc")] }, "XG2-099:sm", {}, ["XG2-098:kc"]);
    expect(zoneOf(s, "player1", "XG2-099:sm")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-098:kc")).toBe("rush");
  });

  it("XG2-099: 【カメラズーカ】5番目に出れば「SP1」（出典: atwiki/page-1785「CN：5」「SP：！」）", () => {
    expect(spOf(ncEnter("XG2-099:sm", 4), "player1", "XG2-099:sm")).toBe(1);
  });

  /** 敵軍コマンドゾーン: ホールド状態の S ユニットのカード、ホールド状態のオペレーション。 */
  const zooka = () => ncEnter("XG2-099:sm", 4, {}, { command: [held("TST-UNIT-0", "cu"), held("TST-OP", "co")] });

  it("XG2-099: 【カメラズーカ】NC — 敵軍コマンドゾーンの S ユニットのカードを1枚選べる（任意。オペレーションは選べない）（出典: atwiki/page-1785「敵軍コマンドゾーンから、Sユニットのカードを1枚選んでもよい」）", () => {
    const s = zooka();
    expectChoiceFrom(s, "player1", "XG2-099");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:cu"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-099: 【カメラズーカ】選んだカードは次の相手のターン、リリースできない（相手のスタートフェイズに、ほかのコマンドはリリースされても選んだカードはホールド状態のまま）（出典: atwiki/page-1785「次の相手のターン、選んだカードはリリースできない」）", () => {
    let s = resolveAll(pick(zooka(), "TST-UNIT-0:cu"));
    // カメロックSM のバトル進入の行動ウィンドウをパスしてからターンを終える（パスしないとエンドできない）。
    s = endTurn(passEntry(s));
    // 相手のスタートフェイズのリリース（release_start_commands）を行う。resolveAll だけではリリースの手を打たない。
    s = toPhase(resolveAll(s), "player2", "charge");
    expect(s.activePlayer).toBe("player2");
    expect(isHeld(s, "player2", "TST-UNIT-0:cu")).toBe(true);
    expect(isHeld(s, "player2", "TST-OP:co")).toBe(false);
  });
});

// ===========================================================================
describe("XG2-100 善と悪", () => {
  const TEXT =
    "※常駐 特徴「メカ」を持つユニットは次の能力を得る⇒自分自身のターン中、これがバトルエリアに出たとき、自分自身の山札の上から1枚をオモテにする。オモテにしたカードがユニットカードなら、このターン、これは特徴「男」または「女」を持つユニットにアタックできない。その後、オモテにしたカードは、山札の下に戻す。";

  it("XG2-100: カタログ本文・スペックが出典と一致（出典: atwiki/page-52）", () => {
    expectCatalogText("XG2-100", TEXT);
    expectOpStats("XG2-100", { name: "善と悪", category: "ET", powerCost: 3 });
    expectRarityIn("XG2-100", ["R"]);
  });

  it("XG2-100: ※常駐 — 使うと自軍常駐置き場に配置される（出典: atwiki/page-52「※常駐」）", () => {
    const r = playOp(st({ phase: "rush", player1: { hand: [inst("XG2-100", "zk")], command: releasedCat("ET", 1), power: powerCards(3), deck: deckCards(3) } }), "player1", "XG2-100:zk");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XG2-100:zk")).toBe("operation");
  });

  /** 自軍常駐置き場に善と悪。自軍の XG2-089 ジバン（メカ）がバトルエリアに出る。自軍山札の上は top。敵軍: 「男」の XG2-085 ショウと、「メカ」だけの XG2-098 カメロック。 */
  const entered = (top: ReturnType<typeof inst>) =>
    enter(p1Battle({ rush: [inst("XG2-089", "jb")], operation: [resident("XG2-100", "zk")], deck: [top, ...deckCards(3)] }, { battle: [inst("XG2-085", "man"), inst("XG2-098", "mecha")] }), "XG2-089:jb");

  it("XG2-100: 「メカ」を持つ自軍ユニットが自分のターンにバトルエリアに出ると、山札の上をオモテにし、ユニットカードなら「男」「女」を持つユニットにアタックできない。オモテにしたカードは山札の下に戻る（出典: atwiki/page-52「オモテにしたカードがユニットカードなら、このターン、これは特徴「男」または「女」を持つユニットにアタックできない。その後、オモテにしたカードは、山札の下に戻す」・カード評価「自軍ユニットも対象になってしまうのが難点」）", () => {
    const s = entered(inst("TST-UNIT-0", "top"));
    expect(attackTargets(s, "XG2-089:jb")).toEqual(["XG2-098:mecha"]);
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-UNIT-0:top");
  });

  it("XG2-100: オモテにしたカードがユニットカードでなければ（オペレーション）、アタックの制限はない（出典: atwiki/page-52「オモテにしたカードがユニットカードなら」）", () => {
    expect(attackTargets(entered(inst("TST-OP", "top")), "XG2-089:jb").sort()).toEqual(["XG2-085:man", "XG2-098:mecha"]);
  });
});

// ===========================================================================
describe("XG2-101 ハカイダー", () => {
  const TEXT =
    "※特徴「メカ」を持つ敵軍ユニットがあるとき、これはストライクできない。 ※自分がターンを終えるとき、このユニットがリリース状態ならホールドし、ホールド状態なら山札に戻してシャッフルする。 【ハカイダーショット】敵軍バトルエリアから、特徴「メカ」を持つ、SユニットまたはMユニットを1体選び撃破してもよい。";

  it("XG2-101: カタログ本文・スペックが出典と一致（出典: atwiki/page-1817）", () => {
    expectCatalogText("XG2-101", TEXT);
    expectUnit("XG2-101", { name: "ハカイダー", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: "4+", comboNumber: "RC", features: ["改造人間", "メカ", "人型"], rushCondition: "state_gate" });
    expectRarityIn("XG2-101", ["SR"]);
  });

  const board = (p2: Partial<GameState["players"]["player2"]>, power = 4) => rushBoard({ hand: [inst("XG2-101", "hk")], power: powerCards(power), command: releasedCat("DA", 1) }, p2);

  it("XG2-101: 追加条件 — 特徴「メカ」を持つ敵軍ユニット（エリアを問わない）があればパワー4でラッシュできる。なければ、またはパワー3ではできない（出典: atwiki/page-1817「追加条件：特徴「メカ」を持つ敵軍ユニットがある」「必要パワー：4+」）", () => {
    expect(canStartRush(board({ battle: [inst("XG2-098", "m")] }), "player1", "XG2-101:hk")).toBe(true);
    expect(canStartRush(board({ rush: [inst("XG2-098", "m")] }), "player1", "XG2-101:hk")).toBe(true);
    expect(canStartRush(board({ battle: [inst("TST-UNIT-0", "x")] }), "player1", "XG2-101:hk")).toBe(false);
    expect(canStartRush(board({ battle: [inst("XG2-098", "m")] }, 3), "player1", "XG2-101:hk")).toBe(false);
  });

  it("XG2-101: ※1つ目 — 特徴「メカ」を持つ敵軍ユニット（ラッシュエリアでもよい）があるとストライクできない。なければストライクできる（出典: atwiki/page-1817「特徴「メカ」を持つ敵軍ユニットがあるとき、これはストライクできない」）", () => {
    expect(canStrike(enter(p1Battle({ rush: [inst("XG2-101", "hk")] }, { rush: [inst("XG2-098", "m")] }), "XG2-101:hk"), "XG2-101:hk")).toBe(false);
    expect(canStrike(enter(p1Battle({ rush: [inst("XG2-101", "hk")] }, { battle: [inst("TST-UNIT-0", "x")] }), "XG2-101:hk"), "XG2-101:hk")).toBe(true);
  });

  it("XG2-101: ※2つ目 — 自分がターンを終えるとき、リリース状態ならホールドし、ホールド状態なら山札に戻す（出典: atwiki/page-1817「リリース状態ならホールドし、ホールド状態なら山札に戻してシャッフルする」・カード評価「勝手に山札に戻ってしまう」）", () => {
    const a = endTurn(p1Battle({ battle: [inst("XG2-101", "hk")] }));
    expect(zoneOf(a, "player1", "XG2-101:hk")).toBe("battle");
    expect(isHeld(a, "player1", "XG2-101:hk")).toBe(true);
    expect(zoneOf(endTurn(p1Battle({ battle: [heldUnit("XG2-101", "hk")] })), "player1", "XG2-101:hk")).toBe("deck");
  });

  const shot = () =>
    rcBoard("XG2-101:hk", {}, { battle: [inst("XG2-098", "ms"), { ...inst("TST-UNIT-2", "mm") }, inst("TST-UNIT-0", "nm")], rush: [inst("XG2-098", "mr")] }, EXTRA);

  it("XG2-101: 【ハカイダーショット】RC — 敵軍バトルエリアの、特徴「メカ」を持つ S か M ユニットを1体選べる（任意。「メカ」を持たないユニット・ラッシュエリアのユニットは選べない）（出典: atwiki/page-1817「敵軍バトルエリアから、特徴「メカ」を持つ、SユニットまたはMユニットを1体選び撃破してもよい」）", () => {
    const s = shot();
    expectChoiceFrom(s, "player1", "XG2-101");
    expect(choiceIds(s)).toEqual(["XG2-098:ms"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-101: 【ハカイダーショット】選んだユニットを撃破する（出典: atwiki/page-1817）", () => {
    const s = resolveAll(pick(shot(), "XG2-098:ms"));
    expect(zoneOf(s, "player2", "XG2-098:ms")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-102 キカイダー", () => {
  const TEXT =
    "※これは、DAを持つ自軍コマンドがないとき、特徴「男」または「女」を持つユニットにアタックできない。 【デンジエンド】特徴「メカ」または「人型」を持つ敵軍Sユニットを1体選び撃破してもよい。";

  it("XG2-102: カタログ本文・スペックが出典と一致（出典: atwiki/page-1816）", () => {
    expectCatalogText("XG2-102", TEXT);
    expectUnit("XG2-102", { name: "キカイダー", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 1, comboNumber: "RC", features: ["メカ", "人型"] });
    expectRarityIn("XG2-102", ["SR"]);
  });

  const targets = (command: ReturnType<typeof inst>[]) =>
    attackTargets(enter(p1Battle({ rush: [inst("XG2-102", "kk")], command }, { battle: [inst("XG2-085", "man"), inst("TST-UNIT-0", "x")] }), "XG2-102:kk"), "XG2-102:kk").sort();

  it("XG2-102: ※ DA を持つ自軍コマンドがないとき、特徴「男」か「女」を持つユニット（XG2-085 ショウ）にはアタックできない（出典: atwiki/page-1816「DAを持つ自軍コマンドがないとき、特徴「男」または「女」を持つユニットにアタックできない」・カード評価「黒のコマンドがないと男または女にアタックできないデメリット」）", () => {
    expect(targets([])).toEqual(["TST-UNIT-0:x"]);
  });

  it("XG2-102: ※ DA を持つ自軍コマンドがあれば、「男」のユニットにもアタックできる（出典: atwiki/page-1816）", () => {
    expect(targets(releasedCat("DA", 1))).toEqual(["TST-UNIT-0:x", "XG2-085:man"]);
  });

  const end = () => rcBoard("XG2-102:kk", {}, { battle: [inst("XG2-098", "ms"), inst("XG2-087", "hg"), inst("TST-UNIT-0", "nm"), { ...inst("TST-UNIT-2", "m") }], rush: [inst("XG2-098", "mr")] }, EXTRA);

  it("XG2-102: 【デンジエンド】RC — 特徴「メカ」か「人型」を持つ敵軍 S ユニット（ラッシュエリアも）を1体選べる（任意。どちらも持たないユニットは選べない）（出典: atwiki/page-1816「特徴「メカ」または「人型」を持つ敵軍Sユニットを1体選び撃破してもよい」・カード評価「ラッシュエリアも射程に入り」）", () => {
    const s = end();
    expectChoiceFrom(s, "player1", "XG2-102");
    expect(choiceIds(s).sort()).toEqual(["XG2-087:hg", "XG2-098:mr", "XG2-098:ms"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-102: 【デンジエンド】選んだユニット（バトルエリアの「メカ」）を撃破する（出典: atwiki/page-1816）", () => {
    const s = resolveAll(pick(end(), "XG2-098:ms"));
    expect(zoneOf(s, "player2", "XG2-098:ms")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-103 サイドマシーン", () => {
  const TEXT =
    "【ドリル攻撃】自軍ターン中、これがバトルエリアに出たとき、特徴を4つ以上持つ敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG2-103: カタログ本文・スペックが出典と一致（出典: atwiki/page-1812）", () => {
    expectCatalogText("XG2-103", TEXT);
    expectVehicle("XG2-103", { name: "サイドマシーン", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG2-103", ["N"]);
  });

  /** RC を持つ SPEC-RIDER がこれにライドして出る（ライドしたまま）。敵軍: 特徴4つの XG2-062 装甲響鬼（バトル）と XG2-086 ハイパーショウ（ラッシュ）、特徴3つの XG2-089 ジバン。 */
  const drill = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    rideOff(mount(p1Battle({ rush: [inst("SPEC-RIDER", "r"), inst("XG2-103", "sm")] }, { battle: [inst("XG2-062", "f4"), inst("XG2-089", "f3")], rush: [inst("XG2-086", "f4r")], ...p2 }, EXTRA), "SPEC-RIDER:r", "XG2-103:sm"), false);

  it("XG2-103: 【ドリル攻撃】自軍ターン中にバトルエリアに出たとき、特徴を4つ以上持つ敵軍 S ユニット（ラッシュエリアも）を1体選ぶ（必ず。特徴3つのユニットは選べない）（出典: atwiki/page-1812「特徴を4つ以上持つ敵軍Sユニットを1体選び」・カード評価「除去がラッシュエリアまで届く」「仮面ライダー装甲響鬼やハイパーショウなど…対象になりやすい」）", () => {
    const s = drill();
    expectChoiceFrom(s, "player1", "XG2-103");
    expect(choiceIds(s).sort()).toEqual(["XG2-062:f4", "XG2-086:f4r"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG2-103: 【ドリル攻撃】選んだユニットを持ち主のコマンドゾーンにホールド状態で置く。コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-1812「持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする」・R-ZONE-08）", () => {
    const a = resolveAll(drill(), ["XG2-086:f4r"]);
    expect(zoneOf(a, "player2", "XG2-086:f4r")).toBe("command");
    expect(isHeld(a, "player2", "XG2-086:f4r")).toBe(true);
    const b = resolveAll(drill({ command: releasedN(5, "TST-OP", "ec") }), ["XG2-062:f4"]);
    expect(zoneOf(b, "player2", "XG2-062:f4")).toBe("discard");
  });
});
