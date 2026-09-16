"use client"
import { useEffect, useState } from "react";
import { useWebStore } from "../../../lib/mockStore";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import Link from "next/link";
import { motion } from "motion/react";
import { Search, UserPlus, Users2, ArrowRight } from "lucide-react";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } } };

export default function PatientsPage() {
  const { patients, cases, fetchData } = useWebStore();
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = patients.filter(p =>
    p.firstName.toLowerCase().includes(search.toLowerCase()) ||
    p.lastName.toLowerCase().includes(search.toLowerCase()) ||
    p.patientId.includes(search)
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6 md:gap-10">

      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Patients</h2>
          <p className="text-muted-foreground mt-1 text-sm">Manage clinical records and aligner cases</p>
        </div>
        <Button asChild className="rounded-full shadow-md shadow-primary/10 self-start sm:self-auto">
          <Link href="/registration" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Register Patient
          </Link>
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div variants={item}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search patients by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </motion.div>

      {/* Desktop table */}
      <motion.div variants={item} className="hidden md:block">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-black/5 dark:border-white/5">
                <tr>
                  {['Patient ID', 'Name', 'Sex', 'Active Cases', ''].map(h => (
                    <th key={h} className={`text-left font-semibold px-6 py-3 text-muted-foreground ${!h ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filtered.map(patient => {
                  const activeCases = cases.filter(c => c.patientId === patient.id && c.status !== 'COMPLETED').length;
                  return (
                    <tr key={patient.id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{patient.patientId}</td>
                      <td className="px-6 py-4 font-medium">{patient.firstName} {patient.lastName}</td>
                      <td className="px-6 py-4 text-muted-foreground capitalize">{patient.sex?.toLowerCase()}</td>
                      <td className="px-6 py-4">
                        {activeCases > 0
                          ? <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-medium">{activeCases} Active</span>
                          : <span className="text-muted-foreground text-xs">None</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="secondary" size="sm" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                          <Link href={`/patients/${patient.id}`} className="flex items-center gap-1">
                            View Profile <ArrowRight className="w-3 h-3" />
                          </Link>
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
                          <Users2 className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                        <p>No patients found.</p>
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
                <Users2 className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm">No patients found.</p>
            </CardContent>
          </Card>
        ) : filtered.map(patient => {
          const activeCases = cases.filter(c => c.patientId === patient.id && c.status !== 'COMPLETED').length;
          return (
            <Link key={patient.id} href={`/patients/${patient.id}`}>
              <Card className="hover:shadow-md transition-shadow active:scale-[0.99] cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{patient.firstName} {patient.lastName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{patient.patientId} · {patient.sex?.toLowerCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeCases > 0 && (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-medium">{activeCases} Active</span>
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
