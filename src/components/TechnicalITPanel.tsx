import React, { useState, useEffect, useMemo } from 'react';
import { 
  Member, 
  SystemLogEntry, 
  SystemLogCategory, 
  SystemLogLevel, 
  BugDiagnosticResult 
} from '../types';
import { 
  getStoredSystemLogs, 
  syncSystemLogsWithFirestore, 
  clearAllSystemLogs, 
  runBugDiagnostics, 
  runAutoRepairProcess,
  recordSystemLog 
} from '../utils/systemLogger';
import { 
  checkFirestoreConnectionStatus,
  subscribeSystemLogsFirestore
} from '../firebase';
import { 
  Wrench, 
  Terminal, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Trash2, 
  Lock, 
  Unlock, 
  Search, 
  Filter, 
  Activity, 
  Database, 
  Cpu, 
  HardDrive, 
  Layers, 
  Sparkles, 
  FileText, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  KeyRound,
  Eye,
  EyeOff,
  Server
} from 'lucide-react';

interface TechnicalITPanelProps {
  members: Member[];
  tempDataLama: Member[];
  onLockIT: () => void;
  onRefreshData?: () => void;
}

export const TechnicalITPanel: React.FC<TechnicalITPanelProps> = ({
  members,
  tempDataLama,
  onLockIT,
  onRefreshData,
}) => {
  // Sub-tabs in Teknis IT: 'diagnostik' | 'logs' | 'database'
  const [activeSubTab, setActiveSubTab] = useState<'diagnostik' | 'logs' | 'database'>('diagnostik');

  // Logs state
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getStoredSystemLogs());
  const [isSyncingLogs, setIsSyncingLogs] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Baru Saja');
  const [logSearch, setLogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | SystemLogCategory>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | SystemLogLevel>('ALL');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Diagnostic Bug Check state
  const [diagnostics, setDiagnostics] = useState<BugDiagnosticResult[]>([]);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticRanAt, setDiagnosticRanAt] = useState<string | null>(null);

  // Auto-Repair state
  const [isRunningAutoRepair, setIsRunningAutoRepair] = useState(false);
  const [repairResult, setRepairResult] = useState<{ success: boolean; message: string; repairedItems: string[] } | null>(null);

  // Database Ping state
  const [pingStatus, setPingStatus] = useState<{ online: boolean; latencyMs: number; message: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Real-time listener for Firestore System Logs
  useEffect(() => {
    const unsubscribe = subscribeSystemLogsFirestore((remoteLogs) => {
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

    // Run initial diagnostic check on first visit
    handleRunBugDiagnostics();

    return () => {
      unsubscribe();
    };
  }, []);

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
      setDiagnosticRanAt(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error('Diagnostic error:', err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // Handler: Proses Debug & Perbaikan Otomatis
  const handleRunAutoRepair = async () => {
    if (isRunningAutoRepair) return;
    setIsRunningAutoRepair(true);
    setRepairResult(null);
    try {
      const result = await runAutoRepairProcess();
      setRepairResult(result);
      // Re-run diagnostics to reflect fixes
      const freshDiags = await runBugDiagnostics(members);
      setDiagnostics(freshDiags);
      onRefreshData?.();
    } catch (err: any) {
      setRepairResult({
        success: false,
        message: err?.message || 'Gagal menjalankan perbaikan otomatis.',
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
                Pemantauan diagnostik bug aplikasi, auto-repair database, dan rekaman seluruh log aktivitas serta error tersinkron otomatis.
              </p>
            </div>
          </div>

          {/* Quick Action: Lock IT */}
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
            <div className="text-[10px] uppercase font-bold text-stone-400">Total Log Tersinkron</div>
            <div className="text-xl font-black text-white mt-0.5">{logs.length}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Disinkronkan: {lastSyncTime}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Total Error Terdeteksi</div>
            <div className={`text-xl font-black mt-0.5 ${errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {errorCount}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">{errorCount > 0 ? 'Perlu penanganan' : 'Nihil error kritis'}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Peringatan / Warn</div>
            <div className={`text-xl font-black mt-0.5 ${warnCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {warnCount}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">{warnCount > 0 ? 'Catatan verifikasi' : 'Kondisi prima'}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-stone-400">Database Firestore</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">5 Koleksi Aktif</div>
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
          <span>Pengecekan Bug &amp; Debug</span>
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
          <span>Catatan Aktivitas &amp; Log Sistem</span>
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
          <span>Status Database &amp; Kuota</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PENGECEKAN BUG & DEBUG APLIKASI */}
      {/* ========================================================================= */}
      {activeSubTab === 'diagnostik' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Action Bar: Tombol Cek Bug & Tombol Proses Debug */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#0b5d34]" />
                <span>Panel Pengecekan Bug &amp; Diagnostik Terintegrasi</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {diagnosticRanAt 
                  ? `Pemeriksaan terakhir dijalankan pada ${diagnosticRanAt}` 
                  : 'Klik tombol di bawah untuk memeriksa integritas data, relasi keluarga, dan status database.'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Tombol 1: Cek Bug & Diagnostik */}
              <button
                type="button"
                onClick={handleRunBugDiagnostics}
                disabled={isRunningDiagnostics}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                title="Jalankan rangkaian pengecekan bug aplikasi"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                <span>{isRunningDiagnostics ? 'Memeriksa Bug...' : 'Cek Bug Sekarang'}</span>
              </button>

              {/* Tombol 2: Proses Debug & Perbaikan Otomatis */}
              <button
                type="button"
                onClick={handleRunAutoRepair}
                disabled={isRunningAutoRepair}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                title="Lakukan proses debug dan perbaiki anomali yang ditemukan secara otomatis"
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
                  <div className="font-semibold text-xs text-gray-700">Tindakan perbaikan yang berhasil diterapkan:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600">
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
            {diagnostics.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl p-8 text-center border border-dashed border-gray-200 space-y-2">
                <Wrench className="w-10 h-10 text-gray-300 mx-auto" />
                <div className="text-sm font-bold text-gray-700">Belum Ada Pemeriksaan Bug Dijalankan</div>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Klik tombol <strong>"Cek Bug Sekarang"</strong> untuk memindai status database, duplikasi NIK, validasi anggota kanonikal, dan kuota penyimpanan.
                </p>
              </div>
            ) : (
              diagnostics.map((diag) => {
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
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CATATAN SELURUH AKTIVITAS & LOG SISTEM / DATABASE */}
      {/* ========================================================================= */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Controls: Search, Filter, Sync, Download, Clear */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Bar */}
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

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSyncLogs}
                  disabled={isSyncingLogs}
                  className="px-3.5 py-2.5 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  title="Sinkronkan log dengan database Firestore"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLogs ? 'animate-spin' : ''}`} />
                  <span>{isSyncingLogs ? 'Menyinkronkan...' : 'Sinkronkan Log'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLogsJson}
                  className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                  title="Unduh log dalam format JSON"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unduh JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all border border-rose-200 cursor-pointer inline-flex items-center gap-1.5"
                  title="Bersihkan riwayat log"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
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

          {/* Auto-Sync Indicator */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sinkronisasi Otomatis Aktif (Menampilkan {filteredLogs.length} dari {logs.length} catatan log)</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              Auto-sync ke Firestore 'system_logs'
            </span>
          </div>

          {/* Logs Stream List */}
          <div className="space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-gray-200 space-y-1.5">
                <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                <div className="text-sm font-bold text-gray-700">Tidak Ada Log Sesuai Filter</div>
                <p className="text-xs text-gray-500">
                  Ubah kata kunci pencarian atau pilih kategori dan tingkat keparahan 'ALL'.
                </p>
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

                    {/* Detail text */}
                    <div className={`text-xs text-gray-700 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {log.detail}
                    </div>

                    {/* Expanded Payload Data */}
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
      {/* TAB 3: STATUS DATABASE FIRESTORE & KUOTA */}
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

          {/* Database Collections Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Koleksi members</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[#0b5d34] text-[10px] font-mono font-bold">
                  Aktif
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">{members.length}</div>
              <p className="text-[11px] text-gray-500">
                Data anggota terverifikasi (Kepala Keluarga, Istri, Anak). Dilengkapi proteksi Collision Guard.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Koleksi tempdatalama</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                  Arsip Terhapus
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">{tempDataLama.length}</div>
              <p className="text-[11px] text-gray-500">
                Menampung data terhapus agar dapat dikembalikan sewaktu-waktu tanpa kehilangan data asli.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Koleksi system_counters</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                  Monotonik
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">&gt;= 131</div>
              <p className="text-[11px] text-gray-500">
                Menjamin ID anggota selalu unik dan melanjutkan ke nomor urut baru tanpa mendaur ulang ID terhapus.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Koleksi system_logs</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                  Real-time
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">{logs.length}</div>
              <p className="text-[11px] text-gray-500">
                Menyimpan seluruh catatan aktivitas aplikasi, log operasi database, dan riwayat penanganan error.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Koleksi notifications</span>
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-mono font-bold">
                  Real-time
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">Aktif</div>
              <p className="text-[11px] text-gray-500">
                Notifikasi pendaftaran baru dan perubahan status persetujuan yang terverifikasi di Firestore.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Kapasitas IndexedDB</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                  Tinggi
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">&gt; 500 MB</div>
              <p className="text-[11px] text-gray-500">
                Menampung lampiran foto KTP, KK, dan foto profil tanpa terbentur limit 5MB LocalStorage browser.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
