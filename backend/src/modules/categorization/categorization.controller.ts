import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CategorizationService } from './categorization.service';
import { VendorMappingService } from './vendor-mapping.service';

@Controller('categorization')
@UseGuards(JwtAuthGuard)
export class CategorizationController {
  constructor(
    private readonly categorizationService: CategorizationService,
    private readonly vendorMappingService: VendorMappingService,
  ) {}

  @Post('quick')
  async quickCategorize(
    @CurrentUser('id') userId: string,
    @Body() body: { transactionIds?: string[] },
  ) {
    return this.categorizationService.quickCategorize(
      userId,
      body?.transactionIds,
    );
  }

  @Post('ai')
  async aiCategorize(
    @CurrentUser('id') userId: string,
    @Body() body: { transactionIds: string[] },
  ) {
    const ids = body?.transactionIds ?? [];
    const results = await this.categorizationService.aiCategorize(userId, ids);
    return { results };
  }

  @Post('full')
  async fullCategorize(@CurrentUser('id') userId: string) {
    return this.categorizationService.fullCategorize(userId);
  }

  @Post('apply')
  async applyResults(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      results: Array<{
        transactionId: string;
        categoryId: string;
        source: string;
      }>;
    },
  ) {
    return this.categorizationService.applyCategorizationResults(
      userId,
      body?.results ?? [],
    );
  }

  @Get('vendor-stats')
  async getVendorStats(@CurrentUser('id') userId: string) {
    return this.vendorMappingService.getMappingStats(userId);
  }

  @Get('uncategorized-count')
  async getUncategorizedCount(@CurrentUser('id') userId: string) {
    const count = await this.categorizationService.countUncategorized(userId);
    return { count };
  }
}
