import { IsNotEmpty, IsString } from 'class-validator';

export class OauthExchangeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
