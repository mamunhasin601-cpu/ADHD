import { IsDateString } from 'class-validator';

export class ExtendRecurrenceDto {
  @IsDateString({ strict: true }, { message: 'date должен быть календарной датой YYYY-MM-DD' })
  date: string;
}
