import { IsEnum, IsString, IsUUID, Matches } from 'class-validator';

export enum ContactVerificationChannelDto {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export class StartContactVerificationDto {
  @IsEnum(ContactVerificationChannelDto)
  channel: ContactVerificationChannelDto;

  @IsString()
  destination: string;
}

export class ConfirmContactVerificationDto {
  @IsUUID()
  challengeId: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
