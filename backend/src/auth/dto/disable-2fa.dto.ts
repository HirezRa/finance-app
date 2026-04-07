import { IsString, IsNotEmpty } from 'class-validator';

export class Disable2faDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}
