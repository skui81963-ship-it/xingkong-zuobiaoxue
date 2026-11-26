/* 首页的星星用真正的 ASCII 字符绘制，不依赖图片或外部字体。 */
(() => {
  const canvas = document.querySelector(".home-starfield");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const hero = canvas.closest(".home-hero");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const topTint = document.createElement("div");
  topTint.className = "home-edge-tint";
  topTint.hidden = true;
  topTint.setAttribute("aria-hidden", "true");
  document.body.append(topTint);
  let edgeColor = "";
  const fonts = ["12px", "14px", "18px"].map((size) => `${size} ui-monospace, monospace`);
  const colors = ["#91afe6", "#c0c9ff", "#f3d7a1"];
  let width = 0;
  let height = 0;
  let stars = [];
  let inView = true;
  let raf = 0;
  let lastFrame = null;
  let time = 0;

  function edgeTint() {
    topTint.hidden = !edgeColor || window.scrollY > 0;
  }

  function sampleSkyEdge() {
    // 只取两层固定渐变的第一行；不让移动的星点决定系统栏颜色。
    const styles = getComputedStyle(hero);
    const token = (key) => styles.getPropertyValue(`--home-${key}`).trim();
    const percent = (key) => parseFloat(token(key)) / 100;
    const parseColor = (value) => /^#[\da-f]{6}$/i.test(value)
      ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
      : value.startsWith("rgb(") ? value.match(/\d+\.?\d*/g).slice(0, 3).map(Number) : [];
    const night = parseColor(getComputedStyle(hero).backgroundColor);
    const page = parseColor(getComputedStyle(document.documentElement).backgroundColor);
    const blue = parseColor(token("band-blue"));
    const purple = parseColor(token("band-purple"));
    if ([night, page, blue, purple].some((color) => color.length !== 3)) return "";

    const angle = parseFloat(token("band-angle")) * Math.PI / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const span = Math.abs(dx * width) + Math.abs(dy * height);
    const [start, fullBlue, fullPurple, end] = ["band-start", "band-blue-at", "band-purple-at", "band-end"].map(percent);
    const [shadeY, shadeSolid, shadeEnd] = ["shade-y", "shade-solid", "shade-end"].map(percent);
    const y = 0.5 / height;
    const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * Math.max(0, Math.min(1, t)));
    const distance = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
    const samples = Array.from({ length: 32 }, (_, i) => {
      const x = (i + 0.5) / 32;
      const line = 0.5 + (dx * (x - 0.5) * width + dy * (y - 0.5) * height) / span;
      const band = line < fullBlue ? mix(night, blue, (line - start) / (fullBlue - start))
        : line < fullPurple ? mix(blue, purple, (line - fullBlue) / (fullPurple - fullBlue))
        : mix(purple, night, (line - fullPurple) / (end - fullPurple));
      const ellipse = Math.hypot((x - 0.5) / 0.5, (y - shadeY) / Math.max(shadeY, 1 - shadeY)) / Math.SQRT2;
      return mix(night, band, (ellipse - shadeSolid) / (shadeEnd - shadeSolid));
    });
    const average = night.map((_, i) => samples.reduce((total, color) => total + color[i], 0) / samples.length);
    if (average.some((value) => !Number.isFinite(value)) || distance(average, page) <= 9 ||
        samples.some((color) => distance(color, average) > 10)) return "";
    return `rgb(${average.map(Math.round).join(", ")})`;
  }

  function populate() {
    // 固定随机种子，同一视口大小总是生成同样的一片星空。
    let seed = 0x5301;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const stepX = Math.max(9, width / 175);
    const stepY = Math.max(13, height / 95);
    const layers = [[], [], []];

    for (let y = stepY / 2; y < height; y += stepY) {
      for (let x = stepX / 2; x < width; x += stepX) {
        const u = x / width;
        const v = y / height;
        const distance = v - (0.88 - u * 0.75 + Math.sin(u * 8) * 0.045);
        const band = Math.exp(-((distance / 0.12) ** 2));
        if (random() > 0.052 + band * 0.29) continue;

        const pick = random();
        const layer = pick < 0.74 ? 0 : pick < 0.96 ? 1 : 2;
        const glyphs = ["...:'", "+:xo", "*+*"][layer];
        layers[layer].push({
          x: x + (random() - 0.5) * stepX * 0.8,
          y: y + (random() - 0.5) * stepY * 0.74,
          glyph: glyphs[Math.floor(random() * glyphs.length)],
          phase: random() * Math.PI * 2,
          frequency: 0.7 + random() * 1.05,
          alpha: 0.21 + random() * 0.39 + layer * 0.135,
        });
      }
    }
    return layers;
  }

  function centerShade(x, y) {
    // 居中的课程标题和按钮前留一片较暗的天空。
    const dx = (x / width - 0.5) / 0.39;
    const dy = (y / height - 0.5) / 0.28;
    return 1 - 0.76 * Math.max(0, 1 - dx * dx - dy * dy);
  }

  function draw(t, meteor) {
    ctx.clearRect(0, 0, width, height);
    const wrap = width + 24;
    stars.forEach((layer, depth) => {
      ctx.font = fonts[depth];
      ctx.fillStyle = colors[depth];
      const drift = t * (1.3 + depth * 2.1);
      for (const star of layer) {
        const x = (star.x + 12 + drift) % wrap - 12;
        const y = star.y + 3 * Math.sin(t * 0.18 + star.phase);
        const twinkle = 0.78 + 0.22 * Math.sin(t * star.frequency + star.phase);
        ctx.globalAlpha = star.alpha * twinkle * centerShade(x, y);
        ctx.fillText(star.glyph, x, y);
      }
    });

    // 短促的流星从主文案上方划过，尾迹仍由字符组成。
    const progress = (t % 13 - 1.8) / 1.65;
    if (meteor && progress > 0 && progress < 1) {
      ctx.font = fonts[1];
      ctx.fillStyle = colors[2];
      const x = width * 0.69 + Math.min(width * 0.36, 410) * progress;
      const y = height * (0.08 + progress * 0.16);
      for (let i = 7; i >= 0; i--) {
        ctx.globalAlpha = Math.sin(progress * Math.PI) * (1 - i / 8);
        ctx.fillText(i === 0 ? "*" : i < 3 ? "-" : ".", x - i * 8, y - i * 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    stars = populate();
    draw(time, false);
    edgeColor = sampleSkyEdge();
    topTint.style.backgroundColor = edgeColor;
    edgeTint();
  }

  function tick(now) {
    if (lastFrame === null) lastFrame = now;
    const elapsed = now - lastFrame;
    if (elapsed >= 32) {
      time += Math.min(elapsed, 65) / 1000;
      lastFrame = now;
      draw(time, true);
    }
    raf = requestAnimationFrame(tick);
  }

  function sync() {
    if (!reduced.matches && inView && !document.hidden) {
      if (!raf) raf = requestAnimationFrame(tick);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = null;
    }
  }

  reduced.addEventListener("change", () => {
    if (reduced.matches) draw(time, false);
    sync();
  });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("scroll", edgeTint, { passive: true });
  window.addEventListener("pageshow", edgeTint);
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(hero);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(hero);
  }

  resize();
  sync();
})();
