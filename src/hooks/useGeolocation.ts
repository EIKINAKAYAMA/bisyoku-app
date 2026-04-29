import { useCallback, useState } from 'react'

type GeolocationState =
  | { status: 'idle'; coords: null; error: null }
  | { status: 'loading'; coords: null; error: null }
  | { status: 'success'; coords: { lat: number; lng: number }; error: null }
  | { status: 'error'; coords: null; error: string }

/**
 * ブラウザの Geolocation API を「ボタン押下時に取得」する形で扱うフック。
 * 自動取得しない（権限ダイアログを暗黙に出さない）のがポイント。
 *
 * 取得結果は呼び出し側がキャッシュしたい場合に request() の戻り値で受け取る。
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    status: 'idle',
    coords: null,
    error: null,
  })

  const request = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({
        status: 'error',
        coords: null,
        error: 'このブラウザは位置情報に対応していません',
      })
      return Promise.resolve(null)
    }

    setState({ status: 'loading', coords: null, error: null })
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setState({ status: 'success', coords, error: null })
          resolve(coords)
        },
        (err) => {
          setState({ status: 'error', coords: null, error: err.message })
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
      )
    })
  }, [])

  const clear = useCallback(() => {
    setState({ status: 'idle', coords: null, error: null })
  }, [])

  return { ...state, request, clear }
}
