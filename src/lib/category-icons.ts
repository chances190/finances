import {
  Airplane01Icon,
  Book01Icon,
  Briefcase01Icon,
  Car01Icon,
  Coffee01Icon,
  ComputerIcon,
  Dumbbell01Icon,
  Film01Icon,
  GiftIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  Home01Icon,
  Invoice01Icon,
  PawPrintIcon,
  Restaurant01Icon,
  ShoppingBag01Icon,
  Tag01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/svelte'

export const CATEGORY_ICONS = {
  tag: Tag01Icon,
  food: Restaurant01Icon,
  fun: Film01Icon,
  transport: Car01Icon,
  tech: ComputerIcon,
  home: Home01Icon,
  health: HeartPulseIcon,
  work: Briefcase01Icon,
  study: GraduationCapIcon,
  fitness: Dumbbell01Icon,
  pet: PawPrintIcon,
  travel: Airplane01Icon,
  shopping: ShoppingBag01Icon,
  bills: Invoice01Icon,
  gift: GiftIcon,
  family: UserGroupIcon,
  coffee: Coffee01Icon,
  book: Book01Icon,
  wallet: Wallet01Icon,
} as const

export type CategoryIconName = keyof typeof CATEGORY_ICONS

export const CATEGORY_ICON_OPTIONS = Object.entries(CATEGORY_ICONS).map(([name, icon]) => ({
  name: name as CategoryIconName,
  icon,
}))

const DEFAULT_ICON: Record<string, CategoryIconName> = {
  food: 'food',
  restaurant: 'food',
  dining: 'food',
  fun: 'fun',
  entertainment: 'fun',
  movies: 'fun',
  transport: 'transport',
  travel: 'travel',
  tech: 'tech',
  technology: 'tech',
  home: 'home',
  health: 'health',
  fitness: 'fitness',
  work: 'work',
  salary: 'wallet',
  income: 'wallet',
  study: 'study',
  books: 'book',
  pets: 'pet',
  shopping: 'shopping',
  bills: 'bills',
  gifts: 'gift',
  family: 'family',
  coffee: 'coffee',
}

export function resolveCategoryIconName(category: string, stored?: string): CategoryIconName {
  if (stored && stored in CATEGORY_ICONS) return stored as CategoryIconName
  return DEFAULT_ICON[category.trim().toLowerCase()] ?? 'tag'
}

export function resolveCategoryIcon(category: string, stored?: string): IconSvgElement {
  return CATEGORY_ICONS[resolveCategoryIconName(category, stored)]
}
