import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import {
  UpdateOllamaSettingsDto,
  UpdateN8nSettingsDto,
  TestConnectionDto,
} from './dto/update-integrations.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getUserSettings(@CurrentUser('id') userId: string) {
    return this.settingsService.getUserSettings(userId);
  }

  @Patch()
  updateUserSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.settingsService.updateUserSettings(userId, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.settingsService.getUserProfile(userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() data: { name?: string },
  ) {
    return this.settingsService.updateUserProfile(userId, data);
  }

  @Get('integrations/ollama')
  getOllamaSettings(@CurrentUser('id') userId: string) {
    return this.settingsService.getOllamaSettings(userId);
  }

  @Patch('integrations/ollama')
  updateOllamaSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOllamaSettingsDto,
  ) {
    return this.settingsService.updateOllamaSettings(userId, dto);
  }

  @Post('integrations/ollama/test')
  testOllamaConnection(@Body() dto: TestConnectionDto) {
    return this.settingsService.testOllamaConnection(dto.url, dto.model);
  }

  @Get('integrations/n8n')
  getN8nSettings(@CurrentUser('id') userId: string) {
    return this.settingsService.getN8nSettings(userId);
  }

  @Patch('integrations/n8n')
  updateN8nSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateN8nSettingsDto,
  ) {
    return this.settingsService.updateN8nSettings(userId, dto);
  }

  @Post('integrations/n8n/test')
  testN8nWebhook(@Body() dto: { url: string; secret?: string }) {
    return this.settingsService.testN8nWebhook(dto.url, dto.secret);
  }
}
