# Sistem Pengukuran Produktiviti Syarikat (MPC) — versi Cloudflare

Aplikasi web untuk mengukur produktiviti syarikat bagi **Sistem Gaji Berasaskan Produktiviti (PLWS)**, Perbadanan Produktiviti Malaysia. Ia berjalan di **Cloudflare Pages** dengan **Pages Functions** (API) dan pangkalan data **D1**.

## Fungsi

- Log masuk syarikat (ID + kata laluan) dan Master Admin, disahkan di pelayan. Sesi 12 jam. 5 cubaan gagal mengunci akaun selama 15 minit.
- Daftar sendiri (menunggu kelulusan MPC) atau akaun dicipta oleh Master Admin dengan kata laluan sementara.
- Data kewangan 1–10 tahun mengikut templat: Pembuatan, Perkhidmatan, Mikro (4 medan).
- Data fizikal (10 petunjuk + 3 "lain-lain"; senarai khas mikro).
- Semakan integriti, yang juga dikuatkuasakan di pelayan semasa penghantaran.
- 12 petunjuk produktiviti (4 untuk mikro), daya saing kos buruh, median sektor, carta, eksport Excel.
- Analisis automatik + ulasan naratif oleh Claude (pilihan).
- Muat naik penyata PDF/Excel dengan pengekstrakan oleh Claude (pilihan).
- Aliran kerja: Draf → Dihantar → Disahkan / Dikembalikan.
- Master Admin: papan pemuka, senarai, kelulusan, semakan, set semula kata laluan, eksport, gaji minimum.
- Setiap syarikat hanya boleh membaca dan mengubah data sendiri.

## Struktur

```
public/index.html          Frontend (dijana oleh build.sh — jangan edit terus)
worker.js                  Titik masuk Worker (/api/* → API, lain-lain → public/)
wrangler.jsonc             Konfigurasi Worker + D1
functions/api/[[path]].js  API: log masuk, sesi, syarikat, admin, penanda aras, proksi Claude
functions/_lib/calc.js     Logik pengiraan untuk pelayan (dijana oleh build.sh)
src/                       Sumber frontend: p1.html (UI/CSS), p2.js (skema & pengiraan),
                           p4.js (data fizikal & analisis), api.js (lapisan API), p3.js (paparan & tindakan)
schema.sql                 Skema D1
data/seed-dummy.sql        Data dummy 3 syarikat (2021–2025)
data/dummy/*.json          Data dummy yang sama dalam JSON
tests/e2e.js               Ujian hujung-ke-hujung (Playwright) terhadap wrangler pages dev
templat-excel/             Templat Excel Manufacturing dengan formula integriti dibetulkan
legacy/                    Versi lama untuk claude.ai artifact
wrangler.toml.contoh       Contoh konfigurasi untuk deploy melalui CLI / pembangunan setempat
```

## Deploy sebagai Cloudflare Worker (disyorkan)

Projek ini mengandungi `worker.js` dan `wrangler.jsonc` (Worker `mpc-pengukuran-produktiviti`, fail statik dari `public/`, D1 `mpc-produktiviti`).

1. Cipta D1 `mpc-produktiviti`, jalankan `schema.sql` (dan `data/seed-dummy.sql` jika mahu) di Console. Jika ID D1 anda berbeza, kemas kini `database_id` dalam `wrangler.jsonc`.
2. Muat naik repositori ke GitHub.
3. Di Cloudflare: **Workers & Pages → mpc-pengukuran-produktiviti → Settings → Build → Connect** ke repositori GitHub. Deploy command: `npx wrangler deploy`. Atau, dari komputer sendiri: `npx wrangler login` kemudian `npx wrangler deploy`.
4. **Settings → Variables and Secrets**: tambah `ADMIN_SETUP_KEY` (Secret), dan pilihan `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `AI_DAILY_LIMIT`.
5. Deploy semula, kemudian sediakan Master Admin di tab Master Admin.

## Alternatif: deploy sebagai Cloudflare Pages (papan pemuka + GitHub)

Projek Cloudflare Pages yang dibuat dengan "drag and drop" **tidak menjalankan folder `functions/`**. Gunakan sambungan GitHub seperti di bawah.

1. **Muat naik repositori ke GitHub.** Seret semua kandungan folder ini ke `https://github.com/<akaun>/<repo>/upload/main` dan klik Commit changes.
2. **Cipta pangkalan data D1.** Di papan pemuka Cloudflare: **Storage & Databases → D1 → Create**, namakan `mpc-produktiviti`.
   - Buka tab **Console**, tampal kandungan `schema.sql` dan klik **Execute**.
   - (Pilihan) Tampal juga `data/seed-dummy.sql` untuk data dummy 3 syarikat.
3. **Cipta projek Pages.** **Workers & Pages → Create → Pages → Connect to Git** dan pilih repositori. Tetapan binaan:
   - Framework preset: **None**
   - Build command: *(kosong)*
   - Build output directory: **public**
4. **Sambungkan D1.** Dalam projek: **Settings → Bindings → Add → D1 database**.
   - Variable name: **DB**
   - Database: **mpc-produktiviti**
5. **Tetapkan pemboleh ubah.** **Settings → Variables and Secrets**:

   | Nama | Jenis | Nilai |
   |---|---|---|
   | `ADMIN_SETUP_KEY` | Secret | Rentetan rawak panjang (wajib; untuk mencipta Master Admin pertama) |
   | `ANTHROPIC_API_KEY` | Secret | Kunci API Claude (pilihan; mengaktifkan pengekstrakan & ulasan naratif) |
   | `CLAUDE_MODEL` | Text | Pilihan; lalai `claude-sonnet-5-5` |
   | `AI_DAILY_LIMIT` | Text | Pilihan; panggilan Claude sehari bagi setiap pengguna (lalai 40) |

6. **Deploy semula.** **Deployments → … → Retry deployment**, supaya binding dan pemboleh ubah berkuat kuasa.
7. **Sediakan Master Admin.** Buka laman, pilih tab **Master Admin**, masukkan nilai `ADMIN_SETUP_KEY`, dan tetapkan ID serta kata laluan admin.

Setiap commit ke cabang `main` selepas ini dideploy secara automatik.

## Pembangunan setempat

```bash
npm i -g wrangler                       # atau npx wrangler
cp wrangler.toml.contoh wrangler.toml
echo "ADMIN_SETUP_KEY=uji-kunci-setempat" > .dev.vars
wrangler d1 execute mpc-produktiviti --local --file=schema.sql
./build.sh
wrangler pages dev public               # http://127.0.0.1:8788

# Ujian (terminal lain)
cd tests && npm install && npx playwright install chromium && npm test
```

Selepas mengedit `src/`, jalankan `./build.sh` dan commit `public/index.html` serta `functions/_lib/calc.js` bersama sumbernya.

## Keselamatan

- Kata laluan: PBKDF2-SHA256 (100,000 lelaran, iaitu had Cloudflare Workers) dengan garam rawak. Kata laluan tidak disimpan dalam teks biasa.
- Sesi: token rawak dalam cookie `HttpOnly; Secure; SameSite=Strict`. Hanya hash token disimpan dalam D1.
- Permintaan yang mengubah data mesti JSON (perlindungan CSRF bersama SameSite).
- Kunci API Claude hanya berada di pelayan.
- Sebelum digunakan untuk data sebenar, dapatkan kelulusan unit ICT MPC mengenai lokasi penyimpanan data (Cloudflare) dan pematuhan PDPA serta dasar pengkomputeran awan sektor awam.

## Pertanyaan

espo@mpc.gov.my
