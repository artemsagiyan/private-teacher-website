import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { LessonType } from '../entities/calendar-slot.entity';

export class CreateSlotDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsEnum(LessonType)
  lessonType: LessonType;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
