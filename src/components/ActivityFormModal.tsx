import React, { useState } from 'react';
import { Activity, ActivityType, Member } from '../types';
import { X, Calendar, Clock, MapPin, Users, CheckSquare, Square, Search, Sparkles, Check } from 'lucide-react';
import { getPeranLabel, maskNik, getInitials } from '../utils/storage';

interface ActivityFormModalProps {
  activity?: Activity | null;
  allMembers: Member[];
  onClose: () => void;
  onSave: (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'kehadiran'>) => void;
}

export const ActivityFormModal: React.FC<ActivityFormModalProps> = ({
  activity,
  allMembers,
  onClose,
  onSave,
}) => {
  const isEdit = !!activity;

  const [judul, setJudul] = useState(activity?.judul || '');
  const [jenis, setJenis] = useState<ActivityType>(activity?.jenis || 'pengajian_umum');
  const [tanggal, setTanggal] = useState(activity?.tanggal || new Date().toISOString().slice(0, 10));
  const [jamMulai, setJamMulai] = useState(activity?.jamMulai || '19:30');
  const [jamSelesai, setJamSelesai] = useState(activity?.jamSelesai || '21:30');
  const [lokasi, setLokasi] = useState(activity?.lokasi || 'Gedung Yayasan Al Ikhlas Sembilan Satu Dalung');
  const [deskripsi, setDeskripsi] = useState(activity?.deskripsi || '');
  const [pesertaIds, setPesertaIds] = useState<string[]>(activity?.pesertaIds || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'kepala_keluarga' | 'istri' | 'anak'>('all');
  const [error, setError] = useState<string | null>(null);

  // Filter approved members for attendees selection
  const approvedMembers = allMembers.filter(m => m.status === 'disetujui');

  const filteredMembers = approvedMembers.filter(m => {
    const matchSearch = m.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        m.nik.includes(searchTerm) ||
                        m.id.includes(searchTerm);
    const matchRole = filterRole === 'all' || m.peranKeluarga === filterRole;
    return matchSearch && matchRole;
  });

  const toggleMemberSelection = (id: string) => {
    setPesertaIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredMembers.map(m => m.id);
    const combined = Array.from(new Set([...pesertaIds, ...idsToAdd]));
    setPesertaIds(combined);
  };

  const deselectAllFiltered = () => {
    const idsToRemove = new Set(filteredMembers.map(m => m.id));
    setPesertaIds(prev => prev.filter(id => !idsToRemove.has(id)));
  };

  const selectHeadsOnly = () => {
    const headIds = approvedMembers.filter(m => m.peranKeluarga === 'kepala_keluarga').map(m => m.id);
    setPesertaIds(headIds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) {
      setError('Judul Kegiatan wajib diisi.');
      return;
    }
    if (!tanggal) {
      setError('Tanggal Kegiatan wajib dipilih.');
      return;
    }
    if (!jamMulai) {
      setError('Jam Mulai Kegiatan wajib diisi.');
      return;
    }

    onSave({
      judul: judul.trim(),
      jenis,
      tanggal,
      jamMulai,
      jamSelesai: jamSelesai || undefined,
      lokasi: lokasi.trim() || undefined,
      deskripsi: deskripsi.trim(),
      pesertaIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto border-t-4 border-[#0b5d34]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#0b5d34]">
              {isEdit ? 'Edit Jadwal Kegiatan' : 'Tambah Jadwal Kegiatan Yayasan'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Jadwal akan otomatis masuk ke Daftar Kegiatan dan Kalender Kegiatan
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. Jenis Kegiatan: 3 Pilihan (Rapat Pengurus, Pengajian Umum, Arisan) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Pilih Jenis Kegiatan <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setJenis('rapat_pengurus')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  jenis === 'rapat_pengurus'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs ring-1 ring-indigo-500/30'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                🏢 Rapat Pengurus
              </button>
              <button
                type="button"
                onClick={() => setJenis('pengajian_umum')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  jenis === 'pengajian_umum'
                    ? 'bg-emerald-50 border-[#0b5d34] text-[#0b5d34] shadow-xs ring-1 ring-[#0b5d34]/30'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                📖 Pengajian Umum
              </button>
              <button
                type="button"
                onClick={() => setJenis('arisan')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  jenis === 'arisan'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                🤝 Arisan
              </button>
            </div>
          </div>

          {/* 2. Judul Kegiatan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Judul Kegiatan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Rapat Koordinasi Panitia Haul Akbar 2026"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] transition-all"
            />
          </div>

          {/* 3. Waktu Kegiatan: Tanggal & Jam */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#0b5d34]" />
                <span>Tanggal Kegiatan *</span>
              </label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#0b5d34]" />
                <span>Jam Mulai *</span>
              </label>
              <input
                type="time"
                required
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Jam Selesai</span>
              </label>
              <input
                type="time"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34]"
              />
            </div>
          </div>

          {/* Quick preset jam */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-600">
            <span className="font-semibold text-gray-500">Pilihan Jam Cepat:</span>
            <button
              type="button"
              onClick={() => { setJamMulai('09:00'); setJamSelesai('11:30'); }}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-md font-mono cursor-pointer"
            >
              Pagi (09:00 - 11:30)
            </button>
            <button
              type="button"
              onClick={() => { setJamMulai('16:00'); setJamSelesai('18:00'); }}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-md font-mono cursor-pointer"
            >
              Sore (16:00 - 18:00)
            </button>
            <button
              type="button"
              onClick={() => { setJamMulai('19:30'); setJamSelesai('22:00'); }}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-md font-mono cursor-pointer"
            >
              Malam (19:30 - 22:00)
            </button>
          </div>

          {/* 4. Lokasi Kegiatan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>Lokasi / Tempat Acara</span>
            </label>
            <input
              type="text"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Gedung Yayasan Al Ikhlas Sembilan Satu Dalung"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34]"
            />
          </div>

          {/* 5. Deskripsi Kegiatan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Deskripsi & Catatan Kegiatan
            </label>
            <textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Tuliskan agenda, susunan acara, dresscode/baju, atau instruksi khusus untuk peserta..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/20 focus:border-[#0b5d34] resize-none"
            />
          </div>

          {/* 6. PILIH SIAPA SAJA YANG AKAN MENGHADIRI ACARA DENGAN CHECK BOX (DAFTAR PESERTA KEGIATAN) */}
          <div className="border border-gray-200 rounded-2xl p-3 sm:p-4 bg-stone-50 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0b5d34]" />
                  <span>Pilih Daftar Peserta Kegiatan (Check Box)</span>
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Centang anggota yang diundang ke Daftar Peserta. Presensi kehadiran dicatat via Scan QR nanti.
                </p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 bg-[#0b5d34] text-white rounded-full text-xs font-bold font-mono">
                  {pesertaIds.length} Terpilih
                </span>
              </div>
            </div>

            {/* Controls Bar for Selection */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIK..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-md font-semibold text-gray-700 cursor-pointer"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={selectHeadsOnly}
                  className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-md font-semibold text-gray-700 cursor-pointer"
                >
                  Kepala Keluarga Saja
                </button>
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-md font-semibold text-gray-700 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Members Checklist Grid */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-100">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const isChecked = pesertaIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer ${
                        isChecked ? 'bg-emerald-50/80 border border-emerald-300/80' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberSelection(member.id)}
                          className="w-4 h-4 text-[#0b5d34] accent-[#0b5d34] rounded cursor-pointer"
                        />
                        {member.fotoUrl ? (
                          <img
                            src={member.fotoUrl}
                            alt={member.nama}
                            className="w-8 h-8 rounded-full object-cover border border-emerald-300 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0b5d34] font-bold text-xs flex items-center justify-center shrink-0">
                            {getInitials(member.nama)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {member.nama}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            NIK: {maskNik(member.nik)} · {getPeranLabel(member.peranKeluarga)}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-gray-400 shrink-0 ml-2">
                        ID: {member.id}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  Tidak ada anggota yang cocok dengan pencarian.
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-[#0b5d34] hover:bg-[#084d2a] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? 'Simpan Perubahan Jadwal' : 'Simpan Jadwal Kegiatan'}</span>
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
