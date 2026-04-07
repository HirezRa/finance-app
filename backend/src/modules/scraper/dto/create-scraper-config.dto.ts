import { IsString, IsObject, IsNotEmpty } from 'class-validator';

export class CreateScraperConfigDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  companyDisplayName: string;

  @IsObject()
  @IsNotEmpty()
  credentials: Record<string, unknown>;
}
