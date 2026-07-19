/* ============================================================
   works-data.js
   ★ 作品の追加はこの配列に1件足すだけです。work.html は触りません。

   - id          : 表示用の連番
   - title       : 作品タイトル
   - year        : 制作年
   - medium      : カテゴリ・技法
   - image       : 画像パス(images フォルダ内)
   - description : ポップアップで表示する説明文
   ============================================================ */

const WORKS = [
  { id: "01", title: "紙の余熱",     year: "2025", medium: "Zine",         image: "images/works/work-01.png", description: "リソグラフで刷った自主制作のZine。5号まで継続中。" },
  { id: "02", title: "窓辺の記録",   year: "2024", medium: "Illustration", image: "images/works/work-02.png", description: "日々のスケッチをまとめたイラストシリーズ。" },
  { id: "03", title: "無題の展示",   year: "2024", medium: "Exhibition",   image: "images/works/work-03.jpg", description: "都内ギャラリーでの二人展に出品した作品群。" },
  { id: "04", title: "夜の配達",     year: "2023", medium: "Editorial",    image: "images/work-04.jpg", description: "フリーペーパーに寄稿した挿絵と誌面デザイン。" },
  { id: "05", title: "同人誌即売会向けポスター", year: "2023", medium: "Print", image: "images/work-05.jpg", description: "即売会当日に配布したフリーペーパー兼ポスター。" },
  { id: "06", title: "小さな標本",   year: "2022", medium: "Web",          image: "images/work-06.jpg", description: "個人サイト上で不定期に公開しているWeb限定作品。" }
];
