import { Member, AppNotification, BroadcastMessage, MemberStatus } from '../types';
import { INITIAL_MEMBERS } from '../data/initialData';
import { soundEffects } from './sound';

const STORAGE_MEMBERS_KEY = 'yayasan_alikhlas_members_v1';
const STORAGE_NOTIF_KEY = 'yayasan_alikhlas_notifications_v1';
const BROADCAST_CHANNEL_NAME = 'yayasan_alikhlas_channel';

// Create BroadcastChannel for real-time cross-tab synchronization
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
    return JSON.parse(raw);
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

export function addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
  const all = getStoredNotifications();
  const newNotif: AppNotification = {
    ...notification,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [newNotif, ...all.slice(0, 49)]; // keep latest 50
  saveNotifications(updated);
  return newNotif;
}

export function markAllNotificationsAsRead(): void {
  const all = getStoredNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(all);
}

// Request Browser Notifications if granted
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

// Subscribe to real-time events from other tabs
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
  
  // Format registration number if newly approved and doesn't have one
  let regNumber = prevMember.regNumber;
  if (newStatus === 'disetujui' && !regNumber) {
    const year = new Date().getFullYear();
    const randCode = Math.floor(1000 + Math.random() * 9000);
    regNumber = `${randCode}/YMWM13/II/${year} & L.${memberId}`;
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

  // Play corresponding sound
  if (newStatus === 'disetujui') {
    soundEffects.playSuccess();
  } else if (newStatus === 'ditolak') {
    soundEffects.playWarning();
  }

  // Create notification
  const statusLabel = newStatus === 'disetujui' ? 'DISETUJUI' : newStatus === 'ditolak' ? 'DITOLAK' : 'MENUNGGU ACC';
  const notification = addNotification({
    memberId: updatedMember.id,
    memberName: updatedMember.nama,
    type: newStatus === 'disetujui' ? 'status_approved' : 'status_rejected',
    message: `Status pendaftaran anggota "${updatedMember.nama}" telah diubah menjadi ${statusLabel}.`,
  });

  // System notification
  triggerSystemNotification(
    `Status Pendaftaran: ${statusLabel}`,
    `Data untuk ${updatedMember.nama} telah ${statusLabel.toLowerCase()}.`
  );

  // Broadcast to other open tabs
  broadcastRealtime({
    type: 'STATUS_CHANGED',
    payload: {
      member: updatedMember,
      notification,
    },
  });

  return { updatedMember, notification };
}

export function addNewMember(data: Omit<Member, 'id' | 'tanggalDaftar' | 'status'> & { status?: MemberStatus }): Member {
  const members = getStoredMembers();
  
  // Generate ID e.g. '0119'
  const maxId = members.reduce((max, m) => {
    const num = parseInt(m.id, 10);
    return !isNaN(num) && num > max ? num : max;
  }, 110);
  const nextId = String(maxId + 1).padStart(4, '0');

  const now = new Date().toISOString();
  const initialStatus = data.status || 'menunggu';

  const newMember: Member = {
    ...data,
    id: nextId,
    status: initialStatus,
    tanggalDaftar: now,
    tanggalDisetujui: initialStatus === 'disetujui' ? now : undefined,
  };

  const updated = [newMember, ...members];
  saveMembers(updated);

  soundEffects.playPing();

  // Notification for admin
  const notification = addNotification({
    memberId: newMember.id,
    memberName: newMember.nama,
    type: 'new_registration',
    message: `Pendaftaran baru masuk atas nama "${newMember.nama}" (ID: ${newMember.id}). Menunggu persetujuan pengurus.`,
  });

  triggerSystemNotification('Pendaftaran Baru Masuk', `Nama: ${newMember.nama}`);

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
}

export function resetToInitialData(): void {
  saveMembers(INITIAL_MEMBERS);
  saveNotifications([]);
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

// Utility: get initials from name (e.g., "Margo Suwito Utomo" -> "MS")
export function getInitials(name: string): string {
  if (!name) return 'AI';
  const clean = name.trim().replace(/[^a-zA-Z\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AI';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Utility: mask phone number except last 3 or 4 digits
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '••••••••••••';
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) return clean;
  const last3or4 = clean.slice(-3); // matches screenshot `.........037`
  return '.........' + last3or4;
}

// Format Date in Indonesian (e.g. "16 Oktober 2026")
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
