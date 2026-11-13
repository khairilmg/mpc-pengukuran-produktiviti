<script>
"use strict";
/* ================= KEADAAN ================= */
const S = {
  db: null, user: null, sample: null, dl: null, canEdit: false,
  session: null, co: null, coUnsub: null, dirty: false, tab: "data",
  ad: { list: [], unsub: null, sel: null, tab: "dash", f: { q: "", cat: "", sector: "", status: "" } },
  ex: null, bench: null, fail: 0, lockUntil: 0, loginTab: "co"
};
const main = () => $("#main");
function setTabs(list, cur) {
  $("#tabs").innerHTML = list.map(([k, l]) => `<button class="tab ${k === cur ? "on" : ""}" data-act="tab" data-k="${k}">${esc(l)}</button>`).join("");
}
function msg(el, type, text) { if (typeof el === "string") el = $(el); if (el) el.innerHTML = text ? `<div class="msg ${type}">${text}</div>` : ""; }
function modal(html) { $("#modal").innerHTML = html ? `<div class="modal-bg" data-act="modal-bg"><div class="modal">${html}</div></div>` : ""; }
function dbErr(e) {
  if (e?.code === "unauth") { setTimeout(() => { if (S.session) { S.dirty = false; renderLogin(); } }, 1500); return "Sesi tamat. Sila log masuk semula."; }
  return e?.message || "Ralat sambungan. Cuba lagi.";
}
async function withRetry(fn) { return fn(); }

/* ================= BOOT ================= */
async function boot() {
  S.dl = browserDownloads;
  let st;
  try { st = await API("GET", "status"); }
  catch (e) { main().innerHTML = `<div class="card"><h2>Pelayan tidak dapat dicapai</h2><p class="muted">${esc(e.message || "")}</p></div>`; return; }
  if (isNum(st.minWage) && st.minWage > 0) MIN_WAGE = st.minWage;
  S.adminSetup = st.adminSetup; S.sample = st.ai ? makeSample() : null;
  try {
    const me = await API("GET", "me");
    if (me.role === "co") { S.session = { role: "co", id: me.company.companyId }; S.co = me.company; return me.company.auth?.mustChange ? renderForcePw() : enterCompany(); }
    if (me.role === "ad") { S.session = { role: "ad", u: me.username }; return enterAdmin(); }
  } catch {}
  renderLogin();
}
async function doLogout() { S.dirty = false; try { await API("POST", "logout", {}); } catch {} renderLogin(); }
window.addEventListener("beforeunload", e => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ================= LOG MASUK ================= */
function renderLogin() {
  S.session = null; S.co = null; S.dirty = false; S.ex = null; S.bench = null;
  S.coUnsub?.(); S.coUnsub = null; S.ad.unsub?.(); S.ad.unsub = null;
  setTabs([]); $("#who").innerHTML = "";
  const t = S.loginTab;
  main().innerHTML = `<div class="login-wrap"><div class="card login">
    <h1>Log Masuk</h1>
    <p class="muted small">Sistem pengukuran produktiviti syarikat untuk Sistem Gaji Berasaskan Produktiviti (PLWS).</p>
    <div class="seg"><button class="${t === "co" ? "on" : ""}" data-act="login-tab" data-k="co">Syarikat</button><button class="${t === "ad" ? "on" : ""}" data-act="login-tab" data-k="ad">Master Admin</button></div>
    <div id="login-body"></div></div></div>`;
  if (t === "co") {
    $("#login-body").innerHTML = `<form id="f-login" class="stack" autocomplete="off">
      <label class="f"><span>ID Syarikat</span><input type="text" name="id" placeholder="cth. MPC-AB12CD" required></label>
      <label class="f"><span>Kata Laluan</span><input type="password" name="pw" required></label>
      <div id="login-msg"></div>
      <button class="btn p" type="submit" style="width:100%;justify-content:center">Log Masuk</button>
      <p class="small muted" style="text-align:center">Belum berdaftar? <a href="#" data-act="register">Daftar syarikat baharu</a><br>Lupa kata laluan? Hubungi pegawai MPC untuk set semula.</p>
    </form>`;
  } else renderAdminLoginBody();
}
async function renderAdminLoginBody() {
  const b = $("#login-body");
  b.innerHTML = `<p class="muted">Menyemak tetapan…</p>`;
  try { S.adminSetup = (await API("GET", "admin/status")).setup; } catch (e) { b.innerHTML = `<div class="msg bad">${esc(dbErr(e))}</div>`; return; }
  if (!S.adminSetup) {
    b.innerHTML = `<form id="f-setup" class="stack" autocomplete="off">
      <div class="msg info">Kali pertama: sediakan akaun Master Admin. Kunci persediaan ialah nilai <b>ADMIN_SETUP_KEY</b> yang ditetapkan di Cloudflare.</div>
      <label class="f"><span>Kunci Persediaan</span><input type="password" name="key" required></label>
      <label class="f"><span>ID Master Admin</span><input type="text" name="u" value="admin" required></label>
      <label class="f"><span>Kata Laluan</span><input type="password" name="pw" required></label>
      <label class="f"><span>Sahkan Kata Laluan</span><input type="password" name="pw2" required></label>
      <div id="login-msg"></div><button class="btn p" type="submit">Sediakan & Log Masuk</button></form>`;
  } else {
    b.innerHTML = `<form id="f-alogin" class="stack" autocomplete="off">
      <label class="f"><span>ID Master Admin</span><input type="text" name="u" required></label>
      <label class="f"><span>Kata Laluan</span><input type="password" name="pw" required></label>
      <div id="login-msg"></div><button class="btn p" type="submit" style="width:100%;justify-content:center">Log Masuk</button></form>`;
  }
}
const FORMS = {};
FORMS["f-login"] = async f => {
  msg("#login-msg", "info", "Mengesahkan…");
  try {
    const d = await API("POST", "login", { id: f.id.value.trim().toUpperCase(), pw: f.pw.value });
    S.session = { role: "co", id: d.company.companyId }; S.co = d.company;
    if (d.company.auth?.mustChange) renderForcePw(); else enterCompany();
  } catch (e) { msg("#login-msg", e.status === 403 ? "warn" : "bad", esc(e.message)); }
};
FORMS["f-setup"] = async f => {
  const u = f.u.value.trim(), pw = f.pw.value;
  const p = pwProblem(pw); if (p) return msg("#login-msg", "bad", p);
  if (pw !== f.pw2.value) return msg("#login-msg", "bad", "Kata laluan tidak sepadan.");
  try { const d = await API("POST", "admin/setup", { key: f.key.value, u, pw }); S.adminSetup = true; S.session = { role: "ad", u: d.username }; enterAdmin(); }
  catch (e) { msg("#login-msg", "bad", esc(e.message)); }
};
FORMS["f-alogin"] = async f => {
  msg("#login-msg", "info", "Mengesahkan…");
  try { const d = await API("POST", "admin/login", { u: f.u.value.trim(), pw: f.pw.value }); S.session = { role: "ad", u: d.username }; enterAdmin(); }
  catch (e) { msg("#login-msg", "bad", esc(e.message)); }
};

/* ---------- Pendaftaran / profil (borang dikongsi) ---------- */
function profileFields(co = {}, opts = {}) {
  const catLocked = opts.catLocked;
  return `<div class="grid2">
    <label class="f" style="grid-column:1/-1"><span>Nama Syarikat <b class="req">*</b></span><input type="text" name="name" value="${esc(co.name)}" required></label>
    <label class="f"><span>No. Pendaftaran SSM</span><input type="text" name="ssm" value="${esc(co.ssm)}"></label>
    <label class="f"><span>Sektor Industri (MSIC) <b class="req">*</b></span><select name="sector" required><option value="">— Pilih —</option>${SECTORS.map(s => `<option ${co.sector === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
    <label class="f"><span>Subsektor / Aktiviti Utama</span><input type="text" name="subsector" value="${esc(co.subsector)}" placeholder="cth. Komponen elektronik"></label>
    <label class="f"><span>Jenis Templat <b class="req">*</b></span><select name="category" ${catLocked ? "disabled" : ""} required>${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${co.category === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <label class="f" style="grid-column:1/-1"><span>Alamat</span><textarea name="address">${esc(co.address)}</textarea></label>
    <label class="f"><span>No. Telefon</span><input type="text" name="tel" value="${esc(co.tel)}"></label>
    <label class="f"><span>E-mel</span><input type="email" name="email" value="${esc(co.email)}"></label>
    <label class="f"><span>Pegawai Bertanggungjawab <b class="req">*</b></span><input type="text" name="officer" value="${esc(co.officer)}" required></label>
    <label class="f"><span>Laman Web</span><input type="text" name="website" value="${esc(co.website)}"></label>
  </div>
  <p class="small muted">${Object.entries(CAT_NOTE).map(([k, n]) => `<b>${esc(CATS[k].split(" (")[0])}:</b> ${esc(n)}`).join("<br>")}</p>`;
}
function readProfile(f) {
  const o = {}; ["name", "ssm", "sector", "subsector", "address", "tel", "email", "officer", "website"].forEach(k => o[k] = (f[k]?.value || "").trim());
  if (f.category && !f.category.disabled) o.category = f.category.value;
  return o;
}
function renderRegister() {
  setTabs([]);
  main().innerHTML = `<div class="card" style="max-width:820px;margin:0 auto">
    <h1>Daftar Syarikat Baharu</h1><p class="muted">Pendaftaran akan disemak dan diluluskan oleh MPC sebelum anda boleh log masuk.</p>
    <form id="f-reg" class="stack" autocomplete="off">${profileFields({ category: "M" })}
      <div class="grid2"><label class="f"><span>Kata Laluan <b class="req">*</b></span><input type="password" name="pw" required></label>
      <label class="f"><span>Sahkan Kata Laluan <b class="req">*</b></span><input type="password" name="pw2" required></label></div>
      <p class="small muted">Sekurang-kurangnya 8 aksara dengan huruf dan nombor.</p>
      <div id="reg-msg"></div>
      <div class="row"><button class="btn p" type="submit">Hantar Pendaftaran</button><button class="btn" type="button" data-act="to-login">Batal</button></div>
    </form></div>`;
}
FORMS["f-reg"] = async f => {
  const p = readProfile(f);
  if (!p.name || !p.sector || !p.officer) return msg("#reg-msg", "bad", "Sila lengkapkan medan bertanda *.");
  const pp = pwProblem(f.pw.value); if (pp) return msg("#reg-msg", "bad", pp);
  if (f.pw.value !== f.pw2.value) return msg("#reg-msg", "bad", "Kata laluan tidak sepadan.");
  msg("#reg-msg", "info", "Mendaftar…");
  try {
    const { id } = await API("POST", "register", { profile: p, pw: f.pw.value });
    main().innerHTML = `<div class="card" style="max-width:560px;margin:40px auto"><h2>Pendaftaran diterima</h2>
      <p>ID Syarikat anda:</p><div class="cred">${esc(id)}</div>
      <p class="muted">Sila simpan ID ini. Anda boleh log masuk selepas MPC meluluskan pendaftaran.</p>
      <button class="btn p" data-act="to-login">Kembali ke Log Masuk</button></div>`;
  } catch (e) { msg("#reg-msg", "bad", dbErr(e)); }
};
function renderForcePw() {
  setTabs([]);
  main().innerHTML = `<div class="login-wrap"><div class="card login"><h2>Tukar Kata Laluan</h2>
    <p class="muted small">Anda menggunakan kata laluan sementara. Sila tetapkan kata laluan baharu.</p>
    <form id="f-forcepw" class="stack"><label class="f"><span>Kata Laluan Baharu</span><input type="password" name="pw" required></label>
    <label class="f"><span>Sahkan</span><input type="password" name="pw2" required></label><div id="login-msg"></div>
    <button class="btn p" type="submit">Simpan</button></form></div></div>`;
}
FORMS["f-forcepw"] = async f => {
  const p = pwProblem(f.pw.value); if (p) return msg("#login-msg", "bad", p);
  if (f.pw.value !== f.pw2.value) return msg("#login-msg", "bad", "Kata laluan tidak sepadan.");
  try { const d = await API("POST", "company/password", { pw: f.pw.value }); S.co = d.company; enterCompany(); }
  catch (e) { msg("#login-msg", "bad", dbErr(e)); }
};

/* ================= SYARIKAT ================= */
const CO_TABS = [["data", "Data Kewangan"], ["fizikal", "Data Fizikal"], ["upload", "Muat Naik Penyata"], ["hasil", "Keputusan Produktiviti"], ["analisis", "Analisis Produktiviti"], ["hantar", "Hantar kepada MPC"], ["profil", "Profil & Akaun"]];
function enterCompany() {
  S.tab = "data";
  S.coUnsub?.();
  const t = setInterval(async () => {
    let d;
    try { d = (await API("GET", "me")).company; } catch (e) { if (e.code === "unauth") { clearInterval(t); S.dirty = false; renderLogin(); } return; }
    if (!d || S.session?.role !== "co") return;
    const keep = ["status", "review", "account", "history", "analysis"];
    const changedMeta = keep.some(k => JSON.stringify(d[k]) !== JSON.stringify(S.co[k]));
    if (S.dirty || S.aiBusy || S.ex?.running) { if (changedMeta && !S.aiBusy && !S.ex?.running) { keep.forEach(k => S.co[k] = d[k]); renderCompany(); } return; }
    if (JSON.stringify(d) !== JSON.stringify(S.co)) { S.co = d; renderCompany(); }
  }, 30000);
  S.coUnsub = () => clearInterval(t);
  renderCompany();
}
const isLocked = () => ["dihantar", "disahkan"].includes(S.co?.status);
function renderCompany() {
  const co = S.co;
  setTabs(CO_TABS, S.tab);
  $("#who").innerHTML = `<div><b>${esc(co.name)}</b> · ${esc(co.companyId)}</div><div class="row" style="justify-content:flex-end;margin-top:3px">${badge(STATUS, co.status)}<button class="btn sm" data-act="logout">Log keluar</button></div>`;
  let banner = "";
  if (co.status === "dikembalikan") banner = `<div class="msg warn"><b>Dikembalikan oleh MPC untuk pembetulan.</b>${co.review?.comment ? "<br>Ulasan: " + esc(co.review.comment) : ""}</div>`;
  else if (co.status === "dihantar") banner = `<div class="msg info">Data telah dihantar pada ${fmtDate(co.submittedAt)} dan sedang disemak oleh MPC. Data dikunci; tarik balik penghantaran di tab "Hantar kepada MPC" jika perlu membuat pindaan.</div>`;
  else if (co.status === "disahkan") banner = `<div class="msg good">Data telah disahkan oleh MPC pada ${fmtDate(co.review?.at)}.${co.review?.comment ? " Ulasan: " + esc(co.review.comment) : ""}</div>`;
  main().innerHTML = banner + `<div id="view"></div>`;
  ({ data: renderData, fizikal: renderPhys, upload: renderUpload, hasil: renderHasil, analisis: renderAnalisis, hantar: renderHantar, profil: renderProfil })[S.tab]();
}

/* ---------- Jadual data (dikongsi dengan admin) ---------- */
function exCount(co, y) { return Object.values(co.src?.[y] || {}).filter(s => s?.ex).length; }
function dataTableHtml(co, ro) {
  const cat = co.category, years = (co.years || []).slice().sort((a, b) => a - b);
  let h = `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Medan (RM kecuali dinyatakan)</th>`;
  for (const y of years) {
    const n = exCount(co, y);
    h += `<th><div class="yearhead"><span>${y} ${ro ? "" : `<button class="x" title="Buang tahun ${y}" data-act="del-year" data-y="${y}">✕</button>`}</span>
      ${n ? `<span class="badge b-warn" title="Nilai diekstrak secara automatik yang belum disemak">${n} belum disemak</span>${ro ? "" : `<button class="btn sm" data-act="rev-year" data-y="${y}">Tandakan disemak</button>`}` : ""}</div></th>`;
  }
  h += `</tr></thead><tbody>`;
  let g = "";
  for (const f of fieldsFor(cat)) {
    if (f.g !== g) { g = f.g; h += `<tr class="grp"><td colspan="${years.length + 1}">${esc(GROUPS[g])}</td></tr>`; }
    h += `<tr><td class="fl" title="${esc(f.n || "")}">${esc(flabel(f, cat))}${f.req ? ' <b class="req">*</b>' : ""}<small>${esc(f.en)}${f.n ? " · " + esc(f.n) : ""}</small></td>`;
    for (const y of years) {
      const v = co.data?.[y]?.[f.k], s = co.src?.[y]?.[f.k];
      const tip = s?.ex ? `Diekstrak${s.file ? " daripada " + s.file : ""}${s.note ? ": " + s.note : ""}` : "";
      if (ro) h += `<td class="num ${s?.ex ? "ex" : ""}" title="${esc(tip)}">${isNum(v) ? fmt(v, f.int ? 0 : (Number.isInteger(v) ? 0 : 2)) : ""}</td>`;
      else h += `<td class="in ${s?.ex ? "ex" : ""}"><input type="text" inputmode="decimal" data-y="${y}" data-k="${f.k}" value="${esc(fmtIn(v))}" title="${esc(tip)}" ${isLocked() ? "disabled" : ""}></td>`;
    }
    h += `</tr>`;
  }
  h += `</tbody><tbody id="sum">${summaryRowsHtml(co)}</tbody></table></div>`;
  return h;
}
function summaryRowsHtml(co) {
  const rows = computeAll(co), cat = co.category, ncol = rows.length + 1;
  const line = (l, fn, cls = "sum") => `<tr class="${cls}"><td>${l}</td>${rows.map(r => `<td class="num">${fn(r)}</td>`).join("")}</tr>`;
  if (cat === "MI") {
    let m = `<tr class="grp"><td colspan="${ncol}">Ringkasan & Semakan Data</td></tr>`;
    m += line("Nisbah Nilai Ditambah kepada Jualan (%)", r => fmt(r.c.output ? r.c.av / r.c.output * 100 : null, 1));
    m += line("Kos buruh per pekerja (RM setahun)", r => fmt(div(r.c.labour, r.c.emp)));
    m += line("Produktiviti buruh (RM per pekerja)", r => fmt(r.ind.lp), "sum key");
    m += line("<b>Status semakan</b>", r => chkBadge(r.chk.status));
    return m;
  }
  let h = `<tr class="grp"><td colspan="${ncol}">Ringkasan Pengiraan & Semakan Integriti</td></tr>`;
  h += line("Jumlah Kos Buruh", r => fmt(r.c.labour));
  if (cat === "M") h += line("Jumlah Kos Pembuatan", r => fmt(r.c.tmc));
  if (cat !== "MI") { h += line("Untung Operasi (dikira)", r => fmt(r.c.op)); h += line("Untung Sebelum Cukai (dikira)", r => fmt(r.c.np)); }
  h += line("Jumlah Output", r => fmt(r.c.output));
  h += line("Jumlah BIMS (bahan & perkhidmatan dibeli)", r => fmt(r.c.bims));
  h += line("Nilai Ditambah — kaedah tambah", r => fmt(r.c.avAdd), "sum key");
  h += line("Nilai Ditambah — kaedah tolak", r => fmt(r.c.avSub), "sum key");
  h += line("Selisih", r => fmt(r.c.avAdd - r.c.avSub));
  h += line("Bilangan pekerja (purata)", r => fmt(r.c.emp, 1));
  h += line("<b>Status integriti</b>", r => chkBadge(r.chk.status));
  return h;
}
function checksHtml(co) {
  const rows = computeAll(co);
  if (!rows.length) return "";
  return `<div class="grid2" style="margin-top:12px">${rows.map(r => `<div class="card" style="margin:0;padding:12px">
    <div class="row" style="justify-content:space-between"><b>${r.year}</b>${chkBadge(r.chk.status)}</div>
    <ul class="small chk" style="padding-left:18px;margin:6px 0 0">${r.chk.items.map(i => `<li style="color:${i.ok ? "var(--good)" : "var(--bad)"}">${i.ok ? "✓" : "✕"} ${esc(i.m)}</li>`).join("")}
    ${r.chk.warns.map(w => `<li style="color:var(--warn)">! ${esc(w)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}
function renderData() {
  const co = S.co, years = co.years || [], lk = isLocked();
  $("#view").innerHTML = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><h2>Data Kewangan</h2><p class="muted small" style="margin:0">Templat: <b>${esc(CATS[co.category])}</b> · ${years.length} daripada ${MAX_YEARS} tahun · Masukkan nilai dalam RM penuh. Kurungan atau tanda tolak untuk nilai negatif.</p></div>
      <div class="row">${lk ? "" : `<input type="number" id="new-year" placeholder="Tahun" min="1990" max="${new Date().getFullYear() + 1}" style="width:110px">
        <button class="btn" data-act="add-year" ${years.length >= MAX_YEARS ? "disabled" : ""}>+ Tambah tahun</button>
        <button class="btn p" data-act="save" id="btn-save" ${S.dirty ? "" : "disabled"}>Simpan</button>`}</div>
    </div>
    <div id="data-msg" style="margin-top:10px">${S.dirty ? `<div class="msg warn">Perubahan belum disimpan.</div>` : ""}</div>
    ${years.length ? dataTableHtml(co, false) : `<div class="msg info">Belum ada data. Tambah tahun kewangan di atas untuk isi secara manual, atau gunakan tab <a href="#" data-act="tab" data-k="upload">Muat Naik Penyata</a> untuk pengekstrakan automatik.</div>`}
    <p class="small muted">Sel kuning = nilai diekstrak secara automatik yang belum disemak. Mengubah sel atau menekan "Tandakan disemak" mengesahkan nilai tersebut.</p>
    <div id="chks">${checksHtml(co)}</div></div>`;
}
let sumTimer = null;
function onDataInput(inp) {
  const y = +inp.dataset.y, k = inp.dataset.k, v = parseNum(inp.value);
  const td = inp.parentElement;
  if (Number.isNaN(v)) { td.classList.add("bad"); return; }
  td.classList.remove("bad");
  const co = S.co; co.data = co.data || {}; co.data[y] = co.data[y] || {};
  if (v == null) delete co.data[y][k]; else co.data[y][k] = FMAP[k]?.int ? Math.round(v) : v;
  if (co.src?.[y]?.[k]?.ex) { delete co.src[y][k]; td.classList.remove("ex"); }
  setDirty(true);
  clearTimeout(sumTimer);
  sumTimer = setTimeout(() => { const s = $("#sum"); if (s) s.innerHTML = summaryRowsHtml(co); const c = $("#chks"); if (c) c.innerHTML = checksHtml(co); }, 200);
}
function setDirty(d) {
  S.dirty = d; const b = $("#btn-save"); if (b) b.disabled = !d;
  const m = $("#data-msg"); if (m && d && !m.innerHTML) m.innerHTML = `<div class="msg warn">Perubahan belum disimpan.</div>`;
  if (m && !d) m.innerHTML = "";
}
async function saveCompany() {
  const co = S.co;
  const d = await API("PUT", "company", { years: co.years || [], data: co.data || {}, src: co.src || {}, phys: co.phys || {}, physCustom: co.physCustom || [] });
  S.co = d.company; S.dirty = false;
}

/* ---------- Muat naik & pengekstrakan ---------- */
function renderUpload() {
  const lk = isLocked();
  S.ex = S.ex || { files: [], log: [], running: false, result: null, sel: {}, mode: "fill" };
  const ex = S.ex;
  if (!S.sample) {
    $("#view").innerHTML = `<div class="card"><h2>Muat Naik Penyata</h2><div class="msg warn">Pengekstrakan automatik belum diaktifkan oleh MPC. Sila isi data secara manual di tab Data Kewangan.</div></div>`; return;
  }
  $("#view").innerHTML = `<div class="card"><h2>Muat Naik Penyata Kewangan</h2>
    <p class="muted">Muat naik penyata kewangan teraudit atau akaun pengurusan (PDF, Excel atau CSV). Anda boleh memuat naik beberapa fail sekaligus, contohnya penyata bagi tahun-tahun berbeza, sehingga ${MAX_YEARS} tahun. Claude akan membaca penyata dan memetakan angka kepada medan MPC. <b>Semua nilai yang diekstrak mesti disemak oleh syarikat sebelum dihantar.</b></p>
    ${lk ? `<div class="msg info">Data dikunci kerana telah dihantar.</div>` : `
    <label class="drop" id="drop"><input type="file" id="file-in" accept=".pdf,.xlsx,.xls,.csv" multiple hidden>
      <b>Klik untuk pilih fail</b> atau seret fail ke sini<br><span class="small muted">PDF (teks atau imbasan), XLSX, XLS, CSV</span></label>
    <ul class="log" id="files">${ex.files.map((f, i) => `<li>📄 ${esc(f.name)} <span class="muted small">(${(f.size / 1024).toFixed(0)} KB)</span> ${ex.running ? "" : `<button class="x" data-act="rm-file" data-i="${i}">buang</button>`}</li>`).join("")}</ul>
    <div class="row"><button class="btn p" data-act="extract" ${!ex.files.length || ex.running ? "disabled" : ""}>Ekstrak data</button>
      ${ex.running ? `<button class="btn d" data-act="stop-extract">Henti</button>` : ""}
      ${ex.result && !ex.running ? `<button class="btn" data-act="clear-extract">Mula semula</button>` : ""}</div>`}
    <ul class="log" id="xlog">${ex.log.map(l => `<li>${l}</li>`).join("")}</ul></div>
    <div id="review">${ex.result ? reviewHtml() : ""}</div>`;
  const drop = $("#drop");
  if (drop) {
    $("#file-in").onchange = e => addFiles(e.target.files);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); };
  }
}
function addFiles(fl) {
  for (const f of fl) if (/\.(pdf|xlsx|xls|csv)$/i.test(f.name)) S.ex.files.push(f);
  renderUpload();
}
function xlog(t) { S.ex.log.push(t); const l = $("#xlog"); if (l) l.innerHTML = S.ex.log.map(x => `<li>${x}</li>`).join(""); }
function xlogLast(t) { S.ex.log[S.ex.log.length - 1] = t; const l = $("#xlog"); if (l) l.innerHTML = S.ex.log.map(x => `<li>${x}</li>`).join(""); }
async function pdfContent(file, maxImages) {
  const lib = window.pdfjsLib;
  if (!lib) throw new Error("Pembaca PDF gagal dimuatkan.");
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const np = Math.min(pdf.numPages, 60);
  let text = "";
  for (let p = 1; p <= np; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3, x = it.transform[4];
      let ln = lines.find(l => Math.abs(l.y - y) <= 3);
      if (!ln) { ln = { y, parts: [] }; lines.push(ln); }
      ln.parts.push({ x, s: it.str });
    }
    lines.sort((a, b) => b.y - a.y);
    text += `\n--- Halaman ${p} ---\n` + lines.map(l => l.parts.sort((a, b) => a.x - b.x).map(q => q.s).join("  ")).join("\n");
  }
  const images = [];
  const dense = text.replace(/\s/g, "").length / np;
  if (dense < 80 && maxImages > 0) {
    for (let p = 1; p <= Math.min(np, maxImages); p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1.6 });
      const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      images.push(await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85)));
    }
  }
  return { text, images, pages: pdf.numPages, scanned: dense < 80 };
}
async function sheetText(file) {
  if (!window.XLSX) throw new Error("Pembaca Excel gagal dimuatkan.");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  return wb.SheetNames.map(n => `--- Helaian: ${n} ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false }).split("\n").filter(l => l.replace(/,/g, "").trim()).join("\n")).join("\n");
}
function extractPrompt(cat, fname, text, nImg) {
  const fl = fieldsFor(cat).map(f => `- ${f.k}: ${flabel(f, cat)} (${f.en})${f.n ? " — " + f.n : ""}`).join("\n");
  return `Anda membantu Perbadanan Produktiviti Malaysia (MPC) mengekstrak data kewangan syarikat untuk pengukuran produktiviti.

TUGAS: Baca penyata kewangan di bawah (Penyata Pendapatan / Untung Rugi, Kunci Kira-kira, Akaun Pembuatan dan nota-nota) dan petakan angka kepada medan MPC bagi SETIAP tahun kewangan yang terdapat dalam dokumen (biasanya tahun semasa dan tahun perbandingan).

Kategori templat: ${CATS[cat]}

MEDAN MPC (kunci: label — definisi):
${fl}

PERATURAN:
1. Semua nilai dalam Ringgit penuh. Jika penyata dalam RM'000 atau RM juta, darab sewajarnya dan nyatakan dalam "unit_note".
2. Jangan meneka. Jika tiada maklumat untuk sesuatu medan, gunakan null.
3. Jika beberapa item penyata masuk ke satu medan, jumlahkan dan senaraikan item dalam "notes" bagi medan itu.
4. Jika hanya ada jumlah (contoh: "Kos kakitangan" tanpa pecahan), masukkan ke medan yang paling hampir (contoh: lab_wages) dan terangkan dalam notes.
5. Kos dan perbelanjaan sebagai nombor positif. reported_pbt negatif jika rugi.
6. Aset tetap = nilai buku bersih hartanah, loji & peralatan. Aset tetap awal tahun = baki akhir tahun sebelumnya. Bilangan pekerja daripada nota jika ada.
7. Tahun = tahun kewangan berakhir (FYE 31 Mac 2024 → 2024).
8. Pastikan pemetaan konsisten supaya: Untung sebelum cukai yang dikira daripada medan = reported_pbt.
9. Dalam notes, nyatakan nama item dan halaman/helaian sumber secara ringkas.

Balas dengan JSON SAHAJA, tanpa teks lain, dalam bentuk:
{"company_name": "string atau null", "unit_note": "string", "years": [{"year": 2024, "values": {"sales": 1234567, "cos_pur": null}, "notes": {"sales": "Hasil, ms 8"}}], "warnings": ["string"]}

DOKUMEN (fail: ${fname})${nImg ? `. ${nImg} imej halaman imbasan dilampirkan; baca angka daripada imej.` : ""}:
<<<
${text.slice(0, 150000)}
>>>`;
}
async function runExtract() {
  const ex = S.ex; if (ex.running) return;
  ex.running = true; ex.log = []; ex.ctl = new AbortController();
  renderUpload();
  const cat = S.co.category;
  let lim = null; try { lim = await S.sample.limits(); } catch {}
  const maxImg = Math.min(lim?.images?.maxCount || 0, 10);
  const res = ex.result || { years: {}, unit: [], warnings: [] };
  for (const file of ex.files) {
    if (ex.ctl.signal.aborted) break;
    try {
      xlog(`⏳ Membaca <b>${esc(file.name)}</b>…`);
      let text = "", images = [];
      if (/\.pdf$/i.test(file.name)) {
        const c = await pdfContent(file, maxImg);
        text = c.text; images = c.images;
        if (c.scanned && !images.length) { xlogLast(`⚠ ${esc(file.name)}: PDF imbasan tanpa teks dan imej tidak dapat dihantar dalam paparan ini. Sila isi secara manual.`); continue; }
        xlogLast(`✓ ${esc(file.name)}: ${c.pages} halaman dibaca${c.scanned ? ` (imbasan, ${images.length} halaman dihantar sebagai imej)` : ""}.`);
      } else { text = await sheetText(file); xlogLast(`✓ ${esc(file.name)}: helaian dibaca.`); }
      xlog(`⏳ Claude sedang mengekstrak dan memetakan data daripada ${esc(file.name)}… (boleh mengambil masa 1–3 minit)`);
      const opts = { modelTier: "complex", signal: ex.ctl.signal, onText: () => xlogLast(`⏳ Menerima jawapan bagi ${esc(file.name)}…`) };
      if (images.length) opts.images = images;
      const r = await S.sample.json(extractPrompt(cat, file.name, text, images.length), opts);
      const n = mergeExtract(res, r, file.name, cat);
      xlogLast(`✓ ${esc(file.name)}: ${n} tahun dikesan${r?.unit_note ? " · " + esc(r.unit_note) : ""}.`);
    } catch (e) {
      const c = e?.code;
      const t = c === "cancelled" ? "Dihentikan." : c === "not_granted" ? "Kebenaran menggunakan Claude ditolak." : c === "rate_limited" ? "Had penggunaan dicapai. Cuba sebentar lagi." : c === "invalid_json" ? "Jawapan tidak dapat dibaca. Cuba lagi." : c === "prompt_too_large" ? "Dokumen terlalu besar. Muat naik halaman penyata kewangan sahaja." : (e?.message || "Ralat semasa pengekstrakan.");
      xlogLast(`✕ ${esc(file.name)}: ${esc(t)}`);
      if (c === "cancelled" || c === "not_granted") break;
    }
  }
  ex.running = false;
  if (Object.keys(res.years).length) { ex.result = res; Object.keys(res.years).forEach(y => { if (!(y in ex.sel)) ex.sel[y] = true; }); }
  renderUpload();
}
function mergeExtract(res, r, fname, cat) {
  if (!r || !Array.isArray(r.years)) throw new Error("Tiada data tahun dalam jawapan.");
  if (r.unit_note) res.unit.push(`${fname}: ${r.unit_note}`);
  (r.warnings || []).forEach(w => res.warnings.push(`${fname}: ${w}`));
  const keys = fieldsFor(cat).map(f => f.k);
  let n = 0;
  for (const yr of r.years) {
    const y = parseInt(yr?.year, 10); if (!(y >= 1990 && y <= 2100)) continue;
    n++;
    const t = res.years[y] = res.years[y] || { values: {}, notes: {}, files: {} };
    for (const k of keys) {
      let v = yr.values?.[k]; if (typeof v === "string") v = parseNum(v);
      if (!isNum(v)) continue;
      if (FMAP[k].int) v = Math.round(v);
      if (isNum(t.values[k]) && Math.abs(t.values[k] - v) > TOL) { res.warnings.push(`Nilai berbeza bagi "${FMAP[k].l}" ${y}: ${fmt(t.values[k])} (${t.files[k]}) berbanding ${fmt(v)} (${fname}). Nilai pertama dikekalkan.`); continue; }
      if (!isNum(t.values[k])) { t.values[k] = v; t.notes[k] = String(yr.notes?.[k] || "").slice(0, 300); t.files[k] = fname; }
    }
  }
  return n;
}
function reviewHtml() {
  const ex = S.ex, res = ex.result, cat = S.co.category;
  const years = Object.keys(res.years).map(Number).sort((a, b) => a - b);
  const preview = { category: cat, years, data: Object.fromEntries(years.map(y => [y, res.years[y].values])) };
  const rows = computeAll(preview);
  let h = `<div class="card"><h2>Semak Hasil Pengekstrakan</h2>
    <p class="muted small">Semak setiap nilai berbanding penyata. Arahkan tetikus pada sel untuk melihat sumber. Betulkan terus dalam jadual jika perlu, kemudian pilih tahun yang hendak dimasukkan.</p>
    ${res.unit.length ? `<div class="msg info small">${res.unit.map(esc).join("<br>")}</div>` : ""}
    ${res.warnings.length ? `<div class="msg warn small"><b>Perhatian:</b><br>${res.warnings.map(esc).join("<br>")}</div>` : ""}
    <div class="tbl-wrap"><table class="dt"><thead><tr><th>Medan</th>${years.map(y => `<th><label class="row" style="justify-content:flex-end;gap:6px"><input type="checkbox" data-act="sel-year" data-y="${y}" ${ex.sel[y] ? "checked" : ""}> ${y}</label></th>`).join("")}</tr></thead><tbody>`;
  let g = "";
  for (const f of fieldsFor(cat)) {
    if (f.g !== g) { g = f.g; h += `<tr class="grp"><td colspan="${years.length + 1}">${esc(GROUPS[g])}</td></tr>`; }
    h += `<tr><td class="fl">${esc(flabel(f, cat))}</td>${years.map(y => { const t = res.years[y]; const v = t.values[f.k]; const note = t.notes[f.k] ? `${t.files[f.k]}: ${t.notes[f.k]}` : (t.files[f.k] || ""); return `<td class="in ${isNum(v) ? "ex" : ""}"><input type="text" inputmode="decimal" data-ry="${y}" data-rk="${f.k}" value="${esc(fmtIn(v))}" title="${esc(note)}"></td>`; }).join("")}</tr>`;
  }
  h += `<tr class="grp"><td colspan="${years.length + 1}">Semakan integriti (pratonton)</td></tr>`;
  h += `<tr class="sum key"><td>Nilai Ditambah — tambah / tolak</td>${rows.map(r => `<td class="num">${fmt(r.c.avAdd)}<br>${fmt(r.c.avSub)}</td>`).join("")}</tr>`;
  h += `<tr class="sum"><td>Status</td>${rows.map(r => `<td title="${esc(r.chk.items.filter(i => !i.ok).map(i => i.m).join(" "))}">${chkBadge(r.chk.status)}</td>`).join("")}</tr>`;
  h += `</tbody></table></div>
    <div class="row" style="margin-top:12px">
      <label class="row small"><input type="radio" name="xmode" value="fill" ${ex.mode === "fill" ? "checked" : ""} data-act="xmode"> Isi sel kosong sahaja</label>
      <label class="row small"><input type="radio" name="xmode" value="replace" ${ex.mode === "replace" ? "checked" : ""} data-act="xmode"> Ganti nilai sedia ada</label>
      <span class="spacer"></span><button class="btn p" data-act="apply-extract">Masukkan ke Data Kewangan</button></div>
    <div id="apply-msg"></div></div>`;
  return h;
}
function applyExtract() {
  const ex = S.ex, res = ex.result, co = S.co;
  const sel = Object.keys(res.years).map(Number).filter(y => ex.sel[y]);
  if (!sel.length) return msg("#apply-msg", "bad", "Pilih sekurang-kurangnya satu tahun.");
  const all = new Set([...(co.years || []), ...sel]);
  if (all.size > MAX_YEARS) return msg("#apply-msg", "bad", `Maksimum ${MAX_YEARS} tahun. Nyahpilih beberapa tahun atau buang tahun sedia ada.`);
  co.data = co.data || {}; co.src = co.src || {};
  let n = 0;
  for (const y of sel) {
    const t = res.years[y]; co.data[y] = co.data[y] || {}; co.src[y] = co.src[y] || {};
    for (const [k, v] of Object.entries(t.values)) {
      if (!isNum(v)) continue;
      if (ex.mode === "fill" && isNum(co.data[y][k])) continue;
      co.data[y][k] = v; co.src[y][k] = { ex: 1, note: t.notes[k] || "", file: t.files[k] || "" }; n++;
    }
  }
  co.years = [...all].sort((a, b) => a - b);
  S.dirty = true; S.tab = "data"; S.ex = null;
  renderCompany();
  msg("#data-msg", "warn", `${n} nilai dimasukkan dan ditandakan kuning. Sila semak setiap nilai, kemudian tekan <b>Simpan</b>.`);
}

/* ---------- Keputusan ---------- */
async function loadBench() {
  try { return (await API("GET", "bench")).bench || {}; } catch { return {}; }
}
function indTableHtml(co, bench) {
  const rows = computeAll(co);
  if (!rows.length) return `<div class="msg info">Belum ada data.</div>`;
  let h = `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Petunjuk Produktiviti</th>${rows.map(r => `<th>${r.year}</th>`).join("")}</tr></thead><tbody>`;
  h += `<tr><td>${co.category === "MI" ? "Status semakan data" : "Status integriti data"}</td>${rows.map(r => `<td>${chkBadge(r.chk.status)}</td>`).join("")}</tr>`;
  indsFor(co.category).forEach((d, i) => {
    h += `<tr class="${d.key ? "key" : ""}"><td class="fl">${i + 1}. ${esc(d.l)} <span class="muted">(${esc(d.u)})</span><small>${esc(d.en)}</small></td>${rows.map(r => {
      const g = r.gr[d.k];
      return `<td class="num">${fmt(r.ind[d.k], d.dp)}${isNum(g) ? `<br><span class="small" style="color:var(--text-2)">${g >= 0 ? "▲" : "▼"} ${fmt(Math.abs(g), 1)}%</span>` : ""}</td>`;
    }).join("")}</tr>`;
  });
  h += `<tr><td class="fl">Daya Saing Kos Buruh<small>Kompetitif jika pertumbuhan produktiviti buruh ≥ pertumbuhan kos buruh per pekerja</small></td>${rows.map(r => `<td>${r.comp == null ? "—" : r.comp ? `<span class="badge b-good">✓ Kompetitif</span>` : `<span class="badge b-bad">✕ Tidak kompetitif</span>`}</td>`).join("")}</tr>`;
  if (bench) h += `<tr><td class="fl">Median Produktiviti Buruh sektor<small>Syarikat lain dalam sektor sama (min. 3 syarikat)</small></td>${rows.map(r => `<td class="num">${bench[r.year] ? fmt(bench[r.year].lp) + `<br><span class="small muted">n=${bench[r.year].n}</span>` : "—"}</td>`).join("")}</tr>`;
  h += `</tbody></table></div><p class="small muted">▲▼ pertumbuhan berbanding tahun sebelumnya yang ada data. Petunjuk bagi tahun yang tidak LULUS semakan integriti mungkin tidak tepat.</p>`;
  return h;
}
function chartHtml(co, bench) {
  const rows = computeAll(co).filter(r => isNum(r.ind.lp));
  if (rows.length < 1) return "";
  const hasB = bench && rows.some(r => bench[r.year]);
  const W = 680, H = 270, L = 70, R = 16, T = 18, B = 34;
  const vals = rows.map(r => r.ind.lp).concat(hasB ? rows.map(r => bench[r.year]?.lp).filter(isNum) : []);
  let max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const step = niceStep((max - min) / 4 || 1); max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step; if (max === min) max = min + step;
  const y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
  const bw = (W - L - R) / rows.length, barW = Math.min(46, bw * 0.55);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Produktiviti buruh mengikut tahun">`;
  for (let v = min; v <= max + 1e-9; v += step) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--text-2)">${shortNum(v)}</text>`;
  const pts = [];
  rows.forEach((r, i) => {
    const cx = L + bw * i + bw / 2, v = r.ind.lp, y0 = y(0), y1 = y(v), hh = Math.abs(y0 - y1), top = Math.min(y0, y1), rr = Math.min(4, hh);
    const x0 = cx - barW / 2;
    const path = v >= 0
      ? `M${x0},${y0} V${top + rr} Q${x0},${top} ${x0 + rr},${top} H${x0 + barW - rr} Q${x0 + barW},${top} ${x0 + barW},${top + rr} V${y0} Z`
      : `M${x0},${y0} V${top + hh - rr} Q${x0},${top + hh} ${x0 + rr},${top + hh} H${x0 + barW - rr} Q${x0 + barW},${top + hh} ${x0 + barW},${top + hh - rr} V${y0} Z`;
    s += `<path d="${path}" fill="var(--s1)"/>`;
    s += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="12" fill="var(--text-2)">${r.year}</text>`;
    if (i === rows.length - 1) s += `<text x="${cx}" y="${(v >= 0 ? top : top + hh) + (v >= 0 ? -6 : 14)}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--text)">${shortNum(v)}</text>`;
    const b = bench?.[r.year]?.lp; if (hasB && isNum(b)) pts.push([cx, y(b)]);
    s += `<rect x="${L + bw * i}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-tip="${esc(`${r.year}|${fmt(v)}|${isNum(b) ? fmt(b) : ""}`)}"/>`;
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)"/>`;
  if (pts.length) {
    if (pts.length > 1) s += `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="var(--s2)" stroke-width="2" pointer-events="none"/>`;
    pts.forEach(p => s += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="var(--s2)" stroke="var(--surface-2)" stroke-width="2" pointer-events="none"/>`);
  }
  s += `</svg>`;
  const legend = hasB ? `<div class="legend"><span><i style="background:var(--s1)"></i>Syarikat anda</span><span><i style="background:var(--s2);border-radius:50%"></i>Median sektor</span></div>` : "";
  return `<h3>Produktiviti Buruh (RM Nilai Ditambah per pekerja)</h3>${legend}<div class="chart-wrap" id="chart">${s}<div class="tip" id="tip"></div></div>`;
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
function shortNum(v) { const a = Math.abs(v); return (v < 0 ? "-" : "") + (a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "j" : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k" : a.toFixed(0)); }
document.addEventListener("mousemove", e => {
  const t = e.target.closest?.("[data-tip]"), tip = $("#tip");
  if (!tip) return;
  if (!t) { tip.style.display = "none"; return; }
  const [yr, v, b] = t.dataset.tip.split("|"), box = $("#chart").getBoundingClientRect();
  tip.innerHTML = `<b>${yr}</b><br>Syarikat: RM ${v}${b ? `<br>Median sektor: RM ${b}` : ""}`;
  tip.style.display = "block";
  tip.style.left = Math.min(e.clientX - box.left + 12, box.width - 170) + "px"; tip.style.top = (e.clientY - box.top - 10) + "px";
});
async function renderHasil() {
  const co = S.co;
  $("#view").innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>Keputusan Produktiviti</h2>
    ${S.dl ? `<button class="btn" data-act="dl-co">⬇ Muat turun Excel</button>` : ""}</div>
    ${S.dirty ? `<div class="msg warn">Keputusan di bawah termasuk perubahan yang belum disimpan.</div>` : ""}
    <div id="chart-box">${chartHtml(co, S.bench)}</div><div id="ind-box" style="margin-top:14px">${indTableHtml(co, S.bench)}</div><div id="dl-msg"></div></div>`;
  if (S.bench == null && co.sector) {
    S.bench = await loadBench();
    if (S.tab === "hasil" && S.session?.role === "co") { const c = $("#chart-box"), i = $("#ind-box"); if (c) c.innerHTML = chartHtml(S.co, S.bench); if (i) i.innerHTML = indTableHtml(S.co, S.bench); }
  }
}

/* ---------- Hantar ---------- */
function renderHantar() {
  const co = S.co, rows = computeAll(co);
  const ss = summaryStatus(rows);
  const unrev = (co.years || []).reduce((s, y) => s + exCount(co, y), 0);
  const prof = co.name && co.sector && co.officer && (co.email || co.tel);
  const items = [
    [rows.length >= 1, `Sekurang-kurangnya satu tahun data (${rows.length} tahun diisi; disyorkan sekurang-kurangnya 2 tahun untuk pengiraan pertumbuhan).`],
    [ss.s === "LULUS", `Semua tahun LULUS semakan integriti (${ss.pass}/${ss.n}).` + (ss.s !== "LULUS" ? ` Tahun bermasalah: ${rows.filter(r => r.chk.status !== "LULUS").map(r => r.year).join(", ")}.` : "")],
    [unrev === 0, unrev ? `${unrev} nilai diekstrak secara automatik belum disemak.` : "Semua nilai diekstrak telah disemak."],
    [!!prof, "Profil syarikat lengkap (nama, sektor, pegawai, e-mel/telefon)."],
    [!S.dirty, "Semua perubahan telah disimpan."]
  ];
  const ready = items.every(i => i[0]);
  let body;
  if (co.status === "dihantar") body = `<div class="msg info">Dihantar pada ${fmtDate(co.submittedAt)} oleh ${esc(co.declaration?.by || "")}.</div><button class="btn" data-act="withdraw">Tarik balik untuk pindaan</button>`;
  else if (co.status === "disahkan") body = `<div class="msg good">Data telah disahkan oleh MPC. Hubungi MPC jika pindaan diperlukan.</div>`;
  else body = `<ul class="chk" style="list-style:none;padding:0">${items.map(([ok, t]) => `<li>${ok ? `<span class="badge b-good">✓</span>` : `<span class="badge b-bad">✕</span>`} ${esc(t)}</li>`).join("")}</ul>
    <form id="f-submit" class="stack" style="margin-top:14px">
      <label class="f"><span>Nama pegawai yang mengesahkan</span><input type="text" name="by" value="${esc(co.officer)}" required></label>
      <label class="row"><input type="checkbox" name="decl" required> <span>Saya mengesahkan bahawa data yang dihantar, termasuk nilai yang diekstrak secara automatik, telah disemak dan selaras dengan penyata kewangan syarikat.</span></label>
      <div id="sub-msg"></div><div><button class="btn p" type="submit" ${ready ? "" : "disabled"}>Hantar kepada MPC</button></div></form>`;
  $("#view").innerHTML = `<div class="card"><h2>Hantar kepada MPC</h2>${body}</div>`;
}
FORMS["f-submit"] = async f => {
  try { S.co = (await API("POST", "company/submit", { by: f.by.value.trim() })).company; renderCompany(); }
  catch (e) { msg("#sub-msg", "bad", dbErr(e)); }
};

/* ---------- Profil ---------- */
function renderProfil() {
  const co = S.co;
  $("#view").innerHTML = `<div class="card"><h2>Profil Syarikat</h2><p class="muted small">ID Syarikat: <b>${esc(co.companyId)}</b> · Akaun ${badge(ACCT, co.account)}</p>
    <form id="f-prof" class="stack">${profileFields(co, { catLocked: isLocked() })}<div id="prof-msg"></div><button class="btn p" type="submit">Simpan Profil</button></form></div>
    <div class="card"><h2>Tukar Kata Laluan</h2><form id="f-pw" class="stack" style="max-width:420px">
      <label class="f"><span>Kata laluan semasa</span><input type="password" name="cur" required></label>
      <label class="f"><span>Kata laluan baharu</span><input type="password" name="pw" required></label>
      <label class="f"><span>Sahkan</span><input type="password" name="pw2" required></label>
      <div id="pw-msg"></div><button class="btn" type="submit">Tukar</button></form></div>`;
}
FORMS["f-prof"] = async f => {
  const p = readProfile(f);
  if (!p.name || !p.sector || !p.officer) return msg("#prof-msg", "bad", "Sila lengkapkan medan bertanda *.");
  try { const d = await API("PUT", "company", p); S.co.name = d.company.name; S.co.sector = d.company.sector; S.co.category = d.company.category; PROFILE_KEYS_C.forEach(k => S.co[k] = d.company[k]); S.co.history = d.company.history; S.co.updatedAt = d.company.updatedAt; S.bench = null; msg("#prof-msg", "good", "Profil disimpan."); $("#who").querySelector("b").textContent = S.co.name; }
  catch (e) { msg("#prof-msg", "bad", dbErr(e)); }
};
FORMS["f-pw"] = async f => {
  const p = pwProblem(f.pw.value); if (p) return msg("#pw-msg", "bad", p);
  if (f.pw.value !== f.pw2.value) return msg("#pw-msg", "bad", "Kata laluan tidak sepadan.");
  try { await API("POST", "company/password", { cur: f.cur.value, pw: f.pw.value }); f.reset(); msg("#pw-msg", "good", "Kata laluan ditukar."); }
  catch (e) { msg("#pw-msg", "bad", esc(dbErr(e))); }
};
const PROFILE_KEYS_C = ["ssm", "subsector", "address", "tel", "email", "officer", "website"];

/* ---------- Eksport Excel ---------- */
async function saveXlsx(wb, filename, msgSel) {
  try {
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    await S.dl.save({ filename, data: new Uint8Array(buf) });
    msg(msgSel, "good", "Fail disediakan.");
  } catch (e) { if (e?.code !== "declined") msg(msgSel, "bad", "Muat turun tidak dapat dibuat dalam paparan ini."); }
}
function companySheets(co) {
  const rows = computeAll(co), cat = co.category, ys = rows.map(r => r.year);
  const a = [["Syarikat", co.name], ["ID", co.companyId], ["Templat", CATS[cat]], ["Sektor", co.sector], [], ["Medan", ...ys]];
  for (const f of fieldsFor(cat)) a.push([flabel(f, cat), ...ys.map(y => co.data?.[y]?.[f.k] ?? null)]);
  if (cat === "MI") a.push([], ["Nisbah Nilai Ditambah / Jualan (%)", ...rows.map(r => r.c.output ? r.c.av / r.c.output * 100 : null)], ["Status semakan", ...rows.map(r => r.chk.status)]);
  else a.push([], ["Jumlah Output", ...rows.map(r => r.c.output)], ["Jumlah BIMS", ...rows.map(r => r.c.bims)], ["Jumlah Kos Buruh", ...rows.map(r => r.c.labour)],
    ["Nilai Ditambah (tambah)", ...rows.map(r => r.c.avAdd)], ["Nilai Ditambah (tolak)", ...rows.map(r => r.c.avSub)], ["Status integriti", ...rows.map(r => r.chk.status)]);
  const b = [["Petunjuk", "Unit", ...ys]];
  indsFor(cat).forEach((d, i) => { b.push([`${i + 1}. ${d.l} / ${d.en}`, d.u, ...rows.map(r => r.ind[d.k])]); b.push(["   Pertumbuhan (%)", "%", ...rows.map(r => r.gr[d.k] ?? null)]); });
  b.push(["Daya saing kos buruh", "", ...rows.map(r => r.comp == null ? "" : r.comp ? "Kompetitif" : "Tidak kompetitif")]);
  const pd = physDefs(co), c = [["Petunjuk Fizikal", "Unit", ...ys]];
  pd.forEach(d => c.push([d.l, d.u, ...ys.map(y => co.phys?.[y]?.[d.k] ?? null)]));
  const A = analyze(co, null), strip = t => String(t).replace(/<[^>]+>/g, "");
  const e = [["ANALISIS PRODUKTIVITI — " + co.name], []];
  A.sections.forEach(sc => { e.push([sc.title]); sc.paras.forEach(p => e.push([strip(p)])); sc.items.forEach(i => e.push([(i.t === "good" ? "✓ " : i.t === "bad" ? "! " : "• ") + i.text])); e.push([]); });
  e.push(["Cadangan Tindakan"]); A.recs.forEach((r, i) => e.push([`${i + 1}. ${r.t}`]));
  if (co.analysis?.text) { e.push([], ["ULASAN NARATIF (Claude, " + fmtDate(co.analysis.at) + ")"]); co.analysis.text.split("\n").forEach(l => e.push([l.replace(/\*\*/g, "")])); }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), "Data Kewangan");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(c), "Data Fizikal");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), "Petunjuk");
  const ws = XLSX.utils.aoa_to_sheet(e); ws["!cols"] = [{ wch: 140 }];
  XLSX.utils.book_append_sheet(wb, ws, "Analisis");
  return wb;
}

/* ================= MASTER ADMIN ================= */
const AD_TABS = [["dash", "Papan Pemuka"], ["list", "Senarai Syarikat"], ["create", "Cipta Akaun Syarikat"], ["settings", "Tetapan"]];
function enterAdmin() {
  S.ad.tab = "dash"; S.ad.sel = null; S.ad.loaded = false;
  S.ad.unsub?.();
  adminRefresh();
  const t = setInterval(adminRefresh, 30000);
  S.ad.unsub = () => clearInterval(t);
  renderAdmin();
  setTimeout(() => { if (!S.ad.loaded && S.session?.role === "ad") { const v = $("#view"); if (v && !S.ad.list.length) v.insertAdjacentHTML("afterbegin", `<div class="msg warn">Data belum dapat dicapai. Sila tunggu atau semak sambungan.</div>`); } }, 10000);
}
async function adminRefresh() {
  try {
    const d = await API("GET", "admin/companies");
    S.ad.list = d.companies || []; S.ad.loaded = true;
    if (S.session?.role === "ad" && ["dash", "list"].includes(S.ad.tab) && !S.aiBusy) {
      const keepComment = $("#rv-comment")?.value, y = window.scrollY;
      renderAdmin();
      if (keepComment && $("#rv-comment")) $("#rv-comment").value = keepComment;
      window.scrollTo(0, y);
    }
  } catch (e) { if (e.code === "unauth") { S.ad.unsub?.(); renderLogin(); } }
}
function renderAdmin() {
  setTabs(AD_TABS, S.ad.tab);
  $("#who").innerHTML = `<div><b>Master Admin</b> · ${esc(S.session.u)}</div><div class="row" style="justify-content:flex-end;margin-top:3px"><span class="badge b-info">MPC</span><button class="btn sm" data-act="logout">Log keluar</button></div>`;
  main().innerHTML = `<div id="view"></div>`;
  ({ dash: renderDash, list: () => S.ad.sel ? renderDetail() : renderList(), create: renderCreate, settings: renderSettings })[S.ad.tab]();
}
function latestPass(co) { const r = computeAll(co).filter(r => r.chk.status === "LULUS"); return r[r.length - 1] || null; }
function renderDash() {
  const L = S.ad.list;
  const cnt = f => L.filter(f).length;
  const pend = L.filter(c => c.account === "menunggu"), sub = L.filter(c => c.status === "dihantar");
  const bySec = {};
  for (const c of L) { const s = bySec[c.sector || "—"] = bySec[c.sector || "—"] || { n: 0, ok: 0, lp: [], av: [] }; s.n++; if (c.status === "disahkan") { s.ok++; const r = latestPass(c); if (r) { s.lp.push(r.ind.lp); s.av.push(r.ind.avlc); } } }
  $("#view").innerHTML = `<div class="tiles">
      <div class="tile"><div class="v">${L.length}</div><div class="l">Jumlah syarikat berdaftar</div></div>
      <div class="tile"><div class="v">${pend.length}</div><div class="l">Akaun menunggu kelulusan</div></div>
      <div class="tile"><div class="v">${sub.length}</div><div class="l">Data dihantar, perlu disemak</div></div>
      <div class="tile"><div class="v">${cnt(c => c.status === "disahkan")}</div><div class="l">Data disahkan</div></div>
      <div class="tile"><div class="v">${cnt(c => ["draf", "dikembalikan"].includes(c.status))}</div><div class="l">Draf / dikembalikan</div></div></div>
    ${pend.length ? `<div class="card"><h2>Akaun Menunggu Kelulusan</h2><table class="lst"><thead><tr><th>ID</th><th>Syarikat</th><th>Sektor</th><th>Templat</th><th>Didaftar</th><th></th></tr></thead><tbody>
      ${pend.map(c => `<tr data-act="open-co" data-id="${esc(c.companyId)}"><td>${esc(c.companyId)}</td><td>${esc(c.name)}</td><td>${esc(c.sector)}</td><td>${esc(CATS[c.category] || "")}</td><td>${fmtDate(c.createdAt)}</td><td><button class="btn sm p" data-act="approve-acct" data-id="${esc(c.companyId)}">Luluskan</button></td></tr>`).join("")}</tbody></table></div>` : ""}
    ${sub.length ? `<div class="card"><h2>Penghantaran Menunggu Semakan</h2><table class="lst"><thead><tr><th>ID</th><th>Syarikat</th><th>Tahun</th><th>Integriti</th><th>Dihantar</th></tr></thead><tbody>
      ${sub.map(c => { const ss = summaryStatus(computeAll(c)); return `<tr data-act="open-co" data-id="${esc(c.companyId)}"><td>${esc(c.companyId)}</td><td>${esc(c.name)}</td><td>${(c.years || []).length}</td><td>${chkBadge(ss.s)} ${ss.pass}/${ss.n}</td><td>${fmtDate(c.submittedAt)}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
    <div class="card"><h2>Ringkasan Mengikut Sektor</h2><p class="small muted">Median dikira daripada tahun terkini yang LULUS bagi syarikat yang datanya telah disahkan.</p>
      <table class="lst"><thead><tr><th>Sektor</th><th>Bil. syarikat</th><th>Disahkan</th><th>Median Produktiviti Buruh (RM)</th><th>Median Nilai Ditambah per Kos Buruh</th></tr></thead><tbody>
      ${Object.entries(bySec).sort((a, b) => b[1].n - a[1].n).map(([s, v]) => `<tr style="cursor:default"><td>${esc(s)}</td><td>${v.n}</td><td>${v.ok}</td><td class="num">${fmt(median(v.lp))}</td><td class="num">${fmt(median(v.av), 2)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Belum ada syarikat.</td></tr>`}</tbody></table></div>`;
}
function renderList() {
  const f = S.ad.f;
  const q = f.q.toLowerCase();
  const L = S.ad.list.filter(c => (!q || (c.name || "").toLowerCase().includes(q) || (c.companyId || "").toLowerCase().includes(q) || (c.ssm || "").toLowerCase().includes(q))
    && (!f.cat || c.category === f.cat) && (!f.sector || c.sector === f.sector) && (!f.status || c.status === f.status || c.account === f.status))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  $("#view").innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>Senarai Syarikat (${L.length})</h2>${S.dl ? `<button class="btn" data-act="dl-all">⬇ Eksport semua ke Excel</button>` : ""}</div>
    <div class="row" style="margin:10px 0">
      <input type="text" id="flt-q" placeholder="Cari nama, ID atau SSM" value="${esc(f.q)}" style="max-width:260px">
      <select id="flt-cat" style="max-width:200px"><option value="">Semua templat</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${f.cat === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <select id="flt-sector" style="max-width:240px"><option value="">Semua sektor</option>${SECTORS.map(s => `<option ${f.sector === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select id="flt-status" style="max-width:220px"><option value="">Semua status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${esc(v[0])}</option>`).join("")}${Object.entries(ACCT).map(([k, v]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>Akaun: ${esc(v[0])}</option>`).join("")}</select>
    </div><div id="dl-msg"></div>
    <div class="tbl-wrap" style="max-height:none"><table class="lst"><thead><tr><th>ID</th><th>Syarikat</th><th>Templat</th><th>Sektor</th><th>Tahun</th><th>Integriti</th><th>Status</th><th>Akaun</th><th>Dikemas kini</th></tr></thead><tbody>
    ${L.map(c => { const ss = summaryStatus(computeAll(c)); return `<tr data-act="open-co" data-id="${esc(c.companyId)}"><td>${esc(c.companyId)}</td><td>${esc(c.name)}</td><td>${esc((CATS[c.category] || "").split(" (")[0])}</td><td>${esc(c.sector)}</td><td>${(c.years || []).length}</td><td>${ss.n ? chkBadge(ss.s) + " " + ss.pass + "/" + ss.n : "—"}</td><td>${badge(STATUS, c.status)}</td><td>${badge(ACCT, c.account)}</td><td>${fmtDate(c.updatedAt)}</td></tr>`; }).join("") || `<tr><td colspan="9" class="muted">Tiada syarikat.</td></tr>`}
    </tbody></table></div></div>`;
}
function renderDetail() {
  const co = S.ad.list.find(c => c.companyId === S.ad.sel);
  if (!co) { S.ad.sel = null; return renderList(); }
  const canReview = co.status === "dihantar", reopen = co.status === "disahkan";
  $("#view").innerHTML = `<button class="btn sm" data-act="back-list">← Kembali ke senarai</button>
    <div class="card" style="margin-top:10px"><div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><h1>${esc(co.name)}</h1><div class="row">${badge(STATUS, co.status)} ${badge(ACCT, co.account)} <span class="muted">${esc(co.companyId)} · ${esc(CATS[co.category])} · ${esc(co.sector)}${co.subsector ? " / " + esc(co.subsector) : ""}</span></div></div>
      <div class="row">${co.account === "menunggu" ? `<button class="btn p" data-act="approve-acct" data-id="${esc(co.companyId)}">Luluskan akaun</button>` : ""}
        ${co.account === "aktif" ? `<button class="btn d" data-act="suspend" data-id="${esc(co.companyId)}">Gantung akaun</button>` : ""}
        ${co.account === "digantung" ? `<button class="btn" data-act="approve-acct" data-id="${esc(co.companyId)}">Aktifkan semula</button>` : ""}
        <button class="btn" data-act="reset-pw" data-id="${esc(co.companyId)}">Set semula kata laluan</button>
        ${S.dl ? `<button class="btn" data-act="dl-one" data-id="${esc(co.companyId)}">⬇ Excel</button>` : ""}</div></div>
      <p class="small muted" style="margin:10px 0 0">SSM: ${esc(co.ssm || "—")} · Pegawai: ${esc(co.officer || "—")} · Tel: ${esc(co.tel || "—")} · E-mel: ${esc(co.email || "—")} · Alamat: ${esc(co.address || "—")}</p>
      <div id="dl-msg"></div></div>
    ${canReview || reopen ? `<div class="card"><h2>Semakan MPC</h2>
      <label class="f"><span>Ulasan kepada syarikat ${canReview ? "(wajib jika dikembalikan)" : ""}</span><textarea id="rv-comment">${esc(co.review?.comment || "")}</textarea></label>
      <div class="row" style="margin-top:10px">${canReview ? `<button class="btn p" data-act="rv-ok" data-id="${esc(co.companyId)}">✓ Sahkan data</button><button class="btn d" data-act="rv-back" data-id="${esc(co.companyId)}">Kembalikan untuk pembetulan</button>` : `<button class="btn" data-act="rv-back" data-id="${esc(co.companyId)}">Buka semula (kembalikan kepada syarikat)</button>`}</div><div id="rv-msg"></div></div>` : ""}
    <div class="card"><h2>Data Kewangan</h2>${(co.years || []).length ? dataTableHtml(co, true) + checksHtml(co) : `<div class="msg info">Belum ada data.</div>`}</div>
    <div class="card"><h2>Petunjuk Produktiviti</h2>${chartHtml(co, null)}<div style="margin-top:12px">${indTableHtml(co, null)}</div></div>
    <div class="card"><h2>Data Fizikal</h2>${(co.years || []).length && physDefs(co).some(d => (co.years || []).some(y => isNum(co.phys?.[y]?.[d.k]))) ? physTableHtml(co, true) : `<div class="msg info">Tiada data fizikal diisi.</div>`}</div>
    <div class="card"><h2>Analisis Produktiviti</h2>${analysisHtml(analyze(co, null))}</div>
    ${aiBlockHtml(co, true)}
    <div class="card"><h2>Sejarah</h2><ul class="small">${(co.history || []).slice().reverse().map(h => `<li>${fmtDate(h.at)} · ${esc(h.action)} · <span class="muted">${esc(h.by)}</span></li>`).join("")}</ul></div>`;
}
function renderCreate() {
  $("#view").innerHTML = `<div class="card" style="max-width:860px"><h2>Cipta Akaun Syarikat</h2>
    <p class="muted">ID Syarikat dan kata laluan sementara akan dijana. Syarikat perlu menukar kata laluan semasa log masuk pertama.</p>
    <form id="f-create" class="stack" autocomplete="off">${profileFields({ category: "M" })}<div id="cr-msg"></div><button class="btn p" type="submit">Cipta Akaun</button></form></div>`;
}
FORMS["f-create"] = async f => {
  const p = readProfile(f);
  if (!p.name || !p.sector || !p.officer) return msg("#cr-msg", "bad", "Sila lengkapkan medan bertanda *.");
  msg("#cr-msg", "info", "Mencipta…");
  try {
    const { id, pw } = await API("POST", "admin/companies", { profile: p });
    f.reset(); msg("#cr-msg", "", ""); adminRefresh();
    credModal(p.name, id, pw);
  } catch (e) { msg("#cr-msg", "bad", dbErr(e)); }
};
function credModal(name, id, pw) {
  modal(`<h2>Maklumat Log Masuk</h2><p>${esc(name)}</p>
    <p class="small muted">Berikan maklumat ini kepada syarikat. Kata laluan tidak akan dipaparkan lagi.</p>
    <div class="cred">ID: ${esc(id)}<br>Kata laluan sementara: ${esc(pw)}</div>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="copy-cred" data-t="${esc(`ID Syarikat: ${id}\nKata laluan sementara: ${pw}`)}">Salin</button><button class="btn p" data-act="close-modal">Selesai</button></div><div id="copy-msg"></div>`);
}
function renderSettings() {
  $("#view").innerHTML = `<div class="card" style="max-width:560px"><h2>Tukar Kata Laluan Master Admin</h2>
    <form id="f-apw" class="stack"><label class="f"><span>Kata laluan semasa</span><input type="password" name="cur" required></label>
    <label class="f"><span>Kata laluan baharu</span><input type="password" name="pw" required></label>
    <label class="f"><span>Sahkan</span><input type="password" name="pw2" required></label><div id="apw-msg"></div><button class="btn p" type="submit">Tukar</button></form></div>
    <div class="card" style="max-width:560px"><h2>Gaji Minimum</h2><p class="small muted">Digunakan untuk semakan munasabah kos buruh per pekerja (terutama syarikat mikro). Kemas kini apabila kadar gaji minimum kebangsaan berubah.</p>
    <form id="f-wage" class="row"><label class="f" style="flex:1"><span>Gaji minimum bulanan (RM)</span><input type="number" name="w" min="1" step="1" value="${MIN_WAGE}" required></label><button class="btn p" type="submit" style="align-self:flex-end">Simpan</button></form><div id="wage-msg"></div></div>
    <div class="card" style="max-width:860px"><h2>Maklumat Sistem</h2><ul class="small">
      <li>Toleransi semakan integriti: RM ${TOL}. Maksimum ${MAX_YEARS} tahun data bagi setiap syarikat.</li>
      <li>Kata laluan disimpan sebagai hash PBKDF2-SHA256 (100,000 lelaran) dan tidak pernah disimpan dalam teks biasa.</li>
      <li>Log masuk disahkan di pelayan (Cloudflare). Sesi tamat selepas 12 jam; 5 cubaan gagal mengunci akaun selama 15 minit.</li>
      <li>Setiap syarikat hanya boleh membaca dan mengubah data sendiri. Hanya Master Admin boleh melihat semua syarikat.</li>
      <li>Pengekstrakan automatik & ulasan naratif: ${S.sample ? "aktif" : "tidak aktif (tetapkan ANTHROPIC_API_KEY di Cloudflare)"}.</li></ul></div>`;
}
FORMS["f-wage"] = async f => {
  const w = Number(f.w.value); if (!(w > 0)) return msg("#wage-msg", "bad", "Nilai tidak sah.");
  try { await API("PUT", "admin/config", { minWageMonthly: w }); MIN_WAGE = w; msg("#wage-msg", "good", `Gaji minimum ditetapkan RM ${fmt(w)} sebulan.`); }
  catch (e) { msg("#wage-msg", "bad", dbErr(e)); }
};
FORMS["f-apw"] = async f => {
  const p = pwProblem(f.pw.value); if (p) return msg("#apw-msg", "bad", p);
  if (f.pw.value !== f.pw2.value) return msg("#apw-msg", "bad", "Kata laluan tidak sepadan.");
  try { await API("POST", "admin/password", { cur: f.cur.value, pw: f.pw.value }); f.reset(); msg("#apw-msg", "good", "Kata laluan ditukar."); }
  catch (e) { msg("#apw-msg", "bad", esc(dbErr(e))); }
};
async function adminUpdate(id, upd, action, msgSel) {
  try { await API("PATCH", "admin/companies/" + id, upd); await adminRefresh(); return true; }
  catch (e) { msg(msgSel || "#view", "bad", esc(dbErr(e))); return false; }
}
function allSheet() {
  const keys = FIELDS.map(f => f.k);
  const head = ["ID", "Syarikat", "SSM", "Templat", "Sektor", "Subsektor", "Status", "Tahun", ...keys, "Jumlah Output", "Jumlah BIMS", "Jumlah Kos Buruh", "AV (tambah)", "AV (tolak)", "Status integriti", ...IND.map(d => d.en), "Daya saing kos buruh", ...PHYS.map(d => `${d.en} (${d.u})`), "Lain-lain 1", "Lain-lain 2", "Lain-lain 3"];
  const a = [head];
  for (const co of S.ad.list) for (const r of computeAll(co))
    a.push([co.companyId, co.name, co.ssm, CATS[co.category], co.sector, co.subsector, co.status, r.year, ...keys.map(k => r.v[k] ?? null), r.c.output, r.c.bims, r.c.labour, r.c.avAdd, r.c.avSub, r.chk.status, ...IND.map(d => r.ind[d.k]), r.comp == null ? "" : r.comp ? "Kompetitif" : "Tidak kompetitif", ...PHYS.map(d => co.phys?.[r.year]?.[d.k] ?? null), ...PCUST.map((k, i) => co.physCustom?.[i]?.name && isNum(co.phys?.[r.year]?.[k]) ? `${co.physCustom[i].name}: ${co.phys[r.year][k]} ${co.physCustom[i].unit || ""}` : "")]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), "Data Semua Syarikat");
  return wb;
}

/* ================= TINDAKAN ================= */
function rerenderTab() { if (S.tab === "fizikal") renderPhys(); else renderData(); }
const ACT = {
  "tab": el => {
    if (S.session?.role === "ad") { S.ad.tab = el.dataset.k; S.ad.sel = null; renderAdmin(); return; }
    if (S.session?.role === "co") { S.tab = el.dataset.k; renderCompany(); }
  },
  "login-tab": el => { S.loginTab = el.dataset.k; renderLogin(); },
  "register": () => renderRegister(),
  "to-login": () => renderLogin(),
  "logout": () => {
    if (S.dirty) return modal(`<h2>Perubahan belum disimpan</h2><p>Log keluar tanpa menyimpan?</p><div class="row"><button class="btn d" data-act="logout-force">Log keluar</button><button class="btn" data-act="close-modal">Batal</button></div>`);
    doLogout();
  },
  "logout-force": () => { modal(""); doLogout(); },
  "close-modal": () => modal(""),
  "modal-bg": (el, e) => { if (e.target === el) modal(""); },
  "add-year": () => {
    const y = parseInt($("#new-year")?.value, 10), co = S.co, max = new Date().getFullYear() + 1;
    if (!(y >= 1990 && y <= max)) return msg("#data-msg", "bad", `Masukkan tahun antara 1990 dan ${max}.`);
    co.years = co.years || [];
    if (co.years.includes(y)) return msg("#data-msg", "bad", `Tahun ${y} sudah ada.`);
    if (co.years.length >= MAX_YEARS) return msg("#data-msg", "bad", `Maksimum ${MAX_YEARS} tahun.`);
    co.years.push(y); co.years.sort((a, b) => a - b); co.data = co.data || {}; co.data[y] = co.data[y] || {};
    S.dirty = true; rerenderTab();
  },
  "del-year": el => {
    const y = el.dataset.y;
    modal(`<h2>Buang tahun ${esc(y)}?</h2><p>Semua data kewangan dan fizikal bagi tahun ${esc(y)} akan dibuang selepas anda menekan Simpan.</p><div class="row"><button class="btn d" data-act="del-year-ok" data-y="${esc(y)}">Buang</button><button class="btn" data-act="close-modal">Batal</button></div>`);
  },
  "del-year-ok": el => {
    const y = +el.dataset.y, co = S.co; modal("");
    co.years = (co.years || []).filter(x => x !== y); delete co.data?.[y]; delete co.src?.[y]; delete co.phys?.[y];
    S.dirty = true; rerenderTab();
  },
  "rev-year": el => { const y = el.dataset.y; if (S.co.src?.[y]) for (const k of Object.keys(S.co.src[y])) delete S.co.src[y][k]; S.dirty = true; renderData(); },
  "save": async el => {
    if ($$("td.bad input:not([data-pk])").length) return msg("#data-msg", "bad", "Terdapat nilai yang tidak sah (sel bersempadan merah). Sila betulkan dahulu.");
    el.disabled = true; msg("#data-msg", "info", "Menyimpan…");
    try {
      await saveCompany();
      rerenderTab(); msg("#data-msg", "good", "Disimpan.");
    } catch (e) { el.disabled = false; msg("#data-msg", "bad", dbErr(e)); }
  },
  "rm-file": el => { S.ex.files.splice(+el.dataset.i, 1); renderUpload(); },
  "extract": () => runExtract(),
  "stop-extract": () => S.ex?.ctl?.abort(),
  "clear-extract": () => { S.ex = null; renderUpload(); },
  "sel-year": el => { S.ex.sel[el.dataset.y] = el.checked; },
  "xmode": el => { S.ex.mode = el.value; },
  "apply-extract": () => applyExtract(),
  "withdraw": async () => {
    try { S.co = (await API("POST", "company/withdraw", {})).company; renderCompany(); }
    catch (e) { msg("#view", "bad", dbErr(e)); }
  },
  "dl-co": () => saveXlsx(companySheets(S.co), `Produktiviti_${S.co.companyId}.xlsx`, "#dl-msg"),
  "dl-one": el => { const co = S.ad.list.find(c => c.companyId === el.dataset.id); if (co) saveXlsx(companySheets(co), `Produktiviti_${co.companyId}.xlsx`, "#dl-msg"); },
  "dl-all": () => saveXlsx(allSheet(), `MPC_Produktiviti_Semua_${new Date().toISOString().slice(0, 10)}.xlsx`, "#dl-msg"),
  "open-co": (el, e) => { if (e.target.closest("button")) return; S.ad.sel = el.dataset.id; S.ad.tab = "list"; renderAdmin(); window.scrollTo(0, 0); },
  "back-list": () => { S.ad.sel = null; renderAdmin(); },
  "approve-acct": el => adminUpdate(el.dataset.id, { account: "aktif" }, "Akaun diluluskan/diaktifkan"),
  "suspend": el => adminUpdate(el.dataset.id, { account: "digantung" }, "Akaun digantung"),
  "reset-pw": async el => {
    const id = el.dataset.id, co = S.ad.list.find(c => c.companyId === id);
    try { const { pw } = await API("POST", `admin/companies/${id}/reset-password`, {}); credModal(co?.name || "", id, pw); adminRefresh(); }
    catch (e) { msg("#dl-msg", "bad", esc(dbErr(e))); }
  },
  "rv-ok": async el => { await adminUpdate(el.dataset.id, { status: "disahkan", review: { comment: $("#rv-comment").value.trim(), at: nowIso(), by: S.session.u } }, "Data disahkan", "#rv-msg"); },
  "rv-back": async el => {
    const c = $("#rv-comment").value.trim(); if (!c) return msg("#rv-msg", "bad", "Sila tulis ulasan untuk syarikat.");
    await adminUpdate(el.dataset.id, { status: "dikembalikan", review: { comment: c, at: nowIso(), by: S.session.u } }, "Dikembalikan untuk pembetulan", "#rv-msg");
  },
  "gen-ai": () => {
    if (S.session?.role === "co") { const co = S.co; return genAI(co, "Syarikat (" + (co.officer || co.companyId) + ")", async a => { const d = await API("POST", "company/analysis", a); co.analysis = d.company.analysis; }); }
    const co = S.ad.list.find(c => c.companyId === S.ad.sel); if (!co) return;
    genAI(co, "MPC (" + S.session.u + ")", async a => { await API("PATCH", "admin/companies/" + co.companyId, { analysis: a }); co.analysis = a; });
  },
  "stop-ai": () => aiCtl?.abort(),
  "copy-cred": async el => { try { await navigator.clipboard.writeText(el.dataset.t); msg("#copy-msg", "good", "Disalin."); } catch { msg("#copy-msg", "warn", "Tidak dapat menyalin; sila salin secara manual."); } }
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act; if (!ACT[a]) return;
  if (el.tagName === "A") e.preventDefault();
  if (el.type === "checkbox" || el.type === "radio") { ACT[a](el, e); return; }
  ACT[a](el, e);
});
document.addEventListener("submit", e => {
  const f = e.target, fid = f.getAttribute("id"); if (!FORMS[fid]) return;
  e.preventDefault();
  const b = f.querySelector("[type=submit]"); if (b) b.disabled = true;
  Promise.resolve(FORMS[fid](f)).finally(() => { if (b && document.contains(b)) b.disabled = false; });
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.matches("input[data-k][data-y]")) onDataInput(t);
  else if (t.matches("input[data-pk]")) onPhysInput(t);
  else if (t.matches("input[data-cf]")) onCustInput(t);
  else if (t.matches("input[data-rk]")) {
    const v = parseNum(t.value), td = t.parentElement;
    if (Number.isNaN(v)) { td.classList.add("bad"); return; } td.classList.remove("bad");
    const yv = S.ex.result.years[t.dataset.ry].values;
    if (v == null) delete yv[t.dataset.rk]; else yv[t.dataset.rk] = v;
  } else if (t.id === "flt-q") { S.ad.f.q = t.value; const pos = t.selectionStart; renderList(); const n = $("#flt-q"); n.focus(); n.setSelectionRange(pos, pos); }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.matches("select[data-cf]")) onCustInput(t);
  if (t.id?.startsWith("flt-") && t.id !== "flt-q") { S.ad.f[t.id.slice(4)] = t.value; renderList(); }
  if (t.matches("input[data-rk]") && S.ex?.result) { const r = $("#review"); if (r) r.innerHTML = reviewHtml(); }
});
document.addEventListener("focusout", e => {
  const t = e.target;
  if (t.matches?.("input[data-pk]")) { const v = parseNum(t.value); if (isNum(v)) t.value = fmtIn(v); }
  if (t.matches?.("input[data-k][data-y]")) { const v = parseNum(t.value); if (isNum(v)) t.value = fmtIn(FMAP[t.dataset.k]?.int ? Math.round(v) : v); }
});
boot();
</script>
</body>
</html>
