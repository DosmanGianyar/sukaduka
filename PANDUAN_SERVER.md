# Panduan Penggunaan & Deploy Server Aplikasi Suka Duka Sekolah

Aplikasi Web ini dibuat khusus untuk mempermudah pencatatan, rekapitulasi, pengelolaan iuran, penyaluran santunan sosial, serta pencetakan laporan tahunan lanskap mirip format Excel dinas.

---

## 1. Akun Login Pengurus (Siap Pakai)

Aplikasi telah dilengkapi dengan akun bawaan sesuai struktur kepengurusan:

| Peran | Username | Password Bawaan | Nama Pejabat |
| :--- | :--- | :--- | :--- |
| **Ketua** | `ketua` | `ketua123` | Nyoman Suwita, S.Pd, M.Pd |
| **Bendahara** | `bendahara` | `bendahara123` | Wayan Setiawati |
| **Sekretaris** | `sekretaris` | `sekretaris123` | I Putu Darma Putra |
| **Admin** | `admin` | `admin123` | Administrator Utama |

*(Kata sandi dapat diubah kapan saja melalui menu **Pengaturan & Akun** di dalam aplikasi).*

---

## 2. Cara Menjalankan di Komputer Lokal (Offline / Laptop)

Cukup **klik dua kali (double click)** file:
```
start.bat
```
Aplikasi akan otomatis menyalakan server dan membuka peramban web di alamat:
`http://localhost:3000`

Atau melalui terminal/PowerShell:
```bash
npm start
```

---

## 3. Cara Mengunggah (Deploy) ke Server Online (Bisa Diakses dari Mana Saja)

Aplikasi dibangun menggunakan **Node.js + Express + SQLite** yang sangat efisien dan tidak memerlukan server database terpisah seperti MySQL. Anda dapat mengunggahnya ke berbagai jenis server web:

### Opsi A: Deploy ke VPS (Ubuntu / Debian / CentOS)
1. Unggah seluruh folder proyek ke VPS (bisa via Git, SFTP, atau rsync).
2. Di terminal server, masuk ke direktori proyek dan pasang dependensi:
   ```bash
   npm install --omit=dev
   ```
3. Gunakan **PM2** agar aplikasi berjalan terus-menerus di latar belakang:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "sukaduka"
   pm2 startup
   pm2 save
   ```
4. Hubungkan dengan domain atau IP server melalui Nginx Reverse Proxy (port 3000) dan aktifkan SSL (HTTPS gratis via Certbot / Let's Encrypt).

### Opsi B: Deploy Menggunakan Docker (1 Perintah)
Proyek sudah dilengkapi dengan `Dockerfile` dan `docker-compose.yml`. Di server yang sudah terpasang Docker:
```bash
docker compose up -d
```
Aplikasi akan langsung berjalan di port 3000 dan data tersimpan persisten di folder `./data`.

### Opsi C: Deploy ke Cloud PaaS (Railway / Render)
1. Buat repositori Git (GitHub/GitLab) untuk proyek ini.
2. Buat project baru di **Railway.app** atau **Render.com**.
3. Hubungkan repositori Git.
4. Set perintah start: `npm start`.
5. Pasang persistent disk pada direktori `/app/data` agar database tersimpan permanen.

---

## 4. Fitur Utama Aplikasi

1. **Migrasi Otomatis Data Lama**:
   - Seluruh data anggota, NIP, iuran bulanan dari tahun 2022 s/d 2026, dan 110 transaksi pengeluaran dari file Excel `print 3 02 2026.xlsx` telah terserap utuh ke database.
2. **Rekap Iuran Bulanan (Spreadsheet Grid Interaktif)**:
   - Tampilan kisi 12 bulan (Januari s/d Desember) persis seperti Excel.
   - **Quick Pay**: Klik kiri kotak bulan untuk toggle LUNAS (Rp 50.000). Klik kanan untuk mengatur nominal khusus / catatan.
   - **Bayar Kolektif**: Tombol untuk melunasi satu bulan serentak bagi semua anggota aktif (misal pemotongan gaji rutin).
3. **Pengeluaran Santunan Suka Duka**:
   - Pencatatan santunan sakit, melahirkan, pernikahan, duka/kematian, serta cinderamata purna tugas.
4. **Laporan Siap Cetak (Landscape Mirip Excel)**:
   - Format lanskap A4/F4 dengan garis tabel tegas.
   - Rekapitulasi Kas: Saldo Awal, Total Pemasukan, Total Pengeluaran, Saldo Akhir Kas.
   - Kolom tanda tangan resmi: **Ketua (Nyoman Suwita, S.Pd, M.Pd)**, **Bendahara (Wayan Setiawati)**, dan **Sekretaris (I Putu Darma Putra)**.
   - Tombol **Export Excel (.xlsx)** untuk unduhan spreadsheet langsung.

