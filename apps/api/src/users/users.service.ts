import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Task, User } from '@prisma/client';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

type SafeUser = Omit<User, 'passwordHash'>;
type RemainingProfileUpdate = Omit<UpdateUserDto, 'timezone'>;

interface SeriesTimezonePlan {
  wallClock: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return this.withoutPassword(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    if (dto.timezone !== undefined) {
      const { timezone, ...remaining } = dto;
      return this.syncTimezone(id, timezone, remaining);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return this.withoutPassword(user);
  }

  /**
   * Adopts the authenticated smartphone's IANA zone. The first sync repairs
   * legacy profile ownership without guessing old one-off wall-clock intent.
   * Later zone changes preserve the local calendar date/time of untouched
   * future plan rows and active recurrence projections.
   */
  async syncTimezone(
    id: string,
    timezone: string,
    remaining: RemainingProfileUpdate = {},
  ): Promise<SafeUser> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Пользователь не найден');

    const trustedPreviousZone = Boolean(
      current.timezoneSyncedAt && this.isValidTimezone(current.timezone),
    );
    const timezoneChanged = current.timezone !== timezone;
    const hasRemainingUpdate = Object.keys(remaining).length > 0;

    if (trustedPreviousZone && !timezoneChanged && !hasRemainingUpdate) {
      return this.withoutPassword(current);
    }

    const now = new Date();
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const seriesRows = await tx.task.findMany({
        where: {
          userId: id,
          parentTaskId: null,
          seriesId: null,
          isRecurring: true,
          recurrenceEndedAt: null,
          startTime: { not: null },
        },
      });

      const seriesPlans = new Map<string, SeriesTimezonePlan>();
      if (timezoneChanged) {
        for (const series of seriesRows) {
          const sourceZone = trustedPreviousZone
            ? this.validZoneOr(series.recurrenceTimezone, current.timezone)
            : timezone;
          const wallClock = formatInTimeZone(series.startTime!, sourceZone, 'HH:mm:ss.SSS');
          seriesPlans.set(series.id, { wallClock });

          const anchorDateKey = series.recurrenceDateKey ??
            formatInTimeZone(series.startTime!, sourceZone, 'yyyy-MM-dd');
          await tx.task.update({
            where: { id: series.id },
            data: {
              recurrenceTimezone: timezone,
              ...(trustedPreviousZone
                ? { startTime: fromZonedTime(`${anchorDateKey}T${wallClock}`, timezone) }
                : {}),
            },
          });
        }
      }

      const movedIds: string[] = [];
      if (timezoneChanged) {
        const futureRows = await tx.task.findMany({
          where: {
            userId: id,
            parentTaskId: null,
            isRecurring: false,
            startTime: { gt: now },
            startedAt: null,
            completedAt: null,
          },
        });

        for (const task of futureRows) {
          let nextStartTime: Date | null = null;
          const seriesPlan = task.seriesId ? seriesPlans.get(task.seriesId) : undefined;

          if (seriesPlan && task.recurrenceDateKey) {
            nextStartTime = fromZonedTime(
              `${task.recurrenceDateKey}T${seriesPlan.wallClock}`,
              timezone,
            );
          } else if (trustedPreviousZone) {
            nextStartTime = this.preserveWallClock(
              task.startTime!,
              current.timezone,
              timezone,
            );
          }

          if (!nextStartTime || nextStartTime.getTime() === task.startTime!.getTime()) {
            continue;
          }
          await tx.task.update({
            where: { id: task.id },
            data: { startTime: nextStartTime },
          });
          movedIds.push(task.id);
        }
      }

      const user = await tx.user.update({
        where: { id },
        data: {
          ...remaining,
          timezone,
          timezoneSyncedAt: now,
        },
      });
      return { user, movedIds };
    });

    await this.reconcileReminders(transactionResult.movedIds);
    return this.withoutPassword(transactionResult.user);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  private preserveWallClock(instant: Date, oldTimezone: string, newTimezone: string): Date {
    const localDateTime = formatInTimeZone(
      instant,
      oldTimezone,
      "yyyy-MM-dd'T'HH:mm:ss.SSS",
    );
    return fromZonedTime(localDateTime, newTimezone);
  }

  private validZoneOr(candidate: string | null, fallback: string): string {
    return candidate && this.isValidTimezone(candidate) ? candidate : fallback;
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }

  private async reconcileReminders(taskIds: string[]): Promise<void> {
    if (!taskIds.length) return;
    try {
      const tasks = await this.prisma.task.findMany({ where: { id: { in: taskIds } } });
      await Promise.all(tasks.map((task) => this.reconcileReminder(task)));
    } catch {
      // Task/profile persistence already committed. Queue reconciliation is a
      // best-effort secondary effect and must not make the sync look rolled back.
      this.logger.error('Timezone reminder reconciliation lookup failed');
    }
  }

  private async reconcileReminder(task: Task): Promise<void> {
    try {
      if (task.kind !== 'TASK' || task.completedAt || task.startedAt || !task.startTime) {
        await this.notifications.cancelTaskReminder(task.id);
      } else {
        await this.notifications.scheduleTaskReminder(task);
      }
    } catch {
      this.logger.error(`Timezone reminder reconciliation failed for task ${task.id}`);
    }
  }

  private withoutPassword(user: User): SafeUser {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
