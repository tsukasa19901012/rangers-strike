import { describe, expect, it } from "vitest";
import { formatDeckValidationMessage } from "./formatDeckValidation";

describe("formatDeckValidationMessage", () => {
  it("returns a fallback when there are no errors", () => {
    expect(formatDeckValidationMessage([])).toBe("デッキが完成していません");
  });

  it("returns a single error as-is", () => {
    const message = "デッキは最低40枚必要です（現在 10 枚）。あと 30 枚必要です";
    expect(formatDeckValidationMessage([message])).toBe(message);
  });

  it("formats multiple errors as a bulleted summary", () => {
    const errors = [
      "デッキは最低40枚必要です（現在 10 枚）。あと 30 枚必要です",
      "カタログにないカードです: RS-9999（1,849枚プール外の可能性）",
    ];
    expect(formatDeckValidationMessage(errors)).toBe(
      "デッキが完成していません（2件）:\n・デッキは最低40枚必要です（現在 10 枚）。あと 30 枚必要です\n・カタログにないカードです: RS-9999（1,849枚プール外の可能性）",
    );
  });
});
