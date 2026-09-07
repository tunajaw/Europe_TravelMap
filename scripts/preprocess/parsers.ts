const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4],
  ['may', 5], ['june', 6], ['july', 7], ['august', 8],
  ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

export function parseMoney(source: string): number {
  const normalized = source.trim();
  if (!/^(?:0|€\s*\d+(?:\.\d+)?)$/.test(normalized)) {
    throw new Error(`Unsupported money value: ${source}`);
  }
  const value = Number(normalized.replace('€', '').trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid money value: ${source}`);
  }
  return value;
}

export function parseDurationMinutes(source: string): number {
  const match = source.trim().match(/^(\d+)\s*(?:min)?$/i);
  if (!match?.[1]) {
    throw new Error(`Unsupported duration value: ${source}`);
  }
  return Number(match[1]);
}

export function parseDate(source: string): string {
  const match = source.trim().match(/^(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})$/);
  const month = match?.[2] ? MONTHS.get(match[2].toLowerCase()) : undefined;
  if (!match?.[1] || !match[3] || !month) {
    throw new Error(`Unsupported date value: ${source}`);
  }
  const day = Number(match[1]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid date value: ${source}`);
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function splitSegmentNotes(source: string): {
  segment: string | null;
  departure: string | null;
  arrival: string | null;
} {
  const parts = source.split('/');
  if (parts.length !== 3) {
    throw new Error(`Segment notes must contain exactly three positions: ${source}`);
  }
  const optional = (value: string | undefined): string | null => value?.trim() || null;
  return { segment: optional(parts[0]), departure: optional(parts[1]), arrival: optional(parts[2]) };
}

export function parseRating(source: string): { components: number[]; total: number } {
  const match = source.trim().match(/^(.+?)\s*(?::|→)\s*(-?\d+(?:\.\d+)?)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Unsupported rating value: ${source}`);
  }
  const components = match[1].split('/').map((part) => Number(part.trim()));
  const total = Number(match[2]);
  if (components.some((value) => !Number.isFinite(value)) || !Number.isFinite(total)) {
    throw new Error(`Invalid rating value: ${source}`);
  }
  const sum = components.reduce((current, value) => current + value, 0);
  if (Math.abs(sum - total) > 0.000_001) {
    throw new Error(`Rating total does not match components: ${source}`);
  }
  return { components, total };
}

export function optionalText(source: string): string | null {
  return source.trim() || null;
}
