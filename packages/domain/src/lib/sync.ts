/**
 * Offline-first sync between the mobile app and the API (rules from the WoundMetrics prototype).
 * Import through `@antigravity-project-spec-pack/domain/sync`.
 *
 * - The app works on its own copy and records which fields it changed (the outbox).
 * - Push sends only those fields; the server merges field by field, so edits to different fields on two
 *   devices both survive, and for the same field the later push wins.
 * - A delete wins over any edit. Duplicate patient codes from two offline devices get a suffix on the server.
 * - Pull brings everything changed since the last pull; fields with unpushed local edits keep the local value.
 * - Photos stay on the device until uploaded; records travel without them.
 */
import type { Case, Patient, Treatment } from './domain';

export const SYNC_ENTITIES = ['patients', 'cases', 'treatments'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export type SyncPatient = Omit<Patient, 'syncState'>;
export type SyncCase = Omit<Case, 'syncState'>;
/** Device photo paths stay on the device; `remote` is server-set. */
export type SyncTreatment = Omit<Treatment, 'preImageUri' | 'postImageUri' | 'imageMetadata'>;

export interface SyncRecords {
  patients: SyncPatient;
  cases: SyncCase;
  treatments: SyncTreatment;
}

export interface PushRequest {
  deviceId: string;
  changes: Partial<{ [E in SyncEntity]: { upserted: { record: SyncRecords[E]; changed: string[] }[]; deleted: string[] } }>;
}
export interface Rejected {
  entity: SyncEntity;
  id: string;
  reason: string;
}
export interface PushResponse {
  serverTime: string;
  rejected: Rejected[];
}

export interface PullResponse {
  /** Pass back as `since` once `cursor` is null. */
  serverTime: string;
  /** More changes are waiting: pull again with this cursor (and the same `since`). */
  cursor: string | null;
  changes: { [E in SyncEntity]: { upserted: SyncRecords[E][]; deleted: string[] } };
}

// ---------------------------------------------------------------- client side

/** Local edits waiting to be pushed: the fields changed, or a delete; `rev` detects edits made during a push. */
export interface OutboxEntry {
  changed: string[];
  deleted?: true;
  rev: number;
}
export type Outbox = Record<SyncEntity, Record<string, OutboxEntry>>;

export const emptyOutbox = (): Outbox => ({ patients: {}, cases: {}, treatments: {} });

export const pendingCount = (outbox: Outbox): number => SYNC_ENTITIES.reduce((n, e) => n + Object.keys(outbox[e]).length, 0);

/** Fields that never go to the server. */
const LOCAL_ONLY: Record<SyncEntity, string[]> = {
  patients: ['syncState'],
  cases: ['syncState'],
  treatments: ['preImageUri', 'postImageUri', 'imageMetadata', 'remote'],
};

/** Records a local change: the edited fields, or 'delete'. */
export function track(outbox: Outbox, entity: SyncEntity, id: string, change: readonly string[] | 'delete'): Outbox {
  const prev = outbox[entity][id];
  const rev = (prev?.rev ?? 0) + 1;
  const fields = change === 'delete' ? [] : change.filter((f) => !LOCAL_ONLY[entity].includes(f));
  if (change !== 'delete' && fields.length === 0 && !prev) return outbox;
  const entry: OutboxEntry = change === 'delete' ? { changed: [], deleted: true, rev } : { changed: [...new Set([...(prev?.changed ?? []), ...fields])], rev };
  return { ...outbox, [entity]: { ...outbox[entity], [id]: entry } };
}

export type LocalData = { patients: Patient[]; cases: Case[]; treatments: Treatment[] };

const strip = (entity: SyncEntity, record: object) => {
  const out = { ...record } as Record<string, unknown>;
  for (const f of LOCAL_ONLY[entity]) delete out[f];
  return out;
};

/** The push body for everything in the outbox (at most `limit` records), or null when there is nothing to send. */
export function buildPush(data: LocalData, outbox: Outbox, deviceId: string, limit = 200): { body: PushRequest; sent: Outbox } | null {
  const changes: PushRequest['changes'] = {};
  const sent = emptyOutbox();
  let n = 0;
  for (const e of SYNC_ENTITIES) {
    const byId = new Map<string, object & { id: string }>((data[e] as (object & { id: string })[]).map((r) => [r.id, r]));
    const upserted: { record: never; changed: string[] }[] = [];
    const deleted: string[] = [];
    for (const [id, entry] of Object.entries(outbox[e])) {
      if (n >= limit) break;
      if (entry.deleted) deleted.push(id);
      else {
        const record = byId.get(id);
        if (!record) continue;
        upserted.push({ record: strip(e, record) as never, changed: entry.changed });
      }
      sent[e][id] = entry;
      n++;
    }
    if (upserted.length || deleted.length) (changes as Record<string, unknown>)[e] = { upserted, deleted };
  }
  return n ? { body: { deviceId, changes }, sent } : null;
}

/** Drops the entries a push sent, unless they were edited again while it was in flight. */
export function settle(outbox: Outbox, sent: Outbox): Outbox {
  const next = emptyOutbox();
  for (const e of SYNC_ENTITIES) {
    for (const [id, entry] of Object.entries(outbox[e])) {
      if (sent[e][id]?.rev !== entry.rev) next[e][id] = entry;
    }
  }
  return next;
}

/** `base` with `fields` copied from `from`; a field missing on `from` is removed. */
export function withFields<T extends object>(base: T, from: T, fields: readonly string[]): T {
  const out = { ...base } as Record<string, unknown>;
  const src = from as Record<string, unknown>;
  for (const f of fields) {
    if (f === 'id') continue;
    if (f in src && src[f] !== undefined) out[f] = src[f];
    else delete out[f];
  }
  return out as T;
}

/**
 * Merges a pull into local data. Server deletes win. Fields with unpushed local edits keep the local value
 * (they go up on the next push). Local-only fields (device photos) are kept.
 */
export function applyPull(data: LocalData, pull: PullResponse, outbox: Outbox): { data: LocalData; outbox: Outbox } {
  const nextData = { ...data };
  const nextOutbox = { ...outbox };
  for (const e of SYNC_ENTITIES) {
    const { upserted, deleted } = pull.changes[e];
    if (!upserted.length && !deleted.length) continue;
    const pending = { ...outbox[e] };
    const map = new Map<string, Record<string, unknown>>((data[e] as unknown as Record<string, unknown>[]).map((r) => [r['id'] as string, r]));
    for (const id of deleted) {
      map.delete(id);
      delete pending[id];
    }
    for (const incoming of upserted as unknown as Record<string, unknown>[]) {
      const id = incoming['id'] as string;
      const entry = pending[id];
      if (entry?.deleted) continue; // deleted here, not pushed yet: stays deleted
      const local = map.get(id);
      let next: Record<string, unknown> = { ...incoming, syncState: entry ? 'pending' : 'synced' };
      if (local && entry) next = withFields(next, local, entry.changed);
      if (local) for (const f of LOCAL_ONLY[e]) if (f !== 'remote' && f !== 'syncState' && local[f] !== undefined) next[f] = local[f];
      if (e !== 'treatments') delete next['remote'];
      else delete next['syncState'];
      map.set(id, next);
    }
    (nextData as Record<SyncEntity, unknown[]>)[e] = [...map.values()];
    nextOutbox[e] = pending;
  }
  return { data: nextData, outbox: nextOutbox };
}
