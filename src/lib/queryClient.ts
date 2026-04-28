import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分。招待制クローズドなので頻繁な再 fetch は不要
      gcTime: 1000 * 60 * 30,   // 30 分間メモリ保持（戻る操作で即表示）
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,    // staleTime 内なら mount で再 fetch しない
    },
  },
})
