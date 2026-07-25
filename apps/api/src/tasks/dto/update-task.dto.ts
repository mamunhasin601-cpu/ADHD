import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsISO8601 } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional()
  @IsISO8601({}, { message: 'completedAt должен быть в формате ISO 8601' })
  completedAt?: string | null;
}
