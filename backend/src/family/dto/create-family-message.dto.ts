import { IsString, Length } from 'class-validator';

export class CreateFamilyMessageDto {
  @IsString()
  @Length(1, 3000)
  body: string;
}
