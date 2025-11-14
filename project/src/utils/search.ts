export type SearchRank = 1 | 2 | 3;

const WORD_SEPARATOR = /[\s,.;:/\\-]+/;

const removeDiacritics = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

export const normalizeSearchTerm = (value: string) =>
  removeDiacritics(String(value ?? ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const getRankFromNormalized = (
  normalizedHaystack: string,
  normalizedQuery: string
): SearchRank | null => {
  if (!normalizedHaystack || !normalizedQuery) {
    return null;
  }

  if (normalizedHaystack.startsWith(normalizedQuery)) {
    return 1;
  }

  const words = normalizedHaystack.split(WORD_SEPARATOR).filter(Boolean);
  if (words.some((word) => word === normalizedQuery)) {
    return 2;
  }

  if (normalizedHaystack.includes(normalizedQuery)) {
    return 3;
  }

  return null;
};

export const getBestSearchRank = (
  values: Array<string | number | null | undefined>,
  normalizedQuery: string
): SearchRank | null => {
  if (!normalizedQuery) {
    return null;
  }

  let best: SearchRank | null = null;
  for (const value of values) {
    if (value == null) continue;
    const normalizedValue = normalizeSearchTerm(String(value));
    if (!normalizedValue) continue;
    const rank = getRankFromNormalized(normalizedValue, normalizedQuery);
    if (rank == null) continue;
    if (best == null || rank < best) {
      best = rank;
      if (rank === 1) {
        break;
      }
    }
  }

  return best;
};
