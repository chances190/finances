import { Button } from '@/components/ui/button'
import { exportCSV, exportJSON } from '@/data/exportImport'
import { useFinance } from '@/ui/context'

export default function ExportImport() {
  const { state } = useFinance()

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="xs"
        onClick={() => exportJSON({ transactions: state.transactions, budgets: state.budgets })}
      >
        Export JSON
      </Button>
      <Button variant="outline" size="xs" onClick={() => exportCSV(state.transactions)}>
        Export CSV
      </Button>
    </div>
  )
}
