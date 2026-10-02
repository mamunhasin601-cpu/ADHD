export type TaskProgressAnimationContext = {
  previousProgress: number;
  nextProgress: number;
  previousStartedAt: string | null;
  nextStartedAt: string | null;
  animationEnabled: boolean;
  appIsActive: boolean;
  reduceMotion: boolean;
};

export function clampTaskProgress(progress: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}

/**
 * Maps area fraction to the x/w + y/h diagonal threshold. This makes the
 * visible polygon area linear in elapsed progress instead of merely moving a
 * diagonal by a linear coordinate.
 */
export function diagonalProgressThreshold(progress: number): number {
  const value = clampTaskProgress(progress);
  return value <= 0.5
    ? Math.sqrt(2 * value)
    : 2 - Math.sqrt(2 * (1 - value));
}

function pointAlong(
  from: readonly [number, number],
  to: readonly [number, number],
  fraction: number,
): [number, number] {
  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction,
  ];
}

function boundaryPath(
  from: readonly [number, number],
  to: readonly [number, number],
  waveAmplitude: number,
): string {
  if (!waveAmplitude) return `L ${to[0]} ${to[1]}`;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const midpoint = pointAlong(from, to, 0.5);
  const firstControl = pointAlong(from, to, 0.25);
  const secondControl = pointAlong(from, to, 0.75);
  return [
    `Q ${firstControl[0] + normalX * waveAmplitude} ${firstControl[1] + normalY * waveAmplitude} ${midpoint[0]} ${midpoint[1]}`,
    `Q ${secondControl[0] - normalX * waveAmplitude} ${secondControl[1] - normalY * waveAmplitude} ${to[0]} ${to[1]}`,
  ].join(' ');
}

/** SVG path for a top-left → bottom-right fill with a settling diagonal edge. */
export function diagonalProgressPath(
  progress: number,
  width = 100,
  height = 100,
  waveAmplitude = 0,
): string {
  const value = clampTaskProgress(progress);
  if (value === 0 || width <= 0 || height <= 0) return '';
  if (value === 1) return `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;

  const threshold = diagonalProgressThreshold(value);
  if (threshold <= 1) {
    const top: [number, number] = [threshold * width, 0];
    const left: [number, number] = [0, threshold * height];
    return `M 0 0 L ${top[0]} ${top[1]} ${boundaryPath(top, left, waveAmplitude)} Z`;
  }

  const right: [number, number] = [width, (threshold - 1) * height];
  const bottom: [number, number] = [(threshold - 1) * width, height];
  return `M 0 0 L ${width} 0 L ${right[0]} ${right[1]} ${boundaryPath(right, bottom, waveAmplitude)} L 0 ${height} Z`;
}

export function shouldAnimateTaskProgress(context: TaskProgressAnimationContext): boolean {
  if (!context.animationEnabled || !context.appIsActive || context.reduceMotion) return false;
  if (!context.nextStartedAt) return false;
  const explicitStart = context.previousStartedAt === null && context.nextStartedAt !== null;
  const minuteAdvance = context.nextProgress > context.previousProgress;
  return explicitStart || minuteAdvance;
}
