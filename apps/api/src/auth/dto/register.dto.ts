import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  password: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  // Хотя бы одно из полей обязательно
  @ValidateIf((o: RegisterDto) => !o.email && !o.phone)
  @IsString({ message: 'Нужен email или номер телефона' })
  _emailOrPhone?: never;
}
