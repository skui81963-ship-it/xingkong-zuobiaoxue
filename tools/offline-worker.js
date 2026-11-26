/* build-site.mjs 在发布时填入这一版的页面、指纹资源和版本号。 */
const scope = new URL(self.registration.scope);
const prefix = `sky-offline:${scope.pathname}:`;
const cacheName = prefix + release.version;
const urls = (paths) => paths.map((path) => new URL(path, scope).href);
const pages = new Set(urls(release.pages));
const assets = new Set(urls(release.assets));
const home = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) =>
    cache.addAll([...pages, ...assets].map((url) => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(prefix) && name !== cacheName).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cached(url) {
  try {
    return await (await caches.open(cacheName)).match(url);
  } catch {
    return undefined;
  }
}

async function navigate(request, key) {
  const controller = new AbortController();
  const network = fetch(request, { cache: "no-cache", signal: controller.signal }).catch(() => null);
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), 4000); });
  try {
    const response = await Promise.race([network, timeout]);
    if (response && response.status < 500) return response;
    // 离线副本和资源属于同一版本，不能用等待激活的新版本 HTML 覆盖它。
    const saved = await cached(key);
    if (saved) {
      controller.abort();
      return saved;
    }
    return response || await network || new Response("现在无法联网，也没有这一页的离线副本。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  // 只处理发布清单中的页面和资源；API、媒体请求及其他站点都不经过缓存。
  if (request.mode === "navigate") {
    url.search = ""; // 查询参数只供模拟器等页面的前端读取。
    const key = url.href === scope.href ? home : url.href;
    if (pages.has(key)) event.respondWith(navigate(request, key));
  } else if (assets.has(url.href) && ["script", "style", "image"].includes(request.destination)) {
    event.respondWith(cached(url.href).then((response) => response || fetch(request)));
  }
});
