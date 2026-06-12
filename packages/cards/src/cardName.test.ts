import { describe, expect, it } from "vitest";
import {
  canonicalCardName,
  hasEditionSuffix,
  stripEditionSuffix,
} from "./cardName";

describe("cardName", () => {
  it("strips 2nd and XG edition suffixes", () => {
    expect(stripEditionSuffix("デカマスター（2nd）")).toBe("デカマスター");
    expect(stripEditionSuffix("ファイブレッド（XG2）")).toBe("ファイブレッド");
    expect(stripEditionSuffix("バトルジャパン（XG）")).toBe("バトルジャパン");
    expect(stripEditionSuffix("マジレッド（XG7）")).toBe("マジレッド");
  });

  it("does not strip non-edition parentheticals", () => {
    expect(stripEditionSuffix("タイフーン（1号）")).toBe("タイフーン（1号）");
    expect(stripEditionSuffix("キングストーン（太陽の石）")).toBe("キングストーン（太陽の石）");
  });

  it("detects edition suffix", () => {
    expect(hasEditionSuffix("デカレッド（XG5）")).toBe(true);
    expect(hasEditionSuffix("デカレッド")).toBe(false);
  });

  it("canonicalCardName matches stripped names", () => {
    expect(canonicalCardName("デカマスター（2nd）")).toBe(canonicalCardName("デカマスター"));
  });
});
