"use client"
import { useWebStore } from "../../../../lib/mockStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  const { patients, cases } = useWebStore();

  const patient = patients.find(p => p.id === patientId);
  const patientCases = cases.filter(c => c.patientId === patientId);

  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{patient.firstName} {patient.lastName}</h2>
          <p className="text-muted-foreground">ID: {patient.patientId} • {patient.dob} • {patient.sex} • {patient.location}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/patients">Back to Patients</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active & Past Cases</CardTitle>
          <CardDescription>All wound care cases associated with this patient</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Wound Location</TableHead>
              <TableHead>Onset Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patientCases.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.woundLocation}</TableCell>
                <TableCell>{c.onsetDate}</TableCell>
                <TableCell>
                  <Badge variant={c.status === 'COMPLETED' ? 'secondary' : 'default'}>
                    {c.status || 'ACTIVE'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/cases/${c.id}`}>View Case</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {patientCases.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No cases found for this patient.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
