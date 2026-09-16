"use client"
import { useEffect } from "react";
import { useWebStore } from "../../../lib/mockStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertCircle, Activity, Users2, ArrowRight } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
};

export default function DashboardPage() {
  const { patients, cases, aiResults, fetchData } = useWebStore();

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingReviews = aiResults.filter(r => r.status === 'PROCESSED').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6 md:gap-10">

      {/* ── STAT CARDS ─────────────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6">

        {/* Urgent card */}
        <div className="sm:col-span-2 lg:col-span-8">
          <Card className="h-full bg-destructive/5 ring-1 ring-destructive/10 dark:bg-destructive/10">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardDescription className="text-destructive font-semibold uppercase tracking-wider text-xs flex items-center gap-1.5 mb-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Needs Attention
                  </CardDescription>
                  <CardTitle className="text-4xl md:text-5xl font-light tabular-nums text-foreground leading-none">
                    {pendingReviews}
                    <span className="text-xl md:text-2xl text-muted-foreground font-normal ml-2">Reviews</span>
                  </CardTitle>
                </div>
                <Button variant="destructive" asChild className="rounded-full shadow-lg shadow-destructive/20 self-start sm:self-center shrink-0">
                  <Link href="/review-queue" className="flex items-center gap-1.5">
                    Resolve Now <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                There are {pendingReviews} flagged tracking images that require immediate clinical review to ensure treatment is on track.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary stats */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Active Cases</p>
                <h3 className="text-xl md:text-2xl font-semibold tabular-nums">{cases.length}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Users2 className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Total Patients</p>
                <h3 className="text-xl md:text-2xl font-semibold tabular-nums">{patients.length}</h3>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ── REVIEW QUEUE TABLE (responsive) ────────────── */}
      <motion.div variants={item}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Review / Flag Queue</h2>
            <p className="text-sm text-muted-foreground mt-0.5">AI-flagged scans requiring manual intervention</p>
          </div>
          <Button variant="outline" className="rounded-full hover:bg-black/5 dark:hover:bg-white/5 self-start sm:self-center" asChild>
            <Link href="/review-queue">View All</Link>
          </Button>
        </div>

        {/* Desktop table */}
        <Card className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-black/5 dark:border-white/5">
                <tr>
                  <th className="text-left font-semibold px-6 py-3 text-muted-foreground">Treatment Phase</th>
                  <th className="text-left font-semibold px-6 py-3 text-muted-foreground">Flag Reason</th>
                  <th className="text-left font-semibold px-6 py-3 text-muted-foreground">Confidence</th>
                  <th className="text-right font-semibold px-6 py-3 text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {aiResults.map(result => (
                  <tr key={result.id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-medium text-muted-foreground">{result.phaseId}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Needs Review</Badge>
                        <span className="text-sm text-muted-foreground">{result.findings?.issue || 'Flagged'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground">
                        {Math.round(result.confidenceScore * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="secondary" size="sm" className="rounded-full" asChild>
                        <Link href={`/cases/${result.phaseId}`}>Review Scan</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {aiResults.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-14 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                        <p>No pending flags at this time.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile card list */}
        <div className="md:hidden flex flex-col gap-3">
          {aiResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm">No pending flags.</p>
              </CardContent>
            </Card>
          ) : aiResults.map(result => (
            <Card key={result.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-mono mb-1 truncate">{result.phaseId}</p>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="destructive" className="text-xs">Needs Review</Badge>
                      <span className="text-sm text-muted-foreground">{result.findings?.issue || 'Flagged'}</span>
                    </div>
                    <span className="bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground">
                      {Math.round(result.confidenceScore * 100)}% confidence
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" className="rounded-full shrink-0 text-xs" asChild>
                    <Link href={`/cases/${result.phaseId}`}>Review</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
