'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Activity, LogOut, ShieldAlert, Award, Grid, Clock, ShieldCheck } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Fetch incidents current user has access to
      const { data, error } = await supabase
        .from('incidents')
        .select('id, status');

      if (error) throw error;

      if (data) {
        setActiveCount(data.filter((i) => i.status === 'active').length);
        setResolvedCount(data.filter((i) => i.status === 'resolved').length);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    let authSubscription: any;
    let incidentSubscription: any;

    const initialize = async () => {
      // 1. Get current session/user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email ?? 'Operator');
      setLoading(false);

      // 2. Fetch initial statistics
      await fetchStats();

      // 3. Listen to auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.push('/login');
        } else {
          setUserEmail(session.user.email ?? 'Operator');
        }
      });
      authSubscription = subscription;

      // 4. Subscribe to Real-Time incident changes to update the layout stats on-the-fly
      const channelSuffix = Math.random().toString(36).substring(7);
      incidentSubscription = supabase
        .channel(`dashboard-layout-stats-${channelSuffix}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incidents' },
          () => {
            fetchStats();
          }
        )
        .subscribe();
    };

    initialize();

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
      if (incidentSubscription) supabase.removeChannel(incidentSubscription);
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-100 antialiased">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 text-violet-500 animate-spin" />
          <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase font-mono">
            Verifying Security Credentials...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-900 bg-slate-900/30 backdrop-blur-xl">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3.5 px-6 border-b border-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold tracking-wider text-sm font-mono text-white">
            WAR ROOM OPS
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          <a
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3.5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800/60"
          >
            <Grid className="h-4.5 w-4.5 text-violet-400" />
            <span>Incidents Dashboard</span>
          </a>
          <div className="pt-4 px-3.5">
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono">
              System Health
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
            <span>Security Gate Active</span>
          </div>
        </nav>

        {/* User Info & Sign Out Footer */}
        <div className="border-t border-slate-900 p-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-950/40 p-3 border border-slate-900">
            <div className="min-w-0 flex-1 pr-2">
              <p className="truncate text-xs font-semibold text-slate-200" title={userEmail || ''}>
                {userEmail}
              </p>
              <p className="text-[10px] font-medium text-slate-500 font-mono uppercase">
                Incident Operator
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              title="Terminate Session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-900 bg-slate-950/40 backdrop-blur-md px-6 z-20">
          <div className="flex items-center gap-3">
            {/* Small screen brand indicator */}
            <div className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
              <Activity className="h-4 w-4" />
            </div>
            <h1 className="text-base font-semibold text-slate-200 hidden md:block">
              Operations Center
            </h1>
          </div>

          {/* Quick Stats Grid */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 text-xs">
              <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />
              <span className="text-slate-400 font-medium hidden sm:inline">Active Incidents:</span>
              <span className="font-bold text-amber-400 font-mono text-sm">{activeCount}</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 text-xs">
              <Award className="h-4 w-4 text-emerald-500" />
              <span className="text-slate-400 font-medium hidden sm:inline">Resolved Today:</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">{resolvedCount}</span>
            </div>
          </div>
        </header>

        {/* Route Pages Container */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 relative">
          <div className="absolute top-0 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-600/5 blur-[80px] pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
