import { estimateCardUiCoverage } from "@/lib/estimateCardUiCoverage";

type CardStatusBadgesProps = {
  cardId: string;
  max?: number;
};

function badgeClassName(badge: string): string {
  if (badge === "DSL未実装") return "deck-builder__status-badge deck-builder__status-badge--dsl-unimplemented";
  if (badge === "DSL対応") return "deck-builder__status-badge deck-builder__status-badge--dsl-ready";
  return "deck-builder__status-badge";
}

export function CardStatusBadges({ cardId, max = 2 }: CardStatusBadgesProps) {
  const badges = estimateCardUiCoverage(cardId).badges.slice(0, max);
  if (badges.length === 0) return null;
  return (
    <>
      {badges.map((badge) => (
        <span key={badge} className={badgeClassName(badge)}>
          {badge}
        </span>
      ))}
    </>
  );
}
