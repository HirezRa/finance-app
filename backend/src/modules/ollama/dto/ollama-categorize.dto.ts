import { IsArray, IsIn, IsString } from 'class-validator';

export class OllamaCategorizeDto {
  @IsArray()
  @IsString({ each: true })
  transactionIds: string[];

  @IsIn(['uncategorized', 'improve'])
  mode: 'uncategorized' | 'improve';
}
