/*
  mascot.js
  ---------
  深葵夜的引擎。页面只负责引用脚本，并调用 Shenkuiye.start(配置)。
  台词在 mascot-persona.js，事件表在 mascot-events.js，测验在 quizzes/。
  普通脚本，没有 type="module"，file:// 直接打开也能跑。
  在线月相来自美国海军天文台的公开接口；失败就用下面这个本地公式。

  月相公式对照过这些已知时刻，相位差都在大约半天以内，
  多数在几小时内，足够判断「今晚是哪一种月相」：
    2026-02-17 日环食（朔）         公式的新月在同一天
    2026-03-03 11:34 UT 月全食食甚  公式满月约 07:36 UT
    2026-08-12 日全食（朔）         公式的新月在同一天
    2026-08-28 04:14 UT 月偏食食甚  公式满月约 07:00 UT
    2026-12-24 01:28 UT 满月        公式约 01:16 UT
    2027-01-07 20:24 UT 新月        公式约 19:03 UT
*/
(function () {
  var SYNODIC = 29.530588853;
  var PHASE_NAME = {
    new: "新月",
    waxingCrescent: "峨眉月",
    firstQuarter: "上弦月",
    waxingGibbous: "盈凸月",
    full: "满月",
    waningGibbous: "亏凸月",
    lastQuarter: "下弦月",
    waningCrescent: "残月"
  };
  var KEY_HIDDEN = "shenkuiye.hidden";
  var KEY_WELCOME = "shenkuiye.welcomeDay";
  var spriteDir = document.currentScript && document.currentScript.getAttribute("data-sk-sprite-dir") || "img/";
  var phoneReview = window.matchMedia("(pointer: coarse) and (max-width: 650px), " +
    "(pointer: coarse) and (max-height: 500px) and (max-width: 960px)");

  var state = {
    root: "mascot/",
    page: "home",
    lesson: "",
    online: [],
    mode: "",
    welcomeLines: [],
    welcomeAt: 0,
    sideAt: 0,
    hidden: false,
    hideToken: 0,
    bank: null,
    quiz: null,
    resume: null
  };

  function persona() {
    return window.SHENKUIYE_PERSONA || {};
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function dayKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function dayIndex(key) {
    var p = String(key).split("-");
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }

  function hash(text) {
    var h = 2166136261;
    text = String(text);
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(list, seed) {
    if (!list || !list.length) return null;
    return list[hash(seed) % list.length];
  }

  function fill(text, map) {
    return String(text).replace(/\{(\w+)\}/g, function (_, key) {
      return map[key] != null ? map[key] : "";
    });
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      /* 有的浏览器在 file:// 下会拒绝本地存储，页面仍能用。 */
    }
  }

  function moonPhase(date) {
    var pi = Math.PI;
    var rad = pi / 180;
    var dayMs = 86400000;
    var d = date.valueOf() / dayMs - 0.5 + 2440588 - 2451545;

    function sin(x) { return Math.sin(x); }
    function cos(x) { return Math.cos(x); }
    function rightAscension(l, b) {
      return Math.atan2(sin(l) * cos(rad * 23.4397) - Math.tan(b) * sin(rad * 23.4397), cos(l));
    }
    function declination(l, b) {
      return Math.asin(sin(b) * cos(rad * 23.4397) + cos(b) * sin(rad * 23.4397) * sin(l));
    }

    var mean = rad * (357.5291 + 0.98560028 * d);
    var center = rad * (1.9148 * sin(mean) + 0.02 * sin(2 * mean) + 0.0003 * sin(3 * mean));
    var sunLon = mean + center + rad * 102.9372 + pi;
    var sunDec = declination(sunLon, 0);
    var sunRa = rightAscension(sunLon, 0);

    var moonLon = rad * (218.316 + 13.176396 * d);
    var moonMean = rad * (134.963 + 13.064993 * d);
    var moonLatArg = rad * (93.272 + 13.229350 * d);
    var lon = moonLon + rad * 6.289 * sin(moonMean);
    var lat = rad * 5.128 * sin(moonLatArg);
    var dist = 385001 - 20905 * cos(moonMean);
    var moonDec = declination(lon, lat);
    var moonRa = rightAscension(lon, lat);

    var sunDist = 149598000;
    var cosPhi = sin(sunDec) * sin(moonDec) + cos(sunDec) * cos(moonDec) * cos(sunRa - moonRa);
    cosPhi = Math.max(-1, Math.min(1, cosPhi));
    var phi = Math.acos(cosPhi);
    var inc = Math.atan2(sunDist * sin(phi), dist - sunDist * cos(phi));
    var angle = Math.atan2(
      cos(sunDec) * sin(sunRa - moonRa),
      sin(sunDec) * cos(moonDec) - cos(sunDec) * sin(moonDec) * cos(sunRa - moonRa)
    );
    var phase = 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / pi;
    phase = ((phase % 1) + 1) % 1;
    var age = phase * SYNODIC;
    var id = classify(age);
    return {
      phase: phase,
      ageDays: age,
      illumination: (1 + Math.cos(inc)) / 2,
      id: id,
      name: PHASE_NAME[id],
      waxing: age < SYNODIC / 2,
      source: "local"
    };
  }

  function classify(age) {
    var half = SYNODIC / 2;
    if (Math.min(age, SYNODIC - age) <= 1.5) return "new";
    if (Math.abs(age - half) <= 1.5) return "full";
    if (age < half) {
      if (age < 5.8) return "waxingCrescent";
      if (age < 9.6) return "firstQuarter";
      return "waxingGibbous";
    }
    if (age < half + 4.6) return "waningGibbous";
    if (age < half + 8.4) return "lastQuarter";
    return "waningCrescent";
  }

  function slotOf(date) {
    var hour = date.getHours();
    if (hour >= 5 && hour < 11) return "morning";
    if (hour >= 11 && hour < 14) return "noon";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "latenight";
  }

  function seasonOf(key, events) {
    var today = dayIndex(key);
    var map = { "立春": "spring", "立夏": "summer", "立秋": "autumn", "立冬": "winter" };
    var best = -1e15;
    var season = "";
    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      if (!item || item.kind !== "term" || !map[item.name]) continue;
      var index = dayIndex(item.date);
      if (index <= today && index > best) {
        best = index;
        season = map[item.name];
      }
    }
    if (season) return season;
    var parts = key.split("-");
    var md = (+parts[1]) * 100 + (+parts[2]);
    if (md >= 204 && md < 506) return "spring";
    if (md >= 506 && md < 808) return "summer";
    if (md >= 808 && md < 1108) return "autumn";
    return "winter";
  }

  function nearbyEvents(key, events) {
    var today = dayIndex(key);
    var priority = { eclipse: 0, meteor: 1, conjunction: 2, term: 3 };
    var list = [];
    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      if (!item || !item.date || item.kind === "moon") continue;
      var delta = dayIndex(item.date) - today;
      if (delta < -1 || delta > 2) continue;
      list.push({ item: item, delta: delta });
    }
    list.sort(function (a, b) {
      var ad = Math.abs(a.delta);
      var bd = Math.abs(b.delta);
      if (ad !== bd) return ad - bd;
      return (priority[a.item.kind] || 5) - (priority[b.item.kind] || 5);
    });
    if (!list.length) return [];
    var best = Math.abs(list[0].delta);
    var chosen = [];
    for (var j = 0; j < list.length && chosen.length < 2; j++) {
      if (Math.abs(list[j].delta) !== best) break;
      chosen.push({
        name: list[j].item.name,
        detail: list[j].item.detail || "",
        delta: list[j].delta
      });
    }
    return chosen;
  }

  function parseUsno(json) {
    var rows = (json && (json.phasedata || json.phaseData)) || [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      var label = String(row.phase || "");
      var id = "";
      if (/new/i.test(label)) id = "new";
      else if (/full/i.test(label)) id = "full";
      else if (/first/i.test(label)) id = "firstQuarter";
      else if (/last/i.test(label)) id = "lastQuarter";
      if (!id) continue;
      var time = String(row.time || "0:0").split(":");
      var when = new Date(Date.UTC(+row.year, +row.month - 1, +row.day, +time[0] || 0, +time[1] || 0));
      if (!isNaN(when.getTime())) out.push({ id: id, when: when });
    }
    return out;
  }

  function loadOnline(ms) {
    var year = new Date().getFullYear();
    var url = "https://aa.usno.navy.mil/api/moon/phases/year?year=" + year;
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, ms);
    var options = ctrl ? { signal: ctrl.signal } : undefined;
    return fetch(url, options).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    }).then(function (json) {
      var parsed = parseUsno(json);
      if (parsed.length) state.online = parsed;
    }).catch(function () {
      /* 离线、file:// 被拦截、或接口变更，都留在本地月相。 */
    }).then(function () {
      clearTimeout(timer);
    });
  }

  function waitOnline(ms) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          done = true;
          resolve();
        }
      }, ms);
      loadOnline(ms).then(function () {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  function withOnline(moon, now) {
    var phases = state.online;
    if (!phases || !phases.length) return moon;
    var best = null;
    var bestHours = 1e9;
    for (var i = 0; i < phases.length; i++) {
      var hours = Math.abs(phases[i].when.getTime() - now.getTime()) / 3600000;
      if (hours < bestHours) {
        bestHours = hours;
        best = phases[i];
      }
    }
    if (!best || bestHours > 18) return moon;
    return {
      phase: moon.phase,
      ageDays: moon.ageDays,
      illumination: moon.illumination,
      id: best.id,
      name: PHASE_NAME[best.id] || moon.name,
      waxing: moon.waxing,
      source: "usno"
    };
  }

  function context(now) {
    now = now || new Date();
    var key = dayKey(now);
    var events = window.SHENKUIYE_EVENTS || [];
    return {
      dayKey: key,
      slot: slotOf(now),
      season: seasonOf(key, events),
      moon: withOnline(moonPhase(now), now),
      events: nearbyEvents(key, events)
    };
  }

  function eventLine(ctx) {
    var events = ctx.events;
    var bank = persona().event;
    if (!events || !events.length || !bank) return null;
    var kind = events[0].delta > 0 ? "soon" : events[0].delta < 0 ? "recent" : "today";
    var template = pick(bank[kind], ctx.dayKey + kind);
    if (!template) return null;
    var when = events[0].delta === 1 ? "明天" : events[0].delta === 2 ? "后天" : "就这两天";
    return {
      expression: template.expression,
      text: fill(template.text, {
        name: events.map(function (item) { return item.name; }).join("，还有"),
        detail: events.map(function (item) { return item.detail; }).join(""),
        when: when
      })
    };
  }

  function buildWelcome(ctx) {
    var data = persona();
    var lines = [];
    var open = pick((data.welcome && data.welcome[ctx.slot]) || [], ctx.dayKey + "open");
    var season = pick((data.season && data.season[ctx.season]) || [], ctx.dayKey + "season");
    var moon = pick((data.moon && data.moon[ctx.moon.id]) || [], ctx.dayKey + "moon");
    [open, season, moon].forEach(function (line) {
      if (line) lines.push(line);
    });
    var extra = eventLine(ctx);
    if (extra) lines.push(extra);
    var closing = pick(data.closing, ctx.dayKey + "close");
    if (closing) lines.push(closing);
    if (!lines.length) {
      lines.push({ expression: "normal", text: "观星者，你来了。" });
    }
    return lines;
  }

  function sidePool(ctx) {
    var data = persona();
    var pool = []
      .concat((data.side && data.side[ctx.slot]) || [])
      .concat((data.sideSeason && data.sideSeason[ctx.season]) || [])
      .concat((data.sideMoon && data.sideMoon[ctx.moon.id]) || []);
    var extra = eventLine(ctx);
    if (extra) pool.push(extra);
    return pool;
  }

  function setSprite(img, expression) {
    var names = persona().expressions || {};
    var name = names[expression] ? expression : "normal";
    img.src = state.root + spriteDir + name + ".webp";
    img.alt = "深葵夜" + (names[name] ? "，" + names[name] : "");
  }

  function preload() {
    var names = persona().expressions || { normal: "", smug: "", angry: "", shy: "", worried: "" };
    Object.keys(names).forEach(function (name) {
      var img = new Image();
      img.src = state.root + spriteDir + name + ".webp";
    });
  }

  function paintLine(line) {
    setSprite(state.sprite, line && line.expression);
    state.textEl.textContent = "";
    if (line && line.text) {
      var p = document.createElement("p");
      p.textContent = line.text;
      state.textEl.appendChild(p);
    }
    if (line && line.anchor && line.section) {
      var link = document.createElement("a");
      link.href = line.anchor;
      link.setAttribute("data-sk-jump", "1");
      link.textContent = "去看「" + line.section + "」";
      state.textEl.appendChild(link);
    }
  }

  function resetOverlay() {
    var overlay = state.overlay;
    if (!overlay) return;
    overlay.scrollTop = 0;
    overlay.scrollLeft = 0;
    var stage = overlay.querySelector(".sk-stage");
    var body = overlay.querySelector(".sk-body");
    if (stage) stage.scrollTop = 0;
    if (body) body.scrollTop = 0;
  }

  function alignOverlay() {
    var overlay = state.overlay;
    if (!overlay || overlay.hidden || state.reviewFlow) return;
    overlay.style.top = "0px";
    overlay.style.left = "0px";
    var rect = overlay.getBoundingClientRect();
    if (Math.abs(rect.top) > 1) overlay.style.top = (-rect.top) + "px";
    if (Math.abs(rect.left) > 1) overlay.style.left = (-rect.left) + "px";
  }

  /* 装饰层只负责移动；按钮、焦点和答题状态始终留在真正的界面。 */
  var effects = [];
  var flightBox = null;
  var drag = null;
  var ignoreClickUntil = 0;

  function clearEffects() {
    effects.splice(0).forEach(function (stop) { stop(); });
    flightBox = null;
  }

  function animate(el, frames, time, easing, cleanup) {
    var animation;
    var stop = function () {
      if (animation) animation.cancel();
      if (cleanup) cleanup();
      var i = effects.indexOf(stop);
      if (i !== -1) effects.splice(i, 1);
    };
    effects.push(stop);
    animation = SkyMotion.play(el, frames, time, easing, stop);
    return animation;
  }

  function canAnimate() {
    return typeof SkyMotion !== "undefined" && state.overlay.animate;
  }

  function inputType(event) { return event && (event.type === "keydown" || event.detail === 0) ? "keyboard" : "pointer"; }

  function place(el, rect) {
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    el.style.width = rect.width + "px";
    el.style.height = rect.height + "px";
  }

  function decorative(el, parent) {
    el.hidden = false;
    el.inert = true;
    el.setAttribute("aria-hidden", "true");
    el.removeAttribute("aria-modal");
    el.removeAttribute("role");
    (parent || document.body).appendChild(el);
    return el;
  }

  function fade(el, time, start, end, delay) {
    return animate(el, [{ opacity: start }, { offset: delay, opacity: start }, { opacity: end }], time, "linear");
  }

  function takeOverlay() {
    if (!canAnimate() || state.reviewFlow) return null;
    var copy = state.overlay.cloneNode(true);
    copy.classList.add("sk-flight");
    place(copy, state.overlay.getBoundingClientRect());
    var originalStage = state.stage;
    var stageStyle = getComputedStyle(originalStage);
    copy.querySelector(".sk-stage").style.transform = stageStyle.transform;
    copy.querySelector(".sk-stage").style.opacity = stageStyle.opacity;
    copy.querySelector(".sk-backdrop").style.opacity = getComputedStyle(state.backdrop).opacity;
    var originalParts = state.box.children;
    Array.from(copy.querySelector(".sk-box").children).forEach(function (part, i) {
      part.style.opacity = getComputedStyle(originalParts[i]).opacity;
    });
    copy.querySelector(".sk-figure").style.opacity = getComputedStyle(state.figure).opacity;
    return copy;
  }

  function paintedImage(img) {
    if (!img.naturalWidth || !img.naturalHeight) return null;
    var r = img.getBoundingClientRect();
    if (!SkyMotion.visible(r)) return null;
    var scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    var width = img.naturalWidth * scale;
    var height = img.naturalHeight * scale;
    return { left: r.left + (r.width - width) / 2, top: r.bottom - height, width: width, height: height };
  }

  function releaseWelcome(copy, portrait, wrapLefts, input) {
    if (!copy) return;
    var reduced = SkyMotion.preference.matches;
    var time = SkyMotion.duration("welcome", input === "keyboard");
    var mini = state.miniImg;
    var destination = !reduced && paintedImage(mini);
    if (!portrait || !destination) {
      decorative(copy);
      animate(copy, [{ opacity: 1 }, { opacity: 0 }], reduced ? time : time * 0.45, "ease-out", function () { copy.remove(); });
      return;
    }
    var shared = copy.querySelector(".sk-sprite");
    shared.remove();
    decorative(copy);
    animate(copy, [{ opacity: 1 }, { opacity: 0 }], time * 0.43, "ease-out", function () { copy.remove(); });
    shared.className = "sk-flight-portrait";
    shared.alt = "";
    place(shared, portrait);
    decorative(shared);
    mini.style.visibility = "hidden";
    animate(shared, [{ transform: "none" }, { transform: SkyMotion.transform(destination.left - portrait.left,
      destination.top - portrait.top, destination.width / portrait.width, destination.height / portrait.height) }], time, null, function () {
      shared.remove();
      mini.style.visibility = "";
    });
    wrapLefts.forEach(function (left, wrap) {
      var dx = left - wrap.getBoundingClientRect().left;
      if (Math.abs(dx) < 1) return;
      animate(wrap, [{ translate: dx + "px 0" }, { translate: "none" }], time, "ease-in-out");
    });
  }

  function morphBox(first, last, fromRadius, toRadius, time, opening) {
    var shell = document.createElement("div");
    shell.className = "sk-box sk-flight-box";
    place(shell, last);
    if (opening) {
      decorative(shell, state.overlay);
      state.overlay.insertBefore(shell, state.stage);
      shell.classList.add("sk-flight-box-inner");
    } else decorative(shell);
    var sx = first.width / last.width, sy = first.height / last.height;
    function radius(r, x, y) { return (r / x) + "px / " + (r / y) + "px"; }
    var frames = [
      { transform: SkyMotion.transform(first.left - last.left, first.top - last.top, sx, sy), borderRadius: radius(fromRadius, sx, sy) },
      { transform: "none", borderRadius: radius(toRadius, 1, 1) }
    ];
    if (opening) state.box.classList.add("sk-in-flight");
    flightBox = shell;
    animate(shell, frames, time, null, function () {
      shell.remove();
      if (flightBox === shell) flightBox = null;
      if (opening) state.box.classList.remove("sk-in-flight");
    });
    animate(shell, [{ backgroundColor: opening ? "var(--sky)" : "var(--sk-panel-solid)", opacity: 1 },
      { offset: 0.75, backgroundColor: "var(--sk-panel-solid)", opacity: 1 },
      { backgroundColor: opening ? "var(--sk-panel)" : "var(--sky)", opacity: opening ? 1 : 0 }], time, "linear");
  }

  function buttonBox(el) {
    if (!canAnimate() || !el || !el.isConnected) return null;
    var rect = el.getBoundingClientRect();
    if (!SkyMotion.visible(rect)) return null;
    return { rect: rect, radius: Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, rect.height / 2) };
  }

  function revealReview(source, input) {
    if (!canAnimate()) return;
    var time = SkyMotion.duration("review", input === "keyboard");
    clearEffects();
    var end = state.box.getBoundingClientRect();
    if (state.reviewFlow && (SkyMotion.preference.matches || !source || end.bottom > window.innerHeight)) {
      fade(state.stage, time, 0, 1, 0);
      return;
    }
    if (SkyMotion.preference.matches || !source) {
      fade(state.overlay, time, 0, 1, 0);
      return;
    }
    var radius = parseFloat(getComputedStyle(state.box).borderTopLeftRadius);
    morphBox(source.rect, end, source.radius, radius, time, true);
    fade(state.backdrop, time, 0, 1, 0);
    [state.figure, state.skip].concat(Array.from(state.box.children)).forEach(function (el) { fade(el, time, 0, 1, 0.48); });
  }

  function exitReview(copy, first, radius, target, input, velocity) {
    if (!copy && (!canAnimate() || !target || !SkyMotion.visible(first) ||
        first.top < 0 || first.bottom > window.innerHeight || SkyMotion.preference.matches)) return;
    var time = SkyMotion.duration("review", input === "keyboard");
    var reduced = SkyMotion.preference.matches;
    if (velocity && !reduced) time = Math.max(130, time / (1 + Math.abs(velocity) * 0.65));
    if (!copy) {
      morphBox(first, target.rect, radius, target.radius, time, false);
      return;
    }
    decorative(copy);
    if (reduced || !target || !SkyMotion.visible(first)) {
      animate(copy, [{ opacity: 1 }, { opacity: 0 }], reduced ? time : time * 0.48, "ease-out", function () { copy.remove(); });
      return;
    }
    var box = copy.querySelector(".sk-box");
    box.classList.add("sk-in-flight");
    morphBox(first, target.rect, radius, target.radius, time, false);
    animate(copy, [{ opacity: 1 }, { opacity: 0 }], time * 0.33, "linear", function () { copy.remove(); });
  }

  function focusOn(el) {
    if (el && el.isConnected && el.getClientRects().length) el.focus({ preventScroll: true });
  }

  function shieldPage(on) {
    if (on) {
      state.shield = Array.from(document.body.children).filter(function (el) {
        return el !== state.overlay && !el.inert && !el.matches("script, style, .sk-flight, .sk-flight-box, .sk-flight-portrait");
      });
      state.shield.forEach(function (el) { el.inert = true; });
    } else {
      (state.shield || []).forEach(function (el) { el.inert = false; });
      state.shield = null;
    }
  }

  function pinReader() {
    var pin = document.createElement("div");
    pin.className = "sk-page-pin";
    pin.style.top = -state.lockY + "px";
    pin.inert = true;
    pin.setAttribute("aria-hidden", "true");
    state.overlay.before(pin);
    var nodes = state.shield.map(function (el) {
      var marker = document.createComment("");
      el.before(marker);
      pin.appendChild(el);
      return { el: el, marker: marker };
    });
    state.unpinReader = function () {
      nodes.forEach(function (node) { node.marker.replaceWith(node.el); });
      pin.remove();
      state.unpinReader = null;
    };
  }

  function setReviewLayout(flow, transferScroll) {
    var body = document.body;
    var overlay = state.overlay;
    var inner = state.reviewBody;
    var previousTop = transferScroll ? inner.getBoundingClientRect().top - inner.scrollTop : 0;
    state.reviewFlow = flow;
    overlay.classList.toggle("sk-flow", flow);
    body.classList.toggle("sk-review-flow", flow);
    body.classList.toggle("sk-lock", !flow);
    body.style.top = flow ? "" : -state.lockY + "px";
    if (flow) {
      overlay.style.top = "";
      overlay.style.left = "";
      pinReader();
      var documentTop = inner.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: transferScroll ? Math.max(0, documentTop - previousTop) : 0, behavior: "instant" });
    } else {
      if (state.unpinReader) state.unpinReader();
      alignOverlay();
      if (transferScroll) inner.scrollTop = Math.max(0, inner.getBoundingClientRect().top - previousTop);
    }
  }

  function syncReviewLayout() {
    if (state.overlay.hidden || state.mode !== "quiz" || state.reviewFlow === phoneReview.matches) return;
    clearDrag();
    clearEffects();
    setReviewLayout(phoneReview.matches, true);
  }

  function showOverlay() {
    if (!state.overlay.hidden) return;
    state.lockY = window.scrollY || document.documentElement.scrollTop || 0;
    state.overlay.hidden = false;
    state.overlay.toggleAttribute("data-sk-review", state.mode === "quiz");
    shieldPage(true);
    resetOverlay();
    setReviewLayout(state.mode === "quiz" && phoneReview.matches, false);
    window.requestAnimationFrame(alignOverlay);
  }

  function hideOverlay() {
    var y = state.lockY || 0;
    state.overlay.hidden = true;
    state.overlay.classList.remove("sk-flow");
    state.reviewFlow = false;
    if (state.unpinReader) state.unpinReader();
    state.overlay.style.top = "";
    state.overlay.style.left = "";
    resetOverlay();
    document.body.classList.remove("sk-lock", "sk-review-flow");
    document.body.style.top = "";
    window.scrollTo({ top: y, behavior: "instant" });
    shieldPage(false);
  }

  function markWelcome() {
    storageSet(KEY_WELCOME, dayKey(new Date()));
  }

  function showDock() {
    state.hideToken += 1;
    state.hidden = false;
    storageSet(KEY_HIDDEN, "0");
    state.recall.hidden = true;
    state.dock.hidden = false;
    document.body.classList.add("sk-has-dock");
    setSprite(state.miniImg, "normal");
  }

  function hideDock() {
    state.hidden = true;
    storageSet(KEY_HIDDEN, "1");
    state.dock.hidden = true;
    state.bubble.hidden = true;
    document.body.classList.remove("sk-has-dock");
    state.recall.hidden = false;
  }

  function renderWelcome(event) {
    var line = state.welcomeLines[state.welcomeAt];
    if (!line) {
      finishWelcome(event);
      return;
    }
    state.choicesEl.textContent = "";
    state.progressEl.textContent = "";
    state.hintEl.hidden = false;
    state.hintEl.textContent = state.welcomeAt + 1 >= state.welcomeLines.length ? "点击开始" : "点击继续";
    paintLine(line);
  }

  function finishWelcome(event) {
    var copy = takeOverlay();
    var moving = copy && !SkyMotion.preference.matches;
    var portrait = moving && paintedImage(state.sprite);
    var lefts = new Map();
    if (moving) document.querySelectorAll(".wrap").forEach(function (wrap) { lefts.set(wrap, wrap.getBoundingClientRect().left); });
    clearEffects();
    markWelcome();
    hideOverlay();
    state.mode = "dock";
    showDock();
    focusOn(state.mini);
    releaseWelcome(copy, portrait, lefts, inputType(event));
  }

  function openWelcome() {
    state.mode = "welcome";
    state.welcomeLines = buildWelcome(context(new Date()));
    state.welcomeAt = 0;
    state.skip.textContent = "跳过";
    state.skip.hidden = false;
    if (state.dock) state.dock.hidden = true;
    showOverlay();
    renderWelcome();
    focusOn(state.textEl);
  }

  function onMini() {
    var pool = sidePool(context(new Date()));
    if (!pool.length) return;
    if (!state.bubble.hidden) state.sideAt = (state.sideAt + 1) % pool.length;
    var line = pool[state.sideAt % pool.length];
    setSprite(state.miniImg, line.expression);
    state.bubble.textContent = line.text;
    state.bubble.hidden = false;
  }

  function onHide() {
    var line = persona().farewell || { expression: "shy", text: "可以。我避开。" };
    setSprite(state.miniImg, line.expression);
    state.bubble.textContent = line.text;
    state.bubble.hidden = false;
    state.hideToken += 1;
    var token = state.hideToken;
    setTimeout(function () {
      if (token !== state.hideToken) return;
      hideDock();
    }, 1400);
  }

  function onRecall() {
    showDock();
    markWelcome();
    var line = persona().recall;
    if (!line) return;
    setSprite(state.miniImg, line.expression);
    state.bubble.textContent = line.text;
    state.bubble.hidden = false;
  }

  function mountQuizButton() {
    var banks = window.SHENKUIYE_QUIZZES || {};
    var bank = banks[state.lesson];
    if (!bank || !bank.questions || !bank.questions.length) return;
    state.bank = bank;
    var heading = null;
    var headings = document.querySelectorAll("h2");
    for (var i = 0; i < headings.length; i++) {
      if ((headings[i].textContent || "").replace(/\s/g, "") === "小练习") heading = headings[i];
    }
    if (!heading) return;
    var section = heading.closest ? heading.closest("section") : heading.parentNode;
    var holder = document.createElement("p");
    holder.className = "sk-review-launch";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sk-review-btn";
    button.textContent = "和深葵夜一起复习";
    button.addEventListener("click", openQuiz);
    state.reviewButton = button;
    holder.appendChild(button);
    var list = section.querySelector("ol.exercises");
    if (list) list.insertAdjacentElement("afterend", holder);
    else heading.insertAdjacentElement("afterend", holder);
  }

  function openQuiz(event) {
    if (!state.bank) return;
    var wasOpen = !state.overlay.hidden;
    var source = !wasOpen && (buttonBox(flightBox) || buttonBox(event && event.currentTarget) || buttonBox(state.reviewButton));
    clearEffects();
    state.quiz = {
      index: -1,
      phase: "intro",
      reactAt: 0,
      reactLines: [],
      correct: 0,
      missed: [],
      afterJump: ""
    };
    state.mode = "quiz";
    state.skip.textContent = "先停一下";
    state.skip.hidden = false;
    if (state.dock) state.dock.hidden = true;
    if (state.resume) {
      state.resume.remove();
      state.resume = null;
    }
    showOverlay();
    renderQuiz();
    focusOn(state.textEl);
    if (!wasOpen) revealReview(source, inputType(event));
  }

  function renderQuiz() {
    var quiz = state.quiz;
    var bank = state.bank;
    if (!quiz || !bank) return;
    var moveFocus = state.overlay.contains(document.activeElement) && document.activeElement !== state.skip;
    state.choicesEl.textContent = "";
    if (quiz.phase === "intro") {
      state.progressEl.textContent = "";
      state.hintEl.hidden = false;
      state.hintEl.textContent = "点击继续";
      paintLine(persona().quizIntro || { expression: "normal", text: "来复习。观星者。" });
      return;
    }
    if (quiz.phase === "ask") {
      var question = bank.questions[quiz.index];
      state.progressEl.textContent = (quiz.index + 1) + " / " + bank.questions.length;
      state.hintEl.hidden = true;
      paintLine({ expression: "normal", text: question.prompt });
      question.choices.forEach(function (choice, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "sk-choice";
        button.textContent = choice;
        button.addEventListener("click", function (event) {
          event.stopPropagation();
          grade(index);
        });
        state.choicesEl.appendChild(button);
      });
      if (moveFocus) focusOn(state.choicesEl.firstElementChild);
      return;
    }
    if (quiz.phase === "react") {
      var line = quiz.reactLines[quiz.reactAt];
      state.progressEl.textContent = (quiz.index + 1) + " / " + bank.questions.length;
      state.hintEl.hidden = false;
      state.hintEl.textContent = quiz.reactAt < quiz.reactLines.length - 1 ? "点击继续" : "点击下一题";
      paintLine(line);
      if (moveFocus || document.activeElement === document.body) focusOn(state.textEl);
      return;
    }
    renderSummary();
    if (moveFocus) focusOn(state.choicesEl.firstElementChild);
  }

  function grade(index) {
    var quiz = state.quiz;
    var question = state.bank.questions[quiz.index];
    var correct = index === question.answer;
    if (correct) quiz.correct += 1;
    var pack = correct ? question.correct : question.wrong;
    var lines = [{
      expression: (pack && pack.expression) || (correct ? "smug" : "worried"),
      text: (pack && pack.text) || (correct ? "对。" : "不对。")
    }];
    if (!correct) {
      lines.push({
        expression: "worried",
        text: (pack && pack.review) || "",
        anchor: pack && pack.anchor,
        section: pack && pack.section
      });
      quiz.missed.push({
        section: pack && pack.section,
        anchor: pack && pack.anchor,
        review: pack && pack.review
      });
    }
    quiz.reactLines = lines;
    quiz.reactAt = 0;
    quiz.phase = "react";
    renderQuiz();
  }

  function advanceReact() {
    var quiz = state.quiz;
    quiz.reactAt += 1;
    if (quiz.reactAt < quiz.reactLines.length) {
      renderQuiz();
      return;
    }
    goNextQuestion();
  }

  function goNextQuestion() {
    var quiz = state.quiz;
    quiz.index += 1;
    quiz.afterJump = "";
    if (quiz.index >= state.bank.questions.length) quiz.phase = "summary";
    else quiz.phase = "ask";
    renderQuiz();
  }

  function renderSummary() {
    var quiz = state.quiz;
    var total = state.bank.questions.length;
    var key = quiz.correct === total ? "perfect" : (quiz.correct * 2 >= total ? "good" : "poor");
    var bank = (persona().summary && persona().summary[key]) || [];
    var template = bank[0] || { expression: "normal", text: "{correct}／{total}" };
    state.progressEl.textContent = "复习结束";
    state.hintEl.hidden = true;
    paintLine({
      expression: template.expression,
      text: fill(template.text, { correct: String(quiz.correct), total: String(total) })
    });
    if (quiz.missed.length) {
      var list = document.createElement("ul");
      list.className = "sk-missed";
      quiz.missed.forEach(function (item) {
        var li = document.createElement("li");
        if (item.anchor) {
          var link = document.createElement("a");
          link.href = item.anchor;
          link.setAttribute("data-sk-jump", "summary");
          link.textContent = item.section || "这一节";
          li.appendChild(link);
        }
        var note = document.createElement("span");
        note.textContent = (item.anchor ? "：" : "") + (item.review || "");
        li.appendChild(note);
        list.appendChild(li);
      });
      state.textEl.appendChild(list);
    }
    addSummaryButton("先这样", function () { closeQuiz(); });
    addSummaryButton("再来一次", function () { openQuiz(); });
  }

  function addSummaryButton(label, action) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sk-choice";
    button.textContent = label;
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      action();
    });
    state.choicesEl.appendChild(button);
  }

  function endReview() {
    var origin = flightBox || state.box;
    var first = origin.getBoundingClientRect();
    var radius = parseFloat(getComputedStyle(origin).borderTopLeftRadius) || 0;
    var copy = takeOverlay();
    clearEffects();
    clearDrag();
    hideOverlay();
    return { copy: copy, first: first, radius: radius };
  }

  function closeQuiz(event, velocity) {
    if (state.overlay.hidden) return;
    var from = endReview();
    state.mode = "dock";
    state.skip.textContent = "跳过";
    if (state.resume) {
      state.resume.remove();
      state.resume = null;
    }
    if (state.hidden) state.recall.hidden = false;
    else showDock();
    var target = buttonBox(state.reviewButton);
    focusOn(target ? state.reviewButton : state.hidden ? state.recall : state.mini);
    exitReview(from.copy, from.first, from.radius, target, inputType(event), velocity);
  }

  function jumpTo(href, fromSummary, event) {
    var quiz = state.quiz;
    if (quiz) quiz.afterJump = fromSummary ? "summary" : "next";
    var from = endReview();
    if (!state.resume) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sk-resume";
      button.textContent = "继续和深葵夜复习";
      button.addEventListener("click", resumeQuiz);
      document.body.appendChild(button);
      state.resume = button;
    }
    if (href && href.charAt(0) === "#") {
      var target = document.querySelector(href);
      if (target) {
        var top = target.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop || 0);
        window.scrollTo(0, Math.max(0, top - 12));
        target.setAttribute("tabindex", "-1");
        focusOn(target);
      }
      try {
        history.replaceState(null, "", href);
      } catch (err) {
        /* 地址改不了时，页面仍然会滚到那一节。 */
      }
    }
    if (!target) focusOn(state.resume);
    exitReview(from.copy, from.first, from.radius, buttonBox(state.resume), inputType(event));
  }

  function resumeQuiz(event) {
    var source = buttonBox(flightBox) || buttonBox(state.resume);
    clearEffects();
    if (state.resume) {
      state.resume.remove();
      state.resume = null;
    }
    var quiz = state.quiz;
    if (!quiz) return;
    if (quiz.afterJump === "summary") quiz.phase = "summary";
    else if (quiz.afterJump === "next") goNextQuestion();
    state.mode = "quiz";
    if (state.dock) state.dock.hidden = true;
    showOverlay();
    if (quiz.afterJump !== "next") renderQuiz();
    quiz.afterJump = "";
    resetOverlay();
    alignOverlay();
    focusOn(state.choicesEl.firstElementChild || state.textEl);
    revealReview(source, inputType(event));
  }

  function onOverlayClick(event) {
    if (event.detail > 0 && performance.now() < ignoreClickUntil && !event.target.closest("button, a")) return;
    var link = event.target.closest && event.target.closest("a[data-sk-jump]");
    if (link) {
      event.preventDefault();
      jumpTo(link.getAttribute("href"), link.getAttribute("data-sk-jump") === "summary", event);
      return;
    }
    if (event.target.closest && event.target.closest("button")) return;
    if (state.mode === "welcome") {
      state.welcomeAt += 1;
      renderWelcome(event);
      return;
    }
    if (state.mode !== "quiz" || !state.quiz) return;
    if (state.quiz.phase === "intro") {
      state.quiz.index = 0;
      state.quiz.phase = "ask";
      renderQuiz();
    } else if (state.quiz.phase === "react") {
      advanceReact();
    }
  }

  function onKey(event) {
    if (!state.overlay || state.overlay.hidden) {
      if (event.key === "Escape" && state.bubble) state.bubble.hidden = true;
      return;
    }
    if (event.key === "Escape") {
      if (state.mode === "welcome") finishWelcome(event);
      else if (state.mode === "quiz") closeQuiz(event);
      return;
    }
    if (event.key === "Tab") {
      var controls = Array.from(state.overlay.querySelectorAll("button:not([disabled]), a[href]")).filter(function (el) {
        return el.getClientRects().length;
      });
      var active = document.activeElement;
      if (controls.length && (!controls.includes(active) || active === (event.shiftKey ? controls[0] : controls[controls.length - 1]))) {
        event.preventDefault();
        var next = event.shiftKey ? controls[controls.length - 1] : controls[0];
        focusOn(next);
        if (state.reviewFlow) next.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
      return;
    }
    if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowRight") return;
    var tag = event.target && event.target.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    event.preventDefault();
    onOverlayClick({ target: state.overlay, detail: 0, type: "keydown", preventDefault: function () {} });
  }

  function clearDrag() {
    var id = drag && drag.id;
    drag = null;
    if (id != null && state.overlay.hasPointerCapture(id)) state.overlay.releasePointerCapture(id);
    state.stage.style.transform = "";
    state.stage.style.opacity = "";
    state.backdrop.style.opacity = "";
  }

  function dragStart(event) {
    if (!canAnimate() || event.pointerType !== "touch" || !event.isPrimary || state.mode !== "quiz" ||
        (!state.reviewFlow && !window.matchMedia("(max-width: 860px)").matches) ||
        !event.target.closest(state.reviewFlow ? ".sk-name" : ".sk-figure, .sk-name")) return;
    ignoreClickUntil = 0;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, last: event.clientY, time: performance.now(), velocity: 0, dy: 0 };
  }

  function dragMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    var dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(event.clientX - drag.x) > 12 && Math.abs(event.clientX - drag.x) > Math.abs(dy)) { clearDrag(); return; }
      if (dy < 6) return;
      clearEffects();
      drag.active = true;
      state.overlay.setPointerCapture(event.pointerId);
    }
    var now = performance.now();
    drag.velocity = 0.4 * drag.velocity + 0.6 * (event.clientY - drag.last) / Math.max(4, now - drag.time);
    drag.time = now;
    drag.last = event.clientY;
    drag.dy = Math.max(0, dy);
    var fraction = Math.min(1, drag.dy / Math.min(280, window.innerHeight * 0.45));
    if (SkyMotion.preference.matches) state.stage.style.opacity = 1 - 0.2 * fraction;
    else {
      state.stage.style.transform = SkyMotion.transform(0, drag.dy, 1 - 0.18 * fraction, 1 - 0.18 * fraction);
      state.backdrop.style.opacity = 1 - 0.55 * fraction;
    }
  }

  function dragEnd(event) {
    /* 触屏起初由立绘隐式捕获；转交给浮层并不是手势取消。 */
    if (event.type === "lostpointercapture" && event.target !== state.overlay) return;
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.active) { clearDrag(); return; }
    ignoreClickUntil = performance.now() + 450;
    var velocity = performance.now() - drag.time < 100 ? drag.velocity : 0;
    var threshold = Math.min(280, window.innerHeight * 0.45);
    if (event.type === "pointerup" && drag.dy + velocity * 125 > threshold / 2) {
      closeQuiz(event, velocity);
      return;
    }
    var from = state.stage.style.transform;
    var stageOpacity = Number(state.stage.style.opacity);
    var opacity = Number(state.backdrop.style.opacity);
    clearDrag();
    if (SkyMotion.preference.matches) {
      fade(state.stage, SkyMotion.duration("review"), stageOpacity, 1, 0);
      return;
    }
    var time = Math.max(150, SkyMotion.duration("review") * 0.55 / (1 + Math.abs(velocity)));
    animate(state.stage, [{ transform: from }, { transform: "none" }], time);
    fade(state.backdrop, time, opacity, 1, 0);
  }

  function buildShell() {
    var overlay = document.createElement("div");
    overlay.className = "sk-overlay";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "深葵夜");
    overlay.innerHTML =
      '<div class="sk-backdrop" aria-hidden="true"></div>' +
      '<div class="sk-skip-track"><button type="button" class="sk-skip">跳过</button></div>' +
      '<div class="sk-stage">' +
        '<div class="sk-figure"><img class="sk-sprite" alt="深葵夜"></div>' +
        '<div class="sk-box">' +
          '<div class="sk-name"></div>' +
          '<div class="sk-progress"></div>' +
          '<div class="sk-body">' +
            '<div class="sk-text" aria-live="polite" tabindex="-1"></div>' +
            '<p class="sk-hint">点击继续</p>' +
          "</div>" +
          '<div class="sk-choices"></div>' +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    state.overlay = overlay;
    state.sprite = overlay.querySelector(".sk-sprite");
    state.backdrop = overlay.querySelector(".sk-backdrop");
    state.stage = overlay.querySelector(".sk-stage");
    state.figure = overlay.querySelector(".sk-figure");
    state.box = overlay.querySelector(".sk-box");
    state.nameEl = overlay.querySelector(".sk-name");
    state.progressEl = overlay.querySelector(".sk-progress");
    state.textEl = overlay.querySelector(".sk-text");
    state.reviewBody = overlay.querySelector(".sk-body");
    state.choicesEl = overlay.querySelector(".sk-choices");
    state.hintEl = overlay.querySelector(".sk-hint");
    state.skip = overlay.querySelector(".sk-skip");
    state.nameEl.textContent = persona().name || "深葵夜";
    state.skip.addEventListener("click", function (event) {
      event.stopPropagation();
      if (state.mode === "welcome") finishWelcome(event);
      else if (state.mode === "quiz") closeQuiz(event);
    });
    overlay.addEventListener("click", onOverlayClick);
    overlay.addEventListener("pointerdown", dragStart);
    overlay.addEventListener("pointermove", dragMove);
    overlay.addEventListener("pointerup", dragEnd);
    overlay.addEventListener("pointercancel", dragEnd);
    overlay.addEventListener("lostpointercapture", dragEnd);

    var dock = document.createElement("div");
    dock.className = "sk-dock";
    dock.hidden = true;
    dock.innerHTML =
      '<div class="sk-bubble" hidden></div>' +
      '<button type="button" class="sk-mini" aria-label="和深葵夜说话"><img alt="深葵夜"></button>' +
      '<button type="button" class="sk-hide">让我静静</button>';
    document.body.appendChild(dock);
    state.dock = dock;
    state.bubble = dock.querySelector(".sk-bubble");
    state.miniImg = dock.querySelector(".sk-mini img");
    state.mini = dock.querySelector(".sk-mini");
    state.mini.addEventListener("click", onMini);
    dock.querySelector(".sk-hide").addEventListener("click", function (event) {
      event.stopPropagation();
      onHide();
    });

    var recall = document.createElement("button");
    recall.type = "button";
    recall.className = "sk-recall";
    recall.textContent = "我想你了";
    recall.hidden = true;
    recall.addEventListener("click", onRecall);
    document.body.appendChild(recall);
    state.recall = recall;

    document.addEventListener("keydown", onKey);
    function resetMotion() { clearDrag(); clearEffects(); }
    window.addEventListener("resize", resetMotion);
    if (phoneReview.addEventListener) phoneReview.addEventListener("change", syncReviewLayout);
    window.addEventListener("pagehide", resetMotion);
    if (canAnimate() && SkyMotion.preference.addEventListener) SkyMotion.preference.addEventListener("change", resetMotion);
    preload();
  }

  function consumeReset() {
    if ((location.search || "").indexOf("shenkuiye=reset") === -1) return;
    try {
      localStorage.removeItem(KEY_HIDDEN);
      localStorage.removeItem(KEY_WELCOME);
    } catch (err) {
      /* 清不掉也不影响这一次打开。 */
    }
    try {
      var url = new URL(location.href);
      url.searchParams.delete("shenkuiye");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (err2) {
      /* file:// 下如果改不了地址，欢迎仍会按已清空的记录重来。 */
    }
  }

  function start(config) {
    config = config || {};
    if (!document.body || config.page === "off") return;
    state.root = config.root || "mascot/";
    if (state.root.charAt(state.root.length - 1) !== "/") state.root += "/";
    state.page = config.page || "companion";
    state.lesson = config.lesson || "";
    consumeReset();
    buildShell();
    if (state.page === "lesson") mountQuizButton();
    state.hidden = storageGet(KEY_HIDDEN) === "1";
    var seen = storageGet(KEY_WELCOME) === dayKey(new Date());
    if (state.page === "home" && !state.hidden && !seen) {
      waitOnline(1200).then(openWelcome);
      return;
    }
    if (state.hidden) state.recall.hidden = false;
    else showDock();
    loadOnline(4000);
  }

  window.Shenkuiye = {
    start: start,
    moonPhase: moonPhase
  };
})();
