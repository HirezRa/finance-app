import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  private readonly logger = new Logger(BudgetsController.name);

  constructor(private budgetsService: BudgetsService) {}

  @Get('history')
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('months') monthsStr?: string,
  ) {
    const months = monthsStr ? parseInt(monthsStr, 10) : 6;
    return this.budgetsService.getHistory(userId, Number.isNaN(months) ? 6 : months);
  }

  @Get()
  findByMonth(
    @CurrentUser('id') userId: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const month = monthStr !== undefined && monthStr !== '' ? parseInt(monthStr, 10) : undefined;
    const year = yearStr !== undefined && yearStr !== '' ? parseInt(yearStr, 10) : undefined;

    this.logger.log(`GET /budgets - month: ${month}, year: ${year}`);

    return this.budgetsService.findByMonthWithFallback(
      userId,
      month !== undefined && !Number.isNaN(month) ? month : undefined,
      year !== undefined && !Number.isNaN(year) ? year : undefined,
    );
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(userId, {
      month: dto.month,
      year: dto.year,
      categories: dto.categories,
    });
  }

  @Patch('categories/:id/order')
  updateCategoryOrder(
    @CurrentUser('id') userId: string,
    @Param('id') budgetCategoryId: string,
    @Body() body: { sortOrder?: number },
  ) {
    if (typeof body?.sortOrder !== 'number' || !Number.isFinite(body.sortOrder)) {
      throw new BadRequestException('sortOrder נדרש (מספר)');
    }
    return this.budgetsService.updateCategoryOrder(
      userId,
      budgetCategoryId,
      Math.trunc(body.sortOrder),
    );
  }

  @Patch('categories/:id/move')
  moveCategoryUpDown(
    @CurrentUser('id') userId: string,
    @Param('id') budgetCategoryId: string,
    @Body() body: { direction?: string },
  ) {
    if (body?.direction !== 'up' && body?.direction !== 'down') {
      throw new BadRequestException('direction חייב להיות up או down');
    }
    return this.budgetsService.moveCategoryUpDown(
      userId,
      budgetCategoryId,
      body.direction,
    );
  }

  @Patch(':budgetId/reorder')
  reorderCategories(
    @CurrentUser('id') userId: string,
    @Param('budgetId') budgetId: string,
    @Body() body: { orderedIds?: string[] },
  ) {
    const ids = body?.orderedIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('orderedIds נדרש (מערך מזהים)');
    }
    return this.budgetsService.reorderCategories(userId, budgetId, ids);
  }

  @Put(':month/:year')
  update(
    @CurrentUser('id') userId: string,
    @Param('month') monthStr: string,
    @Param('year') yearStr: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(
      userId,
      parseInt(monthStr, 10),
      parseInt(yearStr, 10),
      dto,
    );
  }

  @Post(':month/:year/copy-previous')
  copyFromPrevious(
    @CurrentUser('id') userId: string,
    @Param('month') monthStr: string,
    @Param('year') yearStr: string,
  ) {
    return this.budgetsService.copyFromPreviousMonth(
      userId,
      parseInt(monthStr, 10),
      parseInt(yearStr, 10),
    );
  }

  @Delete(':month/:year')
  delete(
    @CurrentUser('id') userId: string,
    @Param('month') monthStr: string,
    @Param('year') yearStr: string,
  ) {
    return this.budgetsService.delete(
      userId,
      parseInt(monthStr, 10),
      parseInt(yearStr, 10),
    );
  }
}
