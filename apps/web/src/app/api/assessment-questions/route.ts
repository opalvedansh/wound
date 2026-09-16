import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();
if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    const questions = await prisma.assessmentQuestion.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(questions);
  } catch (error) {
    console.error('Failed to fetch assessment questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// Question catalog editing is disabled for the pilot: the catalog is seeded by migration.
export async function POST() {
  return NextResponse.json({ error: 'Question catalog editing is disabled' }, { status: 403 });
}
