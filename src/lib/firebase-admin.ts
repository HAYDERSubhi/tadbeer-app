// src/lib/firebase-admin.ts
// Server-only Firebase Admin SDK. Runs with service-account privileges and
// therefore BYPASSES Firestore security rules — never import this into any
// client component. Credentials come from server-side env vars (set in Vercel):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores the key with literal "\n" sequences; turn them back into
  // real newlines so the PEM parser accepts the private key.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase admin credentials are not configured on the server.');
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export const adminDb = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
