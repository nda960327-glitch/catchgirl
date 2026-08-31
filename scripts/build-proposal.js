// proposal/template.html 의 {{img:name}} 을 base64 data URI 로 치환 → proposal/catchgirl-proposal.html
const fs = require("fs"); const path = require("path");
const root = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(root, "proposal/template.html"), "utf8");
html = html.replace(/\{\{img:([\w-]+)\}\}/g, (_, name) => {
  const cands = [`proposal/shots/${name}.webp`, `public/assets/${name}.webp`];
  const f = cands.map((c) => path.join(root, c)).find((p) => fs.existsSync(p));
  if (!f) throw new Error("missing image " + name);
  return `data:image/webp;base64,${fs.readFileSync(f).toString("base64")}`;
});
const out = path.join(root, "proposal/catchgirl-proposal.html");
fs.writeFileSync(out, html);
console.log("built", out, Math.round(fs.statSync(out).size / 1024) + "KB");
