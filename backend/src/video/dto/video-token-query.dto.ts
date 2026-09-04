import { IsUUID } from 'class-validator';

export class VideoTokenQueryDto {
  @IsUUID()
  slotId: string;
}
