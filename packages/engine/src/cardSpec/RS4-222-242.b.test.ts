/**
 * カード別スペック: RS-230〜RS-235（第4弾「四雄の覚醒」アバレッドAM〜デカベースロボ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）
 *     ほか card_1/card_3 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  passEntry,
  pick,
  powerCards,
  raw,
  released,
  releasedN,
  rushFromHand,
  rushVia,
  settle,
  spOf,
  st,
  sUnit,
  toPhase,
  tryAct,
  useCard,
  zoneOf,
} from "./RS4-222-242.helpers";
import type { CardInstance, GameState } from "../types/game";

const E9 = sUnit("SPEC-E9", { bp: 9000 });
const WB_M3 = sUnit("SPEC-WB-M3", { size: "M", category: "WB", bp: 3000, sp: undefined });
const WB_M4 = sUnit("SPEC-WB-M4", { size: "M", category: "WB", bp: 4000, sp: undefined });
const WB_M5 = sUnit("SPEC-WB-M5", { size: "M", category: "WB", bp: 5000, sp: undefined });
const WB_M5SP = sUnit("SPEC-WB-M5SP", { size: "M", category: "WB", bp: 5000, sp: 1 });
const ET_M5 = sUnit("SPEC-ET-M5", { size: "M", category: "ET", bp: 5000, sp: undefined });
const WB_S5 = sUnit("SPEC-WB-S5", { size: "S", category: "WB", bp: 5000, sp: undefined });
const SPECS = [E9, WB_M3, WB_M4, WB_M5, WB_M5SP, ET_M5, WB_S5];

/** 敵軍（player2）ターンに player2 の BP9000 が player1 のユニットにアタックする（撃破の直後で止める）。 */
function attackedInEnemyTurn(p1: Partial<GameState["players"]["player1"]>, targetId: string, p2: Partial<GameState["players"]["player2"]> = {}) {
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { battle: [inst("SPEC-E9", "atk")], deck: deckCards(5, "e"), ...p2 },
    },
    SPECS,
  );
  return settle(attack(s, "SPEC-E9:atk", targetId, "player2"));
}

/** 上の続き。player1 の選択は prefer を優先して解決する。 */
function destroyedInEnemyTurn(
  p1: Partial<GameState["players"]["player1"]>,
  targetId: string,
  p2: Partial<GameState["players"]["player2"]> = {},
  prefer: string[] = [],
) {
  let s = attackedInEnemyTurn(p1, targetId, p2);
  for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player1", prefer), "player2"));
  return s;
}

/** 撃破されて捨札になったときの ※ 効果（AM 系）と追加条件の共通テスト。bugs に挙げたテストは it.fails。 */
function amReanimateTests(
  id: string,
  partnerId: string,
  partnerName: string,
  page: string,
  bugs: { reanimate?: string; onlyPartner?: string; none?: string } = {},
) {
  const t = (bug: string | undefined) => (bug ? it.fails : it);

  t(bugs.reanimate)(`${id}: ※ 撃破されて捨札になったとき、自軍捨札の「${partnerName}」を1枚選び自軍ラッシュエリアに出す（出典: ${page}）`, () => {
    const s = destroyedInEnemyTurn(
      { battle: [inst(id, "am")], discard: [inst("TST-UNIT-0", "other"), inst(partnerId, "p")] },
      `${id}:am`,
      {},
      [`${partnerId}:p`],
    );
    expect(zoneOf(s, "player1", `${id}:am`)).toBe("discard");
    expect(zoneOf(s, "player1", `${partnerId}:p`)).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  t(bugs.onlyPartner)(`${id}: ※ 選べるのは「${partnerName}」のカードだけ（ほかのユニットカードや自身は選べない）で、出さないことは選べない（出典: ${page}「「${partnerName}」のカード」「出す」）`, () => {
    let s = attackedInEnemyTurn(
      { battle: [inst(id, "am")], discard: [inst("TST-UNIT-0", "other"), inst(partnerId, "p")] },
      `${id}:am`,
    );
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== id; i++) s = settle(drain(drain(s, "player2"), "player1"));
    if (s.pendingEffectChoice?.sourceCardId === id) {
      expect(choiceIds(s)).toEqual([`${partnerId}:p`]);
      expect(canSkip(s)).toBe(false);
      s = pick(s, `${partnerId}:p`);
    }
    s = settle(s);
    expect(zoneOf(s, "player1", `${partnerId}:p`)).toBe("rush");
    expect(s.players.player1.rush).toHaveLength(1);
  });

  t(bugs.none)(`${id}: ※ 自軍捨札に「${partnerName}」がなければ何も出さない（出典: ${page}）`, () => {
    const s = destroyedInEnemyTurn({ battle: [inst(id, "am")], discard: [inst("TST-UNIT-0", "other")] }, `${id}:am`);
    expect(zoneOf(s, "player1", `${id}:am`)).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  t(bugs.none)(`${id}: ※ 敵軍の捨札にある「${partnerName}」は出さない（出典: ${page}「自軍捨札」）`, () => {
    const s = destroyedInEnemyTurn({ battle: [inst(id, "am")] }, `${id}:am`, { discard: [inst(partnerId, "ep")] });
    expect(zoneOf(s, "player2", `${partnerId}:ep`)).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it(`${id}: 追加条件 — 自軍「${partnerName}」1体を捨札にすれば必要パワー0でラッシュできる（出典: ${page}）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "am")], rush: [inst(partnerId, "p")], command: releasedN(1), power: [] } });
    const r = rushVia(s, "player1", `${id}:am`, (a) => a.zordMaterialInstanceId === `${partnerId}:p`);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:am`)).toBe("rush");
    expect(zoneOf(r.state, "player1", `${partnerId}:p`)).toBe("discard");
  });

  it(`${id}: 必要パワー7- — 「${partnerName}」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst(id, "am")], command: releasedN(1), power: powerCards(n) } });
    expect(canStartRush(mk(6), "player1", `${id}:am`)).toBe(false);
    const r = rushFromHand(mk(7), "player1", `${id}:am`);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:am`)).toBe("rush");
  });
}

// ===========================================================================
describe("RS-230 アバレッドAM", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。※これが撃破されて捨札になったとき、自軍捨札に「アバレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【アバレスラッシュ】「SP1」";

  it("RS-230: カタログ本文・スペックが出典と一致（出典: atwiki/page-72）", () => {
    expectCatalogText("RS-230", TEXT);
    expectStats("RS-230", {
      name: "アバレッドAM",
      category: "WB",
      size: "S",
      bp: 5500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 2,
      features: ["レッド", "男", "アバレモード"],
      rushCondition: "zord_down_discard_named",
    });
  });

  amReanimateTests("RS-230", "RS-054", "アバレッド", "atwiki/page-72");

  // 「※これは毎ターン、可能ならバトルエリアに出る。」
  it("RS-230: ※ バトルエリアに出られるのに出さずにバトルフェイズを終えることはできない（出典: atwiki/page-72）", () => {
    const s = st({ player1: { rush: [inst("RS-230", "am"), inst("TST-UNIT-0", "u")] } });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
    expect(canEnter(s, "RS-230:am")).toBe(true);
  });

  // 「【アバレスラッシュ】「SP1」」（CN2）
  it("RS-230: 2番目に出て NC が成立すると「SP1」、1番目なら SP！のまま（出典: atwiki/page-72）", () => {
    const two = enter(st({ player1: { battle: fillers(1), rush: [inst("RS-230", "am")] } }), "RS-230:am");
    expect(spOf(two, "player1", "RS-230:am")).toBe(1);
    expect(canStrike(two, "RS-230:am")).toBe(true);
    const one = enter(st({ player1: { rush: [inst("RS-230", "am")] } }), "RS-230:am");
    expect(spOf(one, "player1", "RS-230:am")).toBe(0);
    expect(canStrike(one, "RS-230:am")).toBe(false);
  });

  // faq-card-4 RS-230 Q1「「RS-027 ダイノガッツ」で山札から捨札にするのは７枚になります。」
  it("RS-230: 公式Q&A — 追加条件で必要パワー0としてラッシュしていても、ダイノガッツで山札から捨札にするのは7枚（出典: grnrngr/faq-card-4 RS-230 Q1・faq-card-1 RS-027）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-230", "am")], hand: [inst("RS-027", "dg")], command: [released("TST-OP", "w")], deck: deckCards(10) },
        player2: { battle: [inst("SPEC-E9", "atk")] },
      },
      SPECS,
    );
    s = attack(s, "SPEC-E9:atk", "RS-230:am", "player2");
    s = settle(useCard(s, "player1", "RS-027:dg"));
    expect(zoneOf(s, "player1", "RS-230:am")).toBe("battle");
    expect(s.players.player1.deck).toHaveLength(3);
  });

  // faq-card-4 RS-230 Q2「はい、出す事ができます。」
  it("RS-230: 公式Q&A — シーロンの光で選ばれたアバレッドAM は、パワー6以下でもラッシュエリアのアバレッドを捨札にして出せる（出典: grnrngr/faq-card-4 RS-230 Q2・faq-card-1 RS-013）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-230", "am")], operation: [inst("RS-013", "sh")], rush: [inst("RS-054", "red")], power: powerCards(6), deck: deckCards(3) },
    });
    s = act(s, { type: "shiron_light", playerId: "player1", operationInstanceId: "RS-013:sh" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-230:am" });
    s = act(s, { type: "confirm_shiron_reveal", playerId: "player2" });
    const rush = legalOfType(s, "rush").find((a) => a.instanceId === "RS-230:am");
    if (rush) s = act(s, rush);
    else {
      const z = legal(s).find((a) => a.type === "begin_zord_setup" && a.zordInstanceId === "RS-230:am");
      expect(z).toBeDefined();
      s = drain(act(s, z!), "player1");
    }
    expect(zoneOf(s, "player1", "RS-230:am")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("discard");
  });

  // faq-card-4 RS-230 Q3/Q4「はい、その通りです。」
  it("RS-230: 公式Q&A — 超電子レーダーがあるとき、捨札から出たアバレッドについて持ち主はパワーゾーンのオモテ向きのカードを1枚手札に加える（出典: grnrngr/faq-card-4 RS-230 Q3・Q4）", () => {
    const s = destroyedInEnemyTurn(
      { battle: [inst("RS-230", "am")], discard: [inst("RS-054", "red")], power: powerCards(2, "own") },
      "RS-230:am",
      { operation: [inst("RS-124", "radar")] },
    );
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("rush");
    expect(s.players.player1.hand.filter((c) => c.cardId === "TST-P")).toHaveLength(1);
    expect(s.players.player1.power).toHaveLength(1);
  });

  // faq-card-4 RS-230 Q5「同時タイミングで発動した処理はターンプレイヤーが任意の順番で実行できます」
  it.todo(
    "RS-230: 公式Q&A — オーグリーンの NC で敵軍アバレッドAM を撃破したとき、ダメージにして置く処理とアバレッドが戻る処理の順番はターンプレイヤーが選べる（出典: grnrngr/faq-card-4 RS-230 Q5）— オーグリーン（RS-212、BP3000）が BP5500 のアバレッドAM をバトルで撃破する盤面に、さらに同時誘発の順番選択（simultaneous_order）が開くかどうかを公開 API だけで安定して組み立てられなかった（オーグリーン側の処理は RS-212 の担当範囲）",
  );
});

// ===========================================================================
describe("RS-231 アバレブルーAM", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札から「アバレブルー」のカードを1枚選び、自軍ラッシュエリアに出す。【アバレタックル】「SP1」";

  it("RS-231: カタログ本文・スペックが出典と一致（出典: atwiki/page-373）", () => {
    expectCatalogText("RS-231", TEXT);
    expectStats("RS-231", {
      name: "アバレブルーAM",
      category: "WB",
      size: "S",
      bp: 4500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 2,
      features: ["ブルー", "男", "アバレモード"],
      rushCondition: "zord_down_discard_named",
    });
  });

  amReanimateTests("RS-231", "RS-055", "アバレブルー", "atwiki/page-373");

  it("RS-231: 2番目に出て NC が成立すると「SP1」、1番目なら SP！のまま（出典: atwiki/page-373「【アバレタックル】「SP1」」）", () => {
    const two = enter(st({ player1: { battle: fillers(1), rush: [inst("RS-231", "am")] } }), "RS-231:am");
    expect(spOf(two, "player1", "RS-231:am")).toBe(1);
    expect(canStrike(two, "RS-231:am")).toBe(true);
    const one = enter(st({ player1: { rush: [inst("RS-231", "am")] } }), "RS-231:am");
    expect(canStrike(one, "RS-231:am")).toBe(false);
  });

  it("RS-231: 「毎ターン可能ならバトルエリアに出る」の注記はない（出さずにバトルフェイズを終えられる）（出典: atwiki/page-373）", () => {
    const s = st({ player1: { rush: [inst("RS-231", "am")] } });
    expect(legalOfType(s, "end_phase").length).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe("RS-232 アバレイエローAM", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「アバレイエロー」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【アバレウィング】これがアタックするとき、これはBP+1000され、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。";

  it("RS-232: カタログ本文・スペックが出典と一致（出典: atwiki/page-374）", () => {
    expectCatalogText("RS-232", TEXT);
    expectStats("RS-232", {
      name: "アバレイエローAM",
      category: "WB",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 3,
      features: ["イエロー", "女", "アバレモード"],
      rushCondition: "zord_down_discard_named",
    });
  });

  amReanimateTests("RS-232", "RS-104", "アバレイエロー", "atwiki/page-374");

  /**
   * イエローAM を pos 番目に出し、敵軍の気力（RS-017。敵軍から見て「敵軍ターン中」＝自軍ターン、リリース状態のコマンド2つで
   * S ユニット BP+2000）で BP7000 になった本来 BP5000 の S ユニットにアタックする。
   */
  function wingAttack(pos: number) {
    let s = st(
      {
        player1: { battle: fillers(pos - 1), rush: [inst("RS-232", "am")] },
        player2: { battle: [inst("SPEC-WB-S5", "d")], operation: [inst("RS-017", "kiryoku")], command: releasedN(2, "TST-OP", "ec") },
      },
      SPECS,
    );
    s = enter(s, "RS-232:am");
    expect(bpOf(s, "player2", "SPEC-WB-S5:d")).toBe(7000);
    return settle(attack(s, "RS-232:am", "SPEC-WB-S5:d"));
  }

  // 「【アバレウィング】これがアタックするとき、これはBP+1000され、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」（CN3）
  it("RS-232: 3番目に出て NC が成立していれば、アタックするとき BP5500 になり、敵軍ユニットを本来の BP（5000）としてバトルして勝つ（出典: atwiki/page-374）", () => {
    const s = wingAttack(3);
    expect(zoneOf(s, "player2", "SPEC-WB-S5:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-232:am")).toBe("battle");
  });

  // CN3 の欄の効果なので NC が成立していなければ働かない（R-CN-02）。
  it("RS-232: 3番目以外（1番目）に出たときは【アバレウィング】が働かず、BP4500 で BP7000 の敵軍ユニットに負ける（出典: atwiki/page-374「CN：3」・R-CN-02）", () => {
    const s = wingAttack(1);
    expect(zoneOf(s, "player1", "RS-232:am")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WB-S5:d")).toBe("battle");
  });

  it("RS-232: BP+1000 はアタックするときだけ（アタックしていないときは BP4500）（出典: atwiki/page-374「これがアタックするとき」）", () => {
    const s = enter(st({ player1: { battle: fillers(2), rush: [inst("RS-232", "am")] } }), "RS-232:am");
    expect(bpOf(s, "player1", "RS-232:am")).toBe(4500);
  });
});

// ===========================================================================
describe("RS-233 アバレブラック", () => {
  const TEXT =
    "【ダイノスラスター】「SP1」敵軍コマンドゾーンのカテゴリの数が、自軍コマンドゾーンのカテゴリの数より多ければ、相手は同じ数になるまで自分自身のコマンドゾーンからカードを選び、捨札にする。";

  it("RS-233: カタログ本文・スペックが出典と一致（出典: atwiki/page-375）", () => {
    expectCatalogText("RS-233", TEXT);
    expectStats("RS-233", {
      name: "アバレブラック",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["ブラック", "男"],
    });
  });

  function black(pos: number, own: CardInstance[], enemy: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) {
    const s = st({
      player1: { battle: fillers(pos - 1), rush: [inst("RS-233", "bk")], command: own },
      player2: { command: enemy, ...p2 },
    });
    return enter(s, "RS-233:bk");
  }
  const enemyCats = (s: GameState) => new Set(s.players.player2.command.map((c) => s.definitions[c.cardId]?.category as string)).size;

  // 「敵軍コマンドゾーンのカテゴリの数が、自軍…より多ければ、相手は同じ数になるまで自分自身のコマンドゾーンからカードを選び、捨札にする」
  it("RS-233: 2番目に出て NC が成立すると「SP1」になり、敵軍のカテゴリ数（3）が自軍（1）より多ければ相手が選んで捨札にし1にする（出典: atwiki/page-375）", () => {
    let s = black(2, [released("TST-OP", "own")], [released("TST-OP", "w"), released("TST-OP-ET", "e"), released("TST-OP-MA", "m"), released("TST-OP-MA", "m2")]);
    expect(spOf(s, "player1", "RS-233:bk")).toBe(1);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    for (let i = 0; i < 6 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const p = s.pendingEffectChoice;
      const pickId = ["TST-OP:w", "TST-OP-ET:e"].find((x) => p.validInstanceIds.includes(x)) ?? p.validInstanceIds[0]!;
      const r = tryAct(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: pickId });
      if (!r.ok) {
        s = act(s, { type: "confirm_effect_choice", playerId: "player2" });
        break;
      }
      s = r.state;
    }
    if (s.pendingEffectChoice?.playerId === "player2") s = act(s, { type: "confirm_effect_choice", playerId: "player2" });
    expect(enemyCats(s)).toBe(1);
    expect(s.players.player2.command.map((c) => c.instanceId).sort()).toEqual(["TST-OP-MA:m", "TST-OP-MA:m2"]);
    expect(zoneOf(s, "player2", "TST-OP:w")).toBe("discard");
  });

  it("RS-233: 敵軍のカテゴリ数が自軍以下なら何も捨札にしない（出典: atwiki/page-375「多ければ」）", () => {
    const s = settle(black(2, [released("TST-OP", "own"), released("TST-OP-ET", "own2")], [released("TST-OP", "w"), released("TST-OP-ET", "e")]));
    expect(s.players.player2.command).toHaveLength(2);
  });

  it("RS-233: 1番目に出たとき（NC 不成立）は SP！のままで、カテゴリ差があっても何も起きない（出典: atwiki/page-375「CN：2」・R-CN-02）", () => {
    const s = settle(black(1, [], [released("TST-OP", "w"), released("TST-OP-ET", "e")]));
    expect(spOf(s, "player1", "RS-233:bk")).toBe(0);
    expect(s.players.player2.command).toHaveLength(2);
  });

  // faq-card-4 RS-233 Q2「はい、その通りです。」（自軍コマンドが0枚ならカテゴリ0として、相手は0になるまで捨札にする）
  it("RS-233: 公式Q&A — 自軍コマンドゾーンにカードがなければカテゴリ数0として、相手はコマンドゾーンのカードをすべて捨札にする（出典: grnrngr/faq-card-4 RS-233 Q2）", () => {
    let s = black(2, [], [released("TST-OP", "w"), held("TST-OP-ET", "e")]);
    for (let i = 0; i < 6 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const p = s.pendingEffectChoice;
      const r = p.validInstanceIds[0] ? tryAct(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: p.validInstanceIds[0] }) : { ok: false as const, state: s };
      s = r.ok ? r.state : act(s, { type: "confirm_effect_choice", playerId: "player2" });
    }
    expect(s.players.player2.command).toHaveLength(0);
    expect(s.players.player2.discard).toHaveLength(2);
  });

  // faq-card-4 RS-233 Q1「「ダイノスラスター」の効果は実行済みですので、「プロジェットカノン」で戻されたカードを捨札にする必要はありません。」
  it("RS-233: 公式Q&A — 敵軍ゴーゴーファイヤー【プロジェットカノン】で捨札からコマンドゾーンに戻されたカードを、もう一度捨札にする必要はない（出典: grnrngr/faq-card-4 RS-233 Q1・RS-238 Q5）", () => {
    let s = black(2, [released("TST-OP", "own")], [released("TST-OP", "w"), released("TST-OP-ET", "e")], { rush: [inst("RS-238", "fire")] });
    for (let i = 0; i < 10 && s.pendingEffectChoice; i++) {
      const p = s.pendingEffectChoice;
      if (p.playerId === "player2" && p.validInstanceIds.includes("TST-OP-ET:e") && p.effectId !== "purojietokanon") {
        s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP-ET:e" });
        continue;
      }
      if (p.playerId === "player2" && p.validInstanceIds.includes("TST-OP-ET:e")) {
        s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP-ET:e" });
        continue;
      }
      const c = tryAct(s, { type: "confirm_effect_choice", playerId: p.playerId });
      s = c.ok ? c.state : act(s, { type: "skip_effect_choice", playerId: p.playerId });
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-OP-ET:e")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP-ET:e")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-OP:w")).toBe("command");
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-234 アバレキラー", () => {
  const TEXT =
    "【ウイングペンタクト】自軍ターン中、このユニットからコンビネーションする「WB」のMユニットは、BP+3000され、BP8000以上のとき「SP1」になる。自分がターンを終えるとき、このユニットからコンビネーションした「WB」のMユニットは撃破される。";

  it("RS-234: カタログ本文・スペックが出典と一致（出典: atwiki/page-26）", () => {
    expectCatalogText("RS-234", TEXT);
    expectStats("RS-234", {
      name: "アバレキラー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 1,
      features: ["ホワイト", "男"],
    });
  });

  function killerThen(mId: string, pos = 1) {
    let s = st({ player1: { battle: fillers(pos - 1), rush: [inst("RS-234", "kl"), inst(mId, "m")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, SPECS);
    s = passEntry(enter(s, "RS-234:kl"));
    return enter(s, `${mId}:m`);
  }

  // 「このユニットからコンビネーションする「WB」のMユニットは、BP+3000され、BP8000以上のとき「SP1」になる」
  it("RS-234: 1番目（NC 成立）のアバレキラーからコンビネーションした WB の M ユニット（BP5000）は BP8000 になり「SP1」（出典: atwiki/page-26）", () => {
    const s = killerThen("SPEC-WB-M5");
    expect(bpOf(s, "player1", "SPEC-WB-M5:m")).toBe(8000);
    expect(spOf(s, "player1", "SPEC-WB-M5:m")).toBe(1);
    expect(canStrike(s, "SPEC-WB-M5:m")).toBe(true);
  });

  it("RS-234: BP+3000 しても BP8000 未満（BP4000→7000）なら「SP1」にならない（出典: atwiki/page-26「BP8000以上のとき」）", () => {
    const s = killerThen("SPEC-WB-M4");
    expect(bpOf(s, "player1", "SPEC-WB-M4:m")).toBe(7000);
    expect(canStrike(s, "SPEC-WB-M4:m")).toBe(false);
  });

  it("RS-234: WB 以外の M ユニット（ET）・WB の S ユニットには働かない（出典: atwiki/page-26「「WB」のMユニット」）", () => {
    expect(bpOf(killerThen("SPEC-ET-M5"), "player1", "SPEC-ET-M5:m")).toBe(5000);
    expect(bpOf(killerThen("SPEC-WB-S5"), "player1", "SPEC-WB-S5:m")).toBe(5000);
  });

  it("RS-234: アバレキラーが1番目以外（NC 不成立）なら働かない（出典: atwiki/page-26「CN：1」・R-CN-02）", () => {
    const s = killerThen("SPEC-WB-M5", 2);
    expect(bpOf(s, "player1", "SPEC-WB-M5:m")).toBe(5000);
    expect(canStrike(s, "SPEC-WB-M5:m")).toBe(false);
  });

  // 「自分がターンを終えるとき、このユニットからコンビネーションした「WB」のMユニットは撃破される」
  it("RS-234: 自分がターンを終えるとき、コンビネーションした WB の M ユニットは撃破される（アバレキラー自身は残る）（出典: atwiki/page-26）", () => {
    let s = killerThen("SPEC-WB-M5");
    s = passEntry(s);
    s = endTurn(s);
    expect(zoneOf(s, "player1", "SPEC-WB-M5:m")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-234:kl")).not.toBe("discard");
  });

  it("RS-234: コンビネーションしていない M ユニットはターン終了時に撃破されない（出典: atwiki/page-26「このユニットからコンビネーションした」）", () => {
    let s = killerThen("SPEC-WB-M5", 2);
    s = endTurn(passEntry(s));
    expect(zoneOf(s, "player1", "SPEC-WB-M5:m")).not.toBe("discard");
  });

  // faq-card-4 RS-234 Q1「はい、ＳＰ１になります。」（ガオ・ソウル等で BP8000 以上になった場合）
  it("RS-234: 公式Q&A — コンビネーションした WB の M ユニット（BP3000→6000）が、ガオ・ソウル（BP+4000）で BP8000 以上になれば「SP1」になる（出典: grnrngr/faq-card-4 RS-234 Q1）", () => {
    // ラッシュフェイズにガオ・ソウルで BP+4000（このターン）してから、バトルフェイズにアバレキラー→M ユニットの順に出す
    let s = st(
      {
        phase: "rush",
        player1: { rush: [inst("RS-234", "kl"), inst("SPEC-WB-M3", "m")], hand: [inst("RS-025", "gs")], command: releasedN(1), power: powerCards(3), deck: deckCards(5) },
        player2: { deck: deckCards(5, "e") },
      },
      SPECS,
    );
    s = useCard(s, "player1", "RS-025:gs", { targetInstanceId: "SPEC-WB-M3:m" });
    s = drain(s, "player1", ["SPEC-WB-M3:m"]);
    s = toPhase(s, "player1", "battle");
    s = passEntry(enter(s, "RS-234:kl"));
    s = enter(s, "SPEC-WB-M3:m");
    expect(bpOf(s, "player1", "SPEC-WB-M3:m")).toBe(10000);
    expect(spOf(s, "player1", "SPEC-WB-M3:m")).toBe(1);
    expect(canStrike(s, "SPEC-WB-M3:m")).toBe(true);
  });

  // faq-card-4 RS-234 Q1 後段「「RS-023 守護獣トリケラトプス」の効果は「アタックするとき」に限定されますので、この効果でＳＰ１になってもストライクはできません。」
  // （Q&A の「RS-023 守護獣トリケラトプス」は現行カタログでは RS-037 守護獣トリケラトプス【トリケラカノン】）
  it("RS-234: 公式Q&A — 守護獣トリケラトプスの「アタックするとき」の BP 上昇で BP8000 以上になって SP1 になってもストライクはできない（出典: grnrngr/faq-card-4 RS-234 Q1 後段）", () => {
    let s = st(
      {
        player1: { rush: [inst("RS-234", "kl"), inst("RS-037", "tri"), inst("SPEC-WB-M4", "m")], deck: deckCards(5) },
        player2: { battle: [inst("SPEC-E75", "e")], deck: deckCards(5, "e") },
      },
      [...SPECS, sUnit("SPEC-E75", { bp: 7500 })],
    );
    s = passEntry(enter(s, "RS-234:kl"));
    s = enter(s, "SPEC-WB-M4:m");
    // アバレキラーで BP4000→7000。BP+1000 は「アタックするとき」だけなので、ストライクの選択時点では BP8000 未満でストライクできない
    expect(bpOf(s, "player1", "SPEC-WB-M4:m")).toBe(7000);
    expect(spOf(s, "player1", "SPEC-WB-M4:m")).not.toBe(1);
    expect(canStrike(s, "SPEC-WB-M4:m")).toBe(false);
    // アタックするときは【トリケラカノン】で BP+1000 → BP8000 となり、BP7500 の敵軍ユニットに勝つ
    s = settle(attack(s, "SPEC-WB-M4:m", "SPEC-E75:e"));
    expect(zoneOf(s, "player2", "SPEC-E75:e")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-WB-M4:m")).toBe("battle");
  });

  // faq-card-4 RS-234 Q2「「ＳＰ１に『なる』」という効果は、ＳＰに１を加算するという意味ではなく…その値に置き換わる」
  it("RS-234: 公式Q&A — もともと「SP1」の WB の M ユニットも SP2 にはならず「SP1」のまま（出典: grnrngr/faq-card-4 RS-234 Q2）", () => {
    const s = killerThen("SPEC-WB-M5SP");
    expect(bpOf(s, "player1", "SPEC-WB-M5SP:m")).toBe(8000);
    expect(spOf(s, "player1", "SPEC-WB-M5SP:m")).toBe(1);
  });

  it.todo(
    "RS-234: atwiki Q&A — 知恵の樹モークでユニットとして扱われているギンガレオン（M ビークル）をアバレキラーからコンビネーションさせると、ターンを終えるとき撃破される（出典: atwiki/page-26 Q3）— 知恵の樹モーク（XG2-019）でビークルをユニットとして扱う処理は XG 系の担当範囲で、公開 API での組み立てを確認できなかった",
  );
});

// ===========================================================================
describe("RS-235 デカベースロボ", () => {
  const TEXT =
    "※自分が「デカベースクローラー」をラッシュしたとき、自軍エリアに「デカベースロボ」があれば1体選んで手札に戻す。※自軍パワーゾーンからダメージ以外のカードを2枚選んで捨札にしなければバトルエリアに出られない。";

  it("RS-235: カタログ本文・スペックが出典と一致（出典: atwiki/page-500）", () => {
    expectCatalogText("RS-235", TEXT);
    expectStats("RS-235", {
      name: "デカベースロボ",
      category: "OT",
      size: "XL",
      bp: 8000,
      sp: 1,
      powerCost: "5+",
      features: ["メカ", "人型"],
      rushCondition: "return_named_to_hand",
    });
  });

  // 「追加条件：自軍「デカベースクローラー」1体を手札に戻す」
  it("RS-235: 追加条件 — 自軍「デカベースクローラー」1体を手札に戻してラッシュでき、いなければラッシュできない（出典: atwiki/page-500）", () => {
    const mk = (rush: CardInstance[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-235", "robo")], rush, command: [released("TST-OP-OT", "ot")], power: powerCards(5) } });
    expect(canStartRush(mk([]), "player1", "RS-235:robo")).toBe(false);
    const r = rushVia(mk([inst("RS-105", "cr")]), "player1", "RS-235:robo");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-235:robo")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-105:cr")).toBe("hand");
  });

  it("RS-235: 必要パワー5+ — パワー4ではラッシュできない（出典: atwiki/page-500）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-235", "robo")], rush: [inst("RS-105", "cr")], command: [released("TST-OP-OT", "ot")], power: powerCards(4) } });
    expect(canStartRush(s, "player1", "RS-235:robo")).toBe(false);
  });

  // 「※自分が「デカベースクローラー」をラッシュしたとき、自軍エリアに「デカベースロボ」があれば1体選んで手札に戻す」
  it("RS-235: ※ 自分がデカベースクローラーをラッシュしたとき、自軍エリアのデカベースロボを手札に戻す（出典: atwiki/page-500）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RS-105", "cr")], rush: [inst("RS-235", "robo")], command: [released("TST-OP-OT", "ot")], power: powerCards(5) } });
    const r = rushFromHand(s, "player1", "RS-105:cr");
    expect(r.ok).toBe(true);
    expect(choiceIds(r.state)).toEqual(["RS-235:robo"]);
    s = drain(r.state, "player1", ["RS-235:robo"]);
    expect(zoneOf(s, "player1", "RS-105:cr")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-235:robo")).toBe("hand");
  });

  it("RS-235: ※ 戻すのは強制（戻さないことは選べない）（出典: atwiki/page-500「1体選んで手札に戻す」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-105", "cr")], rush: [inst("RS-235", "robo")], command: [released("TST-OP-OT", "ot")], power: powerCards(5) } });
    const r = rushFromHand(s, "player1", "RS-105:cr");
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-235");
    expect(canSkip(r.state)).toBe(false);
  });

  it("RS-235: ※ 相手がデカベースクローラーをラッシュしても、自軍のデカベースロボは戻らない（出典: atwiki/page-500「自分が」）", () => {
    let s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { rush: [inst("RS-235", "robo")] },
      player2: { hand: [inst("RS-105", "cr")], command: [released("TST-OP-OT", "ot")], power: powerCards(5) },
    });
    const r = rushFromHand(s, "player2", "RS-105:cr");
    expect(r.ok).toBe(true);
    s = drain(drain(r.state, "player2"), "player1");
    expect(zoneOf(s, "player2", "RS-105:cr")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-235:robo")).toBe("rush");
  });

  // 「※自軍パワーゾーンからダメージ以外のカードを2枚選んで捨札にしなければバトルエリアに出られない」
  function roboEntry(power: CardInstance[]) {
    return st({ player1: { rush: [inst("RS-235", "robo")], power } });
  }

  it("RS-235: ※ 自軍パワーゾーンのダメージ以外のカードを2枚捨札にしてバトルエリアに出る（出典: atwiki/page-500）", () => {
    let s = roboEntry(powerCards(3, "pw"));
    expect(canEnter(s, "RS-235:robo")).toBe(true);
    // 1回目の move_to_battle でパワーゾーンのカードを2枚選んで捨札にし、そのあとバトルエリアに出す
    s = raw(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-235:robo" });
    expect(s.pendingEffectChoice?.selectCount).toBe(2);
    expect(canSkip(s)).toBe(false);
    s = pick(pick(s, "TST-P:pw0"), "TST-P:pw1");
    if (zoneOf(s, "player1", "RS-235:robo") === "rush") s = raw(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-235:robo" });
    expect(zoneOf(s, "player1", "RS-235:robo")).toBe("battle");
    expect(s.players.player1.power).toHaveLength(1);
    expect(s.players.player1.discard.filter((c) => c.cardId === "TST-P")).toHaveLength(2);
  });

  it("RS-235: ※ ダメージ以外のカードが1枚しかなければ（ほかはダメージ）バトルエリアに出られない（出典: atwiki/page-500「ダメージ以外のカードを2枚」）", () => {
    const s = roboEntry([inst("TST-P", "up"), { ...inst("TST-P", "dmg0"), faceDown: true }, { ...inst("TST-P", "dmg1"), faceDown: true }]);
    expect(canEnter(s, "RS-235:robo")).toBe(false);
  });

  // atwiki/page-500 Q1「はい、その通りです。」（XG-034 = XG1-034 害気大臣キタネイダス【汚い大気】）
  // 既知の不具合: CARD-RS-235 害気大臣キタネイダス（XG1-034）の【汚い大気】がエンジンで未接続（DSL がプレースホルダの grant_keyword のみ）で、自軍エリアにあってもバトルフェイズ中のデカベースロボはパワーゾーンのカード2枚の捨札を要求される
  it.fails("RS-235: 公式Q&A — 害気大臣キタネイダスが自軍エリアにある間、バトルフェイズ中はパワーゾーンのカードを捨札にしなくてもバトルエリアに出られる（出典: atwiki/page-500 Q1）", () => {
    let s = st({ player1: { rush: [inst("RS-235", "robo"), inst("XG1-034", "kita")], power: powerCards(3, "pw") } });
    expect(canEnter(s, "RS-235:robo")).toBe(true);
    s = raw(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-235:robo" });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "RS-235:robo")).toBe("battle");
    expect(s.players.player1.power).toHaveLength(3);
    expect(s.players.player1.discard.filter((c) => c.cardId === "TST-P")).toHaveLength(0);
  });
});

