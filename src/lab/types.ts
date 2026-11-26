export type Density = 'comfortable' | 'compact'
export type Accent = 'ink' | 'sage' | 'steel' | 'plum'
export type InkAccent =
  | 'mono'
  | 'system'
  | 'yellow'
  | 'green'
  | 'red'
  | 'pink'
  | 'blue'
  | 'purple'
  | 'orange'
export type LabTheme = 'system' | 'light' | 'dark'
export type Dataset = 'rich' | 'stress'
export type LabScreen =
  | 'transactions'
  | 'budgets'
  | 'debts'
  | 'dashboard'
  | 'trends'
  | 'actions'
  | 'settings'
export type IconName =
  | 'transactions'
  | 'budgets'
  | 'debts'
  | 'dashboard'
  | 'trends'
  | 'actions'
  | 'search'
  | 'filter'
  | 'plus'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'arrow'

export interface LabSettings {
  density: Density
  accent: Accent
  inkAccent: InkAccent
  theme: LabTheme
  dataset: Dataset
  screen: LabScreen
  viewport: 390 | 768 | 1280
}

export const defaultSettings: LabSettings = {
  density: 'comfortable',
  accent: 'ink',
  inkAccent: 'mono',
  theme: 'system',
  dataset: 'rich',
  screen: 'transactions',
  viewport: 1280,
}
