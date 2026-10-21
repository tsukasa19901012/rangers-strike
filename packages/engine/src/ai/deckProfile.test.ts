import { describe, expect, it } from "vitest";
import { pickCpuAction } from "./index";
import { deckProfile } from "./deckProfile";
import { deckCards, inst, powerCards, st } from "../cardSpec/RK1-001-021.helpers";

describe("デッキの方針（deckProfile）", () => {
  it("デッキで一番重いカードの必要パワーを数える", () => {
    const s = st({ phase: "charge", player1: { hand: [inst("RS-508", "h")], deck: [inst("RS-506", "d"), ...deckCards(3)] } });
    // RS-508 ゴーオンレッド・RS-506 バスオン と TST-OP（必要パワー 0）のうち一番重いもの。
    const expected = Math.max(...["RS-508", "RS-506", "TST-OP"].map((id) => Number(s.definitions[id]?.powerCost ?? 0)));
    expect(deckProfile(s, "player1").maxPowerCost).toBe(expected);
  });

  it("Lv3〜5: パワーがデッキの一番重いカードに届いていれば、手札のユニットをパワーに置かない", () => {
    const s = st({
      phase: "charge",
      player1: { hand: [inst("RS-508", "h")], power: powerCards(12), command: [inst("TST-OP", "c")], deck: deckCards(10) },
      player2: { deck: deckCards(10, "e") },
    });
    for (const level of [3, 4, 5] as const) {
      expect(pickCpuAction(s, "player1", level)?.type).not.toBe("charge_power");
    }
  });
});
