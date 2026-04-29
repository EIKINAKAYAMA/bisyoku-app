import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = {
  /** chunk load 失敗 = 古い世代のアセットを掴んでいる。リロードで救済 */
  chunkError: boolean
  /** その他予期せぬ例外 = ユーザーに再読み込みを促す */
  otherError: Error | null
}

const RELOAD_KEY = 'chunk-reload-attempted'

const isChunkLoadError = (e: unknown): boolean => {
  if (!(e instanceof Error)) return false
  if (e.name === 'ChunkLoadError') return true
  // Vite/Rollup は "Failed to fetch dynamically imported module" を投げる
  return /chunk|dynamically imported module/i.test(e.message)
}

/**
 * 旧 SW + 新デプロイで lazy chunk URL が解決できず白画面になる事故を救済する。
 * - chunk error → 1 度だけ自動リロード（無限ループを sessionStorage で防止）
 * - 自動リロード後にも再発したら手動再読み込みボタンを出す（出口を必ず作る）
 * - その他の例外 → エラー画面 + 再読み込みボタン
 */
export class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { chunkError: false, otherError: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    if (isChunkLoadError(error)) return { chunkError: true }
    return { otherError: error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
    if (isChunkLoadError(error)) {
      if (sessionStorage.getItem(RELOAD_KEY) !== '1') {
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
      }
      // 既に 1 度試した後の再発はここで止める。render 側で手動ボタンを出す。
    }
  }

  private handleManualReload = () => {
    sessionStorage.removeItem(RELOAD_KEY)
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.chunkError) {
      const alreadyTried = sessionStorage.getItem(RELOAD_KEY) === '1'
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-muted-foreground">
            {alreadyTried
              ? '読み込みに失敗しました。再読み込みをお試しください。'
              : '更新を反映中...'}
          </p>
          {alreadyTried && (
            <button
              type="button"
              onClick={this.handleManualReload}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              再読み込み
            </button>
          )}
        </div>
      )
    }
    if (this.state.otherError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-destructive">予期せぬエラーが発生しました</p>
          <p className="text-sm text-muted-foreground">
            {this.state.otherError.message}
          </p>
          <button
            type="button"
            onClick={this.handleManualReload}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            再読み込み
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
