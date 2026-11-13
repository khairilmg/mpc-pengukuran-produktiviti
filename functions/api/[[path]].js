// API Sistem Pengukuran Produktiviti Syarikat (MPC) — Cloudflare Pages Functions + D1
// Bindings: DB (D1). Secrets: ADMIN_SETUP_KEY (wajib untuk persediaan admin pertama),
// ANTHROPIC_API_KEY (pilihan: pengekstrakan & ulasan), CLAUDE_MODEL (pilihan), AI_DAILY_LIMIT (pilihan).
import { computeAll, summaryStatus, FIELDS, PHYS_KEYS } from "../_lib/calc.js";

const ITER = 100000;                 // had maksimum PBKDF2 dalam Cloudflare Workers
const SESSION_SEC = 12 * 3600;
const MAX_YEARS = 10;
const COOKIE = "mpc_s";
const PROFILE_KEYS = ["name", "ssm", "sector", "subsector", "address", "tel", "email", "officer", "website"];
const CATS = ["M", "S", "MI"];
const FIELD_KEYS = new Set(FIELDS.map(f => f.k));

/* ---------- utiliti ---------- */
const json = (d, status = 200, headers = {}) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const fail = (status, error) => json({ error }, status);
class HttpError extends Error { constructor(s, m) { super(m); this.status = s; } }
const bad = m => { throw new HttpError(400, m); };
const now = () => Math.floor(Date.now() / 1000);
const iso = () => new Date().toISOString();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
function randStr(n, chars) { return Array.from(rand(n), x => chars[x % chars.length]).join(""); }
const genId = () => "MPC-" + randStr(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
const genPw = () => randStr(4, "ABCDEFGHJKLMNPQRSTUVWXYZ") + randStr(4, "23456789") + randStr(2, "abcdefghjkmnpqrstuvwxyz");
async function sha256(s) { return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function hashPw(pw, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : rand(16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
function sameStr(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function verifyPw(pw, salt, hash) { if (!salt || !hash) return false; return sameStr((await hashPw(pw, salt)).hash, hash); }
function pwProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Kata laluan mesti sekurang-kurangnya 8 aksara.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Kata laluan mesti mengandungi huruf dan nombor.";
  if (pw.length > 200) return "Kata laluan terlalu panjang.";
  return null;
}
const str = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ip = req => req.headers.get("cf-connecting-ip") || "0";

/* ---------- had kadar ---------- */
async function blocked(env, k, max) { const r = await env.DB.prepare("SELECT n, reset FROM limits WHERE k=?").bind(k).first(); return !!(r && r.reset > now() && r.n >= max); }
async function hit(env, k, windowSec) {
  const r = await env.DB.prepare("SELECT n, reset FROM limits WHERE k=?").bind(k).first();
  if (!r || r.reset <= now()) await env.DB.prepare("INSERT OR REPLACE INTO limits (k, n, reset) VALUES (?, 1, ?)").bind(k, now() + windowSec).run();
  else await env.DB.prepare("UPDATE limits SET n = n + 1 WHERE k=?").bind(k).run();
}
async function limit(env, k, max, windowSec) { if (await blocked(env, k, max)) throw new HttpError(429, "Terlalu banyak cubaan. Cuba lagi kemudian."); await hit(env, k, windowSec); }

/* ---------- sesi ---------- */
function cookieToken(req) { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)")); return m ? m[1] : null; }
async function getSession(req, env) {
  const t = cookieToken(req); if (!t) return null;
  const s = await env.DB.prepare("SELECT role, subject, expires FROM sessions WHERE token_hash=?").bind(await sha256(t)).first();
  if (!s || s.expires < now()) return null;
  return s;
}
async function newSession(env, role, subject) {
  const t = b64(rand(32)).replace(/[+/=]/g, c => ({ "+": "-", "/": "_", "=": "" }[c]));
  await env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(now()).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, role, subject, expires) VALUES (?, ?, ?, ?)").bind(await sha256(t), role, subject, now() + SESSION_SEC).run();
  return `${COOKIE}=${t}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SEC}`;
}
const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

/* ---------- syarikat ---------- */
async function loadCo(env, id) { return env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(id).first(); }
function coOut(row) {
  const d = JSON.parse(row.doc || "{}");
  return { ...d, companyId: row.id, name: row.name, category: row.category, sector: row.sector, account: row.account, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, auth: { mustChange: !!row.must_change } };
}
function addHist(doc, action, by) { doc.history = (doc.history || []).slice(-49); doc.history.push({ at: iso(), action: str(action, 200), by: str(by, 100) }); }
async function saveCo(env, row, doc, cols = {}) {
  const r = { ...row, ...cols };
  const prof = {}; PROFILE_KEYS.forEach(k => prof[k] = doc[k] || "");
  const keep = { ...doc }; ["companyId", "name", "category", "sector", "account", "status", "createdAt", "updatedAt", "auth"].forEach(k => delete keep[k]);
  const s = JSON.stringify(keep); if (s.length > 900000) bad("Data terlalu besar.");
  await env.DB.prepare("UPDATE companies SET name=?, category=?, sector=?, account=?, status=?, doc=?, pw_salt=?, pw_hash=?, must_change=?, updated_at=? WHERE id=?")
    .bind(r.name, r.category, r.sector, r.account, r.status, s, r.pw_salt, r.pw_hash, r.must_change ? 1 : 0, iso(), r.id).run();
  return loadCo(env, r.id);
}
function readProfile(b, doc) { for (const k of PROFILE_KEYS) if (k in b) doc[k] = str(b[k], k === "address" ? 1000 : 300); }
function cleanNumMap(o, allowed) {
  const out = {}; if (!o || typeof o !== "object") return out;
  for (const [k, v] of Object.entries(o)) if (allowed(k) && typeof v === "number" && isFinite(v) && Math.abs(v) < 1e15) out[k] = v;
  return out;
}
function cleanData(body) {
  const years = Array.isArray(body.years) ? [...new Set(body.years.map(Number))].filter(y => Number.isInteger(y) && y >= 1990 && y <= 2100).sort() : null;
  if (!years) bad("Senarai tahun tidak sah.");
  if (years.length > MAX_YEARS) bad(`Maksimum ${MAX_YEARS} tahun.`);
  const data = {}, phys = {}, src = {};
  for (const y of years) {
    data[y] = cleanNumMap(body.data?.[y], k => FIELD_KEYS.has(k));
    phys[y] = cleanNumMap(body.phys?.[y], k => PHYS_KEYS.has(k));
    src[y] = {};
    for (const [k, v] of Object.entries(body.src?.[y] || {})) if (FIELD_KEYS.has(k) && v && v.ex) src[y][k] = { ex: 1, note: str(v.note, 300), file: str(v.file, 200) };
  }
  const physCustom = [0, 1, 2].map(i => { const c = body.physCustom?.[i] || {}; const o = {}; if (c.name) { o.name = str(c.name, 80); o.unit = str(c.unit, 20); o.dir = c.dir === -1 ? -1 : 1; } return o; });
  return { years, data, phys, src, physCustom };
}
const exCount = co => Object.values(co.src || {}).reduce((s, y) => s + Object.values(y || {}).filter(v => v?.ex).length, 0);
const LOCKED = ["dihantar", "disahkan"];

/* ---------- AI (Claude) ---------- */
async function callClaude(env, prompt, images) {
  const content = [];
  for (const im of images.slice(0, 10)) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(im.media_type) || typeof im.data !== "string" || im.data.length > 7_000_000) bad("Imej tidak sah.");
    content.push({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } });
  }
  content.push({ type: "text", text: prompt });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content }] })
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429) throw new HttpError(429, "Had penggunaan Claude dicapai. Cuba sebentar lagi.");
  if (!r.ok) throw new HttpError(502, "Perkhidmatan Claude tidak dapat diproses: " + (d?.error?.message || r.status));
  const text = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  if (!text) throw new HttpError(502, "Claude tidak memberikan jawapan.");
  return { text, truncated: d.stop_reason === "max_tokens" };
}

/* ---------- penghala ---------- */
export async function onRequest(ctx) {
  const { request: req, env, params } = ctx;
  try {
    if (!env.DB) return fail(500, "Pangkalan data D1 belum disambungkan (binding DB).");
    const path = (params.path || []).join("/"), m = req.method;
    let body = {};
    if (m !== "GET" && m !== "HEAD") {
      if (!(req.headers.get("content-type") || "").includes("application/json")) return fail(415, "Jenis kandungan mesti JSON.");
      if (+req.headers.get("content-length") > 40_000_000) return fail(413, "Permintaan terlalu besar.");
      body = await req.json().catch(() => ({}));
    }
    const ses = await getSession(req, env);
    const needCo = () => { if (ses?.role !== "co") throw new HttpError(401, "Sesi tamat. Sila log masuk semula."); return ses.subject; };
    const needAd = () => { if (ses?.role !== "ad") throw new HttpError(401, "Sesi tamat. Sila log masuk semula."); return ses.subject; };

    /* awam */
    if (m === "GET" && path === "status") {
      const a = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first();
      const w = await env.DB.prepare("SELECT v FROM config WHERE k='minWageMonthly'").first();
      return json({ adminSetup: a.n > 0, ai: !!env.ANTHROPIC_API_KEY, minWage: w ? Number(w.v) : 1700 });
    }
    if (m === "GET" && path === "me") {
      if (!ses) return fail(401, "Tiada sesi.");
      if (ses.role === "ad") return json({ role: "ad", username: ses.subject });
      const row = await loadCo(env, ses.subject);
      if (!row || row.account !== "aktif") return fail(401, "Akaun tidak aktif.");
      return json({ role: "co", company: coOut(row) });
    }
    if (m === "POST" && path === "logout") {
      const t = cookieToken(req); if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(t)).run();
      return json({ ok: true }, 200, { "set-cookie": clearCookie });
    }
    if (m === "POST" && path === "login") {
      const id = str(body.id, 20).toUpperCase(), lk = "lf:" + id;
      await limit(env, "lip:" + ip(req), 60, 3600);
      if (await blocked(env, lk, 5)) return fail(429, "Terlalu banyak cubaan gagal. Cuba lagi selepas 15 minit.");
      const row = await loadCo(env, id);
      if (!row || !(await verifyPw(String(body.pw || ""), row.pw_salt, row.pw_hash))) { await hit(env, lk, 900); return fail(401, "ID atau kata laluan tidak sah."); }
      await env.DB.prepare("DELETE FROM limits WHERE k=?").bind(lk).run();
      if (row.account === "menunggu") return fail(403, "Akaun anda sedang menunggu kelulusan MPC.");
      if (row.account === "digantung") return fail(403, "Akaun anda telah digantung. Sila hubungi MPC.");
      return json({ company: coOut(row) }, 200, { "set-cookie": await newSession(env, "co", row.id) });
    }
    if (m === "POST" && path === "register") {
      await limit(env, "reg:" + ip(req), 5, 3600);
      const doc = {}; readProfile(body.profile || {}, doc);
      const cat = body.profile?.category;
      if (!doc.name || !doc.sector || !doc.officer || !CATS.includes(cat)) bad("Sila lengkapkan medan wajib.");
      const p = pwProblem(body.pw); if (p) bad(p);
      let id; for (let i = 0; i < 10 && !id; i++) { const c = genId(); if (!(await loadCo(env, c))) id = c; }
      const h = await hashPw(body.pw);
      Object.assign(doc, { years: [], data: {}, src: {}, phys: {}, physCustom: [{}, {}, {}], createdBy: "Pendaftaran sendiri" }); addHist(doc, "Akaun didaftarkan", "Pendaftaran sendiri");
      await env.DB.prepare("INSERT INTO companies (id, name, category, sector, account, status, doc, pw_salt, pw_hash, must_change, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,0,?,?)")
        .bind(id, doc.name, cat, doc.sector, "menunggu", "draf", JSON.stringify(doc), h.salt, h.hash, iso(), iso()).run();
      return json({ id });
    }
    if (m === "GET" && path === "admin/status") { const a = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first(); return json({ setup: a.n > 0 }); }
    if (m === "POST" && path === "admin/setup") {
      await limit(env, "setup:" + ip(req), 10, 3600);
      const a = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first();
      if (a.n > 0) return fail(409, "Master Admin sudah disediakan.");
      if (!env.ADMIN_SETUP_KEY) return fail(503, "ADMIN_SETUP_KEY belum ditetapkan di Cloudflare.");
      if (!sameStr(String(body.key || ""), env.ADMIN_SETUP_KEY)) return fail(403, "Kunci persediaan tidak sah.");
      const u = str(body.u, 50); if (!u) bad("ID admin diperlukan.");
      const p = pwProblem(body.pw); if (p) bad(p);
      const h = await hashPw(body.pw);
      await env.DB.prepare("INSERT INTO admins (username, pw_salt, pw_hash, created_at) VALUES (?,?,?,?)").bind(u, h.salt, h.hash, iso()).run();
      return json({ username: u }, 200, { "set-cookie": await newSession(env, "ad", u) });
    }
    if (m === "POST" && path === "admin/login") {
      const u = str(body.u, 50), lk = "laf:" + u;
      await limit(env, "lip:" + ip(req), 60, 3600);
      if (await blocked(env, lk, 5)) return fail(429, "Terlalu banyak cubaan gagal. Cuba lagi selepas 15 minit.");
      const a = await env.DB.prepare("SELECT * FROM admins WHERE username=?").bind(u).first();
      if (!a || !(await verifyPw(String(body.pw || ""), a.pw_salt, a.pw_hash))) { await hit(env, lk, 900); return fail(401, "ID atau kata laluan tidak sah."); }
      await env.DB.prepare("DELETE FROM limits WHERE k=?").bind(lk).run();
      return json({ username: u }, 200, { "set-cookie": await newSession(env, "ad", u) });
    }

    /* AI: syarikat atau admin */
    if (m === "POST" && path === "ai") {
      if (!ses) return fail(401, "Sesi tamat. Sila log masuk semula.");
      if (!env.ANTHROPIC_API_KEY) return fail(503, "Pengekstrakan automatik belum diaktifkan oleh MPC.");
      const day = new Date().toISOString().slice(0, 10), lim = Number(env.AI_DAILY_LIMIT || 40);
      await limit(env, `ai:${ses.role}:${ses.subject}:${day}`, lim, 86400);
      const prompt = String(body.prompt || ""); if (!prompt || prompt.length > 400000) bad("Permintaan tidak sah.");
      return json(await callClaude(env, prompt, Array.isArray(body.images) ? body.images : []));
    }

    /* syarikat */
    if (path === "company" && m === "PUT") {
      const id = needCo(), row = await loadCo(env, id); if (!row) return fail(404, "Syarikat tidak dijumpai.");
      const doc = JSON.parse(row.doc); const cols = {};
      const hasData = "years" in body || "data" in body;
      if (hasData) {
        if (LOCKED.includes(row.status)) return fail(409, "Data dikunci kerana telah dihantar.");
        Object.assign(doc, cleanData(body)); addHist(doc, "Data dikemas kini", "Syarikat");
      }
      if (PROFILE_KEYS.some(k => k in body) || "category" in body) {
        readProfile(body, doc);
        if (!doc.name || !doc.sector || !doc.officer) bad("Sila lengkapkan medan wajib.");
        cols.name = doc.name; cols.sector = doc.sector;
        if ("category" in body && body.category !== row.category) {
          if (LOCKED.includes(row.status)) return fail(409, "Jenis templat tidak boleh diubah selepas dihantar.");
          if (!CATS.includes(body.category)) bad("Jenis templat tidak sah.");
          cols.category = body.category;
        }
        if (!hasData) addHist(doc, "Profil dikemas kini", "Syarikat");
      }
      return json({ company: coOut(await saveCo(env, row, doc, cols)) });
    }
    if (m === "POST" && path === "company/submit") {
      const id = needCo(), row = await loadCo(env, id), co = coOut(row);
      if (LOCKED.includes(row.status)) return fail(409, "Data telah dihantar.");
      const rows = computeAll(co), ss = summaryStatus(rows);
      if (!rows.length) bad("Tiada data untuk dihantar.");
      if (ss.s !== "LULUS") bad("Semua tahun mesti LULUS semakan sebelum dihantar.");
      if (exCount(co)) bad("Masih ada nilai diekstrak yang belum disemak.");
      if (!co.officer || !(co.email || co.tel)) bad("Lengkapkan profil (pegawai dan e-mel/telefon).");
      const doc = JSON.parse(row.doc); doc.submittedAt = iso(); doc.declaration = { by: str(body.by, 100) || co.officer, at: iso() };
      addHist(doc, "Dihantar kepada MPC", "Syarikat");
      return json({ company: coOut(await saveCo(env, row, doc, { status: "dihantar" })) });
    }
    if (m === "POST" && path === "company/withdraw") {
      const id = needCo(), row = await loadCo(env, id);
      if (row.status !== "dihantar") return fail(409, "Hanya penghantaran yang belum disahkan boleh ditarik balik.");
      const doc = JSON.parse(row.doc); addHist(doc, "Penghantaran ditarik balik", "Syarikat");
      return json({ company: coOut(await saveCo(env, row, doc, { status: "draf" })) });
    }
    if (m === "POST" && path === "company/password") {
      const id = needCo(), row = await loadCo(env, id);
      if (!row.must_change && !(await verifyPw(String(body.cur || ""), row.pw_salt, row.pw_hash))) return fail(403, "Kata laluan semasa tidak betul.");
      const p = pwProblem(body.pw); if (p) bad(p);
      const h = await hashPw(body.pw); const doc = JSON.parse(row.doc); addHist(doc, "Kata laluan ditukar", "Syarikat");
      return json({ company: coOut(await saveCo(env, row, doc, { pw_salt: h.salt, pw_hash: h.hash, must_change: 0 })) });
    }
    if (m === "POST" && path === "company/analysis") {
      const id = needCo(), row = await loadCo(env, id), doc = JSON.parse(row.doc);
      doc.analysis = { text: str(body.text, 60000), at: iso(), by: str(body.by, 100), basis: str(body.basis, 40) };
      return json({ company: coOut(await saveCo(env, row, doc)) });
    }
    if (m === "GET" && path === "bench") {
      const id = needCo(), me = await loadCo(env, id);
      const { results } = await env.DB.prepare("SELECT * FROM companies WHERE sector=? AND id<>? AND status IN ('dihantar','disahkan')").bind(me.sector, id).all();
      const byY = {};
      for (const r of results) for (const x of computeAll(coOut(r))) if (x.chk.status === "LULUS" && typeof x.ind.lp === "number") (byY[x.year] = byY[x.year] || []).push(x.ind.lp);
      const out = {}; for (const [y, a] of Object.entries(byY)) if (a.length >= 3) { a.sort((p, q) => p - q); const k = a.length >> 1; out[y] = { lp: a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2, n: a.length }; }
      return json({ bench: out });
    }

    /* admin */
    if (path.startsWith("admin/")) {
      const u = needAd(), by = `Master Admin (${u})`;
      if (m === "GET" && path === "admin/companies") {
        const { results } = await env.DB.prepare("SELECT * FROM companies ORDER BY updated_at DESC").all();
        return json({ companies: results.map(coOut) });
      }
      if (m === "POST" && path === "admin/companies") {
        const p = body.profile || {}, doc = {}; readProfile(p, doc);
        if (!doc.name || !doc.sector || !doc.officer || !CATS.includes(p.category)) bad("Sila lengkapkan medan wajib.");
        let id; for (let i = 0; i < 10 && !id; i++) { const c = genId(); if (!(await loadCo(env, c))) id = c; }
        const pw = genPw(), h = await hashPw(pw);
        Object.assign(doc, { years: [], data: {}, src: {}, phys: {}, physCustom: [{}, {}, {}], createdBy: by }); addHist(doc, "Akaun dicipta", by);
        await env.DB.prepare("INSERT INTO companies (id, name, category, sector, account, status, doc, pw_salt, pw_hash, must_change, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)")
          .bind(id, doc.name, p.category, doc.sector, "aktif", "draf", JSON.stringify(doc), h.salt, h.hash, iso(), iso()).run();
        return json({ id, pw });
      }
      let mm;
      if ((mm = path.match(/^admin\/companies\/(MPC-[A-Z0-9]{6})(\/reset-password)?$/))) {
        const row = await loadCo(env, mm[1]); if (!row) return fail(404, "Syarikat tidak dijumpai.");
        const doc = JSON.parse(row.doc), cols = {};
        if (mm[2] && m === "POST") {
          const pw = genPw(), h = await hashPw(pw); addHist(doc, "Kata laluan diset semula", by);
          await saveCo(env, row, doc, { pw_salt: h.salt, pw_hash: h.hash, must_change: 1 });
          await env.DB.prepare("DELETE FROM sessions WHERE role='co' AND subject=?").bind(row.id).run();
          return json({ pw });
        }
        if (m === "PATCH") {
          const acts = [];
          if ("account" in body) { if (!["aktif", "digantung", "menunggu"].includes(body.account)) bad("Status akaun tidak sah."); cols.account = body.account; acts.push(body.account === "aktif" ? "Akaun diluluskan/diaktifkan" : "Akaun " + body.account); if (body.account !== "aktif") await env.DB.prepare("DELETE FROM sessions WHERE role='co' AND subject=?").bind(row.id).run(); }
          if ("status" in body) {
            if (body.status === "disahkan" && row.status !== "dihantar") return fail(409, "Hanya data yang dihantar boleh disahkan.");
            if (body.status === "dikembalikan" && !LOCKED.includes(row.status)) return fail(409, "Status tidak sesuai.");
            if (!["disahkan", "dikembalikan"].includes(body.status)) bad("Status tidak sah.");
            if (body.status === "dikembalikan" && !str(body.review?.comment)) bad("Sila tulis ulasan untuk syarikat.");
            cols.status = body.status; doc.review = { comment: str(body.review?.comment, 3000), at: iso(), by: u };
            acts.push(body.status === "disahkan" ? "Data disahkan" : "Dikembalikan untuk pembetulan");
          }
          if ("analysis" in body) { doc.analysis = { text: str(body.analysis?.text, 60000), at: iso(), by: str(body.analysis?.by, 100), basis: str(body.analysis?.basis, 40) }; acts.push("Ulasan analisis dijana"); }
          if (!acts.length) bad("Tiada perubahan.");
          acts.forEach(a => addHist(doc, a, by));
          return json({ company: coOut(await saveCo(env, row, doc, cols)) });
        }
      }
      if (m === "PUT" && path === "admin/config") {
        const w = Number(body.minWageMonthly); if (!(w > 0 && w < 100000)) bad("Nilai tidak sah.");
        await env.DB.prepare("INSERT OR REPLACE INTO config (k, v) VALUES ('minWageMonthly', ?)").bind(String(w)).run();
        return json({ minWage: w });
      }
      if (m === "POST" && path === "admin/password") {
        const a = await env.DB.prepare("SELECT * FROM admins WHERE username=?").bind(u).first();
        if (!(await verifyPw(String(body.cur || ""), a.pw_salt, a.pw_hash))) return fail(403, "Kata laluan semasa tidak betul.");
        const p = pwProblem(body.pw); if (p) bad(p);
        const h = await hashPw(body.pw);
        await env.DB.prepare("UPDATE admins SET pw_salt=?, pw_hash=? WHERE username=?").bind(h.salt, h.hash, u).run();
        return json({ ok: true });
      }
    }
    return fail(404, "Laluan tidak dijumpai.");
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, "Ralat pelayan.");
  }
}
