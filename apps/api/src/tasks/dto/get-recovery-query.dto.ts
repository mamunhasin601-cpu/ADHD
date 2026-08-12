import { IsOptional, IsDateString } from 'class-validator';

/**
 * Query параметры для GET /tasks/recovery
 * date необязателен — используется только для display reference,
 * server определяет overdue по live clock и user timezone
 */
export class GetRecoveryQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string; // YYYY-MM-DD format
}