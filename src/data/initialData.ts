import { Member } from '../types';

// Foto Syar'i Resmi Yayasan Al Ikhlas Sembilan Satu (Pria berpeci/koko, Muslimah hijab syar'i, Anak 10 tahun syar'i)
export const SYARI_PHOTOS = {
  kepalaKeluargaMargo: '/src/assets/images/foto_kepala_keluarga_1792426500490.jpg',
  istriSitiAminah: '/src/assets/images/foto_istri_muslimah_1792426501587.jpg',
  anakRizky10Thn: '/src/assets/images/foto_anak_muslim_1792426501692.jpg',
  anakAisyah10Thn: '/src/assets/images/foto_anak_perempuan_1792426519632.jpg',
  kepalaKeluargaJajat: '/src/assets/images/foto_pria_muslim_jajat_1792427433042.jpg',
  istriNurhasanah: '/src/assets/images/foto_istri_nurhasanah_1792427433617.jpg',
  kepalaKeluargaSoni: '/src/assets/images/foto_pria_muslim_soni_1792427432988.jpg',
  // Aliases for roles
  kepalaKeluarga: '/src/assets/images/foto_kepala_keluarga_1792426500490.jpg',
  istri: '/src/assets/images/foto_istri_muslimah_1792426501587.jpg',
  anakLaki: '/src/assets/images/foto_anak_muslim_1792426501692.jpg',
  anakPerempuan: '/src/assets/images/foto_anak_perempuan_1792426519632.jpg',
};

// Aliases for quick selection in forms
export const QUICK_SYARI_PHOTOS = {
  kepalaKeluarga: SYARI_PHOTOS.kepalaKeluargaMargo,
  istri: SYARI_PHOTOS.istriSitiAminah,
  anakLaki: SYARI_PHOTOS.anakRizky10Thn,
  anakPerempuan: SYARI_PHOTOS.anakAisyah10Thn,
};

export const INITIAL_MEMBERS: Member[] = [
  // ================= KELUARGA 1: KELUARGA MARGO SUWITO UTOMO =================
  {
    id: '0114',
    regNumber: '1614/YMWM13/II/2026 & L.063',
    nik: '5103051205780001', // 6 digit terakhir PIN: 780001
    nama: 'Margo Suwito Utomo',
    noKk: '5103052001050014',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'Surabaya, 12 Mei 1978',
    alamat: 'Perumahan Kodam IX Udayana Blok G No.3 Desa Buduk',
    jumlahKeluarga: 3,
    noHp: '081234567037',
    email: 'margo.suwito@example.com',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaMargo,
    status: 'disetujui',
    tanggalDaftar: '2026-09-10T08:30:00.000Z',
    tanggalDisetujui: '2026-10-16T10:15:00.000Z',
  },
  {
    id: '0114-1',
    regNumber: '1614/YMWM13/II/2026 & L.063-B',
    nik: '5103055508820002', // 6 digit terakhir PIN: 820002
    nama: 'Siti Aminah',
    noKk: '5103052001050014',
    peranKeluarga: 'istri',
    kepalaKeluargaId: '0114',
    namaKepalaKeluarga: 'Margo Suwito Utomo',
    tempatTanggalLahir: 'Denpasar, 15 Agustus 1982',
    alamat: 'Perumahan Kodam IX Udayana Blok G No.3 Desa Buduk',
    noHp: '081234567038',
    fotoUrl: SYARI_PHOTOS.istriSitiAminah,
    status: 'disetujui',
    tanggalDaftar: '2026-09-11T09:00:00.000Z',
    tanggalDisetujui: '2026-10-16T10:15:00.000Z',
  },
  {
    id: '0114-2',
    regNumber: '1614/YMWM13/II/2026 & L.063-C',
    nik: '5103052109160003', // 6 digit terakhir PIN: 160003 (KIA Anak 10 Tahun)
    nama: 'Rizky Pratama Utomo',
    noKk: '5103052001050014',
    peranKeluarga: 'anak',
    kepalaKeluargaId: '0114',
    namaKepalaKeluarga: 'Margo Suwito Utomo',
    tempatTanggalLahir: 'Badung, 21 September 2016', // Umur 10 tahun
    alamat: 'Perumahan Kodam IX Udayana Blok G No.3 Desa Buduk',
    noHp: '081234567039',
    fotoUrl: SYARI_PHOTOS.anakRizky10Thn,
    status: 'disetujui',
    tanggalDaftar: '2026-09-11T09:30:00.000Z',
    tanggalDisetujui: '2026-10-16T10:15:00.000Z',
  },
  {
    id: '0114-3',
    regNumber: '1614/YMWM13/II/2026 & L.063-D',
    nik: '5103056204160004', // 6 digit terakhir PIN: 160004 (KIA Anak Putri 10 Tahun)
    nama: 'Aisyah Putri Utomo',
    noKk: '5103052001050014',
    peranKeluarga: 'anak',
    kepalaKeluargaId: '0114',
    namaKepalaKeluarga: 'Margo Suwito Utomo',
    tempatTanggalLahir: 'Badung, 22 April 2016', // Umur 10 tahun
    alamat: 'Perumahan Kodam IX Udayana Blok G No.3 Desa Buduk',
    noHp: '081234567040',
    fotoUrl: SYARI_PHOTOS.anakAisyah10Thn,
    status: 'disetujui',
    tanggalDaftar: '2026-09-11T10:00:00.000Z',
    tanggalDisetujui: '2026-10-16T10:15:00.000Z',
  },

  // ================= KELUARGA 2: KELUARGA JAJAT HIDAYAT =================
  {
    id: '0115',
    regNumber: '1615/YMWM13/II/2026 & L.064',
    nik: '3204121501820005', // 6 digit terakhir PIN: 820005
    nama: 'JAJAT HIDAYAT',
    noKk: '3204122802080015',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'Bandung, 15 Januari 1982',
    alamat: 'PERUM BTN KODAM JL. TUNON BLOK B2 NO. 2 LING. BR. KAJA BUDUK',
    jumlahKeluarga: 1,
    noHp: '081298765432',
    email: 'jajat.hidayat@example.com',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaJajat,
    status: 'disetujui',
    tanggalDaftar: '2026-09-12T09:20:00.000Z',
    tanggalDisetujui: '2026-10-16T11:00:00.000Z',
  },
  {
    id: '0115-1',
    regNumber: '1615/YMWM13/II/2026 & L.064-B',
    nik: '3204126010850006', // 6 digit terakhir PIN: 850006
    nama: 'Nurhasanah',
    noKk: '3204122802080015',
    peranKeluarga: 'istri',
    kepalaKeluargaId: '0115',
    namaKepalaKeluarga: 'JAJAT HIDAYAT',
    tempatTanggalLahir: 'Cimahi, 20 Oktober 1985',
    alamat: 'PERUM BTN KODAM JL. TUNON BLOK B2 NO. 2 LING. BR. KAJA BUDUK',
    noHp: '081298765433',
    fotoUrl: SYARI_PHOTOS.istriNurhasanah,
    status: 'disetujui',
    tanggalDaftar: '2026-09-13T10:00:00.000Z',
    tanggalDisetujui: '2026-10-16T11:00:00.000Z',
  },

  // ================= KELUARGA 3: KELUARGA SONI CHALIMSAH =================
  {
    id: '0098',
    regNumber: '1616/YMWM13/II/2026 & L.065',
    nik: '3524180403870008', // 6 digit terakhir PIN: 870008
    nama: 'SONI CHALIMSAH',
    noKk: '3524181005120098',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'LAMONGAN, 04 MAR 1987',
    alamat: 'PERUM GERIYA ARSANDI LINGK. BR. GEDE ABIAN BASE',
    jumlahKeluarga: 0,
    noHp: '085645945677',
    email: 'soni.c@example.com',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaSoni,
    status: 'disetujui',
    tanggalDaftar: '2026-09-15T09:00:00.000Z',
    tanggalDisetujui: '2026-10-16T12:00:00.000Z',
  },

  // ================= KELUARGA 4: TRIYONO =================
  {
    id: '0099',
    regNumber: '1606/YMWM13/II/2026 & L.055',
    nik: '1804192701790010', // 6 digit terakhir PIN: 790010
    nama: 'TRIYONO',
    noKk: '1804191206050099',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'SEKINCAU, 27 JAN 1979',
    alamat: 'PERUM DALUNG PERMAI BLOK M/56 LING. BR. CAMPUAN ASRI KAUH DALUNG',
    jumlahKeluarga: 0,
    noHp: '081337317433',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaMargo,
    status: 'disetujui',
    tanggalDaftar: '2026-09-18T10:30:00.000Z',
    tanggalDisetujui: '2026-10-16T13:40:00.000Z',
  },

  // ================= KELUARGA 5: WIJI UTOMO =================
  {
    id: '0100',
    regNumber: '1617/YMWM13/II/2026 & L.066',
    nik: '5103051404660011', // 6 digit terakhir PIN: 660011
    nama: 'WIJI UTOMO',
    noKk: '5103051808920100',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'DENPASAR, 14 APR 1966',
    alamat: 'LINGK. BR. GAJI - DALUNG',
    jumlahKeluarga: 0,
    noHp: '082341982929',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaJajat,
    status: 'disetujui',
    tanggalDaftar: '2026-09-20T11:00:00.000Z',
    tanggalDisetujui: '2026-10-16T14:10:00.000Z',
  },

  // Pendaftaran Baru (Menunggu Approval)
  {
    id: '0119',
    nik: '5103051507840009', // 6 digit terakhir PIN: 840009
    nama: 'Bambang Setiawan',
    noKk: '5103051010150119',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'Denpasar, 15 Juli 1984',
    alamat: 'Perumahan Taman Dalung Asri Blok D No. 18, Desa Dalung',
    jumlahKeluarga: 2,
    noHp: '081238994477',
    email: 'bambang.setiawan@gmail.com',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaSoni,
    status: 'menunggu',
    tanggalDaftar: '2026-10-19T07:15:00.000Z',
  },

  // ================= KELUARGA AGUS SUBRIYANTO (ID: 0130) & TUTIK MARYANI (ID: 0130-2) =================
  {
    id: '0130',
    regNumber: '1630/YMWM13/II/2026 & L.0130',
    nik: '5103051806770130', // 6 digit terakhir PIN: 770130
    nama: 'Agus Subriyanto',
    noKk: '5103051908060130',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'Banyuwangi, 18 Juni 1977',
    alamat: 'Perum Dalung Permai Lingkungan Banjar Tegal Jaya, Desa Dalung, Kuta Utara, Badung',
    jumlahKeluarga: 2,
    noHp: '081236780130',
    email: 'agus.subriyanto@gmail.com',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaMargo,
    status: 'disetujui',
    tanggalDaftar: '2026-10-24T08:00:00.000Z',
    tanggalDisetujui: '2026-10-25T09:00:00.000Z',
  },
  {
    id: '0130-2',
    regNumber: '1630/YMWM13/II/2026 & L.0130-B',
    nik: '5103055209800130', // 6 digit terakhir PIN: 800130
    nama: 'Tutik Maryani',
    noKk: '5103051908060130',
    peranKeluarga: 'istri',
    kepalaKeluargaId: '0130',
    namaKepalaKeluarga: 'Agus Subriyanto',
    tempatTanggalLahir: 'Jember, 12 September 1980',
    alamat: 'Perum Dalung Permai Lingkungan Banjar Tegal Jaya, Desa Dalung, Kuta Utara, Badung',
    noHp: '081236780132',
    email: 'tutik.maryani@gmail.com',
    fotoUrl: SYARI_PHOTOS.istriSitiAminah,
    status: 'disetujui',
    tanggalDaftar: '2026-10-24T08:15:00.000Z',
    tanggalDisetujui: '2026-10-25T09:05:00.000Z',
  },

  // ================= KELUARGA SRIYONO, SH.MM (ID: 0131) =================
  {
    id: '0131',
    regNumber: '1631/YMWM13/II/2026 & L.0131',
    nik: '5103051003750131', // 6 digit terakhir PIN: 750131
    nama: 'Sriyono, SH.MM',
    noKk: '5103052204040131',
    peranKeluarga: 'kepala_keluarga',
    tempatTanggalLahir: 'Surakarta, 10 Maret 1975',
    alamat: 'Perumahan Bumi Dalung Permai, Desa Dalung, Kuta Utara, Badung',
    jumlahKeluarga: 1,
    noHp: '081239880131',
    email: 'sriyono.shmm@gmail.com',
    fotoUrl: SYARI_PHOTOS.kepalaKeluargaJajat,
    status: 'disetujui',
    tanggalDaftar: '2026-10-26T09:00:00.000Z',
    tanggalDisetujui: '2026-10-26T10:30:00.000Z',
  }
];
