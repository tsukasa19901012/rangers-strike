/**
 * カード別スペック: XG2-082〜XG2-088（クロスギャザー ザ・ドラゴンタイガー 電子星獣ドル〜マッド・ガルボ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-082」〜「XG2-088」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-082 Q1〜Q3）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CHASE-01・02・R-KW-RC-01・R-ADD-02・R-ADD-06「合体」・R-CN-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - チェイスそのもの（R-KW-CHASE-01・02）は rulesSpec/07-chase.test.ts。XG2-087 の「ターンを終えるとき捨札」は rules/keywordGapRuntime.test.ts にもある。
 */
import { describe, expect, it } from "vitest";
import { activate, onlyActivateOrSkip } from "./revealGate.helpers";
import {
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  chaseTargets,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  heldUnit,
  inOwnersZone,
  inst,
  lastBattleBps,
  legal,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  PLAIN_VEHICLE,
  powerCards,
  rcBoard,
  reanimateTests,
  releasedCat,
  resolveAll,
  resolveZone,
  ridingOn,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./XG2-082-103.helpers";

const B5000 = sUnit("SPEC-B5000", { bp: 5000 });
const B6000 = sUnit("SPEC-B6000", { bp: 6000 });
const OT_S = sUnit("SPEC-OT-S", { bp: 1000, category: "OT" });
const DA_S = sUnit("SPEC-DA-S", { bp: 2000, category: "DA" });
const DA_M = { ...sUnit("SPEC-DA-M", { bp: 3000, category: "DA" }), size: "M" as const };
const OT_L = { ...sUnit("SPEC-OT-L", { bp: 9000, category: "OT" }), size: "L" as const };
const UCHU = sUnit("SPEC-UCHU", { bp: 1000, features: ["宇宙刑事"] });
const EXTRA = [B5000, B6000, OT_S, DA_S, DA_M, OT_L, UCHU, PLAIN_VEHICLE];

// ===========================================================================
describe("XG2-082 電子星獣ドル", () => {
  const TEXT =
    "※これは、自軍エリアでホールド状態かライドされている間、Lビークルとして扱う。 ※自軍ラッシュフェイズ中、このユニットをホールドしてもよい。 ※自軍ラッシュフェイズ中、このビークルがライドされていないなら、リリースしてもよい。 【ドルファイヤー】このビークルがチェイスの効果でライドされたとき、敵軍バトルエリアから本来のBPが5000以下のユニットを1体選び撃破してもよい。";

  it("XG2-082: カタログ本文・スペックが出典と一致（出典: atwiki/page-1807）", () => {
    expectCatalogText("XG2-082", TEXT);
    expectUnit("XG2-082", { name: "電子星獣ドル", category: "OT", size: "L", bp: 5000, sp: undefined, powerCost: "5+", features: ["メカ", "獣", "ドラゴン"], rushCondition: "state_gate" });
    expectRarityIn("XG2-082", ["N"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 5) => rushBoard({ hand: [inst("XG2-082", "dol")], rush, power: powerCards(power), command: releasedCat("OT", 1) }, {}, EXTRA);

  it("XG2-082: 追加条件 — 特徴「宇宙刑事」を持つ自軍ユニット（XG2-083 ギャバン）があればパワー5でラッシュできる。なければ、またはパワー4ではできない（出典: atwiki/page-1807「追加条件：特徴「宇宙刑事」を持つ自軍ユニットがある」「必要パワー：5+」）", () => {
    expect(canStartRush(board([inst("XG2-083", "gv")]), "player1", "XG2-082:dol")).toBe(true);
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-082:dol")).toBe(false);
    expect(canStartRush(board([inst("XG2-083", "gv")], 4), "player1", "XG2-082:dol")).toBe(false);
  });

  it("XG2-082: ※2つ目 — 自軍ラッシュフェイズ中、これをホールドする手がある（任意）（出典: atwiki/page-1807「自軍ラッシュフェイズ中、このユニットをホールドしてもよい」・カード評価「任意でユニットにもビークルにもなれる」）", () => {
    const s = rushBoard({ rush: [inst("XG2-082", "dol")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.playerId === "player1" && JSON.stringify(a).includes("XG2-082:dol"))).toBe(true);
  });

  it("XG2-082: ※3つ目 — 自軍ラッシュフェイズ中、ライドされていないホールド状態のこれをリリースする手がある（任意）（出典: atwiki/page-1807「このビークルがライドされていないなら、リリースしてもよい」・Q1〜Q3）", () => {
    const s = rushBoard({ rush: [heldUnit("XG2-082", "dol")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.playerId === "player1" && JSON.stringify(a).includes("XG2-082:dol"))).toBe(true);
  });

  it("XG2-082: ※1つ目 — ホールド状態の間は L ビークルとして扱うので、ライドされずにバトルエリアに出られない（出典: atwiki/page-1807「自軍エリアでホールド状態かライドされている間、Lビークルとして扱う」）", () => {
    expect(canEnter(p1Battle({ rush: [heldUnit("XG2-082", "dol")] }, {}, EXTRA), "XG2-082:dol")).toBe(false);
  });

  /** 敵軍ターン中、ライド中の XG2-083 ギャバン（チェイス）がバトルで撃破される。自軍ラッシュエリアにホールド状態のドル。 */
  const chased = () =>
    attackedInEnemyTurn(
      { battle: [inst("SPEC-VEHICLE", "v1"), ridingOn("XG2-083", "gv", "SPEC-VEHICLE:v1")], rush: [heldUnit("XG2-082", "dol")] },
      "XG2-083:gv",
      { battle: [inst("TST-UNIT-7", "atk"), inst("SPEC-B5000", "e5"), inst("SPEC-B6000", "e6")], rush: [inst("SPEC-B5000", "r5")] },
      "TST-UNIT-7:atk",
      EXTRA,
    );

  it("XG2-082: ※1つ目 — ホールド状態のこれ（L ビークル）は、チェイスの乗り換え先にできる（出典: atwiki/page-1807・カード評価「チェイスによってライドされることで、本来のBP5000以下を対象にした強力な除去を狙える」・R-KW-CHASE-01）", () => {
    expect(chaseTargets(chased(), "player1")).toEqual(["XG2-082:dol"]);
  });

  it("XG2-082: 【ドルファイヤー】チェイスの効果でライドされたとき、敵軍バトルエリアの本来の BP が5000以下のユニットを1体選べる（任意。BP6000・ラッシュエリアのユニットは選べない）（出典: atwiki/page-1807「このビークルがチェイスの効果でライドされたとき、敵軍バトルエリアから本来のBPが5000以下のユニットを1体選び撃破してもよい」）", () => {
    let s = act(chased(), { type: "resolve_chase", playerId: "player1", newVehicleInstanceId: "XG2-082:dol" });
    expectChoiceFrom(s, "player1", "XG2-082");
    expect(choiceIds(s)).toEqual(["SPEC-B5000:e5"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, "SPEC-B5000:e5"));
    expect(zoneOf(s, "player2", "SPEC-B5000:e5")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-083 宇宙刑事ギャバン", () => {
  const TEXT =
    "※チェイス ※これが自軍エリアにある間、特徴「宇宙刑事」を持つ自軍ユニットは、アタックされるとき、BP+1000される 【銀河パトロール隊隊長】自軍ラッシュエリアから、RCを持つユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは、バトルエリアに出たとき、ライドオフしなくてもその効果を発動できる。";

  it("XG2-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-981）", () => {
    expectCatalogText("XG2-083", TEXT);
    expectUnit("XG2-083", { name: "宇宙刑事ギャバン", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 4, comboNumber: "RC", features: ["宇宙刑事", "メカ", "男", "警察"] });
    expectRarityIn("XG2-083", ["SR"]);
  });

  it("XG2-083: ※チェイス — ライド中にバトルで撃破されるとき、ライドされていない自軍ビークルに乗り換えられる（出典: atwiki/page-981「※チェイス」・R-KW-CHASE-01）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("SPEC-VEHICLE", "v1"), ridingOn("XG2-083", "gv", "SPEC-VEHICLE:v1")], rush: [inst("SPEC-VEHICLE", "v2")] }, "XG2-083:gv", {}, "TST-UNIT-7:atk", EXTRA);
    expect(chaseTargets(s, "player1")).toEqual(["SPEC-VEHICLE:v2"]);
  });

  const attacked = (target: string) => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG2-083", "gv"), inst("SPEC-UCHU", "u")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-B5000", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    return resolveAll(settle(attack(s, "SPEC-B5000:atk", target, "player2")));
  };

  it("XG2-083: ※2つ目 — これが自軍エリアにある間、特徴「宇宙刑事」を持つ自軍ユニットはアタックされるとき BP+1000 される（BP1000→2000。これ自身も 4000→5000）（出典: atwiki/page-981「特徴「宇宙刑事」を持つ自軍ユニットは、アタックされるとき、BP+1000される」・カード評価「複数体いれば、各種MF並みの上昇幅」）", () => {
    expect(lastBattleBps(attacked("SPEC-UCHU:u"))?.defender).toBe(2000);
    expect(lastBattleBps(attacked("XG2-083:gv"))?.defender).toBe(5000);
  });

  const patrol = () => rcBoard("XG2-083:gv", { rush: [inst("XG2-089", "jb"), inst("TST-UNIT-0", "nr")] }, { battle: [inst("SPEC-DA-S", "da")] }, EXTRA);

  it("XG2-083: 【銀河パトロール隊隊長】RC — 自軍ラッシュエリアの RC を持つユニット（XG2-089 ジバン）から選べる（任意。RC を持たないユニットは選べない）（出典: atwiki/page-981「自軍ラッシュエリアから、RCを持つユニットを1体選んでもよい」）", () => {
    const s = patrol();
    expectChoiceFrom(s, "player1", "XG2-083");
    expect(choiceIds(s)).toEqual(["XG2-089:jb"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-083: 【銀河パトロール隊隊長】選んだユニットは、このターン、ライドオフせずにバトルエリアに出ても RC の効果（ジバン【ジバンエンド】）を発動できる（出典: atwiki/page-981「このターン、選んだユニットは、バトルエリアに出たとき、ライドオフしなくてもその効果を発動できる」・カード評価「ミッションメモリーに似た能力」）", () => {
    let s = resolveAll(pick(patrol(), "XG2-089:jb"));
    // ギャバンのバトル進入の行動ウィンドウをパスしてから、ジバンを出す（パスしないと次のユニットを出せない）。
    s = enter(passEntry(resolveAll(settle(s))), "XG2-089:jb");
    expectChoiceFrom(s, "player1", "XG2-089");
  });
});

// ===========================================================================
describe("XG2-084 バビロス", () => {
  const TEXT =
    "※これはSユニットにアタックすることができない。 【バビロスレーザー】自軍ターン中、これがバトルエリアに出たとき、敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードと同じカード名の敵軍ユニットをすべて撃破する。その後、オモテにしたカードは山札の下に戻す。";

  it("XG2-084: カタログ本文・スペックが出典と一致（出典: atwiki/page-1808）", () => {
    expectCatalogText("XG2-084", TEXT);
    expectUnit("XG2-084", { name: "バビロス", category: "OT", size: "XL", bp: 4000, sp: undefined, powerCost: 4, features: ["メカ", "母艦"] });
    expectRarityIn("XG2-084", ["N"]);
  });

  const lasered = () =>
    enter(p1Battle({ rush: [inst("XG2-084", "bb")] }, { deck: [inst("SPEC-B5000", "top"), ...deckCards(3, "e")], battle: [inst("SPEC-B5000", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-2", "m")], rush: [inst("SPEC-B5000", "e3")] }, EXTRA), "XG2-084:bb");

  it("XG2-084: ※ S ユニットにはアタックできない。M ユニットにはアタックできる（出典: atwiki/page-1808「これはSユニットにアタックすることができない」）", () => {
    expect(attackTargets(resolveAll(activate(lasered())), "XG2-084:bb")).toEqual(["TST-UNIT-2:m"]);
  });

  it("XG2-084: 【バビロスレーザー】自軍ターン中にバトルエリアに出たとき、敵軍山札の上から1枚をオモテにするかを選べる（任意）（出典: atwiki/page-1808「敵軍山札の上から1枚をオモテにしてもよい」）", () => {
    const s = lasered();
    expectChoiceFrom(s, "player1", "XG2-084");
    expect(canSkip(s)).toBe(true);
    // オモテにするかを選ぶまで、敵軍山札の上は見えない（rules/revealGate.ts）
    expect(onlyActivateOrSkip(s)).toBe(true);
  });

  it("XG2-084: 【バビロスレーザー】オモテにしたカードと同じカード名の敵軍ユニットを（エリアを問わず）すべて撃破し、オモテにしたカードは山札の下に戻す（出典: atwiki/page-1808「同じカード名の敵軍ユニットをすべて撃破する。その後、オモテにしたカードは山札の下に戻す」）", () => {
    const s = resolveAll(activate(lasered()));
    expect(zoneOf(s, "player2", "SPEC-B5000:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B5000:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("battle");
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-B5000:top");
  });
});

// ===========================================================================
describe("XG2-085 隊員コード153 ショウ", () => {
  const TEXT = "【日本刀】このターン、OTまたはDAを持つすべての敵軍SユニットはBP-1000される。（BP0以下になったユニットは撃破される）";

  it("XG2-085: カタログ本文・スペックが出典と一致（出典: atwiki/page-1780）", () => {
    expectCatalogText("XG2-085", TEXT);
    expectUnit("XG2-085", { name: "隊員コード153 ショウ", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 1, comboNumber: 1, features: ["男", "警察", "スワット"] });
    expectRarityIn("XG2-085", ["N"]);
  });

  const enemy = { battle: [inst("SPEC-OT-S", "ot"), inst("SPEC-DA-S", "da"), inst("TST-UNIT-0", "wb"), inst("SPEC-DA-M", "dm")], rush: [inst("SPEC-DA-S", "dr")] };

  it("XG2-085: 【日本刀】NC（1番目）— このターン、OT か DA を持つ敵軍 S ユニット（ラッシュエリアも）は BP-1000。WB の S ユニット・M ユニットは変わらない（出典: atwiki/page-1780「OTまたはDAを持つすべての敵軍SユニットはBP-1000される」・コメント欄「ラッシュまで届く」）", () => {
    const s = resolveAll(ncEnter("XG2-085:sho", 0, {}, enemy, EXTRA));
    expect(bpOf(s, "player2", "SPEC-DA-S:da")).toBe(1000);
    expect(bpOf(s, "player2", "SPEC-DA-S:dr")).toBe(1000);
    expect(bpOf(s, "player2", "TST-UNIT-0:wb")).toBe(1000);
    expect(bpOf(s, "player2", "SPEC-DA-M:dm")).toBe(3000);
  });

  it("XG2-085: 【日本刀】BP0 以下になった敵軍ユニット（OT・BP1000）は撃破される（出典: atwiki/page-1780「（BP0以下になったユニットは撃破される）」・カード評価「アタックで撃破しづらい低ＢＰのユニットの除去」）", () => {
    const s = resolveAll(ncEnter("XG2-085:sho", 0, {}, enemy, EXTRA));
    expect(zoneOf(s, "player2", "SPEC-OT-S:ot")).toBe("discard");
  });

  it("XG2-085: 【日本刀】2番目に出たとき（NC を満たさない）は BP が変わらない（出典: atwiki/page-1780「CN：1」・R-CN-02）", () => {
    const s = resolveAll(ncEnter("XG2-085:sho", 1, {}, enemy, EXTRA));
    expect(bpOf(s, "player2", "SPEC-DA-S:da")).toBe(2000);
  });
});

// ===========================================================================
describe("XG2-086 ハイパーショウ", () => {
  const TEXT =
    "合体―隊員コード153 ショウ＋ゴールドプラチナム ※敵軍ターン中、これとバトルしたユニットは、バトルに勝っても撃破される。 ※これが撃破されて捨札になったとき、自軍捨札から「隊員コード153 ショウ」のカードを1枚選び、自軍ラッシュエリアに出す。 【ドラムガンファイヤー】敵軍バトルエリアから、OTまたはDAを持つユニットを1体選び、持ち主のゾーンに置いてもよい。";

  it("XG2-086: カタログ本文・スペックが出典と一致（出典: atwiki/page-97）", () => {
    expectCatalogText("XG2-086", TEXT);
    expectUnit("XG2-086", { name: "ハイパーショウ", category: ["OT", "ET"], size: "S", bp: 4500, sp: 1, powerCost: "10-", comboNumber: 1, features: ["男", "警察", "スワット", "シルバニックギア"], rushCondition: "zord_down_discard_fusion" });
    expectRarityIn("XG2-086", ["SR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 0) => rushBoard({ hand: [inst("XG2-086", "hs")], rush, power: powerCards(power), command: [...releasedCat("OT", 1), ...releasedCat("ET", 1)] });

  it("XG2-086: 追加条件 — 自軍の「隊員コード153 ショウ」と「ゴールドプラチナム」を両方捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-97「合体―隊員コード153 ショウ＋ゴールドプラチナム」「追加条件：自軍合体ユニットを捨札にすれば必要パワー0になる」・R-ADD-06）", () => {
    const r = rushVia(board([inst("XG2-085", "sh"), inst("XG2-087", "gp")]), "player1", "XG2-086:hs", (a) => a.zordMaterialInstanceId === "XG2-085:sh");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG2-086:hs")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-085:sh")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-087:gp")).toBe("discard");
  });

  it("XG2-086: 必要パワー「10-」— 合体ユニットがそろわなければパワー10でラッシュでき、9ではできない（出典: atwiki/page-97・R-ADD-02）", () => {
    expect(canStartRush(board([], 10), "player1", "XG2-086:hs")).toBe(true);
    expect(canStartRush(board([], 9), "player1", "XG2-086:hs")).toBe(false);
  });

  it("XG2-086: ※1つ目 — 敵軍ターン中、これとバトルしたユニットはバトルに勝っても撃破される（出典: atwiki/page-97「敵軍ターン中、これとバトルしたユニットは、バトルに勝っても撃破される」・カード評価「殴り倒されても相手を道連れに」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-086", "hs")] }, "XG2-086:hs"));
    expect(zoneOf(s, "player1", "XG2-086:hs")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("discard");
  });

  it("XG2-086: ※1つ目 — 自軍ターン中のバトルでは、勝った相手は撃破されない（出典: atwiki/page-97「敵軍ターン中、」）", () => {
    const s = resolveAll(settle(attack(p1Battle({ battle: [inst("XG2-086", "hs")] }, { battle: [inst("TST-UNIT-7", "big")] }), "XG2-086:hs", "TST-UNIT-7:big")));
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("battle");
  });

  reanimateTests("XG2-086", "XG2-085", "隊員コード153 ショウ", "atwiki/page-97");

  const drum = () => ncEnter("XG2-086:hs", 0, {}, { battle: [inst("SPEC-OT-S", "ot"), inst("SPEC-OT-L", "otl"), inst("TST-UNIT-0", "wb")], rush: [inst("SPEC-DA-S", "dr")] }, EXTRA);

  it("XG2-086: 【ドラムガンファイヤー】NC（1番目）— 敵軍バトルエリアの OT か DA を持つユニット（サイズを問わない）を1体選べる（任意。WB のユニット・ラッシュエリアのユニットは選べない）（出典: atwiki/page-97「敵軍バトルエリアから、OTまたはDAを持つユニットを1体選び、持ち主のゾーンに置いてもよい」・カード評価「サイズやBPに関係なくユニットを除去できる」）", () => {
    const s = drum();
    expectChoiceFrom(s, "player1", "XG2-086");
    expect(choiceIds(s).sort()).toEqual(["SPEC-OT-L:otl", "SPEC-OT-S:ot"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-086: 【ドラムガンファイヤー】選んだユニットは持ち主のゾーン（パワーゾーンかコマンドゾーン）に置かれる（出典: atwiki/page-97「持ち主のゾーンに置いてもよい」・XG2-questions Q1）", () => {
    const s = resolveZone(drum(), ["SPEC-OT-L:otl"]);
    expect(inOwnersZone(s, "player2", "SPEC-OT-L:otl")).toBe(true);
  });

  it("XG2-086: 【ドラムガンファイヤー】行き先（持ち主のパワーゾーンかコマンドゾーン）は効果を使った側（自軍）が選ぶ。パワーゾーンならオモテ向き、コマンドゾーンならリリース状態で敵軍のゾーンに置かれる。敵軍のコマンドゾーンが5枚ならパワーゾーンに置かれる（出典: 利用者の決定 2026-10-20・questions-all.md U-13）", () => {
    const s = pick(drum(), "SPEC-OT-L:otl");
    expectChoiceFrom(s, "player1", "XG2-086");
    expect(s.pendingEffectChoice?.effectId).toBe("xg2_owner_zone");
    expect(choiceIds(s)).toEqual(["command", "power"]);
    const p = resolveAll(pick(s, "power"));
    expect(zoneOf(p, "player2", "SPEC-OT-L:otl")).toBe("power");
    expect(p.players.player2.power.find((c) => c.instanceId === "SPEC-OT-L:otl")?.faceDown).not.toBe(true);
    const c = resolveAll(pick(s, "command"));
    expect(zoneOf(c, "player2", "SPEC-OT-L:otl")).toBe("command");
    expect(c.players.player2.command.find((x) => x.instanceId === "SPEC-OT-L:otl")?.commandHeld).not.toBe(true);
    const full = ncEnter("XG2-086:hs", 0, {}, { battle: [inst("SPEC-OT-L", "otl")], command: releasedCat("OT", 5, "fc") }, EXTRA);
    const f = pick(full, "SPEC-OT-L:otl");
    expect(f.pendingEffectChoice?.effectId).not.toBe("xg2_owner_zone");
    const t = resolveAll(f);
    expect(zoneOf(t, "player2", "SPEC-OT-L:otl")).toBe("power");
    expect(t.players.player2.power.find((x) => x.instanceId === "SPEC-OT-L:otl")?.faceDown).not.toBe(true);
    expect(t.players.player2.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("XG2-087 ゴールドプラチナム", () => {
  const TEXT =
    "※これは、自分がターンを終えるときバトルエリアにあれば捨札になる。 【エネルギー照射】これをラッシュしたとき、自軍山札を見て、カテゴリを2つ以上持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。";

  it("XG2-087: カタログ本文・スペックが出典と一致（出典: atwiki/page-1781）", () => {
    expectCatalogText("XG2-087", TEXT);
    expectUnit("XG2-087", { name: "ゴールドプラチナム", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["ゴールド", "人型"] });
    expectRarityIn("XG2-087", ["N"]);
  });

  it("XG2-087: ※ 自分がターンを終えるときバトルエリアにあれば捨札になる。ラッシュエリアにあれば残る（出典: atwiki/page-1781「自分がターンを終えるときバトルエリアにあれば捨札になる」）", () => {
    expect(zoneOf(endTurn(p1Battle({ battle: [inst("XG2-087", "gp")] })), "player1", "XG2-087:gp")).toBe("discard");
    expect(zoneOf(endTurn(p1Battle({ rush: [inst("XG2-087", "gp")] })), "player1", "XG2-087:gp")).toBe("rush");
  });

  /** 自軍山札: XG2-096 ヤンマ（WB／ET・必要パワー3）、XG2-086 ハイパーショウ（OT／ET）、TST-UNIT-0（WB のみ）。パワー4。 */
  const rushed = () =>
    rushFromHand(
      rushBoard({ hand: [inst("XG2-087", "gp")], rush: [inst("XG2-085", "sh")], deck: [inst("XG2-096", "ym"), inst("XG2-086", "hs"), inst("TST-UNIT-0", "u"), ...deckCards(2)], power: powerCards(4), command: [...releasedCat("OT", 2), ...releasedCat("ET", 2), ...releasedCat("WB", 1)] }),
      "player1",
      "XG2-087:gp",
    ).state;

  it("XG2-087: 【エネルギー照射】ラッシュしたとき、自軍山札のカテゴリを2つ以上持つ S ユニットのカードから選べる（任意。カテゴリが1つのカードは選べない）（出典: atwiki/page-1781「自軍山札を見て、カテゴリを2つ以上持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG2-087");
    expect(choiceIds(s)).toContain("XG2-096:ym");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:u");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-087: 【エネルギー照射】選んだカード（ヤンマ）は必要パワーを満たして自軍ラッシュエリアに出る。ショウがいればハイパーショウも合体の追加条件で出せる（出典: atwiki/page-1781「ただし、必要パワーと追加条件は満たすこと」・カード評価「隊員コード153 ショウが場に出ていれば…ハイパーショウを自身の効果で山札から直接ラッシュできる」）", () => {
    const s = resolveAll(pick(rushed(), "XG2-096:ym"));
    expect(zoneOf(s, "player1", "XG2-096:ym")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("deck");
  });
});

// ===========================================================================
describe("XG2-088 マッド・ガルボ", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【ジバンキラー】これは、本来の特徴に「メカ」または「警察」を持つ敵軍Sユニットがあるとき、次の能力を得る⇒BP+2000、SP1";

  it("XG2-088: カタログ本文・スペックが出典と一致（出典: atwiki/page-244）", () => {
    expectCatalogText("XG2-088", TEXT);
    expectUnit("XG2-088", { name: "マッド・ガルボ", category: "DA", size: "S", bp: 4000, sp: "special", powerCost: 3, features: ["メカ", "女", "バイオロン"] });
    expectRarityIn("XG2-088", ["R"]);
  });

  it("XG2-088: ※ 敵軍ターン中、SP1 のユニット（BP1000）とのバトルに勝っても撃破される（出典: atwiki/page-244「敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-088", "mg")] }, "XG2-088:mg", {}, "TST-UNIT-0:atk"));
    expect(zoneOf(s, "player1", "XG2-088:mg")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
  });

  it("XG2-088: 【ジバンキラー】本来の特徴に「メカ」か「警察」を持つ敵軍 S ユニット（XG2-089 ジバン。ラッシュエリアでもよい）があれば BP+2000（6000）・「SP1」（出典: atwiki/page-244「本来の特徴に「メカ」または「警察」を持つ敵軍Sユニットがあるとき、次の能力を得る⇒BP+2000、SP1」・カード評価「メカか警察どちらかを持つ敵Sユニットが1体でもいれば良い」）", () => {
    const s = p1Battle({ battle: [inst("XG2-088", "mg")] }, { rush: [inst("XG2-089", "jb")] });
    expect(bpOf(s, "player1", "XG2-088:mg")).toBe(6000);
    expect(spOf(s, "player1", "XG2-088:mg")).toBe(1);
  });

  it("XG2-088: 【ジバンキラー】「メカ」も「警察」も持たない敵軍ユニットしかいなければ BP4000・SP なし（出典: atwiki/page-244）", () => {
    const s = p1Battle({ battle: [inst("XG2-088", "mg")] }, { battle: [inst("TST-UNIT-0", "x")] });
    expect(bpOf(s, "player1", "XG2-088:mg")).toBe(4000);
    expect(spOf(s, "player1", "XG2-088:mg")).toBe(0);
  });
});
