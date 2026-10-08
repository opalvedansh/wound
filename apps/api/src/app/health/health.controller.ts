import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/supabase-auth.guard';
import { RedisService } from '../platform/redis.service';
import { PrismaService } from '../prisma.service';

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function check(name: string, run: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await withTimeout(run(), 2000);
    return { name, ok: true, ms: Date.now() - started };
  } catch (error) {
    return { name, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Liveness (the process answers) and readiness (it can serve requests: database up). Used by the host's health check. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  live() {
    return { ok: true };
  }

  @Get('ready')
  async ready(@Res() res: Response) {
    const checks = await Promise.all([
      check('database', () => this.prisma.$queryRaw`SELECT 1`),
      check('redis', async () => {
        if (!process.env['REDIS_URL']) return;
        const r = this.redis.get();
        if (!r) throw new Error('not connected');
        await r.ping();
      }),
      check('model', async () => {
        const url = process.env['WOUND_API_URL'];
        if (!url) throw new Error('WOUND_API_URL not set');
        const response = await fetch(`${url.replace(/\/+$/, '')}/health`);
        if (!response.ok) throw new Error(`status ${response.status}`);
      }),
    ]);
    // Only the database is required to serve; Redis and the model degrade gracefully.
    const ready = checks.find((c) => c.name === 'database')?.ok ?? false;
    res.status(ready ? 200 : 503).json({ status: checks.every((c) => c.ok) ? 'ok' : ready ? 'degraded' : 'down', checks });
  }
}
