import { IsString, IsOptional } from 'class-validator';

export class SyncAccountDto {
  @IsString()
  @IsOptional()
  configId?: string;
}
