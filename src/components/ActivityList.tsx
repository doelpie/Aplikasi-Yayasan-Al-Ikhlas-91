import React, { useState } from 'react';
import { Activity, ActivityType } from '../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Search, 
  Filter, 
  Plus, 
  QrCode, 
  Download, 
  ExternalLink, 
  ChevronRight,
  MoreVertical,
  CalendarCheck
} from 'lucide-react';
import { 
  getActivityTypeLabel, 
  getActivityTypeBadgeClass, 
  formatIndonesianDate 
} from '../utils/storage';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarExport';

interface ActivityListProps {
  activities: Activity[];
  onSelectActivity: (activity: Activity) => void;
  onOpenScanner: (activityId?: string) => void;
  onAddNew: () => void;
}

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onSelectActivity,
  onOpenScanner,
  onAddNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = activities.filter((act) => {
    const matchSearch = act.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (act.lokasi && act.lokasi.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        act.deskripsi.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchType = selectedType === 'all' || act.jenis === selectedType;

    let matchDate = true;
    if (dateFilter === 'upcoming') {
      matchDate = act.tanggal >= todayStr;
    } else if (dateFilter === 'past') {
      matchDate = act.tanggal < todayStr;
    }

    return matchSearch && matchType && matchDate;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-2xs">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Cari judul kegiatan, lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34]"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Jenis Kegiatan Selector */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none"
          >
            <option value="all">Semua Jenis Kegiatan</option>
            <option value="rapat_pengurus">Rapat Pengurus</option>
            <option value="pengajian_umum">Pengajian Umum</option>
            <option value="arisan">Arisan</option>
          </select>

          {/* Date Filter Selector */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none"
          >
            <option value="all">Semua Jadwal</option>
            <option value="upcoming">Akan Datang & Hari Ini</option>
            <option value="past">Sudah Lewat</option>
          </select>

          {/* Export All .ICS */}
          <button
            type="button"
            onClick={() => downloadIcsFile(activities, 'Semua_Kegiatan_Yayasan_Al-Ikhlas')}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title="Download seluruh kegiatan ke format kalender .ICS universal"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Semua .ICS</span>
          </button>
        </div>
      </div>

      {/* Activities Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((activity) => {
            const typeLabel = getActivityTypeLabel(activity.jenis);
            const typeStyle = getActivityTypeBadgeClass(activity.jenis);
            const isToday = activity.tanggal === todayStr;
            const isPast = activity.tanggal < todayStr;
            const attendeesCount = activity.kehadiran.length;
            const participantsCount = activity.pesertaIds.length;

            return (
              <div
                key={activity.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group hover:border-emerald-200"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                      {typeLabel}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">
                          Hari Ini
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 font-mono">
                        {activity.id}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 
                    onClick={() => onSelectActivity(activity)}
                    className="text-base font-bold text-gray-900 group-hover:text-[#0b5d34] transition-colors cursor-pointer line-clamp-2 leading-snug"
                  >
                    {activity.judul}
                  </h3>

                  {/* Date & Time */}
                  <div className="mt-2.5 space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#0b5d34] shrink-0" />
                      <span className="font-semibold text-gray-800">
                        {formatIndonesianDate(activity.tanggal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="font-mono text-gray-700">
                        {activity.jamMulai} {activity.jamSelesai ? `- ${activity.jamSelesai}` : ''} WITA
                      </span>
                    </div>

                    {activity.lokasi && (
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate text-gray-500">
                          {activity.lokasi}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Attendance Stats Bar */}
                  <div className="mt-3.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-500" />
                      <span>{participantsCount} Peserta Diundang</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{attendeesCount} Hadir</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Google Cal */}
                    <a
                      href={getGoogleCalendarUrl(activity)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="Sinkron ke Google Calendar"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {/* Download .ICS */}
                    <button
                      type="button"
                      onClick={() => downloadIcsFile([activity], `Jadwal_${activity.id}`)}
                      className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                      title="Download file .ICS universal"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Scan QR Hadir */}
                    <button
                      type="button"
                      onClick={() => onOpenScanner(activity.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                      title="Buka Scanner Presensi Acara Ini"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan Presensi</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectActivity(activity)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0b5d34] hover:text-[#084d2a] cursor-pointer"
                  >
                    <span>Detail Kegiatan</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-2xs">
          <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-gray-800">Tidak ada jadwal kegiatan ditemukan</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau tambahkan kegiatan baru untuk memulai manajemen kegiatan yayasan.
          </p>
          <button
            type="button"
            onClick={onAddNew}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b5d34] text-white rounded-xl text-xs font-bold hover:bg-[#084d2a] cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kegiatan Sekarang</span>
          </button>
        </div>
      )}
    </div>
  );
};
