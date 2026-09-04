import { IsUUID } from 'class-validator';
import { IsBoolean, IsOptional } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  slotId: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
