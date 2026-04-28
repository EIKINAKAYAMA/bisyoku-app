/** 評価値をスコア帯に応じた Tailwind カラークラスに変換 */
export function ratingTone(score: number): string {
  if (score >= 9) return 'text-amber-500'
  if (score >= 7) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 5) return 'text-foreground'
  return 'text-rose-500'
}
