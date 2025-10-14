export function normalizeToYMD(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value as any);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function formatYMD(value: unknown, fallback = ''): string {
  const normalized = normalizeToYMD(value);
  return normalized ?? fallback;
}

export function compareYMD(a: unknown, b: unknown): number {
  const normalizedA = normalizeToYMD(a) ?? '';
  const normalizedB = normalizeToYMD(b) ?? '';
  if (normalizedA === normalizedB) return 0;
  return normalizedA < normalizedB ? -1 : 1;
}
