import { describe, expect, it } from "vitest";
import { rematchEffectPrimitives } from "@rangers-strike/cards/pipeline/extractEffects";
import { isHashGrantKeywordStub, isCatchallGrantKeyword } from "./dsl/hashGrantKeywordStub";
import { applyGrantKeyword } from "./dsl/grantKeyword";
import { getBattleDestroyToPowerInstanceIds } from "./rules/turnModifierBridge";
import { createTestState, inst } from "./testing/fixtures";
import { legendDefinitions } from "./testing/battleEntry";

describe("RS-182 Giant Roller", () => {
  it("rematches to choose + battle_destroy_to_power without hash stub", () => {
    const text =
      "自軍Sユニットを1体選ぶ。このターン、選んだユニットとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く。";
    const rematched = rematchEffectPrimitives(text, {
      name: "ジャイアントローラー",
      kind: "named",
      trigger: { type: "operation", timing: "rush" },
    });
    expect(rematched).not.toBeNull();
    expect(
      rematched!.some(
        (p) => p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword),
      ),
    ).toBe(false);
    expect(rematched!.some((p) => p.type === "choose")).toBe(true);
  });

  it("marks chosen unit for battle destroy to power", () => {
    const ally = inst("RS-054", "ally");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: legendDefinitions,
      player1: { battle: [ally] },
    });
    const result = applyGrantKeyword(state, {
      playerId: "player1",
      phasePlayerId: "player1",
      sourceCardId: "RS-182",
      effectId: "jaiantorora",
      triggerSourceInstanceId: ally.instanceId,
    }, "battle_destroy_to_power");
    expect(getBattleDestroyToPowerInstanceIds(result.state.players.player1)).toContain(
      ally.instanceId,
    );
    expect(result.detail).toBe("battle_destroy_to_power");
  });
});

describe("RS hash stub batch01 patterns", () => {
  const cases: Array<{ id: string; text: string; expectKeyword?: string }> = [
    {
      id: "RS-183",
      text: "この効果は、自分が行ったあとで相手も行う⇒3枚までドローする。そして、以下の手順を3回行う。自分の手札を相手に見せずに1枚選ばせ、選ばれたカードを自軍山札の上に戻す。ただし、自軍コマンドを1つホールドすれば戻さなくてもよい。",
      expectKeyword: "alternating_draw_3_mill",
    },
    {
      id: "RS-185",
      text: "相手の手札を見て、カウンターのオペレーションカードがあれば1枚選び、持ち主のパワーゾーンにダメージにして置く。",
      expectKeyword: "opponent_hand_counter_to_power",
    },
    {
      id: "RS-186",
      text: "自軍山札を見て、Sユニット以外の特徴「メカ」を持つユニットのカードを5枚まで選び、相手に見せる。その後、山札をシャッフルし、選んだカードを好きな順で山札の上に戻す。",
      expectKeyword: "deck_search_feature_top_meka_5_non_s",
    },
    {
      id: "RS-198",
      text: "これが自軍エリアにある間、すべての敵軍Sユニットは、毎ターン、可能ならバトルエリアに出る。",
      expectKeyword: "all_enemy_s_auto_battle_entry",
    },
    {
      id: "RS-245",
      text: "敵軍Sユニットを1体選び撃破する。",
    },
  ];

  it.each(cases)("$id rematches without hash stub", ({ text, expectKeyword }) => {
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "operation", timing: "rush" },
    });
    expect(rematched).not.toBeNull();
    expect(
      rematched!.some(
        (p) => p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword),
      ),
    ).toBe(false);
    if (expectKeyword) {
      expect(rematched!.some((p) => p.type === "grant_keyword" && p.keyword === expectKeyword)).toBe(
        true,
      );
    }
  });
});

describe("RS hash stub batch02 patterns", () => {
  const cases: Array<{ id: string; text: string; expectKeyword?: string }> = [
    {
      id: "RS-224",
      text: "このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒「SP+1」",
      expectKeyword: "combo_l_category_sp1",
    },
    {
      id: "RS-225",
      text: "このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる。",
      expectKeyword: "combo_l_category_attack_rush",
    },
    {
      id: "RS-254",
      text: "このターン、すべての自軍ユニットのコンビネーションナンバーは1少なくなる。ただし、2より少なくならない。",
      expectKeyword: "combo_number_delta_minus_1",
    },
    {
      id: "RS-243",
      text: "このターン、すべての自軍ユニットは、「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれていても、そのテキストは無効になる。",
      expectKeyword: "ignore_rule_hold_command_entry",
    },
    {
      id: "RS-232",
      text: "これがアタックするとき、これはBP+1000され、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。",
    },
  ];

  it.each(cases)("$id rematches without hash stub", ({ text, expectKeyword }) => {
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "on_attack" },
    });
    expect(rematched).not.toBeNull();
    expect(
      rematched!.some(
        (p) => p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword),
      ),
    ).toBe(false);
    if (expectKeyword) {
      expect(rematched!.some((p) => p.type === "grant_keyword" && p.keyword === expectKeyword)).toBe(
        true,
      );
    }
  });
});

describe("RS-254 combo number delta", () => {
  it("applies combo_number_delta_minus_1", () => {
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: legendDefinitions,
    });
    const result = applyGrantKeyword(state, {
      playerId: "player1",
      phasePlayerId: "player1",
      sourceCardId: "RS-254",
      effectId: "bird_nick_wave",
    }, "combo_number_delta_minus_1");
    expect(result.detail).toBe("combo_number_delta_minus_1");
  });
});

describe("RS semantic catchall keywords (batch03)", () => {
  it("uses semantic slug instead of hex hash for generic catchalls", () => {
    const text =
      "これが自軍エリアにある間、BP8000以下のユニットは次の制限を受ける⇒ラッシュしたターンにストライクもアタックもできない。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "while_in_field" },
    });
    const kw = rematched!.find((p) => p.type === "grant_keyword");
    expect(kw?.type).toBe("grant_keyword");
    expect(isHashGrantKeywordStub(kw!.keyword)).toBe(false);
    expect(isCatchallGrantKeyword(kw!.keyword)).toBe(true);
    expect(kw!.keyword).toMatch(/^while_in_field_body_/);
    expect(kw!.keyword).not.toMatch(/_[a-f0-9]{12}$/);
  });

  it("all RS dsl stubs are free of hex hash grant_keyword stubs", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dslDir = join(
      process.cwd(),
      "../cards/src/generated/dsl-stubs",
    );
    let stubCount = 0;
    for (const file of readdirSync(dslDir)) {
      if (!file.startsWith("RS-") || !file.endsWith(".dsl.json")) continue;
      const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8"));
      for (const eff of doc.effects ?? []) {
        for (const p of eff.effects ?? []) {
          if (p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword)) {
            stubCount++;
          }
        }
      }
    }
    expect(stubCount).toBe(0);
  });
});

describe("RS-410 竜闘気爆炸球", () => {
  it("rematches to nc_sp1_if_no_enemy_units without catchall", () => {
    const text = "これは敵軍ユニットが1体もなければ「SP1」になる。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "nc" } });
    expect(rematched!.some((p) => p.type === "grant_keyword" && p.keyword === "nc_sp1_if_no_enemy_units")).toBe(true);
    expect(isCatchallGrantKeyword("nc_sp1_if_no_enemy_units")).toBe(false);
  });

  it("grants SP1 when enemy has no units", () => {
    const unit = inst("RS-410", "drake");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: legendDefinitions,
      player1: { battle: [unit] },
      player2: { battle: [], rush: [], command: [] },
    });
    const result = applyGrantKeyword(state, {
      playerId: "player1",
      phasePlayerId: "player1",
      sourceCardId: "RS-410",
      effectId: "baku",
      triggerSourceInstanceId: unit.instanceId,
    }, "nc_sp1_if_no_enemy_units");
    expect(result.detail).toBe("nc_sp1_if_no_enemy_units");
    expect(result.state.players.player1.battle[0]?.spModifier).toBe(1);
  });
});

describe("RS monkey-test high-frequency fixes", () => {
  it("RS-563 rematches to enter_hold_enemy_power_le_opponent_damage", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、敵軍ユニットを1体選びホールドしてもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない。";
    const rematched = rematchEffectPrimitives(text, {
      name: "突き上げる角",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_hold_enemy_power_le_opponent_damage",
      ),
    ).toBe(true);
  });

  it("RS-229 rematches to enter_scry_top_wb_m_rush", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。オモテにしたカードが「WB」のMユニットのカードならラッシュエリアに出し、それ以外なら捨札にする。そうしたとき、これはアタックすることができない。";
    const rematched = rematchEffectPrimitives(text, {
      name: "超ハンガー進化",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(
      rematched!.some(
        (p) => p.type === "grant_keyword" && p.keyword === "enter_scry_top_wb_m_rush",
      ),
    ).toBe(true);
    expect(isCatchallGrantKeyword("enter_scry_top_wb_m_rush")).toBe(false);
  });

  it("RS-474 rematches to enter_battle_discard_faceup_power choose", () => {
    const text =
      "※自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからオモテ向きのカードを1枚選び捨札にする。";
    const rematched = rematchEffectPrimitives(text, {
      kind: "note",
      trigger: { type: "enter_battle" },
    });
    expect(rematched!.some((p) => p.type === "choose")).toBe(true);
    expect(
      rematched!.some(
        (p) => p.type === "grant_keyword" && p.keyword === "note_other_fx_unknown",
      ),
    ).toBe(false);
  });
});
