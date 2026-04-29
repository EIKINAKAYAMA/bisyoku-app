import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  /** history が空の時（直接訪問・PWA 起動直後・リロード後）に飛ばす行先 */
  fallback?: string
}

export function BackButton({ fallback = '/' }: Props) {
  const navigate = useNavigate()
  const onClick = () => {
    // React Router v6 は history.state.idx でスタック位置を持つ。
    // idx === 0 はアプリ内で 1 ページ目 → navigate(-1) するとブラウザ外（or 何も起きない）になるので
    // 意味のある親ルートに置き換える。
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="-ml-2">
      <ChevronLeft className="h-4 w-4" /> 戻る
    </Button>
  )
}
