import * as React from 'react'
import { cn } from '@/lib/utils'

type Props = {
  /** アイコン画像 URL（Google の lh3.googleusercontent.com 等） */
  src?: string | null
  /** 画像が無い時に出す代替テキスト（先頭 1 文字） */
  fallback: string
  alt?: string
  className?: string
}

/** 画像が無い／読込失敗 → 角丸で初頭文字を表示 */
export function Avatar({ src, fallback, alt, className }: Props) {
  const [errored, setErrored] = React.useState(false)
  const useImage = !!src && !errored

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-foreground',
        className
      )}
      aria-label={alt}
    >
      {useImage ? (
        <img
          src={src!}
          alt={alt ?? ''}
          // Google プロフ画像は外部参照ポリシー次第で blocked になることがあるため、参照元を渡さない
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="select-none text-sm font-semibold leading-none">
          {firstChar(fallback)}
        </span>
      )}
    </span>
  )
}

/** UTF-16 サロゲートを意識した先頭文字取り出し */
function firstChar(s: string): string {
  return Array.from(s)[0] ?? '?'
}
