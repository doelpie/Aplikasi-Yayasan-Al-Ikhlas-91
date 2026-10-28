import React, { useState, useMemo } from 'react';
import { Member, MemberStatus, AppNotification, Activity, ActivityAttendee } from '../types';
import { 
  Search, 
  MessageCircle, 
  Edit3, 
  Trash2, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Plus, 
  Download, 
  LogOut, 
  Bell,
  Users,
  Camera,
  CalendarDays,
  QrCode,
  AlertCircle,
  History,
  ShieldCheck,
  Zap,
  RefreshCw,
  RotateCcw,
  Archive,
  X
} from 'lucide-react';
import { 
  getPeranLabel, 
  getInitials, 
  getRegistrationTraces, 
  clearRegistrationTraces, 
  RegistrationTrace,
  getDeepRegistrationLogs,
  clearDeepRegistrationLogs,
  DeepRegistrationLogEntry
} from '../utils/storage';
import { ActivityManagement } from './ActivityManagement';
import { QrScannerModal } from './QrScannerModal';
import { exportMembersToExcelWithImages, generateDocumentPreviewDataUrl } from '../utils/excelExport';

interface AdminDashboardProps {
  members: Member[];
  tempDataLama?: Member[];
  activities: Activity[];
  notifications: AppNotification[];
  onApprove: (memberId: string) => Promise<void> | void;
  onReject: (memberId: string, reason?: string) => Promise<void> | void;
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
  onRestoreFromTempDataLama?: (deletedMember: Member) => Promise<void> | void;
  onViewCard: (member: Member) => void;
  onViewDoc: (title: string, url?: string, fileName?: string) => void;
  onLogout: () => void;
  onResetData: () => void;
  onOpenNotifications: () => void;
  // Activity Handlers
  onAddNewActivity: (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>) => void;
  onUpdateActivity: (updated: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onRecordAttendance: (
    activityId: string, 
    member: Member, 
    forceAddToPeserta: boolean
  ) => { success: boolean; alreadyAttended: boolean; isNewToPeserta: boolean; attendee?: ActivityAttendee; error?: string };
  onManualCheckIn?: (activityId: string, member: Member) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  members,
  tempDataLama = [],
  activities,
  notifications,
  onApprove,
  onReject,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onRestoreFromTempDataLama,
  onViewCard,
  onViewDoc,
  onLogout,
  onOpenNotifications,
  onAddNewActivity,
  onUpdateActivity,
  onDeleteActivity,
  onRecordAttendance,
  onManualCheckIn,
}) => {
  // Navigation: exactly 'anggota' or 'kegiatan'
  const [activeNav, setActiveNav] = useState<'anggota' | 'kegiatan'>('anggota');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerActivityId, setScannerActivityId] = useState<string | undefined>(undefined);

  // Filter states for Anggota
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | MemberStatus>('semua');
  const [roleFilter, setRoleFilter] = useState<'semua' | 'kepala_keluarga' | 'istri' | 'anak'>('semua');
  const [rejectingMember, setRejectingMember] = useState<Member | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);
  const [traceList, setTraceList] = useState<RegistrationTrace[]>([]);
  const [deepLogsList, setDeepLogsList] = useState<DeepRegistrationLogEntry[]>([]);
  const [traceTab, setTraceTab] = useState<'ringkasan' | 'deep'>('ringkasan');

  // Excel Export with embedded images state
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);
  const [isTempDataLamaOpen, setIsTempDataLamaOpen] = useState(false);
  const [restoringTempId, setRestoringTempId] = useState<string | null>(null);

  // Statistics for Anggota
  const countApproved = useMemo(() => members.filter(m => m.status === 'disetujui').length, [members]);
  const countKepalaKeluarga = useMemo(() => {
    return members.filter(m => m.status === 'disetujui' && m.peranKeluarga === 'kepala_keluarga').length;
  }, [members]);
  const countPending = useMemo(() => members.filter(m => m.status === 'menunggu').length, [members]);
  const countRejected = useMemo(() => members.filter(m => m.status === 'ditolak').length, [members]);

  // Filtered members
  const filteredList = useMemo(() => {
    let list = members;
    if (statusFilter !== 'semua') {
      list = list.filter(m => m.status === statusFilter);
    }
    if (roleFilter !== 'semua') {
      list = list.filter(m => m.peranKeluarga === roleFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(m => 
        m.nama.toLowerCase().includes(q) ||
        (m.nik && m.nik.includes(q)) ||
        (m.noKk && m.noKk.includes(q)) ||
        m.alamat.toLowerCase().includes(q) ||
        m.noHp.includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, statusFilter, roleFilter, searchTerm]);

  // Unmatched registration notifications (historical registrations where uncompressed photos exceeded Firestore limit on old versions)
  const unmatchedRegistrations = useMemo(() => {
    return notifications.filter(n => {
      if (n.type !== 'new_registration') return false;
      const matchFound = members.some(m => 
        m.id === n.memberId || 
        m.nama.toLowerCase().trim() === n.memberName.toLowerCase().trim()
      );
      return !matchFound;
    });
  }, [notifications, members]);

  // Open WhatsApp with friendly pre-filled text
  const handleOpenWhatsApp = (member: Member) => {
    const cleanHp = member.noHp.replace(/\D/g, '');
    let formattedHp = cleanHp;
    if (formattedHp.startsWith('0')) {
      formattedHp = '62' + formattedHp.slice(1);
    } else if (!formattedHp.startsWith('62')) {
      formattedHp = '62' + formattedHp;
    }

    const roleText = getPeranLabel(member.peranKeluarga);
    let message = '';
    if (member.status === 'disetujui') {
      message = `Assalamu'alaikum Bpk/Ibu *${member.nama}*,\n\nAlhamdulillah, pendaftaran keanggotaan Anda sebagai *${roleText}* di *Yayasan Al Ikhlas Sembilan Satu* telah *DISETUJUI*.\nID Anggota: *${member.id}*\nNo. KK: *${member.noKk}*\n\nAnda dapat membuka dan mengunduh Kartu Anggota Resmi dengan memasukkan 6 digit terakhir nomor KTP/KIA Anda.\n\nTerima kasih atas partisipasi Anda.`;
    } else if (member.status === 'ditolak') {
      message = `Assalamu'alaikum Bpk/Ibu *${member.nama}*,\n\nMohon maaf, pendaftaran keanggotaan Anda di *Yayasan Al Ikhlas Sembilan Satu* belum dapat disetujui.\n*Catatan*: ${member.catatanPenolakan || 'Data administrasi belum lengkap'}.\n\nSilakan hubungi pengurus untuk perbaikan data via WhatsApp: 08123986794. Terima kasih.`;
    } else {
      message = `Assalamu'alaikum Bpk/Ibu *${member.nama}*,\n\nKami dari Pengurus *Yayasan Al Ikhlas Sembilan Satu* sedang memverifikasi berkas pendaftaran Anda sebagai *${roleText}*. Mohon ditunggu informasi selanjutnya. Terima kasih.`;
    }

    const waUrl = `https://wa.me/${formattedHp}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Export to Excel (.xlsx) with embedded images (Foto Profil, Foto KTP, Foto KK)
  const handleExportExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    setExportProgressText('Menyiapkan buku kerja Excel & memproses foto...');
    try {
      await exportMembersToExcelWithImages(members, (status) => {
        setExportProgressText(status);
      });
    } catch (err) {
      console.error('Gagal mengekspor Excel:', err);
    } finally {
      setTimeout(() => {
        setIsExportingExcel(false);
        setExportProgressText(null);
      }, 900);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f5] pb-28">
      {/* Top Header Bar */}
      <header className="bg-[#0b5d34] text-white pt-4 pb-6 px-3 sm:px-6 shadow-md border-b-2 border-[#d4af37]">
        <div className="max-w-5xl lg:max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <img 
              src="/logo.png" 
              alt="Logo Yayasan Al Ikhlas" 
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-sm shrink-0" 
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-lg font-black tracking-wider uppercase leading-none truncate">
                  PANEL PENGURUS &amp; ADMIN
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-800/80 border border-emerald-400/30 text-[10px] text-emerald-200 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Firebase DB
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-200 mt-1 font-medium truncate">
                Yayasan Al Ikhlas Sembilan Satu Dalung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors cursor-pointer"
              title="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-gray-900 animate-pulse">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            <button
              onClick={onLogout}
              className="px-2.5 sm:px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-white/20"
              title="Keluar dari Admin"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body: Switch between Anggota & Kegiatan */}
      <main className="max-w-5xl lg:max-w-6xl mx-auto px-3 sm:px-6 pt-5">
        {activeNav === 'anggota' ? (
          <div>
            {/* Sub-bar Menu Anggota: Menu Anggota, Tambah, Export, dan Keluar */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-gray-100 flex items-center justify-between flex-wrap gap-2.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0b5d34] flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                    Manajemen Anggota &amp; Keluarga
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    Total {members.length} anggota terdaftar dalam basis data
                  </p>
                </div>
              </div>

              {/* Sub-actions: Tambah, Export, Keluar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('semua');
                    setRoleFilter('semua');
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Lihat semua anggota"
                >
                  <FileText className="w-3.5 h-3.5 text-[#0b5d34]" />
                  <span>Menu Anggota</span>
                </button>

                <button
                  type="button"
                  onClick={onAddMember}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0b5d34] hover:bg-[#084d2a] text-white shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Tambah Anggota Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    isExportingExcel
                      ? 'bg-amber-50 text-amber-800 border-amber-300 cursor-wait'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-[#0b5d34] border-emerald-200'
                  }`}
                  title="Ekspor seluruh data anggota beserta Foto Profil, Foto KTP, dan Foto KK ke format Excel (.xlsx)"
                >
                  <Download className={`w-3.5 h-3.5 ${isExportingExcel ? 'text-amber-600 animate-bounce' : 'text-blue-600'}`} />
                  <span>{isExportingExcel ? 'Mengekspor Excel + Foto...' : 'Export Excel + Foto'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTraceList(getRegistrationTraces());
                    setIsTraceModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Lihat Log Pelacakan & Audit Sinkronisasi Firestore"
                >
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Log Jejak</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTempDataLamaOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Lihat & Pulihkan Data Anggota Terhapus pada Tabel tempdatalama"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-700" />
                  <span>Data Terhapus ({tempDataLama.length})</span>
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Keluar dari Admin"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>

            {/* Excel Export Progress Banner */}
            {exportProgressText && (
              <div className="mb-4 bg-emerald-900 text-white rounded-2xl p-3.5 text-xs flex items-center justify-between gap-3 shadow-md border border-[#d4af37]">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-[#d4af37] animate-spin shrink-0" />
                  <div>
                    <div className="font-bold text-[#d4af37]">Export Excel (.xlsx) Beserta Foto Profil, KTP &amp; KK</div>
                    <div className="text-emerald-100 text-[11px] mt-0.5">{exportProgressText}</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold text-emerald-200 shrink-0">
                  Mohon Tunggu...
                </span>
              </div>
            )}

            {/* 4 Top Stat Cards: 2 Cols on Mobile, 4 Cols on Tablet & PC */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100">
                <div className="text-xl sm:text-3xl font-extrabold text-[#0b5d34]">
                  {countKepalaKeluarga}
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-gray-600 mt-0.5 leading-tight">
                  Kepala Klrg
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100">
                <div className="text-xl sm:text-3xl font-extrabold text-emerald-700">
                  {countApproved}
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-gray-600 mt-0.5 leading-tight">
                  Total Jiwa
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100 relative">
                <div className={`text-xl sm:text-3xl font-extrabold ${countPending > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                  {countPending}
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-gray-600 mt-0.5 leading-tight">
                  Menunggu ACC
                </div>
                {countPending > 0 && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                )}
              </div>

              <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100">
                <div className="text-xl sm:text-3xl font-extrabold text-rose-700">
                  {countRejected}
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-gray-600 mt-0.5 leading-tight">
                  Ditolak
                </div>
              </div>
            </div>

            {/* Informational Banner if there are historical notifications without matching member documents */}
            {unmatchedRegistrations.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-amber-950 flex items-center justify-between">
                    <span>Catatan Sinkronisasi Notifikasi Pendaftaran ({unmatchedRegistrations.length})</span>
                    <span className="text-[10px] font-semibold bg-amber-200/80 px-2 py-0.5 rounded-full text-amber-900">
                      Perlu Perhatian
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Terdapat {unmatchedRegistrations.length} nama dalam notifikasi ({unmatchedRegistrations.map(u => u.memberName).slice(0, 3).join(', ')}{unmatchedRegistrations.length > 3 ? '...' : ''}) yang belum tersimpan ke daftar anggota karena berkas foto dari perangkat pengguna berukuran sangat besar pada sistem lama.
                    Sistem kompresi &amp; validasi otomatis telah diperbaiki sehingga pendaftaran baru dipastikan 100% tersimpan ke database sebelum notifikasi diterbitkan.
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onAddMember}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-[11px] cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Input Anggota Manual</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="mt-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama / NIK / No. KK / alamat / telp..."
                className="w-full pl-10 pr-4 py-3 bg-white text-gray-800 text-xs sm:text-sm font-medium rounded-2xl shadow-xs border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/30 focus:border-[#0b5d34] transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setStatusFilter('semua')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === 'semua'
                    ? 'bg-[#0b5d34] text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                Semua ({members.length})
              </button>
              <button
                onClick={() => setStatusFilter('menunggu')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'menunggu'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                <span>Menunggu</span>
                {countPending > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800">
                    {countPending}
                  </span>
                )}
              </button>
              <button
                onClick={() => setStatusFilter('disetujui')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === 'disetujui'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                Disetujui ({countApproved})
              </button>
              <button
                onClick={() => setStatusFilter('ditolak')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === 'ditolak'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                Ditolak ({countRejected})
              </button>
            </div>

            {/* Role Filter Tabs: Kepala Keluarga | Istri | Anak */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 text-[11px]">
              <span className="text-gray-500 py-1 font-semibold">Filter Peran:</span>
              {(['semua', 'kepala_keluarga', 'istri', 'anak'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    roleFilter === role
                      ? 'bg-emerald-100 text-[#0b5d34] border border-emerald-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-200 bg-white border border-gray-200'
                  }`}
                >
                  {role === 'semua' ? 'Semua Peran' : getPeranLabel(role)}
                </button>
              ))}
            </div>

            {/* Member Cards Grid: 1 Col on Mobile, 2 Cols on Laptop & PC */}
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5">
              {filteredList.length > 0 ? (
                filteredList.map((member) => {
                  const roleText = getPeranLabel(member.peranKeluarga);
                  return (
                    <div
                      key={member.id}
                      className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-xs border border-gray-100 transition-all hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        {/* Foto Diri */}
                        <div className="w-14 h-18 sm:w-16 sm:h-20 rounded-xl overflow-hidden bg-emerald-50 border-2 border-[#0b5d34] shrink-0">
                          {member.fotoUrl ? (
                            <img
                              src={member.fotoUrl}
                              alt={member.nama}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#0b5d34] font-bold text-base">
                              {getInitials(member.nama)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name & Status */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0b5d34] border border-emerald-200 uppercase">
                                  {roleText}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">ID: {member.id}</span>
                              </div>
                              <h3 className="text-base font-bold text-gray-900 mt-0.5 leading-snug">
                                {member.nama}
                              </h3>
                            </div>

                            {member.status === 'disetujui' && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 shrink-0">
                                Disetujui
                              </span>
                            )}
                            {member.status === 'menunggu' && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 shrink-0 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Menunggu
                              </span>
                            )}
                            {member.status === 'ditolak' && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 text-[11px] font-bold border border-rose-200 shrink-0">
                                Ditolak
                              </span>
                            )}
                          </div>

                          {/* NIK & No KK */}
                          <div className="mt-1 text-xs text-gray-600 font-mono space-y-0.5">
                            <div>
                              <span className="text-gray-400">NIK:</span> <strong className="text-gray-800">{member.nik}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400">No. KK:</span> <strong>{member.noKk}</strong>
                              {member.namaKepalaKeluarga && (
                                <span className="text-gray-500 font-sans ml-1 text-[11px]">
                                  (Kepala: {member.namaKepalaKeluarga})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Alamat & Telp */}
                          <div className="text-xs text-gray-700 mt-1 leading-relaxed">
                            {member.alamat}
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">
                            HP: {member.noHp}
                          </div>

                          {/* Documents: Foto Diri, Foto KTP, Foto KK */}
                          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => onViewDoc(`Foto Diri - ${member.nama}`, member.fotoUrl || generateDocumentPreviewDataUrl('profil', member), member.fotoName || `Foto_${member.id}.jpg`)}
                              className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 underline cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Foto Diri</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onViewDoc(`Foto KTP / KIA - ${member.nama}`, member.ktpUrl || generateDocumentPreviewDataUrl('ktp', member), member.ktpName || `KTP_${member.nik}.jpg`)}
                              className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 underline cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Foto KTP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onViewDoc(`Foto Kartu Keluarga (KK) - ${member.nama}`, member.kkUrl || generateDocumentPreviewDataUrl('kk', member), member.kkName || `KK_${member.noKk}.jpg`)}
                              className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 underline cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Foto KK</span>
                            </button>
                          </div>

                          {/* Action buttons */}
                          <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                            {/* Approval actions */}
                            <div className="flex items-center gap-1.5">
                              {member.status !== 'disetujui' && (
                                <button
                                  disabled={processingMemberId === member.id}
                                  onClick={async () => {
                                    setProcessingMemberId(member.id);
                                    try {
                                      await onApprove(member.id);
                                    } finally {
                                      setProcessingMemberId(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
                                  title="Setujui dan aktifkan kartu anggota"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{processingMemberId === member.id ? 'Menyimpan...' : 'Setujui'}</span>
                                </button>
                              )}

                              {member.status !== 'ditolak' && (
                                <button
                                  disabled={processingMemberId === member.id}
                                  onClick={() => {
                                    setRejectingMember(member);
                                    setRejectReason('');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer"
                                  title="Tolak pendaftaran dengan catatan"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Tolak</span>
                                </button>
                              )}

                              {member.status === 'disetujui' && (
                                <button
                                  onClick={() => onViewCard(member)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#0b5d34] border border-emerald-200 text-xs font-bold rounded-xl cursor-pointer"
                                  title="Lihat / Cetak Kartu Anggota"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Kartu</span>
                                </button>
                              )}
                            </div>

                            {/* Admin modify actions */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenWhatsApp(member)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                                title="Kirim pesan WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>WA</span>
                              </button>

                              <button
                                onClick={() => onEditMember(member)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                                title="Edit data anggota ini"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Edit</span>
                              </button>

                              <button
                                onClick={() => onDeleteMember(member.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-rose-50 border border-gray-200 text-gray-600 hover:text-rose-700 text-xs font-bold rounded-xl cursor-pointer"
                                title="Hapus data"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-xs col-span-full">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-gray-800">Tidak ada data anggota ditemukan</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Silakan ubah kata kunci pencarian atau filter status &amp; peran.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* KEGIATAN MANAGEMENT VIEW */
          <ActivityManagement
            activities={activities}
            allMembers={members}
            onAddNewActivity={onAddNewActivity}
            onUpdateActivity={onUpdateActivity}
            onDeleteActivity={onDeleteActivity}
            onOpenScanner={(actId) => {
              setScannerActivityId(actId);
              setIsScannerOpen(true);
            }}
            onBackToMembers={() => setActiveNav('anggota')}
            onManualCheckIn={onManualCheckIn}
          />
        )}
      </main>

      {/* Rejection Modal */}
      {rejectingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border-t-4 border-rose-500">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              Tolak Pendaftaran Anggota
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Alasan penolakan berkas untuk <strong>{rejectingMember.nama}</strong>:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Lampiran KTP kurang jelas / Nomor NIK belum sesuai."
              className="w-full mt-3 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  onReject(rejectingMember.id, rejectReason);
                  setRejectingMember(null);
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Tolak Sekarang
              </button>
              <button
                onClick={() => setRejectingMember(null)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Attendance Scanner Modal */}
      {isScannerOpen && (
        <QrScannerModal
          activities={activities}
          selectedActivityId={scannerActivityId}
          allMembers={members}
          onClose={() => {
            setIsScannerOpen(false);
            setScannerActivityId(undefined);
          }}
          onRecordAttendance={onRecordAttendance}
        />
      )}

      {/* Registration Traceability & Deep Logging Audit Modal */}
      {isTraceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-[#f8faf9] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                    Log Pelacakan Pendaftaran &amp; Sinkronisasi Firestore
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Merekam inisialisasi, status koneksi Firestore, konfirmasi penulisan, &amp; polling 3 detik
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTraceList(getRegistrationTraces());
                    setDeepLogsList(getDeepRegistrationLogs());
                  }}
                  className="p-2 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                  title="Segarkan Log"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsTraceModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs in Modal: Ringkasan vs Log Mendalam */}
            <div className="flex border-b border-gray-100 bg-[#f8faf9] px-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setTraceTab('ringkasan')}
                className={`py-2 px-3 border-b-2 font-bold cursor-pointer transition-colors ${
                  traceTab === 'ringkasan'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Ringkasan Pendaftaran ({traceList.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeepLogsList(getDeepRegistrationLogs());
                  setTraceTab('deep');
                }}
                className={`py-2 px-3 border-b-2 font-bold cursor-pointer transition-colors ${
                  traceTab === 'deep'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Log Mendalam &amp; Polling 3 Detik ({deepLogsList.length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3.5">
              <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
                <span>
                  {traceTab === 'ringkasan' 
                    ? `Total riwayat sesi: ${traceList.length}` 
                    : `Total rincian log: ${deepLogsList.length} rekaman`}
                </span>
                {(traceList.length > 0 || deepLogsList.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Bersihkan semua riwayat log pelacakan dan log mendalam pada perangkat ini?')) {
                        clearRegistrationTraces();
                        clearDeepRegistrationLogs();
                        setTraceList([]);
                        setDeepLogsList([]);
                      }
                    }}
                    className="text-rose-600 hover:underline cursor-pointer font-medium"
                  >
                    Bersihkan Riwayat
                  </button>
                )}
              </div>

              {traceTab === 'ringkasan' ? (
                traceList.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                    <History className="w-8 h-8 text-gray-400 mx-auto" />
                    <div className="text-xs font-semibold text-gray-700">Belum Ada Catatan Pendaftaran Baru</div>
                    <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">
                      Setiap pendaftaran anggota baru yang dilakukan akan otomatis mencatat tahapan kalkulasi ukuran berkas, percobaan retry, verifikasi konsistensi server Firestore, dan penerbitan notifikasi di sini.
                    </p>
                  </div>
                ) : (
                  traceList.map((tr) => (
                    <div
                      key={tr.traceId}
                      className={`p-3.5 sm:p-4 rounded-2xl border text-xs transition-all ${
                        tr.success
                          ? 'bg-white border-emerald-200/90 shadow-2xs'
                          : 'bg-rose-50/50 border-rose-200 shadow-2xs'
                      }`}
                    >
                      {/* Header Trace Record */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          {tr.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                              <span>{tr.nama}</span>
                              <span className="px-1.5 py-0.5 rounded-md bg-stone-100 text-[10px] text-gray-700 font-semibold">
                                {tr.role}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                ID: {tr.memberId}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              NIK: {tr.nikMasked} &bull; {new Date(tr.timestamp).toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold border border-indigo-200/70 block">
                            {tr.traceId}
                          </span>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {tr.payloadSizeKB} KB &bull; {tr.totalDurationMs}ms
                          </div>
                        </div>
                      </div>

                      {/* Error Box if Failed */}
                      {tr.error && (
                        <div className="my-2.5 p-2 bg-rose-100/70 border border-rose-300 rounded-xl text-rose-800 text-[11px] flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span className="break-all">{tr.error}</span>
                        </div>
                      )}

                      {/* Step Breakdown */}
                      <div className="mt-2.5 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Rincian Langkah &amp; Latensi:
                        </div>
                        <div className="space-y-1 pl-1">
                          {tr.steps.map((st, sIdx) => (
                            <div key={sIdx} className="flex items-center justify-between text-[11px] text-gray-600">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="truncate">{st.step}</span>
                                {st.detail && (
                                  <span className="text-[10px] text-gray-400 truncate hidden sm:inline">
                                    ({st.detail})
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-gray-400 shrink-0 ml-2">
                                {st.durationMs}ms
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* Tab Log Mendalam (Deep Logs) */
                deepLogsList.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                    <ShieldCheck className="w-8 h-8 text-gray-400 mx-auto" />
                    <div className="text-xs font-semibold text-gray-700">Belum Ada Rekaman Log Mendalam</div>
                    <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">
                      Log mendalam mencatat status ping koneksi Firestore, ukuran payload byte, siklus polling 3 detik, dan waktu penulisan secara terperinci per event.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deepLogsList.map((log) => {
                      const badgeStyle = 
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        log.status === 'ERROR' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        log.status === 'WARN' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-indigo-100 text-indigo-800 border-indigo-300';

                      return (
                        <div key={log.id} className="p-3 bg-white border border-gray-200/80 rounded-2xl shadow-2xs text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${badgeStyle}`}>
                              [{log.stage}]
                            </span>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString('id-ID')} &bull; {log.latencyMs ? `${log.latencyMs}ms` : '0ms'}
                            </div>
                          </div>
                          <div className="font-bold text-gray-900 pt-0.5">
                            {log.title}
                          </div>
                          <div className="text-[11px] text-gray-600 leading-relaxed">
                            {log.detail}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Trace: {log.traceId}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pengecekan polling 3 detik menjamin data terbaca di koleksi 'members'</span>
              </span>
              <button
                type="button"
                onClick={() => setIsTraceModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Arsip Data Terhapus ('tempdatalama') */}
      {isTempDataLamaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-[#f8faf9] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                    Arsip Data Terhapus (Tabel <code className="text-[#0b5d34]">tempdatalama</code>)
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Menampung data anggota yang pernah dihapus agar dapat dimuat &amp; dikembalikan ke tabel <code className="text-[#0b5d34]">members</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTempDataLamaOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {tempDataLama.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                  <Archive className="w-8 h-8 text-gray-400 mx-auto" />
                  <div className="text-xs font-semibold text-gray-700">Tabel tempdatalama Kosong</div>
                  <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">
                    Saat ini tidak ada data anggota yang terhapus. Setiap anggota yang dihapus tidak akan hilang permanen, melainkan disimpan di tabel sementara <strong>tempdatalama</strong> dan nomor ID-nya tetap terjaga unik.
                  </p>
                </div>
              ) : (
                tempDataLama.map((item) => (
                  <div
                    key={item.id + '_' + item.nik}
                    className="p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0b5d34] font-bold text-[10px] uppercase">
                          {getPeranLabel(item.peranKeluarga)}
                        </span>
                        <span className="font-mono font-bold text-gray-700">ID: {item.id}</span>
                        {item.deletedAt && (
                          <span className="text-[10px] text-gray-500">
                            Dihapus: {new Date(item.deletedAt).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-gray-900">{item.nama}</div>
                      <div className="text-[11px] font-mono text-gray-600">
                        NIK: <strong>{item.nik}</strong> &bull; No. KK: <strong>{item.noKk}</strong>
                      </div>
                      <div className="text-[11px] text-gray-600">{item.alamat}</div>
                    </div>

                    {onRestoreFromTempDataLama && (
                      <button
                        type="button"
                        disabled={restoringTempId === item.id}
                        onClick={async () => {
                          setRestoringTempId(item.id);
                          try {
                            await onRestoreFromTempDataLama(item);
                          } finally {
                            setRestoringTempId(null);
                          }
                        }}
                        className="px-3.5 py-2 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringTempId === item.id ? 'animate-spin' : ''}`} />
                        <span>{restoringTempId === item.id ? 'Memulihkan...' : 'Kembalikan ke Members'}</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-600">
                Total data di <code className="font-bold text-[#0b5d34]">tempdatalama</code>: {tempDataLama.length} anggota
              </span>
              <button
                type="button"
                onClick={() => setIsTempDataLamaOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXACT 4-MENU ADMIN BOTTOM DOCK: Anggota | Kegiatan | Scan QR | Logout */}
      <div className="fixed bottom-3 sm:bottom-4 inset-x-0 z-40 flex justify-center px-2 sm:px-4 pointer-events-none print:hidden">
        <nav 
          aria-label="Navigasi Panel Admin"
          className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#0b5d34]/20 shadow-2xl rounded-2xl sm:rounded-full p-1 sm:p-1.5 flex items-center justify-between sm:justify-center gap-1 sm:gap-3 max-w-md sm:max-w-none w-full sm:w-auto"
        >
          {/* 1. Menu Anggota */}
          <button
            type="button"
            onClick={() => setActiveNav('anggota')}
            className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all cursor-pointer ${
              activeNav === 'anggota'
                ? 'bg-[#0b5d34] text-white shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold'
            }`}
            title="Kelola Data Anggota"
          >
            <Users className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">Anggota</span>
          </button>

          {/* 2. Menu Kegiatan */}
          <button
            type="button"
            onClick={() => setActiveNav('kegiatan')}
            className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all cursor-pointer ${
              activeNav === 'kegiatan'
                ? 'bg-[#0b5d34] text-white shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70 font-semibold'
            }`}
            title="Manajemen Kegiatan & Kalender"
          >
            <CalendarDays className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">Kegiatan</span>
          </button>

          {/* 3. Menu Scan QR */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-initial flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-emerald-800 hover:text-white bg-emerald-50 hover:bg-[#0b5d34] transition-all cursor-pointer font-bold border border-emerald-200 hover:border-[#0b5d34]"
            title="Pindai QR Code untuk Presensi Kehadiran"
          >
            <QrCode className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">Scan QR</span>
          </button>

          {/* 4. Menu Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 sm:flex-initial flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-rose-700 hover:text-white hover:bg-rose-600 transition-all cursor-pointer font-bold"
            title="Keluar dari Panel Admin"
          >
            <LogOut className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
