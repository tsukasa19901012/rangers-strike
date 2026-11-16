import { describe, expect, it } from "vitest";
import { formatGameLog, isNoteworthyResolveEffectChoice } from "./formatLog";
import { shouldSuppressChoiceNoticeEffect } from "./effectChoiceNotice";

describe("effect choice notices", () => {
  it("formats armor attack resolve with target", () => {
    const entry =
      "player2|resolve_effect_choice|RS-046|パトアーマー|armor_attack:テストユニット";
    expect(isNoteworthyResolveEffectChoice("armor_attack:テストユニット")).toBe(true);
    expect(formatGameLog(entry, {})).toBe(
      "CPUの「パトアーマー」がアーマーアタックを発動 → 「テストユニット」をパワーへ",
    );
  });

  it("formats multi-target moss blizzard resolve", () => {
    const entry =
      "player2|resolve_effect_choice|RS-040|モスラ|moss_blizzard:コマンドA、コマンドB";
    expect(isNoteworthyResolveEffectChoice("moss_blizzard:コマンドA、コマンドB")).toBe(true);
    expect(formatGameLog(entry, {})).toContain("「コマンドA」「コマンドB」");
    expect(formatGameLog(entry, {})).toContain("モスブリザード");
  });

  it("formats grant_sp1 NC as SP1 not SP+1", () => {
    const entry = "player1|number_combo|RS-054|アバレッド|sp1";
    expect(formatGameLog(entry, {})).toBe("あなたの「アバレッド」がNCを発動（SP1）");
  });

  it("formats pink storm NC resolve", () => {
    const entry =
      "player1|resolve_effect_choice|RS-060|ピンクストーム|pink_storm:敵ユニット";
    expect(formatGameLog(entry, {})).toBe(
      "あなたの「ピンクストーム」がピンクストームを発動 → 「敵ユニット」を山札の上へ",
    );
  });

  it("formats rescue activity and ruin excavation resolve", () => {
    expect(
      formatGameLog(
        "player1|resolve_effect_choice|RS-072|レスキュー活動|rescue_activity:メカA",
        {},
      ),
    ).toContain("メカA");
    expect(
      formatGameLog(
        "player2|resolve_effect_choice|RS-121|遺跡発掘|ruin_excavation:ユニットB",
        {},
      ),
    ).toContain("ユニットB");
    expect(isNoteworthyResolveEffectChoice("rescue_activity:メカA")).toBe(true);
    expect(isNoteworthyResolveEffectChoice("ruin_excavation:ユニットB")).toBe(true);
  });

  it("suppresses interim choice notices for configured effects", () => {
    expect(shouldSuppressChoiceNoticeEffect("armor_attack")).toBe(true);
    expect(shouldSuppressChoiceNoticeEffect("rescue_activity")).toBe(true);
    expect(shouldSuppressChoiceNoticeEffect("moss_breaker")).toBe(false);
  });

  it("ignores non-target resolve details", () => {
    expect(isNoteworthyResolveEffectChoice("tyranno_sonic:own_only")).toBe(false);
    expect(isNoteworthyResolveEffectChoice("judgment_sword:2")).toBe(false);
  });

  // A 352-game log scan (2026-11-16) showed internal names: 「self_damageを発動」, 「dark_dual_blade_commandを発動」,
  // 「V-1システム (destroy_effect)」, a battle against 「cancelled」, 「pink_storm:move」 as a card name.
  it("never shows an internal effect id, action or marker", () => {
    const defs = { "RS-102": { name: "五の槍サーガイン" }, "RS-454": { name: "テストユニット" }, "RS-054": { name: "アバレッド" } } as never;
    expect(formatGameLog("player2|resolve_effect_choice|RS-102|五の槍サーガイン|dark_dual_blade_command:仮面ライダーW・CT", defs)).not.toMatch(/[a-z]_[a-z]/);
    expect(formatGameLog("player1|named_effect|RS-054|アバレッド|self_damage", defs)).toBe("あなたの「アバレッド」の効果が発動");
    expect(formatGameLog("player2|destroy_effect|RS-054|アバレッド|choice:some_effect", defs)).toBe("CPUの「アバレッド」の撃破されたときの効果");
    expect(formatGameLog("player2|battle|RS-454-60|RS-454-60|cancelled", defs)).toBe("CPUの「テストユニット」のバトルは行われなかった");
    expect(formatGameLog("player1|resolve_effect_choice|RS-102|五の槍サーガイン|pink_storm:move", defs)).toBe("あなたの「五の槍サーガイン」のピンクストームを解決");
    expect(formatGameLog("player2|joint_combo_l|RS-054|アバレッド|rk_passive:ride_grant_ability", defs)).toContain("「Lユニット」");
    expect(isNoteworthyResolveEffectChoice("armor_attack:place_in_power")).toBe(false);
    // A one-word id with a label keeps it (XG3-046 キングストーンフラッシュ).
    expect(formatGameLog("player1|number_combo|RS-054|アバレッド|choice:kingusutonfurashu", defs)).toBe("あなたの「アバレッド」がNCでキングストーンフラッシュの対象選択");
  });
});

describe("プレイヤーの呼び名", () => {
  it("呼び名を渡すと、その名前で書く（対人戦の「相手」）", () => {
    const labels = { player1: "あなた", player2: "相手" } as const;
    expect(formatGameLog("player2|draw", {}, labels)).toBe("相手が1枚ドローした");
    expect(formatGameLog("player1|draw", {}, labels)).toBe("あなたが1枚ドローした");
    expect(formatGameLog("player2|draw", {})).toBe("CPUが1枚ドローした");
  });
});
