import { describe, expect, it } from "vitest";
import { act, enter, inst, legal, released, st, zoneOf } from "./cardSpec/RS1-047-070.helpers";

/** RS-284 ホワイトスワン【スワンウィング】（CN3）: 敵軍コマンドゾーンの S ユニットのカードをすべてラッシュエリアに出してもよい。 */
describe("RS-284 ホワイトスワン【スワンウィング】", () => {
  function swanAtThird() {
    let s = st({
      player1: { battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2")], rush: [inst("RS-284", "swan")] },
      player2: { command: [released("TST-UNIT-0", "s"), released("TST-UNIT-2", "m"), released("TST-OP", "op"), released("RS-050", "l")] },
    });
    s = enter(s, "RS-284:swan");
    return s;
  }

  it("使うと敵軍コマンドゾーンの S ユニットのカードがすべて敵軍ラッシュエリアに出る（出典: atwiki/page-472）", () => {
    let s = swanAtThird();
    const use = legal(s).find((a) => a.type === "resolve_effect_choice" && a.playerId === "player1");
    expect(use).toBeDefined();
    s = act(s, use!);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("command");
    expect(zoneOf(s, "player2", "TST-OP:op")).toBe("command");
    expect(zoneOf(s, "player2", "RS-050:l")).toBe("command");
  });

  it("「出してもよい」— 使わないこともできる（出典: atwiki/page-472）", () => {
    let s = swanAtThird();
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("command");
  });
});
