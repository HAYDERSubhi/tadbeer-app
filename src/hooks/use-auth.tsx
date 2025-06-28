// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import {
  onAuthStateChanged,
  User,
  signInAnonymously,
  FirebaseError
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: FirebaseError | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<FirebaseError | null>(null);

  useEffect(() => {
    if (!auth) {
      setAuthError({
        code: 'auth/configuration-missing',
        message: 'Firebase configuration is incomplete. Please check your .env file.',
        name: 'FirebaseError'
      } as FirebaseError);
      setLoading(false);
      return;
    }

    // This listener's only job is to sync React state with the Firebase auth state.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false); // The loading is finished once we have a definitive user state (or null).
    });

    // On initial load, if there's no user, attempt to sign in anonymously.
    // This runs only once.
    if (!auth.currentUser) {
        signInAnonymously(auth)
            .catch((error) => {
                console.error("Firebase anonymous sign-in failed.", error);
                // Use property checking for resilience against different error shapes.
                if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
                    setAuthError(error as FirebaseError);
                } else {
                    setAuthError({
                        code: 'auth/unknown-error',
                        message: 'An unknown error occurred during authentication.',
                        name: 'FirebaseError'
                    } as FirebaseError);
                }
                setLoading(false); // We are done loading, but with an error.
            });
    }

    // Cleanup the listener when the component unmounts.
    return () => unsubscribe();
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  // The value provided to the context should be memoized to prevent unnecessary re-renders
  // of consumers.
  const value = useMemo(() => ({ user, loading, authError }), [user, loading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
