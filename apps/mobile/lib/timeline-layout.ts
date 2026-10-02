import type { Task } from '@focus/shared-types';
import { TIMELINE_CONFIG } from './timeline-config';
import { getTimelineMinutesFromStart } from './timeline-geometry';
import { isTaskRecord } from './task-kind';

export interface TaskLayout {
  columnIndex: number;
  columnCount: number;
}

export interface TimelineConflictGroup {
  id: string;
  taskIds: string[];
  labelTaskId: string;
}

/** Layout-only interval represented by the existing minimum readable height. */
export const UNKNOWN_DURATION_LAYOUT_MINUTES =
  (TIMELINE_CONFIG.minBlockHeight / TIMELINE_CONFIG.hourHeight) * 60;

/**
 * Раскладка пересекающихся по времени задач в колонки (как в календарях).
 * Задачи без пересечений остаются в одной колонке на всю ширину.
 */
export function computeTimelineLayout(
  tasks: Task[],
  profileTimezone?: string | null,
): Map<string, TaskLayout> {
  const layout = new Map<string, TaskLayout>();

  const intervals = tasks
    .filter((task) => !!task.startTime)
    .map((task) => {
      const start = getTimelineMinutesFromStart(
        new Date(task.startTime as unknown as string),
        profileTimezone,
      );
      return {
        task,
        start,
        end: start + (task.durationMinutes ?? UNKNOWN_DURATION_LAYOUT_MINUTES),
      };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let clusterStart = 0;
  let clusterEnd = -Infinity;

  function flushCluster(cluster: typeof intervals) {
    if (cluster.length === 0) return;

    const columnEnds: number[] = [];
    const columnIndexByTaskId = new Map<string, number>();

    for (const interval of cluster) {
      let placed = false;
      for (let col = 0; col < columnEnds.length; col++) {
        if (columnEnds[col] <= interval.start) {
          columnEnds[col] = interval.end;
          columnIndexByTaskId.set(interval.task.id, col);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columnEnds.push(interval.end);
        columnIndexByTaskId.set(interval.task.id, columnEnds.length - 1);
      }
    }

    const columnCount = columnEnds.length;
    for (const interval of cluster) {
      layout.set(interval.task.id, {
        columnIndex: columnIndexByTaskId.get(interval.task.id) ?? 0,
        columnCount,
      });
    }
  }

  let cluster: typeof intervals = [];
  for (const interval of intervals) {
    if (cluster.length === 0 || interval.start < clusterEnd) {
      cluster.push(interval);
      clusterEnd = Math.max(clusterEnd, interval.end);
    } else {
      flushCluster(cluster);
      cluster = [interval];
      clusterStart = interval.start;
      clusterEnd = interval.end;
    }
  }
  flushCluster(cluster);
  void clusterStart;

  return layout;
}

/** Connected overlap groups for legacy/imported task data. */
export function computeTimelineConflictGroups(
  tasks: Task[],
  profileTimezone?: string | null,
): TimelineConflictGroup[] {
  const intervals = tasks
    .filter((task) => isTaskRecord(task) && task.startTime && !(task.isRecurring && !task.seriesId))
    .map((task) => {
      const start = getTimelineMinutesFromStart(new Date(task.startTime!), profileTimezone);
      const duration = typeof task.durationMinutes === 'number' && Number.isFinite(task.durationMinutes) && task.durationMinutes > 0
        ? task.durationMinutes
        : UNKNOWN_DURATION_LAYOUT_MINUTES;
      return { task, start, end: start + duration };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end || left.task.id.localeCompare(right.task.id));

  const groups: TimelineConflictGroup[] = [];
  let cluster: typeof intervals = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (cluster.length > 1) {
      const taskIds = cluster.map(({ task }) => task.id);
      groups.push({ id: `conflict:${taskIds.join(':')}`, taskIds, labelTaskId: taskIds[0] });
    }
  };
  for (const interval of intervals) {
    if (cluster.length === 0 || interval.start < clusterEnd) {
      cluster.push(interval);
      clusterEnd = Math.max(clusterEnd, interval.end);
    } else {
      flush();
      cluster = [interval];
      clusterEnd = interval.end;
    }
  }
  flush();
  return groups;
}
