import { IsString, MinLength } from 'class-validator';

export class AttachTeacherDto {
  @IsString()
  @MinLength(4)
  inviteCode: string;
}
