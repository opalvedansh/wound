import { Shell } from '../../components/shell';

// The proxy has already checked the session, so the shell renders at once; each page streams in its own data.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
