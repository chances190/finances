import { finance } from './stores/finance.svelte'
import { toast } from './stores/toast.svelte'

export function toastUndo(
  message: string,
  auditId: string | null,
  type: 'success' | 'info' = 'success',
) {
  toast(
    message,
    type,
    auditId
      ? {
          label: 'Undo',
          run: () => finance.dispatch({ type: 'UNDO', payload: auditId }),
        }
      : undefined,
  )
}
