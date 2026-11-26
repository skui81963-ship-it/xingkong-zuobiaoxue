/*
  stargaze-render.js
  ------------------
  只负责把已经算好的天空画到画布上。不读表单，不推进时间。
  颜色、线宽、字号都从 stargazing-theme.css 的变量里取，
  所以换肤不用改这个文件。

  地面视角：人站在地上抬头看。用立体投影，天顶在默认画面的中心，
  地平线是一个圆。北在上方时，东在左边、西在右边（抬头看，和地图左右相反）。
  地平线以下的星星不画，被地面挡住。

  天球外观：人站在天球外面看一个透明的球。
  星星和赤经圈跟着地方恒星时绕北天极转，地球、观测者和地平圈不动。
  球背面的星星画淡一些，表示球是透明的，但仍能分辨前后。
*/

var StarGazeRender = (function () {
  var lastHits = [];

  function pick(cs, name, fallback) {
    var v = cs.getPropertyValue(name);
    if (!v) {
      return fallback;
    }
    v = String(v).trim();
    return v || fallback;
  }

  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    return {
      font: pick(cs, "--sg-font", "sans-serif"),
      skyTop: pick(cs, "--sg-sky-top", "#3a1a48"),
      skyBottom: pick(cs, "--sg-sky-bottom", "#100814"),
      ground: pick(cs, "--sg-ground", "#1c1010"),
      horizon: pick(cs, "--sg-horizon", "#e8b496"),
      horizonGlow: pick(cs, "--sg-horizon-glow", "rgba(232,180,150,0.35)"),
      cardinal: pick(cs, "--sg-cardinal", "#f4cdb8"),
      star: pick(cs, "--sg-star", "#fff4ec"),
      starHalo: pick(cs, "--sg-star-halo", "rgba(255,244,236,0.35)"),
      label: pick(cs, "--sg-label", "#f6ede8"),
      labelSize: pick(cs, "--sg-label-size", "12px"),
      starScale: parseFloat(pick(cs, "--sg-star-scale", "1")) || 1,
      constLine: pick(cs, "--sg-const-line", "rgba(232,200,180,0.72)"),
      constWidth: parseFloat(pick(cs, "--sg-const-line-width", "1.15")) || 1.15,
      asterWidth: parseFloat(pick(cs, "--sg-aster-line-width", "2.15")) || 2.15,
      gridAlt: pick(cs, "--sg-grid-altaz", "rgba(246,237,232,0.28)"),
      gridEq: pick(cs, "--sg-grid-eq", "rgba(142,200,196,0.4)"),
      equator: pick(cs, "--sg-equator", "#8ec8c4"),
      pole: pick(cs, "--sg-pole", "#f090b0"),
      axis: pick(cs, "--sg-axis", "rgba(240,144,176,0.85)"),
      limb: pick(cs, "--sg-sphere-limb", "rgba(246,237,232,0.45)"),
      sphereFill: pick(cs, "--sg-sphere-fill", "rgba(220,160,220,0.06)"),
      ocean: pick(cs, "--sg-earth-ocean", "#3a3a6c"),
      land: pick(cs, "--sg-earth-land", "#6d9464"),
      observer: pick(cs, "--sg-observer", "#f4cdb8"),
      backStar: parseFloat(pick(cs, "--sg-back-star", "0.28")) || 0.28,
      milky: pick(cs, "--sg-milky", "#ead6e4"),
      boundary: pick(cs, "--sg-boundary", "rgba(214, 186, 232, 0.82)"),
      boundaryWidth: parseFloat(pick(cs, "--sg-boundary-width", "0.9")) || 0.9,
      highlight: pick(cs, "--sg-highlight", "#ffd0a4"),
      highlightWidth: parseFloat(pick(cs, "--sg-highlight-width", "2.4")) || 2.4,
      consName: pick(cs, "--sg-cons-name", "#f4cdb8"),
      consNameSize: pick(cs, "--sg-cons-name-size", "13px"),
      spring: pick(cs, "--sg-spring", "#7dcea0"),
      summer: pick(cs, "--sg-summer", "#f0a0c4"),
      autumn: pick(cs, "--sg-autumn", "#f0b45a"),
      winter: pick(cs, "--sg-winter", "#8eb6f2")
    };
  }

  function asterColor(theme, aster) {
    if (aster.id === "spring") return theme.spring;
    if (aster.id === "summer") return theme.summer;
    if (aster.id === "autumn") return theme.autumn;
    return theme.winter;
  }

  function projectStereo(vec, basis, w, h, zoom) {
    var camZ = StarGazeAstro.dot(vec, basis.forward);
    var camX = StarGazeAstro.dot(vec, basis.right);
    var camY = StarGazeAstro.dot(vec, basis.up);
    /* 目光正后方附近投影会炸开，直接不画。 */
    if (camZ < -0.35) {
      return null;
    }
    var denom = 1 + camZ;
    if (denom < 0.08) {
      return null;
    }
    /* 0.40 让地平线圈落在画面内侧，上方给时间条留一点空。和 dragBasis 用同一个比例。 */
    var scale = (zoom || 1) * Math.min(w, h) * 0.40;
    var s = scale / denom;
    return {
      x: w / 2 + camX * s,
      y: h / 2 - camY * s,
      depth: camZ
    };
  }

  function starRadius(mag, cssH, theme) {
    var t = (4.8 - mag) / 6.3;
    if (t < 0.16) t = 0.16;
    if (t > 1) t = 1;
    return (0.7 + t * 3.5) * theme.starScale * (cssH / 720);
  }

  function labelText(star) {
    if (star.name) return star.name;
    return star.bayer || "";
  }

  function fontPx(theme) {
    var n = parseFloat(theme.labelSize);
    return isFinite(n) ? n : 12;
  }

  /* 大圆上的一段。先把两个单位向量按比例混合，再拉回长度 1，近似球面上的弧。 */
  function arcSamples(a, b, steps) {
    var pts = [];
    var i;
    for (i = 0; i <= steps; i++) {
      var t = i / steps;
      pts.push(StarGazeAstro.norm([
        a[0] * (1 - t) + b[0] * t,
        a[1] * (1 - t) + b[1] * t,
        a[2] * (1 - t) + b[2] * t
      ]));
    }
    return pts;
  }

  function strokeProjected(ctx, samples, project, color, width, alphaOf) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    var run = [];
    var runAlpha = null;

    function flush() {
      if (run.length < 2) {
        run = [];
        return;
      }
      ctx.globalAlpha = runAlpha == null ? 1 : runAlpha;
      ctx.beginPath();
      ctx.moveTo(run[0].x, run[0].y);
      var i;
      for (i = 1; i < run.length; i++) {
        ctx.lineTo(run[i].x, run[i].y);
      }
      ctx.stroke();
      run = [];
    }

    var i;
    for (i = 0; i < samples.length; i++) {
      var p = project(samples[i]);
      var alpha = alphaOf ? alphaOf(samples[i]) : 1;
      if (!p || (runAlpha != null && Math.abs(alpha - runAlpha) > 0.01)) {
        flush();
        runAlpha = null;
        if (!p) continue;
      }
      runAlpha = alpha;
      run.push(p);
    }
    flush();
    ctx.globalAlpha = 1;
  }

  function pointInPoly(x, y, pts) {
    var inside = false;
    var i;
    var j = pts.length - 1;
    for (i = 0; i < pts.length; i++) {
      var yi = pts[i].y;
      var yj = pts[j].y;
      var xi = pts[i].x;
      var xj = pts[j].x;
      var hit = (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
      if (hit) inside = !inside;
      j = i;
    }
    return inside;
  }

  function drawSky(ctx, w, h, basis, zoom, theme) {
    var zen = projectStereo([0, 0, 1], basis, w, h, zoom);
    var grd;
    if (zen) {
      var radius = Math.max(w, h) * 0.95;
      grd = ctx.createRadialGradient(zen.x, zen.y, radius * 0.05, zen.x, zen.y, radius);
    } else {
      grd = ctx.createLinearGradient(0, 0, 0, h);
    }
    grd.addColorStop(0, theme.skyTop);
    grd.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  /*
    地面。地平线圈若完整落在投影里，用多边形分出「天」和「地」；
    有一段转到脑后画不出来时，改用一条条向下的带子把地面铺上。
  */
  function drawGround(ctx, w, h, basis, zoom, theme, alpha) {
    if (alpha == null) alpha = 1;
    if (alpha <= 0.001) return;
    function at(alt, az) {
      return projectStereo(StarGazeAstro.enu(alt, az), basis, w, h, zoom);
    }

    var step = 3;
    var loop = [];
    var complete = true;
    var az;
    for (az = 0; az < 360; az += step) {
      var p = at(0, az);
      if (!p) {
        complete = false;
        break;
      }
      loop.push(p);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.ground;
    if (complete && loop.length > 8) {
      var centerSky = basis.forward[2] > 0;
      var inside = pointInPoly(w / 2, h / 2, loop);
      var groundOutside = (centerSky && inside) || (!centerSky && !inside);
      ctx.beginPath();
      if (groundOutside) {
        ctx.rect(0, 0, w, h);
      }
      ctx.moveTo(loop[0].x, loop[0].y);
      var i;
      for (i = 1; i < loop.length; i++) {
        ctx.lineTo(loop[i].x, loop[i].y);
      }
      ctx.closePath();
      if (groundOutside) {
        ctx.fill("evenodd");
      } else {
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    var band;
    var bands = [0, -18, -40, -65, -85];
    for (band = 0; band < bands.length - 1; band++) {
      var prevA = null;
      var prevB = null;
      for (az = 0; az <= 360; az += 4) {
        var a = at(bands[band], az);
        var b = at(bands[band + 1], az);
        if (prevA && prevB && a && b) {
          ctx.beginPath();
          ctx.moveTo(prevA.x, prevA.y);
          ctx.lineTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(prevB.x, prevB.y);
          ctx.closePath();
          ctx.fill();
        }
        prevA = a;
        prevB = b;
      }
    }
    ctx.restore();
  }

  function drawHorizonLine(ctx, w, h, basis, zoom, theme) {
    var pts = [];
    var az;
    for (az = 0; az <= 360; az += 3) {
      pts.push(projectStereo(StarGazeAstro.enu(0, az), basis, w, h, zoom));
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = theme.horizonGlow;
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    var started = false;
    var i;
    for (i = 0; i < pts.length; i++) {
      if (!pts[i]) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(pts[i].x, pts[i].y);
        started = true;
      } else {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = theme.horizon;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawCardinals(ctx, w, h, basis, zoom, theme) {
    var marks = [
      { az: 0, text: "北" },
      { az: 90, text: "东" },
      { az: 180, text: "南" },
      { az: 270, text: "西" }
    ];
    ctx.fillStyle = theme.cardinal;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = Math.round(fontPx(theme) * 1.35) + "px " + theme.font;
    var i;
    for (i = 0; i < marks.length; i++) {
      /* 字放在地平线稍上的天空里，避免被地面盖住。 */
      var p = projectStereo(StarGazeAstro.enu(5, marks[i].az), basis, w, h, zoom);
      if (!p) continue;
      if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue;
      ctx.fillText(marks[i].text, p.x, p.y);
    }
  }

  function drawAltAzGrid(ctx, w, h, basis, zoom, theme, minAlt) {
    if (minAlt == null) minAlt = 0;
    ctx.save();
    ctx.strokeStyle = theme.gridAlt;
    ctx.lineWidth = 1;
    var alts = minAlt < 0 ? [-30, 30, 60] : [30, 60];
    var a;
    for (a = 0; a < alts.length; a++) {
      ctx.beginPath();
      var started = false;
      var az;
      for (az = 0; az <= 360; az += 4) {
        var p = projectStereo(StarGazeAstro.enu(alts[a], az), basis, w, h, zoom);
        if (!p) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
    var azLines = [0, 45, 90, 135, 180, 225, 270, 315];
    var z;
    for (z = 0; z < azLines.length; z++) {
      ctx.beginPath();
      started = false;
      var alt;
      for (alt = minAlt; alt <= 88; alt += 3) {
        var q = projectStereo(StarGazeAstro.enu(alt, azLines[z]), basis, w, h, zoom);
        if (!q) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(q.x, q.y);
          started = true;
        } else {
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEquatorGridGround(ctx, w, h, basis, zoom, theme, lst, lat, minAlt) {
    if (minAlt == null) minAlt = -1;
    ctx.save();
    ctx.lineWidth = 1;
    var decs = [-60, -30, 0, 30, 60, 75];
    var d;
    for (d = 0; d < decs.length; d++) {
      ctx.strokeStyle = decs[d] === 0 ? theme.equator : theme.gridEq;
      ctx.beginPath();
      var started = false;
      var ra;
      for (ra = 0; ra <= 360; ra += 4) {
        var hor = StarGazeAstro.horizontal(ra, decs[d], lst, lat);
        var p = null;
        if (hor.alt > minAlt) {
          p = projectStereo(StarGazeAstro.enu(hor.alt, hor.az), basis, w, h, zoom);
        }
        if (!p) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
    var hour;
    for (hour = 0; hour < 360; hour += 30) {
      ctx.strokeStyle = theme.gridEq;
      ctx.beginPath();
      started = false;
      var dec;
      for (dec = -80; dec <= 80; dec += 3) {
        var hor2 = StarGazeAstro.horizontal(hour, dec, lst, lat);
        var q = null;
        if (hor2.alt > minAlt) {
          q = projectStereo(StarGazeAstro.enu(hor2.alt, hor2.az), basis, w, h, zoom);
        }
        if (!q) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(q.x, q.y);
          started = true;
        } else {
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function shownStarMap(catalog, state) {
    var map = {};
    var list = [];
    var i;
    for (i = 0; i < catalog.stars.length; i++) {
      var star = catalog.stars[i];
      if (!catalog.isShown(star, state.consOn, state.astOn)) continue;
      var hor = StarGazeAstro.horizontal(star.ra, star.dec, state.lst, state.lat);
      var rec = {
        star: star,
        alt: hor.alt,
        az: hor.az,
        ha: hor.ha,
        enu: StarGazeAstro.enu(hor.alt, hor.az),
        eq: StarGazeAstro.equatorialVector(star.ra, star.dec, state.lst)
      };
      map[star.hip] = rec;
      list.push(rec);
    }
    return { map: map, list: list };
  }

  function drawStarDots(ctx, placed, theme, cssH) {
    var i;
    for (i = 0; i < placed.length; i++) {
      var item = placed[i];
      var r = starRadius(item.star.mag, cssH, theme);
      item.r = r;
      ctx.globalAlpha = item.alpha == null ? 1 : item.alpha;
      if (item.star.mag < 1.6) {
        ctx.fillStyle = theme.starHalo;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r * 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = theme.star;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels(ctx, placed, theme, w, h, state) {
    if (!state.showLabels) return;
    var checked = 0;
    var key;
    for (key in state.consOn) {
      if (state.consOn[key]) checked += 1;
    }
    var limit = 2.55;
    if (state.zoom > 1.7) limit = 3.5;
    if (state.zoom > 2.6) limit = 4.8;
    if (checked > 0 && checked <= 2) limit = 5.6;
    /* 88 个星座一起开着时，拜耳名会和星座名叠在一起。只留较亮的中文星名。 */
    var famousOnly = !!(state.catalog && state.catalog.meta) && checked > 8 && state.zoom < 2.2;
    ctx.fillStyle = theme.label;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.font = fontPx(theme) + "px " + theme.font;
    var boxes = [];
    /* 亮星先占位置，暗星的名字让开。 */
    var ordered = placed.slice().sort(function (a, b) {
      return a.star.mag - b.star.mag;
    });
    var i;
    for (i = 0; i < ordered.length; i++) {
      var item = ordered[i];
      if (item.star.mag > limit) continue;
      if (famousOnly && (!item.star.name || item.star.mag > 1.8)) continue;
      var text = labelText(item.star);
      if (!text) continue;
      var tw = ctx.measureText(text).width;
      var th = fontPx(theme) + 2;
      var x = item.x + item.r + 2;
      var y = item.y - 2;
      if (x + tw > w - 2 || y - th < 2) continue;
      var box = { x: x, y: y - th, w: tw, h: th };
      var blocked = false;
      var b;
      for (b = 0; b < boxes.length; b++) {
        var o = boxes[b];
        if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      boxes.push(box);
      ctx.globalAlpha = item.alpha == null ? 0.92 : Math.min(0.92, item.alpha + 0.25);
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function lineStyle(theme, state, cons) {
    if (state.highlightCons && cons === state.highlightCons) {
      return { color: theme.highlight, width: theme.highlightWidth };
    }
    return { color: theme.constLine, width: theme.constWidth };
  }

  function drawConstLines(ctx, map, project, theme, state, aboveOnly, clipHorizon) {
    if (!state.showConstLines) return;
    if (clipHorizon == null) clipHorizon = !!aboveOnly;
    var lines = state.catalog.lines;
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!state.consOn[line.cons]) continue;
      var a = map[line.a];
      var b = map[line.b];
      if (!a || !b) continue;
      var style = lineStyle(theme, state, line.cons);
      var samples = arcSamples(aboveOnly ? a.enu : a.eq, aboveOnly ? b.enu : b.eq, 5);
      if (clipHorizon) {
        var kept = [];
        var s;
        for (s = 0; s < samples.length; s++) {
          if (samples[s][2] >= -0.01) kept.push(samples[s]);
          else kept.push(null);
        }
        /* null 会把折线断开。strokeProjected 只接受向量，这里改成逐段画。 */
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        var started = false;
        for (s = 0; s < samples.length; s++) {
          if (samples[s][2] < -0.01) {
            started = false;
            continue;
          }
          var p = project(samples[s]);
          if (!p) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
      } else {
        strokeProjected(ctx, samples, project, style.color, style.width, null);
      }
    }
  }

  function drawAsterLines(ctx, map, project, theme, state, aboveOnly, alphaOf, clipHorizon) {
    var list = state.catalog.asterisms || [];
    if (clipHorizon == null) clipHorizon = !!aboveOnly;
    var i;
    for (i = 0; i < list.length; i++) {
      var aster = list[i];
      if (!state.astOn[aster.id]) continue;
      var color = asterColor(theme, aster);
      var k;
      for (k = 0; k < aster.loop.length; k++) {
        var a = map[aster.loop[k]];
        var b = map[aster.loop[(k + 1) % aster.loop.length]];
        if (!a || !b) continue;
        var samples = arcSamples(aboveOnly ? a.enu : a.eq, aboveOnly ? b.enu : b.eq, 10);
        if (clipHorizon) {
          ctx.strokeStyle = color;
          ctx.lineWidth = theme.asterWidth;
          ctx.lineCap = "round";
          ctx.beginPath();
          var started = false;
          var s;
          for (s = 0; s < samples.length; s++) {
            if (samples[s][2] < -0.01) {
              started = false;
              continue;
            }
            var p = project(samples[s]);
            if (!p) {
              started = false;
              continue;
            }
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
        } else {
          strokeProjected(ctx, samples, project, color, theme.asterWidth, alphaOf);
        }
      }
    }
  }

  /* 没打开「地面透明」时按不透明算，虚拟观星的画面和原来一样。 */
  function resolveGroundAlpha(state) {
    if (state.groundOn === false) return 0;
    if (typeof state.groundAlpha === "number" && isFinite(state.groundAlpha)) {
      if (state.groundAlpha <= 0) return 0;
      if (state.groundAlpha >= 1) return 1;
      return state.groundAlpha;
    }
    return 1;
  }

  function boundsOn(edge, state) {
    var i;
    for (i = 0; i < edge.cons.length; i++) {
      if (state.consOn[edge.cons[i]]) return true;
    }
    return false;
  }

  function strokeScreen(ctx, pts, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    var started = false;
    var i;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!p) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  function jumpTooFar(a, b, limit) {
    if (!a || !b) return false;
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return dx * dx + dy * dy > limit * limit;
  }

  /* 赤道坐标里的向量，换成地面上的东、北、上。和 horizontal + enu 是同一套方向。 */
  function eqToEnu(eq, latDeg) {
    var lat = latDeg * Math.PI / 180;
    var sp = Math.sin(lat);
    var cp = Math.cos(lat);
    return [-eq[1], -sp * eq[0] + cp * eq[2], cp * eq[0] + sp * eq[2]];
  }

  /*
    银河沿银道画成一条光带：北缘和南缘之间填色，中间更亮。
    屏幕上的宽度有上限，投影被拉得很长时这一小段断开，避免甩出楔形。
  */
  function milkyEnds(sample, lst) {
    var north = StarGazeAstro.equatorialVector(sample[0], sample[1], lst);
    var south = StarGazeAstro.equatorialVector(sample[2], sample[3], lst);
    var mid = StarGazeAstro.norm([
      north[0] + south[0], north[1] + south[1], north[2] + south[2]
    ]);
    return { north: north, south: south, mid: mid, glow: sample[4] };
  }

  /*
    把北缘、南缘收到不超过 maxW 的宽度，再填成一条带子。
    圆头粗线会在地平附近叠成一节一节的珠子，所以这里用四边形填充。
  */
  function capBand(nP, sP, maxW) {
    if (!nP || !sP) return null;
    var dx = sP.x - nP.x;
    var dy = sP.y - nP.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    var half = Math.min(len, maxW) / 2;
    var mx = (nP.x + sP.x) / 2;
    var my = (nP.y + sP.y) / 2;
    var ux = dx / len;
    var uy = dy / len;
    return {
      n: { x: mx - ux * half, y: my - uy * half },
      s: { x: mx + ux * half, y: my + uy * half },
      mid: { x: mx, y: my }
    };
  }

  /* 把颜色收成透明边，让银河带子两侧淡出时仍跟主题色一致。 */
  function transparentOf(color) {
    var m = String(color).trim();
    var h, r, g, b, rgb;
    if (m.charAt(0) === "#") {
      h = m.slice(1);
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
      return "rgba(" + r + "," + g + "," + b + ",0)";
    }
    rgb = m.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (rgb) return "rgba(" + rgb[1] + "," + rgb[2] + "," + rgb[3] + ",0)";
    return "rgba(234,214,228,0)";
  }

  function fillMilkyQuad(ctx, a, b, alpha, color) {
    var edge = transparentOf(color);
    var grd = ctx.createLinearGradient(a.n.x, a.n.y, a.s.x, a.s.y);
    grd.addColorStop(0, edge);
    grd.addColorStop(0.5, color);
    grd.addColorStop(1, edge);
    ctx.fillStyle = grd;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(a.n.x, a.n.y);
    ctx.lineTo(b.n.x, b.n.y);
    ctx.lineTo(b.s.x, b.s.y);
    ctx.lineTo(a.s.x, a.s.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawMilkyGround(ctx, w, h, basis, zoom, theme, state) {
    var mw = state.catalog && state.catalog.milky;
    var alpha = state.milkyAlpha;
    if (!mw || !state.showMilkyWay || !(alpha > 0)) return;
    ctx.save();
    var prev = null;
    var limit = Math.min(w, h) * 0.22;
    var maxW = Math.min(w, h) * 0.11;
    var i;
    for (i = 0; i < mw.length; i++) {
      var ends = milkyEnds(mw[i], state.lst);
      var band = capBand(
        projectStereo(eqToEnu(ends.north, state.lat), basis, w, h, zoom),
        projectStereo(eqToEnu(ends.south, state.lat), basis, w, h, zoom),
        maxW
      );
      if (band && prev && !jumpTooFar(prev.mid, band.mid, limit) &&
          !jumpTooFar(prev.n, band.n, limit) && !jumpTooFar(prev.s, band.s, limit)) {
        fillMilkyQuad(ctx, prev, band, alpha * (0.5 * (prev.glow + ends.glow)), theme.milky);
      }
      prev = band ? { n: band.n, s: band.s, mid: band.mid, glow: ends.glow } : null;
    }
    ctx.restore();
  }

  function drawMilkyOutside(ctx, w, h, cam, state, theme) {
    var mw = state.catalog && state.catalog.milky;
    var alpha = state.milkyAlpha;
    if (!mw || !state.showMilkyWay || !(alpha > 0)) return;
    ctx.save();
    var prev = null;
    var limit = Math.min(w, h) * 0.18;
    var maxW = Math.min(w, h) * 0.09;
    var i;
    for (i = 0; i < mw.length; i++) {
      var ends = milkyEnds(mw[i], state.lst);
      var front = facingCamera(ends.mid, cam);
      var band = capBand(
        projectOutside(ends.north, cam, w, h),
        projectOutside(ends.south, cam, w, h),
        maxW
      );
      if (band && prev && prev.front === front && !jumpTooFar(prev.mid, band.mid, limit) &&
          !jumpTooFar(prev.n, band.n, limit) && !jumpTooFar(prev.s, band.s, limit)) {
        var fade = front ? 1 : theme.backStar;
        fillMilkyQuad(ctx, prev, band, alpha * fade * (0.5 * (prev.glow + ends.glow)), theme.milky);
      }
      prev = band ? { n: band.n, s: band.s, mid: band.mid, glow: ends.glow, front: front } : null;
    }
    ctx.restore();
  }

  function drawBoundsGround(ctx, w, h, basis, zoom, theme, state, seeBelow) {
    var edges = state.catalog && state.catalog.bounds;
    if (!state.showBounds || !edges) return;
    var limit = Math.min(w, h) * 0.7;
    var i, k;
    for (i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!boundsOn(edge, state)) continue;
      var hi = state.highlightCons && edge.cons.indexOf(state.highlightCons) !== -1;
      var pts = [];
      var prev = null;
      for (k = 0; k < edge.pts.length; k++) {
        var hor = StarGazeAstro.horizontal(edge.pts[k][0], edge.pts[k][1], state.lst, state.lat);
        var p = null;
        if (seeBelow || hor.alt > -0.4) {
          p = projectStereo(StarGazeAstro.enu(hor.alt, hor.az), basis, w, h, zoom);
        }
        if (p && prev && jumpTooFar(prev, p, limit)) pts.push(null);
        pts.push(p);
        if (p) prev = p;
      }
      strokeScreen(ctx, pts, hi ? theme.highlight : theme.boundary, hi ? theme.boundaryWidth * 1.8 : theme.boundaryWidth);
    }
  }

  function drawBoundsOutside(ctx, w, h, cam, state, theme) {
    var edges = state.catalog && state.catalog.bounds;
    if (!state.showBounds || !edges) return;
    function project(vec) {
      return projectOutside(vec, cam, w, h);
    }
    function alphaOf(vec) {
      return facingCamera(vec, cam) ? 1 : 0.35;
    }
    var i, k;
    for (i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!boundsOn(edge, state)) continue;
      var hi = state.highlightCons && edge.cons.indexOf(state.highlightCons) !== -1;
      var samples = [];
      for (k = 0; k < edge.pts.length; k++) {
        samples.push(StarGazeAstro.equatorialVector(edge.pts[k][0], edge.pts[k][1], state.lst));
      }
      strokeProjected(
        ctx, samples, project,
        hi ? theme.highlight : theme.boundary,
        hi ? theme.boundaryWidth * 1.8 : theme.boundaryWidth,
        alphaOf
      );
    }
  }

  /* 星座名写在棍棒图的中间。挤在一起的名字让开，正在定位的那一个始终画出来。 */
  function drawConsNames(ctx, w, h, state, theme, projectRaDec) {
    if (!state.showConsNames || !state.catalog || !state.catalog.meta) return;
    var meta = state.catalog.meta;
    var size = parseFloat(theme.consNameSize);
    if (!isFinite(size)) size = 13;
    ctx.save();
    ctx.font = Math.round(size) + "px " + theme.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (state.highlightCons && state.consOn[state.highlightCons]) {
      var hc = null;
      var n;
      for (n = 0; n < meta.length; n++) {
        if (meta[n].id === state.highlightCons) hc = meta[n];
      }
      if (hc) {
        var hp = projectRaDec(hc.ra, hc.dec);
        if (hp && hp.x >= -10 && hp.y >= -10 && hp.x <= w + 10 && hp.y <= h + 10) {
          ctx.strokeStyle = theme.highlight;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = hp.alpha == null ? 0.95 : hp.alpha;
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    var items = [];
    var i, k;
    for (i = 0; i < meta.length; i++) {
      var c = meta[i];
      if (!state.consOn[c.id]) continue;
      var labels = c.labels && c.labels.length ? c.labels : [{ ra: c.ra, dec: c.dec }];
      for (k = 0; k < labels.length; k++) {
        var p = projectRaDec(labels[k].ra, labels[k].dec);
        if (!p) continue;
        if (p.x < 6 || p.y < 6 || p.x > w - 6 || p.y > h - 6) continue;
        items.push({ c: c, p: p, hi: state.highlightCons === c.id });
      }
    }
    items.sort(function (a, b) {
      var da = (a.p.x - w / 2) * (a.p.x - w / 2) + (a.p.y - h / 2) * (a.p.y - h / 2);
      var db = (b.p.x - w / 2) * (b.p.x - w / 2) + (b.p.y - h / 2) * (b.p.y - h / 2);
      return da - db;
    });
    var boxes = [];
    function drawOne(item, force) {
      var text = item.c.name;
      var tw = ctx.measureText(text).width;
      var th = size + 2;
      var box = { x: item.p.x - tw / 2 - 4, y: item.p.y - th / 2 - 3, w: tw + 8, h: th + 6 };
      if (!force) {
        var b;
        for (b = 0; b < boxes.length; b++) {
          var o = boxes[b];
          if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) return;
        }
      }
      boxes.push(box);
      ctx.globalAlpha = item.p.alpha == null ? 0.95 : Math.max(0.4, item.p.alpha);
      ctx.fillStyle = item.hi ? theme.highlight : theme.consName;
      ctx.fillText(text, item.p.x, item.p.y);
    }
    var hiItems = [];
    for (i = 0; i < items.length; i++) {
      if (items[i].hi) hiItems.push(items[i]);
    }
    /* 先占住正在定位的名字，别的名字让开，避免盖住高亮。 */
    for (i = 0; i < hiItems.length; i++) drawOne(hiItems[i], true);
    for (i = 0; i < items.length; i++) {
      if (!items[i].hi) drawOne(items[i], false);
    }
    ctx.restore();
  }

  function placeStars(built, project, seeBelow, w, h) {
    var placed = [];
    var i;
    for (i = 0; i < built.list.length; i++) {
      var item = built.list[i];
      if (!seeBelow && item.alt < 0) continue;
      var p = project(item.enu);
      if (!p) continue;
      if (p.x < -30 || p.y < -30 || p.x > w + 30 || p.y > h + 30) continue;
      placed.push({
        star: item.star,
        x: p.x,
        y: p.y,
        alt: item.alt,
        az: item.az,
        alpha: 1
      });
    }
    return placed;
  }

  function drawGroundView(ctx, w, h, state, theme) {
    var basis = state.basis;
    var zoom = state.zoom;
    var gAlpha = resolveGroundAlpha(state);
    var seeBelow = gAlpha < 0.999;
    drawSky(ctx, w, h, basis, zoom, theme);
    if (state.showMilkyWay) drawMilkyGround(ctx, w, h, basis, zoom, theme, state);
    if (state.showEquatorGrid) {
      drawEquatorGridGround(ctx, w, h, basis, zoom, theme, state.lst, state.lat, seeBelow ? -89 : -1);
    }
    if (state.showHorizonGrid) {
      drawAltAzGrid(ctx, w, h, basis, zoom, theme, seeBelow ? -75 : 0);
    }

    var built = shownStarMap(state.catalog, state);
    function project(vec) {
      return projectStereo(vec, basis, w, h, zoom);
    }
    function projectRaDec(ra, dec) {
      var hor = StarGazeAstro.horizontal(ra, dec, state.lst, state.lat);
      if (!seeBelow && hor.alt < 0) return null;
      var p = projectStereo(StarGazeAstro.enu(hor.alt, hor.az), basis, w, h, zoom);
      return p;
    }

    if (!seeBelow) {
      drawGround(ctx, w, h, basis, zoom, theme, 1);
      if (state.showHorizon) {
        drawHorizonLine(ctx, w, h, basis, zoom, theme);
        drawCardinals(ctx, w, h, basis, zoom, theme);
      }
      if (state.showBounds) drawBoundsGround(ctx, w, h, basis, zoom, theme, state, false);
      drawConstLines(ctx, built.map, project, theme, state, true);
      drawAsterLines(ctx, built.map, project, theme, state, true, null);
      var placed = placeStars(built, project, false, w, h);
      drawStarDots(ctx, placed, theme, h);
      drawLabels(ctx, placed, theme, w, h, state);
      drawConsNames(ctx, w, h, state, theme, projectRaDec);
      lastHits = placed;
      return;
    }

    if (state.showBounds) drawBoundsGround(ctx, w, h, basis, zoom, theme, state, true);
    drawConstLines(ctx, built.map, project, theme, state, true, false);
    drawAsterLines(ctx, built.map, project, theme, state, true, null, false);
    var placedBelow = placeStars(built, project, true, w, h);
    drawStarDots(ctx, placedBelow, theme, h);
    drawGround(ctx, w, h, basis, zoom, theme, gAlpha);
    if (state.showHorizon) {
      drawHorizonLine(ctx, w, h, basis, zoom, theme);
      drawCardinals(ctx, w, h, basis, zoom, theme);
    }
    drawLabels(ctx, placedBelow, theme, w, h, state);
    drawConsNames(ctx, w, h, state, theme, projectRaDec);
    lastHits = placedBelow;
  }

  function outsideCamera(state) {
    var el = state.orbitEl * Math.PI / 180;
    var az = state.orbitAz * Math.PI / 180;
    var dist = state.orbitDist;
    var pos = [
      dist * Math.cos(el) * Math.cos(az),
      dist * Math.cos(el) * Math.sin(az),
      dist * Math.sin(el)
    ];
    var forward = StarGazeAstro.norm(StarGazeAstro.scale(pos, -1));
    /* 屏幕上方尽量朝北天极，避免默认把北极画在画面下方。 */
    var upRef = Math.abs(forward[2]) > 0.92 ? [0, 1, 0] : [0, 0, 1];
    var right = StarGazeAstro.norm(StarGazeAstro.cross(forward, upRef));
    var up = StarGazeAstro.norm(StarGazeAstro.cross(right, forward));
    /* 垂直张角大约 46°。默认距离下，天球连同极点的字都能落在画面里。 */
    var fov = 46 * Math.PI / 180;
    return { pos: pos, forward: forward, right: right, up: up, fov: fov, zoom: state.orbitZoom || 1 };
  }

  function projectOutside(vec, cam, w, h) {
    var rel = [vec[0] - cam.pos[0], vec[1] - cam.pos[1], vec[2] - cam.pos[2]];
    var depth = StarGazeAstro.dot(rel, cam.forward);
    if (depth < 0.08) return null;
    var x = StarGazeAstro.dot(rel, cam.right);
    var y = StarGazeAstro.dot(rel, cam.up);
    var focal = (h / 2) / Math.tan(cam.fov / 2) * cam.zoom;
    return {
      x: w / 2 + (x / depth) * focal,
      y: h / 2 - (y / depth) * focal,
      depth: depth
    };
  }

  function facingCamera(vec, cam) {
    return StarGazeAstro.dot(vec, cam.pos) >= 0;
  }

  function drawSphereLimb(ctx, w, h, cam, theme) {
    var dir = StarGazeAstro.norm(cam.pos);
    var helper = Math.abs(dir[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    var u = StarGazeAstro.norm(StarGazeAstro.cross(dir, helper));
    var v = StarGazeAstro.cross(dir, u);
    ctx.beginPath();
    var i;
    for (i = 0; i <= 72; i++) {
      var ang = i / 72 * Math.PI * 2;
      var p = [
        u[0] * Math.cos(ang) + v[0] * Math.sin(ang),
        u[1] * Math.cos(ang) + v[1] * Math.sin(ang),
        u[2] * Math.cos(ang) + v[2] * Math.sin(ang)
      ];
      var s = projectOutside(p, cam, w, h);
      if (!s) continue;
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fillStyle = theme.sphereFill;
    ctx.fill();
    ctx.strokeStyle = theme.limb;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  function drawOutsideGuides(ctx, w, h, cam, state, theme) {
    function project(vec) {
      return projectOutside(vec, cam, w, h);
    }
    function alphaOf(vec) {
      return facingCamera(vec, cam) ? 1 : 0.35;
    }

    /* 极轴。北天极、南天极不随恒星时移动。 */
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1.2;
    var axisSamples = [];
    var t;
    for (t = -1.08; t <= 1.08; t += 0.08) {
      axisSamples.push([0, 0, t]);
    }
    strokeProjected(ctx, axisSamples, project, theme.axis, 1.2, alphaOf);

    /* 天赤道，比其他赤纬圈更醒目。 */
    var eq = [];
    var ang;
    for (ang = 0; ang <= 360; ang += 4) {
      var rad = ang * Math.PI / 180;
      eq.push([Math.cos(rad), Math.sin(rad), 0]);
    }
    strokeProjected(ctx, eq, project, theme.equator, 1.8, alphaOf);

    if (state.showEquatorGrid) {
      var decs = [-60, -30, 30, 60];
      var d;
      for (d = 0; d < decs.length; d++) {
        var ring = [];
        var dec = decs[d] * Math.PI / 180;
        for (ang = 0; ang <= 360; ang += 5) {
          var ha = ang * Math.PI / 180;
          ring.push([Math.cos(dec) * Math.cos(ha), Math.cos(dec) * Math.sin(ha), Math.sin(dec)]);
        }
        strokeProjected(ctx, ring, project, theme.gridEq, 1, alphaOf);
      }
      var hour;
      for (hour = 0; hour < 12; hour++) {
        var raLine = [];
        var decDeg;
        for (decDeg = -80; decDeg <= 80; decDeg += 4) {
          /* 赤经圈跟着恒星时转：这里的角度是时角，固定赤经 = 恒星时 − 时角。 */
          var ra = hour * 30;
          raLine.push(StarGazeAstro.equatorialVector(ra, decDeg, state.lst));
        }
        strokeProjected(ctx, raLine, project, theme.gridEq, 1, alphaOf);
      }
    }

    /* 地平圈钉在观测者身上，不跟星星一起转。 */
    var zen = StarGazeAstro.zenithVector(state.lat);
    var helper = Math.abs(zen[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    var u = StarGazeAstro.norm(StarGazeAstro.cross(zen, helper));
    var v = StarGazeAstro.cross(zen, u);
    var horizon = [];
    for (ang = 0; ang <= 360; ang += 4) {
      var radH = ang * Math.PI / 180;
      horizon.push([
        u[0] * Math.cos(radH) + v[0] * Math.sin(radH),
        u[1] * Math.cos(radH) + v[1] * Math.sin(radH),
        u[2] * Math.cos(radH) + v[2] * Math.sin(radH)
      ]);
    }
    if (state.showHorizon) {
      strokeProjected(ctx, horizon, project, theme.horizon, 1.6, alphaOf);
    }
    if (state.showHorizonGrid) {
      /* 高度圈：和天顶夹固定角的小圆。 */
      var alts = [30, 60];
      var ai;
      for (ai = 0; ai < alts.length; ai++) {
        var delta = (90 - alts[ai]) * Math.PI / 180;
        var ringA = [];
        for (ang = 0; ang <= 360; ang += 6) {
          var radA = ang * Math.PI / 180;
          var horiz = [
            u[0] * Math.cos(radA) + v[0] * Math.sin(radA),
            u[1] * Math.cos(radA) + v[1] * Math.sin(radA),
            u[2] * Math.cos(radA) + v[2] * Math.sin(radA)
          ];
          ringA.push(StarGazeAstro.norm([
            zen[0] * Math.cos(delta) + horiz[0] * Math.sin(delta),
            zen[1] * Math.cos(delta) + horiz[1] * Math.sin(delta),
            zen[2] * Math.cos(delta) + horiz[2] * Math.sin(delta)
          ]));
        }
        strokeProjected(ctx, ringA, project, theme.gridAlt, 1, alphaOf);
      }
    }

    function putLabel(vec, text, color) {
      if (!facingCamera(vec, cam) && StarGazeAstro.dot(vec, cam.pos) < -0.15) {
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalAlpha = 1;
      }
      var p = project(vec);
      if (!p) {
        ctx.globalAlpha = 1;
        return;
      }
      ctx.fillStyle = color;
      ctx.fillText(text, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    ctx.font = Math.round(fontPx(theme) * 1.15) + "px " + theme.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    putLabel([0, 0, 1.12], "北天极", theme.pole);
    putLabel([0, 0, -1.12], "南天极", theme.pole);
    putLabel([1.12, 0, 0], "天赤道", theme.equator);

    if (state.showHorizon) {
      var lat = state.lat * Math.PI / 180;
      var north = [-Math.sin(lat), 0, Math.cos(lat)];
      var south = [Math.sin(lat), 0, -Math.cos(lat)];
      var east = [0, -1, 0];
      var west = [0, 1, 0];
      ctx.font = Math.round(fontPx(theme) * 1.2) + "px " + theme.font;
      putLabel(StarGazeAstro.scale(north, 1.08), "北", theme.cardinal);
      putLabel(StarGazeAstro.scale(east, 1.08), "东", theme.cardinal);
      putLabel(StarGazeAstro.scale(south, 1.08), "南", theme.cardinal);
      putLabel(StarGazeAstro.scale(west, 1.08), "西", theme.cardinal);
    }

    /* 极点上的小圆点。 */
    var ncp = project([0, 0, 1]);
    var scp = project([0, 0, -1]);
    ctx.fillStyle = theme.pole;
    if (ncp) {
      ctx.beginPath();
      ctx.arc(ncp.x, ncp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (scp) {
      ctx.globalAlpha = facingCamera([0, 0, -1], cam) ? 1 : 0.4;
      ctx.beginPath();
      ctx.arc(scp.x, scp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawEarth(ctx, w, h, cam, state, theme) {
    var origin = projectOutside([0, 0, 0], cam, w, h);
    if (!origin) return;
    var edge = projectOutside(StarGazeAstro.scale(cam.right, 0.13), cam, w, h);
    if (!edge) return;
    var pr = Math.sqrt((edge.x - origin.x) * (edge.x - origin.x) + (edge.y - origin.y) * (edge.y - origin.y));
    ctx.fillStyle = theme.ocean;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, pr, 0, Math.PI * 2);
    ctx.fill();

    /* 地球赤道和天赤道在同一个平面上，只是半径小得多。 */
    ctx.beginPath();
    var ang;
    var started = false;
    for (ang = 0; ang <= 360; ang += 12) {
      var rad = ang * Math.PI / 180;
      var p = projectOutside([0.13 * Math.cos(rad), 0.13 * Math.sin(rad), 0], cam, w, h);
      if (!p) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.strokeStyle = theme.land;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    var zen = StarGazeAstro.zenithVector(state.lat);
    var obs = projectOutside(StarGazeAstro.scale(zen, 0.13), cam, w, h);
    var tip = projectOutside(StarGazeAstro.scale(zen, 0.42), cam, w, h);
    if (obs && tip) {
      ctx.strokeStyle = theme.observer;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
    if (obs) {
      ctx.fillStyle = theme.observer;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.cardinal;
      ctx.font = fontPx(theme) + "px " + theme.font;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("观测者", obs.x + 6, obs.y);
    }
  }

  function drawOutsideView(ctx, w, h, state, theme) {
    var cam = outsideCamera(state);
    ctx.fillStyle = theme.skyBottom;
    ctx.fillRect(0, 0, w, h);
    drawSphereLimb(ctx, w, h, cam, theme);
    if (state.showMilkyWay) drawMilkyOutside(ctx, w, h, cam, state, theme);

    var built = shownStarMap(state.catalog, state);
    function project(vec) {
      return projectOutside(vec, cam, w, h);
    }
    function alphaOf(vec) {
      return facingCamera(vec, cam) ? 1 : theme.backStar;
    }

    /* 先画背面的连线和星，再画正面，透明球才分得清前后。 */
    function drawLines(frontPass) {
      ctx.save();
      var lines = state.catalog.lines;
      var i;
      if (state.showConstLines) {
        ctx.lineCap = "round";
        for (i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!state.consOn[line.cons]) continue;
          var a = built.map[line.a];
          var b = built.map[line.b];
          if (!a || !b) continue;
          var style = lineStyle(theme, state, line.cons);
          ctx.strokeStyle = style.color;
          ctx.lineWidth = style.width;
          var samples = arcSamples(a.eq, b.eq, 4);
          var s;
          ctx.beginPath();
          var started = false;
          ctx.globalAlpha = frontPass ? 0.95 : theme.backStar;
          for (s = 0; s < samples.length; s++) {
            var front = facingCamera(samples[s], cam);
            if (front !== frontPass) {
              started = false;
              continue;
            }
            var p = project(samples[s]);
            if (!p) {
              started = false;
              continue;
            }
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
        }
      }
      var asters = state.catalog.asterisms || [];
      for (i = 0; i < asters.length; i++) {
        var aster = asters[i];
        if (!state.astOn[aster.id]) continue;
        ctx.strokeStyle = asterColor(theme, aster);
        ctx.lineWidth = theme.asterWidth;
        var k;
        for (k = 0; k < aster.loop.length; k++) {
          var sa = built.map[aster.loop[k]];
          var sb = built.map[aster.loop[(k + 1) % aster.loop.length]];
          if (!sa || !sb) continue;
          var samplesA = arcSamples(sa.eq, sb.eq, 8);
          ctx.beginPath();
          var startedA = false;
          ctx.globalAlpha = frontPass ? 1 : theme.backStar;
          var s2;
          for (s2 = 0; s2 < samplesA.length; s2++) {
            var frontA = facingCamera(samplesA[s2], cam);
            if (frontA !== frontPass) {
              startedA = false;
              continue;
            }
            var p2 = project(samplesA[s2]);
            if (!p2) {
              startedA = false;
              continue;
            }
            if (!startedA) {
              ctx.moveTo(p2.x, p2.y);
              startedA = true;
            } else {
              ctx.lineTo(p2.x, p2.y);
            }
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawLines(false);
    var placedBack = [];
    var placedFront = [];
    var i;
    for (i = 0; i < built.list.length; i++) {
      var item = built.list[i];
      var front = facingCamera(item.eq, cam);
      var p = project(item.eq);
      if (!p) continue;
      var rec = {
        star: item.star,
        x: p.x,
        y: p.y,
        alt: item.alt,
        az: item.az,
        alpha: front ? 1 : theme.backStar
      };
      if (front) placedFront.push(rec);
      else placedBack.push(rec);
    }
    drawStarDots(ctx, placedBack, theme, h);
    drawOutsideGuides(ctx, w, h, cam, state, theme);
    drawLines(true);
    drawStarDots(ctx, placedFront, theme, h);
    if (state.showBounds) drawBoundsOutside(ctx, w, h, cam, state, theme);
    drawEarth(ctx, w, h, cam, state, theme);
    var placed = placedBack.concat(placedFront);
    drawLabels(ctx, placed, theme, w, h, state);
    drawConsNames(ctx, w, h, state, theme, function (ra, dec) {
      var v = StarGazeAstro.equatorialVector(ra, dec, state.lst);
      var p = projectOutside(v, cam, w, h);
      if (!p) return null;
      p.alpha = facingCamera(v, cam) ? 1 : theme.backStar;
      return p;
    });
    lastHits = placed;
  }

  function draw(ctx, cssW, cssH, state) {
    if (!ctx || cssW < 2 || cssH < 2) return;
    var dpr = Math.min((window.devicePixelRatio || 1), 2);
    var canvas = ctx.canvas;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var theme = readTheme();
    if (state.view === "outside") {
      drawOutsideView(ctx, cssW, cssH, state, theme);
    } else {
      drawGroundView(ctx, cssW, cssH, state, theme);
    }
  }

  function hitTest(x, y) {
    var best = null;
    var bestD = 1e9;
    var i;
    for (i = 0; i < lastHits.length; i++) {
      var h = lastHits[i];
      var dx = h.x - x;
      var dy = h.y - y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var limit = Math.max(14, (h.r || 3) * 2.4);
      if (dist <= limit && dist < bestD) {
        best = h;
        bestD = dist;
      }
    }
    return best;
  }

  return {
    draw: draw,
    hitTest: hitTest,
    projectStereo: projectStereo
  };
})();
