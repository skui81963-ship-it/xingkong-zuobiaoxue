/*
  calculator.js
  -------------
  第六课的计算器，也是全站算数的同一套公式。

  浏览器打开 lesson-06.html 时，文件末尾的代码会找到表单并填上结果。
  用 Node 检查公式时，页面上的 document 不存在，末尾那段会跳过，
  只留下上面的 SkyCalc，方便和书上的例题对照。

  公式来自 Jean Meeus《天文算法》(Astronomical Algorithms)：
  - 儒略日：第 7 章
  - 格林尼治平恒星时：式 (12.4)，有的版本编号写成 (11.4)
  - 高度角、方位角：式 (12.5)(12.6)。书里方位从正南向西量，
    本站按导航习惯从正北向东量，所以在书中的方位上再加 180°。

  这套计算故意没做三件进阶修正（附录里有说明）：
  - 岁差：星表是 J2000.0，不是「今天」的坐标
  - 章动：平恒星时和真恒星时最多差大约 1.2 秒，约 0.005°
  - 大气折射：地平附近能把星星抬高大约 0.5°
*/

var SkyCalc = (function () {
  /* 星表。坐标是 J2000.0 的国际天球参考系（ICRS），和附录的表是同一批数字。
     ra 用时、分、秒；dec 用度、分、秒。decSign 为 1 表示北、为 -1 表示南。 */
  var STARS = [
    { id: "sirius", name: "天狼", bayer: "α CMa", mag: -1.46, ra: [6, 45, 8.917], decSign: -1, dec: [16, 42, 58.02] },
    { id: "canopus", name: "老人", bayer: "α Car", mag: -0.74, ra: [6, 23, 57.110], decSign: -1, dec: [52, 41, 44.38] },
    { id: "rigil", name: "南门二", bayer: "α Cen", mag: -0.27, ra: [14, 39, 36.494], decSign: -1, dec: [60, 50, 2.37] },
    { id: "arcturus", name: "大角", bayer: "α Boo", mag: -0.05, ra: [14, 15, 39.672], decSign: 1, dec: [19, 10, 56.67] },
    { id: "vega", name: "织女", bayer: "α Lyr", mag: 0.03, ra: [18, 36, 56.336], decSign: 1, dec: [38, 47, 1.28] },
    { id: "capella", name: "五车二", bayer: "α Aur", mag: 0.08, ra: [5, 16, 41.359], decSign: 1, dec: [45, 59, 52.77] },
    { id: "rigel", name: "参宿七", bayer: "β Ori", mag: 0.13, ra: [5, 14, 32.272], decSign: -1, dec: [8, 12, 5.90] },
    { id: "procyon", name: "南河三", bayer: "α CMi", mag: 0.34, ra: [7, 39, 18.119], decSign: 1, dec: [5, 13, 29.96] },
    { id: "betelgeuse", name: "参宿四", bayer: "α Ori", mag: 0.50, ra: [5, 55, 10.305], decSign: 1, dec: [7, 24, 25.43] },
    { id: "achernar", name: "水委一", bayer: "α Eri", mag: 0.46, ra: [1, 37, 42.845], decSign: -1, dec: [57, 14, 12.31] },
    { id: "hadar", name: "马腹一", bayer: "β Cen", mag: 0.61, ra: [14, 3, 49.405], decSign: -1, dec: [60, 22, 22.93] },
    { id: "altair", name: "河鼓二", bayer: "α Aql", mag: 0.76, ra: [19, 50, 46.999], decSign: 1, dec: [8, 52, 5.96] },
    { id: "aldebaran", name: "毕宿五", bayer: "α Tau", mag: 0.85, ra: [4, 35, 55.239], decSign: 1, dec: [16, 30, 33.49] },
    { id: "antares", name: "心宿二", bayer: "α Sco", mag: 1.06, ra: [16, 29, 24.460], decSign: -1, dec: [26, 25, 55.21] },
    { id: "spica", name: "角宿一", bayer: "α Vir", mag: 0.97, ra: [13, 25, 11.579], decSign: -1, dec: [11, 9, 40.75] },
    { id: "pollux", name: "北河三", bayer: "β Gem", mag: 1.14, ra: [7, 45, 18.950], decSign: 1, dec: [28, 1, 34.32] },
    { id: "fomalhaut", name: "北落师门", bayer: "α PsA", mag: 1.16, ra: [22, 57, 39.046], decSign: -1, dec: [29, 37, 20.05] },
    { id: "deneb", name: "天津四", bayer: "α Cyg", mag: 1.25, ra: [20, 41, 25.915], decSign: 1, dec: [45, 16, 49.22] },
    { id: "regulus", name: "轩辕十四", bayer: "α Leo", mag: 1.36, ra: [10, 8, 22.311], decSign: 1, dec: [11, 58, 1.95] },
    { id: "polaris", name: "北极星", bayer: "α UMi", mag: 1.98, ra: [2, 31, 49.095], decSign: 1, dec: [89, 15, 50.79] }
  ];

  /* 把任意角度收回 0° 到 360° 之间。负数要先加够 360，再取余数。 */
  function norm360(deg) {
    var x = deg % 360;
    if (x < 0) {
      x += 360;
    }
    return x;
  }

  /* 收回 -180° 到 +180°。时角用这个范围：负是还在子午圈东边，正是已经到了西边。 */
  function norm180(deg) {
    var x = norm360(deg);
    if (x > 180) {
      x -= 360;
    }
    return x;
  }

  /* 角度的正弦、余弦。JavaScript 的 Math.sin 吃的是弧度，所以先乘 π/180。 */
  function sinDeg(deg) {
    return Math.sin(deg * Math.PI / 180);
  }

  function cosDeg(deg) {
    return Math.cos(deg * Math.PI / 180);
  }

  /* 防止四舍五入把 1.0000000002 送进反余弦，导致结果变成 NaN（不是数字）。 */
  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  /*
    赤经：时分秒 → 小时，再 × 15 变成度。
    1 小时 = 15°，因为 24 小时正好绕天球一圈（360°）。
  */
  function raToDegrees(h, m, s) {
    var hours = h + m / 60 + s / 3600;
    return {
      hours: hours,
      degrees: hours * 15
    };
  }

  /* 赤纬：度分秒，加上南纬的负号。 */
  function decToDegrees(sign, d, m, s) {
    var mag = Math.abs(d) + m / 60 + s / 3600;
    return sign < 0 ? -mag : mag;
  }

  /*
    公历日期 + 世界时的小数日 → 儒略日。
    dayFraction 是「日」带上小数：20 日 0 时写 20，20 日 12 时写 20.5。
    1582 年 10 月之后的公历才能直接用这套（本课的例子都在这个范围里）。
  */
  function julianDay(year, month, dayFraction) {
    var y = year;
    var m = month;
    /* 1 月、2 月算进上一年的 13、14 月，这是这套公式的规定，不是日历真的这样印。 */
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    var A = Math.floor(y / 100);
    /* B 是公历相对于儒略历的修正。格里高利历才加这一项。 */
    var B = 2 - A + Math.floor(A / 4);
    /*
      30.6001 比 30.6 多一点点，是为了躲开二进制小数把该进位的整数削掉。
      末尾的 1524.5 把起算点对齐到儒略日的定义：整数儒略日从中午起算。
    */
    return Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      dayFraction + B - 1524.5;
  }

  /*
    格林尼治平恒星时，单位是度（360° = 24 时）。
    JD 必须是世界时的儒略日，不是力学时。
    280.46061837° 是 J2000.0（2000-01-01 12:00 UT）那一瞬间的起点。
    360.98564736629 是地球相对恒星每天多转的角度。

    和 Meeus《天文算法》例题对过：
    1987-04-10 0 时 UT 的 GMST 是 13 时 10 分 46.3668 秒；
    同日 19:21 UT，金星在华盛顿（北纬 38°55′17″，西经 77°03′56″）
    高度 15.1249°，从正北向东的方位 248.034°。
    这里的结果和书上相差不到 0.001°。
  */
  function gmstDegrees(jd) {
    var d = jd - 2451545.0;
    var t = d / 36525;
    var gmst = 280.46061837 +
      360.98564736629 * d +
      0.000387933 * t * t -
      (t * t * t) / 38710000;
    return norm360(gmst);
  }

  /* 度 → 时分秒。用于把恒星时读成钟面上的样子。15° = 1 时。 */
  function degreesToHms(deg) {
    var hours = norm360(deg) / 15;
    return hoursToHms(hours);
  }

  function hoursToHms(hours) {
    var h = hours % 24;
    if (h < 0) {
      h += 24;
    }
    var H = Math.floor(h);
    var minutesFloat = (h - H) * 60;
    var M = Math.floor(minutesFloat);
    var S = (minutesFloat - M) * 60;
    return { h: H, m: M, s: S, hours: h };
  }

  /* 时钟文字，秒四舍五入。23:59:60 要进位，不能显示成 60 秒。 */
  function formatClock(hours) {
    var t = hoursToHms(hours);
    var totalSeconds = Math.round(t.h * 3600 + t.m * 60 + t.s);
    totalSeconds = ((totalSeconds % 86400) + 86400) % 86400;
    var H = Math.floor(totalSeconds / 3600);
    var M = Math.floor((totalSeconds % 3600) / 60);
    var S = totalSeconds % 60;
    return pad(H) + ":" + pad(M) + ":" + pad(S);
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function formatDeg(deg, digits) {
    var n = typeof digits === "number" ? digits : 2;
    var sign = deg < 0 ? "−" : "";
    return sign + Math.abs(deg).toFixed(n) + "°";
  }

  /*
    由时角、赤纬、纬度求高度角和方位角。
    方位角从正北起、向东量：0° 北，90° 东，180° 南，270° 西。
    时角正值表示星星在子午圈西边。
  */
  function horizontal(haDeg, decDeg, latDeg) {
    var sinAlt = sinDeg(latDeg) * sinDeg(decDeg) +
      cosDeg(latDeg) * cosDeg(decDeg) * cosDeg(haDeg);
    sinAlt = clamp(sinAlt, -1, 1);
    var alt = Math.asin(sinAlt) * 180 / Math.PI;
    var cosAlt = Math.cos(alt * Math.PI / 180);
    var az;
    /* 星星几乎在天顶时，方位角没有稳定的方向，用 0 占位并加一个标记。 */
    if (Math.abs(cosAlt) < 1e-8) {
      az = 0;
    } else {
      var sinAz = -sinDeg(haDeg) * cosDeg(decDeg) / cosAlt;
      var cosAz = (sinDeg(decDeg) - sinAlt * sinDeg(latDeg)) / (cosAlt * cosDeg(latDeg));
      az = norm360(Math.atan2(sinAz, cosAz) * 180 / Math.PI);
    }
    return {
      alt: alt,
      az: az,
      sinAlt: sinAlt,
      zenith: Math.abs(cosAlt) < 1e-8
    };
  }

  /* 八个方位。每个名字管 45°，边界落在两个名字正中间。 */
  function compass(az) {
    var names = ["正北", "东北", "正东", "东南", "正南", "西南", "正西", "西北"];
    var index = Math.round(norm360(az) / 45) % 8;
    return names[index];
  }

  /*
    升起和落下时的时角。高度角为 0 时：
    cos H = −tan φ tan δ
    算出的余弦超出 [-1, 1]，就说明这颗星今天碰不到地平线。
  */
  function riseSetAngle(latDeg, decDeg) {
    var cosH = -Math.tan(latDeg * Math.PI / 180) * Math.tan(decDeg * Math.PI / 180);
    if (cosH < -1) {
      return { kind: "circumpolar", cosH: cosH, h0: null };
    }
    if (cosH > 1) {
      return { kind: "never", cosH: cosH, h0: null };
    }
    return {
      kind: "both",
      cosH: cosH,
      h0: Math.acos(cosH) * 180 / Math.PI
    };
  }

  /* 上中天（时角为 0）时的高度角。 */
  function transitAltitude(latDeg, decDeg) {
    return horizontal(0, decDeg, latDeg).alt;
  }

  /*
    一次完整计算。
    localHour 是当地钟点的小数，例如 20:30 写成 20.5。
    tzHours 是时区，北京是 +8（当地时间 = 世界时 + 8）。
    lonDeg 东经为正，西经为负。这和现代地图一致。
  */
  function compute(opts) {
    var localHour = opts.localHour;
    var tz = opts.tzHours;
    var utHour = localHour - tz;
    var year = opts.year;
    var month = opts.month;
    var day = opts.day;
    /* 世界时跨过 0 点或 24 点时，日期要跟着挪一天，儒略日公式才认这个日历日。 */
    var utDay = day;
    var utMonth = month;
    var utYear = year;
    if (utHour < 0) {
      utHour += 24;
      utDay -= 1;
    } else if (utHour >= 24) {
      utHour -= 24;
      utDay += 1;
    }
    var shifted = shiftDate(utYear, utMonth, utDay);
    utYear = shifted.year;
    utMonth = shifted.month;
    utDay = shifted.day;

    var jd = julianDay(utYear, utMonth, utDay + utHour / 24);
    var d = jd - 2451545.0;
    var t = d / 36525;
    var gmst = gmstDegrees(jd);
    var lst = norm360(gmst + opts.lonDeg);
    var ha = norm180(lst - opts.raDeg);
    var horiz = horizontal(ha, opts.decDeg, opts.latDeg);
    var riseInfo = riseSetAngle(opts.latDeg, opts.decDeg);
    var events = eventsOnLocalDate(opts);

    return {
      utYear: utYear,
      utMonth: utMonth,
      utDay: utDay,
      utHour: utHour,
      jd: jd,
      d: d,
      t: t,
      gmst: gmst,
      lst: lst,
      ha: ha,
      alt: horiz.alt,
      az: horiz.az,
      compass: compass(horiz.az),
      above: horiz.alt > 0,
      zenith: horiz.zenith,
      riseInfo: riseInfo,
      transitAlt: transitAltitude(opts.latDeg, opts.decDeg),
      events: events
    };
  }

  /* 把 3 月 0 日收成 2 月最后一天，把 3 月 32 日收成 4 月 1 日。只挪一天，够时区使用。 */
  function shiftDate(year, month, day) {
    var date = new Date(Date.UTC(year, month - 1, day));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  /*
    当地这个公历日里，升起、上中天、落下的钟点。
    先求当地 0 时的恒星时，再看时角还要转到目标值多少度。
    恒星时比世界时跑得快：每小时大约多 15.04107°，而不是整 15°。
  */
  function eventsOnLocalDate(opts) {
    var jdMidnight = julianDay(opts.year, opts.month, opts.day) - opts.tzHours / 24;
    var lst0 = norm360(gmstDegrees(jdMidnight) + opts.lonDeg);
    var ha0 = norm180(lst0 - opts.raDeg);
    var rate = 15.041068640254;
    var info = riseSetAngle(opts.latDeg, opts.decDeg);

    function hoursUntil(targetHa) {
      var delta = norm360(targetHa - ha0);
      return delta / rate;
    }

    var transit = hoursUntil(0);
    var rise = null;
    var set = null;
    if (info.kind === "both") {
      rise = hoursUntil(-info.h0);
      set = hoursUntil(info.h0);
    }
    return {
      kind: info.kind,
      h0: info.h0,
      ha0: ha0,
      lst0: lst0,
      jdMidnight: jdMidnight,
      rise: rise,
      transit: transit,
      set: set,
      transitAlt: transitAltitude(opts.latDeg, opts.decDeg)
    };
  }

  return {
    STARS: STARS,
    norm360: norm360,
    norm180: norm180,
    raToDegrees: raToDegrees,
    decToDegrees: decToDegrees,
    julianDay: julianDay,
    gmstDegrees: gmstDegrees,
    degreesToHms: degreesToHms,
    formatClock: formatClock,
    formatDeg: formatDeg,
    horizontal: horizontal,
    compass: compass,
    riseSetAngle: riseSetAngle,
    transitAltitude: transitAltitude,
    compute: compute
  };
})();

/*
  下面只在浏览器里运行。它读取第六课的表单，调用上面的公式，
  再把中间步骤写回页面。每一步都留着，是为了能和手算对照。
*/
if (typeof document !== "undefined") {
  var form = document.getElementById("calc-form");
  if (form) {
    var starSelect = document.getElementById("star");
    var customBox = document.getElementById("custom-coords");
    var resultBox = document.getElementById("calc-result");

    /* 把星表填进下拉框。option 是下拉菜单里的一项。 */
    for (var i = 0; i < SkyCalc.STARS.length; i++) {
      var star = SkyCalc.STARS[i];
      var option = document.createElement("option");
      option.value = star.id;
      option.textContent = star.name + "（" + star.bayer + "）";
      starSelect.appendChild(option);
    }
    var customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "自己输入赤经、赤纬";
    starSelect.appendChild(customOption);
    starSelect.value = "vega";

    function readNumber(id) {
      return Number(document.getElementById(id).value);
    }

    function selectedStarAngles() {
      if (starSelect.value === "custom") {
        var sign = document.getElementById("dec-sign").value === "S" ? -1 : 1;
        var ra = SkyCalc.raToDegrees(readNumber("ra-h"), readNumber("ra-m"), readNumber("ra-s"));
        var dec = SkyCalc.decToDegrees(sign, readNumber("dec-d"), readNumber("dec-m"), readNumber("dec-s"));
        return { name: "自定恒星", ra: ra, dec: dec };
      }
      for (var i = 0; i < SkyCalc.STARS.length; i++) {
        if (SkyCalc.STARS[i].id === starSelect.value) {
          var item = SkyCalc.STARS[i];
          return {
            name: item.name,
            ra: SkyCalc.raToDegrees(item.ra[0], item.ra[1], item.ra[2]),
            dec: SkyCalc.decToDegrees(item.decSign, item.dec[0], item.dec[1], item.dec[2])
          };
        }
      }
      return null;
    }

    function showCustom(open) {
      customBox.hidden = !open;
    }

    /* 地点按钮。data-lat、data-lon、data-tz 是写在 HTML 上、给脚本读的数字。 */
    var presets = document.querySelectorAll(".city-presets button");
    for (var p = 0; p < presets.length; p++) {
      presets[p].addEventListener("click", function () {
        document.getElementById("lat").value = this.getAttribute("data-lat");
        document.getElementById("lon").value = this.getAttribute("data-lon");
        document.getElementById("tz").value = this.getAttribute("data-tz");
        for (var k = 0; k < presets.length; k++) {
          presets[k].setAttribute("aria-pressed", presets[k] === this ? "true" : "false");
        }
        render();
      });
    }

    function render() {
      showCustom(starSelect.value === "custom");
      var angles = selectedStarAngles();
      var dateValue = document.getElementById("date").value;
      var timeValue = document.getElementById("time").value;
      if (!angles || !dateValue || !timeValue) {
        resultBox.textContent = "请把日期、时间和坐标填完整。";
        return;
      }
      var dateParts = dateValue.split("-");
      var timeParts = timeValue.split(":");
      var localHour = Number(timeParts[0]) + Number(timeParts[1] || 0) / 60;
      var opts = {
        year: Number(dateParts[0]),
        month: Number(dateParts[1]),
        day: Number(dateParts[2]),
        localHour: localHour,
        tzHours: readNumber("tz"),
        latDeg: readNumber("lat"),
        lonDeg: readNumber("lon"),
        raDeg: angles.ra.degrees,
        decDeg: angles.dec
      };
      if (!isFinite(opts.latDeg) || !isFinite(opts.lonDeg) || !isFinite(opts.raDeg) || !isFinite(opts.decDeg)) {
        resultBox.textContent = "纬度、经度、赤经或赤纬不是有效数字。";
        return;
      }
      if (opts.latDeg < -90 || opts.latDeg > 90) {
        resultBox.textContent = "纬度要在 −90° 和 +90° 之间。";
        return;
      }
      var r = SkyCalc.compute(opts);
      resultBox.innerHTML = "";
      resultBox.appendChild(buildReport(angles, opts, r));
    }

    function buildReport(angles, opts, r) {
      var root = document.createElement("div");
      root.className = "calc-report";

      var headline = document.createElement("p");
      headline.className = "calc-headline";
      var where = r.above ? "在地平线以上" : "在地平线以下";
      headline.textContent = angles.name + "此时" + where + "，方位 " +
        r.compass + "（" + SkyCalc.formatDeg(r.az) + "），高度 " + SkyCalc.formatDeg(r.alt) + "。";
      root.appendChild(headline);

      root.appendChild(step("1. 当地<wbr>时间换<wbr>成世界时", [
        "当地 " + formatLocal(opts) + "，时区 UTC" + signed(opts.tzHours) + "。",
        "世界时 = 当地时间 − 时区 = " + SkyCalc.formatClock(r.utHour) +
          "\u00a0UT，日期是 " + r.utYear + "-" + pad2(r.utMonth) + "-" + pad2(r.utDay) + "。"
      ]));

      root.appendChild(step("2. 儒略日", [
        "JD = " + r.jd.toFixed(5) + "。",
        "距离 J2000.0 的日数 D = JD − 2451545 = " + r.d.toFixed(5) + "。",
        "儒略世纪 T = D / 36525 = " + r.t.toFixed(8) + "。"
      ]));

      var gmstH = SkyCalc.degreesToHms(r.gmst);
      var lstH = SkyCalc.degreesToHms(r.lst);
      root.appendChild(step("3. 格林尼治<wbr>平恒星时 GMST", [
        "GMST = 280.46061837° + 360.98564736629° × D + 0.000387933° × T² − T³ / 38710000。",
        "得到 " + SkyCalc.formatDeg(r.gmst, 4) + "，也就是 " + clockFromHms(gmstH) + "。"
      ]));

      root.appendChild(step("4. 地方恒星时 LST", [
        "东经为正。LST = GMST + 经度 = " + SkyCalc.formatDeg(r.gmst, 4) +
          " + " + SkyCalc.formatDeg(opts.lonDeg, 4) + "。",
        "收进 0°–360° 后，LST = " + SkyCalc.formatDeg(r.lst, 4) + " = " + clockFromHms(lstH) + "。"
      ]));

      root.appendChild(step("5. 时角", [
        angles.name + "的赤经是 " + angles.ra.hours.toFixed(5) + "\u00a0时 = " +
          SkyCalc.formatDeg(angles.ra.degrees, 4) + "，赤纬是 " + SkyCalc.formatDeg(opts.decDeg, 4) + "。",
        "时角 H = LST − 赤经 = " + SkyCalc.formatDeg(r.ha, 4) + "。",
        r.ha < 0 ? "负时角：还在子午圈东边，尚未中天。" : "非负时角：在子午圈上或已经偏西。"
      ]));

      root.appendChild(step("6. 高度角和<wbr>方位角", [
        "sin 高度 = sin 纬度 · sin 赤纬 + cos 纬度 · cos 赤纬 · cos 时角。",
        "高度角 = " + SkyCalc.formatDeg(r.alt, 3) + "。方位角（从正北向东）= " +
          SkyCalc.formatDeg(r.az, 3) + "，" + r.compass + "。",
        r.above ? "高度为正，此时在地平线以上。" : "高度不为正，此时在地平线以下，看不见。"
      ]));

      var lines = [];
      lines.push("上中天高度（时角为 0）= " + SkyCalc.formatDeg(r.transitAlt, 2) +
        "，当地时间 " + SkyCalc.formatClock(r.events.transit) + "。");
      if (r.events.kind === "circumpolar") {
        lines.push("cos H = −tan φ tan δ 小于 −1：拱极星，这个纬度上看不到它落下。");
      } else if (r.events.kind === "never") {
        lines.push("cos H = −tan φ tan δ 大于 1：这颗星不会升到地平线以上。上中天也在地下。");
      } else {
        lines.push("升起时的时角是 −" + SkyCalc.formatDeg(r.events.h0, 2) +
          "，落下时是 +" + SkyCalc.formatDeg(r.events.h0, 2) + "。");
        lines.push("升起 " + SkyCalc.formatClock(r.events.rise) +
          "，落下 " + SkyCalc.formatClock(r.events.set) + "（当地时间，几何高度 0°）。");
        lines.push("还没算大气折射。地平附近折射大约 0.5°，真正看见的升起会早几分钟，落下会晚几分钟。");
      }
      root.appendChild(step("7. 这一天的<wbr>升、<wbr>中天、落", lines));

      var note = document.createElement("p");
      note.className = "calc-note";
      note.textContent = "星表是J2000.0。和2026\u00a0年的精密星历比，岁差通常带来零点几度的差别。章动忽略后，恒星时大约只差0.005°。";
      root.appendChild(note);
      return root;
    }

    function step(title, lines) {
      var section = document.createElement("section");
      section.className = "calc-step";
      var h = document.createElement("h3");
      // The fixed titles are segmented by the BudouX build step, just like HTML headings.
      title.split("<wbr>").forEach(function (part, index) {
        if (index) h.appendChild(document.createElement("wbr"));
        h.appendChild(document.createTextNode(part));
      });
      section.appendChild(h);
      for (var i = 0; i < lines.length; i++) {
        var p = document.createElement("p");
        p.textContent = lines[i];
        section.appendChild(p);
      }
      return section;
    }

    function formatLocal(opts) {
      var t = SkyCalc.formatClock(opts.localHour);
      return opts.year + "-" + pad2(opts.month) + "-" + pad2(opts.day) + " " + t.slice(0, 5);
    }

    function signed(n) {
      return (n >= 0 ? "+" : "−") + Math.abs(n);
    }

    function pad2(n) {
      return (n < 10 ? "0" : "") + n;
    }

    function clockFromHms(t) {
      var total = Math.round(t.h * 3600 + t.m * 60 + t.s);
      return SkyCalc.formatClock(total / 3600);
    }

    starSelect.addEventListener("change", render);
    form.addEventListener("input", render);
    render();
  }
}
