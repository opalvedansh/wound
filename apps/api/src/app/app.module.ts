import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { PrismaService } from './prisma.service';
import { PatientController } from './patient.controller';
import { CaseController } from './case.controller';
import { TreatmentController } from './treatment.controller';
import { QuestionsController } from './questions/questions.controller';
import { QuestionsService } from './questions/questions.service';
import { UsersService } from './users.service';
import { ModelClient } from './visits/model-client';
import { StorageService } from './visits/storage.service';
import { VisitsController } from './visits/visits.controller';
import { VisitsService } from './visits/visits.service';

@Module({
  imports: [AuthModule],
  controllers: [AppController, PatientController, CaseController, TreatmentController, QuestionsController, VisitsController],
  // Every route needs a signed-in user unless it is marked @Public().
  providers: [
    AppService,
    PrismaService,
    QuestionsService,
    UsersService,
    ModelClient,
    StorageService,
    VisitsService,
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AppModule {}
