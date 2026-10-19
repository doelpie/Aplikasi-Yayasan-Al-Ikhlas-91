export type MemberStatus = 'menunggu' | 'disetujui' | 'ditolak';

export interface Member {
  id: string; // e.g., '0114'
  regNumber?: string; // e.g., '1616/YMWM13/II/2017 & L.065'
  nama: string; // Nama Kepala Keluarga
  tempatTanggalLahir: string; // e.g., 'Lamongan, 04 Mar 1987'
  alamat: string;
  jumlahKeluarga: number; // Jumlah keluarga/tanggungan (e.g., 3 org)
  noHp: string; // e.g., '081234567037'
  email?: string;
  ktpUrl?: string; // base64 or file preview url
  ktpName?: string;
  kkUrl?: string; // base64 or file preview url
  kkName?: string;
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
