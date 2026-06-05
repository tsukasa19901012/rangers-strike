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

  it("formats pink storm NC resolve", () => {
    const entry =
      "player1|resolve_effect_choice|RS-060|ピンクストーム|pink_storm:敵ユニット";
    expect(formatGameLog(entry, {})).toBe(
      "あなたの「ピンクストーム」がピンクストームを発動 → 「敵ユニット」を山札の上へ",
    );
  });

  it("suppresses interim choice notices for configured effects", () => {
    expect(shouldSuppressChoiceNoticeEffect("armor_attack")).toBe(true);
    expect(shouldSuppressChoiceNoticeEffect("moss_breaker")).toBe(false);
  });

  it("ignores non-target resolve details", () => {
    expect(isNoteworthyResolveEffectChoice("tyranno_sonic:own_only")).toBe(false);
    expect(isNoteworthyResolveEffectChoice("judgment_sword:2")).toBe(false);
  });
});
