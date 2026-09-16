import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('cases')
export class CaseController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getCases() {
    return this.prisma.case.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { treatments: true }
    });
  }

  @Get(':id')
  async getCase(@Param('id') id: string) {
    return this.prisma.case.findUniqueOrThrow({
      where: { id },
      include: { treatments: { include: { phases: true } } }
    });
  }

  @Post()
  async createCase(@Body() data: any) {
    return this.prisma.case.create({
      data,
    });
  }
}
