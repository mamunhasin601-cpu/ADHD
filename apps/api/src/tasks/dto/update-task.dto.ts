import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsISO8601, IsIn } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['createRequestId'] as const)) {
  @IsOptional()
  @IsISO8601({}, { message: 'completedAt должен быть в формате ISO 8601' })
  completedAt?: string | null;

  @IsOptional()
  @IsIn(['ONLY_THIS', 'THIS_AND_FUTURE', 'ENTIRE_SERIES'])
  recurrenceEditScope?: 'ONLY_THIS' | 'THIS_AND_FUTURE' | 'ENTIRE_SERIES';
}
