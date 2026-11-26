/* 只在发布版加载；file:// 和不支持 Service Worker 的环境继续照常打开。 */
if (window.isSecureContext && /^https?:$/.test(location.protocol) && "serviceWorker" in navigator) {
  const worker = new URL("sw.js", document.currentScript.src);
  navigator.serviceWorker.register(worker, { updateViaCache: "none" }).catch((error) => {
    console.warn("离线缓存未启用：", error);
  });
}
