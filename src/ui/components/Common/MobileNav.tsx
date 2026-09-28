import { ListIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}

export default function MobileNav({ tabs, active, onChange }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-lg" className="size-10 sm:hidden" />}
        aria-label="Open navigation"
      >
        <ListIcon />
      </DialogTrigger>

      <DialogContent side="left" showCloseButton={false} className="flex w-72 flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>Navigate</DialogTitle>
        </DialogHeader>
        <nav className="flex flex-col p-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant="ghost"
              aria-current={active === tab.key ? 'page' : undefined}
              className={cn(
                'h-11 justify-start px-3 text-sm',
                active === tab.key && 'bg-muted text-foreground',
              )}
              onClick={() => {
                onChange(tab.key)
                setOpen(false)
              }}
            >
              {tab.label}
            </Button>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  )
}
