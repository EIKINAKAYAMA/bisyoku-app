// PWA アイコン生成設定（npm run pwa:icons から使用）。
//
// minimal-2023 preset の apple/maskable はデフォルトで padding: 0.3 + background: 'white'
// になっており、iOS ホーム画面 / Android アダプティブアイコンで「アイコン外側に白い余白」が
// 出る原因になっていた。padding を 0 にし、背景もブランドカラーで埋めることで
// 白フチが消えるようにする。
//
// favicon.svg は `rx` を外してフルブリードのグラデーションにしたので、padding 0 でも
// 端まで色が回り、iOS / Android が自前で角丸マスクを当てて綺麗に表示される。

const brand = '#f56a14'

export default {
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: brand, fit: 'contain' },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: brand, fit: 'contain' },
    },
  },
  images: ['public/favicon.svg'],
}
