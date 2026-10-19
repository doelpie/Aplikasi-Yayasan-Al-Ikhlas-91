import React, { useState } from 'react';
import { Member, MemberStatus, FamilyRole } from '../types';
import { X, CheckCircle2, AlertCircle, Save, Camera } from 'lucide-react';
import { getAvailableKepalaKeluarga } from '../utils/storage';
import { SYARI_PHOTOS } from '../data/initialData';

interface AdminMemberFormProps {
  member?: Member | null;
  allMembers: Member[];
  onClose: () => void;
  onSave: (data: Partial<Member>) => void;
}

export const AdminMemberForm: React.FC<AdminMemberFormProps> = ({
  member,
  allMembers,
  onClose,
  onSave,
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
  const [error, setError] = useState<string | null>(null);

  const availableHeads = getAvailableKepalaKeluarga(allMembers).filter(h => h.id !== member?.id);

  const handleHeadChange = (headId: string) => {
    setSelectedHeadId(headId);
    const head = allMembers.find(m => m.id === headId);
    if (head) {
      setNoKk(head.noKk);
      if (!alamat) setAlamat(head.alamat);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nik.trim() || nik.length < 10) {
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

    const headMember = allMembers.find(m => m.id === selectedHeadId);

    onSave({
      peranKeluarga,
      nik: nik.trim().replace(/\D/g, ''),
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
      status,
      catatanPenolakan: status === 'ditolak' ? catatanPenolakan.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto border-t-4 border-[#0b5d34]"
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

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-[#0b5d34] hover:bg-[#084d2a] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEdit ? 'Simpan Perubahan' : 'Tambah Anggota'}</span>
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
    </div>
  );
};
