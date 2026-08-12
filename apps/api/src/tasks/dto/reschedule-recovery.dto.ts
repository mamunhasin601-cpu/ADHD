import { IsArray, IsUUID, IsDefined, ValidateIf, IsISO8601, Matches, ValidateNested, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { FREE_TIER_LIMITS } from '@focus/shared-types';

/**
 * Absolute ISO-8601 instant: date + time + explicit UTC designator `Z` or a
 * numeric `±HH:MM` offset. Seconds and fractional seconds are optional.
 *
 * Why this exists (Task 0007A finding 2): `@IsISO8601()` alone also accepts
 * date-only values (`2026-08-06`) and offsetless datetimes
 * (`2026-08-06T10:00:00`). Both are ambiguous — the server would have to guess
 * a timezone to interpret them, which is exactly the silent reinterpretation
 * ADR-008 forbids. Only an unambiguous instant is accepted.
 */
const ABSOLUTE_ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Один элемент mapping для reschedule command
 */
export class RescheduleItemDto {
  @IsUUID()
  taskId: string;

  /**
   * targetStartTime:
   * - absolute ISO-8601 instant (`...Z` или `...±HH:MM`) → задача переносится
   *   на этот момент времени
   * - null → задача явно перемещается в Inbox (startTime = null)
   *
   * Отсутствующий ключ, date-only и datetime без offset отклоняются: «в Inbox»
   * выражается только явным `null`, а не отсутствием или неоднозначным значением.
   */
  @ValidateIf((item: RescheduleItemDto) => item.targetStartTime !== null)
  @IsDefined({
    message: 'targetStartTime must be explicitly provided as an ISO-8601 value or null',
  })
  @IsISO8601()
  @Matches(ABSOLUTE_ISO_INSTANT, {
    message:
      'targetStartTime must be an absolute ISO-8601 instant with an explicit ' +
      'UTC designator (Z) or numeric offset (+HH:MM); date-only and ' +
      'offsetless datetime values are ambiguous and rejected',
  })
  targetStartTime: string | null;
}

/**
 * POST /tasks/recovery/reschedule body
 */
export class RescheduleRecoveryDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'items array cannot be empty' })
  @ArrayMaxSize(FREE_TIER_LIMITS.maxActiveTasks, {
    message: `items array cannot exceed ${FREE_TIER_LIMITS.maxActiveTasks} tasks`,
  })
  @ValidateNested({ each: true })
  @Type(() => RescheduleItemDto)
  items: RescheduleItemDto[];
}