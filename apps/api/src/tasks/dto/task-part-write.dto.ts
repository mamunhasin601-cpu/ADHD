import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** The bounded, user-authored part draft accepted by root task writes. */
export class TaskPartWriteDto {
  /** Existing part UUID only. New parts must omit this field. */
  @IsOptional()
  @IsUUID('4', { message: 'id части должен быть UUID' })
  id?: string;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1, { message: 'Название части не может быть пустым' })
  @MaxLength(240, { message: 'Название части слишком длинное' })
  title: string;

  /** Omitted means preserve an existing completion state, or incomplete for a new part. */
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
