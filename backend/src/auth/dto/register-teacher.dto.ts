import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterTeacherDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  passwordConfirm: string;

  @IsNotEmpty()
  @IsString()
  registrationCode: string;
}
