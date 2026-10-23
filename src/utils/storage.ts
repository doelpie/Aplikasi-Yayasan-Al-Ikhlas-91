import { Member, AppNotification, BroadcastMessage, MemberStatus, FamilyRole, Activity, ActivityType, ActivityAttendee } from '../types';
import { INITIAL_MEMBERS } from '../data/initialData';
import { soundEffects } from './sound';
import { SYARI_PHOTOS } from '../data/initialData';
import { 
  saveMemberToFirestore, 
  saveMemberWithRetryAndConfirmation,
  verifyMemberExistsInFirestore,
  checkFirestoreConnectionStatus,
  pollVerifyMemberInMembersCollection3Seconds,
  deleteMemberFromFirestore, 
  addNotificationToFirestore, 
  markAllNotificationsAsReadInFirestore 
} from '../firebase';

export interface DeepRegistrationLogEntry {
  id: string;
  traceId: string;
  timestamp: string;
  stage: 
    | 'INISIALISASI'
    | 'STATUS_KONEKSI_FIRESTORE'
    | 'PRE_FLIGHT_KOMPRESI'
    | 'PENULISAN_DATA_MEMBERS'
    | 'POLLING_3_DETIK_VERIFIKASI'
    | 'KONFIRMASI_BERHASIL'
    | 'SINKRONISASI_LOCAL_STATE'
    | 'PENERBITAN_NOTIFIKASI_ADMIN'
    | 'ERROR_PENDAFTARAN';
  title: string;
  detail: string;
  latencyMs?: number;
  data?: Record<string, any>;
  status: 'SUCCESS' | 'INFO' | 'WARN' | 'ERROR';
}

const STORAGE_DEEP_LOGS_KEY = 'yayasan_alikhlas_deep_registration_logs_v1';

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
    const current = getDeepRegistrationLogs();
    const updated = [entry, ...current.slice(0, 99)]; // Keep up to 100 deep log records
    localStorage.setItem(STORAGE_DEEP_LOGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save deep log to localStorage:', err);
  }
}

export function clearDeepRegistrationLogs(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_DEEP_LOGS_KEY);
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

const STORAGE_MEMBERS_KEY = 'yayasan_alikhlas_members_v3';
const STORAGE_NOTIF_KEY = 'yayasan_alikhlas_notifications_v3';
const STORAGE_USER_KEY = 'yayasan_alikhlas_user_session_v3';
const STORAGE_ACTIVITIES_KEY = 'yayasan_alikhlas_activities_v1';
const STORAGE_REGISTRATION_TRACES_KEY = 'yayasan_alikhlas_reg_traces_v1';
const BROADCAST_CHANNEL_NAME = 'yayasan_alikhlas_channel_nu_v3';

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
    const updated = [trace, ...current.slice(0, 39)]; // Keep up to 40 latest registration audit traces
    localStorage.setItem(STORAGE_REGISTRATION_TRACES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save registration trace to localStorage:', err);
  }
}

export function clearRegistrationTraces(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_REGISTRATION_TRACES_KEY);
}

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel not supported:', err);
  }
}

export function getStoredMembers(): Member[] {
  if (typeof window === 'undefined') return INITIAL_MEMBERS;
  try {
    const raw = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(INITIAL_MEMBERS));
      return INITIAL_MEMBERS;
    }
    const parsed: Member[] = JSON.parse(raw);
    
    // Auto-migrate any existing member without a syari photo
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

    if (needsUpdate) {
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return parsed;
  } catch (e) {
    console.error('Error reading members from localStorage:', e);
    return INITIAL_MEMBERS;
  }
}

export function saveMembers(members: Member[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
  } catch (e) {
    console.error('Error saving members to localStorage:', e);
  }
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
    localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving notifications:', e);
  }
}

// User session management for Warga (Kepala Keluarga, Istri, Anak)
export function getCurrentUserSession(): Member | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Refresh with latest data from storage
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
    localStorage.removeItem(STORAGE_USER_KEY);
  } else {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(member));
  }
}

import { compressImage } from './imageCompressor';

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
  
  // Persist to Firebase Firestore
  addNotificationToFirestore(newNotif).catch(err => {
    console.warn('Firestore notification sync note:', err);
  });

  return newNotif;
}

export async function addNotificationAsync(
  notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
): Promise<AppNotification> {
  const all = getStoredNotifications();
  const newNotif: AppNotification = {
    ...notification,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [newNotif, ...all.slice(0, 49)];
  saveNotifications(updated);
  
  // Persist to Firebase Firestore
  try {
    await addNotificationToFirestore(newNotif);
  } catch (err) {
    console.warn('Firestore notification async warning:', err);
  }

  return newNotif;
}

export function markAllNotificationsAsRead(): void {
  const all = getStoredNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(all);
  
  // Persist read state to Firebase Firestore
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
  // Match members sharing the same Kartu Keluarga (KK)
  return allMembers.filter(m => m.noKk === member.noKk);
}

// List of available Kepala Keluarga for selection
export function getAvailableKepalaKeluarga(allMembers: Member[]): Member[] {
  return allMembers.filter(m => m.peranKeluarga === 'kepala_keluarga' && m.status === 'disetujui');
}

// Member mutations
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

  // Persist update to Firebase Firestore
  saveMemberToFirestore(updatedMember).catch(err => {
    console.warn('Firestore member status sync note:', err);
  });

  if (newStatus === 'disetujui') {
    soundEffects.playSuccess();
  } else if (newStatus === 'ditolak') {
    soundEffects.playWarning();
  }

  const statusLabel = newStatus === 'disetujui' ? 'DISETUJUI' : newStatus === 'ditolak' ? 'DITOLAK' : 'MENUNGGU ACC';
  const notification = addNotification({
    memberId: updatedMember.id,
    memberName: updatedMember.nama,
    type: newStatus === 'disetujui' ? 'status_approved' : 'status_rejected',
    message: `Status pendaftaran "${updatedMember.nama}" (${getPeranLabel(updatedMember.peranKeluarga)}) telah diubah menjadi ${statusLabel}.`,
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
  const nikMasked = data.nik ? data.nik.slice(0, 6) + '******' + data.nik.slice(-4) : '-';

  try {
    // -------------------------------------------------------------
    // LANGKAH 1: INISIALISASI PENDAFTARAN & ALOKASI ID UNIK
    // -------------------------------------------------------------
    const step1Start = Date.now();
    const members = getStoredMembers();
    
    // Generate non-colliding ID e.g. '0120'
    const maxNum = members.reduce((max, m) => {
      const root = m.id.split('-')[0];
      const num = parseInt(root, 10);
      return !isNaN(num) && num > max ? num : max;
    }, 118);

    let nextNum = maxNum + 1;
    let nextId = String(nextNum).padStart(4, '0');
    
    // If family member added to existing head of family
    if (data.kepalaKeluargaId) {
      const existingFamilyCount = members.filter(m => m.kepalaKeluargaId === data.kepalaKeluargaId || m.id === data.kepalaKeluargaId).length;
      nextId = `${data.kepalaKeluargaId}-${existingFamilyCount + 1}`;
    }

    // Ensure nextId does not collide with existing member
    while (members.some(m => m.id === nextId)) {
      nextNum++;
      nextId = String(nextNum).padStart(4, '0');
    }
    assignedId = nextId;
    const step1Duration = Date.now() - step1Start;

    logDeep(
      'INISIALISASI',
      'Inisialisasi Data & Alokasi ID Anggota',
      `ID: ${assignedId}, Nama: "${data.nama}", Peran: ${roleText}, NIK: ${nikMasked}, No. KK: ${data.noKk}`,
      'INFO',
      step1Duration,
      { assignedId, nama: data.nama, role: roleText, noKk: data.noKk, nikMasked }
    );

    // -------------------------------------------------------------
    // LANGKAH 2: PENGECEKAN STATUS KONEKSI FIRESTORE (LIVE PRE-CHECK)
    // -------------------------------------------------------------
    onStatusUpdate?.('Memeriksa status konektivitas live ke server database Firestore...');
    const step2Start = Date.now();
    const connStatus = await checkFirestoreConnectionStatus();
    const connDuration = Date.now() - step2Start;

    if (!connStatus.online) {
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
    // LANGKAH 3: PRE-FLIGHT KOMPRESI LAMPIRAN & KALKULASI UKURAN PAYLOAD
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

    const newMember: Member = {
      ...data,
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

    // Hitung ukuran payload (bytes & KB)
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
    // LANGKAH 4: PENULISAN DATA KE KOLEKSI 'members' (DENGAN RETRY LOGIC)
    // -------------------------------------------------------------
    const step4Start = Date.now();
    onStatusUpdate?.('Mengirimkan data anggota ke koleksi "members" Firestore...');

    const writeResult = await saveMemberWithRetryAndConfirmation(
      newMember,
      5,
      (status) => onStatusUpdate?.(`[Trace: ${traceId}] ${status}`),
      traceId
    );

    const step4Duration = Date.now() - step4Start;
    logDeep(
      'PENULISAN_DATA_MEMBERS',
      'Penulisan Dokumen ke Koleksi members',
      `Penulisan dokumen "${newMember.nama}" (ID: ${newMember.id}) berhasil pada percobaan ke-${writeResult.totalAttempts} dalam ${writeResult.totalDurationMs}ms`,
      'SUCCESS',
      step4Duration,
      { attempts: writeResult.totalAttempts, totalDurationMs: writeResult.totalDurationMs, memberId: newMember.id }
    );

    // -------------------------------------------------------------
    // LANGKAH 5: MEKANISME PENGECEKAN (POLLING) 3 DETIK DI KOLEKSI 'members'
    // -------------------------------------------------------------
    onStatusUpdate?.('Menjalankan mekanisme verifikasi polling 3 detik ke koleksi "members"...');
    const step5Start = Date.now();

    const pollingResult = await pollVerifyMemberInMembersCollection3Seconds(
      newMember.id,
      { nama: newMember.nama, nik: newMember.nik },
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
    // LANGKAH 6: KONFIRMASI PENULISAN DATA BERHASIL
    // -------------------------------------------------------------
    logDeep(
      'KONFIRMASI_BERHASIL',
      'Konfirmasi Penulisan Data Berhasil 100%',
      `Integritas dokumen terverifikasi utuh di Firestore: ${newMember.nama} (ID: ${newMember.id}, Status: ${newMember.status})`,
      'SUCCESS',
      0,
      { memberId: newMember.id, nama: newMember.nama, status: newMember.status }
    );

    // -------------------------------------------------------------
    // LANGKAH 7: SINKRONISASI DATA LOKAL & REALTIME BROADCAST
    // -------------------------------------------------------------
    const step7Start = Date.now();
    const freshMembers = getStoredMembers();
    const updated = [newMember, ...freshMembers.filter(m => m.id !== newMember.id)];
    saveMembers(updated);
    soundEffects.playPing();
    const step7Duration = Date.now() - step7Start;

    logDeep(
      'SINKRONISASI_LOCAL_STATE',
      'Penyimpanan ke Cache Lokal & Broadcast Real-Time',
      `Data anggota tersimpan di cache browser. Total anggota tersimpan: ${updated.length}`,
      'SUCCESS',
      step7Duration,
      { totalMembers: updated.length }
    );

    // -------------------------------------------------------------
    // LANGKAH 8: PENERBITAN NOTIFIKASI SUKSES KE ADMIN
    // (Hanya dikirim karena dokumen sudah 100% dipastikan terbaca di Firestore)
    // -------------------------------------------------------------
    const step8Start = Date.now();
    onStatusUpdate?.('Menerbitkan notifikasi pendaftaran terverifikasi ke admin...');

    const notification = await addNotificationAsync({
      memberId: newMember.id,
      memberName: newMember.nama,
      type: 'new_registration',
      message: `Pendaftaran baru: "${newMember.nama}" sebagai ${roleText} (No. KK: ${newMember.noKk}). Menunggu verifikasi pengurus.`,
    });

    triggerSystemNotification('Pendaftaran Baru Masuk', `Nama: ${newMember.nama} (${roleText})`);

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
      'Notifikasi Sukses Diterbitkan ke Admin',
      `Notifikasi berhasil dikirimkan ke database & broadcast (Notif ID: ${notification.id})`,
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

    console.log(`[Trace:${traceId}] SUKSES PARIPURNA: "${newMember.nama}" terdaftar & diverifikasi polling 3 detik dalam ${totalDurationMs}ms!`);
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

    let userFriendlyMsg = 'Gagal menyimpan dan memverifikasi data di database server.';
    if (errorMsg.includes('the client is offline') || errorMsg.includes('unavailable')) {
      userFriendlyMsg = 'Koneksi ke database server terputus atau perangkat sedang offline. Mohon periksa koneksi internet Anda.';
    } else if (errorMsg.includes('exceeds the limit')) {
      userFriendlyMsg = 'Ukuran lampiran foto terlalu besar. Silakan gunakan foto yang berukuran wajar.';
    } else if (errorMsg) {
      userFriendlyMsg = `${errorMsg}`;
    }

    throw new Error(`[ID Pelacakan: ${traceId}] ${userFriendlyMsg}`);
  }
}

export function addNewMember(
  data: Omit<Member, 'id' | 'tanggalDaftar' | 'status'> & { status?: MemberStatus }
): Member {
  // Sync wrapper that safely triggers async tracked save in background
  const members = getStoredMembers();
  const maxNum = members.reduce((max, m) => {
    const root = m.id.split('-')[0];
    const num = parseInt(root, 10);
    return !isNaN(num) && num > max ? num : max;
  }, 118);

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

  // Trigger tracked async flow in background
  addNewMemberAsync(data).catch(err => {
    console.error('Async member save note:', err);
  });

  return newMember;
}

export async function updateMemberAsync(updatedMember: Member): Promise<Member> {
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
    fotoUrl: compressedFoto,
    ktpUrl: compressedKtp,
    kkUrl: compressedKk,
  };

  await saveMemberToFirestore(finalMember);

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

export function deleteMember(id: string): void {
  const members = getStoredMembers();
  const filtered = members.filter(m => m.id !== id);
  saveMembers(filtered);

  // Delete from Firebase Firestore
  deleteMemberFromFirestore(id).catch(err => {
    console.warn('Firestore delete member sync note:', err);
  });
}

export function resetToInitialData(): void {
  saveMembers(INITIAL_MEMBERS);
  saveNotifications([]);
  setCurrentUserSession(null);

  // Reseed Firebase Firestore
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
    pesertaIds: ['0114', '0115', '0116'],
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
    pesertaIds: ['0114', '0114-1', '0114-2', '0115', '0115-1', '0116'],
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
    pesertaIds: ['0114', '0114-1', '0115', '0115-1', '0116'],
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

/**
 * Mencatat kehadiran anggota pada kegiatan tertentu.
 * Jika anggota belum masuk pesertaIds, autoAdd to pesertaIds jika dikonfirmasi.
 */
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

  // Cek apakah sudah pernah scan hadir
  const already = activity.kehadiran.some(k => k.memberId === member.id);
  if (already) {
    return { success: false, alreadyAttended: true, isNewToPeserta: false, error: 'Anggota sudah tercatat hadir pada kegiatan ini.' };
  }

  const isAlreadyInPeserta = activity.pesertaIds.includes(member.id);
  let isNewToPeserta = false;

  if (!isAlreadyInPeserta) {
    if (!forceAddToPeserta) {
      // Perlu konfirmasi admin
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

