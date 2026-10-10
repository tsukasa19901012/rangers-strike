/**
 * docs/rules/02-zones-cards.md §1 場所（エリア・ゾーン） R-ZONE-01〜12 のルールスペック。
 * 期待値はルールブックと docs/rules/sources/web/ の公式FAQ・atwiki に従う（エンジン現状ではない）。
 */
import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { countAvailablePower } from "../core/power";
import { createGame } from "../core/createGame";
import { moveFromExile, moveToExile } from "../rules/exile";
import { legend1Catalog } from "@rangers-strike/cards";
import {
  cardIn,
  deckCards,
  hasLegal,
  inst,
  legal,
  payAndPlayOperation,
  payAndRush,
  powerCards,
  st,
  unwrap,
  zoneOf,
  zordRush,
  mothershipRush,
} from "./02-helpers";

describe("R-ZONE-01 場所の一覧と総称", () => {
  // 「場の外に山札・手札・捨札・除外がある」（場=BA/RA/PZ/CZ/常駐置き場）
  it("R-ZONE-01: 各プレイヤーは山札・手札・捨札・除外・パワー・コマンド・ラッシュ・バトル・常駐置き場を持つ（出典: atwiki/page-1512, page-591）", () => {
    const deck = legend1Catalog.cards.filter((c) => c.type === "unit").slice(0, 10);
    const game = createGame({ player1Deck: deck, player2Deck: deck, rng: () => 0.5 });
    for (const pid of ["player1", "player2"] as const) {
      const p = game.players[pid];
      for (const zone of ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation", "exile"] as const) {
        expect(Array.isArray(p[zone]), `${pid}.${zone}`).toBe(true);
      }
    }
  });

  // 「パワーゾーンとコマンドゾーンの両方を指した総称です」
  it("R-ZONE-01: 「ゾーン」はパワーゾーンとコマンドゾーン。ゾーンのカードはユニットではなく、エリアのカードのみがユニット（出典: atwiki/page-1517 Q1/A1）", () => {
    // ゾーンにあるユニットカードは「ユニットを選ぶ」効果（RS-024: BP8000以下のユニット）の対象にならない
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: {
        power: [inst("SPEC-S-WB", "inPower")],
        command: [inst("SPEC-S-WB", "inCmd")],
      },
    });
    for (const target of ["SPEC-S-WB:inPower", "SPEC-S-WB:inCmd"]) {
      const r = payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], target);
      if (r.ok) {
        // 使用できたとしても対象のカードは動かない
        expect(zoneOf(r.state, "player2", target)).toBe(target.endsWith("inPower") ? "power" : "command");
      }
    }
  });

  // 「場を離れるとき」…パワーゾーンやコマンドゾーンに移動させられるときも発動
  it("R-ZONE-01: ゾーンも場の一部で、エリアからパワーゾーンへ移動するユニットは「場を離れる」としてダイノガッツを使える（出典: grnrngr/faq-card-1 RS-027 Q5）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: {
        rush: [inst("SPEC-S-WB", "e")],
        hand: [inst("RS-027", "dg")],
        command: [inst("TST-OP", "w")],
        deck: deckCards(5),
      },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-S-WB:e"));
    expect(r.pendingLeave?.instanceId).toBe("SPEC-S-WB:e");
    expect(
      hasLegal(
        r,
        (a) =>
          a.type === "initiate_command_payment" && a.playerId === "player2" && a.sourceInstanceId === "RS-027:dg",
      ),
    ).toBe(true);
  });
});

describe("R-ZONE-02 カードは持ち主の領域から離れない", () => {
  // 「特に指定のない場合は、カードは持ち主のゾーンに送って下さい」
  it("R-ZONE-02: 敵軍ユニットをパワーゾーンに送る効果は持ち主（敵軍）のパワーゾーンに置く（出典: atwiki/page-1517 Q2/A2, page-1872）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: { rush: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    let r = unwrap(payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-S-WB:e"));
    if (r.pendingLeave) r = unwrap(applyAction(r, { type: "pass_leave_reaction", playerId: "player2" }));
    expect(zoneOf(r, "player2", "SPEC-S-WB:e")).toBe("power");
    expect(zoneOf(r, "player1", "SPEC-S-WB:e")).toBeNull();
    expect(r.players.player1.power).toHaveLength(6);
  });

  // 「基本的にカードはそのカードの持ち主の領域を離れることはありません」
  it("R-ZONE-02: 疾風流超忍法で戻されるユニットは持ち主の山札に戻る（出典: atwiki/page-1517 Q2/A2）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP", "c")], deck: deckCards(3) },
      player2: { hand: [inst("RS-026", "ctr")], command: [inst("TST-OP-MA", "m")], power: powerCards(3), deck: deckCards(3, "e") },
    });
    const rushed = unwrap(payAndRush(s, "player1", "SPEC-S-WB:u", ["TST-OP:c"]));
    const r = unwrap(payAndRush(rushed, "player2", "RS-026:ctr", ["TST-OP-MA:m"]));
    expect(zoneOf(r, "player1", "SPEC-S-WB:u")).toBe("deck");
    expect(zoneOf(r, "player2", "SPEC-S-WB:u")).toBeNull();
  });
});

describe("R-ZONE-03 エリアのカードはユニット／ビークル", () => {
  // 「エリアにオモテ向きで置かれたユニットカード…ユニットとして扱う」
  it("R-ZONE-03: ラッシュエリアのユニットは「ユニットを選ぶ」効果の対象になる（出典: atwiki/page-1512）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: { rush: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    const r = payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-S-WB:e");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player2", "SPEC-S-WB:e")).not.toBe("rush");
  });

  // 「ユニットとユニットカードはルール上別のもの」
  it("R-ZONE-03: 手札・パワーゾーン・コマンドゾーンのユニットカードはユニットとして選べない（出典: atwiki/page-137, grnrngr/faq リファレンス）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: {
        hand: [inst("SPEC-S-WB", "h")],
        power: [inst("SPEC-S-WB", "p")],
        command: [inst("SPEC-S-WB", "c")],
        deck: deckCards(3),
      },
    });
    for (const [target, zone] of [
      ["SPEC-S-WB:h", "hand"],
      ["SPEC-S-WB:p", "power"],
      ["SPEC-S-WB:c", "command"],
    ] as const) {
      const r = payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], target);
      if (r.ok) expect(zoneOf(r.state, "player2", target)).toBe(zone);
    }
  });

  // 「ユニットとして扱われていることが条件…ラッシュエリアかバトルエリア」
  it("R-ZONE-03: 「自軍合体ユニットを捨札にする」は手札・パワー・コマンドの合体ユニットのカードでは満たせない（出典: grnrngr/faq/index.html ラッシュ Q2）", () => {
    const partners = ["RS-035", "RS-036", "RS-037", "RS-038", "RS-039"];
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-034", "daiju"), inst(partners[0]!, "h0")],
        power: [...powerCards(8), inst(partners[1]!, "p1"), inst(partners[2]!, "p2")],
        command: [inst("TST-OP", "c"), inst(partners[3]!, "c3"), inst(partners[4]!, "c4")],
      },
    });
    expect(
      hasLegal(
        s,
        (a) =>
          (a.type === "rush" && a.instanceId === "RS-034:daiju") ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-034:daiju") ||
          (a.type === "begin_zord_setup" && a.zordInstanceId === "RS-034:daiju"),
      ),
    ).toBe(false);
  });

  it("R-ZONE-03: 合体ユニット5体がエリアにあれば「自軍合体ユニットを捨札にする」を満たしてラッシュを宣言できる（出典: grnrngr/faq/index.html ラッシュ Q2 の対偶）", () => {
    const partners = ["RS-035", "RS-036", "RS-037", "RS-038", "RS-039"];
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-034", "daiju")],
        power: powerCards(8),
        command: [inst("TST-OP", "c")],
        rush: partners.map((id, i) => inst(id, `r${i}`)),
      },
    });
    expect(
      hasLegal(
        s,
        (a) =>
          (a.type === "rush" && a.instanceId === "RS-034:daiju") ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-034:daiju") ||
          (a.type === "begin_zord_setup" && a.zordInstanceId === "RS-034:daiju"),
      ),
    ).toBe(true);
  });
});

describe("R-ZONE-04 エリア出入りで付加情報は消える", () => {
  // 「エリアとエリア以外の間をカードが移動した場合…すべて消える」
  // 既知の不具合: 未登録 — エリア外（パワーゾーン）へ送られても bpModifier/spModifier/registerHeld が残る
  it.fails("R-ZONE-04: BP修正・ホールド状態を持つユニットがパワーゾーンに送られると付加情報は消える（出典: atwiki/page-1512）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: {
        rush: [{ ...inst("SPEC-RESIST", "e"), bpModifier: 3000, spModifier: 1, commandHeld: true, registerHeld: true }],
        deck: deckCards(3),
      },
    });
    let r = unwrap(payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-RESIST:e"));
    if (r.pendingLeave) r = unwrap(applyAction(r, { type: "pass_leave_reaction", playerId: "player2" }));
    const card = r.players.player2.power.find((c) => c.instanceId === "SPEC-RESIST:e");
    expect(card).toBeDefined();
    expect(card?.bpModifier ?? 0).toBe(0);
    expect(card?.spModifier ?? 0).toBe(0);
    expect(card?.registerHeld ?? false).toBe(false);
    expect(card?.commandHeld ?? false).toBe(false);
  });

  // 「ユニットでなくなった時点で…情報はすべて失われる」
  it("R-ZONE-04: ホールド状態でコマンドゾーンに送られたユニットが再びラッシュされるとリリース状態（出典: grnrngr/faq-rider-2 RK-166 Q4）", () => {
    // ホールド状態のSユニットを追加条件でコマンドゾーンへ送り、ランドバルカンで再ラッシュする
    const heldS = { ...inst("SPEC-RESIST", "s"), commandHeld: true, registerHeld: true };
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo"), inst("RS-005", "lb")],
        power: powerCards(6),
        command: [inst("TST-OP-ET", "c1"), inst("TST-OP-ET", "c2")],
        rush: [heldS],
      },
    });
    const s1 = unwrap(
      zordRush(s0, "player1", "RS-074:cosmo", "TST-OP-ET:c1", {
        zordMaterialInstanceId: heldS.instanceId,
        zordMaterialDestination: "command",
      }),
    );
    const inCmd = s1.players.player1.command.find((c) => c.instanceId === heldS.instanceId);
    expect(inCmd).toBeDefined();
    expect(inCmd?.commandHeld ?? false).toBe(false);
    // ランドバルカン（効果によるラッシュ）でコマンドゾーンから再ラッシュ
    const paid = payAndPlayOperation(s1, "player1", "RS-005:lb", ["TST-OP-ET:c2"]);
    const s2 = paid.ok
      ? paid.state
      : unwrap(applyAction(s1, legal(s1).find((a) => a.type === "play_operation" && a.instanceId === "RS-005:lb")!));
    const back = s2.players.player1.rush.find((c) => c.instanceId === heldS.instanceId);
    expect(back).toBeDefined();
    expect(back?.registerHeld ?? false).toBe(false);
    expect(back?.commandHeld ?? false).toBe(false);
  });

  // 「エリアとエリア以外の間」（BA⇔RA は対象外）
  it("R-ZONE-04: スタートフェイズにバトルエリアからラッシュエリアへ戻ってもホールド状態は消えない（出典: atwiki/page-1512 の限定読み, page-157）", () => {
    const held = { ...inst("SPEC-RESIST", "r"), commandHeld: true, registerHeld: true };
    let s = st({
      phase: "start",
      player1: { battle: [held], deck: deckCards(3), command: [] },
    });
    s = unwrap(applyAction(s, { type: "return_all_battle_to_rush", playerId: "player1" }));
    const back = s.players.player1.rush.find((c) => c.instanceId === held.instanceId);
    expect(back?.registerHeld).toBe(true);
  });
});

describe("R-ZONE-05 ラッシュエリア", () => {
  // 「このエリアに置けるカードの枚数制限は無い」
  it("R-ZONE-05: ラッシュエリアに10体いても手札からさらにラッシュできる（出典: atwiki/page-147）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("SPEC-S-WB", "new")],
        command: [inst("TST-OP", "c")],
        rush: Array.from({ length: 10 }, (_, i) => inst("SPEC-S-WB", `r${i}`)),
      },
    });
    const r = unwrap(payAndRush(s, "player1", "SPEC-S-WB:new", ["TST-OP:c"]));
    expect(r.players.player1.rush).toHaveLength(11);
  });

  // 「このエリアのユニットにアタックしたり…出来ない」
  it("R-ZONE-05: 敵軍ラッシュエリアのユニットにはアタックできない（出典: atwiki/page-147）", () => {
    const s = st({
      phase: "battle",
      player1: { battle: [inst("SPEC-S-WB", "a")] },
      player2: { rush: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "battle" && a.defenderInstanceId === "SPEC-S-WB:e")).toBe(false);
    expect(
      applyAction(s, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: "SPEC-S-WB:a",
        defenderInstanceId: "SPEC-S-WB:e",
      }).ok,
    ).toBe(false);
  });

  // 「ここからアタックやストライクをする事は出来ない」
  it("R-ZONE-05: ラッシュエリアのユニットはアタックもストライクもできない（出典: atwiki/page-147）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-S-WB", "a")] },
      player2: { battle: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    expect(
      hasLegal(
        s,
        (a) =>
          (a.type === "battle" && a.attackerInstanceId === "SPEC-S-WB:a") ||
          (a.type === "strike" && a.instanceId === "SPEC-S-WB:a"),
      ),
    ).toBe(false);
    expect(applyAction(s, { type: "strike", playerId: "player1", instanceId: "SPEC-S-WB:a" }).ok).toBe(false);
  });
});

describe("R-ZONE-06 バトルエリア", () => {
  // 「アタック・ストライクをするにはバトルエリアに出る必要がある」
  it("R-ZONE-06: バトルエリアに出たユニットはアタック・ストライクを選べる（出典: atwiki/page-457）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-S-WB", "a")] },
      player2: { battle: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    const r = unwrap(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-S-WB:a" }));
    expect(hasLegal(r, (a) => a.type === "battle" && a.attackerInstanceId === "SPEC-S-WB:a")).toBe(true);
    expect(hasLegal(r, (a) => a.type === "strike" && a.instanceId === "SPEC-S-WB:a")).toBe(true);
  });

  // 「新しく出たユニットは一番右に置く」
  it("R-ZONE-06: 新しくバトルエリアに出たユニットは一番右（末尾）に置かれる（出典: atwiki/page-457）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-S-WB", "new")], battle: [inst("SPEC-S-WB", "x"), inst("SPEC-S-WB", "y")] },
      player2: { deck: deckCards(3) },
    });
    const r = unwrap(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-S-WB:new" }));
    expect(r.players.player1.battle.map((c) => c.instanceId)).toEqual([
      "SPEC-S-WB:x",
      "SPEC-S-WB:y",
      "SPEC-S-WB:new",
    ]);
  });

  // 「バトルエリアの一番右に置きます」
  it.todo(
    "R-ZONE-06: 敵軍ターン中にライドオフさせられたユニットはバトルエリアの一番右に置く（出典: atwiki/page-141 Q10/A10）— 敵軍ターン中に強制ライドオフさせる汎用の公開アクションがなく、エンジン経由で状況を作れない",
  );

  // 「なにもしない」を選ぶこともできます
  it("R-ZONE-06: バトルエリアに出たユニットはアタックもストライクもせず何もしないことを選べる（出典: grnrngr/faq/index.html バトルエリア Q2）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-S-WB", "a")] },
      player2: { battle: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    const r = unwrap(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-S-WB:a" }));
    const pass = legal(r).find((a) => a.type === "pass_battle_entry");
    expect(pass).toBeDefined();
    const after = unwrap(applyAction(r, pass!));
    expect(zoneOf(after, "player1", "SPEC-S-WB:a")).toBe("battle");
  });

  // 「任意の順番で戻すことができます」
  it.todo(
    "R-ZONE-06: スタートフェイズにバトルエリアの複数ユニットは任意の順番でラッシュエリアに戻せる（出典: grnrngr/faq/index.html バトルエリア Q1）— ラッシュエリアに並び順の概念がなく、戻す順番を選ぶ公開アクションもない（一括移動のみ）",
  );
});

describe("R-ZONE-07 パワーゾーン", () => {
  // 「何枚でも置くことができます」
  it("R-ZONE-07: パワーゾーンに20枚あってもチャージでパワーゾーンに置ける（出典: atwiki/page-109 Q3/A3, grnrngr/faq パワーゾーン）", () => {
    const s = st({
      phase: "charge",
      player1: { hand: [inst("TST-OP", "h")], power: powerCards(20) },
    });
    expect(hasLegal(s, (a) => a.type === "charge_power" && a.instanceId === "TST-OP:h")).toBe(true);
    const r = unwrap(applyAction(s, { type: "charge_power", playerId: "player1", instanceId: "TST-OP:h" }));
    expect(r.players.player1.power).toHaveLength(21);
  });

  // 「裏表やカテゴリに関係なく、1枚につきパワー1つ分」
  it("R-ZONE-07: パワーゾーンのカードはオモテ・ウラ・種類に関係なく1枚につきパワー1（出典: atwiki/page-109 本文）", () => {
    const s = st({
      phase: "rush",
      player1: {
        power: [
          inst("TST-P", "a"),
          { ...inst("TST-P", "b"), faceDown: true },
          inst("SPEC-S-WB", "c"),
          inst("TST-OP-DA", "d"),
        ],
      },
    });
    expect(countAvailablePower(s, "player1")).toBe(4);
  });

  // 「自由に選ぶことができます」
  it("R-ZONE-07: ダメージでウラ返すパワーゾーンのカードは真ん中の1枚でも自由に選べる（出典: atwiki/page-109 Q1/A1, grnrngr/faq パワーゾーン Q1）", () => {
    const power = powerCards(5);
    const s = st({
      phase: "battle",
      activePlayer: "player2",
      player2: { battle: [inst("SPEC-S-WB", "x")], deck: deckCards(3) },
      player1: { power, deck: deckCards(3, "own") },
      pendingDamagePayment: {
        playerId: "player1",
        remainingFlips: 1,
        deckDraws: 0,
        totalDamage: 1,
        selectedFlipIds: [],
        resume: { kind: "none", activePlayer: "player2" },
      },
    });
    const middle = power[2]!.instanceId;
    expect(hasLegal(s, (a) => a.type === "resolve_damage_payment" && a.instanceId === middle)).toBe(true);
    const r = unwrap(applyAction(s, { type: "resolve_damage_payment", playerId: "player1", instanceId: middle }));
    expect(r.players.player1.power.find((c) => c.instanceId === middle)?.faceDown).toBe(true);
    expect(r.players.player1.power.filter((c) => c.faceDown)).toHaveLength(1);
  });

  // 「ウラ向きのカードがダメージ」
  it("R-ZONE-07: パワーゾーンのウラ向きカードの枚数がダメージになる（出典: atwiki/page-109 本文, grnrngr rule_phase1-2）", () => {
    const power = powerCards(3);
    const s = st({
      phase: "battle",
      activePlayer: "player2",
      player1: { power, deck: deckCards(3, "own") },
      pendingDamagePayment: {
        playerId: "player1",
        remainingFlips: 1,
        deckDraws: 0,
        totalDamage: 1,
        selectedFlipIds: [],
        resume: { kind: "none", activePlayer: "player2" },
      },
    });
    const r = unwrap(applyAction(s, { type: "resolve_damage_payment", playerId: "player1", instanceId: power[0]!.instanceId }));
    expect(r.players.player1.power.filter((c) => c.faceDown)).toHaveLength(1);
    expect(r.players.player1.damage).toBe(1);
  });

  // 「ルール上は違反ではありません」
  it.todo(
    "R-ZONE-07: 表裏を保ったままパワーゾーンを並べ替えることはルール上可能（出典: atwiki/page-109 Q2/A2）— マナー事項でゲーム状態に影響せず、エンジンに並べ替え操作がない",
  );

  // 「基本的にだれも見ることはできません」
  it.todo(
    "R-ZONE-07: パワーゾーンのウラ向きカードは持ち主を含め誰も見られない（出典: atwiki/page-109 Q4/A4）— エンジンに視点別の情報秘匿レイヤーがなく、公開APIで表現できない",
  );
});

describe("R-ZONE-08 コマンドゾーン", () => {
  // 「5枚まで置くことができます」
  it("R-ZONE-08: コマンドゾーンが5枚のときチャージでコマンドゾーンに置けない（パワーゾーンには置ける）（出典: atwiki/page-108 Q3/A3, grnrngr rule_phase1-2）", () => {
    const s = st({
      phase: "charge",
      player1: {
        hand: [inst("TST-OP", "h")],
        command: Array.from({ length: 5 }, (_, i) => ({ ...inst("TST-OP", `c${i}`), commandHeld: true })),
      },
    });
    expect(hasLegal(s, (a) => a.type === "charge_command")).toBe(false);
    expect(applyAction(s, { type: "charge_command", playerId: "player1", instanceId: "TST-OP:h" }).ok).toBe(false);
    expect(hasLegal(s, (a) => a.type === "charge_power")).toBe(true);
  });

  // 「ホールド数ではなく枚数の上限」
  it("R-ZONE-08: 上限はホールド数ではなく枚数で、すべてホールド状態の4枚なら5枚目を置ける（出典: atwiki/page-108 本文）", () => {
    const s = st({
      phase: "charge",
      player1: {
        hand: [inst("TST-OP", "h")],
        command: Array.from({ length: 4 }, (_, i) => ({ ...inst("TST-OP", `c${i}`), commandHeld: true })),
      },
    });
    const r = unwrap(applyAction(s, { type: "charge_command", playerId: "player1", instanceId: "TST-OP:h" }));
    expect(r.players.player1.command).toHaveLength(5);
  });

  // 「どんな種類のカードでも置くことができる」
  it("R-ZONE-08: ユニット・ビークル・オペレーションのどのカードでもコマンドゾーンにチャージできる（出典: atwiki/page-151）", () => {
    for (const id of ["SPEC-S-WB", "SPEC-VEHICLE-S", "TST-OP", "RS-013", "RS-027"]) {
      const s = st({ phase: "charge", player1: { hand: [inst(id, "h")] } });
      const r = applyAction(s, { type: "charge_command", playerId: "player1", instanceId: `${id}:h` });
      expect(r.ok, id).toBe(true);
    }
  });

  // 「カードの効果以外で勝手に置きかえたりすることは出来ません」
  it("R-ZONE-08: コマンドゾーンが5枚のとき、1枚を捨札にして置き換える操作はできない（出典: atwiki/page-108 Q2/A2, grnrngr/faq コマンドゾーン Q2）", () => {
    const s = st({
      phase: "charge",
      player1: {
        hand: [inst("TST-OP", "h")],
        command: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `c${i}`)),
      },
    });
    const acts = legal(s);
    expect(acts.some((a) => a.type === "charge_command")).toBe(false);
    // チャージ後もコマンドの枚数・内容は変わらない（コマンドを捨てる手段がない）
    const r = unwrap(applyAction(s, { type: "charge_power", playerId: "player1", instanceId: "TST-OP:h" }));
    expect(r.players.player1.command.map((c) => c.instanceId)).toEqual(s.players.player1.command.map((c) => c.instanceId));
    expect(r.players.player1.discard).toHaveLength(0);
  });

  // 「5枚を越えて置かれるときは、そのカードは捨札になります」
  // 既知の不具合: 未登録 — 5枚超で置かれるカードを捨札にせず invalid_target で手札に残す
  it.fails("R-ZONE-08: コマンドゾーンが5枚のときサイバースライダーで置かれるカードは捨札になる（出典: atwiki/page-108 Q3/A3, grnrngr rule_phase1-2 チャージフェイズ）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-021", "op"), inst("TST-OP", "extra")],
        command: [inst("TST-OP-ET", "et"), ...Array.from({ length: 4 }, (_, i) => ({ ...inst("TST-OP", `c${i}`), commandHeld: true }))],
      },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-021:op", ["TST-OP-ET:et"], "TST-OP:extra"));
    expect(r.players.player1.command).toHaveLength(5);
    expect(zoneOf(r, "player1", "TST-OP:extra")).toBe("discard");
  });

  // 「アタックされたユニットはその場に留まります」
  // 既知の不具合: 未登録 — RK-008 メカニック忍者をアタック時のカウンターとして使用できない（反応窓が開かない）
  it.fails("R-ZONE-08: メカニック忍者でアタックされたユニットを5枚のコマンドゾーンに置けないときはその場に留まり、バトルは通常通り行う（出典: grnrngr/faq-rider-1 RK-008 Q3）", () => {
    const attacked = inst("SPEC-S-WB", "def");
    const s = st({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [inst("SPEC-M-WB", "atk")], deck: deckCards(3) },
      player2: {
        battle: [attacked],
        hand: [inst("RK-008", "ninja")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "et"), ...Array.from({ length: 4 }, (_, i) => ({ ...inst("TST-OP", `c${i}`), commandHeld: true }))],
        deck: deckCards(3, "e"),
      },
    });
    let r = unwrap(
      applyAction(s, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: "SPEC-M-WB:atk",
        defenderInstanceId: attacked.instanceId,
      }),
    );
    expect(r.pendingBattle).toBeDefined();
    const paid = payAndRush(r, "player2", "RK-008:ninja", ["TST-OP-ET:et"]);
    if (!paid.ok) throw new Error(`RK-008 を使用できない: ${paid.error}`);
    r = paid.state;
    // アタックされたユニットはコマンドゾーンに行かない
    expect(r.players.player2.command).toHaveLength(5);
    expect(zoneOf(r, "player2", attacked.instanceId)).not.toBe("command");
    // バトルは行われる（BP4000 対 BP1000 で撃破される）
    for (let i = 0; i < 6 && (r.pendingBattle || r.pendingLeave || r.pendingRegister); i += 1) {
      const pass = legal(r).find((a) => a.type.startsWith("pass_"));
      if (!pass) break;
      r = unwrap(applyAction(r, pass));
    }
    expect(zoneOf(r, "player2", attacked.instanceId)).toBe("discard");
  });

  // 「コマンドゾーンが5枚でもジャガーバルカンの効果を発動できる」
  it("R-ZONE-08: コマンドゾーンが5枚でSユニットを送れないときもジャガーバルカンの代替（ETコマンドのホールド）でMユニットをラッシュできる（出典: grnrngr/faq-card-2 RS-076 Q4）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        power: powerCards(4),
        rush: [inst("RS-076", "jaguar"), inst("SPEC-S-WB", "s")],
        command: [
          inst("TST-OP-ET", "c1"),
          inst("TST-OP-ET", "c2"),
          ...Array.from({ length: 3 }, (_, i) => ({ ...inst("TST-OP", `h${i}`), commandHeld: true })),
        ],
      },
    });
    const r = mothershipRush(s, "player1", "RS-074:cosmo", ["TST-OP-ET:c2", "TST-OP-ET:c1"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", "RS-074:cosmo")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-S-WB:s")).toBe("rush");
    expect(r.state.players.player1.command).toHaveLength(5);
  });

  it.todo(
    "R-ZONE-08: [未確定] 5枚のコマンドゾーンへ場のユニットを送る効果が「捨札」「実行不能で留まる」「発動不可」のどれになるかの一般則（出典: atwiki/page-108 本文, grnrngr/faq-rider-1 RK-008 Q3）",
  );
});

describe("R-ZONE-09 送るときの向き・状態", () => {
  // 「特に指定がなければリリース状態で置きますか？…はい」
  it("R-ZONE-09: ホールド状態のユニットをコマンドゾーンに送るとリリース状態で置く（出典: atwiki/page-108 Q1/A1, grnrngr/faq コマンドゾーン Q1）", () => {
    const heldS = { ...inst("SPEC-RESIST", "s"), commandHeld: true, registerHeld: true };
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c1")],
        rush: [heldS],
      },
    });
    const r = unwrap(
      zordRush(s, "player1", "RS-074:cosmo", "TST-OP-ET:c1", {
        zordMaterialInstanceId: heldS.instanceId,
        zordMaterialDestination: "command",
      }),
    );
    const card = r.players.player1.command.find((c) => c.instanceId === heldS.instanceId);
    expect(card).toBeDefined();
    expect(card?.commandHeld ?? false).toBe(false);
  });

  // 「コマンドゾーンに送るカードはリリース状態で置きますか？…はい」
  it("R-ZONE-09: 追加条件で自軍Sユニットをコマンドゾーンに送るときはリリース状態で置く（出典: grnrngr/faq/index.html ゾードアップ Q2）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c1")],
        rush: [inst("SPEC-S-WB", "s")],
      },
    });
    const r = unwrap(
      zordRush(s, "player1", "RS-074:cosmo", "TST-OP-ET:c1", {
        zordMaterialInstanceId: "SPEC-S-WB:s",
        zordMaterialDestination: "command",
      }),
    );
    const card = r.players.player1.command.find((c) => c.instanceId === "SPEC-S-WB:s");
    expect(card).toBeDefined();
    expect(card?.commandHeld ?? false).toBe(false);
  });

  // 「オモテ向きに置きます」
  it("R-ZONE-09: 圧縮冷凍でパワーゾーンに送られるユニットのカードはオモテ向きに置く（出典: grnrngr/faq-card-1 RS-024）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-024", "op")], power: powerCards(6), command: [inst("TST-OP-OT", "c")] },
      player2: { rush: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    let r = unwrap(payAndPlayOperation(s, "player1", "RS-024:op", ["TST-OP-OT:c"], "SPEC-S-WB:e"));
    if (r.pendingLeave) r = unwrap(applyAction(r, { type: "pass_leave_reaction", playerId: "player2" }));
    const card = r.players.player2.power.find((c) => c.instanceId === "SPEC-S-WB:e");
    expect(card).toBeDefined();
    expect(card?.faceDown ?? false).toBe(false);
  });

  // 「パワーゾーンに送られる場合、指定がなければオモテ向き」
  it("R-ZONE-09: 追加条件で自軍Sユニットをパワーゾーンに送るときはオモテ向きに置く（出典: atwiki/page-1872）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-043", "m")],
        power: powerCards(8),
        command: [inst("TST-OP", "c1"), inst("TST-OP-ET", "c2"), inst("TST-OP-OT", "c3"), inst("TST-OP-MA", "c4"), inst("TST-OP-DA", "c5")],
        rush: [inst("SPEC-S-WB", "s")],
      },
    });
    const cat = (s.definitions["RS-043"]!.category as string) ?? "WB";
    const cmd = s.players.player1.command.find((c) => (s.definitions[c.cardId]!.category as string) === cat)!;
    const r = unwrap(
      zordRush(s, "player1", "RS-043:m", cmd.instanceId, { zordMaterialInstanceId: "SPEC-S-WB:s" }),
    );
    const card = r.players.player1.power.find((c) => c.instanceId === "SPEC-S-WB:s");
    expect(card).toBeDefined();
    expect(card?.faceDown ?? false).toBe(false);
  });

  // 「ウラ向きに置きます」
  it("R-ZONE-09: 疾風流超忍法で山札の上に戻すユニットのカードはウラ向き（出典: grnrngr/faq-card-1 RS-026）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP", "c")], deck: deckCards(3) },
      player2: { hand: [inst("RS-026", "ctr")], command: [inst("TST-OP-MA", "m")], power: powerCards(3), deck: deckCards(3, "e") },
    });
    const rushed = unwrap(payAndRush(s, "player1", "SPEC-S-WB:u", ["TST-OP:c"]));
    const r = unwrap(payAndRush(rushed, "player2", "RS-026:ctr", ["TST-OP-MA:m"]));
    expect(r.players.player1.deck[0]?.instanceId).toBe("SPEC-S-WB:u");
    expect(r.players.player1.deck[0]?.faceDown).toBe(true);
  });
});

describe("R-ZONE-10 捨札", () => {
  // 「すべてオモテ向きにして重ねて置いてください」
  it("R-ZONE-10: 使用したオペレーションはオモテ向きで捨札に置かれる（出典: atwiki/page-1287 Q1/A1, grnrngr/faq 捨札）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP-ET", "c")], discard: [inst("SPEC-S-WB", "d")] },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"], "SPEC-S-WB:d"));
    const card = r.players.player1.discard.find((c) => c.instanceId === "RS-068:op");
    expect(card).toBeDefined();
    expect(card?.faceDown ?? false).toBe(false);
  });

  it.todo(
    "R-ZONE-10: 捨札の重ね順は自由で、尋ねられたら内容を正しく答える（出典: atwiki/page-1287 Q1/A1）— 対人マナー・情報開示の規定でエンジンの状態遷移に現れない",
  );
});

describe("R-ZONE-11 除外", () => {
  // 「捨札とは別に扱い、捨札に対する効果の影響も一切受けない」
  it("R-ZONE-11: 除外されたカードは「自軍捨札からカードを選ぶ」効果の対象にならない（出典: atwiki/page-1970）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-068", "op")],
        power: powerCards(6),
        command: [inst("TST-OP-ET", "c")],
        exile: [inst("SPEC-S-WB", "x")],
      },
    });
    const r = payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"], "SPEC-S-WB:x");
    if (r.ok) expect(zoneOf(r.state, "player1", "SPEC-S-WB:x")).toBe("exile");
  });

  // 「除外は撃破とは異なるので…発動しない」
  it("R-ZONE-11: 除外は撃破ではなく「撃破されたとき」（アバレッドの1点ダメージ）は発動しない（出典: atwiki/page-1970）", () => {
    const s = st({ phase: "rush", player1: { rush: [inst("RS-054", "aba")], power: powerCards(3) } });
    const r = moveToExile(s, "player1", "rush", "RS-054:aba");
    expect(zoneOf(r, "player1", "RS-054:aba")).toBe("exile");
    expect(r.players.player1.damage).toBe(0);
    expect(r.players.player1.power.filter((c) => c.faceDown)).toHaveLength(0);
    expect(r.pendingLeave).toBeUndefined();
  });

  // 「そのゲーム中再びプレイに使うことはできない」
  it("R-ZONE-11: 除外されたカードを参照する合法手は存在しない（出典: atwiki/page-1970 公式コラム引用）", () => {
    const s = st({
      phase: "rush",
      player1: { power: powerCards(5), command: [inst("TST-OP", "c")], exile: [inst("SPEC-S-WB", "x")] },
    });
    expect(JSON.stringify(legal(s))).not.toContain("SPEC-S-WB:x");
  });

  // 「そのゲーム中再びプレイに使うことはできない」
  // 既知の不具合: 04-#34（除外からの復帰を許す関数 moveFromExile が存在する）
  it.fails("R-ZONE-11: 除外ゾーンからカードを手札・ラッシュエリアに戻す操作は成立しない（出典: atwiki/page-1970 公式コラム引用）", () => {
    const s = st({ phase: "rush", player1: { exile: [inst("SPEC-S-WB", "x")] } });
    const toHand = moveFromExile(s, "player1", "SPEC-S-WB:x", "hand");
    expect(zoneOf(toHand, "player1", "SPEC-S-WB:x")).toBe("exile");
    const toRush = moveFromExile(s, "player1", "SPEC-S-WB:x", "rush");
    expect(zoneOf(toRush, "player1", "SPEC-S-WB:x")).toBe("exile");
  });
});

describe("R-ZONE-12 常駐置き場", () => {
  // 「元々あったものを捨札にしてから配置します」
  it("R-ZONE-12: 常駐オペレーションを配置するとき、既にある自分の常駐オペレーションを捨札にしてから配置する（出典: atwiki/page-1296 Q2/A2, grnrngr rule_phase3）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-069", "new")],
        operation: [inst("RS-030", "old")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c")],
      },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-069:new", ["TST-OP-ET:c"]));
    expect(r.players.player1.operation.map((c) => c.instanceId)).toEqual(["RS-069:new"]);
    expect(zoneOf(r, "player1", "RS-030:old")).toBe("discard");
  });

  // 「常駐ではないオペレーションを使用しても…いいえ」
  it("R-ZONE-12: 常駐ではないオペレーションを使用しても配置済みの常駐オペレーションは捨札にならない（出典: atwiki/page-1296 Q2/A2）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-068", "op")],
        operation: [inst("RS-030", "res")],
        power: powerCards(6),
        command: [inst("TST-OP-ET", "c")],
        discard: [inst("SPEC-S-WB", "d")],
      },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"], "SPEC-S-WB:d"));
    expect(zoneOf(r, "player1", "RS-030:res")).toBe("operation");
  });

  // 「同名のカードを…上書きして配置することはできますか？…はい」
  it("R-ZONE-12: 配置済みの常駐オペレーションと同名のカードを上書きして配置できる（出典: atwiki/page-1296 Q1/A1）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-069", "new")],
        operation: [inst("RS-069", "old")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c")],
      },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-069:new", ["TST-OP-ET:c"]));
    expect(r.players.player1.operation.map((c) => c.instanceId)).toEqual(["RS-069:new"]);
    expect(zoneOf(r, "player1", "RS-069:old")).toBe("discard");
    expect(r.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // 「各プレイヤーごとに1枚だけ配置できます」
  it("R-ZONE-12: 常駐の枚数制限はプレイヤーごとで、相手の常駐オペレーションは捨札にならない（出典: atwiki/page-1296 Q2/A2）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-069", "mine")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c")],
      },
      player2: { operation: [inst("RS-030", "theirs")] },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-069:mine", ["TST-OP-ET:c"]));
    expect(zoneOf(r, "player1", "RS-069:mine")).toBe("operation");
    expect(zoneOf(r, "player2", "RS-030:theirs")).toBe("operation");
  });

  // 「いいえ、並べ替えることはできません」
  it.todo(
    "R-ZONE-12: 常駐オペレーションの上に重ねたカードの順番は並べ替えられない（出典: atwiki/page-1296 Q3/A3）— 並べ替えを行う公開アクション自体が存在せず、禁止をテストする対象がない",
  );
});

// 未使用警告回避
void cardIn;
