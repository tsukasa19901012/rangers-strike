/**
 * docs/rules/08-errata.md §3 出典が見つからないもの（2件）
 *
 * 出典: docs/rules/sources/web/w.atwiki.jp/renst/pages/271.txt
 *       docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/errata.html
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERRATA_EFFECT_TEXT } from "@rangers-strike/cards";
import {
  act,
  engineText,
  expectCorrectedText,
  inst,
  legalOfType,
  norm,
  specState,
  zoneIds,
} from "./08-helpers";

const WEB = path.resolve(__dirname, "../../../../docs/rules/sources/web");

function htmlText(rel: string): string {
  return readFileSync(path.join(WEB, rel), "utf8")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "");
}

// ---------------------------------------------------------------------------
describe("R-ERR-UNVERIFIED-01 RS-067 プラズマエネルギー", () => {
  const PRINTED =
    "ストライクされたとき発動できる。ストライクしてきたユニットを撃破する（ダメージは受ける）。そうしたとき、これを捨札にする。";

  // atwiki/page-271: 修正注記のない印刷テキストのみ
  it("R-ERR-UNVERIFIED-01: エンジンのテキストは印刷テキストどおり（読み替えはない）（出典: atwiki/page-271）", () => {
    expectCorrectedText("RS-067", PRINTED);
    expect(norm(engineText("RS-067"))).toBe(norm(PRINTED));
  });

  // 08 章 注:「エンジンの errata 定義にある RS-067 の文面は、上記の印刷テキスト（※常駐行を除く本文）と同一であり、読み替えではない」
  it("R-ERR-UNVERIFIED-01: errata 定義に RS-067 の文面があっても印刷テキストと同一（意味の変更はない）（出典: 08章 R-ERR-UNVERIFIED-01 注）", () => {
    const errata = (ERRATA_EFFECT_TEXT as Partial<Record<string, string>>)["RS-067"];
    if (errata !== undefined) {
      expect(norm(errata)).toBe(norm(PRINTED));
    }
  });

  it("R-ERR-UNVERIFIED-01: 公式エラッタページ（6件）に RS-067 の記載はない（出典: grnrngr/errata）", () => {
    expect(htmlText("www.grnrngr.com/documents/rangersstrike/faq/errata.html")).not.toContain("RS-067");
  });

  it("R-ERR-UNVERIFIED-01: 印刷どおりの挙動 — ストライクされたとき、ストライクしてきたユニットを撃破し、ダメージは受け、プラズマエネルギーは捨札になる（出典: atwiki/page-271）", () => {
    const striker = inst("TST-UNIT-0", "striker");
    const plasma = inst("RS-067", "plasma");
    let s = specState(["RS-067"], {
      phase: "battle",
      player1: { battle: [striker] },
      player2: {
        operation: [plasma],
        deck: [inst("TST-OP", "e1"), inst("TST-OP", "e2")],
      },
    });
    s = act(s, { type: "strike", playerId: "player1", instanceId: striker.instanceId });
    expect(legalOfType(s, "use_plasma_energy")).toHaveLength(1);
    s = act(s, legalOfType(s, "use_plasma_energy")[0]!);
    expect(zoneIds(s, "player1", "discard")).toContain(striker.instanceId);
    expect(zoneIds(s, "player2", "discard")).toContain(plasma.instanceId);
    expect(s.players.player2.damage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-UNVERIFIED-02 公式エラッタページの網羅性", () => {
  // 08 章:「ライブ版の記載は RS-052・RS-009・RS-065・RS-003・RS-058・RS-018 の6件」
  it("R-ERR-UNVERIFIED-02: 公式エラッタページの記載は RS-052・RS-009・RS-065・RS-003・RS-058・RS-018 の6件だけ（出典: grnrngr/errata）", () => {
    const text = htmlText("www.grnrngr.com/documents/rangersstrike/faq/errata.html");
    const ids = [...new Set(text.match(/\b(?:RS|RK|XG\d?|SR)-\d{3}\b/g) ?? [])].sort();
    expect(ids).toEqual(["RS-003", "RS-009", "RS-018", "RS-052", "RS-058", "RS-065"]);
  });

  // 08 章:「atwiki が「公式HPでエラッタが発表」とする RS-036・XG3-072 は、取得済みの公式ページ（grnrngr）のどこにも見つからない」
  it("R-ERR-UNVERIFIED-02: atwiki が「公式HPでエラッタ発表」とする RS-036・XG3-072 は公式エラッタページにない（出典: grnrngr/errata）", () => {
    const text = htmlText("www.grnrngr.com/documents/rangersstrike/faq/errata.html");
    expect(text).not.toContain("RS-036");
    expect(text).not.toContain("XG3-072");
  });

  it.todo(
    "R-ERR-UNVERIFIED-02: RS-036 のエラッタ告知の原ページ（[未確定]、08章 §3 — 取得済み公式ページに見つからない）",
  );
  it.todo(
    "R-ERR-UNVERIFIED-02: XG 系（XG1〜XG6）カードの読み替えを grnrngr 側の原ページで照合（[未確定]、08章 §3 — 公式FAQに項目がない）",
  );
});
