/*
  stargaze-astro.js
  -----------------
  虚拟观星的算数。时间、恒星时、高度方位都调用 calculator.js 里的 SkyCalc，
  和第六课是同一套公式，方便拿同一时刻对答案。

  岁差：这里不改正。
  星星的赤经、赤纬直接用 J2000.0，不再转到「今天」的春分点。
  2026 年前后，岁差大约会让位置差零点几度。故意留着这个差别，
  这样和第六课计算器对同一时刻，高度和方位才能对得上。
  章动和大气折射也不加，理由写在 calculator.js 开头。

  这一页还要把「高度、方位」画到屏幕上，所以下面多了向量。
  向量就是带方向的箭头，用三个数表示：东、北、上，或者天球上的三个方向。
  不需要先学线性代数，把它们当成「往东多少、往北多少、往上多少」即可。
*/

var StarGazeAstro = (function () {
  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* 点积：两个箭头有多「同向」。完全同向时接近两长度的乘积。 */
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  /* 叉积：得到同时垂直于 a 和 b 的第三个箭头。用来找「屏幕的右和上」。 */
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function norm(v) {
    var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len < 1e-12) {
      return [0, 0, 0];
    }
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function scale(v, k) {
    return [v[0] * k, v[1] * k, v[2] * k];
  }

  /*
    当地钟面 → 世界时的毫秒。
    不使用 new Date("2026-03-20T20:00")，因为那会被当成「这台电脑的时区」。
    这里按页面上选的时区解释钟面：北京时间 20:00 就是世界时 12:00。
  */
  function utcMsFromLocal(year, month, day, hour, minute, second, tzHours) {
    return Date.UTC(year, month - 1, day, hour, minute || 0, second || 0) - tzHours * 3600000;
  }

  /* 世界时毫秒 → 该时区的钟面。先把毫秒拨过时区，再用 UTC 的读数，避免再被电脑时区加一次。 */
  function localParts(utcMs, tzHours) {
    var d = new Date(utcMs + tzHours * 3600000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds()
    };
  }

  function formatLocal(utcMs, tzHours) {
    var p = localParts(utcMs, tzHours);
    return p.year + "-" + pad(p.month) + "-" + pad(p.day) + " " +
      pad(p.hour) + ":" + pad(p.minute) + ":" + pad(p.second);
  }

  function formatLocalInput(utcMs, tzHours) {
    var p = localParts(utcMs, tzHours);
    return p.year + "-" + pad(p.month) + "-" + pad(p.day) + "T" +
      pad(p.hour) + ":" + pad(p.minute) + ":" + pad(p.second);
  }

  function formatTz(tzHours) {
    var sign = tzHours >= 0 ? "+" : "−";
    var abs = Math.abs(tzHours);
    var h = Math.floor(abs);
    var m = Math.round((abs - h) * 60);
    if (m === 60) {
      h += 1;
      m = 0;
    }
    return "UTC" + sign + h + (m ? ":" + pad(m) : "");
  }

  /*
    地方恒星时，单位是度。
    先把世界时变成儒略日，再求格林尼治平恒星时，加上东经（西经是负数）。
    和 SkyCalc.compute 里第 3、4 步是同一段。
  */
  function lstDegrees(utcMs, lonDeg) {
    var d = new Date(utcMs);
    var dayFrac = d.getUTCDate() +
      (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3600000) / 24;
    var jd = SkyCalc.julianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, dayFrac);
    return SkyCalc.norm360(SkyCalc.gmstDegrees(jd) + lonDeg);
  }

  /*
    赤经、赤纬 → 高度、方位。
    纬度若写成正好 ±90°，第六课的方位公式要除以 cos 纬度，会变成无穷大。
    这里收到 ±89.5° 以内，肉眼看不出差别，公式保持稳定。
  */
  function horizontal(raDeg, decDeg, lstDeg, latDeg) {
    var lat = clamp(latDeg, -89.5, 89.5);
    var ha = SkyCalc.norm180(lstDeg - raDeg);
    var h = SkyCalc.horizontal(ha, decDeg, lat);
    h.ha = ha;
    return h;
  }

  /* 高度、方位 → 东、北、上三个分量。方位从正北向东量，和课文一致。 */
  function enu(altDeg, azDeg) {
    var alt = altDeg * Math.PI / 180;
    var az = azDeg * Math.PI / 180;
    var c = Math.cos(alt);
    return [c * Math.sin(az), c * Math.cos(az), Math.sin(alt)];
  }

  /*
    天球上的位置，用「当地子午圈」当参照，所以会跟着恒星时转。
    +Z 北天极，+X 是子午圈和天赤道的交点（时角 0，朝南点那边），+Y 朝西。
    时角变大时，星星从东边（−Y）转到南边（+X），再转到西边（+Y）。
  */
  function equatorialVector(raDeg, decDeg, lstDeg) {
    var ha = (lstDeg - raDeg) * Math.PI / 180;
    var dec = decDeg * Math.PI / 180;
    var c = Math.cos(dec);
    return [c * Math.cos(ha), c * Math.sin(ha), Math.sin(dec)];
  }

  /* 天顶在上面那套天球坐标里的位置。北纬越大，天顶越靠近北天极。 */
  function zenithVector(latDeg) {
    var lat = latDeg * Math.PI / 180;
    return [Math.cos(lat), 0, Math.sin(lat)];
  }

  /*
    地面视角的默认朝向：正抬头看天顶。
    北在屏幕上方。因为是抬头看，不是看地图，东在左边，西在右边。
    forward 是目光中心，right 是屏幕向右，up 是屏幕向上。
  */
  function defaultBasis() {
    return {
      forward: [0, 0, 1],
      right: [-1, 0, 0],
      up: [0, 1, 0]
    };
  }

  /* 绕某个轴转动一个箭头。右手螺旋：拇指指向轴，四指弯过去的方向是正角度。 */
  function rotateAround(v, axis, ang) {
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var k = cross(axis, v);
    var d = dot(axis, v);
    return [
      v[0] * c + k[0] * s + axis[0] * d * (1 - c),
      v[1] * c + k[1] * s + axis[1] * d * (1 - c),
      v[2] * c + k[2] * s + axis[2] * d * (1 - c)
    ];
  }

  /*
    手指拖动星空。dx、dy 是这一下移动了多少像素，y 向下为正。
    抓住星星拖：手指向右，星星跟着向右，目光就转向屏幕的左边。
    lookLeft、lookUp 是弧度。立体投影在画面中心附近，角距离大约是像素距离的两倍再除以比例。
  */
  function dragBasis(basis, dx, dy, zoom, viewWidth, viewHeight) {
    /* 0.40 和 stargaze-render.js 里的投影比例是同一个数，拖动才跟手。 */
    var side = Math.min(viewWidth || viewHeight || 600, viewHeight || 600);
    var scale = (zoom || 1) * side * 0.40;
    if (scale < 40) {
      scale = 40;
    }
    var lookLeft = dx * 2 / scale;
    var lookUp = dy * 2 / scale;
    var forward = rotateAround(basis.forward, basis.up, lookLeft);
    var right = rotateAround(basis.right, basis.up, lookLeft);
    forward = rotateAround(forward, right, lookUp);
    var up = rotateAround(basis.up, right, lookUp);
    forward = norm(forward);
    right = norm(cross(forward, up));
    up = norm(cross(right, forward));
    return { forward: forward, right: right, up: up };
  }

  /* 目光中心的高度和方位，用来在画面上写「现在朝向哪里」。天顶附近方位不稳定。 */
  function basisAltAz(basis) {
    var alt = Math.asin(clamp(basis.forward[2], -1, 1)) * 180 / Math.PI;
    var az = SkyCalc.norm360(Math.atan2(basis.forward[0], basis.forward[1]) * 180 / Math.PI);
    return { alt: alt, az: az };
  }

  /*
    手机方向传感器 → 和地面视角同一套目光方向。
    遵循 W3C 设备方向：alpha、beta、gamma 是一组转动角。
    人盯着屏幕、把手机举向天空时，天空在手机背面那一侧，所以目光取屏幕法线的反方向。
    算出来的 right / up / forward 和 defaultBasis 用的是同一套东、北、上。
  */
  function orientationBasis(alphaDeg, betaDeg, gammaDeg) {
    var d2r = Math.PI / 180;
    var x = betaDeg * d2r;
    var y = gammaDeg * d2r;
    var z = alphaDeg * d2r;
    var cX = Math.cos(x);
    var sX = Math.sin(x);
    var cY = Math.cos(y);
    var sY = Math.sin(y);
    var cZ = Math.cos(z);
    var sZ = Math.sin(z);
    var m11 = cZ * cY - sZ * sX * sY;
    var m12 = -cX * sZ;
    var m13 = cZ * sY + sZ * sX * cY;
    var m21 = sZ * cY + cZ * sX * sY;
    var m22 = cX * cZ;
    var m23 = sZ * sY - cZ * sX * cY;
    var m31 = -cX * sY;
    var m32 = sX;
    var m33 = cX * cY;
    return {
      right: [m11, m21, m31],
      up: [m12, m22, m32],
      forward: [-m13, -m23, -m33]
    };
  }

  /*
    手机横过来时，网页会跟着转，但传感器仍按竖屏的「右、上」报告。
    angleDeg 是屏幕相对自然方向顺时针转过的角度。这里把传感器的右、上改到网页的右、上。
  */
  function applyScreenAngle(basis, angleDeg) {
    var ang = (angleDeg || 0) * Math.PI / 180;
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var right = basis.right;
    var up = basis.up;
    var vRight = [
      right[0] * c + up[0] * s,
      right[1] * c + up[1] * s,
      right[2] * c + up[2] * s
    ];
    var vUp = [
      -right[0] * s + up[0] * c,
      -right[1] * s + up[1] * c,
      -right[2] * s + up[2] * c
    ];
    return {
      forward: basis.forward,
      right: norm(vRight),
      up: norm(vUp)
    };
  }

  return {
    clamp: clamp,
    pad: pad,
    dot: dot,
    cross: cross,
    norm: norm,
    scale: scale,
    utcMsFromLocal: utcMsFromLocal,
    localParts: localParts,
    formatLocal: formatLocal,
    formatLocalInput: formatLocalInput,
    formatTz: formatTz,
    lstDegrees: lstDegrees,
    horizontal: horizontal,
    enu: enu,
    equatorialVector: equatorialVector,
    zenithVector: zenithVector,
    defaultBasis: defaultBasis,
    dragBasis: dragBasis,
    basisAltAz: basisAltAz,
    orientationBasis: orientationBasis,
    applyScreenAngle: applyScreenAngle
  };
})();
