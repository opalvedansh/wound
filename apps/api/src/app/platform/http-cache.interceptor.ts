import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * GET responses are private (per user) and revalidated: Express adds an ETag, the browser sends it back, and an
 * unchanged response costs a bodiless 304 instead of the full JSON.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string }>();
    if (request.method === 'GET') {
      const response = http.getResponse<{ getHeader(name: string): unknown; setHeader(name: string, value: string): void }>();
      if (!response.getHeader('Cache-Control')) response.setHeader('Cache-Control', 'private, no-cache');
    }
    return next.handle();
  }
}
