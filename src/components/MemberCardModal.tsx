import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { getInitials, formatIndonesianDate, getPeranLabel } from '../utils/storage';
import { downloadMemberCardImage, downloadMemberCardPdf } from '../utils/cardGenerator';
import { Download, Printer, X, CheckCircle, FileDown, QrCode } from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';

interface MemberCardModalProps {
  member: Member;
  onClose: () => void;
  showCelebration?: boolean;
}

export const MemberCardModal: React.FC<MemberCardModalProps> = ({
  member,
  onClose,
  showCelebration = false,
}) => {
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // Generate QR Code containing ID Anggota & NIK for Kegiatan attendance
    const payload = `ALIKHLAS:${member.id}:${member.nik}`;
    QRCode.toDataURL(payload, {
      width: 160,
      margin: 1,
      color: {
        dark: '#0b5d34',
        light: '#ffffff',
      },
    })
      .then(setQrCodeUrl)
      .catch((err) => console.warn('QR Code generation error:', err));
  }, [member.id, member.nik]);

  useEffect(() => {
    if (showCelebration) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }
    }
  }, [showCelebration]);

  const cleanName = member.nama.trim().replace(/\s+/g, '_');
  const targetFileName = `Kartu_Anggota_Yayasan_Al-Ikhlas _${member.id}_${cleanName}`;

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = targetFileName;
    window.print();
    const restore = () => {
      document.title = originalTitle;
    };
    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 2000);
  };

  const handleDownloadPng = async () => {
    setIsDownloadingPng(true);
    try {
      await downloadMemberCardImage(member);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadMemberCardPdf(member);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const roleLabel = getPeranLabel(member.peranKeluarga);
  const idDocType = member.peranKeluarga === 'anak' ? 'NIK / KIA' : 'NIK (KTP)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto border-2 border-emerald-800/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar modal control */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 bg-stone-900 text-white print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold truncate">Kartu Anggota Resmi Yayasan Al Ikhlas Sembilan Satu</span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-white p-1 rounded-full hover:bg-stone-800 transition-colors cursor-pointer shrink-0 ml-2"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE / DISPLAYABLE CARD CONTAINER */}
        <div className="p-2 sm:p-6 bg-stone-100 flex justify-center">
          <div 
            id="printable-card"
            className="w-full max-w-[620px] bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col font-sans text-stone-900 print:shadow-none print:border-none print:w-full print:m-0"
          >
            {/* CARD HEADER - BANNER (#0b5d34) */}
            <div className="bg-[#0b5d34] text-white px-3.5 sm:px-6 py-3 sm:py-4 flex items-center gap-2.5 sm:gap-4 relative">
              <img 
                src="/logo.png" 
                alt="Logo Yayasan Al Ikhlas" 
                className="w-10 h-10 sm:w-13 sm:h-13 object-contain shrink-0 drop-shadow-sm" 
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-xl font-bold leading-tight truncate">
                    Yayasan Al Ikhlas Sembilan Satu
                  </h1>
                </div>
                <p className="text-[11px] sm:text-xs text-emerald-100 leading-tight mt-0.5 truncate">
                  Jl. Raya Dalung No. 91 Br. Kaja - Dalung, Badung - Bali
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold text-amber-300 tracking-wider uppercase">
                    Kartu Anggota Keluarga
                  </span>
                  <span className="px-2 py-0.2 rounded-full bg-emerald-900/80 text-emerald-200 text-[10px] font-bold border border-emerald-700/80">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Gold separator strip */}
            <div className="w-full h-1 bg-[#d4af37]"></div>

            {/* CARD BODY WITH PHOTO PORTRAIT */}
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start bg-white">
              {/* Photo Portrait Frame */}
              <div className="w-32 h-40 sm:w-36 sm:h-44 rounded-xl overflow-hidden bg-[#e8f5e9] border-2 border-[#0b5d34] shadow-sm flex items-center justify-center shrink-0 mx-auto sm:mx-0 relative">
                {member.fotoUrl ? (
                  <img
                    src={member.fotoUrl}
                    alt={member.nama}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2 text-[#0b5d34]">
                    <span className="text-4xl font-extrabold">{getInitials(member.nama)}</span>
                    <span className="text-[10px] font-semibold mt-1">Pas Foto</span>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-[#0b5d34]/90 text-white text-[9px] font-bold py-0.5 text-center uppercase tracking-wider">
                  {roleLabel}
                </div>
              </div>

              {/* Data Fields */}
              <div className="flex-1 space-y-2.5 min-w-0 text-left w-full">
                {/* Nama Sesuai KTP */}
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    NAMA LENGKAP (SESUAI KTP)
                  </div>
                  <div className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                    {member.nama}
                  </div>
                </div>

                {/* NIK / KIA & NO KK - Full unmasked when card is opened */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {idDocType}
                    </div>
                    <div className="text-xs sm:text-sm font-bold font-mono text-[#0b5d34] mt-0.5">
                      {member.nik}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      NO. KARTU KELUARGA (KK)
                    </div>
                    <div className="text-xs sm:text-sm font-bold font-mono text-gray-800 mt-0.5">
                      {member.noKk || '-'}
                    </div>
                  </div>
                </div>

                {/* Alamat */}
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    ALAMAT DOMISILI
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 leading-relaxed">
                    {member.alamat}
                  </div>
                </div>

                {/* Hubungan Keluarga & No Telp / WA - TIDAK DISENSOR */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      STATUS KELUARGA
                    </div>
                    <div className="text-xs font-bold text-gray-900 mt-0.5">
                      {roleLabel} {member.namaKepalaKeluarga && `(KK: ${member.namaKepalaKeluarga})`}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      NO. HP / WA
                    </div>
                    <div className="text-xs font-bold text-gray-900 font-mono mt-0.5">
                      {member.noHp || '-'}
                    </div>
                  </div>
                </div>

                {/* Mobile QR Code Box */}
                {qrCodeUrl && (
                  <div className="sm:hidden flex items-center gap-2.5 p-2 bg-emerald-50/70 rounded-xl border border-emerald-200 mt-2">
                    <img src={qrCodeUrl} alt="QR Code" className="w-12 h-12 bg-white p-0.5 rounded-lg border border-emerald-300 object-contain shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-[#0b5d34] block">QR Code Absensi Kegiatan</span>
                      <span className="text-[9px] text-gray-600 leading-tight block">Gunakan untuk scan hadir saat acara resmi yayasan</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop / Print QR Code Frame (Right side) */}
              {qrCodeUrl && (
                <div className="hidden sm:flex flex-col items-center justify-center p-2 rounded-xl border border-[#0b5d34]/30 bg-emerald-50/40 shrink-0 self-start mt-0.5">
                  <div className="w-20 h-20 bg-white p-1 rounded-lg border border-emerald-200 shadow-2xs flex items-center justify-center">
                    <img src={qrCodeUrl} alt="QR Code Presensi" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-[9px] font-bold text-[#0b5d34] uppercase tracking-wider mt-1.5 text-center">
                    Scan Absen
                  </span>
                </div>
              )}
            </div>

            {/* CARD FOOTER */}
            <div className="px-5 sm:px-6 pb-4 bg-white">
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between text-xs text-gray-600 font-medium">
                <div>
                  ID Anggota: <span className="font-bold text-gray-900 font-mono">{member.id}</span>
                </div>
                <div>
                  Dicetak: <span className="text-gray-800">{formatIndonesianDate(member.tanggalDisetujui)}</span>
                </div>
              </div>
              
              {/* Bottom strip */}
              <div className="w-full h-1 bg-[#0b5d34] rounded-full mt-2.5 mb-1"></div>
              <div className="w-full h-0.5 bg-[#d4af37] rounded-full mb-2"></div>
              
              <div className="text-center text-[10px] text-gray-500 italic">
                Kartu ini merupakan bukti keanggotaan resmi Yayasan Al Ikhlas Sembilan Satu
              </div>
            </div>
          </div>
        </div>

        {/* MODAL ACTION BUTTONS */}
        <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-gray-500 hidden sm:block">
            Format file: <span className="font-mono text-gray-700 font-medium text-[11px]">{targetFileName}.[pdf|png]</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              title="Cetak langsung menggunakan printer atau browser print dialog"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Unduh file PDF resmi kartu anggota"
            >
              <FileDown className="w-4 h-4 text-emerald-700" />
              <span>{isDownloadingPdf ? 'Menyiapkan...' : 'Simpan PDF'}</span>
            </button>
            <button
              onClick={handleDownloadPng}
              disabled={isDownloadingPng}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0b5d34] hover:bg-[#084d2a] rounded-xl shadow transition-colors cursor-pointer"
              title="Unduh gambar PNG kartu anggota beresolusi tinggi"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingPng ? 'Menyiapkan...' : 'Simpan PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
