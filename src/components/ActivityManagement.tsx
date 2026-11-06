import React, { useState, useEffect } from 'react';
import { Activity, Member, TempKegiatanSebelumSimpan } from '../types';
import { 
  Calendar as CalendarIcon, 
  ListFilter, 
  Plus, 
  Download, 
  QrCode, 
  Archive,
  RotateCcw,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
  CheckCircle2,
  Edit3,
  Globe,
  Clock
} from 'lucide-react';
import { ActivityList } from './ActivityList';
import { ActivityCalendar } from './ActivityCalendar';
import { ActivityFormModal } from './ActivityFormModal';
import { ActivityDetailModal } from './ActivityDetailModal';
import { downloadIcsFile } from '../utils/calendarExport';
import {
  subscribeTempKegiatanSebelumSimpanFirestore,
  deleteTempKegiatanSebelumSimpanFromFirestore
} from '../firebase';
import {
  getStoredTempKegiatanSebelumSimpan,
  syncDraftToTempKegiatanSebelumSimpan
} from '../utils/tempPreRegTracker';
import { getActivityTypeLabel, reconcileAuthoritativeActivities } from '../utils/storage';

interface ActivityManagementProps {
  activities: Activity[];
  tempKegiatanLama?: Activity[];
  allMembers: Member[];
  onAddNewActivity: (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>) => Promise<Activity | void> | void;
  onUpdateActivity: (updated: Activity) => Promise<Activity | void> | void;
  onDeleteActivity: (id: string) => Promise<void> | void;
  onRestoreDeletedActivity?: (deletedActivity: Activity) => Promise<void> | void;
  onSyncAllDevices?: () => Promise<void> | void;
  onOpenScanner: (activityId?: string) => void;
  onBackToMembers: () => void;
  onManualCheckIn?: (activityId: string, member: Member) => void;
}

export const ActivityManagement: React.FC<ActivityManagementProps> = ({
  activities,
  tempKegiatanLama = [],
  allMembers,
  onAddNewActivity,
  onUpdateActivity,
  onDeleteActivity,
  onRestoreDeletedActivity,
  onSyncAllDevices,
  onOpenScanner,
  onBackToMembers,
  onManualCheckIn,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'daftar' | 'kalender'>('daftar');
  const [isAdding, setIsAdding] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [resumingDraft, setResumingDraft] = useState<TempKegiatanSebelumSimpan | null>(null);
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);

  // Modals for Staging Drafts ('tempkegiatansebelumsimpan') & Deleted Archive ('tempkegiatanlama')
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false);
  const [activityDrafts, setActivityDrafts] = useState<TempKegiatanSebelumSimpan[]>(() => getStoredTempKegiatanSebelumSimpan());
  const [restoringActId, setRestoringActId] = useState<string | null>(null);
  const [isSyncingSchedules, setIsSyncingSchedules] = useState(false);
  const [syncBannerMsg, setSyncBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubDrafts = subscribeTempKegiatanSebelumSimpanFirestore((remoteDrafts) => {
      if (remoteDrafts) {
        setActivityDrafts(remoteDrafts);
      }
    });
    return () => unsubDrafts();
  }, []);

  const unsavedDraftsCount = activityDrafts.filter(d => d.statusDraft === 'sedang_mengisi').length;

  // Get freshest activity for detail modal
  const selectedDetailActivity = detailActivityId 
    ? activities.find(a => a.id === detailActivityId) || null 
    : null;

  const handleSaveActivity = async (
    data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>,
    draftIdToFinalize?: string
  ) => {
    if (editingActivity) {
      await onUpdateActivity({
        ...editingActivity,
        ...data,
      });
      setEditingActivity(null);
    } else {
      await onAddNewActivity(data);
      if (draftIdToFinalize) {
        try {
          await syncDraftToTempKegiatanSebelumSimpan(draftIdToFinalize, {
            ...data,
            statusDraft: 'selesai_simpan',
          });
        } catch {}
      }
      setIsAdding(false);
      setResumingDraft(null);
    }
  };

  const handleManualSyncDevices = async () => {
    if (isSyncingSchedules) return;
    setIsSyncingSchedules(true);
    setSyncBannerMsg(null);
    try {
      if (onSyncAllDevices) {
        await onSyncAllDevices();
      } else {
        await reconcileAuthoritativeActivities();
      }
      setSyncBannerMsg(`Sinkronisasi lintas perangkat berhasil! Seluruh ${activities.length} jadwal kegiatan kini identik di semua Laptop & HP.`);
      setTimeout(() => setSyncBannerMsg(null), 5000);
    } catch (err) {
      console.error('Failed to sync schedules:', err);
    } finally {
      setIsSyncingSchedules(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Navigation Header */}
      <div className="bg-[#0b5d34] text-white p-4 sm:p-6 rounded-3xl shadow-sm border-b-2 border-[#d4af37]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 text-[10px] font-bold border border-emerald-700/80">
                Manajemen Kegiatan Yayasan
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[10px] font-bold border border-amber-300/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Real-Time Sync Semua Device Aktif
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Jadwal &amp; Presensi Kegiatan
            </h1>
            <p className="text-xs text-emerald-100/90 mt-0.5 max-w-xl">
              Kelola jadwal Rapat Pengurus, Pengajian Umum, dan Arisan. Seluruh jadwal &amp; presensi QR tersinkronisasi otomatis ke koleksi Firestore <code className="text-amber-300">activities</code> di semua Laptop &amp; HP.
            </p>
          </div>

          {/* Sub-menu Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setResumingDraft(null);
                setIsAdding(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#d4af37] hover:bg-[#c59e2e] text-[#0b5d34] font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Kegiatan</span>
            </button>

            <button
              type="button"
              onClick={handleManualSyncDevices}
              disabled={isSyncingSchedules}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer border border-white/20"
              title="Sinkronkan & samakan seluruh jadwal kegiatan di semua Laptop dan HP"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSchedules ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
              <span>{isSyncingSchedules ? 'Menyinkronkan...' : 'Sinkronkan Semua Device'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDraftsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer border border-white/20"
              title="Lihat Agenda yang Belum Disimpan (Koleksi tempkegiatansebelumsimpan)"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span>Draft Belum Disimpan ({unsavedDraftsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeletedModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-900/70 hover:bg-amber-900 text-amber-100 font-semibold rounded-xl text-xs transition-all cursor-pointer border border-amber-500/40"
              title="Lihat & Pulihkan Agenda Kegiatan yang Terhapus (Koleksi tempkegiatanlama)"
            >
              <Archive className="w-3.5 h-3.5 text-amber-300" />
              <span>Agenda Terhapus ({tempKegiatanLama.length})</span>
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

        {syncBannerMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncBannerMsg}</span>
          </div>
        )}

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
          onAddNew={() => {
            setResumingDraft(null);
            setIsAdding(true);
          }}
        />
      ) : (
        <ActivityCalendar
          activities={activities}
          onSelectActivity={(act) => setDetailActivityId(act.id)}
          onAddNew={() => {
            setResumingDraft(null);
            setIsAdding(true);
          }}
        />
      )}

      {/* MODALS */}
      {/* 1. Modal Tambah / Edit / Lanjutkan Draft Kegiatan */}
      {(isAdding || editingActivity || resumingDraft) && (
        <ActivityFormModal
          activity={editingActivity}
          resumeDraft={resumingDraft}
          allMembers={allMembers}
          onClose={() => {
            setIsAdding(false);
            setEditingActivity(null);
            setResumingDraft(null);
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

      {/* 3. Modal Draft Agenda Belum Disimpan ('tempkegiatansebelumsimpan') */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-[#f8faf9] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#0b5d34] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                    Agenda Belum Tersimpan (Koleksi <code className="text-[#0b5d34]">tempkegiatansebelumsimpan</code>)
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Menampung sementara input pembuatan jadwal kegiatan setiap 5 detik agar tidak hilang bila browser tertutup
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {activityDrafts.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                  <Smartphone className="w-8 h-8 text-gray-400 mx-auto" />
                  <div className="text-xs font-semibold text-gray-700">Tidak Ada Draft Agenda yang Belum Disimpan</div>
                  <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                    Saat pengurus mulai mengetik jadwal kegiatan baru pada form Tambah Kegiatan, data otomatis dicadangkan setiap 5 detik di sini.
                  </p>
                </div>
              ) : (
                activityDrafts.map((draft) => (
                  <div
                    key={draft.idtempkegiatan}
                    className="p-3.5 rounded-2xl border border-gray-200 bg-white shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono text-[10px] font-bold">
                            {draft.idtempkegiatan}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            draft.statusDraft === 'selesai_simpan'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {draft.statusDraft === 'selesai_simpan' ? 'Sudah Disimpan' : 'Belum Tersimpan (Draft 5d)'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 mt-1">
                          {draft.judul || '(Judul kegiatan belum diisi)'}
                        </h4>
                        <div className="text-xs text-gray-600">
                          {draft.jenis ? getActivityTypeLabel(draft.jenis) : '-'} &bull; Tanggal: <strong>{draft.tanggal || '-'}</strong> ({draft.jamMulai || '-'} - {draft.jamSelesai || '-'})
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Globe className="w-3 h-3 text-emerald-600" />
                            {draft.ipLocation}
                          </span>
                          <span>&bull; {draft.browserType}</span>
                          <span>&bull; {draft.deviceVersion}</span>
                          <span>&bull; Peserta dipilih: {(draft.pesertaIds || []).length}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {draft.statusDraft === 'sedang_mengisi' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsDraftsModalOpen(false);
                              setResumingDraft(draft);
                            }}
                            className="px-3 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Lanjutkan &amp; Simpan</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteTempKegiatanSebelumSimpanFromFirestore(draft.idtempkegiatan);
                            setActivityDrafts(prev => prev.filter(p => p.idtempkegiatan !== draft.idtempkegiatan));
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus draft ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-600">
                Total draft di <code className="font-bold text-[#0b5d34]">tempkegiatansebelumsimpan</code>: {activityDrafts.length}
              </span>
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Arsip Agenda Kegiatan Terhapus ('tempkegiatanlama') */}
      {isDeletedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-[#f8faf9] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                    Arsip Agenda Kegiatan Terhapus (Koleksi <code className="text-[#0b5d34]">tempkegiatanlama</code>)
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Menampung agenda kegiatan beserta riwayat presensi yang pernah dihapus agar dapat dipulihkan kembali ke <code className="text-[#0b5d34]">activities</code> atas konfirmasi Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeletedModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {tempKegiatanLama.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                  <Archive className="w-8 h-8 text-gray-400 mx-auto" />
                  <div className="text-xs font-semibold text-gray-700">Koleksi tempkegiatanlama Kosong</div>
                  <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                    Belum ada jadwal kegiatan yang dihapus. Setiap jadwal yang dihapus otomatis diamankan di sini dan nomor ID-nya tidak akan pernah dipakai ulang.
                  </p>
                </div>
              ) : (
                tempKegiatanLama.map((act) => (
                  <div
                    key={act.id}
                    className="p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono text-[10px] font-bold">
                          ID: {act.id}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0b5d34] font-bold text-[10px]">
                          {getActivityTypeLabel(act.jenis)}
                        </span>
                        {act.deletedAt && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Dihapus: {new Date(act.deletedAt).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-gray-900">{act.judul}</div>
                      <div className="text-[11px] text-gray-600">
                        Tanggal: <strong>{act.tanggal}</strong> ({act.jamMulai} - {act.jamSelesai || 'Selesai'}) &bull; Lokasi: {act.lokasi || '-'}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Terdaftar: {(act.pesertaIds || []).length} peserta &bull; Hadir QR: {(act.kehadiran || []).length} orang
                      </div>
                    </div>

                    {onRestoreDeletedActivity && (
                      <button
                        type="button"
                        disabled={restoringActId === act.id}
                        onClick={async () => {
                          if (!window.confirm(`Konfirmasi Admin: Apakah Anda yakin ingin memulihkan kembali agenda "${act.judul}" (ID: ${act.id}) beserta seluruh data peserta & presensinya dari tempkegiatanlama ke daftar jadwal aktif di semua device?`)) {
                            return;
                          }
                          setRestoringActId(act.id);
                          try {
                            await onRestoreDeletedActivity(act);
                          } finally {
                            setRestoringActId(null);
                          }
                        }}
                        className="px-3.5 py-2 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringActId === act.id ? 'animate-spin' : ''}`} />
                        <span>{restoringActId === act.id ? 'Memulihkan...' : 'Pulihkan Agenda'}</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-600">
                Total agenda di <code className="font-bold text-[#0b5d34]">tempkegiatanlama</code>: {tempKegiatanLama.length} kegiatan
              </span>
              <button
                type="button"
                onClick={() => setIsDeletedModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
