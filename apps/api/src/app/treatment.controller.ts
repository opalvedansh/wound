import { Controller, Get, NotFoundException, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { currentUser, type AuthenticatedRequest } from './auth/supabase-auth.guard';
import { PrismaService } from './prisma.service';

/** Read-only for now: visits are created through POST /cases/:caseId/visits. */
@ApiTags('treatments')
@ApiBearerAuth()
@Controller('treatments')
export class TreatmentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, case: { patient: { userId: currentUser(request).id } } },
      include: { phases: { include: { assessment: true, image: true, aiResult: { include: { review: true } } } } },
    });
    if (!treatment) throw new NotFoundException('Treatment not found.');
    return treatment;
  }
}
