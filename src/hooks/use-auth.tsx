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
  const authAttempted = useRef(false); // Ref to ensure sign-in is only attempted once.

  useEffect(() => {
    // If Firebase is not configured (e.g., missing env vars), auth will be null.
    // Stop loading immediately so the UI can show the configuration error message.
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // If a user is found (either from a previous session or after a successful sign-in),
        // set the user and stop loading.
        setUser(currentUser);
        setLoading(false);
      } else if (!authAttempted.current) {
        // If there's no user and we haven't tried signing in yet, this is our one shot.
        authAttempted.current = true; // Mark that we are attempting to sign in.
        
        try {
          await signInAnonymously(auth);
          // After successful sign-in, onAuthStateChanged will be triggered again with
          // the new user. The 'if (currentUser)' block will handle it. We don't need
          // to do anything else here.
        } catch (error) {
          // This is the critical error handling block. If anonymous sign-in fails
          // (e.g., due to an invalid API key), we catch the error here.
          console.error("Firebase anonymous sign-in failed. Please check your Firebase configuration.", error);
          
          // We stop loading and ensure user is null. The UI will then render the
          // helpful error message instead of crashing.
          setLoading(false);
        }
      } else {
        // If we've already attempted to sign in and there's still no user,
        // it means the sign-in attempt failed. Stop loading to show the error UI.
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
