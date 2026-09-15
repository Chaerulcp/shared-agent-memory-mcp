# Perbandingan jalur vektor lokal, 14 September 2026

Eksperimen ini memakai [fixture dan metrik baseline](./retrieval-baseline-2026-09-14.md) yang sama: 12 memori sintetis berlabel, 16 kueri, dan empat template pengalih yang diulang hingga 100, 1.000, atau 10.000 catatan. Setiap ukuran memakai database sementara baru; model MiniLM lokal yang sama; unduhan model dinonaktifkan. Angka adalah satu run per konfigurasi di Windows x64, Node.js 22.14.0, Intel Core i5-11400H. Masing-masing mode menjalankan 16 kueri tiga kali setelah satu pemanasan. [Hasil perbandingan lama dan `vec0`](./vector-comparison-2026-09-14.json), [probe fungsi jarak SQL](./vector-sql-probe-2026-09-14.json), dan [hasil jalur produksi baru](./retrieval-after-vector-sql-2026-09-14.json) menyimpan metrik dan peringkat per kueri.

| Catatan | Jalur | Recall@5 | MRR@10 | p50 hangat | p95 hangat | SQLite setelah vektor |
|---:|---|---:|---:|---:|---:|---:|
| 100 | JS lama | 1,00 | 1,00 | 14,4 ms | 18,6 ms | 0,32 MiB |
| 100 | Produksi baru: fungsi SQL | 1,00 | 1,00 | 8,7 ms | 10,4 ms | 0,32 MiB |
| 1.000 | JS lama | 1,00 | 1,00 | 82,6 ms | 99,1 ms | 2,73 MiB |
| 1.000 | Produksi baru: fungsi SQL | 1,00 | 1,00 | 13,6 ms | 16,1 ms | 2,73 MiB |
| 10.000 | JS lama | 1,00 | 1,00 | 578,6 ms | 700,8 ms | 26,89 MiB |
| 10.000 | Produksi baru: fungsi SQL | 1,00 | 1,00 | 87,6 ms | 101,7 ms | 26,89 MiB |
| 10.000 | Hybrid baru | 1,00 | 1,00 | 92,5 ms | 108,0 ms | 26,89 MiB |

`sqlite-vec` mendukung tabel virtual `vec0` dan pencarian KNN; [proyek resminya masih pre-v1](https://github.com/asg017/sqlite-vec). Dalam probe terpisah, `vec0` pada 10.000 catatan mencapai p95 29,2 ms dengan Recall@5/MRR@10 tetap 1,00, tetapi database bertambah dari 26,89 menjadi sekitar 42,37 MiB setelah menyimpan salinan vektor kedua. Probe itu hanya memakai satu project/status homogen dan tidak mengukur pembaruan indeks maupun filter metadata produksi. Karena itu jalur aktif memakai fungsi `vec_distance_cosine` dari dependensi yang sama untuk memindai tabel embedding yang sudah ada. Filter diterapkan dalam SQL dan hanya memori hasil teratas yang diambil; tidak ada indeks vektor tambahan yang harus disinkronkan. Probe fungsi SQL mentah pada 10.000 catatan mencatat p95 70,3 ms, sedangkan jalur produksi lengkap 101,7 ms dalam run lain. Perbedaannya mencakup logika cache, filter, pembentukan hasil, dan variasi antar-run.

Saat `cache rebuild`/`sync`, perubahan judul atau konten menghapus embedding lama agar kueri berikutnya membuat ulang vektor yang tepat. Cache lama dibersihkan sekali saat pertama dibuka dengan skema konsistensi baru. Biaya pemanasan tetap besar: kueri semantic pertama pada 10.000 catatan dalam run produksi membutuhkan sekitar 31,3 detik untuk embedding, bukan latensi hangat di tabel. Pengujian unit memeriksa perubahan konten, pemakaian ulang embedding, filter metadata, dan hasil hybrid; fixture benchmark tetap terlalu mudah untuk menyimpulkan kualitas pencarian pada data nyata.

Langkah evaluasi berikutnya adalah menambah pengalih yang lebih beragam dan label pada memori nyata yang dianonimkan, lalu menguji fakta yang berada melewati 1.200 karakter. Jika skala aktual dan filter menunjukkan fungsi SQL ini kurang cepat, evaluasi `vec0` dapat diulang dengan pembaruan indeks dan filter yang setara sebelum mengaktifkannya.
