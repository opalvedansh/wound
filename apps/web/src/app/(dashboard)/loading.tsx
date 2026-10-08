import { PageSkeleton } from '../../components/ui';

// Shown while a page's code loads on first navigation; after that each page shows cached data at once.
export default function Loading() {
  return <PageSkeleton rows={6} />;
}
