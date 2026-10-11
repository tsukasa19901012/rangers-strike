/**
 * カード別スペック: RS-663〜RS-669（第9弾「蒼九の翼」エンジンオーG12〜キシャモス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲の該当なし）、grnrngr/faq-card-9（カード別 Q&A なし。キーワード「ウイング」のみ）。
 *     faq/card_1〜8・index にも該当カードの Q&A はない（faq-card-8 RS-569 Q1 は RS-592 の「パワー送り」に言及するが本範囲のカードではない）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写しはない。各ページに Q&A 節はない）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06 合体、R-CN-*、R-KW-WING-*、R-TIME-01 撃破の段階 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  confirm,
  deckCards,
  enterBattleByEffect,
  enterKeep,
  enterSeq,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  p1Battle,
  p1Rush,
  pick,
  powerCards,
  powerOnDestroyTests,
  rarityOf,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  wingTests,
  zoneOf,
} from "./RS9-648-669.helpers";

const E5000 = sUnit("SPEC-E5000", { bp: 5000 });
const E7000 = sUnit("SPEC-E7000", { bp: 7000 });
const E8000 = sUnit("SPEC-E8000", { bp: 8000 });
const E9000 = sUnit("SPEC-E9000", { bp: 9000, size: "M" });
const E9500 = sUnit("SPEC-E9500", { bp: 9500, size: "M" });
const E13000 = sUnit("SPEC-E13000", { bp: 13000, size: "L" });
const E6000 = sUnit("SPEC-E6000", { bp: 6000 });
const ENEMIES = [E5000, E7000, E8000, E9000, E9500, E13000, E6000];

/** 特徴「炎神」を持つオモテ向きのパワー n 枚（スピードル RS-505）。 */
const enjinPower = (n: number, prefix = "ep") => Array.from({ length: n }, (_, i) => inst("RS-505", `${prefix}${i}`));

/** 「発動できる」等の任意選択があれば発動側（先頭の候補）を選ぶ。 */
function activateIf(s: GameState, cardId: string): GameState {
  const p = s.pendingEffectChoice;
  if (p?.sourceCardId === cardId && p.validInstanceIds[0]) return pick(s, p.validInstanceIds[0]);
  return s;
}

// ===========================================================================
describe("RS-663 エンジンオーG12", () => {
  const TEXT =
    "合体―エンジンオー＋ガンバルオー＋セイクウオー＋キョウレツオー ※このカードの追加条件は、特徴「炎神」を持つオモテ向きの自軍パワーが12枚以上あるとき、次のように変更される⇒本来の特徴に「炎神」を持つ自軍Lユニット1体を捨札にする。 【G12グランプリ】自軍ターン中、これがバトルエリアに出たとき、敵軍ユニットを本来のBPの合計が12000以下になるように選び撃破してもよい。";
  const PAGE = "atwiki/page-1502";
  const PARTS = ["RS-515:eo", "RS-591:gb", "RS-686:sk", "RS-665:ky"];
  const parts = (ids = PARTS) => ids.map((x) => inst(x.split(":")[0]!, x.split(":")[1]!));

  it("RS-663: カタログ本文・スペックが出典と一致（出典: atwiki/page-1502）", () => {
    expectCatalogText("RS-663", TEXT);
    expectStats("RS-663", {
      name: "エンジンオーG12",
      category: "OT",
      size: "L",
      bp: 24000,
      sp: 4,
      powerCost: "12+",
      features: ["人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
    expect(st().definitions["RS-663"]?.rushAdditionalCondition?.text).toBe("自軍合体ユニットをパワーゾーンに送る");
  });

  it("RS-663: レアリティはスーパーレア（出典: atwiki/page-1502「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-663")).toBe("SR");
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    p1Rush({ hand: [inst("RS-663", "g12")], command: releasedCat("OT", 1), power: powerCards(12), ...p1 });

  it("RS-663: 追加条件 — エンジンオー・ガンバルオー・セイクウオー・キョウレツオーをパワーゾーンに送ってラッシュする（捨札にはしない）（出典: atwiki/page-1502「追加条件：自軍合体ユニットをパワーゾーンに送る」）", () => {
    const r = rushFromHand(rushBoard({ rush: parts() }), "player1", "RS-663:g12", { materials: PARTS });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-663:g12")).toBe("rush");
    for (const p of PARTS) expect(zoneOf(t, "player1", p)).toBe("power");
  });

  it("RS-663: 追加条件 — 素材が1体（キョウレツオー）欠けていればラッシュできない（出典: atwiki/page-1502・R-ADD-06）", () => {
    expect(canStartRush(rushBoard({ rush: parts(PARTS.slice(0, 3)) }), "player1", "RS-663:g12")).toBe(false);
  });

  it("RS-663: 必要パワー12+ — パワー11ではラッシュできない（出典: atwiki/page-1502「必要パワー：12+」）", () => {
    expect(canStartRush(rushBoard({ rush: parts(), power: powerCards(11) }), "player1", "RS-663:g12")).toBe(false);
  });

  // 既知の不具合: CARD-RS-663 追加条件の変更（炎神のオモテ向きパワー12枚以上→炎神 L 1体を捨札）が未実装
  it.fails("RS-663: ※ 炎神のオモテ向きの自軍パワーが12枚以上なら、本来の特徴に「炎神」を持つ自軍 L ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1502 ※）", () => {
    const s = rushBoard({ rush: [inst("RS-515", "eo")], power: enjinPower(12) });
    expect(canStartRush(s, "player1", "RS-663:g12")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-663:g12", { materials: ["RS-515:eo"] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-663:g12")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-515:eo")).toBe("discard");
  });

  it("RS-663: ※ 炎神のオモテ向きパワーが11枚（他1枚）なら変更されず、炎神 L 1体だけではラッシュできない（出典: atwiki/page-1502「12枚以上あるとき」）", () => {
    const s = rushBoard({ rush: [inst("RS-515", "eo")], power: [...enjinPower(11), inst("TST-P", "x")] });
    expect(canStartRush(s, "player1", "RS-663:g12")).toBe(false);
  });

  it("RS-663: ※ ウラ向き（ダメージ）の炎神パワーは数えない（出典: atwiki/page-1502「オモテ向きの自軍パワー」）", () => {
    const power = [...enjinPower(11), { ...inst("RS-505", "fd"), faceDown: true }, inst("TST-P", "x")];
    const s = rushBoard({ rush: [inst("RS-515", "eo")], power });
    expect(canStartRush(s, "player1", "RS-663:g12")).toBe(false);
  });

  const board = (enemyBattle: string[], enemyRush: string[] = []) =>
    act(
      p1Battle(
        { rush: [inst("RS-663", "g12")] },
        {
          battle: enemyBattle.map((x) => inst(x.split(":")[0]!, x.split(":")[1]!)),
          rush: enemyRush.map((x) => inst(x.split(":")[0]!, x.split(":")[1]!)),
        },
        ENEMIES,
      ),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-663:g12" },
    );

  it("RS-663: 【G12グランプリ】自軍ターンにバトルエリアに出たとき、撃破する敵軍ユニットを選ぶ選択が開き、選ばないこともできる（出典: atwiki/page-1502「選び撃破してもよい」）", () => {
    const s = board(["SPEC-E5000:a", "SPEC-E7000:b"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-663");
    expect(canSkip(s)).toBe(true);
  });

  /** 複数選択: 候補を順に選び、確定が合法なら確定する。 */
  const pickAll = (s0: GameState, ids: string[]) => {
    let s = s0;
    for (const id of ids) if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
    if (legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    return resolveAll(s);
  };

  // 既知の不具合: CARD-RS-663 【G12グランプリ】が敵軍ユニット1体の撃破選択になっていて、本来の BP の合計 12000 以下で複数体を選べない（汎用 destroy_enter_battle）
  it.fails("RS-663: 【G12グランプリ】本来の BP の合計が 12000 以下になるように複数体（5000＋7000）を選んで撃破できる（出典: atwiki/page-1502「本来のBPの合計が12000以下になるように選び撃破」）", () => {
    const s = pickAll(board(["SPEC-E5000:a", "SPEC-E7000:b", "SPEC-E8000:c"]), ["SPEC-E5000:a", "SPEC-E7000:b"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E7000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E8000:c")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-663 【G12グランプリ】の候補に本来の BP の合計の上限がない
  it.fails("RS-663: 【G12グランプリ】本来の BP が 12000 を超える敵軍ユニット（BP13000）は選べない（出典: atwiki/page-1502「合計が12000以下」）", () => {
    const s = board(["SPEC-E13000:big", "SPEC-E5000:a"]);
    expect(choiceIds(s)).not.toContain("SPEC-E13000:big");
  });

  // 既知の不具合: CARD-RS-663 【G12グランプリ】の合計の上限が未実装
  it.fails("RS-663: 【G12グランプリ】合計が 12000 を超える組み合わせ（5000＋8000）は選べない（5000 を選んだ後は 8000 が候補から外れる）（出典: atwiki/page-1502「合計が12000以下」）", () => {
    let s = board(["SPEC-E5000:a", "SPEC-E8000:c", "SPEC-E7000:b"]);
    s = pick(s, "SPEC-E5000:a");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-663");
    expect(choiceIds(s)).toEqual(["SPEC-E7000:b"]);
  });

  it("RS-663: 【G12グランプリ】任意 — 選ばなければ敵軍ユニットは撃破されない（出典: atwiki/page-1502「撃破してもよい」）", () => {
    let s = board(["SPEC-E5000:a"]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-663") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-663 【G12グランプリ】の候補が敵軍バトルエリアのユニットだけ（ラッシュエリアのユニットを選べない）
  it.fails("RS-663: 【G12グランプリ】敵軍ラッシュエリアのユニットも選べる（出典: atwiki/page-1502「敵軍ユニット」）", () => {
    const s = board([], ["SPEC-E5000:r"]);
    expect(choiceIds(s)).toContain("SPEC-E5000:r");
  });

  it("RS-663: 【G12グランプリ】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1502「自軍ターン中」）", () => {
    const s0 = st(
      { activePlayer: "player2", player1: { rush: [inst("RS-663", "g12")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E5000", "a")], deck: deckCards(3, "e") } },
      ENEMIES,
    );
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-663:g12"));
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-664 エンジンオーG9", () => {
  const TEXT =
    "合体―エンジンオー（またはスピードル＋バスオン＋ベアールV）＋ガンバルオー（またはバルカ＋ガンパード＋キャリゲーター）＋セイクウオー（またはトリプター＋ジェットラス＋ジャン・ボエール） ※このカードの追加条件は、特徴「炎神」を持つオモテ向きの自軍パワーが9枚以上あるとき、次のように変更される⇒本来の特徴に「炎神」を持つ自軍Lユニット1体を捨札にする。 【G9グランプリ】これをラッシュしたとき、本来のBPが9000以下の敵軍ユニットを1体選び、撃破してもよい。";
  const PAGE = "atwiki/page-1494";
  const PARTS = ["RS-515:eo", "RS-591:gb", "RS-686:sk"];
  const parts = (ids = PARTS) => ids.map((x) => inst(x.split(":")[0]!, x.split(":")[1]!));

  it("RS-664: カタログ本文・スペックが出典と一致（出典: atwiki/page-1494）", () => {
    expectCatalogText("RS-664", TEXT);
    expectStats("RS-664", {
      name: "エンジンオーG9",
      category: "OT",
      size: "L",
      bp: 22000,
      sp: 3,
      powerCost: "9+",
      features: ["人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
    expect(st().definitions["RS-664"]?.rushAdditionalCondition?.text).toBe("自軍合体ユニットをパワーゾーンに送る");
  });

  it("RS-664: レアリティはレア（出典: atwiki/page-1494「レアリティ：レア」）", () => {
    expect(rarityOf("RS-664")).toBe("R");
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    p1Rush({ hand: [inst("RS-664", "g9")], command: releasedCat("OT", 1), power: powerCards(9), ...p1 }, p2, ENEMIES);

  it("RS-664: 追加条件 — エンジンオー・ガンバルオー・セイクウオーをパワーゾーンに送ってラッシュする（出典: atwiki/page-1494）", () => {
    const r = rushFromHand(rushBoard({ rush: parts() }), "player1", "RS-664:g9", { materials: PARTS });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-664:g9")).toBe("rush");
    for (const p of PARTS) expect(zoneOf(t, "player1", p)).toBe("power");
  });

  // 既知の不具合: CARD-RS-664 合体の「または」側（M ユニット3体の組）が素材として登録されていない
  it.fails("RS-664: 追加条件 — セイクウオーのかわりにトリプター＋ジェットラス＋ジャン・ボエールでもよい（出典: atwiki/page-1494「セイクウオー（またはトリプター＋ジェットラス＋ジャン・ボエール）」）", () => {
    const alt = ["RS-515:eo", "RS-591:gb", "RS-668:tr", "RS-666:jt", "RS-667:jb"];
    const r = rushFromHand(rushBoard({ rush: parts(alt) }), "player1", "RS-664:g9", { materials: alt });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-664:g9")).toBe("rush");
    for (const p of alt) expect(zoneOf(t, "player1", p)).toBe("power");
  });

  it("RS-664: 追加条件 — セイクウオー（またはその3体）がなければラッシュできない（出典: atwiki/page-1494）", () => {
    expect(canStartRush(rushBoard({ rush: parts(PARTS.slice(0, 2)) }), "player1", "RS-664:g9")).toBe(false);
  });

  it("RS-664: 必要パワー9+ — パワー8ではラッシュできない（出典: atwiki/page-1494「必要パワー：9+」）", () => {
    expect(canStartRush(rushBoard({ rush: parts(), power: powerCards(8) }), "player1", "RS-664:g9")).toBe(false);
  });

  // 既知の不具合: CARD-RS-664 追加条件の変更（炎神のオモテ向きパワー9枚以上→炎神 L 1体を捨札）が未実装
  it.fails("RS-664: ※ 炎神のオモテ向きの自軍パワーが9枚以上なら、本来の特徴に「炎神」を持つ自軍 L ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1494 ※）", () => {
    const s = rushBoard({ rush: [inst("RS-591", "gb")], power: enjinPower(9) });
    expect(canStartRush(s, "player1", "RS-664:g9")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-664:g9", { materials: ["RS-591:gb"] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-664:g9")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-591:gb")).toBe("discard");
  });

  it("RS-664: ※ 炎神のオモテ向きパワーが8枚なら変更されず、炎神 L 1体だけではラッシュできない（出典: atwiki/page-1494「9枚以上あるとき」）", () => {
    const s = rushBoard({ rush: [inst("RS-591", "gb")], power: [...enjinPower(8), inst("TST-P", "x")] });
    expect(canStartRush(s, "player1", "RS-664:g9")).toBe(false);
  });

  const rushed = (enemy: Partial<GameState["players"]["player2"]>) => {
    const r = rushFromHand(rushBoard({ rush: parts() }, enemy), "player1", "RS-664:g9", { materials: PARTS });
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-664: 【G9グランプリ】ラッシュしたとき、撃破する敵軍ユニットを選ぶ選択が開き、選ばないこともできる（出典: atwiki/page-1494「1体選び、撃破してもよい」）", () => {
    const s = rushed({ rush: [inst("SPEC-E9000", "a"), inst("SPEC-E5000", "c")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-664");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["SPEC-E5000:c", "SPEC-E9000:a"]));
    expect(canSkip(s)).toBe(true);
  });

  it("RS-664: 【G9グランプリ】選んだ敵軍ユニット（本来の BP9000）を1体撃破する（出典: atwiki/page-1494）", () => {
    const s = resolveAll(pick(rushed({ rush: [inst("SPEC-E9000", "a"), inst("SPEC-E5000", "c")] }), "SPEC-E9000:a"));
    expect(zoneOf(s, "player2", "SPEC-E9000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E5000:c")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-664 【G9グランプリ】の候補が敵軍ラッシュエリアのユニットだけ（敵軍バトルエリアのユニットを選べない）
  it.fails("RS-664: 【G9グランプリ】敵軍バトルエリアのユニットも選べる（出典: atwiki/page-1494「敵軍ユニットを1体選び」）", () => {
    const s = rushed({ battle: [inst("SPEC-E9000", "a")], rush: [inst("SPEC-E5000", "c")] });
    expect(choiceIds(s)).toEqual(["SPEC-E5000:c", "SPEC-E9000:a"]);
  });

  // 既知の不具合: CARD-RS-664 【G9グランプリ】の候補に本来の BP9000 以下の上限がない（BP9500・BP13000 も選べる）
  it.fails("RS-664: 【G9グランプリ】本来の BP が 9000 を超える敵軍ユニット（BP9500）は選べない（出典: atwiki/page-1494「本来のBPが9000以下」）", () => {
    const s = rushed({ rush: [inst("SPEC-E9500", "b"), inst("SPEC-E5000", "c")] });
    expect(choiceIds(s)).toEqual(["SPEC-E5000:c"]);
  });

  it("RS-664: 【G9グランプリ】任意 — 選ばなければ撃破しない（出典: atwiki/page-1494「撃破してもよい」）", () => {
    let s = rushed({ rush: [inst("SPEC-E9000", "a")] });
    if (s.pendingEffectChoice?.sourceCardId === "RS-664") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E9000:a")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-665 キョウレツオー", () => {
  const TEXT =
    "合体―キシャモス＋ティライン＋ケライン 【キョウレツエクスプレス】 自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍山札の上から1枚をオモテにして、それが特徴「炎神」または「恐竜」を持つカードだったなら、このターン、これは「SP1」になる。その後、オモテにしたカードは山札の下に戻す。";
  const PAGE = "atwiki/page-1476";
  const PARTS = ["RS-669:ks", "RS-670:ti", "RS-671:ke"];

  it("RS-665: カタログ本文・スペックが出典と一致（出典: atwiki/page-1476）", () => {
    expectCatalogText("RS-665", TEXT);
    expectStats("RS-665", {
      name: "キョウレツオー",
      category: "OT",
      size: "L",
      bp: 16000,
      sp: "special",
      powerCost: "7+",
      features: ["恐竜", "人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-665: レアリティはノーマルレア（出典: atwiki/page-1476「レアリティ：ノーマルレア」）", () => {
    expect(rarityOf("RS-665")).toBe("NR");
  });

  const rushBoard = (ids = PARTS, power = 7) =>
    p1Rush({ hand: [inst("RS-665", "ky")], rush: ids.map((x) => inst(x.split(":")[0]!, x.split(":")[1]!)), command: releasedCat("OT", 1), power: powerCards(power) });

  it("RS-665: 合体 — 自軍のキシャモス・ティライン・ケラインを捨札にしてラッシュできる（出典: atwiki/page-1476「追加条件：自軍合体ユニットを捨札にする」）", () => {
    const r = rushFromHand(rushBoard(), "player1", "RS-665:ky", { materials: PARTS });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-665:ky")).toBe("rush");
    for (const p of PARTS) expect(zoneOf(t, "player1", p)).toBe("discard");
  });

  it("RS-665: 合体 — 1体（ケライン）欠けていればラッシュできない（出典: atwiki/page-1476・R-ADD-06）", () => {
    expect(canStartRush(rushBoard(PARTS.slice(0, 2)), "player1", "RS-665:ky")).toBe(false);
  });

  it("RS-665: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-1476「必要パワー：7+」）", () => {
    expect(canStartRush(rushBoard(PARTS, 6), "player1", "RS-665:ky")).toBe(false);
  });

  const board = (top: string) =>
    enterKeep(p1Battle({ rush: [inst("RS-665", "ky")], deck: [inst(top.split(":")[0]!, top.split(":")[1]!), ...deckCards(3)] }), ["RS-665:ky"]);

  // 既知の不具合: CARD-RS-665 【キョウレツエクスプレス】が未実装（ログは出るが、発動の選択も山札の公開も SP1 もない）
  it.fails("RS-665: 【キョウレツエクスプレス】山札の上が炎神のカードなら、このターン SP1 になりストライクでき、そのカードは山札の下に戻る（出典: atwiki/page-1476）", () => {
    const s = resolveAll(activateIf(board("RS-505:top"), "RS-665"));
    expect(spOf(s, "player1", "RS-665:ky")).toBe(1);
    expect(canStrike(s, "RS-665:ky")).toBe(true);
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("RS-505:top");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  // 既知の不具合: CARD-RS-665 【キョウレツエクスプレス】が未実装
  it.fails("RS-665: 【キョウレツエクスプレス】山札の上が「恐竜」を持つカード（炎神でない）でも SP1（出典: atwiki/page-1476「特徴「炎神」または「恐竜」」）", () => {
    // RS-052（WB・恐竜）
    const s = resolveAll(activateIf(board("RS-052:top"), "RS-665"));
    expect(spOf(s, "player1", "RS-665:ky")).toBe(1);
  });

  // 既知の不具合: CARD-RS-665 【キョウレツエクスプレス】が未実装（オモテにしたカードが山札の下に戻らない）
  it.fails("RS-665: 【キョウレツエクスプレス】炎神・恐竜でないカードなら SP！のままだが、山札の下には戻る（出典: atwiki/page-1476「その後、オモテにしたカードは山札の下に戻す」）", () => {
    const s = resolveAll(activateIf(board("TST-OP:top"), "RS-665"));
    expect(spOf(s, "player1", "RS-665:ky")).toBe(0);
    expect(canStrike(s, "RS-665:ky")).toBe(false);
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-OP:top");
  });

  // 既知の不具合: CARD-RS-665 【キョウレツエクスプレス】が未実装（発動するかの選択が開かない）
  it.fails("RS-665: 【キョウレツエクスプレス】「発動できる」— 発動しなければ山札は動かず SP！のまま（出典: atwiki/page-1476「次の効果を発動できる」）", () => {
    let s = board("RS-505:top");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-665");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.deck[0]?.instanceId).toBe("RS-505:top");
    expect(spOf(s, "player1", "RS-665:ky")).toBe(0);
  });

  it("RS-665: 【キョウレツエクスプレス】SP1 は「このターン」だけ（出典: atwiki/page-1476「このターン、これは「SP1」になる」）", () => {
    let s = resolveAll(activateIf(board("RS-505:top"), "RS-665"));
    s = toPhase(s, "player2", "charge");
    expect(spOf(s, "player1", "RS-665:ky")).toBe(0);
  });

  it("RS-665: 【キョウレツエクスプレス】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1476「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-665", "ky")], deck: [inst("RS-505", "top"), ...deckCards(3)] }, player2: { deck: deckCards(3, "e") } });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-665:ky"), ["RS-505:top"]);
    expect(s.players.player1.deck[0]?.instanceId).toBe("RS-505:top");
    expect(spOf(s, "player1", "RS-665:ky")).toBe(0);
  });
});

// ===========================================================================
describe("RS-666 ジェットラス", () => {
  const TEXT = "※ウイング ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに置いてもよい。";
  const PAGE = "atwiki/page-1477";

  it("RS-666: カタログ本文・スペックが出典と一致（出典: atwiki/page-1477）", () => {
    expectCatalogText("RS-666", TEXT);
    expectStats("RS-666", { name: "ジェットラス", category: "OT", size: "M", bp: 3000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["航空機", "炎神"] });
    expect(rarityOf("RS-666")).toBe("N");
  });

  wingTests("RS-666", PAGE);
  powerOnDestroyTests("RS-666", PAGE);
});

// ===========================================================================
describe("RS-667 ジャン・ボエール", () => {
  const TEXT =
    "※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに置いてもよい。 【ファーストクラスな教官】これをラッシュしたとき、自軍山札を見て「ジャン・ボエール」以外の特徴「炎神」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";
  const PAGE = "atwiki/page-1478";

  it("RS-667: カタログ本文・スペックが出典と一致（出典: atwiki/page-1478）", () => {
    expectCatalogText("RS-667", TEXT);
    expectStats("RS-667", { name: "ジャン・ボエール", category: "OT", size: "M", bp: 3000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["航空機", "炎神"] });
    expect(rarityOf("RS-667")).toBe("N");
  });

  powerOnDestroyTests("RS-667", PAGE);

  const DECK = () => [inst("RS-668", "tr"), inst("RS-667", "jb2"), inst("RS-515", "eoL"), inst("TST-UNIT-2", "m"), inst("RS-669", "ks")];
  const rushed = () => {
    const r = rushFromHand(p1Rush({ hand: [inst("RS-667", "jb")], command: releasedCat("OT", 1), power: powerCards(5), deck: DECK() }), "player1", "RS-667:jb");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-667: 【ファーストクラスな教官】ラッシュしたとき、山札の「ジャン・ボエール」以外の炎神 M ユニットだけを選べ（炎神 L・炎神でない M・同名は不可）、選ばないこともできる（出典: atwiki/page-1478）", () => {
    const s = rushed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-667");
    expect(choiceIds(s)).toEqual(["RS-668:tr", "RS-669:ks"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-667: 【ファーストクラスな教官】選んだカードを自軍ラッシュエリアに出す（出典: atwiki/page-1478「自軍ラッシュエリアに出してもよい」）", () => {
    const s = resolveAll(pick(rushed(), "RS-669:ks"));
    expect(zoneOf(s, "player1", "RS-669:ks")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-668:tr")).toBe("deck");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RS-667: 【ファーストクラスな教官】任意 — 出さなければ山札の枚数は変わらない（出典: atwiki/page-1478「出してもよい」）", () => {
    const s = resolveAll(skip(rushed()));
    expect(s.players.player1.deck).toHaveLength(5);
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual(["RS-667:jb"]);
  });

  it("RS-667: 【ファーストクラスな教官】ラッシュ以外（効果で）バトルエリアに出ただけでは発動しない（出典: atwiki/page-1478「これをラッシュしたとき」）", () => {
    const s = enterSeq(p1Battle({ rush: [inst("RS-667", "jb")], deck: DECK() }), ["RS-667:jb"]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-667");
    expect(resolveAll(s).players.player1.deck).toHaveLength(5);
  });

  it.todo(
    "RS-667: 【ファーストクラスな教官】その後、山札をシャッフルする（出典: atwiki/page-1478）— シャッフルの結果は乱数で、並びが変わらないこともあり得るため決定的に検証できない",
  );
});

// ===========================================================================
describe("RS-668 トリプター", () => {
  const TEXT = "※ウイング ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに置いてもよい。";
  const PAGE = "atwiki/page-1479";

  it("RS-668: カタログ本文・スペックが出典と一致（出典: atwiki/page-1479）", () => {
    expectCatalogText("RS-668", TEXT);
    expectStats("RS-668", { name: "トリプター", category: "OT", size: "M", bp: 2000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["航空機", "炎神"] });
    expect(rarityOf("RS-668")).toBe("N");
  });

  wingTests("RS-668", PAGE);
  powerOnDestroyTests("RS-668", PAGE);
});

// ===========================================================================
describe("RS-669 キシャモス", () => {
  const TEXT =
    "※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに置いてもよい。 【アイスエイジエクスプレス】これが自軍バトルエリアにある間、このユニットから「ティライン、ケライン」の順にコンビネーションしたとき、敵軍バトルエリアから本来のBPが5000以下の敵軍ユニットを1体選び持ち主のパワーゾーンに送ってもよい。";
  const PAGE = "atwiki/page-1446";

  it("RS-669: カタログ本文・スペックが出典と一致（出典: atwiki/page-1446）", () => {
    expectCatalogText("RS-669", TEXT);
    expectStats("RS-669", { name: "キシャモス", category: "OT", size: "M", bp: 4000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["車両", "恐竜", "炎神"] });
    expect(rarityOf("RS-669")).toBe("N");
  });

  powerOnDestroyTests("RS-669", PAGE);

  /** キシャモスを1番目に置き、order の順にバトルエリアへ出す。敵軍: バトルエリアに BP5000・BP6000、ラッシュエリアに BP5000。 */
  const board = (order: string[]) =>
    enterKeep(
      p1Battle(
        { battle: [inst("RS-669", "ks")], rush: [inst("RS-670", "ti"), inst("RS-671", "ke"), inst("TST-UNIT-0", "x")] },
        { battle: [inst("SPEC-E5000", "a"), inst("SPEC-E6000", "b")], rush: [inst("SPEC-E5000", "r")] },
        ENEMIES,
      ),
      order,
    );

  // 既知の不具合: CARD-RS-669 【アイスエイジエクスプレス】が未実装（ティライン→ケラインの順にコンビネーションしても選択が開かない）
  it.fails("RS-669: 【アイスエイジエクスプレス】キシャモスからティライン→ケラインの順にコンビネーションしたとき、敵軍バトルエリアの本来の BP5000 以下のユニットだけを選べ、選ばないこともできる（出典: atwiki/page-1446）", () => {
    const s = board(["RS-670:ti", "RS-671:ke"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-669");
    expect(choiceIds(s)).toEqual(["SPEC-E5000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-669 【アイスエイジエクスプレス】が未実装
  it.fails("RS-669: 【アイスエイジエクスプレス】選んだ敵軍ユニットは持ち主（相手）のパワーゾーンに送られる（出典: atwiki/page-1446「持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = resolveAll(pick(board(["RS-670:ti", "RS-671:ke"]), "SPEC-E5000:a"));
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E6000:b")).toBe("battle");
  });

  it("RS-669: 【アイスエイジエクスプレス】逆の順（ケライン→ティライン）では発動しない（出典: atwiki/page-1446「「ティライン、ケライン」の順に」）", () => {
    const s = resolveAll(board(["RS-671:ke", "RS-670:ti"]), ["SPEC-E5000:a"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("battle");
  });

  it("RS-669: 【アイスエイジエクスプレス】間に別のユニットが入れば（キシャモス→他→ティライン→ケライン）発動しない（出典: atwiki/page-1446「このユニットから」）", () => {
    const s = resolveAll(board(["TST-UNIT-0:x", "RS-670:ti", "RS-671:ke"]), ["SPEC-E5000:a"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("battle");
  });
});
