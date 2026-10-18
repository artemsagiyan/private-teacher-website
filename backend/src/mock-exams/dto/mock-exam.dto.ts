import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ExamTrack } from '../../curriculum/entities/curriculum.entity';

export class CreateMockExamDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsEnum(ExamTrack)
  examTrack?: ExamTrack;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  count?: number;
}

export class MockExamAnswerDto {
  @IsUUID()
  taskId: string;

  @IsString()
  @MaxLength(5000)
  answer: string;
}

export class SubmitMockExamDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MockExamAnswerDto)
  answers: MockExamAnswerDto[];
}

export class GradeMockExamItemDto {
  @IsUUID()
  taskId: string;

  @IsBoolean()
  correct: boolean;
}
