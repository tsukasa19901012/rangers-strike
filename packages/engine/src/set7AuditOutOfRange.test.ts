/**
 * set-7 監査（RS-495〜RS-515）で見つかった、範囲外カードの不具合の修正と、共通の仕組みの確認。
 *
 * 出典:
 *  - XG1-096 ビーファイタークワガー ※「これはＮＣもＲＣも発動していないSユニットにアタックされない。」: atwiki/page-1661、
 *    atwiki/page-819 RS-497 Q2（「RCを持つユニットはライドオフすることでRCを発動しているとみなします」）
 *  - RS-436 激気（常駐）: atwiki/page-515、grnrngr/faq-card-7 RS-436 Q1（追加条件は不要）・Q2（ラッシュしたときの効果は発動する）
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { resolvePlayableCard } from "@rangers-strike/cards";
import {
  act,
  attackTargets,
  canSkip,
  choiceIds,
  deckCards,
  enter,
  inst,
  passEntry,
  pick,
  resolveAll,
  settle,
  skip,
  st,
  zoneOf,
} from "./cardSpec/RS7-495-515.helpers";
import type { CardInstance } from "./types/game";

function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

describe("XG1-096 ビーファイタークワガー ※（NC も RC も発動していない S ユニットにアタックされない）", () => {
  // XG1-096 はコアのカタログにないので、デッキで使うときと同じ定義（resolvePlayableCard）を加える。
  const KUWAGA = resolvePlayableCard("XG1-096") as CardDefinition;
  const withKuwaga = (p1: NonNullable<Parameters<typeof st>[0]>["player1"]) =>
    st(
      { player1: { deck: deckCards(3), ...p1 }, player2: { battle: [inst("XG1-096", "q"), inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } },
      [KUWAGA],
    );

  it("カタログの本文に※がある（出典: atwiki/page-1661）", () => {
    expect(KUWAGA.text).toContain("ＮＣもＲＣも発動していないSユニットにアタックされない");
  });

  it("NC を発動していない S ユニット（TST-UNIT-0）はビーファイタークワガーにアタックできない（ほかの敵軍ユニットにはできる）（出典: atwiki/page-1661）", () => {
    const s = enter(withKuwaga({ rush: [inst("TST-UNIT-0", "a")] }), "TST-UNIT-0:a");
    const targets = attackTargets(s, "TST-UNIT-0:a");
    expect(targets).not.toContain("XG1-096:q");
    expect(targets).toContain("TST-UNIT-0:e");
  });

  it("ナンバーと並び順が一致して NC を発動した S ユニット（4番目のガオブラック）はアタックできる（出典: atwiki/page-1661「ＮＣも…発動していない」）", () => {
    const s = enter(withKuwaga({ battle: fill(3), rush: [inst("RS-163", "g")] }), "RS-163:g");
    expect(attackTargets(s, "RS-163:g")).toContain("XG1-096:q");
  });

  it("NC が成立しなかった同じユニット（1番目のガオブラック）はアタックできない（出典: atwiki/page-1661）", () => {
    const s = enter(withKuwaga({ rush: [inst("RS-163", "g")] }), "RS-163:g");
    expect(attackTargets(s, "RS-163:g")).not.toContain("XG1-096:q");
  });

  it("S ユニット以外（M の TST-UNIT-2）は制限を受けない（出典: atwiki/page-1661「Sユニットにアタックされない」）", () => {
    const s = enter(withKuwaga({ rush: [inst("TST-UNIT-2", "m")] }), "TST-UNIT-2:m");
    expect(attackTargets(s, "TST-UNIT-2:m")).toContain("XG1-096:q");
  });

  it("RC を持つユニットはライドオフすれば RC を発動したとみなされ、アタックできる（出典: atwiki/page-819 Q2）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("RK-031", "r"), inst("RK-058", "z")], deck: deckCards(3) },
      player2: { battle: [inst("XG1-096", "q")], deck: deckCards(3, "e") },
    }, [KUWAGA]);
    s = settle(act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:r", vehicleInstanceId: "RK-058:z" }));
    s = settle(act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true }));
    expect(attackTargets(s, "RK-031:r")).toContain("XG1-096:q");
  });

  it("ライドしたまま（ライドオフしない）ならアタックできない（出典: atwiki/page-819 Q2「ライドオフすることで」）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("RK-031", "r"), inst("RK-058", "z")], deck: deckCards(3) },
      player2: { battle: [inst("XG1-096", "q")], deck: deckCards(3, "e") },
    }, [KUWAGA]);
    s = settle(act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:r", vehicleInstanceId: "RK-058:z" }));
    s = settle(act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false }));
    expect(attackTargets(s, "RK-031:r")).not.toContain("XG1-096:q");
  });
});

describe("RS-436 激気（常駐）と第7弾の激気ユニット", () => {
  it("激気の S ユニット（ゲキバイオレット・必要パワー3）がバトルエリアに出ると、必要パワーの数字が小さい WB の M ユニット（ゲキジャガー・2）だけを手札から出せる（出典: atwiki/page-515）", () => {
    let s = enter(
      st({ player1: { rush: [inst("RS-499", "v")], hand: [inst("RS-425", "jg"), inst("RS-498", "w")], operation: [inst("RS-436", "gk")], deck: deckCards(3) } }),
      "RS-499:v",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    expect(choiceIds(s)).toEqual(["RS-425:jg"]);
    s = resolveAll(pick(s, "RS-425:jg"));
    expect(zoneOf(s, "player1", "RS-425:jg")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-498:w")).toBe("hand");
  });

  it("「発動できる」— 見送れる（出典: atwiki/page-515）", () => {
    let s = enter(
      st({ player1: { rush: [inst("RS-499", "v")], hand: [inst("RS-425", "jg")], operation: [inst("RS-436", "gk")], deck: deckCards(3) } }),
      "RS-499:v",
    );
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-425:jg")).toBe("hand");
  });

  it("激気を持たない S ユニット（TST-UNIT-0）が出ても発動しない（出典: atwiki/page-515「特徴「激気」を持つ自軍Sユニット」）", () => {
    const s = enter(
      st({ player1: { rush: [inst("TST-UNIT-0", "u")], hand: [inst("RS-424", "ch")], operation: [inst("RS-436", "gk")], deck: deckCards(3) } }),
      "TST-UNIT-0:u",
    );
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("4番目に出たゲキチョッパーは、激気の効果と NC【サイブレードカッター】の両方を発動できる（激気で出したゲキチーターはサイブレードカッターの候補から外れる）（出典: atwiki/page-515・atwiki/page-776）", () => {
    let s = enter(
      st({ player1: { battle: fill(3), rush: [inst("RS-500", "c")], hand: [inst("RS-424", "ch"), inst("RS-498", "w")], operation: [inst("RS-436", "gk")], deck: deckCards(3) } }),
      "RS-500:c",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    expect(choiceIds(s)).toEqual(["RS-424:ch"]);
    s = pick(s, "RS-424:ch");
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-424:ch")).toBe("rush");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-500");
    expect(choiceIds(s)).toEqual(["RS-498:w"]);
  });

  it("激気で出したゲキウルフの【狼狼弾】（ラッシュしたとき）は発動する（追加条件は不要）（出典: grnrngr/faq-card-7 RS-436 Q1・Q2）", () => {
    let s = enter(
      st({
        player1: { rush: [inst("RS-426", "sr")], hand: [inst("RS-498", "w")], operation: [inst("RS-436", "gk")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
      }),
      "RS-426:sr",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    s = settle(pick(s, "RS-498:w"));
    expect(zoneOf(s, "player1", "RS-498:w")).toBe("rush");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-498");
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(passEntry(s).players.player1.battle.some((c) => c.instanceId === "RS-426:sr")).toBe(true);
  });
});
