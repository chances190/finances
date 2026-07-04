import { useState } from 'react'
import ExportImport from './ui/components/Common/ExportImport'
import Tabs from './ui/components/Common/Tabs'
import TransactionTable from './ui/components/Transactions/TransactionTable'
import BudgetPage from './ui/components/Budget/BudgetPage'
import { FinanceProvider } from './ui/context'

const tabs = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'debts', label: 'Debts' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'yearly', label: 'Yearly' },
]

function PagePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      {name} — coming soon
    </div>
  )
}

function AppShell() {
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
        {activeTab === 'debts' && <PagePlaceholder name="Debts" />}
        {activeTab === 'dashboard' && <PagePlaceholder name="Dashboard" />}
        {activeTab === 'yearly' && <PagePlaceholder name="Yearly Overview" />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <FinanceProvider>
      <AppShell />
    </FinanceProvider>
  )
}
