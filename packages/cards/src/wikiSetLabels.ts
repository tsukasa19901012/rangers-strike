import wikiSetLabelsData from "./generated/wiki-set-labels.json";

const LABELS = wikiSetLabelsData.labels as Record<string, string>;
const SETS = wikiSetLabelsData.sets as string[];

const LABEL_BY_ID = new Map(Object.entries(LABELS));

export function getWikiSetLabel(id: string): string | undefined {
  return LABEL_BY_ID.get(id);
}

export function getWikiSetLabels(): readonly string[] {
  return SETS;
}
