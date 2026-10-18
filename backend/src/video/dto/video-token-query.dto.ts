import { IsString, IsUUID, Length } from 'class-validator';

export class VideoTokenQueryDto {
  @IsUUID()
  slotId: string;
}

export class CameraLinkQueryDto {
  @IsUUID()
  lessonId: string;
}

export class CameraTokenQueryDto {
  @IsString()
  @Length(32, 1024)
  code: string;
}
