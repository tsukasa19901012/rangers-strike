/**
 * 特徴名入り grant_keyword の可逆化（旧: 漢字の特徴がすべて `fx_unknown` に潰れていた）。
 *
 * 出典（各カードの ※／効果テキスト。docs/wiki/sources/atwiki/page-N-<ID>.md）:
 *  - RS-481 天空神 page-805 / RS-482 page-806 / RS-385 page-530「特徴「航空機」を持たないユニットにアタックされない」
 *  - RS-488 page-810「特徴「忍者」を持つ自軍SユニットはＲＣを持っていなくてもこのビークルにライドできる」
 *  - RM-052 page-862「特徴「昆虫」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくても…」
 *  - RK-310 page-1279「特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される」
 *  - RS-289 page-416「特徴「恐竜」を持つすべての自軍ユニットはBP＋1000される」
 *  - RK-029 page-217「特徴「警察」を持つユニット1体につきBP+1000される」
 *  - RK-056 page-160「特徴「戦闘員」を持つ自軍ユニットは、バトルエリアで4番目に並んだとき「SP1」になる」
 *  - RK-278 page-1382「自軍捨札に特徴「女」を持つユニットカードがあれば次の能力を得る⇒レジスト」
 *  - RS-242 page-56「特徴「戦闘員」を持つユニットのカードをラッシュするとき、コマンドをホールドせずに…」
 *  - RS-249 page-421「特徴「恐竜」を持つユニットカードを1枚選び、ラッシュエリアに出す」
 *  - RS-281 page-469「特徴「女」を持つユニットが1体もなければ、このユニットを手札に戻す」
 *  - SR-003 page-46「特徴「恐竜」を持つカード1枚につきBP＋1000される」
 *  - XG3-072 page-1963「特徴「男」を持つ敵軍ユニットを1体選び撃破する」
 *  - RK-323 page-1348「特徴「魔皇力」を持つ自軍Sユニットは、RCを持っていなくても…」
 *  - RS-216 page-385「特徴「車両」を持つ自軍ユニットがなければ…」
 *  - SX-004 page-2157「特徴「車両」を持つビークルにライドできる」
 *  - XG2-042 page-1687「特徴「仮面ライダー」を持つカードを1枚選び捨札にすれば、その場に留まる」
 */
import { describe, expect, it } from "vitest";
import { allCardsCatalog } from "@rangers-strike/cards";
import { getCardDslDocument } from "./effectLookup";
import {
  FEATURE_KEYWORDS,
  decodeFeatureKeywordSlug,
  featureKeyword,
  featureKeywordSlug,
  featureMatchesKeywordSlug,
} from "./featureKeywords";
import { decodeRideWithoutRcFeature, listRideWithoutRcFeatures } from "./promotedKeywordBridge";
import {
  attackTargets,
  deckCards,
  effectiveBp,
  inst,
  st,
  sUnit,
} from "../cardSpec/RS6-369-389.helpers";

function grantKeywords(cardId: string): string[] {
  const out: string[] = [];
  for (const effect of getCardDslDocument(cardId)?.effects ?? []) {
    for (const p of effect.effects) if (p.type === "grant_keyword") out.push(p.keyword);
  }
  return out;
}

describe("feature keyword slug（可逆エンコード）", () => {
  it("漢字の特徴は feat_<utf8 hex> になり、元の特徴名に戻せる", () => {
    for (const feature of ["航空機", "忍者", "警察", "女", "男", "恐竜", "昆虫", "加速", "戦闘員", "仮面ライダー", "魔皇力"]) {
      const slug = featureKeywordSlug(feature);
      expect(slug).toMatch(/^feat_[0-9a-f]+$/);
      expect(decodeFeatureKeywordSlug(slug)).toBe(feature);
      expect(featureMatchesKeywordSlug(feature, slug)).toBe(true);
    }
    expect(featureKeywordSlug("航空機")).toBe("feat_e888aae7a9bae6a99f");
  });

  it("かなだけの特徴は従来どおりのローマ字 slug（既存キーワードを変えない）", () => {
    expect(featureKeywordSlug("メカ")).toBe("meka");
    expect(featureKeywordSlug("スワット")).toBe("suwato");
    expect(featureMatchesKeywordSlug("メカ", "meka")).toBe(true);
    expect(featureMatchesKeywordSlug("メカ", "feat_e888aae7a9bae6a99f")).toBe(false);
  });

  it("カタログの全特徴で slug が衝突しない", () => {
    const bySlug = new Map<string, string>();
    for (const card of allCardsCatalog.cards) {
      for (const feature of card.features ?? []) {
        const slug = featureKeywordSlug(feature);
        const prev = bySlug.get(slug);
        if (prev !== undefined && prev !== feature.normalize("NFKC").trim()) {
          throw new Error(`slug collision: ${prev} / ${feature} -> ${slug}`);
        }
        bySlug.set(slug, feature.normalize("NFKC").trim());
      }
    }
    expect(bySlug.size).toBeGreaterThan(50);
  });

  it("エンジンが名指しする特徴キーワード定数はパイプラインの slug と一致する", () => {
    expect(FEATURE_KEYWORDS.holdEntryDestroyMale).toBe(featureKeyword("hold_entry_destroy_", "男"));
    expect(FEATURE_KEYWORDS.bpPerDiscardDinosaur).toBe(
      featureKeyword("bp_plus_per_discard_feature_", "恐竜", "_1000_sp_at_8000"),
    );
    expect(FEATURE_KEYWORDS.canRideVehicleCar).toBe(featureKeyword("can_ride_vehicle_", "車両"));
    expect(FEATURE_KEYWORDS.registerStayKamenRider).toBe(
      featureKeyword("register_stay_on_power_discard_", "仮面ライダー"),
    );
    expect(FEATURE_KEYWORDS.powerFaceupKamenRiderEnterBattle).toBe(
      featureKeyword("power_faceup_", "仮面ライダー", "_enter_battle"),
    );
  });
});

describe("生成 DSL: 各キーワード族の特徴がカードテキストどおりに復元できる", () => {
  const cases: Array<[cardId: string, prefix: string, feature: string, suffix?: string]> = [
    ["RS-481", "no_attack_without_", "航空機"],
    ["RS-482", "no_attack_without_", "航空機"],
    ["RS-385", "no_attack_without_", "航空機"],
    ["RS-488", "ride_without_rc_", "忍者"],
    ["RS-406", "ride_without_rc_", "警察"],
    ["RK-300", "ride_without_rc_", "加速"],
    ["RK-323", "ride_without_rc_", "魔皇力"],
    ["RM-052", "ride_command_without_rc_", "昆虫"],
    ["RK-310", "destroy_on_win_vs_", "女"],
    ["RK-029", "per_ally_", "警察", "_bp_1000"],
    ["RK-056", "battle_position_sp_", "戦闘員", "_pos4_sp1"],
    ["RK-278", "register_if_discard_has_feature_", "女"],
    ["RS-242", "rush_skip_command_hold_", "戦闘員"],
    ["RS-281", "end_turn_return_hand_if_no_", "女"],
    ["RS-289", "ally_", "恐竜", "_bp_boost_1000"],
    ["SR-003", "bp_plus_per_discard_feature_", "恐竜", "_1000_sp_at_8000"],
    ["XG3-072", "hold_entry_destroy_", "男"],
    ["RS-216", "end_turn_return_if_no_", "車両"],
    ["SX-004", "can_ride_vehicle_", "車両"],
    ["XG2-042", "register_stay_on_power_discard_", "仮面ライダー"],
  ];

  it.each(cases)("%s: %s<%s>", (cardId, prefix, feature, suffix = "") => {
    const keywords = grantKeywords(cardId);
    expect(keywords.some((k) => k.includes("fx_unknown"))).toBe(false);
    const expected = `${prefix}${featureKeywordSlug(feature)}${suffix}`;
    expect(keywords).toContain(expected);
    const slug = expected.slice(prefix.length, expected.length - suffix.length);
    expect(decodeFeatureKeywordSlug(slug)).toBe(feature);
  });

  it("全カードの DSL に特徴由来の fx_unknown キーワードが残っていない", () => {
    const offenders: string[] = [];
    for (const card of allCardsCatalog.cards) {
      for (const effect of getCardDslDocument(card.id)?.effects ?? []) {
        if (!/特徴「/.test(effect.text ?? "")) continue;
        for (const p of effect.effects) {
          if (p.type === "grant_keyword" && /(?:^|_)fx_unknown(?:_|$)/.test(p.keyword) && !/fx_unknown_[0-9a-f]{6}$|fx_unknown_\d+$/.test(p.keyword)) {
            offenders.push(`${card.id}:${p.keyword}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("エンジンが特徴キーワードを正しく読む", () => {
  it("RS-481 天空神 ※ 特徴「航空機」を持たないユニットにアタックされない（出典: atwiki/page-805）", () => {
    const plain = sUnit("SPEC-PLAIN", { features: ["メカ"], bp: 9000 });
    const plane = sUnit("SPEC-PLANE", { features: ["航空機"], bp: 9000 });
    const s = st(
      {
        player1: { battle: [inst("SPEC-PLAIN", "p"), inst("SPEC-PLANE", "j")], deck: deckCards(3) },
        player2: { battle: [inst("RS-481", "t"), inst("TST-UNIT-0", "e")] },
      },
      [plain, plane],
    );
    expect(attackTargets(s, "SPEC-PLAIN:p")).not.toContain("RS-481:t");
    expect(attackTargets(s, "SPEC-PLAIN:p")).toContain("TST-UNIT-0:e");
    expect(attackTargets(s, "SPEC-PLANE:j")).toContain("RS-481:t");
  });

  it("RS-488 ※ RC 不要ライドの特徴「忍者」がキーワードから復元される（出典: atwiki/page-810）", () => {
    const keyword = grantKeywords("RS-488").find((k) => k.startsWith("ride_without_rc_"))!;
    expect(decodeRideWithoutRcFeature(keyword)).toBe("忍者");
    expect(listRideWithoutRcFeatures("RS-488")).toEqual(["忍者"]);
  });

  it("RS-289 特徴「恐竜」を持つすべての自軍ユニットは BP＋1000（出典: atwiki/page-416）", () => {
    const dino = sUnit("SPEC-DINO", { features: ["恐竜"], bp: 3000 });
    const other = sUnit("SPEC-OTHER", { features: ["メカ"], bp: 3000 });
    const s = st(
      {
        player1: { rush: [inst("RS-289", "z")], battle: [inst("SPEC-DINO", "d"), inst("SPEC-OTHER", "o")], deck: deckCards(3) },
      },
      [dino, other],
    );
    const d = s.players.player1.battle.find((c) => c.instanceId === "SPEC-DINO:d")!;
    const o = s.players.player1.battle.find((c) => c.instanceId === "SPEC-OTHER:o")!;
    expect(effectiveBp(s, "player1", d)).toBe(4000);
    expect(effectiveBp(s, "player1", o)).toBe(3000);
  });
});
