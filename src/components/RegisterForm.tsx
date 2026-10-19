import React, { useState } from 'react';
import { Member } from '../types';
import { FileUp, CheckCircle2, AlertCircle, Info, Sparkles, X, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RegisterFormProps {
  onSubmit: (memberData: Omit<Member, 'id' | 'tanggalDaftar' | 'status'>) => Member;
  onSuccessRedirect: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  onSuccessRedirect,
}) => {
  const [nama, setNama] = useState('');
  const [tempatTanggalLahir, setTempatTanggalLahir] = useState('');
  const [alamat, setAlamat] = useState('');
  const [jumlahKeluarga, setJumlahKeluarga] = useState<number>(1);
  const [noHp, setNoHp] = useState('');
  const [email, setEmail] = useState('');

  // File uploads
  const [ktpData, setKtpData] = useState<{ url: string; name: string } | null>(null);
  const [kkData, setKkData] = useState<{ url: string; name: string } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [submittedMember, setSubmittedMember] = useState<Member | null>(null);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'ktp' | 'kk'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setError(`Ukuran file ${type.toUpperCase()} melebihi batas 4 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (type === 'ktp') {
        setKtpData({ url: result, name: file.name });
      } else {
        setKkData({ url: result, name: file.name });
      }
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFillDemo = () => {
    setNama('Bambang Setiawan');
    setTempatTanggalLahir('Denpasar, 15 Juli 1984');
    setAlamat('Perumahan Taman Dalung Asri Blok D No. 18, Desa Dalung, Badung');
    setJumlahKeluarga(4);
    setNoHp('081238994477');
    setEmail('bambang.setiawan@gmail.com');
    setKtpData({
      url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
      name: 'ktp_bambang_setiawan.jpg',
    });
    setKkData({
      url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80',
      name: 'kk_keluarga_bambang.pdf',
    });
    setError(null);
  };

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
      setError('Nomor Telp/HP minimal 8 digit dan valid.');
      return;
    }

    try {
      const created = onSubmit({
        nama: nama.trim(),
        tempatTanggalLahir: tempatTanggalLahir.trim(),
        alamat: alamat.trim(),
        jumlahKeluarga: Number(jumlahKeluarga) || 0,
        noHp: noHp.trim(),
        email: email.trim() || undefined,
        ktpUrl: ktpData?.url,
        ktpName: ktpData?.name,
        kkUrl: kkData?.url,
        kkName: kkData?.name,
      });

      setSubmittedMember(created);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.5 },
        });
      } catch (err) {
        // ignore
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan pendaftaran.');
    }
  };

  if (submittedMember) {
    const last4 = submittedMember.noHp.replace(/\D/g, '').slice(-4);
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-4 pb-28">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Pendaftaran Berhasil Dikirim!
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
            Data pendaftaran Anda telah berhasil tercatat dalam sistem Yayasan Al Ikhlas Sembilan Satu.
          </p>

          <div className="my-6 p-4 bg-red-50/60 rounded-2xl border border-red-100 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-red-100/60">
              <span className="text-gray-500">ID Registrasi</span>
              <span className="font-bold text-[#83141a] text-sm">{submittedMember.id}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-red-100/60">
              <span className="text-gray-500">Nama Terdaftar</span>
              <span className="font-bold text-gray-800">{submittedMember.nama}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-red-100/60">
              <span className="text-gray-500">Status Saat Ini</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase tracking-wider text-[10px]">
                Menunggu ACC Pengurus
              </span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-500">PIN Kartu Anda Nanti</span>
              <span className="font-extrabold text-stone-900 font-mono tracking-widest text-sm bg-white px-2 py-0.5 rounded border border-gray-200">
                {last4}
              </span>
            </div>
          </div>

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/80 text-amber-900 text-xs text-left flex gap-2.5 items-start mb-6">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Pemberitahuan:</strong> Pengurus Yayasan akan segera memverifikasi data Anda. Begitu disetujui, Anda dapat langsung mencetak kartu anggota dengan memasukkan 4 digit terakhir nomor HP Anda (<strong>{last4}</strong>).
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSuccessRedirect}
              className="flex-1 py-3 px-4 bg-[#83141a] hover:bg-[#6c1015] text-white font-semibold rounded-xl shadow-md transition-all cursor-pointer text-sm"
            >
              Kembali ke Daftar Anggota
            </button>
            <button
              onClick={() => {
                setSubmittedMember(null);
                setNama('');
                setTempatTanggalLahir('');
                setAlamat('');
                setJumlahKeluarga(1);
                setNoHp('');
                setEmail('');
                setKtpData(null);
                setKkData(null);
              }}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all cursor-pointer text-sm"
            >
              Daftar Anggota Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-2 pb-28">
      {/* Card Header matching Screenshot_2026-10-19-10-04-06-030.jpg */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-100">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#83141a]">
              Tambah Anggota
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Formulir Pendaftaran Yayasan Al Ikhlas Sembilan Satu
            </p>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#83141a] bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
            title="Isi contoh data untuk kemudahan demo"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Isi Contoh</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nama Kepala Keluarga * */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nama Kepala Keluarga <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Masukkan nama lengkap kepala keluarga"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all"
            />
          </div>

          {/* Tempat & Tanggal Lahir * */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tempat & Tanggal Lahir <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={tempatTanggalLahir}
              onChange={(e) => setTempatTanggalLahir(e.target.value)}
              placeholder="Contoh: Denpasar, 17 Agustus 1980"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all"
            />
          </div>

          {/* Alamat * */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Alamat <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Masukkan alamat lengkap tempat tinggal saat ini"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all resize-none"
            />
          </div>

          {/* Jumlah Keluarga * */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Jumlah Keluarga <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={25}
              required
              value={jumlahKeluarga}
              onChange={(e) => setJumlahKeluarga(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="1"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Jumlah anggota keluarga/tanggungan selain kepala keluarga.
            </span>
          </div>

          {/* Telp / HP * */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Telp / HP <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={noHp}
              onChange={(e) => setNoHp(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all"
            />
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#83141a] font-medium">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>Penting:</strong> 4 digit terakhir nomor ini akan menjadi password akses kartu anggota Anda.
              </span>
            </div>
          </div>

          {/* Email Aktif */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Email Aktif
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com (opsional)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a] transition-all"
            />
          </div>

          {/* Lampiran KTP */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lampiran KTP (foto/PDF, maks 4 MB)
            </label>
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="px-3.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                <FileUp className="w-3.5 h-3.5" />
                <span>Pilih File</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'ktp')}
                  className="hidden"
                />
              </label>
              <div className="text-xs text-gray-500 truncate flex-1">
                {ktpData ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {ktpData.name}
                  </span>
                ) : (
                  'Tidak ada file yang dipilih'
                )}
              </div>
              {ktpData && (
                <button
                  type="button"
                  onClick={() => setKtpData(null)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lampiran KK */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lampiran KK (foto/PDF, maks 4 MB)
            </label>
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="px-3.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                <FileUp className="w-3.5 h-3.5" />
                <span>Pilih File</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'kk')}
                  className="hidden"
                />
              </label>
              <div className="text-xs text-gray-500 truncate flex-1">
                {kkData ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {kkData.name}
                  </span>
                ) : (
                  'Tidak ada file yang dipilih'
                )}
              </div>
              {kkData && (
                <button
                  type="button"
                  onClick={() => setKkData(null)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3.5 px-5 bg-[#83141a] hover:bg-[#6c1015] active:scale-[0.99] text-white font-semibold rounded-xl shadow-md transition-all cursor-pointer text-sm"
            >
              Kirim Pendaftaran
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
