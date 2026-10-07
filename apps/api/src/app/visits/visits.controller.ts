import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { currentUser, type AuthenticatedRequest } from '../auth/supabase-auth.guard';
import { reviewInput } from '../inputs';
import { MAX_PHOTO_BYTES, VisitsService, type PhotoUpload } from './visits.service';

/** Photo → wound model → saved visit → clinician review. All routes need a signed-in user (app-wide guard). */
@ApiTags('visits')
@ApiBearerAuth()
@Controller()
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard counts and the drafts awaiting review (urgent first) for the signed-in clinician.' })
  overview(@Req() request: AuthenticatedRequest) {
    return this.visits.overview(currentUser(request));
  }

  @Get('model/intake-questions')
  @ApiOperation({ summary: "The wound model's core intake questions, for the visit form." })
  intakeQuestions() {
    return this.visits.intakeQuestions();
  }

  @Post('model/follow-ups')
  @ApiOperation({ summary: 'Extra questions unlocked by the answers so far (burn, surgical, pressure, diabetic).' })
  followUps(@Body() body: unknown) {
    return this.visits.followUps(body);
  }

  @Post('cases/:caseId/visits')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Analyse a wound photo with the intake answers. Saves a visit only when the model can use the photo.' })
  // Memory storage: the photo goes to the model, then to private storage; it never touches this server's disk.
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  create(
    @Param('caseId') caseId: string,
    @UploadedFile() photo: PhotoUpload | undefined,
    @Body('intake') intake: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.visits.create(currentUser(request), caseId, photo, intake);
  }

  @Delete('visits/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a visit with its result, review and photo.' })
  removeVisit(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.visits.removeVisit(currentUser(request), id);
  }

  @Delete('patients/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a patient with every wound, visit and photo.' })
  removePatient(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.visits.removePatient(currentUser(request), id);
  }

  @Post('visits/:id/review')
  @ApiOperation({ summary: "Approve, edit or reject a result's draft report. One review per result." })
  review(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.visits.review(currentUser(request), id, reviewInput(body));
  }
}
