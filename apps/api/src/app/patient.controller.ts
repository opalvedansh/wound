import { Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { PatientSummary } from '@antigravity-project-spec-pack/domain/wound-model';
import { currentUser, type AuthenticatedRequest } from './auth/supabase-auth.guard';
import { patientInput } from './inputs';
import { PrismaService } from './prisma.service';
import { UsersService } from './users.service';
import { toPatientSummary } from './views';

/** A clinician's own patients. Another user's patient is a 404, the same as one that doesn't exist. */
@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Your patients, newest first, with their wounds.' })
  async list(@Req() request: AuthenticatedRequest): Promise<PatientSummary[]> {
    const rows = await this.prisma.patient.findMany({
      where: { userId: currentUser(request).id },
      orderBy: { createdAt: 'desc' },
      include: { cases: { orderBy: { createdAt: 'asc' } } },
    });
    return rows.map(toPatientSummary);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<PatientSummary> {
    const row = await this.prisma.patient.findFirst({
      where: { id, userId: currentUser(request).id },
      include: { cases: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Patient not found.');
    return toPatientSummary(row);
  }

  @Post()
  @ApiOperation({ summary: "Register a patient. Needs the patient's consent to care records and photos." })
  async create(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<PatientSummary> {
    const user = currentUser(request);
    const input = patientInput(body);
    await this.users.ensure(user);
    try {
      const row = await this.prisma.patient.create({ data: { ...input, userId: user.id }, include: { cases: true } });
      return toPatientSummary(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ message: 'This patient ID is already registered.', problems: ['patientId'] });
      }
      throw error;
    }
  }
}
