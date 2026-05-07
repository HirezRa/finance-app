import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ExportLogsQueryDto } from './dto/export-logs-query.dto';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { LogsService } from './logs.service';
import type { AppLogEntry } from './logs.types';

@Controller('logs')
@SkipThrottle()
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  list(@Query() query: ListLogsQueryDto): { logs: AppLogEntry[] } {
    const logs = this.logsService.query({
      level: query.level,
      category: query.category,
      q: query.q,
      limit: query.limit,
    });
    return { logs };
  }

  @Get('export')
  export(
    @Query() query: ExportLogsQueryDto,
  ): { logs: AppLogEntry[]; totalMatched: number } {
    return this.logsService.exportTrace({
      syncRunId: query.syncRunId,
      providerId: query.providerId,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }

  @Delete()
  @HttpCode(200)
  clear(): { success: boolean; messageHe: string } {
    this.logsService.clear();
    return { success: true, messageHe: 'הלוגים נוקו' };
  }
}
