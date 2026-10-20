/**
 * カード仕様テスト: RS-042〜RS-046（第1弾「英雄の再誕」ユニット: デカレンジャー）。
 * 出典の優先順位と方針は RS1-024-046.ops.test.ts 冒頭を参照。
 */
import { describe, expect, it } from "vitest";
import {
  CMD,
  act,
  attack,
  canUse,
  cardDef,
  choiceOptions,
  choose,
  deck,
  engineText,
  enterBattle,
  expectTextMatches,
  findCard,
  inst,
  legal,
  mk,
  passEntry,
  passReactions,
  powers,
  released,
  rush,
  tryRush,
  unitDef,
  zoneOf,
} from "./RS1-024-046.helpers";
import type { CardInstance, GameState, PlayerId } from "./RS1-024-046.helpers";

function canStrike(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return legal(state).some(
    (a) => a.type === "strike" && a.playerId === playerId && a.instanceId === instanceId,
  );
}

/** ストライクして相手が受けたダメージ量を返す（反応窓はパス、ダメージ支払いは先頭で解決）。 */
function strikeDamage(state: GameState, playerId: PlayerId, instanceId: string): number {
  const defender: PlayerId = playerId === "player1" ? "player2" : "player1";
  const before = state.players[defender].damage;
  let s = act(state, { type: "strike", playerId, instanceId });
  for (let i = 0; i < 10; i += 1) {
    const a = legal(s).find((x) => x.type.startsWith("pass_") || x.type === "resolve_damage_payment");
    if (!a) break;
    s = act(s, a);
  }
  return s.players[defender].damage - before;
}

function damageCard(suffix: string): CardInstance {
  return { ...inst("TST-P", suffix), faceDown: true };
}

/** 自軍パワーの選択（select_power）を n 枚ぶん先頭から行う。 */
function choosePowers(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i += 1) {
    const opts = choiceOptions(s, "player1");
    if (opts.length === 0) break;
    s = choose(s, "player1", opts[0]!);
  }
  return s;
}

const PAT_PARTS = ["RS-043", "RS-044", "RS-045", "RS-046", "RS-047"];

// ===========================================================================
describe("RS-042 デカレンジャーロボ", () => {
  const SOURCE =
    "合体―パトストライカー＋パトジャイラー＋パトレーラー＋パトアーマー＋パトシグナー【ジャスティスフラッシャー】自軍パワーゾーンからダメージ以外のカードを5枚選び捨札にしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP3」";

  function entered(power: CardInstance[]) {
    const robo = inst("RS-042", "robo");
    let state = mk({
      phase: "battle",
      player1: { rush: [robo], power },
      player2: { power: powers(3, "opp"), deck: deck(3, "od") },
    });
    state = enterBattle(state, "player1", robo.instanceId);
    return { robo, state };
  }

  it("RS-042: カタログのテキストが原文と一致する（出典: atwiki/page-279 テキスト）", () => {
    expectTextMatches("RS-042", SOURCE);
  });

  it("RS-042: OT の Lユニット BP19000・SP2・必要パワー8+・追加条件「自軍合体ユニットを捨札にする」・特徴メカ／人型（出典: atwiki/page-279）", () => {
    const def = cardDef("RS-042")!;
    expect(def.category).toBe("OT");
    expect(def.size).toBe("L");
    expect(def.bp).toBe(19000);
    expect(def.sp).toBe(2);
    expect(def.powerCost).toBe("8+");
    expect(def.rushAdditionalCondition?.text).toBe("自軍合体ユニットを捨札にする");
    expect(def.features).toEqual(["メカ", "人型"]);
  });

  it("RS-042: 合体に列挙された5体を自軍エリアから捨札にしてラッシュできる（出典: atwiki/page-279 合体 / R-ADD-06）", () => {
    const robo = inst("RS-042", "robo");
    const parts = PAT_PARTS.map((id, i) => inst(id, `p${i}`));
    const state = mk({ player1: { hand: [robo], rush: parts, power: powers(8), command: [released(CMD.OT, "c")] } });
    const next = rush(state, "player1", robo.instanceId, parts[0]!.instanceId);
    expect(zoneOf(next, "player1", robo.instanceId)).toBe("rush");
    for (const p of parts) expect(zoneOf(next, "player1", p.instanceId)).toBe("discard");
  });

  it("RS-042: パトシグナーが欠けているとラッシュできない（出典: R-ADD-06「表記されたユニットを全て」）", () => {
    const robo = inst("RS-042", "robo");
    const parts = PAT_PARTS.slice(0, 4).map((id, i) => inst(id, `p${i}`));
    const state = mk({ player1: { hand: [robo], rush: parts, power: powers(8), command: [released(CMD.OT, "c")] } });
    const r = tryRush(state, "player1", robo.instanceId, parts[0]!.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", robo.instanceId) === "rush").toBe(false);
  });

  it("RS-042: 何もしなければ SP2 でストライクし2点（出典: atwiki/page-279 SP：2）", () => {
    let { robo, state } = entered(powers(5));
    state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    expect(strikeDamage(state, "player1", robo.instanceId)).toBe(2);
  });

  it("RS-042: 発動するとダメージ以外のパワー5枚が捨札になる（出典: atwiki/page-279【ジャスティスフラッシャー】）", () => {
    let { state } = entered(powers(5));
    state = choosePowers(state, 5);
    expect(state.players.player1.power).toHaveLength(0);
    expect(state.players.player1.discard.filter((c) => c.cardId === "TST-P")).toHaveLength(5);
  });

  it("RS-042: 「SP3」を得たストライクのダメージはちょうど3点（SP2 に加算して5点にはならない）（出典: atwiki/page-279「次の能力を得る⇒「SP3」」）", () => {
    let { robo, state } = entered(powers(5));
    state = choosePowers(state, 5);
    expect(strikeDamage(state, "player1", robo.instanceId)).toBe(3);
  });

  it("RS-042: ダメージのカード（ウラ向き）は選べない（出典: atwiki/page-279「ダメージ以外のカード」）", () => {
    const { state } = entered([...powers(5), damageCard("dmg")]);
    expect(choiceOptions(state, "player1")).not.toContain("TST-P:dmg");
  });

  it("RS-042: ダメージ以外のカードが4枚しかなければ発動できない（出典: atwiki/page-279「5枚選び」）", () => {
    const { state } = entered([...powers(4), damageCard("dmg")]);
    expect(state.pendingEffectChoice?.effectId).not.toBe("justice_flasher");
  });

  it("RS-042: 発動は任意（してもよい）（出典: atwiki/page-279「捨札にしてもよい」）", () => {
    const { state } = entered(powers(5));
    expect(legal(state).some((a) => a.type === "skip_effect_choice" && a.playerId === "player1")).toBe(true);
  });

  it("RS-042: SP を得る効果は自軍バトルフェイズ中に発動できる（出た時に見送っても同じバトルフェイズ中に発動できる）（出典: grnrngr/faq-card-1 RS-051 Q3）", () => {
    // 「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます」
    let { robo, state } = entered(powers(5));
    state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    state = passEntry(state);
    const offered = legal(state).some(
      (a) =>
        (a.type === "activate_field_unit_ability" && a.unitInstanceId === robo.instanceId) ||
        (a.type === "resolve_effect_choice" && state.pendingEffectChoice?.effectId === "justice_flasher"),
    );
    expect(offered).toBe(true);
  });

  it("RS-042: 自軍バトルフェイズ以外（ラッシュフェイズ）には発動できない（出典: grnrngr/faq-card-1 RS-051 Q3「それ以外のタイミングでは発動できません」）", () => {
    const robo = inst("RS-042", "robo");
    const parts = PAT_PARTS.map((id, i) => inst(id, `p${i}`));
    const state = mk({ player1: { hand: [robo], rush: parts, power: powers(13), command: [released(CMD.OT, "c")] } });
    const next = rush(state, "player1", robo.instanceId, parts[0]!.instanceId);
    expect(next.pendingEffectChoice?.effectId).not.toBe("justice_flasher");
    expect(
      legal(next).some((a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === robo.instanceId),
    ).toBe(false);
  });
});

// ===========================================================================
describe("RS-043 パトストライカー", () => {
  // 修正後テキスト（08-errata R-ERR-RS043）
  const SOURCE =
    "【ジャッジメントソード】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからダメージ以外のカードを2枚選んで捨札にしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP1」";

  function entered(power: CardInstance[], extraRush: CardInstance[] = []) {
    const ps = inst("RS-043", "ps");
    let state = mk({
      phase: "battle",
      player1: { rush: [ps, ...extraRush], power },
      player2: { power: powers(3, "opp"), deck: deck(3, "od") },
    });
    state = enterBattle(state, "player1", ps.instanceId);
    return { ps, state };
  }

  it("RS-043: カタログのテキストが修正後テキストと一致する（出典: 08-errata R-ERR-RS043 / atwiki/page-280）", () => {
    expectTextMatches("RS-043", SOURCE);
  });

  it("RS-043: OT の Mユニット BP6000・SP！・必要パワー5+・追加条件「自軍Sユニットを1体パワーゾーンに送る」・特徴メカ／車両（出典: atwiki/page-280）", () => {
    const def = cardDef("RS-043")!;
    expect(def.category).toBe("OT");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(6000);
    expect(def.sp).toBe("special");
    expect(def.powerCost).toBe("5+");
    expect(def.rushAdditionalCondition?.text).toBe("自軍Sユニットを1体パワーゾーンに送る");
    expect(def.features).toEqual(["メカ", "車両"]);
  });

  it("RS-043: 自軍Sユニットを1体パワーゾーンに送ってラッシュできる（出典: atwiki/page-280 追加条件）", () => {
    const ps = inst("RS-043", "ps");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({ player1: { hand: [ps], rush: [s], power: powers(5), command: [released(CMD.OT, "c")] } });
    const next = rush(state, "player1", ps.instanceId, s.instanceId);
    expect(zoneOf(next, "player1", ps.instanceId)).toBe("rush");
    expect(zoneOf(next, "player1", s.instanceId)).toBe("power");
  });

  it("RS-043: 自軍Sユニットがいなければラッシュできない（Mユニットは送れない）（出典: atwiki/page-280「自軍Sユニットを1体」）", () => {
    const ps = inst("RS-043", "ps");
    const m = inst("SPEC-M-4000", "m");
    const state = mk({ player1: { hand: [ps], rush: [m], power: powers(5), command: [released(CMD.OT, "c")] } });
    const r = tryRush(state, "player1", ps.instanceId, m.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", ps.instanceId) === "rush").toBe(false);
  });

  it("RS-043: パワー4ではラッシュできない（出典: atwiki/page-280 必要パワー5+）", () => {
    const ps = inst("RS-043", "ps");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({ player1: { hand: [ps], rush: [s], power: powers(4), command: [released(CMD.OT, "c")] } });
    const r = tryRush(state, "player1", ps.instanceId, s.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", ps.instanceId) === "rush").toBe(false);
  });

  it("RS-043: 自軍ターン中にバトルエリアに出たとき、パワー2枚を捨札にすると「SP1」を得てストライクできる（出典: 修正後テキスト）", () => {
    let { ps, state } = entered(powers(2));
    state = choosePowers(state, 2);
    expect(state.players.player1.power).toHaveLength(0);
    expect(canStrike(state, "player1", ps.instanceId)).toBe(true);
    expect(strikeDamage(state, "player1", ps.instanceId)).toBe(1);
  });

  it("RS-043: 発動しなければ SP！のままでストライクできない（出典: 修正後テキスト「してもよい」/ R-STK-02）", () => {
    let { ps, state } = entered(powers(2));
    expect(legal(state).some((a) => a.type === "skip_effect_choice" && a.playerId === "player1")).toBe(true);
    state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    expect(canStrike(state, "player1", ps.instanceId)).toBe(false);
  });

  it("RS-043: ダメージ以外のカードが1枚しかなければ発動できない（出典: 修正後テキスト「2枚選んで」）", () => {
    const { state } = entered([...powers(1), damageCard("dmg")]);
    expect(state.pendingEffectChoice?.effectId).not.toBe("judgment_sword");
  });

  it("RS-043: ダメージのカード（ウラ向き）は選べない（出典: 修正後テキスト「ダメージ以外のカード」）", () => {
    const { state } = entered([...powers(2), damageCard("dmg")]);
    expect(choiceOptions(state, "player1")).not.toContain("TST-P:dmg");
  });

  it.todo(
    "RS-043: 敵軍ターン中にバトルエリアに出たときは発動しない（出典: 修正後テキスト「自軍ターン中、」）— 敵軍ターン中に自軍のパトストライカーをバトルエリアに出す公開アクション経路が見つからず再現できない",
  );

  it("RS-043: 2体それぞれの発動は別々に操作する（1回の支払いで SP1 を得るのは出た1体だけ）（出典: grnrngr/faq-card-1 RS-051 Q2）", () => {
    // 「「RS-043 パトストライカー」の効果も、それぞれの発動条件は別々に操作して行う必要があります」
    const ps2 = inst("RS-043", "ps2");
    let { ps, state } = entered(powers(4), [ps2]);
    state = choosePowers(state, 2);
    state = enterBattle(state, "player1", ps2.instanceId);
    // 2体目が出たときに改めて選択が開く
    expect(state.pendingEffectChoice?.effectId).toBe("judgment_sword");
    state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    expect(canStrike(state, "player1", ps2.instanceId)).toBe(false);
    expect(findCard(state, "player1", ps.instanceId)).toBeDefined();
  });

  it.todo(
    "RS-043: ライド中の宇宙刑事ギャバンを追加条件に指定し、チェイスを発動すると追加条件を満たせずラッシュできない（出典: atwiki/page-280 Q）— 追加条件の支払い途中でチェイスを差し込む公開アクションが確認できず再現できない",
  );
});

// ===========================================================================
describe("RS-044 パトジャイラー", () => {
  it("RS-044: テキストは「なし」（カタログにも効果テキストがない）（出典: atwiki/page-281 テキスト：なし）", () => {
    expect(cardDef("RS-044")).toBeDefined();
    expect(engineText("RS-044").trim()).toBe("");
  });

  it("RS-044: OT の Mユニット BP4000・SP1・必要パワー7+・追加条件「自軍Sユニットを1体パワーゾーンに送る」・特徴メカ／航空機（出典: atwiki/page-281）", () => {
    const def = cardDef("RS-044")!;
    expect(def.category).toBe("OT");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(4000);
    expect(def.sp).toBe(1);
    expect(def.powerCost).toBe("7+");
    expect(def.rushAdditionalCondition?.text).toBe("自軍Sユニットを1体パワーゾーンに送る");
    expect(def.features).toEqual(["メカ", "航空機"]);
  });

  it("RS-044: パワー7と自軍Sユニット1体（パワーゾーンへ）でラッシュできる（出典: atwiki/page-281 必要パワー7+／追加条件）", () => {
    const gy = inst("RS-044", "gy");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({ player1: { hand: [gy], rush: [s], power: powers(7), command: [released(CMD.OT, "c")] } });
    const next = rush(state, "player1", gy.instanceId, s.instanceId);
    expect(zoneOf(next, "player1", gy.instanceId)).toBe("rush");
    expect(zoneOf(next, "player1", s.instanceId)).toBe("power");
  });

  it("RS-044: パワー6ではラッシュできない（出典: atwiki/page-281 必要パワー7+）", () => {
    const gy = inst("RS-044", "gy");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({ player1: { hand: [gy], rush: [s], power: powers(6), command: [released(CMD.OT, "c")] } });
    const r = tryRush(state, "player1", gy.instanceId, s.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", gy.instanceId) === "rush").toBe(false);
  });

  it("RS-044: SP1 なのでバトルエリアに出ればストライクできる（出典: atwiki/page-281 SP：1）", () => {
    const gy = inst("RS-044", "gy");
    let state = mk({ phase: "battle", player1: { rush: [gy] } });
    state = enterBattle(state, "player1", gy.instanceId);
    expect(canStrike(state, "player1", gy.instanceId)).toBe(true);
  });
});

// ===========================================================================
describe("RS-045 パトレーラー", () => {
  const SOURCE =
    "【シグナルキャノン】これが自軍ラッシュエリアにあるとき、「OT」の自軍Mユニットは、アタックされるときBP+1000される。";

  const EXTRA = {
    "SPEC-S-5500": unitDef("SPEC-S-5500", { bp: 5500, size: "S" }),
    "SPEC-S-6500": unitDef("SPEC-S-6500", { bp: 6500, size: "S" }),
    "SPEC-S-OT-5000": unitDef("SPEC-S-OT-5000", { bp: 5000, size: "S", category: "OT" }),
  };

  /** 敵軍（player2 のターン）が自軍 OT M(5000) にアタックする。 */
  function attackedSetup(rushArea: CardInstance[], defenderId = "SPEC-M-OT-5000", attackerId = "SPEC-S-5500") {
    const mine = inst(defenderId, "mine");
    const enemy = inst(attackerId, "enemy");
    let state = mk({
      phase: "battle",
      activePlayer: "player2",
      definitions: EXTRA,
      player1: { rush: rushArea, battle: [mine] },
      player2: { battle: [enemy] },
    });
    state = passReactions(attack(state, "player2", enemy.instanceId, mine.instanceId));
    return { mine, enemy, state };
  }

  it("RS-045: カタログのテキストが原文と一致する（出典: atwiki/page-282 テキスト）", () => {
    expectTextMatches("RS-045", SOURCE);
  });

  it("RS-045: OT の Mユニット BP5000・SP空欄・必要パワー4+・追加条件「自軍Sユニットを1体パワーゾーンに送る」・特徴メカ／車両（出典: atwiki/page-282）", () => {
    const def = cardDef("RS-045")!;
    expect(def.category).toBe("OT");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(5000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe("4+");
    expect(def.rushAdditionalCondition?.text).toBe("自軍Sユニットを1体パワーゾーンに送る");
    expect(def.features).toEqual(["メカ", "車両"]);
  });

  it("RS-045: パワー4と自軍Sユニット1体（パワーゾーンへ）でラッシュできる（出典: atwiki/page-282 必要パワー4+／追加条件）", () => {
    const pt = inst("RS-045", "pt");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({ player1: { hand: [pt], rush: [s], power: powers(4), command: [released(CMD.OT, "c")] } });
    const next = rush(state, "player1", pt.instanceId, s.instanceId);
    expect(zoneOf(next, "player1", pt.instanceId)).toBe("rush");
    expect(zoneOf(next, "player1", s.instanceId)).toBe("power");
  });

  it("RS-045: 自軍ラッシュエリアにあるとき、OT の自軍Mユニットはアタックされるとき BP+1000（5000+1000 > 5500 で勝つ）（出典: atwiki/page-282【シグナルキャノン】）", () => {
    const { mine, enemy, state } = attackedSetup([inst("RS-045", "pt")]);
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("battle");
    expect(zoneOf(state, "player2", enemy.instanceId)).toBe("discard");
  });

  it("RS-045: パトレーラーがいなければ 5000 < 5500 で負ける（対照）（出典: R-BTL-01）", () => {
    const { mine, state } = attackedSetup([]);
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("discard");
  });

  it("RS-045: アタックするときは BP+1000 されない（出典: atwiki/page-282「アタックされるとき」）", () => {
    const mine = inst("SPEC-M-OT-5000", "mine");
    const enemy = inst("SPEC-S-5500", "enemy");
    let state = mk({
      phase: "battle",
      definitions: EXTRA,
      player1: { rush: [inst("RS-045", "pt")], battle: [mine] },
      player2: { battle: [enemy] },
    });
    state = passReactions(attack(state, "player1", mine.instanceId, enemy.instanceId));
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("discard");
  });

  it("RS-045: OT の Sユニットには効果がない（出典: atwiki/page-282「自軍Mユニット」）", () => {
    const { mine, state } = attackedSetup([inst("RS-045", "pt")], "SPEC-S-OT-5000");
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("discard");
  });

  it("RS-045: OT 以外の Mユニットには効果がない（出典: atwiki/page-282「OT」の自軍Mユニット）", () => {
    const { mine, state } = attackedSetup([inst("RS-045", "pt")], "SPEC-M-ET-5000");
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("discard");
  });

  it("RS-045: バトルエリアにあるパトレーラーでは効果がない（出典: atwiki/page-282「これが自軍ラッシュエリアにあるとき」）", () => {
    const mine = inst("SPEC-M-OT-5000", "mine");
    const enemy = inst("SPEC-S-5500", "enemy");
    let state = mk({
      phase: "battle",
      activePlayer: "player2",
      definitions: EXTRA,
      player1: { battle: [inst("RS-045", "pt"), mine] },
      player2: { battle: [enemy] },
    });
    state = passReactions(attack(state, "player2", enemy.instanceId, mine.instanceId));
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("discard");
  });

  it("RS-045: 2体あれば効果は重複する（5000+2000 > 6500 で勝つ）（出典: grnrngr/faq-card-1 RS-045 Q）", () => {
    // 「はい、その通りです。」
    const { mine, enemy, state } = attackedSetup(
      [inst("RS-045", "pt1"), inst("RS-045", "pt2")],
      "SPEC-M-OT-5000",
      "SPEC-S-6500",
    );
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("battle");
    expect(zoneOf(state, "player2", enemy.instanceId)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-046 パトアーマー", () => {
  const SOURCE =
    "【アーマーアタック】これをラッシュしたとき発動できる。敵軍バトルエリアからBP8000以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る。";

  function setup(p1: Record<string, unknown> = {}, p2: Record<string, unknown> = {}) {
    const pa = inst("RS-046", "pa");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({
      player1: { hand: [pa], rush: [s], power: powers(5), command: [released(CMD.OT, "c")], ...p1 },
      player2: { ...p2 },
    });
    return { pa, state: rush(state, "player1", pa.instanceId, s.instanceId) };
  }

  it("RS-046: カタログのテキストが原文と一致する（出典: atwiki/page-283 テキスト）", () => {
    expectTextMatches("RS-046", SOURCE);
  });

  it("RS-046: OT の Mユニット BP5000・SP空欄・必要パワー5+・追加条件「自軍Sユニットを1体パワーゾーンに送る」・特徴メカ／車両（出典: atwiki/page-283）", () => {
    const def = cardDef("RS-046")!;
    expect(def.category).toBe("OT");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(5000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe("5+");
    expect(def.rushAdditionalCondition?.text).toBe("自軍Sユニットを1体パワーゾーンに送る");
    expect(def.features).toEqual(["メカ", "車両"]);
  });

  it("RS-046: ラッシュしたとき、敵軍バトルエリアの BP8000 以下のユニットを持ち主のパワーゾーンに送る（出典: atwiki/page-283【アーマーアタック】）", () => {
    const enemy = inst("SPEC-S-8000", "enemy");
    let { state } = setup({}, { battle: [enemy] });
    expect(choiceOptions(state, "player1")).toContain(enemy.instanceId);
    state = choose(state, "player1", enemy.instanceId);
    expect(zoneOf(state, "player2", enemy.instanceId)).toBe("power");
  });

  it("RS-046: BP9000 のユニット・敵軍ラッシュエリアのユニット・自軍ユニットは選べない（出典: atwiki/page-283「敵軍バトルエリアからBP8000以下」）", () => {
    const big = inst("SPEC-S-9000", "big");
    const inRush = inst("SPEC-S-1000", "inRush");
    const own = inst("SPEC-S-1000", "own");
    const ok = inst("SPEC-S-1000", "ok");
    const { state } = setup({ battle: [own] }, { battle: [big, ok], rush: [inRush] });
    const opts = choiceOptions(state, "player1");
    expect(opts).toContain(ok.instanceId);
    expect(opts).not.toContain(big.instanceId);
    expect(opts).not.toContain(inRush.instanceId);
    expect(opts).not.toContain(own.instanceId);
  });

  it("RS-046: 発動は任意（発動できる）（出典: atwiki/page-283「発動できる」）", () => {
    const enemy = inst("SPEC-S-1000", "enemy");
    let { state } = setup({}, { battle: [enemy] });
    expect(legal(state).some((a) => a.type === "skip_effect_choice" && a.playerId === "player1")).toBe(true);
    state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(state, "player2", enemy.instanceId)).toBe("battle");
  });

  it("RS-046: 送られたユニットのカードはパワーゾーンにオモテ向き（ダメージではない）で置かれる（出典: R-TGT-01 / RS-024 Q と同旨の「パワーゾーンに送る」）", () => {
    const enemy = inst("SPEC-S-1000", "enemy");
    let { state } = setup({}, { battle: [enemy] });
    state = choose(state, "player1", enemy.instanceId);
    expect(findCard(state, "player2", enemy.instanceId)?.faceDown ?? false).toBe(false);
    expect(state.players.player2.damage).toBe(0);
  });

  it("RS-046: パワー4ではラッシュできない（出典: atwiki/page-283 必要パワー5+）", () => {
    const pa = inst("RS-046", "pa");
    const s = inst("SPEC-S-1000", "s");
    const state = mk({ player1: { hand: [pa], rush: [s], power: powers(4), command: [released(CMD.OT, "c")] } });
    const r = tryRush(state, "player1", pa.instanceId, s.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", pa.instanceId) === "rush").toBe(false);
    expect(canUse(state, "player1", pa.instanceId)).toBe(false);
  });
});
