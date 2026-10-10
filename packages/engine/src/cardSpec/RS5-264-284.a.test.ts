/**
 * カード別スペック: RS-264〜RS-271（第5弾「五龍の逆鱗」ジェットデルタ〜マグ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）ほか card_1/card_3/card_4/card_6 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
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
  passEntry,
  pick,
  powerCards,
  raw,
  released,
  releasedN,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  useCard,
  zoneOf,
} from "./RS5-264-284.helpers";
import type { CardInstance, GameState, PlayerId } from "../types/game";

/** オペレーション（コマンド用）の定義。 */
function opDef(id: string, category: string | string[]): CardDefinition {
  return { id, name: id, type: "operation", category, rarity: "N", expansion: "card-spec", powerCost: 0 } as CardDefinition;
}
const OP_OT_WB = opDef("SPEC-OP-OT-WB", ["OT", "WB"]);
const WB_M = sUnit("SPEC-WB-M", { size: "M", category: "WB", bp: 4000 });
const ET_S = sUnit("SPEC-ET-S", { category: "ET" });
const MA_S = sUnit("SPEC-MA-S", { category: "MA" });
const OT_S = sUnit("SPEC-OT-S", { category: "OT" });
const S_M = sUnit("SPEC-S-M", { size: "M" });
const SPECS = [OP_OT_WB, WB_M, ET_S, MA_S, OT_S, S_M];

/** ウラ向き（ダメージ）のユニットカード。 */
function damageUnit(suffix: string): CardInstance {
  return { ...inst("TST-UNIT-0", suffix), faceDown: true };
}

/**
 * 手札からジェット（追加条件「自軍Sユニットを2体パワーゾーンに送る」）をラッシュし、
 * 「※これをラッシュしたとき…1枚選び捨札にする」の選択が開いた状態まで進める。
 */
function rushJet(cardId: "RS-264" | "RS-265", power: CardInstance[], rush: CardInstance[] = fillers(2)) {
  const s = st(
    {
      phase: "rush",
      player1: { hand: [inst(cardId, "jet")], rush, power, command: [released("TST-OP-OT", "ot")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    },
    SPECS,
  );
  return rushFromHand(s, "player1", `${cardId}:jet`);
}

function jetRushClauseTests(cardId: "RS-264" | "RS-265", page: string) {
  // 「※これをラッシュしたとき、自軍パワーゾーンにダメージ以外のカードがあれば、1枚選び捨札にする。」
  it(`${cardId}: ラッシュしたとき、自軍パワーゾーンのダメージ以外のカードを1枚選び捨札にする（強制。見送れない）（出典: ${page}「1枚選び捨札にする」）`, () => {
    const r = rushJet(cardId, powerCards(4));
    expect(r.ok).toBe(true);
    let s = r.state;
    expect(zoneOf(s, "player1", `${cardId}:jet`)).toBe("rush");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(false);
    s = pick(s, "TST-UNIT-0:fill0");
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("discard");
    expect(zoneOf(s, "player1", `${cardId}:jet`)).toBe("rush");
    expect(s.players.player1.power).toHaveLength(5);
  });

  it.fails(`${cardId}: パワーゾーンのオモテのオペレーションカード（ユニット以外）も「ダメージ以外のカード」として選べる（出典: ${page}「ダメージ以外のカード」）`, () => {
    // 既知の不具合: CARD-${cardId} 捨札にするカードの候補がユニットカードに限られ、パワーゾーンのオペレーションカードを選べない
    const r = rushJet(cardId, powerCards(4));
    expect(r.state.pendingEffectChoice?.validInstanceIds).toContain("TST-P:pw0");
  });

  it.fails(`${cardId}: ダメージになっているカードは選べない（出典: ${page}「ダメージ以外のカード」）`, () => {
    // 既知の不具合: CARD-${cardId} パワーゾーンのダメージ（ウラ向き）のユニットカードも捨札にする候補に含まれる
    const r = rushJet(cardId, [...powerCards(3), damageUnit("dmgU")]);
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("TST-UNIT-0:dmgU");
  });

  // 追加条件「自軍Sユニットを2体パワーゾーンに送る」
  it(`${cardId}: 追加条件 — 自軍 S ユニット2体をパワーゾーンに送ってラッシュする（出典: ${page}「追加条件：自軍Sユニットを2体パワーゾーンに送る」）`, () => {
    const r = rushJet(cardId, powerCards(4));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:fill0")).toBe("power");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:fill1")).toBe("power");
  });

  it(`${cardId}: 追加条件 — 自軍 S ユニットが1体しかなければラッシュできない（出典: ${page}「Sユニットを2体」）`, () => {
    const s = st(
      { phase: "rush", player1: { hand: [inst(cardId, "jet")], rush: fillers(1), power: powerCards(4), command: [released("TST-OP-OT", "ot")] } },
      SPECS,
    );
    expect(canStartRush(s, "player1", `${cardId}:jet`)).toBe(false);
    expect(rushFromHand(s, "player1", `${cardId}:jet`).ok).toBe(false);
  });

  it(`${cardId}: 追加条件 — M ユニットは S ユニットのかわりに送れない（S1体＋M1体ではラッシュできない）（出典: ${page}「自軍Sユニットを2体」）`, () => {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst(cardId, "jet")], rush: [...fillers(1), inst("SPEC-S-M", "m")], power: powerCards(4), command: [released("TST-OP-OT", "ot")] },
      },
      SPECS,
    );
    const r = rushFromHand(s, "player1", `${cardId}:jet`);
    expect(r.ok && zoneOf(r.state, "player1", `${cardId}:jet`) === "rush").toBe(false);
  });
}

// ===========================================================================
describe("RS-264 ジェットデルタ", () => {
  const TEXT = "※これをラッシュしたとき、自軍パワーゾーンにダメージ以外のカードがあれば、1枚選び捨札にする。";

  it("RS-264: カタログ本文・スペックが出典と一致（出典: atwiki/page-454）", () => {
    expectCatalogText("RS-264", TEXT);
    expectStats("RS-264", {
      name: "ジェットデルタ",
      category: "OT",
      size: "M",
      bp: 5000,
      sp: 1,
      powerCost: "4+",
      comboNumber: undefined,
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_power",
    });
  });

  it("RS-264: 必要パワー4+ — パワーが3枚ではラッシュできない（出典: atwiki/page-454「必要パワー：4+」）", () => {
    const s = st(
      { phase: "rush", player1: { hand: [inst("RS-264", "jet")], rush: fillers(2), power: powerCards(1), command: [released("TST-OP-OT", "ot")] } },
      SPECS,
    );
    // 追加条件で S ユニット2体がパワーゾーンに置かれてもパワーは3（ルール上、必要パワーは追加条件の前に満たす）
    const r = rushFromHand(s, "player1", "RS-264:jet");
    expect(r.ok && zoneOf(r.state, "player1", "RS-264:jet") === "rush").toBe(false);
  });

  jetRushClauseTests("RS-264", "atwiki/page-454");

  // faq-card-5 RS-264 Q1「はい、そのとおりです。」（カードを置く処理は1枚ずつ合計2枚）
  it.todo(
    "RS-264: 公式Q&A — 追加条件でパワーゾーンに置く処理は1枚ずつ合計2枚（出典: grnrngr/faq-card-5 RS-264 Q1）— 1枚ずつの配置を区別して観測できる公開 API（配置ごとの誘発）がないため",
  );
  it("RS-264: 公式Q&A — 追加条件の2体は2枚ともパワーゾーンに置かれる（出典: grnrngr/faq-card-5 RS-264 Q1「１枚ずつ合計２枚のカードを置く」）", () => {
    const r = rushJet("RS-264", powerCards(4));
    const p = r.state.players.player1.power.map((c) => c.instanceId);
    expect(p).toContain("TST-UNIT-0:fill0");
    expect(p).toContain("TST-UNIT-0:fill1");
    expect(r.state.players.player1.power.filter((c) => c.instanceId.startsWith("TST-UNIT-0:fill")).every((c) => !c.faceDown)).toBe(true);
  });
});

// ===========================================================================
describe("RS-265 ジェットシーカー", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍パワーゾーンにダメージ以外のカードがあれば、1枚選び捨札にする。【ラウンドレーダー】これが自軍ラッシュエリアにある間、相手が手札からオペレーションカードを使用したとき、敵軍パワーゾーンからカードを2枚まで選び捨札にしてもよい。";

  it("RS-265: カタログ本文・スペックが出典と一致（出典: atwiki/page-455）", () => {
    expectCatalogText("RS-265", TEXT);
    expectStats("RS-265", {
      name: "ジェットシーカー",
      category: "OT",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "3+",
      comboNumber: undefined,
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_power",
    });
  });

  jetRushClauseTests("RS-265", "atwiki/page-455");

  /**
   * player2 のラッシュフェイズ。player1 のラッシュエリアにジェットシーカー（jets 体）、
   * player2 は WB の M ユニットを持ち、手札の百獣アニマルハート（RS-125）を使う。
   */
  function radarState(opts: { jets?: number; jetZone?: "rush" | "battle"; p1Battle?: CardInstance[] } = {}) {
    const jets = Array.from({ length: opts.jets ?? 1 }, (_, i) => inst("RS-265", `js${i}`));
    return st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: {
          rush: opts.jetZone === "battle" ? [] : jets,
          battle: [...(opts.jetZone === "battle" ? jets : []), ...(opts.p1Battle ?? [inst("TST-UNIT-0", "e1")])],
          power: powerCards(3),
        },
        player2: {
          hand: [inst("RS-125", "ah")],
          rush: [inst("SPEC-WB-M", "m")],
          power: [...powerCards(7, "q"), ...damageCards(1, "qd")],
          command: [released("TST-OP", "c1")],
          deck: deckCards(3, "d2"),
        },
      },
      SPECS,
    );
  }
  /** 百獣アニマルハートで target を撃破する。 */
  function useAnimalHeart(s: GameState, target: string): GameState {
    let n = useCard(s, "player2", "RS-125:ah");
    if (n.pendingEffectChoice?.effectId === "animal_heart") {
      n = pick(n, target);
      n = act(n, { type: "confirm_effect_choice", playerId: "player2" });
    }
    return n;
  }
  const radarOpen = (s: GameState, owner: PlayerId = "player1") =>
    s.pendingEffectChoice?.playerId === owner && (s.pendingEffectChoice.sourceCardId === "RS-265");

  it.fails("RS-265: ラウンドレーダー — 相手が手札からオペレーションを使用したとき、敵軍パワーゾーンからカードを2枚まで選び捨札にできる（出典: atwiki/page-455【ラウンドレーダー】）", () => {
    // 既知の不具合: CARD-RS-265 【ラウンドレーダー】が実装されておらず、相手のオペレーション使用で何も起きない
    const s = useAnimalHeart(radarState(), "TST-UNIT-0:e1");
    expect(radarOpen(s)).toBe(true);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("TST-P:q0");
  });

  it.fails("RS-265: ラウンドレーダー — 「してもよい」なので捨札にしないことを選べる（出典: atwiki/page-455「捨札にしてもよい」）", () => {
    // 既知の不具合: CARD-RS-265 【ラウンドレーダー】が実装されていない（任意の選択が開かない）
    const s = useAnimalHeart(radarState(), "TST-UNIT-0:e1");
    expect(radarOpen(s)).toBe(true);
    expect(canSkip(s)).toBe(true);
    const after = skip(s);
    expect(after.players.player2.power).toHaveLength(8);
  });

  it("RS-265: ラウンドレーダー — ジェットシーカーがバトルエリアにあるときは発動しない（出典: atwiki/page-455「これが自軍ラッシュエリアにある間」）", () => {
    const s = useAnimalHeart(radarState({ jetZone: "battle" }), "TST-UNIT-0:e1");
    expect(radarOpen(s)).toBe(false);
    expect(s.players.player2.power).toHaveLength(8);
  });

  it("RS-265: ラウンドレーダー — 自分（ジェットシーカーの持ち主）がオペレーションを使用しても発動しない（出典: atwiki/page-455「相手が…使用したとき」）", () => {
    let s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-125", "ah")], rush: [inst("RS-265", "js"), inst("SPEC-WB-M", "m")], power: powerCards(8), command: [released("TST-OP", "c1")] },
        player2: { battle: [inst("TST-UNIT-0", "e1")], power: powerCards(4, "q") },
      },
      SPECS,
    );
    s = useCard(s, "player1", "RS-125:ah");
    if (s.pendingEffectChoice?.effectId === "animal_heart") {
      s = pick(s, "TST-UNIT-0:e1");
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-265");
    expect(s.players.player2.power).toHaveLength(4);
    expect(s.players.player1.power).toHaveLength(8);
  });

  // faq-card-5 RS-265 Q1「はい、発動できます。」
  it.fails("RS-265: 公式Q&A — オペレーション（百獣アニマルハート）の効果で撃破されても【ラウンドレーダー】は発動できる（出典: grnrngr/faq-card-5 RS-265 Q1）", () => {
    // 既知の不具合: CARD-RS-265 【ラウンドレーダー】が実装されていない
    const s = useAnimalHeart(radarState(), "RS-265:js0");
    expect(zoneOf(s, "player1", "RS-265:js0")).toBe("discard");
    expect(radarOpen(s)).toBe(true);
  });

  // faq-card-5 RS-265 Q2「はい、選ぶことができます。」
  it.fails("RS-265: 公式Q&A — ダメージになっている敵軍パワーゾーンのカードも選べる（出典: grnrngr/faq-card-5 RS-265 Q2）", () => {
    // 既知の不具合: CARD-RS-265 【ラウンドレーダー】が実装されていない
    const s = useAnimalHeart(radarState(), "TST-UNIT-0:e1");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("TST-P:qd0");
  });

  // faq-card-5 RS-265 Q3「はい、重複します。」
  it.fails("RS-265: 公式Q&A — ジェットシーカーが2体あれば効果は重複し、合計4枚まで捨札にできる（出典: grnrngr/faq-card-5 RS-265 Q3）", () => {
    // 既知の不具合: CARD-RS-265 【ラウンドレーダー】が実装されていない
    let s = useAnimalHeart(radarState({ jets: 2 }), "TST-UNIT-0:e1");
    for (let i = 0; i < 4; i += 1) {
      expect(radarOpen(s)).toBe(true);
      const target = s.pendingEffectChoice!.validInstanceIds[0]!;
      s = pick(s, target);
      if (s.pendingEffectChoice?.selectedInstanceIds !== undefined && s.pendingEffectChoice.sourceCardId === "RS-265" && (s.pendingEffectChoice.selectedInstanceIds?.length ?? 0) >= 2) {
        s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
      }
    }
    expect(s.players.player2.power).toHaveLength(4);
  });

  // faq-card-5 RS-265 Q4「はい、捨札にできます。」
  it.fails("RS-265: 公式Q&A — ラッシュしたジェットシーカーに相手が疾風流超忍法を使っても【ラウンドレーダー】で捨札にできる（出典: grnrngr/faq-card-5 RS-265 Q4・faq-card-1）", () => {
    // 既知の不具合: CARD-RS-265 【ラウンドレーダー】が実装されていない
    let s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-265", "js")], rush: fillers(2), power: powerCards(3), command: [released("TST-OP-OT", "ot")], deck: deckCards(3) },
        player2: { hand: [inst("RS-026", "sp")], command: releasedN(3, "TST-OP-MA"), power: powerCards(4, "q") },
      },
      SPECS,
    );
    s = raw(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-265:js" });
    for (let i = 0; i < 6 && s.pendingZordSetup; i += 1) {
      const z = s.pendingZordSetup;
      s = raw(
        s,
        z.step === "material"
          ? { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: z.validInstanceIds[0]! }
          : z.step === "destination"
            ? { type: "resolve_zord_setup", playerId: "player1", destination: "discard" }
            : { type: "resolve_zord_setup", playerId: "player1" },
      );
    }
    if (s.pendingCommandPayment) {
      const p = s.pendingCommandPayment;
      s = raw(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    s = pick(s, s.pendingEffectChoice!.validInstanceIds[0]!);
    s = useCard(s, "player2", "RS-026:sp");
    expect(zoneOf(s, "player1", "RS-265:js")).not.toBe("rush");
    expect(radarOpen(s)).toBe(true);
  });

  // faq-card-5 RS-265 Q5 / RS-325 Q「はい、発動します。」
  it.todo(
    "RS-265: 公式Q&A — 相手が天空勇者マジシャイン（RS-325）でコマンドゾーンのオペレーションを使っても【ラウンドレーダー】は発動する（出典: grnrngr/faq-card-5 RS-265 Q5・RS-325 Q3）— 【ラウンドレーダー】自体が未実装で、マジチケット経由の使用を区別する観測点がないため",
  );
  // faq-card-5 RS-265 Q6/Q7（キタネイダス）
  it.todo(
    "RS-265: 公式Q&A — 害気大臣キタネイダス（XG-034）があるバトルフェイズ中はラッシュ時の捨札効果・【ラウンドレーダー】が無効になる（出典: grnrngr/faq-card-5 RS-265 Q6・Q7）— XG-034 がカタログに存在しないため",
  );
});

// ===========================================================================
// フラッシュマン共通: 「※このユニットは、自分と相手のコマンドゾーンにある「OT」以外のコマンド1つにつき BP-1000 され、BP0以下のとき撃破される。」
type FlashId = "RS-266" | "RS-267" | "RS-268" | "RS-269" | "RS-270";
const FLASH_BP: Record<FlashId, number> = { "RS-266": 7000, "RS-267": 6000, "RS-268": 5500, "RS-269": 6000, "RS-270": 5500 };

function flashDebuffTests(id: FlashId, page: string) {
  const base = FLASH_BP[id];
  const bpWith = (p1cmd: CardInstance[], p2cmd: CardInstance[]) => {
    const s = st({ player1: { battle: [inst(id, "fl")], command: p1cmd }, player2: { command: p2cmd } }, SPECS);
    return bpOf(s, "player1", `${id}:fl`);
  };

  it(`${id}: ※ 自分と相手のコマンドゾーンの「OT」以外のコマンド1つにつき BP-1000（ホールド／リリースを問わない）（出典: ${page}「※このユニットは…BP-1000され」）`, () => {
    expect(bpWith([released("TST-OP", "c1"), held("TST-OP-MA", "c2")], [held("TST-OP-ET", "e1")])).toBe(base - 3000);
  });

  it(`${id}: ※「OT」のコマンドは数えない（出典: ${page}「「OT」以外のコマンド」）`, () => {
    expect(bpWith([released("TST-OP-OT", "c1"), held("TST-OP-OT", "c2")], [held("TST-OP-OT", "e1")])).toBe(base);
  });

  it(`${id}: ※ BP0 以下になると撃破される（出典: ${page}「BP0以下のとき撃破される」）`, () => {
    const n = Math.ceil(base / 1000);
    let s = st(
      {
        player1: { rush: [inst(id, "fl")], command: releasedN(Math.ceil(n / 2), "TST-OP", "a") },
        player2: { command: releasedN(n - Math.ceil(n / 2), "TST-OP-ET", "b") },
      },
      SPECS,
    );
    s = enter(s, `${id}:fl`);
    expect(zoneOf(s, "player1", `${id}:fl`)).toBe("discard");
  });
}

function flashStatsTest(id: FlashId, name: string, cn: number, sp: "special" | undefined, cost: number, features: string[], text: string, page: string) {
  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, text);
    expectStats(id, { name, category: "OT", size: "S", bp: FLASH_BP[id], sp, powerCost: cost, comboNumber: cn, features });
  });
}

/** CN の位置に出す（battle に pos-1 体）。 */
function ncEnter(id: string, pos: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
  const s = st(
    { player1: { battle: fillers(pos - 1), ...p1, rush: [inst(id, "x"), ...(p1.rush ?? [])] }, player2: { deck: deckCards(3, "e"), ...p2 } },
    SPECS,
  );
  return enter(s, `${id}:x`);
}

/** プリズム聖剣／カイザー／バトン: NC で自軍ラッシュエリアの指定カテゴリのユニットをパワーゾーンに送れば SP1。 */
function prismSendTests(id: "RS-266" | "RS-268" | "RS-269", cn: number, okUnit: string, ngUnit: string, catLabel: string, page: string, effect: string) {
  it(`${id}: ${effect} — NC 成立時、自軍ラッシュエリアの「${catLabel}」のユニットだけを選んでパワーゾーンに送れる（出典: ${page}）`, () => {
    let s = ncEnter(id, cn, { rush: [inst(okUnit, "ok"), inst(ngUnit, "ng")] });
    expect(choiceIds(s)).toEqual([`${okUnit}:ok`]);
    s = pick(s, `${okUnit}:ok`);
    expect(zoneOf(s, "player1", `${okUnit}:ok`)).toBe("power");
    expect(zoneOf(s, "player1", `${ngUnit}:ng`)).toBe("rush");
  });

  it.fails(`${id}: ${effect} — 送ったとき、このターン「SP1」になりストライクできる（出典: ${page}「そうしたとき、このターン、これは「SP1」になる」）`, () => {
    // 既知の不具合: CARD-${id} NC でユニットをパワーゾーンに送っても SP1 にならず、ストライクできない
    let s = ncEnter(id, cn, { rush: [inst(okUnit, "ok")] });
    s = pick(s, `${okUnit}:ok`);
    expect(spOf(s, "player1", `${id}:x`)).toBe(1);
    expect(canStrike(s, `${id}:x`)).toBe(true);
  });

  it(`${id}: ${effect} — 「送ってもよい」ので見送れる（見送ると SP！のまま）（出典: ${page}「送ってもよい」）`, () => {
    let s = ncEnter(id, cn, { rush: [inst(okUnit, "ok")] });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", `${okUnit}:ok`)).toBe("rush");
    expect(spOf(s, "player1", `${id}:x`)).toBe(0);
  });

  it(`${id}: ${effect} — 「${catLabel}」のユニットがラッシュエリアになければ SP1 にならない（出典: ${page}「「${catLabel}」のユニットを1体選び」）`, () => {
    const s = ncEnter(id, cn, { rush: [inst(ngUnit, "ng")] });
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain(`${ngUnit}:ng`);
    expect(spOf(s, "player1", `${id}:x`)).toBe(0);
  });

  it(`${id}: ${effect} — NC 不成立（${cn === 1 ? 2 : 1}番目）では発動しない（出典: ${page}「CN：${cn}」・R-CN-02）`, () => {
    const s = ncEnter(id, cn === 1 ? 2 : 1, { rush: [inst(okUnit, "ok")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
    expect(zoneOf(s, "player1", `${okUnit}:ok`)).toBe("rush");
    expect(spOf(s, "player1", `${id}:x`)).toBe(0);
  });

  it(`${id}: ${effect} —「このターン」SP1。次の自軍ターンには SP！に戻る（出典: ${page}「このターン、これは「SP1」になる」）`, () => {
    let s = ncEnter(id, cn, { rush: [inst(okUnit, "ok")], deck: deckCards(5) });
    s = pick(s, `${okUnit}:ok`);
    s = passEntry(s);
    s = endTurn(s);
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    const c = s.players.player1.battle.find((x) => x.instanceId === `${id}:x`) ?? s.players.player1.rush.find((x) => x.instanceId === `${id}:x`);
    expect(c).toBeDefined();
    expect(spOf(s, "player1", `${id}:x`)).toBe(0);
  });
}

// ===========================================================================
describe("RS-266 レッドフラッシュ", () => {
  const TEXT =
    "※このユニットは、自分と相手のコマンドゾーンにある「OT」以外のコマンド1つにつきBP-1000され、BP0以下のとき撃破される。【プリズム聖剣】自軍ラッシュエリアから、「WB」のユニットを1体選び自軍パワーゾーンに送ってもよい。そうしたとき、このターン、これは「SP1」になる。";
  flashStatsTest("RS-266", "レッドフラッシュ", 2, "special", 3, ["レッド", "男"], TEXT, "atwiki/page-127");
  flashDebuffTests("RS-266", "atwiki/page-127");
  prismSendTests("RS-266", 2, "TST-UNIT-0", "SPEC-ET-S", "WB", "atwiki/page-127", "【プリズム聖剣】");

  // faq-card-5（RS-266 の Q&A。atwiki/page-127 Q1）「はい、その通りです。「ＯＴ以外」とは「ＯＴではないカテゴリを持つ」という意味です。」
  it("RS-266: Q&A — OT を含むマルチカテゴリ（OT/WB）のコマンドも1つにつき BP-1000 される（出典: atwiki/page-127 Q1）", () => {
    const s = st({ player1: { battle: [inst("RS-266", "fl")], command: [held("SPEC-OP-OT-WB", "m1")] }, player2: { command: [released("SPEC-OP-OT-WB", "m2")] } }, SPECS);
    expect(bpOf(s, "player1", "RS-266:fl")).toBe(5000);
  });
});

describe("RS-267 ブルーフラッシュ", () => {
  const TEXT =
    "※このユニットは、自分と相手のコマンドゾーンにある「OT」以外のコマンド1つにつき「BP-1000」され、BP0以下のとき撃破される。【プリズムボール】「SP1」";
  flashStatsTest("RS-267", "ブルーフラッシュ", 4, "special", 2, ["ブルー", "男"], TEXT, "atwiki/page-448");
  flashDebuffTests("RS-267", "atwiki/page-448");

  it("RS-267: 【プリズムボール】4番目に出て NC が成立すると「SP1」（出典: atwiki/page-448「CN：4」「SP1」）", () => {
    expect(spOf(ncEnter("RS-267", 4), "player1", "RS-267:x")).toBe(1);
  });
  it("RS-267: NC 不成立（3番目）では SP！のまま（ストライクできない）（出典: atwiki/page-448「SP：！」・R-CN-02）", () => {
    expect(spOf(ncEnter("RS-267", 3), "player1", "RS-267:x")).toBe(0);
  });
  it("RS-267: Q&A — OT を含むマルチカテゴリのコマンドも BP-1000 の対象（出典: atwiki/page-448 Q1（RS-266 の公式Q&A を転載））", () => {
    const s = st({ player1: { battle: [inst("RS-267", "fl")], command: [held("SPEC-OP-OT-WB", "m1")] } }, SPECS);
    expect(bpOf(s, "player1", "RS-267:fl")).toBe(5000);
  });
});

describe("RS-268 グリーンフラッシュ", () => {
  const TEXT =
    "※このユニットは、自分と相手のコマンドゾーンにある「OT」以外のコマンド1つにつき「BP-1000」され、BP0以下のとき撃破される。【プリズムカイザー】自軍ラッシュエリアから、「ET」のユニットを1体選び自軍パワーゾーンに送ってもよい。そうしたとき、このターン、これは「SP1」になる。";
  flashStatsTest("RS-268", "グリーンフラッシュ", 5, "special", 1, ["グリーン", "男"], TEXT, "atwiki/page-449");
  flashDebuffTests("RS-268", "atwiki/page-449");
  prismSendTests("RS-268", 5, "SPEC-ET-S", "SPEC-MA-S", "ET", "atwiki/page-449", "【プリズムカイザー】");
  it("RS-268: Q&A — OT を含むマルチカテゴリのコマンドも BP-1000 の対象（出典: atwiki/page-449 Q1）", () => {
    const s = st({ player1: { battle: [inst("RS-268", "fl")] }, player2: { command: [held("SPEC-OP-OT-WB", "m1")] } }, SPECS);
    expect(bpOf(s, "player1", "RS-268:fl")).toBe(4500);
  });
});

describe("RS-269 イエローフラッシュ", () => {
  const TEXT =
    "※このユニットは、自分と相手のコマンドゾーンにある「OT」以外のコマンド1つにつき「BP-1000」され、BP0以下のとき撃破される。【プリズムバトン】自軍ラッシュエリアから、「MA」のユニットを1体選び自軍パワーゾーンに送ってもよい。そうしたとき、このターン、これは「SP1」になる。";
  flashStatsTest("RS-269", "イエローフラッシュ", 3, "special", 2, ["イエロー", "女"], TEXT, "atwiki/page-450");
  flashDebuffTests("RS-269", "atwiki/page-450");
  prismSendTests("RS-269", 3, "SPEC-MA-S", "SPEC-OT-S", "MA", "atwiki/page-450", "【プリズムバトン】");
  it("RS-269: Q&A — OT を含むマルチカテゴリのコマンドも BP-1000 の対象（出典: atwiki/page-450 Q1）", () => {
    const s = st({ player1: { battle: [inst("RS-269", "fl")], command: [released("SPEC-OP-OT-WB", "m1")] } }, SPECS);
    expect(bpOf(s, "player1", "RS-269:fl")).toBe(5000);
  });
});

// ===========================================================================
describe("RS-270 ピンクフラッシュ", () => {
  const TEXT =
    "※このユニットは、自分と相手のコマンドゾーンにある「OT」以外のコマンド1つにつき「BP-1000」され、BP0以下のとき撃破される。【プリズムブーツ】このターン、自分と相手のコマンドゾーンにあるホールド状態のコマンドのカテゴリは、すべて「OT」になる（ただし、「オーバーテクノロジー」をホールドしたことにはならない）。";
  flashStatsTest("RS-270", "ピンクフラッシュ", 1, undefined, 1, ["ピンク", "女"], TEXT, "atwiki/page-451");
  flashDebuffTests("RS-270", "atwiki/page-451");

  const cmds = () => ({
    p1: [held("TST-OP", "h1"), released("TST-OP", "r1")],
    p2: [held("TST-OP-ET", "h2"), released("TST-OP-MA", "r2")],
  });

  it("RS-270: 【プリズムブーツ】NC 成立後、両軍のホールド状態のコマンドは「OT」になり、フラッシュマンの BP-1000 はリリース状態の分だけになる（出典: atwiki/page-451【プリズムブーツ】）", () => {
    const c = cmds();
    const s = ncEnter("RS-270", 1, { command: c.p1 }, { command: c.p2 });
    expect(bpOf(s, "player1", "RS-270:x")).toBe(5500 - 2000);
  });

  it("RS-270: 【プリズムブーツ】NC 成立後、ホールド状態の非 OT コマンドを「OT」の自軍コマンドとしてバイオロボ【バイオ粒子斬り】に使える（出典: atwiki/page-451・grnrngr/faq-card-5 RS-270 Q1・faq-card-3 RS-127）", () => {
    let s = ncEnter("RS-270", 1, { command: [held("TST-OP", "h1"), held("TST-OP-ET", "h2")], rush: [inst("RS-127", "bio")] });
    s = passEntry(s);
    s = enter(s, "RS-127:bio");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-127");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:h2", "TST-OP:h1"]);
  });

  it("RS-270: 【プリズムブーツ】リリース状態のコマンドは「OT」にならない（バイオ粒子斬りの候補にならない）（出典: atwiki/page-451「ホールド状態のコマンドのカテゴリは」）", () => {
    let s = ncEnter("RS-270", 1, { command: [released("TST-OP", "r1"), released("TST-OP-ET", "r2")], rush: [inst("RS-127", "bio")] });
    s = passEntry(s);
    s = enter(s, "RS-127:bio");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-127");
  });

  it("RS-270: 【プリズムブーツ】NC 不成立（2番目）ではホールド状態のコマンドは「OT」にならない（出典: atwiki/page-451「CN：1」・R-CN-02）", () => {
    let s = ncEnter("RS-270", 2, { command: [held("TST-OP", "h1"), held("TST-OP-ET", "h2")], rush: [inst("RS-127", "bio")] });
    s = passEntry(s);
    s = enter(s, "RS-127:bio");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-127");
  });

  it("RS-270: 【プリズムブーツ】効果は「このターン」だけ。次の自軍ターンには元のカテゴリに戻る（出典: atwiki/page-451「このターン」）", () => {
    let s = ncEnter("RS-270", 1, { command: [held("TST-OP", "h1"), held("TST-OP-ET", "h2")], deck: deckCards(6) }, { deck: deckCards(6, "e") });
    s = passEntry(s);
    s = endTurn(s);
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    // スタートフェイズでリリースされたのでホールドしなおす状況を作る
    s = {
      ...s,
      players: {
        ...s.players,
        player1: {
          ...s.players.player1,
          command: s.players.player1.command.map((c) => ({ ...c, commandHeld: true })),
          rush: [...s.players.player1.rush, inst("RS-127", "bio")],
          battle: s.players.player1.battle.filter((c) => c.cardId !== "RS-270"),
        },
      },
    };
    s = enter(s, "RS-127:bio");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-127");
  });

  it.todo(
    "RS-270: 【プリズムブーツ】「ただし、「オーバーテクノロジー」をホールドしたことにはならない」— 「OT をホールドしたとき」を条件とするカードがこの範囲の公開 API で観測できないため",
  );

  // faq-card-5 RS-270 Q1「はい、発動できます。」（上のバイオ粒子斬りのテストで確認）
  // faq-card-5 RS-270 Q2「はい、発動できます。」（ダイナモビル・OT 以外のカウンター）
  it("RS-270: 公式Q&A — プリズムブーツ発動後も、相手はダイナモビル【迎撃モビルミサイル】を発動できる（出典: grnrngr/faq-card-5 RS-270 Q2・faq-card-4 RS-196）", () => {
    let s = ncEnter(
      "RS-270",
      1,
      { command: [held("TST-OP", "h1")], rush: [inst("TST-UNIT-0", "st")] },
      { rush: [inst("RS-196", "mob")], command: [...releasedN(2, "TST-OP-ET", "et"), held("TST-OP-MA", "hm")] },
    );
    s = passEntry(s);
    s = enter(s, "TST-UNIT-0:st");
    s = act(s, { type: "strike", playerId: "player1", instanceId: "TST-UNIT-0:st" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-196");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
  });

  it("RS-270: 公式Q&A — プリズムブーツ発動後も、相手は OT 以外のカウンター（隠流忍術・MA）を使える（出典: grnrngr/faq-card-5 RS-270 Q2）", () => {
    let s = ncEnter(
      "RS-270",
      1,
      { command: [held("TST-OP", "h1")] },
      { battle: [inst("TST-UNIT-0", "def"), inst("TST-UNIT-0", "sub")], hand: [inst("RS-018", "nin")], command: [...releasedN(4, "TST-OP-MA", "ma")], power: powerCards(4, "q") },
    );
    s = attack(s, "RS-270:x", "TST-UNIT-0:def");
    const can = legal(s).some(
      (a) =>
        (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-018:nin") ||
        (a.type === "play_counter" && a.instanceId === "RS-018:nin"),
    );
    expect(can).toBe(true);
  });
});

// ===========================================================================
describe("RS-271 マグ", () => {
  const TEXT =
    "※これはバトルエリアに出られない。【修復作業】これが自軍ラッシュエリアにある間、自軍スタートフェイズ中、このユニットを捨札にしてもよい。そうしたとき、自軍パワーゾーンからダメージになっているカードを1枚選びオモテにする。";

  it("RS-271: カタログ本文・スペックが出典と一致（出典: atwiki/page-447）", () => {
    expectCatalogText("RS-271", TEXT);
    expectStats("RS-271", {
      name: "マグ",
      category: "OT",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 3,
      comboNumber: undefined,
      features: ["メカ", "人型"],
    });
  });

  it("RS-271: ※ バトルエリアに出られない（出典: atwiki/page-447「※これはバトルエリアに出られない。」）", () => {
    const s = st({ player1: { rush: [inst("RS-271", "mg"), inst("TST-UNIT-0", "u")] } });
    expect(canEnter(s, "RS-271:mg")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:u")).toBe(true);
  });

  /** 自軍スタートフェイズ、マグがラッシュエリアにあり、パワーゾーンにダメージ2枚。 */
  function magStart() {
    return st({
      phase: "start",
      player1: { rush: [inst("RS-271", "mg")], power: [...powerCards(2), ...damageCards(2)], command: [held("TST-OP", "c1")], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
  }
  const magActions = (s: GameState) =>
    (legal(s) as unknown as Record<string, unknown>[]).filter(
      (a) => a.sourceInstanceId === "RS-271:mg" || a.instanceId === "RS-271:mg" || (s.pendingEffectChoice?.sourceCardId === "RS-271"),
    );

  it.fails("RS-271: 【修復作業】自軍スタートフェイズ中、ラッシュエリアのマグを捨札にして、ダメージ1枚をオモテにできる（出典: atwiki/page-447【修復作業】）", () => {
    // 既知の不具合: CARD-RS-271 【修復作業】が実装されていない（スタートフェイズにマグを捨札にする選択肢がない）
    let s = magStart();
    let found = magActions(s).length > 0;
    if (!found) {
      s = act(s, { type: "release_start_commands", playerId: "player1" });
      found = magActions(s).length > 0;
    }
    expect(found).toBe(true);
  });

  it("RS-271: 【修復作業】「捨札にしてもよい」— 使わずにスタートフェイズを終えられ、マグはラッシュエリアに残る（出典: atwiki/page-447「捨札にしてもよい」）", () => {
    let s = magStart();
    s = toPhase(s, "player1", "battle");
    expect(zoneOf(s, "player1", "RS-271:mg")).toBe("rush");
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(2);
  });

  it("RS-271: 【修復作業】敵軍スタートフェイズには使えない（出典: atwiki/page-447「自軍スタートフェイズ中」）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "start",
      player1: { rush: [inst("RS-271", "mg")], power: damageCards(2) },
      player2: { deck: deckCards(5, "e") },
    });
    expect(magActions(s)).toHaveLength(0);
    s = toPhase(s, "player2", "battle");
    expect(zoneOf(s, "player1", "RS-271:mg")).toBe("rush");
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(2);
  });

  // faq-card-6 RS-350 Q「はい、できます。」
  it.todo(
    "RS-271: 公式Q&A — 暗黒の鎧（RS-350）に重ねたマグを【修復作業】で捨札にしたとき、ダメージとして置かれた暗黒の鎧をオモテにできる（出典: grnrngr/faq-card-6 RS-350）— 【修復作業】が未実装で発動させる手段がないため",
  );
});
