import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Lock, Eye, EyeOff, X, Terminal, CheckCircle2 } from 'lucide-react';

interface TechnicalAuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const TechnicalAuthModal: React.FC<TechnicalAuthModalProps> = ({
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Exact IT Password mandated by user
  const IT_ACCESS_PASSWORD = '@Teguh9495';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    setTimeout(() => {
      if (password === IT_ACCESS_PASSWORD) {
        setIsVerifying(false);
        onSuccess();
      } else {
        setIsVerifying(false);
        setError('Password akses IT tidak valid. Akses ke menu Teknis ditolak.');
      }
    }, 250);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border-t-4 border-[#0b5d34] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0b5d34]/10 text-[#0b5d34] flex items-center justify-center shrink-0 border border-[#0b5d34]/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-snug">
                Autentikasi Akses Teknis (IT)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Proteksi Akses Khusus Staf IT &amp; Debugger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning Notice */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-2xl text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Otorisasi Diperlukan:</span> Menu Teknis (IT) memuat diagnostik bug mendalam, alat auto-repair database, serta catatan seluruh aktivitas dan log sistem. Masukkan password akses IT untuk melanjutkan.
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-shake">
            <X className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Password Akses IT <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Masukkan password khusus IT..."
                className="w-full pl-10 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={isVerifying || !password}
              className="flex-1 py-3 px-4 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>{isVerifying ? 'Memverifikasi...' : 'Buka Halaman Teknis (IT)'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
