import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from '@phosphor-icons/react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Mobile Chrome can report a layout viewport far wider than the screen (zoom,
// installed-app viewport quirks), which makes `sm:` dialogs overflow. The only
// reliable width is the visual viewport, so expose it as a CSS variable.
function useVisualViewportVars() {
  React.useLayoutEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--visual-viewport-width', `${viewport.width}px`)
      root.style.setProperty('--visual-viewport-height', `${viewport.height}px`)
      root.style.setProperty('--visual-viewport-left', `${viewport.offsetLeft}px`)
      root.style.setProperty('--visual-viewport-top', `${viewport.offsetTop}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed left-[var(--visual-viewport-left,0px)] top-[var(--visual-viewport-top,0px)] isolate z-50 h-[var(--visual-viewport-height,100svh)] w-[var(--visual-viewport-width,100vw)] bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

const SIDES = {
  center:
    'left-[calc(var(--visual-viewport-left,0px)+var(--visual-viewport-width,100vw)/2)] top-[calc(var(--visual-viewport-top,0px)+var(--visual-viewport-height,100svh)/2)] w-full max-w-[min(24rem,calc(var(--visual-viewport-width,100vw)-2rem))] max-h-[calc(min(100svh,var(--visual-viewport-height,100svh))-2rem)] -translate-x-1/2 -translate-y-1/2 data-open:zoom-in-95 data-closed:zoom-out-95',
  right:
    'inset-y-0 right-0 w-72 max-w-[80vw] translate-x-0 translate-y-0 data-open:slide-in-from-right data-closed:slide-out-to-right',
} as const

function DialogContent({
  className,
  children,
  showCloseButton = true,
  side = 'center',
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  side?: keyof typeof SIDES
}) {
  useVisualViewportVars()
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed z-50 grid gap-4 overflow-y-auto overscroll-contain rounded-none bg-popover p-4 text-xs/relaxed text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          SIDES[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1 text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-heading text-sm font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-xs/relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
