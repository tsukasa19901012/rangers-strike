import { describe, expect, it } from "vitest";
import { pickCpuAction } from "./index";
import { deckProfile } from "./deckProfile";
import { guardKeyCharges } from "./level1";
import { getLegalActions } from "../core/legalActions";
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

  it("切り札（一番重い合体ユニット）と、合体の文に名前が出る自分のカードをキーカードにする。コマンドを手札に戻すカードがあれば commandRecovery", () => {
    const s = st({
      phase: "charge",
      player1: { hand: [inst("XG6-020", "u")], deck: [inst("XG6-019", "db"), inst("XG6-006", "dt"), inst("XG1-088", "bk"), ...deckCards(3)] },
    });
    const prof = deckProfile(s, "player1");
    expect([...prof.keyCards].sort()).toEqual(["XG6-006", "XG6-019", "XG6-020"]);
    expect(prof.commandRecovery).toBe(true);
  });

  it("keyCardGuard: 最後の 1 枚の切り札はパワーに置かない。コマンドには、コマンドを手札に戻すカードがデッキにあるときだけ置く。残りがあれば置ける", () => {
    const board = (deck: ReturnType<typeof inst>[]) =>
      st({ phase: "charge", player1: { hand: [inst("XG6-020", "u"), inst("RS-150", "pr")], deck: [...deck, ...deckCards(5)] }, player2: { deck: deckCards(5, "e") } });
    const kinds = (s: ReturnType<typeof board>) =>
      guardKeyCharges(s, "player1", getLegalActions(s).filter((a) => a.playerId === "player1"))
        .filter((a) => a.type === "charge_power" || a.type === "charge_command")
        .map((a) => `${a.type}:${"instanceId" in a ? a.instanceId : ""}`)
        .sort();
    // 回収手段なし: 切り札はどちらにも置かない（ほかのカードは置ける）。
    expect(kinds(board([]))).toEqual(["charge_command:RS-150:pr", "charge_power:RS-150:pr"]);
    // XG1-088 バイクル（自軍コマンドを手札に戻す）がある: コマンドには置ける。
    expect(kinds(board([inst("XG1-088", "bk")]))).toEqual(["charge_command:RS-150:pr", "charge_command:XG6-020:u", "charge_power:RS-150:pr"]);
    // 山札にもう 1 枚ある: どちらにも置ける。
    expect(kinds(board([inst("XG6-020", "u2")]))).toContain("charge_power:XG6-020:u");
  });

  it("Lv5: 切り札とその素材しか手札になくても、チャージフェイズで止まらない（フェイズを終えられる）", () => {
    const s = st({
      phase: "charge",
      player1: { hand: [inst("XG6-020", "u")], power: powerCards(3), command: [inst("TST-OP", "c")], deck: deckCards(10) },
      player2: { deck: deckCards(10, "e") },
    });
    const a = pickCpuAction(s, "player1", 5);
    expect(a).not.toBeNull();
    expect(a?.type).not.toBe("charge_power");
  });
});
