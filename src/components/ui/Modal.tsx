import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/shadcn/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/shadcn/sheet'
import { IconButton } from './Button'

/**
 * 模态 / 抽屉：基于 shadcn/ui Dialog、Sheet（Radix）。
 * 焦点锁定、Esc 关闭与关闭后焦点回到触发控件由 Radix 处理；
 * Esc 在此截停，避免同时触发外壳的“退出全屏 / 关闭浮层”快捷键。
 */
interface OverlayProps {
  title: ReactNode
  subtitle?: ReactNode
  width?: number
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

function Header({ title, subtitle, onClose, kind }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; kind: 'dialog' | 'sheet' }) {
  const Title = kind === 'dialog' ? DialogTitle : SheetTitle
  const Description = kind === 'dialog' ? DialogDescription : SheetDescription
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line pl-5 pr-3">
      <Title className="min-w-0 flex-1 truncate text-body-lg font-semibold text-ink">{title}</Title>
      {subtitle ? <Description className="text-label text-muted">{subtitle}</Description> : null}
      <IconButton icon={X} label="关闭" size="sm" onClick={onClose} />
    </header>
  )
}

function Footer({ children }: { children: ReactNode }) {
  return <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">{children}</footer>
}

export default function Modal({ title, subtitle, width = 560, onClose, footer, children }: OverlayProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(22_42_64/0.36)]"
        {...(subtitle ? {} : { 'aria-describedby': undefined })}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        style={{ width }}
        className="flex max-h-[calc(100vh-96px)] max-w-[calc(100%-48px)] flex-col gap-0 overflow-hidden rounded-lg border-0 bg-surface p-0 shadow-pop sm:max-w-[calc(100%-48px)]"
      >
        <Header title={title} subtitle={subtitle} onClose={onClose} kind="dialog" />
        <div className="scroll-thin min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? <Footer>{footer}</Footer> : null}
      </DialogContent>
    </Dialog>
  )
}

export function Drawer({ title, subtitle, width = 520, onClose, footer, children }: OverlayProps) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-[rgb(22_42_64/0.24)]"
        {...(subtitle ? {} : { 'aria-describedby': undefined })}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        style={{ width }}
        className="max-w-full gap-0 border-l-0 bg-surface p-0 shadow-pop sm:max-w-full"
      >
        <Header title={title} subtitle={subtitle} onClose={onClose} kind="sheet" />
        <div className="scroll-thin min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? <Footer>{footer}</Footer> : null}
      </SheetContent>
    </Sheet>
  )
}
