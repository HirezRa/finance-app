import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  getAlerts(@CurrentUser('id') userId: string) {
    return this.alertsService.getUserAlerts(userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser('id') userId: string) {
    await this.alertsService.markAllAlertsRead(userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser('id') userId: string,
    @Param('id') alertId: string,
  ) {
    await this.alertsService.markAlertRead(userId, alertId);
  }
}
