import React, { useState } from 'react';
import { Activity, Member, ActivityAttendee } from '../types';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Download, 
  QrCode, 
  ExternalLink, 
  Search, 
  FileText, 
  Printer, 
  Share2,
  AlertCircle
} from 'lucide-react';
import { 
  getActivityTypeLabel, 
  getActivityTypeBadgeClass, 
  formatIndonesianDate, 
  getPeranLabel, 
  maskNik, 
  getInitials 
} from '../utils/storage';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarExport';

interface ActivityDetailModalProps {
  activity: Activity;
  allMembers: Member[];
  onClose: () => void;
  onOpenScannerForActivity: (activityId: string) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  onManualCheckIn?: (activityId: string, member: Member) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  allMembers,
  onClose,
  onOpenScannerForActivity,
  onEditActivity,
  onDeleteActivity,
  onManualCheckIn,
}) => {
  const [activeTab, setActiveTab] = useState<'hadir' | 'peserta'>('hadir');
  const [searchQuery, setSearchQuery] = useState('');

  const typeLabel = getActivityTypeLabel(activity.jenis);
  const typeStyle = getActivityTypeBadgeClass(activity.jenis);

  // Map participant members
  const participantMembers = activity.pesertaIds.map(id => {
    return allMembers.find(m => m.id === id) || {
      id,
      nama: `Anggota ID: ${id}`,
      nik: '-',
      peranKeluarga: 'kepala_keluarga',
      alamat: '-',
      noHp: '-',
      noKk: '-',
      status: 'disetujui',
      tanggalDaftar: '',
      tempatTanggalLahir: '',
    } as Member;
  });

  // Filtered kehadiran
  const filteredKehadiran = activity.kehadiran.filter(k => 
    k.memberNama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.memberNik.includes(searchQuery) ||
    k.memberId.includes(searchQuery)
  );

  // Filtered participants
  const filteredParticipants = participantMembers.filter(m => 
    m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.nik.includes(searchQuery) ||
    m.id.includes(searchQuery)
  );

  // Export Daftar Hadir as CSV
  const handleExportCsv = () => {
    if (activity.kehadiran.length === 0) {
      alert('Belum ada data kehadiran untuk diexport.');
      return;
    }

    const headers = ['No', 'ID Anggota', 'Nama Lengkap', 'NIK', 'Peran Keluarga', 'Jam Scan Hadir', 'Kegiatan', 'Jenis'];
    const rows = activity.kehadiran.map((k, idx) => [
      idx + 1,
      `"${k.memberId}"`,
      `"${k.memberNama.replace(/"/g, '""')}"`,
      `'${k.memberNik}`,
      `"${getPeranLabel(k.memberPeran as any)}"`,
      `"${k.scanTimeFormatted}"`,
      `"${activity.judul.replace(/"/g, '""')}"`,
      `"${typeLabel}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanTitle = activity.judul.replace(/\s+/g, '_').slice(0, 30);
    link.setAttribute('download', `Daftar_Hadir_${cleanTitle}_${activity.tanggal}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto border-t-4 border-[#0b5d34] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div className="space-y-1.5 min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                {typeLabel}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                ID: {activity.id}
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 leading-snug">
              {activity.judul}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Grid Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 p-4 rounded-2xl bg-[#0b5d34]/5 border border-[#0b5d34]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0b5d34] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Tanggal Acara</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900 truncate block">
                {formatIndonesianDate(activity.tanggal)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0b5d34] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Waktu Acara</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900 font-mono truncate block">
                {activity.jamMulai} {activity.jamSelesai ? `- ${activity.jamSelesai}` : ''} WITA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0b5d34] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Tempat</span>
              <span className="text-xs font-semibold text-gray-800 truncate block">
                {activity.lokasi || 'Gedung Yayasan'}
              </span>
            </div>
          </div>
        </div>

        {/* Deskripsi */}
        {activity.deskripsi && (
          <div className="mb-4 text-xs text-gray-600 bg-stone-50 p-3 rounded-xl border border-stone-200">
            <span className="font-bold text-gray-800 block mb-0.5">Deskripsi Kegiatan:</span>
            <p className="whitespace-pre-line leading-relaxed">{activity.deskripsi}</p>
          </div>
        )}

        {/* Sync & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tombol Buka Google Calendar */}
            <a
              href={getGoogleCalendarUrl(activity)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
              title="Buka form simpan di Google Calendar"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Google Calendar</span>
            </a>

            {/* Tombol Unduh File .ICS Universal */}
            <button
              type="button"
              onClick={() => downloadIcsFile([activity], `Jadwal_${activity.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold border border-stone-300 transition-colors cursor-pointer"
              title="Unduh file kalender universal (.ics) untuk Apple, Outlook, Android"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .ICS</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Mulai Scan Presensi */}
            <button
              type="button"
              onClick={() => onOpenScannerForActivity(activity.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Hadir</span>
            </button>

            {/* Tombol Export CSV Kehadiran */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Toggle: Daftar Hadir vs Daftar Peserta */}
        <div className="flex items-center justify-between mt-3 mb-2">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('hadir')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'hadir'
                  ? 'bg-white text-[#0b5d34] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Daftar Hadir ({activity.kehadiran.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('peserta')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'peserta'
                  ? 'bg-white text-[#0b5d34] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Daftar Peserta ({activity.pesertaIds.length})</span>
            </button>
          </div>

          <div className="relative w-44 sm:w-56">
            <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* TAB 1: DAFTAR HADIR (KEHADIRAN) */}
        {activeTab === 'hadir' && (
          <div className="flex-1 overflow-y-auto min-h-[220px]">
            {filteredKehadiran.length > 0 ? (
              <div className="space-y-2 mt-2">
                {filteredKehadiran.map((attendee, index) => {
                  return (
                    <div
                      key={`${attendee.memberId}-${index}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 hover:border-emerald-200 shadow-2xs transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#0b5d34] font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                          {index + 1}
                        </div>
                        {attendee.memberFotoUrl ? (
                          <img
                            src={attendee.memberFotoUrl}
                            alt={attendee.memberNama}
                            className="w-10 h-10 rounded-full object-cover border border-[#0b5d34] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#0b5d34] font-bold text-sm flex items-center justify-center border border-emerald-300 shrink-0">
                            {getInitials(attendee.memberNama)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {attendee.memberNama}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            NIK: {maskNik(attendee.memberNik)} · {getPeranLabel(attendee.memberPeran as any)}
                          </div>
                          <div className="text-[10px] text-emerald-800 font-medium">
                            Kegiatan: {attendee.activityTitle} ({typeLabel})
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{attendee.scanTimeFormatted}</span>
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          ID: {attendee.memberId}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl my-3">
                <QrCode className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="font-semibold text-gray-600">Belum ada anggota yang scan presensi hadir.</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Buka menu Scan QR untuk memindai kartu anggota yang hadir di acara.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenScannerForActivity(activity.id)}
                  className="mt-3 px-3 py-1.5 bg-[#0b5d34] text-white rounded-lg text-xs font-bold hover:bg-[#084d2a] cursor-pointer"
                >
                  Mulai Scan QR Hadir Sekarang
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DAFTAR PESERTA (SEMUA YANG DIUNDANG) */}
        {activeTab === 'peserta' && (
          <div className="flex-1 overflow-y-auto min-h-[220px]">
            {filteredParticipants.length > 0 ? (
              <div className="space-y-2 mt-2">
                {filteredParticipants.map((member, index) => {
                  const hasAttended = activity.kehadiran.some(k => k.memberId === member.id);
                  const attendeeData = activity.kehadiran.find(k => k.memberId === member.id);

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        hasAttended
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {member.fotoUrl ? (
                          <img
                            src={member.fotoUrl}
                            alt={member.nama}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-300 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#0b5d34] font-bold text-sm flex items-center justify-center shrink-0">
                            {getInitials(member.nama)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                            <span>{member.nama}</span>
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-sans">
                              {getPeranLabel(member.peranKeluarga)}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            NIK: {maskNik(member.nik)} · HP: {member.noHp || '-'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        {hasAttended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Hadir ({attendeeData?.scanTimeFormatted})</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Belum Scan
                            </span>
                            {onManualCheckIn && (
                              <button
                                type="button"
                                onClick={() => onManualCheckIn(activity.id, member)}
                                className="text-[10px] font-bold text-[#0b5d34] hover:underline cursor-pointer"
                              >
                                Tandai Hadir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-gray-400">
                Tidak ada peserta terdaftar.
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEditActivity(activity)}
              className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl cursor-pointer"
            >
              Edit Jadwal Kegiatan
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Hapus kegiatan "${activity.judul}"?`)) {
                  onDeleteActivity(activity.id);
                  onClose();
                }
              }}
              className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl cursor-pointer"
            >
              Hapus Kegiatan
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-[#0b5d34] text-white font-bold rounded-xl cursor-pointer hover:bg-[#084d2a]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
