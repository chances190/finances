export type NavIconName =
  | 'transactions'
  | 'budgets'
  | 'debts'
  | 'dashboard'
  | 'trends'
  | 'history'
  | 'settings'

export interface NavItem {
  path: string
  label: string
  icon: NavIconName
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Transactions', icon: 'transactions' },
  { path: '/budgets', label: 'Budgets', icon: 'budgets' },
  { path: '/debts', label: 'Debts', icon: 'debts' },
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/yearly', label: 'Trends', icon: 'trends' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]
