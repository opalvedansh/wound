import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';

/**
 * One shared Redis connection for the cache, rate limits and idempotency keys (BullMQ opens its own).
 * Redis is an accelerator, never the source of truth: when REDIS_URL is unset or Redis is down, callers fall
 * back to the database, so the API keeps working, just slower.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis | null;

  /** The client, or null when Redis isn't configured or not connected right now. */
  get(): Redis | null {
    if (this.client === undefined) {
      const url = process.env['REDIS_URL'];
      if (!url) {
        this.logger.warn('REDIS_URL is not set: caching, rate limits and background jobs are off.');
        this.client = null;
      } else {
        this.client = new IORedis(url, {
          lazyConnect: false,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false, // fail fast instead of queueing commands while disconnected
          connectTimeout: 3000,
        });
        this.client.on('error', (error) => this.logger.warn(`Redis: ${error.message}`));
      }
    }
    return this.client && this.client.status === 'ready' ? this.client : null;
  }

  /** Runs a Redis command; on any failure returns `fallback` so a Redis outage never fails a request. */
  async safe<T>(run: (redis: Redis) => Promise<T>, fallback: T): Promise<T> {
    const redis = this.get();
    if (!redis) return fallback;
    try {
      return await run(redis);
    } catch {
      return fallback;
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit().catch(() => undefined);
  }
}
