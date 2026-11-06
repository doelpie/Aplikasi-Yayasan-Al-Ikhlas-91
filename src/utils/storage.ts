import { Member, AppNotification, BroadcastMessage, MemberStatus, FamilyRole, Activity, ActivityType, ActivityAttendee } from '../types';
import { INITIAL_MEMBERS, SYARI_PHOTOS } from '../data/initialData';
import { soundEffects } from './sound';
import { compressImage } from './imageCompressor';
import { 
  saveMemberToFirestore, 
  saveMemberWithRetryAndConfirmation,
  verifyMemberExistsInFirestore,
  checkFirestoreConnectionStatus,
  pollVerifyMemberInMembersCollection3Seconds,
  deleteMemberFromFirestore, 
  addNotificationToFirestore, 
  markAllNotificationsAsReadInFirestore,
  allocateUniqueMemberIdFromServer,
  recordAllocatedIdInCounter,
  saveToTempDataMenungguFirestore,
  deleteFromTempDataMenungguFirestore,
  fetchTempDataMenungguFromFirestore,
  saveToTempDataLamaFirestore,
  deleteFromTempDataLamaFirestore,
  fetchTempDataLamaFromFirestore,
  fetchMembersFromFirestore,
  allocateUniqueActivityIdFromServer,
  recordAllocatedActivityIdInCounter,
  parseActivityNumber,
  saveActivityToFirestore,
  deleteActivityFromFirestore,
  fetchActivitiesFromFirestore,
  saveToTempKegiatanLamaFirestore,
  deleteFromTempKegiatanLamaFirestore,
  fetchTempKegiatanLamaFromFirestore,
  QUOTA_LIMIT_MESSAGE,
  isFirestoreQuotaError,
  notifyQuotaLimitExceeded
} from '../firebase';

export interface DeepRegistrationLogEntry {
  id: string;
  traceId: string;
  timestamp: string;
  stage: 
    | 'INISIALISASI'
    | 'VALIDASI_UNIK_NIK_ID'
    | 'STATUS_KONEKSI_FIRESTORE'
    | 'PRE_FLIGHT_KOMPRESI'
    | 'PENULISAN_DATA_MEMBERS'
    | 'POLLING_3_DETIK_VERIFIKASI'
    | 'KONFIRMASI_BERHASIL'
    | 'SINKRONISASI_LOCAL_STATE'
    | 'PENERBITAN_NOTIFIKASI_ADMIN'
    | 'PEMULIHAN_TEMPDATALAMA'
    | 'ERROR_PENDAFTARAN';
  title: string;
  detail: string;
  latencyMs?: number;
  data?: Record<string, any>;
  status: 'SUCCESS' | 'INFO' | 'WARN' | 'ERROR';
}

const STORAGE_DEEP_LOGS_KEY = 'yayasan_alikhlas_deep_registration_logs_v1';
const STORAGE_MEMBERS_KEY = 'yayasan_alikhlas_members_v3';
const STORAGE_TEMP_DATA_MENUNGGU_KEY = 'yayasan_alikhlas_tempdatamenunggu_v1';
const STORAGE_TEMP_DATA_LAMA_KEY = 'yayasan_alikhlas_tempdatalama_v1';
const STORAGE_NOTIF_KEY = 'yayasan_alikhlas_notifications_v3';
const STORAGE_USER_KEY = 'yayasan_alikhlas_user_session_v3';
const STORAGE_ACTIVITIES_KEY = 'yayasan_alikhlas_activities_v1';
const STORAGE_TEMP_KEGIATAN_LAMA_KEY = 'yayasan_alikhlas_tempkegiatanlama_v1';
const STORAGE_REGISTRATION_TRACES_KEY = 'yayasan_alikhlas_reg_traces_v1';
const BROADCAST_CHANNEL_NAME = 'yayasan_alikhlas_channel_nu_v3';

// Sanitize log data to never store massive base64 images inside localStorage logs
function sanitizeDataForLog(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') {
    if (data.startsWith('data:image') || data.length > 300) {
      return `[Lampiran Gambar/Data ~${Math.round(data.length / 1024)} KB]`;
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.slice(0, 10).map(sanitizeDataForLog);
  }
  if (typeof data === 'object') {
    const copy: any = {};
    for (const key of Object.keys(data)) {
      if (key === 'fotoUrl' || key === 'ktpUrl' || key === 'kkUrl') {
        copy[key] = data[key] ? `[Gambar ~${Math.round(String(data[key]).length / 1024)} KB]` : null;
      } else {
        copy[key] = sanitizeDataForLog(data[key]);
      }
    }
    return copy;
  }
  return data;
}

export function getDeepRegistrationLogs(): DeepRegistrationLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_DEEP_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeepRegistrationLog(entry: DeepRegistrationLogEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitizedEntry: DeepRegistrationLogEntry = {
      ...entry,
      detail: entry.detail && entry.detail.length > 400 ? entry.detail.slice(0, 400) + '...' : entry.detail,
      data: sanitizeDataForLog(entry.data),
    };
    const current = getDeepRegistrationLogs();
    const updated = [sanitizedEntry, ...current.slice(0, 19)]; // Keep max 20 lightweight log records
    localStorage.setItem(STORAGE_DEEP_LOGS_KEY, JSON.stringify(updated));
  } catch (err: any) {
    try {
      localStorage.removeItem(STORAGE_DEEP_LOGS_KEY);
    } catch {}
    console.warn('Cleared deep logs to prevent quota overflow:', err?.message || err);
  }
}

export function clearDeepRegistrationLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_DEEP_LOGS_KEY);
  } catch {}
}

export interface RegistrationTraceStep {
  step: string;
  timestamp: string;
  durationMs: number;
  detail?: string;
  success: boolean;
}

export interface RegistrationTrace {
  traceId: string;
  memberId: string;
  nama: string;
  nikMasked: string;
  role: string;
  timestamp: string;
  payloadSizeKB: number;
  steps: RegistrationTraceStep[];
  totalDurationMs: number;
  success: boolean;
  error?: string;
}

export function getRegistrationTraces(): RegistrationTrace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_REGISTRATION_TRACES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRegistrationTrace(trace: RegistrationTrace): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getRegistrationTraces();
    const updated = [trace, ...current.slice(0, 14)]; // Keep max 15 traces
    localStorage.setItem(STORAGE_REGISTRATION_TRACES_KEY, JSON.stringify(updated));
  } catch (err: any) {
    try {
      localStorage.removeItem(STORAGE_REGISTRATION_TRACES_KEY);
    } catch {}
    console.warn('Cleared registration traces to prevent quota overflow:', err?.message || err);
  }
}

export function clearRegistrationTraces(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_REGISTRATION_TRACES_KEY);
  } catch {}
}

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel not supported:', err);
  }
}

// =========================================================================
// IN-MEMORY & INDEXED-DB HIGH-CAPACITY STORAGE (NO LOCALSTORAGE 5MB LIMIT)
// =========================================================================
let inMemoryMembers: Member[] | null = null;
let inMemoryTempDataMenunggu: Member[] | null = null;
let inMemoryTempDataLama: Member[] | null = null;

const IDB_NAME = 'YayasanAlIkhlasStore';
const IDB_VERSION = 1;
const IDB_STORE = 'members_cache';

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveMembersToIndexedDB(members: Member[]): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(members, 'all_members');
  } catch (err) {
    console.warn('IndexedDB save notice:', err);
  }
}

export async function loadMembersFromIndexedDB(): Promise<Member[] | null> {
  try {
    const db = await openIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get('all_members');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveTempDataMenungguToIndexedDB(waitingMembers: Member[]): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(waitingMembers, 'tempdatamenunggu');
  } catch (err) {
    console.warn('IndexedDB tempdatamenunggu save notice:', err);
  }
}

export async function loadTempDataMenungguFromIndexedDB(): Promise<Member[] | null> {
  try {
    const db = await openIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get('tempdatamenunggu');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveTempDataLamaToIndexedDB(tempMembers: Member[]): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(tempMembers, 'tempdatalama');
  } catch (err) {
    console.warn('IndexedDB tempdatalama save notice:', err);
  }
}

export async function loadTempDataLamaFromIndexedDB(): Promise<Member[] | null> {
  try {
    const db = await openIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get('tempdatalama');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Hydrate in-memory cache from IndexedDB on startup (without ever injecting dummy records)
if (typeof window !== 'undefined') {
  loadMembersFromIndexedDB().then((idbMembers) => {
    if (idbMembers && idbMembers.length > 0 && inMemoryMembers && inMemoryMembers.length > 0) {
      inMemoryMembers = inMemoryMembers.map((m) => {
        const fromIdb = idbMembers.find((im) => im.id === m.id);
        if (fromIdb) {
          return {
            ...m,
            fotoUrl: m.fotoUrl || fromIdb.fotoUrl,
            ktpUrl: m.ktpUrl || fromIdb.ktpUrl,
            kkUrl: m.kkUrl || fromIdb.kkUrl,
          };
        }
        return m;
      });
    }
  }).catch(() => {});

  loadTempDataMenungguFromIndexedDB().then((idbWaiting) => {
    if (idbWaiting && idbWaiting.length > 0 && (!inMemoryTempDataMenunggu || inMemoryTempDataMenunggu.length === 0)) {
      inMemoryTempDataMenunggu = idbWaiting;
    }
  }).catch(() => {});

  loadTempDataLamaFromIndexedDB().then((idbTemp) => {
    if (idbTemp && idbTemp.length > 0 && (!inMemoryTempDataLama || inMemoryTempDataLama.length === 0)) {
      inMemoryTempDataLama = idbTemp;
    }
  }).catch(() => {});
}

// Strip heavy document attachments (KTP/KK > 3KB) for localStorage while keeping profile photos (fotoUrl <= 65KB) for instant 0ms rendering
function createLightweightMembersForLocalStorage(members: Member[]): Member[] {
  return members.map((m) => {
    const stripped = { ...m };
    if (stripped.fotoUrl && stripped.fotoUrl.startsWith('data:') && stripped.fotoUrl.length > 65000) {
      stripped.fotoUrl = '';
    }
    if (stripped.ktpUrl && stripped.ktpUrl.startsWith('data:') && stripped.ktpUrl.length > 3000) {
      stripped.ktpUrl = '';
    }
    if (stripped.kkUrl && stripped.kkUrl.startsWith('data:') && stripped.kkUrl.length > 3000) {
      stripped.kkUrl = '';
    }
    return stripped;
  });
}

/**
 * Menjaga keunikan ID tanpa pernah menyuntikkan data dummy INITIAL_MEMBERS atau memulihkan data terhapus secara otomatis.
 */
export function ensureAgusAndSriyonoInMemberList(list: Member[]): { members: Member[]; changed: boolean } {
  const byId = new Map<string, Member>();
  let changed = false;

  for (const m of list) {
    if (!m || !m.id) continue;
    const existing = byId.get(m.id);
    if (!existing) {
      byId.set(m.id, m);
    } else {
      changed = true;
      // Pertahankan field yang lebih lengkap (terutama fotoUrl, ktpUrl, kkUrl)
      byId.set(m.id, {
        ...existing,
        ...m,
        fotoUrl: m.fotoUrl || existing.fotoUrl || '',
        ktpUrl: m.ktpUrl || existing.ktpUrl || '',
        kkUrl: m.kkUrl || existing.kkUrl || '',
      });
    }
  }

  return { members: Array.from(byId.values()), changed };
}

/**
 * Menggabungkan secara konsisten data dari koleksi 'members' (anggota resmi) dan 'tempdatamenunggu' (pendaftar menunggu persetujuan admin)
 * sehingga:
 * 1. Tidak ada data pendaftar berstatus 'menunggu' yang hilang dari halaman Admin.
 * 2. Data yang sudah dihapus ke 'tempdatalama' tidak pernah muncul kembali tanpa konfirmasi Admin.
 * 3. Tidak pernah ada data dummy yang tiba-tiba muncul.
 */
export function reconcileAuthoritativeMembers(
  firestoreMembers: Member[],
  waitingMembers: Member[] = getStoredTempDataMenunggu(),
  deletedMembers: Member[] = getStoredTempDataLama()
): Member[] {
  const previousLocal = inMemoryMembers || [];
  const mapById = new Map<string, Member>();
  const activeFirestoreIds = new Set(firestoreMembers.map(m => m.id));
  const deletedIdsOnlyInArchive = new Set(
    deletedMembers.map(m => m.id).filter(id => !activeFirestoreIds.has(id))
  );

  // 1. Masukkan seluruh dokumen resmi dari koleksi 'members' di Firestore
  for (const m of firestoreMembers) {
    if (!m || !m.id) continue;
    const prev = previousLocal.find(p => p.id === m.id);
    mapById.set(m.id, {
      ...m,
      fotoUrl: m.fotoUrl || prev?.fotoUrl || '',
      ktpUrl: m.ktpUrl || prev?.ktpUrl || '',
      kkUrl: m.kkUrl || prev?.kkUrl || '',
    });
  }

  // 2. Pastikan seluruh pendaftar di koleksi 'tempdatamenunggu' selalu masuk sebagai status 'menunggu'
  // (kecuali sudah disetujui di 'members' atau sudah dihapus ke 'tempdatalama')
  for (const w of waitingMembers) {
    if (!w || !w.id) continue;
    if (deletedIdsOnlyInArchive.has(w.id)) continue;

    const existingInMembers = mapById.get(w.id);
    if (!existingInMembers) {
      const prev = previousLocal.find(p => p.id === w.id);
      mapById.set(w.id, {
        ...w,
        status: w.status || 'menunggu',
        fotoUrl: w.fotoUrl || prev?.fotoUrl || '',
        ktpUrl: w.ktpUrl || prev?.ktpUrl || '',
        kkUrl: w.kkUrl || prev?.kkUrl || '',
      });
    } else {
      // Lengkapi foto/lampiran jika di tempdatamenunggu lebih lengkap
      mapById.set(w.id, {
        ...w,
        ...existingInMembers,
        fotoUrl: existingInMembers.fotoUrl || w.fotoUrl || '',
        ktpUrl: existingInMembers.ktpUrl || w.ktpUrl || '',
        kkUrl: existingInMembers.kkUrl || w.kkUrl || '',
      });
    }
  }

  return Array.from(mapById.values());
}

export function getStoredMembers(): Member[] {
  if (inMemoryMembers) {
    return inMemoryMembers;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (!raw) {
      inMemoryMembers = [];
      return [];
    }
    const parsed: Member[] = JSON.parse(raw);
    const { members: deduped } = ensureAgusAndSriyonoInMemberList(parsed);
    inMemoryMembers = deduped;
    return deduped;
  } catch (e) {
    console.warn('Error reading members from localStorage:', e);
    return inMemoryMembers || [];
  }
}

export function saveMembers(members: Member[]): void {
  inMemoryMembers = members;

  if (typeof window === 'undefined') return;

  saveMembersToIndexedDB(members).catch(() => {});

  try {
    // Store lightweight version (with profile photos intact, stripping only heavy KTP/KK attachments) for super-fast localStorage access
    const fastLocalList = createLightweightMembersForLocalStorage(members);
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(fastLocalList));
  } catch (e: any) {
    const isQuota = e?.name === 'QuotaExceededError' || e?.message?.includes('exceeded the quota') || e?.code === 22;
    if (isQuota) {
      try {
        localStorage.removeItem(STORAGE_DEEP_LOGS_KEY);
        localStorage.removeItem(STORAGE_REGISTRATION_TRACES_KEY);
      } catch {}

      try {
        const ultraLight = members.map(m => ({
          ...m,
          fotoUrl: m.fotoUrl && m.fotoUrl.startsWith('data:') && m.fotoUrl.length > 15000 ? '' : m.fotoUrl,
          ktpUrl: '',
          kkUrl: '',
        }));
        localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(ultraLight));
      } catch (err2) {
        console.warn('LocalStorage fallback note:', err2);
      }
    } else {
      console.warn('Error saving members to localStorage:', e);
    }
  }
}

// =========================================================================
// PENYIMPANAN LOKAL & SINKRONISASI KOLEKSI 'tempdatamenunggu' (MENUNGGU PERSETUJUAN ADMIN)
// =========================================================================
export function getStoredTempDataMenunggu(): Member[] {
  if (inMemoryTempDataMenunggu) {
    return inMemoryTempDataMenunggu;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_TEMP_DATA_MENUNGGU_KEY);
    const parsed: Member[] = raw ? JSON.parse(raw) : [];
    inMemoryTempDataMenunggu = parsed;
    return parsed;
  } catch {
    return [];
  }
}

export function saveTempDataMenunggu(waitingMembers: Member[]): void {
  inMemoryTempDataMenunggu = waitingMembers;
  if (typeof window === 'undefined') return;

  saveTempDataMenungguToIndexedDB(waitingMembers).catch(() => {});

  try {
    const lightweight = createLightweightMembersForLocalStorage(waitingMembers);
    localStorage.setItem(STORAGE_TEMP_DATA_MENUNGGU_KEY, JSON.stringify(lightweight));
  } catch (err) {
    console.warn('TempDataMenunggu localStorage note:', err);
  }
}

// =========================================================================
// PENYIMPANAN LOKAL & SINKRONISASI KOLEKSI 'tempdatalama' (DATA TERHAPUS)
// =========================================================================
export function getStoredTempDataLama(): Member[] {
  if (inMemoryTempDataLama) {
    return inMemoryTempDataLama;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_TEMP_DATA_LAMA_KEY);
    const parsed: Member[] = raw ? JSON.parse(raw) : [];
    inMemoryTempDataLama = parsed;
    return parsed;
  } catch {
    return [];
  }
}

export function saveTempDataLama(tempMembers: Member[]): void {
  inMemoryTempDataLama = tempMembers;
  if (typeof window === 'undefined') return;

  saveTempDataLamaToIndexedDB(tempMembers).catch(() => {});

  try {
    const lightweight = createLightweightMembersForLocalStorage(tempMembers);
    localStorage.setItem(STORAGE_TEMP_DATA_LAMA_KEY, JSON.stringify(lightweight));
  } catch (err) {
    console.warn('TempDataLama localStorage note:', err);
  }
}

export interface NikCheckResult {
  status: 'available' | 'exists_in_members' | 'exists_in_tempdatalama';
  member?: Member;
}

/**
 * Memeriksa keunikan Nomor KTP / KIA (NIK) di koleksi aktif `members`, koleksi tunggu `tempdatamenunggu`, dan koleksi arsip `tempdatalama`.
 * - Jika NIK sudah terdaftar di `members` atau `tempdatamenunggu`: kembalikan `exists_in_members`.
 * - Jika NIK pernah terdaftar lalu terhapus (ada di `tempdatalama`): kembalikan `exists_in_tempdatalama` beserta datanya.
 */
export async function checkNikAvailability(
  nik: string,
  excludeMemberId?: string
): Promise<NikCheckResult> {
  const cleanNik = (nik || '').trim().replace(/\D/g, '');
  if (!cleanNik) return { status: 'available' };

  // 1. Cek di cache lokal members & tempdatamenunggu
  const localMembers = getStoredMembers();
  const foundLocalActive = localMembers.find(
    m => (m.nik || '').replace(/\D/g, '') === cleanNik && m.id !== excludeMemberId
  );
  if (foundLocalActive) {
    return { status: 'exists_in_members', member: foundLocalActive };
  }

  const localWaiting = getStoredTempDataMenunggu();
  const foundLocalWaiting = localWaiting.find(
    m => (m.nik || '').replace(/\D/g, '') === cleanNik && m.id !== excludeMemberId
  );
  if (foundLocalWaiting) {
    return { status: 'exists_in_members', member: foundLocalWaiting };
  }

  // 2. Cek di server Firestore 'members' & 'tempdatamenunggu' untuk kepastian lintas perangkat
  try {
    const [remoteMembers, remoteWaiting] = await Promise.all([
      fetchMembersFromFirestore(),
      fetchTempDataMenungguFromFirestore(),
    ]);
    const foundRemoteActive = remoteMembers.find(
      m => (m.nik || '').replace(/\D/g, '') === cleanNik && m.id !== excludeMemberId
    );
    if (foundRemoteActive) {
      return { status: 'exists_in_members', member: foundRemoteActive };
    }
    const foundRemoteWaiting = remoteWaiting.find(
      m => (m.nik || '').replace(/\D/g, '') === cleanNik && m.id !== excludeMemberId
    );
    if (foundRemoteWaiting) {
      return { status: 'exists_in_members', member: foundRemoteWaiting };
    }
  } catch (err) {
    console.warn('Note checking remote members/tempdatamenunggu for NIK:', err);
  }

  // 3. Cek di koleksi tempdatalama (lokal & Firestore) apakah data pernah terdaftar lalu terhapus
  const localTemp = getStoredTempDataLama();
  const foundLocalTemp = localTemp.find(m => (m.nik || '').replace(/\D/g, '') === cleanNik);
  if (foundLocalTemp) {
    return { status: 'exists_in_tempdatalama', member: foundLocalTemp };
  }

  try {
    const remoteTemp = await fetchTempDataLamaFromFirestore();
    if (remoteTemp.length > 0) {
      saveTempDataLama(remoteTemp);
    }
    const foundRemoteTemp = remoteTemp.find(m => (m.nik || '').replace(/\D/g, '') === cleanNik);
    if (foundRemoteTemp) {
      return { status: 'exists_in_tempdatalama', member: foundRemoteTemp };
    }
  } catch (err) {
    console.warn('Note checking remote tempdatalama for NIK:', err);
  }

  return { status: 'available' };
}

/**
 * Mengembalikan (restore) data anggota yang sudah terhapus dari koleksi `tempdatalama`
 * kembali ke dalam koleksi `members` di Firestore, diverifikasi server, lalu mengirim notifikasi.
 */
export async function restoreMemberFromTempDataLamaAsync(
  deletedMember: Member,
  overrides?: Partial<Member>,
  onStatusUpdate?: (status: string) => void
): Promise<Member> {
  const traceId = 'RESTORE-' + Date.now().toString(36).toUpperCase();
  onStatusUpdate?.(`Memulihkan seluruh field data "${deletedMember.nama}" dari tabel tempdatalama ke koleksi members...`);

  const activeMembers = getStoredMembers();
  const tempMembers = getStoredTempDataLama();

  // Pastikan seluruh field (termasuk fotoUrl, ktpUrl, kkUrl) diambil utuh dari IndexedDB / Firestore tempdatalama
  let enrichedDeleted = { ...deletedMember };
  try {
    const idbTemp = await loadTempDataLamaFromIndexedDB();
    const matchIdb = idbTemp?.find(m => m.id === deletedMember.id || m.nik === deletedMember.nik);
    if (matchIdb) {
      enrichedDeleted = {
        ...matchIdb,
        ...enrichedDeleted,
        fotoUrl: enrichedDeleted.fotoUrl || matchIdb.fotoUrl || '',
        ktpUrl: enrichedDeleted.ktpUrl || matchIdb.ktpUrl || '',
        kkUrl: enrichedDeleted.kkUrl || matchIdb.kkUrl || '',
      };
    }
  } catch {}

  // Gunakan ID asli jika belum terpakai oleh orang lain di members aktif, atau alokasikan ID unik baru jika sudah terpakai
  let targetId = enrichedDeleted.id;
  const idOccupiedByOther = activeMembers.some(
    m => m.id === targetId && (m.nik || '').replace(/\D/g, '') !== (enrichedDeleted.nik || '').replace(/\D/g, '')
  );
  if (!targetId || idOccupiedByOther) {
    targetId = await allocateUniqueMemberIdFromServer(
      enrichedDeleted.kepalaKeluargaId,
      activeMembers,
      tempMembers
    );
  }

  const restoredMember: Member = {
    id: targetId,
    regNumber: overrides?.regNumber ?? enrichedDeleted.regNumber ?? '',
    nik: overrides?.nik ?? enrichedDeleted.nik ?? '',
    nama: overrides?.nama ?? enrichedDeleted.nama ?? '',
    tempatTanggalLahir: overrides?.tempatTanggalLahir ?? enrichedDeleted.tempatTanggalLahir ?? '',
    alamat: overrides?.alamat ?? enrichedDeleted.alamat ?? '',
    noHp: overrides?.noHp ?? enrichedDeleted.noHp ?? '',
    noKk: overrides?.noKk ?? enrichedDeleted.noKk ?? '',
    peranKeluarga: overrides?.peranKeluarga ?? enrichedDeleted.peranKeluarga ?? 'kepala_keluarga',
    kepalaKeluargaId: overrides?.kepalaKeluargaId ?? enrichedDeleted.kepalaKeluargaId,
    namaKepalaKeluarga: overrides?.namaKepalaKeluarga ?? enrichedDeleted.namaKepalaKeluarga,
    jumlahKeluarga: overrides?.jumlahKeluarga ?? enrichedDeleted.jumlahKeluarga ?? (enrichedDeleted.peranKeluarga === 'kepala_keluarga' ? 1 : 0),
    email: overrides?.email ?? enrichedDeleted.email ?? '',
    fotoUrl: overrides?.fotoUrl ?? enrichedDeleted.fotoUrl ?? '',
    fotoName: overrides?.fotoName ?? enrichedDeleted.fotoName ?? '',
    ktpUrl: overrides?.ktpUrl ?? enrichedDeleted.ktpUrl ?? '',
    ktpName: overrides?.ktpName ?? enrichedDeleted.ktpName ?? '',
    kkUrl: overrides?.kkUrl ?? enrichedDeleted.kkUrl ?? '',
    kkName: overrides?.kkName ?? enrichedDeleted.kkName ?? '',
    status: overrides?.status || enrichedDeleted.status || 'disetujui',
    catatanPenolakan: overrides?.catatanPenolakan ?? enrichedDeleted.catatanPenolakan,
    tanggalDaftar: enrichedDeleted.tanggalDaftar || new Date().toISOString(),
    tanggalDisetujui: enrichedDeleted.tanggalDisetujui || ( (overrides?.status || enrichedDeleted.status) === 'disetujui' ? new Date().toISOString() : undefined ),
  };
  delete (restoredMember as any).deletedAt;
  delete (restoredMember as any).deletedReason;

  // 1. Simpan ke koleksi 'members' di Firestore & verifikasi server
  await saveMemberWithRetryAndConfirmation(
    restoredMember,
    5,
    onStatusUpdate,
    traceId,
    { preventOverwrite: true }
  );

  // 2. Hapus dari koleksi 'tempdatalama' di Firestore & lokal
  try {
    await deleteFromTempDataLamaFirestore(deletedMember.id);
  } catch (err) {
    console.warn('Warning removing restored member from tempdatalama:', err);
  }

  const updatedTemp = tempMembers.filter(
    m => m.id !== deletedMember.id && (m.nik || '').replace(/\D/g, '') !== (deletedMember.nik || '').replace(/\D/g, '')
  );
  saveTempDataLama(updatedTemp);

  // 3. Perbarui daftar anggota lokal agar langsung tampil di Daftar Anggota & Halaman Admin
  const updatedMembers = [
    restoredMember,
    ...getStoredMembers().filter(m => m.id !== restoredMember.id),
  ];
  saveMembers(updatedMembers);

  saveDeepRegistrationLog({
    id: 'log_' + Date.now(),
    traceId,
    timestamp: new Date().toISOString(),
    stage: 'PEMULIHAN_TEMPDATALAMA',
    title: 'Data Anggota Berhasil Dikembalikan dari tempdatalama',
    detail: `Data "${restoredMember.nama}" (ID: ${restoredMember.id}, NIK: ${maskNik(restoredMember.nik)}) berhasil dipulihkan ke koleksi members.`,
    status: 'SUCCESS',
  });

  // 4. Buat notifikasi di Firestore 'notifications' (lengkap dengan seluruh data pendaftar di DB) baru kirimkan ke aplikasi
  const roleText = getPeranLabel(restoredMember.peranKeluarga);
  const notif = await addNotificationAsync(
    buildNotificationPayloadFromMember(restoredMember, {
      type: restoredMember.status === 'disetujui' ? 'status_approved' : 'new_registration',
      message: `Data anggota "${restoredMember.nama}" (ID: ${restoredMember.id}, ${roleText}) telah dipulihkan kembali ke daftar anggota.`,
    })
  );

  soundEffects.playSuccess();
  triggerSystemNotification(
    'Data Anggota Dipulihkan',
    `Data "${restoredMember.nama}" (ID: ${restoredMember.id}) telah dikembalikan ke daftar anggota.`
  );

  broadcastRealtime({
    type: 'STATUS_CHANGED',
    payload: {
      member: restoredMember,
      notification: notif,
    },
  });

  return restoredMember;
}

/**
 * Membangun objek notifikasi yang menampung seluruh data lengkap pendaftar untuk disimpan
 * di database Firestore koleksi `notifications`, sementara `message` hanya memuat data umum (Nama & ID).
 */
export function buildNotificationPayloadFromMember(
  member: Member,
  params: {
    type: AppNotification['type'];
    message: string;
  }
): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return {
    memberId: member.id,
    memberName: member.nama,
    type: params.type,
    message: params.message,
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
    status: member.status || 'menunggu',
    catatanPenolakan: member.catatanPenolakan || '',
    tanggalDaftar: member.tanggalDaftar || new Date().toISOString(),
    tanggalDisetujui: member.tanggalDisetujui || (member.status === 'disetujui' ? new Date().toISOString() : ''),
  };
}

export function getStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading notifications:', e);
    return [];
  }
}

export function saveNotifications(notifications: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Strip heavy base64 images when caching to localStorage to prevent QuotaExceededError
    // (Full images & complete fields remain stored in Firestore `notifications` collection)
    const lightweight = notifications.slice(0, 30).map(n => ({
      ...n,
      fotoUrl: n.fotoUrl && n.fotoUrl.length > 1500 ? '' : n.fotoUrl,
      ktpUrl: n.ktpUrl && n.ktpUrl.length > 1500 ? '' : n.ktpUrl,
      kkUrl: n.kkUrl && n.kkUrl.length > 1500 ? '' : n.kkUrl,
    }));
    localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(lightweight));
  } catch (e: any) {
    try {
      const minimal = notifications.slice(0, 10).map(n => ({
        id: n.id,
        memberId: n.memberId,
        memberName: n.memberName,
        type: n.type,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read,
        tanggalDaftar: n.tanggalDaftar,
        tanggalDisetujui: n.tanggalDisetujui,
        status: n.status,
      }));
      localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(minimal));
    } catch {}
    console.warn('Error saving notifications to localStorage:', e?.message || e);
  }
}

// User session management for Warga (Kepala Keluarga, Istri, Anak)
export function getCurrentUserSession(): Member | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const all = getStoredMembers();
    const fresh = all.find(m => m.id === session.id);
    if (!fresh || fresh.status !== 'disetujui') {
      localStorage.removeItem(STORAGE_USER_KEY);
      return null;
    }
    return fresh;
  } catch (e) {
    return null;
  }
}

export function setCurrentUserSession(member: Member | null): void {
  if (typeof window === 'undefined') return;
  if (!member) {
    try {
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch {}
  } else {
    try {
      const sessionClean: Member = {
        ...member,
        ktpUrl: member.ktpUrl && member.ktpUrl.length > 2000 ? '' : member.ktpUrl,
        kkUrl: member.kkUrl && member.kkUrl.length > 2000 ? '' : member.kkUrl,
      };
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(sessionClean));
    } catch (e: any) {
      console.warn('Error saving session to localStorage:', e?.message || e);
    }
  }
}

export function addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
  const all = getStoredNotifications();
  const nowIso = new Date().toISOString();
  const newNotif: AppNotification = {
    ...notification,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: nowIso,
    tanggalDaftar: notification.tanggalDaftar || nowIso,
    tanggalDisetujui: notification.tanggalDisetujui || (notification.type === 'status_approved' ? nowIso : undefined),
    read: false,
  };
  const updated = [newNotif, ...all.slice(0, 49)];
  saveNotifications(updated);
  
  addNotificationToFirestore(newNotif).catch(err => {
    console.warn('Firestore notification sync note:', err);
  });

  return newNotif;
}

export async function addNotificationAsync(
  notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
): Promise<AppNotification> {
  const nowIso = new Date().toISOString();
  const newNotif: AppNotification = {
    ...notification,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: nowIso,
    tanggalDaftar: notification.tanggalDaftar || nowIso,
    tanggalDisetujui: notification.tanggalDisetujui || (notification.type === 'status_approved' ? nowIso : undefined),
    read: false,
  };

  // 1. Tulis & verifikasi pada koleksi 'notifications' di Firestore terlebih dahulu (beserta seluruh data lengkap pendaftar)
  try {
    await addNotificationToFirestore(newNotif);
  } catch (err) {
    console.warn('Firestore notification async warning:', err);
  }

  // 2. Simpan ke state notifikasi lokal setelah tercatat di Firestore
  const all = getStoredNotifications();
  const updated = [newNotif, ...all.filter(n => n.id !== newNotif.id).slice(0, 49)];
  saveNotifications(updated);

  return newNotif;
}

export function markAllNotificationsAsRead(): void {
  const all = getStoredNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(all);
  
  markAllNotificationsAsReadInFirestore(all).catch(err => {
    console.warn('Firestore notification mark read note:', err);
  });
}

export function requestNotificationPermission(): void {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

export function triggerSystemNotification(title: string, body: string): void {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('System notification error:', err);
      }
    }
  }
}

export function subscribeToRealtimeEvents(
  onMessage: (msg: BroadcastMessage) => void
): () => void {
  if (!channel) return () => {};

  const handler = (event: MessageEvent) => {
    onMessage(event.data);
  };

  channel.addEventListener('message', handler);
  return () => {
    channel?.removeEventListener('message', handler);
  };
}

export function broadcastRealtime(msg: BroadcastMessage): void {
  if (channel) {
    try {
      channel.postMessage(msg);
    } catch (e) {
      console.warn('Failed to broadcast:', e);
    }
  }
}

// 6 Digit PIN verification from NIK/KIA
export function getLast6DigitsNik(nik: string): string {
  const clean = (nik || '').replace(/\D/g, '');
  return clean.slice(-6);
}

export function verifyMemberPin(member: Member, inputPin: string): boolean {
  const actual6 = getLast6DigitsNik(member.nik);
  const cleanInput = inputPin.trim().replace(/\D/g, '');
  return actual6.length === 6 && cleanInput === actual6;
}

// Family relationship helper
export function getFamilyMembers(member: Member, allMembers: Member[]): Member[] {
  if (!member.noKk) return [member];
  return allMembers.filter(m => m.noKk === member.noKk);
}

// List of available Kepala Keluarga for selection
export function getAvailableKepalaKeluarga(allMembers: Member[]): Member[] {
  return allMembers.filter(m => m.peranKeluarga === 'kepala_keluarga' && m.status === 'disetujui');
}

/**
 * Alur Persetujuan / Penolakan Anggota oleh Admin secara Terverifikasi:
 * 1. Update status anggota (misal 'disetujui') pada koleksi `members` di Firestore dan verifikasi telah tersimpan di server.
 * 2. Pastikan data anggota langsung diperbarui dan muncul pada halaman Daftar Anggota (`saveMembers`).
 * 3. Buat dokumen notifikasi pada koleksi `notifications` di Firestore (`addNotificationAsync`) yang menampung seluruh data lengkap pendaftar di database.
 * 4. Baru kirimkan notifikasi ke aplikasi (tampilan umum hanya Nama, ID, dan detail tanggal+jam).
 */
export async function updateMemberStatusAsync(
  memberId: string,
  newStatus: MemberStatus,
  note?: string,
  onStatusUpdate?: (statusText: string) => void
): Promise<{ updatedMember: Member | null; notification: AppNotification | null }> {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === memberId);
  if (index === -1) return { updatedMember: null, notification: null };

  const prevMember = members[index];
  const now = new Date().toISOString();
  
  let regNumber = prevMember.regNumber;
  if (newStatus === 'disetujui' && !regNumber) {
    const year = new Date().getFullYear();
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const suffix = prevMember.peranKeluarga === 'istri' ? '-B' : prevMember.peranKeluarga === 'anak' ? '-C' : '';
    regNumber = `${randCode}/YMWM13/II/${year} & L.${memberId}${suffix}`;
  }

  const updatedMember: Member = {
    ...prevMember,
    status: newStatus,
    catatanPenolakan: newStatus === 'ditolak' ? (note || 'Data pendaftaran belum memenuhi syarat administrasi.') : undefined,
    tanggalDisetujui: newStatus === 'disetujui' ? now : prevMember.tanggalDisetujui,
    regNumber,
  };

  const traceId = 'ACC-' + Date.now().toString(36).toUpperCase();
  onStatusUpdate?.(`Memperbarui status "${updatedMember.nama}" (ID: ${updatedMember.id}) di koleksi 'members' Firestore...`);

  // LANGKAH 1: Update & verifikasi ke koleksi 'members' di database Firestore terlebih dahulu
  await saveMemberWithRetryAndConfirmation(
    updatedMember,
    4,
    onStatusUpdate,
    traceId,
    { preventOverwrite: false }
  );

  // LANGKAH 1b: Sinkronkan tempat tampung sementara 'tempdatamenunggu'
  if (newStatus === 'menunggu') {
    await saveToTempDataMenungguFirestore(updatedMember);
    const currentWaiting = getStoredTempDataMenunggu();
    saveTempDataMenunggu([updatedMember, ...currentWaiting.filter(w => w.id !== memberId)]);
  } else {
    await deleteFromTempDataMenungguFirestore(memberId);
    const currentWaiting = getStoredTempDataMenunggu();
    saveTempDataMenunggu(currentWaiting.filter(w => w.id !== memberId));
  }

  // LANGKAH 2: Pastikan muncul di halaman Daftar Anggota & Admin
  const latestMembers = getStoredMembers();
  const targetIdx = latestMembers.findIndex(m => m.id === memberId);
  if (targetIdx !== -1) {
    latestMembers[targetIdx] = updatedMember;
    saveMembers([...latestMembers]);
  } else {
    saveMembers([updatedMember, ...latestMembers]);
  }

  // LANGKAH 3: Buat dokumen notifikasi di koleksi 'notifications' pada Firestore (menyimpan seluruh data pendaftar di DB, pesan aplikasi hanya data umum Nama & ID)
  const roleText = getPeranLabel(updatedMember.peranKeluarga);
  const statusLabel = newStatus === 'disetujui' ? 'DISETUJUI' : newStatus === 'ditolak' ? 'DITOLAK' : 'MENUNGGU ACC';
  const messageText =
    newStatus === 'disetujui'
      ? `Alhamdulillah, pendaftaran "${updatedMember.nama}" (ID: ${updatedMember.id}, ${roleText}) telah DISETUJUI dan resmi terdaftar di Daftar Anggota.`
      : `Status pendaftaran "${updatedMember.nama}" (ID: ${updatedMember.id}, ${roleText}) telah diubah menjadi ${statusLabel}.`;

  onStatusUpdate?.(`Mencatat notifikasi persetujuan ke koleksi 'notifications' Firestore...`);
  const notification = await addNotificationAsync(
    buildNotificationPayloadFromMember(updatedMember, {
      type: newStatus === 'disetujui' ? 'status_approved' : 'status_rejected',
      message: messageText,
    })
  );

  // LANGKAH 4: Kirimkan notifikasi ke aplikasi & bunyi indikator
  if (newStatus === 'disetujui') {
    soundEffects.playSuccess();
  } else if (newStatus === 'ditolak') {
    soundEffects.playWarning();
  }

  triggerSystemNotification(
    `Status Keanggotaan: ${statusLabel}`,
    messageText
  );

  broadcastRealtime({
    type: 'STATUS_CHANGED',
    payload: {
      member: updatedMember,
      notification,
    },
  });

  return { updatedMember, notification };
}

// Synchronous wrapper for compatibility
export function updateMemberStatus(
  memberId: string,
  newStatus: MemberStatus,
  note?: string
): { updatedMember: Member | null; notification: AppNotification | null } {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === memberId);
  if (index === -1) return { updatedMember: null, notification: null };

  const prevMember = members[index];
  const now = new Date().toISOString();
  
  let regNumber = prevMember.regNumber;
  if (newStatus === 'disetujui' && !regNumber) {
    const year = new Date().getFullYear();
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const suffix = prevMember.peranKeluarga === 'istri' ? '-B' : prevMember.peranKeluarga === 'anak' ? '-C' : '';
    regNumber = `${randCode}/YMWM13/II/${year} & L.${memberId}${suffix}`;
  }

  const updatedMember: Member = {
    ...prevMember,
    status: newStatus,
    catatanPenolakan: newStatus === 'ditolak' ? (note || 'Data pendaftaran belum memenuhi syarat administrasi.') : undefined,
    tanggalDisetujui: newStatus === 'disetujui' ? now : prevMember.tanggalDisetujui,
    regNumber,
  };

  members[index] = updatedMember;
  saveMembers(members);

  saveMemberToFirestore(updatedMember).catch(err => {
    console.warn('Firestore member status sync note:', err);
  });

  if (newStatus === 'disetujui') {
    soundEffects.playSuccess();
  } else if (newStatus === 'ditolak') {
    soundEffects.playWarning();
  }

  const roleText = getPeranLabel(updatedMember.peranKeluarga);
  const statusLabel = newStatus === 'disetujui' ? 'DISETUJUI' : newStatus === 'ditolak' ? 'DITOLAK' : 'MENUNGGU ACC';
  const notification = addNotification(
    buildNotificationPayloadFromMember(updatedMember, {
      type: newStatus === 'disetujui' ? 'status_approved' : 'status_rejected',
      message: `Status pendaftaran "${updatedMember.nama}" (ID: ${updatedMember.id}, ${roleText}) telah diubah menjadi ${statusLabel}.`,
    })
  );

  triggerSystemNotification(
    `Status Pendaftaran: ${statusLabel}`,
    `Data untuk ${updatedMember.nama} telah ${statusLabel.toLowerCase()}.`
  );

  broadcastRealtime({
    type: 'STATUS_CHANGED',
    payload: {
      member: updatedMember,
      notification,
    },
  });

  return { updatedMember, notification };
}

export async function addNewMemberAsync(
  data: Omit<Member, 'id' | 'tanggalDaftar' | 'status'> & { status?: MemberStatus },
  onStatusUpdate?: (status: string) => void
): Promise<Member> {
  const overallStartTime = Date.now();
  const traceId = 'REG-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const traceSteps: RegistrationTraceStep[] = [];

  const addStep = (stepName: string, durationMs: number, success: boolean, detail?: string) => {
    const record: RegistrationTraceStep = {
      step: stepName,
      timestamp: new Date().toISOString(),
      durationMs,
      detail,
      success,
    };
    traceSteps.push(record);
    console.log(`[Trace:${traceId}] [${success ? 'OK' : 'FAIL'}] ${stepName} (${durationMs}ms) - ${detail || ''}`);
  };

  const logDeep = (
    stage: DeepRegistrationLogEntry['stage'],
    title: string,
    detail: string,
    status: DeepRegistrationLogEntry['status'],
    latencyMs?: number,
    extraData?: Record<string, any>
  ) => {
    const entry: DeepRegistrationLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      traceId,
      timestamp: new Date().toISOString(),
      stage,
      title,
      detail,
      latencyMs: latencyMs || 0,
      data: extraData,
      status,
    };
    saveDeepRegistrationLog(entry);
    addStep(`[${stage}] ${title}`, latencyMs || 0, status !== 'ERROR', detail);

    const badgeColor = 
      status === 'SUCCESS' ? '#0b5d34' : 
      status === 'ERROR' ? '#b91c1c' : 
      status === 'WARN' ? '#d97706' : '#1e40af';

    console.log(
      `%c[DEEP_LOG:${traceId}]%c [${stage}] %c${title}%c (${latencyMs ? latencyMs + 'ms' : '0ms'}) - ${detail}`,
      `background:${badgeColor};color:white;font-weight:bold;padding:1px 5px;border-radius:3px;`,
      'color:#475569;font-weight:bold;',
      'color:#0f172a;font-weight:600;',
      'color:#64748b;',
      extraData ? extraData : ''
    );
  };

  console.group(`[Trace:${traceId}] Memulai Pendaftaran Terlacak & Logging Mendalam: "${data.nama}"`);
  onStatusUpdate?.(`[Trace: ${traceId}] Memulai alur pendaftaran terverifikasi...`);

  let assignedId = '';
  let payloadKB = 0;
  const roleText = getPeranLabel(data.peranKeluarga);
  const cleanNik = (data.nik || '').trim().replace(/\D/g, '');
  const nikMasked = cleanNik ? cleanNik.slice(0, 6) + '******' + cleanNik.slice(-4) : '-';

  try {
    // -------------------------------------------------------------
    // LANGKAH 1: PENGECEKAN STATUS KONEKSI FIRESTORE (LIVE PRE-CHECK)
    // -------------------------------------------------------------
    onStatusUpdate?.('Memeriksa status konektivitas live ke server database Firestore...');
    const connStart = Date.now();
    const connStatus = await checkFirestoreConnectionStatus();
    const connDuration = Date.now() - connStart;

    if (!connStatus.online) {
      if (connStatus.quotaExceeded) {
        logDeep(
          'STATUS_KONEKSI_FIRESTORE',
          'Batas Kuota Harian Firebase Tercapai',
          QUOTA_LIMIT_MESSAGE,
          'ERROR',
          connDuration,
          { connStatus }
        );
        throw new Error(QUOTA_LIMIT_MESSAGE);
      }
      logDeep(
        'STATUS_KONEKSI_FIRESTORE',
        'Koneksi Database Firestore Terputus / Offline',
        connStatus.message,
        'ERROR',
        connDuration,
        { connStatus }
      );
      throw new Error(`Koneksi database Firestore terputus (${connStatus.message}). Periksa koneksi internet.`);
    }

    logDeep(
      'STATUS_KONEKSI_FIRESTORE',
      'Status Koneksi Firestore Aktif & Terhubung',
      connStatus.message,
      'SUCCESS',
      connDuration,
      { online: true, latencyMs: connStatus.latencyMs }
    );

    // -------------------------------------------------------------
    // LANGKAH 2: VALIDASI KEUNIKAN NOMOR KTP (NIK) & CEK TEMPDATALAMA
    // -------------------------------------------------------------
    onStatusUpdate?.('Memvalidasi keunikan Nomor KTP (NIK) di database...');
    const nikStart = Date.now();
    const nikCheck = await checkNikAvailability(cleanNik);
    const nikDuration = Date.now() - nikStart;

    if (nikCheck.status === 'exists_in_members' && nikCheck.member) {
      const msg = `Nomor KTP/NIK ${cleanNik} sudah terdaftar aktif atas nama "${nikCheck.member.nama}" (ID Anggota: ${nikCheck.member.id}). Nomor KTP harus unik dan tidak dapat didaftarkan ganda.`;
      logDeep('VALIDASI_UNIK_NIK_ID', 'Nomor KTP (NIK) Sudah Terdaftar Aktif', msg, 'ERROR', nikDuration);
      throw new Error(msg);
    }

    if (nikCheck.status === 'exists_in_tempdatalama' && nikCheck.member) {
      const msg = `NIK_IN_TEMPDATALAMA::Data dengan Nomor KTP ${cleanNik} pernah terdaftar atas nama "${nikCheck.member.nama}" (ID: ${nikCheck.member.id}) yang telah terhapus. Silakan pilih opsi kembalikan data lama.`;
      logDeep('VALIDASI_UNIK_NIK_ID', 'Nomor KTP Ditemukan di Arsip tempdatalama', msg, 'WARN', nikDuration);
      throw new Error(msg);
    }

    // -------------------------------------------------------------
    // LANGKAH 3: ALOKASI ID ANGGOTA UNIK DARI SERVER (ANTI-TIMPA & MONOTONIK)
    // -------------------------------------------------------------
    onStatusUpdate?.('Mengalokasikan Nomor ID Anggota unik dari server Firestore...');
    const idStart = Date.now();
    const localMembers = getStoredMembers();
    const localTempMembers = getStoredTempDataLama();

    assignedId = await allocateUniqueMemberIdFromServer(
      data.kepalaKeluargaId,
      localMembers,
      localTempMembers
    );
    const idDuration = Date.now() - idStart;

    logDeep(
      'INISIALISASI',
      'Alokasi Primary Key ID Anggota Unik & Anti-Timpa',
      `ID Unik: ${assignedId}, Nama: "${data.nama}", Peran: ${roleText}, NIK: ${nikMasked}, No. KK: ${data.noKk}`,
      'SUCCESS',
      idDuration,
      { assignedId, nama: data.nama, role: roleText, noKk: data.noKk, nikMasked }
    );

    // -------------------------------------------------------------
    // LANGKAH 4: PRE-FLIGHT KOMPRESI LAMPIRAN & KALKULASI UKURAN PAYLOAD
    // -------------------------------------------------------------
    const step3Start = Date.now();
    onStatusUpdate?.('Memeriksa & mengompresi berkas lampiran (Pas Foto, KTP, KK)...');

    let compressedFoto = data.fotoUrl;
    let compressedKtp = data.ktpUrl;
    let compressedKk = data.kkUrl;

    try {
      if (data.fotoUrl) {
        compressedFoto = await compressImage(data.fotoUrl, { maxDimension: 600, quality: 0.72 });
      }
      if (data.ktpUrl) {
        compressedKtp = await compressImage(data.ktpUrl, { maxDimension: 800, quality: 0.75 });
      }
      if (data.kkUrl) {
        compressedKk = await compressImage(data.kkUrl, { maxDimension: 800, quality: 0.75 });
      }
    } catch (compErr: any) {
      console.warn(`[Trace:${traceId}] Image compression note:`, compErr);
    }

    const now = new Date().toISOString();
    const initialStatus = data.status || 'menunggu';

    let newMember: Member = {
      ...data,
      nik: cleanNik,
      id: assignedId,
      fotoUrl: compressedFoto,
      ktpUrl: compressedKtp,
      kkUrl: compressedKk,
      status: initialStatus,
      tanggalDaftar: now,
      tanggalDisetujui: initialStatus === 'disetujui' ? now : undefined,
    };

    if (data.peranKeluarga === 'kepala_keluarga') {
      newMember.jumlahKeluarga = data.jumlahKeluarga || 1;
    }

    let payloadBytes = 0;
    try {
      payloadBytes = new Blob([JSON.stringify(newMember)]).size;
      payloadKB = Math.round((payloadBytes / 1024) * 10) / 10;
    } catch {
      payloadKB = 50;
      payloadBytes = 51200;
    }

    const step3Duration = Date.now() - step3Start;
    logDeep(
      'PRE_FLIGHT_KOMPRESI',
      'Kompresi Dokumen & Kalkulasi Ukuran Payload',
      `Ukuran total dokumen: ${payloadKB} KB (${payloadBytes} bytes). Jauh di bawah batas 1024 KB Firestore.`,
      'SUCCESS',
      step3Duration,
      { payloadSizeKB: payloadKB, payloadBytes }
    );

    // -------------------------------------------------------------
    // LANGKAH 5: PENULISAN DATA KE KOLEKSI 'members' (DENGAN COLLISION GUARD)
    // -------------------------------------------------------------
    const step4Start = Date.now();
    onStatusUpdate?.('Mengirimkan data anggota ke koleksi "members" Firestore...');

    let writeResult;
    try {
      writeResult = await saveMemberWithRetryAndConfirmation(
        newMember,
        5,
        (status) => onStatusUpdate?.(`[Trace: ${traceId}] ${status}`),
        traceId,
        { preventOverwrite: true }
      );
    } catch (writeErr: any) {
      // Jika terjadi benturan ID secara bersamaan dari perangkat lain, alokasikan ID baru dan simpan ulang tanpa menimpa data lama!
      if (String(writeErr?.message || '').includes('ID_COLLISION_GUARD')) {
        assignedId = await allocateUniqueMemberIdFromServer(
          data.kepalaKeluargaId,
          getStoredMembers(),
          getStoredTempDataLama()
        );
        newMember = { ...newMember, id: assignedId };
        writeResult = await saveMemberWithRetryAndConfirmation(
          newMember,
          5,
          (status) => onStatusUpdate?.(`[Trace: ${traceId}] ${status}`),
          traceId,
          { preventOverwrite: true }
        );
      } else {
        throw writeErr;
      }
    }

    const step4Duration = Date.now() - step4Start;
    logDeep(
      'PENULISAN_DATA_MEMBERS',
      'Penulisan Dokumen ke Koleksi members',
      `Penulisan dokumen "${newMember.nama}" (ID: ${newMember.id}, Status: ${newMember.status}) berhasil pada percobaan ke-${writeResult.totalAttempts} dalam ${writeResult.totalDurationMs}ms`,
      'SUCCESS',
      step4Duration,
      { attempts: writeResult.totalAttempts, totalDurationMs: writeResult.totalDurationMs, memberId: newMember.id }
    );

    // -------------------------------------------------------------
    // LANGKAH 6: MEKANISME PENGECEKAN (POLLING) 3 DETIK DI KOLEKSI 'members'
    // -------------------------------------------------------------
    onStatusUpdate?.('Menjalankan mekanisme verifikasi polling 3 detik ke koleksi "members"...');
    const step5Start = Date.now();

    const pollingResult = await pollVerifyMemberInMembersCollection3Seconds(
      newMember.id,
      { nama: newMember.nama, nik: newMember.nik, status: newMember.status },
      onStatusUpdate
    );

    const step5Duration = Date.now() - step5Start;

    if (!pollingResult.verified) {
      logDeep(
        'POLLING_3_DETIK_VERIFIKASI',
        'Polling 3 Detik: Gagal Membaca Data di Koleksi members',
        pollingResult.error || 'Data tidak terbaca di koleksi members Firestore setelah polling 3 detik.',
        'ERROR',
        step5Duration,
        { pollingResult }
      );
      throw new Error(pollingResult.error || `Data anggota "${newMember.nama}" (ID: ${newMember.id}) belum terbaca di koleksi members setelah polling 3 detik.`);
    }

    logDeep(
      'POLLING_3_DETIK_VERIFIKASI',
      'Polling 3 Detik: Data Terbaca Sempurna di Koleksi members',
      `Data dipastikan 100% terbaca dari server Firestore setelah ${pollingResult.totalPolls} kali siklus polling selama ${pollingResult.totalDurationMs}ms.`,
      'SUCCESS',
      step5Duration,
      { totalPolls: pollingResult.totalPolls, durationMs: pollingResult.totalDurationMs }
    );

    // -------------------------------------------------------------
    // LANGKAH 6b: PENYIMPANAN KE TEMPAT TAMPUNG SEMENTARA MENUNGGU PERSETUJUAN ADMIN ('tempdatamenunggu')
    // Jika pendaftaran berstatus 'menunggu', simpan juga ke koleksi khusus 'tempdatamenunggu'
    // agar data pendaftar 100% aman di tempat tampung tunggu dan selalu tampil di tab Menunggu Admin.
    // -------------------------------------------------------------
    if (newMember.status === 'menunggu') {
      onStatusUpdate?.('Menyimpan data ke tempat tampung sementara menunggu persetujuan admin ("tempdatamenunggu")...');
      await saveToTempDataMenungguFirestore(newMember);
      const currentWaiting = getStoredTempDataMenunggu();
      saveTempDataMenunggu([newMember, ...currentWaiting.filter(w => w.id !== newMember.id)]);
    }

    // -------------------------------------------------------------
    // LANGKAH 7: KONFIRMASI PENULISAN DATA BERHASIL & MASUK DAFTAR TUNGGU ADMIN
    // -------------------------------------------------------------
    logDeep(
      'KONFIRMASI_BERHASIL',
      'Konfirmasi Penulisan Data Berhasil 100%',
      `Integritas dokumen terverifikasi utuh di Firestore (members${newMember.status === 'menunggu' ? ' & tempdatamenunggu' : ''}): ${newMember.nama} (ID: ${newMember.id}, Status: ${newMember.status})`,
      'SUCCESS',
      0,
      { memberId: newMember.id, nama: newMember.nama, status: newMember.status }
    );

    const step7Start = Date.now();
    const freshMembers = getStoredMembers();
    const updated = [newMember, ...freshMembers.filter(m => m.id !== newMember.id)];
    saveMembers(updated);
    soundEffects.playPing();
    const step7Duration = Date.now() - step7Start;

    logDeep(
      'SINKRONISASI_LOCAL_STATE',
      'Masuk ke Halaman Admin (Tab Menunggu) & Cache Lokal',
      `Data anggota "${newMember.nama}" (ID: ${newMember.id}) telah masuk ke daftar anggota status "${newMember.status}". Total anggota: ${updated.length}`,
      'SUCCESS',
      step7Duration,
      { totalMembers: updated.length, status: newMember.status }
    );

    // -------------------------------------------------------------
    // LANGKAH 8: PEMBUATAN DOKUMEN NOTIFIKASI DI FIRESTORE 'notifications'
    // BARU KEMUDIAN DIKIRIMKAN KE APLIKASI
    // -------------------------------------------------------------
    const step8Start = Date.now();
    onStatusUpdate?.('Membuat data notifikasi pada tabel "notifications" di Firestore...');

    const notification = await addNotificationAsync(
      buildNotificationPayloadFromMember(newMember, {
        type: newMember.status === 'disetujui' ? 'status_approved' : 'new_registration',
        message:
          newMember.status === 'disetujui'
            ? `Anggota baru "${newMember.nama}" (ID: ${newMember.id}, ${roleText}) telah ditambahkan dan langsung disetujui.`
            : `Pendaftaran baru: "${newMember.nama}" (ID: ${newMember.id}) sebagai ${roleText} telah masuk ke database dan menunggu persetujuan pengurus/admin.`,
      })
    );

    triggerSystemNotification('Pendaftaran Baru Masuk', `Nama: ${newMember.nama} (ID: ${newMember.id} - ${roleText})`);

    broadcastRealtime({
      type: 'NEW_REGISTRATION',
      payload: {
        member: newMember,
        notification,
      },
    });

    const step8Duration = Date.now() - step8Start;
    logDeep(
      'PENERBITAN_NOTIFIKASI_ADMIN',
      'Notifikasi Tersimpan di Koleksi notifications & Diterbitkan ke Aplikasi',
      `Notifikasi berhasil disimpan di Firestore notifications & dikirim ke aplikasi (Notif ID: ${notification.id})`,
      'SUCCESS',
      step8Duration,
      { notificationId: notification.id }
    );

    // -------------------------------------------------------------
    // PENYELESAIAN AUDIT TRACE
    // -------------------------------------------------------------
    const totalDurationMs = Date.now() - overallStartTime;
    const finalTrace: RegistrationTrace = {
      traceId,
      memberId: assignedId,
      nama: newMember.nama,
      nikMasked,
      role: roleText,
      timestamp: new Date().toISOString(),
      payloadSizeKB: payloadKB,
      steps: traceSteps,
      totalDurationMs,
      success: true,
    };
    saveRegistrationTrace(finalTrace);

    console.log(`[Trace:${traceId}] SUKSES PARIPURNA: "${newMember.nama}" (ID: ${assignedId}) terdaftar & diverifikasi polling 3 detik dalam ${totalDurationMs}ms!`);
    console.groupEnd();

    return newMember;
  } catch (error: any) {
    const totalDurationMs = Date.now() - overallStartTime;
    const errorMsg = error?.message || String(error);

    logDeep(
      'ERROR_PENDAFTARAN',
      'Kegagalan Proses Pendaftaran',
      errorMsg,
      'ERROR',
      Date.now() - overallStartTime,
      { error: errorMsg }
    );

    const failedTrace: RegistrationTrace = {
      traceId,
      memberId: assignedId || 'NOT_ALLOCATED',
      nama: data.nama,
      nikMasked,
      role: roleText,
      timestamp: new Date().toISOString(),
      payloadSizeKB: payloadKB,
      steps: traceSteps,
      totalDurationMs,
      success: false,
      error: errorMsg,
    };
    saveRegistrationTrace(failedTrace);

    console.error(`[Trace:${traceId}] GAGAL PENDAFTARAN:`, error);
    console.groupEnd();

    if (errorMsg.startsWith('NIK_IN_TEMPDATALAMA::')) {
      throw new Error(errorMsg.replace('NIK_IN_TEMPDATALAMA::', ''));
    }

    let userFriendlyMsg = 'Gagal menyimpan dan memverifikasi data di database server.';
    if (isFirestoreQuotaError(error)) {
      notifyQuotaLimitExceeded(errorMsg);
      userFriendlyMsg = QUOTA_LIMIT_MESSAGE;
      throw new Error(userFriendlyMsg);
    } else if (errorMsg.includes('the client is offline') || errorMsg.includes('unavailable')) {
      userFriendlyMsg = 'Koneksi ke database server terputus atau perangkat sedang offline. Mohon periksa koneksi internet Anda.';
    } else if (errorMsg.includes('exceeds the limit')) {
      userFriendlyMsg = 'Ukuran lampiran foto terlalu besar. Silakan gunakan foto yang berukuran wajar.';
    } else if (errorMsg) {
      userFriendlyMsg = `${errorMsg}`;
    }

    throw new Error(userFriendlyMsg);
  }
}

export function addNewMember(
  data: Omit<Member, 'id' | 'tanggalDaftar' | 'status'> & { status?: MemberStatus }
): Member {
  const members = getStoredMembers();
  const maxNum = members.reduce((max, m) => {
    const root = m.id.split('-')[0];
    const num = parseInt(root, 10);
    return !isNaN(num) && num > max ? num : max;
  }, 131);

  let nextId = String(maxNum + 1).padStart(4, '0');
  if (data.kepalaKeluargaId) {
    const count = members.filter(m => m.kepalaKeluargaId === data.kepalaKeluargaId || m.id === data.kepalaKeluargaId).length;
    nextId = `${data.kepalaKeluargaId}-${count + 1}`;
  }

  const now = new Date().toISOString();
  const initialStatus = data.status || 'menunggu';

  const newMember: Member = {
    ...data,
    id: nextId,
    status: initialStatus,
    tanggalDaftar: now,
    tanggalDisetujui: initialStatus === 'disetujui' ? now : undefined,
  };

  if (data.peranKeluarga === 'kepala_keluarga') {
    newMember.jumlahKeluarga = data.jumlahKeluarga || 1;
  }

  addNewMemberAsync(data).catch(err => {
    console.error('Async member save note:', err);
  });

  return newMember;
}

export async function updateMemberAsync(updatedMember: Member): Promise<Member> {
  // Validasi keunikan NIK terhadap anggota aktif lainnya
  const cleanNik = (updatedMember.nik || '').trim().replace(/\D/g, '');
  const nikCheck = await checkNikAvailability(cleanNik, updatedMember.id);
  if (nikCheck.status === 'exists_in_members' && nikCheck.member) {
    throw new Error(
      `Nomor KTP/NIK ${cleanNik} sudah terdaftar pada anggota lain atas nama "${nikCheck.member.nama}" (ID: ${nikCheck.member.id}).`
    );
  }

  let compressedFoto = updatedMember.fotoUrl;
  let compressedKtp = updatedMember.ktpUrl;
  let compressedKk = updatedMember.kkUrl;

  try {
    if (updatedMember.fotoUrl && updatedMember.fotoUrl.startsWith('data:image')) {
      compressedFoto = await compressImage(updatedMember.fotoUrl, { maxDimension: 600, quality: 0.72 });
    }
    if (updatedMember.ktpUrl && updatedMember.ktpUrl.startsWith('data:image')) {
      compressedKtp = await compressImage(updatedMember.ktpUrl, { maxDimension: 800, quality: 0.75 });
    }
    if (updatedMember.kkUrl && updatedMember.kkUrl.startsWith('data:image')) {
      compressedKk = await compressImage(updatedMember.kkUrl, { maxDimension: 800, quality: 0.75 });
    }
  } catch (err) {
    console.warn('Image compression warning on update:', err);
  }

  const finalMember: Member = {
    ...updatedMember,
    nik: cleanNik || updatedMember.nik,
    fotoUrl: compressedFoto,
    ktpUrl: compressedKtp,
    kkUrl: compressedKk,
  };

  try {
    await saveMemberWithRetryAndConfirmation(finalMember, 4, undefined, 'UPD-' + finalMember.id);
    if (finalMember.status === 'menunggu') {
      await saveToTempDataMenungguFirestore(finalMember);
      const curW = getStoredTempDataMenunggu();
      saveTempDataMenunggu([finalMember, ...curW.filter(w => w.id !== finalMember.id)]);
    } else {
      await deleteFromTempDataMenungguFirestore(finalMember.id);
      const curW = getStoredTempDataMenunggu();
      saveTempDataMenunggu(curW.filter(w => w.id !== finalMember.id));
    }
  } catch (err: any) {
    if (isFirestoreQuotaError(err)) {
      notifyQuotaLimitExceeded(err?.message || String(err));
      throw new Error(QUOTA_LIMIT_MESSAGE);
    }
    throw err;
  }

  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === finalMember.id);
  if (index !== -1) {
    members[index] = finalMember;
    saveMembers(members);
  } else {
    saveMembers([finalMember, ...members]);
  }

  const currentSession = getCurrentUserSession();
  if (currentSession && currentSession.id === finalMember.id) {
    setCurrentUserSession(finalMember);
  }

  broadcastRealtime({
    type: 'DATA_SYNC',
    payload: { member: finalMember },
  });

  return finalMember;
}

export function updateMember(updatedMember: Member): void {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
    members[index] = updatedMember;
    saveMembers(members);

    saveMemberToFirestore(updatedMember).catch(err => {
      console.warn('Firestore update member sync note:', err);
    });

    const currentSession = getCurrentUserSession();
    if (currentSession && currentSession.id === updatedMember.id) {
      setCurrentUserSession(updatedMember);
    }

    broadcastRealtime({
      type: 'DATA_SYNC',
      payload: { member: updatedMember },
    });
  }
}

/**
 * Menghapus anggota dari koleksi aktif `members`, namun terlebih dahulu memindahkannya
 * ke tabel / koleksi sementara `tempdatalama` agar dapat dikembalikan sewaktu-waktu,
 * serta mencatat ID-nya ke counter sistem agar nomor ID tersebut TIDAK PERNAH dipakai ulang.
 */
export async function deleteMemberAsync(id: string, reason?: string): Promise<void> {
  const members = getStoredMembers();
  let target = members.find(m => m.id === id);

  if (target) {
    try {
      const idbMembers = await loadMembersFromIndexedDB();
      const idbMatch = idbMembers?.find(m => m.id === id);
      if (idbMatch) {
        target = {
          ...idbMatch,
          ...target,
          fotoUrl: target.fotoUrl || idbMatch.fotoUrl || '',
          ktpUrl: target.ktpUrl || idbMatch.ktpUrl || '',
          kkUrl: target.kkUrl || idbMatch.kkUrl || '',
        };
      }
    } catch {}

    const archivedMember: Member = {
      id: target.id,
      regNumber: target.regNumber || '',
      nik: target.nik || '',
      nama: target.nama || '',
      tempatTanggalLahir: target.tempatTanggalLahir || '',
      alamat: target.alamat || '',
      noHp: target.noHp || '',
      noKk: target.noKk || '',
      peranKeluarga: target.peranKeluarga || 'kepala_keluarga',
      kepalaKeluargaId: target.kepalaKeluargaId || '',
      namaKepalaKeluarga: target.namaKepalaKeluarga || '',
      jumlahKeluarga: typeof target.jumlahKeluarga === 'number' ? target.jumlahKeluarga : (target.peranKeluarga === 'kepala_keluarga' ? 1 : 0),
      email: target.email || '',
      fotoUrl: target.fotoUrl || '',
      fotoName: target.fotoName || '',
      ktpUrl: target.ktpUrl || '',
      ktpName: target.ktpName || '',
      kkUrl: target.kkUrl || '',
      kkName: target.kkName || '',
      status: target.status || 'disetujui',
      catatanPenolakan: target.catatanPenolakan || '',
      tanggalDaftar: target.tanggalDaftar || new Date().toISOString(),
      tanggalDisetujui: target.tanggalDisetujui || '',
      deletedAt: new Date().toISOString(),
      deletedReason: reason || 'Dihapus oleh Admin (Tersimpan lengkap di tempdatalama)',
    };

    // 1. Simpan ke koleksi 'tempdatalama' di Firestore & lokal beserta semua field lengkapnya
    const currentTemp = getStoredTempDataLama();
    const updatedTemp = [
      archivedMember,
      ...currentTemp.filter(m => m.id !== archivedMember.id && m.nik !== archivedMember.nik),
    ];
    saveTempDataLama(updatedTemp);

    try {
      await saveToTempDataLamaFirestore(archivedMember);
    } catch (err) {
      console.warn('Firestore saveToTempDataLama note:', err);
    }
  } else {
    // Tetap pastikan ID tercatat sebagai sudah pernah digunakan agar tidak dipakai ulang
    await recordAllocatedIdInCounter(id);
  }

  // 2. Hapus dari koleksi aktif 'members' dan tempat tampung tunggu 'tempdatamenunggu'
  const filtered = members.filter(m => m.id !== id);
  saveMembers(filtered);

  const currentWaiting = getStoredTempDataMenunggu();
  saveTempDataMenunggu(currentWaiting.filter(w => w.id !== id));

  try {
    await Promise.all([
      deleteMemberFromFirestore(id),
      deleteFromTempDataMenungguFirestore(id),
    ]);
  } catch (err) {
    console.warn('Firestore delete member note:', err);
  }
}

export function deleteMember(id: string): void {
  deleteMemberAsync(id).catch(err => {
    console.warn('Async deleteMember note:', err);
  });
}

export function resetToInitialData(): void {
  // Jangan pernah menyuntikkan kembali INITIAL_MEMBERS (data dummy) ke Firestore!
  // Cukup muat ulang data murni dari server Firestore agar konsisten.
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function getPeranLabel(role: FamilyRole): string {
  switch (role) {
    case 'kepala_keluarga':
      return 'Kepala Keluarga';
    case 'istri':
      return 'Istri';
    case 'anak':
      return 'Anak';
    default:
      return 'Anggota';
  }
}

export function getInitials(name: string): string {
  if (!name) return 'AI';
  const clean = name.trim().replace(/[^a-zA-Z\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AI';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function maskNik(nik: string): string {
  if (!nik) return '••••••••••••••••';
  const clean = nik.replace(/\D/g, '');
  if (clean.length <= 6) return clean;
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  return `${prefix}••••••${suffix}`;
}

export function maskKk(kk?: string): string {
  if (!kk) return '••••••••••••••••';
  const clean = kk.replace(/\D/g, '');
  if (clean.length <= 6) return '••••••••••••••••';
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  return `${prefix}••••••${suffix}`;
}

export function maskPhoneNumber(phone: string): string {
  if (!phone) return '••••••••••••';
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) return clean;
  return clean.slice(0, 4) + '••••' + clean.slice(-4);
}

export function formatIndonesianDate(isoOrDateString?: string): string {
  if (!isoOrDateString) {
    const today = new Date();
    return today.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  const date = new Date(isoOrDateString);
  if (isNaN(date.getTime())) return isoOrDateString;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Memformat tanggal & jam detail dalam Bahasa Indonesia (contoh: "5 November 2026, Pukul 13.50.07 WITA").
 * Jika string utama hanya berisi tanggal YYYY-MM-DD tanpa jam, otomatis menggabungkan jam dari fallbackIso jika tersedia.
 */
export function formatIndonesianDateTime(isoOrDateString?: string, fallbackIso?: string): string {
  const source = isoOrDateString || fallbackIso;
  if (!source) {
    const now = new Date();
    const dStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const tStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${dStr}, Pukul ${tStr} WITA`;
  }

  let dateObj = new Date(source);
  if (isNaN(dateObj.getTime())) return source;

  // Jika source hanya YYYY-MM-DD (tanpa komponen jam 'T') dan ada fallbackIso yang memiliki jam
  if (!source.includes('T') && fallbackIso && fallbackIso.includes('T')) {
    const fallbackDate = new Date(fallbackIso);
    if (!isNaN(fallbackDate.getTime())) {
      dateObj.setHours(fallbackDate.getHours(), fallbackDate.getMinutes(), fallbackDate.getSeconds());
    }
  }

  const datePart = dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = dateObj.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return `${datePart}, Pukul ${timePart} WITA`;
}

// ==========================================
// MANAJEMEN KEGIATAN & PRESENSI SCAN QR
// ==========================================

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'ACT-2026-001',
    judul: 'Rapat Pleno Pengurus Yayasan Triwulan IV',
    jenis: 'rapat_pengurus',
    tanggal: '2026-10-25',
    jamMulai: '19:30',
    jamSelesai: '22:00',
    lokasi: 'Aula Utama Gedung Yayasan Al Ikhlas Sembilan Satu Dalung',
    deskripsi: 'Evaluasi program kerja semester berjalan, laporan keuangan yayasan, dan pembahasan persiapan haul akbar.',
    pesertaIds: ['0114', '0115', '0116', '0130', '0131'],
    kehadiran: [
      {
        memberId: '0114',
        memberNama: 'Margo Suwito Utomo',
        memberNik: '5103051205780001',
        memberPeran: 'kepala_keluarga',
        scanTimestamp: '2026-10-25T19:25:00.000Z',
        scanTimeFormatted: '19:25 WITA',
        activityId: 'ACT-2026-001',
        activityTitle: 'Rapat Pleno Pengurus Yayasan Triwulan IV',
        activityType: 'rapat_pengurus',
      }
    ],
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z',
  },
  {
    id: 'ACT-2026-002',
    judul: 'Pengajian Rutin Bulanan & Doa Bersama Warga',
    jenis: 'pengajian_umum',
    tanggal: '2026-10-28',
    jamMulai: '18:30',
    jamSelesai: '21:00',
    lokasi: 'Masjid Al Ikhlas Dalung Permai',
    deskripsi: 'Kajian kitab Riyadhus Shalihin bersama Ustadz dan ramah tamah seluruh keluarga anggota Yayasan.',
    pesertaIds: ['0114', '0114-1', '0114-2', '0115', '0115-1', '0116', '0130', '0130-2', '0131'],
    kehadiran: [],
    createdAt: '2026-10-21T09:00:00.000Z',
    updatedAt: '2026-10-21T09:00:00.000Z',
  },
  {
    id: 'ACT-2026-003',
    judul: 'Arisan Silaturahmi Bulanan Keluarga Al Ikhlas',
    jenis: 'arisan',
    tanggal: '2026-11-05',
    jamMulai: '16:00',
    jamSelesai: '18:00',
    lokasi: 'Kediaman Bpk. Margo Suwito Utomo, Perum Kodam Blok G No. 3',
    deskripsi: 'Pertemuan silaturahmi berkala, penarikan arisan putaran November, dan diskusi santai keluarga.',
    pesertaIds: ['0114', '0114-1', '0115', '0115-1', '0116', '0130', '0130-2', '0131'],
    kehadiran: [],
    createdAt: '2026-10-21T10:00:00.000Z',
    updatedAt: '2026-10-21T10:00:00.000Z',
  }
];

let inMemoryActivities: Activity[] | null = null;
let inMemoryTempKegiatanLama: Activity[] | null = null;

export function getStoredTempKegiatanLama(): Activity[] {
  if (inMemoryTempKegiatanLama) {
    return inMemoryTempKegiatanLama;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_TEMP_KEGIATAN_LAMA_KEY);
    const parsed: Activity[] = raw ? JSON.parse(raw) : [];
    inMemoryTempKegiatanLama = parsed;
    return parsed;
  } catch {
    return [];
  }
}

export function saveTempKegiatanLama(deletedActivities: Activity[]): void {
  inMemoryTempKegiatanLama = deletedActivities;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_TEMP_KEGIATAN_LAMA_KEY, JSON.stringify(deletedActivities));
  } catch (err) {
    console.warn('Error saving tempkegiatanlama to localStorage:', err);
  }
}

export function getStoredActivities(): Activity[] {
  if (inMemoryActivities) {
    return inMemoryActivities;
  }
  if (typeof window === 'undefined') return INITIAL_ACTIVITIES;
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVITIES_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(INITIAL_ACTIVITIES));
      inMemoryActivities = INITIAL_ACTIVITIES;
      return INITIAL_ACTIVITIES;
    }
    const parsed: Activity[] = JSON.parse(raw);
    inMemoryActivities = parsed;
    return parsed;
  } catch (err) {
    console.error('Error reading activities from localStorage:', err);
    return inMemoryActivities || INITIAL_ACTIVITIES;
  }
}

export function saveActivities(activities: Activity[]): void {
  inMemoryActivities = activities;
  if (typeof window === 'undefined') return;
  try {
    // Strip heavy base64 images inside kehadiran before saving to localStorage
    const lightweight = activities.map(act => ({
      ...act,
      kehadiran: Array.isArray(act.kehadiran)
        ? act.kehadiran.map(k => ({
            ...k,
            memberFotoUrl: k.memberFotoUrl && k.memberFotoUrl.startsWith('data:') && k.memberFotoUrl.length > 5000 ? '' : k.memberFotoUrl,
          }))
        : [],
    }));
    localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(lightweight));
    broadcastRealtime({
      type: 'DATA_SYNC',
      payload: { member: {} as any },
    });
  } catch (err) {
    console.error('Error saving activities to localStorage:', err);
  }
}

/**
 * Menggabungkan (reconcile) seluruh jadwal kegiatan dari server Firestore `activities` dan `localStorage` perangkat ini:
 * - Menjamin mengapa sebelumnya di laptop ada 3, laptop admin lain ada 4, HP admin ada 3, dan HP user ada 1 langsung tersinkronisasi 100% menjadi daftar yang SAMA di semua perangkat.
 * - Jika ada jadwal lokal di perangkat yang belum ada di server Firestore (dan belum pernah dihapus di `tempkegiatanlama`), otomatis di-push ke Firestore.
 * - Jika terjadi benturan ID (2 kegiatan berbeda memiliki ID yang sama karena sistem lama memakai `activities.length + 1`), otomatis memberikan ID unik baru `ACT-2026-NNN` pada jadwal yang bertabrakan tanpa menimpa/menghilangkan salah satunya!
 * - Menggabungkan daftar peserta (`pesertaIds`) dan presensi (`kehadiran`) secara utuh tanpa duplikasi.
 */
export async function reconcileAuthoritativeActivities(
  remoteActivities?: Activity[],
  remoteDeletedActivities?: Activity[]
): Promise<{
  activities: Activity[];
  pushedCount: number;
  resolvedCollisionIds: string[];
}> {
  const firestoreActs = remoteActivities ?? (await fetchActivitiesFromFirestore());
  const deletedActs = remoteDeletedActivities ?? (await fetchTempKegiatanLamaFromFirestore());
  if (deletedActs.length > 0) {
    saveTempKegiatanLama(deletedActs);
  }

  const localActs = getStoredActivities();
  const deletedIds = new Set(deletedActs.map(d => d.id));
  const deletedTitlesDates = new Set(
    deletedActs.map(d => `${(d.judul || '').toLowerCase().trim()}__${d.tanggal}`)
  );

  const mergedById = new Map<string, Activity>();
  const toPushToFirestore: Activity[] = [];
  const resolvedCollisionIds: string[] = [];

  // Hitung nomor ID tertinggi yang sudah ada di server & arsip
  let maxSeqNum = 3;
  const registerNum = (id?: string) => {
    const n = parseActivityNumber(id);
    if (n > maxSeqNum) maxSeqNum = n;
  };
  firestoreActs.forEach(a => registerNum(a.id));
  deletedActs.forEach(a => registerNum(a.id));
  localActs.forEach(a => registerNum(a.id));

  // Helper untuk menggabungkan kehadiran & peserta dari 2 versi jadwal yang sama
  const mergeSameActivity = (base: Activity, incoming: Activity): Activity => {
    const pesertaSet = new Set<string>([
      ...(Array.isArray(base.pesertaIds) ? base.pesertaIds : []),
      ...(Array.isArray(incoming.pesertaIds) ? incoming.pesertaIds : []),
    ]);

    const kehadiranMap = new Map<string, ActivityAttendee>();
    (Array.isArray(base.kehadiran) ? base.kehadiran : []).forEach(k => {
      if (k && k.memberId) kehadiranMap.set(k.memberId, k);
    });
    (Array.isArray(incoming.kehadiran) ? incoming.kehadiran : []).forEach(k => {
      if (k && k.memberId && !kehadiranMap.has(k.memberId)) {
        kehadiranMap.set(k.memberId, k);
      }
    });

    const baseTime = new Date(base.updatedAt || base.createdAt || 0).getTime();
    const incTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
    const newer = incTime > baseTime ? incoming : base;

    return {
      ...base,
      ...newer,
      id: base.id,
      pesertaIds: Array.from(pesertaSet),
      kehadiran: Array.from(kehadiranMap.values()),
      updatedAt: new Date(Math.max(baseTime, incTime, Date.now())).toISOString(),
    };
  };

  // 1. Masukkan seluruh kegiatan resmi dari Firestore (kecuali yang sudah ada di tempkegiatanlama)
  for (const rAct of firestoreActs) {
    if (!rAct || !rAct.id) continue;
    if (deletedIds.has(rAct.id)) continue;
    mergedById.set(rAct.id, rAct);
  }

  // 2. Periksa kegiatan yang ada di perangkat lokal (atau INITIAL_ACTIVITIES jika belum pernah disinkronkan)
  const candidateLocalList =
    firestoreActs.length === 0 && localActs.length === 0 ? INITIAL_ACTIVITIES : localActs;

  for (const lAct of candidateLocalList) {
    if (!lAct || !lAct.id) continue;
    const sig = `${(lAct.judul || '').toLowerCase().trim()}__${lAct.tanggal}`;

    // Jangan masukkan kembali jika sudah pernah dihapus oleh Admin ke tempkegiatanlama
    if (deletedIds.has(lAct.id) || deletedTitlesDates.has(sig)) {
      continue;
    }

    const existingInMap = mergedById.get(lAct.id);
    if (!existingInMap) {
      // Cek apakah sebenarnya sudah ada di Firestore dengan ID berbeda tetapi judul & tanggal sama
      const sameTitleDateInMap = Array.from(mergedById.values()).find(
        m => m.judul.toLowerCase().trim() === lAct.judul.toLowerCase().trim() && m.tanggal === lAct.tanggal
      );

      if (sameTitleDateInMap) {
        const combined = mergeSameActivity(sameTitleDateInMap, lAct);
        mergedById.set(sameTitleDateInMap.id, combined);
        if (
          combined.kehadiran.length > sameTitleDateInMap.kehadiran.length ||
          combined.pesertaIds.length > sameTitleDateInMap.pesertaIds.length
        ) {
          toPushToFirestore.push(combined);
        }
      } else {
        // Jadwal lokal yang belum ada di server Firestore -> Push ke Firestore agar muncul di semua device!
        mergedById.set(lAct.id, lAct);
        toPushToFirestore.push(lAct);
      }
    } else {
      // ID sama sudah ada di Firestore: cek apakah ini jadwal yang sama atau jadwal berbeda yang mengalami tabrakan ID!
      const isSameSchedule =
        existingInMap.judul.toLowerCase().trim() === lAct.judul.toLowerCase().trim() ||
        (existingInMap.tanggal === lAct.tanggal && existingInMap.jenis === lAct.jenis);

      if (isSameSchedule) {
        const combined = mergeSameActivity(existingInMap, lAct);
        mergedById.set(existingInMap.id, combined);
        if (
          combined.kehadiran.length > existingInMap.kehadiran.length ||
          combined.pesertaIds.length > existingInMap.pesertaIds.length
        ) {
          toPushToFirestore.push(combined);
        }
      } else {
        // TABRAKAN ID TERDETEKSI! (Misal: di device ini ID ACT-2026-003 adalah jadwal baru, sedangkan di server ACT-2026-003 adalah jadwal lain)
        // Berikan ID unik baru yang belum terpakai agar kedua jadwal tetap tersimpan & muncul di semua device!
        const alreadyExistsElsewhere = Array.from(mergedById.values()).some(
          m => m.judul.toLowerCase().trim() === lAct.judul.toLowerCase().trim() && m.tanggal === lAct.tanggal
        );
        if (!alreadyExistsElsewhere) {
          maxSeqNum++;
          let newUniqueId = `ACT-2026-${String(maxSeqNum).padStart(3, '0')}`;
          while (mergedById.has(newUniqueId) || deletedIds.has(newUniqueId)) {
            maxSeqNum++;
            newUniqueId = `ACT-2026-${String(maxSeqNum).padStart(3, '0')}`;
          }
          const reassignedAct: Activity = {
            ...lAct,
            id: newUniqueId,
            kehadiran: (lAct.kehadiran || []).map(k => ({ ...k, activityId: newUniqueId })),
            updatedAt: new Date().toISOString(),
          };
          mergedById.set(newUniqueId, reassignedAct);
          toPushToFirestore.push(reassignedAct);
          resolvedCollisionIds.push(`${lAct.judul} (${lAct.id} -> ${newUniqueId})`);
        }
      }
    }
  }

  const finalActivities = Array.from(mergedById.values()).sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );

  saveActivities(finalActivities);

  // Push jadwal yang belum tersinkron ke Firestore
  let pushedCount = 0;
  for (const actToPush of toPushToFirestore) {
    try {
      await saveActivityToFirestore(actToPush);
      pushedCount++;
    } catch (err) {
      console.warn('Note pushing unsynced activity to Firestore:', actToPush.id, err);
    }
  }

  if (finalActivities.length > 0) {
    const highestNum = finalActivities.reduce((max, a) => {
      const n = parseActivityNumber(a.id);
      return n > max ? n : max;
    }, maxSeqNum);
    recordAllocatedActivityIdInCounter(`ACT-2026-${String(highestNum).padStart(3, '0')}`, highestNum).catch(() => {});
  }

  return {
    activities: finalActivities,
    pushedCount,
    resolvedCollisionIds,
  };
}

export async function addNewActivityAsync(
  data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>
): Promise<Activity> {
  const activities = getStoredActivities();
  const deletedActivities = getStoredTempKegiatanLama();
  const newId = await allocateUniqueActivityIdFromServer(activities, deletedActivities);
  const now = new Date().toISOString();

  const newActivity: Activity = {
    ...data,
    id: newId,
    kehadiran: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveActivityToFirestore(newActivity);

  const latest = [newActivity, ...getStoredActivities().filter(a => a.id !== newId)];
  saveActivities(latest);
  return newActivity;
}

export function addNewActivity(
  data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>
): Activity {
  const activities = getStoredActivities();
  const deletedActivities = getStoredTempKegiatanLama();
  const allKnown = [...activities, ...deletedActivities];
  const maxNum = allKnown.reduce((max, a) => {
    const num = parseActivityNumber(a.id);
    return num > max ? num : max;
  }, 3);

  const newId = `ACT-2026-${String(maxNum + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newActivity: Activity = {
    ...data,
    id: newId,
    kehadiran: [],
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newActivity, ...activities.filter(a => a.id !== newId)];
  saveActivities(updated);

  saveActivityToFirestore(newActivity).catch(err => {
    console.warn('Async saveActivityToFirestore note:', err);
  });

  return newActivity;
}

export async function updateActivityAsync(updated: Activity): Promise<Activity> {
  const now = new Date().toISOString();
  const finalUpdated: Activity = {
    ...updated,
    updatedAt: now,
  };

  await saveActivityToFirestore(finalUpdated);

  const activities = getStoredActivities();
  const idx = activities.findIndex(a => a.id === finalUpdated.id);
  if (idx !== -1) {
    activities[idx] = finalUpdated;
    saveActivities([...activities]);
  } else {
    saveActivities([finalUpdated, ...activities]);
  }
  return finalUpdated;
}

export function updateActivity(updated: Activity): void {
  const now = new Date().toISOString();
  const finalUpdated: Activity = {
    ...updated,
    updatedAt: now,
  };
  const activities = getStoredActivities();
  const idx = activities.findIndex(a => a.id === updated.id);
  if (idx !== -1) {
    activities[idx] = finalUpdated;
    saveActivities([...activities]);
  } else {
    saveActivities([finalUpdated, ...activities]);
  }

  saveActivityToFirestore(finalUpdated).catch(err => {
    console.warn('Async updateActivityToFirestore note:', err);
  });
}

/**
 * Menghapus jadwal kegiatan dari koleksi aktif `activities` dan memindahkannya
 * ke koleksi arsip sementara `tempkegiatanlama` agar dapat dipulihkan oleh Admin sewaktu-waktu,
 * serta mengunci ID kegiatan di `system_counters/activity_id_seq` agar tidak pernah dipakai ulang.
 */
export async function deleteActivityAsync(id: string, reason?: string): Promise<void> {
  const activities = getStoredActivities();
  const target = activities.find(a => a.id === id);

  if (target) {
    const archivedActivity: Activity = {
      ...target,
      deletedAt: new Date().toISOString(),
      deletedReason: reason || 'Agenda dihapus oleh Admin (Tersimpan di tempkegiatanlama)',
    };

    const currentDeleted = getStoredTempKegiatanLama();
    const updatedDeleted = [
      archivedActivity,
      ...currentDeleted.filter(a => a.id !== archivedActivity.id),
    ];
    saveTempKegiatanLama(updatedDeleted);

    try {
      await saveToTempKegiatanLamaFirestore(archivedActivity);
    } catch (err) {
      console.warn('Firestore saveToTempKegiatanLama note:', err);
    }
  } else {
    await recordAllocatedActivityIdInCounter(id);
  }

  const filtered = activities.filter(a => a.id !== id);
  saveActivities(filtered);

  try {
    await deleteActivityFromFirestore(id);
  } catch (err) {
    console.warn('Firestore deleteActivityFromFirestore note:', err);
  }
}

export function deleteActivity(id: string): void {
  deleteActivityAsync(id).catch(err => {
    console.warn('Async deleteActivity note:', err);
  });
}

/**
 * Memulihkan (restore) jadwal kegiatan yang terhapus dari koleksi `tempkegiatanlama`
 * kembali ke koleksi aktif `activities` di Firestore (hanya melalui konfirmasi manual Admin).
 */
export async function restoreActivityFromTempKegiatanLamaAsync(
  deletedActivity: Activity
): Promise<Activity> {
  const activeActivities = getStoredActivities();
  const tempDeleted = getStoredTempKegiatanLama();

  let targetId = deletedActivity.id;
  const idOccupiedByOther = activeActivities.some(
    a => a.id === targetId && a.judul.toLowerCase().trim() !== deletedActivity.judul.toLowerCase().trim()
  );
  if (!targetId || idOccupiedByOther) {
    targetId = await allocateUniqueActivityIdFromServer(activeActivities, tempDeleted);
  }

  const restoredActivity: Activity = {
    ...deletedActivity,
    id: targetId,
    updatedAt: new Date().toISOString(),
  };
  delete (restoredActivity as any).deletedAt;
  delete (restoredActivity as any).deletedReason;

  await saveActivityToFirestore(restoredActivity);

  try {
    await deleteFromTempKegiatanLamaFirestore(deletedActivity.id);
  } catch (err) {
    console.warn('Warning removing restored activity from tempkegiatanlama:', err);
  }

  const updatedDeleted = tempDeleted.filter(a => a.id !== deletedActivity.id);
  saveTempKegiatanLama(updatedDeleted);

  const updatedActive = [
    restoredActivity,
    ...getStoredActivities().filter(a => a.id !== restoredActivity.id),
  ];
  saveActivities(updatedActive);

  soundEffects.playSuccess();
  return restoredActivity;
}

export function recordAttendance(
  activityId: string, 
  member: Member, 
  forceAddToPeserta: boolean = false
): { success: boolean; alreadyAttended: boolean; isNewToPeserta: boolean; attendee?: ActivityAttendee; error?: string } {
  const activities = getStoredActivities();
  const activity = activities.find(a => a.id === activityId);
  if (!activity) {
    return { success: false, alreadyAttended: false, isNewToPeserta: false, error: 'Kegiatan tidak ditemukan.' };
  }

  const already = activity.kehadiran.some(k => k.memberId === member.id);
  if (already) {
    return { success: false, alreadyAttended: true, isNewToPeserta: false, error: 'Anggota sudah tercatat hadir pada kegiatan ini.' };
  }

  const isAlreadyInPeserta = activity.pesertaIds.includes(member.id);
  let isNewToPeserta = false;

  if (!isAlreadyInPeserta) {
    if (!forceAddToPeserta) {
      return { success: false, alreadyAttended: false, isNewToPeserta: true, error: 'NOT_IN_PESERTA_NEED_CONFIRMATION' };
    } else {
      activity.pesertaIds.push(member.id);
      isNewToPeserta = true;
    }
  }

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';

  const attendee: ActivityAttendee = {
    memberId: member.id,
    memberNama: member.nama,
    memberNik: member.nik,
    memberPeran: member.peranKeluarga,
    memberFotoUrl: member.fotoUrl && member.fotoUrl.startsWith('data:') && member.fotoUrl.length > 5000 ? '' : member.fotoUrl,
    scanTimestamp: now.toISOString(),
    scanTimeFormatted: timeFormatted,
    activityId: activity.id,
    activityTitle: activity.judul,
    activityType: activity.jenis,
  };

  activity.kehadiran.unshift(attendee);
  activity.updatedAt = now.toISOString();

  saveActivities(activities);

  // Sinkronkan presensi langsung ke koleksi Firestore 'activities' agar langsung muncul di semua device
  saveActivityToFirestore(activity).catch(err => {
    console.warn('Firestore attendance sync note:', err);
  });

  return { success: true, alreadyAttended: false, isNewToPeserta, attendee };
}

export function getActivityTypeLabel(jenis: ActivityType): string {
  switch (jenis) {
    case 'rapat_pengurus':
      return 'Rapat Pengurus';
    case 'pengajian_umum':
      return 'Pengajian Umum';
    case 'arisan':
      return 'Arisan';
    default:
      return jenis;
  }
}

export function getActivityTypeBadgeClass(jenis: ActivityType): { bg: string; text: string; border: string } {
  switch (jenis) {
    case 'rapat_pengurus':
      return { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' };
    case 'pengajian_umum':
      return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'arisan':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' };
  }
}
