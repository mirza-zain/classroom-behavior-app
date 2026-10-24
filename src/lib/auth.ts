import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Reusable hook to enforce that a user is authenticated on protected screens.
 * If no session exists or session expires, automatically redirects to /login.
 */
export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (isMounted) {
            setUser(null);
            setCheckingAuth(false);
            router.replace('/login');
          }
          return;
        }

        if (isMounted) {
          setUser(data.user);
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        if (isMounted) {
          setUser(null);
          setCheckingAuth(false);
          router.replace('/login');
        }
      }
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session && isMounted) {
          setUser(null);
          router.replace('/login');
        } else if (session?.user && isMounted) {
          setUser(session.user);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return { user, checkingAuth };
}

