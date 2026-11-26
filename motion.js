/* 原生动画的小工具。没有 Web Animations 时，保留原来的状态切换。 */
var SkyMotion = (function () {
  var preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var settle = "cubic-bezier(.32, .72, 0, 1)";

  function duration(kind, keyboard) {
    var styles = getComputedStyle(document.documentElement);
    var time = parseFloat(styles.getPropertyValue("--motion-" + (preference.matches ? "fade" : kind)));
    return !preference.matches && keyboard ? Math.round(time * 0.75) : time;
  }

  function play(element, frames, time, easing, done) {
    if (!element.animate || !(time > 0)) {
      if (done) done();
      return null;
    }
    var animation = element.animate(frames, { duration: time, easing: easing || settle, fill: "both" });
    animation.onfinish = function () {
      animation.cancel();
      if (done) done();
    };
    return animation;
  }

  function transform(x, y, sx, sy) {
    return "translate(" + x + "px," + y + "px) scale(" + (sx == null ? 1 : sx) + "," + (sy == null ? 1 : sy) + ")";
  }

  function visible(rect) {
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
      rect.left < window.innerWidth && rect.top < window.innerHeight;
  }

  /* Canvas 也用同一条曲线：先按经过的时间找到 x，再求这点的 y。 */
  function settleProgress(time) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 14; i++) {
      var t = (lo + hi) / 2;
      var x = 0.96 * (1 - t) * (1 - t) * t + t * t * t;
      if (x < time) lo = t;
      else hi = t;
    }
    var u = (lo + hi) / 2;
    return 2.16 * (1 - u) * (1 - u) * u + 3 * (1 - u) * u * u + u * u * u;
  }

  return { preference: preference, duration: duration, play: play, transform: transform,
    visible: visible, settle: settle, settleProgress: settleProgress };
})();

/* 触屏可能直到点击才进入 :active；滚动取消指针时也要立即撤掉按下反馈。 */
(function () {
  var pressed;
  var pointer;
  function release(event) {
    if (!pressed || (event && event.pointerId != null && event.pointerId !== pointer)) return;
    pressed.classList.remove("is-touch-pressed");
    pressed = null;
  }
  document.addEventListener("pointerdown", function (event) {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    release();
    pressed = event.target.closest("a[href], button, summary, input, select, textarea, label.sg-check");
    if (!pressed || pressed.matches(":disabled")) { pressed = null; return; }
    pointer = event.pointerId;
    pressed.classList.add("is-touch-pressed");
  }, { capture: true, passive: true });
  window.addEventListener("pointerup", release, { capture: true, passive: true });
  window.addEventListener("pointercancel", release, { capture: true, passive: true });
  window.addEventListener("pagehide", release);
})();

/* 展开答案时，布局立即更新；只给后续内容加反向位移。 */
(function () {
  var shifts = new Map();
  var reveals = new Map();

  function cancelAll() {
    shifts.forEach(function (animation) { animation.cancel(); });
    reveals.forEach(function (effect) { effect.stop(); });
    shifts.clear();
    reveals.clear();
  }

  function following(summary) {
    var list = summary.closest(".exercises");
    var result = [];
    for (var el = summary.closest("li"); el && el !== document.body; el = el.parentElement) {
      for (var sibling = el.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
        if (sibling.getClientRects().length && sibling.getBoundingClientRect().top < window.innerHeight + 120) result.push(sibling);
      }
      if (!list) break;
    }
    return result;
  }

  function shownHeight(node) {
    var height = node.getBoundingClientRect().height;
    var inset = getComputedStyle(node).clipPath.match(/^inset\(([^)]*)\)/);
    if (!inset) return height;
    var trim = inset[1].split(" round ")[0].split(" ");
    return height - (parseFloat(trim[2] || trim[0]) || 0);
  }

  function disclosure(event) {
    var summary = event.target.closest && event.target.closest("details.answer > summary");
    if (!summary || event.defaultPrevented || !summary.animate) return;
    var details = summary.parentElement;
    var opening = !details.open;
    var reduced = SkyMotion.preference.matches;
    var time = SkyMotion.duration("reflow", event.detail === 0);
    if (!(time > 0)) return;
    event.preventDefault();
    var before = details.getBoundingClientRect();
    var active = reveals.get(details);
    var height = shownHeight(active ? active.node : details);
    var oldText = details.querySelector("p");
    var textOpacity = active ? Number(getComputedStyle(active.text || active.node).opacity) : 1;
    if (active) active.stop();
    var affected = reduced ? [] : following(summary);
    var positions = affected.map(function (el) { return el.getBoundingClientRect().top; });
    var ghost = opening ? null : details.cloneNode(true);
    affected.forEach(function (el) {
      if (shifts.has(el)) shifts.get(el).cancel();
    });
    details.open = opening;
    var after = details.getBoundingClientRect();
    var slide = affected.map(function (el, i) { return positions[i] - el.getBoundingClientRect().top; });
    affected.forEach(function (el, i) {
      shifts.delete(el);
      if (Math.abs(slide[i]) < 0.5) return;
      shifts.set(el, SkyMotion.play(el, [{ translate: "0 " + slide[i] + "px" }, { translate: "none" }], time, "ease-in-out", function () {
        shifts.delete(el);
      }));
    });

    function clip(top, bottom) { return "inset(" + top + "px 0 " + Math.max(0, bottom) + "px 0 round 10px)"; }
    var text = oldText, node = details, frames;
    if (opening) {
      frames = reduced ? null : [{ clipPath: clip(0, after.height - height) }, { clipPath: clip(0, 0) }];
    } else {
      ghost.classList.add("answer-outgoing");
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.cssText = "left:" + before.left + "px;top:" + before.top + "px;width:" + before.width + "px";
      document.body.appendChild(ghost);
      var top = Math.max(0, after.bottom - before.top);
      if (height <= top) { ghost.remove(); return; }
      text = ghost.querySelector("p");
      node = ghost;
      frames = [{ clipPath: clip(top, before.height - height), opacity: 1 },
        { clipPath: clip(top, reduced ? before.height - height : before.height - top), opacity: reduced ? 0 : 1 }];
    }
    var animations = [];
    function stop() {
      animations.forEach(function (animation) { if (animation) animation.cancel(); });
      if (ghost) ghost.remove();
      reveals.delete(details);
    }
    reveals.set(details, { node: node, text: text, stop: stop });
    if (frames) animations.push(SkyMotion.play(node, frames, time, "ease-in-out", stop));
    if (text) {
      var fade = opening ? [{ opacity: active ? textOpacity : 0 }, { offset: 0.48, opacity: active ? textOpacity : 0 }, { opacity: 1 }] :
        [{ opacity: textOpacity }, { offset: 0.34, opacity: 0 }, { opacity: 0 }];
      if (reduced && opening) fade = [fade[0], fade[2]];
      if (!(reduced && ghost)) animations.push(SkyMotion.play(text, fade, time, "linear", frames ? null : stop));
    }
  }

  document.addEventListener("click", disclosure);
  window.addEventListener("resize", cancelAll);
  window.addEventListener("pagehide", cancelAll);
  if (SkyMotion.preference.addEventListener) SkyMotion.preference.addEventListener("change", cancelAll);
})();

/* 只为原有链接加跨文档动画，不拦截链接、返回或浏览器的滚动恢复。 */
(function () {
  if (location.protocol === "file:" || !("onpagereveal" in window) || !("onpageswap" in window)) return;
  var keyboard = false;
  var activeLink;
  var clearPrevious;
  var handoff = "sk-course-motion";
  var root = document.documentElement;
  var current = new URL(location.href);

  function page(url) {
    if (!url || url.origin !== current.origin || url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1) !==
        current.pathname.slice(0, current.pathname.lastIndexOf("/") + 1)) return "";
    var name = url.pathname.split("/").pop() || "index.html";
    return /^(index|lesson-0[1-6]|appendix-(glossary|stars|advanced)|stargazing|constellations)\.html$/.test(name) ? name : "";
  }

  function urlFor(entry) { return entry && entry.url ? new URL(entry.url, current) : null; }

  function linksTo(name) {
    return Array.from(document.querySelectorAll(".toc a, .pager a, .site-header a.brand, .home-hero a[href]")).filter(function (a) {
      return page(new URL(a.href)) === name;
    });
  }

  function matches(from, to, outgoing, traverse, reverse) {
    var heading = document.querySelector(".site-header h1, .home-hero h1");
    var other = outgoing ? to : from;
    var here = outgoing ? from : to;
    var links = linksTo(other);
    var link = outgoing && links.indexOf(activeLink) !== -1 ? activeLink : links.find(function (a) {
      return SkyMotion.visible(a.getBoundingClientRect());
    });
    var label = link && (link.querySelector(".toc-title, small") || link);
    if (here === "index.html") {
      return { title: label, focus: traverse ? link : heading };
    }
    if (other === "index.html") {
      return { title: heading, focus: heading };
    }
    return { title: outgoing !== reverse ? label : heading, focus: reverse && link ? link : heading };
  }

  function mark(node, name, undo) {
    if (!node || !SkyMotion.visible(node.getBoundingClientRect())) return;
    var saved = node.getAttribute("style");
    node.style.viewTransitionName = name;
    if (node.matches("h1, .toc-title, .pager small")) node.style.width = "fit-content";
    if (node.matches(".pager small")) node.style.marginInline = "auto";
    undo.push(function () {
      if (saved == null) node.removeAttribute("style");
      else node.setAttribute("style", saved);
    });
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
    activeLink = link;
    keyboard = event.detail === 0;
  }, true);

  function apply(event, outgoing) {
    var transition = event.viewTransition;
    if (!transition) return;
    if (clearPrevious) clearPrevious();
    var activation = outgoing ? event.activation : window.navigation && window.navigation.activation;
    var from = activation && page(urlFor(activation.from));
    var to = activation && page(urlFor(activation.entry));
    if (!from || !to || from === to || document.querySelector(".sk-overlay:not([hidden], .sk-flight)")) {
      transition.skipTransition();
      return;
    }
    var traverse = activation.navigationType === "traverse";
    var found = matches(from, to, outgoing, traverse, traverse && activation.entry.index < activation.from.index);
    var undo = [];
    try {
      if (outgoing) sessionStorage.setItem(handoff, JSON.stringify([from, to, keyboard]));
      else {
        var input = JSON.parse(sessionStorage.getItem(handoff));
        sessionStorage.removeItem(handoff);
        if (input && input[0] === from && input[1] === to && input[2]) root.classList.add("course-motion-keyboard");
      }
    } catch (error) { /* 隐私模式仍照常跳转。 */ }
    if (!SkyMotion.preference.matches) {
      mark(found.title, "course-title", undo);
    }
    function restore() {
      undo.splice(0).forEach(function (revert) { revert(); });
      if (clearPrevious === restore) {
        if (!outgoing) root.classList.remove("course-motion-keyboard");
        clearPrevious = null;
      }
    }
    clearPrevious = restore;
    if (!outgoing && found.focus) {
      if (found.focus.matches("h1")) found.focus.setAttribute("tabindex", "-1");
      found.focus.focus({ preventScroll: true });
    }
    transition.ready.catch(function () {});
    transition.finished.then(restore, restore);
    activeLink = null;
    keyboard = false;
  }

  window.addEventListener("pageswap", function (event) { apply(event, true); });
  window.addEventListener("pagereveal", function (event) { apply(event, false); });
})();
