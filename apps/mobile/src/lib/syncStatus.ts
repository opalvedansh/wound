import { useMemo } from 'react';
import type { SyncState } from '@antigravity-project-spec-pack/domain';
import { useVisitStore } from '../store/useVisitStore';

// syncManager stops retrying an outbox item once its retryCount passes 3.
export const STALLED_AFTER_RETRIES = 3;

export type SyncIssue = 'pending' | 'failed' | null;

/** Outbox items the sync engine has given up on, plus the ids of the records they belong to. */
export const useStalledSync = () => {
  const outbox = useVisitStore((state) => state.outbox);
  return useMemo(() => {
    const items = outbox.filter((item) => item.retryCount > STALLED_AFTER_RETRIES);
    return { items, ids: new Set(items.map((item) => item.entityId)) };
  }, [outbox]);
};

export const syncIssueFor = (id: string, syncState: SyncState, stalledIds: Set<string>): SyncIssue =>
  stalledIds.has(id) ? 'failed' : syncState === 'pending' ? 'pending' : null;
