// DIJANA OLEH build.sh daripada src/p2.js + src/p4.js — jangan edit terus
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
"use strict";
/* ================= DATA FIZIKAL ================= */
const PHYS = [
  { k: "customers", c: ["MI"], l: "Purata pelanggan sehari", en: "Average customers per day", u: "orang", dir: 1, n: "Jumlah pelanggan setahun ÷ hari beroperasi." },
  { k: "mkt_share", l: "Pegangan pasaran", en: "Market share", u: "%", dir: 1, max: 100, n: "Jualan syarikat ÷ jumlah jualan pasaran × 100." },
  { k: "out_target", l: "Output berbanding sasaran", en: "Production output per target", u: "%", dir: 1, max: 300, n: "Output sebenar ÷ output sasaran × 100." },
  { k: "waste_pct", c: ["M", "S", "MI"], l: "Pembaziran", en: "Wastages", u: "%", dir: -1, max: 100, n: "Kuantiti bahan dibazirkan ÷ jumlah bahan digunakan × 100." },
  { k: "waste_rm", l: "Nilai pembaziran", en: "Wastages", u: "RM", dir: -1, n: "Nilai bahan/produk dibazirkan dalam setahun." },
  { k: "reject", l: "Kadar penolakan", en: "Reject rate", u: "%", dir: -1, max: 100, n: "Unit ditolak ÷ jumlah unit dikeluarkan × 100." },
  { k: "rework_pct", l: "Kerja semula", en: "Rework", u: "%", dir: -1, max: 100, n: "Unit dikerja semula ÷ jumlah unit dikeluarkan × 100." },
  { k: "rework_rm", l: "Kos kerja semula", en: "Rework", u: "RM", dir: -1, n: "Kos kerja semula dalam setahun." },
  { k: "turnover", c: ["M", "S", "MI"], l: "Kadar pusing ganti pekerja", en: "Employee turnover rate", u: "%", dir: -1, max: 100, n: "Bilangan pekerja berhenti ÷ purata bilangan pekerja × 100." },
  { k: "accident", l: "Kadar kemalangan", en: "Accident rate", u: "%", dir: -1, max: 100, n: "Bilangan kemalangan di tempat kerja ÷ bilangan pekerja × 100." },
  { k: "absent", c: ["M", "S", "MI"], l: "Kadar ketidakhadiran", en: "Absenteeism rate", u: "%", dir: -1, max: 100, n: "Hari tidak hadir ÷ jumlah hari bekerja dijadualkan × 100." }
];
const PCUST = ["c1", "c2", "c3"];
const physFor = cat => PHYS.filter(d => (d.c || ["M", "S"]).includes(cat));
function physDefs(co) {
  const cu = co.physCustom || [];
  return physFor(co.category).concat(PCUST.map((k, i) => ({ k, custom: i, l: cu[i]?.name || "", en: "Lain-lain (nyatakan)", u: cu[i]?.unit || "", dir: cu[i]?.dir === -1 ? -1 : 1 })).filter(d => d.l));
}
function physRange(d, v) {
  if (!isNum(v)) return null;
  if (v < 0) return "Nilai tidak boleh negatif.";
  if (d.max && v > d.max) return `Melebihi ${d.max}${d.u}.`;
  return null;
}
function physTableHtml(co, ro) {
  const years = (co.years || []).slice().sort((a, b) => a - b);
  const defs = ro ? physDefs(co) : physFor(co.category).concat(PCUST.map((k, i) => ({ k, custom: i, l: co.physCustom?.[i]?.name || "", u: co.physCustom?.[i]?.unit || "", dir: co.physCustom?.[i]?.dir === -1 ? -1 : 1 })));
  const lk = !ro && isLocked();
  let h = `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Petunjuk Fizikal</th>${years.map(y => `<th>${y}</th>`).join("")}<th>Arah lebih baik</th></tr></thead><tbody>`;
  for (const d of defs) {
    let label;
    if (d.custom != null && !ro) {
      const cu = co.physCustom?.[d.custom] || {};
      label = `<div class="row" style="gap:6px;flex-wrap:nowrap"><input type="text" placeholder="Lain-lain ${d.custom + 1}: nyatakan" value="${esc(cu.name)}" data-cf="${d.custom}" data-cp="name" ${lk ? "disabled" : ""} style="min-width:150px">
        <input type="text" placeholder="Unit" value="${esc(cu.unit)}" data-cf="${d.custom}" data-cp="unit" ${lk ? "disabled" : ""} style="width:70px"></div>`;
    } else label = `<div class="fl">${esc(d.l)} <span class="muted">(${esc(d.u)})</span><small>${esc(d.en)}${d.n ? " · " + esc(d.n) : ""}</small></div>`;
    h += `<tr><td>${label}</td>`;
    for (const y of years) {
      const v = co.phys?.[y]?.[d.k], bad = physRange(d, v);
      if (ro) h += `<td class="num">${isNum(v) ? fmt(v, d.u === "RM" || Number.isInteger(v) ? 0 : 2) : ""}</td>`;
      else h += `<td class="in ${bad ? "bad" : ""}"><input type="text" inputmode="decimal" data-py="${y}" data-pk="${d.k}" value="${esc(fmtIn(v))}" title="${esc(bad || "")}" ${lk ? "disabled" : ""}></td>`;
    }
    const dirTxt = d.dir === 1 ? "▲ Lebih tinggi" : "▼ Lebih rendah";
    h += `<td>${d.custom != null && !ro ? `<select data-cf="${d.custom}" data-cp="dir" ${lk ? "disabled" : ""} style="width:auto"><option value="1" ${d.dir === 1 ? "selected" : ""}>▲ Lebih tinggi</option><option value="-1" ${d.dir === -1 ? "selected" : ""}>▼ Lebih rendah</option></select>` : `<span class="small muted">${dirTxt}</span>`}</td></tr>`;
  }
  return h + `</tbody></table></div>`;
}
function renderPhys() {
  const co = S.co, years = co.years || [], lk = isLocked();
  $("#view").innerHTML = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><h2>Data Fizikal</h2><p class="muted small" style="margin:0">Petunjuk prestasi bukan kewangan daripada rekod operasi syarikat. Isi secara manual bagi tahun yang ada rekod; medan yang tiada rekod boleh dibiarkan kosong. Tahun dikongsi dengan Data Kewangan (maksimum ${MAX_YEARS}).</p></div>
      <div class="row">${lk ? "" : `<input type="number" id="new-year" placeholder="Tahun" min="1990" max="${new Date().getFullYear() + 1}" style="width:110px">
        <button class="btn" data-act="add-year" ${years.length >= MAX_YEARS ? "disabled" : ""}>+ Tambah tahun</button>
        <button class="btn p" data-act="save" id="btn-save" ${S.dirty ? "" : "disabled"}>Simpan</button>`}</div></div>
    <div id="data-msg" style="margin-top:10px">${S.dirty ? `<div class="msg warn">Perubahan belum disimpan.</div>` : ""}</div>
    ${years.length ? physTableHtml(co, false) : `<div class="msg info">Belum ada tahun. Tambah tahun kewangan di atas atau di tab Data Kewangan.</div>`}
    <p class="small muted">Untuk petunjuk "Lain-lain", nyatakan nama, unit dan arah yang lebih baik (contoh: Masa kitaran, minit, ▼ Lebih rendah).</p></div>`;
}
function onPhysInput(inp) {
  const y = +inp.dataset.py, k = inp.dataset.pk, v = parseNum(inp.value), td = inp.parentElement;
  const d = PHYS.find(p => p.k === k) || { k };
  if (Number.isNaN(v) || physRange(d, v)) { td.classList.add("bad"); inp.title = Number.isNaN(v) ? "Nombor tidak sah." : physRange(d, v); if (Number.isNaN(v)) return; }
  else { td.classList.remove("bad"); inp.title = ""; }
  const co = S.co; co.phys = co.phys || {}; co.phys[y] = co.phys[y] || {};
  if (v == null) delete co.phys[y][k]; else co.phys[y][k] = v;
  setDirty(true);
}
function onCustInput(el) {
  const i = +el.dataset.cf, p = el.dataset.cp, co = S.co;
  co.physCustom = co.physCustom || [{}, {}, {}];
  while (co.physCustom.length < 3) co.physCustom.push({});
  co.physCustom[i] = co.physCustom[i] || {};
  co.physCustom[i][p] = p === "dir" ? +el.value : el.value.trim();
  setDirty(true);
}

/* ================= ANALISIS PRODUKTIVITI ================= */
const cagr = (a, b, n) => (isNum(a) && isNum(b) && a > 0 && b > 0 && n > 0) ? (Math.pow(b / a, 1 / n) - 1) * 100 : null;
const pctTxt = (x, dp = 1) => isNum(x) ? (x >= 0 ? "+" : "−") + fmt(Math.abs(x), dp) + "%" : "—";
function analyze(co, bench) {
  const rows = computeAll(co);
  const A = { sections: [], good: [], bad: [], recs: [], facts: {} };
  if (!rows.length) return A;
  const f = rows[0], l = rows[rows.length - 1], span = l.year - f.year, multi = rows.length > 1;
  const ss = summaryStatus(rows);
  const sec = (title, paras, items = []) => A.sections.push({ title, paras, items });
  const good = t => { A.good.push(t); return { t: "good", text: t }; };
  const bad = t => { A.bad.push(t); return { t: "bad", text: t }; };
  const info = t => ({ t: "info", text: t });
  const rec = (t, why) => { if (!A.recs.some(r => r.t === t)) A.recs.push({ t, why }); };

  // 1. Gambaran keseluruhan
  const p1 = [`Analisis merangkumi <b>${rows.length} tahun</b> (${f.year}${multi ? "–" + l.year : ""}) bagi ${esc(co.name)} (${esc(CATS[co.category])}, sektor ${esc(co.sector || "—")}).`];
  const it1 = [];
  if (ss.s !== "LULUS") { it1.push(bad(`${ss.n - ss.pass} daripada ${ss.n} tahun belum LULUS semakan integriti; petunjuk bagi tahun tersebut mungkin tidak tepat.`)); rec("Betulkan data kewangan yang gagal semakan integriti sebelum keputusan digunakan untuk PLWS.", "Integriti data"); }
  else it1.push(info(`Semua ${ss.n} tahun LULUS semakan integriti data.`));
  p1.push(`Pada ${l.year}, Nilai Ditambah ialah <b>RM ${fmt(l.c.avAdd)}</b> dengan purata <b>${fmt(l.c.emp, 1)}</b> pekerja, menghasilkan produktiviti buruh <b>RM ${fmt(l.ind.lp)}</b> setiap pekerja.`);
  if (multi) {
    const gLP = cagr(f.ind.lp, l.ind.lp, span), gAV = cagr(f.c.avAdd, l.c.avAdd, span), gE = cagr(f.c.emp, l.c.emp, span), gLC = cagr(f.ind.lce, l.ind.lce, span);
    A.facts = { gLP, gAV, gE, gLC };
    if (isNum(gLP)) {
      p1.push(`Dari ${f.year} hingga ${l.year}, produktiviti buruh berubah purata <b>${pctTxt(gLP)} setahun</b>: Nilai Ditambah ${pctTxt(gAV)} setahun, bilangan pekerja ${pctTxt(gE)} setahun, dan kos buruh per pekerja ${pctTxt(gLC)} setahun.`);
      if (gLP > 0) it1.push(good(`Produktiviti buruh meningkat purata ${pctTxt(gLP)} setahun.`)); else it1.push(bad(`Produktiviti buruh menurun purata ${pctTxt(gLP)} setahun.`));
    } else if (isNum(f.ind.lp) && isNum(l.ind.lp)) p1.push(`Produktiviti buruh berubah daripada RM ${fmt(f.ind.lp)} kepada RM ${fmt(l.ind.lp)}.`);
    const g1 = l.gr.lp;
    if (isNum(g1)) p1.push(`Berbanding ${l.prevYear}, produktiviti buruh ${l.year} berubah <b>${pctTxt(g1)}</b>.`);
  }
  if (l.c.avAdd <= 0) { it1.push(bad(`Nilai Ditambah ${l.year} sifar atau negatif.`)); rec("Kaji semula struktur kos dan harga jualan kerana syarikat tidak menjana nilai ditambah positif.", "Nilai Ditambah negatif"); }
  sec("1. Gambaran Keseluruhan", p1, it1);

  // 2. Punca perubahan produktiviti buruh
  if (multi && f.ind.lp > 0 && l.ind.lp > 0 && f.c.output > 0 && l.c.output > 0) {
    const r0 = f.c.avAdd / f.c.output, r1 = l.c.avAdd / l.c.output, o0 = f.ind.ope, o1 = l.ind.ope;
    const tot = Math.log(l.ind.lp / f.ind.lp), cR = Math.log(r1 / r0), cO = Math.log(o1 / o0);
    const p2 = [`Produktiviti buruh = (Nilai Ditambah ÷ Output) × (Output ÷ Pekerja). Ini menunjukkan sama ada perubahan datang daripada <b>keupayaan menjana nilai</b> daripada setiap ringgit output, atau daripada <b>jumlah output setiap pekerja</b>.`];
    const it2 = [];
    p2.push(`Nisbah Nilai Ditambah kepada Output berubah daripada <b>${fmt(r0 * 100, 1)}%</b> (${f.year}) kepada <b>${fmt(r1 * 100, 1)}%</b> (${l.year}); output per pekerja daripada <b>RM ${fmt(o0)}</b> kepada <b>RM ${fmt(o1)}</b>.`);
    p2.push(`Dalam tempoh ini, nisbah nilai ditambah berubah <b>${pctTxt((r1 / r0 - 1) * 100)}</b> dan output per pekerja <b>${pctTxt((o1 / o0 - 1) * 100)}</b>, menghasilkan perubahan produktiviti buruh <b>${pctTxt((l.ind.lp / f.ind.lp - 1) * 100)}</b>. Faktor utama: <b>${Math.abs(cO) >= Math.abs(cR) ? "output per pekerja" : "nisbah nilai ditambah"}</b>.`);
    if (r1 > r0) it2.push(good(`Nisbah nilai ditambah meningkat: syarikat menjana lebih banyak nilai daripada setiap ringgit output (kos bahan & perkhidmatan dibeli lebih cekap atau harga lebih baik).`));
    else if (r1 < r0) { it2.push(bad(`Nisbah nilai ditambah menurun daripada ${fmt(r0 * 100, 1)}% kepada ${fmt(r1 * 100, 1)}%: kos bahan dan perkhidmatan dibeli (BIMS) meningkat lebih cepat daripada output.`)); rec("Kawal kos bahan dan perkhidmatan dibeli: rundingan pembekal, kurangkan pembaziran, dan tingkatkan produk/perkhidmatan bernilai tinggi.", "Nisbah nilai ditambah menurun"); }
    if (o1 > o0) it2.push(good(`Output per pekerja meningkat ${pctTxt(cagr(o0, o1, span))} setahun.`));
    else if (o1 < o0) { it2.push(bad(`Output per pekerja menurun ${pctTxt(cagr(o0, o1, span))} setahun.`)); rec("Tingkatkan output per pekerja melalui penambahbaikan proses (Lean, 5S), automasi dan latihan kemahiran.", "Output per pekerja menurun"); }
    if (f.c.fa > 0 && l.c.fa > 0) {
      const ki0 = f.ind.fae, ki1 = l.ind.fae;
      p2.push(`Dari sudut modal: aset tetap per pekerja berubah daripada RM ${fmt(ki0)} kepada RM ${fmt(ki1)} (${pctTxt(cagr(ki0, ki1, span))} setahun), manakala produktiviti modal berubah daripada ${fmt(f.ind.cp, 2)} kepada ${fmt(l.ind.cp, 2)}.`);
      if (ki1 > ki0 && l.ind.cp < f.ind.cp) { it2.push(bad("Pelaburan aset per pekerja meningkat tetapi produktiviti modal menurun: aset baharu belum digunakan sepenuhnya.")); rec("Tingkatkan penggunaan aset sedia ada (penyelenggaraan produktif menyeluruh, perancangan pengeluaran) sebelum pelaburan baharu.", "Produktiviti modal menurun"); }
    }
    sec("2. Punca Perubahan Produktiviti Buruh", p2, it2);
  }

  // 3. Daya saing kos buruh & PLWS
  const p3 = [], it3 = [];
  const comps = rows.filter(r => r.comp != null);
  if (comps.length) {
    const yes = comps.filter(r => r.comp).map(r => r.year), no = comps.filter(r => !r.comp).map(r => r.year);
    p3.push(`Kos buruh dikira kompetitif apabila pertumbuhan produktiviti buruh sama atau melebihi pertumbuhan kos buruh per pekerja. Kompetitif: <b>${yes.join(", ") || "tiada"}</b>; tidak kompetitif: <b>${no.join(", ") || "tiada"}</b>.`);
    if (l.comp === false) { it3.push(bad(`Pada ${l.year}, kos buruh per pekerja (${pctTxt(l.gr.lce)}) meningkat lebih cepat daripada produktiviti buruh (${pctTxt(l.gr.lp)}).`)); rec("Selaraskan kenaikan gaji dengan pertumbuhan produktiviti melalui PLWS: pisahkan komponen gaji tetap dan bayaran berasaskan produktiviti.", "Kos buruh tidak kompetitif"); }
    else if (l.comp === true) it3.push(good(`Pada ${l.year}, pertumbuhan produktiviti buruh (${pctTxt(l.gr.lp)}) sama atau melebihi pertumbuhan kos buruh per pekerja (${pctTxt(l.gr.lce)}).`));
  }
  if (isNum(l.ind.avlc)) {
    p3.push(`Setiap RM1 kos buruh menjana <b>RM ${fmt(l.ind.avlc, 2)}</b> Nilai Ditambah pada ${l.year}${multi && isNum(f.ind.avlc) ? ` (RM ${fmt(f.ind.avlc, 2)} pada ${f.year})` : ""}.`);
    if (l.ind.avlc < 1) { it3.push(bad("Kos buruh melebihi Nilai Ditambah: keuntungan dan modal tidak mendapat bahagian daripada nilai yang dijana.")); rec("Kaji semula struktur kos buruh dan tingkatkan nilai ditambah sebelum menambah komitmen gaji tetap.", "Kos buruh melebihi Nilai Ditambah"); }
  }
  if (multi && isNum(f.ind.ulc) && isNum(l.ind.ulc)) {
    if (l.ind.ulc > f.ind.ulc) { it3.push(bad(`Kos buruh seunit meningkat daripada ${fmt(f.ind.ulc, 3)} kepada ${fmt(l.ind.ulc, 3)}.`)); }
    else if (l.ind.ulc < f.ind.ulc) it3.push(good(`Kos buruh seunit menurun daripada ${fmt(f.ind.ulc, 3)} kepada ${fmt(l.ind.ulc, 3)}.`));
  }
  if (isNum(l.gr.lp)) {
    p3.push(l.gr.lp > 0
      ? `<b>Panduan PLWS:</b> berdasarkan pertumbuhan produktiviti buruh ${l.year} (${pctTxt(l.gr.lp)}), kenaikan kos buruh per pekerja yang selari dengan produktiviti ialah <b>sehingga ${fmt(l.gr.lp, 1)}%</b>. Bahagian ini sesuai dibayar sebagai ganjaran berasaskan produktiviti, bukan kenaikan gaji tetap sepenuhnya.`
      : `<b>Panduan PLWS:</b> produktiviti buruh ${l.year} tidak meningkat (${pctTxt(l.gr.lp)}), jadi tiada ruang kenaikan kos buruh berasaskan produktiviti bagi tempoh ini. Fokus kepada program peningkatan produktiviti dahulu.`);
  }
  if (p3.length || it3.length) sec("3. Daya Saing Kos Buruh & Implikasi PLWS", p3, it3);

  // 4. Modal & kecekapan
  const p4 = [], it4 = [];
  if (co.category !== "MI") {
  if (isNum(l.ind.cp)) {
    p4.push(`Pada ${l.year}: produktiviti modal <b>${fmt(l.ind.cp, 2)}</b>, pusing ganti modal <b>${fmt(l.ind.ct, 2)}</b>, pulangan atas aset <b>${fmt(l.ind.roa, 1)}%</b>.`);
    if (multi && isNum(f.ind.cp)) {
      if (l.ind.cp < f.ind.cp) { it4.push(bad(`Produktiviti modal menurun daripada ${fmt(f.ind.cp, 2)} kepada ${fmt(l.ind.cp, 2)}.`)); rec("Tingkatkan penggunaan aset tetap: kurangkan masa henti mesin, susun semula aliran kerja dan lupuskan aset yang tidak produktif.", "Produktiviti modal menurun"); }
      else if (l.ind.cp > f.ind.cp) it4.push(good(`Produktiviti modal meningkat daripada ${fmt(f.ind.cp, 2)} kepada ${fmt(l.ind.cp, 2)}.`));
    }
    if (isNum(l.ind.roa) && l.ind.roa < 0) it4.push(bad(`Pulangan atas aset negatif (${fmt(l.ind.roa, 1)}%).`));
  } else p4.push("Aset tetap tidak diisi, jadi petunjuk modal tidak dapat dianalisis. Isi aset tetap awal dan akhir tahun untuk analisis lengkap.");
  if (isNum(l.ind.tpm)) {
    p4.push(`Ukuran produktiviti keseluruhan (output ÷ jumlah input) ialah <b>${fmt(l.ind.tpm, 2)}</b>${multi && isNum(f.ind.tpm) ? ` (${fmt(f.ind.tpm, 2)} pada ${f.year})` : ""}: setiap RM1 input menghasilkan RM ${fmt(l.ind.tpm, 2)} output.`);
    if (l.ind.tpm < 1) { it4.push(bad("Jumlah input melebihi jumlah output.")); rec("Kurangkan kos input keseluruhan dan tingkatkan nilai output.", "Ukuran produktiviti keseluruhan < 1"); }
    if (multi && isNum(f.ind.tpm)) { if (l.ind.tpm > f.ind.tpm) it4.push(good("Kecekapan penggunaan input keseluruhan meningkat.")); else if (l.ind.tpm < f.ind.tpm) it4.push(bad("Kecekapan penggunaan input keseluruhan menurun.")); }
  }
  sec("4. Kecekapan Modal & Input", p4, it4);
  }

  // 5. Fizikal
  const defs = physDefs(co), p5 = [], it5 = [];
  const tbl = [];
  for (const d of defs) {
    const ys = rows.map(r => r.year).concat(Object.keys(co.phys || {}).map(Number)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).filter(y => isNum(co.phys?.[y]?.[d.k]));
    if (!ys.length) continue;
    const a = co.phys[ys[0]][d.k], b = co.phys[ys[ys.length - 1]][d.k];
    tbl.push({ d, y0: ys[0], y1: ys[ys.length - 1], a, b });
    if (ys.length < 2 || a === b) continue;
    const better = (b - a) * d.dir > 0;
    const dp = x => d.u === "RM" || Number.isInteger(x) ? 0 : 2;
    const t = `${d.l}${d.u ? " (" + d.u + ")" : ""}: ${fmt(a, dp(a))} (${ys[0]}) → ${fmt(b, dp(b))} (${ys[ys.length - 1]})`;
    if (better) it5.push(good(t + " — bertambah baik.")); else {
      it5.push(bad(t + " — semakin merosot."));
      if (["waste_pct", "waste_rm", "reject", "rework_pct", "rework_rm"].includes(d.k)) rec("Laksanakan program kualiti (5S, QCC, Lean Six Sigma) untuk mengurangkan pembaziran, penolakan dan kerja semula.", "Kualiti merosot");
      if (["turnover", "absent"].includes(d.k)) rec("Perkukuh penglibatan dan pengekalan pekerja: laluan kerjaya, ganjaran berasaskan prestasi dan persekitaran kerja.", "Pusing ganti / ketidakhadiran meningkat");
      if (d.k === "accident") rec("Perkukuh pengurusan keselamatan dan kesihatan pekerjaan (KKP) untuk mengurangkan kemalangan.", "Kemalangan meningkat");
      if (["mkt_share", "out_target"].includes(d.k)) rec("Kaji semula perancangan pengeluaran dan strategi pasaran.", "Output/pasaran merosot");
    }
  }
  if (tbl.length) { p5.push(`${tbl.length} petunjuk fizikal diisi. Perubahan dinilai mengikut arah yang lebih baik bagi setiap petunjuk.`); sec("5. Prestasi Fizikal", p5, it5); }
  else sec("5. Prestasi Fizikal", ["Tiada data fizikal diisi. Isi tab Data Fizikal untuk analisis kualiti, pembaziran dan sumber manusia."], []);

  // 6. Sektor
  if (bench && bench[l.year] && isNum(l.ind.lp)) {
    const m = bench[l.year].lp, d = (l.ind.lp - m) / Math.abs(m) * 100;
    sec("6. Perbandingan Sektor", [`Produktiviti buruh ${l.year} (RM ${fmt(l.ind.lp)}) berbanding median ${bench[l.year].n} syarikat lain dalam sektor ${esc(co.sector)} (RM ${fmt(m)}): <b>${pctTxt(d)}</b>.`],
      [d >= 0 ? good("Produktiviti buruh melebihi median sektor.") : bad("Produktiviti buruh di bawah median sektor.")]);
  }
  A.sections.forEach((x, i) => x.title = `${i + 1}. ` + x.title.replace(/^\d+\.\s*/, ""));
  if (!A.recs.length) rec("Kekalkan momentum: tetapkan sasaran pertumbuhan produktiviti tahunan dan pantau petunjuk ini setiap tahun.", "Prestasi baik");
  return A;
}
function analysisHtml(A) {
  if (!A.sections.length) return `<div class="msg info">Belum ada data untuk dianalisis.</div>`;
  const ico = { good: `<span class="badge b-good">✓</span>`, bad: `<span class="badge b-bad">!</span>`, info: `<span class="badge b-info">i</span>` };
  let h = A.sections.map(s => `<div class="an-sec"><h3>${s.title}</h3>${s.paras.map(p => `<p>${p}</p>`).join("")}${s.items.length ? `<ul class="chk">${s.items.map(i => `<li>${ico[i.t]} ${esc(i.text)}</li>`).join("")}</ul>` : ""}</div>`).join("");
  h += `<div class="grid2" style="margin-top:6px"><div class="an-box good"><h3>Kekuatan</h3>${A.good.length ? `<ul>${A.good.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">Tiada dikenal pasti.</p>`}</div>
    <div class="an-box bad"><h3>Ruang Penambahbaikan</h3>${A.bad.length ? `<ul>${A.bad.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">Tiada dikenal pasti.</p>`}</div></div>`;
  h += `<div class="an-sec"><h3>Cadangan Tindakan</h3><ol>${A.recs.map(r => `<li>${esc(r.t)} <span class="small muted">(${esc(r.why)})</span></li>`).join("")}</ol></div>`;
  return h;
}
function mdHtml(md) {
  const lines = esc(md).split("\n"); let h = "", list = null;
  const inl = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const close = () => { if (list) { h += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const ln = raw.trim();
    if (!ln) { close(); continue; }
    let m;
    if ((m = ln.match(/^#{1,4}\s+(.*)/))) { close(); h += `<h3>${inl(m[1])}</h3>`; }
    else if ((m = ln.match(/^[-*•]\s+(.*)/))) { if (list !== "ul") { close(); h += "<ul>"; list = "ul"; } h += `<li>${inl(m[1])}</li>`; }
    else if ((m = ln.match(/^\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); h += "<ol>"; list = "ol"; } h += `<li>${inl(m[1])}</li>`; }
    else { close(); h += `<p>${inl(ln)}</p>`; }
  }
  close(); return h;
}
function analysisPrompt(co, bench) {
  const rows = computeAll(co), A = analyze(co, bench);
  const strip = s => String(s).replace(/<[^>]+>/g, "");
  const yrs = rows.map(r => r.year);
  const MI = co.category === "MI";
  const base = MI ? [["Tahun", ...yrs], ["Status semakan data", ...rows.map(r => r.chk.status)], ["Jumlah Jualan (RM)", ...rows.map(r => r.c.output)], ["Nilai Ditambah (RM)", ...rows.map(r => r.c.av)], ["Kos Buruh (RM)", ...rows.map(r => r.c.labour)], ["Bilangan pekerja", ...rows.map(r => r.c.emp)]] : null;
  const tab = [...(base || [["Tahun", ...yrs], ["Status integriti", ...rows.map(r => r.chk.status)], ["Jumlah Output (RM)", ...rows.map(r => Math.round(r.c.output))], ["BIMS (RM)", ...rows.map(r => Math.round(r.c.bims))],
    ["Nilai Ditambah (RM)", ...rows.map(r => Math.round(r.c.avAdd))], ["Kos Buruh (RM)", ...rows.map(r => Math.round(r.c.labour))], ["Purata pekerja", ...rows.map(r => r.c.emp)], ["Purata aset tetap (RM)", ...rows.map(r => r.c.fa)],
    ["Untung operasi (RM)", ...rows.map(r => Math.round(r.c.op))]]),
    ...indsFor(co.category).map(d => [`${d.l} (${d.u})`, ...rows.map(r => isNum(r.ind[d.k]) ? +r.ind[d.k].toFixed(d.dp + 1) : "—")]),
    ...indsFor(co.category).slice(0, 4).map(d => [`Pertumbuhan ${d.l} (%)`, ...rows.map(r => isNum(r.gr[d.k]) ? +r.gr[d.k].toFixed(1) : "—")]),
    ["Daya saing kos buruh", ...rows.map(r => r.comp == null ? "—" : r.comp ? "Kompetitif" : "Tidak kompetitif")],
    ...physDefs(co).map(d => [`${d.l} (${d.u})`, ...yrs.map(y => co.phys?.[y]?.[d.k] ?? "—")])].map(r => r.join(" | ")).join("\n");
  const b = bench && Object.keys(bench).length ? "\nMedian produktiviti buruh sektor: " + Object.entries(bench).map(([y, v]) => `${y}: RM ${Math.round(v.lp)} (n=${v.n})`).join("; ") : "";
  return `Anda ialah penganalisis produktiviti Perbadanan Produktiviti Malaysia (MPC). Tulis laporan analisis produktiviti syarikat dalam Bahasa Melayu yang profesional dan mudah difahami oleh pengurusan syarikat.

Syarikat: ${co.name}
Templat: ${CATS[co.category]} · Sektor: ${co.sector || "—"}${co.subsector ? " / " + co.subsector : ""}

DATA DAN PETUNJUK (dikira oleh sistem MPC; RM penuh):
${tab}${b}

DAPATAN AUTOMATIK SISTEM:
${A.sections.map(s => s.title + "\n" + s.paras.map(strip).join("\n") + "\n" + s.items.map(i => "- " + i.text).join("\n")).join("\n\n")}

ARAHAN:
- Gunakan HANYA angka di atas. Jangan cipta angka, penanda aras atau fakta industri yang tidak diberi.
- Jika ada tahun yang tidak LULUS semakan integriti, nyatakan bahawa tafsiran bagi tahun itu terhad.
${MI ? "- Ini syarikat mikro: data hanya Nilai Ditambah, kos buruh, bilangan pekerja dan jualan. Jangan bincang petunjuk modal. Cadangan mesti praktikal untuk perniagaan kecil.\n" : ""}- Struktur dengan tajuk "## ": Ringkasan Eksekutif; Prestasi Produktiviti Buruh; ${MI ? "" : "Kecekapan Modal dan Input; "} Daya Saing Kos Buruh dan Implikasi PLWS; Prestasi Fizikal (jika ada data); Cadangan Penambahbaikan (5–7 tindakan bernombor, khusus dan boleh dilaksanakan, dikaitkan dengan dapatan); Catatan Data.
- Panjang sekitar 500–800 patah perkataan. Gunakan senarai bertitik bila sesuai. Jangan gunakan jadual.`;
}
function dataHash(co) { const t = JSON.stringify([co.category, co.years, co.data, co.phys, co.physCustom]); let h = 5381; for (let i = 0; i < t.length; i++) h = (h * 33 ^ t.charCodeAt(i)) >>> 0; return h.toString(36); }
function aiBlockHtml(co, canGen) {
  const an = co.analysis;
  const stale = an && an.basis && an.basis !== dataHash(co);
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Ulasan Naratif (dijana oleh Claude)</h2>
      ${canGen && S.sample ? `<div class="row"><button class="btn p" data-act="gen-ai" id="btn-ai">${an ? "Jana semula" : "Jana ulasan"}</button><button class="btn d hidden" data-act="stop-ai" id="btn-stop-ai">Henti</button></div>` : ""}</div>
    <p class="small muted">Ulasan ditulis berdasarkan angka dan dapatan di atas sahaja. Sila semak sebelum digunakan dalam laporan rasmi.</p>
    <div id="ai-msg">${stale ? `<div class="msg warn">Data telah dikemas kini selepas ulasan ini dijana (${fmtDate(an.at)}). Jana semula untuk ulasan terkini.</div>` : ""}</div>
    <div id="ai-out" class="an-md">${an?.text ? mdHtml(an.text) + `<p class="small muted">Dijana pada ${fmtDate(an.at)} oleh ${esc(an.by || "")}.</p>` : `<p class="muted">Belum dijana.</p>`}</div></div>`;
}
let aiCtl = null;
async function genAI(co, by, save) {
  const out = $("#ai-out"), btn = $("#btn-ai"), stop = $("#btn-stop-ai");
  aiCtl = new AbortController(); S.aiBusy = true;
  if (btn) btn.disabled = true; stop?.classList.remove("hidden");
  out.innerHTML = `<p class="muted">Claude sedang menganalisis… (biasanya 30–90 saat)</p>`; msg("#ai-msg", "", "");
  try {
    const bench = S.session?.role === "co" ? S.bench : null;
    const { text, truncated } = await S.sample(analysisPrompt(co, bench), { modelTier: "default", cache: false, signal: aiCtl.signal, onText: ({ text }) => { out.innerHTML = mdHtml(text); } });
    out.innerHTML = mdHtml(text);
    if (truncated) msg("#ai-msg", "warn", "Ulasan terpotong kerana terlalu panjang.");
    await save({ text, at: nowIso(), by, basis: dataHash(co) });
    msg("#ai-msg", "good", "Ulasan disimpan dan boleh dilihat oleh MPC dan syarikat.");
  } catch (e) {
    const c = e?.code;
    if (e?.text) out.innerHTML = mdHtml(e.text);
    else if (c !== "cancelled") out.innerHTML = co.analysis?.text ? mdHtml(co.analysis.text) : `<p class="muted">Belum dijana.</p>`;
    msg("#ai-msg", c === "cancelled" ? "warn" : "bad", c === "cancelled" ? "Dihentikan; ulasan tidak disimpan." : c === "not_granted" ? "Kebenaran menggunakan Claude ditolak." : c === "rate_limited" ? "Had penggunaan dicapai. Cuba sebentar lagi." : e?.code ? "Ulasan tidak dapat dijana. Cuba lagi." : dbErr(e));
  } finally { S.aiBusy = false; if (btn && document.contains(btn)) btn.disabled = false; stop?.classList.add("hidden"); }
}
async function renderAnalisis() {
  const co = S.co;
  const draw = () => {
    const A = analyze(co, S.bench);
    $("#view").innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>Analisis Produktiviti</h2>${S.dl ? `<button class="btn" data-act="dl-co">⬇ Muat turun Excel</button>` : ""}</div>
      ${S.dirty ? `<div class="msg warn">Analisis termasuk perubahan yang belum disimpan. Simpan dahulu sebelum menjana ulasan naratif.</div>` : ""}
      <p class="small muted">Dapatan automatik berdasarkan data kewangan, data fizikal dan 12 petunjuk produktiviti.</p>${analysisHtml(A)}<div id="dl-msg"></div></div>${aiBlockHtml(co, !S.dirty)}`;
  };
  draw();
  if (S.bench == null && co.sector) { S.bench = await loadBench(co.sector, co.companyId); if (S.tab === "analisis" && S.session?.role === "co" && !S.aiBusy) draw(); }
}
const PHYS_KEYS = new Set([...PHYS.map(d => d.k), ...PCUST]);
export { computeAll, summaryStatus, FIELDS, PHYS_KEYS };
