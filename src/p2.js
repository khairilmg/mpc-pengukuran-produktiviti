<script>
"use strict";
/* ================= KONFIGURASI & SKEMA ================= */
let MIN_WAGE = 1700;     // gaji minimum bulanan (RM), boleh dikemas kini oleh Master Admin
const TOL = 1;            // toleransi semakan integriti (RM)
const MAX_YEARS = 10;
const PBKDF2_ITER = 150000;
const CATS = { M: "Pembuatan (Manufacturing)", S: "Perkhidmatan (Services)", MI: "Mikro (Micro)" };
const CAT_NOTE = {
  M: "Syarikat yang mempunyai akaun pembuatan (kilang, pemprosesan).",
  S: "Syarikat perkhidmatan, perdagangan, pembinaan dan lain-lain tanpa akaun pembuatan.",
  MI: "Jualan tahunan kurang RM300,000 atau kurang 5 pekerja sepenuh masa. Borang ringkas: 4 angka setahun."
};
const SECTORS = [
  "Pertanian, Perhutanan & Perikanan", "Perlombongan & Pengkuarian", "Pembuatan",
  "Bekalan Elektrik, Gas, Wap & Penyaman Udara", "Bekalan Air, Pembetungan & Pengurusan Sisa", "Pembinaan",
  "Perdagangan Borong & Runcit", "Pengangkutan & Penyimpanan", "Penginapan & Perkhidmatan Makanan",
  "Maklumat & Komunikasi", "Kewangan & Insurans", "Hartanah", "Profesional, Saintifik & Teknikal",
  "Pentadbiran & Khidmat Sokongan", "Pendidikan", "Kesihatan Manusia & Kerja Sosial",
  "Kesenian, Hiburan & Rekreasi", "Perkhidmatan Lain", "Lain-lain"
];
const GROUPS = {
  A: "A. Penyata Untung Rugi",
  B: "B. Kos Buruh (tidak termasuk akaun pembuatan)",
  C: "C. Perbelanjaan Operasi Lain",
  D: "D. Akaun Pembuatan",
  E: "E. Stok & Pendapatan Operasi Lain",
  F: "F. Bukan Operasi & Untung Dilaporkan",
  G: "G. Aset Tetap & Pekerja",
  H: "Data Prestasi Syarikat Mikro"
};
const ALL = ["M", "S", "MI"], MS = ["M", "S"];
// k: kunci, l: label BM, en: label EN, g: kumpulan, c: kategori, n: nota/definisi, neg: boleh negatif, req: wajib
const FIELDS = [
  { k: "sales", g: "A", c: MS, req: 1, l: "Jualan Bersih / Hasil", en: "Net Sales / Revenue", n: "Jualan kasar tolak diskaun, pulangan dan rebat." },
  { k: "cos_mfg", g: "A", c: ["M"], l: "Kos Jualan (Dikilang)", en: "Cost of Sales (Manufactured)", n: "Stok awal barang siap + WIP awal + Jumlah kos pembuatan − WIP akhir − stok akhir barang siap." },
  { k: "cos_pur", g: "A", c: MS, l: "Kos Jualan (Belian)", en: "Cost of Sales (Purchase)", n: "Stok awal barang dibeli + belian − stok akhir barang dibeli. Dikira sebagai BIMS." },
  { k: "lab_wages", g: "B", c: MS, l: "Gaji dan upah", en: "Wages and salaries" },
  { k: "lab_ot", g: "B", c: MS, l: "Kerja lebih masa", en: "Overtime" },
  { k: "lab_bonus", g: "B", c: MS, l: "Komisen, bonus & faedah", en: "Commissions, bonuses & benefits" },
  { k: "lab_epf", g: "B", c: MS, l: "KWSP & PERKESO (caruman majikan)", en: "EPF & SOCSO by employer" },
  { k: "lab_training", g: "B", c: MS, l: "Yuran latihan pekerja", en: "Training fees" },
  { k: "lab_medical", g: "B", c: MS, l: "Perbelanjaan perubatan", en: "Medical expenses" },
  { k: "lab_directors", g: "B", c: MS, l: "Gaji pengarah bekerja", en: "Working directors' salary" },
  { k: "lab_levy", g: "B", c: MS, l: "Levi pekerja asing", en: "Foreign worker levy" },
  { k: "lab_others", g: "B", c: MS, l: "Lain-lain (pampasan, SIP, dll.)", en: "Others (compensation, EIS, etc.)" },
  { k: "dep", g: "C", c: MS, l: "Susut nilai", en: "Depreciation" },
  { k: "interest", g: "C", c: MS, l: "Faedah pinjaman", en: "Interest on borrowing", n: "Faedah pinjaman jangka pendek/panjang dan sewa beli." },
  { k: "itax", g: "C", c: MS, l: "Cukai tidak langsung & levi", en: "Indirect taxes & levies", n: "Cukai tanah, cukai pintu, cukai jalan, duti setem." },
  { k: "expenses_av", g: "C", c: MS, l: "Perbelanjaan (AV): derma, majlis tahunan", en: "Expenses (AV)", n: "Derma diluluskan LHDN, makan malam tahunan. Bukan BIMS." },
  { k: "util", g: "C", c: MS, l: "Utiliti (air, elektrik, bahan api)", en: "Utilities (BIMS)" },
  { k: "other_exp", g: "C", c: MS, l: "Perbelanjaan lain (BIMS)", en: "Other expenses (BIMS)", n: "Perjalanan, komunikasi, insurans, sewa, pengangkutan, pembungkusan, pembaikan, alat tulis, yuran profesional, dll." },
  { k: "m_material", g: "D", c: ["M"], l: "Kos bahan", en: "Material cost" },
  { k: "m_subcon", g: "D", c: ["M"], l: "Kos subkontrak", en: "Sub-contract cost" },
  { k: "m_labour", g: "D", c: ["M"], l: "Kos buruh kilang", en: "Factory labour cost" },
  { k: "m_dep", g: "D", c: ["M"], l: "Susut nilai (kilang)", en: "Depreciation (factory)" },
  { k: "m_itax", g: "D", c: ["M"], l: "Cukai tidak langsung & levi (kilang)", en: "Indirect taxes (factory)" },
  { k: "m_overhead", g: "D", c: ["M"], l: "Kos overhed kilang", en: "Factory overhead (BIMS)" },
  { k: "m_util", g: "D", c: ["M"], l: "Utiliti kilang", en: "Factory utilities (BIMS)" },
  { k: "m_other", g: "D", c: ["M"], l: "Overhed lain", en: "Other overheads (BIMS)" },
  { k: "fg_open", g: "E", c: ["M"], l: "Stok barang siap (awal tahun)", en: "Opening finished goods" },
  { k: "fg_close", g: "E", c: ["M"], l: "Stok barang siap (akhir tahun)", en: "Closing finished goods" },
  { k: "wip_open", g: "E", c: ["M"], l: "Kerja dalam proses (awal tahun)", en: "Opening WIP" },
  { k: "wip_close", g: "E", c: ["M"], l: "Kerja dalam proses (akhir tahun)", en: "Closing WIP" },
  { k: "own_con", g: "E", c: ["M"], l: "Pembinaan sendiri (dimodalkan)", en: "Own construction", n: "Isi hanya jika TIDAK termasuk dalam Jualan Bersih." },
  { k: "trade_income", g: "E", c: MS, l: "Jualan barang dibeli dalam keadaan asal", en: "Sales of goods purchased in same condition", n: "Isi hanya jika TIDAK termasuk dalam Jualan Bersih." },
  { k: "svc_income", g: "E", c: MS, l: "Pendapatan perkhidmatan", en: "Income from services rendered", n: "Isi hanya jika TIDAK termasuk dalam Jualan Bersih." },
  { k: "noi", g: "F", c: MS, l: "Pendapatan bukan operasi", en: "Non-operating income", n: "Faedah diterima, sewa diterima, keuntungan pelaburan/jualan aset." },
  { k: "noe", g: "F", c: MS, l: "Perbelanjaan bukan operasi", en: "Non-operating expenses", n: "Kerugian jualan aset/pelaburan, hutang lapuk luar biasa." },
  { k: "reported_pbt", g: "F", c: MS, req: 1, neg: 1, l: "Untung/(Rugi) Sebelum Cukai — seperti dalam penyata", en: "Profit/(Loss) before tax as reported", n: "Angka bebas daripada penyata kewangan untuk semakan integriti. Masukkan nilai negatif jika rugi." },
  { k: "fa_open", g: "G", c: MS, l: "Aset tetap (awal tahun)", en: "Fixed assets (beginning)", n: "Nilai buku bersih hartanah, loji & peralatan." },
  { k: "fa_close", g: "G", c: MS, l: "Aset tetap (akhir tahun)", en: "Fixed assets (end)" },
  { k: "emp_open", g: "G", c: MS, int: 1, l: "Bilangan pekerja (awal tahun)", en: "No. of employees (beginning)" },
  { k: "emp_close", g: "G", c: MS, int: 1, req: 1, l: "Bilangan pekerja (akhir tahun)", en: "No. of employees (end)" },
  { k: "mi_av", g: "H", c: ["MI"], req: 1, neg: 1, l: "Nilai Ditambah", en: "Added Value", n: "Untung + kos buruh + susut nilai + faedah + cukai; atau Jualan − bahan & perkhidmatan dibeli." },
  { k: "mi_labour", g: "H", c: ["MI"], req: 1, l: "Kos Buruh", en: "Labour Cost", n: "Gaji, upah, bonus dan caruman KWSP/PERKESO majikan, termasuk gaji atau ambilan pemilik yang bekerja." },
  { k: "mi_emp", g: "H", c: ["MI"], req: 1, l: "Bilangan Pekerja", en: "Number of Employees", n: "Termasuk pemilik dan ahli keluarga yang bekerja. Pekerja separuh masa dikira 0.5." },
  { k: "mi_sales", g: "H", c: ["MI"], req: 1, l: "Jumlah Jualan", en: "Total Sales" }
];
const FMAP = Object.fromEntries(FIELDS.map(f => [f.k, f]));
const fieldsFor = cat => FIELDS.filter(f => f.c.includes(cat));
const flabel = (f, cat) => (cat === "MI" && f.lmi) ? f.lmi : f.l;

/* ================= UTILITI ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isNum = x => typeof x === "number" && isFinite(x);
function fmt(x, dp = 0) {
  if (!isNum(x)) return "—";
  const s = Math.abs(x).toLocaleString("en-MY", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return x < 0 ? "(" + s + ")" : s;
}
const fmtIn = x => isNum(x) ? x.toLocaleString("en-MY", { maximumFractionDigits: 2 }) : "";
function parseNum(s) {
  s = String(s ?? "").trim();
  if (!s || s === "-" || s === "—") return null;
  let neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()\s,]/g, "").replace(/^RM/i, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return neg ? -n : n;
}
const div = (a, b) => (isNum(a) && isNum(b) && b !== 0) ? a / b : null;
const growth = (cur, prev) => (isNum(cur) && isNum(prev) && prev !== 0) ? (cur - prev) / Math.abs(prev) * 100 : null;
const nowIso = () => new Date().toISOString();
const fmtDate = s => s ? new Date(s).toLocaleString("ms-MY", { dateStyle: "medium", timeStyle: "short" }) : "—";
const clone = o => JSON.parse(JSON.stringify(o ?? null));
function median(a) { a = a.filter(isNum).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function randStr(n, chars) { const r = crypto.getRandomValues(new Uint32Array(n)); return Array.from(r, x => chars[x % chars.length]).join(""); }
const genId = () => "MPC-" + randStr(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
const genPw = () => randStr(4, "ABCDEFGHJKLMNPQRSTUVWXYZ") + randStr(4, "23456789") + randStr(2, "abcdefghjkmnpqrstuvwxyz");
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashPw(pw, saltB64, iter = PBKDF2_ITER) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return { salt: b64(salt), hash: b64(bits), iter };
}
async function verifyPw(pw, auth) {
  if (!auth?.salt) return false;
  const h = await hashPw(pw, auth.salt, auth.iter || PBKDF2_ITER);
  return h.hash === auth.hash;
}
function pwProblem(pw) {
  if (pw.length < 8) return "Kata laluan mesti sekurang-kurangnya 8 aksara.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Kata laluan mesti mengandungi huruf dan nombor.";
  return null;
}

/* ================= PENGIRAAN ================= */
function calc(cat, v) {
  const n = k => isNum(v?.[k]) ? v[k] : 0;
  const has = k => isNum(v?.[k]);
  const c = {};
  const avg2 = (a, b) => has(a) && has(b) ? (n(a) + n(b)) / 2 : has(b) ? n(b) : has(a) ? n(a) : null;
  c.emp = avg2("emp_open", "emp_close");
  c.fa = avg2("fa_open", "fa_close");
  c.int = n("interest"); c.expav = n("expenses_av"); c.reported = has("reported_pbt") ? n("reported_pbt") : null;
  if (cat === "MI") {
    c.av = n("mi_av"); c.labour = n("mi_labour"); c.output = n("mi_sales");
    c.emp = has("mi_emp") ? n("mi_emp") : null; c.fa = null;
    c.avAdd = c.avSub = c.av; c.bims = c.output - c.av;
    c.dep = c.int = c.tax = c.expav = 0; c.op = null; c.np = null; c.ti = null; c.tmc = 0; c.cosExp = null;
    return c;
  } else {
    const labNm = ["lab_wages", "lab_ot", "lab_bonus", "lab_epf", "lab_training", "lab_medical", "lab_directors", "lab_levy", "lab_others"].reduce((s, k) => s + n(k), 0);
    const isM = cat === "M";
    const m = k => isM ? n(k) : 0;
    c.tmc = ["m_material", "m_subcon", "m_labour", "m_dep", "m_itax", "m_overhead", "m_util", "m_other"].reduce((s, k) => s + m(k), 0);
    const extra = m("own_con") + n("trade_income") + n("svc_income");
    c.gm = n("sales") - m("cos_mfg") - n("cos_pur");
    c.op = c.gm + extra - labNm - n("dep") - n("interest") - n("itax") - n("expenses_av") - n("util") - n("other_exp");
    c.np = c.op + n("noi") - n("noe");
    c.output = n("sales") + (m("fg_close") - m("fg_open")) + (m("wip_close") - m("wip_open")) + extra;
    c.bims = n("cos_pur") + n("util") + n("other_exp") + m("m_material") + m("m_subcon") + m("m_overhead") + m("m_util") + m("m_other");
    c.labour = labNm + m("m_labour"); c.dep = n("dep") + m("m_dep"); c.tax = n("itax") + m("m_itax");
    c.cosExp = (isM && c.tmc > 0) ? m("fg_open") + m("wip_open") + c.tmc - m("wip_close") - m("fg_close") : null;
  }
  c.avAdd = c.labour + c.dep + c.int + c.tax + c.expav + c.op;
  c.avSub = c.output - c.bims;
  c.ti = c.bims + c.labour + c.dep + c.int + c.tax + c.expav;
  return c;
}
function checkMicro(v, c) {
  const items = [], warns = [];
  const miss = fieldsFor("MI").filter(f => !isNum(v?.[f.k]));
  if (miss.length || !(c.emp > 0)) { (miss.length ? miss : [FMAP.mi_emp]).forEach(f => items.push({ ok: 0, m: `${f.l} belum diisi.` })); return { status: "TIDAK LENGKAP", items, warns }; }
  let ok = true;
  if (c.av > c.output + TOL) { ok = false; items.push({ ok: 0, m: `Nilai Ditambah (RM ${fmt(c.av)}) melebihi Jumlah Jualan (RM ${fmt(c.output)}). Nilai Ditambah tidak boleh melebihi jualan.` }); }
  else items.push({ ok: 1, m: "Nilai Ditambah tidak melebihi Jumlah Jualan." });
  if (c.labour < 0 || c.output < 0) { ok = false; items.push({ ok: 0, m: "Kos buruh dan jualan tidak boleh negatif." }); }
  if (c.av <= 0) warns.push("Nilai Ditambah sifar atau negatif.");
  else if (c.labour > c.av) warns.push("Kos buruh melebihi Nilai Ditambah.");
  const lce = c.labour / c.emp, minY = MIN_WAGE * 12;
  if (c.labour > 0 && lce < minY) warns.push(`Kos buruh per pekerja (RM ${fmt(lce)} setahun) di bawah gaji minimum tahunan (RM ${fmt(minY)}). Pastikan gaji atau ambilan pemilik dimasukkan, dan pekerja separuh masa dikira 0.5.`);
  return { status: ok ? "LULUS" : "SEMAK", items, warns };
}
function check(cat, v, c) {
  if (cat === "MI") return checkMicro(v, c);
  const items = [], warns = [];
  const has = k => isNum(v?.[k]);
  let incomplete = false;
  if (!has("sales")) { items.push({ ok: 0, m: "Jualan Bersih belum diisi." }); incomplete = true; }
  if (!has("reported_pbt")) { items.push({ ok: 0, m: "Untung/(Rugi) Sebelum Cukai seperti dalam penyata belum diisi." }); incomplete = true; }
  if (!(c.emp > 0)) { items.push({ ok: 0, m: "Bilangan pekerja belum diisi." }); incomplete = true; }
  for (const f of fieldsFor(cat)) if (has(f.k) && v[f.k] < 0 && !f.neg) warns.push(`${flabel(f, cat)} bernilai negatif.`);
  if (incomplete) return { status: "TIDAK LENGKAP", items, warns };
  let ok = true;
  const dAV = c.avAdd - c.avSub;
  if (Math.abs(dAV) > TOL) {
    ok = false;
    let m = `Nilai Ditambah kaedah tambah (RM ${fmt(c.avAdd)}) tidak sama dengan kaedah tolak (RM ${fmt(c.avSub)}). Selisih RM ${fmt(dAV)}.`;
    if (c.cosExp != null) m += ` Berdasarkan stok dan Jumlah Kos Pembuatan, Kos Jualan (Dikilang) sepatutnya RM ${fmt(c.cosExp)}.`;
    if (cat === "MI") m += " Kemungkinan ada perbelanjaan yang belum diisi atau tersalah kategori.";
    items.push({ ok: 0, m });
  } else items.push({ ok: 1, m: "Nilai Ditambah kaedah tambah = kaedah tolak." });
  if (cat !== "MI") {
    const d = c.np - v.reported_pbt;
    if (Math.abs(d) > TOL) { ok = false; items.push({ ok: 0, m: `Untung dikira (RM ${fmt(c.np)}) berbeza daripada untung dalam penyata (RM ${fmt(v.reported_pbt)}). Selisih RM ${fmt(d)}: semak item yang tertinggal atau dimasukkan dua kali.` }); }
    else items.push({ ok: 1, m: "Untung dikira = untung dalam penyata kewangan." });
  }
  if (c.avAdd <= 0) warns.push("Nilai Ditambah sifar atau negatif.");
  else if (c.labour > c.avAdd) warns.push("Kos buruh melebihi Nilai Ditambah.");
  if (!isNum(c.fa) || c.fa === 0) warns.push("Aset tetap tidak diisi: petunjuk modal tidak dapat dikira.");
  return { status: ok ? "LULUS" : "SEMAK", items, warns };
}
const indsFor = cat => cat === "MI" ? IND.filter(d => d.mi) : IND;
const IND = [
  { k: "lp", mi: 1, l: "Produktiviti Buruh", en: "Labour Productivity", u: "RM", dp: 0, f: c => div(c.avAdd, c.emp), key: 1 },
  { k: "avlc", mi: 1, l: "Nilai Ditambah per Kos Buruh", en: "Added Value per Labour Cost", u: "nisbah", dp: 2, f: c => div(c.avAdd, c.labour) },
  { k: "lce", mi: 1, l: "Kos Buruh per Pekerja", en: "Labour Cost per Employee", u: "RM", dp: 0, f: c => div(c.labour, c.emp) },
  { k: "ulc", mi: 1, l: "Kos Buruh Seunit", en: "Unit Labour Cost", u: "nisbah", dp: 3, f: c => div(c.labour, c.output) },
  { k: "cp", l: "Produktiviti Modal", en: "Capital Productivity", u: "nisbah", dp: 2, f: c => div(c.avAdd, c.fa) },
  { k: "ope", l: "Output per Pekerja", en: "Total Output per Employee", u: "RM", dp: 0, f: c => div(c.output, c.emp) },
  { k: "fae", l: "Aset Tetap per Pekerja", en: "Fixed Assets per Employee", u: "RM", dp: 0, f: c => div(c.fa, c.emp) },
  { k: "ct", l: "Pusing Ganti Modal", en: "Capital Turnover", u: "nisbah", dp: 2, f: c => div(c.output, c.fa) },
  { k: "pe", l: "Kecekapan Proses", en: "Process Efficiency", u: "nisbah", dp: 2, f: c => div(c.avAdd, c.ti - c.bims) },
  { k: "plc", l: "% Kos Buruh dalam Jumlah Input", en: "% Labour Cost in Total Input", u: "%", dp: 1, f: c => { const r = div(c.labour, c.ti); return r == null ? null : r * 100; } },
  { k: "roa", l: "Pulangan atas Aset", en: "Return on Assets", u: "%", dp: 1, f: c => { const r = div(c.op, c.fa); return r == null ? null : r * 100; } },
  { k: "tpm", l: "Ukuran Produktiviti Keseluruhan", en: "Total Productivity Measure", u: "nisbah", dp: 2, f: c => div(c.output, c.ti) }
];
function computeAll(co) {
  const cat = co.category;
  const years = (co.years || []).slice().sort((a, b) => a - b);
  const out = [];
  years.forEach((y, i) => {
    const v = co.data?.[y] || {};
    const c = calc(cat, v);
    const chk = check(cat, v, c);
    const ind = {}; IND.forEach(d => ind[d.k] = d.f(c));
    const r = { year: y, v, c, chk, ind, gr: {}, comp: null };
    const p = out[i - 1];
    if (p) {
      r.prevYear = p.year;
      IND.forEach(d => r.gr[d.k] = growth(ind[d.k], p.ind[d.k]));
      const gs = growth(c.output, p.c.output);
      if (isNum(gs) && Math.abs(gs) > 50) chk.warns.push(`${cat === "MI" ? "Jumlah jualan" : "Jumlah output"} berubah ${fmt(gs, 1)}% berbanding ${p.year}: sila pastikan betul.`);
      const ga = growth(c.avAdd, p.c.avAdd);
      if (cat === "MI" && isNum(ga) && Math.abs(ga) > 50) chk.warns.push(`Nilai Ditambah berubah ${fmt(ga, 1)}% berbanding ${p.year}: sila pastikan betul.`);
      if (isNum(r.gr.lp) && isNum(r.gr.lce)) r.comp = r.gr.lp >= r.gr.lce;
    }
    out.push(r);
  });
  return out;
}
function summaryStatus(rows) {
  if (!rows.length) return { s: "TIADA DATA", n: 0, pass: 0 };
  const pass = rows.filter(r => r.chk.status === "LULUS").length;
  return { s: pass === rows.length ? "LULUS" : rows.some(r => r.chk.status === "TIDAK LENGKAP") ? "TIDAK LENGKAP" : "SEMAK", n: rows.length, pass };
}
const STATUS = {
  draf: ["Draf", "b-mut"], dihantar: ["Dihantar · menunggu semakan MPC", "b-info"],
  disahkan: ["Disahkan MPC", "b-good"], dikembalikan: ["Dikembalikan untuk pembetulan", "b-warn"]
};
const ACCT = { aktif: ["Aktif", "b-good"], menunggu: ["Menunggu kelulusan", "b-warn"], digantung: ["Digantung", "b-bad"] };
const badge = (map, k) => { const [t, cl] = map[k] || [k, "b-mut"]; return `<span class="badge ${cl}">${esc(t)}</span>`; };
function chkBadge(s) {
  if (s === "LULUS") return `<span class="badge b-good">✓ LULUS</span>`;
  if (s === "SEMAK") return `<span class="badge b-bad">✕ SEMAK</span>`;
  if (s === "TIDAK LENGKAP") return `<span class="badge b-warn">! TIDAK LENGKAP</span>`;
  return `<span class="badge b-mut">${esc(s)}</span>`;
}
</script>
