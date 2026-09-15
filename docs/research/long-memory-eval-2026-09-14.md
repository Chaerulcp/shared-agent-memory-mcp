# Evaluasi memori panjang, 14 September 2026

Jalur semantic lama hanya meng-embedding judul dan 1.200 karakter awal memori. Uji regresi baru menempatkan fakta di akhir catatan panjang, di luar rentang itu, lalu memastikan `memory_search` tetap menemukannya. Implementasi sekarang membagi konten menjadi potongan 1.200 karakter Unicode dengan langkah 1.000 karakter; judul diulang pada setiap potongan. SQLite menyimpan satu vektor per potongan dan merangking memori berdasarkan jarak terbaik dari seluruh potongannya. Memori tetap muncul sekali dalam hasil.

[Skrip evaluasi](../../bench/long-memory-eval.mjs) membuat tiga catatan sintetis sekitar 1.900 karakter dengan pembuka serupa sepanjang 1.825 karakter. Fakta yang berbeda ditempatkan di bagian akhir: rollback pembayaran, penyimpanan kredensial, dan pembaruan sesi. Tiga kueri Indonesia–Inggris diberi label manual. Skrip membandingkan ranking dari vektor potongan pertama saja dengan jalur semantic dan hybrid aktif, memakai model MiniLM q8 lokal yang sama; unduhan dinonaktifkan. [Hasil mentah](./long-memory-eval-2026-09-14.json) memuat ranking teratas setiap kueri.

| Metode | Fakta benar pada hasil pertama |
|---|---:|
| Hanya 1.200 karakter awal | 1 dari 3 |
| Semantic berbasis potongan | 3 dari 3 |
| Hybrid berbasis potongan | 3 dari 3 |

Pada [fixture pendek sebelumnya](./retrieval-after-chunking-2026-09-14.json), Recall@5 dan MRR@10 tetap 1,00 untuk semantic dan hybrid di 100, 1.000, serta 10.000 memori. Pada 10.000 memori pendek, p95 hangat semantic 97,4 ms dan hybrid 98,2 ms dalam satu run; sebelum potongan, masing-masing 101,7 ms dan 108,0 ms dalam run lain. Selisih kecil lintas run ini bukan bukti peningkatan kecepatan. Pembuatan embedding pertama untuk 10.000 memori pendek tetap sekitar 28,8 detik. Catatan panjang memerlukan lebih banyak vektor, penyimpanan, dan waktu pemanasan sesuai jumlah potongannya.

Cache versi lama dengan satu vektor per memori dimigrasikan sebagai cache sementara dan vektornya dibuat ulang pada kueri semantic berikutnya. Pengujian otomatis mencakup fakta di akhir, overlap pada batas potongan, karakter Unicode, migrasi cache, filter, dan hasil hybrid. Evaluasi tiga catatan ini membuktikan perbaikan regresi, bukan kualitas pada data pengguna. Belum ada koleksi memori nyata yang dianonimkan dan diberi label relevansi; pengujian itu masih diperlukan sebelum menetapkan kualitas produksi. Setelah evaluasi ini, hasil semantic/hybrid dengan kecocokan vektor juga menyertakan cuplikan potongan terbaik dan offset Unicode, sambil mempertahankan seluruh isi memori untuk kompatibilitas.

Untuk mengulang setelah `npm run build` dan model tersedia secara lokal:

```powershell
node bench/long-memory-eval.mjs
```
