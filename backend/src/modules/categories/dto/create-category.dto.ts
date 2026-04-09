import { IsString, IsBoolean, IsOptional, IsArray, IsNumber, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

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

  /** יעד הוצאה חודשי (אופציונלי); null מנקה את היעד */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) return null;
    if (value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  monthlyTarget?: number | null;
}
