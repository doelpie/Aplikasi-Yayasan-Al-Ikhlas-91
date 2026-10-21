import React, { useState } from 'react';
import { Member } from '../types';
import { formatIndonesianDate, getPeranLabel, maskNik } from '../utils/storage';
import { Search, MapPin, Phone, Mail, Clock, CheckCircle2, XCircle, AlertTriangle, CreditCard, Shield, HelpCircle, Lock, Database } from 'lucide-react';

interface InfoSectionProps {
  members: Member[];
  onOpenCardVerification: (member: Member) => void;
  onGoToPortal: () => void;
}

export const InfoSection: React.FC<InfoSectionProps> = ({
  members,
  onOpenCardVerification,
  onGoToPortal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Member | null | 'not_found'>(null);

  const handleCheckStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.replace(/\D/g, '');
    if (!cleanQuery) return;

    const found = members.find(m => {
      const cleanMNik = (m.nik || '').replace(/\D/g, '');
      const cleanMHp = (m.noHp || '').replace(/\D/g, '');
      const cleanMKk = (m.noKk || '').replace(/\D/g, '');
      return cleanMNik.includes(cleanQuery) || cleanMHp.includes(cleanQuery) || cleanMKk.includes(cleanQuery) || m.id.toLowerCase() === searchQuery.trim().toLowerCase();
    });

    if (found) {
      setSearchResult(found);
    } else {
      setSearchResult('not_found');
    }
  };

  return (
    <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-28 space-y-4">
      {/* Cek Status Pendaftaran Mandiri */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center font-bold">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              Cek Status Pendaftaran
            </h2>
            <p className="text-xs text-gray-500">
              Masukkan Nomor NIK / KTP, Nomor HP, atau ID Pendaftaran
            </p>
          </div>
        </div>

        <form onSubmit={handleCheckStatus} className="flex gap-2 mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Contoh: NIK (16 digit) atau No HP"
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Periksa
          </button>
        </form>

        {/* Result Display */}
        {searchResult && searchResult !== 'not_found' && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-emerald-200/80">
              <div className="flex items-center gap-3">
                {searchResult.fotoUrl && (
                  <img
                    src={searchResult.fotoUrl}
                    alt={searchResult.nama}
                    className="w-11 h-14 object-cover rounded-lg border border-[#0b5d34] shrink-0"
                  />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0b5d34] bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    {getPeranLabel(searchResult.peranKeluarga)}
                  </span>
                  <div className="text-base font-bold text-gray-900 mt-1">
                    {searchResult.nama}
                  </div>
                  <div className="text-xs text-gray-600 font-mono">
                    NIK: {maskNik(searchResult.nik)}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              {searchResult.status === 'disetujui' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-[#0b5d34] text-xs font-bold shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
                </span>
              )}
              {searchResult.status === 'menunggu' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold shrink-0">
                  <Clock className="w-3.5 h-3.5" /> Menunggu
                </span>
              )}
              {searchResult.status === 'ditolak' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold shrink-0">
                  <XCircle className="w-3.5 h-3.5" /> Ditolak
                </span>
              )}
            </div>

            {searchResult.status === 'ditolak' && searchResult.catatanPenolakan && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Alasan Penolakan:</strong> {searchResult.catatanPenolakan}
                </div>
              </div>
            )}

            {searchResult.status === 'disetujui' && (
              <div className="mt-3 pt-2 flex items-center justify-between">
                <div className="text-xs text-emerald-800 font-semibold">
                  Kartu anggota resmi telah aktif.
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCardVerification(searchResult)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
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
            Data tidak ditemukan. Pastikan nomor identitas atau nomor HP yang dimasukkan sudah benar.
          </div>
        )}
      </div>

      {/* Informasi Penyimpanan Database Firebase */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                Database Cloud Firebase
              </h2>
              <p className="text-xs text-gray-500">Google Cloud Firestore Enterprise</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#0b5d34] border border-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Terhubung & Aktif
          </span>
        </div>
        <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/70 text-xs text-emerald-950 space-y-1.5">
          <p className="font-semibold text-emerald-900">
            Seluruh data anggota, pendaftaran baru, dan status verifikasi kini tersimpan secara permanen di database Firebase Firestore.
          </p>
          <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-0.5">
            <li>Sinkronisasi instan real-time lintas perangkat dan browser</li>
            <li>Keamanan aturan akses (Firestore Security Rules) terverifikasi</li>
            <li>Cadangan data awan terpusat & tidak hilang saat cache dibersihkan</li>
          </ul>
        </div>
      </div>

      {/* Privasi & Keamanan Kartu */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#0b5d34] flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-gray-900">
            Keamanan 6 Digit PIN KTP/KIA
          </h2>
        </div>
        <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
          <p>
            Untuk melindungi kerahasiaan dan privasi keluarga, kartu anggota resmi dilindungi dengan <strong>PIN 6 digit terakhir nomor KTP</strong> (atau KIA untuk anak).
          </p>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-950 font-mono text-[11px]">
            Masukan 6 digit PIN yaitu 6 digit terakhir KTP anda
          </div>
          <p>
            Setiap anggota keluarga (ibu dan anak) yang masuk hanya dapat mengedit dan melihat kartu miliknya sendiri. Sedangkan Kepala Keluarga dapat memantau dan mencetak kartu seluruh anggota keluarganya.
          </p>
        </div>
      </div>

      {/* Kontak Sekretariat Yayasan */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-3">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Logo Yayasan Al Ikhlas" 
            className="w-10 h-10 object-contain drop-shadow-xs shrink-0" 
          />
          <h2 className="text-base font-bold text-gray-900">
            Sekretariat Yayasan Al Ikhlas Sembilan Satu
          </h2>
        </div>

        <div className="space-y-2.5 text-xs text-gray-700">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-[#0b5d34] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-gray-900">Alamat Kantor</strong>
              Jl. Raya Dalung No. 91 Br. Kaja - Dalung, Kec. Kuta Utara, Kab. Badung, Bali.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-[#0b5d34] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-gray-900">WhatsApp Layanan</strong>
              <a 
                href="https://wa.me/628123986794?text=Halo%20Pengurus%20Yayasan%20Al%20Ikhlas%20Sembilan%20Satu" 
                target="_blank" 
                rel="noreferrer"
                className="text-[#0b5d34] hover:underline font-bold"
              >
                08123986794 (+62 812-3986-794)
              </a>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-[#0b5d34] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-gray-900">Email Resmi</strong>
              <a
                href="mailto:alikhlas91dalung@gmail.com"
                className="text-[#0b5d34] hover:underline font-bold"
              >
                alikhlas91dalung@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
