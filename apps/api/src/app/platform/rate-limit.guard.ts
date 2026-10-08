import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ClinicRequest } from '../auth/clinic.guard';
import { RedisService } from './redis.service';

const LIMIT = 'rateLimit';

export interface RateLimit {
  /** Requests allowed per window. */
  max: number;
  windowSeconds: number;
  /** Separate counter name, so e.g. uploads have their own budget. */
  bucket: string;
}

/** A tighter (or looser) limit for one route than the default. */
export const Limit = (limit: RateLimit) => SetMetadata(LIMIT, limit);

const DEFAULT: RateLimit = { max: 300, windowSeconds: 60, bucket: 'api' };

/**
 * Fixed-window rate limit in Redis, per signed-in user (or per IP for public routes), shared by every API
 * instance. Fails open: if Redis is down, requests are allowed rather than blocked.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limit = this.reflector.getAllAndOverride<RateLimit>(LIMIT, [context.getHandler(), context.getClass()]) ?? DEFAULT;
    const http = context.switchToHttp();
    const request = http.getRequest<ClinicRequest & { ip?: string }>();
    const who = request.user?.id ?? `ip:${request.ip ?? 'unknown'}`;
    const window = Math.floor(Date.now() / 1000 / limit.windowSeconds);
    const key = `rl:${limit.bucket}:${who}:${window}`;

    const count = await this.redis.safe(async (r) => {
      const [[, n]] = (await r.multi().incr(key).expire(key, limit.windowSeconds + 1).exec()) as [[unknown, number]];
      return n;
    }, 0);
    const response = http.getResponse<{ setHeader(name: string, value: string): void }>();
    response.setHeader('RateLimit-Limit', String(limit.max));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, limit.max - count)));
    if (count > limit.max) {
      throw new HttpException({ message: 'Too many requests. Wait a moment and try again.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
