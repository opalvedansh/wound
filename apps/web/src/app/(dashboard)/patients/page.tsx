"use client"
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import type { PatientSummary } from "@antigravity-project-spec-pack/domain/wound-model";
import { Button } from "../../../components/ui/button";
import { PageNote } from "../../../components/ui/field";
import { useApi } from "../../../lib/api";
import { SEX_NAME, dateText } from "../../../lib/format";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function PatientsPage() {
  const { data: patients, error, loading } = useApi<PatientSummary[]>("/patients");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const shown = (patients ?? []).filter(
    (p) => !query || `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) || p.patientId.toLowerCase().includes(query),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Patients</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your patients and their wounds</p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/registration">
            <UserPlus className="w-4 h-4 mr-2" /> Register patient
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search patients"
          placeholder="Search by name or patient ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/10 dark:bg-black/20"
        />
      </div>

      {loading && !patients ? (
        <PageNote>Loading patients…</PageNote>
      ) : error ? (
        <PageNote tone="error">{error.message}</PageNote>
      ) : shown.length === 0 ? (
        <PageNote>{query ? `No patients match “${search.trim()}”.` : "No patients yet. Register your first patient to begin."}</PageNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p) => (
            <li key={p.id}>
              <Link
                href={`/patients/${p.id}`}
                className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3 transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:bg-black/20"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {p.firstName[0]}
                  {p.lastName[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    ID {p.patientId} · {SEX_NAME[p.sex] ?? p.sex} · born {dateText(p.dateOfBirth)}
                  </span>
                </span>
                <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
                  {p.cases.length ? plural(p.cases.length, "wound") : "No wounds"}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
