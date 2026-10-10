/**
 * カード別スペック: RS-306〜RS-313（第5弾「五龍の逆鱗」ハリケンレッド〜クワガライジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）ほか card_2/card_4 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/318.txt のみ存在し本文同一）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canSkip,
  canStrike,
  choiceIds,
  damageCards,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  nextPhase,
  passEntry,
  pick,
  powerCards,
  released,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  useCard,
  zoneIds,
  zoneOf,
} from "./RS5-306-326.helpers";
import type { GameState, PlayerId } from "../types/game";

/** 自軍バトルフェイズに、指定ユニットの「アタックするかわりに」（use_juu_kun_do）が合法か。 */
function canUseInstead(s: GameState, attacker: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) => a.type === "use_juu_kun_do" && a.playerId === playerId && a.attackerInstanceId === attacker,
  );
}

const NINJA = sUnit("SPEC-NINJA", { bp: 1000, features: ["忍者"] });
const NINJA_M = sUnit("SPEC-NINJA-M", { size: "M", bp: 1000, features: ["忍者"] });
const MALE = sUnit("SPEC-MALE", { bp: 1000, features: ["男"] });
const BEAST = sUnit("SPEC-BEAST", { bp: 1000, features: ["獣"] });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 1000 });
const EM3K = sUnit("SPEC-EM", { size: "M", bp: 3000 });
const FEMALE = sUnit("SPEC-FEMALE", { bp: 1000, features: ["女"] });
const SPECS = [NINJA, NINJA_M, MALE, BEAST, MA_S, EM3K, FEMALE];

// ===========================================================================
describe("RS-306 ハリケンレッド", () => {
  it("RS-306: カタログ本文・スペックが出典と一致（出典: atwiki/page-317）", () => {
    expectCatalogText("RS-306", "【超忍法・空駆け】「SP1」");
    expectStats("RS-306", {
      name: "ハリケンレッド",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 3,
      features: ["レッド", "男", "忍者"],
    });
  });

  // 「CN：3」「【超忍法・空駆け】「SP1」」
  it("RS-306: 3番目に出ると NC が成立して「SP1」になり、ストライクで1点与える（出典: atwiki/page-317）", () => {
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-306", "r")] }, player2: { power: powerCards(2, "e") } });
    s = enter(s, "RS-306:r");
    expect(spOf(s, "player1", "RS-306:r")).toBe(1);
    expect(canStrike(s, "RS-306:r")).toBe(true);
    s = settle(strike(s, "RS-306:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「SP：！」— NC 不成立なら SP なし（R-STK-02）
  it("RS-306: 3番目以外で出たときは「SP！」のままでストライクできない（出典: atwiki/page-317「SP：！」・R-STK-02）", () => {
    const s = enter(st({ player1: { battle: fillers(1), rush: [inst("RS-306", "r")] } }), "RS-306:r");
    expect(spOf(s, "player1", "RS-306:r")).toBe(0);
    expect(canStrike(s, "RS-306:r")).toBe(false);
  });
});

// ===========================================================================
describe("RS-307 ハリケンイエロー", () => {
  const TEXT =
    "【超忍法・舞獅子】これはアタックするかわりに次の効果を発動できる。自軍山札を見て「ハリケンイエロー」のカードを1枚選んで自軍バトルエリアに出してもよい。その後、山札をシャッフルする。";

  it("RS-307: カタログ本文・スペックが出典と一致（出典: atwiki/page-318・pages/318.txt）", () => {
    expectCatalogText("RS-307", TEXT);
    expectStats("RS-307", {
      name: "ハリケンイエロー",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 1,
      features: ["イエロー", "男", "忍者"],
    });
  });

  function yellowFirst(deck = [inst("RS-307", "d1"), ...deckCards(3)], enemyBattle = [inst("TST-UNIT-0", "e")], extra: Partial<GameState["players"]["player1"]> = {}) {
    const s = st({
      player1: { rush: [inst("RS-307", "y")], deck, ...extra },
      player2: { battle: enemyBattle },
    });
    return enter(s, "RS-307:y");
  }

  // 「これはアタックするかわりに次の効果を発動できる。自軍山札を見て「ハリケンイエロー」のカードを1枚選んで自軍バトルエリアに出してもよい」
  it("RS-307: 1番目に出たとき、アタックするかわりに山札のハリケンイエローをバトルエリアに出し、そのユニットはアタックできなくなる（出典: atwiki/page-318）", () => {
    let s = yellowFirst();
    expect(canUseInstead(s, "RS-307:y")).toBe(true);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-307:y" });
    expect(choiceIds(s)).toEqual(["RS-307:d1"]);
    s = pick(s, "RS-307:d1");
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-307:d1")).toBe("battle");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-307:y")).toBe(false);
  });

  it("RS-307: 2番目に出たとき（NC 不成立）は発動できない（出典: atwiki/page-318「CN：1」・R-CN-02）", () => {
    let s = st({
      player1: { battle: fillers(1), rush: [inst("RS-307", "y")], deck: [inst("RS-307", "d1")] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = enter(s, "RS-307:y");
    expect(canUseInstead(s, "RS-307:y")).toBe(false);
  });

  it("RS-307: 発動せずに通常どおりアタックすることもできる（「発動できる」は任意）（出典: atwiki/page-318「発動できる」）", () => {
    const s = yellowFirst();
    expect(attackTargets(s, "RS-307:y")).toEqual(["TST-UNIT-0:e"]);
  });

  // 「出してもよい」
  it("RS-307: 山札にハリケンイエローがあっても出さないことを選べる（任意）（出典: atwiki/page-318「出してもよい」）", () => {
    let s = yellowFirst();
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-307:y" });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-307:d1")).toBe("deck");
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-307:y")).toBe(false);
  });

  // 「「ハリケンイエロー」のカードを1枚選んで」— 同名の別 ID（RS-100）も対象。どれを出すかは自分が選ぶ
  it("RS-307: 山札に同名カード（RS-100 ハリケンイエロー含む）が複数あれば、どれを出すか選べる（ハリケンイエロー以外は選べない）（出典: atwiki/page-318「1枚選んで」）", () => {
    let s = yellowFirst([inst("RS-307", "d1"), inst("RS-306", "red"), ...deckCards(2), inst("RS-100", "d2")]);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-307:y" });
    expect(choiceIds(s)).toEqual(["RS-100:d2", "RS-307:d1"]);
    s = pick(s, "RS-100:d2");
    expect(zoneOf(s, "player1", "RS-100:d2")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-307:d1")).toBe("deck");
  });

  // 「その後、山札をシャッフルする」— 山札の中身（枚数）が保たれる
  it("RS-307: 発動後の山札は出したカード以外そのまま残る（シャッフル）（出典: atwiki/page-318「その後、山札をシャッフルする」）", () => {
    let s = yellowFirst([inst("RS-307", "d1"), ...deckCards(5)]);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-307:y" });
    s = pick(s, "RS-307:d1");
    expect(zoneIds(s, "player1", "deck").slice().sort()).toEqual(deckCards(5).map((c) => c.instanceId).sort());
  });

  // atwiki/page-318 Q1（= faq-card-2 RS-100 Q1）「はい、できます。」
  it("RS-307: Q&A — 山札にハリケンイエローが1枚もなくても発動できる（出典: atwiki/page-318 Q1・grnrngr/faq-card-2 RS-100 Q1）", () => {
    let s = yellowFirst(deckCards(3));
    expect(canUseInstead(s, "RS-307:y")).toBe(true);
    s = settle(act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-307:y" }));
    expect(s.players.player1.battle).toHaveLength(1);
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-307:y")).toBe(false);
  });

  // atwiki/page-318 Q2「ルール整理後（※公式コラムvol44より抜粋）：…アタックする対象がいない状態でも、アタックする権利を失う代わりに効果を発動することができる」
  // （faq-card-2 RS-100 Q2 の旧裁定「発動できません」は vol44 のルール整理で置き換え。ユーザー決定・R-ATK-05）
  it("RS-307: Q&A（ルール整理後）— 相手のバトルエリアにユニットがいなくても発動できる（出典: atwiki/page-318 Q2・R-ATK-05。faq-card-2 RS-100 Q2 は旧裁定）", () => {
    let s = yellowFirst(undefined, []);
    expect(canUseInstead(s, "RS-307:y")).toBe(true);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-307:y" });
    s = pick(s, "RS-307:d1");
    expect(zoneOf(s, "player1", "RS-307:d1")).toBe("battle");
  });

  // faq-card-4 RS-187 Q「いいえ、できません。アタックできる状態であれば、アタックしなければなりません。」（RS-100 ハリケンイエローについての回答。同文の RS-307 にも適用）
  it("RS-307: 公式Q&A — ゴーマ宮があり1番目でアタックできる状態なら、「アタックするかわりに」は発動できない（出典: grnrngr/faq-card-4 RS-187・R-ATK-05）", () => {
    const s = yellowFirst(undefined, [inst("TST-UNIT-0", "e")], { operation: [inst("RS-187", "goma")] });
    expect(canUseInstead(s, "RS-307:y")).toBe(false);
    expect(attackTargets(s, "RS-307:y")).toEqual(["TST-UNIT-0:e"]);
  });
});

// ===========================================================================
describe("RS-308 ハリケンブルー", () => {
  it("RS-308: カタログ本文・スペックが出典と一致（出典: atwiki/page-319）", () => {
    expectCatalogText("RS-308", "【超忍法・水変化】相手は自分自身のラッシュエリアからSユニットを1体選んで手札に戻す。");
    expectStats("RS-308", {
      name: "ハリケンブルー",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 4,
      features: ["ブルー", "女", "忍者"],
    });
  });

  function blueFourth(enemyRush: ReturnType<typeof inst>[]) {
    const s = st({ player1: { battle: fillers(3), rush: [inst("RS-308", "b")] }, player2: { rush: enemyRush } }, SPECS);
    return enter(s, "RS-308:b");
  }

  // 「相手は自分自身のラッシュエリアからSユニットを1体選んで手札に戻す」
  it("RS-308: 4番目に出ると、相手が自分のラッシュエリアの S ユニットを1体選んで手札に戻す（M は対象外）（出典: atwiki/page-319）", () => {
    let s = blueFourth([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("SPEC-EM", "m")]);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    s = pick(s, "TST-UNIT-0:e2");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-EM:m")).toBe("rush");
  });

  // 「選んで手札に戻す」（「してもよい」ではない＝強制）
  it("RS-308: 相手は戻すことを拒否できない（強制）（出典: atwiki/page-319「手札に戻す」）", () => {
    const s = blueFourth([inst("TST-UNIT-0", "e1")]);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-308: 相手のラッシュエリアに S ユニットがなければ何も起きない（出典: atwiki/page-319）", () => {
    const s = blueFourth([inst("SPEC-EM", "m")]);
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-EM:m")).toBe("rush");
  });

  it("RS-308: 4番目以外で出たときは発動しない（出典: atwiki/page-319「CN：4」・R-CN-02）", () => {
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-308", "b")] }, player2: { rush: [inst("TST-UNIT-0", "e1")] } });
    s = enter(s, "RS-308:b");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-309 轟雷神", () => {
  const TEXT =
    "合体―ゴウライビートル＋ゴウライスタッグ【ゴウライキャノン】これがストライクしてダメージを与えたとき、敵軍コマンドゾーンと敵軍パワーゾーンのダメージ以外のカードから、それぞれ1枚ずつ選んでもよい。そうしたとき、選んだカードを持ち主の手札に戻す。";

  it("RS-309: カタログ本文・スペックが出典と一致（出典: atwiki/page-479）", () => {
    expectCatalogText("RS-309", TEXT);
    expectStats("RS-309", {
      name: "轟雷神",
      category: "MA",
      size: "L",
      bp: 8000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「必要パワー：6+」「追加条件：自軍合体ユニットを捨札にする」「合体―ゴウライビートル＋ゴウライスタッグ」
  it("RS-309: 自軍のゴウライビートルとゴウライスタッグを捨札にしてラッシュできる（出典: atwiki/page-479・R-ADD-06）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-309", "g")], rush: [inst("RS-310", "b"), inst("RS-311", "s")], power: powerCards(6), command: [released("TST-OP-MA", "c")] },
    });
    const r = rushFromHand(s, "player1", "RS-309:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-309:g")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-310:b")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-311:s")).toBe("discard");
  });

  it("RS-309: 合体ユニットが片方しかなければラッシュできない（出典: atwiki/page-479「合体―ゴウライビートル＋ゴウライスタッグ」・R-ADD-06）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-309", "g")], rush: [inst("RS-310", "b")], power: powerCards(6), command: [released("TST-OP-MA", "c")] },
    });
    expect(rushFromHand(s, "player1", "RS-309:g").ok).toBe(false);
  });

  /** 轟雷神がストライクしてダメージを与えた直後（ダメージの支払いを済ませた状態）。 */
  function gouraiStrike(enemy: Partial<GameState["players"]["player2"]>) {
    let s = st({
      player1: { battle: [inst("RS-309", "g")] },
      player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e"), ...enemy },
    });
    s = strike(s, "RS-309:g");
    for (let i = 0; i < 4 && s.pendingDamagePayment; i++) {
      const a = legal(s).find((x) => x.type === "resolve_damage_payment");
      if (!a) break;
      s = act(s, a);
    }
    return s;
  }

  // 「敵軍コマンドゾーンと敵軍パワーゾーンのダメージ以外のカードから、それぞれ1枚ずつ選んでもよい。そうしたとき、選んだカードを持ち主の手札に戻す」
  // 既知の不具合: CARD-RS-309 ゴウライキャノンが敵軍コマンド／パワーではなく敵軍バトルエリアのユニットを選ばせる（汎用 return_to_zone パターン）
  it.fails("RS-309: ストライクでダメージを与えたとき、敵軍コマンドとダメージ以外の敵軍パワーから1枚ずつ選んで持ち主の手札に戻す（出典: atwiki/page-479）", () => {
    let s = gouraiStrike({ power: [...powerCards(2, "ep"), ...damageCards(1, "ed")], command: [held("TST-OP", "c0")] });
    const faceUp = s.players.player2.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
    expect(faceUp).toHaveLength(1);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    const cands = choiceIds(s);
    expect(cands).toContain("TST-OP:c0");
    expect(cands).not.toContain("TST-UNIT-0:eb");
    expect(cands.filter((id) => id.startsWith("TST-P:ed"))).toEqual([]);
    s = pick(s, "TST-OP:c0");
    if (s.pendingEffectChoice) s = pick(s, faceUp[0]!);
    expect(zoneOf(s, "player2", "TST-OP:c0")).toBe("hand");
    expect(zoneOf(s, "player2", faceUp[0]!)).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
  });

  // 「選んでもよい」— 任意
  // 既知の不具合: CARD-RS-309 ゴウライキャノンの選択肢に敵軍コマンドが出ない（敵軍バトルエリアのユニットが候補になる）
  it.fails("RS-309: 選ばないことを選べ、その場合は敵軍コマンド・パワーは動かない（出典: atwiki/page-479「選んでもよい」）", () => {
    let s = gouraiStrike({ power: powerCards(2, "ep"), command: [held("TST-OP", "c0")] });
    expect(choiceIds(s)).toContain("TST-OP:c0");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "TST-OP:c0")).toBe("command");
    expect(s.players.player2.hand).toEqual([]);
  });

  it("RS-309: ストライクせずアタックしたとき（ストライクでダメージを与えていない）は発動しない（出典: atwiki/page-479「ストライクしてダメージを与えたとき」）", () => {
    let s = st({
      player1: { battle: [inst("RS-309", "g")] },
      player2: { battle: [inst("TST-UNIT-0", "eb")], power: powerCards(2, "ep"), command: [held("TST-OP", "c0")], deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "RS-309:g", "TST-UNIT-0:eb"));
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "TST-OP:c0")).toBe("command");
    expect(s.players.player2.hand).toEqual([]);
  });

  // faq-card-5 RS-309 Q1「はい、できます。」
  // 既知の不具合: CARD-RS-309 ゴウライキャノンで敵軍コマンドゾーンのカードを選べない
  it.fails("RS-309: 公式Q&A — 敵軍パワーにダメージ以外のカードがなくても、敵軍コマンドのカードだけを選んで手札に戻せる（出典: grnrngr/faq-card-5 RS-309 Q1）", () => {
    let s = gouraiStrike({ power: [inst("TST-P", "only")], command: [held("TST-OP", "c0")] });
    expect(s.players.player2.power.every((c) => c.faceDown)).toBe(true);
    expect(choiceIds(s)).toEqual(["TST-OP:c0"]);
    s = pick(s, "TST-OP:c0");
    expect(zoneOf(s, "player2", "TST-OP:c0")).toBe("hand");
  });

  // faq-card-5 RS-309 Q2「いいえ、どちらか1枚でも選ぶことができれば発動できます。」
  // 既知の不具合: CARD-RS-309 ゴウライキャノンで敵軍パワーゾーンのカードを選べない
  it.fails("RS-309: 公式Q&A — 敵軍コマンドが空でも、ダメージ以外の敵軍パワーが1枚あれば発動できる（出典: grnrngr/faq-card-5 RS-309 Q2）", () => {
    let s = gouraiStrike({ power: powerCards(2, "ep"), command: [] });
    const faceUp = s.players.player2.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
    expect(choiceIds(s)).toEqual(faceUp);
    s = pick(s, faceUp[0]!);
    expect(zoneOf(s, "player2", faceUp[0]!)).toBe("hand");
  });
});

// ===========================================================================
describe("RS-310 ゴウライビートル", () => {
  const TEXT =
    "【カラクリ忍法・角変化】これは、自分と相手のダメージ1点につきBP＋1000され、BP8000以上のとき「SP1」になる。これは、自分か相手がターンを終えるときBP8000以上なら撃破される。";

  it("RS-310: カタログ本文・スペックが出典と一致（出典: atwiki/page-480）", () => {
    expectCatalogText("RS-310", TEXT);
    expectStats("RS-310", {
      name: "ゴウライビートル",
      category: "MA",
      size: "M",
      bp: 2000,
      sp: "special",
      powerCost: "3+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  // 「追加条件：自軍Sユニットを1体捨札にする」
  it("RS-310: 自軍 S ユニットを1体捨札にしてラッシュできる（出典: atwiki/page-480「追加条件：自軍Sユニットを1体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-310", "h")], rush: [inst("TST-UNIT-0", "f")], power: powerCards(3), command: [released("TST-OP-MA", "c")] } });
    const r = rushFromHand(s, "player1", "RS-310:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-310:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:f")).toBe("discard");
  });

  it("RS-310: 自軍 S ユニットがいなければラッシュできない（出典: atwiki/page-480・R-ADD-01）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-310", "h")], power: powerCards(3), command: [released("TST-OP-MA", "c")] } });
    expect(rushFromHand(s, "player1", "RS-310:h").ok).toBe(false);
  });

  function beetle(own: number, enemy: number, zone: "battle" | "rush" = "battle") {
    return st({
      player1: { [zone]: [inst("RS-310", "b")], damage: own, power: damageCards(own) },
      player2: { damage: enemy, power: damageCards(enemy, "ed"), battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e") },
    });
  }

  // 「自分と相手のダメージ1点につきBP＋1000され」
  it("RS-310: 自分と相手のダメージ合計1点につき BP+1000（自2・敵1 → 5000。ラッシュエリアでも同じ）（出典: atwiki/page-480）", () => {
    expect(bpOf(beetle(0, 0), "player1", "RS-310:b")).toBe(2000);
    expect(bpOf(beetle(2, 1), "player1", "RS-310:b")).toBe(5000);
    expect(bpOf(beetle(2, 1, "rush"), "player1", "RS-310:b")).toBe(5000);
  });

  // 「BP8000以上のとき「SP1」になる」
  // 既知の不具合: CARD-RS-310 BP8000 以上でも「SP1」にならず（SP！のまま）ストライクできない
  it.fails("RS-310: BP8000 以上（ダメージ合計6点）のとき「SP1」になりストライクできる（出典: atwiki/page-480「BP8000以上のとき「SP1」になる」）", () => {
    const s = beetle(3, 3);
    expect(bpOf(s, "player1", "RS-310:b")).toBe(8000);
    expect(spOf(s, "player1", "RS-310:b")).toBe(1);
    expect(canStrike(s, "RS-310:b")).toBe(true);
  });

  it("RS-310: BP8000 未満（ダメージ合計5点で BP7000）のときは「SP！」のままストライクできない（出典: atwiki/page-480・R-STK-02）", () => {
    const s = beetle(3, 2);
    expect(bpOf(s, "player1", "RS-310:b")).toBe(7000);
    expect(canStrike(s, "RS-310:b")).toBe(false);
  });

  // 「これは、自分か相手がターンを終えるときBP8000以上なら撃破される」
  it("RS-310: 自分がターンを終えるとき BP8000 以上なら撃破される（出典: atwiki/page-480）", () => {
    const s = endTurn(beetle(3, 3));
    expect(zoneOf(s, "player1", "RS-310:b")).toBe("discard");
  });

  it("RS-310: 自分がターンを終えるとき BP8000 未満なら撃破されない（出典: atwiki/page-480）", () => {
    const s = endTurn(beetle(3, 2));
    expect(zoneOf(s, "player1", "RS-310:b")).not.toBe("discard");
  });

  it("RS-310: 相手がターンを終えるときも BP8000 以上なら撃破される（出典: atwiki/page-480「自分か相手がターンを終えるとき」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-310", "b")], damage: 3, power: damageCards(3), deck: deckCards(3) },
      player2: { damage: 3, power: damageCards(3, "ed"), deck: deckCards(3, "e") },
    });
    s = endTurn(s);
    expect(s.activePlayer).toBe("player1");
    expect(zoneOf(s, "player1", "RS-310:b")).toBe("discard");
  });

  // faq-card-5 RS-310 Q1「いいえ、それはできません。その場合でも「RS-310 ゴウライビートル」は撃破されます。」
  it("RS-310: 公式Q&A — ダメージ合計2点でガオ・ソウル（BP+4000）を使い BP8000 になったら、ターンを終えるとき撃破される（出典: grnrngr/faq-card-5 RS-310 Q1・R-END-01）", () => {
    let s = st({
      phase: "rush",
      player1: { rush: [inst("RS-310", "b")], hand: [inst("RS-025", "gs")], damage: 1, power: [...damageCards(1), ...powerCards(3)], command: [released("TST-OP", "c")], deck: deckCards(3) },
      player2: { damage: 1, power: damageCards(1, "ed"), deck: deckCards(3, "e") },
    });
    s = useCard(s, "player1", "RS-025:gs", { targetInstanceId: "RS-310:b" });
    expect(bpOf(s, "player1", "RS-310:b")).toBe(8000);
    s = endTurn(s);
    expect(zoneOf(s, "player1", "RS-310:b")).toBe("discard");
  });

  // faq-card-5 RS-310 Q2「はい、できます。」（エグゾスの判定を先に行えば、車両のゴウライビートルが残っているのでエグゾスはとどまる）
  it("RS-310: 公式Q&A — エグゾスの※の判定を先に行うことを選べば、エグゾスは場にとどまり、その後ゴウライビートルが撃破される（出典: grnrngr/faq-card-5 RS-310 Q2・R-SIM-01）", () => {
    let s = st({
      player1: { battle: [inst("RS-216", "ex"), inst("RS-310", "b")], damage: 3, power: damageCards(3), deck: deckCards(3) },
      player2: { damage: 3, power: damageCards(3, "ed"), deck: deckCards(3, "e") },
    });
    s = nextPhase(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-216:ex", "RS-310:b"]);
    s = pick(s, "RS-216:ex");
    s = endTurn(s);
    expect(zoneOf(s, "player1", "RS-310:b")).toBe("discard");
    expect(["battle", "rush"]).toContain(zoneOf(s, "player1", "RS-216:ex"));
  });
});

// ===========================================================================
describe("RS-311 ゴウライスタッグ", () => {
  const TEXT = "【カラクリ忍法・牙がくれ】これは、コマンドゾーンにあるリリース状態のカードと同じカテゴリを持つ敵軍ユニットにアタックされない。";

  it("RS-311: カタログ本文・スペックが出典と一致（出典: atwiki/page-481）", () => {
    expectCatalogText("RS-311", TEXT);
    expectStats("RS-311", {
      name: "ゴウライスタッグ",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-311: 自軍 S ユニットを1体捨札にしてラッシュできる（出典: atwiki/page-481「追加条件：自軍Sユニットを1体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-311", "h")], rush: [inst("TST-UNIT-0", "f")], power: powerCards(4), command: [released("TST-OP-MA", "c")] } });
    const r = rushFromHand(s, "player1", "RS-311:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:f")).toBe("discard");
  });

  /** 敵軍（player2）のバトルフェイズ。player1 のバトルエリアにゴウライスタッグ。 */
  function stagDefends(p1Command: ReturnType<typeof inst>[], p2Command: ReturnType<typeof inst>[] = []) {
    return st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-311", "st"), inst("TST-UNIT-0", "x")], command: p1Command },
        player2: { battle: [inst("SPEC-MA-S", "a"), inst("TST-UNIT-0", "w")], command: p2Command, deck: deckCards(3, "e") },
      },
      SPECS,
    );
  }

  // 「コマンドゾーンにあるリリース状態のカードと同じカテゴリを持つ敵軍ユニットにアタックされない」
  // 既知の不具合: CARD-RS-311 【カラクリ忍法・牙がくれ】が未実装（リリース状態のコマンドと同カテゴリの敵軍ユニットもアタックできる）
  it.fails("RS-311: 自軍コマンドゾーンにリリース状態の MA のカードがあれば、MA の敵軍ユニットにアタックされない（出典: atwiki/page-481）", () => {
    const s = stagDefends([released("TST-OP-MA", "c")]);
    expect(attackTargets(s, "SPEC-MA-S:a", "player2")).toEqual(["TST-UNIT-0:x"]);
  });

  it("RS-311: カテゴリが一致しない（WB の）敵軍ユニットにはアタックされる（出典: atwiki/page-481「同じカテゴリを持つ」）", () => {
    const s = stagDefends([released("TST-OP-MA", "c")]);
    expect(attackTargets(s, "TST-UNIT-0:w", "player2")).toContain("RS-311:st");
  });

  it("RS-311: MA のカードがホールド状態（リリース状態でない）なら MA の敵軍ユニットにもアタックされる（出典: atwiki/page-481「リリース状態のカード」）", () => {
    const s = stagDefends([held("TST-OP-MA", "c")]);
    expect(attackTargets(s, "SPEC-MA-S:a", "player2")).toContain("RS-311:st");
  });

  // faq-card-5 RS-311 Q1「はい、間違いありません。」（自軍と敵軍のコマンドゾーンが対象）
  // 既知の不具合: CARD-RS-311 【カラクリ忍法・牙がくれ】が未実装
  it.fails("RS-311: 公式Q&A — 敵軍コマンドゾーンのリリース状態のカードも参照する（敵軍に MA のリリース状態コマンドがあれば MA の敵軍ユニットにアタックされない）（出典: grnrngr/faq-card-5 RS-311 Q1）", () => {
    const s = stagDefends([], [released("TST-OP-MA", "ec")]);
    expect(attackTargets(s, "SPEC-MA-S:a", "player2")).toEqual(["TST-UNIT-0:x"]);
  });
});

// ===========================================================================
describe("RS-312 カブトライジャー", () => {
  const TEXT =
    "【迅雷流剣技・雷撃斬】これがユニットを撃破したとき、これが撃破したユニットと同じ特徴を1つ以上持つユニットが敵軍ラッシュエリアにあれば1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RS-312: カタログ本文・スペックが出典と一致（出典: atwiki/page-482）", () => {
    expectCatalogText("RS-312", TEXT);
    expectStats("RS-312", {
      name: "カブトライジャー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 3,
      features: ["男", "忍者"],
    });
  });

  /** カブトライジャーを pos 番目に出す。 */
  function kabuto(pos: number, enemy: Partial<GameState["players"]["player2"]>) {
    const s = st(
      {
        player1: { battle: fillers(pos - 1), rush: [inst("RS-312", "k")] },
        player2: { deck: deckCards(3, "e"), ...enemy },
      },
      SPECS,
    );
    return enter(s, "RS-312:k");
  }

  // NC の効果は「撃破したとき」に発動する。出ただけでは何も起きない。
  // 既知の不具合: CARD-RS-312 【雷撃斬】が「撃破したとき」を落としてバトルエリアに出た時点で発動する
  it.fails("RS-312: 3番目に出ただけ（まだ撃破していない）では発動しない（出典: atwiki/page-482「これがユニットを撃破したとき」）", () => {
    const s = kabuto(3, { battle: [inst("SPEC-NINJA", "eb")], rush: [inst("SPEC-NINJA", "er")] });
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-NINJA:er")).toBe("rush");
  });

  // 「これが撃破したユニットと同じ特徴を1つ以上持つユニットが敵軍ラッシュエリアにあれば1体選び、持ち主のパワーゾーンにダメージにして置く」
  // 既知の不具合: CARD-RS-312 【雷撃斬】が撃破時に発動せず、特徴の一致も見ず、ダメージ（ウラ向き）にもしない
  it.fails("RS-312: 3番目に出てバトルで撃破したとき、撃破したユニットと同じ特徴を持つ敵軍ラッシュエリアのユニットを1体選び、ダメージにする（出典: atwiki/page-482）", () => {
    let s = kabuto(3, { battle: [inst("SPEC-NINJA", "eb")], rush: [inst("SPEC-NINJA", "er"), inst("SPEC-BEAST", "ex")] });
    s = settle(attack(s, "RS-312:k", "SPEC-NINJA:eb"));
    expect(zoneOf(s, "player2", "SPEC-NINJA:eb")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-NINJA:er"]);
    s = pick(s, "SPEC-NINJA:er");
    const placed = s.players.player2.power.find((c) => c.instanceId === "SPEC-NINJA:er");
    expect(placed?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
    expect(zoneOf(s, "player2", "SPEC-BEAST:ex")).toBe("rush");
  });

  // 「1体選び…置く」（「してもよい」ではない＝強制）
  // 既知の不具合: CARD-RS-312 【雷撃斬】が撃破時に発動しない
  it.fails("RS-312: 対象がいれば置くのは強制（スキップできない）（出典: atwiki/page-482「1体選び、…置く」）", () => {
    let s = kabuto(3, { battle: [inst("SPEC-NINJA", "eb")], rush: [inst("SPEC-NINJA", "er")] });
    s = settle(attack(s, "RS-312:k", "SPEC-NINJA:eb"));
    expect(choiceIds(s)).toEqual(["SPEC-NINJA:er"]);
    expect(canSkip(s)).toBe(false);
  });

  // 既知の不具合: CARD-RS-312 【雷撃斬】が出た時点で特徴の一致を見ずに敵軍ラッシュエリアのユニットを強制で選ばせる
  it.fails("RS-312: 撃破したユニットと同じ特徴を持つユニットが敵軍ラッシュエリアになければ何も起きない（出典: atwiki/page-482「…ユニットが敵軍ラッシュエリアにあれば」）", () => {
    let s = kabuto(3, { battle: [inst("SPEC-NINJA", "eb")], rush: [inst("SPEC-BEAST", "ex")] });
    s = settle(attack(s, "RS-312:k", "SPEC-NINJA:eb"));
    expect(zoneOf(s, "player2", "SPEC-BEAST:ex")).toBe("rush");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-312: 3番目以外で出たとき（NC 不成立）は撃破しても発動しない（出典: atwiki/page-482「CN：3」・R-CN-02）", () => {
    let s = kabuto(2, { battle: [inst("SPEC-NINJA", "eb")], rush: [inst("SPEC-NINJA", "er")] });
    s = settle(attack(s, "RS-312:k", "SPEC-NINJA:eb"));
    expect(zoneOf(s, "player2", "SPEC-NINJA:eb")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-NINJA:er")).toBe("rush");
    expect(s.players.player2.damage).toBe(0);
  });

  // faq-card-5 RS-312 Q1「いいえ、その場合は「RS-060 マジピンク」を選ぶことはできません。…「撃破したとき」が捨札になる前に割り込みますので、先に…対象を選択してください。」
  // 既知の不具合: CARD-RS-312 【雷撃斬】が撃破時に発動しない
  it.fails("RS-312: 公式Q&A — 撃破したレジェンドマジピンクの※で後から出たマジピンクは選べない（撃破したときの対象選択が先）（出典: grnrngr/faq-card-5 RS-312 Q1・ユーザー決定の撃破時処理順）", () => {
    let s = kabuto(3, {
      battle: [inst("RS-336", "lmp")],
      rush: [inst("SPEC-FEMALE", "fem"), inst("TST-UNIT-0", "plain")],
      discard: [inst("RS-060", "mp")],
    });
    s = settle(attack(s, "RS-312:k", "RS-336:lmp"));
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-FEMALE:fem"]);
    expect(choiceIds(s)).not.toContain("RS-060:mp");
  });

  // faq-card-5 RS-312 Q2「はい、使用することができます。また、その場合はダメージは無かったことになります。」
  // 既知の不具合: CARD-RS-312 【雷撃斬】が撃破時に発動しない
  it.fails("RS-312: 公式Q&A — ダメージとして置かれるために場を離れる自軍ユニットにダイノガッツを使えば、その場に留まりダメージは無かったことになる（出典: grnrngr/faq-card-5 RS-312 Q2）", () => {
    let s = kabuto(3, {
      battle: [inst("SPEC-NINJA", "eb")],
      rush: [inst("SPEC-NINJA", "er")],
      hand: [inst("RS-027", "guts")],
      command: [released("TST-OP", "ec")],
    });
    s = settle(attack(s, "RS-312:k", "SPEC-NINJA:eb"));
    s = pick(s, "SPEC-NINJA:er");
    expect(s.pendingLeave?.instanceId).toBe("SPEC-NINJA:er");
    s = useCard(s, "player2", "RS-027:guts");
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-NINJA:er")).toBe("rush");
    expect(s.players.player2.damage).toBe(0);
  });
});

// ===========================================================================
describe("RS-313 クワガライジャー", () => {
  const TEXT =
    "【イカヅチブレイカー】敵軍バトルエリアにあるSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、敵軍ラッシュエリアに、戻したユニット以外のユニットがあれば1体選び、戻したユニットとバトルさせる。";

  it("RS-313: カタログ本文・スペックが出典と一致（出典: atwiki/page-483）", () => {
    expectCatalogText("RS-313", TEXT);
    expectStats("RS-313", {
      name: "クワガライジャー",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 2,
      features: ["男", "忍者"],
    });
  });

  function kuwaga(pos: number, enemy: Partial<GameState["players"]["player2"]>, extra: Partial<GameState["players"]["player1"]> = {}) {
    const s = st(
      {
        player1: { battle: fillers(pos - 1), rush: [inst("RS-313", "k")], deck: deckCards(3), ...extra },
        player2: { deck: deckCards(3, "e"), ...enemy },
      },
      SPECS,
    );
    return enter(s, "RS-313:k");
  }

  // 「敵軍バトルエリアにあるSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、…1体選び、戻したユニットとバトルさせる」
  // 既知の不具合: CARD-RS-313 【イカヅチブレイカー】が未実装（空の確認だけが出て何も起きない）
  it.fails("RS-313: 2番目に出ると、敵軍バトルエリアの S ユニットをラッシュエリアに戻し、敵軍ラッシュエリアの別のユニットとバトルさせる（出典: atwiki/page-483）", () => {
    let s = kuwaga(2, { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:eb"]);
    s = pick(s, "TST-UNIT-0:eb");
    if (s.pendingEffectChoice) {
      expect(choiceIds(s)).toEqual(["TST-UNIT-2:er"]);
      s = pick(s, "TST-UNIT-2:er");
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:er")).toBe("rush");
  });

  // 「戻してもよい」
  // 既知の不具合: CARD-RS-313 【イカヅチブレイカー】の選択に敵軍ユニットが出ない
  it.fails("RS-313: 戻さないことを選べる（任意）（出典: atwiki/page-483「戻してもよい」）", () => {
    let s = kuwaga(2, { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")] });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:eb"]);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
  });

  // 「Sユニットを1体選び」— M ユニットは選べない
  // 既知の不具合: CARD-RS-313 【イカヅチブレイカー】が未実装
  it.fails("RS-313: 敵軍バトルエリアの M ユニットは選べない（S のみ）（出典: atwiki/page-483「Sユニットを1体選び」）", () => {
    const s = kuwaga(2, { battle: [inst("SPEC-EM", "m"), inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")] });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:eb"]);
  });

  // 「戻したユニット以外のユニットがあれば」
  // 既知の不具合: CARD-RS-313 【イカヅチブレイカー】が未実装
  it.fails("RS-313: 敵軍ラッシュエリアに戻したユニット以外のユニットがなければ、戻すだけでバトルは起きない（出典: atwiki/page-483「…以外のユニットがあれば」）", () => {
    let s = kuwaga(2, { battle: [inst("TST-UNIT-0", "eb")], rush: [] });
    s = pick(s, "TST-UNIT-0:eb");
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("rush");
    expect(s.pendingEffectChoice).toBeFalsy();
  });

  it("RS-313: 2番目以外で出たとき（NC 不成立）は発動しない（出典: atwiki/page-483「CN：2」・R-CN-02）", () => {
    const s = kuwaga(3, { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")] });
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
  });

  // faq-card-5 RS-256 Q「はい、その通りです。」（クワガライジャー等で敵軍ユニット同士をバトルさせて撃破すると「自軍バトルフェイズに敵軍ユニットを1体撃破するたび」を満たす）
  // 既知の不具合: CARD-RS-313 【イカヅチブレイカー】が未実装
  it.fails("RS-313: 公式Q&A — 敵軍ユニット同士をバトルさせて撃破すると、闇の戒律の重ねたカードを手札に加えられる（出典: grnrngr/faq-card-5 RS-256）", () => {
    let s = kuwaga(2, { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")] }, { operation: [inst("RS-256", "law")] });
    const law = s.players.player1.operation[0]!;
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, operation: [{ ...law, stackedCards: [inst("TST-OP", "stacked")] } as typeof law] } } };
    s = pick(s, "TST-UNIT-0:eb");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-2:er")) s = pick(s, "TST-UNIT-2:er");
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:stacked")).toBe("hand");
  });
});

void legalOfType;
