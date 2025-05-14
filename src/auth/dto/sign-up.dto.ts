import { IsString } from 'class-validator';

export class SignUpDto {
  @IsString()
  readonly name: string;

  @IsString()
  email: string;

  @IsString()
  password: string;
}
