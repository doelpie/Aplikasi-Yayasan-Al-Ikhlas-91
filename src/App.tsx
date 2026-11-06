import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Member, AppNotification, BroadcastMessage, Activity, ActivityAttendee } from './types';
import { 
  getStoredMembers, 
  saveMembers, 
  getStoredTempDataMenunggu,
  saveTempDataMenunggu,
  getStoredTempDataLama,
  saveTempDataLama,
  reconcileAuthoritativeMembers,
  restoreMemberFromTempDataLamaAsync,
  getStoredNotifications, 
  saveNotifications,
  markAllNotificationsAsRead, 
  subscribeToRealtimeEvents, 
  updateMemberStatusAsync,
  addNewMemberAsync,
  updateMemberAsync,
  deleteMemberAsync, 
  resetToInitialData,
  requestNotificationPermission,
  getCurrentUserSession,
  setCurrentUserSession,
  getStoredActivities,
  getStoredTempKegiatanLama,
  saveTempKegiatanLama,
  reconcileAuthoritativeActivities,
  addNewActivityAsync,
  updateActivityAsync,
  deleteActivityAsync,
  restoreActivityFromTempKegiatanLamaAsync,
  recordAttendance,
  loadMembersFromIndexedDB
} from './utils/storage';
import { soundEffects } from './utils/sound';
import { runAutoRepairProcess } from './utils/systemLogger';
import { Header } from './components/Header';
import { MemberList } from './components/MemberList';
import { VerifyCardModal } from './components/VerifyCardModal';
import { MemberCardModal } from './components/MemberCardModal';
import { RegisterForm } from './components/RegisterForm';
import { FamilyPortal } from './components/FamilyPortal';
import { InfoSection } from './components/InfoSection';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminMemberForm } from './components/AdminMemberForm';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { NotificationToast } from './components/NotificationToast';
import { 
  subscribeMembersFirestore, 
  subscribeTempDataMenungguFirestore,
  subscribeTempDataLamaFirestore,
  subscribeNotificationsFirestore, 
  subscribeActivitiesFirestore,
  subscribeTempKegiatanLamaFirestore,
  fetchActivitiesFromFirestore,
  fetchTempKegiatanLamaFromFirestore,
  seedInitialDataIfEmpty,
  subscribeToQuotaLimitErrors,
  isFirestoreQuotaError,
  QUOTA_LIMIT_MESSAGE
} from './firebase';
import { Users, FilePenLine, Info, Shield, User, AlertTriangle, X } from 'lucide-react';

export default function App() {
  // Navigation State: 'anggota' | 'daftar' | 'profil' | 'info' | 'admin'
  const [activeTab, setActiveTab] = useState<'anggota' | 'daftar' | 'profil' | 'info' | 'admin'>('anggota');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Warga User Session (Kepala Keluarga, Istri, Anak)
  const [currentUserSession, setSessionMember] = useState<Member | null>(() => getCurrentUserSession());
  const sessionRef = React.useRef<Member | null>(currentUserSession);
  useEffect(() => {
    sessionRef.current = currentUserSession;
  }, [currentUserSession]);

  // Data State
  const [members, setMembers] = useState<Member[]>(() => getStoredMembers());
  const [tempDataMenunggu, setTempDataMenunggu] = useState<Member[]>(() => getStoredTempDataMenunggu());
  const [tempDataLama, setTempDataLama] = useState<Member[]>(() => getStoredTempDataLama());
  const [activities, setActivities] = useState<Activity[]>(() => getStoredActivities());
  const [tempKegiatanLama, setTempKegiatanLama] = useState<Activity[]>(() => getStoredTempKegiatanLama());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getStoredNotifications());
  const latestRemoteMembersRef = React.useRef<Member[]>(getStoredMembers());
  const latestRemoteWaitingRef = React.useRef<Member[]>(getStoredTempDataMenunggu());
  const latestRemoteDeletedRef = React.useRef<Member[]>(getStoredTempDataLama());
  const latestRemoteActivitiesRef = React.useRef<Activity[] | undefined>(undefined);
  const latestRemoteDeletedActivitiesRef = React.useRef<Activity[] | undefined>(undefined);

  // Modals & Popups State
  const [verifyingMember, setVerifyingMember] = useState<Member | null>(null);
  const [cardModalMember, setCardModalMember] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ title: string; url?: string; fileName?: string } | null>(null);

  // Real-time Notification Toast State & Quota Limit Alert State
  const [currentToast, setCurrentToast] = useState<AppNotification | null>(null);
  const [quotaErrorBanner, setQuotaErrorBanner] = useState<string | null>(null);
  const [isOpenNotifDrawer, setIsOpenNotifDrawer] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync real-time updates across tabs
  const handleRealtimeMessage = useCallback((msg: BroadcastMessage) => {
    if (msg.type === 'STATUS_CHANGED' || msg.type === 'NEW_REGISTRATION' || msg.type === 'DATA_SYNC') {
      const refreshedMembers = getStoredMembers();
      setMembers(refreshedMembers);
      setTempDataMenunggu(getStoredTempDataMenunggu());
      setTempDataLama(getStoredTempDataLama());
      setActivities(getStoredActivities());
      setTempKegiatanLama(getStoredTempKegiatanLama());

      // Refresh current session if matches
      const activeUser = sessionRef.current;
      if (activeUser) {
        const freshUser = refreshedMembers.find(m => m.id === activeUser.id);
        if (freshUser) {
          setSessionMember(freshUser);
          setCurrentUserSession(freshUser);
        }
      }

      if (msg.payload.notification) {
        setNotifications(getStoredNotifications());
        setCurrentToast(msg.payload.notification);

        if (soundEnabled) {
          if (msg.payload.notification.type === 'status_approved') {
            soundEffects.playSuccess();
          } else if (msg.payload.notification.type === 'status_rejected') {
            soundEffects.playWarning();
          } else {
            soundEffects.playPing();
          }
        }
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    requestNotificationPermission();

    // 0. Subscribe to Firebase Quota Limit notifications
    const unsubQuota = subscribeToQuotaLimitErrors((message) => {
      setQuotaErrorBanner(message);
      soundEffects.playWarning();
      const quotaNotif: AppNotification = {
        id: 'quota_limit_' + Date.now(),
        memberId: 'SYSTEM',
        memberName: 'Database Firebase',
        type: 'status_rejected',
        message,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setCurrentToast(quotaNotif);
    });

    // 1. Initial sync check for Firebase Firestore & IndexedDB photo hydration
    seedInitialDataIfEmpty().catch(err => console.warn('Firestore sync note:', err));
    loadMembersFromIndexedDB().then((idbMembers) => {
      if (idbMembers && idbMembers.length > 0) {
        setMembers((prev) => {
          if (!prev || prev.length === 0) return prev;
          return prev.map(m => {
            const match = idbMembers.find(im => im.id === m.id);
            return match ? { ...match, ...m, fotoUrl: m.fotoUrl || match.fotoUrl, ktpUrl: m.ktpUrl || match.ktpUrl, kkUrl: m.kkUrl || match.kkUrl } : m;
          });
        });
      }
    }).catch(() => {});

    const applyAuthoritativeReconciliation = () => {
      const reconciled = reconcileAuthoritativeMembers(
        latestRemoteMembersRef.current,
        latestRemoteWaitingRef.current,
        latestRemoteDeletedRef.current
      );
      setMembers(reconciled);
      saveMembers(reconciled);

      const activeUser = sessionRef.current;
      if (activeUser) {
        const freshUser = reconciled.find(m => m.id === activeUser.id);
        if (freshUser) {
          setSessionMember(freshUser);
          setCurrentUserSession(freshUser);
        }
      }
    };

    const applyActivitiesReconciliation = async () => {
      const { activities: unifiedActivities } = await reconcileAuthoritativeActivities(
        latestRemoteActivitiesRef.current,
        latestRemoteDeletedActivitiesRef.current
      );
      setActivities(unifiedActivities);
    };

    // Immediate startup auto-repair & cross-device schedule reconciliation
    reconcileAuthoritativeActivities()
      .then(({ activities: unified }) => {
        latestRemoteActivitiesRef.current = unified;
        setActivities(unified);
      })
      .catch(err => console.warn('Initial activity reconciliation note:', err));

    runAutoRepairProcess(getStoredMembers(), getStoredTempDataLama())
      .then((res) => {
        if (res.syncedActivities && res.syncedActivities.length > 0) {
          latestRemoteActivitiesRef.current = res.syncedActivities;
          setActivities(res.syncedActivities);
        }
        setMembers(getStoredMembers());
      })
      .catch(err => console.warn('Initial auto-repair note:', err));

    // 2a. Real-time subscription to Firebase Firestore 'members' (Koleksi Anggota Resmi)
    const unsubMembers = subscribeMembersFirestore((remoteMembers) => {
      latestRemoteMembersRef.current = remoteMembers || [];
      applyAuthoritativeReconciliation();
    });

    // 2b. Real-time subscription to Firebase Firestore 'tempdatamenunggu' (Tempat Tampung Sementara Menunggu Persetujuan Admin)
    const unsubTempDataMenunggu = subscribeTempDataMenungguFirestore((remoteWaiting) => {
      latestRemoteWaitingRef.current = remoteWaiting || [];
      setTempDataMenunggu(remoteWaiting || []);
      saveTempDataMenunggu(remoteWaiting || []);
      applyAuthoritativeReconciliation();
    });

    // 2c. Real-time subscription to Firebase Firestore 'tempdatalama' (Tempat Tampung Data Terhapus)
    const unsubTempDataLama = subscribeTempDataLamaFirestore((remoteDeleted) => {
      latestRemoteDeletedRef.current = remoteDeleted || [];
      setTempDataLama(remoteDeleted || []);
      saveTempDataLama(remoteDeleted || []);
      applyAuthoritativeReconciliation();
    });

    // 2d. Real-time subscription to Firebase Firestore 'tempkegiatanlama' (Arsip Jadwal Kegiatan Terhapus)
    const unsubTempKegiatanLama = subscribeTempKegiatanLamaFirestore((remoteDeletedActs) => {
      latestRemoteDeletedActivitiesRef.current = remoteDeletedActs || [];
      setTempKegiatanLama(remoteDeletedActs || []);
      saveTempKegiatanLama(remoteDeletedActs || []);
      applyActivitiesReconciliation();
    });

    // 2e. Real-time subscription to Firebase Firestore 'activities' (Jadwal & Presensi Kegiatan Lintas Perangkat)
    const unsubActivities = subscribeActivitiesFirestore((remoteActs) => {
      latestRemoteActivitiesRef.current = remoteActs || [];
      applyActivitiesReconciliation();
    });

    // 3. Real-time subscription to Firebase Firestore Notifications
    const unsubNotifs = subscribeNotificationsFirestore((remoteNotifs) => {
      if (remoteNotifs) {
        setNotifications(remoteNotifs);
        saveNotifications(remoteNotifs);
      }
    });

    // 4. Local BroadcastChannel & Storage Event fallback for instant tab syncing
    const unsubscribeBroadcast = subscribeToRealtimeEvents(handleRealtimeMessage);

    const onStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('yayasan_alikhlas')) {
        const refreshed = getStoredMembers();
        setMembers(refreshed);
        setTempDataMenunggu(getStoredTempDataMenunggu());
        setTempDataLama(getStoredTempDataLama());
        setNotifications(getStoredNotifications());
        setActivities(getStoredActivities());
        setTempKegiatanLama(getStoredTempKegiatanLama());
        const freshUser = getCurrentUserSession();
        setSessionMember(freshUser);
      }
    };
    window.addEventListener('storage', onStorageChange);

    return () => {
      unsubQuota();
      unsubMembers();
      unsubTempDataMenunggu();
      unsubTempDataLama();
      unsubTempKegiatanLama();
      unsubActivities();
      unsubNotifs();
      unsubscribeBroadcast();
      window.removeEventListener('storage', onStorageChange);
    };
  }, [handleRealtimeMessage]);

  // Auto-dismiss notification toast after 6 seconds
  useEffect(() => {
    if (currentToast) {
      const timer = setTimeout(() => {
        setCurrentToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [currentToast]);

  // Public stats
  const totalKepalaKeluarga = useMemo(() => {
    return members.filter(m => m.status === 'disetujui' && m.peranKeluarga === 'kepala_keluarga').length;
  }, [members]);

  const totalJiwa = useMemo(() => {
    return members.filter(m => m.status === 'disetujui').length;
  }, [members]);

  // Handlers for Public / Warga Actions
  const handleOpenCardVerification = (member: Member) => {
    // If the member is already logged in as self, open card immediately!
    if (currentUserSession && currentUserSession.id === member.id) {
      setCardModalMember(member);
      return;
    }
    // If the user is logged in as Kepala Keluarga and this is his family member, open card immediately!
    if (currentUserSession && currentUserSession.peranKeluarga === 'kepala_keluarga' && currentUserSession.noKk === member.noKk) {
      setCardModalMember(member);
      return;
    }
    // Otherwise, request 6-digit PIN of NIK
    setVerifyingMember(member);
  };

  const handleVerificationSuccess = (member: Member) => {
    setVerifyingMember(null);
    setCardModalMember(member);
  };

  const handlePublicRegister = async (
    memberData: Omit<Member, 'id' | 'tanggalDaftar' | 'status'>,
    onStatusUpdate?: (status: string) => void
  ): Promise<Member> => {
    // CRITICAL: Saves to Firestore FIRST with server polling verification. Throws if database rejects, preventing phantom notifications.
    const created = await addNewMemberAsync(memberData, onStatusUpdate);
    setMembers(getStoredMembers());
    setNotifications(getStoredNotifications());
    
    const notif: AppNotification = {
      id: 'local_' + Date.now(),
      memberId: created.id,
      memberName: created.nama,
      type: 'new_registration',
      message: `Pendaftaran "${created.nama}" (ID: ${created.id}) berhasil tersimpan ke database! Menunggu verifikasi pengurus.`,
      timestamp: created.tanggalDaftar || new Date().toISOString(),
      tanggalDaftar: created.tanggalDaftar || new Date().toISOString(),
      status: created.status,
      peranKeluarga: created.peranKeluarga,
      read: false,
    };
    setCurrentToast(notif);

    return created;
  };

  // User session login & logout
  const handleLoginSession = (member: Member) => {
    setSessionMember(member);
    setCurrentUserSession(member);
  };

  const handleLogoutSession = () => {
    setSessionMember(null);
    setCurrentUserSession(null);
  };

  // Self update from Profile
  const handleUpdateSelf = async (updated: Member) => {
    try {
      await updateMemberAsync(updated);
      setSessionMember(updated);
      setMembers(getStoredMembers());
      setCurrentToast({
        id: 'update_ok_' + Date.now(),
        memberId: updated.id,
        memberName: updated.nama,
        type: updated.status === 'disetujui' ? 'status_approved' : 'data_updated',
        message: `Profil "${updated.nama}" (ID: ${updated.id}) berhasil diperbarui dan disinkronkan ke database.`,
        timestamp: new Date().toISOString(),
        tanggalDaftar: updated.tanggalDaftar,
        tanggalDisetujui: updated.tanggalDisetujui,
        status: updated.status,
        peranKeluarga: updated.peranKeluarga,
        read: false,
      });
    } catch (err: any) {
      const msg = isFirestoreQuotaError(err) ? QUOTA_LIMIT_MESSAGE : (err?.message || QUOTA_LIMIT_MESSAGE);
      setQuotaErrorBanner(msg);
      throw new Error(msg);
    }
  };

  // Handlers for Admin - Member Management (Verified Firestore members -> Daftar Anggota -> Firestore notifications -> Toast)
  const handleApprove = async (memberId: string) => {
    try {
      const { updatedMember, notification } = await updateMemberStatusAsync(memberId, 'disetujui');
      if (updatedMember) {
        setMembers(getStoredMembers());
        setNotifications(getStoredNotifications());
        if (notification) {
          setCurrentToast(notification);
        }
      }
    } catch (err: any) {
      const msg = isFirestoreQuotaError(err) ? QUOTA_LIMIT_MESSAGE : (err?.message || 'Gagal menyetujui anggota di database.');
      setQuotaErrorBanner(msg);
    }
  };

  const handleReject = async (memberId: string, reason?: string) => {
    try {
      const { updatedMember, notification } = await updateMemberStatusAsync(memberId, 'ditolak', reason);
      if (updatedMember) {
        setMembers(getStoredMembers());
        setNotifications(getStoredNotifications());
        if (notification) {
          setCurrentToast(notification);
        }
      }
    } catch (err: any) {
      const msg = isFirestoreQuotaError(err) ? QUOTA_LIMIT_MESSAGE : (err?.message || 'Gagal memperbarui status anggota di database.');
      setQuotaErrorBanner(msg);
    }
  };

  const handleSaveAdminMember = async (memberData: Partial<Member>) => {
    try {
      if (editingMember) {
        const updated: Member = {
          ...editingMember,
          ...memberData,
        } as Member;
        await updateMemberAsync(updated);
        setEditingMember(null);
      } else {
        await addNewMemberAsync({
          ...memberData as any,
          status: memberData.status || 'disetujui',
        });
        setIsAddingAdmin(false);
      }
      setMembers(getStoredMembers());
      setNotifications(getStoredNotifications());
    } catch (err: any) {
      const msg = isFirestoreQuotaError(err) ? QUOTA_LIMIT_MESSAGE : (err?.message || 'Gagal menyimpan data ke database.');
      setQuotaErrorBanner(msg);
      throw new Error(msg);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const toDelete = members.find(m => m.id === memberId);
    if (window.confirm(`Apakah Anda yakin ingin menghapus data anggota "${toDelete?.nama || memberId}"? Data akan disimpan ke tabel sementara (tempdatalama) agar dapat dipulihkan kembali.`)) {
      await deleteMemberAsync(memberId);
      setMembers(getStoredMembers());
      setTempDataLama(getStoredTempDataLama());
      if (currentUserSession?.id === memberId) {
        handleLogoutSession();
      }
    }
  };

  const handleRestoreFromTempDataLama = async (deletedMember: Member) => {
    try {
      const restored = await restoreMemberFromTempDataLamaAsync(deletedMember);
      setMembers(getStoredMembers());
      setTempDataLama(getStoredTempDataLama());
      setNotifications(getStoredNotifications());
      setCurrentToast({
        id: 'restore_ok_' + Date.now(),
        memberId: restored.id,
        memberName: restored.nama,
        type: 'status_approved',
        message: `Data anggota "${restored.nama}" (ID: ${restored.id}) berhasil dikembalikan dari tempdatalama ke daftar anggota.`,
        timestamp: new Date().toISOString(),
        tanggalDaftar: restored.tanggalDaftar,
        tanggalDisetujui: restored.tanggalDisetujui || new Date().toISOString(),
        status: restored.status,
        peranKeluarga: restored.peranKeluarga,
        read: false,
      });
    } catch (err: any) {
      const msg = isFirestoreQuotaError(err) ? QUOTA_LIMIT_MESSAGE : (err?.message || 'Gagal mengembalikan data dari tempdatalama.');
      setQuotaErrorBanner(msg);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Kembalikan semua data ke data awal Yayasan Al Ikhlas Sembilan Satu?')) {
      resetToInitialData();
      setMembers(getStoredMembers());
      setActivities(getStoredActivities());
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setNotifications(getStoredNotifications());
  };

  // Handlers for Activities (Kegiatan Yayasan - Tersinkron di semua device melalui Firestore)
  const handleAddNewActivity = (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>) => {
    addNewActivityAsync(data)
      .then(() => {
        setActivities(getStoredActivities());
      })
      .catch((err) => {
        console.warn('Error adding activity to Firestore:', err);
        setActivities(getStoredActivities());
      });
  };

  const handleUpdateActivity = (updated: Activity) => {
    updateActivityAsync(updated)
      .then(() => {
        setActivities(getStoredActivities());
      })
      .catch((err) => {
        console.warn('Error updating activity in Firestore:', err);
        setActivities(getStoredActivities());
      });
  };

  const handleDeleteActivity = (id: string) => {
    const act = activities.find(a => a.id === id);
    if (window.confirm(`Apakah Anda yakin ingin menghapus kegiatan "${act?.judul || id}"? Agenda ini akan dipindahkan ke arsip terhapus (tempkegiatanlama) agar dapat dipulihkan kembali bila diperlukan.`)) {
      deleteActivityAsync(id)
        .then(() => {
          setActivities(getStoredActivities());
          setTempKegiatanLama(getStoredTempKegiatanLama());
        })
        .catch(() => {
          setActivities(getStoredActivities());
          setTempKegiatanLama(getStoredTempKegiatanLama());
        });
    }
  };

  const handleRestoreActivity = async (deletedActivity: Activity) => {
    const restored = await restoreActivityFromTempKegiatanLamaAsync(deletedActivity);
    if (restored) {
      setActivities(getStoredActivities());
      setTempKegiatanLama(getStoredTempKegiatanLama());
    }
  };

  const handleForceSyncActivities = async () => {
    const [remoteActs, remoteDeletedActs] = await Promise.all([
      fetchActivitiesFromFirestore().catch(() => latestRemoteActivitiesRef.current),
      fetchTempKegiatanLamaFromFirestore().catch(() => latestRemoteDeletedActivitiesRef.current),
    ]);
    latestRemoteActivitiesRef.current = remoteActs;
    latestRemoteDeletedActivitiesRef.current = remoteDeletedActs;
    const { activities: unifiedActivities } = await reconcileAuthoritativeActivities(
      remoteActs,
      remoteDeletedActs
    );
    setActivities(unifiedActivities);
    setTempKegiatanLama(remoteDeletedActs || getStoredTempKegiatanLama());
  };

  const handleRecordAttendance = (
    activityId: string, 
    member: Member, 
    forceAddToPeserta: boolean
  ) => {
    const result = recordAttendance(activityId, member, forceAddToPeserta);
    setActivities(getStoredActivities());
    return result;
  };

  const handleManualCheckIn = (activityId: string, member: Member) => {
    recordAttendance(activityId, member, true);
    setActivities(getStoredActivities());
  };

  return (
    <div className="min-h-screen bg-[#f4f8f5] text-stone-900 font-sans selection:bg-[#0b5d34] selection:text-white relative">
      {/* Global Firebase Quota Limit Notification Banner */}
      {quotaErrorBanner && (
        <div className="sticky top-0 z-50 bg-rose-700 text-white px-4 py-3 shadow-lg border-b-2 border-amber-400 animate-in fade-in slide-in-from-top-2">
          <div className="max-w-5xl mx-auto flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-xs sm:text-sm font-bold leading-snug">
                <span className="uppercase tracking-wider text-amber-300 mr-1.5">[Notifikasi Database]</span>
                {quotaErrorBanner}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuotaErrorBanner(null)}
              className="p-1 rounded-lg bg-white/15 hover:bg-white/25 text-white shrink-0 cursor-pointer"
              title="Tutup Peringatan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Real-time Toast Notifications & Drawer */}
      <NotificationToast
        currentToast={currentToast}
        onDismissToast={() => setCurrentToast(null)}
        isOpenDrawer={isOpenNotifDrawer}
        onCloseDrawer={() => setIsOpenNotifDrawer(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Main Content Router */}
      {activeTab === 'admin' ? (
        isAdminLoggedIn ? (
          <AdminDashboard
            members={members}
            tempDataMenunggu={tempDataMenunggu}
            tempDataLama={tempDataLama}
            activities={activities}
            tempKegiatanLama={tempKegiatanLama}
            notifications={notifications}
            onApprove={handleApprove}
            onReject={handleReject}
            onAddMember={() => setIsAddingAdmin(true)}
            onEditMember={(m) => setEditingMember(m)}
            onDeleteMember={handleDeleteMember}
            onRestoreFromTempDataLama={handleRestoreFromTempDataLama}
            onViewCard={(m) => setCardModalMember(m)}
            onViewDoc={(title, url, fileName) => setViewingDoc({ title, url, fileName })}
            onLogout={() => {
              setIsAdminLoggedIn(false);
              setActiveTab('anggota');
            }}
            onResetData={handleResetData}
            onOpenNotifications={() => setIsOpenNotifDrawer(true)}
            onAddNewActivity={handleAddNewActivity}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
            onRestoreDeletedActivity={handleRestoreActivity}
            onSyncAllDevices={handleForceSyncActivities}
            onActivitiesSynced={(syncedActs) => setActivities(syncedActs)}
            onRecordAttendance={handleRecordAttendance}
            onManualCheckIn={handleManualCheckIn}
          />
        ) : (
          <AdminLogin
            onLoginSuccess={() => setIsAdminLoggedIn(true)}
            onBackToPublic={() => setActiveTab('anggota')}
          />
        )
      ) : (
        <div className="min-h-screen flex flex-col">
          {/* Header with Hijau NU Theme */}
          <Header
            totalKepalaKeluarga={totalKepalaKeluarga}
            totalJiwa={totalJiwa}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            notifications={notifications}
            onOpenNotifications={() => setIsOpenNotifDrawer(true)}
            currentUserSession={currentUserSession}
            onGoToProfile={() => setActiveTab('profil')}
          />

          {/* Active View Tab */}
          <main className="flex-1">
            {activeTab === 'anggota' && (
              <MemberList
                members={members}
                onOpenCardVerification={handleOpenCardVerification}
                onGoToRegister={() => setActiveTab('daftar')}
              />
            )}

            {activeTab === 'daftar' && (
              <RegisterForm
                allMembers={members}
                currentUserSession={currentUserSession}
                onSubmit={handlePublicRegister}
                onSuccessRedirect={() => setActiveTab(currentUserSession ? 'profil' : 'anggota')}
                onRestoreSuccess={(restored) => {
                  setMembers(getStoredMembers());
                  setTempDataLama(getStoredTempDataLama());
                  setNotifications(getStoredNotifications());
                  setCurrentToast({
                    id: 'restore_reg_' + Date.now(),
                    memberId: restored.id,
                    memberName: restored.nama,
                    type: 'status_approved',
                    message: `Data anggota "${restored.nama}" (ID: ${restored.id}) berhasil dikembalikan kembali dari arsip tempdatalama!`,
                    timestamp: new Date().toISOString(),
                    read: false,
                  });
                }}
              />
            )}

            {activeTab === 'profil' && (
              <FamilyPortal
                currentUserSession={currentUserSession}
                allMembers={members}
                onLoginSession={handleLoginSession}
                onLogoutSession={handleLogoutSession}
                onViewCard={(m) => setCardModalMember(m)}
                onEditMember={(m) => {
                  // Only allow editing family member if current user is Kepala Keluarga
                  if (currentUserSession?.peranKeluarga === 'kepala_keluarga' && currentUserSession.noKk === m.noKk) {
                    setEditingMember(m);
                  }
                }}
                onRegisterFamilyMember={() => setActiveTab('daftar')}
                onUpdateSelf={handleUpdateSelf}
              />
            )}

            {activeTab === 'info' && (
              <InfoSection
                members={members}
                onOpenCardVerification={handleOpenCardVerification}
                onGoToPortal={() => setActiveTab('profil')}
              />
            )}
          </main>

          {/* Responsive Bottom Navigation Bar across Mobile, Tablet, Laptop, and PC */}
          <div className="fixed bottom-2.5 sm:bottom-4 inset-x-0 z-40 flex justify-center px-2 sm:px-4 print:hidden pointer-events-none">
            <nav 
              aria-label="Navigasi Utama Aplikasi"
              className="pointer-events-auto w-full max-w-md sm:w-auto bg-white/95 backdrop-blur-md border border-emerald-900/15 shadow-2xl rounded-2xl sm:rounded-full p-1 sm:p-1.5 flex items-center justify-between sm:justify-center gap-0.5 sm:gap-2"
            >
              {/* Tab 1: Anggota */}
              <button
                onClick={() => setActiveTab('anggota')}
                className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2.5 px-1 sm:px-4 rounded-xl sm:rounded-full transition-all cursor-pointer select-none ${
                  activeTab === 'anggota'
                    ? 'bg-[#0b5d34] text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold'
                }`}
                title="Daftar Anggota"
              >
                <Users className={`w-4 h-4 shrink-0 ${activeTab === 'anggota' ? 'text-white' : 'text-emerald-700'}`} />
                <span className="text-[10px] sm:text-sm leading-tight">Anggota</span>
              </button>

              {/* Tab 2: Daftar */}
              <button
                onClick={() => setActiveTab('daftar')}
                className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2.5 px-1 sm:px-4 rounded-xl sm:rounded-full transition-all cursor-pointer select-none ${
                  activeTab === 'daftar'
                    ? 'bg-[#0b5d34] text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold'
                }`}
                title="Pendaftaran Anggota"
              >
                <FilePenLine className={`w-4 h-4 shrink-0 ${activeTab === 'daftar' ? 'text-white' : 'text-amber-600'}`} />
                <span className="text-[10px] sm:text-sm leading-tight">Daftar</span>
              </button>

              {/* Tab 3: Profil Saya / Portal Keluarga */}
              <button
                onClick={() => setActiveTab('profil')}
                className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2.5 px-1 sm:px-4 rounded-xl sm:rounded-full transition-all cursor-pointer select-none ${
                  activeTab === 'profil'
                    ? 'bg-[#0b5d34] text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold'
                }`}
                title="Profil & Kartu Saya"
              >
                <User className={`w-4 h-4 shrink-0 ${activeTab === 'profil' ? 'text-white' : 'text-blue-600'}`} />
                <span className="text-[10px] sm:text-sm leading-tight">Profil</span>
              </button>

              {/* Tab 4: Info */}
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2.5 px-1 sm:px-4 rounded-xl sm:rounded-full transition-all cursor-pointer select-none ${
                  activeTab === 'info'
                    ? 'bg-[#0b5d34] text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold'
                }`}
                title="Informasi & Cek Status"
              >
                <Info className={`w-4 h-4 shrink-0 ${activeTab === 'info' ? 'text-white' : 'text-sky-600'}`} />
                <span className="text-[10px] sm:text-sm leading-tight">Info</span>
              </button>

              {/* Tab 5: Admin Switch */}
              <button
                onClick={() => setActiveTab('admin')}
                className="flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2.5 px-1 sm:px-4 rounded-xl sm:rounded-full transition-all cursor-pointer select-none text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold"
                title="Masuk Pengurus/Admin"
              >
                <Shield className="w-4 h-4 shrink-0 text-[#0b5d34]" />
                <span className="text-[10px] sm:text-sm leading-tight">Admin</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Verify Card PIN Modal (6 digit terakhir KTP) */}
      {verifyingMember && (
        <VerifyCardModal
          member={verifyingMember}
          onClose={() => setVerifyingMember(null)}
          onSuccess={handleVerificationSuccess}
        />
      )}

      {/* 2. Official Member Card Modal with Photo */}
      {cardModalMember && (
        <MemberCardModal
          member={cardModalMember}
          onClose={() => setCardModalMember(null)}
          showCelebration={true}
        />
      )}

      {/* 3. Admin Add/Edit Member Modal */}
      {(isAddingAdmin || editingMember) && (
        <AdminMemberForm
          member={editingMember}
          allMembers={members}
          onClose={() => {
            setIsAddingAdmin(false);
            setEditingMember(null);
          }}
          onSave={handleSaveAdminMember}
          onRestoreSuccess={(restored) => {
            setMembers(getStoredMembers());
            setTempDataLama(getStoredTempDataLama());
            setNotifications(getStoredNotifications());
            setCurrentToast({
              id: 'restore_admin_' + Date.now(),
              memberId: restored.id,
              memberName: restored.nama,
              type: 'status_approved',
              message: `Data anggota "${restored.nama}" (ID: ${restored.id}) berhasil dikembalikan dari tempdatalama ke tabel members.`,
              timestamp: new Date().toISOString(),
              read: false,
            });
          }}
        />
      )}

      {/* 4. Document Viewer Modal */}
      {viewingDoc && (
        <DocumentViewerModal
          title={viewingDoc.title}
          url={viewingDoc.url}
          fileName={viewingDoc.fileName}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  );
}
