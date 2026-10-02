import { IsTimeZone } from 'class-validator';

export class SyncTimezoneDto {
  @IsTimeZone({
    message: 'Некорректный часовой пояс (используйте формат IANA, напр. Europe/Samara)',
  })
  timezone: string;
}
