import { IsOptional, IsString, IsEmail, IsTimeZone, IsBoolean } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  @IsOptional()
  @IsString()
  expoPushToken?: string;
}
