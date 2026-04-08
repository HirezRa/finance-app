import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() query: GetTransactionsDto) {
    return this.transactionsService.findAll(userId, query);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(userId, dto);
  }

  @Post('recategorize-all')
  recategorizeAll(@CurrentUser('id') userId: string) {
    return this.transactionsService.recategorizeAll(userId);
  }

  @Patch('bulk/category')
  bulkUpdateCategory(
    @CurrentUser('id') userId: string,
    @Body() body: { transactionIds: string[]; categoryId: string },
  ) {
    return this.transactionsService.bulkUpdateCategory(
      userId,
      body.transactionIds,
      body.categoryId,
    );
  }

  @Get('installments-summary')
  getInstallmentsSummary(@CurrentUser('id') userId: string) {
    return this.transactionsService.getInstallmentsSummary(userId);
  }

  @Delete('all')
  deleteAllTransactions(@CurrentUser('id') userId: string) {
    return this.transactionsService.deleteAllTransactions(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.transactionsService.findOne(id, userId);
  }

  @Patch(':id/note')
  updateNote(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { note?: string | null },
  ) {
    const n = body?.note;
    return this.transactionsService.updateNote(
      id,
      userId,
      n === undefined || n === '' ? null : n,
    );
  }

  @Patch(':id/exclude')
  toggleExcludeFromCashFlow(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { exclude?: boolean },
  ) {
    if (typeof body?.exclude !== 'boolean') {
      throw new BadRequestException('exclude נדרש (boolean)');
    }
    return this.transactionsService.toggleExcludeFromCashFlow(
      id,
      userId,
      body.exclude,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, userId, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.transactionsService.delete(id, userId);
  }
}
