/**
 * docs/rules/05-battle-strike-damage.md §3 BP / §4 ストライク・SP / §5 ダメージ
 * 期待値はルールブックと docs/rules/sources/web/ の公式・atwiki ページに従う（現エンジンの挙動ではない）。
 */
import { describe, expect, it } from "vitest";
import { rushWithCategoryHold } from "../testing/rushPayment";
import {
  act,
  attack,
  battleState,
  canStrike,
  deckCards,
  endTurn,
  enter,
  faceDownCount,
  fillers,
  ids,
  inst,
  legal,
  legalOfType,
  legendDefinitions,
  passEntry,
  powerCards,
  releasedCommands,
  heldCommands,
  settle,
  strike,
  zoneOf,
} from "./05-helpers";
import type { GameState } from "../types/game";

function toBattlePhase(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 8 && s.phase !== "battle"; i++) {
    const next =
      legal(s).find((a) => a.type === "draw") ??
      legal(s).find((a) => a.type === "return_all_battle_to_rush") ??
      legal(s).find((a) => a.type === "end_phase");
    if (!next) break;
    s = act(s, next);
  }
  return s;
}

// ---------------------------------------------------------------------------
// §3 BP
// ---------------------------------------------------------------------------

describe("R-BP-01 BP の計算順", () => {
  // 「「指定の値になる」を最も優先し、計算は行われません」
  it("R-BP-01: ジークで BP500 になったサイクロン号ライド中の1号は、ゴーマ16世があってもサイクロン号の修正を計算しない（出典: grnrngr/faq-rider-2 RK-154 Q1・公式FAQ リファレンス）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RK-154", "jeek")],
        power: powerCards(3),
        command: releasedCommands(1, "TST-OP-OT", "ot"),
        rush: [inst("RS-210", "goma16"), inst("RS-080", "hydra")],
      },
      player2: {
        battle: [inst("RK-024", "bike"), { ...inst("RK-023", "one"), mountedOnInstanceId: "RK-024:bike" }],
      },
    });
    const r = rushWithCategoryHold(s, "player1", "RK-154:jeek", "TST-OP-OT:ot0");
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
    // 【頭が高い！】で敵軍 RK-023 を選ぶ
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).toContain("RK-023:one");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RK-023:one" } as never);
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" } as never);
    s = settle(s);
    s = act(s, { type: "end_phase", playerId: "player1" });
    // BP500 のヒドラー兵でアタック → BP500 同士の相打ちになる
    s = enter(s, "RS-080:hydra");
    s = settle(attack(s, "RS-080:hydra", "RK-023:one"));
    expect(zoneOf(s, "player2", "RK-023:one")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-080:hydra")).toBe("discard");
  });

  // 「指定の値になる」が優先（ミラージュビーム「BPを…BPとしてバトルする」）
  it("R-BP-01: ミラージュビームで BP が指定値になるバトルでは、超力の BP＋は計算されない（出典: 公式FAQ リファレンス「ＢＰの値を変化させる効果の計算順序」）", () => {
    let s = battleState({
      player1: {
        operation: [inst("RS-019", "chouriki")],
        battle: [inst("RS-131", "metz")],
        // 超力はアタックするときに新たにホールドしたコマンドを数える（atwiki/page-243）ので、リリース状態で用意する。
        command: releasedCommands(2),
        deck: [inst("TST-UNIT-2", "top"), ...deckCards(2)],
      },
      player2: { battle: [inst("RS-062", "bred")] },
    });
    // 指定値 3000（山札トップ）vs BP4000。超力 +2000 を足すと 5000 で勝ってしまう
    s = settle(holdForAttack(attack(s, "RS-131:metz", "RS-062:bred"), 2));
    expect(zoneOf(s, "player1", "RS-131:metz")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-062:bred")).toBe("battle");
  });

  it.todo(
    "R-BP-01: 同タイミングの「＋」と「－」は＋→－の順に計算する — 計算順で結果が変わる（BP0 を跨ぐ）組み合わせを収録カードで作れないため",
  );
  it.todo(
    "R-BP-01: 「～になる」が複数あれば低い方を適用する — 2つの「BP～になる」を同じユニットに同時適用できるカード組み合わせが未実装のため",
  );
});

describe("R-BP-02 BP0 はルールによる撃破", () => {
  // 「効果によってＢＰが０になったユニットは撃破される」
  it("R-BP-02: 敵軍オートバジンBM 下で BP500 の S ユニットをバトルエリアに出すと BP0 になり撃破される（出典: atwiki/page-458）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-080", "hydra")] },
      player2: { battle: [inst("RK-046", "bm")] },
    });
    s = settle(enter(s, "RS-080:hydra"));
    expect(zoneOf(s, "player1", "RS-080:hydra")).toBe("discard");
  });

  // 「RCを発動させてから撃破される）ことはできますか？」「はい、できます」
  it("R-BP-02: オートバジンBM 下でライドオフした G3MILD は BP0 になり撃破される（出典: grnrngr/faq-rider-1 RK-031 Q2）", () => {
    let s = battleState({
      player1: { rush: [inst("RK-031", "g3"), inst("RK-058", "zect")], deck: [inst("TST-OP", "top"), ...deckCards(2)] },
      player2: { battle: [inst("RK-046", "bm")] },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:g3", vehicleInstanceId: "RK-058:zect" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      const yes = legal(s).find((a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice");
      if (!yes) break;
      s = act(s, yes);
    }
    s = settle(s);
    // BP500（ライドオフでビークル修正なし）－500 = BP0 → 撃破
    expect(zoneOf(s, "player1", "RK-031:g3")).toBe("discard");
  });

  it.todo(
    "R-BP-02: BP0 の撃破と RC（バッテリー交換）は同時とみなしターンプレイヤーが RC を先に解決できる（出典: grnrngr/faq-rider-1 RK-031 Q2）— RK-031 の RC がエンジンで山札→コマンドの処理を行わず観測できないため",
  );

  // 「撃破されて捨札になるより先に）バトルになり…ストライクは無効」
  it("R-BP-02: ファイブテクターで出した BP500 のユニットは BP0 でも先にバトルになり、オートバジンBM のストライクは無効になる（出典: grnrngr/faq-rider-1 RK-046 Q5）", () => {
    let s = battleState({
      player1: { battle: [...fillers(4), inst("RK-046", "bm")] },
      player2: { operation: [inst("RS-014", "ft")], rush: [inst("RS-080", "hydra")], power: powerCards(4) },
    });
    expect(canStrike(s, "RK-046:bm")).toBe(true);
    s = strike(s, "RK-046:bm");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "RS-080:hydra" });
    s = settle(s);
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player2", "RS-080:hydra")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-046:bm")).toBe("battle");
  });
});

// ---------------------------------------------------------------------------
// §4 ストライク・SP
// ---------------------------------------------------------------------------

describe("R-STK-01 ストライクとダメージ量", () => {
  // 「記載が整数の場合はそのままダメージをその数値分与える」
  it("R-STK-01: SP2 のユニットのストライクは相手に2点のダメージを与える（出典: atwiki/page-104・page-103）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "sp2")] },
      player2: { power: powerCards(4) },
    });
    s = settle(strike(s, "TST-UNIT-2:sp2"));
    expect(s.players.player2.damage).toBe(2);
    expect(faceDownCount(s, "player2")).toBe(2);
  });

  // 「記載が整数の場合はそのままダメージをその数値分与える」
  it("R-STK-01: SP1 のユニットのストライクは1点（出典: atwiki/page-104）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "sp1")] },
      player2: { power: powerCards(4) },
    });
    s = settle(strike(s, "TST-UNIT-0:sp1"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「今のところ固定値の最高値は４」
  it("R-STK-01: 収録カードの固定値 SP は4以下（出典: atwiki/page-104）", () => {
    const fixed = Object.values(legendDefinitions)
      .map((d) => d.sp)
      .filter((sp): sp is number => typeof sp === "number");
    expect(fixed.length).toBeGreaterThan(0);
    expect(Math.max(...fixed)).toBeLessThanOrEqual(4);
  });
});

describe("R-STK-02 SP「！」", () => {
  // 「ＣＮやテキストの効果などによってストライクポイントが決定する」
  it("R-STK-02: SP「！」のマジレッドは CN の位置でなければストライクできない（出典: atwiki/page-104）", () => {
    let s = battleState({
      player1: { rush: [inst("RS-057", "red")] },
      player2: { power: powerCards(3) },
    });
    s = enter(s, "RS-057:red");
    expect(canStrike(s, "RS-057:red")).toBe(false);
  });

  // 「ＣＮやテキストの効果などによってストライクポイントが決定する」
  it("R-STK-02: SP「！」のマジレッドは3番目に出て NC の「SP1」を得ればストライクで1点与える（出典: atwiki/page-104）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-057", "red")] },
      player2: { power: powerCards(3) },
    });
    s = enter(s, "RS-057:red");
    expect(canStrike(s, "RS-057:red")).toBe(true);
    s = settle(strike(s, "RS-057:red"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「発動した能力の有効期限は通常はターン終了時まで」
  it("R-STK-02: NC で得た「SP1」はターン終了時に失われる（出典: atwiki/page-104）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-057", "red")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    s = passEntry(enter(s, "RS-057:red"));
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-057:red")?.spModifier).toBe(1);
    s = endTurn(s);
    const red = s.players.player1.battle.find((c) => c.instanceId === "RS-057:red");
    expect(red).toBeDefined();
    expect(red?.spModifier ?? 0).toBe(0);
  });

  // 「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます」
  it("R-STK-02: 爆竜ティラノサウルスの SP を得る効果は自軍ラッシュフェイズには発動できない（出典: grnrngr/faq-card-1 RS-051 Q3）", () => {
    const s = battleState({
      phase: "rush",
      player1: { battle: [inst("RS-051", "t")], hand: [inst("RS-051", "h")], command: heldCommands(1) },
    });
    const uses = legal(s).filter((a) => a.type !== "end_phase" && JSON.stringify(a).includes("RS-051:t"));
    expect(uses).toHaveLength(0);
  });

  // 「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます」
  // R-ERR-RS051 の読み替え後テキストは「自軍ターン中、これがバトルエリアに出たとき」。バトルエリアに
  // 居続ける爆竜ティラノサウルスが後から起動する手段はないため、FAQ Q3 の内容（SP を得る効果を
  // 自軍バトルフェイズに発動できる）を、エラッタ後の発動タイミング＝自軍バトルフェイズにバトルエリアへ
  // 出たときで確かめる。
  it("R-STK-02: 爆竜ティラノサウルスの SP を得る効果は、自軍バトルフェイズにバトルエリアに出たとき発動でき、SP1 を得てストライクで1点与える（出典: grnrngr/faq-card-1 RS-051 Q3, R-ERR-RS051）", () => {
    let s = battleState({
      player1: {
        battle: fillers(2),
        rush: [inst("RS-051", "t")],
        hand: [inst("RS-051", "h")],
        command: [inst("TST-OP-OT", "ot")],
      },
      player2: { power: powerCards(3) },
    });
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-051:t" });
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:ot"] });
    expect(zoneOf(s, "player1", "RS-051:t")).toBe("battle");
    expect(s.pendingEffectChoice?.effectId).toBe("super_drill");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("RS-051:h");
    // 対照: 発動しなければ SP「！」のままでストライクできない
    expect(canStrike(act(s, { type: "skip_effect_choice", playerId: "player1" } as never), "RS-051:t")).toBe(false);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-051:h" } as never);
    expect(zoneOf(s, "player1", "RS-051:h")).toBe("discard");
    expect(canStrike(s, "RS-051:t")).toBe(true);
    s = settle(strike(s, "RS-051:t"));
    expect(s.players.player2.damage).toBe(1);
  });
});

describe("R-STK-03 分数 SP", () => {
  // 「「１/２」のユニットはバトルエリアの２番目に並んでいる間ＳＰ１」
  it("R-STK-03: SP1/2 のユニットは2番目に並べばストライクで1点与える（出典: atwiki/page-104）", () => {
    let s = battleState({
      player1: { battle: fillers(1), rush: [inst("RK-038", "gai")] },
      player2: { power: powerCards(3) },
    });
    s = enter(s, "RK-038:gai");
    expect(canStrike(s, "RK-038:gai")).toBe(true);
    s = settle(strike(s, "RK-038:gai"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「分母の数字と同じ順番に並んでいれば、常に「SP1」」
  it("R-STK-03: SP1/2 のユニットが3番目ならストライクできない（出典: atwiki/page-104）", () => {
    let s = battleState({ player1: { battle: fillers(2), rush: [inst("RK-038", "gai")] } });
    s = enter(s, "RK-038:gai");
    expect(canStrike(s, "RK-038:gai")).toBe(false);
  });

  // 「並び順が変わる度にその値が更新されます」（Q2）
  it("R-STK-03: 3番目の SP1/2 は左のユニットが撃破されて2番目になれば SP1 になりストライクできる（出典: atwiki/page-104 Q2）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "left"), inst("TST-UNIT-0", "mid"), inst("RK-038", "gai")] },
      player2: { battle: [inst("TST-UNIT-2", "wall")], power: powerCards(3) },
    });
    expect(canStrike(s, "RK-038:gai")).toBe(false);
    s = settle(attack(s, "TST-UNIT-0:left", "TST-UNIT-2:wall"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:left")).toBe("discard");
    expect(canStrike(s, "RK-038:gai")).toBe(true);
  });

  // 「並び順が変わる度にその値が更新されます」（Q3）
  it("R-STK-03: 2番目の SP1/2 は並び順が変わって2番目でなくなれば SP1 でなくなる（出典: atwiki/page-104 Q3）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "left"), inst("RK-038", "gai")] },
      player2: { battle: [inst("TST-UNIT-2", "wall")] },
    });
    expect(canStrike(s, "RK-038:gai")).toBe(true);
    s = settle(attack(s, "TST-UNIT-0:left", "TST-UNIT-2:wall"));
    expect(canStrike(s, "RK-038:gai")).toBe(false);
  });

  // 「はい、持続します。…常に「SP1」として扱います」（Q1）
  it("R-STK-03: 分数 SP の SP1 は敵軍ターン中も持続し、一点突破の対象になる（出典: atwiki/page-104 Q1・grnrngr/faq-card-1 RS-065 Q1）", () => {
    // player2 ターン: ボウケンイエロー（3番目, 一点突破）が player1 の2番目の SP1/2（BP1000）と相打ち → 1点
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: fillers(2, "e"), rush: [inst("RS-065", "by")] },
      player1: { battle: [inst("TST-UNIT-2", "p1first"), inst("RK-112", "alt")], power: powerCards(3) },
    });
    s = enter(s, "RS-065:by", "player2");
    s = settle(attack(s, "RS-065:by", "RK-112:alt", "player2"));
    expect(zoneOf(s, "player1", "RK-112:alt")).toBe("discard");
    expect(s.players.player1.damage).toBe(1);
  });

  // 「分数表記のＳＰは「ＳＰ！」と同一には扱いません」
  it("R-STK-03: 分母の位置にいない分数 SP のユニットを一点突破で撃破してもダメージは与えない（出典: grnrngr/faq-card-1 RS-065 Q1）", () => {
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: fillers(2, "e"), rush: [inst("RS-065", "by")] },
      player1: { battle: [inst("TST-UNIT-2", "a"), inst("TST-UNIT-2", "b"), inst("RK-112", "alt")], power: powerCards(3) },
    });
    s = enter(s, "RS-065:by", "player2");
    s = settle(attack(s, "RS-065:by", "RK-112:alt", "player2"));
    expect(zoneOf(s, "player1", "RK-112:alt")).toBe("discard");
    expect(s.players.player1.damage).toBe(0);
  });

  // 「分数表記のユニットはラッシュエリアにある間は「ＳＰ１」でも「ＳＰ！」でもありません」
  it("R-STK-03: 敵軍ハリケンレオンがあっても分数 SP のユニットはコマンドをホールドせずに出られる（出典: grnrngr/faq-card-2 RS-097 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(1), rush: [inst("RK-038", "gai")], command: [] },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    expect(legalOfType(s, "move_to_battle").map((a) => a.instanceId)).toContain("RK-038:gai");
    s = enter(s, "RK-038:gai");
    expect(zoneOf(s, "player1", "RK-038:gai")).toBe("battle");
  });

  // 「「コンビネーションナンバー（ナンバー）」とは…左端に書かれた表記」（Q4）
  it("R-STK-03: 分母はナンバーではないので、敵軍コロン（S ユニットのナンバー＋1）があっても SP1/2 は2番目で SP1（出典: atwiki/page-104 Q4）", () => {
    let s = battleState({
      player1: { battle: fillers(1), rush: [inst("RK-038", "gai")] },
      player2: { rush: [inst("RS-140", "colon")], power: powerCards(3) },
    });
    s = enter(s, "RK-038:gai");
    expect(canStrike(s, "RK-038:gai")).toBe(true);
  });

  // 「分数表記のユニットが「SP1」になるのは、ナンバーコンビネーション（NC）ではありません」（Q5）
  it("R-STK-03: 分数 SP の SP1 は NC の発動ではない（NC 発動記録なしで SP1）（出典: atwiki/page-104 Q5）", () => {
    let s = battleState({ player1: { battle: fillers(1), rush: [inst("RK-038", "gai")] } });
    s = enter(s, "RK-038:gai");
    const gai = s.players.player1.battle.find((c) => c.instanceId === "RK-038:gai");
    expect(gai?.activatedNcEffects ?? []).toHaveLength(0);
    expect(s.log.some((l) => l.includes("number_combo") && l.includes("RK-038"))).toBe(false);
    expect(canStrike(s, "RK-038:gai")).toBe(true);
  });
});

describe("R-STK-04 SP 空欄", () => {
  // 「テキスト上ＳＰ「０」である事を指す」
  it("R-STK-04: SP 空欄のユニットはストライクできない（出典: atwiki/page-104）", () => {
    let s = battleState({ player1: { battle: fillers(1), rush: [inst("RS-059", "blue")], deck: deckCards(2) } });
    s = enter(s, "RS-059:blue");
    expect(canStrike(s, "RS-059:blue")).toBe(false);
  });

  it.todo(
    "R-STK-04: SP を得ている間は「SP 空欄」の対象から外れる — 「SP 空欄のユニット」を参照する効果と SP 付与を組み合わせた状況をエンジン API で検証する手段が無いため",
  );
  it.todo(
    "R-STK-04: 同時の SP 変動はターンプレイヤーが適用順を決める（レッドパンチャー＋トータスハンマーの例）— 適用順選択がエンジンに無く、該当カードも未実装のため",
  );
});

describe("R-STK-05 ストライクを無効にしてバトルさせる効果", () => {
  // 「相手のストライクを無効にしてかわりにバトルさせる」
  it("R-STK-05: ファイブテクターで S ユニットを出すとストライクは無効になりバトルになる（出典: grnrngr/faq-card-1 RS-014 Q1）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: { operation: [inst("RS-014", "ft")], rush: [inst("TST-UNIT-0", "s")], power: powerCards(4) },
    });
    s = strike(s, "TST-UNIT-2:atk");
    expect(legalOfType(s, "five_tech_intercept").map((a) => a.interceptInstanceId)).toContain("TST-UNIT-0:s");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "TST-UNIT-0:s" });
    s = settle(s);
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("discard");
  });

  // 「アタックされたときを発動条件とする隠流忍術を発動することもできません」
  it("R-STK-05: ファイブテクターによるバトルはアタックではないので隠流忍術を使えない（出典: grnrngr/faq-card-1 RS-014 Q1・RS-018 Q8）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "atk")] },
      player2: {
        operation: [inst("RS-014", "ft")],
        battle: [inst("TST-UNIT-0", "other")],
        rush: [inst("TST-UNIT-0", "s")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = strike(s, "TST-UNIT-2:atk");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "TST-UNIT-0:s" });
    const ninjutsu = legal(s).filter(
      (a) => a.playerId === "player2" && JSON.stringify(a).includes("RS-018:ninjutsu"),
    );
    expect(ninjutsu).toHaveLength(0);
  });

  // 「「アタックしたとき」ではないのでＢＰ修正されません」
  it("R-STK-05: ファイブテクターでバトルになったマジレッドは「アタックするとき」の BP＋を得ない（出典: grnrngr/faq-card-1 RS-057 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-057", "red")], command: releasedCommands(2) },
      player2: { operation: [inst("RS-014", "ft")], rush: [inst("RS-062", "bred")], power: powerCards(4) },
    });
    s = enter(s, "RS-057:red");
    s = strike(s, "RS-057:red");
    // ボウケンレッド（S, BP4000）を出す。マジレッド BP2000（＋2000 は不適用）なので負ける
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "RS-062:bred" });
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-062:bred")).toBe("battle");
  });
});

// ---------------------------------------------------------------------------
// §5 ダメージ
// ---------------------------------------------------------------------------

describe("R-DMG-01 ダメージの表し方", () => {
  // 「パワーゾーンにあるウラ向きのカード1枚につき1点」
  it("R-DMG-01: ストライク後のダメージ点数はパワーゾーンのウラ向き枚数と一致する（出典: atwiki/page-105）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "sp2")] },
      player2: { power: [...powerCards(2, "up"), ...powerCards(1, "down", true)], damage: 1 },
    });
    s = settle(strike(s, "TST-UNIT-2:sp2"));
    expect(faceDownCount(s, "player2")).toBe(3);
    expect(s.players.player2.damage).toBe(3);
  });

  // 「相手のパワーゾーンの裏向きのカードが７枚になった時点」で勝利
  it("R-DMG-01: ウラ向きが7枚になった時点でストライクした側が勝利する（出典: grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "sp1")] },
      player2: { power: [...powerCards(6, "down", true), ...powerCards(1, "up")], damage: 6 },
    });
    s = settle(strike(s, "TST-UNIT-0:sp1"));
    expect(faceDownCount(s, "player2")).toBe(7);
    expect(s.winner).toBe("player1");
  });

  // 「パワーゾーンにあるウラ向きのカード1枚につき1点」
  it("R-DMG-01: ダメージはウラ向き枚数で数える（独立カウンタではない）— ウラ向き6枚の相手に1点で勝利（出典: atwiki/page-105）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "sp1")] },
      player2: { power: [...powerCards(6, "down", true), ...powerCards(1, "up")], damage: 0 },
    });
    s = settle(strike(s, "TST-UNIT-0:sp1"));
    expect(s.winner).toBe("player1");
  });
});

describe("R-DMG-02 ダメージの受け方", () => {
  // 「はい、自由に選ぶことができます」
  it("R-DMG-02: ダメージを受けるプレイヤーはオモテ向きのどのカードでも選んで裏返せる（出典: atwiki/page-109 Q1・公式FAQ リファレンス「パワーゾーン」）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "sp1")] },
      player2: { power: powerCards(5) },
    });
    s = strike(s, "TST-UNIT-0:sp1");
    const choices = legalOfType(s, "resolve_damage_payment");
    expect(choices.every((a) => a.playerId === "player2")).toBe(true);
    expect(choices.map((a) => a.instanceId).sort()).toEqual(ids(powerCards(5)).sort());
    s = act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: "TST-P:pw2" });
    s = settle(s);
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-P:pw2")?.faceDown).toBe(true);
    expect(faceDownCount(s, "player2")).toBe(1);
  });

  // 「裏返しにできるカードがなければ、山札の上から１枚を裏向きのまま」
  it("R-DMG-02: オモテ向きのカードが無ければ山札の上から1枚をウラ向きでパワーゾーンに置く（出典: grnrngr/rule_phase4・atwiki/page-105）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "sp1")] },
      player2: { power: powerCards(1, "down", true), damage: 1, deck: [inst("TST-OP", "top"), inst("TST-OP", "second")] },
    });
    s = settle(strike(s, "TST-UNIT-0:sp1"));
    const top = s.players.player2.power.find((c) => c.instanceId === "TST-OP:top");
    expect(top?.faceDown).toBe(true);
    expect(ids(s.players.player2.deck)).toEqual(["TST-OP:second"]);
    expect(s.players.player2.damage).toBe(2);
  });

  // 「なければ山札の上から1枚」（オモテ向きが足りない分だけ）
  it("R-DMG-02: 2点のダメージでオモテ向きが1枚しかなければ、それを裏返し残り1点は山札の上から置く（出典: grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "sp2")] },
      player2: { power: powerCards(1, "up"), deck: [inst("TST-OP", "top"), inst("TST-OP", "second")] },
    });
    s = settle(strike(s, "TST-UNIT-2:sp2"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-P:up0")?.faceDown).toBe(true);
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP:top")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(2);
  });

  it.todo("R-DMG-02: [未確定] 山札が空でダメージを山札から置けない場合の処理（R-WIN-05・資料に記載なし）");
});

/** RS-019 超力: アタック時に開くホールド数の選択（0〜リリース数）で n を選ぶ。 */
function holdForAttack(s: GameState, n: number): GameState {
  expect(s.pendingEffectChoice?.effectId).toBe("attack_hold_bonus");
  return act(s, { type: "resolve_effect_choice", playerId: s.pendingEffectChoice!.playerId, instanceId: String(n) });
}
