import { applyAction, getLegalActions } from "../index";
/**
 * docs/rules/08-errata.md §2 atwiki 記載の修正後テキスト（21件）[wiki]
 *
 * 出典: docs/rules/sources/web/w.atwiki.jp/renst/pages/N.txt（各カードページ「修正後は以下。」と Q&A 欄の公式回答転載）
 *       docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_1.html（RS-036/030/043/051 の項）
 * 期待値はルールブック（08 章）に従う。エンジンの現状には合わせない。
 */
import { describe, expect, it } from "vitest";
import { getCardEffect } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  act,
  cardDef,
  engineText,
  expectCorrectedText,
  held,
  inst,
  legal,
  legalOfType,
  norm,
  powerCards,
  released,
  sUnit,
  specState,
  zoneIds,
} from "./08-helpers";

const J = (a: GameAction) => JSON.stringify(a);

const TEST_VEHICLE = {
  id: "VEH",
  name: "VEH",
  type: "vehicle",
  category: "WB",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 2000,
  size: "S",
} as never;

/** ※ ホールド要求のあるユニットをバトルエリアに出す（コマンド支払い込み）。 */
function enterBattleWithHold(s: GameState, instanceId: string, playerId: PlayerId = "player1") {
  return act(s, {
    type: "initiate_command_payment",
    playerId,
    kind: "battle_entry",
    sourceInstanceId: instanceId,
  });
}

/** RC ユニットをテスト用ビークルにライドさせてバトルエリアに出し、ライドオフする。 */
function rideOffState(
  unitId: string,
  options: {
    p1?: Partial<GameState["players"]["player1"]>;
    p2?: Partial<GameState["players"]["player2"]>;
    defs?: Record<string, unknown>;
  } = {},
) {
  const v = inst("VEH", "v");
  const unit = { ...inst(unitId, "u"), mountedOnInstanceId: v.instanceId };
  let s = specState([unitId], {
    phase: "battle",
    player1: { rush: [unit, v], ...(options.p1 ?? {}) },
    player2: options.p2 ?? {},
  });
  s.definitions["VEH"] = TEST_VEHICLE;
  Object.assign(s.definitions, options.defs ?? {});
  s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: unit.instanceId });
  s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
  return { s, unit: unit.instanceId };
}

/** 保留中の選択を、合法な resolve/confirm で順に処理する（選択肢は先頭から）。 */
function resolveChoices(s: GameState, max = 8): GameState {
  let next = s;
  for (let i = 0; i < max; i += 1) {
    const a = legal(next).find(
      (x) =>
        x.type === "resolve_effect_choice" ||
        x.type === "confirm_effect_choice" ||
        (x.type === "initiate_command_payment" && x.kind === "effect_hold"),
    );
    if (!a) break;
    next = act(next, a);
  }
  return next;
}

// ---------------------------------------------------------------------------
describe("R-ERR-RS036 守護獣ジュウマンモス", () => {
  // atwiki/page-79「修正後は以下」:「相手は自分自身のコマンドゾーンから、リリース状態のコマンドを2つ選びホールドする。1つしかなければ1つ選びホールドする。」
  it("R-ERR-RS036: 修正後テキスト「リリース状態のコマンドを2つ選びホールドする。1つしかなければ…」を持つ（出典: atwiki/page-79）", () => {
    expectCorrectedText(
      "RS-036",
      "【モスブリザード】これをラッシュしたとき、相手は自分自身のコマンドゾーンから、リリース状態のコマンドを2つ選びホールドする。1つしかなければ1つ選びホールドする。",
    );
  });

  function mammothRushed(p2Commands: CardInstance[], p2Hand: CardInstance[] = []) {
    const m = inst("RS-036", "m");
    let s = specState(["RS-036", "RS-026"], {
      phase: "rush",
      player1: { hand: [m], command: [released("TST-OP", "w1")], power: powerCards(5) },
      player2: { command: p2Commands, hand: p2Hand, power: powerCards(3, "epw") },
    });
    s = act(
      s,
      legal(s).find(
        (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === m.instanceId,
      )!,
    );
    return s;
  }

  it("R-ERR-RS036: 選べるのは相手のリリース状態のコマンドだけ（出典: atwiki/page-79）", () => {
    const s = mammothRushed([
      released("TST-OP-ET", "e1"),
      held("TST-OP-MA", "e2"),
      released("TST-OP-DA", "e3"),
    ]);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual(
      ["TST-OP-DA:e3", "TST-OP-ET:e1"].sort(),
    );
  });

  it("R-ERR-RS036: リリース状態のコマンドが1つしかなければ1つ選びホールドする（出典: atwiki/page-79）", () => {
    let s = mammothRushed([released("TST-OP-ET", "e1"), held("TST-OP-MA", "e2")]);
    s = resolveChoices(s);
    expect(s.players.player2.command.every((c) => c.commandHeld === true)).toBe(true);
  });

  // 修正後テキストに「てもよい」はない（相手は必ずホールドする）
  it("R-ERR-RS036: 相手はホールドを拒否できない（出典: atwiki/page-79）", () => {
    const s = mammothRushed([released("TST-OP-ET", "e1"), released("TST-OP-DA", "e3")]);
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(0);
  });

  // card_1.html RS-036 / atwiki page-79 Q:「まずユニットのラッシュしたときの効果を適用して、コマンドを２つホールドします」
  it("R-ERR-RS036: 公式Q&A — 疾風流超忍法の割り込みより先に【モスブリザード】でコマンドをホールドする（出典: grnrngr/faq-card-1 RS-036）", () => {
    const s = mammothRushed(
      [released("TST-OP-MA", "e1"), released("TST-OP-MA", "e2")],
      [inst("RS-026", "hayate")],
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-036");
    expect(
      legal(s).some(
        (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-026:hayate",
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG3-072 仮面ライダーキバーラ", () => {
  // atwiki/page-1963 Q1 公式回答:「…１枚選びウラ向きにしてダメージにする。」
  it("R-ERR-XG3-072: 修正後テキスト「…１枚選びウラ向きにしてダメージにする」を持つ（出典: atwiki/page-1963 Q1）", () => {
    expectCorrectedText(
      "XG3-072",
      "【誘いの罠】自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、特徴「男」を持つ敵軍ユニットを１体選び撃破する。そうしたとき、撃破したユニットと特徴が完全一致するオモテ向きの敵軍パワーがあれば、１枚選びウラ向きにしてダメージにする。",
    );
  });

  function kivalaEntered(p2Operation: CardInstance[] = []) {
    const k = inst("XG3-072", "k");
    const man = inst("MAN", "man");
    let s = specState(["XG3-072", "RS-348"], {
      phase: "battle",
      player1: { rush: [k], command: [released("TST-OP-DA", "d")] },
      player2: {
        battle: [man],
        power: [inst("MAN", "pw-man"), inst("TST-P", "pw2")],
        operation: p2Operation,
        deck: [inst("TST-OP", "e1"), inst("TST-OP", "e2"), inst("TST-OP", "e3")],
      },
    });
    s.definitions["MAN"] = sUnit("MAN", { features: ["男", "レッド"] });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: k.instanceId });
    s = resolveChoices(s);
    return s;
  }

  it("R-ERR-XG3-072: 特徴が完全一致する敵軍パワーをウラ向きにし、相手は1点ダメージを受ける（出典: atwiki/page-1963 Q1）", () => {
    const s = kivalaEntered();
    expect(zoneIds(s, "player2", "discard")).toContain("MAN:man");
    expect(s.players.player2.power.find((c) => c.instanceId === "MAN:pw-man")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  // atwiki/page-1963 Q1:「このとき「RS-348 メディテーション」の効果で追加ダメージを受けますか？ はい、そのとおりです。」
  it("R-ERR-XG3-072: 公式Q&A — 相手のメディテーションで追加ダメージも受ける（計2点）（出典: atwiki/page-1963 Q1）", () => {
    const s = kivalaEntered([inst("RS-348", "medi")]);
    expect(s.players.player2.damage).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS106 デカレッド", () => {
  // atwiki/page-23「修正後は以下」:「【ジュウクンドー】これが敵軍ユニットにアタックできるとき、次の効果を発動できる。…そうしたとき、これはアタックすることができない。」
  it("R-ERR-RS106: 修正後テキスト「これが敵軍ユニットにアタックできるとき…そうしたとき、これはアタックすることができない」を持つ（出典: atwiki/page-23）", () => {
    expectCorrectedText(
      "RS-106",
      "※これはラッシュしたターンにバトルエリアに出られない。【ジュウクンドー】これが敵軍ユニットにアタックできるとき、次の効果を発動できる。敵軍ラッシュエリアにあるユニットを、カードに表記された本来のBPの合計が3000以下になるように好きな数選んで撃破する。そうしたとき、これはアタックすることができない。",
    );
  });

  function decaRed(enemyBattle: CardInstance[]) {
    // 1番目に出て NC（CN1）が成立した状態（R-CN-02。【ジュウクンドー】は CN の欄の効果）。
    const r = { ...inst("RS-106", "red"), activatedNcEffects: ["juu_kun_do"] };
    const s = specState(["RS-106"], {
      phase: "battle",
      player1: { battle: [r] },
      player2: {
        battle: enemyBattle,
        rush: [inst("TST-UNIT-0", "er1"), inst("TST-UNIT-0", "er2")],
      },
    });
    return { s, r: r.instanceId };
  }

  it("R-ERR-RS106: 敵軍ユニットにアタックできるとき【ジュウクンドー】を発動でき、BP合計3000以下を選んで撃破する（出典: atwiki/page-23）", () => {
    const { s: s0, r } = decaRed([inst("TST-UNIT-0", "eb")]);
    const use = legalOfType(s0, "use_juu_kun_do").find((a) => a.attackerInstanceId === r);
    expect(use).toBeDefined();
    const s = act(s0, use!);
    expect(s.pendingEffectChoice?.bpBudget).toBe(3000);
  });

  // atwiki/page-23 Q6:「相手のバトルエリアにユニットが存在しない場合は、この効果を発動させることは出来ません」
  it("R-ERR-RS106: Q&A — アタックできない（敵軍バトルエリアが空）なら発動できない（出典: atwiki/page-23 Q6）", () => {
    const { s, r } = decaRed([]);
    expect(legalOfType(s, "use_juu_kun_do").some((a) => a.attackerInstanceId === r)).toBe(false);
  });

  it("R-ERR-RS106: 発動して撃破したら、このターンこれはアタックできない（出典: atwiki/page-23）", () => {
    const { s: s0, r } = decaRed([inst("TST-UNIT-0", "eb")]);
    let s = act(s0, legalOfType(s0, "use_juu_kun_do").find((a) => a.attackerInstanceId === r)!);
    s = resolveChoices(s);
    expect(legalOfType(s, "battle").some((a) => a.attackerInstanceId === r)).toBe(false);
  });

  // 08 章 補足:「公式の告知原文は見つからないため [wiki] のまま」
  it.todo(
    "R-ERR-RS106: 公式の読み替え告知原文との照合（出典: 08章 補足 — 修正後の文面は atwiki/page-23 にのみあり、公式FAQ card_2/card_3 は旧テキスト回答のまま）",
  );
  it.todo(
    "R-ERR-RS106: 「AするかわりにB」整理（R-REPL-03）に伴うエラッタの適用範囲（旧テキストの Q3・Q6 以外の旧 Q&A の扱い）（出典: 08章 補足）",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS633 メガシルバー", () => {
  // atwiki/page-1529 Q1 公式回答:「※自軍スタートフェイズを終えるとき、このユニットがリリース状態ならホールドし、ホールド状態なら捨札にする。…」
  it("R-ERR-RS633: 修正後テキスト「※自軍スタートフェイズを終えるとき、このユニットが…」を持つ（出典: atwiki/page-1529 Q1）", () => {
    expectCorrectedText(
      "RS-633",
      "※自軍スタートフェイズを終えるとき、このユニットがリリース状態ならホールドし、ホールド状態なら捨札にする。【シルバーブレイザー】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+2000 され、これがホールド状態なら「SP1」になる。",
    );
  });

  function endStartPhase(megaSilver: CardInstance) {
    let s = specState(["RS-633"], {
      phase: "start",
      player1: { rush: [megaSilver], deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")] },
    });
    for (let i = 0; i < 6 && s.phase === "start"; i += 1) {
      const L = legal(s);
      s = act(s, L.find((a) => a.type === "draw") ?? L.find((a) => a.type === "end_phase") ?? L[0]!);
    }
    return s;
  }

  // atwiki/page-1529 Q1:「改めて状態を確認し…捨札になりますか？ いいえ、なりません。」
  it("R-ERR-RS633: 公式Q&A — リリース状態のユニットはスタートフェイズ終了時にホールドされ、同じスタートフェイズ中に捨札にはならない（出典: atwiki/page-1529 Q1）", () => {
    const ms = inst("RS-633", "ms");
    const s = endStartPhase(ms);
    expect(s.phase).not.toBe("start");
    const unit = s.players.player1.rush.find((c) => c.instanceId === ms.instanceId);
    expect(unit).toBeDefined();
    expect(unit?.commandHeld).toBe(true);
  });

  it("R-ERR-RS633: ホールド状態のユニットはスタートフェイズ終了時に捨札になる（出典: atwiki/page-1529 Q1）", () => {
    const ms = { ...inst("RS-633", "ms"), commandHeld: true };
    let s = specState(["RS-633"], {
      phase: "start",
      player1: { rush: [ms], deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")] },
    });
    // スタートフェイズのリリースで解除されないよう、ドローしてから終える
    s = act(s, legal(s).find((a) => a.type === "draw")!);
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [ms] } } };
    s = act(s, legal(s).find((a) => a.type === "end_phase") ?? legal(s)[0]!);
    expect(zoneIds(s, "player1", "discard")).toContain(ms.instanceId);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG1-048 仮面ライダースーパー1・EH", () => {
  // atwiki/page-1632 Q1 公式回答:「RC【エレキ光線】敵軍Sユニットを1体選んでもよい。次の相手のターン、選んだユニットがバトルエリアにあるとき、選んだユニットと隣り合っているユニットは、そのターンを終えるとき撃破される。」
  it("R-ERR-XG1-048: 修正後テキスト「選んだユニットがバトルエリアにあるとき、選んだユニットと隣り合っているユニットは…」を持つ（出典: atwiki/page-1632 Q1）", () => {
    expectCorrectedText(
      "XG1-048",
      "【エレキ光線】敵軍Ｓユニットを１体選んでもよい。次の相手のターン、選んだユニットがバトルエリアにあるとき、選んだユニットと隣り合っているユニットは、そのターンを終えるとき撃破される。",
    );
  });

  it("R-ERR-XG1-048: ライドオフしたとき敵軍Sユニットを1体選べる（出典: atwiki/page-1632）", () => {
    const { s } = rideOffState("XG1-048", {
      p2: { battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-0", "b2"), inst("TST-UNIT-0", "b3")] },
    });
    const choosable = legal(s).filter(
      (a) => a.type === "resolve_effect_choice" && a.instanceId.startsWith("TST-UNIT-0:b"),
    );
    expect(choosable.length).toBeGreaterThan(0);
  });

  // atwiki/page-1632 Q1:「そのターンを終える時点で、選んだユニットとバトルエリアで隣り合ったユニットを撃破する」
  it.todo(
    "R-ERR-XG1-048: 公式Q&A — 次の相手のターン中に一時的に隣り合っただけのユニットは撃破されず、ターン終了時点で隣り合っているユニットだけ撃破（出典: atwiki/page-1632 Q1）— 選択自体が未実装で前提状態を作れない",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG2-030 ヌマ・O長官", () => {
  // atwiki/page-1689 Q1 公式回答の読み替え文
  it("R-ERR-XG2-030: 修正後テキスト「…手札に加えたカードの合体に必要なユニットのカードを、それぞれ1枚まで選び…」を持つ（出典: atwiki/page-1689 Q1）", () => {
    expectCorrectedText(
      "XG2-030",
      "ゲーム開始時、一度だけ次の効果を発動できる⇒自軍山札を見て、特徴「メカ」を持つLユニットのカードを1枚選び、相手に見せてから自分の手札に加える。そして、手札に加えたカードの合体に必要なユニットのカードを、それぞれ1枚まで選び、相手に見せてから自分の手札に加える。その後、手札に加えた枚数と同じだけ手札からカードを選び、山札に戻してシャッフルする。",
    );
  });

  it("R-ERR-XG2-030: カード定義はコマンダーとして存在する（出典: atwiki/page-1689）", () => {
    expect(cardDef("XG2-030")?.type).toBe("commander");
  });

  it.todo(
    "R-ERR-XG2-030: 公式Q&A — 「合体に必要なユニットのカード」を各1枚まで手札に加え、加えた枚数だけ山札に戻す（出典: atwiki/page-1689 Q1〜Q3）— ゲーム開始時効果・コマンダーの処理がエンジンにない",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG4-102 ケンローダー", () => {
  // atwiki/page-2060 Q1 公式回答の読み替え文
  it("R-ERR-XG4-102: 修正後テキスト「自軍ラッシュフェイズ中、このビークルを捨札にして次の効果を発動できる⇒…」を持つ（出典: atwiki/page-2060 Q1）", () => {
    expectCorrectedText(
      "XG4-102",
      "【ギンクロン発進】自軍ラッシュフェイズ中、このビークルを捨札にして次の効果を発動できる⇒自軍山札を見て「ケンローダー」以外のＯＴを持つＳビークルのカードを１枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。その後、山札をシャッフルする。",
    );
  });

  function kenroaderState(zone: "rush" | "hand") {
    const kr = inst("XG4-102", "kr");
    const s = specState(["XG4-102"], {
      phase: "rush",
      player1: {
        rush: zone === "rush" ? [kr] : [],
        hand: zone === "hand" ? [kr] : [],
        deck: [inst("OTV", "otv"), inst("TST-OP", "x")],
      },
    });
    s.definitions["OTV"] = {
      id: "OTV",
      name: "OTV",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      size: "S",
    } as never;
    return { s, kr: kr.instanceId };
  }

  it("R-ERR-XG4-102: 自軍ラッシュエリアのケンローダーを捨札にして、山札のOT Sビークルをラッシュエリアに出せる（出典: atwiki/page-2060）", () => {
    const { s: s0, kr } = kenroaderState("rush");
    const use = legal(s0).find((a) => a.type !== "end_phase" && J(a).includes(kr));
    expect(use).toBeDefined();
    const s = resolveChoices(act(s0, use!));
    expect(zoneIds(s, "player1", "discard")).toContain(kr);
    expect(zoneIds(s, "player1", "rush")).toContain("OTV:otv");
  });

  // atwiki/page-2060 Q1:「カードが自軍ゾーンや自軍手札にあるとき、【ギンクロン発進】の効果を発動することはできますか？ いいえ」
  it("R-ERR-XG4-102: 公式Q&A — 手札のケンローダーでは【ギンクロン発進】を発動できない（出典: atwiki/page-2060 Q1）", () => {
    const { s, kr } = kenroaderState("hand");
    expect(
      legal(s).some(
        (a) => a.type !== "end_phase" && a.type !== "rush" && a.type !== "initiate_command_payment" && J(a).includes(kr),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG4-062 仮面ライダーアクセル バイクフォーム", () => {
  // atwiki/page-2139 Q1 公式回答の読み替え文
  it("R-ERR-XG4-062: 修正後テキスト「…自分自身のコマンドを1つホールドしなければバトルエリアに出られない」を持つ（出典: atwiki/page-2139 Q1）", () => {
    expectCorrectedText(
      "XG4-062",
      "※これは、ライドされていなくてもバトルエリアに出ることができる。【アクセルメモリ】ライドされているこのビークルがバトルエリアにある間、特徴「加速」を持たない敵軍Sユニットは次の制限を受ける⇒自分自身のコマンドを1つホールドしなければバトルエリアに出られない。",
    );
  });

  function accelState(p2Commands: CardInstance[]) {
    const v = inst("XG4-062", "v");
    const rider = { ...inst("TST-UNIT-0", "rider"), mountedOnInstanceId: v.instanceId };
    const es = inst("TST-UNIT-0", "es");
    const s = specState(["XG4-062"], {
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [v, rider] },
      player2: { rush: [es], command: p2Commands },
    });
    return { s, es: es.instanceId };
  }

  // atwiki/page-2139 Q1:「「自軍コマンド」とは、敵軍プレイヤーにとっての自軍コマンドですか？ はい」
  it("R-ERR-XG4-062: 公式Q&A — 相手は自分自身のコマンドをホールドできなければ、Sユニットをバトルエリアに出せない（出典: atwiki/page-2139 Q1）", () => {
    const { s, es } = accelState([]);
    expect(
      legal(s).some(
        (a) =>
          (a.type === "move_to_battle" && a.instanceId === es) ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === es),
      ),
    ).toBe(false);
  });

  it("R-ERR-XG4-062: 相手のSユニットは自分自身のコマンドを1つホールドしてバトルエリアに出る（出典: atwiki/page-2139）", () => {
    const { s: s0, es } = accelState([released("TST-OP", "p2c")]);
    const s = enterBattleWithHold(s0, es, "player2");
    expect(zoneIds(s, "player2", "battle")).toContain(es);
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG4-023 シュリケンジャーFM（XG4）", () => {
  // atwiki/page-2145「修正後は以下」
  it("R-ERR-XG4-023: 修正後テキスト「相手は、戻した数と同じ数まで可能な限り自分自身のラッシュエリアのSユニットを選び…」を持つ（出典: atwiki/page-2145）", () => {
    expectCorrectedText(
      "XG4-023",
      "※これが撃破されて捨札になったとき、自軍捨札から「シュリケンジャー」のカードを1枚選び、自軍ラッシュエリアに出す。【超忍法・秘打千本ノック】自軍コマンドを好きな数選び、自分の手札に戻してもよい。そうしたとき、相手は、戻した数と同じ数まで可能な限り自分自身のラッシュエリアのSユニットを選び、持ち主の山札の下に好きな順番で戻す。",
    );
  });

  it("R-ERR-XG4-023: コマンド2つを手札に戻すと、相手はラッシュエリアのSユニットを2体山札の下に戻す（出典: atwiki/page-2145）", () => {
    const sh = inst("XG4-023", "sh");
    let s = specState(["XG4-023"], {
      phase: "battle",
      player1: { rush: [sh], command: [released("TST-OP", "c1"), released("TST-OP", "c2")] },
      player2: {
        rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2"), inst("TST-UNIT-2", "rm")],
      },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: sh.instanceId });
    s = resolveChoices(s);
    expect(s.players.player1.hand).toHaveLength(2);
    expect(zoneIds(s, "player2", "rush")).toEqual(["TST-UNIT-2:rm"]);
    expect(zoneIds(s, "player2", "deck").slice(-2).sort()).toEqual(
      ["TST-UNIT-0:r1", "TST-UNIT-0:r2"].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG6-044 仮面ライダーNEW電王SF（XG6）", () => {
  // atwiki/page-2322 Q2 公式回答の読み替え文
  it("R-ERR-XG6-044: 修正後テキスト「…その後、オモテにしたカードは山札の下に戻す」を持つ（出典: atwiki/page-2322 Q2）", () => {
    expectCorrectedText(
      "XG6-044",
      "※これをラッシュしたとき、自軍パワーゾーンから「テディ」のカードを1枚選び自軍ラッシュエリアに出してもよい。※これはBP5000以上のとき「SP1」になる【カウンターストライク】自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードの必要パワーの数字を見て、その数字と同じ並びにある敵軍Sユニット、またはライドされていない敵軍Sビークルがあれば1体選び捨札にする。その後、オモテにしたカードは山札の下に戻す。",
    );
  });

  function sfRideOff() {
    return rideOffState("XG6-044", {
      p1: { deck: [inst("TOP3", "top"), inst("TST-OP", "d2"), inst("TST-OP", "d3")] },
      p2: { battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-0", "b2"), inst("TST-UNIT-0", "b3")] },
      defs: { TOP3: sUnit("TOP3", { powerCost: 3 }) },
    });
  }

  it("R-ERR-XG6-044: オモテにしたカードの必要パワー3 → 敵軍バトルエリア3番目のSユニットを捨札にする（出典: atwiki/page-2322 Q1）", () => {
    let { s } = sfRideOff();
    s = resolveChoices(s);
    expect(zoneIds(s, "player2", "discard")).toEqual(["TST-UNIT-0:b3"]);
  });

  // atwiki/page-2322 Q2:「オモテにしたカードは、山札の下に戻してください」
  it("R-ERR-XG6-044: 公式Q&A — オモテにしたカードは効果の後で山札の下に戻る（出典: atwiki/page-2322 Q2）", () => {
    let { s } = sfRideOff();
    s = resolveChoices(s);
    const deck = zoneIds(s, "player1", "deck");
    expect(deck[deck.length - 1]).toBe("TOP3:top");
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS349 スーパー戦隊アドレスブック", () => {
  // atwiki/page-523 Q1 公式回答:「自軍山札を見て、追加条件を持たずＤＡを持たないＳユニットのカードを１枚選び…」
  it("R-ERR-RS349: 修正後テキスト「追加条件を持たずＤＡを持たないＳユニット」を持つ（出典: atwiki/page-523 Q1）", () => {
    expectCorrectedText(
      "RS-349",
      "自軍山札を見て、追加条件を持たずＤＡを持たないＳユニットのカードを１枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。",
    );
  });

  function addressBookPlayed() {
    const ab = inst("RS-349", "ab");
    let s = specState(["RS-349"], {
      phase: "rush",
      player1: {
        hand: [ab],
        command: [held("TST-OP-ET", "c")],
        power: powerCards(3),
        deck: [inst("TST-UNIT-0", "wb"), inst("MULTI", "multi"), inst("DAU", "da")],
      },
    });
    s.definitions["MULTI"] = sUnit("MULTI", { category: ["WB", "DA"] as never });
    s.definitions["DAU"] = sUnit("DAU", { category: "DA" });
    s = act(s, legal(s).find((a) => J(a).includes(ab.instanceId))!);
    return s;
  }

  it("R-ERR-RS349: DAを持たないSユニットを山札から選んで手札に加えられる（出典: atwiki/page-523）", () => {
    let s = addressBookPlayed();
    s = resolveChoices(s);
    expect(zoneIds(s, "player1", "hand")).toEqual(["TST-UNIT-0:wb"]);
  });

  // atwiki/page-523 Q1:「ＤＡを含むマルチカテゴリのカードも選ぶことはできますか？ いいえ、それはできません」
  it("R-ERR-RS349: 公式Q&A — DAを含むマルチカテゴリのSユニットは選べない（出典: atwiki/page-523 Q1）", () => {
    const s = addressBookPlayed();
    const valid = s.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain("TST-UNIT-0:wb");
    expect(valid).not.toContain("MULTI:multi");
    expect(valid).not.toContain("DAU:da");
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK146 デネブ", () => {
  // atwiki/page-672 Q2 公式回答:「…自分自身の山札を見てもよい。そうしたとき、その中からオペレーションカードを1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。」
  it("R-ERR-RK146: 修正後テキスト「自分自身の山札を見てもよい。そうしたとき、…その後、山札をシャッフルする」を持つ（出典: atwiki/page-672 Q2）", () => {
    expectCorrectedText(
      "RK-146",
      "【デネブキャンディー】これをラッシュしたとき、次の効果を、相手、自分の順に行う⇒自分自身の山札を見てもよい。そうしたとき、その中からオペレーションカードを1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。",
    );
  });

  it("R-ERR-RK146: ラッシュしたとき、相手・自分の順にそれぞれ山札のオペレーションカードを1枚手札に加えられる（出典: atwiki/page-672）", () => {
    const d = inst("RK-146", "d");
    let s = specState(["RK-146"], {
      phase: "rush",
      player1: {
        hand: [d],
        command: [released("TST-OP-OT", "c")],
        power: powerCards(2),
        deck: [inst("TST-UNIT-0", "u1"), inst("TST-OP", "op1")],
      },
      player2: { deck: [inst("TST-OP", "op2"), inst("TST-UNIT-0", "u2")] },
    });
    s = act(s, legal(s).find((a) => J(a).includes(d.instanceId))!);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = resolveChoices(s);
    expect(zoneIds(s, "player2", "hand")).toEqual(["TST-OP:op2"]);
    expect(zoneIds(s, "player1", "hand")).toEqual(["TST-OP:op1"]);
  });

  // atwiki/page-672 Q2:「オペレーションカードは1枚もありませんでした…シャッフルを実行しなくてもかまいませんか？ いいえ」
  it("R-ERR-RK146: 公式Q&A — 山札を見てオペレーションカードがなくても山札はシャッフルする（相手の山札のシャッフルで、自軍 RK-132 仮面ライダー闘鬼【妻子のバックアップ】が発動する）（出典: atwiki/page-672 Q2・atwiki/page-685）", () => {
    const d = inst("RK-146", "d");
    let s = specState(["RK-146", "RK-132"], {
      phase: "rush",
      player1: {
        hand: [d],
        rush: [{ ...inst("RK-132", "tk"), commandHeld: true }],
        command: [released("TST-OP-OT", "c")],
        power: powerCards(2),
        deck: [inst("TST-UNIT-0", "u1"), inst("TST-OP", "op1")],
      },
      player2: { deck: [inst("TST-UNIT-0", "u2"), inst("TST-UNIT-0", "u3")] },
    });
    s = act(s, legal(s).find((a) => J(a).includes(d.instanceId))!);
    // 相手（player2）は山札を見る。オペレーションカードはないので手札には加えない。
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const a = legal(s).find((x) => x.type === "confirm_effect_choice" || x.type === "resolve_effect_choice");
      if (!a) break;
      s = act(s, a);
    }
    expect(s.players.player2.hand).toHaveLength(0);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-132");
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS446 ダイジュピター", () => {
  // atwiki/page-785 Q1 公式回答の読み替え文
  it("R-ERR-RS446: 修正後テキスト「…同じカード名のユニットカードを2枚以上選ぶことはできない」を持つ（出典: atwiki/page-785 Q1）", () => {
    expectCorrectedText(
      "RS-446",
      "【スクランブル】自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒自軍コマンドゾーンから、必要パワーを満たしているETを持つMユニットのカードを3枚まで選び、選んだカードを自軍ラッシュエリアに出す。ただし、この効果でカードを選ぶとき、同じカード名のユニットカードを2枚以上選ぶことはできない。",
    );
  });

  function jupiterState(zone: "rush" | "hand") {
    const z = inst("RS-446", "z");
    const s = specState(["RS-446"], {
      phase: "rush",
      player1: {
        rush: zone === "rush" ? [z] : [],
        hand: zone === "hand" ? [z] : [],
        power: powerCards(6),
        command: [inst("MET", "m1"), inst("MET", "m2"), inst("MET2", "m3")],
      },
    });
    s.definitions["MET"] = sUnit("MET", { name: "MET", size: "M", category: "ET", powerCost: 3 });
    s.definitions["MET2"] = sUnit("MET2", { name: "MET2", size: "M", category: "ET", powerCost: 3 });
    return { s, z: z.instanceId };
  }

  it("R-ERR-RS446: 同じカード名は1枚までしか選べない（同名2枚＋別名1枚 → 2体だけラッシュエリアに出る）（出典: atwiki/page-785）", () => {
    const { s: s0, z } = jupiterState("rush");
    const use = legal(s0).find((a) => a.type !== "end_phase" && J(a).includes(z));
    expect(use).toBeDefined();
    const s = resolveChoices(act(s0, use!));
    const rushIds = zoneIds(s, "player1", "rush");
    expect(rushIds.filter((id) => id.startsWith("MET:"))).toHaveLength(1);
    expect(rushIds).toContain("MET2:m3");
  });

  // atwiki/page-785 Q1:「カードが自軍ゾーンや自軍手札にあるとき、【スクランブル】の効果を発動することはできますか？ いいえ」
  it("R-ERR-RS446: 公式Q&A — 手札のダイジュピターでは【スクランブル】を発動できない（出典: atwiki/page-785 Q1）", () => {
    const { s, z } = jupiterState("hand");
    expect(
      legal(s).some(
        (a) =>
          a.type !== "end_phase" &&
          a.type !== "rush" &&
          a.type !== "initiate_command_payment" &&
          J(a).includes(z),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS227 爆竜トップゲイラー", () => {
  // atwiki/page-96 Q1 公式回答:「…自分自身のコマンドを、自分自身のコマンドゾーンのカテゴリの数まで可能な限り選びホールドする。」
  it("R-ERR-RS227: 修正後テキスト「…カテゴリの数まで可能な限り選びホールドする」を持つ（出典: atwiki/page-96 Q1）", () => {
    expectCorrectedText(
      "RS-227",
      "【トップウインド】自軍ターン中、これがバトルエリアに出たとき、相手は次のようにする⇒自分自身のコマンドを、自分自身のコマンドゾーンのカテゴリの数まで可能な限り選びホールドする。",
    );
  });

  function topGalerEntered(p2Commands: CardInstance[]) {
    const t = inst("RS-227", "t");
    let s = specState(["RS-227"], {
      phase: "battle",
      player1: { rush: [t], command: [released("TST-OP", "w1")] },
      player2: { battle: [inst("TST-UNIT-0", "x")], command: p2Commands },
    });
    s = enterBattleWithHold(s, t.instanceId);
    return s;
  }

  // atwiki/page-96 Q1:「このとき相手は0〜1枚を選ぶことはできますか？ いいえ、それはできません。」
  it("R-ERR-RS227: 公式Q&A — カテゴリ2つ・リリース状態2枚なら、相手は0〜1枚で止められず2枚ホールドする（出典: atwiki/page-96 Q1）", () => {
    const s0 = topGalerEntered([released("TST-OP-ET", "e1"), released("TST-OP-MA", "e2")]);
    expect(s0.pendingEffectChoice?.playerId).toBe("player2");
    expect(s0.pendingEffectChoice?.selectCount).toBe(2);
    expect(legalOfType(s0, "skip_effect_choice")).toHaveLength(0);
    const s = resolveChoices(s0);
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("R-ERR-RS227: ホールドする数はコマンドゾーンのカテゴリの数まで（カテゴリ2つ・リリース3枚なら2枚）（出典: atwiki/page-96）", () => {
    const s = resolveChoices(
      topGalerEntered([
        released("TST-OP-ET", "e1"),
        released("TST-OP-MA", "e2"),
        released("TST-OP-MA", "e3"),
      ]),
    );
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("R-ERR-RS227: 「可能な限り」— リリース状態が1枚しかなければその1枚をホールドする（出典: atwiki/page-96）", () => {
    const s = resolveChoices(
      topGalerEntered([released("TST-OP-ET", "e1"), held("TST-OP-MA", "e2")]),
    );
    expect(s.players.player2.command.every((c) => c.commandHeld === true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS030 アドベンチャー", () => {
  // atwiki/page-259「修正後は以下」:「※常駐 自分も相手も次の制限を受ける→自分自身のターンを終えるとき、自分自身のコマンドゾーンからホールド状態のコマンドを1つ選んで手札に戻す。」
  it("R-ERR-RS030: 修正後テキストの要旨「自分自身のターンを終えるとき、自分自身のコマンドゾーンから…」を持つ（出典: atwiki/page-259）", () => {
    expectCorrectedText(
      "RS-030",
      "自分自身のターンを終えるとき、自分自身のコマンドゾーンからホールド状態のコマンドを1つ選んで手札に戻す",
    );
  });

  it("R-ERR-RS030: 修正後テキスト「自分も相手も次の制限を受ける→」を持つ（出典: atwiki/page-259）", () => {
    expectCorrectedText("RS-030", "自分も相手も次の制限を受ける→");
  });

  it("R-ERR-RS030: 常駐カードとして扱われる（出典: atwiki/page-259）", () => {
    expect(getCardEffect("RS-030")?.kind).toBe("permanent");
  });

  function endTurnOf(
    ender: PlayerId,
    adventures: { player1: number; player2: number },
    enderHeld = 2,
  ) {
    const heldCmds = (p: string) =>
      Array.from({ length: enderHeld }, (_, i) => held("TST-OP", `${p}h${i}`));
    const ops = (p: string, n: number) =>
      Array.from({ length: n }, (_, i) => inst("RS-030", `${p}adv${i}`));
    let s = specState(["RS-030"], {
      phase: "battle",
      activePlayer: ender,
      player1: {
        operation: ops("p1", adventures.player1),
        command: ender === "player1" ? heldCmds("p1") : [held("TST-OP", "p1keep")],
        deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")],
      },
      player2: {
        operation: ops("p2", adventures.player2),
        command: ender === "player2" ? heldCmds("p2") : [held("TST-OP", "p2keep")],
        deck: [inst("TST-OP", "e1"), inst("TST-OP", "e2")],
      },
    });
    // ターンが相手に渡るまで進める。「1つ選んで手札に戻す」の選択には先頭の候補で応える（R-END-01）。
    for (let i = 0; i < 12 && s.activePlayer === ender; i += 1) {
      const choice = s.pendingEffectChoice;
      if (choice) {
        const pick = getLegalActions(s, choice.playerId).find((a) => a.type === "resolve_effect_choice");
        if (!pick) break;
        s = act(s, pick);
        continue;
      }
      s = act(s, { type: "end_phase", playerId: ender });
    }
    return s;
  }

  it("R-ERR-RS030: 自分のターンを終えるとき、ホールド状態のコマンドを1つ手札に戻す（出典: atwiki/page-259）", () => {
    const s = endTurnOf("player1", { player1: 1, player2: 0 });
    expect(s.players.player1.hand.filter((c) => c.cardId === "TST-OP")).toHaveLength(1);
  });

  // 「自分も相手も次の制限を受ける」— 相手も自分自身のターン終了時に戻す
  it("R-ERR-RS030: 相手も自分自身のターンを終えるときホールド状態のコマンドを1つ手札に戻す（出典: atwiki/page-259）", () => {
    const s = endTurnOf("player2", { player1: 1, player2: 0 });
    expect(zoneIds(s, "player2", "hand").filter((id) => id.startsWith("TST-OP:p2h"))).toHaveLength(1);
  });

  // card_1.html RS-030 Q1:「ターンを終えたプレイヤーが、自分自身のコマンドゾーンからホールド状態のコマンドを２枚選んで手札に戻します」
  it("R-ERR-RS030: 公式Q&A — 双方が常駐していれば重複し、ターンを終えたプレイヤーは2つ戻す（出典: grnrngr/faq-card-1 RS-030 Q1）", () => {
    const s = endTurnOf("player1", { player1: 1, player2: 1 });
    expect(zoneIds(s, "player1", "hand").filter((id) => id.startsWith("TST-OP:p1h"))).toHaveLength(2);
  });

  // card_1.html RS-030 Q2:「ターンを終えたプレイヤーのみ行います」
  it("R-ERR-RS030: 公式Q&A — ターンを終えていないプレイヤーはコマンドを戻さない（出典: grnrngr/faq-card-1 RS-030 Q2）", () => {
    const s = endTurnOf("player2", { player1: 1, player2: 0 });
    expect(zoneIds(s, "player1", "hand")).not.toContain("TST-OP:p1keep");
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS043 パトストライカー", () => {
  // atwiki/page-280「修正後は以下」:「【ジャッジメントソード】自軍ターン中、これがバトルエリアに出たとき、…」
  it("R-ERR-RS043: 修正後テキスト「自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンから…」を持つ（出典: atwiki/page-280）", () => {
    expectCorrectedText(
      "RS-043",
      "【ジャッジメントソード】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからダメージ以外のカードを2枚選んで捨札にしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP1」",
    );
  });

  function patEntered(power: CardInstance[]) {
    const pat = inst("RS-043", "pat");
    let s = specState(["RS-043"], {
      phase: "battle",
      player1: { rush: [pat], power },
      player2: { battle: [] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: pat.instanceId });
    return { s, pat: pat.instanceId };
  }

  it("R-ERR-RS043: 自軍ターン中にバトルエリアに出たとき、ダメージ以外のパワー2枚を捨札にしてSP1を得られる（出典: atwiki/page-280）", () => {
    const { s: s0, pat } = patEntered([
      inst("TST-P", "p1"),
      inst("TST-P", "p2"),
      { ...inst("TST-P", "dmg"), faceDown: true },
    ]);
    expect(s0.pendingEffectChoice?.sourceInstanceId).toBe(pat);
    expect(s0.pendingEffectChoice?.validInstanceIds).not.toContain("TST-P:dmg");
    const s = resolveChoices(s0);
    expect(zoneIds(s, "player1", "discard")).toEqual(
      expect.arrayContaining(["TST-P:p1", "TST-P:p2"]),
    );
    expect(legalOfType(s, "strike").some((a) => a.instanceId === pat)).toBe(true);
  });

  // card_1.html RS-051 Q3（RS-043 にも同じ）:「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます。それ以外のタイミングでは発動できません」
  it("R-ERR-RS043: 公式Q&A — バトルエリアに出たとき以外（ラッシュフェイズ等）には発動できない（出典: grnrngr/faq-card-1 RS-051 Q3）", () => {
    const pat = inst("RS-043", "pat");
    const s = specState(["RS-043"], {
      phase: "rush",
      player1: { battle: [pat], power: [inst("TST-P", "p1"), inst("TST-P", "p2")] },
    });
    expect(legal(s).some((a) => a.type !== "end_phase" && J(a).includes(pat.instanceId))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS051 爆竜ティラノサウルス", () => {
  // atwiki/page-83「修正後は以下」:「【超ドリル進化】自軍ターン中、これがバトルエリアに出たとき、自分の手札から「爆竜ティラノサウルス」のカードを1枚捨札にしてもよい。…」
  it("R-ERR-RS051: 修正後テキスト「自軍ターン中、これがバトルエリアに出たとき、…「爆竜ティラノサウルス」のカードを1枚捨札に…」を持つ（出典: atwiki/page-83）", () => {
    expectCorrectedText(
      "RS-051",
      "【超ドリル進化】自軍ターン中、これがバトルエリアに出たとき、自分の手札から「爆竜ティラノサウルス」のカードを1枚捨札にしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP1」",
    );
  });

  function tyrannoEntered(extraBattle: CardInstance[] = []) {
    const t = inst("RS-051", "t");
    let s = specState(["RS-051"], {
      phase: "battle",
      player1: {
        rush: [t],
        battle: extraBattle,
        hand: [inst("RS-051", "h")],
        command: [released("TST-OP", "c")],
      },
      player2: { battle: [] },
    });
    s = enterBattleWithHold(s, t.instanceId);
    return { s, t: t.instanceId };
  }

  it("R-ERR-RS051: 自軍ターン中にバトルエリアに出たとき、手札のティラノを捨札にしてSP1を得られる（出典: atwiki/page-83）", () => {
    const { s: s0, t } = tyrannoEntered();
    expect(s0.pendingEffectChoice?.sourceInstanceId).toBe(t);
    const s = resolveChoices(s0);
    expect(zoneIds(s, "player1", "discard")).toContain("RS-051:h");
    expect(legalOfType(s, "strike").some((a) => a.instanceId === t)).toBe(true);
  });

  // card_1.html RS-051 Q2:「「爆竜ティラノサウルス」を１枚捨札にして「超ドリル進化」を起動できるのは、場の「爆竜ティラノサウルス」のうちの１体だけです」
  it("R-ERR-RS051: 公式Q&A — 手札1枚の捨札で起動できるのは場のティラノ1体だけ（出典: grnrngr/faq-card-1 RS-051 Q2）", () => {
    const other = inst("RS-051", "other");
    const { s: s0, t } = tyrannoEntered([other]);
    const s = resolveChoices(s0);
    expect(legalOfType(s, "strike").some((a) => a.instanceId === t)).toBe(true);
    expect(legalOfType(s, "strike").some((a) => a.instanceId === other.instanceId)).toBe(false);
  });

  // card_1.html RS-051 Q3:「どんなタイミングでも…発動できますか？ いいえ」
  it("R-ERR-RS051: 公式Q&A — バトルエリアに出たとき以外（ラッシュフェイズ等）に手札を捨札にして発動できない（出典: grnrngr/faq-card-1 RS-051 Q3）", () => {
    const t = inst("RS-051", "t");
    const h = inst("RS-051", "h");
    const s = specState(["RS-051"], {
      phase: "rush",
      player1: { battle: [t], hand: [h] },
    });
    expect(
      legal(s).some(
        (a) =>
          a.type !== "end_phase" &&
          a.type !== "rush" &&
          a.type !== "initiate_command_payment" &&
          (J(a).includes(t.instanceId) || J(a).includes(h.instanceId)),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS118 ゴーゴーダンプ", () => {
  // atwiki/page-292「修正後は以下」:「…（Sユニットの下に重ねたカードは、そのSユニットに重ねたまま置きかえる）…」
  it("R-ERR-RS118: 修正後テキスト「（Sユニットの下に重ねたカードは、そのSユニットに重ねたまま置きかえる）」を持つ（出典: atwiki/page-292）", () => {
    expectCorrectedText(
      "RS-118",
      "【プレシャスの護り手】自軍バトルフェイズ中、これを自軍バトルエリアに出すとき、自軍バトルエリアのSユニット1体と置きかえて出してもよい（Sユニットの下に重ねたカードは、そのSユニットに重ねたまま置きかえる）。そうしたとき、これはアタックできず、置きかえたSユニットはこのターン、再びバトルエリアに出られない。",
    );
  });

  function dumpSwap() {
    const d = inst("RS-118", "d");
    const s1 = { ...inst("TST-UNIT-0", "s1"), stackedCards: [inst("TST-OP", "under")] };
    let s = specState(["RS-118"], {
      phase: "battle",
      player1: { rush: [d], battle: [s1] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: d.instanceId });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: s1.instanceId });
    s = resolveChoices(s);
    return { s, d: d.instanceId, s1: s1.instanceId };
  }

  it("R-ERR-RS118: 置きかえたSユニットの下に重ねたカードは、そのSユニットに重ねたままラッシュエリアへ移る（出典: atwiki/page-292）", () => {
    const { s, d, s1 } = dumpSwap();
    expect(zoneIds(s, "player1", "battle")).toContain(d);
    const moved = s.players.player1.rush.find((c) => c.instanceId === s1);
    expect(moved).toBeDefined();
    expect(moved?.stackedCards?.map((c) => c.instanceId)).toEqual(["TST-OP:under"]);
  });

  it("R-ERR-RS118: 置きかえて出したゴーゴーダンプはアタックできず、置きかえたSユニットはこのターン再びバトルエリアに出られない（出典: atwiki/page-292）", () => {
    const { s, d, s1 } = dumpSwap();
    expect(legalOfType(s, "battle").some((a) => a.attackerInstanceId === d)).toBe(false);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === s1)).toBe(false);
  });

  // atwiki/page-292 Q1:「ラッシュエリアに戻ったとして【アクセルグランツァー】の効果を発動することはできますか？ はい、できます。」
  it.todo(
    "R-ERR-RS118: Q&A — 置きかえで XP-026 仮面ライダーアクセルがラッシュエリアに移ると【アクセルグランツァー】を発動できる（出典: atwiki/page-292 Q1）— XP-026 の当該効果はエラッタ箇所と独立しており本章の範囲外",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG2-014 鉄面臂張遼", () => {
  // atwiki/page-1754「修正後は以下」
  it("R-ERR-XG2-014: 修正後テキスト「MAとDAの両方を持つ自軍コマンドを1つ選びホールドするか、MAのみ…とDAのみ…を1つずつ選びホールドしてもよい」を持つ（出典: atwiki/page-1754）", () => {
    expectCorrectedText(
      "XG2-014",
      "【気力妖力合体】「SP1」 MAとDAの両方を持つ自軍コマンドを1つ選びホールドするか、MAのみを持つ自軍コマンドとDAのみを持つ自軍コマンドを1つずつ選びホールドしてもよい。そうしたとき、敵軍Sユニットを1体選び撃破する。",
    );
  });

  // atwiki/page-1754 Q1:「「MAのみを持つ自軍コマンドとDAのみを持つ自軍コマンドを1つずつ選んでその両方をホールドする」のいずれかの操作を行ってください」
  it("R-ERR-XG2-014: Q&A — MAのみとDAのみのコマンドを1つずつホールドして敵軍Sユニットを撃破できる（出典: atwiki/page-1754 Q1）", () => {
    const z = inst("XG2-014", "z");
    let s = specState(["XG2-014"], {
      phase: "battle",
      player1: {
        rush: [z],
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2")],
        command: [released("TST-OP-MA", "ma"), released("TST-OP-DA", "da")],
      },
      player2: { battle: [inst("TST-UNIT-0", "e1")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: z.instanceId });
    s = resolveChoices(s);
    expect(s.players.player1.command.every((c) => c.commandHeld === true)).toBe(true);
    expect(zoneIds(s, "player2", "discard")).toContain("TST-UNIT-0:e1");
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-XG4-004 副長ゼルモダ", () => {
  // atwiki/page-2069「修正後は以下」
  it("R-ERR-XG4-004: 修正後テキスト「…特徴「戦闘員」を持つカードを2枚まで選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする」を持つ（出典: atwiki/page-2069）", () => {
    expectCorrectedText(
      "XG4-004",
      "【ワンパーの壺】これをラッシュしたとき、次の効果を発動できる⇒自軍山札を見て特徴「戦闘員」を持つカードを2枚まで選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。",
    );
  });

  function zerumodaRushed(deck: CardInstance[]) {
    const z = inst("XG4-004", "z");
    let s = specState(["XG4-004"], {
      phase: "rush",
      player1: {
        hand: [z],
        command: [released("TST-OP-DA", "da")],
        power: powerCards(4),
        deck,
      },
    });
    s.definitions["SENT"] = sUnit("SENT", { features: ["戦闘員"], category: "DA" });
    s = act(s, legal(s).find((a) => J(a).includes(z.instanceId))!);
    return { s, z: z.instanceId };
  }

  it("R-ERR-XG4-004: ラッシュしたとき、山札の「戦闘員」を2枚までラッシュエリアに出せる（出典: atwiki/page-2069）", () => {
    let { s } = zerumodaRushed([
      inst("SENT", "s1"),
      inst("SENT", "s2"),
      inst("SENT", "s3"),
      inst("TST-OP", "x"),
    ]);
    s = resolveChoices(s);
    expect(zoneIds(s, "player1", "rush").filter((id) => id.startsWith("SENT:"))).toHaveLength(2);
  });

  // atwiki/page-2069 Q1:「その場合は0枚選んだとしてそのまま処理を続けてください」
  it("R-ERR-XG4-004: Q&A — 山札に「戦闘員」がなくても処理は中断されずラッシュが完了する（出典: atwiki/page-2069 Q1）", () => {
    const { s, z } = zerumodaRushed([inst("TST-OP", "x1"), inst("TST-OP", "x2")]);
    expect(zoneIds(s, "player1", "rush")).toContain(z);
    // 山札を見るだけの窓（選べるカードはない。rules/deckLook.ts）が開き、閉じれば終わる。
    expect(s.pendingEffectChoice?.effectId).toBe("deck_look");
    expect(s.pendingEffectChoice?.deckLookInstanceIds).toHaveLength(2);
    const t = applyAction(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(t.ok).toBe(true);
    expect(t.state!.pendingEffectChoice).toBeUndefined();
    expect(t.state!.players.player1.deck).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK231 オロチ", () => {
  // atwiki/page-948「修正後は以下」（クロスギャザーコンプリートブックでエラッタ）
  it("R-ERR-RK231: 修正後テキスト「【潜水】自分がターンを終えるとき、このユニットをリリースするか、ホールドしてもよい」を持つ（出典: atwiki/page-948）", () => {
    expectCorrectedText(
      "RK-231",
      "【潜水】自分がターンを終えるとき、このユニットをリリースするか、ホールドしてもよい。これはホールド状態のとき、アタックもストライクもすることができず、敵軍ユニットにアタックされない。",
    );
    expect(norm(engineText("RK-231"))).not.toContain(norm("【潜水】自分がターンを終えるとき、これを"));
  });

  it("R-ERR-RK231: 自分がターンを終えるとき、このユニットをホールドするかを選べる（出典: atwiki/page-948）", () => {
    const o = inst("RK-231", "o");
    let s = specState(["RK-231"], {
      phase: "battle",
      player1: { battle: [o], deck: [inst("TST-OP", "d")] },
      player2: { deck: [inst("TST-OP", "e")] },
    });
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(s.activePlayer).toBe("player1");
    expect(legal(s).some((a) => a.playerId === "player1" && J(a).includes(o.instanceId))).toBe(true);
  });

  it("R-ERR-RK231: ホールド状態のオロチは敵軍ユニットにアタックされない（出典: atwiki/page-948）", () => {
    const o = { ...inst("RK-231", "o"), commandHeld: true };
    const atk = inst("TST-UNIT-7", "atk");
    const s = specState(["RK-231"], {
      phase: "battle",
      player1: { battle: [atk] },
      player2: { battle: [o] },
    });
    expect(legalOfType(s, "battle").some((a) => a.defenderInstanceId === o.instanceId)).toBe(false);
  });

  it("R-ERR-RK231: ホールド状態のオロチはアタックもストライクもできない（出典: atwiki/page-948）", () => {
    const o = { ...inst("RK-231", "o"), commandHeld: true };
    const s = specState(["RK-231"], {
      phase: "battle",
      player1: { battle: [o] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    expect(
      legal(s).some(
        (a) =>
          (a.type === "battle" && a.attackerInstanceId === o.instanceId) ||
          (a.type === "strike" && a.instanceId === o.instanceId),
      ),
    ).toBe(false);
  });
});
