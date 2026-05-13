import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuthModule } from '../../auth/auth.module';
import { SalaryEffectiveDateHealService } from './salary-effective-date-heal.service';

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService, SalaryEffectiveDateHealService],
  exports: [SettingsService],
})
export class SettingsModule {}
