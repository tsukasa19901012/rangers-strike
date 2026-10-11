/**
 * カード別スペック: RS-634〜RS-639（第9弾「蒼九の翼」ユガンデ・ネジレンジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-634〜RS-639 は該当なし）、grnrngr/faq-card-9（カード別 Q&A なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-KW-CALL-01、R-TGT-01「ユニット」はラッシュエリア・バトルエリアのもの）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  act,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enterBattleByEffect,
  enterKeep,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  held,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  rarityOf,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS9-627-647.helpers";

/** 支払い開始アクションを適用し、ホールドに使えるカード一覧を返す。 */
function payableFor(s: GameState, sourceInstanceId: string): string[] {
  const start = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === sourceInstanceId);
  if (!start) return [];
  return act(s, start).pendingCommandPayment?.validInstanceIds ?? [];
}

// ===========================================================================
describe("RS-634 ユガンデ", () => {
  const TEXT =
    "※コールDA 【ダークサンダー】自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドを1つ選びリリースしてもよい。そうしたとき、ホールド状態の敵軍Sユニットを1体選び撃破する。";
  const E_M = sUnit("SPEC-634-M", { size: "M", bp: 1000 });

  it("RS-634: カタログ本文・スペックが出典と一致（出典: atwiki/page-1463）", () => {
    expectCatalogText("RS-634", TEXT);
    expectStats("RS-634", { name: "ユガンデ", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ", "人型"] });
  });

  it("RS-634: レアリティはノーマルレア（出典: atwiki/page-1463「レアリティ：ノーマルレア」）", () => {
    expect(rarityOf("RS-634")).toBe("NR");
  });

  it("RS-634: ※コールDA — DA のユニットをラッシュするためのコマンドとしてホールドでき、ラッシュできる（出典: atwiki/page-1463「※コールDA」・R-KW-CALL-01）", () => {
    const s0 = st({ phase: "rush", player1: { hand: [inst("RS-638", "u")], rush: [inst("RS-634", "y")], power: powerCards(2), deck: deckCards(3) } });
    // コマンドゾーンは空。ユガンデ以外にホールドできるものはない。
    const r = rushFromHand(s0, "player1", "RS-638:u");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-638:u")).toBe("rush");
    expect(cardIn(s, "player1", "RS-634:y")?.commandHeld).toBe(true);
  });

  it("RS-634: ※コールDA — DA 以外（ET）のユニットのラッシュには使えない（出典: R-KW-CALL-01「○○のユニットをラッシュするための」）", () => {
    const s0 = st({ phase: "rush", player1: { hand: [inst("RS-631", "u")], rush: [inst("RS-634", "y")], power: powerCards(2), deck: deckCards(3) } });
    // ET のコマンドがなく、ユガンデ（コールDA）では ET ユニットをラッシュできない。
    const r = rushFromHand(s0, "player1", "RS-631:u");
    const s = r.ok ? resolveAll(r.state) : s0;
    expect(zoneOf(s, "player1", "RS-631:u")).toBe("hand");
    expect(cardIn(s, "player1", "RS-634:y")?.commandHeld ?? false).toBe(false);
  });

  /** 自軍バトルフェイズにユガンデをバトルエリアに出す。敵軍: ホールド状態のコマンド1・リリース状態のコマンド1、ホールド状態の S（ラッシュ・バトル）、リリース状態の S、ホールド状態の M。 */
  const board = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    act(
      p1Battle(
        { rush: [inst("RS-634", "y")] },
        {
          command: [held("TST-OP", "eh"), released("TST-OP", "er")],
          rush: [held("TST-UNIT-0", "hr"), inst("TST-UNIT-0", "rr")],
          battle: [held("TST-UNIT-0", "hb"), held("SPEC-634-M", "hm")],
          ...p2,
        },
        [E_M],
      ),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-634:y" },
    );

  it("RS-634: 【ダークサンダー】自軍ターンにバトルエリアに出たとき、敵軍コマンドを選ぶ選択が開く（出典: atwiki/page-1463）", () => {
    const s = board();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-634");
    expect(choiceIds(s)).toContain("TST-OP:eh");
  });

  it("RS-634: 【ダークサンダー】任意 — 敵軍コマンドを選ばない（リリースしない）こともできる（出典: atwiki/page-1463「リリースしてもよい」）", () => {
    expect(canSkip(board())).toBe(true);
  });

  it("RS-634: 【ダークサンダー】リリースしたとき、ホールド状態の敵軍Sユニットを1体選び撃破する（候補はラッシュ・バトルのホールド状態の S のみ、強制）（出典: atwiki/page-1463「そうしたとき、ホールド状態の敵軍Sユニットを1体選び撃破する」・R-TGT-01）", () => {
    let s = pick(board(), "TST-OP:eh");
    expect(cardIn(s, "player2", "TST-OP:eh")?.commandHeld ?? false).toBe(false);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-634");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:hb", "TST-UNIT-0:hr"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-0:hr"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:hr")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("battle");
  });

  it("RS-634: 【ダークサンダー】リリースしなければ撃破しない（出典: atwiki/page-1463「そうしたとき」）", () => {
    const s = resolveAll(skip(board()));
    expect(cardIn(s, "player2", "TST-OP:eh")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:hr")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("battle");
  });

  it("RS-634: 【ダークサンダー】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1463「自軍ターン中」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-634", "y")], deck: deckCards(3) },
      player2: { command: [held("TST-OP", "eh")], battle: [held("TST-UNIT-0", "hb")], deck: deckCards(3, "e") },
    });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-634:y"));
    expect(cardIn(s, "player2", "TST-OP:eh")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("battle");
  });
});

// ===========================================================================
// ネジレンジャー（RS-635〜RS-639）共通

const FEAT = (f: string, size: "S" | "M" = "S"): CardDefinition => sUnit(`SPEC-NEJI-${f}-${size}`, { size, bp: 1000, sp: undefined, features: [f] });

type NejiSpec = {
  id: string;
  name: string;
  page: string;
  feature: string;
  cn: number;
  text: string;
  bp: number;
  sp: number | "special" | undefined;
  powerCost: number;
  features: string[];
  rarity: string;
  /** "discard"=撃破、"damage"=持ち主のパワーゾーンにダメージ */
  mode: "discard" | "damage";
  effectName: string;
};

const skipIf = (s: GameState) => (s.pendingEffectChoice ? skip(s) : s);

function nejiTests(spec: NejiSpec) {
  const { id, page, feature, cn } = spec;
  const S = FEAT(feature);
  const M = FEAT(feature, "M");
  const sId = S.id;
  const mId = M.id;
  const verb = spec.mode === "discard" ? "撃破してもよい" : "持ち主のパワーゾーンにダメージにして置いてもよい";

  const board = (position: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    p1Battle(
      { rush: [inst(id, "n")], battle: fill(position - 1), ...p1 },
      { rush: [inst(sId, "r")], battle: [inst(sId, "b"), inst(mId, "m"), inst("TST-UNIT-0", "x")], ...p2 },
      [S, M],
    );
  const entered = (position = cn, p1 = {}, p2 = {}) => enterKeep(board(position, p1, p2), [`${id}:n`]);
  const landing = spec.mode === "discard" ? "discard" : "power";

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, spec.text);
    expectStats(id, { name: spec.name, category: "DA", size: "S", bp: spec.bp, sp: spec.sp, powerCost: spec.powerCost, comboNumber: cn, features: spec.features });
  });

  if (spec.rarity === "N") {
    it(`${id}: レアリティはノーマル（出典: ${page}）`, () => {
      expect(rarityOf(id)).toBe("N");
    });
  } else {
    it(`${id}: レアリティは ${spec.rarity}（出典: ${page}「レアリティ」）`, () => {
      expect(rarityOf(id)).toBe(spec.rarity);
    });
  }

  const rushIt = spec.mode === "damage" ? it.fails : it;
  it(`${id}: 【${spec.effectName}】NC（${cn}番目）— 特徴「${feature}」を持つ敵軍バトルエリアの S ユニットを選び${verb}（出典: ${page}）`, () => {
    let s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    expect(choiceIds(s)).toContain(`${sId}:b`);
    s = resolveAll(pick(s, `${sId}:b`));
    expect(zoneOf(s, "player2", `${sId}:b`)).toBe(landing);
    if (spec.mode === "damage") expect(cardIn(s, "player2", `${sId}:b`)?.faceDown).toBe(true);
    expect(zoneOf(s, "player2", `${sId}:r`)).toBe("rush");
  });

  it(`${id}: 【${spec.effectName}】特徴「${feature}」を持たないユニット・M ユニットは選べない（出典: ${page}「特徴「${feature}」を持つ敵軍Sユニット」）`, () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    expect(choiceIds(s)).not.toContain(`${mId}:m`);
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:x");
  });

  // 既知の不具合: CARD-RS-639 候補がバトルエリアのユニットだけで、ラッシュエリアの敵軍ユニットを選べない（parseEnemyUnitFilter の既定 zone が battle）→ mode="damage" のとき it.fails
  rushIt(`${id}: 【${spec.effectName}】敵軍ラッシュエリアの特徴「${feature}」の S ユニットも選べる（出典: ${page}「敵軍Sユニット」・R-TGT-01「ユニット」はラッシュエリア・バトルエリアのもの）`, () => {
    let s = entered();
    expect(choiceIds(s)).toEqual([`${sId}:b`, `${sId}:r`].sort());
    s = resolveAll(pick(s, `${sId}:r`));
    expect(zoneOf(s, "player2", `${sId}:r`)).toBe(landing);
  });

  it(`${id}: 【${spec.effectName}】任意 — 選ばないこともでき、敵軍ユニットはそのまま（出典: ${page}「てもよい」）`, () => {
    let s = entered();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", `${sId}:b`)).toBe("battle");
    expect(zoneOf(s, "player2", `${sId}:r`)).toBe("rush");
  });

  it(`${id}: 【${spec.effectName}】NC が成立しない（${cn === 1 ? 2 : cn - 1}番目）と発動しない（出典: R-CN-02）`, () => {
    const s = resolveAll(entered(cn === 1 ? 2 : cn - 1), [`${sId}:b`]);
    expect(zoneOf(s, "player2", `${sId}:b`)).toBe("battle");
  });

  if (spec.sp === "special") {
    it(`${id}: 【${spec.effectName}】「SP1」— NC が成立すると SP1 になりストライクできる（ホールド状態のコマンドなし）（出典: ${page}）`, () => {
      let s = entered();
      if (s.pendingEffectChoice) s = skip(s);
      expect(spOf(s, "player1", `${id}:n`)).toBe(1);
      expect(canStrike(s, `${id}:n`)).toBe(true);
    });

    it(`${id}: 【${spec.effectName}】NC が成立しないと SP！のままストライクできない（出典: R-CN-02）`, () => {
      const s = resolveAll(entered(cn - 1));
      expect(spOf(s, "player1", `${id}:n`)).toBe(0);
    });

    it(`${id}: ※ 自軍にホールド状態のコマンドがあるとき、これはストライクできない（出典: ${page}「※ホールド状態のコマンドがあるとき、これはストライクできない」）`, () => {
      const s = skipIf(entered(cn, { command: [held("TST-OP-DA", "h")] }));
      expect(spOf(s, "player1", `${id}:n`)).toBe(1);
      expect(canStrike(s, `${id}:n`)).toBe(false);
    });

    it(`${id}: ※ 自軍コマンドがすべてリリース状態ならストライクできる（出典: ${page}「ホールド状態のコマンドがあるとき」）`, () => {
      const s = skipIf(entered(cn, { command: [released("TST-OP-DA", "r")] }));
      expect(canStrike(s, `${id}:n`)).toBe(true);
    });

    it(`${id}: ※ 敵軍にホールド状態のコマンドがあるときもストライクできない（出典: atwiki/page-1488 カード評価「自軍と敵軍両方のコマンドが全てリリースされていないとストライクできない」、atwiki/page-1463 カード評価）`, () => {
      const s = skipIf(entered(cn, {}, { command: [held("TST-OP", "eh")] }));
      expect(spOf(s, "player1", `${id}:n`)).toBe(1);
      expect(canStrike(s, `${id}:n`)).toBe(false);
    });
  }
}

describe("RS-635 ネジピンク", () => {
  nejiTests({
    id: "RS-635",
    name: "ネジピンク",
    page: "atwiki/page-1436",
    feature: "ピンク",
    cn: 1,
    text: "【ネジアロー】特徴「ピンク」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
    bp: 2000,
    sp: undefined,
    powerCost: 0,
    features: ["ピンク", "女"],
    rarity: "N",
    mode: "discard",
    effectName: "ネジアロー",
  });
});

describe("RS-636 ネジブラック", () => {
  nejiTests({
    id: "RS-636",
    name: "ネジブラック",
    page: "atwiki/page-1437",
    feature: "ブラック",
    cn: 2,
    text: "※ホールド状態のコマンドがあるとき、これはストライクできない。 【ネジロッド】「SP1」特徴「ブラック」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
    bp: 2000,
    sp: "special",
    powerCost: 3,
    features: ["ブラック", "男"],
    rarity: "NR",
    mode: "discard",
    effectName: "ネジロッド",
  });
});

describe("RS-637 ネジレッド", () => {
  nejiTests({
    id: "RS-637",
    name: "ネジレッド",
    page: "atwiki/page-1488",
    feature: "レッド",
    cn: 3,
    text: "※ホールド状態のコマンドがあるとき、これはストライクできない。 【ネジセイバー】「SP1」特徴「レッド」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
    bp: 3000,
    sp: "special",
    powerCost: 4,
    features: ["レッド", "男"],
    rarity: "R",
    mode: "discard",
    effectName: "ネジセイバー",
  });
});

describe("RS-638 ネジブルー", () => {
  nejiTests({
    id: "RS-638",
    name: "ネジブルー",
    page: "atwiki/page-1438",
    feature: "ブルー",
    cn: 4,
    text: "※ホールド状態のコマンドがあるとき、これはストライクできない。 【ネジトマホーク】「SP1」特徴「ブルー」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
    bp: 2000,
    sp: "special",
    powerCost: 2,
    features: ["ブルー", "男"],
    rarity: "N",
    mode: "discard",
    effectName: "ネジトマホーク",
  });
});

describe("RS-639 ネジイエロー", () => {
  nejiTests({
    id: "RS-639",
    name: "ネジイエロー",
    page: "atwiki/page-1439",
    feature: "イエロー",
    cn: 5,
    text: "【ネジスリング】特徴「イエロー」を持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。",
    bp: 1000,
    sp: undefined,
    powerCost: 1,
    features: ["イエロー", "女"],
    rarity: "N",
    mode: "damage",
    effectName: "ネジスリング",
  });
});
