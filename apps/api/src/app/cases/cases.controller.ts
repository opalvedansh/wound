import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles, clinicCtx, type ClinicRequest } from '../auth/clinic.guard';
import { parse } from '../platform/validation';
import { ShareService } from '../share/share.service';
import { CasesService } from './cases.service';

const reviewedInput = z.object({ reviewed: z.boolean() });

/** Wounds are clinical data: doctors and admins only. */
@ApiTags('cases')
@ApiBearerAuth()
@Roles('ADMIN', 'DOCTOR')
@Controller()
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly share: ShareService,
  ) {}

  @Get('cases/:id')
  @ApiOperation({ summary: 'A wound: summary, area series, and the first page of visits (newest first).' })
  get(@Param('id') id: string, @Req() req: ClinicRequest) {
    return this.cases.get(clinicCtx(req), id);
  }

  @Get('cases/:id/visits')
  visits(@Param('id') id: string, @Query() query: Record<string, unknown>, @Req() req: ClinicRequest) {
    return this.cases.visits(clinicCtx(req), id, query);
  }

  @Post('cases')
  create(@Body() body: unknown, @Req() req: ClinicRequest) {
    return this.cases.create(clinicCtx(req), body);
  }

  @Patch('cases/:id')
  @ApiOperation({ summary: 'Edit, close/reopen, or set the next visit.' })
  update(@Param('id') id: string, @Body() body: unknown, @Req() req: ClinicRequest) {
    return this.cases.update(clinicCtx(req), id, body);
  }

  @Post('cases/:id/reviewed')
  @ApiOperation({ summary: 'Mark a wound reviewed (it leaves the queue until its next visit), or undo.' })
  reviewed(@Param('id') id: string, @Body() body: unknown, @Req() req: ClinicRequest) {
    return this.cases.markReviewed(clinicCtx(req), id, parse(reviewedInput, body).reviewed);
  }

  @Get('cases/:id/share-links')
  shareLinks(@Param('id') id: string, @Req() req: ClinicRequest) {
    return this.share.list(clinicCtx(req), id);
  }

  @Post('cases/:id/share-links')
  @ApiOperation({ summary: 'Create an expiring read-only link to this wound\'s report. The URL is returned once.' })
  createShareLink(@Param('id') id: string, @Body() body: unknown, @Req() req: ClinicRequest & { protocol: string; get(name: string): string | undefined }) {
    const base = process.env['PUBLIC_API_URL'] || `${req.protocol}://${req.get('host')}/api`;
    return this.share.create(clinicCtx(req), id, body, base);
  }

  @Post('share-links/:id/revoke')
  revokeShareLink(@Param('id') id: string, @Req() req: ClinicRequest) {
    return this.share.revoke(clinicCtx(req), id);
  }
}
