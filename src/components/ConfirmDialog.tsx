import { type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  /** confirm ボタンの色味。destructive は赤系の警告調 */
  variant?: 'default' | 'destructive'
  busy?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  onConfirm,
  variant = 'default',
  busy,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {variant === 'destructive' && (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? '処理中...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
