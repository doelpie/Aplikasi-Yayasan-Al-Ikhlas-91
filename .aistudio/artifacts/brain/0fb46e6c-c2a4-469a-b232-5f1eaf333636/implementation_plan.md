# Rencana Implementasi: QR Code Kartu Anggota & Manajemen Kegiatan Yayasan Al Ikhlas Sembilan Satu

Dokumen ini menguraikan arsitektur lengkap, rancangan antarmuka, spesifikasi alur pengguna, serta urutan eksekusi untuk fitur **QR Code Kartu Anggota**, **Manajemen Kegiatan (Daftar & Kalender)**, **Scan QR Presensi Kehadiran**, **Sinkronisasi Google Calendar**, dan **Export File .ICS Universal**.

---

## 1. Ringkasan Kebutuhan & Hasil Klarifikasi (User Intent)

Berdasarkan instruksi pengguna dan jawaban klarifikasi yang telah disepakati:
1. **QR Code pada Kartu Anggota**:
   - Menghasilkan QR Code resmi pada kartu fisik/digital (tampil di kartu anggota, cetak, PDF, dan simpan PNG).
   - **Muatan Data QR**: Berisi payload terstruktur ID Anggota dan Nomor NIK (misal format string verifikasi `ALIKHLAS:{id}:{nik}`) untuk presensi cepat dan validasi akurat.
2. **Navigasi 4 Menu Utama pada Halaman Admin**:
   - Navigasi bawah / bar admin memiliki 4 menu:
     1. **Anggota** (Menampilkan manajemen data anggota yang ada saat ini: filter, tambah, export, status verifikasi)
     2. **Kegiatan** (Halaman Manajemen Kegiatan dengan sub-menu Daftar Kegiatan & Kalender Kegiatan)
     3. **Scan QR** (Kamera scanner langsung aktif + opsi unggah foto QR + opsi input ID manual untuk presensi acara)
     4. **Logout** (Keluar dari sesi admin)
3. **Manajemen Kegiatan (Menu Kegiatan)**:
   - **Sub-Navigasi Header Kegiatan**: Jenis Kegiatan, Tambah Jadwal, Export Kalender, dan Keluar.
   - **Tampilan Kegiatan**:
     - **Daftar Kegiatan**: Menampilkan kartu/tabel acara dengan status, waktu, jenis, ringkasan kehadiran, tombol Detail Kegiatan, Edit, dan Hapus.
     - **Kalender Kegiatan**: Tampilan kalender interaktif bulanan/mingguan dengan penanda warna kegiatan. Mengklik kegiatan di kalender akan langsung membuka halaman **Detail Kegiatan**.
   - **Tambah Kegiatan**:
     - Pilihan Jenis Kegiatan: **Rapat Pengurus**, **Pengajian Umum**, dan **Arisan** (dapat dipilih via dropdown/segmented tabs).
     - Judul Kegiatan (input teks).
     - Tanggal Kegiatan (pemilih tanggal).
     - Jam Kegiatan (pemilih jam/waktu mulai dan selesai).
     - Deskripsi Kegiatan (textarea detail acara).
     - **Pilih Calon Peserta Kegiatan (Checkbox)**: Daftar checklist anggota terverifikasi yang diundang ke dalam **Daftar Peserta Kegiatan** (bukan langsung masuk daftar hadir).
4. **Alur Presensi Scan QR & Konfirmasi Otomatis**:
   - Memilih kegiatan aktif yang sedang berlangsung atau memilih kegiatan tujuan presensi.
   - Memindai QR Code kartu anggota via kamera live, unggah foto QR, atau ketik ID/NIK manual.
   - **Pencocokan**:
     - Jika anggota **sudah ada di Daftar Peserta Kegiatan**, data kehadiran otomatis tercatat ke **Daftar Hadir Kegiatan** (mencatat ID, nama, jam presensi, judul dan jenis kegiatan) dengan feedback audio/visual sukses.
     - Jika anggota **belum ada di Daftar Peserta Kegiatan**, sistem otomatis menampilkan **Pop-Up Konfirmasi**: *"Anggota [Nama] belum terdaftar di Daftar Peserta Kegiatan ini. Apakah Anda ingin menambahkan anggota ini ke Daftar Peserta sekaligus mencatat ke Daftar Hadir Kegiatan?"*. Jika Admin klik **OK / Setujui**, anggota otomatis dimasukkan ke Daftar Peserta dan langsung tercatat hadir.
5. **Detail Kegiatan & Daftar Hadir**:
   - Menampilkan informasi lengkap kegiatan (judul, jenis, waktu, lokasi/deskripsi).
   - Tab **Daftar Peserta** vs **Daftar Hadir**:
     - Daftar Hadir mencantumkan nama anggota, foto/inisial, NIK, peran, waktu jam scan absen, dan status kehadiran.
     - Tombol Export Daftar Hadir (Excel/CSV & PDF) untuk arsip yayasan.
6. **Integrasi Kalender**:
   - **Sinkronisasi Google Calendar**: Tombol tautan langsung untuk menambahkan acara ke Google Calendar dengan detail waktu dan deskripsi yang lengkap.
   - **Export Kalender .ICS Universal**: Mengunduh file `.ics` resmi yang kompatibel dengan Apple Calendar (iOS/macOS), Microsoft Outlook, Android Calendar, dan Google Calendar di semua sistem operasi.
7. **Pencarian & Filter Lengkap**:
   - Pencarian real-time berdasarkan kata kunci (judul kegiatan, nama peserta, nomor NIK/ID).
   - Filter berdasarkan jenis kegiatan (Rapat Pengurus, Pengajian Umum, Arisan) dan status tanggal (Akan Datang, Berlangsung Hari Ini, Selesai).

---

## 2. Arsitektur Komponen & Tampilan (UI/UX)

Sesuai panduan *frontend-design* dan *saas_dashboard*:
- **Warna & Tema**: Tetap konsisten dengan identitas hijau resmi Yayasan Al Ikhlas Sembilan Satu (`#0b5d34`, aksen emas `#d4af37`, latar belakang bersih `#f4f8f5`).
- **Disiplin Bebas Pill Statis (Zero-Pill)**: Menggunakan metadata teks bersih dengan pemisah tipografis (`·`), menghindari tumpukan badge palsu.
- **Navigasi Bawah Admin Responsif**: Bar navigasi 4 tombol yang pas di layar HP/mobile tanpa terpotong, serta tata letak lebar yang lega di tablet, laptop, dan PC.
- **Komponen Baru yang Dibangun**:
  1. `src/components/ActivityManagement.tsx`: Kontainer utama manajemen kegiatan (Daftar Kegiatan & Kalender Kegiatan).
  2. `src/components/ActivityList.tsx`: Grid & daftar kegiatan interaktif dengan filter dan pencarian.
  3. `src/components/ActivityCalendar.tsx`: Tampilan kalender interaktif bulanan dengan penanda jadwal kegiatan dan popover detail.
  4. `src/components/ActivityFormModal.tsx`: Modal tambah/edit jadwal kegiatan lengkap dengan pemilih jam, tanggal, dan seleksi checklist peserta.
  5. `src/components/ActivityDetailModal.tsx`: Halaman detail kegiatan lengkap dengan tab Daftar Peserta, Daftar Hadir (dengan catatan waktu jam scan), dan export data.
  6. `src/components/QrScannerModal.tsx`: Scanner kamera langsung dengan preview video, toggle switch kamera depan/belakang, opsi upload file gambar QR, dan opsi input ID/NIK manual.
  7. `src/utils/calendarExport.ts`: Utilitas pembuatan file iCalendar (`.ics`) standar RFC 5545 dan generator URL sinkronisasi Google Calendar.

---

## 3. Rancangan Model Data & Penyimpanan (Persistence)

Model data baru didefinisikan di `src/types.ts` dan disinkronkan ke `localStorage` serta Firestore:

### A. Tipe `Activity` (Kegiatan)
```typescript
export type ActivityType = 'rapat_pengurus' | 'pengajian_umum' | 'arisan';

export interface ActivityAttendee {
  memberId: string;
  memberNama: string;
  memberNik: string;
  memberPeran: string;
  scanTimestamp: string; // ISO string waktu presensi
  scanTimeFormatted: string; // contoh: "19:45 WITA"
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
}

export interface Activity {
  id: string; // misal "ACT-2026-001"
  judul: string;
  jenis: ActivityType; // 'rapat_pengurus' | 'pengajian_umum' | 'arisan'
  tanggal: string; // YYYY-MM-DD
  jamMulai: string; // HH:mm
  jamSelesai?: string; // HH:mm
  lokasi?: string;
  deskripsi: string;
  pesertaIds: string[]; // Daftar ID Anggota yang diundang (Daftar Peserta)
  kehadiran: ActivityAttendee[]; // Daftar Anggota yang sudah Scan QR Hadir
  createdAt: string;
  updatedAt: string;
}
```

### B. Firestore Collections
- `/activities/{activityId}`: Menyimpan data kegiatan, daftar peserta, dan log daftar hadir.
- Sinkronisasi real-time via Firestore listener dan fallback offline storage.

---

## 4. Urutan Langkah Pengerjaan (Step-by-Step Implementation)

1. **Dependensi & Utilitas QR Code**:
   - Menambahkan dependensi `qrcode` (untuk rendering QR Code beresolusi tinggi pada kartu anggota) dan `html5-qrcode` (untuk live scanner multi-platform).
   - Memperbarui `src/components/MemberCardModal.tsx` agar menyematkan QR Code resmi pada tampilan kartu, mode cetak, PDF, dan ekspor PNG.
2. **Definisi Tipe Data**:
   - Memperbarui `src/types.ts` dengan interface `Activity`, `ActivityType`, `ActivityAttendee`, dan payload QR.
   - Menyiapkan data awal kegiatan (*initial demo activities*) agar admin langsung dapat menguji daftar kegiatan dan kalender.
3. **Utilitas Kalender (.ICS & Google Calendar)**:
   - Membuat `src/utils/calendarExport.ts` untuk men-generate file `.ics` (iCalendar) standar universal dan pembuatan link `https://calendar.google.com/calendar/render?...`.
4. **Modul Manajemen Kegiatan**:
   - Membuat `ActivityFormModal.tsx` (Tambah/Edit Kegiatan dengan checklist peserta anggota).
   - Membuat `ActivityList.tsx` (Daftar Kegiatan dengan pencarian & filter jenis kegiatan).
   - Membuat `ActivityCalendar.tsx` (Kalender Kegiatan interaktif).
   - Membuat `ActivityDetailModal.tsx` (Detail Kegiatan, Daftar Peserta & Daftar Hadir lengkap dengan jam scan).
5. **Scanner Presensi QR & Dialog Konfirmasi**:
   - Membuat `QrScannerModal.tsx` dengan kamera live, input manual, dan upload QR.
   - Mengimplementasikan logika auto-match: jika ada di daftar peserta langsung masuk daftar hadir; jika belum ada, menampilkan dialog konfirmasi otomatis.
6. **Pembaruan Navigasi Halaman Admin**:
   - Mengubah navigasi bawah admin menjadi 4 menu: **Anggota**, **Kegiatan**, **Scan QR**, dan **Logout**.
   - Menghubungkan state view admin (`activeAdminView: 'anggota' | 'kegiatan' | 'scanner'`).
7. **Verifikasi & Build Test**:
   - Menjalankan `compile_applet` dan `lint_applet` untuk menjamin tidak ada regresi dan semua fitur berjalan lancar.

---

## 5. Rencana Verifikasi Pengujian

- [ ] Membuka kartu anggota salah satu warga dan memeriksa QR Code muncul dengan jelas pada kartu, cetak, PDF, dan unduh gambar.
- [ ] Membuka halaman Admin dan menguji perpindahan 4 menu: Anggota, Kegiatan, Scan QR, dan Logout.
- [ ] Menambahkan jadwal kegiatan baru (Rapat Pengurus, Pengajian Umum, Arisan) dengan checklist beberapa peserta.
- [ ] Memeriksa kegiatan baru otomatis muncul pada **Daftar Kegiatan** dan **Kalender Kegiatan**.
- [ ] Menguji tombol ekspor file `.ics` dan tombol buka Google Calendar.
- [ ] Membuka kamera scanner QR, menguji presensi untuk peserta terdaftar (sukses otomatis), dan peserta belum terdaftar (muncul pop-up konfirmasi dan berhasil masuk setelah dikonfirmasi).
- [ ] Memeriksa daftar hadir pada Detail Kegiatan menampilkan data jam absen, nama anggota, dan judul kegiatan.
