/**
 * docs/rules/02-zones-cards.md §2 カードの種類・サイズ・カテゴリ（R-CARD / R-SIZE / R-CAT）のルールスペック。
 * 期待値はルールブックと docs/rules/sources/web/ の公式FAQ・atwiki に従う（エンジン現状ではない）。
 */
import { describe, expect, it } from "vitest";
import { cardCategories } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { isCounterOperation, isPermanentOperation, isMediumUnit } from "../core/catalog";
import { countAvailablePower } from "../core/power";
import { countFieldFeatureUnits } from "../rules/rs/rsCatchallChoices";
import {
  DEFS,
  deckCards,
  hasLegal,
  inst,
  legal,
  payAndPlayOperation,
  payAndRush,
  powerCards,
  shironReveal,
  st,
  unwrap,
  zoneOf,
  zordRush,
} from "./02-helpers";

const realCards = Object.values(DEFS).filter((d) => !d.id.startsWith("TST-") && !d.id.startsWith("SPEC-"));

describe("R-CARD-01 カードの種類", () => {
  // 「ユニットカード、ビークルカード、オペレーションカード」
  it("R-CARD-01: デッキに入るカードはユニット・ビークル・オペレーションのいずれか（出典: atwiki/page-581, page-141）", () => {
    const types = new Set(realCards.map((d) => d.type));
    expect([...types].sort()).toEqual(["operation", "unit", "vehicle"]);
  });

  // 「常駐…通常…カウンターの3種類」
  it("R-CARD-01: オペレーションは通常・常駐・カウンターの3種類（出典: atwiki/page-581）", () => {
    expect(isPermanentOperation(DEFS["RS-013"])).toBe(true);
    expect(isCounterOperation(DEFS["RS-013"])).toBe(false);
    expect(isCounterOperation(DEFS["RS-026"])).toBe(true);
    expect(isPermanentOperation(DEFS["RS-026"])).toBe(false);
    expect(isPermanentOperation(DEFS["RS-068"])).toBe(false);
    expect(isCounterOperation(DEFS["RS-068"])).toBe(false);
  });
});

describe("R-CARD-02 オペレーションの使用時期", () => {
  // 「通常オペレーションは自軍ラッシュフェイズにのみ使用可能」
  it("R-CARD-02: 通常オペレーションは自軍バトルフェイズには使用できない（出典: atwiki/page-581）", () => {
    const s = st({
      phase: "battle",
      player1: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP-ET", "c")], discard: [inst("SPEC-S-WB", "d")] },
    });
    expect(hasLegal(s, (a) => "instanceId" in a && a.instanceId === "RS-068:op")).toBe(false);
    expect(hasLegal(s, (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-068:op")).toBe(false);
    expect(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"], "SPEC-S-WB:d").ok).toBe(false);
  });

  it("R-CARD-02: 通常オペレーションは敵軍ターン中には使用できない（出典: atwiki/page-581）", () => {
    const s = st({
      phase: "rush",
      activePlayer: "player1",
      player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP", "c")], deck: deckCards(3) },
      player2: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP-ET", "c2")], discard: [inst("SPEC-S-WB", "d")] },
    });
    const rushed = unwrap(payAndRush(s, "player1", "SPEC-S-WB:u", ["TST-OP:c"]));
    expect(
      hasLegal(rushed, (a) => a.playerId === "player2" && "sourceInstanceId" in a && a.sourceInstanceId === "RS-068:op"),
    ).toBe(false);
  });

  // 「常駐オペレーションの配置もラッシュフェイズに行う」
  it("R-CARD-02: 常駐オペレーションは自軍バトルフェイズには配置できない（出典: atwiki/page-581）", () => {
    const s = st({
      phase: "battle",
      player1: { hand: [inst("RS-069", "res")], power: powerCards(4), command: [inst("TST-OP-ET", "c")] },
    });
    expect(payAndPlayOperation(s, "player1", "RS-069:res", ["TST-OP-ET:c"]).ok).toBe(false);
    expect(zoneOf(s, "player1", "RS-069:res")).toBe("hand");
  });

  // 「カウンターは敵軍ターン中のみ」
  it("R-CARD-02: カウンターオペレーションは自軍ラッシュフェイズに使用できない（出典: atwiki/page-581, page-1828）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-026", "ctr")], power: powerCards(3), command: [inst("TST-OP-MA", "m")], rush: [inst("SPEC-S-WB", "u")] },
    });
    expect(hasLegal(s, (a) => "sourceInstanceId" in a && a.sourceInstanceId === "RS-026:ctr")).toBe(false);
    expect(hasLegal(s, (a) => "instanceId" in a && a.instanceId === "RS-026:ctr")).toBe(false);
  });

  // 「通常オペレーションは使用後捨札になる」
  it("R-CARD-02: 通常オペレーションは使用後に捨札になる（出典: atwiki/page-581, grnrngr rule_phase3）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP-ET", "c")], discard: [inst("SPEC-S-WB", "d")] },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"], "SPEC-S-WB:d"));
    expect(zoneOf(r, "player1", "RS-068:op")).toBe("discard");
  });

  // 「中にはパワーやコマンドに送られる特殊なものも存在する」
  it("R-CARD-02: 例外としてテキストで指定されたオペレーション（クルマジックパワー）は捨札でなくパワーゾーンに置く（出典: atwiki/page-581）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-020", "op")], command: [inst("TST-OP-OT", "c")] } });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-020:op", ["TST-OP-OT:c"]));
    expect(zoneOf(r, "player1", "RS-020:op")).toBe("power");
  });
});

describe("R-CARD-03 空撃ち", () => {
  // 「発動しないが、発動したものとして捨札にする…はい、できます」
  it("R-CARD-03: 対象のない（捨札が空の）オペレーションもコマンドをホールドして使用でき、捨札になる（出典: atwiki/page-581 Q1/A1, grnrngr/faq オペレーション）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP-ET", "c")], discard: [] },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"]));
    expect(zoneOf(r, "player1", "RS-068:op")).toBe("discard");
    expect(r.players.player1.command[0]?.commandHeld).toBe(true);
    expect(r.players.player1.hand).toHaveLength(0);
  });

  // 「コマンドをホールドしたり、手札を減らす目的で…使用する…ことはできます」
  it("R-CARD-03: 自軍山札が2枚以下でもデンジマシーンを使用でき、効果は発動せず捨札になる（出典: grnrngr/faq-card-1 RS-004）", () => {
    const deck = deckCards(2);
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-004", "op")], power: powerCards(4), command: [inst("TST-OP-OT", "c")], deck },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-004:op", ["TST-OP-OT:c"]));
    // 効果（公開・手札追加）の選択が開かれていれば発動してしまっている
    expect(r.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(r, "player1", "RS-004:op")).toBe("discard");
    expect(r.players.player1.command[0]?.commandHeld).toBe(true);
    expect(r.players.player1.deck.map((c) => c.instanceId)).toEqual(deck.map((c) => c.instanceId));
  });
});

describe("R-CARD-04 ビークル", () => {
  // 「ビークルにユニットでアタックできますか？…いいえ」
  it("R-CARD-04: バトルエリアのビークルにはアタックできない（出典: atwiki/page-141 Q4/A4）", () => {
    const s = st({
      phase: "battle",
      player1: { battle: [inst("SPEC-S-WB", "a")] },
      player2: { battle: [inst("SPEC-RIDER", "r"), inst("SPEC-VEHICLE-S", "v")], deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "battle" && a.defenderInstanceId === "SPEC-VEHICLE-S:v")).toBe(false);
    expect(
      applyAction(s, { type: "battle", playerId: "player1", attackerInstanceId: "SPEC-S-WB:a", defenderInstanceId: "SPEC-VEHICLE-S:v" }).ok,
    ).toBe(false);
  });

  // 「ユニットを選ぶとき、ビークルを選ぶことはできますか？…いいえ」
  it("R-CARD-04: 「ユニットを1体選ぶ」効果（圧縮冷凍）でビークルは選べない（出典: atwiki/page-141 Q5/A5）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: { rush: [inst("SPEC-VEHICLE-S", "v")], deck: deckCards(3) },
    });
    const r = payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-VEHICLE-S:v");
    if (r.ok) expect(zoneOf(r.state, "player2", "SPEC-VEHICLE-S:v")).toBe("rush");
  });

  // 「特徴「車両」を持つユニットを対象にした効果は、ビークルでも…いいえ」
  it("R-CARD-04: 特徴「車両」を持つビークルは「車両」のユニットとして数えない（出典: atwiki/page-141 Q6/A6）", () => {
    const s = st({ phase: "rush", player1: { rush: [inst("SPEC-VEHICLE-S", "v")] } });
    expect(countFieldFeatureUnits(s, "player1", "車両", "both")).toBe(0);
  });

  // 「ユニットやビークルの特徴は、それぞれ個別に持つ」
  it("R-CARD-04: ビークルにライドしたユニットにビークルの特徴は追加されない（出典: atwiki/page-141 Q3/A3）", () => {
    const s = st({
      phase: "battle",
      player1: {
        battle: [{ ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "SPEC-VEHICLE-S:v" }, inst("SPEC-VEHICLE-S", "v")],
      },
    });
    expect(countFieldFeatureUnits(s, "player1", "車両", "both")).toBe(0);
  });

  // 「ユニットにライドされなければバトルエリアに出られない」
  it("R-CARD-04: ライドされていないビークルは単独でバトルエリアに出られない（出典: atwiki/page-141 本文）", () => {
    const s = st({ phase: "battle", player1: { rush: [inst("SPEC-VEHICLE-S", "v")] }, player2: { deck: deckCards(3) } });
    expect(hasLegal(s, (a) => a.type === "move_to_battle" && a.instanceId === "SPEC-VEHICLE-S:v")).toBe(false);
    expect(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-VEHICLE-S:v" }).ok).toBe(false);
  });

  it("R-CARD-04: RCユニットはビークルにライドしてバトルエリアに出られ、ビークルも並び順に数える（出典: atwiki/page-141 本文）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-RIDER", "r"), inst("SPEC-VEHICLE-S", "v"), inst("SPEC-S-WB", "next")] },
      player2: { deck: deckCards(3) },
    });
    const ride = legal(s).find((a) => a.type === "mount_ride" && a.vehicleInstanceId === "SPEC-VEHICLE-S:v");
    expect(ride).toBeDefined();
    let r = unwrap(applyAction(s, ride!));
    if (r.pendingRideOffChoice) r = unwrap(applyAction(r, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false }));
    expect(zoneOf(r, "player1", "SPEC-VEHICLE-S:v")).toBe("battle");
    expect(zoneOf(r, "player1", "SPEC-RIDER:r")).toBe("battle");
    // ビークルも並び順の個数に数えられる（ライダー＋ビークルで2つ分）
    expect(r.players.player1.battle).toHaveLength(2);
  });

  // 「はい、ライドしたままの状態になります」
  it("R-CARD-04: スタートフェイズにラッシュエリアへ戻ってもライドしたまま（出典: atwiki/page-141 Q1/A1）", () => {
    let s = st({
      phase: "start",
      player1: {
        battle: [{ ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "SPEC-VEHICLE-S:v" }, inst("SPEC-VEHICLE-S", "v")],
        deck: deckCards(3),
      },
    });
    s = unwrap(applyAction(s, { type: "return_all_battle_to_rush", playerId: "player1" }));
    const rider = s.players.player1.rush.find((c) => c.instanceId === "SPEC-RIDER:r");
    expect(rider?.mountedOnInstanceId).toBe("SPEC-VEHICLE-S:v");
    expect(zoneOf(s, "player1", "SPEC-VEHICLE-S:v")).toBe("rush");
  });

  // 「Mユニットがビークルにライド状態になるということはありません」
  it("R-CARD-04: ライド中のSユニットを追加条件に使ってラッシュしたMユニットはライド状態にならない（出典: atwiki/page-141 Q2/A2）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "m")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c")],
        rush: [{ ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "SPEC-VEHICLE-S:v" }, inst("SPEC-VEHICLE-S", "v")],
      },
    });
    const r = unwrap(
      zordRush(s, "player1", "RS-074:m", "TST-OP-ET:c", {
        zordMaterialInstanceId: "SPEC-RIDER:r",
        zordMaterialDestination: "discard",
      }),
    );
    const m = r.players.player1.rush.find((c) => c.instanceId === "RS-074:m");
    expect(m).toBeDefined();
    expect(m?.mountedOnInstanceId).toBeUndefined();
    expect(zoneOf(r, "player1", "SPEC-VEHICLE-S:v")).toBe("rush");
  });

  // 「いいえ、その場に残ります」（撃破されて捨札）
  it("R-CARD-04: ライド中のユニットが撃破されて捨札になってもビークルはその場に残る（出典: atwiki/page-141 Q7/A7）", () => {
    let s = st({
      phase: "battle",
      activePlayer: "player2",
      player1: {
        battle: [{ ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "SPEC-VEHICLE-S:v" }, inst("SPEC-VEHICLE-S", "v")],
        deck: deckCards(3),
      },
      player2: { battle: [inst("SPEC-M-WB", "atk")], deck: deckCards(3, "e") },
    });
    s = unwrap(
      applyAction(s, { type: "battle", playerId: "player2", attackerInstanceId: "SPEC-M-WB:atk", defenderInstanceId: "SPEC-RIDER:r" }),
    );
    for (let i = 0; i < 6; i += 1) {
      const pass = legal(s).find((a) => a.type.startsWith("pass_"));
      if (!pass) break;
      s = unwrap(applyAction(s, pass));
    }
    expect(zoneOf(s, "player1", "SPEC-RIDER:r")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-VEHICLE-S:v")).toBe("battle");
  });

  // 「いいえ、その場に残ります」（パワーゾーンやコマンドゾーンに移される）
  it("R-CARD-04: ライド中のユニットがパワーゾーンに移されてもビークルはその場に残る（出典: atwiki/page-141 Q8/A8）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: {
        rush: [{ ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "SPEC-VEHICLE-S:v" }, inst("SPEC-VEHICLE-S", "v")],
        deck: deckCards(3),
      },
    });
    let r = unwrap(payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-RIDER:r"));
    if (r.pendingLeave) r = unwrap(applyAction(r, { type: "pass_leave_reaction", playerId: "player2" }));
    expect(zoneOf(r, "player2", "SPEC-RIDER:r")).toBe("power");
    expect(zoneOf(r, "player2", "SPEC-VEHICLE-S:v")).toBe("rush");
  });

  // 「バトルエリアに存在するビークルは…はい、戻します」
  it("R-CARD-04: ライドされていないバトルエリアのビークルもスタートフェイズにラッシュエリアへ戻す（出典: atwiki/page-141 Q9/A9）", () => {
    let s = st({ phase: "start", player1: { battle: [inst("SPEC-VEHICLE-S", "v")], deck: deckCards(3) } });
    s = unwrap(applyAction(s, { type: "return_all_battle_to_rush", playerId: "player1" }));
    expect(zoneOf(s, "player1", "SPEC-VEHICLE-S:v")).toBe("rush");
  });

  it.todo(
    "R-CARD-04: 敵軍ターン中にライドオフさせられたユニットはバトルエリアの一番右に置く（出典: atwiki/page-141 Q10/A10）— 敵軍ターン中の強制ライドオフを起こす公開アクションがなく状況を作れない",
  );

  it.todo(
    "R-CARD-04: 敵軍ターン中にライドオフしてバトルエリアに置き直したユニットはラッシュされたことにならない（出典: atwiki/page-141 Q11/A11）— 同上（強制ライドオフの公開アクションがない）",
  );
});

describe("R-SIZE-01 ユニットサイズ", () => {
  // 「S / M / L / XL / SC の5種類」
  it("R-SIZE-01: ユニットのサイズは S/M/L/XL/SC の5種類（出典: atwiki/page-144）", () => {
    const sizes = new Set(realCards.filter((d) => d.type === "unit").map((d) => d.size));
    expect([...sizes].sort()).toEqual(["L", "M", "S", "SC", "XL"]);
  });

  // 「Mユニットを対象にした効果は受けない」
  it("R-SIZE-01: SCユニットはMユニットではない（出典: atwiki/page-1555）", () => {
    expect(isMediumUnit(DEFS, "RS-619")).toBe(false);
    expect(isMediumUnit(DEFS, "SPEC-SC-WB")).toBe(false);
    expect(isMediumUnit(DEFS, "SPEC-M-WB")).toBe(true);
  });

  // 「Mユニットを対象にした効果は受けない」
  it("R-SIZE-01: 稲妻重力エネルギー（Mユニットのバトル進入にホールド要求）はSCユニットに適用されない（出典: atwiki/page-1555）", () => {
    const s = st({
      phase: "battle",
      player1: {
        rush: [inst("SPEC-SC-WB", "sc"), inst("SPEC-M-WB", "m")],
        operation: [inst("RS-069", "lg")],
        command: [],
      },
      player2: { deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "move_to_battle" && a.instanceId === "SPEC-SC-WB:sc")).toBe(true);
    expect(hasLegal(s, (a) => a.type === "move_to_battle" && a.instanceId === "SPEC-M-WB:m")).toBe(false);
  });

  it.todo(
    "R-SIZE-01: SCユニットのカードは「Mユニットのカード」としてサーチできない（出典: atwiki/page-1555）— Mユニットのカードを山札から探す効果を公開アクションで駆動するテスト基盤がない",
  );

  // 「枚数制限ルールはない」（制限はカード効果による）
  it("R-SIZE-01: サイズによる枚数制限はなく、Lユニットが2体いてもさらにLユニットをラッシュできる（出典: atwiki/page-144）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-076", "l3")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c")],
        rush: [inst("RS-076", "l1"), inst("RS-076", "l2")],
      },
    });
    const r = unwrap(payAndRush(s, "player1", "RS-076:l3", ["TST-OP-ET:c"]));
    expect(r.players.player1.rush.filter((c) => c.cardId === "RS-076")).toHaveLength(3);
  });
});

describe("R-SIZE-02 ビークルサイズ", () => {
  // 「S / M / L の3種類」
  it("R-SIZE-02: ビークルのサイズは S/M/L の3種類（出典: atwiki/page-1550）", () => {
    const sizes = new Set(realCards.filter((d) => d.type === "vehicle").map((d) => d.size));
    expect([...sizes].every((sz) => sz === "S" || sz === "M" || sz === "L")).toBe(true);
    expect(sizes.has("S")).toBe(true);
  });

  // 「RC を持つユニットは…サイズに関係なくライドできる」
  it("R-SIZE-02: RCを持つSユニットはLサイズのビークルにもライドできる（出典: atwiki/page-1550）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-RIDER", "r"), inst("SPEC-VEHICLE-L", "v")] },
      player2: { deck: deckCards(3) },
    });
    expect(
      hasLegal(s, (a) => a.type === "mount_ride" && a.riderInstanceId === "SPEC-RIDER:r" && a.vehicleInstanceId === "SPEC-VEHICLE-L:v"),
    ).toBe(true);
  });
});

describe("R-CAT-01 カテゴリ", () => {
  // 「5カテゴリ: WB, ET, OT, MA, DA」
  it("R-CAT-01: カテゴリは WB/ET/OT/MA/DA の5種類のみ（出典: atwiki/page-70）", () => {
    const cats = new Set(realCards.flatMap((d) => cardCategories(d)));
    expect([...cats].sort()).toEqual(["DA", "ET", "MA", "OT", "WB"]);
  });

  // 「基本は1枚1カテゴリ」
  it("R-CAT-01: 基本は1枚1カテゴリ（マルチカテゴリを除き全カードがちょうど1つ）（出典: atwiki/page-70, page-137）", () => {
    const single = realCards.filter((d) => cardCategories(d).length === 1);
    expect(single.length).toBeGreaterThan(realCards.length * 0.95);
    expect(realCards.every((d) => cardCategories(d).length >= 1)).toBe(true);
  });
});

describe("R-CAT-02 マルチカテゴリ", () => {
  // 「全てのカテゴリのコマンドが自軍コマンドゾーンに存在する状態」
  it("R-CAT-02: マルチカテゴリのユニットは、持つ全カテゴリのコマンドがコマンドゾーンにあれば一方をホールドしてラッシュできる（出典: atwiki/page-1559 本文）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("TST-UNIT-WB-ET", "m")], command: [inst("TST-OP", "wb"), inst("TST-OP-ET", "et")] },
    });
    const r = unwrap(payAndRush(s, "player1", "TST-UNIT-WB-ET:m", ["TST-OP:wb"]));
    expect(zoneOf(r, "player1", "TST-UNIT-WB-ET:m")).toBe("rush");
    expect(r.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("R-CAT-02: 持つカテゴリの一方のコマンドしかなければ手札から通常の手順でラッシュできない（出典: atwiki/page-1559 本文）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("TST-UNIT-WB-ET", "m")], command: [inst("TST-OP", "wb1"), inst("TST-OP", "wb2")] },
    });
    expect(
      hasLegal(
        s,
        (a) =>
          (a.type === "rush" && a.instanceId === "TST-UNIT-WB-ET:m") ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === "TST-UNIT-WB-ET:m"),
      ),
    ).toBe(false);
    expect(payAndRush(s, "player1", "TST-UNIT-WB-ET:m", ["TST-OP:wb1"]).ok).toBe(false);
  });

  // 「カード効果などによるラッシュの場合は…参照する必要はありません」
  it("R-CAT-02: 効果（シーロンの光）によるラッシュではマルチカテゴリのユニットでもコマンドゾーンのカテゴリを参照しない（出典: atwiki/page-1559 Q1/A1）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("TST-UNIT-WB-ET", "m")],
        operation: [inst("RS-013", "shiron")],
        power: powerCards(4),
        command: [inst("TST-OP-OT", "ot")],
      },
      player2: { hand: [] },
    });
    const revealed = shironReveal(s, "player1", "RS-013:shiron", "TST-UNIT-WB-ET:m");
    const rush = legal(revealed).find((a) => a.type === "rush" && a.instanceId === "TST-UNIT-WB-ET:m");
    expect(rush).toBeDefined();
    const r = unwrap(applyAction(revealed, rush!));
    expect(zoneOf(r, "player1", "TST-UNIT-WB-ET:m")).toBe("rush");
  });

  // 「持っているどのカテゴリのコマンドとしても使うことが可能」
  it("R-CAT-02: コマンドゾーンのマルチカテゴリカードは、持つどのカテゴリのコマンドとしてもホールドできる（出典: atwiki/page-1559 本文）", () => {
    const base = { phase: "rush" as const };
    const wb = st({ ...base, player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP-WB-ET", "mc")] } });
    expect(payAndRush(wb, "player1", "SPEC-S-WB:u", ["TST-OP-WB-ET:mc"]).ok).toBe(true);
    const et = st({ ...base, player1: { hand: [inst("SPEC-S-ET-3", "u")], power: powerCards(3), command: [inst("TST-OP-WB-ET", "mc")] } });
    expect(payAndRush(et, "player1", "SPEC-S-ET-3:u", ["TST-OP-WB-ET:mc"]).ok).toBe(true);
  });

  // 「敵軍パワー1つ分としてカウントされる」「カテゴリの数に関わらず…1枚につき1」
  it("R-CAT-02: コマンドゾーンのマルチカテゴリカードは1枚につき敵軍パワー1つ分（カテゴリ数に関わらず）（出典: atwiki/page-1559 本文, page-108）", () => {
    const s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { command: [inst("TST-OP-WB-ET", "mc1"), inst("TST-OP-WB-ET", "mc2"), inst("TST-OP", "single")] },
      player2: { power: powerCards(1), hand: [inst("SPEC-S-ET-3", "u")], command: [inst("TST-OP-ET", "et")] },
    });
    expect(countAvailablePower(s, "player2")).toBe(3);
    expect(countAvailablePower(s, "player1")).toBe(0);
    // 自軍パワーゾーン1枚＋敵軍マルチ2枚＝3で必要パワー3のユニットをラッシュできる
    expect(payAndRush(s, "player2", "SPEC-S-ET-3:u", ["TST-OP-ET:et"]).ok).toBe(true);
  });

  it.todo(
    "R-CAT-02: 効果でカテゴリが追加されたコマンドもマルチカテゴリとして扱い敵軍パワーに数える（出典: atwiki/page-1559 本文）— コマンドにカテゴリを追加する状態をエンジンが表現しない",
  );

  it.todo(
    "R-CAT-02: マルチカテゴリのカードは常に全カテゴリを参照し単一カテゴリとして扱えない（マジエル下のSユニット等）（出典: atwiki/page-1559 本文）— 該当カード（天空大聖者マジエル・スーパー戦隊アドレスブック）がカタログに未収録",
  );

  it.todo(
    "R-CAT-02: 通常のラッシュを補助する効果（ライドシューター）やコール・リードでは、コマンドゾーンに必要なカテゴリが揃っていなければ使用できない（出典: atwiki/page-1559 本文）— カタログに実在するマルチカテゴリのカードがなく、コール・リードとの組み合わせを公開アクションで構成できない",
  );
});
