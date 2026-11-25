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
    把角度收进 −180° 到 180°。
    359° 和 1° 其实只差 2°，不能当成相差 358°。后面做平均时要用这个最短的差值，
    否则 359° 和 0° 会被平均成大约 180°，画面就转到反方向去了。
  */
  function wrap180(deg) {
    var x = deg % 360;
    if (x > 180) x -= 360;
    if (x <= -180) x += 360;
    return x;
  }

  /* 从 prev 走向 next，只走最短的那段弧。t 是 0 到 1。 */
  function smoothAngle(prev, next, t) {
    return prev + t * wrap180(next - prev);
  }

  function angleBetween(a, b) {
    var d = clamp(dot(a, b), -1, 1);
    return Math.acos(d) * 180 / Math.PI;
  }

  /*
    用屏幕「上」那条轴确定画面怎么转，而不是只用方位角重造一个画面。
    快到天顶时，方位角会失去意义：目光几乎竖直，东、北两个分量都接近 0，
    一点点噪声就会让方位从正南跳成正北。屏幕上沿这时仍指着地平上的一个方向，
    用它来固定旋转，画面才不会翻 180°。
  */
  function orthonormalize(basis) {
    var forward = norm(basis.forward);
    var up = basis.up;
    var along = dot(up, forward);
    up = [up[0] - forward[0] * along, up[1] - forward[1] * along, up[2] - forward[2] * along];
    var len = Math.sqrt(up[0] * up[0] + up[1] * up[1] + up[2] * up[2]);
    if (len < 1e-6) {
      up = [0, 1, 0];
      along = dot(up, forward);
      up = [up[0] - forward[0] * along, up[1] - forward[1] * along, up[2] - forward[2] * along];
      len = Math.sqrt(up[0] * up[0] + up[1] * up[1] + up[2] * up[2]);
      if (len < 1e-6) up = [1, 0, 0];
    }
    up = norm(up);
    var right = norm(cross(forward, up));
    up = norm(cross(right, forward));
    return { forward: forward, right: right, up: up };
  }

  /*
    手机方向传感器 → 和地面视角同一套目光方向。
    遵循 W3C 设备方向：先绕竖直轴转 alpha，再绕手机的右轴转 beta，最后绕手机的上轴转 gamma。
    人盯着屏幕、把手机举向天空时，天空在手机背面那一侧，所以目光取屏幕法线的反方向（−Z）。
    算出来的 right / up / forward 和 defaultBasis 用的是同一套东、北、上。

    不要把罗盘读数直接写进 alpha。手机从正南往天顶抬时，罗盘角会在两个相差 180° 的数之间跳，
    写进 alpha 后，画面就会在正南和正北之间来回翻。罗盘只用来慢慢修正「哪边是北」，
    而且天顶附近或读数突然跳了 180° 时，沿用上一次稳定的修正。
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
    return orthonormalize({
      forward: basis.forward,
      right: vRight,
      up: vUp
    });
  }

  function isFiniteNumber(n) {
    return typeof n === "number" && isFinite(n);
  }

  /*
    把一次传感器读数收成稳定的目光。
    sample 里有 alpha、beta、gamma，还可以有 screenAngle（屏幕横过来的角度）
    和 compassHeading（iOS 的 webkitCompassHeading，从北顺时针）。
    prev 是上一帧的结果。没有上一帧时传 null。

    天顶附近方位角没有稳定的定义，画面的旋转改由手机上沿决定。
    新的一帧如果和上一帧差了几十度以上，就当成坏读数丢掉：
    传感器大约每秒几十次，真实的抬头不会一下子转过 40°，
    但错误的欧拉角分解会突然差 180°。
  */
  function orientDevice(sample, prev) {
    prev = prev || {};
    if (!isFiniteNumber(sample.alpha) || !isFiniteNumber(sample.beta) || !isFiniteNumber(sample.gamma)) {
      if (prev.basis) return prev;
      return null;
    }
    var alpha = sample.alpha;
    var beta = sample.beta;
    var gamma = sample.gamma;
    var screenAngle = isFiniteNumber(sample.screenAngle) ? sample.screenAngle : 0;
    var compass = sample.compassHeading;
    var yawOffset = prev.yawOffset;
    var haveLock = isFiniteNumber(yawOffset);
    if (!haveLock) yawOffset = 0;
    var acceptedCompass = prev.compass;

    if (isFiniteNumber(compass)) {
      /* 罗盘从北顺时针量。W3C 的 alpha 相反，所以绝对 alpha 大约是 360° − 罗盘角。 */
      var alphaFromCompass = SkyCalc.norm360(360 - compass);
      var proposed = wrap180(alphaFromCompass - alpha);
      var previewAlpha = SkyCalc.norm360(alpha + (haveLock ? yawOffset : proposed));
      var preview = orientationBasis(previewAlpha, beta, gamma);
      var altNow = Math.asin(clamp(preview.forward[2], -1, 1)) * 180 / Math.PI;
      var horiz = Math.sqrt(preview.forward[0] * preview.forward[0] + preview.forward[1] * preview.forward[1]);
      var nearZenith = horiz < 0.34 || Math.abs(altNow) > 68;
      var compassJump = isFiniteNumber(prev.compass) && Math.abs(wrap180(compass - prev.compass)) > 25;
      var offsetJump = haveLock && Math.abs(wrap180(proposed - yawOffset)) > 35;
      if (!nearZenith && !compassJump && !offsetJump) {
        yawOffset = haveLock ? smoothAngle(yawOffset, proposed, 0.45) : proposed;
        haveLock = true;
        acceptedCompass = compass;
      }
    }

    var basis = applyScreenAngle(
      orientationBasis(SkyCalc.norm360(alpha + yawOffset), beta, gamma),
      screenAngle
    );

    if (prev.basis) {
      var jump = angleBetween(prev.basis.forward, basis.forward);
      if (jump > 40) {
        return {
          basis: prev.basis,
          yawOffset: prev.yawOffset,
          compass: prev.compass,
          rejected: true
        };
      }
      basis = blendBasis(prev.basis, basis, 0.8);
    }

    return {
      basis: basis,
      yawOffset: haveLock ? yawOffset : null,
      compass: acceptedCompass,
      rejected: false
    };
  }

  /* 在球面上从 a 走向 b，走短弧。t 越接近 1，越贴近新的读数。 */
  function blendBasis(a, b, t) {
    function mix(u, v) {
      if (dot(u, v) < 0) v = scale(v, -1);
      return norm([
        u[0] * (1 - t) + v[0] * t,
        u[1] * (1 - t) + v[1] * t,
        u[2] * (1 - t) + v[2] * t
      ]);
    }
    return orthonormalize({
      forward: mix(a.forward, b.forward),
      up: mix(a.up, b.up),
      right: mix(a.right, b.right)
    });
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
    applyScreenAngle: applyScreenAngle,
    wrap180: wrap180,
    smoothAngle: smoothAngle,
    orientDevice: orientDevice
  };
})();
