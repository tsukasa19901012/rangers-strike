/**
 * カード別スペック: XG3-063〜XG3-069（クロスギャザー ザ・Wインパクト 仮面ライダードレイクMF〜仮面ライダーディエンド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-069 Q1（page-2005。XG3-061 page-1925 Q1 と同じ）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-MORPH 系・R-CN-02・R-ADD-02・R-TGT）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  activateField,
  attack,
  bpOf,
  canActivateField,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  endTurnKeep,
  enemyAttackOn,
  enemyRushes,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceUp,
  inst,
  lastBattleBps,
  lineUp,
  morphCandidates,
  nextPhase,
  passEntry,
  PLAIN_VEHICLE,
  powerCards,
  refsOf,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  st,
  sUnit,
  targetsOf,
  useCard,
  useRef,
  zoneOf,
} from "./XG3-063-083.helpers";

const WOMAN = sUnit("SPEC-WOMAN", { bp: 1000, features: ["女"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1, sp: undefined });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2, sp: undefined });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3, sp: undefined });
const NOSP = sUnit("SPEC-NOSP", { bp: 1000, sp: undefined });
const ENEMY = sUnit("SPEC-EN", { category: "WB", bp: 1000 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500 });
const E4500 = sUnit("SPEC-E4500", { bp: 4500 });
const FFR_UNIT = sUnit("SPEC-FFR", { category: "OT", bp: 1000, features: ["FFR"] });
const EXTRA = [WOMAN, C1, C2, C3, NOSP, ENEMY, E3500, E4500, FFR_UNIT, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

/** 「※これはアタックされるときBP+3000される。」と【キャストオフ】（MF → RF）の共通テスト。 */
function maskedFormTests(opts: { id: string; name: string; page: string; rf: string; rfName: string; bp: number }) {
  const { id, page } = opts;
  it(`${id}: ※ アタックされるときは BP+3000（${opts.bp + 3000}）され、BP${opts.bp + 2500} のユニットとのバトルに勝つ（出典: ${page}「これはアタックされるときBP+3000される」）`, () => {
    const attacker = opts.bp + 2500 === 3500 ? "SPEC-E3500:atk" : "SPEC-E4500:atk";
    const s = resolveAll(settle(enemyAttackOn({ battle: [inst(id, "m")] }, `${id}:m`, attacker, {}, EXTRA)));
    expect(lastBattleBps(s)?.defender).toBe(opts.bp + 3000);
    expect(zoneOf(s, "player1", `${id}:m`)).toBe("battle");
  });

  const rushed = (cmd = releasedCat("OT", 2)) =>
    rushFromHand(board({ hand: [inst(id, "m")], power: powerCards(7), command: cmd, deck: [inst(opts.rf, "rf"), inst("TST-UNIT-0", "u"), ...deckCards(3)] }), "player1", `${id}:m`).state;

  it(`${id}:【キャストオフ】— ラッシュしたとき、OT を持つ自軍コマンドを1つホールドして、自軍山札の「${opts.rfName}」を自軍ラッシュエリアに出せる（ほかのカードは選べない。任意）（出典: ${page}「OTを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒自軍山札を見て「${opts.rfName}」のカードを1枚選び自軍ラッシュエリアに出す」）`, () => {
    const s0 = rushed();
    expectChoiceFrom(s0, "player1", id);
    expect(canSkip(s0)).toBe(true);
    let s = useRef(s0, `${id}:m`);
    expect(choiceIds(s)).toEqual([`${opts.rf}:rf`]);
    s = resolveAll(s, [`${opts.rf}:rf`, `${id}:m`]);
    expect(zoneOf(s, "player1", `${opts.rf}:rf`)).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("deck");
  });

  it(`${id}:【キャストオフ】— リリース状態の OT のコマンドがほかになければ発動できない（出典: ${page}「OTを持つ自軍コマンドを1つホールドして」）`, () => {
    const s = rushed(releasedCat("OT", 1));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
    expect(zoneOf(s, "player1", `${opts.rf}:rf`)).toBe("deck");
  });
}

/** 7- の RF（「…MF」1体をパワーゾーンに送れば必要パワー0）と「※これはアタックされる以外では相手に選ばれない」の共通テスト。 */
function riderFormTests(id: string, mf: string, mfName: string, page: string) {
  it(`${id}: 追加条件 — 自軍「${mfName}」1体をパワーゾーンに送れば必要パワー0でラッシュできる（出典: ${page}「追加条件：自軍「${mfName}」1体をパワーゾーンに送れば必要パワー0になる」）`, () => {
    const r = rushVia(board({ hand: [inst(id, "rf")], rush: [inst(mf, "mf")], command: releasedCat("OT", 1), power: [] }), "player1", `${id}:rf`, (a) => a.zordMaterialInstanceId === `${mf}:mf`);
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:rf`)).toBe("rush");
    expect(zoneOf(t, "player1", `${mf}:mf`)).toBe("power");
  });

  it(`${id}: 必要パワー7- — 「${mfName}」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    const mk = (n: number) => board({ hand: [inst(id, "rf")], command: releasedCat("OT", 1), power: powerCards(n) });
    expect(canStartRush(mk(6), "player1", `${id}:rf`)).toBe(false);
    expect(rushFromHand(mk(7), "player1", `${id}:rf`).ok).toBe(true);
  });

  it(`${id}: ※ アタックされる以外では相手に選ばれない（敵軍の RS-481 天空神【ホバリング】の候補にならない）（出典: ${page}「これはアタックされる以外では相手に選ばれない」）`, () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst(id, "rf"), inst("TST-UNIT-0", "s")], deck: deckCards(3) }, player2: { rush: [inst("RS-481", "tk")], deck: deckCards(3, "e") } }, EXTRA);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s"]);
  });
}

// ===========================================================================
describe("XG3-063 仮面ライダードレイクMF", () => {
  it("XG3-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-1926「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-063",
      "※これはアタックされるときBP+3000される。 【キャストオフ】これをラッシュしたとき、OTを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒自軍山札を見て「仮面ライダードレイクRF」のカードを1枚選び自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。",
    );
    expectStats("XG3-063", { name: "仮面ライダードレイクMF", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG3-063", ["N"]);
  });

  maskedFormTests({ id: "XG3-063", name: "仮面ライダードレイクMF", page: "atwiki/page-1926", rf: "XG3-064", rfName: "仮面ライダードレイクRF", bp: 1000 });
});

// ===========================================================================
describe("XG3-064 仮面ライダードレイクRF", () => {
  it("XG3-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-1954「SP：1/4」「必要パワー：7-」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText(
      "XG3-064",
      "※これはアタックされる以外では相手に選ばれない。 【ライダーシューティング】自軍ターン中、これがバトルエリアに出たとき、特徴「女」を持つユニットの数を数えてもよい。そうしたとき、その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。",
    );
    expectStats("XG3-064", { name: "仮面ライダードレイクRF", category: "OT", size: "S", bp: 1500, sp: "1/4", powerCost: "7-", comboNumber: undefined, features: ["仮面ライダー", "男", "加速"], rushCondition: "zord_down_send_to_power" });
    expectRarityIn("XG3-064", ["NR"]);
  });

  riderFormTests("XG3-064", "XG3-063", "仮面ライダードレイクMF", "atwiki/page-1954");

  /** 「女」のユニット: 自軍バトルエリア1体・敵軍ラッシュエリア1体（計2）。敵軍バトルエリア: 必要パワー1・2・3・追加条件を持つユニット（XG3-030）。 */
  const entered = () =>
    enter(battle({ rush: [inst("XG3-064", "rf")], battle: [inst("SPEC-WOMAN", "w1")] }, { battle: [inst("SPEC-C1", "c1"), inst("SPEC-C2", "c2"), inst("SPEC-C3", "c3"), inst("XG3-030", "cond")], rush: [inst("SPEC-WOMAN", "w2")] }), "XG3-064:rf");

  it.fails("XG3-064:【ライダーシューティング】— 自軍ターン中にバトルエリアに出たとき、「女」のユニットの数（両軍で2）以下の必要パワーの数字を持つ、追加条件のない敵軍ユニット（エリアを問わない）から選ぶ（数えるかは任意）（既知の不具合: CARD-XG3-064 候補が自軍の「女」のユニットになる）（出典: atwiki/page-1954「特徴「女」を持つユニットの数を数えてもよい。そうしたとき、その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニットを1体選び、持ち主のパワーゾーンに送る」・R-TGT）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-064");
    expect(choiceIds(s).sort()).toEqual(["SPEC-C1:c1", "SPEC-C2:c2", "SPEC-WOMAN:w2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG3-064:【ライダーシューティング】— 選んだユニットを持ち主のパワーゾーンに送る（既知の不具合: CARD-XG3-064）（出典: atwiki/page-1954「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(entered(), ["SPEC-C2:c2"]);
    expect(zoneOf(s, "player2", "SPEC-C2:c2")).toBe("power");
  });

  it.todo("XG3-064:【ライダーシューティング】— 敵軍ターン中にバトルエリアに出されたときは発動しない（出典: atwiki/page-1954「自軍ターン中、」）— 敵軍ターン中にこれをバトルエリアに出す手順を用意できない（相手の効果で出させようとしても、※「アタックされる以外では相手に選ばれない」でこれを選べない）");
});

// ===========================================================================
describe("XG3-065 仮面ライダーサソードMF", () => {
  it("XG3-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-1927「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-065",
      "※これはアタックされるときBP+3000される。 【キャストオフ】これをラッシュしたとき、OTを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒自軍山札を見て「仮面ライダーサソードRF」のカードを1枚選び自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。",
    );
    expectStats("XG3-065", { name: "仮面ライダーサソードMF", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG3-065", ["N"]);
  });

  maskedFormTests({ id: "XG3-065", name: "仮面ライダーサソードMF", page: "atwiki/page-1927", rf: "XG3-066", rfName: "仮面ライダーサソードRF", bp: 2000 });
});

// ===========================================================================
describe("XG3-066 仮面ライダーサソードRF", () => {
  it("XG3-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-1928「SP：1/4」「CN：1」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-066", "※これはアタックされる以外では相手に選ばれない。 【ライダースラッシュ】必要パワーの数字が1か、ナンバーの数字が1か、「SP1」を持つ敵軍Sユニットを1体選び、撃破してもよい。");
    expectStats("XG3-066", { name: "仮面ライダーサソードRF", category: "OT", size: "S", bp: 2500, sp: "1/4", powerCost: "7-", comboNumber: 1, features: ["仮面ライダー", "男", "加速"], rushCondition: "zord_down_send_to_power" });
    expectRarityIn("XG3-066", ["NR"]);
  });

  riderFormTests("XG3-066", "XG3-065", "仮面ライダーサソードMF", "atwiki/page-1928");

  /** 1番目に出る（NC）。敵軍: 必要パワー1・2（SP なし）・SP1・CN1（XG3-031）・SP なし必要パワー0・M ユニット。 */
  const nc = () =>
    line(["XG3-066:sr"], {}, { battle: [inst("SPEC-C1", "c1"), inst("SPEC-C2", "c2"), inst("TST-UNIT-0", "sp1"), inst("XG3-031", "cn1"), inst("SPEC-NOSP", "n")], rush: [inst("TST-UNIT-2", "m")] });

  it("XG3-066:【ライダースラッシュ】— 1番目に出れば（NC）、必要パワー1・ナンバー1・「SP1」のどれかを持つ敵軍 S ユニット（エリアを問わない）から選べる（任意）（出典: atwiki/page-1928「必要パワーの数字が1か、ナンバーの数字が1か、「SP1」を持つ敵軍Sユニットを1体選び、撃破してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-066");
    expect(choiceIds(s).sort()).toEqual(["SPEC-C1:c1", "TST-UNIT-0:sp1", "XG3-031:cn1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-066:【ライダースラッシュ】— 選んだユニットを撃破する（出典: atwiki/page-1928「撃破してもよい」）", () => {
    const s = resolveAll(nc(), ["XG3-031:cn1"]);
    expect(zoneOf(s, "player2", "XG3-031:cn1")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-067 インビジブル", () => {
  const TEXT =
    "自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、敵軍ターン中、撃破されて捨札になるとき、かわりに持ち主のパワーゾーンに送る。このカードに重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  it("XG3-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-1929「カテゴリ：オーバーテクノロジー」「必要パワー：2」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-067", TEXT);
    expectOpStats("XG3-067", { name: "インビジブル", category: "OT", powerCost: 2 });
    expectRarityIn("XG3-067", ["N"]);
  });

  const used = () => useCard(board({ hand: [inst("XG3-067", "iv")], rush: [inst("TST-UNIT-0", "u"), inst("TST-UNIT-2", "m")], command: releasedCat("OT", 1), power: powerCards(2) }), "player1", "XG3-067:iv");

  it.fails("XG3-067: 使うと自軍 S ユニット（M は選べない）を選び、このカードを自軍ラッシュエリアに置いてそのユニットを重ねる（既知の不具合: CARD-XG3-067 選択が開かず、このカードは捨札になる）（出典: atwiki/page-1929「自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG3-067");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
    const t = resolveAll(s, ["TST-UNIT-0:u"]);
    expect(zoneOf(t, "player1", "XG3-067:iv")).toBe("rush");
  });

  it.fails("XG3-067: 重ねたユニットが敵軍ターン中に撃破されて捨札になるときは、かわりに持ち主のパワーゾーンに送り、このカードは捨札になる（既知の不具合: CARD-XG3-067）（出典: atwiki/page-1929「敵軍ターン中、撃破されて捨札になるとき、かわりに持ち主のパワーゾーンに送る。このカードに重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = resolveAll(used(), ["TST-UNIT-0:u"]);
    expect(zoneOf(s, "player1", "XG3-067:iv")).toBe("rush");
    s = { ...s, phase: "battle", activePlayer: "player2", players: { ...s.players, player1: { ...s.players.player1, battle: s.players.player1.rush.filter((c) => c.instanceId === "TST-UNIT-0:u"), rush: s.players.player1.rush.filter((c) => c.instanceId !== "TST-UNIT-0:u") }, player2: { ...s.players.player2, battle: [inst("TST-UNIT-7", "atk")] } } };
    s = resolveAll(settle(attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:u", "player2")));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("power");
    expect(zoneOf(s, "player1", "XG3-067:iv")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-068 仮面ライダーディケイド", () => {
  const TEXT =
    "※モーフ 【この世界でやるべきこと】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、自分の手札を1枚選び捨札にしてもよい。そうしたとき、自軍山札を見て、特徴「FFR」を持つカードを1枚選び、自軍ラッシュエリアに出す。その後、山札をシャッフルする。";

  it("XG3-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-2004「SP：1/4」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-068", TEXT);
    expectStats("XG3-068", { name: "仮面ライダーディケイド", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ディケイドライバー"] });
    expectRarityIn("XG3-068", ["R"]);
  });

  it("XG3-068: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（XG1-077 仮面ライダーディケイド）と置き換えられる（特徴が違う XG3-075 は選べない）（出典: atwiki/page-2004「※モーフ」・R-KW-MORPH 系）", () => {
    const s = enemyRushes({ battle: [inst("XG3-068", "d")], command: [inst("XG1-077", "d1"), inst("XG3-075", "cf")] }, "SPEC-EN:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["XG1-077:d1"]);
  });

  const rushPhase = () => board({ rush: [inst("XG3-068", "d")], hand: [inst("TST-OP", "h")], deck: [inst("SPEC-FFR", "ffr"), inst("TST-UNIT-0", "u"), ...deckCards(3)] });

  it.fails("XG3-068:【この世界でやるべきこと】— 自軍ラッシュフェイズ中、手札を1枚捨札にして、自軍山札の特徴「FFR」を持つカードを自軍ラッシュエリアに出せる（既知の不具合: CARD-XG3-068 起動がない）（出典: atwiki/page-2004「自分の手札を1枚選び捨札にしてもよい。そうしたとき、自軍山札を見て、特徴「FFR」を持つカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(useRef(rushPhase(), "XG3-068:d"), ["TST-OP:h", "SPEC-FFR:ffr"]);
    expect(zoneOf(s, "player1", "TST-OP:h")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-FFR:ffr")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("deck");
  });

  it.fails("XG3-068:【この世界でやるべきこと】— 1回のラッシュフェイズに1度だけ（2度目は使えない）（既知の不具合: CARD-XG3-068）（出典: atwiki/page-2004「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s0 = board({ rush: [inst("XG3-068", "d")], hand: [inst("TST-OP", "h"), inst("TST-OP", "h2")], deck: [inst("SPEC-FFR", "ffr"), inst("SPEC-FFR", "ffr2"), ...deckCards(3)] });
    const s = resolveAll(useRef(s0, "XG3-068:d"), ["TST-OP:h", "SPEC-FFR:ffr"]);
    expect(zoneOf(s, "player1", "SPEC-FFR:ffr")).toBe("rush");
    expect(refsOf(s, "XG3-068:d")).toEqual([]);
  });
});

// ===========================================================================
describe("XG3-069 仮面ライダーディエンド", () => {
  const TEXT =
    "【カメンライド】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、自軍パワーゾーンのオモテ向きのカードから特徴「仮面ライダー」を持ち追加条件を持たないユニットカードを2枚まで選び、自軍ラッシュエリアに出してもよい。この効果で出したユニットは、このターン、アタックもストライクもできず、このターンを終えるとき、自軍エリアにあれば捨札になる。";

  it("XG3-069: カタログ本文・スペックが出典と一致（出典: atwiki/page-2005「SP：1/4」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-069", TEXT);
    expectStats("XG3-069", { name: "仮面ライダーディエンド", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ディエンドライバー"] });
    expectRarityIn("XG3-069", ["R"]);
  });

  /** 自軍パワーゾーン（オモテ向き）: 追加条件のない仮面ライダー2枚・追加条件を持つ仮面ライダー（XG3-062）・仮面ライダーでないユニット。 */
  const rushPhase = (p1: P1 = {}) =>
    board({ rush: [inst("XG3-069", "de")], power: [faceUp("XG3-061", "p1"), faceUp("XG3-062", "p2"), faceUp("XG3-063", "p3"), faceUp("TST-UNIT-0", "p4")], ...p1 });

  it("XG3-069:【カメンライド】— 自軍ラッシュフェイズ中、自軍パワーゾーンのオモテ向きの、追加条件のない「仮面ライダー」のユニットカードから選べる（任意）（出典: atwiki/page-2005「特徴「仮面ライダー」を持ち追加条件を持たないユニットカードを2枚まで選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = activateField(rushPhase(), "XG3-069:de");
    expectChoiceFrom(s, "player1", "XG3-069");
    expect(choiceIds(s).sort()).toEqual(["XG3-061:p1", "XG3-063:p3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-069:【カメンライド】— 2枚まで自軍ラッシュエリアに出す。1回のラッシュフェイズに1度だけ（出典: atwiki/page-2005「2枚まで」「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = resolveAll(activateField(rushPhase(), "XG3-069:de"), ["XG3-061:p1", "XG3-063:p3", "confirm"]);
    expect(zoneOf(s, "player1", "XG3-061:p1")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-063:p3")).toBe("rush");
    expect(canActivateField(s, "XG3-069:de")).toBe(false);
  });

  it("XG3-069:【カメンライド】— 出したユニットはこのターン、アタックもストライクもできない（出典: atwiki/page-2005「この効果で出したユニットは、このターン、アタックもストライクもできず」）", () => {
    let s = resolveAll(activateField(rushPhase(), "XG3-069:de"), ["XG3-063:p3", "confirm"]);
    s = enter(nextPhase(s), "XG3-063:p3");
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, battle: [inst("TST-UNIT-0", "e")] } } };
    expect(targetsOf(s, "XG3-063:p3")).toEqual([]);
    expect(canStrike(s, "XG3-063:p3")).toBe(false);
  });

  it("XG3-069:【カメンライド】— 出したユニットは、このターンを終えるときに自軍エリアにあれば捨札になる（出典: atwiki/page-2005「このターンを終えるとき、自軍エリアにあれば捨札になる」）", () => {
    let s = resolveAll(activateField(rushPhase(), "XG3-069:de"), ["XG3-063:p3", "confirm"]);
    s = passEntry(enter(nextPhase(s), "XG3-063:p3"));
    s = resolveAll(endTurnKeep(s));
    expect(zoneOf(s, "player1", "XG3-063:p3")).toBe("discard");
  });

  it("XG3-069: Q1 — 【カメンライド】で出したガタックMF の【キャストオフ】でガタックRF を出せ、MF をパワーゾーンに送れば RF はカメンライドの制限を受けない（アタックできる）（出典: atwiki/page-2005 Q1「【キャストオフ】の効果を発動することは可能です」「制限の影響は受けません」）", () => {
    let s = activateField(rushPhase({ command: releasedCat("OT", 1), deck: [inst("XG3-062", "rf"), ...deckCards(3)] }), "XG3-069:de");
    s = resolveAll(s, ["XG3-061:p1", "confirm"]);
    s = resolveAll(useRef(s, "XG3-061:p1"), ["XG3-062:rf", "XG3-061:p1"]);
    expect(zoneOf(s, "player1", "XG3-062:rf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-061:p1")).toBe("power");
    s = enter(nextPhase(s), "XG3-062:rf");
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, battle: [inst("TST-UNIT-0", "e")] } } };
    expect(targetsOf(s, "XG3-062:rf")).toEqual(["TST-UNIT-0:e"]);
  });
});

void bpOf;
