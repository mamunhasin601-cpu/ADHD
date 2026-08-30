import { normalizeTaskColor, softTaskColor } from './task-color';

describe('task color treatment', () => {
  it('keeps valid colors as restrained alpha surfaces', () => {
    expect(softTaskColor('#12abEF', '#6B5BFC')).toBe('#12ABEF18');
  });

  it('falls back safely for malformed colors', () => {
    expect(normalizeTaskColor('urgent-red', '#6B5BFC')).toBe('#6B5BFC');
  });
});
