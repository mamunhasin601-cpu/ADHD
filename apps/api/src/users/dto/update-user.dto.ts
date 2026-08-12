import { IsOptional, IsString, IsEmail, IsTimeZone, IsBoolean, IsEnum, ValidateIf } from 'class-validator';
import { TimeFormat } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsTimeZone({ message: 'Некорректный часовой пояс (используйте формат IANA, напр. Europe/Moscow)' })
  timezone?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TimeFormat, { message: 'Формат времени должен быть SYSTEM, H24 или H12' })
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  @IsOptional()
  @IsString()
  expoPushToken?: string;
}
