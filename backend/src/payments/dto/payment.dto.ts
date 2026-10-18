import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentStatus } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  studentId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount: number;

  @IsDateString()
  dueAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;
}

export class UpdatePaymentDto {
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
