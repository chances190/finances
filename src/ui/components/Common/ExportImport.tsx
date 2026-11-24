import { Button } from '@/components/ui/button'
import { exportJSON } from '@/data/backup/json'
import { exportCSV } from '@/data/exchange/csv'
import { useFinance } from '@/ui/context'

export default function ExportImport() {
  const { state } = useFinance()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="xs"
        title="Complete backup of transactions, settlements, and budgets"
        onClick={() => exportJSON({ movements: state.movements, budgets: state.budgets })}
      >
        Export full backup (.json)
      </Button>
      <Button
        variant="outline"
        size="xs"
        title="Exchange purchases and income with other tools"
        onClick={() => exportCSV(state.movements)}
      >
        Export CSV (purchases & income)
      </Button>
    </div>
  )
}
