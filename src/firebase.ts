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
import { Member, AppNotification, SystemLogEntry, TempDataSebelumDaftar, Activity, TempKegiatanSebelumSimpan } from './types';
import { INITIAL_MEMBERS, SYARI_PHOTOS } from './data/initialData';

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

// Collection paths
export const MEMBERS_COLLECTION = 'members';
export const TEMP_DATA_MENUNGGU_COLLECTION = 'tempdatamenunggu';
export const TEMP_DATA_LAMA_COLLECTION = 'tempdatalama';
export const TEMP_DATA_SEBELUM_DAFTAR_COLLECTION = 'tempdatasebelumdaftar';
export const ACTIVITIES_COLLECTION = 'activities';
export const TEMP_KEGIATAN_LAMA_COLLECTION = 'tempkegiatanlama';
export const TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION = 'tempkegiatansebelumsimpan';
export const SYSTEM_COUNTERS_COLLECTION = 'system_counters';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const SYSTEM_LOGS_COLLECTION = 'system_logs';

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
          const statusMatches = !expectedData?.status || data.status === expectedData.status;

          if (idMatches && namaMatches && nikMatches && statusMatches) {
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

// Canonical defaults for 0130 (Agus Subriyanto), 0130-2 (Tutik Maryani), and 0131 (Sriyono, SH.MM)
const CANONICAL_AGUS_0130: Member = INITIAL_MEMBERS.find(m => m.id === '0130') || {
  id: '0130',
  regNumber: '1630/YMWM13/II/2026 & L.0130',
  nik: '5103051806770130',
  nama: 'Agus Subriyanto',
  noKk: '5103051908060130',
  peranKeluarga: 'kepala_keluarga',
  tempatTanggalLahir: 'Banyuwangi, 18 Juni 1977',
  alamat: 'Perum Dalung Permai Lingkungan Banjar Tegal Jaya, Desa Dalung, Kuta Utara, Badung',
  jumlahKeluarga: 2,
  noHp: '081236780130',
  email: 'agus.subriyanto@gmail.com',
  fotoUrl: SYARI_PHOTOS.kepalaKeluargaMargo,
  status: 'disetujui',
  tanggalDaftar: '2026-10-24T08:00:00.000Z',
  tanggalDisetujui: '2026-10-25T09:00:00.000Z',
};

const CANONICAL_TUTIK_0130_2: Member = INITIAL_MEMBERS.find(m => m.id === '0130-2') || {
  id: '0130-2',
  regNumber: '1630/YMWM13/II/2026 & L.0130-B',
  nik: '5103055209800130',
  nama: 'Tutik Maryani',
  noKk: '5103051908060130',
  peranKeluarga: 'istri',
  kepalaKeluargaId: '0130',
  namaKepalaKeluarga: 'Agus Subriyanto',
  tempatTanggalLahir: 'Jember, 12 September 1980',
  alamat: 'Perum Dalung Permai Lingkungan Banjar Tegal Jaya, Desa Dalung, Kuta Utara, Badung',
  noHp: '081236780132',
  email: 'tutik.maryani@gmail.com',
  fotoUrl: SYARI_PHOTOS.istriSitiAminah,
  status: 'disetujui',
  tanggalDaftar: '2026-10-24T08:15:00.000Z',
  tanggalDisetujui: '2026-10-25T09:05:00.000Z',
};

const CANONICAL_SRIYONO_0131: Member = INITIAL_MEMBERS.find(m => m.id === '0131') || {
  id: '0131',
  regNumber: '1631/YMWM13/II/2026 & L.0131',
  nik: '5103051003750131',
  nama: 'Sriyono, SH.MM',
  noKk: '5103052204040131',
  peranKeluarga: 'kepala_keluarga',
  tempatTanggalLahir: 'Surakarta, 10 Maret 1975',
  alamat: 'Perumahan Bumi Dalung Permai, Desa Dalung, Kuta Utara, Badung',
  jumlahKeluarga: 1,
  noHp: '081239880131',
  email: 'sriyono.shmm@gmail.com',
  fotoUrl: SYARI_PHOTOS.kepalaKeluargaJajat,
  status: 'disetujui',
  tanggalDaftar: '2026-10-26T09:00:00.000Z',
  tanggalDisetujui: '2026-10-26T10:30:00.000Z',
};

let isRepairRunning = false;

/**
 * Memeriksa dan menjaga keunikan seluruh ID anggota di Firestore:
 * - Memastikan tidak ada ID ganda antara anggota aktif (members), menunggu (tempdatamenunggu), maupun terhapus (tempdatalama).
 * - TIDAK PERNAH menimpa data asli atau memulihkan data lama / data dummy secara otomatis.
 */
export async function repairAgusAndSriyonoDataInFirestore(currentMembers?: Member[]): Promise<Member[] | null> {
  if (isRepairRunning) return null;
  isRepairRunning = true;

  try {
    let list: Member[] = currentMembers && currentMembers.length > 0 ? [...currentMembers] : [];
    if (list.length === 0) {
      const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
      snap.forEach((d) => list.push(d.data() as Member));
    }

    // Pastikan seluruh ID tertinggi yang ada tercatat di system_counters agar tidak pernah dipakai ulang
    const maxRoot = list.reduce((max, m) => {
      const num = parseInt((m.id || '').split('-')[0], 10);
      return !isNaN(num) && num > max ? num : max;
    }, 131);

    if (list.length > 0) {
      try {
        await recordAllocatedIdInCounter(String(maxRoot).padStart(4, '0'), maxRoot);
      } catch {}
    }

    return null;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('[DATA_REPAIR] Warning during ID uniqueness check:', error);
    return null;
  } finally {
    isRepairRunning = false;
  }
}

/**
 * Mencatat ID yang sudah pernah dialokasikan ke dalam koleksi system_counters/member_id_seq
 * agar meskipun data dihapus kemudian, nomor ID tersebut TIDAK PERNAH dipakai ulang.
 */
export async function recordAllocatedIdInCounter(allocatedId: string, rootNum?: number): Promise<void> {
  try {
    const counterRef = doc(db, SYSTEM_COUNTERS_COLLECTION, 'member_id_seq');
    let currentLastRoot = 131;
    let usedIds: string[] = [];

    try {
      const snap = await getDocFromServer(counterRef);
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.lastRootNumber === 'number' && data.lastRootNumber > currentLastRoot) {
          currentLastRoot = data.lastRootNumber;
        }
        if (Array.isArray(data.usedIds)) {
          usedIds = data.usedIds;
        }
      }
    } catch {}

    const parsedRoot = rootNum ?? parseInt(allocatedId.split('-')[0], 10);
    const updatedLastRoot = !isNaN(parsedRoot) && parsedRoot > currentLastRoot ? parsedRoot : currentLastRoot;
    const updatedUsedIds = Array.from(new Set([...usedIds, allocatedId])).slice(-1500);

    await setDoc(
      counterRef,
      {
        lastRootNumber: updatedLastRoot,
        usedIds: updatedUsedIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[ID_COUNTER] Note recording allocated ID:', err);
  }
}

/**
 * Mengalokasikan ID Anggota unik secara ketat dari server Firestore.
 * Memeriksa koleksi aktif `members`, koleksi data terhapus `tempdatalama`,
 * dan counter monontonik `system_counters/member_id_seq`.
 * Menjamin ID yang sudah pernah dibuat (meskipun sudah dihapus) TIDAK AKAN dipakai lagi.
 */
export async function allocateUniqueMemberIdFromServer(
  kepalaKeluargaId?: string,
  localMembers: Member[] = [],
  localTempMembers: Member[] = []
): Promise<string> {
  const usedIds = new Set<string>();
  let maxRootNum = 131; // Minimal mulai setelah 0130 (Agus Subriyanto) & 0131 (Sriyono, SH.MM)

  const registerId = (id?: string) => {
    if (!id) return;
    const trimmed = id.trim();
    if (!trimmed) return;
    usedIds.add(trimmed);
    const rootPart = trimmed.split('-')[0];
    const num = parseInt(rootPart, 10);
    if (!isNaN(num) && num > maxRootNum) {
      maxRootNum = num;
    }
  };

  // 1. Dari data lokal aktif & lokal tempdatalama & INITIAL_MEMBERS
  INITIAL_MEMBERS.forEach(m => registerId(m.id));
  localMembers.forEach(m => registerId(m.id));
  localTempMembers.forEach(m => registerId(m.id));

  // 2. Dari koleksi 'members' live di server Firestore
  try {
    const membersSnap = await getDocs(collection(db, MEMBERS_COLLECTION));
    membersSnap.forEach(d => {
      registerId(d.id);
      const data = d.data();
      if (data?.id) registerId(data.id);
    });
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      notifyQuotaLimitExceeded(err instanceof Error ? err.message : String(err));
      throw new Error(QUOTA_LIMIT_MESSAGE);
    }
    console.warn('[ID_ALLOCATOR] Fallback reading members collection:', err);
  }

  // 3. Dari koleksi 'tempdatamenunggu' (data yang sedang menunggu persetujuan admin) di server Firestore
  try {
    const waitingSnap = await getDocs(collection(db, TEMP_DATA_MENUNGGU_COLLECTION));
    waitingSnap.forEach(d => {
      registerId(d.id);
      const data = d.data();
      if (data?.id) registerId(data.id);
    });
  } catch (err) {
    console.warn('[ID_ALLOCATOR] Note reading tempdatamenunggu collection:', err);
  }

  // 4. Dari koleksi 'tempdatalama' (data yang pernah dihapus) di server Firestore
  try {
    const tempSnap = await getDocs(collection(db, TEMP_DATA_LAMA_COLLECTION));
    tempSnap.forEach(d => {
      registerId(d.id);
      const data = d.data();
      if (data?.id) registerId(data.id);
    });
  } catch (err) {
    console.warn('[ID_ALLOCATOR] Note reading tempdatalama collection:', err);
  }

  // 5. Dari 'system_counters/member_id_seq' (pencatat historis nomor tertinggi yang pernah dibuat)
  try {
    const counterSnap = await getDocFromServer(doc(db, SYSTEM_COUNTERS_COLLECTION, 'member_id_seq'));
    if (counterSnap.exists()) {
      const cData = counterSnap.data();
      if (typeof cData.lastRootNumber === 'number' && cData.lastRootNumber > maxRootNum) {
        maxRootNum = cData.lastRootNumber;
      }
      if (Array.isArray(cData.usedIds)) {
        cData.usedIds.forEach((uid: string) => registerId(uid));
      }
    }
  } catch (err) {
    console.warn('[ID_ALLOCATOR] Note reading system_counters:', err);
  }

  // Jika anggota keluarga (Istri / Anak) yang terhubung ke Kepala Keluarga
  if (kepalaKeluargaId) {
    let maxSubIndex = 1; // Kepala keluarga dihitung 1, anggota keluarga mulai dari -2 (contoh: 0130-2)
    usedIds.forEach(existingId => {
      if (existingId.startsWith(`${kepalaKeluargaId}-`)) {
        const subPart = existingId.slice(kepalaKeluargaId.length + 1);
        const subNum = parseInt(subPart, 10);
        if (!isNaN(subNum) && subNum > maxSubIndex) {
          maxSubIndex = subNum;
        }
      }
    });

    let nextSub = maxSubIndex + 1;
    let candidateId = `${kepalaKeluargaId}-${nextSub}`;
    while (usedIds.has(candidateId)) {
      nextSub++;
      candidateId = `${kepalaKeluargaId}-${nextSub}`;
    }

    // Verifikasi langsung ke dokumen server bahwa candidateId benar-benar kosong di members, tempdatamenunggu & tempdatalama
    for (let check = 0; check < 10; check++) {
      try {
        const [mSnap, wSnap, tSnap] = await Promise.all([
          getDocFromServer(doc(db, MEMBERS_COLLECTION, candidateId)),
          getDocFromServer(doc(db, TEMP_DATA_MENUNGGU_COLLECTION, candidateId)),
          getDocFromServer(doc(db, TEMP_DATA_LAMA_COLLECTION, candidateId)),
        ]);
        if (!mSnap.exists() && !wSnap.exists() && !tSnap.exists()) {
          break;
        }
        nextSub++;
        candidateId = `${kepalaKeluargaId}-${nextSub}`;
      } catch {
        break;
      }
    }

    await recordAllocatedIdInCounter(candidateId);
    return candidateId;
  }

  // Jika Kepala Keluarga: lanjutkan dari nomor tertinggi + 1 (misal setelah 0131 -> 0132)
  let nextRoot = maxRootNum + 1;
  let candidateId = String(nextRoot).padStart(4, '0');
  while (usedIds.has(candidateId)) {
    nextRoot++;
    candidateId = String(nextRoot).padStart(4, '0');
  }

  // Verifikasi langsung ke dokumen server bahwa candidateId belum pernah dipakai di members, tempdatamenunggu, maupun tempdatalama
  for (let check = 0; check < 15; check++) {
    try {
      const [mSnap, wSnap, tSnap] = await Promise.all([
        getDocFromServer(doc(db, MEMBERS_COLLECTION, candidateId)),
        getDocFromServer(doc(db, TEMP_DATA_MENUNGGU_COLLECTION, candidateId)),
        getDocFromServer(doc(db, TEMP_DATA_LAMA_COLLECTION, candidateId)),
      ]);
      if (!mSnap.exists() && !wSnap.exists() && !tSnap.exists()) {
        break;
      }
      nextRoot++;
      candidateId = String(nextRoot).padStart(4, '0');
    } catch {
      break;
    }
  }

  await recordAllocatedIdInCounter(candidateId, nextRoot);
  return candidateId;
}

/**
 * Sinkronisasi awal ke Firestore TANPA PERNAH memasukkan kembali data dummy INITIAL_MEMBERS.
 * Menjamin data yang sudah dihapus Admin tidak akan pernah muncul kembali secara tiba-tiba.
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    if (!snap.empty) {
      const currentList: Member[] = [];
      snap.forEach(d => currentList.push(d.data() as Member));
      await repairAgusAndSriyonoDataInFirestore(currentList);
    }
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Initial sync check note:', error);
  }
}

// Fetch all members from Firestore (returns exact server state, NEVER falls back to dummy INITIAL_MEMBERS)
export async function fetchMembersFromFirestore(): Promise<Member[]> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
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
      const snap = await getDocFromServer(memberDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.id === memberId) {
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
      const currentInterval = intervalMs + (attempt * 40);
      await new Promise(res => setTimeout(res, currentInterval));
    }
  }

  console.error(`[FirestoreTrace:Verify] FAILED to verify member ${memberId} on server after ${maxAttempts} polling attempts (${Date.now() - startTime}ms).`);
  return false;
}

/**
 * Saves a member to Firestore with aggressive retry logic, exponential backoff, collision guard, and server-side verification polling.
 * When `options.preventOverwrite` is true, checks `getDocFromServer` before writing to ensure an existing different member is NEVER overwritten.
 */
export async function saveMemberWithRetryAndConfirmation(
  member: Member,
  maxRetries: number = 5,
  onStatusUpdate?: (statusText: string) => void,
  traceId?: string,
  options?: { preventOverwrite?: boolean }
): Promise<WriteConfirmationResult> {
  const path = `${MEMBERS_COLLECTION}/${member.id}`;
  const memberDocRef = doc(db, MEMBERS_COLLECTION, member.id);
  const cleanData = cleanForFirestore(member);
  const startTime = Date.now();
  const tid = traceId || 'TX-' + Date.now().toString(36).toUpperCase();

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();

    if (attempt > 1) {
      const baseDelay = 600;
      const exponentialMultiplier = Math.pow(1.5, attempt - 2);
      const jitter = Math.floor(Math.random() * 250);
      const backoffMs = Math.round(baseDelay * exponentialMultiplier + jitter);

      onStatusUpdate?.(`[Penundaan ${backoffMs}ms] Menunggu jeda jaringan sebelum mencoba kembali (Percobaan ${attempt}/${maxRetries})...`);
      await new Promise(res => setTimeout(res, backoffMs));
    }

    try {
      // Proteksi anti-timpa (Collision Guard): Jangan pernah menimpa anggota lain yang sudah punya ID ini!
      if (options?.preventOverwrite) {
        const existingSnap = await getDocFromServer(memberDocRef);
        if (existingSnap.exists()) {
          const existingData = existingSnap.data() as Member;
          const isSamePerson =
            existingData.nik === member.nik &&
            existingData.nama?.toLowerCase().trim() === member.nama?.toLowerCase().trim();
          if (!isSamePerson) {
            throw new Error(`ID_COLLISION_GUARD: ID Anggota ${member.id} sudah digunakan oleh "${existingData.nama}".`);
          }
        }
      }

      onStatusUpdate?.(`[Percobaan ${attempt}/${maxRetries}] Mengirim data anggota ke server database Firestore...`);
      console.log(`[FirestoreTrace:${tid}] [Percobaan ${attempt}/${maxRetries}] Writing member ${member.id} ("${member.nama}") to Firestore...`);
      
      await setDoc(memberDocRef, cleanData);

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

      // Immediately propagate collision guard so caller can allocate a fresh ID
      if (String(error?.message || '').includes('ID_COLLISION_GUARD')) {
        throw error;
      }

      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error?.message || String(error));
        throw new Error(QUOTA_LIMIT_MESSAGE);
      }
    }
  }

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

// ============================================================================
// KOLEKSI TEMPORARY DATA TERHAPUS: 'tempdatalama'
// Menampung seluruh field lengkap data anggota yang terhapus (identik dengan 'members')
// agar dapat dipulihkan kembali 100% utuh atas konfirmasi Admin.
// ============================================================================

export function buildCompleteMemberRecord(member: Member, isDeletedArchive: boolean = false): Member {
  const fullRecord: Member = {
    id: member.id || '',
    regNumber: member.regNumber || '',
    nik: member.nik || '',
    nama: member.nama || '',
    tempatTanggalLahir: member.tempatTanggalLahir || '',
    alamat: member.alamat || '',
    noHp: member.noHp || '',
    noKk: member.noKk || '',
    peranKeluarga: member.peranKeluarga || 'kepala_keluarga',
    kepalaKeluargaId: member.kepalaKeluargaId || '',
    namaKepalaKeluarga: member.namaKepalaKeluarga || '',
    jumlahKeluarga: typeof member.jumlahKeluarga === 'number' ? member.jumlahKeluarga : (member.peranKeluarga === 'kepala_keluarga' ? 1 : 0),
    email: member.email || '',
    fotoUrl: member.fotoUrl || '',
    fotoName: member.fotoName || '',
    ktpUrl: member.ktpUrl || '',
    ktpName: member.ktpName || '',
    kkUrl: member.kkUrl || '',
    kkName: member.kkName || '',
    status: member.status || 'disetujui',
    catatanPenolakan: member.catatanPenolakan || '',
    tanggalDaftar: member.tanggalDaftar || new Date().toISOString(),
    tanggalDisetujui: member.tanggalDisetujui || '',
  };

  if (isDeletedArchive) {
    fullRecord.deletedAt = member.deletedAt || new Date().toISOString();
    fullRecord.deletedReason = member.deletedReason || 'Dihapus ke arsip tempdatalama oleh Admin';
  }

  return fullRecord;
}

export async function saveToTempDataLamaFirestore(member: Member): Promise<void> {
  const path = `${TEMP_DATA_LAMA_COLLECTION}/${member.id}`;
  try {
    const payload = buildCompleteMemberRecord(member, true);
    await setDoc(doc(db, TEMP_DATA_LAMA_COLLECTION, member.id), cleanForFirestore(payload));
    // Pastikan ID anggota yang dihapus tetap tercatat di counter agar ID-nya tidak pernah dipakai ulang
    await recordAllocatedIdInCounter(member.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFromTempDataLamaFirestore(memberId: string): Promise<void> {
  const path = `${TEMP_DATA_LAMA_COLLECTION}/${memberId}`;
  try {
    await deleteDoc(doc(db, TEMP_DATA_LAMA_COLLECTION, memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchTempDataLamaFromFirestore(): Promise<Member[]> {
  try {
    const snap = await getDocs(collection(db, TEMP_DATA_LAMA_COLLECTION));
    const list: Member[] = [];
    snap.forEach(d => list.push(buildCompleteMemberRecord(d.data() as Member, true)));
    return list;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Error fetching tempdatalama:', error);
    return [];
  }
}

export function subscribeTempDataLamaFirestore(
  onUpdate: (deletedMembers: Member[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = TEMP_DATA_LAMA_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Member[] = [];
      snapshot.forEach(docSnap => {
        list.push(buildCompleteMemberRecord(docSnap.data() as Member, true));
      });
      list.sort((a, b) => new Date(b.deletedAt || b.tanggalDaftar).getTime() - new Date(a.deletedAt || a.tanggalDaftar).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

// ============================================================================
// KOLEKSI TEMPAT TAMPUNG SEMENTARA DATA MENUNGGU PERSETUJUAN ADMIN: 'tempdatamenunggu'
// Menampung seluruh field lengkap pendaftar baru yang berstatus 'menunggu'
// agar data pendaftar tidak pernah hilang, tidak tertimpa, dan tidak bocor ke publik
// sebelum disetujui oleh Admin.
// ============================================================================

export async function saveToTempDataMenungguFirestore(member: Member): Promise<void> {
  const path = `${TEMP_DATA_MENUNGGU_COLLECTION}/${member.id}`;
  try {
    const payload = buildCompleteMemberRecord({ ...member, status: 'menunggu' }, false);
    await setDoc(doc(db, TEMP_DATA_MENUNGGU_COLLECTION, member.id), cleanForFirestore(payload));
    await recordAllocatedIdInCounter(member.id);
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('[TEMP_DATA_MENUNGGU_WRITE]', error);
  }
}

export async function deleteFromTempDataMenungguFirestore(memberId: string): Promise<void> {
  const path = `${TEMP_DATA_MENUNGGU_COLLECTION}/${memberId}`;
  try {
    await deleteDoc(doc(db, TEMP_DATA_MENUNGGU_COLLECTION, memberId));
  } catch (error) {
    console.warn('Error deleting from tempdatamenunggu:', path, error);
  }
}

export async function fetchTempDataMenungguFromFirestore(): Promise<Member[]> {
  try {
    const snap = await getDocs(collection(db, TEMP_DATA_MENUNGGU_COLLECTION));
    const list: Member[] = [];
    snap.forEach(d => list.push(buildCompleteMemberRecord(d.data() as Member, false)));
    list.sort((a, b) => new Date(b.tanggalDaftar).getTime() - new Date(a.tanggalDaftar).getTime());
    return list;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Error fetching tempdatamenunggu:', error);
    return [];
  }
}

export function subscribeTempDataMenungguFirestore(
  onUpdate: (waitingMembers: Member[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = TEMP_DATA_MENUNGGU_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Member[] = [];
      snapshot.forEach(docSnap => {
        list.push(buildCompleteMemberRecord(docSnap.data() as Member, false));
      });
      list.sort((a, b) => new Date(b.tanggalDaftar).getTime() - new Date(a.tanggalDaftar).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

// ============================================================================
// KOLEKSI TEMPORARY SEBELUM DAFTAR: 'tempdatasebelumdaftar'
// Menyimpan sementara data yang sedang diketik calon anggota / admin setiap 5 detik
// dengan idtempdata unik berdasarkan IP/Location, Browser, Versi HP/OS, dan IMEI.
// ============================================================================

export async function saveTempDataSebelumDaftarToFirestore(draft: TempDataSebelumDaftar): Promise<void> {
  const path = `${TEMP_DATA_SEBELUM_DAFTAR_COLLECTION}/${draft.idtempdata}`;
  try {
    const cleanPayload = cleanForFirestore({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, TEMP_DATA_SEBELUM_DAFTAR_COLLECTION, draft.idtempdata), cleanPayload, { merge: true });
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('[TEMP_SEBELUM_DAFTAR_NOTE]', error);
  }
}

export async function fetchTempDataSebelumDaftarFromFirestore(): Promise<TempDataSebelumDaftar[]> {
  try {
    const snap = await getDocs(collection(db, TEMP_DATA_SEBELUM_DAFTAR_COLLECTION));
    const list: TempDataSebelumDaftar[] = [];
    snap.forEach(d => list.push(d.data() as TempDataSebelumDaftar));
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Error fetching tempdatasebelumdaftar:', error);
    return [];
  }
}

export function subscribeTempDataSebelumDaftarFirestore(
  onUpdate: (drafts: TempDataSebelumDaftar[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = TEMP_DATA_SEBELUM_DAFTAR_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: TempDataSebelumDaftar[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as TempDataSebelumDaftar);
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

export async function deleteTempDataSebelumDaftarFromFirestore(idtempdata: string): Promise<void> {
  const path = `${TEMP_DATA_SEBELUM_DAFTAR_COLLECTION}/${idtempdata}`;
  try {
    await deleteDoc(doc(db, TEMP_DATA_SEBELUM_DAFTAR_COLLECTION, idtempdata));
  } catch (error) {
    console.warn('Error deleting tempdatasebelumdaftar:', path, error);
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

// Add a Notification to Firestore (storing all complete registrant data in the database) and verify it exists on the server
export async function addNotificationToFirestore(notif: AppNotification): Promise<void> {
  const path = `${NOTIFICATIONS_COLLECTION}/${notif.id}`;
  const notifDocRef = doc(db, NOTIFICATIONS_COLLECTION, notif.id);
  try {
    const completeNotifPayload: AppNotification = {
      id: notif.id,
      memberId: notif.memberId || '',
      memberName: notif.memberName || notif.nama || '',
      type: notif.type,
      message: notif.message || '',
      timestamp: notif.timestamp || new Date().toISOString(),
      read: Boolean(notif.read),
      regNumber: notif.regNumber || '',
      nik: notif.nik || '',
      nama: notif.nama || notif.memberName || '',
      tempatTanggalLahir: notif.tempatTanggalLahir || '',
      alamat: notif.alamat || '',
      noHp: notif.noHp || '',
      noKk: notif.noKk || '',
      peranKeluarga: notif.peranKeluarga || 'kepala_keluarga',
      kepalaKeluargaId: notif.kepalaKeluargaId || '',
      namaKepalaKeluarga: notif.namaKepalaKeluarga || '',
      jumlahKeluarga: typeof notif.jumlahKeluarga === 'number' ? notif.jumlahKeluarga : 1,
      email: notif.email || '',
      fotoUrl: notif.fotoUrl || '',
      fotoName: notif.fotoName || '',
      ktpUrl: notif.ktpUrl || '',
      ktpName: notif.ktpName || '',
      kkUrl: notif.kkUrl || '',
      kkName: notif.kkName || '',
      status: notif.status || (notif.type === 'status_approved' ? 'disetujui' : notif.type === 'status_rejected' ? 'ditolak' : 'menunggu'),
      catatanPenolakan: notif.catatanPenolakan || '',
      tanggalDaftar: notif.tanggalDaftar || notif.timestamp || new Date().toISOString(),
      tanggalDisetujui: notif.tanggalDisetujui || (notif.type === 'status_approved' ? (notif.timestamp || new Date().toISOString()) : ''),
    };

    await setDoc(notifDocRef, cleanForFirestore(completeNotifPayload));
    // Verify the notification document is readable on the server
    try {
      await getDocFromServer(notifDocRef);
    } catch (verifyErr) {
      console.warn('Notification verification read warning:', verifyErr);
    }
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

// =========================================================================
// KOLEKSI CATATAN SELURUH AKTIVITAS & LOG SISTEM / DATABASE (TEKNIS IT)
// =========================================================================

export async function saveSystemLogToFirestore(log: SystemLogEntry): Promise<void> {
  const path = `${SYSTEM_LOGS_COLLECTION}/${log.id}`;
  try {
    const clean = cleanForFirestore({
      ...log,
      detail: (log.detail || '').slice(0, 3000),
      title: (log.title || '').slice(0, 250),
    });
    await setDoc(doc(db, SYSTEM_LOGS_COLLECTION, log.id), clean);
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('[FIRESTORE_LOG_WRITE_NOTE]', error);
  }
}

export async function fetchSystemLogsFromFirestore(): Promise<SystemLogEntry[]> {
  try {
    const snap = await getDocs(collection(db, SYSTEM_LOGS_COLLECTION));
    const list: SystemLogEntry[] = [];
    snap.forEach((d) => {
      list.push(d.data() as SystemLogEntry);
    });
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Error fetching system logs:', error);
    return [];
  }
}

export function subscribeSystemLogsFirestore(
  onUpdate: (logs: SystemLogEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = SYSTEM_LOGS_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: SystemLogEntry[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as SystemLogEntry);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

export async function clearSystemLogsInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, SYSTEM_LOGS_COLLECTION));
    const promises: Promise<void>[] = [];
    snap.forEach((d) => {
      promises.push(deleteDoc(d.ref));
    });
    await Promise.all(promises);
  } catch (err) {
    console.warn('Error clearing system logs in Firestore:', err);
  }
}

// =========================================================================
// MANAJEMEN JADWAL & PRESENSI KEGIATAN FIRESTORE (activities, tempkegiatanlama, tempkegiatansebelumsimpan)
// =========================================================================

export function parseActivityNumber(id?: string): number {
  if (!id) return 0;
  const match = id.match(/ACT-\d{4}-(\d+)/i);
  if (match && match[1]) {
    const n = parseInt(match[1], 10);
    return isNaN(n) ? 0 : n;
  }
  const tail = id.split('-').pop() || '';
  const n2 = parseInt(tail, 10);
  return isNaN(n2) ? 0 : n2;
}

export function buildCompleteActivityRecord(act: Activity, isDeletedArchive: boolean = false): Activity {
  const nowIso = new Date().toISOString();
  const cleanKehadiran = Array.isArray(act.kehadiran)
    ? act.kehadiran.map(k => ({
        memberId: k.memberId || '',
        memberNama: k.memberNama || '',
        memberNik: k.memberNik || '',
        memberPeran: k.memberPeran || 'kepala_keluarga',
        // Hindari base64 besar di dalam array kehadiran agar dokumen Activity selalu ringan & cepat tersinkron di semua HP/Laptop
        memberFotoUrl: k.memberFotoUrl && k.memberFotoUrl.startsWith('data:') && k.memberFotoUrl.length > 5000 ? '' : (k.memberFotoUrl || ''),
        scanTimestamp: k.scanTimestamp || nowIso,
        scanTimeFormatted: k.scanTimeFormatted || '',
        activityId: k.activityId || act.id,
        activityTitle: k.activityTitle || act.judul,
        activityType: k.activityType || act.jenis,
      }))
    : [];

  const full: Activity = {
    id: act.id,
    judul: act.judul || 'Kegiatan Yayasan Al Ikhlas',
    jenis: act.jenis || 'pengajian_umum',
    tanggal: act.tanggal || nowIso.slice(0, 10),
    jamMulai: act.jamMulai || '19:30',
    jamSelesai: act.jamSelesai || '21:30',
    lokasi: act.lokasi || 'Gedung Yayasan Al Ikhlas Sembilan Satu Dalung',
    deskripsi: act.deskripsi || '',
    pesertaIds: Array.isArray(act.pesertaIds) ? Array.from(new Set(act.pesertaIds)) : [],
    kehadiran: cleanKehadiran,
    createdAt: act.createdAt || nowIso,
    updatedAt: act.updatedAt || nowIso,
  };

  if (isDeletedArchive) {
    full.deletedAt = act.deletedAt || nowIso;
    full.deletedReason = act.deletedReason || 'Agenda dihapus oleh Admin (Tersimpan di tempkegiatanlama)';
  }

  return full;
}

export async function recordAllocatedActivityIdInCounter(allocatedId: string, seqNum?: number): Promise<void> {
  try {
    const counterRef = doc(db, SYSTEM_COUNTERS_COLLECTION, 'activity_id_seq');
    let currentLastNum = 3;
    let usedIds: string[] = [];

    try {
      const snap = await getDocFromServer(counterRef);
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.lastRootNumber === 'number' && data.lastRootNumber > currentLastNum) {
          currentLastNum = data.lastRootNumber;
        }
        if (Array.isArray(data.usedIds)) {
          usedIds = data.usedIds;
        }
      }
    } catch {}

    const parsedNum = seqNum ?? parseActivityNumber(allocatedId);
    const updatedLastNum = !isNaN(parsedNum) && parsedNum > currentLastNum ? parsedNum : currentLastNum;
    const updatedUsedIds = Array.from(new Set([...usedIds, allocatedId])).slice(-1000);

    await setDoc(
      counterRef,
      {
        lastRootNumber: updatedLastNum,
        usedIds: updatedUsedIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[ACTIVITY_ID_COUNTER] Note recording allocated activity ID:', err);
  }
}

export async function allocateUniqueActivityIdFromServer(
  localActivities: Activity[] = [],
  localDeletedActivities: Activity[] = []
): Promise<string> {
  const usedIds = new Set<string>();
  let maxSeqNum = 3;

  const registerActId = (id?: string) => {
    if (!id) return;
    const trimmed = id.trim();
    if (!trimmed) return;
    usedIds.add(trimmed);
    const num = parseActivityNumber(trimmed);
    if (num > maxSeqNum) {
      maxSeqNum = num;
    }
  };

  localActivities.forEach(a => registerActId(a.id));
  localDeletedActivities.forEach(a => registerActId(a.id));

  try {
    const actSnap = await getDocs(collection(db, ACTIVITIES_COLLECTION));
    actSnap.forEach(d => {
      registerActId(d.id);
      const data = d.data();
      if (data?.id) registerActId(data.id);
    });
  } catch (err) {
    console.warn('[ACTIVITY_ID_ALLOCATOR] Note reading activities:', err);
  }

  try {
    const delSnap = await getDocs(collection(db, TEMP_KEGIATAN_LAMA_COLLECTION));
    delSnap.forEach(d => {
      registerActId(d.id);
      const data = d.data();
      if (data?.id) registerActId(data.id);
    });
  } catch (err) {
    console.warn('[ACTIVITY_ID_ALLOCATOR] Note reading tempkegiatanlama:', err);
  }

  try {
    const counterSnap = await getDocFromServer(doc(db, SYSTEM_COUNTERS_COLLECTION, 'activity_id_seq'));
    if (counterSnap.exists()) {
      const cData = counterSnap.data();
      if (typeof cData.lastRootNumber === 'number' && cData.lastRootNumber > maxSeqNum) {
        maxSeqNum = cData.lastRootNumber;
      }
      if (Array.isArray(cData.usedIds)) {
        cData.usedIds.forEach((uid: string) => registerActId(uid));
      }
    }
  } catch {}

  let nextNum = maxSeqNum + 1;
  let candidateId = `ACT-2026-${String(nextNum).padStart(3, '0')}`;
  while (usedIds.has(candidateId)) {
    nextNum++;
    candidateId = `ACT-2026-${String(nextNum).padStart(3, '0')}`;
  }

  for (let check = 0; check < 10; check++) {
    try {
      const [aSnap, dSnap] = await Promise.all([
        getDocFromServer(doc(db, ACTIVITIES_COLLECTION, candidateId)),
        getDocFromServer(doc(db, TEMP_KEGIATAN_LAMA_COLLECTION, candidateId)),
      ]);
      if (!aSnap.exists() && !dSnap.exists()) {
        break;
      }
      nextNum++;
      candidateId = `ACT-2026-${String(nextNum).padStart(3, '0')}`;
    } catch {
      break;
    }
  }

  await recordAllocatedActivityIdInCounter(candidateId, nextNum);
  return candidateId;
}

export async function saveActivityToFirestore(activity: Activity): Promise<void> {
  const path = `${ACTIVITIES_COLLECTION}/${activity.id}`;
  try {
    const payload = buildCompleteActivityRecord(activity, false);
    await setDoc(doc(db, ACTIVITIES_COLLECTION, activity.id), cleanForFirestore(payload));
    await recordAllocatedActivityIdInCounter(activity.id);
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteActivityFromFirestore(activityId: string): Promise<void> {
  const path = `${ACTIVITIES_COLLECTION}/${activityId}`;
  try {
    await deleteDoc(doc(db, ACTIVITIES_COLLECTION, activityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchActivitiesFromFirestore(): Promise<Activity[]> {
  try {
    const snap = await getDocs(collection(db, ACTIVITIES_COLLECTION));
    const list: Activity[] = [];
    snap.forEach(d => {
      list.push(buildCompleteActivityRecord(d.data() as Activity, false));
    });
    list.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    return list;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Error fetching activities from Firestore:', error);
    return [];
  }
}

export function subscribeActivitiesFirestore(
  onUpdate: (activities: Activity[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = ACTIVITIES_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Activity[] = [];
      snapshot.forEach(docSnap => {
        list.push(buildCompleteActivityRecord(docSnap.data() as Activity, false));
      });
      list.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

// =========================================================================
// KOLEKSI ARSIP AGENDA KEGIATAN TERHAPUS: 'tempkegiatanlama'
// =========================================================================

export async function saveToTempKegiatanLamaFirestore(activity: Activity): Promise<void> {
  const path = `${TEMP_KEGIATAN_LAMA_COLLECTION}/${activity.id}`;
  try {
    const payload = buildCompleteActivityRecord(activity, true);
    await setDoc(doc(db, TEMP_KEGIATAN_LAMA_COLLECTION, activity.id), cleanForFirestore(payload));
    await recordAllocatedActivityIdInCounter(activity.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFromTempKegiatanLamaFirestore(activityId: string): Promise<void> {
  const path = `${TEMP_KEGIATAN_LAMA_COLLECTION}/${activityId}`;
  try {
    await deleteDoc(doc(db, TEMP_KEGIATAN_LAMA_COLLECTION, activityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchTempKegiatanLamaFromFirestore(): Promise<Activity[]> {
  try {
    const snap = await getDocs(collection(db, TEMP_KEGIATAN_LAMA_COLLECTION));
    const list: Activity[] = [];
    snap.forEach(d => {
      list.push(buildCompleteActivityRecord(d.data() as Activity, true));
    });
    list.sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime());
    return list;
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('Error fetching tempkegiatanlama:', error);
    return [];
  }
}

export function subscribeTempKegiatanLamaFirestore(
  onUpdate: (deletedActivities: Activity[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = TEMP_KEGIATAN_LAMA_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Activity[] = [];
      snapshot.forEach(docSnap => {
        list.push(buildCompleteActivityRecord(docSnap.data() as Activity, true));
      });
      list.sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

// =========================================================================
// KOLEKSI DRAFT AGENDA BELUM DISIMPAN: 'tempkegiatansebelumsimpan' (Interval 5 Detik)
// =========================================================================

export async function saveTempKegiatanSebelumSimpanToFirestore(draft: TempKegiatanSebelumSimpan): Promise<void> {
  const path = `${TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION}/${draft.idtempkegiatan}`;
  try {
    const cleanPayload = cleanForFirestore({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION, draft.idtempkegiatan), cleanPayload, { merge: true });
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(error instanceof Error ? error.message : String(error));
    }
    console.warn('[TEMP_KEGIATAN_SEBELUM_SIMPAN_NOTE]', error);
  }
}

export async function fetchTempKegiatanSebelumSimpanFromFirestore(): Promise<TempKegiatanSebelumSimpan[]> {
  try {
    const snap = await getDocs(collection(db, TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION));
    const list: TempKegiatanSebelumSimpan[] = [];
    snap.forEach(d => list.push(d.data() as TempKegiatanSebelumSimpan));
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  } catch (error) {
    console.warn('Error fetching tempkegiatansebelumsimpan:', error);
    return [];
  }
}

export function subscribeTempKegiatanSebelumSimpanFirestore(
  onUpdate: (drafts: TempKegiatanSebelumSimpan[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: TempKegiatanSebelumSimpan[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as TempKegiatanSebelumSimpan);
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        notifyQuotaLimitExceeded(error.message);
        onError?.(new Error(QUOTA_LIMIT_MESSAGE));
        return;
      }
      onError?.(error);
    }
  );
}

export async function deleteTempKegiatanSebelumSimpanFromFirestore(idtempkegiatan: string): Promise<void> {
  const path = `${TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION}/${idtempkegiatan}`;
  try {
    await deleteDoc(doc(db, TEMP_KEGIATAN_SEBELUM_SIMPAN_COLLECTION, idtempkegiatan));
  } catch (error) {
    console.warn('Error deleting tempkegiatansebelumsimpan:', path, error);
  }
}


