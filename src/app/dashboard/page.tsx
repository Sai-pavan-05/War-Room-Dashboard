'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Plus, AlertOctagon, RefreshCw, Calendar, ArrowRight, X, AlertTriangle, ShieldCheck
} from 'lucide-react';

interface Incident {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setIncidents(data);
    } catch (err: any) {
      console.error('Error fetching incidents:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();

    // Subscribe to Postgres changes for incidents
    const channel = supabase
      .channel('dashboard-incidents-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        () => {
          fetchIncidents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setFormSubmitting(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('incidents')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          severity,
          status: 'active',
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Close modal and reset fields
      setName('');
      setDescription('');
      setSeverity('medium');
      setModalOpen(false);
      
      // Refresh list
      fetchIncidents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create incident.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getSeverityStyles = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400 ring-rose-500/20';
      case 'high':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400 ring-amber-500/20';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 ring-yellow-500/20';
      default:
        return 'bg-slate-800/40 border-slate-700/50 text-slate-400 ring-slate-700/20';
    }
  };

  const activeIncidents = incidents.filter((i) => i.status === 'active');
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');

  return (
    <div className="space-y-8">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono uppercase">
            Active Operations Desk
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Create or monitor ongoing incident war rooms. All changes broadcast globally.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span>Report Live Incident</span>
        </button>
      </div>

      {/* Grid of incidents */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-900 bg-slate-900/10">
          <RefreshCw className="h-6 w-6 text-slate-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active incidents section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono">
                Active War Rooms ({activeIncidents.length})
              </h3>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-12 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
                <ShieldCheck className="h-8 w-8 text-emerald-500/60 mb-3" />
                <p className="text-sm font-medium text-slate-300">All systems operational</p>
                <p className="text-xs text-slate-500 mt-1">No active incidents reported in this sector.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-900 bg-slate-900/40 p-5 hover:border-slate-800 hover:bg-slate-900/60 transition-all hover:shadow-xl hover:shadow-violet-950/5 group"
                  >
                    <div>
                      {/* Badge row */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono ${getSeverityStyles(
                            incident.severity
                          )}`}
                        >
                          {incident.severity}
                        </span>
                        
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(incident.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-200 mt-4 group-hover:text-white transition-colors">
                        {incident.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 min-h-[2.5rem]">
                        {incident.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-slate-900/60 pt-4 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">
                        REF: {incident.id.slice(0, 8)}
                      </span>
                      
                      <Link
                        href={`/dashboard/incident/${incident.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 hover:gap-1.5 transition-all focus:outline-none"
                      >
                        <span>Join War Room</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved incidents section */}
          {resolvedIncidents.length > 0 && (
            <div>
              <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase font-mono mb-4">
                Recently Resolved ({resolvedIncidents.length})
              </h3>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                {resolvedIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-900/60 bg-slate-950 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                          {incident.severity}
                        </span>
                        <span className="text-[9px] text-slate-600 font-mono">
                          {new Date(incident.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-400 mt-3 line-clamp-1">
                        {incident.name}
                      </h4>
                    </div>

                    <div className="mt-4 border-t border-slate-900/40 pt-3 flex items-center justify-between">
                      <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider font-mono">
                        Resolved
                      </span>
                      <Link
                        href={`/dashboard/incident/${incident.id}`}
                        className="text-xs text-slate-500 hover:text-slate-400"
                      >
                        View Logs
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal for creating incident */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold tracking-wider text-white font-mono uppercase">
                  Log New System Incident
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-rose-500/10 border-y border-rose-500/20 p-3.5 text-xs text-rose-400 flex gap-2">
                <AlertOctagon className="h-4.5 w-4.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form body */}
            <form onSubmit={handleCreateIncident}>
              <div className="p-5 space-y-4.5">
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                    Incident Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Stripe API Outage / DB Connections Maxed Out"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-650 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                    Incident Description
                  </label>
                  <textarea
                    placeholder="Provide details about the outage symptoms, impact, and affected systems..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-650 focus:border-violet-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Severity Selection */}
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                    Incident Severity Level
                  </label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSeverity(level)}
                        className={`rounded-lg border py-2.5 text-xs font-bold uppercase tracking-wider font-mono transition-all ${
                          severity === level
                            ? level === 'critical'
                              ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                              : level === 'high'
                              ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                              : level === 'medium'
                              ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                              : 'bg-slate-700/50 border-slate-500 text-slate-200'
                            : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/40 p-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-350 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
                >
                  {formSubmitting ? 'Spawning War Room...' : 'Confirm Outage & Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
