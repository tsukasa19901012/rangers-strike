/**
 * cardSpec: 英雄の再誕 RS-017〜RS-023
 *
 * 出典（優先順）:
 *  1. docs/rules/08-errata.md / grnrngr faq/card_1.html（公式Q&A）
 *  2. docs/wiki/sources/atwiki/page-N-RS-0NN.md（カードテキスト・atwiki 転載 Q&A）
 *  3. docs/rules/*.md（一般ルール）
 * 期待値は出典に従う。エンジンが違えば it.fails（既知の不具合）として残す。
 * RS-018 は atwiki の Q 番号（Q1〜Q13）を使う（公式 card_1.html の同じ問いは本文で併記）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  act,
  actLegal,
  bpOf,
  canPlayOp,
  canUseCounter,
  cardDef,
  deckCards,
  expectSourceText,
  hasLegal,
  held,
  inst,
  legal,
  legalOfType,
  playOp,
  powerCards,
  released,
  sDef,
  specState,
  zoneIds,
  zoneOf,
} from "./RS1-001-023.helpers";
import type { GameState, PlayerId } from "../types/game";

function enter(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  let n = actLegal(s, (a) => a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === instanceId);
  for (let i = 0; i < 6 && hasLegal(n, (a) => a.type === "pass_battle_entry"); i += 1) {
    n = actLegal(n, (a) => a.type === "pass_battle_entry");
  }
  return n;
}

/** 反応ウィンドウ・ダメージ支払いをパスで流す（register は使わない）。 */
function settle(s: GameState): GameState {
  let n = s;
  for (let i = 0; i < 10; i += 1) {
    const step =
      legal(n).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction" || a.type === "pass_strike_reaction" || a.type === "pass_register") ??
      legal(n).find((a) => a.type === "resolve_damage_payment");
    if (!step) break;
    n = act(n, step);
  }
  return n;
}

// ===========================================================================
describe("RS-017 気力", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）すべての自軍Sユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP＋1000される。";

  function kiState(opts: { active: PlayerId; releasedN: number; heldN?: number; kiCount?: number }) {
    const s1 = inst("CS-S1", "s1");
    const s2 = inst("CS-S1", "s2");
    const m = inst("CS-M", "m");
    const s = specState(["RS-017"], {
      phase: "battle",
      activePlayer: opts.active,
      player1: {
        operation: Array.from({ length: opts.kiCount ?? 1 }, (_, i) => inst("RS-017", `ki${i}`)),
        battle: [s1, m],
        rush: [s2],
        command: [
          ...Array.from({ length: opts.releasedN }, (_, i) => released("TST-OP-MA", `r${i}`)),
          ...Array.from({ length: opts.heldN ?? 0 }, (_, i) => held("TST-OP-MA", `h${i}`)),
        ],
      },
      player2: { battle: [inst("CS-S1", "e")] },
    });
    return { s, s1, s2, m };
  }

  it("RS-017: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-27）", () => {
    expectSourceText("RS-017", TEXT);
    expect(cardDef("RS-017")?.tags).toContain("常駐");
    expect(cardDef("RS-017")?.powerCost).toBe(2);
  });

  it("RS-017: 敵軍ターン中、自軍Sユニットはリリース状態の自軍コマンド1つにつきBP+1000（出典: atwiki/page-27）", () => {
    const { s, s1, s2 } = kiState({ active: "player2", releasedN: 3, heldN: 2 });
    expect(bpOf(s, "player1", s1.instanceId)).toBe(1000 + 3000);
    expect(bpOf(s, "player1", s2.instanceId)).toBe(1000 + 3000);
  });

  it("RS-017: 自軍ターン中は上がらない（出典: atwiki/page-27 「敵軍ターン中」）", () => {
    const { s, s1 } = kiState({ active: "player1", releasedN: 3 });
    expect(bpOf(s, "player1", s1.instanceId)).toBe(1000);
  });

  it("RS-017: Mユニットは上がらない（出典: atwiki/page-27 「すべての自軍Sユニットは」）", () => {
    const { s, m } = kiState({ active: "player2", releasedN: 3 });
    expect(bpOf(s, "player1", m.instanceId)).toBe(4000);
  });

  it("RS-017: 2枚配置すれば効果は重複する（出典: R-CONT-01、atwiki/page-27）", () => {
    const { s, s1 } = kiState({ active: "player2", releasedN: 2, kiCount: 2 });
    expect(bpOf(s, "player1", s1.instanceId)).toBe(1000 + 2 * 2000);
  });
});

// ===========================================================================
describe("RS-018 隠流忍術", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる）自軍ユニットがアタックされたとき発動できる。⇒アタックしてきたユニット以外のユニットをすべての場から１体選んで、かわりにバトルさせる。";
  const RES: CardDefinition = sDef("CS-RESIST", {
    bp: 3000,
    sp: undefined,
    text: "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）",
  });

  type Setup = {
    p1Battle?: ReturnType<typeof inst>[];
    p1Rush?: ReturnType<typeof inst>[];
    p2Battle?: ReturnType<typeof inst>[];
    p2Rush?: ReturnType<typeof inst>[];
    p2Hand?: ReturnType<typeof inst>[];
    p2Command?: ReturnType<typeof inst>[];
    ids?: string[];
  };

  function ninjaState(o: Setup) {
    return specState(["RS-018", "RS-006", "RS-211", "RS-135", "RS-154", "RS-062", "RS-089", "RS-165", "RS-014", ...(o.ids ?? [])], {
      phase: "battle",
      activePlayer: "player1",
      extraDefs: { [RES.id]: RES },
      player1: { battle: o.p1Battle ?? [], rush: o.p1Rush ?? [] },
      player2: {
        battle: o.p2Battle ?? [],
        rush: o.p2Rush ?? [],
        hand: o.p2Hand ?? [inst("RS-018", "n")],
        command: o.p2Command ?? [released("TST-OP-MA", "ma"), released("TST-OP-MA", "ma2")],
        power: powerCards(5, "e"),
      },
    });
  }

  function attack(s: GameState, attacker: string, defender: string): GameState {
    return act(s, { type: "battle", playerId: "player1", attackerInstanceId: attacker, defenderInstanceId: defender });
  }

  function substitutes(s: GameState, counter = "RS-018:n"): string[] {
    return legal(s)
      .filter(
        (a) =>
          (a.type === "initiate_command_payment" && a.sourceInstanceId === counter) ||
          (a.type === "play_counter" && a.instanceId === counter),
      )
      .map((a) => ("substituteInstanceId" in a ? a.substituteInstanceId : undefined))
      .filter((x): x is string => typeof x === "string");
  }

  function useNinja(s: GameState, sub: string, counter = "RS-018:n"): GameState {
    let n = s;
    const pay = legal(n).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === counter && a.substituteInstanceId === sub);
    if (pay) n = act(n, pay);
    const play = legal(n).find((a) => a.type === "play_counter" && a.instanceId === counter && a.substituteInstanceId === sub);
    if (play) n = act(n, play);
    return n;
  }

  it("RS-018: カタログ本文がエラッタ後の正文と一致する（出典: grnrngr/errata RS-018、docs/rules/08-errata.md R-ERR-RS018）", () => {
    // 正:「アタックしてきたユニット以外のユニットをすべての場から１体選んで」
    expectSourceText("RS-018", TEXT);
    expect(cardDef("RS-018")?.tags).toContain("カウンター");
    expect(cardDef("RS-018")?.powerCost).toBe(4);
  });

  it("RS-018: ※カウンター — 自軍ターン中に手札から使用できない（出典: atwiki/page-242 ※カウンター）", () => {
    const op = inst("RS-018", "op");
    const s = specState(["RS-018"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(4), command: [held("TST-OP-MA", "c")] },
    });
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-018: 自軍ユニットがアタックされたとき、選んだ別のユニットがかわりにバトルする（出典: atwiki/page-242）", () => {
    const atk = inst("CS-M", "atk"); // BP4000
    const def = inst("CS-S1", "def");
    const sub = inst("CS-BIG", "sub"); // BP9000
    let s = ninjaState({ p1Battle: [atk], p2Battle: [def, sub] });
    s = attack(s, atk.instanceId, def.instanceId);
    s = settle(useNinja(s, sub.instanceId));
    expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
    expect(zoneOf(s, "player2", sub.instanceId)).toBe("battle");
    expect(zoneOf(s, "player1", atk.instanceId)).toBe("discard");
  });

  it("RS-018: 「すべての場から」— 敵軍のユニットやラッシュエリアのユニットも選べる（出典: grnrngr/errata RS-018 「すべての場から１体選んで」）", () => {
    const atk = inst("CS-M", "atk");
    const ally = inst("CS-S1", "ally");
    const def = inst("CS-S1", "def");
    const myRush = inst("CS-S1", "myRush");
    const s = attack(ninjaState({ p1Battle: [atk, ally], p2Battle: [def], p2Rush: [myRush] }), atk.instanceId, def.instanceId);
    const subs = substitutes(s);
    expect(subs).toContain(ally.instanceId);
    expect(subs).toContain(myRush.instanceId);
  });

  it("RS-018: atwiki Q&A（公式）— アタックしてきたユニットは選べない（出典: atwiki/page-242 Q13、grnrngr/faq-card-1 RS-018）", () => {
    // 「いいえ、できません。このカードはエラッタの対象となります」
    const atk = inst("CS-M", "atk");
    const def = inst("CS-S1", "def");
    const s = attack(ninjaState({ p1Battle: [atk], p2Battle: [def, inst("CS-S1", "x")] }), atk.instanceId, def.instanceId);
    expect(substitutes(s)).not.toContain(atk.instanceId);
  });

  it("RS-018: atwiki Q&A（公式）— 1回のアタックに対してカウンターを2枚以上使用できる（出典: atwiki/page-242 Q1、grnrngr/faq-card-1 RS-018）", () => {
    // 「はい、できます」
    const atk = inst("CS-M", "atk");
    const def = inst("CS-S1", "def");
    const sub = inst("CS-BIG", "sub");
    let s = ninjaState({ p1Battle: [atk], p2Battle: [def, sub], p2Hand: [inst("RS-018", "n"), inst("RS-018", "n2")] });
    s = attack(s, atk.instanceId, def.instanceId);
    s = useNinja(s, sub.instanceId);
    expect(canUseCounter(s, "player2", "RS-018:n2")).toBe(true);
  });

  it("RS-018: atwiki Q&A（公式）— レジストを持つユニットを選んでバトルで撃破されたら、レジストできる（出典: atwiki/page-242 Q2、grnrngr/faq-card-1 RS-018）", () => {
    // 「はい、できます」
    const atk = inst("CS-BIG", "atk");
    const def = inst("CS-S1", "def");
    const r = inst(RES.id, "r");
    let s = ninjaState({ p1Battle: [atk], p2Battle: [def, r] });
    s = attack(s, atk.instanceId, def.instanceId);
    s = useNinja(s, r.instanceId);
    for (let i = 0; i < 6 && !hasLegal(s, (a) => a.type === "use_register"); i += 1) {
      const pass = legal(s).find((a) => a.type.startsWith("pass_") && a.type !== "pass_register");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(hasLegal(s, (a) => a.type === "use_register" && a.playerId === "player2")).toBe(true);
  });

  it.todo(
    "RS-018: atwiki Q&A（公式）— 仮面ライダー裁鬼「音撃斬・閻魔裁き」はアタック宣言→隠流忍術の可否→バトルする数字の宣言の順（出典: atwiki/page-242 Q3、grnrngr/faq-card-1 RS-018）— RK-050 の「バトルする数字の宣言」を公開APIで行う手段が見つからず未検証",
  );

  it("RS-018: atwiki Q&A（公式）— オーブルーが隠流忍術で選ばれたユニットを撃破したら、隠流忍術を使った相手が自分のコマンドをダメージにする（出典: atwiki/page-242 Q4、grnrngr/faq-card-1 RS-018）", () => {
    // 「「RS-018 隠流忍術」を発動した相手が、自分自身のコマンドゾーンからカードを１枚選び…ダメージにして置きます」
    const blue = inst("RS-211", "blue"); // CN3 → 3番目に出して NC を有効にする
    const def = inst("CS-S1", "def");
    const myOther = inst("CS-S1", "myOther"); // player1 自身のユニット（BP1000）を選ばせる
    let s = ninjaState({
      p1Battle: [myOther, inst("CS-S1", "f2")],
      p1Rush: [blue],
      p2Battle: [def],
      p2Hand: [inst("RS-018", "n"), inst("TST-OP", "spare")],
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId });
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player2"; i += 1) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:spare" });
    }
    expect(s.players.player2.damage).toBe(0);
    const cmdBefore = s.players.player2.command.length;
    s = attack(s, blue.instanceId, def.instanceId);
    s = useNinja(s, myOther.instanceId);
    s = settle(s);
    for (let i = 0; i < 4 && s.pendingEffectChoice; i += 1) {
      const pick = legalOfType(s, "resolve_effect_choice")[0];
      if (!pick) break;
      s = act(s, pick);
    }
    expect(zoneOf(s, "player1", myOther.instanceId)).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player2.command.length).toBe(cmdBefore - 1);
    expect(s.players.player1.damage).toBe(0);
  });

  it.todo(
    "RS-018: atwiki Q&A（公式）— バキケロナグルスが隠流忍術で撃破されても、ジョイントコンビネーションしたLユニットの効果は有効のまま（出典: atwiki/page-242 Q5、grnrngr/faq-card-1 RS-018）— ジョイントコンビネーション成立と RS-167 の追加アタック能力を公開APIで組み立て・観測する手段がない（rulesSpec 06 R-RES-07 と同じ理由）",
  );

  it.todo(
    "RS-018: atwiki Q&A（公式）— ジョイントコンビネーションしたユニット（ガオエレファント等）やそのLユニットも選べる（出典: atwiki/page-242 Q6、grnrngr/faq-card-1 RS-018）— ジョイントコンビネーション成立状態を公開APIで組み立てられないため未検証（JC でない通常の場のユニットが選べることは別テストで確認）",
  );

  it.todo(
    "RS-018: atwiki Q&A（公式）— アタックしてきたLユニットとジョイントコンビネーションしているユニットを指定できる（出典: atwiki/page-242 Q7、grnrngr/faq-card-1 RS-018）— 同上（JC 成立状態を構築できない）",
  );

  it("RS-018: atwiki Q&A（公式）— 「航空機」を持たないアタッカーとジェットファルコンをバトルさせられる（出典: atwiki/page-242 Q8、grnrngr/faq-card-1 RS-018）", () => {
    // 「「バトルの対象を変更する」と解釈してください」
    const atk = inst("CS-M", "atk"); // BP4000・航空機なし
    const def = inst("CS-S1", "def");
    const jet = inst("RS-135", "jet"); // BP1000
    let s = ninjaState({ p1Battle: [atk], p2Battle: [def, jet] });
    s = attack(s, atk.instanceId, def.instanceId);
    expect(substitutes(s)).toContain(jet.instanceId);
    s = settle(useNinja(s, jet.instanceId));
    expect(zoneOf(s, "player2", jet.instanceId)).toBe("discard");
    expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
  });

  it("RS-018: atwiki Q&A（公式）— ファイブテクターでストライクをバトルに変えても、隠流忍術は使えない（出典: atwiki/page-242 Q9、grnrngr/faq-card-1 RS-018）", () => {
    // 「アタックされたときを発動条件とする隠流忍術を発動することもできません」
    const striker = inst("CS-S1", "striker");
    const g = inst("CS-S1", "g");
    let s = specState(["RS-014", "RS-018"], {
      phase: "battle",
      player1: { battle: [striker] },
      player2: { operation: [inst("RS-014", "ft")], rush: [g], battle: [inst("CS-BIG", "o")], hand: [inst("RS-018", "n")], command: [released("TST-OP-MA", "ma")], power: powerCards(5, "e") },
    });
    s = act(s, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    s = actLegal(s, (a) => a.type === "five_tech_intercept" && a.interceptInstanceId === g.instanceId);
    expect(canUseCounter(s, "player2", "RS-018:n")).toBe(false);
  });

  it("RS-018: atwiki Q&A（公式）— ガオシャークが自軍ラッシュエリアのSユニットにアタックしたとき、自軍バトルエリアのSユニットをかわりにバトルさせられる（出典: atwiki/page-242 Q10、grnrngr/faq-card-1 RS-018）", () => {
    const shark = inst("RS-154", "shark"); // ※敵軍ラッシュエリアのSユニットにアタックできる
    const rushS = inst("CS-S1", "rushS");
    const battleS = inst("CS-S2", "battleS");
    let s = ninjaState({ p1Battle: [shark], p2Rush: [rushS], p2Battle: [battleS] });
    s = attack(s, shark.instanceId, rushS.instanceId);
    expect(substitutes(s)).toContain(battleS.instanceId);
  });

  it("RS-018: atwiki Q&A（公式）— 変わるのはバトルの対象のみ。メカにアタックしたボウケンレッドのBP+4000は残る（出典: atwiki/page-242 Q11、grnrngr/faq-card-1 RS-018）", () => {
    // 「「隠流忍術」で変更されるのはバトルの対象のみです」
    const fillers = Array.from({ length: 4 }, (_, i) => inst("CS-S1", `f${i}`));
    const red = inst("RS-062", "red"); // CN5【ボウケンジャベリン】
    const rescue = inst("RS-089", "rescue"); // メカ
    const rouki = inst("RS-165", "rouki");
    let s = ninjaState({ p1Battle: fillers, p1Rush: [red], p2Battle: [rescue, rouki], ids: ["RS-165"] });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: red.instanceId });
    s = attack(s, red.instanceId, rescue.instanceId);
    s = settle(useNinja(s, rouki.instanceId));
    expect(zoneOf(s, "player2", rouki.instanceId)).toBe("discard");
    expect(zoneOf(s, "player1", red.instanceId)).toBe("battle");
  });

  it.todo(
    "RS-018: atwiki Q&A（公式）— 守護獣プテラノドンとレスキューファイターの相撃ちでは、ターンプレイヤーが処理順を選べる（出典: atwiki/page-242 Q12、grnrngr/faq-card-1 RS-018）— 一般ルール側の既知の不一致として rulesSpec 05 R-BTL-02／06 R-PRI-02 が it.fails で扱っている（同時撃破の処理順選択が未実装）。隠流忍術固有の不具合ではないためここでは重複させない",
  );
});

/** RS-019 超力: アタック時に開くホールド数の選択で n を選ぶ。 */
function holdForSuperPower(s: GameState, n: number): GameState {
  expect(s.pendingEffectChoice?.effectId).toBe("attack_hold_bonus");
  return act(s, { type: "resolve_effect_choice", playerId: s.pendingEffectChoice!.playerId, instanceId: String(n) });
}

// ===========================================================================
describe("RS-019 超力", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自軍Sユニットがアタックするとき発動できる。アタックするユニットは、自軍コマンドを1つホールドするごとにBP+1000される。";

  function powState(attacker: ReturnType<typeof inst>, opts: { releasedN: number; heldN: number; defBp: number }) {
    const def = { ...inst("CS-S1", "def"), bpModifier: opts.defBp - 1000 };
    const s = specState(["RS-019"], {
      phase: "battle",
      activePlayer: "player1",
      player1: {
        operation: [inst("RS-019", "ch")],
        battle: [attacker],
        command: [
          ...Array.from({ length: opts.releasedN }, (_, i) => released("TST-OP-MA", `r${i}`)),
          ...Array.from({ length: opts.heldN }, (_, i) => held("TST-OP-MA", `h${i}`)),
        ],
      },
      player2: { battle: [def] },
    });
    return { s, def };
  }

  it("RS-019: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-243）", () => {
    expectSourceText("RS-019", TEXT);
    expect(cardDef("RS-019")?.tags).toContain("常駐");
    expect(cardDef("RS-019")?.powerCost).toBe(5);
  });

  it("RS-019: アタックするとき自軍コマンドを2つホールドすれば、そのSユニットはBP+2000でバトルする（出典: atwiki/page-243）", () => {
    const atk = inst("CS-S1", "atk");
    const { s: s0, def } = powState(atk, { releasedN: 2, heldN: 0, defBp: 2500 });
    let s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: def.instanceId });
    s = holdForSuperPower(s, 2);
    s = settle(s);
    expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  describe("アタックのたびにホールドする数を選ぶ（0〜リリース状態のコマンド数）（出典: atwiki/page-243「自軍コマンドを1つホールドするごとに」）", () => {
    function attackWith3Released(defBp: number) {
      const atk = inst("CS-S1", "atk");
      const { s: s0, def } = powState(atk, { releasedN: 3, heldN: 1, defBp });
      const s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: def.instanceId });
      return { s, atk, def };
    }

    it("RS-019: アタックすると、アタックしたプレイヤーにホールド数（0〜3）の選択が開き、選ぶまでバトルしない", () => {
      const { s, def } = attackWith3Released(2500);
      expect(s.pendingEffectChoice?.effectId).toBe("attack_hold_bonus");
      expect(s.pendingEffectChoice?.playerId).toBe("player1");
      expect(legalOfType(s, "resolve_effect_choice").map((a) => a.instanceId)).toEqual(["0", "1", "2", "3"]);
      expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
      expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
    });

    it("RS-019: 0 を選ぶとホールドせず BP も上がらない（BP1000 vs 2500 で負ける）", () => {
      const { s: s0, atk, def } = attackWith3Released(2500);
      const s = settle(holdForSuperPower(s0, 0));
      expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
      expect(zoneOf(s, "player1", atk.instanceId)).toBe("discard");
      expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
    });

    it("RS-019: 1 を選ぶと 1 つだけホールドし BP+1000（BP2000 vs 2500 で負ける）", () => {
      const { s: s0, atk, def } = attackWith3Released(2500);
      const s = settle(holdForSuperPower(s0, 1));
      expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
      expect(zoneOf(s, "player1", atk.instanceId)).toBe("discard");
      expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
    });

    it("RS-019: 1 を選べば BP2000 で BP1500 に勝ち、残り 2 つはリリース状態のまま", () => {
      const { s: s0, atk, def } = attackWith3Released(1500);
      const s = settle(holdForSuperPower(s0, 1));
      expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
      expect(zoneOf(s, "player1", atk.instanceId)).toBe("battle");
      expect(s.players.player1.command.filter((c) => !c.commandHeld)).toHaveLength(2);
    });

    it("RS-019: すべて（3）を選ぶと 3 つホールドし BP+3000（BP4000 vs 3500 で勝つ）", () => {
      const { s: s0, atk, def } = attackWith3Released(3500);
      const s = settle(holdForSuperPower(s0, 3));
      expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
      expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
      expect(zoneOf(s, "player1", atk.instanceId)).toBe("battle");
      expect(bpOf(s, "player1", atk.instanceId)).toBe(1000);
    });

    it("RS-019: 次のアタックでもあらためて選ぶ（リリース状態の残りの数まで）", () => {
      const atk1 = inst("CS-S1", "a1");
      const atk2 = inst("CS-S1", "a2");
      const d1 = { ...inst("CS-S1", "d1"), bpModifier: 500 };
      const d2 = { ...inst("CS-S1", "d2"), bpModifier: 500 };
      let s = specState(["RS-019"], {
        phase: "battle",
        activePlayer: "player1",
        player1: {
          operation: [inst("RS-019", "ch")],
          battle: [atk1, atk2],
          command: Array.from({ length: 3 }, (_, i) => released("TST-OP-MA", `r${i}`)),
        },
        player2: { battle: [d1, d2] },
      });
      s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: atk1.instanceId, defenderInstanceId: d1.instanceId });
      s = settle(holdForSuperPower(s, 1));
      expect(zoneOf(s, "player2", d1.instanceId)).toBe("discard");
      s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: atk2.instanceId, defenderInstanceId: d2.instanceId });
      expect(legalOfType(s, "resolve_effect_choice").map((a) => a.instanceId)).toEqual(["0", "1", "2"]);
      s = settle(holdForSuperPower(s, 2));
      expect(zoneOf(s, "player2", d2.instanceId)).toBe("discard");
      expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    });
  });

  it("RS-019: アタック時に新たにホールドしなければ上がらない（他の目的で既にホールドしたコマンドは数えない）（出典: atwiki/page-243 「ホールドするごとに」）", () => {
    const atk = inst("CS-S1", "atk");
    const { s: s0, def } = powState(atk, { releasedN: 0, heldN: 2, defBp: 2500 });
    let s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: def.instanceId });
    s = settle(s);
    expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
    expect(zoneOf(s, "player1", atk.instanceId)).toBe("discard");
  });

  it("RS-019: Mユニットのアタックでは上がらない（出典: atwiki/page-243 「自軍Sユニットがアタックするとき」）", () => {
    const atk = inst("CS-M", "atk"); // BP4000
    const { s: s0, def } = powState(atk, { releasedN: 2, heldN: 2, defBp: 5000 });
    let s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: def.instanceId });
    s = settle(s);
    expect(zoneOf(s, "player1", atk.instanceId)).toBe("discard");
    expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
  });

  it("RS-019: 公式Q&A — 上昇はアタックしてバトルが終了するまで（出典: grnrngr/faq-card-1 RS-019）", () => {
    // 「「アタックしてバトルが終了するまで」を期限とする」
    const atk = inst("CS-S1", "atk");
    const { s: s0, def } = powState(atk, { releasedN: 0, heldN: 2, defBp: 500 });
    let s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: def.instanceId });
    s = settle(s);
    expect(zoneOf(s, "player1", atk.instanceId)).toBe("battle");
    expect(bpOf(s, "player1", atk.instanceId)).toBe(1000);
  });
});

// ===========================================================================
describe("RS-020 クルマジックパワー", () => {
  const TEXT = "このカードを自軍パワーゾーンに置く。";

  it("RS-020: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-277）", () => {
    expectSourceText("RS-020", TEXT);
    expect(cardDef("RS-020")?.powerCost).toBe(0);
    expect(cardDef("RS-020")?.category).toBe("OT");
  });

  it("RS-020: 必要パワー0で使え、このカード自身が自軍パワーゾーンに（ダメージではなく表向きで）置かれる（出典: atwiki/page-277）", () => {
    const op = inst("RS-020", "op");
    let s = specState(["RS-020"], {
      phase: "rush",
      player1: { hand: [op], power: [], command: [held("TST-OP-OT", "c")] },
    });
    s = playOp(s, op.instanceId);
    const placed = s.players.player1.power.find((c) => c.instanceId === op.instanceId);
    expect(placed).toBeDefined();
    expect(placed?.faceDown).toBeFalsy();
    expect(zoneOf(s, "player1", op.instanceId)).toBe("power");
  });

  it("RS-020: 置いたカードはパワーとして数えられる（必要パワー1のカードが使えるようになる）（出典: atwiki/page-277、R-PWR 系）", () => {
    const op = inst("RS-020", "op");
    const brain = inst("RS-008", "brain"); // 必要パワー1
    let s = specState(["RS-020", "RS-008"], {
      phase: "rush",
      player1: { hand: [op, brain], power: [], command: [held("TST-OP-OT", "c"), held("TST-OP-OT", "c2")] },
    });
    expect(canPlayOp(s, brain.instanceId)).toBe(false);
    s = playOp(s, op.instanceId);
    expect(canPlayOp(s, brain.instanceId)).toBe(true);
  });
});

// ===========================================================================
describe("RS-021 サイバースライダー", () => {
  const TEXT =
    "自分の手札からカードを2枚まで選んで、自軍コマンドゾーンにホールド状態で置く。（コマンドゾーンに置けるカードは通常5枚まで）";

  function sliderState(handExtra: ReturnType<typeof inst>[], commandN = 0) {
    const op = inst("RS-021", "op");
    const s = specState(["RS-021"], {
      phase: "rush",
      player1: {
        hand: [op, ...handExtra],
        command: [held("TST-OP-ET", "c"), ...Array.from({ length: commandN }, (_, i) => held("TST-OP", `x${i}`))],
      },
    });
    return { s, op };
  }

  it("RS-021: カタログ本文が atwiki 本文と一致する（注釈「（コマンドゾーンに置けるカードは通常5枚まで）」を含む）（出典: atwiki/page-257）", () => {
    expectSourceText("RS-021", TEXT);
  });

  it("RS-021: 手札の2枚をコマンドゾーンにホールド状態で置く（出典: atwiki/page-257）", () => {
    const a = inst("CS-S1", "a");
    const b = inst("TST-OP", "b");
    const { s: s0, op } = sliderState([a, b]);
    const s = playOp(s0, op.instanceId, { targetInstanceId: a.instanceId, extraInstanceId: b.instanceId });
    for (const id of [a.instanceId, b.instanceId]) {
      expect(s.players.player1.command.find((c) => c.instanceId === id)?.commandHeld).toBe(true);
    }
  });

  it("RS-021: 1枚だけ選ぶこともできる（出典: atwiki/page-257 「2枚まで」）", () => {
    const a = inst("CS-S1", "a");
    const b = inst("TST-OP", "b");
    const { s: s0, op } = sliderState([a, b]);
    const s = actLegal(s0, (x) => x.type === "play_operation" && x.instanceId === op.instanceId && x.targetInstanceId === a.instanceId && x.extraInstanceId === undefined);
    expect(zoneOf(s, "player1", a.instanceId)).toBe("command");
    expect(zoneOf(s, "player1", b.instanceId)).toBe("hand");
  });

  it("RS-021: 3枚以上は置けない（出典: atwiki/page-257 「2枚まで」）", () => {
    const hand = [inst("CS-S1", "a"), inst("TST-OP", "b"), inst("TST-OP", "c")];
    const { s } = sliderState(hand);
    for (const a of legalOfType(s, "play_operation")) {
      const n = [a.targetInstanceId, a.extraInstanceId].filter(Boolean).length;
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("RS-021: コマンドゾーンが5枚なら置けないカードは捨札になる（出典: atwiki/page-257 注釈、R-ZONE-08）", () => {
    const a = inst("CS-S1", "a");
    const b = inst("TST-OP", "b");
    const { s: s0, op } = sliderState([a, b], 3); // 既に4枚
    const s = playOp(s0, op.instanceId, { targetInstanceId: a.instanceId, extraInstanceId: b.instanceId });
    expect(s.players.player1.command).toHaveLength(5);
    expect(zoneOf(s, "player1", a.instanceId)).toBe("command");
    expect(zoneOf(s, "player1", b.instanceId)).toBe("discard");
  });

  it("RS-021: 手札がこのカードだけでも（0枚選んで）使用できる（出典: atwiki/page-257 「2枚まで」、R-CARD-03）", () => {
    const { s, op } = sliderState([]);
    expect(canPlayOp(s, op.instanceId)).toBe(true);
  });
});

// ===========================================================================
describe("RS-022 アースの力", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）すべてのユニットは可能なら毎ターンバトルエリアに出る。ただし、自分のスタートフェイズに自軍パワーゾーンからダメージ以外のカードを3枚捨札にしなければ、これを捨札にする。";

  it("RS-022: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-55）", () => {
    expectSourceText("RS-022", TEXT);
  });

  it("RS-022: ※常駐 — 使用すると常駐置き場に配置される（出典: atwiki/page-55 ※常駐）", () => {
    const op = inst("RS-022", "op");
    let s = specState(["RS-022"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(6), command: [held("TST-OP", "c")] },
    });
    s = playOp(s, op.instanceId);
    expect(zoneOf(s, "player1", op.instanceId)).toBe("operation");
  });

  it("RS-022: 出られるユニットがラッシュエリアにある間はバトルフェイズを終えられない（出典: atwiki/page-55 「可能なら毎ターンバトルエリアに出る」）", () => {
    const u = inst("CS-S1", "u");
    let s = specState(["RS-022"], {
      phase: "battle",
      player1: { operation: [inst("RS-022", "ef")], rush: [u] },
    });
    expect(hasLegal(s, (a) => a.type === "end_phase")).toBe(false);
    s = enter(s, u.instanceId);
    expect(hasLegal(s, (a) => a.type === "end_phase")).toBe(true);
  });

  it("RS-022: 「すべてのユニット」— 相手のアースの力でも自軍ユニットは出なければならない（出典: atwiki/page-55 「すべてのユニットは」）", () => {
    const u = inst("CS-S1", "u");
    const s = specState(["RS-022"], {
      phase: "battle",
      player1: { rush: [u] },
      player2: { operation: [inst("RS-022", "ef")] },
    });
    expect(hasLegal(s, (a) => a.type === "end_phase")).toBe(false);
  });

  it("RS-022: 公式Q&A — 「ホールドしなければ出られない」ユニットも、ホールドできるなら出さなければならない（出典: grnrngr/faq-card-1 RS-022 Q1）", () => {
    // 「「コマンドをホールドすればバトルエリアに出られる」ので「バトルエリアに出さなければならない」」
    const t = inst("RS-035", "tyr");
    const s = specState(["RS-022", "RS-035"], {
      phase: "battle",
      player1: { operation: [inst("RS-022", "ef")], rush: [t], command: [released("TST-OP", "c")] },
    });
    expect(hasLegal(s, (a) => a.type === "end_phase")).toBe(false);
  });

  it("RS-022: 公式Q&A — ホールドできるコマンドが無ければ出なくてよい（出典: grnrngr/faq-card-1 RS-022 Q2）", () => {
    // 「「ホールドできるコマンドが無いのでバトルエリアに出られない」と判断します」
    const t = inst("RS-036", "mam");
    const s = specState(["RS-022", "RS-036"], {
      phase: "battle",
      player1: { operation: [inst("RS-022", "ef")], rush: [t], command: [held("TST-OP", "c")] },
    });
    expect(hasLegal(s, (a) => a.type === "end_phase")).toBe(true);
  });

  function startWithEarth(powerFaceUp: number, damageCards: number) {
    return specState(["RS-022"], {
      phase: "start",
      player1: {
        operation: [inst("RS-022", "ef")],
        power: [
          ...powerCards(powerFaceUp),
          ...Array.from({ length: damageCards }, (_, i) => ({ ...inst("TST-P", `dmg${i}`), faceDown: true })),
        ],
        damage: damageCards,
        deck: deckCards(5),
        hand: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `h${i}`)),
      },
    });
  }

  it("RS-022: 自分のスタートフェイズにダメージ以外のパワー3枚を捨札にすれば残る（出典: atwiki/page-55 「ただし、自分のスタートフェイズに…」）", () => {
    let s = startWithEarth(4, 0);
    s = act(s, { type: "draw", playerId: "player1" });
    expect(s.pendingEffectChoice?.effectId).toBe("earth_force");
    for (let i = 0; i < 3; i += 1) {
      const pick = legalOfType(s, "resolve_effect_choice")[0];
      if (!pick) break;
      s = act(s, pick);
    }
    if (s.pendingEffectChoice && hasLegal(s, (a) => a.type === "confirm_effect_choice")) s = actLegal(s, (a) => a.type === "confirm_effect_choice");
    expect(zoneOf(s, "player1", "RS-022:ef")).toBe("operation");
    expect(s.players.player1.power).toHaveLength(1);
  });

  it("RS-022: 捨札にしない（できない）ならアースの力を捨札にする — ダメージのカードは数えない（出典: atwiki/page-55 「ダメージ以外のカードを3枚」）", () => {
    let s = startWithEarth(2, 3);
    s = act(s, { type: "draw", playerId: "player1" });
    for (let i = 0; i < 6 && s.phase === "start"; i += 1) {
      const step = legal(s).find((a) => a.type === "skip_bonus_draw" || a.type === "release_start_commands" || a.type === "end_phase" || a.type === "skip_effect_choice");
      if (!step) break;
      s = act(s, step);
    }
    expect(zoneOf(s, "player1", "RS-022:ef")).toBe("discard");
    expect(s.players.player1.power).toHaveLength(5);
  });

  it("RS-022: 払えるときでも、払わずにアースの力を捨札にすることを選べる（出典: atwiki/page-55 「…しなければ、これを捨札にする」）", () => {
    let s = startWithEarth(4, 0);
    s = act(s, { type: "draw", playerId: "player1" });
    expect(hasLegal(s, (a) => a.type === "skip_effect_choice")).toBe(true);
    s = actLegal(s, (a) => a.type === "skip_effect_choice");
    expect(zoneOf(s, "player1", "RS-022:ef")).toBe("discard");
    expect(s.players.player1.power).toHaveLength(4);
  });
});

// ===========================================================================
describe("RS-023 スーパーレスキュー", () => {
  const TEXT = "自軍捨札から、Sユニットのカードを1枚選んで手札に加える。";

  function rescueState(discard: ReturnType<typeof inst>[]) {
    const op = inst("RS-023", "op");
    const s = specState(["RS-023"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(3), command: [held("TST-OP-ET", "c")], discard },
    });
    return { s, op };
  }

  it("RS-023: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-258）", () => {
    expectSourceText("RS-023", TEXT);
  });

  it("RS-023: 必要パワー3 — パワー2では使用できない（出典: atwiki/page-258 必要パワー：3）", () => {
    const { s: s0, op } = rescueState([inst("CS-S1", "a")]);
    const s: GameState = { ...s0, players: { ...s0.players, player1: { ...s0.players.player1, power: powerCards(2) } } };
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-023: 自軍捨札のSユニットのカードを1枚手札に加える（出典: atwiki/page-258）", () => {
    const a = inst("CS-S1", "a");
    const b = inst("CS-S1", "b");
    const { s: s0, op } = rescueState([a, b]);
    let s = playOp(s0, op.instanceId, legalOfType(s0, "play_operation").some((x) => x.instanceId === op.instanceId && x.targetInstanceId === a.instanceId) ? { targetInstanceId: a.instanceId } : {});
    if (s.pendingEffectChoice) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: a.instanceId });
    expect(zoneOf(s, "player1", a.instanceId)).toBe("hand");
    expect(zoneOf(s, "player1", b.instanceId)).toBe("discard");
  });

  it("RS-023: Mユニットやオペレーションのカードは選べない（出典: atwiki/page-258 「Sユニットのカード」）", () => {
    const m = inst("CS-M", "m");
    const o = inst("TST-OP", "o");
    const { s: s0, op } = rescueState([m, o]);
    const direct = legalOfType(s0, "play_operation").filter((x) => x.instanceId === op.instanceId).map((x) => x.targetInstanceId);
    expect(direct).not.toContain(m.instanceId);
    expect(direct).not.toContain(o.instanceId);
    let s = playOp(s0, op.instanceId);
    if (s.pendingEffectChoice) {
      const picks = legalOfType(s, "resolve_effect_choice").map((x) => x.instanceId);
      expect(picks).not.toContain(m.instanceId);
      expect(picks).not.toContain(o.instanceId);
    }
    expect(zoneOf(s, "player1", m.instanceId)).toBe("discard");
  });

  it.todo(
    "RS-023: 公式FAQ card_1.html の「● RS-023」見出しの問いは「RS-023 守護獣トリケラトプス」に関するもの（RS-234 アバレキラーとの SP1 判定）で、カード名がスーパーレスキューと一致しない — 出典の誤記の疑い。本カードの Q&A として検証しない（出典: grnrngr/faq-card-1 RS-023）",
  );
});

// zoneIds / deckCards は将来の拡張用に import を残す
void zoneIds;
void deckCards;
