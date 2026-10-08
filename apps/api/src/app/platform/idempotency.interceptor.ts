import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import type { ClinicRequest } from '../auth/clinic.guard';
import { RedisService } from './redis.service';

const TTL_SECONDS = 24 * 60 * 60;
const PENDING = '__pending__';

type Claim = { replay: false } | { replay: true; body: unknown };

/**
 * Makes POSTs safe to retry: a client (above all the mobile app on a flaky network) sends the same
 * `Idempotency-Key` header with a retry and gets the first attempt's response instead of a duplicate record.
 * A retry while the first attempt is still running gets 409. Without the header, or without Redis, requests run
 * normally.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ClinicRequest & { method: string; originalUrl?: string }>();
    const header = request.headers['idempotency-key'];
    if (request.method !== 'POST' || typeof header !== 'string' || !header || header.length > 100) return next.handle();
    const key = `idem:${request.user?.id ?? 'anon'}:${request.originalUrl ?? ''}:${header}`;

    return from(this.claim(key)).pipe(
      switchMap((claim) =>
        claim.replay
          ? of(claim.body)
          : next.handle().pipe(
              tap({
                next: (body) => void this.redis.safe((r) => r.set(key, JSON.stringify(body ?? null), 'EX', TTL_SECONDS), null),
                // A failed attempt may be retried for real.
                error: () => void this.redis.safe((r) => r.del(key), 0),
              }),
            ),
      ),
    );
  }

  private async claim(key: string): Promise<Claim> {
    const claimed = await this.redis.safe((r) => r.set(key, PENDING, 'EX', TTL_SECONDS, 'NX'), 'NO_REDIS');
    if (claimed === 'NO_REDIS' || claimed === 'OK') return { replay: false };
    const stored = await this.redis.safe((r) => r.get(key), null);
    if (stored === PENDING) throw new ConflictException('This request is still being processed.');
    return { replay: true, body: stored ? (JSON.parse(stored) as unknown) : null };
  }
}
