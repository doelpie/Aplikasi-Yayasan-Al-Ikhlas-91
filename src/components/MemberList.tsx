import React, { useState, useMemo } from 'react';
import { Member } from '../types';
import { getInitials } from '../utils/storage';
import { Search, CreditCard, ChevronDown, Users, Sparkles } from 'lucide-react';

interface MemberListProps {
  members: Member[];
  onOpenCardVerification: (member: Member) => void;
  onGoToRegister: () => void;
}

export const MemberList: React.FC<MemberListProps> = ({
  members,
  onOpenCardVerification,
  onGoToRegister,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'klrg-desc' | 'klrg-asc' | 'name-asc' | 'newest'>('klrg-desc');

  // Filter approved members
  const approvedMembers = useMemo(() => {
    return members.filter(m => m.status === 'disetujui');
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const result = approvedMembers.filter(m => {
      return (
        m.nama.toLowerCase().includes(q) ||
        m.alamat.toLowerCase().includes(q) ||
        (m.id && m.id.toLowerCase().includes(q))
      );
    });

    return result.sort((a, b) => {
      if (sortBy === 'klrg-desc') {
        return b.jumlahKeluarga - a.jumlahKeluarga;
      }
      if (sortBy === 'klrg-asc') {
        return a.jumlahKeluarga - b.jumlahKeluarga;
      }
      if (sortBy === 'name-asc') {
        return a.nama.localeCompare(b.nama);
      }
      if (sortBy === 'newest') {
        return new Date(b.tanggalDaftar).getTime() - new Date(a.tanggalDaftar).getTime();
      }
      return 0;
    });
  }, [approvedMembers, searchTerm, sortBy]);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-6 pb-28">
      {/* Search and Sort Row - styled cleanly as shown in IMG-20261018-WA0014.jpg */}
      <div className="flex gap-2.5 items-center mb-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama / alamat..."
            className="w-full pl-10 pr-4 py-3 bg-white text-gray-800 text-sm font-medium rounded-2xl shadow-sm border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-[#83141a]/30 focus:border-[#83141a] transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="appearance-none pl-4 pr-8 py-3 bg-white text-gray-800 text-sm font-semibold rounded-2xl shadow-sm border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-[#83141a]/30 cursor-pointer"
          >
            <option value="klrg-desc">Klrg ↓</option>
            <option value="klrg-asc">Klrg ↑</option>
            <option value="name-asc">Nama A-Z</option>
            <option value="newest">Terbaru</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Member Cards List */}
      <div className="space-y-3">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => {
            const initial = getInitials(member.nama).charAt(0) || 'A';
            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md border border-gray-100 flex items-start gap-3.5 transition-all"
              >
                {/* Initial Avatar Circle */}
                <div className="w-12 h-12 rounded-full bg-[#7a0c10] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                  {initial}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-stone-900 leading-snug">
                      {member.nama}
                    </h2>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100 shrink-0">
                      {member.jumlahKeluarga} org
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    {member.alamat}
                  </p>

                  {/* Actions Row */}
                  <div className="mt-3 flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-400">
                      ID: {member.id}
                    </span>

                    <button
                      onClick={() => onOpenCardVerification(member)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#83141a] hover:bg-[#6c1015] active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Kartu</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm mt-4">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">
              {searchTerm ? 'Tidak ada anggota ditemukan' : 'Belum ada anggota disetujui'}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? `Tidak ditemukan nama atau alamat yang cocok dengan kata kunci "${searchTerm}".`
                : 'Pendaftaran baru yang telah disetujui oleh pengurus akan otomatis muncul di halaman ini.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-3 text-xs font-semibold text-[#83141a] hover:underline cursor-pointer"
              >
                Reset Pencarian
              </button>
            )}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={onGoToRegister}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-red-50 text-[#83141a] hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Daftar Sebagai Anggota Baru</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
