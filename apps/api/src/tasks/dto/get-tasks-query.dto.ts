import { IsOptional, IsISO8601, IsBoolean } from 'class-validator';

export class GetTasksQueryDto {
  /** Фильтр по дате: получить задачи за конкретный день (ISO 8601 date, напр. "2026-07-23") */
  @IsOptional()
  @IsISO8601({}, { message: 'date должен быть в формате ISO 8601' })
  date?: string;

  /** Включить подзадачи в ответ */
  @IsOptional()
  @IsBoolean()
  includeSubTasks?: boolean;

  /** Только незавершённые */
  @IsOptional()
  @IsBoolean()
  incomplete?: boolean;
}
