/* ============================================================
   main.js
   全ページ共通の動作(共有ヘッダー/フッターの読み込み・ナビの開閉)と、
   work.html 専用のグリッド生成・ポップアップ処理をまとめています。
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  await loadPartials();   // まずヘッダー/フッターを読み込んでから、他の初期化を行う(ヘッダーはこの時点ですぐ表示される)
  setupNavToggle();
  renderWorkGrid();       // work.html 以外では該当要素が無いので何もしません
  setupWorkModal();
  const heroBubble = setupHeroBubble(); // home以外では該当要素が無いので何もしません(吹き出しのドラッグ・足の向き追従・文章に合わせたサイズ変更)
  setupHeroNews(heroBubble);            // home以外では該当要素が無いので何もしません
  revealPageContent();    // main本文(・workのグリッド)を表示する演出。css/base.css, page-home.css, page-work.css参照
});

/* ----------------------------------------------------------------
   本文の表示演出をスタートさせる
   ★ 先に非表示状態を1フレーム描画させてから is-revealed を付けないと
     ブラウザによってはトランジションが効かず瞬時に表示されてしまうため、
     requestAnimationFrame で1フレーム待っている。
------------------------------------------------------------------- */
function revealPageContent() {
  requestAnimationFrame(() => {
    document.querySelector("main")?.classList.add("is-revealed");
    document.querySelector("[data-work-grid]")?.classList.add("is-revealed");
  });
}

/* ----------------------------------------------------------------
   共有パーツ(ヘッダー/フッター)の読み込み
   ★ この仕組みのおかげで、ヘッダーやフッターを変更したいときは
     partials/header.html・partials/footer.html を1回編集するだけで
     全ページに反映されます。5つのHTMLを個別に直す必要はありません。

   ※ 注意: この読み込みは fetch を使っているため、
     index.html をダブルクリックして直接開いた場合は動きません。
     必ず VS Code の「Live Server」か、
     `python3 -m http.server` などのローカルサーバー経由で開いてください
     (GitHub Pages で公開したときは問題なく動作します)。
------------------------------------------------------------------- */
async function loadPartials() {
  const targets = document.querySelectorAll("[data-include]");
  await Promise.all(Array.from(targets).map(async (el) => {
    const path = el.getAttribute("data-include");
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(String(res.status));
      el.outerHTML = await res.text();
    } catch (err) {
      el.innerHTML = `<p style="padding:1em;font-family:monospace;font-size:0.8rem;">
        ${escapeHTML(path)} を読み込めませんでした。ローカルサーバー経由で
        開いているか確認してください(直接ファイルを開くと動きません)。</p>`;
    }
  }));
  highlightCurrentNav();
  setYear();
}

/* 現在開いているページのナビ項目に aria-current="page" を自動で付ける */
function highlightCurrentNav() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav-key]").forEach((a) => {
    if (a.getAttribute("data-nav-key") === current) {
      a.setAttribute("aria-current", "page");
    }
  });
}

/* フッターの年号を自動更新 */
function setYear() {
  const el = document.querySelector("[data-year]");
  if (el) el.textContent = new Date().getFullYear();
}

/* ---------------- モバイルナビの開閉(全ページ共通) ---------------- */
function setupNavToggle() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-main-nav]");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "close" : "menu";
  });
}

/* ★ グリッドに実際表示されている作品(並び替え・件数制限後)。ポップアップの前後移動で使う */
let renderedWorks = [];

/* ---------------- Work: グリッド生成 ---------------- */
function renderWorkGrid() {
  const grid = document.querySelector("[data-work-grid]");
  if (!grid || typeof WORKS === "undefined") return;

  const limit = Number(grid.dataset.limit) || WORKS.length;
  // ★ IDが大きいものほど上(先頭)に表示
  const sorted = [...WORKS].sort((a, b) => Number(b.id) - Number(a.id));
  const works = sorted.slice(0, limit);
  renderedWorks = works;

  grid.innerHTML = works.map((w, i) => `
    <button class="work-cell" type="button"
      data-id="${escapeHTML(w.id)}"
      style="transition-delay: ${i * 70}ms"
      aria-label="${escapeHTML(w.title)}を開く">
      <img src="${escapeHTML(w.image)}" alt="${escapeHTML(w.title)}" loading="lazy">
      <span class="caption">${escapeHTML(w.title)} — ${escapeHTML(w.year)}</span>
    </button>
  `).join("");
}

/* ---------------- Work: ポップアップ ---------------- */
function setupWorkModal() {
  const modal = document.querySelector("[data-work-modal]");
  const grid = document.querySelector("[data-work-grid]");
  if (!modal || !grid) return;

  let currentIndex = 0;
  const prevBtn = modal.querySelector("[data-modal-prev]");
  const nextBtn = modal.querySelector("[data-modal-next]");

  function openWork(index) {
    if (!renderedWorks.length) return;
    // ★ 端まで行ったら循環させず、そこで止める
    currentIndex = Math.min(Math.max(index, 0), renderedWorks.length - 1);
    const w = renderedWorks[currentIndex];
    modal.querySelector("[data-modal-img]").src = w.image;
    modal.querySelector("[data-modal-img]").alt = w.title;
    modal.querySelector("[data-modal-title]").textContent = w.title;
    modal.querySelector("[data-modal-meta]").textContent = `${w.year} ・ ${w.medium}`;
    modal.querySelector("[data-modal-desc]").textContent = w.description || "";
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= renderedWorks.length - 1;
  }

  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".work-cell");
    if (!cell) return;
    const index = renderedWorks.findIndex((item) => item.id === cell.dataset.id);
    if (index === -1) return;
    openWork(index);
  });

  const close = () => {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  };
  const showPrev = () => openWork(currentIndex - 1);
  const showNext = () => openWork(currentIndex + 1);

  modal.querySelector("[data-modal-close]").addEventListener("click", close);
  modal.querySelector("[data-modal-prev]").addEventListener("click", showPrev);
  modal.querySelector("[data-modal-next]").addEventListener("click", showNext);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
  });
}

/* ----------------------------------------------------------------
   Home: キービジュアルの吹き出し(ニュース)
   ★ 表示する文章はここの HERO_NEWS 配列を編集してください。
     クリック(またはEnter/Space)、もしくは30秒ごとに自動で次の文章へ切り替わります。
------------------------------------------------------------------- */
const HERO_NEWS = [
  "*ようこそ *amra.jpへ **",
  "*shop を開設 しました *",
  "ha*mela**",
  "*circle jerk..."
];
const HERO_NEWS_AUTO_INTERVAL = 8000;

function setupHeroNews(heroBubble) {
  const bubble = document.querySelector("[data-hero-news]");
  const textEl = document.querySelector("[data-hero-news-text]");
  const caretEl = document.querySelector("[data-hero-caret]");
  if (!bubble || !textEl || !caretEl) return;

  let index = 0;
  let typeTimer = null;
  let autoTimer = null;

  function typeMessage(msg) {
    clearInterval(typeTimer);
    heroBubble?.resizeToText(msg); // 打ち始める前に、この文章に合わせて吹き出しの大きさを決めておく(タイプ中に伸び縮みしないように)
    caretEl.classList.remove("is-done", "is-blink-out");
    caretEl.classList.add("is-blinking");
    textEl.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      i++;
      textEl.textContent = msg.slice(0, i);
      if (i >= msg.length) {
        clearInterval(typeTimer);
        // 書き終わったら、ずっと続く点滅(is-blinking)から
        // 回数指定の点滅(is-blink-out)に切り替える。終わるとanimationendで消える
        caretEl.classList.remove("is-blinking");
        void caretEl.offsetWidth; // アニメーションを確実に再スタートさせるための強制リフロー
        caretEl.classList.add("is-blink-out");
      }
    }, 60);
  }

  caretEl.addEventListener("animationend", () => {
    if (caretEl.classList.contains("is-blink-out")) {
      caretEl.classList.remove("is-blink-out");
      caretEl.classList.add("is-done");
    }
  });

  function scheduleAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(showNext, HERO_NEWS_AUTO_INTERVAL);
  }

  function showNext() {
    index = (index + 1) % HERO_NEWS.length;
    typeMessage(HERO_NEWS[index]);
    scheduleAuto();
  }

  typeMessage(HERO_NEWS[index]);
  scheduleAuto();

  bubble.addEventListener("click", () => {
    // ドラッグ直後のclickは無視する(setupHeroBubble()が_heroDraggedを立てる)
    if (bubble._heroDragged) {
      bubble._heroDragged = false;
      return;
    }
    showNext();
  });
  bubble.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      showNext();
    }
  });
}

/* ----------------------------------------------------------------
   Home: キービジュアルの吹き出し ― ドラッグ移動・文章に合わせたサイズ変更・角丸・足の向き追従
   ★ 吹き出しは 本体(角丸長方形) + 足(三角形) を1本のSVG pathとして描画する。
     足の先はhero.pngの中心Pへ、足の付け根は本体の外周とO→Pの直線との交点Qにして、
     常にhero.pngの方向を指すよう毎フレーム(ドラッグ中・リサイズ中)に再計算している。
     本体の大きさは表示する文章の実測サイズから毎回計算する(resizeToText参照)。

     アルゴリズム:
       1. 本体(長方形)の中心Oと、hero.pngの中心Pを求める
       2. O→Pの直線が本体の外周(角丸を含む)と交わる点Qを求める(足の付け根)
       3. 線分QP上に QR = QP*QR_RATIO となる点Rを置く(足の先端)。
          ただし QR が OQ*QR_MAX_RATIO を超える場合はそちらを優先する(足が長くなりすぎないように)
       4. 外周上、Qから弧長 w だけ離れた2点S・TをQの付け根の左右に置く
       5. 外周をA→B→C→Dの順に辿るとき、S-T間(Qを含む区間)を飛ばしてS→R→Tを経由するようpathを組み立てる。
          角丸のコーナーがS-T間にかかる場合は、そのコーナーの円弧も同様に部分的に除外する。
------------------------------------------------------------------- */
function setupHeroBubble() {
  const posEl = document.querySelector("[data-hero-news-pos]");
  const bubble = document.querySelector("[data-hero-news]");
  const svg = document.querySelector("[data-hero-bubble-svg]");
  const path = document.querySelector("[data-hero-bubble-path]");
  const textEl = document.querySelector("[data-hero-news-text-box]"); // 位置を動かすのは「.hero-news-text」本体(枠)。[data-hero-news-text]はタイプライター表示用の中身のspanで別物
  const heroImg = document.querySelector(".hero-visual-frame img");
  if (!posEl || !bubble || !svg || !path || !textEl || !heroImg) return null;

  // ★★★ 見た目の調整はこの範囲の定数を書き換えるだけでOK ★★★
  // 本体の幅 = 文章の幅 × HERO_BUBBLE_WIDTH_RATIO + HERO_BUBBLE_PAD_X×2 (高さも同様)。
  // つまり「RATIO」が文章まわりの可動域(justify-content/align-itemsやオフセットで動かせる余地)の広さ、
  // 「PAD」がそこからさらに外側、本体の縁までの固定の余白、という役割分担になっている。
  const HERO_BUBBLE_WIDTH_RATIO = 1.2;   // 文章の幅に対する可動域の倍率。1に近いほど中央寄せなどの効果が小さくなる
  const HERO_BUBBLE_HEIGHT_RATIO = 2.8;  // 文字の高さ(1行分)に対する可動域の倍率
  const HERO_BUBBLE_MIN_WIDTH = 120;     // 本体の最小幅(px)。短い文章でも小さくなりすぎない下限
  const HERO_BUBBLE_MIN_HEIGHT = 56;     // 本体の最小高さ(px)
  const HERO_BUBBLE_MAX_WIDTH = 340;     // 本体の最大幅(px)。長い文章でも大きくなりすぎない上限
  const HERO_BUBBLE_MAX_HEIGHT = 90;    // 本体の最大高さ(px)
  const CORNER_RADIUS = 18;              // 本体の角の丸み(px)。0で直角、min(幅,高さ)/2でカプセル形になる
  const FOOT_HALF_WIDTH = 8;             // 足の付け根の幅を決めるパラメータw(QS=QT=w)
  const QR_RATIO = 1 / 16;               // 足の長さの基準(QPに対する割合)
  const QR_MAX_RATIO = 2 / 3;            // 足の長さの上限(OQに対する割合)。これ以上は伸ばさない
  const HERO_BUBBLE_PAD_X = 8;          // 本体の左右端から文章の可動域までの固定の余白(px)
  const HERO_BUBBLE_PAD_Y = 5;          // 本体の上下端から文章の可動域までの固定の余白(px)
  const HERO_BUBBLE_TEXT_OFFSET_X = 0;   // 文章の左右位置の微調整(px)。+で右へ、-で左へ(justify-contentでの配置に対する追加のずらし)
  const HERO_BUBBLE_TEXT_OFFSET_Y = 0;   // 文章の上下位置の微調整(px)。+で下へ、-で上へ(align-itemsでの配置に対する追加のずらし)
  // ★★★ ここまで ★★★

  let RECT_W = HERO_BUBBLE_MIN_WIDTH;
  let RECT_H = HERO_BUBBLE_MIN_HEIGHT;

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // --- 文章の実測サイズから本体サイズを決める -----------------------
  let measurer = null;
  function measureText(str) {
    if (!measurer) {
      measurer = document.createElement("span");
      measurer.className = "hero-news-text-measure";
      measurer.setAttribute("aria-hidden", "true");
      document.body.appendChild(measurer);
    }
    measurer.textContent = str || "";
    const rect = measurer.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function applySizing() {
    bubble.style.width = `${RECT_W}px`;
    bubble.style.height = `${RECT_H}px`;

    // 足(三角形)が本体の外にはみ出しても切れないよう、はみ出しうる最大量ぶんSVGの表示範囲を広げておく
    const maxOQ = Math.hypot(RECT_W / 2, RECT_H / 2);
    const pad = Math.ceil(maxOQ * QR_MAX_RATIO) + 8;
    svg.setAttribute("viewBox", `${-pad} ${-pad} ${RECT_W + pad * 2} ${RECT_H + pad * 2}`);
    svg.style.left = `${(-pad / RECT_W) * 100}%`;
    svg.style.top = `${(-pad / RECT_H) * 100}%`;
    svg.style.width = `${(1 + (2 * pad) / RECT_W) * 100}%`;
    svg.style.height = `${(1 + (2 * pad) / RECT_H) * 100}%`;
  }

  function resizeToText(text) {
    const measured = measureText(text);
    // ★ PAD_X/Yは「文章の可動域(measured*RATIO)」の外側に足す余白として計算する。
    //   以前はRATIO後にPADを差し引いていたため、RATIOが小さいと可動域が文章の実寸より
    //   狭くなってしまい(負の余白)、justify-content/align-itemsで動かす余地が無くなっていた。
    //   この計算なら可動域は常に measured*(RATIO-1) 以上確保され、中央寄せなどが必ず効く。
    RECT_W = clamp(measured.width * HERO_BUBBLE_WIDTH_RATIO + HERO_BUBBLE_PAD_X * 2, HERO_BUBBLE_MIN_WIDTH, HERO_BUBBLE_MAX_WIDTH);
    RECT_H = clamp(measured.height * HERO_BUBBLE_HEIGHT_RATIO + HERO_BUBBLE_PAD_Y * 2, HERO_BUBBLE_MIN_HEIGHT, HERO_BUBBLE_MAX_HEIGHT);
    applySizing();

    // 文章を置ける領域は「本体からHERO_BUBBLE_PAD_X/Yぶん内側」で固定する(文章の実寸ぴったりにはしない)。
    // ★ 前回はここを文章の実寸ぴったりに合わせていたため、領域内に余白が残らず、
    //   CSS側のjustify-content/align-itemsを変えても動く余地がなく効果が出なかった。
    //   余白を固定にしたことで、justify-content/align-itemsがその余白の中で効くようになる。
    textEl.style.left = `${HERO_BUBBLE_PAD_X}px`;
    textEl.style.right = `${HERO_BUBBLE_PAD_X}px`;
    textEl.style.top = `${HERO_BUBBLE_PAD_Y}px`;
    textEl.style.bottom = `${HERO_BUBBLE_PAD_Y}px`;
    // 微調整用のオフセットはtransformで独立して適用するので、justify-content/align-itemsの設定に関係なく必ず効く
    textEl.style.transform = `translate(${HERO_BUBBLE_TEXT_OFFSET_X}px, ${HERO_BUBBLE_TEXT_OFFSET_Y}px)`;

    updateBubblePath();
  }

  // --- 角丸長方形の外周ジオメトリ -------------------------------------
  // 本体の外周を「直線区間4本 + 四分円弧4本」の計8区間として扱う。
  // sは、左上の角丸が終わった位置(上辺の始点)を起点に時計回りで測った弧長。
  function geometry() {
    const r = clamp(CORNER_RADIUS, 0, Math.min(RECT_W, RECT_H) / 2);
    const straightW = RECT_W - 2 * r;
    const straightH = RECT_H - 2 * r;
    const arcLen = (Math.PI / 2) * r;
    let s = 0;
    const features = [];
    const push = (f) => { f.s0 = s; s += f.len; f.s1 = s; features.push(f); };
    push({ type: "edge", len: straightW, p0: { x: r, y: 0 }, p1: { x: RECT_W - r, y: 0 } });
    push({ type: "arc", len: arcLen, cx: RECT_W - r, cy: r, theta0: -Math.PI / 2 });
    push({ type: "edge", len: straightH, p0: { x: RECT_W, y: r }, p1: { x: RECT_W, y: RECT_H - r } });
    push({ type: "arc", len: arcLen, cx: RECT_W - r, cy: RECT_H - r, theta0: 0 });
    push({ type: "edge", len: straightW, p0: { x: RECT_W - r, y: RECT_H }, p1: { x: r, y: RECT_H } });
    push({ type: "arc", len: arcLen, cx: r, cy: RECT_H - r, theta0: Math.PI / 2 });
    push({ type: "edge", len: straightH, p0: { x: 0, y: RECT_H - r }, p1: { x: 0, y: r } });
    push({ type: "arc", len: arcLen, cx: r, cy: r, theta0: Math.PI });
    return { r, arcLen, perimeter: s, features };
  }

  function pointOnFeature(f, u, r) {
    if (f.type === "edge") {
      const t = f.len > 0 ? u / f.len : 0;
      return { x: f.p0.x + (f.p1.x - f.p0.x) * t, y: f.p0.y + (f.p1.y - f.p0.y) * t };
    }
    const theta = f.theta0 + (r > 0 ? u / r : 0);
    return { x: f.cx + r * Math.cos(theta), y: f.cy + r * Math.sin(theta) };
  }

  function arcLengthToPoint(sRaw, g) {
    const s = ((sRaw % g.perimeter) + g.perimeter) % g.perimeter;
    const f = g.features.find((f) => s >= f.s0 - 1e-6 && s <= f.s1 + 1e-6) || g.features[g.features.length - 1];
    return pointOnFeature(f, s - f.s0, g.r);
  }

  function pointNearEdge(f, point) {
    const eps = 0.5;
    if (Math.abs(f.p0.x - f.p1.x) < eps) return Math.abs(point.x - f.p0.x) < eps;
    return Math.abs(point.y - f.p0.y) < eps;
  }
  function edgeU(f, point) {
    if (Math.abs(f.p1.x - f.p0.x) > Math.abs(f.p1.y - f.p0.y)) {
      return f.len * (point.x - f.p0.x) / (f.p1.x - f.p0.x);
    }
    return f.len * (point.y - f.p0.y) / (f.p1.y - f.p0.y);
  }

  // O(中心)から方向(dx,dy)への光線が外周(角丸を含む)と交わる点Qと、その弧長sQを求める
  function findBoundaryHit(O, dx, dy, g) {
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
      const edge = g.features.find((f) => f.type === "edge" && pointNearEdge(f, point));
      const u = clamp(edgeU(edge, point), 0, edge.len);
      return { point, s: edge.s0 + u };
    }

    // 角丸ゾーン: 進行方向の象限からコーナーの円を特定し、光線と円の交点を求める
    const rightSide = dx > 0, bottomSide = dy > 0;
    const cx = rightSide ? RECT_W - r : r;
    const cy = bottomSide ? RECT_H - r : r;
    const arcFeature = g.features.find((f) => f.type === "arc" && f.cx === cx && f.cy === cy);
    const ocx = O.x - cx, ocy = O.y - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (ocx * dx + ocy * dy);
    const c = ocx * ocx + ocy * ocy - r * r;
    const disc = Math.max(0, b * b - 4 * a * c);
    const tHit = (-b - Math.sqrt(disc)) / (2 * a);
    const hx = O.x + dx * tHit, hy = O.y + dy * tHit;
    let dTheta = Math.atan2(hy - cy, hx - cx) - arcFeature.theta0;
    dTheta = ((dTheta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const u = clamp(r > 0 ? dTheta * r : 0, 0, arcFeature.len);
    return { point: { x: hx, y: hy }, s: arcFeature.s0 + u };
  }

  function buildBubblePathD(O, P) {
    const g = geometry();
    let dx = P.x - O.x;
    let dy = P.y - O.y;
    if (dx === 0 && dy === 0) { dy = 1; } // Oと同じ座標のときは仮に真下を向ける

    const hit = findBoundaryHit(O, dx, dy, g);
    const Q = hit.point;
    const sQ = hit.s;

    const OQ = Math.hypot(Q.x - O.x, Q.y - O.y);
    const QPx = P.x - Q.x;
    const QPy = P.y - Q.y;
    const QPlen = Math.hypot(QPx, QPy);
    // Q,O,Pは常に一直線上にあるので、(P-Q)と(Q-O)が同じ向き(内積>0)のときだけPはQより外側にある。
    // 内積<=0は「hero.pngの中心が本体の内側(境界より手前)にある」状態で、そのままだと
    // 足が本体の中身側に伸びてめり込んでしまうため、その場合は足を伸ばさない(R=Q)。
    const QOx = Q.x - O.x;
    const QOy = Q.y - O.y;
    const isOutward = (QPx * QOx + QPy * QOy) > 0;
    const QRmax = OQ * QR_MAX_RATIO;
    const QR = isOutward ? Math.min(QPlen * QR_RATIO, QRmax) : 0;
    const R = QR === 0
      ? { x: Q.x, y: Q.y }
      : { x: Q.x + (QPx / QPlen) * QR, y: Q.y + (QPy / QPlen) * QR };

    const perimeter = g.perimeter;
    const sS = ((sQ - FOOT_HALF_WIDTH) % perimeter + perimeter) % perimeter;
    const sT = ((sQ + FOOT_HALF_WIDTH) % perimeter + perimeter) % perimeter;
    const S = arcLengthToPoint(sS, g);
    const T = arcLengthToPoint(sT, g);

    // Tの位置からTを含む区間の残りを辿り、以降は次の区間を順番に辿って、
    // Sを含む区間に到達したらSの手前までで打ち切る(= S-T間=足の切れ目だけを飛ばす)。
    // ★ 角丸のコーナー円弧がS-T間にかかる場合も同じ扱いになり、円弧が部分的に除外される。
    const features = g.features;
    const n = features.length;
    const eps = 1e-6;
    const contains = (f, s) => s >= f.s0 - eps && s <= f.s1 + eps;
    const idxT = features.findIndex((f) => contains(f, sT));

    const segments = [];
    const fT = features[idxT];
    const tailStart = sT - fT.s0;
    if (fT.len - tailStart > eps) {
      segments.push({ type: fT.type, from: pointOnFeature(fT, tailStart, g.r), to: pointOnFeature(fT, fT.len, g.r) });
    }
    for (let k = 1; k <= n; k++) {
      const f = features[(idxT + k) % n];
      if (contains(f, sS)) {
        const headEnd = sS - f.s0;
        if (headEnd > eps) {
          segments.push({ type: f.type, from: pointOnFeature(f, 0, g.r), to: pointOnFeature(f, headEnd, g.r) });
        }
        break;
      }
      segments.push({ type: f.type, from: pointOnFeature(f, 0, g.r), to: pointOnFeature(f, f.len, g.r) });
    }

    const fmt = (n) => n.toFixed(2);
    let d = `M ${fmt(S.x)} ${fmt(S.y)} L ${fmt(R.x)} ${fmt(R.y)} L ${fmt(T.x)} ${fmt(T.y)} `;
    for (const seg of segments) {
      if (Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) < 1e-6) continue; // 角丸の半径0などで長さ0になった区間は描かない
      d += seg.type === "edge"
        ? `L ${fmt(seg.to.x)} ${fmt(seg.to.y)} `
        : `A ${fmt(g.r)} ${fmt(g.r)} 0 0 1 ${fmt(seg.to.x)} ${fmt(seg.to.y)} `;
    }
    d += "Z";
    return d;
  }

  function updateBubblePath() {
    const heroRect = heroImg.getBoundingClientRect();
    const ctm = svg.getScreenCTM();
    if (!ctm || heroRect.width === 0 || heroRect.height === 0) return;
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = heroRect.left + heroRect.width / 2;
    screenPoint.y = heroRect.top + heroRect.height / 2;
    const P = screenPoint.matrixTransform(ctm.inverse());
    const O = { x: RECT_W / 2, y: RECT_H / 2 };
    path.setAttribute("d", buildBubblePathD(O, P));
  }

  applySizing();

  // --- ドラッグ移動(ポインタイベント。--hero-news-dx/dyに移動量をpxで積み上げる) ---
  let dragging = false;
  let dragMoved = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startDx = 0;
  let startDy = 0;
  let dragDx = 0;
  let dragDy = 0;

  bubble.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startDx = dragDx;
    startDy = dragDy;
    bubble.setPointerCapture(e.pointerId);
    bubble.classList.add("is-dragging");
  });

  bubble.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const moveX = e.clientX - startPointerX;
    const moveY = e.clientY - startPointerY;
    if (!dragMoved && Math.hypot(moveX, moveY) > 4) dragMoved = true;
    dragDx = startDx + moveX;
    dragDy = startDy + moveY;
    posEl.style.setProperty("--hero-news-dx", `${dragDx}px`);
    posEl.style.setProperty("--hero-news-dy", `${dragDy}px`);
    updateBubblePath();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    bubble.classList.remove("is-dragging");
    if (bubble.hasPointerCapture(e.pointerId)) bubble.releasePointerCapture(e.pointerId);
    if (dragMoved) bubble._heroDragged = true; // setupHeroNews()側のclickハンドラで消費される
  }
  bubble.addEventListener("pointerup", endDrag);
  bubble.addEventListener("pointercancel", endDrag);

  // --- 位置がずれるたび(リサイズ・レイアウト変化・ドラッグ)にpathを再計算 ---
  window.addEventListener("resize", updateBubblePath);
  window.addEventListener("load", updateBubblePath);
  if (heroImg.complete) {
    updateBubblePath();
  } else {
    heroImg.addEventListener("load", updateBubblePath, { once: true });
  }
  requestAnimationFrame(updateBubblePath);

  // setupHeroNews()側から、表示する文章に合わせてサイズを変更できるようにする
  return { resizeToText, updatePath: updateBubblePath };
}

/* ---------------- HTMLエスケープ ---------------- */
function escapeHTML(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
