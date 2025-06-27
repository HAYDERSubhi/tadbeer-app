// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import {
  onAuthStateChanged,
  User,
  signInAnonymously,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authAttempted = useRef(false); // Use a ref to prevent re-renders and repeated sign-in attempts.

  useEffect(() => {
    // If Firebase is not configured at all (e.g., missing env vars), auth will be null.
    // We stop loading immediately, and the UI will show the configuration error message.
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // If a user is found (either from a previous session or after a successful sign-in),
        // we set the user and stop loading.
        setUser(currentUser);
        setLoading(false);
      } else if (!authAttempted.current) {
        // If there's no user and we haven't tried signing in yet, this is our one shot.
        authAttempted.current = true; // Mark that we are attempting to sign in.
        
        signInAnonymously(auth)
          .catch((error) => {
            // This is the critical error handling block. If anonymous sign-in fails
            // (e.g., due to an invalid API key), we catch the error here.
            console.error("Firebase anonymous sign-in failed. Please check your Firebase configuration.", error);
            
            // We stop loading and ensure user is null. The UI will then render the
            // helpful error message instead of crashing.
            setLoading(false);
          });
      } else {
        // If we've already attempted to sign in and there's still no user,
        // it means the sign-in failed. We stop loading to show the error UI.
        setLoading(false);
      }
    });

    // Cleanup the subscription when the component unmounts.
    return () => unsubscribe();
  }, []); // The empty dependency array ensures this effect runs only once.

  const value = {
    user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
