import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Calendar, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RATING_AXES } from '@/lib/constants'
import { ratingTone } from '@/lib/rating'
import type { Rating, Visit } from '@/features/visits/api'

type Owner = { id: string; display_name: string; avatar_url: string | null } | null

type Props = {
  visit: Visit & { rating: Rating | null }
  /** 表示モード：店舗詳細 → "by ユーザー名"、ユーザー履歴 → "店舗名" */
  primary:
    | { kind: 'user'; user: Owner }
    | { kind: 'restaurant'; restaurant: { id: string; name: string } | null; genre?: string | null; priceRange?: string | null }
  isOwner: boolean
  editTo?: string
  onDelete?: () => void
  deleting?: boolean
}

export function VisitItem({
  visit: v,
  primary,
  isOwner,
  editTo,
  onDelete,
  deleting,
}: Props) {
  const hasDetails = !!(v.order_content || v.payment_amount != null)
  const hasComment = !!v.comment

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col gap-3 p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          {primary.kind === 'user' ? (
            <Link
              to={`/users/${primary.user?.id}`}
              className="flex min-w-0 items-center gap-3 hover:opacity-80"
            >
              <Avatar
                src={primary.user?.avatar_url ?? null}
                fallback={primary.user?.display_name ?? '?'}
                alt={primary.user?.display_name}
                className="h-10 w-10"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-base font-semibold">
                  {primary.user?.display_name ?? '不明なユーザー'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {v.visit_date
                      ? format(new Date(v.visit_date), 'yyyy/MM/dd')
                      : '日付未記入'}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="min-w-0 space-y-1">
              <Link
                to={`/restaurants/${primary.restaurant?.id}`}
                className="block truncate text-base font-semibold hover:underline"
              >
                {primary.restaurant?.name ?? '不明な店舗'}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {v.visit_date ? format(new Date(v.visit_date), 'yyyy/MM/dd') : '日付未記入'}
                </span>
              </div>
            </div>
          )}
          {isOwner && (
            <div className="flex items-center gap-1">
              {editTo && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                  <Link to={editTo} aria-label="編集">
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDelete}
                  disabled={deleting}
                  aria-label="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* genre/price バッジ（restaurant モードのみ） */}
        {primary.kind === 'restaurant' && (primary.genre || primary.priceRange) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {primary.genre && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {primary.genre}
              </span>
            )}
            {primary.priceRange && (
              <span className="rounded-full bg-accent/30 px-2 py-0.5 font-medium text-accent-foreground">
                {primary.priceRange}
              </span>
            )}
          </div>
        )}

        {/* 評価ブロック：必ず表示。評価無しでも統一感を保つ */}
        {v.rating ? (
          <div className="grid grid-cols-5 gap-2 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 p-3 text-center">
            {RATING_AXES.map((axis) => {
              const score = v.rating![axis.key]
              return (
                <div key={axis.key}>
                  <p className="text-[10px] text-muted-foreground">{axis.label}</p>
                  <p className={`mt-0.5 text-base font-bold tabular-nums ${ratingTone(score)}`}>
                    {score}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
            評価なし
          </div>
        )}

        {/* コメント：書かれていれば強調表示 */}
        {hasComment && (
          <div className="rounded-md border-l-4 border-primary/40 bg-primary/5 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
              <MessageSquare className="h-3 w-3" />
              コメント
            </div>
            <p className="whitespace-pre-wrap">{v.comment}</p>
          </div>
        )}

        {/* 詳細（注文・支払）：1 つ以上あれば表示 */}
        {hasDetails && (
          <div className="space-y-1 border-t pt-3 text-sm">
            {v.order_content && (
              <p className="whitespace-pre-wrap text-muted-foreground">
                <span className="font-medium text-foreground">注文：</span>
                {v.order_content}
              </p>
            )}
            {v.payment_amount != null && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">支払い：</span>
                {v.payment_amount.toLocaleString()} 円
              </p>
            )}
          </div>
        )}

        {/* 全部空のとき：見栄えを保つためミニバッジ */}
        {!v.rating && !hasComment && !hasDetails && (
          <p className="text-xs text-muted-foreground">記録のみ</p>
        )}
      </CardContent>
    </Card>
  )
}
