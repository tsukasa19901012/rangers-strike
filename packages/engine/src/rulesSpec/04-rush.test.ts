/**
 * docs/rules/04-rush.md（04 ラッシュ）のルールテスト。
 *
 * 期待値はルールブック本文と、その出典の Web 原文
 * （docs/rules/sources/web/ 配下の公式 FAQ・atwiki・公式ルール）に従う。
 * エンジンの現状に合わせて期待値を弱めることはしない。
 * 現状のエンジンが満たさない正しいテストは it.fails で残し、不具合 ID を付記する。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../index";
import {
  act,
  battleEntryHoldsRequired,
  canCounter,
  canStartRush,
  cardIn,
  counterReadyOpponent,
  held,
  heldCount,
  inst,
  legal,
  mk,
  passRushWindow,
  powers,
  released,
  rushedThisTurn,
  rushFromHand,
  tryEnterBattle,
  tryRushFromHand,
  tryRushZord,
  zoneOf,
} from "./04-helpers";

// ---------------------------------------------------------------------------
// テスト専用のバニラカード（効果なし。必要な数値だけを持つ）
// ---------------------------------------------------------------------------
const T04: Record<string, CardDefinition> = {
  "T04-S5": {
    id: "T04-S5",
    name: "テスト必要パワー5",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 5,
    bp: 1000,
    sp: 1,
    size: "S",
  },
  "T04-YELLOW": {
    id: "T04-YELLOW",
    name: "テストイエロー",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 7000,
    size: "S",
    features: ["イエロー"],
  },
  "T04-FRAC": {
    id: "T04-FRAC",
    name: "テスト分数SP",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    sp: "1/2",
    size: "S",
  },
  "T04-AIR": {
    id: "T04-AIR",
    name: "テスト航空機",
    type: "unit",
    category: "DA",
    rarity: "N",
    expansion: "test",
    powerCost: 5,
    bp: 1000,
    size: "S",
    features: ["航空機"],
  },
};

type MkOptions = Parameters<typeof mk>[0];
function mk4(options: MkOptions = {}): GameState {
  return mk({ ...options, definitions: { ...T04, ...(options?.definitions ?? {}) } });
}

/** 保留中の効果選択を、指定インスタンス（無ければ先頭の候補）で解決する。 */
function resolveChoice(state: GameState, playerId: PlayerId, instanceId?: string): GameState {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return state;
  const pick = instanceId ?? pending.validInstanceIds[0];
  if (!pick) return state;
  return act(state, { type: "resolve_effect_choice", playerId, instanceId: pick });
}

/** 指定プレイヤーの保留中効果選択をすべて解決する（先頭候補を選ぶ）。 */
function drainChoices(state: GameState, playerId: PlayerId, prefer: string[] = []): GameState {
  let next = state;
  for (let i = 0; i < 6; i += 1) {
    const pending = next.pendingEffectChoice;
    if (!pending || pending.playerId !== playerId) break;
    const preferred = prefer.find((id) => pending.validInstanceIds.includes(id));
    next = resolveChoice(next, playerId, preferred);
  }
  return next;
}

/** 「コマンドを選んでホールドする」効果選択（select_commands）を指定コマンドで解決する。 */
function holdCommandsForEffect(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || pending.kind !== "select_commands") return state;
  let next = act(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "effect_hold",
    sourceInstanceId: ids[0]!,
  });
  next = act(next, { type: "resolve_command_payment", playerId, commandInstanceIds: ids });
  return next;
}

/** ランドバルカン（RS-005, ET 必要パワー3）を P1 が使用する。 */
function playLandVulcan(state: GameState): GameState {
  const action = legal(state).find(
    (a) => a.type === "play_operation" && a.playerId === "player1" && a.instanceId === "RS-005:lv",
  );
  if (!action) throw new Error("land vulcan not playable");
  return act(state, action);
}

/** パワーバズーカ（RS-009, ET 必要パワー8）を P1 が敵軍 L ユニットに使用する。 */
function playBazooka(state: GameState, targetInstanceId: string): GameState {
  const action = legal(state).find(
    (a) =>
      a.type === "play_operation" &&
      a.playerId === "player1" &&
      a.instanceId === "RS-009:bz" &&
      a.targetInstanceId === targetInstanceId,
  );
  if (!action) throw new Error("bazooka not playable");
  return act(state, action);
}

/** RS-121 ゴーゴードーザーを P1 がバトルフェイズにバトルエリアへ出し、遺跡発掘を誘発させる。 */
function dozerEnters(state: GameState): GameState {
  const r = tryEnterBattle(state, "player1", "RS-121:dozer");
  if (!r.ok) throw new Error(`dozer enter failed: ${r.error}`);
  return r.state;
}

/** シーロンの光（RS-013）: P1 が発動 → P2 が手札から選ぶ → 公開確認。 */
function shironReveal(state: GameState, handInstanceId: string): GameState {
  let next = act(state, {
    type: "shiron_light",
    playerId: "player1",
    operationInstanceId: "RS-013:sh",
  });
  next = act(next, { type: "resolve_effect_choice", playerId: "player2", instanceId: handInstanceId });
  next = act(next, { type: "confirm_shiron_reveal", playerId: "player2" });
  return next;
}

// ===========================================================================
// 1. ラッシュの定義
// ===========================================================================

describe("R-RUSH-01 ラッシュとは", () => {
  // 「エリアに出た時は全て「ラッシュされた」として扱う」
  it("R-RUSH-01: 手札からラッシュエリアに出たユニットはラッシュされた扱いになり、カウンター窓が開く（出典: atwiki/page-146）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const s0 = mk4({
      player1: { hand: [unit], command: [released("TST-OP", "c1")] },
      player2: counterReadyOpponent(),
    });
    const s1 = rushFromHand(s0, "player1", unit.instanceId, ["TST-OP:c1"]);
    expect(zoneOf(s1, "player1", unit.instanceId)).toBe("rush");
    expect(rushedThisTurn(s1, "player1", unit.instanceId)).toBe(true);
    expect(s1.pendingRush?.rushedInstanceId).toBe(unit.instanceId);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(true);
  });

  // 既知の不具合: E11
  // 「ラッシュエリアやバトルエリア）に置いたとき、「ラッシュした」」
  it.fails("R-RUSH-01: 効果（ランドバルカン）でコマンドゾーンからラッシュエリアに置いたユニットもラッシュされた扱い（出典: grnrngr/faq-card-1 RS-005 Q2）", () => {
    const sUnit = inst("TST-UNIT-0", "cmd-s");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [sUnit, held("TST-OP-ET", "et")],
      },
    });
    const s1 = playLandVulcan(s0);
    expect(zoneOf(s1, "player1", sUnit.instanceId)).toBe("rush");
    expect(rushedThisTurn(s1, "player1", sUnit.instanceId)).toBe(true);
  });

  // 「カードはエリアに出ることで初めて「ユニット」…として扱われる」
  it("R-RUSH-01: 手札にある間はユニットとして扱われず、追加条件の「自軍Sユニット」に使えない（出典: atwiki/page-146）", () => {
    // RS-097 ハリケンレオン: 追加条件「自軍Sユニットを1体捨札にする」。手札の S カードは不可。
    const s0 = mk4({
      player1: {
        hand: [inst("RS-097", "leon"), inst("TST-UNIT-0", "hand-s")],
        power: powers(5),
        command: [released("TST-OP-MA", "ma")],
      },
    });
    expect(canStartRush(s0, "player1", "RS-097:leon")).toBe(false);
  });
});

describe("R-RUSH-02 ラッシュエリアを経由しないラッシュ", () => {
  // 「ラッシュエリアを経由することはありません」
  it("R-RUSH-02: パワーバズーカで捨札からバトルエリアに直接出た合体素材はラッシュエリアを経由しない（出典: grnrngr/faq-card-1 RS-009 Q2）", () => {
    // RS-073 サンバルカンロボ（合体―コスモバルカン＋ブルバルカン）。素材に※ホールド要件なし。
    const zord = { ...inst("RS-073", "z"), zordMaterialCardId: "RS-074" };
    const cosmo = inst("RS-074", "m1");
    const s0 = mk4({
      player1: { hand: [inst("RS-009", "bz")], power: powers(8), command: [held("TST-OP-ET", "et")] },
      player2: { battle: [zord], discard: [cosmo] },
    });
    const s1 = playBazooka(s0, zord.instanceId);
    expect(zoneOf(s1, "player2", cosmo.instanceId)).toBe("battle");
    expect(s1.players.player2.rush.some((c) => c.instanceId === cosmo.instanceId)).toBe(false);
  });

  // 既知の不具合: 未登録 — 効果で捨札からバトルエリアに出たユニットにラッシュ記録が付かない
  // 「捨札からバトルエリアに出た合体素材のユニットは、ラッシュされたとして扱います」
  it.fails("R-RUSH-02: パワーバズーカで捨札からバトルエリアに出た合体素材は「ラッシュされた」扱い（出典: grnrngr/faq-card-1 RS-009 Q2）", () => {
    const zord = { ...inst("RS-073", "z"), zordMaterialCardId: "RS-074" };
    const cosmo = inst("RS-074", "m1");
    const s0 = mk4({
      player1: { hand: [inst("RS-009", "bz")], power: powers(8), command: [held("TST-OP-ET", "et")] },
      player2: { battle: [zord], discard: [cosmo] },
    });
    const s1 = playBazooka(s0, zord.instanceId);
    expect(zoneOf(s1, "player2", cosmo.instanceId)).toBe("battle");
    expect(rushedThisTurn(s1, "player2", cosmo.instanceId)).toBe(true);
  });

  // 「「RS-053 爆竜プテラノドン」だけをバトルエリアに戻します」
  it("R-RUSH-02: 捨札にある合体素材だけがバトルエリアに出る（出典: grnrngr/faq-card-1 RS-009 Q5）", () => {
    const zord = { ...inst("RS-050", "abarenoh"), zordMaterialCardId: "RS-051" };
    const ptera = inst("RS-053", "ptera");
    const s0 = mk4({
      player1: { hand: [inst("RS-009", "bz")], power: powers(8), command: [held("TST-OP-ET", "et")] },
      player2: { battle: [zord], discard: [ptera], command: [released("TST-OP", "p2c")] },
    });
    let s1 = playBazooka(s0, zord.instanceId);
    s1 = drainChoices(s1, "player2");
    s1 = payPendingIfAny(s1, "player2");
    expect(zoneOf(s1, "player2", ptera.instanceId)).toBe("battle");
    const p2Battle = s1.players.player2.battle.map((c) => c.cardId);
    expect(p2Battle).toEqual(["RS-053"]);
  });
});

/** 保留中のコマンド支払いがあれば先頭候補で支払う。 */
function payPendingIfAny(state: GameState, playerId: PlayerId): GameState {
  let next = state;
  for (let i = 0; i < 6; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending || pending.playerId !== playerId) break;
    next = act(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
    });
  }
  return next;
}

describe("R-RUSH-03 ラッシュではないもの", () => {
  // 「スタートフェイズで…戻すのはラッシュでは無い」
  it("R-RUSH-03: スタートフェイズにバトルエリアからラッシュエリアへ戻すのはラッシュではない（出典: atwiki/page-146）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const s0 = mk4({
      phase: "start",
      turn: 3,
      player1: { battle: [unit], deck: powers(3, "deck") },
      player2: counterReadyOpponent(),
    });
    const s1 = act(s0, { type: "return_all_battle_to_rush", playerId: "player1" });
    expect(zoneOf(s1, "player1", unit.instanceId)).toBe("rush");
    expect(rushedThisTurn(s1, "player1", unit.instanceId)).toBe(false);
    expect(s1.pendingRush).toBeUndefined();
  });

  // 「オペレーションの使用はラッシュでは無い」
  it("R-RUSH-03: 常駐オペレーションの使用・配置はラッシュではない（ラッシュされたときの窓が開かない）（出典: atwiki/page-146）", () => {
    const op = inst("RS-069", "lg");
    const s0 = mk4({
      player1: { hand: [op], power: powers(4), command: [held("TST-OP-ET", "et")] },
      player2: counterReadyOpponent(),
    });
    const action = legal(s0).find(
      (a) => a.type === "play_operation" && a.playerId === "player1" && a.instanceId === op.instanceId,
    );
    expect(action).toBeDefined();
    const s1 = act(s0, action!);
    expect(zoneOf(s1, "player1", op.instanceId)).toBe("operation");
    expect(s1.pendingRush).toBeUndefined();
    expect(rushedThisTurn(s1, "player1", op.instanceId)).toBe(false);
  });

  // 「ビークルがユニットになったりすることはラッシュではない」
  it.todo(
    "R-RUSH-03: 場のユニットがビークルになる／ビークルがユニットになるのはラッシュではない（出典: atwiki/page-146）— ユニット⇔ビークルの扱い変更を公開 API で発生させる汎用手段がなく、状況を構成できない",
  );

  // 「バトルエリアを離れたわけではありませんので、ラッシュされたことにはなりません」
  it.todo(
    "R-RUSH-03: 敵軍ターン中にライドオフさせられたユニットをバトルエリアに置き直してもラッシュではない（出典: atwiki/page-141 Q11）— 敵軍効果による強制ライドオフを公開 API で発生させる手段がない",
  );
});

describe("R-RUSH-04 同名ユニットは複数出せる", () => {
  // 「同じ名前のユニットは、複数場に出せますか？」「はい、出せます」
  it("R-RUSH-04: 同じ名前のユニットを続けて2体ラッシュできる（出典: atwiki/page-146 Q1）", () => {
    const a = inst("TST-UNIT-0", "a");
    const b = inst("TST-UNIT-0", "b");
    let s = mk4({
      player1: { hand: [a, b], command: [released("TST-OP", "c1"), released("TST-OP", "c2")] },
    });
    s = passRushWindow(rushFromHand(s, "player1", a.instanceId, ["TST-OP:c1"]));
    expect(canStartRush(s, "player1", b.instanceId)).toBe(true);
    s = passRushWindow(rushFromHand(s, "player1", b.instanceId, ["TST-OP:c2"]));
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual([a.instanceId, b.instanceId]);
  });
});

describe("R-RUSH-05 ラッシュ時に適用中の修正", () => {
  // 既知の不具合: 未登録 — 恐竜やのカレー（特徴「イエロー」の自軍Sユニット BP+2000）がラッシュされたユニットのBPに反映されない
  // 「最初から修正・追加された状態のユニットがラッシュされたものとして扱う」
  it.fails("R-RUSH-05: 恐竜やのカレー適用中に BP7000 のイエローSをラッシュすると最初から BP9000 で、疾風流超忍法（BP8000以下）を使えない（出典: atwiki/page-146）", () => {
    const yellow = inst("T04-YELLOW", "y");
    const s0 = mk4({
      player1: {
        hand: [yellow],
        operation: [inst("RS-179", "curry")],
        command: [released("TST-OP", "c1")],
      },
      player2: counterReadyOpponent(),
    });
    const s1 = rushFromHand(s0, "player1", yellow.instanceId, ["TST-OP:c1"]);
    expect(zoneOf(s1, "player1", yellow.instanceId)).toBe("rush");
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(false);
  });

  // 「似た現象がダイカイオーヒガシと疾風流超忍法でも起きる」
  it("R-RUSH-05: 「ラッシュしたとき」に BP+3000 されるダイカイオーヒガシ（BP7000）は BP8000以下でラッシュされた扱いで、疾風流超忍法を使える（出典: atwiki/page-146）", () => {
    const higashi = inst("XG3-036", "higashi");
    const ebi = inst("XG3-035", "ebi");
    const s0 = mk4({
      player1: {
        hand: [higashi],
        rush: [ebi],
        power: powers(5),
        command: [released("TST-OP-MA", "ma")],
      },
      player2: counterReadyOpponent(),
    });
    let r = tryRushZord(s0, "player1", higashi.instanceId, { material: ebi.instanceId }, ["TST-OP-MA:ma"]);
    if (!r.ok) {
      r = tryRushFromHand(s0, "player1", higashi.instanceId, ["TST-OP-MA:ma"], {
        zordMaterialInstanceId: ebi.instanceId,
      });
    }
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s1 = drainChoices(r.state, "player1");
    expect(zoneOf(s1, "player1", higashi.instanceId)).toBe("rush");
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(true);
  });

  // 「ＢＰは常に修正された値を参照します」「発動することはできません」
  it("R-RUSH-05: リリース状態のコマンド4つでBP9000になったファイヤーカイザーには疾風流超忍法（BP8000以下）を使えない（出典: grnrngr/faq-card-1 RS-026 Q7）", () => {
    const kaiser = inst("RS-113", "fk");
    const s0 = mk4({
      player1: {
        hand: [kaiser],
        rush: [inst("RS-576", "phoenix"), inst("RS-114", "barikion")],
        power: powers(6),
        command: [
          released("TST-OP-MA", "m1"),
          released("TST-OP-MA", "m2"),
          released("TST-OP-MA", "m3"),
          released("TST-OP-MA", "m4"),
          released("TST-OP-MA", "m5"),
        ],
      },
      player2: counterReadyOpponent(),
    });
    const r = tryRushZord(s0, "player1", kaiser.instanceId, {}, ["TST-OP-MA:m1"]);
    const s1 = r.ok ? r.state : rushFromHand(s0, "player1", kaiser.instanceId, ["TST-OP-MA:m1"]);
    expect(zoneOf(s1, "player1", kaiser.instanceId)).toBe("rush");
    expect(s1.players.player1.command.filter((c) => !c.commandHeld)).toHaveLength(4);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(false);
  });
});

// ===========================================================================
// 2. 通常のラッシュ（手札から）
// ===========================================================================

describe("R-RUSH-10 時期", () => {
  // 「ラッシュエリアにリリース状態で配置します」
  it("R-RUSH-10: 自軍ラッシュフェイズにコマンドをホールドして手札のユニットをラッシュエリアにリリース状態で置く（出典: grnrngr/rule_phase3）", () => {
    const unit = inst("TST-UNIT-2", "u2");
    const s0 = mk4({
      player1: { hand: [unit], power: powers(2), command: [released("TST-OP", "c1")] },
    });
    expect(canStartRush(s0, "player1", unit.instanceId)).toBe(true);
    const s1 = rushFromHand(s0, "player1", unit.instanceId, ["TST-OP:c1"]);
    const placed = cardIn(s1, "player1", "rush", unit.instanceId);
    expect(placed).toBeDefined();
    expect(placed?.commandHeld ?? false).toBe(false);
    expect(cardIn(s1, "player1", "command", "TST-OP:c1")?.commandHeld).toBe(true);
    expect(s1.players.player1.hand).toHaveLength(0);
  });

  // 「基本的にラッシュフェイズに…ラッシュできる」
  it("R-RUSH-10: バトルフェイズには手札からラッシュできない（出典: atwiki/page-146, atwiki/page-516）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const s0 = mk4({
      phase: "battle",
      player1: { hand: [unit], command: [released("TST-OP", "c1")] },
    });
    expect(canStartRush(s0, "player1", unit.instanceId)).toBe(false);
    expect(applyAction(s0, { type: "rush", playerId: "player1", instanceId: unit.instanceId }).ok).toBe(
      false,
    );
  });

  // 「自分の手札からユニットカードを選んで場に出す」（自軍ラッシュフェイズ）
  it("R-RUSH-10: 相手のラッシュフェイズには手札からラッシュできない（出典: grnrngr/rule_phase3）", () => {
    const unit = inst("TST-UNIT-0", "u2");
    const s0 = mk4({
      player1: { command: [released("TST-OP", "c1")] },
      player2: { hand: [unit], command: [released("TST-OP", "c2")] },
    });
    expect(canStartRush(s0, "player2", unit.instanceId)).toBe(false);
  });

  // 「ホールドしたコマンドと同じカテゴリのユニットをラッシュできます」
  it("R-RUSH-10: 同じカテゴリのリリース状態コマンドがなければラッシュできない（出典: grnrngr/rule_phase3）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const otherCat = mk4({
      player1: { hand: [unit], command: [released("TST-OP-ET", "et")] },
    });
    expect(canStartRush(otherCat, "player1", unit.instanceId)).toBe(false);
    const allHeld = mk4({
      player1: { hand: [unit], command: [held("TST-OP", "wb")] },
    });
    expect(canStartRush(allHeld, "player1", unit.instanceId)).toBe(false);
  });

  // 「必要パワー３以内で…ラッシュできます」
  it("R-RUSH-10: パワーゾーンの枚数が必要パワー未満ならラッシュできない（出典: grnrngr/rule_phase3）", () => {
    const unit = inst("TST-UNIT-2", "u2");
    const s0 = mk4({
      player1: { hand: [unit], power: powers(1), command: [released("TST-OP", "c1")] },
    });
    expect(canStartRush(s0, "player1", unit.instanceId)).toBe(false);
  });
});

describe("R-RUSH-11 手順", () => {
  // 「必要パワーと追加条件の確認」→…→「追加条件の実行」
  it("R-RUSH-11: 必要パワーは追加条件の実行前に確認する（7パワーで7+のファイヤーファイターをSユニットをパワーゾーンに送ってラッシュ）（出典: atwiki/page-146 Q3）", () => {
    const ff = inst("RS-085", "ff");
    const sUnit = inst("TST-UNIT-0", "s1");
    const s0 = mk4({
      player1: {
        hand: [ff],
        rush: [sUnit],
        power: powers(7),
        command: [released("TST-OP-OT", "ot")],
      },
    });
    const r = tryRushZord(s0, "player1", ff.instanceId, { material: sUnit.instanceId }, ["TST-OP-OT:ot"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", ff.instanceId)).toBe("rush");
    expect(zoneOf(r.state, "player1", sUnit.instanceId)).toBe("power");
    expect(cardIn(r.state, "player1", "command", "TST-OP-OT:ot")?.commandHeld).toBe(true);
  });

  // 既知の不具合: 未登録 — アブレラ（闇の取引）でパワー不足を補うラッシュが公開 API から開始できない
  // 「「必要パワー」を満たしていることを確認してから」
  it.fails("R-RUSH-11: アブレラでパワー不足を補った後、そのアブレラを追加条件で捨札にしてもラッシュは続行される（出典: grnrngr/faq-card-3 RS-169 Q・RS-170 Q2, atwiki/page-146）", () => {
    const fan = inst("RS-169", "fan");
    const abrera = inst("RS-170", "abrera");
    const s0 = mk4({
      player1: {
        hand: [fan],
        rush: [abrera],
        power: powers(4),
        command: [
          released("TST-OP-DA", "d1"),
          released("TST-OP-DA", "d2"),
          released("TST-OP-DA", "d3"),
          released("TST-OP-DA", "d4"),
        ],
      },
    });
    let r = tryRushZord(s0, "player1", fan.instanceId, { material: abrera.instanceId }, [
      "TST-OP-DA:d1",
      "TST-OP-DA:d2",
      "TST-OP-DA:d3",
    ]);
    if (!r.ok) {
      r = tryRushFromHand(s0, "player1", fan.instanceId, ["TST-OP-DA:d1", "TST-OP-DA:d2", "TST-OP-DA:d3"], {
        zordMaterialInstanceId: abrera.instanceId,
      });
    }
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", fan.instanceId)).toBe("rush");
    expect(zoneOf(r.state, "player1", abrera.instanceId)).toBe("discard");
  });
});

describe("R-RUSH-12 追加条件で置くのはラッシュエリア", () => {
  // 「ラッシュするユニットはラッシュエリアに配置します」
  it("R-RUSH-12: バトルエリアのレッドレーサーを追加条件に使っても、ラッシュするユニットはラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-090 Q4）", () => {
    const leon = inst("RS-097", "leon");
    const racer = inst("RS-090", "racer");
    const s0 = mk4({
      player1: {
        hand: [leon],
        battle: [racer],
        power: powers(5),
        command: [released("TST-OP-MA", "ma")],
      },
    });
    const r = tryRushZord(s0, "player1", leon.instanceId, { material: racer.instanceId }, ["TST-OP-MA:ma"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", leon.instanceId)).toBe("rush");
    expect(zoneOf(r.state, "player1", racer.instanceId)).toBe("discard");
  });
});

// ===========================================================================
// 3. 追加条件
// ===========================================================================

describe("R-ADD-01 追加条件の性質", () => {
  // 「いいえ、できません。追加条件は、必要パワーを満たした上での…」
  it("R-ADD-01: 6パワーでは、Sユニットをパワーゾーンに送って7にしても7+のユニットはラッシュできない（出典: atwiki/page-584 Q3）", () => {
    const ff = inst("RS-085", "ff");
    const s0 = mk4({
      player1: {
        hand: [ff],
        rush: [inst("TST-UNIT-0", "s1")],
        power: powers(6),
        command: [released("TST-OP-OT", "ot")],
      },
    });
    expect(canStartRush(s0, "player1", ff.instanceId)).toBe(false);
    expect(
      tryRushZord(s0, "player1", ff.instanceId, { material: "TST-UNIT-0:s1" }, ["TST-OP-OT:ot"]).ok,
    ).toBe(false);
  });
});

describe("R-ADD-02 「＋」と「－」", () => {
  // 「「＋」は手札からのラッシュ時に必ず満たさなければならない条件」
  it("R-ADD-02: 「＋」の追加条件を満たせなければ、必要パワーが足りていてもラッシュできない（出典: atwiki/page-586）", () => {
    const ff = inst("RS-085", "ff");
    const s0 = mk4({
      player1: { hand: [ff], power: powers(10), command: [released("TST-OP-OT", "ot")] },
    });
    expect(canStartRush(s0, "player1", ff.instanceId)).toBe(false);
  });

  // 「「－」はラッシュ時に任意で満たすかどうか選択でき」
  it("R-ADD-02: 「－」の追加条件は満たさずに、必要パワー7を満たして通常どおりラッシュできる（出典: atwiki/page-586）", () => {
    const am = inst("RS-230", "am");
    const s0 = mk4({
      player1: { hand: [am], power: powers(7), command: [released("TST-OP", "wb")] },
    });
    expect(canStartRush(s0, "player1", am.instanceId)).toBe(true);
    const r = tryRushFromHand(s0, "player1", am.instanceId, ["TST-OP:wb"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", am.instanceId)).not.toBe("hand");
  });

  // 「満たした場合パワーの軽減などの特典がつく条件」
  it("R-ADD-02: 「－」の追加条件（アバレッドを捨札）を満たせば必要パワー0でラッシュできる（出典: atwiki/page-586）", () => {
    const am = inst("RS-230", "am");
    const red = inst("RS-054", "red");
    const s0 = mk4({
      player1: { hand: [am], rush: [red], power: [], command: [released("TST-OP", "wb")] },
    });
    const r = tryRushFromHand(s0, "player1", am.instanceId, ["TST-OP:wb"], {
      zordMaterialInstanceId: red.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", red.instanceId)).toBe("discard");
    expect(zoneOf(r.state, "player1", am.instanceId)).toBe("rush");
  });

  // 既知の不具合: 未登録 — ドギー・クルーガーの【出動指令】が敵軍DAユニットのラッシュで誘発しない
  // 「「追加条件」の欄に記述があるものは「追加条件を持つ」と考えて下さい」
  it.fails("R-ADD-02: ドギー・クルーガーでオモテにした「－」のSユニット（デカレッドSWAT）は追加条件を持つので手札に加える（出典: grnrngr/faq-card-5 RS-318 Q3）", () => {
    const swat = inst("RS-345", "swat");
    const defs = {
      "T04-DA": { ...(T04["T04-S5"] as CardDefinition), id: "T04-DA", category: "DA" as const, powerCost: 0 },
    };
    const daInst = inst("T04-DA", "da");
    let s = mk4({
      definitions: defs,
      player1: { hand: [daInst], command: [released("TST-OP-DA", "d1")] },
      player2: { rush: [inst("RS-318", "doggie")], deck: [swat, inst("TST-OP", "d2")] },
    });
    s = rushFromHand(s, "player1", daInst.instanceId, ["TST-OP-DA:d1"]);
    for (let i = 0; i < 4; i += 1) {
      const pc = s.pendingEffectChoice;
      if (pc?.playerId === "player2") {
        s = resolveChoice(s, "player2");
        continue;
      }
      if (s.pendingRush) {
        s = passRushWindow(s);
        continue;
      }
      break;
    }
    expect(zoneOf(s, "player2", swat.instanceId)).toBe("hand");
  });
});

describe("R-ADD-03 「ユニット」指定", () => {
  // 「自軍ラッシュエリアか自軍バトルエリアにあるユニットになります」
  it("R-ADD-03: 合体ユニットのカードが手札・パワーゾーン・コマンドゾーンにあっても合体の追加条件には使えない（出典: atwiki/page-146 Q2）", () => {
    const abarenoh = inst("RS-050", "ab");
    const s0 = mk4({
      player1: {
        hand: [abarenoh, inst("RS-051", "tyr")],
        power: [...powers(7), inst("RS-052", "tri")],
        command: [released("TST-OP", "wb"), released("RS-053", "ptera")],
      },
    });
    expect(canStartRush(s0, "player1", abarenoh.instanceId)).toBe(false);
  });

  // 「ライドしているSユニットも、追加条件を満たすために選ぶことができます」
  it("R-ADD-03: ビークルにライド中のSユニットを追加条件に選べる。ラッシュしたMユニットはライド状態にならない（出典: atwiki/page-141 Q2）", () => {
    const vehicle = inst("RK-030", "bike");
    const rider = { ...inst("TST-UNIT-0", "rider"), mountedOnInstanceId: vehicle.instanceId };
    const leon = inst("RS-097", "leon");
    const s0 = mk4({
      player1: {
        hand: [leon],
        rush: [vehicle, rider],
        power: powers(5),
        command: [released("TST-OP-MA", "ma")],
      },
    });
    const r = tryRushZord(s0, "player1", leon.instanceId, { material: rider.instanceId }, ["TST-OP-MA:ma"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", rider.instanceId)).toBe("discard");
    expect(zoneOf(r.state, "player1", vehicle.instanceId)).toBe("rush");
    expect(cardIn(r.state, "player1", "rush", leon.instanceId)?.mountedOnInstanceId).toBeUndefined();
  });
});

describe("R-ADD-04 「コマンドゾーンに送るか捨札」", () => {
  // 「空きがある場合でも、捨札にすることを選んで…」「はい、できます」
  it("R-ADD-04: コマンドゾーンに空きがあっても捨札を選べる（出典: atwiki/page-584 Q1）", () => {
    const bull = inst("RS-075", "bull");
    const sUnit = inst("TST-UNIT-0", "s1");
    const s0 = mk4({
      player1: { hand: [bull], rush: [sUnit], power: powers(5), command: [released("TST-OP-ET", "et")] },
    });
    const r = tryRushZord(s0, "player1", bull.instanceId, { destination: "discard", material: sUnit.instanceId }, [
      "TST-OP-ET:et",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", sUnit.instanceId)).toBe("discard");
    expect(zoneOf(r.state, "player1", bull.instanceId)).toBe("rush");
  });

  // 「はい、リリース状態で置きます」
  it("R-ADD-04: 追加条件でコマンドゾーンに送るカードはリリース状態で置く（出典: atwiki/page-584 Q2）", () => {
    const bull = inst("RS-075", "bull");
    const sUnit = inst("TST-UNIT-0", "s1");
    const s0 = mk4({
      player1: { hand: [bull], rush: [sUnit], power: powers(5), command: [released("TST-OP-ET", "et")] },
    });
    const r = tryRushZord(s0, "player1", bull.instanceId, { destination: "command", material: sUnit.instanceId }, [
      "TST-OP-ET:et",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sent = cardIn(r.state, "player1", "command", sUnit.instanceId);
    expect(sent).toBeDefined();
    expect(sent?.commandHeld ?? false).toBe(false);
  });

  // 既知の不具合: 未登録 — 「自軍Sユニット2体をそれぞれ…」の追加条件（ダイナギャリー）を満たしてもラッシュを開始できない
  // 「「それぞれ」について「コマンドゾーンに送るか捨札にする」を選ぶ」
  it.fails("R-ADD-04: 「2体をそれぞれ」は1体目をコマンドゾーンに送っても2体目もコマンドゾーンに送れる（出典: grnrngr/faq-card-4 RS-197 Q5）", () => {
    const gally = inst("RS-197", "gally");
    const s1u = inst("TST-UNIT-0", "s1");
    const s2u = inst("TST-UNIT-0", "s2");
    const s0 = mk4({
      player1: { hand: [gally], rush: [s1u, s2u], power: powers(4), command: [released("TST-OP-ET", "et")] },
    });
    let s = act(s0, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: gally.instanceId });
    for (let i = 0; i < 6 && s.pendingZordSetup; i += 1) {
      const setup = s.pendingZordSetup;
      if (setup.step === "destination") {
        s = act(s, { type: "resolve_zord_setup", playerId: "player1", destination: "command" });
      } else if (setup.step === "material") {
        const pick = [s1u.instanceId, s2u.instanceId].find((id) => setup.validInstanceIds.includes(id));
        s = act(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: pick! });
      } else {
        s = act(s, { type: "resolve_zord_setup", playerId: "player1" });
      }
    }
    s = payPendingIfAny(s, "player1");
    expect(zoneOf(s, "player1", gally.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", s1u.instanceId)).toBe("command");
    expect(zoneOf(s, "player1", s2u.instanceId)).toBe("command");
  });
});

describe("R-ADD-05 捨てるはずのユニットが場に留まった場合", () => {
  // 「捨札にするはずのユニットを自軍エリアに留まらせると…満たしたことにならない」
  it.todo(
    "R-ADD-05: 追加条件で捨札にするユニットを効果で場に留まらせると追加条件を満たしたことにならない（出典: atwiki/page-586）— 追加条件の実行中に「場を離れるとき」の応答（ダイノガッツ等）を差し込む公開 API がなく、状況を構成できない",
  );
});

describe("R-ADD-06 合体", () => {
  // 「「爆竜ティラノサウルス」と…「爆竜プテラノドン」を捨札にすることで」
  it("R-ADD-06: 「合体-」に列挙されたユニットを自軍エリア（ラッシュ・バトル）からすべて捨札にしてラッシュする（出典: grnrngr/rule_phase3, atwiki/page-1841）", () => {
    const abarenoh = inst("RS-050", "ab");
    const tyr = inst("RS-051", "tyr");
    const tri = inst("RS-052", "tri");
    const ptera = inst("RS-053", "ptera");
    const s0 = mk4({
      player1: {
        hand: [abarenoh],
        rush: [tyr, tri],
        battle: [ptera],
        power: powers(7),
        command: [released("TST-OP", "wb")],
      },
    });
    expect(canStartRush(s0, "player1", abarenoh.instanceId)).toBe(true);
    let r = tryRushZord(s0, "player1", abarenoh.instanceId, {}, ["TST-OP:wb"]);
    if (!r.ok) r = tryRushFromHand(s0, "player1", abarenoh.instanceId, ["TST-OP:wb"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", abarenoh.instanceId)).toBe("rush");
    for (const m of [tyr, tri, ptera]) {
      expect(zoneOf(r.state, "player1", m.instanceId)).toBe("discard");
    }
  });

  // 「表記されたユニットを全て自軍エリアから捨札にすることで追加条件が満たされ」
  it("R-ADD-06: 合体ユニットが1体でも自軍エリアに欠けていればラッシュできない（出典: atwiki/page-1841）", () => {
    const abarenoh = inst("RS-050", "ab");
    const s0 = mk4({
      player1: {
        hand: [abarenoh, inst("RS-053", "ptera")],
        rush: [inst("RS-051", "tyr"), inst("RS-052", "tri")],
        power: powers(7),
        command: [released("TST-OP", "wb")],
      },
    });
    expect(canStartRush(s0, "player1", abarenoh.instanceId)).toBe(false);
  });
});

describe("R-ADD-07 複数の「〜しなければ出られない」", () => {
  // 「「稲妻重力エネルギー」の効果をまず実行し…さらにコマンドを１つホールド」
  it("R-ADD-07: 稲妻重力エネルギー配置中、爆竜ティラノサウルスがバトルエリアに出るには2ホールド必要（出典: grnrngr/faq-card-1 RS-069 Q3）", () => {
    const tyr = inst("RS-051", "tyr");
    const s0 = mk4({
      phase: "battle",
      player1: {
        rush: [tyr],
        operation: [inst("RS-069", "lg")],
        command: [released("TST-OP", "c1"), released("TST-OP", "c2"), released("TST-OP", "c3")],
      },
    });
    expect(battleEntryHoldsRequired(s0, "player1", tyr.instanceId)).toBe(2);
    const r = tryEnterBattle(s0, "player1", tyr.instanceId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", tyr.instanceId)).toBe("battle");
    expect(heldCount(r.state, "player1")).toBe(2);
  });

  // 「カテゴリ名を指定されていないので、どのカテゴリでも構いません」
  it("R-ADD-07: 稲妻重力エネルギーでホールドするコマンドはMユニットと異なるカテゴリでもよい（出典: grnrngr/faq-card-1 RS-069 Q1）", () => {
    const m = inst("TST-UNIT-2", "m");
    const s0 = mk4({
      phase: "battle",
      player1: {
        rush: [m],
        operation: [inst("RS-069", "lg")],
        command: [released("TST-OP-ET", "et")],
      },
    });
    const r = tryEnterBattle(s0, "player1", m.instanceId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", m.instanceId)).toBe("battle");
    expect(cardIn(r.state, "player1", "command", "TST-OP-ET:et")?.commandHeld).toBe(true);
  });

  // 「ホールドするコマンドは２つになります」
  it("R-ADD-07: 自分と相手の両方が稲妻重力エネルギーを配置しているとき、Mユニットは2ホールド必要（出典: grnrngr/faq-card-1 RS-069 Q2）", () => {
    const m = inst("TST-UNIT-2", "m");
    const s0 = mk4({
      phase: "battle",
      player1: {
        rush: [m],
        operation: [inst("RS-069", "lg1")],
        command: [released("TST-OP", "c1"), released("TST-OP", "c2")],
      },
      player2: { operation: [inst("RS-069", "lg2")] },
    });
    expect(battleEntryHoldsRequired(s0, "player1", m.instanceId)).toBe(2);
  });

  // 既知の不具合: 未登録 — パワーバズーカで戻す合体素材の※ホールド要件を1体ごとに要求しない（1ホールドで全員戻る）
  // 「そのユニットを戻すたびに、コマンドを１つホールドする必要があります」
  it.fails("R-ADD-07: パワーバズーカで戻す※ホールド要件付きの合体素材は1体ごとにホールドし、足りなくなったら止まる（出典: grnrngr/faq-card-1 RS-009 Q3）", () => {
    const zord = { ...inst("RS-050", "abarenoh"), zordMaterialCardId: "RS-051" };
    const tyr = inst("RS-051", "tyr");
    const ptera = inst("RS-053", "ptera");
    const s0 = mk4({
      player1: { hand: [inst("RS-009", "bz")], power: powers(8), command: [held("TST-OP-ET", "et")] },
      player2: { battle: [zord], discard: [tyr, ptera], command: [released("TST-OP", "p2c")] },
    });
    let s = playBazooka(s0, zord.instanceId);
    s = drainChoices(s, "player2");
    s = payPendingIfAny(s, "player2");
    s = drainChoices(s, "player2");
    const returned = s.players.player2.battle.filter((c) => c.cardId === "RS-051" || c.cardId === "RS-053");
    expect(returned).toHaveLength(1);
    expect(heldCount(s, "player2")).toBe(1);
  });

  // 「バトルエリアに出すことができず、捨札のままになります」
  it("R-ADD-07: 敵軍ハリケンレオンがいるとき、ホールドできるコマンドがなければ SP1 の合体素材は捨札のまま（出典: grnrngr/faq-card-2 RS-097 Q2）", () => {
    // RS-112 ウルカイザー（合体―魔導騎士ウルザード(SP1)＋魔導馬バリキオン）
    const zord = { ...inst("RS-112", "ulk"), zordMaterialCardId: "RS-115" };
    const urzard = inst("RS-115", "urz");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-009", "bz")],
        battle: [inst("RS-097", "leon")],
        power: powers(8),
        command: [held("TST-OP-ET", "et")],
      },
      player2: { battle: [zord], discard: [urzard], command: [] },
    });
    let s = playBazooka(s0, zord.instanceId);
    s = drainChoices(s, "player2");
    expect(zoneOf(s, "player2", urzard.instanceId)).toBe("discard");
  });

  // 既知の不具合: 05-D5
  // 「コマンドを１つホールドしてバトルエリアに出さなければ」→「はい」
  it.fails("R-ADD-07: 敵軍ハリケンレオンがいるとき、ホールドできるコマンドがあればレッドレーサーは1つホールドしてバトルエリアに置く（出典: grnrngr/faq-card-2 RS-097 Q3・RS-090 Q1）", () => {
    const racer = inst("RS-090", "racer");
    const s0 = mk4({
      player1: {
        hand: [racer],
        power: powers(2),
        command: [released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")],
      },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    let s = rushFromHand(s0, "player1", racer.instanceId, ["TST-OP-OT:o1"]);
    s = payPendingIfAny(s, "player1");
    s = passRushWindow(s);
    expect(zoneOf(s, "player1", racer.instanceId)).toBe("battle");
    expect(heldCount(s, "player1")).toBe(2);
  });

  // 既知の不具合: 05-D5
  // 「ホールドできる自軍コマンドがなければ…ラッシュエリアに置かれます」
  it.fails("R-ADD-07: 敵軍ハリケンレオンがいてホールドできるコマンドがなければ、レッドレーサーはラッシュエリアに置かれる（出典: grnrngr/faq-card-2 RS-097 Q3・RS-090 Q1）", () => {
    const racer = inst("RS-090", "racer");
    const s0 = mk4({
      player1: { hand: [racer], power: powers(2), command: [released("TST-OP-OT", "o1")] },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    let s = rushFromHand(s0, "player1", racer.instanceId, ["TST-OP-OT:o1"]);
    s = passRushWindow(s);
    expect(zoneOf(s, "player1", racer.instanceId)).toBe("rush");
  });

  // 「分数表記のユニットは…効果を受けることはありません」
  it("R-ADD-07: SP が分数表記のユニットは敵軍ハリケンレオンがいてもホールドなしでバトルエリアに出られる（出典: grnrngr/faq-card-2 RS-097 Q1）", () => {
    const frac = inst("T04-FRAC", "f");
    const s0 = mk4({
      phase: "battle",
      player1: { rush: [frac], command: [released("TST-OP", "c1")] },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    expect(battleEntryHoldsRequired(s0, "player1", frac.instanceId)).toBe(0);
  });

  // 既知の不具合: 05-D5
  // 「ホールドしてバトルエリアに出さなければなりません」
  it.fails("R-ADD-07: 敵軍ハリケンレオンがいるとき「可能ならバトルエリアに出る」タイガーレンジャーは、ホールドできるコマンドがあれば出なければならない（出典: grnrngr/faq-card-2 RS-097 Q5）", () => {
    const tiger = inst("RS-041", "tiger");
    const s0 = mk4({
      phase: "battle",
      player1: { rush: [tiger], command: [released("TST-OP", "c1")] },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    expect(battleEntryHoldsRequired(s0, "player1", tiger.instanceId)).toBe(1);
    expect(applyAction(s0, { type: "end_phase", playerId: "player1" }).ok).toBe(false);
  });

  // 既知の不具合: 05-D5
  // 「ホールドできるコマンドが無ければ…ラッシュエリアに留まります」
  it.fails("R-ADD-07: 敵軍ハリケンレオンがいてホールドできるコマンドがなければ、タイガーレンジャーはラッシュエリアに留まる（出典: grnrngr/faq-card-2 RS-097 Q5）", () => {
    const tiger = inst("RS-041", "tiger");
    const s0 = mk4({
      phase: "battle",
      player1: { rush: [tiger], command: [held("TST-OP", "c1")] },
      player2: { battle: [inst("RS-097", "leon")] },
    });
    expect(battleEntryHoldsRequired(s0, "player1", tiger.instanceId)).toBeNull();
    const ended = applyAction(s0, { type: "end_phase", playerId: "player1" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(zoneOf(ended.state, "player1", tiger.instanceId)).toBe("rush");
  });

  // 既知の不具合: 05-D5
  // 「はい、重複しますので、その通りになります」
  it.fails("R-ADD-07: 敵軍ハリケンレオンが2体いれば、SP1のユニットはバトルエリアに出るのに2ホールド必要（出典: grnrngr/faq-card-2 RS-097 Q7）", () => {
    const unit = inst("TST-UNIT-0", "u");
    const s0 = mk4({
      phase: "battle",
      player1: {
        rush: [unit],
        command: [released("TST-OP", "c1"), released("TST-OP", "c2"), released("TST-OP", "c3")],
      },
      player2: { battle: [inst("RS-097", "leon1"), inst("RS-097", "leon2")] },
    });
    expect(battleEntryHoldsRequired(s0, "player1", unit.instanceId)).toBe(2);
  });

  // 「リリース状態のコマンドが無くなったら」
  it.todo(
    "R-ADD-07: 敵軍ハリケンレオンがいるとき、ピットインダイブで出す敵軍Sユニットは1体ごとにホールドし、コマンドが尽きたら終了（出典: grnrngr/faq-card-2 RS-097 Q4）— ピットインダイブ（NC）の成立をこの章のテストで構成するのは困難なため保留",
  );

  // 「はい、その通りです」（ファイブテクターで出すときもホールド）
  it.todo(
    "R-ADD-07: 敵軍ハリケンレオンがいるとき、ファイブテクターで出す SP1 以上のSユニットもコマンドを1つホールドする（出典: grnrngr/faq-card-2 RS-097 Q6）— ストライク反応窓でのファイブテクター処理を経由する必要があり保留",
  );
});

describe("R-ADD-08 追加条件の代替手段がある場合", () => {
  // 「「オーバーテクノロジー」のコマンドを２つホールドします」
  it("R-ADD-08: Sユニットがいなくてもデカベースクローラーの母艦でファイヤーファイターをラッシュでき、OTコマンドを計2つホールドする（出典: grnrngr/faq-card-2 RS-105 Q3・Q4）", () => {
    const ff = inst("RS-085", "ff");
    const s0 = mk4({
      player1: {
        hand: [ff],
        rush: [inst("RS-105", "deca")],
        power: powers(7),
        command: [released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")],
      },
    });
    expect(canStartRush(s0, "player1", ff.instanceId)).toBe(true);
    const r = tryRushZord(s0, "player1", ff.instanceId, { mothership: true }, ["TST-OP-OT:o1", "TST-OP-OT:o2"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", ff.instanceId)).toBe("rush");
    expect(heldCount(r.state, "player1")).toBe(2);
  });

  // （ホールドを目的として発動）「いいえ、できません」
  it("R-ADD-08: デカベースクローラーは「パワーゾーンに送る」以外の追加条件（捨札）には使えない（出典: grnrngr/faq-card-2 RS-105 Q2）", () => {
    const leon = inst("RS-097", "leon");
    const s0 = mk4({
      player1: {
        hand: [leon],
        rush: [inst("RS-105", "deca")],
        power: powers(5),
        command: [released("TST-OP-MA", "ma"), released("TST-OP-OT", "o1")],
      },
    });
    expect(canStartRush(s0, "player1", leon.instanceId)).toBe(false);
  });

  // 「はい、できます」（ジャガーバルカンでブルバルカンをラッシュ）
  it("R-ADD-08: ジャガーバルカンの母艦でSユニットの代わりにETコマンドをホールドしてブルバルカンをラッシュできる（出典: grnrngr/faq-card-2 RS-075 Q1）", () => {
    const bull = inst("RS-075", "bull");
    const s0 = mk4({
      player1: {
        hand: [bull],
        rush: [inst("RS-076", "jaguar")],
        power: powers(5),
        command: [released("TST-OP-ET", "e1"), released("TST-OP-ET", "e2")],
      },
    });
    expect(canStartRush(s0, "player1", bull.instanceId)).toBe(true);
    const r = tryRushZord(s0, "player1", bull.instanceId, { mothership: true }, ["TST-OP-ET:e1", "TST-OP-ET:e2"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", bull.instanceId)).toBe("rush");
    expect(heldCount(r.state, "player1")).toBe(2);
  });

  it.todo(
    "R-ADD-08: 1体目としてコマンドゾーンに送ったSユニットを、ジャガーバルカンで2体目の代わりにホールドできる（出典: grnrngr/faq-card-2 RS-075 Q2）— カードプールの RS-075 の追加条件は1体（FAQ の前提「2体をそれぞれ」と一致しない）ため状況を構成できない",
  );

  // 「コマンドゾーンがすでに上限の５枚に達している…」「はい、出来ます」
  it("R-ADD-08: コマンドゾーンが5枚で埋まっていてもジャガーバルカンの母艦を使える（出典: grnrngr/faq-card-2 RS-076 Q4）", () => {
    const bull = inst("RS-075", "bull");
    const s0 = mk4({
      player1: {
        hand: [bull],
        rush: [inst("RS-076", "jaguar"), inst("TST-UNIT-0", "s1")],
        power: powers(5),
        command: [
          released("TST-OP-ET", "e1"),
          released("TST-OP-ET", "e2"),
          released("TST-OP", "w1"),
          released("TST-OP", "w2"),
          released("TST-OP", "w3"),
        ],
      },
    });
    const r = tryRushZord(s0, "player1", bull.instanceId, { mothership: true }, ["TST-OP-ET:e1", "TST-OP-ET:e2"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", bull.instanceId)).toBe("rush");
  });

  // 「「RS-010 プリズムパワー」の効果で代用することはできません」
  it("R-ADD-08: ジャガーバルカンの代替ホールドはプリズムパワー（2ホールドで代用）では満たせない（出典: grnrngr/faq-card-2 RS-076 Q2）", () => {
    const bull = inst("RS-075", "bull");
    const s0 = mk4({
      player1: {
        hand: [bull],
        rush: [inst("RS-076", "jaguar")],
        operation: [inst("RS-010", "prism")],
        power: powers(5),
        command: [
          released("TST-OP-OT", "o1"),
          released("TST-OP-OT", "o2"),
          released("TST-OP-OT", "o3"),
          released("TST-OP-OT", "o4"),
        ],
      },
    });
    expect(canStartRush(s0, "player1", bull.instanceId)).toBe(false);
  });

  // 「ワイルドビーストやミスティックアームズのＭユニット…」（ジャガーバルカン）
  it("R-ADD-08: ジャガーバルカンは「コマンドゾーンに送る」以外の追加条件（捨札）には使えない（出典: grnrngr/faq-card-2 RS-076 Q5）", () => {
    const leon = inst("RS-097", "leon");
    const s0 = mk4({
      player1: {
        hand: [leon],
        rush: [inst("RS-076", "jaguar")],
        power: powers(5),
        command: [released("TST-OP-MA", "ma"), released("TST-OP-ET", "e1")],
      },
    });
    expect(canStartRush(s0, "player1", leon.instanceId)).toBe(false);
  });

  // 「ホールドされてもラッシュすることができます」
  it.todo(
    "R-ADD-08: ダイナギャリーで選んだダイナマッハそのものをジャガーバルカンでホールドして追加条件の代わりにできる（出典: grnrngr/faq-card-2 RS-076 Q3・grnrngr/faq-card-4 RS-197 Q2）— パーツキャリアーの追加条件処理で母艦を選ぶ公開 API がない",
  );

  // 既知の不具合: 未登録 — ベン・Gの【人身略取】で相手に追加条件を満たさせる処理がない
  // 「はい、その通りです」（人身略取は代替手段があれば満たす）
  it.fails("R-ADD-08: 人身略取の追加条件は、Sユニットがなくてもジャガーバルカンで満たせるなら満たさなければならない（出典: grnrngr/faq-card-2 RS-076 Q1・RS-105 Q1）", () => {
    const ben = inst("RS-322", "ben");
    const bullInHand = inst("RS-075", "bull");
    let s = mk4({
      activePlayer: "player2",
      phase: "battle",
      turn: 3,
      player2: { rush: [ben], hand: [bullInHand] },
      player1: {
        rush: [inst("RS-076", "jaguar")],
        command: [released("TST-OP-ET", "e1")],
      },
    });
    const r = tryEnterBattle(s, "player2", ben.instanceId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = drainChoices(r.state, "player2", [bullInHand.instanceId]);
    s = drainChoices(s, "player1");
    s = payPendingIfAny(s, "player1");
    expect(zoneOf(s, "player2", bullInHand.instanceId)).toBe("discard");
    expect(cardIn(s, "player1", "command", "TST-OP-ET:e1")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
// 4. 効果によるラッシュ
// ===========================================================================

describe("R-RUSH-20 既定では条件不要", () => {
  // 「満たしていなくてもラッシュすることができますか？」「はい」
  it("R-RUSH-20: 遺跡発掘で相手はコマンドゾーンの追加条件付きMユニットを、必要パワー・追加条件・ホールドなしでラッシュエリアに出せる（出典: grnrngr/faq-card-2 RS-121 Q1・Q4）", () => {
    const bull = inst("RS-075", "p2bull");
    let s = mk4({
      phase: "battle",
      player1: { rush: [inst("RS-121", "dozer")] },
      player2: { command: [bull], power: [] },
    });
    s = dozerEnters(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(bull.instanceId);
    s = resolveChoice(s, "player2", bull.instanceId);
    expect(zoneOf(s, "player2", bull.instanceId)).toBe("rush");
  });

  // 「ホールド状態リリース状態関係なく選ぶことができますか？」「はい、できます」
  it("R-RUSH-20: 遺跡発掘ではホールド状態のコマンドのユニットカードも選べる（出典: grnrngr/faq-card-2 RS-121 Q3）", () => {
    const heldUnit = held("TST-UNIT-0", "p2held");
    let s = mk4({
      phase: "battle",
      player1: { rush: [inst("RS-121", "dozer")] },
      player2: { command: [heldUnit] },
    });
    s = dozerEnters(s);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(heldUnit.instanceId);
  });

  // 「満たす必要のない追加条件を「あえて満たす」ことはできない」
  it("R-RUSH-20: 効果ラッシュでは不要な追加条件を満たさない（自軍Sユニットは場に残る）（出典: atwiki/page-586）", () => {
    const bull = inst("RS-075", "p2bull");
    const sUnit = inst("TST-UNIT-0", "p2s");
    let s = mk4({
      phase: "battle",
      player1: { rush: [inst("RS-121", "dozer")] },
      player2: { command: [bull], rush: [sUnit], power: powers(5, "p2pw") },
    });
    s = dozerEnters(s);
    s = resolveChoice(s, "player2", bull.instanceId);
    s = drainChoices(s, "player2");
    expect(zoneOf(s, "player2", bull.instanceId)).toBe("rush");
    expect(zoneOf(s, "player2", sUnit.instanceId)).toBe("rush");
  });

  // 「カテゴリを参照する必要はありません」
  it("R-RUSH-20: 効果ラッシュではマルチカテゴリのコマンド条件を見ない（出典: atwiki/page-1559 Q1）", () => {
    const multi = inst("TST-UNIT-WB-ET", "p2multi");
    let s = mk4({
      phase: "battle",
      player1: { rush: [inst("RS-121", "dozer")] },
      player2: { command: [multi, released("TST-OP-OT", "p2ot")] },
    });
    s = dozerEnters(s);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(multi.instanceId);
    s = resolveChoice(s, "player2", multi.instanceId);
    expect(zoneOf(s, "player2", multi.instanceId)).toBe("rush");
  });

  // 「必要パワーも追加条件も満たす必要はありません」
  it("R-RUSH-20: パワーバズーカで捨札から出る合体素材は、パワー0・コマンドなしでもバトルエリアに出る（出典: grnrngr/faq-card-1 RS-009 Q1・Q4）", () => {
    const zord = { ...inst("RS-073", "z"), zordMaterialCardId: "RS-074" };
    const cosmo = inst("RS-074", "m1");
    const bull = inst("RS-075", "m2");
    const s0 = mk4({
      player1: { hand: [inst("RS-009", "bz")], power: powers(8), command: [held("TST-OP-ET", "et")] },
      player2: { battle: [zord], discard: [cosmo, bull], power: [], command: [] },
    });
    let s = playBazooka(s0, zord.instanceId);
    s = drainChoices(s, "player2");
    expect(zoneOf(s, "player2", cosmo.instanceId)).toBe("battle");
    expect(zoneOf(s, "player2", bull.instanceId)).toBe("battle");
  });

  // 既知の不具合: 未登録 — ドギー・クルーガーの【出動指令】が敵軍DAユニットのラッシュで誘発しない
  // 「コマンドをホールドする必要はありません」
  it.fails("R-RUSH-20: ドギー・クルーガーの効果で警察Sユニットをラッシュエリアに出すときコマンドのホールドは不要（出典: grnrngr/faq-card-5 RS-318 Q1）", () => {
    const daInst = inst("T04-DA", "da");
    const pink = inst("RS-110", "pink");
    const defs = {
      "T04-DA": { ...(T04["T04-S5"] as CardDefinition), id: "T04-DA", category: "DA" as const, powerCost: 0 },
    };
    let s = mk4({
      definitions: defs,
      player1: { hand: [daInst], command: [released("TST-OP-DA", "d1")] },
      player2: { rush: [inst("RS-318", "doggie")], deck: [pink, inst("TST-OP", "d2")], command: [] },
    });
    s = rushFromHand(s, "player1", daInst.instanceId, ["TST-OP-DA:d1"]);
    for (let i = 0; i < 4; i += 1) {
      if (s.pendingEffectChoice?.playerId === "player2") {
        s = resolveChoice(s, "player2");
        continue;
      }
      if (s.pendingRush) {
        s = passRushWindow(s);
        continue;
      }
      break;
    }
    expect(zoneOf(s, "player2", pink.instanceId)).toBe("rush");
  });

  // 既知の不具合: 未登録 — バラクティカ【編隊出撃】で出したカードが手札から捨札にも置かれ、2か所に重複する
  // 「その場合はコマンドをホールドする必要はありません」（バラクティカ）
  it.fails("R-RUSH-20: バラクティカの効果で同名ユニットを追加でラッシュエリアに出すときコマンドのホールドは不要（出典: grnrngr/faq-card-5 RS-318 Q1）", () => {
    const air1 = inst("T04-AIR", "a1");
    const air2 = inst("T04-AIR", "a2");
    let s = mk4({
      player1: {
        hand: [air1, air2],
        rush: [inst("RS-296", "bara")],
        power: powers(5),
        command: [released("TST-OP-DA", "d1")],
      },
    });
    s = rushFromHand(s, "player1", air1.instanceId, ["TST-OP-DA:d1"]);
    s = drainChoices(s, "player1", [air2.instanceId]);
    s = passRushWindow(s);
    expect(zoneOf(s, "player1", air1.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", air2.instanceId)).toBe("rush");
    expect(heldCount(s, "player1")).toBe(1);
  });

  // 既知の不具合: 未登録 — アブレラ（闇の取引）でパワー不足を補うラッシュが公開 API から開始できない
  // 「必要パワーを満たしていなくてもラッシュエリアに出すことができます」
  it.fails("R-RUSH-20: アブレラで必要パワー不足を補ってラッシュした航空機ユニットと同名のユニットを、バラクティカで必要パワー不足のままラッシュエリアに出せる（出典: grnrngr/faq-card-3 RS-170 Q2）", () => {
    const air1 = inst("T04-AIR", "a1");
    const air2 = inst("T04-AIR", "a2");
    let s = mk4({
      player1: {
        hand: [air1, air2],
        rush: [inst("RS-296", "bara"), inst("RS-170", "abrera")],
        power: powers(3),
        command: [
          released("TST-OP-DA", "d1"),
          released("TST-OP-DA", "d2"),
          released("TST-OP-DA", "d3"),
        ],
      },
    });
    s = rushFromHand(s, "player1", air1.instanceId, ["TST-OP-DA:d1", "TST-OP-DA:d2", "TST-OP-DA:d3"]);
    s = payPendingIfAny(s, "player1");
    s = drainChoices(s, "player1", [air2.instanceId]);
    s = passRushWindow(s);
    expect(zoneOf(s, "player1", air1.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", air2.instanceId)).toBe("rush");
  });
});

describe("R-RUSH-21 テキストで条件を課す場合", () => {
  // 「「必要パワー」以上のカードが自軍パワーゾーンに」
  it("R-RUSH-21: ランドバルカンでは必要パワーを満たさないSユニットは出せない（出典: grnrngr/faq-card-1 RS-005 Q3）", () => {
    const s5 = inst("T04-S5", "s5");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [s5, inst("TST-UNIT-0", "s0"), held("TST-OP-ET", "et")],
      },
    });
    const s1 = playLandVulcan(s0);
    expect(zoneOf(s1, "player1", s5.instanceId)).toBe("command");
  });

  // 「コマンドをホールドしなくてもラッシュエリアに出すことができます」
  it("R-RUSH-21: ランドバルカンで出すユニットのカテゴリのコマンドはホールド不要（出典: grnrngr/faq-card-1 RS-005 Q3）", () => {
    const wbS = inst("TST-UNIT-0", "s0");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [wbS, held("TST-OP-ET", "et")],
      },
    });
    const s1 = playLandVulcan(s0);
    expect(zoneOf(s1, "player1", wbS.instanceId)).toBe("rush");
  });

  // 既知の不具合: 03-D9 / 05-D7
  // 「追加条件…があればそれを満たす必要があります」
  it.fails("R-RUSH-21: ランドバルカンでは追加条件を満たせないSユニット（龍冥王サラマンデス）は出せない（出典: grnrngr/faq-card-1 RS-005 Q3, atwiki/page-249）", () => {
    const sala = inst("RS-094", "sala");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [sala, inst("TST-UNIT-0", "s0"), held("TST-OP-ET", "et")],
      },
    });
    const s1 = playLandVulcan(s0);
    expect(zoneOf(s1, "player1", sala.instanceId)).toBe("command");
  });

  // 既知の不具合: 03-D9 / 05-D7
  // 「ただし、ラッシュするための必要パワーと追加条件は満たすこと」
  it.fails("R-RUSH-21: ランドバルカンでは追加条件（童鬼ドロップを捨札）を実行して龍冥王サラマンデスを出す（出典: atwiki/page-249, grnrngr/faq-card-1 RS-005 Q3）", () => {
    const sala = inst("RS-094", "sala");
    const drop = inst("RS-093", "drop");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        rush: [drop],
        power: powers(4),
        command: [sala, held("TST-OP-ET", "et")],
      },
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1", [sala.instanceId, drop.instanceId]);
    expect(zoneOf(s1, "player1", sala.instanceId)).toBe("rush");
    expect(zoneOf(s1, "player1", drop.instanceId)).toBe("discard");
  });

  // 「「－」の追加条件を持つカードの場合は…満たさなくてよい」
  it("R-RUSH-21: ランドバルカンでも「－」の追加条件は任意（7パワーあればアバレッドなしでアバレッドAMを出せる）（出典: atwiki/page-586）", () => {
    const am = inst("RS-230", "am");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(7),
        command: [am, held("TST-OP-ET", "et")],
      },
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1", [am.instanceId]);
    expect(zoneOf(s1, "player1", am.instanceId)).toBe("rush");
  });

  // 既知の不具合: 03-D9 / 05-D7
  // 「追加条件を満たすことでパワーを軽減してラッシュすることもできる」
  it.fails("R-RUSH-21: ランドバルカンで「－」の追加条件を満たせば、パワー不足でもアバレッドAMを出せる（出典: atwiki/page-586）", () => {
    const am = inst("RS-230", "am");
    const red = inst("RS-054", "red");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        rush: [red],
        power: powers(4),
        command: [am, held("TST-OP-ET", "et")],
      },
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1", [am.instanceId, red.instanceId]);
    expect(zoneOf(s1, "player1", am.instanceId)).toBe("rush");
    expect(zoneOf(s1, "player1", red.instanceId)).toBe("discard");
  });

  // 「自軍パワーが６以下でも」→「はい、出す事ができます」
  it("R-RUSH-21: シーロンの光で選ばれたアバレッドAMは、パワー6以下でもアバレッドを捨札にして出せる（出典: grnrngr/faq-card-1 RS-013 Q1）", () => {
    const am = inst("RS-230", "am");
    const red = inst("RS-054", "red");
    const s0 = mk4({
      player1: {
        hand: [am],
        rush: [red],
        operation: [inst("RS-013", "sh")],
        power: powers(4),
        command: [],
      },
      player2: { hand: [] },
    });
    const revealed = shironReveal(s0, am.instanceId);
    const r = tryRushZord(revealed, "player1", am.instanceId, { material: red.instanceId, destination: "discard" }, []);
    const s1 = r.ok
      ? r.state
      : act(revealed, {
          type: "rush",
          playerId: "player1",
          instanceId: am.instanceId,
          zordMaterialInstanceId: red.instanceId,
        });
    expect(zoneOf(s1, "player1", am.instanceId)).toBe("rush");
    expect(zoneOf(s1, "player1", red.instanceId)).toBe("discard");
  });

  // 「コマンドをホールドしなくても…出すことができます」
  it("R-RUSH-21: シーロンの光で出すユニットはコマンドのホールド不要だが、必要パワーは満たす必要がある（出典: grnrngr/faq-card-1 RS-013 Q4）", () => {
    const unit = inst("TST-UNIT-2", "u2");
    const base = {
      player1: {
        hand: [unit],
        operation: [inst("RS-013", "sh")],
        power: powers(2),
        command: [] as never[],
      },
      player2: { hand: [] },
    };
    const ok = shironReveal(mk4(base), unit.instanceId);
    const rushed = act(ok, { type: "rush", playerId: "player1", instanceId: unit.instanceId });
    expect(zoneOf(rushed, "player1", unit.instanceId)).toBe("rush");

    const short = shironReveal(
      mk4({ ...base, player1: { ...base.player1, power: powers(1) } }),
      unit.instanceId,
    );
    expect(
      applyAction(short, { type: "rush", playerId: "player1", instanceId: unit.instanceId }).ok,
    ).toBe(false);
  });

  // 「必要パワーが足りていない場合に…補うことはできますか？」「はい」
  it("R-RUSH-21: シーロンの光で選ばれたDAユニットの必要パワー不足を、アブレラの効果（コマンドのホールド）で補える（出典: grnrngr/faq-card-3 RS-170 Q3）", () => {
    const air = inst("T04-AIR", "a1");
    const s0 = mk4({
      player1: {
        hand: [air],
        rush: [inst("RS-170", "abrera")],
        operation: [inst("RS-013", "sh")],
        power: powers(3),
        command: [released("TST-OP-DA", "d1"), released("TST-OP-DA", "d2")],
      },
      player2: { hand: [] },
    });
    const revealed = shironReveal(s0, air.instanceId);
    let r = applyAction(revealed, { type: "rush", playerId: "player1", instanceId: air.instanceId });
    if (!r.ok) r = tryRushFromHand(revealed, "player1", air.instanceId, ["TST-OP-DA:d1", "TST-OP-DA:d2"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s1 = payPendingIfAny(r.state, "player1");
    expect(zoneOf(s1, "player1", air.instanceId)).toBe("rush");
    expect(heldCount(s1, "player1")).toBe(2);
  });

  // 既知の不具合: 未登録 — 空輸搬送（「ただし…追加条件は満たすこと」）で出すMユニットの追加条件を実行しない
  // 「その場合はＳユニットは捨札にしなければなりません」
  it.fails("R-RUSH-21: コマンド5枚のとき、空輸搬送で出すMユニットの追加条件のSユニットはコマンドゾーンに送れず捨札にする（出典: grnrngr/faq-card-2 RS-120 Q1・grnrngr/faq-card-4 RS-197 Q4）", () => {
    const gyro = inst("RS-120", "gyro");
    const dump = inst("RS-118", "dump");
    const sA = inst("TST-UNIT-0", "sa");
    const sB = inst("TST-UNIT-0", "sb");
    let s = mk4({
      player1: {
        hand: [gyro],
        rush: [sA, sB],
        power: powers(5),
        command: [
          dump,
          released("TST-OP-ET", "e1"),
          released("TST-OP-ET", "e2"),
          released("TST-OP", "w1"),
          held("TST-OP", "w2"),
        ],
      },
    });
    const r = tryRushZord(s, "player1", gyro.instanceId, { material: sA.instanceId, destination: "discard" }, [
      "TST-OP-ET:e1",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    s = drainChoices(s, "player1", [dump.instanceId, sB.instanceId]);
    s = payPendingIfAny(s, "player1");
    s = drainChoices(s, "player1", [sB.instanceId]);
    expect(zoneOf(s, "player1", dump.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", sB.instanceId)).toBe("discard");
  });
});

describe("R-RUSH-22 効果ラッシュでも誘発とカウンター窓がある", () => {
  // 既知の不具合: E11
  // 「「ラッシュされたとき」に発動できるカウンタを発動させることもできます」
  it("R-RUSH-22: ランドバルカンで出したユニットにも「ラッシュされたとき」のカウンターを使える（出典: grnrngr/faq-card-1 RS-005 Q2）", () => {
    const sUnit = inst("TST-UNIT-0", "cmd-s");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [sUnit, held("TST-OP-ET", "et")],
      },
      player2: counterReadyOpponent(),
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1", [sUnit.instanceId]);
    expect(s1.pendingRush?.rushedInstanceId).toBe(sUnit.instanceId);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(true);
  });

  // 既知の不具合: E11
  // 「「ラッシュしたとき」の効果は発動します」
  it.fails("R-RUSH-22: ランドバルカンで出したSユニットにも「Sユニットをラッシュしたとき」（超電子レーダー）が誘発する（出典: grnrngr/faq-card-1 RS-005 Q2）", () => {
    const sUnit = inst("TST-UNIT-0", "cmd-s");
    const s0 = mk4({
      definitions: {
        "RS-124": { ...(mk().definitions["RS-124"] as CardDefinition), tags: ["常駐"] },
      },
      player1: {
        hand: [inst("RS-005", "lv")],
        operation: [inst("RS-124", "radar")],
        power: powers(4),
        command: [sUnit, held("TST-OP-ET", "et")],
      },
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1");
    expect(s1.players.player1.hand.some((c) => c.cardId === "TST-OP")).toBe(true);
    expect(s1.players.player1.power).toHaveLength(3);
  });

  // 既知の不具合: E11
  // 「ラッシュエリアに出した後で、可能であればバトルエリアに置いてください」
  it.fails("R-RUSH-22: ランドバルカンで出したレッドレーサーは「ラッシュするとき可能ならバトルエリアに置く」に従う（出典: grnrngr/faq-card-2 RS-090 Q2）", () => {
    const racer = inst("RS-090", "racer");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [racer, held("TST-OP-ET", "et")],
      },
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1", [racer.instanceId]);
    expect(zoneOf(s1, "player1", racer.instanceId)).toBe("battle");
  });

  // 「「ラッシュしたとき」の効果は発動しますし…カウンタを発動させることもできます」
  it("R-RUSH-22: シーロンの光で出したユニットにも「ラッシュされたとき」のカウンターを使える（出典: grnrngr/faq-card-1 RS-013 Q3）", () => {
    const unit = inst("TST-UNIT-0", "u");
    const s0 = mk4({
      player1: { hand: [unit], operation: [inst("RS-013", "sh")], power: powers(1), command: [] },
      player2: counterReadyOpponent(),
    });
    const revealed = shironReveal(s0, unit.instanceId);
    const s1 = act(revealed, { type: "rush", playerId: "player1", instanceId: unit.instanceId });
    expect(s1.pendingRush?.rushedInstanceId).toBe(unit.instanceId);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(true);
  });

  // 既知の不具合: E11
  // 「手札に戻さなければなりませんか？」「はい」
  it.fails("R-RUSH-22: 遺跡発掘で相手がSユニットを出したとき、超電子レーダーにより相手はパワーを1枚手札に戻す（出典: grnrngr/faq-card-2 RS-121 Q2）", () => {
    const sCard = inst("TST-UNIT-0", "p2s");
    let s = mk4({
      phase: "battle",
      definitions: {
        "RS-124": { ...(mk().definitions["RS-124"] as CardDefinition), tags: ["常駐"] },
      },
      player1: { rush: [inst("RS-121", "dozer")], operation: [inst("RS-124", "radar")] },
      player2: { command: [sCard], power: powers(2, "p2pw") },
    });
    s = dozerEnters(s);
    s = resolveChoice(s, "player2", sCard.instanceId);
    s = drainChoices(s, "player2");
    expect(zoneOf(s, "player2", sCard.instanceId)).toBe("rush");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand.some((c) => c.cardId === "TST-OP")).toBe(true);
  });

  // 既知の不具合: 未登録 — ダイナギャリー【パーツキャリアー】でコマンドゾーンのMユニットがラッシュエリアに出ない（ログのみ）
  // 「ラッシュしたときの効果は発動しますか？」「はい、発動します」
  it.fails("R-RUSH-22: パーツキャリアーで出したブルバルカンの「ラッシュしたとき」（救助活動）が発動する（出典: grnrngr/faq-card-4 RS-197 Q1・Q3）", () => {
    const gally = inst("RS-197", "gally");
    const bull = inst("RS-075", "bull");
    const sUnit = inst("TST-UNIT-0", "s");
    const mecha = inst("RS-079", "silva");
    let s = mk4({
      phase: "battle",
      player1: {
        rush: [gally, sUnit],
        discard: [mecha],
        power: powers(5),
        command: [bull],
      },
    });
    const r = tryEnterBattle(s, "player1", gally.instanceId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = drainChoices(r.state, "player1", [bull.instanceId, sUnit.instanceId, mecha.instanceId]);
    expect(zoneOf(s, "player1", bull.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", mecha.instanceId)).toBe("hand");
  });
});

describe("R-RUSH-23 複数体を出す効果は1体ずつ", () => {
  // 既知の不具合: 05-D7
  // 「選んだ１枚ごとに「ラッシュエリアに出してもよい」」
  it.fails("R-RUSH-23: ランドバルカンは2枚まで選んでから1枚ずつ出し、1枚目のラッシュ後にカウンター窓が開き2枚目はまだコマンドゾーンにある（出典: grnrngr/faq-card-1 RS-005 Q1）", () => {
    const a = inst("TST-UNIT-0", "a");
    const b = inst("TST-UNIT-0", "b");
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [a, b, held("TST-OP-ET", "et")],
      },
      player2: counterReadyOpponent(),
    });
    let s1 = playLandVulcan(s0);
    s1 = drainChoices(s1, "player1", [a.instanceId, b.instanceId]);
    expect(s1.pendingRush).toBeDefined();
    const firstId = s1.pendingRush!.rushedInstanceId;
    const secondId = firstId === a.instanceId ? b.instanceId : a.instanceId;
    expect(zoneOf(s1, "player1", secondId)).toBe("command");
  });

  // 既知の不具合: 05-D7
  // 「「２枚まで選び」」（プレイヤーが選ぶ）
  it.fails("R-RUSH-23: ランドバルカンで出すSユニットはプレイヤーが選ぶ（候補が3枚あれば選択が求められる）（出典: grnrngr/faq-card-1 RS-005 Q1）", () => {
    const s0 = mk4({
      player1: {
        hand: [inst("RS-005", "lv")],
        power: powers(4),
        command: [
          inst("TST-UNIT-0", "a"),
          inst("TST-UNIT-0", "b"),
          inst("TST-UNIT-0", "c"),
          held("TST-OP-ET", "et"),
        ],
      },
    });
    const s1 = playLandVulcan(s0);
    expect(s1.pendingEffectChoice?.playerId).toBe("player1");
  });
});

describe("R-RUSH-24 「このとき出したユニットの効果は発動しない」", () => {
  // 「バトルエリアでなくラッシュエリアに置きますか？」「はい、その通りです」
  it("R-RUSH-24: 遺跡発掘で出したレッドレーサーは「可能ならバトルエリアに置く」に従わずラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-121 Q5・RS-090 Q6）", () => {
    const racer = inst("RS-090", "p2racer");
    let s = mk4({
      phase: "battle",
      player1: { rush: [inst("RS-121", "dozer")] },
      player2: { command: [racer, released("TST-OP-OT", "p2ot")] },
    });
    s = dozerEnters(s);
    s = resolveChoice(s, "player2", racer.instanceId);
    s = drainChoices(s, "player2");
    expect(zoneOf(s, "player2", racer.instanceId)).toBe("rush");
  });

  // 「「ラッシュされたとき」のタイミングに発動する効果の使用ができない」
  it("R-RUSH-24: 遺跡発掘で出したジュウマンモスの「ラッシュしたとき」（モスブリザード）は発動しない（出典: atwiki/page-146）", () => {
    const mammoth = inst("RS-036", "p2mammoth");
    let s = mk4({
      phase: "battle",
      player1: {
        rush: [inst("RS-121", "dozer")],
        command: [released("TST-OP", "c1"), released("TST-OP", "c2"), released("TST-OP", "c3")],
      },
      player2: { command: [mammoth] },
    });
    s = dozerEnters(s);
    const heldBefore = heldCount(s, "player1");
    s = resolveChoice(s, "player2", mammoth.instanceId);
    s = drainChoices(s, "player2");
    expect(zoneOf(s, "player2", mammoth.instanceId)).toBe("rush");
    expect(heldCount(s, "player1")).toBe(heldBefore);
  });

  // 「これはラッシュされたユニットの効果全てが無効になるということではなく」
  it.todo(
    "R-RUSH-24: 「このとき出したユニットの効果は発動しない」で出したユニットも、ラッシュ以外のタイミングの効果（常在効果等）は有効（出典: atwiki/page-146）— 遺跡発掘で出したユニットの常在効果を区別して観測できる適切なカードがなく保留",
  );
});

// ===========================================================================
// 5. ラッシュへの応答
// ===========================================================================

describe("R-RUSH-30 「ラッシュされたとき」の窓", () => {
  // 「ラッシュに誘発した処理…をすべて完了させてから」
  it("R-RUSH-30: 超電子レーダーの処理（パワーを手札に戻す）を終えてから疾風流超忍法の窓が開く（出典: grnrngr/faq-card-1 RS-026 Q6）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const s0 = mk4({
      definitions: {
        "RS-124": { ...(mk().definitions["RS-124"] as CardDefinition), tags: ["常駐"] },
      },
      player1: {
        hand: [unit],
        power: powers(1),
        operation: [inst("RS-124", "radar")],
        command: [released("TST-OP", "c1")],
      },
      player2: counterReadyOpponent(),
    });
    const s1 = rushFromHand(s0, "player1", unit.instanceId, ["TST-OP:c1"]);
    expect(s1.players.player1.hand.some((c) => c.cardId === "TST-OP")).toBe(true);
    expect(s1.pendingRush?.rushedInstanceId).toBe(unit.instanceId);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(true);
  });

  // 「まずユニットのラッシュしたときの効果を適用して、コマンドを２つホールドします」
  it("R-RUSH-30: ジュウマンモスのモスブリザードで相手のリリース状態コマンドがすべてホールドされれば、疾風流超忍法は使えない（出典: grnrngr/faq-card-1 RS-036 Q1）", () => {
    const mammoth = inst("RS-036", "mammoth");
    const s0 = mk4({
      player1: { hand: [mammoth], power: powers(5), command: [released("TST-OP", "c1")] },
      player2: counterReadyOpponent({
        command: [released("TST-OP-MA", "ma1"), released("TST-OP-MA", "ma2")],
      }),
    });
    let s1 = rushFromHand(s0, "player1", mammoth.instanceId, ["TST-OP:c1"]);
    s1 = holdCommandsForEffect(s1, "player2", ["TST-OP-MA:ma1", "TST-OP-MA:ma2"]);
    expect(heldCount(s1, "player2")).toBe(2);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(false);
  });

  // 既知の不具合: 未登録 — 「ラッシュしたとき」効果の選択（コマンドのホールド）を解決した後に「ラッシュされたとき」の窓が開かない
  // 「まずユニットのラッシュしたときの効果を適用してから、相手は可能であれば…発動」
  it.fails("R-RUSH-30: 「ラッシュしたとき」の効果（モスブリザード）を適用した後、リリース状態のコマンドが残っていればカウンターできる（出典: grnrngr/faq-card-1 RS-026 Q10）", () => {
    const mammoth = inst("RS-036", "mammoth");
    const s0 = mk4({
      player1: { hand: [mammoth], power: powers(5), command: [released("TST-OP", "c1")] },
      player2: counterReadyOpponent({
        command: [
          released("TST-OP", "w1"),
          released("TST-OP", "w2"),
          released("TST-OP-MA", "ma1"),
        ],
      }),
    });
    let s1 = rushFromHand(s0, "player1", mammoth.instanceId, ["TST-OP:c1"]);
    s1 = holdCommandsForEffect(s1, "player2", ["TST-OP:w1", "TST-OP:w2"]);
    expect(heldCount(s1, "player2")).toBe(2);
    expect(s1.pendingRush?.rushedInstanceId).toBe(mammoth.instanceId);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(true);
  });

  // 「リリース状態のコマンドを１つでも残していれば」
  it("R-RUSH-30: 相手のコマンドがすべてホールド状態ならカウンターの窓で疾風流超忍法を使えない（出典: grnrngr/faq-card-1 RS-026 Q8）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const s0 = mk4({
      player1: { hand: [unit], command: [released("TST-OP", "c1")] },
      player2: counterReadyOpponent({ command: [held("TST-OP-MA", "ma")] }),
    });
    const s1 = rushFromHand(s0, "player1", unit.instanceId, ["TST-OP:c1"]);
    expect(canCounter(s1, "player2", "RS-026:shippu")).toBe(false);
  });

  // 「相手が次の宣言を行うまでの間です」
  it("R-RUSH-30: 「ラッシュされたとき」の窓が開いている間、ターンプレイヤーは次の宣言（ラッシュ・フェイズ終了）ができない（出典: grnrngr/faq-card-1 RS-026 Q8）", () => {
    const a = inst("TST-UNIT-0", "a");
    const b = inst("TST-UNIT-0", "b");
    const s0 = mk4({
      player1: { hand: [a, b], command: [released("TST-OP", "c1"), released("TST-OP", "c2")] },
      player2: counterReadyOpponent(),
    });
    const s1 = rushFromHand(s0, "player1", a.instanceId, ["TST-OP:c1"]);
    expect(s1.pendingRush).toBeDefined();
    expect(legal(s1).some((x) => x.playerId === "player1")).toBe(false);
    const passed = passRushWindow(s1);
    expect(canStartRush(passed, "player1", b.instanceId)).toBe(true);
  });

  // 「ゲームを巻き戻させることが可能です」
  it.todo(
    "R-RUSH-30: 相手の確認なしにターンプレイヤーが先へ進めた場合は巻き戻しを要求できる（出典: grnrngr/faq-card-1 RS-026 Q8）— 対面での進行確認に関する裁定で、エンジンは窓を必ず開くため巻き戻し要求を表現できない",
  );
});
