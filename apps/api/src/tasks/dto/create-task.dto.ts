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
  Matches,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

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
  @Matches(/^FREQ=/, { message: 'recurrenceRule должен быть в формате iCal RRULE (начинаться с FREQ=)' })
  recurrenceRule?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'parentTaskId должен быть UUID' })
  parentTaskId?: string | null;
}
