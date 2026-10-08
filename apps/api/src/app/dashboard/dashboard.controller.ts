import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { QueueView } from '@antigravity-project-spec-pack/domain/api';
import { Roles, clinicCtx, type ClinicRequest } from '../auth/clinic.guard';
import { DashboardService } from './dashboard.service';

const VIEWS: QueueView[] = ['drafts', 'attention', 'overdue', 'review', 'reviewed'];

@ApiTags('dashboard')
@ApiBearerAuth()
@Roles('ADMIN', 'DOCTOR')
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  get(@Req() req: ClinicRequest) {
    return this.dashboard.dashboard(clinicCtx(req));
  }

  @Get('queue/counts')
  counts(@Req() req: ClinicRequest) {
    return this.dashboard.counts(clinicCtx(req));
  }

  @Get('queue')
  queue(@Query('view') view: string | undefined, @Query('cursor') cursor: unknown, @Query('limit') limit: unknown, @Req() req: ClinicRequest) {
    const v = (view ?? 'attention') as QueueView;
    if (!VIEWS.includes(v)) throw new BadRequestException(`view must be one of ${VIEWS.join(', ')}`);
    return this.dashboard.queue(clinicCtx(req), v, cursor, limit);
  }
}
