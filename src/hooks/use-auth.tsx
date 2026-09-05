// src/hooks/use-auth.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  Auth,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  UserCredential,
  signInAnonymously,
  linkWithRedirect,
  updateProfile
} from 'firebase/auth';
// FirebaseError تُصدَّر من firebase/app لا من firebase/auth — كان استيرادها من
// الأخيرة خطأ نوع صامتاً (بلا أثر وقت التشغيل لأنها تُستعمل كنوع فقط ويُحذف الاستيراد).
import type { FirebaseError } from 'firebase/app';
import { logEvent } from 'firebase/analytics';
import { auth as firebaseAuth, googleProvider, analytics } from '@/lib/firebase';
import { recordReferral } from '@/services/firestore';
import { trackMetaEvent } from '@/lib/meta-pixel';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: FirebaseError | null;
  signInWithEmailPassword: (email: string, password: string) => Promise<any>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<UserCredential>;
  signOutUser: () => Promise<void>;
  linkGuestWithGoogle: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// حارس على مستوى الوحدة (لا يُصفَّر بإعادة تركيب StrictMode في التطوير):
// يضمن معالجة نتيجة العودة من تحويل جوجل مرة واحدة فقط لكل تحميل صفحة.
let redirectResultHandled = false;

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

  // الدخول بجوجل يتم بالتحويل (Redirect) — الصفحة تغادر لجوجل وترجع، لذا
  // كل منطق "ما بعد النجاح" (حدث القياس، الإحالة، البكسل، الترحيب) يعالَج هنا
  // عند العودة، مرة واحدة عند إقلاع التطبيق. getRedirectResult ترجع null في
  // التحميل العادي (لا عودة من تحويل) فلا أثر لها.
  useEffect(() => {
    if (!auth || redirectResultHandled) return;
    redirectResultHandled = true;
    getRedirectResult(auth)
      .then((result) => {
        if (!result) return; // تحميل عادي
        // ترقية زائر → حساب Google (نفس uid، البيانات محفوظة)
        if (result.operationType === 'link') {
          toast({ title: 'تم حفظ حسابك! ✅', description: 'بياناتك الآن آمنة ومُزامنة على كل أجهزتك.' });
          return;
        }
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser;
        if (isNewUser) {
          const refUid = sessionStorage.getItem('tadbeer-ref');
          if (refUid) { recordReferral(refUid, result.user.uid).catch(() => {}); sessionStorage.removeItem('tadbeer-ref'); }
          if (analytics) { try { logEvent(analytics, 'sign_up', { method: 'google' }); } catch {} }
          trackMetaEvent('CompleteRegistration', { content_name: 'google' });
          toast({ title: 'مرحباً بك في تدبير! 🎉', description: 'حسابك جاهز — لنبدأ.' });
        } else {
          toast({ title: 'أهلاً بعودتك!' });
        }
      })
      .catch((error: any) => {
        console.error('google redirect result error:', error?.code, error);
        let description = 'تعذّر إكمال الدخول بـ Google. حاول مجدداً.';
        if (error?.code === 'auth/credential-already-in-use')
          description = 'حساب Google هذا مرتبط بحساب تدبير آخر — سجّل الدخول به مباشرةً.';
        else if (error?.code === 'auth/account-exists-with-different-credential')
          description = 'يوجد حساب بنفس البريد بطريقة دخول أخرى — جرّب الدخول بالبريد.';
        else if (error?.code === 'auth/network-request-failed')
          description = 'فشل الاتصال بالشبكة. تحقق من الإنترنت وحاول مجدداً.';
        else if (error?.code === 'auth/unauthorized-domain')
          description = 'النطاق الحالي غير مصرّح في Firebase Authorized Domains.';
        toast({ title: 'لم يكتمل الدخول', description, variant: 'destructive' });
      });
  }, [auth]);

  const signInWithEmailPassword = (email: string, password: string) => {
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    return signInWithEmailAndPassword(auth, email, password);
  }

  const signUpWithEmailPassword = (email: string, password: string) => {
    if (!auth) return Promise.reject(new Error("Firebase not configured."));
    return createUserWithEmailAndPassword(auth, email, password);
  }

  // تحويل كامل الصفحة لجوجل — الطريقة الموثوقة على الجوال (جمهور تدبير حصراً).
  // لا يعود بنتيجة: النتيجة تُلتقط عند العودة عبر getRedirectResult أعلاه.
  const signInWithGoogle = (): Promise<void> => {
    if (!googleProvider || !auth) {
      return Promise.reject(new Error("Google Auth provider or Firebase Auth not initialized."));
    }
    return signInWithRedirect(auth, googleProvider);
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

  // يحوّل حساب الزائر (المجهول) إلى حساب Google دائم — يحافظ على نفس uid وكل البيانات.
  // بالتحويل أيضاً: الإكمال والترحيب يعالَجان عند العودة (operationType === 'link').
  const linkGuestWithGoogle = (): Promise<void> => {
    if (!auth?.currentUser || !googleProvider) {
      return Promise.reject(new Error("لا يوجد مستخدم زائر لربطه."));
    }
    return linkWithRedirect(auth.currentUser, googleProvider);
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
