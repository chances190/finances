export type DesktopNav = 'top' | 'side'
export type Density = 'comfortable' | 'compact'
export type Accent = 'preset' | 'ink' | 'sage' | 'steel' | 'plum'
export type LabTheme = 'light' | 'dark'
export type Dataset = 'rich' | 'stress'
export type LabScreen = 'transactions' | 'budgets' | 'debts' | 'dashboard' | 'trends' | 'actions'
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
  desktopNav: DesktopNav
  density: Density
  accent: Accent
  theme: LabTheme
  dataset: Dataset
  screen: LabScreen
  viewport: 390 | 768 | 1280
}

export const defaultSettings: LabSettings = {
  desktopNav: 'top',
  density: 'comfortable',
  accent: 'preset',
  theme: 'dark',
  dataset: 'rich',
  screen: 'transactions',
  viewport: 1280,
}
