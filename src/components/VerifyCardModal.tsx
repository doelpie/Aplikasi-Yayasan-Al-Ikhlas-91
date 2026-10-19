import React, { useState } from 'react';
import { Member } from '../types';
import { ShieldCheck, AlertCircle, X, KeyRound } from 'lucide-react';
import { verifyMemberPin, getPeranLabel } from '../utils/storage';

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

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = pin.trim().replace(/\D/g, '');

    if (cleanInput.length < 6) {
      setError('Masukkan 6 digit PIN dengan lengkap.');
      return;
    }

    if (verifyMemberPin(member, cleanInput)) {
      setError(null);
      onSuccess(member);
    } else {
      setError('PIN 6 digit salah. Masukkan 6 digit terakhir nomor KTP/KIA Anda.');
    }
  };

  const idDocType = member.peranKeluarga === 'anak' ? 'KTP / KIA' : 'KTP';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 max-h-[92vh] overflow-y-auto border-t-4 sm:border-t-0 sm:border-2 border-[#0b5d34]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Hijau NU Branding */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0b5d34]">Verifikasi Kartu Anggota</h2>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                {getPeranLabel(member.peranKeluarga)}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Details Preview */}
        <div className="mt-4 space-y-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
          <div className="flex items-center gap-3">
            {member.fotoUrl ? (
              <img
                src={member.fotoUrl}
                alt={member.nama}
                className="w-12 h-14 object-cover rounded-lg border-2 border-[#0b5d34] shadow-xs shrink-0"
              />
            ) : (
              <div className="w-12 h-14 bg-emerald-100 text-[#0b5d34] font-bold text-lg rounded-lg flex items-center justify-center border border-emerald-300 shrink-0">
                AI
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Nama Anggota Sesuai KTP
              </div>
              <div className="text-base font-bold text-gray-900 truncate">
                {member.nama}
              </div>
              <div className="text-xs text-gray-600 truncate mt-0.5">
                {member.alamat}
              </div>
            </div>
          </div>
        </div>

        {/* Form - strictly following user prompt:
            "hilangkan petunjuk angka atau pin untuk melihat kartu hilangkan contohnya. hanya beri petunjuk 'Masukan 6 digit PIN yaitu 6 digit terakhir KTP anda' "
        */}
        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 leading-snug">
              Masukan 6 digit PIN yaitu 6 digit terakhir {idDocType} anda
            </label>
            
            <div className="relative mt-2.5">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
                placeholder="••••••"
                autoFocus
                className="w-full px-4 py-3.5 text-center text-3xl font-bold tracking-[0.5em] text-gray-900 bg-gray-50 border-2 border-[#0b5d34] rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-2.5 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-[#0b5d34] hover:bg-[#084d2a] active:scale-[0.99] text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span>Verifikasi & Buka Kartu</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold rounded-2xl transition-all cursor-pointer text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
