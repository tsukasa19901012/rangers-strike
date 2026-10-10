/**
 * カード別スペック: RS-419〜RS-425（第6弾「紅き六戦士の帰還」聖剣ズバーン〜ゲキジャガー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html。RS-419〜RS-422 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。Q&A 欄なし）
 *  3. docs/rules/*.md の一般ルール（R-CN-01〜R-CN-05: ジョイントコンビネーション・NC）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  raw,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS6-411-431.helpers";
import type { CardInstance, GameState } from "../types/game";

/** 自軍バトルフェイズに、ids を順にバトルエリアへ出す（各進入後の行動ウィンドウはパス）。 */
function enterSeq(s: GameState, ids: string[]): GameState {
  let next = s;
  for (const id of ids) next = passEntry(enter(passEntry(next), id));
  return next;
}

// ===========================================================================
describe("RS-419 聖剣ズバーン", () => {
  const TEXT =
    "※これはSユニットかLユニットからコンビネーションしなければバトルエリアに出られない。※これはアタックすることができない。【ゴールデンクラッシュ】これがDA以外のユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたユニットよりもBPの低い敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RS-419: カタログ本文・スペックが出典と一致（CN「R」）（出典: atwiki/page-571）", () => {
    expectCatalogText("RS-419", TEXT);
    expectStats("RS-419", {
      name: "聖剣ズバーン",
      category: "MA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: "5+",
      comboNumber: "R" as unknown as number,
      features: ["魔法"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-419: 追加条件 — 自軍「大剣人ズバーン」1体を捨札にしてラッシュできる（出典: atwiki/page-571「追加条件：自軍｢大剣人ズバーン｣を1体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-419", "sz")], rush: [inst("RS-420", "dz")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-419:sz");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-419:sz")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-420:dz")).toBe("discard");
  });

  it("RS-419: 追加条件 — 「大剣人ズバーン」がいなければラッシュできない（出典: atwiki/page-571）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-419", "sz")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-419:sz")).toBe(false);
  });

  it("RS-419: ※ S ユニットの次に出る（S ユニットからコンビネーションする）ならバトルエリアに出られる（出典: atwiki/page-571「SユニットかLユニットからコンビネーションしなければ」・R-CN-05）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-0", "s")], rush: [inst("RS-419", "sz")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-419:sz")).toBe(true);
  });

  it("RS-419: ※ L ユニットの次に出るならバトルエリアに出られる（出典: atwiki/page-571）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-7", "l")], rush: [inst("RS-419", "sz")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-419:sz")).toBe(true);
  });

  // 既知の不具合: CARD-RS-419 「SユニットかLユニットからコンビネーションしなければ出られない」が実装されておらず、1番目にも出られる
  it.fails("RS-419: ※ 自軍バトルエリアにユニットがない（コンビネーションする相手がいない）ときはバトルエリアに出られない（出典: atwiki/page-571）", () => {
    const s = st({ player1: { rush: [inst("RS-419", "sz")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-419:sz")).toBe(false);
  });

  // 既知の不具合: CARD-RS-419 「SユニットかLユニットからコンビネーションしなければ出られない」が実装されておらず、M ユニットの次にも出られる
  it.fails("RS-419: ※ M ユニットの次には出られない（出典: atwiki/page-571「SユニットかLユニットから」）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-2", "m")], rush: [inst("RS-419", "sz")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-419:sz")).toBe(false);
  });

  it("RS-419: ※ アタックすることができない（出典: atwiki/page-571「これはアタックすることができない」）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-0", "s"), inst("RS-419", "sz")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    expect(attackTargets(s, "RS-419:sz")).toEqual([]);
    expect(attackTargets(s, "TST-UNIT-0:s")).toEqual(["TST-UNIT-0:e1"]);
  });

  /** ゲキレッド（WB・S・BP3000）を1番目に出し、その次に聖剣ズバーンを出す。敵軍: BP1000 / BP3000 / BP13000。 */
  const crush = (first: string, extra: { p2?: Partial<GameState["players"]["player2"]>; defs?: ReturnType<typeof sUnit>[] } = {}) =>
    enterSeq(
      st(
        {
          player1: { battle: [inst(first.split(":")[0]!, first.split(":")[1]!)], rush: [inst("RS-419", "sz")], deck: deckCards(3) },
          player2: { battle: [inst("TST-UNIT-0", "e1"), inst("RS-340", "e3")], rush: [inst("TST-UNIT-7", "e13")], deck: deckCards(3, "e"), ...extra.p2 },
        },
        extra.defs ?? [],
      ),
      ["RS-419:sz"],
    );

  // 既知の不具合: CARD-RS-419 【ゴールデンクラッシュ】がジョイントコンビネーションで発動しない（選択が出ない）
  it.fails("RS-419: 【ゴールデンクラッシュ】DA 以外のユニットからコンビネーションするとき、そのユニットより BP の低い敵軍ユニットだけを選べ、持ち主のパワーゾーンにダメージにして置く（出典: atwiki/page-571「コンビネーションしたユニットよりもBPの低い敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = crush("RS-340:gr");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-419");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:e1")?.faceDown).toBe(true);
  });

  it("RS-419: 【ゴールデンクラッシュ】「発動できる」— 発動しないことを選べる（出典: atwiki/page-571「次の効果を発動できる」）", () => {
    let s = crush("RS-340:gr");
    if (s.pendingEffectChoice?.sourceCardId === "RS-419") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-419: 【ゴールデンクラッシュ】DA のユニットからコンビネーションするときは発動しない（出典: atwiki/page-571「これがDA以外のユニットからコンビネーションするとき」）", () => {
    const s = crush("RS-141:da");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-419");
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-419 【ゴールデンクラッシュ】が発動しない（DA と他カテゴリを持つユニットからのコンビネーションでも出ない）
  it.fails("RS-419: 【ゴールデンクラッシュ】DA と DA 以外の両方のカテゴリを持つユニットからコンビネーションしたときも発動できる（出典: grnrngr/faq-card-6 RS-419 Q2「はい、できます。…「ダークアライアンス以外のユニットからコンビネーションした」として」）", () => {
    const DAWB = sUnit("SPEC-DAWB", { category: ["DA", "WB"] as never, bp: 3000 });
    const s = crush("SPEC-DAWB:dw", { defs: [DAWB] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-419");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
  });

  // 既知の不具合: CARD-RS-419 【ゴールデンクラッシュ】が発動しない（タンクコマンドがあっても無くても）
  it.fails("RS-419: 【ゴールデンクラッシュ】タンクコマンド（NC を止める効果）があってもジョイントコンビネーションの効果は発動できる（出典: grnrngr/faq-card-6 RS-419 Q1「「RS-263 タンクコマンド」で発動できなくなるのは「ナンバーコンビネーション」ですので、それ以外のコンビネーションは問題なく発動することができます」）", () => {
    const s = crush("RS-340:gr", {
      p2: {
        battle: [inst("TST-UNIT-0", "e1")],
        rush: [inst("RS-263", "tank")],
        command: [released("RS-419", "rcmd")],
      },
    });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-419");
  });
});

// ===========================================================================
describe("RS-420 大剣人ズバーン", () => {
  const TEXT =
    "※自分か相手のLユニットがあれば、これはLユニットになる。【ズバズバンキック】これが自軍ラッシュエリアにある間、自分が特徴「メカ」を持つLユニットをラッシュしたとき、その追加条件を満たすために捨札にした合体ユニット1体につき、敵軍Sユニットを1体選び撃破してもよい。";

  it("RS-420: カタログ本文・スペックが出典と一致（出典: atwiki/page-572）", () => {
    expectCatalogText("RS-420", TEXT);
    expectStats("RS-420", {
      name: "大剣人ズバーン",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      features: ["魔法", "人型"],
      rushCondition: undefined,
    });
  });

  /** 自軍ラッシュフェイズ: 轟雷神（MA・メカ・L、合体―ゴウライビートル＋ゴウライスタッグ）をラッシュする。 */
  const rushGouraijin = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-309", "gj")], rush: [inst("RS-310", "b"), inst("RS-311", "st")], command: releasedCat("MA", 2), power: powerCards(6), deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
    const r = rushFromHand(s, "player1", "RS-309:gj");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-310:b")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-311:st")).toBe("discard");
    return r.state;
  };
  const withZuban = (p1: Partial<GameState["players"]["player1"]> = {}) => ({
    rush: [inst("RS-420", "zb"), inst("RS-310", "b"), inst("RS-311", "st")],
    ...p1,
  });
  const enemies = { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "e2"), inst("TST-UNIT-7", "el")] };

  it("RS-420: 【ズバズバンキック】メカの L ユニット（轟雷神）をラッシュしたとき、敵軍 S ユニット（バトル・ラッシュエリア）を選び撃破できる（L は選べない）（出典: atwiki/page-572「敵軍Sユニットを1体選び撃破してもよい」）", () => {
    let s = rushGouraijin(withZuban(), enemies);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-420");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    s = pick(s, "TST-UNIT-0:e1");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-420 【ズバズバンキック】の撃破が1体だけで、「捨札にした合体ユニット1体につき」（轟雷神なら2体）撃破できない
  it.fails("RS-420: 【ズバズバンキック】捨札にした合体ユニット1体につき1体 — 2体を捨札にした轟雷神なら敵軍 S ユニットを2体撃破できる（出典: atwiki/page-572「捨札にした合体ユニット1体につき、敵軍Sユニットを1体選び撃破してもよい」）", () => {
    let s = rushGouraijin(withZuban(), enemies);
    s = pick(s, "TST-UNIT-0:e1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-420");
    s = resolveAll(pick(s, "TST-UNIT-0:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("discard");
  });

  it("RS-420: 【ズバズバンキック】「撃破してもよい」— 見送れる（出典: atwiki/page-572）", () => {
    let s = rushGouraijin(withZuban(), enemies);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("rush");
  });

  it("RS-420: 【ズバズバンキック】これがバトルエリアにあるときは発動しない（出典: atwiki/page-572「これが自軍ラッシュエリアにある間」）", () => {
    const s = rushGouraijin({ battle: [inst("RS-420", "zb")] }, enemies);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-420");
  });

  it("RS-420: 【ズバズバンキック】メカでない L ユニット（ゲキトージャ）をラッシュしても発動しない（出典: atwiki/page-572「特徴「メカ」を持つLユニット」）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-422", "gt")],
        rush: [inst("RS-420", "zb"), inst("RS-340", "r"), inst("RS-424", "c"), inst("RS-425", "j")],
        command: releasedCat("WB", 2),
        power: powerCards(6),
        deck: deckCards(3),
      },
      player2: { ...enemies, deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-422:gt");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-420");
  });

  it("RS-420: 【ズバズバンキック】追加条件が「合体ユニットを捨札にする」でない L（トラベリオンエクスプレスを捨札にした魔法鉄神トラベリオン）では発動しない（出典: grnrngr/faq-card-6 RS-420 Q「いいえ、発動しません」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-328", "tr")], rush: [inst("RS-420", "zb"), inst("RS-329", "ex")], command: releasedCat("MA", 2), power: powerCards(5), deck: deckCards(3) },
      player2: { ...enemies, deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-328:tr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-329:ex")).toBe("discard");
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-420");
  });

  // 既知の不具合: CARD-RS-420 ※「自分か相手のLユニットがあれば、これはLユニットになる」が実装されていない（L ユニットがあっても S として選べる）
  it.fails("RS-420: ※ L ユニットがあれば L ユニットになる — 轟雷神（L）がいる場で、敵軍の大剣人ズバーンは「敵軍Sユニット」として選べない（出典: atwiki/page-572「自分か相手のLユニットがあれば、これはLユニットになる」）", () => {
    const s = rushGouraijin(withZuban(), { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("RS-420", "ezb")] });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
  });
});

// ===========================================================================
describe("RS-421 アカレッド", () => {
  const TEXT =
    "※これは特徴「レッド」を持つ自軍コマンド1つにつきBP+1000される。【ソウル降臨】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンから、特徴「レッド」とＮＣの効果を持つユニットカードを1枚選びホールドしてもよい。そうしたとき、ホールドしたユニットカードのNCの効果を、このユニットの効果として発動する。ただしストライクはできない。";

  it("RS-421: カタログ本文・スペックが出典と一致（出典: atwiki/page-574）", () => {
    expectCatalogText("RS-421", TEXT);
    expectStats("RS-421", {
      name: "アカレッド",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      features: ["レッド", "男"],
      rushCondition: undefined,
    });
  });

  it("RS-421: ※ 特徴「レッド」を持つ自軍コマンド1つにつき BP+1000（ホールド状態も数える。レッドでないコマンド・敵軍のコマンドは数えない）（出典: atwiki/page-574「特徴「レッド」を持つ自軍コマンド1つにつきBP+1000される」）", () => {
    const s = st({
      player1: { battle: [inst("RS-421", "ak")], command: [released("RS-099", "r1"), held("RS-091", "r2"), released("RS-341", "blue"), released("TST-OP", "op")], deck: deckCards(3) },
      player2: { command: [released("RS-340", "er")] },
    });
    expect(bpOf(s, "player1", "RS-421:ak")).toBe(4000);
  });

  it("RS-421: ※ レッドのコマンドがなければ BP2000（出典: atwiki/page-574）", () => {
    const s = st({ player1: { battle: [inst("RS-421", "ak")], command: [released("RS-341", "blue")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-421:ak")).toBe(2000);
  });

  /** 自軍バトルフェイズ、アカレッドを1番目に出す。コマンド: ハリケンレッド（レッド・NC「SP1」）、ゴーレッド（ホールド）、ゲキブルー（ブルー・NC）、タイムファイヤー（レッド・NC なし）。 */
  const soulState = (over: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      player1: {
        rush: [inst("RS-421", "ak")],
        command: [released("RS-099", "hr"), held("RS-091", "gr"), released("RS-341", "gb"), released("RS-303", "tf")],
        deck: deckCards(3),
        ...over,
      },
      player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });

  /** 【ソウル降臨】で commandId をホールドする（effect_hold の支払いとして選ぶ）。 */
  const soul = (s: GameState, commandId: string): GameState => {
    const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-421:ak");
    if (pay) {
      const t = raw(s, pay);
      return raw(t, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: [commandId] });
    }
    return pick(s, commandId);
  };

  it("RS-421: 【ソウル降臨】選べるのはレッドかつ NC の効果を持つユニットカード（レッドでない・NC のないカードは選べない）（出典: atwiki/page-574「特徴「レッド」とＮＣの効果を持つユニットカードを1枚選び」）", () => {
    const s = enter(soulState({ command: [released("RS-099", "hr"), released("RS-341", "gb"), released("RS-303", "tf")] }), "RS-421:ak");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-421");
    expect(choiceIds(s)).toEqual(["RS-099:hr"]);
  });

  // 既知の不具合: CARD-RS-421 【ソウル降臨】ですでにホールド状態のコマンドも選べる（ホールドできないカードが候補に入る）
  it("RS-421: 【ソウル降臨】すでにホールド状態のカードはホールドできないので選べない（出典: atwiki/page-574「選びホールドしてもよい」）", () => {
    const s = enter(soulState(), "RS-421:ak");
    expect(choiceIds(s)).toEqual(["RS-099:hr"]);
  });

  // 既知の不具合: CARD-RS-421 【ソウル降臨】でカードをホールドしても NC の効果が発動しない（ストライク不可だけが付く）
  it("RS-421: 【ソウル降臨】ホールドしたハリケンレッドの NC「SP1」をこのユニットの効果として発動し、アカレッドは「SP1」を持つユニットになる（出典: atwiki/page-574・grnrngr/faq-card-6 RS-421 Q2「はい、「ＳＰ１」を持つユニットとして扱われます」）", () => {
    const s = soul(enter(soulState(), "RS-421:ak"), "RS-099:hr");
    expect(s.players.player1.command.find((c) => c.instanceId === "RS-099:hr")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", "RS-421:ak")).toBe(1);
  });

  it("RS-421: 【ソウル降臨】発動したらストライクはできない（「SP1」を得ていても）（出典: atwiki/page-574「ただしストライクはできない」・grnrngr/faq-card-6 RS-421 Q3「はい、その通りです」）", () => {
    const s = soul(enter(soulState(), "RS-421:ak"), "RS-099:hr");
    expect(canStrike(s, "RS-421:ak")).toBe(false);
  });

  // 既知の不具合: CARD-RS-421 【ソウル降臨】で NC の効果が発動しない（ゴーレッド【人命救助】の選択が出ない）
  it("RS-421: 【ソウル降臨】ホールドしたカードの CN（ゴーレッドは5）をアカレッドが満たしていなくても（1番目でも）NC を発動できる（ゴーレッド【人命救助】）（出典: grnrngr/faq-card-6 RS-421 Q6「はい、発動できます」）", () => {
    let s = enter(
      soulState({ command: [released("RS-091", "gr")], discard: [inst("TST-UNIT-0", "dead")] }),
      "RS-421:ak",
    );
    s = soul(s, "RS-091:gr");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("TST-UNIT-0:dead");
    s = resolveAll(pick(s, "TST-UNIT-0:dead"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:dead")).toBe("hand");
  });

  it("RS-421: 【ソウル降臨】「ホールドしてもよい」— 見送ればコマンドはホールドされず、ストライク制限も付かない（出典: atwiki/page-574「ホールドしてもよい」）", () => {
    let s = enter(soulState(), "RS-421:ak");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player1.command.find((c) => c.instanceId === "RS-099:hr")?.commandHeld).toBe(false);
    expect(attackTargets(s, "RS-421:ak")).toEqual(["TST-UNIT-0:e1"]);
  });

  it("RS-421: 【ソウル降臨】「自軍ターン中」— 敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-574「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-421", "ak")], command: [released("RS-099", "hr")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });
    const t = enterBattleByEffect(s, "player1", "RS-421:ak");
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(t.players.player1.command[0]?.commandHeld).toBe(false);
  });

  // 既知の不具合: CARD-RS-421 【ソウル降臨】で NC の効果が発動しない（NC の効果として扱われるかを確認できない）
  it("RS-421: 【ソウル降臨】で発動した効果はアカレッドがコンビネーションしていなくても NC の効果として扱われる（「SP1」が NC として付く）（出典: grnrngr/faq-card-6 RS-421 Q1「はい、ＮＣの効果として扱われます」）", () => {
    const s = soul(enter(soulState(), "RS-421:ak"), "RS-099:hr");
    expect(spOf(s, "player1", "RS-421:ak")).toBe(1);
    expect(s.log.some((l) => l.includes("number_combo") || l.includes("RS-099"))).toBe(true);
  });

  it.todo(
    "RS-421: 勇気の魔法でリリースしたレッドのユニットカードを【ソウル降臨】でホールドして NC を発動できる（出典: grnrngr/faq-card-6 RS-421 Q4「はい、できます」）— 勇気の魔法（RS-029）と【ソウル降臨】の誘発順をプレイヤーが選ぶ手段（同時誘発の順序選択）が公開 API にないため",
  );

  // 既知の不具合: CARD-RS-421 【ソウル降臨】で NC が発動せず、RS-418 イフリートの【炎の眼光】も実装されていない
  it("RS-421: 【ソウル降臨】で発動した NC の効果は、敵軍の冥府神イフリートの【炎の眼光】で無効にできる（出典: grnrngr/faq-card-6 RS-421 Q5「はい、できます」）", () => {
    let s = st({
      player1: { rush: [inst("RS-421", "ak")], command: [released("RS-099", "hr")], deck: deckCards(3) },
      player2: { battle: [inst("RS-418", "if")], operation: [inst("RS-256", "op")], deck: deckCards(3, "e") },
    });
    s = soul(enter(s, "RS-421:ak"), "RS-099:hr");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-418");
    s = resolveAll(pick(s, "RS-256:op"));
    expect(spOf(s, "player1", "RS-421:ak")).toBe(0);
  });
});

// ===========================================================================
describe("RS-422 ゲキトージャ", () => {
  const TEXT =
    "合体－ゲキレッドまたはゲキタイガー＋ゲキイエローまたはゲキチーター＋ゲキブルーまたはゲキジャガー【大頑頑拳】これがアタックしてバトルに勝つたび、敵軍コマンドを1つ選びホールドしてもよい。そうしたとき、これは追加でアタックできる（ストライクはできない）。";

  it("RS-422: カタログ本文・スペックが出典と一致（出典: atwiki/page-542）", () => {
    expectCatalogText("RS-422", TEXT);
    expectStats("RS-422", {
      name: "ゲキトージャ",
      category: "WB",
      size: "L",
      bp: 9000,
      sp: 1,
      powerCost: "6+",
      features: ["激気", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const rushState = (rush: CardInstance[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-422", "gt")], rush, command: releasedCat("WB", 2), power: powerCards(6), deck: deckCards(3) } });

  it("RS-422: 追加条件 — ゲキレッド（S）＋ゲキチーター（M）＋ゲキジャガー（M）のようにサイズが揃っていなくても合体ユニットとして捨札にしてラッシュできる（出典: grnrngr/faq-card-6 RS-422 Q「はい、できます」）", () => {
    const r = rushFromHand(rushState([inst("RS-340", "r"), inst("RS-424", "c"), inst("RS-425", "j")]), "player1", "RS-422:gt");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-422:gt")).toBe("rush");
    for (const id of ["RS-340:r", "RS-424:c", "RS-425:j"]) expect(zoneOf(t, "player1", id)).toBe("discard");
  });

  it("RS-422: 追加条件 — ゲキレッド＋ゲキイエロー＋ゲキブルーでラッシュできる（出典: atwiki/page-542「合体－ゲキレッドまたはゲキタイガー＋ゲキイエローまたはゲキチーター＋ゲキブルーまたはゲキジャガー」）", () => {
    const r = rushFromHand(rushState([inst("RS-340", "r"), inst("RS-342", "y"), inst("RS-341", "b")]), "player1", "RS-422:gt");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-422:gt")).toBe("rush");
  });

  it("RS-422: 追加条件 — 3種のうち1つ（ブルー／ジャガー）が欠けていればラッシュできない（出典: atwiki/page-542）", () => {
    expect(canStartRush(rushState([inst("RS-340", "r"), inst("RS-424", "c")]), "player1", "RS-422:gt")).toBe(false);
    expect(canStartRush(rushState([inst("RS-340", "r"), inst("RS-340", "r2"), inst("RS-341", "b")]), "player1", "RS-422:gt")).toBe(false);
  });

  /** 自軍バトルフェイズ: ゲキトージャがバトルエリアに。敵軍: BP1000 ×2、コマンドはリリース1・ホールド1。 */
  const battleState = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({
      player1: { battle: [inst("RS-422", "gt")], deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")],
        command: [released("TST-OP", "c1"), held("TST-OP", "c2")],
        deck: deckCards(3, "e"),
        ...p2,
      },
    });

  // 既知の不具合: CARD-RS-422 【大頑頑拳】が実装されていない（アタックしてバトルに勝っても敵軍コマンドをホールドする選択が出ない）
  it.fails("RS-422: 【大頑頑拳】アタックしてバトルに勝ったとき、敵軍コマンドを1つホールドすれば追加でアタックできる（出典: atwiki/page-542「敵軍コマンドを1つ選びホールドしてもよい。そうしたとき、これは追加でアタックできる」）", () => {
    let s = attack(battleState(), "RS-422:gt", "TST-UNIT-0:e1");
    s = settle(s);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-422");
    expect(choiceIds(s)).toContain("TST-OP:c1");
    s = settle(pick(s, "TST-OP:c1"));
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:c1")?.commandHeld).toBe(true);
    expect(attackTargets(s, "RS-422:gt")).toEqual(["TST-UNIT-0:e2"]);
  });

  // 既知の不具合: CARD-RS-422 【大頑頑拳】が実装されていない（追加アタックが得られない）
  it.fails("RS-422: 【大頑頑拳】追加のアタックの代わりにストライクはできない（出典: atwiki/page-542「（ストライクはできない）」）", () => {
    let s = settle(attack(battleState(), "RS-422:gt", "TST-UNIT-0:e1"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-422");
    s = settle(pick(s, "TST-OP:c1"));
    expect(attackTargets(s, "RS-422:gt")).toEqual(["TST-UNIT-0:e2"]);
    expect(canStrike(s, "RS-422:gt")).toBe(false);
  });

  it("RS-422: 【大頑頑拳】「ホールドしてもよい」— ホールドしなければ追加でアタックできない（出典: atwiki/page-542）", () => {
    let s = settle(attack(battleState(), "RS-422:gt", "TST-UNIT-0:e1"));
    if (s.pendingEffectChoice?.sourceCardId === "RS-422") {
      expect(canSkip(s)).toBe(true);
      s = settle(skip(s));
    }
    expect(attackTargets(s, "RS-422:gt")).toEqual([]);
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:c1")?.commandHeld).toBe(false);
  });

  it("RS-422: 【大頑頑拳】バトルに勝てなければ（BP が上回られれば）発動しない（出典: atwiki/page-542「アタックしてバトルに勝つたび」）", () => {
    const s = settle(attack(battleState({ battle: [inst("TST-UNIT-7", "big")] }), "RS-422:gt", "TST-UNIT-7:big"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-422");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:c1")?.commandHeld).toBe(false);
  });

  // 既知の不具合: CARD-RS-422 【大頑頑拳】が実装されていない（「勝つたび」の2回目の誘発もない）
  it.fails("RS-422: 【大頑頑拳】「勝つたび」— 追加のアタックでも勝てば、もう一度コマンドをホールドして追加でアタックできる（出典: atwiki/page-542「バトルに勝つたび」）", () => {
    let s = battleState({ battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")], command: [released("TST-OP", "c1"), released("TST-OP", "c3")] });
    s = settle(attack(s, "RS-422:gt", "TST-UNIT-0:e1"));
    s = settle(pick(s, "TST-OP:c1"));
    s = settle(attack(s, "RS-422:gt", "TST-UNIT-0:e2"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-422");
    s = settle(pick(s, "TST-OP:c3"));
    expect(attackTargets(s, "RS-422:gt")).toEqual(["TST-UNIT-0:e3"]);
  });
});

// ===========================================================================
/** 「特徴「激気」と「<色>」を持つ自軍ユニット1体を捨札にする」M ユニットの追加条件テスト。 */
function gekiMConditionTests(id: string, color: string, ok: string, okName: string, ngColorOnly: string, ngGekiOnly: string | null, cost: number, page: string) {
  const mk = (material: string) =>
    st({ phase: "rush", player1: { hand: [inst(id, "me")], rush: [inst(material, "m")], command: releasedCat("WB", 1), power: powerCards(cost), deck: deckCards(3) } });

  // 既知の不具合: CARD-RS-423 / CARD-RS-424 / CARD-RS-425 追加条件「特徴「激気」と「<色>」を持つ自軍ユニット」がカード名に「激気」を含むかの判定（partnerName「激気」）になっており、満たせない
  it.fails(`${id}: 追加条件 — 特徴「激気」と「${color}」を持つ自軍ユニット（${okName}）を捨札にしてラッシュできる（出典: atwiki/${page}「追加条件：特徴「激気」と「${color}」を持つ自軍ユニット1体を捨札にする」）`, () => {
    const r = rushFromHand(mk(ok), "player1", `${id}:me`);
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:me`)).toBe("rush");
    expect(zoneOf(t, "player1", `${ok}:m`)).toBe("discard");
  });

  it(`${id}: 追加条件 — 「${color}」だけで「激気」を持たないユニット（${ngColorOnly}）では満たせない（出典: atwiki/${page}）`, () => {
    expect(canStartRush(mk(ngColorOnly), "player1", `${id}:me`)).toBe(false);
  });

  if (ngGekiOnly) {
    it(`${id}: 追加条件 — 「激気」だけで「${color}」を持たないユニット（${ngGekiOnly}）では満たせない（出典: atwiki/${page}）`, () => {
      expect(canStartRush(mk(ngGekiOnly), "player1", `${id}:me`)).toBe(false);
    });
  }
}

// ===========================================================================
describe("RS-423 ゲキタイガー", () => {
  const TEXT =
    "【咆咆弾】これをラッシュしたとき、特徴「メカ」を持たない敵軍ユニットを、BPの合計が5000以下になるように選んで撃破してもよい。ただし選べるユニットの数は、WBの自軍Mユニットの数までとする。";

  it("RS-423: カタログ本文・スペックが出典と一致（出典: atwiki/page-519）", () => {
    expectCatalogText("RS-423", TEXT);
    expectStats("RS-423", {
      name: "ゲキタイガー",
      category: "WB",
      size: "M",
      bp: 5500,
      sp: undefined,
      powerCost: "3+",
      features: ["激気"],
      rushCondition: "discard_named_unit",
    });
  });

  gekiMConditionTests("RS-423", "レッド", "RS-426", "スーパーゲキレッド", "RS-340", "RS-499", 3, "page-519");

  /** スーパーゲキレッドを捨札にしてゲキタイガーをラッシュする（自軍ラッシュエリアに WB の M ユニットを extraM 体）。 */
  const rushTiger = (extraM: number, p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-423", "tg")],
        rush: [inst("RS-426", "m"), ...Array.from({ length: extraM }, (_, i) => inst("TST-UNIT-2", `wbm${i}`))],
        command: releasedCat("WB", 1),
        power: powerCards(3),
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
    const r = rushFromHand(s, "player1", "RS-423:tg");
    expect(r.ok).toBe(true);
    return r.state;
  };
  const foes = { battle: [inst("TST-UNIT-0", "e1"), inst("RS-430", "mecha")], rush: [inst("TST-UNIT-2", "e3"), inst("RS-340", "e3b"), inst("RS-422", "big")] };

  // 既知の不具合: CARD-RS-423 追加条件を満たせずラッシュできないため【咆咆弾】に到達しない
  it.fails("RS-423: 【咆咆弾】メカを持たない BP の合計5000以下の敵軍ユニットを、WB の自軍 M ユニットの数（ゲキタイガー＋1体＝2体）まで選んで撃破できる（出典: atwiki/page-519）", () => {
    let s = rushTiger(1, foes);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-423");
    expect(choiceIds(s)).not.toContain("RS-430:mecha");
    expect(choiceIds(s)).not.toContain("RS-422:big");
    s = resolveAll(s, ["TST-UNIT-0:e1", "RS-340:e3b"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-340:e3b")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-423 追加条件を満たせずラッシュできないため【咆咆弾】に到達しない
  it.fails("RS-423: 【咆咆弾】WB の自軍 M ユニットがゲキタイガー1体だけなら1体までしか撃破できない（出典: atwiki/page-519「選べるユニットの数は、WBの自軍Mユニットの数までとする」）", () => {
    let s = rushTiger(0, foes);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-423");
    s = resolveAll(s, ["TST-UNIT-0:e1", "RS-340:e3b"]);
    const destroyed = ["TST-UNIT-0:e1", "RS-340:e3b", "TST-UNIT-2:e3"].filter((x) => zoneOf(s, "player2", x) === "discard");
    expect(destroyed).toHaveLength(1);
  });

  // 既知の不具合: CARD-RS-423 追加条件を満たせずラッシュできないため【咆咆弾】に到達しない
  it.fails("RS-423: 【咆咆弾】BP の合計は5000以下 — BP3000＋BP3000 の2体は選べない（出典: atwiki/page-519「BPの合計が5000以下になるように」）", () => {
    let s = rushTiger(1, { battle: [inst("RS-340", "a")], rush: [inst("RS-340", "b")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-423");
    s = resolveAll(s, ["RS-340:a", "RS-340:b"]);
    const destroyed = ["RS-340:a", "RS-340:b"].filter((x) => zoneOf(s, "player2", x) === "discard");
    expect(destroyed).toHaveLength(1);
  });

  // 既知の不具合: CARD-RS-423 追加条件を満たせずラッシュできないため【咆咆弾】の任意性も確認できない
  it.fails("RS-423: 【咆咆弾】「撃破してもよい」— 見送れる（出典: atwiki/page-519）", () => {
    let s = rushTiger(1, foes);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-423");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-423: 【咆咆弾】「ラッシュしたとき」— ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-519「これをラッシュしたとき」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-423", "tg")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } }), "RS-423:tg");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-424 ゲキチーター", () => {
  const TEXT = "【瞬瞬弾】「SP1」";

  it("RS-424: カタログ本文・スペックが出典と一致（SP「！」・CN2・必要パワー0+）（出典: atwiki/page-520）", () => {
    expectCatalogText("RS-424", TEXT);
    expectStats("RS-424", {
      name: "ゲキチーター",
      category: "WB",
      size: "M",
      bp: 5500,
      sp: "special",
      powerCost: "0+",
      comboNumber: 2,
      features: ["激気"],
      rushCondition: "discard_named_unit",
    });
  });

  gekiMConditionTests("RS-424", "イエロー", "RS-427", "スーパーゲキイエロー", "RS-342", "RS-426", 0, "page-520");

  it("RS-424: 【瞬瞬弾】2番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-520「【瞬瞬弾】「SP1」」・R-CN-02）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("TST-UNIT-0", "f1"), inst("RS-424", "ch")], deck: deckCards(3) } }), ["TST-UNIT-0:f1", "RS-424:ch"]);
    expect(spOf(s, "player1", "RS-424:ch")).toBe(1);
  });

  it("RS-424: 【瞬瞬弾】1番目に出たとき（NC 不成立）は SP がない（出典: atwiki/page-520・R-CN-02）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("RS-424", "ch")], deck: deckCards(3) } }), ["RS-424:ch"]);
    expect(spOf(s, "player1", "RS-424:ch")).toBe(0);
  });

  // 既知の不具合: CARD-RS-424 NC の発動判定がフェイズ（バトル）だけで、敵軍のバトルフェイズに効果で2番目に出されても「SP1」になる（R-CN-04）
  it.fails("RS-424: 【瞬瞬弾】敵軍ターン中に2番目に出されても NC は発動しない（出典: R-CN-04「コンビネーションの効果を発動できるのは、自分のバトルフェイズ」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("TST-UNIT-0", "f1")], rush: [inst("RS-424", "ch")], deck: deckCards(3) } });
    const t = enterBattleByEffect(s, "player1", "RS-424:ch");
    expect(spOf(t, "player1", "RS-424:ch")).toBe(0);
  });
});

// ===========================================================================
describe("RS-425 ゲキジャガー", () => {
  const TEXT = "【転転弾】これをラッシュしたとき、敵軍ユニットを1体選んで撃破してもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない。";

  it("RS-425: カタログ本文・スペックが出典と一致（出典: atwiki/page-521）", () => {
    expectCatalogText("RS-425", TEXT);
    expectStats("RS-425", {
      name: "ゲキジャガー",
      category: "WB",
      size: "M",
      bp: 5500,
      sp: undefined,
      powerCost: "2+",
      features: ["激気"],
      rushCondition: "discard_named_unit",
    });
  });

  gekiMConditionTests("RS-425", "ブルー", "RS-428", "スーパーゲキブルー", "RS-341", "RS-426", 2, "page-521");

  const rushJaguar = (damage: number) => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-425", "jg")], rush: [inst("RS-428", "m")], command: releasedCat("WB", 1), power: powerCards(2), deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-2", "c2"), inst("RS-340", "c3")],
        rush: [inst("RS-426", "c7")],
        power: damageCards(damage, "ed"),
        damage,
        deck: deckCards(3, "e"),
      },
    });
    const r = rushFromHand(s, "player1", "RS-425:jg");
    expect(r.ok).toBe(true);
    return r.state;
  };

  // 既知の不具合: CARD-RS-425 追加条件を満たせずラッシュできないため【転転弾】に到達しない
  it.fails("RS-425: 【転転弾】必要パワーの数字が敵軍ダメージ（2点）以下の敵軍ユニットだけを選んで撃破できる（必要パワー3・「7-」は選べない）（出典: atwiki/page-521「必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない」）", () => {
    let s = rushJaguar(2);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-425");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:c2"]);
    s = resolveAll(pick(s, "TST-UNIT-2:c2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-425 追加条件を満たせずラッシュできないため【転転弾】に到達しない
  it.fails("RS-425: 【転転弾】「撃破してもよい」— 見送れる（出典: atwiki/page-521）", () => {
    let s = rushJaguar(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-425");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("battle");
  });

  it("RS-425: 【転転弾】「ラッシュしたとき」— ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-521「これをラッシュしたとき」）", () => {
    const s = enter(
      st({ player1: { rush: [inst("RS-425", "jg")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], power: damageCards(3, "ed"), damage: 3, deck: deckCards(3, "e") } }),
      "RS-425:jg",
    );
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

