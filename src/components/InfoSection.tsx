import React, { useState } from 'react';
import { Member } from '../types';
import { formatIndonesianDate } from '../utils/storage';
import { Search, MapPin, Phone, Mail, Clock, CheckCircle2, XCircle, AlertTriangle, CreditCard, Shield, HelpCircle } from 'lucide-react';

interface InfoSectionProps {
  members: Member[];
  onOpenCardVerification: (member: Member) => void;
}

export const InfoSection: React.FC<InfoSectionProps> = ({
  members,
  onOpenCardVerification,
}) => {
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<Member | null | 'not_found'>(null);

  const handleCheckStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchPhone.replace(/\D/g, '');
    if (!cleanQuery) return;

    const found = members.find(m => {
      const cleanMPhone = m.noHp.replace(/\D/g, '');
      return cleanMPhone.includes(cleanQuery) || m.id.toLowerCase() === searchPhone.trim().toLowerCase();
    });

    if (found) {
      setSearchResult(found);
    } else {
      setSearchResult('not_found');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-2 pb-28 space-y-5">
      {/* Cek Status Pendaftaran Mandiri */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-red-100 text-[#83141a] flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            Cek Status Pendaftaran
          </h2>
        </div>
        <p className="text-xs text-gray-600 mb-4">
          Masukkan nomor HP atau ID pendaftaran Anda untuk memeriksa status pendaftaran terkini.
        </p>

        <form onSubmit={handleCheckStatus} className="flex gap-2">
          <input
            type="text"
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            placeholder="Contoh: 081234567xxx atau ID"
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#83141a]/20 focus:border-[#83141a]"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#83141a] hover:bg-[#6c1015] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Periksa
          </button>
        </form>

        {/* Result Display */}
        {searchResult && searchResult !== 'not_found' && (
          <div className="mt-4 p-4 rounded-2xl bg-gray-50 border border-gray-200/80 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-200">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  ID: {searchResult.id}
                </div>
                <div className="text-base font-bold text-gray-900 mt-0.5">
                  {searchResult.nama}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Terdaftar: {formatIndonesianDate(searchResult.tanggalDaftar)}
                </div>
              </div>

              {/* Status Badge */}
              {searchResult.status === 'disetujui' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
                </span>
              )}
              {searchResult.status === 'menunggu' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold shrink-0">
                  <Clock className="w-3.5 h-3.5" /> Menunggu ACC
                </span>
              )}
              {searchResult.status === 'ditolak' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold shrink-0">
                  <XCircle className="w-3.5 h-3.5" /> Ditolak
                </span>
              )}
            </div>

            {/* Note if rejected */}
            {searchResult.status === 'ditolak' && searchResult.catatanPenolakan && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Alasan Penolakan:</strong> {searchResult.catatanPenolakan}
                </div>
              </div>
            )}

            {/* If approved: quick action to open card */}
            {searchResult.status === 'disetujui' && (
              <div className="mt-4 pt-2 flex items-center justify-between">
                <div className="text-xs text-emerald-700 font-medium">
                  Selamat! Kartu anggota Anda sudah aktif.
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCardVerification(searchResult)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#83141a] hover:bg-[#6c1015] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Buka Kartu</span>
                </button>
              </div>
            )}
          </div>
        )}

        {searchResult === 'not_found' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-center">
            Data tidak ditemukan. Pastikan nomor HP atau ID yang Anda masukkan sudah benar dan pernah didaftarkan.
          </div>
        )}
      </div>

      {/* Info Tentang Kartu & Password 4 Digit */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-100 text-[#83141a] flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            Akses & Keamanan Kartu
          </h2>
        </div>
        <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
          <p>
            Untuk menjaga privasi dan keamanan identitas setiap anggota, kartu anggota keluarga dilindungi dengan sistem <strong>verifikasi 4 digit terakhir nomor telepon</strong> yang didaftarkan.
          </p>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-700 font-mono text-[11px]">
            Misal nomor HP Anda: <strong>0812-3456-7037</strong><br />
            Maka PIN Kartu Anda: <strong className="text-[#83141a]">7037</strong>
          </div>
          <p>
            Setelah 4 digit berhasil diverifikasi, Anda dapat melihat, mengunduh file gambar kartu resmi (PNG), atau mencetak kartu langsung dalam format PDF.
          </p>
        </div>
      </div>

      {/* Informasi Yayasan & Kontak */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-100 text-[#83141a] flex items-center justify-center">
            <HelpCircle className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            Sekretariat Yayasan
          </h2>
        </div>

        <div className="space-y-3 text-xs text-gray-700">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#83141a] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-gray-900">Alamat Kantor</strong>
              Jl. Raya Dalung No. 91 Br. Kaja - Dalung, Kec. Kuta Utara, Kab. Badung, Bali.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 text-[#83141a] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-gray-900">WhatsApp Pelayanan</strong>
              <a 
                href="https://wa.me/6281234567890?text=Halo%20Pengurus%20Yayasan%20Al%20Ikhlas%20Sembilan%20Satu" 
                target="_blank" 
                rel="noreferrer"
                className="text-[#83141a] hover:underline font-semibold"
              >
                +62 812-3456-7890 (Pengurus Yayasan)
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-[#83141a] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-gray-900">Email Resmi</strong>
              yayasan.alikhlas91@gmail.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
