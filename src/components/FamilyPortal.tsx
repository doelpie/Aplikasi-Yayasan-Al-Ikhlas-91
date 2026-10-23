import React, { useState } from 'react';
import { Member, FamilyRole } from '../types';
import { 
  getFamilyMembers, 
  getPeranLabel, 
  maskNik, 
  maskPhoneNumber, 
  formatIndonesianDate, 
  verifyMemberPin,
  getLast6DigitsNik,
  getInitials
} from '../utils/storage';
import { 
  User, 
  Users, 
  ShieldCheck, 
  CreditCard, 
  Edit3, 
  PlusCircle, 
  LogOut, 
  Lock, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  Camera, 
  FileText,
  Home,
  Upload,
  Check,
  Trash2
} from 'lucide-react';

import { compressImage } from '../utils/imageCompressor';

interface FamilyPortalProps {
  currentUserSession: Member | null;
  allMembers: Member[];
  onLoginSession: (member: Member) => void;
  onLogoutSession: () => void;
  onViewCard: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onRegisterFamilyMember: () => void;
  onUpdateSelf: (updated: Member) => void;
}

export const FamilyPortal: React.FC<FamilyPortalProps> = ({
  currentUserSession,
  allMembers,
  onLoginSession,
  onLogoutSession,
  onViewCard,
  onEditMember,
  onRegisterFamilyMember,
  onUpdateSelf,
}) => {
  // Login Form States (when not logged in)
  const [loginNikOrHp, setLoginNikOrHp] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Self Edit State
  const [isEditingSelf, setIsEditingSelf] = useState(false);
  const [editNama, setEditNama] = useState(currentUserSession?.nama || '');
  const [editAlamat, setEditAlamat] = useState(currentUserSession?.alamat || '');
  const [editNoHp, setEditNoHp] = useState(currentUserSession?.noHp || '');
  const [editEmail, setEditEmail] = useState(currentUserSession?.email || '');
  const [editFotoUrl, setEditFotoUrl] = useState(currentUserSession?.fotoUrl || '');
  const [editKtpUrl, setEditKtpUrl] = useState(currentUserSession?.ktpUrl || '');
  const [editKtpName, setEditKtpName] = useState(currentUserSession?.ktpName || '');
  const [editKkUrl, setEditKkUrl] = useState(currentUserSession?.kkUrl || '');
  const [editKkName, setEditKkName] = useState(currentUserSession?.kkName || '');
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);

  // Handle Login Warga
  const handleWargaLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = loginNikOrHp.trim().replace(/\D/g, '');
    const cleanPin = loginPin.trim().replace(/\D/g, '');

    if (!cleanQuery) {
      setLoginError('Masukkan nomor KTP/KIA atau nomor HP Anda.');
      return;
    }
    if (cleanPin.length < 6) {
      setLoginError('Masukkan 6 digit PIN (6 digit terakhir KTP/KIA Anda).');
      return;
    }

    // Find member by NIK or No HP
    const found = allMembers.find(m => {
      const mNik = (m.nik || '').replace(/\D/g, '');
      const mHp = (m.noHp || '').replace(/\D/g, '');
      return mNik === cleanQuery || mHp === cleanQuery || m.id === loginNikOrHp.trim();
    });

    if (!found) {
      setLoginError('Data anggota tidak ditemukan. Pastikan nomor identitas sudah terdaftar.');
      return;
    }

    // Verify 6-digit PIN
    if (!verifyMemberPin(found, cleanPin)) {
      setLoginError('PIN 6 digit salah. Masukkan 6 digit terakhir nomor KTP/KIA Anda.');
      return;
    }

    // Wajib status disetujui oleh Admin
    if (found.status === 'menunggu') {
      setLoginError(
        `Pendaftaran atas nama "${found.nama}" masih berstatus MENUNGGU PERSETUJUAN (ACC) oleh Admin. Anda baru dapat masuk ke menu profil setelah pendaftaran disetujui.`
      );
      return;
    }

    if (found.status === 'ditolak') {
      const reason = found.catatanPenolakan ? ` Catatan: ${found.catatanPenolakan}.` : '';
      setLoginError(
        `Mohon maaf, pendaftaran atas nama "${found.nama}" DITOLAK oleh Pengurus.${reason} Silakan hubungi pengurus Yayasan.`
      );
      return;
    }

    setLoginError(null);
    onLoginSession(found);
  };

  const handleSaveSelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserSession) return;

    if (!editNama.trim() || !editAlamat.trim() || !editNoHp.trim()) {
      return;
    }

    const updated: Member = {
      ...currentUserSession,
      nama: editNama.trim(),
      alamat: editAlamat.trim(),
      noHp: editNoHp.trim(),
      email: editEmail.trim() || undefined,
      fotoUrl: editFotoUrl || currentUserSession.fotoUrl,
      ktpUrl: editKtpUrl || currentUserSession.ktpUrl,
      ktpName: editKtpName || currentUserSession.ktpName,
      kkUrl: editKkUrl || currentUserSession.kkUrl,
      kkName: editKkName || currentUserSession.kkName,
    };

    onUpdateSelf(updated);
    setIsEditingSelf(false);
    setEditSuccessMessage('Data profil dan dokumen lampiran berhasil diperbarui.');
    setTimeout(() => setEditSuccessMessage(null), 4000);
  };

  // If NOT logged in, show Login Form
  if (!currentUserSession) {
    return (
      <div className="max-w-xl md:max-w-2xl mx-auto px-3 sm:px-6 pt-3 pb-28">
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-gray-100">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0b5d34]">
                Portal Profil Anggota
              </h2>
              <p className="text-xs text-gray-500">
                Masuk untuk melihat kartu anggota & mengelola profil keluarga Anda
              </p>
            </div>
          </div>

          {loginError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleWargaLogin} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nomor KTP / KIA atau Nomor HP Terdaftar
              </label>
              <input
                type="text"
                required
                value={loginNikOrHp}
                onChange={(e) => setLoginNikOrHp(e.target.value)}
                placeholder="Contoh: 5103051205780001 atau 081234567xxx"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Masukan 6 digit PIN yaitu 6 digit terakhir KTP anda
              </label>
              <input
                type="password"
                required
                maxLength={6}
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-bold tracking-[0.4em] text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-[#0b5d34] hover:bg-[#084d2a] active:scale-[0.99] text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer text-sm"
            >
              Masuk ke Profil
            </button>

            <div className="pt-2 text-[11px] text-emerald-900 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 leading-relaxed">
              <strong>Catatan:</strong> Data pendaftaran yang baru masuk akan ditinjau oleh Admin terlebih dahulu. Anda baru dapat masuk ke menu profil dan membuka kartu anggota setelah pendaftaran <strong>Disetujui</strong> oleh Admin.
            </div>
          </form>
        </div>
      </div>
    );
  }

  // LOGGED IN VIEW
  const isHeadOfFamily = currentUserSession.peranKeluarga === 'kepala_keluarga';
  const roleLabel = getPeranLabel(currentUserSession.peranKeluarga);
  const familyMembers = isHeadOfFamily ? getFamilyMembers(currentUserSession, allMembers) : [currentUserSession];

  return (
    <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-28 space-y-4">
      {/* Profile Card Header */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xs border border-gray-100">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            {/* Foto Diri */}
            <div className="w-16 h-20 rounded-xl overflow-hidden bg-emerald-50 border-2 border-[#0b5d34] shadow-xs shrink-0">
              {currentUserSession.fotoUrl ? (
                <img
                  src={currentUserSession.fotoUrl}
                  alt={currentUserSession.nama}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#0b5d34] font-bold text-lg">
                  {getInitials(currentUserSession.nama)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0b5d34] text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {roleLabel}
              </span>
              <h2 className="text-lg font-bold text-gray-900 leading-snug mt-1 truncate">
                {currentUserSession.nama}
              </h2>
              <div className="text-xs font-mono mt-1 space-y-0.5">
                <div className="text-gray-700">
                  <span className="text-gray-500 font-sans text-[11px]">No. KTP/NIK:</span> <strong className="text-[#0b5d34]">{currentUserSession.nik}</strong>
                </div>
                <div className="text-gray-700">
                  <span className="text-gray-500 font-sans text-[11px]">No. KK:</span> <strong className="text-gray-800">{currentUserSession.noKk}</strong>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onLogoutSession}
            className="p-2 rounded-xl text-gray-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            title="Keluar dari akun ini"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {editSuccessMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{editSuccessMessage}</span>
          </div>
        )}

        {/* Action Buttons for Logged In User */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          {currentUserSession.status === 'disetujui' ? (
            <button
              onClick={() => onViewCard(currentUserSession)}
              className="flex-1 py-2.5 px-4 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Buka Kartu Anggota Saya</span>
            </button>
          ) : (
            <div className="flex-1 py-2.5 px-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl text-center">
              Status pendaftaran Anda masih dalam peninjauan pengurus.
            </div>
          )}

          <button
            onClick={() => {
              setIsEditingSelf(!isEditingSelf);
              setEditNama(currentUserSession.nama);
              setEditAlamat(currentUserSession.alamat);
              setEditNoHp(currentUserSession.noHp);
              setEditEmail(currentUserSession.email || '');
              setEditFotoUrl(currentUserSession.fotoUrl || '');
              setEditKtpUrl(currentUserSession.ktpUrl || '');
              setEditKtpName(currentUserSession.ktpName || '');
              setEditKkUrl(currentUserSession.kkUrl || '');
              setEditKkName(currentUserSession.kkName || '');
            }}
            className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-gray-600" />
            <span>{isEditingSelf ? 'Batal Edit' : 'Edit Profil'}</span>
          </button>
        </div>

        {/* Self Edit Form with Documents Revision */}
        {isEditingSelf && (
          <form onSubmit={handleSaveSelf} className="mt-4 pt-4 border-t border-gray-100 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-800">Ubah Data Diri & Revisi Dokumen</h4>
              <span className="text-[10px] text-gray-500 font-medium">Anda dapat memperbaiki foto dokumen KTP & KK</span>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Nama Sesuai KTP</label>
              <input
                type="text"
                required
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Alamat Domisili</label>
              <textarea
                required
                rows={2}
                value={editAlamat}
                onChange={(e) => setEditAlamat(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Nomor HP/WA</label>
                <input
                  type="tel"
                  required
                  value={editNoHp}
                  onChange={(e) => setEditNoHp(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-0.5 flex items-center justify-between">
                  <span>Alamat Email</span>
                  <span className="text-[9px] text-emerald-700 font-normal">Dapat diedit</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@anda.com"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b5d34]"
                />
              </div>
            </div>

            {/* Change Photo Diri input */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-14 rounded-lg overflow-hidden bg-white border border-[#0b5d34] shrink-0">
                  {editFotoUrl ? (
                    <img src={editFotoUrl} alt="Foto Diri" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <span className="block text-[11px] font-bold text-gray-700 mb-1">Revisi / Ganti Foto Diri</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImage(file, { maxDimension: 600, quality: 0.72 });
                          setEditFotoUrl(compressed);
                        } catch {
                          const reader = new FileReader();
                          reader.onload = () => setEditFotoUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }
                    }}
                    className="text-xs text-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* Tempat Upload / Revisi Foto KTP & KK */}
            <div className="pt-1 space-y-2.5">
              <span className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-[#0b5d34]" />
                <span>Revisi / Perbaiki Lampiran Dokumen KTP & Kartu Keluarga (KK)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Revisi Foto KTP / KIA */}
                <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700">Foto KTP / KIA</span>
                    {editKtpUrl ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Terlampir
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Belum Ada
                      </span>
                    )}
                  </div>

                  {editKtpUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-stone-50 h-20 flex items-center justify-center">
                      <img src={editKtpUrl} alt="KTP Lampiran" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setEditKtpUrl('');
                          setEditKtpName('');
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-2xs cursor-pointer"
                        title="Hapus / Reset Foto KTP"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <label className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-[11px] font-semibold text-gray-700 cursor-pointer transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>{editKtpUrl ? 'Ganti / Unggah KTP Baru' : 'Unggah Foto KTP / KIA'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file, { maxDimension: 800, quality: 0.75 });
                            setEditKtpUrl(compressed);
                            setEditKtpName(file.name);
                          } catch {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setEditKtpUrl(reader.result as string);
                              setEditKtpName(file.name);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {editKtpName && (
                    <div className="text-[10px] text-gray-500 truncate font-mono">
                      Berkas: {editKtpName}
                    </div>
                  )}
                </div>

                {/* 2. Revisi Foto Kartu Keluarga (KK) */}
                <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700">Foto Kartu Keluarga (KK)</span>
                    {editKkUrl ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Terlampir
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Belum Ada
                      </span>
                    )}
                  </div>

                  {editKkUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-stone-50 h-20 flex items-center justify-center">
                      <img src={editKkUrl} alt="KK Lampiran" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setEditKkUrl('');
                          setEditKkName('');
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-2xs cursor-pointer"
                        title="Hapus / Reset Foto KK"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <label className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-[11px] font-semibold text-gray-700 cursor-pointer transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>{editKkUrl ? 'Ganti / Unggah KK Baru' : 'Unggah Foto KK'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file, { maxDimension: 800, quality: 0.75 });
                            setEditKkUrl(compressed);
                            setEditKkName(file.name);
                          } catch {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setEditKkUrl(reader.result as string);
                              setEditKkName(file.name);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {editKkName && (
                    <div className="text-[10px] text-gray-500 truncate font-mono">
                      Berkas: {editKkName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-3 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan Profil & Dokumen</span>
            </button>
          </form>
        )}
      </div>

      {/* PRIVACY & ACCESS CONTROL DISPLAY */}
      {isHeadOfFamily ? (
        /* KEPALA KELUARGA ACCESS: BISA LIHAT & EDIT SEMUA ANGGOTA KELUARGA DALAM 1 KK */
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0b5d34]" />
                <span>Anggota Keluarga Saya (KK: {currentUserSession.noKk})</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Sebagai Kepala Keluarga, Anda dapat melihat kartu dan mengedit profil seluruh anggota keluarga Anda.
              </p>
            </div>

            <button
              onClick={onRegisterFamilyMember}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#0b5d34] border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              title="Daftarkan anak atau istri baru ke dalam KK ini"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Anggota</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {familyMembers.map((member) => {
              const isSelf = member.id === currentUserSession.id;
              const subRole = getPeranLabel(member.peranKeluarga);
              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isSelf ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50/70 border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Foto Diri */}
                    <div className="w-12 h-15 rounded-lg overflow-hidden bg-white border border-[#0b5d34] shrink-0 shadow-2xs">
                      {member.fotoUrl ? (
                        <img
                          src={member.fotoUrl}
                          alt={member.nama}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#0b5d34] font-bold text-xs">
                          {getInitials(member.nama)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full bg-white text-emerald-800 border border-emerald-200">
                          {subRole} {isSelf && '(Anda)'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          member.status === 'disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {member.status === 'disetujui' ? 'Disetujui' : 'Menunggu'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 mt-1 truncate">
                        {member.nama}
                      </h4>
                      <div className="text-[11px] font-mono mt-0.5 space-y-0.5">
                        <div className="text-gray-700">
                          <span className="text-gray-500 font-sans">NIK:</span> <strong className="text-[#0b5d34]">{member.nik}</strong>
                        </div>
                        <div className="text-gray-700">
                          <span className="text-gray-500 font-sans">No. KK:</span> <strong className="text-gray-800">{member.noKk}</strong>
                        </div>
                      </div>

                      {/* Action buttons for this family member */}
                      <div className="mt-2.5 flex items-center gap-2">
                        {member.status === 'disetujui' && (
                          <button
                            onClick={() => onViewCard(member)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Lihat Kartu</span>
                          </button>
                        )}
                        <button
                          onClick={() => onEditMember(member)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Data</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ISTRI / ANAK ACCESS: HANYA BISA LIHAT & EDIT DIRINYA SENDIRI */
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center gap-2 text-emerald-900">
            <ShieldCheck className="w-5 h-5 text-[#0b5d34]" />
            <h3 className="text-sm font-bold">Privasi & Keamanan Data Keluarga</h3>
          </div>
          <div className="text-xs text-gray-600 leading-relaxed space-y-1.5 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80">
            <p>
              Anda masuk sebagai <strong>{roleLabel}</strong>. Sesuai kebijakan privasi Yayasan Al Ikhlas Sembilan Satu:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-gray-700">
              <li>Anda hanya dapat melihat dan mengunduh <strong>kartu anggota milik Anda sendiri</strong>.</li>
              <li>Anda hanya dapat mengedit <strong>data diri dan foto diri Anda sendiri</strong>.</li>
              <li>Data anggota lain serta keluarga lain terkunci rapat dan aman dari akses publik.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
