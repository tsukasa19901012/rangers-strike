import type { CpuLevel, Phase, PlayerId } from "@rangers-strike/engine";
import type { Category } from "@rangers-strike/cards";

export const CPU_LEVEL_OPTIONS: { level: CpuLevel; label: string }[] = [
  { level: 1, label: "Lv1 — 初級（ヒューリスティック）" },
  { level: 2, label: "Lv2 — 初中級" },
  { level: 3, label: "Lv3 — 中級" },
  { level: 4, label: "Lv4 — 上級" },
  { level: 5, label: "Lv5 — 最上級" },
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
  MA: "ミスティックアームズ",
  DA: "ダークアライアンス",
};

export function formatCardCategories(
  category: Category | Category[] | undefined,
): string | null {
  if (!category) return null;
  const categories = Array.isArray(category) ? category : [category];
  if (categories.length === 0) return null;
  return categories.map((code) => `${code}（${CATEGORY_LABELS[code]}）`).join(" / ");
}

export const CATEGORY_OPTIONS: { id: Category; label: string }[] = (
  ["ET", "WB", "OT", "MA", "DA"] as const
).map((id) => ({ id, label: CATEGORY_LABELS[id] }));
