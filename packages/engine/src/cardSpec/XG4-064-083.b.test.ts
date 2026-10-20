/**
 * cardSpec XG4-071〜XG4-077（ナスカ・ドーパント〜仮面ライダーZX）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  callTests,
  canStartRush,
  canSelfRush,
  canSkip,
  canUseCard,
  choiceIds,
  choicePlayer,
  confirm,
  deckCards,
  destroyedInEnemyBattle,
  endTurn,
  enemyAttack,
  enemyBoard,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  inst,
  morphTests,
  opCard,
  p1Battle,
  pick,
  pickAs,
  pickThrough,
  powerCards,
  rcRideOff,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  selfRush,
  settle,
  st,
  sUnit,
  vehicleCard,
  wingTests,
  zoneOf,
} from "./XG4-064-083.helpers";

const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 1000, sp: undefined, features: ["怪人"] });
const HUMAN = sUnit("SPEC-HUMAN", { category: "DA", bp: 1000, sp: undefined, features: ["男"] });
const E_1CAT = sUnit("SPEC-E-1CAT", { category: "WB", bp: 1000, sp: undefined });
const E_2CAT = sUnit("SPEC-E-2CAT", { category: ["WB", "MA"], bp: 1000, sp: undefined } as never);
const E_3CAT = sUnit("SPEC-E-3CAT", { category: ["WB", "MA", "OT"], bp: 1000, sp: undefined } as never);
const E_ADD = sUnit("SPEC-E-ADD", { category: "WB", bp: 1000, sp: undefined, rushAdditionalCondition: { conditionId: "state_gate", text: "特徴「男」を持つ自軍ユニットがある" } } as never);
const E_M2CAT = sUnit("SPEC-E-M2CAT", { category: ["WB", "MA"], bp: 1000, size: "M", sp: undefined } as never);
const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const OP1 = opCard("SPEC-OP-1", 1, { category: "DA" });
const BIKE = vehicleCard("SPEC-BIKE", { category: "ET" });
const E_13000 = sUnit("SPEC-E-13000", { bp: 13000, sp: undefined });
const EXTRA = [KAIJIN, HUMAN, E_1CAT, E_2CAT, E_3CAT, E_ADD, E_M2CAT, E_S, OP1, BIKE, E_13000];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-071 ナスカ・ドーパント", () => {
  const TEXT =
    "※ウイング ※これが自軍エリアにある間、これ以外の特徴「怪人」を持つ自軍ユニットが撃破されたとき、これを持ち主の手札に戻す。 【君を真っ二つにしたい】自軍ターン中、これがバトルエリアに出たとき、カテゴリを2つ持つか、追加条件を持つSユニットを1体選び撃破してもよい。";

  it("XG4-071: カタログ本文・スペックが出典と一致（出典: atwiki/page-2112）", () => {
    expectCatalogText("XG4-071", TEXT);
    expectUnit("XG4-071", { name: "ナスカ・ドーパント", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["怪人", "男", "ドーパント"] });
    expectRarityIn("XG4-071", ["NR"]);
  });

  wingTests("XG4-071", "atwiki/page-2112");

  it("XG4-071: ※ — これ以外の特徴「怪人」を持つ自軍ユニットが撃破されたとき、これは持ち主の手札に戻る（強制）（出典: atwiki/page-2112「これを持ち主の手札に戻す」・カード評価「怪人が撃破された時に手札に戻るデメリット」）", () => {
    const s = resolveAll(settle(destroyedInEnemyBattle(inst("SPEC-KAIJIN", "k"), { rush: [inst("XG4-071", "nz")] }, {}, EXTRA)));
    expect(zoneOf(s, "player1", "XG4-071:nz")).toBe("hand");
  });

  it("XG4-071: ※ — 「怪人」を持たない自軍ユニットが撃破されても戻らない（出典: atwiki/page-2112「特徴「怪人」を持つ自軍ユニット」）", () => {
    const s = resolveAll(settle(destroyedInEnemyBattle(inst("SPEC-HUMAN", "k"), { rush: [inst("XG4-071", "nz")] }, {}, EXTRA)));
    expect(zoneOf(s, "player1", "XG4-071:nz")).toBe("rush");
  });

  const entered = () =>
    settle(
      enterNow(
        battle(
          { rush: [inst("XG4-071", "nz"), inst("SPEC-E-2CAT", "own2")] },
          { battle: [inst("SPEC-E-1CAT", "c1"), inst("SPEC-E-2CAT", "c2"), inst("SPEC-E-3CAT", "c3")], rush: [inst("SPEC-E-ADD", "ad"), inst("SPEC-E-M2CAT", "m2")], deck: deckCards(3, "e") },
        ),
        "XG4-071:nz",
      ),
    );

  it("XG4-071:【君を真っ二つにしたい】— 自軍ターン中にバトルエリアに出たとき、カテゴリを2つ持つか追加条件を持つ S ユニット（自軍・敵軍、どのエリアでも）を1体選べる（カテゴリ1つ・3つ、M ユニットは選べない。任意）（出典: atwiki/page-2112「カテゴリを2つ持つか、追加条件を持つSユニットを1体選び撃破してもよい」・カード評価「カテゴリを3つ以上にしてしまうと効果が適用できなくなる」「自軍ユニットも対象にとれる」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-071");
    expect(choiceIds(s)).toEqual(["SPEC-E-2CAT:c2", "SPEC-E-2CAT:own2", "SPEC-E-ADD:ad"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-071:【君を真っ二つにしたい】— 選んだユニットは撃破される（出典: atwiki/page-2112「撃破してもよい」）", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG4-071");
    s = resolveAll(pick(s, "SPEC-E-ADD:ad"));
    expect(zoneOf(s, "player2", "SPEC-E-ADD:ad")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-072 タブー・ドーパント", () => {
  const TEXT = "※ウイング 【光弾】これが自軍エリアにある間、すべてのオペレーションカードは、必要パワーの数字が2増える。（この効果は重複しない）";

  it("XG4-072: カタログ本文・スペックが出典と一致（出典: atwiki/page-2066）", () => {
    expectCatalogText("XG4-072", TEXT);
    expectUnit("XG4-072", { name: "タブー・ドーパント", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["怪人", "女", "ドーパント"] });
    expectRarityIn("XG4-072", ["N"]);
  });

  wingTests("XG4-072", "atwiki/page-2066");

  const opBoard = (power: number, enemyTaboo: number) =>
    board({ hand: [inst("SPEC-OP-1", "op")], command: releasedCat("DA", 1), power: powerCards(power) }, { rush: Array.from({ length: enemyTaboo }, (_, i) => inst("XG4-072", `t${i}`)) });

  it("XG4-072:【光弾】— すべてのオペレーションカードの必要パワーが2増える（敵軍のタブー・ドーパントで、自軍の必要パワー1のオペレーションがパワー2では使えず、3なら使える）（出典: atwiki/page-2066「すべてのオペレーションカードは、必要パワーの数字が2増える」）", () => {
    expect(canUseCard(opBoard(2, 1), "player1", "SPEC-OP-1:op")).toBe(false);
    expect(canUseCard(opBoard(3, 1), "player1", "SPEC-OP-1:op")).toBe(true);
  });

  it("XG4-072:【光弾】— 重複しない（2体あっても +2 のまま、パワー3で使える）（出典: atwiki/page-2066「（この効果は重複しない）」）", () => {
    expect(canUseCard(opBoard(3, 2), "player1", "SPEC-OP-1:op")).toBe(true);
  });

  it("XG4-072:【光弾】— タブー・ドーパントがいなければ必要パワーは元のまま（パワー1で使える）（出典: atwiki/page-2066「これが自軍エリアにある間」）", () => {
    expect(canUseCard(opBoard(1, 0), "player1", "SPEC-OP-1:op")).toBe(true);
  });
});

// ===========================================================================
describe("XG4-073 仮面ライダークウガDF（XG4）", () => {
  const TEXT = "※モーフ 【水の心の戦士】これが敵軍ユニットにアタックされたとき、自軍コマンドを2つ選びホールドしてもよい。そうしたとき、そのバトルは行われない。";

  it("XG4-073: カタログ本文・スペックが出典と一致（出典: atwiki/page-2067）", () => {
    expectCatalogText("XG4-073", TEXT);
    expectUnit("XG4-073", { name: "仮面ライダークウガDF", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 2, comboNumber: undefined, features: ["仮面ライダー", "男", "アマダム"] });
    expectRarityIn("XG4-073", ["N"]);
  });

  morphTests("XG4-073", "XG4-052", "XG4-067", "atwiki/page-2067");

  const attacked = (commands: number) =>
    settle(enemyAttack(enemyBoard({ battle: [inst("XG4-073", "df")], command: releasedCat("MA", commands) }, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA), "TST-UNIT-7:atk", "XG4-073:df"));

  it("XG4-073:【水の心の戦士】— 敵軍ユニットにアタックされたとき、自軍コマンドを2つホールドするかを選べる（任意）（出典: atwiki/page-2067「自軍コマンドを2つ選びホールドしてもよい」）", () => {
    const s = attacked(2);
    expectChoiceFrom(s, "player1", "XG4-073");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-073:【水の心の戦士】— ホールドすると、そのバトルは行われない（BP13000 にアタックされても撃破されない）（出典: atwiki/page-2067「そうしたとき、そのバトルは行われない」）", () => {
    let s = attacked(2);
    expectChoiceFrom(s, "player1", "XG4-073");
    s = resolveAll(pickThrough(s, "XG4-073", s.players.player1.command.map((c) => c.instanceId)));
    expect(zoneOf(s, "player1", "XG4-073:df")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("XG4-073:【水の心の戦士】— リリース状態の自軍コマンドが1つしかなければホールドできず、バトルで撃破される（出典: atwiki/page-2067「自軍コマンドを2つ選び」）", () => {
    let s = attacked(1);
    if (s.pendingEffectChoice?.sourceCardId === "XG4-073") s = pickThrough(s, "XG4-073", s.players.player1.command.map((c) => c.instanceId));
    s = resolveAll(settle(s));
    expect(zoneOf(s, "player1", "XG4-073:df")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-074 仮面ライダーX（XG4）", () => {
  const TEXT = "【ライドルスティック】これが敵軍Sユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のコマンドゾーンに送ってもよい。置けなければ捨札にする。";

  it("XG4-074: カタログ本文・スペックが出典と一致（出典: atwiki/page-2055）", () => {
    expectCatalogText("XG4-074", TEXT);
    expectUnit("XG4-074", { name: "仮面ライダーX", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("XG4-074", ["N"]);
  });

  // TST-UNIT-7（BP13000）は L ユニットなので「敵軍Sユニットにアタックするとき」に当たらない。BP13000 の S ユニットで組む（XG4-judgments.md）。
  const STRONG = "SPEC-E-13000";
  // CN が RC なので、【ライドルスティック】はライドオフしたターンだけ（docs/rules/07-keywords.md「RC は…ライドオフしたときに発動」。XG4-judgments.md）。
  const atk = (target: string, enemyCommand: ReturnType<typeof inst>[] = []) =>
    settle(
      attack(
        settle(rcRideOff(battle({ rush: [inst("XG4-074", "x"), inst("SPEC-BIKE", "bk")] }, { battle: [inst(target, "t")], command: enemyCommand, deck: deckCards(3, "e") }), "XG4-074:x", "SPEC-BIKE:bk")),
        "XG4-074:x",
        `${target}:t`,
      ),
    );

  it("XG4-074:【ライドルスティック】— ライドオフしていなければ（RC が成立していなければ）発動しない（出典: atwiki/page-2055「CN：RC」）", () => {
    const s = settle(attack(battle({ battle: [inst("XG4-074", "x")] }, { battle: [inst(STRONG, "t")], deck: deckCards(3, "e") }), "XG4-074:x", `${STRONG}:t`));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-074");
  });

  it("XG4-074:【ライドルスティック】— 敵軍 S ユニットにアタックするとき、バトルの前にバトル相手をコマンドゾーンに送るかを選べる（任意）（出典: atwiki/page-2055「バトルの前にバトル相手のユニットを持ち主のコマンドゾーンに送ってもよい」）", () => {
    const s = atk(STRONG);
    expectChoiceFrom(s, "player1", "XG4-074");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-074:【ライドルスティック】— 送ると、BP13000 の相手も持ち主のコマンドゾーンに置かれ、これは撃破されない（出典: atwiki/page-2055・カード評価「BPやブレイカー…を無視して除去できる」）", () => {
    let s = atk(STRONG);
    expectChoiceFrom(s, "player1", "XG4-074");
    s = resolveAll(settle(confirm(s)));
    expect(zoneOf(s, "player2", `${STRONG}:t`)).toBe("command");
    expect(zoneOf(s, "player1", "XG4-074:x")).toBe("battle");
  });

  it("XG4-074:【ライドルスティック】— 敵軍コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-2055「置けなければ捨札にする」）", () => {
    let s = atk(STRONG, releasedCat("WB", 5));
    expectChoiceFrom(s, "player1", "XG4-074");
    s = resolveAll(settle(confirm(s)));
    expect(zoneOf(s, "player2", `${STRONG}:t`)).toBe("discard");
  });

  it("XG4-074:【ライドルスティック】— 敵軍 M ユニットにアタックするときは発動しない（出典: atwiki/page-2055「敵軍Sユニットにアタックするとき」）", () => {
    const s = atk("TST-UNIT-2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-074");
  });
});

// ===========================================================================
describe("XG4-075 アポロガイスト（XG4）", () => {
  const TEXT =
    "※コールDA ※これが自軍エリアにある間、自分がターンを終えるとき、これがホールド状態なら捨札にする。 【生命の強奪】自軍ターン中、ホールド状態のこのユニットがバトルエリアに出たとき、次の効果を発動する⇒相手は自分自身のSユニットを1体選び撃破するか、このユニットをリリースするかを選ぶ。";

  it("XG4-075: カタログ本文・スペックが出典と一致（出典: atwiki/page-2062）", () => {
    expectCatalogText("XG4-075", TEXT);
    expectUnit("XG4-075", { name: "アポロガイスト", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["大ショッカー", "男", "改造人間"] });
    expectRarityIn("XG4-075", ["N"]);
  });

  callTests("XG4-075", "DA", "atwiki/page-2062");

  it("XG4-075: ※ — 自分がターンを終えるとき、ホールド状態なら捨札になる（出典: atwiki/page-2062「自分がターンを終えるとき、これがホールド状態なら捨札にする」）", () => {
    const s = resolveAll(endTurn(battle({ rush: [{ ...inst("XG4-075", "ap"), commandHeld: true }] })));
    expect(zoneOf(s, "player1", "XG4-075:ap")).toBe("discard");
  });

  it("XG4-075: ※ — リリース状態なら残る（出典: atwiki/page-2062「これがホールド状態なら」）", () => {
    const s = resolveAll(endTurn(battle({ rush: [inst("XG4-075", "ap")] })));
    expect(zoneOf(s, "player1", "XG4-075:ap")).toBe("rush");
  });

  const entered = () =>
    settle(enterNow(battle({ rush: [{ ...inst("XG4-075", "ap"), commandHeld: true }] }, { battle: [inst("SPEC-E-S", "a")], rush: [inst("SPEC-E-S", "b"), inst("TST-UNIT-2", "m")], deck: deckCards(3, "e") }), "XG4-075:ap"));

  it("XG4-075:【生命の強奪】— 自軍ターン中、ホールド状態のこれがバトルエリアに出たとき、相手が「自分自身の S ユニットを1体撃破する」か「これをリリースする」かを選ぶ（出典: atwiki/page-2062「相手は自分自身のSユニットを1体選び撃破するか、このユニットをリリースするかを選ぶ」）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG4-075");
    expect(choicePlayer(s)).toBe("player2");
  });

  it("XG4-075:【生命の強奪】— 相手が S ユニット（M ユニットは選べない）を撃破することを選ぶと、そのユニットは撃破される（出典: atwiki/page-2062「自分自身のSユニットを1体選び撃破する」）", () => {
    let s = entered();
    expect(choicePlayer(s)).toBe("player2");
    for (let i = 0; i < 3 && s.pendingEffectChoice?.sourceCardId === "XG4-075"; i++) {
      const ids = choiceIds(s);
      expect(ids).not.toContain("TST-UNIT-2:m");
      const next = ids.find((id) => id.startsWith("SPEC-E-S")) ?? ids.find((id) => /destroy|撃破/.test(id));
      if (!next) break;
      s = pickAs(s, "player2", next);
    }
    s = resolveAll(s);
    expect([zoneOf(s, "player2", "SPEC-E-S:a"), zoneOf(s, "player2", "SPEC-E-S:b")]).toContain("discard");
  });

  it("XG4-075:【生命の強奪】— リリース状態でバトルエリアに出たときは発動しない（出典: atwiki/page-2062「ホールド状態のこのユニットが」）", () => {
    const s = settle(enterNow(battle({ rush: [inst("XG4-075", "ap")] }, { battle: [inst("SPEC-E-S", "a")] }), "XG4-075:ap"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-075");
  });

  it.todo("XG4-075: 公式Q&A — RK-246 ウエイクアップ！でリリースされた後でも【生命の強奪】は使え、そのとき相手は撃破を選ばなければならない（出典: atwiki/page-2062 Q1）（未対応の理由: ホールド状態で出たあと解決前にリリースする「ウエイクアップ！」の割り込みを、公開 API の手順で組めない）");
});

// ===========================================================================
describe("XG4-076 スーパーアポロガイスト", () => {
  const TEXT = "※コールDA 【世界の融合】これをラッシュしたとき、すべての捨札を持ち主の山札に戻してシャッフルする。";

  it("XG4-076: カタログ本文・スペックが出典と一致（出典: atwiki/page-2113）", () => {
    expectCatalogText("XG4-076", TEXT);
    expectUnit("XG4-076", { name: "スーパーアポロガイスト", category: "DA", size: "S", bp: 5500, sp: 1, powerCost: "7-", comboNumber: undefined, features: ["大ショッカー", "男", "改造人間", "ファンガイア"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG4-076", ["NR"]);
  });

  // 共通の zordDownTests は「捨札にしたアポロガイストが捨札にある」ことを見るが、これは【世界の融合】（ラッシュしたとき、すべての捨札を山札に戻す）で
  // 山札に戻るので、追加条件の1つ目だけここで書き直す（出典どおり、捨札にしたアポロガイストは山札に戻る。XG4-judgments.md）。
  it("XG4-076: 追加条件 — 自軍「アポロガイスト」1体を捨札にすれば必要パワー0でラッシュできる（捨札にしたアポロガイストは【世界の融合】で山札に戻る）（出典: atwiki/page-2113）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("XG4-076", "am")], rush: [inst("XG4-075", "p")], command: releasedCat("DA", 1), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", "XG4-076:am", (a) => a.zordMaterialInstanceId === "XG4-075:p");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "XG4-076:am")).toBe("rush");
    expect(zoneOf(t, "player1", "XG4-075:p")).toBe("deck");
  });

  it("XG4-076: 必要パワー7- — 「アポロガイスト」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: atwiki/page-2113・R-ADD-02）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("XG4-076", "am")], command: releasedCat("DA", 1), power: powerCards(n), deck: deckCards(3) } });
    expect(canStartRush(mk(6), "player1", "XG4-076:am")).toBe(false);
    const r = rushFromHand(mk(7), "player1", "XG4-076:am");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG4-076:am")).toBe("rush");
  });
  callTests("XG4-076", "DA", "atwiki/page-2113");

  it("XG4-076:【世界の融合】— ラッシュしたとき、自軍・敵軍のすべての捨札が持ち主の山札に戻る（出典: atwiki/page-2113「すべての捨札を持ち主の山札に戻してシャッフルする」）", () => {
    const r = rushFromHand(
      board({ hand: [inst("XG4-076", "sa")], command: releasedCat("DA", 1), power: powerCards(7), discard: [inst("TST-UNIT-0", "d1"), inst("TST-OP", "d2")] }, { discard: [inst("TST-UNIT-0", "e1")] }),
      "player1",
      "XG4-076:sa",
    );
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(s.players.player1.discard).toHaveLength(0);
    expect(s.players.player2.discard).toHaveLength(0);
    expect(zoneOf(s, "player1", "TST-UNIT-0:d1")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("deck");
  });
});

// ===========================================================================
describe("XG4-077 仮面ライダーZX（XG4）", () => {
  const TEXT = "※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、自軍捨札の枚数がこれの必要パワーの数字以上なら、これを自軍ラッシュエリアに出してもよい。";

  it("XG4-077: カタログ本文・スペックが出典と一致（出典: atwiki/page-2052）", () => {
    expectCatalogText("XG4-077", TEXT);
    expectUnit("XG4-077", { name: "仮面ライダーZX", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "男", "改造人間", "メカ", "忍者"] });
    expectRarityIn("XG4-077", ["N"]);
  });

  const zx = (discard: number, phase: "rush" | "battle" = "rush") =>
    st({ phase, player1: { command: [{ ...inst("XG4-077", "zx"), commandHeld: false }], discard: Array.from({ length: discard }, (_, i) => inst("TST-UNIT-0", `d${i}`)), power: [], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);

  it("XG4-077: ※ — 自軍ラッシュフェイズ中、自軍捨札が3枚以上なら、コマンドゾーンのこれを自軍ラッシュエリアに出せる（パワーは不要）（出典: atwiki/page-2052「自軍捨札の枚数がこれの必要パワーの数字以上なら、これを自軍ラッシュエリアに出してもよい」）", () => {
    const s0 = zx(3);
    expect(canSelfRush(s0, "command", "XG4-077:zx")).toBe(true);
    const s = resolveAll(selfRush(s0, "command", "XG4-077:zx"));
    expect(zoneOf(s, "player1", "XG4-077:zx")).toBe("rush");
  });

  it("XG4-077: ※ — 捨札が2枚なら出せない（出典: atwiki/page-2052「必要パワーの数字以上なら」）", () => {
    expect(canSelfRush(zx(2), "command", "XG4-077:zx")).toBe(false);
  });

  it("XG4-077: ※ — 自軍バトルフェイズには出せない（出典: atwiki/page-2052「自軍ラッシュフェイズ中」）", () => {
    expect(canSelfRush(zx(3, "battle"), "command", "XG4-077:zx")).toBe(false);
  });
});

