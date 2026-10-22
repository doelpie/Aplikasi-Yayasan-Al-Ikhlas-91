import React, { useState, useEffect, useRef } from 'react';
import { Activity, Member, ActivityAttendee } from '../types';
import { 
  X, 
  Camera, 
  Upload, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  RefreshCw, 
  UserCheck, 
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getPeranLabel, maskNik, getInitials } from '../utils/storage';
import { soundEffects } from '../utils/sound';

interface QrScannerModalProps {
  activities: Activity[];
  selectedActivityId?: string;
  allMembers: Member[];
  onClose: () => void;
  onRecordAttendance: (
    activityId: string, 
    member: Member, 
    forceAddToPeserta: boolean
  ) => { success: boolean; alreadyAttended: boolean; isNewToPeserta: boolean; attendee?: ActivityAttendee; error?: string };
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  activities,
  selectedActivityId,
  allMembers,
  onClose,
  onRecordAttendance,
}) => {
  // Activity Selection
  const [activeActId, setActiveActId] = useState<string>(
    selectedActivityId || (activities.length > 0 ? activities[0].id : '')
  );

  // Scanning mode: 'camera' | 'upload' | 'manual'
  const [scanMode, setScanMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Manual input state
  const [manualQuery, setManualQuery] = useState('');

  // Confirmation pop-up state when member is not yet in pesertaIds
  const [unregisteredMember, setUnregisteredMember] = useState<Member | null>(null);

  // Success alert state
  const [lastSuccessAttendee, setLastSuccessAttendee] = useState<ActivityAttendee | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container';

  const currentActivity = activities.find(a => a.id === activeActId) || activities[0];

  // Helper to parse QR payload: format "ALIKHLAS:{id}:{nik}" or raw ID or JSON
  const parseQrData = (decodedText: string): Member | null => {
    const raw = decodedText.trim();

    // 1. Format ALIKHLAS:ID:NIK
    if (raw.startsWith('ALIKHLAS:')) {
      const parts = raw.split(':');
      const id = parts[1];
      const nik = parts[2];
      const found = allMembers.find(m => m.id === id || (nik && m.nik === nik));
      if (found) return found;
    }

    // 2. Try JSON parse
    try {
      const obj = JSON.parse(raw);
      if (obj.id || obj.nik) {
        const found = allMembers.find(m => m.id === obj.id || (obj.nik && m.nik === obj.nik));
        if (found) return found;
      }
    } catch (e) {
      // not json
    }

    // 3. Raw search by ID or NIK
    const foundDirect = allMembers.find(m => 
      m.id === raw || 
      m.nik === raw.replace(/\D/g, '') ||
      m.nik === raw
    );

    return foundDirect || null;
  };

  // Process member attendance check
  const handleProcessMember = (member: Member) => {
    if (!currentActivity) {
      setAlertMessage({ type: 'error', text: 'Pilih kegiatan terlebih dahulu.' });
      return;
    }

    const res = onRecordAttendance(currentActivity.id, member, false);

    if (res.alreadyAttended) {
      soundEffects.warning();
      setAlertMessage({
        type: 'warning',
        text: `Anggota "${member.nama}" SUDAH TERCATAT HADIR sebelumnya.`
      });
      return;
    }

    if (res.isNewToPeserta && !res.success) {
      // Pop Up Konfirmasi Anggota belum masuk Daftar Peserta
      soundEffects.click();
      setUnregisteredMember(member);
      return;
    }

    if (res.success && res.attendee) {
      soundEffects.success();
      setLastSuccessAttendee(res.attendee);
      setAlertMessage({
        type: 'success',
        text: `Presensi Berhasil! "${member.nama}" tercatat hadir pada ${res.attendee.scanTimeFormatted}.`
      });
      setTimeout(() => {
        setAlertMessage(null);
      }, 4000);
    }
  };

  // Confirm adding unregistered member to peserta & hadir
  const handleConfirmAddAndAttend = () => {
    if (!unregisteredMember || !currentActivity) return;

    const res = onRecordAttendance(currentActivity.id, unregisteredMember, true);
    if (res.success && res.attendee) {
      soundEffects.success();
      setLastSuccessAttendee(res.attendee);
      setAlertMessage({
        type: 'success',
        text: `Berhasil! "${unregisteredMember.nama}" telah ditambahkan ke Daftar Peserta dan langsung dicatat Hadir.`
      });
      setUnregisteredMember(null);
      setTimeout(() => {
        setAlertMessage(null);
      }, 4000);
    }
  };

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const member = parseQrData(decodedText);
          if (member) {
            handleProcessMember(member);
          } else {
            setAlertMessage({
              type: 'warning',
              text: `Kode QR terdeteksi ("${decodedText.slice(0, 20)}"), tetapi data anggota tidak terdaftar di sistem Yayasan.`
            });
          }
        },
        () => {
          // ignore scan frame misses
        }
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan atau gunakan opsi Unggah Gambar / Input Manual.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActive) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        // ignore
      }
      setIsCameraActive(false);
    }
  };

  // Initialize camera when mode is 'camera'
  useEffect(() => {
    if (scanMode === 'camera') {
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [scanMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Upload QR Image handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('qr-temp-file-reader');
      const decodedText = await html5QrCode.scanFile(file, true);
      const member = parseQrData(decodedText);
      if (member) {
        handleProcessMember(member);
      } else {
        setAlertMessage({
          type: 'warning',
          text: `QR Code pada gambar tidak cocok dengan data anggota yayasan manapun.`
        });
      }
      html5QrCode.clear();
    } catch (err) {
      setAlertMessage({
        type: 'error',
        text: 'Tidak dapat mendeteksi QR Code dari gambar yang dipilih. Pastikan gambar jelas dan tidak buram.'
      });
    }
  };

  // Manual search submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualQuery.trim();
    if (!clean) return;

    const member = parseQrData(clean);
    if (member) {
      handleProcessMember(member);
      setManualQuery('');
    } else {
      setAlertMessage({
        type: 'warning',
        text: `Data anggota dengan ID atau NIK "${clean}" tidak ditemukan.`
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[94vh] overflow-y-auto border-t-4 border-[#0b5d34] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden container for file scanning */}
        <div id="qr-temp-file-reader" className="hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0b5d34] flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0b5d34]">
                Scan QR Presensi Kehadiran
              </h2>
              <p className="text-[11px] text-gray-500">
                Pindai QR Code Kartu Anggota untuk absensi kegiatan
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Select Target Activity */}
        <div className="mt-3.5 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200">
          <label className="block text-[11px] font-bold text-[#0b5d34] mb-1">
            Presensi untuk Kegiatan:
          </label>
          <select
            value={activeActId}
            onChange={(e) => {
              setActiveActId(e.target.value);
              setAlertMessage(null);
            }}
            className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 cursor-pointer"
          >
            {activities.map((act) => (
              <option key={act.id} value={act.id}>
                {act.judul} ({act.tanggal} · {act.jamMulai} WITA)
              </option>
            ))}
          </select>
          {currentActivity && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-emerald-800">
              <span>{currentActivity.pesertaIds.length} Peserta Diundang</span>
              <span className="font-bold">✓ {currentActivity.kehadiran.length} Sudah Hadir</span>
            </div>
          )}
        </div>

        {/* Scan Mode Toggle: Kamera vs Unggah File vs Manual */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl mt-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setScanMode('camera')}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === 'camera'
                ? 'bg-white text-[#0b5d34] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera Live</span>
          </button>

          <button
            type="button"
            onClick={() => setScanMode('upload')}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === 'upload'
                ? 'bg-white text-[#0b5d34] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Foto</span>
          </button>

          <button
            type="button"
            onClick={() => setScanMode('manual')}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === 'manual'
                ? 'bg-white text-[#0b5d34] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Input ID</span>
          </button>
        </div>

        {/* Status Alerts */}
        {alertMessage && (
          <div className={`mt-3 p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : alertMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}>
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{alertMessage.text}</span>
          </div>
        )}

        {/* SCANNER VIEW AREA */}
        <div className="mt-3 flex-1 flex flex-col justify-center">
          {/* 1. CAMERA MODE */}
          {scanMode === 'camera' && (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-[300px] mx-auto flex items-center justify-center w-full border-2 border-emerald-800">
                <div id={scannerContainerId} className="w-full h-full" />
                
                {cameraError && (
                  <div className="absolute inset-0 bg-black/85 p-6 flex flex-col items-center justify-center text-center text-white space-y-2 z-10">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-gray-200">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-[#0b5d34] text-white rounded-lg text-xs font-bold hover:bg-[#084d2a] cursor-pointer mt-1"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-gray-500">
                Arahkan kamera ke QR Code pada Kartu Anggota Yayasan
              </p>
            </div>
          )}

          {/* 2. UPLOAD FILE MODE */}
          {scanMode === 'upload' && (
            <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center space-y-3 bg-stone-50">
              <Upload className="w-10 h-10 text-emerald-600 mx-auto" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-gray-800">
                  Pilih Gambar QR Code Kartu
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Unggah tangkapan layar atau foto kartu anggota berformat JPG/PNG
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0b5d34] text-white text-xs font-bold rounded-xl hover:bg-[#084d2a] transition-colors cursor-pointer shadow-xs">
                <span>Pilih Berkas Gambar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* 3. MANUAL INPUT MODE */}
          {scanMode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-gray-800">
                Input Manual Nomor ID atau NIK Anggota
              </h4>
              <p className="text-[11px] text-gray-500">
                Masukkan ID unik (contoh: 0114) atau 16 digit NIK untuk mencatat presensi secara langsung.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ketik ID Anggota atau NIK..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#0b5d34] text-white font-bold rounded-xl text-xs hover:bg-[#084d2a] transition-colors cursor-pointer"
                >
                  Presensi
                </button>
              </div>
            </form>
          )}
        </div>

        {/* RECENT ATTENDANCE TICKER */}
        {lastSuccessAttendee && (
          <div className="mt-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-900 block truncate">
                  {lastSuccessAttendee.memberNama}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  NIK: {maskNik(lastSuccessAttendee.memberNik)} · {lastSuccessAttendee.scanTimeFormatted}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-full">
              Hadir
            </span>
          </div>
        )}

        {/* POP UP KONFIRMASI: ANGGOTA BELUM MASUK DAFTAR PESERTA KEGIATAN */}
        {unregisteredMember && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in zoom-in-95 duration-150">
            <div 
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 sm:p-6 border-2 border-amber-400 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    Konfirmasi Penambahan Peserta
                  </h3>
                  <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Belum Terdaftar di Peserta Acara
                  </span>
                </div>
              </div>

              {/* Detail Anggota */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1 text-xs">
                <div className="font-bold text-gray-900 text-sm">
                  {unregisteredMember.nama}
                </div>
                <div className="text-gray-600 font-mono text-[11px]">
                  ID: {unregisteredMember.id} · NIK: {maskNik(unregisteredMember.nik)}
                </div>
                <div className="text-gray-500 text-[11px]">
                  Peran: {getPeranLabel(unregisteredMember.peranKeluarga)} · {unregisteredMember.alamat}
                </div>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">
                Anggota di atas belum masuk ke <strong>Daftar Peserta</strong> untuk kegiatan <em>&quot;{currentActivity?.judul}&quot;</em>. 
                <br /><br />
                Apakah Anda ingin <strong>menambahkan Anggota ini ke Dalam Daftar Peserta &amp; langsung mencatatnya ke Daftar Hadir Kegiatan</strong>?
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmAddAndAttend}
                  className="flex-1 py-2.5 px-3 bg-[#0b5d34] hover:bg-[#084d2a] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Ya, Tambahkan &amp; Hadirkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnregisteredMember(null)}
                  className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
