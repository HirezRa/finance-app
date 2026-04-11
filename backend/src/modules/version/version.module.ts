import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VersionService } from './version.service';
import { VersionGithubController } from './version.controller';

@Module({
  imports: [ConfigModule],
  controllers: [VersionGithubController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
