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
}

export interface AppNotification {
  id: string;
  memberId: string;
  memberName: string;
  type: 'status_approved' | 'status_rejected' | 'new_registration' | 'data_updated';
  message: string;
  timestamp: string;
  read: boolean;
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
