'use client';

import { CONSENT_NOTICE_VERSION } from '@antigravity-project-spec-pack/domain';
import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Segmented, Toggle, inputCls } from '../../../components/ui';
import { ApiError, errorMessage } from '../../../lib/api';
import { todayISO } from '../../../lib/format';
import { useCreatePatient } from '../../../lib/queries';

const PROBLEM_FIELD: Record<string, string> = {
  firstName: 'firstName',
  lastName: 'lastName',
  dateOfBirth: 'age',
  ageYears: 'age',
  mobile: 'mobile',
  patientId: 'code',
};

/** Full patient intake for the front desk or a doctor. Wounds are then added by a doctor. */
export default function RegisterPage() {
  const router = useRouter();
  const create = useCreatePatient();
  // One key per form: a double click or a retry after a timeout never registers the patient twice.
  const [key] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    code: '',
    sex: 'F' as 'F' | 'M' | 'O',
    ageMode: 'age' as 'age' | 'dob',
    age: '',
    dob: '',
    mobile: '',
    location: '',
    referral: '',
    notes: '',
  });
  const [consent, setConsent] = useState({ care: false, photos: false, location: false, aiTraining: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.firstName.trim()) err['firstName'] = 'Required';
    if (!form.lastName.trim()) err['lastName'] = 'Required';
    if (form.ageMode === 'age' && !(Number(form.age) >= 0 && Number(form.age) <= 130 && form.age !== '')) err['age'] = 'Enter an age in years';
    if (form.ageMode === 'dob' && !form.dob) err['age'] = 'Enter the date of birth';
    if (form.mobile && !/^\+?[\d\s-]{7,20}$/.test(form.mobile.trim())) err['mobile'] = 'Enter a valid mobile number';
    if (!consent.care || !consent.photos) err['consent'] = 'Treatment and photo consent are needed to register.';
    setErrors(err);
    if (Object.values(err).some(Boolean)) return;

    create.mutate(
      {
        key,
        body: {
          patientId: form.code.trim() || undefined,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          sex: form.sex,
          ...(form.ageMode === 'age' ? { ageYears: Number(form.age) } : { dateOfBirth: form.dob }),
          mobile: form.mobile.trim() || undefined,
          location: form.location.trim() || undefined,
          referral: form.referral.trim() || undefined,
          notes: form.notes.trim() || undefined,
          consent: { ...consent, noticeVersion: CONSENT_NOTICE_VERSION },
        },
      },
      {
        onSuccess: (p) => router.push(`/patients/${p.id}`),
        onError: (error) => {
          if (error instanceof ApiError && error.problems.length) {
            setErrors(Object.fromEntries(error.problems.map((p) => [PROBLEM_FIELD[p] ?? 'submit', p in PROBLEM_FIELD ? 'Check this field' : error.message])));
          }
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Register patient" subtitle="Full intake. A doctor then adds the wound and its photos." />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Patient details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={errors['firstName']}>
              <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus autoComplete="off" />
            </Field>
            <Field label="Last name" required error={errors['lastName']}>
              <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Patient ID" hint="Leave empty for the next number (WM-0001…)." error={errors['code']}>
              <Input value={form.code} placeholder="Automatic" onChange={(e) => set('code', e.target.value.toUpperCase())} />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-ink-soft">Sex</span>
              <Segmented
                value={form.sex}
                onChange={(v) => set('sex', v)}
                options={[
                  { value: 'F', label: 'Female' },
                  { value: 'M', label: 'Male' },
                  { value: 'O', label: 'Other' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-ink-soft">Age</span>
              <Segmented
                value={form.ageMode}
                onChange={(v) => set('ageMode', v)}
                options={[
                  { value: 'age', label: 'Age in years' },
                  { value: 'dob', label: 'Date of birth' },
                ]}
              />
            </div>
            {form.ageMode === 'age' ? (
              <Field label="Age (years)" required error={errors['age']}>
                <Input inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="e.g. 64" />
              </Field>
            ) : (
              <Field label="Date of birth" required error={errors['age']}>
                <Input type="date" value={form.dob} max={todayISO()} onChange={(e) => set('dob', e.target.value)} />
              </Field>
            )}
            <Field label="Mobile number" error={errors['mobile']} hint="Optional">
              <Input inputMode="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/[^\d +-]/g, ''))} placeholder="98765 43210" />
            </Field>
            <Field label="Town / area" hint="Optional">
              <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
            </Field>
            <Field label="Referral source / assigned doctor" hint="Optional">
              <Input value={form.referral} onChange={(e) => set('referral', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" hint="Optional">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={`${inputCls} h-auto py-2`} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Consent (DPDP)">
            <div className="divide-y divide-hairline">
              <Toggle label="Treatment *" description="Assessment and wound care" checked={consent.care} onChange={(v) => setConsent({ ...consent, care: v })} />
              <Toggle label="Wound photos *" description="Photos and AI measurements" checked={consent.photos} onChange={(v) => setConsent({ ...consent, photos: v })} />
              <Toggle label="Location stamp" description="GPS and time on each photo" checked={consent.location} onChange={(v) => setConsent({ ...consent, location: v })} />
              <Toggle
                label="AI training"
                description="De-identified photos may improve the model"
                checked={consent.aiTraining}
                onChange={(v) => setConsent({ ...consent, aiTraining: v })}
              />
            </div>
            {errors['consent'] ? (
              <p className="mt-3 text-[13px] text-overdue">{errors['consent']}</p>
            ) : (
              <p className="mt-3 text-[12px] text-muted">Read the consent notice to the patient before recording. Consent can be withdrawn at any time.</p>
            )}
          </Card>
          {create.error && !(create.error instanceof ApiError && create.error.problems.length) ? (
            <p role="alert" className="rounded-lg bg-overdue-soft px-3 py-2.5 text-[13px] text-overdue">
              {errorMessage(create.error)}
            </p>
          ) : errors['submit'] ? (
            <p role="alert" className="rounded-lg bg-overdue-soft px-3 py-2.5 text-[13px] text-overdue">
              {errors['submit']}
            </p>
          ) : null}
          <Button type="submit" icon={UserPlus} className="h-11 w-full" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Register patient'}
          </Button>
        </div>
      </form>
    </>
  );
}
