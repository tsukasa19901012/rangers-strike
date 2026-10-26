/**
 * cardSpec XG7-001〜XG7-023（クロスギャザー ザ・ベストパートナー ゴーカイピンク〜獣拳巨神サイダイオー）用ヘルパー。
 * BK1-001-019.helpers.ts（RS・RK・RM・BK のヘルパーを含む）をそのまま再エクスポートし、XG7 に多いキーワード
 * （※クロス・追加で自軍コマンドを1つホールドする・※コール・※タクス・※ブレイカー）と、ゴーカイジャーの「置き換え」の共通テストを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  DEFS,
  act,
  canStartRush,
  canStrike,
  cardIn,
  deckCards,
  enter,
  enterHold,
  fill,
  inst,
  legal,
  p1Battle,
  powerCards,
  released,
  releasedCat,
  rushFromHand,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

export type Cat = "WB" | "MA" | "OT" | "ET" | "DA";

/** 出典どおりの期待値のテスト。gap があればエンジンの不具合として it.fails で残す（「既知の不具合: CARD-<ID> …」）。 */
export function specIt(id: string, title: string, fn: () => void, gap?: string): void {
  if (gap) it.fails(`${title} — 既知の不具合: CARD-${id} ${gap}`, fn);
  else it(title, fn);
}

/** 共通テストの既知の不具合（テストのキー → 不具合の説明）。 */
export type Gaps = Partial<Record<string, string>>;

/** 「特徴に色を持つ」の10種（atwiki/page-2406 Q1・page-2407 Q1）。 */
export const COLORS = ["レッド", "ブルー", "イエロー", "ピンク", "グリーン", "ブラック", "ホワイト", "シルバー", "バイオレット", "ゴールド"] as const;

/** 自軍（player1）ラッシュフェイズの盤面（両軍の山札5枚）。 */
export function rushPhaseOf(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 敵軍（player2）ターンのバトルフェイズの盤面。 */
export function enemyTurnOf(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 必要パワーの数字（「3+」は3）。 */
export function costNumber(cost: number | string): number {
  return typeof cost === "number" ? cost : Number(String(cost).replace(/[^0-9]/g, ""));
}

/** 両軍のバトルエリアにいるユニットの効果の選択の持ち主・発動元（pendingEffectChoice）がこのカードか。 */
export function choiceFromCard(s: GameState, cardId: string): boolean {
  return s.pendingEffectChoice?.sourceCardId === cardId;
}

// ===========================================================================
/** ※クロス1 の共通テスト（R-KW-CROSS-01、atwiki/page-2393 規定文）。 */
export function crossTests(id: string, page: string, extra: CardDefinition[] = [], gaps: Gaps = {}): void {
  specIt(id, `${id}: ※クロス1 — これが自軍バトルエリアにある間、右に並ぶ CN3 のユニット（XG1-007【チェンジソード】「SP1」）は2番目で NC が成立する（出典: ${page}「※クロス1」・atwiki/page-2393 規定文）`, () => {
    const s = enter(p1Battle({ battle: [inst(id, "x")], rush: [inst("XG1-007", "cd")] }, {}, extra), "XG1-007:cd");
    expect(canStrike(s, "XG1-007:cd")).toBe(true);
  }, gaps.cross_nc);

  specIt(id, `${id}: ※クロス1 — 右に並ぶ SP1/3 のユニットは2番目で SP1 になる（分母が1少なくなる）（出典: ${page}・atwiki/page-2393 規定文）`, () => {
    const FRAC = sUnit("SPEC-XFRAC3", { sp: "1/3", bp: 1000 } as Partial<CardDefinition>);
    const s = enter(p1Battle({ battle: [inst(id, "x")], rush: [inst("SPEC-XFRAC3", "f")] }, {}, [FRAC, ...extra]), "SPEC-XFRAC3:f");
    expect(spOf(s, "player1", "SPEC-XFRAC3:f")).toBe(1);
  }, gaps.cross_sp);
}

/** 追加条件「追加で自軍コマンドを1つホールドする」の共通テスト（必要パワーは cost の数字だけ用意する）。 */
export function extraHoldTests(id: string, cats: Cat[], cost: number | string, page: string, extra: CardDefinition[] = [], gaps: Gaps = {}): void {
  const n = costNumber(cost);
  const commands = (count: number) => [...cats.flatMap((c, i) => releasedCat(c, 1, `x${c}${i}`)), ...releasedCat(cats[0]!, Math.max(0, count - cats.length), "xadd")];
  specIt(id, `${id}: 追加条件 — コマンドを追加で1つホールドしてラッシュする（ホールドしたコマンドは合わせて2つ）（出典: ${page}「追加条件：追加で自軍コマンドを1つホールドする」・必要パワー${cost}）`, () => {
    const s = rushPhaseOf({ hand: [inst(id, "h")], command: commands(Math.max(2, cats.length)), power: powerCards(n) }, {}, extra);
    const r = rushFromHand(s, "player1", `${id}:h`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:h`)).toBe("rush");
    expect(r.state.players.player1.command.filter((c) => c.commandHeld).length).toBe(2);
  }, gaps.hold_ok);

  if (cats.length === 1) {
    specIt(id, `${id}: 追加条件 — リリース状態の自軍コマンドが1つだけならラッシュできない（出典: ${page}「追加で自軍コマンドを1つホールドする」）`, () => {
      const s = rushPhaseOf({ hand: [inst(id, "h")], command: releasedCat(cats[0]!, 1, "only"), power: powerCards(n) }, {}, extra);
      expect(canStartRush(s, "player1", `${id}:h`)).toBe(false);
    }, gaps.hold_one);
  }

  // コマンドはコマンドゾーンにあるカードすべて（atwiki/page-151）。チャージしたユニットのカードも追加分になる。
  // 以前はオペレーションのカードしか追加分に数えず、ユニットのカードばかりのコマンドゾーンではラッシュできなかった。
  if (cats.length !== 1) return;
  const otherCat = (["WB", "MA", "OT", "ET", "DA"] as Cat[]).find((c) => !cats.includes(c))!;
  const UNIT_CMD = sUnit("SPEC-HOLD-UNIT-CMD", { category: otherCat, bp: 1000, powerCost: 0 });
  specIt(id, `${id}: 追加条件 — 追加でホールドするコマンドはユニットのカードでもよい（出典: ${page}「追加で自軍コマンドを1つホールドする」・atwiki/page-151「コマンドゾーンに置かれたカードのこと」）`, () => {
    const command = [...releasedCat(cats[0]!, 1, "ucat"), released(UNIT_CMD.id, "u")];
    const s = rushPhaseOf({ hand: [inst(id, "h")], command, power: powerCards(n) }, {}, [...extra, UNIT_CMD]);
    const r = rushFromHand(s, "player1", `${id}:h`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:h`)).toBe("rush");
    expect(r.state.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  }, gaps.hold_unit);
}

/** ※コール○○ の共通テスト（R-KW-CALL-01、atwiki/page-1293）。cat のユニットのラッシュのコマンドとしてホールドできる。 */
export function callTests(id: string, cat: Cat, page: string, gaps: Gaps = {}): void {
  const SAME = sUnit(`SPEC-CALL-${cat}`, { category: cat, bp: 1000, powerCost: 0 });
  const OTHER_CAT: Cat = cat === "OT" ? "ET" : "OT";
  const OTHER = sUnit(`SPEC-CALL-${OTHER_CAT}`, { category: OTHER_CAT, bp: 1000, powerCost: 0 });
  specIt(id, `${id}: ※コール${cat} — 自軍ラッシュエリアのこれを、${cat} のユニットをラッシュするためのコマンドとしてホールドできる（出典: ${page}「※コール${cat}」・atwiki/page-1293）`, () => {
    const s = rushPhaseOf({ hand: [inst(SAME.id, "h")], rush: [inst(id, "c")], command: [], power: [] }, {}, [SAME]);
    const r = rushFromHand(s, "player1", `${SAME.id}:h`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${SAME.id}:h`)).toBe("rush");
    expect(cardIn(r.state, "player1", `${id}:c`)?.commandHeld).toBe(true);
  }, gaps.call_ok);

  specIt(id, `${id}: ※コール${cat} — ${cat} を持たないユニットのラッシュには使えない（出典: ${page}・atwiki/page-1293 規定文）`, () => {
    const s = rushPhaseOf({ hand: [inst(OTHER.id, "h")], rush: [inst(id, "c")], command: [], power: [] }, {}, [OTHER]);
    expect(canStartRush(s, "player1", `${OTHER.id}:h`)).toBe(false);
  }, gaps.call_other);
}

/** ※タクス○○ の共通テスト（R-KW-TAKUS-01、atwiki/page-1291）。WB=1・MA=2・OT=3・ET=4 番目にある間、次に並ぶ cat の S ユニットは SP1。 */
export function takusTests(id: string, cat: Cat, page: string, gaps: Gaps = {}): void {
  const pos = { WB: 1, MA: 2, OT: 3, ET: 4, DA: 5 }[cat];
  const NEXT = sUnit(`SPEC-TAKUS-${cat}`, { category: cat, bp: 1000, sp: undefined });
  const NEXT_OTHER = sUnit(`SPEC-TAKUS-NOT-${cat}`, { category: cat === "WB" ? "OT" : "WB", bp: 1000, sp: undefined });
  const board = (left: number, next: CardInstance) =>
    enter(p1Battle({ battle: [...fill(left), inst(id, "t")], rush: [next] }, {}, [NEXT, NEXT_OTHER]), next.instanceId);
  specIt(id, `${id}: ※タクス${cat} — これがバトルエリアの${pos}番目にある間、次に並ぶ ${cat} の S ユニットは SP1（出典: ${page}「※タクス${cat}」・atwiki/page-1291 規定文）`, () => {
    expect(spOf(board(pos - 1, inst(NEXT.id, "n")), "player1", `${NEXT.id}:n`)).toBe(1);
  }, gaps.takus_ok);

  specIt(id, `${id}: ※タクス${cat} — 次に並ぶのが ${cat} を持たないユニットなら SP1 にならない（出典: ${page}・atwiki/page-1291 規定文）`, () => {
    expect(spOf(board(pos - 1, inst(NEXT_OTHER.id, "n")), "player1", `${NEXT_OTHER.id}:n`)).toBe(0);
  }, gaps.takus_other);

  if (pos > 1) {
    specIt(id, `${id}: ※タクス${cat} — これが${pos}番目以外（${pos - 1}番目）にあるときは SP1 を与えない（出典: ${page}・atwiki/page-1291 規定文）`, () => {
      expect(spOf(board(pos - 2, inst(NEXT.id, "n")), "player1", `${NEXT.id}:n`)).toBe(0);
    }, gaps.takus_pos);
  }
}

/**
 * ※ブレイカー の共通テスト（R-KW-BREAKER-01、atwiki/page-2355 A1）。
 * 敵軍（player1）の RS-155 ガオバイソン【鋼の角】（必要パワーの数字が敵軍ダメージの点数以下の敵軍ユニットを1体選んで撃破してもよい）で、player2 のこれが選ばれないこと。
 */
export function breakerTests(id: string, page: string, extra: CardDefinition[] = [], gaps: Gaps = {}): void {
  const OTHER = sUnit("SPEC-BRK-OTHER", { bp: 1000, powerCost: 1 });
  specIt(id, `${id}: ※ブレイカー — ブレイカーを持たない敵軍ユニットの効果（RS-155 ガオバイソン【鋼の角】）に選ばれない（出典: ${page}「※ブレイカー」・atwiki/page-2355 A1）`, () => {
    let s = p1Battle(
      { rush: [inst("RS-155", "bs")], command: releasedCat("WB", 1) },
      { battle: [inst(id, "b"), inst(OTHER.id, "o")], damage: 6, power: Array.from({ length: 6 }, (_, i) => ({ ...inst("TST-P", `ed${i}`), faceDown: true })) },
      [OTHER, ...extra],
    );
    s = enterHold(s, "RS-155:bs");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-155");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(`${OTHER.id}:o`);
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain(`${id}:b`);
  }, gaps.breaker_select);

  specIt(id, `${id}: ※ブレイカー — 本来のカード名が同じ自軍ユニットがあるとき、これはラッシュできない（出典: ${page}・atwiki/page-2355 A1）`, () => {
    const s = rushPhaseOf({ hand: [inst(id, "h")], rush: [inst(id, "same")], command: releasedCat("WB", 3).concat(releasedCat("MA", 1), releasedCat("ET", 1), releasedCat("OT", 1)), power: powerCards(12) }, {}, extra);
    expect(canStartRush(s, "player1", `${id}:h`)).toBe(false);
  }, gaps.breaker_name);
}

// ===========================================================================
/** ゴーカイジャーの※「これをラッシュしたとき、「X」以外のオモテ向きの自軍パワーから、追加条件を持たない、特徴…を持つSユニットのカードを1枚選び、これと置き換えてもよい」。 */
export function gokaiSwapTests(opts: { id: string; name: string; page: string; cost: number; colors: string[]; gaps?: Gaps }): void {
  const { id, name, page, cost, colors } = opts;
  const gaps = opts.gaps ?? {};
  const [c1, c2] = colors;
  const OK1 = sUnit(`SPEC-GK-${id}-A`, { category: "WB", bp: 1000, features: [c1!] });
  const OK2 = sUnit(`SPEC-GK-${id}-B`, { category: "MA", bp: 1000, features: [c2 ?? c1!, "男"] });
  const SAME_NAME = sUnit(`SPEC-GK-${id}-SAME`, { name, category: "OT", bp: 1000, features: [c1!] });
  const SIZE_M = sUnit(`SPEC-GK-${id}-M`, { category: "WB", bp: 3000, size: "M", features: [c1!] });
  const OTHER_COLOR = sUnit(`SPEC-GK-${id}-X`, { category: "WB", bp: 1000, features: [c1 === "レッド" ? "ブルー" : "レッド"] });
  const defs = [OK1, OK2, SAME_NAME, SIZE_M, OTHER_COLOR];
  const power = (): CardInstance[] => [
    inst(OK1.id, "a"),
    inst(OK2.id, "b"),
    inst(SAME_NAME.id, "same"),
    inst(SIZE_M.id, "m"),
    inst(OTHER_COLOR.id, "x"),
    { ...inst(OK1.id, "down"), faceDown: true },
  ];
  // 追加条件を持つ S ユニット: XG7-019 ゴセイレッド×ゴセイピンク（レッド・ピンク）、XG7-013 デカブルー×デカレッド（レッド・ブルー）、XG7-021 デカピンク×デカイエロー（イエロー・ピンク）。
  const withCondition = c1 === "レッド" || c1 === "ピンク" ? "XG7-019" : c1 === "ブルー" ? "XG7-013" : c1 === "イエロー" ? "XG7-021" : "XG7-007";
  const rushedWith = (pw: CardInstance[]) => {
    const s = rushPhaseOf({ hand: [inst(id, "g")], command: releasedCat("OT", 1), power: [...pw, ...powerCards(Math.max(0, cost - pw.length))] }, {}, defs);
    const r = rushFromHand(s, "player1", `${id}:g`);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  const colorText = colors.length === 2 ? `特徴「${c1}」または${c2}` : `特徴「${c1}」`;

  specIt(id, `${id}: ※ラッシュしたとき — オモテ向きの自軍パワーの、追加条件を持たない ${colorText} を持つ S ユニットのカードから1枚選べる（任意）。同名・M・ウラ向き・追加条件あり・ほかの色は選べない（出典: ${page}「「${name}」以外のオモテ向きの自軍パワーから、追加条件を持たない、${colorText}を持つSユニットのカードを1枚選び、これと置き換えてもよい」）`, () => {
    const s = rushedWith([...power(), inst(withCondition, "cond")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual([`${OK1.id}:a`, `${OK2.id}:b`].sort());
    expect(legal(s).some((a) => a.type === "skip_effect_choice")).toBe(true);
  }, gaps.gokai_choice);

  specIt(id, `${id}: ※置き換え — 選んだカードが自軍ラッシュエリアに出て、これはオモテ向きで自軍パワーゾーンに置かれる（パワーの枚数は変わらない）（出典: ${page}「これと置き換えて」・atwiki/page-1413（置き換え））`, () => {
    let s = rushedWith(power());
    const before = s.players.player1.power.length;
    if (s.pendingEffectChoice?.sourceCardId === id) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: `${OK2.id}:b` });
    const swapped = zoneOf(s, "player1", `${OK2.id}:b`) === "rush" ? `${OK2.id}:b` : `${OK1.id}:a`;
    expect(zoneOf(s, "player1", swapped)).toBe("rush");
    expect(zoneOf(s, "player1", `${id}:g`)).toBe("power");
    expect(cardIn(s, "player1", `${id}:g`)?.faceDown ?? false).toBe(false);
    expect(s.players.player1.power.length).toBe(before);
  }, gaps.gokai_swap);

  specIt(id, `${id}: ※置き換え — 選んだカード（2枚目の候補）が出る（出典: ${page}「1枚選び」）`, () => {
    let s = rushedWith(power());
    if (s.pendingEffectChoice?.sourceCardId === id) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: `${OK2.id}:b` });
    expect(zoneOf(s, "player1", `${OK2.id}:b`)).toBe("rush");
    expect(zoneOf(s, "player1", `${OK1.id}:a`)).toBe("power");
  }, gaps.gokai_second);

  specIt(id, `${id}: ※置き換えなくてもよい（これはラッシュエリアに残る）（出典: ${page}「置き換えてもよい」）`, () => {
    let s = rushedWith(power());
    if (s.pendingEffectChoice?.sourceCardId === id) s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", `${id}:g`)).toBe("rush");
    expect(zoneOf(s, "player1", `${OK1.id}:a`)).toBe("power");
    expect(zoneOf(s, "player1", `${OK2.id}:b`)).toBe("power");
  }, gaps.gokai_skip);

  specIt(id, `${id}: ※ 候補がなければ（同名・M・ウラ向き・追加条件あり・ほかの色だけ）置き換えない（出典: ${page}）`, () => {
    const s = rushedWith([inst(SAME_NAME.id, "same"), inst(SIZE_M.id, "m"), inst(OTHER_COLOR.id, "x"), { ...inst(OK1.id, "down"), faceDown: true }, inst(withCondition, "cond")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
    expect(zoneOf(s, "player1", `${id}:g`)).toBe("rush");
  }, gaps.gokai_none);
}

/** 自軍（player1）バトルフェイズに、fillerCount 体の後へ id を出したあとの NC の選択を、playerId の選択として受け入れるまで進める（必要なら）。 */
export function ncBoard(
  id: string,
  fillerCount: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cardId, suf] = id.split(":") as [string, string];
  const s = p1Battle({ ...p1, battle: [...fill(fillerCount), ...(p1.battle ?? [])], rush: [inst(cardId, suf), ...(p1.rush ?? [])] }, p2, extra);
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: id });
}

/** 指定プレイヤーの山札の instanceId（上から）。 */
export function deckOf(s: GameState, playerId: PlayerId = "player1"): string[] {
  return s.players[playerId].deck.map((c) => c.instanceId);
}

/** 印刷スペック（マルチカテゴリは配列で照合する）。 */
export function expectUnitStats(
  id: string,
  stats: {
    name: string;
    category: string | string[];
    size: string;
    bp: number;
    sp: number | string | undefined;
    powerCost: number | string;
    comboNumber?: number | string;
    features: string[];
    rushCondition?: string;
    type?: string;
  },
): void {
  const d = DEFS[id]!;
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe(stats.type ?? "unit");
  expect(d.category).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect((d as { bp?: number }).bp).toBe(stats.bp);
  expect((d as { sp?: unknown }).sp ?? undefined).toBe(stats.sp);
  expect((d as { comboNumber?: unknown }).comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  expect((d as { rushAdditionalCondition?: { conditionId?: string } }).rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}
