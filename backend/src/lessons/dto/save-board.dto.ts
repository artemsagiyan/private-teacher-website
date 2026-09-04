import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SaveBoardDto {
  @IsOptional()
  @IsArray()
  elements?: unknown[];

  @IsOptional()
  @IsObject()
  appState?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  files?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  revision?: number;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  savedAt?: string;
}
