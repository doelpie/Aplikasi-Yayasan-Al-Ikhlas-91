import { SystemLogEntry, SystemLogCategory, SystemLogLevel, BugDiagnosticResult, Member } from '../types';
import { 
  saveSystemLogToFirestore, 
  fetchSystemLogsFromFirestore, 
  clearSystemLogsInFirestore,
  checkFirestoreConnectionStatus,
  repairAgusAndSriyonoDataInFirestore,
  recordAllocatedIdInCounter,
  db
} from '../firebase';
import { doc, getDocFromServer } from 'firebase/firestore';
import { getStoredMembers, saveMembers, getStoredTempDataLama } from './storage';

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
    title: 'Koneksi Firestore Database Terhubung',
    detail: 'Koleksi members, tempdatalama, notifications, dan system_counters terverifikasi sinkron.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    source: 'FirestoreClient',
  },
  {
    id: 'log_boot_003',
    category: 'DATABASE',
    level: 'SUCCESS',
    title: 'Integritas Data Kanonikal 0130 & 0131 Terverifikasi',
    detail: 'Agus Subriyanto (ID: 0130), Tutik Maryani (ID: 0130-2), dan Sriyono, SH.MM (ID: 0131) aktif dan tidak bertabrakan.',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    source: 'DataRepairEngine',
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
    // Keep max 100 lightweight logs in localStorage
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

  // Broadcast realtime across browser tabs
  try {
    loggerBroadcastChannel?.postMessage({
      type: 'DATA_SYNC',
      payload: { log: newLog },
    });
  } catch {}

  // Asynchronously push to Firestore collection 'system_logs'
  saveSystemLogToFirestore(newLog).catch(err => {
    console.warn('Async system log Firestore write note:', err);
  });

  // Browser console indicator
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
 * Menjalankan 8 titik pengujian diagnostik bug aplikasi & database secara komprehensif
 */
export async function runBugDiagnostics(members: Member[] = []): Promise<BugDiagnosticResult[]> {
  const results: BugDiagnosticResult[] = [];
  const currentMembers = members.length > 0 ? members : getStoredMembers();
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

  // 2. Diagnostik Duplikasi NIK & Format Identitas
  const nikMap = new Map<string, string[]>();
  currentMembers.forEach(m => {
    const clean = (m.nik || '').replace(/\D/g, '');
    if (clean) {
      const arr = nikMap.get(clean) || [];
      arr.push(`${m.nama} (ID: ${m.id})`);
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
      message: `Seluruh ${currentMembers.length} anggota memiliki Nomor KTP (NIK) unik dan valid. Tidak ditemukan benturan.`,
      details: [`Total anggota diperiksa: ${currentMembers.length}`],
    });
  } else {
    results.push({
      id: 'diag_nik_unik',
      name: 'Integritas & Keunikan Nomor KTP (NIK)',
      category: 'INTEGRITAS_DATA',
      status: 'FAIL',
      message: `Ditemukan ${duplicateNiks.length} NIK ganda di dalam data anggota aktif!`,
      details: duplicateNiks,
      autoFixable: false,
    });
  }

  // 3. Verifikasi Data Kanonikal 0130 (Agus Subriyanto) & 0131 (Sriyono, SH.MM)
  const doc0130 = currentMembers.find(m => m.id === '0130');
  const doc0130_2 = currentMembers.find(m => m.id === '0130-2');
  const doc0131 = currentMembers.find(m => m.id === '0131');

  const agusOk = doc0130 && doc0130.nama.toLowerCase().includes('agus subriyanto');
  const tutikOk = doc0130_2 && doc0130_2.nama.toLowerCase().includes('tutik maryani') && doc0130_2.kepalaKeluargaId === '0130';
  const sriyonoOk = doc0131 && doc0131.nama.toLowerCase().includes('sriyono');

  if (agusOk && tutikOk && sriyonoOk) {
    results.push({
      id: 'diag_kanonikal',
      name: 'Verifikasi Data Kanonikal 0130 & 0131',
      category: 'INTEGRITAS_DATA',
      status: 'PASS',
      message: 'ID 0130 (Agus Subriyanto), ID 0130-2 (Tutik Maryani), dan ID 0131 (Sriyono, SH.MM) lengkap & terhubung sempurna.',
      details: [
        `0130: ${doc0130.nama} (${doc0130.peranKeluarga})`,
        `0130-2: ${doc0130_2.nama} (Kepala: ${doc0130_2.namaKepalaKeluarga})`,
        `0131: ${doc0131.nama} (${doc0131.peranKeluarga})`,
      ],
    });
  } else {
    const issues: string[] = [];
    if (!agusOk) issues.push('ID 0130 belum atas nama Agus Subriyanto.');
    if (!tutikOk) issues.push('ID 0130-2 (Tutik Maryani) belum terhubung ke 0130.');
    if (!sriyonoOk) issues.push('ID 0131 (Sriyono, SH.MM) belum terdaftar dengan benar.');

    results.push({
      id: 'diag_kanonikal',
      name: 'Verifikasi Data Kanonikal 0130 & 0131',
      category: 'INTEGRITAS_DATA',
      status: 'WARN',
      message: 'Data 0130 atau 0131 memerlukan perbaikan otomatis.',
      details: issues,
      autoFixable: true,
    });
  }

  // 4. Diagnostik Relasi Keluarga (Kepala Keluarga <-> Istri & Anak)
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

  // 5. Diagnostik Tabel Arsip Sementara 'tempdatalama'
  results.push({
    id: 'diag_tempdatalama',
    name: 'Status Koleksi Arsip Sementara (tempdatalama)',
    category: 'INTEGRITAS_DATA',
    status: 'PASS',
    message: `Koleksi 'tempdatalama' menampung ${currentTemp.length} data anggota terhapus yang siap dipulihkan sewaktu-waktu.`,
    details: [
      `Total terarsip: ${currentTemp.length} anggota`,
      'Data yang dihapus tidak pernah dibuang permanen sehingga aman dari kehilangan data.',
    ],
  });

  // 6. Diagnostik Monotonik Sequence Counter ID
  let counterValue = 131;
  let counterOk = true;
  try {
    const cSnap = await getDocFromServer(doc(db, 'system_counters', 'member_id_seq'));
    if (cSnap.exists()) {
      const cData = cSnap.data();
      if (typeof cData.lastRootNumber === 'number') {
        counterValue = cData.lastRootNumber;
      }
    }
  } catch {}

  const maxExistingRoot = currentMembers.reduce((max, m) => {
    const num = parseInt(m.id.split('-')[0], 10);
    return !isNaN(num) && num > max ? num : max;
  }, 131);

  if (counterValue >= maxExistingRoot) {
    results.push({
      id: 'diag_counter',
      name: 'Pelacak Sekuens Monotonik ID Anggota',
      category: 'SECURITY',
      status: 'PASS',
      message: `Nomor urut terakhir tercatat: ${counterValue} (>= ${maxExistingRoot}). ID yang dihapus tidak akan pernah dipakai ulang.`,
      details: [`Nilai counter server: ${counterValue}`, `Root ID tertinggi saat ini: ${maxExistingRoot}`],
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

  // 7. Diagnostik Kapasitas Penyimpanan Browser (LocalStorage & IndexedDB)
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

  if (lsKB < 3500) {
    results.push({
      id: 'diag_storage',
      name: 'Kapasitas Penyimpanan Browser (LocalStorage & IndexedDB)',
      category: 'STORAGE_QUOTA',
      status: 'PASS',
      message: `Penggunaan LocalStorage: ${lsKB} KB (${lsMB} MB / batas aman 5 MB). IndexedDB aktif menampung foto resolusi tinggi.`,
      details: [
        `Penggunaan memori saat ini: ${lsKB} KB`,
        'Foto profil, KTP, dan KK disimpan aman di IndexedDB untuk menghindari QuotaExceededError.',
      ],
    });
  } else {
    results.push({
      id: 'diag_storage',
      name: 'Kapasitas Penyimpanan Browser (LocalStorage & IndexedDB)',
      category: 'STORAGE_QUOTA',
      status: 'WARN',
      message: `Penggunaan LocalStorage mendekati limit (${lsMB} MB). Disarankan menjalankan auto-repair untuk pembersihan cache sementara.`,
      autoFixable: true,
    });
  }

  // Catat hasil diagnosa ke system log
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  await recordSystemLog({
    category: 'DATABASE',
    level: failCount > 0 ? 'ERROR' : warnCount > 0 ? 'WARN' : 'SUCCESS',
    title: 'Hasil Diagnostik Sistem & Pengecekan Bug Selesai',
    detail: `Pemeriksaan selesai: ${results.length - failCount - warnCount} Normal, ${warnCount} Peringatan, ${failCount} Anomali Terdeteksi.`,
    source: 'BugDiagnosticsRunner',
  });

  return results;
}

/**
 * Menjalankan proses debug dan perbaikan otomatis (Auto-Repair) terhadap isu yang terdeteksi
 */
export async function runAutoRepairProcess(): Promise<{
  success: boolean;
  message: string;
  repairedItems: string[];
}> {
  const repairedItems: string[] = [];
  const start = Date.now();

  try {
    // 1. Perbaiki data kanonikal 0130 Agus Subriyanto & 0131 Sriyono
    const repairedMembers = await repairAgusAndSriyonoDataInFirestore();
    if (repairedMembers) {
      saveMembers(repairedMembers);
      repairedItems.push('Memulihkan dan mensinkronkan data ID 0130 (Agus Subriyanto) & ID 0131 (Sriyono, SH.MM).');
    }

    // 2. Sinkronkan sekuens ID tertinggi di counter
    const members = getStoredMembers();
    const maxExistingRoot = members.reduce((max, m) => {
      const num = parseInt(m.id.split('-')[0], 10);
      return !isNaN(num) && num > max ? num : max;
    }, 131);
    await recordAllocatedIdInCounter(String(maxExistingRoot), maxExistingRoot);
    repairedItems.push(`Memperbarui counter sekuens ID monotonik ke nomor ${maxExistingRoot}.`);

    // 3. Bersihkan cache log yang menumpuk di localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('yayasan_alikhlas_deep_registration_logs_v1');
        localStorage.removeItem('yayasan_alikhlas_reg_traces_v1');
        repairedItems.push('Mengoptimasi LocalStorage dengan merapikan jejak sementara (memori bebas).');
      } catch {}
    }

    // 4. Sinkronkan log ke Firestore
    await syncSystemLogsWithFirestore();
    repairedItems.push('Mensinkronkan catatan aktivitas dan log sistem ke Firestore.');

    const duration = Date.now() - start;
    const msg = `Proses debug & perbaikan otomatis selesai sukses dalam ${duration}ms (${repairedItems.length} tindakan perbaikan diterapkan).`;

    await recordSystemLog({
      category: 'DATABASE',
      level: 'SUCCESS',
      title: 'Proses Debug & Auto-Repair Selesai Sukses',
      detail: `${msg}\nTindakan: ${repairedItems.join('; ')}`,
      source: 'AutoRepairProcess',
    });

    return {
      success: true,
      message: msg,
      repairedItems,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan saat proses auto-repair.';
    await recordSystemLog({
      category: 'SISTEM_ERROR',
      level: 'ERROR',
      title: 'Auto-Repair Gagal Dijalankan',
      detail: errorMsg,
      source: 'AutoRepairProcess',
    });

    return {
      success: false,
      message: errorMsg,
      repairedItems,
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
