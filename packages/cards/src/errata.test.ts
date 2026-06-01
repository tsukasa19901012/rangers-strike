import { describe, expect, it } from "vitest";
import { getCardEffect } from "./effects";
import {
  getBattleEntryHoldCount,
  hasBattleEntryHoldNote,
  listBattleEntryHoldCardIds,
  requiredHeldCommandsForMBattle,
} from "./errata";

describe("errata", () => {
  it("applies RS-018 errata text (exclude attacker from substitute)", () => {
    const effect = getCardEffect("RS-018");
    expect(effect?.text).toContain("アタックしてきたユニット以外");
  });

  it("RS-067 is permanent with discard-on-use text", () => {
    const effect = getCardEffect("RS-067");
    expect(effect?.kind).toBe("permanent");
    expect(effect?.text).toContain("捨札にする");
  });

  it("RS-010 uses official prism power text", () => {
    const effect = getCardEffect("RS-010");
    expect(effect?.kind).toBe("permanent");
    expect(effect?.text).toContain("自分がカードを使用するとき発動できる");
    expect(effect?.text).toContain("自軍コマンドを2つホールドすることで");
    expect(effect?.text).toContain("必要なカテゴリのコマンドを1つホールドしたことにできる");
  });

  it("stacks RS-051 battle entry hold with lightning gravity (Q3)", () => {
    expect(getBattleEntryHoldCount("RS-051")).toBe(1);
    expect(requiredHeldCommandsForMBattle(1, "RS-051")).toBe(2);
  });

  it("lists all battle entry hold cards from unit effect notes", () => {
    expect(listBattleEntryHoldCardIds()).toEqual([
      "RS-035",
      "RS-036",
      "RS-037",
      "RS-038",
      "RS-039",
      "RS-051",
      "RS-052",
      "RS-053",
    ]);
  });

  it.each([
    "RS-035",
    "RS-036",
    "RS-037",
    "RS-038",
    "RS-039",
    "RS-051",
    "RS-052",
    "RS-053",
  ] as const)("detects battle entry hold from card note (%s)", (cardId) => {
    expect(hasBattleEntryHoldNote(cardId)).toBe(true);
    expect(getBattleEntryHoldCount(cardId)).toBe(1);
  });
});
