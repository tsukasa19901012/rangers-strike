/**
 * docs/rules/08-errata.md §1 公式エラッタページ記載（6件）
 *
 * 出典: docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/errata.html
 *       docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_1.html
 * 期待値はルールブック（08 章）と公式ページに従う。エンジンの現状には合わせない。
 */
import { describe, expect, it } from "vitest";
import { getCardEffect } from "@rangers-strike/cards";
import { moveToBattle } from "../testing/battleEntry";
import {
  act,
  actLegal,
  cardDef,
  expectCorrectedText,
  held,
  inst,
  legal,
  legalOfType,
  powerCards,
  released,
  sUnit,
  specState,
  zoneIds,
} from "./08-helpers";

// ---------------------------------------------------------------------------
describe("R-ERR-RS052 爆竜トリケラトプス", () => {
  // errata.html 正:「【超シールド進化】「ワイルドビースト」の自軍ユニットが撃破されるとき、このユニットをかわりに捨札にしてもよい。」
  it("R-ERR-RS052: 【超シールド進化】の修正後テキスト「このユニットをかわりに捨札に」を持つ（出典: grnrngr/errata RS-052）", () => {
    expectCorrectedText(
      "RS-052",
      "【超シールド進化】「ワイルドビースト」の自軍ユニットが撃破されるとき、このユニットをかわりに捨札にしてもよい。",
    );
  });

  // errata.html 正の1行目:「※これは自軍コマンドを１つホールドしなければバトルエリアに出られない。」
  it("R-ERR-RS052: ※行「自軍コマンドを１つホールドしなければバトルエリアに出られない」を保持する（出典: grnrngr/errata RS-052）", () => {
    expectCorrectedText(
      "RS-052",
      "※これは自軍コマンドを１つホールドしなければバトルエリアに出られない。",
    );
  });

  // 08 章 効果:「ユニットとして場にあるときだけ発動できる」
  it("R-ERR-RS052: バトルエリアのトリケラはWB自軍ユニットの撃破時にかわりに捨札になれる（出典: grnrngr/errata RS-052）", () => {
    const atk = inst("TST-UNIT-7", "atk");
    const wb = inst("TST-UNIT-0", "wb");
    const tri = inst("RS-052", "tri");
    let s = specState(["RS-052"], {
      phase: "battle",
      player1: { battle: [atk] },
      player2: { battle: [wb, tri] },
    });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: atk.instanceId,
      defenderInstanceId: wb.instanceId,
    });
    expect(legalOfType(s, "use_super_shield")).toHaveLength(1);
    s = actLegal(s, (a) => a.type === "use_super_shield");
    expect(zoneIds(s, "player2", "battle")).toContain(wb.instanceId);
    expect(zoneIds(s, "player2", "discard")).toContain(tri.instanceId);
    expect(zoneIds(s, "player2", "discard")).not.toContain(wb.instanceId);
  });

  // card_1.html RS-052:「この効果は「RS-052 爆竜トリケラトプス」がユニットとして場に出ているときにだけ発動できます」
  it("R-ERR-RS052: 公式Q&A — 手札のトリケラを捨札にして【超シールド進化】は使えない（出典: grnrngr/faq-card-1 RS-052 Q5）", () => {
    const atk = inst("TST-UNIT-7", "atk");
    const wb = inst("TST-UNIT-0", "wb");
    const triInHand = inst("RS-052", "tri-hand");
    let s = specState(["RS-052"], {
      phase: "battle",
      player1: { battle: [atk] },
      player2: { battle: [wb], hand: [triInHand] },
    });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: atk.instanceId,
      defenderInstanceId: wb.instanceId,
    });
    expect(legalOfType(s, "use_super_shield")).toHaveLength(0);
    expect(zoneIds(s, "player2", "discard")).toContain(wb.instanceId);
    expect(zoneIds(s, "player2", "hand")).toContain(triInHand.instanceId);
  });

  // card_1.html RS-052:「撃破されて捨札になるユニットのかわりに捨札になるだけで、撃破されたことを無効にはできません」
  it("R-ERR-RS052: 公式Q&A — 守ったアバレッドの「撃破されたとき1点ダメージ」は発生する（出典: grnrngr/faq-card-1 RS-052 Q6）", () => {
    const atk = inst("TST-UNIT-7", "atk");
    const red = inst("RS-054", "red");
    const tri = inst("RS-052", "tri");
    let s = specState(["RS-052", "RS-054"], {
      phase: "battle",
      player1: { battle: [atk] },
      player2: {
        battle: [red, tri],
        deck: [inst("TST-OP", "k1"), inst("TST-OP", "k2")],
      },
    });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: atk.instanceId,
      defenderInstanceId: red.instanceId,
    });
    s = actLegal(s, (a) => a.type === "use_super_shield");
    expect(zoneIds(s, "player2", "battle")).toContain(red.instanceId);
    expect(s.players.player2.damage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS009 パワーバズーカ", () => {
  const ids = ["RS-009", "RS-050", "RS-051", "RS-052", "RS-053"];

  function bazookaState(options: {
    p2Battle: ReturnType<typeof inst>[];
    p2Discard: ReturnType<typeof inst>[];
    p2Commands: number;
  }) {
    const baz = inst("RS-009", "baz");
    const s = specState(ids, {
      phase: "rush",
      player1: {
        hand: [baz],
        command: [held("TST-OP-ET", "c1")],
        power: powerCards(8),
      },
      player2: {
        battle: options.p2Battle,
        discard: options.p2Discard,
        command: Array.from({ length: options.p2Commands }, (_, i) =>
          released("TST-OP", `x${i}`),
        ),
      },
    });
    return { s, baz };
  }

  // errata.html 正:「そうして撃破したＬユニットが捨札になったとき、相手はそのＬユニットの合体に必要なユニットのカードを…」
  it("R-ERR-RS009: 修正後テキスト「そうして撃破したＬユニットが捨札になったとき」を持つ（出典: grnrngr/errata RS-009）", () => {
    expectCorrectedText(
      "RS-009",
      "敵軍Ｌユニットを１体選んで撃破する。そうして撃破したＬユニットが捨札になったとき、相手はそのＬユニットの合体に必要なユニットのカードを捨札から探してバトルエリアに戻す。このとき、戻したユニットの効果は発動しない。",
    );
  });

  it("R-ERR-RS009: Lユニットが捨札になれば合体素材が捨札からバトルエリアに戻る（出典: grnrngr/errata RS-009）", () => {
    const ao = inst("RS-050", "ao");
    const m1 = inst("RS-051", "m1");
    const m2 = inst("RS-052", "m2");
    const m3 = inst("RS-053", "m3");
    const { s: s0, baz } = bazookaState({
      p2Battle: [ao],
      p2Discard: [m1, m2, m3],
      p2Commands: 3,
    });
    const s = actLegal(
      s0,
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === baz.instanceId &&
        a.targetInstanceId === ao.instanceId,
    );
    expect(zoneIds(s, "player2", "discard")).toContain(ao.instanceId);
    expect(zoneIds(s, "player2", "battle")).toEqual(
      expect.arrayContaining([m1.instanceId, m2.instanceId, m3.instanceId]),
    );
  });

  // card_1.html RS-009:「いいえ、戻しません。この場合は「RS-050 アバレンオー」が捨札にならずにバトルエリアに残るだけとなります」
  it("R-ERR-RS009: 公式Q&A — トリケラの【超シールド進化】でLユニットが捨札にならなければ素材は戻らない（出典: grnrngr/faq-card-1 RS-009 Q6）", () => {
    const ao = inst("RS-050", "ao");
    const tri = inst("RS-052", "tri");
    const m1 = inst("RS-051", "m1");
    const m3 = inst("RS-053", "m3");
    const { s: s0, baz } = bazookaState({
      p2Battle: [ao, tri],
      p2Discard: [m1, m3],
      p2Commands: 3,
    });
    let s = actLegal(
      s0,
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === baz.instanceId &&
        a.targetInstanceId === ao.instanceId,
    );
    s = actLegal(s, (a) => a.type === "use_super_shield");
    expect(zoneIds(s, "player2", "battle")).toEqual([ao.instanceId]);
    expect(zoneIds(s, "player2", "discard")).toEqual(
      expect.arrayContaining([m1.instanceId, m3.instanceId, tri.instanceId]),
    );
  });

  // card_1.html RS-009:「「RS-053 爆竜プテラノドン」だけをバトルエリアに戻します」
  it("R-ERR-RS009: 公式Q&A — 捨札にある素材だけを戻す（出典: grnrngr/faq-card-1 RS-009 Q5）", () => {
    const ao = inst("RS-050", "ao");
    const m3 = inst("RS-053", "m3");
    const { s: s0, baz } = bazookaState({
      p2Battle: [ao],
      p2Discard: [m3],
      p2Commands: 3,
    });
    const s = actLegal(
      s0,
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === baz.instanceId &&
        a.targetInstanceId === ao.instanceId,
    );
    expect(zoneIds(s, "player2", "battle")).toEqual([m3.instanceId]);
  });

  // card_1.html RS-009:「ホールドするコマンドがなくなって、バトルエリアに出せなくなった場合は、そこでその効果は終了します」
  it("R-ERR-RS009: 公式Q&A — ※ホールド要求の素材はホールドできる数までしか戻らない（出典: grnrngr/faq-card-1 RS-009 Q3）", () => {
    const ao = inst("RS-050", "ao");
    const m1 = inst("RS-051", "m1");
    const m2 = inst("RS-052", "m2");
    const m3 = inst("RS-053", "m3");
    const { s: s0, baz } = bazookaState({
      p2Battle: [ao],
      p2Discard: [m1, m2, m3],
      p2Commands: 2,
    });
    const s = actLegal(
      s0,
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === baz.instanceId &&
        a.targetInstanceId === ao.instanceId,
    );
    expect(s.players.player2.battle).toHaveLength(2);
    expect(s.players.player2.command.every((c) => c.commandHeld === true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS065 ボウケンイエロー", () => {
  // errata.html 正:「【一点突破】これが「ＳＰ１」以上または「ＳＰ！」のあるユニットを撃破したとき、相手に１点ダメージを与える。」
  it("R-ERR-RS065: 修正後テキスト「これが「ＳＰ１」以上または「ＳＰ！」のあるユニットを撃破したとき」を持つ（出典: grnrngr/errata RS-065）", () => {
    expectCorrectedText(
      "RS-065",
      "【一点突破】これが「ＳＰ１」以上または「ＳＰ！」のあるユニットを撃破したとき、相手に１点ダメージを与える。",
    );
  });

  /**
   * ボウケンイエロー（CN3）をバトルエリア3番目に置き、指定 SP の敵ユニットにアタックする。
   * 【一点突破】は NC 成立時だけ有効なので、3番目で NC が成立した状態（activatedNcEffects）にしておく。
   */
  function attackWithYellow(defSp: unknown, defenderIndex = 0) {
    const y = { ...inst("RS-065", "y"), activatedNcEffects: ["focused_breakthrough"] };
    const d = inst("DEF", "d");
    const p2Battle = [
      ...Array.from({ length: defenderIndex }, (_, i) => inst("TST-UNIT-0", `pad${i}`)),
      d,
    ];
    let s = specState(["RS-065"], {
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), y] },
      player2: { battle: p2Battle, deck: [inst("TST-OP", "k1"), inst("TST-OP", "k2")] },
    });
    s.definitions["DEF"] = sUnit("DEF", { bp: 500, sp: defSp as never });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: y.instanceId,
      defenderInstanceId: d.instanceId,
    });
    return { s, d };
  }

  it("R-ERR-RS065: 「SP1」のユニットを撃破したとき相手に1点ダメージ（出典: grnrngr/errata RS-065）", () => {
    const { s, d } = attackWithYellow(1);
    expect(zoneIds(s, "player2", "discard")).toContain(d.instanceId);
    expect(s.players.player2.damage).toBe(1);
  });

  it("R-ERR-RS065: SPを持たないユニットを撃破してもダメージは与えない（出典: grnrngr/errata RS-065）", () => {
    const { s, d } = attackWithYellow(undefined);
    expect(zoneIds(s, "player2", "discard")).toContain(d.instanceId);
    expect(s.players.player2.damage).toBe(0);
  });

  // card_1.html RS-065:「ＳＰに「！」とあるユニットは…すべてこの効果の対象になります」
  it("R-ERR-RS065: 公式Q&A — 「SP！」のユニットはすべて対象（出典: grnrngr/faq-card-1 RS-065 Q3）", () => {
    const { s } = attackWithYellow("special");
    expect(s.players.player2.damage).toBe(1);
  });

  // card_1.html RS-065:「分数表記のＳＰがその効果の対象となるのは、そのＳＰが「１」になっている場合です」
  it("R-ERR-RS065: 公式Q&A — 分数SPは「SP1」になっていない位置なら対象外（出典: grnrngr/faq-card-1 RS-065 Q1）", () => {
    const { s, d } = attackWithYellow("1/3", 0);
    expect(zoneIds(s, "player2", "discard")).toContain(d.instanceId);
    expect(s.players.player2.damage).toBe(0);
  });

  it("R-ERR-RS065: 公式Q&A — 分数SP「1/3」がバトルエリア3番目で「SP1」なら対象（出典: grnrngr/faq-card-1 RS-065 Q1）", () => {
    const { s, d } = attackWithYellow("1/3", 2);
    expect(zoneIds(s, "player2", "discard")).toContain(d.instanceId);
    expect(s.players.player2.damage).toBe(1);
  });

  // card_1.html RS-065:「効果が適用されるのは「ボウケンイエロー」自身だけです」
  it("R-ERR-RS065: 公式Q&A — 【一点突破】は「これが」撃破したときだけ（他の自軍ユニットには適用しない）（出典: grnrngr/faq-card-1 RS-065 Q2）", () => {
    const y = inst("RS-065", "y");
    const other = inst("TST-UNIT-7", "other");
    const d = inst("DEF", "d");
    let s = specState(["RS-065"], {
      phase: "battle",
      player1: { battle: [other, inst("TST-UNIT-0", "f2"), y] },
      player2: { battle: [d], deck: [inst("TST-OP", "k1")] },
    });
    s.definitions["DEF"] = sUnit("DEF", { bp: 500, sp: 1 });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: other.instanceId,
      defenderInstanceId: d.instanceId,
    });
    expect(zoneIds(s, "player2", "discard")).toContain(d.instanceId);
    expect(s.players.player2.damage).toBe(0);
  });

  // 08 章 効果:「【一点突破】は NC（CN3）が成立しているときだけ有効」
  it("R-ERR-RS065: NC（CN3）が成立していなければ【一点突破】は働かない（出典: grnrngr/errata RS-065、08章 効果）", () => {
    const y = inst("RS-065", "y");
    const d = inst("DEF", "d");
    let s = specState(["RS-065"], {
      phase: "battle",
      player1: { battle: [y] },
      player2: { battle: [d], deck: [inst("TST-OP", "k1")] },
    });
    s.definitions["DEF"] = sUnit("DEF", { bp: 500, sp: 1 });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: y.instanceId,
      defenderInstanceId: d.instanceId,
    });
    expect(s.players.player2.damage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS003 バトルダンス", () => {
  // errata.html 正:「自分のバトルフェイズに発動できる。自軍コマンドを２つホールドして、自軍Ｓユニットを１体ラッシュエリアに戻してもよい。…」
  it("R-ERR-RS003: 修正後テキスト「自軍コマンドを２つホールドして」を持つ（出典: grnrngr/errata RS-003）", () => {
    expectCorrectedText(
      "RS-003",
      "自分のバトルフェイズに発動できる。自軍コマンドを２つホールドして、自軍Ｓユニットを１体ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。",
    );
  });

  // errata.html 正:「常駐（場に配置して、離れるまで効果が有効になる）」
  it("R-ERR-RS003: 常駐カードとして扱われる（出典: grnrngr/errata RS-003）", () => {
    expect(getCardEffect("RS-003")?.kind).toBe("permanent");
    expect(cardDef("RS-003")?.tags ?? []).toContain("常駐");
  });

  function danceState(commandCount: number) {
    const u1 = inst("TST-UNIT-0", "u1");
    const u2 = inst("TST-UNIT-0", "u2");
    const u3 = inst("TST-UNIT-0", "u3");
    const m = inst("TST-UNIT-2", "m");
    const s = specState(["RS-003"], {
      phase: "battle",
      player1: {
        operation: [inst("RS-003", "op")],
        battle: [u1, u2, u3, m],
        command: Array.from({ length: commandCount }, (_, i) =>
          released("TST-OP-ET", `c${i}`),
        ),
      },
    });
    return { s, u1, u2, u3, m };
  }

  it("R-ERR-RS003: 1回の発動はコマンド2つホールドで自軍Sユニット1体だけを戻す（出典: grnrngr/errata RS-003）", () => {
    const { s: s0 } = danceState(4);
    const first = legalOfType(s0, "battle_dance_retreat")[0];
    expect(first).toBeDefined();
    expect(first!.commandInstanceIds).toHaveLength(2);
    const s = act(s0, first!);
    expect(s.players.player1.command.filter((c) => c.commandHeld).length).toBe(2);
    expect(s.players.player1.rush).toHaveLength(1);
    expect(s.players.player1.battle).toHaveLength(3);
  });

  it("R-ERR-RS003: Mユニットは戻せない（自軍Ｓユニットのみ）（出典: grnrngr/errata RS-003）", () => {
    const { s, m } = danceState(2);
    expect(
      legalOfType(s, "battle_dance_retreat").some((a) => a.battleInstanceId === m.instanceId),
    ).toBe(false);
  });

  // card_1.html RS-003:「コマンドをホールドできる限り、繰り返し発動できます」
  it("R-ERR-RS003: 公式Q&A — リリース状態コマンド4つなら2体まで戻せる（繰り返し発動）（出典: grnrngr/faq-card-1 RS-003）", () => {
    let { s } = danceState(4);
    s = act(s, legalOfType(s, "battle_dance_retreat")[0]!);
    const second = legalOfType(s, "battle_dance_retreat")[0];
    expect(second).toBeDefined();
    s = act(s, second!);
    expect(s.players.player1.rush).toHaveLength(2);
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(legalOfType(s, "battle_dance_retreat")).toHaveLength(0);
  });

  it("R-ERR-RS003: リリース状態コマンドが3つなら1体しか戻せない（出典: grnrngr/errata RS-003）", () => {
    let { s } = danceState(3);
    s = act(s, legalOfType(s, "battle_dance_retreat")[0]!);
    expect(legalOfType(s, "battle_dance_retreat")).toHaveLength(0);
  });

  it("R-ERR-RS003: 戻したユニットはこのターン再びバトルエリアに出られない（出典: grnrngr/errata RS-003）", () => {
    let { s } = danceState(2);
    const action = legalOfType(s, "battle_dance_retreat")[0]!;
    s = act(s, action);
    expect(
      legal(s).some(
        (a) => a.type === "move_to_battle" && a.instanceId === action.battleInstanceId,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS058 マジイエロー", () => {
  // errata.html 正:「【イエローサンダー】「ＳＰ１」これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる。」
  it("R-ERR-RS058: 修正後テキスト「これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる」を持つ（出典: grnrngr/errata RS-058）", () => {
    expectCorrectedText(
      "RS-058",
      "【イエローサンダー】「ＳＰ１」これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる。",
    );
  });

  it("R-ERR-RS058: ※行「これは「マジガルーダ」としてつかえる」を保持する（出典: grnrngr/errata RS-058）", () => {
    expectCorrectedText("RS-058", "※これは「マジガルーダ」としてつかえる。");
  });

  function yellowEntered(enemyBattle: ReturnType<typeof inst>[] = []) {
    const y = inst("RS-058", "y");
    const r = inst("TST-UNIT-0", "enemy-rush");
    let s = specState(["RS-058"], {
      phase: "battle",
      player1: { rush: [y], battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2")] },
      player2: { rush: [r], battle: enemyBattle },
    });
    s = moveToBattle(s, y.instanceId);
    return { s, y, r };
  }

  it("R-ERR-RS058: NC成立時、アタックするとき敵軍ラッシュエリアのユニットを対象にできる（出典: grnrngr/errata RS-058）", () => {
    const { s, y, r } = yellowEntered();
    expect(
      legalOfType(s, "battle").some(
        (a) => a.attackerInstanceId === y.instanceId && a.defenderInstanceId === r.instanceId,
      ),
    ).toBe(true);
    const after = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: y.instanceId,
      defenderInstanceId: r.instanceId,
    });
    expect(zoneIds(after, "player2", "rush")).not.toContain(r.instanceId);
  });

  // card_1.html RS-058:「敵軍バトルエリアにユニットが１体も無くても発動させることができますか？ はい、できます。」
  it("R-ERR-RS058: 公式Q&A — 敵軍バトルエリアが空でも敵軍ラッシュエリアにアタックできる（出典: grnrngr/faq-card-1 RS-058 Q1）", () => {
    const { s, y, r } = yellowEntered([]);
    expect(s.players.player2.battle).toHaveLength(0);
    expect(
      legalOfType(s, "battle").some(
        (a) => a.attackerInstanceId === y.instanceId && a.defenderInstanceId === r.instanceId,
      ),
    ).toBe(true);
  });

  // card_1.html RS-058:「アタックかストライクのどちらかを行った時点で…ターン中にできる行動は終了します」
  it("R-ERR-RS058: 公式Q&A — ラッシュエリアへアタックした後は続けてストライクできない（出典: grnrngr/faq-card-1 RS-058 Q2）", () => {
    const { s: s0, y, r } = yellowEntered();
    const s = act(s0, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: y.instanceId,
      defenderInstanceId: r.instanceId,
    });
    expect(
      legal(s).some(
        (a) =>
          (a.type === "strike" && a.instanceId === y.instanceId) ||
          (a.type === "battle" && a.attackerInstanceId === y.instanceId),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS018 隠流忍術", () => {
  // errata.html 正:「自軍ユニットがアタックされたとき発動できる。⇒アタックしてきたユニット以外のユニットをすべての場から１体選んで、かわりにバトルさせる。」
  it("R-ERR-RS018: 修正後テキスト「アタックしてきたユニット以外のユニットをすべての場から１体選んで」を持つ（出典: grnrngr/errata RS-018）", () => {
    expectCorrectedText(
      "RS-018",
      "自軍ユニットがアタックされたとき発動できる。アタックしてきたユニット以外のユニットをすべての場から１体選んで、かわりにバトルさせる。",
    );
  });

  // errata.html 正:「カウンター（これは敵軍ターン中にのみ使用できる）」
  it("R-ERR-RS018: カウンターとして扱われる（出典: grnrngr/errata RS-018）", () => {
    expect(getCardEffect("RS-018")?.kind).toBe("counter");
    expect(cardDef("RS-018")?.tags ?? []).toContain("カウンター");
  });

  function attacked() {
    const atk = inst("TST-UNIT-2", "atk");
    const atk2 = inst("TST-UNIT-0", "atk2");
    const enemyRush = inst("TST-UNIT-0", "enemy-rush");
    const d = inst("TST-UNIT-0", "d");
    const ownRush = inst("TST-UNIT-0", "own-rush");
    const c = inst("RS-018", "c");
    let s = specState(["RS-018"], {
      phase: "battle",
      player1: { battle: [atk, atk2], rush: [enemyRush] },
      player2: {
        battle: [d],
        rush: [ownRush],
        hand: [c],
        command: [released("TST-OP-MA", "m")],
        power: powerCards(4),
      },
    });
    s = act(s, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: atk.instanceId,
      defenderInstanceId: d.instanceId,
    });
    const subs = legalOfType(s, "initiate_command_payment")
      .filter((a) => a.sourceInstanceId === c.instanceId)
      .map((a) => a.substituteInstanceId);
    return { s, subs, atk, atk2, enemyRush, ownRush, c, d };
  }

  // card_1.html RS-018:「この効果でユニットを選ぶとき、アタックしてきた相手のユニットを選ぶことはできますか？ いいえ、できません。」
  it("R-ERR-RS018: 公式Q&A — アタックしてきたユニットは選べない（出典: grnrngr/faq-card-1 RS-018 Q13）", () => {
    const { subs, atk } = attacked();
    expect(subs.length).toBeGreaterThan(0);
    expect(subs).not.toContain(atk.instanceId);
  });

  it("R-ERR-RS018: アタックしてきたユニット以外なら、すべての場（敵軍・自軍、ラッシュ・バトル）から選べる（出典: grnrngr/errata RS-018）", () => {
    const { subs, atk2, enemyRush, ownRush } = attacked();
    expect(subs).toEqual(
      expect.arrayContaining([atk2.instanceId, enemyRush.instanceId, ownRush.instanceId]),
    );
  });

  it("R-ERR-RS018: 選んだユニットがかわりにバトルし、アタックされたユニットはバトルしない（出典: grnrngr/errata RS-018）", () => {
    const { s: s0, ownRush, c, d } = attacked();
    const s = act(s0, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "category_use",
      sourceInstanceId: c.instanceId,
      prismSubstitute: false,
      substituteInstanceId: ownRush.instanceId,
    });
    // TST-UNIT-2(BP3000) vs TST-UNIT-0(BP1000): かわりにバトルした自軍ラッシュのユニットが撃破される
    expect(zoneIds(s, "player2", "battle")).toContain(d.instanceId);
    expect(zoneIds(s, "player2", "discard")).toContain(ownRush.instanceId);
  });
});
