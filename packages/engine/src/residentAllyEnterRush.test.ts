/**
 * 常駐「自軍バトルフェイズ中、特徴「激気」を持つ自軍Sユニットがバトルエリアに出たとき、次の効果を発動できる⇒
 * …必要パワーの数字が小さいWBのMユニットのカードを、自分の手札から1枚選び、自軍ラッシュエリアに出す。」（RS-436 激気）。
 * 出典: カード本文（packages/cards カタログ RS-436）。
 */
import { describe, expect, it } from "vitest";
import { deckCards, enter, inst, pick, resolveAll, skip, st, zoneOf } from "./cardSpec/RS6-411-431.helpers";

describe("RS-436 激気（常駐）", () => {
  const base = (rushId: string, hand = [inst("RS-424", "ch"), inst("RS-340", "x")]) =>
    st({ player1: { rush: [inst(rushId, "u")], hand, operation: [inst("RS-436", "gk")], deck: deckCards(3) } });

  it("特徴「激気」の自軍 S ユニット（スーパーゲキレッド・必要パワー7）が出たとき、必要パワーが小さい WB の M ユニットを手札から出せる", () => {
    let s = enter(base("RS-426"), "RS-426:u");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["RS-424:ch"]);
    s = resolveAll(pick(s, "RS-424:ch"));
    expect(zoneOf(s, "player1", "RS-424:ch")).toBe("rush");
  });

  it("発動は任意 — 見送れば手札に残る", () => {
    let s = enter(base("RS-426"), "RS-426:u");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-424:ch")).toBe("hand");
  });

  it("特徴「激気」を持たない S ユニット（ゲキレッド）では発動しない", () => {
    const s = enter(base("RS-340"), "RS-340:u");
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});
