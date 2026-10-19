import React, { useState } from 'react';
import { Member, MemberStatus } from '../types';
import { X, CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface AdminMemberFormProps {
  member?: Member | null; // if null, mode is Add
  onClose: () => void;
  onSave: (data: Partial<Member>) => void;
}

export const AdminMemberForm: React.FC<AdminMemberFormProps> = ({
  member,
  onClose,
  onSave,
}) => {
  const isEdit = !!member;

  const [nama, setNama] = useState(member?.nama || '');
  const [tempatTanggalLahir, setTempatTanggalLahir] = useState(member?.tempatTanggalLahir || '');
  const [alamat, setAlamat] = useState(member?.alamat || '');
  const [jumlahKeluarga, setJumlahKeluarga] = useState<number>(member?.jumlahKeluarga ?? 1);
  const [noHp, setNoHp] = useState(member?.noHp || '');
  const [email, setEmail] = useState(member?.email || '');
  const [regNumber, setRegNumber] = useState(member?.regNumber || '');
  const [status, setStatus] = useState<MemberStatus>(member?.status || 'disetujui');
  const [catatanPenolakan, setCatatanPenolakan] = useState(member?.catatanPenolakan || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nama.trim()) {
      setError('Nama Kepala Keluarga wajib diisi.');
      return;
    }
    if (!tempatTanggalLahir.trim()) {
      setError('Tempat & Tanggal Lahir wajib diisi.');
      return;
    }
    if (!alamat.trim()) {
      setError('Alamat wajib diisi.');
      return;
    }
    const cleanHp = noHp.replace(/\D/g, '');
    if (cleanHp.length < 8) {
      setError('Nomor HP tidak valid.');
      return;
    }

    onSave({
      nama: nama.trim(),
      tempatTanggalLahir: tempatTanggalLahir.trim(),
      alamat: alamat.trim(),
      jumlahKeluarga: Number(jumlahKeluarga) || 0,
      noHp: noHp.trim(),
      email: email.trim() || undefined,
      regNumber: regNumber.trim() || undefined,
      status,
      catatanPenolakan: status === 'ditolak' ? catatanPenolakan.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h2 className="text-xl font-bold text-[#83141a]">
            {isEdit ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Status Pendaftaran
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('disetujui')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  status === 'disetujui'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Disetujui
              </button>
              <button
                type="button"
                onClick={() => setStatus('menunggu')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  status === 'menunggu'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                Menunggu
              </button>
              <button
                type="button"
                onClick={() => setStatus('ditolak')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  status === 'ditolak'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                Ditolak
              </button>
            </div>
          </div>

          {/* Catatan Penolakan (if ditolak) */}
          {status === 'ditolak' && (
            <div>
              <label className="block text-xs font-semibold text-rose-700 mb-1">
                Alasan Penolakan
              </label>
              <input
                type="text"
                value={catatanPenolakan}
                onChange={(e) => setCatatanPenolakan(e.target.value)}
                placeholder="Contoh: Dokumen KTP tidak jelas / bukan domisili Dalung"
                className="w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs text-rose-900 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          {/* Nama */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nama Kepala Keluarga *
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20"
            />
          </div>

          {/* Tempat Tanggal Lahir */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tempat & Tanggal Lahir *
            </label>
            <input
              type="text"
              required
              value={tempatTanggalLahir}
              onChange={(e) => setTempatTanggalLahir(e.target.value)}
              placeholder="Contoh: Lamongan, 04 Mar 1987"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20"
            />
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Alamat Lengkap *
            </label>
            <textarea
              required
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 resize-none"
            />
          </div>

          {/* Grid 2 cols for Jumlah Keluarga & No HP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Jumlah Keluarga *
              </label>
              <input
                type="number"
                min={0}
                required
                value={jumlahKeluarga}
                onChange={(e) => setJumlahKeluarga(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                No. Telp / HP *
              </label>
              <input
                type="tel"
                required
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20"
              />
            </div>
          </div>

          {/* Nomor Registrasi Resmi */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nomor Registrasi / No. Anggota Resmi
            </label>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="Contoh: 1616/YMWM13/II/2017 & L.065"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Email (Opsional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-[#83141a] hover:bg-[#6c1015] text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEdit ? 'Simpan Perubahan' : 'Tambah Anggota'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
