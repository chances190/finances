export type Preset = 'warm' | 'glass' | 'clay' | 'nordic'
export type LedgerVariant = 'feed' | 'hybrid' | 'table'
export type DesktopNav = 'top' | 'side'
export type MobileNav = 'sheet' | 'bottom'
export type Density = 'comfortable' | 'compact'
export type Accent = 'preset' | 'ink' | 'teal' | 'plum'
export type IconPack = 'phosphor' | 'tabler' | 'hugeicons'
export type LabTheme = 'light' | 'dark'
export type Dataset = 'rich' | 'stress'
export type LabScreen = 'transactions' | 'dashboard'
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
  preset: Preset
  ledger: LedgerVariant
  desktopNav: DesktopNav
  mobileNav: MobileNav
  density: Density
  accent: Accent
  iconPack: IconPack
  theme: LabTheme
  dataset: Dataset
  screen: LabScreen
  viewport: 390 | 768 | 1280
}

export const defaultSettings: LabSettings = {
  preset: 'warm',
  ledger: 'feed',
  desktopNav: 'top',
  mobileNav: 'bottom',
  density: 'comfortable',
  accent: 'preset',
  iconPack: 'hugeicons',
  theme: 'light',
  dataset: 'rich',
  screen: 'transactions',
  viewport: 1280,
}
