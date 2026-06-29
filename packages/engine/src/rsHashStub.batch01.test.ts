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

  it("RS-329 rematches to enter_battle_return_s_deck_bottom_draw choose", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアからSユニットを1体選び、自軍山札の下に戻してから1枚ドローする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "マルデヨーナ世界往復切符",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(rematched!.some((p) => p.type === "choose")).toBe(true);
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword.startsWith("deploy_battle_area_"),
      ),
    ).toBe(false);
  });

  it("RS-386 rematches to enter_rush_discard_feature_m_silent", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍捨札から特徴「車両」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。このとき出したユニットの効果は発動しない。";
    const rematched = rematchEffectPrimitives(text, {
      name: "ショベルアーム",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_rush_discard_feature_m_silent",
      ),
    ).toBe(true);
    expect(isCatchallGrantKeyword("enter_rush_discard_feature_m_silent")).toBe(false);
  });

  it("RS-412 rematches to sphinx_power_quiz", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき次の効果を発動できる⇒敵軍パワーのダメージのカードを1枚選び、そのカードの必要パワーの数字を相手に解答させてからオモテにする。相手の解答が不正解なら相手は自分自身のユニットを1体選び撃破する。その後、オモテにしたカードはウラ向きに戻す。";
    const rematched = rematchEffectPrimitives(text, {
      name: "質問には回答を",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(
      rematched!.some(
        (p) => p.type === "grant_keyword" && p.keyword === "sphinx_power_quiz",
      ),
    ).toBe(true);
    expect(isCatchallGrantKeyword("sphinx_power_quiz")).toBe(false);
  });

  it("RS-472 rematches to on_rush_command_discard_deck_feature_m_hold", () => {
    const text =
      "これをラッシュしたとき、自軍コマンドゾーンのカードを好きな枚数選び捨札にしてもよい。そうしたとき、自軍山札から特徴「メカ」を持つMユニットのカードを、捨札にした枚数と同じ枚数まで好きな数選び、自軍コマンドゾーンにホールド状態で置く。その後、山札をシャッフルする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "現場への搬送",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_command_discard_deck_feature_m_hold",
      ),
    ).toBe(true);
  });

  it("RS-316 rematches to enter_battle_discard_rush_feature_sp1", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「恐竜」を持つユニットを2体選び捨札にしてもよい。そうしたとき、このターン、これは「SP1」になる。";
    const rematched = rematchEffectPrimitives(text, {
      name: "超ドリル進化",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_discard_rush_feature_sp1",
      ),
    ).toBe(true);
  });

  it("RS-296 rematches to while_in_field_formation_deploy", () => {
    const text =
      "これが自軍ラッシュエリアにある間、次の効果を発動できる⇒自軍コマンドをホールドして特徴「航空機」を持つユニットをラッシュしたとき、ラッシュしたユニットと同じカード名のユニットカードを自分の手札から1枚選びラッシュエリアに出す。";
    const rematched = rematchEffectPrimitives(text, {
      name: "編隊出撃",
      kind: "named",
      trigger: { type: "while_in_field" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "while_in_field_formation_deploy",
      ),
    ).toBe(true);
  });

  it("RS-411 rematches to on_rush_deck_resident_operation", () => {
    const text =
      "これをラッシュしたとき、自軍山札からDAの常駐オペレーションのカードを1枚選び、自軍常駐置き場に配置してもよい。（すでに配置されている自軍常駐オペレーションは捨札にしてから配置する）その後、山札をシャッフルする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "今は俺が戒律だ",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_deck_resident_operation",
      ),
    ).toBe(true);
  });

  it("RS-302 rematches to on_rush_send_printed_bp3000_to_power", () => {
    const text =
      "これをラッシュしたとき、カードに表記された本来のBPが3000のユニットをすべて持ち主のパワーゾーンに送る。";
    const rematched = rematchEffectPrimitives(text, {
      name: "レックスレーザー",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_send_printed_bp3000_to_power",
      ),
    ).toBe(true);
  });

  it("RS-478 rematches to on_rush_destroy_enemy_multicat_bp9000", () => {
    const text =
      "これをラッシュしたとき、敵軍バトルエリアから、カテゴリを2つ以上持つBP9000以下のユニットを1体選び、撃破してもよい。";
    const rematched = rematchEffectPrimitives(text, {
      name: "粉砕する大顎",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_destroy_enemy_multicat_bp9000",
      ),
    ).toBe(true);
  });

  it("RS-365 rematches to enter_battle_hand_match_destroy_sp", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自分の手札をすべて相手に見せる。そして、見せた手札と同じカード名の敵軍ユニットを全て撃破する。その後、自分の手札をすべて捨札にし、この効果で撃破した敵軍ユニット1体につき、 このターン、これはSP+1される。";
    const rematched = rematchEffectPrimitives(text, {
      name: "帝国の掌握",
      kind: "named",
      trigger: { type: "enter_battle" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_hand_match_destroy_sp",
      ),
    ).toBe(true);
  });

  it("RS-586 rematches to while_in_field_da_rush_discard_sensho_power", () => {
    const text =
      "これが自軍エリアにある間、自軍ラッシュフェイズ中、自分の手札からDAを持つユニットカードをラッシュするとき、そのパワーを満たすために次のようにしてもよい⇒必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "魔神に不足する物",
      kind: "named",
      trigger: { type: "while_in_field" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "while_in_field_da_rush_discard_sensho_power",
      ),
    ).toBe(true);
  });

  it("RS-400 rematches to on_rush_send_enemy_battle_feature_m_to_power", () => {
    const text =
      "これをラッシュしたとき、敵軍バトルエリアから特徴「恐竜」を持つMユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";
    const rematched = rematchEffectPrimitives(text, {
      name: "密猟者からの保護",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_send_enemy_battle_feature_m_to_power",
      ),
    ).toBe(true);
  });

  it("RS-387 rematches to on_rush_return_unridden_s_vehicles_deck_bottom", () => {
    const text =
      "これをラッシュしたとき、ライドされていないSビークルがあれば、すべて持ち主の山札の下に好きな順で戻してもよい。";
    const rematched = rematchEffectPrimitives(text, {
      name: "緊急車両誘導",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_return_unridden_s_vehicles_deck_bottom",
      ),
    ).toBe(true);
  });

  it("RS-576 note rematches to on_rush_release_held_s_units", () => {
    const text =
      "※これをラッシュしたとき、ホールド状態の自軍Sユニットをすべてリリースしてもよい。";
    const rematched = rematchEffectPrimitives(text, {
      kind: "note",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_release_held_s_units",
      ),
    ).toBe(true);
  });

  it("RS-607 rematches to operation_enemy_damage_reveal_beast_rush", () => {
    const text =
      "次の効果を、敵軍ダメージの点数と同じ数まで好きな回数実行する⇒自軍山札の上からカードを1枚オモテにする。オモテにしたカードが特徴「獣」を持つユニットカードかビークルカードだったなら、それを自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。出せなかったなら、オモテにしたカードを手札に加えた後、自分の手札からカードを1枚選び捨札にする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "ファルコンサモナー",
      kind: "named",
      trigger: { type: "operation", timing: "rush" },
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "operation_enemy_damage_reveal_beast_rush",
      ),
    ).toBe(true);
  });

  it("RS-277 rematches to enter_battle_enemy_red_feature_to_rush", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドゾーンか、敵軍パワーゾーンのダメージ以外のカードに特徴「レッド」を持つユニットカードがあれば1枚選び、敵軍ラッシュエリアに出してもよい。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "enter_battle" },
      name: "古傷の因縁",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_enemy_red_feature_to_rush",
      ),
    ).toBe(true);
  });

  it("RS-633 note rematches to start_end_command_toggle_hold_discard", () => {
    const text =
      "※自軍スタートフェイズを終えるとき、このユニットがリリース状態ならホールドし、ホールド状態なら捨札にする。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "nc" } });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "start_end_command_toggle_hold_discard",
      ),
    ).toBe(true);
  });

  it("RS-633 rematches to enter_battle_command_return_hand_bp2000_sp1", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+2000 され、これがホールド状態なら「SP1」 になる。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "enter_battle" },
      name: "シルバーブレイザー",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_command_return_hand_bp2000_sp1",
      ),
    ).toBe(true);
  });

  it("RS-580 note rematches to on_cease_shuffle_all_discard_to_deck", () => {
    const text =
      "※これがユニットでなくなるとき、自分も相手も自分自身の捨札をすべて山札に戻してシャッフルする。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "nc" } });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_cease_shuffle_all_discard_to_deck",
      ),
    ).toBe(true);
  });

  it("RS-580 rematches to on_rush_deck_split_hunger_god", () => {
    const text =
      "これをラッシュしたとき、次の効果を、自分、相手の順に行う⇒自分自身の山札の枚数が2枚以上あれば、自分自身の山札の上から1枚ずつひいて、ウラ向きのまま2つの束に交互に振り分ける。その後、2つの束をそれぞれ見て、どちらか1つの束を選び、シャッフルする。これが自軍エリアにある間、選んだ束を自分自身の山札として扱い、もう1つの束は捨札にする。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "on_rush" },
      name: "全てを飲み込む飢餓",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_deck_split_hunger_god",
      ),
    ).toBe(true);
  });

  it("RS-504 rematches to while_in_field_ally_enter_mere_chameleon", () => {
    const text =
      "これが自軍エリアにある間、「獣人メレ」以外の自軍ユニットがバトルエリアに出たとき、次の効果から1つ選び発動できる⇒ ◎自軍コマンドゾーンからカードを1枚選び捨札にする。 ◎自軍コマンドゾーンにカードが1枚も無ければ、自軍捨札からカードを1枚選び、自軍コマンドゾーンにリリース状態で置く。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "while_in_field" },
      name: "臨獣カメレオン拳",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "while_in_field_ally_enter_mere_chameleon",
      ),
    ).toBe(true);
  });

  it("RS-518 rematches to operation_enemy_s_command_hold_or_destroy", () => {
    const text =
      "敵軍Sユニットを1体選ぶ。選んだユニットがホールド状態なら撃破し、リリース状態ならホールドする。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "operation", timing: "rush" },
      name: "獣撃棒",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "operation_enemy_s_command_hold_or_destroy",
      ),
    ).toBe(true);
  });

  it("RS-399 rematches to on_rush_send_enemy_battle_category_m_to_power", () => {
    const text =
      "これをラッシュしたとき、敵軍バトルエリアからMAのMユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "on_rush" },
      name: "オーパーツの返還",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_send_enemy_battle_category_m_to_power",
      ),
    ).toBe(true);
  });

  it("RS-421 note rematches to note_bp_per_own_command_feature_red", () => {
    const text = "※これは特徴「レッド」を持つ自軍コマンド1つにつきBP+1000される。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "nc" } });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "note_bp_per_own_command_feature_red",
      ),
    ).toBe(true);
  });

  it("RS-421 rematches to enter_battle_hold_red_nc_command_soul", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンから、特徴「レッド」とＮＣの効果を持つユニットカードを1枚選びホールドしてもよい。そうしたとき、ホールドしたユニットカードのNCの効果を、このユニットの効果として発動する。ただしストライクはできない。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "enter_battle" },
      name: "ソウル降臨",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_hold_red_nc_command_soul",
      ),
    ).toBe(true);
  });

  it("RS-616 rematches to enter_battle_discard_rush_name_bp4000", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから「クライマー」を2体選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+4000";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "enter_battle" },
      name: "巨大ボール化",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_discard_rush_name_bp4000",
      ),
    ).toBe(true);
  });

  it("RS-662 destroy note rematches to on_destroy_reanimate_named_from_discard", () => {
    const text =
      "※これが撃破されて捨札になったとき、自軍捨札から｢獣人メレ｣のカードを1枚選び、自軍ラッシュエリアに出す。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "on_destroy" } });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_destroy_reanimate_named_from_discard",
      ),
    ).toBe(true);
  });

  it("RS-662 rematches to enter_battle_enemy_command_match_own_count_power_discard", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンのカードの枚数を数えて、その数と同じ必要パワーの数字を持つカードを敵軍コマンドゾーンから1枚選び捨札にしてもよい。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "enter_battle" },
      name: "火将危願",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_enemy_command_match_own_count_power_discard",
      ),
    ).toBe(true);
  });

  it("RS-606 rematches to operation_release_wing_then_enemy_battle_bp_le_to_power", () => {
    const text =
      "ウイングを持つ自軍ユニットを1枚選びリリースしてもよい。そうしたとき、リリースしたユニットのBPを見て、そのBP以下のBPを持つユニットを敵軍バトルエリアから1体選び、持ち主のパワーゾーンにダメージにして置く。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "operation", timing: "rush" },
      name: "雷鳴剣ヒカリマル",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "operation_release_wing_then_enemy_battle_bp_le_to_power",
      ),
    ).toBe(true);
  });

  it("RS-451 rematches to while_in_battle_enemy_s_must_attack_self", () => {
    const text =
      "これが自軍バトルエリアにある間、敵軍ターン中、敵軍Sユニットは、バトルエリアに出たとき、可能ならこのユニットにアタックする。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "while_in_field" },
      name: "シノビボールの争奪戦",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "while_in_battle_enemy_s_must_attack_self",
      ),
    ).toBe(true);
  });

  it("RS-383 rematches to on_rush_discard_s_to_hand_up_to_2", () => {
    const text =
      "これをラッシュしたとき、自軍捨札から、Sユニットのカードを2枚まで選び手札に加えてもよい。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "on_rush" },
      name: "救出作業",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_discard_s_to_hand_up_to_2",
      ),
    ).toBe(true);
  });

  it("RS-585 rematches to enter_battle_scry_deck_top3_sp1_if_unit_has_sp", () => {
    const text =
      "自軍ターン中、これがバトルエリアに出たとき、自軍か敵軍の山札の上から3枚をオモテにしてもよい。そうしたとき、オモテにしたカードの中にSPが空欄でないユニットカードがあれば、このターン、これは「SP1」になる。その後、オモテにしたカードは、その持ち主が相手に見せずに好きな順で山札の上に戻す。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "enter_battle" },
      name: "サガスピアー",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "enter_battle_scry_deck_top3_sp1_if_unit_has_sp",
      ),
    ).toBe(true);
  });

  it("RS-304 rematches to while_in_battle_opponent_da_s_rush_power_plus_1", () => {
    const text =
      "これが自軍バトルエリアにある間、相手が手札からDAのSユニットのカードをラッシュするとき、そのカードの必要パワーの数字は1増える。";
    const rematched = rematchEffectPrimitives(text, {
      trigger: { type: "while_in_field" },
      name: "治安維持",
    });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "while_in_battle_opponent_da_s_rush_power_plus_1",
      ),
    ).toBe(true);
  });

  it("RS-235 ally rush note rematches to on_ally_rush_named_return_self_to_hand", () => {
    const text =
      "※自分が「デカベースクローラー」をラッシュしたとき、自軍エリアに「デカベースロボ」があれば1体選んで手札に戻す。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "nc" } });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_ally_rush_named_return_self_to_hand",
      ),
    ).toBe(true);
  });

  it("RS-235 battle entry note rematches to require_power_discard_2_to_battle", () => {
    const text =
      "※自軍パワーゾーンからダメージ以外のカードを2枚選んで捨札にしなければバトルエリアに出られない。";
    const rematched = rematchEffectPrimitives(text, { trigger: { type: "nc" } });
    expect(
      rematched!.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "require_power_discard_2_to_battle",
      ),
    ).toBe(true);
  });

  it("RS-629 rematches to megasuringu", () => {
    const text =
      "リリース状態の自軍コマンドを1つ選び、山札の上に戻してもよい。そうしたとき、このターン、敵軍ラッシュエリアのSユニットはBP-1500される。（BP0以下になったユニットは撃破される）";
    const rematched = rematchEffectPrimitives(text, {
      name: "メガスリング",
      kind: "named",
      trigger: { type: "nc" },
    });
    expect(
      rematched?.some(
        (p) => p.type === "grant_keyword" && p.keyword === "megasuringu",
      ),
    ).toBe(true);
    expect(isCatchallGrantKeyword("megasuringu")).toBe(false);
  });

  it("RS-667 rematches to on_rush_scry_exclude_named_feature_m_to_rush", () => {
    const text =
      "これをラッシュしたとき、自軍山札を見て「ジャン・ボエール」以外の特徴「炎神」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "ファーストクラスな教官",
      kind: "named",
      trigger: { type: "on_rush" },
    });
    expect(
      rematched?.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_rush_scry_exclude_named_feature_m_to_rush",
      ),
    ).toBe(true);
    expect(isCatchallGrantKeyword("on_rush_scry_exclude_named_feature_m_to_rush")).toBe(
      false,
    );
  });

  it("RS-686 rematches to on_strike_discard_enemy_power_faceup choose", () => {
    const text =
      "これがストライクしてダメージを与えたとき、敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が3以下のユニットカードを1枚選び捨札にしてもよい。";
    const rematched = rematchEffectPrimitives(text, {
      name: "セイクウインパルス",
      kind: "named",
      trigger: { type: "on_strike" },
    });
    expect(rematched?.some((p) => p.type === "choose")).toBe(true);
    expect(
      rematched?.some(
        (p) => p.type === "grant_keyword" && isCatchallGrantKeyword(p.keyword),
      ),
    ).toBe(false);
  });

  it("RK-297 rematches to raidapanchi_discard_enemy_power_faceup", () => {
    const text =
      "敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が2以下のカードを1枚選んでもよい（自軍Sユニットが｢仮面ライダーキックホッパー｣と｢仮面ライダーパンチホッパー｣だけなら、必要パワーの数字が4以下のカードを1枚選んでもよい)。そうしたとき、選んだカードを捨札にする。";
    const rematched = rematchEffectPrimitives(text, {
      name: "ライダーパンチ",
      kind: "named",
      trigger: { type: "nc" },
    });
    expect(
      rematched?.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "raidapanchi_discard_enemy_power_faceup",
      ),
    ).toBe(true);
    expect(isCatchallGrantKeyword("raidapanchi_discard_enemy_power_faceup")).toBe(false);
  });
});

describe("unnamed note grant_keyword rematch", () => {
  const noteCases: Array<{ text: string; keyword: string }> = [
    {
      text: "※これはホールド状態の敵軍ユニット1体につきBP+1000される",
      keyword: "bp_plus_per_held_enemy_unit_1000",
    },
    {
      text: "※これは相手の手札1枚につきBP+2000される",
      keyword: "bp_plus_per_enemy_hand_card_2000",
    },
    {
      text: "※これは特徴「男」または「女」を持つユニットにアタックできない",
      keyword: "cannot_attack_gender_male_female",
    },
    {
      text: "※特徴「仮面ライダー」を持つユニットが自軍バトルエリアにあれば、これは敵軍Sユニットにアタックされない",
      keyword: "ally_raida_protects_from_enemy_s",
    },
  ];

  for (const { text, keyword } of noteCases) {
    it(`rematches ※ note to ${keyword}`, () => {
      const rematched = rematchEffectPrimitives(text, { kind: "note" });
      expect(
        rematched?.some((p) => p.type === "grant_keyword" && p.keyword === keyword),
      ).toBe(true);
      expect(isCatchallGrantKeyword(keyword)).toBe(false);
    });
  }
});
