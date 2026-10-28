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
  saveToTempDataLamaFirestore,
  deleteFromTempDataLamaFirestore,
  fetchTempDataLamaFromFirestore,
  fetchMembersFromFirestore,
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
const STORAGE_TEMP_DATA_LAMA_KEY = 'yayasan_alikhlas_tempdatalama_v1';
const STORAGE_NOTIF_KEY = 'yayasan_alikhlas_notifications_v3';
const STORAGE_USER_KEY = 'yayasan_alikhlas_user_session_v3';
const STORAGE_ACTIVITIES_KEY = 'yayasan_alikhlas_activities_v1';
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

// Hydrate in-memory cache from IndexedDB on startup
if (typeof window !== 'undefined') {
  loadMembersFromIndexedDB().then((idbMembers) => {
    if (idbMembers && idbMembers.length > 0) {
      if (!inMemoryMembers || inMemoryMembers.length === 0) {
        inMemoryMembers = idbMembers;
      } else {
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
    }
  }).catch(() => {});

  loadTempDataLamaFromIndexedDB().then((idbTemp) => {
    if (idbTemp && idbTemp.length > 0 && (!inMemoryTempDataLama || inMemoryTempDataLama.length === 0)) {
      inMemoryTempDataLama = idbTemp;
    }
  }).catch(() => {});
}

// Strip heavy base64 strings (> 2KB) exclusively for localStorage to stay well below the 5MB browser quota
function createLightweightMembersForLocalStorage(members: Member[]): Member[] {
  return members.map((m) => {
    const stripped = { ...m };
    if (stripped.fotoUrl && stripped.fotoUrl.startsWith('data:') && stripped.fotoUrl.length > 2000) {
      stripped.fotoUrl = '';
    }
    if (stripped.ktpUrl && stripped.ktpUrl.startsWith('data:') && stripped.ktpUrl.length > 2000) {
      stripped.ktpUrl = '';
    }
    if (stripped.kkUrl && stripped.kkUrl.startsWith('data:') && stripped.kkUrl.length > 2000) {
      stripped.kkUrl = '';
    }
    return stripped;
  });
}

/**
 * Ensures locally cached members always contain 0130 (Agus Subriyanto), 0130-2 (Tutik Maryani), and 0131 (Sriyono, SH.MM)
 * and repairs any local cache where 0130 was overwritten by Sriyono.
 */
export function ensureAgusAndSriyonoInMemberList(list: Member[]): { members: Member[]; changed: boolean } {
  let updated = [...list];
  let changed = false;

  const canonical0130 = INITIAL_MEMBERS.find(m => m.id === '0130')!;
  const canonical0130_2 = INITIAL_MEMBERS.find(m => m.id === '0130-2')!;
  const canonical0131 = INITIAL_MEMBERS.find(m => m.id === '0131')!;

  const idx0130 = updated.findIndex(m => m.id === '0130');
  const idx0131 = updated.findIndex(m => m.id === '0131');

  // If 0130 currently holds Sriyono, move Sriyono to 0131 and restore Agus Subriyanto to 0130
  if (idx0130 !== -1 && updated[idx0130].nama.toLowerCase().includes('sriyono')) {
    const sriyonoFrom0130 = updated[idx0130];
    const movedSriyono: Member = {
      ...canonical0131,
      ...sriyonoFrom0130,
      id: '0131',
      nama: sriyonoFrom0130.nama || 'Sriyono, SH.MM',
      regNumber: sriyonoFrom0130.regNumber
        ? sriyonoFrom0130.regNumber.replace(/0130/g, '0131')
        : canonical0131.regNumber,
      nik: (sriyonoFrom0130.nik && sriyonoFrom0130.nik !== canonical0130.nik)
        ? sriyonoFrom0130.nik
        : canonical0131.nik,
    };

    if (idx0131 !== -1) {
      updated[idx0131] = movedSriyono;
    } else {
      updated.push(movedSriyono);
    }

    const existingTutik = updated.find(m => m.id === '0130-2');
    updated[idx0130] = {
      ...canonical0130,
      noKk: existingTutik?.noKk || canonical0130.noKk,
      alamat: existingTutik?.alamat || canonical0130.alamat,
      kkUrl: existingTutik?.kkUrl || canonical0130.kkUrl,
      kkName: existingTutik?.kkName || canonical0130.kkName,
    };
    changed = true;
  }

  // Ensure 0130 (Agus Subriyanto) exists
  if (!updated.some(m => m.id === '0130')) {
    const existingTutik = updated.find(m => m.id === '0130-2');
    updated.push({
      ...canonical0130,
      noKk: existingTutik?.noKk || canonical0130.noKk,
      alamat: existingTutik?.alamat || canonical0130.alamat,
    });
    changed = true;
  }

  // Ensure 0130-2 (Tutik Maryani) exists and links to 0130 (Agus Subriyanto)
  const idxTutik = updated.findIndex(m => m.id === '0130-2');
  if (idxTutik === -1) {
    updated.push(canonical0130_2);
    changed = true;
  } else if (
    updated[idxTutik].kepalaKeluargaId !== '0130' ||
    updated[idxTutik].namaKepalaKeluarga !== 'Agus Subriyanto'
  ) {
    updated[idxTutik] = {
      ...updated[idxTutik],
      kepalaKeluargaId: '0130',
      namaKepalaKeluarga: 'Agus Subriyanto',
    };
    changed = true;
  }

  // Ensure 0131 (Sriyono, SH.MM) exists
  if (!updated.some(m => m.id === '0131')) {
    updated.push(canonical0131);
    changed = true;
  }

  return { members: updated, changed };
}

export function getStoredMembers(): Member[] {
  if (inMemoryMembers && inMemoryMembers.length > 0) {
    const { members: checked, changed } = ensureAgusAndSriyonoInMemberList(inMemoryMembers);
    if (changed) {
      inMemoryMembers = checked;
    }
    return inMemoryMembers;
  }
  if (typeof window === 'undefined') return INITIAL_MEMBERS;
  try {
    const raw = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (!raw) {
      inMemoryMembers = INITIAL_MEMBERS;
      saveMembers(INITIAL_MEMBERS);
      return INITIAL_MEMBERS;
    }
    const parsed: Member[] = JSON.parse(raw);
    
    let needsUpdate = false;
    const migrated = parsed.map(m => {
      if (!m.fotoUrl || m.fotoUrl.includes('unsplash')) {
        needsUpdate = true;
        if (m.peranKeluarga === 'istri') {
          return { ...m, fotoUrl: SYARI_PHOTOS.istriSitiAminah };
        } else if (m.peranKeluarga === 'anak') {
          return { ...m, fotoUrl: SYARI_PHOTOS.anakRizky10Thn };
        } else {
          return { ...m, fotoUrl: SYARI_PHOTOS.kepalaKeluargaMargo };
        }
      }
      return m;
    });

    const { members: repaired, changed } = ensureAgusAndSriyonoInMemberList(migrated);
    inMemoryMembers = repaired;

    if (needsUpdate || changed) {
      saveMembers(repaired);
    }

    return repaired;
  } catch (e) {
    console.warn('Error reading members from localStorage:', e);
    return inMemoryMembers || INITIAL_MEMBERS;
  }
}

export function saveMembers(members: Member[]): void {
  inMemoryMembers = members;

  if (typeof window === 'undefined') return;

  saveMembersToIndexedDB(members).catch(() => {});

  try {
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
  } catch (e: any) {
    const isQuota = e?.name === 'QuotaExceededError' || e?.message?.includes('exceeded the quota') || e?.code === 22;
    if (isQuota) {
      try {
        localStorage.removeItem(STORAGE_DEEP_LOGS_KEY);
        localStorage.removeItem(STORAGE_REGISTRATION_TRACES_KEY);
      } catch {}

      try {
        localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
        return;
      } catch {}

      try {
        const lightweight = createLightweightMembersForLocalStorage(members);
        localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(lightweight));
      } catch (err2) {
        console.warn('LocalStorage fallback note:', err2);
      }
    } else {
      console.warn('Error saving members to localStorage:', e);
    }
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
 * Memeriksa keunikan Nomor KTP / KIA (NIK) di koleksi aktif `members` dan koleksi arsip `tempdatalama`.
 * - Jika NIK sudah terdaftar di `members`: kembalikan `exists_in_members`.
 * - Jika NIK pernah terdaftar lalu terhapus (ada di `tempdatalama`): kembalikan `exists_in_tempdatalama` beserta datanya.
 */
export async function checkNikAvailability(
  nik: string,
  excludeMemberId?: string
): Promise<NikCheckResult> {
  const cleanNik = (nik || '').trim().replace(/\D/g, '');
  if (!cleanNik) return { status: 'available' };

  // 1. Cek di cache lokal members
  const localMembers = getStoredMembers();
  const foundLocalActive = localMembers.find(
    m => m.nik.replace(/\D/g, '') === cleanNik && m.id !== excludeMemberId
  );
  if (foundLocalActive) {
    return { status: 'exists_in_members', member: foundLocalActive };
  }

  // 2. Cek di server Firestore members untuk kepastian lintas perangkat
  try {
    const remoteMembers = await fetchMembersFromFirestore();
    const foundRemoteActive = remoteMembers.find(
      m => (m.nik || '').replace(/\D/g, '') === cleanNik && m.id !== excludeMemberId
    );
    if (foundRemoteActive) {
      return { status: 'exists_in_members', member: foundRemoteActive };
    }
  } catch (err) {
    console.warn('Note checking remote members for NIK:', err);
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
  onStatusUpdate?.(`Memulihkan data "${deletedMember.nama}" dari tabel tempdatalama ke koleksi members...`);

  const activeMembers = getStoredMembers();
  const tempMembers = getStoredTempDataLama();

  // Gunakan ID asli jika belum terpakai di members aktif, atau alokasikan ID unik baru jika ID lama sudah terpakai
  let targetId = deletedMember.id;
  const idOccupiedByOther = activeMembers.some(
    m => m.id === targetId && m.nik.replace(/\D/g, '') !== deletedMember.nik.replace(/\D/g, '')
  );
  if (!targetId || idOccupiedByOther) {
    targetId = await allocateUniqueMemberIdFromServer(
      deletedMember.kepalaKeluargaId,
      activeMembers,
      tempMembers
    );
  }

  const restoredMember: Member = {
    ...deletedMember,
    ...(overrides || {}),
    id: targetId,
    status: overrides?.status || deletedMember.status || 'disetujui',
    tanggalDaftar: deletedMember.tanggalDaftar || new Date().toISOString(),
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
    m => m.id !== deletedMember.id && m.nik.replace(/\D/g, '') !== deletedMember.nik.replace(/\D/g, '')
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

  // 4. Buat notifikasi di Firestore 'notifications' baru kirimkan ke aplikasi
  const roleText = getPeranLabel(restoredMember.peranKeluarga);
  const notif = await addNotificationAsync({
    memberId: restoredMember.id,
    memberName: restoredMember.nama,
    type: restoredMember.status === 'disetujui' ? 'status_approved' : 'new_registration',
    message: `Data anggota "${restoredMember.nama}" (ID: ${restoredMember.id}, ${roleText}) berhasil dipulihkan kembali dari arsip data lama (tempdatalama).`,
  });

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
    const trimmed = notifications.slice(0, 30);
    localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(trimmed));
  } catch (e: any) {
    try {
      localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(notifications.slice(0, 10)));
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
  const newNotif: AppNotification = {
    ...notification,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
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
  const newNotif: AppNotification = {
    ...notification,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    read: false,
  };

  // 1. Tulis & verifikasi pada koleksi 'notifications' di Firestore terlebih dahulu
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
 * 3. Buat dokumen notifikasi pada koleksi `notifications` di Firestore (`addNotificationAsync`).
 * 4. Baru kirimkan notifikasi ke aplikasi bahwa anggota sudah disetujui dan resmi terdaftar sebagai anggota.
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
    tanggalDisetujui: newStatus === 'disetujui' ? (prevMember.tanggalDisetujui || now) : prevMember.tanggalDisetujui,
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

  // LANGKAH 2: Pastikan muncul di halaman Daftar Anggota & Admin
  const latestMembers = getStoredMembers();
  const targetIdx = latestMembers.findIndex(m => m.id === memberId);
  if (targetIdx !== -1) {
    latestMembers[targetIdx] = updatedMember;
    saveMembers([...latestMembers]);
  } else {
    saveMembers([updatedMember, ...latestMembers]);
  }

  // LANGKAH 3: Buat dokumen notifikasi di koleksi 'notifications' pada Firestore
  const roleText = getPeranLabel(updatedMember.peranKeluarga);
  const statusLabel = newStatus === 'disetujui' ? 'DISETUJUI' : newStatus === 'ditolak' ? 'DITOLAK' : 'MENUNGGU ACC';
  const messageText =
    newStatus === 'disetujui'
      ? `Alhamdulillah, pendaftaran "${updatedMember.nama}" (ID: ${updatedMember.id}, ${roleText}) telah DISETUJUI dan resmi terdaftar di Daftar Anggota.`
      : `Status pendaftaran "${updatedMember.nama}" (ID: ${updatedMember.id}, ${roleText}) telah diubah menjadi ${statusLabel}.`;

  onStatusUpdate?.(`Mencatat notifikasi persetujuan ke koleksi 'notifications' Firestore...`);
  const notification = await addNotificationAsync({
    memberId: updatedMember.id,
    memberName: updatedMember.nama,
    type: newStatus === 'disetujui' ? 'status_approved' : 'status_rejected',
    message: messageText,
  });

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
    tanggalDisetujui: newStatus === 'disetujui' ? (prevMember.tanggalDisetujui || now) : prevMember.tanggalDisetujui,
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
  const notification = addNotification({
    memberId: updatedMember.id,
    memberName: updatedMember.nama,
    type: newStatus === 'disetujui' ? 'status_approved' : 'status_rejected',
    message: `Status pendaftaran "${updatedMember.nama}" (ID: ${updatedMember.id}, ${roleText}) telah diubah menjadi ${statusLabel}.`,
  });

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
    // LANGKAH 7: KONFIRMASI PENULISAN DATA BERHASIL & MASUK DAFTAR TUNGGU ADMIN
    // -------------------------------------------------------------
    logDeep(
      'KONFIRMASI_BERHASIL',
      'Konfirmasi Penulisan Data Berhasil 100%',
      `Integritas dokumen terverifikasi utuh di Firestore: ${newMember.nama} (ID: ${newMember.id}, Status: ${newMember.status})`,
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

    const notification = await addNotificationAsync({
      memberId: newMember.id,
      memberName: newMember.nama,
      type: newMember.status === 'disetujui' ? 'status_approved' : 'new_registration',
      message:
        newMember.status === 'disetujui'
          ? `Anggota baru "${newMember.nama}" (ID: ${newMember.id}, ${roleText}) telah ditambahkan dan langsung disetujui.`
          : `Pendaftaran baru: "${newMember.nama}" (ID: ${newMember.id}) sebagai ${roleText} (No. KK: ${newMember.noKk}) telah masuk ke database dan menunggu persetujuan pengurus/admin.`,
    });

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
  const target = members.find(m => m.id === id);

  if (target) {
    const archivedMember: Member = {
      ...target,
      deletedAt: new Date().toISOString(),
      deletedReason: reason || 'Dihapus oleh Admin (Tersimpan di tempdatalama)',
    };

    // 1. Simpan ke koleksi 'tempdatalama' di Firestore & lokal
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
    // Tetap pastikan ID tercatat sebagai sudah pernah digunakan
    await recordAllocatedIdInCounter(id);
  }

  // 2. Hapus dari koleksi aktif 'members'
  const filtered = members.filter(m => m.id !== id);
  saveMembers(filtered);

  try {
    await deleteMemberFromFirestore(id);
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
  saveMembers(INITIAL_MEMBERS);
  saveNotifications([]);
  setCurrentUserSession(null);

  INITIAL_MEMBERS.forEach(m => {
    saveMemberToFirestore(m).catch(console.warn);
  });

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

export function getStoredActivities(): Activity[] {
  if (typeof window === 'undefined') return INITIAL_ACTIVITIES;
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVITIES_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading activities from localStorage:', err);
    return INITIAL_ACTIVITIES;
  }
}

export function saveActivities(activities: Activity[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
    broadcastRealtime({
      type: 'DATA_SYNC',
      payload: { member: {} as any },
    });
  } catch (err) {
    console.error('Error saving activities to localStorage:', err);
  }
}

export function addNewActivity(
  data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>
): Activity {
  const activities = getStoredActivities();
  const nextNum = activities.length + 1;
  const newId = `ACT-2026-${String(nextNum).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newActivity: Activity = {
    ...data,
    id: newId,
    kehadiran: [],
    createdAt: now,
    updatedAt: now,
  };

  activities.unshift(newActivity);
  saveActivities(activities);
  return newActivity;
}

export function updateActivity(updated: Activity): void {
  const activities = getStoredActivities();
  const idx = activities.findIndex(a => a.id === updated.id);
  if (idx !== -1) {
    activities[idx] = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    saveActivities(activities);
  }
}

export function deleteActivity(id: string): void {
  const activities = getStoredActivities();
  const filtered = activities.filter(a => a.id !== id);
  saveActivities(filtered);
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
    memberFotoUrl: member.fotoUrl,
    scanTimestamp: now.toISOString(),
    scanTimeFormatted: timeFormatted,
    activityId: activity.id,
    activityTitle: activity.judul,
    activityType: activity.jenis,
  };

  activity.kehadiran.unshift(attendee);
  activity.updatedAt = now.toISOString();

  saveActivities(activities);
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
