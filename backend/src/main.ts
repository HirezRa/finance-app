import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { registerRequestLogging } from './common/http/register-request-logging';
import { LogsService } from './modules/logs/logs.service';
import { getVersion } from './version';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  await app.register(helmet, { contentSecurityPolicy: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const appLogs = app.get(LogsService);
  registerRequestLogging(app, appLogs);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  appLogs.add('INFO', 'system', 'שרת ה-API זמין', {
    port,
    version: getVersion(),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
