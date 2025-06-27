// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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

  useEffect(() => {
    // If Firebase is not configured, auth will be null.
    // In this case, we stop loading, and the UI will show the config error.
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // User is signed in.
        setUser(currentUser);
        setLoading(false);
      } else {
        // No user is signed in. Attempt to sign in anonymously.
        signInAnonymously(auth)
          // The successful sign-in will trigger onAuthStateChanged again.
          .catch((error) => {
            // This catch block handles failures, e.g., invalid API key.
            // This prevents an unhandled promise rejection which causes the app to crash.
            console.error("Firebase anonymous sign-in failed. Please check your Firebase configuration.", error);
            // By setting loading to false, we allow the UI to show the error message.
            setLoading(false);
          });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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
