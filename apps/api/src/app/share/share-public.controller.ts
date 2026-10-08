import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/supabase-auth.guard';
import { Limit } from '../platform/rate-limit.guard';
import { ShareService } from './share.service';

/** The page behind a share link. Public, so: rate-limited per IP, never cached or indexed, strict CSP. */
@ApiTags('share')
@Public()
@Controller('share')
export class SharePublicController {
  constructor(private readonly share: ShareService) {}

  @Get(':token')
  @Limit({ max: 60, windowSeconds: 60, bucket: 'share' })
  async view(@Param('token') token: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const { html, imageOrigin } = await this.share.page(token);
      res.setHeader(
        'Content-Security-Policy',
        `default-src 'none'; img-src ${imageOrigin ?? "'none'"}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      );
      res.type('html').send(html);
    } catch (error) {
      const gone = (error as { status?: number }).status === 410;
      res.status(gone ? 410 : 404).type('html').send(
        `<!doctype html><meta charset="utf-8"><title>Link unavailable</title><body style="font-family:sans-serif;margin:48px"><h1>${gone ? 'This link is no longer available' : 'Link not found'}</h1><p>Ask the clinic for a new link.</p></body>`,
      );
    }
  }
}
