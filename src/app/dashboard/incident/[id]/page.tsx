'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Activity, CheckSquare, Square, Trash2, Send, Users, ShieldAlert,
  Loader, CheckCircle2, User, ArrowLeft, Plus
} from 'lucide-react';

interface Incident {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

interface Task {
  id: string;
  description: string;
  completed: boolean;
  completed_by?: string;
  created_at: string;
}

interface Message {
  id: string;
  user_email: string;
  content: string;
  created_at: string;
}

export default function IncidentWarRoomPage({ params }: { params: any }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);

  // States
  const [incident, setIncident] = useState<Incident | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState(false);

  // Layout refs
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Unwrap params safely for Next.js App Router (supports both sync/async params)
  useEffect(() => {
    Promise.resolve(params).then((resolved) => {
      setId(resolved.id);
    });
  }, [params]);

  // Main page initialization
  useEffect(() => {
    if (!id) return;

    let tasksChannel: any;
    let messagesChannel: any;
    let presenceChannel: any;
    let incidentUpdatesChannel: any;

    const initializeRoom = async () => {
      try {
        // 1. Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setCurrentUser(user);

        // 2. Fetch incident details (Try to read)
        let { data: incData, error: incError } = await supabase
          .from('incidents')
          .select('*')
          .eq('id', id)
          .single();

        // RLS blocks read if user is not in incident_members.
        // If not found or RLS blocked, attempt to join automatically.
        if (incError || !incData) {
          console.log('Not a member of incident yet. Attempting to join...');
          const { error: joinError } = await supabase
            .from('incident_members')
            .insert({ incident_id: id, user_id: user.id });

          if (joinError) {
            console.error('Failed to join incident:', joinError);
            router.push('/dashboard');
            return;
          }

          // Retry fetching incident details
          const { data: retryData, error: retryError } = await supabase
            .from('incidents')
            .select('*')
            .eq('id', id)
            .single();

          if (retryError || !retryData) {
            throw new Error('Unauthorized or incident does not exist');
          }
          incData = retryData;
        }

        setIncident(incData);

        // 3. Fetch Tasks
        const { data: taskData } = await supabase
          .from('tasks')
          .select('*')
          .eq('incident_id', id)
          .order('created_at', { ascending: true });
        
        if (taskData) setTasks(taskData);

        // 4. Fetch Messages
        const { data: msgData } = await supabase
          .from('messages')
          .select('*')
          .eq('incident_id', id)
          .order('created_at', { ascending: true });
        
        if (msgData) setMessages(msgData);
        setLoading(false);

        // --- REAL-TIME CHANNELS SETUP ---
        const channelSuffix = Math.random().toString(36).substring(7);

        // A. Listen to incident status changes (e.g. if another operator resolves it)
        incidentUpdatesChannel = supabase
          .channel(`incident-details-${id}-${channelSuffix}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${id}` },
            (payload) => {
              setIncident(payload.new as Incident);
            }
          )
          .subscribe();

        // B. Listen to Tasks changes
        tasksChannel = supabase
          .channel(`room-tasks-${id}-${channelSuffix}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tasks', filter: `incident_id=eq.${id}` },
            async () => {
              // Re-fetch tasks on any DB change to ensure correct ordering and completed_by information
              const { data } = await supabase
                .from('tasks')
                .select('*')
                .eq('incident_id', id)
                .order('created_at', { ascending: true });
              if (data) setTasks(data);
            }
          )
          .subscribe();

        // C. Listen to Messages changes
        messagesChannel = supabase
          .channel(`room-messages-${id}-${channelSuffix}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `incident_id=eq.${id}` },
            (payload) => {
              setMessages((prev) => [...prev, payload.new as Message]);
            }
          )
          .subscribe();

        // D. Setup Presence to track online operators
        presenceChannel = supabase.channel(`presence-incident-${id}-${channelSuffix}`);
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const usersList = Object.values(state).flatMap((presences: any) =>
              presences.map((p: any) => p.userEmail)
            );
            // Deduplicate
            setOnlineUsers(Array.from(new Set(usersList)));
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                userEmail: user.email,
                onlineAt: new Date().toISOString(),
              });
            }
          });

      } catch (err) {
        console.error('War room load error:', err);
        router.push('/dashboard');
      }
    };

    initializeRoom();

    return () => {
      if (tasksChannel) supabase.removeChannel(tasksChannel);
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (incidentUpdatesChannel) supabase.removeChannel(incidentUpdatesChannel);
    };
  }, [id, router]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Action: Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDesc.trim() || submittingTask || !id || !currentUser) return;

    setSubmittingTask(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        incident_id: id,
        description: newTaskDesc.trim(),
        completed: false,
      });
      if (error) throw error;
      setNewTaskDesc('');
    } catch (err) {
      console.error('Error adding task:', err);
    } finally {
      setSubmittingTask(false);
    }
  };

  // Action: Toggle Task Complete
  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    if (!currentUser) return;
    try {
      // Optimistic state update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: !currentStatus,
                completed_by: !currentStatus ? currentUser.id : undefined,
              }
            : t
        )
      );

      const { error } = await supabase
        .from('tasks')
        .update({
          completed: !currentStatus,
          completed_by: !currentStatus ? currentUser.id : null,
          completed_at: !currentStatus ? new Date().toISOString() : null,
        })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Error toggling task:', err);
      // Revert if error occurs by refetching tasks
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('incident_id', id)
        .order('created_at', { ascending: true });
      if (data) setTasks(data);
    }
  };

  // Action: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    try {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Action: Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !id || !currentUser) return;

    const messageContent = newMessageText.trim();
    setNewMessageText(''); // Clear input optimistically

    try {
      const { error } = await supabase.from('messages').insert({
        incident_id: id,
        user_id: currentUser.id,
        user_email: currentUser.email,
        content: messageContent,
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Action: Resolve Incident
  const handleResolveIncident = async () => {
    if (!id || resolvingIncident) return;
    setResolvingIncident(true);

    try {
      const { error } = await supabase
        .from('incidents')
        .update({ status: 'resolved' })
        .eq('id', id);

      if (error) throw error;
      setIncident((prev: any) => prev ? { ...prev, status: 'resolved' } : null);
    } catch (err) {
      console.error('Error resolving incident:', err);
    } finally {
      setResolvingIncident(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 text-violet-500 animate-spin" />
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-mono">
            Loading War Room...
          </span>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="h-10 w-10 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-white font-mono uppercase">Incident Room Unavailable</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          This incident does not exist, or you lack the proper clearance level to view this war room.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-semibold hover:bg-slate-850"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Safety</span>
        </button>
      </div>
    );
  }

  // Calculate task progress percentage
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/40 border border-slate-900 p-5 rounded-xl backdrop-blur-xl">
        <div className="flex gap-4 items-start">
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-1 rounded-lg border border-slate-850 bg-slate-950 p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-all focus:outline-none"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-100 font-mono">
                {incident.name}
              </h2>
              <span
                className={`rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider font-mono border ${
                  incident.severity === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : incident.severity === 'high'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                }`}
              >
                {incident.severity}
              </span>
              
              <span
                className={`rounded px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase font-mono ${
                  incident.status === 'active'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                }`}
              >
                {incident.status === 'active' ? 'Active Incident' : 'Resolved'}
              </span>
            </div>
            
            <p className="text-xs text-slate-450 mt-1 max-w-2xl">
              {incident.description || 'No description logged.'}
            </p>
          </div>
        </div>

        {/* Action Header right: Online users and Resolve button */}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-900/60 lg:border-t-0 pt-4 lg:pt-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-900">
            <Users className="h-4 w-4 text-violet-400" />
            <span className="font-semibold font-mono">{onlineUsers.length} Operators Online</span>
          </div>

          {incident.status === 'active' && (
            <button
              onClick={handleResolveIncident}
              disabled={resolvingIncident}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark Resolved</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid panels */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Panel - Tasks board (columns 7) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-900 bg-slate-900/30 backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono">
              Action Plan Tasks Checklist
            </h3>
            
            <span className="text-xs font-bold text-violet-400 font-mono">
              {progressPercent}% Complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-900">
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 ease-out"
            />
          </div>

          {/* Add task form */}
          {incident.status === 'active' && (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Log a new mitigation task..."
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-655 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submittingTask}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            </form>
          )}

          {/* Tasks List */}
          {tasks.length === 0 ? (
            <div className="text-center p-8 text-slate-550 text-xs font-mono">
              No tasks assigned. Create action points above.
            </div>
          ) : (
            <div className="divide-y divide-slate-900/60 max-h-[450px] overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between py-3.5 group gap-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      disabled={incident.status !== 'active'}
                      onClick={() => handleToggleTask(task.id, task.completed)}
                      className={`text-slate-455 transition-colors focus:outline-none flex-shrink-0 ${
                        incident.status === 'active' ? 'cursor-pointer hover:text-violet-400' : 'opacity-70'
                      }`}
                    >
                      {task.completed ? (
                        <CheckSquare className="h-5 w-5 text-violet-500" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                    
                    <span
                      className={`text-xs min-w-0 truncate transition-all ${
                        task.completed
                          ? 'line-through text-slate-500 decoration-slate-700'
                          : 'text-slate-200'
                      }`}
                    >
                      {task.description}
                    </span>
                  </div>

                  {/* Actions (Delete icon appears on hover for active incidents) */}
                  {incident.status === 'active' && (
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition-all p-1.5 focus:outline-none"
                      title="Remove task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Live Chat (columns 5) */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-slate-900 bg-slate-900/30 backdrop-blur-xl p-5 h-[580px]">
          <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono mb-3">
            Operator Live Chat
          </h3>

          {/* Messages Board */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center p-8 text-slate-550 text-xs font-mono">
                Room communication logs empty. Start the dialogue below.
              </div>
            ) : (
              <div className="space-y-3.5 mt-auto">
                {messages.map((msg) => {
                  const isSelf = msg.user_email === currentUser?.email;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      {/* Message author */}
                      <span className="text-[9px] font-semibold text-slate-500 font-mono mb-1 truncate max-w-full">
                        {isSelf ? 'You' : msg.user_email.split('@')[0]}
                      </span>

                      {/* Bubble */}
                      <div
                        className={`rounded-xl px-3.5 py-2 text-xs shadow-md ${
                          isSelf
                            ? 'bg-violet-600 text-white rounded-tr-none'
                            : 'bg-slate-950 border border-slate-855 text-slate-200 rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Date indicator */}
                      <span className="text-[8px] text-slate-600 font-mono mt-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Message input form */}
          {incident.status === 'active' ? (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Secure message to operators..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-650 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white active:scale-[0.98]"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="rounded-lg border border-slate-850 bg-slate-950/50 p-3 text-center text-[10px] font-bold text-slate-500 tracking-wider font-mono uppercase">
              Incident Resolved — Communications Locked
            </div>
          )}
        </div>
      </div>

      {/* Online Operators details footer widget */}
      <div className="rounded-xl border border-slate-900 bg-slate-950 p-4">
        <h4 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono mb-2 flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-violet-500" />
          Active Incident Operations Roster
        </h4>
        <div className="flex flex-wrap gap-2.5">
          {onlineUsers.map((email) => (
            <div
              key={email}
              className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-350"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>{email}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
