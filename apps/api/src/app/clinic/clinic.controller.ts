import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoClinic, Roles, clinicCtx, type ClinicRequest } from '../auth/clinic.guard';
import { currentUser } from '../auth/supabase-auth.guard';
import { ClinicService } from './clinic.service';

@ApiTags('clinic')
@ApiBearerAuth()
@Controller()
export class ClinicController {
  constructor(private readonly clinic: ClinicService) {}

  @Get('me')
  @NoClinic()
  @ApiOperation({ summary: 'You, your clinics and your role in each.' })
  me(@Req() req: ClinicRequest) {
    return this.clinic.me(currentUser(req));
  }

  @Get('clinic')
  get(@Req() req: ClinicRequest) {
    return this.clinic.clinic(clinicCtx(req));
  }

  @Patch('clinic')
  @Roles('ADMIN')
  rename(@Body() body: unknown, @Req() req: ClinicRequest) {
    return this.clinic.rename(clinicCtx(req), body);
  }

  @Get('clinic/members')
  @Roles('ADMIN')
  members(@Req() req: ClinicRequest) {
    return this.clinic.members(clinicCtx(req));
  }

  @Post('clinic/members')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Invite someone by email with a role (admin, doctor, front desk).' })
  invite(@Body() body: unknown, @Req() req: ClinicRequest) {
    return this.clinic.invite(clinicCtx(req), body);
  }

  @Patch('clinic/members/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: "Change a member's role, or deactivate / reactivate them." })
  updateMember(@Param('id') id: string, @Body() body: unknown, @Req() req: ClinicRequest) {
    return this.clinic.updateMember(clinicCtx(req), id, body);
  }

  @Get('audit')
  @Roles('ADMIN')
  audit(@Query() query: Record<string, unknown>, @Req() req: ClinicRequest) {
    return this.clinic.auditLog(clinicCtx(req), query);
  }
}
