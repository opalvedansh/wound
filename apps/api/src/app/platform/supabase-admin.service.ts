import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** The server-side Supabase client (secret key): private storage and inviting users. Never sent to a browser. */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private client?: SupabaseClient;

  get(): SupabaseClient {
    if (!this.client) {
      const url = process.env['SUPABASE_URL'];
      const key = process.env['SUPABASE_SECRET_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];
      if (!url || !key) {
        this.logger.error('SUPABASE_URL or SUPABASE_SECRET_KEY is not set.');
        throw new ServiceUnavailableException('Storage and sign-in administration are not set up on this server.');
      }
      this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    return this.client;
  }
}
