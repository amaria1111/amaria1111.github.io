/* ============================================================
   hero-bubbles-data.js
   Home: キービジュアルに浮かべる吹き出しの一覧
   ★ 吹き出しを増やしたいときは、この配列にオブジェクトを1つ追加するだけでOKです。
     見た目(本体サイズの決め方・角の丸み)や物理演算(反発・慣性)の調整は
     js/hero-bubbles.js の冒頭にある★マーク付き定数を参照してください。

   各項目:
     id           : 他の吹き出しの target から参照するときの名前(重複不可)
     target       : 足が向く先。"hero" なら hero.png、他の吹き出しの id を指定すると
                    その吹き出しを追従する(吹き出し同士を連結できる)
     messages     : 順番に表示する中身の配列。各要素は次のどちらか
                    ・文字列                       → タイプライターで表示する文章
                    ・{ image, alt, width, height } → 画像をそのまま表示(タイプはしない)
                      image : 画像ファイルのパス(必須)
                      alt   : 代替テキスト(省略可)
                      width / height : 表示する大きさ(px、省略時は正方形80px)
     autoInterval : 自動で次の中身に切り替わるまでの時間(ミリ秒)。画像も文章と同じ扱い
     startDelay   : ページを開いてから最初の文章を打ち始めるまでの遅延(ミリ秒)。
                    吹き出しごとにずらすと、一斉に喋り出さず順番に表示されていく演出になる
     initX / initY: 出現前(非表示のあいだ)だけ使う仮の位置で、実際に見える位置には影響しません。
                    見える位置は出現する瞬間に毎回、hero.png周辺の「当たり判定」円内のランダムな
                    場所に決まります(円の大きさは js/hero-bubbles.js の HERO_HIT_RADIUS_RATIO で調整)
     roam         : true にすると、文章が切り替わるたびに弾けるように消えて、少し待ってから
                    hero周辺のランダムな位置にポンと再出現するようになる(未指定/falseなら今まで通り
                    その場で切り替わる)。消えている時間の長さは js/hero-bubbles.js の
                    HERO_ROAM_HIDE_MIN/MAX で調整できる
   ============================================================ */
const HERO_BUBBLES = [
  {
    id: "news",
    target: "hero",
    initX: 0.30,
    initY: -1,
    autoInterval: 6000,
    startDelay: 300,
    roam: true,
    messages: [
      "*ようこそ *amra.jpへ **",
      "*shop を開設 しました *",
      "ha*mela**",
      "*circle jerk..."
    ],
  },

  {
    id: "a",
    target: "hero",
    initX: 0.30,
    initY: -1,
    autoInterval: 8500,
    startDelay: 700,
    roam: true,
    messages: [
      "*よろしく",
      "*ようこそ *amra.jpへ **",
      "オカエリナサ ト"

    ],
  },

  {
     id: "pic",
     target: "hero",
     initX: 0.10,
     initY: -1,
     autoInterval: 10000,
     startDelay: 1000,
     roam: true,
     messages: [
    
       { image: "images/amra.png", alt: "amra.jp", width: 10, height: 10 },
     ],
   },

   {
    id: "c",
    target: "hero",
    initX: 0.30,
    initY: -1,
    autoInterval: 7400,
    startDelay: 800,
    roam: true,
    messages: [
      "shop** ヘ* ゴー*",
      "*コンニチ*ハ",
      "***メラメラ*",
      "*ようこそ  *",

    ],
  },

  {
    id: "d",
    target: "hero",
    initX: 0.30,
    initY: -1,
    autoInterval: 5500,
    startDelay: 1000,
    roam: true,
    messages: [
      "お* 仕事...*",
      "ワクワク♪",
      "**オゲンキ*デ *"

    ],
  },



  // ★ 吹き出しを増やす例(コメントを外して文章・追従先などを書き換えて使ってください):
  // {
  //   id: "sub",
  //   target: "news",       // 他の吹き出し(id:"news")を追従させる例。"hero"にすればhero.pngを追従
  //   initX: 0.60,
  //   initY: -1.1,
  //   autoInterval: 6000,
  //   startDelay: 2400,
  //   roam: false,
  //   messages: ["*よろしくね*"],
  // },

  // ★ 画像を差し込む例(文章と画像は同じmessages配列に混ぜて使えます):
  // {
  //   id: "pic",
  //   target: "hero",
  //   initX: 0.10,
  //   initY: -1,
  //   autoInterval: 4000,
  //   startDelay: 600,
  //   roam: true,
  //   messages: [
  //     "*見て見て*",
  //     { image: "images/amra.png", alt: "amra.jp", width: 64, height: 64 },
  //   ],
  // },
];
