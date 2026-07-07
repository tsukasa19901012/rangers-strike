import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * hollow keyword ラチェット:
 * grant_keyword がエンジンで未消費のキーワードは allowlist にあるものだけ許す。
 * 新たな未消費キーワード（実装漏れ）が増えたら fail する。
 * 実装したら allowlist から削除して前進を固定する。
 */
describe("hollow keyword ratchet", () => {
  it("does not add new unconsumed keywords", () => {
    const allow = new Set(
      readFileSync(join(__dirname, "testing/hollowKeywordAllowlist.txt"), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );
    const out = execFileSync("node", [join(__dirname, "../scripts/audit-hollow-keywords.mjs")], {
      encoding: "utf8",
    });
    const current = out
      .split("\n")
      .slice(2)
      .map((l) => l.trim().split(/\s+/)[1])
      .filter((k): k is string => !!k);
    const newOnes = current.filter((k) => !allow.has(k));
    expect(newOnes, `未実装キーワードが増えています: ${newOnes.join(", ")}`).toEqual([]);
  });
});
