/**
 * カード別スペック: XP-027〜XP-032（クロスギャザー プロモーションカード ダイノミッション〜ゴーカイオー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ を「XP-」とカード名で検索: 本範囲のカードの項はない。
 *     atwiki に転載された公式 Q&A: XP-028 Q1（atwiki/page-2369。atwiki の注釈は公式コラム vol44 の整理と食い違うとする。
 *     docs/verification/unverified/XP-questions.md に問いとして残し、テストは公式 Q&A の答えのまま書く）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XP-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-BREAKER-01/02・R-KW-MORPH-01/02・R-KW-REG・R-KW-CROSS-01・R-POW-01・R-KW-FUSION）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XP-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { activate, onlyActivateOrSkip } from "./revealGate.helpers";
import {
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canActivateUnit,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  enemyRushes,
  enter,
  expectCatalogText,
  expectOp,
  expectUnit,
  inst,
  legal,
  morphCandidates,
  pick,
  playOp,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  rushFromHand,
  rushPhase,
  rushVia,
  settle,
  skip,
  st,
  sUnit,
  wingTests,
  zoneOf,
} from "./XP-017-032.helpers";
import type { GameState } from "../types/game";

const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", powerCost: 0, bp: 1000 });
const E55 = sUnit("SPEC-E55", { bp: 5500 });
const E45 = sUnit("SPEC-E45", { bp: 4500 });
const WD = sUnit("SPEC-WD", { category: "ET", bp: 1000, features: ["ダブルドライバー"] });
const PIRATE = sUnit("SPEC-PIRATE", { category: "OT", bp: 1000, features: ["宇宙海賊"] });
const RED = sUnit("SPEC-RED", { category: "OT", bp: 1000, features: ["レッド"] });
const OOO = sUnit("SPEC-OOO", { category: "WB", bp: 1000, features: ["仮面ライダー", "男", "オーズドライバー"] });
const RIDER_D = sUnit("SPEC-RIDER-D", { category: "WB", bp: 1000, features: ["ミラーライダー"] });
const MULTI_CMD = sUnit("SPEC-MULTI-CMD", { category: ["WB", "OT"] as never, bp: 1000 });
const MA_MULTI = sUnit("SPEC-MA-MULTI", { category: ["MA", "WB"] as never, bp: 1000 });
const MA_OT_MULTI = sUnit("SPEC-MA-OT", { category: ["MA", "OT"] as never, bp: 1000 });
const L_UNIT = sUnit("SPEC-L", { size: "L", bp: 9000 } as never);
const EXTRA = [ENEMY0, E55, E45, WD, PIRATE, RED, OOO, RIDER_D, MULTI_CMD, MA_MULTI, MA_OT_MULTI, L_UNIT];

// ===========================================================================
describe("XP-027 ダイノミッション", () => {
  const TEXT =
    "合体が必要な自軍ユニットが１体もなければ、特徴「メカ」を持たない、５体以上の合体が必要な自分の手札を１枚選び相手に見せる。そうしたとき、自軍ユニットまたは自軍ビークルを好きな数選び捨札にしてもよい。その後、見せたカードの５体以上の合体に必要な、ユニットまたはビークルのカードが自軍捨札にすべてあれば、見せたカードをこのカードに重ねて自軍ラッシュエリアに出す。重ねたユニットがユニットでなくなるとき、このカードを捨札にしてその場に留める。";

  it("XP-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-2370）", () => {
    expectCatalogText("XP-027", TEXT);
    expectOp("XP-027", { name: "ダイノミッション", category: "WB", powerCost: 5, rarity: "PR" });
  });

  // 大獣神（RS-286）の合体に必要な5体: ティラノザウルス・ジュウマンモスはラッシュエリア、残り3体は捨札。
  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase({
      hand: [inst("XP-027", "dm"), inst("RS-286", "dj"), inst("RS-042", "dr")],
      rush: [inst("RS-035", "t"), inst("RS-036", "m")],
      discard: [inst("RS-037", "tr"), inst("RS-038", "sb"), inst("RS-039", "pt")],
      command: releasedCat("WB", 1),
      power: powerCards(5),
      ...p1,
    });

  it("XP-027: WB のコマンドとパワー5で使える（出典: atwiki/page-2370「必要パワー：5」）", () => {
    const r = playOp(board(), "player1", "XP-027:dm");
    expect(r.ok, r.error).toBe(true);
  });

  it("XP-027: 合体が必要な自軍ユニットがなければ、「メカ」を持たない5体以上の合体が必要な手札（大獣神）を選んで見せる — メカのデカレンジャーロボは選べない（出典: atwiki/page-2370）", () => {
    const r = playOp(board(), "player1", "XP-027:dm");
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("XP-027");
    expect(choiceIds(r.state)).toContain("RS-286:dj");
    expect(choiceIds(r.state)).not.toContain("RS-042:dr");
  });

  it("XP-027: 自軍ユニットを好きな数捨札にした後、合体に必要な5体が捨札にすべてあれば、大獣神をこのカードに重ねてラッシュエリアに出す（必要パワーは問わない）（出典: atwiki/page-2370・カード評価「必要パワーも無視できる」）", () => {
    let s = playOp(board(), "player1", "XP-027:dm").state;
    s = pick(s, "RS-286:dj");
    for (const id of ["RS-035:t", "RS-036:m"]) if (choiceIds(s).includes(id)) s = pick(s, id);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-286:dj")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-035:t")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-036:m")).toBe("discard");
  });

  it("XP-027: 合体が必要な自軍ユニット（大獣神）が場にあれば、手札を見せない（何も起きない）（出典: atwiki/page-2370「合体が必要な自軍ユニットが１体もなければ」）", () => {
    const r = playOp(board({ battle: [inst("RS-286", "on")] }), "player1", "XP-027:dm");
    expect(r.ok, r.error).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "RS-286:dj")).toBe("hand");
  });

  it("XP-027: 重ねたユニットがユニットでなくなるとき、かわりにこのカードを捨札にしてその場に留まる（出典: atwiki/page-2370「重ねたユニットがユニットでなくなるとき、このカードを捨札にしてその場に留める」・カード評価「1回分の除去耐性」）", () => {
    let s = playOp(board(), "player1", "XP-027:dm").state;
    s = pick(s, "RS-286:dj");
    for (const id of ["RS-035:t", "RS-036:m"]) if (choiceIds(s).includes(id)) s = pick(s, id);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-286:dj")).toBe("rush");
    expect(zoneOf(s, "player1", "XP-027:dm")).not.toBe("discard");
  });
});

// ===========================================================================
describe("XP-028 ワンダーゴセイグレート", () => {
  const TEXT =
    "※ウイング 【サモン・ワンダーパワー】これが自分の手札にある間、相手が常駐以外のオペレーションカードを使用して、その処理をすべて終えたとき、MAとMA以外の自軍コマンドを1つずつホールドして、これを自軍ラッシュエリアに出してもよい。そうしたとき、敵軍捨札からオペレーションカードを1枚選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("XP-028: カタログ本文・スペックが出典と一致（L ユニット・必要パワー4+）（出典: atwiki/page-2369）", () => {
    expectCatalogText("XP-028", TEXT);
    expectUnit("XP-028", {
      name: "ワンダーゴセイグレート",
      category: "MA",
      size: "L",
      bp: 7000,
      sp: "1/3",
      powerCost: "4+",
      features: ["魔法", "獣", "人型"],
      rushConditionText: "リードを持つ自軍Sユニット1体を捨札にする",
      rarity: "PR",
    });
  });

  wingTests("XP-028", "atwiki/page-2369");

  it("XP-028: 追加条件 — リードを持つ自軍 S ユニット（XP-022 ゴセイレッド）がいればラッシュできる（出典: atwiki/page-2369「追加条件：リードを持つ自軍Sユニット1体を捨札にする」）", () => {
    const s = rushPhase({ hand: [inst("XP-028", "wg")], rush: [inst("XP-022", "gr")], command: releasedCat("MA", 1), power: powerCards(4) });
    expect(canStartRush(s, "player1", "XP-028:wg")).toBe(true);
  });

  it("XP-028: 追加条件 — リードを持たない S ユニットしかいなければラッシュできない（出典: atwiki/page-2369「リードを持つ自軍Sユニット」）", () => {
    const s = rushPhase({ hand: [inst("XP-028", "wg")], rush: [inst("TST-UNIT-0", "p")], command: releasedCat("MA", 1), power: powerCards(4) });
    expect(canStartRush(s, "player1", "XP-028:wg")).toBe(false);
  });

  /** 敵軍（player2）が自分のラッシュフェイズに opId（手札）を使い、処理を終えたところ。player1 は手札に XP-028。 */
  const afterEnemyOp = (opId: string, p1Command = [...releasedCat("MA", 1), ...releasedCat("WB", 1)], p2: Partial<GameState["players"]["player2"]> = {}) => {
    const s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { hand: [inst("XP-028", "wg")], command: p1Command, deck: deckCards(3) },
        player2: { hand: [inst(opId, "op")], command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], power: powerCards(3), deck: deckCards(3, "e"), ...p2 },
      },
      EXTRA,
    );
    const r = playOp(s, "player2", `${opId}:op`);
    if (!r.ok) throw new Error(`afterEnemyOp: ${r.error}`);
    return settle(r.state);
  };
  const summonOffered = (s: GameState) =>
    s.pendingEffectChoice?.sourceCardId === "XP-028" || legal(s).some((a) => a.playerId === "player1" && JSON.stringify(a).includes("XP-028:wg"));

  it("XP-028: 【サモン・ワンダーパワー】相手が常駐以外のオペレーションを使い終えたとき、MA と MA 以外の自軍コマンドを1つずつホールドして手札のこれをラッシュエリアに出せる（出典: atwiki/page-2369）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP"))).toBe(true);
  });

  it("XP-028: 【サモン・ワンダーパワー】MA 以外のコマンドがなければ（MA だけ）発動できない（出典: atwiki/page-2369「MAとMA以外の自軍コマンドを1つずつ」）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP", releasedCat("MA", 2)))).toBe(false);
  });

  it("XP-028: 【サモン・ワンダーパワー】相手が常駐のオペレーション（XP-020 護星天使）を使ったときは発動できない（出典: atwiki/page-2369「常駐以外のオペレーションカード」）", () => {
    expect(summonOffered(afterEnemyOp("XP-020"))).toBe(false);
  });

  it("XP-028: 公式Q&A — MA だけを持つコマンドと、MA を含むマルチカテゴリのコマンドをホールドして発動できる（出典: atwiki/page-2369 Q1「はい、できます。」。atwiki の注釈は公式コラム vol44 により発動できないとする — XP-questions.md）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP", [...releasedCat("MA", 1), released("SPEC-MA-MULTI", "mm")]))).toBe(true);
  });

  it("XP-028: 【サモン・ワンダーパワー】MA と OT のコマンド（1つずつ）で発動できる（出典: atwiki/page-2369「MAとMA以外の自軍コマンドを1つずつ」）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP", [...releasedCat("MA", 1), ...releasedCat("OT", 1)]))).toBe(true);
  });

  it("XP-028: 【サモン・ワンダーパワー】WB と OT のコマンドだけ（MA がない）なら発動できない（出典: atwiki/page-2369「MAとMA以外の自軍コマンド」）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP", [...releasedCat("WB", 1), ...releasedCat("OT", 1)]))).toBe(false);
  });

  it("XP-028: 【サモン・ワンダーパワー】MA／OT のマルチカテゴリ1枚と OT のコマンドで発動できる（マルチカテゴリを MA として数える）（出典: atwiki/page-2369 Q1）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP", [released("SPEC-MA-OT", "mo"), ...releasedCat("OT", 1)]))).toBe(true);
  });

  it("XP-028: 【サモン・ワンダーパワー】MA／OT のマルチカテゴリ1枚だけでは発動できない（コマンドを「1つずつ」、2つホールドする）（出典: atwiki/page-2369「1つずつホールドして」）", () => {
    expect(summonOffered(afterEnemyOp("TST-OP", [released("SPEC-MA-OT", "mo")]))).toBe(false);
  });

  it.todo("XP-028: 【サモン・ワンダーパワー】そうしたとき、敵軍捨札からオペレーションを1枚選び、持ち主のパワーゾーンにダメージにして置いてもよい（出典: atwiki/page-2369）— 発動そのものが合法手に出ない（既知の不具合 CARD-XP-028）ため、その後の手順を組めない");
});

// ===========================================================================
describe("XP-029 仮面ライダーW・CAX", () => {
  const TEXT =
    "※ブレイカー ※これは毎ターン、可能ならバトルエリアに出る。 ※これはホールド状態のコマンド1つにつきBP+1000される。 【まだよ・・・まだまだ憎しみが足りないわ・・・】これがバトルエリアにある間、相手がターンを終えるとき、これのBPが9000以上なら、相手に1点ダメージを与える。8500以下なら、自分は1点ダメージを受けるか、自軍ユニットを1体選び撃破するかを選ぶ。";

  it("XP-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-2362）", () => {
    expectCatalogText("XP-029", TEXT);
    expectUnit("XP-029", {
      name: "仮面ライダーW・CAX",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: "5+",
      features: ["仮面ライダー", "男", "警察", "ダブルドライバー"],
      // atwiki の「追加条件：」欄は「追加条件：追加条件：特徴…」と二重に書かれている（カタログの文はその2つ目から）。
      rushConditionText: "追加条件：特徴「ダブルドライバー」か「アクセルドライバー」を持つ自軍ユニット１体を捨札にする",
      rarity: "PR",
    });
  });

  const rushBoard = (partner: string[]) =>
    rushPhase({ hand: [inst("XP-029", "w")], rush: partner.map((p, i) => inst(p, `p${i}`)), command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);

  it("XP-029: 追加条件 — 特徴「ダブルドライバー」の自軍ユニットを捨札にしてラッシュできる（出典: atwiki/page-2362）", () => {
    const r = rushFromHand(rushBoard(["SPEC-WD"]), "player1", "XP-029:w");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "SPEC-WD:p0")).toBe("discard");
  });

  it("XP-029: 追加条件 — 特徴「アクセルドライバー」の自軍ユニット（XP-026 仮面ライダーアクセル）でもラッシュできる（出典: atwiki/page-2362「か「アクセルドライバー」」）", () => {
    expect(canStartRush(rushBoard(["XP-026"]), "player1", "XP-029:w")).toBe(true);
  });

  it("XP-029: 追加条件 — どちらの特徴も持たないユニットしかいなければラッシュできない（出典: atwiki/page-2362）", () => {
    expect(canStartRush(rushBoard(["TST-UNIT-0"]), "player1", "XP-029:w")).toBe(false);
  });

  it("XP-029: ※ブレイカー — ブレイカーを持たない敵軍ユニットの効果（XP-022【レッドブレイク】）に選ばれない（出典: atwiki/page-2362「※ブレイカー」・R-KW-BREAKER-01）", () => {
    const s = enter(st({ player1: { rush: [inst("XP-022", "gr")], deck: deckCards(3) }, player2: { battle: [inst("XP-029", "w"), inst("TST-UNIT-0", "o")], deck: deckCards(3, "e") } }), "XP-022:gr");
    expect(choiceIds(s)).toContain("TST-UNIT-0:o");
    expect(choiceIds(s)).not.toContain("XP-029:w");
  });

  it("XP-029: ※ブレイカー — 本来のカード名が同じ自軍ユニットがあるとラッシュできない（ないときはできる）（出典: atwiki/page-2362・R-KW-BREAKER-02）", () => {
    expect(canStartRush(rushBoard(["SPEC-WD"]), "player1", "XP-029:w")).toBe(true);
    const same = rushPhase({ hand: [inst("XP-029", "w")], rush: [inst("SPEC-WD", "p0")], battle: [inst("XP-029", "same")], command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);
    expect(canStartRush(same, "player1", "XP-029:w")).toBe(false);
  });

  it("XP-029: ※ 毎ターン、可能ならバトルエリアに出る — 出られるうちはバトルフェイズを終えられない（出典: atwiki/page-2362「可能ならバトルエリアに出る」）", () => {
    const s = st({ player1: { rush: [inst("XP-029", "w")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(canEnter(s, "XP-029:w")).toBe(true);
    expect(legal(s).some((a) => a.type === "end_phase" && a.playerId === "player1")).toBe(false);
  });

  it("XP-029: ※ ホールド状態のコマンド1つにつき BP+1000 — 自軍2つ・敵軍1つで BP6000（敵軍のコマンドも数える）（出典: atwiki/page-2362・カード評価「BP上昇効果は敵軍コマンドも数える」）", () => {
    const s = st({ player1: { battle: [inst("XP-029", "w")], command: [...releasedCat("ET", 2).map((c) => ({ ...c, commandHeld: true })), ...releasedCat("WB", 1)] }, player2: { command: releasedCat("WB", 1).map((c) => ({ ...c, commandHeld: true })) } });
    expect(bpOf(s, "player1", "XP-029:w")).toBe(6000);
  });

  const enemyEnds = (heldCount: number) => {
    const held = releasedCat("ET", heldCount).map((c) => ({ ...c, commandHeld: true }));
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XP-029", "w"), inst("TST-UNIT-0", "o")], command: held, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    return act(s, legal(s).find((a) => a.type === "end_phase" && a.playerId === "player2")!);
  };

  it("XP-029: 【まだよ…】相手がターンを終えるとき BP9000 以上（ホールド6つ）なら、相手に1点ダメージ（出典: atwiki/page-2362）", () => {
    const s = settle(enemyEnds(6));
    expect(s.players.player2.damage).toBe(1);
  });

  it("XP-029: 【まだよ…】BP8500 以下なら、自分は1点ダメージを受けるか自軍ユニット1体を撃破するかを選ぶ（出典: atwiki/page-2362）", () => {
    const s = enemyEnds(0);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-029");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
  });

  it("XP-029: 【まだよ…】自分がターンを終えるときは何も起きない（出典: atwiki/page-2362「相手がターンを終えるとき」）", () => {
    const s0 = st({ phase: "end", player1: { battle: [inst("XP-029", "w")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const s = settle(act(s0, legal(s0).find((a) => a.type === "end_phase" && a.playerId === "player1")!));
    expect(s.players.player1.damage).toBe(0);
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player1", "XP-029:w")).toBe("battle");
  });
});

// ===========================================================================
describe("XP-030 仮面ライダーオーズ・サゴーゾコンボ", () => {
  const TEXT = "※モーフ ※レジスト ※これはホールド状態なら、アタックするときBP+2000される。 【打ち抜く剛腕】自軍ターン中、これをラッシュしたとき、敵軍コマンドを1つ選びホールドしてもよい。";

  it("XP-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-2368）", () => {
    expectCatalogText("XP-030", TEXT);
    expectUnit("XP-030", {
      name: "仮面ライダーオーズ・サゴーゾコンボ",
      category: "WB",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 5,
      features: ["仮面ライダー", "男", "オーズドライバー"],
      rarity: "PR",
    });
  });

  it("XP-030: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのオモテ向きのユニットカードと置き換えられる（出典: atwiki/page-2368「※モーフ」・R-KW-MORPH-01/02）", () => {
    const s = enemyRushes({ battle: [inst("XP-030", "sg")], command: [released("SPEC-OOO", "oo"), released("TST-UNIT-0", "x")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["SPEC-OOO:oo"]);
  });

  it("XP-030: ※レジスト — 敵軍ユニットにアタックされたとき、レジストを宣言できる（出典: atwiki/page-2368「※レジスト」・R-KW-REG）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XP-030", "sg")] }, "XP-030:sg", {}, "TST-UNIT-7:atk", EXTRA))).toBe(true);
  });

  it("XP-030: ※ ホールド状態ならアタックするとき BP+2000 — BP5500 の敵軍ユニットに BP6000 で勝つ（出典: atwiki/page-2368）", () => {
    const s = st({ player1: { battle: [{ ...inst("XP-030", "sg"), commandHeld: true }], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E55", "e")], deck: deckCards(3, "e") } }, EXTRA);
    const r = settle(attack(s, "XP-030:sg", "SPEC-E55:e"));
    expect(zoneOf(r, "player2", "SPEC-E55:e")).toBe("discard");
  });

  it("XP-030: ※ リリース状態なら BP+2000 されない — BP4500 の敵軍ユニットに負ける（出典: atwiki/page-2368「ホールド状態なら」）", () => {
    const s = st({ player1: { battle: [inst("XP-030", "sg")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E45", "e")], deck: deckCards(3, "e") } }, EXTRA);
    const r = settle(attack(s, "XP-030:sg", "SPEC-E45:e"));
    expect(zoneOf(r, "player2", "SPEC-E45:e")).toBe("battle");
  });

  const rushed = () => rushVia(rushPhase({ hand: [inst("XP-030", "sg")], command: releasedCat("WB", 1), power: powerCards(5) }, { command: [released("TST-OP", "ec")] }), "player1", "XP-030:sg");

  it("XP-030: 【打ち抜く剛腕】自軍ターン中にラッシュしたとき、敵軍コマンドを1つ選びホールドする（出典: atwiki/page-2368）", () => {
    const r = rushed();
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("XP-030");
    const s = settle(pick(r.state, "TST-OP:ec"));
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:ec")?.commandHeld).toBe(true);
  });

  it("XP-030: 【打ち抜く剛腕】は任意（「ホールドしてもよい」）— 選ばずに済ませられる（出典: atwiki/page-2368「ホールドしてもよい」）", () => {
    expect(canSkip(rushed().state)).toBe(true);
  });
});

// ===========================================================================
describe("XP-031 仮面ライダーオーズ・タトバコンボ×仮面ライダー電王SF", () => {
  const TEXT =
    "※クロス1 【メダルと切符と40周年】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、「ライダー」か「イマジン」か「ショッカー」のどれかを含む特徴を持つ自軍捨札を1枚選び、ゲームから除外してもよい。そうしたとき、自軍山札の上から3枚をオモテにして、その中から1枚選び手札に加え、それ以外は好きな順で山札の下に戻す。";

  it("XP-031: カタログ本文・スペックが出典と一致（WB／OT のマルチカテゴリ）（出典: atwiki/page-2446）", () => {
    expectCatalogText("XP-031", TEXT);
    expectUnit("XP-031", {
      name: "仮面ライダーオーズ・タトバコンボ×仮面ライダー電王SF",
      category: ["WB", "OT"],
      size: "S",
      bp: 4000,
      sp: "1/2",
      powerCost: "3+",
      features: ["仮面ライダー", "DEN-O", "男"],
      rushConditionText: "追加で自軍コマンドを1つホールドする",
      rarity: "PR",
    });
  });

  it("XP-031: 追加条件 — WB と OT のコマンドがあれば、追加で1つホールドしてラッシュできる（ホールドは合わせて2つ）（出典: atwiki/page-2446・R-CAT-02）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("XP-031", "tt")], command: [...releasedCat("WB", 1), ...releasedCat("OT", 1)], power: powerCards(3) }), "player1", "XP-031:tt");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XP-031:tt")).toBe("rush");
    expect(r.state.players.player1.command.filter((c) => c.commandHeld).length).toBe(2);
  });

  it("XP-031: 追加条件 — リリース状態のコマンドが1つしかなければラッシュできない（出典: atwiki/page-2446「追加で自軍コマンドを1つホールドする」）", () => {
    expect(canStartRush(rushPhase({ hand: [inst("XP-031", "tt")], command: releasedCat("WB", 1), power: powerCards(3) }), "player1", "XP-031:tt")).toBe(false);
  });

  it("XP-031: ※クロス1 — 自軍バトルエリアにある間、右に並ぶ CN3 のユニット（XG1-007【チェンジソード】「SP1」）は2番目で NC が成立する（出典: atwiki/page-2446「※クロス1」・R-KW-CROSS-01）", () => {
    const s = enter(st({ player1: { battle: [inst("XP-031", "tt")], rush: [inst("XG1-007", "cd")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }), "XG1-007:cd");
    expect(canStrike(s, "XG1-007:cd")).toBe(true);
  });

  const medalBoard = () =>
    rushPhase({ rush: [inst("XP-031", "tt")], discard: [inst("XP-026", "ac"), inst("TST-UNIT-0", "x")], deck: [inst("TST-UNIT-7", "d1"), inst("TST-OP", "d2"), inst("TST-UNIT-0", "d3"), ...deckCards(3)] });

  it("XP-031: 【メダルと切符と40周年】自軍ラッシュフェイズに、特徴に「ライダー」を含む自軍捨札（XP-026）を除外できる（ほかの捨札は選べない）（出典: atwiki/page-2446）", () => {
    let s = medalBoard();
    expect(canActivateUnit(s, "XP-031:tt")).toBe(true);
    const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XP-031:tt"))!;
    s = act(s, a);
    expect(choiceIds(s)).toEqual(["XP-026:ac"]);
  });

  it("XP-031: 【メダルと切符と40周年】除外したとき、山札の上から3枚をオモテにして1枚を手札に加え、残りは山札の下へ（出典: atwiki/page-2446）", () => {
    let s = medalBoard();
    const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XP-031:tt"))!;
    s = pick(act(s, a), "XP-026:ac");
    s = settle(pick(s, "TST-UNIT-7:d1"));
    expect(s.players.player1.hand.map((c) => c.instanceId)).toContain("TST-UNIT-7:d1");
    expect(s.players.player1.discard.map((c) => c.instanceId)).not.toContain("XP-026:ac");
    expect(s.players.player1.deck.slice(-2).map((c) => c.instanceId).sort()).toEqual(["TST-OP:d2", "TST-UNIT-0:d3"]);
    // 残りの2枚は番号を付けて山札の下の順を選ぶ。
    expect(s.pendingEffectChoice?.effectId).toBe("deck_bottom_order");
    s = settle(pick(pick(s, "TST-UNIT-0:d3"), "order_done"));
    expect(s.players.player1.deck.slice(-2).map((c) => c.instanceId)).toEqual(["TST-UNIT-0:d3", "TST-OP:d2"]);
  });

  it.todo("XP-031: 【メダルと切符と40周年】自軍ラッシュフェイズごとに1度だけ（出典: atwiki/page-2446）— 起動が合法手に出ない（既知の不具合 CARD-XP-031）ため、2度目を確かめる手順を組めない");
});

// ===========================================================================
describe("XP-032 ゴーカイオー", () => {
  const TEXT =
    "※これは、自軍パワーの数5につきBP+2000される。 【レジェンドを求めて】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍山札を見て、Sユニット以外のユニットカードを1枚選び、自軍パワーゾーンに置いてもよい。その後、山札をシャッフルする。";

  it("XP-032: カタログ本文・スペックが出典と一致（L ユニット・必要パワー6+）（出典: atwiki/page-2444）", () => {
    expectCatalogText("XP-032", TEXT);
    expectUnit("XP-032", {
      name: "ゴーカイオー",
      category: "OT",
      size: "L",
      bp: 7000,
      sp: "1/4",
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushConditionText: "特徴「レッド」または「宇宙海賊」を持つ自軍ユニット1体を捨札にする",
      rarity: "PR",
    });
  });

  const rushBoard = (partner: string) =>
    rushPhase({ hand: [inst("XP-032", "gk")], rush: [inst(partner, "p")], command: releasedCat("OT", 1), power: powerCards(6) }, {}, EXTRA);

  it("XP-032: 追加条件 — 特徴「レッド」の自軍ユニット（RS-674 シンケンレッド）を捨札にしてラッシュできる（出典: atwiki/page-2444）", () => {
    const r = rushFromHand(rushBoard("RS-674"), "player1", "XP-032:gk");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "RS-674:p")).toBe("discard");
  });

  it("XP-032: 追加条件 — カード名に「レッド」を含まない、特徴「レッド」だけの自軍ユニットでもラッシュできる（出典: atwiki/page-2444「特徴「レッド」」）", () => {
    const r = rushFromHand(rushBoard("SPEC-RED"), "player1", "XP-032:gk");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "SPEC-RED:p")).toBe("discard");
  });

  it("XP-032: 追加条件 — 特徴「宇宙海賊」の自軍ユニットでもラッシュできる（出典: atwiki/page-2444「または「宇宙海賊」」）", () => {
    expect(canStartRush(rushBoard("SPEC-PIRATE"), "player1", "XP-032:gk")).toBe(true);
  });

  it("XP-032: 追加条件 — どちらの特徴も持たないユニットしかいなければラッシュできない（出典: atwiki/page-2444）", () => {
    expect(canStartRush(rushBoard("TST-UNIT-0"), "player1", "XP-032:gk")).toBe(false);
  });

  const bp = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    bpOf(st({ player1: { battle: [inst("XP-032", "gk")], deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA), "player1", "XP-032:gk");

  it("XP-032: ※ 自軍パワーの数5につき BP+2000 — パワー5で9000、10で11000（出典: atwiki/page-2444）", () => {
    expect(bp({ power: powerCards(5) })).toBe(9000);
    expect(bp({ power: powerCards(10) })).toBe(11000);
  });

  it("XP-032: ※ パワー4なら BP は上がらない（7000）（出典: atwiki/page-2444「5につき」）", () => {
    expect(bp({ power: powerCards(4) })).toBe(7000);
  });

  it("XP-032: ※ 「パワーの数」は敵軍コマンドゾーンのマルチカテゴリも数える — パワーゾーン4枚＋敵軍マルチカテゴリのコマンド1枚で9000（出典: atwiki/page-2444 カード評価「マルチカテゴリのパワー増加分を含み」・R-POW-01）", () => {
    expect(bp({ power: powerCards(4) }, { command: [released("SPEC-MULTI-CMD", "mc")] })).toBe(9000);
  });

  it("XP-032: 【レジェンドを求めて】自軍ターン中にバトルエリアに出たとき、山札から S ユニット以外のユニットカードを1枚選びパワーゾーンに置ける（S ユニットは選べない。任意）（出典: atwiki/page-2444）", () => {
    let s = enter(st({ player1: { rush: [inst("XP-032", "gk")], deck: [inst("SPEC-L", "big"), inst("TST-UNIT-0", "small"), ...deckCards(3)] }, player2: { deck: deckCards(3, "e") } }, EXTRA), "XP-032:gk");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-032");
    // 発動するかを先に選ぶ（rules/revealGate.ts）。発動した後も選ばなくてよい
    expect(onlyActivateOrSkip(s)).toBe(true);
    s = activate(s);
    expect(choiceIds(s)).toContain("SPEC-L:big");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:small");
    expect(canSkip(s)).toBe(true);
    s = settle(pick(s, "SPEC-L:big"));
    expect(zoneOf(s, "player1", "SPEC-L:big")).toBe("power");
  });

  it("XP-032: 【レジェンドを求めて】発動しなければ山札はシャッフルされない（ユーザー報告 2026-10-28「任意効果で処理が先に動くもの」の横展開。以前は見送ってもシャッフルした）（出典: atwiki/page-2444「次の効果を発動できる」）", () => {
    const deck = [inst("SPEC-L", "big"), inst("TST-UNIT-0", "small"), ...deckCards(3)];
    const s = settle(skip(enter(st({ player1: { rush: [inst("XP-032", "gk")], deck }, player2: { deck: deckCards(3, "e") } }, EXTRA), "XP-032:gk")));
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(deck.map((c) => c.instanceId));
  });

  it.todo("XP-032: 【レジェンドを求めて】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-2444「自軍ターン中、」）— 敵軍ターン中に L ユニットをバトルエリアに出す手順を公開 API で組めない");
});
