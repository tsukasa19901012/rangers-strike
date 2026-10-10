/**
 * カード別スペック: RS-348〜RS-353（第6弾「紅き六戦士の帰還」メディテーション〜デンジファイター）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS349 読み替え）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html。RS-348/350/351/352/353 の Q&A、
 *     RS-375 の Q に RS-352 が登場）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md）。ライブ写しは RS-349 のみ（pages/523.txt）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import {
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectOpStats,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhase,
  skip,
  spOf,
  st,
  strike,
  struckInEnemyTurn,
  sUnit,
  toPhase,
  endTurn,
  zoneOf,
  attackTargets,
  settle,
  attack,
  categoriesOf,
  act,
  confirm,
} from "./RS6-348-368.helpers";
import type { GameState } from "../types/game";

// ===========================================================================
describe("RS-348 メディテーション", () => {
  const TEXT =
    "※常駐 自分はダメージが14点になるまでゲームに負けない。ただし、自分の山札からカードを引くべきときに引けなければゲームに負ける。また、自分はダメージを1点受けるたび、追加で1点ダメージを受ける（このダメージには追加ダメージは無い）。";
  const medi = () => [inst("RS-348", "m")];

  it("RS-348: カタログ本文・スペックが出典と一致（出典: atwiki/page-524）", () => {
    expectCatalogText("RS-348", TEXT);
    expectOpStats("RS-348", { name: "メディテーション", category: "MA", powerCost: 0 });
  });

  it("RS-348: ※常駐 — 自軍ラッシュフェイズに使うと自軍常駐置き場に置かれる（出典: atwiki/page-524「※常駐」・R-KW-PERM-01）", () => {
    const s = rushPhase({ hand: [inst("RS-348", "m")], command: releasedCat("MA", 1) });
    const r = playOp(s, "player1", "RS-348:m");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-348:m")).toBe("operation");
  });

  it("RS-348: 自分はダメージが13点でもゲームに負けない（出典: atwiki/page-524「ダメージが14点になるまでゲームに負けない」）", () => {
    const s = struckInEnemyTurn({ operation: medi(), damage: 11 });
    expect(s.players.player1.damage).toBe(13);
    expect(s.winner).toBeNull();
  });

  it("RS-348: ダメージが14点になるとゲームに負ける（出典: atwiki/page-524「14点になるまで」）", () => {
    const s = struckInEnemyTurn({ operation: medi(), damage: 12 });
    expect(s.players.player1.damage).toBe(14);
    expect(s.winner).toBe("player2");
  });

  it("RS-348: 比較 — メディテーションがなければ7点で負ける（出典: R-WIN 一般ルール・atwiki/page-524）", () => {
    const s = struckInEnemyTurn({ damage: 6 });
    expect(s.players.player1.damage).toBe(7);
    expect(s.winner).toBe("player2");
  });

  it("RS-348: ただし、山札からカードを引くべきときに引けなければゲームに負ける（出典: atwiki/page-524「引けなければゲームに負ける」）", () => {
    let s = st({ activePlayer: "player2", player1: { operation: medi(), damage: 3, deck: [] }, player2: { deck: deckCards(5, "e") } });
    s = endTurn(s);
    const draw = legal(s).find((a) => a.type === "draw");
    expect(draw).toBeDefined();
    const t = act(s, draw!);
    expect(t.winner).toBe("player2");
  });

  it("RS-348: ダメージを1点受けるたび追加で1点（ストライクの1点で計2点）（出典: atwiki/page-524「追加で1点ダメージを受ける」）", () => {
    const s = struckInEnemyTurn({ operation: medi(), damage: 0 });
    expect(s.players.player1.damage).toBe(2);
  });

  it("RS-348: 追加ダメージには追加ダメージは無い（SP2 のストライクで計4点。8点にはならない）（出典: atwiki/page-524「このダメージには追加ダメージは無い」）", () => {
    const s = struckInEnemyTurn({ operation: medi(), damage: 0 }, "TST-UNIT-2:atk");
    expect(s.players.player1.damage).toBe(4);
  });

  it("RS-348: 「自分は」— 配置していない相手のダメージは増えない（出典: atwiki/page-524「自分は」）", () => {
    let s = st({
      player1: { operation: medi(), battle: [inst("TST-UNIT-0", "a")], deck: deckCards(5) },
      player2: { power: powerCards(5, "e"), deck: deckCards(5, "e") },
    });
    s = resolveAll(strike(s, "TST-UNIT-0:a"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-348: 公式Q&A — ダメージ7点以上で、ラッシュフェイズにメディテーションを捨札にして他の常駐（アドベンチャー）を配置するとその時点で負ける（出典: grnrngr/faq-card-6 RS-348 Q1「はい、負けになります」）", () => {
    const s = rushPhase({
      operation: medi(),
      damage: 8,
      hand: [inst("RS-030", "adv")],
      command: releasedCat("ET", 1),
      power: powerCards(3),
    });
    const r = playOp(s, "player1", "RS-030:adv");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-348:m")).toBe("discard");
    expect(r.state.winner).toBe("player2");
  });

  it("RS-348: 公式Q&A — ダメージ7点以上で相手に「無限連鎖カード」を使われるとメディテーションが無効になり負ける（出典: grnrngr/faq-card-6 RS-348 Q2「はい、その通りです」）", () => {
    const s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { operation: medi(), damage: 8, deck: deckCards(5) },
      player2: { hand: [inst("RS-072", "mugen")], command: releasedCat("DA", 1, "e"), power: powerCards(3, "e"), deck: deckCards(5, "e") },
    });
    const r = playOp(s, "player2", "RS-072:mugen");
    expect(r.ok).toBe(true);
    expect(r.state.winner).toBe("player2");
  });

  it("RS-348: 公式Q&A — グリーンツーのNCストライクで相手がメディテーションにより2枚ウラ返したとき、その2枚とも【ブレイクアクション】の対象になる（出典: grnrngr/faq-card-6 RS-348 Q3「はい、対象になります」）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-199", "g2")], deck: deckCards(5) },
      player2: {
        operation: medi(),
        power: [inst("TST-UNIT-2", "p2"), inst("RS-361", "p5")],
        battle: [inst("TST-UNIT-2", "u2"), inst("RS-361", "u5"), inst("RS-354", "u3")],
        deck: deckCards(5, "e"),
      },
    });
    s = enter(s, "RS-199:g2");
    s = resolveAll(strike(s, "RS-199:g2"), ["TST-UNIT-2:p2", "RS-361:p5"]);
    // 任意の撃破は受け入れる
    for (let i = 0; i < 4 && s.pendingEffectChoice; i++) {
      s = resolveAll(s.pendingEffectChoice.kind === "confirm" ? confirm(s) : pick(s, s.pendingEffectChoice.validInstanceIds[0]!));
    }
    expect(s.players.player2.damage).toBe(2);
    expect(zoneOf(s, "player2", "TST-UNIT-2:u2")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-361:u5")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-354:u3")).toBe("battle");
  });

  it("RS-348: 公式Q&A — 自分がメディテーション、相手が命の泉のとき、自分は14点まで、相手は9点まで負けない（出典: grnrngr/faq-card-6 RS-348 Q4）", () => {
    // 自分: 10点 → 12点（9点を超えても負けない）
    const a = struckInEnemyTurn({ operation: medi(), damage: 10 }, "TST-UNIT-0:atk", { operation: [inst("RS-244", "izumi")] });
    expect(a.players.player1.damage).toBe(12);
    expect(a.winner).toBeNull();
    // 相手: 8点 → 9点で負ける
    let b = st({
      player1: { operation: medi(), battle: [inst("TST-UNIT-0", "a")], deck: deckCards(5) },
      player2: { operation: [inst("RS-244", "izumi")], damage: 7, power: powerCards(5, "e"), deck: deckCards(5, "e") },
    });
    b = resolveAll(strike(b, "TST-UNIT-0:a"));
    expect(b.players.player2.damage).toBe(8);
    expect(b.winner).toBeNull();
    let c = st({
      player1: { operation: medi(), battle: [inst("TST-UNIT-0", "a")], deck: deckCards(5) },
      player2: { operation: [inst("RS-244", "izumi")], damage: 8, power: powerCards(5, "e"), deck: deckCards(5, "e") },
    });
    c = resolveAll(strike(c, "TST-UNIT-0:a"));
    expect(c.players.player2.damage).toBe(9);
    expect(c.winner).toBe("player1");
  });

  it("RS-348: 公式Q&A — カードをダメージにして置く効果（レッドマスク【ゴッドハンド】）を受けた場合も追加ダメージを受ける（計2点）（出典: grnrngr/faq-card-6 RS-348 Q5「はい、追加ダメージを受けます」）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-368", "rm")], deck: deckCards(5) },
      player2: { operation: medi(), battle: [inst("RS-351", "t")], power: powerCards(3, "e"), deck: deckCards(5, "e") },
    });
    s = enter(s, "RS-368:rm");
    s = resolveAll(pick(s, "RS-351:t"));
    expect(zoneOf(s, "player2", "RS-351:t")).toBe("power");
    expect(s.players.player2.damage).toBe(2);
  });
});

// ===========================================================================
describe("RS-349 スーパー戦隊アドレスブック", () => {
  // R-ERR-RS349（公式Q&Aの読み替え）。
  const TEXT =
    "自軍山札を見て、追加条件を持たずDAを持たないSユニットのカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。";
  const DAMULTI = sUnit("SPEC-WB-DA", { category: ["WB", "DA"] as never });
  const ADDCOND = sUnit("SPEC-ADD", {
    powerCost: "3+",
    rushAdditionalCondition: { conditionId: "send_s_unit_to_discard", text: "自軍Sユニットを1体捨札にする", unitCount: 1 } as never,
  });
  const play = (deck: ReturnType<typeof inst>[]) => {
    const s = rushPhase({ hand: [inst("RS-349", "ab")], command: releasedCat("ET", 1), power: powerCards(3), deck }, {}, [DAMULTI, ADDCOND]);
    const r = playOp(s, "player1", "RS-349:ab");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-349: カタログ本文（読み替え後）・スペックが出典と一致（出典: 08-errata R-ERR-RS349・grnrngr/faq-card-6 RS-349・atwiki/page-523）", () => {
    expectCatalogText("RS-349", TEXT);
    expectOpStats("RS-349", { name: "スーパー戦隊アドレスブック", category: "ET", powerCost: 3 });
  });

  it("RS-349: 自軍山札を見て、追加条件を持たず DA を持たない S ユニットのカードを1枚選び手札に加える（山札のどこにあってもよい）（出典: R-ERR-RS349「自軍山札を見て」）", () => {
    let s = play([inst("TST-OP", "o1"), inst("TST-OP", "o2"), inst("TST-OP", "o3"), inst("RS-354", "red")]);
    expect(choiceIds(s)).toContain("RS-354:red");
    s = resolveAll(pick(s, "RS-354:red"));
    expect(zoneOf(s, "player1", "RS-354:red")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-349:ab")).toBe("discard");
  });

  it("RS-349: 選べないもの — DA の S ユニット・追加条件を持つ S ユニット・M/L ユニット・オペレーション（出典: R-ERR-RS349「追加条件を持たずDAを持たないSユニット」）", () => {
    const s = play([
      inst("RS-360", "da"),
      inst("SPEC-ADD", "add"),
      inst("RS-352", "l"),
      inst("TST-UNIT-2", "m"),
      inst("TST-OP", "op"),
      inst("RS-357", "ok"),
    ]);
    expect(choiceIds(s)).toEqual(["RS-357:ok"]);
  });

  it("RS-349: 「手札に加えてもよい」— 加えないことも選べる（出典: R-ERR-RS349「加えてもよい」）", () => {
    let s = play([inst("RS-354", "red")]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-354:red")).toBe("deck");
  });

  it("RS-349: 公式Q&A — DA を含むマルチカテゴリの S ユニットは選べない（出典: grnrngr/faq-card-6 RS-349 Q1「いいえ、それはできません」・atwiki/page-523 Q1）", () => {
    const s = play([inst("SPEC-WB-DA", "multi"), inst("RS-357", "ok")]);
    expect(choiceIds(s)).toEqual(["RS-357:ok"]);
  });

  it.todo("RS-349: 「相手に見せてから」「その後、山札をシャッフルする」— 公開・シャッフルの手順は状態として観測できない（出典: R-ERR-RS349）");
});

// ===========================================================================
describe("RS-350 暗黒の鎧", () => {
  const TEXT =
    "自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、カテゴリがDAになり、「SP1」以上のユニット以外にはアタックされない。重ねたユニットがユニットでなくなるとき、このカードを自軍パワーゾーンにダメージにして置く。";

  const played = () => {
    const s = rushPhase({ hand: [inst("RS-350", "ar")], rush: [inst("RS-354", "red"), inst("RS-352", "l")], command: releasedCat("DA", 1) });
    const r = playOp(s, "player1", "RS-350:ar");
    expect(r.ok).toBe(true);
    return r.state;
  };
  /** 鎧を重ねたデンジレッドの状態を直接作る（エンジンが stackedCards で重ねる表現に合わせる）。 */
  const armored = () => ({ ...inst("RS-354", "red"), stackedCards: [inst("RS-350", "ar")] });

  it("RS-350: カタログ本文・スペックが出典と一致（出典: atwiki/page-525）", () => {
    expectCatalogText("RS-350", TEXT);
    expectOpStats("RS-350", { name: "暗黒の鎧", category: "DA", powerCost: 0 });
  });

  it("RS-350: 自軍 S ユニットを1体選ぶ（L ユニットは選べない）（出典: atwiki/page-525「自軍Sユニットを1体選ぶ」）", () => {
    const s = played();
    expect(choiceIds(s)).toEqual(["RS-354:red"]);
  });

  it("RS-350: このカードを自軍ラッシュエリアに置き、選んだユニットを重ねる（捨札にならない）（出典: atwiki/page-525「このカードを自軍ラッシュエリアに置き」）", () => {
    let s = played();
    s = resolveAll(pick(s, "RS-354:red"));
    expect(zoneOf(s, "player1", "RS-350:ar")).not.toBe("discard");
    const red = s.players.player1.rush.find((c) => c.instanceId === "RS-354:red");
    expect(red?.stackedCards?.map((c) => c.instanceId)).toContain("RS-350:ar");
  });

  it("RS-350: 重ねたユニットはカテゴリが DA になる（出典: atwiki/page-525「カテゴリがDAになり」）", () => {
    const s = st({ player1: { rush: [armored()], deck: deckCards(5) } });
    expect(categoriesOf(s, "player1", "RS-354:red")).toEqual(["DA"]);
  });

  it("RS-350: 重ねたユニットは「SP1」以上でないユニットにはアタックされない（出典: atwiki/page-525「「SP1」以上のユニット以外にはアタックされない」）", () => {
    const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 9000 });
    const s = st(
      { activePlayer: "player2", player1: { battle: [armored()], deck: deckCards(5) }, player2: { battle: [inst("SPEC-NOSP", "n")], deck: deckCards(5, "e") } },
      [NOSP],
    );
    expect(attackTargets(s, "SPEC-NOSP:n", "player2")).not.toContain("RS-354:red");
  });

  it("RS-350: 「SP1」以上のユニットにはアタックされる（出典: atwiki/page-525「「SP1」以上のユニット以外には」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [armored()], deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-7", "z")], deck: deckCards(5, "e") } });
    expect(attackTargets(s, "TST-UNIT-7:z", "player2")).toContain("RS-354:red");
  });

  it("RS-350: 重ねたユニットがユニットでなくなる（撃破される）と、このカードを自軍パワーゾーンにダメージにして置く（出典: atwiki/page-525「このカードを自軍パワーゾーンにダメージにして置く」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [armored()], power: powerCards(2), deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-7", "z")], deck: deckCards(5, "e") } });
    s = resolveAll(settle(attack(s, "TST-UNIT-7:z", "RS-354:red", "player2")));
    expect(zoneOf(s, "player1", "RS-354:red")).toBe("discard");
    const ar = s.players.player1.power.find((c) => c.instanceId === "RS-350:ar");
    expect(ar?.faceDown).toBe(true);
    expect(s.players.player1.damage).toBe(1);
  });

  // grnrngr/faq-card-6 RS-350 Q1「はい、その通りです。」
  it("RS-350: 公式Q&A — 鎧に重ねた「怪人」が撃破されて捨札になり、それに対応して巨大化爆弾を使っても、鎧はダメージにして置かれる（出典: grnrngr/faq-card-6 RS-350 Q1）", () => {
    const KAIJIN = sUnit("SPEC-KAIJIN", { features: ["怪人"], bp: 1000, sp: undefined });
    let s = st(
      {
        activePlayer: "player2",
        player1: {
          battle: [{ ...inst("SPEC-KAIJIN", "k"), stackedCards: [inst("RS-350", "ar")] }],
          hand: [inst("RS-255", "bomb")],
          command: releasedCat("DA", 1),
          power: powerCards(4),
          deck: deckCards(5),
        },
        player2: { battle: [inst("TST-UNIT-7", "z")], deck: deckCards(5, "e") },
      },
      [KAIJIN],
    );
    s = settle(attack(s, "TST-UNIT-7:z", "SPEC-KAIJIN:k", "player2"));
    s = resolveAll(s);
    const ar = s.players.player1.power.find((c) => c.instanceId === "RS-350:ar");
    expect(ar?.faceDown).toBe(true);
  });

  it.todo("RS-350: 公式Q&A — 鎧に重ねたマグを【修復作業】で捨札にしたとき、同時にダメージになった鎧を【修復作業】でオモテにできる（出典: grnrngr/faq-card-6 RS-350 Q2）— 鎧のダメージ化が未実装（上の it.fails）で前提が作れない");
});

// ===========================================================================
describe("RS-351 アカレンジャー（2nd）", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。【ニューレッドビュート】「SP1」敵軍コマンドゾーンからSユニットのカードを1枚選び、敵軍バトルエリアに出してもよい。このとき、出したユニットの効果は発動しない。";

  const nc = (p2: Partial<GameState["players"]["player2"]>, n = 4) =>
    enter(st({ player1: { battle: fillers(n), rush: [inst("RS-351", "aka")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }), "RS-351:aka");

  it("RS-351: カタログ本文・スペックが出典と一致（出典: atwiki/page-538）", () => {
    expectCatalogText("RS-351", TEXT);
    expectStats("RS-351", { name: "アカレンジャー（2nd）", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 5, features: ["レッド", "男", "2nd"] });
  });

  it("RS-351: ※ ラッシュしたターンにはバトルエリアに出られず、次の自軍ターンには出られる（出典: atwiki/page-538「ラッシュしたターンにバトルエリアに出られない」）", () => {
    const s = rushPhase({ hand: [inst("RS-351", "aka")], command: releasedCat("ET", 1), power: powerCards(3) });
    const r = rushFromHand(s, "player1", "RS-351:aka");
    expect(r.ok).toBe(true);
    let t = toPhase(r.state, "player1", "battle");
    expect(canEnter(t, "RS-351:aka")).toBe(false);
    t = toPhase(endTurn(endTurn(t)), "player1", "battle");
    expect(canEnter(t, "RS-351:aka")).toBe(true);
  });

  it("RS-351: 5番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-538「CN：5」「SP1」）", () => {
    const s = nc({});
    expect(spOf(s, "player1", "RS-351:aka")).toBe(1);
    expect(canStrike(s, "RS-351:aka")).toBe(true);
  });

  it("RS-351: NC が成立していない（4番目）ときは SP！のままで、【ニューレッドビュート】も発動しない（出典: atwiki/page-538「SP：！」・R-CN-02）", () => {
    const s = nc({ command: [held("RS-354", "c")] }, 3);
    expect(spOf(s, "player1", "RS-351:aka")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-351: 【ニューレッドビュート】敵軍コマンドゾーンから S ユニットのカードだけを選べる（M ユニット・オペレーションは不可）（出典: atwiki/page-538「Sユニットのカードを1枚選び」）", () => {
    const s = nc({ command: [held("RS-354", "s"), held("TST-UNIT-2", "m"), released("TST-OP", "op")] });
    expect(choiceIds(s)).toEqual(["RS-354:s"]);
  });

  // 既知の不具合: CARD-RS-351 【ニューレッドビュート】の選択を相手（敵軍）に行わせている
  it.fails("RS-351: 【ニューレッドビュート】カードを選ぶ・出すかを決めるのは効果を使う自分（出典: atwiki/page-538「選び、…出してもよい」）", () => {
    const s = nc({ command: [held("RS-354", "s")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
  });

  it("RS-351: 【ニューレッドビュート】選んだカードを敵軍バトルエリアに出し、そのユニットの効果（NC）は発動しない（出典: atwiki/page-538「出したユニットの効果は発動しない」）", () => {
    // デンジレッド（CN3）が敵軍バトルエリアの3番目に出ても【デンジパンチ】は発動しない。
    let s = nc({ command: [held("RS-354", "s")], battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] });
    s = pick(s, "RS-354:s");
    expect(zoneOf(s, "player2", "RS-354:s")).toBe("battle");
    expect(s.players.player2.battle.map((c) => c.instanceId)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2", "RS-354:s"]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.log.some((l) => l.includes("number_combo") && l.includes("RS-354"))).toBe(false);
  });

  it("RS-351: 【ニューレッドビュート】「出してもよい」— 出さないことも選べる（出典: atwiki/page-538「出してもよい」）", () => {
    let s = nc({ command: [held("RS-354", "s")] });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "RS-354:s")).toBe("command");
  });

  it("RS-351: 公式Q&A — 「アカレンジャー」と「アカレンジャー（2nd）」は同名カードなので、デッキには合わせて3枚まで（出典: grnrngr/faq-card-6 RS-351 Q1「はい、その通りです」）", () => {
    const bad = validateDeckEntries([{ cardId: "RS-126", count: 2 }, { cardId: "RS-351", count: 2 }, { cardId: "RS-338", count: 46 }]);
    expect(bad.errors.some((e) => e.includes("アカレンジャー"))).toBe(true);
    const ok = validateDeckEntries([{ cardId: "RS-126", count: 1 }, { cardId: "RS-351", count: 2 }, { cardId: "RS-338", count: 47 }]);
    expect(ok.errors.some((e) => e.includes("アカレンジャー"))).toBe(false);
  });
});

// ===========================================================================
describe("RS-352 ダイデンジン", () => {
  const TEXT =
    "【ダイデンジンブーメラン】これが自軍エリアにある間、自軍パワーゾーンのカードがパワーゾーンを離れるとき、そのカードの必要パワーの数字をお互いに見る。そして、その数字以下の必要パワーを持つユニットを、相手は自分自身のユニットから1体選び撃破する。";

  it("RS-352: カタログ本文・スペックが出典と一致（出典: atwiki/page-550）", () => {
    expectCatalogText("RS-352", TEXT);
    expectStats("RS-352", { name: "ダイデンジン", category: "OT", size: "L", bp: 9000, sp: 1, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
  });

  const rushState = (p1: Partial<GameState["players"]["player1"]>) =>
    rushPhase({ hand: [inst("RS-352", "dd")], command: releasedCat("OT", 1), power: powerCards(7), ...p1 });

  it("RS-352: 追加条件 — 自軍「デンジファイター」1体を捨札にしてラッシュできる（出典: atwiki/page-550「自軍「デンジファイター」1体を捨札にする」）", () => {
    const r = rushFromHand(rushState({ rush: [inst("RS-353", "f")] }), "player1", "RS-352:dd");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-352:dd")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-353:f")).toBe("discard");
  });

  it("RS-352: 必要パワー7+ — デンジファイターがいなければ、またはパワー6ではラッシュできない（出典: atwiki/page-550・R-ADD-02「＋」）", () => {
    expect(canStartRush(rushState({ rush: fillers(2) }), "player1", "RS-352:dd")).toBe(false);
    expect(canStartRush(rushState({ rush: [inst("RS-353", "f")], power: powerCards(6) }), "player1", "RS-352:dd")).toBe(false);
  });

  /** バイオジェット1号（RS-128）をラッシュし、その※効果で自軍パワーゾーンの powerCard を捨札にする。 */
  function boomerang(opts: { daidenjin: boolean; powerCard?: string; extraP1?: ReturnType<typeof inst>[]; extraPower?: number }) {
    const powerCard = opts.powerCard ?? "RS-354";
    let s = rushPhase(
      {
        hand: [inst("RS-128", "bj")],
        rush: [...(opts.daidenjin ? [inst("RS-352", "dd")] : []), ...fillers(2), ...(opts.extraP1 ?? [])],
        command: releasedCat("OT", 1),
        power: [inst(powerCard, "pc"), ...powerCards(opts.extraPower ?? 4)],
      },
      { battle: [inst("TST-UNIT-2", "c2"), inst("RS-361", "c5")], rush: [inst("RS-360", "c4")] },
    );
    const r = rushFromHand(s, "player1", "RS-128:bj");
    expect(r.ok).toBe(true);
    s = r.state;
    if (s.pendingEffectChoice?.validInstanceIds.includes(`${powerCard}:pc`)) s = pick(s, `${powerCard}:pc`);
    expect(zoneOf(s, "player1", `${powerCard}:pc`)).toBe("discard");
    return s;
  }

  it("RS-352: 【ダイデンジンブーメラン】自軍パワーゾーンのカード（必要パワー3）が離れると、相手は必要パワー3以下の自分自身のユニットから1体選び撃破する（出典: atwiki/page-550）", () => {
    const s = boomerang({ daidenjin: true });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:c2"]);
    const t = resolveAll(pick(s, "TST-UNIT-2:c2"));
    expect(zoneOf(t, "player2", "TST-UNIT-2:c2")).toBe("discard");
    expect(zoneOf(t, "player2", "RS-361:c5")).toBe("battle");
  });

  it("RS-352: 【ダイデンジンブーメラン】ダイデンジンが自軍エリアになければ何も撃破されない（出典: atwiki/page-550「これが自軍エリアにある間」）", () => {
    const s = resolveAll(boomerang({ daidenjin: false }));
    expect(s.players.player2.discard).toHaveLength(0);
  });

  // grnrngr/faq-card-6 RS-352 Q1「その場合は5回発動します。すべてのカード操作は、…1枚ごとに実行しているものとして扱います。」
  it("RS-352: 公式Q&A — 複数枚が同時にパワーゾーンを離れたときは1枚ごとに発動する（バイオジェット2号で2枚 → 2回）（出典: grnrngr/faq-card-6 RS-352 Q1）", () => {
    let s = rushPhase(
      { hand: [inst("RS-129", "bj2")], rush: [inst("RS-352", "dd"), ...fillers(3)], command: releasedCat("OT", 1), power: [inst("RS-354", "pa"), inst("RS-354", "pb"), ...powerCards(2)] },
      { battle: [inst("TST-UNIT-2", "c2"), inst("TST-UNIT-0", "c0"), inst("RS-361", "c5")] },
    );
    const r = rushFromHand(s, "player1", "RS-129:bj2");
    expect(r.ok).toBe(true);
    s = resolveAll(r.state, ["RS-354:pa", "RS-354:pb"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:c0")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-361:c5")).toBe("battle");
  });

  it.todo("RS-352: 公式Q&A — 《モーフ》の「置き換え」でパワーゾーンのカードが離れても発動する（出典: grnrngr/faq-card-6 RS-352 Q2）— 置き換え元の電王SF/RF とモーフの手順を API で組めない（ブーメラン自体も未実装）");

  // grnrngr/faq-card-6 RS-375 Q「はい、パワーゾーンのカードにも効果を及ぼします。」
  it("RS-352: 公式Q&A — レッドレーサー（2nd）の「必要パワーの数字は1増える」は、ブーメランで参照するパワーゾーンのカードにも及ぶ（必要パワー3 → 4 以下を撃破）（出典: grnrngr/faq-card-6 RS-375 Q）", () => {
    // レッドレーサー（2nd）の※でバイオジェット1号（5+）の必要パワーも6になるため、パワーを6枚にする。
    const s = boomerang({ daidenjin: true, extraP1: [inst("RS-375", "rr")], extraPower: 5 });
    expect(choiceIds(s)).toEqual(["RS-360:c4", "TST-UNIT-2:c2"]);
  });
});

// ===========================================================================
describe("RS-353 デンジファイター", () => {
  const TEXT =
    "【ファイターチェンジ】これをラッシュしたとき、自軍山札の上から、自軍パワーゾーンのカードの枚数までオモテにしてもよい。そうしたとき、その中から特徴「メカ」を持つLユニットのカードをすべて手札に加え、それ以外は好きな順で山札の下に戻す。";

  it("RS-353: カタログ本文・スペックが出典と一致（出典: atwiki/page-551）", () => {
    expectCatalogText("RS-353", TEXT);
    expectStats("RS-353", { name: "デンジファイター", category: "OT", size: "L", bp: 9000, sp: 1, powerCost: "5+", features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_discard" });
  });

  const rushState = (rush: ReturnType<typeof inst>[], deck = deckCards(5), power = powerCards(5)) =>
    rushPhase({ hand: [inst("RS-353", "df")], rush, command: releasedCat("OT", 1), power, deck });

  it("RS-353: 追加条件 — 自軍 S ユニットを5体捨札にしてラッシュできる（出典: atwiki/page-551「自軍Sユニットを5体捨札にする」）", () => {
    const r = rushFromHand(rushState(fillers(5)), "player1", "RS-353:df");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-353:df")).toBe("rush");
    expect(t.players.player1.discard.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(5);
  });

  it("RS-353: 追加条件 — S ユニットが4体ではラッシュできない（出典: atwiki/page-551・R-ADD-02「＋」）", () => {
    expect(canStartRush(rushState(fillers(4)), "player1", "RS-353:df")).toBe(false);
  });

  // パワー5枚、山札の上: オペ, ダイデンジン(メカL), オペ, TST-UNIT-7(メカでないL), デンジファイター(メカL), オペ, ダイデンジン(6枚目)
  const deck = () => [
    inst("TST-OP", "o0"),
    inst("RS-352", "l1"),
    inst("TST-OP", "o1"),
    inst("TST-UNIT-7", "l2"),
    inst("RS-353", "l3"),
    inst("TST-OP", "o2"),
    inst("RS-352", "l6"),
  ];

  it("RS-353: 【ファイターチェンジ】パワーゾーンの枚数（5枚）までオモテにし、その中の特徴「メカ」の L ユニットをすべて手札に加え、それ以外は山札の下に戻す（出典: atwiki/page-551）", () => {
    const r = rushFromHand(rushState(fillers(5), deck()), "player1", "RS-353:df");
    const s = resolveAll(r.state);
    expect(s.players.player1.hand.map((c) => c.instanceId).sort()).toEqual(["RS-352:l1", "RS-353:l3"]);
    const d = s.players.player1.deck.map((c) => c.instanceId);
    expect(d.slice(0, 2)).toEqual(["TST-OP:o2", "RS-352:l6"]);
    expect([...d.slice(2)].sort()).toEqual(["TST-OP:o0", "TST-OP:o1", "TST-UNIT-7:l2"].sort());
  });

  it("RS-353: 【ファイターチェンジ】「オモテにしてもよい」— しないことも選べ、山札は変わらない（出典: atwiki/page-551「オモテにしてもよい」）", () => {
    const r = rushFromHand(rushState(fillers(5), deck()), "player1", "RS-353:df");
    let s = r.state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-353");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(deck().map((c) => c.instanceId));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // grnrngr/faq-card-6 RS-353 Q1「好きな枚数までオモテにすることが可能です。…好きな枚数で止めることができます。」
  it("RS-353: 公式Q&A — パワー5枚でも、1枚ずつオモテにして好きな枚数（2枚）で止められる（出典: grnrngr/faq-card-6 RS-353 Q1）", () => {
    const r = rushFromHand(rushState(fillers(5), deck()), "player1", "RS-353:df");
    let s = r.state;
    // 1枚目（オペ）→ 続ける、2枚目（ダイデンジン）→ 止める
    s = pick(s, "TST-OP:o0");
    s = pick(s, "RS-352:l1");
    s = resolveAll(skip(s));
    expect(s.players.player1.hand.map((c) => c.instanceId)).toEqual(["RS-352:l1"]);
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP:o1");
  });

  it.todo("RS-353: 公式Q&A — バラクティカがある状態でこれをラッシュし、【ファイターチェンジ】で手札に加えたデンジファイターを【編隊出撃】でラッシュエリアに出せる（ターンプレイヤーが処理順を選ぶ）（出典: grnrngr/faq-card-6 RS-353 Q2）— 【ファイターチェンジ】が手札に加えられない（上の it.fails）ため前提が作れない");
});
