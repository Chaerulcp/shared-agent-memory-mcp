# Baseline retrieval lokal, 14 September 2026

Benchmark ini menjalankan jalur pencarian aktif pada working tree setelah perubahan reliabilitas P0. Dataset dan skrip ada di [`bench/retrieval-fixture.json`](../../bench/retrieval-fixture.json) dan [`bench/retrieval-benchmark.mjs`](../../bench/retrieval-benchmark.mjs); [hasil mentah JSON](./retrieval-baseline-2026-09-14.json) memuat peringkat setiap kueri. Ini bukan benchmark Notion langsung atau perbandingan independen dengan produk lain.

Fixture berisi 12 memori coding sintetis dan 16 kueri dengan satu ID relevan yang ditandai manual per kueri. Dua belas kueri menguji parafrasa Indonesia–Inggris; empat kueri kontrol memakai istilah yang memang ada di catatan. Empat template pengalih yang tidak berhubungan diulang secara deterministik hingga ukuran 100, 1.000, dan 10.000. Karena pengalihnya berulang dan jumlah label kecil, skor relevansi menguji regresi jalur pencarian, bukan kualitas pada koleksi pengguna nyata.

Setiap ukuran membangun snapshot SQLite baru. Mode dijalankan berurutan: keyword, semantic, lalu hybrid. Pembuatan indeks FTS5 diukur terpisah dari pencarian. Pencarian pertama per mode menjadi pemanasan; pada semantic, itu mencakup pemuatan model dan pembuatan vektor yang belum ada. Setelah itu 16 kueri dijalankan tiga kali (48 sampel) dan p50/p95 dihitung dengan nearest rank. Recall@5 adalah rerata proporsi label yang muncul pada lima hasil teratas; MRR@10 adalah rerata kebalikan peringkat label pertama pada sepuluh hasil teratas. Ukuran SQLite mencakup file database serta WAL/SHM jika ada. Model lokal yang sudah tersimpan berukuran 129,12 MiB. Unduhan jaringan dinonaktifkan selama benchmark.

Mesin: Windows x64, Node.js 22.14.0, Intel Core i5-11400H, 12 logical CPU. Satu run per konfigurasi; latensi dapat berubah pada mesin dan beban lain.

| Catatan | Mode | Recall@5 | MRR@10 | p50 hangat (ms) | p95 hangat (ms) | Pemanasan (ms) | Indeks FTS5 (ms) | SQLite (MiB) |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 100 | keyword | 0,25 | 0,25 | 3,9 | 5,1 | 4,4 | 23,5 | 0,13 |
| 100 | semantic | 1,00 | 1,00 | 18,6 | 23,1 | 1.918,4 | 23,5 | 0,32 |
| 100 | hybrid | 1,00 | 1,00 | 18,3 | 23,4 | 19,2 | 23,5 | 0,32 |
| 1.000 | keyword | 0,25 | 0,25 | 3,7 | 4,3 | 4,5 | 37,1 | 0,76 |
| 1.000 | semantic | 1,00 | 1,00 | 74,5 | 91,8 | 3.972,0 | 37,1 | 2,73 |
| 1.000 | hybrid | 1,00 | 1,00 | 73,0 | 82,5 | 95,7 | 37,1 | 2,73 |
| 10.000 | keyword | 0,25 | 0,25 | 2,6 | 3,9 | 2,7 | 187,7 | 7,12 |
| 10.000 | semantic | 1,00 | 1,00 | 646,6 | 722,4 | 33.454,5 | 187,7 | 26,89 |
| 10.000 | hybrid | 1,00 | 1,00 | 634,0 | 834,4 | 856,3 | 187,7 | 26,89 |

Keyword menemukan empat kueri kontrol dan melewatkan seluruh 12 kueri parafrasa. Semantic dan hybrid menemukan semua label pada fixture yang mudah ini. Yang lebih penting untuk arah pengembangan, p95 semantic naik dari 23,1 ms pada 100 catatan menjadi 722,4 ms pada 10.000; hybrid mencapai 834,4 ms. Ini sejalan dengan jalur aktif yang membaca seluruh kandidat dan menghitung kemiripan setiap vektor di proses aplikasi. Pemanasan semantic 10.000 catatan memerlukan sekitar 33,5 detik. Pemanasan hybrid tidak sebanding langsung karena vektor sudah dibuat oleh mode semantic sebelumnya.

Langkah teknik berikutnya adalah membandingkan pemindaian vektor saat ini dengan `sqlite-vec` yang sudah menjadi dependensi, memakai fixture yang sama dan koleksi pengalih yang lebih beragam. Setelah itu, tambahkan evaluasi potongan panjang: fixture saat ini belum menguji fakta yang berada di luar 1.200 karakter awal memori. Sebelum mengklaim kualitas produksi, kumpulkan label dari memori nyata yang telah dianonimkan dan ulangi run beberapa kali pada mesin yang terkendali.

Untuk mengulang setelah build dan model MiniLM tersedia di cache lokal:

```powershell
npm run build
npm run benchmark:retrieval -- --sizes 100,1000,10000 --modes keyword,semantic,hybrid --repeats 3 > baseline.json
```

Skrip hanya membuat database sementara di direktori temp sistem dan tidak mengakses Notion atau mengubah cache aplikasi. Jika model belum tersimpan secara lokal, mode semantic/hybrid gagal dengan jelas tanpa mengunduhnya saat benchmark.
