// 图片路径集中在这里。值是 public/ 下的网址路径（如 '/img/bear-idle.webp'）；null＝还没有图，组件显示占位。
// C2 素材 2026-10-11 已填（原图在 assets-src/img/，用 scripts/cutout.py 去背转 WebP）。
// 组件一律透过 ui/Art.tsx 取图；填了路径但档案读不到时也会退回占位。

export type AssetKey =
  | 'bear.idle'
  | 'bear.drum'
  | 'bear.happy'
  | 'bear.spin'
  | 'bear.cheer'
  | 'bear.tamb'
  | 'icon.strawberry'
  | 'icon.lemon'
  | 'pad.drum'
  | 'pad.tamb'
  | 'bg.main'
  | 'world.1'
  | 'world.2'
  | 'world.3'
  | 'world.4'
  | 'world.5'
  | 'world.6'
  | 'friend.1'
  | 'friend.2'
  | 'friend.3'
  | 'friend.4'
  | 'friend.5'

export const ASSETS: Record<AssetKey, string | null> = {
  'bear.idle': '/img/bear-idle.webp',
  'bear.drum': '/img/bear-drum.webp',
  'bear.happy': '/img/bear-jump.webp',
  'bear.spin': '/img/bear-spin.webp',
  'bear.cheer': '/img/bear-cheer.webp',
  'bear.tamb': '/img/bear-tamb.webp', // 摇铃鼓（示范铃鼓时用）
  'icon.strawberry': '/img/icon-strawberry.webp',
  'icon.lemon': '/img/icon-lemon.webp',
  'pad.drum': '/img/pad-drum.webp',
  'pad.tamb': '/img/pad-tamb.webp',
  'bg.main': '/img/bg-main.webp',
  'world.1': '/img/world-1.webp',
  'world.2': '/img/world-2.webp',
  'world.3': '/img/world-3.webp',
  'world.4': '/img/world-4.webp',
  'world.5': '/img/world-5.webp',
  'world.6': '/img/world-6.webp',
  'friend.1': '/img/friend-1.webp',
  'friend.2': '/img/friend-2.webp',
  'friend.3': '/img/friend-3.webp',
  'friend.4': '/img/friend-4.webp',
  'friend.5': '/img/friend-5.webp',
}

export function assetUrl(key: AssetKey): string | null {
  return ASSETS[key]
}
