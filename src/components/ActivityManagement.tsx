import React, { useState } from 'react';
import { Activity, Member } from '../types';
import { 
  Calendar as CalendarIcon, 
  ListFilter, 
  Plus, 
  Download, 
  LogOut, 
  QrCode, 
  Layers,
  Sparkles,
  CalendarCheck2
} from 'lucide-react';
import { ActivityList } from './ActivityList';
import { ActivityCalendar } from './ActivityCalendar';
import { ActivityFormModal } from './ActivityFormModal';
import { ActivityDetailModal } from './ActivityDetailModal';
import { downloadIcsFile } from '../utils/calendarExport';

interface ActivityManagementProps {
  activities: Activity[];
  allMembers: Member[];
  onAddNewActivity: (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>) => void;
  onUpdateActivity: (updated: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onOpenScanner: (activityId?: string) => void;
  onBackToMembers: () => void;
  onManualCheckIn?: (activityId: string, member: Member) => void;
}

export const ActivityManagement: React.FC<ActivityManagementProps> = ({
  activities,
  allMembers,
  onAddNewActivity,
  onUpdateActivity,
  onDeleteActivity,
  onOpenScanner,
  onBackToMembers,
  onManualCheckIn,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'daftar' | 'kalender'>('daftar');
  const [isAdding, setIsAdding] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);

  // Get freshest activity for detail modal
  const selectedDetailActivity = detailActivityId 
    ? activities.find(a => a.id === detailActivityId) || null 
    : null;

  const handleSaveActivity = (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>) => {
    if (editingActivity) {
      onUpdateActivity({
        ...editingActivity,
        ...data,
      });
      setEditingActivity(null);
    } else {
      onAddNewActivity(data);
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Navigation Header */}
      <div className="bg-[#0b5d34] text-white p-4 sm:p-6 rounded-3xl shadow-sm border-b-2 border-[#d4af37]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 text-[10px] font-bold border border-emerald-700/80">
                Manajemen Kegiatan Yayasan
              </span>
              <span className="text-xs text-emerald-200">
                Al Ikhlas Sembilan Satu Dalung
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Jadwal & Presensi Kegiatan
            </h1>
            <p className="text-xs text-emerald-100/90 mt-0.5 max-w-xl">
              Kelola jadwal Rapat Pengurus, Pengajian Umum, dan Arisan. Absensi kehadiran tercatat otomatis melalui Scan QR Kartu Anggota.
            </p>
          </div>

          {/* Sub-menu Actions: Jenis Kegiatan, Tambah, Export, dan Keluar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#d4af37] hover:bg-[#c59e2e] text-[#0b5d34] font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Kegiatan</span>
            </button>

            <button
              type="button"
              onClick={() => downloadIcsFile(activities, 'Kalender_Kegiatan_Yayasan_Al-Ikhlas')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer border border-white/20"
              title="Export file kalender .ICS universal"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Kalender</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenScanner()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-900/90 hover:bg-emerald-900 text-emerald-100 font-semibold rounded-xl text-xs transition-all cursor-pointer border border-emerald-700"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR</span>
            </button>
          </div>
        </div>

        {/* Tab Toggle: Daftar Kegiatan vs Kalender Kegiatan */}
        <div className="mt-5 pt-3 border-t border-emerald-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-emerald-950/40 rounded-xl border border-emerald-700/60">
            <button
              type="button"
              onClick={() => setActiveSubTab('daftar')}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'daftar'
                  ? 'bg-white text-[#0b5d34] shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Daftar Kegiatan ({activities.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('kalender')}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'kalender'
                  ? 'bg-white text-[#0b5d34] shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Kalender Kegiatan</span>
            </button>
          </div>

          {/* Quick Legend: 3 Jenis Kegiatan */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-100/80">
            <span className="font-semibold text-white/90">Jenis Kegiatan:</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 text-indigo-200 border border-indigo-700/60 font-semibold">
              Rapat Pengurus
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-900/80 text-emerald-200 border border-emerald-600/60 font-semibold">
              Pengajian Umum
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-900/60 text-amber-200 border border-amber-700/60 font-semibold">
              Arisan
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tab Views */}
      {activeSubTab === 'daftar' ? (
        <ActivityList
          activities={activities}
          onSelectActivity={(act) => setDetailActivityId(act.id)}
          onOpenScanner={onOpenScanner}
          onAddNew={() => setIsAdding(true)}
        />
      ) : (
        <ActivityCalendar
          activities={activities}
          onSelectActivity={(act) => setDetailActivityId(act.id)}
          onAddNew={() => setIsAdding(true)}
        />
      )}

      {/* MODALS */}
      {/* 1. Modal Tambah / Edit Kegiatan */}
      {(isAdding || editingActivity) && (
        <ActivityFormModal
          activity={editingActivity}
          allMembers={allMembers}
          onClose={() => {
            setIsAdding(false);
            setEditingActivity(null);
          }}
          onSave={handleSaveActivity}
        />
      )}

      {/* 2. Modal Detail Kegiatan (Daftar Hadir & Peserta) */}
      {selectedDetailActivity && (
        <ActivityDetailModal
          activity={selectedDetailActivity}
          allMembers={allMembers}
          onClose={() => setDetailActivityId(null)}
          onOpenScannerForActivity={(actId) => {
            setDetailActivityId(null);
            onOpenScanner(actId);
          }}
          onEditActivity={(act) => {
            setDetailActivityId(null);
            setEditingActivity(act);
          }}
          onDeleteActivity={(actId) => {
            onDeleteActivity(actId);
            setDetailActivityId(null);
          }}
          onManualCheckIn={onManualCheckIn}
        />
      )}
    </div>
  );
};
