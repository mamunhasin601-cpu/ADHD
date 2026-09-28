import { IsBoolean, IsOptional } from 'class-validator';

export class StartTaskDto {
  @IsOptional()
  @IsBoolean()
  confirmSwitch?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmEarlyStart?: boolean;
}
