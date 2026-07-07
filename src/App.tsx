import { useCallback, useEffect, useState } from 'react'
import BudgetPage from './ui/components/Budget/BudgetPage'
import AuditLogPanel from './ui/components/Common/AuditLogPanel'
import ErrorBoundary from './ui/components/Common/ErrorBoundary'
import ExportImport from './ui/components/Common/ExportImport'
import Tabs from './ui/components/Common/Tabs'
import DebtPage from './ui/components/Debts/DebtPage'
import TransactionTable from './ui/components/Transactions/TransactionTable'
import { FinanceProvider, useFinance } from './ui/context'
import { ToastProvider, useToast } from './ui/context/ToastContext'

const tabs = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'debts', label: 'Debts' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'history', label: 'History' },
]

function PagePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      {name} — coming soon
    </div>
  )
}

function ShellInner() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const latest = state.auditLog[0]
        if (latest) {
          dispatch({ type: 'UNDO', payload: latest.id })
          toast(`Undo: ${latest.description}`, 'info')
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (state.redoStack.length > 0) {
          dispatch({ type: 'REDO' })
          toast('Redo', 'info')
        }
      }
    },
    [state.auditLog, state.redoStack, dispatch, toast],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return <ShellContent />
}

function ShellContent() {
  const [activeTab, setActiveTab] = useState('transactions')

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-heading font-bold">Finances</h1>
          <ExportImport />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'transactions' && <TransactionTable />}
        {activeTab === 'budgets' && <BudgetPage />}
        {activeTab === 'debts' && <DebtPage />}
        {activeTab === 'history' && <AuditLogPanel standalone />}
        {activeTab === 'dashboard' && <PagePlaceholder name="Dashboard" />}
        {activeTab === 'yearly' && <PagePlaceholder name="Yearly Overview" />}
      </main>
    </div>
  )
}

function AppShell() {
  return <ShellInner />
}

export default function App() {
  return (
    <FinanceProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </ToastProvider>
    </FinanceProvider>
  )
}
