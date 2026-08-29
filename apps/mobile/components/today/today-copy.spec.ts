import { greetingForDate, progressSupport } from './today-copy';

describe('Today copy', () => {
  it('uses calm non-today wording', () => {
    expect(greetingForDate(false, new Date(), 'UTC')).toBe('План на день');
  });

  it('uses a valid profile-local hour', () => {
    expect(
      greetingForDate(true, new Date('2026-08-15T03:00:00Z'), 'Europe/Moscow'),
    ).toBe('Доброе утро');
  });

  it('falls back to device-local hour for missing and invalid timezone', () => {
    const now = new Date(2026, 7, 15, 13);
    expect(greetingForDate(true, now)).toBe('Добрый день');
    expect(greetingForDate(true, now, 'invalid/zone')).toBe('Добрый день');
  });

  it('has factual supportive zero, partial and complete copy', () => {
    expect(progressSupport(0, 0)).toContain('небольшого шага');
    expect(progressSupport(1, 3)).toContain('1 из 3');
    expect(progressSupport(3, 3)).toBe('План на день завершён.');
    expect(
      [progressSupport(0, 0), progressSupport(0, 2), progressSupport(1, 2)].join(' '),
    ).not.toMatch(/вина|провал|неудач/i);
  });
});
