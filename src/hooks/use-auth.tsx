// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  FirebaseError,
  Auth,
  signInWithPopup,
  UserCredential
} from 'firebase/auth';
import { auth as firebaseAuth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: FirebaseError | null;
  signInWithEmailPassword: (email: string, password: string) => Promise<any>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<UserCredential>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<FirebaseError | null>(null);

  const auth = firebaseAuth as Auth; // Cast to ensure auth is not null

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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const signInWithEmailPassword = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  }

  const signUpWithEmailPassword = (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  const signInWithGoogle = (): Promise<UserCredential> => {
    if (!googleProvider || !auth) {
      return Promise.reject(new Error("Google Auth provider or Firebase Auth not initialized."));
    }
    return signInWithPopup(auth, googleProvider);
  }
  
  const signOutUser = () => {
    return signOut(auth);
  }

  const value = useMemo(() => ({ 
    user, 
    loading, 
    authError,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    signOutUser,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, loading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
