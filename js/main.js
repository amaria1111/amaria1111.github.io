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
  // home以外(work/about/contact)は js/hero-bubbles.js 自体を読み込んでいないため、
  // 関数の存在チェックをしてから呼ぶ(呼ばないとReferenceErrorになり、以降の revealPageContent() が
  // 実行されず本文が表示されないままになる)。実装は js/hero-bubbles.js、文章・数の設定は js/hero-bubbles-data.js
  if (typeof setupHeroBubbles === "function") setupHeroBubbles();
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

/* ---------------- HTMLエスケープ ---------------- */
function escapeHTML(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
