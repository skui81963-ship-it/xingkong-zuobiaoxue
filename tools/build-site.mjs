// 生成可离线的静态发布目录；源码仍可直接用浏览器打开。
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "dist");
const marker = join(out, ".offline-build");
const files = new Map();
const aliases = new Map();

const read = (path) => readFile(join(root, path));
const list = async (dir, pattern) => (await readdir(join(root, dir), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && pattern.test(entry.name))
  .map(({ name }) => dir ? `${dir}/${name}` : name)
  .sort();

function fingerprint(entries) {
  const hash = createHash("sha256");
  for (const [path, data] of entries) {
    hash.update(`${path}\0${Buffer.byteLength(data)}\0`).update(data);
  }
  return hash.digest("hex").slice(0, 16);
}

async function addAsset(path, outputName = path) {
  const data = await read(path);
  const ext = extname(outputName);
  const output = `${outputName.slice(0, -ext.length)}.${fingerprint([[path, data]])}${ext}`;
  files.set(output, data);
  aliases.set(outputName, output);
}

for (const path of [
  ...await list("", /\.(css|js|svg)$/),
  ...await list("mascot", /\.(css|js)$/),
  ...await list("mascot/quizzes", /\.js$/),
]) await addAsset(path);
await addAsset("tools/offline-register.js", "offline-register.js");

const sprites = await Promise.all((await list("mascot/img", /\.webp$/)).map(async (path) => [path, await read(path)]));
const spriteDir = `img.${fingerprint(sprites)}`;
for (const [path, data] of sprites) files.set(path.replace("mascot/img/", `mascot/${spriteDir}/`), data);

const assets = [...files.keys()].sort();
const pages = await list("", /\.html$/);
for (const path of pages) {
  const html = (await read(path)).toString();
  files.set(path, html
    .replace(/(<(?:link|script)\b[^>]*?\b(?:href|src)=")([^"\n]+)(")/g, (attribute, start, url, quote) => {
      const asset = aliases.get(url);
      if (!asset) return attribute;
      const spriteData = url === "mascot/mascot.js" ? ` data-sk-sprite-dir="${spriteDir}/"` : "";
      return `${start}${asset}${quote}${spriteData}`;
    })
    .replace(/^(\s*)<\/head>/m, `    <script src="${aliases.get("offline-register.js")}" defer></script>\n  </head>`));
}

const worker = await read("tools/offline-worker.js");
const version = fingerprint([...files, ["worker", worker]]);
files.set("sw.js", `const release = ${JSON.stringify({ version, pages, assets })};\n${worker}`);
files.set(".nojekyll", "");

await mkdir(out, { recursive: true });
const existing = await readdir(out);
if (existing.length) {
  const previousFiles = JSON.parse(await readFile(marker, "utf8").catch(() => "null"));
  if (!Array.isArray(previousFiles)) throw new Error("dist/ 不是本工具生成的目录，请先移走其中的文件。");
  for (const path of previousFiles) {
    if (typeof path === "string" && /^(?:[\w.-]+\/)*[\w.-]+$/.test(path) && !path.split("/").some((part) => part === "." || part === "..") && !files.has(path)) {
      await rm(join(out, path), { force: true });
    }
  }
}

for (const [path, data] of files) {
  const destination = join(out, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data);
}
await writeFile(marker, JSON.stringify([...files.keys()]));
console.log(`dist/  ·  ${pages.length} 页  ·  ${assets.length} 个指纹资源  ·  ${version}`);
