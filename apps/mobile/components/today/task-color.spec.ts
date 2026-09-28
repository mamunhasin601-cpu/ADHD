import { normalizeTaskColor, softTaskColor, taskInkWash, taskTextColor } from './task-color';

describe('task color presentation', () => {
  it('preserves valid user-selected colors as the full-strength task fill', () => {
    expect(normalizeTaskColor('#ec4899', '#6B5BFC')).toBe('#EC4899');
    expect(softTaskColor('#10B981', '#6B5BFC')).toBe('#10B98118');
  });

  it.each([
    ['#6B5BFC', '#FFFFFF'],
    ['#EF4444', '#0F0C16'],
    ['#F97316', '#0F0C16'],
    ['#10B981', '#0F0C16'],
    ['#3B82F6', '#0F0C16'],
    ['#EC4899', '#0F0C16'],
    ['#84CC16', '#0F0C16'],
    ['#F59E0B', '#0F0C16'],
  ])('chooses contrast-aware ink for palette color %s', (background, ink) => {
    expect(taskTextColor(background, '#6B5BFC')).toBe(ink);
  });

  it('falls back safely and can derive a tone-on-tone wash', () => {
    expect(taskTextColor('not-a-color', '#6B5BFC')).toBe('#FFFFFF');
    expect(taskInkWash('#FFFFFF', '24')).toBe('#FFFFFF24');
  });
});
