'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Activity, Mail, Lock, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // If auto-sign-in is disabled or verification email is sent
        if (data.session) {
          setMessage({ type: 'success', text: 'Account created successfully! Redirecting...' });
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          setMessage({
            type: 'success',
            text: 'Sign up successful! Please check your email to verify your account or try signing in.',
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setMessage({ type: 'success', text: 'Authentication successful! Redirecting...' });
        // Give cookie storage a millisecond to synchronize
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred during authentication.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setMessage(null);

    const demoEmail = `operator-${Math.floor(100 + Math.random() * 900)}@warroom.com`;
    const demoPassword = 'Password123!';

    try {
      // 1. Try to sign up the new demo account
      const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
      });

      if (signUpError) {
        throw signUpError;
      }

      // 2. If it did not sign in automatically, sign in manually
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        if (signInError) throw signInError;
      }

      setMessage({ type: 'success', text: `Demo operator account active: ${demoEmail}. Redirecting...` });
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to initialize demo operator.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />
      <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-rose-600/10 blur-[100px] pointer-events-none" />

      {/* Main Glass Box */}
      <div className="relative z-10 w-full max-w-md px-6 sm:px-0">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30 animate-pulse">
              <Activity className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white font-mono">
              WAR ROOM DASHBOARD
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Synchronized Real-Time Incident Management
            </p>
          </div>

          {/* Alert Message */}
          {message && (
            <div
              className={`mt-6 flex gap-2.5 rounded-lg border p-3.5 text-xs ${
                message.type === 'error'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          {/* Form */}
          <form className="mt-6 space-y-4" onSubmit={handleAuth}>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                Email Address
              </label>
              <div className="relative mt-1">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.98] disabled:bg-violet-700/50 disabled:text-slate-300"
            >
              {loading ? (
                <RefreshCw className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Initialize Account' : 'Authenticate Credentials'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch Auth Mode */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors focus:outline-none"
            >
              {isSignUp ? 'Already registered? Sign In' : 'Need operator access? Register now'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-850" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2.5 text-slate-500 font-mono">Demo Environment</span>
            </div>
          </div>

          {/* Demo Login Button */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:text-white"
          >
            {loading ? (
              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <span>Quick Demo Operator Sign-In</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
