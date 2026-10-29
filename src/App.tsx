import { lazy, Suspense, useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import ErrorBoundary from './ui/components/Common/ErrorBoundary'
import MobileNav from './ui/components/Common/MobileNav'
import Tabs from './ui/components/Common/Tabs'
import TransactionTable from './ui/components/Transactions/TransactionTable'
import { FinanceProvider, useFinance } from './ui/context'
import { ToastProvider, useToast } from './ui/context/ToastContext'

const BudgetPage = lazy(() => import('./ui/components/Budget/BudgetPage'))
const AuditLogPanel = lazy(() => import('./ui/components/Common/AuditLogPanel'))
const DashboardPage = lazy(() => import('./ui/components/Dashboard/DashboardPage'))
const TrendsPage = lazy(() => import('./ui/components/Dashboard/TrendsPage'))
const DebtPage = lazy(() => import('./ui/components/Debts/DebtPage'))

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
      <header className="sticky top-0 z-40 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-heading font-bold">Finances</h1>
          <MobileNav tabs={tabs} active={activeTab} onChange={(key) => navigate(key)} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="hidden sm:block">
          <Tabs tabs={tabs} active={activeTab} onChange={(key) => navigate(key)} />
        </div>

        <Suspense
          fallback={<p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>}
        >
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
        </Suspense>
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
