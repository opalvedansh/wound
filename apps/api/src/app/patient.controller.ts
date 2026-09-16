import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('patients')
export class PatientController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getPatients() {
    return this.prisma.patient.findMany({
      include: { cases: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  @Get(':id')
  async getPatient(@Param('id') id: string) {
    return this.prisma.patient.findUniqueOrThrow({
      where: { id },
      include: { cases: { include: { treatments: true } } }
    });
  }

  @Post()
  async createPatient(@Body() data: any) {
    return this.prisma.patient.create({
      data,
    });
  }
}
