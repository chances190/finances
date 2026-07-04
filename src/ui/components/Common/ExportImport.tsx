import { useRef } from 'react'
import { exportCSV, exportJSON, importJSON } from '../../../data/exportImport'
import { useFinance } from '../../context'

export default function ExportImport() {
  const { state, dispatch } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)

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
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleExportJSON}
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        Export JSON
      </button>
      <button
        type="button"
        onClick={handleExportCSV}
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        Import JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        className="hidden"
      />
    </div>
  )
}
