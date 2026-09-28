export function normalizeTaskColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;
}

export function softTaskColor(value: unknown, fallback: string): string {
  return `${normalizeTaskColor(value, fallback)}18`;
}

const LIGHT_TASK_TEXT = '#FFFFFF';
const DARK_TASK_TEXT = '#0F0C16';

function relativeLuminance(color: string): number {
  const hex = color.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Keeps the exact user-selected fill while choosing readable ink for it. */
export function taskTextColor(value: unknown, fallback: string): string {
  const background = normalizeTaskColor(value, fallback);
  return contrastRatio(LIGHT_TASK_TEXT, background) >= contrastRatio(DARK_TASK_TEXT, background)
    ? LIGHT_TASK_TEXT
    : DARK_TASK_TEXT;
}

/** A translucent tone-on-tone surface that remains derived from task ink. */
export function taskInkWash(textColor: string, opacityHex = '20'): string {
  return `${normalizeTaskColor(textColor, DARK_TASK_TEXT)}${opacityHex}`;
}
