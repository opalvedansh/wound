import { Body, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CaseSummary, CaseView } from '@antigravity-project-spec-pack/domain/wound-model';
import { currentUser, type AuthenticatedRequest } from './auth/supabase-auth.guard';
import { caseInput } from './inputs';
import { PrismaService } from './prisma.service';
import { VisitsService } from './visits/visits.service';
import { toCaseSummary } from './views';

/** Wounds (cases) of the clinician's own patients. */
@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
export class CaseController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visits: VisitsService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'A wound with its analysed visits (oldest first), signed photo URLs and reviews.' })
  get(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<CaseView> {
    return this.visits.caseView(currentUser(request), id);
  }

  @Post()
  @ApiOperation({ summary: 'Open a case for a new wound on one of your patients.' })
  async create(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<CaseSummary> {
    const input = caseInput(body);
    const patient = await this.prisma.patient.findFirst({ where: { id: input.patientId, userId: currentUser(request).id } });
    if (!patient) throw new NotFoundException('Patient not found.');
    const { patientId, ...fields } = input;
    return toCaseSummary(await this.prisma.case.create({ data: { ...fields, patientId } }));
  }
}
