import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import rawConfig from '../firebase-applet-config.json';
import { Member, AppNotification } from './types';
import { INITIAL_MEMBERS } from './data/initialData';

// Support VITE_ environment variables (safe for git/production) with local fallback
export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || rawConfig?.apiKey || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || rawConfig?.authDomain || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || rawConfig?.projectId || '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || rawConfig?.storageBucket || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || rawConfig?.messagingSenderId || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || rawConfig?.appId || '',
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || rawConfig?.firestoreDatabaseId || '',
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with explicit database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Error Handling Definition
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const QUOTA_LIMIT_MESSAGE = 'Data gagal tersimpan atau tersinkron ke database karena akses data telah limit pada hari ini.';

export function isFirestoreQuotaError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as any)?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  const combined = `${code} ${msg}`.toLowerCase();
  return (
    combined.includes('resource-exhausted') ||
    combined.includes('quota exceeded') ||
    combined.includes('quota') ||
    combined.includes('429') ||
    combined.includes('limit pada hari ini')
  );
}

type QuotaErrorListener = (message: string, detail?: string) => void;
const quotaListeners = new Set<QuotaErrorListener>();
let lastQuotaNotifyTime = 0;

export function subscribeToQuotaLimitErrors(listener: QuotaErrorListener): () => void {
  quotaListeners.add(listener);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function notifyQuotaLimitExceeded(detail?: string): void {
  const now = Date.now();
  // Throttle duplicate notifications within 3 seconds
  if (now - lastQuotaNotifyTime < 3000) return;
  lastQuotaNotifyTime = now;
  console.warn('[FIRESTORE_QUOTA_LIMIT]', QUOTA_LIMIT_MESSAGE, detail || '');
  quotaListeners.forEach((listener) => {
    try {
      listener(QUOTA_LIMIT_MESSAGE, detail);
    } catch (e) {
      console.error('Error in quota listener:', e);
    }
  });
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (isFirestoreQuotaError(error)) {
    notifyQuotaLimitExceeded(rawMessage);
    throw new Error(QUOTA_LIMIT_MESSAGE);
  }

  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreConnectionCheckResult {
  online: boolean;
  quotaExceeded?: boolean;
  latencyMs: number;
  message: string;
}

// Check live connection status to Firestore
export async function checkFirestoreConnectionStatus(): Promise<FirestoreConnectionCheckResult> {
  const start = Date.now();
  try {
    // Ping Firestore with getDocFromServer
    await getDocFromServer(doc(db, 'connection_check', 'ping'));
    const latencyMs = Date.now() - start;
    return { online: true, latencyMs, message: `Terhubung ke server Firestore (${latencyMs}ms)` };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const msg = err?.message || String(err);
    if (isFirestoreQuotaError(err)) {
      notifyQuotaLimitExceeded(msg);
      return {
        online: false,
        quotaExceeded: true,
        latencyMs,
        message: QUOTA_LIMIT_MESSAGE,
      };
    }
    if (msg.includes('the client is offline') || msg.includes('unavailable')) {
      return { online: false, latencyMs, message: 'Koneksi client offline atau tidak dapat menjangkau server Firestore' };
    }
    // Document not found or rule check still confirms the server is reachable and active
    return { online: true, latencyMs, message: `Server Firestore aktif & merespon (${latencyMs}ms)` };
  }
}

// Validate Connection to Firestore on startup
export async function testConnection(): Promise<boolean> {
  const res = await checkFirestoreConnectionStatus();
  if (res.online) {
    console.log('Firestore connection verified successfully:', res.message);
  } else {
    console.warn('Firestore offline/quota warning:', res.message);
  }
  return res.online;
}

export interface Polling3SecondsResult {
  verified: boolean;
  totalDurationMs: number;
  totalPolls: number;
  readDocData?: any;
  error?: string;
}

/**
 * Mekanisme pengecekan (polling) 3 detik untuk memastikan data benar-benar terbaca
 * di koleksi 'members' sebelum mengirimkan notifikasi sukses ke admin.
 * Melakukan polling selama durasi 3 detik (3000ms).
 */
export async function pollVerifyMemberInMembersCollection3Seconds(
  memberId: string,
  expectedData?: Partial<Member>,
  onStatusUpdate?: (status: string) => void
): Promise<Polling3SecondsResult> {
  const memberDocRef = doc(db, MEMBERS_COLLECTION, memberId);
  const startTime = Date.now();
  const MIN_POLLING_DURATION_MS = 3000; // Minimal 3 detik polling
  const POLL_INTERVAL_MS = 750; // Interval per siklus pengecekan

  let pollCount = 0;
  let lastReadDoc: any = null;
  let readSuccessCount = 0;

  console.log(`[POLLING_3_DETIK] Memulai verifikasi keterbacaan data anggota '${memberId}' di koleksi 'members' selama minimal 3 detik...`);

  while (Date.now() - startTime < MIN_POLLING_DURATION_MS) {
    pollCount++;
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    onStatusUpdate?.(`[Polling 3 Detik: Siklus ${pollCount}] Membaca data dari koleksi 'members' di Firestore (${elapsedSec}d / 3.0d)...`);

    // Jika sudah terverifikasi dari server pada siklus sebelumnya, cukup tunggu sisa durasi 3 detik agar hemat kuota read
    if (readSuccessCount >= 1 && lastReadDoc) {
      console.log(`[POLLING_3_DETIK] Siklus ${pollCount}: Data '${memberId}' konsisten di koleksi 'members' (berjalan ${elapsedSec}s / 3.0s).`);
    } else {
      try {
        const pollStart = Date.now();
        const snap = await getDocFromServer(memberDocRef);
        const pollLatency = Date.now() - pollStart;

        if (snap.exists()) {
          const data = snap.data();
          lastReadDoc = data;

          // Validasi kelengkapan data di dalam koleksi 'members'
          const idMatches = data.id === memberId;
          const namaMatches = !expectedData?.nama || data.nama === expectedData.nama;
          const nikMatches = !expectedData?.nik || data.nik === expectedData.nik;

          if (idMatches && namaMatches && nikMatches) {
            readSuccessCount++;
            console.log(`[POLLING_3_DETIK] Siklus ${pollCount}: Data '${memberId}' BERHASIL TERBACA di server Firestore (${pollLatency}ms, berjalan ${elapsedSec}s). Valid: OK.`);
          } else {
            console.warn(`[POLLING_3_DETIK] Siklus ${pollCount}: Dokumen ada tetapi data belum sinkron sepenuhnya.`);
          }
        } else {
          console.warn(`[POLLING_3_DETIK] Siklus ${pollCount}: Dokumen '${memberId}' belum ditemukan di koleksi 'members'.`);
        }
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaLimitExceeded(err?.message || String(err));
          return {
            verified: false,
            totalDurationMs: Date.now() - startTime,
            totalPolls: pollCount,
            error: QUOTA_LIMIT_MESSAGE,
          };
        }
        console.warn(`[POLLING_3_DETIK] Siklus ${pollCount} error pembacaan getDocFromServer:`, err?.message || err);
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_POLLING_DURATION_MS) {
      const sleepTime = Math.min(POLL_INTERVAL_MS, Math.max(150, MIN_POLLING_DURATION_MS - elapsed));
      await new Promise(res => setTimeout(res, sleepTime));
    }
  }

  const finalDurationMs = Date.now() - startTime;

  if (readSuccessCount > 0 && lastReadDoc) {
    console.log(`[POLLING_3_DETIK] SUKSES: Data anggota '${memberId}' dipastikan 100% terbaca di koleksi 'members' setelah polling ${finalDurationMs}ms (${pollCount} siklus).`);
    return {
      verified: true,
      totalDurationMs: finalDurationMs,
      totalPolls: pollCount,
      readDocData: lastReadDoc,
    };
  }

  const failMsg = `Data anggota '${memberId}' tidak dapat terbaca di koleksi 'members' Firestore setelah polling ${finalDurationMs}ms (${pollCount} siklus).`;
  console.error(`[POLLING_3_DETIK] GAGAL: ${failMsg}`);
  return {
    verified: false,
    totalDurationMs: finalDurationMs,
    totalPolls: pollCount,
    error: failMsg,
  };
}

// Collection paths
const MEMBERS_COLLECTION = 'members';
const NOTIFICATIONS_COLLECTION = 'notifications';
const SEEDED_FLAG_KEY = 'yayasan_alikhlas_firestore_seeded_v1';

// Clean object to avoid undefined fields in Firestore
function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// Seed initial members if database is empty
export async function seedInitialDataIfEmpty(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem(SEEDED_FLAG_KEY) === 'true') {
      return;
    }
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    if (snap.empty) {
      console.log('Seeding initial members to Firestore...');
      for (const m of INITIAL_MEMBERS) {
        await setDoc(doc(db, MEMBERS_COLLECTION, m.id), cleanForFirestore(m));
      }
      console.log('Seeding initial members completed.');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEEDED_FLAG_KEY, 'true');
    }
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Initial seeding note:', error);
  }
}

// Fetch all members from Firestore
export async function fetchMembersFromFirestore(): Promise<Member[]> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    if (snap.empty) {
      await seedInitialDataIfEmpty();
      return INITIAL_MEMBERS;
    }
    const list: Member[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Member);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MEMBERS_COLLECTION);
  }
}

// Save or Update a member in Firestore
export async function saveMemberToFirestore(member: Member): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${member.id}`;
  try {
    await setDoc(doc(db, MEMBERS_COLLECTION, member.id), cleanForFirestore(member), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface WriteConfirmationResult {
  success: boolean;
  totalAttempts: number;
  totalDurationMs: number;
  verifiedOnServer: boolean;
  documentId: string;
  traceId?: string;
}

/**
 * Verifies that a member document actually exists on the Firestore server by polling getDocFromServer.
 * Uses aggressive polling with configurable retry attempts, adaptive interval, and strict content checking.
 */
export async function verifyMemberExistsInFirestore(
  memberId: string,
  maxAttempts: number = 8,
  intervalMs: number = 400,
  onAttempt?: (attempt: number, maxAttempts: number) => void,
  expectedData?: Partial<Member>
): Promise<boolean> {
  const memberDocRef = doc(db, MEMBERS_COLLECTION, memberId);
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onAttempt?.(attempt, maxAttempts);
    try {
      // Force fetching from server to bypass any local offline cache
      const snap = await getDocFromServer(memberDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.id === memberId) {
          // If expectedData is provided, ensure critical fields match (strict content consistency)
          if (expectedData) {
            const namaMatches = !expectedData.nama || data.nama === expectedData.nama;
            const nikMatches = !expectedData.nik || data.nik === expectedData.nik;
            const statusMatches = !expectedData.status || data.status === expectedData.status;

            if (namaMatches && nikMatches && statusMatches) {
              console.log(`[FirestoreTrace:Verify] SUCCESS verified on server for member ${memberId} ("${data.nama}") on attempt ${attempt}/${maxAttempts} in ${Date.now() - startTime}ms`);
              return true;
            } else {
              console.warn(`[FirestoreTrace:Verify] Document ${memberId} exists on server but fields are syncing (attempt ${attempt}/${maxAttempts})...`);
            }
          } else {
            console.log(`[FirestoreTrace:Verify] SUCCESS confirmed doc exists on server for member ${memberId} on attempt ${attempt}/${maxAttempts} in ${Date.now() - startTime}ms`);
            return true;
          }
        }
      }
    } catch (err: any) {
      if (isFirestoreQuotaError(err)) {
        notifyQuotaLimitExceeded(err?.message || String(err));
        throw new Error(QUOTA_LIMIT_MESSAGE);
      }
      console.warn(`[FirestoreTrace:Verify] Server poll attempt ${attempt}/${maxAttempts} for member ${memberId} error:`, err?.message || err);
    }

    if (attempt < maxAttempts) {
      // Adaptive backoff on polling: 350ms, 400ms, 450ms...
      const currentInterval = intervalMs + (attempt * 40);
      await new Promise(res => setTimeout(res, currentInterval));
    }
  }

  console.error(`[FirestoreTrace:Verify] FAILED to verify member ${memberId} on server after ${maxAttempts} polling attempts (${Date.now() - startTime}ms).`);
  return false;
}

/**
 * Saves a member to Firestore with aggressive retry logic, exponential backoff with jitter, and server-side verification polling.
 * Guarantees the document is 100% confirmed on the server before resolving.
 */
export async function saveMemberWithRetryAndConfirmation(
  member: Member,
  maxRetries: number = 5,
  onStatusUpdate?: (statusText: string) => void,
  traceId?: string
): Promise<WriteConfirmationResult> {
  const path = `${MEMBERS_COLLECTION}/${member.id}`;
  const memberDocRef = doc(db, MEMBERS_COLLECTION, member.id);
  const cleanData = cleanForFirestore(member);
  const startTime = Date.now();
  const tid = traceId || 'TX-' + Date.now().toString(36).toUpperCase();

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();

    // Aggressive exponential backoff with jitter on retries (attempt > 1)
    if (attempt > 1) {
      const baseDelay = 600;
      const exponentialMultiplier = Math.pow(1.5, attempt - 2);
      const jitter = Math.floor(Math.random() * 250);
      const backoffMs = Math.round(baseDelay * exponentialMultiplier + jitter);

      onStatusUpdate?.(`[Penundaan ${backoffMs}ms] Menunggu jeda jaringan sebelum mencoba kembali (Percobaan ${attempt}/${maxRetries})...`);
      console.log(`[FirestoreTrace:${tid}] Backoff pause ${backoffMs}ms before attempt ${attempt}/${maxRetries}...`);
      await new Promise(res => setTimeout(res, backoffMs));
    }

    try {
      onStatusUpdate?.(`[Percobaan ${attempt}/${maxRetries}] Mengirim data anggota ke server database Firestore...`);
      console.log(`[FirestoreTrace:${tid}] [Percobaan ${attempt}/${maxRetries}] Writing member ${member.id} ("${member.nama}") to Firestore...`);
      
      await setDoc(memberDocRef, cleanData, { merge: true });

      // After write, aggressively poll getDocFromServer to strictly confirm data is present on server
      onStatusUpdate?.(`[Percobaan ${attempt}/${maxRetries}] Memverifikasi keberadaan data di server Firestore (polling)...`);
      const isConfirmed = await verifyMemberExistsInFirestore(
        member.id,
        4,
        350,
        (curr, max) => onStatusUpdate?.(`[Percobaan ${attempt}/${maxRetries}] Mengonfirmasi data di server Firestore (Cek ${curr}/${max})...`),
        { nama: member.nama, nik: member.nik, status: member.status }
      );

      if (isConfirmed) {
        const totalDurationMs = Date.now() - startTime;
        onStatusUpdate?.('Data anggota terverifikasi konsisten di server Firestore (100% tersimpan)!');
        console.log(`[FirestoreTrace:${tid}] Member ${member.id} write & server confirmation complete in ${totalDurationMs}ms (attempt ${attempt})!`);
        return {
          success: true,
          totalAttempts: attempt,
          totalDurationMs,
          verifiedOnServer: true,
          documentId: member.id,
          traceId: tid,
        };
      }

      console.warn(`[FirestoreTrace:${tid}] Attempt ${attempt} write finished but server polling could not confirm document within time window.`);
    } catch (error: any) {
      lastError = error;
      const attemptDuration = Date.now() - attemptStartTime;
      console.warn(`[FirestoreTrace:${tid}] Firestore write attempt ${attempt}/${maxRetries} failed (${attemptDuration}ms):`, error?.message || error);

      // Immediately abort retries if Firebase quota limit is exceeded
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error?.message || String(error));
        throw new Error(QUOTA_LIMIT_MESSAGE);
      }
    }
  }

  // If write or verification failed after all retries, throw detailed Firestore error
  handleFirestoreError(
    lastError || new Error(`Data anggota "${member.nama}" (ID: ${member.id}, Trace: ${tid}) belum dapat dikonfirmasi di server Firestore setelah ${maxRetries} kali percobaan write & polling.`),
    OperationType.WRITE,
    path
  );
}

// Delete a member from Firestore
export async function deleteMemberFromFirestore(id: string): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, MEMBERS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Real-time listener for Members
export function subscribeMembersFirestore(
  onUpdate: (members: Member[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = MEMBERS_COLLECTION;
  const colRef = collection(db, path);
  
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const list: Member[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Member);
      });
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        console.warn('Firestore listener error:', e);
      }
    }
  );
}

// Real-time listener for Notifications
export function subscribeNotificationsFirestore(
  onUpdate: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = NOTIFICATIONS_COLLECTION;
  const q = query(collection(db, path), orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as AppNotification);
      });
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      // Fallback query without orderBy in case index is pending
      const fallbackCol = collection(db, path);
      return onSnapshot(
        fallbackCol,
        (snap) => {
          const list: AppNotification[] = [];
          snap.forEach(docSnap => list.push(docSnap.data() as AppNotification));
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onUpdate(list);
        },
        (err2) => {
          if (isFirestoreQuotaError(err2)) {
            notifyQuotaLimitExceeded(err2.message);
            onError?.(new Error(QUOTA_LIMIT_MESSAGE));
            return;
          }
          onError?.(err2);
          try {
            handleFirestoreError(err2, OperationType.LIST, path);
          } catch (e) {
            console.warn('Firestore notifications listener error:', e);
          }
        }
      );
    }
  );
}

// Add a Notification to Firestore
export async function addNotificationToFirestore(notif: AppNotification): Promise<void> {
  const path = `${NOTIFICATIONS_COLLECTION}/${notif.id}`;
  try {
    await setDoc(doc(db, NOTIFICATIONS_COLLECTION, notif.id), cleanForFirestore(notif));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Mark Notification as read in Firestore
export async function markNotificationAsReadInFirestore(id: string): Promise<void> {
  const path = `${NOTIFICATIONS_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Mark all Notifications as read in Firestore
export async function markAllNotificationsAsReadInFirestore(notifications: AppNotification[]): Promise<void> {
  for (const n of notifications) {
    if (!n.read) {
      try {
        await setDoc(doc(db, NOTIFICATIONS_COLLECTION, n.id), { read: true }, { merge: true });
      } catch (err) {
        console.warn('Error marking notification as read:', err);
      }
    }
  }
}
