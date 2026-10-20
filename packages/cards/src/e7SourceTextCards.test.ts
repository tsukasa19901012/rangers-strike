/**
 * E7: 原文に効果テキストがあるのにカタログ text が空・DSL 効果 0 件でバニラとして動いていた 13 枚。
 * 原因は atwiki スナップショットの見出しが「テキスト:」（半角）や「テキスト」（コロンなし）で、
 * docs/wiki/scripts/sync-cards-from-atwiki.mjs が「テキスト：」（全角）しか拾っていなかったこと。
 */
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "./extendedCatalog";
import { loadCardById } from "./dsl/loader";
import { splitEffectSegments } from "./pipeline/parseWiki";

const E7_CARDS: Record<string, string> = {
  "PR-015": "バイオ粒子斬り",
  "PR-016": "アバレスラッシュ",
  "RK-140": "電車斬り",
  "RK-334": "電車斬り",
  "RS-230": "アバレスラッシュ",
  "RS-288": "ドラゴンハーレー",
  "XG1-028": "アバレンオーになりかけだから…",
  "XG1-029": "無敵の竜人魂",
  "XG1-030": "キラークロー",
  "XG1-062": "ワイルドサイクロン",
  "XG3-005": "マックスノバ",
  "XG5-014": "マックスビクトリープロミネンス",
  "XG6-015": "爆竜必殺チョキチョキシザース",
};

function primitives(cardId: string, effectId: string) {
  return loadCardById(cardId).effects?.find((e) => e.id === effectId);
}

describe("E7 効果なしで動いていた 13 枚", () => {
  it.each(Object.entries(E7_CARDS))("%s はカタログ text と効果定義を持つ", (cardId, effectName) => {
    const def = fullPlayableCatalog.cards.find((c) => c.id === cardId);
    expect(def?.text, cardId).toContain(`【${effectName}】`);

    const doc = loadCardById(cardId);
    expect(doc.text).toContain(`【${effectName}】`);
    const definitions = (doc.effects?.length ?? 0) + (doc.unnamedRules?.length ?? 0);
    expect(definitions, cardId).toBeGreaterThan(0);
    expect(doc.effects?.some((e) => e.name === effectName), cardId).toBe(true);
  });

  // ルール: R-DESTROY-01 / R-DESTROY-02 — 「撃破されて捨札になったとき」誘発。NC（ナンバーコンビネーション）ではない。
  it.each([
    ["RS-230", "recruit_abaredo_on_destroy"],
    ["PR-016", "recruit_abaredo_on_destroy"],
    ["XG1-029", "recruit_from_discard_on_destroy"],
    ["XG1-030", "recruit_from_discard_on_destroy"],
    ["XG1-062", "recruit_from_discard_on_destroy"],
  ])("%s の撃破時リクルートは on_destroy で名前指定の蘇生キーワードを使う", (cardId, effectId) => {
    const effect = primitives(cardId, effectId);
    expect(effect?.trigger).toEqual({ type: "on_destroy" });
    expect(effect?.effects).toEqual([
      { type: "grant_keyword", keyword: "on_destroy_reanimate_named_from_discard", duration: "turn" },
    ]);
  });

  it("RS-230 / PR-016 は毎ターンのバトル進入と NC「SP1」を持つ", () => {
    for (const id of ["RS-230", "PR-016"]) {
      const doc = loadCardById(id);
      expect(doc.unnamedRules?.some((r) => r.kind === "note" && r.rule === "auto_battle_entry_each_turn")).toBe(true);
      // ルール: R-CN-02 — 効果名テキストはナンバーコンビネーションで発動
      expect(primitives(id, "abaresurashu")?.trigger).toEqual({ type: "nc" });
    }
  });

  // ルール: R-ADD-06 — 合体行は unnamedRules.zord（素材カード ID 付き）
  it.each([["PR-015"], ["XG1-028"], ["XG3-005"]])("%s は合体行を unnamedRules.zord に持つ", (cardId) => {
    const zord = loadCardById(cardId).unnamedRules?.find((r) => r.kind === "zord");
    expect(zord?.kind).toBe("zord");
    expect(zord && "partnerCardIds" in zord ? zord.partnerCardIds?.length : 0).toBeGreaterThan(0);
  });

  it("PR-015 【バイオ粒子斬り】は通常版 RS-127 と同じくバトルエリアに出るとき（enter_battle）", () => {
    expect(primitives("PR-015", "bio_particle_slash")?.trigger).toEqual({ type: "enter_battle" });
    expect(primitives("RS-127", "bio_particle_slash")?.trigger).toEqual({ type: "enter_battle" });
  });

  // ルール: R-KW-RESIST-01 / R-KW-WING-01 / R-KW-BLAST-01 — ※キーワード
  it.each([
    ["XG1-028", "register"],
    ["XG5-014", "register"],
    ["XG1-030", "wing"],
    ["XG3-005", "blast"],
    ["XG6-015", "require_command_hold_entry"],
  ])("%s は ※キーワード %s を常時効果で持つ", (cardId, keyword) => {
    const doc = loadCardById(cardId);
    expect(
      doc.effects?.some(
        (e) =>
          e.trigger.type === "while_in_field" &&
          e.effects.some((p) => p.type === "grant_keyword" && p.keyword === keyword),
      ),
    ).toBe(true);
  });

  it("XG1-030 【キラークロー】は NC で「SP1」と BP+2000（RS-031 と同形）", () => {
    const effect = primitives("XG1-030", "kirakuro");
    expect(effect?.trigger).toEqual({ type: "nc" });
    expect(effect?.effects).toEqual([
      { type: "grant_keyword", keyword: "SP1", duration: "turn" },
      { type: "modify_bp", target: { type: "trigger_source" }, amount: 2000, duration: "turn" },
    ]);
  });

  it("XG1-029 【無敵の竜人魂】の対象は敵軍バトルエリアの BP8000 以下の L ユニット", () => {
    const effect = primitives("XG1-029", "no");
    expect(effect?.trigger).toEqual({ type: "nc" });
    // 対象（本来BP8000以下の L）と「DA なら SP1」は engine の rules/errataCardEffects.ts が処理する
    // （挙動テスト: packages/engine/src/errataCardEffects.test.ts）。
    expect(effect?.effects[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "effect_card::XG1-029::no",
    });
  });

  it("CN なしの XG3-005 / XG5-014 の効果名テキストは常時効果", () => {
    expect(primitives("XG3-005", "makusunoba")?.effects[0]).toMatchObject({
      keyword: "sp_plus1_per_own_discard_6",
    });
    const xg5014 = loadCardById("XG5-014").effects?.map((e) => e.effects[0]);
    expect(xg5014).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "sp1_if_no_own_discard_s_unit" }),
        expect.objectContaining({ keyword: "bp_per_own_rush_s_1000_own_turn" }),
      ]),
    );
  });
});

describe("splitEffectSegments: ※が落ちた先頭の注記（XG1-030）", () => {
  it("先頭の「。」で終わる無印の文を注記として扱う", () => {
    const segments = splitEffectSegments(
      "これが撃破されて捨札になったとき、自軍捨札から「アバレキラー」のカードを1枚選び、自軍ラッシュエリアに出す。 ※ウイング 【キラークロー】「SP1」",
    );
    expect(segments[0]).toEqual({
      kind: "note",
      body: "※これが撃破されて捨札になったとき、自軍捨札から「アバレキラー」のカードを1枚選び、自軍ラッシュエリアに出す。",
    });
    expect(segments).toHaveLength(3);
  });

  it("合体行は注記にしない（unnamedRules.zord で扱う）", () => {
    const segments = splitEffectSegments("合体―バイオジェット1号＋バイオジェット2号 【バイオ粒子斬り】効果。");
    expect(segments.map((s) => s.kind)).toEqual(["named"]);
  });
});
