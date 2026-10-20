import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCardById } from "../../src/dsl/loader";
import {
  auditSourceEffectCoverage,
  DEFAULT_ATWIKI_SOURCE_DIR,
  indexAtwikiSources,
  runSourceEffectCoverageAudit,
} from "./sourceEffectCoverage";

const E7_CARD_IDS = [
  "PR-015",
  "PR-016",
  "RK-140",
  "RK-334",
  "RS-230",
  "RS-288",
  "XG1-028",
  "XG1-029",
  "XG1-030",
  "XG1-062",
  "XG3-005",
  "XG5-014",
  "XG6-015",
];

const source = (text: string) => ({
  file: "page-1-TST-001.md",
  raw: `# test\n\n---\n\n種類：Sユニット\n\nテキスト:\n\n${text}\n\nフレーバーテキスト\n\nx`,
});

describe("auditSourceEffectCoverage（E7: 原文に効果があるのに効果定義0件）", () => {
  it("原文に効果テキストがあり effects / unnamedRules が 0 件のカードを検出する", () => {
    const report = auditSourceEffectCoverage(
      [{ id: "TST-001", text: "", effects: [], unnamedRules: [] }],
      () => source("【テスト】「SP1」"),
    );
    expect(report.noDefinitions.map((e) => e.cardId)).toEqual(["TST-001"]);
  });

  it("unnamedRules だけのカード（例: 合体行）は効果定義ありとみなす", () => {
    const report = auditSourceEffectCoverage(
      [
        {
          id: "TST-001",
          text: "合体―A＋B",
          unnamedRules: [{ kind: "zord", text: "合体―A＋B", partnerCardIds: [] }],
        },
      ],
      () => source("合体―A＋B"),
    );
    expect(report.noDefinitions).toEqual([]);
  });

  it("原文がバニラ（テキストなし／「なし」）なら検出しない", () => {
    const docs = [{ id: "TST-001", text: "" }];
    expect(auditSourceEffectCoverage(docs, () => source("なし")).noDefinitions).toEqual([]);
    expect(
      auditSourceEffectCoverage(docs, () => ({ file: "f.md", raw: "種類：Sユニット" }))
        .noDefinitions,
    ).toEqual([]);
  });

  it("効果定義はあるがカタログ text が空のカードは参考扱い（失敗にしない）", () => {
    const report = auditSourceEffectCoverage(
      [
        {
          id: "TST-001",
          text: "",
          effects: [
            { id: "x", trigger: { type: "nc" }, effects: [{ type: "draw", amount: 1 }] },
          ],
        },
      ],
      () => source("【テスト】1枚ひく。"),
    );
    expect(report.noDefinitions).toEqual([]);
    expect(report.emptyCatalogText.map((e) => e.cardId)).toEqual(["TST-001"]);
  });
});

describe("full-playable の原文照合", () => {
  const report = runSourceEffectCoverageAudit("full-playable");

  it("原文に効果テキストがあるのに効果定義 0 件のカードはない", () => {
    expect(report.missingSource).toEqual([]);
    expect(report.noDefinitions.map((e) => e.cardId)).toEqual([]);
  });

  it("E7 の 13 枚は原文に効果テキストがあり、効果定義とカタログ text を持つ", () => {
    const index = indexAtwikiSources();
    const e7 = auditSourceEffectCoverage(
      E7_CARD_IDS.map((id) => loadCardById(id)),
      (id) => {
        const file = index.get(id);
        return file
          ? { file, raw: readFileSync(join(DEFAULT_ATWIKI_SOURCE_DIR, file), "utf8") }
          : undefined;
      },
    );
    expect(e7.missingSource).toEqual([]);
    expect(e7.withSourceText).toBe(E7_CARD_IDS.length);
    expect(e7.noDefinitions).toEqual([]);
    expect(e7.emptyCatalogText).toEqual([]);
  });
});
