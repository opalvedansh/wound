import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to dashboard by default for the skeleton
  redirect('/dashboard');
}
