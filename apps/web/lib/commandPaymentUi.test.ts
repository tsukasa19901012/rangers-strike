import { getCardEffect } from "@rangers-strike/cards";
import type { CommandPaymentView, PendingCommandPayment } from "@rangers-strike/engine";
import { describe, expect, it } from "vitest";
import {
  canConfirmCommandPayment,
  commandPaymentDetail,
  commandPaymentHint,
  commandPaymentTitle,
  commandPaymentZoneHint,
  type CommandPaymentUiContext,
  toggleCommandPaymentSelection,
} from "./commandPaymentUi";

type TitleCase = {
  id: string;
  pending: PendingCommandPayment;
  view: CommandPaymentView;
  context?: CommandPaymentUiContext;
  title: string;
};

type DetailCase = {
  id: string;
  pending: PendingCommandPayment;
  view: CommandPaymentView;
  selectedCount: number;
  detail: string;
};

function basePending(
  overrides: Partial<PendingCommandPayment> = {},
): PendingCommandPayment {
  return {
    playerId: "player1",
    sourceInstanceId: "src-1",
    sourceCardId: "RS-003",
    eligibleNeeded: 0,
    totalNeeded: 1,
    validInstanceIds: ["cmd-1"],
    continuation: { type: "play_operation" },
    kind: "category_use",
    ...overrides,
  };
}

function operationPaymentDetail(
  cardId: string,
  selectedCount: number,
  selectCount: number,
): string {
  const hold = `コマンドを${selectCount}枚ホールド（${selectedCount}/${selectCount}）`;
  const effectText = getCardEffect(cardId)?.text;
  return effectText ? `${effectText}。${hold}` : hold;
}

function baseView(overrides: Partial<CommandPaymentView> = {}): CommandPaymentView {
  return {
    kind: "category_use",
    sourceCardId: "RS-003",
    sourceCardName: "バトルダンス",
    selectCount: 1,
    eligibleSelectMin: 0,
    categories: ["ET"],
    prismSubstitute: false,
    prismAvailable: false,
    validInstanceIds: ["cmd-1"],
    consumeOnConfirm: false,
    allowRushZoneCommands: false,
    ...overrides,
  };
}

const OPERATION_CARD_CASES = [
  ["RS-001", "ゴレンジャーストーム"],
  ["RS-002", "ジャッカーハリケーン"],
  ["RS-003", "バトルダンス"],
  ["RS-004", "デンジマシン"],
  ["RS-005", "ランドバルカン"],
  ["RS-007", "ダイナマイトパワー"],
  ["RS-008", "超頭脳"],
  ["RS-009", "パワーバズーカ"],
  ["RS-010", "プリズムパワー"],
  ["RS-011", "オーラパワー"],
  ["RS-012", "科学アカデミー"],
  ["RS-013", "シロンの光"],
  ["RS-014", "ファイブテクター"],
  ["RS-015", "バードニックウェーブ"],
  ["RS-017", "気パワー"],
  ["RS-019", "超パワー"],
  ["RS-020", "パワー加速"],
  ["RS-021", "サイバースライダー"],
  ["RS-022", "アースの力"],
  ["RS-023", "Sユニット回収"],
  ["RS-024", "圧縮フリーズ"],
  ["RS-025", "BP+4000"],
  ["RS-028", "ジャッジメント"],
  ["RS-029", "勇気の魔法"],
  ["RS-030", "冒険"],
  ["RS-067", "プラズマエネルギー"],
  ["RS-068", "捨札回収"],
  ["RS-069", "稲妻重力"],
  ["RS-071", "ヒドラー兵の卵"],
  ["RS-072", "無限連鎖"],
  ["RS-123", "スーパーダイナマイト"],
  ["RS-124", "超電子レーダー"],
  ["RS-125", "百獣アニマルハート"],
] as const;

const OPERATION_TITLE_CASES: TitleCase[] = OPERATION_CARD_CASES.map(([cardId, cardName]) => ({
  id: cardId,
  pending: basePending({ sourceCardId: cardId, continuation: { type: "play_operation" } }),
  view: baseView({ sourceCardId: cardId, sourceCardName: cardName }),
  title: `「${cardName}」の使用`,
}));

const COUNTER_CARD_CASES = [
  ["RS-006", "新体操"],
  ["RS-016", "恐竜クロニクル"],
  ["RS-018", "隠れ忍"],
  ["RS-026", "疾風忍"],
  ["RS-027", "恐竜根性"],
] as const;

const COUNTER_TITLE_CASES: TitleCase[] = COUNTER_CARD_CASES.map(([cardId, cardName]) => ({
  id: cardId,
  pending: basePending({ sourceCardId: cardId, continuation: { type: "play_counter" } }),
  view: baseView({ sourceCardId: cardId, sourceCardName: cardName }),
  title: `カウンター「${cardName}」の使用`,
}));

const EFFECT_HOLD_TITLE_CASES: TitleCase[] = [
  {
    id: "moss_blizzard",
    pending: basePending({
      kind: "effect_hold",
      sourceCardId: "RS-041",
      continuation: { type: "effect_choice" },
      totalNeeded: 2,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-041",
      sourceCardName: "モスレンジャー",
      selectCount: 2,
    }),
    context: { effectId: "moss_blizzard" },
    title: "【モスブリザード】",
  },
  {
    id: "moss_breaker",
    pending: basePending({
      kind: "effect_hold",
      sourceCardId: "RS-040",
      continuation: { type: "effect_choice" },
      totalNeeded: 1,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-040",
      sourceCardName: "モスレンジャー",
      selectCount: 1,
    }),
    context: { effectId: "moss_breaker" },
    title: "【モスブレイカー】",
  },
  {
    id: "shift_up",
    pending: basePending({
      kind: "effect_hold",
      sourceCardId: "RS-082",
      continuation: { type: "effect_choice" },
      totalNeeded: 1,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-082",
      sourceCardName: "バルレンジャー",
      selectCount: 1,
    }),
    context: { effectId: "shift_up" },
    title: "【シフトアップ】",
  },
  {
    id: "fire_dance",
    pending: basePending({
      kind: "effect_hold",
      sourceCardId: "RS-170",
      continuation: { type: "effect_choice" },
      totalNeeded: 3,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-170",
      sourceCardName: "ファイヤーレンジャー",
      selectCount: 3,
    }),
    context: { effectId: "fire_dance" },
    title: "【ファイヤーダンス】",
  },
  {
    id: "tricera_lance",
    pending: basePending({
      kind: "effect_hold",
      sourceCardId: "RS-076",
      continuation: { type: "effect_choice" },
      totalNeeded: 1,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-076",
      sourceCardName: "アバレンジャー",
      selectCount: 1,
    }),
    context: { effectId: "tricera_lance" },
    title: "【トリケランス】",
  },
];

const OTHER_TITLE_CASES: TitleCase[] = [
  {
    id: "battle_entry ※のみ",
    pending: basePending({
      kind: "battle_entry",
      sourceCardId: "RS-052",
      sourceInstanceId: "RS-052:unit",
      continuation: { type: "move_to_battle" },
      totalNeeded: 1,
      eligibleNeeded: 1,
    }),
    view: baseView({
      kind: "battle_entry",
      sourceCardId: "RS-052",
      sourceCardName: "爆竜トリケラトプス",
      selectCount: 1,
      eligibleSelectMin: 1,
    }),
    title: "「爆竜トリケラトプス」",
  },
  {
    id: "battle_entry 命名投入効果",
    pending: basePending({
      kind: "battle_entry",
      sourceCardId: "RS-070",
      sourceInstanceId: "RS-070:zord",
      continuation: { type: "move_to_battle" },
      totalNeeded: 1,
      eligibleNeeded: 0,
    }),
    view: baseView({
      kind: "battle_entry",
      sourceCardId: "RS-070",
      sourceCardName: "マジキング",
      selectCount: 1,
      eligibleSelectMin: 0,
    }),
    title: "【天空魔法斬り】",
  },
  {
    id: "mothership_hold",
    pending: basePending({
      kind: "mothership_hold",
      sourceCardId: "RS-066",
      continuation: { type: "rush" },
      totalNeeded: 2,
    }),
    view: baseView({
      kind: "mothership_hold",
      sourceCardId: "RS-066",
      sourceCardName: "ジャガーレンジャー",
      selectCount: 2,
      allowRushZoneCommands: true,
    }),
    title: "【母艦】",
  },
  {
    id: "category_use rush ユニット",
    pending: basePending({
      sourceCardId: "RS-051",
      continuation: { type: "rush" },
    }),
    view: baseView({
      sourceCardId: "RS-051",
      sourceCardName: "爆竜ティラノサウルス",
    }),
    title: "「爆竜ティラノサウルス」のラッシュ",
  },
  {
    id: "category_use rush ゾード",
    pending: basePending({
      sourceCardId: "RS-050",
      continuation: { type: "rush", zordMaterialInstanceId: "mat-1" },
    }),
    view: baseView({
      sourceCardId: "RS-050",
      sourceCardName: "アバレンオー",
    }),
    title: "「アバレンオー」のラッシュ",
  },
  {
    id: "effect_hold effectId なし",
    pending: basePending({
      kind: "effect_hold",
      sourceCardId: "RS-127",
      continuation: { type: "effect_choice" },
      totalNeeded: 1,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-127",
      sourceCardName: "バイオロボ",
      selectCount: 1,
    }),
    title: "「バイオロボ」",
  },
];

const DETAIL_CASES: DetailCase[] = [
  {
    id: "category_use rush",
    pending: basePending({
      sourceCardId: "RS-051",
      continuation: { type: "rush" },
    }),
    view: baseView({
      sourceCardId: "RS-051",
      sourceCardName: "爆竜ティラノサウルス",
    }),
    selectedCount: 0,
    detail: "コマンドを1枚ホールド（0/1）",
  },
  {
    id: "category_use play_operation",
    pending: basePending(),
    view: baseView(),
    selectedCount: 0,
    detail: operationPaymentDetail("RS-003", 0, 1),
  },
  {
    id: "category_use play_counter",
    pending: basePending({ sourceCardId: "RS-006", continuation: { type: "play_counter" } }),
    view: baseView({ sourceCardId: "RS-006", sourceCardName: "新体操" }),
    selectedCount: 0,
    detail: operationPaymentDetail("RS-006", 0, 1),
  },
  {
    id: "category_use プリズム2枚",
    pending: basePending({ totalNeeded: 2, prismSubstitute: true }),
    view: baseView({ selectCount: 2, prismSubstitute: true, prismAvailable: true }),
    selectedCount: 1,
    detail: operationPaymentDetail("RS-003", 1, 2),
  },
  {
    id: "battle_entry 通常ホールド不足",
    pending: basePending({
      kind: "battle_entry",
      continuation: { type: "move_to_battle" },
      totalNeeded: 2,
      eligibleNeeded: 0,
    }),
    view: baseView({
      kind: "battle_entry",
      sourceCardId: "RS-053",
      sourceCardName: "爆竜プテラノドン",
      selectCount: 2,
      eligibleSelectMin: 0,
    }),
    selectedCount: 1,
    detail:
      "コマンドを2枚ホールド（1/2）。選んだコマンドをホールドしてからバトルエリアに出ます",
  },
  {
    id: "battle_entry ※進入確認のみ",
    pending: basePending({
      kind: "battle_entry",
      continuation: { type: "move_to_battle" },
      totalNeeded: 1,
      eligibleNeeded: 1,
    }),
    view: baseView({
      kind: "battle_entry",
      sourceCardId: "RS-052",
      sourceCardName: "爆竜トリケラトプス",
      selectCount: 1,
      eligibleSelectMin: 1,
    }),
    selectedCount: 0,
    detail:
      "コマンドを1枚ホールド（0/1）。選んだコマンドをホールドしてからバトルエリアに出ます",
  },
  {
    id: "battle_entry ※進入＋追加ホールド",
    pending: basePending({
      kind: "battle_entry",
      continuation: { type: "move_to_battle" },
      totalNeeded: 3,
      eligibleNeeded: 2,
    }),
    view: baseView({
      kind: "battle_entry",
      sourceCardId: "RS-051",
      sourceCardName: "爆竜ティラノサウルス",
      selectCount: 3,
      eligibleSelectMin: 2,
    }),
    selectedCount: 0,
    detail:
      "コマンドを3枚ホールド（0/3）。選んだコマンドをホールドしてからバトルエリアに出ます ※進入用のホールドが必要です（母艦のホールドは使えません）",
  },
  {
    id: "mothership_hold",
    pending: basePending({
      kind: "mothership_hold",
      continuation: { type: "rush" },
      totalNeeded: 2,
    }),
    view: baseView({
      kind: "mothership_hold",
      sourceCardId: "RS-066",
      sourceCardName: "ジャガーレンジャー",
      selectCount: 2,
      allowRushZoneCommands: true,
    }),
    selectedCount: 1,
    detail:
      "コマンドを2枚ホールド（1/2） ※母艦用のホールドです（バトル進入の※には使えません）",
  },
  {
    id: "effect_hold moss_blizzard",
    pending: basePending({
      kind: "effect_hold",
      continuation: { type: "effect_choice" },
      totalNeeded: 2,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-041",
      sourceCardName: "モスレンジャー",
      selectCount: 2,
    }),
    selectedCount: 1,
    detail: "コマンドを2枚ホールド（1/2）",
  },
  {
    id: "effect_hold fire_dance",
    pending: basePending({
      kind: "effect_hold",
      continuation: { type: "effect_choice" },
      totalNeeded: 3,
    }),
    view: baseView({
      kind: "effect_hold",
      sourceCardId: "RS-170",
      sourceCardName: "ファイヤーレンジャー",
      selectCount: 3,
    }),
    selectedCount: 2,
    detail: "コマンドを3枚ホールド（2/3）",
  },
];

const ALL_TITLE_CASES = [
  ...OPERATION_TITLE_CASES,
  ...COUNTER_TITLE_CASES,
  ...EFFECT_HOLD_TITLE_CASES,
  ...OTHER_TITLE_CASES,
];

describe("commandPaymentTitle", () => {
  describe.each(ALL_TITLE_CASES)("$id", ({ pending, view, context, title }) => {
    it(`見出し: ${title}`, () => {
      expect(commandPaymentTitle(pending, view, context)).toBe(title);
    });
  });
});

describe("commandPaymentDetail", () => {
  describe.each(DETAIL_CASES)("$id", ({ pending, view, selectedCount, detail }) => {
    it(`ヒント: ${detail}`, () => {
      expect(commandPaymentDetail(pending, view, selectedCount)).toBe(detail);
    });
  });
});

describe("commandPaymentHint", () => {
  it("combines title and detail with a colon", () => {
    const pending = basePending();
    const view = baseView();
    expect(commandPaymentHint(pending, view, 0)).toBe(
      `「バトルダンス」の使用：${operationPaymentDetail("RS-003", 0, 1)}`,
    );
  });

  it("uses effectId context for effect_hold", () => {
    const pending = basePending({
      kind: "effect_hold",
      continuation: { type: "effect_choice" },
      totalNeeded: 2,
    });
    const view = baseView({
      kind: "effect_hold",
      sourceCardName: "モスレンジャー",
      selectCount: 2,
    });
    expect(commandPaymentHint(pending, view, 1, { effectId: "moss_blizzard" })).toBe(
      "【モスブリザード】：コマンドを2枚ホールド（1/2）",
    );
  });
});

describe("commandPaymentZoneHint", () => {
  it("describes rush zone selection for mothership hold", () => {
    expect(
      commandPaymentZoneHint({
        ...baseView(),
        kind: "mothership_hold",
        allowRushZoneCommands: true,
      }),
    ).toBe("コマンドゾーン、またはラッシュ/バトルエリアのコール常駐をタップして選んでください。");
  });

  it("describes command zone only by default", () => {
    expect(commandPaymentZoneHint(baseView())).toBe(
      "コマンドゾーンのカードをタップして選んでください。",
    );
  });
});

describe("commandPaymentUi helpers", () => {
  it("toggles command selection up to required count", () => {
    expect(toggleCommandPaymentSelection([], "cmd-1", 2)).toEqual(["cmd-1"]);
    expect(toggleCommandPaymentSelection(["cmd-1"], "cmd-2", 2)).toEqual(["cmd-1", "cmd-2"]);
    expect(toggleCommandPaymentSelection(["cmd-1", "cmd-2"], "cmd-3", 2)).toEqual([
      "cmd-1",
      "cmd-2",
    ]);
    expect(toggleCommandPaymentSelection(["cmd-1", "cmd-2"], "cmd-1", 2)).toEqual(["cmd-2"]);
  });

  it("confirms only when required count is met", () => {
    expect(canConfirmCommandPayment(["cmd-1"], 2)).toBe(false);
    expect(canConfirmCommandPayment(["cmd-1", "cmd-2"], 2)).toBe(true);
  });
});
