/**
 * カード別スペック: RS-411〜RS-418（第6弾「紅き六戦士の帰還」冥府神ダゴン〜冥府神イフリート）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html。RS-416〜RS-418 の Q と RS-409 の Q）、
 *     grnrngr/faq-card-8（RS-533 の Q に RS-416 が登場）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。Q&A 欄なし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  nextPhase,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  zoneOf,
} from "./RS6-411-431.helpers";
import type { CardInstance, GameState } from "../types/game";

const DA_RESIDENT = "RS-256"; // 闇の戒律（DA・※常駐）
const DA_RESIDENT2 = "RS-187"; // ゴーマ宮（DA・※常駐）
const WB_RESIDENT = "RS-179"; // 恐竜やのカレー（WB・※常駐）
const DA_NON_RESIDENT = "RS-072"; // 無限連鎖カード（DA・常駐でない）

/** 「自軍コマンドを1つ捨札にする」追加条件の L ユニットを手札からラッシュする（素材は指定のコマンド）。 */
function rushDiscardingCommand(s: GameState, id: string, material: string) {
  return rushVia(s, "player1", id, (a) => (a.zordMaterialInstanceIds as string[] | undefined)?.includes(material) ?? false);
}

/** 「自軍コマンドを1つ捨札にする」の共通テスト。 */
function discardCommandConditionTests(id: string, cost: number, page: string) {
  it(`${id}: 追加条件 — 自軍コマンドを1つ捨札にしてラッシュでき、そのコマンドは捨札になる（出典: atwiki/${page}「追加条件：自軍コマンドを1つ捨札にする」）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "me")], command: releasedCat("DA", 2), power: powerCards(cost), deck: deckCards(5) } });
    const r = rushDiscardingCommand(s, `${id}:me`, "TST-OP-DA:cDA0");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:me`)).toBe("rush");
    expect(zoneOf(t, "player1", "TST-OP-DA:cDA0")).toBe("discard");
    expect(zoneOf(t, "player1", "TST-OP-DA:cDA1")).toBe("command");
  });

  it(`${id}: 追加条件 — ラッシュのためにホールドしたコマンドを捨札にして満たせる（コマンド1つでもラッシュできる）（出典: grnrngr/faq-card-6 RS-409 Q「ラッシュするためにホールドしたコマンドを捨札にすることで、その追加条件を満たすことはできますか？」→「はい、できます」）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "me")], command: releasedCat("DA", 1), power: powerCards(cost), deck: deckCards(5) } });
    expect(canStartRush(s, "player1", `${id}:me`)).toBe(true);
    const r = rushDiscardingCommand(s, `${id}:me`, "TST-OP-DA:cDA0");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:me`)).toBe("rush");
    expect(zoneOf(t, "player1", "TST-OP-DA:cDA0")).toBe("discard");
  });

  it(`${id}: 追加条件 — 自軍コマンドがなければラッシュできない（出典: atwiki/${page}）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "me")], command: [], power: powerCards(cost + 2), deck: deckCards(5) } });
    expect(canStartRush(s, "player1", `${id}:me`)).toBe(false);
  });
}

// ===========================================================================
describe("RS-411 冥府神ダゴン", () => {
  const TEXT =
    "【今は俺が戒律だ】これをラッシュしたとき、自軍山札からDAの常駐オペレーションのカードを1枚選び、自軍常駐置き場に配置してもよい。（すでに配置されている自軍常駐オペレーションは捨札にしてから配置する）その後、山札をシャッフルする。";

  it("RS-411: カタログ本文・スペックが出典と一致（出典: atwiki/page-608）", () => {
    expectCatalogText("RS-411", TEXT);
    expectStats("RS-411", {
      name: "冥府神ダゴン",
      category: "DA",
      size: "L",
      bp: 6000,
      sp: undefined,
      powerCost: "5+",
      features: ["冥府神", "三賢神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-411", 5, "page-608");

  const rushDagon = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-411", "dg")],
        command: releasedCat("DA", 2),
        power: powerCards(5),
        deck: [inst("TST-OP", "a"), inst(DA_RESIDENT, "res"), inst(WB_RESIDENT, "wbres"), inst(DA_NON_RESIDENT, "daop"), inst(DA_RESIDENT2, "res2")],
        ...p1,
      },
    });
    const r = rushDiscardingCommand(s, "RS-411:dg", "TST-OP-DA:cDA0");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-411: 【今は俺が戒律だ】選べるのは自軍山札の「DA の常駐オペレーション」だけ（WB の常駐・DA の非常駐は選べない）（出典: atwiki/page-608「自軍山札からDAの常駐オペレーションのカードを1枚選び」）", () => {
    const s = rushDagon();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-411");
    expect(choiceIds(s)).toEqual([`${DA_RESIDENT2}:res2`, `${DA_RESIDENT}:res`].sort());
  });

  // 既知の不具合: CARD-RS-411 選んだ常駐オペレーションが自軍常駐置き場ではなくラッシュエリアに置かれる
  it.fails("RS-411: 【今は俺が戒律だ】選んだ DA の常駐オペレーションは自軍常駐置き場に配置される（出典: atwiki/page-608「自軍常駐置き場に配置してもよい」）", () => {
    const t = resolveAll(pick(rushDagon(), `${DA_RESIDENT}:res`));
    expect(zoneOf(t, "player1", `${DA_RESIDENT}:res`)).toBe("operation");
    expect(t.players.player1.rush.map((c) => c.instanceId)).toEqual(["RS-411:dg"]);
  });

  // 既知の不具合: CARD-RS-411 すでに配置されている自軍常駐オペレーションが捨札にならない
  it.fails("RS-411: 【今は俺が戒律だ】すでに配置されている自軍常駐オペレーションは捨札にしてから配置する（出典: atwiki/page-608「（すでに配置されている自軍常駐オペレーションは捨札にしてから配置する）」）", () => {
    const t = resolveAll(pick(rushDagon({ operation: [inst(WB_RESIDENT, "old")] }), `${DA_RESIDENT}:res`));
    expect(zoneOf(t, "player1", `${WB_RESIDENT}:old`)).toBe("discard");
    expect(t.players.player1.operation.map((c) => c.instanceId)).toEqual([`${DA_RESIDENT}:res`]);
  });

  it("RS-411: 【今は俺が戒律だ】「配置してもよい」— 見送ることができ、山札は減らない（出典: atwiki/page-608「配置してもよい」）", () => {
    const s = rushDagon();
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player1.deck).toHaveLength(5);
    expect(t.players.player1.operation).toHaveLength(0);
    expect(zoneOf(t, "player1", "RS-411:dg")).toBe("rush");
  });

  it("RS-411: 【今は俺が戒律だ】その後、山札をシャッフルする — 選んだ1枚以外の山札のカードはすべて山札に残る（出典: atwiki/page-608「その後、山札をシャッフルする」）", () => {
    const t = resolveAll(pick(rushDagon(), `${DA_RESIDENT}:res`));
    expect(t.players.player1.deck.map((c) => c.instanceId).sort()).toEqual(
      ["TST-OP:a", `${WB_RESIDENT}:wbres`, `${DA_NON_RESIDENT}:daop`, `${DA_RESIDENT2}:res2`].sort(),
    );
  });

  it("RS-411: 【今は俺が戒律だ】山札に DA の常駐オペレーションがなければ何も選ばない（出典: atwiki/page-608）", () => {
    const s = rushDagon({ deck: [inst("TST-OP", "a"), inst(WB_RESIDENT, "wbres")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "RS-411:dg")).toBe("rush");
  });

  it("RS-411: 【今は俺が戒律だ】「ラッシュしたとき」— ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-608「これをラッシュしたとき」）", () => {
    const s = st({ player1: { rush: [inst("RS-411", "dg")], deck: [inst(DA_RESIDENT, "res")] } });
    const t = enter(s, "RS-411:dg");
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(t, "player1", `${DA_RESIDENT}:res`)).toBe("deck");
  });
});

// ===========================================================================
describe("RS-412 冥府神スフィンクス", () => {
  const TEXT =
    "【質問には回答を】自軍ターン中、これがバトルエリアに出たとき次の効果を発動できる⇒敵軍パワーのダメージのカードを1枚選び、そのカードの必要パワーの数字を相手に解答させてからオモテにする。相手の解答が不正解なら相手は自分自身のユニットを1体選び撃破する。その後、オモテにしたカードはウラ向きに戻す。";

  it("RS-412: カタログ本文・スペックが出典と一致（出典: atwiki/page-599）", () => {
    expectCatalogText("RS-412", TEXT);
    expectStats("RS-412", {
      name: "冥府神スフィンクス",
      category: "DA",
      size: "L",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      features: ["冥府神", "三賢神", "女", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-412", 4, "page-599");

  /** 敵軍パワーにダメージの「冥府神ダゴン」（必要パワー5+）を1枚。 */
  const sphinx = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({
      player1: { rush: [inst("RS-412", "sx")], deck: deckCards(3) },
      player2: {
        power: [{ ...inst("RS-411", "d1"), faceDown: true }, inst("TST-P", "up")],
        damage: 1,
        battle: [inst("TST-UNIT-0", "e1")],
        rush: [inst("TST-UNIT-2", "e2")],
        deck: deckCards(3, "e"),
        ...p2,
      },
    });

  /** 出して、ダメージのカードを選び、相手が number と解答するところまで進める。 */
  const answer = (number: number, p2: Partial<GameState["players"]["player2"]> = {}) => {
    let s = enter(sphinx(p2), "RS-412:sx");
    expect(choiceIds(s)).toEqual(["RS-411:d1"]);
    s = pick(s, "RS-411:d1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    return act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: String(number) });
  };

  it("RS-412: 【質問には回答を】選べるのは敵軍パワーのダメージ（ウラ向き）のカードだけ（出典: atwiki/page-599「敵軍パワーのダメージのカードを1枚選び」）", () => {
    const s = enter(sphinx(), "RS-412:sx");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-412");
    expect(choiceIds(s)).toEqual(["RS-411:d1"]);
  });

  it("RS-412: 【質問には回答を】相手の解答が正解なら撃破はなく、オモテにしたカードはウラ向きに戻る（出典: atwiki/page-599「その後、オモテにしたカードはウラ向きに戻す」）", () => {
    const t = resolveAll(answer(5));
    expect(zoneOf(t, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(t, "player2", "TST-UNIT-2:e2")).toBe("rush");
    expect(t.players.player2.power.find((c) => c.instanceId === "RS-411:d1")?.faceDown).toBe(true);
  });

  it("RS-412: 【質問には回答を】不正解なら相手は自分自身のユニットを1体選び撃破する（撃破を見送れない）。その後カードはウラ向きに戻る（出典: atwiki/page-599「相手の解答が不正解なら相手は自分自身のユニットを1体選び撃破する」）", () => {
    let s = answer(3);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-2:e2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-2:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(s.players.player2.power.find((c) => c.instanceId === "RS-411:d1")?.faceDown).toBe(true);
  });

  it("RS-412: 【質問には回答を】不正解で選んだユニットは「撃破」される（スーパーゲキイエローの「撃破されて捨札になったとき」が誘発する）（出典: atwiki/page-599「撃破する」・atwiki/page-510）", () => {
    let s = answer(0, { battle: [inst("RS-427", "sy")], rush: [], discard: [inst("RS-342", "gy")] });
    s = resolveAll(pick(s, "RS-427:sy"), ["RS-342:gy"]);
    expect(zoneOf(s, "player2", "RS-427:sy")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-342:gy")).toBe("rush");
  });

  it("RS-412: 【質問には回答を】「発動できる」— 発動しないことを選べる（出典: atwiki/page-599「次の効果を発動できる」）", () => {
    const s = enter(sphinx(), "RS-412:sx");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player2.power.find((c) => c.instanceId === "RS-411:d1")?.faceDown).toBe(true);
    expect(zoneOf(t, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-412: 【質問には回答を】敵軍にダメージのカードがなければ何も起きない（出典: atwiki/page-599）", () => {
    const s = enter(sphinx({ power: [inst("TST-P", "up")], damage: 0 }), "RS-412:sx");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-412: 【質問には回答を】「自軍ターン中」— 敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-599「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-412", "sx")], deck: deckCards(3) },
      player2: { power: [{ ...inst("RS-411", "d1"), faceDown: true }], damage: 1, battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });
    const t = enterBattleByEffect(s, "player1", "RS-412:sx");
    expect(t.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-413 冥府神ゴーゴン", () => {
  const TEXT =
    "【もの言わぬ石と化せ】これが自軍バトルエリアにある間、相手は次の制限を受ける⇒自分自身のコマンドゾーンにあるSユニットのカードは、リリースできない。ただし、自分自身のターンを終えるとき、自分自身のコマンドを1つ選び捨札にしてもよい。";

  it("RS-413: カタログ本文・スペックが出典と一致（出典: atwiki/page-609）", () => {
    expectCatalogText("RS-413", TEXT);
    expectStats("RS-413", {
      name: "冥府神ゴーゴン",
      category: "DA",
      size: "L",
      bp: 5000,
      sp: undefined,
      powerCost: "3+",
      features: ["冥府神", "三賢神", "女", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-413", 3, "page-609");

  /** 相手（player2）のスタートフェイズ。player2 のコマンド: ホールド状態の S ユニットカードとオペレーション。 */
  const enemyStart = (gorgonZone: "battle" | "rush") =>
    st({
      activePlayer: "player2",
      phase: "start",
      player1: { [gorgonZone]: [inst("RS-413", "gg")], deck: deckCards(3) },
      player2: {
        command: [{ ...inst("TST-UNIT-0", "cs"), commandHeld: true }, { ...inst("TST-OP", "co"), commandHeld: true }],
        deck: deckCards(5, "e"),
      },
    });
  const release = (s: GameState) => act(s, { type: "release_start_commands", playerId: "player2" });
  const heldOf = (s: GameState, id: string) => s.players.player2.command.find((c) => c.instanceId === id)?.commandHeld;

  it("RS-413: 【もの言わぬ石と化せ】自軍バトルエリアにある間、相手のコマンドゾーンにある S ユニットのカードはスタートフェイズにリリースされない（オペレーションはリリースされる）（出典: atwiki/page-609「自分自身のコマンドゾーンにあるSユニットのカードは、リリースできない」）", () => {
    const t = release(enemyStart("battle"));
    expect(heldOf(t, "TST-UNIT-0:cs")).toBe(true);
    expect(heldOf(t, "TST-OP:co")).toBe(false);
  });

  it("RS-413: 【もの言わぬ石と化せ】ラッシュエリアにあるときは制限しない（S ユニットのカードもリリースされる）（出典: atwiki/page-609「これが自軍バトルエリアにある間」）", () => {
    const t = release(enemyStart("rush"));
    expect(heldOf(t, "TST-UNIT-0:cs")).toBe(false);
    expect(heldOf(t, "TST-OP:co")).toBe(false);
  });

  it("RS-413: 【もの言わぬ石と化せ】ただし相手は自分自身のターンを終えるとき、自分自身のコマンドを1つ選び捨札にしてもよい（任意）（出典: atwiki/page-609「自分自身のターンを終えるとき、自分自身のコマンドを1つ選び捨札にしてもよい」）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "battle",
      player1: { battle: [inst("RS-413", "gg")], deck: deckCards(3) },
      player2: { command: [{ ...inst("TST-UNIT-0", "cs"), commandHeld: true }], deck: deckCards(5, "e") },
    });
    s = act(s, { type: "end_phase", playerId: "player2" });
    for (let i = 0; i < 4 && !s.pendingEffectChoice && s.activePlayer === "player2"; i++) {
      const end = legal(s).find((a) => a.type === "end_phase");
      if (!end) break;
      s = act(s, end);
    }
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:cs"]);
    expect(canSkip(s)).toBe(true);
    s = pick(s, "TST-UNIT-0:cs");
    expect(zoneOf(s, "player2", "TST-UNIT-0:cs")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-414 冥府神ティターン", () => {
  const TEXT =
    "※特徴「ピンク」を持つ敵軍ユニットがあるとき、これはバトルエリアに出られない。【ディオネを守る壁】これが自軍バトルエリアにある間、特徴「冥府神」を持つ自軍ユニットがアタックされたとき、自軍常駐置き場からカードを1枚選び、捨札にしてもよい。そうしたとき、バトルは行われない。";

  it("RS-414: カタログ本文・スペックが出典と一致（出典: atwiki/page-611）", () => {
    expectCatalogText("RS-414", TEXT);
    expectStats("RS-414", {
      name: "冥府神ティターン",
      category: "DA",
      size: "L",
      bp: 5000,
      sp: undefined,
      powerCost: "3+",
      features: ["冥府神", "五武神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-414", 3, "page-611");

  it("RS-414: ※ 特徴「ピンク」を持つ敵軍ユニット（ラッシュエリアでも）があるとバトルエリアに出られない（出典: atwiki/page-611「特徴「ピンク」を持つ敵軍ユニットがあるとき、これはバトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-414", "ti")] }, player2: { rush: [inst("RS-060", "pink")] } });
    expect(canEnter(s, "RS-414:ti")).toBe(false);
  });

  it("RS-414: ※ ピンクの敵軍ユニットがなければ出られる。自軍のピンクのユニットは関係ない（出典: atwiki/page-611「敵軍ユニット」）", () => {
    const s = st({ player1: { rush: [inst("RS-414", "ti"), inst("RS-060", "mypink")] }, player2: { rush: [inst("TST-UNIT-0", "e")] } });
    expect(canEnter(s, "RS-414:ti")).toBe(true);
  });

  /** 敵軍ターン、player2 の TST-UNIT-7（BP13000）が player1 の target にアタックする（反応・選択は解決しない）。 */
  const attacked = (p1: Partial<GameState["players"]["player1"]>, target: string) =>
    attack(
      st({ activePlayer: "player2", player1: { deck: deckCards(3), ...p1 }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } }),
      "TST-UNIT-7:atk",
      target,
      "player2",
    );

  it("RS-414: 【ディオネを守る壁】冥府神（これ自身）がアタックされたとき、自軍常駐置き場のカードを捨札にすればバトルは行われない（出典: atwiki/page-611「捨札にしてもよい。そうしたとき、バトルは行われない」）", () => {
    let s = attacked({ battle: [inst("RS-414", "ti")], operation: [inst(DA_RESIDENT, "op")] }, "RS-414:ti");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual([`${DA_RESIDENT}:op`]);
    s = resolveAll(pick(s, `${DA_RESIDENT}:op`));
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("discard");
    expect(zoneOf(s, "player1", "RS-414:ti")).toBe("battle");
  });

  it("RS-414: 【ディオネを守る壁】他の冥府神（スフィンクス）がアタックされたときも発動できる（出典: atwiki/page-611「特徴「冥府神」を持つ自軍ユニットがアタックされたとき」）", () => {
    let s = attacked({ battle: [inst("RS-414", "ti"), inst("RS-412", "sx")], operation: [inst(DA_RESIDENT, "op")] }, "RS-412:sx");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = resolveAll(pick(s, `${DA_RESIDENT}:op`));
    expect(zoneOf(s, "player1", "RS-412:sx")).toBe("battle");
  });

  it("RS-414: 【ディオネを守る壁】捨札にしないことを選べる（任意）— そのときは通常どおりバトルし、撃破される（出典: atwiki/page-611「捨札にしてもよい」）", () => {
    let s = attacked({ battle: [inst("RS-414", "ti")], operation: [inst(DA_RESIDENT, "op")] }, "RS-414:ti");
    if (s.pendingEffectChoice?.sourceCardId === "RS-414") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RS-414:ti")).toBe("discard");
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("operation");
  });

  it("RS-414: 【ディオネを守る壁】冥府神でない自軍ユニットがアタックされても発動しない（出典: atwiki/page-611「特徴「冥府神」を持つ自軍ユニット」）", () => {
    let s = attacked({ battle: [inst("RS-414", "ti"), inst("TST-UNIT-0", "mine")], operation: [inst(DA_RESIDENT, "op")] }, "TST-UNIT-0:mine");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-414");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:mine")).toBe("discard");
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("operation");
  });

  it("RS-414: 【ディオネを守る壁】自軍常駐置き場にカードがなければ発動できず、バトルが行われる（出典: atwiki/page-611「自軍常駐置き場からカードを1枚選び」）", () => {
    const s = resolveAll(attacked({ battle: [inst("RS-414", "ti")] }, "RS-414:ti"));
    expect(zoneOf(s, "player1", "RS-414:ti")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-415 冥府神ワイバーン", () => {
  const TEXT = "※これはラッシュしたターンにバトルエリアに出られない。【飛竜剣法・散弾月】自軍ダメージが5点以上なら、これはBP+4000され「SP1」になる。";

  it("RS-415: カタログ本文・スペックが出典と一致（SP「！」）（出典: atwiki/page-612）", () => {
    expectCatalogText("RS-415", TEXT);
    expectStats("RS-415", {
      name: "冥府神ワイバーン",
      category: "DA",
      size: "L",
      bp: 4000,
      sp: "special",
      powerCost: "4+",
      features: ["冥府神", "五武神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-415", 4, "page-612");

  it("RS-415: ※ ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-612「これはラッシュしたターンにバトルエリアに出られない」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-415", "wy")], command: releasedCat("DA", 2), power: powerCards(4), deck: deckCards(3) } });
    const r = rushDiscardingCommand(s, "RS-415:wy", "TST-OP-DA:cDA0");
    expect(r.ok).toBe(true);
    const t = nextPhase(resolveAll(r.state));
    expect(t.phase).toBe("battle");
    expect(zoneOf(t, "player1", "RS-415:wy")).toBe("rush");
    expect(canEnter(t, "RS-415:wy")).toBe(false);
  });

  it("RS-415: ※ ラッシュしたターンでなければ出られる（出典: atwiki/page-612）", () => {
    const s = st({ player1: { rush: [inst("RS-415", "wy")] } });
    expect(canEnter(s, "RS-415:wy")).toBe(true);
  });

  const wyvern = (damage: number) =>
    st({ player1: { battle: [inst("RS-415", "wy")], power: damageCards(damage), damage, deck: deckCards(3) } });

  it("RS-415: 【飛竜剣法・散弾月】自軍ダメージが5点以上なら BP+4000（8000）され「SP1」になる（出典: atwiki/page-612「自軍ダメージが5点以上なら、これはBP+4000され「SP1」になる」）", () => {
    const s = wyvern(5);
    expect(bpOf(s, "player1", "RS-415:wy")).toBe(8000);
    expect(spOf(s, "player1", "RS-415:wy")).toBe(1);
  });

  it("RS-415: 【飛竜剣法・散弾月】自軍ダメージが4点なら BP4000 のままで SP はない（SP「！」）（出典: atwiki/page-612「5点以上なら」）", () => {
    const s = wyvern(4);
    expect(bpOf(s, "player1", "RS-415:wy")).toBe(4000);
    expect(spOf(s, "player1", "RS-415:wy")).toBe(0);
  });

  it("RS-415: 【飛竜剣法・散弾月】参照するのは自軍ダメージ（敵軍ダメージが5点以上でも変わらない）（出典: atwiki/page-612「自軍ダメージ」）", () => {
    const s = st({ player1: { battle: [inst("RS-415", "wy")], deck: deckCards(3) }, player2: { power: damageCards(6, "ed"), damage: 6 } });
    expect(bpOf(s, "player1", "RS-415:wy")).toBe(4000);
    expect(spOf(s, "player1", "RS-415:wy")).toBe(0);
  });
});

// ===========================================================================
describe("RS-416 冥府神トード", () => {
  const TEXT =
    "※これは自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない。【魂のコレクション】自軍ターン中、これがバトルエリアに出たとき、敵軍パワーゾーンにダメージになっているカードがあれば1枚選び捨札にしてもよい。そうしたとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RS-416: カタログ本文・スペックが出典と一致（出典: atwiki/page-610）", () => {
    expectCatalogText("RS-416", TEXT);
    expectStats("RS-416", {
      name: "冥府神トード",
      category: "DA",
      size: "L",
      bp: 5000,
      sp: undefined,
      powerCost: "2+",
      features: ["冥府神", "五武神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-416", 2, "page-610");

  it("RS-416: ※ 自軍ラッシュエリアに他の S ユニットがなければバトルエリアに出られない（出典: atwiki/page-610「自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-416", "td"), inst("TST-UNIT-2", "m")] } });
    expect(canEnter(s, "RS-416:td")).toBe(false);
  });

  it("RS-416: ※ 出るとき自軍ラッシュエリアの S ユニットを1体捨札にする（選択は見送れない）（出典: atwiki/page-610）", () => {
    let s = st({ player1: { rush: [inst("RS-416", "td"), inst("TST-UNIT-0", "r1"), inst("TST-UNIT-2", "m")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-416:td")).toBe(true);
    s = enter(s, "RS-416:td");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:r1"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "TST-UNIT-0:r1");
    if (zoneOf(s, "player1", "RS-416:td") === "rush") s = enter(s, "RS-416:td");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RS-416:td")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:r1")).toBe("discard");
  });

  /** 自軍ターン: トードを出し、ラッシュ S（r1）を捨札にしたところ。 */
  const toad = (p2: Partial<GameState["players"]["player2"]>, activePlayer: "player1" | "player2" = "player1") => {
    let s = st({
      activePlayer,
      player1: { rush: [inst("RS-416", "td"), inst("TST-UNIT-0", "r1")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
    if (activePlayer === "player2") return enterBattleByEffect(s, "player1", "RS-416:td");
    s = enter(s, "RS-416:td");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:r1")) s = pick(s, "TST-UNIT-0:r1");
    // 捨札にする手順のあと、改めてバトルエリアに出す。
    if (zoneOf(s, "player1", "RS-416:td") === "rush") s = enter(s, "RS-416:td");
    expect(zoneOf(s, "player1", "RS-416:td")).toBe("battle");
    return s;
  };
  const enemyDamage = (): Partial<GameState["players"]["player2"]> => ({ power: [{ ...inst("TST-P", "ed"), faceDown: true }, inst("TST-P", "eu")], damage: 1 });

  // 既知の不具合: CARD-RS-416 【魂のコレクション】が「敵軍のダメージのカードを1枚捨札にする」手順を経ずに直接 S ユニット選択になり、ダメージのカードが捨札にならない
  it.fails("RS-416: 【魂のコレクション】敵軍のダメージのカードを1枚捨札にし、敵軍 S ユニットを1体持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-610「敵軍パワーゾーンにダメージになっているカードがあれば1枚選び捨札にしてもよい。そうしたとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = toad({ ...enemyDamage(), battle: [inst("TST-UNIT-0", "es")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-416");
    expect(choiceIds(s)).toEqual(["TST-P:ed"]);
    s = pick(s, "TST-P:ed");
    s = resolveAll(s, ["TST-UNIT-0:es"]);
    expect(zoneOf(s, "player2", "TST-P:ed")).toBe("discard");
    const placed = s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:es");
    expect(placed?.faceDown).toBe(true);
  });

  // 既知の不具合: CARD-RS-416 【魂のコレクション】で敵軍ラッシュエリアの S ユニットを選べない（バトルエリアだけに限定されている）
  it.fails("RS-416: 【魂のコレクション】敵軍ラッシュエリアの S ユニットも選べる（L ユニットは選べない）（出典: atwiki/page-610「敵軍Sユニットを1体選び」）", () => {
    let s = toad({ ...enemyDamage(), rush: [inst("TST-UNIT-0", "er"), inst("TST-UNIT-7", "el")] });
    for (let i = 0; i < 3 && s.pendingEffectChoice && !s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-0:er"); i++) {
      s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:er"]);
    s = resolveAll(pick(s, "TST-UNIT-0:er"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:er")?.faceDown).toBe(true);
  });

  // 既知の不具合: CARD-RS-416 【魂のコレクション】が敵軍にダメージがなくても発動する（「ダメージになっているカードがあれば」の条件が落ちている）
  it.fails("RS-416: 【魂のコレクション】敵軍パワーゾーンにダメージがなければ発動しない（出典: atwiki/page-610「ダメージになっているカードがあれば」）", () => {
    const s = toad({ power: [inst("TST-P", "eu")], damage: 0, battle: [inst("TST-UNIT-0", "es")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:es")).toBe("battle");
  });

  it("RS-416: 【魂のコレクション】「捨札にしてもよい」— 見送れば何も起きない（出典: atwiki/page-610「捨札にしてもよい」）", () => {
    let s = toad({ ...enemyDamage(), battle: [inst("TST-UNIT-0", "es")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-416");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-P:ed")).toBe("power");
  });

  it("RS-416: 【魂のコレクション】「自軍ターン中」— 敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-610「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = toad({ ...enemyDamage(), battle: [inst("TST-UNIT-0", "es")] }, "player2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-416");
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:es")).toBe("battle");
  });

  it("RS-416: 【魂のコレクション】パワーゾーンに置いても「撃破」ではない（スーパーゲキイエローの「撃破されて捨札になったとき」は誘発しない）（出典: grnrngr/faq-card-6 RS-416 Q「「撃破」したものとして扱われますか？」→「いいえ」）", () => {
    let s = toad({ ...enemyDamage(), battle: [inst("RS-427", "sy")], discard: [inst("RS-342", "gy")] });
    s = resolveAll(s, ["TST-P:ed", "RS-427:sy"]);
    expect(zoneOf(s, "player2", "RS-427:sy")).toBe("power");
    expect(zoneOf(s, "player2", "RS-342:gy")).toBe("discard");
  });

  it.todo(
    "RS-416: 【フェニックスファイヤー】を発動したターンに【魂のコレクション】で敵軍 S ユニットをダメージにして置けばドローできる（出典: grnrngr/faq-card-8 RS-533 Q「…ドローすることは可能ですか？」→「はい、可能です」）— RS-533 側の効果の検証で、RS-416 の【魂のコレクション】自体がダメージのカードを捨札にする手順を欠いており（上記 it.fails）、組み合わせを正しく再現できないため",
  );
});

// ===========================================================================
describe("RS-417 冥府神サイクロプス", () => {
  const TEXT =
    "【消滅の緋色】これが自軍ラッシュエリアにある間、敵軍Sユニットがバトルエリアからラッシュエリアに戻るたび、自軍常駐置き場からカードを1枚選び捨札にしてもよい。そうしたとき、そのユニットを撃破する。";

  it("RS-417: カタログ本文・スペックが出典と一致（出典: atwiki/page-614）", () => {
    expectCatalogText("RS-417", TEXT);
    expectStats("RS-417", {
      name: "冥府神サイクロプス",
      category: "DA",
      size: "L",
      bp: 2000,
      sp: undefined,
      powerCost: "3+",
      features: ["冥府神", "五武神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-417", 3, "page-614");

  /** 敵軍（player2）スタートフェイズ。バトルエリアのユニットを戻す直前。 */
  const enemyStart = (p1: Partial<GameState["players"]["player1"]>, p2battle: CardInstance[]) =>
    st({
      activePlayer: "player2",
      phase: "start",
      player1: { deck: deckCards(3), ...p1 },
      player2: { battle: p2battle, deck: deckCards(5, "e") },
    });
  const returnAll = (s: GameState) => act(s, { type: "return_all_battle_to_rush", playerId: "player2" });

  // 既知の不具合: CARD-RS-417 【消滅の緋色】がスタートフェイズの「バトルエリアからラッシュエリアに戻る」で誘発しない（紐男爵の効果で戻したときだけ実装）
  it.fails("RS-417: 【消滅の緋色】敵軍スタートフェイズに敵軍 S ユニットが戻るとき、自軍常駐置き場のカードを捨札にしてそのユニットを撃破する（出典: atwiki/page-614「敵軍Sユニットがバトルエリアからラッシュエリアに戻るたび」）", () => {
    let s = returnAll(enemyStart({ rush: [inst("RS-417", "cy")], operation: [inst(DA_RESIDENT, "op")] }, [inst("TST-UNIT-0", "e1")]));
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-417");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, `${DA_RESIDENT}:op`));
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
  });

  it("RS-417: 【消滅の緋色】自軍常駐置き場にカードがなければ発動できない（出典: atwiki/page-614「自軍常駐置き場からカードを1枚選び捨札にしてもよい」）", () => {
    const s = resolveAll(returnAll(enemyStart({ rush: [inst("RS-417", "cy")] }, [inst("TST-UNIT-0", "e1")])));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });

  it("RS-417: 【消滅の緋色】L ユニットが戻っても発動しない（出典: atwiki/page-614「敵軍Sユニット」）", () => {
    const s = returnAll(enemyStart({ rush: [inst("RS-417", "cy")], operation: [inst(DA_RESIDENT, "op")] }, [inst("TST-UNIT-7", "el")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-417");
    const t = resolveAll(s);
    expect(zoneOf(t, "player2", "TST-UNIT-7:el")).toBe("rush");
    expect(zoneOf(t, "player1", `${DA_RESIDENT}:op`)).toBe("operation");
  });

  it("RS-417: 【消滅の緋色】これがバトルエリアにあるときは発動しない（出典: atwiki/page-614「これが自軍ラッシュエリアにある間」）", () => {
    const s = returnAll(enemyStart({ battle: [inst("RS-417", "cy")], operation: [inst(DA_RESIDENT, "op")] }, [inst("TST-UNIT-0", "e1")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-417");
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:e1")).toBe("rush");
  });

  /** 紐男爵（RS-141、CN3）を player1 のバトルフェイズに3番目に出して【紐拳】を使う状況。 */
  const himoState = (p1: Partial<GameState["players"]["player1"]>) =>
    st({
      player1: { battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-2", "f2")], rush: [inst("RS-141", "hm")], deck: deckCards(5), ...p1 },
      player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")], deck: deckCards(5, "e") },
    });

  it("RS-417: 【消滅の緋色】紐男爵の【紐拳】で戻した敵軍ユニットを撃破しても、敵軍ラッシュエリアのユニットをバトルエリアに出す後半は行える（出典: grnrngr/faq-card-6 RS-417 Q4「ラッシュエリアの敵軍ユニットをバトルエリアに出すことができますか？」→「はい、できます」）", () => {
    let s = enter(himoState({ rush: [inst("RS-141", "hm"), inst("RS-417", "cy")], operation: [inst(DA_RESIDENT, "op")] }), "RS-141:hm");
    s = resolveAll(s, ["TST-UNIT-2:er", `${DA_RESIDENT}:op`, "TST-UNIT-0:eb"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:er")).toBe("battle");
  });

  it.todo(
    "RS-417: 【消滅の緋色】で撃破したユニットはバトルエリアで撃破したことになる（「戻るたび」なので、まだバトルエリアにある）（出典: grnrngr/faq-card-6 RS-417 Q1「バトルエリアで撃破したことになります」）— どのエリアで撃破されたかを公開 API の状態から観測する手段がないため",
  );

  // 既知の不具合: CARD-RS-417 スタートフェイズの戻しで誘発しないため、2体のサイクロプス・1枚の常駐の組み合わせを検証できない（誘発自体が欠落）
  it.fails("RS-417: サイクロプス2体・常駐1枚・敵軍 S ユニット2体が戻るとき、2体とも撃破することはできない（常駐はサイクロプス1体につき1枚必要）（出典: grnrngr/faq-card-6 RS-417 Q2「いいえ、それはできません」）", () => {
    let s = returnAll(
      enemyStart({ rush: [inst("RS-417", "cy1"), inst("RS-417", "cy2")], operation: [inst(DA_RESIDENT, "op")] }, [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")]),
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-417");
    s = resolveAll(s, [`${DA_RESIDENT}:op`]);
    const destroyed = ["TST-UNIT-0:e1", "TST-UNIT-0:e2"].filter((id) => zoneOf(s, "player2", id) === "discard");
    expect(destroyed).toHaveLength(1);
    expect(s.players.player1.operation).toHaveLength(0);
  });

  // 既知の不具合: CARD-RS-417 スタートフェイズの戻しで誘発しない（敵軍 S ユニットの数だけの誘発もない）
  it.fails("RS-417: サイクロプス1体・常駐3枚で、戻った敵軍 S ユニット3体それぞれに発動して3体とも撃破できる（出典: grnrngr/faq-card-6 RS-417 Q3「はい、できます」）", () => {
    let s = returnAll(
      enemyStart(
        { rush: [inst("RS-417", "cy")], operation: [inst(DA_RESIDENT, "op1"), inst(DA_RESIDENT2, "op2"), inst(WB_RESIDENT, "op3")] },
        [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")],
      ),
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-417");
    s = resolveAll(s);
    for (const id of ["TST-UNIT-0:e1", "TST-UNIT-0:e2", "TST-UNIT-0:e3"]) expect(zoneOf(s, "player2", id)).toBe("discard");
    expect(s.players.player1.operation).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-418 冥府神イフリート", () => {
  const TEXT =
    "【炎の眼光】これが自軍バトルエリアにある間、敵軍ユニットがＮＣの効果を発動させたとき、自軍常駐置き場からカードを1枚選び捨札にしてもよい。そうしたとき、そのNCの効果を無効にする。";

  it("RS-418: カタログ本文・スペックが出典と一致（出典: atwiki/page-613）", () => {
    expectCatalogText("RS-418", TEXT);
    expectStats("RS-418", {
      name: "冥府神イフリート",
      category: "DA",
      size: "L",
      bp: 4000,
      sp: undefined,
      powerCost: "2+",
      features: ["冥府神", "五武神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  discardCommandConditionTests("RS-418", 2, "page-613");

  /** 敵軍（player2）バトルフェイズ: 1番目にユニットがあり、ゲキブルー（RS-341、CN2「SP1」）を2番目に出す。 */
  const enemyNc = (p1: Partial<GameState["players"]["player1"]>) =>
    enter(
      st({
        activePlayer: "player2",
        player1: { deck: deckCards(3), ...p1 },
        player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("RS-341", "gb")], deck: deckCards(3, "e") },
      }),
      "RS-341:gb",
      "player2",
    );

  it("RS-418: 【炎の眼光】敵軍ユニットが NC を発動させたとき、自軍常駐置き場のカードを捨札にしてその NC を無効にできる（ゲキブルーは「SP1」にならない）（出典: atwiki/page-613「そのNCの効果を無効にする」）", () => {
    let s = enemyNc({ battle: [inst("RS-418", "if")], operation: [inst(DA_RESIDENT, "op")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-418");
    s = resolveAll(pick(s, `${DA_RESIDENT}:op`));
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("discard");
    expect(spOf(s, "player2", "RS-341:gb")).toBe(0);
  });

  it("RS-418: 【炎の眼光】自軍常駐置き場にカードがなければ無効にできず、NC は有効（出典: atwiki/page-613）", () => {
    const s = resolveAll(enemyNc({ battle: [inst("RS-418", "if")] }));
    expect(spOf(s, "player2", "RS-341:gb")).toBe(1);
  });

  it("RS-418: 【炎の眼光】これがラッシュエリアにあるときは無効にできない（出典: atwiki/page-613「これが自軍バトルエリアにある間」）", () => {
    const s = enemyNc({ rush: [inst("RS-418", "if")], operation: [inst(DA_RESIDENT, "op")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-418");
    const t = resolveAll(s);
    expect(spOf(t, "player2", "RS-341:gb")).toBe(1);
    expect(zoneOf(t, "player1", `${DA_RESIDENT}:op`)).toBe("operation");
  });

  it("RS-418: 【炎の眼光】「捨札にしてもよい」— 見送れば NC は有効（出典: atwiki/page-613「捨札にしてもよい」）", () => {
    let s = enemyNc({ battle: [inst("RS-418", "if")], operation: [inst(DA_RESIDENT, "op")] });
    if (s.pendingEffectChoice?.sourceCardId === "RS-418") s = skip(s);
    s = resolveAll(s);
    expect(spOf(s, "player2", "RS-341:gb")).toBe(1);
    expect(zoneOf(s, "player1", `${DA_RESIDENT}:op`)).toBe("operation");
  });

  it("RS-418: 【炎の眼光】グリーンサイからコンビネーションしてナンバーに関係なく発動したブラックバイソンの NC も無効にできる（出典: grnrngr/faq-card-6 RS-418 Q「はい、できます。…ＮＣの効果であることに違いありません」）", () => {
    let s = enter(
      st({
        activePlayer: "player2",
        player1: { battle: [inst("RS-418", "if")], operation: [inst(DA_RESIDENT, "op")], rush: [inst("TST-UNIT-0", "minus")], deck: deckCards(3) },
        player2: { battle: [inst("RS-279", "gs")], rush: [inst("RS-278", "bb")], deck: deckCards(3, "e") },
      }),
      "RS-278:bb",
      "player2",
    );
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-418");
    s = resolveAll(pick(s, `${DA_RESIDENT}:op`));
    expect(spOf(s, "player2", "RS-278:bb")).toBe(0);
  });
});
