import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class UpdateOllamaSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

export class UpdateN8nSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

export class TestConnectionDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  model?: string;
}
