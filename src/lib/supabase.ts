import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// A custom storage provider that saves auth state in cookies so it is accessible in Next.js middleware and server components
const customCookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const cookies = document.cookie.split('; ');
    const cookie = cookies.find((row) => row.startsWith(`${key}=`));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    // Set cookie valid for 1 year, Lax SameSite, secure in production
    const secureFlag = window.location.protocol === 'https:' ? 'Secure;' : '';
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax; ${secureFlag}`;
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customCookieStorage,
  },
});
