import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QUESTION_FORMS, type QuestionChanges, type QuestionForm } from '@antigravity-project-spec-pack/domain/questions';
import { AdminGuard, SupabaseAuthGuard, type AuthenticatedRequest } from '../auth/supabase-auth.guard';
import { QuestionsService } from './questions.service';

const formFrom = (value: unknown): QuestionForm => {
  if (!QUESTION_FORMS.includes(value as QuestionForm)) throw new BadRequestException('Unknown form. Use "assessment" or "care".');
  return value as QuestionForm;
};

const changesFrom = (body: unknown): QuestionChanges => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Send the question as a JSON object.');
  return body as QuestionChanges;
};

const userId = (request: AuthenticatedRequest) => request.user?.id ?? '';

/** The questions the mobile app asks. Anyone signed in can read them; only admins can change them. */
@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List questions in the order they are asked. Hidden ones only with includeHidden=true.' })
  list(@Query('form') form?: string, @Query('includeHidden') includeHidden?: string) {
    return this.questions.list(form === undefined ? undefined : formFrom(form), includeHidden === 'true');
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Add a question to the end of a form (admins only).' })
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.questions.create(changesFrom(body), userId(request));
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Change a question (admins only). Built-in questions keep their type.' })
  update(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.questions.update(id, changesFrom(body), userId(request));
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete an added question (admins only). Built-in questions can only be hidden.' })
  remove(@Param('id') id: string) {
    return this.questions.remove(id);
  }

  @Put('order/:form')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Reorder a form's questions (admins only). Body: { ids: string[] } listing every question once." })
  reorder(@Param('form') form: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const ids = body && typeof body === 'object' ? (body as { ids?: unknown }).ids : undefined;
    return this.questions.reorder(formFrom(form), ids, userId(request));
  }
}
