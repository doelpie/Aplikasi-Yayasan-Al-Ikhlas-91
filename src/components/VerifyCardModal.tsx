import React, { useState } from 'react';
import { Member } from '../types';
import { ShieldCheck, AlertCircle, X, KeyRound } from 'lucide-react';

interface VerifyCardModalProps {
  member: Member;
  onClose: () => void;
  onSuccess: (member: Member) => void;
}

export const VerifyCardModal: React.FC<VerifyCardModalProps> = ({
  member,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Extract last 4 digits of registered phone number
  const cleanPhone = member.noHp.replace(/\D/g, '');
  const actualLast4 = cleanPhone.slice(-4);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = pin.trim().replace(/\D/g, '');

    if (cleanInput.length < 4) {
      setError('Masukkan 4 digit nomor HP dengan lengkap.');
      return;
    }

    if (cleanInput === actualLast4) {
      setError(null);
      onSuccess(member);
    } else {
      setError(
        `4 digit tidak cocok! Pastikan memasukkan 4 angka terakhir nomor HP yang Anda daftarkan.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 text-[#83141a] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#83141a]">Verifikasi Kartu Anggota</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Details Preview */}
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">{member.nama}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alamat</div>
            <div className="text-sm text-gray-700 mt-0.5 leading-relaxed">{member.alamat}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 leading-snug">
              Masukkan 4 digit terakhir nomor Telp/HP terdaftar untuk mengunduh kartu anggota.
            </label>
            
            <div className="relative mt-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (error) setError(null);
                }}
                placeholder="••••"
                autoFocus
                className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-gray-900 bg-gray-50 border-2 border-[#83141a] rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-100 transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-2.5 flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Helpful Testing Hint badge for demo review */}
            <div className="mt-3 flex items-center justify-between p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-lg text-xs text-amber-800">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Petunjuk Uji Coba: 4 digit terakhir adalah <strong>{actualLast4}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPin(actualLast4);
                  setError(null);
                }}
                className="text-[11px] font-semibold text-[#83141a] hover:underline cursor-pointer"
              >
                Isi Otomatis
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-[#83141a] hover:bg-[#6e1015] active:scale-[0.99] text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Verifikasi & Unduh Kartu</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-[#83141a] text-[#83141a] font-semibold rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
