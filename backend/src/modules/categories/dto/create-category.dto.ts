import { IsString, IsBoolean, IsOptional, IsArray } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  nameHe: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isIncome?: boolean;

  @IsOptional()
  @IsBoolean()
  isFixed?: boolean;

  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  @IsOptional()
  @IsArray()
  keywords?: string[];
}
