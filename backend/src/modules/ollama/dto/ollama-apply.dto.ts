import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

export class OllamaApplyItemDto {
  @IsString()
  transactionId: string;

  @IsString()
  categoryId: string;
}

export class OllamaApplyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OllamaApplyItemDto)
  suggestions: OllamaApplyItemDto[];
}
