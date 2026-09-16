"use client"
import { useWebStore } from "../../../../lib/mockStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const { cases, patients, treatments, aiResults } = useWebStore();

  const caseObj = cases.find(c => c.id === caseId);
  const patient = caseObj ? patients.find(p => p.id === caseObj.patientId) : null;
  const caseTreatments = treatments.filter(t => t.caseId === caseId).sort((a, b) => b.sequenceNumber - a.sequenceNumber);

  if (!caseObj || !patient) return <div>Case not found</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Case Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-semibold tracking-tight">{patient.firstName} {patient.lastName} — {caseObj.id}</h2>
            <Badge variant={caseObj.status === 'COMPLETED' ? 'secondary' : 'default'}>{caseObj.status || 'ACTIVE'}</Badge>
          </div>
          <p className="text-muted-foreground">{caseObj.woundLocation} • Onset: {caseObj.onsetDate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
             <Link href={`/patients/${patient.id}`}>Back to Patient</Link>
          </Button>
          <Button variant="outline">Generate PDF</Button>
        </div>
      </div>

      {/* Treatment Timeline */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Treatment Timeline</h3>
        <div className="relative border-l border-muted ml-4 pl-6 pb-4">
          
          {caseTreatments.map((t, index) => {
             const aiFlag = aiResults.find(r => r.phaseId === t.id && r.status === 'PROCESSED');
             return (
              <div key={t.id} className="relative mb-6">
                <div className={`absolute w-3 h-3 rounded-full -left-[30.5px] top-2 ${index === 0 ? 'bg-primary' : 'bg-muted border-2 border-background'}`}></div>
                <Card className={index > 0 ? 'opacity-75' : ''}>
                  <CardHeader className="pb-3 border-b">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <CardTitle className="text-base">T{t.sequenceNumber}: {t.phase} Phase</CardTitle>
                         {aiFlag && <Badge variant="destructive">{aiFlag.findings?.issue || 'Flagged'}</Badge>}
                      </div>
                      <span className="text-sm text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                      {/* Image metadata */}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">IMAGE METADATA</h4>
                        {t.imageMetadata ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Calibrated:</span>
                              <span className="font-medium">{t.imageMetadata.calibrated ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Lighting Score:</span>
                              <span className="font-medium tabular-measurements">{t.imageMetadata.lightingScore}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Blur Score:</span>
                              <span className="font-medium">{t.imageMetadata.blurScore}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No image metadata available</span>
                        )}
                      </div>

                      {/* Additional Details */}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">ASSESSMENT / THERAPY</h4>
                        <div className="space-y-2 text-sm">
                            <span className="text-muted-foreground">Not recorded in mock</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
             )
          })}
          
          {caseTreatments.length === 0 && (
             <div className="text-muted-foreground py-4">No treatments recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
