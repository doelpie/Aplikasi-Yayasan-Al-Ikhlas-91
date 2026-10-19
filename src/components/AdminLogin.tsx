import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';

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
    // Default admin passwords
    const validPasswords = ['admin123', 'admin91', 'alikhlas91', '123456'];
    
    if (validPasswords.includes(password.trim())) {
      setError(null);
      onLoginSuccess();
    } else {
      setError('Password yang Anda masukkan salah. Gunakan password default: admin123');
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between">
      {/* Red Header Bar matching Screenshot_2026-10-19-10-02-59-851 */}
      <div className="bg-[#83141a] text-white py-6 px-4 text-center shadow-md">
        <div className="max-w-xl mx-auto">
          <h1 className="text-xl font-black tracking-wider uppercase">
            ADMIN ANGGOTA
          </h1>
          <p className="text-xs text-red-200 mt-1 font-medium">
            Yayasan Al Ikhlas Sembilan Satu
          </p>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col justify-center">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-[#83141a]">
            Masuk Admin
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Silakan masukkan kata sandi pengurus untuk mengelola data anggota.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
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
                  className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all"
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
                <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Quick Demo Hint */}
            <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Password default: <strong>admin123</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPassword('admin123');
                  setError(null);
                }}
                className="text-[11px] font-semibold text-[#83141a] hover:underline cursor-pointer"
              >
                Isi Otomatis
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-[#83141a] hover:bg-[#6c1015] active:scale-[0.99] text-white font-semibold rounded-xl shadow-md transition-all cursor-pointer text-sm"
              >
                Masuk
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <button
              onClick={onBackToPublic}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#83141a] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Halaman Warga</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
