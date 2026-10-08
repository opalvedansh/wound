import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../platform/redis.service';
import { SupabaseAdminService } from '../platform/supabase-admin.service';

const BUCKET = 'images';
// Signed for 6 hours and cached for a little less, so a photo keeps the same URL across page loads and the
// browser's image cache works (a fresh URL every time would re-download every photo).
const SIGNED_URL_SECONDS = 6 * 3600;
const CACHE_SECONDS = SIGNED_URL_SECONDS - 600;

/**
 * Wound photos and thumbnails in the private `images` bucket. Browsers have no storage access of their own
 * (lockdown runbook); they only get signed URLs from here.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly supabase: SupabaseAdminService,
    private readonly redis: RedisService,
  ) {}

  private bucket() {
    return this.supabase.get().storage.from(BUCKET);
  }

  async upload(path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.bucket().upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
    if (error) {
      this.logger.error(`Couldn't store a photo: ${error.message}`);
      throw new ServiceUnavailableException("The photo couldn't be stored. Try again.");
    }
  }

  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.bucket().download(path);
    if (error || !data) throw new Error(`Couldn't read a stored photo: ${error?.message ?? 'empty'}`);
    return Buffer.from(await data.arrayBuffer());
  }

  /** Best effort, so it never throws: used after the records are already gone. Logged by count only. */
  async remove(paths: string | string[]): Promise<void> {
    const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
    if (list.length === 0) return;
    try {
      const { error } = await this.bucket().remove(list);
      if (error) this.logger.warn(`Couldn't remove ${list.length} photo(s): ${error.message}`);
    } catch (error) {
      this.logger.warn(`Couldn't remove ${list.length} photo(s): ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.redis.safe((r) => r.del(...list.map((p) => `su:${p}`)), 0);
  }

  /** Signed URLs by path (null when a photo can't be signed, rather than failing the page). Cached in Redis. */
  async signedUrls(paths: string[]): Promise<Map<string, string | null>> {
    const unique = [...new Set(paths.filter(Boolean))];
    const urls = new Map<string, string | null>(unique.map((p) => [p, null]));
    if (unique.length === 0) return urls;

    const cached = await this.redis.safe((r) => r.mget(...unique.map((p) => `su:${p}`)), unique.map(() => null));
    const missing = unique.filter((p, i) => {
      if (cached[i]) urls.set(p, cached[i]);
      return !cached[i];
    });
    if (missing.length === 0) return urls;

    try {
      const { data, error } = await this.bucket().createSignedUrls(missing, SIGNED_URL_SECONDS);
      if (error) throw error;
      const fresh = (data ?? []).filter((item) => item.path && item.signedUrl) as { path: string; signedUrl: string }[];
      for (const item of fresh) urls.set(item.path, item.signedUrl);
      if (fresh.length) {
        await this.redis.safe((r) => {
          const pipeline = r.pipeline();
          for (const item of fresh) pipeline.set(`su:${item.path}`, item.signedUrl, 'EX', CACHE_SECONDS);
          return pipeline.exec();
        }, null);
      }
    } catch (error) {
      this.logger.warn(`Couldn't sign photo URLs: ${error instanceof Error ? error.message : String(error)}`);
    }
    return urls;
  }
}
