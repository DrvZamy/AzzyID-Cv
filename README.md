# Azy Icon Bridge v2.4

Website statis khusus untuk mengonversi **rank PNG, font image/glyph, emoji, dan icon item 2D** dari ItemsAdder Java menjadi Bedrock Resource Pack + mapping Geyser.

## Fix utama v2.4

- Menghapus output glyph persegi panjang yang membuat rank terpotong dan melar.
- `font/glyph_XX.png` selalu memakai halaman persegi dengan grid 16×16 slot persegi.
- Ukuran halaman dibatasi ke 256×256, 512×512, atau 1024×1024.
- Rank 80×16 dengan height 13 diubah secara proporsional menjadi sekitar 64×13.
- Baseline ditempatkan pada area 16 px di bagian atas slot agar rank tidak turun beberapa baris.
- Fokus converter dipersempit ke icon/rank agar hasil lebih stabil.

## Bukan target v2.4

Sound, model 3D, `.bbmodel`, furniture, shader, entity mechanics, dan animasi kompleks tidak dikonversi. Gunakan workflow Bedrock khusus untuk aset tersebut.

## Menjalankan

1. Upload seluruh isi folder ini ke root repository GitHub/Netlify.
2. Pastikan folder `vendor` ikut di-upload.
3. Buka website dan upload generated resource pack hasil `/iazip`.
4. Tekan **Scan icon pack** lalu **Download icon bundle ZIP**.
5. Salin `.mcpack` ke folder `Geyser/packs/`.
6. Salin mapping JSON ke `Geyser/custom_mappings/`.
7. Restart Geyser dan hapus cache resource pack lama di Minecraft Bedrock.

## Output

- `<pack>.mcpack`
- `geyser/custom_mappings/<pack>_items.json`
- `conversion-report.json`
- `INSTALL.txt`

Generated pack `/iazip` diperlukan ketika ItemsAdder menentukan karakter Unicode secara otomatis.
