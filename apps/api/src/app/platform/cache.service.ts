import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Read-through cache for expensive clinic-wide reads (dashboard, queue counts, catalogues).
 * Invalidation is by version: every write in a clinic bumps `v:<clinicId>`, and cached keys include the
 * version, so stale entries are never read again and simply expire. No key scanning, safe across API instances.
 */
@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  private version(clinicId: string): Promise<string> {
    return this.redis.safe(async (r) => (await r.get(`v:${clinicId}`)) ?? '0', 'none');
  }

  /** Cached value of `load()` for this clinic, for `ttlSeconds`; computed directly when Redis is unavailable. */
  async clinic<T>(clinicId: string, name: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const v = await this.version(clinicId);
    if (v === 'none') return load();
    const key = `c:${clinicId}:${v}:${name}`;
    const hit = await this.redis.safe((r) => r.get(key), null);
    if (hit !== null) return JSON.parse(hit) as T;
    const value = await load();
    await this.redis.safe((r) => r.set(key, JSON.stringify(value), 'EX', ttlSeconds), null);
    return value;
  }

  /** Cached value of `load()` under a global key (not clinic data, e.g. the question catalogue). */
  async global<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.redis.safe((r) => r.get(`g:${key}`), null);
    if (hit !== null) return JSON.parse(hit) as T;
    const value = await load();
    await this.redis.safe((r) => r.set(`g:${key}`, JSON.stringify(value), 'EX', ttlSeconds), null);
    return value;
  }

  /** Call after any write in a clinic: every cached read for it becomes stale at once. */
  async bump(clinicId: string): Promise<void> {
    await this.redis.safe((r) => r.incr(`v:${clinicId}`), 0);
  }

  async drop(key: string): Promise<void> {
    await this.redis.safe((r) => r.del(`g:${key}`), 0);
  }
}
