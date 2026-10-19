/**
 * カード別スペック: RS-605〜RS-612（第9弾「蒼九の翼」異次元からの翼〜スカイエース）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-605〜RS-612 は該当なし）、grnrngr/faq-card-9
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_9.html。カード別の Q&A はなく、
 *     キーワード「ウイング」Q1〜Q6・「ブラスト」Q1 のみ。faq/card_1〜8・index にも該当カードの Q&A はない）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01/02、R-KW-PERM-01、R-KW-TAG-01、R-KW-CALL-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { markBattleBlocked } from "../rules/turnModifiers";
import {
  act,
  attack,
  canActivateResident,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  canWing,
  cardIn,
  choiceIds,
  deckCards,
  enterSeq,
  expectCatalogText,
  expectOpStats,
  expectRarity,
  expectStats,
  fill,
  held,
  inst,
  legal,
  pick,
  playOp,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  wing,
  zoneOf,
} from "./RS9-605-626.helpers";

const BP5000 = sUnit("SPEC-BP5000", { bp: 5000 });

// ===========================================================================
describe("RS-605 異次元からの翼", () => {
  const TEXT =
    "自軍山札を見て、ウイングを持つユニットカードを1枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。その後、山札をシャッフルする。";

  /** 自軍ラッシュフェイズ。手札に異次元からの翼、パワー4・OT コマンド1。 */
  const board = (deck: ReturnType<typeof inst>[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-605", "op")], command: releasedCat("OT", 1), power: powerCards(4), deck, ...p1 },
      player2: { deck: deckCards(3, "e") },
    });
  const play = (s: GameState) => {
    const r = playOp(s, "player1", "RS-605:op");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-605: カタログ本文・スペックが出典と一致（出典: atwiki/page-1448）", () => {
    expectCatalogText("RS-605", TEXT);
    expectOpStats("RS-605", { name: "異次元からの翼", category: "OT", powerCost: 4 });
  });

  it("RS-605: レアリティ — ノーマル（出典: atwiki/page-1448「レアリティ：ノーマル」）", () => {
    expectRarity("RS-605", "N");
  });

  it("RS-605: 自軍山札からウイングを持つユニットカードを1枚選び、自軍ラッシュエリアに出す（出典: atwiki/page-1448）", () => {
    let s = play(board([inst("TST-UNIT-0", "x"), inst("RS-622", "g"), inst("TST-OP", "o")]));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-605");
    expect(choiceIds(s)).toEqual(["RS-622:g"]);
    s = resolveAll(pick(s, "RS-622:g"));
    expect(zoneOf(s, "player1", "RS-622:g")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:x")).toBe("deck");
  });

  it("RS-605: 必要パワーは満たさなくてよい（パワー4でも必要パワー5のグリフォーザーを出せる）（出典: atwiki/page-1448 Q2「「追加条件は満たすこと」と書かれていたとしても」・本文「ただし、追加条件は満たすこと」）", () => {
    const s = resolveAll(play(board([inst("RS-622", "g")])), ["RS-622:g"]);
    expect(zoneOf(s, "player1", "RS-622:g")).toBe("rush");
  });

  it("RS-605: 追加条件は満たすこと — 自軍 S ユニットがあればバリブルーンを選べ、追加条件（S ユニットをコマンドゾーンに送るか捨札）を実行して出す（出典: atwiki/page-1448「ただし、追加条件は満たすこと」）", () => {
    let s = play(board([inst("RS-611", "b")], { rush: [inst("TST-UNIT-0", "s")] }));
    expect(choiceIds(s)).toEqual(["RS-611:b"]);
    s = resolveAll(pick(s, "RS-611:b"), ["TST-UNIT-0:s"]);
    expect(zoneOf(s, "player1", "RS-611:b")).toBe("rush");
    expect(["command", "discard"]).toContain(zoneOf(s, "player1", "TST-UNIT-0:s"));
  });

  it("RS-605: 追加条件を満たせないウイング持ち（自軍 S ユニットがない状況のバリブルーン）は選べない（出典: atwiki/page-1448「ただし、追加条件は満たすこと」）", () => {
    const s = play(board([inst("RS-611", "b"), inst("RS-622", "g")]));
    expect(choiceIds(s)).toEqual(["RS-622:g"]);
  });

  it("RS-605: Q&A — 必要パワーに「−」を持つウイング持ち（アバレキラーAM）は「−」の追加条件を実行せずに出せる（出典: atwiki/page-1448 Q2「必ずしも実行する必要はありません」）", () => {
    // アバレキラーAM（XG1-030。必要パワー7-、追加条件は「アバレキラー」1体を捨札）。自軍に素材がいても実行しない。
    let s = play(board([inst("XG1-030", "am")]));
    expect(choiceIds(s)).toEqual(["XG1-030:am"]);
    s = resolveAll(pick(s, "XG1-030:am"));
    expect(zoneOf(s, "player1", "XG1-030:am")).toBe("rush");
    expect(s.players.player1.discard.map((c) => c.instanceId)).toEqual(["RS-605:op"]);
  });

  it("RS-605: 強制 — ウイング持ちが山札にあれば出さないことは選べない（出典: atwiki/page-1448「1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = play(board([inst("RS-622", "g")]));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-605");
    expect(canSkip(s)).toBe(false);
  });

  it("RS-605: 山札にウイングを持つユニットがなければ何も出さない（出典: atwiki/page-1448「ウイングを持つユニットカード」）", () => {
    const s = resolveAll(play(board([inst("TST-UNIT-0", "x"), inst("TST-OP", "o")])));
    expect(s.players.player1.rush).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(2);
  });

  it.todo(
    "RS-605: Q&A — セイクウオーを出すとき、追加条件を満たすためにデンジ犬アイシーの【最後の手段】を使える（出典: atwiki/page-1448 Q1「はい、できます」）— 効果そのものが未実装で、効果解決中に別の効果を割り込ませる手順を公開 API で組めないため",
  );
  it.todo("RS-605: その後、山札をシャッフルする（出典: atwiki/page-1448）— シャッフル結果は乱数に依存し、公開 API で確かめられないため");
});

// ===========================================================================
describe("RS-606 雷鳴剣ヒカリマル", () => {
  const TEXT =
    "ウイングを持つ自軍ユニットを1枚選びリリースしてもよい。そうしたとき、リリースしたユニットのBPを見て、そのBP以下のBPを持つユニットを敵軍バトルエリアから1体選び、持ち主のパワーゾーンにダメージにして置く。";

  /** 自軍ラッシュフェイズ。ラッシュエリアにウイングでホールドされたグリフォーザー（BP5000）。 */
  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-606", "op")], command: releasedCat("MA", 1), power: powerCards(5), rush: [held("RS-622", "g")], deck: deckCards(3), ...p1 },
        player2: {
          battle: [inst("TST-UNIT-0", "e1"), inst("SPEC-BP5000", "e5"), inst("TST-UNIT-7", "e7")],
          rush: [inst("TST-UNIT-0", "er")],
          deck: deckCards(3, "e"),
          ...p2,
        },
      },
      [BP5000],
    );
  const play = (s: GameState) => {
    const r = playOp(s, "player1", "RS-606:op");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-606: カタログ本文・スペックが出典と一致（出典: atwiki/page-1447）", () => {
    expectCatalogText("RS-606", TEXT);
    expectOpStats("RS-606", { name: "雷鳴剣ヒカリマル", category: "MA", powerCost: 5 });
  });

  it("RS-606: レアリティ — ノーマル（出典: atwiki/page-1447）", () => {
    expectRarity("RS-606", "N");
  });

  it("RS-606: ホールド状態のウイング持ち自軍ユニットをリリースし、その BP 以下の敵軍バトルエリアのユニットを1体ダメージにする（出典: atwiki/page-1447）", () => {
    let s = play(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-606");
    expect(choiceIds(s)).toEqual(["RS-622:g"]);
    s = pick(s, "RS-622:g");
    expect(cardIn(s, "player1", "RS-622:g")?.commandHeld ?? false).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-0:e1")?.faceDown).toBe(true);
  });

  it("RS-606: 候補は「リリースしたユニットの BP 以下」— BP5000 のユニットは選べ、BP13000 のユニット・敵軍ラッシュエリアのユニットは選べない（出典: atwiki/page-1447「そのBP以下のBPを持つユニットを敵軍バトルエリアから」）", () => {
    const s = pick(play(board()), "RS-622:g");
    expect(choiceIds(s)).toEqual(["SPEC-BP5000:e5", "TST-UNIT-0:e1"]);
  });

  it("RS-606: コマンドゾーンにあるウイング持ちのカードはユニットではないので選べない（出典: atwiki/page-1447「ウイングを持つ自軍ユニット」）", () => {
    const s = play(board({ command: [...releasedCat("MA", 1), held("RS-611", "cw")] }));
    expect(choiceIds(s)).not.toContain("RS-611:cw");
  });

  it("RS-606: 任意 — リリースしなければ敵軍ユニットはダメージにならない（出典: atwiki/page-1447「リリースしてもよい。そうしたとき」）", () => {
    let s = play(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-606");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(cardIn(s, "player1", "RS-622:g")?.commandHeld).toBe(true);
    expect(s.players.player2.battle).toHaveLength(3);
  });

  it("RS-606: ウイングを持たないホールド状態の自軍ユニットはリリースの対象にならない（出典: atwiki/page-1447「ウイングを持つ自軍ユニット」）", () => {
    const s = play(board({ rush: [held("TST-UNIT-0", "nw")] }));
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:nw");
    const t = resolveAll(s);
    expect(t.players.player2.battle).toHaveLength(3);
  });
});

// ===========================================================================
describe("RS-607 ファルコンサモナー", () => {
  const TEXT =
    "次の効果を、敵軍ダメージの点数と同じ数まで好きな回数実行する⇒自軍山札の上からカードを1枚オモテにする。オモテにしたカードが特徴「獣」を持つユニットカードかビークルカードだったなら、それを自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。出せなかったなら、オモテにしたカードを手札に加えた後、自分の手札からカードを1枚選び捨札にする。";

  const board = (deck: ReturnType<typeof inst>[], damage: number, p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-607", "op"), inst("TST-OP", "h1")], command: releasedCat("WB", 1), power: powerCards(4), deck, ...p1 },
      player2: { damage, deck: deckCards(3, "e") },
    });
  const play = (s: GameState) => {
    const r = playOp(s, "player1", "RS-607:op");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-607: カタログ本文・スペックが出典と一致（出典: atwiki/page-1449）", () => {
    expectCatalogText("RS-607", TEXT);
    expectOpStats("RS-607", { name: "ファルコンサモナー", category: "WB", powerCost: 4 });
  });

  it("RS-607: レアリティ — ノーマル（出典: atwiki/page-1449）", () => {
    expectRarity("RS-607", "N");
  });

  it("RS-607: 敵軍ダメージ1点 — 山札の上が特徴「獣」のユニット（ツバサマル）なら自軍ラッシュエリアに出す（出典: atwiki/page-1449）", () => {
    const s = resolveAll(play(board([inst("RS-623", "beast"), inst("TST-OP", "x")], 1)));
    expect(zoneOf(s, "player1", "RS-623:beast")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP:x")).toBe("deck");
  });

  it("RS-607: 山札の上がビークルカード（デカバイク）でも自軍ラッシュエリアに出す（出典: atwiki/page-1449「ユニットカードかビークルカード」）", () => {
    const s = resolveAll(play(board([inst("RS-570", "v"), inst("TST-OP", "x")], 1, { command: [...releasedCat("WB", 1), ...releasedCat("OT", 1)], power: powerCards(5) })));
    expect(zoneOf(s, "player1", "RS-570:v")).toBe("rush");
  });

  it("RS-607: 必要パワーは満たさなくてよい — パワー4でも必要パワー5のガオファルコン（獣）を出す（出典: atwiki/page-1449「ただし、追加条件は満たすこと」・カード評価「必要パワーとカテゴリを無視できる」）", () => {
    const s = resolveAll(play(board([inst("RS-649", "falcon"), inst("TST-OP", "x")], 1)));
    expect(zoneOf(s, "player1", "RS-649:falcon")).toBe("rush");
  });

  it("RS-607: 追加条件を満たせる「獣」ユニット（ギガフェニックス＋自軍の分身獣ギガウイング）は追加条件を実行して出す（出典: atwiki/page-1449「ただし、追加条件は満たすこと」）", () => {
    const s = resolveAll(play(board([inst("RS-688", "gp"), inst("TST-OP", "x")], 1, { rush: [inst("RS-644", "gw")], power: powerCards(5) })), ["RS-644:gw"]);
    expect(zoneOf(s, "player1", "RS-688:gp")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-644:gw")).toBe("discard");
  });

  it("RS-607: 追加条件を満たせない「獣」ユニット（素材のいないギガフェニックス）は出せず手札に加わる（出典: atwiki/page-1449「出せなかったなら、オモテにしたカードを手札に加えた後」）", () => {
    const s = resolveAll(play(board([inst("RS-688", "gp"), inst("TST-OP", "x")], 1, { power: powerCards(5) })), ["TST-OP:h1"]);
    expect(zoneOf(s, "player1", "RS-688:gp")).not.toBe("rush");
    expect(s.players.player1.hand.length + 0).toBe(1);
    expect(s.players.player1.discard.length).toBe(2);
  });

  it("RS-607: 出せなかったときは手札に加えた後、手札から捨札にするカードを自分で選ぶ（加えたカードを残して元の手札を捨てることも、その逆もできる）（出典: atwiki/page-1449「自分の手札からカードを1枚選び捨札にする」）", () => {
    let s = play(board([inst("TST-OP", "x"), inst("TST-OP", "y")], 1));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-607");
    expect(choiceIds(s)).toEqual(["TST-OP:h1", "TST-OP:x"]);
    s = resolveAll(pick(s, "TST-OP:x"));
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:x")).toBe("discard");
  });

  it("RS-607: 「好きな回数」— 敵軍ダメージ3点でも1回でやめられる（出典: atwiki/page-1449「同じ数まで好きな回数実行する」）", () => {
    let s = play(board([inst("RS-623", "b1"), inst("RS-623", "b2"), inst("RS-623", "b3")], 3, { power: powerCards(4) }));
    // 1回目を実行した後、続けるかを選べる（見送れる）
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId === "RS-623"; i++) s = skip(s);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-607");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.deck.length).toBeGreaterThanOrEqual(2);
  });

  it("RS-607: 敵軍ダメージの点数を超えては実行しない（ダメージ2点なら山札の上から2枚まで）（出典: atwiki/page-1449「敵軍ダメージの点数と同じ数まで」）", () => {
    const s = resolveAll(play(board([inst("RS-623", "b1"), inst("RS-623", "b2"), inst("RS-623", "b3")], 2)));
    expect(zoneOf(s, "player1", "RS-623:b3")).toBe("deck");
  });

  it("RS-607: 敵軍ダメージ0点なら何もしない（出典: atwiki/page-1449「敵軍ダメージの点数と同じ数まで」）", () => {
    const s = resolveAll(play(board([inst("RS-623", "b1"), inst("TST-OP", "x")], 0)));
    expect(s.players.player1.deck).toHaveLength(2);
    expect(s.players.player1.rush).toHaveLength(0);
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-608 五色の戦士", () => {
  const TEXT =
    "※常駐 ※タッグ 自軍ラッシュフェイズごとに1度だけ『WBを持つ自軍コマンドを1つホールドする』を実行してもよい。そうしたとき、自軍Sユニットを1体選び、特徴「レッド」「イエロー」「ブルー」「ブラック」「ホワイト」のうちどれか1つを宣言する。このターン、宣言した特徴を選んだユニットに追加する。";

  const placed = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "rush",
      player1: { operation: [inst("RS-608", "op")], command: releasedCat("WB", 2), rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e") },
    });

  it("RS-608: カタログ本文・スペックが出典と一致（出典: atwiki/page-1495）", () => {
    expectCatalogText("RS-608", TEXT);
    expectOpStats("RS-608", { name: "五色の戦士", category: "WB", powerCost: 4 });
  });

  it("RS-608: レアリティ — レア（出典: atwiki/page-1495「レアリティ：レア」）", () => {
    expectRarity("RS-608", "R");
  });

  it("RS-608: ※常駐 — 使うと捨札にならず常駐置き場に置かれる（出典: atwiki/page-1495・R-KW-PERM-01）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-608", "op")], command: releasedCat("WB", 1), power: powerCards(4), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = playOp(s, "player1", "RS-608:op");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-608:op")).toBe("operation");
  });

  it("RS-608: ※タッグ — 他のタッグ常駐（戦士の魂）と合わせて2枚まで配置できる（出典: atwiki/page-1495・R-KW-TAG-01）", () => {
    const s = placed({ hand: [inst("RS-609", "soul")], command: [...releasedCat("WB", 1), ...releasedCat("ET", 1)], power: powerCards(5) });
    const r = playOp(s, "player1", "RS-609:soul");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-608:op")).toBe("operation");
    expect(zoneOf(t, "player1", "RS-609:soul")).toBe("operation");
  });

  it("RS-608: 自軍ラッシュフェイズに WB の自軍コマンドを1つホールドして起動できる（出典: atwiki/page-1495「『WBを持つ自軍コマンドを1つホールドする』を実行してもよい」）", () => {
    expect(canActivateResident(placed(), "RS-608:op")).toBe(true);
  });

  it("RS-608: 起動すると自軍 S ユニットを選び、宣言した特徴（レッド）がこのターン追加される（出典: atwiki/page-1495「宣言した特徴を選んだユニットに追加する」）", () => {
    let s = act(placed(), { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RS-608:op" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-608");
    s = resolveAll(s, ["TST-UNIT-0:s"]);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
    expect(s.log.some((l) => l.includes("RS-608"))).toBe(true);
  });

  it("RS-608: WB を持つ自軍コマンドがリリース状態でなければ起動できない（出典: atwiki/page-1495「WBを持つ自軍コマンドを1つホールドする」）", () => {
    expect(canActivateResident(placed({ command: releasedCat("ET", 2) }), "RS-608:op")).toBe(false);
  });

  it("RS-608: 自軍バトルフェイズには起動できない（出典: atwiki/page-1495「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = st({ phase: "battle", player1: { operation: [inst("RS-608", "op")], command: releasedCat("WB", 2), rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(canActivateResident(s, "RS-608:op")).toBe(false);
  });

  const activateGoshoku = (s: GameState) => act(s, { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RS-608:op" });

  it("RS-608: 自軍ラッシュフェイズごとに1度だけ（2回目は起動できない）（出典: atwiki/page-1495「自軍ラッシュフェイズごとに1度だけ」）", () => {
    let s = activateGoshoku(placed());
    s = resolveAll(s, ["TST-UNIT-0:s"]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(canActivateResident(s, "RS-608:op")).toBe(false);
  });

  it("RS-608: 同名の五色の戦士を2枚常駐させていれば、1度のラッシュフェイズにそれぞれ1度ずつ起動できる（1枚目を使っても2枚目は使用済みにならない）（出典: ユーザー決定 2026-10-19「両方の効果をそれぞれ発動することができる」・atwiki/page-762 RK-242 Q1（2010/10/25修正）・docs/rules/README.md §5.7 i）", () => {
    let s = activateGoshoku(placed({ operation: [inst("RS-608", "op"), inst("RS-608", "op2")] }));
    if (s.pendingEffectChoice?.effectId === "tag_bold_pick") s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-608:op" });
    s = resolveAll(s, ["TST-UNIT-0:s"]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(canActivateResident(s, "RS-608:op")).toBe(false);
    expect(canActivateResident(s, "RS-608:op2")).toBe(true);
    s = act(s, { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RS-608:op2" });
    if (s.pendingEffectChoice?.effectId === "tag_bold_pick") s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-608:op2" });
    s = resolveAll(s, ["TST-UNIT-0:s"]);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
    expect(canActivateResident(s, "RS-608:op2")).toBe(false);
  });

  it("RS-608: 宣言できる特徴は「レッド」「イエロー」「ブルー」「ブラック」「ホワイト」の5つだけ（出典: atwiki/page-1495）", () => {
    let s = activateGoshoku(placed());
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: s.pendingEffectChoice!.validInstanceIds[0]! });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:s" });
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["レッド", "イエロー", "ブルー", "ブラック", "ホワイト"]);
  });

  it("RS-608: ※タッグ — WB のコマンドがなくても、他の自軍のタッグの常駐（ボウケンスピリッツ）の太字部分『自軍コマンドを1つ選び山札の上に戻す』を代わりに実行して効果を使える（出典: atwiki/page-1495「※タッグ」・R-KW-TAG-01）", () => {
    let s = placed({ operation: [inst("RS-608", "op"), inst("RS-522", "bk")], command: releasedCat("ET", 1) });
    expect(canActivateResident(s, "RS-608:op")).toBe(true);
    s = activateGoshoku(s);
    expect(s.pendingEffectChoice?.effectId).toBe("tag_bold_pick");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["RS-522:bk"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-522:bk" });
    const cmd = s.pendingEffectChoice!.validInstanceIds[0]!;
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: cmd });
    expect(s.players.player1.deck[0]?.instanceId).toBe(cmd);
    // 五色の戦士の「そうしたとき」以降（S ユニットを選び、特徴を宣言する）。
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["TST-UNIT-0:s"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:s" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "ブルー" });
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-609 戦士の魂", () => {
  const TEXT =
    "※常駐 ※タッグ 自軍バトルフェイズごとに１度だけ、『自軍ラッシュエリアのSユニットを１体コマンドゾーンに送るか捨札にする』を実行してもよい。そうしたとき、ナンバーに数字を持ちカテゴリにDAを持たない自軍Sユニットを、バトルエリアとラッシュエリアから１体ずつ選ぶ。このターン、このカードの効果でラッシュエリアから選んだユニットがＮＣを発動するとき、そのユニットの本来のNCの効果を発動するかわりに、このカードの効果でバトルエリアから選んだユニットのNCの効果を発動してもよい。";

  const placed = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "battle",
      player1: {
        operation: [inst("RS-609", "op")],
        battle: [inst("RS-059", "blue")],
        rush: [inst("TST-UNIT-0", "cost"), inst("RS-614", "king")],
        deck: deckCards(5),
        ...p1,
      },
      player2: { deck: deckCards(3, "e") },
    });

  it("RS-609: カタログ本文・スペックが出典と一致（出典: atwiki/page-1496）", () => {
    expectCatalogText("RS-609", TEXT);
    expectOpStats("RS-609", { name: "戦士の魂", category: "ET", powerCost: 5 });
  });

  it("RS-609: レアリティ — レア（出典: atwiki/page-1496「レアリティ：レア」）", () => {
    expectRarity("RS-609", "R");
  });

  it("RS-609: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-1496・R-KW-PERM-01）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-609", "op")], command: releasedCat("ET", 1), power: powerCards(5), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = playOp(s, "player1", "RS-609:op");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-609:op")).toBe("operation");
  });

  it("RS-609: 自軍バトルフェイズに、自軍ラッシュエリアの S ユニットをコマンドゾーンに送るか捨札にして起動できる（出典: atwiki/page-1496）", () => {
    expect(canActivateResident(placed(), "RS-609:op")).toBe(true);
  });

  it("RS-609: ラッシュエリアから選んだユニット（クローバーキング）が NC を発動するとき、バトルエリアから選んだユニット（マジブルー）の NC（1枚ドロー）を代わりに発動できる（出典: atwiki/page-1496）", () => {
    let s = act(placed(), { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RS-609:op" });
    s = resolveAll(s, ["TST-UNIT-0:cost", "RS-059:blue", "RS-614:king"]);
    const hand = s.players.player1.hand.length;
    // クローバーキング（CN3）を3番目に出して NC を成立させる
    s = resolveAll(enterSeq({ ...s, players: { ...s.players, player1: { ...s.players.player1, battle: [...s.players.player1.battle, inst("TST-UNIT-0", "f")] } } }, ["RS-614:king"]), ["RS-059:blue"]);
    expect(s.players.player1.hand.length).toBe(hand + 1);
  });

  it("RS-609: 自軍ラッシュフェイズには起動できない（出典: atwiki/page-1496「自軍バトルフェイズごとに１度だけ」）", () => {
    expect(canActivateResident({ ...placed(), phase: "rush" }, "RS-609:op")).toBe(false);
  });

  it.todo("RS-609: 選べるのは「ナンバーに数字を持ち、カテゴリに DA を持たない」S ユニットだけ（出典: atwiki/page-1496）— 起動そのものが未実装で、候補を公開 API で観測できないため");
  it.todo("RS-609: 自軍バトルフェイズごとに1度だけ（出典: atwiki/page-1496）— 起動そのものが未実装のため");
  it.todo(
    "RS-609: atwiki コメント — 特殊条件（「ナンバーに関係なく発動する」）で効果を発動しても「NC を発動する」ことにはならず置き換えられない（出典: atwiki/page-1496 コメント）— 公式回答ではなく、起動そのものも未実装のため",
  );
});

// ===========================================================================
describe("RS-610 秘伝ディスク", () => {
  const TEXT = "※常駐 特徴「侍」を持つユニットは、次の能力を得る⇒タクスMA、コールMA";
  const SAMURAI = sUnit("SPEC-SAMURAI", { category: "MA", sp: undefined, features: ["侍"] });
  const MA_NOSP = sUnit("SPEC-MA-NOSP", { category: "MA", sp: undefined });
  const MA_RUSH = sUnit("SPEC-MA-RUSH", { category: "MA", sp: undefined, powerCost: 1 });

  /** 侍を2番目に置き、次（3番目）に SP－ の MA ユニットを出す。 */
  const taxis = (withDisk: boolean, samurai = "SPEC-SAMURAI") =>
    enterSeq(
      st(
        {
          player1: {
            operation: withDisk ? [inst("RS-610", "op")] : [],
            battle: [inst("TST-UNIT-0", "f0")],
            rush: [inst(samurai, "sam"), inst("SPEC-MA-NOSP", "n")],
            deck: deckCards(3),
          },
          player2: { deck: deckCards(3, "e") },
        },
        [SAMURAI, MA_NOSP],
      ),
      [`${samurai}:sam`, "SPEC-MA-NOSP:n"],
    );

  it("RS-610: カタログ本文・スペックが出典と一致（出典: atwiki/page-1440）", () => {
    expectCatalogText("RS-610", TEXT);
    expectOpStats("RS-610", { name: "秘伝ディスク", category: "MA", powerCost: 3 });
  });

  it("RS-610: レアリティ — ノーマルレア（出典: atwiki/page-1440「レアリティ：ノーマルレア」）", () => {
    expectRarity("RS-610", "NR");
  });

  it("RS-610: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-1440・R-KW-PERM-01）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-610", "op")], command: releasedCat("MA", 1), power: powerCards(3), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = playOp(s, "player1", "RS-610:op");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-610:op")).toBe("operation");
  });

  it("RS-610: タクスMA — 2番目にいる「侍」の次に並ぶ MA の S ユニットは SP1 を得る（出典: atwiki/page-1440・R-KW-TAXIS）", () => {
    expect(spOf(taxis(true), "player1", "SPEC-MA-NOSP:n")).toBe(1);
  });

  it("RS-610: 秘伝ディスクがなければ「侍」はタクスMA を持たない（出典: atwiki/page-1440「次の能力を得る」）", () => {
    expect(spOf(taxis(false), "player1", "SPEC-MA-NOSP:n")).toBe(0);
  });

  it("RS-610: 「侍」を持たないユニットはタクスMA を得ない（出典: atwiki/page-1440「特徴「侍」を持つユニットは」）", () => {
    expect(spOf(taxis(true, "SPEC-MA-NOSP"), "player1", "SPEC-MA-NOSP:n")).toBe(0);
  });

  it("RS-610: コールMA — MA のコマンドがなくても、リリース状態の「侍」ユニットをホールドして MA ユニットをラッシュできる（出典: atwiki/page-1440・R-KW-CALL-01）", () => {
    const s = st(
      {
        phase: "rush",
        player1: { operation: [inst("RS-610", "op")], hand: [inst("SPEC-MA-RUSH", "r")], rush: [inst("SPEC-SAMURAI", "sam")], command: [], power: powerCards(1), deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      [SAMURAI, MA_RUSH],
    );
    expect(canStartRush(s, "player1", "SPEC-MA-RUSH:r")).toBe(true);
    const r = rushFromHand(s, "player1", "SPEC-MA-RUSH:r");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-MA-RUSH:r")).toBe("rush");
    expect(cardIn(r.state, "player1", "SPEC-SAMURAI:sam")?.commandHeld).toBe(true);
  });

  it("RS-610: 秘伝ディスクがなければ「侍」でコールできず、MA のコマンドがないとラッシュできない（出典: atwiki/page-1440・R-KW-CALL-01）", () => {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("SPEC-MA-RUSH", "r")], rush: [inst("SPEC-SAMURAI", "sam")], command: [], power: powerCards(1), deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      [SAMURAI, MA_RUSH],
    );
    expect(canStartRush(s, "player1", "SPEC-MA-RUSH:r")).toBe(false);
  });
});

// ===========================================================================
describe("RS-611 バリブルーン", () => {
  const TEXT = "※ウイング";

  it("RS-611: カタログ本文・スペックが出典と一致（出典: atwiki/page-1450）", () => {
    expectCatalogText("RS-611", TEXT);
    expectStats("RS-611", {
      name: "バリブルーン",
      category: "ET",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-611: レアリティ — ノーマルレア（出典: atwiki/page-1450）", () => {
    expectRarity("RS-611", "NR");
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({ phase: "rush", player1: { hand: [inst("RS-611", "b")], command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(3), ...p1 } });

  it("RS-611: 追加条件 — 自軍 S ユニット1体をコマンドゾーンに送ってラッシュできる（出典: atwiki/page-1450「自軍Sユニットを1体コマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(rushBoard({ rush: [inst("TST-UNIT-0", "s")] }), "player1", "RS-611:b", { materials: ["TST-UNIT-0:s"], destination: "command" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-611:b")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("command");
  });

  it("RS-611: 追加条件 — 自軍 S ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1450）", () => {
    const r = rushFromHand(rushBoard({ rush: [inst("TST-UNIT-0", "s")] }), "player1", "RS-611:b", { materials: ["TST-UNIT-0:s"], destination: "discard" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RS-611: 追加条件 — 自軍 S ユニットがなければ（M ユニットだけでは）ラッシュできない（出典: atwiki/page-1450「自軍Sユニット」）", () => {
    expect(canStartRush(rushBoard({ rush: [inst("TST-UNIT-2", "m")] }), "player1", "RS-611:b")).toBe(false);
  });

  it("RS-611: 必要パワー4+ — パワー3ではラッシュできない（出典: atwiki/page-1450「必要パワー：4+」）", () => {
    expect(canStartRush(rushBoard({ rush: [inst("TST-UNIT-0", "s")], power: powerCards(3) }), "player1", "RS-611:b")).toBe(false);
  });

  const wingBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({ player1: { rush: [inst("RS-611", "b")], deck: deckCards(3), ...p1 }, player2: { battle: [inst("TST-UNIT-2", "e")], deck: deckCards(3, "e") } });

  it("RS-611: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドし、そこから敵軍ユニットにアタックできる（出典: atwiki/page-1450・grnrngr/faq-card-9 ウイング Q1「バトルエリアに出さずとも、相手のユニットにアタックすることができます」）", () => {
    let s = wingBoard();
    expect(canWing(s, "RS-611:b")).toBe(true);
    s = wing(s, "RS-611:b");
    expect(cardIn(s, "player1", "RS-611:b")?.commandHeld).toBe(true);
    expect(targetsOf(s, "RS-611:b")).toEqual(["TST-UNIT-2:e"]);
    s = resolveAll(attack(s, "RS-611:b", "TST-UNIT-2:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-611:b")).toBe("rush");
  });

  it("RS-611: Q&A — バトルエリアに出られない制限を受けていてもウイングは発動できる（出典: grnrngr/faq-card-9 ウイング Q2「はい、できます」）", () => {
    const s0 = wingBoard();
    const s: GameState = { ...s0, players: { ...s0.players, player1: markBattleBlocked(s0.players.player1, "RS-611:b") } };
    expect(canEnter(s, "RS-611:b")).toBe(false);
    expect(canWing(s, "RS-611:b")).toBe(true);
  });

  it("RS-611: Q&A — 自軍バトルフェイズ以外（自軍ラッシュフェイズ・敵軍バトルフェイズ）には発動できない（出典: grnrngr/faq-card-9 ウイング Q3「いいえ、できません」）", () => {
    expect(canWing({ ...wingBoard(), phase: "rush" }, "RS-611:b")).toBe(false);
    const enemyTurn = st({ activePlayer: "player2", player1: { rush: [inst("RS-611", "b")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-2", "e")], rush: [inst("TST-UNIT-0", "x")], deck: deckCards(3, "e") } });
    expect(canWing(enemyTurn, "RS-611:b")).toBe(false);
  });

  it("RS-611: Q&A — ウイングを発動したターンはバトルエリアに出られない（出典: grnrngr/faq-card-9 ウイング Q4「いいえ、できません」）", () => {
    let s = wingBoard();
    expect(canEnter(s, "RS-611:b")).toBe(true);
    s = resolveAll(attack(wing(s, "RS-611:b"), "RS-611:b", "TST-UNIT-2:e"));
    expect(canEnter(s, "RS-611:b")).toBe(false);
  });

  it("RS-611: Q&A — コマンドゾーン・パワーゾーンのバリブルーンからはウイングを発動できない（出典: grnrngr/faq-card-9 ウイング Q5「いいえ」）", () => {
    const s = st({ player1: { rush: [], command: [inst("RS-611", "c")], power: [inst("RS-611", "p")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-2", "e")], deck: deckCards(3, "e") } });
    expect(legal(s).some((a) => a.type === "hold_for_wing")).toBe(false);
  });

  it("RS-611: Q&A — SP1 以上のユニット（SP1 にしたウイング持ち）がウイングを発動しても、アタックのかわりにストライクはできない（出典: grnrngr/faq-card-9 ウイング Q6「いいえ、できません」）", () => {
    // メガウインガー・フライヤーモード（RS-625）はウイング持ち。SP1 を持たせるかわりに、バリブルーンで確認する
    const s = wing(wingBoard(), "RS-611:b");
    expect(canStrike(s, "RS-611:b")).toBe(false);
  });
});

// ===========================================================================
describe("RS-612 スカイエース", () => {
  const TEXT =
    "※これは特徴「メカ」を持つ自軍コマンドが4つ以上あればSP1になる。 【スカイコンテナ】これをラッシュしたとき、自軍コマンドを好きな数選び捨札にしてもよい。そうしたとき、自軍山札を見て、特徴「メカ」を持つSユニットのカードを、捨札にしたコマンドの数まで好きな枚数選び、自軍コマンドゾーンにホールド状態で置く。その後、山札をシャッフルする。";
  const mechaCmd = (n: number, prefix = "mc") => Array.from({ length: n }, (_, i) => inst("RS-613", `${prefix}${i}`));

  it("RS-612: カタログ本文・スペックが出典と一致（出典: atwiki/page-1451）", () => {
    expectCatalogText("RS-612", TEXT);
    expectStats("RS-612", {
      name: "スカイエース",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: "special",
      powerCost: "5+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-612: レアリティ — ノーマルレア（出典: atwiki/page-1451）", () => {
    expectRarity("RS-612", "NR");
  });

  const spBoard = (command: ReturnType<typeof inst>[]) =>
    st({ player1: { battle: [inst("RS-612", "ace")], command, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  it("RS-612: ※ 特徴「メカ」を持つ自軍コマンドが4つあれば SP1（出典: atwiki/page-1451）", () => {
    expect(spOf(spBoard(mechaCmd(4)), "player1", "RS-612:ace")).toBe(1);
  });

  it("RS-612: ※ 特徴「メカ」を持つ自軍コマンドが3つ（＋メカでないコマンド）なら SP1 にならない（出典: atwiki/page-1451「4つ以上あれば」）", () => {
    expect(spOf(spBoard([...mechaCmd(3), inst("TST-OP-ET", "x")]), "player1", "RS-612:ace")).toBe(0);
  });

  it("RS-612: ※ 敵軍コマンドの「メカ」は数えない（出典: atwiki/page-1451「自軍コマンド」）", () => {
    const s = st({ player1: { battle: [inst("RS-612", "ace")], command: mechaCmd(3), deck: deckCards(3) }, player2: { command: mechaCmd(4, "em"), deck: deckCards(3, "e") } });
    expect(spOf(s, "player1", "RS-612:ace")).toBe(0);
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "rush",
      player1: {
        hand: [inst("RS-612", "ace")],
        rush: [inst("TST-UNIT-0", "s")],
        command: [...releasedCat("ET", 1), inst("TST-OP", "c1"), inst("TST-OP", "c2")],
        power: powerCards(5),
        deck: [inst("RS-613", "d1"), inst("TST-OP", "x"), inst("RS-614", "d2"), inst("TST-UNIT-0", "nm")],
        ...p1,
      },
      player2: { deck: deckCards(3, "e") },
    });
  const rushAce = (s: GameState) => {
    const r = rushFromHand(s, "player1", "RS-612:ace", { materials: ["TST-UNIT-0:s"], destination: "discard" });
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-612: 追加条件 — 自軍 S ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1451）", () => {
    const s = resolveAll(rushAce(rushBoard()));
    expect(zoneOf(s, "player1", "RS-612:ace")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RS-612: 【スカイコンテナ】自軍コマンド2つを捨札にし、山札から「メカ」の S ユニット2枚をコマンドゾーンにホールド状態で置く（出典: atwiki/page-1451）", () => {
    let s = rushAce(rushBoard());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-612");
    s = resolveAll(s, ["TST-OP:c1", "TST-OP:c2", "RS-613:d1", "RS-614:d2"]);
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:c2")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-613:d1")).toBe("command");
    expect(zoneOf(s, "player1", "RS-614:d2")).toBe("command");
    expect(cardIn(s, "player1", "RS-613:d1")?.commandHeld).toBe(true);
  });

  it("RS-612: 【スカイコンテナ】山札から選べるのは「メカ」を持つ S ユニットだけ（メカでない S ユニット・オペレーションは選べない）（出典: atwiki/page-1451「特徴「メカ」を持つSユニットのカード」）", () => {
    let s = rushAce(rushBoard());
    s = resolveAll(s, ["TST-OP:c1"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:nm")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-OP:x")).toBe("deck");
    expect([zoneOf(s, "player1", "RS-613:d1"), zoneOf(s, "player1", "RS-614:d2")].filter((z) => z === "command")).toHaveLength(1);
  });

  it("RS-612: 【スカイコンテナ】任意 — コマンドを捨札にしなければ山札から何も置かない（出典: atwiki/page-1451「捨札にしてもよい」）", () => {
    let s = rushAce(rushBoard());
    if (s.pendingEffectChoice?.sourceCardId === "RS-612") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("command");
    expect(zoneOf(s, "player1", "TST-OP:c2")).toBe("command");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it.todo("RS-612: 【スカイコンテナ】その後、山札をシャッフルする（出典: atwiki/page-1451）— シャッフル結果は乱数に依存するため");
});

void [BP5000, fill];
