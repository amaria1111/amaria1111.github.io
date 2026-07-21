/* ============================================================
   hero-bubbles.js
   Home: キービジュアルに浮かべる吹き出し(複数対応)
   ★ 吹き出しの中身(文章・数・追従先)は js/hero-bubbles-data.js の
     HERO_BUBBLES 配列で管理しています。ここでは仕組み(見た目の生成・物理演算)だけを扱います。

   吹き出しは 本体(角丸長方形) + 足(三角形) を1本のSVG pathとして描画します。
   足の先はtarget(hero.pngか他の吹き出し)の中心Pへ、足の付け根は本体の外周と
   O→Pの直線との交点Qにして、常にtargetの方向を指すよう毎フレーム再計算しています。

   アルゴリズム(吹き出し1個あたり):
     1. 本体(長方形)の中心Oと、targetの中心Pを求める
     2. O→Pの直線が本体の外周(角丸を含む)と交わる点Qを求める(足の付け根)
     3. 線分QP上に QR = QP*QR_RATIO となる点Rを置く(足の先端)。
        ただし QR が OQ*QR_MAX_RATIO を超える場合はそちらを優先する(足が長くなりすぎないように)
     4. 外周上、Qから弧長 w だけ離れた2点S・TをQの付け根の左右に置く
     5. 外周をA→B→C→Dの順に辿るとき、S-T間(Qを含む区間)を飛ばしてS→R→Tを経由するようpathを組み立てる。
        角丸のコーナーがS-T間にかかる場合は、そのコーナーの円弧も同様に部分的に除外する。

   吹き出しが複数あるときは、毎フレーム物理演算(反発+慣性)も行い、
   ドラッグして離すと勢いよく飛んでいき、他の吹き出しとは自然に避け合うようにしています。
------------------------------------------------------------- */

/* ★★★ 本体の見た目の調整はこの範囲の定数を書き換えるだけでOK ★★★
   本体の幅 = 文章の幅 × HERO_BUBBLE_WIDTH_RATIO + HERO_BUBBLE_PAD_X×2 (高さも同様)。 */
const HERO_BUBBLE_WIDTH_RATIO = 1.2;
const HERO_BUBBLE_HEIGHT_RATIO = 2.8;
const HERO_BUBBLE_MIN_WIDTH = 120;
const HERO_BUBBLE_MIN_HEIGHT = 56;
const HERO_BUBBLE_MAX_WIDTH = 340;
const HERO_BUBBLE_MAX_HEIGHT = 90;
// ★ 画像メッセージは文章と別の上限・下限を持つ(=画像の大きさに合わせて本体が小さくもなる)。
const HERO_BUBBLE_IMAGE_MIN_WIDTH = 60;
const HERO_BUBBLE_IMAGE_MIN_HEIGHT = 40;
const HERO_BUBBLE_IMAGE_MAX_WIDTH = 260;
const HERO_BUBBLE_IMAGE_MAX_HEIGHT = 260;
const CORNER_RADIUS = 100;             // 本体の角の丸み(px)。0で直角、min(幅,高さ)/2でカプセル形になる
const FOOT_HALF_WIDTH = 8;             // 足の付け根の幅を決めるパラメータw(QS=QT=w)
const QR_RATIO = 1 / 16;               // 足の長さの基準(QPに対する割合)
const QR_MAX_RATIO = 2 / 3;            // 足の長さの上限(OQに対する割合)
const QR_MIN_LEN = 6;                  // 足の長さの下限(px)。常にOQ<ORになるよう最低これだけは足を出す
const HERO_BUBBLE_PAD_X = 8;
const HERO_BUBBLE_PAD_Y = 5;
const HERO_BUBBLE_TEXT_OFFSET_X = 0;
const HERO_BUBBLE_TEXT_OFFSET_Y = 0;
const HERO_BUBBLE_SCREEN_PAD = 16; // ★ 本体の幅がウィンドウ幅を超えないよう、左右にこれだけ余白を残す(狭い画面対策)
const HERO_BUBBLE_IMAGE_DEFAULT_SIZE = 80; // ★ 画像メッセージでwidth/heightを省略したときの表示サイズ(px)
// ★ 画像メッセージは文章と別の余白を持つ(=本体の縁から画像までの間隔を個別に調整できる)。
const HERO_BUBBLE_IMAGE_PAD_X = 15;
const HERO_BUBBLE_IMAGE_PAD_Y = 10;
/* ★★★ ここまで ★★★ */

/* ★★★ 物理演算(反発・慣性)の調整はこの範囲の定数を書き換えるだけでOK ★★★
   吹き出しが1個だけのときは反発は使われません(相手がいないので反発しようがない)。 */
const HERO_PHYSICS_REPEL_PAD = 12;           // 吹き出し同士がこれ以上近づかないようにする余白(px)
const HERO_PHYSICS_REPEL_STRENGTH = 18;      // 反発の強さ。大きいほど勢いよく離れる
const HERO_PHYSICS_FRICTION = 0.90;          // 毎フレームの速度減衰(0〜1。小さいほどすぐ止まる)
const HERO_PHYSICS_MAX_SPEED = 900;          // 速度の上限(px/秒)。暴走防止
const HERO_PHYSICS_WALL_RESTITUTION = 0.4;   // ウィンドウの端・ヘッダー下端に当たったときの跳ね返り係数
/* ★★★ ここまで ★★★
   壁そのもの(上下左右の範囲)は「ウィンドウの表示領域」と「ヘッダーの下端」から毎フレーム計算する
   (下の getHeroBubbleBounds 参照)。ヘッダーより上・ウィンドウの外には出られない。 */

/* ★★★ 「消えて別の場所に再出現する」演出(hero-bubbles-data.jsで roam: true にした吹き出しのみ)
   の調整はこの範囲の定数を書き換えるだけでOK ★★★ */
const HERO_ROAM_HIDE_MIN = 400;   // (弾けて)消えてから再出現するまでの待ち時間(最小, ms)
const HERO_ROAM_HIDE_MAX = 2000;  // (弾けて)消えてから再出現するまでの待ち時間(最大, ms)
/* ★★★ ここまで ★★★ */

/* ★★★ hero.png周辺の「出現できる範囲」の調整用 ★★★
   吹き出しは、初回出現・roam再出現とも、必ずこの円の中のランダムな位置に現れる。 */
const HERO_HIT_RADIUS_RATIO = 0.55; // 出現範囲円の半径。hero.pngの対角線の半分に対する倍率
/* ★★★ ここまで ★★★ */

/* ★★★ hero.png自体の「当たり判定」(吹き出しを弾く壁)の調整用 ★★★
   本物の不透明部分ではなく、画像より一回り小さい楕円を仮の当たり判定として扱う
   (吹き出し同士の反発と同じ仕組みで、hero.pngだけは押されずに吹き出し側だけが弾かれる)。 */
const HERO_COLLISION_RADIUS_RATIO = 0.5; // hero.pngの幅・高さに対する当たり判定楕円の倍率(1で画像とほぼ同じ大きさ)
const HERO_COLLISION_PAD = 10;            // 吹き出しとの間に残す余白(px)
const HERO_COLLISION_STRENGTH = 10;       // 弾く強さ。大きいほど勢いよく弾かれる
/* ★★★ ここまで ★★★ */

/* ★★★ 出現・消滅アニメーションの調整用 ★★★
   出現: その場でスケール0→1にポンと飛び出す(拡大方向に少し行き過ぎてから収まる)。
   消滅: ほんの少し拡大してから縮んで消える、弾けるような動き。 */
const HERO_SPAWN_DURATION = 500;      // 出現アニメーションの所要時間(ms)
const HERO_SPAWN_START_SCALE = 0.15;  // 出現しはじめの大きさ(最終サイズに対する倍率)
const HERO_VANISH_DURATION = 350;     // 消滅アニメーションの所要時間(ms)
const HERO_VANISH_BUMP_RATIO = 0.20;  // 消える前にどれだけ拡大するか(1に対する追加分。0.25なら125%まで拡大)
const HERO_VANISH_BUMP_PHASE = 0.35;  // 消滅アニメーション全体のうち、拡大にかける時間の割合(残りは縮小)
/* ★★★ ここまで ★★★ */

function heroBubbleClamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function heroBubbleRandRange(min, max) { return min + Math.random() * (max - min); }
function heroEaseOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function heroEaseInCubic(t) { return t * t * t; }
// 楕円(半径rx, ry)の中心から角度angle方向に見た、中心から輪郭までの距離を返す
// (hero.pngの当たり判定を、画像の縦横比に合わせた楕円として扱うために使用)
function heroEllipseRadiusAtAngle(rx, ry, angle) {
  if (rx <= 0 || ry <= 0) return 0;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const denom = Math.sqrt((cos * cos) / (rx * rx) + (sin * sin) / (ry * ry));
  return denom > 0 ? 1 / denom : 0;
}
// 少しだけ行き過ぎてから収まる「ポン」と飛び出す感じのイージング(出現時の拡大に使用)
function heroEaseOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
// 消滅アニメーションのスケール推移: 少し拡大(0〜HERO_VANISH_BUMP_PHASE)→0まで縮小(残り)
function heroVanishScale(t) {
  if (t < HERO_VANISH_BUMP_PHASE) {
    return 1 + HERO_VANISH_BUMP_RATIO * heroEaseOutCubic(t / HERO_VANISH_BUMP_PHASE);
  }
  const p = (t - HERO_VANISH_BUMP_PHASE) / (1 - HERO_VANISH_BUMP_PHASE);
  // ★ 0ちょうどにはしない。scale(0)はSVGの座標変換行列が特異行列(逆行列なし)になり、
  //   足の向き計算がNaNになる原因になるため、ごく小さい正の値を下限にしておく。
  return Math.max(0.001, (1 + HERO_VANISH_BUMP_RATIO) * (1 - heroEaseInCubic(p)));
}

/* --- 文章の実測サイズを測るための隠し要素(全吹き出しで共有) --- */
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

/* --- 角丸長方形の外周ジオメトリ -------------------------------------
   本体の外周を「直線区間4本 + 四分円弧4本」の計8区間として扱う。
   sは、左上の角丸が終わった位置(上辺の始点)を起点に時計回りで測った弧長。 */
function heroBubbleGeometry(RECT_W, RECT_H) {
  const r = heroBubbleClamp(CORNER_RADIUS, 0, Math.min(RECT_W, RECT_H) / 2);
  const straightW = RECT_W - 2 * r;
  const straightH = RECT_H - 2 * r;
  const arcLen = (Math.PI / 2) * r;
  let s = 0;
  const features = [];
  const push = (f) => { f.s0 = s; s += f.len; f.s1 = s; features.push(f); };
  // ★ cx/cyだけでは角を特定できない場合がある: 角丸半径rが高さの半分(RECT_H/2)のとき、
  //   左上と左下(・右上と右下)の円弧は中心座標が完全に一致してしまう(縦の直線区間が無いカプセル形)。
  //   そのため各円弧には corner ラベルを付け、heroBubbleFindBoundaryHitではcx/cyではなく
  //   このラベルで円弧を一意に特定する。
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

// O(中心)から方向(dx,dy)への光線が外周(角丸を含む)と交わる点Qと、その弧長sQ、
// そしてQにおける「外周の外向き法線normal」を求める。
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

  // 角丸ゾーン: 進行方向の象限からコーナーを特定し、光線と円の交点を求める
  const rightSide = dx > 0, bottomSide = dy > 0;
  const cornerKey = (bottomSide ? "b" : "t") + (rightSide ? "r" : "l");
  const arcFeature = g.features.find((f) => f.type === "arc" && f.corner === cornerKey);
  const cx = arcFeature.cx, cy = arcFeature.cy;
  const ocx = O.x - cx, ocy = O.y - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (ocx * dx + ocy * dy);
  const c = ocx * ocx + ocy * ocy - r * r;
  const disc = Math.max(0, b * b - 4 * a * c);
  // ★ 2つの解のうち「遠い方(+側)」を使う。Oはこの円の中心から見て外側にあるため、
  //   近い方(-側)は本体の中(角丸が始まる手前の直線部分寄り)を指してしまい、
  //   Qが本体の内側に来てしまう(=足がめり込む)原因になる。
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
  if (dx === 0 && dy === 0) { dy = 1; } // Oと同じ座標のときは仮に真下を向ける

  const hit = heroBubbleFindBoundaryHit(O, dx, dy, g, RECT_W, RECT_H);
  const Q = hit.point;
  const sQ = hit.s;
  const N = hit.normal; // QPが求まらない退化ケースの保険用

  const OQ = Math.hypot(Q.x - O.x, Q.y - O.y);
  const QPx = P.x - Q.x;
  const QPy = P.y - Q.y;
  const QPlen = Math.hypot(QPx, QPy);
  // ★ 足の先端Rは基本的にQ→P方向(targetへ向く方向)に伸ばす。Qが外周の「本当の」交点であれば、
  //   Oは凸形状の内部・Pは外部にあるため、Q→P方向の線分は必ず本体の外側だけを通る
  //   (=このRの決め方では原理的にめり込まない)。QPlenがほぼ0の退化ケースだけ法線Nにフォールバックする。
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

  // Tの位置からTを含む区間の残りを辿り、以降は次の区間を順番に辿って、
  // Sを含む区間に到達したらSの手前までで打ち切る(= S-T間=足の切れ目だけを飛ばす)。
  const features = g.features;
  const n = features.length;
  const eps = 1e-6;
  const contains = (f, s) => s >= f.s0 - eps && s <= f.s1 + eps;
  // ★ 万一sQ/sT/sSがNaN等の異常値になった場合、findIndexは常に-1を返す。features[-1]は
  //   undefinedになり直後の.s0アクセスで例外が発生するため、0番目にフォールバックしておく。
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
    if (Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) < 1e-6) continue; // 角丸の半径0などで長さ0になった区間は描かない
    d += seg.type === "edge"
      ? `L ${fmt(seg.to.x)} ${fmt(seg.to.y)} `
      : `A ${fmt(g.r)} ${fmt(g.r)} 0 0 1 ${fmt(seg.to.x)} ${fmt(seg.to.y)} `;
  }
  d += "Z";
  return d;
}

/* ----------------------------------------------------------------
   1個の吹き出しのDOMを作り、サイズ計算・path再計算のためのメソッドを持つ
   インスタンスを返す。位置(x,y)・速度(vx,vy)は setupHeroBubbles() 側の
   物理演算ループが管理する(このインスタンス自体は「1個の見た目」の責務のみ持つ)。
------------------------------------------------------------------- */
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
    hidden: false, // 非表示中はtrue。trueの間は物理演算(反発・壁)を止める
    spawn: null,  // 出現アニメーション中だけ {startTime, duration} が入る(下のapplyTransform参照)
    vanish: null, // 消滅アニメーション中だけ {startTime, duration} が入る
    positioned: false, // 初期位置をまだ決めていない(hero-visualのサイズが取れ次第、物理演算ループの最初のフレームで決める)
  };

  instance.setHidden = function setHidden(hidden) {
    instance.hidden = hidden;
    instance.posEl.classList.toggle("is-hidden", hidden);
  };

  // その場でスケール0→1にポンと出現するアニメーションを開始する(位置は動かさない)
  instance.startSpawn = function startSpawn() {
    instance.spawn = { startTime: performance.now(), duration: HERO_SPAWN_DURATION };
  };

  // 少し拡大してから縮んで消える、弾けるようなアニメーションを開始する(位置は動かさない)
  instance.startVanish = function startVanish() {
    instance.vanish = { startTime: performance.now(), duration: HERO_VANISH_DURATION };
  };

  function applySizing() {
    instance.bubble.style.width = `${instance.RECT_W}px`;
    instance.bubble.style.height = `${instance.RECT_H}px`;
    // 足(三角形)が本体の外にはみ出しても切れないよう、はみ出しうる最大量ぶんSVGの表示範囲を広げておく
    const maxOQ = Math.hypot(instance.RECT_W / 2, instance.RECT_H / 2);
    const pad = Math.ceil(maxOQ * QR_MAX_RATIO) + 8;
    instance.svg.setAttribute("viewBox", `${-pad} ${-pad} ${instance.RECT_W + pad * 2} ${instance.RECT_H + pad * 2}`);
    instance.svg.style.left = `${(-pad / instance.RECT_W) * 100}%`;
    instance.svg.style.top = `${(-pad / instance.RECT_H) * 100}%`;
    instance.svg.style.width = `${(1 + (2 * pad) / instance.RECT_W) * 100}%`;
    instance.svg.style.height = `${(1 + (2 * pad) / instance.RECT_H) * 100}%`;
  }

  // 本体サイズを「中身(文章 or 画像)の大きさ」から決めて反映する共通処理。
  // contentW/contentHは、パディングを足す前の中身そのものの幅・高さ(px)。
  // minW/maxW/minH/maxHは呼び出し側(文章用・画像用)で別々の上限・下限を、padX/padYは別々の余白を
  // 渡せるようにするための引数。
  function applyContentSize(contentW, contentH, minW, maxW, minH, maxH, padX, padY) {
    // ★ スマホなど画面が狭いときは、本体の最大幅も画面幅に合わせて縮める。
    //   これをせずウィンドウ幅より広い本体ができると、位置をどれだけクランプしても
    //   画面内に収まりきらず、はみ出した分だけ横スクロールできてしまっていた。
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

  // 画像メッセージ({image:"...",width,height})用。width/heightは表示したい大きさ(px)で、
  // 指定が無ければHERO_BUBBLE_IMAGE_DEFAULT_SIZEを使う。文章のような可動域倍率(RATIO)は掛けない。
  // 上限・下限・余白も文章とは別のHERO_BUBBLE_IMAGE_MIN/MAX_*・HERO_BUBBLE_IMAGE_PAD_*を使うので、
  // 画像の大きさ・本体の縁からの間隔を文章側の設定に縛られず個別に調整できる。
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
      if (t >= 1) instance.vanish = null; // 完了したら通常のtranslateだけの状態に戻す(非表示化は呼び出し側が行う)
      return;
    }
    if (instance.spawn) {
      const t = heroBubbleClamp((now - instance.spawn.startTime) / instance.spawn.duration, 0, 1);
      const scale = HERO_SPAWN_START_SCALE + (1 - HERO_SPAWN_START_SCALE) * heroEaseOutBack(t);
      instance.posEl.style.transform = `translate(${instance.x}px, ${instance.y}px) scale(${scale})`;
      if (t >= 1) instance.spawn = null; // 完了したら通常のtranslateだけの状態に戻す
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
    // ★ 消滅アニメーションでスケールが0(付近)になると、CTMが特異行列(逆行列なし)になり
    //   P.x/P.yがNaNになることがある。NaNのままheroBubblePathDに渡すと内部で例外が発生し、
    //   毎フレーム呼ばれている物理演算ループ(requestAnimationFrame)全体が止まってしまう
    //   (=このバブルが再表示されない上に、他の全バブルの位置更新も止まる)ため、ここで弾く。
    if (!Number.isFinite(P.x) || !Number.isFinite(P.y)) return;
    const O = { x: instance.RECT_W / 2, y: instance.RECT_H / 2 };
    instance.path.setAttribute("d", heroBubblePathD(O, P, instance.RECT_W, instance.RECT_H));
  };

  applySizing();
  return instance;
}

/* ----------------------------------------------------------------
   吹き出しをまとめて生成し、タイプライター表示・ドラッグ・物理演算を配線する。
   home以外のページには data-hero-bubbles が無いので何もしません。
------------------------------------------------------------------- */
function setupHeroBubbles() {
  const container = document.querySelector("[data-hero-bubbles]");
  const heroVisual = document.querySelector(".hero-visual");
  const heroImg = document.querySelector(".hero-visual-frame img");
  const headerEl = document.querySelector(".site-header");
  if (!container || !heroVisual || typeof HERO_BUBBLES === "undefined" || !HERO_BUBBLES.length) return;

  const instances = HERO_BUBBLES.map((config) => createHeroBubble(config));
  const byId = new Map(instances.map((inst) => [inst.id, inst]));
  instances.forEach((inst) => container.appendChild(inst.posEl));

  // ★ 吹き出しが動ける範囲(ローカル座標。inst.x/yと同じ単位=hero-visualの左上を原点とするpx)。
  //   ウィンドウの表示領域と、ヘッダーの下端(.site-header)から毎フレーム計算する。
  //   ヘッダーがposition:stickyでスクロールに追従するため、この範囲も自動でスクロールに追従する。
  function getHeroBubbleBounds(inst) {
    const visualRect = heroVisual.getBoundingClientRect();
    const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
    const viewportBottom = window.innerHeight - visualRect.top;
    const viewportLeft = -visualRect.left;
    const viewportRight = window.innerWidth - visualRect.left;
    // ★ 上限は「一番上までスクロールした状態でのヘッダー下端」に固定する(文書上の絶対位置)。
    //   .site-headerはposition:stickyなので、headerRect.bottom自体は常にビューポート上端付近に
    //   留まり続ける(=スクロールに追従する)。現在のビューポート上端(スクロール量に応じて動く値)を
    //   あわせて使うと、スクロールするたびに上限も動いてウィンドウ上部に引っかかる動きになってしまう
    //   ため、上限にはこの固定ラインだけを使い、現在のビューポート上端は考慮しない。
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

  // 吹き出しが出現する(=初回出現・roam再出現とも)ときの位置を、hero.png中心の「当たり判定」円の中の
  // ランダムな座標(ローカル座標)として返す。ウィンドウ・ヘッダーの範囲(getHeroBubbleBounds)は超えない。
  function pickHeroHitPosition(inst) {
    const bounds = getHeroBubbleBounds(inst);
    const heroRect = heroImg.getBoundingClientRect();
    if (heroRect.width === 0) {
      // hero.pngがまだレイアウトされていない場合の保険
      return { x: heroBubbleClamp(0, bounds.minX, bounds.maxX), y: heroBubbleClamp(0, bounds.minY, bounds.maxY) };
    }
    const visualRect = heroVisual.getBoundingClientRect();
    const heroCenterX = heroRect.left + heroRect.width / 2 - visualRect.left;
    const heroCenterY = heroRect.top + heroRect.height / 2 - visualRect.top;
    const hitRadius = Math.hypot(heroRect.width, heroRect.height) / 2 * HERO_HIT_RADIUS_RATIO;
    const angle = Math.random() * Math.PI * 2;
    const r = hitRadius * Math.sqrt(Math.random()); // sqrtで円内に均等分布させる
    return {
      x: heroBubbleClamp(heroCenterX + r * Math.cos(angle) - inst.RECT_W / 2, bounds.minX, bounds.maxX),
      y: heroBubbleClamp(heroCenterY + r * Math.sin(angle) - inst.RECT_H / 2, bounds.minY, bounds.maxY),
    };
  }

  // 足が向く先(target)の中心を画面座標(px)で返す。"hero"ならhero.png、それ以外は他の吹き出しのid
  function resolveTargetScreenPoint(inst) {
    const el = inst.config.target === "hero" ? heroImg : (byId.get(inst.config.target)?.bubble ?? null);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  /* --- 文章/画像の表示(吹き出しごとに独立してmessagesを巡回)
     ★ messagesの各要素は文字列(タイプライター表示)か、{ image: "画像パス", alt, width, height }
       のオブジェクト(画像をそのまま表示)のどちらか。詳しくは hero-bubbles-data.js 参照。
     ★ roam:true (hero-bubbles-data.js) の吹き出しは、切り替わるたびに
       いったん消えて、少し待ってからhero周辺のランダムな位置に再出現する。
       roam未指定/falseの吹き出しは、今まで通りその場で次の中身に切り替わる。 --- */
  instances.forEach((inst) => {
    const messages = inst.config.messages || [];
    if (!messages.length) return;
    let index = 0;
    let typeTimer = null;
    let cycleTimer = null; // 「表示完了→次まで待つ」「非表示→再出現まで待つ」を1本のタイマーで管理

    // ★ showMessage/showNext/hideThenReappearのどこから呼ばれても、進行中のタイマーを必ず1つ残らず
    //   止めてから次に進む。これを徹底しないと、古いタイマーが後から発火してcycleTimerを奪い合い、
    //   非表示のまま二度と戻ってこなくなる・意図しない場所で切り替わる、といった不整合が起きる。
    function clearPendingTimers() {
      clearInterval(typeTimer);
      clearTimeout(cycleTimer);
    }

    // msgが文字列ならタイプライター表示、{image:...}のオブジェクトなら画像表示に振り分ける
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
      inst.resizeToText(msg); // 打ち始める前に、この文章に合わせて吹き出しの大きさを決めておく(タイプ中に伸び縮みしないように)
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
          void inst.caretEl.offsetWidth; // アニメーションを確実に再スタートさせるための強制リフロー
          inst.caretEl.classList.add("is-blink-out");
          cycleTimer = setTimeout(showNext, inst.config.autoInterval || 8000);
        }
      }, 60);
    }

    // 画像はタイピングせず即座に表示する(カーソルも出さない)。表示時間はautoIntervalで文章と共通
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
      // ★ ドラッグ中に自動切り替えのタイミングが来た場合は、消す/切り替えるのを少し待つ。
      //   ドラッグ中に非表示化するとポインタ操作と状態が食い違い、掴んだまま離せなくなることがあった。
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

    // 弾けて消える → 実際に非表示化 → ランダムな待ち時間 → hero当たり判定内のランダムな位置にポンと現れる → 次の中身を表示する
    function hideThenReappear() {
      inst.startVanish();
      cycleTimer = setTimeout(() => {
        inst.setHidden(true); // 弾けるアニメーションが終わってから、実際に非表示(クリック不可)にする
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

    // ★ startDelayぶん待ってから最初の中身を表示する(吹き出しごとにずらして順番に出現させる演出用)。
    //   待っている間は本体ごと非表示にしておき、時間が来たらhero当たり判定内のランダムな位置にポンと現れる。
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
      // ドラッグ直後のclickは無視する(下のポインタイベントが_heroDraggedを立てる)
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

  /* --- ドラッグ移動(離した瞬間の勢いを初速として引き継ぐ=投げる動き) --- */
  instances.forEach((inst) => {
    let dragMoved = false;
    let startPointerX = 0, startPointerY = 0, startX = 0, startY = 0;
    let samples = []; // 直近のポインタ位置と時刻。離した瞬間の初速計算に使う

    inst.bubble.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (inst.hidden || inst.vanish) return; // 消える/消えている最中は掴めないようにする
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
      // ★ ドラッグ中も、ヘッダーの下端・ウィンドウの外には出られないようにその場でクランプする
      const bounds = getHeroBubbleBounds(inst);
      inst.x = heroBubbleClamp(startX + moveX, bounds.minX, bounds.maxX);
      inst.y = heroBubbleClamp(startY + moveY, bounds.minY, bounds.maxY);
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (samples.length > 6) samples.shift(); // 直近数サンプルだけ見れば十分(古い動きに引っ張られないように)
    });

    function endDrag(e) {
      if (!inst.dragging) return;
      inst.dragging = false;
      inst.bubble.classList.remove("is-dragging");
      if (inst.bubble.hasPointerCapture(e.pointerId)) inst.bubble.releasePointerCapture(e.pointerId);
      if (dragMoved) inst.bubble._heroDragged = true; // クリックハンドラ側で消費される

      // ★ 直近のポインタ移動から速度を計算し、離した瞬間の勢いをそのまま慣性として与える
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

  // 初期位置は、hero-visualの実サイズが取れ次第、物理演算ループの最初のフレームで1回だけ決める
  // (それ以降はドラッグ・物理演算だけが位置を動かす。initX/initYの意味はhero-bubbles-data.js参照)
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

  /* --- 毎フレーム: 物理演算(反発+慣性+壁)と、足の向きの再計算 --- */
  let lastTime = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); // ★ タブを離れて戻ってきた時などの大ジャンプを防ぐ上限
    lastTime = now;

    if (ensurePositioned()) {
      // hero.pngの当たり判定(楕円)の中心・半径を1フレームにつき1回だけ計算しておく(ローカル座標)
      const heroRect = heroImg.getBoundingClientRect();
      const visualRectNow = heroVisual.getBoundingClientRect();
      const heroCollision = heroRect.width > 0 ? {
        cx: heroRect.left + heroRect.width / 2 - visualRectNow.left,
        cy: heroRect.top + heroRect.height / 2 - visualRectNow.top,
        rx: (heroRect.width / 2) * HERO_COLLISION_RADIUS_RATIO,
        ry: (heroRect.height / 2) * HERO_COLLISION_RADIUS_RATIO,
      } : null;

      instances.forEach((a) => {
        if (a.dragging || a.hidden || a.spawn || a.vanish) return; // 非表示中・出現/消滅アニメーション中は物理演算を止める
        let fx = 0, fy = 0;
        const ax = a.x + a.RECT_W / 2, ay = a.y + a.RECT_H / 2;

        // 吹き出し同士の反発(近づきすぎたら押し返す。非表示中の吹き出しからは押されない)
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

        // hero.png自体の当たり判定(楕円)。heroは押し返されず、吹き出し側だけが弾かれる
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

        // ★ ヘッダーの下端・ウィンドウの外に出そうになったら跳ね返す(自由に投げても迷子にならないように)
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
