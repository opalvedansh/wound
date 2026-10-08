import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RedisService } from './redis.service';

export interface AuditEntry {
  clinicId: string;
  userId?: string | null;
  /** e.g. patient.create, visit.review, export.patients, share.create, member.invite */
  action: string;
  entity?: string;
  entityId?: string;
  /** Ids, counts and field names only: never patient values. */
  details?: Record<string, unknown>;
}

const BUFFER = 'audit:buffer';
const FLUSH_EVERY_MS = 2000;
const BATCH = 500;

/**
 * The audit trail (who did what, when). Writes are buffered in Redis and flushed in batches every 2 seconds
 * (ADR-0005), so logging never adds a database round trip to a request. LPOP with a count is atomic, so every
 * API instance can flush safely. Without Redis, entries are written directly.
 */
@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.flush(), FLUSH_EVERY_MS);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  async log(entry: AuditEntry): Promise<void> {
    const row = { ...entry, at: new Date().toISOString() };
    const buffered = await this.redis.safe(async (r) => (await r.rpush(BUFFER, JSON.stringify(row))) > 0, false);
    if (!buffered) await this.write([row]);
  }

  /** Writes now (used before a CSV export streams: the rule is "no log entry, no file"). */
  async logNow(entry: AuditEntry): Promise<void> {
    await this.write([{ ...entry, at: new Date().toISOString() }]);
  }

  async flush(): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const raw = await this.redis.safe((r) => r.lpop(BUFFER, BATCH), null);
      if (!raw || raw.length === 0) return;
      await this.write(raw.map((s) => JSON.parse(s) as AuditEntry & { at: string }));
    }
  }

  private async write(rows: (AuditEntry & { at: string })[]): Promise<void> {
    try {
      await this.prisma.auditLog.createMany({
        data: rows.map((r) => ({
          clinicId: r.clinicId,
          userId: r.userId ?? null,
          action: r.action,
          entity: r.entity ?? null,
          entityId: r.entityId ?? null,
          details: (r.details ?? undefined) as Prisma.InputJsonValue | undefined,
          at: new Date(r.at),
        })),
      });
    } catch (error) {
      this.logger.error(`Couldn't write ${rows.length} audit entries: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
