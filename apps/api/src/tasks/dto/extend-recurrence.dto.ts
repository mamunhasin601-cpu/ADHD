import { IsOptional, IsTimeZone } from 'class-validator';

export class ExtendRecurrenceDto {
  @IsOptional()
  @IsTimeZone({ message: 'deviceTimezone должен быть допустимым IANA timezone' })
  deviceTimezone?: string;
}
