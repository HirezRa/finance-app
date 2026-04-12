import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveGithubReleaseTokenDto {
  @IsString()
  @MinLength(8, { message: 'הטוקן קצר מדי' })
  @MaxLength(4000)
  token!: string;
}
