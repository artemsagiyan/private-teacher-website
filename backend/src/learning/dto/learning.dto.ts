import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExamTrack } from '../../curriculum/entities/curriculum.entity';
import { TopicAssessment } from '../entities/learning.entity';

export class UpdateLearningProfileDto {
  @IsEnum(ExamTrack)
  examTrack: ExamTrack;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  targetScore?: number | null;
}

export class ReviewTopicDto {
  @IsUUID()
  topicId: string;

  @IsEnum(TopicAssessment)
  assessment: TopicAssessment;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewMistakeDto {
  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsString()
  @MaxLength(2000)
  description: string;
}

export class UpdateLessonReviewDto {
  @IsInt()
  @Min(1)
  revision: number;

  @IsString()
  @MaxLength(10000)
  summary: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  achievements: string[];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  recommendations: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReviewTopicDto)
  topics: ReviewTopicDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReviewMistakeDto)
  mistakes: ReviewMistakeDto[];
}

export class HomeworkDraftItemDto {
  @IsUUID()
  taskId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rationale?: string;
}

export class UpdateHomeworkDraftDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HomeworkDraftItemDto)
  items: HomeworkDraftItemDto[];

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}

export class HomeworkAnswerDto {
  @IsUUID()
  itemId: string;

  @IsString()
  @MaxLength(5000)
  answer: string;
}

export class SubmitHomeworkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HomeworkAnswerDto)
  answers: HomeworkAnswerDto[];
}

export class GradeHomeworkItemDto {
  @IsBoolean()
  teacherCorrect: boolean;
}
