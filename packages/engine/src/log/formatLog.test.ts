import { describe, expect, it } from "vitest";
import { formatGameLog } from "./formatLog";

// The rules and card text say 「ラッシュエリアに出た」「バトルエリアに出たとき」 and never 「登場」.
describe("formatGameLog: ルールの言い方", () => {
  const defs = {};

  it("バトルエリアに出たときの効果を「登場効果」と書かない", () => {
    const lines = [
      formatGameLog("player1|enter_battle|X|マジレッド", defs),
      formatGameLog("player1|enter_battle|X|マジレッド|destroy_choice", defs),
      formatGameLog("player2|enter_battle|X|マジレッド|destroy:アバレブルー", defs),
    ];
    expect(lines).toEqual([
      "あなたの「マジレッド」のバトルエリアに出たときの効果",
      "あなたの「マジレッド」のバトルエリアに出たときの効果の対象選択",
      "CPUの「マジレッド」のバトルエリアに出たときの効果で「アバレブルー」を撃破",
    ]);
    for (const line of lines) expect(line).not.toContain("登場");
  });

  it("ラッシュは「ラッシュ」、ラッシュエリアへ戻すのは「ラッシュエリアに戻した」", () => {
    expect(formatGameLog("player1|rush|X|マジレッド", defs)).toBe("あなたが「マジレッド」をラッシュ");
    expect(formatGameLog("player1|return_all_battle_to_rush", defs)).toBe("あなたがバトルエリアのユニットをすべてラッシュエリアに戻した");
  });
});
