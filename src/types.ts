export type FamilyRole = 'kepala_keluarga' | 'istri' | 'anak';
export type MemberStatus = 'menunggu' | 'disetujui' | 'ditolak';

export interface Member {
  id: string; // e.g., '0114'
  regNumber?: string; // e.g., '1614/YMWM13/II/2026 & L.063'
  
  // Wajib Identitas Sesuai KTP / KIA
  nik: string; // 16 digit Nomor KTP / KIA (wajib)
  nama: string; // Nama Lengkap Sesuai KTP (wajib)
  alamat: string; // Alamat Lengkap (wajib)
  noHp: string; // Nomor HP / WA aktif (wajib)
  
  // Relasi & Kartu Keluarga
  noKk: string; // Nomor Kartu Keluarga (16 digit)
  peranKeluarga: FamilyRole; // 'kepala_keluarga' | 'istri' | 'anak'
  kepalaKeluargaId?: string; // Relasi ke ID Kepala Keluarga (jika istri atau anak)
  namaKepalaKeluarga?: string; // Nama Kepala Keluarga terkait
  
  // Data Tambahan
  tempatTanggalLahir: string; // e.g., 'Surabaya, 12 Mei 1978'
  jumlahKeluarga?: number; // Total anggota keluarga (khusus kepala keluarga)
  email?: string;
  fotoUrl?: string; // Foto diri / Pas foto untuk kartu anggota (wajib)
  fotoName?: string;
  
  // Dokumen Lampiran
  ktpUrl?: string;
  ktpName?: string;
  kkUrl?: string;
  kkName?: string;
  
  // Status Approval Admin
  status: MemberStatus;
  catatanPenolakan?: string;
  tanggalDaftar: string; // ISO date string
  tanggalDisetujui?: string; // ISO date string
  deletedAt?: string; // ISO date string when moved to tempdatalama
  deletedReason?: string;
}

/**
 * Koleksi 'tempdatasebelumdaftar':
 * Menyimpan sementara input formulir pendaftaran secara real-time (interval 5 detik)
 * dengan keunikan idtempdata berdasarkan IP/Location, Browser, Versi HP/OS, dan IMEI/Device ID.
 */
export interface TempDataSebelumDaftar {
  idtempdata: string;
  ipLocation: string;
  browserType: string;
  deviceVersion: string;
  deviceImei: string;
  sourceForm: 'halaman_daftar_publik' | 'halaman_admin';
  statusDraft: 'sedang_mengisi' | 'selesai_daftar';
  finalMemberId?: string;

  // Seluruh field pendaftaran (sama dengan Member)
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

  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface AppNotification {
  id: string;
  memberId: string;
  memberName: string;
  type: 'status_approved' | 'status_rejected' | 'new_registration' | 'data_updated';
  message: string;
  timestamp: string;
  read: boolean;

  // Seluruh field lengkap pendaftar yang disimpan di koleksi Firestore `notifications`
  // (Namun di UI aplikasi umum hanya ditampilkan Nama Anggota, ID Anggota, dan Tanggal+Jam detail)
  regNumber?: string;
  nik?: string;
  nama?: string;
  tempatTanggalLahir?: string;
  alamat?: string;
  noHp?: string;
  noKk?: string;
  peranKeluarga?: FamilyRole;
  kepalaKeluargaId?: string;
  namaKepalaKeluarga?: string;
  jumlahKeluarga?: number;
  email?: string;
  fotoUrl?: string;
  fotoName?: string;
  ktpUrl?: string;
  ktpName?: string;
  kkUrl?: string;
  kkName?: string;
  status?: MemberStatus;
  catatanPenolakan?: string;
  tanggalDaftar?: string; // ISO string lengkap dengan tanggal & jam saat mendaftar
  tanggalDisetujui?: string; // ISO string lengkap dengan tanggal & jam saat disetujui admin
}

export interface BroadcastMessage {
  type: 'STATUS_CHANGED' | 'NEW_REGISTRATION' | 'DATA_SYNC';
  payload: {
    member: Member;
    notification?: AppNotification;
  };
}

// Session login untuk Warga
export interface UserSession {
  member: Member;
  isLoggedIn: boolean;
}

// Jenis Kegiatan Yayasan Al Ikhlas
export type ActivityType = 'rapat_pengurus' | 'pengajian_umum' | 'arisan';

// Data Anggota yang Hadir (Presensi Scan QR)
export interface ActivityAttendee {
  memberId: string;
  memberNama: string;
  memberNik: string;
  memberPeran: string;
  memberFotoUrl?: string;
  scanTimestamp: string; // ISO date string
  scanTimeFormatted: string; // e.g., '19:45 WITA'
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
}

// Data Kegiatan Yayasan
export interface Activity {
  id: string; // e.g., 'ACT-2026-001'
  judul: string;
  jenis: ActivityType;
  tanggal: string; // YYYY-MM-DD
  jamMulai: string; // HH:mm
  jamSelesai?: string; // HH:mm
  lokasi?: string;
  deskripsi: string;
  pesertaIds: string[]; // Daftar ID Anggota yang terdaftar sebagai peserta
  kehadiran: ActivityAttendee[]; // Daftar presensi anggota yang hadir scan QR
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// TIPE DATA MENU TEKNIS (IT) & LOGGING
// ==========================================

export type SystemLogCategory = 
  | 'DATABASE' 
  | 'AUTH_SECURITY' 
  | 'PENDAFTARAN' 
  | 'ADMIN_ACTION' 
  | 'PRESENSI' 
  | 'SISTEM_ERROR';

export type SystemLogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

export interface SystemLogEntry {
  id: string;
  category: SystemLogCategory;
  level: SystemLogLevel;
  title: string;
  detail: string;
  timestamp: string; // ISO string
  source?: string;
  data?: Record<string, any>;
}

export interface FlaggedMemberAnomaly {
  member: Member;
  issues: string[];
  isSystemDummyData: boolean;
  hasMissingOrSystemProfilePhoto: boolean;
  hasMissingOrSystemKtp: boolean;
  hasMissingOrSystemKk: boolean;
  hasDuplicateIdOrNik: boolean;
}

export interface BugDiagnosticResult {
  id: string;
  name: string;
  category: 'KONEKSI' | 'INTEGRITAS_DATA' | 'RELASI_KELUARGA' | 'STORAGE_QUOTA' | 'SECURITY' | 'AUDIT_FOTO_DOKUMEN';
  status: 'PASS' | 'WARN' | 'FAIL' | 'PENDING';
  message: string;
  latencyMs?: number;
  details?: string[];
  autoFixable?: boolean;
}
