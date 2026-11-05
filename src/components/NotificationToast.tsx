import React from 'react';
import { AppNotification } from '../types';
import { CheckCircle2, XCircle, Bell, X, Sparkles, Clock } from 'lucide-react';
import { formatIndonesianDateTime, getPeranLabel } from '../utils/storage';

interface NotificationToastProps {
  currentToast: AppNotification | null;
  onDismissToast: () => void;
  isOpenDrawer: boolean;
  onCloseDrawer: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
}

/**
 * Menyaring pesan agar pada tampilan aplikasi umum hanya menampilkan data umum
 * (Nama Anggota, ID Anggota, Peran, dan Status) tanpa menampilkan No. KK / NIK.
 */
function sanitizePublicNotificationMessage(message: string): string {
  if (!message) return '';
  return message
    .replace(/\s*\(No\.\s*KK:\s*[^)]+\)/gi, '')
    .replace(/\s*\(NIK:\s*[^)]+\)/gi, '');
}

/**
 * Menghasilkan label dan nilai tanggal+jam detail sesuai status notifikasi:
 * - Jika baru daftar (`new_registration` / `menunggu`): menampilkan kapan Tanggal Daftar detail beserta jamnya.
 * - Jika sudah disetujui (`status_approved` / `disetujui`): menampilkan kapan Tanggal Disetujui oleh Admin detail beserta jamnya.
 */
function getNotificationDateTimeInfo(notif: AppNotification): { label: string; value: string; badgeClass: string } {
  const isApproved = notif.type === 'status_approved' || notif.status === 'disetujui';
  const isNewReg = notif.type === 'new_registration' || notif.status === 'menunggu';

  if (isApproved) {
    return {
      label: 'Disetujui Admin',
      value: formatIndonesianDateTime(notif.tanggalDisetujui || notif.timestamp, notif.timestamp),
      badgeClass: 'text-emerald-800 bg-emerald-100/80 border-emerald-200',
    };
  }

  if (isNewReg) {
    return {
      label: 'Tanggal Daftar',
      value: formatIndonesianDateTime(notif.tanggalDaftar || notif.timestamp, notif.timestamp),
      badgeClass: 'text-amber-800 bg-amber-100/80 border-amber-200',
    };
  }

  return {
    label: 'Waktu Status',
    value: formatIndonesianDateTime(notif.timestamp),
    badgeClass: 'text-gray-700 bg-gray-100 border-gray-200',
  };
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  currentToast,
  onDismissToast,
  isOpenDrawer,
  onCloseDrawer,
  notifications,
  onMarkAllRead,
}) => {
  const toastDateInfo = currentToast ? getNotificationDateTimeInfo(currentToast) : null;

  return (
    <>
      {/* Floating Live Real-Time Banner Toast (Hanya Data Umum: Nama, ID, dan Tanggal+Jam Detail) */}
      {currentToast && toastDateInfo && (
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
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0b5d34]">
                  ⚡ Notifikasi Real-time
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ID: {currentToast.memberId}
                </span>
              </div>

              <div className="text-xs font-extrabold text-gray-900 mt-1 truncate">
                {currentToast.memberName || currentToast.nama}
                {currentToast.peranKeluarga ? (
                  <span className="ml-1.5 font-semibold text-[11px] text-gray-600">
                    ({getPeranLabel(currentToast.peranKeluarga)})
                  </span>
                ) : null}
              </div>

              <p className="text-xs font-medium text-gray-700 mt-0.5 leading-snug">
                {sanitizePublicNotificationMessage(currentToast.message)}
              </p>

              <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-600">
                <Clock className="w-3 h-3 text-[#0b5d34] shrink-0" />
                <span>
                  <strong className="text-gray-800">{toastDateInfo.label}:</strong> {toastDateInfo.value}
                </span>
              </div>
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

      {/* Notification Center Modal / Drawer (Hanya Menampilkan Data Umum: Nama Anggota, ID Anggota, dan Tanggal+Jam Detail) */}
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
                <div>
                  <h3 className="text-base font-bold leading-tight">Riwayat Notifikasi Real-time</h3>
                  <p className="text-[11px] text-emerald-200">
                    Menampilkan informasi umum anggota (Nama, ID &amp; Waktu Detail)
                  </p>
                </div>
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
                notifications.map((notif) => {
                  const dateInfo = getNotificationDateTimeInfo(notif);
                  return (
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
                          {/* Baris Data Umum: Nama Anggota & ID Anggota */}
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <span className="text-xs font-extrabold text-gray-900 truncate">
                              {notif.memberName || notif.nama || 'Anggota'}
                            </span>
                            {notif.memberId && (
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-800 font-mono text-[10px] font-bold shrink-0">
                                ID: {notif.memberId}
                              </span>
                            )}
                          </div>

                          {/* Pesan Umum */}
                          <p className="text-xs font-medium text-gray-700 leading-relaxed">
                            {sanitizePublicNotificationMessage(notif.message)}
                          </p>

                          {/* Baris Tanggal & Jam Detail (Tanggal Daftar atau Tanggal Disetujui Admin) */}
                          <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${dateInfo.badgeClass}`}>
                              {dateInfo.label}
                            </span>
                            <span className="text-[11px] font-medium text-gray-600 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                              {dateInfo.value}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
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
