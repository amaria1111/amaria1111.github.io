
document.addEventListener("DOMContentLoaded", async () => {
  await loadPartials();
  setupNavToggle();
  renderWorkGrid();
  setupWorkModal();

  if (typeof setupHeroBubbles === "function") setupHeroBubbles();
  revealPageContent();
});

function revealPageContent() {
  requestAnimationFrame(() => {
    document.querySelector("main")?.classList.add("is-revealed");
    document.querySelector("[data-work-grid]")?.classList.add("is-revealed");
  });
}

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

function highlightCurrentNav() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav-key]").forEach((a) => {
    if (a.getAttribute("data-nav-key") === current) {
      a.setAttribute("aria-current", "page");
    }
  });
}

function setYear() {
  const el = document.querySelector("[data-year]");
  if (el) el.textContent = new Date().getFullYear();
}

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

let renderedWorks = [];

function renderWorkGrid() {
  const grid = document.querySelector("[data-work-grid]");
  if (!grid || typeof WORKS === "undefined") return;

  const limit = Number(grid.dataset.limit) || WORKS.length;

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

function setupWorkModal() {
  const modal = document.querySelector("[data-work-modal]");
  const grid = document.querySelector("[data-work-grid]");
  if (!modal || !grid) return;

  let currentIndex = 0;
  const prevBtn = modal.querySelector("[data-modal-prev]");
  const nextBtn = modal.querySelector("[data-modal-next]");

  function openWork(index) {
    if (!renderedWorks.length) return;

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

function escapeHTML(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
