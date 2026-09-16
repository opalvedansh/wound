"use client"
import { useWebStore } from "../../../lib/mockStore";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ClipboardList } from "lucide-react";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } } };

type Filter = 'ALL' | 'PROCESSED';

export default function ReviewQueuePage() {
  const { aiResults, cases, patients, treatments } = useWebStore();
  const [filter, setFilter] = useState<Filter>('PROCESSED');

  const filtered = aiResults.filter(r => filter === 'ALL' || r.status === filter);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6 md:gap-10">

      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Review Queue</h2>
          <p className="text-muted-foreground mt-1 text-sm">AI-flagged scans requiring manual clinical intervention</p>
        </div>
        {/* Filter pills */}
        <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/5 shadow-sm self-start sm:self-auto">
          {(['PROCESSED', 'ALL'] as Filter[]).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'rounded-full shadow-md text-xs px-4' : 'rounded-full hover:bg-transparent text-xs px-4'}
            >
              {f === 'PROCESSED' ? 'Action Required' : 'All Flags'}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Desktop table */}
      <motion.div variants={item} className="hidden md:block">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-black/5 dark:border-white/5">
                <tr>
                  {['Treatment Phase', 'Patient / Case', 'Reason', 'Confidence', ''].map((h, i) => (
                    <th key={i} className={`text-left font-semibold px-6 py-3 text-muted-foreground ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filtered.map(result => {
                  const treatment = treatments.find(t => t.id === result.phaseId);
                  const caseObj   = treatment ? cases.find(c => c.id === treatment.caseId) : null;
                  const patient   = caseObj ? patients.find(p => p.id === caseObj.patientId) : null;
                  return (
                    <tr key={result.id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{result.phaseId}</td>
                      <td className="px-6 py-4 font-medium">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                        <span className="text-muted-foreground font-normal ml-2 text-xs">{caseObj ? `(${caseObj.id})` : ''}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={result.status === 'PROCESSED' ? 'destructive' : 'secondary'}>
                            {result.status === 'PROCESSED' ? 'Needs Review' : 'Resolved'}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{result.findings?.issue || 'Flagged'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground">
                          {Math.round(result.confidenceScore * 100)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="secondary" size="sm" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                          <Link href={`/cases/${caseObj?.id || ''}`}>Review Scan</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                        <p>No flags match the current filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* Mobile card list */}
      <motion.div variants={item} className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm">No flags match the current filter.</p>
            </CardContent>
          </Card>
        ) : filtered.map(result => {
          const treatment = treatments.find(t => t.id === result.phaseId);
          const caseObj   = treatment ? cases.find(c => c.id === treatment.caseId) : null;
          const patient   = caseObj ? patients.find(p => p.id === caseObj.patientId) : null;
          return (
            <Card key={result.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{result.phaseId}</p>
                  </div>
                  <Badge variant={result.status === 'PROCESSED' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                    {result.status === 'PROCESSED' ? 'Needs Review' : 'Resolved'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{result.findings?.issue || 'Flagged'}</span>
                    <span className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground">
                      {Math.round(result.confidenceScore * 100)}%
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" className="rounded-full text-xs h-7 px-3" asChild>
                    <Link href={`/cases/${caseObj?.id || ''}`}>Review</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
