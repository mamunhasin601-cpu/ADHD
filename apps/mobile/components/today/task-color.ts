export function normalizeTaskColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;
}

export function softTaskColor(value: unknown, fallback: string): string {
  return `${normalizeTaskColor(value, fallback)}18`;
}
