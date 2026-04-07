import { IsString, IsNotEmpty } from 'class-validator';

export class Enable2faDto {
  @IsString()
  @IsNotEmpty()
  secret: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}
