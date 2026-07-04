import { useState } from 'react'
import ExportImport from './ui/components/Common/ExportImport'
import Tabs from './ui/components/Common/Tabs'
import { FinanceProvider } from './ui/context'

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'debts', label: 'Debts' },
  { key: 'yearly', label: 'Yearly' },
]

function PagePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-lg">
      {name} — coming soon
    </div>
  )
}

function AppShell() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Finances</h1>
          <ExportImport />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'dashboard' && <PagePlaceholder name="Dashboard" />}
        {activeTab === 'transactions' && <PagePlaceholder name="Transactions" />}
        {activeTab === 'budgets' && <PagePlaceholder name="Budgets" />}
        {activeTab === 'debts' && <PagePlaceholder name="Debts" />}
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
