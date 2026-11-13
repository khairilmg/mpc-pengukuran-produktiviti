<script>
"use strict";
/* ================= LAPISAN API (Cloudflare) ================= */
async function API(method, path, body, signal) {
  let r;
  try {
    r = await fetch("/api/" + path, { method, credentials: "same-origin", signal, headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (e?.name === "AbortError") throw { code: "cancelled", message: "Dihentikan." };
    throw { code: "network", message: "Pelayan tidak dapat dicapai. Semak sambungan internet." };
  }
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) {
    const code = { 401: "unauth", 403: "forbidden", 404: "notfound", 409: "conflict", 429: "rate_limited", 503: "unavailable" }[r.status] || "http";
    throw { code, status: r.status, message: d?.error || `Ralat pelayan (${r.status}).` };
  }
  return d;
}
const blobB64 = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(b); });
function parseJsonLoose(t) {
  try { return JSON.parse(t); } catch {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch {} }
  const a = t.search(/[[{]/), z = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (a >= 0 && z > a) { try { return JSON.parse(t.slice(a, z + 1)); } catch {} }
  throw { code: "invalid_json", message: "Jawapan tidak dapat dibaca.", text: t };
}
function makeSample() {
  const call = async (input, opts = {}) => {
    const images = [];
    for (const b of (opts.images ? Array.from(opts.images.length != null ? opts.images : [opts.images]) : [])) images.push({ media_type: b.type || "image/jpeg", data: await blobB64(b) });
    const prompt = typeof input === "string" ? input : input.map(x => x.content).join("\n\n");
    const d = await API("POST", "ai", { prompt, images }, opts.signal);
    opts.onText?.({ text: d.text, delta: d.text });
    return { text: d.text, truncated: !!d.truncated };
  };
  call.json = async (input, opts) => parseJsonLoose((await call(input, opts)).text);
  call.limits = async () => ({ maxPromptBytes: 400000, images: { maxCount: 10 } });
  return call;
}
const browserDownloads = {
  save: async ({ filename, data }) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return { status: "saved" };
  }
};
</script>
