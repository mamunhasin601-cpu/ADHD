export interface ElasticTimelineEntry {
  id: string;
  baseTop: number;
  baseHeight: number;
  minHeight: number;
}

export interface ElasticTimelineGeometry {
  top: number;
  height: number;
}

interface ExpansionCheckpoint {
  baseY: number;
  addedHeight: number;
}

export interface ElasticTimelineLayout {
  geometry: Map<string, ElasticTimelineGeometry>;
  displayY: (baseY: number) => number;
  addedHeight: number;
}

/**
 * Keeps chronological time proportional until a card needs more room, then
 * inserts space after its real end. All other timeline layers use the same
 * piecewise transform, so ticks, gaps, Now and auto-scroll stay aligned.
 * Truly overlapping intervals remain in their calendar columns as one cluster.
 */
export function computeElasticTimelineLayout(
  entries: ElasticTimelineEntry[],
  safeGap = 4,
): ElasticTimelineLayout {
  const normalized = entries
    .map((entry) => ({
      ...entry,
      baseTop: Math.max(0, entry.baseTop),
      baseHeight: Math.max(0, entry.baseHeight),
      minHeight: Math.max(0, entry.minHeight),
    }))
    .sort((a, b) => a.baseTop - b.baseTop || a.baseHeight - b.baseHeight || a.id.localeCompare(b.id));

  const checkpoints: ExpansionCheckpoint[] = [];
  const geometry = new Map<string, ElasticTimelineGeometry>();
  let addedHeight = 0;
  let index = 0;

  while (index < normalized.length) {
    const cluster = [normalized[index]];
    let clusterEnd = normalized[index].baseTop + normalized[index].baseHeight;
    index += 1;

    while (index < normalized.length && normalized[index].baseTop < clusterEnd) {
      cluster.push(normalized[index]);
      clusterEnd = Math.max(clusterEnd, normalized[index].baseTop + normalized[index].baseHeight);
      index += 1;
    }

    let renderedEnd = clusterEnd + addedHeight;
    for (const entry of cluster) {
      const height = Math.max(entry.baseHeight, entry.minHeight);
      const top = entry.baseTop + addedHeight;
      geometry.set(entry.id, { top, height });
      renderedEnd = Math.max(renderedEnd, top + height);
    }

    const expansion = Math.max(0, renderedEnd + safeGap - (clusterEnd + addedHeight));
    if (expansion > 0) {
      addedHeight += expansion;
      checkpoints.push({ baseY: clusterEnd, addedHeight });
    }
  }

  return {
    geometry,
    addedHeight,
    displayY(baseY: number) {
      let expansion = 0;
      for (const checkpoint of checkpoints) {
        if (checkpoint.baseY > baseY) break;
        expansion = checkpoint.addedHeight;
      }
      return baseY + expansion;
    },
  };
}

export function timelineGutterWidth(uses12Hour: boolean, fontScale: number): number {
  const safeScale = Math.max(1, Math.min(fontScale || 1, 2.5));
  return Math.ceil(uses12Hour ? 54 + safeScale * 20 : 46 + safeScale * 12);
}
