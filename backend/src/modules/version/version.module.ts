import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VersionService } from './version.service';
import { VersionGithubController } from './version.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ConfigModule, SettingsModule],
  controllers: [VersionGithubController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
