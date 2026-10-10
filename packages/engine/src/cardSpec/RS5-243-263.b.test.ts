/**
 * カード別スペック: RS-249〜RS-256（第5弾「五龍の逆鱗」Vコマンダー〜闇の戒律）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか card_1/card_3/card_6/card_8/rider_2 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *     再録カード（ジャッジメント・ファイブテクター・バードニックウェーブ・巨大化爆弾）の atwiki ページには元カードの Q&A が載っている。
 *  3. docs/rules/*.md の一般ルール（R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { getComboNumberDelta } from "../rules/turnModifierBridge";
import { effectiveComboNumber } from "../core/catalog";
import {
  act,
  attack,
  bpOf,
  canSkip,
  canUse,
  canUseOn,
  choiceIds,
  confirm,
  deckCards,
  drain,
  enter,
  expectCatalogText,
  expectOpStats,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  nextPhase,
  passEntry,
  payAndUse,
  pick,
  powerCards,
  released,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  toPhase,
  tryAct,
  tryPayAndUse,
  useCard,
  withPlayer,
  zoneOf,
  CMD,
} from "./RS5-243-263.helpers";
import type { CardInstance, GameState } from "../types/game";

/** 保留中の選択で、候補にあれば want を、なければ先頭を選び続ける（最大 n 回）。 */
function pickAll(s: GameState, want: string[], n = 6): GameState {
  let next = s;
  for (let i = 0; i < n && next.pendingEffectChoice; i += 1) {
    const p = next.pendingEffectChoice;
    const id = want.find((w) => p.validInstanceIds.includes(w)) ?? p.validInstanceIds[0];
    if (!id) break;
    const r = tryAct(next, { type: "resolve_effect_choice", playerId: p.playerId, instanceId: id });
    if (!r.ok) break;
    next = r.state;
  }
  return next;
}

// ===========================================================================
describe("RS-249 Vコマンダー", () => {
  const TEXT =
    "自軍山札を見て、特徴「恐竜」を持つユニットカードを1枚選び、ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、山札をシャッフルする。";

  function vcom(deck: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-249", "vc")], command: [released(CMD.OT, "pay")], power: powerCards(5), deck, ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
    s = payAndUse(s, "player1", "RS-249:vc");
    return s;
  }

  it("RS-249: カタログ本文・スペックが出典と一致（出典: atwiki/page-421）", () => {
    expectCatalogText("RS-249", TEXT);
    expectOpStats("RS-249", { name: "Vコマンダー", category: "OT", powerCost: 5 });
  });

  it("RS-249: 必要パワー5 — パワー4では使用できない（出典: atwiki/page-421「必要パワー：5」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-249", "vc")], command: [released(CMD.OT, "pay")], power: powerCards(4), deck: deckCards(3) } });
    expect(canUse(s, "player1", "RS-249:vc")).toBe(false);
  });

  it("RS-249: 山札から特徴「恐竜」のユニットカードを1枚選んでラッシュエリアに出す（恐竜でないカードは選べない）（出典: atwiki/page-421）", () => {
    let s = vcom([inst("TST-OP", "d0"), inst("RS-051", "tyr"), inst("TST-UNIT-0", "x"), inst("RS-052", "tri")]);
    expect(choiceIds(s)).toEqual(["RS-051:tyr", "RS-052:tri"]);
    s = pick(s, "RS-051:tyr");
    expect(zoneOf(s, "player1", "RS-051:tyr")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it("RS-249: 必要パワーは満たさなくてよい（パワー5で必要パワー8の守護獣サーベルタイガーを出せる）（出典: atwiki/page-421「必要パワーは満たさなくてもよい」）", () => {
    let s = vcom([inst("RS-038", "sab"), ...deckCards(2)]);
    s = pickAll(s, ["RS-038:sab"]);
    expect(zoneOf(s, "player1", "RS-038:sab")).toBe("rush");
  });

  it("RS-249: 追加条件は満たす必要がある — 合体素材がなければアバレンオーは選べず、素材があれば素材を捨札にして出せる（出典: atwiki/page-421「ただし、追加条件は満たすこと」・R-ADD-06）", () => {
    const none = vcom([inst("RS-050", "ao"), inst("RS-051", "tyr")]);
    expect(choiceIds(none)).toEqual(["RS-051:tyr"]);
    let s = vcom([inst("RS-050", "ao"), ...deckCards(2)], {
      rush: [inst("RS-051", "m1"), inst("RS-052", "m2"), inst("RS-053", "m3")],
    });
    s = pickAll(s, ["RS-050:ao", "RS-051:m1", "RS-052:m2", "RS-053:m3"]);
    expect(zoneOf(s, "player1", "RS-050:ao")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-051:m1")).toBe("discard");
  });

  it("RS-249: 恐竜のユニットカードが山札になくても使用でき、何も出ない（出典: atwiki/page-421）", () => {
    const s = vcom([inst("TST-OP", "d0"), inst("TST-UNIT-0", "x")]);
    expect(zoneOf(s, "player1", "RS-249:vc")).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(2);
  });

  // atwiki/page-421 Q1・faq-card-6 RS-359 Q「はい、できます。」（デンジ犬アイシー【最後の手段】で Vレックスロボの追加条件を満たせる）
  // 既知の不具合: CARD-RS-359（範囲外）デンジ犬アイシー【最後の手段】が未実装（山札のカードで追加条件を満たす処理がない）
  it("RS-249: Q&A — デンジ犬アイシーの【最後の手段】で山札の Vレックスを捨札にして、Vレックスロボの追加条件を満たして出せる（出典: atwiki/page-421 Q1・grnrngr/faq-card-6 RS-359 Q）", () => {
    let s = vcom([inst("RS-301", "robo"), inst("RS-302", "rex"), ...deckCards(2)], { rush: [inst("RS-359", "icy")] });
    s = pickAll(s, ["RS-301:robo", "RS-359:icy", "RS-302:rex"]);
    expect(zoneOf(s, "player1", "RS-301:robo")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-302:rex")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-359:icy")).toBe("discard");
  });

  // faq-card-6 RS-374 Q「いいえ、捨札にはなりません。…「RS-249 Vコマンダー」の効果によってであり、コマンドをホールドしてラッシュしたわけではないから」
  it("RS-249: 公式Q&A — 敵軍に魔女バンドーラがいても、Vコマンダーのためにホールドした自軍コマンドは捨札にならない（恐竜ユニットは出る）（出典: grnrngr/faq-card-6 RS-374 Q）", () => {
    let s = vcom([inst("RS-051", "tyr"), ...deckCards(2)], {}, { rush: [inst("RS-374", "bandora")] });
    s = pickAll(s, ["RS-051:tyr"]);
    expect(zoneOf(s, "player1", "RS-051:tyr")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP-OT:pay")).toBe("command");
  });
});

// ===========================================================================
describe("RS-250 ジャッジメント", () => {
  const TEXT =
    "敵軍ユニットを1体選んでターゲットとする。そして　自軍山札の上から1枚をオモテにし、それがターゲットと同じサイズのユニットなら、ターゲットを撃破する。その後、オモテにしたカードは山札の下に戻す。";

  function judge(top: string, opts: { power?: number; p2?: Partial<GameState["players"]["player2"]> } = {}) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-250", "op")],
        power: powerCards(opts.power ?? 5),
        command: [released(CMD.OT, "c")],
        deck: [inst(top, "top"), ...deckCards(2, "rest")],
      },
      player2: { battle: [inst("TST-UNIT-0", "t")], ...opts.p2 },
    });
  }
  const useOn = (s: GameState, target: string) => {
    let n = payAndUse(s, "player1", "RS-250:op", { targetInstanceId: target });
    if (n.pendingEffectChoice?.validInstanceIds.includes(target)) n = pick(n, target);
    return n;
  };

  it("RS-250: カタログ本文・スペックが出典と一致（出典: atwiki/page-32）", () => {
    expectCatalogText("RS-250", TEXT);
    expectOpStats("RS-250", { name: "ジャッジメント", category: "OT", powerCost: 5 });
  });

  it("RS-250: 山札の上が同じサイズ（S）のユニットならターゲットを撃破し、オモテにしたカードは山札の下へ（出典: atwiki/page-32）", () => {
    const s = useOn(judge("TST-UNIT-0"), "TST-UNIT-0:t");
    expect(zoneOf(s, "player2", "TST-UNIT-0:t")).toBe("discard");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-UNIT-0:top");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(zoneOf(s, "player1", "RS-250:op")).toBe("discard");
  });

  it("RS-250: 違うサイズ（M）のユニットなら撃破しないが、オモテにしたカードは山札の下へ（出典: atwiki/page-32「同じサイズのユニットなら」）", () => {
    const s = useOn(judge("TST-UNIT-2"), "TST-UNIT-0:t");
    expect(zoneOf(s, "player2", "TST-UNIT-0:t")).toBe("battle");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-UNIT-2:top");
  });

  it("RS-250: M のターゲットに M のユニットが出れば撃破する（出典: atwiki/page-32「ターゲットと同じサイズ」）", () => {
    const s = useOn(judge("TST-UNIT-2", { p2: { battle: [inst("TST-UNIT-2", "tm")] } }), "TST-UNIT-2:tm");
    expect(zoneOf(s, "player2", "TST-UNIT-2:tm")).toBe("discard");
  });

  it("RS-250: オモテにしたカードがユニットでなければ撃破しない（出典: atwiki/page-32「ユニットなら」）", () => {
    const s = useOn(judge("TST-OP"), "TST-UNIT-0:t");
    expect(zoneOf(s, "player2", "TST-UNIT-0:t")).toBe("battle");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-OP:top");
  });

  it("RS-250: 自軍ユニットはターゲットに選べない（出典: atwiki/page-32「敵軍ユニットを1体選んで」）", () => {
    const s = withPlayer(judge("TST-UNIT-0"), "player1", { ...judge("TST-UNIT-0").players.player1, battle: [inst("TST-UNIT-0", "own")] });
    expect(canUseOn(s, "player1", "RS-250:op", "TST-UNIT-0:t")).toBe(true);
    expect(canUseOn(s, "player1", "RS-250:op", "TST-UNIT-0:own")).toBe(false);
  });

  it("RS-250: 必要パワー5 — パワー4では使用できない（出典: atwiki/page-32「必要パワー：5」）", () => {
    expect(canUse(judge("TST-UNIT-0", { power: 4 }), "player1", "RS-250:op")).toBe(false);
  });

  it("RS-250: 敵軍ラッシュエリアのユニットもターゲットにできる（出典: atwiki/page-32・R-TGT-01）", () => {
    const s0 = judge("TST-UNIT-0", { p2: { battle: [inst("TST-UNIT-0", "t")], rush: [inst("TST-UNIT-0", "r")] } });
    expect(canUseOn(s0, "player1", "RS-250:op", "TST-UNIT-0:r")).toBe(true);
    const s = useOn(s0, "TST-UNIT-0:r");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-251 ブン・ターの特訓", () => {
  const TEXT =
    "自軍山札を見て、必要パワーの数字に「－」のあるユニットカードを1枚選び、ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。";

  function bunta(deck: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}) {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-251", "bt")], command: [released(CMD.OT, "pay")], power: powerCards(7), deck, ...p1 },
    });
    s = payAndUse(s, "player1", "RS-251:bt");
    return s;
  }

  it("RS-251: カタログ本文・スペックが出典と一致（出典: atwiki/page-422）", () => {
    expectCatalogText("RS-251", TEXT);
    expectOpStats("RS-251", { name: "ブン・ターの特訓", category: "OT", powerCost: 0 });
  });

  it("RS-251: 山札から必要パワーに「－」のあるユニットカード（アバレッドAM 7-）を選んでラッシュエリアに出す（「－」のないカードは選べない）（出典: atwiki/page-422）", () => {
    let s = bunta([inst("TST-OP", "d0"), inst("RS-230", "aam"), inst("TST-UNIT-0", "x")]);
    expect(choiceIds(s)).toEqual(["RS-230:aam"]);
    s = pick(s, "RS-230:aam");
    expect(zoneOf(s, "player1", "RS-230:aam")).toBe("rush");
  });

  it("RS-251: 必要パワーは満たす必要がある — パワー6では選べず、パワー7なら選べる（出典: atwiki/page-422「必要パワーと追加条件は満たすこと」）", () => {
    const six = bunta([inst("RS-230", "aam"), ...deckCards(2)], { power: powerCards(6) });
    expect(six.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("RS-230:aam");
    const seven = bunta([inst("RS-230", "aam"), ...deckCards(2)]);
    expect(seven.pendingEffectChoice?.validInstanceIds ?? []).toContain("RS-230:aam");
  });

  it("RS-251: 追加条件（自軍アバレッドを捨札にすれば必要パワー0）を満たせばパワー0でも出せる（出典: atwiki/page-422・RS-230 本文）", () => {
    let s = bunta([inst("RS-230", "aam"), ...deckCards(2)], { power: [], rush: [inst("RS-054", "red")] });
    s = pickAll(s, ["RS-230:aam", "RS-054:red"]);
    expect(zoneOf(s, "player1", "RS-230:aam")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("discard");
  });

  // faq-card-5 RS-251 Q1「はい、シャッフルしてください。」
  it.todo(
    "RS-251: 公式Q&A — 「－」のユニットカードが山札になくても、その後山札をシャッフルする（出典: grnrngr/faq-card-5 RS-251 Q1）— シャッフルしたことを公開 API で観測する手段がない（ログ・状態に痕跡が残らず、順序の変化は乱数次第）",
  );

  // faq-card-5 RS-251 Q2「はい、使用できます。」
  it("RS-251: 公式Q&A — 「－」のユニットカードが山札に1枚もないと分かっていても使用できる（出典: grnrngr/faq-card-5 RS-251 Q2）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-251", "bt")], command: [released(CMD.OT, "pay")], power: powerCards(1), deck: deckCards(3) } });
    expect(canUse(s, "player1", "RS-251:bt")).toBe(true);
    const after = payAndUse(s, "player1", "RS-251:bt");
    expect(zoneOf(after, "player1", "RS-251:bt")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-252 バイモーションバスター", () => {
  const TEXT = "敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  function bimo(p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) {
    return st({
      phase: "rush",
      player1: { hand: [inst("RS-252", "bb")], command: [released(CMD.ET, "pay")], power: powerCards(4), deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
  }

  it("RS-252: カタログ本文・スペックが出典と一致（出典: atwiki/page-423）", () => {
    expectCatalogText("RS-252", TEXT);
    expectOpStats("RS-252", { name: "バイモーションバスター", category: "ET", powerCost: 4 });
  });

  it("RS-252: 敵軍 S ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-423）", () => {
    let s = payAndUse(bimo({ battle: [inst("TST-UNIT-0", "es")] }), "player1", "RS-252:bb");
    s = pick(s, "TST-UNIT-0:es");
    const c = s.players.player2.command.find((x) => x.instanceId === "TST-UNIT-0:es");
    expect(c?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "RS-252:bb")).toBe("discard");
  });

  it("RS-252: M ユニット・自軍ユニットは選べず、選択は見送れない（出典: atwiki/page-423「敵軍Sユニットを1体選び」）", () => {
    const s = payAndUse(bimo({ battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em")] }, { rush: [inst("TST-UNIT-0", "own")] }), "player1", "RS-252:bb");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-252: 必要パワー4 — パワー3では使用できない（出典: atwiki/page-423「必要パワー：4」）", () => {
    expect(canUse(bimo({ battle: [inst("TST-UNIT-0", "es")] }, { power: powerCards(3) }), "player1", "RS-252:bb")).toBe(false);
  });

  it("RS-252: 敵軍ラッシュエリアの S ユニットも選べる（出典: atwiki/page-423・R-TGT-01）", () => {
    const s = payAndUse(bimo({ battle: [inst("TST-UNIT-0", "es")], rush: [inst("TST-UNIT-0", "er")] }), "player1", "RS-252:bb");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:er", "TST-UNIT-0:es"]);
  });

  // 「置けなければ捨札にする」（コマンドゾーンは5枚まで）
  it("RS-252: 持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-423「置けなければ捨札にする」・R-ZONE コマンドゾーン上限5）", () => {
    let s = payAndUse(
      bimo({ battle: [inst("TST-UNIT-0", "es")], command: Array.from({ length: 5 }, (_, i) => held("TST-OP", `full${i}`)) }),
      "player1",
      "RS-252:bb",
    );
    s = pick(s, "TST-UNIT-0:es");
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-252: 撃破ではないので、「撃破されて捨札になったとき」の効果（ファイズAF）は働かない（出典: atwiki/page-423・RK-203 本文）", () => {
    let s = payAndUse(bimo({ battle: [inst("RK-203", "af")], discard: [inst("RK-064", "faiz")] }), "player1", "RS-252:bb");
    s = pick(s, "RK-203:af");
    s = settle(s);
    expect(zoneOf(s, "player2", "RK-203:af")).toBe("command");
    expect(zoneOf(s, "player2", "RK-064:faiz")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-253 ファイブテクター", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）ストライクされるとき、自軍ラッシュエリアのSユニットを1体選んでバトルエリアに出し、ストライクしてきた敵軍ユニットとバトルしてもよい。そのとき、敵軍のストライクは無効になる。";

  function strikeState(p2: Partial<GameState["players"]["player2"]>, p1Battle?: CardInstance[]) {
    let s = st({
      player1: { battle: p1Battle ?? [inst("TST-UNIT-0", "striker")] },
      player2: { operation: [inst("RS-253", "ft")], power: powerCards(4, "e"), deck: deckCards(3, "e"), ...p2 },
    });
    s = strike(s, "TST-UNIT-0:striker");
    return s;
  }

  it("RS-253: カタログ本文・スペックが出典と一致（出典: atwiki/page-255）", () => {
    expectCatalogText("RS-253", TEXT);
    expectOpStats("RS-253", { name: "ファイブテクター", category: "ET", powerCost: 5, keyword: "常駐" });
  });

  it("RS-253: 使用すると常駐置き場に配置される（出典: atwiki/page-255「※常駐」）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RS-253", "ft")], command: [released(CMD.ET, "pay")], power: powerCards(5) } });
    s = payAndUse(s, "player1", "RS-253:ft");
    expect(zoneOf(s, "player1", "RS-253:ft")).toBe("operation");
  });

  it("RS-253: ストライクされるとき、ラッシュエリアの S ユニットをバトルエリアに出してバトルし、ストライクは無効（出典: atwiki/page-255）", () => {
    let s = strikeState({ rush: [{ ...inst("TST-UNIT-0", "gs"), bpModifier: 5000 }, inst("TST-UNIT-2", "m")] });
    s = act(s, legal(s).find((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "TST-UNIT-0:gs")!);
    s = settle(s);
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:gs")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:striker")).toBe("discard");
  });

  it("RS-253: ラッシュエリアの M ユニットは選べない（出典: atwiki/page-255「Sユニットを1体選んで」）", () => {
    const s = strikeState({ rush: [inst("TST-UNIT-2", "m")] });
    expect(legalOfType(s, "five_tech_intercept")).toHaveLength(0);
  });

  it("RS-253: 「してもよい」— 迎撃の選択肢がある状態で、使わずにストライクを受けることもできる（出典: atwiki/page-255）", () => {
    let s = strikeState({ rush: [inst("TST-UNIT-0", "g")] });
    expect(legalOfType(s, "five_tech_intercept").length).toBeGreaterThan(0);
    expect(legal(s).some((a) => a.type === "pass_strike_reaction")).toBe(true);
    s = settle(s);
    expect(s.players.player2.damage).toBe(1);
    expect(zoneOf(s, "player2", "TST-UNIT-0:g")).toBe("rush");
  });

  // atwiki/page-255 Q1「そ れは出来ません。…アタックされたときを発動条件とする隠流忍術を発動することもできません。」
  it("RS-253: Q&A — ファイブテクターでバトルに持ち込んだ後、隠流忍術でバトルの相手を変えられない（出典: atwiki/page-255 Q1）", () => {
    let s = strikeState({ rush: [inst("TST-UNIT-0", "g")], battle: [inst("TST-UNIT-2", "other")], hand: [inst("RS-018", "ninja")], command: [released(CMD.MA, "ma")] });
    s = act(s, legal(s).find((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "TST-UNIT-0:g")!);
    expect(canUse(s, "player2", "RS-018:ninja")).toBe(false);
  });

  // atwiki/page-255 Q2「はい、その通りです。」
  it("RS-253: Q&A — 敵軍にハリケンレオンがいれば、SP1以上のユニットを出すときコマンドを1つホールドする（なければ出せない）（出典: atwiki/page-255 Q2）", () => {
    const base = { player1: { battle: [inst("RS-097", "leon"), inst("TST-UNIT-0", "striker")] } };
    let none = st({ ...base, player2: { operation: [inst("RS-253", "ft")], rush: [inst("TST-UNIT-0", "g")], command: [] } });
    none = strike(none, "TST-UNIT-0:striker");
    expect(legalOfType(none, "five_tech_intercept")).toHaveLength(0);
    let s = st({ ...base, player2: { operation: [inst("RS-253", "ft")], rush: [inst("TST-UNIT-0", "g")], command: [released("TST-OP", "c")] } });
    s = strike(s, "TST-UNIT-0:striker");
    s = act(s, legal(s).find((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "TST-UNIT-0:g")!);
    s = drain(s, "player2");
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });

  // atwiki/page-255 Q3「いいえ、発動しません。コンビネーションの効果を発動できるのは、自分のバトルフェイズになります。」
  it("RS-253: Q&A — ファイブテクターで出したユニットがナンバーの位置に並んでも NC は発動しない（出典: atwiki/page-255 Q3）", () => {
    let s = strikeState({ rush: [inst("RS-059", "blue")], battle: [inst("TST-UNIT-2", "f")] });
    s = act(s, legal(s).find((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "RS-059:blue")!);
    expect(zoneOf(s, "player2", "RS-059:blue")).toBe("battle");
    expect(s.players.player2.deck).toHaveLength(3);
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-254 バードニックウェーブ", () => {
  const TEXT = "このターン、すべての自軍ユニットのコンビネーションナンバーは1少なくなる。ただし、2より少なくならない。";

  function waveState(rush: CardInstance[], ops = 1, extra: { command?: CardInstance[] } = {}) {
    const waves = Array.from({ length: ops }, (_, i) => inst("RS-254", `w${i}`));
    let s = st({
      phase: "rush",
      player1: {
        hand: waves,
        power: powerCards(2 * Math.max(ops, 1)),
        command: [...waves.map((_, i) => released(CMD.ET, `c${i}`)), ...(extra.command ?? [])],
        rush,
        deck: deckCards(4),
      },
      player2: { deck: deckCards(4, "e") },
    });
    for (const w of waves) s = payAndUse(s, "player1", w.instanceId);
    return s;
  }
  const ncActive = (s: GameState, id: string) =>
    (s.players.player1.battle.find((c) => c.instanceId === id)?.activatedNcEffects ?? []).length > 0;

  it("RS-254: カタログ本文・スペックが出典と一致（出典: atwiki/page-256）", () => {
    expectCatalogText("RS-254", TEXT);
    expectOpStats("RS-254", { name: "バードニックウェーブ", category: "ET", powerCost: 2 });
  });

  it("RS-254: コンビネーションナンバー3のユニット（マジイエロー）が2番目で NC を発動できる（出典: atwiki/page-256「1少なくなる」）", () => {
    let s = nextPhase(waveState([inst("TST-UNIT-0", "f"), inst("RS-058", "y")]));
    s = passEntry(enter(s, "TST-UNIT-0:f"));
    s = enter(s, "RS-058:y");
    expect(ncActive(s, "RS-058:y")).toBe(true);
  });

  it("RS-254: 使わなければ CN3 のユニットは2番目で NC を発動しない（対照）（出典: atwiki/page-256）", () => {
    let s = nextPhase(waveState([inst("TST-UNIT-0", "f"), inst("RS-058", "y")], 0));
    s = passEntry(enter(s, "TST-UNIT-0:f"));
    s = enter(s, "RS-058:y");
    expect(ncActive(s, "RS-058:y")).toBe(false);
  });

  it("RS-254: 「自軍ユニット」だけ — 敵軍ユニットのナンバーは変わらない（出典: atwiki/page-256「すべての自軍ユニットの」）", () => {
    const s = waveState([]);
    expect(effectiveComboNumber(s, "player1", 3)).toBe(2);
    expect(effectiveComboNumber(s, "player2", 3)).toBe(3);
  });

  it("RS-254: 効果は「このターン」だけ（次の自軍ターンには残らない）（出典: atwiki/page-256「このターン、」）", () => {
    let s = waveState([]);
    expect(getComboNumberDelta(s.players.player1)).toBe(1);
    s = toPhase(s, "player2", "rush");
    s = toPhase(s, "player1", "rush");
    expect(getComboNumberDelta(s.players.player1)).toBe(0);
  });

  // atwiki/page-256 Q1（grnrngr/faq-card-1 RS-015 Q1・faq-card-5 RS-263 Q4）「参照するのは、「カードに表記された本来のナンバー」だけです。」
  it("RS-254: Q&A — タンクコマンドは修正後ではなく本来のナンバーを参照する（本来 CN4 のマジピンクは、CN3 のカードがリリース状態でも NC を封じられない）（出典: atwiki/page-256 Q1）", () => {
    let s = nextPhase(
      waveState([inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("RS-060", "pink"), inst("RS-263", "tank")], 1, {
        command: [released("RS-058", "cmdYellow")],
      }),
    );
    s = passEntry(enter(s, "TST-UNIT-0:f1"));
    s = passEntry(enter(s, "TST-UNIT-0:f2"));
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:pink" });
    const triggered = ncActive(s, "RS-060:pink") || s.pendingEffectChoice?.sourceCardId === "RS-060" || s.log.some((l) => l.includes("number_combo") && l.includes("RS-060"));
    expect(triggered).toBe(true);
  });

  // atwiki/page-256 Q2（faq-card-4 RS-222 Q1）「はい、その通りです。」
  it("RS-254: Q&A — タイムピンク【戦闘指揮】で発動させる次のユニット（アバレイエロー CN3→2）の NC も、ナンバー2と同じ2枚のリリースで発動する（出典: atwiki/page-256 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        rush: [inst("TST-UNIT-0", "f0"), inst("TST-UNIT-0", "f1"), inst("RS-222", "tp"), inst("RS-104", "y")],
        hand: [inst("RS-254", "bw")],
        command: [released(CMD.ET, "et")],
        power: powerCards(3),
        deck: deckCards(5),
      },
      player2: { command: [held("TST-OP", "h0"), held("TST-OP", "h1"), held("TST-OP", "h2")], deck: deckCards(5, "e") },
    });
    s = useCard(s, "player1", "RS-254:bw");
    s = toPhase(s, "player1", "battle");
    s = passEntry(enter(s, "TST-UNIT-0:f0"));
    s = passEntry(enter(s, "TST-UNIT-0:f1"));
    s = passEntry(enter(s, "RS-222:tp"));
    s = enter(s, "RS-104:y");
    expect(s.pendingEffectChoice?.effectId).toBe("battle_command");
    s = confirm(s);
    expect(s.players.player2.command.filter((c) => !c.commandHeld)).toHaveLength(2);
  });

  // atwiki/page-256 Q3「はい、重複します。」
  it("RS-254: Q&A — 効果は重複する（2枚で CN4 のマジピンクが2番目で NC）（出典: atwiki/page-256 Q3）", () => {
    let s = waveState([inst("TST-UNIT-0", "f"), inst("RS-060", "pink")], 2);
    expect(getComboNumberDelta(s.players.player1)).toBe(2);
    s = nextPhase(s);
    s = passEntry(enter(s, "TST-UNIT-0:f"));
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-060:pink" });
    const triggered = ncActive(s, "RS-060:pink") || s.pendingEffectChoice?.sourceCardId === "RS-060" || s.log.some((l) => l.includes("number_combo") && l.includes("RS-060"));
    expect(triggered).toBe(true);
  });

  // faq-card-5 RS-254 Q1（atwiki Q4）「いいえ、なりません。…元の値が２より小さいものは、「少なくなる」ということはありません。」
  it("RS-254: 公式Q&A — 元のナンバーが2より小さい（1の）ユニットは2にならず1のまま（2は2、3は2）（出典: grnrngr/faq-card-5 RS-254 Q1・atwiki/page-256 Q4）", () => {
    const s = waveState([]);
    expect(effectiveComboNumber(s, "player1", 1)).toBe(1);
    expect(effectiveComboNumber(s, "player1", 2)).toBe(2);
    expect(effectiveComboNumber(s, "player1", 3)).toBe(2);
    expect(effectiveComboNumber(s, "player1", 5)).toBe(4);
  });
});

// ===========================================================================
describe("RS-255 巨大化爆弾", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる）敵軍ターン中、特徴「怪人」を持つ自軍ユニットが撃破されて捨札になったとき発動できる⇒そのユニットカードを、このカードに重ねてラッシュエリアに出す。このカードに重ねたユニットはBP＋3000され、「SP1」「Lユニット」になる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";
  const BIG = sUnit("SPEC-BIG", { size: "M", bp: 9000 });

  /** 敵軍（player2）のターン、player2 の BP9000 がアタックして player1 の unitCardId（バトルエリア）を撃破する。 */
  function destroyedByAttack(unitCardId = "RS-257", p1: Partial<GameState["players"]["player1"]> = {}) {
    const s = st(
      {
        activePlayer: "player2",
        player1: {
          battle: [inst(unitCardId, "kai")],
          hand: [inst("RS-255", "bomb")],
          command: [released(CMD.DA, "c")],
          power: powerCards(4),
          deck: deckCards(3),
          ...p1,
        },
        player2: { battle: [inst("SPEC-BIG", "atk")], deck: deckCards(3, "e") },
      },
      [BIG],
    );
    return attack(s, "SPEC-BIG:atk", `${unitCardId}:kai`, "player2");
  }

  it("RS-255: カタログ本文・スペックが出典と一致（出典: atwiki/page-37）", () => {
    expectCatalogText("RS-255", TEXT);
    expectOpStats("RS-255", { name: "巨大化爆弾", category: "DA", powerCost: 4, keyword: "カウンター" });
  });

  it("RS-255: 敵軍ターン中、特徴「怪人」の自軍ユニット（野球仮面）が撃破されて捨札になったとき使用でき、重ねてラッシュエリアに出す（BP+3000・「SP1」）（出典: atwiki/page-37）", () => {
    let s = destroyedByAttack();
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("discard");
    expect(canUse(s, "player1", "RS-255:bomb")).toBe(true);
    s = useCard(s, "player1", "RS-255:bomb");
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("rush");
    expect(bpOf(s, "player1", "RS-257:kai")).toBe(5000);
    expect(spOf(s, "player1", "RS-257:kai")).toBe(1);
  });

  it("RS-255: 特徴「怪人」を持たないユニットが撃破されても使用できない（出典: atwiki/page-37「特徴「怪人」を持つ自軍ユニットが」）", () => {
    const s = destroyedByAttack("TST-UNIT-0");
    expect(zoneOf(s, "player1", "TST-UNIT-0:kai")).toBe("discard");
    expect(canUse(s, "player1", "RS-255:bomb")).toBe(false);
  });

  it("RS-255: 自軍ターン中に怪人ユニットが撃破されても使用できない（出典: atwiki/page-37「敵軍ターン中にのみ使用できる」）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-257", "kai")], hand: [inst("RS-255", "bomb")], command: [released(CMD.DA, "c")], power: powerCards(4) },
        player2: { battle: [inst("SPEC-BIG", "def")] },
      },
      [BIG],
    );
    s = attack(s, "RS-257:kai", "SPEC-BIG:def");
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("discard");
    expect(canUse(s, "player1", "RS-255:bomb")).toBe(false);
  });

  it("RS-255: 「発動できる」— 使わなければユニットは捨札のまま（出典: atwiki/page-37）", () => {
    const s = settle(destroyedByAttack());
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-255:bomb")).toBe("hand");
  });

  it("RS-255: 重ねたユニットが撃破されてユニットでなくなるとき、巨大化爆弾も捨札になる（出典: atwiki/page-37「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = settle(useCard(destroyedByAttack(), "player1", "RS-255:bomb"));
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("rush");
    // 次の自軍ターン、BP5000（2000+3000）でバトルエリアに出て BP9000 にアタックし、撃破される
    s = toPhase(s, "player1", "battle");
    s = withPlayer(s, "player2", { battle: [inst("SPEC-BIG", "def")] });
    s = enter(s, "RS-257:kai");
    // 1番目に出た野球仮面の NC【予告ホームラン】（任意）は見送る。
    if (s.pendingEffectChoice?.sourceCardId === "RS-257" && canSkip(s)) s = skip(s);
    s = settle(attack(s, "RS-257:kai", "SPEC-BIG:def"));
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-255:bomb")).toBe("discard");
  });

  // faq-card-5 RS-255 Q1（atwiki Q1）「はい、その通りです。」
  it("RS-255: 公式Q&A — ゴーマ16世がラッシュされている状態で、BP3000 以下のユニットに巨大化爆弾を使うと（BP+3000 が−3000 になり）撃破される（出典: grnrngr/faq-card-5 RS-255 Q1・atwiki/page-37 Q1）", () => {
    let s = destroyedByAttack("RS-257");
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, rush: [inst("RS-210", "goma")] } } };
    s = settle(useCard(s, "player1", "RS-255:bomb"));
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("discard");
  });

  // faq-card-5 RS-255 Q2（atwiki Q2）「はい、発動させることができます。」
  it.todo(
    "RS-255: 公式Q&A — 巨大化爆弾に重ねられているユニットはナンバーコンビネーションの効果を発動できる（出典: grnrngr/faq-card-5 RS-255 Q2・atwiki/page-37 Q2）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、重ねた状態を公開 API で組めない",
  );

  // faq-card-5 RS-255 Q3（atwiki Q3・faq-card-1 RS-027）「はい、できます。」
  it.todo(
    "RS-255: 公式Q&A — 重ねたユニットにダイノガッツを使えば、巨大化爆弾とそのユニットを場に留められる（出典: grnrngr/faq-card-5 RS-255 Q3・faq-card-1 RS-027）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、重ねた状態を公開 API で組めない",
  );

  // faq-card-5 RS-255 Q4（atwiki Q4）「いいえ、効果は受けません。…「Ｌユニット」として扱います。」
  it("RS-255: 公式Q&A — 巨大化爆弾を使ったユニットは L ユニットとして扱い、S ユニットを対象にした効果（ガオメインバスター）を受けない（出典: grnrngr/faq-card-5 RS-255 Q4・atwiki/page-37 Q4）", () => {
    let s = settle(useCard(destroyedByAttack(), "player1", "RS-255:bomb"));
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("rush");
    s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: s.players.player1,
      player2: { hand: [inst("RS-245", "gb")], command: [released(CMD.WB, "p")], power: powerCards(5) },
    });
    expect(canUseOn(s, "player2", "RS-245:gb", "RS-257:kai")).toBe(false);
  });

  // atwiki/page-37 Q5（faq-card-8 RS-582）「いいえ、できません。…カウンターを持つオペレーションが効果を発動して、すぐに捨札になったときだけです。」
  it.todo(
    "RS-255: Q&A — 重ねたユニットが撃破されて巨大化爆弾が捨札になっても、魔道神官メーミィで山札から巨大化爆弾を手札に加えられない（出典: atwiki/page-37 Q5・grnrngr/faq-card-8 RS-582）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、RS-582 との組み合わせを組めない",
  );

  // atwiki/page-37 Q6「はい、できます。…ターンプレイヤーがどちらを先に解決するか決めることができます。」
  it.todo(
    "RS-255: Q&A — ウルフオルフェノクが撃破されて捨札になったとき、巨大化爆弾で重ねて出した後に捨札のファイズをラッシュエリアに出せる（順番はターンプレイヤーが決める）（出典: atwiki/page-37 Q6）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、同時誘発の順番を組めない",
  );

  // atwiki/page-37 Q7「はい、その通りです。」（場に留まったのではなく、新たにラッシュされた）
  // 巨大化爆弾はカウンター（敵軍ターン中のみ）なので、使うのは非ターンプレイヤー。ターンプレイヤーはカウンター（疾風流超忍法）を使えない
  // （R-CTR-01・atwiki/page-424 RS-247「これは敵軍ターン中にのみ使用できる」）。新たにラッシュされたユニットへの「ラッシュされたとき」の窓で
  // 応答するのは非ターンプレイヤーで、自軍ユニットにも疾風流超忍法を使える（atwiki/page-424 Q2「はい、使用することができます」）。
  // 旧スペックは疾風流超忍法をターンプレイヤー側に持たせており、出典上使えない（窓が開かない）ため、持ち主（非ターンプレイヤー）に持たせる。
  it("RS-255: Q&A — 巨大化爆弾で出したユニットは「新たにラッシュされた」扱い（ラッシュされたときの窓が開き、疾風流超忍法を使える）（出典: atwiki/page-37 Q7・atwiki/page-424 Q2）", () => {
    let s = destroyedByAttack("RS-257", {
      hand: [inst("RS-255", "bomb"), inst("RS-247", "ctr")],
      command: [released(CMD.DA, "c"), released(CMD.MA, "m")],
      power: powerCards(7),
    });
    s = useCard(s, "player1", "RS-255:bomb");
    expect(zoneOf(s, "player1", "RS-257:kai")).toBe("rush");
    expect(s.pendingRush?.rushedInstanceId).toBe("RS-257:kai");
  });

  // atwiki/page-37 Q8「はい、その通りです。」（S ユニットとしてラッシュエリアに出てから、BP+3000・SP1 の L ユニットになる）
  it.todo(
    "RS-255: Q&A — 先に S ユニットとしてラッシュエリアに出てから BP+3000・「SP1」の L ユニットになる（文頭から順番に処理）（出典: atwiki/page-37 Q8）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、途中の状態（S として出た瞬間）を観測できない",
  );

  // faq-card-6 RS-350 Q「はい、その通りです。」（暗黒の鎧はダメージにして置かれる）
  it.todo(
    "RS-255: 公式Q&A — 暗黒の鎧に重ねていた怪人ユニットが撃破されて捨札になったとき巨大化爆弾を使っても、暗黒の鎧は自軍パワーゾーンにダメージにして置かれる（出典: grnrngr/faq-card-6 RS-350 Q）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、暗黒の鎧の重ね状態も組めない",
  );

  // faq-card-5 RS-325 Q「…自軍コマンドを１つ捨札にしなくてもラッシュエリアに留まります。…捨札にすることはできません。」
  it.todo(
    "RS-255: 公式Q&A — 天空勇者マジシャインの【マジチケット】でコマンドゾーンの巨大化爆弾を使った場合、巨大化爆弾は捨札になるタイミングがないのでラッシュエリアに留まる（出典: grnrngr/faq-card-5 RS-325 Q）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、マジチケット経由の使用を組めない",
  );

  // faq-rider_2 RK-161 Q「はい、「ＳＰ１」になります。」
  it.todo(
    "RS-255: 公式Q&A — 巨大化爆弾を重ねたショッカーライダーがコンビネーションの途中にいても、6番目のショッカーライダーは「SP1」になる（出典: grnrngr/faq-rider_2 RK-161 Q）— 巨大化爆弾を使用する手段がエンジンになく（CARD-RS-255）、重ねた状態を組めない",
  );
});

// ===========================================================================
describe("RS-256 闇の戒律", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自軍スタートフェイズごとに自軍捨札からカードを1枚選び、これにウラ向きに重ねる。そして、自軍バトルフェイズに敵軍ユニットを1体撃破するたび、重ねたカードの上から1枚を手札に加える。自軍エンドフェイズに重ねたカードが3枚あれば、自軍ユニットをすべて撃破し、これを捨札にする。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  /** 闇の戒律（stack 枚を重ねた状態）を player1 の常駐置き場に置く。 */
  function withLaw(s: GameState, stack: string[]): GameState {
    const law = { ...inst("RS-256", "law"), stackedCards: stack.map((id) => ({ ...inst("TST-OP", id), faceDown: true })) } as CardInstance;
    return withPlayer(s, "player1", { operation: [law, ...s.players.player1.operation.filter((c) => c.cardId !== "RS-256")] });
  }
  const stacked = (s: GameState) => (s.players.player1.operation.find((c) => c.cardId === "RS-256")?.stackedCards ?? []).map((c) => c.instanceId);

  it("RS-256: カタログ本文・スペックが出典と一致（出典: atwiki/page-425）", () => {
    expectCatalogText("RS-256", TEXT);
    expectOpStats("RS-256", { name: "闇の戒律", category: "DA", powerCost: 3, keyword: "常駐" });
  });

  it("RS-256: 使用すると常駐置き場に配置される（出典: atwiki/page-425「※常駐」）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RS-256", "law")], command: [released(CMD.DA, "pay")], power: powerCards(3) } });
    s = payAndUse(s, "player1", "RS-256:law");
    expect(zoneOf(s, "player1", "RS-256:law")).toBe("operation");
  });

  it("RS-256: 自軍スタートフェイズに自軍捨札からカードを1枚選び、ウラ向きに重ねる（出典: atwiki/page-425）", () => {
    let s = st({
      phase: "end",
      activePlayer: "player2",
      player1: { operation: [inst("RS-256", "law")], discard: [inst("TST-OP", "x1"), inst("TST-UNIT-0", "x2")], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    s = nextPhase(s);
    for (let i = 0; i < 4 && s.phase === "start"; i += 1) {
      const a = legal(s).find((x) => x.type === "resolve_effect_choice") ?? legal(s).find((x) => x.type === "draw");
      if (!a) break;
      s = act(s, a.type === "resolve_effect_choice" ? { ...a, instanceId: "TST-UNIT-0:x2" } : a);
    }
    expect(stacked(s)).toEqual(["TST-UNIT-0:x2"]);
    expect(zoneOf(s, "player1", "TST-OP:x1")).toBe("discard");
  });

  it("RS-256: 自軍バトルフェイズに敵軍ユニットを撃破すると、重ねたカードの上から1枚を手札に加える（出典: atwiki/page-425）", () => {
    let s = withLaw(st({ player1: { battle: [inst("TST-UNIT-2", "atk")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } }), ["s1", "s2"]);
    s = settle(attack(s, "TST-UNIT-2:atk", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:s2")).toBe("hand");
    expect(stacked(s)).toEqual(["TST-OP:s1"]);
  });

  it("RS-256: 撃破できなければ（バトルに負ければ）手札に加えない（出典: atwiki/page-425「敵軍ユニットを1体撃破するたび」）", () => {
    let s = withLaw(st({ player1: { battle: [inst("TST-UNIT-0", "atk")] }, player2: { battle: [inst("TST-UNIT-2", "e")] } }), ["s1"]);
    s = settle(attack(s, "TST-UNIT-0:atk", "TST-UNIT-2:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e")).toBe("battle");
    expect(stacked(s)).toEqual(["TST-OP:s1"]);
  });

  it("RS-256: 撃破ではなく山札に戻した（マジピンク【ピンクストーム】）ときは手札に加えない（出典: atwiki/page-425「撃破するたび」）", () => {
    let s = withLaw(
      st({ player1: { battle: fillers(3), rush: [inst("RS-060", "pink")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }),
      ["s1"],
    );
    s = enter(s, "RS-060:pink");
    s = pickAll(s, ["TST-UNIT-0:e"], 2);
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("deck");
    expect(stacked(s)).toEqual(["TST-OP:s1"]);
  });

  it("RS-256: 自軍エンドフェイズに重ねたカードが3枚あれば、自軍ユニットをすべて撃破し、これを捨札にする（重ねたカードも捨札）（出典: atwiki/page-425）", () => {
    let s = withLaw(
      st({ player1: { battle: [inst("TST-UNIT-0", "b")], rush: [inst("TST-UNIT-2", "r")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }),
      ["s1", "s2", "s3"],
    );
    s = toPhase(s, "player2", "start");
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-2:r")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-256:law")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:s1")).toBe("discard");
  });

  it("RS-256: 重ねたカードが2枚ならエンドフェイズに何も起きない（出典: atwiki/page-425「3枚あれば」）", () => {
    let s = withLaw(
      st({ player1: { battle: [inst("TST-UNIT-0", "b")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }),
      ["s1", "s2"],
    );
    s = toPhase(s, "player2", "charge");
    expect(zoneOf(s, "player1", "RS-256:law")).toBe("operation");
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).not.toBe("discard");
  });

  it("RS-256: 常駐置き場を離れる（レッドワンでパワーゾーンに送られる）とき、重ねたカードはすべて捨札になる（出典: atwiki/page-425「これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { deck: deckCards(3) },
      player2: { battle: fillers(3, "ef"), rush: [inst("RS-130", "r1")], deck: deckCards(3, "e") },
    });
    s = withLaw(s, ["s1", "s2"]);
    s = enter(s, "RS-130:r1", "player2");
    s = pickAll(s, ["RS-256:law"], 2);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-256:law")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP:s1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:s2")).toBe("discard");
  });

  // faq-card-5 RS-256 Q1（atwiki Q1）「いいえ、できません。…自軍バトルフェイズ中に敵軍ユニットを撃破した場合のみです。」
  it("RS-256: 公式Q&A — 自軍ラッシュフェイズに守護獣ティラノザウルスの【ティラノソニック】で敵軍ユニットを撃破しても、重ねたカードを手札に加えない（出典: grnrngr/faq-card-5 RS-256 Q1・atwiki/page-425 Q1）", () => {
    let s = withLaw(
      st({
        phase: "rush",
        player1: { hand: [inst("RS-035", "tyra")], rush: [inst("TST-UNIT-0", "own")], command: [released(CMD.WB, "c")], power: powerCards(6), deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
      }),
      ["s1"],
    );
    s = payAndUse(s, "player1", "RS-035:tyra");
    s = pickAll(s, ["TST-UNIT-0:own", "TST-UNIT-0:e"], 4);
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(stacked(s)).toEqual(["TST-OP:s1"]);
  });

  // faq-card-5 RS-256 Q2（atwiki Q2）「はい、できます。」
  it("RS-256: 公式Q&A — 3枚重ねてエンドフェイズに自軍ユニットをすべて撃破するとき、爆竜トリケラトプスの【超シールド進化】で WB の自軍ユニットを場に留められる（出典: grnrngr/faq-card-5 RS-256 Q2・atwiki/page-425 Q2）", () => {
    let s = withLaw(
      st({ player1: { battle: [inst("TST-UNIT-0", "wb")], rush: [inst("RS-052", "tri")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }),
      ["s1", "s2", "s3"],
    );
    s = nextPhase(s);
    s = pickAll(s, ["RS-052:tri"], 4);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-052:tri")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:wb")).not.toBe("discard");
    expect(zoneOf(s, "player1", "RS-256:law")).toBe("discard");
  });

  // faq-card-5 RS-256 Q3（atwiki Q3）「いいえ、できません。…「敵軍ターン中」のみです。」
  it("RS-256: 公式Q&A — 3枚重ねてエンドフェイズに自軍ユニットをすべて撃破するとき、マジマザーの【ジルマ・マジュナ】は使えずマジマザーも撃破される（出典: grnrngr/faq-card-5 RS-256 Q3・atwiki/page-425 Q3）", () => {
    let s = withLaw(
      st({ player1: { battle: [inst("TST-UNIT-0", "b")], rush: [inst("RS-324", "mother")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }),
      ["s1", "s2", "s3"],
    );
    s = nextPhase(s);
    expect(legal(s).some((a) => JSON.stringify(a).includes("RS-324:mother") && a.type !== "end_phase")).toBe(false);
    s = toPhase(settle(s), "player2", "start");
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-324:mother")).toBe("discard");
  });

  // faq-card-5 RS-256 Q4（atwiki Q4）「はい、その通りです。」
  it("RS-256: 公式Q&A — タイムイエロー【グラップファイター】で敵軍ユニット同士をバトルさせて撃破しても、重ねたカードを手札に加えられる（出典: grnrngr/faq-card-5 RS-256 Q4・atwiki/page-425 Q4）", () => {
    let s = withLaw(
      st({
        player1: { battle: fillers(2), rush: [inst("RS-221", "y")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")], power: powerCards(2, "e"), deck: deckCards(3, "e") },
      }),
      ["stk"],
    );
    s = enter(s, "RS-221:y");
    if (s.pendingEffectChoice?.effectId === "battle_command" || legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = pickAll(s, ["TST-UNIT-0:eb", "TST-UNIT-2:er"], 3);
    s = settle(drain(s, "player1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:stk")).toBe("hand");
  });

  // faq-card-5 RS-256 Q5（atwiki Q5）「はい、ドローした後でもかまいません。」
  it("RS-256: 公式Q&A — スタートフェイズに捨札から選ぶのはドローした後でもよい（ドローしたあとに選べる）（出典: grnrngr/faq-card-5 RS-256 Q5・atwiki/page-425 Q5）", () => {
    let s = st({
      phase: "end",
      activePlayer: "player2",
      player1: { operation: [inst("RS-256", "law")], discard: [inst("TST-OP", "x1")], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    s = nextPhase(s);
    const draw = legal(s).find((a) => a.type === "draw");
    if (draw) s = act(s, draw);
    s = pickAll(s, ["TST-OP:x1"], 2);
    expect(stacked(s)).toEqual(["TST-OP:x1"]);
  });

  // faq-card-5 RS-256 Q6（atwiki Q6）「はい、見せなければなりません。」
  it.todo(
    "RS-256: 公式Q&A — 捨札から選んだカードは相手に見せる（出典: grnrngr/faq-card-5 RS-256 Q6・atwiki/page-425 Q6）— 相手への公開は実物のゲームでの手続きで、公開 API の状態として表す項目がない（重ねる処理自体も未実装 CARD-RS-256）",
  );

  // faq-card-5 RS-256 Q7（atwiki Q7）「はい、自分も相手も見ることはできません。」
  it("RS-256: 公式Q&A — 重ねたカードはウラ向き（自分も相手も見られない）（出典: grnrngr/faq-card-5 RS-256 Q7・atwiki/page-425 Q7）", () => {
    // 撃破で1枚手札に加えたあとも、残りはウラ向きのまま重なっている
    let s = withLaw(st({ player1: { battle: [inst("TST-UNIT-2", "atk")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } }), ["s1", "s2"]);
    s = settle(attack(s, "TST-UNIT-2:atk", "TST-UNIT-0:e"));
    const rest = s.players.player1.operation.find((c) => c.cardId === "RS-256")?.stackedCards ?? [];
    expect(rest.map((c) => c.faceDown)).toEqual([true]);
  });
});

void tryPayAndUse;
void fillers;
