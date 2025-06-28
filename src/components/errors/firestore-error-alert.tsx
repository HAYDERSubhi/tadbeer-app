// src/components/errors/firestore-error-alert.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

interface FirestoreErrorAlertProps {
    error: Error | null;
    context: string; // e.g., "المصاريف", "الأهداف"
}

export default function FirestoreErrorAlert({ error, context }: FirestoreErrorAlertProps) {
    return (
        <div className="flex h-[80vh] w-full items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-2xl text-right">
                <Terminal className="h-4 w-4" />
                <AlertTitle>خطأ في جلب البيانات من Firestore</AlertTitle>
                <AlertDescription>
                    <p>تعذر على التطبيق تحميل بياناتك ({context}) من قاعدة البيانات.</p>
                    <p className="mt-2">هذا يحدث غالبًا بسبب مشكلة في إعدادات مشروع Firebase. يرجى التحقق من التالي:</p>
                    <ul className="my-2 list-disc list-inside space-y-2 pr-4">
                        <li>تأكد من أن <strong>Cloud Firestore</strong> مفعل في مشروعك على Firebase.</li>
                        <li>اذهب إلى قسم <strong>Rules</strong> في Firestore وتأكد من أن القواعد تسمح بالقراءة للمستخدمين المسجلين (e.g., <code>allow read: if request.auth != null;</code>).</li>
                        <li>تأكد من أن قيمة <code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> في ملف <code>.env</code> صحيحة ومطابقة لمعرف المشروع في Firebase.</li>
                    </ul>
                    <p className="mt-2">إذا استمرت المشكلة، قد يكون هناك خطأ في الشبكة يمنع الاتصال بخوادم Google.</p>
                    {error?.message && (
                        <pre className="mt-4 rounded-md bg-slate-800/50 p-3 text-left font-mono text-xs text-slate-400 overflow-x-auto">
                            {error.message}
                        </pre>
                    )}
                </AlertDescription>
            </Alert>
        </div>
    );
}
