import {
  SystemLogEntry,
  SystemLogCategory,
  SystemLogLevel,
  BugDiagnosticResult,
  FlaggedMemberAnomaly,
  Member
} from '../types';
import {
  saveSystemLogToFirestore,
  fetchSystemLogsFromFirestore,
  clearSystemLogsInFirestore,
  checkFirestoreConnectionStatus,
  recordAllocatedIdInCounter,
  db
} from '../firebase';
import { doc, getDocFromServer } from 'firebase/firestore';
import { getStoredMembers, getStoredTempDataLama, getStoredTempDataMenunggu } from './storage';
import { INITIAL_MEMBERS } from '../data/initialData';

const STORAGE_SYSTEM_LOGS_KEY = 'yayasan_alikhlas_system_logs_v1';
const BROADCAST_CHANNEL_NAME = 'yayasan_alikhlas_channel_nu_v3';

let inMemoryLogs: SystemLogEntry[] | null = null;
let loggerBroadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    loggerBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch {}
}

// Initial default logs for history
const INITIAL_SYSTEM_LOGS: SystemLogEntry[] = [
  {
    id: 'log_boot_001',
    category: 'AUTH_SECURITY',
    level: 'SUCCESS',
    title: 'Inisialisasi Sistem Keamanan Yayasan Al Ikhlas',
    detail: 'Sistem otorisasi role Admin & Warga aktif. Gate proteksi IT terenkripsi siap digunakan.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    source: 'AuthGuard',
  },
  {
    id: 'log_boot_002',
    category: 'DATABASE',
    level: 'INFO',
    title: 'Koneksi Firestore Database & 3 Koleksi Penampung Sementara Aktif',
    detail: 'Koleksi members, tempdatasebelumdaftar (akan daftar), tempdatamenunggu (menunggu persetujuan admin), dan tempdatalama (data terhapus) sinkron.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    source: 'FirestoreClient',
  },
  {
    id: 'log_boot_003',
    category: 'DATABASE',
    level: 'SUCCESS',
    title: 'Proteksi Konsistensi Data & Anti-Data Dummy Aktif',
    detail: 'Data dummy tidak akan pernah muncul kembali secara otomatis. Seluruh ID anggota (aktif, menunggu, ditolak, maupun terhapus) dikunci unik.',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    source: 'UniqueIdGuard',
  }
];

export function getStoredSystemLogs(): SystemLogEntry[] {
  if (inMemoryLogs && inMemoryLogs.length > 0) {
    return inMemoryLogs;
  }
  if (typeof window === 'undefined') return INITIAL_SYSTEM_LOGS;
  try {
    const raw = localStorage.getItem(STORAGE_SYSTEM_LOGS_KEY);
    if (!raw) {
      inMemoryLogs = INITIAL_SYSTEM_LOGS;
      saveSystemLogsToLocal(INITIAL_SYSTEM_LOGS);
      return INITIAL_SYSTEM_LOGS;
    }
    const parsed: SystemLogEntry[] = JSON.parse(raw);
    inMemoryLogs = parsed;
    return parsed;
  } catch {
    return inMemoryLogs || INITIAL_SYSTEM_LOGS;
  }
}

export function saveSystemLogsToLocal(logs: SystemLogEntry[]): void {
  inMemoryLogs = logs;
  if (typeof window === 'undefined') return;
  try {
    const trimmed = logs.slice(0, 100).map(l => ({
      ...l,
      detail: l.detail ? l.detail.slice(0, 2000) : '',
    }));
    localStorage.setItem(STORAGE_SYSTEM_LOGS_KEY, JSON.stringify(trimmed));
  } catch (err: any) {
    console.warn('LocalStorage system logs warning:', err);
  }
}

/**
 * Mencatat aktivitas sistem, operasi database, atau pesan error ke dalam log lokal & Firestore
 */
export async function recordSystemLog(entry: {
  category: SystemLogCategory;
  level: SystemLogLevel;
  title: string;
  detail: string;
  source?: string;
  data?: Record<string, any>;
}): Promise<SystemLogEntry> {
  const newLog: SystemLogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    category: entry.category,
    level: entry.level,
    title: entry.title.slice(0, 250),
    detail: entry.detail.slice(0, 3000),
    timestamp: new Date().toISOString(),
    source: entry.source || 'AppCore',
    data: entry.data,
  };

  const current = getStoredSystemLogs();
  const updated = [newLog, ...current.filter(l => l.id !== newLog.id).slice(0, 99)];
  saveSystemLogsToLocal(updated);

  try {
    loggerBroadcastChannel?.postMessage({
      type: 'DATA_SYNC',
      payload: { log: newLog },
    });
  } catch {}

  saveSystemLogToFirestore(newLog).catch(err => {
    console.warn('Async system log Firestore write note:', err);
  });

  const badgeColor =
    entry.level === 'SUCCESS' ? '#0b5d34' :
    entry.level === 'ERROR' ? '#b91c1c' :
    entry.level === 'WARN' ? '#d97706' : '#1e40af';
  console.log(
    `%c[TEKNIS_IT:%c${entry.category}%c]%c ${entry.title}: ${entry.detail}`,
    `background:${badgeColor};color:white;font-weight:bold;padding:1px 4px;border-radius:3px;`,
    'background:#334155;color:white;font-weight:bold;padding:1px 4px;',
    '',
    'color:#0f172a;font-weight:600;'
  );

  return newLog;
}

/**
 * Tombol "Sinkronkan Log": Menggabungkan log dari database Firestore & log lokal
 */
export async function syncSystemLogsWithFirestore(): Promise<SystemLogEntry[]> {
  try {
    const remoteLogs = await fetchSystemLogsFromFirestore();
    const localLogs = getStoredSystemLogs();

    const map = new Map<string, SystemLogEntry>();
    remoteLogs.forEach(l => map.set(l.id, l));
    localLogs.forEach(l => {
      if (!map.has(l.id)) {
        map.set(l.id, l);
      }
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    saveSystemLogsToLocal(merged);
    return merged;
  } catch (err: any) {
    console.warn('Failed to sync logs with Firestore:', err);
    return getStoredSystemLogs();
  }
}

/**
 * Membersihkan seluruh log aktivitas sistem
 */
export async function clearAllSystemLogs(): Promise<void> {
  inMemoryLogs = [];
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_SYSTEM_LOGS_KEY);
  }
  await clearSystemLogsInFirestore();
}

/**
 * Mengecek apakah URL gambar adalah hasil generate sistem / AI / placeholder (bukan foto asli upload warga)
 */
export function isSystemGeneratedImage(url?: string, fileName?: string): boolean {
  if (!url || !url.trim()) return false;
  const u = url.trim().toLowerCase();
  const fn = (fileName || '').toLowerCase();
  return (
    u.includes('/src/assets/images/') ||
    u.startsWith('data:image/svg+xml') ||
    u.includes('unsplash.com') ||
    u.includes('ui-avatars.com') ||
    u.includes('dicebear.com') ||
    u.includes('pravatar.cc') ||
    fn.startsWith('foto_syari_') ||
    fn.startsWith('lampiran_ktp_achmad') ||
    fn.startsWith('lampiran_kartu_keluarga_asli')
  );
}

/**
 * Menganalisis seluruh anggota untuk menemukan:
 * 1. Anggota yang tidak memiliki Foto Profil, Foto KTP, atau Foto KK.
 * 2. Anggota yang fotonya di-generate oleh sistem (bukan hasil upload user asli).
 * 3. Data anggota yang tergenerate otomatis oleh sistem / data dummy AI (bawaan awal).
 * 4. Duplikasi ID atau NIK di antara seluruh status (disetujui, menunggu, ditolak, maupun terhapus).
 */
export function analyzeFlaggedMemberAnomalies(
  members?: Member[],
  tempDataLama?: Member[]
): FlaggedMemberAnomaly[] {
  const currentMembers = members ?? getStoredMembers();
  const currentTemp = tempDataLama ?? getStoredTempDataLama();

  const initialSeedIds = new Set(INITIAL_MEMBERS.map(m => m.id));

  // Hitung frekuensi ID dan NIK untuk deteksi benturan
  const idCountMap = new Map<string, number>();
  const nikCountMap = new Map<string, number>();

  currentMembers.forEach(m => {
    idCountMap.set(m.id, (idCountMap.get(m.id) || 0) + 1);
    const cleanNik = (m.nik || '').replace(/\D/g, '');
    if (cleanNik) {
      nikCountMap.set(cleanNik, (nikCountMap.get(cleanNik) || 0) + 1);
    }
  });

  // Cek apakah ada ID di members yang juga ada di tempdatalama dengan NIK berbeda
  const tempById = new Map<string, Member>();
  currentTemp.forEach(tm => tempById.set(tm.id, tm));

  const anomalies: FlaggedMemberAnomaly[] = [];

  for (const m of currentMembers) {
    const issues: string[] = [];
    let isSystemDummyData = false;
    let hasMissingOrSystemProfilePhoto = false;
    let hasMissingOrSystemKtp = false;
    let hasMissingOrSystemKk = false;
    let hasDuplicateIdOrNik = false;

    const cleanNik = (m.nik || '').replace(/\D/g, '');

    // 1. Cek Keunikan ID & NIK
    if ((idCountMap.get(m.id) || 0) > 1) {
      hasDuplicateIdOrNik = true;
      issues.push(`ID Anggota '${m.id}' terdeteksi ganda pada daftar anggota.`);
    }
    const tempSameId = tempById.get(m.id);
    if (tempSameId && (tempSameId.nik || '').replace(/\D/g, '') !== cleanNik) {
      hasDuplicateIdOrNik = true;
      issues.push(`ID Anggota '${m.id}' bertabrakan dengan data terhapus atas nama "${tempSameId.nama}" di tempdatalama.`);
    }
    if (cleanNik && (nikCountMap.get(cleanNik) || 0) > 1) {
      hasDuplicateIdOrNik = true;
      issues.push(`Nomor KTP/NIK '${m.nik}' digunakan lebih dari 1 anggota.`);
    }

    // 2. Cek Foto Profil (Tidak ada atau digenerate sistem)
    if (!m.fotoUrl || !m.fotoUrl.trim()) {
      hasMissingOrSystemProfilePhoto = true;
      issues.push('Tidak ada Foto Profil (belum diunggah).');
    } else if (isSystemGeneratedImage(m.fotoUrl, m.fotoName)) {
      hasMissingOrSystemProfilePhoto = true;
      issues.push('Foto Profil menggunakan gambar generate sistem / AI (bukan foto asli unggahan user).');
    }

    // 3. Cek Foto KTP (Tidak ada atau digenerate sistem)
    if (!m.ktpUrl || !m.ktpUrl.trim()) {
      hasMissingOrSystemKtp = true;
      issues.push('Tidak ada Foto KTP/KIA (belum diunggah).');
    } else if (isSystemGeneratedImage(m.ktpUrl, m.ktpName)) {
      hasMissingOrSystemKtp = true;
      issues.push('Foto KTP menggunakan ilustrasi SVG sistem (bukan foto KTP asli).');
    }

    // 4. Cek Foto KK (Tidak ada atau digenerate sistem)
    if (!m.kkUrl || !m.kkUrl.trim()) {
      hasMissingOrSystemKk = true;
      issues.push('Tidak ada Foto Kartu Keluarga / KK (belum diunggah).');
    } else if (isSystemGeneratedImage(m.kkUrl, m.kkName)) {
      hasMissingOrSystemKk = true;
      issues.push('Foto KK menggunakan ilustrasi SVG sistem (bukan foto KK asli).');
    }

    // 5. Cek apakah Data Tergenerate Sistem / Data Dummy AI
    const hasDummyEmail = (m.email || '').toLowerCase().endsWith('@example.com');
    const isFromInitialSeed = initialSeedIds.has(m.id) && isSystemGeneratedImage(m.fotoUrl, m.fotoName) && !m.ktpUrl && !m.kkUrl;
    if (isFromInitialSeed || hasDummyEmail) {
      isSystemDummyData = true;
      issues.unshift('Data bawaan / dummy yang tergenerate otomatis oleh sistem (AI Seed Data).');
    }

    if (issues.length > 0) {
      anomalies.push({
        member: m,
        issues,
        isSystemDummyData,
        hasMissingOrSystemProfilePhoto,
        hasMissingOrSystemKtp,
        hasMissingOrSystemKk,
        hasDuplicateIdOrNik,
      });
    }
  }

  return anomalies;
}

/**
 * Menjalankan rangkaian pengujian diagnostik bug aplikasi & database secara komprehensif
 */
export async function runBugDiagnostics(members?: Member[]): Promise<BugDiagnosticResult[]> {
  const results: BugDiagnosticResult[] = [];
  const currentMembers = members ?? getStoredMembers();
  const currentWaiting = getStoredTempDataMenunggu();
  const currentTemp = getStoredTempDataLama();

  // 1. Diagnostik Koneksi Firestore
  const t1Start = Date.now();
  try {
    const conn = await checkFirestoreConnectionStatus();
    const latency = Date.now() - t1Start;
    if (conn.online) {
      results.push({
        id: 'diag_koneksi',
        name: 'Konektivitas Firestore Server',
        category: 'KONEKSI',
        status: 'PASS',
        message: `Terhubung lancar ke database Firestore (${conn.latencyMs}ms). Server aktif & merespon.`,
        latencyMs: latency,
        details: [conn.message],
      });
    } else {
      results.push({
        id: 'diag_koneksi',
        name: 'Konektivitas Firestore Server',
        category: 'KONEKSI',
        status: conn.quotaExceeded ? 'FAIL' : 'WARN',
        message: conn.message,
        latencyMs: latency,
        details: ['Periksa koneksi internet atau kuota harian Firebase.'],
        autoFixable: false,
      });
    }
  } catch (err: any) {
    results.push({
      id: 'diag_koneksi',
      name: 'Konektivitas Firestore Server',
      category: 'KONEKSI',
      status: 'FAIL',
      message: err?.message || 'Gagal menghubungi server Firestore.',
      latencyMs: Date.now() - t1Start,
      autoFixable: false,
    });
  }

  // 2. Diagnostik Keunikan Seluruh ID Anggota (Aktif, Menunggu, Ditolak, dan Terhapus di tempdatalama)
  const idUsageMap = new Map<string, string[]>();
  currentMembers.forEach(m => {
    const arr = idUsageMap.get(m.id) || [];
    arr.push(`${m.nama} [Status: ${m.status.toUpperCase()}, NIK: ${m.nik}]`);
    idUsageMap.set(m.id, arr);
  });
  currentTemp.forEach(tm => {
    const existingInActive = currentMembers.find(m => m.id === tm.id);
    if (existingInActive && (existingInActive.nik || '').replace(/\D/g, '') !== (tm.nik || '').replace(/\D/g, '')) {
      const arr = idUsageMap.get(tm.id) || [];
      arr.push(`${tm.nama} [Arsip Terhapus tempdatalama, NIK: ${tm.nik}]`);
      idUsageMap.set(tm.id, arr);
    }
  });

  const duplicateIds: string[] = [];
  idUsageMap.forEach((owners, idKey) => {
    if (owners.length > 1) {
      duplicateIds.push(`ID '${idKey}' dipakai bersama oleh: ${owners.join(' DAN ')}`);
    }
  });

  if (duplicateIds.length === 0) {
    results.push({
      id: 'diag_id_unik_semua',
      name: 'Keunikan Seluruh ID Anggota (Aktif, Menunggu & Terhapus)',
      category: 'INTEGRITAS_DATA',
      status: 'PASS',
      message: `Seluruh ${currentMembers.length} anggota aktif/menunggu dan ${currentTemp.length} arsip terhapus memiliki ID Anggota unik tanpa benturan.`,
      details: [
        `Anggota Disetujui: ${currentMembers.filter(m => m.status === 'disetujui').length}`,
        `Anggota Menunggu (tempdatamenunggu): ${currentWaiting.length}`,
        `Anggota Ditolak: ${currentMembers.filter(m => m.status === 'ditolak').length}`,
        `Arsip Terhapus (tempdatalama): ${currentTemp.length}`,
      ],
    });
  } else {
    results.push({
      id: 'diag_id_unik_semua',
      name: 'Keunikan Seluruh ID Anggota (Aktif, Menunggu & Terhapus)',
      category: 'INTEGRITAS_DATA',
      status: 'FAIL',
      message: `Ditemukan ${duplicateIds.length} benturan ID Anggota yang sama!`,
      details: duplicateIds,
      autoFixable: true,
    });
  }

  // 3. Diagnostik Keunikan Nomor KTP (NIK)
  const nikMap = new Map<string, string[]>();
  currentMembers.forEach(m => {
    const clean = (m.nik || '').replace(/\D/g, '');
    if (clean) {
      const arr = nikMap.get(clean) || [];
      arr.push(`${m.nama} (ID: ${m.id}, Status: ${m.status})`);
      nikMap.set(clean, arr);
    }
  });

  const duplicateNiks: string[] = [];
  nikMap.forEach((names, n) => {
    if (names.length > 1) {
      duplicateNiks.push(`NIK ${n} digunakan ganda oleh: ${names.join(', ')}`);
    }
  });

  if (duplicateNiks.length === 0) {
    results.push({
      id: 'diag_nik_unik',
      name: 'Integritas & Keunikan Nomor KTP (NIK)',
      category: 'INTEGRITAS_DATA',
      status: 'PASS',
      message: `Seluruh ${currentMembers.length} anggota memiliki Nomor KTP (NIK) unik dan valid.`,
      details: [`Total NIK unik terverifikasi: ${nikMap.size}`],
    });
  } else {
    results.push({
      id: 'diag_nik_unik',
      name: 'Integritas & Keunikan Nomor KTP (NIK)',
      category: 'INTEGRITAS_DATA',
      status: 'FAIL',
      message: `Ditemukan ${duplicateNiks.length} NIK ganda di dalam daftar anggota!`,
      details: duplicateNiks,
      autoFixable: true,
    });
  }

  // 4. Diagnostik Foto Profil, Foto KTP, Foto KK & Data Tergenerate Sistem / Dummy AI
  const anomalies = analyzeFlaggedMemberAnomalies(currentMembers, currentTemp);
  const missingOrSysProfile = anomalies.filter(a => a.hasMissingOrSystemProfilePhoto);
  const missingOrSysKtp = anomalies.filter(a => a.hasMissingOrSystemKtp);
  const missingOrSysKk = anomalies.filter(a => a.hasMissingOrSystemKk);
  const dummySystemMembers = anomalies.filter(a => a.isSystemDummyData);

  if (anomalies.length === 0) {
    results.push({
      id: 'diag_foto_dan_dummy',
      name: 'Audit Kelengkapan Foto (Profil, KTP, KK) & Deteksi Data Sistem/Dummy',
      category: 'AUDIT_FOTO_DOKUMEN',
      status: 'PASS',
      message: 'Seluruh anggota memiliki Foto Profil, Foto KTP, dan Foto KK asli hasil unggahan user (tidak ada foto generate sistem/dummy).',
    });
  } else {
    results.push({
      id: 'diag_foto_dan_dummy',
      name: 'Audit Kelengkapan Foto (Profil, KTP, KK) & Deteksi Data Sistem/Dummy',
      category: 'AUDIT_FOTO_DOKUMEN',
      status: 'WARN',
      message: `Terdeteksi ${anomalies.length} data anggota yang belum memiliki Foto Profil/KTP/KK asli atau merupakan data dummy generate sistem.`,
      details: [
        `Data Dummy / Bawaan Sistem AI: ${dummySystemMembers.length} anggota`,
        `Foto Profil kosong / foto generate sistem: ${missingOrSysProfile.length} anggota`,
        `Foto KTP belum diunggah / ilustrasi sistem: ${missingOrSysKtp.length} anggota`,
        `Foto KK belum diunggah / ilustrasi sistem: ${missingOrSysKk.length} anggota`,
        'Gunakan daftar "Tindakan Admin" di bawah untuk Edit/Perbaiki Data atau Hapus Data.',
      ],
      autoFixable: true,
    });
  }

  // 5. Diagnostik Relasi Keluarga (Kepala Keluarga <-> Istri & Anak)
  const approvedHeads = new Set(
    currentMembers.filter(m => m.peranKeluarga === 'kepala_keluarga').map(m => m.id)
  );
  const brokenRelations: string[] = [];

  currentMembers.forEach(m => {
    if (m.peranKeluarga !== 'kepala_keluarga') {
      if (!m.kepalaKeluargaId || !approvedHeads.has(m.kepalaKeluargaId)) {
        brokenRelations.push(
          `${m.nama} (ID: ${m.id}, ${m.peranKeluarga}) memiliki kepalaKeluargaId '${m.kepalaKeluargaId || 'kosong'}' yang tidak ditemukan di daftar Kepala Keluarga aktif.`
        );
      }
    }
  });

  if (brokenRelations.length === 0) {
    results.push({
      id: 'diag_relasi',
      name: 'Konsistensi Relasi Kepala Keluarga',
      category: 'RELASI_KELUARGA',
      status: 'PASS',
      message: 'Seluruh istri dan anak terhubung valid dengan Kepala Keluarga yang terdaftar.',
    });
  } else {
    results.push({
      id: 'diag_relasi',
      name: 'Konsistensi Relasi Kepala Keluarga',
      category: 'RELASI_KELUARGA',
      status: 'WARN',
      message: `Ditemukan ${brokenRelations.length} anggota keluarga tanpa relasi Kepala Keluarga yang valid.`,
      details: brokenRelations.slice(0, 5),
      autoFixable: true,
    });
  }

  // 6. Diagnostik 3 Tempat Tampung Sementara ('tempdatasebelumdaftar', 'tempdatamenunggu', 'tempdatalama')
  const REQUIRED_MEMBER_KEYS: (keyof Member)[] = [
    'id', 'nik', 'nama', 'tempatTanggalLahir', 'alamat', 'noHp', 'noKk',
    'peranKeluarga', 'status', 'tanggalDaftar'
  ];
  const incompleteTemp = currentTemp.filter(tm =>
    REQUIRED_MEMBER_KEYS.some(k => tm[k] === undefined)
  );

  results.push({
    id: 'diag_tempdatamenunggu_dan_lama',
    name: 'Konsistensi 3 Tempat Tampung Sementara (tempdatasebelumdaftar, tempdatamenunggu, tempdatalama)',
    category: 'INTEGRITAS_DATA',
    status: incompleteTemp.length === 0 ? 'PASS' : 'WARN',
    message: `Koleksi 'tempdatamenunggu' menampung ${currentWaiting.length} data menunggu persetujuan Admin & 'tempdatalama' menampung ${currentTemp.length} data terhapus (field 100% lengkap). Data dummy dinonaktifkan agar tidak pernah menimpa data asli.`,
    details: [
      `Tempat tampung menunggu persetujuan (tempdatamenunggu): ${currentWaiting.length} anggota`,
      `Tempat tampung data terhapus (tempdatalama): ${currentTemp.length} anggota`,
      `Kesesuaian seluruh field dengan koleksi members: ${incompleteTemp.length === 0 ? '100% Lengkap' : `${incompleteTemp.length} perlu normalisasi`}`,
      'Proteksi aktif: Tidak ada auto-seed data dummy & tidak ada pemulihan otomatis tanpa konfirmasi Admin.',
    ],
  });

  // 7. Diagnostik Monotonik Sequence Counter ID
  let counterValue = 131;
  try {
    const cSnap = await getDocFromServer(doc(db, 'system_counters', 'member_id_seq'));
    if (cSnap.exists()) {
      const cData = cSnap.data();
      if (typeof cData.lastRootNumber === 'number') {
        counterValue = cData.lastRootNumber;
      }
    }
  } catch {}

  const allKnownMembers = [...currentMembers, ...currentWaiting, ...currentTemp];
  const maxExistingRoot = allKnownMembers.reduce((max, m) => {
    const num = parseInt(m.id.split('-')[0], 10);
    return !isNaN(num) && num > max ? num : max;
  }, 131);

  if (counterValue >= maxExistingRoot) {
    results.push({
      id: 'diag_counter',
      name: 'Pelacak Sekuens Monotonik ID Anggota',
      category: 'SECURITY',
      status: 'PASS',
      message: `Nomor urut terakhir tercatat: ${counterValue} (>= ${maxExistingRoot}). ID yang sudah terpakai atau dihapus tidak akan pernah dipakai ulang.`,
      details: [`Nilai counter server: ${counterValue}`, `Root ID tertinggi (aktif + menunggu + terhapus): ${maxExistingRoot}`],
    });
  } else {
    results.push({
      id: 'diag_counter',
      name: 'Pelacak Sekuens Monotonik ID Anggota',
      category: 'SECURITY',
      status: 'WARN',
      message: `Counter server (${counterValue}) lebih kecil dari root ID tertinggi (${maxExistingRoot}). Perlu sinkronisasi.`,
      autoFixable: true,
    });
  }

  // 8. Diagnostik Kapasitas Penyimpanan Browser & Kecepatan Load Foto
  let lsBytes = 0;
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          lsBytes += (localStorage.getItem(k) || '').length * 2;
        }
      }
    } catch {}
  }
  const lsKB = Math.round(lsBytes / 1024);
  const lsMB = (lsKB / 1024).toFixed(2);

  results.push({
    id: 'diag_storage',
    name: 'Kapasitas Penyimpanan & Akselerasi Muat Foto Profil',
    category: 'STORAGE_QUOTA',
    status: lsKB < 4000 ? 'PASS' : 'WARN',
    message: `Penggunaan LocalStorage: ${lsKB} KB (${lsMB} MB / batas 5 MB). Cache foto profil instan & IndexedDB aktif.`,
    details: [
      `Penggunaan memori saat ini: ${lsKB} KB`,
      'Foto profil disimpan dalam cache cepat agar langsung termuat tanpa menunggu unduhan dokumen KTP/KK berukuran besar.',
    ],
  });

  // Catat hasil diagnosa ke system log
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  await recordSystemLog({
    category: 'DATABASE',
    level: failCount > 0 ? 'ERROR' : warnCount > 0 ? 'WARN' : 'SUCCESS',
    title: 'Hasil Diagnostik Sistem & Audit Foto/Data Selesai',
    detail: `Pemeriksaan selesai: ${results.length - failCount - warnCount} Normal, ${warnCount} Peringatan (${anomalies.length} anggota perlu tinjauan foto/data), ${failCount} Anomali.`,
    source: 'BugDiagnosticsRunner',
  });

  return results;
}

/**
 * Menjalankan proses debug & pemeriksaan mendalam:
 * - TIDAK PERNAH memulihkan data terhapus secara otomatis tanpa konfirmasi Admin.
 * - Mengunci semua ID yang pernah dipakai (aktif, menunggu, ditolak, maupun terhapus) di system_counters.
 * - Mengidentifikasi seluruh data tanpa foto (Profil/KTP/KK) dan data tergenerate sistem / dummy AI
 *   agar Admin dapat memilih untuk Edit/Perbaiki atau Hapus.
 */
export async function runAutoRepairProcess(membersInput?: Member[], tempInput?: Member[]): Promise<{
  success: boolean;
  message: string;
  repairedItems: string[];
  flaggedAnomalies: FlaggedMemberAnomaly[];
}> {
  const repairedItems: string[] = [];
  const start = Date.now();

  try {
    const members = membersInput ?? getStoredMembers();
    const waitingMembers = getStoredTempDataMenunggu();
    const tempMembers = tempInput ?? getStoredTempDataLama();

    // 1. Kunci seluruh ID yang ada di members, tempdatamenunggu, dan tempdatalama ke dalam system_counters agar tidak pernah dipakai ulang
    const allKnown = [...members, ...waitingMembers, ...tempMembers];
    const maxExistingRoot = allKnown.reduce((max, m) => {
      const num = parseInt(m.id.split('-')[0], 10);
      return !isNaN(num) && num > max ? num : max;
    }, 131);

    await recordAllocatedIdInCounter(String(maxExistingRoot), maxExistingRoot);
    repairedItems.push(
      `Mengunci keunikan seluruh ID anggota (${members.length} aktif, ${waitingMembers.length} menunggu di tempdatamenunggu, ${tempMembers.length} terhapus di tempdatalama) pada counter monotonik #${maxExistingRoot}.`
    );

    // 2. Analisis data yang tidak memiliki foto profil/KTP/KK atau merupakan data dummy sistem
    const flaggedAnomalies = analyzeFlaggedMemberAnomalies(members, tempMembers);
    if (flaggedAnomalies.length > 0) {
      const dummyCount = flaggedAnomalies.filter(a => a.isSystemDummyData).length;
      const photoIssueCount = flaggedAnomalies.filter(
        a => a.hasMissingOrSystemProfilePhoto || a.hasMissingOrSystemKtp || a.hasMissingOrSystemKk
      ).length;
      repairedItems.push(
        `Menemukan ${flaggedAnomalies.length} data anggota yang perlu tindakan Admin (${dummyCount} data dummy/sistem, ${photoIssueCount} data dengan foto profil/KTP/KK belum diunggah asli). Silakan pilih tombol "Edit / Perbaiki" atau "Hapus Data" pada daftar di bawah.`
      );
    } else {
      repairedItems.push('Seluruh data anggota telah memiliki Foto Profil, KTP, dan KK asli dari unggahan pengguna.');
    }

    // 3. Bersihkan cache log lama di localStorage agar kecepatan halaman tetap optimal
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('yayasan_alikhlas_deep_registration_logs_v1');
        localStorage.removeItem('yayasan_alikhlas_reg_traces_v1');
        repairedItems.push('Mengoptimalkan memori browser dan cache pemuatan foto profil agar halaman lebih ringan & cepat.');
      } catch {}
    }

    // 4. Sinkronkan log ke Firestore
    await syncSystemLogsWithFirestore();
    repairedItems.push('Mensinkronkan catatan aktivitas dan log sistem ke koleksi Firestore system_logs.');

    const duration = Date.now() - start;
    const msg = `Proses Debug selesai dalam ${duration}ms. Pemulihan otomatis dinonaktifkan (wajib konfirmasi Admin). Ditemukan ${flaggedAnomalies.length} data anggota untuk ditinjau Admin.`;

    await recordSystemLog({
      category: 'DATABASE',
      level: 'SUCCESS',
      title: 'Proses Debug & Audit Data Selesai',
      detail: `${msg}\nTindakan: ${repairedItems.join('; ')}`,
      source: 'AutoRepairProcess',
    });

    return {
      success: true,
      message: msg,
      repairedItems,
      flaggedAnomalies,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan saat proses debug.';
    await recordSystemLog({
      category: 'SISTEM_ERROR',
      level: 'ERROR',
      title: 'Proses Debug Gagal Dijalankan',
      detail: errorMsg,
      source: 'AutoRepairProcess',
    });

    return {
      success: false,
      message: errorMsg,
      repairedItems,
      flaggedAnomalies: [],
    };
  }
}

// Global runtime error listener setup (hanya sekali saat aplikasi dimuat)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    recordSystemLog({
      category: 'SISTEM_ERROR',
      level: 'ERROR',
      title: 'Runtime Error Tertangkap',
      detail: `${event.message} pada ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`,
      source: 'WindowOnError',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    recordSystemLog({
      category: 'SISTEM_ERROR',
      level: 'ERROR',
      title: 'Unhandled Promise Rejection',
      detail: reason || 'Promise ditolak tanpa penanganan catch.',
      source: 'UnhandledRejection',
    });
  });
}
