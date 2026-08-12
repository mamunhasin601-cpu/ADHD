import { IsOptional, IsISO8601, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Явная трансформация строк запроса в boolean.
 * enableImplicitConversion: true преобразует любую непустую строку в true,
 * поэтому ?inbox=invalid было бы принято. Этот трансформер пропускает только
 * 'true'/'false' и boolean-значения; остальное передаётся в @IsBoolean() который
 * отклоняет невалидные входные данные.
 */
function toBooleanStrict({ value }: { value: unknown }): unknown {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value; // @IsBoolean() отклонит нестроковые / неизвестные значения
}

export class GetTasksQueryDto {
  /** Фильтр по дате: получить задачи за конкретный день (ISO 8601 date, напр. "2026-07-23") */
  @IsOptional()
  @IsISO8601({}, { message: 'date должен быть в формате ISO 8601' })
  date?: string;

  /** Включить подзадачи в ответ */
  @IsOptional()
  @Transform(toBooleanStrict)
  @IsBoolean()
  includeSubTasks?: boolean;

  /** Только незавершённые */
  @IsOptional()
  @Transform(toBooleanStrict)
  @IsBoolean()
  incomplete?: boolean;

  /**
   * Inbox-режим: возвращает только root-задачи с startTime IS NULL.
   * При inbox=true параметр date игнорируется — Inbox не привязан к конкретному дню.
   * Используется хуком useInboxTasks и invalidation-ключом ['tasks', 'inbox'].
   */
  @IsOptional()
  @Transform(toBooleanStrict)
  @IsBoolean()
  inbox?: boolean;

  /**
   * Нижняя граница диапазона startTime (ISO 8601 instant, напр. "2026-07-23T00:00:00.000Z").
   * Используется для bounded bootstrap reconciliation (ADR-009).
   * Игнорируется при inbox=true.
   * Максимальный горизонт проверяется сервисом (30 дней от scheduledFrom).
   */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'scheduledFrom должен быть ISO 8601 instant' })
  scheduledFrom?: string;

  /**
   * Верхняя граница диапазона startTime (ISO 8601 instant, напр. "2026-07-30T23:59:59.999Z").
   * Требует наличия scheduledFrom. Максимально допустимый горизонт — 30 дней от scheduledFrom.
   * Игнорируется при inbox=true и при отсутствии scheduledFrom.
   */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'scheduledTo должен быть ISO 8601 instant' })
  scheduledTo?: string;
}
