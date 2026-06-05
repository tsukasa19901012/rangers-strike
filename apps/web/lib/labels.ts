import type { CpuLevel, Phase, PlayerId } from "@rangers-strike/engine";
import type { Category } from "@rangers-strike/cards";

export const CPU_LEVEL_OPTIONS: { level: CpuLevel; label: string }[] = [
  { level: 1, label: "Lv1 — 基本" },
];

export const PHASE_LABELS: Record<Phase, string> = {
  start: "スタート",
  charge: "チャージ",
  rush: "ラッシュ",
  battle: "バトル",
  end: "エンド",
};

export const PLAYER_LABELS: Record<PlayerId, string> = {
  player1: "あなた",
  player2: "CPU",
};

export const STARTER_OPTIONS = [
  { id: "abarenoh", label: "Type A: アバレンオー" },
  { id: "dekaranger", label: "Type B: デカレンジャーロボ" },
  { id: "magiking", label: "Type C: マジキング" },
  { id: "roaring-wings", label: "轟の翼: ダイタンケン" },
  { id: "silver-adventurer", label: "銀の冒険者: ボウケンシルバー" },
] as const;

export type StarterId = (typeof STARTER_OPTIONS)[number]["id"];

export const CATEGORY_LABELS: Record<Category, string> = {
  ET: "アーステクノロジー",
  WB: "ワイルドビースト",
  OT: "オーバーテクノロジー",
  MA: "マジック",
  DA: "デカレンジャー",
};

export const CATEGORY_OPTIONS: { id: Category; label: string }[] = (
  ["ET", "WB", "OT", "MA", "DA"] as const
).map((id) => ({ id, label: CATEGORY_LABELS[id] }));
