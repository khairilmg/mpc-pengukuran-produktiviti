// Ujian hujung-ke-hujung terhadap `wrangler pages dev` (http://127.0.0.1:8788)
const { chromium } = require("playwright"); const path = require("path");
const BASE = process.env.BASE || "http://127.0.0.1:8788";
const NM = process.env.NM || path.join(__dirname, "node_modules");
const MAP = { "xlsx.full.min.js": NM + "/xlsx/dist/xlsx.full.min.js", "pdf.min.js": NM + "/pdfjs-dist/build/pdf.min.js", "pdf.worker.min.js": NM + "/pdfjs-dist/build/pdf.worker.min.js" };
const KEY = process.env.SETUP_KEY || "uji-kunci-setempat";
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async () => { const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
    await ctx.route("https://cdnjs.cloudflare.com/**", r => { const f = Object.keys(MAP).find(k => r.request().url().endsWith("/" + k)); r.fulfill({ path: MAP[f], contentType: "application/javascript" }); });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); return p; };
  const p = await mk();
  // pura-pura AI aktif + jawapan AI olok-olok
  await p.route("**/api/status", async r => { const res = await r.fetch(); const j = await res.json(); j.ai = true; r.fulfill({ json: j }); });
  await p.route("**/api/ai", r => { const body = r.request().postDataJSON(); const isExtract = body.prompt.includes("Balas dengan JSON SAHAJA");
    r.fulfill({ json: isExtract ? { text: JSON.stringify({ unit_note: "RM penuh", years: [{ year: 2022, values: { sales: 900000, cos_pur: 450000, lab_wages: 200000, reported_pbt: 250000, emp_close: 30 }, notes: { sales: "Hasil" } }], warnings: [] }), truncated: false } : { text: "## Ringkasan Eksekutif\nUjian.", truncated: false } }); });
  await p.goto(BASE); await p.waitForSelector("#f-login");
  // admin setup (kunci salah dulu)
  await p.click("[data-act=login-tab][data-k=ad]"); await p.waitForSelector("#f-setup");
  await p.fill("#f-setup [name=key]", "salah"); await p.fill("#f-setup [name=pw]", "Admin1234"); await p.fill("#f-setup [name=pw2]", "Admin1234");
  await p.click("#f-setup [type=submit]"); await p.waitForSelector("#login-msg .msg.bad"); console.log("setup wrong key:", await p.textContent("#login-msg"));
  await p.fill("#f-setup [name=key]", KEY); await p.click("#f-setup [type=submit]"); await p.waitForSelector(".tiles");
  await p.click("[data-act=tab][data-k=create]");
  await p.fill("#f-create [name=name]", "Syarikat Ujian CF"); await p.selectOption("#f-create [name=sector]", "Pembuatan");
  await p.fill("#f-create [name=officer]", "Ali"); await p.fill("#f-create [name=email]", "ali@ujian.my");
  await p.click("#f-create [type=submit]"); await p.waitForSelector(".cred");
  const cred = await p.textContent(".cred"); const id = cred.match(/ID: (MPC-\w{6})/)[1], pw = cred.match(/sementara: (\S+)/)[1];
  console.log("created", id);
  await p.click("[data-act=close-modal]"); await p.click("[data-act=logout]"); await p.waitForSelector("[data-act=login-tab]");
  await p.click("[data-act=login-tab][data-k=co]");
  await p.fill("#f-login [name=id]", id); await p.fill("#f-login [name=pw]", "salah123"); await p.click("#f-login [type=submit]");
  await p.waitForSelector("#login-msg .msg.bad"); console.log("wrong pw:", await p.textContent("#login-msg"));
  await p.fill("#f-login [name=pw]", pw); await p.click("#f-login [type=submit]");
  await p.waitForSelector("#f-forcepw"); await p.fill("#f-forcepw [name=pw]", "Syarikat123"); await p.fill("#f-forcepw [name=pw2]", "Syarikat123"); await p.click("#f-forcepw [type=submit]");
  await p.waitForSelector("#new-year");
  // pengasingan: syarikat tidak boleh baca senarai admin
  console.log("isolation:", await p.evaluate(async () => (await fetch("/api/admin/companies")).status));
  for (const y of ["2023", "2024"]) { await p.fill("#new-year", y); await p.click("[data-act=add-year]"); }
  const V = { sales: 1e6, cos_mfg: 455000, cos_pur: 100000, lab_wages: 100000, dep: 20000, interest: 10000, itax: 3000, expenses_av: 2000, util: 8000, other_exp: 40000, m_material: 300000, m_subcon: 20000, m_labour: 80000, m_dep: 30000, m_itax: 5000, m_overhead: 10000, m_util: 15000, m_other: 10000, fg_open: 50000, fg_close: 60000, wip_open: 20000, wip_close: 25000, own_con: 5000, trade_income: 30000, svc_income: 12000, reported_pbt: 309000, fa_open: 500000, fa_close: 600000, emp_open: 40, emp_close: 44 };
  for (const y of [2023, 2024]) for (const [k, v] of Object.entries(V)) await p.fill(`input[data-y="${y}"][data-k="${k}"]`, String(y === 2024 && k === "cos_mfg" ? 450000 : v));
  await p.click("[data-act=save]"); await p.waitForSelector("#data-msg .msg.good");
  console.log("status:", (await p.$$eval("#sum tr:last-child td", t => t.map(x => x.innerText))).join(" | "));
  // hantar sepatutnya ditolak oleh pelayan (2024 SEMAK)
  console.log("server submit w/ SEMAK:", await p.evaluate(async () => { const r = await fetch("/api/company/submit", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); return r.status + " " + (await r.json()).error; }));
  await p.fill(`input[data-y="2024"][data-k="cos_mfg"]`, "455000");
  await p.click("[data-act=tab][data-k=fizikal]"); await p.fill('input[data-py="2023"][data-pk="reject"]', "4"); await p.fill('input[data-py="2024"][data-pk="reject"]', "3");
  await p.click("[data-act=save]"); await p.waitForSelector("#data-msg .msg.good");
  // ekstrak
  await p.click("[data-act=tab][data-k=upload]"); await p.setInputFiles("#file-in", [path.join(__dirname, "stmt.xlsx")]);
  await p.click("[data-act=extract]"); await p.waitForSelector("[data-act=apply-extract]"); await p.click("[data-act=apply-extract]");
  await p.waitForSelector("td.ex input"); await p.click("[data-act=rev-year][data-y='2022']");
  await p.click("[data-act=save]"); await p.waitForSelector("#data-msg .msg.good");
  console.log("years saved:", await p.evaluate(async () => (await (await fetch("/api/me")).json()).company.years));
  await p.click("[data-act=tab][data-k=analisis]"); await p.waitForSelector(".an-sec");
  await p.click("[data-act=gen-ai]"); await p.waitForSelector("#ai-msg .msg.good");
  await p.click("[data-act=tab][data-k=hantar]");
  await p.check("#f-submit [name=decl]"); await p.click("#f-submit [type=submit]"); await p.waitForSelector("[data-act=withdraw]");
  console.log("locked PUT:", await p.evaluate(async () => (await fetch("/api/company", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ years: [2023], data: {} }) })).status));
  await p.screenshot({ path: path.join(__dirname, "cf-hantar.png"), fullPage: true });
  await p.click("[data-act=logout]"); await p.waitForSelector("[data-act=login-tab]");
  // admin semak & sahkan
  await p.click("[data-act=login-tab][data-k=ad]"); await p.waitForSelector("#f-alogin");
  await p.fill("#f-alogin [name=u]", "admin"); await p.fill("#f-alogin [name=pw]", "Admin1234"); await p.click("#f-alogin [type=submit]");
  await p.waitForSelector(".tiles"); await p.waitForTimeout(500);
  await p.click("[data-act=tab][data-k=list]"); await p.click(`tr[data-id="${id}"]`); await p.waitForSelector("[data-act=rv-ok]");
  await p.click("[data-act=rv-ok]"); await p.waitForTimeout(800);
  console.log("final:", await p.evaluate(async id => (await (await fetch("/api/admin/companies")).json()).companies.find(c => c.companyId === id).status, id));
  await p.screenshot({ path: path.join(__dirname, "cf-admin.png"), fullPage: true });
  // daftar sendiri
  await p.click("[data-act=logout]"); await p.waitForSelector("[data-act=login-tab]"); await p.click("[data-act=login-tab][data-k=co]");
  await p.click("[data-act=register]"); await p.fill("#f-reg [name=name]", "Kedai Baru"); await p.selectOption("#f-reg [name=sector]", "Lain-lain"); await p.selectOption("#f-reg [name=category]", "MI");
  await p.fill("#f-reg [name=officer]", "Abu"); await p.fill("#f-reg [name=pw]", "Kedai1234"); await p.fill("#f-reg [name=pw2]", "Kedai1234"); await p.click("#f-reg [type=submit]");
  await p.waitForSelector(".cred"); console.log("registered:", await p.textContent(".cred"));
  console.log("ERRORS:", errs);
  await b.close();
})();
