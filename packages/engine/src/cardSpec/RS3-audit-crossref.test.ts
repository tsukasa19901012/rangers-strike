/**
 * cardSpec — 第3弾（RS-123〜RS-178）の監査で見つかった、範囲外カードの不具合の仕様テスト。
 *
 * - RS-277 ガロア艦長【古傷の因縁】: 敵軍コマンドゾーン・敵軍パワーゾーン（ダメージ以外）のカードを選べる。
 * - RS-241 ボウケンレッドAT: 撃破されて捨札になったとき、捨札のボウケンレッドをラッシュエリアに出す。
 * - RS-258 アオレンジャー【ブルーチェリー】: 選べるのはホールド状態の敵軍コマンドだけで、持ち主のパワーゾーンに送る（任意）。
 *
 * 出典: docs/wiki/sources/atwiki/page-438-RS-277.md・page-29-RS-241.md・page-459-RS-258.md、
 * grnrngr/faq-card-3 RS-124 Q2、grnrngr/faq-card-4 RS-241。
 */
import { describe, expect, it } from "vitest";
import {
  attack,
  canSkip,
  choiceIds,
  drain,
  enter,
  fillers,
  held,
  inst,
  pick,
  powerCards,
  released,
  settle,
  skip,
  sUnit,
  st,
  zoneOf,
} from "./RS3-123-150.helpers";

describe("RS-277 ガロア艦長【古傷の因縁】", () => {
  const RED = sUnit("SPEC-RED", { features: ["レッド"] });
  const RED2 = sUnit("SPEC-RED2", { features: ["レッド"] });
  const BLUE = sUnit("SPEC-BLUE", { features: ["ブルー"] });

  function garoa() {
    const s = st(
      {
        player1: { rush: [inst("RS-277", "garoa")] },
        player2: {
          command: [released("SPEC-RED", "red"), held("SPEC-BLUE", "blue")],
          power: [inst("SPEC-RED2", "pwred"), { ...inst("SPEC-RED2", "dmg"), faceDown: true }, ...powerCards(1, "ep")],
        },
      },
      [RED, RED2, BLUE],
    );
    return enter(s, "RS-277:garoa");
  }

  it("RS-277: 敵軍コマンドゾーンと敵軍パワーゾーン（ダメージ以外）の「レッド」のユニットカードを選べる（出典: atwiki/page-438「敵軍コマンドゾーンか、敵軍パワーゾーンのダメージ以外のカードに」）", () => {
    const s = garoa();
    expect(choiceIds(s)).toEqual(["SPEC-RED2:pwred", "SPEC-RED:red"]);
  });

  it("RS-277: 敵軍コマンドゾーンのカードを選ぶと敵軍ラッシュエリアに出る（出典: atwiki/page-438「敵軍ラッシュエリアに出してもよい」・grnrngr/faq-card-3 RS-124 Q2）", () => {
    const s = settle(pick(garoa(), "SPEC-RED:red"));
    expect(zoneOf(s, "player2", "SPEC-RED:red")).toBe("rush");
  });

  it("RS-277: 敵軍パワーゾーンのオモテ向きのカードも選んで出せる（出典: atwiki/page-438）", () => {
    const s = settle(pick(garoa(), "SPEC-RED2:pwred"));
    expect(zoneOf(s, "player2", "SPEC-RED2:pwred")).toBe("rush");
  });

  it("RS-277: 出さないことを選べる（任意）（出典: atwiki/page-438「出してもよい」）", () => {
    const s0 = garoa();
    expect(canSkip(s0)).toBe(true);
    const s = skip(s0);
    expect(zoneOf(s, "player2", "SPEC-RED:red")).toBe("command");
  });
});

describe("RS-241 ボウケンレッドAT", () => {
  it("RS-241: 撃破されて捨札になったとき、自軍捨札のボウケンレッドを自軍ラッシュエリアに出す（出典: atwiki/page-29「自軍捨札に「ボウケンレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す」・grnrngr/faq-card-4 RS-241）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "big")] },
      player2: {
        battle: [inst("RS-241", "at")],
        discard: [inst("TST-UNIT-0", "other"), inst("RS-062", "bk")],
      },
    });
    s = attack(s, "TST-UNIT-7:big", "RS-241:at");
    for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player2"), "player1"));
    expect(zoneOf(s, "player2", "RS-241:at")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-062:bk")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:other")).toBe("discard");
  });

  it("RS-241: 捨札にボウケンレッドがなければ何も出さない（出典: atwiki/page-29「カードがあれば」）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "big")] },
      player2: { battle: [inst("RS-241", "at")], discard: [inst("TST-UNIT-0", "other")] },
    });
    s = attack(s, "TST-UNIT-7:big", "RS-241:at");
    for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player2"), "player1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:other")).toBe("discard");
    expect(s.players.player2.rush).toHaveLength(0);
  });
});

describe("RS-258 アオレンジャー【ブルーチェリー】", () => {
  function aoNc() {
    const s = st({
      player1: { rush: [inst("RS-258", "ao")], battle: fillers(3) },
      player2: { command: [held("TST-OP", "h"), released("TST-OP", "r")] },
    });
    return enter(s, "RS-258:ao");
  }

  it("RS-258: 選べるのはホールド状態の敵軍コマンドだけ（出典: atwiki/page-459「敵軍コマンドゾーンからホールド状態のカードを1枚選び」）", () => {
    expect(choiceIds(aoNc())).toEqual(["TST-OP:h"]);
  });

  it("RS-258: 選んだカードは持ち主（相手）のパワーゾーンに送る（出典: atwiki/page-459「持ち主のパワーゾーンに送って」）", () => {
    const s = pick(aoNc(), "TST-OP:h");
    expect(zoneOf(s, "player2", "TST-OP:h")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP:r")).toBe("command");
  });

  it("RS-258: 送らないことを選べる（任意）（出典: atwiki/page-459「送ってもよい」）", () => {
    const s0 = aoNc();
    expect(canSkip(s0)).toBe(true);
    const s = skip(s0);
    expect(zoneOf(s, "player2", "TST-OP:h")).toBe("command");
  });

  it("RS-258: ホールド状態の敵軍コマンドがなければ選択は開かない（出典: atwiki/page-459）", () => {
    let s = st({
      player1: { rush: [inst("RS-258", "ao")], battle: fillers(3) },
      player2: { command: [released("TST-OP", "r")] },
    });
    s = enter(s, "RS-258:ao");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-OP:r")).toBe("command");
  });
});
