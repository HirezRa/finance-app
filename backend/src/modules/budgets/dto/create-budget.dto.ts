import {
  IsInt,
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetCategoryItemDto {
  @IsString()
  categoryId: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateBudgetDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  year: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryItemDto)
  categories: BudgetCategoryItemDto[];
}
