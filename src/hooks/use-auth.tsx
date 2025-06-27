// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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

    // This listener just updates user state and loading status.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // If there was a user before but now there isn't (e.g. logged out), we don't clear the error
      // in case the error is the reason for the logout. But on successful login, clear it.
      if (currentUser) {
        setAuthError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Run only once on mount

  useEffect(() => {
    // This effect handles the action of signing in if needed.
    // It runs after the initial auth state has been determined by the first effect.
    if (!loading && !user && !authError) {
      signInAnonymously(auth).catch((error) => {
        // If sign-in fails, we catch the error and update the authError state.
        // This is a safe way to handle promise rejections in useEffect.
        console.error("Firebase anonymous sign-in failed.", error);
        // Use property checking instead of 'instanceof' for better resilience.
        if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
          setAuthError(error as FirebaseError);
        } else {
          setAuthError({
            code: 'auth/unknown-error',
            message: 'An unknown error occurred during authentication.',
            name: 'FirebaseError'
          } as FirebaseError);
        }
      });
    }
  }, [loading, user, authError]); // Reruns if loading, user, or authError state changes

  const value = { user, loading, authError };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
