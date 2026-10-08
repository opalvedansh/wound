import type { Treatment } from '@antigravity-project-spec-pack/domain';
import { woundTypeName } from '@antigravity-project-spec-pack/domain/wound-model';

/** The photo to show: the copy on this device, else the server's (taken on another device or before a reinstall). */
export const prePhoto = (t: Treatment | undefined) => t?.preImageUri ?? t?.remote?.preUrl ?? undefined;
export const postPhoto = (t: Treatment | undefined) => t?.postImageUri ?? t?.remote?.postUrl ?? undefined;

/** The AI draft for a treatment's pre-treatment photo, in words. */
export function aiSummary(t: Treatment): { label: string; value: string }[] | null {
  const ai = t.remote?.ai;
  if (!ai) {
    if (t.preImageUri && !t.remote?.preStored) return [{ label: 'AI analysis', value: t.phase === 'PRE' ? 'Starts after the assessment is saved' : 'Waiting to upload the photo' }];
    return null;
  }
  if (ai.status === 'processing') return [{ label: 'AI analysis', value: 'Analysing the photo…' }];
  if (ai.status === 'failed') return [{ label: 'AI analysis', value: 'Failed. A doctor can retry it from the portal.' }];
  if (ai.status === 'retake') return [{ label: 'AI analysis', value: 'The photo could not be used. Take the next one with the sticker in view and no glare.' }];
  if (ai.status === 'no_wound_found') return [{ label: 'AI analysis', value: 'No wound found in the photo.' }];
  return [
    { label: 'Area (AI)', value: ai.areaCm2 !== null ? `${ai.areaCm2} cm²` : 'Not measured (no sticker found)' },
    { label: 'Wound type (AI)', value: ai.woundType ? woundTypeName(ai.woundType) : '—' },
    ...(ai.urgent ? [{ label: 'Flag', value: 'Urgent: see the draft in the portal' }] : []),
    { label: 'Clinician review', value: ai.review ? ai.review[0].toUpperCase() + ai.review.slice(1) : 'Awaiting review in the portal' },
  ];
}
