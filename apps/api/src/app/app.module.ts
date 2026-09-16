import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma.service';
import { PatientController } from './patient.controller';
import { CaseController } from './case.controller';
import { TreatmentController } from './treatment.controller';

@Module({
  imports: [AuthModule],
  controllers: [AppController, PatientController, CaseController, TreatmentController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
