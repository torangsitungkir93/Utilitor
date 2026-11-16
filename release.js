// Naik versi otomatis lalu deploy. Pakai: node release.js [patch|minor|major]
const fs = require("fs"), { execSync } = require("child_process");
const kind = process.argv[2] || "patch";
const v = JSON.parse(fs.readFileSync("version.json", "utf8"));
if (v.released) {
  let [a, b, c] = v.version.split(".").map(Number);
  if (kind === "major") { a++; b = 0; c = 0; } else if (kind === "minor") { b++; c = 0; } else { c++; }
  v.version = `${a}.${b}.${c}`;
}
v.released = true; v.date = new Date().toISOString();
fs.writeFileSync("version.json", JSON.stringify(v, null, 2));
console.log("Deploy v" + v.version);
execSync("firebase deploy", { stdio: "inherit" });
