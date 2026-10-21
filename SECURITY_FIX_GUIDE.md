# Panduan Penyelesaian GitHub Secret Alert (Google API Key)

Alert yang Anda terima dari GitHub:
> **Secrets detected in doelpie/Aplikasi-Yayasan-Al-Ikhlas-91**  
> Review secret detected in `firebase-applet-config.json#L4` • commit `0b2a1697` (Google API Key)

---

## 1. Mengapa Alert Ini Muncul?
GitHub memiliki fitur **Secret Scanning** otomatis. Ketika ada file yang di-commit ke repositori dan mengandung pola teks API Key Google (`AIzaSy...`), GitHub mendeteksinya dan langsung mengirimkan peringatan keamanan.

Pada aplikasi web Firebase, API Key client sebenarnya dirancang untuk diakses oleh browser agar dapat menghubungi backend Firebase. Keamanan data utamanya dijaga oleh **Firestore Security Rules** dan **Firebase Authentication**. Namun, GitHub tetap menandainya sebagai peringatan agar pemilik repo dapat membatasi (*restrict*) atau menyembunyikan kunci tersebut dari publik.

---

## 2. Perubahan yang Sudah Diterapkan di Aplikasi (Selesai ✅)
1. **`.gitignore` Diperbarui**:
   File `firebase-applet-config.json` sudah ditambahkan ke `.gitignore` sehingga tidak akan pernah ikut ter-commit atau terunggah lagi ke GitHub di commit-commit berikutnya.
2. **Dukungan Variabel Lingkungan (`.env`)**:
   File `src/firebase.ts` kini otomatis mendukung pembacaan konfigurasi dari variabel lingkungan `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, dll.
3. **Template Aman**:
   Disediakan file `firebase-applet-config.example.json` dan `.env.example` sebagai referensi konfigurasi tanpa membocorkan kunci rahasia.

---

## 3. Langkah Menghapus / Menyelesaikan Alert di GitHub (Resolve Alert)
1. Buka halaman repositori Anda di GitHub: `https://github.com/doelpie/Aplikasi-Yayasan-Al-Ikhlas-91`
2. Klik tab **Security** di bagian atas menu repositori.
3. Di panel sebelah kiri, pilih **Secret scanning** (atau **Secret scanning alerts**).
4. Klik pada alert **Google API Key** yang terdeteksi pada file `firebase-applet-config.json`.
5. Di sudut kanan atas detail alert, klik tombol dropdown **Close alert** (atau **Resolve alert**), lalu pilih:
   - **"Revoked"** (jika Anda sudah membuat API key baru / merotasi kunci), ATAU
   - **"False positive"** atau **"Won't fix"** dengan catatan bahwa ini adalah Firebase Web Client Key yang dilindungi oleh Security Rules & HTTP Referrer.

---

## 4. Cara Menghapus File dari Tracking Git (Terminal / Git Anda)
Jalankan perintah berikut di komputer / terminal repositori lokal Anda agar file tersebut tidak lagi dilacak oleh Git:
```bash
git rm --cached firebase-applet-config.json
git commit -m "fix: remove sensitive firebase-applet-config.json from git tracking"
git push origin main
```
*Catatan: Perintah di atas hanya menghapus file dari Git repositori online, file lokal Anda di komputer tetap ada dan aplikasi tetap berjalan normal.*

---

## 5. Cara Mengamankan Google API Key di Google Cloud Console (Sangat Disarankan)
Untuk memastikan tidak ada orang lain yang menyalahgunakan API Key Anda (misalnya memakai kuota Anda):
1. Buka **Google Cloud Console Credentials**:  
   [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Pastikan memilih project: `virtual-ellipse-138923`
3. Cari API Key yang bersangkutan (dimulai dengan `AIzaSyCXNWUDq0m5...`) dan klik ikon **Edit** (pensil).
4. **Atur Pembatasan Aplikasi (Application restrictions)**:
   - Pilih **Websites** (HTTP referrers).
   - Masukkan domain website aplikasi Anda (misal domain deploy atau hosting Anda).  
     Dengan ini, API Key **HANYA BISA BEKERJA** saat dipanggil dari website resmi Anda. Pihak luar tidak bisa menggunakannya dari aplikasi lain!
5. **Atur Pembatasan API (API restrictions)**:
   - Pilih **Restrict key**.
   - Centang hanya API Firebase yang digunakan:
     - *Cloud Firestore API*
     - *Identity Platform API* / *Firebase Authentication*
     - *Token Service API*
6. Klik **Save**.
7. Jika ingin mengganti total (Rotate): Klik **Regenerate key** di halaman tersebut, lalu salin kunci baru ke file `.env` atau `firebase-applet-config.json` lokal Anda.
