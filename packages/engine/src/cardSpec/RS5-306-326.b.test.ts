/**
 * カード別スペック: RS-314〜RS-319（第5弾「五龍の逆鱗」マゲラッパ〜デカマスター）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）ほか card_6 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import { allCardsCatalog, validateDeckEntries } from "@rangers-strike/cards";
import { unitEffectiveCategories } from "../core/catalog";
import {
  act,
  attack,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  enterHold,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  pick,
  powerCards,
  released,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  tryAct,
  zoneOf,
} from "./RS5-306-326.helpers";
import type { GameState } from "../types/game";

const DINO = sUnit("SPEC-DINO", { bp: 1000, features: ["恐竜"], category: "DA" });
const DA_S = sUnit("SPEC-DA", { bp: 1000, category: "DA" });
const HUMANOID = sUnit("SPEC-HUMANOID", { size: "L", bp: 1000, sp: undefined, features: ["人型"] });
const NON_HUMANOID = sUnit("SPEC-SP1", { bp: 1000, sp: 1, features: ["メカ"] });
const POLICE_S = sUnit("SPEC-POLICE", { category: "OT", bp: 2000, features: ["警察"] });
const POLICE_MINUS = sUnit("SPEC-POLICE-MINUS", {
  category: "OT",
  bp: 3000,
  powerCost: "7-",
  features: ["警察"],
  rushAdditionalCondition: { conditionId: "zord_down_discard_named", text: "自軍「X」1体を捨札にすれば必要パワー0になる", partnerName: "X", unitCount: 1 },
} as Partial<ReturnType<typeof sUnit>>);
const POLICE_M = sUnit("SPEC-POLICE-M", { size: "M", category: "OT", bp: 4000, features: ["警察"] });
const MALE_WB = sUnit("SPEC-MALE-WB", { category: "WB", bp: 1000, features: ["男"] });
const BP1500 = sUnit("SPEC-1500", { bp: 1500 });
const BP2500_M = sUnit("SPEC-2500-M", { size: "M", bp: 2500 });
const SPECS = [DINO, DA_S, HUMANOID, NON_HUMANOID, POLICE_S, POLICE_MINUS, POLICE_M, MALE_WB, BP1500, BP2500_M];

/** 「好きな枚数入れてもよい」の確認用に、同名3枚制限に触れない埋め草（各1枚）。 */
function filler20() {
  return allCardsCatalog.cards
    .filter((c) => c.type === "operation" && c.id.startsWith("RS-0"))
    .slice(0, 20)
    .map((c) => ({ cardId: c.id, count: 1 }));
}

// ===========================================================================
describe("RS-314 マゲラッパ", () => {
  it("RS-314: カタログ本文・スペックが出典と一致（出典: atwiki/page-429）", () => {
    expectCatalogText("RS-314", "※このカードはデッキに好きな枚数入れてもよい。");
    expectStats("RS-314", {
      name: "マゲラッパ",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 1,
      features: ["忍者", "戦闘員"],
    });
  });

  // 「※このカードはデッキに好きな枚数入れてもよい。」
  it("RS-314: デッキに4枚以上（10枚）入れてもデッキ構築エラーにならない（通常のカードは4枚でエラー）（出典: atwiki/page-429・R-DECK-03）", () => {
    const ok = validateDeckEntries([{ cardId: "RS-314", count: 10 }, ...filler20()], allCardsCatalog, { minSize: 1 });
    expect(ok.errors.filter((e) => e.includes("マゲラッパ"))).toEqual([]);
    const ng = validateDeckEntries([{ cardId: "RS-322", count: 4 }], allCardsCatalog, { minSize: 1 });
    expect(ng.errors.some((e) => e.includes("ベン"))).toBe(true);
  });

  // 「必要パワー：1」「追加条件：なし」
  it("RS-314: パワー1・DA コマンド1つのホールドでラッシュできる（パワー0ではラッシュできない）（出典: atwiki/page-429「必要パワー：1」）", () => {
    const ok = st({ phase: "rush", player1: { hand: [inst("RS-314", "h")], command: [released("TST-OP-DA", "c")], power: powerCards(1) } });
    expect(canStartRush(ok, "player1", "RS-314:h")).toBe(true);
    const ng = st({ phase: "rush", player1: { hand: [inst("RS-314", "h")], command: [released("TST-OP-DA", "c")], power: [] } });
    expect(canStartRush(ng, "player1", "RS-314:h")).toBe(false);
  });
});

// ===========================================================================
describe("RS-315 バクレンオー", () => {
  const TEXT =
    "合体―爆竜カルノリュータス＋爆竜カスモシールドン※これは敵軍ターン中、特徴「人型」を持つユニットとバトルしたときバトルに勝っても撃破される。※これはバトルエリアにあるとき、カテゴリに「WB」が追加される。";

  it("RS-315: カタログ本文・スペックが出典と一致（出典: atwiki/page-440）", () => {
    expectCatalogText("RS-315", TEXT);
    expectStats("RS-315", {
      name: "バクレンオー",
      category: "DA",
      size: "L",
      bp: 14000,
      sp: 1,
      powerCost: "6+",
      features: ["恐竜", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「合体―爆竜カルノリュータス＋爆竜カスモシールドン」
  it("RS-315: 自軍の爆竜カルノリュータスと爆竜カスモシールドンを捨札にしてラッシュできる（片方だけではできない）（出典: atwiki/page-440・R-ADD-06）", () => {
    const base = { phase: "rush" as const };
    const ok = st({ ...base, player1: { hand: [inst("RS-315", "h")], rush: [inst("RS-316", "c"), inst("RS-317", "k")], power: powerCards(6), command: [released("TST-OP-DA", "c")] } });
    const r = rushFromHand(ok, "player1", "RS-315:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-315:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-316:c")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-317:k")).toBe("discard");
    const ng = st({ ...base, player1: { hand: [inst("RS-315", "h")], rush: [inst("RS-316", "c")], power: powerCards(6), command: [released("TST-OP-DA", "c")] } });
    expect(rushFromHand(ng, "player1", "RS-315:h").ok).toBe(false);
  });

  // 「※これはバトルエリアにあるとき、カテゴリに「WB」が追加される。」
  it("RS-315: バトルエリアにあるときはカテゴリが DA と WB、ラッシュエリアでは DA のみ（出典: atwiki/page-440）", () => {
    const s = st({ player1: { battle: [inst("RS-315", "b")], rush: [inst("RS-315", "r")] } });
    const inBattle = unitEffectiveCategories(s, "player1", s.players.player1.battle[0]!, "battle");
    expect([...inBattle].sort()).toEqual(["DA", "WB"]);
    const inRush = unitEffectiveCategories(s, "player1", s.players.player1.rush[0]!, "rush");
    expect(inRush).toEqual(["DA"]);
  });

  /** 敵軍（player2）ターンのバトル：attacker がバクレンオーにアタックする。 */
  function enemyAttacks(attacker: string) {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-315", "b")] },
        player2: { battle: [inst(attacker, "a")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    return settle(attack(s, `${attacker}:a`, "RS-315:b", "player2"));
  }

  // 「※これは敵軍ターン中、特徴「人型」を持つユニットとバトルしたときバトルに勝っても撃破される。」
  // 既知の不具合: CARD-RS-315 ※の判定が特徴「人型」ではなく相手の「SP1」以上で行われる（SP なしの人型に勝っても撃破されない）
  it.fails("RS-315: 敵軍ターン中、特徴「人型」を持つユニット（SP なし）とバトルして勝っても撃破される（出典: atwiki/page-440）", () => {
    const s = enemyAttacks("SPEC-HUMANOID");
    expect(zoneOf(s, "player2", "SPEC-HUMANOID:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-315:b")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-315 ※の判定が「SP1」以上で行われ、人型でない SP1 のユニットとのバトルでも撃破される
  it.fails("RS-315: 人型を持たないユニット（SP1）とのバトルに勝っても撃破されない（出典: atwiki/page-440「特徴「人型」を持つユニット」）", () => {
    const s = enemyAttacks("SPEC-SP1");
    expect(zoneOf(s, "player2", "SPEC-SP1:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-315:b")).toBe("battle");
  });

  it("RS-315: 自軍ターン中に人型のユニットとバトルして勝っても撃破されない（出典: atwiki/page-440「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-315", "b")] }, player2: { battle: [inst("SPEC-HUMANOID", "h")], deck: deckCards(3, "e") } }, SPECS);
    s = settle(attack(s, "RS-315:b", "SPEC-HUMANOID:h"));
    expect(zoneOf(s, "player2", "SPEC-HUMANOID:h")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-315:b")).toBe("battle");
  });

  // faq-card-6 RS-364 Q「はい、発動します。」（バクレンオーのようにバトルエリアで複数カテゴリを持つユニットも「すべてDA」に数える）
  it("RS-315: 公式Q&A — バトルエリアで WB が追加されても DA のままである（「自軍ユニットがすべてDA」を満たす）（出典: grnrngr/faq-card-6 RS-364）", () => {
    const s = st({ player1: { battle: [inst("RS-315", "b")] } });
    expect(unitEffectiveCategories(s, "player1", s.players.player1.battle[0]!, "battle")).toContain("DA");
  });
});

// ===========================================================================
describe("RS-316 爆竜カルノリュータス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【超ドリル進化】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「恐竜」を持つユニットを2体選び捨札にしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("RS-316: カタログ本文・スペックが出典と一致（出典: atwiki/page-441）", () => {
    expectCatalogText("RS-316", TEXT);
    expectStats("RS-316", {
      name: "爆竜カルノリュータス",
      category: "DA",
      size: "M",
      bp: 5000,
      sp: "special",
      powerCost: 5,
      features: ["恐竜"],
    });
  });

  function carno(rush: ReturnType<typeof inst>[], command = [released("TST-OP", "rc")]) {
    return st(
      {
        player1: { rush: [inst("RS-316", "c"), ...rush], command },
        player2: { battle: [inst("TST-UNIT-0", "eb")], power: powerCards(2, "ep"), deck: deckCards(3, "e") },
      },
      SPECS,
    );
  }

  // 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」
  it("RS-316: リリース状態の自軍コマンドがなければバトルエリアに出られない（出典: atwiki/page-441・R-ADD-07）", () => {
    const s = carno([], [{ ...inst("TST-OP", "hc"), commandHeld: true }]);
    expect(canEnter(s, "RS-316:c")).toBe(false);
    expect(tryAct(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-316:c" }).ok).toBe(false);
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-316:c" }).ok).toBe(false);
  });

  it("RS-316: 自軍コマンドを1つホールドしてバトルエリアに出る（出典: atwiki/page-441）", () => {
    const s = enterHold(carno([]), "RS-316:c");
    expect(zoneOf(s, "player1", "RS-316:c")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // faq-card-5 RS-316 Q1「いいえ、カテゴリの指定はありませんので、ホールドするコマンドはどのカテゴリのコマンドでも構いません。」
  it("RS-316: 公式Q&A — ホールドするコマンドは DA でなくてもよい（WB のコマンドをホールドして出られる）（出典: grnrngr/faq-card-5 RS-316 Q1・R-CMD-03）", () => {
    const s = enterHold(carno([], [released("TST-OP", "wb")]), "RS-316:c");
    expect(zoneOf(s, "player1", "RS-316:c")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("RS-316: リリース状態のコマンドがあれば、ホールドしてバトルエリアに出る行動が合法手として示される（出典: atwiki/page-441・grnrngr/faq-card-5 RS-316 Q1）", () => {
    expect(canEnter(carno([], [released("TST-OP", "wb")]), "RS-316:c")).toBe(true);
  });

  // 「自軍ラッシュエリアから特徴「恐竜」を持つユニットを2体選び捨札にしてもよい。そうしたとき、このターン、これは「SP1」になる。」
  it("RS-316: 出たとき自軍ラッシュエリアの恐竜2体を捨札にすると「SP1」になりストライクできる（出典: atwiki/page-441）", () => {
    let s = enterHold(carno([inst("SPEC-DINO", "d1"), inst("SPEC-DINO", "d2"), inst("TST-UNIT-0", "x")]), "RS-316:c");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-DINO:d1", "SPEC-DINO:d2"]);
    s = pick(s, "SPEC-DINO:d1");
    if (s.pendingEffectChoice) s = pick(s, "SPEC-DINO:d2");
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DINO:d2")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:x")).toBe("rush");
    expect(spOf(s, "player1", "RS-316:c")).toBe(1);
    expect(canStrike(s, "RS-316:c")).toBe(true);
  });

  // 「捨札にしてもよい」
  it("RS-316: 捨札にしないことを選べ、その場合は「SP！」のままストライクできない（出典: atwiki/page-441「捨札にしてもよい」・R-STK-02）", () => {
    let s = enterHold(carno([inst("SPEC-DINO", "d1"), inst("SPEC-DINO", "d2")]), "RS-316:c");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("rush");
    expect(canStrike(s, "RS-316:c")).toBe(false);
  });

  it("RS-316: 自軍ラッシュエリアの恐竜が1体しかなければ発動できず「SP！」のまま（出典: atwiki/page-441「2体選び」）", () => {
    const s = enterHold(carno([inst("SPEC-DINO", "d1"), inst("TST-UNIT-0", "x")]), "RS-316:c");
    expect(s.pendingEffectChoice?.effectId === "super_drill" && choiceIds(s).length >= 2).toBe(false);
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("rush");
    expect(canStrike(s, "RS-316:c")).toBe(false);
  });

  // 敵軍ターン中にバトルエリアに出る状況は、効果で出したときと同じ進入処理を行うテスト用の enterBattleByEffect で作る。
  it("RS-316: 敵軍ターン中にバトルエリアに出たときは【超ドリル進化】を発動できない（出典: atwiki/page-441「自軍ターン中」）", () => {
    const board = (activePlayer: "player1" | "player2") =>
      st(
        {
          activePlayer,
          player1: { rush: [inst("RS-316", "c"), inst("SPEC-DINO", "d1"), inst("SPEC-DINO", "d2")], command: [released("TST-OP", "rc")], deck: deckCards(3) },
          player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e") },
        },
        SPECS,
      );
    // 対照: 自軍ターン中に同じ手順で出せば恐竜2体を選べる
    expect(choiceIds(enterBattleByEffect(board("player1"), "player1", "RS-316:c"))).toEqual(["SPEC-DINO:d1", "SPEC-DINO:d2"]);
    const s = settle(enterBattleByEffect(board("player2"), "player1", "RS-316:c"));
    expect(zoneOf(s, "player1", "RS-316:c")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-316");
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-DINO:d2")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-317 爆竜カスモシールドン", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【超シールド進化】これが自軍ラッシュエリアにある間、DAの自軍ユニットが撃破されたとき、自軍ラッシュエリアから特徴「恐竜」を持つユニットを2体選び、かわりに捨札にしてもよい。";

  it("RS-317: カタログ本文・スペックが出典と一致（出典: atwiki/page-442）", () => {
    expectCatalogText("RS-317", TEXT);
    expectStats("RS-317", {
      name: "爆竜カスモシールドン",
      category: "DA",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 4,
      features: ["恐竜"],
    });
  });

  it("RS-317: リリース状態の自軍コマンドがなければバトルエリアに出られず、1つホールドすれば出られる（出典: atwiki/page-442・R-ADD-07）", () => {
    const ng = st({ player1: { rush: [inst("RS-317", "k")], command: [{ ...inst("TST-OP", "hc"), commandHeld: true }] } });
    expect(canEnter(ng, "RS-317:k")).toBe(false);
    expect(tryAct(ng, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-317:k" }).ok).toBe(false);
    expect(tryAct(ng, { type: "move_to_battle", playerId: "player1", instanceId: "RS-317:k" }).ok).toBe(false);
    const ok = st({ player1: { rush: [inst("RS-317", "k")], command: [released("TST-OP", "rc")] } });
    expect(zoneOf(enterHold(ok, "RS-317:k"), "player1", "RS-317:k")).toBe("battle");
  });

  /** 敵軍（player2）ターン：BP3000 の敵軍ユニットが自軍の victim にアタックした直後。 */
  function shieldCase(victim: string, rush: ReturnType<typeof inst>[]) {
    const s = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RS-317", "k"), ...rush], battle: [inst(victim, "v")] },
        player2: { battle: [inst("TST-UNIT-2", "eb")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    return attack(s, "TST-UNIT-2:eb", `${victim}:v`, "player2");
  }

  /** 超シールド進化の選択（恐竜2体）を d1, d2 で行う。 */
  function useShield(s: GameState, picks: string[]): GameState {
    let n = s;
    const a = legal(n).find((x) => x.type === "use_super_shield" && x.playerId === "player1");
    if (a) n = act(n, a);
    for (const id of picks) {
      if (n.pendingEffectChoice?.validInstanceIds.includes(id)) n = pick(n, id);
    }
    return n;
  }

  // 「DAの自軍ユニットが撃破されたとき、自軍ラッシュエリアから特徴「恐竜」を持つユニットを2体選び、かわりに捨札にしてもよい」
  // 既知の不具合: CARD-RS-317 【超シールド進化】が未実装（DA の自軍ユニットが撃破されても選択が出ない）
  it.fails("RS-317: DA の自軍ユニットが撃破されるとき、自軍ラッシュエリアの恐竜2体をかわりに捨札にでき、そのユニットは場に残る（出典: atwiki/page-442）", () => {
    let s = shieldCase("SPEC-DA", [inst("SPEC-DINO", "d1"), inst("SPEC-DINO", "d2")]);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-317:k", "SPEC-DINO:d1", "SPEC-DINO:d2"]);
    s = useShield(s, ["SPEC-DINO:d1", "SPEC-DINO:d2"]);
    s = settle(s);
    expect(zoneOf(s, "player1", "SPEC-DA:v")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DINO:d2")).toBe("discard");
  });

  // 「してもよい」
  // 既知の不具合: CARD-RS-317 【超シールド進化】が未実装
  it.fails("RS-317: かわりに捨札にしないことを選べ、その場合は撃破される（出典: atwiki/page-442「かわりに捨札にしてもよい」）", () => {
    let s = shieldCase("SPEC-DA", [inst("SPEC-DINO", "d1"), inst("SPEC-DINO", "d2")]);
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(zoneOf(s, "player1", "SPEC-DA:v")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("rush");
  });

  it("RS-317: 撃破されるのが DA でない（WB の）自軍ユニットなら使えない（出典: atwiki/page-442「DAの自軍ユニット」）", () => {
    const s = settle(shieldCase("TST-UNIT-0", [inst("SPEC-DINO", "d1"), inst("SPEC-DINO", "d2")]));
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-DINO:d2")).toBe("rush");
  });

  it("RS-317: 自軍ラッシュエリアの恐竜が（自身を含めて）2体に満たなければ使えない（出典: atwiki/page-442「2体選び」）", () => {
    const s = settle(shieldCase("SPEC-DA", []));
    expect(zoneOf(s, "player1", "SPEC-DA:v")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-317:k")).toBe("rush");
  });

  // faq-card-5 RS-317 Q1「はい、できます。」
  // 既知の不具合: CARD-RS-317 【超シールド進化】が未実装
  it.fails("RS-317: 公式Q&A — 選ぶ恐竜2体のうち1体をカスモシールドン自身にできる（出典: grnrngr/faq-card-5 RS-317 Q1）", () => {
    let s = shieldCase("SPEC-DA", [inst("SPEC-DINO", "d1")]);
    expect(choiceIds(s)).toEqual(["RS-317:k", "SPEC-DINO:d1"]);
    s = settle(useShield(s, ["RS-317:k", "SPEC-DINO:d1"]));
    expect(zoneOf(s, "player1", "SPEC-DA:v")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-317:k")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DINO:d1")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-318 ドギー・クルーガー", () => {
  const TEXT =
    "【出動指令】これが自軍ラッシュエリアにある間、敵軍ユニットがラッシュされたとき、そのユニットのカテゴリが「DA」なら、自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが追加条件を持たない特徴「警察」を持つSユニットのカードならラッシュエリアに出し、それ以外なら手札に加える。";

  it("RS-318: カタログ本文・スペックが出典と一致（出典: atwiki/page-21）", () => {
    expectCatalogText("RS-318", TEXT);
    expectStats("RS-318", {
      name: "ドギー・クルーガー",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      features: ["男", "警察"],
    });
  });

  /** 敵軍（player2）のラッシュフェイズに、player2 が手札の rushed をラッシュする。 */
  function enemyRushes(rushed: string, topCard: ReturnType<typeof inst>, opts: { doggies?: ReturnType<typeof inst>[]; doggieZone?: "rush" | "battle"; p2?: Partial<GameState["players"]["player2"]> } = {}) {
    const s = st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: {
          [opts.doggieZone ?? "rush"]: opts.doggies ?? [inst("RS-318", "dg")],
          deck: [topCard, ...deckCards(3)],
          command: [released("TST-OP-OT", "oc")],
        },
        player2: { hand: [inst(rushed, "x")], command: [released("TST-OP-DA", "c"), released("TST-OP", "cw")], deck: deckCards(3, "e"), ...opts.p2 },
      },
      SPECS,
    );
    const r = rushFromHand(s, "player2", `${rushed}:x`);
    expect(r.ok).toBe(true);
    return r.state;
  }
  const reveal = (s: GameState) => pick(s, "reveal");

  // 「オモテにしたカードが追加条件を持たない特徴「警察」を持つSユニットのカードならラッシュエリアに出し」
  it("RS-318: 敵軍が DA のユニットをラッシュしたとき山札の上をオモテにし、追加条件を持たない警察の S ユニットならラッシュエリアに出す（出典: atwiki/page-21）", () => {
    let s = enemyRushes("SPEC-DA", inst("SPEC-POLICE", "top"));
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = reveal(s);
    expect(zoneOf(s, "player1", "SPEC-POLICE:top")).toBe("rush");
  });

  // 「それ以外なら手札に加える」
  it("RS-318: オモテにしたカードが警察の S ユニットでなければ（警察の M ユニット・オペレーション）手札に加える（出典: atwiki/page-21「それ以外なら手札に加える」）", () => {
    let s = reveal(enemyRushes("SPEC-DA", inst("SPEC-POLICE-M", "top")));
    expect(zoneOf(s, "player1", "SPEC-POLICE-M:top")).toBe("hand");
    s = reveal(enemyRushes("SPEC-DA", inst("TST-OP", "top")));
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
  });

  // 「オモテにしてもよい」
  it("RS-318: オモテにしないことを選べ、その場合は山札は動かない（出典: atwiki/page-21「オモテにしてもよい」）", () => {
    let s = enemyRushes("SPEC-DA", inst("SPEC-POLICE", "top"));
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "SPEC-POLICE:top")).toBe("deck");
  });

  it("RS-318: ラッシュされた敵軍ユニットが DA でなければ発動しない（出典: atwiki/page-21「そのユニットのカテゴリが「DA」なら」）", () => {
    const s = enemyRushes("TST-UNIT-0", inst("SPEC-POLICE", "top"));
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player1", "SPEC-POLICE:top")).toBe("deck");
  });

  it("RS-318: ドギー・クルーガーがバトルエリアにあるとき（ラッシュエリアにない）は発動しない（出典: atwiki/page-21「これが自軍ラッシュエリアにある間」）", () => {
    const s = enemyRushes("SPEC-DA", inst("SPEC-POLICE", "top"), { doggieZone: "battle" });
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player1", "SPEC-POLICE:top")).toBe("deck");
  });

  // faq-card-5 RS-318 Q1「いいえ、その場合はコマンドをホールドする必要はありません。」
  it("RS-318: 公式Q&A — 効果でラッシュエリアに出すときに自軍コマンドをホールドする必要はない（出典: grnrngr/faq-card-5 RS-318 Q1・R-RUSH-20）", () => {
    const s = reveal(enemyRushes("SPEC-DA", inst("SPEC-POLICE", "top")));
    expect(zoneOf(s, "player1", "SPEC-POLICE:top")).toBe("rush");
    expect(s.pendingCommandPayment).toBeFalsy();
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });

  // faq-card-5 RS-318 Q2「はい、重複します。」
  it("RS-318: 公式Q&A — ドギー・クルーガーが2体あれば効果は重複する（山札の上を2回オモテにできる）（出典: grnrngr/faq-card-5 RS-318 Q2・R-CONT-01）", () => {
    let s = st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: { rush: [inst("RS-318", "dg1"), inst("RS-318", "dg2")], deck: [inst("SPEC-POLICE", "t1"), inst("TST-OP", "t2"), ...deckCards(3)] },
        player2: { hand: [inst("SPEC-DA", "x")], command: [released("TST-OP-DA", "c")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    s = rushFromHand(s, "player2", "SPEC-DA:x").state;
    s = reveal(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = reveal(s);
    expect(zoneOf(s, "player1", "SPEC-POLICE:t1")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP:t2")).toBe("hand");
  });

  // faq-card-5 RS-318 Q3「いいえ、含まれません。カードの「追加条件」の欄に記述があるものは「追加条件を持つ」と考えて下さい。」
  it("RS-318: 公式Q&A — 必要パワーに「－」のある（追加条件欄に記述がある）警察 S ユニットは「追加条件を持たない」に含まれず、手札に加える（出典: grnrngr/faq-card-5 RS-318 Q3・R-ADD-02）", () => {
    const s = reveal(enemyRushes("SPEC-DA", inst("SPEC-POLICE-MINUS", "top")));
    expect(zoneOf(s, "player1", "SPEC-POLICE-MINUS:top")).toBe("hand");
  });

  // faq-card-5 RS-318 Q4「はい、発動します。」（闇のヤイバで DA が追加された男のユニットのラッシュ）
  it("RS-318: 公式Q&A — 闇のヤイバで DA が追加された（本来 WB の）特徴「男」のユニットがラッシュされたときも発動する（出典: grnrngr/faq-card-5 RS-318 Q4）", () => {
    const s = enemyRushes("SPEC-MALE-WB", inst("SPEC-POLICE", "top"), { p2: { rush: [inst("RS-339", "yaiba")] } });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(zoneOf(reveal(s), "player1", "SPEC-POLICE:top")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-319 デカマスター", () => {
  const TEXT =
    "※自軍ラッシュフェイズ中、敵軍ダメージが自軍ダメージ以上なら、このユニットを持ち主の手札に戻す。【ディーソードベガ】自軍ターン中、これがバトルエリアに出たとき、BPの下三桁が500の敵軍Sユニットをすべて撃破する。";

  it("RS-319: カタログ本文・スペックが出典と一致（出典: atwiki/page-47）", () => {
    expectCatalogText("RS-319", TEXT);
    expectStats("RS-319", {
      name: "デカマスター",
      category: "OT",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: "5+",
      features: ["男", "警察"],
      rushCondition: "discard_named_unit",
    });
  });

  // 「追加条件：自軍「ドギー・クルーガー」1体を捨札にする」
  it("RS-319: 自軍のドギー・クルーガーを捨札にしてラッシュできる（いなければできない）（出典: atwiki/page-47）", () => {
    const ok = st({ phase: "rush", player1: { hand: [inst("RS-319", "h")], rush: [inst("RS-318", "dg")], power: powerCards(5), command: [released("TST-OP-OT", "c")] }, player2: { damage: 2, power: damageCards(2, "ed") } });
    const r = rushFromHand(ok, "player1", "RS-319:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-318:dg")).toBe("discard");
    const ng = st({ phase: "rush", player1: { hand: [inst("RS-319", "h")], rush: [inst("TST-UNIT-0", "f")], power: powerCards(5), command: [released("TST-OP-OT", "c")] } });
    expect(rushFromHand(ng, "player1", "RS-319:h").ok).toBe(false);
  });

  /** 自軍スタートフェイズから自軍ラッシュフェイズへ進めた状態。 */
  function masterRushPhase(own: number, enemy: number, extra: Partial<GameState["players"]["player1"]> = {}) {
    const s = st({
      phase: "start",
      player1: { rush: [inst("RS-319", "dm")], damage: own, power: damageCards(own), deck: deckCards(5), ...extra },
      player2: { damage: enemy, power: damageCards(enemy, "ed"), deck: deckCards(5, "e") },
    });
    return toPhase(s, "player1", "rush");
  }

  // 「※自軍ラッシュフェイズ中、敵軍ダメージが自軍ダメージ以上なら、このユニットを持ち主の手札に戻す。」
  // 既知の不具合: CARD-RS-319 ※（自軍ラッシュフェイズ中に手札に戻る）が未実装
  it.fails("RS-319: 自軍ラッシュフェイズ中、敵軍ダメージが自軍ダメージより多ければ手札に戻る（出典: atwiki/page-47）", () => {
    const s = masterRushPhase(1, 3);
    expect(zoneOf(s, "player1", "RS-319:dm")).toBe("hand");
  });

  it("RS-319: 敵軍ダメージが自軍ダメージ未満なら手札に戻らない（出典: atwiki/page-47「以上なら」）", () => {
    const s = masterRushPhase(3, 1);
    expect(zoneOf(s, "player1", "RS-319:dm")).toBe("rush");
  });

  it("RS-319: 自軍ラッシュフェイズ以外（自軍バトルフェイズ）では戻らない（出典: atwiki/page-47「自軍ラッシュフェイズ中」）", () => {
    const s = st({ phase: "battle", player1: { rush: [inst("RS-319", "dm")] }, player2: { damage: 2, power: damageCards(2, "ed") } });
    expect(zoneOf(s, "player1", "RS-319:dm")).toBe("rush");
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "RS-319:dm")).toBe(true);
  });

  // faq-card-5 RS-319 Q1「いいえ、それはできません。…ラッシュした直後であっても、他の宣言を行うより先に、即座に自分の手札に戻さなければなりません。」
  // 既知の不具合: CARD-RS-319 ※が未実装（自軍ラッシュフェイズ中に残り続け、M ユニットの追加条件に使えてしまう）
  it.fails("RS-319: 公式Q&A — 条件を満たしていれば、手札に戻る前に M ユニットの追加条件（S ユニットを捨札）に使うことはできない（出典: grnrngr/faq-card-5 RS-319 Q1）", () => {
    const s = masterRushPhase(0, 1, { hand: [inst("RS-310", "beetle")], power: powerCards(3), command: [released("TST-OP-MA", "c")] });
    expect(rushFromHand(s, "player1", "RS-310:beetle").ok).toBe(false);
    expect(zoneOf(s, "player1", "RS-319:dm")).toBe("hand");
  });

  // faq-card-5 RS-319 Q2「はい、発動します。「以上」はその基準点を含みます。」
  // 既知の不具合: CARD-RS-319 ※が未実装
  it.fails("RS-319: 公式Q&A — お互いのダメージが同点（2点ずつ）でも手札に戻る（出典: grnrngr/faq-card-5 RS-319 Q2）", () => {
    expect(zoneOf(masterRushPhase(2, 2), "player1", "RS-319:dm")).toBe("hand");
  });

  // faq-card-5 RS-319 Q3「はい、発動します。」
  // 既知の不具合: CARD-RS-319 ※が未実装
  it.fails("RS-319: 公式Q&A — お互いのダメージが0点でも手札に戻る（出典: grnrngr/faq-card-5 RS-319 Q3）", () => {
    expect(zoneOf(masterRushPhase(0, 0), "player1", "RS-319:dm")).toBe("hand");
  });

  // 「【ディーソードベガ】自軍ターン中、これがバトルエリアに出たとき、BPの下三桁が500の敵軍Sユニットをすべて撃破する。」
  // 既知の不具合: CARD-RS-319 【ディーソードベガ】が「BPの下三桁が500」を解釈できず対象なし（no_targets）で何も撃破しない
  it.fails("RS-319: 自軍ターン中にバトルエリアに出たとき、BP の下三桁が500の敵軍 S ユニット（バトル・ラッシュ両エリア）をすべて撃破する（出典: atwiki/page-47）", () => {
    let s = st(
      {
        player1: { rush: [inst("RS-319", "dm")] },
        player2: {
          battle: [inst("SPEC-1500", "a")],
          rush: [inst("RS-321", "an"), inst("TST-UNIT-0", "k"), inst("SPEC-2500-M", "m")],
          deck: deckCards(3, "e"),
        },
      },
      SPECS,
    );
    s = settle(enter(s, "RS-319:dm"));
    expect(zoneOf(s, "player2", "SPEC-1500:a")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-321:an")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:k")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-2500-M:m")).toBe("rush");
  });

  it("RS-319: BP の下三桁が500の敵軍 S ユニットがいなければ何も撃破しない（出典: atwiki/page-47）", () => {
    let s = st({ player1: { rush: [inst("RS-319", "dm")] }, player2: { battle: [inst("TST-UNIT-0", "a")], rush: [inst("SPEC-2500-M", "m")], deck: deckCards(3, "e") } }, SPECS);
    s = settle(enter(s, "RS-319:dm"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-2500-M:m")).toBe("rush");
  });

  it("RS-319: 敵軍ターン中にバトルエリアに出たときは【ディーソードベガ】は発動しない（出典: atwiki/page-47「自軍ターン中」）", () => {
    const s0 = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RS-319", "dm")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-1500", "a")], rush: [inst("RS-321", "an")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    const s = settle(enterBattleByEffect(s0, "player1", "RS-319:dm"));
    expect(zoneOf(s, "player1", "RS-319:dm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-1500:a")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-321:an")).toBe("rush");
  });
});
