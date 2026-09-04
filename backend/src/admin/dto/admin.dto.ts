import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateCodeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class BlockUserDto {
  @IsBoolean()
  isBlocked: boolean;
}

export class AssignTeacherDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  teacherId: string;
}
