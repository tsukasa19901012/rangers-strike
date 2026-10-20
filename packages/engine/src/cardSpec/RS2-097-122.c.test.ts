/**
 * カード別スペック: RS-111〜RS-122（第2弾「二人の黒騎士」マジレンジャー・ボウケンジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS118）、grnrngr/faq-card-2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md、ライブ写し docs/rules/sources/web/w.atwiki.jp/renst/pages/N.txt）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canStrike,
  canStartRush,
  canUseCard,
  choiceIds,
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
  passEntry,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  toPhase,
  tryAct,
  useCard,
  zoneIds,
  zoneOf,
} from "./RS2-097-122.helpers";
import type { GameState, PlayerId } from "../types/game";

/** 保留中の効果選択を、指定（無ければ先頭）で解決し続ける。 */
function drain(s: GameState, playerId: PlayerId, prefer: string[] = []): GameState {
  let next = s;
  for (let i = 0; i < 8; i++) {
    const p = next.pendingEffectChoice;
    if (!p || p.playerId !== playerId) break;
    const pick = prefer.find((id) => p.validInstanceIds.includes(id)) ?? p.validInstanceIds[0];
    if (!pick) break;
    const r = tryAct(next, { type: "resolve_effect_choice", playerId, instanceId: pick });
    if (!r.ok) break;
    next = r.state;
  }
  return next;
}

// ===========================================================================
describe("RS-111 マジキング", () => {
  // atwiki/page-24「※2弾収録のカードは能力名が【ファントムイリュージョン】に変更されている」
  it("RS-111: カタログ本文（第2弾の能力名【ファントムイリュージョン】）・スペックが出典と一致（出典: atwiki/page-24）", () => {
    expectCatalogText(
      "RS-111",
      "合体―マジフェニックス＋マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス【ファントムイリュージョン】これがバトルエリアに出たとき、敵軍コマンドをすべてホールドしてもよい。",
    );
    expectStats("RS-111", {
      name: "マジキング",
      category: "MA",
      size: "L",
      bp: 16000,
      sp: 1,
      powerCost: "7+",
      features: ["魔法", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  function kingEnters() {
    let s = st({
      player1: { rush: [inst("RS-111", "mk")] },
      player2: { command: [released("TST-OP", "c1"), released("TST-OP", "c2"), held("TST-OP", "c3")] },
    });
    s = enter(s, "RS-111:mk");
    return s;
  }

  // 「これがバトルエリアに出たとき、敵軍コマンドをすべてホールドしてもよい」
  it("RS-111: バトルエリアに出たとき、敵軍コマンドをすべてホールドできる（出典: atwiki/page-24）", () => {
    let s = kingEnters();
    const accept = legal(s).find(
      (a) => (a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice") && a.playerId === "player1",
    );
    expect(accept).toBeDefined();
    s = act(s, accept!);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RS-111: ホールドしないことを選べる（任意）（出典: atwiki/page-24「ホールドしてもよい」）", () => {
    let s = kingEnters();
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // 「追加条件：自軍合体ユニットを捨札にする」
  it("RS-111: 合体ユニットが無ければラッシュできない（出典: atwiki/page-24）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-111", "mk")],
        rush: [inst("TST-UNIT-0", "s")],
        command: releasedN(2, "TST-OP-MA", "ma"),
        power: powerCards(7),
      },
    });
    expect(canStartRush(s, "player1", "RS-111:mk")).toBe(false);
  });
});

// ===========================================================================
describe("RS-112 ウルカイザー", () => {
  it("RS-112: カタログ本文・スペックが出典と一致（出典: atwiki/page-332）", () => {
    expectCatalogText("RS-112", "合体―魔導騎士ウルザード＋魔導馬バリキオン※敵軍ダメージが6点になったとき、このユニットは持ち主の手札に戻す");
    expectStats("RS-112", {
      name: "ウルカイザー",
      category: "DA",
      size: "L",
      bp: 8000,
      sp: 1,
      powerCost: "6+",
      features: ["魔法", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「合体―魔導騎士ウルザード＋魔導馬バリキオン」「追加条件：自軍合体ユニットを捨札にする」
  // R-ADD-06「「合体-」に列挙されたユニットを、すべて自軍エリアから捨札にする」
  it("RS-112: 合体ユニット（魔導騎士ウルザード＋魔導馬バリキオン）をすべて捨札にしてラッシュでき、片方だけでは満たせない（出典: atwiki/page-332・R-ADD-06）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) =>
      st({
        phase: "rush",
        player1: { hand: [inst("RS-112", "uk")], rush, command: releasedN(2, "TST-OP-DA", "da"), power: powerCards(6) },
      });
    expect(canStartRush(mk([inst("RS-114", "bk")]), "player1", "RS-112:uk")).toBe(false);
    const r = rushFromHand(mk([inst("RS-114", "bk"), inst("RS-115", "uz")]), "player1", "RS-112:uk");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-112:uk")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-114:bk")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-115:uz")).toBe("discard");
  });

  // 「※敵軍ダメージが6点になったとき、このユニットは持ち主の手札に戻す」
  it("RS-112: ※ ストライクで敵軍ダメージが6点になると、ウルカイザーは持ち主の手札に戻る（出典: atwiki/page-332）", () => {
    let s = st({
      player1: { battle: [inst("RS-112", "uk"), inst("TST-UNIT-0", "st")] },
      player2: { damage: 5, power: [...powerCards(2, "e"), ...Array.from({ length: 5 }, (_, i) => ({ ...inst("TST-P", `d${i}`), faceDown: true }))], deck: deckCards(3, "e") },
    });
    s = settle(strike(s, "TST-UNIT-0:st"));
    expect(s.players.player2.damage).toBe(6);
    expect(zoneOf(s, "player1", "RS-112:uk")).toBe("hand");
  });

  it("RS-112: ※ 敵軍ダメージが5点以下のままなら戻らない（出典: atwiki/page-332）", () => {
    let s = st({
      player1: { battle: [inst("RS-112", "uk"), inst("TST-UNIT-0", "st")] },
      player2: { damage: 3, power: powerCards(5, "e"), deck: deckCards(3, "e") },
    });
    s = settle(strike(s, "TST-UNIT-0:st"));
    expect(s.players.player2.damage).toBe(4);
    expect(zoneOf(s, "player1", "RS-112:uk")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-113 ファイヤーカイザー", () => {
  it("RS-113: カタログ本文・スペックが出典と一致（出典: atwiki/page-320）", () => {
    expectCatalogText(
      "RS-113",
      "合体―マジフェニックス＋魔導馬バリキオン【ファイヤースピンブレード】これはリリース状態の自軍コマンド1つにつきBP＋1000される。これはBP10000以上のとき「SP1」になる。",
    );
    expectStats("RS-113", {
      name: "ファイヤーカイザー",
      category: "MA",
      size: "L",
      bp: 5000,
      sp: "special",
      powerCost: "6+",
      features: ["魔法", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「これはリリース状態の自軍コマンド1つにつきBP＋1000される」
  it("RS-113: リリース状態の自軍コマンド1つにつき BP+1000（ホールド状態・敵軍のコマンドは数えない）（出典: atwiki/page-320）", () => {
    const s = st({
      player1: { battle: [inst("RS-113", "fk")], command: [...releasedN(3), held("TST-OP", "h")] },
      player2: { command: releasedN(4, "TST-OP", "e") },
    });
    expect(bpOf(s, "player1", "RS-113:fk")).toBe(8000);
  });

  // 「これはBP10000以上のとき「SP1」になる」
  it("RS-113: BP10000 以上なら「SP1」になってストライクでき、9000 ならできない（出典: atwiki/page-320）", () => {
    const five = st({ player1: { battle: [inst("RS-113", "fk")], command: releasedN(5) } });
    expect(bpOf(five, "player1", "RS-113:fk")).toBe(10000);
    expect(canStrike(five, "RS-113:fk")).toBe(true);
    const four = st({ player1: { battle: [inst("RS-113", "fk")], command: releasedN(4) } });
    expect(canStrike(four, "RS-113:fk")).toBe(false);
  });

  // faq-card-2 RS-113 Q1「BP9000以上になっている「RS-113 ファイヤーカイザー」を対象に「RS-026 疾風流超忍法」を発動することはできません」
  it("RS-113: 公式Q&A — リリース状態のコマンドが4つ以上残る状態でラッシュしたファイヤーカイザーには疾風流超忍法を使えない（出典: grnrngr/faq-card-2 RS-113 Q1）", () => {
    const mk = (n: number) =>
      st({
        phase: "rush",
        player1: {
          hand: [inst("RS-113", "fk")],
          rush: [inst("RS-576", "mp"), inst("RS-114", "bk")],
          command: releasedN(n, "TST-OP-MA", "ma"),
          power: powerCards(6),
        },
        player2: { hand: [inst("RS-026", "hp")], command: [released("TST-OP-MA", "p2")], power: powerCards(3, "e") },
      });
    const rushNoPass = (s0: GameState) => {
      let s = act(s0, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-113:fk" });
      for (let i = 0; i < 6 && s.pendingZordSetup; i++) {
        const setup = s.pendingZordSetup;
        s = act(
          s,
          setup.step === "material"
            ? { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: setup.validInstanceIds[0] }
            : setup.step === "destination"
              ? { type: "resolve_zord_setup", playerId: "player1", destination: "discard" }
              : { type: "resolve_zord_setup", playerId: "player1" },
        );
      }
      for (let i = 0; i < 4 && s.pendingCommandPayment?.playerId === "player1"; i++) {
        const p = s.pendingCommandPayment;
        s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
      }
      return s;
    };
    // ラッシュ支払いで1つホールド → 残り4つ（BP9000）
    const s5 = rushNoPass(mk(5));
    expect(zoneOf(s5, "player1", "RS-113:fk")).toBe("rush");
    expect(canUseCard(s5, "player2", "RS-026:hp")).toBe(false);
    // 対照: 残り3つ（BP8000）なら使える
    const s4 = rushNoPass(mk(4));
    expect(canUseCard(s4, "player2", "RS-026:hp")).toBe(true);
  });
});

// ===========================================================================
describe("RS-114 魔導馬バリキオン", () => {
  it("RS-114: カタログ本文・スペックが出典と一致（出典: atwiki/page-333）", () => {
    expectCatalogText("RS-114", "※これは、自軍Sユニットがバトルエリアになければバトルエリアに出られない。");
    expectStats("RS-114", {
      name: "魔導馬バリキオン",
      category: "DA",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["魔法"],
    });
  });

  // 「追加条件：なし」
  it("RS-114: 追加条件なしでラッシュできる（出典: atwiki/page-333）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-114", "bk")], command: [released("TST-OP-DA", "da")], power: powerCards(3) },
    });
    const r = rushFromHand(s, "player1", "RS-114:bk");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-114:bk")).toBe("rush");
  });

  // 「※これは、自軍Sユニットがバトルエリアになければバトルエリアに出られない」
  it("RS-114: ※ 自軍バトルエリアに S ユニットがなければ出られず、あれば出られる（敵軍の S ユニットは数えない）（出典: atwiki/page-333）", () => {
    const none = st({ player1: { rush: [inst("RS-114", "bk")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    expect(canEnter(none, "RS-114:bk")).toBe(false);
    const withS = st({ player1: { rush: [inst("RS-114", "bk")], battle: [inst("TST-UNIT-0", "s")] } });
    expect(canEnter(withS, "RS-114:bk")).toBe(true);
  });
});

// ===========================================================================
describe("RS-115 魔導騎士ウルザード", () => {
  it("RS-115: カタログ本文・スペックが出典と一致（出典: atwiki/page-28）", () => {
    expectCatalogText(
      "RS-115",
      "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。※これがバトルエリアに出たとき、相手は1枚ドローしてもよい。",
    );
    expectStats("RS-115", {
      name: "魔導騎士ウルザード",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: 5,
      features: ["魔法", "男"],
    });
  });

  // 「※これがバトルエリアに出たとき、相手は1枚ドローしてもよい」
  it("RS-115: ※ バトルエリアに出たとき、相手は1枚ドローできる（出典: atwiki/page-28）", () => {
    let s = st({ player1: { rush: [inst("RS-115", "uz")] }, player2: { deck: deckCards(3, "e"), hand: [] } });
    s = enter(s, "RS-115:uz");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: s.pendingEffectChoice!.validInstanceIds[0]! });
    expect(s.players.player2.hand).toHaveLength(1);
  });

  it("RS-115: ※ 相手はドローしないことを選べる（出典: atwiki/page-28「ドローしてもよい」）", () => {
    let s = st({ player1: { rush: [inst("RS-115", "uz")] }, player2: { deck: deckCards(3, "e"), hand: [] } });
    s = enter(s, "RS-115:uz");
    s = act(s, { type: "skip_effect_choice", playerId: "player2" });
    expect(s.players.player2.hand).toHaveLength(0);
  });

  // 「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-115: ※ 敵軍ターン中に SP1 以上のユニットとバトルすると、勝っても撃破される（出典: atwiki/page-28）", () => {
    let s = st({ player1: { battle: [inst("TST-UNIT-0", "atk")] }, player2: { battle: [inst("RS-115", "uz")] } });
    s = settle(attack(s, "TST-UNIT-0:atk", "RS-115:uz"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:atk")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-115:uz")).toBe("discard");
  });

  it("RS-115: ※ 自軍ターン中のバトルなら勝てば残る（出典: atwiki/page-28「敵軍ターン中」）", () => {
    let s = st({ player1: { rush: [inst("RS-115", "uz")], deck: deckCards(2) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    s = enter(s, "RS-115:uz");
    if (s.pendingEffectChoice) s = act(s, { type: "skip_effect_choice", playerId: "player2" });
    s = settle(attack(s, "RS-115:uz", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player1", "RS-115:uz")).toBe("battle");
  });

  // faq-card-2 RS-115 Q1「はい、相手はドローすることができます。」
  it("RS-115: 公式Q&A — 相手のデカグリーンでバトルエリアに出されたときも、相手（デカグリーンの持ち主）はドローできる（出典: grnrngr/faq-card-2 RS-115 Q1）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-108", "g")], deck: deckCards(3), hand: [] },
      player2: { rush: [inst("RS-115", "uz")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-108:g");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-115:uz" });
    expect(zoneOf(s, "player2", "RS-115:uz")).toBe("battle");
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player1" && s.pendingEffectChoice.effectId === "green_crush"; i++) {
      s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    }
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: s.pendingEffectChoice!.validInstanceIds[0]! });
    expect(s.players.player1.hand).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-116 マンドラ坊や", () => {
  const MAG = sUnit("SPEC-MAG", { features: ["魔法"] });
  const MID = sUnit("SPEC-MID", { size: "M", bp: 3000 });

  it("RS-116: カタログ本文・スペックが出典と一致（出典: atwiki/page-321）", () => {
    expectCatalogText(
      "RS-116",
      "※これはバトルエリアに出られない。【鳴き声】これが撃破されたとき、特徴「魔法」を持たないSユニットをすべて持ち主の手札に戻す。",
    );
    expectStats("RS-116", {
      name: "マンドラ坊や",
      category: "MA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 4,
      features: ["魔法", "植物"],
    });
  });

  // 「※これはバトルエリアに出られない」
  it("RS-116: ※ バトルエリアに出られない（出典: atwiki/page-321）", () => {
    const s = st({ player1: { rush: [inst("RS-116", "md")], command: releasedN(2) } });
    expect(canEnter(s, "RS-116:md")).toBe(false);
  });

  // 「これが撃破されたとき、特徴「魔法」を持たないSユニットをすべて持ち主の手札に戻す」
  it("RS-116: 撃破されると、両軍のラッシュ・バトルエリアの「魔法」を持たない S ユニットがすべて持ち主の手札に戻る（魔法の S と M は残る）（出典: atwiki/page-321）", () => {
    let s = st(
      {
        player1: { rush: [inst("RS-106", "dr"), inst("TST-UNIT-0", "mine"), inst("SPEC-MAG", "mymag")] },
        player2: {
          battle: [inst("TST-UNIT-0", "eb"), inst("SPEC-MID", "em")],
          rush: [inst("RS-116", "md"), inst("SPEC-MAG", "emag")],
          deck: deckCards(3, "e"),
        },
      },
      [MAG, MID],
    );
    s = enter(s, "RS-106:dr");
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-116:md" });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-116:md")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-106:dr")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:mine")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-MAG:mymag")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-MAG:emag")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-MID:em")).toBe("battle");
  });

  // faq-card-2 RS-116 Q1「撃破された瞬間に手札に戻ります。撃破する対象として選んでいたユニットが場に残っていたなら、撃破の処理を継続して実行してください」
  it("RS-116: 公式Q&A — 複数撃破の途中でマンドラ坊やを撃破すると鳴き声が割り込み、手札に戻らず場に残った（魔法の）対象は続けて撃破される（出典: grnrngr/faq-card-2 RS-116 Q1）", () => {
    let s = st(
      {
        player1: { rush: [inst("RS-106", "dr")] },
        player2: {
          battle: [inst("TST-UNIT-2", "eb")],
          rush: [inst("RS-116", "md"), inst("TST-UNIT-0", "e1"), inst("SPEC-MAG", "mag")],
          deck: deckCards(3, "e"),
        },
      },
      [MAG],
    );
    s = enter(s, "RS-106:dr");
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    for (const id of ["RS-116:md", "TST-UNIT-0:e1", "SPEC-MAG:mag"]) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    s = settle(act(s, { type: "confirm_effect_choice", playerId: "player1" }));
    expect(zoneOf(s, "player2", "RS-116:md")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-MAG:mag")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-106:dr")).toBe("hand");
  });

  it.todo(
    "RS-116: 公式Q&A — タイムブルーの NC で撃破したときもマンドラ坊やの撃破の瞬間にタイムブルーが手札に戻る（出典: grnrngr/faq-card-2 RS-116 Q1）— タイムブルーの「敵軍Sユニットが4体以上多い」状況と撃破数の再計算を組み立てるには対象が多く、同じ割り込み処理を上のジュウクンドー経由のテストで検証している",
  );
});

// ===========================================================================
describe("RS-117 ダイボウケン", () => {
  const BIG = sUnit("SPEC-BIG", { size: "L", bp: 19000 });

  it("RS-117: カタログ本文・スペックが出典と一致（出典: atwiki/page-291）", () => {
    expectCatalogText(
      "RS-117",
      "合体―ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン【轟轟剣アドベンチャードライブ】これはアタックするときBP＋4000される。",
    );
    expectStats("RS-117", {
      name: "ダイボウケン",
      category: "ET",
      size: "L",
      bp: 16000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「これはアタックするときBP＋4000される」
  it("RS-117: アタックするとき BP+4000（16000+4000 で BP19000 に勝つ）（出典: atwiki/page-291）", () => {
    let s = st({ player1: { rush: [inst("RS-117", "db")] }, player2: { battle: [inst("SPEC-BIG", "big")] } }, [BIG]);
    s = enter(s, "RS-117:db");
    s = settle(attack(s, "RS-117:db", "SPEC-BIG:big"));
    expect(zoneOf(s, "player2", "SPEC-BIG:big")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-117:db")).toBe("battle");
  });

  it("RS-117: アタックされたとき（防御側）は BP+4000 されない（出典: atwiki/page-291「アタックするとき」）", () => {
    let s = st({ player1: { battle: [inst("SPEC-BIG", "big")] }, player2: { battle: [inst("RS-117", "db")] } }, [BIG]);
    s = settle(attack(s, "SPEC-BIG:big", "RS-117:db"));
    expect(zoneOf(s, "player2", "RS-117:db")).toBe("discard");
  });

  it("RS-117: 合体ユニット（ゴーゴーダンプ〜ゴーゴーマリンの5体）をすべて捨札にしてラッシュでき、4体では満たせない（出典: atwiki/page-291・R-ADD-06）", () => {
    const five = ["RS-118", "RS-119", "RS-120", "RS-121", "RS-122"].map((id) => inst(id, "m"));
    const mk = (rush: ReturnType<typeof inst>[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-117", "db")], rush, command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(7) } });
    expect(canStartRush(mk(five.slice(0, 4)), "player1", "RS-117:db")).toBe(false);
    const r = rushFromHand(mk(five), "player1", "RS-117:db");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-117:db")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  // faq-card-2 RS-117 Q1（魔法猫スモーキー＋キリンレンジャーの時間返し）
  it.todo(
    "RS-117: 公式Q&A — スモーキーで出したダイボウケンを素材にスーパーダイボウケンをラッシュした場合、ターン終了時にスーパーダイボウケンは捨札にならない（出典: grnrngr/faq-card-2 RS-117 Q1）— RS-326 魔法猫スモーキーと RS-208 キリンレンジャー「時間返し」の組み合わせを公開 API で再現できない",
  );
});

// ===========================================================================
describe("RS-118 ゴーゴーダンプ", () => {
  // docs/rules/08-errata.md R-ERR-RS118（atwiki/page-292「修正後は以下」）
  it("RS-118: カタログ本文（修正後）・スペックが出典と一致（出典: 08-errata R-ERR-RS118・atwiki/page-292）", () => {
    expectCatalogText(
      "RS-118",
      "【プレシャスの護り手】自軍バトルフェイズ中、これを自軍バトルエリアに出すとき、自軍バトルエリアのSユニット1体と置きかえて出してもよい（Sユニットの下に重ねたカードは、そのSユニットに重ねたまま置きかえる）。そうしたとき、これはアタックできず、置きかえたSユニットはこのターン、再びバトルエリアに出られない。",
    );
    expectStats("RS-118", {
      name: "ゴーゴーダンプ",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  // 「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」
  it("RS-118: 追加条件の S ユニットはコマンドゾーンにも捨札にも送れる（出典: atwiki/page-292）", () => {
    const mk = () =>
      st({
        phase: "rush",
        player1: { hand: [inst("RS-118", "dump")], rush: [inst("TST-UNIT-0", "s")], command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(5) },
      });
    const toCmd = rushFromHand(mk(), "player1", "RS-118:dump", { destination: "command" });
    expect(toCmd.ok).toBe(true);
    expect(zoneOf(toCmd.state, "player1", "TST-UNIT-0:s")).toBe("command");
    const toDiscard = rushFromHand(mk(), "player1", "RS-118:dump", { destination: "discard" });
    expect(zoneOf(toDiscard.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  function dumpEnters(extra: { stacked?: boolean } = {}) {
    const replaced = extra.stacked
      ? { ...inst("TST-UNIT-0", "rep"), stackedCards: [inst("TST-OP", "under")] }
      : inst("TST-UNIT-0", "rep");
    let s = st({
      player1: { rush: [inst("RS-118", "dump")], battle: [inst("TST-UNIT-0", "left"), replaced] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = enter(s, "RS-118:dump");
    return s;
  }

  // 「自軍バトルエリアのSユニット1体と置きかえて出してもよい…そうしたとき、これはアタックできず、置きかえたSユニットはこのターン、再びバトルエリアに出られない」
  it("RS-118: S ユニットと置きかえて同じ位置に出る。ダンプはアタックできず、置きかえた S ユニットはこのターン再び出られない（出典: 08-errata R-ERR-RS118）", () => {
    let s = dumpEnters();
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:left", "TST-UNIT-0:rep"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:rep" });
    expect(zoneIds(s, "player1", "battle")).toEqual(["TST-UNIT-0:left", "RS-118:dump"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:rep")).toBe("rush");
    expect(attackTargets(s, "RS-118:dump")).toEqual([]);
    expect(canEnter(s, "TST-UNIT-0:rep")).toBe(false);
  });

  it("RS-118: 置きかえない（任意）ならダンプは普通にアタックできる（出典: 08-errata R-ERR-RS118「出してもよい」）", () => {
    let s = dumpEnters();
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneIds(s, "player1", "battle")).toEqual(["TST-UNIT-0:left", "TST-UNIT-0:rep", "RS-118:dump"]);
    expect(attackTargets(s, "RS-118:dump")).toEqual(["TST-UNIT-0:e"]);
  });

  // 「Sユニットの下に重ねたカードは、そのSユニットに重ねたまま置きかえる」
  it("RS-118: 下に重ねたカードは S ユニットに重ねたままラッシュエリアへ戻る（出典: 08-errata R-ERR-RS118）", () => {
    let s = dumpEnters({ stacked: true });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:rep" });
    const back = s.players.player1.rush.find((c) => c.instanceId === "TST-UNIT-0:rep");
    expect(back?.stackedCards?.map((c) => c.instanceId)).toEqual(["TST-OP:under"]);
  });

  // 「自軍バトルフェイズ中」
  it("RS-118: 相手のターン中に効果（ジェットファルコン【ファルコンクロー】）で出されたときは置きかえられない（出典: 08-errata R-ERR-RS118「自軍バトルフェイズ中」）", () => {
    let s = st({
      phase: "start",
      activePlayer: "player2",
      player1: { rush: [inst("RS-118", "dump")], battle: [inst("TST-UNIT-0", "s")] },
      player2: { battle: [inst("RS-135", "jf")], deck: deckCards(3, "e") },
    });
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player2" });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toContain("RS-118:dump");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-118:dump" });
    expect(zoneOf(s, "player1", "RS-118:dump")).toBe("battle");
    expect(s.pendingEffectChoice?.effectId).not.toBe("precious_guardian");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("battle");
  });

  // atwiki/page-292 Q1「はい、できます。」
  it("RS-118: atwiki Q&A — 置きかえでラッシュエリアに移動した仮面ライダーアクセルは「ラッシュエリアに戻った」として【アクセルグランツァー】を発動できる（出典: atwiki/page-292 Q1）", () => {
    let s = st({
      player1: {
        rush: [inst("RS-118", "dump")],
        battle: [inst("XP-026", "accel")],
        command: [released("TST-OP-ET", "et")],
      },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = enter(s, "RS-118:dump");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "XP-026:accel" });
    expect(zoneOf(s, "player1", "XP-026:accel")).toBe("rush");
    // 【アクセルグランツァー】: 自軍コマンド（ET）を手札に戻し、ET を持たない敵軍 S ユニットを捨札にする
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = drain(s, "player1", ["TST-OP-ET:et", "TST-UNIT-0:e"]);
    expect(zoneOf(s, "player1", "TST-OP-ET:et")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-119 ゴーゴーフォーミュラ", () => {
  it("RS-119: カタログ本文・スペックが出典と一致（出典: atwiki/page-293）", () => {
    expectCatalogText(
      "RS-119",
      "【シフトアップ】自軍バトルフェイズ中、これを自軍バトルエリアに出すとき、自軍コマンドを5つホールドしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP1」",
    );
    expectStats("RS-119", {
      name: "ゴーゴーフォーミュラ",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: "special",
      powerCost: "6+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  function formulaEnters(cmds: ReturnType<typeof released>[]) {
    let s = st({ player1: { rush: [inst("RS-119", "fm")], command: cmds } });
    s = enter(s, "RS-119:fm");
    return s;
  }

  function acceptShiftUp(s0: GameState): GameState {
    let s = act(s0, { type: "initiate_command_payment", playerId: "player1", kind: "effect_hold", sourceInstanceId: "RS-119:fm" });
    for (let i = 0; i < 3 && s.pendingCommandPayment?.playerId === "player1"; i++) {
      const p = s.pendingCommandPayment;
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    return s;
  }

  // 「自軍コマンドを5つホールドしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP1」」
  it("RS-119: 出すときにコマンドを5つホールドすると、このターン「SP1」を得てストライクできる（出典: atwiki/page-293）", () => {
    let s = formulaEnters(releasedN(5));
    expect(s.pendingEffectChoice?.effectId).toBe("shift_up");
    s = acceptShiftUp(s);
    expect(canStrike(s, "RS-119:fm")).toBe(true);
  });

  it("RS-119: 「SP1」を得るためにホールドするコマンドは5つ（出典: atwiki/page-293「自軍コマンドを5つホールドしてもよい」）", () => {
    const s = acceptShiftUp(formulaEnters(releasedN(5)));
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(5);
  });

  it("RS-119: ホールドしない（任意）なら「SP！」のままでストライクできない（出典: atwiki/page-293「ホールドしてもよい」）", () => {
    let s = formulaEnters(releasedN(5));
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player1.command.some((c) => c.commandHeld)).toBe(false);
    expect(canStrike(s, "RS-119:fm")).toBe(false);
  });

  it("RS-119: リリース状態のコマンドが4つ以下ならホールドできず、SP1 も得ない（出典: atwiki/page-293）", () => {
    const s = formulaEnters([...releasedN(4), held("TST-OP", "h")]);
    expect(s.pendingEffectChoice?.effectId).not.toBe("shift_up");
    expect(canStrike(s, "RS-119:fm")).toBe(false);
  });

  it("RS-119: 得た「SP1」はこのターンだけ — 次の自軍ターンにホールドせずに出し直せば「SP！」のまま（出典: atwiki/page-293「このターン」）", () => {
    let s = st({ player1: { rush: [inst("RS-119", "fm")], command: releasedN(5), deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } });
    s = passEntry(acceptShiftUp(enter(s, "RS-119:fm")));
    s = endTurn(s);
    s = toPhase(s, "player2", "battle");
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    s = enter(s, "RS-119:fm");
    if (s.pendingEffectChoice?.effectId === "shift_up") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(canStrike(s, "RS-119:fm")).toBe(false);
  });
});

// ===========================================================================
describe("RS-120 ゴーゴージャイロ", () => {
  it("RS-120: カタログ本文・スペックが出典と一致（出典: atwiki/page-294）", () => {
    expectCatalogText(
      "RS-120",
      "【空輸搬送】これをラッシュしたとき、自軍コマンドゾーンからリリース状態のMユニットのカードを1枚選び、ラッシュエリアに出してもよい。ただしラッシュのための必要パワーと追加条件は満たすこと。",
    );
    expectStats("RS-120", {
      name: "ゴーゴージャイロ",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  function rushGyro(opts: { cmds: ReturnType<typeof inst>[]; rushS: number; power?: number; dest?: "command" | "discard" }) {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-120", "gy")],
        rush: fillers(opts.rushS, "s"),
        command: opts.cmds,
        power: powerCards(opts.power ?? 5),
      },
    });
    const r = rushFromHand(s, "player1", "RS-120:gy", { destination: opts.dest ?? "discard" });
    expect(r.ok).toBe(true);
    return r.state;
  }

  // 「自軍コマンドゾーンからリリース状態のMユニットのカードを1枚選び、ラッシュエリアに出してもよい。ただしラッシュのための必要パワーと追加条件は満たすこと」
  it("RS-120: ラッシュしたとき、コマンドゾーンのリリース状態の M ユニット（ゴーゴーマリン）を追加条件を満たしてラッシュエリアに出す（出典: atwiki/page-294）", () => {
    let s = rushGyro({ cmds: [...releasedN(2, "TST-OP-ET", "et"), released("RS-122", "mar")], rushS: 2 });
    expect(choiceIds(s)).toContain("RS-122:mar");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-122:mar" });
    for (let i = 0; i < 6 && s.pendingZordSetup; i++) {
      const setup = s.pendingZordSetup;
      s = act(
        s,
        setup.step === "material"
          ? { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: setup.validInstanceIds[0] }
          : setup.step === "destination"
            ? { type: "resolve_zord_setup", playerId: "player1", destination: "discard" }
            : { type: "resolve_zord_setup", playerId: "player1" },
      );
    }
    s = settle(drain(s, "player1", ["RS-122:mar"]));
    expect(zoneOf(s, "player1", "RS-122:mar")).toBe("rush");
    expect(s.players.player1.rush.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(0);
  });

  it("RS-120: ホールド状態の M ユニット・S ユニットのカードは選べない（出典: atwiki/page-294「リリース状態のMユニット」）", () => {
    const s = rushGyro({ cmds: [...releasedN(1, "TST-OP-ET", "et"), held("RS-122", "mar"), released("TST-UNIT-0", "scard")], rushS: 2 });
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("RS-122:mar");
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("TST-UNIT-0:scard");
  });

  it("RS-120: 追加条件（S ユニット）を満たせない M ユニットは出せない（出典: atwiki/page-294「追加条件は満たすこと」）", () => {
    let s = rushGyro({ cmds: [...releasedN(2, "TST-OP-ET", "et"), released("RS-122", "mar")], rushS: 1 });
    if (s.pendingEffectChoice?.validInstanceIds.includes("RS-122:mar")) {
      const r = tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-122:mar" });
      if (r.ok) s = settle(drain(r.state, "player1"));
    }
    expect(zoneOf(s, "player1", "RS-122:mar")).toBe("command");
  });

  it("RS-120: 出さないことを選べる（任意）（出典: atwiki/page-294「出してもよい」）", () => {
    let s = rushGyro({ cmds: [...releasedN(2, "TST-OP-ET", "et"), released("RS-122", "mar")], rushS: 2 });
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "RS-122:mar")).toBe("command");
  });

  // faq-card-2 RS-120 Q1「いいえ、その場合はＳユニットは捨札にしなければなりません」
  it("RS-120: 公式Q&A — コマンドが5つある状態で出す M ユニットの追加条件の S ユニットは、コマンドゾーンに送れず捨札にする（出典: grnrngr/faq-card-2 RS-120 Q1）", () => {
    // ジャイロの素材をコマンドゾーンに送って5枚にする
    let s = rushGyro({ cmds: [...releasedN(3, "TST-OP-ET", "et"), released("RS-122", "mar")], rushS: 2, dest: "command" });
    expect(s.players.player1.command).toHaveLength(5);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-122:mar" });
    let sawDestination = false;
    for (let i = 0; i < 6 && s.pendingZordSetup; i++) {
      const setup = s.pendingZordSetup;
      if (setup.step === "destination") {
        sawDestination = true;
        expect(tryAct(s, { type: "resolve_zord_setup", playerId: "player1", destination: "command" }).ok).toBe(false);
        s = act(s, { type: "resolve_zord_setup", playerId: "player1", destination: "discard" });
      } else if (setup.step === "material") {
        s = act(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: setup.validInstanceIds[0] });
      } else {
        s = act(s, { type: "resolve_zord_setup", playerId: "player1" });
      }
    }
    s = settle(drain(s, "player1", ["RS-122:mar"]));
    expect(zoneOf(s, "player1", "RS-122:mar")).toBe("rush");
    expect(s.players.player1.discard.some((c) => c.cardId === "TST-UNIT-0")).toBe(true);
    void sawDestination;
  });
});

// ===========================================================================
describe("RS-121 ゴーゴードーザー", () => {
  it("RS-121: カタログ本文・スペックが出典と一致（出典: atwiki/page-295）", () => {
    expectCatalogText(
      "RS-121",
      "【遺跡発掘】これがバトルエリアに出たとき、相手は自分自身のコマンドゾーンからSユニットかMユニットのカードを1枚選び、ラッシュエリアに出してもよい。このとき出したユニットの効果は発動しない。",
    );
    expectStats("RS-121", {
      name: "ゴーゴードーザー",
      category: "ET",
      size: "M",
      bp: 7000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  function dozerEnters(p2: Partial<GameState["players"]["player2"]>, p1Extra: Partial<GameState["players"]["player1"]> = {}) {
    let s = st({ player1: { rush: [inst("RS-121", "dz")], ...p1Extra }, player2: p2 });
    s = enter(s, "RS-121:dz");
    return s;
  }

  // 「相手は自分自身のコマンドゾーンからSユニットかMユニットのカードを1枚選び、ラッシュエリアに出してもよい」
  it("RS-121: バトルエリアに出たとき、相手がコマンドゾーンの S／M ユニットのカードを1枚選んでラッシュエリアに出せる（L・オペレーションは対象外）（出典: atwiki/page-295）", () => {
    let s = dozerEnters({ command: [released("TST-UNIT-0", "s"), released("TST-UNIT-2", "m"), released("TST-UNIT-7", "l"), released("TST-OP", "op")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s", "TST-UNIT-2:m"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-UNIT-2:m" });
    expect(zoneOf(settle(s), "player2", "TST-UNIT-2:m")).toBe("rush");
  });

  it("RS-121: 相手は出さないことを選べる（任意）（出典: atwiki/page-295「出してもよい」）", () => {
    let s = dozerEnters({ command: [released("TST-UNIT-0", "s")] });
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player2")).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player2" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("command");
  });

  // 「このとき出したユニットの効果は発動しない」（R-RUSH-24：「ラッシュしたとき」の効果が使えない）
  it("RS-121: 出したユニットの「ラッシュしたとき」の効果は発動しない（ハリケンドルフィンの大津波）（出典: atwiki/page-295・R-RUSH-24）", () => {
    let s = dozerEnters({ command: [released("RS-098", "do")] }, { battle: [inst("TST-UNIT-0", "mine")] });
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-098:do" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-098:do")).toBe("rush");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player1", "TST-UNIT-0:mine")).toBe("battle");
  });

  // faq-card-2 RS-121 Q1「はい、できます。」／Q4「はい、できます。」
  it("RS-121: 公式Q&A — 必要パワー・追加条件を満たしていない M ユニットも選んでラッシュエリアに出せる（出典: grnrngr/faq-card-2 RS-121 Q1・Q4）", () => {
    let s = dozerEnters({ command: [released("RS-097", "le")], power: [], rush: [] });
    expect(choiceIds(s)).toContain("RS-097:le");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-097:le" });
    s = settle(drain(s, "player2"));
    expect(zoneOf(s, "player2", "RS-097:le")).toBe("rush");
  });

  // faq-card-2 RS-121 Q2「はい、その通りです。」（超電子レーダー）
  it("RS-121: 公式Q&A — 超電子レーダーが配置されていれば、遺跡発掘で S ユニットを出した相手はパワーを1枚手札に戻す（出典: grnrngr/faq-card-2 RS-121 Q2）", () => {
    // rulesSpec/04-rush.test.ts と同じく、超電子レーダーに常駐タグを付けて配置する
    const radar = { ...DEFS["RS-124"]!, tags: ["常駐"] } as typeof DEFS[string];
    let s = st(
      {
        player1: { rush: [inst("RS-121", "dz")], operation: [inst("RS-124", "radar")] },
        player2: { command: [released("TST-UNIT-0", "s")], power: powerCards(2, "e") },
      },
      [radar],
    );
    s = enter(s, "RS-121:dz");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-UNIT-0:s" });
    s = settle(drain(s, "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("rush");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand.some((c) => c.cardId === "TST-P")).toBe(true);
  });

  // faq-card-2 RS-121 Q3「はい、できます。」
  it("RS-121: 公式Q&A — ホールド状態のコマンドのユニットカードも選べる（出典: grnrngr/faq-card-2 RS-121 Q3）", () => {
    const s = dozerEnters({ command: [held("TST-UNIT-0", "hs")] });
    expect(choiceIds(s)).toContain("TST-UNIT-0:hs");
  });

  // faq-card-2 RS-121 Q5「はい、その通りです。」（レッドレーサーはラッシュエリアに置く）
  it("RS-121: 公式Q&A — 遺跡発掘で出したレッドレーサーはバトルエリアでなくラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-121 Q5）", () => {
    let s = dozerEnters({ command: [released("RS-090", "red"), released("TST-OP-OT", "ot")] });
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-090:red" });
    s = settle(drain(s, "player2"));
    expect(zoneOf(s, "player2", "RS-090:red")).toBe("rush");
  });

});

// ===========================================================================
describe("RS-122 ゴーゴーマリン", () => {
  it("RS-122: カタログ本文・スペックが出典と一致（出典: atwiki/page-296）", () => {
    expectCatalogText(
      "RS-122",
      "【海底探査】これが自軍ラッシュエリアにあるとき、次の効果を発動できる。自分が山札からカードをひくとき、上からひくかわりに下からひいてもよい。",
    );
    expectStats("RS-122", {
      name: "ゴーゴーマリン",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ", "潜水艦"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  function drawState(where: "rush" | "battle") {
    return st({
      phase: "start",
      player1: {
        [where]: [inst("RS-122", "mar")],
        deck: [inst("TST-UNIT-0", "top"), inst("TST-UNIT-0", "mid"), inst("TST-UNIT-0", "bottom")],
        hand: [],
      },
      player2: { deck: deckCards(3, "e") },
    });
  }

  // 「自分が山札からカードをひくとき、上からひくかわりに下からひいてもよい」
  it("RS-122: ラッシュエリアにあるとき、ドローで山札の下からひける（出典: atwiki/page-296）", () => {
    let s = act(drawState("rush"), { type: "draw", playerId: "player1" });
    expect(s.pendingEffectChoice?.effectId).toBe("seabed_survey");
    s = act(s, { type: "resolve_seabed_draw", playerId: "player1", placement: "bottom" });
    expect(zoneIds(s, "player1", "hand")).toEqual(["TST-UNIT-0:bottom"]);
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-UNIT-0:top", "TST-UNIT-0:mid"]);
  });

  it("RS-122: 上からひくことも選べる（任意）（出典: atwiki/page-296「ひいてもよい」）", () => {
    let s = act(drawState("rush"), { type: "draw", playerId: "player1" });
    s = act(s, { type: "resolve_seabed_draw", playerId: "player1", placement: "top" });
    expect(zoneIds(s, "player1", "hand")).toEqual(["TST-UNIT-0:top"]);
  });

  it("RS-122: バトルエリアにあるときは使えない（出典: atwiki/page-296「これが自軍ラッシュエリアにあるとき」）", () => {
    const s = act(drawState("battle"), { type: "draw", playerId: "player1" });
    expect(s.pendingEffectChoice?.effectId).not.toBe("seabed_survey");
    expect(zoneIds(s, "player1", "hand")).toEqual(["TST-UNIT-0:top"]);
  });

  // faq-card-2 RS-122 Q1「カードを「ひく」とき以外には発動できません。たとえば…「RS-027 ダイノガッツ」の効果で「カードをひいて捨札にする」といったときに…「下からひく」ことができます」
  it("RS-122: 公式Q&A — ダイノガッツの「ひいて捨札にする」でも下からひける（出典: grnrngr/faq-card-2 RS-122 Q1）", () => {
    const PC1 = sUnit("SPEC-PC1", { powerCost: 1 });
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "big")] },
      player2: {
        battle: [inst("SPEC-PC1", "e")],
        rush: [inst("RS-122", "mar")],
        hand: [inst("RS-027", "dg")],
        command: [released("TST-OP", "c")],
        deck: [inst("TST-OP", "top"), inst("TST-OP", "bottom")],
        power: powerCards(3, "e"),
      },
    }, [PC1]);
    s = attack(s, "TST-UNIT-7:big", "SPEC-PC1:e");
    s = settle(s, 0);
    for (let i = 0; i < 4 && !canUseCard(s, "player2", "RS-027:dg"); i++) {
      const pass = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(canUseCard(s, "player2", "RS-027:dg")).toBe(true);
    s = useCard(s, "player2", "RS-027:dg");
    expect(s.pendingEffectChoice?.effectId).toBe("seabed_survey");
    s = act(s, { type: "resolve_seabed_draw", playerId: "player2", placement: "bottom" });
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-OP:bottom")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:top")).toBe("deck");
  });

  // faq-card-2 RS-122 Q1「カードを「ひく」とき以外には発動できません」— 「山札の上から1枚を見る」（RS-066【遺跡調査】）は下から見られない
  it("RS-122: 公式Q&A — 「山札の上から1枚を見る」効果（ボウケンピンク【遺跡調査】）では下から見ることはできない（出典: grnrngr/faq-card-2 RS-122 Q1）", () => {
    let s = st({
      player1: {
        battle: fillers(1),
        rush: [inst("RS-066", "pink"), inst("RS-122", "mar")],
        deck: [inst("TST-OP", "top"), inst("TST-OP", "mid"), inst("TST-OP", "bottom")],
      },
    });
    s = enter(s, "RS-066:pink");
    expect(s.pendingEffectChoice?.effectId).not.toBe("seabed_survey");
    expect(s.pendingEffectChoice?.viewedInstanceIds).toEqual(["TST-OP:top"]);
    s = act(s, { type: "resolve_ruin_survey", playerId: "player1", placement: "bottom" });
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:mid", "TST-OP:bottom", "TST-OP:top"]);
  });
});

void [useCard, strike];
