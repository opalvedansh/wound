import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

/**
 * Postgres through the Supabase transaction pooler (DATABASE_URL, port 6543), which multiplexes many API
 * connections onto few database connections. Each API instance keeps a small pool (DB_POOL_MAX, default 10);
 * scale out by adding instances, not by growing the pool.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/antigravity',
      max: Number(process.env['DB_POOL_MAX'] ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000, // fail fast instead of queueing forever when the pool is exhausted
      statement_timeout: 15_000,
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
