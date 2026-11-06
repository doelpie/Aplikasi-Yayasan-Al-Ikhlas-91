import React, { useState, useEffect, useMemo } from 'react';
import {
  Member,
  Activity as ActivityItem,
  SystemLogEntry,
  SystemLogCategory,
  SystemLogLevel,
  BugDiagnosticResult,
  FlaggedMemberAnomaly,
  TempDataSebelumDaftar,
  TempKegiatanSebelumSimpan
} from '../types';
import {
  getStoredSystemLogs,
  syncSystemLogsWithFirestore,
  clearAllSystemLogs,
  runBugDiagnostics,
  runAutoRepairProcess,
  analyzeFlaggedMemberAnomalies,
  recordSystemLog
} from '../utils/systemLogger';
import {
  checkFirestoreConnectionStatus,
  subscribeSystemLogsFirestore,
  subscribeTempDataSebelumDaftarFirestore,
  deleteTempDataSebelumDaftarFromFirestore,
  subscribeTempKegiatanSebelumSimpanFirestore,
  deleteTempKegiatanSebelumSimpanFromFirestore
} from '../firebase';
import {
  getStoredTempDataSebelumDaftar,
  getStoredTempKegiatanSebelumSimpan
} from '../utils/tempPreRegTracker';
import { getPeranLabel, getActivityTypeLabel } from '../utils/storage';
import { FastMemberAvatar } from './FastMemberAvatar';
import {
  Wrench,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  Lock,
  Unlock,
  Search,
  Activity,
  Database,
  Cpu,
  FileText,
  ChevronDown,
  ChevronUp,
  Server,
  Edit3,
  RotateCcw,
  Camera,
  Smartphone,
  Globe,
  Clock,
  Archive,
  CalendarDays
} from 'lucide-react';

interface TechnicalITPanelProps {
  members: Member[];
  tempDataMenunggu?: Member[];
  tempDataLama: Member[];
  activities?: ActivityItem[];
  tempKegiatanLama?: ActivityItem[];
  onLockIT: () => void;
  onApprove?: (memberId: string) => Promise<void> | void;
  onReject?: (memberId: string, reason?: string) => Promise<void> | void;
  onEditMember?: (member: Member) => void;
  onDeleteMember?: (memberId: string) => void;
  onRestoreFromTempDataLama?: (deletedMember: Member) => Promise<void> | void;
  onRestoreActivityFromTempKegiatanLama?: (deletedActivity: ActivityItem) => Promise<void> | void;
  onActivitiesSynced?: (synced: ActivityItem[]) => void;
}

export const TechnicalITPanel: React.FC<TechnicalITPanelProps> = ({
  members,
  tempDataMenunggu = [],
  tempDataLama,
  activities = [],
  tempKegiatanLama = [],
  onLockIT,
  onApprove,
  onReject,
  onEditMember,
  onDeleteMember,
  onRestoreFromTempDataLama,
  onRestoreActivityFromTempKegiatanLama,
  onActivitiesSynced,
}) => {
  // Sub-tabs in Teknis IT: 'diagnostik' | 'logs' | 'database' | 'prereg'
  const [activeSubTab, setActiveSubTab] = useState<'diagnostik' | 'logs' | 'database' | 'prereg'>('diagnostik');

  // Logs state
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getStoredSystemLogs());
  const [isSyncingLogs, setIsSyncingLogs] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Baru Saja');
  const [logSearch, setLogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | SystemLogCategory>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | SystemLogLevel>('ALL');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Diagnostic Bug Check & Flagged Anomalies state
  const [diagnostics, setDiagnostics] = useState<BugDiagnosticResult[]>([]);
  const [flaggedAnomalies, setFlaggedAnomalies] = useState<FlaggedMemberAnomaly[]>([]);
  const [anomalyFilter, setAnomalyFilter] = useState<'semua' | 'dummy' | 'foto_profil' | 'foto_ktp' | 'foto_kk'>('semua');
  const [anomalySearch, setAnomalySearch] = useState('');
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticRanAt, setDiagnosticRanAt] = useState<string | null>(null);

  // Auto-Repair state
  const [isRunningAutoRepair, setIsRunningAutoRepair] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    success: boolean;
    message: string;
    repairedItems: string[];
  } | null>(null);

  // Pre-registration draft collection ('tempdatasebelumdaftar') & activity draft collection ('tempkegiatansebelumsimpan') state
  const [preRegDrafts, setPreRegDrafts] = useState<TempDataSebelumDaftar[]>(() => getStoredTempDataSebelumDaftar());
  const [activityDrafts, setActivityDrafts] = useState<TempKegiatanSebelumSimpan[]>(() => getStoredTempKegiatanSebelumSimpan());
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoringActId, setRestoringActId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Database Ping state
  const [pingStatus, setPingStatus] = useState<{ online: boolean; latencyMs: number; message: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Combined waiting members from tempdatamenunggu + members with status === 'menunggu'
  const waitingStagingList = useMemo(() => {
    const map = new Map<string, Member>();
    tempDataMenunggu.forEach(m => map.set(m.id, m));
    members.filter(m => m.status === 'menunggu').forEach(m => {
      if (!map.has(m.id)) map.set(m.id, m);
    });
    return Array.from(map.values());
  }, [tempDataMenunggu, members]);

  // Re-compute flagged anomalies whenever members or tempDataLama change
  useEffect(() => {
    setFlaggedAnomalies(analyzeFlaggedMemberAnomalies(members, tempDataLama));
  }, [members, tempDataLama]);

  // Real-time listeners for Firestore System Logs, tempdatasebelumdaftar, & tempkegiatansebelumsimpan
  useEffect(() => {
    const unsubscribeLogs = subscribeSystemLogsFirestore((remoteLogs) => {
      if (remoteLogs && remoteLogs.length > 0) {
        setLogs(prev => {
          const map = new Map<string, SystemLogEntry>();
          remoteLogs.forEach(l => map.set(l.id, l));
          prev.forEach(l => {
            if (!map.has(l.id)) map.set(l.id, l);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
        setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      }
    });

    const unsubscribePreReg = subscribeTempDataSebelumDaftarFirestore((remoteDrafts) => {
      if (remoteDrafts) {
        setPreRegDrafts(remoteDrafts);
      }
    });

    const unsubscribeActDrafts = subscribeTempKegiatanSebelumSimpanFirestore((remoteActDrafts) => {
      if (remoteActDrafts) {
        setActivityDrafts(remoteActDrafts);
      }
    });

    handleRunAutoRepair();

    return () => {
      unsubscribeLogs();
      unsubscribePreReg();
      unsubscribeActDrafts();
    };
  }, []);

  // Filtered Flagged Anomalies
  const filteredAnomalies = useMemo(() => {
    return flaggedAnomalies.filter(item => {
      if (anomalyFilter === 'dummy' && !item.isSystemDummyData) return false;
      if (anomalyFilter === 'foto_profil' && !item.hasMissingOrSystemProfilePhoto) return false;
      if (anomalyFilter === 'foto_ktp' && !item.hasMissingOrSystemKtp) return false;
      if (anomalyFilter === 'foto_kk' && !item.hasMissingOrSystemKk) return false;

      if (anomalySearch.trim()) {
        const q = anomalySearch.toLowerCase().trim();
        return (
          item.member.nama.toLowerCase().includes(q) ||
          item.member.id.toLowerCase().includes(q) ||
          (item.member.nik && item.member.nik.includes(q)) ||
          (item.member.noKk && item.member.noKk.includes(q))
        );
      }
      return true;
    });
  }, [flaggedAnomalies, anomalyFilter, anomalySearch]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedCategory !== 'ALL' && log.category !== selectedCategory) return false;
      if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesDetail = log.detail.toLowerCase().includes(q);
        const matchesSource = (log.source || '').toLowerCase().includes(q);
        const matchesId = log.id.toLowerCase().includes(q);
        return matchesTitle || matchesDetail || matchesSource || matchesId;
      }
      return true;
    });
  }, [logs, selectedCategory, selectedLevel, logSearch]);

  const errorCount = useMemo(() => logs.filter(l => l.level === 'ERROR').length, [logs]);
  const warnCount = useMemo(() => logs.filter(l => l.level === 'WARN').length, [logs]);

  // Handler: Jalankan Cek Bug
  const handleRunBugDiagnostics = async () => {
    if (isRunningDiagnostics) return;
    setIsRunningDiagnostics(true);
    try {
      const results = await runBugDiagnostics(members);
      setDiagnostics(results);
      setFlaggedAnomalies(analyzeFlaggedMemberAnomalies(members, tempDataLama));
      setDiagnosticRanAt(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error('Diagnostic error:', err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // Handler: Proses Debug & Perbaikan Otomatis (Tanpa Auto-Restore Tanpa Konfirmasi Admin)
  const handleRunAutoRepair = async () => {
    if (isRunningAutoRepair) return;
    setIsRunningAutoRepair(true);
    setRepairResult(null);
    try {
      const result = await runAutoRepairProcess(members, tempDataLama);
      if (result.syncedActivities && onActivitiesSynced) {
        onActivitiesSynced(result.syncedActivities);
      }
      setRepairResult({
        success: result.success,
        message: result.message,
        repairedItems: result.repairedItems,
      });
      setFlaggedAnomalies(result.flaggedAnomalies);
      const freshDiags = await runBugDiagnostics(members);
      setDiagnostics(freshDiags);
    } catch (err: any) {
      setRepairResult({
        success: false,
        message: err?.message || 'Gagal menjalankan proses debug.',
        repairedItems: [],
      });
    } finally {
      setIsRunningAutoRepair(false);
    }
  };

  // Handler: Sinkronkan Log
  const handleSyncLogs = async () => {
    if (isSyncingLogs) return;
    setIsSyncingLogs(true);
    try {
      const synced = await syncSystemLogsWithFirestore();
      setLogs(synced);
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      await recordSystemLog({
        category: 'DATABASE',
        level: 'INFO',
        title: 'Sinkronisasi Log Teknis (IT) Berhasil',
        detail: `Berhasil mensinkronkan ${synced.length} rekaman log dengan Firestore server.`,
        source: 'TechnicalITPanel',
      });
    } catch (err) {
      console.warn('Sync logs note:', err);
    } finally {
      setIsSyncingLogs(false);
    }
  };

  // Handler: Ping Server
  const handlePingFirestore = async () => {
    setIsPinging(true);
    try {
      const res = await checkFirestoreConnectionStatus();
      setPingStatus(res);
      await recordSystemLog({
        category: 'DATABASE',
        level: res.online ? 'SUCCESS' : 'WARN',
        title: 'Uji Ping Koneksi Firestore Dilakukan',
        detail: res.message,
        source: 'TechnicalITPanel',
      });
    } finally {
      setIsPinging(false);
    }
  };

  // Handler: Unduh File Log JSON
  const handleDownloadLogsJson = () => {
    try {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `YayasanAlIkhlas_SystemLogs_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export logs:', err);
    }
  };

  // Handler: Bersihkan Log
  const handleClearLogs = async () => {
    if (window.confirm('Apakah Anda yakin ingin mengosongkan seluruh riwayat log sistem dan log database?')) {
      await clearAllSystemLogs();
      setLogs([]);
      await recordSystemLog({
        category: 'ADMIN_ACTION',
        level: 'INFO',
        title: 'Riwayat Log Dibersihkan oleh Staf IT',
        detail: 'Log sistem dan database telah dibersihkan untuk sesi baru.',
        source: 'TechnicalITPanel',
      });
    }
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Banner: IT Access Control & Verification Status */}
      <div className="bg-gradient-to-r from-stone-900 via-[#0a3821] to-stone-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-emerald-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-wider uppercase">
                  KONSOL TEKNIS &amp; DEBUG (IT)
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  <Unlock className="w-3 h-3 text-emerald-400" />
                  Akses Terverifikasi (@Teguh9495)
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                Audit keunikan seluruh ID &amp; NIK, deteksi foto profil/KTP/KK kosong atau hasil generate sistem/dummy AI, pemantauan draft real-time 5 detik (<code className="text-amber-300">tempdatasebelumdaftar</code>), serta log sistem otomatis.
              </p>
            </div>
          </div>

          {/* Quick Action: Sync & Lock IT */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleSyncLogs}
              disabled={isSyncingLogs}
              className="px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all border border-emerald-500/40 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              title="Sinkronkan log dengan Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLogs ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
              <span>{isSyncingLogs ? 'Menyinkronkan...' : 'Sinkronkan Log'}</span>
            </button>

            <button
              type="button"
              onClick={onLockIT}
              className="px-3 py-2 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 text-xs font-bold rounded-xl transition-all border border-rose-500/30 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              title="Kunci kembali halaman teknis IT"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci IT</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Stat Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Temuan Data / Foto</div>
            <div className={`text-xl font-black mt-0.5 ${flaggedAnomalies.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {flaggedAnomalies.length}
            </div>
            <div className="text-[10px] text-stone-300 mt-0.5">Tanpa foto asli / Dummy sistem</div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Draft Sedang Mengisi</div>
            <div className="text-xl font-black text-emerald-300 mt-0.5">
              {preRegDrafts.length}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Koleksi tempdatasebelumdaftar</div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Arsip Terhapus</div>
            <div className="text-xl font-black text-white mt-0.5">
              {tempDataLama.length}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">Koleksi tempdatalama (Field Lengkap)</div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Total Log Tersinkron</div>
            <div className="text-xl font-black text-white mt-0.5">{logs.length}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Update: {lastSyncTime}</div>
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex gap-2 bg-white rounded-2xl p-1.5 border border-gray-200/80 shadow-xs overflow-x-auto scrollbar-none text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveSubTab('diagnostik')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'diagnostik'
              ? 'bg-[#0b5d34] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Cek Bug, Audit Foto &amp; Dummy ({flaggedAnomalies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('prereg')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'prereg'
              ? 'bg-[#0b5d34] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Draft Sebelum Daftar ({preRegDrafts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logs')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'logs'
              ? 'bg-[#0b5d34] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Catatan Aktivitas &amp; Log Sistem ({logs.length})</span>
          {errorCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full">
              {errorCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('database')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'database'
              ? 'bg-[#0b5d34] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Status Database &amp; Arsip Terhapus</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PENGECEKAN BUG, AUDIT FOTO (PROFIL/KTP/KK) & DATA DUMMY SISTEM */}
      {/* ========================================================================= */}
      {activeSubTab === 'diagnostik' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Action Bar: Tombol Cek Bug & Tombol Proses Debug */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#0b5d34]" />
                <span>Pengecekan Bug, Keunikan Seluruh ID, &amp; Audit Foto / Data Sistem</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {diagnosticRanAt
                  ? `Pemeriksaan terakhir dijalankan pada ${diagnosticRanAt} • Pemulihan otomatis dinonaktifkan (wajib konfirmasi Admin).`
                  : 'Memeriksa keunikan seluruh ID anggota, mendeteksi foto profil/KTP/KK yang kosong atau generate sistem, serta data dummy AI.'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRunBugDiagnostics}
                disabled={isRunningDiagnostics}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                <span>{isRunningDiagnostics ? 'Memeriksa Bug...' : 'Cek Bug Sekarang'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunAutoRepair}
                disabled={isRunningAutoRepair}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Wrench className={`w-4 h-4 ${isRunningAutoRepair ? 'animate-spin' : ''}`} />
                <span>{isRunningAutoRepair ? 'Memproses Debug...' : 'Proses Debug & Auto-Repair'}</span>
              </button>
            </div>
          </div>

          {/* Banner Hasil Auto-Repair */}
          {repairResult && (
            <div className={`p-4 rounded-2xl border text-xs shadow-xs animate-in fade-in ${
              repairResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {repairResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                <span>{repairResult.message}</span>
              </div>
              {repairResult.repairedItems.length > 0 && (
                <div className="mt-2 pl-7 space-y-1">
                  <div className="font-semibold text-xs text-gray-700">Rincian pemeriksaan &amp; tindakan sistem:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-700">
                    {repairResult.repairedItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Check Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {diagnostics.map((diag) => {
              const isPass = diag.status === 'PASS';
              const isWarn = diag.status === 'WARN';
              const isFail = diag.status === 'FAIL';

              const borderClass = isPass
                ? 'border-emerald-200 bg-emerald-50/20'
                : isWarn
                ? 'border-amber-200 bg-amber-50/20'
                : 'border-rose-200 bg-rose-50/20';

              return (
                <div
                  key={diag.id}
                  className={`bg-white rounded-2xl p-4 border ${borderClass} shadow-2xs space-y-2.5 flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {isWarn && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                        {isFail && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span className="font-bold text-xs text-gray-900">{diag.name}</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isPass ? 'bg-emerald-100 text-emerald-800' :
                        isWarn ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {diag.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                      {diag.message}
                    </p>

                    {diag.details && diag.details.length > 0 && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-xl text-[11px] text-gray-600 space-y-0.5">
                        {diag.details.map((d, dIdx) => (
                          <div key={dIdx} className="flex items-start gap-1.5">
                            <span className="text-gray-400 mt-0.5">&bull;</span>
                            <span className="break-all">{d}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-mono">Kategori: {diag.category}</span>
                    {diag.latencyMs !== undefined && (
                      <span className="font-mono">{diag.latencyMs}ms</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===================================================================== */}
          {/* DAFTAR TEMUAN DATA TANPA FOTO ASLI / FOTO GENERATE SISTEM / DUMMY AI */}
          {/* DENGAN PILIHAN ADMIN: PERBAIKI / EDIT DATA ATAU HAPUS DATA */}
          {/* ===================================================================== */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border-2 border-amber-300/80 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Camera className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900">
                    Hasil Deteksi: Data Tanpa Foto (Profil/KTP/KK), Foto Sistem, &amp; Data Dummy AI ({flaggedAnomalies.length})
                  </h3>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Menampilkan anggota yang belum mengunggah Foto Profil / KTP / KK asli, memakai foto generate sistem, atau merupakan data dummy bawaan. Admin dapat langsung memilih <strong>Perbaiki / Edit Data</strong> atau <strong>Hapus Data</strong>.
                </p>
              </div>
            </div>

            {/* Filter & Search Bar for Flagged Anomalies */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {([
                  { id: 'semua', label: `Semua Temuan (${flaggedAnomalies.length})` },
                  { id: 'dummy', label: `Data Dummy / Sistem (${flaggedAnomalies.filter(a => a.isSystemDummyData).length})` },
                  { id: 'foto_profil', label: `Foto Profil Sistem/Kosong (${flaggedAnomalies.filter(a => a.hasMissingOrSystemProfilePhoto).length})` },
                  { id: 'foto_ktp', label: `Tanpa Foto KTP (${flaggedAnomalies.filter(a => a.hasMissingOrSystemKtp).length})` },
                  { id: 'foto_kk', label: `Tanpa Foto KK (${flaggedAnomalies.filter(a => a.hasMissingOrSystemKk).length})` },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAnomalyFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                      anomalyFilter === tab.id
                        ? 'bg-[#0b5d34] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={anomalySearch}
                  onChange={(e) => setAnomalySearch(e.target.value)}
                  placeholder="Cari nama / ID / NIK..."
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]"
                />
              </div>
            </div>

            {/* List of Flagged Members */}
            {filteredAnomalies.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-1.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-emerald-950">Tidak Ada Data Bermasalah pada Kategori Ini</div>
                <p className="text-xs text-emerald-800">
                  Seluruh data anggota pada filter ini sudah memiliki foto dan dokumen lengkap.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                {filteredAnomalies.map((item) => {
                  const m = item.member;
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/20 hover:bg-white transition-all shadow-2xs flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <FastMemberAvatar
                          src={m.fotoUrl}
                          name={m.nama}
                          className="w-12 h-16 rounded-xl"
                          initialsClassName="text-sm"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono text-[10px] font-bold">
                              ID: {m.id}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[#0b5d34] text-[10px] font-bold">
                              {getPeranLabel(m.peranKeluarga)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              m.status === 'disetujui' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                              m.status === 'menunggu' ? 'bg-amber-100 text-amber-900' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {m.status}
                            </span>
                            {item.isSystemDummyData && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-extrabold">
                                DATA DUMMY / SISTEM AI
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-gray-900 mt-1 truncate">
                            {m.nama}
                          </h4>
                          <div className="text-[11px] font-mono text-gray-600">
                            NIK: {m.nik} &bull; KK: {m.noKk}
                          </div>

                          {/* Checklist Status Foto Profil, KTP, KK */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              item.hasMissingOrSystemProfilePhoto
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              Foto Profil: {!m.fotoUrl ? 'Kosong' : item.hasMissingOrSystemProfilePhoto ? 'Generate Sistem' : 'Asli User'}
                            </span>

                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              item.hasMissingOrSystemKtp
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              Foto KTP: {!m.ktpUrl ? 'Kosong' : item.hasMissingOrSystemKtp ? 'Sampel Sistem' : 'Asli User'}
                            </span>

                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              item.hasMissingOrSystemKk
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              Foto KK: {!m.kkUrl ? 'Kosong' : item.hasMissingOrSystemKk ? 'Sampel Sistem' : 'Asli User'}
                            </span>
                          </div>

                          {/* Issues Breakdown */}
                          <ul className="mt-2 space-y-0.5 text-[11px] text-amber-900">
                            {item.issues.map((iss, iIdx) => (
                              <li key={iIdx} className="flex items-start gap-1">
                                <span className="text-amber-600 font-bold">&bull;</span>
                                <span>{iss}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Admin Choice Buttons: Perbaiki / Edit Data OR Hapus Data */}
                      <div className="pt-2.5 border-t border-amber-200/60 flex items-center justify-end gap-2">
                        {onEditMember && (
                          <button
                            type="button"
                            onClick={() => onEditMember(m)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            title="Perbaiki data anggota atau unggah Foto Profil, KTP, dan KK asli"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Perbaiki / Edit Data</span>
                          </button>
                        )}

                        {onDeleteMember && (
                          <button
                            type="button"
                            onClick={() => onDeleteMember(m.id)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            title="Hapus data anggota ini (akan dipindahkan ke arsip tempdatalama)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Data</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KOLEKSI 'tempdatasebelumdaftar' (AUTO-SYNC 5 DETIK SAAT MENGETIK) */}
      {/* ========================================================================= */}
      {activeSubTab === 'prereg' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#0b5d34] flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    Koleksi <code className="text-[#0b5d34]">tempdatasebelumdaftar</code> (Auto-Sync Interval 5 Detik)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Menyimpan sementara input formulir pendaftaran secara real-time saat calon anggota/admin mulai mengetik No. KK, KTP, atau Nama. Dijamin unik berdasarkan IP Location, Browser, Versi HP, dan IMEI Perangkat.
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#0b5d34] text-xs font-bold">
                Total Draft: {preRegDrafts.length}
              </span>
            </div>
          </div>

          {preRegDrafts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-gray-200 space-y-2">
              <Smartphone className="w-10 h-10 text-gray-300 mx-auto" />
              <div className="text-sm font-bold text-gray-700">Belum Ada Aktivitas Pengetikan Pendaftaran Baru</div>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Begitu calon anggota atau admin mulai mengetik Nomor KK, KTP, atau Nama pada menu Daftar, data sementara akan otomatis muncul dan tersinkron setiap 5 detik di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {preRegDrafts.map((draft) => (
                <div
                  key={draft.idtempdata}
                  className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap border-b border-gray-100 pb-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono text-[10px] font-bold">
                          idtempdata: {draft.idtempdata}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          draft.statusDraft === 'selesai_daftar'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        }`}>
                          {draft.statusDraft === 'selesai_daftar' ? `Selesai Daftar (ID: ${draft.finalMemberId || '-'})` : 'Sedang Mengisi Form (Sync 5d)'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-semibold">
                          Sumber: {draft.sourceForm === 'halaman_admin' ? 'Form Admin' : 'Form Daftar Publik'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 font-mono pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3 text-emerald-600" />
                          IP/Loc: <strong>{draft.ipLocation}</strong>
                        </span>
                        <span>Browser: <strong>{draft.browserType}</strong></span>
                        <span>HP/OS: <strong>{draft.deviceVersion}</strong></span>
                        <span>IMEI/Device: <strong>{draft.deviceImei}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(draft.updatedAt).toLocaleTimeString('id-ID')}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Hapus draft sementara ${draft.idtempdata}?`)) {
                            await deleteTempDataSebelumDaftarFromFirestore(draft.idtempdata);
                            setPreRegDrafts(prev => prev.filter(p => p.idtempdata !== draft.idtempdata));
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus draft sementara ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* All Registration Fields in tempdatasebelumdaftar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-gray-50 p-3 rounded-xl">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Nama &amp; Peran</span>
                      <span className="font-bold text-gray-900">{draft.nama || '(Belum diisi)'}</span>
                      <span className="block text-[11px] text-emerald-800 font-semibold">
                        {draft.peranKeluarga ? getPeranLabel(draft.peranKeluarga) : '-'}
                        {draft.namaKepalaKeluarga ? ` (KK: ${draft.namaKepalaKeluarga})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Nomor KTP (NIK) &amp; No. KK</span>
                      <span className="font-mono text-gray-800 block">NIK: {draft.nik || '-'}</span>
                      <span className="font-mono text-gray-800 block">KK: {draft.noKk || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Kontak &amp; Alamat</span>
                      <span className="text-gray-800 block">HP: {draft.noHp || '-'} | Email: {draft.email || '-'}</span>
                      <span className="text-gray-600 text-[11px] line-clamp-1">{draft.alamat || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATATAN SELURUH AKTIVITAS & LOG SISTEM / DATABASE */}
      {/* ========================================================================= */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Cari kata kunci, ID error, atau nama aktivitas..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSyncLogs}
                  disabled={isSyncingLogs}
                  className="px-3.5 py-2.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLogs ? 'animate-spin' : ''}`} />
                  <span>{isSyncingLogs ? 'Menyinkronkan...' : 'Sinkronkan Log'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLogsJson}
                  className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unduh JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all border border-rose-200 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
              <span className="text-gray-400 font-semibold text-[11px] mr-1">Filter Kategori:</span>
              {(['ALL', 'DATABASE', 'AUTH_SECURITY', 'PENDAFTARAN', 'ADMIN_ACTION', 'PRESENSI', 'SISTEM_ERROR'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#0b5d34] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <span className="text-gray-400 font-semibold text-[11px] ml-2 mr-1">Level:</span>
              {(['ALL', 'ERROR', 'WARN', 'INFO', 'SUCCESS'] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                    selectedLevel === lvl
                      ? 'bg-stone-800 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-gray-200 space-y-1.5">
                <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                <div className="text-sm font-bold text-gray-700">Tidak Ada Log Sesuai Filter</div>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogIds.has(log.id);
                const badgeBg =
                  log.level === 'ERROR' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                  log.level === 'WARN' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  log.level === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  'bg-blue-100 text-blue-800 border-blue-300';

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl p-3.5 sm:p-4 border border-gray-200/80 shadow-2xs hover:border-gray-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase font-mono ${badgeBg}`}>
                          {log.level}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200 uppercase font-mono">
                          {log.category}
                        </span>
                        {log.source && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            [{log.source}]
                          </span>
                        )}
                        <h4 className="font-bold text-xs text-gray-900 leading-snug">
                          {log.title}
                        </h4>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpandLog(log.id)}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className={`text-xs text-gray-700 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {log.detail}
                    </div>

                    {isExpanded && log.data && (
                      <div className="pt-2 border-t border-gray-100">
                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Payload / Debug Metadata:</div>
                        <pre className="p-2.5 bg-gray-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STATUS DATABASE FIRESTORE & PEMULIHAN MANUAL ARSIP 'tempdatalama' */}
      {/* ========================================================================= */}
      {activeSubTab === 'database' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Ping Live Server Card */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Server className="w-5 h-5 text-[#0b5d34]" />
                  <span>Uji Latensi &amp; Konektivitas Langsung Firestore</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Memeriksa rute endpoint Firestore server melalui getDocFromServer pada dokumen connection ping.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePingFirestore}
                disabled={isPinging}
                className="px-4 py-2.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Memeriksa Latensi...' : 'Ping Server Firestore'}</span>
              </button>
            </div>

            {pingStatus && (
              <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                pingStatus.online ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  {pingStatus.online ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                  <span className="font-bold">{pingStatus.message}</span>
                </div>
                <span className="font-mono text-[11px] font-bold bg-white/70 px-2.5 py-1 rounded-lg">
                  {pingStatus.latencyMs}ms
                </span>
              </div>
            )}
          </div>

          {/* Database Collections Overview: 1 Official + 3 Staging Collections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Koleksi members</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[#0b5d34] text-[10px] font-mono font-bold">
                  Resmi Disetujui
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">
                {members.filter(m => m.status === 'disetujui').length}
              </div>
              <p className="text-[11px] text-gray-500">
                Data anggota resmi yang tampil di Daftar Anggota publik. Dijamin tidak tertimpa data lama/dummy.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">tempdatasebelumdaftar</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                  Sync 5 Detik
                </span>
              </div>
              <div className="text-2xl font-black text-[#0b5d34]">{preRegDrafts.length}</div>
              <p className="text-[11px] text-gray-500">
                Tempat tampung sementara yang sedang mengisi form daftar (unik per IP, Browser, HP, IMEI).
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">tempdatamenunggu</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                  Menunggu ACC
                </span>
              </div>
              <div className="text-2xl font-black text-amber-700">{waitingStagingList.length}</div>
              <p className="text-[11px] text-gray-500">
                Tempat tampung sementara pendaftar baru yang menunggu persetujuan Admin sebelum masuk ke publik.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">tempdatalama</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                  Arsip Terhapus
                </span>
              </div>
              <div className="text-2xl font-black text-rose-700">{tempDataLama.length}</div>
              <p className="text-[11px] text-gray-500">
                Tempat tampung data yang dihapus (seluruh 22 field lengkap). Hanya dipulihkan manual oleh Admin.
              </p>
            </div>
          </div>

          {/* Daftar Tempat Tampung Sementara Menunggu Persetujuan Admin ('tempdatamenunggu') */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-amber-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Tempat Tampung Sementara Menunggu Persetujuan Admin (<code className="text-amber-700">tempdatamenunggu</code>)
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Menjaga data calon anggota yang baru klik Daftar agar aman, tidak hilang, dan tidak bocor ke halaman Daftar Anggota publik sebelum disetujui Admin.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                Menunggu: {waitingStagingList.length}
              </span>
            </div>

            {waitingStagingList.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-2xl text-xs text-gray-500">
                Saat ini tidak ada antrean pendaftar baru di koleksi <code className="font-bold">tempdatamenunggu</code>.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {waitingStagingList.map(item => (
                  <div
                    key={'waiting_' + item.id}
                    className="p-3 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FastMemberAvatar
                        src={item.fotoUrl}
                        name={item.nama}
                        className="w-10 h-12 rounded-xl"
                        initialsClassName="text-xs"
                      />
                      <div className="min-w-0 text-xs">
                        <div className="font-bold text-gray-900 truncate">
                          {item.nama} <span className="font-mono text-amber-800">(ID: {item.id})</span>
                        </div>
                        <div className="text-[11px] text-gray-600 font-mono">
                          NIK: {item.nik} &bull; KK: {item.noKk} &bull; {getPeranLabel(item.peranKeluarga)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          TTL: {item.tempatTanggalLahir || '-'} &bull; HP: {item.noHp} &bull; Daftar: {item.tanggalDaftar}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onApprove && (
                        <button
                          type="button"
                          disabled={approvingId === item.id}
                          onClick={async () => {
                            setApprovingId(item.id);
                            try {
                              await onApprove(item.id);
                            } finally {
                              setApprovingId(null);
                            }
                          }}
                          className="px-3 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{approvingId === item.id ? 'Menyetujui...' : 'Setujui'}</span>
                        </button>
                      )}
                      {onEditMember && (
                        <button
                          type="button"
                          onClick={() => onEditMember(item)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      {onDeleteMember && (
                        <button
                          type="button"
                          onClick={() => onDeleteMember(item.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daftar Arsip Agenda Kegiatan Terhapus ('tempkegiatanlama') - Pemulihan Manual dengan Konfirmasi Admin */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-emerald-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#0b5d34]" />
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Tempat Tampung Agenda Kegiatan Terhapus (<code className="text-[#0b5d34]">tempkegiatanlama</code>) &amp; Draft Kegiatan (<code className="text-[#0b5d34]">tempkegiatansebelumsimpan</code>)
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Menjamin seluruh jadwal kegiatan ({activities.length} jadwal aktif, {activityDrafts.length} draft kegiatan, {tempKegiatanLama.length} agenda terhapus) tersinkronisasi sama di semua perangkat (Laptop &amp; HP).
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#0b5d34] text-xs font-bold">
                Jadwal Aktif: {activities.length} | Terhapus: {tempKegiatanLama.length}
              </span>
            </div>

            {tempKegiatanLama.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-2xl text-xs text-gray-500">
                Belum ada agenda kegiatan yang dihapus di koleksi <code className="font-bold">tempkegiatanlama</code>.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {tempKegiatanLama.map(act => (
                  <div
                    key={'del_act_' + act.id}
                    className="p-3 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 text-xs space-y-0.5">
                      <div className="font-bold text-gray-900">
                        {act.judul} <span className="font-mono text-amber-800">(ID: {act.id})</span>
                      </div>
                      <div className="text-[11px] text-gray-600">
                        Jenis: {getActivityTypeLabel(act.jenis)} &bull; Tanggal: <strong>{act.tanggal}</strong> ({act.jamMulai} - {act.jamSelesai || 'Selesai'})
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Peserta: {(act.pesertaIds || []).length} anggota &bull; Presensi Hadir: {(act.kehadiran || []).length} orang
                      </div>
                    </div>

                    {onRestoreActivityFromTempKegiatanLama && (
                      <button
                        type="button"
                        disabled={restoringActId === act.id}
                        onClick={async () => {
                          if (window.confirm(`Konfirmasi Admin: Pulihkan agenda kegiatan "${act.judul}" (ID: ${act.id}) dari tempkegiatanlama kembali ke daftar jadwal aktif di semua device?`)) {
                            setRestoringActId(act.id);
                            try {
                              await onRestoreActivityFromTempKegiatanLama(act);
                            } finally {
                              setRestoringActId(null);
                            }
                          }
                        }}
                        className="px-3.5 py-2 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringActId === act.id ? 'animate-spin' : ''}`} />
                        <span>{restoringActId === act.id ? 'Memulihkan...' : 'Pulihkan Agenda'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daftar Arsip Data Terhapus ('tempdatalama') - Pemulihan Manual dengan Konfirmasi Admin */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-amber-700" />
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Tempat Tampung Data Terhapus (<code className="text-[#0b5d34]">tempdatalama</code>) — Pemulihan Manual dengan Konfirmasi Admin
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Seluruh field anggota (termasuk Foto Profil, KTP, KK, Email, TTL, Alamat, dan Relasi Keluarga) tersimpan lengkap.
                  </p>
                </div>
              </div>
            </div>

            {tempDataLama.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-2xl text-xs text-gray-500">
                Belum ada data anggota yang dihapus di koleksi <code className="font-bold">tempdatalama</code>.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tempDataLama.map(item => (
                  <div
                    key={item.id + '_' + item.nik}
                    className="p-3 rounded-2xl border border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FastMemberAvatar
                        src={item.fotoUrl}
                        name={item.nama}
                        className="w-10 h-12 rounded-xl"
                        initialsClassName="text-xs"
                      />
                      <div className="min-w-0 text-xs">
                        <div className="font-bold text-gray-900 truncate">
                          {item.nama} <span className="font-mono text-gray-500">(ID: {item.id})</span>
                        </div>
                        <div className="text-[11px] text-gray-600 font-mono">
                          NIK: {item.nik} &bull; KK: {item.noKk} &bull; {getPeranLabel(item.peranKeluarga)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          TTL: {item.tempatTanggalLahir || '-'} &bull; HP: {item.noHp} &bull; Email: {item.email || '-'}
                        </div>
                      </div>
                    </div>

                    {onRestoreFromTempDataLama && (
                      <button
                        type="button"
                        disabled={restoringId === item.id}
                        onClick={async () => {
                          if (window.confirm(`Konfirmasi Admin: Apakah Anda yakin ingin memulihkan seluruh data "${item.nama}" (ID: ${item.id}) dari tempdatalama kembali ke daftar anggota aktif?`)) {
                            setRestoringId(item.id);
                            try {
                              await onRestoreFromTempDataLama(item);
                            } finally {
                              setRestoringId(null);
                            }
                          }
                        }}
                        className="px-3.5 py-2 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringId === item.id ? 'animate-spin' : ''}`} />
                        <span>{restoringId === item.id ? 'Memulihkan...' : 'Pulihkan Data'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
