'use client';

import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, PageHeader, Toggle } from '../../../components/ui';
import { download, errorMessage } from '../../../lib/api';
import { usePatientCounts } from '../../../lib/queries';

const DATASETS = [
  {
    id: 'patients',
    title: 'Patients',
    deid: 'Patient code, sex, age band, status, open wounds and registration month.',
    full: 'Names, age, date of birth, mobile number, town, status and open wounds.',
  },
  {
    id: 'visits',
    title: 'Visits and measurements',
    deid: 'One row per analysed photo: wound, area, length × width, AI wound type and confidence, flags and review decision. Month only.',
    full: 'As de-identified, plus patient names and exact visit dates.',
  },
] as const;

/** Clinic data as CSV, streamed by the API. Each export is written to the audit log before the file starts. */
export default function ExportPage() {
  const [deidentify, setDeidentify] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const counts = usePatientCounts();

  const run = async (dataset: string) => {
    setBusy(dataset);
    setError(undefined);
    try {
      await download(`/exports/${dataset}?deidentify=${deidentify}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      <PageHeader title="Data export" subtitle="Download clinic data as CSV for analysis or audits." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="rounded-lg bg-overdue-soft px-3 py-2.5 text-[13px] text-overdue">
              {error}
            </p>
          ) : null}
          {DATASETS.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <FileSpreadsheet size={20} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-[13px] text-muted">{deidentify ? d.deid : d.full}</div>
                  {d.id === 'patients' && counts.data ? <div className="mt-1 text-[12px] text-faint">{counts.data.all} rows · CSV</div> : null}
                </div>
                <Button icon={Download} disabled={!!busy} onClick={() => void run(d.id)}>
                  {busy === d.id ? 'Preparing…' : 'Download'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card title="Privacy">
          <Toggle
            label="De-identify export"
            description="Removes names, mobile numbers, exact dates of birth and visit dates. Recommended."
            checked={deidentify}
            onChange={setDeidentify}
          />
          <div className={`mt-2 flex gap-2 rounded-lg p-3 text-[12px] ${deidentify ? 'bg-healing-soft text-healing' : 'bg-review-soft text-review'}`}>
            <ShieldCheck size={16} className="shrink-0" />
            {deidentify ? 'Suitable for research and sharing under DPDP.' : 'Contains personal data. Share only with authorised clinic staff.'}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            Every export is recorded in the audit log (who, when, which data, de-identified or not). Limited to 10 an hour.
          </p>
        </Card>
      </div>
    </>
  );
}
