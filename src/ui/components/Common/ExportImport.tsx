import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportCSV, exportJSON, importJSON } from '@/data/exportImport'
import { useFinance } from '@/ui/context'
import CSVImportDialog from './CSVImportDialog'

export default function ExportImport() {
  const { state, dispatch } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showImport, setShowImport] = useState(false)

  function handleExportJSON() {
    exportJSON({ transactions: state.transactions, budgets: state.budgets })
  }

  function handleExportCSV() {
    exportCSV(state.transactions)
  }

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = importJSON(reader.result as string)
        dispatch({ type: 'IMPORT', payload: data })
      } catch (err) {
        alert(`Invalid JSON file: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="xs" onClick={handleExportJSON}>Export JSON</Button>
        <Button variant="outline" size="xs" onClick={handleExportCSV}>Export CSV</Button>
        <Button variant="outline" size="xs" onClick={() => setShowImport(true)}>Import</Button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
      </div>
      <CSVImportDialog open={showImport} onOpenChange={setShowImport} />
    </>
  )
}