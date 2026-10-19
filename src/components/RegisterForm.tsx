import React, { useState, useEffect } from 'react';
import { Member, FamilyRole } from '../types';
import { FileUp, CheckCircle2, AlertCircle, Info, Sparkles, X, Camera, User, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAvailableKepalaKeluarga, getPeranLabel } from '../utils/storage';
import { SYARI_PHOTOS } from '../data/initialData';

interface RegisterFormProps {
  allMembers: Member[];
  currentUserSession?: Member | null;
  onSubmit: (memberData: Omit<Member, 'id' | 'tanggalDaftar' | 'status'>) => Member;
  onSuccessRedirect: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  allMembers,
  currentUserSession,
  onSubmit,
  onSuccessRedirect,
}) => {
  // If logged in as Kepala Keluarga, default role can be Istri or Anak
  const isHeadOfFamilyLoggedIn = currentUserSession?.peranKeluarga === 'kepala_keluarga';

  const [peranKeluarga, setPeranKeluarga] = useState<FamilyRole>(
    isHeadOfFamilyLoggedIn ? 'anak' : 'kepala_keluarga'
  );
  const [selectedKepalaKeluargaId, setSelectedKepalaKeluargaId] = useState<string>(
    currentUserSession?.peranKeluarga === 'kepala_keluarga' ? currentUserSession.id : ''
  );

  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [noKk, setNoKk] = useState(currentUserSession?.noKk || '');
  const [tempatTanggalLahir, setTempatTanggalLahir] = useState('');
  const [alamat, setAlamat] = useState(currentUserSession?.alamat || '');
  const [jumlahKeluarga, setJumlahKeluarga] = useState<number>(1);
  const [noHp, setNoHp] = useState('');
  const [email, setEmail] = useState('');

  // Foto diri / pas foto (wajib untuk kartu)
  const [fotoData, setFotoData] = useState<{ url: string; name: string } | null>(null);

  // Lampiran dokumen KTP & KK (opsional)
  const [ktpData, setKtpData] = useState<{ url: string; name: string } | null>(null);
  const [kkData, setKkData] = useState<{ url: string; name: string } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [submittedMember, setSubmittedMember] = useState<Member | null>(null);

  // Available Kepala Keluarga in the system
  const availableHeads = getAvailableKepalaKeluarga(allMembers);

  // When selected head of family changes, auto-fill No. KK and Alamat
  useEffect(() => {
    if (peranKeluarga !== 'kepala_keluarga' && selectedKepalaKeluargaId) {
      const head = allMembers.find(m => m.id === selectedKepalaKeluargaId);
      if (head) {
        setNoKk(head.noKk);
        if (!alamat) {
          setAlamat(head.alamat);
        }
      }
    }
  }, [selectedKepalaKeluargaId, peranKeluarga, allMembers, alamat]);

  // Handle Role change
  const handleRoleChange = (role: FamilyRole) => {
    setPeranKeluarga(role);
    setError(null);
    if (role === 'kepala_keluarga') {
      setSelectedKepalaKeluargaId('');
      if (!isHeadOfFamilyLoggedIn) {
        setNoKk('');
      }
      setFotoData({ url: SYARI_PHOTOS.kepalaKeluarga, name: 'foto_syari_kepala_keluarga.jpg' });
    } else if (role === 'istri') {
      setFotoData({ url: SYARI_PHOTOS.istri, name: 'foto_syari_istri_muslimah.jpg' });
      if (currentUserSession?.peranKeluarga === 'kepala_keluarga') {
        setSelectedKepalaKeluargaId(currentUserSession.id);
        setNoKk(currentUserSession.noKk);
      } else if (availableHeads.length > 0 && !selectedKepalaKeluargaId) {
        setSelectedKepalaKeluargaId(availableHeads[0].id);
        setNoKk(availableHeads[0].noKk);
      }
    } else {
      setFotoData({ url: SYARI_PHOTOS.anakLaki, name: 'foto_syari_anak_10_tahun.jpg' });
      if (currentUserSession?.peranKeluarga === 'kepala_keluarga') {
        setSelectedKepalaKeluargaId(currentUserSession.id);
        setNoKk(currentUserSession.noKk);
      } else if (availableHeads.length > 0 && !selectedKepalaKeluargaId) {
        setSelectedKepalaKeluargaId(availableHeads[0].id);
        setNoKk(availableHeads[0].noKk);
      }
    }
  };

  // File and Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran foto diri maksimal 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFotoData({ url: reader.result as string, name: file.name });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'ktp' | 'kk'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // Demo fill helper with genuine Syar'i Photos
  const handleFillDemo = () => {
    if (peranKeluarga === 'kepala_keluarga') {
      setNik('5103051408860012');
      setNama('Achmad Zaini Muhibbin');
      setNoKk('5103052809110045');
      setTempatTanggalLahir('Banyuwangi, 14 Agustus 1986');
      setAlamat('Jl. Raya Dalung No. 112 Banjar Kaja Dalung, Kuta Utara');
      setJumlahKeluarga(3);
      setNoHp('081338877112');
      setEmail('zaini.muhibbin@gmail.com');
      setFotoData({
        url: SYARI_PHOTOS.kepalaKeluarga,
        name: 'foto_syari_kepala_keluarga.jpg',
      });
    } else if (peranKeluarga === 'istri') {
      setNik('5103056004890015');
      setNama('Fatimah Az Zahra');
      setTempatTanggalLahir('Denpasar, 20 April 1989');
      setNoHp('081338877113');
      setFotoData({
        url: SYARI_PHOTOS.istri,
        name: 'foto_syari_istri_muslimah.jpg',
      });
      if (availableHeads.length > 0) {
        setSelectedKepalaKeluargaId(availableHeads[0].id);
        setNoKk(availableHeads[0].noKk);
        setAlamat(availableHeads[0].alamat);
      }
    } else {
      // Anak berumur 10 tahun
      setNik('5103052510160018');
      setNama('Muhammad Ilham Pratama');
      setTempatTanggalLahir('Badung, 25 Oktober 2016'); // 10 tahun
      setNoHp('081338877114');
      setFotoData({
        url: SYARI_PHOTOS.anakLaki,
        name: 'foto_syari_anak_10_tahun.jpg',
      });
      if (availableHeads.length > 0) {
        setSelectedKepalaKeluargaId(availableHeads[0].id);
        setNoKk(availableHeads[0].noKk);
        setAlamat(availableHeads[0].alamat);
      }
    }
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Wajib: NIK
    const cleanNik = nik.trim().replace(/\D/g, '');
    if (cleanNik.length < 10) {
      setError(`Nomor ${peranKeluarga === 'anak' ? 'KTP / KIA' : 'KTP (NIK)'} wajib diisi dengan benar.`);
      return;
    }

    // Validasi Wajib: Nama Sesuai KTP
    if (!nama.trim()) {
      setError('Nama Lengkap Sesuai KTP wajib diisi.');
      return;
    }

    // Validasi Wajib: Alamat Lengkap
    if (!alamat.trim()) {
      setError('Alamat Lengkap wajib diisi.');
      return;
    }

    // Validasi Wajib: No HP / WA
    const cleanHp = noHp.replace(/\D/g, '');
    if (cleanHp.length < 8) {
      setError('Nomor HP / WhatsApp wajib diisi (minimal 8 digit).');
      return;
    }

    // Validasi Wajib: Foto Diri
    if (!fotoData?.url) {
      setError('Foto Diri / Pas Foto wajib diunggah untuk ditampilkan pada kartu anggota.');
      return;
    }

    // Validasi Kepala Keluarga & No KK
    let linkedHeadName: string | undefined;
    if (peranKeluarga !== 'kepala_keluarga') {
      if (!selectedKepalaKeluargaId) {
        setError('Wajib memilih Kepala Keluarga terlebih dahulu agar nomor KK dapat terhubung.');
        return;
      }
      const head = allMembers.find(m => m.id === selectedKepalaKeluargaId);
      if (!head) {
        setError('Data Kepala Keluarga yang dipilih tidak valid.');
        return;
      }
      linkedHeadName = head.nama;
    } else {
      if (!noKk.trim()) {
        setError('Nomor Kartu Keluarga (KK) wajib diisi untuk Kepala Keluarga.');
        return;
      }
    }

    try {
      const created = onSubmit({
        nik: cleanNik,
        nama: nama.trim(),
        alamat: alamat.trim(),
        noHp: noHp.trim(),
        noKk: noKk.trim(),
        peranKeluarga,
        kepalaKeluargaId: peranKeluarga !== 'kepala_keluarga' ? selectedKepalaKeluargaId : undefined,
        namaKepalaKeluarga: linkedHeadName,
        tempatTanggalLahir: tempatTanggalLahir.trim() || 'Dalung, Bali',
        jumlahKeluarga: peranKeluarga === 'kepala_keluarga' ? (Number(jumlahKeluarga) || 1) : 0,
        email: email.trim() || undefined,
        fotoUrl: fotoData.url,
        fotoName: fotoData.name,
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
    const roleText = getPeranLabel(submittedMember.peranKeluarga);
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-4 pb-28">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-100 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center mx-auto mb-4 border border-emerald-300">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Pendaftaran Berhasil Dikirim!
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
            Data pendaftaran anggota <strong>{roleText}</strong> telah berhasil masuk ke sistem Yayasan Al Ikhlas Sembilan Satu.
          </p>

          {/* Member Card Preview Box */}
          <div className="my-6 p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 text-left space-y-2 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-200/60">
              {submittedMember.fotoUrl && (
                <img
                  src={submittedMember.fotoUrl}
                  alt={submittedMember.nama}
                  className="w-12 h-14 object-cover rounded-lg border border-[#0b5d34]"
                />
              )}
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                  {roleText}
                </span>
                <h4 className="font-bold text-sm text-gray-900 mt-1">{submittedMember.nama}</h4>
                <p className="text-[11px] text-gray-600">ID: {submittedMember.id}</p>
              </div>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-emerald-200/60">
              <span className="text-gray-600">No. KK</span>
              <span className="font-bold font-mono text-gray-900">{submittedMember.noKk}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-emerald-200/60">
              <span className="text-gray-600">Status Permohonan</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase tracking-wider text-[10px]">
                Menunggu Persetujuan
              </span>
            </div>

            <div className="pt-2">
              <span className="text-gray-600 block">Kunci Akses Kartu:</span>
              <span className="text-[11px] font-medium text-emerald-900">
                Gunakan <strong>6 digit terakhir nomor KTP/KIA</strong> Anda saat membuka kartu anggota resmi setelah disetujui.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSuccessRedirect}
              className="flex-1 py-3 px-4 bg-[#0b5d34] hover:bg-[#084d2a] text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer text-sm"
            >
              Kembali ke Daftar Anggota
            </button>
            <button
              onClick={() => {
                setSubmittedMember(null);
                setNik('');
                setNama('');
                setTempatTanggalLahir('');
                setAlamat('');
                setNoHp('');
                setEmail('');
                setFotoData(null);
                setKtpData(null);
                setKkData(null);
              }}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition-all cursor-pointer text-sm"
            >
              Daftar Anggota Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  const idLabel = peranKeluarga === 'anak' ? 'Nomor KTP atau KIA (Kartu Identitas Anak)' : 'Nomor KTP (NIK 16 Digit)';

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-2 pb-28">
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-100">
        <div className="pb-4 border-b border-gray-100">
          <h2 className="text-xl sm:text-2xl font-bold text-[#0b5d34]">
            Tambah Anggota
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Formulir Pendaftaran Yayasan Al Ikhlas Sembilan Satu (NU)
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Status Hubungan Keluarga: Kepala Keluarga, Istri, Anak */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">
              Status Hubungan dalam Keluarga <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange('kepala_keluarga')}
                disabled={isHeadOfFamilyLoggedIn}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                  peranKeluarga === 'kepala_keluarga'
                    ? 'bg-[#0b5d34] text-white border-[#0b5d34] shadow-xs'
                    : 'bg-stone-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                } ${isHeadOfFamilyLoggedIn ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                Kepala Keluarga
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('istri')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                  peranKeluarga === 'istri'
                    ? 'bg-[#0b5d34] text-white border-[#0b5d34] shadow-xs'
                    : 'bg-stone-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                } cursor-pointer`}
              >
                Istri
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('anak')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                  peranKeluarga === 'anak'
                    ? 'bg-[#0b5d34] text-white border-[#0b5d34] shadow-xs'
                    : 'bg-stone-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                } cursor-pointer`}
              >
                Anak
              </button>
            </div>
          </div>

          {/* Jika Istri atau Anak: Wajib memilih Kepala Keluarga */}
          {peranKeluarga !== 'kepala_keluarga' && (
            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold text-emerald-900">
                Pilih Kepala Keluarga Terdaftar <span className="text-red-500">*</span>
              </label>

              {availableHeads.length > 0 ? (
                <div>
                  <select
                    value={selectedKepalaKeluargaId}
                    onChange={(e) => setSelectedKepalaKeluargaId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0b5d34]"
                  >
                    <option value="">-- Pilih Kepala Keluarga --</option>
                    {availableHeads.map((head) => (
                      <option key={head.id} value={head.id}>
                        {head.nama} (No. KK: {head.noKk})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Nomor Kartu Keluarga (KK) dan Alamat akan otomatis terhubung dengan Kepala Keluarga yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  Belum ada Kepala Keluarga yang terdaftar/disetujui. Silakan daftarkan <strong>Kepala Keluarga</strong> terlebih dahulu agar nomor KK dapat terhubung.
                </div>
              )}
            </div>
          )}

          {/* Nomor KK (Nomor Kartu Keluarga) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nomor Kartu Keluarga (KK) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              readOnly={peranKeluarga !== 'kepala_keluarga'}
              value={noKk}
              onChange={(e) => setNoKk(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="16 digit nomor Kartu Keluarga"
              className={`w-full px-4 py-3 border rounded-xl text-sm font-mono text-gray-900 transition-all ${
                peranKeluarga !== 'kepala_keluarga'
                  ? 'bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-50 border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34]'
              }`}
            />
          </div>

          {/* Nomor KTP atau KIA (Wajib) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {idLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={16}
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder={`Masukkan 16 digit nomor ${peranKeluarga === 'anak' ? 'KTP atau KIA' : 'KTP'}`}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
            />
            <span className="text-[11px] text-emerald-800 font-medium mt-1 block">
              6 digit terakhir nomor ini akan digunakan sebagai PIN untuk membuka Kartu Anggota.
            </span>
          </div>

          {/* Nama Lengkap Sesuai KTP (Wajib) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nama Lengkap Sesuai KTP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Masukkan nama lengkap sesuai identitas resmi"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
            />
          </div>

          {/* Upload Foto Diri / Pas Foto (Wajib untuk kartu anggota) */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-emerald-950">
                Upload Foto Diri / Pas Foto (Wajib untuk Kartu Anggota) <span className="text-red-500">*</span>
              </label>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Preview Avatar Box */}
              <div className="w-18 h-22 rounded-xl bg-white border-2 border-dashed border-[#0b5d34] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {fotoData ? (
                  <img
                    src={fotoData.url}
                    alt="Preview Foto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-[#0b5d34]/60" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{fotoData ? 'Ganti / Upload Foto Sendiri' : 'Upload Foto Sendiri'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Format JPG/PNG, syar'i & menutup aurat. Foto ini akan otomatis terpasang pada Kartu Anggota.
                </p>
                {fotoData && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="truncate">{fotoData.name}</span>
                  </div>
                )}

                {/* Quick Syar'i Presets */}
                <div className="pt-2 border-t border-emerald-200/70">
                  <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
                    Atau Pilih Contoh Pas Foto Syar'i:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setFotoData({ url: SYARI_PHOTOS.kepalaKeluarga, name: 'pas_foto_pria_peci.jpg' })}
                      className="px-2 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 font-medium text-left truncate cursor-pointer"
                    >
                      👳 Pria Muslim (Peci)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoData({ url: SYARI_PHOTOS.istri, name: 'pas_foto_muslimah_hijab.jpg' })}
                      className="px-2 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 font-medium text-left truncate cursor-pointer"
                    >
                      🧕 Muslimah (Hijab)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoData({ url: SYARI_PHOTOS.anakLaki, name: 'pas_foto_anak_laki_10thn.jpg' })}
                      className="px-2 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 font-medium text-left truncate cursor-pointer"
                    >
                      👦 Anak Laki (10 Thn)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoData({ url: SYARI_PHOTOS.anakPerempuan, name: 'pas_foto_anak_perempuan_10thn.jpg' })}
                      className="px-2 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 font-medium text-left truncate cursor-pointer"
                    >
                      👧 Anak Putri (10 Thn)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alamat Lengkap (Wajib) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Alamat Lengkap Sesuai Domisili <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Masukkan alamat lengkap (jalan, banjar/lingkungan, desa, kabupaten)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all resize-none"
            />
          </div>

          {/* Tempat & Tanggal Lahir */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Tempat & Tanggal Lahir <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={tempatTanggalLahir}
              onChange={(e) => setTempatTanggalLahir(e.target.value)}
              placeholder="Contoh: Denpasar, 17 Agustus 1980"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
            />
          </div>

          {/* Nomor HP atau WA (Wajib) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nomor HP / WhatsApp Aktif <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={noHp}
              onChange={(e) => setNoHp(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
            />
          </div>

          {/* Jumlah Keluarga (Hanya jika Kepala Keluarga) */}
          {peranKeluarga === 'kepala_keluarga' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Estimasi Jumlah Anggota Keluarga dalam KK
              </label>
              <input
                type="number"
                min={0}
                max={25}
                value={jumlahKeluarga}
                onChange={(e) => setJumlahKeluarga(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
              />
            </div>
          )}

          {/* Email Aktif */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Email Aktif (Opsional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
            />
          </div>

          {/* Lampiran Dokumen KTP & KK (Opsional / Pelengkap) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="block text-[11px] font-bold text-gray-700 mb-1">
                Lampiran KTP/KIA (Opsional)
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer">
                <FileUp className="w-3.5 h-3.5" />
                <span>Pilih Berkas</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleDocumentUpload(e, 'ktp')}
                  className="hidden"
                />
              </label>
              <div className="text-[11px] text-gray-500 mt-1 truncate">
                {ktpData ? ktpData.name : 'Belum dipilih'}
              </div>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="block text-[11px] font-bold text-gray-700 mb-1">
                Lampiran KK (Opsional)
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer">
                <FileUp className="w-3.5 h-3.5" />
                <span>Pilih Berkas</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleDocumentUpload(e, 'kk')}
                  className="hidden"
                />
              </label>
              <div className="text-[11px] text-gray-500 mt-1 truncate">
                {kkData ? kkData.name : 'Belum dipilih'}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-4 px-5 bg-[#0b5d34] hover:bg-[#084d2a] active:scale-[0.99] text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Kirim Pendaftaran Anggota</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
