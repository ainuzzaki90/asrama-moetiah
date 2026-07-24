# MBMS — Moetiah Boarding Management System

Sistem Manajemen Asrama SMP Islam Moetiah. Aplikasi web modular untuk
mengelola seluruh kehidupan santri di asrama: data siswa, kamar, presensi,
perizinan, kebersihan, piket, pelanggaran/pembinaan, prestasi, kesehatan,
inventaris, tabungan siswa, laporan, dan manajemen pengguna — lengkap
dengan AI Assistant, RBAC, audit log, dan dukungan PWA.

---

## 1. Struktur Folder

```
mbms/
├── index.html                 # Shell aplikasi (login + SPA)
├── manifest.json              # PWA manifest
├── service-worker.js          # PWA offline cache (app-shell)
├── assets/
│   ├── css/style.css          # Design system (navy/putih/emas + dark mode)
│   ├── img/                   # Ikon PWA
│   └── js/
│       ├── config.js          # Konfigurasi global, daftar menu & role
│       ├── mockData.js        # Seed data mode demo (localStorage)
│       ├── api.js             # Lapisan akses data (mock ⇄ Google Apps Script)
│       ├── auth.js            # Sesi, login, RBAC, idle auto-logout
│       ├── core.js            # Router SPA, sidebar, notifikasi, CrudModule generik
│       ├── app-init.js        # Bootstrap aplikasi, dark mode, PWA
│       └── modules/
│           ├── dashboard.js       # Kartu statistik + grafik real-time
│           ├── siswa.js           # Data siswa (foto, QR ID, Excel import/export)
│           ├── kamar.js           # Layout visual kamar & okupansi
│           ├── piket.js           # Jadwal piket format Putaran/Ketua Kamar/Petugas (rotasi adil)
│           ├── tabungan.js        # Tabungan siswa (setoran/penarikan) + buku tabungan
│           ├── users.js           # Manajemen pengguna (khusus Super Admin)
│           ├── simpleModules.js   # Presensi, perizinan, pelanggaran, prestasi,
│           │                      # kesehatan, inventaris, kebersihan,
│           │                      # audit log, pengaturan
│           ├── reports.js         # Laporan & export PDF/Excel
│           └── aiAssistant.js     # AI Assistant (floating chat)
└── backend/
    ├── Code.gs                # REST API Google Apps Script (database = Google Sheets)
    └── appsscript.json        # Manifest proyek Apps Script
```

Arsitektur frontend mengikuti pola **MVC ringan**: `api.js` = Model (akses
data), `modules/*.js` = Controller + View per fitur, `core.js` = kerangka
kerja bersama (router, komponen CRUD generik) yang dipakai berulang oleh
modul-modul sederhana agar kode tetap ringkas dan konsisten.

---

## 2. Menjalankan Secara Instan (Mode Demo)

Aplikasi ini dapat langsung dijalankan **tanpa setup backend** menggunakan
`BACKEND_MODE: "mock"` (default) — seluruh data disimpan di `localStorage`
browser dengan data contoh yang sudah diisi.

1. Buka `index.html` langsung di browser, **atau** jalankan server statis
   ringan (disarankan agar service worker/PWA berfungsi penuh):
   ```bash
   npx serve mbms
   # atau
   python3 -m http.server 8080 --directory mbms
   ```
2. Login dengan salah satu akun demo (ditampilkan juga di halaman login):

   | Role            | Username     | Password    |
   |-----------------|--------------|-------------|
   | Super Admin     | `superadmin` | `admin123`  |
   | Kepala Sekolah  | `kepsek`     | `kepsek123` |
   | Wali Asrama     | `waliasrama` | `asrama123` |

3. Reset data demo kapan saja lewat menu **Pengaturan → Reset Data Demo**.

---

## 3. Deploy ke Backend Sungguhan (Google Sheets + Apps Script)

Gunakan mode ini untuk data multi-pengguna yang persisten dan bisa diakses
tim (Super Admin, Kepala Sekolah, Wali Asrama) secara bersamaan.

### Langkah A — Siapkan Google Sheet & Apps Script
1. Buat **Google Sheet** baru — ini akan menjadi database.
2. Buka **Extensions → Apps Script**.
3. Hapus kode default, lalu salin seluruh isi `backend/Code.gs` ke `Code.gs`.
4. Buka file `backend/appsscript.json` dan salin isinya ke manifest proyek
   Apps Script (ikon gear ⚙ → "Show appsscript.json manifest file").
5. Pada editor Apps Script, pilih fungsi **`setupDatabase`** dari dropdown
   fungsi di toolbar, lalu klik **Run**. Fungsi ini akan:
   - Membuat seluruh tab/sheet (`users`, `siswa`, `kamar`, dst.) dengan header yang benar.
   - Mengisi akun demo dan beberapa data contoh.
   - Menampilkan izin akses (setujui permintaan izin Google saat diminta).

### Langkah B — Deploy sebagai Web App
1. Klik **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. Isi:
   - **Execute as**: Me (akun Anda)
   - **Who has access**: Anyone (atau "Anyone with the link" agar bisa diakses staf asrama)
4. Klik **Deploy**, lalu salin **Web app URL** yang diberikan
   (`https://script.google.com/macros/s/xxxxxxxxxxxx/exec`).

> **Catatan izin Google Drive**: fitur lampiran di modul Kesehatan Siswa (surat keterangan sakit, hasil rontgen, dll) menggunakan Google Drive untuk menyimpan file. Saat pertama kali fitur ini dipakai (atau saat Anda mem-Deploy ulang setelah menambahkan kode ini), Google akan meminta izin tambahan untuk mengakses Drive — klik **Tinjau izin** lalu **Izinkan** seperti proses otorisasi `setupDatabase` sebelumnya. File akan tersimpan di folder Drive bernama **`MBMS_Lampiran`** milik akun yang men-deploy script.

### Langkah C — Hubungkan Frontend
1. Buka `assets/js/config.js`.
2. Ubah:
   ```js
   BACKEND_MODE: "gas",
   API_URL: "https://script.google.com/macros/s/xxxxxxxxxxxx/exec",
   ```
3. Simpan, lalu buka ulang aplikasi. Semua modul otomatis memakai Google
   Sheets sebagai database — tidak ada perubahan kode lain yang diperlukan
   karena `api.js` mengabstraksi kedua mode dengan kontrak fungsi yang sama.

> **Catatan keamanan**: Apps Script Web App hanya mendukung method GET dan
> POST secara native. Operasi *update*/*delete* disimulasikan lewat field
> `action` pada body POST (lihat komentar kontrak API di `Code.gs` dan
> `api.js`). Untuk produksi skala besar, pertimbangkan menambahkan validasi
> token sesi yang lebih ketat di `Code.gs` (mis. menyimpan token aktif di
> sheet tersembunyi `sessions` dan memeriksa kedaluwarsa idle 30 menit).

---

## 4. Endpoint REST (Code.gs)

| Metode | Tujuan                         | Parameter                                   |
|--------|---------------------------------|----------------------------------------------|
| GET    | List data                      | `?action=list&sheet=<nama>&filter=<json>`     |
| GET    | Ambil satu data                | `?action=get&sheet=<nama>&id=<id>`            |
| POST   | Buat data baru                 | `{ action:"create", sheet, data }`            |
| POST   | Perbarui data                  | `{ action:"update", sheet, id, data }`        |
| POST   | Hapus data                     | `{ action:"delete", sheet, id }`              |
| POST   | Login                          | `{ action:"login", username, password }`      |

Nama sheet yang didukung: `users, siswa, kamar, presensi, perizinan,
pelanggaran, prestasi, kesehatan, tumbuh_kembang, inventaris, tabungan,
piket_putaran, kebersihan, audit_log, notifications`.

---

## 5. Role & Hak Akses (RBAC)

| Modul                    | Super Admin | Kepala Sekolah | Wali Asrama |
|---------------------------|:-----------:|:---------------:|:-----------:|
| Dashboard & modul operasional | ✅ | ✅ | ✅ |
| Laporan & Export           | ✅ | ✅ | ✅ |
| Manajemen Pengguna         | ✅ | ❌ | ❌ |
| Audit Log                  | ✅ | ❌ | ❌ |

Aturan akses didefinisikan di `assets/js/config.js` (array `MENU`, field
`roles`) dan ditegakkan di router (`core.js` → `Auth.can()`), sehingga
menambah/mengubah role cukup dilakukan di satu tempat.

---

## 6. Fitur Utama yang Sudah Diimplementasikan

- **Dashboard** — kartu statistik real-time + grafik Chart.js (tabungan siswa, presensi, okupansi kamar).
- **Data Siswa** — foto (drag & drop), kartu ID + QR code, import/export Excel.
- **Manajemen Kamar** — layout visual kapasitas & penghuni per kamar.
- **Presensi Harian** — bangun, sholat, mengaji, sekolah, tidur.
- **Perizinan Siswa** — status berjalan/kembali, penjemput, alasan.
- **Kebersihan Kamar** — checklist + foto sebelum/sesudah + skor.
- **Jadwal Piket** — format Putaran (7 hari, Ketua Kamar + Petugas Piket harian) sesuai dokumen asli sekolah, dengan generator otomatis berotasi adil dan cetak PDF per putaran.
- **Pelanggaran & Pembinaan** — kategori, poin, tindak lanjut, otomatis mengirim notifikasi.
- **Prestasi Siswa**, **Kesehatan Siswa** (riwayat penyakit + lampiran dokumen medis via Google Drive), **Tumbuh Kembang Siswa** (tinggi/berat berkala + IMT otomatis + grafik tren), **Inventaris**, dan **Tabungan Siswa** (setoran/penarikan per siswa dengan validasi saldo & cetak buku tabungan).
- **AI Assistant** (tombol mengambang) — meringkas perkembangan santri, mendeteksi
  santri berisiko, memberi rekomendasi pembinaan, dan membuat draf laporan
  berdasarkan data langsung (rule-engine lokal, tanpa API key; siap
  dihubungkan ke LLM eksternal lewat proxy server — lihat komentar di
  `aiAssistant.js`).
- **Manajemen Pengguna** (Super Admin) — CRUD akun, reset password, role assignment.
- **Notifikasi** — toast (SweetAlert2) + panel notifikasi bel dengan status dibaca.
- **Keamanan** — RBAC, sanitasi input dasar (escaping HTML), audit log, idle auto-logout 30 menit.
- **Laporan & Export** — filter santri/tanggal, export PDF (jsPDF) & Excel (SheetJS).
- **Lainnya** — Dark Mode, drag & drop upload foto, auto pagination/sorting (DataTables),
  loading skeleton, multi-filter tabel, PWA (installable + offline app-shell).

---

## 7. Mengembangkan Modul Baru

Sebagian besar modul "sederhana" (CRUD satu tabel) cukup didaftarkan lewat
`CrudModule.mount()` di `simpleModules.js` — cukup definisikan `columns` dan
`formFields`, tanpa perlu menulis ulang logika tabel/modal/notifikasi.
Modul dengan tampilan khusus (mis. `kamar.js`, `siswa.js`, `piket.js`)
menulis render function sendiri lalu mendaftar ke router lewat
`Router.register("id_modul", renderFn)`.

Tambahkan entri baru di `MENU` (`config.js`) untuk memunculkannya di sidebar.

---

Dikelola oleh Wali Asrama **Abdal Ainuz Zaki, B.A.** — SMP Islam Moetiah.
