/**
 * cardSpec — 第5弾（RS-243〜RS-305）の監査で見つかった、範囲外カードの不具合の仕様テスト。
 *
 * - RS-527 バルジオン（2nd）: 本来のカテゴリに DA を持つ S ユニットは RC なしでライドでき、それ以外はライドできない
 *   （RS-290 Q3 の前提）。
 * - RS-141 紐男爵【紐拳】: 敵軍ラッシュエリアの L ユニットもバトルエリアに出せる（RS-287 の「自軍ターン中」の前提）。
 * - RS-639 ネジイエロー【ネジスリング】・RS-368 レッドマスク【ゴッドハンド】: 条件に合う敵軍 S ユニットを
 *   持ち主のパワーゾーンにダメージ（ウラ向き）にして置いてもよい。
 * - RS-353 デンジファイター・RS-264 ジェットデルタ: 追加条件（S ユニットを捨札／パワーゾーンに送る）つきで手札から
 *   ラッシュを始める合法手が出る（RS-296 / RS-353 Q の前提）。
 * - RK-022 ライダーパス: 自軍ラッシュフェイズに重ねたカードと「DEN-O」の自軍ユニットを置き換える合法手（RS-299 Q の前提）。
 *
 * 出典: docs/wiki/sources/atwiki/page-1156-RS-527.md・page-474-RS-290.md Q3・page-336-RS-141.md・page-417-RS-287.md・
 * page-1439-RS-639.md・page-569-RS-368.md・page-551-RS-353.md・page-454-RS-264.md・page-128-RK-022.md（Q2/Q3/Q6）、
 * grnrngr/faq-rider-1 RK-022。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  fillers,
  inst,
  legal,
  pick,
  powerCards,
  releasedN,
  rushFromHand,
  skip,
  st,
  sUnit,
  zoneOf,
} from "./RS5-285-305.helpers";
import { wasRushedThisTurn } from "../rules/turnModifiers";
import type { GameState } from "../types/game";

describe("RS-527 バルジオン（2nd）", () => {
  const RC_ET = sUnit("SPEC-RC-ET", { category: "ET", comboNumber: "RC" as never });

  function rideState(rider: string): GameState {
    return st({ player1: { rush: [inst(rider, "s"), inst("RS-527", "bj")] } }, [RC_ET]);
  }
  const canRide = (s: GameState, rider: string) =>
    legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === "RS-527:bj");

  it("RS-527: ※ 本来のカテゴリに DA を持つ S ユニット（バイオハンター・シルバ）は RC なしでライドしてバトルエリアに出られる（出典: atwiki/page-1156・page-474 Q3）", () => {
    const s = rideState("RS-079");
    expect(canRide(s, "RS-079:s")).toBe(true);
    const ride = legal(s).find((a) => a.type === "mount_ride" && a.riderInstanceId === "RS-079:s")!;
    const after = act(s, ride);
    expect(zoneOf(after, "player1", "RS-079:s")).toBe("battle");
  });

  it("RS-527: ※ それ以外のユニットは RC を持っていてもライドできない（出典: atwiki/page-1156「それ以外のユニットはライドできない」）", () => {
    expect(canRide(rideState("SPEC-RC-ET"), "SPEC-RC-ET:s")).toBe(false);
  });
});

describe("RS-141 紐男爵【紐拳】", () => {
  it("RS-141: 敵軍ラッシュエリアの L ユニット（剛龍神）も選んでバトルエリアに出す（出典: atwiki/page-336「敵軍ラッシュエリアのユニットを1体選んで、可能ならバトルエリアに出す」）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-141", "himo")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "b")], rush: [inst("RS-287", "g")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-141:himo");
    s = pick(s, "TST-UNIT-0:b");
    expect(choiceIds(s)).toContain("RS-287:g");
    s = pick(s, "RS-287:g");
    expect(zoneOf(s, "player2", "RS-287:g")).toBe("battle");
  });
});

const YELLOW = sUnit("SPEC-YELLOW", { bp: 2000, features: ["イエロー"] });
const BP4000 = sUnit("SPEC-B4000", { bp: 4000 });
const BP3000 = sUnit("SPEC-B3000", { bp: 3000 });

function ncEnter(cardId: string, position: number): GameState {
  const s = st(
    {
      turn: 3,
      player1: { battle: fillers(position - 1), rush: [inst(cardId, "x")], deck: deckCards(3) },
      player2: {
        battle: [inst("SPEC-YELLOW", "y"), inst("SPEC-B4000", "b4"), inst("SPEC-B3000", "b3")],
        deck: deckCards(3, "e"),
      },
    },
    [YELLOW, BP4000, BP3000],
  );
  return enter(s, `${cardId}:x`);
}

describe("RS-639 ネジイエロー【ネジスリング】", () => {
  it("RS-639: NC（5番目）で特徴「イエロー」の敵軍 S ユニットだけを選べ、持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1439）", () => {
    let s = ncEnter("RS-639", 5);
    expect(choiceIds(s)).toEqual(["SPEC-YELLOW:y"]);
    s = pick(s, "SPEC-YELLOW:y");
    expect(zoneOf(s, "player2", "SPEC-YELLOW:y")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-YELLOW:y")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-639: 置かないことを選べる（出典: atwiki/page-1439「置いてもよい」）", () => {
    const s0 = ncEnter("RS-639", 5);
    expect(canSkip(s0)).toBe(true);
    const s = skip(s0);
    expect(zoneOf(s, "player2", "SPEC-YELLOW:y")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });
});

describe("RS-368 レッドマスク【ゴッドハンド】", () => {
  it("RS-368: NC（4番目）で BP4000 の敵軍 S ユニットだけを選べ、持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-569）", () => {
    let s = ncEnter("RS-368", 4);
    expect(choiceIds(s)).toEqual(["SPEC-B4000:b4"]);
    s = pick(s, "SPEC-B4000:b4");
    expect(zoneOf(s, "player2", "SPEC-B4000:b4")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-B4000:b4")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-368: 置かないことを選べる（出典: atwiki/page-569「置いてもよい」）", () => {
    const s0 = ncEnter("RS-368", 4);
    expect(canSkip(s0)).toBe(true);
    expect(zoneOf(skip(s0), "player2", "SPEC-B4000:b4")).toBe("battle");
  });

  it("RS-368: NC 不成立（3番目）では発動しない（出典: atwiki/page-569「CN：4」・R-CN-02）", () => {
    const s = ncEnter("RS-368", 3);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-368");
    expect(zoneOf(s, "player2", "SPEC-B4000:b4")).toBe("battle");
  });
});

describe("追加条件つきユニットのラッシュの合法手（RS-353 / RS-264）", () => {
  it("RS-353: 自軍 S ユニット5体を捨札にしてデンジファイターをラッシュできる（出典: atwiki/page-551「追加条件：自軍Sユニットを5体捨札にする」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-353", "df")], rush: fillers(5), power: powerCards(5), command: releasedN(1, "TST-OP-OT"), deck: deckCards(5) },
    });
    expect(legal(s).some((a) => a.type === "begin_zord_setup" && a.zordInstanceId === "RS-353:df")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-353:df");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-353:df")).toBe("rush");
    for (let i = 0; i < 5; i += 1) expect(zoneOf(r.state, "player1", `TST-UNIT-0:fill${i}`)).toBe("discard");
  });

  it("RS-264: 自軍 S ユニット2体をパワーゾーンに送ってジェットデルタをラッシュできる（出典: atwiki/page-454「追加条件：自軍Sユニットを2体パワーゾーンに送る」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-264", "jd")], rush: fillers(2), power: powerCards(4), command: releasedN(1, "TST-OP-OT"), deck: deckCards(5) },
    });
    expect(legal(s).some((a) => a.type === "begin_zord_setup" && a.zordInstanceId === "RS-264:jd")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-264:jd");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-264:jd")).toBe("rush");
  });
});

describe("RK-022 ライダーパス", () => {
  function pass(over: { power?: number; rush?: ReturnType<typeof inst>[]; battle?: ReturnType<typeof inst>[] } = {}): GameState {
    return st({
      phase: "rush",
      player1: {
        rush: over.rush ?? [inst("RK-062", "af")],
        battle: over.battle ?? [],
        operation: [{ ...inst("RK-022", "pass"), stackedCards: [inst("RK-061", "sf")] }],
        power: powerCards(over.power ?? 6),
        deck: deckCards(5),
      },
    });
  }
  const activate = (s: GameState) => legal(s).find((a) => a.type === "activate_resident_operation" && a.operationInstanceId === "RK-022:pass");

  it("RK-022: 自軍ラッシュフェイズに重ねたカードと「DEN-O」の自軍ユニットを置き換え、エリアに出たカードはラッシュしたことになる（出典: atwiki/page-128・Q3）", () => {
    let s = act(pass(), activate(pass())!);
    expect(choiceIds(s)).toEqual(["RK-061:sf"]);
    expect(canSkip(s)).toBe(true);
    s = pick(s, "RK-061:sf");
    expect(choiceIds(s)).toEqual(["RK-062:af"]);
    s = pick(s, "RK-062:af");
    expect(zoneOf(s, "player1", "RK-061:sf")).toBe("rush");
    expect(s.players.player1.operation[0]?.stackedCards?.map((c) => c.instanceId)).toEqual(["RK-062:af"]);
    expect(wasRushedThisTurn(s.players.player1, "RK-061:sf")).toBe(true);
  });

  it("RK-022: 置き換えは状態と位置を引き継ぐ（ホールド状態のまま同じ位置）（出典: atwiki/page-128 Q2「文字通り置き換えるだけ」・R-REPL-04）", () => {
    const s0 = pass({ rush: [inst("TST-UNIT-0", "a"), { ...inst("RK-062", "af"), commandHeld: true }, inst("TST-UNIT-0", "b")] });
    let s = act(s0, activate(s0)!);
    s = pick(pick(s, "RK-061:sf"), "RK-062:af");
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual(["TST-UNIT-0:a", "RK-061:sf", "TST-UNIT-0:b"]);
    expect(s.players.player1.rush[1]?.commandHeld).toBe(true);
  });

  it("RK-022: ラッシュフェイズ中なら何度でも置き換えられる（出典: atwiki/page-128 Q6）", () => {
    let s = act(pass(), activate(pass())!);
    s = pick(pick(s, "RK-061:sf"), "RK-062:af");
    expect(activate(s)).toBeDefined();
  });

  it("RK-022: 必要パワーを満たさないカードとは置き換えられない（出典: atwiki/page-128「必要パワーと追加条件は満たすこと」）", () => {
    expect(activate(pass({ power: 2 }))).toBeUndefined(); // RK-061 電王RF は必要パワー3
  });

  it("RK-022: 「DEN-O」を持つ自軍ユニットがなければ使えない（出典: atwiki/page-128「本来の特徴に「DEN-O」を持つ自軍ユニット」）", () => {
    expect(activate(pass({ rush: [inst("TST-UNIT-0", "a")] }))).toBeUndefined();
  });
});
