/*
  horizon.js
  ----------
  只给第二课的两张小图用。
  左图是俯视罗盘：方位角从正北起、向东转。
  右图是侧视：高度角从地平线起、向天顶量。
  没有这段脚本，图停在打开页面时的位置（方位 0°、高度 40°）。
*/
(function () {
  var azSlider = document.getElementById("az");
  var altSlider = document.getElementById("alt");
  if (!azSlider || !altSlider) {
    return;
  }

  var azNames = ["正北", "东北", "正东", "东南", "正南", "西南", "正西", "西北"];

  function compass(az) {
    var index = Math.round(az / 45) % 8;
    if (index < 0) {
      index += 8;
    }
    return azNames[index];
  }

  function render() {
    var az = Number(azSlider.value);
    var alt = Number(altSlider.value);

    /* 罗盘：0° 朝上（北），角度向东转，也就是在屏幕上顺时针。 */
    var rad = az * Math.PI / 180;
    var x = 140 + 92 * Math.sin(rad);
    var y = 140 - 92 * Math.cos(rad);
    var ray = document.getElementById("az-ray");
    ray.setAttribute("x2", x);
    ray.setAttribute("y2", y);
    document.getElementById("az-dot").setAttribute("cx", x);
    document.getElementById("az-dot").setAttribute("cy", y);
    document.getElementById("az-value").textContent = az + "°";
    document.getElementById("az-readout").textContent =
      "方位角 " + az + "°，" + compass(az) + "。从正北起、向东量。";

    /* 侧视图：地平线在纵坐标 150，天顶在上方。高度 90° 到天顶，负高度落到地平线下。 */
    var altRad = alt * Math.PI / 180;
    var sx = 160 + 100 * Math.cos(altRad);
    var sy = 150 - 100 * Math.sin(altRad);
    document.getElementById("alt-star").setAttribute("cx", sx);
    document.getElementById("alt-star").setAttribute("cy", sy);
    document.getElementById("alt-value").textContent = alt + "°";
    var where = alt > 0 ? "在地平线以上" : (alt < 0 ? "在地平线以下" : "正好在地平线上");
    document.getElementById("alt-readout").textContent =
      "高度角 " + alt + "°，" + where + "。天顶是 +90°，天底是 −90°。";
  }

  azSlider.addEventListener("input", render);
  altSlider.addEventListener("input", render);
  render();
})();
