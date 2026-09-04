import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTeacherProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subjects?: string;
}
