import c from 'currency.js'

const brlOpts = { symbol: 'R$ ', separator: '.', decimal: ',', precision: 2 }

export function parseCurrency(input: string | number): number {
  if (typeof input === 'number') return input
  const str = input.trim()
  if (!str) return 0
  if (str.includes(',')) {
    const normalized = Number(str.replace(/\./g, '').replace(/,/g, '.'))
    if (!Number.isNaN(normalized)) return normalized
  }
  return c(str, { precision: 2 }).value
}

export function formatCurrency(value: number): string {
  return c(value, brlOpts).format()
}

export function formatPlainCurrency(value: number): string {
  return c(value, { ...brlOpts, symbol: '' }).format()
}

export function addCurrency(a: number, b: number): number {
  return c(a).add(b).value
}
