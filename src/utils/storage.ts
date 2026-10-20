import { Member, AppNotification, BroadcastMessage, MemberStatus, FamilyRole } from '../types';
import { INITIAL_MEMBERS } from '../data/initialData';
import { soundEffects } from './sound';
import { SYARI_PHOTOS } from '../data/initialData';
import { 
  saveMemberToFirestore, 
  deleteMemberFromFirestore, 
  addNotificationToFirestore, 
  markAllNotificationsAsReadInFirestore 
} from '../firebase';

const STORAGE_MEMBERS_KEY = 'yayasan_alikhlas_members_v3';
const STORAGE_NOTIF_KEY = 'yayasan_alikhlas_notifications_v3';
const STORAGE_USER_KEY = 'yayasan_alikhlas_user_session_v3';
const BROADCAST_CHANNEL_NAME = 'yayasan_alikhlas_channel_nu_v3';

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

export function addNewMember(
  data: Omit<Member, 'id' | 'tanggalDaftar' | 'status'> & { status?: MemberStatus }
): Member {
  const members = getStoredMembers();
  
  // Generate ID e.g. '0120'
  const maxNum = members.reduce((max, m) => {
    const root = m.id.split('-')[0];
    const num = parseInt(root, 10);
    return !isNaN(num) && num > max ? num : max;
  }, 118);

  let nextId = String(maxNum + 1).padStart(4, '0');
  
  // If family member added to existing head of family
  if (data.kepalaKeluargaId) {
    const existingFamilyCount = members.filter(m => m.kepalaKeluargaId === data.kepalaKeluargaId || m.id === data.kepalaKeluargaId).length;
    nextId = `${data.kepalaKeluargaId}-${existingFamilyCount}`;
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

  // If head of family, update head's family count
  if (data.peranKeluarga === 'kepala_keluarga') {
    newMember.jumlahKeluarga = data.jumlahKeluarga || 1;
  }

  const updated = [newMember, ...members];
  saveMembers(updated);

  // Persist to Firebase Firestore
  saveMemberToFirestore(newMember).catch(err => {
    console.warn('Firestore add member sync note:', err);
  });

  soundEffects.playPing();

  const roleText = getPeranLabel(newMember.peranKeluarga);
  const notification = addNotification({
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

  return newMember;
}

export function updateMember(updatedMember: Member): void {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
    members[index] = updatedMember;
    saveMembers(members);

    // Persist to Firebase Firestore
    saveMemberToFirestore(updatedMember).catch(err => {
      console.warn('Firestore update member sync note:', err);
    });

    // If session matches updated member, sync session
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
