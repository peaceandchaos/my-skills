import fs from "node:fs";
import path from "node:path";

const root = "out";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

for (const file of walk(root)) {
  if (!/\.(html|css)$/.test(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const after = before
    .replaceAll('href="/_next/', 'href="./_next/')
    .replaceAll('src="/_next/', 'src="./_next/')
    .replaceAll('href="/favicon', 'href="./favicon')
    .replaceAll("url(/_next/", "url(./_next/")
    .replaceAll('url("/_next/', 'url("./_next/');
  if (after !== before) fs.writeFileSync(file, after);
}

fs.writeFileSync(path.join(root, ".nojekyll"), "");
