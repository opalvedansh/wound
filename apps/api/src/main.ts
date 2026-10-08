import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { JobsService } from './app/platform/jobs.service';

/**
 * WORKER_ONLY=1 runs background jobs without serving HTTP (scale workers separately from the API).
 * RUN_WORKERS=0 serves HTTP without running jobs (web instances behind a load balancer).
 * Defaults: one process does both, which suits a single free-tier instance.
 */
async function bootstrap() {
  if (process.env['WORKER_ONLY'] === '1') {
    const ctx = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
    ctx.useLogger(ctx.get(Logger));
    ctx.enableShutdownHooks();
    ctx.get(JobsService).startWorkers();
    return;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1); // real client IPs behind the host's proxy, for per-IP rate limits
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableShutdownHooks();

  // Browser clients: the web portal and the mobile app's web build. CORS_ORIGINS is a comma-separated list.
  const origins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'x-clinic-id'],
    // Browsers cache the preflight for 10 minutes instead of sending an OPTIONS before every call.
    maxAge: 600,
  });

  if (process.env['NODE_ENV'] !== 'production' || process.env['SWAGGER'] === '1') {
    const config = new DocumentBuilder().setTitle('Wound Care API').setVersion('2.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  // 3333: where the web portal and mobile app expect it (3000 is the web portal's own port).
  const port = Number(process.env['PORT'] || 3333);
  const server = await app.listen(port);
  // Longer than the load balancer's idle timeout, so it never reuses a socket the server has closed.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 120_000;

  if (process.env['RUN_WORKERS'] !== '0') app.get(JobsService).startWorkers();
  app.get(Logger).log(`API on http://localhost:${port}/api`);
}

bootstrap();
