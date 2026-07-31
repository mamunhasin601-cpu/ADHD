import { IsString, IsOptional } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}
