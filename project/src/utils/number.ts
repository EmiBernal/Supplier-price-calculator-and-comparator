export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const toFiniteNumber = (value: unknown): number | null => {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const safeToFixed = (
  value: unknown,
  decimals = 2,
  fallback = '—'
): string => {
  const num = toFiniteNumber(value);
  return num == null ? fallback : num.toFixed(decimals);
};
