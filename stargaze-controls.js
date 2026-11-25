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
    if (vega) {
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
    if (e.beta == null || e.gamma == null) return;
    var alpha = e.alpha;
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) {
      alpha = 360 - e.webkitCompassHeading;
    }
    if (alpha == null || isNaN(alpha)) return;
    state.gyroSeen = true;
    var basis = StarGazeAstro.orientationBasis(alpha, e.beta, e.gamma);
    state.basis = StarGazeAstro.applyScreenAngle(basis, screenAngle());
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
        var tz = -new Date().getTimezoneOffset() / 60;
        tzInput.value = String(Math.round(tz * 2) / 2);
        city.value = "custom";
        silent = false;
        readPlace(true);
        status("已使用浏览器定位。时区按这台设备的设置。");
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
          t.id === "sg-grid-h" || t.id === "sg-grid-e" || t.id === "sg-labels") {
        readFilters();
      }
    });

    gyroBtn.addEventListener("click", function () {
      setGyro(!state.gyro);
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

    catalog = StarGazeStars.prepare();
    state = defaultState();
    state.catalog = catalog;
    readFilters();
    readPlace(false);
    applyQuery();
    bind();

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
    }
  };
})();

StarGazeControls.start();
