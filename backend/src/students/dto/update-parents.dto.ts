import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateParentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentName?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  parentEmail?: string;
}
