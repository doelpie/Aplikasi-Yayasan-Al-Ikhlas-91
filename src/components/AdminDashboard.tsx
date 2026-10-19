import React, { useState, useMemo } from 'react';
import { Member, MemberStatus, AppNotification } from '../types';
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
  RotateCcw,
  Bell,
  Sparkles,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

interface AdminDashboardProps {
  members: Member[];
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
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  members,
  notifications,
  onApprove,
  onReject,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onViewCard,
  onViewDoc,
  onLogout,
  onResetData,
  onOpenNotifications,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | MemberStatus>('semua');
  const [rejectingMember, setRejectingMember] = useState<Member | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Statistics
  const countApproved = useMemo(() => members.filter(m => m.status === 'disetujui').length, [members]);
  const countTotalJiwa = useMemo(() => {
    return members
      .filter(m => m.status === 'disetujui')
      .reduce((acc, m) => acc + 1 + (Number(m.jumlahKeluarga) || 0), 0);
  }, [members]);
  const countPending = useMemo(() => members.filter(m => m.status === 'menunggu').length, [members]);
  const countRejected = useMemo(() => members.filter(m => m.status === 'ditolak').length, [members]);

  // Filtered members
  const filteredList = useMemo(() => {
    let list = members;
    if (statusFilter !== 'semua') {
      list = list.filter(m => m.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(m => 
        m.nama.toLowerCase().includes(q) ||
        m.alamat.toLowerCase().includes(q) ||
        m.noHp.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        m.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, statusFilter, searchTerm]);

  // Open WhatsApp with friendly pre-filled text
  const handleOpenWhatsApp = (member: Member) => {
    const cleanHp = member.noHp.replace(/\D/g, '');
    let formattedHp = cleanHp;
    if (formattedHp.startsWith('0')) {
      formattedHp = '62' + formattedHp.slice(1);
    } else if (!formattedHp.startsWith('62')) {
      formattedHp = '62' + formattedHp;
    }

    const last4 = cleanHp.slice(-4);
    let message = '';
    if (member.status === 'disetujui') {
      message = `Assalamu'alaikum Bpk/Ibu *${member.nama}*,\n\nAlhamdulillah, pendaftaran keanggotaan Anda di *Yayasan Al Ikhlas Sembilan Satu* telah *DISETUJUI* dengan ID Anggota: *${member.id}*.\n\nAnda dapat mengunduh dan mencetak Kartu Anggota Resmi dengan memasukkan 4 digit terakhir nomor HP Anda (*${last4}*).\n\nTerima kasih atas partisipasi Anda.`;
    } else if (member.status === 'ditolak') {
      message = `Assalamu'alaikum Bpk/Ibu *${member.nama}*,\n\nMohon maaf, data pendaftaran Anda di *Yayasan Al Ikhlas Sembilan Satu* belum dapat disetujui.\n*Catatan*: ${member.catatanPenolakan || 'Data administrasi belum lengkap'}.\n\nSilakan hubungi pengurus untuk perbaikan data. Terima kasih.`;
    } else {
      message = `Assalamu'alaikum Bpk/Ibu *${member.nama}*,\n\nKami dari Pengurus *Yayasan Al Ikhlas Sembilan Satu* sedang memverifikasi berkas pendaftaran Anda. Mohon ditunggu informasi selanjutnya. Terima kasih.`;
    }

    const waUrl = `https://wa.me/${formattedHp}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'No Registrasi',
      'Nama Kepala Keluarga',
      'Tempat Tanggal Lahir',
      'Alamat',
      'Jumlah Keluarga',
      'No Telp/HP',
      'Email',
      'Status',
      'Tanggal Daftar',
      'Tanggal Disetujui',
    ];

    const rows = members.map(m => [
      `"${m.id}"`,
      `"${m.regNumber || '-'}"`,
      `"${m.nama.replace(/"/g, '""')}"`,
      `"${m.tempatTanggalLahir.replace(/"/g, '""')}"`,
      `"${m.alamat.replace(/"/g, '""')}"`,
      m.jumlahKeluarga,
      `"'${m.noHp}"`,
      `"${m.email || '-'}"`,
      `"${m.status.toUpperCase()}"`,
      `"${m.tanggalDaftar}"`,
      `"${m.tanggalDisetujui || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Data_Anggota_Yayasan_Al_Ikhlas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#faf5f5] pb-28">
      {/* Red Header matching Screenshot_2026-10-19-10-03-23-048 */}
      <div className="bg-[#83141a] text-white pt-5 pb-10 px-4 sm:px-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase leading-none">
              ADMIN ANGGOTA
            </h1>
            <p className="text-xs text-red-200 mt-1 font-medium">
              Yayasan Al Ikhlas Sembilan Satu
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Keluar dari Admin"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-6">
        {/* 4 Top Stat Cards matching screenshot 10-03-23-048 */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {/* 1. Kepala Keluarga */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100">
            <div className="text-xl sm:text-3xl font-extrabold text-[#83141a]">
              {countApproved}
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-gray-600 mt-0.5 leading-tight">
              Kepala Keluarga
            </div>
          </div>

          {/* 2. Total Jiwa */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100">
            <div className="text-xl sm:text-3xl font-extrabold text-[#83141a]">
              {countTotalJiwa}
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-gray-600 mt-0.5 leading-tight">
              Total Jiwa
            </div>
          </div>

          {/* 3. Menunggu ACC */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100 relative">
            <div className={`text-xl sm:text-3xl font-extrabold ${countPending > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
              {countPending}
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-gray-600 mt-0.5 leading-tight">
              Menunggu ACC
            </div>
            {countPending > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </div>

          {/* 4. Ditolak */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 text-center shadow-xs border border-gray-100">
            <div className="text-xl sm:text-3xl font-extrabold text-rose-700">
              {countRejected}
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-gray-600 mt-0.5 leading-tight">
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
            placeholder="Cari nama / alamat / telp / email..."
            className="w-full pl-10 pr-4 py-3 bg-white text-gray-800 text-xs sm:text-sm font-medium rounded-2xl shadow-xs border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-[#83141a]/30 focus:border-[#83141a] transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Filter Status Tabs: [Semua] [Menunggu] [Disetujui] [Ditolak] */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setStatusFilter('semua')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === 'semua'
                ? 'bg-[#83141a] text-white shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
            }`}
          >
            Semua ({members.length})
          </button>
          <button
            onClick={() => setStatusFilter('menunggu')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'menunggu'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
            }`}
          >
            <span>Menunggu</span>
            {countPending > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'menunggu' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                {countPending}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('disetujui')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === 'disetujui'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
            }`}
          >
            Disetujui ({countApproved})
          </button>
          <button
            onClick={() => setStatusFilter('ditolak')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === 'ditolak'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
            }`}
          >
            Ditolak ({countRejected})
          </button>
        </div>

        {/* Members Cards List matching Screenshot 10-03-23-048 & 10-03-42-339 */}
        <div className="mt-4 space-y-3">
          {filteredList.length > 0 ? (
            filteredList.map((member, index) => {
              const cleanHp = member.noHp.replace(/\D/g, '');
              const last4 = cleanHp.slice(-4);
              return (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-gray-100 transition-all hover:shadow-md"
                >
                  {/* Row 1: Index. Name + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                      {member.id}. {member.nama.toUpperCase()}
                    </h3>

                    {member.status === 'disetujui' && (
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 shrink-0">
                        Disetujui
                      </span>
                    )}
                    {member.status === 'menunggu' && (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 shrink-0 flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3" /> Menunggu
                      </span>
                    )}
                    {member.status === 'ditolak' && (
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 shrink-0">
                        Ditolak
                      </span>
                    )}
                  </div>

                  {/* Row 2: Tempat & Tanggal Lahir */}
                  <div className="text-xs text-gray-600 uppercase font-semibold mt-1">
                    {member.tempatTanggalLahir || '-'}
                  </div>

                  {/* Row 3: Alamat */}
                  <div className="text-xs sm:text-sm text-gray-800 font-medium mt-1 leading-relaxed">
                    {member.alamat}
                  </div>

                  {/* Row 4: Jumlah Orang · Telp · No Registrasi */}
                  <div className="text-xs text-gray-600 mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-gray-900">{member.jumlahKeluarga} orang</span>
                    <span>·</span>
                    <span className="font-semibold font-mono text-gray-800">{member.noHp}</span>
                    <span>·</span>
                    <span className="text-gray-500">
                      No: {member.regNumber || 'Dalam Proses'}
                    </span>
                    <span>·</span>
                    <span className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded font-mono">
                      PIN: {last4}
                    </span>
                  </div>

                  {/* Documents & Note Status */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs">
                    {member.ktpUrl ? (
                      <button
                        onClick={() => onViewDoc(`KTP - ${member.nama}`, member.ktpUrl, member.ktpName)}
                        className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1 underline cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>KTP terlampir</span>
                      </button>
                    ) : (
                      <span className="text-red-500 font-medium">KTP kosong</span>
                    )}

                    {member.kkUrl ? (
                      <button
                        onClick={() => onViewDoc(`KK - ${member.nama}`, member.kkUrl, member.kkName)}
                        className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1 underline cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>KK terlampir</span>
                      </button>
                    ) : (
                      <span className="text-red-500 font-medium">KK kosong</span>
                    )}

                    {member.status === 'ditolak' && member.catatanPenolakan && (
                      <span className="text-rose-700 italic">
                        Alasan: {member.catatanPenolakan}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="mt-3.5 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    {/* Approve / Reject Buttons (Especially for Menunggu or status change) */}
                    <div className="flex items-center gap-1.5">
                      {member.status !== 'disetujui' && (
                        <button
                          onClick={() => onApprove(member.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="Setujui pendaftaran dan aktifkan kartu anggota"
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                          title="Tolak pendaftaran dengan catatan"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                      )}

                      {/* Kartu Preview Button */}
                      {member.status === 'disetujui' && (
                        <button
                          onClick={() => onViewCard(member)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#83141a] text-xs font-semibold rounded-xl transition-all cursor-pointer border border-red-200/60"
                          title="Lihat / Cetak Kartu Anggota"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Kartu</span>
                        </button>
                      )}
                    </div>

                    {/* Secondary Actions: WA, Edit, Hapus */}
                    <div className="flex items-center gap-1.5">
                      {/* WhatsApp Button */}
                      <button
                        onClick={() => handleOpenWhatsApp(member)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        title="Kirim pesan status via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WA</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => onEditMember(member)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        title="Edit data anggota"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Edit</span>
                      </button>

                      {/* Hapus Button */}
                      <button
                        onClick={() => onDeleteMember(member.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-red-50 border border-gray-200 text-gray-600 hover:text-red-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        title="Hapus data anggota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-xs">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-gray-800">Tidak ada data ditemukan</h4>
              <p className="text-xs text-gray-500 mt-1">
                Ubah filter status atau kata kunci pencarian.
              </p>
            </div>
          )}
        </div>

        {/* Quick Demo Reset Helper */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>Mode Admin Yayasan Al Ikhlas Sembilan Satu</span>
          <button
            onClick={onResetData}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
            title="Kembalikan data ke contoh awal untuk demo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data Demo</span>
          </button>
        </div>
      </div>

      {/* Rejection Note Modal */}
      {rejectingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Tolak Pendaftaran
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Masukkan alasan penolakan untuk <strong>{rejectingMember.nama}</strong>:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Lampiran KTP tidak terbaca / Wilayah domisili di luar jangkauan."
              className="w-full mt-3 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  onReject(rejectingMember.id, rejectReason);
                  setRejectingMember(null);
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
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

      {/* Admin Bottom Navigation Dock matching screenshots */}
      <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4">
        <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-xl rounded-full px-5 py-2.5 flex items-center gap-6 sm:gap-8">
          {/* Data */}
          <button
            onClick={() => setStatusFilter('semua')}
            className="flex flex-col items-center text-gray-700 hover:text-[#83141a] transition-colors cursor-pointer"
          >
            <FileText className="w-5 h-5 text-emerald-600" />
            <span className="text-[11px] font-semibold mt-0.5">Data</span>
          </button>

          {/* Tambah */}
          <button
            onClick={onAddMember}
            className="flex flex-col items-center text-gray-700 hover:text-[#83141a] transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5 text-gray-800" />
            <span className="text-[11px] font-semibold mt-0.5">Tambah</span>
          </button>

          {/* Ekspor */}
          <button
            onClick={handleExportCSV}
            className="flex flex-col items-center text-gray-700 hover:text-[#83141a] transition-colors cursor-pointer"
          >
            <Download className="w-5 h-5 text-blue-600" />
            <span className="text-[11px] font-semibold mt-0.5">Ekspor</span>
          </button>

          {/* Keluar */}
          <button
            onClick={onLogout}
            className="flex flex-col items-center text-gray-700 hover:text-red-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-amber-700" />
            <span className="text-[11px] font-semibold mt-0.5">Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
