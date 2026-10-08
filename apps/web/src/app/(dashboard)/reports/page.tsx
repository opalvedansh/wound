import { redirect } from 'next/navigation';

// Reports are printed from each wound's page; clinic-wide data is under Data export.
export default function ReportsPage() {
  redirect('/export');
}
