import 'reflect-metadata';
import {
  IsString,
  IsOptional,
  IsISO8601,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsHexColor,
  IsUUID,
  IsTimeZone,
  IsIn,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TaskPartWriteDto } from './task-part-write.dto';

export const MAX_MANUAL_TASK_PARTS = 50;

@ValidatorConstraint({ name: 'validRecurrenceCombination', async: false })
class ValidRecurrenceCombination implements ValidatorConstraintInterface {
  validate(_title: string, args: ValidationArguments): boolean {
    const dto = args.object as CreateTaskDto;
    if (dto.isRecurring) return !!dto.startTime && !!dto.recurrenceRule && !dto.parentTaskId;
    return !dto.recurrenceRule;
  }

  defaultMessage(): string {
    return 'Повтор требует isRecurring=true, поддерживаемое правило, время и корневую задачу';
  }
}

export class CreateTaskDto {
  /** Retry identity for one owner-scoped root creation attempt; never a task id. */
  @IsOptional()
  @IsUUID('4', { message: 'createRequestId должен быть UUID v4' })
  createRequestId?: string;

  @IsString()
  @Validate(ValidRecurrenceCombination)
  title: string;

  @IsOptional()
  @IsIn(['TASK', 'REST', 'BUFFER'])
  kind?: 'TASK' | 'REST' | 'BUFFER';

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsString()
  @MaxLength(240)
  firstStep?: string | null;

  @IsOptional()
  @IsISO8601({}, { message: 'startTime должен быть в формате ISO 8601' })
  startTime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440) // макс 24 часа
  durationMinutes?: number | null;

  @IsOptional()
  @IsHexColor({ message: 'color должен быть в формате HEX (#RRGGBB)' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['FREQ=DAILY', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'], {
    message: 'Поддерживаются только ежедневное повторение и будни (Пн–Пт)',
  })
  recurrenceRule?: string | null;

  /** Explicit device fallback; used only when the profile timezone is invalid. */
  @IsOptional()
  @IsTimeZone({ message: 'deviceTimezone должен быть допустимым IANA timezone' })
  deviceTimezone?: string;

  @IsOptional()
  @IsBoolean()
  editRecurrenceAnchor?: boolean;

  @IsOptional()
  @IsBoolean()
  editRecurrencePattern?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'parentTaskId должен быть UUID' })
  parentTaskId?: string | null;

  /** When present, this is the complete authoritative draft for a root task. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MANUAL_TASK_PARTS, {
    message: `Можно добавить не больше ${MAX_MANUAL_TASK_PARTS} частей задачи`,
  })
  @ValidateNested({ each: true })
  @Type(() => TaskPartWriteDto)
  subTasks?: TaskPartWriteDto[];
}
