import { useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import BudgetPage from './ui/components/Budget/BudgetPage'
import AuditLogPanel from './ui/components/Common/AuditLogPanel'
import ErrorBoundary from './ui/components/Common/ErrorBoundary'
import MobileNav from './ui/components/Common/MobileNav'
import Tabs from './ui/components/Common/Tabs'
import DashboardPage from './ui/components/Dashboard/DashboardPage'
import TrendsPage from './ui/components/Dashboard/TrendsPage'
import DebtPage from './ui/components/Debts/DebtPage'
import TransactionTable from './ui/components/Transactions/TransactionTable'
import { FinanceProvider, useFinance } from './ui/context'
import { ToastProvider, useToast } from './ui/context/ToastContext'

const tabs = [
  { key: '/', label: 'Transactions' },
  { key: '/budgets', label: 'Budgets' },
  { key: '/debts', label: 'Debts' },
  { key: '/dashboard', label: 'Dashboard' },
  { key: '/yearly', label: 'Trends' },
  { key: '/history', label: 'Actions' },
]

function AppShell() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [location, navigate] = useLocation()

  const activeTab = tabs.find((t) => t.key === location.split('?')[0])?.key ?? '/'

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const target = e.target as HTMLElement | null
      const isTextEntry =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      const isInteractiveControl =
        target instanceof HTMLElement &&
        target.closest(
          'button, a, [role="button"], [role="checkbox"], [role="combobox"], [role="switch"]',
        )
      if (isTextEntry || isInteractiveControl) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const latest = state.auditLog[0]
        if (latest) {
          dispatch({ type: 'UNDO', payload: latest.id })
          toast(`Undo: ${latest.description}`, 'info')
        }
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        if (state.redoStack.length > 0) {
          dispatch({ type: 'REDO' })
          toast('Redo', 'info')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.auditLog, state.redoStack, dispatch, toast])

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-heading font-bold">Finances</h1>
          <MobileNav tabs={tabs} active={activeTab} onChange={(key) => navigate(key)} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="hidden sm:block">
          <Tabs tabs={tabs} active={activeTab} onChange={(key) => navigate(key)} />
        </div>

        <Switch>
          <Route path="/" component={TransactionTable} />
          <Route path="/budgets" component={BudgetPage} />
          <Route path="/debts" component={DebtPage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/yearly" component={TrendsPage} />
          <Route path="/history" component={AuditLogPanel} />
          <Route>
            <TransactionTable />
          </Route>
        </Switch>
      </main>
    </div>
  )
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
