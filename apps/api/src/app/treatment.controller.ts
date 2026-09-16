import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('treatments')
export class TreatmentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async getTreatment(@Param('id') id: string) {
    return this.prisma.treatment.findUniqueOrThrow({
      where: { id },
      include: {
        phases: {
          include: {
            assessment: true,
            image: true,
            aiResult: true,
          }
        }
      }
    });
  }

  @Post()
  async createTreatment(@Body() data: any) {
    return this.prisma.treatment.create({
      data,
    });
  }

  @Post(':id/phases')
  async createPhase(@Param('id') id: string, @Body() data: any) {
    return this.prisma.phase.create({
      data: {
        ...data,
        treatmentId: id,
      }
    });
  }
}
