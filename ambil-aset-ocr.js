// Jalankan SEKALI di komputermu (butuh Node 18+ dan internet):
//    node ambil-aset-ocr.js          -> model bahasa "best" (lebih akurat, lebih besar)
//    node ambil-aset-ocr.js --fast   -> model "fast" (jauh lebih kecil, sedikit kurang akurat)
// Hasilnya masuk ke folder vendor/. Setelah itu deploy seperti biasa (node release.js).
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const FAST = process.argv.includes("--fast");
const STRICT = !process.env.OCR_TEST;                       // pemeriksaan ukuran file (dimatikan hanya saat pengujian)
const TESS = "5.1.1";                                        // harus sama dengan versi yang dipakai index.html
const NPM = process.env.OCR_NPM || "https://cdn.jsdelivr.net/npm";
const LANG = process.env.OCR_LANG || "https://tessdata.projectnaptha.com/4.0.0" + (FAST ? "_fast" : "_best");
const FINAL = path.join(__dirname, "vendor"), OUT = FINAL + ".tmp";   // unduh ke folder sementara; vendor/ lama aman bila gagal

const mb = n => (n / 1048576).toFixed(1) + " MB";
async function get(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} untuk ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
const files = [];
async function save(rel, url, { optional = false, min = 0, text = null, gz = false } = {}){
  try {
    const b = await get(url);
    if (STRICT && b.length < min) throw new Error(`ukuran ${b.length} B terlalu kecil (diharapkan >= ${min})`);
    if (STRICT && gz && !(b[0] === 0x1f && b[1] === 0x8b)) throw new Error("bukan file .gz yang valid");
    if (STRICT && text && !b.toString("utf8").includes(text)) throw new Error(`isi tidak seperti yang diharapkan (tidak ada "${text}")`);
    const dest = path.join(OUT, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, b);
    files.push({ path: "vendor/" + rel.split(path.sep).join("/"), size: b.length, sha256: crypto.createHash("sha256").update(b).digest("hex") });
    console.log("  ok  ", rel.padEnd(52), mb(b.length));
  } catch (e) {
    if (optional) return console.log("  lewat", rel, "(tidak ada)");
    throw new Error(`${rel}: ${e.message}`);
  }
}
(async () => {
  console.log(`Mengambil aset OCR ke ${FINAL}  (model bahasa: ${FAST ? "fast" : "best"})\n`);
  fs.rmSync(OUT, { recursive: true, force: true });
  await save("tesseract/tesseract.min.js", `${NPM}/tesseract.js@${TESS}/dist/tesseract.min.js`, { min: 20000, text: "createWorker" });
  await save("tesseract/worker.min.js",    `${NPM}/tesseract.js@${TESS}/dist/worker.min.js`,    { min: 5000 });
  const pkg = JSON.parse((await get(`${NPM}/tesseract.js@${TESS}/package.json`)).toString());
  const core = String(pkg.dependencies["tesseract.js-core"]).replace(/^[\^~v]/, "");
  console.log(`  (tesseract.js-core ${core})`);
  for (const n of ["tesseract-core-simd-lstm", "tesseract-core-lstm"]) {
    await save(`tesseract/core/${n}.wasm.js`, `${NPM}/tesseract.js-core@${core}/${n}.wasm.js`, { min: 500000 });
    await save(`tesseract/core/${n}.wasm`,    `${NPM}/tesseract.js-core@${core}/${n}.wasm`,    { optional: true });
  }
  for (const l of ["ind", "eng"]) await save(`lang/${l}.traineddata.gz`, `${LANG}/${l}.traineddata.gz`, { min: 500000, gz: true });
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ built: new Date().toISOString(), tesseract: TESS, core, langs: FAST ? "fast" : "best", files }, null, 1));
  fs.rmSync(FINAL, { recursive: true, force: true }); fs.renameSync(OUT, FINAL);
  const total = files.reduce((s, f) => s + f.size, 0);
  console.log(`\nSelesai: ${files.length} file, ${mb(total)} di folder vendor/.\nLangkah berikut: node release.js   (deploy)`);
})().catch(e => { console.error("\nGAGAL:", e.message, "\nPeriksa koneksi internet lalu jalankan lagi. Folder vendor/ yang lama (kalau ada) tidak diubah."); process.exit(1); });
