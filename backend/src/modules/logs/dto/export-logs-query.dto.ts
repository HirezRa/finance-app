import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const EXPORT_PRESETS = ['diagnostic'] as const;

export class ExportLogsQueryDto {
  @IsOptional()
  @IsUUID()
  syncRunId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  /** sync|scraper|version|update + WARN|ERROR only — reduces DEBUG/api noise */
  @IsOptional()
  @IsIn([...EXPORT_PRESETS])
  preset?: (typeof EXPORT_PRESETS)[number];
}
