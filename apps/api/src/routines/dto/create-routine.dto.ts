import { IsString, IsArray, IsInt, Min, Max, ArrayNotEmpty } from 'class-validator';

export class CreateRoutineDto {
  @IsString()
  name: string;

  /** 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб */
  @IsArray()
  @ArrayNotEmpty({ message: 'Выберите хотя бы один день недели' })
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];
}
