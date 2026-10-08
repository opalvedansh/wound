import { useMemo } from 'react';
import type { SyncState } from '@antigravity-project-spec-pack/domain';
import { pendingCount } from '@antigravity-project-spec-pack/domain/sync';
import { useVisitStore } from '../store/useVisitStore';
import { STALLED_AFTER } from './syncManager';

export type SyncIssue = 'pending' | 'failed' | null;

/** Records and photos that keep failing to sync (they are still retried), and the ids of their records. */
export const useStalledSync = () => {
  const failures = useVisitStore((state) => state.failures);
  return useMemo(() => {
    const items = Object.entries(failures)
      .filter(([, f]) => f.attempts >= STALLED_AFTER)
      .map(([key, f]) => ({ entityId: key.split(':')[0], ...f }));
    return { items, ids: new Set(items.map((item) => item.entityId)) };
  }, [failures]);
};

/** How many records are waiting to be sent. */
export const usePendingCount = () => pendingCount(useVisitStore((state) => state.outbox));

export const syncIssueFor = (id: string, syncState: SyncState, stalledIds: Set<string>): SyncIssue =>
  stalledIds.has(id) ? 'failed' : syncState === 'pending' ? 'pending' : null;
