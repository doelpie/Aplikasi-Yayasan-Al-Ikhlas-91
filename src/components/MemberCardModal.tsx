import React from 'react';
import { Member } from '../types';
import { getInitials, maskPhoneNumber, formatIndonesianDate } from '../utils/storage';
import { downloadMemberCardImage } from '../utils/cardGenerator';
import { Download, Printer, X, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  React.useEffect(() => {
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    downloadMemberCardImage(member);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar modal control */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold">Verifikasi Berhasil · Kartu Anggota Resmi</span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-white p-1 rounded-full hover:bg-stone-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE / DISPLAYABLE CARD CONTAINER */}
        <div className="p-4 sm:p-6 bg-stone-100 flex justify-center">
          <div 
            id="printable-card"
            className="w-full max-w-[620px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col font-sans text-stone-900 print:shadow-none print:border-none print:w-full print:m-0"
          >
            {/* CARD HEADER - Deep Maroon Red Banner */}
            <div className="bg-[#83141a] text-white px-5 sm:px-6 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-[#83141a] font-extrabold text-xl tracking-tight">AI</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold leading-tight truncate">
                  Yayasan Al Ikhlas Sembilan Satu
                </h1>
                <p className="text-xs text-white/90 leading-tight mt-0.5">
                  Jl. Raya Dalung No. 91 Br. Kaja - Dalung
                </p>
                <p className="text-xs text-white/90 font-medium">
                  Kartu Anggota Keluarga
                </p>
              </div>
            </div>

            {/* CARD BODY */}
            <div className="p-5 sm:p-7 flex flex-col sm:flex-row gap-5 items-start bg-white">
              {/* Monogram Box */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg bg-[#fceeee] flex items-center justify-center shrink-0 mx-auto sm:mx-0 border border-red-100">
                <span className="text-[#83141a] text-4xl sm:text-5xl font-extrabold tracking-tight">
                  {getInitials(member.nama)}
                </span>
              </div>

              {/* Data Fields */}
              <div className="flex-1 space-y-3.5 min-w-0 text-left w-full">
                {/* Nama */}
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    NAMA KEPALA KELUARGA
                  </div>
                  <div className="text-base sm:text-lg font-bold text-gray-900 mt-0.5 leading-snug">
                    {member.nama}
                  </div>
                </div>

                {/* Alamat */}
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    ALAMAT
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 leading-relaxed">
                    {member.alamat}
                  </div>
                </div>

                {/* Jumlah Keluarga */}
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    JUMLAH KELUARGA
                  </div>
                  <div className="text-sm sm:text-base font-bold text-gray-900 mt-0.5">
                    {member.jumlahKeluarga} orang
                  </div>
                </div>

                {/* No Telp */}
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    NO. TELP / HP
                  </div>
                  <div className="text-sm sm:text-base font-bold text-gray-900 mt-0.5 tracking-wider font-mono">
                    {maskPhoneNumber(member.noHp)}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD FOOTER */}
            <div className="px-5 sm:px-7 pb-4 bg-white">
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between text-xs text-gray-600 font-medium">
                <div>
                  ID Anggota: <span className="font-bold text-gray-900">{member.id}</span>
                </div>
                <div>
                  Dicetak: <span className="text-gray-800">{formatIndonesianDate(member.tanggalDisetujui)}</span>
                </div>
              </div>
              
              {/* Bottom decorative red bar */}
              <div className="w-full h-1 bg-[#83141a] rounded-full mt-2.5 mb-2"></div>
              
              <div className="text-center text-[10px] text-gray-500 italic">
                Kartu ini merupakan bukti keanggotaan resmi Yayasan Al Ikhlas Sembilan Satu
              </div>
            </div>
          </div>
        </div>

        {/* MODAL ACTION BUTTONS */}
        <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-gray-500 hidden sm:block">
            Simpan atau cetak kartu sebagai bukti sah keanggotaan.
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#83141a] hover:bg-[#6e1015] rounded-xl shadow transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Gambar (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
