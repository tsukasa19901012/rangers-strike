/**
 * カード別スペック: XP-001〜XP-005（クロスギャザー プロモーションカード 五色の戦士〜仮面ライダーディケイドCF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を
 *     「XP-」とカード名で検索: 本範囲のカードの項はない。atwiki に転載された公式 Q&A: XP-004 Q1・Q2（atwiki/page-1538）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XP-NNN.md と同じ内容の page-N-XP-NNN-RS/RK.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01・R-KW-TAG-01・R-KW-MORPH-03・R-KW-RC-01 等）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XP-NNN …」）で残す。
 * レアリティは atwiki の「プロモーションカード」を PR として照合する。
 * 同じ本文の再録（XP-001＝RS-608・XP-002＝RS-609）は元カードの cardSpec（RS9-605-626.a）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  activateResident,
  answer,
  attack,
  attackedInEnemyTurn,
  canActivateResident,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  enemyRushes,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOp,
  expectUnit,
  faceUpPower,
  featuresOf,
  inst,
  morphCandidates,
  pick,
  pickAs,
  playOp,
  powerCards,
  rcBoard,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
} from "./XP-001-016.helpers";

const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", powerCost: 0, bp: 1000 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 3000 });
const BP7000 = sUnit("SPEC-7000", { bp: 7000, sp: undefined });
const EXTRA = [ENEMY0, DA_S, BP7000];

// ===========================================================================
describe("XP-001 五色の戦士", () => {
  const TEXT =
    "※常駐 ※タッグ 自軍ラッシュフェイズごとに1度だけ『WBを持つ自軍コマンドを1つホールドする』を実行してもよい。そうしたとき、自軍Sユニットを1体選び、特徴「レッド」「イエロー」「ブルー」「ブラック」「ホワイト」のうちどれか1つを宣言する。このターン、宣言した特徴を選んだユニットに追加する。";

  const placed = (p1: Partial<GameState["players"]["player1"]> = {}, phase: GameState["phase"] = "rush") =>
    st({
      phase,
      player1: { operation: [inst("XP-001", "op")], command: releasedCat("WB", 2), rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e") },
    });

  it("XP-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-1532）", () => {
    expectCatalogText("XP-001", TEXT);
    expectOp("XP-001", { name: "五色の戦士", category: "WB", powerCost: 4, rarity: "PR" });
  });

  it("XP-001: ※常駐 — 使うと捨札にならず常駐置き場に置かれる（出典: atwiki/page-1532「※常駐」・R-KW-PERM-01）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("XP-001", "op")], command: releasedCat("WB", 1), power: powerCards(4), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = playOp(s, "player1", "XP-001:op");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XP-001:op")).toBe("operation");
  });

  it.fails("XP-001: 自軍ラッシュフェイズに WB の自軍コマンドがリリース状態なら起動できる（出典: atwiki/page-1532「『WBを持つ自軍コマンドを1つホールドする』を実行してもよい」） — 既知の不具合: CARD-XP-001 再録の XP-001 は常駐の起動（activate_resident_operation）が合法手に出ない（同じ本文の RS-608 は起動できる）", () => {
    expect(canActivateResident(placed(), "XP-001:op")).toBe(true);
  });

  it("XP-001: WB を持つ自軍コマンドがリリース状態でなければ起動できない（出典: atwiki/page-1532）", () => {
    expect(canActivateResident(placed({ command: releasedCat("ET", 2) }), "XP-001:op")).toBe(false);
  });

  it("XP-001: 自軍バトルフェイズには起動できない（出典: atwiki/page-1532「自軍ラッシュフェイズごとに1度だけ」）", () => {
    expect(canActivateResident(placed({}, "battle"), "XP-001:op")).toBe(false);
  });

  it.fails("XP-001: 起動すると WB のコマンドが1つホールドされ、自軍 S ユニットを選び、宣言できる特徴は5つだけ（出典: atwiki/page-1532「特徴「レッド」「イエロー」「ブルー」「ブラック」「ホワイト」のうちどれか1つを宣言する」） — 既知の不具合: CARD-XP-001 起動できない", () => {
    let s = activateResident(placed(), "XP-001:op");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
    expectChoiceFrom(s, "player1", "XP-001");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s"]);
    s = pick(s, "TST-UNIT-0:s");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["レッド", "イエロー", "ブルー", "ブラック", "ホワイト"]);
  });

  it.fails("XP-001: 宣言した特徴（ブルー）がこのターン選んだユニットに追加され、ターンの終わりに消える（出典: atwiki/page-1532「このターン、宣言した特徴を選んだユニットに追加する」） — 既知の不具合: CARD-XP-001 起動できない", () => {
    let s = activateResident(placed(), "XP-001:op");
    s = resolveAll(pick(pick(s, "TST-UNIT-0:s"), "ブルー"));
    expect(featuresOf(s, "player1", "TST-UNIT-0:s")).toEqual(["ブルー"]);
  });

  it.fails("XP-001: 自軍ラッシュフェイズごとに1度だけ（2回目は起動できない）（出典: atwiki/page-1532「自軍ラッシュフェイズごとに1度だけ」） — 既知の不具合: CARD-XP-001 起動できない", () => {
    let s = activateResident(placed(), "XP-001:op");
    s = resolveAll(s, ["TST-UNIT-0:s"]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(canActivateResident(s, "XP-001:op")).toBe(false);
  });

  it.fails("XP-001: 同名の常駐（RS-608 五色の戦士）と2枚並べれば、それぞれ1度ずつ起動できる（出典: ユーザー決定 2026-10-19・docs/rules/README.md §5.7 i） — 既知の不具合: CARD-XP-001 起動できない", () => {
    let s = activateResident(placed({ operation: [inst("XP-001", "op"), inst("RS-608", "op2")] }), "XP-001:op");
    if (s.pendingEffectChoice?.effectId === "tag_bold_pick") s = pick(s, "XP-001:op");
    s = resolveAll(s, ["TST-UNIT-0:s"]);
    expect(canActivateResident(s, "XP-001:op")).toBe(false);
    expect(canActivateResident(s, "RS-608:op2")).toBe(true);
  });
});

// ===========================================================================
describe("XP-002 戦士の魂", () => {
  const TEXT =
    "※常駐 ※タッグ 自軍バトルフェイズごとに１度だけ、『自軍ラッシュエリアのSユニットを１体コマンドゾーンに送るか捨札にする』を実行してもよい。そうしたとき、ナンバーに数字を持ちカテゴリにDAを持たない自軍Sユニットを、バトルエリアとラッシュエリアから１体ずつ選ぶ。このターン、このカードの効果でラッシュエリアから選んだユニットがＮＣを発動するとき、そのユニットの本来のNCの効果を発動するかわりに、このカードの効果でバトルエリアから選んだユニットのNCの効果を発動してもよい。";

  const placed = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "battle",
      player1: { operation: [inst("XP-002", "op")], battle: [inst("RS-059", "blue")], rush: [inst("TST-UNIT-0", "cost"), inst("RS-614", "king")], deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(3, "e") },
    });

  it("XP-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-1533）", () => {
    expectCatalogText("XP-002", TEXT);
    expectOp("XP-002", { name: "戦士の魂", category: "ET", powerCost: 5, rarity: "PR" });
  });

  it("XP-002: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-1533・R-KW-PERM-01）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("XP-002", "op")], command: releasedCat("ET", 1), power: powerCards(5), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = playOp(s, "player1", "XP-002:op");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XP-002:op")).toBe("operation");
  });

  it.fails("XP-002: 自軍バトルフェイズに、自軍ラッシュエリアの S ユニットをコマンドゾーンに送るか捨札にして起動できる（出典: atwiki/page-1533） — 既知の不具合: CARD-XP-002 再録の XP-002 は常駐の起動が合法手に出ない（同じ本文の RS-609 は起動できる）", () => {
    expect(canActivateResident(placed(), "XP-002:op")).toBe(true);
  });

  it("XP-002: 自軍ラッシュフェイズには起動できない（出典: atwiki/page-1533「自軍バトルフェイズごとに１度だけ」）", () => {
    expect(canActivateResident({ ...placed(), phase: "rush" }, "XP-002:op")).toBe(false);
  });

  it.fails("XP-002: ラッシュエリアから選んだユニット（クローバーキング）が NC を発動するとき、バトルエリアから選んだユニット（マジブルー）の NC（1枚ドロー）を代わりに発動できる（出典: atwiki/page-1533） — 既知の不具合: CARD-XP-002 起動できない", () => {
    let s = activateResident(placed(), "XP-002:op");
    s = resolveAll(s, ["TST-UNIT-0:cost", "RS-059:blue", "RS-614:king"]);
    const hand = s.players.player1.hand.length;
    s = resolveAll(enterSeq({ ...s, players: { ...s.players, player1: { ...s.players.player1, battle: [...s.players.player1.battle, inst("TST-UNIT-0", "f")] } } }, ["RS-614:king"]), ["RS-059:blue"]);
    expect(s.players.player1.hand.length).toBe(hand + 1);
  });

  it.todo("XP-002: 選べるのは「ナンバーに数字を持ち、カテゴリに DA を持たない」S ユニットだけ（出典: atwiki/page-1533）— RS-609 と同じく、選択の候補を公開 API で観測できる形になっていない（RS9-605-626.a の RS-609 と同じ）");
  it.todo("XP-002: 自軍バトルフェイズごとに1度だけ（出典: atwiki/page-1533）— RS-609 と同じく公開 API で観測できない");
});

// ===========================================================================
describe("XP-003 デカレッドバトライザー", () => {
  const TEXT =
    "合体―デカレッド＋マーフィーK9 ※これはアタックされるとき、BP+5000される。 【バトライズファイヤードライブ】これをラッシュしたとき、自軍パワーゾーンからカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、撃破する。";

  it("XP-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-1539）", () => {
    expectCatalogText("XP-003", TEXT);
    expectUnit("XP-003", {
      name: "デカレッドバトライザー",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: 1,
      powerCost: "5+",
      features: ["レッド", "男", "警察", "バトライザー"],
      rushCondition: "discard_fusion_unit",
      rarity: "PR",
    });
  });

  /** 自軍ラッシュフェイズ。手札にバトライザー、場にデカレッドとマーフィーK9。 */
  const rushBoardOf = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st(
      {
        phase: "rush",
        player1: { hand: [inst("XP-003", "bz")], rush: [inst("RS-106", "red"), inst("RS-404", "k9")], command: releasedCat("OT", 1), power: powerCards(5), deck: deckCards(3), ...p1 },
        player2: { deck: deckCards(3, "e"), ...p2 },
      },
      EXTRA,
    );

  it("XP-003: 合体 — 自軍のデカレッドとマーフィーK9 を捨札にしてラッシュできる（出典: atwiki/page-1539「合体―デカレッド＋マーフィーK9」「追加条件：自軍合体ユニットを捨札にする」）", () => {
    const r = rushFromHand(rushBoardOf(), "player1", "XP-003:bz", { materials: ["RS-106:red", "RS-404:k9"] });
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XP-003:bz")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-106:red")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-404:k9")).toBe("discard");
  });

  it("XP-003: 合体ユニットがそろっていなければ（マーフィーK9 がいない）ラッシュできない（出典: atwiki/page-1539・R-ADD 合体）", () => {
    expect(canStartRush(rushBoardOf({ rush: [inst("RS-106", "red")] }), "player1", "XP-003:bz")).toBe(false);
  });

  it("XP-003: 必要パワー「5+」— パワー4ではラッシュできない（出典: atwiki/page-1539「必要パワー：5+」）", () => {
    expect(canStartRush(rushBoardOf({ power: powerCards(4) }), "player1", "XP-003:bz")).toBe(false);
  });

  it("XP-003: ※ アタックされるとき BP+5000（BP8000）になり、BP7000 のアタックに勝つ（出典: atwiki/page-1539「※これはアタックされるとき、BP+5000される」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XP-003", "bz")] }, "XP-003:bz", {}, "SPEC-7000:atk", EXTRA));
    expect(zoneOf(s, "player1", "XP-003:bz")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-7000:atk")).toBe("discard");
  });

  it("XP-003: ※ アタックするときは BP が上がらず、BP7000 に負ける（出典: atwiki/page-1539「アタックされるとき」）", () => {
    let s = st({ player1: { battle: [inst("XP-003", "bz")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-7000", "d")], deck: deckCards(3, "e") } }, EXTRA);
    s = resolveAll(attack(s, "XP-003:bz", "SPEC-7000:d"));
    expect(zoneOf(s, "player1", "XP-003:bz")).toBe("discard");
  });

  /** 合体ラッシュし、【バトライズファイヤードライブ】の選択を開いたまま返す。自軍パワー: RS-106（必要パワー3）＋4枚。 */
  const fired = (p2: Partial<GameState["players"]["player2"]> = { rush: [inst("RS-106", "e3"), inst("RS-107", "e1")], battle: [inst("RS-404", "e1b")] }) => {
    const r = rushFromHand(rushBoardOf({ power: [faceUpPower("RS-106", "p3"), ...powerCards(4)] }, p2), "player1", "XP-003:bz", { materials: ["RS-106:red", "RS-404:k9"] });
    expect(r.ok).toBe(true);
    return settle(r.state);
  };

  it("XP-003: 【バトライズファイヤードライブ】ラッシュしたとき、自軍パワーゾーンのカードを1枚選んで捨札にできる（任意）（出典: atwiki/page-1539「自軍パワーゾーンからカードを1枚選び捨札にしてもよい」）", () => {
    const s = fired();
    expectChoiceFrom(s, "player1", "XP-003");
    expect(choiceIds(s)).toContain("RS-106:p3");
    expect(canSkip(s)).toBe(true);
  });

  it("XP-003: 【バトライズファイヤードライブ】捨札にしたカード（必要パワー3）と同じ必要パワーの数字の敵軍 S ユニットだけを選び、撃破する（出典: atwiki/page-1539「捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、撃破する」）", () => {
    let s = pick(fired(), "RS-106:p3");
    expect(zoneOf(s, "player1", "RS-106:p3")).toBe("discard");
    expectChoiceFrom(s, "player1", "XP-003");
    expect(choiceIds(s)).toEqual(["RS-106:e3"]);
    s = resolveAll(pick(s, "RS-106:e3"));
    expect(zoneOf(s, "player2", "RS-106:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-107:e1")).toBe("rush");
  });

  it("XP-003: 【バトライズファイヤードライブ】捨札にしなければ何も撃破しない（出典: atwiki/page-1539「捨札にしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(fired()));
    expect(zoneOf(s, "player1", "RS-106:p3")).toBe("power");
    expect(zoneOf(s, "player2", "RS-106:e3")).toBe("rush");
  });
});

// ===========================================================================
describe("XP-004 仮面ライダーディケイド", () => {
  const TEXT =
    "※モーフ 【カメンライド】効果名「アタックライド」を持つオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい。このとき出したユニットは、ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する。";

  it("XP-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-1538）", () => {
    expectCatalogText("XP-004", TEXT);
    expectUnit("XP-004", {
      name: "仮面ライダーディケイド",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "1/4",
      powerCost: 2,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "ディケイドライバー"],
      rarity: "PR",
    });
  });

  it("XP-004: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（ディケイド ファイズ）と置き換えられる。特徴が違うカードは選べない（出典: atwiki/page-1538「※モーフ」「モーフ可能なユニット」・R-KW-MORPH-03）", () => {
    let s = enemyRushes({ battle: [inst("XP-004", "dc")], command: [released("XG1-066", "fz"), released("XG2-043", "wcj")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["XG1-066:fz"]);
    s = settle(pickAs(s, "player1", "XG1-066:fz"));
    expect(zoneOf(s, "player1", "XG1-066:fz")).toBe("battle");
    expect(zoneOf(s, "player1", "XP-004:dc")).toBe("command");
  });

  const kamenRide = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rcBoard("XP-004:dc", { command: [released("XG1-064", "agito"), released("XG2-043", "wcj")], power: [faceUpPower("XG1-066", "fz"), { ...inst("XG1-068", "kuuga"), faceDown: true }], ...p1 }, { battle: [inst("SPEC-DA-S", "da")], ...p2 }, EXTRA);

  it("XP-004: 【カメンライド】RC — 自軍ゾーンのオモテ向きの、効果名「アタックライド」を持つユニットカードから選べる（任意。アタックライドを持たないカード・ウラ向きのカードは選べない）（出典: atwiki/page-1538「効果名「アタックライド」を持つオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい」）", () => {
    const s = kamenRide();
    expectChoiceFrom(s, "player1", "XP-004");
    expect(choiceIds(s)).toEqual(["XG1-064:agito", "XG1-066:fz"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XP-004: 【カメンライド】置き換えて出たユニット（ディケイド アギトGF・RC）はライドオフした直後として RC の【アタックライド】を発動する（DA の敵軍 S ユニットを撃破）（出典: atwiki/page-1538「ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する」・XG1-064 本文） — 既知の不具合: CARD-XP-004 置き換えはするが、出たユニットの RC の効果が発動しない", () => {
    let s = pick(kamenRide(), "XG1-064:agito");
    expect(zoneOf(s, "player1", "XG1-064:agito")).toBe("battle");
    expect(zoneOf(s, "player1", "XP-004:dc")).toBe("command");
    s = resolveAll(s, ["SPEC-DA-S:da"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:da")).toBe("discard");
  });

  it("XP-004: 公式Q&A — RC でない【アタックライド】（XG1-069 ディケイド 響鬼。CN1）は、NC を満たさない並びなら発動しない（出典: atwiki/page-1538 Q1）", () => {
    let s = kamenRide({ command: [released("XG1-069", "hibiki")], hand: [inst("TST-OP", "opc")] });
    s = pick(s, "XG1-069:hibiki");
    expect(zoneOf(s, "player1", "XG1-069:hibiki")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-069");
  });

  it.fails("XP-004: 公式Q&A — 置き換えでバトルエリアに出た XG1-072 ディケイド キバは「バトルエリアに出たとき」の【アタックライド】を使える（出典: atwiki/page-1538 Q2） — 既知の不具合: CARD-XP-004 置き換えで出たユニットの「バトルエリアに出たとき」の効果が発動しない", () => {
    let s = kamenRide({ command: [released("XG1-072", "kiba")] }, { battle: [inst("SPEC-DA-S", "da")] });
    s = pick(s, "XG1-072:kiba");
    expect(zoneOf(s, "player1", "XG1-072:kiba")).toBe("battle");
    expectChoiceFrom(s, "player1", "XG1-072");
  });

  it("XP-004: 【カメンライド】置き換えないことを選べば、そのまま場に残る（出典: atwiki/page-1538「置き換えてもよい」）", () => {
    const s = resolveAll(skip(kamenRide()));
    expect(zoneOf(s, "player1", "XP-004:dc")).toBe("battle");
    expect(zoneOf(s, "player1", "XG1-064:agito")).toBe("command");
  });
});

// ===========================================================================
describe("XP-005 仮面ライダーディケイドCF", () => {
  const TEXT =
    "※これがユニットでなくなるとき、オモテ向きの自軍パワーから特徴「仮面ライダー」を持つカードを1枚選び捨札にすれば、その場に留まる。 【全てを集めた先にあるもの】自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーから効果名「アタックライド」を持つカードを1枚選んでもよい。そうしたとき、選んだカードの「アタックライド」の効果を、このユニットの効果としてナンバーに関係なく発動する。";

  it("XP-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-1557）", () => {
    expectCatalogText("XP-005", TEXT);
    expectUnit("XP-005", {
      name: "仮面ライダーディケイドCF",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "1/4",
      powerCost: "6+",
      features: ["仮面ライダー", "男", "ディケイドライバー"],
      rushCondition: "send_s_unit_to_power",
      rarity: "PR",
    });
  });

  it("XP-005: 追加条件 — 特徴「ディケイドライバー」を持つ自軍ユニット1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-1557「追加条件：特徴「ディケイドライバー」を持つ自軍ユニット1体をパワーゾーンに送る」）", () => {
    const s0 = st({ phase: "rush", player1: { hand: [inst("XP-005", "cf")], rush: [inst("XP-004", "dc")], command: releasedCat("OT", 1), power: powerCards(6), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = rushFromHand(s0, "player1", "XP-005:cf", { materials: ["XP-004:dc"] });
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XP-005:cf")).toBe("rush");
    expect(zoneOf(s, "player1", "XP-004:dc")).toBe("power");
  });

  it.fails("XP-005: 追加条件 — 「ディケイドライバー」の自軍ユニットがいなければラッシュできない（出典: atwiki/page-1557） — 既知の不具合: CARD-XP-005 追加条件の「特徴「ディケイドライバー」を持つ」を見ず、どの自軍ユニットでもパワーゾーンに送ってラッシュできる", () => {
    const s0 = st({ phase: "rush", player1: { hand: [inst("XP-005", "cf")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("OT", 1), power: powerCards(6), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(canStartRush(s0, "player1", "XP-005:cf")).toBe(false);
  });

  /** 敵軍ターンに BP13000 にアタックされて撃破されるところ（パワー: オモテの仮面ライダー・オモテの非ライダー・ウラの仮面ライダー）。 */
  const destroyed = () =>
    attackedInEnemyTurn(
      { battle: [inst("XP-005", "cf")], power: [faceUpPower("XG1-066", "rider"), faceUpPower("TST-P", "plain"), { ...inst("XG1-068", "down"), faceDown: true }] },
      "XP-005:cf",
    );

  it.fails("XP-005: ※ ユニットでなくなるとき、オモテ向きの自軍パワーの特徴「仮面ライダー」のカードを選べる（任意。ウラ向き・ライダー以外は選べない）（出典: atwiki/page-1557「オモテ向きの自軍パワーから特徴「仮面ライダー」を持つカードを1枚選び捨札にすれば」） — 既知の不具合: CARD-XP-005 ※（パワーの「仮面ライダー」を捨札にして場に留まる）が未実装", () => {
    const s = destroyed();
    expectChoiceFrom(s, "player1", "XP-005");
    expect(choiceIds(s)).toEqual(["XG1-066:rider"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XP-005: ※ 選んだカードを捨札にすれば、その場に留まる（出典: atwiki/page-1557「その場に留まる」） — 既知の不具合: CARD-XP-005 ※ が未実装", () => {
    const s = resolveAll(pick(destroyed(), "XG1-066:rider"));
    expect(zoneOf(s, "player1", "XG1-066:rider")).toBe("discard");
    expect(zoneOf(s, "player1", "XP-005:cf")).toBe("battle");
  });

  it.fails("XP-005: ※ 捨札にしなければ撃破される（出典: atwiki/page-1557） — 既知の不具合: CARD-XP-005 ※ が未実装（選択が開かない）", () => {
    const s = resolveAll(skip(destroyed()));
    expect(zoneOf(s, "player1", "XP-005:cf")).toBe("discard");
    expect(zoneOf(s, "player1", "XG1-066:rider")).toBe("power");
  });

  it("XP-005: ※ オモテ向きの自軍パワーに特徴「仮面ライダー」のカードがなければ、そのまま撃破される（出典: atwiki/page-1557）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XP-005", "cf")], power: [faceUpPower("TST-P", "plain")] }, "XP-005:cf"));
    expect(zoneOf(s, "player1", "XP-005:cf")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:plain")).toBe("power");
  });

  /** 自軍バトルフェイズに CF を出す（オモテ向きの自軍パワー: アギトGF・ファイズ〈アタックライド〉・W・CJ〈アタックライドなし〉）。 */
  const entered = (p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-DA-S", "da")] }) =>
    act(
      st({ player1: { rush: [inst("XP-005", "cf")], power: [faceUpPower("XG1-064", "agito"), faceUpPower("XG2-043", "wcj"), { ...inst("XG1-066", "down"), faceDown: true }], deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA),
      { type: "move_to_battle", playerId: "player1", instanceId: "XP-005:cf" },
    );

  it.fails("XP-005: 【全てを集めた先にあるもの】自軍ターンにバトルエリアに出たとき、オモテ向きの自軍パワーの「アタックライド」を持つカードから選べる（任意）（出典: atwiki/page-1557「オモテ向きの自軍パワーから効果名「アタックライド」を持つカードを1枚選んでもよい」） — 既知の不具合: CARD-XP-005 【全てを集めた先にあるもの】が未実装", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XP-005");
    expect(choiceIds(s)).toEqual(["XG1-064:agito"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XP-005: 【全てを集めた先にあるもの】選んだカード（アギトGF）の【アタックライド】をこのユニットの効果として発動する（DA の敵軍 S ユニットを撃破。選んだカードはパワーゾーンに残る）（出典: atwiki/page-1557「選んだカードの「アタックライド」の効果を、このユニットの効果としてナンバーに関係なく発動する」） — 既知の不具合: CARD-XP-005 【全てを集めた先にあるもの】が未実装", () => {
    const s = resolveAll(pick(entered(), "XG1-064:agito"), ["SPEC-DA-S:da"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:da")).toBe("discard");
    expect(zoneOf(s, "player1", "XG1-064:agito")).toBe("power");
  });

  it.todo("XP-005: 【全てを集めた先にあるもの】敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の RC 等で出されたとき）は発動しない（出典: atwiki/page-1557「自軍ターン中、」）— 敵軍ターンに自軍ユニットをバトルエリアに出す手順を本範囲では組んでいない");
});
