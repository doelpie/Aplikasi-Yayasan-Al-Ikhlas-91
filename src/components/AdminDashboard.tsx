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
  QrCode
} from 'lucide-react';
import { getPeranLabel, getInitials } from '../utils/storage';
import { ActivityManagement } from './ActivityManagement';
import { QrScannerModal } from './QrScannerModal';

interface AdminDashboardProps {
  members: Member[];
  activities: Activity[];
  notifications: AppNotification[];
  onApprove: (memberId: string) => void;
  onReject: (memberId: string, reason?: string) => void;
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
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
  activities,
  notifications,
  onApprove,
  onReject,
  onAddMember,
  onEditMember,
  onDeleteMember,
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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Anggota',
      'Status Hubungan',
      'NIK (KTP/KIA)',
      'Nama Sesuai KTP',
      'No Kartu Keluarga (KK)',
      'Kepala Keluarga',
      'Tempat Tanggal Lahir',
      'Alamat Domisili',
      'No Telp/HP',
      'Status Approval',
      'Tanggal Daftar',
      'Tanggal Disetujui',
    ];

    const rows = members.map(m => [
      `"${m.id}"`,
      `"${getPeranLabel(m.peranKeluarga)}"`,
      `"'${m.nik}"`,
      `"${m.nama.replace(/"/g, '""')}"`,
      `"'${m.noKk}"`,
      `"${m.namaKepalaKeluarga || (m.peranKeluarga === 'kepala_keluarga' ? m.nama : '-')}"`,
      `"${m.tempatTanggalLahir.replace(/"/g, '""')}"`,
      `"${m.alamat.replace(/"/g, '""')}"`,
      `"'${m.noHp}"`,
      `"${m.status.toUpperCase()}"`,
      `"${m.tanggalDaftar}"`,
      `"${m.tanggalDisetujui || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Data_Anggota_Yayasan_Al_Ikhlas_Sembilan_Satu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-[#0b5d34] border border-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Ekspor data anggota ke CSV"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export</span>
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

                          {/* Documents */}
                          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs">
                            {member.fotoUrl && (
                              <button
                                onClick={() => onViewDoc(`Foto Diri - ${member.nama}`, member.fotoUrl, member.fotoName)}
                                className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 underline cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Foto Diri</span>
                              </button>
                            )}
                            {member.ktpUrl ? (
                              <button
                                onClick={() => onViewDoc(`KTP - ${member.nama}`, member.ktpUrl, member.ktpName)}
                                className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 underline cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>KTP</span>
                              </button>
                            ) : (
                              <span className="text-gray-400">KTP (-)</span>
                            )}
                            {member.kkUrl ? (
                              <button
                                onClick={() => onViewDoc(`KK - ${member.nama}`, member.kkUrl, member.kkName)}
                                className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 underline cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>KK</span>
                              </button>
                            ) : (
                              <span className="text-gray-400">KK (-)</span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                            {/* Approval actions */}
                            <div className="flex items-center gap-1.5">
                              {member.status !== 'disetujui' && (
                                <button
                                  onClick={() => onApprove(member.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
                                  title="Setujui dan aktifkan kartu anggota"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Setujui</span>
                                </button>
                              )}

                              {member.status !== 'ditolak' && (
                                <button
                                  onClick={() => {
                                    setRejectingMember(member);
                                    setRejectReason('');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer"
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
