import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分。招待制クローズドなので頻繁な再 fetch は不要
      gcTime: 1000 * 60 * 30,   // 30 分間メモリ保持（戻る操作で即表示）
      retry: 1,
      refetchOnWindowFocus: false,
      // refetchOnMount は default の true。staleTime 内なら自動的に refetch されないので、
      // 通常のページ間遷移は cache から即時表示。一方で invalidateQueries により stale 化
      // された query は、次に mount された瞬間に refetch される（= 登録・編集後の反映）。
    },
  },
})
