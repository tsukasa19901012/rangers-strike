/**
 * カード別スペック: RS-091〜RS-096（第2弾「二人の黒騎士」）
 * 出典の優先順位と方針は RS2-071-096.part1.test.ts 冒頭を参照。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attack,
  bpOf,
  canEnter,
  canStrike,
  endTurn,
  enter,
  expectBodyText,
  fillers,
  inst,
  legal,
  legalOfType,
  passEntry,
  powerCards,
  released,
  settle,
  st,
  strikeDamage,
  sUnit,
  tryAct,
  tryZordRush,
  zoneOf,
} from "./RS2-071-096.helpers";
import type { CardInstance, GameState } from "../types/game";

function expectStats(
  id: string,
  stats: {
    name: string;
    category: string;
    size: string;
    bp: number;
    sp: number | "special" | undefined;
    powerCost: number | string;
    comboNumber?: number;
    features?: string[];
  },
) {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features ?? []);
}

function dmg(suffix: string): CardInstance {
  return { ...inst("TST-P", suffix), faceDown: true };
}

const EXTRA = [
  sUnit("SPEC-S-NOSP", { bp: 1000, sp: undefined }),
  sUnit("SPEC-S-3000", { bp: 3000, sp: undefined }),
  sUnit("SPEC-S-9000-SP1", { bp: 9000, sp: 1 }),
  sUnit("SPEC-M-WB", { size: "M", bp: 3000, sp: undefined }),
];

// ===========================================================================
describe("RS-091 ゴーレッド", () => {
  it("RS-091: カタログ本文・スペックが出典と一致（出典: atwiki/page-290）", () => {
    expectBodyText("RS-091", "【人命救助】自軍捨札からSユニットのカードを1枚選んで手札に加えてもよい。");
    expectStats("RS-091", {
      name: "ゴーレッド",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 5,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  function goRed(battle: number) {
    return st({
      player1: {
        battle: fillers(battle),
        rush: [inst("RS-091", "gr")],
        discard: [inst("SPEC-S-3000", "s"), inst("SPEC-M-WB", "m"), inst("TST-OP", "op")],
      },
    }, EXTRA);
  }

  // 「自軍捨札からSユニットのカードを1枚選んで手札に加えてもよい」
  it("RS-091: 5番目に出ると、自軍捨札の S ユニットを1枚選んで手札に加えられる（M ユニット・オペレーションは選べない）（出典: atwiki/page-290）", () => {
    let s = enter(goRed(4), "RS-091:gr");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("SPEC-S-3000:s");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("SPEC-M-WB:m");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("TST-OP:op");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-S-3000:s" });
    expect(zoneOf(s, "player1", "SPEC-S-3000:s")).toBe("hand");
  });

  it("RS-091: 手札に加えないことを選べる（「してもよい」）（出典: atwiki/page-290）", () => {
    let s = enter(goRed(4), "RS-091:gr");
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "SPEC-S-3000:s")).toBe("discard");
  });

  it("RS-091: 5番目以外では発動しない（出典: atwiki/page-290「CN：5」）", () => {
    const s = enter(goRed(1), "RS-091:gr");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // 「SP：－」
  it("RS-091: SP がないので 5番目でもストライクできない（出典: atwiki/page-290「SP：－」、カード評価「5番目に並んでもストライクが出来ない」）", () => {
    let s = enter(goRed(4), "RS-091:gr");
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(canStrike(s, "RS-091:gr")).toBe(false);
  });
});

// ===========================================================================
describe("RS-092 冥王ジルフィーザ", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【天の災】これをラッシュしたとき、お互いに次のようにする。自分自身のパワーゾーンからダメージではないカードをすべて捨札にする。その後、手札をすべてパワーゾーンに置く。";

  it("RS-092: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-327）", () => {
    expectBodyText("RS-092", TEXT);
    expectStats("RS-092", {
      name: "冥王ジルフィーザ",
      category: "DA",
      size: "S",
      bp: 8000,
      sp: 1,
      powerCost: "9+",
      features: ["災魔一族", "男"],
    });
    expect(DEFS["RS-092"]!.rushAdditionalCondition?.text).toBe("自軍Sユニットを3体捨札にする");
    expect((DEFS["RS-092"]!.rushAdditionalCondition as { unitCount?: number }).unitCount).toBe(3);
  });

  function zilState(sUnits: number, power = 9) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-092", "zil"), inst("TST-OP", "myhand")],
        rush: fillers(sUnits),
        command: [released("TST-OP-DA", "da")],
        power: [...powerCards(power), dmg("mydmg")],
        damage: 1,
      },
      player2: {
        hand: [inst("TST-OP", "eh1"), inst("TST-OP-ET", "eh2")],
        power: [...powerCards(2, "ep"), dmg("edmg")],
        damage: 1,
      },
    });
  }
  function rushZil(s: GameState) {
    return tryZordRush(s, "RS-092:zil", { materials: ["TST-UNIT-0:fill0", "TST-UNIT-0:fill1", "TST-UNIT-0:fill2"] });
  }

  // 「追加条件：自軍Sユニットを3体捨札にする」「必要パワー：9+」
  it("RS-092: 自軍Sユニット3体を捨札にしてラッシュする。2体しかなければラッシュできない（出典: atwiki/page-327）", () => {
    const r = rushZil(zilState(3));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-092:zil")).toBe("rush");
    for (let i = 0; i < 3; i += 1) expect(zoneOf(r.state, "player1", `TST-UNIT-0:fill${i}`)).toBe("discard");
    const r2 = rushZil(zilState(2));
    expect(r2.ok && zoneOf(r2.state, "player1", "RS-092:zil") === "rush").toBe(false);
  });

  // 「自分自身のパワーゾーンからダメージではないカードをすべて捨札にする。その後、手札をすべてパワーゾーンに置く」
  it("RS-092: 【天の災】— お互いにダメージ以外のパワーを捨札にし、手札をすべてパワーゾーンに置く（ダメージは残る）（出典: atwiki/page-327）", () => {
    const r = rushZil(zilState(3));
    const s = r.state;
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-P:ep0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:mydmg")).toBe("power");
    expect(zoneOf(s, "player2", "TST-P:edmg")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP:myhand")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP-ET:eh2")).toBe("power");
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  // 「パワーゾーンに置く」— ダメージ（ウラ向き）として置くとは書かれていない
  it.fails("RS-092: 【天の災】で手札から置いたカードはダメージではない（オモテ向き）（出典: atwiki/page-327、R-ZONE-07）", () => {
    // 既知の不具合: CARD-RS-092 天の災で手札をパワーゾーンにウラ向き（ダメージ扱い）で置いている
    const s = rushZil(zilState(3)).state;
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP:eh1")?.faceDown ?? false).toBe(false);
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(1);
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(1);
  });

  /** 相手ターンに、相手の attacker がジルフィーザにアタックする。 */
  function attackedZil(attacker: string) {
    const s0 = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-092", "zil")] },
      player2: { battle: [inst(attacker, "atk")] },
    }, EXTRA);
    return settle(attack(s0, `${attacker}:atk`, "RS-092:zil", "player2"));
  }

  // 「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-092: 敵軍ターン中に SP1 のユニットとバトルすると、勝っても撃破される（出典: atwiki/page-327）", () => {
    const s = attackedZil("TST-UNIT-0");
    expect(zoneOf(s, "player1", "RS-092:zil")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
  });

  it("RS-092: 敵軍ターン中でも SP のないユニットとのバトルなら撃破されない（出典: atwiki/page-327）", () => {
    const s = attackedZil("SPEC-S-NOSP");
    expect(zoneOf(s, "player1", "RS-092:zil")).toBe("battle");
  });

  it("RS-092: 自軍ターン中に SP1 のユニットとバトルして勝っても撃破されない（出典: atwiki/page-327「敵軍ターン中」）", () => {
    const s0 = st({
      player1: { battle: [inst("RS-092", "zil")] },
      player2: { battle: [inst("TST-UNIT-0", "def")] },
    });
    const s = settle(attack(s0, "RS-092:zil", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player1", "RS-092:zil")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("discard");
  });

  // faq-card-2 RS-092 Q1「その場合は、ターンプレイヤーが望む順で処理します。」
  it.todo(
    "RS-092: 公式Q&A — 超電子レーダーが配置されているときにラッシュした場合、天の災と超電子レーダーの処理順はターンプレイヤーが選ぶ（出典: grnrngr/faq-card-2 RS-092 Q1）— 同時に誘発した効果の処理順を選ぶ公開 API がない",
  );
});

// ===========================================================================
describe("RS-093 童鬼ドロップ", () => {
  const TEXT = "※これはバトルエリアに出られない。【かんしゃく】これが撃破されたとき、お互いに1点ダメージを受ける。";

  it("RS-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-328）", () => {
    expectBodyText("RS-093", TEXT);
    expectStats("RS-093", {
      name: "童鬼ドロップ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 0,
      features: ["災魔一族", "男"],
    });
  });

  // 「※これはバトルエリアに出られない。」
  it("RS-093: バトルエリアに出られない（出典: atwiki/page-328）", () => {
    const s = st({ player1: { rush: [inst("RS-093", "drop")], command: [released("TST-OP", "c")] } });
    expect(canEnter(s, "RS-093:drop")).toBe(false);
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-093:drop" }).ok).toBe(false);
  });

  /** player1 のデカレッドが、player2 のラッシュエリアの童鬼ドロップをジュウクンドーで撃破する。 */
  function juuKunDoDrop(p1Damage: number, p2Damage: number, power = 0) {
    let s = st({
      // デカレッドは1番目に出て NC（CN1）が成立した状態（【ジュウクンドー】は CN の欄の効果。R-CN-02）。
      player1: { battle: [{ ...inst("RS-106", "deka"), activatedNcEffects: ["juu_kun_do"] }], damage: p1Damage, power: powerCards(power), deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")] },
      player2: {
        battle: [inst("SPEC-S-NOSP", "wall")],
        rush: [inst("RS-093", "drop")],
        damage: p2Damage,
        power: powerCards(power, "e"),
        deck: [inst("TST-OP", "e1"), inst("TST-OP", "e2")],
      },
    }, EXTRA);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:deka" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("RS-093:drop");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-093:drop" });
    if (s.pendingEffectChoice && legal(s).some((a) => a.type === "confirm_effect_choice")) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    return settle(s);
  }

  // 「これが撃破されたとき、お互いに1点ダメージを受ける」
  it("RS-093: 撃破されたとき、お互いに1点ダメージを受ける（パワーゾーンが空で山札からダメージにする場合）（出典: atwiki/page-328）", () => {
    const s = juuKunDoDrop(0, 0);
    expect(zoneOf(s, "player2", "RS-093:drop")).toBe("discard");
    expect(s.players.player1.damage).toBe(1);
    expect(s.players.player2.damage).toBe(1);
  });

  it.fails("RS-093: パワーゾーンのカードからダメージにするカードを選ぶ場合も、お互いに1点ダメージを受ける（出典: atwiki/page-328）", () => {
    // 既知の不具合: CARD-RS-093 1人目のダメージ支払いで選択が発生すると処理が打ち切られ、2人目がダメージを受けない
    const s = juuKunDoDrop(0, 0, 3);
    expect(s.players.player1.damage).toBe(1);
    expect(s.players.player2.damage).toBe(1);
  });

  // faq-card-2 RS-093 Q1「同時に７点目のダメージを受けた場合はターンプレイヤーがゲームに勝利します。」
  it("RS-093: 公式Q&A — かんしゃくでお互いに7点目のダメージを受けたら、ターンプレイヤーが勝つ（出典: grnrngr/faq-card-2 RS-093 Q1、R-WIN-02）", () => {
    const s = juuKunDoDrop(6, 6);
    expect(s.winner).toBe("player1");
  });
});

// ===========================================================================
describe("RS-094 龍冥王サラマンデス", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。【幽魔吸収】自軍バトルフェイズに次の効果を発動できる。敵軍捨札からSユニットのカードを1枚選んで持ち主の手札に戻す。そうしたとき、このターンこのユニットのBPは相手の手札に戻したカードのBPとの合計になり、SP1になる。";

  it("RS-094: カタログ本文・スペックが出典と一致（出典: atwiki/page-329）", () => {
    expectBodyText("RS-094", TEXT);
    expectStats("RS-094", {
      name: "龍冥王サラマンデス",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: "special",
      powerCost: "4+",
      features: ["災魔一族", "男"],
    });
    expect(DEFS["RS-094"]!.rushAdditionalCondition?.text).toBe("自軍「童鬼ドロップ」1体を捨札にする");
  });

  function salaState(rush: CardInstance[]) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-094", "sala")],
        rush,
        command: [released("TST-OP-DA", "da")],
        power: powerCards(4),
      },
    });
  }

  // 「追加条件：自軍「童鬼ドロップ」1体を捨札にする」
  it("RS-094: 自軍の童鬼ドロップを捨札にしてラッシュする（出典: atwiki/page-329）", () => {
    const r = tryZordRush(salaState([inst("RS-093", "drop")]), "RS-094:sala", { materials: ["RS-093:drop"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-094:sala")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-093:drop")).toBe("discard");
  });

  it("RS-094: 童鬼ドロップ以外の S ユニットでは追加条件を満たせない（出典: atwiki/page-329）", () => {
    const r = tryZordRush(salaState([inst("TST-UNIT-0", "s")]), "RS-094:sala", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok && zoneOf(r.state, "player1", "RS-094:sala") === "rush").toBe(false);
  });

  function absorbState(enemyDiscard: CardInstance[]) {
    return st({
      player1: { rush: [inst("RS-094", "sala")] },
      player2: { discard: enemyDiscard, power: powerCards(3, "e") },
    }, EXTRA);
  }

  // 「敵軍捨札からSユニットのカードを1枚選んで持ち主の手札に戻す。そうしたとき…BPは…合計になり、SP1になる」
  it("RS-094: 自軍バトルフェイズにバトルエリアに出ると、敵軍捨札の S ユニットを選ぶ選択が開く（M ユニットは候補外）（出典: atwiki/page-329）", () => {
    const s = enter(absorbState([inst("SPEC-S-3000", "es"), inst("SPEC-M-WB", "em")]), "RS-094:sala");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("SPEC-S-3000:es");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("SPEC-M-WB:em");
  });

  it.fails("RS-094: 敵軍捨札の S ユニット（BP3000）を相手の手札に戻すと、このターン BP9000・SP1（ストライクで1点）（出典: atwiki/page-329）", () => {
    // 既知の不具合: CARD-RS-094 敵軍捨札のカードを選ぶ resolve_effect_choice が不正手になり、幽魔吸収を実行できない（スキップしか選べない）
    let s = enter(absorbState([inst("SPEC-S-3000", "es"), inst("SPEC-M-WB", "em")]), "RS-094:sala");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-S-3000:es" });
    expect(zoneOf(s, "player2", "SPEC-S-3000:es")).toBe("hand");
    expect(bpOf(s, "player1", "RS-094:sala")).toBe(9000);
    expect(strikeDamage(s, "RS-094:sala")).toBe(1);
  });

  it("RS-094: 発動しないことを選べ、その場合は BP6000 のままストライクできない（出典: atwiki/page-329「発動できる」「SP：！」）", () => {
    let s = enter(absorbState([inst("SPEC-S-3000", "es")]), "RS-094:sala");
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "SPEC-S-3000:es")).toBe("discard");
    expect(bpOf(s, "player1", "RS-094:sala")).toBe(6000);
    expect(canStrike(s, "RS-094:sala")).toBe(false);
  });

  // 「自軍バトルフェイズに次の効果を発動できる」— バトルエリアに出たときに限られない
  it.fails("RS-094: バトルフェイズ開始時からバトルエリアにいても、自軍バトルフェイズ中に発動できる（出典: atwiki/page-329「自軍バトルフェイズに次の効果を発動できる」）", () => {
    // 既知の不具合: CARD-RS-094 幽魔吸収がバトルエリアに出たときの選択としてしか発動できない
    const s = passEntry(st({
      player1: { battle: [inst("RS-094", "sala")] },
      player2: { discard: [inst("SPEC-S-3000", "es")] },
    }, EXTRA));
    const canActivate = legal(s).some(
      (a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === "RS-094:sala",
    ) || (s.pendingEffectChoice?.validInstanceIds ?? []).includes("SPEC-S-3000:es");
    expect(canActivate).toBe(true);
  });

  // 「このターン」
  it.fails("RS-094: 幽魔吸収の BP・SP は「このターン」だけ（相手ターンには BP6000）（出典: atwiki/page-329）", () => {
    // 既知の不具合: CARD-RS-094 幽魔吸収を実行できない（上記）ため、前提状態を作れない
    let s = enter(absorbState([inst("SPEC-S-3000", "es")]), "RS-094:sala");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-S-3000:es" });
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "RS-094:sala")).toBe(6000);
  });

  // 「※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-094: 敵軍ターン中に SP1 のユニットとバトルすると、勝っても撃破される（出典: atwiki/page-329）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-094", "sala")] },
      player2: { battle: [inst("TST-UNIT-0", "atk")] },
    });
    const s = settle(attack(s0, "TST-UNIT-0:atk", "RS-094:sala", "player2"));
    expect(zoneOf(s, "player1", "RS-094:sala")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-095 旋風神", () => {
  const TEXT =
    "合体―ハリケンホーク＋ハリケンレオン＋ハリケンドルフィン【タテガミハリケーン】これがバトルエリアに出たとき、敵軍ラッシュエリアにあるSユニットをすべて持ち主の手札に戻す。";

  it("RS-095: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-309）", () => {
    expectBodyText("RS-095", TEXT);
    expectStats("RS-095", {
      name: "旋風神",
      category: "MA",
      size: "L",
      bp: 16000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-095"]!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });

  // 「合体―ハリケンホーク＋ハリケンレオン＋ハリケンドルフィン」
  it("RS-095: ハリケンホーク・レオン・ドルフィンを捨札にしてラッシュする。1体欠けるとラッシュできない（出典: atwiki/page-309）", () => {
    const mk = (parts: string[]) =>
      st({
        phase: "rush",
        player1: {
          hand: [inst("RS-095", "sen")],
          rush: parts.map((id) => inst(id, "p")),
          command: [released("TST-OP-MA", "ma")],
          power: powerCards(7),
        },
      });
    const all = ["RS-096", "RS-097", "RS-098"];
    const r = tryZordRush(mk(all), "RS-095:sen", { materials: all.map((id) => `${id}:p`) });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-095:sen")).toBe("rush");
    for (const id of all) expect(zoneOf(r.state, "player1", `${id}:p`)).toBe("discard");
    const r2 = tryZordRush(mk(all.slice(0, 2)), "RS-095:sen", { materials: all.map((id) => `${id}:p`) });
    expect(r2.ok && zoneOf(r2.state, "player1", "RS-095:sen") === "rush").toBe(false);
  });

  // 「これがバトルエリアに出たとき、敵軍ラッシュエリアにあるSユニットをすべて持ち主の手札に戻す」
  it("RS-095: バトルエリアに出たとき、敵軍ラッシュエリアの S ユニットをすべて手札に戻す（M ユニット・バトルエリアのユニットは残る）（出典: atwiki/page-309）", () => {
    const s0 = st({
      player1: { rush: [inst("RS-095", "sen"), inst("TST-UNIT-0", "own")] },
      player2: {
        rush: [inst("TST-UNIT-0", "e1"), inst("SPEC-S-3000", "e2"), inst("SPEC-M-WB", "em")],
        battle: [inst("SPEC-S-NOSP", "eb")],
      },
    }, EXTRA);
    const s = settle(enter(s0, "RS-095:sen"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-S-3000:e2")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-M-WB:em")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-S-NOSP:eb")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:own")).toBe("rush");
  });

  it("RS-095: SP1（ストライクで1点）（出典: atwiki/page-309）", () => {
    const s = st({ player1: { battle: [inst("RS-095", "sen")] }, player2: { power: powerCards(3, "e") } });
    expect(strikeDamage(s, "RS-095:sen")).toBe(1);
  });
});

// ===========================================================================
describe("RS-096 ハリケンホーク", () => {
  const TEXT = "【カラクリ忍法・火炎鷹】自分がターンを終えるとき、このユニットがバトルエリアにあれば持ち主の手札に戻す。";

  it("RS-096: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-314）", () => {
    expectBodyText("RS-096", TEXT);
    expectStats("RS-096", {
      name: "ハリケンホーク",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
    });
    expect(DEFS["RS-096"]!.rushAdditionalCondition?.text).toBe("自軍Sユニットを1体捨札にする");
  });

  // 「追加条件：自軍Sユニットを1体捨札にする」
  it("RS-096: 自軍 S ユニット1体を捨札にしてラッシュする。S ユニットがなければラッシュできない（出典: atwiki/page-314）", () => {
    const mk = (s: boolean) =>
      st({
        phase: "rush",
        player1: {
          hand: [inst("RS-096", "hawk")],
          rush: s ? [inst("TST-UNIT-0", "s")] : [],
          command: [released("TST-OP-MA", "ma")],
          power: powerCards(4),
        },
      });
    const r = tryZordRush(mk(true), "RS-096:hawk", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-096:hawk")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
    const r2 = tryZordRush(mk(false), "RS-096:hawk");
    expect(r2.ok && zoneOf(r2.state, "player1", "RS-096:hawk") === "rush").toBe(false);
  });

  // 「自分がターンを終えるとき、このユニットがバトルエリアにあれば持ち主の手札に戻す」
  it("RS-096: 自分がターンを終えるとき、バトルエリアにあれば手札に戻る（出典: atwiki/page-314）", () => {
    let s = enter(st({ player1: { rush: [inst("RS-096", "hawk")] } }), "RS-096:hawk");
    expect(zoneOf(s, "player1", "RS-096:hawk")).toBe("battle");
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "RS-096:hawk")).toBe("hand");
  });

  it("RS-096: ターン終了時にラッシュエリアにあれば戻らない（出典: atwiki/page-314「バトルエリアにあれば」）", () => {
    const s = endTurn(st({ player1: { rush: [inst("RS-096", "hawk")] } }));
    expect(zoneOf(s, "player1", "RS-096:hawk")).toBe("rush");
  });

  it("RS-096: 相手がターンを終えるときには戻らない（出典: atwiki/page-314「自分がターンを終えるとき」）", () => {
    const s = endTurn(st({ activePlayer: "player2", player1: { battle: [inst("RS-096", "hawk")] } }));
    expect(s.activePlayer).toBe("player1");
    expect(zoneOf(s, "player1", "RS-096:hawk")).not.toBe("hand");
  });
});
