import { TempDataSebelumDaftar, FamilyRole, MemberStatus } from '../types';
import {
  saveTempDataSebelumDaftarToFirestore,
  fetchTempDataSebelumDaftarFromFirestore,
  deleteTempDataSebelumDaftarFromFirestore,
} from '../firebase';
import { recordSystemLog } from './systemLogger';

const STORAGE_DEVICE_IMEI_KEY = 'yayasan_alikhlas_device_imei_v1';
const STORAGE_TEMP_BEFORE_REG_KEY = 'yayasan_alikhlas_tempdatasebelumdaftar_v1';

let cachedIpLocation: string | null = null;
let ipFetchPromise: Promise<string> | null = null;

/**
 * Menghasilkan atau mengambil IMEI / Signature unik perangkat fisik yang konsisten per perangkat
 * agar data sementara pada 'tempdatasebelumdaftar' tidak saling bertabrakan antar HP/perangkat.
 */
export function getOrGenerateDeviceImei(): string {
  if (typeof window === 'undefined') return 'IMEI-SERVER-000000000';
  try {
    const existing = localStorage.getItem(STORAGE_DEVICE_IMEI_KEY);
    if (existing && existing.length >= 10) {
      return existing;
    }

    const nav = window.navigator as any;
    const screenInfo = typeof window.screen !== 'undefined'
      ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth || 24}`
      : '0x0';
    const cores = nav.hardwareConcurrency || 4;
    const mem = nav.deviceMemory || 4;
    const rawSeed = `${screenInfo}-${cores}-${mem}-${nav.language || 'id'}`;

    // Buat 15 digit numerik bergaya IMEI + kode entropi perangkat
    let hash = 86; // TAC prefix standar perangkat seluler
    for (let i = 0; i < rawSeed.length; i++) {
      hash = (hash * 31 + rawSeed.charCodeAt(i)) % 10000000;
    }
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    const imei = `IMEI-${String(hash).padStart(7, '0')}${randomPart}`;
    localStorage.setItem(STORAGE_DEVICE_IMEI_KEY, imei);
    return imei;
  } catch {
    return `IMEI-${Date.now().toString().slice(-9)}${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

/**
 * Mendeteksi tipe dan versi browser yang digunakan pendaftar
 */
export function detectBrowserType(): string {
  if (typeof window === 'undefined') return 'Browser-Unknown';
  const ua = window.navigator.userAgent || '';

  if (ua.includes('Edg/')) {
    const ver = ua.split('Edg/')[1]?.split(' ')[0]?.split('.')[0] || '';
    return `Edge_${ver}`;
  }
  if (ua.includes('OPR/') || ua.includes('Opera')) {
    const ver = ua.split('OPR/')[1]?.split(' ')[0]?.split('.')[0] || '';
    return `Opera_${ver}`;
  }
  if (ua.includes('SamsungBrowser/')) {
    const ver = ua.split('SamsungBrowser/')[1]?.split(' ')[0] || '';
    return `SamsungBrowser_${ver}`;
  }
  if (ua.includes('UCBrowser/')) {
    const ver = ua.split('UCBrowser/')[1]?.split(' ')[0] || '';
    return `UCBrowser_${ver}`;
  }
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const ver = ua.split('Chrome/')[1]?.split(' ')[0]?.split('.')[0] || '';
    return `Chrome_${ver}`;
  }
  if (ua.includes('Firefox/')) {
    const ver = ua.split('Firefox/')[1]?.split(' ')[0]?.split('.')[0] || '';
    return `Firefox_${ver}`;
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    const ver = ua.split('Version/')[1]?.split(' ')[0] || 'Mobile';
    return `Safari_${ver}`;
  }
  return 'WebBrowser_Standard';
}

/**
 * Mendeteksi versi HP / Sistem Operasi dan model perangkat
 */
export function detectDeviceVersion(): string {
  if (typeof window === 'undefined') return 'OS-Unknown';
  const ua = window.navigator.userAgent || '';

  // Cek Android beserta versi & model HP (contoh: Android 14; SM-A546E)
  const androidMatch = ua.match(/Android\s+([0-9.]+)(?:;\s*([^;)]+))?/i);
  if (androidMatch) {
    const ver = androidMatch[1] || '';
    const model = (androidMatch[2] || 'Phone')
      .replace(/Build\/.*/i, '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    return `Android_${ver}_${model}`.slice(0, 80);
  }

  // Cek iPhone / iPad iOS
  const iosMatch = ua.match(/(iPhone|iPad|iPod).*OS\s+([0-9_]+)/i);
  if (iosMatch) {
    const device = iosMatch[1] || 'iPhone';
    const ver = (iosMatch[2] || '').replace(/_/g, '.');
    return `${device}_iOS_${ver}`.slice(0, 80);
  }

  if (ua.includes('Windows NT 10.0')) return 'PC_Windows_10_11';
  if (ua.includes('Windows NT')) return 'PC_Windows';
  if (ua.includes('Mac OS X')) return 'Mac_OS_X';
  if (ua.includes('Linux')) return 'Linux_Desktop';

  return (window.navigator.platform || 'Device_Standard').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Mengambil informasi IP dan Lokasi / Zona Waktu perangkat dengan cepat (non-blocking)
 */
export async function resolveIpLocation(): Promise<string> {
  if (cachedIpLocation) return cachedIpLocation;
  if (ipFetchPromise) return ipFetchPromise;

  const tz = typeof Intl !== 'undefined'
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar').replace(/\//g, '-')
    : 'Asia-Makassar';

  ipFetchPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.ip) {
          cachedIpLocation = `${data.ip}_${tz}`;
          return cachedIpLocation;
        }
      }
    } catch {}
    cachedIpLocation = `LocalIP_${tz}`;
    return cachedIpLocation;
  })();

  return ipFetchPromise;
}

/**
 * Membuat idtempdata yang 100% unik berdasarkan:
 * - IP Location
 * - Tipe Browser
 * - Versi HP / OS
 * - IMEI Perangkat
 * - Timestamp & Entropi Sesi
 * Hanya menggunakan karakter valid Firestore ID: ^[a-zA-Z0-9_\-]+$ (maks 128 karakter)
 */
export function generateUniqueIdTempData(ipLocation?: string): string {
  const imei = getOrGenerateDeviceImei().replace(/[^a-zA-Z0-9_-]/g, '');
  const browser = detectBrowserType().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  const device = detectDeviceVersion().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 22);
  const ipClean = (ipLocation || cachedIpLocation || 'Asia-Makassar')
    .replace(/\./g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 24);
  const timePart = Date.now().toString(36).toUpperCase();
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();

  const rawId = `TMP_${imei}_${device}_${browser}_${ipClean}_${timePart}${randPart}`;
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

/**
 * Menyimpan daftar tempdatasebelumdaftar di penyimpanan lokal sebagai cadangan cepat
 */
export function getStoredTempDataSebelumDaftar(): TempDataSebelumDaftar[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_TEMP_BEFORE_REG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTempDataSebelumDaftar(list: TempDataSebelumDaftar[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Simpan versi ringan di localStorage (maks 30 draft terbaru)
    const lightweight = list.slice(0, 30).map(item => ({
      ...item,
      fotoUrl: item.fotoUrl && item.fotoUrl.length > 5000 ? item.fotoUrl.slice(0, 50) + '...[ersimpan_di_firestore]' : item.fotoUrl,
      ktpUrl: item.ktpUrl && item.ktpUrl.length > 5000 ? '[tersimpan_di_firestore]' : item.ktpUrl,
      kkUrl: item.kkUrl && item.kkUrl.length > 5000 ? '[tersimpan_di_firestore]' : item.kkUrl,
    }));
    localStorage.setItem(STORAGE_TEMP_BEFORE_REG_KEY, JSON.stringify(lightweight));
  } catch {}
}

/**
 * Menyimpan dan mensinkronkan data sementara pendaftaran ke koleksi 'tempdatasebelumdaftar' di Firestore
 */
export async function syncDraftToTempDataSebelumDaftar(
  idtempdata: string,
  formFields: {
    sourceForm: 'halaman_daftar_publik' | 'halaman_admin';
    statusDraft?: 'sedang_mengisi' | 'selesai_daftar';
    finalMemberId?: string;
    regNumber?: string;
    nik?: string;
    noKk?: string;
    nama?: string;
    tempatTanggalLahir?: string;
    alamat?: string;
    noHp?: string;
    email?: string;
    peranKeluarga?: FamilyRole;
    kepalaKeluargaId?: string;
    namaKepalaKeluarga?: string;
    jumlahKeluarga?: number;
    fotoUrl?: string;
    fotoName?: string;
    ktpUrl?: string;
    ktpName?: string;
    kkUrl?: string;
    kkName?: string;
    status?: MemberStatus;
    catatanPenolakan?: string;
    createdAt?: string;
  }
): Promise<TempDataSebelumDaftar> {
  const ipLocation = await resolveIpLocation();
  const browserType = detectBrowserType();
  const deviceVersion = detectDeviceVersion();
  const deviceImei = getOrGenerateDeviceImei();
  const nowIso = new Date().toISOString();

  const draft: TempDataSebelumDaftar = {
    idtempdata,
    ipLocation,
    browserType,
    deviceVersion,
    deviceImei,
    sourceForm: formFields.sourceForm,
    statusDraft: formFields.statusDraft || 'sedang_mengisi',
    finalMemberId: formFields.finalMemberId || '',
    regNumber: formFields.regNumber || '',
    nik: formFields.nik || '',
    noKk: formFields.noKk || '',
    nama: formFields.nama || '',
    tempatTanggalLahir: formFields.tempatTanggalLahir || '',
    alamat: formFields.alamat || '',
    noHp: formFields.noHp || '',
    email: formFields.email || '',
    peranKeluarga: formFields.peranKeluarga || 'kepala_keluarga',
    kepalaKeluargaId: formFields.kepalaKeluargaId || '',
    namaKepalaKeluarga: formFields.namaKepalaKeluarga || '',
    jumlahKeluarga: typeof formFields.jumlahKeluarga === 'number' ? formFields.jumlahKeluarga : 1,
    fotoUrl: formFields.fotoUrl || '',
    fotoName: formFields.fotoName || '',
    ktpUrl: formFields.ktpUrl || '',
    ktpName: formFields.ktpName || '',
    kkUrl: formFields.kkUrl || '',
    kkName: formFields.kkName || '',
    status: formFields.status || 'menunggu',
    catatanPenolakan: formFields.catatanPenolakan || '',
    createdAt: formFields.createdAt || nowIso,
    updatedAt: nowIso,
  };

  // Simpan ke lokal terlebih dahulu
  const currentLocal = getStoredTempDataSebelumDaftar();
  const updatedLocal = [draft, ...currentLocal.filter(d => d.idtempdata !== idtempdata)];
  saveLocalTempDataSebelumDaftar(updatedLocal);

  // Sinkronkan ke koleksi Firestore 'tempdatasebelumdaftar'
  await saveTempDataSebelumDaftarToFirestore(draft);

  return draft;
}

export {
  fetchTempDataSebelumDaftarFromFirestore,
  deleteTempDataSebelumDaftarFromFirestore,
};
