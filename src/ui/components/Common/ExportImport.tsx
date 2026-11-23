import { Button } from '@/components/ui/button'
import { exportJSON } from '@/data/backup/json'
import { exportCSV } from '@/data/exchange/csv'
import { useFinance } from '@/ui/context'

export default function ExportImport() {
  const { state } = useFinance()

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="xs"
        title="Backup all data (transactions + budgets)"
        onClick={() => exportJSON({ movements: state.movements, budgets: state.budgets })}
      >
        Export Backup (.json)
      </Button>
      <Button
        variant="outline"
        size="xs"
        title="Export transactions only (exchange format)"
        onClick={() => exportCSV(state.movements)}
      >
        Export Transactions (.csv)
      </Button>
    </div>
  )
}
