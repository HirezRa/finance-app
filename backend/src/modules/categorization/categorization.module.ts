import { Module } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { CategorizationController } from './categorization.controller';
import { VendorMappingService } from './vendor-mapping.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [PrismaModule, LLMModule, LogsModule],
  controllers: [CategorizationController],
  providers: [CategorizationService, VendorMappingService],
  exports: [CategorizationService, VendorMappingService],
})
export class CategorizationModule {}
