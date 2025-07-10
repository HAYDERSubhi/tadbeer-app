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
  UserCredential,
  signInAnonymously
} from 'firebase/auth';
import { auth as firebaseAuth, googleProvider } from '@/lib/firebase';
import { addExpense } from '@/services/firestore';
import { getAdditionalUserInfo } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: FirebaseError | null;
  signInWithEmailPassword: (email: string, password: string) => Promise<any>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<UserCredential>;
  signInAsGuest: () => Promise<UserCredential>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<FirebaseError | null>(null);

  const auth = firebaseAuth;

  useEffect(() => {
    // This effect now specifically checks for the `auth/configuration-missing` scenario
    // which happens when firebase.ts fails to initialize due to missing .env variables.
    if (!auth) {
      setAuthError({
        code: 'auth/configuration-missing',
        message: 'Firebase configuration is incomplete. Please check that all required environment variables (NEXT_PUBLIC_FIREBASE_*) are set in your .env file.',
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
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    return signInWithEmailAndPassword(auth, email, password);
  }

  const signUpWithEmailPassword = (email: string, password: string) => {
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    return createUserWithEmailAndPassword(auth, email, password);
  }

  const signInWithGoogle = (): Promise<UserCredential> => {
    if (!googleProvider || !auth) {
      return Promise.reject(new Error("Google Auth provider or Firebase Auth not initialized."));
    }
    return signInWithPopup(auth, googleProvider);
  }
  
  const signInAsGuest = async (): Promise<UserCredential> => {
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    
    const userCredential = await signInAnonymously(auth);
    const additionalInfo = getAdditionalUserInfo(userCredential);

    if (additionalInfo?.isNewUser && userCredential.user) {
      const sampleExpenses = [
        { title: 'قهوة الصباح', amount: 3000, category: 'food', date: new Date().toISOString() },
        { title: 'تعبئة وقود السيارة', amount: 45000, category: 'private_car', date: new Date(Date.now() - 86400000 * 2).toISOString() },
        { title: 'فاتورة انترنت', amount: 30000, category: 'subscriptions', date: new Date(Date.now() - 86400000 * 5).toISOString() },
      ];
      await Promise.all(sampleExpenses.map(exp => addExpense(userCredential.user.uid, exp)));
    }
    return userCredential;
  }
  
  const signOutUser = () => {
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    return signOut(auth);
  }

  const value = useMemo(() => ({ 
    user, 
    loading, 
    authError,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    signInAsGuest,
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
