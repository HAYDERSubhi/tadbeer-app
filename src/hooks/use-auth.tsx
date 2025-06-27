// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import {
  onAuthStateChanged,
  User,
  signInAnonymously,
  FirebaseError // Import FirebaseError
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: FirebaseError | null; // Add authError to context
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<FirebaseError | null>(null); // State for auth errors
  const authAttempted = useRef(false); 

  useEffect(() => {
    // This is a custom error object that looks like a FirebaseError for consistency.
    // It's used when the .env file is not set up.
    if (!auth) {
      setAuthError({
        code: 'auth/configuration-missing',
        message: 'Firebase configuration is incomplete in your .env file.',
        name: 'FirebaseError'
      } as FirebaseError);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null); // Clear any previous errors on successful login
        setLoading(false);
      } else if (!authAttempted.current) {
        authAttempted.current = true;
        
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Firebase anonymous sign-in failed.", error);
          if (error instanceof FirebaseError) {
            setAuthError(error); // Store the specific Firebase error
          } else {
             setAuthError({
               code: 'auth/unknown-error',
               message: 'An unknown error occurred during authentication.',
               name: 'FirebaseError'
             } as FirebaseError);
          }
          setLoading(false);
        }
      } else {
        // This case handles when onAuthStateChanged fires with `null` after an attempt has already been made
        // and failed. We just make sure loading is false, the authError is already set.
        if (!authError) {
            setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []); 

  const value = {
    user,
    loading,
    authError,
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
