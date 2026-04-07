import {
  IsBoolean,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  largeExpenseThreshold?: number;

  @IsOptional()
  @IsBoolean()
  budgetWarningEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  budgetExceededEnabled?: boolean;

  /** First calendar day (Israel) of salary deposit that counts toward next month cash-flow */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  salaryStartDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  salaryEndDay?: number;

  @IsOptional()
  @IsBoolean()
  includePendingInBudget?: boolean;

  @IsOptional()
  @IsBoolean()
  includePendingInDashboard?: boolean;

  @IsOptional()
  @IsBoolean()
  excludeCreditCardChargesFromBudget?: boolean;
}
