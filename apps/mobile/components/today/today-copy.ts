import { isValidIANATimezone } from '../../lib/timezone';

export function greetingForDate(
  isToday: boolean,
  now: Date,
  profileTimezone?: string | null,
): string {
  if (!isToday) return 'План на день';

  let hour = now.getHours();
  if (profileTimezone && isValidIANATimezone(profileTimezone)) {
    const value = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: profileTimezone,
    }).format(now);
    hour = Number(value);
  }

  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function progressSupport(completed: number, total: number): string {
  const safeTotal = Math.max(
    0,
    Number.isFinite(total) ? Math.floor(total) : 0,
  );
  const safeCompleted = Math.min(
    safeTotal,
    Math.max(0, Number.isFinite(completed) ? Math.floor(completed) : 0),
  );

  if (safeTotal === 0) return 'Одного небольшого шага достаточно, чтобы начать.';
  if (safeCompleted === 0) return 'Можно выбрать один посильный шаг.';
  if (safeCompleted === safeTotal) return 'План на день завершён.';
  return `Готово ${safeCompleted} из ${safeTotal}. Продолжайте в удобном темпе.`;
}
