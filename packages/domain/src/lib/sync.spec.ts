import type { Case, Patient, Treatment } from './domain';
import { applyPull, buildPush, emptyOutbox, pendingCount, settle, track, type LocalData, type PullResponse } from './sync';

const patient = (over: Partial<Patient> = {}): Patient => ({
  id: 'p1',
  firstName: 'Asha',
  lastName: 'Rao',
  patientId: 'MRN-1',
  sex: 'F',
  dob: '1960-01-01',
  location: 'Ward 3',
  syncState: 'pending',
  ...over,
});
const treatment = (over: Partial<Treatment> = {}): Treatment => ({
  id: 't1',
  caseId: 'c1',
  sequenceNumber: 1,
  phase: 'PRE',
  createdAt: '2026-10-08T10:00:00Z',
  ...over,
});
const data = (over: Partial<LocalData> = {}): LocalData => ({ patients: [patient()], cases: [] as Case[], treatments: [treatment({ preImageUri: 'file:///pre.jpg' })], ...over });
const pull = (changes: Partial<PullResponse['changes']>): PullResponse => ({
  serverTime: '2026-10-08T12:00:00Z',
  cursor: null,
  changes: { patients: { upserted: [], deleted: [] }, cases: { upserted: [], deleted: [] }, treatments: { upserted: [], deleted: [] }, ...changes },
});

describe('outbox', () => {
  it('collects the changed fields per record and ignores device-only fields', () => {
    let o = track(emptyOutbox(), 'patients', 'p1', ['firstName']);
    o = track(o, 'patients', 'p1', ['lastName', 'firstName']);
    expect(o.patients['p1']).toEqual({ changed: ['firstName', 'lastName'], rev: 2 });
    expect(track(emptyOutbox(), 'treatments', 't1', ['preImageUri'])).toEqual(emptyOutbox());
    expect(pendingCount(o)).toBe(1);
  });

  it('a delete replaces the pending edits', () => {
    const o = track(track(emptyOutbox(), 'patients', 'p1', ['firstName']), 'patients', 'p1', 'delete');
    expect(o.patients['p1']).toEqual({ changed: [], deleted: true, rev: 2 });
  });

  it('pushes records without device photos or sync state', () => {
    const o = track(track(emptyOutbox(), 'patients', 'p1', ['firstName']), 'treatments', 't1', ['phase']);
    const push = buildPush(data(), o, 'device-1');
    expect(push?.body.changes.patients?.upserted[0]).toEqual({ record: expect.not.objectContaining({ syncState: expect.anything() }), changed: ['firstName'] });
    expect(push?.body.changes.treatments?.upserted[0].record).not.toHaveProperty('preImageUri');
    expect(buildPush(data(), emptyOutbox(), 'device-1')).toBeNull();
  });

  it('keeps entries edited again while the push was in flight', () => {
    const o = track(emptyOutbox(), 'patients', 'p1', ['firstName']);
    const push = buildPush(data(), o, 'd');
    const during = track(o, 'patients', 'p1', ['lastName']);
    expect(settle(during, push!.sent).patients['p1']?.changed).toEqual(['firstName', 'lastName']);
    expect(pendingCount(settle(o, push!.sent))).toBe(0);
  });
});

describe('applyPull', () => {
  it('takes server values, but keeps fields with unpushed local edits', () => {
    const local = data({ patients: [patient({ firstName: 'Local', lastName: 'Old' })] });
    const o = track(emptyOutbox(), 'patients', 'p1', ['firstName']);
    const res = applyPull(local, pull({ patients: { upserted: [patient({ firstName: 'Server', lastName: 'New' })], deleted: [] } }), o);
    expect(res.data.patients[0]).toEqual(expect.objectContaining({ firstName: 'Local', lastName: 'New', syncState: 'pending' }));
    expect(res.outbox.patients['p1']).toBeDefined();
  });

  it('server deletes win, local deletes stay deleted', () => {
    const o = track(emptyOutbox(), 'patients', 'p2', 'delete');
    const res = applyPull(
      data({ patients: [patient(), patient({ id: 'p2' })] }),
      pull({ patients: { upserted: [patient({ id: 'p2' })], deleted: ['p1'] } }),
      o,
    );
    expect(res.data.patients.map((p) => p.id)).toEqual(['p2']); // p2 kept locally only because its delete is still pending
    expect(res.outbox.patients['p2']?.deleted).toBe(true);
  });

  it('keeps the photo on this device and takes the server photo info', () => {
    const remote = { preStored: true, ai: { visitId: 'v1', status: 'ok' as const, areaCm2: 4.2, woundType: 'pressure', urgent: false, review: null } };
    const res = applyPull(data(), pull({ treatments: { upserted: [{ ...treatment({ phase: 'POST' }), remote }], deleted: [] } }), emptyOutbox());
    expect(res.data.treatments[0]).toEqual(expect.objectContaining({ phase: 'POST', preImageUri: 'file:///pre.jpg', remote }));
  });
});
