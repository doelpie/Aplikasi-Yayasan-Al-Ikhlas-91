import React from 'react';
import { AppNotification } from '../types';
import { CheckCircle2, XCircle, Bell, X, Sparkles, Clock } from 'lucide-react';
import { formatIndonesianDate } from '../utils/storage';

interface NotificationToastProps {
  currentToast: AppNotification | null;
  onDismissToast: () => void;
  isOpenDrawer: boolean;
  onCloseDrawer: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  currentToast,
  onDismissToast,
  isOpenDrawer,
  onCloseDrawer,
  notifications,
  onMarkAllRead,
}) => {
  return (
    <>
      {/* Floating Live Real-Time Banner Toast */}
      {currentToast && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none animate-in slide-in-from-top-4 duration-300">
          <div className="pointer-events-auto max-w-md w-full bg-white rounded-2xl shadow-2xl border-2 border-[#0b5d34]/30 p-4 flex items-start gap-3.5 backdrop-blur-md">
            {currentToast.type === 'status_approved' && (
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center shrink-0 border border-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            )}
            {currentToast.type === 'status_rejected' && (
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-300">
                <XCircle className="w-6 h-6" />
              </div>
            )}
            {currentToast.type === 'new_registration' && (
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                <Sparkles className="w-6 h-6" />
              </div>
            )}
            {currentToast.type === 'data_updated' && (
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
                <Bell className="w-6 h-6" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0b5d34]">
                  ⚡ Notifikasi Real-time
                </span>
                <span className="text-[10px] text-gray-400">Baru saja</span>
              </div>
              <p className="text-xs font-bold text-gray-900 mt-0.5 leading-snug">
                {currentToast.message}
              </p>
            </div>

            <button
              onClick={onDismissToast}
              className="text-gray-400 hover:text-gray-700 p-1 rounded-full cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Notification Center Modal / Drawer */}
      {isOpenDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div 
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-t-4 border-[#0b5d34]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-[#0b5d34] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">Riwayat Notifikasi Real-time</h3>
              </div>
              <button
                onClick={onCloseDrawer}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5 bg-stone-50">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      notif.read ? 'bg-white border-gray-100 text-gray-700' : 'bg-emerald-50/70 border-emerald-200 text-gray-900 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {notif.type === 'status_approved' && (
                        <CheckCircle2 className="w-5 h-5 text-[#0b5d34] shrink-0 mt-0.5" />
                      )}
                      {notif.type === 'status_rejected' && (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      {notif.type === 'new_registration' && (
                        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      {notif.type === 'data_updated' && (
                        <Clock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          {formatIndonesianDate(notif.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs">
                  Belum ada notifikasi terkini.
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={onMarkAllRead}
                  className="text-xs text-gray-600 hover:text-[#0b5d34] font-bold cursor-pointer"
                >
                  Tandai Semua Dibaca
                </button>
                <button
                  onClick={onCloseDrawer}
                  className="px-4 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
