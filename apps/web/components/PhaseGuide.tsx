import type { Phase } from "@rangers-strike/engine";
import { PHASE_LABELS } from "@/lib/labels";

const GUIDES: Record<Phase, string> = {
  start:
    "①ドロー → ②（手札＜ダメージなら追加ドロー可）→ ③フェイズ終了でコマンド解除・バトル→ラッシュ",
  charge: "任意で手札1枚をパワーまたはコマンドへ（チャージ後は自動でラッシュへ）。何もしない場合はフェイズ終了",
  rush:
    "ユニットをラッシュ（要: パワー＋カテゴリ一致コマンドのホールド）。オペ使用可。7+はゾード素材必要",
  battle:
    "ラッシュ→バトル → 1体ずつ出してコンボ発動 → アタック/ストライク/スキップ → 次の1体",
  end: "フェイズ終了でターン終了（ドローは次ターンのスタートで）",
};

type PhaseGuideProps = {
  phase: Phase;
  isHumanTurn: boolean;
  pendingHint?: string;
};

export function PhaseGuide({ phase, isHumanTurn, pendingHint }: PhaseGuideProps) {
  if (!isHumanTurn) {
    return <p className="phase-guide phase-guide--cpu">CPUのターンです…</p>;
  }

  return (
    <p className="phase-guide">
      <strong>{PHASE_LABELS[phase]}</strong>
      {pendingHint ?? GUIDES[phase]}
    </p>
  );
}
