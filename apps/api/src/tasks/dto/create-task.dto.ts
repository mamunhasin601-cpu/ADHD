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
  IsIn,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
  @IsString()
  @Validate(ValidRecurrenceCombination)
  title: string;

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

  @IsOptional()
  @IsUUID('4', { message: 'parentTaskId должен быть UUID' })
  parentTaskId?: string | null;
}
