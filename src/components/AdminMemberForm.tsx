import React, { useState } from 'react';
import { Member, MemberStatus, FamilyRole } from '../types';
import { X, CheckCircle2, AlertCircle, Save, Camera, Upload, FileText, Check, Trash2, RotateCcw } from 'lucide-react';
import { getAvailableKepalaKeluarga, checkNikAvailability, restoreMemberFromTempDataLamaAsync, getPeranLabel } from '../utils/storage';
import { SYARI_PHOTOS } from '../data/initialData';
import { compressImage } from '../utils/imageCompressor';

interface AdminMemberFormProps {
  member?: Member | null;
  allMembers: Member[];
  onClose: () => void;
  onSave: (data: Partial<Member>) => Promise<void> | void;
  onRestoreSuccess?: (restored: Member) => void;
}

export const AdminMemberForm: React.FC<AdminMemberFormProps> = ({
  member,
  allMembers,
  onClose,
  onSave,
  onRestoreSuccess,
}) => {
  const isEdit = !!member;

  const [peranKeluarga, setPeranKeluarga] = useState<FamilyRole>(member?.peranKeluarga || 'kepala_keluarga');
  const [selectedHeadId, setSelectedHeadId] = useState<string>(member?.kepalaKeluargaId || '');
  const [nik, setNik] = useState(member?.nik || '');
  const [nama, setNama] = useState(member?.nama || '');
  const [noKk, setNoKk] = useState(member?.noKk || '');
  const [tempatTanggalLahir, setTempatTanggalLahir] = useState(member?.tempatTanggalLahir || '');
  const [alamat, setAlamat] = useState(member?.alamat || '');
  const [jumlahKeluarga, setJumlahKeluarga] = useState<number>(member?.jumlahKeluarga ?? 1);
  const [noHp, setNoHp] = useState(member?.noHp || '');
  const [email, setEmail] = useState(member?.email || '');
  const [regNumber, setRegNumber] = useState(member?.regNumber || '');
  const [status, setStatus] = useState<MemberStatus>(member?.status || 'disetujui');
  const [catatanPenolakan, setCatatanPenolakan] = useState(member?.catatanPenolakan || '');
  const [fotoUrl, setFotoUrl] = useState(member?.fotoUrl || '');
  const [ktpUrl, setKtpUrl] = useState(member?.ktpUrl || '');
  const [ktpName, setKtpName] = useState(member?.ktpName || '');
  const [kkUrl, setKkUrl] = useState(member?.kkUrl || '');
  const [kkName, setKkName] = useState(member?.kkName || '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletedMatchMember, setDeletedMatchMember] = useState<Member | null>(null);
  const [isRestoringDeleted, setIsRestoringDeleted] = useState(false);

  const availableHeads = getAvailableKepalaKeluarga(allMembers).filter(h => h.id !== member?.id);

  const handleHeadChange = (headId: string) => {
    setSelectedHeadId(headId);
    const head = allMembers.find(m => m.id === headId);
    if (head) {
      setNoKk(head.noKk);
      if (!alamat) setAlamat(head.alamat);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, { maxDimension: 600, quality: 0.72 });
      setFotoUrl(compressed);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = () => setFotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'kk') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, { maxDimension: 800, quality: 0.75 });
      if (type === 'ktp') {
        setKtpUrl(compressed);
        setKtpName(file.name);
      } else {
        setKkUrl(compressed);
        setKkName(file.name);
      }
    } catch (err) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (type === 'ktp') {
          setKtpUrl(result);
          setKtpName(file.name);
        } else {
          setKkUrl(result);
          setKkName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNik = nik.trim().replace(/\D/g, '');
    if (!cleanNik || cleanNik.length < 10) {
      setError('Nomor KTP/KIA wajib diisi (minimal 10 digit).');
      return;
    }
    if (!nama.trim()) {
      setError('Nama Lengkap Sesuai KTP wajib diisi.');
      return;
    }
    if (!noKk.trim()) {
      setError('Nomor KK wajib diisi.');
      return;
    }
    if (!alamat.trim()) {
      setError('Alamat wajib diisi.');
      return;
    }
    if (!noHp.trim()) {
      setError('Nomor HP/WA wajib diisi.');
      return;
    }
    if (!fotoUrl) {
      setError('Foto Diri wajib diunggah.');
      return;
    }

    setIsSaving(true);
    try {
      const nikCheck = await checkNikAvailability(cleanNik, member?.id);
      if (nikCheck.status === 'exists_in_members' && nikCheck.member) {
        setError(
          `Nomor KTP/NIK ${cleanNik} sudah terdaftar aktif atas nama "${nikCheck.member.nama}" (ID Anggota: ${nikCheck.member.id}). Nomor KTP harus unik.`
        );
        setIsSaving(false);
        return;
      }

      if (!isEdit && nikCheck.status === 'exists_in_tempdatalama' && nikCheck.member) {
        setDeletedMatchMember(nikCheck.member);
        setIsSaving(false);
        return;
      }

      const headMember = allMembers.find(m => m.id === selectedHeadId);

      await onSave({
        peranKeluarga,
        nik: cleanNik,
        nama: nama.trim(),
        noKk: noKk.trim(),
        kepalaKeluargaId: peranKeluarga !== 'kepala_keluarga' ? selectedHeadId : undefined,
        namaKepalaKeluarga: peranKeluarga !== 'kepala_keluarga' ? headMember?.nama : undefined,
        tempatTanggalLahir: tempatTanggalLahir.trim(),
        alamat: alamat.trim(),
        jumlahKeluarga: peranKeluarga === 'kepala_keluarga' ? (Number(jumlahKeluarga) || 1) : 0,
        noHp: noHp.trim(),
        email: email.trim() || undefined,
        regNumber: regNumber.trim() || undefined,
        fotoUrl,
        ktpUrl: ktpUrl || undefined,
        ktpName: ktpName || undefined,
        kkUrl: kkUrl || undefined,
        kkName: kkName || undefined,
        status,
        catatanPenolakan: status === 'ditolak' ? catatanPenolakan.trim() : undefined,
      });
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan data anggota.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmRestoreDeleted = async () => {
    if (!deletedMatchMember) return;
    setIsRestoringDeleted(true);
    setError(null);
    try {
      const restored = await restoreMemberFromTempDataLamaAsync(deletedMatchMember, {
        status: status || 'disetujui',
      });
      setDeletedMatchMember(null);
      onRestoreSuccess?.(restored);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memulihkan data dari tempdatalama.');
    } finally {
      setIsRestoringDeleted(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-4 sm:p-7 max-h-[92vh] overflow-y-auto border-t-4 border-[#0b5d34]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h2 className="text-xl font-bold text-[#0b5d34]">
            {isEdit ? 'Edit Data Anggota (Admin)' : 'Tambah Anggota Baru (Admin)'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Status Approval
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('disetujui')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  status === 'disetujui'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                Disetujui
              </button>
              <button
                type="button"
                onClick={() => setStatus('menunggu')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  status === 'menunggu'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                Menunggu
              </button>
              <button
                type="button"
                onClick={() => setStatus('ditolak')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  status === 'ditolak'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                Ditolak
              </button>
            </div>
          </div>

          {/* Peran Keluarga */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Peran dalam Keluarga
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPeranKeluarga('kepala_keluarga')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  peranKeluarga === 'kepala_keluarga'
                    ? 'bg-[#0b5d34] text-white border-[#0b5d34]'
                    : 'bg-stone-50 text-gray-700 border-gray-200'
                }`}
              >
                Kepala Keluarga
              </button>
              <button
                type="button"
                onClick={() => setPeranKeluarga('istri')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  peranKeluarga === 'istri'
                    ? 'bg-[#0b5d34] text-white border-[#0b5d34]'
                    : 'bg-stone-50 text-gray-700 border-gray-200'
                }`}
              >
                Istri
              </button>
              <button
                type="button"
                onClick={() => setPeranKeluarga('anak')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  peranKeluarga === 'anak'
                    ? 'bg-[#0b5d34] text-white border-[#0b5d34]'
                    : 'bg-stone-50 text-gray-700 border-gray-200'
                }`}
              >
                Anak
              </button>
            </div>
          </div>

          {/* Select Kepala Keluarga if Istri or Anak */}
          {peranKeluarga !== 'kepala_keluarga' && (
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Pilih Kepala Keluarga (Relasi KK)
              </label>
              <select
                value={selectedHeadId}
                onChange={(e) => handleHeadChange(e.target.value)}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-gray-900"
              >
                <option value="">-- Pilih Kepala Keluarga --</option>
                {availableHeads.map(head => (
                  <option key={head.id} value={head.id}>
                    {head.nama} (KK: {head.noKk})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Foto Diri Upload */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-18 rounded-lg overflow-hidden bg-white border border-[#0b5d34] shrink-0">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="block text-xs font-bold text-gray-700 mb-1">Foto Diri untuk Kartu</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="text-xs text-gray-600 block"
                />
              </div>
            </div>

            {/* Syar'i photo presets for admin */}
            <div className="pt-2 border-t border-stone-200">
              <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
                Gunakan Pas Foto Syar'i Contoh:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setFotoUrl(SYARI_PHOTOS.kepalaKeluarga)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-emerald-900 font-medium truncate cursor-pointer text-left"
                >
                  👳 Pria Berpeci
                </button>
                <button
                  type="button"
                  onClick={() => setFotoUrl(SYARI_PHOTOS.istri)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-emerald-900 font-medium truncate cursor-pointer text-left"
                >
                  🧕 Muslimah Hijab
                </button>
                <button
                  type="button"
                  onClick={() => setFotoUrl(SYARI_PHOTOS.anakLaki)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-emerald-900 font-medium truncate cursor-pointer text-left"
                >
                  👦 Anak Putra (10 Thn)
                </button>
                <button
                  type="button"
                  onClick={() => setFotoUrl(SYARI_PHOTOS.anakPerempuan)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-emerald-900 font-medium truncate cursor-pointer text-left"
                >
                  👧 Anak Putri (10 Thn)
                </button>
              </div>
            </div>
          </div>

          {/* Dokumen Lampiran KTP & KK (Upload / Revisi) */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
            <span className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0b5d34]" />
              <span>Dokumen Lampiran KTP / KIA & Kartu Keluarga (KK)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* KTP / KIA */}
              <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700">Foto KTP / KIA</span>
                  {ktpUrl ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      ✓ Ada
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Kosong</span>
                  )}
                </div>
                {ktpUrl && (
                  <div className="relative rounded overflow-hidden border border-gray-200 bg-stone-50 h-16 flex items-center justify-center">
                    <img src={ktpUrl} alt="KTP" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setKtpUrl('');
                        setKtpName('');
                      }}
                      className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <label className="flex items-center justify-center gap-1 py-1 px-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-semibold text-gray-700 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{ktpUrl ? 'Ganti Foto KTP' : 'Unggah Foto KTP'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleDocumentUpload(e, 'ktp')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Kartu Keluarga */}
              <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700">Foto KK</span>
                  {kkUrl ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      ✓ Ada
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Kosong</span>
                  )}
                </div>
                {kkUrl && (
                  <div className="relative rounded overflow-hidden border border-gray-200 bg-stone-50 h-16 flex items-center justify-center">
                    <img src={kkUrl} alt="KK" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setKkUrl('');
                        setKkName('');
                      }}
                      className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <label className="flex items-center justify-center gap-1 py-1 px-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-semibold text-gray-700 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{kkUrl ? 'Ganti Foto KK' : 'Unggah Foto KK'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleDocumentUpload(e, 'kk')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* NIK & No KK */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nomor KTP/KIA (NIK) *
              </label>
              <input
                type="text"
                required
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nomor KK *
              </label>
              <input
                type="text"
                required
                value={noKk}
                onChange={(e) => setNoKk(e.target.value.replace(/\D/g, '').slice(0, 16))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          {/* Nama Sesuai KTP */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nama Lengkap Sesuai KTP *
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
            />
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Alamat Lengkap *
            </label>
            <textarea
              required
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none"
            />
          </div>

          {/* No HP & Tempat Tanggal Lahir */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                No. Telp / HP *
              </label>
              <input
                type="tel"
                required
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Tempat & Tgl Lahir
              </label>
              <input
                type="text"
                value={tempatTanggalLahir}
                onChange={(e) => setTempatTanggalLahir(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Email Anggota */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
              <span>Alamat Email (Opsional)</span>
              <span className="text-[10px] text-gray-400 font-normal">Dapat diedit &amp; diperbarui kapan saja</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contoh: anggota@gmail.com"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 px-4 bg-[#0b5d34] hover:bg-[#084d2a] disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan & Memverifikasi...' : isEdit ? 'Simpan Perubahan' : 'Tambah Anggota'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      </div>

      {/* Modal Konfirmasi Pemulihan Data dari tempdatalama */}
      {deletedMatchMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border-t-4 border-[#0b5d34] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Data Pernah Terdaftar di Sistem
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Nomor KTP <strong>{deletedMatchMember.nik}</strong> pernah sudah terdaftar atas nama{' '}
                  <strong className="text-[#0b5d34]">"{deletedMatchMember.nama}"</strong> (ID:{' '}
                  <strong>{deletedMatchMember.id}</strong>, {getPeranLabel(deletedMatchMember.peranKeluarga)}).
                </p>
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-800">
              Apakah Anda ingin mengembalikan kembali data yang sudah terhapus tersebut dari tabel <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[#0b5d34]">tempdatalama</code> ke tabel <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[#0b5d34]">members</code>?
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isRestoringDeleted}
                onClick={handleConfirmRestoreDeleted}
                className="flex-1 py-2.5 px-4 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className={`w-4 h-4 ${isRestoringDeleted ? 'animate-spin' : ''}`} />
                <span>{isRestoringDeleted ? 'Memulihkan...' : 'Ya, Kembalikan Data'}</span>
              </button>
              <button
                type="button"
                disabled={isRestoringDeleted}
                onClick={() => setDeletedMatchMember(null)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
