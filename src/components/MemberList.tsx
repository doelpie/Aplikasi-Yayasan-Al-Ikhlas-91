import React, { useState, useMemo } from 'react';
import { Member } from '../types';
import { getInitials, getPeranLabel, maskNik } from '../utils/storage';
import { Search, CreditCard, ChevronDown, Users, Sparkles, User } from 'lucide-react';

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
  const [roleFilter, setRoleFilter] = useState<'semua' | 'kepala_keluarga' | 'istri' | 'anak'>('semua');

  // Filter approved members
  const approvedMembers = useMemo(() => {
    return members.filter(m => m.status === 'disetujui');
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let result = approvedMembers.filter(m => {
      const matchSearch = (
        m.nama.toLowerCase().includes(q) ||
        m.alamat.toLowerCase().includes(q) ||
        (m.nik && m.nik.includes(q)) ||
        (m.noKk && m.noKk.includes(q)) ||
        (m.id && m.id.toLowerCase().includes(q))
      );
      const matchRole = roleFilter === 'semua' ? true : m.peranKeluarga === roleFilter;
      return matchSearch && matchRole;
    });

    return result.sort((a, b) => {
      if (sortBy === 'klrg-desc') {
        return (b.jumlahKeluarga || 0) - (a.jumlahKeluarga || 0);
      }
      if (sortBy === 'klrg-asc') {
        return (a.jumlahKeluarga || 0) - (b.jumlahKeluarga || 0);
      }
      if (sortBy === 'name-asc') {
        return a.nama.localeCompare(b.nama);
      }
      if (sortBy === 'newest') {
        return new Date(b.tanggalDaftar).getTime() - new Date(a.tanggalDaftar).getTime();
      }
      return 0;
    });
  }, [approvedMembers, searchTerm, sortBy, roleFilter]);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-6 pb-28">
      {/* Search and Sort Row */}
      <div className="flex gap-2.5 items-center mb-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama / alamat / NIK / No KK..."
            className="w-full pl-10 pr-4 py-3 bg-white text-gray-800 text-sm font-medium rounded-2xl shadow-xs border border-emerald-900/15 focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/30 focus:border-[#0b5d34] transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="appearance-none pl-4 pr-8 py-3 bg-white text-gray-800 text-sm font-bold rounded-2xl shadow-xs border border-emerald-900/15 focus:outline-none focus:ring-2 focus:ring-[#0b5d34]/30 cursor-pointer"
          >
            <option value="klrg-desc">Klrg ↓</option>
            <option value="klrg-asc">Klrg ↑</option>
            <option value="name-asc">Nama A-Z</option>
            <option value="newest">Terbaru</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Role Filter Pills */}
      <div className="flex gap-1.5 mb-3.5 overflow-x-auto pb-0.5 scrollbar-none">
        {(['semua', 'kepala_keluarga', 'istri', 'anak'] as const).map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
              roleFilter === role
                ? 'bg-[#0b5d34] text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {role === 'semua' ? 'Semua Anggota' : getPeranLabel(role)}
          </button>
        ))}
      </div>

      {/* Member Cards List */}
      <div className="space-y-3">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => {
            const roleText = getPeranLabel(member.peranKeluarga);
            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md border border-gray-100 flex items-start gap-3.5 transition-all"
              >
                {/* Photo Portrait / Initial Avatar */}
                <div className="w-13 h-17 rounded-xl overflow-hidden bg-emerald-50 border-2 border-[#0b5d34] flex items-center justify-center shrink-0 shadow-xs relative">
                  {member.fotoUrl ? (
                    <img
                      src={member.fotoUrl}
                      alt={member.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#0b5d34] text-white flex items-center justify-center font-bold text-base">
                      {getInitials(member.nama)}
                    </div>
                  )}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0b5d34] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {roleText}
                      </span>
                      <h2 className="text-base font-bold text-stone-900 leading-snug mt-1">
                        {member.nama}
                      </h2>
                    </div>

                    {member.peranKeluarga === 'kepala_keluarga' && (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        {member.jumlahKeluarga || 0} org
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    {member.alamat}
                  </p>

                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    NIK: {maskNik(member.nik)} · No. KK: {member.noKk}
                  </div>

                  {/* Actions Row */}
                  <div className="mt-3 flex items-center justify-between pt-1 border-t border-gray-100">
                    <span className="text-[11px] text-gray-400 font-mono">
                      ID: {member.id}
                    </span>

                    <button
                      onClick={() => onOpenCardVerification(member)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0b5d34] hover:bg-[#084d2a] active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
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
                ? `Tidak ditemukan nama atau identitas yang cocok dengan kata kunci "${searchTerm}".`
                : 'Pendaftaran baru yang telah disetujui pengurus akan otomatis muncul di direktori ini.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-3 text-xs font-bold text-[#0b5d34] hover:underline cursor-pointer"
              >
                Reset Pencarian
              </button>
            )}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={onGoToRegister}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-emerald-50 text-[#0b5d34] hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer border border-emerald-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Daftar Anggota / Keluarga Baru</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
