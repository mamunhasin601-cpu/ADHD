import { computeElasticTimelineLayout, timelineGutterWidth } from './timeline-elastic-layout';

describe('elastic timeline layout', () => {
  it('separates adjacent dense cards and moves later coordinates through one transform', () => {
    const layout = computeElasticTimelineLayout([
      { id: 'a', baseTop: 0, baseHeight: 14, minHeight: 64 },
      { id: 'b', baseTop: 14, baseHeight: 14, minHeight: 64 },
    ]);

    expect(layout.geometry.get('a')).toEqual({ top: 0, height: 64 });
    expect(layout.geometry.get('b')?.top).toBe(68);
    expect(layout.displayY(14)).toBe(68);
    expect(layout.displayY(28)).toBe(136);
  });

  it('keeps real overlaps aligned as a column cluster', () => {
    const layout = computeElasticTimelineLayout([
      { id: 'a', baseTop: 10, baseHeight: 56, minHeight: 64 },
      { id: 'b', baseTop: 20, baseHeight: 28, minHeight: 64 },
    ]);

    expect(layout.geometry.get('a')?.top).toBe(10);
    expect(layout.geometry.get('b')?.top).toBe(20);
    expect(layout.displayY(66)).toBe(88);
  });

  it('keeps mixed adjacent 15, 30, and 45 minute cards disjoint after expansion', () => {
    const layout = computeElasticTimelineLayout([
      { id: '15m-completed', baseTop: 0, baseHeight: 14, minHeight: 64 },
      { id: '30m-task', baseTop: 14, baseHeight: 28, minHeight: 64 },
      { id: '45m-rest', baseTop: 42, baseHeight: 42, minHeight: 80 },
    ]);
    const cards = ['15m-completed', '30m-task', '45m-rest']
      .map((id) => layout.geometry.get(id)!);

    expect(cards[0].top + cards[0].height).toBeLessThan(cards[1].top);
    expect(cards[1].top + cards[1].height).toBeLessThan(cards[2].top);
    expect(layout.displayY(84)).toBeGreaterThan(cards[2].top + cards[2].height);
  });

  it('reserves a wider single-line gutter for 12-hour labels and large text', () => {
    expect(timelineGutterWidth(true, 2)).toBeGreaterThan(timelineGutterWidth(false, 2));
    expect(timelineGutterWidth(true, 2)).toBeGreaterThan(timelineGutterWidth(true, 1));
  });
});
