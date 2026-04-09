import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { HistoryQueryDto } from './dto/history.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  private parseMonthYear(monthStr?: string, yearStr?: string) {
    const m = monthStr !== undefined && monthStr !== '' ? parseInt(monthStr, 10) : NaN;
    const y = yearStr !== undefined && yearStr !== '' ? parseInt(yearStr, 10) : NaN;
    const month = !Number.isNaN(m) && m >= 1 && m <= 12 ? m : undefined;
    const year = !Number.isNaN(y) && y >= 2000 && y <= 2100 ? y : undefined;
    return { month, year };
  }

  @Get('summary')
  getSummary(
    @CurrentUser('id') userId: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { month, year } = this.parseMonthYear(monthStr, yearStr);
    return this.dashboardService.getCashFlowSummary(userId, month, year);
  }

  @Get('weekly')
  getWeeklyBreakdown(
    @CurrentUser('id') userId: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { month, year } = this.parseMonthYear(monthStr, yearStr);
    return this.dashboardService.getWeeklyBreakdown(userId, month, year);
  }

  @Get('categories')
  getCategoryBreakdown(
    @CurrentUser('id') userId: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { month, year } = this.parseMonthYear(monthStr, yearStr);
    return this.dashboardService.getCategoryBreakdown(userId, month, year);
  }

  @Get('recent')
  getRecentTransactions(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getRecentTransactions(
      userId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('accounts')
  getAccountsOverview(@CurrentUser('id') userId: string) {
    return this.dashboardService.getAccountsOverview(userId);
  }

  @Get('history')
  getHistory(@CurrentUser('id') userId: string, @Query() query: HistoryQueryDto) {
    return this.dashboardService.getHistory(userId, query.months ?? 6);
  }
}
