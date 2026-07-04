import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportCSV, exportJSON } from '@/data/exportImport'
import { useFinance } from '@/ui/context'
import CSVImportDialog from './CSVImportDialog'
import { FileArrowDownIcon } from '@phosphor-icons/react'

export default function ExportImport() {
  const { state } = useFinance()
  const [showImport, setShowImport] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="xs" onClick={() => exportJSON({ transactions: state.transactions, budgets: state.budgets })}>
          Export JSON
        </Button>
        <Button variant="outline" size="xs" onClick={() => exportCSV(state.transactions)}>
          Export CSV
        </Button>
        <Button variant="outline" size="xs" onClick={() => setShowImport(true)}>
          <FileArrowDownIcon /> Import
        </Button>
      </div>
      <CSVImportDialog open={showImport} onOpenChange={setShowImport} />
    </>
  )
}