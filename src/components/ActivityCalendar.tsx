import React, { useState } from 'react';
import { Activity, ActivityType } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Download, 
  ExternalLink, 
  Plus,
  CheckCircle2
} from 'lucide-react';
import { 
  getActivityTypeLabel, 
  getActivityTypeBadgeClass, 
  formatIndonesianDate 
} from '../utils/storage';
import { downloadIcsFile, getGoogleCalendarUrl } from '../utils/calendarExport';

interface ActivityCalendarProps {
  activities: Activity[];
  onSelectActivity: (activity: Activity) => void;
  onAddNew: () => void;
}

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({
  activities,
  onSelectActivity,
  onAddNew,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 9, 1)); // Default Oct 2026 or current
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Month Names in Indonesian
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(now.toISOString().slice(0, 10));
  };

  // Calculate calendar days
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  // Map activities by date string: YYYY-MM-DD
  const activitiesByDate = activities.reduce((acc, act) => {
    if (!acc[act.tanggal]) acc[act.tanggal] = [];
    acc[act.tanggal].push(act);
    return acc;
  }, {} as Record<string, Activity[]>);

  // Generate 42 calendar grid cells (6 rows x 7 cols)
  const gridCells: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Prev month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = totalDaysInPrevMonth - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    gridCells.push({ dayNum: day, dateStr, isCurrentMonth: false });
  }

  // Current month
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    gridCells.push({ dayNum: i, dateStr, isCurrentMonth: true });
  }

  // Next month padding to complete 35 or 42 cells
  const remaining = 35 - gridCells.length > 0 ? 35 - gridCells.length : (42 - gridCells.length > 0 ? 42 - gridCells.length : 0);
  for (let i = 1; i <= remaining; i++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    gridCells.push({ dayNum: i, dateStr, isCurrentMonth: false });
  }

  // Selected date events
  const selectedDateEvents = activitiesByDate[selectedDateStr] || [];

  return (
    <div className="space-y-4">
      {/* Calendar Header Controls */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Month Title & Nav */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base sm:text-xl font-bold text-gray-900 ml-1">
            {monthNames[month]} {year}
          </h3>

          <button
            type="button"
            onClick={goToToday}
            className="ml-2 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0b5d34] border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Bulan Ini
          </button>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadIcsFile(activities, 'Kalender_Kegiatan_Yayasan_Al-Ikhlas')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold border border-stone-300 transition-colors cursor-pointer"
            title="Download file kalender .ICS universal kompatibel semua OS"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Kalender .ICS</span>
          </button>

          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        {/* Day Name Header */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-stone-50/80 text-center text-xs font-bold text-gray-600 py-2.5">
          {dayNames.map((d, idx) => (
            <div key={d} className={idx === 0 ? 'text-red-600' : ''}>
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {gridCells.map((cell, idx) => {
            const cellEvents = activitiesByDate[cell.dateStr] || [];
            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === new Date().toISOString().slice(0, 10);

            return (
              <div
                key={`${cell.dateStr}-${idx}`}
                onClick={() => setSelectedDateStr(cell.dateStr)}
                className={`min-h-[75px] sm:min-h-[105px] p-1.5 sm:p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                  !cell.isCurrentMonth
                    ? 'bg-gray-50/50 text-gray-300'
                    : isSelected
                    ? 'bg-emerald-50/40 ring-1 ring-[#0b5d34] ring-inset'
                    : 'hover:bg-gray-50/80 text-gray-800'
                }`}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono ${
                      isToday
                        ? 'bg-[#0b5d34] text-white shadow-2xs'
                        : isSelected
                        ? 'bg-emerald-200 text-emerald-900'
                        : cell.isCurrentMonth
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {cellEvents.length > 0 && (
                    <span className="text-[10px] font-bold text-[#0b5d34] bg-emerald-100/80 px-1.5 rounded-full hidden sm:inline">
                      {cellEvents.length} Acara
                    </span>
                  )}
                </div>

                {/* Event Chips inside cell */}
                <div className="space-y-1 overflow-hidden flex-1">
                  {cellEvents.slice(0, 2).map((event) => {
                    const badge = getActivityTypeBadgeClass(event.jenis);
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectActivity(event);
                        }}
                        className={`text-[9px] sm:text-[10px] p-1 rounded-md border font-semibold truncate hover:opacity-90 cursor-pointer ${badge.bg} ${badge.text} ${badge.border}`}
                        title={`${event.judul} (${event.jamMulai}) - Klik untuk Detail`}
                      >
                        <span className="font-mono">{event.jamMulai}</span> {event.judul}
                      </div>
                    );
                  })}
                  {cellEvents.length > 2 && (
                    <div className="text-[9px] font-bold text-gray-400 pl-1">
                      +{cellEvents.length - 2} lagi...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail Section Below Grid */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#0b5d34]" />
            <h4 className="text-sm sm:text-base font-bold text-gray-900">
              Jadwal Kegiatan: {formatIndonesianDate(selectedDateStr)}
            </h4>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {selectedDateEvents.length} Kegiatan
          </span>
        </div>

        {selectedDateEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {selectedDateEvents.map((act) => {
              const badge = getActivityTypeBadgeClass(act.jenis);
              const label = getActivityTypeLabel(act.jenis);
              return (
                <div
                  key={act.id}
                  onClick={() => onSelectActivity(act)}
                  className="p-3.5 rounded-xl border border-gray-100 bg-stone-50/60 hover:bg-emerald-50/40 hover:border-emerald-300 transition-all cursor-pointer flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {label}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {act.jamMulai} WITA
                      </span>
                    </div>
                    <h5 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[#0b5d34] truncate">
                      {act.judul}
                    </h5>
                    {act.lokasi && (
                      <p className="text-[11px] text-gray-500 truncate">
                        📍 {act.lokasi}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-[#0b5d34] font-bold group-hover:underline">
                      Detail →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-gray-400">
            Tidak ada jadwal kegiatan pada tanggal ini. Klik &quot;Tambah Jadwal&quot; untuk membuat acara baru.
          </div>
        )}
      </div>
    </div>
  );
};
