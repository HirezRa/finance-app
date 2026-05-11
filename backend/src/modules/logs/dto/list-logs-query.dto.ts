import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { LogCategory, LogLevel } from '../logs.types';

const LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
const LIST_PRESETS = ['diagnostic'] as const;

const CATEGORIES: LogCategory[] = [
  'sync',
  'account',
  'auth',
  'scraper',
  'ollama',
  'openrouter',
  'system',
  'api',
  'webhook',
  'categorization',
  'version',
  'update',
  'external-service',
];

export class ListLogsQueryDto {
  @IsOptional()
  @IsIn(LEVELS)
  level?: LogLevel;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: LogCategory;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsIn([...LIST_PRESETS])
  preset?: (typeof LIST_PRESETS)[number];
}
