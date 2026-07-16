# Azy Pack Bridge v2.1

Website statis untuk memindai dan mengonversi aset resource pack ItemsAdder Java menjadi bundle Bedrock + Geyser langsung di browser.

## Perbaikan v2.1

- Memakai `height` dan `ascent` asli dari provider bitmap Java ketika membuat `font/glyph_XX.png`.
- Mode **Compat rank Bedrock** aktif secara default.
- Glyph lebar seperti rank/prefix dinormalisasi ke tinggi maksimal 9px agar advance width lebih kecil dan preview buku tidak mudah turun baris.
- Menyisakan baseline 1px untuk alignment rank yang lebih stabil.
- Laporan konversi mencatat berapa glyph lebar yang dikompakkan.

## Menjalankan

1. Extract folder ini.
2. Buka `index.html`, atau upload seluruh isi folder ke Netlify.
3. Upload ZIP folder `ItemsAdder/contents` atau generated Java resource pack hasil `/iazip`.
4. Biarkan **Compat rank Bedrock** aktif.
5. Tekan **Scan pack**, lalu **Download bundle ZIP**.

## Catatan rank

Untuk rank ItemsAdder tanpa properti `symbol`, gunakan generated resource pack hasil `/iazip`. File source `contents` saja tidak menyimpan codepoint otomatis yang dipilih ItemsAdder.

Rank yang sangat lebar masih dapat wrap pada buku Bedrock karena lebar halaman dan metrik font Java/Bedrock berbeda. Mode kompatibilitas mengurangi masalah ini tanpa membuang texture.

## Output

- `<pack>.mcpack` — Bedrock Resource Pack.
- `geyser/custom_mappings/<pack>_items.json` — mapping custom item Geyser v2.
- `conversion-report.json` — daftar aset dan hasil konversi.
- `INSTALL.txt` — petunjuk pemasangan.
