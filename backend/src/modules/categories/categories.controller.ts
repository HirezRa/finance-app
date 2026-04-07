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
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.categoriesService.findAll(userId);
  }

  @Get('income')
  getIncomeCategories(@CurrentUser('id') userId: string) {
    return this.categoriesService.getIncomeCategories(userId);
  }

  @Get('expenses')
  getExpenseCategories(@CurrentUser('id') userId: string) {
    return this.categoriesService.getExpenseCategories(userId);
  }

  @Get('check-duplicate')
  checkDuplicate(
    @CurrentUser('id') userId: string,
    @Query('name') name?: string,
    @Query('nameHe') nameHe?: string,
  ) {
    return this.categoriesService.checkDuplicate(userId, name, nameHe);
  }

  @Get('with-stats')
  getCategoriesWithStats(
    @CurrentUser('id') userId: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const month = monthStr !== undefined ? Number.parseInt(monthStr, 10) : undefined;
    const year = yearStr !== undefined ? Number.parseInt(yearStr, 10) : undefined;
    return this.categoriesService.getCategoriesWithStats(userId, month, year);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.categoriesService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ) {
    return this.categoriesService.update(id, userId, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.categoriesService.delete(id, userId);
  }
}
