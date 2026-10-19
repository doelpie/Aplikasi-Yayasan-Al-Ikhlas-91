import React from 'react';
import { Volume2, VolumeX, Bell } from 'lucide-react';
import { AppNotification } from '../types';

interface HeaderProps {
  totalKepalaKeluarga: number;
  totalJiwa: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  isAdminView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  totalKepalaKeluarga,
  totalJiwa,
  soundEnabled,
  onToggleSound,
  notifications,
  onOpenNotifications,
  isAdminView = false,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="relative bg-[#83141a] text-white pt-6 pb-12 px-4 sm:px-6 shadow-md transition-colors">
      <div className="max-w-xl mx-auto">
        {/* Top Navbar Row */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white text-[#83141a] flex items-center justify-center font-extrabold text-sm shadow-sm">
              AI
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-red-200 font-semibold leading-none">
                {isAdminView ? 'Sistem Manajemen' : 'Direktori Anggota'}
              </div>
              <h1 className="text-base sm:text-lg font-bold leading-tight mt-0.5">
                Yayasan Al Ikhlas Sembilan Satu
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
                <Volume2 className="w-5 h-5 text-emerald-300" />
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

        {/* Two Top Stats Cards - matching IMG-20261018-WA0014.jpg */}
        {!isAdminView && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Card 1: Kepala Keluarga */}
            <div className="bg-white text-stone-900 rounded-2xl p-4 sm:p-5 text-center shadow-lg border border-red-950/10 transition-transform active:scale-98">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#83141a] tracking-tight">
                {totalKepalaKeluarga}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-600 mt-1">
                Kepala Keluarga
              </div>
            </div>

            {/* Card 2: Total Jiwa */}
            <div className="bg-white text-stone-900 rounded-2xl p-4 sm:p-5 text-center shadow-lg border border-red-950/10 transition-transform active:scale-98">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#83141a] tracking-tight">
                {totalJiwa}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-600 mt-1">
                Total Jiwa
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
