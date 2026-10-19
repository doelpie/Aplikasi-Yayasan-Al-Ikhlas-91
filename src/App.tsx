import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Member, AppNotification, BroadcastMessage } from './types';
import { 
  getStoredMembers, 
  saveMembers, 
  getStoredNotifications, 
  addNotification, 
  markAllNotificationsAsRead, 
  subscribeToRealtimeEvents, 
  updateMemberStatus, 
  addNewMember, 
  updateMember, 
  deleteMember, 
  resetToInitialData,
  requestNotificationPermission 
} from './utils/storage';
import { soundEffects } from './utils/sound';
import { Header } from './components/Header';
import { MemberList } from './components/MemberList';
import { VerifyCardModal } from './components/VerifyCardModal';
import { MemberCardModal } from './components/MemberCardModal';
import { RegisterForm } from './components/RegisterForm';
import { InfoSection } from './components/InfoSection';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminMemberForm } from './components/AdminMemberForm';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { NotificationToast } from './components/NotificationToast';
import { Users, FilePenLine, Info, Shield, Plus, Sparkles } from 'lucide-react';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'anggota' | 'daftar' | 'info' | 'admin'>('anggota');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Data State
  const [members, setMembers] = useState<Member[]>(() => getStoredMembers());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getStoredNotifications());

  // Modals & Popups State
  const [verifyingMember, setVerifyingMember] = useState<Member | null>(null);
  const [cardModalMember, setCardModalMember] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ title: string; url?: string; fileName?: string } | null>(null);

  // Real-time Notification Toast State
  const [currentToast, setCurrentToast] = useState<AppNotification | null>(null);
  const [isOpenNotifDrawer, setIsOpenNotifDrawer] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync real-time updates across tabs
  const handleRealtimeMessage = useCallback((msg: BroadcastMessage) => {
    if (msg.type === 'STATUS_CHANGED' || msg.type === 'NEW_REGISTRATION' || msg.type === 'DATA_SYNC') {
      // Reload fresh data from storage
      const refreshedMembers = getStoredMembers();
      setMembers(refreshedMembers);

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
    // Request notification permission smoothly
    requestNotificationPermission();

    // Subscribe to BroadcastChannel for real-time synchronization between tabs
    const unsubscribe = subscribeToRealtimeEvents(handleRealtimeMessage);

    // Also listen to storage events
    const onStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('yayasan_alikhlas')) {
        setMembers(getStoredMembers());
        setNotifications(getStoredNotifications());
      }
    };
    window.addEventListener('storage', onStorageChange);

    return () => {
      unsubscribe();
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

  // Public stats calculations
  const totalKepalaKeluarga = useMemo(() => {
    return members.filter(m => m.status === 'disetujui').length;
  }, [members]);

  const totalJiwa = useMemo(() => {
    return members
      .filter(m => m.status === 'disetujui')
      .reduce((sum, m) => sum + 1 + (Number(m.jumlahKeluarga) || 0), 0);
  }, [members]);

  // Handlers for Public View
  const handleOpenCardVerification = (member: Member) => {
    setVerifyingMember(member);
  };

  const handleVerificationSuccess = (member: Member) => {
    setVerifyingMember(null);
    setCardModalMember(member);
  };

  const handlePublicRegister = (memberData: Omit<Member, 'id' | 'tanggalDaftar' | 'status'>) => {
    const created = addNewMember(memberData);
    setMembers(getStoredMembers());
    setNotifications(getStoredNotifications());
    
    // Trigger real-time toast
    const notif: AppNotification = {
      id: 'local_' + Date.now(),
      memberId: created.id,
      memberName: created.nama,
      type: 'new_registration',
      message: `Pendaftaran baru atas nama "${created.nama}" berhasil dikirim! Menunggu ACC pengurus.`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setCurrentToast(notif);

    return created;
  };

  // Handlers for Admin
  const handleApprove = (memberId: string) => {
    const { updatedMember, notification } = updateMemberStatus(memberId, 'disetujui');
    if (updatedMember) {
      setMembers(getStoredMembers());
      setNotifications(getStoredNotifications());
      if (notification) {
        setCurrentToast(notification);
      }
    }
  };

  const handleReject = (memberId: string, reason?: string) => {
    const { updatedMember, notification } = updateMemberStatus(memberId, 'ditolak', reason);
    if (updatedMember) {
      setMembers(getStoredMembers());
      setNotifications(getStoredNotifications());
      if (notification) {
        setCurrentToast(notification);
      }
    }
  };

  const handleSaveAdminMember = (memberData: Partial<Member>) => {
    if (editingMember) {
      // Edit existing
      const updated: Member = {
        ...editingMember,
        ...memberData,
      } as Member;
      updateMember(updated);
      setEditingMember(null);
    } else {
      // Add new
      addNewMember({
        ...memberData as any,
        status: memberData.status || 'disetujui',
      });
      setIsAddingAdmin(false);
    }
    setMembers(getStoredMembers());
    setNotifications(getStoredNotifications());
  };

  const handleDeleteMember = (memberId: string) => {
    const toDelete = members.find(m => m.id === memberId);
    if (window.confirm(`Apakah Anda yakin ingin menghapus data anggota "${toDelete?.nama || memberId}"?`)) {
      deleteMember(memberId);
      setMembers(getStoredMembers());
    }
  };

  const handleResetData = () => {
    if (window.confirm('Kembalikan semua data ke data contoh awal?')) {
      resetToInitialData();
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setNotifications(getStoredNotifications());
  };

  return (
    <div className="min-h-screen bg-[#faf5f5] text-stone-900 font-sans selection:bg-[#83141a] selection:text-white relative">
      {/* Real-time Toast Notifications & Drawer */}
      <NotificationToast
        currentToast={currentToast}
        onDismissToast={() => setCurrentToast(null)}
        isOpenDrawer={isOpenNotifDrawer}
        onCloseDrawer={() => setIsOpenNotifDrawer(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Main Content Area */}
      {activeTab === 'admin' ? (
        isAdminLoggedIn ? (
          <AdminDashboard
            members={members}
            notifications={notifications}
            onApprove={handleApprove}
            onReject={handleReject}
            onAddMember={() => setIsAddingAdmin(true)}
            onEditMember={(m) => setEditingMember(m)}
            onDeleteMember={handleDeleteMember}
            onViewCard={(m) => setCardModalMember(m)}
            onViewDoc={(title, url, fileName) => setViewingDoc({ title, url, fileName })}
            onLogout={() => {
              setIsAdminLoggedIn(false);
              setActiveTab('anggota');
            }}
            onResetData={handleResetData}
            onOpenNotifications={() => setIsOpenNotifDrawer(true)}
          />
        ) : (
          <AdminLogin
            onLoginSuccess={() => setIsAdminLoggedIn(true)}
            onBackToPublic={() => setActiveTab('anggota')}
          />
        )
      ) : (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <Header
            totalKepalaKeluarga={totalKepalaKeluarga}
            totalJiwa={totalJiwa}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            notifications={notifications}
            onOpenNotifications={() => setIsOpenNotifDrawer(true)}
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
                onSubmit={handlePublicRegister}
                onSuccessRedirect={() => setActiveTab('anggota')}
              />
            )}

            {activeTab === 'info' && (
              <InfoSection
                members={members}
                onOpenCardVerification={handleOpenCardVerification}
              />
            )}
          </main>

          {/* Floating Bottom Pill Navigation Bar matching IMG-20261018-WA0014.jpg */}
          <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 print:hidden pointer-events-none">
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-2xl rounded-full p-1.5 flex items-center gap-1 sm:gap-2">
              {/* Tab 1: Anggota */}
              <button
                onClick={() => setActiveTab('anggota')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'anggota'
                    ? 'bg-[#83141a] text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Users className={`w-4 h-4 ${activeTab === 'anggota' ? 'text-white' : 'text-blue-600'}`} />
                <span className="text-xs sm:text-sm font-bold">Anggota</span>
              </button>

              {/* Tab 2: Daftar */}
              <button
                onClick={() => setActiveTab('daftar')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'daftar'
                    ? 'bg-[#83141a] text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <FilePenLine className={`w-4 h-4 ${activeTab === 'daftar' ? 'text-white' : 'text-amber-600'}`} />
                <span className="text-xs sm:text-sm font-bold">Daftar</span>
              </button>

              {/* Tab 3: Info */}
              <button
                onClick={() => setActiveTab('info')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-[#83141a] text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Info className={`w-4 h-4 ${activeTab === 'info' ? 'text-white' : 'text-sky-600'}`} />
                <span className="text-xs sm:text-sm font-bold">Info</span>
              </button>

              {/* Tab 4: Admin Switch */}
              <button
                onClick={() => setActiveTab('admin')}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-full transition-all cursor-pointer text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                title="Masuk Pengurus/Admin"
              >
                <Shield className="w-4 h-4 text-[#83141a]" />
                <span className="text-xs font-bold hidden sm:inline">Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Verify Card PIN Modal (4 digit HP) */}
      {verifyingMember && (
        <VerifyCardModal
          member={verifyingMember}
          onClose={() => setVerifyingMember(null)}
          onSuccess={handleVerificationSuccess}
        />
      )}

      {/* 2. Official Member Card Modal */}
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
          onClose={() => {
            setIsAddingAdmin(false);
            setEditingMember(null);
          }}
          onSave={handleSaveAdminMember}
        />
      )}

      {/* 4. Document Viewer Modal (KTP / KK) */}
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
