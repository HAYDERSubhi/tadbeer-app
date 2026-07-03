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
  signInAnonymously,
  linkWithPopup,
  updateProfile
} from 'firebase/auth';
import { auth as firebaseAuth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: FirebaseError | null;
  signInWithEmailPassword: (email: string, password: string) => Promise<any>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<UserCredential>;
  signInAsGuest: () => Promise<UserCredential>;
  signOutUser: () => Promise<void>;
  linkGuestWithGoogle: () => Promise<UserCredential>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize synchronously from the Firebase-cached auth state so we never
  // flash a loading screen when the user is already signed in.
  const auth = firebaseAuth;
  // Synchronous init: if Firebase already resolved the auth state (cached),
  // start with the real user so no loading flash occurs for returning users.
  const [user, setUser] = useState<User | null>(() => auth?.currentUser ?? null);
  // loading=true only when Firebase hasn't yet resolved the auth state.
  // If currentUser is already set (cached login), we start as not-loading.
  // If currentUser is null, Firebase may still be resolving — stay loading.
  const [loading, setLoading] = useState<boolean>(() => {
    if (!auth) return false; // No Firebase → no loading, show error
    return auth.currentUser === null; // null = not yet resolved OR logged out
  });
  const [authError, setAuthError] = useState<FirebaseError | null>(null);
  // updateProfile يعدّل كائن المستخدم في مكانه (نفس المرجع) فلا يعيد React
  // رسم المستهلكين تلقائياً — هذا العدّاد يجبر تحديث قيمة الـ context بعد كل تعديل.
  const [profileVersion, setProfileVersion] = useState(0);

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
    
    // For guest users, we just sign them in without adding any sample data
    // to give them a clean slate.
    const userCredential = await signInAnonymously(auth);
    return userCredential;
  }
  
  const signOutUser = () => {
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    return signOut(auth);
  }

  // يحوّل حساب الزائر (المجهول) إلى حساب Google دائم — يحافظ على نفس uid وكل البيانات
  const linkGuestWithGoogle = (): Promise<UserCredential> => {
    if (!auth?.currentUser || !googleProvider) {
      return Promise.reject(new Error("لا يوجد مستخدم زائر لربطه."));
    }
    return linkWithPopup(auth.currentUser, googleProvider);
  }

  // يحفظ الاسم الذي يُنادى به المستخدم (اختياري) — نص فارغ يزيل الاسم
  const updateDisplayName = async (name: string) => {
    if (!auth?.currentUser) return Promise.reject(new Error("لا يوجد مستخدم مسجّل."));
    await updateProfile(auth.currentUser, { displayName: name.trim() || null });
    setProfileVersion(v => v + 1);
  };

  const value = useMemo(() => ({
    user,
    loading,
    authError,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    signInAsGuest,
    signOutUser,
    linkGuestWithGoogle,
    updateDisplayName,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, loading, authError, profileVersion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
