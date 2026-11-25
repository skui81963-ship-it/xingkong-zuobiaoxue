/*
  stargaze-controls.js
  --------------------
  只管页面上的按钮、时间和手指。
  算高度方位调用 StarGazeAstro，画图调用 StarGazeRender。
  这一份不决定星星的颜色，也不改公式。

  浏览器直接打开 html 时没有「模块打包器」，所以这几个文件用普通 script 按顺序引入，
  而不是 type="module"。type="module" 在 file:// 下经常被浏览器拦住。
*/

var StarGazeControls = (function () {
  var state;
  var catalog;
  var silent = false;
  var pointers = {};
  var dragTotal = 0;
  var pinch = null;
  var gyroTimer = 0;

  var canvas;
  var timeEl;
  var lstEl;
  var lookEl;
  var starEl;
  var statusEl;
  var vegaEl;
  var timeInput;
  var city;
  var latInput;
  var lonInput;
  var tzInput;
  var playBtn;
  var gyroBtn;

  function $(id) {
    return document.getElementById(id);
  }

  function status(text) {
    statusEl.textContent = text || "";
  }

  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  function defaultState() {
    return {
      view: "ground",
      lat: 40,
      lon: 116.4,
      tz: 8,
      utcMs: Date.now(),
      playing: false,
      speed: 1,
      basis: StarGazeAstro.defaultBasis(),
      zoom: 1,
      orbitAz: -42,
      orbitEl: 18,
      orbitDist: 4.2,
      orbitZoom: 1,
      consOn: {},
      astOn: {},
      showConstLines: true,
      showHorizon: true,
      showHorizonGrid: false,
      showEquatorGrid: true,
      showLabels: true,
      /* 下面几项只有实用星座模拟的页面会改。虚拟观星不放这些控件，就保持这里的默认。 */
      groundOn: true,
      groundAlpha: 1,
      showMilkyWay: false,
      milkyAlpha: 0.45,
      showBounds: false,
      showConsNames: false,
      highlightCons: null,
      gyro: false,
      gyroSeen: false,
      gyroAbsolute: false,
      picked: null,
      catalog: null
    };
  }

  function readFilters() {
    var boxes = document.querySelectorAll("[data-cons]");
    var i;
    state.consOn = {};
    for (i = 0; i < boxes.length; i++) {
      state.consOn[boxes[i].getAttribute("data-cons")] = boxes[i].checked;
    }
    boxes = document.querySelectorAll("[data-aster]");
    state.astOn = {};
    for (i = 0; i < boxes.length; i++) {
      state.astOn[boxes[i].getAttribute("data-aster")] = boxes[i].checked;
    }
    state.showConstLines = $("sg-const-lines").checked;
    state.showHorizon = $("sg-horizon").checked;
    state.showHorizonGrid = $("sg-grid-h").checked;
    state.showEquatorGrid = $("sg-grid-e").checked;
    state.showLabels = $("sg-labels").checked;
    var groundBox = $("sg-ground");
    if (groundBox) state.groundOn = groundBox.checked;
    var groundSlider = $("sg-ground-alpha");
    if (groundSlider) state.groundAlpha = clamp(Number(groundSlider.value) / 100, 0, 1);
    var mwBox = $("sg-mw");
    if (mwBox) state.showMilkyWay = mwBox.checked;
    var mwSlider = $("sg-mw-alpha");
    if (mwSlider) state.milkyAlpha = clamp(Number(mwSlider.value) / 100, 0, 1);
    var boundsBox = $("sg-bounds");
    if (boundsBox) state.showBounds = boundsBox.checked;
    var namesBox = $("sg-cons-names");
    if (namesBox) state.showConsNames = namesBox.checked;
    updateSliderLabels();
  }

  function updateSliderLabels() {
    var gs = $("sg-ground-alpha");
    var gv = $("sg-ground-alpha-val");
    if (gs && gv) gv.textContent = gs.value + "%";
    var ms = $("sg-mw-alpha");
    var mv = $("sg-mw-alpha-val");
    if (ms && mv) mv.textContent = ms.value + "%";
  }

  function foldName(s) {
    return String(s || "").toLowerCase()
      .replace(/ö/g, "o").replace(/é/g, "e").replace(/á/g, "a").replace(/ü/g, "u")
      .replace(/\s+/g, "");
  }

  /*
    每个字段单独比，不把中文名、拉丁名、缩写粘成一串。
    粘在一起时，Eridanus 和 Eri 会变成 eridanuseri，里面含有 ser。
    完全相同（中文名、拉丁名、缩写整词、别名）优先于开头相同，再优先于中间包含。
  */
  function scoreField(q, text, wholeOnly) {
    var f = foldName(text);
    if (!q || !f) return null;
    if (f === q) return { score: 300, tight: f.length };
    if (wholeOnly) return null;
    if (f.indexOf(q) === 0) return { score: 200, tight: f.length };
    if (f.indexOf(q) !== -1) return { score: 100, tight: f.length };
    return null;
  }

  function scoreRecord(q, rec) {
    var best = null;
    function keep(hit) {
      if (!hit) return;
      if (!best || hit.score > best.score || (hit.score === best.score && hit.tight < best.tight)) {
        best = hit;
      }
    }
    keep(scoreField(q, rec.name, false));
    keep(scoreField(q, rec.latin, false));
    keep(scoreField(q, rec.abbr, true));
    var alias = String(rec.alias || "").split(/\s+/);
    var i;
    for (i = 0; i < alias.length; i++) keep(scoreField(q, alias[i], false));
    return best ? best.score : 0;
  }

  function bestMatch(q, list) {
    var query = foldName(String(q || "").trim());
    if (!query) return null;
    var best = null;
    var bestScore = 0;
    var bestTight = 1e9;
    var i;
    for (i = 0; i < list.length; i++) {
      var rec = list[i];
      var hit = null;
      var tight = 1e9;
      function keep(one) {
        if (!one) return;
        if (!hit || one.score > hit || (one.score === hit && one.tight < tight)) {
          hit = one.score;
          tight = one.tight;
        }
      }
      keep(scoreField(query, rec.name, false));
      keep(scoreField(query, rec.latin, false));
      keep(scoreField(query, rec.abbr, true));
      var alias = String(rec.alias || "").split(/\s+/);
      var k;
      for (k = 0; k < alias.length; k++) keep(scoreField(query, alias[k], false));
      if (!hit) continue;
      if (!best || hit > bestScore || (hit === bestScore && tight < bestTight)) {
        best = rec;
        bestScore = hit;
        bestTight = tight;
      }
    }
    return best;
  }

  /* 88 个星座的中文名、拉丁名、缩写，各自搜索都必须回到自己。 */
  function selfTestSearch(list) {
    var bad = [];
    var i, k;
    for (i = 0; i < list.length; i++) {
      var rec = list[i];
      var queries = [rec.name, rec.latin, rec.abbr];
      for (k = 0; k < queries.length; k++) {
        var hit = bestMatch(queries[k], list);
        if (!hit || hit.id !== rec.id) {
          bad.push(queries[k] + " -> " + (hit ? hit.id : "?"));
        }
      }
    }
    return bad;
  }

  function applySearch() {
    var input = $("sg-find");
    var note = $("sg-find-note");
    if (!input) return null;
    var q = foldName(input.value.trim());
    var items = document.querySelectorAll("#sg-cons li");
    var records = [];
    var i;
    for (i = 0; i < items.length; i++) {
      var box = items[i].querySelector("[data-cons]");
      records.push({
        id: box ? box.getAttribute("data-cons") : "",
        name: items[i].getAttribute("data-name") || "",
        latin: items[i].getAttribute("data-latin") || "",
        abbr: items[i].getAttribute("data-abbr") || "",
        alias: items[i].getAttribute("data-alias") || "",
        li: items[i]
      });
    }
    var best = q ? bestMatch(q, records) : null;
    var n = 0;
    for (i = 0; i < records.length; i++) {
      var show = !q || scoreRecord(q, records[i]) > 0;
      if (show) {
        records[i].li.classList.remove("is-hidden");
        n += 1;
      } else {
        records[i].li.classList.add("is-hidden");
      }
    }
    if (note) {
      if (!q) note.textContent = "点星座的名字，画面会转向它。";
      else if (!n) note.textContent = "没有找到这个星座。可以试中文名或拉丁名。";
      else note.textContent = "找到 " + n + " 个。回车转到最匹配的一个。";
    }
    return best ? best.li : null;
  }

  function markCurrent(id) {
    var rows = document.querySelectorAll("#sg-cons li");
    var i;
    for (i = 0; i < rows.length; i++) rows[i].classList.remove("is-current");
    var box = document.querySelector('#sg-cons input[data-cons="' + id + '"]');
    if (!box) return;
    var li = box.parentNode;
    while (li && li.tagName !== "LI") li = li.parentNode;
    if (li) {
      li.classList.add("is-current");
      if (li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
    }
  }

  function centerConstellation(id) {
    if (!catalog || !catalog.byId || !catalog.byId[id]) return;
    var meta = catalog.byId[id];
    var box = document.querySelector('#sg-cons input[data-cons="' + id + '"]');
    if (box && !box.checked) {
      box.checked = true;
      readFilters();
    }
    state.highlightCons = id;
    markCurrent(id);
    var lst = StarGazeAstro.lstDegrees(state.utcMs, state.lon);
    state.lst = lst;
    if (state.view === "outside") {
      var v = StarGazeAstro.equatorialVector(meta.ra, meta.dec, lst);
      state.orbitEl = Math.asin(clamp(v[2], -1, 1)) * 180 / Math.PI;
      state.orbitAz = Math.atan2(v[1], v[0]) * 180 / Math.PI;
      status("已从天球外面对准" + meta.name + "（" + meta.latin + "）。");
      return;
    }
    if (state.gyro) {
      status(meta.name + "已标出。陀螺仪开着时画面跟着手机，先关掉陀螺仪再自动转向。");
      return;
    }
    var hor = StarGazeAstro.horizontal(meta.ra, meta.dec, lst, state.lat);
    state.basis = StarGazeAstro.lookAtAltAz(hor.alt, hor.az);
    if (hor.alt < 0 && state.groundOn && state.groundAlpha > 0.95) {
      status(meta.name + "在地平线以下（高度 " + SkyCalc.formatDeg(hor.alt, 0) + "）。把地面关掉或调透明就能看到。");
    } else {
      status("已把" + meta.name + "（" + meta.latin + "）移到画面中央。");
    }
  }

  /* keepClock：改时区时，钟面上的「20:00」保持 20:00，世界时跟着改。 */
  function readPlace(keepClock) {
    var lat = parseFloat(latInput.value);
    var lon = parseFloat(lonInput.value);
    var tz = parseFloat(tzInput.value);
    if (!isFinite(lat) || lat < -90 || lat > 90) {
      status("纬度要在 −90 和 90 之间。");
      return false;
    }
    if (!isFinite(lon) || lon < -180 || lon > 180) {
      status("经度要在 −180 和 180 之间。东经为正。");
      return false;
    }
    if (!isFinite(tz) || tz < -12 || tz > 14) {
      status("时区要在 −12 和 14 小时之间。");
      return false;
    }
    var face = StarGazeAstro.localParts(state.utcMs, state.tz);
    state.lat = lat;
    state.lon = lon;
    if (keepClock && tz !== state.tz) {
      state.tz = tz;
      state.utcMs = StarGazeAstro.utcMsFromLocal(
        face.year, face.month, face.day, face.hour, face.minute, face.second, tz
      );
    } else {
      state.tz = tz;
    }
    return true;
  }

  function applyCity() {
    var opt = city.options[city.selectedIndex];
    if (!opt || opt.value === "custom") return;
    silent = true;
    latInput.value = opt.getAttribute("data-lat");
    lonInput.value = opt.getAttribute("data-lon");
    tzInput.value = opt.getAttribute("data-tz");
    silent = false;
    readPlace(true);
    status("");
  }

  function syncSpeedButtons() {
    var buttons = document.querySelectorAll("[data-speed]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var on = Number(buttons[i].getAttribute("data-speed")) === state.speed;
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function syncViewButtons() {
    $("sg-view-ground").setAttribute("aria-pressed", state.view === "ground" ? "true" : "false");
    $("sg-view-outside").setAttribute("aria-pressed", state.view === "outside" ? "true" : "false");
  }

  function syncPlay() {
    playBtn.textContent = state.playing ? "暂停" : "播放";
    playBtn.setAttribute("aria-pressed", state.playing ? "true" : "false");
  }

  function starBySky(id) {
    var i;
    for (i = 0; i < catalog.stars.length; i++) {
      if (catalog.stars[i].sky === id) return catalog.stars[i];
    }
    return null;
  }

  function describeHit(hit) {
    if (!hit) return "";
    var star = hit.star;
    var name = star.name || star.bayer || "恒星";
    var extra = star.name && star.bayer ? "（" + star.bayer + "）" : "";
    return name + extra + "  高度 " + SkyCalc.formatDeg(hit.alt, 2) +
      "  方位 " + SkyCalc.formatDeg(hit.az, 2) + "  " + SkyCalc.compass(hit.az);
  }

  function publish() {
    state.lst = StarGazeAstro.lstDegrees(state.utcMs, state.lon);
    state.catalog = catalog;
    var ctx = canvas.getContext("2d");
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    StarGazeRender.draw(ctx, w, h, state);

    var clock = StarGazeAstro.formatLocal(state.utcMs, state.tz) + "（" + StarGazeAstro.formatTz(state.tz) + "）";
    if (timeEl.textContent !== "模拟时间 " + clock) {
      timeEl.textContent = "模拟时间 " + clock;
    }
    var lstText = "地方恒星时 " + SkyCalc.formatClock(state.lst / 15);
    if (lstEl.textContent !== lstText) lstEl.textContent = lstText;

    if (state.view === "ground") {
      var look = StarGazeAstro.basisAltAz(state.basis);
      var lookText;
      if (look.alt > 82) {
        lookText = "朝向天顶附近";
      } else {
        lookText = "朝向 " + SkyCalc.compass(look.az) + "  仰角 " + SkyCalc.formatDeg(look.alt, 0);
      }
      lookEl.textContent = lookText;
    } else {
      lookEl.textContent = "从天球外面看";
    }

    starEl.textContent = describeHit(state.picked);

    var vega = starBySky("vega");
    if (vega && vegaEl) {
      var vh = StarGazeAstro.horizontal(vega.ra, vega.dec, state.lst, state.lat);
      vegaEl.innerHTML = "<strong>织女此刻</strong> 高度 " + SkyCalc.formatDeg(vh.alt, 2) +
        "，方位 " + SkyCalc.formatDeg(vh.az, 2) + "（" + SkyCalc.compass(vh.az) +
        "）。与第六课同一公式，不含岁差。";
    }

    if (document.activeElement !== timeInput) {
      var next = StarGazeAstro.formatLocalInput(state.utcMs, state.tz);
      if (timeInput.value !== next) timeInput.value = next;
    }
  }

  function pointerIds() {
    var ids = [];
    var key;
    for (key in pointers) {
      if (Object.prototype.hasOwnProperty.call(pointers, key)) ids.push(key);
    }
    return ids;
  }

  function pinchInfo() {
    var ids = pointerIds();
    if (ids.length < 2) return null;
    var a = pointers[ids[0]];
    var b = pointers[ids[1]];
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return { dist: Math.sqrt(dx * dx + dy * dy) };
  }

  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 个别浏览器在指针已经结束时会拒绝捕获，拖动仍可继续。 */
    }
    dragTotal = 0;
    if (pointerIds().length >= 2) pinch = pinchInfo();
  }

  function onPointerMove(e) {
    if (!pointers[e.pointerId]) return;
    if (pointerIds().length >= 2 && pinch) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var now = pinchInfo();
      if (now && pinch.dist > 8) {
        var ratio = now.dist / pinch.dist;
        if (state.view === "outside") {
          state.orbitDist = clamp(state.orbitDist / ratio, 1.7, 9);
        } else {
          state.zoom = clamp(state.zoom * ratio, 0.55, 6.5);
        }
        pinch = now;
      }
      return;
    }
    var prev = pointers[e.pointerId];
    var dx = e.clientX - prev.x;
    var dy = e.clientY - prev.y;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (dx === 0 && dy === 0) return;
    dragTotal += Math.abs(dx) + Math.abs(dy);
    canvas.classList.add("is-dragging");
    if (state.view === "outside") {
      state.orbitAz -= dx * 0.32;
      state.orbitEl = clamp(state.orbitEl + dy * 0.26, -75, 75);
    } else if (!state.gyro) {
      state.basis = StarGazeAstro.dragBasis(state.basis, dx, dy, state.zoom, canvas.clientWidth || 800, canvas.clientHeight || 600);
    }
  }

  function onPointerUp(e) {
    var had = pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (pointerIds().length < 2) pinch = null;
    if (pointerIds().length === 0) {
      canvas.classList.remove("is-dragging");
      if (had && dragTotal < 8) {
        var pt = canvasPoint(e);
        state.picked = StarGazeRender.hitTest(pt.x, pt.y);
        if (!state.picked) starEl.textContent = "";
      }
      dragTotal = 0;
    }
  }

  function screenAngle() {
    if (window.screen && screen.orientation && typeof screen.orientation.angle === "number") {
      return screen.orientation.angle;
    }
    if (typeof window.orientation === "number") return window.orientation;
    return 0;
  }

  function onOrient(e) {
    if (!state.gyro) return;
    if (e.absolute === false && state.gyroAbsolute) return;
    if (e.absolute === true) state.gyroAbsolute = true;
    if (e.beta == null || e.gamma == null || e.alpha == null) return;
    /*
      罗盘角（webkitCompassHeading）不要直接替换 alpha。
      手机朝南再往天顶抬时，这个读数会在南北之间跳 180°，
      写进转角后画面就跟着来回翻。orientDevice 只在读数稳定时用它修正「哪边是北」。
    */
    var compass = null;
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) {
      compass = e.webkitCompassHeading;
    }
    var pose = StarGazeAstro.orientDevice({
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      screenAngle: screenAngle(),
      compassHeading: compass
    }, state.gyroPose);
    if (!pose || !pose.basis) return;
    state.gyroSeen = true;
    state.gyroPose = pose;
    state.basis = pose.basis;
  }

  function stopGyroListen() {
    window.removeEventListener("deviceorientation", onOrient, true);
    window.removeEventListener("deviceorientationabsolute", onOrient, true);
    if (gyroTimer) {
      window.clearTimeout(gyroTimer);
      gyroTimer = 0;
    }
  }

  function setGyro(on) {
    if (!on) {
      state.gyro = false;
      state.gyroPose = null;
      stopGyroListen();
      gyroBtn.setAttribute("aria-pressed", "false");
      return;
    }
    if (state.view !== "ground") {
      status("陀螺仪只用于地面视角。先切回地面视角再打开。");
      return;
    }
    if (typeof window.DeviceOrientationEvent === "undefined") {
      status("这台浏览器没有方向传感器。请用手指拖动星图。");
      return;
    }
    function begin() {
      state.gyro = true;
      state.gyroSeen = false;
      state.gyroAbsolute = false;
      state.gyroPose = null;
      window.addEventListener("deviceorientation", onOrient, true);
      try {
        window.addEventListener("deviceorientationabsolute", onOrient, true);
      } catch (err) {
        /* 没有这个事件名时忽略，普通 deviceorientation 仍可用。 */
      }
      gyroBtn.setAttribute("aria-pressed", "true");
      status("陀螺仪已打开。把手机屏幕对着天空。");
      gyroTimer = window.setTimeout(function () {
        if (state.gyro && !state.gyroSeen) {
          setGyro(false);
          status("没有读到方向数据。这台设备可能没有传感器，请用手指拖动。");
        }
      }, 1600);
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(function (res) {
        if (res === "granted") begin();
        else status("没有获得方向传感器权限。可以继续用手指拖动星图。");
      }).catch(function () {
        status("方向传感器权限请求失败。可以继续用手指拖动星图。");
      });
    } else {
      begin();
    }
  }

  function resetView() {
    state.basis = StarGazeAstro.defaultBasis();
    state.zoom = 1;
    state.orbitAz = -42;
    state.orbitEl = 18;
    state.orbitDist = 4.2;
    state.orbitZoom = 1;
    if (state.gyro) setGyro(false);
    status("视角已重置。地面视角回到天顶，北在上方。");
  }

  function applyQuery() {
    if (typeof URLSearchParams !== "function") return;
    var q = new URLSearchParams(window.location.search);
    if (!q.toString()) return;
    if (q.get("city") && city.querySelector("option[value='" + q.get("city") + "']")) {
      city.value = q.get("city");
      applyCity();
    }
    if (q.get("lat")) latInput.value = q.get("lat");
    if (q.get("lon")) lonInput.value = q.get("lon");
    if (q.get("tz")) tzInput.value = q.get("tz");
    if (q.get("lat") || q.get("lon") || q.get("tz")) {
      if (!q.get("city")) city.value = "custom";
      readPlace(false);
    }
    if (q.get("time")) {
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(q.get("time"));
      if (m) {
        state.utcMs = StarGazeAstro.utcMsFromLocal(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0), state.tz);
      }
    }
    if (q.get("view") === "outside" || q.get("view") === "ground") {
      state.view = q.get("view");
    }
    if (q.get("zoom")) state.zoom = clamp(parseFloat(q.get("zoom")) || 1, 0.55, 6.5);
    if (q.get("look")) {
      var lookParts = q.get("look").split(",");
      var lookAlt = parseFloat(lookParts[0]);
      var lookAz = parseFloat(lookParts[1]);
      if (isFinite(lookAlt) && isFinite(lookAz)) {
        state.basis = StarGazeAstro.lookAtAltAz(lookAlt, lookAz);
      }
    }
    if (q.get("ground") != null && $("sg-ground")) {
      var g = parseFloat(q.get("ground"));
      if (isFinite(g)) {
        $("sg-ground").checked = g > 0.001;
        if ($("sg-ground-alpha")) $("sg-ground-alpha").value = String(Math.round(clamp(g, 0, 1) * 100));
      }
    }
    if (q.get("mw") != null && $("sg-mw")) {
      var mw = parseFloat(q.get("mw"));
      if (isFinite(mw)) {
        $("sg-mw").checked = mw > 0.001;
        if ($("sg-mw-alpha")) $("sg-mw-alpha").value = String(Math.round(clamp(mw, 0, 1) * 100));
      }
    }
    if (q.get("bounds") != null && $("sg-bounds")) {
      $("sg-bounds").checked = q.get("bounds") === "1";
    }
    if (q.get("names") != null && $("sg-cons-names")) {
      $("sg-cons-names").checked = q.get("names") !== "0";
    }
    if (q.get("speed")) state.speed = Number(q.get("speed")) || 1;
    if (q.get("play") === "1") state.playing = true;
    if (q.get("orbitAz")) state.orbitAz = parseFloat(q.get("orbitAz"));
    if (q.get("orbitEl")) state.orbitEl = parseFloat(q.get("orbitEl"));
    if (q.get("orbitDist")) state.orbitDist = parseFloat(q.get("orbitDist"));
    if (q.get("cons")) {
      var allow = q.get("cons").split(",");
      var boxes = document.querySelectorAll("[data-cons]");
      var i;
      for (i = 0; i < boxes.length; i++) {
        boxes[i].checked = allow.indexOf(boxes[i].getAttribute("data-cons")) !== -1;
      }
    }
    if (q.get("aster") != null) {
      var astAllow = q.get("aster") === "none" ? [] : q.get("aster").split(",");
      var ast = document.querySelectorAll("[data-aster]");
      var j;
      for (j = 0; j < ast.length; j++) {
        var id = ast[j].getAttribute("data-aster");
        ast[j].checked = q.get("aster") === "all" ? true : astAllow.indexOf(id) !== -1;
      }
    }
    readFilters();
    syncViewButtons();
    syncSpeedButtons();
    syncPlay();
  }

  function bind() {
    $("sg-form").addEventListener("submit", function (e) {
      e.preventDefault();
    });
    $("sg-view-ground").addEventListener("click", function () {
      state.view = "ground";
      syncViewButtons();
    });
    $("sg-view-outside").addEventListener("click", function () {
      state.view = "outside";
      if (state.gyro) setGyro(false);
      syncViewButtons();
    });
    $("sg-reset").addEventListener("click", resetView);

    city.addEventListener("change", applyCity);
    function onPlace() {
      if (silent) return;
      city.value = "custom";
      readPlace(true);
    }
    latInput.addEventListener("input", onPlace);
    lonInput.addEventListener("input", onPlace);
    tzInput.addEventListener("input", onPlace);

    $("sg-locate").addEventListener("click", function () {
      if (!navigator.geolocation) {
        status("这台浏览器没有定位功能，请改用城市或手填经纬度。");
        return;
      }
      status("正在请求位置…");
      navigator.geolocation.getCurrentPosition(function (pos) {
        silent = true;
        latInput.value = pos.coords.latitude.toFixed(4);
        lonInput.value = pos.coords.longitude.toFixed(4);
        /* 一月和七月里，偏西更多的那个是标准时，不含夏令时。 */
        var jan = new Date(2026, 0, 1).getTimezoneOffset();
        var jul = new Date(2026, 6, 1).getTimezoneOffset();
        var tz = -Math.max(jan, jul) / 60;
        tzInput.value = String(Math.round(tz * 2) / 2);
        city.value = "custom";
        silent = false;
        readPlace(true);
        status("已使用浏览器定位。时区用标准时，不含夏令时。");
      }, function () {
        status("没有拿到位置（可能被拒绝）。仍使用上面的经纬度。");
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    });

    playBtn.addEventListener("click", function () {
      state.playing = !state.playing;
      syncPlay();
    });
    var speeds = document.querySelectorAll("[data-speed]");
    var s;
    for (s = 0; s < speeds.length; s++) {
      speeds[s].addEventListener("click", function () {
        state.speed = Number(this.getAttribute("data-speed")) || 1;
        syncSpeedButtons();
      });
    }
    $("sg-now").addEventListener("click", function () {
      state.utcMs = Date.now();
      status("已回到现在。");
    });
    timeInput.addEventListener("change", function () {
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeInput.value);
      if (!m) return;
      state.utcMs = StarGazeAstro.utcMsFromLocal(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0), state.tz);
    });

    $("sg-cons-all").addEventListener("click", function () {
      var boxes = document.querySelectorAll("[data-cons]");
      var i;
      for (i = 0; i < boxes.length; i++) boxes[i].checked = true;
      readFilters();
    });
    $("sg-cons-none").addEventListener("click", function () {
      var boxes = document.querySelectorAll("[data-cons]");
      var i;
      for (i = 0; i < boxes.length; i++) boxes[i].checked = false;
      readFilters();
    });
    $("sg-form").addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.hasAttribute("data-cons") || t.hasAttribute("data-aster") ||
          t.id === "sg-const-lines" || t.id === "sg-horizon" ||
          t.id === "sg-grid-h" || t.id === "sg-grid-e" || t.id === "sg-labels" ||
          t.id === "sg-ground" || t.id === "sg-mw" || t.id === "sg-bounds" ||
          t.id === "sg-cons-names") {
        readFilters();
      }
    });

    gyroBtn.addEventListener("click", function () {
      setGyro(!state.gyro);
    });

    function bindRange(id, toggleId) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("input", function () {
        var box = toggleId ? $(toggleId) : null;
        if (box && !box.checked) box.checked = true;
        readFilters();
      });
    }
    bindRange("sg-ground-alpha", "sg-ground");
    bindRange("sg-mw-alpha", "sg-mw");

    var findInput = $("sg-find");
    if (findInput) {
      findInput.addEventListener("input", applySearch);
      findInput.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        var first = applySearch();
        if (!first) return;
        var jump = first.querySelector("[data-jump]");
        if (jump) centerConstellation(jump.getAttribute("data-jump"));
      });
    }
    $("sg-form").addEventListener("click", function (e) {
      var node = e.target;
      while (node && node !== $("sg-form")) {
        if (node.getAttribute && node.getAttribute("data-jump")) {
          centerConstellation(node.getAttribute("data-jump"));
          return;
        }
        node = node.parentNode;
      }
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      var factor = Math.exp(e.deltaY * 0.0012);
      if (state.view === "outside") {
        state.orbitDist = clamp(state.orbitDist * factor, 1.7, 9);
      } else {
        state.zoom = clamp(state.zoom / factor, 0.55, 6.5);
      }
    }, { passive: false });

    window.addEventListener("keydown", function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      var step = 22;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (state.view === "outside") state.orbitAz += 5;
        else if (!state.gyro) state.basis = StarGazeAstro.dragBasis(state.basis, step, 0, state.zoom, canvas.clientWidth || 800, canvas.clientHeight || 600);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (state.view === "outside") state.orbitAz -= 5;
        else if (!state.gyro) state.basis = StarGazeAstro.dragBasis(state.basis, -step, 0, state.zoom, canvas.clientWidth || 800, canvas.clientHeight || 600);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.view === "outside") state.orbitEl = clamp(state.orbitEl + 4, -75, 75);
        else if (!state.gyro) state.basis = StarGazeAstro.dragBasis(state.basis, 0, step, state.zoom, canvas.clientWidth || 800, canvas.clientHeight || 600);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (state.view === "outside") state.orbitEl = clamp(state.orbitEl - 4, -75, 75);
        else if (!state.gyro) state.basis = StarGazeAstro.dragBasis(state.basis, 0, -step, state.zoom, canvas.clientWidth || 800, canvas.clientHeight || 600);
      } else if (e.key === "+" || e.key === "=") {
        if (state.view === "outside") state.orbitDist = clamp(state.orbitDist / 1.08, 1.7, 9);
        else state.zoom = clamp(state.zoom * 1.08, 0.55, 6.5);
      } else if (e.key === "-" || e.key === "_") {
        if (state.view === "outside") state.orbitDist = clamp(state.orbitDist * 1.08, 1.7, 9);
        else state.zoom = clamp(state.zoom / 1.08, 0.55, 6.5);
      }
    });

    window.addEventListener("resize", function () {
      publish();
    });
  }

  function start() {
    canvas = $("sky");
    if (!canvas || typeof SkyCalc === "undefined") return;
    timeEl = $("sg-time");
    lstEl = $("sg-lst");
    lookEl = $("sg-look");
    starEl = $("sg-star");
    statusEl = $("sg-status");
    vegaEl = $("sg-vega");
    timeInput = $("sg-time-input");
    city = $("sg-city");
    latInput = $("sg-lat");
    lonInput = $("sg-lon");
    tzInput = $("sg-tz");
    playBtn = $("sg-play");
    gyroBtn = $("sg-gyro");

    var iau = document.body && document.body.getAttribute("data-sky") === "iau" &&
      typeof StarGazeIAU !== "undefined";
    if (iau) {
      var list = $("sg-cons");
      if (list) StarGazeIAU.fillList(list);
      catalog = StarGazeIAU.prepare();
    } else {
      catalog = StarGazeStars.prepare();
    }
    state = defaultState();
    state.catalog = catalog;
    readFilters();
    readPlace(false);
    applyQuery();
    bind();
    if (iau) {
      applySearch();
      if (catalog.meta) {
        var searchBad = selfTestSearch(catalog.meta);
        if (searchBad.length && window.console && console.error) {
          console.error("星座搜索自检失败：" + searchBad.join("；"));
        }
      }
    }
    if (typeof URLSearchParams === "function") {
      var focus = new URLSearchParams(window.location.search).get("focus");
      if (focus && catalog.byId && catalog.byId[focus]) centerConstellation(focus);
    }

    var last = 0;
    function frame(t) {
      if (!last) last = t;
      var dt = (t - last) / 1000;
      last = t;
      if (dt > 0.5) dt = 0.5;
      if (dt < 0) dt = 0;
      if (state.playing) state.utcMs += dt * 1000 * state.speed;
      publish();
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  return {
    start: start,
    /* 给核对用：页面打开后，StarGazeControls.starAltAz("vega") 返回高度和方位。 */
    starAltAz: function (skyId) {
      if (!state || !catalog) return null;
      var star = starBySky(skyId);
      if (!star) return null;
      var lst = StarGazeAstro.lstDegrees(state.utcMs, state.lon);
      var h = StarGazeAstro.horizontal(star.ra, star.dec, lst, state.lat);
      return { name: star.name, alt: h.alt, az: h.az, lst: lst, ra: star.ra, dec: star.dec };
    },
    bestMatch: bestMatch,
    selfTestSearch: selfTestSearch
  };
})();

if (typeof document !== "undefined") StarGazeControls.start();
