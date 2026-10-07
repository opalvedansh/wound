import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'images';
const SIGNED_URL_SECONDS = 3600;

/**
 * Wound photos in the private `images` bucket. Browsers have no storage access of their own (lockdown
 * runbook); they only ever get short-lived signed URLs from here.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client?: SupabaseClient;

  async upload(path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.bucket().upload(path, body, { contentType, upsert: false });
    if (error) {
      this.logger.error(`Couldn't store a photo: ${error.message}`);
      throw new ServiceUnavailableException("The photo couldn't be stored. Try again.");
    }
  }

  /** Best effort, so it never throws: used after the records are already gone. Failures are logged by path count only. */
  async remove(paths: string | string[]): Promise<void> {
    const list = Array.isArray(paths) ? paths : [paths];
    if (list.length === 0) return;
    try {
      const { error } = await this.bucket().remove(list);
      if (error) this.logger.warn(`Couldn't remove ${list.length} photo(s): ${error.message}`);
    } catch (error) {
      this.logger.warn(`Couldn't remove ${list.length} photo(s): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Signed URLs by path; a photo that can't be signed maps to null rather than failing the page. */
  async signedUrls(paths: string[]): Promise<Map<string, string | null>> {
    const urls = new Map<string, string | null>(paths.map((p) => [p, null]));
    if (paths.length === 0) return urls;
    try {
      const { data, error } = await this.bucket().createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (error) throw error;
      for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    } catch (error) {
      this.logger.warn(`Couldn't sign photo URLs: ${error instanceof Error ? error.message : String(error)}`);
    }
    return urls;
  }

  private bucket() {
    if (!this.client) {
      const url = process.env['SUPABASE_URL'];
      const key = process.env['SUPABASE_SECRET_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];
      if (!url || !key) {
        this.logger.error('SUPABASE_URL or SUPABASE_SECRET_KEY is not set, so photos cannot be stored.');
        throw new ServiceUnavailableException('Photo storage is not set up on this server.');
      }
      this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    return this.client.storage.from(BUCKET);
  }
}
