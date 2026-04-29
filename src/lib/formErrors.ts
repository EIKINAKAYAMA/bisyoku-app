import type { FieldErrors, FieldValues } from 'react-hook-form'

const isFormControl = (
  el: Element
): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  el instanceof HTMLButtonElement

/**
 * RHF の onInvalid ハンドラから呼ぶ。最初のエラーフィールドへスクロールしてフォーカス。
 *
 * 解決順：
 *  1. `id={key}` の DOM 要素（通常の input/textarea）
 *  2. `id="field-${key}"` のラッパ（GenreField のようなカスタムコンポーネント）
 *  3. `[name="${key}"]` 属性
 *
 * 1 と 3 はそのままフォーカス。2 のラッパは中の最初のフォーカス可能要素にフォーカスを譲る。
 */
export function focusFirstFormError<T extends FieldValues>(errors: FieldErrors<T>): void {
  const firstKey = Object.keys(errors)[0]
  if (!firstKey) return

  const el =
    document.getElementById(firstKey) ??
    document.getElementById(`field-${firstKey}`) ??
    document.querySelector<HTMLElement>(`[name="${firstKey}"]`)
  if (!(el instanceof HTMLElement)) return

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // フォーカス対象を決める：マッチ要素自体がフォーム部品ならそれ、ラッパなら中の先頭要素
  const focusTarget: HTMLElement | null = isFormControl(el)
    ? el
    : el.querySelector<HTMLElement>('input, textarea, select, button')

  if (focusTarget) {
    // smooth scroll と同時に focus すると iOS で位置が飛ぶことがあるので少し遅らせる
    window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 250)
  }
}
