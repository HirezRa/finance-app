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

  @Delete()
  @HttpCode(200)
  clear(): { success: boolean; messageHe: string } {
    this.logsService.clear();
    return { success: true, messageHe: 'הלוגים נוקו' };
  }
}
