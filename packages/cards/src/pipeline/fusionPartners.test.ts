import { describe, expect, it } from "vitest";
import { parseZordFusionLine } from "./fusionPartners";

describe("parseZordFusionLine", () => {
  it("resolves AbarenOh fusion partners", () => {
    const result = parseZordFusionLine(
      "合体―爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン【爆竜電撃ドリルスピン】これがバトルエリアに出たとき",
    );
    expect(result?.partnerSlotCardIds).toEqual([
      ["RS-051", "XG7-012"],
      ["RS-052"],
      ["RS-053"],
    ]);
    expect(result?.partnerCardIds).toEqual([
      "RS-051",
      "XG7-012",
      "RS-052",
      "RS-053",
    ]);
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

  it("ignores trailing wing note after fusion partners (RS-686)", () => {
    const result = parseZordFusionLine(
      "合体―トリプター＋ジェットラス＋ジャン・ボエール ※ウイング 【セイクウインパルス】",
    );
    expect(result?.partnerSlotCardIds).toEqual([
      ["RS-668"],
      ["RS-666"],
      ["RS-667"],
    ]);
    expect(result?.partnerCardIds).toEqual(["RS-668", "RS-666", "RS-667"]);
  });
});
