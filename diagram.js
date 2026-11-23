/*
  diagram.js
  ----------
  只给第一课的「子午圈」图使用。

  打开页面时，HTML 里已经画好北纬 40° 的图，所以没有这段脚本也能看见图。
  脚本的工作是：纬度滑块一动，就按新的纬度重算北天极、南天极和天赤道的位置。

  它没有使用 type="module"。用 module 时，部分浏览器不允许用 file:// 直接打开，
  双击 index.html 会报错。写成普通脚本，双击打开也可以跑。
*/

/*
  包在一个函数里再立刻调用，是为了让里面的变量不要变成全页都能碰到的全局变量。
  以后如果还有第二段脚本，就不容易因为碰巧用了同一个名字而互相改掉。
*/
(function () {
  var slider = document.getElementById("latitude");
  if (!slider) {
    return;
  }

  /* 圆心和半径，单位是 SVG 自己的坐标，不是屏幕像素。要和 lesson-01.html 里的 viewBox 一致。 */
  var cx = 320;
  var cy = 280;
  var radius = 160;

  /*
    把「从正东（右）开始、逆时针量的角度」换成图上的点。
    数学里 y 朝上，SVG 里 y 朝下，所以 y 要用减号。
    约定：0° 在右边（正南），90° 在上（天顶），180° 在左边（正北），270° 在下（天底）。
    这是子午面：正东和正西垂直于纸面，图上不出现。
  */
  function pointAt(angleDeg, distance) {
    var rad = angleDeg * Math.PI / 180;
    return {
      x: cx + distance * Math.cos(rad),
      y: cy - distance * Math.sin(rad)
    };
  }

  function setLine(id, from, to) {
    var line = document.getElementById(id);
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
  }

  function setDot(id, point) {
    var dot = document.getElementById(id);
    dot.setAttribute("cx", point.x);
    dot.setAttribute("cy", point.y);
  }

  /*
    把文字挪到 point。
    字在圆心左边时，让文字的右端对准点（text-anchor: end），字就落在圆外的左侧；
    右边则相反。靠近正上、正下时居中。
  */
  function placeLabel(id, point) {
    var text = document.getElementById(id);
    var anchor = "middle";
    if (point.x < cx - 24) {
      anchor = "end";
    } else if (point.x > cx + 24) {
      anchor = "start";
    }
    text.setAttribute("x", point.x);
    text.setAttribute("y", point.y);
    text.setAttribute("text-anchor", anchor);
  }

  /*
    画一段从 startDeg 到 endDeg 的弧，用来标出纬度角。
    SVG 的弧命令是：A 半径x 半径y 旋转 大弧标志 方向标志 终点x 终点y。
    我们的角度增大时，在屏幕上是逆时针，对应方向标志 0。
  */
  function arcPath(startDeg, endDeg, distance) {
    var start = pointAt(startDeg, distance);
    var end = pointAt(endDeg, distance);
    var delta = endDeg - startDeg;
    while (delta > 180) {
      delta -= 360;
    }
    while (delta < -180) {
      delta += 360;
    }
    var sweep = delta >= 0 ? 0 : 1;
    return "M " + start.x + " " + start.y +
      " A " + distance + " " + distance + " 0 0 " + sweep + " " +
      end.x + " " + end.y;
  }

  /* 40 显示成「40°N」，-34 显示成「34°S」，0 就是赤道。 */
  function formatLat(phi) {
    if (phi > 0) {
      return phi + "°N";
    }
    if (phi < 0) {
      return Math.abs(phi) + "°S";
    }
    return "0°（赤道）";
  }

  /*
    用文字把图上的几何关系再说一遍，方便不看颜色也能懂。
    北天极的地平高度 = 纬度 φ（南纬时 φ 为负，北天极就落到地平线以下）。
    天赤道在子午圈上的高度 = 90° − |φ|，位于纬度的另一侧。
  */
  function describe(phi) {
    var absPhi = Math.abs(phi);
    var pole;
    var equator;

    if (phi === 90) {
      return "你在北极。北天极就是天顶，南天极就是天底。天赤道和地平圈重合：赤纬大于 0° 的星星不升也不落，只是平行于地平线转圈。";
    }
    if (phi === -90) {
      return "你在南极。南天极就是天顶，北天极就是天底。天赤道和地平圈重合，星星同样不升起、不落下。";
    }
    if (phi > 0) {
      pole = "北天极在正北，地平高度 " + phi + "°，等于纬度。南天极在正南，位于地平线以下 " + phi + "°。";
      equator = "天赤道经过正东和正西，并在正南方向升到 " + (90 - phi) + "°。";
    } else if (phi < 0) {
      pole = "南天极在正南，地平高度 " + absPhi + "°，等于南纬的度数。北天极在正北的地平线以下 " + absPhi + "°。";
      equator = "天赤道经过正东和正西，并在正北方向升到 " + (90 - absPhi) + "°。";
    } else {
      pole = "北天极贴着正北地平线，南天极贴着正南地平线，高度都是 0°。";
      equator = "天赤道经过天顶，也经过正东和正西。";
    }
    return pole + equator;
  }

  function render(phi) {
    phi = Math.round(phi);
    if (phi > 90) {
      phi = 90;
    }
    if (phi < -90) {
      phi = -90;
    }

    /*
      北天极从正北（180°）往天顶方向抬起 φ 度。
      φ 为正，角度变小，点移到地平线以上；φ 为负，点落到地平线以下。
      南天极在对面，所以加 180°。天赤道和天轴垂直，所以再加减 90°。
    */
    var ncpAngle = 180 - phi;
    var scpAngle = ncpAngle + 180;
    var eqAngleA = ncpAngle + 90;
    var eqAngleB = ncpAngle - 90;

    var north = pointAt(180, radius);
    var south = pointAt(0, radius);
    var zenith = pointAt(90, radius);
    var nadir = pointAt(270, radius);
    var ncp = pointAt(ncpAngle, radius);
    var scp = pointAt(scpAngle, radius);
    var eqA = pointAt(eqAngleA, radius);
    var eqB = pointAt(eqAngleB, radius);

    setLine("horizon", north, south);
    setLine("vertical", zenith, nadir);
    setLine("axis", ncp, scp);
    setLine("equator", eqA, eqB);
    setDot("ncp-dot", ncp);
    setDot("scp-dot", scp);

    var ncpText = document.getElementById("label-ncp");
    var scpText = document.getElementById("label-scp");
    var eqText = document.getElementById("label-equator");
    ncpText.textContent = "北天极";
    scpText.textContent = "南天极";
    eqText.textContent = "天赤道";

    /* 在北极、南极、赤道，几个点会叠在一起，标签改成一句短话，避免完全重合。 */
    if (phi === 90) {
      ncpText.textContent = "北天极 = 天顶";
      scpText.textContent = "南天极 = 天底";
      eqText.textContent = "天赤道 = 地平圈";
      placeLabel("label-ncp", { x: cx - 36, y: zenith.y - 28 });
      placeLabel("label-scp", { x: cx + 36, y: nadir.y + 28 });
      placeLabel("label-equator", { x: south.x + 18, y: south.y - 22 });
    } else if (phi === -90) {
      scpText.textContent = "南天极 = 天顶";
      ncpText.textContent = "北天极 = 天底";
      eqText.textContent = "天赤道 = 地平圈";
      placeLabel("label-scp", { x: cx + 36, y: zenith.y - 28 });
      placeLabel("label-ncp", { x: cx - 36, y: nadir.y + 28 });
      placeLabel("label-equator", { x: south.x + 18, y: south.y - 22 });
    } else if (phi === 0) {
      ncpText.textContent = "北天极";
      placeLabel("label-ncp", { x: north.x - 8, y: north.y - 28 });
      placeLabel("label-scp", { x: south.x + 8, y: south.y + 32 });
      eqText.textContent = "天赤道经过天顶";
      placeLabel("label-equator", { x: zenith.x + 28, y: zenith.y - 22 });
    } else {
      placeLabel("label-ncp", pointAt(ncpAngle, radius + 34));
      placeLabel("label-scp", pointAt(scpAngle, radius + 36));
      var upper = Math.sin(eqAngleA * Math.PI / 180) >= Math.sin(eqAngleB * Math.PI / 180)
        ? eqAngleA
        : eqAngleB;
      placeLabel("label-equator", pointAt(upper, radius + 42));
    }

    var arc = document.getElementById("lat-arc");
    var phiLabel = document.getElementById("label-phi");
    if (phi === 0 || phi === 90 || phi === -90) {
      arc.setAttribute("d", "");
      phiLabel.textContent = "";
    } else {
      arc.setAttribute("d", arcPath(180, ncpAngle, 52));
      var mid = (180 + ncpAngle) / 2;
      placeLabel("label-phi", pointAt(mid, 78));
      phiLabel.textContent = "φ=" + phi + "°";
    }

    document.getElementById("lat-value").textContent = formatLat(phi);
    document.getElementById("lat-readout").textContent = describe(phi);

    var buttons = document.querySelectorAll(".presets button");
    for (var i = 0; i < buttons.length; i++) {
      var same = Number(buttons[i].getAttribute("data-lat")) === phi;
      buttons[i].setAttribute("aria-pressed", same ? "true" : "false");
    }
  }

  /*
    input 事件在滑块拖动的过程中就会连续触发，图会跟着动。
    change 要等松开才触发，这里不适合。
  */
  slider.addEventListener("input", function () {
    render(Number(slider.value));
  });

  /*
    data-lat 是写在按钮上的自定义属性，专门给脚本读。
    HTML 不认识「纬度」这个概念，但允许我们用 data- 开头自己存一个数。
  */
  var presets = document.querySelectorAll(".presets button");
  for (var i = 0; i < presets.length; i++) {
    presets[i].addEventListener("click", function () {
      slider.value = this.getAttribute("data-lat");
      render(Number(slider.value));
    });
  }

  render(Number(slider.value));
})();
