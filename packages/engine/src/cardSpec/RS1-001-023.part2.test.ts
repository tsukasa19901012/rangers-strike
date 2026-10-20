/**
 * cardSpec: 英雄の再誕 RS-009〜RS-016
 *
 * 出典（優先順）:
 *  1. docs/rules/08-errata.md / grnrngr faq/card_1.html（公式Q&A）
 *  2. docs/wiki/sources/atwiki/page-N-RS-0NN.md（カードテキスト・atwiki 転載 Q&A）
 *  3. docs/rules/*.md（一般ルール）
 * 期待値は出典に従う。エンジンが違えば it.fails（既知の不具合）として残す。
 * atwiki の Q 番号を使う（公式 card_1.html の同じ問いは本文で併記）。
 */
import { afterEach, describe, expect, it } from "vitest";
import { getAuraPowerInstanceId, getComboNumberDelta } from "../rules/turnModifierBridge";
import { ON_RUSH_EFFECTS } from "../rules/rushEffects";
import { effectiveComboNumber } from "../core/catalog";
import {
  act,
  actLegal,
  bpOf,
  canPlayOp,
  canUseCounter,
  cardDef,
  deckCards,
  expectSourceText,
  hasLegal,
  held,
  inst,
  legal,
  legalOfType,
  playCounter,
  playOp,
  powerCards,
  released,
  sDef,
  specState,
  tryAct,
  zoneIds,
  zoneOf,
} from "./RS1-001-023.helpers";
import type { GameState } from "../types/game";

function enter(s: GameState, instanceId: string, playerId: "player1" | "player2" = "player1"): GameState {
  let n = actLegal(s, (a) => a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === instanceId);
  for (let i = 0; i < 6 && hasLegal(n, (a) => a.type === "pass_battle_entry"); i += 1) {
    n = actLegal(n, (a) => a.type === "pass_battle_entry");
  }
  return n;
}

/** 進入時の選択・支払いを処理しきる（先頭の候補を選ぶ）。 */
function drain(s: GameState, playerId: "player1" | "player2"): GameState {
  let n = s;
  for (let i = 0; i < 8; i += 1) {
    if (n.pendingCommandPayment?.playerId === playerId) {
      const p = n.pendingCommandPayment;
      n = act(n, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
      continue;
    }
    if (n.pendingEffectChoice?.playerId === playerId) {
      const skip = legal(n).find((a) => a.type === "skip_effect_choice");
      if (skip) { n = act(n, skip); continue; }
      const pick = legalOfType(n, "resolve_effect_choice")[0];
      if (pick) { n = act(n, pick); continue; }
    }
    break;
  }
  return n;
}

// ===========================================================================
describe("RS-009 パワーバズーカ", () => {
  const TEXT =
    "敵軍Ｌユニットを１体選んで撃破する。そうして撃破したＬユニットが捨札になったとき、相手はそのＬユニットの合体に必要なユニットのカードを捨札から探してバトルエリアに戻す。このとき、戻したユニットの効果は発動しない。";

  function bazState(p2: { battle: ReturnType<typeof inst>[]; discard?: ReturnType<typeof inst>[]; released?: number; operation?: ReturnType<typeof inst>[] }, p1Extra: { battle?: ReturnType<typeof inst>[] } = {}) {
    const baz = inst("RS-009", "baz");
    const s = specState(["RS-009", "RS-034", "RS-035", "RS-050", "RS-051", "RS-052", "RS-053", "RS-226", "RS-227", "RS-228", "XG6-018"], {
      phase: "rush",
      player1: { hand: [baz], command: [held("TST-OP-ET", "c1")], power: powerCards(8), battle: p1Extra.battle ?? [] },
      player2: {
        battle: p2.battle,
        discard: p2.discard ?? [],
        command: Array.from({ length: p2.released ?? 0 }, (_, i) => released("TST-OP", `x${i}`)),
        operation: p2.operation ?? [],
      },
    });
    return { s, baz };
  }

  function fire(s: GameState, baz: string, target: string): GameState {
    return playOp(s, baz, { targetInstanceId: target });
  }

  it("RS-009: カタログ本文がエラッタ後の正文と一致する（出典: grnrngr/errata RS-009、docs/rules/08-errata.md R-ERR-RS009）", () => {
    // 正:「そうして撃破したＬユニットが捨札になったとき」
    expectSourceText("RS-009", TEXT);
    expect(cardDef("RS-009")?.powerCost).toBe(8);
  });

  it("RS-009: 必要パワー8 — パワー7では使用できない（出典: atwiki/page-252 必要パワー：8）", () => {
    const { s: s0, baz } = bazState({ battle: [inst("RS-050", "ao")] });
    const s: GameState = { ...s0, players: { ...s0.players, player1: { ...s0.players.player1, power: powerCards(7) } } };
    expect(canPlayOp(s, baz.instanceId)).toBe(false);
  });

  it("RS-009: 敵軍Lユニットを撃破して捨札にする（出典: grnrngr/errata RS-009 「敵軍Ｌユニットを１体選んで撃破する」）", () => {
    const ao = inst("RS-050", "ao");
    const { s: s0, baz } = bazState({ battle: [ao] });
    const s = fire(s0, baz.instanceId, ao.instanceId);
    expect(zoneOf(s, "player2", ao.instanceId)).toBe("discard");
  });

  it("RS-009: S／Mユニットは選べない（出典: grnrngr/errata RS-009 「敵軍Ｌユニット」）", () => {
    const m = inst("CS-M", "m");
    const sU = inst("CS-S1", "s");
    const { s, baz } = bazState({ battle: [m, sU] });
    const targets = legalOfType(s, "play_operation").filter((a) => a.instanceId === baz.instanceId).map((a) => a.targetInstanceId);
    expect(targets).not.toContain(m.instanceId);
    expect(targets).not.toContain(sU.instanceId);
  });

  it("RS-009: 捨札になったLユニットの合体素材を捨札からバトルエリアに戻す（出典: grnrngr/errata RS-009）", () => {
    const ao = inst("RS-050", "ao");
    const m = [inst("RS-051", "m1"), inst("RS-052", "m2"), inst("RS-053", "m3")];
    const { s: s0, baz } = bazState({ battle: [ao], discard: m, released: 3 });
    const s = drain(fire(s0, baz.instanceId, ao.instanceId), "player2");
    expect(zoneIds(s, "player2", "battle")).toEqual(expect.arrayContaining(m.map((c) => c.instanceId)));
  });

  it("RS-009: 戻したユニットの効果（ラッシュしたとき）は発動しない（出典: grnrngr/errata RS-009 「戻したユニットの効果は発動しない」）", () => {
    // 大獣神（RS-034）の素材 守護獣ティラノザウルス【ティラノソニック】「これをラッシュしたとき…撃破してもよい」
    const dai = inst("RS-034", "dai");
    const tyr = inst("RS-035", "tyr");
    const mine = inst("CS-S1", "mine");
    const { s: s0, baz } = bazState({ battle: [dai], discard: [tyr], released: 1 }, { battle: [mine] });
    const s = drain(fire(s0, baz.instanceId, dai.instanceId), "player2");
    expect(zoneOf(s, "player2", tyr.instanceId)).toBe("battle");
    expect(zoneOf(s, "player1", mine.instanceId)).toBe("battle");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-009: atwiki Q&A — キラーオーの素材としてアバレキラーと爆竜トップゲイラーの両方は戻せない（出典: atwiki/page-252 Q1）", () => {
    // 「アバレキラー」を選んだ時点で「トップゲイラー」と「ステゴスライドン」の両方を選んだとして扱われます
    const ko = inst("RS-226", "ko");
    const abaKiller = inst("XG6-018", "ak");
    const top = inst("RS-227", "top");
    const { s: s0, baz } = bazState({ battle: [ko], discard: [abaKiller, top], released: 3 });
    const s = drain(fire(s0, baz.instanceId, ko.instanceId), "player2");
    const back = zoneIds(s, "player2", "battle");
    expect(back.includes(abaKiller.instanceId) && back.includes(top.instanceId)).toBe(false);
  });

  it("RS-009: atwiki Q&A — アバレキラーは「トップゲイラー＋ステゴスライドン」としてキラーオーの素材に選んで戻せる（出典: atwiki/page-252 Q1）", () => {
    const ko = inst("RS-226", "ko");
    const abaKiller = inst("XG6-018", "ak");
    const { s: s0, baz } = bazState({ battle: [ko], discard: [abaKiller], released: 3 });
    const s = drain(fire(s0, baz.instanceId, ko.instanceId), "player2");
    expect(zoneOf(s, "player2", abaKiller.instanceId)).toBe("battle");
  });

  it("RS-009: atwiki Q&A — 戻す素材は必要パワー・追加条件を満たさなくてよい（出典: atwiki/page-252 Q2、grnrngr/faq-card-1 RS-009）", () => {
    // 「必要パワーも追加条件も満たす必要はありません」（相手のパワーは0枚）
    const dai = inst("RS-034", "dai");
    const tyr = inst("RS-035", "tyr");
    const { s: s0, baz } = bazState({ battle: [dai], discard: [tyr], released: 1 });
    expect(s0.players.player2.power).toHaveLength(0);
    const s = drain(fire(s0, baz.instanceId, dai.instanceId), "player2");
    expect(zoneOf(s, "player2", tyr.instanceId)).toBe("battle");
  });

  it("RS-009: atwiki Q&A — 戻した素材はラッシュエリアを経由せずバトルエリアに出る（出典: atwiki/page-252 Q3、grnrngr/faq-card-1 RS-009）", () => {
    // 「ラッシュされたとして扱います。ただし、ラッシュエリアを経由することはありません」
    const dai = inst("RS-034", "dai");
    const tyr = inst("RS-035", "tyr");
    const { s: s0, baz } = bazState({ battle: [dai], discard: [tyr], released: 1 });
    const s = drain(fire(s0, baz.instanceId, dai.instanceId), "player2");
    expect(zoneOf(s, "player2", tyr.instanceId)).toBe("battle");
    expect(s.players.player2.rush).toHaveLength(0);
  });

  it("RS-009: atwiki Q&A — 「ホールドしなければ出られない」素材は1体ごとにホールドし、できなくなったら終了（出典: atwiki/page-252 Q4、grnrngr/faq-card-1 RS-009）", () => {
    // 「ホールドするコマンドがなくなって、バトルエリアに出せなくなった場合は、そこでその効果は終了」
    const ao = inst("RS-050", "ao");
    const m = [inst("RS-051", "m1"), inst("RS-052", "m2"), inst("RS-053", "m3")];
    const { s: s0, baz } = bazState({ battle: [ao], discard: m, released: 1 });
    const s = drain(fire(s0, baz.instanceId, ao.instanceId), "player2");
    expect(s.players.player2.battle).toHaveLength(1);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RS-009: atwiki Q&A — 手札からのラッシュと違い、カテゴリのコマンドをホールドしなくてよい（出典: atwiki/page-252 Q5、grnrngr/faq-card-1 RS-009）", () => {
    // 「いいえ、ホールドしなくても構いません」— ※ホールド要求のない素材（RS-073 サンバルカンロボの RS-074）
    const robo = { ...inst("RS-073", "robo"), zordMaterialCardId: "RS-074" };
    const cosmo = inst("RS-074", "cosmo");
    const baz = inst("RS-009", "baz");
    let s = specState(["RS-009", "RS-073", "RS-074"], {
      phase: "rush",
      player1: { hand: [baz], command: [held("TST-OP-ET", "c1")], power: powerCards(8) },
      player2: { battle: [robo], discard: [cosmo], command: [] },
    });
    s = drain(fire(s, baz.instanceId, robo.instanceId), "player2");
    expect(zoneOf(s, "player2", cosmo.instanceId)).toBe("battle");
  });

  it("RS-009: atwiki Q&A — 捨札にある素材（爆竜プテラノドン）だけを戻す（出典: atwiki/page-252 Q6、grnrngr/faq-card-1 RS-009）", () => {
    // 「「RS-053 爆竜プテラノドン」だけをバトルエリアに戻します」
    const ao = inst("RS-050", "ao");
    const ptera = inst("RS-053", "pt");
    const { s: s0, baz } = bazState({ battle: [ao], discard: [ptera], released: 3 });
    const s = drain(fire(s0, baz.instanceId, ao.instanceId), "player2");
    expect(s.players.player2.battle.map((c) => c.cardId)).toEqual(["RS-053"]);
  });

  it("RS-009: atwiki Q&A — 【超シールド進化】で捨札にならなかったLユニットの素材は戻らない（出典: atwiki/page-252 Q7、grnrngr/faq-card-1 RS-009）", () => {
    // 「撃破したＬユニットが捨札になったときのみ…戻します」
    const ao = inst("RS-050", "ao");
    const tri = inst("RS-052", "tri");
    const m1 = inst("RS-051", "m1");
    const m3 = inst("RS-053", "m3");
    const { s: s0, baz } = bazState({ battle: [ao, tri], discard: [m1, m3], released: 3 });
    let s = fire(s0, baz.instanceId, ao.instanceId);
    s = actLegal(s, (a) => a.type === "use_super_shield");
    expect(zoneIds(s, "player2", "battle")).toEqual([ao.instanceId]);
    expect(zoneIds(s, "player2", "discard")).toEqual(expect.arrayContaining([m1.instanceId, m3.instanceId, tri.instanceId]));
  });
});

// ===========================================================================
describe("RS-010 プリズムパワー", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分がカードを使用するとき発動できる。自軍コマンドを2つホールドすることで、使用するカードに必要なカテゴリのコマンドを1つホールドしたことにできる。";

  /** OT のカード（超電子頭脳）を使う状況。OT コマンドは別のカードの支払いで使用済み。 */
  function prismState(withPrism: boolean, releasedEt = 2) {
    const op = inst("RS-008", "brainHand");
    const s = specState(["RS-010", "RS-008"], {
      phase: "rush",
      player1: {
        hand: [op],
        operation: withPrism ? [inst("RS-010", "prism")] : [],
        power: powerCards(3),
        command: [
          { ...held("TST-OP-OT", "ot"), paymentHeld: true },
          ...Array.from({ length: releasedEt }, (_, i) => released("TST-OP-ET", `e${i}`)),
        ],
      },
    });
    return { s, op };
  }

  it("RS-010: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-276）", () => {
    expectSourceText("RS-010", TEXT);
    expect(cardDef("RS-010")?.tags).toContain("常駐");
    expect(cardDef("RS-010")?.powerCost).toBe(2);
  });

  it("RS-010: 他カテゴリのコマンド2つをホールドして、必要カテゴリのコマンド1つのホールドに代えて使用できる（出典: atwiki/page-276）", () => {
    const { s: s0, op } = prismState(true);
    const pay = legal(s0).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === op.instanceId && a.prismSubstitute === true);
    expect(pay).toBeDefined();
    const s = act(s0, pay!);
    expect(zoneOf(s, "player1", op.instanceId)).toBe("operation");
    expect(s.players.player1.command.filter((c) => c.cardId === "TST-OP-ET" && c.commandHeld)).toHaveLength(2);
  });

  it("RS-010: プリズムパワーがなければ同じ状況で使用できない（出典: atwiki/page-276）", () => {
    const { s, op } = prismState(false);
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-010: ホールドできるリリース状態のコマンドが1つでは代用できない（出典: atwiki/page-276 「自軍コマンドを2つホールドする」）", () => {
    const { s, op } = prismState(true, 1);
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-010: ユニットのラッシュ（カードの使用）にも使える（出典: atwiki/page-276 「自分がカードを使用するとき」）", () => {
    const unit = inst("CS-S1", "wbUnit");
    let s = specState(["RS-010"], {
      phase: "rush",
      player1: {
        hand: [unit],
        operation: [inst("RS-010", "prism")],
        command: [{ ...held("TST-OP", "wb"), paymentHeld: true }, released("TST-OP-ET", "e1"), released("TST-OP-ET", "e2")],
      },
    });
    s = actLegal(s, (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === unit.instanceId && a.prismSubstitute === true);
    if (!zoneOf(s, "player1", unit.instanceId)?.startsWith("rush")) {
      s = actLegal(s, (a) => a.type === "rush" && a.instanceId === unit.instanceId);
    }
    expect(zoneOf(s, "player1", unit.instanceId)).toBe("rush");
  });

  it("RS-010: 公式Q&A — ジャガーバルカンの追加条件の代わりのホールドはプリズムパワーで代用できない（出典: grnrngr/faq-card-1 RS-010 Q1）", () => {
    // 「本来はコマンドのホールドを必要としていないので…代用することはできません」
    // コスモバルカン（ET・M）: 追加条件「自軍Sユニットを1体コマンドゾーンに送る」。Sユニットなし、ETコマンドは使用済み、WBが4つ。
    const cosmo = inst("RS-074", "cosmo");
    const s0 = specState(["RS-010", "RS-074", "RS-076"], {
      phase: "rush",
      player1: {
        hand: [cosmo],
        operation: [inst("RS-010", "prism")],
        rush: [inst("RS-076", "jaguar")],
        power: powerCards(4),
        command: [
          { ...held("TST-OP-ET", "et"), paymentHeld: true },
          released("TST-OP", "w1"),
          released("TST-OP", "w2"),
          released("TST-OP", "w3"),
          released("TST-OP", "w4"),
        ],
      },
    });
    let r = tryAct(s0, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: cosmo.instanceId });
    if (r) r = tryAct(r, { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" });
    if (r && r.pendingZordSetup) r = tryAct(r, { type: "resolve_zord_setup", playerId: "player1" });
    const queue = ["TST-OP:w1", "TST-OP:w2", "TST-OP:w3", "TST-OP:w4"];
    for (let i = 0; r && i < 4 && r.pendingCommandPayment; i += 1) {
      const need = r.pendingCommandPayment.totalNeeded;
      r = tryAct(r, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: queue.splice(0, need) });
    }
    expect(r === null || zoneOf(r, "player1", cosmo.instanceId) !== "rush").toBe(true);
  });

  it("RS-010: 公式Q&A — プリズムパワーのためにホールドしたキバでは【ファンガイアの王】は誘発しない（出典: grnrngr/faq-card-1 RS-010 Q2、atwiki/page-276 Q2）", () => {
    // 「プリズムパワーの効果を得る為にホールドされたものなので…該当しないからです」
    const daUnit = inst("CS-DA", "da");
    const kiva1 = released("XG5-074", "k1");
    const kiva2 = released("XG5-074", "k2");
    const s0 = specState(["RS-010", "XG5-074"], {
      phase: "rush",
      extraDefs: { "CS-DA": sDef("CS-DA", { category: "DA", bp: 2000, sp: undefined }) },
      // DA のコマンドは別のカードの支払いで使用済み。リリース状態はキバ2枚だけ。
      player1: { hand: [daUnit], operation: [inst("RS-010", "prism")], command: [{ ...held("TST-OP-DA", "da"), paymentHeld: true }, kiva1, kiva2] },
    });
    const pay = legal(s0).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === daUnit.instanceId && a.prismSubstitute === true);
    expect(pay).toBeDefined();
    let s = act(s0, pay!);
    expect(s.players.player1.command.filter((c) => c.cardId === "XG5-074" && c.commandHeld)).toHaveLength(2);
    if (zoneOf(s, "player1", daUnit.instanceId) !== "rush") s = actLegal(s, (a) => a.type === "rush" && a.instanceId === daUnit.instanceId);
    expect(zoneOf(s, "player1", daUnit.instanceId)).toBe("rush");
    expect(bpOf(s, "player1", daUnit.instanceId)).toBe(2000);
  });
});

// ===========================================================================
describe("RS-011 オーラパワー", () => {
  const TEXT = "自軍Sユニットを1体選ぶ。このターン、選んだユニットは自軍ダメージ1点につきBP＋2000される。";

  function auraState(target: ReturnType<typeof inst>, damage: number) {
    const op = inst("RS-011", "op");
    const s = specState(["RS-011"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(2), command: [held("TST-OP-MA", "c")], rush: [target], damage },
    });
    return { s, op };
  }

  it("RS-011: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-241）", () => {
    expectSourceText("RS-011", TEXT);
    expect(cardDef("RS-011")?.powerCost).toBe(2);
    expect(cardDef("RS-011")?.category).toBe("MA");
  });

  it("RS-011: 選んだSユニットは自軍ダメージ1点につきBP+2000（出典: atwiki/page-241）", () => {
    const u = inst("CS-S1", "u");
    const { s: s0, op } = auraState(u, 3);
    const s = playOp(s0, op.instanceId, { targetInstanceId: u.instanceId });
    expect(bpOf(s, "player1", u.instanceId)).toBe(1000 + 3 * 2000);
  });

  it("RS-011: ダメージが増えればその分BPも上がる（出典: atwiki/page-241 「自軍ダメージ1点につき」）", () => {
    const u = inst("CS-S1", "u");
    const { s: s0, op } = auraState(u, 1);
    let s = playOp(s0, op.instanceId, { targetInstanceId: u.instanceId });
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, damage: 4 } } };
    expect(bpOf(s, "player1", u.instanceId)).toBe(1000 + 4 * 2000);
  });

  it("RS-011: Mユニットや敵軍ユニットは選べない（出典: atwiki/page-241 「自軍Sユニットを1体選ぶ」）", () => {
    const m = inst("CS-M", "m");
    const enemy = inst("CS-S1", "e");
    const op = inst("RS-011", "op");
    const s = specState(["RS-011"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(2), command: [held("TST-OP-MA", "c")], rush: [m] },
      player2: { rush: [enemy] },
    });
    const targets = legalOfType(s, "play_operation").filter((a) => a.instanceId === op.instanceId).map((a) => a.targetInstanceId);
    expect(targets).not.toContain(m.instanceId);
    expect(targets).not.toContain(enemy.instanceId);
  });

  it("RS-011: 効果は「このターン」だけ（次のターンには残らない）（出典: atwiki/page-241 「このターン、」）", () => {
    const u = inst("CS-S1", "u");
    const { s: s0, op } = auraState(u, 2);
    let s = playOp(s0, op.instanceId, { targetInstanceId: u.instanceId });
    expect(getAuraPowerInstanceId(s.players.player1)).toBe(u.instanceId);
    s = actLegal(s, (a) => a.type === "end_phase");
    s = actLegal(s, (a) => a.type === "end_phase");
    for (let i = 0; i < 10 && s.activePlayer === "player1"; i += 1) {
      s = actLegal(s, (a) => a.type === "end_phase" || a.type === "draw" || a.type === "return_all_battle_to_rush");
    }
    expect(bpOf(s, "player1", u.instanceId)).toBe(1000);
  });

  it.todo(
    "RS-011: 公式Q&A — マジシャインでコマンドゾーンから使ったオーラパワーがゴルゴムの仕業で無効になっても、コマンドを1つ捨札にしてコマンドゾーンに留められる（出典: grnrngr/faq-card-1 RS-011）— RS-325【マジチケット】がエンジン未実装（catchall の注記のみ）でコマンドゾーンから使用する手段がなく検証不能",
  );
});

// ===========================================================================
describe("RS-012 科学アカデミアの科学力", () => {
  const TEXT = "自軍捨札から、特徴「メカ」を持つユニットのカードを1枚選んで手札に加える。";

  function academyState(discard: ReturnType<typeof inst>[], extraDefs = {}) {
    const op = inst("RS-012", "op");
    const s = specState(["RS-012"], {
      phase: "rush",
      extraDefs,
      player1: { hand: [op], power: powerCards(3), command: [held("TST-OP-ET", "c")], discard },
    });
    return { s, op };
  }

  it("RS-012: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-253）", () => {
    expectSourceText("RS-012", TEXT);
    expect(cardDef("RS-012")?.powerCost).toBe(3);
  });

  it("RS-012: 捨札の特徴「メカ」を持つユニットのカードを手札に加える（出典: atwiki/page-253）", () => {
    const mecha = inst("CS-MECHA", "m");
    const { s: s0, op } = academyState([mecha]);
    const s = playOp(s0, op.instanceId, { targetInstanceId: mecha.instanceId });
    expect(zoneOf(s, "player1", mecha.instanceId)).toBe("hand");
  });

  it("RS-012: 特徴「メカ」を持たないユニットは選べない（出典: atwiki/page-253）", () => {
    const plain = inst("CS-S1", "p");
    const { s, op } = academyState([plain]);
    expect(
      legalOfType(s, "play_operation").some((a) => a.instanceId === op.instanceId && a.targetInstanceId === plain.instanceId),
    ).toBe(false);
  });

  it("RS-012: 特徴「メカ」を持つビークルのカードは選べない（出典: atwiki/page-253 「ユニットのカード」、R-CARD-04）", () => {
    const vehicle = inst("CS-VEH-MECHA", "v");
    const { s, op } = academyState([vehicle], {
      "CS-VEH-MECHA": { id: "CS-VEH-MECHA", name: "CS-VEH-MECHA", type: "vehicle", category: "ET", rarity: "N", expansion: "test", powerCost: 0, size: "S", features: ["メカ"] },
    });
    expect(
      legalOfType(s, "play_operation").some((a) => a.instanceId === op.instanceId && a.targetInstanceId === vehicle.instanceId),
    ).toBe(false);
  });
});

// ===========================================================================
describe("RS-013 シーロンの光", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分のラッシュフェイズごとに1度だけ発動できる。自分の手札から相手に1枚選ばせ見せる。ユニットカードが選ばれたならラッシュエリアに出してよい。ただしラッシュのための必要パワーと追加条件は満たすこと。";
  const FX = "CS-S1";
  afterEach(() => {
    delete ON_RUSH_EFFECTS[FX];
  });

  function shironState(hand: ReturnType<typeof inst>[], opts: { power?: number; rush?: ReturnType<typeof inst>[]; command?: ReturnType<typeof inst>[]; p2?: Parameters<typeof specState>[1]["player2"]; phase?: "rush" | "battle" } = {}) {
    return specState(["RS-013", "RS-054", "RS-230", "RS-026"], {
      phase: opts.phase ?? "rush",
      player1: {
        hand,
        operation: [inst("RS-013", "sh")],
        power: powerCards(opts.power ?? 4),
        rush: opts.rush ?? [],
        command: opts.command ?? [],
        deck: deckCards(4),
      },
      player2: opts.p2 ?? { hand: [] },
    });
  }

  function reveal(s: GameState, pick: string, opId = "RS-013:sh"): GameState {
    let n = act(s, { type: "shiron_light", playerId: "player1", operationInstanceId: opId });
    n = act(n, { type: "resolve_effect_choice", playerId: "player2", instanceId: pick });
    n = act(n, { type: "confirm_shiron_reveal", playerId: "player2" });
    return n;
  }

  it("RS-013: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-254）", () => {
    expectSourceText("RS-013", TEXT);
    expect(cardDef("RS-013")?.tags).toContain("常駐");
  });

  it("RS-013: 相手が手札から1枚選び、ユニットカードならラッシュエリアに出せる（出典: atwiki/page-254）", () => {
    const u = inst("CS-S1", "u");
    let s = shironState([u, inst("TST-OP", "o")]);
    s = act(s, { type: "shiron_light", playerId: "player1", operationInstanceId: "RS-013:sh" });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: u.instanceId });
    s = act(s, { type: "confirm_shiron_reveal", playerId: "player2" });
    s = actLegal(s, (a) => a.type === "rush" && a.instanceId === u.instanceId);
    expect(zoneOf(s, "player1", u.instanceId)).toBe("rush");
  });

  it("RS-013: 選ばれたのがユニットカードでなければ出せない（出典: atwiki/page-254 「ユニットカードが選ばれたなら」）", () => {
    const o = inst("TST-OP", "o");
    const s = reveal(shironState([o, inst("CS-S1", "u")]), o.instanceId);
    expect(zoneOf(s, "player1", o.instanceId)).toBe("hand");
    expect(hasLegal(s, (a) => a.type === "rush" && a.instanceId === "CS-S1:u" && !legal(s).some((b) => b.type === "initiate_command_payment" && b.sourceInstanceId === "CS-S1:u"))).toBe(false);
  });

  it("RS-013: 自分のラッシュフェイズごとに1度だけ（2回目は発動できない）（出典: atwiki/page-254）", () => {
    const u = inst("CS-S1", "u");
    let s = reveal(shironState([u, inst("CS-S1", "u2")]), u.instanceId);
    s = actLegal(s, (a) => a.type === "rush" && a.instanceId === u.instanceId);
    expect(legalOfType(s, "shiron_light")).toHaveLength(0);
  });

  it("RS-013: ラッシュフェイズ以外（バトルフェイズ）では発動できない（出典: atwiki/page-254 「自分のラッシュフェイズごとに」）", () => {
    const s = shironState([inst("CS-S1", "u")], { phase: "battle" });
    expect(legalOfType(s, "shiron_light")).toHaveLength(0);
  });

  it("RS-013: 必要パワーを満たさないユニットは出せない（出典: atwiki/page-254 「ただしラッシュのための必要パワー…は満たすこと」）", () => {
    const big = inst("CS-S-ET9", "big");
    const s = reveal(shironState([big], { power: 4 }), big.instanceId);
    expect(hasLegal(s, (a) => a.type === "rush" && a.instanceId === big.instanceId)).toBe(false);
  });

  it("RS-013: 公式Q&A — アバレッドがいればパワー6以下でもアバレッドを捨札にしてアバレッドAMを出せる（出典: grnrngr/faq-card-1 RS-013 Q1）", () => {
    // 「はい、出す事ができます」
    const am = inst("RS-230", "am");
    const red = inst("RS-054", "red");
    let s = reveal(shironState([am], { power: 6, rush: [red] }), am.instanceId);
    const rush = legalOfType(s, "rush").find((a) => a.instanceId === am.instanceId);
    if (rush) {
      s = act(s, rush);
    } else {
      s = actLegal(s, (a) => a.type === "begin_zord_setup" && a.zordInstanceId === am.instanceId);
      s = drain(s, "player1");
    }
    expect(zoneOf(s, "player1", am.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", red.instanceId)).toBe("discard");
  });

  it("RS-013: 公式Q&A — もう1枚のシーロンの光に張り替えれば、同じラッシュフェイズにもう一度発動できる（出典: grnrngr/faq-card-1 RS-013 Q2）", () => {
    // 「はい、できます」
    const u = inst("CS-S1", "u");
    const sh2 = inst("RS-013", "sh2");
    let s = shironState([u, sh2, inst("CS-S1", "u2")], { command: [held("TST-OP-ET", "c")] });
    s = reveal(s, u.instanceId);
    s = actLegal(s, (a) => a.type === "rush" && a.instanceId === u.instanceId);
    s = drain(s, "player1");
    s = playOp(s, sh2.instanceId);
    expect(zoneOf(s, "player1", sh2.instanceId)).toBe("operation");
    expect(legalOfType(s, "shiron_light").some((a) => a.operationInstanceId === sh2.instanceId)).toBe(true);
  });

  it("RS-013: 公式Q&A — 出したユニットの「ラッシュしたとき」が発動し、「ラッシュされたとき」のカウンターも使える（出典: grnrngr/faq-card-1 RS-013 Q3）", () => {
    // 「「ラッシュしたとき」の効果は発動しますし…カウンタを発動させることもできます」
    ON_RUSH_EFFECTS[FX] = "draw_1";
    const u = inst(FX, "fx");
    let s = shironState([u], {
      p2: { hand: [inst("RS-026", "ninpo")], command: [released("TST-OP-MA", "ma")], power: powerCards(3, "e") },
    });
    s = reveal(s, u.instanceId);
    s = actLegal(s, (a) => a.type === "rush" && a.instanceId === u.instanceId);
    expect(s.players.player1.deck).toHaveLength(3);
    expect(s.pendingRush?.rushedInstanceId).toBe(u.instanceId);
    expect(canUseCounter(s, "player2", "RS-026:ninpo")).toBe(true);
  });

  it("RS-013: 公式Q&A — 同じカテゴリのコマンドをホールドしなくても出せる（出典: grnrngr/faq-card-1 RS-013 Q4）", () => {
    // 「コマンドをホールドしなくてもラッシュエリアに出すことができます」
    const et = inst("CS-S-ET3", "et");
    let s = reveal(shironState([et], { power: 3, command: [released("TST-OP-ET", "c")] }), et.instanceId);
    s = actLegal(s, (a) => a.type === "rush" && a.instanceId === et.instanceId);
    expect(zoneOf(s, "player1", et.instanceId)).toBe("rush");
    expect(s.players.player1.command[0]?.commandHeld).toBeFalsy();
  });
});

// ===========================================================================
describe("RS-014 ファイブテクター", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）ストライクされるとき、自軍ラッシュエリアのSユニットを1体選んでバトルエリアに出し、ストライクしてきた敵軍ユニットとバトルしてもよい。そのとき、敵軍のストライクは無効になる。";

  function strikeState(p2: { rush: ReturnType<typeof inst>[]; battle?: ReturnType<typeof inst>[]; hand?: ReturnType<typeof inst>[]; command?: ReturnType<typeof inst>[] }, p1Battle?: ReturnType<typeof inst>[]) {
    const striker = inst("CS-S1", "striker");
    const s = specState(["RS-014", "RS-018", "RS-097"], {
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: p1Battle ?? [striker] },
      player2: {
        operation: [inst("RS-014", "ft")],
        rush: p2.rush,
        battle: p2.battle ?? [],
        hand: p2.hand ?? [],
        command: p2.command ?? [],
        power: powerCards(4, "e"),
      },
    });
    return { s, striker };
  }

  it("RS-014: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-255）", () => {
    expectSourceText("RS-014", TEXT);
    expect(cardDef("RS-014")?.tags).toContain("常駐");
    expect(cardDef("RS-014")?.powerCost).toBe(5);
  });

  it("RS-014: ストライクされるとき、ラッシュエリアのSユニットをバトルエリアに出してバトルし、ストライクは無効（出典: atwiki/page-255）", () => {
    const guard = inst("CS-BIG", "guard");
    const guardS = { ...inst("CS-S1", "gs"), bpModifier: 5000 };
    const { s: s0, striker } = strikeState({ rush: [guardS, guard] });
    let s = act(s0, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    s = actLegal(s, (a) => a.type === "five_tech_intercept" && a.interceptInstanceId === guardS.instanceId);
    for (let i = 0; i < 4; i += 1) {
      const pass = legal(s).find((a) => a.type.startsWith("pass_"));
      if (!pass) break;
      s = act(s, pass);
    }
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player2", guardS.instanceId)).toBe("battle");
    expect(zoneOf(s, "player1", striker.instanceId)).toBe("discard");
  });

  it("RS-014: ラッシュエリアのMユニットは選べない（出典: atwiki/page-255 「Sユニットを1体選んで」）", () => {
    const m = inst("CS-M", "m");
    const { s: s0, striker } = strikeState({ rush: [m] });
    const s = act(s0, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    expect(legalOfType(s, "five_tech_intercept")).toHaveLength(0);
  });

  it("RS-014: 「してもよい」— 使わずにストライクを受けることもできる（出典: atwiki/page-255）", () => {
    const g = inst("CS-S1", "g");
    const { s: s0, striker } = strikeState({ rush: [g] });
    let s = act(s0, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    expect(hasLegal(s, (a) => a.type === "pass_strike_reaction")).toBe(true);
    s = actLegal(s, (a) => a.type === "pass_strike_reaction");
    for (let i = 0; i < 4 && s.pendingDamagePayment; i += 1) {
      const pay = legal(s).find((a) => a.type === "resolve_damage_payment");
      if (!pay) break;
      s = act(s, pay);
    }
    expect(s.players.player2.damage).toBe(1);
    expect(zoneOf(s, "player2", g.instanceId)).toBe("rush");
  });

  it("RS-014: 公式Q&A — ファイブテクターでバトルに持ち込んだ後、隠流忍術は使えない（出典: grnrngr/faq-card-1 RS-014 Q1）", () => {
    // 「アタックされたときを発動条件とする隠流忍術を発動することもできません」
    const g = inst("CS-S1", "g");
    const other = inst("CS-BIG", "other");
    const ninja = inst("RS-018", "ninja");
    const { s: s0, striker } = strikeState({ rush: [g], battle: [other], hand: [ninja], command: [released("TST-OP-MA", "ma")] });
    let s = act(s0, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    s = actLegal(s, (a) => a.type === "five_tech_intercept" && a.interceptInstanceId === g.instanceId);
    expect(canUseCounter(s, "player2", ninja.instanceId)).toBe(false);
  });

  it("RS-014: 公式Q&A — 敵軍にハリケンレオンがいれば、SP1以上のユニットを出すときコマンドを1つホールドする（出典: grnrngr/faq-card-1 RS-014 Q2）", () => {
    // 「はい、その通りです」
    const g = inst("CS-S1", "g"); // SP1
    const leon = inst("RS-097", "leon");
    const striker = inst("CS-S1", "striker");
    const noCmd = specState(["RS-014", "RS-097"], {
      phase: "battle",
      player1: { battle: [leon, striker] },
      player2: { operation: [inst("RS-014", "ft")], rush: [g], command: [] },
    });
    let s = act(noCmd, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    expect(legalOfType(s, "five_tech_intercept")).toHaveLength(0);

    const withCmd = specState(["RS-014", "RS-097"], {
      phase: "battle",
      player1: { battle: [leon, striker] },
      player2: { operation: [inst("RS-014", "ft")], rush: [g], command: [released("TST-OP", "c")] },
    });
    s = act(withCmd, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    s = actLegal(s, (a) => a.type === "five_tech_intercept" && a.interceptInstanceId === g.instanceId);
    s = drain(s, "player2");
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });

  it("RS-014: 公式Q&A — ファイブテクターで出したユニットのナンバーコンビネーションは発動しない（出典: grnrngr/faq-card-1 RS-014 Q3）", () => {
    // 「コンビネーションの効果を発動できるのは、自分のバトルフェイズになります」
    const blue = inst("RS-059", "blue"); // マジブルー CN2【未来予知】1枚ドロー
    const filler = inst("CS-BIG", "f");
    const striker = inst("CS-S1", "striker");
    let s = specState(["RS-014", "RS-059"], {
      phase: "battle",
      player1: { battle: [striker] },
      player2: { operation: [inst("RS-014", "ft")], rush: [blue], battle: [filler], deck: deckCards(3, "e") },
    });
    s = act(s, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    s = actLegal(s, (a) => a.type === "five_tech_intercept" && a.interceptInstanceId === blue.instanceId);
    expect(s.players.player2.deck).toHaveLength(3);
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-015 バードニックウェーブ", () => {
  const TEXT = "このターン、すべての自軍ユニットのコンビネーションナンバーは1少なくなる。ただし、2より少なくならない。";

  function waveState(rush: ReturnType<typeof inst>[], ops = 1, extra: { command?: ReturnType<typeof inst>[]; battle?: ReturnType<typeof inst>[] } = {}) {
    const waves = Array.from({ length: ops }, (_, i) => inst("RS-015", `w${i}`));
    const s = specState(["RS-015", "RS-058", "RS-060", "RS-263", "RS-222"], {
      phase: "rush",
      player1: {
        hand: waves,
        power: powerCards(2),
        command: [...waves.map((_, i) => held("TST-OP-ET", `c${i}`)), ...(extra.command ?? [])],
        rush,
        battle: extra.battle ?? [],
        deck: deckCards(4),
      },
    });
    return { s, waves };
  }

  function playAllThenBattle(s0: GameState, waves: ReturnType<typeof inst>[]): GameState {
    let s = s0;
    for (const w of waves) s = playOp(s, w.instanceId);
    s = actLegal(s, (a) => a.type === "end_phase");
    return s;
  }

  const ncActive = (s: GameState, id: string) =>
    (s.players.player1.battle.find((c) => c.instanceId === id)?.activatedNcEffects ?? []).length > 0;

  it("RS-015: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-256）", () => {
    expectSourceText("RS-015", TEXT);
    expect(cardDef("RS-015")?.powerCost).toBe(2);
  });

  it("RS-015: コンビネーションナンバー3のユニットが2番目でNCを発動できる（出典: atwiki/page-256 「1少なくなる」）", () => {
    const f = inst("CS-S1", "f");
    const yellow = inst("RS-058", "y"); // CN3
    const { s: s0, waves } = waveState([f, yellow]);
    let s = playAllThenBattle(s0, waves);
    s = enter(s, f.instanceId);
    s = enter(s, yellow.instanceId);
    expect(ncActive(s, yellow.instanceId)).toBe(true);
  });

  it("RS-015: バードニックウェーブなしではCN3のユニットは2番目でNCを発動しない（対照）（出典: atwiki/page-256）", () => {
    const f = inst("CS-S1", "f");
    const yellow = inst("RS-058", "y");
    const { s: s0 } = waveState([f, yellow], 0);
    let s = actLegal(s0, (a) => a.type === "end_phase");
    s = enter(s, f.instanceId);
    s = enter(s, yellow.instanceId);
    expect(ncActive(s, yellow.instanceId)).toBe(false);
  });

  it("RS-015: 効果は「このターン」だけ（次のターンには残らない）（出典: atwiki/page-256 「このターン、」）", () => {
    const { s: s0, waves } = waveState([]);
    let s = playOp(s0, waves[0]!.instanceId);
    expect(getComboNumberDelta(s.players.player1)).toBe(1);
    s = actLegal(s, (a) => a.type === "end_phase");
    s = actLegal(s, (a) => a.type === "end_phase");
    for (let i = 0; i < 10 && s.activePlayer === "player1"; i += 1) {
      s = actLegal(s, (a) => a.type === "end_phase" || a.type === "draw" || a.type === "return_all_battle_to_rush");
    }
    expect(getComboNumberDelta(s.players.player1)).toBe(0);
  });

  it("RS-015: 公式Q&A — タンクコマンドは修正後ではなく本来のナンバーを参照する（出典: grnrngr/faq-card-1 RS-015 Q1）", () => {
    // 「参照するのは、「カードに表記された本来のナンバー」だけです」
    // リリース状態のコマンドにナンバー3のユニットカード（マジイエロー）。本来ナンバー4のマジピンクは、
    // バードニックウェーブでナンバー3になっても NC を封じられない。
    const f1 = inst("CS-S1", "f1");
    const f2 = inst("CS-S1", "f2");
    const pink = inst("RS-060", "pink"); // CN4【ピンクストーム】
    const tank = inst("RS-263", "tank");
    const { s: s0, waves } = waveState([f1, f2, pink, tank], 1, { command: [released("RS-058", "cmdYellow")] });
    let s = playAllThenBattle(s0, waves);
    s = enter(s, f1.instanceId);
    s = enter(s, f2.instanceId);
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: pink.instanceId });
    const triggered = ncActive(s, pink.instanceId) || s.pendingEffectChoice?.sourceCardId === "RS-060" || s.log.some((l) => l.includes("pink_storm"));
    expect(triggered).toBe(true);
  });

  it.todo(
    "RS-015: 公式Q&A — タイムピンク【戦闘指揮】で発動させるユニットのNC用ナンバー（＝リリースする敵軍コマンド数）も1少なくなる（出典: grnrngr/faq-card-1 RS-015 Q2）— 【戦闘指揮】の「ナンバーと同じ数だけ敵軍コマンドをリリース」の支払い数を公開APIで観測する手段が見つからず未検証",
  );

  it("RS-015: 公式Q&A — 効果は重複する（2枚でCN4のユニットが2番目でNC）（出典: grnrngr/faq-card-1 RS-015 Q3）", () => {
    // 「はい、重複します」
    const f = inst("CS-S1", "f");
    const pink = inst("RS-060", "pink"); // CN4
    const { s: s0, waves } = waveState([f, pink], 2);
    const s1 = { ...s0, players: { ...s0.players, player1: { ...s0.players.player1, power: powerCards(4) } } };
    let s = playAllThenBattle(s1, waves);
    expect(getComboNumberDelta(s.players.player1)).toBe(2);
    s = enter(s, f.instanceId);
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: pink.instanceId });
    const triggered = ncActive(s, pink.instanceId) || s.pendingEffectChoice?.sourceCardId === "RS-060" || s.log.some((l) => l.includes("pink_storm"));
    expect(triggered).toBe(true);
  });

  it("RS-015: 公式Q&A — 元のナンバーが2より小さい（1の）ユニットは2にならない（出典: grnrngr/faq-card-1 RS-015 Q4）", () => {
    // 「元の値が2より小さいものは、「少なくなる」ということはありません」
    const { s: s0, waves } = waveState([]);
    const s = playOp(s0, waves[0]!.instanceId);
    expect(effectiveComboNumber(s, "player1", 1)).toBe(1);
    expect(effectiveComboNumber(s, "player1", 2)).toBe(2);
    expect(effectiveComboNumber(s, "player1", 3)).toBe(2);
    expect(effectiveComboNumber(s, "player1", 5)).toBe(4);
  });
});

// ===========================================================================
describe("RS-016 ダイノ伝記", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる）自軍ユニットが場を離れるとき発動できる。⇒場を離れるユニットと同じ名前のユニットのカードが自軍捨札にあれば、その場に留まる。";

  function battleLeave(defender: ReturnType<typeof inst>, discard: ReturnType<typeof inst>[], opts: { active?: "player1" | "player2"; p2Deck?: number } = {}) {
    const counter = inst("RS-016", "dino");
    const atk = inst("CS-BIG", "atk");
    let s = specState(["RS-016", "RS-054"], {
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [atk] },
      player2: {
        battle: [defender],
        discard,
        hand: [counter],
        command: [released("TST-OP", "pay")],
        power: powerCards(4, "e"),
        deck: deckCards(opts.p2Deck ?? 3, "e"),
      },
    });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: defender.instanceId });
    for (let i = 0; i < 4 && !s.pendingLeave; i += 1) {
      const pass = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    return { s, counter };
  }

  it("RS-016: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-49）", () => {
    expectSourceText("RS-016", TEXT);
    expect(cardDef("RS-016")?.tags).toContain("カウンター");
    expect(cardDef("RS-016")?.powerCost).toBe(4);
  });

  it("RS-016: 同じ名前のユニットのカードが自軍捨札にあれば、場を離れるユニットはその場に留まる（出典: atwiki/page-49）", () => {
    const d = inst("CS-S1", "d");
    const { s: s0, counter } = battleLeave(d, [inst("CS-S1", "twin")]);
    expect(s0.pendingLeave?.instanceId).toBe(d.instanceId);
    const s = playCounter(s0, "player2", counter.instanceId);
    expect(zoneOf(s, "player2", d.instanceId)).toBe("battle");
    expect(zoneOf(s, "player2", counter.instanceId)).toBe("discard");
  });

  it("RS-016: 同じ名前のカードが捨札になければ留まらない（出典: atwiki/page-49 「…が自軍捨札にあれば」）", () => {
    const d = inst("CS-S1", "d");
    let { s, counter } = battleLeave(d, [inst("CS-M", "other")]);
    if (canUseCounter(s, "player2", counter.instanceId)) s = playCounter(s, "player2", counter.instanceId);
    for (let i = 0; i < 4 && s.pendingLeave; i += 1) {
      const pass = legal(s).find((a) => a.type === "pass_leave_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(zoneOf(s, "player2", d.instanceId)).toBe("discard");
  });

  it("RS-016: ※カウンター — 自軍ターン中に自軍ユニットが場を離れるときは使えない（出典: atwiki/page-49 ※カウンター）", () => {
    // 自軍ターンに自軍アタッカーがバトルで撃破される
    const weak = inst("CS-S1", "weak");
    const strong = inst("CS-BIG", "strong");
    const counter = inst("RS-016", "dino");
    let s = specState(["RS-016"], {
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [weak], hand: [counter], discard: [inst("CS-S1", "twin")], command: [released("TST-OP", "pay")], power: powerCards(4) },
      player2: { battle: [strong] },
    });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: weak.instanceId, defenderInstanceId: strong.instanceId });
    for (let i = 0; i < 4 && !(s.pendingLeave?.instanceId === weak.instanceId); i += 1) {
      const pass = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(canUseCounter(s, "player1", counter.instanceId)).toBe(false);
  });

  it("RS-016: 公式Q&A — コマンドゾーンへ移動させられるとき（ダイナマイトパワー）も発動できる（出典: grnrngr/faq-card-1 RS-016 Q1）", () => {
    // 「カードが現在の場所から別の場所に移動するときは、一旦場を離れていると解釈します」
    const d = inst("CS-S1", "d");
    const dyn = inst("RS-007", "dyn");
    const counter = inst("RS-016", "dino");
    let s = specState(["RS-016", "RS-007"], {
      phase: "rush",
      activePlayer: "player1",
      player1: { hand: [dyn], power: powerCards(6), command: [held("TST-OP-ET", "c")] },
      player2: { battle: [d], discard: [inst("CS-S1", "twin")], hand: [counter], command: [released("TST-OP", "pay")], power: powerCards(4, "e") },
    });
    s = playOp(s, dyn.instanceId, { targetInstanceId: d.instanceId });
    expect(canUseCounter(s, "player2", counter.instanceId)).toBe(true);
    s = playCounter(s, "player2", counter.instanceId);
    expect(zoneOf(s, "player2", d.instanceId)).toBe("battle");
  });

  it("RS-016: 公式Q&A — ラッシュエリアからバトルエリアへ移動させられるとき（ピットインダイブ）も発動できる（出典: grnrngr/faq-card-1 RS-016 Q1）", () => {
    // 「「ピットインダイブ」によってラッシュエリアからバトルエリアに移動させられるときも…発動させることができます」
    const green = inst("RS-049", "green"); // CN4【ピットインダイブ】
    const fillers = [inst("CS-S1", "f1"), inst("CS-S1", "f2"), inst("CS-S1", "f3")];
    const d = inst("CS-S1", "d");
    const counter = inst("RS-016", "dino");
    let s = specState(["RS-016", "RS-049"], {
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [green], battle: fillers },
      player2: { rush: [d], discard: [inst("CS-S1", "twin")], hand: [counter], command: [released("TST-OP", "pay")], power: powerCards(4, "e") },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: green.instanceId });
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1"; i += 1) {
      const pick = legalOfType(s, "resolve_effect_choice").find((a) => a.instanceId === d.instanceId) ?? legal(s).find((a) => a.type === "confirm_effect_choice");
      if (!pick) break;
      s = act(s, pick);
    }
    expect(canUseCounter(s, "player2", counter.instanceId)).toBe(true);
  });

  it("RS-016: 公式Q&A — 留まったアバレッドの「撃破されたとき1点ダメージ」は受ける（出典: grnrngr/faq-card-1 RS-016 Q2）", () => {
    // 「撃破されたことを無効にする効果はありません」
    const red = inst("RS-054", "red");
    const { s: s0, counter } = battleLeave(red, [inst("RS-054", "twin")]);
    let s = playCounter(s0, "player2", counter.instanceId);
    for (let i = 0; i < 4 && s.pendingDamagePayment; i += 1) {
      const pay = legal(s).find((a) => a.type === "resolve_damage_payment");
      if (!pay) break;
      s = act(s, pay);
    }
    expect(zoneOf(s, "player2", red.instanceId)).toBe("battle");
    expect(s.players.player2.damage).toBe(1);
  });
});
