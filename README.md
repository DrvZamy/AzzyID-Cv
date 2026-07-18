# Azy Icon Bridge v2.5

Website statis untuk mengonversi rank PNG, prefix, emoji, font glyph, dan icon item 2D dari resource pack ItemsAdder Java menjadi Bedrock Resource Pack + mapping Geyser.

## Fix utama v2.5

- Rasio rank dipertahankan tepat. Contoh `80×16` dengan Java `height: 13` menjadi `65×13` (tetap 5:1).
- Downscale memakai filter kualitas tinggi agar tulisan rank tidak kasar/burik.
- Rank lebar memakai baseline median pack agar satu nilai `ascent/y_position` yang berbeda tidak membuat prefix naik atau turun sendiri.
- Provider font diproses deterministik; generated Java font lebih diprioritaskan daripada definisi YAML yang sama.
- Semua opsi tampilan sekarang berupa checkbox sungguhan dan dapat dicentang atau dilepas.
- Glyph page tetap persegi dan dibagi menjadi grid 16×16, tetapi ukuran sel tidak lagi dipaksa ke 16/32/64.

## Menjalankan

1. Upload seluruh isi folder ini ke Netlify/GitHub Pages.
2. Pastikan folder `vendor/` ikut di-upload.
3. Upload generated Java resource pack hasil `/iazip` ke website.
4. Untuk rank, biarkan opsi **Pertahankan rasio**, **Filter kualitas tinggi**, **Ratakan posisi rank**, dan **Pertahankan urutan provider** tetap aktif.
5. Download bundle, pasang `.mcpack` ke `Geyser/packs/`, dan mapping ke `Geyser/custom_mappings/`.
6. Hapus cache resource pack Bedrock lama sebelum mengetes ulang.

## Fokus converter

- Rank/prefix PNG
- Emoji dan icon chat
- Bitmap font glyph
- Icon custom item 2D

Sound, model 3D, BBModel, furniture, shader, dan animasi kompleks sengaja tidak dipaksakan pada mode ini.
