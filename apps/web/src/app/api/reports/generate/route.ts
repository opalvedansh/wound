import { NextResponse } from 'next/server';
const PdfPrinter = require('pdfmake');
import { prisma } from '@antigravity-project-spec-pack/domain/server';
import { createClient } from '../../../../lib/supabase/server';

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get('caseId');

  if (!caseId) {
    return NextResponse.json({ error: 'Missing caseId' }, { status: 400 });
  }

  const supabase = await createClient();

  // getUser() verifies the token with Supabase; getSession() only reads the cookie.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        patient: true,
        treatments: {
          orderBy: { createdAt: 'asc' },
          include: {
            phases: true
          }
        }
      }
    });

    // Prisma bypasses RLS, so ownership must be checked here. Same 404 either way,
    // so callers can't probe which case IDs exist.
    if (!caseData || caseData.patient.userId !== user.id) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Build PDF Make Definition
    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica' },
      content: [
        { text: `Wound Care Report - Case ${caseData.id}`, style: 'header' },
        { text: `Patient: ${caseData.patient.firstName} ${caseData.patient.lastName}`, margin: [0, 10, 0, 5] },
        { text: `Wound Type: ${caseData.woundType}`, margin: [0, 0, 0, 10] },
        { text: 'Treatments:', style: 'subheader' }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
      }
    };

    caseData.treatments.forEach((treatment) => {
      docDefinition.content.push({
        text: `Date: ${new Date(treatment.createdAt).toLocaleDateString()} - Phase: ${treatment.phases[0]?.phaseType || 'Unknown'}`,
        margin: [0, 5, 0, 0]
      });
      docDefinition.content.push({
        text: `Therapy: ${treatment.therapy.join(', ') || 'None'}`,
        margin: [0, 0, 0, 5]
      });
    });

    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Return as stream
    const stream = new ReadableStream({
      start(controller) {
        pdfDoc.on('data', (chunk: any) => controller.enqueue(chunk));
        pdfDoc.on('end', () => controller.close());
        pdfDoc.on('error', (err: any) => controller.error(err));
        pdfDoc.end();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${caseId}.pdf"`
      }
    });

  } catch (error) {
    console.error('Failed to generate report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
