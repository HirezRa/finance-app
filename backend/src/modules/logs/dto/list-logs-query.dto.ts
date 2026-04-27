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
}
