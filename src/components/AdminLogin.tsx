import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowLeft, AlertCircle, Shield } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToPublic: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onBackToPublic,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default admin password specified by user
    const ADMIN_PASSWORD = 'YAI911@dm000';
    
    if (password === ADMIN_PASSWORD) {
      setError(null);
      onLoginSuccess();
    } else {
      setError('Password pengurus salah. Silakan periksa kembali.');
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between">
      {/* Header Bar with Hijau NU Theme */}
      <div className="bg-[#0b5d34] text-white py-7 px-4 text-center shadow-md">
        <div className="max-w-xl mx-auto flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white text-[#0b5d34] flex items-center justify-center font-black text-xl mb-2 shadow-sm border-2 border-amber-300">
            AI
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase">
            ADMIN ANGGOTA
          </h1>
          <p className="text-xs text-emerald-200 mt-1 font-medium">
            Yayasan Al Ikhlas Sembilan Satu
          </p>
        </div>
      </div>

      {/* Main Login Card - Clean and without any hints */}
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col justify-center">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-[#0b5d34]" />
            <h2 className="text-xl sm:text-2xl font-bold text-[#0b5d34]">
              Masuk Admin
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Khusus pengurus resmi Yayasan Al Ikhlas Sembilan Satu.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Masukkan password admin"
                  className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-[#0b5d34] hover:bg-[#084d2a] active:scale-[0.99] text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer text-sm"
              >
                Masuk
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <button
              onClick={onBackToPublic}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#0b5d34] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Halaman Utama</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
