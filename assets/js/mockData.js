/* ==========================================================================
   MBMS — mockData.js
   Seed data used the first time the app runs in "mock" backend mode.
   Structure mirrors the Google Sheets tabs 1:1 so switching BACKEND_MODE
   to "gas" requires no data-shape changes.
   ========================================================================== */

const MOCK_SEED = {

  users: [
    { id: "U-0001", username: "superadmin", password: "admin123", nama: "Muhammad Ilham", role: ROLES.SUPERADMIN, status: "Aktif", email: "ilham@moetiah.sch.id", createdAt: "2025-01-05" },
    { id: "U-0002", username: "kepsek", password: "kepsek123", nama: "Ust. Fauzan Rahman, M.Pd.", role: ROLES.KEPSEK, status: "Aktif", email: "kepsek@moetiah.sch.id", createdAt: "2025-01-05" },
    { id: "U-0003", username: "waliasrama", password: "asrama123", nama: "Abdal Ainuz Zaki, B.A.", role: ROLES.WALI_ASRAMA, status: "Aktif", email: "wali.asrama@moetiah.sch.id", createdAt: "2025-01-05" },
  ],

  siswa: [
    { id: "S-0001", nis: "24001", nama: "Ahmad Fauzan Ramadhan", kelas: "VII A", jk: "L", kamarId: "K-01", tglLahir: "2012-04-11", alamat: "Cepu, Blora", ortu: "Slamet Riyadi", hpOrtu: "081234567801", foto: "", status: "Aktif" },
    { id: "S-0002", nis: "24002", nama: "Muhammad Zidan Al Ghifari", kelas: "VII A", jk: "L", kamarId: "K-01", tglLahir: "2012-06-02", alamat: "Blora", ortu: "Ahmad Zaenuri", hpOrtu: "081234567802", foto: "", status: "Aktif" },
    { id: "S-0003", nis: "24003", nama: "Rizky Maulana Ishaq", kelas: "VII B", jk: "L", kamarId: "K-02", tglLahir: "2012-01-20", alamat: "Cepu", ortu: "Bambang Ishaq", hpOrtu: "081234567803", foto: "", status: "Aktif" },
    { id: "S-0004", nis: "24004", nama: "Nur Aisyah Putri", kelas: "VII A", jk: "P", kamarId: "K-05", tglLahir: "2012-09-15", alamat: "Cepu", ortu: "Hadi Sutrisno", hpOrtu: "081234567804", foto: "", status: "Aktif" },
    { id: "S-0005", nis: "24005", nama: "Siti Khodijah Azzahra", kelas: "VII B", jk: "P", kamarId: "K-05", tglLahir: "2012-03-03", alamat: "Blora", ortu: "Muslimin", hpOrtu: "081234567805", foto: "", status: "Aktif" },
    { id: "S-0006", nis: "23011", nama: "Faisal Abdul Karim", kelas: "VIII A", jk: "L", kamarId: "K-02", tglLahir: "2011-11-08", alamat: "Cepu", ortu: "Karim Hasan", hpOrtu: "081234567806", foto: "", status: "Aktif" },
    { id: "S-0007", nis: "23012", nama: "Salma Nur Fadhila", kelas: "VIII A", jk: "P", kamarId: "K-06", tglLahir: "2011-12-19", alamat: "Blora", ortu: "Rohman Fadhil", hpOrtu: "081234567807", foto: "", status: "Aktif" },
    { id: "S-0008", nis: "22020", nama: "Ilham Dwi Saputra", kelas: "IX A", jk: "L", kamarId: "K-03", tglLahir: "2010-07-27", alamat: "Cepu", ortu: "Saputra Aji", hpOrtu: "081234567808", foto: "", status: "Aktif" },
  ],

  kamar: [
    { id: "K-01", nama: "Kamar Al-Fatih", gedung: "Asrama Putra", lantai: 1, kapasitas: 6, jk: "L" },
    { id: "K-02", nama: "Kamar Al-Farabi", gedung: "Asrama Putra", lantai: 1, kapasitas: 6, jk: "L" },
    { id: "K-03", nama: "Kamar Ibnu Sina", gedung: "Asrama Putra", lantai: 2, kapasitas: 6, jk: "L" },
    { id: "K-04", nama: "Kamar Umar Bin Khattab", gedung: "Asrama Putra", lantai: 2, kapasitas: 6, jk: "L" },
    { id: "K-05", nama: "Kamar Khadijah", gedung: "Asrama Putri", lantai: 1, kapasitas: 6, jk: "P" },
    { id: "K-06", nama: "Kamar Aisyah", gedung: "Asrama Putri", lantai: 1, kapasitas: 6, jk: "P" },
  ],

  presensi: [
    { id: "P-0001", tanggal: "2026-07-21", siswaId: "S-0001", bangun: "Hadir", sholat: "Hadir", mengaji: "Hadir", sekolah: "Hadir", tidur: "Hadir", keterangan: "" },
    { id: "P-0002", tanggal: "2026-07-21", siswaId: "S-0002", bangun: "Hadir", sholat: "Hadir", mengaji: "Alpa", sekolah: "Hadir", tidur: "Hadir", keterangan: "Terlambat bangun" },
    { id: "P-0003", tanggal: "2026-07-21", siswaId: "S-0004", bangun: "Hadir", sholat: "Izin", mengaji: "Izin", sekolah: "Izin", tidur: "Hadir", keterangan: "Sakit" },
  ],

  perizinan: [
    { id: "IZ-0001", siswaId: "S-0003", jenis: "Pulang Akhir Pekan", tglKeluar: "2026-07-18", tglKembali: "2026-07-20", alasan: "Menjenguk keluarga", penjemput: "Bambang Ishaq", status: "Kembali", disetujuiOleh: "Abdal Ainuz Zaki, B.A." },
    { id: "IZ-0002", siswaId: "S-0004", jenis: "Sakit", tglKeluar: "2026-07-21", tglKembali: "2026-07-22", alasan: "Demam, dijemput orang tua ke puskesmas", penjemput: "Hadi Sutrisno", status: "Berjalan", disetujuiOleh: "Abdal Ainuz Zaki, B.A." },
  ],

  kebersihan: [
    { id: "KB-0001", tanggal: "2026-07-20", kamarId: "K-01", petugas: "Ahmad Fauzan Ramadhan", skor: 90, fotoSebelum: "", fotoSesudah: "", catatan: "Rapi, tempat tidur sudah dilipat" },
    { id: "KB-0002", tanggal: "2026-07-20", kamarId: "K-05", petugas: "Nur Aisyah Putri", skor: 75, fotoSebelum: "", fotoSesudah: "", catatan: "Lantai perlu disapu ulang" },
  ],

  jadwal_piket: [
    { id: "PK-0001", tanggal: "2026-07-22", area: "Dapur Umum", siswaId: "S-0001", shift: "Pagi", status: "Selesai" },
    { id: "PK-0002", tanggal: "2026-07-22", area: "Musholla", siswaId: "S-0004", shift: "Pagi", status: "Selesai" },
    { id: "PK-0003", tanggal: "2026-07-22", area: "Halaman", siswaId: "S-0006", shift: "Sore", status: "Belum" },
  ],

  pelanggaran: [
    { id: "PL-0001", siswaId: "S-0002", tanggal: "2026-07-15", kategori: "Ringan", jenis: "Terlambat sholat berjamaah", poin: 5, tindakan: "Teguran lisan + hafalan tambahan", pembina: "Abdal Ainuz Zaki, B.A.", status: "Selesai" },
    { id: "PL-0002", siswaId: "S-0006", tanggal: "2026-07-10", kategori: "Sedang", jenis: "Membawa HP tanpa izin", poin: 15, tindakan: "Sita barang + surat pernyataan", pembina: "Abdal Ainuz Zaki, B.A.", status: "Selesai" },
  ],

  prestasi: [
    { id: "PR-0001", siswaId: "S-0008", tanggal: "2026-06-10", kategori: "Akademik", nama: "Juara 1 Olimpiade Matematika Kab.", tingkat: "Kabupaten", penghargaan: "Piagam + Uang Pembinaan" },
    { id: "PR-0002", siswaId: "S-0007", tanggal: "2026-05-02", kategori: "Tahfidz", nama: "Khatam 5 Juz", tingkat: "Internal Asrama", penghargaan: "Sertifikat Tahfidz" },
  ],

  kesehatan: [
    { id: "KS-0001", siswaId: "S-0004", tanggal: "2026-07-21", keluhan: "Demam 38.2°C", tindakan: "Diberi obat penurun panas, istirahat di UKS", petugas: "Abdal Ainuz Zaki, B.A.", statusRujuk: "Tidak" },
  ],

  inventaris: [
    { id: "INV-0001", siswaId: "S-0001", nama: "Kasur & Bantal", jumlah: 1, kondisi: "Baik", tglMasuk: "2025-07-10" },
    { id: "INV-0002", siswaId: "S-0001", nama: "Lemari Pakaian", jumlah: 1, kondisi: "Baik", tglMasuk: "2025-07-10" },
    { id: "INV-0003", siswaId: "S-0004", nama: "Kipas Angin", jumlah: 1, kondisi: "Rusak Ringan", tglMasuk: "2025-07-10" },
  ],

  laundry: [
    { id: "LD-0001", siswaId: "S-0002", tglMasuk: "2026-07-20", jumlahKg: 2.5, status: "Selesai", tglAmbil: "2026-07-21", biaya: 12500 },
    { id: "LD-0002", siswaId: "S-0005", tglMasuk: "2026-07-21", jumlahKg: 1.8, status: "Proses", tglAmbil: "", biaya: 9000 },
  ],

  keuangan: [
    { id: "KU-0001", tanggal: "2026-07-01", jenis: "Pemasukan", kategori: "Kas Bulanan", jumlah: 5000000, keterangan: "Kas asrama bulan Juli", siswaId: "" },
    { id: "KU-0002", tanggal: "2026-07-10", jenis: "Pengeluaran", kategori: "Konsumsi", jumlah: 1200000, keterangan: "Belanja dapur mingguan", siswaId: "" },
    { id: "KU-0003", tanggal: "2026-07-15", jenis: "Pemasukan", kategori: "Denda", jumlah: 25000, keterangan: "Denda pelanggaran HP", siswaId: "S-0006" },
    { id: "KU-0004", tanggal: "2026-07-18", jenis: "Pengeluaran", kategori: "Perawatan Kamar", jumlah: 350000, keterangan: "Servis kipas angin", siswaId: "" },
  ],

  notifications: [
    { id: "N-0001", tipe: "Pelanggaran", judul: "Pelanggaran baru", pesan: "Salma Nur Fadhila — membawa HP tanpa izin", dibaca: false, waktu: "2026-07-21T08:10:00" },
    { id: "N-0002", tipe: "Perizinan", judul: "Izin sakit", pesan: "Nur Aisyah Putri — izin sakit, dijemput orang tua", dibaca: false, waktu: "2026-07-21T09:40:00" },
    { id: "N-0003", tipe: "Kesehatan", judul: "Pemeriksaan UKS", pesan: "Nur Aisyah Putri demam 38.2°C, sudah ditangani", dibaca: true, waktu: "2026-07-21T09:55:00" },
  ],

  audit_log: [
    { id: "AL-0001", waktu: "2026-07-21T07:00:00", user: "waliasrama", aksi: "LOGIN", detail: "Login berhasil", ip: "-" },
    { id: "AL-0002", waktu: "2026-07-21T08:12:00", user: "waliasrama", aksi: "CREATE", detail: "Menambah data pelanggaran PL-0002", ip: "-" },
  ],
};

/** Deep clone helper so seed data is never mutated across resets */
function cloneSeed(){
  return JSON.parse(JSON.stringify(MOCK_SEED));
}
