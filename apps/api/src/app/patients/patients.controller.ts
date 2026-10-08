import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, clinicCtx, type ClinicRequest } from '../auth/clinic.guard';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Patients of your clinic: search (q), status filter, sort, cursor pagination.' })
  list(@Query() query: Record<string, unknown>, @Req() req: ClinicRequest) {
    return this.patients.list(clinicCtx(req), query);
  }

  @Get('counts')
  @ApiOperation({ summary: 'Patients per status, for the filter chips.' })
  counts(@Req() req: ClinicRequest) {
    return this.patients.counts(clinicCtx(req));
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: ClinicRequest) {
    return this.patients.get(clinicCtx(req), id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a patient (consent required). The code is generated (WM-0001…) if not given.' })
  create(@Body() body: unknown, @Req() req: ClinicRequest) {
    return this.patients.create(clinicCtx(req), body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @Req() req: ClinicRequest) {
    return this.patients.update(clinicCtx(req), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Delete a patient with every wound, visit and photo.' })
  remove(@Param('id') id: string, @Req() req: ClinicRequest) {
    return this.patients.remove(clinicCtx(req), id);
  }
}
