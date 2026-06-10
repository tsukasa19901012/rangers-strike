import { describe, expect, it } from "vitest";
import { inferWikiTrigger, triggerKey } from "./triggerCatalog";

describe("triggerCatalog", () => {
  it("infers onRush from rush text", () => {
    const t = inferWikiTrigger("これをラッシュしたとき発動できる。敵軍ユニットを選ぶ。");
    expect(t?.label).toBe("onRush");
    expect(triggerKey(t!)).toBe("on_rush");
  });

  it("infers onCounter before onBattle for counter text", () => {
    const t = inferWikiTrigger("自軍Sユニットがアタックされたとき発動できる。アタックされたユニットをラッシュエリアに戻す。");
    expect(t?.label).toBe("onCounter");
  });

  it("infers onDestroy before whileInField for self destroy damage", () => {
    const t = inferWikiTrigger("※これが撃破されたとき、1点ダメージを受ける。");
    expect(t?.label).toBe("onDestroy");
  });
});
