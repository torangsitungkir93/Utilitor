/* Service worker Utilitor: aplikasi & aset OCR tetap tersedia tanpa internet.
   - vendor/ (mesin & model OCR): cache dulu (tidak diunduh ulang)
   - halaman & berkas aplikasi: jaringan dulu (update langsung terlihat), cadangan dari cache saat offline
   - Firebase SDK & font: cache dulu */
const SHELL = "utilitor-shell-v1", VENDOR = "utilitor-vendor-v1", EXT = "utilitor-ext-v1", KEEP = [SHELL, VENDOR, EXT];
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
const isExt = u => (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
async function cacheFirst(req, name){
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") c.put(req, res.clone());
  return res;
}
async function networkFirst(req, name){
  const c = await caches.open(name);
  try {
    const res = await Promise.race([fetch(req, { cache: "no-cache" }), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 4000))]);   // no-cache: hosting statis (mis. GitHub Pages) menahan cache 10 menit
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await c.match(req)) || (req.mode === "navigate" ? (await c.match("./")) || (await c.match("index.html")) : null);
    if (hit) return hit;
    throw err;
  }
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith("/__/")) return;                         // jalur khusus Firebase Hosting (login): jangan disentuh
    e.respondWith(u.pathname.includes("/vendor/") && !u.pathname.endsWith("/manifest.json") ? cacheFirst(req, VENDOR) : networkFirst(req, SHELL));   // manifest.json selalu dicek ke jaringan
  } else if (isExt(u)) e.respondWith(cacheFirst(req, EXT));
});
