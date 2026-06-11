import { describe, expect, it } from "vitest";
import { parseZordFusionLine } from "./fusionPartners";

describe("parseZordFusionLine", () => {
  it("resolves AbarenOh fusion partners", () => {
    const result = parseZordFusionLine(
      "合体―爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン【爆竜電撃ドリルスピン】これがバトルエリアに出たとき",
    );
    expect(result?.partnerCardIds).toEqual(["RS-051", "RS-052", "RS-053"]);
  });

  it("strips parenthetical alternates", () => {
    const result = parseZordFusionLine(
      "合体―ダイボウケン（または、ゴーゴーダンプ＋ゴーゴーフォーミュラ）＋ゴーゴードリル【大突撃】",
    );
    expect(result?.partnerCardIds).toContain("RS-171");
    expect(result?.partnerCardIds).not.toContain("RS-161");
  });

  it("resolves Patroller justice flash partners", () => {
    const result = parseZordFusionLine(
      "合体―パトストライカー＋パトジャイラー＋パトレーラー＋パトアーマー＋パトシグナー【ジャスティスフラッシャー】",
    );
    expect(result?.partnerCardIds.length).toBe(5);
  });
});
