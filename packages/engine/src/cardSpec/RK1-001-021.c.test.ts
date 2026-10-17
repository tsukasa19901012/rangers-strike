/**
 * カード別スペック: RK-015〜RK-021（ザ・マスクドライダーEXP vol.1 人類の進化〜クロックアップ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-016・RK-017・RK-021 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01、R-CTR-01、R-TGT-01、R-PRI-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  act,
  attack,
  attackersOf,
  bpOf,
  canActivateResident,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectOpStats,
  expectRarityIn,
  inst,
  legal,
  nextPhase,
  passEntry,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  settle,
  skip,
  st,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RK1-001-021.helpers";

const MALE = sUnit("SPEC-MALE", { category: "MA", bp: 2000, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { category: "MA", bp: 2000, features: ["女"] });
const MALE_M = sUnit("SPEC-MALE-M", { category: "MA", size: "M", bp: 3000, features: ["男"] });
const MECHA = sUnit("SPEC-MECHA", { category: "MA", bp: 2000, features: ["メカ"] });
const RIDER = sUnit("SPEC-RIDER", { category: "ET", bp: 2000, powerCost: 3, features: ["仮面ライダー", "男"] });
const RIDER_B = sUnit("SPEC-RIDER-B", { category: "ET", bp: 2000, features: ["仮面ライダー", "男"] });
const RIDER_M = sUnit("SPEC-RIDER-M", { category: "ET", size: "M", bp: 3000, features: ["仮面ライダー"] });
const MIRROR = sUnit("SPEC-MIRROR", { category: "WB", bp: 1000 });
const S5000 = sUnit("SPEC-S5000", { bp: 5000 });
const M5000 = sUnit("SPEC-M5000", { bp: 5000, size: "M" });
const E8000 = sUnit("SPEC-E8000", { bp: 8000 });
const E8500 = sUnit("SPEC-E8500", { bp: 8500 });
const ACCEL = sUnit("SPEC-ACCEL", { category: "OT", bp: 1000, features: ["加速"] });
const NOSP = sUnit("SPEC-NOSP", { bp: 1000, sp: undefined });
const RC_S = sUnit("SPEC-RC", { category: "ET", bp: 1000, comboNumber: "RC" });
const VEHICLE = { id: "SPEC-VEHICLE", name: "SPEC-VEHICLE", type: "vehicle", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 0, size: "S", features: ["メカ"] } as unknown as CardDefinition;
const EXTRA = [MALE, FEMALE, MALE_M, MECHA, RIDER, RIDER_B, RIDER_M, MIRROR, S5000, M5000, E8000, E8500, ACCEL, NOSP, RC_S, VEHICLE];

const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

const played = (s: GameState, id: string, playerId: PlayerId = "player1") => {
  const r = playOp(s, playerId, id);
  expect(r.ok, r.error).toBe(true);
  return r.state;
};

/** 手札のカウンターを使う（カテゴリの支払いは先頭の有効なコマンド）。 */
const useCounter = (s: GameState, id: string) => {
  const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === id);
  let next = pay ? act(s, pay) : s;
  const play = legal(next).find((a) => a.type === "play_counter" && a.instanceId === id);
  if (play) next = act(next, play);
  return next;
};
const canCounter = (s: GameState, id: string) =>
  legal(s).some(
    (a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === id) || (a.type === "play_counter" && a.instanceId === id),
  );

/** バトルの反応ウィンドウをパスし、撃破による離場の反応ウィンドウ（pendingLeave）まで進める。 */
const toLeave = (s: GameState) => {
  let n = s;
  for (let i = 0; i < 5 && !n.pendingLeave; i++) {
    const p = legal(n).find((a) => a.type === "pass_battle_reaction");
    if (!p) break;
    n = act(n, p);
  }
  return n;
};

/** 複数選択（selectCount 2）で ids を順に選び、必要なら確定する。 */
const pickAll = (s: GameState, ids: string[]) => {
  let n = s;
  for (const id of ids) n = pick(n, id);
  if (n.pendingEffectChoice && legal(n).some((a) => a.type === "confirm_effect_choice")) {
    n = act(n, { type: "confirm_effect_choice", playerId: n.pendingEffectChoice.playerId });
  }
  return n;
};

// ===========================================================================
describe("RK-015 人類の進化", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 特徴「男」または「女」を持つ自軍ユニットが撃破されて捨札になったとき発動できる⇒自軍山札の上からカードを1枚ひく。そのカードが特徴「仮面ライダー」を持つユニットカードなら自軍ラッシュエリアに出してもよい。ただし必要パワーと追加条件は満たすこと。そうしないとき、ひいたカードは手札に加える。";

  /** 敵軍（player2）ターン、自軍の victim が BP13000 のユニットにアタックされて撃破され、離場の反応ウィンドウが開く。 */
  const destroyed = (victim: string, deck: CardInstance[], power = 3) => {
    const [vid, vsuf] = victim.split(":") as [string, string];
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst(vid, vsuf)], hand: [inst("RK-015", "jk")], command: releasedCat("MA", 1), power: powerCards(power), deck },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    return toLeave(attack(s, "TST-UNIT-7:atk", victim, "player2"));
  };

  it("RK-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-213）", () => {
    expectCatalogText("RK-015", TEXT);
    expectOpStats("RK-015", { name: "人類の進化", category: "MA", powerCost: 3 });
    expectRarityIn("RK-015", ["MR", "N"]);
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: 特徴「男」を持つ自軍ユニットが撃破されて捨札になったとき使える（出典: atwiki/page-213）", () => {
    expect(canCounter(destroyed("SPEC-MALE:v", deckCards(3)), "RK-015:jk")).toBe(true);
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: 特徴「女」を持つユニット・M ユニットでも使える（出典: atwiki/page-213「特徴「男」または「女」を持つ自軍ユニット」（サイズの限定がない））", () => {
    expect(canCounter(destroyed("SPEC-FEMALE:v", deckCards(3)), "RK-015:jk")).toBe(true);
    expect(canCounter(destroyed("SPEC-MALE-M:v", deckCards(3)), "RK-015:jk")).toBe(true);
  });

  it("RK-015: 「男」「女」を持たないユニットが撃破されたときは使えない（出典: atwiki/page-213）", () => {
    expect(canCounter(destroyed("SPEC-MECHA:v", deckCards(3)), "RK-015:jk")).toBe(false);
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: ひいたカードが特徴「仮面ライダー」のユニットカードなら、自軍ラッシュエリアに出すかを選べる（任意）（出典: atwiki/page-213「自軍ラッシュエリアに出してもよい」）", () => {
    const s = useCounter(destroyed("SPEC-MALE:v", [inst("SPEC-RIDER", "rd"), ...deckCards(3)]), "RK-015:jk");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-015");
    expect(choiceIds(s)).toEqual(["SPEC-RIDER:rd"]);
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: 出すと自軍ラッシュエリアに出る（出典: atwiki/page-213）", () => {
    const s = resolveAll(pick(useCounter(destroyed("SPEC-MALE:v", [inst("SPEC-RIDER", "rd"), ...deckCards(3)]), "RK-015:jk"), "SPEC-RIDER:rd"));
    expect(zoneOf(s, "player1", "SPEC-RIDER:rd")).toBe("rush");
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: 出さなければ、ひいたカードは手札に加える（出典: atwiki/page-213「そうしないとき、ひいたカードは手札に加える」）", () => {
    const s = resolveAll(skip(useCounter(destroyed("SPEC-MALE:v", [inst("SPEC-RIDER", "rd"), ...deckCards(3)]), "RK-015:jk")));
    expect(zoneOf(s, "player1", "SPEC-RIDER:rd")).toBe("hand");
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: 「仮面ライダー」のユニットカードでなければ手札に加える（出典: atwiki/page-213）", () => {
    const s = resolveAll(useCounter(destroyed("SPEC-MALE:v", [inst("SPEC-MALE", "top"), ...deckCards(3)]), "RK-015:jk"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-015");
    expect(zoneOf(s, "player1", "SPEC-MALE:top")).toBe("hand");
  });

  // 既知の不具合: CARD-RK-015 撃破されて捨札になったときのカウンターとして使えない（離場の反応ウィンドウに出ない）
  it.fails("RK-015: 必要パワーを満たさない「仮面ライダー」のカードは出せず手札に加える（出典: atwiki/page-213「ただし必要パワーと追加条件は満たすこと」）", () => {
    // SPEC-RIDER は必要パワー3。パワーゾーンは2枚。
    const s = resolveAll(useCounter(destroyed("SPEC-MALE:v", [inst("SPEC-RIDER", "rd"), ...deckCards(3)], 2), "RK-015:jk"));
    expect(zoneOf(s, "player1", "SPEC-RIDER:rd")).toBe("hand");
  });

  it("RK-015: ※カウンター — 自軍ターン中は使えない（出典: atwiki/page-213「これは敵軍ターン中にのみ使用できる」・R-CTR-01）", () => {
    let s = st(
      {
        phase: "battle",
        player1: { battle: [inst("SPEC-MALE", "v")], hand: [inst("RK-015", "jk")], command: releasedCat("MA", 1), power: powerCards(3), deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = toLeave(attack(s, "SPEC-MALE:v", "TST-UNIT-7:big"));
    expect(canCounter(s, "RK-015:jk")).toBe(false);
  });
});

// ===========================================================================
describe("RK-016 ミラーワールド", () => {
  const TEXT =
    "※常駐 自軍ラッシュフェイズに自軍Sユニットをこれにオモテ向きに重ねてもよい。これが常駐置き場を離れるとき、重ねたカードはすべて手札に加える。これに重ねたカードと同じカード名の自軍ユニットは、次の能力を得る⇒相手は自分自身のコマンドを1つホールドしなければ、このユニットを選べない。アタックするには、さらに2つホールドしなければならない。";

  const mirror = (stacked: CardInstance[]) => ({ ...inst("RK-016", "mw"), stackedCards: stacked });

  /** 敵軍（player2）バトルフェイズ。player1 はミラーワールドに SPEC-MIRROR を重ねている。player2 の BP13000 のユニットがアタックする。 */
  const defended = (stacked: CardInstance[], enemyCommands: number) =>
    st(
      {
        activePlayer: "player2",
        player1: { operation: [mirror(stacked)], battle: [inst("SPEC-MIRROR", "u"), inst("TST-UNIT-0", "x")], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], command: releasedCat("WB", enemyCommands, "e"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );

  it("RK-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-176）", () => {
    expectCatalogText("RK-016", TEXT);
    expectOpStats("RK-016", { name: "ミラーワールド", category: "WB", powerCost: 0 });
    expectRarityIn("RK-016", ["MR", "N"]);
  });

  it("RK-016: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-176・R-KW-PERM-01）", () => {
    const s = played(rushBoard({ hand: [inst("RK-016", "mw")], command: releasedCat("WB", 1) }), "RK-016:mw");
    expect(zoneOf(resolveAll(s), "player1", "RK-016:mw")).toBe("operation");
  });

  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: 自軍ラッシュフェイズに、自軍 S ユニットをこれにオモテ向きに重ねられる（候補は場の自軍 S ユニット）（出典: atwiki/page-176「自軍ラッシュフェイズに自軍Sユニットをこれにオモテ向きに重ねてもよい」）", () => {
    let s = rushBoard({ operation: [mirror([])], rush: [inst("SPEC-MIRROR", "a"), inst("SPEC-MALE-M", "m")], hand: [inst("SPEC-MIRROR", "h")] });
    expect(canActivateResident(s, "RK-016:mw")).toBe(true);
    s = act(s, { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RK-016:mw" });
    expect(choiceIds(s)).toEqual(["SPEC-MIRROR:a"]);
    s = resolveAll(pick(s, "SPEC-MIRROR:a"));
    expect(zoneOf(s, "player1", "SPEC-MIRROR:a")).toBeNull();
    const stacked = s.players.player1.operation[0]?.stackedCards ?? [];
    expect(stacked.map((c) => c.instanceId)).toEqual(["SPEC-MIRROR:a"]);
    expect(stacked[0]?.faceDown ?? false).toBe(false);
  });

  it("RK-016: 自軍バトルフェイズには重ねられない（出典: atwiki/page-176「自軍ラッシュフェイズに」）", () => {
    const s = st({ phase: "battle", player1: { operation: [mirror([])], rush: [inst("SPEC-MIRROR", "a")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, EXTRA);
    expect(canActivateResident(s, "RK-016:mw")).toBe(false);
  });

  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: 重ねたカードと同名の自軍ユニットにアタックするには、相手は自分自身のコマンドを3つ（選ぶ1つ＋さらに2つ）ホールドしなければならない（出典: atwiki/page-176「アタックするには、さらに2つホールドしなければならない」）", () => {
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk")], 2), "SPEC-MIRROR:u")).toEqual([]);
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk")], 3), "SPEC-MIRROR:u")).toEqual(["TST-UNIT-7:atk"]);
  });

  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: アタックすると、相手のコマンドが3つホールドされる（出典: atwiki/page-176）", () => {
    let s = defended([inst("SPEC-MIRROR", "stk")], 4);
    s = settle(attack(s, "TST-UNIT-7:atk", "SPEC-MIRROR:u", "player2"));
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(3);
  });

  it("RK-016: 重ねたカードと名前の違う自軍ユニットはコマンドなしでアタックされる（出典: atwiki/page-176「これに重ねたカードと同じカード名の自軍ユニットは」）", () => {
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk")], 0), "TST-UNIT-0:x")).toEqual(["TST-UNIT-7:atk"]);
  });

  // faq-rider-1 RK-016 Q3「はい、重複します。」・Q5「アタックを選択すること自体ができません」
  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: 公式Q&A — 同名のカードを2枚重ねると重複し、アタックには6つのホールドが必要なのでアタックできない（出典: grnrngr/faq-rider-1 RK-016 Q3・atwiki/page-176 Q3・Q5）", () => {
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk"), inst("SPEC-MIRROR", "stk2")], 5), "SPEC-MIRROR:u")).toEqual([]);
  });

  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: 相手の効果で選ぶには、相手は自分自身のコマンドを1つホールドしなければならない — 音撃で選ぶとき（出典: atwiki/page-176「相手は自分自身のコマンドを1つホールドしなければ、このユニットを選べない」・grnrngr/faq-rider-1 RS-288 Q）", () => {
    // 自軍（player1）が音撃（RK-019）を使う。敵軍（player2）のミラーワールドに SPEC-MIRROR を重ねている。
    const base = (cmd: number) =>
      played(
        st(
          {
            phase: "rush",
            player1: { hand: [inst("RK-019", "og")], command: releasedCat("MA", 1 + cmd), power: powerCards(4), deck: deckCards(5) },
            player2: { operation: [mirror([inst("SPEC-MIRROR", "stk")])], battle: [inst("SPEC-MIRROR", "u"), inst("TST-UNIT-0", "x")], deck: deckCards(5, "e") },
          },
          EXTRA,
        ),
        "RK-019:og",
      );
    expect(choiceIds(base(0))).toEqual(["TST-UNIT-0:x"]);
    let s = base(1);
    expect(choiceIds(s)).toEqual(["SPEC-MIRROR:u", "TST-UNIT-0:x"]);
    s = resolveAll(pick(s, "SPEC-MIRROR:u"));
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: 常駐置き場を離れるとき、重ねたカードはすべて手札に加える（新しい常駐の配置で捨札になるとき）（出典: atwiki/page-176「これが常駐置き場を離れるとき、重ねたカードはすべて手札に加える」・R-KW-PERM-01）", () => {
    let s = rushBoard({ operation: [mirror([inst("SPEC-MIRROR", "stk")])], hand: [inst("RK-014", "kd")], command: releasedCat("MA", 1), power: powerCards(2) });
    s = resolveAll(played(s, "RK-014:kd"));
    expect(zoneOf(s, "player1", "RK-016:mw")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-MIRROR:stk")).toBe("hand");
  });

  // faq-rider-1 RK-016 Q4「はい、その通りです。常駐置き場を離れた時点で、常駐オペレーションはその効果を失います。」
  it("RK-016: 公式Q&A — 常駐置き場を離れた後は、同名のユニットは能力を失う（出典: grnrngr/faq-rider-1 RK-016 Q4・atwiki/page-176 Q4）", () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("SPEC-MIRROR", "u")], discard: [inst("RK-016", "mw")], hand: [inst("SPEC-MIRROR", "stk")], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    expect(attackersOf(s, "SPEC-MIRROR:u")).toEqual(["TST-UNIT-7:atk"]);
  });

  // faq-rider-1 RK-016 Q2・RK-013 Q3「はい、有効なまま継続します。」
  // 既知の不具合: CARD-RK-016 ラッシュフェイズの重ね・アタックに必要なホールド・効果で選ぶときのホールド・離れるときの手札加えが未実装
  it.fails("RK-016: 公式Q&A — 同名の S ユニットが J パワーで L ユニットになっても、能力は続く（出典: grnrngr/faq-rider-1 RK-016 Q2・RK-013 Q3）", () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { operation: [mirror([inst("SPEC-MIRROR", "stk")])], battle: [{ ...inst("SPEC-MIRROR", "u"), stackedCards: [inst("RK-013", "jp")] }], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], command: releasedCat("WB", 2, "e"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    expect(attackersOf(s, "SPEC-MIRROR:u")).toEqual([]);
  });

  it.todo(
    "RK-016: 公式Q&A — ギンガベリック等でコマンドのホールドを代替できればアタックできる（出典: atwiki/page-176 Q5）— RS-469 ギンガベリックの代替手順が本範囲外のため",
  );
});

// ===========================================================================
describe("RK-017 ミッションメモリー", () => {
  const TEXT =
    "ＲＣを持つ自軍Sユニットを1体選ぶ。選んだユニットは、このターン、バトルエリアに出たとき、ライドオフしなくてもその効果を発動できる。その後、このカードを自軍コマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  /** 自軍ラッシュフェイズ。ラッシュエリアに仮面ライダー2号（RK-073・RC【力の2号】このターン BP+2000）。 */
  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushBoard({ hand: [inst("RK-017", "mm")], rush: [inst("RK-073", "n2"), inst("SPEC-MALE-M", "m")], command: releasedCat("ET", 1), power: powerCards(2), ...p1 });
  const memorized = (p1: Partial<GameState["players"]["player1"]> = {}) => resolveAll(played(board(p1), "RK-017:mm"), ["RK-073:n2"]);

  it("RK-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-197）", () => {
    expectCatalogText("RK-017", TEXT);
    expectOpStats("RK-017", { name: "ミッションメモリー", category: "ET", powerCost: 2 });
    expectRarityIn("RK-017", ["MR", "N"]);
  });

  // 既知の不具合: CARD-RK-017 RC を持つユニットの選択・コマンドゾーンへの配置・ライドオフしない RC の発動が未実装
  it.fails("RK-017: 選べるのは RC を持つ自軍 S ユニットだけ（出典: atwiki/page-197「ＲＣを持つ自軍Sユニットを1体選ぶ」）", () => {
    const s = played(board({ rush: [inst("RK-073", "n2"), inst("SPEC-MALE", "x"), inst("SPEC-MALE-M", "m")] }), "RK-017:mm");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-017");
    expect(choiceIds(s)).toEqual(["RK-073:n2"]);
  });

  // 既知の不具合: CARD-RK-017 RC を持つユニットの選択・コマンドゾーンへの配置・ライドオフしない RC の発動が未実装
  it.fails("RK-017: その後、このカードは自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-197「その後、このカードを自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = memorized();
    expect(zoneOf(s, "player1", "RK-017:mm")).toBe("command");
    expect(cardIn(s, "player1", "RK-017:mm")?.commandHeld).toBe(true);
  });

  it("RK-017: コマンドゾーンに置けなければ捨札にする（出典: atwiki/page-197「置けなければ捨札にする」）", () => {
    const s = memorized({ command: [...releasedCat("ET", 1), ...releasedCat("WB", 4)] });
    expect(zoneOf(s, "player1", "RK-017:mm")).toBe("discard");
  });

  // faq-rider-1 RK-017 Q6「はい、できます。」・Q2（「その後」は直前の操作が実行できたかどうかに関わらず実行する）
  // 既知の不具合: CARD-RK-017 RC を持つユニットの選択・コマンドゾーンへの配置・ライドオフしない RC の発動が未実装
  it.fails("RK-017: 公式Q&A — RC を持つユニットを選べなくても使え、コマンドゾーンに置く（出典: grnrngr/faq-rider-1 RK-017 Q2・Q6・atwiki/page-197 Q2・Q6）", () => {
    const s = resolveAll(played(board({ rush: [inst("SPEC-MALE", "x")] }), "RK-017:mm"));
    expect(zoneOf(s, "player1", "RK-017:mm")).toBe("command");
  });

  // faq-rider-1 RK-017 Q5「はい、発動します。」
  // 既知の不具合: CARD-RK-017 RC を持つユニットの選択・コマンドゾーンへの配置・ライドオフしない RC の発動が未実装
  it.fails("RK-017: 公式Q&A — 選んだユニットはビークルにライドしないでバトルエリアに出ても RC の効果を発動する（仮面ライダー2号 BP7000）（出典: grnrngr/faq-rider-1 RK-017 Q5・atwiki/page-197 Q5）", () => {
    let s = nextPhase(memorized());
    s = enter(s, "RK-073:n2");
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(7000);
  });

  it("RK-017: 使っていなければ、ライドしないで出ても RC の効果は発動しない（出典: atwiki/page-197「ライドオフしなくても」・R-RC（RC はライドオフしたときに発動））", () => {
    let s = nextPhase(rushBoard({ rush: [inst("RK-073", "n2")] }));
    s = enter(s, "RK-073:n2");
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(5000);
  });

  // faq-rider-1 RK-017 Q3・Q4「いいえ、できません。」
  // 既知の不具合: CARD-RK-017 RC を持つユニットの選択・コマンドゾーンへの配置・ライドオフしない RC の発動が未実装
  it.fails("RK-017: 公式Q&A — ライドしたまま RC の効果を発動したら、その後ライドオフして2重に発動できない（BP9000 にはならない）（出典: grnrngr/faq-rider-1 RK-017 Q3・Q4・atwiki/page-197 Q3・Q4）", () => {
    let s = nextPhase(memorized({ rush: [inst("RK-073", "n2"), inst("SPEC-VEHICLE", "v")] }));
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-073:n2", vehicleInstanceId: "SPEC-VEHICLE:v" });
    const stay = legal(s).find((a) => a.type === "resolve_ride_off_choice" && a.rideOff === false);
    if (stay) s = act(s, stay);
    s = resolveAll(s);
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(7000);
    expect(legal(s).some((a) => a.type === "resolve_ride_off_choice" && a.rideOff === true)).toBe(false);
  });

  it("RK-017: 使ったカードは「このターン」だけ — 選んでいないユニットはライドしないで出ても RC を発動しない（出典: atwiki/page-197「選んだユニットは、このターン、」）", () => {
    let s = nextPhase(memorized({ rush: [inst("RK-073", "n2"), inst("RK-073", "other")] }));
    s = enter(s, "RK-073:other");
    expect(bpOf(s, "player1", "RK-073:other")).toBe(5000);
  });

  it.todo(
    "RK-017: 公式Q&A — コマンドゾーンに置くタイミングは「予約」の解決直後で、RC の効果の発動後ではない（出典: grnrngr/faq-rider-1 RK-017 Q1・atwiki/page-197 Q1）— 置いたタイミングの違いを公開 API で観測できる状況（ラッシュフェイズ中にコマンドゾーンの枚数を参照する効果等）が本範囲にないため",
  );
});

// ===========================================================================
describe("RK-018 ラウズカード", () => {
  const TEXT =
    "自軍ラッシュエリアからSユニットを1体選ぶ。そして自軍捨札からSユニットのカードを1枚選ぶ。そうしたとき、このターン、ラッシュエリアから選んだSユニットのBPに、捨札から選んだユニットカードのBPを「＋」する。";

  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushBoard({
      hand: [inst("RK-018", "rc")],
      rush: [inst("TST-UNIT-0", "u"), inst("SPEC-MALE-M", "m")],
      battle: [inst("TST-UNIT-0", "b")],
      discard: [inst("SPEC-S5000", "d5"), inst("SPEC-M5000", "dm")],
      command: releasedCat("WB", 1),
      power: powerCards(2),
      ...p1,
    });

  it("RK-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-177）", () => {
    expectCatalogText("RK-018", TEXT);
    expectOpStats("RK-018", { name: "ラウズカード", category: "WB", powerCost: 2 });
    expectRarityIn("RK-018", ["MR", "N"]);
  });

  it("RK-018: まず自軍ラッシュエリアの S ユニットを選ぶ（バトルエリア・M ユニットは選べない）（出典: atwiki/page-177「自軍ラッシュエリアからSユニットを1体選ぶ」）", () => {
    const s = played(board(), "RK-018:rc");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-018");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
  });

  // 既知の不具合: CARD-RK-018 捨札の S ユニットのカードの選択と BP の加算が未実装
  it.fails("RK-018: 続けて自軍捨札の S ユニットのカードを選ぶ（M ユニットのカードは選べない）（出典: atwiki/page-177「自軍捨札からSユニットのカードを1枚選ぶ」）", () => {
    const s = pick(played(board(), "RK-018:rc"), "TST-UNIT-0:u");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-018");
    expect(choiceIds(s)).toEqual(["SPEC-S5000:d5"]);
  });

  // 既知の不具合: CARD-RK-018 捨札の S ユニットのカードの選択と BP の加算が未実装
  it.fails("RK-018: このターン、ラッシュエリアから選んだユニットの BP に、捨札から選んだカードの BP を＋する（1000＋5000＝6000）（出典: atwiki/page-177）", () => {
    const s = resolveAll(pick(pick(played(board(), "RK-018:rc"), "TST-UNIT-0:u"), "SPEC-S5000:d5"));
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(6000);
    expect(zoneOf(s, "player1", "SPEC-S5000:d5")).toBe("discard");
  });

  // 既知の不具合: CARD-RK-018 捨札の S ユニットのカードの選択と BP の加算が未実装
  it.fails("RK-018: バトルエリアに出ても、このターンは BP が上がったまま（出典: atwiki/page-177「このターン、」）", () => {
    let s = resolveAll(pick(pick(played(board({ battle: [] }), "RK-018:rc"), "TST-UNIT-0:u"), "SPEC-S5000:d5"));
    s = enter(nextPhase(s), "TST-UNIT-0:u");
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(6000);
  });

  it("RK-018: 捨札に S ユニットのカードがなければ（「そうしたとき」）BP は変わらない（出典: atwiki/page-177「そうしたとき、」）", () => {
    const s = resolveAll(played(board({ discard: [inst("SPEC-M5000", "dm")] }), "RK-018:rc"), ["TST-UNIT-0:u"]);
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(1000);
  });
});

// ===========================================================================
describe("RK-019 音撃", () => {
  const TEXT =
    "特徴「メカ」を持たない敵軍ユニットを1体選ぶ。そうしたとき、このターン、選んだユニットは「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれているかのように扱う。";

  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushBoard(
      { hand: [inst("RK-019", "og")], command: releasedCat("MA", 1), power: powerCards(4), ...p1 },
      { battle: [inst("TST-UNIT-7", "big"), inst("SPEC-MECHA", "mc")], rush: [inst("TST-UNIT-2", "er")], ...p2 },
    );
  /** 音撃で TST-UNIT-7:big（BP13000）を選び、バトルフェイズに attacker を出してアタックする。 */
  const battleAfter = (attacker: string, choose = true) => {
    const [aid, asuf] = attacker.split(":") as [string, string];
    let s = board({ rush: [inst(aid, asuf)] });
    if (choose) s = resolveAll(played(s, "RK-019:og"), ["TST-UNIT-7:big"]);
    s = enter(nextPhase(s), attacker);
    return resolveAll(attack(s, attacker, "TST-UNIT-7:big"));
  };

  it("RK-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-214）", () => {
    expectCatalogText("RK-019", TEXT);
    expectOpStats("RK-019", { name: "音撃", category: "MA", powerCost: 4 });
    expectRarityIn("RK-019", ["MR", "N"]);
  });

  // 既知の不具合: CARD-RK-019 敵軍ユニットの選択と「バトルに勝っても撃破される」の付与が未実装
  it.fails("RK-019: 選べるのは特徴「メカ」を持たない敵軍ユニット（ラッシュエリアも含む）（出典: atwiki/page-214「特徴「メカ」を持たない敵軍ユニットを1体選ぶ」・R-TGT-01）", () => {
    const s = played(board({ rush: [inst("TST-UNIT-0", "own")] }), "RK-019:og");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-019");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:er", "TST-UNIT-7:big"]);
  });

  // 既知の不具合: CARD-RK-019 敵軍ユニットの選択と「バトルに勝っても撃破される」の付与が未実装
  it.fails("RK-019: このターン、選んだユニットは SP1 以上のユニットとバトルするとバトルに勝っても撃破される（出典: atwiki/page-214）", () => {
    const s = battleAfter("TST-UNIT-0:a");
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
  });

  it("RK-019: SP が空欄のユニットとバトルしたときは撃破されない（出典: atwiki/page-214「SP1以上のユニットとバトルしたとき」）", () => {
    const s = battleAfter("SPEC-NOSP:a");
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("battle");
  });

  it("RK-019: 使っていなければ撃破されない（出典: atwiki/page-214）", () => {
    const s = battleAfter("TST-UNIT-0:a", false);
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("battle");
  });

  it("RK-019: 使ったカードは捨札になる（出典: atwiki/page-214（常駐ではない））", () => {
    const s = resolveAll(played(board(), "RK-019:og"), ["TST-UNIT-7:big"]);
    expect(zoneOf(s, "player1", "RK-019:og")).toBe("discard");
  });

  it.todo(
    "RK-019: 選んだユニットにとっての「敵軍ターン中」は使ったプレイヤーのターンで、次の（選んだユニットの持ち主の）ターンには効果が残らない（出典: atwiki/page-214「このターン、」）— 使用できるのは自軍ターンだけで、持ち主のターンまで効果が続く状況が作れないため観測できない",
  );
  it.todo(
    "RK-019: 公式Q&A（相互参照）— 鋭鬼の【音撃打・必殺必中】で、音撃を受けたサンジェルを撃破できる（出典: grnrngr/faq-card-6 RS-408）— RK-051 仮面ライダー鋭鬼が本範囲外のため（RS6-390-410.c の todo と同じ）",
  );
});

// ===========================================================================
describe("RK-020 ダブルライダーキック", () => {
  const TEXT =
    "自軍ラッシュエリアから特徴「仮面ライダー」を持つ自軍ユニットを2体選ぶ。このターン、選んだ2体のユニットが自軍バトルエリアで隣り合ったとき、敵軍バトルエリアからBP8000以下の敵軍ユニットを1体選び撃破する。";

  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushBoard(
      {
        hand: [inst("RK-020", "wk")],
        rush: [inst("SPEC-RIDER-B", "a"), inst("SPEC-RIDER-M", "b"), inst("SPEC-MALE", "x"), inst("TST-UNIT-0", "f")],
        battle: [inst("SPEC-RIDER-B", "inb")],
        command: releasedCat("ET", 1),
        power: powerCards(6),
        ...p1,
      },
      { battle: [inst("SPEC-E8000", "e8"), inst("SPEC-E8500", "e85")], rush: [inst("TST-UNIT-0", "er")], ...p2 },
    );
  const kicked = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    nextPhase(resolveAll(pickAll(played(board({ battle: [], ...p1 }), "RK-020:wk"), ["SPEC-RIDER-B:a", "SPEC-RIDER-M:b"])));

  it("RK-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-199）", () => {
    expectCatalogText("RK-020", TEXT);
    expectOpStats("RK-020", { name: "ダブルライダーキック", category: "ET", powerCost: 6 });
    expectRarityIn("RK-020", ["MR"]);
  });

  // 既知の不具合: CARD-RK-020 自軍ラッシュエリアの「仮面ライダー」2体を選ばず、使った時点で敵軍ユニットの撃破の選択が開く
  it.fails("RK-020: 選べるのは自軍ラッシュエリアの特徴「仮面ライダー」の自軍ユニット（サイズは問わない・バトルエリアは選べない）（出典: atwiki/page-199「自軍ラッシュエリアから特徴「仮面ライダー」を持つ自軍ユニットを2体選ぶ」）", () => {
    const s = played(board(), "RK-020:wk");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-020");
    expect(choiceIds(s)).toEqual(["SPEC-RIDER-B:a", "SPEC-RIDER-M:b"]);
  });

  // 既知の不具合: CARD-RK-020 自軍ラッシュエリアの「仮面ライダー」2体を選ばず、使った時点で敵軍ユニットの撃破の選択が開く
  it.fails("RK-020: 使っただけでは何も撃破しない（出典: atwiki/page-199「選んだ2体のユニットが自軍バトルエリアで隣り合ったとき」）", () => {
    const s = kicked();
    expect(zoneOf(s, "player2", "SPEC-E8000:e8")).toBe("battle");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // 既知の不具合: CARD-RK-020 自軍ラッシュエリアの「仮面ライダー」2体を選ばず、使った時点で敵軍ユニットの撃破の選択が開く
  it.fails("RK-020: 選んだ2体が自軍バトルエリアで隣り合ったとき、敵軍バトルエリアの BP8000 以下の敵軍ユニットを1体選ぶ（ラッシュエリア・BP8500 は選べない。見送れない）（出典: atwiki/page-199）", () => {
    let s = kicked();
    s = enter(passEntry(enter(s, "SPEC-RIDER-B:a")), "SPEC-RIDER-M:b");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-020");
    expect(choiceIds(s)).toEqual(["SPEC-E8000:e8"]);
    expect(canSkip(s)).toBe(false);
  });

  // 既知の不具合: CARD-RK-020 自軍ラッシュエリアの「仮面ライダー」2体を選ばず、使った時点で敵軍ユニットの撃破の選択が開く
  it.fails("RK-020: 選んだユニットを撃破する（出典: atwiki/page-199「1体選び撃破する」）", () => {
    let s = kicked();
    s = enter(passEntry(enter(s, "SPEC-RIDER-B:a")), "SPEC-RIDER-M:b");
    s = resolveAll(pick(s, "SPEC-E8000:e8"));
    expect(zoneOf(s, "player2", "SPEC-E8000:e8")).toBe("discard");
  });

  // 既知の不具合: CARD-RK-020 自軍ラッシュエリアの「仮面ライダー」2体を選ばず、使った時点で敵軍ユニットの撃破の選択が開く
  it.fails("RK-020: 間に別のユニットがあって隣り合わなければ発動しない（出典: atwiki/page-199「隣り合ったとき」）", () => {
    let s = kicked();
    s = enter(passEntry(enter(passEntry(enter(s, "SPEC-RIDER-B:a")), "TST-UNIT-0:f")), "SPEC-RIDER-M:b");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-020");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-E8000:e8")).toBe("battle");
  });

  // 既知の不具合: CARD-RK-020 自軍ラッシュエリアの「仮面ライダー」2体を選ばず、使った時点で敵軍ユニットの撃破の選択が開く
  it.fails("RK-020: 選んでいない「仮面ライダー」のユニットと隣り合っても発動しない（出典: atwiki/page-199「選んだ2体のユニットが」）", () => {
    let s = kicked({ rush: [inst("SPEC-RIDER-B", "a"), inst("SPEC-RIDER-M", "b"), inst("SPEC-RIDER-B", "c")] });
    s = enter(passEntry(enter(s, "SPEC-RIDER-B:a")), "SPEC-RIDER-B:c");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-020");
  });

  it.todo(
    "RK-020: atwiki カード評価 — 「このターン」なので、ファイズAF の能力で何度もバトルエリアに出れば、その都度発動する（出典: atwiki/page-199 カード評価）— 公式回答ではなく、RK-062 等の再進入手順も本範囲外のため",
  );
  it.todo(
    "RK-020: 自軍ラッシュエリアに「仮面ライダー」のユニットが1体以下のとき使えるか（出典: atwiki/page-199「2体選ぶ」）— 出典に記述がなく、使用の可否と「1体だけ選ぶ」扱いのどちらか確定しないため",
  );
});

// ===========================================================================
describe("RK-021 クロックアップ", () => {
  const TEXT =
    "※常駐 これを配置するとき、自軍山札の上から自軍パワーゾーンのカード枚数と同じ枚数ひいて、これにウラ向きに重ねる。そして、特徴「加速」を持つ自軍ユニットがアタックされるたび、これに重ねたカードを1枚自軍山札の下に戻す。そうしたとき、バトルは行われない。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  const clock = (stacked: number) => ({
    ...inst("RK-021", "cu"),
    stackedCards: Array.from({ length: stacked }, (_, i) => ({ ...inst("TST-OP", `stk${i}`), faceDown: true })),
  });
  /** 敵軍（player2）ターン、player2 の BP13000 のユニットが自軍の defender にアタックする。 */
  const attacked = (defender: string, stacked = 2) => {
    const [did, dsuf] = defender.split(":") as [string, string];
    const s = st(
      {
        activePlayer: "player2",
        player1: { operation: [clock(stacked)], battle: [inst(did, dsuf)], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    return settle(attack(s, "TST-UNIT-7:atk", defender, "player2"));
  };

  it("RK-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-173）", () => {
    expectCatalogText("RK-021", TEXT);
    expectOpStats("RK-021", { name: "クロックアップ", category: "OT", powerCost: 4 });
    expectRarityIn("RK-021", ["MR", "N"]);
  });

  it("RK-021: 配置するとき、自軍パワーゾーンの枚数（4枚）と同じ枚数を山札の上からひいて、ウラ向きに重ねる（出典: atwiki/page-173）", () => {
    const s = resolveAll(played(rushBoard({ hand: [inst("RK-021", "cu")], command: releasedCat("OT", 1), power: powerCards(4), deck: deckCards(6) }), "RK-021:cu"));
    const op = s.players.player1.operation.find((c) => c.instanceId === "RK-021:cu");
    expect((op?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2", "TST-OP:dk3"]);
    expect((op?.stackedCards ?? []).every((c) => c.faceDown)).toBe(true);
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk4", "TST-OP:dk5"]);
  });

  it("RK-021: 特徴「加速」を持つ自軍ユニットがアタックされると、重ねたカードを1枚自軍山札の下に戻し、バトルは行われない（出典: atwiki/page-173「そうしたとき、バトルは行われない」）", () => {
    const s = attacked("SPEC-ACCEL:d");
    expect(zoneOf(s, "player1", "SPEC-ACCEL:d")).toBe("battle");
    expect(s.players.player1.operation[0]?.stackedCards).toHaveLength(1);
    const deck = zoneIds(s, "player1", "deck");
    expect(deck).toHaveLength(4);
    expect(cardIn(s, "player1", deck[deck.length - 1]!)?.faceDown ?? false).toBe(false);
  });

  it("RK-021: 「加速」を持たないユニットがアタックされたときは通常どおりバトルする（出典: atwiki/page-173「特徴「加速」を持つ自軍ユニットが」）", () => {
    const s = attacked("TST-UNIT-0:d");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("discard");
    expect(s.players.player1.operation[0]?.stackedCards).toHaveLength(2);
  });

  // faq-rider-1 RK-021 Q3「そのまま常駐置き場に残ります。ただし、重ねたカードを山札に戻すことができませんので、バトルが行われないという効果は発動しません。」
  it("RK-021: 公式Q&A — 重ねたカードがなければ常駐置き場に残り、バトルは通常どおり行われる（出典: grnrngr/faq-rider-1 RK-021 Q3・atwiki/page-173 Q3）", () => {
    const s = attacked("SPEC-ACCEL:d", 0);
    expect(zoneOf(s, "player1", "SPEC-ACCEL:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-021:cu")).toBe("operation");
  });

  it("RK-021: 常駐置き場を離れるとき、重ねたカードはすべて捨札になる（新しい常駐の配置で捨札になるとき）（出典: atwiki/page-173「これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる」・R-KW-PERM-01）", () => {
    let s = rushBoard({ operation: [clock(2)], hand: [inst("RK-014", "kd")], command: releasedCat("MA", 1), power: powerCards(2) });
    s = resolveAll(played(s, "RK-014:kd"));
    expect(zoneOf(s, "player1", "RK-021:cu")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:stk0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:stk1")).toBe("discard");
  });

  it.todo(
    "RK-021: 公式Q&A — 無限連鎖カードは常駐の効果を無効にするだけで、クロックアップと重ねたカードは常駐置き場に留まる（出典: grnrngr/faq-rider-1 RK-021 Q1・atwiki/page-173 Q1）— RS-072 無限連鎖カードの使用と常駐の無効化の手順は RS 系の担当範囲で、公開 API での組み立てを確認できなかったため",
  );
  it.todo(
    "RK-021: 公式Q&A — 「加速」のユニットがアタックされたとき隠流忍術も使えるが、否定文優先でバトルは行われない（出典: grnrngr/faq-rider-1 RK-021 Q2・atwiki/page-173 Q2・R-PRI-01）— 強制の常駐の処理と隠流忍術の反応ウィンドウの順序を公開 API で観測できないため",
  );
});

