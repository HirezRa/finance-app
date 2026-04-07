import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AlertsModule } from './modules/alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const urlStr = config.get<string>('REDIS_URL', 'redis://redis:6379');
        try {
          const u = new URL(urlStr);
          return {
            redis: {
              host: u.hostname,
              port: Number(u.port || 6379),
              password: u.password
                ? decodeURIComponent(u.password)
                : undefined,
            },
          };
        } catch {
          return { redis: { host: 'redis', port: 6379 } };
        }
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EncryptionModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ScraperModule,
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
    DashboardModule,
    BudgetsModule,
    SettingsModule,
    AlertsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
