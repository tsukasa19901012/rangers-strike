/**
 * cardSpec — 第3弾（RS-123〜RS-178）の監査で見つかった、範囲外カードの不具合の仕様テスト。
 *
 * - RS-277 ガロア艦長【古傷の因縁】: 敵軍コマンドゾーン・敵軍パワーゾーン（ダメージ以外）のカードを選べる。
 * - RS-241 ボウケンレッドAT: 撃破されて捨札になったとき、捨札のボウケンレッドをラッシュエリアに出す。
 * - RS-258 アオレンジャー【ブルーチェリー】: 選べるのはホールド状態の敵軍コマンドだけで、持ち主のパワーゾーンに送る（任意）。
 * - RS-259 モモレンジャー【ゴレンジャーハリケーン】・RS-222 タイムピンク【戦闘指揮】・RS-209 ホウオウレンジャー
 *   【天風星・一文字竜巻】・RS-417 冥府神サイクロプス（RS-126 / RS-140 / RS-141 の Q&A で使うカード）。
 *
 * 出典: docs/wiki/sources/atwiki/page-438-RS-277.md・page-29-RS-241.md・page-459-RS-258.md、
 * grnrngr/faq-card-3 RS-124 Q2、grnrngr/faq-card-4 RS-241。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  canSkip,
  canStrike,
  choiceIds,
  drain,
  enter,
  fillers,
  held,
  inst,
  pick,
  passEntry,
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

describe("RS-259 モモレンジャー【ゴレンジャーハリケーン】", () => {
  const E8 = sUnit("SPEC-E8", { bp: 8000 });
  const E9 = sUnit("SPEC-E9", { bp: 9000 });
  function chain(order: string[]) {
    let s = st(
      {
        player1: { rush: order.map((id) => inst(id, id.toLowerCase())) },
        player2: { battle: [inst("SPEC-E8", "e8")], rush: [inst("SPEC-E9", "e9")] },
      },
      [E8, E9],
    );
    for (const id of order) {
      s = settle(drain(enter(s, `${id}:${id.toLowerCase()}`), "player1"));
      if (id !== order.at(-1)) s = passEntry(s);
    }
    return s;
  }

  it("RS-259: モモ→キ→ミド→アオ→アカの順にコンビネーションすると BP8000 以下の敵軍ユニットをすべて撃破し、アカレンジャーは「SP2」（出典: atwiki RS-259「BP8000以下の敵軍ユニットをすべて撃破する。このとき、その「アカレンジャー」は「SP2」になる」）", () => {
    const s = chain(["RS-259", "RS-189", "RS-190", "RS-258", "RS-126"]);
    expect(zoneOf(s, "player2", "SPEC-E8:e8")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E9:e9")).toBe("rush");
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-126:rs-126")?.spOverride).toBe(2);
  });

  it("RS-259: 順番が違えば（キとミドが逆）発動しない（出典: atwiki RS-259「の順にコンビネーションしたとき」）", () => {
    const s = chain(["RS-259", "RS-190", "RS-189", "RS-258", "RS-126"]);
    expect(zoneOf(s, "player2", "SPEC-E8:e8")).toBe("battle");
  });
});

describe("RS-222 タイムピンク【戦闘指揮】", () => {
  // ブルードルフィン（CN2）を6番目（タイムピンクの次）に出す
  function dolphin(heldCount: number) {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-222", "tp"), inst("RS-139", "bd")] },
      player2: { command: Array.from({ length: heldCount }, (_, i) => held("TST-OP", `h${i}`)) },
    });
    s = passEntry(enter(s, "RS-222:tp"));
    return enter(s, "RS-139:bd");
  }

  it("RS-222: タイムピンクからコンビネーションした S ユニットの NC をナンバーに関係なく発動でき、ナンバーと同じ数の敵軍コマンドをリリースする（出典: atwiki RS-222「ナンバーに関係なく発動できる。ただし…リリースしなければならない」）", () => {
    let s = dolphin(3);
    expect(s.pendingEffectChoice?.effectId).toBe("battle_command");
    s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(s.players.player2.command.filter((c) => !c.commandHeld)).toHaveLength(2);
    expect(s.pendingEffectChoice?.effectId).toBe("dolphin_arrow");
  });

  it("RS-222: 発動しないことを選べる（敵軍コマンドはリリースされない）（出典: atwiki RS-222「発動できる」）", () => {
    const s = skip(dolphin(3));
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(s.pendingEffectChoice?.effectId).not.toBe("dolphin_arrow");
  });

  it("RS-222: リリースできる敵軍コマンドがナンバーより少なければ発動できない（出典: atwiki RS-222）", () => {
    const s = dolphin(1);
    expect(s.pendingEffectChoice?.effectId).not.toBe("battle_command");
  });
});

describe("RS-209 ホウオウレンジャー【天風星・一文字竜巻】", () => {
  function houou() {
    const s = st({
      player1: { battle: fillers(2), rush: [inst("RS-209", "hou"), inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")] },
      player2: { rush: [inst("TST-UNIT-0", "e1")], battle: [inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")] },
    });
    return enter(s, "RS-209:hou");
  }

  it("RS-209: 自軍ラッシュエリアの S ユニットを選んで手札に戻すと、相手は同じ数だけ自分の S ユニットを選んで手札に戻す（出典: atwiki RS-209）", () => {
    let s = houou();
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b"]);
    s = pick(s, "TST-UNIT-0:a");
    s = skip(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("hand");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canSkip(s)).toBe(false);
    s = pick(s, "TST-UNIT-0:e2");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("hand");
    expect(s.players.player2.hand).toHaveLength(1);
    expect(canStrike(s, "RS-209:hou")).toBe(true);
  });

  it("RS-209: 戻さないことを選べる（任意）— 相手も戻さない（出典: atwiki RS-209「手札に戻してもよい。そうしたとき」）", () => {
    const s = skip(houou());
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

describe("RS-417 冥府神サイクロプス【消滅の緋色】", () => {
  const E2 = sUnit("SPEC-E2", { bp: 2000 });
  const E9 = sUnit("SPEC-E9", { bp: 9000 });
  function himo() {
    let s = st(
      {
        player1: { battle: fillers(2), rush: [inst("RS-141", "himo"), inst("RS-417", "cy")], operation: [inst("RS-124", "res")] },
        player2: { battle: [inst("SPEC-E2", "small")], rush: [inst("SPEC-E9", "big")] },
      },
      [E2, E9],
    );
    s = enter(s, "RS-141:himo");
    return pick(s, "SPEC-E2:small");
  }

  it("RS-417: 敵軍 S ユニットがバトルエリアからラッシュエリアに戻ったら、常駐カードを捨札にしてそのユニットを撃破できる（出典: atwiki RS-417・grnrngr/faq-card-6 RS-417）", () => {
    let s = himo();
    expect(s.pendingEffectChoice?.effectId).toBe("cyclops_scarlet");
    s = pick(s, "RS-124:res");
    expect(zoneOf(s, "player1", "RS-124:res")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2:small")).toBe("discard");
  });

  it("RS-417: 行わないことを選べる（任意）（出典: atwiki RS-417「捨札にしてもよい」）", () => {
    const s = skip(himo());
    expect(zoneOf(s, "player1", "RS-124:res")).toBe("operation");
    expect(zoneOf(s, "player2", "SPEC-E2:small")).toBe("rush");
  });
});
