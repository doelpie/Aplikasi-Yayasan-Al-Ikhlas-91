import React from 'react';
import { Volume2, VolumeX, Bell, UserCheck, Shield } from 'lucide-react';
import { AppNotification, Member } from '../types';
import { getPeranLabel } from '../utils/storage';

interface HeaderProps {
  totalKepalaKeluarga: number;
  totalJiwa: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  currentUserSession?: Member | null;
  onGoToProfile?: () => void;
  isAdminView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  totalKepalaKeluarga,
  totalJiwa,
  soundEnabled,
  onToggleSound,
  notifications,
  onOpenNotifications,
  currentUserSession,
  onGoToProfile,
  isAdminView = false,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="relative bg-[#0b5d34] text-white pt-6 pb-12 px-4 sm:px-6 shadow-md transition-colors border-b-2 border-[#d4af37]">
      <div className="max-w-xl mx-auto">
        {/* Top Navbar Row */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white text-[#0b5d34] flex items-center justify-center font-black text-lg shadow-sm border-2 border-amber-300">
              AI
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-200 font-bold leading-none">
                {isAdminView ? 'Sistem Manajemen NU' : 'Yayasan Al Ikhlas Sembilan Satu'}
              </div>
              <h1 className="text-base sm:text-lg font-bold leading-tight mt-0.5 text-white">
                Manajemen Anggota & Keluarga
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sound Effects Toggle */}
            <button
              onClick={onToggleSound}
              title={soundEnabled ? 'Suara Notifikasi Aktif' : 'Suara Notifikasi Senyap'}
              className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-amber-300" />
              ) : (
                <VolumeX className="w-5 h-5 text-white/50" />
              )}
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              title="Notifikasi Real-time"
              className="relative p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-gray-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Warga Logged In Session Badge */}
        {!isAdminView && currentUserSession && onGoToProfile && (
          <div className="mb-3 p-2.5 bg-emerald-950/60 rounded-2xl border border-emerald-400/40 flex items-center justify-between text-xs backdrop-blur-xs">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="truncate">
                Masuk: <strong>{currentUserSession.nama}</strong> ({getPeranLabel(currentUserSession.peranKeluarga)})
              </span>
            </div>
            <button
              onClick={onGoToProfile}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded-lg text-[11px] transition-colors cursor-pointer shrink-0"
            >
              Profil Saya
            </button>
          </div>
        )}

        {/* Two Top Stats Cards - NU Green Accents */}
        {!isAdminView && (
          <div className="grid grid-cols-2 gap-3.5 mt-2">
            {/* Card 1: Kepala Keluarga */}
            <div className="bg-white text-stone-900 rounded-2xl p-4 sm:p-5 text-center shadow-lg border-2 border-emerald-900/10 transition-transform">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#0b5d34] tracking-tight">
                {totalKepalaKeluarga}
              </div>
              <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">
                Kepala Keluarga
              </div>
            </div>

            {/* Card 2: Total Jiwa */}
            <div className="bg-white text-stone-900 rounded-2xl p-4 sm:p-5 text-center shadow-lg border-2 border-emerald-900/10 transition-transform">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#0b5d34] tracking-tight">
                {totalJiwa}
              </div>
              <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">
                Total Jiwa
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
