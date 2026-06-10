import { describe, expect, it } from "vitest";
import { rematchExtractedEffect } from "./extractEffects";

describe("rematchExtractedEffect (M20)", () => {
  it("matches destroy with 選び撃破", () => {
    const built = rematchExtractedEffect(
      "敵軍バトルエリアから、カテゴリにDAを持つ敵軍Sユニットを1体選び撃破する。",
      { name: "ライダーキック", kind: "named", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("destroy_enemy_s_category_da");
    expect(built?.effects[0]?.type).toBe("choose");
  });

  it("matches no ride while held note", () => {
    const built = rematchExtractedEffect(
      "※これはホールド状態のときビークルにライドできない。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(built?.effects).toEqual([
      { type: "grant_keyword", keyword: "no_ride_while_held", duration: "permanent" },
    ]);
  });

  it("matches conditional recruit from discard", () => {
    const built = rematchExtractedEffect(
      "※これが撃破されて捨札になったとき、自軍捨札に「シンケンレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("recruit_named_from_discard_if_present");
    expect(built?.trigger).toEqual({ type: "nc" });
  });

  it("matches DA enemy S destroy (XG1-064)", () => {
    const built = rematchExtractedEffect("DAを持つ敵軍Sユニットを1体選び撃破する。", {
      name: "ライダーキック",
      kind: "named",
      trigger: { type: "nc" },
    });
    expect(built?.matchedPattern).toBe("destroy_enemy_s_da");
    expect(built?.effects[0]?.type).toBe("choose");
  });

  it("matches stack DA-less L on rush (RS-647)", () => {
    const built = rematchExtractedEffect(
      "自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられたとき、重ねたユニットの効果を発動する。",
      { kind: "body", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("stack_da_less_l_on_rush");
    expect(built?.effects[0]).toEqual({
      type: "grant_keyword",
      keyword: "stack_da_less_l_on_rush",
      duration: "permanent",
    });
  });

  it("matches ride without RC for feature S (RK-300)", () => {
    const built = rematchExtractedEffect(
      "※特徴「加速」を持つSユニットは、RCを持っていなくてもこのビークルにライドできる。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("ride_without_rc_feature");
    expect(built?.effects[0]?.type).toBe("grant_keyword");
    expect((built?.effects[0] as { keyword: string }).keyword).toMatch(/^ride_without_rc_/);
  });

  it("matches grant SP body only (RS-370)", () => {
    const built = rematchExtractedEffect("SP1", {
      name: "SP付与",
      kind: "named",
      trigger: { type: "nc" },
    });
    expect(built?.matchedPattern).toBe("grant_sp_body_only");
    expect(built?.effects).toEqual([{ type: "grant_keyword", keyword: "SP1", duration: "turn" }]);
  });

  it("matches destroy rush original BP (RS-345)", () => {
    const built = rematchExtractedEffect(
      "敵軍ラッシュエリアから、カードに表記された本来のBPが3000以下のユニットを1体選び、撃破する。",
      { kind: "body", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("destroy_rush_original_bp");
    expect(built?.effects[0]?.type).toBe("choose");
  });

  it("matches stack S on rush (RK-013)", () => {
    const built = rematchExtractedEffect(
      "自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは特徴「人型」を追加されて「Lユニット」になる。",
      { kind: "body", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("stack_s_on_self_rush");
  });

  it("matches category WB in battle phase (XG6-021)", () => {
    const built = rematchExtractedEffect(
      "※これは自軍バトルフェイズ中、カテゴリにWBが追加される。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("category_wb_battle_phase");
  });

  it("matches power faceup feature on enter (RK-143)", () => {
    const built = rematchExtractedEffect(
      "これが自軍パワーゾーンでオモテ向きになっている間、自軍バトルフェイズ中、特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを自軍バトルエリアに出してもよい。",
      { kind: "body", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("power_faceup_feature_enter_battle");
  });

  it("matches enter hold enemy S to command (RK-024)", () => {
    const built = rematchExtractedEffect(
      "自軍ターン中、これがバトルエリアに出たとき、追加条件を持たないBP4000以上の敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。",
      { kind: "body", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("enter_hold_enemy_s_command");
    expect(built?.effects[0]?.type).toBe("choose");
  });
});
