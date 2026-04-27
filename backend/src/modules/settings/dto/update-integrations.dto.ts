import { IsBoolean, IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateLlmSettingsDto {
  @IsOptional()
  @IsIn(['none', 'ollama', 'openrouter'])
  provider?: 'none' | 'ollama' | 'openrouter';

  @IsOptional()
  @IsString()
  ollamaUrl?: string;

  @IsOptional()
  @IsString()
  ollamaModel?: string;

  @IsOptional()
  @IsString()
  openrouterApiKey?: string;

  @IsOptional()
  @IsString()
  openrouterModel?: string;
}

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
