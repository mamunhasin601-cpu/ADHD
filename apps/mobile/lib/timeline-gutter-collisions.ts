export type GutterLabelKind = 'started' | 'now' | 'task' | 'tick';

export type GutterLabelBounds = {
  id: string;
  kind: GutterLabelKind;
  top: number;
  height: number;
};

export type GutterCollisionResult = {
  visibleIds: Set<string>;
  hiddenIds: Set<string>;
};

const PRIORITY: Record<GutterLabelKind, number> = {
  started: 3,
  now: 2,
  task: 1,
  tick: 0,
};

function intersects(left: GutterLabelBounds, right: GutterLabelBounds, gap: number): boolean {
  return left.top < right.top + right.height + gap && right.top < left.top + left.height + gap;
}

/** Resolves known rendered label bounds; hidden winners may still reserve space. */
export function resolveTimelineGutterCollisions(
  labels: GutterLabelBounds[],
  gap = 2,
): GutterCollisionResult {
  const ordered = [...labels].sort((left, right) =>
    PRIORITY[right.kind] - PRIORITY[left.kind] || left.top - right.top || left.id.localeCompare(right.id));
  const accepted: GutterLabelBounds[] = [];
  const visibleIds = new Set<string>();
  const hiddenIds = new Set<string>();
  for (const label of ordered) {
    if (accepted.some((winner) => intersects(label, winner, gap))) {
      hiddenIds.add(label.id);
      continue;
    }
    accepted.push(label);
    visibleIds.add(label.id);
  }
  return { visibleIds, hiddenIds };
}

export function timelineGutterLabelHeight(fontScale: number, baseLineHeight = 15): number {
  const scale = Math.max(1, Math.min(fontScale || 1, 2.5));
  return Math.ceil(baseLineHeight * scale + 10);
}

/** Bounds include both the text pill and the marker circle around its real Y. */
export function timelineNowMarkerBounds(
  centerY: number,
  labelHeight: number,
  markerDiameter = 17,
): Pick<GutterLabelBounds, 'top' | 'height'> {
  const height = Math.max(labelHeight, markerDiameter) + 2;
  return { top: centerY - height / 2, height };
}
