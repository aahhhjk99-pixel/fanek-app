import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const ADMIN_PHONE = '0930656956';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error loading profile:', error);
      return;
    }
    const profileData = data as Profile | null;
    if (profileData && profileData.account_status === 'banned') {
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(profileData);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.id) {
        (async () => {
          await loadProfile(session.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    if (Platform.OS === 'web') {
      try { localStorage.clear(); } catch {}
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!session?.user?.id) return;
    const token = session.access_token;
    const supabaseUrl =
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';
    const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      throw new Error(result?.error || 'فشل حذف الحساب');
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Account is already deleted server-side; signOut may fail to revoke
      // an already-invalid session. That's fine — proceed to clear local state.
    }
    setProfile(null);
    setSession(null);
    if (Platform.OS === 'web') {
      try { localStorage.clear(); } catch {}
    }
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { ADMIN_PHONE };
