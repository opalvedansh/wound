"use client"
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Users, ClipboardList, FileText, LogOut, LayoutList } from 'lucide-react';
import { supabaseBrowser as supabase } from '../../lib/supabase/client';
import { User } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/dashboard',        label: 'Dashboard',    icon: Activity },
  { href: '/patients',         label: 'Patients',     icon: Users },
  { href: '/review-queue',     label: 'Review Queue', icon: ClipboardList },
  { href: '/reports',          label: 'Reports',      icon: FileText },
  { href: '/assessment-config',label: 'Assessment',   icon: LayoutList },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login');
      else setUser(session.user);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.push('/login');
      else if (session) setUser(session.user);
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = (
    (user?.user_metadata?.firstName?.[0] ?? '') +
    (user?.user_metadata?.lastName?.[0] ?? '')
  ).toUpperCase() || 'DR';

  const displayName = `${user?.user_metadata?.firstName ?? 'Dr.'} ${user?.user_metadata?.lastName ?? ''}`.trim();

  return (
    <div className="flex h-screen bg-background text-foreground">

      {/* ── DESKTOP SIDEBAR ──────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col bg-white/40 dark:bg-black/20 backdrop-blur-xl border-r border-black/5 dark:border-white/5 z-10">
        {/* Logo */}
        <div className="flex items-center h-20 px-8 border-b border-black/5 dark:border-white/5">
          <span className="text-xl font-bold tracking-tighter">ClearAligner</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 mt-4 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User chip */}
        <div className="p-4 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/3 dark:bg-white/3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/20 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-background/90 backdrop-blur-md border-b border-black/5 dark:border-white/5 sticky top-0 z-20">
          <span className="text-base font-bold tracking-tight">ClearAligner</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] ring-1 ring-primary/20">
              {initials}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Desktop page header */}
        <header className="hidden md:flex items-center justify-between px-8 lg:px-10 h-16 bg-background/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 sticky top-0 z-10">
          <h1 className="text-xl font-semibold tracking-tight capitalize">
            {NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label ?? 'Dashboard'}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-black/20 px-3 py-1.5 rounded-full border border-black/5 shadow-sm">
              <span className="text-sm font-medium">{displayName}</span>
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] ring-1 ring-primary/20">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 md:px-8 lg:px-10 md:py-8 pb-24 md:pb-10 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-black/5 dark:border-white/5 pb-safe">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[52px] ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 transition-all duration-200 ${active ? 'scale-110' : ''}`} />
                <span className={`text-[9px] font-medium leading-none transition-all duration-200 ${active ? 'opacity-100' : 'opacity-60'}`}>
                  {label === 'Registration' ? 'Register' : label === 'Review Queue' ? 'Queue' : label === 'Assessment' ? 'Assess' : label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
