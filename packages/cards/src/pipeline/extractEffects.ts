import type { EffectDefinition, EffectPrimitive } from "../dsl/types";
import type {
  CardAnalysis,
  ExtractedEffect,
  ExtractedTrigger,
  WikiEffectSegment,
  WikiParseResult,
} from "./types";
import {
  aliasKeywordFromText,
  hashEffectText,
  noteEffectIdFromBody,
  sanitizeEffectId,
  slugifyEffectId,
} from "./metaMaps";

type ZoneTarget = Extract<EffectPrimitive, { type: "move" }>["target"];

function zone(
  z: "deck" | "hand" | "discard" | "power" | "command" | "rush" | "battle",
  owner: "self" | "opponent" | "any",
  filter?: { size?: "S"; maxBp?: number },
): ZoneTarget {
  const t: ZoneTarget = { type: "zone", zone: z, owner };
  if (filter) t.filter = filter;
  return t;
}

function chooseUnit(valid: ZoneTarget, count: number, then: EffectPrimitive[]) {
  return { type: "choose" as const, kind: "select_unit" as const, valid, count, then };
}

type PatternMatch = {
  pattern: string;
  test: (body: string, segment: WikiEffectSegment) => boolean;
  build: (
    body: string,
    segment: WikiEffectSegment,
    trigger: EffectDefinition["trigger"],
  ) => Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> | null;
};

function keywordNoteMatch(
  pattern: string,
  keyword: string,
  test: RegExp,
): PatternMatch {
  return {
    pattern,
    test: (body) => test.test(body),
    build: (body) => ({
      id: `unnamed_${keyword}`,
      text: body,
      trigger: { type: "while_in_field" },
      effects: [{ type: "grant_keyword", keyword, duration: "permanent" }],
      matchedPattern: pattern,
    }),
  };
}

const KEYWORD_NOTE_PATTERNS: PatternMatch[] = [
  keywordNoteMatch("wing_note", "wing", /^※ウイング/),
  keywordNoteMatch("chase_note", "chase", /^※チェイス/),
  keywordNoteMatch("resident_note", "resident", /^※常駐/),
  keywordNoteMatch("deck_unlimited_note", "deck_unlimited", /^※このカードはデッキに好きな枚数/),
  keywordNoteMatch("cross1_note", "cross1", /^※クロス1/),
  keywordNoteMatch("blast_note", "blast", /^※ブラスト/),
  keywordNoteMatch("breaker_note", "breaker", /^※ブレイカー/),
  keywordNoteMatch("cannot_attack_note", "cannot_attack", /^※これはアタックすることができない/),
  keywordNoteMatch(
    "cannot_enter_battle_note",
    "cannot_enter_battle",
    /^※これはバトルエリアに出られない/,
  ),
  keywordNoteMatch(
    "no_battle_rush_turn_note",
    "no_battle_rush_turn",
    /^※これはラッシュしたターンにバトルエリアに出られない/,
  ),
  keywordNoteMatch(
    "not_selectable_except_attack_note",
    "not_selectable_except_attack",
    /^※これはアタックされる以外では相手に選ばれない/,
  ),
  keywordNoteMatch("scrum_note", "scrum", /^※スクラム/),
  keywordNoteMatch("tag_note", "tag", /^※タッグ/),
  keywordNoteMatch("destroy_on_enter_note", "destroy_on_enter_battle", /^※これはバトルエリアに出たとき撃破される/),
  keywordNoteMatch(
    "destroy_on_win_sp_note",
    "destroy_on_win_vs_sp1",
    /^※これは敵軍ターン中.*バトルに勝っても撃破される/,
  ),
  keywordNoteMatch(
    "to_power_on_destroy_note",
    "to_power_on_destroy",
    /^※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに/,
  ),
  keywordNoteMatch("no_attack_from_s_note", "no_attack_from_s", /^※これはSユニットにアタックされない/),
  keywordNoteMatch(
    "no_strike_enemy_battle_note",
    "no_strike_if_enemy_battle",
    /^※敵軍バトルエリアにユニットがあるとき、これはストライクできない/,
  ),
  keywordNoteMatch(
    "no_enter_own_turn_note",
    "no_enter_battle_own_turn",
    /^※これは自軍ターン中バトルエリアに出られない/,
  ),
  keywordNoteMatch(
    "no_strike_after_rideoff_note",
    "no_strike_after_rideoff",
    /^※これはライドオフしたときストライクできない/,
  ),
  keywordNoteMatch(
    "no_ride_while_held_note",
    "no_ride_while_held",
    /^※これはホールド状態のときビークルにライドできない/,
  ),
  keywordNoteMatch("not_selectable_note", "not_selectable", /^※これは相手に選ばれない/),
  keywordNoteMatch(
    "cannot_attack_enemy_battle_note",
    "cannot_attack_enemy_battle",
    /^※これは敵軍バトルエリアのユニットにアタックできない/,
  ),
  keywordNoteMatch(
    "wing_attack_rush_note",
    "wing_attack_enemy_rush",
    /^※これは敵軍ラッシュエリアのユニットにアタックできる/,
  ),
  {
    pattern: "wing_attack_rush_body",
    test: (body) => /^これは敵軍ラッシュエリアのユニットにアタックできる/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "wing_attack_enemy_rush",
      name: segment.name,
      text: body,
      trigger,
      effects: [
        { type: "grant_keyword", keyword: "wing_attack_enemy_rush", duration: "permanent" },
      ],
      matchedPattern: "wing_attack_rush_body",
    }),
  },
  {
    pattern: "ride_bp_boost_note",
    test: (body) => /^※これにライドしているユニットはBP[＋+](\d+)される/.test(body),
    build: (body) => {
      const amount = body.match(/BP[＋+](\d+)/)?.[1] ?? "500";
      const keyword = `ride_bp_boost_${amount}`;
      return {
        id: `unnamed_${keyword}`,
        text: body,
        trigger: { type: "while_in_field" },
        effects: [{ type: "grant_keyword", keyword, duration: "permanent" }],
        matchedPattern: "ride_bp_boost_note",
      };
    },
  },
  {
    pattern: "attacked_bp_boost_note",
    test: (body) => /^※これはアタックされるときBP[＋+](\d+)される/.test(body),
    build: (body) => {
      const amount = body.match(/BP[＋+](\d+)/)?.[1] ?? "1000";
      const keyword = `attacked_bp_boost_${amount}`;
      return {
        id: `unnamed_${keyword}`,
        text: body,
        trigger: { type: "while_in_field" },
        effects: [{ type: "grant_keyword", keyword, duration: "permanent" }],
        matchedPattern: "attacked_bp_boost_note",
      };
    },
  },
  keywordNoteMatch("rush_hand_only_note", "rush_from_hand_only", /^※これは手札からしかラッシュできない/),
  keywordNoteMatch(
    "no_attack_da_note",
    "cannot_attack_non_da",
    /^※これはDAを持たないユニットにアタックすることができない/,
  ),
  keywordNoteMatch(
    "no_attack_enemy_s_note",
    "no_attack_from_enemy_s",
    /^※これは敵軍Sユニットにアタックされない/,
  ),
  keywordNoteMatch(
    "no_attack_s_target_note",
    "cannot_attack_s",
    /^※これはSユニットにアタックすることができない/,
  ),
  keywordNoteMatch(
    "no_strike_held_command_note",
    "no_strike_with_held_command",
    /^※ホールド状態のコマンドがあるとき、これはストライクできない/,
  ),
  keywordNoteMatch(
    "no_enter_own_turn_battle_note",
    "no_enter_battle_own_turn",
    /^※これは自軍ターン中、バトルエリアに出られない/,
  ),
  keywordNoteMatch(
    "category_wb_in_battle_note",
    "category_wb_in_battle",
    /^※これはバトルエリアにあるとき、カテゴリにWBが追加される/,
  ),
  keywordNoteMatch(
    "ride_bp_1000_note",
    "ride_bp_boost_1000",
    /^※これはライド中、BP\+1000される|^※これはライド中、BP＋1000される/,
  ),
  keywordNoteMatch(
    "enter_without_ride_note",
    "can_enter_battle_without_ride",
    /^※これは、自軍Sユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出ることができる/,
  ),
  keywordNoteMatch(
    "fusion_vehicle_note",
    "fusion_vehicle_alias",
    /^※このビークルは合体ユニットとしてつかえる/,
  ),
  keywordNoteMatch(
    "undead_command_hold_note",
    "undead_command_rush_hold",
    /^※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる/,
  ),
  {
    pattern: "per_enemy_s_bp_boost",
    test: (body) => /敵軍Sユニット1体につきBP[＋+](\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = Number(body.match(/BP[＋+](\d+)される/)?.[1] ?? 1000);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `per_enemy_s_bp_${amount}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `per_enemy_s_bp_boost_${amount}`,
            duration: "turn",
          },
        ],
        matchedPattern: "per_enemy_s_bp_boost",
      };
    },
  },
  {
    pattern: "on_skip_attack_combo_bp",
    test: (body) =>
      /アタックしなかったとき.*コンビネーションするSユニットのBPは、このユニットのBPを「＋」した値になる/.test(
        body,
      ),
    build: (body, segment) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "on_skip_attack_combo_bp",
      name: segment.name,
      text: body,
      trigger: { type: "on_attack" },
      effects: [
        {
          type: "grant_keyword",
          keyword: "combo_bp_from_skipped_attack",
          duration: "turn",
        },
      ],
      matchedPattern: "on_skip_attack_combo_bp",
    }),
  },
  ...(["taxis", "lead", "call"] as const).flatMap((prefix) => {
    const regex = new RegExp(`^※${prefix === "taxis" ? "タクス" : prefix === "lead" ? "リード" : "コール"}(MA|ET|DA|WB|OT)`);
    return [
      {
        pattern: `${prefix}_category_note`,
        test: (body: string) => regex.test(body),
        build: (body: string) => {
          const cat = body.match(regex)?.[1] ?? "MA";
          const keyword = `${prefix}_${cat}`;
          return {
            id: `unnamed_${keyword}`,
            text: body,
            trigger: { type: "while_in_field" as const },
            effects: [{ type: "grant_keyword" as const, keyword, duration: "permanent" as const }],
            matchedPattern: `${prefix}_category_note`,
          };
        },
      } satisfies PatternMatch,
    ];
  }),
];

const PATTERNS: PatternMatch[] = [
  {
    pattern: "no_effect",
    test: (body) => /^なし\.?$/.test(body.trim()) || body.trim().length === 0,
    build: (_body, segment, trigger) => ({
      id: "no_effect",
      text: segment.body,
      trigger,
      effects: [],
      matchedPattern: "no_effect",
    }),
  },
  {
    pattern: "resist_note",
    test: (body) => /^※レジスト/.test(body),
    build: (body) => ({
      id: "unnamed_register",
      text: body,
      trigger: { type: "while_in_field" },
      effects: [{ type: "grant_keyword", keyword: "register", duration: "permanent" }],
      matchedPattern: "resist_note",
    }),
  },
  {
    pattern: "morph_note",
    test: (body) => /^※モーフ/.test(body),
    build: (body) => ({
      id: "unnamed_morph",
      text: body,
      trigger: { type: "while_in_field" },
      effects: [{ type: "grant_keyword", keyword: "morph", duration: "permanent" }],
      matchedPattern: "morph_note",
    }),
  },
  {
    pattern: "require_command_hold_entry",
    test: (body) => /^※これは自軍コマンドを(\d+)つホールドしなければバトルエリアに出られない/.test(body),
    build: (body) => ({
      id: "require_command_hold_entry",
      text: body,
      trigger: { type: "while_in_field" },
      effects: [
        {
          type: "grant_keyword",
          keyword: "require_command_hold_entry",
          duration: "permanent",
        },
      ],
      matchedPattern: "require_command_hold_entry",
    }),
  },
  ...KEYWORD_NOTE_PATTERNS,
  {
    pattern: "grant_sp_in_text",
    test: (body) => /「SP(\d+)」(?:\/\d+)?/.test(body) && !/^※/.test(body.trim()),
    build: (body, segment, trigger) => {
      const n = body.match(/SP(\d+)/)?.[1] ?? "1";
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `grant_sp${n}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [{ type: "grant_keyword", keyword: `SP${n}`, duration: "turn" }],
        matchedPattern: "grant_sp_in_text",
      };
    },
  },
  {
    pattern: "deal_damage_opponent",
    test: (body) => /相手に(\d+)点ダメージを与える/.test(body),
    build: (body, segment, trigger) => {
      const amount = Number(body.match(/(\d+)点ダメージ/)?.[1] ?? 1);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `deal_damage_${amount}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [{ type: "deal_damage", amount, target: "opponent" }],
        matchedPattern: "deal_damage_opponent",
      };
    },
  },
  {
    pattern: "bp_boost_ally_s",
    test: (body) =>
      /自軍Sユニットを1体選ぶ。このターン、選んだユニットはBP[＋+](\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = Number(body.match(/BP[＋+](\d+)される/)?.[1] ?? 1000);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `bp_boost_ally_${amount}`,
        name: segment.name,
        text: body,
        trigger,
        condition: {
          type: "has_target",
          target: zone("battle", "self", { size: "S" }),
        },
        effects: [
          chooseUnit(zone("battle", "self", { size: "S" }), 1, [
            {
              type: "modify_bp",
              target: { type: "trigger_source" },
              amount,
              duration: "turn",
            },
          ]),
        ],
        matchedPattern: "bp_boost_ally_s",
      };
    },
  },
  {
    pattern: "destroy_resist_enemy_s",
    test: (body) => /レジストを持つ敵軍Sユニットを1体選び撃破/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "destroy_resist_enemy_s",
      name: segment.name,
      text: body,
      trigger,
      condition: {
        type: "has_target",
        target: zone("battle", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("battle", "opponent", { size: "S" }), 1, [
          { type: "discard", target: { type: "trigger_source" } },
        ]),
      ],
      matchedPattern: "destroy_resist_enemy_s",
    }),
  },
  {
    pattern: "grant_sp_inline",
    test: (body) => /^「SP(\d+)」$/.test(body.trim()) || /^「SP(\d+)\/\d+」$/.test(body.trim()),
    build: (body, segment, trigger) => {
      const n = body.match(/SP(\d+)/)?.[1] ?? "1";
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `grant_sp${n}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [{ type: "grant_keyword", keyword: `SP${n}`, duration: "turn" }],
        matchedPattern: "grant_sp_inline",
      };
    },
  },
  {
    pattern: "place_in_power",
    test: (body) => /このカードを自軍パワーゾーンに置く/.test(body),
    build: (body, segment, trigger) => ({
      id: "place_in_power",
      name: segment.name,
      text: body,
      trigger,
      effects: [{ type: "move", target: { type: "self" }, to: "power" }],
      matchedPattern: "place_in_power",
    }),
  },
  {
    pattern: "draw_n",
    test: (body) => /自分は(\d+)枚ドローする/.test(body),
    build: (body, segment, trigger) => {
      const n = Number(body.match(/自分は(\d+)枚ドローする/)?.[1] ?? 1);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : "draw_cards",
        name: segment.name,
        text: body,
        trigger,
        effects: [{ type: "draw", amount: n, player: "controller" }],
        matchedPattern: "draw_n",
      };
    },
  },
  {
    pattern: "grant_sp",
    test: (body) => /^「SP(\d+)」/.test(body),
    build: (body, segment, trigger) => {
      const n = body.match(/^「SP(\d+)」/)?.[1] ?? "1";
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `grant_sp${n}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [{ type: "grant_keyword", keyword: `SP${n}`, duration: "turn" }],
        matchedPattern: "grant_sp",
      };
    },
  },
  {
    pattern: "alias_keyword",
    test: (body) => /^※これは「([^」]+)」としてつかえる/.test(body),
    build: (body) => {
      const keyword = aliasKeywordFromText(body);
      return {
        id: `unnamed_${keyword}`,
        text: body,
        trigger: { type: "while_in_field" },
        effects: [{ type: "grant_keyword", keyword, duration: "permanent" }],
        matchedPattern: "alias_keyword",
      };
    },
  },
  {
    pattern: "destroy_self_damage",
    test: (body) => /^※これが撃破されたとき、(\d+)点ダメージを受ける/.test(body),
    build: (body) => {
      const n = Number(body.match(/(\d+)点ダメージ/)?.[1] ?? 1);
      return {
        id: "unnamed_destroy_self_damage",
        text: body,
        trigger: { type: "while_in_field" },
        effects: [
          {
            type: "grant_keyword",
            keyword: `destroy_self_damage_${n}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "destroy_self_damage",
      };
    },
  },
  {
    pattern: "auto_battle_entry",
    test: (body) => /^※これは毎ターン、?可能ならバトルエリア\s*に出る/.test(body),
    build: (body) => ({
      id: "unnamed_auto_battle_entry_each_turn",
      text: body,
      trigger: { type: "while_in_field" },
      effects: [
        {
          type: "grant_keyword",
          keyword: "auto_battle_entry_each_turn",
          duration: "permanent",
        },
      ],
      matchedPattern: "auto_battle_entry",
    }),
  },
  {
    pattern: "discard_s_to_hand",
    test: (body) => /自軍捨札からSユニット1枚を選び、手札に加える/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "discard_s_unit_to_hand",
      name: segment.name,
      text: body,
      trigger,
      condition: { type: "has_target", target: zone("discard", "self", { size: "S" }) },
      effects: [
        chooseUnit(zone("discard", "self", { size: "S" }), 1, [
          { type: "move", target: { type: "trigger_source" }, to: "hand" },
        ]),
      ],
      matchedPattern: "discard_s_to_hand",
    }),
  },
  {
    pattern: "destroy_enemy_bp",
    test: (body) =>
      /敵軍バトルエリアからBP(\d+)以下のユニットを1体選んで撃破/.test(body) ||
      /これがバトルエリアに出たとき、敵軍バトルエリアからBP(\d+)以下のユニットを1体選んで撃破/.test(body),
    build: (body, segment, trigger) => {
      const maxBp = Number(body.match(/BP(\d+)以下/)?.[1] ?? 4000);
      const enter = /バトルエリアに出たとき/.test(body);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `destroy_enemy_bp${maxBp}`,
        name: segment.name,
        text: body,
        trigger: enter ? { type: "enter_battle" } : trigger,
        condition: {
          type: "has_target",
          target: zone("battle", "opponent", { maxBp }),
        },
        effects: [
          chooseUnit(zone("battle", "opponent", { maxBp }), 1, [
            { type: "discard", target: { type: "trigger_source" } },
          ]),
        ],
        matchedPattern: "destroy_enemy_bp",
      };
    },
  },
  {
    pattern: "move_enemy_to_power",
    test: (body) =>
      /敵軍バトルエリアからBP(\d+)以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const maxBp = Number(body.match(/BP(\d+)以下/)?.[1] ?? 8000);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : "armor_attack",
        name: segment.name,
        text: body,
        trigger: trigger.type === "nc" ? { type: "on_rush" } : trigger,
        optional: /発動できる/.test(body),
        condition: {
          type: "has_target",
          target: zone("battle", "opponent", { maxBp }),
        },
        effects: [
          chooseUnit(zone("battle", "opponent", { maxBp }), 1, [
            { type: "move", target: { type: "trigger_source" }, to: "power" },
          ]),
        ],
        matchedPattern: "move_enemy_to_power",
      };
    },
  },
  {
    pattern: "bp_boost_nc",
    test: (body) =>
      /このターン、これはBP[＋+](\d+)される/.test(body) &&
      !/選んだユニット/.test(body),
    build: (body, segment, trigger) => {
      const amount = Number(body.match(/BP[＋+](\d+)される/)?.[1] ?? 1000);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `bp_boost_${amount}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [
          {
            type: "modify_bp",
            target: { type: "trigger_source" },
            amount,
            duration: "turn",
          },
        ],
        matchedPattern: "bp_boost_nc",
      };
    },
  },
  {
    pattern: "deal_damage_self",
    test: (body) => /(\d+)点ダメージを(?:受ける|与える)/.test(body) && /自分/.test(body),
    build: (body, segment, trigger) => {
      const amount = Number(body.match(/(\d+)点ダメージ/)?.[1] ?? 1);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `deal_damage_${amount}`,
        name: segment.name,
        text: body,
        trigger,
        effects: [{ type: "deal_damage", amount, target: "controller" }],
        matchedPattern: "deal_damage_self",
      };
    },
  },
  {
    pattern: "enter_battle_draw",
    test: (body) => /バトルエリアに出たとき.*自分は(\d+)枚ドローする/.test(body),
    build: (body, segment) => {
      const n = Number(body.match(/自分は(\d+)枚ドローする/)?.[1] ?? 1);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : "enter_battle_draw",
        name: segment.name,
        text: body,
        trigger: { type: "enter_battle" },
        effects: [{ type: "draw", amount: n, player: "controller" }],
        matchedPattern: "enter_battle_draw",
      };
    },
  },
  {
    pattern: "enter_battle_deal_damage",
    test: (body) => /バトルエリアに出たとき.*相手に(\d+)点ダメージを与える/.test(body),
    build: (body, segment) => {
      const amount = Number(body.match(/(\d+)点ダメージ/)?.[1] ?? 1);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : "enter_battle_deal_damage",
        name: segment.name,
        text: body,
        trigger: { type: "enter_battle" },
        effects: [{ type: "deal_damage", amount, target: "opponent" }],
        matchedPattern: "enter_battle_deal_damage",
      };
    },
  },
  {
    pattern: "on_rush_bp_boost",
    test: (body) => /ラッシュしたとき.*このターン、これはBP[＋+](\d+)される/.test(body),
    build: (body, segment) => {
      const amount = Number(body.match(/BP[＋+](\d+)される/)?.[1] ?? 1000);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `on_rush_bp_${amount}`,
        name: segment.name,
        text: body,
        trigger: { type: "on_rush" },
        effects: [
          {
            type: "modify_bp",
            target: { type: "trigger_source" },
            amount,
            duration: "turn",
          },
        ],
        matchedPattern: "on_rush_bp_boost",
      };
    },
  },
  {
    pattern: "on_rush_grant_sp",
    test: (body) => /ラッシュしたとき/.test(body) && /「SP(\d+)」/.test(body),
    build: (body, segment) => {
      const n = body.match(/SP(\d+)/)?.[1] ?? "1";
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `on_rush_sp${n}`,
        name: segment.name,
        text: body,
        trigger: { type: "on_rush" },
        effects: [{ type: "grant_keyword", keyword: `SP${n}`, duration: "turn" }],
        matchedPattern: "on_rush_grant_sp",
      };
    },
  },
  {
    pattern: "opponent_draw_optional",
    test: (body) => /相手は(\d+)枚ドローしてもよい/.test(body),
    build: (body, segment, trigger) => {
      const n = Number(body.match(/相手は(\d+)枚ドロー/)?.[1] ?? 1);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : "opponent_draw",
        name: segment.name,
        text: body,
        trigger,
        optional: true,
        effects: [{ type: "draw", amount: n, player: "opponent" }],
        matchedPattern: "opponent_draw_optional",
      };
    },
  },
  {
    pattern: "discard_s_to_hand_flex",
    test: (body) => /自軍捨札からSユニット.*手札に加/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "discard_s_unit_to_hand",
      name: segment.name,
      text: body,
      trigger,
      condition: { type: "has_target", target: zone("discard", "self", { size: "S" }) },
      effects: [
        chooseUnit(zone("discard", "self", { size: "S" }), 1, [
          { type: "move", target: { type: "trigger_source" }, to: "hand" },
        ]),
      ],
      matchedPattern: "discard_s_to_hand_flex",
    }),
  },
  {
    pattern: "destroy_enemy_battle_any",
    test: (body) =>
      /敵軍バトルエリアから.*ユニットを1体選(び|んで)撃破/.test(body) &&
      !/BP(\d+)以下/.test(body) &&
      !/BPの下三桁/.test(body) &&
      !/カテゴリにDA/.test(body) &&
      !/隣り合う2体/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "destroy_enemy_battle",
      name: segment.name,
      text: body,
      trigger: /バトルエリアに出たとき/.test(body) ? { type: "enter_battle" } : trigger,
      condition: {
        type: "has_target",
        target: zone("battle", "opponent"),
      },
      effects: [
        chooseUnit(zone("battle", "opponent"), 1, [
          { type: "discard", target: { type: "trigger_source" } },
        ]),
      ],
      matchedPattern: "destroy_enemy_battle_any",
    }),
  },
  {
    pattern: "return_to_hand_flex",
    test: (body) =>
      /を1体選び.*持ち主の手札に戻/.test(body) ||
      /を1枚選び.*持ち主の手札に戻/.test(body),
    build: (body, segment, trigger) => {
      const enemy = /敵軍/.test(body);
      const owner = enemy ? "opponent" : "self";
      const zoneName = /バトルエリア/.test(body)
        ? "battle"
        : /ラッシュエリア/.test(body)
          ? "rush"
          : /コマンドゾーン/.test(body)
            ? "command"
            : "battle";
      return {
        id: segment.name ? slugifyEffectId(segment.name) : "return_to_hand",
        name: segment.name,
        text: body,
        trigger,
        optional: /してもよい/.test(body),
        condition: { type: "has_target", target: zone(zoneName, owner) },
        effects: [
          chooseUnit(zone(zoneName, owner), 1, [
            { type: "move", target: { type: "trigger_source" }, to: "hand" },
          ]),
        ],
        matchedPattern: "return_to_hand_flex",
      };
    },
  },
  {
    pattern: "deck_to_hand_named",
    test: (body) => /自軍山札から.*選び.*手札に加/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "deck_to_hand",
      name: segment.name,
      text: body,
      trigger,
      optional: /してもよい/.test(body),
      effects: [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
        },
      ],
      matchedPattern: "deck_to_hand_named",
    }),
  },
  {
    pattern: "hold_self_command_on_rush",
    test: (body) => /ラッシュしたとき.*自軍コマンドを.*ホールド/.test(body),
    build: (body, segment) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "hold_self_command_on_rush",
      name: segment.name,
      text: body,
      trigger: { type: "on_rush" },
      optional: /してもよい/.test(body),
      effects: [
        {
          type: "choose",
          kind: "select_command",
          valid: { type: "zone", zone: "command", owner: "self" },
          count: 1,
          then: [{ type: "hold_command", target: { type: "trigger_source" } }],
        },
      ],
      matchedPattern: "hold_self_command_on_rush",
    }),
  },
  {
    pattern: "hold_enemy_command",
    test: (body) => /敵軍コマンド.*ホールド/.test(body) && !/レジストを持つ敵軍/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "hold_enemy_command",
      name: segment.name,
      text: body,
      trigger,
      condition: { type: "has_target", target: zone("command", "opponent") },
      effects: [
        {
          type: "choose",
          kind: "select_command",
          valid: { type: "zone", zone: "command", owner: "opponent" },
          count: 1,
          then: [{ type: "hold_command", target: { type: "trigger_source" } }],
        },
      ],
      matchedPattern: "hold_enemy_command",
    }),
  },
  {
    pattern: "stack_vehicle_on_rush",
    test: (body) =>
      /^※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "stack_vehicle_on_rush",
      name: segment.name,
      text: body,
      trigger: trigger.type === "nc" ? { type: "on_rush" } : trigger,
      optional: true,
      effects: [
        {
          type: "grant_keyword",
          keyword: "stack_vehicle_on_rush",
          duration: "permanent",
        },
      ],
      matchedPattern: "stack_vehicle_on_rush",
    }),
  },
  {
    pattern: "power_faceup_bp_per_card",
    test: (body) =>
      /^※これは自軍パワーゾーンのオモテ向きのカード1枚につきBP[＋+](\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = body.match(/BP[＋+](\d+)される/)?.[1] ?? "1000";
      return {
        id: `power_faceup_bp_per_${amount}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `power_faceup_bp_per_${amount}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "power_faceup_bp_per_card",
      };
    },
  },
  {
    pattern: "power_feature_bp_sp_threshold",
    test: (body) =>
      /自軍パワーゾーン.*特徴「([^」]+)」.*1枚につきBP[＋+](\d+).*BP(\d+)以上.*「SP(\d+)/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const m = body.match(
        /特徴「([^」]+)」.*BP[＋+](\d+).*BP(\d+)以上.*「SP(\d+)/,
      );
      const feature = slugifyEffectId(m?.[1] ?? "feature");
      const bpPer = m?.[2] ?? "1000";
      const threshold = m?.[3] ?? "3000";
      const sp = m?.[4] ?? "1";
      return {
        id: `power_${feature}_bp${bpPer}_sp${sp}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `power_feature_bp_sp_${feature}_${bpPer}_${threshold}_sp${sp}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "power_feature_bp_sp_threshold",
      };
    },
  },
  {
    pattern: "ride_without_rc_feature",
    test: (body) =>
      /^※特徴「([^」]+)」を持つ(?:自軍)?Sユニットは.*ＲＣを持っていなくてもこのビークルにライドできる/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = slugifyEffectId(body.match(/特徴「([^」]+)」/)?.[1] ?? "feature");
      return {
        id: `ride_without_rc_${feature}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `ride_without_rc_${feature}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "ride_without_rc_feature",
      };
    },
  },
  {
    pattern: "ride_without_rc_command",
    test: (body) =>
      /^※特徴「([^」]+)」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = slugifyEffectId(body.match(/特徴「([^」]+)」/)?.[1] ?? "feature");
      return {
        id: `ride_command_without_rc_${feature}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `ride_command_without_rc_${feature}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "ride_without_rc_command",
      };
    },
  },
  {
    pattern: "can_ride_vehicle",
    test: (body) =>
      /^※これはビークルにライドできる/.test(body) ||
      /^※これは特徴「([^」]+)」を持つビークルにライドできる/.test(body),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1];
      const keyword = feature
        ? `can_ride_vehicle_${slugifyEffectId(feature)}`
        : "can_ride_vehicle";
      return {
        id: `unnamed_${keyword}`,
        text: body,
        trigger,
        effects: [{ type: "grant_keyword", keyword, duration: "permanent" }],
        matchedPattern: "can_ride_vehicle",
      };
    },
  },
  {
    pattern: "sp_at_bp_threshold",
    test: (body) => /^※これはBP(\d+)以上のとき「SP(\d+)」になる/.test(body),
    build: (body, segment, trigger) => {
      const m = body.match(/BP(\d+)以上.*「SP(\d+)」/);
      const threshold = m?.[1] ?? "5000";
      const sp = m?.[2] ?? "1";
      return {
        id: `sp_at_bp${threshold}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `sp_at_bp${threshold}_sp${sp}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "sp_at_bp_threshold",
      };
    },
  },
  {
    pattern: "no_attack_from_enemy_s_bp",
    test: (body) => /^※これはBP(\d+)以上の敵軍Sユニットにアタックされない/.test(body),
    build: (body, segment, trigger) => {
      const threshold = body.match(/BP(\d+)以上/)?.[1] ?? "2000";
      return {
        id: `no_attack_enemy_s_bp${threshold}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `no_attack_from_enemy_s_bp${threshold}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "no_attack_from_enemy_s_bp",
      };
    },
  },
  {
    pattern: "no_attack_from_bp_unit",
    test: (body) => /^※これはBP(\d+)以上のユニットにアタックされない/.test(body),
    build: (body, segment, trigger) => {
      const threshold = body.match(/BP(\d+)以上/)?.[1] ?? "3000";
      return {
        id: `no_attack_from_bp${threshold}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `no_attack_from_bp${threshold}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "no_attack_from_bp_unit",
      };
    },
  },
  {
    pattern: "cannot_attack_low_bp",
    test: (body) => /^※これはBP(\d+)以下のユニットにアタックできない/.test(body),
    build: (body, segment, trigger) => {
      const threshold = body.match(/BP(\d+)以下/)?.[1] ?? "1000";
      return {
        id: `cannot_attack_bp${threshold}_or_less`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `cannot_attack_bp${threshold}_or_less`,
            duration: "permanent",
          },
        ],
        matchedPattern: "cannot_attack_low_bp",
      };
    },
  },
  {
    pattern: "no_attack_without_feature",
    test: (body) => /^※これは、特徴「([^」]+)」を持たないユニットにアタックされない/.test(body),
    build: (body, segment, trigger) => {
      const feature = slugifyEffectId(body.match(/特徴「([^」]+)」/)?.[1] ?? "feature");
      return {
        id: `no_attack_without_${feature}`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `no_attack_without_${feature}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "no_attack_without_feature",
      };
    },
  },
  {
    pattern: "require_hold_other_s_entry",
    test: (body) =>
      /^※これは、これ以外の自軍Sユニットを１体ホールドしなければバトルエリアに出られない/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: "require_hold_other_s_entry",
      text: body,
      trigger,
      effects: [
        {
          type: "grant_keyword",
          keyword: "require_hold_other_s_entry",
          duration: "permanent",
        },
      ],
      matchedPattern: "require_hold_other_s_entry",
    }),
  },
  {
    pattern: "require_discard_rush_s_entry",
    test: (body) =>
      /^※これは自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: "require_discard_rush_s_entry",
      text: body,
      trigger,
      effects: [
        {
          type: "grant_keyword",
          keyword: "require_discard_rush_s_entry",
          duration: "permanent",
        },
      ],
      matchedPattern: "require_discard_rush_s_entry",
    }),
  },
  {
    pattern: "no_strike_with_command",
    test: (body) => /^※これは自軍コマンドが１つ以上あるときストライクできない/.test(body),
    build: (body, segment, trigger) => ({
      id: "no_strike_with_command",
      text: body,
      trigger,
      effects: [
        {
          type: "grant_keyword",
          keyword: "no_strike_with_command",
          duration: "permanent",
        },
      ],
      matchedPattern: "no_strike_with_command",
    }),
  },
  {
    pattern: "rush_prefer_hold",
    test: (body) => /^※これはラッシュするとき、可能ならホールド状態で置く/.test(body),
    build: (body, segment, trigger) => ({
      id: "rush_prefer_hold",
      text: body,
      trigger,
      effects: [
        { type: "grant_keyword", keyword: "rush_prefer_hold", duration: "permanent" },
      ],
      matchedPattern: "rush_prefer_hold",
    }),
  },
  {
    pattern: "enemy_cannot_attack",
    test: (body) =>
      /^※これは敵軍ユニットにアタックされない/.test(body) ||
      /^これは敵軍ユニットにアタックされない/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "enemy_cannot_attack",
      name: segment.name,
      text: body,
      trigger,
      effects: [
        { type: "grant_keyword", keyword: "enemy_cannot_attack", duration: "permanent" },
      ],
      matchedPattern: "enemy_cannot_attack",
    }),
  },
  {
    pattern: "on_attack_bp_boost",
    test: (body) => /これはアタックするときBP[＋+](\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = Number(body.match(/BP[＋+](\d+)される/)?.[1] ?? 4000);
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `on_attack_bp_${amount}`,
        name: segment.name,
        text: body,
        trigger: trigger.type === "nc" ? { type: "on_attack" } : trigger,
        effects: [
          {
            type: "modify_bp",
            target: { type: "trigger_source" },
            amount,
            duration: "turn",
          },
        ],
        matchedPattern: "on_attack_bp_boost",
      };
    },
  },
  {
    pattern: "destroy_enemy_rush_s_on_attack",
    test: (body) =>
      /これがアタックするとき、敵軍ラッシュエリアからSユニットを1体選び撃破/.test(body) ||
      /これがアタックするとき、敵軍ラッシュエリアからSユニットを1体選び撃破/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "destroy_enemy_rush_s_on_attack",
      name: segment.name,
      text: body,
      trigger: trigger.type === "nc" ? { type: "on_attack" } : trigger,
      optional: /してもよい/.test(body),
      condition: {
        type: "has_target",
        target: zone("rush", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("rush", "opponent", { size: "S" }), 1, [
          { type: "discard", target: { type: "trigger_source" } },
        ]),
      ],
      matchedPattern: "destroy_enemy_rush_s_on_attack",
    }),
  },
  {
    pattern: "end_turn_return_to_rush",
    test: (body) =>
      /自分がターンを終えるとき、このユニットがバトルエリアにあればラッシュエリアに戻してもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "end_turn_return_to_rush",
      name: segment.name,
      text: body,
      trigger: trigger.type === "nc" ? { type: "end_phase" } : trigger,
      optional: true,
      effects: [
        {
          type: "move",
          target: { type: "trigger_source" },
          to: "rush",
        },
      ],
      matchedPattern: "end_turn_return_to_rush",
    }),
  },
  {
    pattern: "attack_and_strike_once",
    test: (body) => /これはアタックとストライクを1度ずつ行ってもよい/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "attack_and_strike_once",
      name: segment.name,
      text: body,
      trigger,
      effects: [
        {
          type: "grant_keyword",
          keyword: "attack_and_strike_once",
          duration: "turn",
        },
      ],
      matchedPattern: "attack_and_strike_once",
    }),
  },
  {
    pattern: "extra_attack_on_battle_win",
    test: (body) =>
      /これがアタックしてバトルに勝ったとき、追加でアタックかストライクを行ってもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "extra_attack_on_battle_win",
      name: segment.name,
      text: body,
      trigger: trigger.type === "nc" ? { type: "on_attack" } : trigger,
      optional: true,
      effects: [
        {
          type: "grant_keyword",
          keyword: "extra_attack_on_battle_win",
          duration: "turn",
        },
      ],
      matchedPattern: "extra_attack_on_battle_win",
    }),
  },
  {
    pattern: "discard_power_on_rush",
    test: (body) =>
      /^※これをラッシュしたとき、自軍パワーゾーンにダメージ以外のカードがあれば、1枚選び捨札にする/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: "discard_power_on_rush",
      text: body,
      trigger: trigger.type === "nc" ? { type: "on_rush" } : trigger,
      optional: true,
      condition: { type: "has_target", target: zone("power", "self") },
      effects: [
        chooseUnit(zone("power", "self"), 1, [
          { type: "discard", target: { type: "trigger_source" } },
        ]),
      ],
      matchedPattern: "discard_power_on_rush",
    }),
  },
  {
    pattern: "ally_rider_protects_from_enemy_s",
    test: (body) =>
      /^※これ以外の特徴「([^」]+)」を持つユニットが自軍バトルエリアにあれば、これは敵軍Sユニットにアタックされない/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = slugifyEffectId(body.match(/特徴「([^」]+)」/)?.[1] ?? "feature");
      return {
        id: `ally_${feature}_protects_from_enemy_s`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `ally_${feature}_protects_from_enemy_s`,
            duration: "permanent",
          },
        ],
        matchedPattern: "ally_rider_protects_from_enemy_s",
      };
    },
  },
  {
    pattern: "enter_battle_hold_send_enemy_s_to_power",
    test: (body) =>
      /これがバトルエリアに出たとき.*ホールドしてもよい.*敵軍Sユニットを1体選び.*パワーゾーンにダメージにして置く/.test(
        body,
      ),
    build: (body, segment) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "enter_hold_send_s_to_power",
      name: segment.name,
      text: body,
      trigger: { type: "enter_battle" },
      optional: true,
      condition: {
        type: "has_target",
        target: zone("battle", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("battle", "opponent", { size: "S" }), 1, [
          { type: "move", target: { type: "trigger_source" }, to: "power" },
        ]),
      ],
      matchedPattern: "enter_battle_hold_send_enemy_s_to_power",
    }),
  },
  {
    pattern: "enter_battle_grant_sp_bp_combo",
    test: (body) =>
      /バトルエリアに出たとき.*次の能力を得る⇒.*SP\d+.*BP[＋+]\d+/.test(body) ||
      /バトルエリアに出たとき.*次の能力を得る⇒「SP\d+」「BP[＋+]\d+」/.test(body),
    build: (body, segment) => {
      const sp = body.match(/SP(\d+)/)?.[1] ?? "1";
      const bp = body.match(/BP[＋+](\d+)/)?.[1] ?? "3000";
      return {
        id: segment.name ? slugifyEffectId(segment.name) : `enter_sp${sp}_bp${bp}`,
        name: segment.name,
        text: body,
        trigger: { type: "enter_battle" },
        effects: [
          { type: "grant_keyword", keyword: `SP${sp}`, duration: "turn" },
          {
            type: "modify_bp",
            target: { type: "trigger_source" },
            amount: Number(bp),
            duration: "turn",
          },
        ],
        matchedPattern: "enter_battle_grant_sp_bp_combo",
      };
    },
  },
  {
    pattern: "return_command_rc_to_hand",
    test: (body) =>
      /自軍コマンドゾーンから.*ホールド状態の.*ユニットカードを1枚選び、手札に戻してもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "return_command_rc_to_hand",
      name: segment.name,
      text: body,
      trigger,
      optional: true,
      condition: { type: "has_target", target: zone("command", "self") },
      effects: [
        {
          type: "choose",
          kind: "select_command",
          valid: { type: "zone", zone: "command", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
        },
      ],
      matchedPattern: "return_command_rc_to_hand",
    }),
  },
  {
    pattern: "recruit_from_discard_on_destroy",
    test: (body) =>
      /^※これが撃破されて捨札になったとき、自軍捨札から.*ラッシュエリアに出す/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "recruit_from_discard_on_destroy",
      name: segment.name,
      text: body,
      trigger: trigger.type === "while_in_field" ? { type: "on_destroy" } : trigger,
      optional: true,
      condition: { type: "has_target", target: zone("discard", "self") },
      effects: [
        chooseUnit(zone("discard", "self"), 1, [
          { type: "move", target: { type: "trigger_source" }, to: "rush" },
        ]),
      ],
      matchedPattern: "recruit_from_discard_on_destroy",
    }),
  },
  {
    pattern: "end_turn_stack_on_resident",
    test: (body) =>
      /自分がターンを終えるとき、自軍常駐置き場.*重ねて置いてもよい/.test(body),
    build: (body, segment, trigger) => ({
      id: "end_turn_stack_on_resident",
      text: body,
      trigger: trigger.type === "nc" ? { type: "end_phase" } : trigger,
      optional: true,
      effects: [
        {
          type: "grant_keyword",
          keyword: "end_turn_stack_on_resident",
          duration: "permanent",
        },
      ],
      matchedPattern: "end_turn_stack_on_resident",
    }),
  },
  {
    pattern: "sole_s_both_sides_to_power",
    test: (body) =>
      /自軍も敵軍もSユニットが1体しかいなければ、敵軍Sユニットを1体選び.*パワーゾーンにダメージにして置く/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "sole_s_both_sides_to_power",
      name: segment.name,
      text: body,
      trigger,
      optional: /してもよい/.test(body),
      condition: {
        type: "has_target",
        target: zone("battle", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("battle", "opponent", { size: "S" }), 1, [
          { type: "move", target: { type: "trigger_source" }, to: "power" },
        ]),
      ],
      matchedPattern: "sole_s_both_sides_to_power",
    }),
  },
  {
    pattern: "hold_enemy_s_to_power_nc",
    test: (body) =>
      /敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く/.test(body) &&
      !/バトルエリアに出たとき.*ホールド/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "hold_enemy_s_to_power",
      name: segment.name,
      text: body,
      trigger,
      optional: true,
      condition: {
        type: "has_target",
        target: zone("battle", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("battle", "opponent", { size: "S" }), 1, [
          { type: "move", target: { type: "trigger_source" }, to: "power" },
        ]),
      ],
      matchedPattern: "hold_enemy_s_to_power_nc",
    }),
  },
  {
    pattern: "copy_nc_from_rush_s",
    test: (body) =>
      /敵軍ラッシュエリアから.*Sユニットを1体選んでも良い.*ＮＣの効果を、このユニットの効果として発動する/.test(
        body,
      ),
    build: (body, segment) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "copy_nc_from_rush_s",
      name: segment.name,
      text: body,
      trigger: { type: "enter_battle" },
      optional: true,
      condition: {
        type: "has_target",
        target: zone("rush", "opponent", { size: "S" }),
      },
      effects: [
        {
          type: "grant_keyword",
          keyword: "copy_nc_from_rush_s",
          duration: "turn",
        },
      ],
      matchedPattern: "copy_nc_from_rush_s",
    }),
  },
  {
    pattern: "note_bp_enemy_s_threshold",
    test: (body) =>
      /^※これはBP(\d+)以上の敵軍Sユニットにアタックされない/.test(body),
    build: (body, segment, trigger) => {
      const threshold = body.match(/BP(\d+)以上/)?.[1] ?? "2000";
      return {
        id: `note_bp${threshold}_s`,
        text: body,
        trigger,
        effects: [
          {
            type: "grant_keyword",
            keyword: `no_attack_from_enemy_s_bp${threshold}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "note_bp_enemy_s_threshold",
      };
    },
  },
  {
    pattern: "auto_battle_if_enemy_battle_own_turn",
    test: (body) =>
      /^※自軍ターン中、これは、?敵軍バトルエリアにユニットがあれば、?可能ならバトルエリアに出る/.test(
        body,
      ),
    build: (body) => ({
      id: "unnamed_auto_battle_if_enemy_battle",
      text: body,
      trigger: { type: "while_in_field" },
      effects: [
        {
          type: "grant_keyword",
          keyword: "auto_battle_entry_if_enemy_battle",
          duration: "permanent",
        },
      ],
      matchedPattern: "auto_battle_if_enemy_battle_own_turn",
    }),
  },
  {
    pattern: "destroy_enemy_s_category_da",
    test: (body) =>
      /敵軍バトルエリアから、?カテゴリにDAを持つ敵軍Sユニットを1体選び撃破/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "destroy_enemy_s_category_da",
      name: segment.name,
      text: body,
      trigger,
      condition: {
        type: "has_target",
        target: zone("battle", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("battle", "opponent", { size: "S" }), 1, [
          { type: "discard", target: { type: "trigger_source" } },
        ]),
      ],
      matchedPattern: "destroy_enemy_s_category_da",
    }),
  },
  {
    pattern: "destroy_enemy_s_bp_suffix_500",
    test: (body) =>
      /敵軍バトルエリアから、?BPの下三桁が500の敵軍Sユニットを1体選び撃破/.test(body),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : "destroy_enemy_s_bp_suffix_500",
      name: segment.name,
      text: body,
      trigger,
      condition: {
        type: "has_target",
        target: zone("battle", "opponent", { size: "S" }),
      },
      effects: [
        chooseUnit(zone("battle", "opponent", { size: "S" }), 1, [
          { type: "discard", target: { type: "trigger_source" } },
        ]),
      ],
      matchedPattern: "destroy_enemy_s_bp_suffix_500",
    }),
  },
  {
    pattern: "recruit_named_from_discard_if_present",
    test: (body) =>
      /^※これが撃破されて捨札になったとき、自軍捨札に「[^」]+」のカードがあれば1枚選び、自軍ラッシュエリアに出す/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const cardName = body.match(/「([^」]+)」/)?.[1] ?? "named";
      return {
        id: `recruit_${slugifyEffectId(cardName)}_on_destroy`,
        text: body,
        trigger: trigger.type === "while_in_field" ? { type: "on_destroy" } : trigger,
        optional: true,
        condition: { type: "has_target", target: zone("discard", "self") },
        effects: [
          chooseUnit(zone("discard", "self"), 1, [
            { type: "move", target: { type: "trigger_source" }, to: "rush" },
          ]),
        ],
        matchedPattern: "recruit_named_from_discard_if_present",
      };
    },
  },
  {
    pattern: "return_self_on_ally_rush_named",
    test: (body) =>
      /^※自分が「[^」]+」をラッシュしたとき、自軍エリアに「[^」]+」があれば1体選んで手札に戻す/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: noteEffectIdFromBody(body),
      text: body,
      trigger: trigger.type === "nc" ? { type: "on_rush" } : trigger,
      optional: true,
      effects: [
        {
          type: "grant_keyword",
          keyword: `return_self_on_ally_rush_${hashEffectText(body).slice(0, 12)}`,
          duration: "permanent",
        },
      ],
      matchedPattern: "return_self_on_ally_rush_named",
    }),
  },
  {
    pattern: "counter_redirect_attack",
    test: (body) =>
      /^※カウンター/.test(body) &&
      /アタックされたとき発動できる/.test(body) &&
      /アタックしてきたユニット以外/.test(body),
    build: (body) => ({
      id: noteEffectIdFromBody(body),
      text: body,
      trigger: { type: "operation", timing: "counter" },
      effects: [
        {
          type: "grant_keyword",
          keyword: "counter_redirect_attack",
          duration: "permanent",
        },
      ],
      matchedPattern: "counter_redirect_attack",
    }),
  },
  {
    pattern: "counter_defender_bp_boost",
    test: (body) =>
      /^※カウンター/.test(body) &&
      /アタックされたとき発動できる/.test(body) &&
      /アタックされたユニットはBP\+(\d+)される/.test(body),
    build: (body) => {
      const amount = body.match(/BP\+(\d+)/)?.[1] ?? "2000";
      return {
        id: `counter_defender_bp_${amount}`,
        text: body,
        trigger: { type: "operation", timing: "counter" },
        effects: [
          {
            type: "grant_keyword",
            keyword: `counter_defender_bp_${amount}`,
            duration: "permanent",
          },
        ],
        matchedPattern: "counter_defender_bp_boost",
      };
    },
  },
];

function delegateEffectKeyword(effectId: string): EffectPrimitive {
  return {
    type: "grant_keyword",
    keyword: `effect_${effectId}`,
    duration: "permanent",
  };
}

function rematchBuiltEffect(
  body: string,
  options: {
    name?: string;
    kind?: WikiEffectSegment["kind"];
    trigger: EffectDefinition["trigger"];
  },
): Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> | null {
  const segment: WikiEffectSegment = {
    kind: options.kind ?? "body",
    body,
    name: options.name,
  };
  for (const pattern of PATTERNS) {
    if (!pattern.test(body, segment)) continue;
    const built = pattern.build(body, segment, options.trigger);
    if (
      built &&
      built.effects.length > 0 &&
      !built.effects.every((p) => p.type === "fallback_handler")
    ) {
      return built;
    }
  }
  return null;
}

/** 既存 DSL スタブの enqueue-only / effect_* delegate を PATTERNS で再マッチ（M17/M20）。 */
export function rematchExtractedEffect(
  body: string,
  options: {
    name?: string;
    kind?: WikiEffectSegment["kind"];
    trigger: EffectDefinition["trigger"];
  },
): Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> | null {
  return rematchBuiltEffect(body, options);
}

/** @deprecated rematchExtractedEffect を優先 */
export function rematchEffectPrimitives(
  body: string,
  options: {
    name?: string;
    kind?: WikiEffectSegment["kind"];
    trigger: EffectDefinition["trigger"];
  },
): EffectPrimitive[] | null {
  const built = rematchBuiltEffect(body, options);
  return built?.effects ?? null;
}

function fallbackEffect(
  segment: WikiEffectSegment,
  trigger: EffectDefinition["trigger"],
  body: string,
): ExtractedEffect {
  const id = sanitizeEffectId(
    segment.name ? slugifyEffectId(segment.name) : `segment_${segment.kind}`,
  );
  return {
    segmentIndex: -1,
    id,
    name: segment.name,
    text: body,
    trigger,
    effects: [{ type: "fallback_handler", effectId: id }],
    needsFallback: true,
  };
}

export function extractEffects(
  parse: WikiParseResult,
  analysis: CardAnalysis,
  triggers: ExtractedTrigger[],
): ExtractedEffect[] {
  if (parse.segments.length === 0) return [];

  return parse.segments.map((segment, segmentIndex) => {
    const body = segment.body;
    const trigger = triggers[segmentIndex]?.trigger ?? { type: "nc" as const };

    for (const pattern of PATTERNS) {
      if (!pattern.test(body, segment)) continue;
      const built = pattern.build(body, segment, trigger);
      if (built) {
        return {
          segmentIndex,
          ...built,
          needsFallback: false,
        };
      }
    }

    if (analysis.cardType === "operation" && segment.kind === "body") {
      const effectId = slugifyEffectId(parse.name);
      return {
        segmentIndex,
        id: effectId,
        name: parse.name,
        text: body,
        trigger,
        effects: [delegateEffectKeyword(effectId)],
        needsFallback: false,
        matchedPattern: "delegate_operation_effect",
      };
    }

    if (segment.kind === "named" && segment.name) {
      const effectId = sanitizeEffectId(slugifyEffectId(segment.name));
      return {
        segmentIndex,
        id: effectId,
        name: segment.name,
        text: body,
        trigger,
        effects: [delegateEffectKeyword(effectId)],
        needsFallback: false,
        matchedPattern: "delegate_named_effect",
      };
    }

    if (segment.kind === "note" && body.startsWith("※")) {
      const effectId = noteEffectIdFromBody(body);
      return {
        segmentIndex,
        id: effectId,
        text: body,
        trigger,
        effects: [delegateEffectKeyword(effectId)],
        needsFallback: false,
        matchedPattern: "delegate_note_effect",
      };
    }

    return { ...fallbackEffect(segment, trigger, body), segmentIndex };
  });
}
