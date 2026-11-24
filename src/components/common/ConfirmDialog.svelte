<script lang="ts">
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  onConfirm: () => void
  confirmLabel?: string
  destructive?: boolean
}

let {
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
  confirmLabel = 'Confirm',
  destructive = false,
}: Props = $props()
</script>

<Dialog {open} {onOpenChange}>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    <p class="text-sm text-muted-foreground">{message}</p>
    <div class="flex gap-2 justify-end pt-2">
      <Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
      <Button
        variant={destructive ? 'destructive' : 'default'}
        class={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
        onclick={() => {
          onConfirm()
          onOpenChange(false)
        }}
      >
        {confirmLabel}
      </Button>
    </div>
  </DialogContent>
</Dialog>
