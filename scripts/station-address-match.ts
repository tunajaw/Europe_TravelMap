// Conservative normalization: abbreviations/translations that do not match stay unresolved.
export function normalizeAddress(value: string): string {
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('ß', 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function matchesAddress(address: string, properties: { street?: string; housenumber?: string }): boolean {
  if (!properties.street || !properties.housenumber) return false;
  const normalized = ` ${normalizeAddress(address)} `;
  return normalized.includes(` ${normalizeAddress(properties.street)} `)
    && normalized.includes(` ${normalizeAddress(properties.housenumber)} `);
}
