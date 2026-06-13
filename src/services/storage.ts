
// src/services/storage.ts
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a receipt image blob to Firebase Storage and returns the download URL.
 * @param uid The user ID.
 * @param imageBlob The image blob to upload.
 * @returns A promise that resolves to the download URL.
 */
export const uploadReceiptImage = async (uid: string, imageBlob: Blob): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage is not initialized");
    
    const imageId = crypto.randomUUID();
    const storageRef = ref(storage, `users/${uid}/receipts/${imageId}.jpg`);
    
    // Set metadata for caching and type
    const metadata = {
        contentType: 'image/jpeg',
    };
    
    await uploadBytes(storageRef, imageBlob, metadata);
    return getDownloadURL(storageRef);
};

/**
 * يرفع إثبات دفع (صورة وصل) لسلفة ويعيد رابط التحميل.
 */
export const uploadSilftnaProof = async (uid: string, silftnaId: string, imageBlob: Blob): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage is not initialized");
    const imageId = crypto.randomUUID();
    const storageRef = ref(storage, `users/${uid}/silftna/${silftnaId}/proofs/${imageId}.jpg`);
    await uploadBytes(storageRef, imageBlob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
};

/**
 * يرفع توقيع إلكتروني (PNG) لإقرار استلام سلفة ويعيد رابط التحميل.
 */
export const uploadSilftnaSignature = async (uid: string, silftnaId: string, pngBlob: Blob): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage is not initialized");
    const sigId = crypto.randomUUID();
    const storageRef = ref(storage, `users/${uid}/silftna/${silftnaId}/signatures/${sigId}.png`);
    await uploadBytes(storageRef, pngBlob, { contentType: 'image/png' });
    return getDownloadURL(storageRef);
};
