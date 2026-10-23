import React, { useState, useEffect } from 'react';
import { Member, FamilyRole } from '../types';
import { FileUp, CheckCircle2, AlertCircle, Info, Sparkles, X, Camera, User, Users, ShieldCheck, Check, Upload, Image, FileText, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAvailableKepalaKeluarga, getPeranLabel } from '../utils/storage';
import { SYARI_PHOTOS } from '../data/initialData';
import { compressImage } from '../utils/imageCompressor';

// Sample preview data URIs for demo testing
const SAMPLE_KTP_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" rx="16" fill="%230b5d34"/><rect x="12" y="12" width="376" height="226" rx="12" fill="%23f0fdf4"/><text x="24" y="45" font-family="sans-serif" font-size="15" font-weight="bold" fill="%230b5d34">REPUBLIK INDONESIA</text><text x="24" y="66" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23166534">KARTU TANDA PENDUDUK / KIA</text><rect x="24" y="85" width="80" height="105" rx="8" fill="%23bbf7d0"/><text x="40" y="145" font-family="sans-serif" font-size="32" fill="%23166534">👤</text><text x="120" y="105" font-family="sans-serif" font-size="12" font-weight="bold" fill="%231f2937">NIK : 5103051408860012</text><text x="120" y="128" font-family="sans-serif" font-size="11" fill="%23374151">Nama : Achmad Zaini M.</text><text x="120" y="150" font-family="sans-serif" font-size="11" fill="%23374151">Alamat : Dalung, Badung</text><text x="120" y="172" font-family="sans-serif" font-size="10" font-weight="bold" fill="%2315803d">✓ DOKUMEN VALID KTP</text></svg>';

const SAMPLE_KK_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" rx="16" fill="%231e3a8a"/><rect x="12" y="12" width="376" height="226" rx="12" fill="%23eff6ff"/><text x="24" y="45" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231e3a8a">KARTU KELUARGA (KK)</text><text x="24" y="66" font-family="sans-serif" font-size="11" font-weight="bold" fill="%231d4ed8">No. KK : 5103052809110045</text><rect x="24" y="85" width="352" height="115" rx="8" fill="%23ffffff" stroke="%23cbd5e1"/><text x="36" y="112" font-family="sans-serif" font-size="11" font-weight="bold" fill="%231e293b">Nama Kepala Keluarga : Achmad Zaini</text><text x="36" y="132" font-family="sans-serif" font-size="10" fill="%23475569">Alamat : Jl. Raya Dalung No. 112</text><text x="36" y="152" font-family="sans-serif" font-size="10" fill="%23475569">Desa/Kel : Dalung, Kuta Utara</text><text x="36" y="180" font-family="sans-serif" font-size="10" font-weight="bold" fill="%232563eb">✓ DOKUMEN ASLI KELUARGA</text></svg>';

interface RegisterFormProps {
  allMembers: Member[];
  currentUserSession?: Member | null;
  onSubmit: (
    memberData: Omit<Member, 'id' | 'tanggalDaftar' | 'status'>,
    onStatusUpdate?: (status: string) => void
  ) => Promise<Member> | Member;
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

  // Lampiran dokumen KTP & KK (wajib untuk verifikasi)
  const [ktpData, setKtpData] = useState<{ url: string; name: string } | null>(null);
  const [kkData, setKkData] = useState<{ url: string; name: string } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
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

  // File and Photo upload handler with automatic client-side compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, { maxDimension: 600, quality: 0.72 });
      setFotoData({ url: compressed, name: file.name });
      setError(null);
    } catch (err: any) {
      setError('Gagal memproses foto diri: ' + (err.message || 'Format tidak didukung'));
    }
  };

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'ktp' | 'kk'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, { maxDimension: 800, quality: 0.75 });
      if (type === 'ktp') {
        setKtpData({ url: compressed, name: file.name });
      } else {
        setKkData({ url: compressed, name: file.name });
      }
      setError(null);
    } catch (err: any) {
      setError(`Gagal memproses dokumen ${type.toUpperCase()}: ` + (err.message || 'Format tidak didukung'));
    }
  };

  // Demo fill helper with genuine Syar'i Photos & Sample Documents
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
      setKtpData({
        url: SAMPLE_KTP_IMG,
        name: 'lampiran_ktp_achmad_zaini.jpg',
      });
      setKkData({
        url: SAMPLE_KK_IMG,
        name: 'lampiran_kartu_keluarga_asli.jpg',
      });
    } else if (peranKeluarga === 'istri') {
      setNik('5103056004890015');
      setNama('Fatimah Az Zahra');
      setTempatTanggalLahir('Denpasar, 20 April 1989');
      setNoHp('081338877113');
      setEmail('fatimah.azzahra@gmail.com');
      setFotoData({
        url: SYARI_PHOTOS.istri,
        name: 'foto_syari_istri_muslimah.jpg',
      });
      setKtpData({
        url: SAMPLE_KTP_IMG,
        name: 'lampiran_ktp_fatimah.jpg',
      });
      setKkData({
        url: SAMPLE_KK_IMG,
        name: 'lampiran_kartu_keluarga_keluarga.jpg',
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
      setTempatTanggalLahir('Badung, 25 Oktober 2016');
      setNoHp('081338877114');
      setFotoData({
        url: SYARI_PHOTOS.anakLaki,
        name: 'foto_syari_anak_10_tahun.jpg',
      });
      setKtpData({
        url: SAMPLE_KTP_IMG,
        name: 'lampiran_kia_anak_ilham.jpg',
      });
      setKkData({
        url: SAMPLE_KK_IMG,
        name: 'lampiran_kartu_keluarga_anak.jpg',
      });
      if (availableHeads.length > 0) {
        setSelectedKepalaKeluargaId(availableHeads[0].id);
        setNoKk(availableHeads[0].noKk);
        setAlamat(availableHeads[0].alamat);
      }
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validasi Wajib: NIK (KTP / KIA)
    const cleanNik = nik.trim().replace(/\D/g, '');
    if (cleanNik.length < 10 || cleanNik.length > 16) {
      setError(`Nomor ${peranKeluarga === 'anak' ? 'KTP / KIA (NIK)' : 'KTP (NIK)'} harus berupa 10 hingga 16 digit angka.`);
      return;
    }

    // 2. Validasi Wajib: Nama Sesuai KTP
    if (!nama.trim() || nama.trim().length < 2) {
      setError('Nama Lengkap Sesuai KTP wajib diisi (minimal 2 karakter).');
      return;
    }

    // 3. Validasi Wajib: Nomor Kartu Keluarga (KK)
    const cleanKk = noKk.trim().replace(/\D/g, '');
    if (cleanKk.length < 10 || cleanKk.length > 16) {
      setError('Nomor Kartu Keluarga (No. KK) harus berupa 10 hingga 16 digit angka.');
      return;
    }

    // 4. Validasi Wajib: Tempat & Tanggal Lahir
    if (!tempatTanggalLahir.trim()) {
      setError('Tempat & Tanggal Lahir wajib diisi sesuai KTP/KIA.');
      return;
    }

    // 5. Validasi Wajib: Alamat Lengkap Sesuai Domisili
    if (!alamat.trim()) {
      setError('Alamat Lengkap Sesuai Domisili wajib diisi.');
      return;
    }

    // 6. Validasi Wajib: No HP / WA Aktif
    const cleanHp = noHp.trim().replace(/\D/g, '');
    if (cleanHp.length < 8 || cleanHp.length > 15) {
      setError('Nomor HP / WhatsApp aktif wajib diisi dengan format nomor yang valid (minimal 8 digit angka).');
      return;
    }

    // 7. Validasi Format Email jika diisi
    if (email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.trim())) {
        setError('Format alamat email tidak valid (contoh: nama@domain.com).');
        return;
      }
    }

    // 8. Validasi Kepala Keluarga jika Istri/Anak
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
    }

    // 9. VALIDASI WAJIB: FOTO DIRI / PAS FOTO
    if (!fotoData?.url) {
      setError('Foto Diri / Pas Foto wajib diunggah untuk kelengkapan cetak Kartu Anggota.');
      return;
    }

    // 10. VALIDASI WAJIB: FOTO KTP / KIA
    if (!ktpData?.url) {
      setError('Foto Dokumen KTP / KIA wajib diunggah/dilampirkan sebagai verifikasi identitas resmi.');
      return;
    }

    // 11. VALIDASI WAJIB: FOTO KARTU KELUARGA (KK)
    if (!kkData?.url) {
      setError('Foto Dokumen Kartu Keluarga (KK) wajib diunggah/dilampirkan sebagai verifikasi data keluarga.');
      return;
    }

    setIsSubmitting(true);
    setStatusText('Mengompresi dan mengoptimalkan dokumen...');

    try {
      // Ensure photos are compressed before submission
      const finalFoto = await compressImage(fotoData.url, { maxDimension: 600, quality: 0.72 });
      const finalKtp = await compressImage(ktpData.url, { maxDimension: 800, quality: 0.75 });
      const finalKk = await compressImage(kkData.url, { maxDimension: 800, quality: 0.75 });

      setStatusText('Menghubungkan ke server Firestore...');

      const created = await onSubmit(
        {
          nik: cleanNik,
          nama: nama.trim(),
          alamat: alamat.trim(),
          noHp: noHp.trim(),
          noKk: cleanKk || noKk.trim(),
          peranKeluarga,
          kepalaKeluargaId: peranKeluarga !== 'kepala_keluarga' ? selectedKepalaKeluargaId : undefined,
          namaKepalaKeluarga: linkedHeadName,
          tempatTanggalLahir: tempatTanggalLahir.trim(),
          jumlahKeluarga: peranKeluarga === 'kepala_keluarga' ? (Number(jumlahKeluarga) || 1) : 0,
          email: email.trim() || undefined,
          fotoUrl: finalFoto,
          fotoName: fotoData.name,
          ktpUrl: finalKtp,
          ktpName: ktpData.name,
          kkUrl: finalKk,
          kkName: kkData.name,
        },
        (status) => setStatusText(status)
      );

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
      console.error('Registration submission error:', err);
      setError(err?.message || 'Gagal menyimpan pendaftaran ke database server. Pastikan koneksi internet stabil dan coba kembali.');
    } finally {
      setIsSubmitting(false);
      setStatusText(null);
    }
  };

  if (submittedMember) {
    const roleText = getPeranLabel(submittedMember.peranKeluarga);
    return (
      <div className="max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-6 pt-4 pb-28">
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-emerald-100 text-center">
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
    <div className="max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-6 pt-2 pb-28">
      <div className="bg-white rounded-3xl p-4 sm:p-7 shadow-xs border border-gray-100">
        <div className="pb-4 border-b border-gray-100">
          <h2 className="text-xl sm:text-2xl font-bold text-[#0b5d34]">
            Tambah Anggota
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Formulir Pendaftaran Yayasan Al Ikhlas Sembilan Satu
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

          {/* Dokumen Lampiran WAJIB (KTP / KIA & Kartu Keluarga) */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0b5d34]" />
                <span>Dokumen Lampiran Foto (Wajib Dilampirkan)</span>
                <span className="text-red-500">*</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {ktpData && kkData ? '✓ 2 Dokumen Terlampir' : 'Wajib 2 Dokumen'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lampiran 1: KTP / KIA */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                ktpData 
                  ? 'bg-emerald-50/60 border-emerald-300' 
                  : 'bg-stone-50 border-amber-300 hover:border-amber-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <span>Foto KTP / KIA</span>
                    <span className="text-red-500">*</span>
                  </span>
                  {ktpData ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      <span>Terlampir</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      <span>Wajib Diisi</span>
                    </span>
                  )}
                </div>

                {ktpData ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-white h-24 flex items-center justify-center group">
                      <img
                        src={ktpData.url}
                        alt="Preview KTP"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setKtpData(null)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                        title="Hapus / Ganti Foto KTP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600 truncate max-w-[140px] font-mono">{ktpData.name}</span>
                      <label className="text-[#0b5d34] hover:underline font-bold cursor-pointer">
                        Ganti Foto
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleDocumentUpload(e, 'ktp')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center p-3 bg-white hover:bg-amber-50/50 border-2 border-dashed border-amber-300 rounded-xl cursor-pointer transition-colors text-center">
                      <Upload className="w-5 h-5 text-amber-600 mb-1" />
                      <span className="text-xs font-bold text-gray-800">Unggah Foto KTP / KIA</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">Format: JPG, PNG, atau PDF (Maks. 5MB)</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleDocumentUpload(e, 'ktp')}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Lampiran 2: Kartu Keluarga (KK) */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                kkData 
                  ? 'bg-emerald-50/60 border-emerald-300' 
                  : 'bg-stone-50 border-amber-300 hover:border-amber-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <span>Foto Kartu Keluarga (KK)</span>
                    <span className="text-red-500">*</span>
                  </span>
                  {kkData ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      <span>Terlampir</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      <span>Wajib Diisi</span>
                    </span>
                  )}
                </div>

                {kkData ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-white h-24 flex items-center justify-center group">
                      <img
                        src={kkData.url}
                        alt="Preview Kartu Keluarga"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setKkData(null)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                        title="Hapus / Ganti Foto KK"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600 truncate max-w-[140px] font-mono">{kkData.name}</span>
                      <label className="text-[#0b5d34] hover:underline font-bold cursor-pointer">
                        Ganti Foto
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleDocumentUpload(e, 'kk')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center p-3 bg-white hover:bg-amber-50/50 border-2 border-dashed border-amber-300 rounded-xl cursor-pointer transition-colors text-center">
                      <Upload className="w-5 h-5 text-amber-600 mb-1" />
                      <span className="text-xs font-bold text-gray-800">Unggah Foto Kartu Keluarga (KK)</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">Format: JPG, PNG, atau PDF (Maks. 5MB)</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleDocumentUpload(e, 'kk')}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Checklist Kelengkapan Pendaftaran */}
          <div className="pt-2">
            <div className={`p-3.5 rounded-2xl border transition-all text-xs ${
              fotoData && ktpData && kkData && nik.trim() && nama.trim() && noKk.trim() && alamat.trim() && noHp.trim() && tempatTanggalLahir.trim()
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-stone-50 border-stone-200 text-stone-700'
            }`}>
              <div className="font-bold flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0b5d34]" />
                  <span>Status Kelengkapan Berkas & Data</span>
                </span>
                {fotoData && ktpData && kkData && nik.trim() && nama.trim() && noKk.trim() && alamat.trim() && noHp.trim() && tempatTanggalLahir.trim() ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded-full">
                    ✓ 100% Lengkap
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Wajib Lengkap Semua
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {fotoData ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className={fotoData ? 'font-semibold text-emerald-800' : 'text-gray-500'}>
                    Pas Foto Diri
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {ktpData ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className={ktpData ? 'font-semibold text-emerald-800' : 'text-gray-500'}>
                    Foto KTP / KIA
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {kkData ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className={kkData ? 'font-semibold text-emerald-800' : 'text-gray-500'}>
                    Foto Kartu Keluarga
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {nik.trim() && nama.trim() && noKk.trim() && alamat.trim() && noHp.trim() && tempatTanggalLahir.trim() ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className={nik.trim() && nama.trim() && noKk.trim() ? 'font-semibold text-emerald-800' : 'text-gray-500'}>
                    Data Identitas KTP/KK
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button & Live Verification Progress */}
          <div className="pt-2 space-y-2.5">
            {isSubmitting && statusText && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 shadow-xs animate-pulse">
                <div className="w-4 h-4 border-2 border-[#0b5d34] border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="font-bold text-[#0b5d34]">{statusText}</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    Memverifikasi kepastian tersimpan di server Firestore sebelum notifikasi dikirimkan.
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-5 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2 ${
                isSubmitting
                  ? 'bg-emerald-900/80 cursor-not-allowed opacity-90'
                  : 'bg-[#0b5d34] hover:bg-[#084d2a] active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{statusText || 'Menyimpan & Memverifikasi di Server...'}</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Kirim Pendaftaran Anggota Lengkap</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
