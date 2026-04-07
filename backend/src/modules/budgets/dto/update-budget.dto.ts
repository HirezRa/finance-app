import { IsArray, ValidateNested, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class BudgetCategoryItemDto {
  @IsString()
  categoryId: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class UpdateBudgetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryItemDto)
  categories: BudgetCategoryItemDto[];
}
