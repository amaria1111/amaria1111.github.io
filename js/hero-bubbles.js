
const HERO_BUBBLE_WIDTH_RATIO = 1.2;
const HERO_BUBBLE_HEIGHT_RATIO = 2.8;
const HERO_BUBBLE_MIN_WIDTH = 120;
const HERO_BUBBLE_MIN_HEIGHT = 56;
const HERO_BUBBLE_MAX_WIDTH = 340;
const HERO_BUBBLE_MAX_HEIGHT = 90;

const HERO_BUBBLE_IMAGE_MIN_WIDTH = 60;
const HERO_BUBBLE_IMAGE_MIN_HEIGHT = 40;
const HERO_BUBBLE_IMAGE_MAX_WIDTH = 260;
const HERO_BUBBLE_IMAGE_MAX_HEIGHT = 260;
const CORNER_RADIUS = 100;
const FOOT_HALF_WIDTH = 8;
const QR_RATIO = 1 / 16;
const QR_MAX_RATIO = 2 / 3;
const QR_MIN_LEN = 6;
const HERO_BUBBLE_PAD_X = 8;
const HERO_BUBBLE_PAD_Y = 5;
const HERO_BUBBLE_TEXT_OFFSET_X = 0;
const HERO_BUBBLE_TEXT_OFFSET_Y = 0;
const HERO_BUBBLE_SCREEN_PAD = 16;
const HERO_BUBBLE_IMAGE_DEFAULT_SIZE = 80;

const HERO_BUBBLE_IMAGE_PAD_X = 15;
const HERO_BUBBLE_IMAGE_PAD_Y = 10;

const HERO_PHYSICS_REPEL_PAD = 12;
const HERO_PHYSICS_REPEL_STRENGTH = 18;
const HERO_PHYSICS_FRICTION = 0.90;
const HERO_PHYSICS_MAX_SPEED = 900;
const HERO_PHYSICS_WALL_RESTITUTION = 0.4;

const HERO_ROAM_HIDE_MIN = 400;
const HERO_ROAM_HIDE_MAX = 2000;

const HERO_HIT_RADIUS_RATIO = 0.55;

const HERO_COLLISION_RADIUS_RATIO = 0.5;
const HERO_COLLISION_PAD = 10;
const HERO_COLLISION_STRENGTH = 10;

const HERO_SPAWN_DURATION = 500;
const HERO_SPAWN_START_SCALE = 0.15;
const HERO_VANISH_DURATION = 350;
const HERO_VANISH_BUMP_RATIO = 0.20;
const HERO_VANISH_BUMP_PHASE = 0.35;

function heroBubbleClamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function heroBubbleRandRange(min, max) { return min + Math.random() * (max - min); }
function heroEaseOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function heroEaseInCubic(t) { return t * t * t; }

function heroEllipseRadiusAtAngle(rx, ry, angle) {
  if (rx <= 0 || ry <= 0) return 0;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const denom = Math.sqrt((cos * cos) / (rx * rx) + (sin * sin) / (ry * ry));
  return denom > 0 ? 1 / denom : 0;
}

function heroEaseOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function heroVanishScale(t) {
  if (t < HERO_VANISH_BUMP_PHASE) {
    return 1 + HERO_VANISH_BUMP_RATIO * heroEaseOutCubic(t / HERO_VANISH_BUMP_PHASE);
  }
  const p = (t - HERO_VANISH_BUMP_PHASE) / (1 - HERO_VANISH_BUMP_PHASE);

  return Math.max(0.001, (1 + HERO_VANISH_BUMP_RATIO) * (1 - heroEaseInCubic(p)));
}

let heroBubbleMeasurer = null;
function measureHeroBubbleText(str) {
  if (!heroBubbleMeasurer) {
    heroBubbleMeasurer = document.createElement("span");
    heroBubbleMeasurer.className = "hero-news-text-measure";
    heroBubbleMeasurer.setAttribute("aria-hidden", "true");
    document.body.appendChild(heroBubbleMeasurer);
  }
  heroBubbleMeasurer.textContent = str || "";
  const rect = heroBubbleMeasurer.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function heroBubbleGeometry(RECT_W, RECT_H) {
  const r = heroBubbleClamp(CORNER_RADIUS, 0, Math.min(RECT_W, RECT_H) / 2);
  const straightW = RECT_W - 2 * r;
  const straightH = RECT_H - 2 * r;
  const arcLen = (Math.PI / 2) * r;
  let s = 0;
  const features = [];
  const push = (f) => { f.s0 = s; s += f.len; f.s1 = s; features.push(f); };

  push({ type: "edge", len: straightW, p0: { x: r, y: 0 }, p1: { x: RECT_W - r, y: 0 } });
  push({ type: "arc", len: arcLen, cx: RECT_W - r, cy: r, theta0: -Math.PI / 2, corner: "tr" });
  push({ type: "edge", len: straightH, p0: { x: RECT_W, y: r }, p1: { x: RECT_W, y: RECT_H - r } });
  push({ type: "arc", len: arcLen, cx: RECT_W - r, cy: RECT_H - r, theta0: 0, corner: "br" });
  push({ type: "edge", len: straightW, p0: { x: RECT_W - r, y: RECT_H }, p1: { x: r, y: RECT_H } });
  push({ type: "arc", len: arcLen, cx: r, cy: RECT_H - r, theta0: Math.PI / 2, corner: "bl" });
  push({ type: "edge", len: straightH, p0: { x: 0, y: RECT_H - r }, p1: { x: 0, y: r } });
  push({ type: "arc", len: arcLen, cx: r, cy: r, theta0: Math.PI, corner: "tl" });
  return { r, arcLen, perimeter: s, features };
}

function heroBubblePointOnFeature(f, u, r) {
  if (f.type === "edge") {
    const t = f.len > 0 ? u / f.len : 0;
    return { x: f.p0.x + (f.p1.x - f.p0.x) * t, y: f.p0.y + (f.p1.y - f.p0.y) * t };
  }
  const theta = f.theta0 + (r > 0 ? u / r : 0);
  return { x: f.cx + r * Math.cos(theta), y: f.cy + r * Math.sin(theta) };
}

function heroBubbleArcLengthToPoint(sRaw, g) {
  const s = ((sRaw % g.perimeter) + g.perimeter) % g.perimeter;
  const f = g.features.find((f) => s >= f.s0 - 1e-6 && s <= f.s1 + 1e-6) || g.features[g.features.length - 1];
  return heroBubblePointOnFeature(f, s - f.s0, g.r);
}

function heroBubblePointNearEdge(f, point) {
  const eps = 0.5;
  if (Math.abs(f.p0.x - f.p1.x) < eps) return Math.abs(point.x - f.p0.x) < eps;
  return Math.abs(point.y - f.p0.y) < eps;
}
function heroBubbleEdgeU(f, point) {
  if (Math.abs(f.p1.x - f.p0.x) > Math.abs(f.p1.y - f.p0.y)) {
    return f.len * (point.x - f.p0.x) / (f.p1.x - f.p0.x);
  }
  return f.len * (point.y - f.p0.y) / (f.p1.y - f.p0.y);
}

function heroBubbleFindBoundaryHit(O, dx, dy, g, RECT_W, RECT_H) {
  const hw = RECT_W / 2, hh = RECT_H / 2, r = g.r;
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  const hitVertical = tx <= ty;
  const px = O.x + dx * t, py = O.y + dy * t;
  const inStraightZone = hitVertical ? (py >= r && py <= RECT_H - r) : (px >= r && px <= RECT_W - r);

  if (inStraightZone) {
    const point = hitVertical
      ? { x: dx > 0 ? RECT_W : 0, y: py }
      : { x: px, y: dy > 0 ? RECT_H : 0 };
    const normal = hitVertical
      ? { x: dx > 0 ? 1 : -1, y: 0 }
      : { x: 0, y: dy > 0 ? 1 : -1 };
    const edge = g.features.find((f) => f.type === "edge" && heroBubblePointNearEdge(f, point));
    const u = heroBubbleClamp(heroBubbleEdgeU(edge, point), 0, edge.len);
    return { point, s: edge.s0 + u, normal };
  }

  const rightSide = dx > 0, bottomSide = dy > 0;
  const cornerKey = (bottomSide ? "b" : "t") + (rightSide ? "r" : "l");
  const arcFeature = g.features.find((f) => f.type === "arc" && f.corner === cornerKey);
  const cx = arcFeature.cx, cy = arcFeature.cy;
  const ocx = O.x - cx, ocy = O.y - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (ocx * dx + ocy * dy);
  const c = ocx * ocx + ocy * ocy - r * r;
  const disc = Math.max(0, b * b - 4 * a * c);

  const tHit = (-b + Math.sqrt(disc)) / (2 * a);
  const hx = O.x + dx * tHit, hy = O.y + dy * tHit;
  let dTheta = Math.atan2(hy - cy, hx - cx) - arcFeature.theta0;
  dTheta = ((dTheta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const u = heroBubbleClamp(r > 0 ? dTheta * r : 0, 0, arcFeature.len);
  const normal = r > 0 ? { x: (hx - cx) / r, y: (hy - cy) / r } : { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
  return { point: { x: hx, y: hy }, s: arcFeature.s0 + u, normal };
}

function heroBubblePathD(O, P, RECT_W, RECT_H) {
  const g = heroBubbleGeometry(RECT_W, RECT_H);
  let dx = P.x - O.x;
  let dy = P.y - O.y;
  if (dx === 0 && dy === 0) { dy = 1; }

  const hit = heroBubbleFindBoundaryHit(O, dx, dy, g, RECT_W, RECT_H);
  const Q = hit.point;
  const sQ = hit.s;
  const N = hit.normal;

  const OQ = Math.hypot(Q.x - O.x, Q.y - O.y);
  const QPx = P.x - Q.x;
  const QPy = P.y - Q.y;
  const QPlen = Math.hypot(QPx, QPy);

  const QRmax = Math.max(OQ * QR_MAX_RATIO, QR_MIN_LEN);
  const QR = heroBubbleClamp(QPlen * QR_RATIO, QR_MIN_LEN, QRmax);
  const dirX = QPlen > 1e-6 ? QPx / QPlen : N.x;
  const dirY = QPlen > 1e-6 ? QPy / QPlen : N.y;
  const R = { x: Q.x + dirX * QR, y: Q.y + dirY * QR };

  const perimeter = g.perimeter;
  const sS = ((sQ - FOOT_HALF_WIDTH) % perimeter + perimeter) % perimeter;
  const sT = ((sQ + FOOT_HALF_WIDTH) % perimeter + perimeter) % perimeter;
  const S = heroBubbleArcLengthToPoint(sS, g);
  const T = heroBubbleArcLengthToPoint(sT, g);

  const features = g.features;
  const n = features.length;
  const eps = 1e-6;
  const contains = (f, s) => s >= f.s0 - eps && s <= f.s1 + eps;

  const idxT = Math.max(0, features.findIndex((f) => contains(f, sT)));

  const segments = [];
  const fT = features[idxT];
  const tailStart = sT - fT.s0;
  if (fT.len - tailStart > eps) {
    segments.push({ type: fT.type, from: heroBubblePointOnFeature(fT, tailStart, g.r), to: heroBubblePointOnFeature(fT, fT.len, g.r) });
  }
  for (let k = 1; k <= n; k++) {
    const f = features[(idxT + k) % n];
    if (contains(f, sS)) {
      const headEnd = sS - f.s0;
      if (headEnd > eps) {
        segments.push({ type: f.type, from: heroBubblePointOnFeature(f, 0, g.r), to: heroBubblePointOnFeature(f, headEnd, g.r) });
      }
      break;
    }
    segments.push({ type: f.type, from: heroBubblePointOnFeature(f, 0, g.r), to: heroBubblePointOnFeature(f, f.len, g.r) });
  }

  const fmt = (n) => n.toFixed(2);
  let d = `M ${fmt(S.x)} ${fmt(S.y)} L ${fmt(R.x)} ${fmt(R.y)} L ${fmt(T.x)} ${fmt(T.y)} `;
  for (const seg of segments) {
    if (Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) < 1e-6) continue;
    d += seg.type === "edge"
      ? `L ${fmt(seg.to.x)} ${fmt(seg.to.y)} `
      : `A ${fmt(g.r)} ${fmt(g.r)} 0 0 1 ${fmt(seg.to.x)} ${fmt(seg.to.y)} `;
  }
  d += "Z";
  return d;
}

function createHeroBubble(config) {
  const posEl = document.createElement("div");
  posEl.className = "hero-news-pos";
  posEl.innerHTML = `
    <div class="hero-news" data-hero-news tabindex="0" role="button" aria-label="お知らせを切り替える(ドラッグで移動できます)">
      <svg class="hero-news-bg" aria-hidden="true">
        <path fill="#fff" stroke="#D9D7CC" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"></path>
      </svg>
      <span class="hero-news-text">
        <span data-hero-news-text></span><span class="hero-caret is-done" data-hero-caret aria-hidden="true"></span>
        <img class="hero-news-image" data-hero-news-image alt="">
      </span>
    </div>`;

  const instance = {
    id: config.id,
    config,
    posEl,
    bubble: posEl.querySelector("[data-hero-news]"),
    svg: posEl.querySelector(".hero-news-bg"),
    path: posEl.querySelector("path"),
    textBoxEl: posEl.querySelector(".hero-news-text"),
    textEl: posEl.querySelector("[data-hero-news-text]"),
    caretEl: posEl.querySelector("[data-hero-caret]"),
    imageEl: posEl.querySelector("[data-hero-news-image]"),
    RECT_W: HERO_BUBBLE_MIN_WIDTH,
    RECT_H: HERO_BUBBLE_MIN_HEIGHT,
    x: 0, y: 0, vx: 0, vy: 0,
    dragging: false,
    hidden: false,
    spawn: null,
    vanish: null,
    positioned: false,
  };

  instance.setHidden = function setHidden(hidden) {
    instance.hidden = hidden;
    instance.posEl.classList.toggle("is-hidden", hidden);
  };

  instance.startSpawn = function startSpawn() {
    instance.spawn = { startTime: performance.now(), duration: HERO_SPAWN_DURATION };
  };

  instance.startVanish = function startVanish() {
    instance.vanish = { startTime: performance.now(), duration: HERO_VANISH_DURATION };
  };

  function applySizing() {
    instance.bubble.style.width = `${instance.RECT_W}px`;
    instance.bubble.style.height = `${instance.RECT_H}px`;

    const maxOQ = Math.hypot(instance.RECT_W / 2, instance.RECT_H / 2);
    const pad = Math.ceil(maxOQ * QR_MAX_RATIO) + 8;
    instance.svg.setAttribute("viewBox", `${-pad} ${-pad} ${instance.RECT_W + pad * 2} ${instance.RECT_H + pad * 2}`);
    instance.svg.style.left = `${(-pad / instance.RECT_W) * 100}%`;
    instance.svg.style.top = `${(-pad / instance.RECT_H) * 100}%`;
    instance.svg.style.width = `${(1 + (2 * pad) / instance.RECT_W) * 100}%`;
    instance.svg.style.height = `${(1 + (2 * pad) / instance.RECT_H) * 100}%`;
  }

  function applyContentSize(contentW, contentH, minW, maxW, minH, maxH, padX, padY) {

    const maxWidthForScreen = Math.max(minW, Math.min(maxW, window.innerWidth - HERO_BUBBLE_SCREEN_PAD * 2));
    instance.RECT_W = heroBubbleClamp(contentW + padX * 2, minW, maxWidthForScreen);
    instance.RECT_H = heroBubbleClamp(contentH + padY * 2, minH, maxH);
    applySizing();
    instance.textBoxEl.style.left = `${padX}px`;
    instance.textBoxEl.style.right = `${padX}px`;
    instance.textBoxEl.style.top = `${padY}px`;
    instance.textBoxEl.style.bottom = `${padY}px`;
    instance.textBoxEl.style.transform = `translate(${HERO_BUBBLE_TEXT_OFFSET_X}px, ${HERO_BUBBLE_TEXT_OFFSET_Y}px)`;
  }

  instance.resizeToText = function resizeToText(text) {
    const measured = measureHeroBubbleText(text);
    applyContentSize(
      measured.width * HERO_BUBBLE_WIDTH_RATIO, measured.height * HERO_BUBBLE_HEIGHT_RATIO,
      HERO_BUBBLE_MIN_WIDTH, HERO_BUBBLE_MAX_WIDTH, HERO_BUBBLE_MIN_HEIGHT, HERO_BUBBLE_MAX_HEIGHT,
      HERO_BUBBLE_PAD_X, HERO_BUBBLE_PAD_Y
    );
  };

  instance.resizeToImage = function resizeToImage(width, height) {
    applyContentSize(
      width || HERO_BUBBLE_IMAGE_DEFAULT_SIZE, height || HERO_BUBBLE_IMAGE_DEFAULT_SIZE,
      HERO_BUBBLE_IMAGE_MIN_WIDTH, HERO_BUBBLE_IMAGE_MAX_WIDTH, HERO_BUBBLE_IMAGE_MIN_HEIGHT, HERO_BUBBLE_IMAGE_MAX_HEIGHT,
      HERO_BUBBLE_IMAGE_PAD_X, HERO_BUBBLE_IMAGE_PAD_Y
    );
  };

  instance.applyTransform = function applyTransform(now) {
    if (instance.vanish) {
      const t = heroBubbleClamp((now - instance.vanish.startTime) / instance.vanish.duration, 0, 1);
      const scale = heroVanishScale(t);
      instance.posEl.style.transform = `translate(${instance.x}px, ${instance.y}px) scale(${scale})`;
      if (t >= 1) instance.vanish = null;
      return;
    }
    if (instance.spawn) {
      const t = heroBubbleClamp((now - instance.spawn.startTime) / instance.spawn.duration, 0, 1);
      const scale = HERO_SPAWN_START_SCALE + (1 - HERO_SPAWN_START_SCALE) * heroEaseOutBack(t);
      instance.posEl.style.transform = `translate(${instance.x}px, ${instance.y}px) scale(${scale})`;
      if (t >= 1) instance.spawn = null;
      return;
    }
    instance.posEl.style.transform = `translate(${instance.x}px, ${instance.y}px)`;
  };

  instance.updatePath = function updatePath(targetScreenPoint) {
    if (!targetScreenPoint) return;
    const ctm = instance.svg.getScreenCTM();
    if (!ctm) return;
    const screenPoint = instance.svg.createSVGPoint();
    screenPoint.x = targetScreenPoint.x;
    screenPoint.y = targetScreenPoint.y;
    const P = screenPoint.matrixTransform(ctm.inverse());

    if (!Number.isFinite(P.x) || !Number.isFinite(P.y)) return;
    const O = { x: instance.RECT_W / 2, y: instance.RECT_H / 2 };
    instance.path.setAttribute("d", heroBubblePathD(O, P, instance.RECT_W, instance.RECT_H));
  };

  applySizing();
  return instance;
}

function setupHeroBubbles() {
  const container = document.querySelector("[data-hero-bubbles]");
  const heroVisual = document.querySelector(".hero-visual");
  const heroImg = document.querySelector(".hero-visual-frame img");
  const headerEl = document.querySelector(".site-header");
  if (!container || !heroVisual || typeof HERO_BUBBLES === "undefined" || !HERO_BUBBLES.length) return;

  const instances = HERO_BUBBLES.map((config) => createHeroBubble(config));
  const byId = new Map(instances.map((inst) => [inst.id, inst]));
  instances.forEach((inst) => container.appendChild(inst.posEl));

  function getHeroBubbleBounds(inst) {
    const visualRect = heroVisual.getBoundingClientRect();
    const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
    const viewportBottom = window.innerHeight - visualRect.top;
    const viewportLeft = -visualRect.left;
    const viewportRight = window.innerWidth - visualRect.left;

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const headerHeight = headerRect ? headerRect.height : 0;
    const headerBottomFixed = headerHeight - visualRect.top - scrollY;
    return {
      minX: viewportLeft,
      maxX: viewportRight - inst.RECT_W,
      minY: headerBottomFixed,
      maxY: viewportBottom - inst.RECT_H,
    };
  }

  function pickHeroHitPosition(inst) {
    const bounds = getHeroBubbleBounds(inst);
    const heroRect = heroImg.getBoundingClientRect();
    if (heroRect.width === 0) {

      return { x: heroBubbleClamp(0, bounds.minX, bounds.maxX), y: heroBubbleClamp(0, bounds.minY, bounds.maxY) };
    }
    const visualRect = heroVisual.getBoundingClientRect();
    const heroCenterX = heroRect.left + heroRect.width / 2 - visualRect.left;
    const heroCenterY = heroRect.top + heroRect.height / 2 - visualRect.top;
    const hitRadius = Math.hypot(heroRect.width, heroRect.height) / 2 * HERO_HIT_RADIUS_RATIO;
    const angle = Math.random() * Math.PI * 2;
    const r = hitRadius * Math.sqrt(Math.random());
    return {
      x: heroBubbleClamp(heroCenterX + r * Math.cos(angle) - inst.RECT_W / 2, bounds.minX, bounds.maxX),
      y: heroBubbleClamp(heroCenterY + r * Math.sin(angle) - inst.RECT_H / 2, bounds.minY, bounds.maxY),
    };
  }

  function resolveTargetScreenPoint(inst) {
    const el = inst.config.target === "hero" ? heroImg : (byId.get(inst.config.target)?.bubble ?? null);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  instances.forEach((inst) => {
    const messages = inst.config.messages || [];
    if (!messages.length) return;
    let index = 0;
    let typeTimer = null;
    let cycleTimer = null;

    function clearPendingTimers() {
      clearInterval(typeTimer);
      clearTimeout(cycleTimer);
    }

    function showMessage(msg) {
      clearPendingTimers();
      const isImage = msg && typeof msg === "object" && msg.image;
      inst.textBoxEl.classList.toggle("is-image", !!isImage);
      if (isImage) {
        showImageMessage(msg);
      } else {
        typeTextMessage(String(msg));
      }
    }

    function typeTextMessage(msg) {
      inst.resizeToText(msg);
      inst.caretEl.classList.remove("is-done", "is-blink-out");
      inst.caretEl.classList.add("is-blinking");
      inst.textEl.textContent = "";
      let i = 0;
      typeTimer = setInterval(() => {
        i++;
        inst.textEl.textContent = msg.slice(0, i);
        if (i >= msg.length) {
          clearInterval(typeTimer);
          inst.caretEl.classList.remove("is-blinking");
          void inst.caretEl.offsetWidth;
          inst.caretEl.classList.add("is-blink-out");
          cycleTimer = setTimeout(showNext, inst.config.autoInterval || 8000);
        }
      }, 60);
    }

    function showImageMessage(msg) {
      inst.caretEl.classList.remove("is-blinking", "is-blink-out");
      inst.caretEl.classList.add("is-done");
      inst.textEl.textContent = "";
      inst.imageEl.src = msg.image;
      inst.imageEl.alt = msg.alt || "";
      inst.resizeToImage(msg.width, msg.height);
      cycleTimer = setTimeout(showNext, inst.config.autoInterval || 8000);
    }

    inst.caretEl.addEventListener("animationend", () => {
      if (inst.caretEl.classList.contains("is-blink-out")) {
        inst.caretEl.classList.remove("is-blink-out");
        inst.caretEl.classList.add("is-done");
      }
    });

    function showNext() {

      if (inst.dragging) {
        clearTimeout(cycleTimer);
        cycleTimer = setTimeout(showNext, 300);
        return;
      }
      clearPendingTimers();
      index = (index + 1) % messages.length;
      if (inst.config.roam) {
        hideThenReappear();
      } else {
        showMessage(messages[index]);
      }
    }

    function hideThenReappear() {
      inst.startVanish();
      cycleTimer = setTimeout(() => {
        inst.setHidden(true);
        cycleTimer = setTimeout(() => {
          const pos = pickHeroHitPosition(inst);
          inst.x = pos.x;
          inst.y = pos.y;
          inst.vx = 0;
          inst.vy = 0;
          inst.setHidden(false);
          inst.startSpawn();
          showMessage(messages[index]);
        }, heroBubbleRandRange(HERO_ROAM_HIDE_MIN, HERO_ROAM_HIDE_MAX));
      }, HERO_VANISH_DURATION);
    }

    inst.setHidden(true);
    cycleTimer = setTimeout(() => {
      const pos = pickHeroHitPosition(inst);
      inst.x = pos.x;
      inst.y = pos.y;
      inst.setHidden(false);
      inst.startSpawn();
      showMessage(messages[index]);
    }, inst.config.startDelay || 0);

    inst.bubble.addEventListener("click", () => {

      if (inst.bubble._heroDragged) {
        inst.bubble._heroDragged = false;
        return;
      }
      showNext();
    });
    inst.bubble.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showNext();
      }
    });
  });

  instances.forEach((inst) => {
    let dragMoved = false;
    let startPointerX = 0, startPointerY = 0, startX = 0, startY = 0;
    let samples = [];

    inst.bubble.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (inst.hidden || inst.vanish) return;
      inst.dragging = true;
      dragMoved = false;
      startPointerX = e.clientX;
      startPointerY = e.clientY;
      startX = inst.x;
      startY = inst.y;
      inst.vx = 0;
      inst.vy = 0;
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      inst.bubble.setPointerCapture(e.pointerId);
      inst.bubble.classList.add("is-dragging");
    });

    inst.bubble.addEventListener("pointermove", (e) => {
      if (!inst.dragging) return;
      const moveX = e.clientX - startPointerX;
      const moveY = e.clientY - startPointerY;
      if (!dragMoved && Math.hypot(moveX, moveY) > 4) dragMoved = true;

      const bounds = getHeroBubbleBounds(inst);
      inst.x = heroBubbleClamp(startX + moveX, bounds.minX, bounds.maxX);
      inst.y = heroBubbleClamp(startY + moveY, bounds.minY, bounds.maxY);
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (samples.length > 6) samples.shift();
    });

    function endDrag(e) {
      if (!inst.dragging) return;
      inst.dragging = false;
      inst.bubble.classList.remove("is-dragging");
      if (inst.bubble.hasPointerCapture(e.pointerId)) inst.bubble.releasePointerCapture(e.pointerId);
      if (dragMoved) inst.bubble._heroDragged = true;

      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = first && last ? (last.t - first.t) / 1000 : 0;
      if (dt > 0.001) {
        inst.vx = heroBubbleClamp((last.x - first.x) / dt, -HERO_PHYSICS_MAX_SPEED, HERO_PHYSICS_MAX_SPEED);
        inst.vy = heroBubbleClamp((last.y - first.y) / dt, -HERO_PHYSICS_MAX_SPEED, HERO_PHYSICS_MAX_SPEED);
      }
    }
    inst.bubble.addEventListener("pointerup", endDrag);
    inst.bubble.addEventListener("pointercancel", endDrag);
  });

  function ensurePositioned() {
    const rect = heroVisual.getBoundingClientRect();
    if (rect.width === 0) return false;
    instances.forEach((inst) => {
      if (inst.positioned) return;
      inst.x = rect.width * (1 - inst.config.initX) - inst.RECT_W;
      inst.y = inst.RECT_H * inst.config.initY;
      inst.positioned = true;
    });
    return true;
  }

  let lastTime = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (ensurePositioned()) {

      const heroRect = heroImg.getBoundingClientRect();
      const visualRectNow = heroVisual.getBoundingClientRect();
      const heroCollision = heroRect.width > 0 ? {
        cx: heroRect.left + heroRect.width / 2 - visualRectNow.left,
        cy: heroRect.top + heroRect.height / 2 - visualRectNow.top,
        rx: (heroRect.width / 2) * HERO_COLLISION_RADIUS_RATIO,
        ry: (heroRect.height / 2) * HERO_COLLISION_RADIUS_RATIO,
      } : null;

      instances.forEach((a) => {
        if (a.dragging || a.hidden || a.spawn || a.vanish) return;
        let fx = 0, fy = 0;
        const ax = a.x + a.RECT_W / 2, ay = a.y + a.RECT_H / 2;

        instances.forEach((b) => {
          if (a === b || b.hidden) return;
          const bx = b.x + b.RECT_W / 2, by = b.y + b.RECT_H / 2;
          const dx = ax - bx, dy = ay - by;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minDist = (Math.hypot(a.RECT_W, a.RECT_H) + Math.hypot(b.RECT_W, b.RECT_H)) / 2 + HERO_PHYSICS_REPEL_PAD;
          if (dist < minDist) {
            const push = (minDist - dist) * HERO_PHYSICS_REPEL_STRENGTH;
            fx += (dx / dist) * push;
            fy += (dy / dist) * push;
          }
        });

        if (heroCollision) {
          const dx = ax - heroCollision.cx, dy = ay - heroCollision.cy;
          const dist = Math.hypot(dx, dy) || 0.01;
          const angle = Math.atan2(dy, dx);
          const heroEdge = heroEllipseRadiusAtAngle(heroCollision.rx, heroCollision.ry, angle);
          const bubbleRadius = Math.hypot(a.RECT_W, a.RECT_H) / 2;
          const minDist = heroEdge + bubbleRadius + HERO_COLLISION_PAD;
          if (dist < minDist) {
            const push = (minDist - dist) * HERO_COLLISION_STRENGTH;
            fx += (dx / dist) * push;
            fy += (dy / dist) * push;
          }
        }

        a.vx = heroBubbleClamp((a.vx + fx * dt) * HERO_PHYSICS_FRICTION, -HERO_PHYSICS_MAX_SPEED, HERO_PHYSICS_MAX_SPEED);
        a.vy = heroBubbleClamp((a.vy + fy * dt) * HERO_PHYSICS_FRICTION, -HERO_PHYSICS_MAX_SPEED, HERO_PHYSICS_MAX_SPEED);
        a.x += a.vx * dt;
        a.y += a.vy * dt;

        const bounds = getHeroBubbleBounds(a);
        if (a.x < bounds.minX) { a.x = bounds.minX; a.vx = Math.abs(a.vx) * HERO_PHYSICS_WALL_RESTITUTION; }
        if (a.x > bounds.maxX) { a.x = bounds.maxX; a.vx = -Math.abs(a.vx) * HERO_PHYSICS_WALL_RESTITUTION; }
        if (a.y < bounds.minY) { a.y = bounds.minY; a.vy = Math.abs(a.vy) * HERO_PHYSICS_WALL_RESTITUTION; }
        if (a.y > bounds.maxY) { a.y = bounds.maxY; a.vy = -Math.abs(a.vy) * HERO_PHYSICS_WALL_RESTITUTION; }
      });

      instances.forEach((inst) => {
        inst.applyTransform(now);
        inst.updatePath(resolveTargetScreenPoint(inst));
      });
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
